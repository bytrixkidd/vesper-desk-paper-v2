import { COST_BPS } from "./config.ts";
import { applyPulseToWatch, decidePulse, huddleStance, type PulseContext, type PulseDecision, type SleeveScore } from "./engine.ts";
import {
  canSimulateFill,
  dataKey,
  fillExists,
  reservedCashUsd,
  roundShares,
} from "./ledger.ts";
import { MARKET_OPEN_NOT_A_REASON, revalidateOrder, stampFill, type QuoteStamp } from "./orders.ts";
import type { DemoWatch, PaperFill, PulseEvent } from "./types.ts";
import { makePulseEvent } from "./engine.ts";

export type PulseTickInput = {
  watch: DemoWatch;
  fills: PaperFill[];
  market: "open" | "closed";
  closeDate: string;
  tapeAsOf: string | null;
  tapeSource: "yahoo" | "seed";
  now: Date;
  quotes: Record<string, QuoteStamp>;
  marketJustOpened?: boolean;
  sessionChangePct?: Record<string, number>;
  scores?: SleeveScore[];
};

export type BotLine = {
  bot: string;
  text: string;
  kind: "decision" | "explanation";
};

export type ExecutionStamp = {
  decidedAt: string;
  dataAsOf: string | null;
  priceAsOf: string | null;
  simulatedFilledAt: string | null;
  priceSource: string;
  costBps: number;
  closeDate: string;
};

export type PulseTickResult = {
  watch: DemoWatch;
  fills: PaperFill[];
  decision: PulseDecision | null;
  /** Trading path never calls a model. */
  modelCalls: [];
  botLines: BotLine[];
  gate: { ok: boolean; reason: string };
  execution: ExecutionStamp | null;
  pulseEvent: PulseEvent | null;
  realizedUsd: number;
  log: string[];
};

function quoteFor(quotes: Record<string, QuoteStamp>, symbol?: string, watch?: DemoWatch): QuoteStamp | null {
  if (!symbol) return null;
  if (quotes[symbol]) return quotes[symbol]!;
  const last = watch?.positions.find((p) => p.ticker === symbol)?.lastUsd;
  if (last == null) return null;
  return { last, asOf: watch?.tapeCloseDate ?? "", source: "unknown" };
}

