import { useState } from "react";
import { toast } from "sonner";
import { formatEt } from "@/lib/format";
import { useDeskStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentNote, Kicker, Panel } from "@/components/shared";

export function MacroDesk() {
  const events = useDeskStore((s) => s.macro);
  const runAgent = useDeskStore((s) => s.runAgent);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function scan() {
    setBusy(true);
    const text = await runAgent(
      "macro",
      `Es ist Sonntag, 23. August 2026. Jackson Hole öffnet Montag. NVDA printed Mittwoch. GDP-Zweitstand Freitag. NFP kommenden Freitag. September-FOMC am 16. Watchlist: NVDA AAPL MSFT AMZN META TSLA GOOGL AVGO JPM LLY UNH GS. FOMC, Fed-Redner, CPI/PPI/Jobs/GDP. Flagge alles, was das Book über zwei Prozent bewegen könnte.`,
    );
    setBusy(false);
    if (text) {
      setNote(text);
      toast("Makro-Monitor hat eine Notiz abgelegt.");
    } else toast("Makro-Monitor erreicht das Modell nicht.");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Kicker>Federal Reserve & Makro</Kicker>
          <h1 className="text-3xl text-fg sm:text-4xl">Die Fly, die du nicht besetzt.</h1>
          <p className="max-w-2xl text-sm text-muted">
            FOMC, Fed-Redner, CPI, PPI, Jobs, GDP. Implikationen für die Sektor-Exposure. Alles, was die Watchlist
            über zwei Prozent bewegen könnte, wird geflaggt. Das ist das Deployment, das an FOMC-Tagen und NFP-Morgens
            zählt, wenn ein Quant ohne institutionelle Makro-Coverage blind fliegt.
          </p>
        </div>
        <Button onClick={() => void scan()} disabled={busy}>
          {busy ? "Lese das Tape…" : "Kalender scannen"}
        </Button>
      </header>

      <div className="relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-[11px] before:w-px before:bg-border sm:before:left-[15px]">
        {events.map((e) => (
          <Panel key={e.id} className="relative ml-6 p-4 sm:ml-8 sm:p-5">
            <span
              className={`absolute top-5 -left-6 size-2.5 rounded-full sm:-left-8 ${e.flagged ? "bg-warn" : "bg-subtle"}`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{e.type}</Badge>
              {e.flagged && <Badge tone="watch">über 2 % Book</Badge>}
              <span className="font-mono text-2xs tabular-nums text-subtle">{formatEt(e.when)}</span>
            </div>
            <h2 className="mt-2 font-display text-xl text-fg">{e.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{e.implication}</p>
            <p className="mt-2 font-mono text-xs tabular-nums text-fg">
              Implizierte Watchlist-Bewegung {e.watchlistMovePct.toFixed(1)}%
            </p>
          </Panel>
        ))}
      </div>

      {note && (
        <Panel>
          <Kicker>Makro-Notiz</Kicker>
          <div className="mt-3">
            <AgentNote text={note} />
          </div>
        </Panel>
      )}
    </div>
  );
}
