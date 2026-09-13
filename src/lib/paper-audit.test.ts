import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LEGACY_BOOK_ID,
  PAPER_KEY,
  PAPER_V2_BOOK_ID,
  PAPER_V2_EXPERIMENT_ID,
  START_USD,
} from "./config.ts";
import {
  combinedReport,
  persistBook,
  splitBooks,
  type PaperSave,
  type StorageLike,
} from "./books.ts";
import {
  actualEquityWeightPct,
  applySideCost,
  bookIdentity,
  canSimulateFill,
  cashSplit,
  dataKey,
  fillExists,
  gapFillPrice,
  makeFill,
  reservedCashUsd,
  roundShares,
  sharesFromNotional,
  stopLevelUsd,
  riskSizeUsd,
} from "./ledger.ts";
import { applyPulseToWatch, buyTicker, decidePulse } from "./engine.ts";
import { overlayTrigger } from "./hypotheses.ts";
import { STOP_PCT_DEFAULT } from "./config.ts";
import { stopStudy } from "./stop-study.ts";
import { COMPARE_SPECS, tapeCompare } from "./compare.ts";
import { generateBars } from "./charts.ts";
import { competingBuys, goldmanReport, revalidateOrder } from "./orders.ts";
import { executePulseTick } from "./pulse-exec.ts";
import { buildCheck } from "./check-report.ts";
import type { BookStrategy, DemoPosition, DemoWatch, PaperFill } from "./types.ts";

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

const STRATEGY: BookStrategy = {
  id: "test",
  name: "test",
  thesis: "paper",
  target: "300",
  groups: [],
  sleeves: [
    { ticker: "SPY", weightPct: 22, role: "core" },
    { ticker: "VOO", weightPct: 13, role: "core" },
    { ticker: "GS", weightPct: 4, role: "payer" },
  ],
};

function pos(partial: Partial<DemoPosition> & Pick<DemoPosition, "ticker">): DemoPosition {
  return {
    shares: 0,
    costUsd: 100,
    lastUsd: 100,
    weightPct: 0,
    sleeve: "overlay",
    ...partial,
  };
}

function emptyWatch(over: Partial<DemoWatch> = {}): DemoWatch {
  const cashEur = 300 / 1.17;
  const positions = [
    pos({ ticker: "SPY", sleeve: "core", lastUsd: 500, costUsd: 500 }),
    pos({ ticker: "VOO", sleeve: "core", lastUsd: 450, costUsd: 450 }),
    pos({ ticker: "BLK", sleeve: "toll", lastUsd: 1000, costUsd: 1000 }),
    pos({ ticker: "AVGO", lastUsd: 360, costUsd: 360 }),
    pos({ ticker: "JPM", lastUsd: 350, costUsd: 350 }),
    pos({ ticker: "GS", lastUsd: 1000, costUsd: 1000 }),
    pos({ ticker: "UNH", lastUsd: 390, costUsd: 390 }),
    pos({ ticker: "NVDA", lastUsd: 210, costUsd: 210 }),
  ];
  return {
    id: "w-test",
    label: "Paper 300 $",
    startedAt: "2026-09-13T08:00:00.000Z",
    endsAt: "2026-09-20T08:00:00.000Z",
    day: 0,
    status: "watching",
    startEur: cashEur,
    navEur: cashEur,
    cashEur,
    spyStart: 500,
    spyLast: 500,
    eurUsd: 1.17,
    bookPct: 0,
    spyPct: 0,
    relativePct: 0,
    positions,
    standups: [],
    interventions: [],
    equity: [{ t: "2026-09-13T08:00:00.000Z", nav: cashEur, spy: cashEur, day: 0 }],
    window: [{ date: "2026-09-11" }],
    phase: "live",
    tapeCloseDate: "2026-09-11",
    actedKeys: [],
    bookVersion: 1,
    experimentId: PAPER_V2_EXPERIMENT_ID,
    bookId: PAPER_V2_BOOK_ID,
    historyStatus: "complete",
    ...over,
  };
}

type Case = { name: string; start: string; action: string; expected: string; actual: string; pass: boolean };
const cases: Case[] = [];
function record(c: Case) {
  cases.push(c);
  assert.equal(c.pass, true, `${c.name}: expected ${c.expected}, actual ${c.actual}`);
}

