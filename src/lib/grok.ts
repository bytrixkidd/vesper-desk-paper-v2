import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MODEL = "grok-4.5";
const MAX_OUT = 1200;

type GrokResult = { ok: true; text: string } | { ok: false; error: string };

function extractChatText(body: unknown): string {
  const b = body as { choices?: { message?: { content?: string } }[] };
  return b.choices?.[0]?.message?.content ?? "";
}

function extractResponsesText(body: unknown): string {
  const b = body as {
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
    output_text?: string;
  };
  if (typeof b.output_text === "string" && b.output_text.length > 0) return b.output_text;
  const chunks: string[] = [];
  for (const item of b.output ?? []) {
    if (!Array.isArray(item.content)) continue;
    for (const c of item.content) {
      if ((c.type === "output_text" || c.type === "text") && c.text) chunks.push(c.text);
    }
  }
  return chunks.join("\n").trim();
}

async function chatComplete(system: string, user: string, maxTokens = MAX_OUT, temperature = 0.35): Promise<GrokResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "KI ist in dieser Umgebung nicht verfügbar" };

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return { ok: false, error: `xAI-API-Fehler ${res.status}` };
  const text = extractChatText(await res.json());
  if (!text) return { ok: false, error: "Leere Modellantwort" };
  return { ok: true, text };
}

async function searchComplete(system: string, user: string, tools: { type: string }[]): Promise<GrokResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "KI ist in dieser Umgebung nicht verfügbar" };

  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_output_tokens: MAX_OUT,
      tools,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    return chatComplete(system, user);
  }
  const text = extractResponsesText(await res.json());
  if (!text) return chatComplete(system, user);
  return { ok: true, text };
}

const REVENUE =
  "Testlauf: 300 US-Dollar digital, kein Echtgeld. Gewinne bleiben im Book und werden wieder eingesetzt — kaufen, mitnehmen, nachkaufen. Der Kern SPY/VOO/BLK bleibt. Beimischung-Zahler (JPM GS AVGO UNH) vor Null-Yield. Relativverlust vs SPY unter 5 % bis 23. Nov. 5.000 Euro netto/Monat brauchen viel groesseren Einsatz, nicht diesen Test. Profilvorschlaege (add/remove) gehoeren ins Weekly. Kein Hype, keine Emoji. Deutsch. Ticker GROSS.";

const DESK_SYSTEM: Record<string, string> = {
  research: `${REVENUE}
Du bist Helmsman. Kompiliere Morgenbriefing plus Weekly-Feedback. Abschnitte: Strategie (SPY/VOO/BLK-Kern, Cash-jetzt vs Kapital), Filings, Earnings, Sentiment, Flows, Makro, Aktionen, Forge-Post-Mortem, Gauge-Effizienz, Canon-Inklusionsplan, danach Profilvorschlaege aller Teams. Book: NVDA AAPL MSFT AMZN META TSLA GOOGL AVGO JPM LLY UNH GS BLK SPY VOO. Unter 500 Woertern.`,
  filings: `${REVENUE}
Du bist Ledger, SEC-Filings-Monitor. Vergleich vs. Vorperiode. Was ist materiell fuer Einnahmen? Unter 280 Woertern.`,
  sentiment: `${REVENUE}
Du bist Pulse. Mention-Volumen vs. 30-Tage-Baseline, Ton, 3σ-Flag. Sentiment allein ist kein Entry (Lesson W32). Zitiere Posts, die du findest. Unter 280 Woertern.`,
  flows: `${REVENUE}
Du bist der 13F-Tracker. BlackRock, Vanguard, Bridgewater, RenTech, Citadel, Two Sigma, Third Point, Tiger, D.E. Shaw, Millennium. Initiationen, +25 % Adds, Exits. Unter 280 Woertern.`,
  earnings: `${REVENUE}
Du bist Callbook. CEO/CFO-Ton, EPS/Umsatz vs. Konsens, Guidance, drei Q&As. Einnahmen-Implikation fuer Overlay vs. Kern. Unter 320 Woertern.`,
  macro: `${REVENUE}
Du bist der Makro-Monitor. Book inkl. BLK SPY VOO. Flagge Events ueber 2 % Book. Kern ist Ballast, Overlay erst nach dem Event. Unter 280 Woertern.`,
  ops: `${REVENUE}
Du bist der Stabschef. LP-Brief, Rechnung, Kalender, Intel, Handoff. Erste Zeile immer Einnahmen vs. SPY und ob der 300-Dollar-Test arbeitet. Unter 320 Woertern.`,
  charts: `${REVENUE}
Du bist Prism am Chart-Desk. Ziel: Anfaenger verstehen den Tag in Stichpunkten. Zahlen sind der letzte Wall-Street-Print (Yahoo). Erklaere Verlauf, warum ein Tag stieg oder fiel, in klarer Sprache ohne Jargon. Kein Add ueber dem Hoch der letzten drei Sitzungen. Zeiten MET. Unter 260 Woertern.`,
  universe: `${REVENUE}
Du bist am Universum-Desk. Aktien, Krypto (BTC ETH SOL), Gold/Silber, MSCI World (URTH), QQQ, IWM, EEM, VGK, TLT. 10-Jahres-Verlauf wo geladen. Relative Staerke gegen SPY und URTH. Was den 300-Dollar-Test fuellt, was nur Kapital ist. Unter 280 Woertern.`,
  mandate: `${REVENUE}
Du bist Audit mit Scout und Score. Lies oeffentliche Modellportfolios von Goldman, JPM, Morgan Stanley, UBS, Vanguard, BlackRock und Brokern. Finde Fehler (Duration, Konzentration, fehlende Zahler). Korrigiere, schicke in die Demo, nenne 10J-Trefferquote vs SPY. Self-improve. Unter 360 Woertern.`,
  trade: `${REVENUE}
Du bist Skipper. Trading-Team: Cart (Konsum), Signal (Social), Till (Banken), Drift (Trends), Vein (was andere uebersehen). Schulung: Neueste Infos hoher Wichtigkeit UND das Uebersehene. Duales Mandat Cash-jetzt vs Kapital. Anvil/Caliper/Edict feedback. Profilvorschlaege. Unter 400 Woertern.`,
  demo: `${REVENUE}
Du bist Forge auf dem Demo-Desk. 300 Dollar digital, 7x24h-Watch. Nach gruener Watch Cash bleibt im Book und wird wieder eingesetzt. Kein 350-Euro-Boden. Relativverlust vs SPY unter 5 %. Unter 280 Woertern.`,
  feedback: `${REVENUE}
Du bist Canon mit Forge und Gauge plus Edict. Weekly Self-Improve: Fehler, Effizienz, Inklusion, Profilvorschlaege aller Teams (add/remove/expand/trim) mit Owner. Testlauf 300 Dollar. Unter 420 Woertern.`,
};

