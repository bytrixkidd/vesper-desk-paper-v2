import { Kicker, Panel, Pct, TickerMark } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { formatUsd } from "@/lib/format";
import { usdFromEur } from "@/lib/paper";
import { overlayNavEur } from "@/lib/engine";
import { useDeskStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const ACTION_LABEL = {
  add: "mehr halten",
  hold: "halten",
  trim: "weniger halten",
  flat: "nicht halten",
} as const;

export function EnginePanel() {
  const lastTilt = useDeskStore((s) => s.lastTilt);
  const strategy = useDeskStore((s) => s.strategy);
  const watch = useDeskStore((s) => s.watch);
  const eurUsd = useDeskStore((s) => s.eurUsd);
  const fx = watch?.eurUsd || eurUsd || 1.17;
  const overlayNow = watch ? overlayNavEur(watch.positions, fx) : 0;
  const overlayNowUsd = overlayNow * fx;
  const overlayStart = watch?.overlayStartEur ?? overlayNow;
  const overlayMove = overlayNow - overlayStart;
  const overlayMoveUsd = overlayMove * fx;
  const scores = (lastTilt?.scores ?? [])
    .filter((s) => s.sleeve === "overlay")
    .slice()
    .sort((a, b) => b.score - a.score);
  const sleeves = strategy.sleeves.filter((s) => s.weightPct > 0).slice().sort((a, b) => b.weightPct - a.weightPct);

  return (
    <Panel className="enter-up">
      <div data-vesper="engine.tilt">
      <Kicker>Kapital-Maschine · kaufen, mitnehmen, nachkaufen</Kicker>
      <h2 className="mt-1 font-display text-2xl text-fg">Gewichte folgen dem Tape</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        {lastTilt?.note ??
          "Sobald das Tape da ist, stockt die Beimischung auf, was den Markt schlägt, und schneidet, was hinterherhinkt. Tesla bleibt gesperrt. Gewinn bleibt im Book. Kein Echtgeld."}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-elevated p-3">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Beimischung</p>
          <p className="mt-1 font-display text-xl text-fg">{formatUsd(overlayNowUsd)}</p>
          <p className={cn("mt-1 text-xs", overlayMove >= 0 ? "text-long" : "text-short")}>
            {overlayMoveUsd >= 0 ? "+" : ""}
            {formatUsd(overlayMoveUsd)} diese Watch
          </p>
        </div>
        <div className="rounded-lg bg-elevated p-3">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Beimischung Ist / Soll</p>
          <p className="mt-1 font-display text-xl text-fg">
            {watch
              ? `${watch.navEur > 0 ? ((overlayNow / watch.navEur) * 100).toFixed(0) : "0"} %`
              : "0 %"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Soll {lastTilt ? `${lastTilt.overlayPct.toFixed(0)} %` : "30 %"}. Ist = Bestand nach Kursen, bei leerem Depot 0. Soll = Ziel.
            SPY und VOO sind derselbe S&P 500. BlackRock ist eine Aktie.
          </p>
        </div>
        <div className="rounded-lg bg-elevated p-3 col-span-2 sm:col-span-1">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Cash</p>
          <p className="mt-1 font-display text-xl text-fg">
            {watch ? formatUsd(usdFromEur(watch.cashEur, watch.eurUsd || eurUsd)) : formatUsd(0)}
          </p>
          <p className="mt-1 text-xs text-muted">Cash darf liegen. Nachkauf nur mit S1 oder S2, nicht weil Geld da ist.</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-2xs tracking-[0.12em] text-muted uppercase">
            <tr className="border-y border-border">
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="px-3 py-2 text-right font-medium">vs Markt</th>
              <th className="px-3 py-2 text-right font-medium">Ist</th>
              <th className="px-3 py-2 text-right font-medium">Soll</th>
              <th className="py-2 pl-3 text-right font-medium">Lage</th>
            </tr>
          </thead>
          <tbody>
            {(scores.length ? scores : sleeves.map((s) => ({ ticker: s.ticker, relPct: 0, action: "hold" as const }))).map((row) => {
              const target = strategy.sleeves.find((s) => s.ticker === row.ticker)?.weightPct ?? 0;
              const actual = watch?.positions.find((p) => p.ticker === row.ticker)?.weightPct;
              return (
                <tr key={row.ticker} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 font-medium text-fg">
                    <TickerMark symbol={row.ticker} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {"relPct" in row ? <Pct value={row.relPct} className="text-xs" /> : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{actual != null ? `${actual.toFixed(1)} %` : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">{target.toFixed(1)} %</td>
                  <td className="py-2 pl-3 text-right">
                    <Badge tone={row.action === "add" ? "long" : row.action === "flat" || row.action === "trim" ? "warn" : "default"}>
                      {ACTION_LABEL[row.action]}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>
    </Panel>
  );
}
