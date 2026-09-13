import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatEt } from "@/lib/format";
import { FILINGS } from "@/lib/seed";
import { useDeskStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AgentNote, Kicker, Panel, TickerMark } from "@/components/shared";
import type { Filing } from "@/lib/types";
import { useVesperFocus } from "@/lib/vesper/use-focus";

const FORMS = ["Alle", "10-K", "10-Q", "8-K", "13F-HR", "13D", "4"] as const;

export function FilingsDesk() {
  const runAgent = useDeskStore((s) => s.runAgent);
  const watchlist = useDeskStore((s) => s.watchlist);
  const [form, setForm] = useState<(typeof FORMS)[number]>("Alle");
  const [active, setActive] = useState<Filing | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useVesperFocus((focus) => {
    if (!focus.filingId) return;
    const hit = FILINGS.find((f) => f.id === focus.filingId);
    if (hit) setActive(hit);
  });

  const rows = useMemo(
    () => (form === "Alle" ? FILINGS : FILINGS.filter((f) => f.form === form)),
    [form],
  );

  async function analyze(f: Filing) {
    setBusy(true);
    setNote(null);
    const text = await runAgent(
      "filings",
      `Analysiere dieses SEC-${f.form} zu ${f.ticker} (${watchlist.find((t) => t.symbol === f.ticker)?.name ?? ""}). Titel: ${f.title}. Accession ${f.accession}. Beobachtete Delta vs. Vorperiode: ${f.delta}. Ist das innerhalb einer Stunde nach Publikation materiell? Was soll ein 12-Namen-Book tun?`,
    );
    setBusy(false);
    if (text) {
      setNote(text);
      toast(`Ledger hat eine Notiz zu ${f.ticker} ${f.form} abgelegt.`);
    } else toast("Ledger erreicht das Modell nicht.");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Kicker>Autonomer SEC-Filings-Monitor</Kicker>
        <h1 className="text-3xl text-fg sm:text-4xl">EDGAR, ohne die API-Steuer.</h1>
        <p className="max-w-2xl text-sm text-muted">
          Ledger überwacht 10-K, 10-Q, 8-K, 13F, 13D und Form 4 über das Book. Materielle Änderungen gegenüber dem
          Vor-Filing kommen innerhalb einer Stunde. Griffin und Tang: 8-Ks bewegen Kurse fünf Sitzungen — Tempo der
          Aufnahme ist der Edge.
        </p>
      </header>

      <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1">
        {FORMS.map((f) => (
          <Button
            key={f}
            size="sm"
            className="shrink-0"
            variant={form === f ? "default" : "ghost"}
            onClick={() => setForm(f)}
          >
            {f}
          </Button>
        ))}
      </div>

      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-2xs tracking-[0.12em] text-muted uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 font-medium sm:px-5">Ticker</th>
              <th className="px-3 py-2.5 font-medium">Form</th>
              <th className="px-3 py-2.5 font-medium">Titel</th>
              <th className="px-3 py-2.5 font-medium">Delta vs. Vorperiode</th>
              <th className="px-4 py-2.5 text-right font-medium sm:px-5">Eingereicht</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} className="border-b border-border last:border-0" data-vesper={`filing-${f.id}`}>
                <td className="px-4 py-3 sm:px-5">
                  <button type="button" className="text-left" onClick={() => setActive(f)}>
                    <TickerMark symbol={f.ticker} />
                  </button>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{f.form}</span>
                    {f.material && <Badge tone="material">Materiell</Badge>}
                  </div>
                </td>
                <td className="max-w-xs px-3 py-3">
                  <button type="button" className="text-left text-fg hover:text-primary" onClick={() => setActive(f)}>
                    {f.title}
                  </button>
                </td>
                <td className="max-w-sm px-3 py-3 text-muted">{f.delta}</td>
                <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-subtle sm:px-5">
                  {formatEt(f.filedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          {active && (
            <>
              <DialogTitle>
                {active.ticker} · {active.form}
              </DialogTitle>
              <DialogDescription className="mt-1">{active.title}</DialogDescription>
              <p className="mt-4 text-sm leading-relaxed text-fg/90">{active.delta}</p>
              <p className="mt-2 font-mono text-2xs text-subtle">Accession {active.accession}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => void analyze(active)}>
                  {busy ? "Ledger liest…" : "Ledger fragen"}
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a
                    href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${active.ticker}&type=${active.form}&dateb=&owner=include&count=10`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    EDGAR öffnen
                  </a>
                </Button>
              </div>
              {note && (
                <div className="mt-4 rounded-lg bg-elevated p-3">
                  <AgentNote text={note} />
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
