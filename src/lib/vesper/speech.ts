import { replaceTickers, TITLE_NAMES } from "@/lib/names";
import type { SpeechLength } from "./types";

export const VOICES = [
  { id: "sal", name: "Sal", hint: "ruhig, normal, alltagstauglich" },
  { id: "rex", name: "Rex", hint: "klar, sachlich" },
  { id: "leo", name: "Leo", hint: "bestimmt, förmlich" },
] as const;

export const PREVIEW_LINE =
  "Hallo, willkommen. Ich spreche in normalem Deutsch, ohne Fachchinesisch, und ich rechne mit dem Paper-Konto, nicht mit echtem Geld.";

export const CANNED = {
  ack: "Natürlich, Sir.",
  wait: "Einen Moment, Sir. Ich prüfe das.",
  greet: "Hallo, willkommen, Sir.",
  stop: "In Ordnung.",
  noMic: "Ich empfange noch kein Mikrofonsignal. Bitte wählen Sie ein anderes Mikrofon.",
} as const;

const NAMES: [RegExp, string][] = Object.keys(TITLE_NAMES)
  .sort((a, b) => b.length - a.length)
  .map((sym) => [new RegExp(`\\b${sym}\\b`, "g"), TITLE_NAMES[sym]!] as [RegExp, string])
  .concat([
    [/\b8-?K\b/gi, "Unternehmensmeldung"],
    [/\b10-?Q\b/gi, "Quartalsbericht"],
    [/\b10-?K\b/gi, "Jahresbericht"],
    [/\b13F\b/gi, "Positionsmeldung großer Anleger"],
    [/\bForm\s*4\b/gi, "Insider-Meldung"],
  ]);

function roundPct(raw: string) {
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return raw;
  const abs = Math.abs(n);
  const one = abs.toFixed(1).replace(".", " Komma ");
  const sign = n < 0 ? "minus " : n > 0 ? "plus " : "";
  return `rund ${sign}${one} Prozent`;
}

function roundMoney(raw: string, unit: string) {
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return raw;
  const spoken = Math.abs(n) >= 100 ? String(Math.round(n)) : n.toFixed(0);
  return `rund ${spoken} ${unit}`;
}

export function prepareSpeech(text: string) {
  let s = replaceTickers(text.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim());
  for (const [re, name] of NAMES) s = s.replace(re, name);
  s = s.replace(/([+-]?\d+[.,]\d+)\s*%/g, (_, n: string) => roundPct(n));
  s = s.replace(/(\d+[.,]?\d*)\s*€/g, (_, n: string) => roundMoney(n, "Euro"));
  s = s.replace(/(\d+[.,]?\d*)\s*USD/gi, (_, n: string) => roundMoney(n, "Dollar"));
  s = s.replace(/\d{4}-\d{2}-\d{2}T[\d:.Z+-]+/g, "");
  s = s.replace(/\bMET\b/g, "");
  s = s.replace(/\bHelmsman\b/g, "der Overnight-Bot");
  s = s.replace(/\bPulse\b/g, "der Stimmungs-Bot");
  s = s.replace(/\bForge\b/g, "der Feedback-Bot");
  s = s.replace(/\bSkipper\b/g, "der Handels-Bot");
  s = s.replace(/\bbullish\b/gi, "zuversichtlich");
  s = s.replace(/\bbearish\b/gi, "vorsichtig");
  s = s.replace(/Basis\s*points?/gi, "kleine Schritte");
  s = s.replace(/Relative Strength/gi, "Kraft im Vergleich zum Markt");
  s = s.replace(/NAV-Abweichung/gi, "Abstand zum Zielwert");
  s = s.replace(/\bNAV\b/g, "aktueller Wert");
  s = s.replace(/watching Tag/gi, "Prüfung Tag");
  s = s.replace(/Paper-Watch/gi, "Demo-Prüfung");
  s = s.replace(/\bOverlay\b/g, "Beimischung");
  s = s.replace(/\bETF\b/g, "Korb");
  s = s.replace(/\bpp\b/g, "Prozentpunkte");
  s = s.replace(/S und P 500 ETF/gi, "der große US-Aktienkorb");
  s = s.replace(/\s+/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
  return s;
}

export function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 1);
}

export function wantsExplanation(text: string) {
  const f = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss");
  return /erklaer|warum|wieso|weshalb|genau(er)?|geh tiefer|ausfuehrlich|mehr details|was bedeutet|wie meinst|begruend|sag mehr|in einfachen worten|was heisst/.test(f);
}

export function wantsDetail(text: string) {
  const f = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss");
  return wantsExplanation(text) || /was ist|wie viel|wie laeuft|gewinn|umsatz|stand|kapital|lage|bericht|erzaehl|was mach|hilfe|paper|testlauf|empf(ie)?hl|tipp|kaufen|verkaufen|halten/.test(f);
}

export function isSimpleCommand(actionTypes: string[], text: string) {
  const f = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss");
  if (wantsDetail(text) || /was ist|was gab|passiert|wichtig|beobachte|diagnose|risiko|vergleich|echtes geld|echtgeld|gewinn|paper|spielgeld|fake|wirklich|5000|kapital|einsatz|jahresziel|warum|erklaer|empf(ie)?hl|tipp/.test(f)) return false;
  if (actionTypes.includes("selectTicker") || actionTypes.includes("intelAsk") || actionTypes.includes("dailyBrief") || actionTypes.includes("diagnosisStatus")) return false;
  if (actionTypes.length === 0) return false;
  return actionTypes.every((t) =>
    t === "navigate" ||
    t === "setChartRange" ||
    t === "openFloorBot" ||
    t === "goBack" ||
    t === "closeDetail" ||
    t === "setStyle" ||
    t === "openSection",
  );
}

export function toSpoken(display: string, length: SpeechLength, simple: boolean, detail: boolean) {
  if (simple) return CANNED.ack;
  const prepared = prepareSpeech(display);
  const parts = splitSentences(prepared).filter((p) => !/quelle|stand:|http/i.test(p));
  const max = detail
    ? (length === "ausfuehrlich" ? 8 : 6)
    : length === "kurz"
      ? 4
      : length === "normal"
        ? 6
        : 8;
  const take = parts.slice(0, Math.max(1, max));
  let out = take.join(" ");
  if (!detail && out.split(/\s+/).length > 140) out = take.slice(0, 5).join(" ");
  return out.slice(0, 900);
}

export function rateToPlayback(rate: "langsam" | "natuerlich" | "zuegig") {
  return rateToSpeed(rate);
}

export function rateToSpeed(rate: "langsam" | "natuerlich" | "zuegig") {
  if (rate === "langsam") return 0.88;
  if (rate === "zuegig") return 1.06;
  return 0.97;
}

export function packUtterances(text: string) {
  const prepared = prepareSpeech(text);
  const sentences = splitSentences(prepared);
  if (sentences.length === 0) return prepared ? [prepared] : [];
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (!buf) {
      buf = s;
      continue;
    }
    const glue = `${buf} ${s}`;
    const attach = /^(Natürlich, Sir|Einen Moment|Hallo, willkommen)/i.test(buf) || buf.length < 90 || glue.length <= 280;
    if (attach) {
      buf = glue;
      continue;
    }
    out.push(buf);
    buf = s;
  }
  if (buf) out.push(buf);
  return out;
}
