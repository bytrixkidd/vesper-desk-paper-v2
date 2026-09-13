/** Drei getrennte Paper-Vergleiche. Identischer Start, identische Kosten. Kein Nachweis monatlichen Einkommens. */

import { COST_BPS, PAPER_V2_EXPERIMENT_ID, START_USD } from "./config.ts";
import type { Bar } from "./types.ts";

export type CompareLane = "A" | "B" | "C";

export type CompareSpec = {
  id: CompareLane;
  experimentId: string;
  name: string;
  implemented: boolean;
  note: string;
};

/** Getrennte Experiment-IDs. Nicht das Legacy-Archiv, nicht gegenseitig überschreiben. */
export const COMPARE_SPECS: Record<CompareLane, CompareSpec> = {
  A: {
    id: "A",
    experimentId: `${PAPER_V2_EXPERIMENT_ID}-compare-a-rules`,
    name: "Feste Regeln ohne Modell",
    implemented: true,
    note: "decidePulse / S1 / S2 / Stops. Bot-Namen sind Etiketten. Kein LLM im Kaufpfad.",
  },
  B: {
    id: "B",
    experimentId: `${PAPER_V2_EXPERIMENT_ID}-compare-b-model`,
    name: "Regeln plus Modellanalyse und Gegenprüfung",
    implemented: false,
    note: "NICHT IMPLEMENTIERT. runDeskAgent und Floor-Chat schreiben Briefings, sie ändern decidePulse nicht. Kein getrennter Modell-Lane-Test ausgeführt.",
  },
  C: {
    id: "C",
    experimentId: `${PAPER_V2_EXPERIMENT_ID}-compare-c-spy`,
    name: "Passiv: US-Aktienkorb kaufen und halten",
    implemented: true,
    note: "Ein Kauf SPY am ersten Schluss, Halten, Kosten 10 bp je Seite. Vorab festgelegt.",
  },
};

export type CompareRow = {
  id: CompareLane;
  experimentId: string;
  name: string;
  implemented: boolean;
  startUsd: number;
  endUsd: number | null;
  pct: number | null;
  note: string;
};

function buyHold(bars: Bar[] | undefined, startUsd: number, fromDate?: string) {
  if (!bars || bars.length < 2) return null;
  const pool = fromDate ? bars.filter((b) => b.t.slice(0, 10) >= fromDate) : bars;
  if (pool.length < 2) return null;
  const first = pool[0]!;
  const last = pool.at(-1)!;
  if (first.c <= 0) return null;
  const slip = 1 + COST_BPS / 10_000;
  const shares = startUsd / (first.c * slip);
  const end = shares * last.c * (1 - COST_BPS / 10_000);
  return {
    startUsd,
    endUsd: Number(end.toFixed(2)),
    pct: Number((((end - startUsd) / startUsd) * 100).toFixed(3)),
    from: first.t.slice(0, 10),
    to: last.t.slice(0, 10),
  };
}

/** C: passiver Korb. A: aktuelles Book (Regeln). B: immer null, nicht gebaut. */
export function tapeCompare(args: {
  spy?: Bar[];
  bookStartUsd: number;
  bookNavUsd: number | null;
  bookReady: boolean;
  fromDate?: string;
}): CompareRow[] {
  const spy = buyHold(args.spy, START_USD, args.fromDate);
  const bookPct =
    args.bookReady && args.bookStartUsd > 0 && args.bookNavUsd != null
      ? Number((((args.bookNavUsd - args.bookStartUsd) / args.bookStartUsd) * 100).toFixed(3))
      : null;
  return [
    {
      id: "A",
      experimentId: COMPARE_SPECS.A.experimentId,
      name: COMPARE_SPECS.A.name,
      implemented: true,
      startUsd: args.bookStartUsd,
      endUsd: args.bookReady ? args.bookNavUsd : null,
      pct: bookPct,
      note: COMPARE_SPECS.A.note + (bookPct == null ? " Noch kein Book." : " Ergebnis dieses paper-v2-Books."),
    },
    {
      id: "B",
      experimentId: COMPARE_SPECS.B.experimentId,
      name: COMPARE_SPECS.B.name,
      implemented: false,
      startUsd: START_USD,
      endUsd: null,
      pct: null,
      note: COMPARE_SPECS.B.note,
    },
    {
      id: "C",
      experimentId: COMPARE_SPECS.C.experimentId,
      name: COMPARE_SPECS.C.name,
      implemented: true,
      startUsd: START_USD,
      endUsd: spy?.endUsd ?? null,
      pct: spy?.pct ?? null,
      note: spy
        ? `${COMPARE_SPECS.C.note} Tape ${spy.from} – ${spy.to}.`
        : "UNBEKANNT — kein SPY-Tape in diesem Lauf.",
    },
  ];
}

export function spyBuyHoldUsd(spy: Bar[] | undefined, startUsd = START_USD, fromDate?: string) {
  return buyHold(spy, startUsd, fromDate);
}
