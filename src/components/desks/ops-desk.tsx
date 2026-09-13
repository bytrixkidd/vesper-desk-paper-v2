import { useState } from "react";
import { toast } from "sonner";
import { OPS_STATUS_LABEL } from "@/lib/format";
import { useDeskStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AgentNote, Kicker, Panel } from "@/components/shared";
import type { OpsKind, OpsTask } from "@/lib/types";

const KINDS: { id: OpsKind; label: string; hint: string }[] = [
  { id: "lp", label: "LP-Brief", hint: "Monatliches Update an die Limited Partner." },
  { id: "invoice", label: "Rechnung", hint: "Vendor-Bill matchen, kontieren, einreihen." },
  { id: "calendar", label: "Kalender", hint: "Die Woche gegen Prints und FOMC legen." },
  { id: "intel", label: "Newsletter-Intel", hint: "Ziehen, was wirklich zählt." },
  { id: "coord", label: "Koordination", hint: "Handoff zwischen den sechs Research-Bots." },
];

const STATUS_TONE = {
  queued: "warn" as const,
  drafted: "sage" as const,
  sent: "long" as const,
};

export function OpsDesk() {
  const ops = useDeskStore((s) => s.ops);
  const runAgent = useDeskStore((s) => s.runAgent);
  const markOps = useDeskStore((s) => s.markOps);
  const addOpsDraft = useDeskStore((s) => s.addOpsDraft);
  const [kind, setKind] = useState<OpsKind>("lp");
  const [brief, setBrief] = useState(
    "Entwirf den August-LP-Brief. Book +1,4 % vs. SPX +0,6 %. Adds: AVGO, LLY-Cluster. Trim: UNH 40 bp. Overnight-Desk deckt jetzt 100 Namen.",
  );
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<string | null>(null);

  async function draft() {
    setBusy(true);
    const text = await runAgent("ops", `Kind: ${kind}. ${brief}`);
    setBusy(false);
    if (!text) {
      toast("Stabschef erreicht das Modell nicht.");
      return;
    }
    setLive(text);
    const task: OpsTask = {
      id: `o-${Date.now()}`,
      kind,
      title: `${KINDS.find((k) => k.id === kind)?.label} — Live-Entwurf`,
      status: "drafted",
      preview: text.slice(0, 280),
    };
    addOpsDraft(task);
    toast("Stabschef hat einen Entwurf abgelegt.");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Kicker>AI-Stabschef</Kicker>
        <h1 className="text-3xl text-fg sm:text-4xl">Den Fonds fahren. Das Book behalten.</h1>
        <p className="max-w-2xl text-sm text-muted">
          Jede Non-Trading-Aufgabe, die den Tag eines Solo-Managers frisst: LP-Updates, Vendor-Rechnungen, Kalender,
          Newsletter-Intel, Koordination zwischen den anderen Bots. Parallel zu den sechs Research-Agenten läuft der
          operative Overhead, während du Portfolio-Entscheidungen triffst.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <Kicker>Verfassen</Kicker>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <Button key={k.id} size="sm" variant={kind === k.id ? "default" : "ghost"} onClick={() => setKind(k.id)}>
                {k.label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{KINDS.find((k) => k.id === kind)?.hint}</p>
          <Textarea className="mt-3" value={brief} onChange={(e) => setBrief(e.target.value)} rows={5} />
          <div className="mt-3">
            <Button onClick={() => void draft()} disabled={busy || brief.trim().length < 8}>
              {busy ? "Entwerfe…" : "Mit Stabschef entwerfen"}
            </Button>
          </div>
          {live && (
            <div className="mt-5 rounded-lg bg-elevated p-3">
              <AgentNote text={live} />
            </div>
          )}
        </Panel>

        <Panel className="lg:col-span-2">
          <Kicker>Warteschlange</Kicker>
          <ul className="mt-3 space-y-3">
            {ops.map((t) => (
              <li key={t.id} className="rounded-lg bg-elevated p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-fg">{t.title}</p>
                  <Badge tone={STATUS_TONE[t.status]}>{OPS_STATUS_LABEL[t.status]}</Badge>
                </div>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted">{t.preview}</p>
                <div className="mt-2 flex gap-2">
                  {t.status !== "sent" && (
                    <Button size="sm" variant="ghost" onClick={() => markOps(t.id, "sent")}>
                      Als gesendet markieren
                    </Button>
                  )}
                  {t.status === "queued" && (
                    <Button size="sm" variant="ghost" onClick={() => markOps(t.id, "drafted")}>
                      Als Entwurf markieren
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
