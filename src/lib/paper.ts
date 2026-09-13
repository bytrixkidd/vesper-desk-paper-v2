import type { Bar, BookStrategy, DemoPosition, DemoStandup, DemoWatch, DemoWeek, HarvestEvent, StrategySleeve } from "./types.ts";
import {
  CFG_VERSION as CONFIG_VERSION,
  COST_BPS as CONFIG_COST_BPS,
  DEFAULT_EUR_USD as CONFIG_FX,
  REL_LOSS_CAP as CONFIG_REL,
  START_USD as CONFIG_START,
} from "./config.ts";
import { applySideCost } from "./costs.ts";

/** Testlauf. 300 US-Dollar digital, kein Echtgeld. Später Größe — nicht jetzt. */
export const START_USD = CONFIG_START;
export const DEFAULT_EUR_USD = CONFIG_FX;
export const START_EUR = Number((START_USD / DEFAULT_EUR_USD).toFixed(2));
export const REL_LOSS_CAP = CONFIG_REL;
export const COST_BPS = CONFIG_COST_BPS;
export const CFG_VERSION = CONFIG_VERSION;
export const PROGRAM_START = "2026-08-23";
export const PROGRAM_END = "2026-11-23";
export const WATCH_DAYS = 7;

/** Alte Nachweis-Größe auf 26k. Gilt nicht für den 300-$-Test. */
export const MONTHLY_NET_EUR = 6;
export const MONTHLY_STRETCH_EUR = 12;
export const MONTHLY_HORIZON_EUR = 25;
export const LIFE_NET_EUR = 5_000;
export const LIFE_STRETCH_EUR = 20_000;
export const PROOF_WEEKS = 4;
export const CONFIRM_WEEKS = 8;
export const TAX_RATE = 0.26375;
export const GROSS_MONTHLY_EUR = MONTHLY_NET_EUR / (1 - TAX_RATE);
export const LIVE_NOTIONAL_EUR = START_EUR;
export const TEST_BOOK_MAX_EUR = 800;

export function isTestBook(startEur: number) {
  return startEur >= 40 && startEur < TEST_BOOK_MAX_EUR;
}

export function eurFromUsd(usd: number, eurUsd = DEFAULT_EUR_USD) {
  return eurUsd > 0 ? usd / eurUsd : usd;
}

export function usdFromEur(eur: number, eurUsd = DEFAULT_EUR_USD) {
  return eur * (eurUsd || 1);
}

export const DIVIDEND_YIELD: Record<string, number> = {
  SPY: 0.012,
  VOO: 0.013,
  BLK: 0.021,
  AVGO: 0.009,
  NVDA: 0.0003,
  LLY: 0.006,
  MSFT: 0.007,
  AAPL: 0.004,
  AMZN: 0,
  GOOGL: 0.003,
  JPM: 0.021,
  GS: 0.016,
  META: 0.003,
  UNH: 0.024,
  TSLA: 0,
};

export function programProgress(now = new Date()) {
  const start = Date.parse(`${PROGRAM_START}T00:00:00+02:00`);
  const end = Date.parse(`${PROGRAM_END}T00:00:00+01:00`);
  const t = now.getTime();
  const span = Math.max(1, end - start);
  const elapsed = Math.min(1, Math.max(0, (t - start) / span));
  const daysTotal = Math.round(span / 86_400_000);
  const daysLeft = Math.max(0, Math.ceil((end - t) / 86_400_000));
  const daysDone = Math.min(daysTotal, Math.max(0, daysTotal - daysLeft));
  return { elapsed, daysTotal, daysLeft, daysDone, start: PROGRAM_START, end: PROGRAM_END, cap: REL_LOSS_CAP };
}

export function sleeveOf(ticker: string): DemoPosition["sleeve"] {
  if (ticker === "SPY" || ticker === "VOO") return "core";
  if (ticker === "BLK") return "toll";
  return "overlay";
}

export function replayWindow(spyBars: Bar[], tradingDays = WATCH_DAYS): { date: string }[] {
  const days = [...new Set((spyBars ?? []).map((b) => b.t.slice(0, 10)))].sort();
  return days.slice(-tradingDays).map((date) => ({ date }));
}

export function windowKey(window: { date: string }[]): string {
  if (window.length === 0) return "";
  return `${window[0]!.date}:${window[window.length - 1]!.date}`;
}

