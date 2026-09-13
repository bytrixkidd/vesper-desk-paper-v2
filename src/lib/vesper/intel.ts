import { floorName } from "@/lib/floor";
import { changePct } from "@/lib/explain";
import { displayName, replaceTickers } from "@/lib/names";
import { sleeveOf } from "@/lib/paper";
import type { Agent, AlertItem, Bar, EarningsNote, Filing, Lesson, MacroEvent, MorningBrief, SentimentRow, Ticker, WhalePosition } from "@/lib/types";
import type { Diagnosis, VesperSource } from "./types";

export type RecStatus =
  | "ignorieren"
  | "beobachten"
  | "diagnose-laeuft"
  | "genauer-pruefen"
  | "trade-vorbereiten"
  | "entscheidung"
  | "halten"
  | "risiko-reduzieren"
  | "ausstieg-pruefen"
  | "these-widerlegt";

export type IntelAskWhich = "need" | "odds" | "bots" | "why" | "next" | "falsify" | "for" | "against" | "change";

export type BotTake = {
  id: string;
  name: string;
  take: string;
  stance: "pro" | "contra" | "neutral";
  source: "bot" | "floor" | "idea" | "overnight";
};

export type IntelScenario = {
  id: "up" | "base" | "down";
  label: string;
  iff: string;
  path: string;
  p: number;
  zone: string;
  falsify: string;
};

export type IntelPlan = {
  why: string;
  confirms: string[];
  zone: string;
  size: string;
  stop: string;
  target: string;
  horizon: string;
  earlyExit: string;
  dates: string;
  book: string;
};

export type IntelCard = {
  symbol: string;
  name: string;
  last: number;
  fetchedAt: string;
  changeToday: number;
  changeSinceReview: number;
  thesis: string;
  development: string;
  positives: string[];
  negatives: string[];
  conflicts: string[];
  bots: BotTake[];
  agreement: "einig" | "geteilt" | "uneinig";
  sharedSource: boolean;
  overnight: string | null;
  sources: { title: string; kind: VesperSource["kind"]; note: string }[];
  openQuestions: string[];
  diagnosis: {
    id: string;
    day: number;
    days: number;
    thesis: string;
    state: string;
    missing: string[];
    nextCheck: string;
    why: string;
  } | null;
  nextEvent: string;
  entryIf: string[];
  exitIf: string[];
  falsify: string[];
  risk: string;
  dataQuality: "frisch" | "alt" | "lokal";
  confidence: "niedrig" | "mittel" | "hoch";
  lastRec: RecStatus | null;
  rec: RecStatus;
  recWhy: string;
  recChangedAt: string | null;
  nextCheck: string;
  scenarios: IntelScenario[];
  pBasis: string[];
  plan: IntelPlan;
  status: RecStatus;
  spoken: string;
  display: string;
  fingerprint: string;
  stale: boolean;
  updatedAt: string;
};

export type IntelNotice = {
  id: string;
  ts: string;
  symbol: string;
  spoken: string;
  display: string;
  needDecision: boolean;
};

export type IntelBundle = {
  cards: Record<string, IntelCard>;
  notices: IntelNotice[];
  briefSpoken: string;
  briefDisplay: string;
  asOf: string;
};

export type IntelDesk = {
  asOf: string;
  tapeSource: string | null;
  sessionLabel: string;
  watchlist: Ticker[];
  tape: Record<string, Bar[]>;
  bots: Agent[];
  filings: Filing[];
  earnings: EarningsNote[];
  sentiment: SentimentRow[];
  whales: WhalePosition[];
  macro: MacroEvent[];
  alerts: AlertItem[];
  messages: { author: string; text: string }[];
  ideas: { ticker: string; bot: string; thesis: string; status: string }[];
  briefs: MorningBrief[];
  lessons: Lesson[];
  liveAbort: boolean;
};

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function volRel(bars: Bar[]) {
  if (bars.length < 6) return null;
  const last = bars.at(-1)!;
  const mean = avg(bars.slice(-21, -1).map((b) => b.v));
  if (mean <= 0) return null;
  return last.v / mean;
}

function fingerprintOf(parts: (string | number | boolean | null | undefined)[]) {
  return parts.map((p) => String(p ?? "")).join("|");
}

function firstSentence(text: string) {
  return text.split(/(?<=[.!?])\s+/)[0]?.trim() || text.slice(0, 180).trim();
}

function stanceFrom(text: string): BotTake["stance"] {
  const f = text.toLowerCase();
  if (/nicht nachlaufen|vorsicht|fehlt|nicht bestät|miss\b|trimmen|exit|abbruch|verbrannt|kein entry|flag, keine/.test(f)) return "contra";
  if (/beat|zufluss|halten|tollbooth|prior|add|anheb|take-or-pay|reserviert|guide angehoben|konstruktiv/.test(f)) return "pro";
  return "neutral";
}

