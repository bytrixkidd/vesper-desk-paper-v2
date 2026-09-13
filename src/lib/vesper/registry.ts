import type { ChartRange } from "@/lib/charts";
import type { DeskId } from "@/lib/types";
import { DESK_ALIAS, findAllTickers, fold, resolveBot, resolveDesk, resolveRange, resolveTicker } from "./catalog";
import { spokenName } from "./plain";
import type { AnswerStage, TalkTopic, VesperAction } from "./types";

export const TARGET = {
  chartMain: "chart.main",
  chartPrice: "chart.price",
  chartVolume: "chart.volume",
  chartDrop: "chart.latestDrop",
  chartRise: "chart.latestRise",
  chartSelected: "chart.selectedDate",
  chartEvent: "chart.relevantEvent",
  rangeWeek: "chart.range.oneWeek",
  rangeMonth: "chart.range.oneMonth",
  rangeQuarter: "chart.range.threeMonths",
  rangeYear: "chart.range.oneYear",
  diagPanel: "diag.panel",
  diagDay: "diag.currentDay",
  diagNeed: "diag.missing",
  filingRow: "filing.selected",
  flowRow: "flow.selected",
  botRow: "floor.bots",
  portfolio: "trade.position",
} as const;

export const RANGE_TARGET: Record<string, ChartRange> = {
  "chart.range.oneWeek": "1W",
  "chart.range.oneMonth": "1M",
  "chart.range.threeMonths": "3M",
  "chart.range.oneYear": "1J",
  "chart.range.fiveYears": "5J",
  "chart.range.tenYears": "10J",
  "chart.range.full": "ALL",
};

export type IntentKind =
  | "stop"
  | "mute"
  | "style"
  | "goBack"
  | "closeDetail"
  | "simpler"
  | "details"
  | "followWhy"
  | "followWhich"
  | "followWhatIf"
  | "openSecurity"
  | "openSection"
  | "markDrop"
  | "markRise"
  | "explain"
  | "showFiling"
  | "showBots"
  | "showDiagnosis"
  | "showFlows"
  | "diagProgress"
  | "diagMissing"
  | "startDiagnosis"
  | "killDiagnosis"
  | "refreshDiagnosis"
  | "compare"
  | "scenario"
  | "prepareTrade"
  | "portfolio"
  | "brief"
  | "risk"
  | "paperMoney"
  | "check"
  | "lifeGoal"
  | "advice"
  | "unknown";

export type PlanContext = {
  symbol?: string | null;
  topic?: TalkTopic;
  stage?: AnswerStage;
};

export type ActionPlan = {
  kind: IntentKind;
  actions: VesperAction[];
  interpretation: string;
  wantsAi: boolean;
  stop: boolean;
  topic: TalkTopic;
  stage: AnswerStage;
  opening?: string;
};

function amountEur(text: string): number | null {
  const m = fold(text).match(/(\d+[.,]?\d*)\s*(euro|eur|€)/);
  if (!m) return null;
  return Number(m[1]!.replace(",", "."));
}

function daysIn(text: string): number {
  const m = fold(text).match(/(\d+)\s*(handelstag|tag)/);
  if (m) return Math.min(30, Math.max(1, Number(m[1])));
  if (/eine woche|sieben/.test(fold(text))) return 5;
  return 5;
}

