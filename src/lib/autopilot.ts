import {
  abortDecision,
  daysLeftInMonth,
  LIVE_NOTIONAL_EUR,
  MONTHLY_NET_EUR,
  MONTHLY_STRETCH_EUR,
  monthKey,
  monthLabel,
  monthTotals,
  monthlyGrossRate,
  projectMonthEnd,
  REL_LOSS_CAP,
} from "@/lib/paper";
import { WEEKLY_BRIEF } from "@/lib/seed-book";
import type {
  AutoEvent,
  DeskId,
  DemoWatch,
  DemoWeek,
  FloorAuthor,
  HarvestEvent,
  Insight,
  Lesson,
  LiveStatus,
  MorningBrief,
  ProfileProposal,
  Ticker,
  TradeIdea,
  TradeTrial,
  WeeklyBrief,
} from "@/lib/types";

export const TICK_MS = 1000;
export const CATCH_UP_MAX = 2;
const PREF_KEY = "vesper-auto-v1";

export const PULSE_ORDER: FloorAuthor[] = [
  "ledger",
  "cart",
  "audit",
  "pulse",
  "till",
  "vein",
  "forge",
  "skipper",
  "score",
  "meridian",
  "anvil",
  "canon",
  "signal",
  "scout",
  "drift",
  "gauge",
  "callbook",
  "edict",
  "prism",
];

export function readAutoPref(): { on: boolean; lastTick: string | null } {
  if (typeof window === "undefined") return { on: true, lastTick: null };
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return { on: true, lastTick: null };
    const parsed = JSON.parse(raw) as { on?: boolean; lastTick?: string | null };
    return { on: parsed.on !== false, lastTick: parsed.lastTick ?? null };
  } catch {
    return { on: true, lastTick: null };
  }
}

export function writeAutoPref(on: boolean, lastTick: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify({ on, lastTick }));
  } catch {
    /* ignore quota */
  }
}

export function makeAutoEvent(bot: FloorAuthor, desk: DeskId, text: string, at = new Date().toISOString()): AutoEvent {
  return { id: `auto-${at}-${bot}`, at, bot, desk, text };
}

function topMover(watchlist: Ticker[]) {
  return watchlist.slice().sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0] ?? watchlist[0];
}

function quietName(watchlist: Ticker[]) {
  return watchlist.slice().sort((a, b) => Math.abs(a.changePct) - Math.abs(b.changePct))[0] ?? watchlist[0];
}

export function pulseSummary(bot: FloorAuthor, watchlist: Ticker[], tick: number, watch: DemoWatch | null): string {
  const hot = topMover(watchlist);
  const quiet = quietName(watchlist);
  const w = watch
    ? `Watch Tag ${watch.day}/7, NAV ${watch.navEur.toFixed(2)} €, relativ ${watch.relativePct.toFixed(2)} pp.`
    : "Watch startet.";
  const px = hot
    ? `${hot.symbol} ${hot.changePct >= 0 ? "+" : ""}${hot.changePct.toFixed(2)} %`
    : "Tape leer";
  const q = quiet ? `${quiet.symbol} ${quiet.changePct >= 0 ? "+" : ""}${quiet.changePct.toFixed(2)} %` : "";
  const map: Partial<Record<FloorAuthor, string>> = {
    ledger: `Filings-Raster. ${px}. Kein neues 8-K im Autopilot — Bestand gilt. ${w}`,
    cart: `Konsum. ${px}. Discretionary bleibt draußen. Zahler zuerst. ${w}`,
    audit: `IB-Pläne laufen durch. Fehler werden in die Demo geschickt, nicht live. ${w}`,
    pulse: `Mentions. ${px} ist der laute Name. Sentiment allein kein Entry. ${w}`,
    till: `Banken. JPM/GS tragen die Dividende. Add nur auf Schwäche. ${w}`,
    vein: `Overlooked: ${q || "ruhige Namen"} — was die Häuser nicht schreiben. ${w}`,
    forge: `Post-Mortem Autopilot-Tick ${tick}. Paper darf Fehler machen. Live nicht. ${w}`,
    skipper: `Boden ist der 300-$-Test. Paper 24/7. Kein echtes Geld. ${w}`,
    score: `10J-Quote gegen SPY. Korrektur nur in der Trading-Demo. ${w}`,
    meridian: `Sektor. Kern SPY/VOO/BLK unangetastet. Overlay nur nach Chart. ${w}`,
    anvil: `Trade-Demo prüft, ob die Idee den Spread zahlt. ${w}`,
    canon: `Weekly hängt am Autopilot. Profile und Inklusion gehen in den Sonntagsbrief. ${w}`,
    signal: `Social. ${px} ist Lärm, wenn kein Filing. ${w}`,
    scout: `Korrektur der Häuserpläne. Verbesserte Sleeve in die Demo. ${w}`,
    drift: `Trend. ${px}. Gold und URTH nur Bestätigung, kein Monatshandel. ${w}`,
    gauge: `Kein Modell-Loop. Autopilot lokal. Jede Minute ohne Einnahmen fliegt. ${w}`,
    callbook: `Earnings-Kalender. Overlay nach dem Print, nicht davor. ${w}`,
    edict: `Profilvorschläge aller Teams bleiben im Weekly. ${w}`,
    prism: `Anschauung. Grün steigt, rot fällt. Klick auf den Tag im Chart, Stichpunkte statt Jargon. ${w}`,
  };
  return map[bot] ?? `Tick ${tick}. ${px}. ${w}`;
}

