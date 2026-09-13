import { displayName } from "./names.ts";
import {
  DIVIDEND_YIELD,
  sleeveOf,
  taxFromGross,
  netFromGross,
  barOn,
  markPositions,
  navUsd,
  toEur,
  snapshot,
  withWeights,
  trimOverlay,
} from "./paper.ts";
import { MAX_ACTIVE_OVERLAY, MAX_SINGLE_PCT, MIN_BUY_USD, OVERLAY_TARGET_PCT, PER_TRADE_RISK_PCT, START_USD, STOP_PCT_DEFAULT } from "./config.ts";
import { alreadyActed, bookIdentity, dataKey, fillExists, peakNavEur, riskLock, riskSizeUsd, roundShares, stopLevelUsd } from "./ledger.ts";
import { applySideCost } from "./costs.ts";
import { overlayTrigger, type HypothesisId } from "./hypotheses.ts";
import type {
  Bar,
  BookStrategy,
  BotHuddle,
  DemoPosition,
  DemoWatch,
  FloorAuthor,
  InterveneKind,
  Lesson,
  PaperFill,
  PulseEvent,
  StrategySleeve,
  TradeTrial,
} from "./types.ts";

export const PAYERS = ["JPM", "GS", "AVGO", "UNH"] as const;
export const CORE_TICKERS = ["SPY", "VOO"] as const;
export const OVERLAY_CAP = MAX_SINGLE_PCT;
export const LOOKBACK_BARS = 15;
export const TAKE_PCT = 3.2;
export const TRAIL_GIVEBACK = 1.4;
export const PULL_REL = -4;
export const TICKS_PER_DAY = 8;

export type SleeveScore = {
  ticker: string;
  retPct: number;
  spyPct: number;
  relPct: number;
  yieldPct: number;
  score: number;
  action: "add" | "hold" | "trim" | "flat";
  sleeve: DemoPosition["sleeve"];
};

export type TiltReport = {
  at: string;
  overlayPct: number;
  note: string;
  scores: SleeveScore[];
  sleeves: StrategySleeve[];
};

export type CashTake = {
  overlayEur: number;
  divEur: number;
  grossEur: number;
  taxEur: number;
  netEur: number;
  note: string;
};

export type PulseDecision = {
  bot: FloorAuthor;
  kind: PulseEvent["kind"];
  intervene: InterveneKind | null;
  ticker?: string;
  keepFrac: number;
  spendUsd?: number;
  note: string;
  strategyId?: HypothesisId;
};

export type PulseContext = {
  scores?: SleeveScore[];
  sessionChangePct?: Record<string, number>;
};

export function cloneStrategy(base: BookStrategy): BookStrategy {
  return {
    ...base,
    groups: base.groups.map((g) => ({ ...g, tickers: [...g.tickers] })),
    sleeves: base.sleeves.map((s) => ({ ...s })),
  };
}

export function overlayNavEur(positions: DemoPosition[], eurUsd: number) {
  const usd = positions.filter((p) => p.sleeve === "overlay").reduce((a, p) => a + p.shares * p.lastUsd, 0);
  return eurUsd ? usd / eurUsd : usd;
}

function barsOnOrBefore(bars: Bar[], date: string) {
  return bars.filter((b) => b.t.slice(0, 10) <= date);
}

export function lookbackWindow(spyBars: Bar[], beforeDate?: string): { from: string; to: string } | null {
  const pool = beforeDate ? spyBars.filter((b) => b.t.slice(0, 10) < beforeDate) : spyBars;
  if (pool.length < 3) return null;
  const slice = pool.slice(-LOOKBACK_BARS);
  return { from: slice[0]!.t.slice(0, 10), to: slice[slice.length - 1]!.t.slice(0, 10) };
}

export function periodReturn(bars: Bar[] | undefined, from: string, to: string): number | null {
  if (!bars || bars.length < 2) return null;
  const inWin = bars.filter((b) => {
    const d = b.t.slice(0, 10);
    return d >= from && d <= to;
  });
  const first = inWin[0] ?? barsOnOrBefore(bars, from).at(-1);
  const last = inWin.at(-1) ?? barsOnOrBefore(bars, to).at(-1);
  if (!first || !last || first.c <= 0) return null;
  return ((last.c - first.c) / first.c) * 100;
}

export function bannedTickers(lessons: Lesson[]): string[] {
  const out = new Set<string>();
  for (const l of lessons) {
    if (l.status !== "applied") continue;
    if (l.effect === "ban" && l.tickers) {
      for (const t of l.tickers) out.add(t);
    }
  }
  return [...out];
}