function classify(raw: string, ctx: PlanContext): IntentKind {
  const f = fold(raw);
  const short = f.length < 48;
  if (/^(stopp|stop|halt|sei still|ruhe|genug|still|gespraech beenden|gespraech ende)$/.test(f) || /^(stopp|stop|sei still)\b/.test(f)) {
    return "stop";
  }
  if (/stumm|mute|kein ton/.test(f) && short) return "mute";
  if (/erklaere es noch einfacher|noch einfacher|ohne fachbegriff|einfacher bitte/.test(f)) return "simpler";
  if (/zeig mir alle (daten|details)|alle details|stufe drei|vollstaendig/.test(f)) return "details";
  if (/kuerzer|knapp|weniger text|fasse dich/.test(f) && short) return "style";
  if (/^(warum|weshalb|wieso)\??$/.test(f) || /^warum (abwarten|nicht|das|denn)/.test(f)) return "followWhy";
  if (/^(welche|welches|was fehlt)\??$/.test(f) || /was fehlt noch|welche bestaetigung/.test(f)) return "followWhich";
  if (/und wenn (das|es) passiert|wenn das passiert|und dann/.test(f) && short) return "followWhatIf";
  if (/geh zurueck zur diagnose|zurueck zur diagnose/.test(f)) return "showDiagnosis";
  if (/^(zurueck|geh zurueck|go back)\??$/.test(f) || /geh zurueck/.test(f)) return "goBack";
  if (/schliess|zu machen|detail zu/.test(f) && short) return "closeDetail";
  if (/seit gestern|was ist passiert|daily brief|tagesbrief|was ist neu|erklaer|in einfachen worten|was bedeutet/.test(f) && !resolveTicker(raw) && !ctx.symbol) {
    return "brief";
  }
  if ((/beobachte|diagnose starten|^diagnose\b|starte (eine )?diagnose/.test(f) || (/diagnose/.test(f) && /tag|fenster/.test(f))) && !/wie weit|stand|abbrechen|was fehlt|zeig/.test(f)) {
    return "startDiagnosis";
  }
  if (/diagnose.*(abbrechen|stopp)|abbruch der diagnose/.test(f)) return "killDiagnosis";
  if (/pruefe.*(diagnose)|diagnose.*pruefen|aktualisiere die diagnose/.test(f)) return "refreshDiagnosis";
  if (/wie weit.*(diagnose|pruefung)|diagnose.*stand|tag \d+ von/.test(f)) return "diagProgress";
  if (/was fehlt|welche bestaetigung|was muesste passieren/.test(f)) return "diagMissing";
  if (/zeig mir die diagnose|oeffne die diagnose|laufende diagnose|zeig mir die pruefung/.test(f)) return "showDiagnosis";
  if (/was sagen die bots|bots dazu|meinung der bots/.test(f)) return "showBots";
  if (/zeig mir die meldung|oeffne die meldung|originalquelle|filing zeigen/.test(f)) return "showFiling";
  if (/oeffne (jetzt )?die grossen kaeufe|grosse kaeufe|whale|grosse anleger/.test(f) && /zeig|oeffne|kaeufe/.test(f)) {
    return "showFlows";
  }
  if (/markiere den letzten rueckgang|letzter rueckgang|wo sie stark gefallen|letzten starken fall/.test(f)) return "markDrop";
  if (/letzter anstieg|wo sie stark gestiegen|letzten starken anstieg/.test(f)) return "markRise";
  if (/erklaere mir einfach|was ist (dabei |hier )?passiert|was war an dieser stelle|was (hat|haben).+gemacht|was gab (es |bei)|entwicklung bei/.test(f)) return "explain";
  if ((/was ist (mit|bei)|wie laeuft|was macht/.test(f)) && resolveTicker(raw)) return "explain";
  if (/vergleiche|versus| vs\.? /.test(f) && findAllTickers(raw).length + (ctx.symbol ? 1 : 0) >= 2) return "compare";
  if (/negativ(es)? szenario|positiv(es)? szenario|basisszenario/.test(f)) return "scenario";
  if (/risiko|verlust/.test(f) && amountEur(raw)) return "risk";
  if (/paper[- ]?trade|papierhandel|trade vorbereiten|kaufplan/.test(f)) return "prepareTrade";
  if (/portfolio|position im book|im depot/.test(f)) return "portfolio";
  if (/5[ .]?000|20[ .]?000|dieses jahr|jahresziel|im monat.*(gewinn|plus)|wie viel (kapital|einsatz)|schritt(e)? fuer schritt|was (soll|muss) man tun/.test(f)) {
    return "lifeGoal";
  }
  if (/^check\b|depotpruefung|buchhaltung|audit jetzt/.test(f)) return "check";
  if (
    /echtes? geld|echtgeld|kein geld|spielgeld|fake|nur anzeig|irgendwas anzeig|wirklich (gerechnet|investiert|verdient|gewinn)|hat .* gewinn|so viel gewinn|paper oder live|ist das echt|tut (es|das|ja) so|als (hatte|habe|hat|ware)|gedacht.*echt|kein echtes|fake[- ]?gewinn|rechnet das system|300.?dollar|testlauf/.test(
      f,
    )
  ) {
    return "paperMoney";
  }
  if (
    /empf(ie)?hl|^empf|\banlagetipp\b|\btipp\b|soll (ich|man) (kaufen|verkaufen|halten)|was tun (bei|mit)|kaufen oder verkaufen|was raten/.test(f)
  ) {
    return "advice";
  }
  if ((/was ist (mit|bei)|wie laeuft/.test(f)) && resolveTicker(raw)) {
    return "advice";
  }
  if ((/oeffne|zeig mir|chart von|aktie von/.test(f) && (resolveTicker(raw) || ctx.symbol)) || (resolveTicker(raw) && f.length < 22 && !/empfehl|tipp|kaufen|halten|warum|wie viel|was ist|was gab/.test(f))) {
    return "openSecurity";
  }
  if ((/zeig|was ist mit|wie laeuft|was ist bei/.test(f)) && (resolveTicker(raw) || ctx.symbol) && /oeffne|zeig|chart/.test(f)) {
    return "openSecurity";
  }
  if (resolveDesk(raw) && /oeffne|zeig|geh zu/.test(f)) return "openSection";
  if (resolveDesk(raw) && f.length < 28) return "openSection";
  if (ctx.symbol && /was ist|wie steht|erklaer/.test(f)) return "openSecurity";
  return "unknown";
}