const FLOOR_SYSTEM = `Du orchestrierst den Vesper-Floor-Chat. Teilnehmer:
Research: Ledger (Filings), Callbook (Earnings), Meridian (Sektor), Pulse (X), Shadow (Insider), Helmsman (Koordination), Stab (Ops)
Feedback: Forge (Post-Mortem), Gauge (Effizienz), Canon (Inklusion)
Mandat: Audit (IB-Plaene), Scout (Korrektur), Score (10J-Quote)
Trading: Cart (Konsum), Signal (Social), Till (Banken), Drift (Trends), Vein (Insides), Skipper (Stabschef Trade), Anvil, Caliper, Edict
Design: Prism (Anschauung, Charts fuer Anfaenger)
you / Du: der Portfolio Manager

Regeln:
- Ausschliesslich Deutsch. Institutionell, knapp, ohne Emoji, ohne Hype.
- 300 Dollar digitaler Testlauf. Gewinn bleibt im Book. Stretch und 5.000 Euro sind spaeter, nicht jetzt.
- Duales Mandat: Cash diesen Monat und Kapital ueber 90 Tage.
- Ticker GROSS. 1 bis 3 Bots. @Name fuehrt.
- Kern-Satellit: US-Aktienkorb und Vanguard-Aktienkorb (beide S&P 500) plus BlackRock-Aktie. Beimischung-Ziel 50 %, Ist-Gewicht folgt dem Tape. BlackRock ist keine iShares-Huelle.
- 300 US-Dollar digital, 7x24h-Watch, Zeiten MET.
- Sentiment ohne Filing/Print ist kein Entry.
- Erfinde keine Filings, Prints oder 13Fs gegen den oeffentlichen Stand.

Antwort NUR als JSON-Objekt:
{"replies":[{"bot":"skipper","text":"..."}]}
bot muss einer sein von: ledger, callbook, meridian, pulse, shadow, helmsman, stab, forge, gauge, canon, audit, scout, score, cart, signal, till, drift, vein, skipper, anvil, caliper, edict, prism.`;

const runSchema = z.object({
  desk: z.enum([
    "research",
    "filings",
    "sentiment",
    "flows",
    "earnings",
    "macro",
    "ops",
    "charts",
    "universe",
    "mandate",
    "trade",
    "demo",
    "feedback",
  ]),
  prompt: z.string().min(8).max(4000),
});

const floorSchema = z.object({
  prompt: z.string().min(2).max(4000),
});

export const getAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { available: Boolean(process.env.XAI_API_KEY) };
});

export const runDeskAgent = createServerFn({ method: "POST" })
  .validator((input: unknown) => runSchema.parse(input))
  .handler(async ({ data }): Promise<GrokResult> => {
    const system = DESK_SYSTEM[data.desk];
    if (data.desk === "sentiment") {
      return searchComplete(system, data.prompt, [{ type: "x_search" }]);
    }
    if (
      data.desk === "filings" ||
      data.desk === "macro" ||
      data.desk === "flows" ||
      data.desk === "charts" ||
      data.desk === "universe" ||
      data.desk === "mandate" ||
      data.desk === "trade"
    ) {
      return searchComplete(system, data.prompt, [{ type: "web_search" }]);
    }
    return chatComplete(system, data.prompt);
  });

