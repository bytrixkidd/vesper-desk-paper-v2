import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateBars, seedAssetBars } from "@/lib/charts";
import { nyseStatus } from "@/lib/format";
import { WATCHLIST } from "@/lib/seed";
import { findUniverse } from "@/lib/seed-universe";
import type { AssetTape, Bar, ChartSpan, Quote, TapePayload, UniverseAsset } from "@/lib/types";

const SYMBOLS = WATCHLIST.map((t) => t.symbol);
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const CACHE_MS = 90_000;
const FALLBACK_EURUSD = 1.1678;

let cache: { at: number; payload: TapePayload } | null = null;
let inflight: Promise<TapePayload> | null = null;

const assetCache = new Map<string, { at: number; tape: AssetTape }>();
const assetInflight = new Map<string, Promise<AssetTape>>();

type YahooQuote = {
  open?: (number | null)[];
  high?: (number | null)[];
  low?: (number | null)[];
  close?: (number | null)[];
  volume?: (number | null)[];
};

type YahooResult = {
  meta?: {
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    currency?: string;
    regularMarketTime?: number;
  };
  timestamp?: number[];
  indicators?: { quote?: YahooQuote[] };
};

function barsFromYahoo(result: YahooResult): Bar[] {
  const ts = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0];
  if (!q) return [];
  const out: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    const v = q.volume?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    out.push({
      t: new Date((ts[i] ?? 0) * 1000).toISOString(),
      o: Number(o.toFixed(4)),
      h: Number(h.toFixed(4)),
      l: Number(l.toFixed(4)),
      c: Number(c.toFixed(4)),
      v: Math.round(v ?? 0),
    });
  }
  return out;
}

