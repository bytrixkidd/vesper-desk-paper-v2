/** Tatsächliche Aufgaben. Keine erfundenen Fähigkeiten nur wegen des Namens. */

export type RoleLane = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "none";

export type BotRole = {
  id: string;
  name: string;
  lane: RoleLane;
  decidesTrades: boolean;
  actual: string;
};

export const BOT_ROLES: BotRole[] = [
  { id: "ledger", name: "Ledger", lane: "A", decidesTrades: false, actual: "Filings-Texte. Kein Kauf." },
  { id: "callbook", name: "Callbook", lane: "C", decidesTrades: false, actual: "Earnings-Notizen. Kein Kauf." },
  { id: "meridian", name: "Meridian", lane: "B", decidesTrades: false, actual: "Sektor-Text. Kein Kauf." },
  { id: "pulse", name: "Pulse", lane: "B", decidesTrades: false, actual: "Stimmung. Kein Entry allein." },
  { id: "shadow", name: "Shadow", lane: "C", decidesTrades: false, actual: "Insider-Notizen. Kein Kauf." },
  { id: "helmsman", name: "Helmsman", lane: "E", decidesTrades: false, actual: "Koordination und Briefings. Kein Kauf." },
  { id: "stab", name: "Stab", lane: "none", decidesTrades: false, actual: "Ops-Aufgaben. Kein Kauf." },
  { id: "forge", name: "Forge", lane: "G", decidesTrades: true, actual: "Regel: Verlierer/Stop in decidePulse. Programmtext, kein Modell." },
  { id: "gauge", name: "Gauge", lane: "G", decidesTrades: false, actual: "Effizienz-Text. Kein Kauf." },
  { id: "canon", name: "Canon", lane: "G", decidesTrades: false, actual: "Inklusion/Weekly. Kein Kauf." },
  { id: "audit", name: "Audit", lane: "E", decidesTrades: false, actual: "IB-Pläne in die Demo. Kein Live-Kauf." },
  { id: "scout", name: "Scout", lane: "E", decidesTrades: false, actual: "Korrektur von Mandaten. Kein Kauf." },
  { id: "score", name: "Score", lane: "G", decidesTrades: false, actual: "10J-Zahlen an Mandaten. Kein Kauf." },
  { id: "cart", name: "Cart", lane: "B", decidesTrades: false, actual: "Konsum-Ideen. Kein Autokauf." },
  { id: "signal", name: "Signal", lane: "B", decidesTrades: false, actual: "Social. Kein Entry." },
  { id: "till", name: "Till", lane: "E", decidesTrades: true, actual: "Regel: Zahler-Nachkauf nur mit S1/S2. Programmtext." },
  { id: "drift", name: "Drift", lane: "E", decidesTrades: true, actual: "Regel: Trail vom Hoch in decidePulse." },
  { id: "vein", name: "Vein", lane: "E", decidesTrades: true, actual: "Regel: Overlay-Kauf ohne Zahler-Bonus, nur S1/S2." },
  { id: "skipper", name: "Skipper", lane: "F", decidesTrades: true, actual: "Regel: Kern-Trim, Risiko, Halt. Programmtext." },
  { id: "anvil", name: "Anvil", lane: "G", decidesTrades: false, actual: "Trade-Post-Mortem. Kein Kauf." },
  { id: "caliper", name: "Caliper", lane: "G", decidesTrades: false, actual: "Trade-Effizienz. Kein Kauf." },
  { id: "edict", name: "Edict", lane: "G", decidesTrades: false, actual: "Profil/Weekly. Kein Kauf." },
  { id: "prism", name: "Prism", lane: "none", decidesTrades: false, actual: "Chart-Sprache. Kein Kauf." },
];

export const LANE_LABEL: Record<RoleLane, string> = {
  A: "Datenprüfung",
  B: "Marktanalyse",
  C: "Unternehmensanalyse",
  D: "Gegenprüfung",
  E: "Portfoliovorschlag",
  F: "Risikoprüfung",
  G: "Buchhaltung / Auswertung",
  none: "Anzeige / Betrieb",
};

export const DECISION_PATH =
  "Handelsentscheidungen kommen nur aus decidePulse (Regeln in engine.ts). Modellaufrufe liegen auf Briefing und Floor-Chat, nicht auf dem Kaufpfad. Bot-Namen in der Entscheidung sind Etiketten, keine unabhängigen Agenten.";

export const RUNTIME_NOTE =
  "Autopilot läuft nur, solange diese Seite offen ist. Ein steigender Zähler ist Programmzeit, kein neuer Kurs und keine Hintergrundüberwachung bei geschlossenem Browser.";
