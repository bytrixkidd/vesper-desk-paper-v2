import { COST_BPS, PAPER_V2_BOOK_ID, PAPER_V2_EXPERIMENT_ID } from "./config.ts";
import { decidePulse, huddleStance, type PulseDecision } from "./engine.ts";
import {
  canSimulateFill,
  cashSplit,
  dataKey,
  fillExists,
  gapFillPrice,
  makeFill,
  nextSessionValidUntil,
  reservedCashUsd,
  stopLevelUsd,
} from "./ledger.ts";
import { displayName } from "./names.ts";
import type { DemoWatch, OrderReview, PaperFill, PriceSource } from "./types.ts";

export const MARKET_OPEN_NOT_A_REASON =
  "Börsenstart allein ist kein neuer Kaufgrund. Die Order bleibt geplant, bis eine unabhängige Prüfung sie bestätigt.";

export const GS_EVENT_NOT_REGIME =
  "Goldman plus stark an einem Sitzungstag ist Ereignis, kein Regime. Nachkauf nur auf Schwäche, nicht auf den Print.";

export type RevalidateInput = {
  fill: PaperFill;
  watch: DemoWatch;
  market: "open" | "closed";
  closeDate: string;
  now?: Date;
  marketJustOpened?: boolean;
  sessionChangePct?: number;
  freshDecision?: PulseDecision | null;
};

export type RevalidateResult = {
  action: OrderReview["action"];
  reason: string;
  fill: PaperFill;
};

function appendReview(fill: PaperFill, at: string, action: OrderReview["action"], reason: string): PaperFill {
  const reviews = [...(fill.reviews ?? []), { at, action, reason }];
  const status =
    action === "cancel" ? "cancelled" : action === "block" ? "blocked" : action === "fill" ? fill.status : "planned";
  return { ...fill, reviews, status: action === "keep-planned" ? "planned" : status };
}

export function eventNotRegime(args: { symbol: string; sessionChangePct?: number }) {
  if (args.symbol === "GS" && (args.sessionChangePct ?? 0) >= 2) return GS_EVENT_NOT_REGIME;
  return null;
}

/** Geplante Order vor jeder Ausführung neu prüfen. Sitzungsbeginn allein reicht nicht. */
export function revalidateOrder(input: RevalidateInput): RevalidateResult {
  const at = (input.now ?? new Date()).toISOString();
  const fill = input.fill;
  if (fill.status === "simulated_filled" || fill.status === "cancelled") {
    return { action: "keep-planned", reason: `Status ${fill.status}, keine erneute Prüfung.`, fill };
  }

  if (fill.validUntil && (input.now ?? new Date()) > new Date(fill.validUntil)) {
    const reason = `Gültigkeit abgelaufen (${fill.validUntil}). Order storniert.`;
    const next = appendReview(fill, at, "cancel", reason);
    return { action: "cancel", reason, fill: next };
  }

  const gate = canSimulateFill({
    market: input.market,
    phase: input.watch.phase === "replay" ? "replay" : "live",
    closeDate: input.closeDate,
    now: input.now,
  });

  if (!gate.ok) {
    const next = appendReview(fill, at, "keep-planned", gate.reason);
    return { action: "keep-planned", reason: gate.reason, fill: next };
  }

  if (input.marketJustOpened) {
    const reason = MARKET_OPEN_NOT_A_REASON;
    const next = appendReview(fill, at, "keep-planned", reason);
    return { action: "keep-planned", reason, fill: next };
  }

  const event = eventNotRegime({ symbol: fill.symbol, sessionChangePct: input.sessionChangePct });
  if (event && fill.side === "buy") {
    const next = appendReview(fill, at, "cancel", event);
    return { action: "cancel", reason: event, fill: next };
  }

  if (fill.side === "buy") {
    const cashUsd = input.watch.cashEur * (input.watch.eurUsd || 0);
    const others = cashSplit({
      cashUsd,
      fills: [],
    });
    if (others.totalUsd + 1e-9 < Math.abs(fill.cashDeltaUsd)) {
      const reason = `Guthaben ${others.totalUsd.toFixed(2)} $ reicht nicht für ${Math.abs(fill.cashDeltaUsd).toFixed(2)} $.`;
      const next = appendReview(fill, at, "block", reason);
      return { action: "block", reason, fill: next };
    }
  }

  const decision = input.freshDecision;
  if (fill.side === "buy") {
    const stillSame =
      decision &&
      decision.kind === "buy" &&
      decision.ticker === fill.symbol &&
      (decision.intervene === "add-overlay" || decision.intervene === "add-core");
    if (!stillSame) {
      const reason =
        "Erneute Prüfung: decidePulse bestätigt diesen Kauf nicht mehr. Order storniert. Kein Fill nur weil die Sitzung offen ist.";
      const next = appendReview(fill, at, "cancel", reason);
      return { action: "cancel", reason, fill: next };
    }
  }

  const next = appendReview(fill, at, "fill", "Prüfung bestätigt. Unabhängiger Grund steht, Sitzung und Datenstand passen.");
  return { action: "fill", reason: next.reviews!.at(-1)!.reason, fill: next };
}

export function goldmanThesis() {
  return "Zahler-Regel: Goldman als Banken-Satellit, Nachkauf nur auf Schwäche. Freitagsplus ist Ereignis, kein Einstieg.";
}

export type GoldmanReport = {
  exists: boolean;
  symbol: "GS";
  name: string;
  createdAt: string | null;
  decidedAt: string | null;
  basis: string;
  plannedUsd: number | null;
  shares: number | null;
  validUntil: string | null;
  status: PaperFill["status"] | "none";
  executable: boolean;
  reviews: OrderReview[];
  note: string;
};

