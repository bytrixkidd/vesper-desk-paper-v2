import type { Agent, BookStrategy, Ticker } from "./types";
import { MANDATE_BOTS } from "./seed-mandate";
import { TRADE_BOTS, TRADE_FEEDBACK_BOTS } from "./seed-trade";

export const WATCHLIST: Ticker[] = [
  { symbol: "NVDA", name: "Nvidia", sector: "Halbleiter", last: 214.72, changePct: -0.98, cik: "0001045810" },
  { symbol: "AAPL", name: "Apple", sector: "Hardware", last: 309.35, changePct: -0.63, cik: "0000320193" },
  { symbol: "MSFT", name: "Microsoft", sector: "Software", last: 483.24, changePct: 0.43, cik: "0000789019" },
  { symbol: "AMZN", name: "Amazon", sector: "Konsum / Cloud", last: 258.63, changePct: -0.57, cik: "0001018724" },
  { symbol: "META", name: "Meta", sector: "Internet", last: 549.9, changePct: 0.75, cik: "0001326801" },
  { symbol: "TSLA", name: "Tesla", sector: "Auto / KI", last: 362.86, changePct: 5.14, cik: "0001318605" },
  { symbol: "GOOGL", name: "Alphabet", sector: "Internet", last: 344.82, changePct: 1.22, cik: "0001652044" },
  { symbol: "AVGO", name: "Broadcom", sector: "Halbleiter", last: 368.45, changePct: 1.21, cik: "0001730168" },
  { symbol: "JPM", name: "JPMorgan", sector: "Banken", last: 351.58, changePct: 0.01, cik: "0000019617" },
  { symbol: "LLY", name: "Eli Lilly", sector: "Biopharma", last: 1255.4, changePct: 0.88, cik: "0000059478" },
  { symbol: "UNH", name: "UnitedHealth", sector: "Krankenversicherung", last: 390.11, changePct: 1.37, cik: "0000731766" },
  { symbol: "GS", name: "Goldman Sachs", sector: "Banken", last: 1039.28, changePct: 3.73, cik: "0000886982" },
  { symbol: "BLK", name: "BlackRock", sector: "Asset Management", last: 1156.55, changePct: 1.47, cik: "0001364742" },
  { symbol: "SPY", name: "US-Aktienkorb", sector: "Indexkorb", last: 765.72, changePct: 0.41, cik: "0000884394" },
  { symbol: "VOO", name: "Vanguard-Aktienkorb", sector: "Indexkorb", last: 703.71, changePct: 0.39, cik: "0001488333" },
];

export const RESEARCH_BOTS: Agent[] = [
  {
    id: "ledger",
    name: "Ledger",
    desk: "research",
    vertical: "Filings",
    status: "done",
    lastRun: "2026-08-21T10:00:00.000Z",
    summary:
      "Materielles 8-K zu NVDA (Take-or-pay-Kapazität) und Form-4-Cluster bei AVGO. BLK 10-Q: iShares-AUM +9 % q/q — das ist der Tollbooth für den neuen Kern.",
  },
  {
    id: "callbook",
    name: "Callbook",
    desk: "research",
    vertical: "Earnings",
    status: "done",
    lastRun: "2026-08-21T10:04:00.000Z",
    summary:
      "AVGO Beat bei Networking-ASICs; Guidance angehoben. UNH Miss bei der Care-Cost-Ratio. BLK: Fee-Rate stabil, Performance-Fees saisonal dünn — AUM treibt die Einnahmen.",
  },
  {
    id: "meridian",
    name: "Meridian",
    desk: "research",
    vertical: "Sektor",
    status: "done",
    lastRun: "2026-08-21T10:08:00.000Z",
    summary:
      "Halbleiter-Führung intakt. SPY/VOO als Ballast in den Jackson-Hole-Open. BLK korreliert mit dem Kern, hat aber Operating-Leverage auf dieselben Zuflüsse.",
  },
  {
    id: "pulse",
    name: "Pulse",
    desk: "research",
    vertical: "Sentiment",
    status: "alert",
    lastRun: "2026-08-21T10:11:00.000Z",
    summary:
      "TSLA-Mentions +3,4σ — Flag, keine These. SPY/VOO ruhig. BLK-Ton konstruktiv nach dem AUM-Print. Sentiment nicht als Entry für den Kern.",
  },
  {
    id: "shadow",
    name: "Shadow",
    desk: "research",
    vertical: "Insider",
    status: "done",
    lastRun: "2026-08-21T10:14:00.000Z",
    summary:
      "AVGO Form 4: drei unabhängige Direktoren. Kein Cluster-Selling bei BLK. ETF-Sponsor-Flow (BlackRock, Vanguard) liegt unter Whale-Desk.",
  },
  {
    id: "helmsman",
    name: "Helmsman",
    desk: "research",
    vertical: "Koordination",
    status: "done",
    lastRun: "2026-08-21T10:18:00.000Z",
    summary:
      "Brief kompiliert. Testlauf 300 $. Duales Mandat: Cash diesen Monat, Kapital über 90 Tage. Kern-Satellit live. Relativverlust vs SPY nach 90 Tagen unter 5 %.",
  },
];