function deskForRange(range: ChartRange | null): DeskId {
  if (range === "ALL") return "charts";
  if (range === "1J" || range === "5J" || range === "10J") return "universe";
  return "charts";
}

export function planFromText(raw: string, ctx: PlanContext = {}): ActionPlan {
  const text = raw.trim();
  const f = fold(text);
  const tickers = findAllTickers(text);
  const symbol = tickers[0] ?? resolveTicker(text) ?? ctx.symbol ?? null;
  const desk = resolveDesk(text);
  const range = resolveRange(text);
  const bot = resolveBot(text);
  const kind = classify(text, ctx);
  const focus = symbol ?? ctx.symbol ?? null;

  if (kind === "stop") {
    return { kind, actions: [{ type: "stop" }], interpretation: "Sprechen beenden.", wantsAi: false, stop: true, topic: ctx.topic ?? null, stage: ctx.stage ?? 1 };
  }
  if (kind === "mute") {
    return { kind, actions: [{ type: "mute" }], interpretation: "Ton aus.", wantsAi: false, stop: true, topic: ctx.topic ?? null, stage: ctx.stage ?? 1 };
  }
  if (kind === "simpler") {
    return {
      kind,
      actions: [{ type: "setStyle", style: "plain" }, { type: "setStage", stage: 1 }, ...(focus ? [{ type: "intelAsk" as const, which: "change" as const }] : [])],
      interpretation: "Noch einfacher erklären.",
      wantsAi: false,
      stop: false,
      topic: ctx.topic ?? "security",
      stage: 1,
    };
  }
  if (kind === "details") {
    return {
      kind,
      actions: [{ type: "setStage", stage: 3 }, ...(focus ? [{ type: "showCurrentDiagnoses" as const, symbol: focus }] : [])],
      interpretation: "Alle Daten zeigen.",
      wantsAi: true,
      stop: false,
      topic: ctx.topic ?? "security",
      stage: 3,
    };
  }
  if (kind === "style") {
    return { kind, actions: [{ type: "setStyle", style: "short" }], interpretation: "Kürzer.", wantsAi: false, stop: false, topic: ctx.topic ?? null, stage: 1 };
  }
  if (kind === "goBack") {
    return { kind, actions: [{ type: "goBack" }], interpretation: "Zurück.", wantsAi: false, stop: false, topic: ctx.topic ?? null, stage: ctx.stage ?? 1 };
  }
  if (kind === "closeDetail") {
    return { kind, actions: [{ type: "closeDetail" }], interpretation: "Detail schließen.", wantsAi: false, stop: false, topic: ctx.topic ?? null, stage: 1 };
  }
  if (kind === "followWhy") {
    return {
      kind,
      actions: [{ type: "intelAsk", which: "why" }, { type: "setStage", stage: 2 }],
      interpretation: "Begründung.",
      wantsAi: false,
      stop: false,
      topic: ctx.topic ?? "security",
      stage: 2,
    };
  }
  if (kind === "followWhich") {
    return {
      kind,
      actions: [
        { type: "intelAsk", which: "need" },
        { type: "highlightElement", targetId: TARGET.diagNeed, label: "Das fehlt noch." },
        { type: "setStage", stage: 2 },
      ],
      interpretation: "Was fehlt.",
      wantsAi: false,
      stop: false,
      topic: "diagnosis",
      stage: 2,
    };
  }
  if (kind === "followWhatIf") {
    return {
      kind,
      actions: [{ type: "intelAsk", which: "odds" }, { type: "setStage", stage: 2 }],
      interpretation: "Was dann passieren könnte.",
      wantsAi: false,
      stop: false,
      topic: ctx.topic ?? "scenario",
      stage: 2,
    };
  }

  if (kind === "brief") {
    return {
      kind,
      actions: [
        { type: "dailyBrief" },
        { type: "openSection", sectionId: "charts" },
        { type: "openSecurity", symbol: "SPY" },
        { type: "selectChartRange", range: "1M" },
        { type: "highlightElement", targetId: TARGET.chartMain, label: "Der große US-Aktienkorb." },
      ],
      interpretation: "Stand zeigen.",
      wantsAi: false,
      stop: false,
      topic: "brief",
      stage: 2,
      opening: "Ich öffne den Chart und erkläre den Stand.",
    };
  }

  if (kind === "startDiagnosis") {
    const t = focus ?? "NVDA";
    const days = daysIn(text);
    return {
      kind,
      actions: [
        { type: "startDiagnosis", symbol: t, days },
        { type: "openSection", sectionId: "charts" },
        { type: "openSecurity", symbol: t },
        { type: "showCurrentDiagnoses", symbol: t },
      ],
      interpretation: `Prüfung ${t} über ${days} Tage.`,
      wantsAi: true,
      stop: false,
      topic: "diagnosis",
      stage: 1,
      opening: "Ich lege die Prüfung an, Sir.",
    };
  }
  if (kind === "killDiagnosis") {
    return { kind, actions: [{ type: "killDiagnosis" }], interpretation: "Prüfung beenden.", wantsAi: false, stop: false, topic: "diagnosis", stage: 1 };
  }
  if (kind === "refreshDiagnosis") {
    return { kind, actions: [{ type: "updateDiagnosis" }], interpretation: "Prüfung aktualisieren.", wantsAi: true, stop: false, topic: "diagnosis", stage: 1 };
  }
  if (kind === "diagProgress") {
    return {
      kind,
      actions: [
        { type: "showCurrentDiagnoses", symbol: focus ?? undefined },
        { type: "highlightElement", targetId: TARGET.diagDay, label: "Aktueller Prüftag." },
        { type: "setStage", stage: 2 },
      ],
      interpretation: "Fortschritt der Prüfung.",
      wantsAi: false,
      stop: false,
      topic: "diagnosis",
      stage: 2,
    };
  }
  if (kind === "diagMissing") {
    return {
      kind,
      actions: [
        { type: "intelAsk", which: "need" },
        { type: "highlightElement", targetId: TARGET.chartVolume, label: "Hier müsste das Volumen steigen." },
        { type: "setStage", stage: 2 },
      ],
      interpretation: "Fehlende Bestätigung.",
      wantsAi: false,
      stop: false,
      topic: "diagnosis",
      stage: 2,
    };
  }
  if (kind === "showDiagnosis") {
    const t = focus ?? undefined;
    return {
      kind,
      actions: [
        { type: "openSection", sectionId: "charts" },
        ...(t ? [{ type: "openSecurity" as const, symbol: t }] : []),
        { type: "showDiagnosis", symbol: t },
        { type: "highlightElement", targetId: TARGET.diagPanel, label: "Laufende Prüfung." },
        { type: "setStage", stage: 2 },
      ],
      interpretation: "Prüfung öffnen.",
      wantsAi: false,
      stop: false,
      topic: "diagnosis",
      stage: 2,
      opening: "Ich zeige die Prüfung, Sir.",
    };
  }
  if (kind === "showBots") {
    const t = focus ?? undefined;
    return {
      kind,
      actions: [
        { type: "openSection", sectionId: "chat" },
        { type: "showBotOpinions", symbol: t },
        { type: "highlightElement", targetId: TARGET.botRow, label: "Was die Bots dazu sagen." },
        { type: "setStage", stage: 2 },
      ],
      interpretation: "Bot-Meinungen.",
      wantsAi: true,
      stop: false,
      topic: "bots",
      stage: 2,
      opening: "Ich hole die Bot-Meinungen, Sir.",
    };
  }
  if (kind === "showFiling") {
    const t = focus ?? undefined;
    return {
      kind,
      actions: [
        { type: "openSection", sectionId: "filings" },
        { type: "openEvidence", symbol: t },
        { type: "highlightElement", targetId: TARGET.filingRow, label: "Die zugehörige Meldung." },
        { type: "setStage", stage: 2 },
      ],
      interpretation: "Unternehmensmeldung öffnen.",
      wantsAi: true,
      stop: false,
      topic: "filing",
      stage: 2,
      opening: "Ich öffne die Meldung, Sir.",
    };
  }
  if (kind === "showFlows") {
    const t = focus ?? "NVDA";
    return {
      kind,
      actions: [
        { type: "openSection", sectionId: "flows" },
        { type: "showFlows", ticker: t },
        { type: "highlightElement", targetId: `flow-${t}`, label: "Große Käufe und Verkäufe." },
        { type: "setStage", stage: 2 },
      ],
      interpretation: "Große Käufe öffnen.",
      wantsAi: true,
      stop: false,
      topic: "flows",
      stage: 2,
      opening: "Ich öffne die großen Käufe, Sir.",
    };
  }
  if (kind === "markDrop" || kind === "markRise") {
    const t = focus ?? "NVDA";
    const d = deskForRange(range);
    const drop = kind === "markDrop";
    const target = drop ? TARGET.chartDrop : TARGET.chartRise;
    return {
      kind,
      actions: [
        { type: "openSection", sectionId: d },
        { type: "openSecurity", symbol: t },
        ...(range ? [{ type: "selectChartRange" as const, range }] : [{ type: "selectChartRange" as const, range: "1M" as const }]),
        { type: "selectChartDate", date: drop ? "DROP" : "RISE" },
        { type: "highlightElement", targetId: target, label: drop ? "Hier begann der Rückgang." : "Hier begann der Anstieg." },
        { type: "setStage", stage: 1 },
      ],
      interpretation: drop ? `Rückgang bei ${t} markieren.` : `Anstieg bei ${t} markieren.`,
      wantsAi: true,
      stop: false,
      topic: "chart",
      stage: 1,
      opening: `Ich markiere das im Chart, Sir.`,
    };
  }
  if (kind === "explain") {
    const t = focus ?? ctx.symbol ?? "NVDA";
    return {
      kind,
      actions: [
        { type: "openSection", sectionId: "charts" },
        { type: "openSecurity", symbol: t },
        { type: "selectChartRange", range: range ?? "1M" },
        { type: "selectChartDate", date: "MOVE" },
        { type: "highlightElement", targetId: TARGET.chartEvent, label: "Hier begann die Veränderung." },
        { type: "setStage", stage: 1 },
      ],
      interpretation: `Einfach erklären: ${t}.`,
      wantsAi: true,
      stop: false,
      topic: "security",
      stage: 1,
    };
  }
  if (kind === "compare") {
    const left = tickers[0] ?? ctx.symbol ?? "NVDA";
    const right = tickers.find((x) => x !== left) ?? tickers[1] ?? "TSLA";
    return {
      kind,
      actions: [
        { type: "openSection", sectionId: "charts" },
        { type: "openSecurity", symbol: left },
        { type: "compareSecurities", symbols: [left, right] },
        { type: "setStage", stage: 1 },
      ],
      interpretation: `Vergleich ${left} und ${right}.`,
      wantsAi: true,
      stop: false,
      topic: "security",
      stage: 1,
      opening: "Ich lege beide nebeneinander, Sir.",
    };
  }
  if (kind === "scenario") {
    const which = /negativ|down|schlecht/.test(f) ? "down" : /positiv|up|gut/.test(f) ? "up" : "base";
    return {
      kind,
      actions: [{ type: "showScenario", symbol: focus ?? undefined, scenario: which }, { type: "setStage", stage: 2 }],
      interpretation: "Szenario.",
      wantsAi: true,
      stop: false,
      topic: "scenario",
      stage: 2,
    };
  }
  if (kind === "risk") {
    return {
      kind,
      actions: [{ type: "computeRisk", amountEur: amountEur(text)!, symbol: focus ?? undefined }],
      interpretation: "Risikorechnung.",
      wantsAi: true,
      stop: false,
      topic: "risk",
      stage: 2,
    };
  }
  if (kind === "prepareTrade") {
    const t = focus ?? "NVDA";
    const amt = amountEur(text) ?? 50;
    const side = /verkauf|short/.test(f) ? "sell" : "buy";
    return {
      kind,
      actions: [{ type: "openSection", sectionId: "demo" }, { type: "prepareTradePlan", symbol: t }, { type: "preparePaper", symbol: t, side, amountEur: amt }],
      interpretation: `Plan für ${t}.`,
      wantsAi: true,
      stop: false,
      topic: "risk",
      stage: 2,
    };
  }
  if (kind === "portfolio") {
    const t = focus ?? "SPY";
    return {
      kind,
      actions: [
        { type: "openSection", sectionId: "trade" },
        { type: "showPortfolioPosition", symbol: t },
        { type: "highlightElement", targetId: TARGET.portfolio, label: "Position im Book." },
      ],
      interpretation: "Position zeigen.",
      wantsAi: false,
      stop: false,
      topic: "risk",
      stage: 2,
    };
  }
  if (kind === "lifeGoal") {
    return {
      kind,
      actions: [{ type: "openSection", sectionId: "command" }],
      interpretation: "Jahresziel und Stufenplan.",
      wantsAi: false,
      stop: false,
      topic: "brief",
      stage: 2,
      opening: "Ich zeige den Stufenplan, Sir.",
    };
  }
  if (kind === "check") {
    return {
      kind,
      actions: [{ type: "openSection", sectionId: "command" }],
      interpretation: "Depotprüfung.",
      wantsAi: false,
      stop: false,
      topic: "brief",
      stage: 2,
      opening: "Ich prüfe Buchung und Tape.",
    };
  }
  if (kind === "paperMoney") {
    return {
      kind,
      actions: [
        { type: "openSection", sectionId: "demo" },
        { type: "highlightElement", targetId: "demo.watch", label: "Der 300-Dollar-Test." },
      ],
      interpretation: "Paper-Konto zeigen.",
      wantsAi: false,
      stop: false,
      topic: "brief",
      stage: 2,
      opening: "Ich öffne den Testlauf.",
    };
  }

  if (kind === "advice" || (kind === "unknown" && (symbol || focus) && /was |wie |warum|soll|empf(ie)?hl|kaufen|halten|tipp/.test(f))) {
    const t = symbol ?? focus ?? null;
    const actions: VesperAction[] = [];
    const desk: DeskId = /meldung|filing/.test(f)
      ? "filings"
      : /zahl|quartal|earnings|transkript/.test(f)
        ? "earnings"
        : /stimmung|sentiment/.test(f)
          ? "sentiment"
          : /grosse (kaeufe|anleger)|whale|flow/.test(f)
            ? "flows"
            : "charts";
    if (t) {
      actions.push({ type: "openSection", sectionId: desk });
      actions.push({ type: "openSecurity", symbol: t });
      if (desk === "charts") {
        actions.push({ type: "selectChartRange", range: range ?? "1M" });
        actions.push({ type: "selectChartDate", date: "MOVE" });
        actions.push({ type: "highlightElement", targetId: TARGET.chartEvent, label: `Was ${spokenName(t)} gemacht hat.` });
      }
      if (desk === "filings") actions.push({ type: "openEvidence", symbol: t });
      if (desk === "flows") actions.push({ type: "showFlows", ticker: t });
      if (desk === "sentiment") actions.push({ type: "showSentiment", ticker: t });
      if (desk === "earnings") actions.push({ type: "openEarnings", ticker: t });
      actions.push({ type: "selectTicker", symbol: t });
    }
    actions.push({ type: "intelAsk", which: "why" });
    return {
      kind,
      actions,
      interpretation: t ? `Zeigen und erklären: ${spokenName(t)}.` : "Tipp.",
      wantsAi: true,
      stop: false,
      topic: "security",
      stage: 2,
      opening: t ? `Ich öffne ${spokenName(t)} und erkläre.` : undefined,
    };
  }

  if (kind === "openSection" && desk) {
    const actions: VesperAction[] = [{ type: "openSection", sectionId: desk }];
    if (bot && desk === "chat") actions.push({ type: "openFloorBot", bot });
    return {
      kind,
      actions,
      interpretation: `Bereich ${desk} öffnen.`,
      wantsAi: false,
      stop: false,
      topic: null,
      stage: 1,
      opening: "Natürlich, Sir.",
    };
  }

  if (kind === "openSecurity") {
    const t = symbol ?? focus ?? "NVDA";
    const chartDesk = desk && desk !== "vesper" ? desk : deskForRange(range);
    const todayish = /heute|was ist (bei|mit)|wie laeuft|zeig mir|oeffne/.test(f);
    const actions: VesperAction[] = [
      { type: "openSection", sectionId: chartDesk === "vesper" ? "charts" : chartDesk },
      { type: "openSecurity", symbol: t },
    ];
    if (chartDesk === "charts" || chartDesk === "universe") {
      actions.push({ type: "selectChartRange", range: range ?? "1M" });
      actions.push({ type: "selectChartDate", date: todayish ? "MOVE" : "MOVE" });
      actions.push({ type: "highlightElement", targetId: TARGET.chartEvent, label: "Hier begann die Veränderung." });
      actions.push({ type: "showCurrentDiagnoses", symbol: t });
    }
    if (desk === "filings") actions.push({ type: "openEvidence", symbol: t });
    if (desk === "flows") actions.push({ type: "showFlows", ticker: t });
    if (desk === "sentiment") actions.push({ type: "showSentiment", ticker: t });
    if (desk === "earnings") actions.push({ type: "openEarnings", ticker: t });
    return {
      kind: "openSecurity",
      actions,
      interpretation: `Öffne ${spokenName(t)}.`,
      wantsAi: true,
      stop: false,
      topic: "security",
      stage: 1,
      opening: `Ich öffne ${spokenName(t)}, Sir.`,
    };
  }

  if (desk) {
    return {
      kind: "openSection",
      actions: [{ type: "openSection", sectionId: desk }],
      interpretation: `Bereich ${desk}.`,
      wantsAi: false,
      stop: false,
      topic: null,
      stage: 1,
      opening: "Natürlich, Sir.",
    };
  }

  return {
    kind: "unknown",
    actions: [],
    interpretation: "Freie Frage.",
    wantsAi: true,
    stop: false,
    topic: ctx.topic ?? "brief",
    stage: ctx.stage ?? 1,
  };
}