function pickBots(symbol: string, name: string, desk: IntelDesk): BotTake[] {
  const hits: BotTake[] = [];
  const seen = new Set<string>();
  const mentions = (text: string) => text.includes(symbol) || new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text);

  for (const b of desk.bots) {
    if (!mentions(b.summary)) continue;
    const sentence = b.summary.split(/(?<=[.!?])\s+/).find((s) => mentions(s)) ?? b.summary.slice(0, 180);
    hits.push({ id: b.id, name: b.name, take: sentence.trim(), stance: stanceFrom(sentence), source: "bot" });
    seen.add(b.id);
  }
  for (const i of desk.ideas) {
    if (i.ticker !== symbol || seen.has(i.bot)) continue;
    hits.push({ id: i.bot, name: i.bot, take: i.thesis, stance: stanceFrom(i.thesis), source: "idea" });
    seen.add(i.bot);
  }
  for (const m of desk.messages) {
    if (m.author === "you" || seen.has(m.author) || !mentions(m.text)) continue;
    hits.push({
      id: m.author,
      name: floorName(m.author as never) || m.author,
      take: firstSentence(m.text),
      stance: stanceFrom(m.text),
      source: "floor",
    });
    seen.add(m.author);
  }
  for (const brief of desk.briefs) {
    for (const sec of brief.sections) {
      if (!sec.tickers?.includes(symbol)) continue;
      const id = `overnight-${sec.heading}`;
      if (seen.has(id)) continue;
      hits.push({
        id,
        name: "Overnight",
        take: firstSentence(sec.body),
        stance: stanceFrom(sec.body),
        source: "overnight",
      });
      seen.add(id);
    }
  }
  return hits.slice(0, 8);
}

function overnightNote(symbol: string, desk: IntelDesk): string | null {
  for (const brief of desk.briefs) {
    const act = brief.actions.find((a) => a.ticker === symbol);
    if (act) return `${act.action}. ${act.rationale}`;
    const sec = brief.sections.find((s) => s.tickers?.includes(symbol));
    if (sec) return firstSentence(sec.body);
  }
  return null;
}

function nextMacro(macro: MacroEvent[], symbol: string) {
  const now = Date.now();
  const upcoming = macro
    .filter((m) => Date.parse(m.when) >= now - 86400000)
    .sort((a, b) => Date.parse(a.when) - Date.parse(b.when));
  const hit = upcoming[0];
  if (!hit) return symbol === "SPY" || symbol === "VOO" ? "Nächster Makro-Print laut Kalender." : "Kein fester Firmentermin in der Liste.";
  return `${hit.title} (${hit.when.slice(0, 10)})`;
}

function recFor(args: {
  sleeve: ReturnType<typeof sleeveOf>;
  dx: Diagnosis | undefined;
  positives: string[];
  negatives: string[];
  vol: number | null;
  liveAbort: boolean;
}): { rec: RecStatus; why: string } {
  if (args.liveAbort) {
    return { rec: "risiko-reduzieren", why: "Weniger halten. Nicht nachkaufen. Der Test läuft ohne neue Wette." };

  }
  if (args.dx?.status === "done" && args.dx.result?.verdict === "widerlegt") {
    return { rec: "these-widerlegt", why: "Nicht kaufen. Die Beobachtung hat die Idee nicht bestätigt." };

  }
  if (args.dx?.status === "running") {
    return { rec: "diagnose-laeuft", why: `Noch nicht kaufen. Prüfung Tag ${args.dx.day} von ${args.dx.days}. Es fehlen Bestätigungen.` };

  }
  if (args.sleeve === "core" || args.sleeve === "toll") {
    return { rec: "halten", why: "Halten. Das ist Grundstock, nicht zum Umschichten." };

  }
  if (args.negatives.length >= 2 && args.positives.length === 0) {
    return { rec: "ignorieren", why: "Links liegen lassen. Mehr spricht dagegen als dafür." };

  }
  if (args.vol && args.vol > 1.3 && args.negatives.length === 0) {
    return { rec: "genauer-pruefen", why: "Genau anschauen, aber nicht kaufen. Der Umsatz zieht mit, ein Einstieg ist noch keine Zusage." };

  }
  if (args.positives.length >= 2 && args.negatives.length <= 1) {
    return { rec: "beobachten", why: "Noch nicht kaufen. Es gibt Stützen, aber die Bestätigung fehlt." };

  }
  return { rec: "beobachten", why: "Noch nicht kaufen. Eine Bewegung allein ist kein Auftrag." };
}

function scenarios(change: number, vol: number | null, vsSpy: number | null): { rows: IntelScenario[]; basis: string[] } {
  const volOk = (vol ?? 1) > 1.15;
  const vs = vsSpy ?? 0;
  let up = 28;
  let down = 28;
  let base = 44;
  if (change > 0 && volOk) {
    up = 42;
    base = 38;
    down = 20;
  } else if (change < -1.5) {
    down = 40;
    base = 38;
    up = 22;
  } else if (change > 0 && !volOk) {
    up = 30;
    base = 45;
    down = 25;
  }
  if (vs < -0.8) {
    down += 6;
    up -= 6;
  }
  const sum = up + base + down;
  up = Math.round((up / sum) * 100);
  down = Math.round((down / sum) * 100);
  base = 100 - up - down;
  return {
    basis: [
      `Tagesänderung ${change.toFixed(1)} Prozent`,
      vol == null ? "Handelsmenge unsicher (kurze Reihe)" : `Handelsmenge ${vol.toFixed(1)} mal so hoch wie in den letzten Tagen`,
      vsSpy == null ? "Kein Marktvergleich" : `Abstand zum großen US-Aktienkorb ${vsSpy.toFixed(1)} Prozent`,
    ],
    rows: [
      {
        id: "up",
        label: "Erholung",
        iff: "Der Schluss hält, und das Volumen steigt mit.",
        path: "Weiter nach oben, sofern große Käufer nachziehen.",
        p: up,
        zone: "über dem letzten Schluss",
        falsify: "Schluss unter dem Tief der letzten fünf Tage.",
      },
      {
        id: "base",
        label: "Seitwärts",
        iff: "Keine neue Unternehmensmeldung, normales Volumen.",
        path: "Schwanken um den letzten Kurs.",
        p: base,
        zone: "um den letzten Schluss",
        falsify: "Ein Tag mit mehr als drei Prozent gegen die Richtung.",
      },
      {
        id: "down",
        label: "Rückfall",
        iff: "Volumen bleibt dünn oder eine negative Meldung kommt.",
        path: "Abgabe der heutigen Bewegung.",
        p: down,
        zone: "unter dem letzten Schluss",
        falsify: "Zwei Tage mit steigendem Volumen in die Gegenrichtung.",
      },
    ],
  };
}

