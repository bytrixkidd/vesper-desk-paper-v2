import { runCheck } from "@/lib/check";
import { explainPoint, pickBar } from "@/lib/explain";
import { formatEur, formatPct, formatUsd } from "@/lib/format";
import { replaceTickers } from "@/lib/names";
import { START_EUR, START_USD, TAX_RATE, lifeGoalLine, monthlyGrossRate, paperHonestyLine, usdFromEur } from "@/lib/paper";
import { useDeskStore } from "@/lib/store";
import type { ParsedIntent } from "./parse";
import { lastDrop } from "./snapshot";
import type { DeskSnap } from "./snapshot";
import { diagnosisSpeech } from "./diagnose";
import { answerIntel, type IntelAskWhich, type IntelCard } from "./intel";
import { CANNED, isSimpleCommand, toSpoken, wantsDetail, wantsExplanation } from "./speech";
import { adviceLine, clampSentences, diagnosisPlain, REC_LABEL, spokenName, stageOneFromCard, stageTwoNeed, stageTwoWhy, stripJargon } from "./plain";
import type { AnswerStage, Diagnosis, TradeDraft, VesperAction, VesperConfidence, VesperSource, VesperStyle } from "./types";

export type CeoReply = {
  say: string;
  spoken?: string;
  sources: VesperSource[];
  confidence: VesperConfidence;
  actions: VesperAction[];
};

function nowIso() {
  return new Date().toISOString();
}

function src(partial: Omit<VesperSource, "fetchedAt">): VesperSource {
  return { ...partial, fetchedAt: nowIso() };
}

function styleWrap(text: string, style: VesperStyle) {
  if (style === "short") {
    return text
      .split("\n")
      .filter((l) => l.trim())
      .slice(0, 6)
      .join("\n");
  }
  if (style === "plain") {
    return text
      .replace(/Overlay/g, "Beimischung")
      .replace(/These/g, "Annahme")
      .replace(/Guidance/g, "Ausblick der Firma")
      .replace(/Notional/g, "Einsatz")
      .replace(/Relativverlust/g, "Abstand zum Markt");
  }
  return text;
}

function midConfidence(why: string, up: string[], down: string[]): VesperConfidence {
  return { label: "mittel", why, strengthens: up, weakens: down };
}

export function developments(snap: DeskSnap, lastVisit: string | null): string[] {
  const points: string[] = [];
  if (snap.liveStatus === "abort") {
    points.push("Beimischung ist pausiert. Der 300-Dollar-Test läuft weiter, ohne neue Wette.");
  } else if (snap.watch) {
    const pnl = snap.pnl;
    if (Math.abs(pnl) >= 0.5) {
      points.push(
        pnl >= 0
          ? `Paper steht rund ${formatUsd(pnl)} über den eingezahlten ${formatUsd(snap.deposited)}.`
          : `Paper steht rund ${formatUsd(Math.abs(pnl))} unter den eingezahlten ${formatUsd(snap.deposited)}.`,
      );
    } else {
      points.push(`Testlauf ${formatUsd(START_USD, 0)}. Stand ${formatUsd(snap.nav)}. Gewinn bleibt im Book.`);
    }
  }
  const fresh = lastVisit
    ? snap.alerts.filter((a) => a.ts > lastVisit && (a.severity === "material" || a.severity === "watch"))
    : snap.alerts.filter((a) => a.severity === "material");
  for (const a of fresh.slice(0, 2)) points.push(replaceTickers(a.headline));
  if (snap.watch) points.push(snap.watch);
  const unique = [...new Set(points)];
  return unique.slice(0, 3);
}

export function greetingText(_snap: DeskSnap, _lastVisit: string | null, first: boolean, _briefSpoken?: string) {
  return first ? "Hallo." : "Ja.";
}