export function barOn(bars: Bar[] | undefined, date: string): Bar | null {
  if (!bars) return null;
  return bars.find((b) => b.t.slice(0, 10) === date) ?? null;
}

export function priorClose(bars: Bar[] | undefined, date: string, fallback: number): number {
  if (!bars || bars.length === 0) return fallback;
  const prior = bars.filter((b) => b.t.slice(0, 10) < date);
  return prior.at(-1)?.c ?? bars[0]!.o;
}

export function allocateBook(
  strategy: BookStrategy,
  last: Record<string, number>,
  eurUsd: number,
  cashEur: number,
): DemoPosition[] {
  const navUsd = cashEur * eurUsd;
  return strategy.sleeves
    .filter((s) => s.weightPct > 0 && last[s.ticker])
    .map((s) => {
      const px = last[s.ticker]!;
      const usd = navUsd * (s.weightPct / 100);
      const fillPx = applySideCost(px, "buy");
      return {
        ticker: s.ticker,
        shares: fillPx > 0 ? usd / fillPx : 0,
        costUsd: fillPx,
        lastUsd: px,
        weightPct: s.weightPct,
        sleeve: sleeveOf(s.ticker),
      };
    });
}

export function markPositions(positions: DemoPosition[], last: Record<string, number>): DemoPosition[] {
  return positions.map((p) => {
    const px = last[p.ticker] ?? p.lastUsd;
    return { ...p, lastUsd: px };
  });
}

export function navUsd(positions: DemoPosition[], cashEur: number, eurUsd: number) {
  const eq = positions.reduce((a, p) => a + p.shares * p.lastUsd, 0);
  return eq + cashEur * eurUsd;
}

export function toEur(usd: number, eurUsd: number) {
  return eurUsd ? usd / eurUsd : usd;
}

export function applyDayMarks(
  positions: DemoPosition[],
  bars: Record<string, Bar[]>,
  date: string,
): { positions: DemoPosition[]; session: boolean } {
  let session = false;
  const next = positions.map((p) => {
    const bar = barOn(bars[p.ticker], date);
    if (!bar) return p;
    session = true;
    return { ...p, lastUsd: bar.c };
  });
  return { positions: next, session };
}

export function rebalanceTo(
  strategy: BookStrategy,
  positions: DemoPosition[],
  cashEur: number,
  eurUsd: number,
): { positions: DemoPosition[]; cashEur: number } {
  const last: Record<string, number> = {};
  for (const p of positions) last[p.ticker] = p.lastUsd;
  const usd = navUsd(positions, cashEur, eurUsd);
  const eur = toEur(usd, eurUsd);
  const next = allocateBook(strategy, last, eurUsd, eur);
  const used = next.reduce((a, p) => a + p.shares * p.lastUsd, 0);
  const leftoverUsd = Math.max(0, usd - used);
  return { positions: next, cashEur: eurUsd ? leftoverUsd / eurUsd : leftoverUsd };
}

export function trimOverlay(positions: DemoPosition[]): DemoPosition[] {
  const overlay = positions.filter((p) => p.sleeve === "overlay");
  const freed = overlay.reduce((a, p) => a + p.shares * p.lastUsd * 0.5, 0);
  const spy = positions.find((p) => p.ticker === "SPY");
  return positions.map((p) => {
    if (p.sleeve === "overlay") return { ...p, shares: p.shares * 0.5 };
    if (p.ticker === "SPY" && spy && spy.lastUsd > 0) return { ...p, shares: p.shares + freed / spy.lastUsd };
    return p;
  });
}

export function addToCore(positions: DemoPosition[]): DemoPosition[] {
  const overlayNav = positions.filter((p) => p.sleeve === "overlay").reduce((a, p) => a + p.shares * p.lastUsd, 0);
  const take = overlayNav * 0.1;
  if (take <= 0) return positions;
  const factor = overlayNav ? (overlayNav - take) / overlayNav : 1;
  const spy = positions.find((p) => p.ticker === "SPY");
  const voo = positions.find((p) => p.ticker === "VOO");
  const spyAdd = take * (22 / 35);
  const vooAdd = take * (13 / 35);
  return positions.map((p) => {
    if (p.sleeve === "overlay") return { ...p, shares: p.shares * factor };
    if (p.ticker === "SPY" && spy && spy.lastUsd > 0) return { ...p, shares: p.shares + spyAdd / spy.lastUsd };
    if (p.ticker === "VOO" && voo && voo.lastUsd > 0) return { ...p, shares: p.shares + vooAdd / voo.lastUsd };
    return p;
  });
}

