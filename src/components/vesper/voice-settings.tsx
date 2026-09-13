import { useEffect, useState } from "react";
import { ensureMic, listMics, rmsLevel } from "@/lib/vesper/mic";
import { PREVIEW_LINE, VOICES } from "@/lib/vesper/speech";
import { useVesperStore } from "@/lib/vesper/store";
import { speakStream } from "@/lib/vesper/tts";
import type { SpeechLength, SpeechRate } from "@/lib/vesper/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MicMeter } from "@/components/vesper/meter";

export function VoiceSettings() {
  const prefs = useVesperStore((s) => s.memory.prefs);
  const setPrefs = useVesperStore((s) => s.setPrefs);
  const trace = useVesperStore((s) => s.voiceTrace);
  const cause = useVesperStore((s) => s.micCause);
  const ttsProvider = useVesperStore((s) => s.ttsProvider);
  const [mics, setMics] = useState<{ id: string; label: string }[]>([]);
  const [testing, setTesting] = useState(false);
  const [testNote, setTestNote] = useState("");

  useEffect(() => {
    void listMics().then(setMics);
  }, [prefs.micDeviceId]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-2xs tracking-[0.12em] text-muted uppercase">Stimme</p>
        <div className="mt-2 flex flex-col gap-1">
          {VOICES.map((v) => (
            <div key={v.id} className="flex min-h-11 items-center gap-2 rounded-md bg-elevated px-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setPrefs({ voiceId: v.id })}
              >
                <span className="block text-sm text-fg">{v.name}</span>
                <span className="block text-2xs text-muted">{v.hint}</span>
              </button>
              {prefs.voiceId === v.id ? <span className="text-2xs text-long">aktiv</span> : null}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPrefs({ voiceId: v.id, muted: false, autoSpeak: true });
                  void speakStream(PREVIEW_LINE);
                }}
              >
                Anhören
              </Button>
            </div>
          ))}
        </div>
        {ttsProvider === "xai" ? (
          <p className="mt-2 text-2xs text-long">Natürliche Stimme aktiv. Keine Roboterstimme.</p>
        ) : ttsProvider === "browser" ? (
          <p className="mt-2 text-2xs text-warn">Notlösung: Browser-Stimme. Die Premiumstimme war gerade nicht erreichbar.</p>
        ) : (
          <p className="mt-2 text-2xs text-muted">Sal ist die normale Stimme. Einmal anhören, dann spricht er so weiter.</p>
        )}
      </div>

      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        Sprechtempo
        <select
          className="h-11 rounded-md bg-elevated px-2 text-sm"
          value={prefs.speechRate}
          onChange={(e) => setPrefs({ speechRate: e.target.value as SpeechRate })}
        >
          <option value="langsam">langsam</option>
          <option value="natuerlich">natürlich</option>
          <option value="zuegig">zügig</option>
        </select>
      </label>

      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        Kürze der Antworten
        <select
          className="h-11 rounded-md bg-elevated px-2 text-sm"
          value={prefs.reportLength}
          onChange={(e) => setPrefs({ reportLength: e.target.value as SpeechLength })}
        >
          <option value="kurz">kurz</option>
          <option value="normal">normal</option>
          <option value="ausfuehrlich">ausführlich</option>
        </select>
      </label>

      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        Automatisch sprechen
        <input type="checkbox" checked={prefs.autoSpeak} onChange={(e) => setPrefs({ autoSpeak: e.target.checked })} />
      </label>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        Gesprächsmodus
        <input type="checkbox" checked={prefs.conversation} onChange={(e) => setPrefs({ conversation: e.target.checked })} />
      </label>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        Aktivierungswort „Vesper“
        <input type="checkbox" checked={prefs.wakeWord} onChange={(e) => setPrefs({ wakeWord: e.target.checked })} />
      </label>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        Unterbrechen durch Sprechen
        <input type="checkbox" checked={prefs.bargeIn} onChange={(e) => setPrefs({ bargeIn: e.target.checked })} />
      </label>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        Untertitel
        <input type="checkbox" checked={prefs.captions} onChange={(e) => setPrefs({ captions: e.target.checked })} />
      </label>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        Lautstärke
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={prefs.volume}
          onChange={(e) => setPrefs({ volume: Number(e.target.value) })}
          className="w-28"
        />
      </label>

      <div>
        <p className="text-2xs tracking-[0.12em] text-muted uppercase">Mikrofon</p>
        <label className="mt-2 flex min-h-11 items-center justify-between gap-3 text-sm">
          Gerät
          <select
            className="h-11 max-w-[14rem] rounded-md bg-elevated px-2 text-sm"
            value={prefs.micDeviceId}
            onChange={(e) => setPrefs({ micDeviceId: e.target.value })}
          >
            <option value="">Standard</option>
            {mics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-2 flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void (async () => {
                setTesting(true);
                const mic = await ensureMic(prefs.micDeviceId || undefined);
                if (!mic.ok) {
                  setTestNote(mic.error);
                  setTesting(false);
                  return;
                }
                await new Promise((r) => setTimeout(r, 700));
                const level = rmsLevel();
                void listMics().then(setMics);
                if (level < 0.02) setTestNote("Kein Pegel. Anderes Mikrofon wählen oder lauter sprechen.");
                else setTestNote("Pegel kommt an. Sie können sprechen.");
                setTesting(false);
              })();
            }}
          >
            Mikrofon testen
          </Button>
          <MicMeter />
        </div>
        <p className={cn("mt-2 text-2xs", cause ? "text-short" : "text-muted")}>
          {testNote || (testing ? "Prüfe Pegel…" : cause ? "Ursache: " + cause : "Einmal erlauben — bleibt in dieser Sitzung an.")}
        </p>
      </div>

      <p className="text-2xs text-subtle">
        Zeiten ms · Mikro {trace.micMs} · Erkennung {trace.sttMs} · Antwort {trace.modelMs} · Stimme {trace.ttsMs} · Ton {trace.audioMs}
      </p>
    </div>
  );
}