function explainSymbol(snap: DeskSnap, symbol: string, iso?: string): { say: string; sources: VesperSource[] } {
  const bars = snap.tape[symbol] ?? [];
  let target = iso;
  if (!target || target === "DROP") {
    const drop = lastDrop(bars);
    target = drop?.iso;
  }
  const hit = pickBar(bars, target);
  const spyHit = pickBar(snap.tape.SPY ?? [], target);
  if (!hit.bar) {
    return {
      say: `Zu ${symbol} habe ich an diesem Tag keinen Schlusskurs. Ich markiere nichts Falsches.`,
      sources: [
        src({
          title: "Tape",
          kind: "tape",
          at: snap.asOf,
          symbol,
          note: snap.sessionLabel,
          tier: "fact",
          stale: snap.tapeSource !== "yahoo",
        }),
      ],
    };
  }
  const reading = explainPoint({
    symbol,
    bar: hit.bar,
    prev: hit.prev,
    spyBar: spyHit.bar ?? undefined,
    spyPrev: spyHit.prev,
  });
  const date = target;
  const say = [
    `${reading.headline}.`,
    ...reading.bullets.slice(0, 4).map((b) => `– ${b}`),
    reading.source === "seed"
      ? "Das sind die hinterlegten Tagesgründe, abgestimmt auf den Schlusskurs."
      : "Das lese ich direkt aus dem Schlusskurs. Keine erfundenen Nachrichten.",
    "Interpretation: ein Tag ist kein Trend. Kern bleibt unangetastet, solange kein Filing dagegen spricht.",
  ].join("\n");
  return {
    say,
    sources: [
      src({
        title: `${symbol} Schluss ${date}`,
        kind: "tape",
        at: hit.bar.t,
        symbol,
        note: `Quelle ${snap.tapeSource ?? "lokal"} · ${snap.sessionLabel}`,
        tier: "fact",
        stale: snap.tapeSource !== "yahoo",
      }),
      src({
        title: reading.headline,
        kind: "tape",
        at: hit.bar.t,
        symbol,
        note: reading.source === "seed" ? "Tagesnotiz (geprüft gegen Tape)" : "Tape-Erklärer",
        tier: reading.source === "seed" ? "fact" : "interpretation",
      }),
    ],
  };
}

function daily(snap: DeskSnap): CeoReply {
  const topBot = snap.bots[0];
  const risk = snap.liveStatus === "abort"
    ? "Beimischung pausiert. Der 300-Dollar-Test läuft ohne neue Wette weiter."
    : snap.pnl < 0
      ? "Das Paper liegt unter dem Start. Gewinn bleibt im Book, nichts ausschütten."
      : "Größtes Risiko: ein Makro-Print, Beimischung zu früh anfassen.";
  const idea = snap.ideas.find((i) => i.status === "open");
  const say = [
    `Teststand ${formatUsd(snap.nav)}, Gewinn ${formatUsd(snap.pnl)}. Kein Echtgeld.`,
    `US-Aktienkorb ${snap.spyLast?.toFixed(0) ?? "—"} (${formatPct(snap.spyChange ?? 0)}).`,
    topBot ? `${topBot.name}: ${topBot.summary}` : "Keine neue Bot-Notiz.",
    risk,
    idea ? `${idea.ticker}: Idee, kein Kauf.` : "Heute kein neuer Kauf.",
  ].join("\n");
  return {
    say,
    actions: [],
    sources: snap.alerts.slice(0, 3).map((a) =>
      src({
        title: a.headline,
        kind: "brief",
        at: a.ts,
        symbol: a.ticker,
        note: a.severity,
        tier: a.severity === "material" ? "fact" : "interpretation",
      }),
    ),
    confidence: midConfidence("Brief aus Tape, Book und Bot-Notizen.", ["Paper-Book", "Tape"], ["Kurzer Fensterblick"]),
  };
}

