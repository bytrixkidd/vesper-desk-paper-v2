import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { sliceRange, seriesStats, spanForRange, tapeForWatchlist, type ChartRange, rangeLabel } from "@/lib/charts";
import { explainPoint, pickBar } from "@/lib/explain";
import { formatPct, formatUsd, formatEur, signedClass } from "@/lib/format";
import { positionPnlEur } from "@/lib/paper";
import { ASSET_CLASS_LABEL } from "@/lib/seed-universe";
import { UNIVERSE } from "@/lib/seed";
import { useDeskStore } from "@/lib/store";
import { useVesperFocus } from "@/lib/vesper/use-focus";
import type { AssetClass, DemoPosition, UniverseAsset } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayName } from "@/lib/names";
import { DayBrief } from "@/components/desks/day-brief";
import { ColorLegend } from "@/components/desks/prism-guide";
import { HorizonButtons, Spark, TapeChart } from "@/components/desks/tape-chart";
import { BookHoldings, BookPanel } from "@/components/desks/book-strip";
import { PulseTape } from "@/components/desks/pulse-tape";
import { AgentNote, Kicker, Panel, Pct, TickerMark } from "@/components/shared";

const CLASSES: AssetClass[] = ["equity", "crypto", "metal", "world", "bond"];

export function UniverseDesk() {
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
  const watch = useDeskStore((s) => s.watch);
  const holdingBySymbol = useMemo(() => {
    const map: Record<string, DemoPosition> = {};
    if (watch) {
      for (const p of watch.positions) map[p.ticker] = p;
    }
    return map;
  }, [watch]);

  const equities: UniverseAsset[] = useMemo(
    () =>
      watchlist.map((t) => ({
        symbol: t.symbol,
        yahoo: t.symbol,
        name: t.name,
        class: "equity" as const,
        last: t.last,
        changePct: t.changePct,
        currency: "USD" as const,
      })),
    [watchlist],
  );
  const catalog = useMemo(() => [...equities, ...UNIVERSE], [equities]);

  const [klass, setKlass] = useState<AssetClass>("equity");
  const [symbol, setSymbol] = useState("SPY");
  const [range, setRange] = useState<ChartRange>("1M");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>("2026-07-29");

  useVesperFocus((focus) => {
    if (focus.symbol) {
      const hit = catalog.find((a) => a.symbol === focus.symbol);
      if (hit) {
        setKlass(hit.class);
        setSymbol(hit.symbol);
        setNote(null);
      }
    }
    if (focus.range) setRange(focus.range);
    if (focus.iso) setPicked(focus.iso);
  }, [catalog]);

  const asset = catalog.find((a) => a.symbol === symbol) ?? catalog[0]!;
  const span = spanForRange(range);
  const tapeKey = `${asset.symbol}:${span}`;
  const fetched = assetTapes[tapeKey];
  const fallback = useMemo(() => tapeForWatchlist(watchlist), [watchlist]);
  const bookTape = Object.keys(storeTape).length > 0 ? storeTape : fallback;

  const bars = useMemo(() => {
    if (fetched) return sliceRange(fetched.bars, range);
    if ((range === "1W" || range === "1M" || range === "3M") && bookTape[asset.symbol]) {
      return sliceRange(bookTape[asset.symbol] ?? [], range);
    }
    return [];
  }, [fetched, range, bookTape, asset.symbol]);

  const last = fetched?.quote.last ?? asset.last;
  const changePct = fetched?.quote.changePct ?? asset.changePct;
  const stats = seriesStats(bars);
  const loadingThis = assetLoading === tapeKey || (tapeLoading && asset.class === "equity" && span === "3mo");
  const spyBars = bookTape.SPY ?? [];
  const hit = pickBar(bars, picked);
  const spyHit = hit.bar ? pickBar(spyBars, hit.bar.t.slice(0, 10)) : { bar: undefined, prev: undefined };
  const reading =
    hit.bar &&
    explainPoint({
      symbol: asset.symbol,
      name: displayName(asset.symbol, asset.name),
      bar: hit.bar,
      prev: hit.prev,
      spyBar: spyHit.bar ?? undefined,
      spyPrev: spyHit.prev,
    });

  useEffect(() => {
    if (!tapeSource) void loadTape();
  }, [tapeSource, loadTape]);

  useEffect(() => {
    const needFetch = span !== "3mo" || asset.class !== "equity" || !bookTape[asset.symbol];
    if (needFetch && !fetched) void loadAsset(asset.symbol, span);
  }, [asset.symbol, asset.class, span, fetched, bookTape, loadAsset]);

  const visible = catalog.filter((a) => a.class === klass);

  async function readTape() {
    setBusy(true);
    const text = await runAgent(
      "universe",
      `Lies ${range}-Verlauf von ${asset.symbol} (${asset.name}, ${ASSET_CLASS_LABEL[asset.class]}). Last ${last.toFixed(2)} ${asset.currency}, Range ${formatPct(stats.changePct)}, Hoch ${stats.high.toFixed(2)}, Tief ${stats.low.toFixed(2)}. Quelle ${fetched?.source ?? tapeSource ?? "lokal"}. Relativ zu SPY und URTH. Cash-jetzt oder Kapital? 10J-Kontext wenn geladen.`,
    );
    setBusy(false);
    if (text) {
      setNote(text);
      toast(`Universum hat ${displayName(asset.symbol, asset.name)} gelesen.`);
    } else toast("Modell nicht erreichbar.");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Kicker>Universum · Prism</Kicker>
          <h1 className="text-3xl text-fg sm:text-4xl">Aktien, Krypto, Gold. Klick auf den Tag.</h1>
          <p className="max-w-2xl text-sm text-muted">
            Oben steht, was eingezahlt ist und was das Book macht. Darunter der Verlauf — von einer Woche bis zur Gesamtlaufzeit.
            Ein Punkt ist ein Tag. Prism erklärt ihn.
          </p>
          <p className="font-mono text-2xs text-subtle">{loadingThis ? "Lade Verlauf…" : sessionLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              void loadAsset(asset.symbol, span).then(() => toast("Verlauf aktualisiert."));
            }}
            disabled={Boolean(loadingThis)}
          >
            {loadingThis ? "Lade…" : "Gesamt holen"}
          </Button>
          <Button onClick={() => void readTape()} disabled={busy}>
            {busy ? "Lese…" : `${displayName(asset.symbol, asset.name)} lesen`}
          </Button>
        </div>
      </header>

      <BookPanel />
      <BookHoldings />
      <PulseTape compact />

      <div className="flex flex-wrap gap-1.5">
        {CLASSES.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={klass === c ? "default" : "ghost"}
            onClick={() => {
              setKlass(c);
              const first = catalog.find((a) => a.class === c);
              if (first) {
                setSymbol(first.symbol);
                setNote(null);
              }
            }}
          >
            {ASSET_CLASS_LABEL[c]}
          </Button>
        ))}
      </div>

      <ColorLegend />

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{displayName(asset.symbol, asset.name)}</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <p className="font-display text-3xl text-fg">{formatUsd(last)}</p>
              <Pct value={changePct} className="text-sm" />
              <Badge tone="sage">{ASSET_CLASS_LABEL[asset.class]}</Badge>
              {(fetched?.source === "yahoo" || (asset.class === "equity" && tapeSource === "yahoo")) && (
                <Badge>Wall Street</Badge>
              )}
            </div>
            <p className="mt-1 font-mono text-2xs text-subtle">
              {rangeLabel(range)} · Hoch {formatUsd(stats.high)} · Tief {formatUsd(stats.low)} · im Zeitraum{" "}
              {stats.changePct >= 0 ? "+" : ""}
              {stats.changePct.toFixed(1).replace(".", ",")} %
              {fetched?.interval === "1wk" ? " · wöchentlich" : ""}
            </p>
          </div>
          <HorizonButtons value={range} onChange={setRange} />
        </div>
        <div className="mt-4" data-vesper="chart.main">
          {bars.length >= 2 ? (
            <TapeChart
              bars={bars}
              id={`${asset.symbol}-${range}`}
              height={340}
              selectedIso={picked}
              onSelect={(bar) => setPicked(bar.t.slice(0, 10))}
              horizon={range}
            />
          ) : (
            <p className="py-16 text-center text-sm text-muted">Verlauf wird geladen…</p>
          )}
        </div>
        <DayBrief
          key={`${asset.symbol}-${reading ? reading.date : "x"}`}
          reading={reading || null}
          onAsk={(r) =>
            runAgent(
              "universe",
              `Prism, Anfaenger. ${r.symbol} (${asset.name}) am ${r.date}, ${r.changePct.toFixed(2)} %. Stichpunkte, warum der Tag so lief. Kein Jargon.`,
            )
          }
        />
        {note && (
          <div className="mt-4 border-t border-border pt-4">
            <Kicker>Universum-Notiz</Kicker>
            <div className="mt-2">
              <AgentNote text={note} />
            </div>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {visible.map((a) => {
          const q = assetTapes[`${a.symbol}:3mo`]?.quote;
          const lastPx = q?.last ?? a.last;
          const ch = q?.changePct ?? a.changePct;
          const sparkBars =
            (range === "1W" || range === "1M" || range === "3M") && bookTape[a.symbol]
              ? sliceRange(bookTape[a.symbol] ?? [], "1M")
              : sliceRange(assetTapes[`${a.symbol}:3mo`]?.bars ?? [], "1M");
          const pos = holdingBySymbol[a.symbol];
          const pnlEur = pos ? positionPnlEur(pos.shares, pos.lastUsd, pos.costUsd, watch?.eurUsd || 1) : null;
          const pnlPct = pos && pos.costUsd ? ((pos.lastUsd - pos.costUsd) / pos.costUsd) * 100 : null;
          return (
            <button
              key={a.symbol}
              type="button"
              onClick={() => {
                setSymbol(a.symbol);
                setNote(null);
              }}
              className={`rounded-xl bg-surface p-3 text-left shadow-[var(--shadow-border)] ${symbol === a.symbol ? "shadow-[var(--shadow-border-hover)]" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <TickerMark symbol={a.symbol} />
                <Pct value={ch} className="text-2xs" />
              </div>
              <p className="mt-0.5 truncate text-2xs text-subtle">{ASSET_CLASS_LABEL[a.class]}</p>
              <p className="mt-1 font-mono text-xs tabular-nums text-fg">{formatUsd(lastPx)}</p>
              {pnlEur != null && pnlPct != null && pos && pos.shares > 0 && (
                <p className={`mt-0.5 font-mono text-2xs tabular-nums ${signedClass(pnlEur)}`}>
                  {pnlEur >= 0 ? "+" : ""}
                  {formatEur(pnlEur, 0)} · {pnlPct >= 0 ? "+" : ""}
                  {pnlPct.toFixed(1)}%
                </p>
              )}
              {sparkBars.length > 2 && <Spark bars={sparkBars} id={a.symbol} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