function spokenMatter(args: { filing?: Filing; vol: number | null; changeToday: number; whaleAdd: boolean; earn?: EarningsNote }) {
  const bits: string[] = [];
  if (args.filing?.material) bits.push("die neue Unternehmensmeldung ist relevant");
  else if (args.earn && Math.abs(Date.parse(args.earn.date) - Date.now()) < 8 * 86400000) bits.push("die Zahlen stehen bevor");
  else if (args.vol && args.vol > 1.2) bits.push("das Volumen ist heute auffällig");
  const confirmed = Boolean(args.vol && args.vol > 1.15 && args.whaleAdd);
  if (!confirmed) {
    bits.push("die großen Käufer bestätigen die Bewegung noch nicht");
  } else {
    bits.push("Volumen und gemeldete große Positionen ziehen in dieselbe Richtung — das ist keine Tageskauf-Bestätigung");
  }
  return bits.join(", ");
}

function spokenOpen(name: string, card: {
  changeToday: number;
  diagnosis: { day: number; days: number } | null;
  rec: RecStatus;
  matter: string;
  stale: boolean;
}) {
  const move =
    card.changeToday > 0.15
      ? `${name} steigt heute`
      : card.changeToday < -0.15
        ? `${name} gibt heute nach`
        : `${name} liegt heute nahezu unverändert`;
  const rec =
    card.rec === "halten"
      ? "Halten. Das ist Grundstock, nicht zum Umschichten."
      : card.rec === "diagnose-laeuft"
        ? "Noch nicht kaufen. Die Prüfung läuft."
        : card.rec === "these-widerlegt"
          ? "Nicht kaufen. Die Idee hat sich nicht bestätigt."
          : card.rec === "genauer-pruefen"
            ? "Genau anschauen, aber nicht kaufen."
            : card.rec === "trade-vorbereiten"
              ? "Ein Testkauf wäre denkbar. Kein echtes Geld."
              : card.rec === "entscheidung"
                ? "Hier müssen Sie entscheiden: dabei bleiben oder raus."
                : card.rec === "risiko-reduzieren"
                  ? "Weniger halten. Nicht nachkaufen."
                  : card.rec === "ausstieg-pruefen"
                    ? "Prüfen, ob wir verkaufen. Nicht nachlaufen."
                    : "Noch nicht kaufen. Erst weiter zuschauen.";
  const diag = card.diagnosis ? `Die laufende Prüfung ist an Tag ${card.diagnosis.day} von ${card.diagnosis.days}.` : "";
  const stale = card.stale ? " Die vorbereiteten Daten sind nicht vom letzten frischen Tape." : "";
  return `${move}. ${card.matter.charAt(0).toUpperCase()}${card.matter.slice(1)}. ${diag} ${rec}${stale}`
    .replace(/\s+/g, " ")
    .trim();
}

export function isContentBriefing(spoken: string) {
  if (!spoken || spoken.trim() === "Natürlich, Sir." || spoken.trim() === "Natürlich, Sir") return false;
  const hasMove = /steigt|gibt nach|nahezu unverändert|liegt heute/i.test(spoken);
  const hasRec = /kaufen|halten|zuschauen|prüfen|verkaufen|nachlaufen|nachkaufen|Grundstock|Entscheidung/i.test(spoken);
  return hasMove && hasRec && spoken.length > 48;
}