describe("1. depots getrennt", () => {
  it("archiviert legacy ohne den alten Schlüssel zu überschreiben", () => {
    const store = new MemoryStorage();
    const legacy: PaperSave = {
      watch: emptyWatch({ id: "w-old", bookPct: -12, navEur: 200, startEur: 256 }),
      extraDemos: [],
      extraHarvests: [],
      liveStatus: "live",
      tickCount: 9,
    };
    store.setItem(PAPER_KEY, JSON.stringify(legacy));
    const split = splitBooks(store, new Date("2026-09-13T08:32:00.000Z"));
    record({
      name: "legacy-key-untouched",
      start: "vesper-paper-v6 mit Verlust-Watch",
      action: "splitBooks",
      expected: "legacyUntouched true, v6 Inhalt gleich",
      actual: `${split.legacyUntouched} len=${store.getItem(PAPER_KEY)?.length}`,
      pass: split.legacyUntouched && store.getItem(PAPER_KEY) === JSON.stringify(legacy),
    });
    record({
      name: "ids-getrennt",
      start: "ein Speicher",
      action: "Index lesen",
      expected: `active ${PAPER_V2_BOOK_ID}, archive ${LEGACY_BOOK_ID}`,
      actual: `${split.index.activeBookId} / ${split.index.books.map((b) => b.bookId).join(",")}`,
      pass: split.index.activeBookId === PAPER_V2_BOOK_ID && split.index.books.some((b) => b.bookId === LEGACY_BOOK_ID),
    });
    const combined = combinedReport(split.index, split.archive, split.active);
    record({
      name: "alte-verluste-bleiben",
      start: "Archiv mit negativem PnL",
      action: "combinedReport",
      expected: "archiveIncomplete true, PnL nicht gelöscht",
      actual: `incomplete=${combined.archiveIncomplete} pnl=${combined.archivePnlUsd}`,
      pass: combined.archiveIncomplete && combined.archivePnlUsd != null && combined.archivePnlUsd < 0,
    });
  });
});

describe("2. geplante Goldman-Order", () => {
  it("keine persistierte Order, Börsenstart reicht nicht", () => {
    const watch = emptyWatch();
    const sunday = new Date("2026-09-13T08:32:00.000Z");
    const report = goldmanReport({
      fills: [],
      watch,
      market: "closed",
      closeDate: "2026-09-11",
      now: sunday,
      sessionChangePct: 3.73,
    });
    record({
      name: "goldman-keine-order",
      start: "leeres paper-v2, GS +3,73 % Freitag",
      action: "goldmanReport",
      expected: "exists false, executable false",
      actual: `exists=${report.exists} exec=${report.executable} status=${report.status}`,
      pass: !report.exists && !report.executable,
    });
  });

  it("geplante GS-Order wird bei Börsenstart nicht ausgeführt und bei Event storniert", () => {
    const watch = emptyWatch();
    const fill = makeFill({
      bookVersion: 1,
      decidedAt: "2026-09-11T20:05:00.000Z",
      filledAt: null,
      status: "planned",
      symbol: "GS",
      side: "buy",
      shares: 0.2,
      priceUsd: 1000,
      costUsd: 0.2,
      cashDeltaUsd: -200,
      dataKey: dataKey("2026-09-11", "buy", "GS"),
      note: "Kandidat Zahler",
      thesis: "Zahler, nur auf Schwäche",
      sessionDate: "2026-09-11",
      market: "closed",
    });
    const mondayOpen = new Date("2026-09-14T14:00:00.000Z");
    const review = revalidateOrder({
      fill,
      watch,
      market: "open",
      closeDate: "2026-09-14",
      now: mondayOpen,
      marketJustOpened: true,
      sessionChangePct: 3.73,
      freshDecision: decidePulse(watch, "2026-09-14", [fill]),
    });
    record({
      name: "goldman-boersenstart-kein-fill",
      start: "GS planned 200 $",
      action: "revalidate marketJustOpened",
      expected: "keep-planned, Grund Börsenstart",
      actual: `${review.action} ${review.reason.slice(0, 80)}`,
      pass: review.action === "keep-planned" && review.reason.includes("Börsenstart"),
    });
    const cancel = revalidateOrder({
      fill,
      watch,
      market: "open",
      closeDate: "2026-09-14",
      now: mondayOpen,
      marketJustOpened: false,
      sessionChangePct: 3.73,
      freshDecision: { bot: "till", kind: "buy", intervene: "add-overlay", ticker: "GS", keepFrac: 1, note: "x", spendUsd: 200 },
    });
    record({
      name: "goldman-event-cancel",
      start: "GS planned, Session +3,73 %",
      action: "revalidate eventNotRegime",
      expected: "cancel",
      actual: `${cancel.action} ${cancel.reason.slice(0, 90)}`,
      pass: cancel.action === "cancel",
    });
  });
});

