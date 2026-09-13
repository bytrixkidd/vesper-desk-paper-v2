import { Mic, X } from "lucide-react";
import { useState } from "react";
import { useDeskStore } from "@/lib/store";
import { stripJargon, toPoints } from "@/lib/vesper/plain";
import { endConversation, toggleListen } from "@/lib/vesper/listen";
import { useVesperStore } from "@/lib/vesper/store";
import { sendToVesper } from "@/lib/vesper/talk";
import { abortTts } from "@/lib/vesper/tts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { VesperCore } from "@/components/vesper/core";
import { MicMeter } from "@/components/vesper/meter";
import { AskBlocks } from "@/components/vesper/ask-blocks";

const PHASE: Record<string, string> = {
  idle: "bereit",
  listening: "hört zu",
  thinking: "prüft",
  executing: "öffnet",
  speaking: "spricht",
};

export function VesperDock() {
  const status = useVesperStore((s) => s.status);
  const open = useVesperStore((s) => s.open);
  const setOpen = useVesperStore((s) => s.setOpen);
  const micOn = useVesperStore((s) => s.micOn);
  const partial = useVesperStore((s) => s.partial);
  const turns = useVesperStore((s) => s.turns);
  const lastError = useVesperStore((s) => s.lastError);
  const conversation = useVesperStore((s) => s.conversation);
  const caption = useVesperStore((s) => s.caption);
  const stop = useVesperStore((s) => s.stop);
  const aiAvailable = useDeskStore((s) => s.aiAvailable);
  const [draft, setDraft] = useState("");
  const [more, setMore] = useState(false);

  const lastVesper = [...turns].reverse().find((t) => t.role === "vesper");
  const spoken =
    partial ||
    (lastVesper?.spoken && lastVesper.spoken !== "Natürlich, Sir." ? lastVesper.spoken : null) ||
    (lastVesper?.text && lastVesper.text !== "Natürlich, Sir." ? lastVesper.text.split("\n")[0] : null) ||
    "Bereit.";
  const expanded = open;
  const points = toPoints(lastVesper?.text || spoken, 5);

  async function submit() {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    await sendToVesper(t, "typed");
  }

  return (
    <div className="vesper-dock pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-5">
      {caption ? (
        <p className="pointer-events-none mx-auto mb-2 max-w-xl rounded-md bg-elevated/90 px-3 py-1.5 text-center text-2xs text-fg shadow-[var(--shadow-border)]">
          {caption}
        </p>
      ) : null}
      <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col overflow-hidden rounded-lg bg-surface/95 shadow-[var(--shadow-border)] backdrop-blur-sm">
        {expanded ? (
          <div className="max-h-48 min-h-0 overflow-y-auto px-4 py-3">
            <ul className="space-y-1.5 text-sm text-fg">
              {points.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="mt-[0.55em] size-1 shrink-0 rounded-full bg-fg/70" aria-hidden />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            {lastError ? <p className="mt-2 text-xs text-short">{lastError}</p> : null}
          </div>
        ) : null}
        <div className="flex items-center gap-3 px-3 py-2">
          <VesperCore
            status={status}
            micOn={micOn}
            size="sm"
            caption={false}
            onClick={() => {
              setOpen(true);
              void toggleListen(sendToVesper);
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-fg">{stripJargon(spoken)}</p>
            <p className="text-2xs text-muted">
              {PHASE[status] ?? status}
              {aiAvailable === false ? " · Modell offline" : ""}
              {micOn ? " · weiter sprechen" : ""}
            </p>
          </div>
          <Button
            variant={micOn ? "default" : "secondary"}
            size="icon"
            aria-label={micOn ? "Gespräch beenden" : "Sprechen"}
            className="size-11"
            onClick={() => void toggleListen(sendToVesper)}
          >
            <Mic />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={expanded ? "Zuklappen" : "Details"}
            onClick={() => {
              if (expanded) {
                setMore(false);
                setOpen(false);
              } else {
                setMore(true);
                setOpen(true);
              }
            }}
          >
            {expanded ? <X /> : <span className="text-2xs">···</span>}
          </Button>
        </div>
        {expanded ? (
          <div className="border-t border-border px-3 py-2">
            <AskBlocks variant="dock" />
          </div>
        ) : null}
        <form
          className="flex items-center gap-2 border-t border-border px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Schreiben…"
            className="h-10 min-w-0 flex-1 rounded-md bg-elevated px-3 text-sm text-fg outline-none ring-ring/60 focus:ring-2"
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="h-10 shrink-0 rounded-md bg-fg px-4 text-xs font-medium text-bg hover:opacity-90"
          >
            Senden
          </button>
          <MicMeter />
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
          ) : null}
        </form>
      </div>
    </div>
  );
}