export const FEEDBACK_BOTS: Agent[] = [
  {
    id: "forge",
    name: "Forge",
    desk: "feedback",
    vertical: "Post-Mortem",
    status: "done",
    lastRun: "2026-08-21T10:22:00.000Z",
    summary:
      "Zwei Fehler diese Woche: TSLA auf Sentiment gejagt (Demo W32, −0,6 %), UNH-Trim einen Tag nach dem Two-Sigma-13F. Beide im Lesson-Log. Overlay nur kürzen, wenn das Book hinter dem Markt liegt.",
  },
  {
    id: "gauge",
    name: "Gauge",
    desk: "feedback",
    vertical: "Effizienz",
    status: "done",
    lastRun: "2026-08-21T10:25:00.000Z",
    summary:
      "Pulse und Ledger haben TSLA/NVDA doppelt gepusht — 12 Minuten Floor-Lärm. Throttle auf 1 Alert / Ticker / 4h. FactSet bleibt Kündigungs-Kandidat.",
  },
  {
    id: "canon",
    name: "Canon",
    desk: "feedback",
    vertical: "Inklusion",
    status: "done",
    lastRun: "2026-08-21T10:28:00.000Z",
    summary:
      "Inklusionsplan für Woche 35: Abbruch-Schwelle, Universum-Desk, Mandat-Team, Trading-Floor, Profilvorschläge aller Teams im Weekly.",
  },
];

export const DESK_BOTS: Agent[] = [...RESEARCH_BOTS, ...FEEDBACK_BOTS];

export const PRISM_BOT: Agent = {
  id: "prism",
  name: "Prism",
  desk: "charts",
  vertical: "Anschauung",
  status: "done",
  lastRun: "2026-08-23T20:00:00.000Z",
  summary:
    "Farben, Charts, Stichpunkte. Grün steigt, rot fällt. Klick auf den 29. Juli im S&P: Zinsen, Gewinnmitnahmen, Technik hat gezogen. Anfänger zuerst, Fachwort danach.",
};

export const ALL_BOTS: Agent[] = [...DESK_BOTS, PRISM_BOT, ...MANDATE_BOTS, ...TRADE_BOTS, ...TRADE_FEEDBACK_BOTS];