export function flattenTicker(positions: DemoPosition[], ticker: string): { positions: DemoPosition[]; cashUsd: number } {
  const row = positions.find((p) => p.ticker === ticker);
  if (!row || row.shares <= 0) {
    return { positions, cashUsd: 0 };
  }
  const px = applySideCost(row.lastUsd, "sell");
  const cashUsd = row.shares * px;
  return {
    positions: positions.map((p) => (p.ticker === ticker ? { ...p, shares: 0, weightPct: 0 } : p)),
    cashUsd,
  };
}

export function withWeights(positions: DemoPosition[], cashEur: number, eurUsd: number): DemoPosition[] {
  const n = navUsd(positions, cashEur, eurUsd);
  return positions.map((p) => ({
    ...p,
    weightPct: n ? Number((((p.shares * p.lastUsd) / n) * 100).toFixed(2)) : 0,
  }));
}

export function snapshot(watch: Pick<DemoWatch, "startEur" | "navEur" | "spyStart" | "spyLast">) {
  const bookPct = watch.startEur ? ((watch.navEur - watch.startEur) / watch.startEur) * 100 : 0;
  const spyPct = watch.spyStart ? ((watch.spyLast - watch.spyStart) / watch.spyStart) * 100 : 0;
  return {
    bookPct: Number(bookPct.toFixed(3)),
    spyPct: Number(spyPct.toFixed(3)),
    relativePct: Number((bookPct - spyPct).toFixed(3)),
  };
}

export function localStandupNote(args: {
  day: number;
  date: string;
  session: boolean;
  bookPct: number;
  spyPct: number;
  relativePct: number;
  navEur: number;
}): string {
  const rel = args.relativePct;
  const vs = rel >= 0 ? `Spread +${rel.toFixed(2)} pp vs SPY` : `Spread ${rel.toFixed(2)} pp vs SPY`;
  if (!args.session) {
    return `Tag ${args.day}/7 · ${args.date} · Märkte zu. Book ${args.navEur.toFixed(2)} € unbewegt. ${vs}. 24h-Watch läuft.`;
  }
  if (rel < -2) {
    return `Tag ${args.day}/7 · ${args.date}. Book ${args.bookPct.toFixed(2)} % gegen SPY ${args.spyPct.toFixed(2)} %. ${vs}. Overlay prüfen, Kern nicht anfassen.`;
  }
  if (rel >= 0) {
    return `Tag ${args.day}/7 · ${args.date}. Book ${args.bookPct.toFixed(2)} % gegen SPY ${args.spyPct.toFixed(2)} %. ${vs}. Live-Add nur nach Chart-Blick.`;
  }
  return `Tag ${args.day}/7 · ${args.date}. Book ${args.bookPct.toFixed(2)} % gegen SPY ${args.spyPct.toFixed(2)} %. ${vs}. Unter dem Bench, im 5-%-Budget.`;
}

export function makeStandup(partial: Omit<DemoStandup, "id">): DemoStandup {
  return { ...partial, id: `su-${partial.at}-${partial.day}` };
}

export function netFromGross(gross: number) {
  return gross * (1 - TAX_RATE);
}

export function taxFromGross(gross: number) {
  return gross * TAX_RATE;
}

export function berlinYmd(input: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(input);
}

export function monthKey(input: Date = new Date()) {
  return berlinYmd(input).slice(0, 7);
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const names = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];
  return `${names[Number(m) - 1] ?? m} ${y}`;
}

export function daysInMonth(now = new Date()) {
  const [y, m] = berlinYmd(now).split("-").map(Number);
  return new Date(Date.UTC(y ?? 2026, m ?? 1, 0)).getUTCDate();
}

export function daysLeftInMonth(now = new Date()) {
  const [y, m, day] = berlinYmd(now).split("-").map(Number);
  const last = new Date(Date.UTC(y ?? 2026, m ?? 1, 0)).getUTCDate();
  return Math.max(0, last - (day ?? 1) + 1);
}

export function blendedYield(sleeves: StrategySleeve[]) {
  return sleeves.reduce((acc, s) => acc + (s.weightPct / 100) * (DIVIDEND_YIELD[s.ticker] ?? 0), 0);
}

