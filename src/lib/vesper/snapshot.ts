import { changePct, pickBar } from "@/lib/explain";
import { formatPct, formatUsd } from "@/lib/format";
import { monthKey, monthTotals, projectMonthEnd, monthlyGrossRate, START_USD, usdFromEur } from "@/lib/paper";
import { useDeskStore } from "@/lib/store";
import type { Bar } from "@/lib/types";

export type DeskSnap = {
  asOf: string;
  tapeSource: string | null;
  sessionLabel: string;
  liveStatus: string;
  harvestedNet: number;
  projectedNet: number;
  floor: number;
  watch: string | null;
  deposited: number;
  nav: number;
  pnl: number;
  spyLast: number | null;
  spyChange: number | null;
  alerts: { ts: string; severity: string; ticker?: string; headline: string }[];
  bots: { id: string; name: string; summary: string }[];
  filings: { id: string; ticker: string; form: string; title: string; filedAt: string; delta: string }[];
  earnings: { ticker: string; date: string; summary: string; guidance: string }[];
  sentiment: { ticker: string; zscore: number; tone: number; flag: boolean }[];
  ideas: { ticker: string; bot: string; thesis: string; status: string }[];
  lessons: { mistake: string; fix: string }[];
  floorTail: { author: string; text: string }[];
  tape: Record<string, Bar[]>;
};

export function buildSnapshot(): DeskSnap {
  const s = useDeskStore.getState();
  const month = monthKey();
  const totals = monthTotals(s.harvests, month);
  const projected = projectMonthEnd(totals.harvestedNet, monthlyGrossRate(s.demos), s.liveNotional);
  const spyBars = s.tape.SPY ?? [];
  const last = spyBars.at(-1);
  const prev = spyBars.at(-2);
  return {
    asOf: s.tapeAsOf ?? new Date().toISOString(),
    tapeSource: s.tapeSource,
    sessionLabel: s.sessionLabel,
    liveStatus: s.liveStatus,
    harvestedNet: totals.harvestedNet,
    projectedNet: projected,
    floor: START_USD,
    watch: s.watch
      ? `Eingezahlt ${formatUsd(usdFromEur(s.watch.startEur, s.watch.eurUsd))}, Stand ${formatUsd(usdFromEur(s.watch.navEur, s.watch.eurUsd))}, Gewinn ${formatUsd(usdFromEur(s.watch.navEur - s.watch.startEur, s.watch.eurUsd))}. Tag ${s.watch.day} von 7. Kein Echtgeld.`
      : null,
    deposited: s.watch ? usdFromEur(s.watch.startEur, s.watch.eurUsd) : START_USD,
    nav: s.watch ? usdFromEur(s.watch.navEur, s.watch.eurUsd) : 0,
    pnl: s.watch ? usdFromEur(s.watch.navEur - s.watch.startEur, s.watch.eurUsd) : 0,
    spyLast: last?.c ?? s.watchlist.find((t) => t.symbol === "SPY")?.last ?? null,
    spyChange: last && prev ? changePct(last, prev) : s.watchlist.find((t) => t.symbol === "SPY")?.changePct ?? null,
    alerts: s.alerts.slice(0, 6).map((a) => ({
      ts: a.ts,
      severity: a.severity,
      ticker: a.ticker,
      headline: a.headline,
    })),
    bots: s.bots.slice(0, 12).map((b) => ({ id: b.id, name: b.name, summary: b.summary })),
    filings: s.filings.slice(0, 6).map((f) => ({
      id: f.id,
      ticker: f.ticker,
      form: f.form,
      title: f.title,
      filedAt: f.filedAt,
      delta: f.delta,
    })),
    earnings: s.earnings.slice(0, 5).map((e) => ({
      ticker: e.ticker,
      date: e.date,
      summary: e.summary,
      guidance: e.guidance,
    })),
    sentiment: s.sentiment.slice(0, 8).map((r) => ({
      ticker: r.ticker,
      zscore: r.zscore,
      tone: r.tone,
      flag: r.flag,
    })),
    ideas: s.ideas.slice(0, 6).map((i) => ({ ticker: i.ticker, bot: i.bot, thesis: i.thesis, status: i.status })),
    lessons: s.lessons.slice(0, 4).map((l) => ({ mistake: l.mistake, fix: l.fix })),
    floorTail: s.messages.slice(-6).map((m) => ({ author: m.author, text: m.text.slice(0, 220) })),
    tape: s.tape,
  };
}