export function expandActions(actions: VesperAction[]): VesperAction[] {
  const out: VesperAction[] = [];
  for (const a of actions) {
    switch (a.type) {
      case "openSection":
        out.push({ type: "navigate", desk: a.sectionId });
        break;
      case "openSecurity":
        out.push({ type: "selectTicker", symbol: a.symbol });
        break;
      case "selectChartRange":
        out.push({ type: "setChartRange", range: a.range });
        break;
      case "selectChartDate":
        out.push({ type: "markDay", iso: a.date });
        break;
      case "focusElement":
      case "highlightElement":
        out.push({ type: "highlight", targetId: a.targetId, label: ("label" in a && a.label) || "Von Vesper markiert." });
        break;
      case "scrollToElement":
        out.push({ type: "scrollTo", targetId: a.targetId });
        break;
      case "openEvidence":
      case "openSource":
        out.push({ type: "openFiling", symbol: a.symbol, id: "evidenceId" in a ? a.evidenceId : "sourceId" in a ? a.sourceId : undefined });
        break;
      case "showBotOpinions":
        out.push({ type: "consultBots", question: a.symbol ? `Lage zu ${a.symbol}` : "Bot-Meinungen" });
        break;
      case "showDiagnosis":
      case "showCurrentDiagnoses":
        out.push({ type: "diagnosisStatus" });
        break;
      case "updateDiagnosis":
        out.push({ type: "refreshDiagnosis" });
        break;
      case "compareSecurities":
        if (a.symbols[0] && a.symbols[1]) out.push({ type: "compare", left: a.symbols[0], right: a.symbols[1] });
        break;
      case "showScenario":
        out.push({ type: "scenario", which: a.scenario, symbol: a.symbol });
        break;
      case "prepareTradePlan":
        break;
      default:
        out.push(a);
    }
  }
  return out;
}

export { DESK_ALIAS };