export function goldmanReport(args: {
  fills: PaperFill[];
  watch: DemoWatch | null;
  market: "open" | "closed";
  closeDate: string;
  now?: Date;
  sessionChangePct?: number;
}): GoldmanReport {
  const gs = args.fills.filter((f) => f.symbol === "GS");
  const planned = gs.find((f) => f.status === "planned") ?? gs[0] ?? null;
  const name = displayName("GS");
  if (!planned) {
    const would = args.watch
      ? decidePulse(args.watch, args.closeDate, args.fills)
      : null;
    const wouldGs = would?.ticker === "GS" && would.kind === "buy";
    return {
      exists: false,
      symbol: "GS",
      name,
      createdAt: null,
      decidedAt: null,
      basis: goldmanThesis(),
      plannedUsd: wouldGs ? would?.spendUsd ?? null : null,
      shares: null,
      validUntil: null,
      status: "none",
      executable: false,
      reviews: [
        {
          at: (args.now ?? new Date()).toISOString(),
          action: "block",
          reason: wouldGs
            ? `${MARKET_OPEN_NOT_A_REASON} ${GS_EVENT_NOT_REGIME}`
            : "Keine persistierte Goldman-Order. decidePulse wählt Goldman derzeit nicht.",
        },
      ],
      note: "Im aktuellen Book gibt es keine Goldman-Order. Ein Börsenstart erzeugt sie nicht.",
    };
  }

  const decision = args.watch ? decidePulse(args.watch, args.closeDate, args.fills.filter((f) => f.id !== planned.id)) : null;
  const review = revalidateOrder({
    fill: planned,
    watch: args.watch ?? ({ phase: "live", cashEur: 0, eurUsd: 1 } as DemoWatch),
    market: args.market,
    closeDate: args.closeDate,
    now: args.now,
    marketJustOpened: args.market === "open",
    sessionChangePct: args.sessionChangePct,
    freshDecision: decision,
  });

  return {
    exists: true,
    symbol: "GS",
    name,
    createdAt: planned.decidedAt,
    decidedAt: planned.decidedAt,
    basis: planned.thesis ?? goldmanThesis(),
    plannedUsd: Math.abs(planned.cashDeltaUsd),
    shares: planned.shares,
    validUntil: planned.validUntil ?? null,
    status: review.fill.status,
    executable: review.action === "fill",
    reviews: review.fill.reviews ?? [],
    note: review.reason,
  };
}

export type QuoteStamp = {
  last: number;
  asOf: string;
  source: PriceSource;
};

export function stampFill(args: {
  decision: PulseDecision;
  watch: DemoWatch;
  at: string;
  closeDate: string;
  market: "open" | "closed";
  tapeAsOf: string | null;
  quote: QuoteStamp | null;
  shares: number;
  spentOrSoldUsd: number;
  status: PaperFill["status"];
  note: string;
  filledAt: string | null;
}): PaperFill {
  const side = args.decision.kind === "buy" ? "buy" : "sell";
  const px = args.quote?.last ?? args.watch.positions.find((p) => p.ticker === args.decision.ticker)?.lastUsd ?? 0;
  const costUsd = Math.abs(args.spentOrSoldUsd - args.shares * px);
  const stop = side === "buy" && px > 0 ? stopLevelUsd(px) : null;
  return makeFill({
    bookVersion: args.watch.bookVersion ?? 0,
    decidedAt: args.at,
    filledAt: args.filledAt,
    status: args.status,
    symbol: args.decision.ticker ?? "BOOK",
    side,
    shares: args.shares,
    priceUsd: px,
    costUsd: Number(costUsd.toFixed(4)),
    cashDeltaUsd: side === "buy" ? -Math.abs(args.spentOrSoldUsd) : Math.abs(args.spentOrSoldUsd),
    dataKey: dataKey(args.closeDate, args.decision.kind, args.decision.ticker ?? "book"),
    note: args.note,
    sessionDate: args.closeDate,
    market: args.market,
    experimentId: args.watch.experimentId ?? PAPER_V2_EXPERIMENT_ID,
    bookId: args.watch.bookId ?? PAPER_V2_BOOK_ID,
    dataAsOf: args.tapeAsOf,
    priceAsOf: args.quote?.asOf ?? null,
    priceSource: args.quote?.source ?? "unknown",
    costBps: COST_BPS,
    stopUsd: stop,
    reservedUsd: args.status === "planned" && side === "buy" ? Math.abs(args.spentOrSoldUsd) : 0,
    validUntil: args.closeDate ? nextSessionValidUntil(args.closeDate) : null,
    thesis: args.decision.note,
    reviews:
      args.status === "planned"
        ? [{ at: args.at, action: "keep-planned", reason: args.note }]
        : [{ at: args.at, action: "fill", reason: args.note }],
  });
}

export function competingBuys(fills: PaperFill[], cashUsd: number) {
  const planned = fills.filter((f) => f.status === "planned" && f.side === "buy");
  const accepted: PaperFill[] = [];
  const blocked: PaperFill[] = [];
  let left = cashUsd;
  for (const f of planned) {
    const need = Math.abs(f.reservedUsd ?? f.cashDeltaUsd);
    if (need <= left + 1e-9) {
      accepted.push(f);
      left -= need;
    } else {
      blocked.push(
        appendReview(
          f,
          new Date().toISOString(),
          "block",
          `Gemeinsames Guthaben reicht nicht. Noch ${left.toFixed(2)} $, Order will ${need.toFixed(2)} $.`,
        ),
      );
    }
  }
  return { accepted, blocked, leftoverUsd: left };
}

export { reservedCashUsd, gapFillPrice, huddleStance, fillExists };
