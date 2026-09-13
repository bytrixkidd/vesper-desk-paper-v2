import { useState } from "react";
import { DIAG_MATRIX } from "@/lib/vesper/diagnose";
import { spokenName } from "@/lib/vesper/plain";
import { useVesperStore } from "@/lib/vesper/store";
import type { CheckStatus, Diagnosis, DiagnosisCheck, DiagnosisDay, ThesisState } from "@/lib/vesper/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS: Record<CheckStatus, string> = {
  pass: "hält",
  fail: "fällt",
  watch: "offen",
  na: "keine Daten",
};

const STATE: Record<ThesisState, string> = {
  hält: "hält",
  wankt: "wankt",
  bricht: "bricht",
};

function tone(status: CheckStatus) {
  if (status === "pass") return "text-long";
  if (status === "fail") return "text-short";
  if (status === "watch") return "text-warn";
  return "text-subtle";
}

function RecLabel({ rec }: { rec: NonNullable<Diagnosis["result"]>["rec"] }) {
  const map = {
    beobachten: "Beobachten",
    verwerfen: "Verwerfen",
    paper: "Paper vorbereiten",
    entscheiden: "Entscheidung anfordern",
  };
  return <>{map[rec]}</>;
}

function markDay(dx: Diagnosis, day: DiagnosisDay) {
  const focus = useVesperStore.getState().focus;
  useVesperStore.setState({
    navPath: "/charts",
    focus: {
      ...focus,
      nonce: focus.nonce + 1,
      desk: "charts",
      symbol: dx.symbol,
      iso: day.date,
      markLabel: `Prüfung ${spokenName(dx.symbol, dx.name)} · Tag ${day.day}`,
    },
  });
}

export function DiagPanel() {
  const diagnoses = useVesperStore((s) => s.diagnoses);
  const ask = useVesperStore((s) => s.ask);
  if (diagnoses.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Jede Prüfung schaut auf Schlusskurs, Handelsvolumen, große Käufe, Meldungen und das Monatsziel. Nicht auf einen Timer.
        </p>
        <Button size="sm" variant="secondary" onClick={() => void ask("Beobachte NVIDIA fünf Handelstage", "typed")}>
          NVIDIA, fünf Tage
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {diagnoses
        .filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i)
        .slice(0, 4)
        .map((d) => (
          <DiagnosisCard key={d.id} dx={d} />
        ))}
    </div>
  );
}