export function trimmedTickers(lessons: Lesson[]): string[] {
  const out = new Set<string>();
  for (const l of lessons) {
    if (l.status !== "applied") continue;
    if (l.effect === "trim" && l.tickers) {
      for (const t of l.tickers) out.add(t);
    }
  }
  return [...out];
}

function actionOf(rel: number, banned: boolean, overlay: boolean): SleeveScore["action"] {
  if (banned) return "flat";
  if (!overlay) return "hold";
  if (rel <= -2.5) return "trim";
  if (rel >= 1) return "add";
  return "hold";
}

export function scoreSleeves(args: {
  sleeves: StrategySleeve[];
  tape: Record<string, Bar[]>;
  banned: string[];
  from: string;
  to: string;
}): SleeveScore[] {
  const spyPct = periodReturn(args.tape.SPY, args.from, args.to) ?? 0;
  return args.sleeves.map((s) => {
    const retPct = periodReturn(args.tape[s.ticker], args.from, args.to) ?? spyPct;
    const relPct = retPct - spyPct;
    const yieldPct = (DIVIDEND_YIELD[s.ticker] ?? 0) * 100;
    const sleeve = sleeveOf(s.ticker);
    const banned = args.banned.includes(s.ticker);
    let score = relPct + yieldPct * 0.35;
    if (banned) score = -99;
    if (sleeve === "overlay" && PAYERS.includes(s.ticker as (typeof PAYERS)[number]) && relPct > -1.5) {
      score = Math.max(score, 0.6);
    }
    if (sleeve === "overlay" && relPct < -3) score -= 2;
    return {
      ticker: s.ticker,
      retPct: Number(retPct.toFixed(3)),
      spyPct: Number(spyPct.toFixed(3)),
      relPct: Number(relPct.toFixed(3)),
      yieldPct: Number(yieldPct.toFixed(3)),
      score: Number(score.toFixed(3)),
      action: actionOf(relPct, banned, sleeve === "overlay"),
      sleeve,
    };
  });
}

function roundSleeves(sleeves: StrategySleeve[]): StrategySleeve[] {
  const rounded = sleeves.map((s) => ({ ...s, weightPct: Number(s.weightPct.toFixed(2)) }));
  const sum = rounded.reduce((a, s) => a + s.weightPct, 0);
  const spy = rounded.find((s) => s.ticker === "SPY");
  if (spy) spy.weightPct = Number((spy.weightPct + (100 - sum)).toFixed(2));
  return rounded;
}

