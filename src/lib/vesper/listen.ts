import { hearVesper } from "@/lib/grok";
import { makeRecognizer, speechInputAvailable, unlockAudio } from "./voice";
import { ensureMic, recordUntilSilence, releaseMic, resetVad, rmsLevel, vadState } from "./mic";
import { parseIntent } from "./parse";
import { abortTts } from "./tts";
import { useVesperStore } from "./store";

let conversation = false;
let loopBusy = false;
let pendingSend: ((text: string, source: "typed" | "voice") => Promise<void>) | null = null;

export function setListenSender(fn: (text: string, source: "typed" | "voice") => Promise<void>) {
  pendingSend = fn;
}

export function requestListenAfterSpeak() {
  conversation = true;
  useVesperStore.setState({ conversation: true });
}

export function consumeListenAfterSpeak() {
  return conversation && useVesperStore.getState().memory.prefs.conversation;
}

function blobToB64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const s = String(reader.result ?? "");
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
    };
    reader.readAsDataURL(blob);
  });
}

export async function endConversation() {
  conversation = false;
  abortTts();
  useVesperStore.setState({ conversation: false, micOn: false, status: "idle", partial: "" });
}

export async function beginListen() {
  await unlockAudio();
  const prefs = useVesperStore.getState().memory.prefs;
  const micAt = performance.now();
  const mic = await ensureMic(prefs.micDeviceId || undefined);
  useVesperStore.setState({
    voiceTrace: { ...useVesperStore.getState().voiceTrace, micMs: Math.round(performance.now() - micAt) },
  });
  if (!mic.ok) {
    useVesperStore.setState({ micOn: false, status: "idle" });
    return;
  }
  conversation = prefs.conversation;
  useVesperStore.setState({
    status: "listening",
    phase: "listening",
    lastError: null,
    micOn: true,
    partial: "",
    conversation,
  });
  if (!loopBusy) void listenLoop();
}

async function transcribe(blob: Blob, webText: string) {
  if (webText.trim().length > 1) return webText.trim();
  if (blob.size < 1200) return "";
  const sttAt = performance.now();
  try {
    const b64 = await blobToB64(blob);
    const result = await hearVesper({ data: { audio: b64, mime: blob.type || "audio/webm" } });
    useVesperStore.setState({
      voiceTrace: { ...useVesperStore.getState().voiceTrace, sttMs: Math.round(performance.now() - sttAt) },
    });
    if (result.ok) return result.text.trim();
  } catch {
    /* retry once */
  }
  try {
    const b64 = await blobToB64(blob);
    const result = await hearVesper({ data: { audio: b64, mime: blob.type || "audio/webm" } });
    if (result.ok) return result.text.trim();
  } catch {
    /* */
  }
  return "";
}

async function listenLoop() {
  if (loopBusy) return;
  loopBusy = true;
  try {
    while (conversation && useVesperStore.getState().micOn) {
      useVesperStore.setState({ status: "listening", micOn: true });
      let webText = "";
      let rec: ReturnType<typeof makeRecognizer> | null = null;
      if (speechInputAvailable()) {
        rec = makeRecognizer({
          onPartial: (t) => useVesperStore.setState({ partial: t }),
          onFinal: (t) => {
            webText = `${webText} ${t}`.trim();
            useVesperStore.setState({ partial: webText });
          },
          onError: () => {
            /* MediaRecorder bleibt die Quelle — Web Speech Fehler nicht als Erlaubnisfehler zeigen */
          },
        });
        rec?.start();
      }
      let captured: { blob: Blob; heard: boolean; peak: number };
      try {
        captured = await recordUntilSilence({ maxMs: 14_000, silenceMs: 1050, minMs: 500 });
      } catch {
        rec?.stop();
        break;
      }
      rec?.stop();
      if (!conversation) break;
      if (!captured.heard && captured.peak < 0.03 && rmsLevel() < 0.02) {
        const idle = vadState();
        if (idle.level < 0.015) {
          useVesperStore.setState({
            lastError: "Ich empfange noch kein Mikrofonsignal. Bitte wählen Sie ein anderes Mikrofon.",
            micCause: "signal",
          });
        }
        continue;
      }
      const text = await transcribe(captured.blob, webText);
      useVesperStore.setState({ partial: text });
      if (!text) {
        useVesperStore.setState({ lastError: "Nichts verstanden. Einfach noch einmal sprechen — nicht erneut den Kern tippen." });
        continue;
      }
      const parsed = parseIntent(text);
      if (parsed.stop) {
        await endConversation();
        if (pendingSend) await pendingSend(text, "voice");
        break;
      }
      if (pendingSend) await pendingSend(text, "voice");
      const prefs = useVesperStore.getState().memory.prefs;
      if (!prefs.conversation) {
        useVesperStore.setState({ micOn: false, status: "idle" });
        break;
      }
      if (prefs.bargeIn) {
        const startWait = Date.now();
        while (useVesperStore.getState().status === "speaking" && Date.now() - startWait < 25_000) {
          await new Promise((r) => setTimeout(r, 80));
          if (rmsLevel() > 0.07) {
            abortTts();
            useVesperStore.setState({ status: "listening" });
            break;
          }
        }
      } else {
        while (useVesperStore.getState().status === "speaking") {
          await new Promise((r) => setTimeout(r, 120));
        }
      }
      await new Promise((r) => setTimeout(r, 280));
      resetVad();
    }
  } finally {
    loopBusy = false;
    if (!conversation) useVesperStore.setState({ micOn: false });
  }
}

export async function endListenAndSend(send: (text: string, source: "typed" | "voice") => Promise<void>) {
  pendingSend = send;
  await endConversation();
}

export async function toggleListen(send: (text: string, source: "typed" | "voice") => Promise<void>) {
  pendingSend = send;
  await unlockAudio();
  if (useVesperStore.getState().micOn || conversation) {
    await endConversation();
    return;
  }
  await beginListen();
}

export function disposeMic() {
  conversation = false;
  releaseMic();
}