export function monthlyGrossRate(demos: Pick<DemoWeek, "bookPct" | "generated">[]) {
  const last = demos.filter((d) => d.generated).slice(0, 4);
  if (last.length < 4) return 0;
  let c = 1;
  for (const d of last) c *= 1 + d.bookPct / 100;
  return Math.pow(c, 4.345 / last.length) - 1;
}

export function capitalForMonthlyNet(monthlyGross: number, target = MONTHLY_NET_EUR) {
  const netRate = monthlyGross * (1 - TAX_RATE);
  if (netRate <= 0) return Number.POSITIVE_INFINITY;
  return target / netRate;
}

/** Brutto-Monatsquote des 300-$-Tests, nur Maßstab für spätere Größe. */
export function proofGrossRate() {
  return START_EUR > 0 ? GROSS_MONTHLY_EUR / START_EUR : 0;
}

export function lifeCapitalNeeded(targetNet: number, monthlyGross = proofGrossRate()) {
  return capitalForMonthlyNet(monthlyGross, targetNet);
}

export type PlanStep = {
  id: number;
  title: string;
  detail: string;
  status: "done" | "active" | "locked";
};

export function planSteps(generatedCount: number, winCount: number): PlanStep[] {
  const s1 = generatedCount >= PROOF_WEEKS;
  const s2 = generatedCount >= CONFIRM_WEEKS && winCount >= 6;
  return [
    {
      id: 1,
      title: "Testlauf 300 $",
      detail: `${START_USD.toLocaleString("de-DE")} $ Paper, echte Kurse. Kaufen, mitnehmen, wieder einsetzen. Kein Echtgeld.`,
      status: "done",
    },
    {
      id: 2,
      title: "Vier Wochen rechnen",
      detail: `${Math.min(generatedCount, PROOF_WEEKS)}/${PROOF_WEEKS} Wochen gegen das Tape. Steht der Stand über 300 $?`,
      status: s1 ? "done" : "active",
    },
    {
      id: 3,
      title: "Acht Wochen Nachweis",
      detail: `Die Quote muss auf 300 $ wirklich arbeiten. ${generatedCount}/${CONFIRM_WEEKS} Wochen, ${winCount} im Plus.`,
      status: s2 ? "done" : s1 ? "active" : "locked",
    },
    {
      id: 4,
      title: "Größe für 5.000 €",
      detail: `Bei derselben Quote rund ${Math.round(lifeCapitalNeeded(LIFE_NET_EUR) / 1000) * 1000} € Einsatz. Erst nach dem Test. Immer noch digital.`,
      status: s2 ? "active" : "locked",
    },
    {
      id: 5,
      title: "20.000 € im Monat",
      detail: `Vier Mal so viel Einsatz. Nicht dieses Jahr erzwingen, nicht mit 300 $.`,
      status: "locked",
    },
  ];
}

export function diagnoseCompletedWeek(week: Pick<DemoWeek, "bookPct" | "spyPct" | "relativePct" | "trades" | "navEur" | "startEur">) {
  const help = [...week.trades].filter((t) => t.pnlPct > 0.25).sort((a, b) => b.pnlPct - a.pnlPct).slice(0, 2);
  const hurt = [...week.trades].filter((t) => t.pnlPct < -0.25).sort((a, b) => a.pnlPct - b.pnlPct).slice(0, 2);
  const net = week.navEur - week.startEur;
  const vs = week.relativePct >= 0 ? "über" : "unter";
  const money = `${net >= 0 ? "+" : ""}${net.toFixed(0)} € digital`;
  const paid = help.length ? `Gezogen: ${help.map((t) => `${t.ticker} ${t.pnlPct >= 0 ? "+" : ""}${t.pnlPct.toFixed(1)} %`).join(", ")}.` : "Kein klarer Gewinner.";
  const lost = hurt.length ? `Gedrückt: ${hurt.map((t) => `${t.ticker} ${t.pnlPct.toFixed(1)} %`).join(", ")}.` : "Kein klarer Verlierer.";
  return `Paper ${money} (${week.bookPct >= 0 ? "+" : ""}${week.bookPct.toFixed(2)} %), ${vs} dem Markt (${week.relativePct >= 0 ? "+" : ""}${week.relativePct.toFixed(2)} pp). ${paid} ${lost} Kein Echtgeld.`;
}

