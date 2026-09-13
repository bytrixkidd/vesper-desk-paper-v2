import { formatEur, formatUsd } from "@/lib/format";
import {
  CONFIRM_WEEKS,
  LIFE_NET_EUR,
  LIFE_STRETCH_EUR,
  PROOF_WEEKS,
  START_USD,
  lifeCapitalNeeded,
  planSteps,
} from "@/lib/paper";
import { Badge } from "@/components/ui/badge";
import { Kicker, Panel } from "@/components/shared";
import { useDeskStore } from "@/lib/store";

export function PlanLadder() {
  const demos = useDeskStore((s) => s.demos);
  const generated = demos.filter((d) => d.generated);
  const wins = generated.filter((d) => d.bookPct > 0).length;
  const steps = planSteps(generated.length, wins);
  const need5 = lifeCapitalNeeded(LIFE_NET_EUR);
  const need20 = lifeCapitalNeeded(LIFE_STRETCH_EUR);

  return (
    <Panel className="enter-up" data-vesper="plan.ladder">
      <Kicker>Jahresziel · digital, kein Echtgeld</Kicker>
      <h2 className="mt-1 font-display text-2xl text-fg">
        Erst 300 $, dann Größe für {formatEur(LIFE_NET_EUR, 0)}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        {formatUsd(START_USD, 0)} Testlauf jetzt. {formatEur(LIFE_NET_EUR, 0)} im Monat auf 300 Dollar wären kein seriöses Ziel.
        Dieselbe Quote braucht rund {formatEur(need5, 0)} für {formatEur(LIFE_NET_EUR, 0)} und rund {formatEur(need20, 0)} für{" "}
        {formatEur(LIFE_STRETCH_EUR, 0)}. Deshalb zuerst kaufen und verkaufen auf 300 $, dann Größe.
      </p>
      <ol className="mt-4 space-y-3">
        {steps.map((step) => (
          <li key={step.id} className="flex gap-3 rounded-lg bg-elevated p-3">
            <span className="font-display text-lg text-fg/80">{step.id}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-fg">{step.title}</p>
                <Badge tone={step.status === "done" ? "long" : step.status === "active" ? "sage" : "default"}>
                  {step.status === "done" ? "steht" : step.status === "active" ? "jetzt" : "später"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-subtle">
        Gerade: {generated.length}/{PROOF_WEEKS} Diagnose-Wochen, Ziel {CONFIRM_WEEKS} für den Nachweis. Lehrwochen
        in der Liste zählen nicht.
      </p>
    </Panel>
  );
}
