import { Kicker, Panel, Pct, TickerMark } from "@/components/shared";
import { formatShares, formatUsd, signedClass } from "@/lib/format";
import { cashSplit } from "@/lib/ledger";
import { bookView, START_USD, usdFromEur } from "@/lib/paper";
import { instrumentNote } from "@/lib/names";
import { useDeskStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function useBook() {
  const watch = useDeskStore((s) => s.watch);
  const eurUsd = useDeskStore((s) => s.eurUsd);
  const fills = useDeskStore((s) => s.fills);
  const view = bookView({
    startEur: watch?.startEur,
    navEur: watch?.navEur,
    cashEur: watch?.cashEur ?? 0,
    eurUsd: watch?.eurUsd || eurUsd,
    spyPct: watch?.spyPct,
    relativePct: watch?.relativePct,
  });
  const cash = cashSplit({ cashUsd: view.cashUsd, fills });
  return { view, cash, watch };
}

export function BookBar() {
  const { view, cash } = useBook();
  const cells = view.ready
    ? [
        { k: "Eingezahlt", v: formatUsd(view.depositedUsd), sub: "Einsatz 300 $ · Konfig paper-v2", tone: "text-fg" },
        { k: "Stand", v: formatUsd(view.navUsd), sub: "Cash plus Kurse · letzter Schluss", tone: "text-fg" },
        {
          k: "Gewinn",
          v: `${view.pnlUsd >= 0 ? "+" : ""}${formatUsd(view.pnlUsd)}`,
          sub: `${view.pnlPct >= 0 ? "+" : ""}${view.pnlPct.toFixed(2)} % zum Einsatz, inkl. offen`,
          tone: view.pnlUsd > 0 ? "text-long" : view.pnlUsd < 0 ? "text-short" : "text-muted",
        },
        {
          k: "Cash frei",
          v: formatUsd(cash.availableUsd),
          sub: `Gesamt ${formatUsd(cash.totalUsd)} · reserviert ${formatUsd(cash.reservedUsd)}`,
          tone: cash.availableUsd > 1 ? "text-long" : "text-fg",
        },
      ]
    : [
        { k: "Eingezahlt", v: formatUsd(view.depositedUsd), sub: "Vorgesehen, noch kein Book", tone: "text-fg" },
        { k: "Stand", v: "—", sub: "Kein laufendes Depot", tone: "text-muted" },
        { k: "Gewinn", v: "—", sub: "Erst nach Eröffnung", tone: "text-muted" },
        { k: "Cash", v: "—", sub: "Nicht 300 $ als Live-Stand lesen", tone: "text-muted" },
      ];
  return (
    <div
      data-vesper="book.strip"
      className="flex shrink-0 gap-0 overflow-x-auto border-b border-border bg-surface"
    >
      {cells.map((c) => (
        <div key={c.k} className="min-w-[9.5rem] flex-1 px-3 py-2 sm:px-4">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">{c.k}</p>
          <p className={cn("mt-0.5 font-display text-lg tabular-nums leading-tight sm:text-xl", c.tone)}>{c.v}</p>
          <p className="truncate text-2xs text-subtle">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

export function BookPanel() {
  const { view, cash, watch } = useBook();
  return (
    <Panel className="enter-up">
      <div data-vesper="book.panel">
      <Kicker>Buch · 300 $ Testlauf · paper-v2</Kicker>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div data-vesper="book.deposited">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Eingezahlt</p>
          <p className="mt-1 font-display text-2xl text-fg">{formatUsd(view.depositedUsd)}</p>
          <p className="mt-1 text-xs text-muted">Digitaler Einsatz</p>
        </div>
        <div data-vesper="book.nav">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Stand</p>
          <p className="mt-1 font-display text-2xl text-fg">{view.ready ? formatUsd(view.navUsd) : "—"}</p>
          <p className="mt-1 text-xs text-muted">
            {watch?.phase === "live"
              ? "Live-Paper, mark-to-tape"
              : watch
                ? `Rekonstruktion Tag ${watch.day}/7`
                : "kein Book — nicht 300 $ als Stand lesen"}
          </p>
        </div>
        <div data-vesper="book.pnl">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Gewinn</p>
          <p className={cn("mt-1 font-display text-2xl", view.ready && view.pnlUsd >= 0 ? "text-long" : view.ready && view.pnlUsd < 0 ? "text-short" : "text-muted")}>
            {view.ready ? `${view.pnlUsd >= 0 ? "+" : ""}${formatUsd(view.pnlUsd)}` : "—"}
          </p>
          <Pct value={view.pnlPct} className="mt-1 text-xs" />
        </div>
        <div>
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Cash frei</p>
          <p className={cn("mt-1 font-display text-2xl", cash.availableUsd > 1 ? "text-long" : "text-fg")}>
            {formatUsd(cash.availableUsd)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Gesamt {formatUsd(cash.totalUsd)} · reserviert {formatUsd(cash.reservedUsd)}
          </p>
        </div>
      </div>
      </div>
    </Panel>
  );
}

export function BookHoldings() {
  const watch = useDeskStore((s) => s.watch);
  const strategy = useDeskStore((s) => s.strategy);
  const positions = (watch?.positions ?? []).filter((p) => p.shares > 0).slice().sort((a, b) => b.weightPct - a.weightPct);
  const eurUsd = watch?.eurUsd || useDeskStore.getState().eurUsd || 1.17;
  if (positions.length === 0) {
    return (
      <Panel>
        <Kicker>Positionen</Kicker>
        <p className="mt-2 text-sm text-muted">Keine Stücke. Tatsächliches Aktiengewicht 0 %. Nur Cash, bis eine Sitzung füllt.</p>
      </Panel>
    );
  }
  return (
    <Panel className="overflow-x-auto">
      <Kicker>Positionen · Einsatz, Stand, Gewinn · {formatUsd(START_USD)} Test</Kicker>
      <table className="mt-3 w-full min-w-[640px] text-left text-sm">
        <thead className="text-2xs tracking-[0.12em] text-muted uppercase">
          <tr className="border-y border-border">
            <th className="py-2 pr-3 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Teil</th>
            <th className="px-3 py-2 text-right font-medium">Stück</th>
            <th className="px-3 py-2 text-right font-medium">Last</th>
            <th className="px-3 py-2 text-right font-medium">Ist</th>
            <th className="px-3 py-2 text-right font-medium">Soll</th>
            <th className="py-2 pl-3 text-right font-medium">Gewinn</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const pnlUsd = p.shares * (p.lastUsd - p.costUsd);
            const pnlPct = p.costUsd ? ((p.lastUsd - p.costUsd) / p.costUsd) * 100 : 0;
            const sleeve =
              p.sleeve === "core" ? "Kern" : p.ticker === "BLK" ? "Einzelaktie" : p.sleeve === "toll" ? "Einzelaktie" : "Beimischung";
            const target = strategy.sleeves.find((s) => s.ticker === p.ticker)?.weightPct;
            return (
              <tr key={p.ticker} className="border-b border-border last:border-0">
                <td className="py-2 pr-3">
                  <TickerMark symbol={p.ticker} />
                  {instrumentNote(p.ticker) ? (
                    <p className="mt-0.5 max-w-[16rem] text-2xs text-muted">{instrumentNote(p.ticker)}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-muted">{sleeve}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{formatShares(p.shares)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{formatUsd(p.lastUsd)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{p.weightPct.toFixed(1)} %</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">{target != null ? `${target.toFixed(1)} %` : "—"}</td>
                <td className={cn("py-2 pl-3 text-right font-mono tabular-nums", signedClass(pnlUsd))}>
                  {pnlUsd >= 0 ? "+" : ""}
                  {formatUsd(pnlUsd)}{" "}
                  <span className="text-2xs">
                    ({pnlPct >= 0 ? "+" : ""}
                    {pnlPct.toFixed(1)}%)
                  </span>
                </td>
              </tr>
            );
          })}
          {(watch?.cashEur ?? 0) > 0.01 && (
            <tr className="border-b border-border last:border-0">
              <td className="py-2 pr-3 font-medium text-fg">Cash</td>
              <td className="px-3 py-2 text-muted">wartet</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">—</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">—</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {watch ? ((usdFromEur(watch.cashEur, eurUsd) / usdFromEur(watch.navEur, eurUsd)) * 100).toFixed(1) : "0"} %
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">0 %</td>
              <td className="py-2 pl-3 text-right font-mono tabular-nums text-muted">
                {formatUsd(usdFromEur(watch?.cashEur ?? 0, eurUsd))}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Panel>
  );
}