export function localInsight(watchlist: Ticker[], tick: number, at: string): Insight {
  const hot = topMover(watchlist);
  const quiet = quietName(watchlist);
  const overlooked = tick % 2 === 1;
  const bot: FloorAuthor = overlooked ? "vein" : "drift";
  const ticker = (overlooked ? quiet : hot) ?? watchlist[0]!;
  return {
    id: `ins-auto-${at}`,
    at,
    team: "trade",
    bot,
    kind: overlooked ? "overlooked" : "fresh",
    heading: overlooked ? `${ticker.symbol} übersehen` : `${ticker.symbol} frisch`,
    body: overlooked
      ? `${ticker.symbol} bewegt sich kaum (${ticker.changePct.toFixed(2)} %), während der Floor auf den lauten Namen starrt. Paper-Test, kein Live-Size.`
      : `${ticker.symbol} ${ticker.changePct >= 0 ? "+" : ""}${ticker.changePct.toFixed(2)} % auf dem letzten Tape. Autopilot legt eine Paper-Idee, Skipper gibt kein Live frei.`,
    tickers: [ticker.symbol],
    weight: overlooked ? "mid" : "high",
  };
}

export function localIdea(watchlist: Ticker[], tick: number): TradeIdea | null {
  const hot = topMover(watchlist);
  if (!hot) return null;
  const payers = ["JPM", "GS", "AVGO", "UNH", "BLK"];
  const ticker = payers.includes(hot.symbol) ? hot.symbol : payers[tick % payers.length]!;
  const bot: FloorAuthor = ticker === "JPM" || ticker === "GS" ? "till" : ticker === "AVGO" ? "vein" : "cart";
  return {
    id: `idea-auto-${tick}-${ticker}`,
    bot,
    ticker,
    side: "long",
    thesis: `Autopilot-Paper: ${ticker} als Zahler-Test. ${hot.symbol} war der Tape-Mover.`,
    cashNow: "Nur Demo. Keine Live-Size, solange kein echtes Geld fließt.",
    capital: "Kern SPY/VOO/BLK bleibt. Overlay nur nach zwei grünen Watches.",
    status: "open",
  };
}

export function ideaTrial(idea: TradeIdea, spyPct: number, at: string): TradeTrial {
  const bookPct = Number((0.15 + (idea.ticker.charCodeAt(0) % 7) * 0.05).toFixed(2));
  return {
    id: `tt-auto-${at}`,
    week: `T-${idea.ticker}`,
    source: "trade",
    sourceId: idea.id,
    label: `${idea.ticker} Paper`,
    startedAt: at,
    bookPct,
    spyPct: Number(spyPct.toFixed(2)),
    relativePct: Number((bookPct - spyPct).toFixed(2)),
    hit: bookPct >= spyPct,
    note: `${idea.thesis} Autopilot, kein Live.`,
  };
}

