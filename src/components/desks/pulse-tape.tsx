import { Kicker, Panel, StatusDot } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { formatEt, formatUsd, PULSE_KIND_LABEL } from "@/lib/format";
import { replaceTickers } from "@/lib/names";
import { floorName } from "@/lib/floor";
import { useDeskStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function PulseTape({ compact = false }: { compact?: boolean }) {
  const huddle = useDeskStore((s) => s.lastHuddle);
  const log = useDeskStore((s) => s.pulseLog);
  const autoPilot = useDeskStore((s) => s.autoPilot);
  const bots = [
    { id: "skipper" as const, line: huddle?.skipper ?? "Kern halten." },
    { id: "forge" as const, line: huddle?.forge ?? "Verlierer zurückholen." },
    { id: "till" as const, line: huddle?.till ?? "Gewinne der Zahler nehmen." },
    { id: "drift" as const, line: huddle?.drift ?? "Trail vom Hoch." },
  ];
  return (
    <Panel className="enter-up">
      <div data-vesper="pulse.tape">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Kicker>Puls · jede Sekunde · nur Aktionen auf dem Band</Kicker>
          <p className="mt-1 text-sm text-muted">
            Skipper, Forge, Till und Drift sprechen sich ab. Floor bleibt still, solange nichts zu tun ist.
          </p>
        </div>
        <Badge tone={autoPilot ? (huddle && huddle.action !== "hold" ? "warn" : "long") : "sage"}>
          {autoPilot ? (huddle ? PULSE_KIND_LABEL[huddle.action] : "wartet") : "Halt"}
        </Badge>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {bots.map((b) => (
          <li key={b.id} className="rounded-lg bg-elevated p-3">
            <div className="flex items-center gap-2">
              <StatusDot status={huddle?.action !== "hold" && huddle ? "running" : "done"} />
              <p className="font-display text-base text-fg">{floorName(b.id)}</p>
            </div>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted">{replaceTickers(b.line)}</p>
          </li>
        ))}
      </ul>
      {!compact && (
        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {log.length === 0 ? (
            <li className="text-sm text-muted">Noch kein Eingriff. Cash darf liegen. Nachkauf nur mit S1 oder S2.</li>
          ) : (
            log.slice(0, 8).map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="text-fg">{floorName(e.bot)}</span>{" "}
                  <span className="text-muted">{replaceTickers(e.text)}</span>
                </span>
                <span className={cn("shrink-0 font-mono text-2xs tabular-nums text-subtle")}>
                  {formatEt(e.at)}
                  {e.grossEur != null && e.grossEur !== 0
                    ? ` · ${e.kind === "buy" ? "gesetzt " : "+"}${formatUsd(Math.abs(e.grossEur))}`
                    : ""}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
      </div>
    </Panel>
  );
}