function riskCalc(amount: number, symbol?: string): CeoReply {
  const drop10 = amount * 0.1;
  const drop20 = amount * 0.2;
  const afterTaxIfWin10 = amount * 0.1 * (1 - TAX_RATE);
  const ofBook = START_EUR > 0 ? (amount / START_EUR) * 100 : 0;
  const ticker = symbol ?? "einem Namen";
  const say = [
    `Bei ${formatUsd(usdFromEur(amount))} Einsatz in ${ticker}:`,
    `– 10 % Gegenbewegung = ${formatUsd(usdFromEur(drop10))} Verlust vor Steuer.`,
    `– 20 % = ${formatUsd(usdFromEur(drop20))}.`,
    `– Anteil am 300-Dollar-Test: ${ofBook.toFixed(1)} %.`,
    `– Würde der Trade 10 % gewinnen, bleiben nach Abgeltungsteuer rund ${formatUsd(usdFromEur(afterTaxIfWin10))} netto.`,
    `Rechnung: Einsatz × Bewegung. Steuer ${(TAX_RATE * 100).toFixed(3)} % nur auf Gewinne.`,
    "Interpretation: unter 2 % Book ist es Lärm, über 5 % braucht ein Mandat. Paper zuerst.",
    "Das ist keine Prognose, nur Arithmetik. Kein Echtgeld.",
  ].join("\n");
  return {
    say,
    actions: [],
    sources: [
      src({
        title: "Risikorechnung",
        kind: "calc",
        at: nowIso(),
        symbol,
        note: `${amount} · 10/20 % Pfad · Steuer ${TAX_RATE}`,
        tier: "calc",
      }),
    ],
    confidence: {
      label: "hoch",
      why: "Reine Arithmetik, keine Kurswette.",
      strengthens: ["Feste Einsätze", "Steuersatz bekannt"],
      weakens: ["Tatsächliche Slippage fehlt"],
    },
  };
}

function compare(snap: DeskSnap, left: string, right: string): CeoReply {
  const a = useDeskStore.getState().watchlist.find((t) => t.symbol === left);
  const b = useDeskStore.getState().watchlist.find((t) => t.symbol === right);
  const ln = spokenName(left, a?.name);
  const rn = spokenName(right, b?.name);
  const spoken = a && b
    ? `${ln} steht bei ${a.last.toFixed(0)} Dollar und ist heute ${a.changePct >= 0 ? "im Plus" : "im Minus"} um ${Math.abs(a.changePct).toFixed(1).replace(".", ",")} Prozent. ${rn} steht bei ${b.last.toFixed(0)} Dollar und ist heute ${b.changePct >= 0 ? "im Plus" : "im Minus"} um ${Math.abs(b.changePct).toFixed(1).replace(".", ",")} Prozent. Beide sind Beimischung, nicht Kern.`
    : `Ich vergleiche nur, was im Book liegt.`;
  return {
    say: spoken,
    spoken: clampSentences(spoken, 4),
    actions: [],
    sources: [
      src({
        title: `${left} Last`,
        kind: "tape",
        at: snap.asOf,
        symbol: left,
        note: snap.sessionLabel,
        tier: "fact",
        stale: snap.tapeSource !== "yahoo",
      }),
      src({
        title: `${right} Last`,
        kind: "tape",
        at: snap.asOf,
        symbol: right,
        note: snap.sessionLabel,
        tier: "fact",
        stale: snap.tapeSource !== "yahoo",
      }),
    ],
    confidence: midConfidence("Lasts aus dem Book-Tape.", ["Gleicher Datenstand"], ["Kein voller 10J-Vergleich in dieser Antwort"]),
  };
}