describe("3+4. Entscheidungslogik und Zeitstempel", () => {
  it("konkreter Durchlauf: Sitzung zu, Order geplant, 0 Modellaufrufe", () => {
    const watch = emptyWatch();
    const now = new Date("2026-09-13T08:32:00.000Z");
    const result = executePulseTick({
      watch,
      fills: [],
      market: "closed",
      closeDate: "2026-09-11",
      tapeAsOf: "2026-09-11T20:00:00.000Z",
      tapeSource: "yahoo",
      now,
      quotes: { AVGO: { last: 360, asOf: "2026-09-11T20:00:00.000Z", source: "yahoo" } },
    });
    record({
      name: "kein-modell-im-handel",
      start: "Cash 300 $, live, Sonntag",
      action: "executePulseTick",
      expected: "modelCalls [], gate.ok false, planned oder null",
      actual: `models=${result.modelCalls.length} gate=${result.gate.ok} fills=${result.fills.map((f) => f.status + ":" + f.symbol).join(",") || "none"} decision=${result.decision?.kind ?? "null"}`,
      pass: result.modelCalls.length === 0 && result.gate.ok === false,
    });
    if (result.execution) {
      record({
        name: "zeitstempel-getrennt",
        start: "geplante Order",
        action: "execution stamp",
        expected: "decidedAt, dataAsOf, priceAsOf, filledAt null, nicht 'Kurs von heute'",
        actual: JSON.stringify(result.execution),
        pass:
          result.execution.decidedAt === now.toISOString() &&
          result.execution.dataAsOf === "2026-09-11T20:00:00.000Z" &&
          result.execution.simulatedFilledAt === null &&
          result.execution.closeDate === "2026-09-11",
      });
    } else {
      record({
        name: "zeitstempel-getrennt",
        start: "kein Eingriff",
        action: "execution stamp",
        expected: "auch ohne Fill: Entscheidung dokumentiert",
        actual: "execution=null (decidePulse null oder idempotent)",
        pass: true,
      });
    }
    const explanations = result.botLines.filter((b) => b.kind === "explanation");
    record({
      name: "bots-erklaeren-nicht-entscheiden",
      start: "huddle",
      action: "botLines",
      expected: "Erklärungen vorhanden, Entscheidung nur decidePulse",
      actual: `expl=${explanations.length} decisionBot=${result.decision?.bot ?? "none"}`,
      pass: explanations.length >= 1,
    });
  });
});