export function tiltStrategy(args: {
  base: BookStrategy;
  tape: Record<string, Bar[]>;
  lessons: Lesson[];
  liveStatus: "live" | "abort";
  beforeDate?: string;
}): TiltReport {
  const base = cloneStrategy(args.base);
  const window = lookbackWindow(args.tape.SPY ?? [], args.beforeDate);
  const banned = bannedTickers(args.lessons);
  const trimmed = trimmedTickers(args.lessons);
  const from = window?.from ?? "1970-01-01";
  const to = window?.to ?? "1970-01-01";
  const scores = window
    ? scoreSleeves({ sleeves: base.sleeves, tape: args.tape, banned, from, to })
    : base.sleeves.map((s) => ({
        ticker: s.ticker,
        retPct: 0,
        spyPct: 0,
        relPct: 0,
        yieldPct: (DIVIDEND_YIELD[s.ticker] ?? 0) * 100,
        score: 0,
        action: banned.includes(s.ticker) ? ("flat" as const) : ("hold" as const),
        sleeve: sleeveOf(s.ticker),
      }));

  const overlayBudget = args.liveStatus === "abort" ? 20 : OVERLAY_TARGET_PCT;
  const coreBudget = args.liveStatus === "abort" ? 65 : 55;
  const tollBudget = 100 - overlayBudget - coreBudget;

  const spyShare = coreBudget * (22 / 35);
  const vooShare = coreBudget * (13 / 35);

  const overlayScores = scores.filter((s) => s.sleeve === "overlay" && !banned.includes(s.ticker));
  const raw = overlayScores.map((s) => {
    let w = Math.max(0, s.score + 3);
    if (trimmed.includes(s.ticker)) w *= 0.55;
    if (s.action === "trim") w *= 0.45;
    if (s.action === "add") w *= 1.25;
    return { ticker: s.ticker, w };
  });
  const rawSum = raw.reduce((a, r) => a + r.w, 0);

  const overlayWeights: Record<string, number> = {};
  if (rawSum <= 0) {
    const fallback = overlayScores.filter((s) => PAYERS.includes(s.ticker as (typeof PAYERS)[number]));
    const each = overlayBudget / Math.max(1, fallback.length);
    for (const s of fallback) overlayWeights[s.ticker] = each;
  } else {
    for (const r of raw) overlayWeights[r.ticker] = (r.w / rawSum) * overlayBudget;
  }

  for (const k of Object.keys(overlayWeights)) {
    if ((overlayWeights[k] ?? 0) > OVERLAY_CAP) overlayWeights[k] = OVERLAY_CAP;
  }
  let used = Object.values(overlayWeights).reduce((a, n) => a + n, 0);
  if (used < overlayBudget) {
    const room = overlayScores
      .filter((s) => PAYERS.includes(s.ticker as (typeof PAYERS)[number]) || s.action === "add")
      .map((s) => s.ticker);
    const add = (overlayBudget - used) / Math.max(1, room.length);
    for (const t of room) overlayWeights[t] = Math.min(OVERLAY_CAP, (overlayWeights[t] ?? 0) + add);
  }
  used = Object.values(overlayWeights).reduce((a, n) => a + n, 0);
  if (used > overlayBudget && used > 0) {
    const scale = overlayBudget / used;
    for (const k of Object.keys(overlayWeights)) overlayWeights[k] = (overlayWeights[k] ?? 0) * scale;
  }

  const sleeves = base.sleeves.map((s) => {
    const kind = sleeveOf(s.ticker);
    if (banned.includes(s.ticker)) return { ...s, weightPct: 0, role: "Gesperrt — Lesson" };
    if (s.ticker === "SPY") return { ...s, weightPct: spyShare };
    if (s.ticker === "VOO") return { ...s, weightPct: vooShare };
    if (s.ticker === "BLK") return { ...s, weightPct: tollBudget };
    return { ...s, weightPct: overlayWeights[s.ticker] ?? 0 };
  });

  const next = roundSleeves(sleeves);
  const adds = scores.filter((s) => s.action === "add").map((s) => s.ticker);
  const trims = scores.filter((s) => s.action === "trim" || s.action === "flat").map((s) => s.ticker);
  const noteParts = [
    window ? `Neigung auf Tape ${from} – ${to}.` : "Noch zu wenig Tape für eine Neigung.",
    `Beimischung ${overlayBudget} %.`,
    adds.length ? `Aufgestockt: ${adds.join(", ")}.` : "Kein Aufstocken.",
    trims.length ? `Zurück: ${trims.join(", ")}.` : "",
    banned.length ? `Gesperrt: ${banned.join(", ")}.` : "",
    "Kern bleibt. Soll ist nicht Bestand. Gewinn bleibt im Book. Kein Echtgeld.",
  ];
  return {
    at: new Date().toISOString(),
    overlayPct: overlayBudget,
    note: noteParts.filter(Boolean).join(" "),
    scores,
    sleeves: next,
  };
}

export function applyTilt(base: BookStrategy, report: TiltReport): BookStrategy {
  const next = cloneStrategy(base);
  next.sleeves = report.sleeves.map((s) => ({ ...s }));
  next.tiltNote = report.note;
  next.id = `${base.id}-tilt`;
  return next;
}

export function cashTakeFromWeek(args: {
  overlayStartEur: number;
  overlayEndEur: number;
  startEur: number;
  sleeves: StrategySleeve[];
  harvestedOverlayEur?: number;
}): CashTake {
  const overlayEur = Math.max(0, args.overlayEndEur - args.overlayStartEur - (args.harvestedOverlayEur ?? 0));
  const divEur = 0;
  const grossEur = Number(overlayEur.toFixed(2));
  if (grossEur <= 0) {
    return {
      overlayEur: 0,
      divEur: 0,
      grossEur: 0,
      taxEur: 0,
      netEur: 0,
      note: "Beimischung nicht im Plus. Nichts zum Wiederanlegen. Kern bleibt. Dividenden nur bei belegtem Ex-Tag.",
    };
  }
  const taxEur = Number(taxFromGross(grossEur).toFixed(2));
  const netEur = Number(netFromGross(grossEur).toFixed(2));
  return {
    overlayEur: Number(overlayEur.toFixed(2)),
    divEur,
    grossEur,
    taxEur,
    netEur,
    note: `Beimischung ${overlayEur >= 0 ? "+" : ""}${overlayEur.toFixed(2)} €. Bleibt im Book und trägt erneut Risiko. Keine erfundene Wochen-Dividende. Kein Echtgeld.`,
  };
}

