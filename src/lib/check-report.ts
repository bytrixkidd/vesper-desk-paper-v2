import { CFG_VERSION, CONFIG_NOTE, MODE, PAPER_V2_BOOK_ID, PAPER_V2_EXPERIMENT_ID, START_USD } from "./config.ts";
import { actualEquityWeightPct, bookIdentity, canSimulateFill, cashSplit } from "./ledger.ts";
import { goldmanReport } from "./orders.ts";
import { bookView } from "./paper.ts";
import { displayName, instrumentNote } from "./names.ts";
import { HYPOTHESES, hypLines } from "./hypotheses.ts";
import { DECISION_PATH, RUNTIME_NOTE } from "./roles.ts";
import { tapeCompare } from "./compare.ts";
import { LEGACY_CASH_FINDINGS } from "./legacy-cash.ts";
import type { Bar, BookIndex, BookRecord, BookStrategy, DemoWatch, PaperFill } from "./types.ts";
import { combinedReport } from "./books.ts";
import type { PaperSave } from "./books.ts";
import type { SleeveScore } from "./engine.ts";

export type CheckHolding = {
  ticker: string;
  name: string;
  shares: number;
  lastUsd: number;
  actualWeightPct: number;
  targetWeightPct: number | null;
  pnlUsd: number;
  note: string;
};

export type CheckTarget = {
  ticker: string;
  name: string;
  targetWeightPct: number;
};

export type CheckChance = {
  ticker: string;
  name: string;
  hyp: string;
  against: string;
};

export type CheckSnapshot = {
  at: string;
  experimentId: string;
  bookId: string;
  closeDate: string;
  sessionLabel: string;
  holdings: CheckHolding[];
  targets: CheckTarget[];
  openOrders: PaperFill[];
  cash: { totalUsd: number; reservedUsd: number; availableUsd: number };
  equityWeightPct: number;
  navUsd: number;
  depositedUsd: number;
  pnlUsd: number;
  identityOk: boolean;
  identityLine: string;
  lock: string | null;
  books: BookRecord[];
  goldman: ReturnType<typeof goldmanReport>;
  plan: string;
  chances: CheckChance[];
  stateBlock: string;
};

function chancesFrom(scores: SleeveScore[] | undefined, sessionChange: Record<string, number> | undefined): CheckChance[] {
  if (!scores?.length) return [];
  const out: CheckChance[] = [];
  for (const s of scores.filter((x) => x.sleeve === "overlay").sort((a, b) => b.relPct - a.relPct)) {
    if (s.ticker === "TSLA") continue;
    if (s.relPct >= 1) {
      out.push({
        ticker: s.ticker,
        name: displayName(s.ticker),
        hyp: `S1 ${s.relPct >= 0 ? "+" : ""}${s.relPct.toFixed(1)} pp vs Markt`,
        against:
          s.ticker === "GS" && (sessionChange?.GS ?? 0) >= 2
            ? "Freitagsplus ist Ereignis, kein Regime."
            : "Schon im Korb SPY/VOO enthalten; Überlappung nicht als zweiter Markt lesen.",
      });
    } else if (s.retPct > 0 && (sessionChange?.[s.ticker] ?? 0) <= -1.5 && s.relPct >= -0.5) {
      out.push({
        ticker: s.ticker,
        name: displayName(s.ticker),
        hyp: `S2 Rücksetzer, 15-Tage ${s.retPct.toFixed(1)} %`,
        against: "Ein gefallener Tag allein beweist keinen positiven Erwartungswert.",
      });
    }
    if (out.length >= 3) break;
  }
  return out;
}

