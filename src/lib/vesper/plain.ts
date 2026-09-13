import { displayName, replaceTickers, spokenTitle, TITLE_NAMES } from "@/lib/names";
import type { IntelCard, RecStatus } from "./intel";
import type { Diagnosis } from "./types";

export const REC_LABEL: Record<RecStatus, string> = {
  ignorieren: "Links liegen lassen. Nicht kaufen.",
  beobachten: "Noch nicht kaufen. Erst weiter zuschauen.",
  "diagnose-laeuft": "Noch nicht kaufen. Die Prüfung läuft.",
  "genauer-pruefen": "Genau anschauen, aber nicht kaufen.",
  "trade-vorbereiten": "Ein Testkauf wäre denkbar. Kein echtes Geld.",
  entscheidung: "Hier müssen Sie entscheiden: dabei bleiben oder raus.",
  halten: "Halten. Das ist Grundstock, nicht zum Umschichten.",
  "risiko-reduzieren": "Weniger halten. Nicht nachkaufen.",
  "ausstieg-pruefen": "Prüfen, ob wir verkaufen. Nicht nachlaufen.",
  "these-widerlegt": "Nicht kaufen. Die Idee hat sich nicht bestätigt.",
};

const SWAP: [RegExp, string][] = [
  [/ \$/g, " Dollar"],
  [/\bNAV\b/gi, "aktueller Wert"],
  [/Relative Performance/gi, "Abstand zum Markt"],
  [/\bBenchmark\b/gi, "Vergleichsmarkt"],
  [/Basis\s*points?/gi, "kleine Schritte"],
  [/S&P 500 ETF/gi, "der große US-Aktienkorb"],
  [/S und P 500 ETF/gi, "der große US-Aktienkorb"],
  [/S&P 500/gi, "der große US-Aktienkorb"],
  [/S und P 500/gi, "der große US-Aktienkorb"],
  [/Risk-?on/gi, "hohe Risikobereitschaft"],
  [/Risk-?off/gi, "Vorsicht am Markt"],
  [/Mean Reversion/gi, "Rückkehr zum Mittel"],
  [/Gamma Exposure/gi, "Absicherung großer Händler"],
  [/Flow Divergence/gi, "Käufe und Kurse passen nicht zusammen"],
  [/Multiple Compression/gi, "die Bewertung ist gesunken"],
  [/Take-or-pay/gi, "feste Abnahmevereinbarung"],
  [/Cluster-Selling/gi, "mehrere große Verkäufe"],
  [/Whale-Desk/gi, "Bereich große Käufe"],
  [/Paper-Watch/gi, "Demo-Prüfung"],
  [/watching Tag\s*\d+\/\d+[^.!]*/gi, "die Demo-Prüfung läuft"],
  [/rel\s*-?\d+[.,]\d+\s*%/gi, "Abstand zum Markt"],
  [/\b8-?K\b/gi, "Unternehmensmeldung"],
  [/\b10-?Q\b/gi, "Quartalsbericht"],
  [/\b10-?K\b/gi, "Jahresbericht"],
  [/\b13F\b/gi, "Positionsmeldung"],
  [/Form\s*4/gi, "Insider-Meldung"],
  [/institutioneller Flow/gi, "Käufe großer Anleger"],
  [/Whale-?Flows?/gi, "große Käufe oder Verkäufe"],
  [/\bSentiment\b/gi, "Stimmung der Anleger"],
  [/\bOverlay\b/g, "Beimischung"],
  [/\bNotional\b/gi, "Einsatz"],
  [/outperformt/gi, "läuft besser als"],
  [/\bbullish\b/gi, "zuversichtlich"],
  [/\bbearish\b/gi, "vorsichtig"],
  [/\bETF\b/g, "Korb"],
  [/\bEPS\b/g, "Gewinn je Aktie"],
  [/\bCAGR\b/g, "Jahreswachstum"],
  [/\bATR\b/g, "übliche Tagesschwankung"],
  [/\bpp\b/g, "Prozentpunkte"],
  [/ vs\.? /gi, " gegen "],
  ...Object.keys(TITLE_NAMES)
    .sort((a, b) => b.length - a.length)
    .map((sym): [RegExp, string] => [new RegExp(`\\b${sym}\\b`, "g"), TITLE_NAMES[sym]!]),
];