function scenario(which: "base" | "up" | "down", symbol: string | undefined, snap: DeskSnap): CeoReply {
  const t = symbol ?? "SPY";
  const last = snap.spyLast ?? 0;
  const map = {
    base: {
      p: "55 %",
      span: "±2 % über zwei Wochen",
      line: "Seitwärts um den letzten Schluss, Fed-Rede verdaut, Kern unangetastet.",
    },
    up: {
      p: "25 %",
      span: "+3 bis +6 %",
      line: "Weiche Töne der Fed, Semis ziehen nach. Overlay darf erst nach einem ruhigen Tag folgen.",
    },
    down: {
      p: "20 %",
      span: "−4 bis −8 %",
      line: "Fester Arbeitsmarkt, kein Schnitt. Beimischung halbieren, Kern halten. Der 300-Dollar-Test hat Vorrang.",
    },
  } as const;
  const s = map[which];
  const say = [
    `${which === "down" ? "Negativszenario" : which === "up" ? "Positivszenario" : "Basisszenario"} für ${t}.`,
    `Zeitraum: zwei Wochen ab ${snap.asOf.slice(0, 10)}. Datengrundlage: Tape ${snap.tapeSource ?? "lokal"}, Filings, Makro-Kalender.`,
    s.line,
    `Geschätzte Wahrscheinlichkeit: ${s.p}. Spanne: ${s.span}${last ? ` um ${last.toFixed(0)}` : ""}.`,
    "Annahme: keine Überraschungs-8-K im Kern.",
    "Ungültig wenn: außerplanmäßige Fed, Bank-Stress, oder das Paper klar hinter dem Markt liegt.",
    `Stand: ${snap.sessionLabel}.`,
    "Auf Basis der aktuellen Daten halte ich das Basisszenario für wahrscheinlicher.",
  ].join("\n");
  return {
    say,
    actions: [],
    sources: [
      src({
        title: "Szenario",
        kind: "calc",
        at: snap.asOf,
        symbol: t,
        note: "Keine Vorhersage. Drei Pfade, grobe Gewichte.",
        tier: "interpretation",
      }),
    ],
    confidence: {
      label: "niedrig",
      why: "Szenarien sind Ordnung, keine Weissagung. Gewichte sind Ermessen.",
      strengthens: ["Makro-Kalender bekannt"],
      weakens: ["Unbekannte 8-Ks", "Keine Optionsfläche"],
    },
  };
}

function dissent(snap: DeskSnap): CeoReply {
  const pulse = snap.bots.find((b) => /pulse/i.test(b.id) || /Sentiment/.test(b.summary));
  const forge = snap.lessons[0];
  const say = [
    "Sir, die Bots sind sich nicht einig.",
    pulse
      ? `Pulse sieht Lärm im Sentiment (${pulse.summary}). Das ist ein Signal, keine These.`
      : "Sentiment und Filings ziehen nicht in dieselbe Richtung.",
    forge
      ? `Forge widerspricht einem Sentiment-Entry: ${forge.mistake} — Regel: ${forge.fix}`
      : "Forge verlangt Filing oder Print vor Entry.",
    "Drei Hinweise können laut sein und trotzdem denselben Fehler teilen: Social-Clips ohne 8-K.",
    "Der Konflikt liegt bei der Frage, ob Aufmerksamkeit gleich Nachfrage ist. Tut sie nicht.",
    "Nächster Schritt: Floor lesen, dann nichts kaufen, bis Ledger oder Callbook nickt.",
  ].join("\n");
  return {
    say,
    actions: [],
    sources: snap.bots.slice(0, 4).map((b) =>
      src({
        title: b.name,
        kind: "bot",
        at: snap.asOf,
        bot: b.id as never,
        note: b.summary,
        tier: "interpretation",
      }),
    ),
    confidence: midConfidence("Widerspruch aus Bot-Notizen und Lessons, nicht aus einer Abstimmung.", ["Lesson W32"], ["Kleine Stichprobe"]),
  };
}