export function buildCheck(args: {
  watch: DemoWatch | null;
  fills: PaperFill[];
  strategy: BookStrategy;
  market: "open" | "closed";
  tapeAsOf: string | null;
  sessionLabel: string;
  autoPilot: boolean;
  tickCount: number;
  lastTick: string | null;
  index?: BookIndex | null;
  archive?: PaperSave | null;
  now?: Date;
  scores?: SleeveScore[];
  sessionChangePct?: Record<string, number>;
  spyBars?: Bar[];
  nvdaBars?: Bar[];
}): CheckSnapshot {
  const now = args.now ?? new Date();
  const w = args.watch;
  const fx = w?.eurUsd || 1.17;
  const view = bookView({
    startEur: w?.startEur,
    navEur: w?.navEur,
    cashEur: w?.cashEur ?? 0,
    eurUsd: fx,
    spyPct: w?.spyPct,
    relativePct: w?.relativePct,
  });
  const ident = w
    ? bookIdentity({ positions: w.positions, cashEur: w.cashEur, eurUsd: w.eurUsd, navEur: w.navEur })
    : null;
  const close = w?.tapeCloseDate || args.tapeAsOf?.slice(0, 10) || "unbekannt";
  const gate = canSimulateFill({
    market: args.market,
    phase: w?.phase === "replay" ? "replay" : "live",
    closeDate: close,
    now,
  });
  const lock = w?.tradeLock || (ident && !ident.ok ? ident.lock : null) || (!gate.ok ? gate.reason : null);
  const cash = cashSplit({ cashUsd: view.cashUsd, fills: args.fills });
  const holdings: CheckHolding[] = (w?.positions ?? [])
    .filter((p) => p.shares > 0)
    .sort((a, b) => b.weightPct - a.weightPct)
    .map((p) => ({
      ticker: p.ticker,
      name: displayName(p.ticker),
      shares: p.shares,
      lastUsd: p.lastUsd,
      actualWeightPct: p.weightPct,
      targetWeightPct: args.strategy.sleeves.find((s) => s.ticker === p.ticker)?.weightPct ?? null,
      pnlUsd: p.shares * (p.lastUsd - p.costUsd),
      note: instrumentNote(p.ticker) ?? "",
    }));
  const equityWeightPct = actualEquityWeightPct(w?.positions ?? [], view.navUsd);
  const targets: CheckTarget[] = args.strategy.sleeves
    .filter((s) => s.weightPct > 0)
    .map((s) => ({ ticker: s.ticker, name: displayName(s.ticker), targetWeightPct: s.weightPct }));
  const openOrders = args.fills.filter((f) => f.status === "planned" || f.status === "blocked");
  const goldman = goldmanReport({
    fills: args.fills,
    watch: w,
    market: args.market,
    closeDate: close,
    now,
    sessionChangePct: args.sessionChangePct?.GS,
  });
  const books = args.index
    ? combinedReport(args.index, args.archive ?? null, {
        watch: w,
        extraDemos: [],
        extraHarvests: [],
        liveStatus: "live",
        tickCount: args.tickCount,
        fills: args.fills,
      }).rows
    : [];
  const chances = chancesFrom(args.scores, args.sessionChangePct);
  const plan = !view.ready
    ? "NO_TRADE, Book fehlt."
    : lock
      ? "NO_TRADE (Sperre oder Sitzung zu)."
      : args.market === "closed"
        ? "NO_TRADE bis zur nächsten Sitzung. Recherche erlaubt. Kein Fill zum alten Schluss. S0-Kern wird nicht automatisch gekauft."
        : chances.length
          ? "HALTEN, bis eine S1/S2-Order nach erneuter Prüfung bestätigt ist. Börsenstart allein ist kein Kaufgrund."
          : "NO_TRADE. Kein Strategieauslöser. Cash bleiben lassen.";

  const state = {
    at: now.toISOString(),
    experimentId: w?.experimentId ?? PAPER_V2_EXPERIMENT_ID,
    bookId: w?.bookId ?? PAPER_V2_BOOK_ID,
    cfg: CFG_VERSION,
    navUsd: view.ready ? Number(view.navUsd.toFixed(2)) : null,
    cashUsd: view.ready ? Number(view.cashUsd.toFixed(2)) : null,
    reservedUsd: cash.reservedUsd,
    availableUsd: cash.availableUsd,
    equityWeightPct: view.ready ? equityWeightPct : 0,
    closeDate: close,
    market: args.market,
    fills: openOrders.map((f) => ({ id: f.id, status: f.status, symbol: f.symbol, side: f.side, shares: f.shares })),
    historyStatus: w?.historyStatus ?? "complete",
  };

  return {
    at: now.toISOString(),
    experimentId: w?.experimentId ?? PAPER_V2_EXPERIMENT_ID,
    bookId: w?.bookId ?? PAPER_V2_BOOK_ID,
    closeDate: close,
    sessionLabel: args.sessionLabel,
    holdings,
    targets,
    openOrders,
    cash,
    equityWeightPct: view.ready ? equityWeightPct : 0,
    navUsd: view.ready ? view.navUsd : 0,
    depositedUsd: view.depositedUsd,
    pnlUsd: view.ready ? view.pnlUsd : 0,
    identityOk: ident?.ok ?? true,
    identityLine: ident
      ? `Buchung ${ident.ok ? "stimmt" : "driftet"} · Aktien ${ident.eqUsd.toFixed(2)} $ + Cash ${ident.cashUsd.toFixed(2)} $ = ${ident.computedUsd.toFixed(2)} $.`
      : "Kein laufendes Book.",
    lock,
    books,
    goldman,
    plan,
    chances,
    stateBlock: `STATE ${JSON.stringify(state)}`,
  };
}

