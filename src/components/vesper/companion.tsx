import { Mic, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDeskStore } from "@/lib/store";
import { beginListen, endConversation, toggleListen } from "@/lib/vesper/listen";
import { toPoints } from "@/lib/vesper/plain";
import { useVesperStore } from "@/lib/vesper/store";
import { sendToVesper } from "@/lib/vesper/talk";
import { abortTts } from "@/lib/vesper/tts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DiagPanel } from "@/components/vesper/diag-panel";
import { MicMeter } from "@/components/vesper/meter";
import { VoiceSettings } from "@/components/vesper/voice-settings";
import { AskBlocks } from "@/components/vesper/ask-blocks";

const STATUS: Record<string, string> = {
  idle: "bereit",
  listening: "hört zu",
  thinking: "prüft",
  executing: "handelt",
  speaking: "spricht",
};

export function VesperCompanion() {
  const status = useVesperStore((s) => s.status);
  const turns = useVesperStore((s) => s.turns);
  const sources = useVesperStore((s) => s.sources);
  const lastError = useVesperStore((s) => s.lastError);
  const micOn = useVesperStore((s) => s.micOn);
  const partial = useVesperStore((s) => s.partial);
  const conversation = useVesperStore((s) => s.conversation);
  const setOpen = useVesperStore((s) => s.setOpen);
  const stop = useVesperStore((s) => s.stop);
  const diagnoses = useVesperStore((s) => s.diagnoses);
  const intel = useVesperStore((s) => s.intel);
  const focusSymbol = useVesperStore((s) => s.focus.symbol);
  const aiAvailable = useDeskStore((s) => s.aiAvailable);
  const [draft, setDraft] = useState("");
  const [details, setDetails] = useState<"off" | "more" | "diag" | "voice">("off");

  const lastVesper = [...turns].reverse().find((t) => t.role === "vesper");
  const lastUser = [...turns].reverse().find((t) => t.role === "user");
  const evidence = (lastVesper?.sources ?? sources).slice(0, 3);
  const running = diagnoses.find((d) => d.status === "running" && (!focusSymbol || d.symbol === focusSymbol)) ?? diagnoses.find((d) => d.status === "running");
  const card = (focusSymbol && intel[focusSymbol]) || (running && intel[running.symbol]);
  const action = lastUser?.text;
  const spoken =
    partial ||
    (lastVesper?.spoken && lastVesper.spoken !== "Natürlich, Sir." ? lastVesper.spoken : null) ||
    (lastVesper?.text && lastVesper.text !== "Natürlich, Sir." ? lastVesper.text.split("\n").filter(Boolean).slice(0, 4).join(" ") : null) ||
    "Bereit.";

  async function submit() {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    await sendToVesper(t, "typed");
  }

  return (
    <div className="flex h-full w-companion flex-col bg-surface">
      <header className="flex h-status shrink-0 items-center gap-3 border-b border-border px-4">
        <span
          className={cn(
            "size-1.5 rounded-full",
            status === "idle" ? "bg-subtle" : status === "listening" || status === "speaking" ? "bg-long pulse-dot" : "bg-warn pulse-dot",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fg">Vesper</p>
          <p className="text-2xs text-muted">
            {STATUS[status] ?? status}
            {aiAvailable === false ? " · Modell offline" : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Schließen"
          onClick={() => {
            abortTts();
            setOpen(false);
          }}
        >
          <X />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {details === "off" ? (
          <div className="space-y-5">
            {partial ? (
              <p className="font-display text-xl leading-snug text-fg">{partial}</p>
            ) : (
              <ul className="space-y-2 font-display text-xl leading-snug text-fg">
                {toPoints(spoken, 6).map((p) => (
                  <li key={p} className="flex gap-3">
                    <span className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-fg/70" aria-hidden />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            )}
            {action ? <p className="text-2xs text-subtle">Zuletzt: {action}</p> : null}
            {card ? (
              <div className="space-y-3">
                <p className="text-xs text-muted">{card.recWhy}</p>
                {card.diagnosis ? (
                  <p className="text-xs text-muted">
                    Diagnose Tag {card.diagnosis.day} von {card.diagnosis.days} · These {card.diagnosis.state}
                  </p>
                ) : running ? (
                  <p className="text-xs text-muted">
                    Beobachtung {running.name} · Tag {running.day} von {running.days} · These {running.thesisState}
                  </p>
                ) : null}
                <div className="space-y-1.5 text-xs text-muted">
                  <p>
                    <span className="text-subtle">Neu. </span>
                    {card.development}
                  </p>
                  {card.positives[0] ? (
                    <p>
                      <span className="text-long">Dafür. </span>
                      {card.positives[0]}
                    </p>
                  ) : null}
                  {card.negatives[0] ? (
                    <p>
                      <span className="text-short">Dagegen. </span>
                      {card.negatives[0]}
                    </p>
                  ) : null}
                  <p>
                    <span className="text-subtle">Bots. </span>
                    {card.bots.filter((b) => b.source !== "overnight").length === 0
                      ? "Keine direkte Notiz."
                      : `${card.bots.filter((b) => b.source !== "overnight" && b.stance === "pro").length} dafür, ${card.bots.filter((b) => b.source !== "overnight" && b.stance === "contra").length} vorsichtig · ${card.agreement}${card.sharedSource ? ", dieselbe Quelle" : ""}.`}
                  </p>
                </div>
                <p className="font-mono text-2xs tabular-nums text-subtle">
                  {card.scenarios.map((s) => `${s.label} ${s.p} %`).join(" · ")}
                </p>
                <p className="text-xs text-muted">{card.nextCheck}</p>
                {card.stale ? <p className="text-xs text-warn">Daten nicht frisch. Keine aktuelle Empfehlung vortäuschen.</p> : null}
              </div>
            ) : running ? (
              <p className="text-xs text-muted">
                Beobachtung {running.name} · Tag {running.day} von {running.days} · These {running.thesisState}
              </p>
            ) : null}
            {evidence.length > 0 ? (
              <ul className="space-y-2">
                {evidence.map((s) => (
                  <li key={s.title + s.at} className="border-l border-border pl-3">
                    <p className="text-xs text-fg">{s.title}</p>
                    <p className="text-2xs text-muted">{s.note}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {lastError ? <p className="text-xs text-short">{lastError}</p> : null}
            <button type="button" className="text-2xs tracking-[0.12em] text-muted uppercase hover:text-fg" onClick={() => setDetails("more")}>
              Details
            </button>
          </div>
        ) : details === "diag" ? (
          <DiagPanel />
        ) : details === "voice" ? (
          <VoiceSettings />
        ) : (
          <div className="space-y-4">
            <p className="whitespace-pre-wrap text-sm text-muted">{lastVesper?.text}</p>
            {lastVesper?.confidence ? (
              <p className="text-2xs text-subtle">
                Sicherheit {lastVesper.confidence.label}. {lastVesper.confidence.why}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setDetails("diag")}>
                Diagnose
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDetails("voice")}>
                Stimme
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDetails("off")}>
                Zurück
              </Button>
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-border p-3">
        <AskBlocks variant="rail" />
        <div className="mt-2 flex items-end gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Schreiben…"
            autoComplete="off"
            enterKeyHint="send"
            className="h-11 min-w-0 flex-1 rounded-md bg-elevated px-3 text-sm text-fg outline-none ring-ring/60 focus:ring-2"
          />
          <Button type="button" disabled={draft.trim().length < 1} onClick={() => void submit()}>
            Senden
          </Button>
          <Button
            variant={micOn ? "default" : "secondary"}
            size="icon"
            aria-label={micOn ? "Gespräch beenden" : "Sprechen"}
            className="size-11"
            onClick={() => void toggleListen(sendToVesper)}
          >
            <Mic />
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <MicMeter />
          <p className={cn("flex-1 text-2xs", micOn ? "text-long" : "text-subtle")}>
            {micOn ? "Pause sendet. Weiter sprechen, nicht erneut tippen." : "Mikrofon startet das Gespräch."}
          </p>
          {micOn || conversation ? (
            <button
              type="button"
              className="text-2xs text-muted hover:text-fg"
              onClick={() => {
                abortTts();
                void endConversation();
                stop();
              }}
            >
              Beenden
            </button>
          ) : (
            <button type="button" className="text-2xs text-muted hover:text-fg" onClick={() => void beginListen()}>
              Hören
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export function CompanionRail() {
  const open = useVesperStore((s) => s.open);
  return (
    <aside
      data-open={open ? "1" : "0"}
      className="companion-rail hidden h-full shrink-0 border-border bg-surface lg:block"
      aria-hidden={!open}
      aria-label="Vesper"
    >
      <VesperCompanion />
    </aside>
  );
}

export function CompanionDrawer() {
  const open = useVesperStore((s) => s.open);
  const setOpen = useVesperStore((s) => s.setOpen);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  if (!open || !mobile) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button type="button" className="absolute inset-0 bg-bg/70" aria-label="Schließen" onClick={() => setOpen(false)} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-sm bg-surface shadow-[var(--shadow-border)]">
        <VesperCompanion />
      </aside>
    </div>
  );
}
