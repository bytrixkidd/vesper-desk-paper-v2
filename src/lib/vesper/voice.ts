import { speakVesper } from "@/lib/grok";
import { speakable } from "./store";

let audioCtx: AudioContext | null = null;
let unlocked = false;

export function isAudioUnlocked() {
  return unlocked;
}

export async function unlockAudio() {
  if (typeof window === "undefined") return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      audioCtx = audioCtx ?? new AC();
      if (audioCtx.state === "suspended") {
        await Promise.race([audioCtx.resume(), new Promise<void>((r) => setTimeout(r, 350))]);
      }
      const buf = audioCtx.createBuffer(1, 1, 22050);
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(audioCtx.destination);
      src.start(0);
    }
  } catch {
    /* ignore */
  }
  unlocked = true;
}

type SpeakHandle = {
  stop: () => void;
  done: Promise<void>;
};

export async function speakText(
  text: string,
  opts: { volume: number; muted: boolean; preferXai: boolean; onEnd: () => void },
): Promise<SpeakHandle | null> {
  if (opts.muted) {
    opts.onEnd();
    return null;
  }
  const clean = speakable(text);
  if (!clean) {
    opts.onEnd();
    return null;
  }
  try {
    const result = await speakVesper({ data: { text: clean, voiceId: "sal", speed: 0.97 } });
    if (result.ok) {
      const audio = new Audio(`data:${result.mime};base64,${result.audio}`);
      audio.volume = Math.min(1, Math.max(0, opts.volume));
      let stopped = false;
      const done = new Promise<void>((resolve) => {
        const finish = () => {
          window.clearTimeout(watch);
          if (!stopped) opts.onEnd();
          stopped = true;
          resolve();
        };
        const watch = window.setTimeout(finish, Math.min(22_000, 1200 + clean.length * 80));
        audio.onended = finish;
        audio.onerror = finish;
      });
      try {
        await audio.play();
      } catch {
        opts.onEnd();
        return null;
      }
      return {
        stop: () => {
          stopped = true;
          audio.pause();
          audio.currentTime = 0;
        },
        done,
      };
    }
  } catch {
    /* no robot fallback */
  }
  opts.onEnd();
  return null;
}

export type Recog = {
  start: () => void;
  stop: () => void;
};

export function speechInputAvailable() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

function recognitionCtor() {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function explainRecogError(code: string) {
  if (code === "not-allowed") return "Mikrofon-Erlaubnis fehlt. Im Browser erlauben, dann noch einmal auf das Mikrofon tippen.";
  if (code === "audio-capture") return "Kein Mikrofon gefunden.";
  if (code === "network") return "Spracherkennung braucht eine Verbindung.";
  if (code === "service-not-allowed") return "Dieses Vorschaufenster sperrt das Mikrofon. Tippen Sie den Befehl, oder öffnen Sie den Desk in einem eigenen Tab.";
  if (code === "no-speech") return "Nichts gehört. Noch einmal auf das Mikrofon tippen und deutlich sprechen.";
  return `Mikrofon: ${code}`;
}

export function makeRecognizer(opts: {
  onPartial: (t: string) => void;
  onFinal: (t: string) => void;
  onError: (e: string) => void;
}): Recog | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "de-DE";
  rec.interimResults = true;
  rec.continuous = true;
  rec.onresult = (ev: SpeechRecognitionEvent) => {
    let interim = "";
    let fin = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const row = ev.results[i]!;
      if (row.isFinal) fin += row[0]?.transcript ?? "";
      else interim += row[0]?.transcript ?? "";
    }
    if (interim) opts.onPartial(interim);
    if (fin) opts.onFinal(fin.trim());
  };
  rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
    if (ev.error === "aborted") return;
    opts.onError(ev.error);
  };
  return {
    start: () => {
      try {
        rec.start();
      } catch {
        /* already started */
      }
    },
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
  };
}

export function makeWake(opts: { onWake: () => void; onUtterance: (t: string) => void }): Recog | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "de-DE";
  rec.interimResults = true;
  rec.continuous = true;
  let armed = false;
  rec.onresult = (ev: SpeechRecognitionEvent) => {
    let text = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) text += ev.results[i]![0]?.transcript ?? "";
    const f = text.toLowerCase();
    if (!armed && f.includes("vesper")) {
      armed = true;
      opts.onWake();
    } else if (armed && ev.results[ev.results.length - 1]?.isFinal) {
      const cleaned = text.replace(/vesper[,.]?/i, "").trim();
      if (cleaned.length > 1) opts.onUtterance(cleaned);
      armed = false;
    }
  };
  return {
    start: () => {
      try {
        rec.start();
      } catch {
        /* ignore */
      }
    },
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
  };
}

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
};
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: { length: number; [i: number]: { isFinal: boolean; 0?: { transcript: string } } };
};
type SpeechRecognitionErrorEvent = { error: string };