export function lifeGoalLine(args: { generatedCount: number; monthlyGross: number }) {
  const need5 = lifeCapitalNeeded(LIFE_NET_EUR);
  const need20 = lifeCapitalNeeded(LIFE_STRETCH_EUR);
  const observed =
    args.monthlyGross > 0 ? lifeCapitalNeeded(LIFE_NET_EUR, args.monthlyGross) : null;
  const weeks = args.generatedCount;
  const wait =
    weeks < PROOF_WEEKS
      ? `Zuerst ${PROOF_WEEKS - weeks} Paper-Woche${PROOF_WEEKS - weeks === 1 ? "" : "n"} mit 300 Dollar gegen echte Kurse.`
      : weeks < CONFIRM_WEEKS
        ? `Quote steht in den ersten Wochen. Noch ${CONFIRM_WEEKS - weeks} Wochen Nachweis, dann erst über Größe reden.`
        : "Nachweis steht. Nächster Schritt ist Größe, nicht eine neue Strategie.";
  const obs =
    observed && Number.isFinite(observed)
      ? ` Bei der bisher gerechneten Quote wären es rund ${Math.round(observed / 1000)} Tausend Euro Einsatz für 5.000 Euro netto.`
      : "";
  return [
    `Ziel später: ${LIFE_NET_EUR.toLocaleString("de-DE")} Euro netto im Monat. Jetzt: Testlauf ${START_USD} Dollar.`,
    `Auf 300 Dollar sind 5.000 Euro im Monat kein seriöses Ziel — das braucht Größe, nicht eine andere Anzeige.`,
    `Dieselbe Quote braucht rund ${Math.round(need5 / 1000)} Tausend Euro Einsatz für 5.000, rund ${Math.round(need20 / 100000) / 10} Millionen für 20.000.`,
    wait,
    `Es bleibt Spielgeld.${obs} Echtgeld gibt es in dieser App nicht.`,
  ].join(" ");
}

export function harvestFromReturn(notional: number, bookPct: number) {
  const gross = notional * (bookPct / 100);
  if (gross <= 0) return { grossEur: 0, taxEur: 0, netEur: 0 };
  return {
    grossEur: Number(gross.toFixed(2)),
    taxEur: Number(taxFromGross(gross).toFixed(2)),
    netEur: Number(netFromGross(gross).toFixed(2)),
  };
}

export function markLiveBook(
  watch: DemoWatch,
  last: Record<string, number>,
  eurUsd: number,
): DemoWatch {
  const positions = markPositions(watch.positions, last);
  const spyLast = last.SPY ?? watch.spyLast;
  const nav = toEur(navUsd(positions, watch.cashEur, eurUsd), eurUsd);
  const snap = snapshot({ startEur: watch.startEur, navEur: nav, spyStart: watch.spyStart, spyLast });
  return {
    ...watch,
    eurUsd,
    spyLast,
    positions: withWeights(positions, watch.cashEur, eurUsd),
    navEur: Number(nav.toFixed(4)),
    ...snap,
  };
}

export function paperHonestyLine(args: {
  navEur: number;
  bookPct: number;
  tapeSource: string | null;
  generatedWeeks: number;
}) {
  const tape = args.tapeSource === "yahoo" ? "echten Schlusskursen" : "hinterlegten Schlusskursen";
  const move =
    Math.abs(args.bookPct) < 0.05
      ? "Es hat sich kaum bewegt."
      : args.bookPct > 0
        ? `Paper steht rund ${args.bookPct.toFixed(1)} Prozent über dem Start.`
        : `Paper steht rund ${Math.abs(args.bookPct).toFixed(1)} Prozent unter dem Start.`;
  const weeks =
    args.generatedWeeks > 0
      ? ` ${args.generatedWeeks} Woche${args.generatedWeeks === 1 ? "" : "n"} wurden gegen das Tape gerechnet.`
      : " Lehrwochen in der Liste sind Beispiele, kein Gewinn.";
  return `Kein Echtgeld. Digitaler Einsatz ${START_USD} Dollar, gerechnet mit ${tape}. ${move}${weeks} Realisierter Gewinn bleibt im Book und trägt erneut Risiko. 5.000 Euro im Monat sind ein späteres Szenario, kein Ergebnis dieses Tests.`;
}