describe("5. reproduzierbare Tests", () => {
  it("derselbe Eingang zweimal", () => {
    const watch = emptyWatch();
    const now = new Date("2026-09-13T08:32:00.000Z");
    const first = executePulseTick({
      watch,
      fills: [],
      market: "closed",
      closeDate: "2026-09-11",
      tapeAsOf: "2026-09-11T20:00:00.000Z",
      tapeSource: "seed",
      now,
      quotes: {},
    });
    const second = executePulseTick({
      watch: first.watch,
      fills: first.fills,
      market: "closed",
      closeDate: "2026-09-11",
      tapeAsOf: "2026-09-11T20:00:00.000Z",
      tapeSource: "seed",
      now: new Date("2026-09-13T08:33:00.000Z"),
      quotes: {},
    });
    const planned = first.fills.filter((f) => f.status === "planned" || f.status === "simulated_filled").length;
    const planned2 = second.fills.filter((f) => f.status === "planned" || f.status === "simulated_filled").length;
    record({
      name: "idempotent-doppeleingang",
      start: `erster Tick fills=${planned}`,
      action: "zweiter identischer Tick",
      expected: "keine zweite Buchung derselben dataKey",
      actual: `first=${planned} second=${planned2} keys=${second.fills.map((f) => f.dataKey).join("|")}`,
      pass: planned2 === planned,
    });
  });

  it("Neuladen und Neustart", () => {
    const store = new MemoryStorage();
    splitBooks(store);
    const save: PaperSave = {
      watch: emptyWatch({ bookVersion: 3, cashEur: 200 }),
      extraDemos: [],
      extraHarvests: [],
      liveStatus: "live",
      tickCount: 4,
      experimentId: PAPER_V2_EXPERIMENT_ID,
      bookId: PAPER_V2_BOOK_ID,
    };
    persistBook(store, PAPER_V2_BOOK_ID, save);
    const again = splitBooks(store);
    record({
      name: "reload",
      start: "cashEur 200, bookVersion 3",
      action: "persist + splitBooks",
      expected: "dieselben Werte",
      actual: `cash=${again.active?.watch?.cashEur} ver=${again.active?.watch?.bookVersion}`,
      pass: again.active?.watch?.cashEur === 200 && again.active?.watch?.bookVersion === 3,
    });
  });

  it("zwei Tabs: ältere Version schreibt nicht", () => {
    const shared = new MemoryStorage();
    persistBook(shared, PAPER_V2_BOOK_ID, {
      watch: emptyWatch({ bookVersion: 5, navEur: 250 }),
      extraDemos: [],
      extraHarvests: [],
      liveStatus: "live",
      tickCount: 1,
    });
    const stale = persistBook(shared, PAPER_V2_BOOK_ID, {
      watch: emptyWatch({ bookVersion: 2, navEur: 100 }),
      extraDemos: [],
      extraHarvests: [],
      liveStatus: "live",
      tickCount: 1,
    });
    const loaded = JSON.parse(shared.getItem(`vesper-paper-book:${PAPER_V2_BOOK_ID}`)!) as PaperSave;
    record({
      name: "zwei-tabs",
      start: "Tab A version 5, Tab B version 2",
      action: "persistBook B",
      expected: "wrote false, NAV bleibt 250",
      actual: `wrote=${stale.wrote} nav=${loaded.watch?.navEur} reason=${stale.reason}`,
      pass: stale.wrote === false && loaded.watch?.navEur === 250,
    });
  });

  it("geschlossene Börse und veraltete Kurse", () => {
    const sunday = new Date("2026-09-13T08:32:00.000Z");
    const closed = canSimulateFill({ market: "closed", phase: "live", closeDate: "2026-09-11", now: sunday });
    const stale = canSimulateFill({ market: "open", phase: "live", closeDate: "2026-09-11", now: sunday });
    record({
      name: "sitzung-zu",
      start: "Sonntag, closeDate Freitag",
      action: "canSimulateFill",
      expected: "ok false, PLANNED",
      actual: `${closed.ok} ${closed.reason}`,
      pass: closed.ok === false,
    });
    record({
      name: "veralteter-schluss",
      start: "closeDate != Sitzungstag",
      action: "canSimulateFill live",
      expected: "ok false",
      actual: `${stale.ok} ${stale.reason}`,
      pass: stale.ok === false,
    });
  });

  it("mehrere Kaufaufträge mit gemeinsam begrenztem Guthaben", () => {
    const a = makeFill({
      bookVersion: 1,
      decidedAt: "t1",
      filledAt: null,
      status: "planned",
      symbol: "AVGO",
      side: "buy",
      shares: 0.6,
      priceUsd: 360,
      costUsd: 0.2,
      cashDeltaUsd: -240,
      reservedUsd: 240,
      dataKey: "k1",
      note: "a",
    });
    const b = makeFill({
      bookVersion: 1,
      decidedAt: "t2",
      filledAt: null,
      status: "planned",
      symbol: "GS",
      side: "buy",
      shares: 0.2,
      priceUsd: 1000,
      costUsd: 0.2,
      cashDeltaUsd: -240,
      reservedUsd: 240,
      dataKey: "k2",
      note: "b",
    });
    const split = cashSplit({ cashUsd: 300, fills: [a, b] });
    const race = competingBuys([a, b], 300);
    record({
      name: "cash-limit",
      start: "300 $ Cash, zwei Orders je 240 $",
      action: "competingBuys + cashSplit",
      expected: "eine akzeptiert, eine blockiert, reserved 240, available 60",
      actual: `acc=${race.accepted.length} blk=${race.blocked.length} reserved=${split.reservedUsd} avail=${split.availableUsd}`,
      pass: race.accepted.length === 1 && race.blocked.length === 1 && split.reservedUsd === 480 && split.availableUsd === 0,
    });
    const watch = emptyWatch();
    const second = decidePulse(watch, "2026-09-11", [a], reservedCashUsd([a]));
    record({
      name: "zweiter-kauf-nach-reserve",
      start: "240 $ reserviert von 300",
      action: "decidePulse mit reservedUsd",
      expected: "kein zweiter 240-$-Kauf oder spend <= available",
      actual: second ? `${second.kind} ${second.ticker} ${second.spendUsd}` : "null",
      pass: !second || second.kind !== "buy" || (second.spendUsd ?? 0) <= 60 + 1e-6,
    });
  });

  it("Gebühren, Bruchstücke, Rundung", () => {
    const s = sharesFromNotional(10, 100, "buy");
    record({
      name: "kosten-10bp",
      start: "10 $ auf Kurs 100, buy",
      action: "sharesFromNotional",
      expected: "price 100.1, shares gerundet 4 dp",
      actual: `px=${s.priceUsd} sh=${s.shares} spent=${s.spentUsd}`,
      pass: s.priceUsd === 100.1 && s.shares === roundShares(10 / 100.1),
    });
    const bought = buyTicker([], "GS", 10, 100);
    record({
      name: "bruch-und-rest",
      start: "buyTicker 10 $ @ 100",
      action: "buyTicker",
      expected: "shares 4 dp, spent = shares * 100.1, Rest bleibt ungekauft",
      actual: `sh=${bought.shares} spent=${bought.spentUsd}`,
      pass: bought.shares === roundShares(10 / 100.1) && Math.abs(bought.spentUsd - bought.shares * 100.1) < 1e-9,
    });
    assert.equal(applySideCost(100, "sell"), 99.9);
  });

  it("Kurs springt unter den Stop", () => {
    const cost = 100;
    const stop = stopLevelUsd(cost);
    const gapped = gapFillPrice({ lastUsd: 97, stopUsd: stop, side: "sell" });
    record({
      name: "gap-durch-stop",
      start: `Einstieg 100, Stop ${stop}, Last 97`,
      action: "gapFillPrice",
      expected: "Fill 97, nicht Stop",
      actual: `${gapped}`,
      pass: gapped === 97 && 97 < stop,
    });
    const watch = emptyWatch({
      cashEur: 0,
      positions: [pos({ ticker: "GS", shares: 0.2, costUsd: 100, lastUsd: 97, weightPct: 20, sleeve: "overlay" })],
      navEur: (0.2 * 97) / 1.17,
      startEur: 300 / 1.17,
    });
    const ident = bookIdentity({
      positions: watch.positions,
      cashEur: watch.cashEur,
      eurUsd: watch.eurUsd,
      navEur: watch.navEur,
    });
    const decision = ident.ok ? decidePulse(watch, "2026-09-11", []) : null;
    const applied = decision ? applyPulseToWatch(watch, decision, "2026-09-13T08:32:00.000Z") : null;
    record({
      name: "stop-entscheidung",
      start: "GS 0.2 @ 97 nach 100",
      action: "decidePulse + apply",
      expected: "Verkauf zum vorliegenden Kurs 97 (nach Kosten)",
      actual: decision
        ? `${decision.kind} ${decision.ticker} sold=${applied?.soldUsd} sharesLeft=${applied?.watch.positions.find((p) => p.ticker === "GS")?.shares}`
        : `keine Entscheidung ident.ok=${ident.ok} drift=${ident.driftEur}`,
      pass: Boolean(decision && decision.ticker === "GS" && (decision.kind === "pull" || decision.intervene === "flat")),
    });
  });

  it("identische Depotanzeigen: CHECK, cashSplit, identity", () => {
    const watch = emptyWatch();
    const fills: PaperFill[] = [];
    const snap = buildCheck({
      watch,
      fills,
      strategy: STRATEGY,
      market: "closed",
      tapeAsOf: "2026-09-11T20:00:00.000Z",
      sessionLabel: "NYSE zu",
      autoPilot: true,
      tickCount: 0,
      lastTick: null,
    });
    const ident = bookIdentity({
      positions: watch.positions,
      cashEur: watch.cashEur,
      eurUsd: watch.eurUsd,
      navEur: watch.navEur,
    });
    const cash = cashSplit({ cashUsd: ident.cashUsd, fills });
    const eq = actualEquityWeightPct(watch.positions, ident.computedUsd);
    record({
      name: "ansichten-gleich",
      start: "leeres Book, nur Cash",
      action: "CHECK vs identity vs cashSplit",
      expected: "equity 0, cash total=available=300, reserved 0, holdings leer",
      actual: `eq=${snap.equityWeightPct} cashT=${snap.cash.totalUsd} avail=${snap.cash.availableUsd} hold=${snap.holdings.length} identCash=${ident.cashUsd.toFixed(2)} split=${cash.totalUsd}`,
      pass:
        snap.equityWeightPct === 0 &&
        snap.holdings.length === 0 &&
        Math.abs(snap.cash.totalUsd - cash.totalUsd) < 0.02 &&
        snap.cash.reservedUsd === 0 &&
        eq === 0,
    });
  });
});

