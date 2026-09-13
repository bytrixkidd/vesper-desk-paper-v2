import { useEffect, useMemo, useState } from "react";
import { rangeLabel, seriesStats, sliceRange, spanForRange, tapeForWatchlist, type ChartRange } from "@/lib/charts";
import { explainPoint, pickBar } from "@/lib/explain";
import { formatUsd } from "@/lib/format";
import { displayName } from "@/lib/names";
import { useDeskStore } from "@/lib/store";
import { spokenName, stageOneFromCard } from "@/lib/vesper/plain";
import { useVesperStore } from "@/lib/vesper/store";
import { useVesperFocus } from "@/lib/vesper/use-focus";
import { Button } from "@/components/ui/button";
import { Pct } from "@/components/shared";
import { DayBrief } from "@/components/desks/day-brief";
import { HorizonButtons, TapeChart } from "@/components/desks/tape-chart";
import { DiagPanel } from "@/components/vesper/diag-panel";

export function ChartDesk() {
  const watchlist = useDeskStore((s) => s.watchlist);
  const storeTape = useDeskStore((s) => s.tape);
  const tapeSource = useDeskStore((s) => s.tapeSource);
  const sessionLabel = useDeskStore((s) => s.sessionLabel);
  const tapeLoading = useDeskStore((s) => s.tapeLoading);
  const loadTape = useDeskStore((s) => s.loadTape);
  const loadAsset = useDeskStore((s) => s.loadAsset);
  const assetTapes = useDeskStore((s) => s.assetTapes);
  const assetLoading = useDeskStore((s) => s.assetLoading);
  const runAgent = useDeskStore((s) => s.runAgent);
  const intel = useVesperStore((s) => s.intel);
  const compare = useVesperStore((s) => s.focus.compare);
  const detailOpen = useVesperStore((s) => s.focus.detailOpen);
  const caption = useVesperStore((s) => s.focus.caption);
  const fallback = useMemo(() => tapeForWatchlist(watchlist), [watchlist]);
  const tape = Object.keys(storeTape).length > 0 ? storeTape : fallback;
  const [symbol, setSymbol] = useState("SPY");
  const [range, setRange] = useState<ChartRange>("3M");
  const [picked, setPicked] = useState<string | null>(null);

  useVesperFocus((focus) => {
    if (focus.symbol && watchlist.some((t) => t.symbol === focus.symbol)) {
      setSymbol(focus.symbol);
    }
    if (focus.range) setRange(focus.range);
    if (focus.iso) setPicked(focus.iso);
  }, [watchlist]);

  useEffect(() => {
    if (!tapeSource) void loadTape();
  }, [tapeSource, loadTape]);

  const ticker = watchlist.find((t) => t.symbol === symbol) ?? watchlist[0]!;
  const span = spanForRange(range);
  const tapeKey = `${ticker.symbol}:${span}`;
  const fetched = assetTapes[tapeKey];

  useEffect(() => {
    const short = range === "1W" || range === "1M" || range === "3M";
    if (!short && !fetched) void loadAsset(ticker.symbol, span);
  }, [ticker.symbol, range, span, fetched, loadAsset]);

  const bars = useMemo(() => {
    if (fetched) return sliceRange(fetched.bars, range);
    if ((range === "1W" || range === "1M" || range === "3M") && tape[ticker.symbol]) {
      return sliceRange(tape[ticker.symbol] ?? [], range);
    }
    return [];
  }, [fetched, range, tape, ticker.symbol]);

  const card = intel[ticker.symbol];
  const stats = seriesStats(bars);
  const last = ticker.last || stats.last;
  const spyBars = tape.SPY ?? [];
  const hit = pickBar(bars, picked);
  const spyHit = hit.bar ? pickBar(spyBars, barDateSafe(hit.bar.t)) : { bar: undefined, prev: undefined };
  const reading =
    hit.bar &&
    explainPoint({
      symbol: ticker.symbol,
      name: ticker.name,
      bar: hit.bar,
      prev: hit.prev,
      spyBar: spyHit.bar ?? undefined,
      spyPrev: spyHit.prev,
    });
  const compareTicker = compare ? watchlist.find((t) => t.symbol === compare) : null;
  const loadingThis = Boolean(assetLoading === tapeKey || (tapeLoading && span === "3mo" && bars.length < 2));

  return (
    <div className="flex min-h-full flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4" data-vesper="chart.price">
        <div className="min-w-0">
          <h1 className="text-3xl text-fg sm:text-4xl">{spokenName(ticker.symbol, ticker.name)}</h1>
          <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="text-2xs text-muted">Kurs</p>
              <p className="mt-0.5 font-mono text-2xl tabular-nums text-fg">{formatUsd(last)}</p>
            </div>
            <div>
              <p className="text-2xs text-muted">Heute</p>
              <Pct value={ticker.changePct} className="mt-0.5 block text-lg" />
            </div>
            <div>
              <p className="text-2xs text-muted">{rangeLabel(range)}</p>
              <Pct value={stats.changePct} className="mt-0.5 block text-lg" />
            </div>
          </div>
          <p className="mt-1 text-2xs text-subtle">
            {loadingThis ? "Lade Verlauf…" : sessionLabel}
            {stats.high ? ` · Hoch ${formatUsd(stats.high)} · Tief ${formatUsd(stats.low)}` : ""}
          </p>
          {card ? <p className="mt-2 max-w-2xl text-sm text-muted">{stageOneFromCard(card)}</p> : null}
        </div>
        <HorizonButtons
          value={range}
          onChange={(next) => {
            setRange(next);
            if (next === "1W") setPicked(null);
          }}
        />
      </header>

      <div className="flex flex-wrap gap-1">
        {watchlist.map((t) => (
          <Button
            key={t.symbol}
            size="sm"
            className="min-h-11 shrink-0"
            variant={symbol === t.symbol ? "default" : "ghost"}
            data-vesper={`chart-${t.symbol}`}
            onClick={() => {
              setSymbol(t.symbol);
              setPicked(null);
            }}
          >
            {displayName(t.symbol, t.name)}
          </Button>
        ))}
      </div>

      {compareTicker ? (
        <p className="rounded-md bg-surface px-4 py-3 text-sm text-muted shadow-[var(--shadow-border)]">
          Vergleich mit {spokenName(compareTicker.symbol, compareTicker.name)}: heute {compareTicker.changePct >= 0 ? "plus" : "minus"}{" "}
          {Math.abs(compareTicker.changePct).toFixed(1).replace(".", ",")} Prozent.
        </p>
      ) : null}

      <section className="relative min-w-0 rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]" data-vesper="chart.main">
        <span data-vesper="chart.latestDrop" className="pointer-events-none absolute inset-0 rounded-lg" />
        <span data-vesper="chart.latestRise" className="pointer-events-none absolute inset-0 rounded-lg" />
        <span data-vesper="chart.relevantEvent" className="pointer-events-none absolute inset-0 rounded-lg" />
        <span data-vesper="chart.selectedDate" className="pointer-events-none absolute inset-0 rounded-lg" />
        <TapeChart
          bars={bars}
          id={`${ticker.symbol}-${range}`}
          height={420}
          selectedIso={picked}
          onSelect={(bar) => setPicked(bar.t.slice(0, 10))}
          horizon={range}
        />
        {caption ? (
          <p className="mt-2 text-xs text-fg" data-vesper="chart.relevantEvent">
            {caption}
          </p>
        ) : null}
        <div data-vesper="chart.volume" className="sr-only">
          Handelsvolumen im gewählten Zeitraum.
        </div>
        <DayBrief
          key={`${ticker.symbol}-${reading ? reading.date : "x"}`}
          reading={reading || null}
          onAsk={(r) =>
            runAgent(
              "charts",
              `Prism, Anfaenger. ${r.symbol} am ${r.date}, ${r.changePct.toFixed(2)} %. Erklaere in Stichpunkten die wahrscheinlichen Gruende. Kein Jargon. Wall-Street-Tape, MET.`,
            )
          }
        />
      </section>

      {detailOpen ? (
        <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]" data-vesper="diag.panel">
          <p className="text-2xs tracking-[0.14em] text-muted uppercase">Prüfung</p>
          <div data-vesper="diag.currentDay">
            <div data-vesper="diag.missing">
              <DiagPanel />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function barDateSafe(t: string) {
  return t.slice(0, 10);
}