export function monthTotals(harvests: HarvestEvent[], key = monthKey()) {
  const rows = harvests.filter((h) => h.month === key && !h.lesson);
  const harvestedNet = rows.reduce((a, h) => a + h.netEur, 0);
  const harvestedGross = rows.reduce((a, h) => a + h.grossEur, 0);
  const gap = Math.max(0, MONTHLY_NET_EUR - harvestedNet);
  return {
    month: key,
    rows,
    harvestedNet: Number(harvestedNet.toFixed(2)),
    harvestedGross: Number(harvestedGross.toFixed(2)),
    gap: Number(gap.toFixed(2)),
    hit: harvestedNet >= MONTHLY_NET_EUR,
    pct: Math.min(100, (harvestedNet / MONTHLY_NET_EUR) * 100),
    stretchPct: Math.min(100, (harvestedNet / MONTHLY_STRETCH_EUR) * 100),
  };
}

export function projectMonthEnd(
  harvestedNet: number,
  monthlyGross: number,
  notional: number,
  now = new Date(),
) {
  const left = daysLeftInMonth(now);
  const total = daysInMonth(now);
  const remainingFrac = total > 0 ? left / total : 0;
  const remainingNet = Math.max(0, notional * monthlyGross * remainingFrac * (1 - TAX_RATE));
  return Number((harvestedNet + remainingNet).toFixed(2));
}

export function abortDecision(args: {
  harvestedNet: number;
  projectedNet: number;
  liveStatus: "live" | "abort";
  generatedWeeks?: number;
}) {
  if (args.liveStatus === "abort") {
    return {
      status: "abort" as const,
      kill: true,
      reason: "Manuell pausiert. Overlay bleibt flach, bis du wieder startest. 300-$-Test, kein Monatsboden.",
    };
  }
  return {
    status: "live" as const,
    kill: false,
    reason: "Testlauf 300 $. Gewinn bleibt im Book und wird wieder eingesetzt. Overlay nur kürzen, wenn das Book klar hinter dem Markt liegt.",
  };
}

export function makeHarvest(partial: Omit<HarvestEvent, "id">): HarvestEvent {
  return { ...partial, id: `h-${partial.at}-${partial.week ?? partial.source}` };
}

export function bookView(args: {
  startEur?: number;
  navEur?: number;
  cashEur?: number;
  eurUsd?: number;
  spyPct?: number;
  relativePct?: number;
  harvestedNet?: number;
}) {
  const eurUsd = args.eurUsd && args.eurUsd > 0 ? args.eurUsd : DEFAULT_EUR_USD;
  const hasStart = args.startEur != null && args.startEur > 0;
  const cash = args.cashEur ?? 0;
  if (!hasStart) {
    return {
      ready: false,
      deposited: START_EUR,
      nav: 0,
      pnl: 0,
      cashEur: 0,
      eurUsd,
      depositedUsd: START_USD,
      navUsd: 0,
      pnlUsd: 0,
      cashUsd: 0,
      pnlPct: 0,
      spyPct: args.spyPct ?? 0,
      relativePct: args.relativePct ?? 0,
      harvestedNet: args.harvestedNet ?? 0,
    };
  }
  const deposited = args.startEur!;
  const nav = args.navEur != null && args.navEur > 0 ? args.navEur : deposited;
  const pnl = nav - deposited;
  const pnlPct = deposited ? (pnl / deposited) * 100 : 0;
  const depositedUsdRaw = usdFromEur(deposited, eurUsd);
  const depositedUsd = isTestBook(deposited) ? START_USD : depositedUsdRaw;
  const navUsdValue = usdFromEur(nav, eurUsd);
  return {
    ready: true,
    deposited,
    nav,
    pnl,
    cashEur: cash,
    eurUsd,
    depositedUsd,
    navUsd: navUsdValue,
    pnlUsd: navUsdValue - depositedUsd,
    cashUsd: usdFromEur(cash, eurUsd),
    pnlPct: Number(pnlPct.toFixed(3)),
    spyPct: args.spyPct ?? 0,
    relativePct: args.relativePct ?? 0,
    harvestedNet: args.harvestedNet ?? 0,
  };
}

export function positionPnlEur(shares: number, lastUsd: number, costUsd: number, eurUsd: number) {
  if (!eurUsd) return 0;
  return (shares * (lastUsd - costUsd)) / eurUsd;
}
