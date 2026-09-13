import { useState } from "react";
import { toast } from "sonner";
import { formatEt, formatPct, MANDATE_STATUS_LABEL } from "@/lib/format";
import { useDeskStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentNote, Kicker, Panel, StatusDot, TickerMark } from "@/components/shared";

const STATUS_TONE = {
  review: "warn" as const,
  sent: "sage" as const,
  scored: "sage" as const,
  applied: "long" as const,
};

export function MandateDesk() {
  const allBots = useDeskStore((s) => s.bots);
  const bots = allBots.filter((b) => b.desk === "mandate");
  const mandates = useDeskStore((s) => s.mandates);
  const trials = useDeskStore((s) => s.trials);
  const sendMandateToDemo = useDeskStore((s) => s.sendMandateToDemo);
  const trainTeam = useDeskStore((s) => s.trainTeam);
  const training = useDeskStore((s) => s.training);
  const runAgent = useDeskStore((s) => s.runAgent);
  const lastError = useDeskStore((s) => s.lastError);
  const [openId, setOpenId] = useState(mandates[0]?.id ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const plan = mandates.find((m) => m.id === openId) ?? mandates[0];

  async function auditPlan() {
    if (!plan) return;
    setBusy(true);
    const text = await runAgent(
      "mandate",
      `Pruefe den Plan ${plan.house} „${plan.title}“ (${plan.published}). Universum ${plan.universe.join(", ")}. These: ${plan.thesis}. Bekannte Fehler: ${plan.flaws.join(" / ")}. Korrektur: ${plan.fix}. 10J Hit ${plan.hitRate10y}%, CAGR ${plan.cagr10y}% vs SPY ${plan.spyCagr10y}%, DD ${plan.maxDd}%. Verbessert ${plan.improvedHit}% / ${plan.improvedCagr}%. Was fehlt, was in die Demo, was den 300-Dollar-Test fuellt?`,
    );
    setBusy(false);
    if (text) {
      setNote(text);
      toast("Audit hat den Plan gelesen.");
    } else toast("Modell nicht erreichbar.");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Kicker>Mandat · Autopilot</Kicker>
          <h1 className="text-3xl text-fg sm:text-4xl">Pläne laufen durch. Fehler in die Demo.</h1>
          <p className="max-w-2xl text-sm text-muted">
            Autopilot liest die Häuser, korrigiert, schickt in die Trading-Demo. Du musst nicht auf Start drücken.
            Modell bleibt optional.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            disabled={training}
            onClick={() => {
              void trainTeam("mandate").then(() => toast("Mandat-Team hat das Modell gefragt."));
            }}
          >
            {training ? "Modell…" : "Modell holen"}
          </Button>
          <Button variant="ghost" onClick={() => void auditPlan()} disabled={busy || !plan}>
            {busy ? "Liest…" : "Plan prüfen"}
          </Button>
        </div>
      </header>

      {lastError && <p className="text-sm text-short">{lastError}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        {bots.map((b) => (
          <Panel key={b.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusDot status={b.status} />
                <h2 className="font-display text-xl text-fg">{b.name}</h2>
              </div>
              <Badge>{b.vertical}</Badge>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{b.summary}</p>
            <p className="mt-3 font-mono text-2xs tabular-nums text-subtle">Zuletzt {formatEt(b.lastRun)}</p>
          </Panel>
        ))}
      </div>

      <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1">
        {mandates.map((m) => (
          <Button
            key={m.id}
            size="sm"
            className="shrink-0"
            variant={openId === m.id ? "default" : "ghost"}
            onClick={() => {
              setOpenId(m.id);
              setNote(null);
            }}
          >
            {m.house.split(" ")[0]}
          </Button>
        ))}
      </div>

      {plan && (
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Kicker>
                {plan.house} · {plan.published}
              </Kicker>
              <h2 className="mt-1 font-display text-2xl text-fg">{plan.title}</h2>
            </div>
            <Badge tone={STATUS_TONE[plan.status]}>{MANDATE_STATUS_LABEL[plan.status]}</Badge>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-fg/90">{plan.thesis}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {plan.universe.map((t) => (
              <TickerMark key={t} symbol={t} className="rounded-sm bg-elevated px-1.5 py-0.5" />
            ))}
          </div>

          <ul className="mt-5 grid gap-3 sm:grid-cols-4">
            {[
              { k: "10-Jahres-Treffer", v: `${plan.hitRate10y} %` },
              { k: "Jahreswachstum", v: formatPct(plan.cagr10y, 1) },
              { k: "Markt 10 Jahre", v: formatPct(plan.spyCagr10y, 1) },
              { k: "größter Rückschlag", v: formatPct(plan.maxDd, 1) },
            ].map((s) => (
              <li key={s.k} className="rounded-lg bg-elevated p-3">
                <p className="text-2xs tracking-[0.12em] text-muted uppercase">{s.k}</p>
                <p className="mt-1 font-mono text-sm text-fg">{s.v}</p>
              </li>
            ))}
          </ul>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <Kicker>Fehler</Kicker>
              <ul className="mt-2 space-y-2">
                {plan.flaws.map((f) => (
                  <li key={f} className="text-sm leading-relaxed text-muted">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Kicker>Korrektur · Scout</Kicker>
              <p className="mt-2 text-sm leading-relaxed text-fg/85">{plan.fix}</p>
              <p className="mt-3 text-sm text-muted">
                Verbessert: Treffer {plan.improvedHit} % · Wachstum {formatPct(plan.improvedCagr, 1)} gegen den Markt{" "}
                {formatPct(plan.spyCagr10y, 1)}.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                sendMandateToDemo(plan.id);
                toast(`${plan.house} in die Trading-Demo.`);
              }}
              disabled={plan.status === "sent" || plan.status === "applied"}
            >
              {plan.status === "applied" ? "Umgesetzt" : plan.status === "sent" ? "In der Demo" : "In die Demo"}
            </Button>
          </div>

          {note && (
            <div className="mt-5 border-t border-border pt-4">
              <Kicker>Audit-Notiz</Kicker>
              <div className="mt-2">
                <AgentNote text={note} />
              </div>
            </div>
          )}
        </Panel>
      )}

      <Panel>
        <Kicker>Trading-Demo · Korrekturen</Kicker>
        <ul className="mt-3 divide-y divide-border">
          {trials
            .filter((t) => t.source === "mandate")
            .map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm text-fg">
                    {t.week} · {t.label}
                  </p>
                  <p className="mt-1 text-xs text-muted">{t.note}</p>
                </div>
                <Badge tone={t.hit ? "long" : "warn"}>
                  Book {formatPct(t.bookPct, 1)} · Markt {formatPct(t.spyPct, 1)}
                </Badge>
              </li>
            ))}
        </ul>
      </Panel>
    </div>
  );
}