function DiagnosisCard({ dx }: { dx: Diagnosis }) {
  const ask = useVesperStore((s) => s.ask);
  const pct = dx.days ? Math.min(100, Math.round((dx.day / dx.days) * 100)) : 0;
  const last = dx.log.at(-1);
  const [openDay, setOpenDay] = useState<string | null>(last?.date ?? null);
  const [allChecks, setAllChecks] = useState(false);
  const open = dx.log.find((d) => d.date === openDay) ?? last;
  const openChecks = open ? (allChecks ? open.checks : open.checks.filter((c) => c.status === "fail" || c.status === "watch")) : [];

  return (
    <article className="rounded-md bg-bg px-3 py-3" data-vesper={`diag-${dx.id}`} data-vesper-day="diag.currentDay">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-fg">
            {spokenName(dx.symbol, dx.name)}
            <span className="ml-2 text-2xs tracking-[0.12em] text-muted uppercase">
              Tag {dx.day} von {dx.days}
            </span>
          </p>
          <p className="text-2xs text-subtle">
            {dx.startDate} – {dx.endDate} · {dx.sleeve === "core" ? "Grundstock" : dx.sleeve === "toll" ? "Maut" : "Beimischung"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={dx.status === "done" ? (dx.result?.verdict === "widerlegt" ? "short" : dx.result?.verdict === "bestätigt" ? "long" : "sage") : dx.status === "killed" ? "warn" : "default"}>
            {dx.status === "done" ? dx.result?.verdict ?? "fertig" : dx.status === "killed" ? "abgebrochen" : "läuft"}
          </Badge>
          <span
            className={cn(
              "text-2xs tracking-[0.1em] uppercase",
              dx.thesisState === "hält" ? "text-long" : dx.thesisState === "bricht" ? "text-short" : "text-warn",
            )}
          >
            These {STATE[dx.thesisState]}
          </span>
        </div>
      </div>

      <div className="mt-2 h-1 rounded-full bg-elevated">
        <div className="h-1 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>

      <p className="mt-3 text-xs text-fg">{dx.workingThesis}</p>
      <p className="mt-1 text-2xs text-subtle">Gegenthese: {dx.antithesis}</p>

      {dx.result ? (
        <div className="mt-3 space-y-1.5 border-t border-border pt-2 text-xs text-fg">
          <p>
            Abschluss: These {dx.result.verdict}. Muster {dx.result.pattern}. <RecLabel rec={dx.result.rec} />.
          </p>
          <p className="text-2xs text-muted">{dx.result.mandate}</p>
          <p className="text-muted">{dx.result.entry}</p>
          <p className="text-muted">{dx.result.exit}</p>
          <p className="text-muted">{dx.result.rr}</p>
          {dx.result.upcoming.length ? <p className="text-2xs text-warn">Steht bevor: {dx.result.upcoming.join(" ")}</p> : null}
          {dx.result.lessons.length ? <p className="text-2xs text-subtle">Lessons: {dx.result.lessons.join(" ")}</p> : null}
          <p className="text-2xs text-subtle">
            Vertrauen {dx.result.confidence.label}: {dx.result.confidence.why}
          </p>
          <p className="text-2xs text-subtle">Risiken: {dx.result.risks.join(" ")}</p>
          <p className="text-2xs text-subtle">Untersuchung, keine Prognose. Kein Orderbuch, 13F nicht tagesgenau.</p>
        </div>
      ) : null}

      {dx.baseline ? (
        <p className="mt-2 font-mono text-2xs text-muted">
          Startmarke {dx.holdLevel?.toFixed(2) ?? dx.baseline.low5.toFixed(2)} (eingefroren) · ATR {dx.baseline.atr.toFixed(2)}
          {dx.support != null && dx.resist != null ? ` · Fenster ${dx.support.toFixed(2)}–${dx.resist.toFixed(2)}` : ""}
        </p>
      ) : null}

      <p className="mt-2 text-2xs text-muted">
        Score Bestätigung {dx.score.confirm.toFixed(1)} · Gegen {dx.score.reject.toFixed(1)}
        {dx.pattern ? ` · Muster ${dx.pattern}` : ""}
        {dx.window.cumVsSpy != null ? ` · gegen den Markt ${dx.window.cumVsSpy >= 0 ? "+" : ""}${dx.window.cumVsSpy.toFixed(2)} Prozentpunkte` : ""}
      </p>

      {dx.log.length > 0 ? (
        <CheckMatrix
          dx={dx}
          openDay={openDay}
          onPick={(d) => {
            setOpenDay(d.date);
            setAllChecks(false);
            markDay(dx, d);
          }}
        />
      ) : null}

      {open ? (
        <div className="mt-3 space-y-1.5">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">
            Tag {open.day} · {open.date} · These {open.thesisState}
          </p>
          <p className="text-xs text-fg">{open.note}</p>
          {openChecks.length === 0 ? <p className="text-2xs text-long">Keine offenen oder gefallenen Checks an dem Tag.</p> : null}
          <ul className="space-y-1">
            {openChecks.map((c) => (
              <CheckRow key={c.id} check={c} />
            ))}
          </ul>
          {open.checks.length > openChecks.length || allChecks ? (
            <button type="button" className="min-h-9 text-2xs text-muted hover:text-fg" onClick={() => setAllChecks((v) => !v)}>
              {allChecks ? "Nur Brüche und offene" : `Alle ${open.checks.length} Checks`}
            </button>
          ) : null}
          {open.missing.length > 0 ? <p className="text-2xs text-subtle">Lücken: {open.missing.join(", ")}</p> : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => void ask("Aktualisiere die Diagnose", "typed")}>
          Neu prüfen
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void ask("Was würde deine These widerlegen?", "typed")}>
          Gegenthese
        </Button>
      </div>
    </article>
  );
}

function CheckMatrix({
  dx,
  openDay,
  onPick,
}: {
  dx: Diagnosis;
  openDay: string | null;
  onPick: (d: DiagnosisDay) => void;
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-2xs">
        <thead>
          <tr>
            <th className="pr-2 text-left font-normal tracking-[0.1em] text-subtle uppercase">Check</th>
            {dx.log.map((d) => (
              <th key={d.date} className="px-0.5">
                <button
                  type="button"
                  onClick={() => onPick(d)}
                  className={cn(
                    "min-h-9 min-w-9 rounded-sm px-1 font-mono",
                    openDay === d.date ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                  )}
                  aria-label={`Tag ${d.day} ${d.date} im Chart markieren`}
                >
                  {d.day}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DIAG_MATRIX.map((row) => (
            <tr key={row.id}>
              <td className="pr-2 text-muted">{row.short}</td>
              {dx.log.map((d) => {
                const c = d.checks.find((x) => x.id === row.id);
                const st = c?.status ?? "na";
                return (
                  <td key={d.date} className="px-0.5 text-center">
                    <span
                      className={cn(
                        "inline-block size-2 rounded-full",
                        st === "pass" ? "bg-long" : st === "fail" ? "bg-short" : st === "watch" ? "bg-warn" : "bg-subtle/40",
                      )}
                      title={`${row.short} Tag ${d.day}: ${STATUS[st]}${c ? ` — ${c.detail}` : ""}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CheckRow({ check }: { check: DiagnosisCheck }) {
  return (
    <li className="flex gap-2 text-2xs">
      <span className={cn("w-14 shrink-0", tone(check.status))}>{STATUS[check.status]}</span>
      <span className="min-w-0">
        <span className="text-fg">{check.label}.</span>{" "}
        <span className="text-muted">{check.detail}</span>
      </span>
    </li>
  );
}
