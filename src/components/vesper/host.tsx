import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { formatUsd } from "@/lib/format";
import { displayName } from "@/lib/names";
import { usdFromEur } from "@/lib/paper";
import { useDeskStore } from "@/lib/store";
import { beginListen, setListenSender } from "@/lib/vesper/listen";
import { useVesperStore } from "@/lib/vesper/store";
import { sendToVesper } from "@/lib/vesper/talk";
import { makeWake } from "@/lib/vesper/voice";
import { abortTts, speakStream } from "@/lib/vesper/tts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VesperMark } from "@/components/vesper/mark";

export function VesperHost() {
  const navigate = useNavigate();
  const navPath = useVesperStore((s) => s.navPath);
  const prefs = useVesperStore((s) => s.memory.prefs);
  const abortSpeak = useVesperStore((s) => s.abortSpeak);
  const tickDiagnoses = useVesperStore((s) => s.tickDiagnoses);
  const checkAutoOpen = useVesperStore((s) => s.checkAutoOpen);
  const rebuildIntel = useVesperStore((s) => s.rebuildIntel);
  const pending = useVesperStore((s) => s.pending);
  const confirmDraft = useVesperStore((s) => s.confirmDraft);
  const setOpen = useVesperStore((s) => s.setOpen);
  const wakeRef = useRef<ReturnType<typeof makeWake>>(null);

  useEffect(() => {
    setListenSender(sendToVesper);
  }, []);

  useEffect(() => {
    if (!navPath) return;
    setOpen(true);
    void navigate({ to: navPath });
    useVesperStore.setState({ navPath: null });
  }, [navPath, navigate, setOpen]);

  useEffect(() => {
    let lastTape = useDeskStore.getState().tapeAsOf;
    let lastMsg = useDeskStore.getState().messages.length;
    let lastAlert = useDeskStore.getState().alerts[0]?.id ?? "";
    let lastLive = useDeskStore.getState().liveStatus;
    let lastBot = useDeskStore.getState().bots.map((b) => b.summary).join("|").slice(0, 240);
    return useDeskStore.subscribe((s) => {
      const botSig = s.bots.map((b) => b.summary).join("|").slice(0, 240);
      if (
        s.tapeAsOf !== lastTape ||
        s.messages.length !== lastMsg ||
        (s.alerts[0]?.id ?? "") !== lastAlert ||
        s.liveStatus !== lastLive ||
        botSig !== lastBot
      ) {
        lastTape = s.tapeAsOf;
        lastMsg = s.messages.length;
        lastAlert = s.alerts[0]?.id ?? "";
        lastLive = s.liveStatus;
        lastBot = botSig;
        rebuildIntel();
      }
    });
  }, [rebuildIntel]);

  useEffect(() => {
    const id = window.setInterval(() => {
      tickDiagnoses();
      checkAutoOpen();
    }, 20_000);
    checkAutoOpen();
    rebuildIntel();
    return () => window.clearInterval(id);
  }, [tickDiagnoses, checkAutoOpen, rebuildIntel]);

  const pendingNoticeSpeak = useVesperStore((s) => s.pendingNoticeSpeak);
  const status = useVesperStore((s) => s.status);
  const open = useVesperStore((s) => s.open);
  const muted = useVesperStore((s) => s.memory.prefs.muted);

  useEffect(() => {
    if (!pendingNoticeSpeak || muted || status !== "idle") return;
    if (!open && !useVesperStore.getState().insight) return;
    const text = pendingNoticeSpeak;
    useVesperStore.setState({ pendingNoticeSpeak: null, open: true });
    void speakStream(text);
  }, [pendingNoticeSpeak, status, open, muted]);

  useEffect(() => {
    if (abortSpeak) abortTts();
  }, [abortSpeak]);

  useEffect(() => {
    if (!prefs.wakeWord) {
      wakeRef.current?.stop();
      wakeRef.current = null;
      return;
    }
    const rec = makeWake({
      onWake: () => {
        setOpen(true);
        void beginListen();
      },
      onUtterance: (t) => {
        void sendToVesper(t, "voice");
      },
    });
    wakeRef.current = rec;
    rec?.start();
    return () => rec?.stop();
  }, [prefs.wakeWord, setOpen]);

  return (
    <>
      <VesperMark />
      <Dialog open={Boolean(pending)} onOpenChange={(v) => !v && pending && confirmDraft(pending.id, false)}>
        <DialogContent>
          <DialogTitle>Bestätigung</DialogTitle>
          <DialogDescription>
            {pending
              ? `${pending.mode === "live" ? "Live-Entwurf" : "Paper-Plan"}: ${pending.side === "buy" ? "Kauf" : "Verkauf"} ${displayName(pending.symbol)}, ${formatUsd(usdFromEur(pending.amountEur))}.`
              : ""}
          </DialogDescription>
          {pending ? (
            <ul className="mt-3 space-y-1 text-sm text-muted">
              <li>Order: {pending.orderType}</li>
              <li>Wert: {formatUsd(usdFromEur(pending.expectedValue))}</li>
              <li>Gebühren (Annahme): {formatUsd(usdFromEur(pending.fees))}</li>
              <li>Risiko 10 %: {formatUsd(usdFromEur(pending.riskEur))}</li>
              <li>{pending.allocationNote}</li>
              <li>{pending.note}</li>
            </ul>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => pending && confirmDraft(pending.id, false)}>
              Ablehnen
            </Button>
            <Button onClick={() => pending && confirmDraft(pending.id, true)}>Bestätigen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
