import { toast } from "sonner";
import { useEffect, useState } from "react";
import { formatPct } from "@/lib/format";
import { displayName } from "@/lib/names";
import type { TapeReading } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentNote } from "@/components/shared";
import { cn } from "@/lib/utils";

export function DayBrief({
  reading,
  onAsk,
}: {
  reading: TapeReading | null;
  onAsk?: (reading: TapeReading) => Promise<string | null>;
}) {
  const [extra, setExtra] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setExtra(null);
    setBusy(false);
  }, [reading?.date, reading?.symbol]);

  if (!reading) {
    return (
      <p className="mt-4 border-t border-border pt-4 text-sm text-muted">
        Klick auf einen Punkt im Chart. Prism erklärt den Tag in Stichpunkten.
      </p>
    );
  }

  const bar =
    reading.tone === "down" ? "bg-short" : reading.tone === "up" ? "bg-long" : "bg-subtle";

  return (
    <div className="mt-4 flex gap-3 border-t border-border pt-4">
      <span className={cn("mt-1 w-0.5 shrink-0 self-stretch rounded-full", bar)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-2xs tracking-[0.08em] text-muted">Prism · {reading.date} · {displayName(reading.symbol)}</p>
            <h3 className="mt-1 font-display text-xl text-fg">{reading.headline}</h3>
          </div>
          <Badge tone={reading.tone === "down" ? "warn" : reading.tone === "up" ? "long" : "sage"}>
            {formatPct(reading.changePct)}
          </Badge>
        </div>
        <ul className="mt-3 space-y-2">
          {reading.bullets.map((b) => (
            <li key={b} className="flex gap-2 text-sm leading-relaxed text-fg/90">
              <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", bar)} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        {onAsk && (
          <Button
            className="mt-3 min-h-11"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void onAsk(reading)
                .then((text) => {
                  if (text) {
                    setExtra(text);
                    toast("Prism hat nachgelegt.");
                  } else toast("Modell nicht erreichbar — die Stichpunkte oben gelten.");
                })
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Suche Gründe…" : "Mehr Gründe"}
          </Button>
        )}
        {extra && (
          <div className="mt-3">
            <AgentNote text={extra} />
          </div>
        )}
      </div>
    </div>
  );
}
