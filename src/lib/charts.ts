import type { Bar, ChartSpan, Ticker } from "./types";

const END = new Date("2026-08-21T20:00:00.000Z");

const VOL: Record<string, number> = {
  NVDA: 0.018,
  AAPL: 0.011,
  MSFT: 0.01,
  AMZN: 0.014,
  META: 0.016,
  TSLA: 0.026,
  GOOGL: 0.012,
  AVGO: 0.017,
  JPM: 0.01,
  LLY: 0.015,
  UNH: 0.014,
  GS: 0.012,
  BLK: 0.013,
  SPY: 0.007,
  VOO: 0.007,
  "BTC-USD": 0.032,
  "ETH-USD": 0.028,
  "SOL-USD": 0.04,
  GLD: 0.009,
  SLV: 0.016,
  URTH: 0.007,
  QQQ: 0.01,
  IWM: 0.012,
  EEM: 0.011,
  VGK: 0.009,
  TLT: 0.008,
};

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(symbol: string) {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) h = Math.imul(h ^ symbol.charCodeAt(i), 16777619);
  return h >>> 0;
}

function sessionDays(end: Date, count: number) {
  const days: Date[] = [];
  const d = new Date(end);
  while (days.length < count) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) days.push(new Date(d));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return days.reverse();
}

function weekEnds(end: Date, count: number) {
  const days: Date[] = [];
  const d = new Date(end);
  while (days.length < count) {
    days.push(new Date(d));
    d.setUTCDate(d.getUTCDate() - 7);
  }
  return days.reverse();
}

function dateShock(symbol: string, ymd: string) {
  const core = symbol === "SPY" || symbol === "VOO" || symbol === "URTH" || symbol === "QQQ";
  if (ymd === "2026-07-29") {
    if (symbol === "NVDA" || symbol === "AVGO") return -0.028;
    if (core) return -0.016;
    if (symbol === "TSLA") return -0.012;
    return -0.01;
  }
  if (ymd === "2026-08-08" && symbol === "AVGO") return 0.018;
  if (ymd === "2026-08-21" && symbol === "GS") return 0.012;
  if (ymd === "2026-08-21" && symbol === "TSLA") return 0.02;
  return 0;
}

function paint(symbol: string, last: number, days: Date[], vol: number, salt: number): Bar[] {
  const rand = mulberry32(seedFor(symbol) ^ salt);
  const count = days.length;
  const moves: number[] = [];
  let acc = 0;
  for (let i = 0; i < count; i++) {
    const ymd = days[i]?.toISOString().slice(0, 10) ?? "";
    const shock =
      (rand() - 0.48) * vol +
      dateShock(symbol, ymd) +
      (symbol.includes("TSLA") && i > count - 8 ? 0.004 : 0) +
      (symbol.includes("UNH") && i > count - 12 ? -0.003 : 0) +
      (symbol.includes("AVGO") && i > count - 6 ? 0.003 : 0);
    moves.push(shock);
    acc += shock;
  }
  const start = last / Math.exp(acc);
  let px = start;
  return days.map((day, i) => {
    const ret = moves[i] ?? 0;
    const o = px;
    const c = px * Math.exp(ret);
    const span = Math.abs(ret) * (0.6 + rand() * 0.9) * px + px * vol * 0.15;
    const h = Math.max(o, c) + span * (0.2 + rand() * 0.5);
    const l = Math.min(o, c) - span * (0.2 + rand() * 0.5);
    const v = Math.round(
      8_000_000 * (0.4 + rand()) * (symbol === "SPY" || symbol === "BTC-USD" ? 12 : symbol === "VOO" ? 4 : 1),
    );
    px = c;
    return {
      t: day.toISOString(),
      o: Number(o.toFixed(symbol.includes("BTC") ? 1 : 2)),
      h: Number(h.toFixed(symbol.includes("BTC") ? 1 : 2)),
      l: Number(Math.max(0.01, l).toFixed(symbol.includes("BTC") ? 1 : 2)),
      c: Number(c.toFixed(symbol.includes("BTC") ? 1 : 2)),
      v,
    };
  });
}

export function generateBars(symbol: string, last: number, count = 66): Bar[] {
  const vol = VOL[symbol] ?? 0.012;
  return paint(symbol, last, sessionDays(END, count), vol, 0);
}

export function generateWeeklyBars(symbol: string, last: number, years = 10): Bar[] {
  const vol = (VOL[symbol] ?? 0.012) * Math.sqrt(5);
  return paint(symbol, last, weekEnds(END, years * 52), vol, 0x10);
}

export function tapeForWatchlist(watchlist: Ticker[], count = 66): Record<string, Bar[]> {
  const out: Record<string, Bar[]> = {};
  for (const t of watchlist) out[t.symbol] = generateBars(t.symbol, t.last, count);
  return out;
}

export type ChartRange = "1W" | "1M" | "3M" | "1J" | "5J" | "10J" | "ALL";

export const RANGE_OPTIONS: { id: ChartRange; label: string; target: string }[] = [
  { id: "1W", label: "1 Woche", target: "chart.range.oneWeek" },
  { id: "1M", label: "1 Monat", target: "chart.range.oneMonth" },
  { id: "3M", label: "3 Monate", target: "chart.range.threeMonths" },
  { id: "1J", label: "1 Jahr", target: "chart.range.oneYear" },
  { id: "5J", label: "5 Jahre", target: "chart.range.fiveYears" },
  { id: "10J", label: "10 Jahre", target: "chart.range.tenYears" },
  { id: "ALL", label: "Gesamt", target: "chart.range.full" },
];

export function rangeLabel(range: ChartRange) {
  return RANGE_OPTIONS.find((r) => r.id === range)?.label ?? range;
}

export function sliceRange(bars: Bar[], range: ChartRange) {
  if (bars.length === 0) return [];
  if (range === "ALL") return bars;
  const last = Date.parse(bars[bars.length - 1]!.t);
  const days =
    range === "1W" ? 7 : range === "1M" ? 31 : range === "3M" ? 93 : range === "1J" ? 366 : range === "5J" ? 365 * 5 + 2 : 365 * 10 + 3;
  const cut = last - days * 86_400_000;
  const sliced = bars.filter((b) => Date.parse(b.t) >= cut);
  return sliced.length >= 2 ? sliced : bars.slice(-2);
}

export function spanForRange(range: ChartRange): ChartSpan {
  if (range === "1J") return "1y";
  if (range === "5J") return "5y";
  if (range === "10J") return "10y";
  if (range === "ALL") return "max";
  return "3mo";
}

export function seriesStats(bars: Bar[]) {
  if (bars.length === 0) return { last: 0, prev: 0, changePct: 0, high: 0, low: 0 };
  const last = bars[bars.length - 1]!.c;
  const prev = bars[0]!.o;
  const high = Math.max(...bars.map((b) => b.h));
  const low = Math.min(...bars.map((b) => b.l));
  return { last, prev, changePct: prev ? ((last - prev) / prev) * 100 : 0, high, low };
}

export function seedAssetBars(asset: { yahoo: string; last: number }, span: ChartSpan): Bar[] {
  if (span === "5y" || span === "10y" || span === "max") {
    return generateWeeklyBars(asset.yahoo, asset.last, span === "max" ? 25 : span === "10y" ? 10 : 5);
  }
  return generateBars(asset.yahoo, asset.last, span === "1y" ? 252 : 66);
}

