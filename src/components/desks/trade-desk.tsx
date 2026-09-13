import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatEt, formatEur, formatPct, INSIGHT_KIND_LABEL, PROFILE_KIND_LABEL, PROFILE_STATUS_LABEL, PROFILE_TEAM_LABEL, SIDE_LABEL } from "@/lib/format";
import {
  abortDecision,
  LIVE_NOTIONAL_EUR,
  MONTHLY_HORIZON_EUR,
  MONTHLY_NET_EUR,
  MONTHLY_STRETCH_EUR,
  monthTotals,
  monthlyGrossRate,
  projectMonthEnd,
} from "@/lib/paper";
import { useDeskStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentNote, Kicker, Panel, Pct, StatusDot, TickerMark } from "@/components/shared";
import { PulseTape } from "@/components/desks/pulse-tape";

const PP_TONE = {
  discuss: "warn" as const,
  queued: "sage" as const,
  applied: "long" as const,
  rejected: "warn" as const,
};

export function TradeDesk() {
  const allBots = useDeskStore((s) => s.bots);
  const experts = allBots.filter((b) => ["cart", "signal", "till", "drift", "vein", "skipper"].includes(b.id));
  const feedback = allBots.filter((b) => ["anvil", "caliper", "edict"].includes(b.id));
  const ideas = useDeskStore((s) => s.ideas);
  const insights = useDeskStore((s) => s.insights);
  const trials = useDeskStore((s) => s.trials);
  const proposals = useDeskStore((s) => s.proposals);
  const harvests = useDeskStore((s) => s.harvests);
  const demos = useDeskStore((s) => s.demos);
  const liveStatus = useDeskStore((s) => s.liveStatus);
  const liveNotional = useDeskStore((s) => s.liveNotional);
  const abortLive = useDeskStore((s) => s.abortLive);
  const resumeLive = useDeskStore((s) => s.resumeLive);
  const trainTeam = useDeskStore((s) => s.trainTeam);
  const training = useDeskStore((s) => s.training);
  const decideProposal = useDeskStore((s) => s.decideProposal);
  const runAgent = useDeskStore((s) => s.runAgent);
  const lastError = useDeskStore((s) => s.lastError);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [insightFilter, setInsightFilter] = useState<"all" | "fresh" | "overlooked">("all");

  const payout = monthTotals(harvests);
  const runRate = monthlyGrossRate(demos);
  const projected = projectMonthEnd(payout.harvestedNet, runRate, liveNotional);
  const decision = abortDecision({ harvestedNet: payout.harvestedNet, projectedNet: projected, liveStatus });
  const skipper = experts.find((b) => b.id === "skipper");

  const shownInsights = useMemo(
    () => insights.filter((i) => insightFilter === "all" || i.kind === insightFilter),
    [insights, insightFilter],
  );

  async function briefSkipper() {
    setBusy(true);
    const text = await runAgent(
      "trade",
      `Skipper-Lage. Boden ${MONTHLY_NET_EUR} EUR, Ist ${payout.harvestedNet.toFixed(0)}, Projektion ${projected.toFixed(0)}, Status ${decision.status}. Stretch ${MONTHLY_STRETCH_EUR}, Horizont ${MONTHLY_HORIZON_EUR}. Offene Ideen: ${ideas
        .filter((i) => i.status === "open")
        .map((i) => `${i.ticker} ${i.side}`)
        .join(", ")}. Duales Mandat Cash-jetzt vs Kapital. Schulung und Insides.`,
    );
    setBusy(false);
    if (text) {
      setNote(text);
      toast("Skipper hat koordiniert.");
    } else toast("Modell nicht erreichbar.");
  }

  return (
    <div className="space-y-6" data-vesper="trade.position">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Kicker>Trading-Floor · Autopilot</Kicker>
          <h1 className="text-3xl text-fg sm:text-4xl">Die Experten testen. Skipper hält den Boden.</h1>
          <p className="max-w-2xl text-sm text-muted">
            Autopilot schult, legt Paper-Ideen und schickt IB-Korrekturen in die Demo. Kein echtes Geld. Modell bleibt
            optional.{skipper ? ` ${skipper.name} koordiniert.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            disabled={training}
            onClick={() => {
              void trainTeam("trade").then(() => toast("Trading-Team hat das Modell gefragt."));
            }}
          >
            {training ? "Modell…" : "Modell holen"}
          </Button>
          <Button variant="ghost" onClick={() => void briefSkipper()} disabled={busy}>
            {busy ? "Koordiniert…" : "Skipper fragen"}
          </Button>
        </div>
      </header>

      {lastError && <p className="text-sm text-short">{lastError}</p>}

      <PulseTape />

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Kicker>Boden · Abbruch</Kicker>
            <p className="mt-1 font-display text-2xl text-fg">
              {formatEur(payout.harvestedNet, 0)} / {formatEur(MONTHLY_NET_EUR, 0)}
            </p>
            <p className="mt-1 text-xs text-muted">{decision.reason}</p>
          </div>
          <Badge tone={decision.status === "abort" ? "warn" : payout.hit ? "long" : "sage"}>
            {decision.status === "abort" ? "Abbruch" : "Live"}
          </Badge>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            { k: "Projektion", v: formatEur(projected, 0) },
            { k: "Stretch", v: formatEur(MONTHLY_STRETCH_EUR, 0) },
            { k: "Horizont", v: formatEur(MONTHLY_HORIZON_EUR, 0) },
            { k: "Soll-Book", v: formatEur(LIVE_NOTIONAL_EUR, 0) },
          ].map((s) => (
            <li key={s.k}>
              <p className="text-2xs tracking-[0.12em] text-muted uppercase">{s.k}</p>
              <p className="mt-1 font-mono text-sm text-fg">{s.v}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {liveStatus === "live" ? (
            <Button variant="ghost" onClick={() => abortLive()}>
              Live abbrechen
            </Button>
          ) : (
            <Button onClick={() => resumeLive()}>Live fortsetzen</Button>
          )}
        </div>
      </Panel>

      <div>
        <Kicker>Experten</Kicker>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {experts.map((b) => (
            <Panel key={b.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusDot status={b.status} />
                  <h2 className="font-display text-xl text-fg">{b.name}</h2>
                </div>
                <Badge>{b.vertical}</Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{b.summary}</p>
            </Panel>
          ))}
        </div>
      </div>

      <div>
        <Kicker>Feedback · Anvil / Caliper / Edict</Kicker>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {feedback.map((b) => (
            <Panel key={b.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusDot status={b.status} />
                  <h2 className="font-display text-lg text-fg">{b.name}</h2>
                </div>
                <Badge>{b.vertical}</Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{b.summary}</p>
            </Panel>
          ))}
        </div>
      </div>

      <Panel>
        <Kicker>Ideen · Cash jetzt vs Kapital</Kicker>
        <ul className="mt-3 divide-y divide-border">
          {ideas.map((idea) => (
            <li key={idea.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-fg">
                  <TickerMark symbol={idea.ticker} /> · {SIDE_LABEL[idea.side]} · {idea.bot}
                </p>
                <Badge tone={idea.status === "killed" ? "warn" : idea.status === "in-demo" ? "sage" : "long"}>
                  {idea.status === "killed" ? "Gekillt" : idea.status === "in-demo" ? "In der Demo" : "Offen"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">{idea.thesis}</p>
              <p className="mt-1 text-xs text-fg/80">Jetzt: {idea.cashNow}</p>
              <p className="mt-0.5 text-xs text-subtle">Kapital: {idea.capital}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Kicker>Schulung · Latest und Übersehenes</Kicker>
            <p className="mt-1 text-sm text-muted">Was alle übersehen, kann der Trade sein.</p>
          </div>
          <div className="flex gap-1">
            {(["all", "fresh", "overlooked"] as const).map((k) => (
              <Button key={k} size="sm" variant={insightFilter === k ? "default" : "ghost"} onClick={() => setInsightFilter(k)}>
                {k === "all" ? "Alle" : INSIGHT_KIND_LABEL[k]}
              </Button>
            ))}
          </div>
        </div>
        <ul className="mt-4 space-y-3">
          {shownInsights.map((ins) => (
            <li key={ins.id} className="rounded-lg bg-elevated p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-fg">{ins.heading}</p>
                <Badge tone={ins.kind === "overlooked" ? "warn" : "sage"}>
                  {INSIGHT_KIND_LABEL[ins.kind]} · {ins.bot}
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{ins.body}</p>
              <p className="mt-2 font-mono text-2xs text-subtle">
                {ins.tickers.join(" · ")} · {formatEt(ins.at)}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <Kicker>Eigene Demo</Kicker>
        <ul className="mt-3 divide-y divide-border">
          {trials.map((t) => (
            <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm text-fg">
                  {t.week} · {t.label}
                </p>
                <p className="mt-1 text-xs text-muted">{t.note}</p>
              </div>
              <span className="font-mono text-xs tabular-nums">
                <Pct value={t.relativePct} /> gegen den Markt
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <Kicker>Profilvorschläge · alle Teams</Kicker>
        <p className="mt-1 text-sm text-muted">Aufnehmen oder raus. Diskutiert, ins Weekly, nicht still.</p>
        <ul className="mt-4 space-y-3">
          {proposals.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 rounded-lg bg-elevated p-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-2xs text-subtle">
                  {PROFILE_TEAM_LABEL[p.team]} · {PROFILE_KIND_LABEL[p.kind]} · {p.owner}
                </p>
                <p className="mt-1 text-sm text-fg">{p.profile}</p>
                <p className="mt-1 text-xs text-muted">{p.rationale}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge tone={PP_TONE[p.status]}>{PROFILE_STATUS_LABEL[p.status]}</Badge>
                {p.status === "discuss" && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => decideProposal(p.id, "queued")}>
                      Queuen
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => decideProposal(p.id, "rejected")}>
                      Verwerfen
                    </Button>
                  </>
                )}
                {p.status === "queued" && (
                  <Button size="sm" variant="ghost" onClick={() => decideProposal(p.id, "applied")}>
                    Umsetzen
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {note && (
        <Panel>
          <Kicker>Skipper-Notiz</Kicker>
          <div className="mt-2">
            <AgentNote text={note} />
          </div>
        </Panel>
      )}
    </div>
  );
}