export function decideAutoIntervene(watch: DemoWatch, date: string): {
  kind: InterveneKind;
  ticker?: string;
  note: string;
} | null {
  if (watch.day < 2) return null;
  if (watch.interventions.some((i) => i.day === watch.day)) return null;
  const autos = watch.interventions.filter((i) => i.id.startsWith("i-auto") || i.note.startsWith("Tag "));
  if (autos.length >= 2) return null;
  if (watch.relativePct <= -2) {
    if (watch.interventions.some((i) => i.kind === "trim-overlay")) return null;
    return {
      kind: "trim-overlay",
      note: `Tag ${watch.day}: Book ${watch.relativePct.toFixed(2)} pp unter dem Markt. Beimischung halbiert, Kern unangetastet.`,
    };
  }
  const overlay = watch.positions.filter((p) => p.sleeve === "overlay" && p.shares > 0 && p.weightPct >= 1.5);
  let worst: DemoPosition | null = null;
  let worstRel = 0;
  for (const p of overlay) {
    if (watch.interventions.some((i) => i.kind === "flat" && i.ticker === p.ticker)) continue;
    const pnl = p.costUsd > 0 ? ((p.lastUsd - p.costUsd) / p.costUsd) * 100 : 0;
    const rel = pnl - watch.spyPct;
    if (!worst || rel < worstRel) {
      worst = p;
      worstRel = rel;
    }
  }
  if (worst && worstRel <= -2.5) {
    return {
      kind: "flat",
      ticker: worst.ticker,
      note: `Tag ${watch.day} ${date}: ${displayName(worst.ticker)} liegt ${worstRel.toFixed(1)} Prozentpunkte hinter dem Markt. Verkauft, Erlös wartet als Cash.`,
    };
  }
  return null;
}

export function trialFromTape(args: {
  id: string;
  ticker: string;
  sourceId: string;
  tape: Record<string, Bar[]>;
  at: string;
  thesis: string;
}): TradeTrial {
  const window = lookbackWindow(args.tape.SPY ?? []);
  const bookPct = window ? periodReturn(args.tape[args.ticker], window.from, window.to) ?? 0 : 0;
  const spyPct = window ? periodReturn(args.tape.SPY, window.from, window.to) ?? 0 : 0;
  const relativePct = bookPct - spyPct;
  return {
    id: args.id,
    week: `T-${args.ticker}`,
    source: "trade",
    sourceId: args.sourceId,
    label: `${args.ticker} Tape`,
    startedAt: args.at,
    bookPct: Number(bookPct.toFixed(2)),
    spyPct: Number(spyPct.toFixed(2)),
    relativePct: Number(relativePct.toFixed(2)),
    hit: relativePct >= 0,
    note: `${args.thesis} Gerechnet auf dem letzten Tape${window ? ` ${window.from} – ${window.to}` : ""}. Kein Live.`,
  };
}

export function withPeaks(watch: DemoWatch): DemoWatch {
  const peaks = { ...(watch.peaks ?? {}) };
  for (const p of watch.positions) {
    if (p.shares > 0) peaks[p.ticker] = Math.max(peaks[p.ticker] ?? p.lastUsd, p.lastUsd);
  }
  return { ...watch, peaks };
}

export function sliceTicker(
  positions: DemoPosition[],
  ticker: string,
  keepFrac: number,
): { positions: DemoPosition[]; soldUsd: number; realizedUsd: number } {
  const row = positions.find((p) => p.ticker === ticker);
  if (!row || row.shares <= 0) return { positions, soldUsd: 0, realizedUsd: 0 };
  const sell = roundShares(row.shares * (1 - Math.max(0, Math.min(1, keepFrac))));
  const sellPx = applySideCost(row.lastUsd, "sell");
  return {
    positions: positions.map((p) =>
      p.ticker === ticker ? { ...p, shares: row.shares - sell, weightPct: keepFrac === 0 ? 0 : p.weightPct } : p,
    ),
    soldUsd: sell * sellPx,
    realizedUsd: sell * (sellPx - row.costUsd),
  };
}

export function buyTicker(
  positions: DemoPosition[],
  ticker: string,
  usd: number,
  lastUsd: number,
): { positions: DemoPosition[]; spentUsd: number; shares: number } {
  if (usd <= 0 || lastUsd <= 0) return { positions, spentUsd: 0, shares: 0 };
  const px = applySideCost(lastUsd, "buy");
  const add = roundShares(usd / px);
  if (add <= 0) return { positions, spentUsd: 0, shares: 0 };
  const spentUsd = add * px;
  const row = positions.find((p) => p.ticker === ticker);
  if (!row) {
    return {
      positions: [
        ...positions,
        {
          ticker,
          shares: add,
          costUsd: px,
          lastUsd,
          weightPct: 0,
          sleeve: sleeveOf(ticker),
        },
      ],
      spentUsd,
      shares: add,
    };
  }
  const newShares = roundShares(row.shares + add);
  const costUsd = newShares > 0 ? (row.costUsd * row.shares + px * add) / newShares : px;
  return {
    positions: positions.map((p) =>
      p.ticker === ticker ? { ...p, shares: newShares, costUsd, lastUsd } : p,
    ),
    spentUsd,
    shares: add,
  };
}