export function executePulseTick(input: PulseTickInput): PulseTickResult {
  const at = input.now.toISOString();
  const log: string[] = [];
  const reserved = reservedCashUsd(input.fills);
  const ctx: PulseContext = { scores: input.scores, sessionChangePct: input.sessionChangePct };
  const decision = decidePulse(input.watch, input.closeDate, input.fills, reserved, ctx);
  const huddle = huddleStance(input.watch, decision, at);
  const botLines: BotLine[] = [
    { bot: "skipper", text: huddle.skipper, kind: decision?.bot === "skipper" ? "decision" : "explanation" },
    { bot: "forge", text: huddle.forge, kind: decision?.bot === "forge" ? "decision" : "explanation" },
    { bot: "till", text: huddle.till, kind: decision?.bot === "till" || decision?.bot === "vein" ? "decision" : "explanation" },
    { bot: "drift", text: huddle.drift, kind: decision?.bot === "drift" ? "decision" : "explanation" },
  ];
  log.push(`decidePulse: ${decision ? `${decision.kind} ${decision.ticker ?? "book"}` : "null (kein Eingriff)"}`);
  log.push("Modellaufrufe im Handelspfad: 0. Bots sind Programmtext, keine unabhängigen Agenten.");

  const gate = canSimulateFill({
    market: input.market,
    phase: input.watch.phase === "replay" ? "replay" : "live",
    closeDate: input.closeDate,
    now: input.now,
  });

  let watch = input.watch;
  let fills = [...input.fills];
  let pulseEvent: PulseEvent | null = null;
  let execution: ExecutionStamp | null = null;
  let realizedUsd = 0;

  const planned = fills.filter((f) => f.status === "planned");
  for (const p of planned) {
    const fresh = decidePulse(watch, input.closeDate, fills.filter((f) => f.id !== p.id), reservedCashUsd(fills.filter((f) => f.id !== p.id)), ctx);
    const review = revalidateOrder({
      fill: p,
      watch,
      market: input.market,
      closeDate: input.closeDate,
      now: input.now,
      marketJustOpened: input.marketJustOpened ?? false,
      sessionChangePct: p.symbol ? input.sessionChangePct?.[p.symbol] : undefined,
      freshDecision: fresh,
    });
    fills = fills.map((f) => (f.id === p.id ? review.fill : f));
    log.push(`Revalidation ${p.symbol} ${p.side}: ${review.action} — ${review.reason}`);
    if (review.action === "fill" && gate.ok && !input.marketJustOpened) {
      const fakeDecision: PulseDecision = {
        bot: "skipper",
        kind: p.side === "buy" ? "buy" : "pull",
        intervene: p.side === "buy" ? "add-overlay" : "flat",
        ticker: p.symbol,
        keepFrac: p.side === "buy" ? 1 : 0,
        spendUsd: Math.abs(p.cashDeltaUsd),
        note: p.note,
      };
      const applied = applyPulseToWatch({ ...watch, tapeCloseDate: input.closeDate }, fakeDecision, at);
      watch = applied.watch;
      realizedUsd += applied.realizedUsd;
      fills = fills.map((f) =>
        f.id === p.id
          ? {
              ...review.fill,
              status: "simulated_filled" as const,
              filledAt: at,
              reservedUsd: 0,
              shares: roundShares(applied.shares || f.shares),
            }
          : f,
      );
      log.push(`Fill ${p.symbol} simuliert um ${at}.`);
    }
  }

  if (!decision?.intervene) {
    return {
      watch,
      fills,
      decision,
      modelCalls: [],
      botLines,
      gate,
      execution,
      pulseEvent,
      realizedUsd,
      log,
    };
  }

  const key = dataKey(input.closeDate, decision.kind, decision.ticker ?? "book");
  const sameOpen =
    Boolean(decision.ticker) &&
    fills.some(
      (f) =>
        f.symbol === decision.ticker &&
        ((decision.kind === "buy" && f.side === "buy") || (decision.kind !== "buy" && f.side === "sell")) &&
        (f.status === "planned" || f.status === "simulated_filled"),
    );
  if (fillExists(fills, key) || (watch.actedKeys ?? []).includes(key) || sameOpen) {
    log.push(`Idempotent: ${key} schon geplant oder gefüllt. Zweiter Eingang verworfen.`);
    return { watch, fills, decision, modelCalls: [], botLines, gate, execution, pulseEvent, realizedUsd, log };
  }

  const quote = quoteFor(input.quotes, decision.ticker, watch);
  const lastPx = quote?.last ?? watch.positions.find((p) => p.ticker === decision.ticker)?.lastUsd ?? 0;
  const notional = decision.kind === "buy" ? (decision.spendUsd ?? 0) : 0;

  if (!gate.ok || input.marketJustOpened) {
    const reason = input.marketJustOpened ? MARKET_OPEN_NOT_A_REASON : gate.reason;
    const fill = stampFill({
      decision,
      watch,
      at,
      closeDate: input.closeDate,
      market: input.market,
      tapeAsOf: input.tapeAsOf,
      quote,
      shares: lastPx > 0 && notional > 0 ? roundShares(notional / lastPx) : 0,
      spentOrSoldUsd: notional,
      status: "planned",
      note: `${reason} ${decision.note}`,
      filledAt: null,
    });
    fills = [fill, ...fills];
    watch = { ...watch, actedKeys: [...new Set([...(watch.actedKeys ?? []), key])] };
    pulseEvent = makePulseEvent({ ...decision, note: `Geplant, nicht ausgeführt. ${reason}` }, at);
    execution = {
      decidedAt: at,
      dataAsOf: input.tapeAsOf,
      priceAsOf: quote?.asOf ?? null,
      simulatedFilledAt: null,
      priceSource: quote?.source ?? "unknown",
      costBps: COST_BPS,
      closeDate: input.closeDate,
    };
    log.push(`Order ${decision.ticker ?? "book"} bleibt PLANNED. ${reason}`);
    return { watch, fills, decision, modelCalls: [], botLines, gate: { ok: false, reason }, execution, pulseEvent, realizedUsd, log };
  }

  const eventPct = decision.ticker ? input.sessionChangePct?.[decision.ticker] : undefined;
  if (decision.kind === "buy" && decision.ticker === "GS" && (eventPct ?? 0) >= 2) {
    const reason = "Goldman-Print ist Ereignis, kein Kaufgrund. Order nicht ausgeführt.";
    const fill = stampFill({
      decision,
      watch,
      at,
      closeDate: input.closeDate,
      market: input.market,
      tapeAsOf: input.tapeAsOf,
      quote,
      shares: 0,
      spentOrSoldUsd: notional,
      status: "blocked",
      note: reason,
      filledAt: null,
    });
    fills = [fill, ...fills];
    log.push(reason);
    return { watch, fills, decision, modelCalls: [], botLines, gate: { ok: false, reason }, execution: null, pulseEvent: null, realizedUsd, log };
  }

  const applied = applyPulseToWatch({ ...watch, tapeCloseDate: input.closeDate }, decision, at);
  watch = applied.watch;
  realizedUsd += applied.realizedUsd;
  const shownUsd = decision.kind === "buy" ? applied.spentUsd : applied.soldUsd;
  pulseEvent = makePulseEvent(decision, at, shownUsd > 0 ? Number(shownUsd.toFixed(2)) : undefined);
  const fillPx = quote?.last ?? lastPx;
  const fill = stampFill({
    decision,
    watch,
    at,
    closeDate: input.closeDate,
    market: input.market,
    tapeAsOf: input.tapeAsOf,
    quote: quote ? { ...quote, last: fillPx } : quote,
    shares: roundShares(applied.shares),
    spentOrSoldUsd: shownUsd,
    status: "simulated_filled",
    note: decision.note,
    filledAt: at,
  });
  fills = [fill, ...fills];
  execution = {
    decidedAt: at,
    dataAsOf: input.tapeAsOf,
    priceAsOf: quote?.asOf ?? null,
    simulatedFilledAt: at,
    priceSource: quote?.source ?? "unknown",
    costBps: COST_BPS,
    closeDate: input.closeDate,
  };
  log.push(
    `Simuliert gefüllt ${decision.ticker} ${decision.kind} ${applied.shares.toFixed(4)} @ ${fillPx} Quelle ${execution.priceSource} Daten ${execution.dataAsOf} Kurszeit ${execution.priceAsOf}.`,
  );
  return { watch, fills, decision, modelCalls: [], botLines, gate, execution, pulseEvent, realizedUsd, log };
}