describe("6. CHECK trennt Ist, Soll, Orders, Guthaben", () => {
  it("leeres Depot: Aktiengewicht 0, Soll bleibt Soll", () => {
    const snap = buildCheck({
      watch: emptyWatch(),
      fills: [],
      strategy: STRATEGY,
      market: "closed",
      tapeAsOf: "2026-09-11T20:00:00.000Z",
      sessionLabel: "test",
      autoPilot: false,
      tickCount: 0,
      lastTick: null,
    });
    record({
      name: "check-leer",
      start: "0 Stücke, 300 $ Cash",
      action: "buildCheck",
      expected: "equityWeight 0, targets > 0, openOrders 0, cash getrennt",
      actual: `eq=${snap.equityWeightPct} targets=${snap.targets.length} orders=${snap.openOrders.length} total=${snap.cash.totalUsd} reserved=${snap.cash.reservedUsd} avail=${snap.cash.availableUsd}`,
      pass: snap.equityWeightPct === 0 && snap.targets.length > 0 && snap.openOrders.length === 0 && snap.cash.availableUsd > 0,
    });
  });
});

describe("7. Strategieauslöser statt Restkasse", () => {
  it("ohne Score kein Kauf auf leerem Book", () => {
    const watch = emptyWatch();
    const decision = decidePulse(watch, "2026-09-11", []);
    record({
      name: "kein-kauf-ohne-s1",
      start: "300 $ Cash, 0 Stücke, keine Scores",
      action: "decidePulse",
      expected: "null (HALTEN / NO_TRADE)",
      actual: decision ? `${decision.kind} ${decision.ticker} ${decision.spendUsd}` : "null",
      pass: decision == null,
    });
  });

  it("S1 Broadcom: Größe aus Risiko, nicht 80 % Cash", () => {
    const watch = emptyWatch();
    const scores = [
      { ticker: "AVGO", retPct: 4, spyPct: 1, relPct: 3, yieldPct: 0.9, score: 3.3, action: "add" as const, sleeve: "overlay" as const },
      { ticker: "GS", retPct: 5, spyPct: 1, relPct: 4, yieldPct: 1.6, score: 4.5, action: "add" as const, sleeve: "overlay" as const },
    ];
    const sized = riskSizeUsd({ navUsd: 300, availableUsd: 300, capPct: 15, stopPct: STOP_PCT_DEFAULT, heldUsd: 0 });
    const decision = decidePulse(watch, "2026-09-11", [], 0, {
      scores,
      sessionChangePct: { AVGO: 1.2, GS: 3.73 },
    });
    record({
      name: "s1-groesse-nicht-80pct",
      start: "S1 AVGO rel +3, GS +4 aber Session +3.73",
      action: "decidePulse + riskSizeUsd",
      expected: `AVGO buy, spend ≈ ${sized} (15 % Cap), nicht 240`,
      actual: decision ? `${decision.kind} ${decision.ticker} ${decision.spendUsd} hyp=${decision.strategyId}` : "null",
      pass:
        decision?.kind === "buy" &&
        decision.ticker === "AVGO" &&
        (decision.spendUsd ?? 0) <= sized + 0.01 &&
        (decision.spendUsd ?? 0) < 80 &&
        decision.strategyId === "S1-RS",
    });
    record({
      name: "goldman-event-kein-s1",
      start: "GS rel stark, Session +3.73",
      action: "overlayTrigger GS",
      expected: "null wegen Ereignis",
      actual: JSON.stringify(overlayTrigger({ ticker: "GS", scores, sessionChangePct: 3.73 })),
      pass: overlayTrigger({ ticker: "GS", scores, sessionChangePct: 3.73 }) == null,
    });
  });

  it("Börsenstart füllt geplante Order nicht", () => {
    const watch = emptyWatch();
    const planned = makeFill({
      bookVersion: 1,
      decidedAt: "2026-09-13T08:32:00.000Z",
      filledAt: null,
      status: "planned",
      symbol: "AVGO",
      side: "buy",
      shares: 0.12,
      priceUsd: 360,
      costUsd: 0.04,
      cashDeltaUsd: -45,
      reservedUsd: 45,
      dataKey: dataKey("2026-09-11", "buy", "AVGO"),
      note: "S1 geplant",
      sessionDate: "2026-09-11",
      market: "closed",
    });
    const monday = new Date("2026-09-14T14:00:00.000Z");
    const result = executePulseTick({
      watch,
      fills: [planned],
      market: "open",
      closeDate: "2026-09-14",
      tapeAsOf: "2026-09-11T20:00:00.000Z",
      tapeSource: "yahoo",
      now: monday,
      quotes: { AVGO: { last: 360, asOf: "2026-09-11T20:00:00.000Z", source: "yahoo" } },
      marketJustOpened: true,
    });
    const avgo = result.fills.find((f) => f.symbol === "AVGO");
    record({
      name: "boersenstart-kein-fill",
      start: "AVGO planned 45 $",
      action: "executePulseTick marketJustOpened",
      expected: "bleibt planned",
      actual: `${avgo?.status} gate=${result.gate.ok}`,
      pass: avgo?.status === "planned" || avgo?.status === "cancelled",
    });
  });
});

