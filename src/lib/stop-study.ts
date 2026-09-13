/** Stopabstand gegen verfügbare Volatilität. Kein ATR aus einem Broker. */

import { STOP_PCT_DEFAULT } from "./config.ts";
import { generateBars } from "./charts.ts";
import type { Bar } from "./types.ts";

export type StopRow = {
  ticker: string;
  seedDailyVolPct: number;
  barAbsRetPct: number | null;
  atrPct: number | null;
  stopPct: number;
  stopVsAtr: number | null;
  note: string;
};

const LAST: Record<string, number> = {
  NVDA: 214.72,
  AVGO: 368.45,
  JPM: 351.58,
  UNH: 390.11,
  GS: 1039.28,
  SPY: 765.72,
  VOO: 703.71,
  BLK: 1156.55,
};

const SEED_VOL: Record<string, number> = {
  NVDA: 0.018,
  AVGO: 0.017,
  JPM: 0.01,
  UNH: 0.014,
  GS: 0.012,
  SPY: 0.007,
  VOO: 0.007,
  BLK: 0.013,
};

export function meanAbsClosePct(bars: Bar[], lookback = 15): number | null {
  if (bars.length < 2) return null;
  const slice = bars.slice(-lookback - 1);
  const rets: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1]!.c;
    const cur = slice[i]!.c;
    if (prev > 0) rets.push(Math.abs((cur - prev) / prev) * 100);
  }
  if (!rets.length) return null;
  return Number((rets.reduce((a, n) => a + n, 0) / rets.length).toFixed(3));
}

export function atrPct(bars: Bar[], lookback = 15): number | null {
  if (bars.length < 2) return null;
  const slice = bars.slice(-lookback);
  const trs: number[] = [];
  for (let i = 0; i < slice.length; i++) {
    const b = slice[i]!;
    const prev = i === 0 ? bars[bars.length - slice.length - 1] : slice[i - 1];
    const prevC = prev?.c ?? b.o;
    const tr = Math.max(b.h - b.l, Math.abs(b.h - prevC), Math.abs(b.l - prevC));
    if (b.c > 0) trs.push((tr / b.c) * 100);
  }
  if (!trs.length) return null;
  return Number((trs.reduce((a, n) => a + n, 0) / trs.length).toFixed(3));
}

export function stopStudy(tape?: Record<string, Bar[]>): { rows: StopRow[]; verdict: string; data: "seed-bars" | "mixed" } {
  const tickers = ["SPY", "AVGO", "JPM", "GS", "UNH", "NVDA"];
  const rows: StopRow[] = tickers.map((ticker) => {
    const seed = SEED_VOL[ticker] ?? 0.012;
    const last = LAST[ticker] ?? 100;
    const bars = tape?.[ticker] ?? generateBars(ticker, last, 40);
    const abs = meanAbsClosePct(bars);
    const atr = atrPct(bars);
    const vs = atr && atr > 0 ? Number((STOP_PCT_DEFAULT / atr).toFixed(2)) : null;
    return {
      ticker,
      seedDailyVolPct: Number((seed * 100).toFixed(2)),
      barAbsRetPct: abs,
      atrPct: atr,
      stopPct: STOP_PCT_DEFAULT,
      stopVsAtr: vs,
      note:
        atr == null
          ? "UNBEKANNT"
          : vs != null && vs < 0.8
            ? "Stop enger als 0,8 ATR — Rauschen kann ihn treffen."
            : vs != null && vs > 2
              ? "Stop weiter als 2 ATR — Positionsgröße würde steigen."
              : "Stop grob eine bis zwei Tagesspannen.",
    };
  });
  const tight = rows.filter((r) => r.stopVsAtr != null && r.stopVsAtr < 1);
  const verdict = tight.length
    ? `Feste ${STOP_PCT_DEFAULT} % sind eine Startannahme, kein Optimum. Bei ${tight.map((r) => r.ticker).join(", ")} liegt der Stop unter einer mittleren Tagesspanne der Seed-Kerzen. Live-Yahoo-ATR fehlt in diesem Lauf, solange kein Tape übergeben wurde.`
    : `Feste ${STOP_PCT_DEFAULT} % bleiben eine Startannahme. Kein belegtes Optimum.`;
  return { rows, verdict, data: tape ? "mixed" : "seed-bars" };
}
