import { runVesperCeo } from "@/lib/grok";
import { useDeskStore } from "@/lib/store";
import { compactSnapshot, buildSnapshot } from "./snapshot";
import { CANNED, isSimpleCommand, wantsDetail } from "./speech";
import { extractPlain, looksLikeJson, pointsSpeech, toPoints } from "./plain";
import { parseIntent } from "./parse";
import { useVesperStore } from "./store";
import type { VesperSource } from "./types";
import { unlockAudio } from "./voice";
import { speakCanned, speakStream, warmTts } from "./tts";
import { isContentBriefing } from "./intel";

const SPOKEN_KEY = "vesper-spoken-v1";

export function greetingWasSpoken() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SPOKEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markGreetingSpoken() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SPOKEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

function parseCeoJson(raw: string): { display?: string; say?: string; spoken?: string; sources?: VesperSource[] } | null {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "").trim();
  if (!trimmed) return null;
  const fetchedAt = new Date().toISOString();
  const read = (obj: {
    display?: string;
    say?: string;
    spoken?: string;
    sources?: { title?: string; kind?: string; at?: string; note?: string; tier?: string; symbol?: string }[];
  }) => {
    const display = obj.display || obj.say || obj.spoken;
    if (typeof display !== "string" || display.length === 0) return null;
    if (looksLikeJson(display) && display.trim().startsWith("{")) return null;
    const sources: VesperSource[] | undefined = obj.sources
      ?.filter((s) => s.title)
      .map((s) => ({
        title: String(s.title),
        kind: (["filing", "tape", "bot", "macro", "calc", "earnings", "sentiment", "flows", "brief"].includes(s.kind ?? "")
          ? s.kind
          : "brief") as VesperSource["kind"],
        at: s.at ?? fetchedAt,
        fetchedAt,
        note: s.note ?? "",
        tier: s.tier === "calc" || s.tier === "interpretation" ? s.tier : "fact",
        symbol: s.symbol,
      }));
    return { display, spoken: obj.spoken || display, sources };
  };
  try {
    const parsed = JSON.parse(trimmed) as Parameters<typeof read>[0];
    const ok = read(parsed);
    if (ok) return ok;
  } catch {
    /* truncated */
  }
  const spoken = extractPlain(trimmed);
  if (!spoken || looksLikeJson(spoken)) return null;
  return { display: spoken, spoken };
}

function spokenFor(parsedActions: { type: string; symbol?: string }[], lastSpoken?: string) {
  if (lastSpoken && lastSpoken !== CANNED.ack && isContentBriefing(lastSpoken)) return lastSpoken;
  if (lastSpoken && lastSpoken !== CANNED.ack && lastSpoken.trim().length > 24) return lastSpoken;
  const ticker = parsedActions.find((a) => a.type === "selectTicker" && a.symbol);
  const intel = useVesperStore.getState().intel;
  const card = ticker?.symbol ? intel[ticker.symbol] : null;
  if (card && isContentBriefing(card.spoken)) return card.spoken;
  if (card?.spoken && card.spoken !== CANNED.ack) return card.spoken;
  return lastSpoken && lastSpoken !== CANNED.ack ? lastSpoken : "";
}

export async function sendToVesper(text: string, source: "typed" | "voice") {
  const t = text.trim();
  if (t.length < 1) return;
  void unlockAudio();
  useVesperStore.getState().setPrefs({ muted: false, autoSpeak: true });
  useVesperStore.getState().rebuildIntel();
  const parsed = parseIntent(t, {
    symbol: useVesperStore.getState().focus.symbol,
    topic: useVesperStore.getState().focus.topic,
    stage: useVesperStore.getState().stage,
  });
  const simple = isSimpleCommand(parsed.actions.map((a) => a.type), t);
  const modelAt = performance.now();
  const ticker = parsed.actions.find((a) => a.type === "selectTicker");
  const prevCard = ticker && ticker.type === "selectTicker" ? useVesperStore.getState().intel[ticker.symbol] : undefined;

  await useVesperStore.getState().ask(t, source);

  const aiOn = Boolean(useDeskStore.getState().aiAvailable);
  const shouldGrok = wantsDetail(t) && !simple && !parsed.stop && aiOn;
  if (shouldGrok) {
    useVesperStore.setState({ phase: "analyzing" });
    try {
      const result = await runVesperCeo({
        data: {
          text: t,
          snapshot: compactSnapshot(buildSnapshot()),
          style: "plain",
          length: useVesperStore.getState().memory.prefs.reportLength,
        },
      });
      if (result.ok) {
        const grok = parseCeoJson(result.text);
        if (grok?.display && !looksLikeJson(grok.display)) {
          const row = [...useVesperStore.getState().turns].reverse().find((x) => x.role === "vesper");
          if (row?.role === "vesper") {
            const sources = grok.sources ?? row.sources;
            const points = toPoints(grok.display, 6);
            const spokenPts = toPoints(grok.spoken || grok.display, 5);
            const display = points.length ? points.join("\n") : extractPlain(grok.display);
            const spoken = spokenPts.length ? spokenPts.join(" ") : pointsSpeech(grok.spoken || grok.display);
            if (display && !looksLikeJson(display)) {
              useVesperStore.setState({
                turns: useVesperStore.getState().turns.map((r) =>
                  r.id === row.id ? { ...r, text: display, spoken: spoken || display, sources } : r,
                ),
                sources: sources ?? useVesperStore.getState().sources,
              });
            }
          }
        }
      }
    } catch {
      /* local remains */
    }
  }

  useVesperStore.setState({
    voiceTrace: { ...useVesperStore.getState().voiceTrace, modelMs: Math.round(performance.now() - modelAt) },
  });

  const p = useVesperStore.getState().memory.prefs;
  const last = [...useVesperStore.getState().turns].reverse().find((x) => x.role === "vesper");
  const spoken = spokenFor(parsed.actions, last?.spoken);
  const navOnly = simple && !ticker;

  if (p.autoSpeak && !p.muted && !parsed.stop) {
    if (navOnly && !parsed.opening) void speakCanned("ack");
    else if (spoken && spoken !== CANNED.ack) void speakStream(pointsSpeech(spoken));
    else if (!navOnly && last?.text && last.text !== CANNED.ack) void speakStream(pointsSpeech(last.text));
  }

  if (ticker && ticker.type === "selectTicker") {
    useVesperStore.getState().rebuildIntel();
    const next = useVesperStore.getState().intel[ticker.symbol];
    if (next && prevCard && p.autoSpeak && !p.muted) {
      if (next.stale && prevCard.dataQuality === "frisch") {
        void speakStream("Die vorbereiteten Daten sind älter als das letzte Tape. Ich gleiche sie ab.");
      } else if (next.fingerprint !== prevCard.fingerprint && next.rec !== prevCard.rec) {
        void speakStream(`Es gibt noch eine Ergänzung. ${next.recWhy}`);
      }
    }
  }
}

export async function armVoiceAndGreet() {
  void unlockAudio();
  useVesperStore.getState().setPrefs({ muted: false, autoSpeak: true });
  useVesperStore.setState({ audioReady: true, lastError: null });
  void warmTts();
  useVesperStore.getState().rebuildIntel();
  useVesperStore.getState().greetIfNeeded();
  if (greetingWasSpoken()) return "ready" as const;
  const p = useVesperStore.getState().memory.prefs;
  if (!p.autoSpeak || p.muted) return "ready" as const;
  markGreetingSpoken();
  void speakStream("Hallo.");
  return "greeted" as const;
}
