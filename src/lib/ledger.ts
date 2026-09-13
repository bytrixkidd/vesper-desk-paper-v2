import { CFG_VERSION, COST_BPS, DAY_LOSS_LOCK_PCT, MONTH_LOSS_LOCK_PCT, PEAK_DD_LOCK_PCT, PER_TRADE_RISK_PCT, START_USD, STOP_PCT_DEFAULT } from "./config.ts";
import { applySideCost } from "./costs.ts";
import { nyseStatus } from "./format.ts";
import type { DemoPosition, PaperFill, PaperFillStatus } from "./types.ts";

export { CFG_VERSION, applySideCost };

function toEur(usd: number, eurUsd: number) {
  return eurUsd ? usd / eurUsd : usd;
}

export function lastCloseDate(bars?: { t: string }[]) {
  const last = bars?.at(-1);
  return last ? last.t.slice(0, 10) : "";
}

export function lastBarTime(bars?: { t: string }[]) {
  return bars?.at(-1)?.t ?? null;
}

export function nextSessionYmd(closeDate: string) {
  const d = new Date(`${closeDate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return closeDate;
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

/** Gültigkeit einer geplanten Order: nächste reguläre Sitzung, 16:00 America/New_York. */
export function nextSessionValidUntil(closeDate: string) {
  return `${nextSessionYmd(closeDate)}T16:00:00.000-04:00`;
}

export function tradingDaysFrom(bars: { t: string }[], count: number) {
  const days = [...new Set((bars ?? []).map((b) => b.t.slice(0, 10)))].sort();
  return days.slice(-count).map((date) => ({ date }));
}

export function dataKey(closeDate: string, kind: string, ticker = "book") {
  return `${closeDate}:${kind}:${ticker}`;
}

export function alreadyActed(keys: string[] | undefined, key: string) {
  return Boolean(keys?.includes(key));
}

export function bookIdentity(args: {
  positions: DemoPosition[];
  cashEur: number;
  eurUsd: number;
  navEur: number;
}) {
  const eqUsd = args.positions.reduce((a, p) => a + p.shares * p.lastUsd, 0);
  const cashUsd = args.cashEur * (args.eurUsd || 0);
  const computedUsd = eqUsd + cashUsd;
  const computedEur = toEur(computedUsd, args.eurUsd);
  const driftEur = Math.abs(computedEur - args.navEur);
  const ok = driftEur < 0.05 && cashUsd >= -0.02 && eqUsd >= -0.02;
  return {
    ok,
    eqUsd,
    cashUsd,
    computedUsd,
    computedEur,
    navEur: args.navEur,
    driftEur,
    lock: ok ? null : `Buchung driftet ${driftEur.toFixed(2)} €. Neue Käufe gesperrt, bis der Stand stimmt.`,
  };
}

export function equityUsd(positions: DemoPosition[]) {
  return positions.reduce((a, p) => a + p.shares * p.lastUsd, 0);
}

export function residualCashEur(positions: DemoPosition[], navEur: number, eurUsd: number) {
  const usedEur = toEur(equityUsd(positions), eurUsd);
  return Math.max(0, navEur - usedEur);
}

export function roundShares(n: number) {
  return Math.round(n * 10_000) / 10_000;
}

export function roundUsd(n: number) {
  return Math.round(n * 100) / 100;
}

export function makeFill(partial: Omit<PaperFill, "id" | "cashDeltaUsd"> & { id?: string; cashDeltaUsd?: number }): PaperFill {
  const id = partial.id ?? `f-${partial.decidedAt}-${partial.symbol}-${partial.side}-${partial.dataKey}`;
  const cashDeltaUsd =
    partial.cashDeltaUsd ??
    (partial.side === "buy" ? -(partial.shares * partial.priceUsd + partial.costUsd) : partial.shares * partial.priceUsd - partial.costUsd);
  const reservedUsd =
    partial.reservedUsd ?? (partial.status === "planned" && partial.side === "buy" ? Math.abs(cashDeltaUsd) : 0);
  return {
    costBps: partial.costBps ?? COST_BPS,
    priceSource: partial.priceSource ?? "unknown",
    reviews: partial.reviews ?? [],
    ...partial,
    id,
    cashDeltaUsd,
    reservedUsd,
  };
}

export function peakNavEur(equity: { nav: number }[] | undefined, fallback: number) {
  if (!equity?.length) return fallback;
  return equity.reduce((m, p) => Math.max(m, p.nav), fallback);
}

export function riskLock(args: {
  startEur: number;
  navEur: number;
  peakEur: number;
  bookPct: number;
  monthPct?: number;
  dayPct?: number;
}) {
  if (args.dayPct != null && args.dayPct <= DAY_LOSS_LOCK_PCT) {
    return `Tagessperre: ${args.dayPct.toFixed(2)} % seit dem letzten Schluss. Keine neuen Käufe bis zur nächsten Sitzung.`;
  }
  if ((args.monthPct ?? 0) <= MONTH_LOSS_LOCK_PCT) {
    return `Monatssperre: mindestens ${Math.abs(MONTH_LOSS_LOCK_PCT)} % unter dem Monatsstart. Keine neuen Käufe.`;
  }
  if (args.peakEur > 0 && (args.navEur - args.peakEur) / args.peakEur <= PEAK_DD_LOCK_PCT / 100) {
    return "Depothochsperre: 10 % unter dem bisherigen Hoch. Keine neuen Käufe.";
  }
  return null;
}

export function navMatches(positions: DemoPosition[], cashEur: number, eurUsd: number) {
  return positions.reduce((a, p) => a + p.shares * p.lastUsd, 0) + cashEur * (eurUsd || 0);
}

export function etYmd(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Live-Ausführung nur in einer offenen Sitzung auf dem Schluss/Kurs dieses Sitzungstags. Replay darf rekonstruieren. */
export function canSimulateFill(args: {
  market: "open" | "closed";
  phase: "replay" | "live";
  closeDate: string;
  now?: Date;
}) {
  if (args.phase === "replay") {
    return { ok: true as const, reason: "Rekonstruktion einer vergangenen Sitzung." };
  }
  const nyse = nyseStatus(args.now);
  if (args.market === "closed" || !nyse.open) {
    return {
      ok: false as const,
      reason: "Sitzung zu. Keine neue Ausführung zum alten Schlusskurs. Order bleibt PLANNED.",
    };
  }
  const today = etYmd(args.now);
  if (args.closeDate && args.closeDate !== today) {
    return {
      ok: false as const,
      reason: `Tape-Schluss ${args.closeDate} ist nicht der Sitzungstag ${today}. Verzögert, keine Ausführung.`,
    };
  }
  return { ok: true as const, reason: "Sitzung offen, Datenstand ist der Sitzungstag." };
}

export function fillExists(fills: PaperFill[] | undefined, key: string) {
  return Boolean(fills?.some((f) => f.dataKey === key && (f.status === "planned" || f.status === "simulated_filled")));
}

export function sharesFromNotional(usd: number, rawPrice: number, side: "buy" | "sell") {
  const px = applySideCost(rawPrice, side);
  if (px <= 0 || usd <= 0) return { shares: 0, priceUsd: px, costUsd: 0, spentUsd: 0 };
  const shares = roundShares(usd / px);
  const notional = roundUsd(shares * px);
  const rawNotional = shares * rawPrice;
  const costUsd = Number(Math.abs(notional - rawNotional).toFixed(4));
  return { shares, priceUsd: px, costUsd, spentUsd: notional };
}

export function fillStatusFor(ok: boolean): PaperFillStatus {
  return ok ? "simulated_filled" : "planned";
}

export function perTradeRiskUsd(navUsd = START_USD) {
  return roundUsd(navUsd * (PER_TRADE_RISK_PCT / 100));
}

/** Stop in USD je Stück: vorläufig fester Abstand, nicht ATR. */
export function stopLevelUsd(costUsd: number, stopPct = STOP_PCT_DEFAULT) {
  return roundUsd(costUsd * (1 - stopPct / 100));
}

export function positionStopHit(args: { shares: number; lastUsd: number; costUsd: number; navUsd?: number }) {
  if (args.shares <= 0) return false;
  const pnlUsd = args.shares * (args.lastUsd - args.costUsd);
  return pnlUsd <= -perTradeRiskUsd(args.navUsd);
}

/** Gap: Ausführung zum vorliegenden Kurs, nicht zum Stop. */
export function gapFillPrice(args: { lastUsd: number; stopUsd: number; side: "buy" | "sell" }) {
  if (args.side === "sell") {
    return args.lastUsd < args.stopUsd ? args.lastUsd : args.stopUsd;
  }
  return args.lastUsd > args.stopUsd ? args.lastUsd : args.stopUsd;
}

export function reservedCashUsd(fills: PaperFill[] | undefined) {
  return (fills ?? [])
    .filter((f) => f.status === "planned" && f.side === "buy")
    .reduce((a, f) => a + Math.abs(f.reservedUsd ?? f.cashDeltaUsd ?? 0), 0);
}

export function cashSplit(args: { cashUsd: number; fills?: PaperFill[] }) {
  const totalUsd = args.cashUsd;
  const reservedUsd = reservedCashUsd(args.fills);
  const availableUsd = Math.max(0, totalUsd - reservedUsd);
  return {
    totalUsd: roundUsd(totalUsd),
    reservedUsd: roundUsd(reservedUsd),
    availableUsd: roundUsd(availableUsd),
  };
}

export function actualEquityWeightPct(positions: DemoPosition[], navUsd: number) {
  if (navUsd <= 0) return 0;
  const eq = equityUsd(positions.filter((p) => p.shares > 0));
  if (eq <= 0) return 0;
  return Number(((eq / navUsd) * 100).toFixed(2));
}

/** Positionsgröße aus Risiko, Cap und freiem Cash. Restkasse ist kein Auslöser. */
export function riskSizeUsd(args: {
  navUsd: number;
  availableUsd: number;
  capPct: number;
  stopPct?: number;
  heldUsd?: number;
}) {
  const stopPct = args.stopPct ?? STOP_PCT_DEFAULT;
  const riskBudget = perTradeRiskUsd(args.navUsd);
  const fromStop = stopPct > 0 ? riskBudget / (stopPct / 100) : 0;
  const room = Math.max(0, args.navUsd * (args.capPct / 100) - (args.heldUsd ?? 0));
  return roundUsd(Math.max(0, Math.min(fromStop, room, args.availableUsd)));
}
