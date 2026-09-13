import { toast } from "sonner";
import { formatEt, INCLUSION_STATUS_LABEL, LESSON_STATUS_LABEL, PROFILE_KIND_LABEL, PROFILE_STATUS_LABEL, PROFILE_TEAM_LABEL } from "@/lib/format";
import { floorName } from "@/lib/floor";
import { useDeskStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentNote, Kicker, Panel, StatusDot } from "@/components/shared";

const INCLUSION_TONE = {
  queued: "warn" as const,
  drafted: "sage" as const,
  applied: "long" as const,
};

export function FeedbackDesk() {
  const allBots = useDeskStore((s) => s.bots);
  const bots = allBots.filter((b) => b.desk === "feedback");
  const weeklies = useDeskStore((s) => s.weeklies);
  const lessons = useDeskStore((s) => s.lessons);
  const reviewing = useDeskStore((s) => s.reviewing);
  const runWeekly = useDeskStore((s) => s.runWeekly);
  const applyLesson = useDeskStore((s) => s.applyLesson);
  const proposals = useDeskStore((s) => s.proposals);
  const decideProposal = useDeskStore((s) => s.decideProposal);
  const lastError = useDeskStore((s) => s.lastError);
  const weekly = weeklies[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Kicker>Feedback-Team · Autopilot-Weekly</Kicker>
          <h1 className="text-3xl text-fg sm:text-4xl">Der Stand kommt von selbst.</h1>
          <p className="max-w-2xl text-sm text-muted">
            Autopilot legt das Weekly nach jedem Paper-Lauf. Forge, Gauge, Canon, Skipper. Du liest — und greifst nur
            ein, wenn ein Profil raus soll.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            void runWeekly().then(() => toast("Canon hat das Modell gefragt."));
          }}
          disabled={reviewing}
        >
          {reviewing ? "Modell…" : "Modell holen"}
        </Button>
      </header>

      {lastError && <p className="text-sm text-short">{lastError}. Lokales Weekly trotzdem gelegt.</p>}

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

      {weekly && (
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Kicker>Weekly an dich</Kicker>
              <h2 className="mt-1 font-display text-2xl text-fg">{weekly.title}</h2>
              <p className="mt-1 text-xs text-muted">{formatEt(weekly.deliveredAt)}</p>
            </div>
            <Badge tone="sage">
              Book {weekly.revenue.bookPct > 0 ? "+" : ""}
              {weekly.revenue.bookPct}% · Markt {weekly.revenue.spyPct > 0 ? "+" : ""}
              {weekly.revenue.spyPct}%
            </Badge>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-fg/90">{weekly.lede}</p>
          <p className="mt-2 text-sm text-muted">{weekly.revenue.note}</p>
          {weekly.dual && (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              <li className="rounded-lg bg-elevated p-3">
                <p className="text-2xs tracking-[0.14em] text-muted uppercase">Cash jetzt</p>
                <p className="mt-1 text-xs leading-relaxed text-fg/85">{weekly.dual.cashNote}</p>
              </li>
              <li className="rounded-lg bg-elevated p-3">
                <p className="text-2xs tracking-[0.14em] text-muted uppercase">Kapital</p>
                <p className="mt-1 text-xs leading-relaxed text-fg/85">{weekly.dual.capitalNote}</p>
              </li>
            </ul>
          )}
          <div className="mt-5 space-y-4">
            {weekly.feedback.map((f) => (
              <div key={f.bot}>
                <p className="text-2xs font-medium tracking-[0.14em] text-muted uppercase">
                  {f.bot} · {f.heading}
                </p>
                {weekly.generated ? (
                  <div className="mt-1">
                    <AgentNote text={f.body} />
                  </div>
                ) : (
                  <p className="mt-1 text-sm leading-relaxed text-fg/85">{f.body}</p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel className="overflow-x-auto p-0">
        <div className="px-4 py-3 sm:px-5">
          <Kicker>Inklusionsplan · nächste Woche</Kicker>
          <p className="mt-1 text-sm text-muted">Was in den Prozess muss, mit Owner und ETA. Nichts ohne beides.</p>
        </div>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-2xs tracking-[0.12em] text-muted uppercase">
            <tr className="border-y border-border">
              <th className="px-4 py-2 font-medium sm:px-5">Schritt</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">ETA</th>
              <th className="px-4 py-2 text-right font-medium sm:px-5">Status</th>
            </tr>
          </thead>
          <tbody>
            {(weekly?.inclusion ?? []).map((i) => (
              <tr key={i.item} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-fg sm:px-5">{i.item}</td>
                <td className="px-3 py-3 text-muted">{i.owner}</td>
                <td className="px-3 py-3 font-mono text-xs text-subtle">{i.eta}</td>
                <td className="px-4 py-3 text-right sm:px-5">
                  <Badge tone={INCLUSION_TONE[i.status]}>{INCLUSION_STATUS_LABEL[i.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel>
        <Kicker>Profilvorschläge · alle Teams</Kicker>
        <p className="mt-1 text-sm text-muted">Aufnehmen oder raus. Diskutiert, Feedback, Weekly. Nichts still.</p>
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
                <Badge
                  tone={p.status === "applied" ? "long" : p.status === "discuss" ? "warn" : "sage"}
                >
                  {PROFILE_STATUS_LABEL[p.status]}
                </Badge>
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

      <Panel>
        <Kicker>Lessons, die das System ändern</Kicker>
        <ul className="mt-3 space-y-3">
          {lessons.map((l) => (
            <li key={l.id} className="flex flex-col gap-2 rounded-lg bg-elevated p-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-2xs text-subtle">
                  {l.week} · {floorName(l.owner)}
                </p>
                <p className="mt-1 text-sm text-fg">{l.mistake}</p>
                <p className="mt-1 text-xs text-muted">{l.fix}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={l.status === "applied" ? "sage" : "warn"}>{LESSON_STATUS_LABEL[l.status]}</Badge>
                {l.status === "open" && (
                  <Button size="sm" variant="ghost" onClick={() => applyLesson(l.id)}>
                    Umsetzen
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
