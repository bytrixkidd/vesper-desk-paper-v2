import { useState } from "react";
import { toast } from "sonner";
import { formatEt } from "@/lib/format";
import { replaceTickers } from "@/lib/names";
import { useDeskStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentNote, Kicker, Panel, StatusDot, TickerMark } from "@/components/shared";

export function OvernightDesk() {
  const allBots = useDeskStore((s) => s.bots);
  const bots = allBots.filter((b) => b.desk === "research" || b.desk === "feedback");
  const briefs = useDeskStore((s) => s.briefs);
  const running = useDeskStore((s) => s.running);
  const runOvernight = useDeskStore((s) => s.runOvernight);
  const lastError = useDeskStore((s) => s.lastError);
  const [openId, setOpenId] = useState(briefs[0]?.id);
  const brief = briefs.find((b) => b.id === openId) ?? briefs[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Kicker>Overnight-Aktienresearch · Autopilot</Kicker>
          <h1 className="text-3xl text-fg sm:text-4xl">Die Bots schreiben den Brief selbst.</h1>
          <p className="max-w-2xl text-sm text-muted">
            Autopilot kompiliert Lage und Weekly lokal, 24/7, ohne dass du startest. Modell holen bleibt freiwillig —
            Paper darf alles testen, Live-Geld nicht.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            void runOvernight().then(() => toast("Helmsman hat das Modell gefragt."));
          }}
          disabled={running}
        >
          {running ? "Modell…" : "Modell holen"}
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {bots.map((b, i) => (
          <Panel key={b.id} className={`enter-up enter-up-${Math.min(i + 1, 5)}`}>
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

      {lastError && (
        <p className="text-sm text-short">{lastError}. Helmsman hat trotzdem eine lokale Synthese erstellt.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <Panel className="lg:col-span-1">
          <Kicker>Postfach</Kicker>
          <ul className="mt-3 space-y-1">
            {briefs.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(b.id)}
                  className={`flex min-h-11 w-full flex-col rounded-md px-2.5 py-2 text-left text-sm ${
                    brief?.id === b.id ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg"
                  }`}
                >
                  <span className="line-clamp-1 font-medium">{b.title}</span>
                  <span className="text-2xs text-subtle">{formatEt(b.deliveredAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="lg:col-span-3">
          {brief && (
            <>
              <Kicker>{brief.generated ? "Helmsman · Live-Kompilat" : "Helmsman · Produktionsbriefing"}</Kicker>
              <h2 className="mt-1 font-display text-2xl text-fg">{brief.title}</h2>
              <p className="mt-1 text-xs text-muted">{formatEt(brief.deliveredAt)}</p>
              <p className="mt-4 text-sm leading-relaxed text-fg/90">{replaceTickers(brief.lede)}</p>
              <div className="mt-5 space-y-4">
                {brief.sections.map((s) => (
                  <div key={s.heading}>
                    <p className="text-2xs font-medium tracking-[0.14em] text-muted uppercase">{s.heading}</p>
                    {s.tickers && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {s.tickers.map((t) => (
                          <TickerMark key={t} symbol={t} className="text-muted" />
                        ))}
                      </div>
                    )}
                    {brief.generated ? (
                      <div className="mt-2">
                        <AgentNote text={s.body} />
                      </div>
                    ) : (
                      <p className="mt-1 text-sm leading-relaxed text-fg/85">{replaceTickers(s.body)}</p>
                    )}
                  </div>
                ))}
              </div>
              {brief.actions.length > 0 && (
                <div className="mt-5 rounded-lg bg-elevated p-3">
                  <p className="mb-2 text-2xs font-medium tracking-[0.14em] text-muted uppercase">Aktionen</p>
                  <ul className="space-y-2">
                    {brief.actions.map((a) => (
                      <li key={a.ticker} className="text-sm">
                        <TickerMark symbol={a.ticker} />{" "}
                        <span className="text-fg">{a.action}.</span>{" "}
                        <span className="text-muted">{replaceTickers(a.rationale)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