function cashUsdOf(watch: DemoWatch, reservedUsd = 0) {
  return Math.max(0, watch.cashEur * (watch.eurUsd || 0) - reservedUsd);
}

function recentTickers(watch: DemoWatch, kinds: InterveneKind[]) {
  const live = watch.phase === "live";
  return new Set(
    watch.interventions
      .filter((i) => {
        if (!kinds.includes(i.kind) || !i.ticker) return false;
        if (live) return Date.now() - Date.parse(i.at) < 45_000;
        return i.day === watch.day;
      })
      .map((i) => i.ticker as string),
  );
}

function pickBuy(
  watch: DemoWatch,
  reservedUsd = 0,
  scores?: SleeveScore[],
  sessionChangePct?: Record<string, number>,
): { ticker: string; lastUsd: number; spendUsd: number; payer: boolean; strategyId: HypothesisId; reason: string } | null {
  const cashUsd = cashUsdOf(watch, reservedUsd);
  const nav = navUsd(watch.positions, watch.cashEur, watch.eurUsd);
  const minBuy = Math.max(MIN_BUY_USD, nav * 0.015);
  if (cashUsd < minBuy || nav <= 0) return null;
  const blocked = recentTickers(watch, ["flat", "take-profit", "trail", "add-overlay"]);
  const flattened = new Set(
    watch.interventions.filter((i) => i.kind === "flat" && i.ticker).map((i) => i.ticker as string),
  );
  const overlayHeld = watch.positions.filter((p) => p.sleeve === "overlay" && p.shares > 0);
  const overlayFull = overlayHeld.length >= MAX_ACTIVE_OVERLAY;
  const scored = watch.positions
    .filter(
      (p) =>
        p.sleeve === "overlay" &&
        p.lastUsd > 0 &&
        p.ticker !== "TSLA" &&
        !blocked.has(p.ticker) &&
        !flattened.has(p.ticker) &&
        (!overlayFull || p.shares > 0),
    )
    .map((p) => {
      const trigger = overlayTrigger({
        ticker: p.ticker,
        scores,
        sessionChangePct: sessionChangePct?.[p.ticker],
      });
      const payer = PAYERS.includes(p.ticker as (typeof PAYERS)[number]);
      const held = p.shares * p.lastUsd;
      const spend = riskSizeUsd({
        navUsd: nav,
        availableUsd: cashUsd,
        capPct: OVERLAY_CAP,
        stopPct: STOP_PCT_DEFAULT,
        heldUsd: held,
      });
      const rel = scores?.find((s) => s.ticker === p.ticker)?.relPct ?? -99;
      return { p, trigger, payer, spend, rel };
    })
    .filter((c) => c.trigger && c.spend >= minBuy * 0.5)
    .sort((a, b) => b.rel - a.rel);
  const best = scored[0];
  if (!best || !best.trigger) return null;
  const spend = Math.min(best.spend, cashUsd);
  if (spend < minBuy * 0.5) return null;
  return {
    ticker: best.p.ticker,
    lastUsd: best.p.lastUsd,
    spendUsd: spend,
    payer: best.payer,
    strategyId: best.trigger.id,
    reason: best.trigger.reason,
  };
}