function filingSource(snap: DeskSnap, symbol?: string): VesperSource | null {
  const f = snap.filings.find((x) => (symbol ? x.ticker === symbol : true));
  if (!f) return null;
  return src({
    title: `${f.ticker} ${f.form} — ${f.title}`,
    kind: "filing",
    at: f.filedAt,
    symbol: f.ticker,
    note: f.delta,
    tier: "fact",
    href: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${f.ticker}&type=${f.form}&dateb=&owner=include&count=10`,
  });
}

function localCeoRaw(args: {
  text: string;
  parsed: ParsedIntent;
  snap: DeskSnap;
  style: VesperStyle;
  diagnoses: Diagnosis[];
  drafts: TradeDraft[];
  intel?: Record<string, IntelCard>;
  briefSpoken?: string;
  briefDisplay?: string;
  focusSymbol?: string | null;
  stage?: AnswerStage;
  kind?: string;
}): CeoReply {
  const { parsed, snap, style } = args;
  const types = new Set(parsed.actions.map((a) => a.type));
  const cardOf = (sym?: string | null) => (sym ? args.intel?.[sym] : undefined);

  if (args.kind === "check" || /^check\b/i.test(args.text)) {
    const say = runCheck();
    return {
      say,
      spoken: say.split("\n").slice(0, 5).join(" "),
      sources: [src({ title: "Depotprüfung", kind: "calc", at: nowIso(), note: "Paper only", tier: "fact", stale: false })],
      actions: [{ type: "openSection", sectionId: "command" }],
      confidence: midConfidence("Buchung und Tape, kein Broker.", ["Watch", "Tape"], ["Kein echtes Konto"]),
    };
  }
  if (args.kind === "lifeGoal" || /5[ .]?000|20[ .]?000|dieses jahr|jahresziel/i.test(args.text)) {
    const desk = useDeskStore.getState();
    const generated = desk.demos.filter((d) => d.generated);
    const spoken = lifeGoalLine({ generatedCount: generated.length, monthlyGross: monthlyGrossRate(desk.demos) });
    return {
      say: styleWrap(spoken, style),
      spoken,
      sources: [src({ title: "Stufenplan", kind: "calc", at: nowIso(), note: "Kein Echtgeld", tier: "fact", stale: false })],
      actions: [{ type: "openSection", sectionId: "command" }],
      confidence: midConfidence("Kapitalrechnung, keine Prognose.", ["300 Dollar digital", "Quote zuerst"], ["Kein echtes Konto"]),
    };
  }
  if (args.kind === "paperMoney" || /echtes? geld|echtgeld|fake|gewinn gemacht|wirklich (gerechnet|investiert)/i.test(args.text)) {
    const desk = useDeskStore.getState();
    const watch = desk.watch;
    const generated = desk.demos.filter((d) => d.generated).length;
    const spoken = paperHonestyLine({
      navEur: watch?.navEur ?? START_EUR,
      bookPct: watch?.bookPct ?? 0,
      tapeSource: desk.tapeSource,
      generatedWeeks: generated,
    });
    const say = [
      `Teststand ${formatUsd(usdFromEur(watch?.navEur ?? START_EUR, watch?.eurUsd ?? 1.08))}, Gewinn ${formatUsd(usdFromEur((watch?.navEur ?? START_EUR) - (watch?.startEur ?? START_EUR), watch?.eurUsd ?? 1.08))}.`,
      "Kein Echtgeld. Nur ein digitaler Test.",
      watch ? `Prüfung Tag ${watch.day} von 7.` : "Gerade läuft keine Prüfung.",
      generated > 0 ? `${generated} Wochen gegen echte Kurse gerechnet.` : "August-Wochen sind Lehrbeispiele, kein Gewinn.",
    ].join("\n");
    return {
      say: styleWrap(say, style),
      spoken,
      sources: [
        src({
          title: "Paper-Konto",
          kind: "calc",
          at: nowIso(),
          note: desk.sessionLabel,
          tier: "fact",
          stale: desk.tapeSource !== "yahoo",
        }),
      ],
      actions: [],
      confidence: midConfidence("Paper-Buch und Tape, kein Broker.", ["300 Dollar digital", "Mark-to-Tape"], ["Kein echtes Konto"]),
    };
  }

  const markEarly = parsed.actions.find((a) => a.type === "markDay");
  const selEarly = parsed.actions.find((a) => a.type === "selectTicker");
  if (markEarly && markEarly.type === "markDay" && selEarly && selEarly.type === "selectTicker") {
    const ex = explainSymbol(snap, selEarly.symbol, markEarly.iso);
    const card = cardOf(selEarly.symbol);
    const tip = card ? adviceLine(card.rec, card.name) : "";
    const filing = filingSource(snap, selEarly.symbol);
    const say = [ex.say, tip].filter(Boolean).join("\n");
    return {
      say: styleWrap(say, style),
      spoken: say,
      sources: filing ? [...ex.sources, filing] : ex.sources,
      actions: [],
      confidence: midConfidence("Schlusskurs plus Tagesnotiz. Keine erfundene Headline.", ["Tape"], ["Nachrichtenlage kann breiter sein als die Notiz"]),
    };
  }

  const askA = parsed.actions.find((a) => a.type === "intelAsk");
  if (askA && askA.type === "intelAsk") {
    const sel = parsed.actions.find((a) => a.type === "selectTicker");
    const symbol = (sel && sel.type === "selectTicker" ? sel.symbol : null) ?? args.focusSymbol ?? null;
    const card = cardOf(symbol);
    if (card) {
      const a = answerIntel(card, askA.which as IntelAskWhich);
      const spoken =
        askA.which === "why"
          ? stageTwoWhy(card)
          : askA.which === "need"
            ? stageTwoNeed(card)
            : askA.which === "bots"
              ? clampSentences(stripJargon(a.spoken), 3)
              : clampSentences(stripJargon(a.spoken), 5);
      const say = [spoken, a.display].filter(Boolean).join("\n");
      return {
        say: stripJargon(say),
        spoken,
        sources: card.sources.map((s) => src({ title: s.title, kind: s.kind, note: s.note, symbol: card.symbol, tier: "interpretation", at: nowIso() })),
        actions: [],
        confidence: { label: card.confidence, why: card.recWhy, strengthens: card.positives.slice(0, 3), weakens: card.negatives.slice(0, 3) },
      };
    }
    return {
      say: "Welchen Titel meinen Sie? Nvidia, Apple, Amazon — oder den großen US-Aktienkorb? Dann sage ich genau, ob halten, noch nicht kaufen oder weniger halten.",
      spoken: "Welchen Titel meinen Sie? Dann sage ich genau, ob halten, noch nicht kaufen oder weniger halten.",
      sources: [],
      actions: [],
      confidence: midConfidence("Kein Name im Fokus.", [], ["Ohne Titel kein Tipp"]),
    };
  }

  if (types.has("dailyBrief")) {
    const d = daily(snap);
    return { ...d, say: styleWrap(d.say, style), spoken: d.say.split("\n").slice(0, 5).join(" ") };
  }
  if (types.has("consultBots") && /uneinig|widerspruch/.test(foldSafe(args.text))) {
    const d = dissent(snap);
    return { ...d, say: styleWrap(d.say, style) };
  }

  const riskA = parsed.actions.find((a) => a.type === "computeRisk");
  if (riskA && riskA.type === "computeRisk") {
    const r = riskCalc(riskA.amountEur, riskA.symbol);
    return { ...r, say: styleWrap(r.say, style) };
  }
  const cmp = parsed.actions.find((a) => a.type === "compare");
  if (cmp && cmp.type === "compare") {
    const r = compare(snap, cmp.left, cmp.right);
    return { ...r, say: styleWrap(r.say, style) };
  }
  const sc = parsed.actions.find((a) => a.type === "scenario");
  if (sc && sc.type === "scenario") {
    const r = scenario(sc.which, sc.symbol, snap);
    return { ...r, say: styleWrap(r.say, style) };
  }

  if (types.has("diagnosisStatus") || types.has("startDiagnosis") || types.has("refreshDiagnosis") || types.has("killDiagnosis")) {
    const want = parsed.actions.find((a) => a.type === "startDiagnosis");
    const symbol = want && want.type === "startDiagnosis" ? want.symbol : args.focusSymbol;
    const dx = args.diagnoses.find((d) => d.symbol === symbol && d.status === "running") ?? args.diagnoses.find((d) => d.status === "running") ?? args.diagnoses[0];
    if (!dx) {
      return {
        say: "Es läuft keine Diagnose. Sagen Sie z. B.: Beobachte NVIDIA fünf Handelstage.",
        spoken: "Es läuft keine Diagnose. Sagen Sie zum Beispiel: Beobachte Nvidia fünf Handelstage.",
        sources: [],
        actions: [],
        confidence: midConfidence("Kein laufender Auftrag.", [], ["Ohne Auftrag keine Prüfung"]),
      };
    }
    const startSpoken =
      want && want.type === "startDiagnosis" && dx.status === "running" && dx.day <= 1
        ? `Ich prüfe ${spokenName(dx.symbol, dx.name)} über ${dx.days} Handelstage. Das ist ein Prüfzeitraum, keine Zusage für einen Kauf.`
        : null;
    const spoken = startSpoken ?? diagnosisPlain(dx);
    return {
      say: args.stage === 3 ? styleWrap(diagnosisSpeech(dx), style) : spoken,
      spoken,
      sources: [
        src({
          title: `Diagnose ${dx.symbol} · Tag ${dx.day}/${dx.days}`,
          kind: "calc",
          at: dx.lastReviewed ?? dx.startedAt,
          symbol: dx.symbol,
          note: dx.log.at(-1)?.note ?? diagnosisNote(dx),
          tier: "calc",
        }),
        ...dx.log
          .flatMap((d) => d.checks)
          .filter((c) => c.status === "fail" || c.status === "pass")
          .slice(0, 4)
          .map((c) =>
            src({
              title: c.label,
              kind:
                c.kind === "filing" || c.kind === "insider"
                  ? "filing"
                  : c.kind === "earnings"
                    ? "earnings"
                    : c.kind === "sentiment"
                      ? "sentiment"
                      : c.kind === "whale"
                        ? "flows"
                        : c.kind === "macro"
                          ? "macro"
                          : c.kind === "mandate" || c.kind === "lesson"
                            ? "brief"
                            : "tape",
              at: dx.log.at(-1)?.date ?? dx.startedAt,
              symbol: dx.symbol,
              note: c.detail,
              tier: c.kind === "price" || c.kind === "volume" ? "fact" : "interpretation",
            }),
          ),
      ],
      actions: [],
      confidence: dx.result?.confidence ?? midConfidence(`Beobachtung läuft, These ${dx.thesisState}. Noch kein Abschlussurteil.`, ["Tägliche Schlusskurse", "Checks gegen SPY, Filings, Mandat"], ["Kurzes Fenster", "13F nicht tagesgenau"]),
    };
  }

  if (types.has("preparePaper") || types.has("prepareLive")) {
    const d = args.drafts[0];
    const say = d
      ? [
          d.mode === "live"
            ? "Live-Order bleibt Entwurf. Ausführung ist aus, solange Sie das Mandat nicht explizit öffnen."
            : "Paper-Plan steht. Kein echtes Geld.",
          `${d.side === "buy" ? "Kauf" : "Verkauf"} ${spokenName(d.symbol)}, ${formatUsd(usdFromEur(d.amountEur))}.`,
          `Erwarteter Wert ${formatEur(d.expectedValue)}, Gebühren ${formatEur(d.fees)}, Risiko grob ${formatEur(d.riskEur)}.`,
          d.allocationNote,
          d.note,
        ].join("\n")
      : "Ich habe den Plan vorbereitet.";
    return {
      say: styleWrap(say, style),
      sources: [
        src({
          title: "Trade-Entwurf",
          kind: "calc",
          at: nowIso(),
          note: d?.note ?? "",
          symbol: d?.symbol,
          tier: "calc",
        }),
      ],
      actions: [],
      confidence: {
        label: "hoch",
        why: "Entwurf, keine Ausführung.",
        strengthens: ["Paper-Desk vorhanden"],
        weakens: ["Kein Broker"],
      },
    };
  }

  const mark = parsed.actions.find((a) => a.type === "markDay");
  const sel = parsed.actions.find((a) => a.type === "selectTicker");
  if (sel && sel.type === "selectTicker" && !(mark && mark.type === "markDay")) {
    const card = cardOf(sel.symbol);
    if (card) {
      const spoken = args.stage === 3 ? stripJargon(card.spoken) : stageOneFromCard(card);
      return {
        say: args.stage === 3 ? stripJargon(card.display) : spoken,
        spoken,
        sources: card.sources.map((s) => src({ title: s.title, kind: s.kind, note: s.note, symbol: card.symbol, tier: s.kind === "tape" ? "fact" : "interpretation", at: nowIso() })),
        actions: [],
        confidence: { label: card.confidence, why: card.recWhy, strengthens: card.positives.slice(0, 3), weakens: card.negatives.slice(0, 3) },
      };
    }
    const t = useDeskStore.getState().watchlist.find((x) => x.symbol === sel.symbol);
    const filing = filingSource(snap, sel.symbol);
    const bot = snap.bots.find((b) => b.summary.includes(sel.symbol));
    const name = spokenName(sel.symbol, t?.name);
    const say = [
      t
        ? `${name} steht bei ${t.last.toFixed(2)} Dollar (${formatPct(t.changePct)}).`
        : `${name} liegt im Universum.`,
      bot ? `Bot-Lage: ${bot.summary}` : "Keine frische Spezial-Notiz zu diesem Namen.",
      filing ? `Meldung: ${filing.title}. ${filing.note}` : "Keine besondere Unternehmensmeldung in der aktuellen Liste.",
      "Eine einzelne Meldung ändert die Lage schneller als der Chart.",
      "Nächster Schritt: einen Tag im Chart anschauen oder fünf Tage prüfen — nicht nachlaufen.",
    ].join("\n");
    return {
      say: styleWrap(say, style),
      sources: [
        src({
          title: `${sel.symbol} Last`,
          kind: "tape",
          at: snap.asOf,
          symbol: sel.symbol,
          note: snap.sessionLabel,
          tier: "fact",
          stale: snap.tapeSource !== "yahoo",
        }),
        ...(filing ? [filing] : []),
      ],
      actions: [],
      confidence: midConfidence("Last und hinterlegte Filings.", ["Tape"], ["Kein voller News-Scan ohne Modell"]),
    };
  }

  if (types.has("consultBots")) {
    const d = dissent(snap);
    const briefish = daily(snap);
    return { ...d, say: styleWrap(`${d.say}\n${briefish.say.split("\n")[2] ?? ""}`, style) };
  }

  const fallback = daily(snap);
  const ask = args.text;
  const bookLine = `Eingezahlt ${formatUsd(snap.deposited)}, Stand ${formatUsd(snap.nav)}, Gewinn ${formatUsd(snap.pnl)}. Kein Echtgeld.`;
  const say = [
    `Zu Ihrer Frage — ${ask.slice(0, 140)}.`,
    bookLine,
    snap.watch ?? "Gerade läuft keine Prüfung. Der Autopilot eröffnet als Nächstes eine mit echten Schlusskursen.",
    "Ich halte mich an Kurse, Meldungen und Bot-Notizen. Nichts erfinden.",
  ].join(" ");
  return {
    say: styleWrap(say, style),
    spoken: say,
    actions: [],
    sources: fallback.sources,
    confidence: fallback.confidence,
  };
}

export function localCeo(args: {
  text: string;
  parsed: ParsedIntent;
  snap: DeskSnap;
  style: VesperStyle;
  diagnoses: Diagnosis[];
  drafts: TradeDraft[];
  length?: "kurz" | "normal" | "ausfuehrlich";
  intel?: Record<string, IntelCard>;
  briefSpoken?: string;
  briefDisplay?: string;
  focusSymbol?: string | null;
  stage?: AnswerStage;
  kind?: string;
}): CeoReply {
  const reply = localCeoRaw(args);
  const showing = args.parsed.actions.some(
    (a) =>
      a.type === "navigate" ||
      a.type === "openSection" ||
      a.type === "selectTicker" ||
      a.type === "markDay" ||
      a.type === "intelAsk" ||
      a.type === "dailyBrief",
  );
  const explain = wantsExplanation(args.text) || wantsDetail(args.text) || showing;
  if (reply.spoken) {
    return {
      ...reply,
      spoken: clampSentences(stripJargon(reply.spoken), explain ? 5 : 2),
      say: stripJargon(reply.say),
    };
  }
  const types = args.parsed.actions.map((a) => a.type);
  const simple = isSimpleCommand(types, args.text);
  if (simple) return { ...reply, spoken: CANNED.ack };
  const spoken = clampSentences(stripJargon(toSpoken(reply.say, args.length ?? "normal", false, explain)), explain ? 5 : 2);
  return { ...reply, spoken, say: stripJargon(reply.say) };
}

function diagnosisNote(dx: Diagnosis) {
  return dx.status === "done" ? `Abschluss ${dx.result?.verdict}` : `Tag ${dx.day}/${dx.days}`;
}

function foldSafe(s: string) {
  return s.toLowerCase();
}