export const STRATEGY: BookStrategy = {
  id: "core-sat-2026-08",
  name: "Kern-Satellit · Testlauf 300 $",
  thesis:
    "300 Dollar digitaler Testlauf, kein Echtgeld. Die Beimischung kauft, nimmt Gewinn mit und setzt Cash wieder ein. Der Kern: US-Aktienkorb und Vanguard-Aktienkorb (beide S&P 500) plus BlackRock-Aktie. Zahler zuerst. 5.000 € im Monat sind ein späteres Szenario, kein Ergebnis dieses Tests.",
  target:
    "Stand über 300 $ halten und mehren. Relativ vs SPY unter 5 % bis 23. Nov. Kein Echtgeld.",
  groups: [
    {
      id: "beta",
      label: "S&P-Kern (derselbe Index zweimal)",
      weightPct: 55,
      tickers: ["SPY", "VOO"],
      note: "SPY und VOO folgen beide dem S&P 500. Das ist derselbe Index, nicht zwei Märkte. Ziel 55 %. Bestand nicht nur zum Anpassen verkaufen.",
    },
    {
      id: "toll",
      label: "BlackRock-Aktie",
      weightPct: 15,
      tickers: ["BLK"],
      note: "Einzelaktie des Vermögensverwalters, kein iShares-Fonds. Firmenrisiko, keine breite Streuung.",
    },
    {
      id: "alpha",
      label: "Aktives Overlay",
      weightPct: 30,
      tickers: ["AVGO", "JPM", "GS", "UNH", "NVDA", "LLY", "MSFT", "AAPL", "GOOGL", "META", "AMZN", "TSLA"],
      note: "Ziel 30 % (paper-v2). Höchstens fünf aktive Namen, je 15 %. Zahler zuerst. Tesla gesperrt. Nvidia ohne Kaufbonus. Tech überlappt mit SPY/VOO.",
    },
  ],
  sleeves: [
    { ticker: "SPY", weightPct: 34.57, role: "Beta-Kern, Benchmark, Hedge. Derselbe S&P 500 wie VOO." },
    { ticker: "VOO", weightPct: 20.43, role: "Vanguard-Spiegel, Tracking. Derselbe S&P 500 wie SPY." },
    { ticker: "BLK", weightPct: 15, role: "Einzelaktie Vermögensverwalter, kein Korb" },
    { ticker: "AVGO", weightPct: 8, role: "Beimischung Zahler" },
    { ticker: "JPM", weightPct: 6, role: "Beimischung Zahler" },
    { ticker: "NVDA", weightPct: 6, role: "Beimischung — gleiche Hürde, kein Bonus" },
    { ticker: "GS", weightPct: 5, role: "Beimischung Zahler, nicht auf den Print" },
    { ticker: "UNH", weightPct: 5, role: "Beimischung Zahler" },
    { ticker: "LLY", weightPct: 0, role: "Nur bei S1/S2" },
    { ticker: "MSFT", weightPct: 0, role: "Nur bei S1/S2" },
    { ticker: "AAPL", weightPct: 0, role: "Nur bei S1/S2" },
    { ticker: "AMZN", weightPct: 0, role: "Nur bei S1/S2" },
    { ticker: "GOOGL", weightPct: 0, role: "Nur bei S1/S2" },
    { ticker: "META", weightPct: 0, role: "Nur bei S1/S2" },
    { ticker: "TSLA", weightPct: 0, role: "Gesperrt, Lesson" },
  ],
};

export { DEMO_WEEKS, HARVESTS } from "@/lib/seed-demo";
export {
  ALERTS,
  FILINGS,
  SENTIMENT,
  FUNDS,
  WHALES,
  EARNINGS,
  MACRO,
  OPS_TASKS,
  MORNING_BRIEF,
  WEEKLY_BRIEF,
  LESSONS,
} from "@/lib/seed-book";
export { UNIVERSE } from "@/lib/seed-universe";
export { MANDATE_BOTS, MANDATE_PLANS } from "@/lib/seed-mandate";
export {
  TRADE_BOTS,
  TRADE_FEEDBACK_BOTS,
  TRADE_IDEAS,
  TRADE_TRIALS,
  INSIGHTS,
  PROFILE_PROPOSALS,
} from "@/lib/seed-trade";
