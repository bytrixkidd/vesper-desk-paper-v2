import { PERMISSION_ORDER, type PermissionLevel, type VesperAction } from "./types";

export const PERMISSION_LABEL: Record<PermissionLevel, string> = {
  view: "Ansehen",
  analyze: "Analysieren",
  propose: "Vorschlagen",
  prepare: "Vorbereiten",
  execute: "Ausführen",
};

export const PERMISSION_HINT: Record<PermissionLevel, string> = {
  view: "Daten öffnen, markieren, erklären.",
  analyze: "Rechnungen, Diagnosen, Szenarien.",
  propose: "Watchlists, Strategien, Trade-Pläne.",
  prepare: "Paper-Trades und Live-Entwürfe.",
  execute: "Live-Orders nur im Mandat — standardmäßig aus.",
};

export function rank(level: PermissionLevel) {
  return PERMISSION_ORDER.indexOf(level);
}

export function allows(have: PermissionLevel, need: PermissionLevel) {
  return rank(have) >= rank(need);
}

export function needFor(action: VesperAction): PermissionLevel {
  switch (action.type) {
    case "preparePaper":
    case "prepareTradePlan":
      return "prepare";
    case "prepareLive":
      return "prepare";
    case "startDiagnosis":
    case "refreshDiagnosis":
    case "updateDiagnosis":
    case "computeRisk":
    case "compare":
    case "compareSecurities":
    case "scenario":
    case "showScenario":
    case "consultBots":
    case "showBotOpinions":
    case "dailyBrief":
      return "analyze";
    default:
      return "view";
  }
}

export function gate(have: PermissionLevel, action: VesperAction): string | null {
  if (allows(have, needFor(action))) return null;
  return `Diese Aktion braucht die Stufe ${PERMISSION_LABEL[needFor(action)]}. Aktuell: ${PERMISSION_LABEL[have]}.`;
}
