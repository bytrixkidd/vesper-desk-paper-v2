import { useVesperStore } from "./store";

export type MicCause = "permission" | "iframe" | "device" | "signal" | "secure" | null;

type MicOk = { ok: true; stream: MediaStream };
type MicErr = { ok: false; error: string; cause: MicCause };

let stream: MediaStream | null = null;
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let pump: number | null = null;
let speechFrames = 0;
let silenceFrames = 0;
let heard = false;

function framed() {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    return true;
  }
}

function explain(cause: MicCause, detail: string) {
  if (cause === "iframe")
    return "Der Browser erlaubt das Mikrofon, aber dieses Vorschaufenster gibt es nicht an die App weiter. Schreiben Sie, oder öffnen Sie den Desk in einem eigenen Tab.";
  if (cause === "permission") return "Mikrofon-Erlaubnis fehlt. Im Browser erlauben, dann den Kern tippen.";
  if (cause === "device") return "Kein Mikrofon gefunden. Bitte ein Gerät wählen.";
  if (cause === "signal") return "Ich empfange noch kein Mikrofonsignal. Bitte wählen Sie ein anderes Mikrofon.";
  if (cause === "secure") return "Mikrofon braucht eine sichere Verbindung.";
  return detail;
}

export async function listMics(): Promise<{ id: string; label: string }[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === "audioinput")
    .map((d, i) => ({ id: d.deviceId, label: d.label || `Mikrofon ${i + 1}` }));
}

export function currentStream() {
  return stream;
}

export function rmsLevel() {
  if (!analyser) return 0;
  const buf = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) {
    const x = (v - 128) / 128;
    sum += x * x;
  }
  return Math.sqrt(sum / buf.length);
}

function attachAnalyser(s: MediaStream) {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = ctx ?? new AC();
  void ctx.resume();
  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch {
      /* */
    }
  }
  sourceNode = ctx.createMediaStreamSource(s);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.35;
  sourceNode.connect(analyser);
}

export function startLevelPump() {
  stopLevelPump();
  const tick = () => {
    const level = rmsLevel();
    useVesperStore.setState({ micLevel: level });
    if (level > 0.045) {
      speechFrames += 1;
      silenceFrames = 0;
      if (speechFrames > 2) heard = true;
    } else {
      speechFrames = 0;
      silenceFrames += 1;
    }
    pump = window.setTimeout(tick, 80);
  };
  tick();
}

export function stopLevelPump() {
  if (pump) window.clearTimeout(pump);
  pump = null;
}

export function resetVad() {
  speechFrames = 0;
  silenceFrames = 0;
  heard = false;
}

export function vadState() {
  return { heard, silenceMs: silenceFrames * 80, speaking: speechFrames > 0, level: rmsLevel() };
}

export async function ensureMic(deviceId?: string): Promise<MicOk | MicErr> {
  if (stream && stream.getAudioTracks().some((t) => t.readyState === "live")) {
    attachAnalyser(stream);
    startLevelPump();
    useVesperStore.setState({ micCause: null, lastError: null });
    return { ok: true, stream };
  }
  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    const error = explain("secure", "");
    useVesperStore.setState({ micCause: "secure", lastError: error });
    return { ok: false, error, cause: "secure" };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    const cause: MicCause = framed() ? "iframe" : "device";
    const error = explain(cause, "Kein Mikrofonzugang.");
    useVesperStore.setState({ micCause: cause, lastError: error });
    return { ok: false, error, cause };
  }
  try {
    const audio: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    };
    if (deviceId) audio.deviceId = { exact: deviceId };
    stream = await navigator.mediaDevices.getUserMedia({ audio });
    attachAnalyser(stream);
    startLevelPump();
    resetVad();
    useVesperStore.setState({ micCause: null, lastError: null, conversation: true });
    return { ok: true, stream };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    let cause: MicCause = "permission";
    if (name === "NotFoundError" || name === "OverconstrainedError") cause = "device";
    else if (name === "NotAllowedError" || name === "PermissionDeniedError") cause = framed() ? "iframe" : "permission";
    else if (framed()) cause = "iframe";
    const error = explain(cause, String(err));
    useVesperStore.setState({ micCause: cause, lastError: error, micOn: false, status: "idle" });
    return { ok: false, error, cause };
  }
}

export function releaseMic() {
  stopLevelPump();
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  try {
    sourceNode?.disconnect();
  } catch {
    /* */
  }
  sourceNode = null;
  analyser = null;
}

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export function recordUntilSilence(opts?: { maxMs?: number; silenceMs?: number; minMs?: number }): Promise<{ blob: Blob; heard: boolean; peak: number }> {
  return new Promise((resolve, reject) => {
    if (!stream) {
      reject(new Error("no-stream"));
      return;
    }
    const mime = pickMime();
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.addEventListener("dataavailable", (e) => {
      if (e.data.size) chunks.push(e.data);
    });
    resetVad();
    let peak = 0;
    const maxMs = opts?.maxMs ?? 12_000;
    const silenceMs = opts?.silenceMs ?? 1100;
    const minMs = opts?.minMs ?? 600;
    const started = Date.now();
    rec.start(120);
    const id = window.setInterval(() => {
      const v = vadState();
      peak = Math.max(peak, v.level);
      const elapsed = Date.now() - started;
      const enough = elapsed >= minMs && v.heard && v.silenceMs >= silenceMs;
      const noSignal = elapsed >= 5000 && !v.heard && peak < 0.015;
      const timeout = elapsed >= maxMs;
      if (enough || timeout || noSignal) {
        window.clearInterval(id);
        rec.addEventListener(
          "stop",
          () => {
            resolve({
              blob: new Blob(chunks, { type: rec.mimeType || "audio/webm" }),
              heard: v.heard || peak > 0.04,
              peak,
            });
          },
          { once: true },
        );
        if (rec.state !== "inactive") rec.stop();
      }
    }, 80);
  });
}

export async function waitForBarge(threshold = 0.06, holdMs = 280) {
  const start = Date.now();
  return new Promise<boolean>((resolve) => {
    const id = window.setInterval(() => {
      if (rmsLevel() > threshold && Date.now() - start > holdMs) {
        window.clearInterval(id);
        resolve(true);
      }
    }, 60);
    window.setTimeout(() => {
      window.clearInterval(id);
      resolve(false);
    }, 30_000);
  });
}