export function formatCheck(snap: CheckSnapshot, extra: {
  autoPilot: boolean;
  tickCount: number;
  lastTick: string | null;
  cfg?: string;
  spyBars?: Bar[];
}): string[] {
  const mode = `${MODE}, Autopilot ${extra.autoPilot ? "an" : "Halt"} — ${RUNTIME_NOTE}`;
  const holdingLines =
    snap.holdings.length === 0
      ? ["Keine Stücke. Tatsächliches Aktiengewicht 0 %. Nur Cash oder Watch fehlt."]
      : snap.holdings.map(
          (h) =>
            `${h.name} (${h.ticker}) | ${h.shares.toFixed(4)} | Ist ${h.actualWeightPct.toFixed(1)} % | ${h.pnlUsd >= 0 ? "+" : ""}${h.pnlUsd.toFixed(2)} $ | halten${h.note ? ` | ${h.note}` : ""}`,
        );
  const targetLines = snap.targets
    .slice(0, 8)
    .map((t) => `${t.name} (${t.ticker}) Soll ${t.targetWeightPct.toFixed(1)} % — Ziel, nicht Bestand.`);
  const orderLines =
    snap.openOrders.length === 0
      ? ["Keine offenen Orders."]
      : snap.openOrders.map(
          (f) =>
            `${f.status} ${f.side} ${displayName(f.symbol)} (${f.symbol}) ${f.shares.toFixed(4)} @ ${f.priceUsd.toFixed(2)} $ · entschieden ${f.decidedAt} · Daten ${f.dataAsOf ?? "—"} · Kurszeit ${f.priceAsOf ?? "—"}`,
        );
  const bookLines =
    snap.books.length === 0
      ? []
      : snap.books.map(
          (b) =>
            `${b.role === "active" ? "Aktiv" : "Archiv"} ${b.bookId} / ${b.experimentId} · Historie ${b.historyStatus}${b.pnlUsd == null ? "" : ` · Ergebnis ${b.pnlUsd >= 0 ? "+" : ""}${b.pnlUsd.toFixed(2)} $`} · ${b.historyNote}`,
        );
  const gs = snap.goldman;
  const chanceLines =
    snap.chances.length === 0
      ? ["Keine belastbare neue Chance. S3 inaktiv (keine frische Primärmeldung). S0-Kern nicht auto."]
      : snap.chances.map((c) => `${c.name} (${c.ticker}): ${c.hyp}. Gegenargument: ${c.against}`);
  const compare = tapeCompare({
    spy: extra.spyBars,
    bookStartUsd: snap.depositedUsd || START_USD,
    bookNavUsd: snap.navUsd,
    bookReady: snap.navUsd > 0 || snap.cash.totalUsd > 0,
  });
  const compareLines = compare.map(
    (r) =>
      `${r.id} ${r.experimentId}: ${r.name} · ${r.implemented ? (r.pct == null ? "UNBEKANNT" : `${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(2)} %`) : "NICHT IMPLEMENTIERT"} · ${r.note}`,
  );
  return [
    `1. CHECK ${snap.at} · Datenstand Schluss ${snap.closeDate} · ${snap.sessionLabel} · ${mode} · ${extra.cfg ?? CFG_VERSION}`,
    `Aktives Book ${snap.bookId} · Experiment ${snap.experimentId}. Lehrwochen und Floor-Seed sind Beispiele, kein Journal dieses Books.`,
    `2. Depot ${snap.navUsd.toFixed(2)} $ · Einsatz ${snap.depositedUsd.toFixed(2)} $ · Ergebnis ${snap.pnlUsd >= 0 ? "+" : ""}${snap.pnlUsd.toFixed(2)} $.`,
    `Guthaben gesamt ${snap.cash.totalUsd.toFixed(2)} $ · reserviert ${snap.cash.reservedUsd.toFixed(2)} $ · verfügbar ${snap.cash.availableUsd.toFixed(2)} $.`,
    `Tatsächliches Aktiengewicht ${snap.equityWeightPct.toFixed(1)} %. Bei leerem Depot ist das null, unabhängig vom Soll.`,
    snap.lock ? `Sperre: ${snap.lock}` : "Keine Risikosperre.",
    snap.identityLine,
    "3. Positionen (Ist, nicht Soll):",
    ...holdingLines,
    "Zielgewichte (Soll, nicht Bestand):",
    ...targetLines,
    "Offene Orders (nicht im Bestand):",
    ...orderLines,
    `Goldman: ${gs.exists ? `${gs.status}, geplant ${gs.plannedUsd?.toFixed(2) ?? "—"} $, ausführbar ${gs.executable ? "ja" : "nein"}` : "keine persistierte Order"}. ${gs.note}`,
    "4. Höchstens drei Chancen:",
    ...chanceLines,
    `5. Aktionsplan: ${snap.plan} Geplante und ausgeführte Aktionen getrennt. Modellaufrufe im Kaufpfad: 0.`,
    DECISION_PATH,
    "6. Risiken, Quellen, nächste Prüfung:",
    CONFIG_NOTE,
    ...hypLines(),
    `S3 Status: ${HYPOTHESES["S3-EVENT"].note}`,
    ...compareLines,
    ...bookLines,
    "Archiv-Cash (Screenshots, nicht dieses Book):",
    ...LEGACY_CASH_FINDINGS.map((f) => `${f.label}: ${f.text}`),
    `Autopilot: letzter Takt ${extra.lastTick ?? "—"}, Zähler ${extra.tickCount}. ${RUNTIME_NOTE}`,
    "Nächste Prüfung: nächste reguläre NYSE-Sitzung nach Daten-, Buchhaltungs- und Limitprüfung. Kein Fill nur weil die Glocke läutet.",
    "Realisierter Gewinn bleibt im Book. 5.000 € / 20.000 € im Monat sind Szenarien bei anderer Größe, kein Ergebnis dieses 300-$-Tests.",
    snap.stateBlock,
  ];
}