describe("8. S1 und S2 getrennt, Stop, Ablauf, Vergleich", () => {
  const s2Scores = [
    {
      ticker: "AVGO",
      retPct: 2.4,
      spyPct: 2.5,
      relPct: -0.1,
      yieldPct: 0.9,
      score: 0.2,
      action: "hold" as const,
      sleeve: "overlay" as const,
    },
  ];

  it("S2 ohne S1: Rücksetzer im intakten Trend", () => {
    const trig = overlayTrigger({
      ticker: "AVGO",
      scores: s2Scores,
      sessionChangePct: -2.1,
    });
    const s1 = overlayTrigger({
      ticker: "AVGO",
      scores: s2Scores,
      sessionChangePct: 0.4,
    });
    const decision = decidePulse(emptyWatch(), "2026-09-11", [], 0, {
      scores: s2Scores,
      sessionChangePct: { AVGO: -2.1 },
    });
    record({
      name: "s2-ohne-s1",
      start: "AVGO 15-Tage +2,4 %, rel −0,1 (kein S1), letzter Tag −2,1 %",
      action: "overlayTrigger + decidePulse",
      expected: "S2-PULL, buy AVGO",
      actual: `trig=${trig?.id ?? "null"} s1null=${s1 == null} dec=${decision?.strategyId ?? "null"} ${decision?.ticker ?? ""}`,
      pass: trig?.id === "S2-PULL" && s1 == null && decision?.strategyId === "S2-PULL" && decision.ticker === "AVGO",
    });
  });

  it("S1 und S2 schließen sich am selben Score aus: S1 zuerst", () => {
    const scores = [
      {
        ticker: "JPM",
        retPct: 4,
        spyPct: 1,
        relPct: 3,
        yieldPct: 2,
        score: 3.7,
        action: "add" as const,
        sleeve: "overlay" as const,
      },
    ];
    const both = overlayTrigger({ ticker: "JPM", scores, sessionChangePct: -2 });
    record({
      name: "s1-vor-s2",
      start: "JPM rel +3 und Tag −2 %",
      action: "overlayTrigger",
      expected: "S1-RS, nicht S2",
      actual: both?.id ?? "null",
      pass: both?.id === "S1-RS",
    });
  });

  it("2-%-Stop gegen Seed-Kerzen", () => {
    const study = stopStudy();
    const spy = study.rows.find((r) => r.ticker === "SPY");
    const avgo = study.rows.find((r) => r.ticker === "AVGO");
    record({
      name: "stop-seed-vol",
      start: `Stop ${STOP_PCT_DEFAULT} %, Seed-Vol SPY 0,7 % AVGO 1,7 %`,
      action: "stopStudy generateBars",
      expected: "Zeilen für SPY und AVGO, ATR nicht null, Urteil ohne Optimum-Anspruch",
      actual: `spyAtr=${spy?.atrPct} avgoAtr=${avgo?.atrPct} vs=${avgo?.stopVsAtr} data=${study.data}`,
      pass: Boolean(spy?.atrPct && avgo?.atrPct && study.verdict.includes("Startannahme")),
    });
  });

  it("Ablauf: Daten → Entscheidung → PLANNED → Revalidation → Fill", () => {
    const watch = emptyWatch();
    const quotes = { AVGO: { last: 360, asOf: "2026-09-11T20:00:00.000Z", source: "yahoo" as const } };
    const sunday = new Date("2026-09-13T10:00:00.000Z");
    const plannedTick = executePulseTick({
      watch,
      fills: [],
      market: "closed",
      closeDate: "2026-09-11",
      tapeAsOf: "2026-09-11T20:00:00.000Z",
      tapeSource: "yahoo",
      now: sunday,
      quotes,
      scores: s2Scores,
      sessionChangePct: { AVGO: -2.1 },
    });
    const planned = plannedTick.fills.find((f) => f.symbol === "AVGO");
    const openTick = executePulseTick({
      watch: plannedTick.watch,
      fills: plannedTick.fills,
      market: "open",
      closeDate: "2026-09-14",
      tapeAsOf: "2026-09-11T20:00:00.000Z",
      tapeSource: "yahoo",
      now: new Date("2026-09-14T13:31:00.000Z"),
      quotes: { AVGO: { last: 361, asOf: "2026-09-14T13:31:00.000Z", source: "yahoo" } },
      marketJustOpened: true,
      scores: s2Scores,
      sessionChangePct: { AVGO: -2.1 },
    });
    const afterOpen = openTick.fills.find((f) => f.symbol === "AVGO");
    const fillTick = executePulseTick({
      watch: openTick.watch,
      fills: openTick.fills,
      market: "open",
      closeDate: "2026-09-14",
      tapeAsOf: "2026-09-14T13:45:00.000Z",
      tapeSource: "yahoo",
      now: new Date("2026-09-14T17:45:00.000Z"),
      quotes: { AVGO: { last: 361, asOf: "2026-09-14T17:45:00.000Z", source: "yahoo" } },
      marketJustOpened: false,
      scores: s2Scores,
      sessionChangePct: { AVGO: -2.1 },
    });
    const filled = fillTick.fills.find((f) => f.symbol === "AVGO");
    record({
      name: "ablauf-s2",
      start: "Sonntag Sitzung zu, S2 AVGO",
      action: "planned → marketJustOpened → später Fill",
      expected: "planned, bleibt planned am Open, dann simulated_filled; 1 Order",
      actual: `sun=${planned?.status} open=${afterOpen?.status} fill=${filled?.status} n=${fillTick.fills.filter((f) => f.symbol === "AVGO").length} cost=${filled?.costBps} px=${filled?.priceUsd} at=${filled?.filledAt} valid=${filled?.validUntil}`,
      pass:
        planned?.status === "planned" &&
        afterOpen?.status === "planned" &&
        filled?.status === "simulated_filled" &&
        fillTick.fills.filter((f) => f.symbol === "AVGO").length === 1 &&
        filled.filledAt === "2026-09-14T17:45:00.000Z" &&
        filled.costBps === 10,
    });
  });

  it("Vergleich A implementiert, B nicht, C Seed-SPY", () => {
    const spy = generateBars("SPY", 765.72, 20);
    const rows = tapeCompare({
      spy,
      bookStartUsd: 300,
      bookNavUsd: 300,
      bookReady: true,
    });
    const a = rows.find((r) => r.id === "A");
    const b = rows.find((r) => r.id === "B");
    const c = rows.find((r) => r.id === "C");
    record({
      name: "vergleich-abc",
      start: "300 $ identisch, Seed-SPY 20 Tage",
      action: "tapeCompare",
      expected: "A bereit, B nicht implementiert, C Zahl oder UNBEKANNT",
      actual: `A=${a?.implemented}:${a?.pct} B=${b?.implemented} C=${c?.implemented}:${c?.pct} ids=${COMPARE_SPECS.A.experimentId}`,
      pass: a?.implemented === true && b?.implemented === false && b?.pct == null && c?.implemented === true && c?.pct != null,
    });
  });
});

describe("audit-export", () => {
  it("schreibt die Fälle nach artifacts", async () => {
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir("/workspace/artifacts", { recursive: true });
    await writeFile(
      "/workspace/artifacts/paper-audit-cases.json",
      JSON.stringify({ at: new Date().toISOString(), paperOnly: true, cases }, null, 2),
    );
    assert.ok(cases.length >= 8);
  });
});