export function compileLocalWeekly(args: {
  harvests: HarvestEvent[];
  demos: DemoWeek[];
  watch: DemoWatch | null;
  liveStatus: LiveStatus;
  liveNotional: number;
  proposals: ProfileProposal[];
  lessons: Lesson[];
  trials: TradeTrial[];
  tickCount: number;
}): WeeklyBrief {
  const at = new Date().toISOString();
  const totals = monthTotals(args.harvests);
  const runRate = monthlyGrossRate(args.demos);
  const projected = projectMonthEnd(totals.harvestedNet, runRate, args.liveNotional);
  const decision = abortDecision({
    harvestedNet: totals.harvestedNet,
    projectedNet: projected,
    liveStatus: args.liveStatus,
    generatedWeeks: args.demos.filter((d) => d.generated).length,
  });
  const last = args.demos[0];
  const openLessons = args.lessons.filter((l) => l.status === "open");
  const discuss = args.proposals.filter((p) => p.status === "discuss");
  const hits = args.trials.filter((t) => t.hit).length;
  const w = args.watch;
  return {
    id: `weekly-auto-${at}`,
    weekOf: at.slice(0, 10),
    deliveredAt: at,
    title: `Weekly · Autopilot Tick ${args.tickCount}`,
    lede: `${monthLabel(monthKey())}: Paper ${totals.harvestedNet.toFixed(2)} € realisiert, bleibt im Book. Projektion ${projected.toFixed(0)} €. ${decision.reason} 300-$-Test, kein echtes Geld.`,
    revenue: {
      bookPct: last?.bookPct ?? 0,
      spyPct: last?.spyPct ?? 0,
      note: last
        ? `${last.week} Book ${last.bookPct.toFixed(2)} % gegen SPY ${last.spyPct.toFixed(2)} %. Relativ ${last.relativePct.toFixed(2)} pp, Limit ${REL_LOSS_CAP} %. Soll-Book ${args.liveNotional.toLocaleString("de-DE")} €.`
        : "Noch keine Demo-Woche in diesem Lauf.",
    },
    feedback: [
      {
        bot: "Forge",
        heading: "Post-Mortem",
        body:
          openLessons[0]?.mistake ??
          last?.verdict ??
          "Keine offene Lesson. Autopilot darf Paper-Fehler machen und schreibt sie ins Log.",
      },
      {
        bot: "Gauge",
        heading: "Effizienz",
        body: "Autopilot lokal, ohne Modell-Schleife. Ein Alert-Raster, kein Doppelpush. FactSet bleibt Kündigungs-Kandidat.",
      },
      {
        bot: "Canon",
        heading: "Inklusion",
        body: `Tick ${args.tickCount}. Watch ${w ? `Tag ${w.day}/7` : "startet"}. ${discuss.length} Profilvorschläge in Diskussion. Trading-Demos ${hits}/${args.trials.length} über SPY.`,
      },
      {
        bot: "Skipper",
        heading: "Boden",
        body: `${totals.harvestedNet.toFixed(2)} € realisiert, bleibt im Book. ${daysLeftInMonth()} Tage im Monat. Live ${args.liveStatus === "abort" ? "pausiert" : "an"}. 300-$-Test.`,
      },
    ],
    inclusion: WEEKLY_BRIEF.inclusion,
    proposals: args.proposals,
    dual: {
      cashNote: `Diesen Monat: realisiert ${totals.harvestedNet.toFixed(2)} € auf dem 300-$-Paper, bleibt im Book. Nächste grüne Watch kauft nach.`,
      capitalNote: `90-Tage-Programm: Relativverlust vs SPY unter ${REL_LOSS_CAP} %. Kern unangetastet. Stretch erst, wenn der Boden drei Monate steht.`,
    },
    generated: true,
  };
}

export function compileLocalBrief(args: {
  watchlist: Ticker[];
  watch: DemoWatch | null;
  liveStatus: LiveStatus;
  harvestedNet: number;
  projected: number;
  tickCount: number;
}): MorningBrief {
  const at = new Date().toISOString();
  const hot = topMover(args.watchlist);
  const w = args.watch;
  const lede = `Autopilot Tick ${args.tickCount}. Testlauf 300 $. Realisiert ${args.harvestedNet.toFixed(2)} €, bleibt im Book. Live ${args.liveStatus}. Paper 24/7.`;
  return {
    id: `brief-auto-${at}`,
    deliveredAt: at,
    title: "Overnight-Buch — Autopilot",
    lede,
    sections: [
      {
        heading: "Lage",
        body: w
          ? `Watch ${w.label}, Tag ${w.day}/7, NAV ${w.navEur.toFixed(2)} €, relativ ${w.relativePct.toFixed(2)} pp.`
          : "Neue Watch wird eröffnet. 300 $ digital, dasselbe Tape.",
        tickers: ["SPY", "VOO", "BLK"],
      },
      {
        heading: "Tape",
        body: hot
          ? `Lautester Name ${hot.symbol} (${hot.name}) ${hot.changePct >= 0 ? "+" : ""}${hot.changePct.toFixed(2)} %. Overlay nur nach Chart und Zahler-Test.`
          : "Tape noch leer.",
        tickers: hot ? [hot.symbol] : [],
      },
    ],
    actions: [
      {
        ticker: "SPY",
        action: "Kern halten",
        rationale: "Autopilot fasst den Kern nicht an.",
      },
      {
        ticker: hot?.symbol ?? "AVGO",
        action: "Paper, kein Live",
        rationale: "Solange kein echtes Geld fließt, testet die Demo. Skipper gibt Live nur über dem Boden frei.",
      },
    ],
    generated: true,
  };
}