export function spokenName(symbol: string, name?: string) {
  return spokenTitle(symbol, name);
}

export function adviceLine(rec: RecStatus, name?: string) {
  const who = name ? `${name}. ` : "";
  return `${who}${REC_LABEL[rec]}`;
}

export function stripJargon(text: string) {
  let s = replaceTickers(extractPlain(text));
  for (const [re, to] of SWAP) s = s.replace(re, to);
  s = s.replace(/\\n/g, "\n").replace(/\\t/g, " ");
  s = s.replace(/[ \t]+/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
  return s;
}

export function looksLikeJson(text: string) {
  const t = text.trim();
  return t.startsWith("{") || t.startsWith("[") || /"(display|spoken|actions|sources)"\s*:/.test(t);
}

function unescapeJson(s: string) {
  return s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\t/g, " ").replace(/\\\\/g, "\\");
}

function jsonField(raw: string, key: string) {
  const re = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
  const m = raw.match(re);
  if (m) return unescapeJson(m[1]!);
  const open = raw.match(new RegExp(`"${key}"\\s*:\\s*"`));
  if (!open || open.index == null) return "";
  const start = open.index + open[0].length;
  const rest = raw.slice(start);
  const end = rest.search(/[^\\]"/);
  const cut = end >= 0 ? rest.slice(0, end) : rest.replace(/["}\s]+$/, "");
  return unescapeJson(cut);
}

export function extractPlain(text: string) {
  const t = (text ?? "").trim();
  if (!t) return "";
  if (!looksLikeJson(t)) return t.replace(/\\n/g, "\n");
  try {
    const parsed = JSON.parse(t) as { spoken?: string; display?: string; say?: string };
    const display = parsed.display || parsed.say;
    const spoken = parsed.spoken;
    if (typeof display === "string" && (/[•\n]/.test(display) || display.length > 40)) return display;
    if (typeof spoken === "string" && spoken.trim()) return spoken;
    if (typeof display === "string" && display.trim()) return display;
  } catch {
    /* truncated json */
  }
  const display = jsonField(t, "display") || jsonField(t, "say");
  const spoken = jsonField(t, "spoken");
  if (display && (/[•\n]/.test(display) || display.length > spoken.length)) return display;
  if (spoken) return spoken;
  if (display) return display;
  return "";
}

export function toPoints(text: string, max = 6): string[] {
  const plain = extractPlain(text);
  if (!plain) return [];
  const lined = plain
    .replace(/\\n/g, "\n")
    .replace(/[•●▪‣]\s*/g, "\n")
    .replace(/\n{2,}/g, "\n");
  let rows = lined
    .split("\n")
    .map((p) => p.replace(/^\d+[.)]\s*/, "").replace(/^[-–—]\s*/, "").trim())
    .filter((p) => p.length > 2);
  if (rows.length <= 1) {
    rows = (rows[0] ?? plain)
      .split(/(?<=[^.0-9][.!?])\s+(?=[A-ZÄÖÜ])/)
      .map((s) => s.trim())
      .filter((p) => p.length > 2);
  }
  const skip = /^(empfehlung|lage|zusammenfassung|womit soll|heute:?$|zu ihrer frage)/i;
  const out: string[] = [];
  for (const chunk of rows) {
    if (looksLikeJson(chunk) || skip.test(chunk)) continue;
    if (/^(display|spoken|actions|sources|kind|title|tier)\b/i.test(chunk)) continue;
    let line = stripJargon(chunk).replace(/^["']|["']$/g, "").trim();
    if (line.length < 8 && !/[.!?]$/.test(line)) continue;
    if (line.length < 3) continue;
    if (line.length > 110) line = `${line.slice(0, 100).replace(/[,.\s]+\S*$/, "")}.`;
    if (!/[.!?]$/.test(line) && /[:]$/.test(line) === false && line.length > 24) line = `${line}.`;
    if (out.some((x) => x.slice(0, 22) === line.slice(0, 22))) continue;
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

export function pointsSpeech(text: string, max = 5) {
  return toPoints(text, max).join(" ");
}

export function clampSentences(text: string, max: number) {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);
  const kept: string[] = [];
  for (const p of parts) {
    const words = p.split(/\s+/);
    const cut = words.length > 36 ? `${words.slice(0, 32).join(" ")}.` : p;
    kept.push(cut);
    if (kept.length >= max) break;
  }
  return kept.join(" ");
}

export function stageOneFromCard(card: IntelCard) {
  const name = spokenName(card.symbol, card.name);
  const move =
    card.changeToday > 0.15
      ? `${name} ist heute um ${Math.abs(card.changeToday).toFixed(1).replace(".", ",")} Prozent gestiegen.`
      : card.changeToday < -0.15
        ? `${name} ist heute um ${Math.abs(card.changeToday).toFixed(1).replace(".", ",")} Prozent gefallen.`
        : `${name} hat sich heute kaum bewegt.`;
  const why = stripJargon(card.development).replace(/\.$/, "");
  return clampSentences(stripJargon(`${move} ${why}. ${adviceLine(card.rec)}`), 4);
}

export function stageTwoWhy(card: IntelCard) {
  const miss = card.openQuestions[0];
  const contra = card.negatives[0];
  const line = miss
    ? `Die Bewegung ist noch nicht stark bestätigt. Es fehlt vor allem: ${stripJargon(miss)}.`
    : contra
      ? `Dagegen spricht: ${stripJargon(contra)}`
      : "Große Anleger kaufen noch nicht eindeutig mit.";
  const extra = card.diagnosis
    ? `Unsere Prüfung läuft noch ${Math.max(0, card.diagnosis.days - card.diagnosis.day)} Tage.`
    : "Ich würde deshalb noch zwei Tage beobachten.";
  return clampSentences(stripJargon(`${line} ${extra} ${adviceLine(card.rec)}`), 4);
}

export function stageTwoNeed(card: IntelCard) {
  const need = card.openQuestions[0] ?? "mehr Käufe bei steigendem Handelsvolumen";
  return clampSentences(
    stripJargon(`Hier müsste das Handelsvolumen steigen. Einfach gesagt: ${need}. ${adviceLine(card.rec)}`),
    3,
  );
}

export function diagnosisPlain(dx: Diagnosis) {
  const name = spokenName(dx.symbol, dx.name);
  const left = Math.max(0, dx.days - dx.day);
  const miss = dx.log.at(-1)?.missing[0];
  if (dx.status === "done") {
    const v =
      dx.result?.verdict === "widerlegt"
        ? "Die Kaufidee hat sich nicht bestätigt. Nicht kaufen."
        : dx.result?.verdict === "bestätigt"
          ? "Die Prüfung spricht eher dafür, dabei zu bleiben. Kein Zwangskauf."
          : "Die Prüfung ist gemischt. Ein Einstieg bleibt unsicher.";
    return clampSentences(`${name}: ${v}`, 2);
  }
  const missLine = miss ? `Es fehlt noch: ${stripJargon(miss)}.` : "Eine wichtige Bestätigung fehlt noch.";
  return clampSentences(
    `Wir sind bei Tag ${dx.day} von ${dx.days} bei ${name}. ${missLine} ${left > 0 ? `Ich prüfe das noch ${left === 1 ? "einen Tag" : `${left} Tage`}.` : "Der letzte Prüftag ist da."} Noch nicht kaufen.`,
    4,
  );
}

export function hintFromCard(card: IntelCard) {
  const name = spokenName(card.symbol, card.name);
  if (card.diagnosis) {
    const left = Math.max(0, card.diagnosis.days - card.diagnosis.day);
    return {
      symbol: card.symbol,
      title: name,
      line: left > 0 ? `Prüfung läuft noch ${left === 1 ? "einen Tag" : `${left} Tage`}. Noch nicht kaufen.` : "Letzter Prüftag. Noch nicht kaufen.",
    };
  }
  return {
    symbol: card.symbol,
    title: name,
    line: REC_LABEL[card.rec],
  };
}

export function openingLine(name: string) {
  return `Ich öffne ${name}.`;
}