export function compactSnapshot(snap: DeskSnap) {
  return [
    `Tape ${snap.tapeSource ?? "unbekannt"} · ${snap.sessionLabel}`,
    `Kein Echtgeld. Digitaler Einsatz ${START_USD} Dollar. Stand ${formatUsd(snap.nav)}, Gewinn ${formatUsd(snap.pnl)}. Tape ${snap.tapeSource ?? "lokal"}.`,
    snap.watch ? `Demo-Prüfung: ${snap.watch}` : "Keine laufende Demo-Prüfung.",
    snap.spyLast != null ? `Breiter US-Markt ${snap.spyLast.toFixed(2)} (${formatPct(snap.spyChange ?? 0)})` : "",
    "Alerts:",
    ...snap.alerts.map((a) => `- [${a.severity}] ${a.ticker ?? ""} ${a.headline}`),
    "Bots:",
    ...snap.bots.map((b) => `- ${b.name}: ${b.summary}`),
    "Filings:",
    ...snap.filings.map((f) => `- ${f.ticker} ${f.form} ${f.title} (${f.filedAt.slice(0, 10)}) ${f.delta}`),
    "Earnings:",
    ...snap.earnings.map((e) => `- ${e.ticker} ${e.date} ${e.guidance} ${e.summary}`),
    "Sentiment-Flags:",
    ...snap.sentiment.filter((r) => r.flag).map((r) => `- ${r.ticker} z=${r.zscore.toFixed(1)}`),
    "Lessons:",
    ...snap.lessons.map((l) => `- ${l.mistake} → ${l.fix}`),
  ]
    .filter(Boolean)
    .join("\n");
}

export function worstDrop(bars: Bar[]): { iso: string; pct: number } | null {
  let worst: { iso: string; pct: number } | null = null;
  for (let i = 1; i < bars.length; i++) {
    const pct = changePct(bars[i]!, bars[i - 1]);
    if (!worst || pct < worst.pct) worst = { iso: bars[i]!.t.slice(0, 10), pct };
  }
  return worst;
}

export function lastDrop(bars: Bar[], threshold = -0.8): { iso: string; pct: number } | null {
  for (let i = bars.length - 1; i >= 1; i--) {
    const pct = changePct(bars[i]!, bars[i - 1]);
    if (pct <= threshold) return { iso: bars[i]!.t.slice(0, 10), pct };
  }
  return worstDrop(bars);
}

export function lastRise(bars: Bar[], threshold = 0.8): { iso: string; pct: number } | null {
  for (let i = bars.length - 1; i >= 1; i--) {
    const pct = changePct(bars[i]!, bars[i - 1]);
    if (pct >= threshold) return { iso: bars[i]!.t.slice(0, 10), pct };
  }
  let best: { iso: string; pct: number } | null = null;
  for (let i = 1; i < bars.length; i++) {
    const pct = changePct(bars[i]!, bars[i - 1]);
    if (!best || pct > best.pct) best = { iso: bars[i]!.t.slice(0, 10), pct };
  }
  return best;
}

export function lastMove(bars: Bar[]): { iso: string; pct: number; dir: "up" | "down" } | null {
  const drop = lastDrop(bars);
  const rise = lastRise(bars);
  if (!drop && !rise) return null;
  if (!drop) return { iso: rise!.iso, pct: rise!.pct, dir: "up" };
  if (!rise) return { iso: drop.iso, pct: drop.pct, dir: "down" };
  const dropIdx = bars.findIndex((b) => b.t.slice(0, 10) === drop.iso);
  const riseIdx = bars.findIndex((b) => b.t.slice(0, 10) === rise.iso);
  if (riseIdx >= dropIdx) return { iso: rise.iso, pct: rise.pct, dir: "up" };
  return { iso: drop.iso, pct: drop.pct, dir: "down" };
}

export { pickBar };