async function fetchChart(
  symbol: string,
  range = "3mo",
  interval = "1d",
): Promise<{ bars: Bar[]; last: number; prev: number; currency: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { chart?: { result?: YahooResult[] } };
    const result = body.chart?.result?.[0];
    if (!result) return null;
    const bars = barsFromYahoo(result);
    if (bars.length === 0) return null;
    const last = Number(result.meta?.regularMarketPrice ?? bars[bars.length - 1]!.c);
    const prev = bars.length > 1 ? bars[bars.length - 2]!.c : (result.meta?.chartPreviousClose ?? last);
    return { bars, last, prev, currency: result.meta?.currency ?? "USD" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function seedPayload(): TapePayload {
  const bars: Record<string, Bar[]> = {};
  const quotes: Record<string, Quote> = {};
  for (const t of WATCHLIST) {
    bars[t.symbol] = generateBars(t.symbol, t.last);
    const prev = t.last / (1 + t.changePct / 100);
    quotes[t.symbol] = { last: t.last, prev, changePct: t.changePct, currency: "USD" };
  }
  const nyse = nyseStatus();
  return {
    asOf: new Date().toISOString(),
    source: "seed",
    market: nyse.open ? "open" : "closed",
    sessionLabel: `Kein Live-Tape — lokaler Close · ${nyse.label}`,
    eurUsd: FALLBACK_EURUSD,
    quotes,
    bars,
  };
}

async function loadLive(): Promise<TapePayload> {
  const jobs = [...SYMBOLS, "EURUSD=X"].map(async (symbol) => {
    const hit = await fetchChart(symbol);
    return [symbol, hit] as const;
  });
  const rows = await Promise.all(jobs);
  const map = new Map(rows);
  const liveCount = SYMBOLS.filter((s) => map.get(s)).length;
  if (liveCount < 8) return seedPayload();

  const bars: Record<string, Bar[]> = {};
  const quotes: Record<string, Quote> = {};
  for (const t of WATCHLIST) {
    const hit = map.get(t.symbol);
    if (hit) {
      bars[t.symbol] = hit.bars;
      const changePct = hit.prev ? ((hit.last - hit.prev) / hit.prev) * 100 : 0;
      quotes[t.symbol] = {
        last: Number(hit.last.toFixed(4)),
        prev: Number(hit.prev.toFixed(4)),
        changePct: Number(changePct.toFixed(3)),
        currency: hit.currency || "USD",
      };
    } else {
      bars[t.symbol] = generateBars(t.symbol, t.last);
      quotes[t.symbol] = {
        last: t.last,
        prev: t.last / (1 + t.changePct / 100),
        changePct: t.changePct,
        currency: "USD",
      };
    }
  }
  const fx = map.get("EURUSD=X");
  const eurUsd = fx?.last && fx.last > 0.5 && fx.last < 2 ? fx.last : FALLBACK_EURUSD;
  const spyBars = bars.SPY ?? [];
  const lastBar = spyBars[spyBars.length - 1];
  const asOf = lastBar?.t ?? new Date().toISOString();
  const nyse = nyseStatus();
  const closeMet = lastBar
    ? new Date(lastBar.t).toLocaleString("de-DE", {
        timeZone: "Europe/Berlin",
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "";
  return {
    asOf,
    source: "yahoo",
    market: nyse.open ? "open" : "closed",
    sessionLabel: `Wall Street · Close ${closeMet} · ${nyse.label} · Yahoo`,
    eurUsd: Number(eurUsd.toFixed(4)),
    quotes,
    bars,
  };
}

export const fetchTape = createServerFn({ method: "GET" }).handler(async (): Promise<TapePayload> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.payload;
  if (!inflight) {
    inflight = loadLive()
      .then((payload) => {
        cache = { at: Date.now(), payload };
        return payload;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
});

function resolveAsset(symbol: string): UniverseAsset {
  const uni = findUniverse(symbol);
  if (uni) return uni;
  const eq = WATCHLIST.find((t) => t.symbol === symbol);
  if (eq) {
    return {
      symbol: eq.symbol,
      yahoo: eq.symbol,
      name: eq.name,
      class: "equity",
      last: eq.last,
      changePct: eq.changePct,
      currency: "USD",
    };
  }
  return {
    symbol,
    yahoo: symbol,
    name: symbol,
    class: "equity",
    last: 100,
    changePct: 0,
    currency: "USD",
  };
}

function seedAsset(asset: UniverseAsset, span: ChartSpan): AssetTape {
  const bars = seedAssetBars({ yahoo: asset.yahoo, last: asset.last }, span);
  const last = bars.at(-1)?.c ?? asset.last;
  const prev = bars.length > 1 ? bars[bars.length - 2]!.c : last / (1 + asset.changePct / 100);
  return {
    symbol: asset.symbol,
    yahoo: asset.yahoo,
    asOf: bars.at(-1)?.t ?? new Date().toISOString(),
    source: "seed",
    interval: span === "5y" || span === "10y" || span === "max" ? "1wk" : "1d",
    span,
    quote: {
      last,
      prev,
      changePct: prev ? ((last - prev) / prev) * 100 : asset.changePct,
      currency: asset.currency,
    },
    bars,
  };
}

const SPAN_QUERY: Record<ChartSpan, { range: string; interval: string }> = {
  "3mo": { range: "3mo", interval: "1d" },
  "1y": { range: "1y", interval: "1d" },
  "5y": { range: "5y", interval: "1wk" },
  "10y": { range: "10y", interval: "1wk" },
  max: { range: "max", interval: "1wk" },
};

async function loadAsset(symbol: string, span: ChartSpan): Promise<AssetTape> {
  const asset = resolveAsset(symbol);
  const q = SPAN_QUERY[span];
  const hit = await fetchChart(asset.yahoo, q.range, q.interval);
  if (!hit) return seedAsset(asset, span);
  const last = hit.last;
  const prev = hit.prev;
  return {
    symbol: asset.symbol,
    yahoo: asset.yahoo,
    asOf: hit.bars.at(-1)?.t ?? new Date().toISOString(),
    source: "yahoo",
    interval: q.interval === "1wk" ? "1wk" : "1d",
    span,
    quote: {
      last: Number(last.toFixed(4)),
      prev: Number(prev.toFixed(4)),
      changePct: Number((prev ? ((last - prev) / prev) * 100 : 0).toFixed(3)),
      currency: hit.currency || asset.currency,
    },
    bars: hit.bars,
  };
}

export const fetchAssetTape = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        symbol: z.string().min(1).max(24),
        span: z.enum(["3mo", "1y", "5y", "10y", "max"]),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<AssetTape> => {
    const key = `${data.symbol}:${data.span}`;
    const hit = assetCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.tape;
    const pending = assetInflight.get(key);
    if (pending) return pending;
    const job = loadAsset(data.symbol, data.span)
      .then((tape) => {
        assetCache.set(key, { at: Date.now(), tape });
        return tape;
      })
      .finally(() => {
        assetInflight.delete(key);
      });
    assetInflight.set(key, job);
    return job;
  });

