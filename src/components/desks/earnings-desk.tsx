import { useState } from "react";
import { toast } from "sonner";
import { formatUsd, GUIDE_LABEL } from "@/lib/format";
import { useDeskStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentNote, Kicker, Panel, TickerMark, ToneBar } from "@/components/shared";
import { useVesperFocus } from "@/lib/vesper/use-focus";

const GUIDE_TONE = {
  raised: "long" as const,
  maintained: "default" as const,
  lowered: "short" as const,
  cut: "short" as const,
  withdrawn: "warn" as const,
};

export function EarningsDesk() {
  const notes = useDeskStore((s) => s.earnings);
  const runAgent = useDeskStore((s) => s.runAgent);
  const [open, setOpen] = useState(notes[0]?.ticker ?? "AVGO");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<string | null>(null);
  const active = notes.find((n) => n.ticker === open) ?? notes[0];

  useVesperFocus((focus) => {
    if (focus.earningsTicker && notes.some((n) => n.ticker === focus.earningsTicker)) {
      setOpen(focus.earningsTicker);
      setLive(null);
    }
  }, [notes]);

  async function digest() {
    setBusy(true);
    const text = await runAgent(
      "earnings",
      `Fasse den letzten Earnings-Call zu ${active.ticker} zusammen. Bekannter Print: EPS ${active.epsActual || "ausstehend"} vs. Konsens ${active.epsCons}, Umsatz ${active.revActualB || "ausstehend"}B vs. ${active.revConsB}B, Guidance ${active.guidance}. Vergleiche CEO-/CFO-Ton mit der Vorperiode. Die drei substanziellsten Analysten-Q&As. Falls der Print noch nicht da ist: Pre-Call-Watch.`,
    );
    setBusy(false);
    if (text) {
      setLive(text);
      toast(`Callbook hat ${active.ticker} verdaut.`);
    } else toast("Callbook erreicht das Modell nicht.");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Kicker>Earnings-Saison</Kicker>
          <h1 className="text-3xl text-fg sm:text-4xl">Transkripte in vierundzwanzig Stunden.</h1>
          <p className="max-w-2xl text-sm text-muted">
            Callbook liest jedes Earnings-Transkript im Book, bewertet CEO- und CFO-Ton gegen ein
            Loughran-McDonald-Finanzwörterbuch und zieht EPS, Umsatz, Guidance und die drei substanziellsten
            Q&A-Austausche. In der Peak-Saison ersetzt das rund vierzig Stunden manueller Lektüre pro Woche.
          </p>
        </div>
        <Button onClick={() => void digest()} disabled={busy}>
          {busy ? "Lese Transkript…" : `${active.ticker} verdauen`}
        </Button>
      </header>

      <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1">
        {notes.map((n) => (
          <Button
            key={n.ticker}
            size="sm"
            className="shrink-0"
            data-vesper={`earn-${n.ticker}`}
            variant={open === n.ticker ? "default" : "ghost"}
            onClick={() => {
              setOpen(n.ticker);
              setLive(null);
            }}
          >
            {n.ticker}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <TickerMark symbol={active.ticker} className="text-sm" />
            <Badge tone={GUIDE_TONE[active.guidance]}>Ausblick {GUIDE_LABEL[active.guidance]}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">{active.date}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-md bg-elevated p-3">
              <p className="text-2xs text-muted uppercase">EPS</p>
              <p className="font-mono text-lg tabular-nums text-fg">
                {active.epsActual ? formatUsd(active.epsActual) : "—"}
              </p>
              <p className="text-xs text-muted">Konsens {formatUsd(active.epsCons)}</p>
            </div>
            <div className="rounded-md bg-elevated p-3">
              <p className="text-2xs text-muted uppercase">Umsatz</p>
              <p className="font-mono text-lg tabular-nums text-fg">
                {active.revActualB ? `$${active.revActualB.toFixed(1)}B` : "—"}
              </p>
              <p className="text-xs text-muted">Konsens ${active.revConsB.toFixed(1)}B</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <ToneBar value={active.ceoTone} label="CEO-Ton" />
            <ToneBar value={active.cfoTone} label="CFO-Ton" />
          </div>
          <p className="mt-5 text-sm leading-relaxed text-fg/85">{active.summary}</p>
        </Panel>

        <Panel className="lg:col-span-3">
          <Kicker>Drei substanziellste Austausche</Kicker>
          {active.qa.length === 0 ? (
            <p className="mt-6 text-sm text-muted">Print steht noch aus. Callbook nimmt das Transkript binnen 24 Stunden nach dem Call auf.</p>
          ) : (
            <ol className="mt-3 space-y-4">
              {active.qa.map((q, i) => (
                <li key={i} className="rounded-lg bg-elevated p-3">
                  <p className="text-2xs tracking-[0.12em] text-muted uppercase">
                    {String(i + 1).padStart(2, "0")} · {q.analyst}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg/90">{q.exchange}</p>
                </li>
              ))}
            </ol>
          )}
          {live && (
            <div className="mt-5 border-t border-border pt-4">
              <Kicker>Callbook · Live-Digest</Kicker>
              <div className="mt-2">
                <AgentNote text={live} />
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
