import type { DemoWeek, HarvestEvent } from "./types";
import { LIVE_NOTIONAL_EUR, harvestFromReturn } from "./paper";

export const DEMO_WEEKS: DemoWeek[] = [
  {
    id: "d-w34",
    week: "W34",
    label: "7×24h · 15. – 21. Aug",
    startedAt: "2026-08-15T00:00:00.000Z",
    startEur: 50.65,
    navEur: 50.85,
    bookPct: 0.4,
    spyPct: 0.3,
    relativePct: 0.1,
    verdict: "Event-Woche. Kern unangetastet. Overlay flach. Relativ im 5-%-Budget. Nächste Watch vor NVDA-Print.",
    lesson: true,
    trades: [
      { id: "t341", ticker: "SPY", side: "long", entry: 762.6, exit: 765.72, pnlPct: 0.41, note: "Halten durch Jackson Hole." },
      { id: "t342", ticker: "VOO", side: "long", entry: 701.01, exit: 703.71, pnlPct: 0.39, note: "Halten." },
      { id: "t343", ticker: "AVGO", side: "flat", entry: 368.45, exit: 368.45, pnlPct: 0, note: "Add erst nach der Rede, nicht davor." },
    ],
  },
  {
    id: "d-w33",
    week: "W33",
    label: "7×24h · 8. – 14. Aug",
    startedAt: "2026-08-08T00:00:00.000Z",
    startEur: 50.1,
    navEur: 50.65,
    bookPct: 1.1,
    spyPct: 0.5,
    relativePct: 0.6,
    verdict: "AVGO-Add auf Schwäche nach Print hat den Spread gezahlt. Regel aus W32 gehalten: kein TSLA.",
    lesson: true,
    trades: [
      { id: "t331", ticker: "AVGO", side: "long", entry: 352.1, exit: 368.45, pnlPct: 4.64, note: "Guide + Form 4. Demo-Add, jetzt Live-Kandidat." },
      { id: "t332", ticker: "LLY", side: "long", entry: 1236.4, exit: 1255.4, pnlPct: 1.54, note: "Cluster gehalten." },
      { id: "t333", ticker: "BLK", side: "long", entry: 1139.82, exit: 1156.55, pnlPct: 1.47, note: "Tollbooth bleibt." },
      { id: "t334", ticker: "SPY", side: "long", entry: 758.4, exit: 762.6, pnlPct: 0.55, note: "Kern." },
    ],
  },
  {
    id: "d-w32",
    week: "W32",
    label: "7×24h · 1. – 7. Aug",
    startedAt: "2026-08-01T00:00:00.000Z",
    startEur: 50.4,
    navEur: 50.1,
    bookPct: -0.6,
    spyPct: 0.2,
    relativePct: -0.8,
    verdict: "Verlustwoche. TSLA-Jagd hat den Spread verbrannt. Lesson l1 applied. Kein Live-Add diese Woche.",
    lesson: true,
    trades: [
      { id: "t321", ticker: "TSLA", side: "long", entry: 345.13, exit: 332.8, pnlPct: -3.57, note: "Sentiment-Spike, kein Filing. Fehler." },
      { id: "t322", ticker: "SPY", side: "long", entry: 754.2, exit: 758.4, pnlPct: 0.56, note: "Kern hat gehalten." },
      { id: "t323", ticker: "UNH", side: "long", entry: 401.4, exit: 389.8, pnlPct: -2.89, note: "Trim zu spät — Lesson l2." },
    ],
  },
  {
    id: "d-w31",
    week: "W31",
    label: "7×24h · 25. Jul – 31. Jul",
    startedAt: "2026-07-25T00:00:00.000Z",
    startEur: 50,
    navEur: 50.4,
    bookPct: 0.8,
    spyPct: 0.4,
    relativePct: 0.4,
    verdict: "Kern und BLK haben getragen. Overlay ruhig. Freigabe für Live-Size am Kern. Der 29. Juli war rot im S&P — die Woche insgesamt trotzdem plus.",
    lesson: true,
    trades: [
      { id: "t311", ticker: "SPY", side: "long", entry: 748.6, exit: 754.2, pnlPct: 0.75, note: "Kern, Plan." },
      { id: "t312", ticker: "VOO", side: "long", entry: 688.4, exit: 693.1, pnlPct: 0.68, note: "Vanguard-Spiegel." },
      { id: "t313", ticker: "BLK", side: "long", entry: 1124.0, exit: 1139.8, pnlPct: 1.41, note: "Tollbooth nach AUM-Kommentar." },
    ],
  },
];

const w33 = harvestFromReturn(LIVE_NOTIONAL_EUR, 1.1);
const w34 = harvestFromReturn(LIVE_NOTIONAL_EUR, 0.4);

export const HARVESTS: HarvestEvent[] = [
  {
    id: "h-w33",
    at: "2026-08-22T16:00:00.000Z",
    month: "2026-08",
    source: "overlay",
    week: "W33",
    ...w33,
    note: "Lehrwoche W33. Hochrechnung auf 26.000 €, als hätte das Paper so viel eingesetzt. Kein Echtgeld.",
    lesson: true,
  },
  {
    id: "h-w34",
    at: "2026-08-21T20:00:00.000Z",
    month: "2026-08",
    source: "overlay",
    week: "W34",
    ...w34,
    note: "Lehrwoche W34. Hochrechnung, kein Konto, nichts wurde gekauft.",
    lesson: true,
  },
];