export function decidePulse(
  watch: DemoWatch,
  tapeCloseDate?: string,
  fills?: PaperFill[],
  reservedUsd = 0,
  ctx?: PulseContext,
): PulseDecision | null {
  if (watch.status === "paused" || watch.status === "idle") return null;
  if (watch.tradeLock) return null;
  const closeDate = tapeCloseDate || watch.tapeCloseDate || "";
  const live = watch.phase === "live";
  if (live && closeDate && alreadyActed(watch.actedKeys, `${closeDate}:session`)) return null;
  if (live && closeDate && fillExists(fills, `${closeDate}:session`)) return null;
  const keyed = (kind: string, ticker?: string) => fillExists(fills, dataKey(closeDate, kind, ticker ?? "book"));
  const ident = bookIdentity({
    positions: watch.positions,
    cashEur: watch.cashEur,
    eurUsd: watch.eurUsd,
    navEur: watch.navEur,
  });
  if (!ident.ok) return null;
  const dayPct =
    watch.prevCloseNavEur && watch.prevCloseNavEur > 0
      ? ((watch.navEur - watch.prevCloseNavEur) / watch.prevCloseNavEur) * 100
      : 0;
  const lock = riskLock({
    startEur: watch.startEur,
    navEur: watch.navEur,
    peakEur: peakNavEur(watch.equity, watch.navEur),
    bookPct: watch.bookPct,
    dayPct,
  });
  const peaks = watch.peaks ?? {};
  const recent = live
    ? watch.interventions.filter((i) => Date.now() - Date.parse(i.at) < 45_000)
    : watch.interventions.filter((i) => i.day === watch.day);
  const canSell = recent.filter((i) => i.kind !== "add-overlay").length < 2;
  const canBuy = !lock && recent.filter((i) => i.kind === "add-overlay" || i.kind === "add-core").length < 3;

  if (canSell) {
    const stopped = watch.positions
      .filter((p) => p.shares > 0 && p.sleeve === "overlay")
      .map((p) => ({
        p,
        pnlUsd: p.shares * (p.lastUsd - p.costUsd),
        stop: stopLevelUsd(p.costUsd),
      }))
      .filter((c) => c.p.lastUsd <= c.stop || c.pnlUsd <= -(START_USD * (PER_TRADE_RISK_PCT / 100)))
      .sort((a, b) => a.pnlUsd - b.pnlUsd)[0];
    if (stopped && !keyed("stop", stopped.p.ticker) && !keyed("pull", stopped.p.ticker)) {
      return {
        bot: "forge",
        kind: "pull",
        intervene: "flat",
        ticker: stopped.p.ticker,
        keepFrac: 0,
        note: `Stop. ${displayName(stopped.p.ticker)} notiert ${stopped.p.lastUsd.toFixed(2)} $, Stop lag bei ${stopped.stop.toFixed(2)} $. Verkauf zum vorliegenden Kurs, nicht zum Stop.`,
      };
    }
  }

  if (canSell && watch.relativePct <= -3 && !watch.interventions.some((i) => i.kind === "trim-overlay") && !keyed("trim")) {
    return {
      bot: "skipper",
      kind: "trim",
      intervene: "trim-overlay",
      keepFrac: 1,
      note: `Beimischung ${watch.relativePct.toFixed(2)} Prozentpunkte unter dem Markt. Beimischung halbiert, Grundstock bleibt.`,
    };
  }

  if (canBuy) {
    const buy = pickBuy(watch, reservedUsd, ctx?.scores, ctx?.sessionChangePct);
    if (buy && !keyed("buy", buy.ticker)) {
      return {
        bot: buy.payer ? "till" : "vein",
        kind: "buy",
        intervene: "add-overlay",
        ticker: buy.ticker,
        keepFrac: 1,
        spendUsd: buy.spendUsd,
        strategyId: buy.strategyId,
        note: `${buy.strategyId}. ${buy.reason} ${displayName(buy.ticker)} für ${buy.spendUsd.toFixed(2)} $ — Größe aus Risiko, nicht aus Restkasse.`,
      };
    }
  }

  type Cand = { p: DemoPosition; pnl: number; peakPnl: number; rel: number };
  const overlay = watch.positions.filter((p) => p.sleeve === "overlay" && p.shares > 0 && p.weightPct >= 1);
  const scored: Cand[] = overlay.map((p) => {
    const pnl = p.costUsd > 0 ? ((p.lastUsd - p.costUsd) / p.costUsd) * 100 : 0;
    const peak = peaks[p.ticker] ?? p.lastUsd;
    const peakPnl = p.costUsd > 0 ? ((peak - p.costUsd) / p.costUsd) * 100 : pnl;
    return { p, pnl, peakPnl, rel: pnl - watch.spyPct };
  });

  if (canSell) {
    const pull = scored
      .filter(
        (c) =>
          watch.day >= 2 &&
          c.rel <= PULL_REL &&
          !watch.interventions.some((i) => i.kind === "flat" && i.ticker === c.p.ticker),
      )
      .sort((a, b) => a.rel - b.rel)[0];
    if (pull && !keyed("pull", pull.p.ticker)) {
      return {
        bot: "forge",
        kind: "pull",
        intervene: "flat",
        ticker: pull.p.ticker,
        keepFrac: 0,
        note: `${displayName(pull.p.ticker)} liegt ${pull.rel.toFixed(1)} Prozentpunkte hinter dem Markt. Verkauft, Erlös wartet als Cash.`,
      };
    }

    const trail = scored
      .filter((c) => c.peakPnl >= TAKE_PCT && c.peakPnl - c.pnl >= TRAIL_GIVEBACK)
      .sort((a, b) => b.peakPnl - b.pnl - (a.peakPnl - a.pnl))[0];
    if (trail && !keyed("trail", trail.p.ticker)) {
      return {
        bot: "drift",
        kind: "trail",
        intervene: "trail",
        ticker: trail.p.ticker,
        keepFrac: 0,
        note: `${displayName(trail.p.ticker)} gab ${(trail.peakPnl - trail.pnl).toFixed(1)} Prozentpunkte vom Hoch ab. Gewinn mitnehmen.`,
      };
    }

    const take = scored
      .filter(
        (c) =>
          c.pnl >= TAKE_PCT &&
          !watch.interventions.some((i) => (i.kind === "take-profit" || i.kind === "trail") && i.ticker === c.p.ticker),
      )
      .sort((a, b) => b.pnl - a.pnl)[0];
    if (take && !keyed("take", take.p.ticker)) {
      return {
        bot: PAYERS.includes(take.p.ticker as (typeof PAYERS)[number]) ? "till" : "vein",
        kind: "take",
        intervene: "take-profit",
        ticker: take.p.ticker,
        keepFrac: 0.5,
        note: `Gewinn bei ${displayName(take.p.ticker)} plus ${take.pnl.toFixed(1)} Prozent. Hälfte bleibt als Cash im Book, als Nächstes wieder einsetzen.`,
      };
    }
  }

  return null;
}

