import { speakVesper } from "@/lib/grok";
import { CANNED, PREVIEW_LINE, packUtterances, rateToSpeed } from "./speech";
import { useVesperStore } from "./store";
import { unlockAudio } from "./voice";

type Clip = { mime: string; audio: string };
const cache = new Map<string, Clip>();
let current: HTMLAudioElement | null = null;
let aborted = false;

function keyOf(voice: string, text: string, speed: number) {
  return `${voice}::${speed.toFixed(2)}::${text}`;
}

function shapeForVoice(text: string) {
  let s = text.replace(/\s+/g, " ").trim();
  if (!s) return s;
  if (!/[.!?…]$/.test(s)) s += ".";
  s = s.replace(/\bSir\.(?=\s)/g, "Sir.[pause]");
  s = s.replace(/\bSir\.$/g, "Sir.");
  return s;
}

async function fetchClipOnce(text: string, voice: string, speed: number): Promise<Clip | null> {
  const k = keyOf(voice, text, speed);
  const hit = cache.get(k);
  if (hit) return hit;
  const result = await speakVesper({ data: { text, voiceId: voice, speed } });
  if (!result.ok) {
    useVesperStore.setState({ lastError: result.error, ttsProvider: null });
    return null;
  }
  const clip = { mime: result.mime, audio: result.audio };
  if (text.length < 220) cache.set(k, clip);
  return clip;
}

async function fetchClip(text: string, voice: string, speed: number): Promise<Clip | null> {
  const shaped = shapeForVoice(text);
  let last: Clip | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      last = await fetchClipOnce(shaped, voice, speed);
      if (last) return last;
    } catch {
      last = null;
    }
    if (i < 2) await new Promise((r) => setTimeout(r, 280 + i * 220));
  }
  return last;
}

function playClip(clip: Clip, volume: number): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(`data:${clip.mime};base64,${clip.audio}`);
    audio.volume = Math.min(1, Math.max(0, volume));
    current = audio;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(watch);
      if (current === audio) current = null;
      resolve();
    };
    const watch = window.setTimeout(done, 14_000);
    audio.onended = done;
    audio.onerror = done;
    void audio.play().catch(done);
  });
}

export function abortTts() {
  aborted = true;
  current?.pause();
  current = null;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* */
  }
}

export async function warmTts() {
  await unlockAudio();
  const voice = useVesperStore.getState().memory.prefs.voiceId || "sal";
  const speed = rateToSpeed(useVesperStore.getState().memory.prefs.speechRate);
  const lines = [CANNED.greet, PREVIEW_LINE];
  await Promise.all(
    lines.map(async (line) => {
      if (cache.has(keyOf(voice, shapeForVoice(line), speed))) return;
      try {
        await fetchClip(line, voice, speed);
      } catch {
        /* */
      }
    }),
  );
}

export async function speakStream(text: string) {
  aborted = false;
  await unlockAudio();
  const prefs = useVesperStore.getState().memory.prefs;
  if (prefs.muted || !prefs.autoSpeak) return;
  const voice = prefs.voiceId || "sal";
  const speed = rateToSpeed(prefs.speechRate);
  const volume = prefs.volume;
  const preparedParts = packUtterances(text);
  const parts = preparedParts.length ? preparedParts : [text];
  useVesperStore.setState({ status: "speaking", phase: "speaking", ttsProvider: "xai", lastError: null });
  const ttsAt = performance.now();
  let played = 0;
  let failed = 0;
  for (let i = 0; i < parts.length; i++) {
    if (aborted) break;
    const sentence = parts[i]!;
    let clip: Clip | null = null;
    try {
      clip = await fetchClip(sentence, voice, speed);
    } catch {
      clip = null;
    }
    if (aborted) break;
    if (i === 0) {
      useVesperStore.setState({
        voiceTrace: {
          ...useVesperStore.getState().voiceTrace,
          ttsMs: Math.round(performance.now() - ttsAt),
          audioMs: Math.round(performance.now() - ttsAt),
        },
      });
    }
    if (clip) {
      useVesperStore.setState({ ttsProvider: "xai" });
      await playClip(clip, volume);
      played += 1;
    } else {
      failed += 1;
    }
  }
  if (!played && failed > 0 && !aborted) {
    useVesperStore.setState({
      ttsProvider: null,
      lastError: "Die natürliche Stimme ist gerade nicht erreichbar. Ich spreche nicht mit der Roboterstimme.",
    });
  }
  if (!aborted) useVesperStore.setState({ status: "idle", phase: "ready" });
}

export async function speakCanned(which: keyof typeof CANNED) {
  return speakStream(CANNED[which]);
}