export function buildCard(symbol: string, desk: IntelDesk, diagnoses: Diagnosis[], prev?: IntelCard | null): IntelCard {
  const t = desk.watchlist.find((x) => x.symbol === symbol);
  const name = displayName(symbol, t?.name);
  const spokenName = name;
  const bars = desk.tape[symbol] ?? [];
  const lastBar = bars.at(-1);
  const prevBar = bars.at(-2);
  const last = lastBar?.c ?? t?.last ?? 0;
  const changeToday = lastBar && prevBar ? changePct(lastBar, prevBar) : t?.changePct ?? 0;
  const spy = desk.tape.SPY ?? [];
  const vsSpy =
    lastBar && prevBar && spy.at(-1) && spy.at(-2)
      ? changeToday - changePct(spy.at(-1)!, spy.at(-2)!)
      : null;
  const vol = volRel(bars);
  const filing = desk.filings.find((f) => f.ticker === symbol);
  const earn = desk.earnings.find((e) => e.ticker === symbol);
  const sent = desk.sentiment.find((s) => s.ticker === symbol);
  const whales = desk.whales.filter((w) => w.ticker === symbol);
  const whaleAdd = whales.some((w) => w.action === "add" || w.action === "new");
  const whaleTrim = whales.some((w) => w.action === "trim" || w.action === "exit");
  const bots = pickBots(symbol, name, desk);
  const dx = diagnoses.find((d) => d.symbol === symbol && (d.status === "running" || d.status === "done"));
  const running = diagnoses.find((d) => d.symbol === symbol && d.status === "running") ?? (dx?.status === "running" ? dx : undefined);
  const sleeve = sleeveOf(symbol);
  const overnight = overnightNote(symbol, desk);
  const alert = desk.alerts.find((a) => a.ticker === symbol && (a.severity === "material" || a.severity === "watch"));

  const positives: string[] = [];
  const negatives: string[] = [];
  const conflicts: string[] = [];
  if (changeToday > 0.4) positives.push(`Kurs heute ${changeToday.toFixed(2)} %.`);
  if (changeToday < -0.4) negatives.push(`Kurs heute ${changeToday.toFixed(2)} %.`);
  if (vol && vol > 1.25) positives.push("Handelsvolumen über dem Üblichen.");
  if (vol && vol < 0.85 && Math.abs(changeToday) > 0.4) negatives.push("Die Bewegung läuft ohne erhöhtes Volumen.");
  if (whaleAdd) positives.push("Letzte Positionsmeldungen großer Anleger zeigen Zukäufe. Das ist kein Tageskauf.");
  if (whaleTrim) negatives.push("Mindestens ein großer Fonds hat die Position zuletzt verringert.");
  if (filing?.material) {
    if (/kapazit|abnahme|beat|anheb|take-or-pay/i.test(filing.delta + filing.title)) positives.push(`Neue Meldung: ${filing.title}.`);
    else negatives.push(`Neue Meldung: ${filing.title}.`);
  }
  if (sent?.flag) conflicts.push("Die Aktie wird ungewöhnlich oft erwähnt. Aufmerksamkeit ist kein Kaufgrund.");
  if (earn && /miss/i.test(earn.summary)) negatives.push(`Letzte Zahlen: ${earn.summary}`);
  if (earn && /beat/i.test(earn.summary)) positives.push(`Letzte Zahlen: ${earn.summary}`);
  if (vsSpy != null && vsSpy < -0.6) negatives.push("Schwächer als der breite US-Markt.");
  if (vsSpy != null && vsSpy > 0.6) positives.push("Stärker als der breite US-Markt.");
  if (whaleAdd && vol != null && vol < 1) conflicts.push("Große gemeldete Positionen, aber das heutige Volumen bestätigt das nicht.");
  if (desk.liveAbort && sleeve === "overlay") negatives.push("Beimischung pausiert. Nicht nachkaufen.");

  const filingBots = bots.filter((b) => /8-k|unternehmensmeldung|take-or-pay|form 4|10-q/i.test(b.take));
  const sharedSource = filingBots.length >= 2 || bots.filter((b) => b.source === "bot" && /8-k|take-or-pay/i.test(b.take)).length >= 2;
  if (sharedSource) conflicts.push("Mehrere Bots stützen sich auf dieselbe Meldung. Das ist keine unabhängige Bestätigung.");

  const pro = bots.filter((b) => b.stance === "pro").length;
  const contra = bots.filter((b) => b.stance === "contra").length;
  const agreement: IntelCard["agreement"] = bots.length < 2 ? "geteilt" : contra > 0 && pro > 0 ? "uneinig" : contra > pro ? "geteilt" : "einig";

  const { rec, why } = recFor({
    sleeve,
    dx: running ?? dx,
    positives,
    negatives,
    vol,
    liveAbort: desk.liveAbort,
  });

  const sc = scenarios(changeToday, vol, vsSpy);
  const missing: string[] = [];
  if (!(vol && vol > 1.15)) missing.push("steigendes Volumen");
  if (!whaleAdd) missing.push("größere Käufer am Markt, nicht nur alte Positionsmeldungen");
  else missing.push("dass heutige Käufe die alten Positionsmeldungen bestätigen");
  if (Math.abs(changeToday) > 0 && vsSpy != null && vsSpy < 0) missing.push("dass der Titel den Markt nicht weiter hinterherhinkt");

  const development =
    filing?.material
      ? `Neue Unternehmensmeldung: ${filing.title.replace(/\bNVDA\b/g, "Nvidia").replace(/\b8-K\b/g, "Unternehmensmeldung").replace(/Form 4/g, "Insider-Meldung")}.`
      : alert
        ? alert.headline.replace(/\bNVDA\b/g, "Nvidia")
        : sent?.flag
          ? "Die Aufmerksamkeit ist hoch, ohne dass das allein ein Kauf wäre."
          : vol && vol > 1.2
            ? "Das Volumen ist heute auffällig."
            : whaleAdd
              ? "Große Anleger haben zuletzt zugelegt — das bestätigt den heutigen Kurs nicht automatisch."
              : overnight
                ? overnight
                : "Keine einzelne Meldung sticht heraus.";

  const dxWhy = running
    ? running.thesis
    : "";

  const thesis =
    sleeve === "core"
      ? "Halten. Das ist Grundstock."
      : sleeve === "toll"
        ? "Halten. Das ist die Mautstelle, solange der Grundstock steht."
        : running
          ? running.workingThesis || running.thesis
          : "Nur mit Bestätigung kaufen. Nicht nachlaufen.";

  const quality: IntelCard["dataQuality"] = desk.tapeSource === "yahoo" ? "frisch" : desk.tapeSource ? "alt" : "lokal";
  const stale = quality !== "frisch";
  const fetchedAt = desk.asOf;
  const fp = fingerprintOf([
    symbol,
    last.toFixed(2),
    changeToday.toFixed(2),
    vol?.toFixed(2),
    filing?.id,
    sent?.zscore,
    whales.map((w) => w.action).join(","),
    running?.day,
    running?.status,
    rec,
    bots.map((b) => b.take.slice(0, 40)).join(";"),
    desk.liveAbort,
    desk.messages.length,
  ]);

  const nextCheck = running
    ? `Nächster Prüfzeitpunkt: nächster Handelstag (Tag ${Math.min(running.days, running.day + 1)} von ${running.days}). Das ist keine Kaufzusage.`
    : "Nächste Prüfung bei neuem Schluss oder neuer Meldung. Kein festes Kaufdatum.";

  const plan: IntelPlan = {
    why: thesis,
    confirms: missing,
    zone: "Nicht über dem letzten starken Schluss nachlaufen.",
    size: sleeve === "overlay" ? "Nur ein kleiner Anteil. Paper zuerst." : "Grundstock nicht umschichten.",
    stop: "Halt-Tief der Diagnose, oder der 300-Dollar-Test im Mandat.",
    target: "Kein Kursziel. Ausstieg, wenn die These trägt oder das Mandat greift.",
    horizon: running ? `${running.days} Handelstage Beobachtung, kein zugesagter Einstieg.` : "Nächster Schluss oder nächste Meldung.",
    earlyExit: "Negative Unternehmensmeldung ohne Gegenkauf, oder das Paper liegt klar hinter dem Markt.",
    dates: earn ? `Zahlen ${earn.date}` : nextMacro(desk.macro, symbol),
    book: "Live-Ausführung bleibt aus. Paper 300 Dollar digital, kein Echtgeld. 5.000 Euro im Monat brauchen mehr Einsatz.",
  };

  const display = [
    `${name} · ${last.toFixed(2)} Dollar · ${changeToday >= 0 ? "+" : ""}${changeToday.toFixed(2)} %`,
    `Annahme: ${thesis}`,
    `Neu: ${development}`,
    overnight ? `Über Nacht: ${overnight}` : "",
    `Dafür: ${positives.slice(0, 3).join(" ") || "—"}`,
    `Dagegen: ${negatives.slice(0, 3).join(" ") || "—"}`,
    conflicts.length ? `Widerspruch: ${conflicts.join(" ")}` : "",
    `Bots: ${bots.length ? bots.map((b) => `${b.name} (${b.stance})`).join(", ") : "keine direkte Notiz"} · ${agreement}${sharedSource ? " · dieselbe Quelle" : ""}`,
    running
      ? `Prüfung Tag ${running.day} von ${running.days}. Fehlt: ${running.log.at(-1)?.missing.join(", ") || missing.join(", ")}.`
      : "Keine laufende Prüfung.",
    `Tipp: ${why}`,
    prev && prev.rec !== rec ? "Die Lage hat sich geändert." : "",
    `Wenn es gut läuft ${sc.rows[0]!.p} %, seitwärts ${sc.rows[1]!.p} %, Rückfall ${sc.rows[2]!.p} %. Grundlage: ${sc.basis.join("; ")}.`,
    `Einstieg nur wenn: ${missing.join("; ")}.`,
    `Ausstieg wenn: ${plan.earlyExit}`,
    nextCheck,
    stale ? "Daten nicht vom letzten Kurszug. Keine frische Empfehlung vortäuschen." : `Stand ${desk.sessionLabel}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const matter = spokenMatter({ filing, vol, changeToday, whaleAdd, earn });

  const card: IntelCard = {
    symbol,
    name,
    last,
    fetchedAt,
    changeToday,
    changeSinceReview: prev ? changeToday - (prev.changeToday || 0) : 0,
    thesis: replaceTickers(thesis),
    development: replaceTickers(development),
    positives,
    negatives,
    conflicts,
    bots,
    agreement,
    sharedSource,
    overnight,
    sources: [
      { title: `${name} Kurs`, kind: "tape", note: desk.sessionLabel },
      ...(filing ? [{ title: filing.title, kind: "filing" as const, note: filing.delta }] : []),
      ...(sent ? [{ title: `Erwähnungen ${name}`, kind: "sentiment" as const, note: `z ${sent.zscore.toFixed(1)}` }] : []),
      ...whales.slice(0, 2).map((w) => ({ title: `${w.fund} ${w.action}`, kind: "flows" as const, note: `${w.changePct.toFixed(1)} %` })),
      ...bots.slice(0, 3).map((b) => ({ title: b.name, kind: "bot" as const, note: b.take.slice(0, 120) })),
      ...(overnight ? [{ title: "Overnight", kind: "brief" as const, note: overnight }] : []),
    ],
    openQuestions: missing,
    diagnosis: running
      ? {
          id: running.id,
          day: running.day,
          days: running.days,
          thesis: running.workingThesis,
          state: running.thesisState,
          missing: running.log.at(-1)?.missing ?? missing,
          nextCheck: "nächster Handelsschluss",
          why: dxWhy,
        }
      : null,
    nextEvent: earn ? `Zahlen ${earn.date}: ${earn.summary}` : nextMacro(desk.macro, symbol),
    entryIf: missing.map((m) => `Wenn ${m}.`),
    exitIf: ["Wenn der Schluss das Halt-Tief der Diagnose unterschreitet.", "Wenn das Paper klar hinter dem Markt liegt."],
    falsify: ["Schluss unter dem Halt-Tief bei steigendem Volumen.", "Eine negative Unternehmensmeldung ohne Gegenkauf."],
    risk: sleeve === "overlay" ? "Beimischung. Eine Firmenmeldung ändert die Lage schneller als der Chart." : "Das Risiko sitzt im Markt, nicht in diesem einen Namen.",
    dataQuality: quality,
    confidence: stale ? "niedrig" : running ? "mittel" : bots.length >= 2 ? "mittel" : "niedrig",
    lastRec: prev?.rec ?? null,
    rec,
    recWhy: replaceTickers(why),
    recChangedAt: prev && prev.rec !== rec ? fetchedAt : prev?.recChangedAt ?? null,
    nextCheck,
    scenarios: sc.rows,
    pBasis: sc.basis,
    plan,
    status: rec,
    spoken: replaceTickers(
      spokenOpen(spokenName, {
        changeToday,
        diagnosis: running ? { day: running.day, days: running.days } : null,
        rec,
        matter,
        stale,
      }),
    ),
    display: replaceTickers(display),
    fingerprint: fp,
    stale,
    updatedAt: fetchedAt,
  };
  return card;
}

export function gatherDesk(s: {
  tapeAsOf: string | null;
  tapeSource: string | null;
  sessionLabel: string;
  watchlist: Ticker[];
  tape: Record<string, Bar[]>;
  bots: Agent[];
  filings: Filing[];
  earnings: EarningsNote[];
  sentiment: SentimentRow[];
  whales: WhalePosition[];
  macro: MacroEvent[];
  alerts: AlertItem[];
  messages: { author: string; text: string }[];
  ideas: { ticker: string; bot: string; thesis: string; status: string }[];
  briefs?: MorningBrief[];
  lessons?: Lesson[];
  liveAbort?: boolean;
}): IntelDesk {
  return {
    asOf: s.tapeAsOf ?? new Date().toISOString(),
    tapeSource: s.tapeSource,
    sessionLabel: s.sessionLabel,
    watchlist: s.watchlist,
    tape: s.tape,
    bots: s.bots,
    filings: s.filings,
    earnings: s.earnings,
    sentiment: s.sentiment,
    whales: s.whales,
    macro: s.macro,
    alerts: s.alerts,
    messages: s.messages,
    ideas: s.ideas,
    briefs: s.briefs ?? [],
    lessons: s.lessons ?? [],
    liveAbort: Boolean(s.liveAbort),
  };
}

export function suggestDiagnosisDays(symbol: string, desk: IntelDesk): { days: number; why: string; thesis: string } | null {
  const t = desk.watchlist.find((x) => x.symbol === symbol);
  if (!t) return null;
  if (sleeveOf(symbol) !== "overlay") return null;
  const filing = desk.filings.find((f) => f.ticker === symbol && f.material);
  const bars = desk.tape[symbol] ?? [];
  const last = bars.at(-1);
  const prev = bars.at(-2);
  const ch = last && prev ? Math.abs(changePct(last, prev)) : Math.abs(t.changePct);
  const earn = desk.earnings.find((e) => e.ticker === symbol);
  if (ch >= 3) return { days: 2, why: "Kurzfristiges Kursereignis. Zwei Handelstage reichen, um zu sehen, ob es hält.", thesis: `Hält ${t.name} die Bewegung nach dem starken Tag?` };
  if (earn && Math.abs(Date.parse(earn.date) - Date.now()) < 8 * 86400000) {
    return { days: 3, why: "Zahlen nah. Drei Handelstage um den Bericht, kein festes Kaufdatum.", thesis: `Verarbeiten die nächsten Sitzungen die Zahlen von ${t.name}?` };
  }
  if (filing) {
    return { days: 5, why: "Neue Unternehmensmeldung. Fünf Handelstage, weil das kein reines Tagesereignis ist.", thesis: `Bestätigen Kurs, Volumen und große Käufe die Meldung zu ${t.name}?` };
  }
  return null;
}

function noticeFrom(prev: IntelCard | undefined, next: IntelCard): IntelNotice | null {
  if (!prev) return null;
  if (prev.rec !== next.rec) {
    return {
      id: `${next.symbol}-rec-${next.updatedAt}`,
      ts: next.updatedAt,
      symbol: next.symbol,
      spoken: `Bei ${next.name} hat sich der Tipp geändert. ${next.recWhy}`,
      display: `${next.name}: ${next.recWhy}`,
      needDecision: next.rec === "entscheidung" || next.rec === "ausstieg-pruefen",
    };
  }
  if (prev.diagnosis && !next.diagnosis) {
    return {
      id: `${next.symbol}-dx-done-${next.updatedAt}`,
      ts: next.updatedAt,
      symbol: next.symbol,
      spoken: `Die Prüfung zu ${next.name} ist abgeschlossen. ${next.recWhy}`,
      display: `Prüfung ${next.name} abgeschlossen.`,
      needDecision: true,
    };
  }
  if (next.diagnosis && prev.diagnosis && next.diagnosis.day !== prev.diagnosis.day && next.diagnosis.state === "bricht") {
    return {
      id: `${next.symbol}-break-${next.diagnosis.day}`,
      ts: next.updatedAt,
      symbol: next.symbol,
      spoken: `Die Annahme zu ${next.name} wankt. Ein entscheidendes Signal fehlt. Noch nicht kaufen.`,
      display: `${next.name}: die Annahme wankt.`,
      needDecision: false,
    };
  }
  if (prev.agreement !== "uneinig" && next.agreement === "uneinig") {
    return {
      id: `${next.symbol}-split-${next.updatedAt}`,
      ts: next.updatedAt,
      symbol: next.symbol,
      spoken: `Bei ${next.name} widersprechen sich die Bots. Genau anschauen, bevor Sie etwas entscheiden.`,
      display: `${next.name}: die Bots sind uneinig.`,
      needDecision: false,
    };
  }
  if (Math.abs(next.changeToday) >= 3 && Math.abs(prev.changeToday) < 1.5) {
    return {
      id: `${next.symbol}-move-${next.updatedAt}`,
      ts: next.updatedAt,
      symbol: next.symbol,
      spoken: `Bei ${next.name} ist die Bewegung ungewöhnlich. ${next.recWhy}`,
      display: `${next.name}: ungewöhnliche Bewegung.`,
      needDecision: false,
    };
  }
  if (next.openQuestions.length === 0 && prev.openQuestions.length > 0 && next.rec !== "halten") {
    return {
      id: `${next.symbol}-entry-${next.updatedAt}`,
      ts: next.updatedAt,
      symbol: next.symbol,
      spoken: `${next.name} nähert sich der Zone, die wir uns merken wollten. Ein Kauf bleibt prüfbar, nicht zugesagt.`,
      display: `${next.name}: Einstieg denkbar, nicht zugesagt.`,
      needDecision: true,
    };
  }
  const prevFiling = prev.sources.some((s) => s.kind === "filing");
  const nextFiling = next.sources.some((s) => s.kind === "filing");
  if (!prevFiling && nextFiling) {
    return {
      id: `${next.symbol}-filing-${next.updatedAt}`,
      ts: next.updatedAt,
      symbol: next.symbol,
      spoken: `Eine neue Unternehmensmeldung ändert die Einschätzung zu ${next.name}. ${next.recWhy}`,
      display: `${next.name}: neue Meldung.`,
      needDecision: true,
    };
  }
  return null;
}

export function buildBundle(desk: IntelDesk, diagnoses: Diagnosis[], prevCards: Record<string, IntelCard>): IntelBundle {
  const cards: Record<string, IntelCard> = {};
  const notices: IntelNotice[] = [];
  for (const t of desk.watchlist) {
    const prev = prevCards[t.symbol];
    const card = buildCard(t.symbol, desk, diagnoses, prev);
    cards[t.symbol] = card;
    if (!prev || prev.fingerprint !== card.fingerprint) {
      const n = noticeFrom(prev, card);
      if (n) notices.push(n);
    }
  }
  const material = Object.values(cards).filter(
    (c) => c.rec === "diagnose-laeuft" || c.recChangedAt || c.rec === "these-widerlegt" || c.rec === "genauer-pruefen" || c.rec === "risiko-reduzieren",
  );
  const lines = material.slice(0, 3).map((c) => {
    if (c.rec === "diagnose-laeuft" && c.diagnosis) return `Bei ${c.name} läuft die Prüfung, Tag ${c.diagnosis.day} von ${c.diagnosis.days}. Noch nicht kaufen.`;
    if (c.rec === "these-widerlegt") return `Bei ${c.name}: nicht kaufen. Die Idee hat sich nicht bestätigt.`;
    if (c.rec === "risiko-reduzieren") return `Bei ${c.name}: weniger halten, nicht nachkaufen.`;
    if (c.rec === "genauer-pruefen") return `${c.name}: genau anschauen, aber nicht kaufen.`;
    return `${c.name}: ${c.rec === "halten" ? "halten. Grundstock." : c.rec === "beobachten" ? "noch nicht kaufen." : "prüfen, nicht kaufen."}`;
  });
  const briefSpoken =
    lines.length === 0
      ? "Hallo, willkommen, Sir.\nKeine wesentliche Änderung.\nWomit soll ich beginnen?"
      : `Hallo, willkommen, Sir.\n${lines.join("\n")}`;
  const briefDisplay = [
    briefSpoken,
    ...Object.values(cards)
      .filter((c) => c.rec !== "halten" && c.rec !== "ignorieren")
      .slice(0, 8)
      .map((c) => `${c.symbol} · ${c.rec} · ${c.development}`),
  ].join("\n");
  return { cards, notices, briefSpoken, briefDisplay, asOf: desk.asOf };
}

function countLabel(n: number, one: string, many: string, none: string) {
  if (n === 0) return none;
  if (n === 1) return one;
  return `${n} ${many}`;
}

export function remainingDaysSpeech(day: number, days: number) {
  const left = Math.max(0, days - day);
  const words = ["keinen weiteren Handelstag", "einen weiteren Handelstag", "zwei weitere Handelstage", "drei weitere Handelstage", "vier weitere Handelstage", "fünf weitere Handelstage"];
  const span = left <= 5 ? words[left] : `${left} weitere Handelstage`;
  if (left === 0) return "Die Diagnose steht am letzten Tag. Ich prüfe den nächsten Schluss. Das ist ein Prüfzeitpunkt, keine Zusage für einen Kauf.";
  return `Die Diagnose läuft bereits. Ich prüfe die Entwicklung noch ${span} und melde mich früher, wenn ein entscheidendes Signal entsteht. Das ist ein Prüfzeitraum, keine Zusage für einen Kauf.`;
}

export function answerIntel(card: IntelCard, which: IntelAskWhich) {
  if (which === "need") {
    const need = card.openQuestions.slice(0, 3);
    const spoken = need.length
      ? `Der Kurs müsste die aktuelle Stärke halten. ${need.map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join(". ")}.`
      : "Die nötigen Bestätigungen stehen in der Diagnose. Ohne sie bleibt ein Einstieg verfrüht.";
    return { spoken, display: [`Fehlende Bestätigungen:`, ...card.openQuestions, ...card.entryIf, `Zone: ${card.plan.zone}`, `Größe: ${card.plan.size}`].join("\n") };
  }
  if (which === "for") {
    const spoken = card.positives.length
      ? `Dafür spricht: ${card.positives.slice(0, 2).join(" ")} Das allein reicht für einen Einstieg nicht.`
      : "Es gibt gerade kein klares Argument für einen Einstieg.";
    return { spoken, display: card.positives.concat(card.entryIf).join("\n") };
  }
  if (which === "against") {
    const spoken = card.negatives.length
      ? `Dagegen spricht: ${card.negatives.slice(0, 2).join(" ")}`
      : "Kein hartes Gegenargument, aber die Bestätigung fehlt trotzdem.";
    return { spoken, display: [...card.negatives, ...card.falsify].join("\n") };
  }
  if (which === "change") {
    const spoken = `Neu ist: ${card.development} ${card.recWhy}`;
    return { spoken, display: [`Veränderung heute ${card.changeToday.toFixed(2)} %.`, card.development, card.overnight ?? "", card.recWhy].filter(Boolean).join("\n") };
  }
  if (which === "odds") {
    const top = [...card.scenarios].sort((a, b) => b.p - a.p)[0]!;
    const spoken = `Momentan halte ich ${top.label === "Erholung" ? "eine weitere Erholung" : top.label === "Rückfall" ? "einen Rückfall" : "eine Seitwärtslage"} für etwas wahrscheinlicher. Die Einschätzung ist aber noch nicht stabil. Grundlage sind Schluss, Volumen und der Abstand zum Markt — keine Erfindung.`;
    return {
      spoken,
      display: card.scenarios.map((s) => `${s.label} ${s.p} % · wenn ${s.iff} · ${s.path} · widerlegt: ${s.falsify}`).concat(["Grundlage:", ...card.pBasis]).join("\n"),
    };
  }
  if (which === "bots") {
    const staff = card.bots.filter((b) => b.source !== "overnight");
    const pro = staff.filter((b) => b.stance === "pro");
    const contra = staff.filter((b) => b.stance === "contra");
    const shared = card.sharedSource ? " Mehrere Bots nutzen dieselbe Meldung, das zählt nicht doppelt." : "";
    const reason = contra[0]?.take ? ` ${firstSentence(contra[0].take)}` : "";
    const spoken =
      staff.length === 0
        ? "Kein Bot hat zu diesem Namen eine frische Spezialnotiz."
        : `${countLabel(pro.length, "Ein Bot sieht", "Bots sehen", "Kein Bot sieht")} eine Verbesserung. ${countLabel(contra.length, "Einer bleibt vorsichtig.", "bleiben vorsichtig.", "Niemand bleibt ausdrücklich vorsichtig.")}${contra.length ? reason : ""} Der wichtigste Streitpunkt ist, ob die Bewegung genug Unterstützung hat.${shared}`;
    return { spoken, display: card.bots.map((b) => `${b.name} · ${b.stance} · ${b.source}: ${b.take}`).join("\n") };
  }
  if (which === "why") {
    const change = card.lastRec && card.lastRec !== card.rec ? " Zuvor war die Lage anders." : "";
    return { spoken: `${card.name}. ${card.recWhy}${change}`, display: card.display };
  }
  if (which === "falsify") {
    return {
      spoken: `Die These wäre widerlegt, wenn ${card.falsify[0] ?? "der Halt bricht"}. Das ist die Bedingung, kein Termin für einen Kauf.`,
      display: card.falsify.join("\n"),
    };
  }
  return { spoken: card.nextCheck, display: `${card.nextCheck}\n${card.plan.horizon}` };
}
