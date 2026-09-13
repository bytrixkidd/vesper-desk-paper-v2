import { useEffect, useMemo, useState } from "react";
import { hintFromCard, stripJargon, toPoints } from "@/lib/vesper/plain";
import { wantsDetail } from "@/lib/vesper/speech";
import { beginListen, endConversation } from "@/lib/vesper/listen";
import { useVesperStore } from "@/lib/vesper/store";
import { armVoiceAndGreet, greetingWasSpoken, markGreetingSpoken, sendToVesper } from "@/lib/vesper/talk";
import { abortTts } from "@/lib/vesper/tts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { VesperCore } from "@/components/vesper/core";
import { MicMeter } from "@/components/vesper/meter";
import { AskBlocks } from "@/components/vesper/ask-blocks";

export function VesperBridge() {
  const status = useVesperStore((s) => s.status);
  const micOn = useVesperStore((s) => s.micOn);
  const partial = useVesperStore((s) => s.partial);
  const turns = useVesperStore((s) => s.turns);
  const lastError = useVesperStore((s) => s.lastError);
  const conversation = useVesperStore((s) => s.conversation);
  const captions = useVesperStore((s) => s.memory.prefs.captions);
  const greetIfNeeded = useVesperStore((s) => s.greetIfNeeded);
  const intel = useVesperStore((s) => s.intel);
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    greetIfNeeded();
    setReady(true);
  }, [greetIfNeeded]);

  const lastVesper = [...turns].reverse().find((t) => t.role === "vesper");
  const lastUser = [...turns].reverse().find((t) => t.role === "user");
  const blocked = Boolean(lastError && !micOn && /mikrofon|iframe|signal/i.test(lastError ?? ""));

  const hints = useMemo(() => {
    const cards = Object.values(intel);
    const ranked = cards
      .filter((c) => c.rec === "diagnose-laeuft" || c.rec === "genauer-pruefen" || c.rec === "these-widerlegt" || Math.abs(c.changeToday) >= 1)
      .slice(0, 3)
      .map(hintFromCard);
    return ranked.slice(0, 3);
  }, [intel]);

  async function onCore() {
    await armVoiceAndGreet();
    if (micOn || conversation) await endConversation();
    else await beginListen();
  }

  async function onSend() {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    abortTts();
    if (!greetingWasSpoken()) markGreetingSpoken();
    void sendToVesper(t, "typed");
  }

  const spokenRaw =
    lastVesper?.spoken && lastVesper.spoken !== "Natürlich, Sir."
      ? lastVesper.spoken
      : lastVesper?.text && lastVesper.text !== "Natürlich, Sir."
        ? lastVesper.text
        : lastVesper?.spoken;
  const spoken = captions ? spokenRaw : lastVesper?.text;
  const afterAsk =
    lastUser && lastVesper && lastVesper.ts >= lastUser.ts
      ? spokenRaw || spoken || ""
      : spoken || "Tippen Sie den Kern. Danach höre ich weiter.";
  const micBlocked = Boolean(lastError && /iframe|vorschau|mikrofon|signal/i.test(lastError));
  const line = partial
    ? partial
    : micBlocked
      ? lastError
      : micOn
        ? "Ich höre zu."
        : afterAsk;
  const explain = lastUser ? wantsDetail(lastUser.text) : false;
  const points = toPoints(line ?? "", explain ? 5 : 2);
  const shown = points.length ? points : line ? [stripJargon(line)] : [];

  return (
    <div className="vesper-room" data-vesper="vesper.room">
      <div className="vesper-room-bg" />
      <div className="vesper-room-grid" />
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-40" viewBox="0 0 1200 800" aria-hidden>
        <circle cx="600" cy="390" r="280" fill="none" stroke="currentColor" className="text-border-strong" strokeWidth="0.6" />
        <circle cx="600" cy="390" r="360" fill="none" stroke="currentColor" className="text-border" strokeWidth="0.5" />
        <circle cx="600" cy="390" r="430" fill="none" stroke="currentColor" className="text-border" strokeWidth="0.4" />
      </svg>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-4 pb-6 pt-4 sm:px-8">
        <div className="mx-auto grid w-full max-w-5xl shrink-0 grid-cols-3 gap-2">
          {(ready ? hints : []).map((h, i) => (
            <button
              key={h.symbol + h.line}
              type="button"
              className={cn(
                "enter-up min-w-0 rounded-lg bg-surface/80 px-2 py-2 text-left shadow-[var(--shadow-border)] backdrop-blur-sm sm:px-4 sm:py-3",
                `enter-up-${i + 1}`,
              )}
              onClick={() => void sendToVesper(`Was empfiehlst du bei ${h.title}?`, "typed")}
            >
              <p className="truncate text-2xs tracking-[0.08em] text-muted">{h.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-fg sm:text-sm">{h.line}</p>
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto py-4">
          <VesperCore status={status} micOn={micOn} blocked={blocked} onClick={() => void onCore()} />
          <MicMeter className="mt-12" />
          <ul
            className={cn(
              "mt-6 max-w-xl space-y-2 text-left font-display leading-snug text-fg",
              shown.length > 3 ? "text-lg sm:text-xl" : "text-xl sm:text-2xl",
              micBlocked && "text-short",
            )}
          >
            {shown.map((p) => (
              <li key={p} className="flex gap-3">
                <span className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-fg/70" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          {lastError && !micBlocked ? <p className="mt-2 max-w-lg text-center text-xs text-muted">{lastError}</p> : null}
          {lastUser && !partial ? <p className="mt-3 text-2xs text-subtle">Sie: {lastUser.text}</p> : null}
        </div>

        <div className="relative z-20 mx-auto w-full max-w-lg shrink-0">
          <AskBlocks variant="room" />
          <form
            className="mt-2 flex w-full items-stretch gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void onSend();
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onSend();
                }
              }}
              placeholder="Oder schreiben…"
              autoComplete="off"
              enterKeyHint="send"
              className="h-12 min-w-0 flex-1 rounded-md bg-elevated px-3 text-sm text-fg outline-none ring-ring/60 focus:ring-2"
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                void onSend();
              }}
              className="h-12 min-w-24 shrink-0 rounded-md bg-fg px-4 text-sm font-medium text-bg hover:opacity-90"
            >
              Senden
            </button>
          </form>
          {micOn || conversation ? (
            <div className="mt-2 flex justify-center">
              <Button variant="ghost" onClick={() => void endConversation()}>
                Gespräch beenden
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