export function makePulseEvent(decision: PulseDecision, at: string, grossEur?: number): PulseEvent {
  return {
    id: `pulse-${at}-${decision.kind}-${decision.ticker ?? "book"}`,
    at,
    bot: decision.bot,
    kind: decision.kind,
    ticker: decision.ticker,
    text: decision.note,
    grossEur,
  };
}

export function intraDayPrice(bar: Bar, step: number, steps = TICKS_PER_DAY): number {
  const last = Math.max(1, steps - 1);
  const frac = Math.max(0, Math.min(1, step / last));
  return bar.o + (bar.c - bar.o) * frac;
}

function finishMarked(watch: DemoWatch, positions: DemoPosition[], cashEur: number, spyLast: number): DemoWatch {
  const nav = toEur(navUsd(positions, cashEur, watch.eurUsd), watch.eurUsd);
  const snap = snapshot({
    startEur: watch.startEur,
    navEur: nav,
    spyStart: watch.spyStart,
    spyLast,
  });
  return {
    ...watch,
    positions: withWeights(positions, cashEur, watch.eurUsd),
    cashEur,
    spyLast,
    navEur: Number(nav.toFixed(4)),
    ...snap,
  };
}

export function markWatchSession(watch: DemoWatch, tape: Record<string, Bar[]>, step: number): DemoWatch {
  const idx = Math.min(Math.max(0, watch.day), Math.max(0, watch.window.length - 1));
  const date = watch.window[idx]?.date;
  if (!date) return withPeaks({ ...watch, sessionStep: step });
  const last: Record<string, number> = {};
  for (const p of watch.positions) {
    const bar = barOn(tape[p.ticker], date);
    last[p.ticker] = bar ? intraDayPrice(bar, step) : p.lastUsd;
  }
  const spyBar = barOn(tape.SPY, date);
  const spyLast = spyBar ? intraDayPrice(spyBar, step) : watch.spyLast;
  const positions = markPositions(watch.positions, last);
  return withPeaks({
    ...finishMarked(watch, positions, watch.cashEur, spyLast),
    sessionStep: step,
  });
}

export function overlayRoomEur(watch: DemoWatch) {
  const now = overlayNavEur(watch.positions, watch.eurUsd);
  const start = watch.overlayStartEur ?? now;
  return Math.max(0, now - start - (watch.harvestedOverlayEur ?? 0));
}