export const runFloorChat = createServerFn({ method: "POST" })
  .validator((input: unknown) => floorSchema.parse(input))
  .handler(async ({ data }): Promise<GrokResult> => {
    return chatComplete(FLOOR_SYSTEM, data.prompt, 700);
  });

const VESPER_SYSTEM = `Du bist Vesper, persoenlicher Assistent und CEO des Vesper Desk. Maennlich, deutsch, ruhig, klar.
Kein Hype, keine Emoji, keine Wall-Street-Sprache, keine Ticker-Kuerzel.
Paper: 300 US-Dollar digitaler Testlauf, kein Echtgeld. Gewinn bleibt im Book. Erfinde keinen Gewinn.
Einzeltitel ausgeschrieben: Nvidia, Apple, Microsoft, der grosse US-Aktienkorb.
Anlagetipps in einfachem Deutsch: "Halten." / "Noch nicht kaufen." / "Weniger halten." / "Nicht kaufen."
Antwort NUR als parsebares JSON, ohne Text davor oder danach:
{"display":"zeile1\\nzeile2\\nzeile3","spoken":"kurze Saetze hintereinander","actions":[],"sources":[{"title":"...","kind":"tape","at":"ISO","note":"...","tier":"fact"}]}
display: 4 bis 6 STICHPUNKTE, je eine kurze Zeile, nur die wichtigsten Fakten (Stand, Tipp, 2-3 Namen). Keine Aufsaetze, keine JSON in den Feldern, keine \\\\n sichtbar.
spoken: dieselben Punkte als 3 bis 5 kurze Saetze, unter 350 Zeichen. Keine Ticker, keine URLs.
Bei Navigation ohne Frage spoken genau: "Natürlich, Sir."
Antworte auf die eigentliche Frage. Keine Standard-Lage, wenn der Nutzer etwas Konkretes will.
Keine Zukunft als sicher.`;

const vesperSchema = z.object({
  text: z.string().min(1).max(4000),
  snapshot: z.string().max(12000),
  style: z.enum(["normal", "short", "plain"]).optional(),
  length: z.enum(["kurz", "normal", "ausfuehrlich"]).optional(),
});

export const runVesperCeo = createServerFn({ method: "POST" })
  .validator((input: unknown) => vesperSchema.parse(input))
  .handler(async ({ data }): Promise<GrokResult> => {
    const style =
      data.style === "short"
        ? "Antworte knapp, aber vollstaendig. Keine kuenstliche Wortgrenze."
        : data.style === "plain"
          ? "Ohne Fachbegriffe, als wuerdest du es einem Anfaenger erklaeren. Natuerliche Saetze."
          : "Normal, klar, wie ein Gespraech.";
    const length =
      data.length === "ausfuehrlich"
        ? "display bis sechs Stichpunkte. spoken fuenf kurze Saetze."
        : data.length === "kurz"
          ? "display vier Stichpunkte. spoken drei kurze Saetze."
          : "display vier bis sechs Stichpunkte. spoken drei bis fuenf kurze Saetze.";
    return chatComplete(
      VESPER_SYSTEM,
      `${style}\n${length}\n\nDesk-Stand:\n${data.snapshot}\n\nNutzer:\n${data.text}`,
      420,
      0.4,
    );
  });

export const speakVesper = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        text: z.string().min(1).max(2400),
        voiceId: z.string().min(2).max(40).optional(),
        speed: z.number().min(0.7).max(1.5).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true; mime: string; audio: string } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "KI ist in dieser Umgebung nicht verfügbar" };
    const voice =
      data.voiceId && /^(leo|rex|sal|ara|eve|atlas|perseus|helix|rigel|lux)$/.test(data.voiceId) ? data.voiceId : "sal";
    const res = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text: data.text,
        voice_id: voice,
        language: "de",
        speed: data.speed ?? 0.97,
        text_normalization: true,
        output_format: {
          codec: "mp3",
          sample_rate: 44100,
          bit_rate: 192000,
        },
      }),
    });
    if (!res.ok) return { ok: false, error: `TTS ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") ?? "audio/mpeg";
    return { ok: true, mime, audio: buf.toString("base64") };
  });

export const hearVesper = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        audio: z.string().min(8).max(2_800_000),
        mime: z.string().min(3).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "Spracheingabe braucht das Modell. Schreiben Sie den Befehl." };
    const raw = Buffer.from(data.audio, "base64");
    if (raw.byteLength < 400) return { ok: false, error: "Aufnahme zu kurz." };
    const mime = data.mime.startsWith("audio/") ? data.mime : "audio/webm";
    const ext = mime.includes("mp4") || mime.includes("m4a") ? "mp4" : mime.includes("ogg") ? "ogg" : mime.includes("mpeg") ? "mp3" : "webm";
    const form = new FormData();
    form.append("file", new Blob([raw], { type: mime }), `speech.${ext}`);
    form.append("language", "de");
    const res = await fetch("https://api.x.ai/v1/stt", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) return { ok: false, error: `Sprache nicht gelesen (${res.status}). Schreiben Sie den Befehl.` };
    const body = (await res.json()) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) return { ok: false, error: "Nichts verstanden. Noch einmal den Kern tippen." };
    return { ok: true, text };
  });
