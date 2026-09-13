/** Drei belegte Hypothesen plus Kern-Aufbau. Parameter vor dem Test, nicht danach. */

export const HYP_VERSION = "paper-v2-hyp-1";

export type HypothesisId = "S0-CORE" | "S1-RS" | "S2-PULL" | "S3-EVENT";

export type Hypothesis = {
  id: HypothesisId;
  name: string;
  auto: boolean;
  dataInterval: string;
  lookback: string;
  entry: string;
  exit: string;
  size: string;
  hold: string;
  exclude: string;
  update: string;
  note: string;
};

export const HYPOTHESES: Record<HypothesisId, Hypothesis> = {
  "S0-CORE": {
    id: "S0-CORE",
    name: "Kern-Aufbau",
    auto: false,
    dataInterval: "1d Schluss, Yahoo oder Seed",
    lookback: "keiner — Zielgewichte paper-v2",
    entry: "Leeres Book, Identität ok, nächste Sitzung, nach erneuter Prüfung. Nicht zum alten Schluss.",
    exit: "Kern ohne engen Stop. Reduktion nur bei Relativverlust vs SPY unter −5 % über 90 Tage oder manueller Halt.",
    size: "Ziel 55 % SPY+VOO (derselbe S&P 500), 15 % BlackRock-Aktie. Nicht in einem Tick.",
    hold: "Kern nicht wegen neuer Soll-Zahlen verkaufen.",
    exclude: "Börsenstart allein. Freitagsschluss am Wochenende.",
    update: "Nach jeder abgeschlossenen Sitzung prüfen, nicht ausführen ohne Bestätigung.",
    note: "Strategieentscheidung, kein Autokauf. Autopilot plant S0 nicht selbst.",
  },
  "S1-RS": {
    id: "S1-RS",
    name: "Trendfolge relative Stärke",
    auto: true,
    dataInterval: "1d Schluss",
    lookback: "15 Handelstage gegen SPY (LOOKBACK_BARS)",
    entry: "relPct >= 1,0 Prozentpunkte vs SPY im Fenster. Name in der Watchlist. Nicht Tesla.",
    exit: "rel <= −4 Prozentpunkte vs SPY, oder Stop (vorläufig 2 % unter Einstieg, Ausführung zum vorliegenden Kurs).",
    size: "Kleinster Betrag aus: freies Cash, 15 % des Depots, Risikobudget 0,5 % NAV / Stopabstand.",
    hold: "Mindestens zwei Handelstage. Kein sofortiges Hin-und-her. Eine Entscheidung je Schlussdatum.",
    exclude: "Kein Tape-Score. Risikosperre. Tesla. Goldman nach Sitzungsplus >= 2 % (Ereignis, kein Regime). Nvidia ohne extra Bonus.",
    update: "Einmal je Schlussdatum. Sitzung zu: nur PLANNED.",
    note: "Nvidia wird gleich behandelt, nicht bevorzugt.",
  },
  "S2-PULL": {
    id: "S2-PULL",
    name: "Rücksetzer im intakten Trend",
    auto: true,
    dataInterval: "1d Schluss",
    lookback: "15 Handelstage plus letzte Sitzung",
    entry: "15-Tage-Rendite des Namens > 0 und letzte Sitzung <= −1,5 %. relPct >= −0,5 vs SPY.",
    exit: "wie S1",
    size: "wie S1",
    hold: "wie S1",
    exclude: "Gefallener Kurs allein reicht nicht. RSI allein reicht nicht. Nachricht allein reicht nicht.",
    update: "wie S1",
    note: "Kein Verbilligen von Verlierern. Nur Rücksetzer, wenn der 15-Tage-Trend noch steht.",
  },
  "S3-EVENT": {
    id: "S3-EVENT",
    name: "Bestätigtes Unternehmensereignis",
    auto: false,
    dataInterval: "Primärmeldung (8-K, Quartalszahlen) plus Schluss danach",
    lookback: "Meldung höchstens fünf Handelstage alt, sonst UNBEKANNT / zu alt",
    entry: "Materielle Primärmeldung und zeitlich passender Schluss. Keine X-Meinung allein.",
    exit: "These widerlegt, wenn die nächste Meldung das Gegenteil zeigt oder Stop fällt.",
    size: "wie S1, zusätzlich Cluster-Limit 35 % für enge Themen (ohne SPY+VOO-Indexkern).",
    hold: "Bis zur nächsten Meldung oder Stop.",
    exclude: "Veraltete August-Filings im September. Erfundene aktuelle Entwicklungen.",
    update: "Nur wenn eine neue Meldung mit Datum vorliegt.",
    note: "Stand 13.09.2026: keine frische Primärmeldung nach dem Schluss 11.09. S3 daher inaktiv.",
  },
};

export type ScoreLite = {
  ticker: string;
  relPct: number;
  retPct: number;
  action?: string;
};

export function overlayTrigger(args: {
  ticker: string;
  scores?: ScoreLite[];
  sessionChangePct?: number;
}): { id: HypothesisId; reason: string } | null {
  if (args.ticker === "TSLA") return null;
  const session = args.sessionChangePct ?? 0;
  if (args.ticker === "GS" && session >= 2) return null;
  const score = args.scores?.find((s) => s.ticker === args.ticker);
  if (!score) return null;
  if (score.relPct >= 1) {
    return {
      id: "S1-RS",
      reason: `S1: 15 Tage gegen den Markt ${score.relPct >= 0 ? "+" : ""}${score.relPct.toFixed(1)} Prozentpunkte.`,
    };
  }
  if (score.retPct > 0 && session <= -1.5 && score.relPct >= -0.5) {
    return {
      id: "S2-PULL",
      reason: `S2: 15-Tage-Trend ${score.retPct >= 0 ? "+" : ""}${score.retPct.toFixed(1)} %, letzter Tag ${session.toFixed(1)} %.`,
    };
  }
  return null;
}

export function hypLines(): string[] {
  return (Object.values(HYPOTHESES) as Hypothesis[]).map(
    (h) =>
      `${h.id} ${h.name} · auto ${h.auto ? "ja" : "nein"} · Einstieg: ${h.entry} · Größe: ${h.size}`,
  );
}