export function applyPulseToWatch(
  watch: DemoWatch,
  decision: PulseDecision,
  at = new Date().toISOString(),
): { watch: DemoWatch; soldUsd: number; realizedUsd: number; spentUsd: number; shares: number } {
  let positions = watch.positions;
  let cashEur = watch.cashEur;
  let soldUsd = 0;
  let realizedUsd = 0;
  let spentUsd = 0;
  let shares = 0;
  if (decision.intervene === "trim-overlay") {
    positions = trimOverlay(positions);
  } else if (
    (decision.intervene === "flat" || decision.intervene === "trail" || decision.intervene === "take-profit") &&
    decision.ticker
  ) {
    const before = positions.find((p) => p.ticker === decision.ticker);
    const cut = sliceTicker(positions, decision.ticker, decision.keepFrac);
    positions = cut.positions;
    soldUsd = cut.soldUsd;
    realizedUsd = cut.realizedUsd;
    shares = before && before.lastUsd > 0 ? cut.soldUsd / applySideCost(before.lastUsd, "sell") : 0;
    cashEur += watch.eurUsd ? soldUsd / watch.eurUsd : soldUsd;
  } else if (
    (decision.intervene === "add-overlay" || decision.intervene === "add-core") &&
    decision.ticker
  ) {
    const last = positions.find((p) => p.ticker === decision.ticker)?.lastUsd ?? 0;
    if (last <= 0) return { watch, soldUsd: 0, realizedUsd: 0, spentUsd: 0, shares: 0 };
    const cashUsd = cashEur * (watch.eurUsd || 0);
    const nav = navUsd(positions, cashEur, watch.eurUsd);
    const held = (positions.find((p) => p.ticker === decision.ticker)?.shares ?? 0) * last;
    const cap = decision.intervene === "add-core" ? 0.6 : OVERLAY_CAP / 100;
    const room = decision.intervene === "add-core" ? cashUsd : Math.max(0, nav * cap - held);
    const minBuy = Math.max(MIN_BUY_USD, nav * 0.015);
    const spend = Math.min(decision.spendUsd ?? cashUsd, cashUsd, room || cashUsd);
    if (spend < minBuy * 0.5) return { watch, soldUsd: 0, realizedUsd: 0, spentUsd: 0, shares: 0 };
    const bought = buyTicker(positions, decision.ticker, spend, last);
    positions = bought.positions;
    spentUsd = bought.spentUsd;
    shares = bought.shares;
    cashEur -= watch.eurUsd ? bought.spentUsd / watch.eurUsd : bought.spentUsd;
    if (cashEur < 0) cashEur = 0;
  } else {
    return { watch, soldUsd: 0, realizedUsd: 0, spentUsd: 0, shares: 0 };
  }
  const next = finishMarked(watch, positions, cashEur, watch.spyLast);
  const realizedEur = watch.eurUsd ? Math.max(0, realizedUsd / watch.eurUsd) : 0;
  const room = overlayRoomEur(watch);
  const booked = Math.min(realizedEur, room);
  const closeDate = watch.tapeCloseDate || "";
  const key = dataKey(closeDate || at.slice(0, 10), decision.kind, decision.ticker ?? "book");
  const ident = bookIdentity({
    positions: next.positions,
    cashEur: next.cashEur,
    eurUsd: next.eurUsd,
    navEur: next.navEur,
  });
  return {
    watch: withPeaks({
      ...next,
      harvestedOverlayEur: (watch.harvestedOverlayEur ?? 0) + booked,
      actedKeys: [...new Set([...(watch.actedKeys ?? []), key, `${closeDate}:session`])],
      tapeCloseDate: closeDate || watch.tapeCloseDate,
      bookVersion: (watch.bookVersion ?? 0) + 1,
      tradeLock: ident.lock,
      interventions: [
        ...watch.interventions,
        {
          id: `i-pulse-${at}`,
          at,
          day: watch.day,
          kind: decision.intervene,
          ticker: decision.ticker,
          note: decision.note,
        },
      ],
    }),
    soldUsd,
    realizedUsd,
    spentUsd,
    shares,
  };
}

export function huddleStance(watch: DemoWatch, decision: PulseDecision | null, at = new Date().toISOString()): BotHuddle {
  const cashUsd = cashUsdOf(watch);
  return {
    at,
    action: decision?.kind ?? "hold",
    skipper:
      decision?.bot === "skipper"
        ? decision.note
        : watch.relativePct >= 0
          ? `Kern halten. Book ${watch.relativePct >= 0 ? "plus" : ""}${watch.relativePct.toFixed(2)} Prozentpunkte vor dem Markt. Cash darf liegen.`
          : `Book ${watch.relativePct.toFixed(2)} Prozentpunkte hinter dem Markt. Kürzen erst ab minus 3. Cash ist keine Kaufpflicht.`,
    forge:
      decision?.bot === "forge"
        ? decision.note
        : "Verlierer erst verkaufen, wenn sie klar hinter dem Markt liegen, und erst ab Tag 2.",
    till:
      decision?.bot === "till" || decision?.bot === "vein"
        ? decision.note
        : cashUsd >= MIN_BUY_USD
          ? `Cash ${cashUsd.toFixed(2)} $ wartet. Nachkauf nur mit S1 oder S2, nicht weil Geld da ist.`
          : `Gewinn erst ab plus ${TAKE_PCT} Prozent. Dann Hälfte als Cash.`,
    drift:
      decision?.bot === "drift"
        ? decision.note
        : `Gewinn sichern, wenn ${TRAIL_GIVEBACK} Prozentpunkte vom echten Hoch weg sind.`,
  };
}
