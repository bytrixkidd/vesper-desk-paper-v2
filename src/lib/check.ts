import { CFG_VERSION, LEGACY_BOOK_ID } from "@/lib/config";
import { loadBook } from "@/lib/books";
import { buildCheck, formatCheck } from "@/lib/check-report";
import { useDeskStore } from "@/lib/store";

function pack() {
  const s = useDeskStore.getState();
  const archive = typeof window !== "undefined" ? loadBook(window.localStorage, LEGACY_BOOK_ID) : null;
  const sessionChange: Record<string, number> = {};
  for (const t of s.watchlist) sessionChange[t.symbol] = t.changePct;
  return {
    watch: s.watch,
    fills: s.fills,
    strategy: s.strategy,
    market: s.market,
    tapeAsOf: s.tapeAsOf,
    sessionLabel: s.sessionLabel,
    autoPilot: s.autoPilot,
    tickCount: s.tickCount,
    lastTick: s.lastTick,
    index: s.bookIndex,
    archive,
    scores: s.lastTilt?.scores,
    sessionChangePct: sessionChange,
    spyBars: s.tape.SPY,
  };
}

export function runCheck(): string {
  const s = useDeskStore.getState();
  const args = pack();
  const snap = buildCheck(args);
  return formatCheck(snap, {
    autoPilot: s.autoPilot,
    tickCount: s.tickCount,
    lastTick: s.lastTick,
    cfg: CFG_VERSION,
    spyBars: args.spyBars,
  }).join("\n");
}

export function checkLines(): string[] {
  return runCheck().split("\n");
}

export function checkSnapshot() {
  return buildCheck(pack());
}
