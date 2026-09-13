import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { DayBrief } from "@/components/desks/day-brief";
import { ColorLegend } from "@/components/desks/prism-guide";
import { EnginePanel } from "@/components/desks/engine-panel";
import { PulseTape } from "@/components/desks/pulse-tape";
import { Kicker, Panel, Pct, TickerMark } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { explainDemoWeek, explainWatchDay } from "@/lib/explain";
import { floorName } from "@/lib/floor";
import {
  formatEt,
  formatEur,
  formatShares,
  formatUsd,
  INTERVENE_LABEL,
  LESSON_STATUS_LABEL,
  SIDE_LABEL,
  signedClass,
} from "@/lib/format";
import {
  abortDecision,
  bookView,
  LIVE_NOTIONAL_EUR,
  monthKey,
  monthLabel,
  monthTotals,
  monthlyGrossRate,
  projectMonthEnd,
  START_EUR,
  START_USD,
  usdFromEur,
  WATCH_DAYS,
} from "@/lib/paper";
import { useDeskStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { DemoStandup } from "@/lib/types";

type CurvePoint = { week: string; book: number; spy: number };

const WATCH_STATUS: Record<string, string> = {
  idle: "bereit",
  watching: "läuft",
  meeting: "Meeting",
  paused: "Pause",
  complete: "fertig",
};

export function DemoDesk() {
  const demos = useDeskStore((s) => s.demos);
  const lessons = useDeskStore((s) => s.lessons);
  const watch = useDeskStore((s) => s.watch);
  const demoRunning = useDeskStore((s) => s.demoRunning);
  const tapeLoading = useDeskStore((s) => s.tapeLoading);
  const sessionLabel = useDeskStore((s) => s.sessionLabel);
  const tapeSource = useDeskStore((s) => s.tapeSource);
  const startWatch = useDeskStore((s) => s.startWatch);
  const advanceWatchDay = useDeskStore((s) => s.advanceWatchDay);
  const runWatchWeek = useDeskStore((s) => s.runWatchWeek);
  const holdStandup = useDeskStore((s) => s.holdStandup);
  const intervene = useDeskStore((s) => s.intervene);
  const applyLesson = useDeskStore((s) => s.applyLesson);
  const harvests = useDeskStore((s) => s.harvests);
  const harvestWeek = useDeskStore((s) => s.harvestWeek);
  const liveNotional = useDeskStore((s) => s.liveNotional);
  const liveStatus = useDeskStore((s) => s.liveStatus);
  const lastError = useDeskStore((s) => s.lastError);
  const autoPilot = useDeskStore((s) => s.autoPilot);
  const tickCount = useDeskStore((s) => s.tickCount);
  const loadTape = useDeskStore((s) => s.loadTape);
  const runAgent = useDeskStore((s) => s.runAgent);
  const active = watch ?? null;
  const lastWeek = demos[0];
  const [picked, setPicked] = useState<string | null>(null);

  const curve = useMemo(() => {
    if (active && active.equity.length > 0) {
      const fx = active.eurUsd || 1.17;
      return active.equity.map((p) => ({
        week: `T${p.day}`,
        book: Number(usdFromEur(p.nav, fx).toFixed(2)),
        spy: Number(usdFromEur(p.spy, fx).toFixed(2)),
      }));
    }
    let book = START_USD;
    let spy = START_USD;
    const chrono = [...demos].reverse();
    return chrono.map((d) => {
      book = d.navEur;
      spy *= 1 + d.spyPct / 100;
      return { week: d.week, book: Number(book.toFixed(2)), spy: Number(spy.toFixed(2)) };
    });
  }, [active, demos]);

  const defaultKey = active?.equity.length ? `T${active.equity.at(-1)!.day}` : "W31";
  const selected = picked && curve.some((p) => p.week === picked) ? picked : defaultKey;

  const reading = useMemo(() => {
    if (active && selected.startsWith("T")) {
      const day = Number(selected.slice(1));
      const standup = active.standups.find((s) => s.day === day);
      if (standup) return explainWatchDay(standup);
      const eq = active.equity.find((e) => e.day === day);
      if (!eq) return null;
      const bookPct = active.startEur ? ((eq.nav - active.startEur) / active.startEur) * 100 : 0;
      const spyPct = active.startEur ? ((eq.spy - active.startEur) / active.startEur) * 100 : 0;
      const synthetic: DemoStandup = {
        id: `eq-${day}`,
        day,
        at: eq.t,
        date: eq.t.slice(0, 10),
        navEur: eq.nav,
        bookPct,
        spyPct,
        relativePct: bookPct - spyPct,
        note: "Noch kein Meeting an diesem Tag. Die Kurve zeigt nur den Stand.",
        market: "closed",
      };
      return explainWatchDay(synthetic);
    }
    const week = demos.find((d) => d.week === selected);
    return week ? explainDemoWeek(week) : null;
  }, [active, selected, demos]);

  const livePaper = active ?? demos.find((d) => d.generated) ?? null;
  const fx = active?.eurUsd || 1.17;
  const view = bookView({
    startEur: active?.startEur,
    navEur: active?.navEur,
    cashEur: active?.cashEur ?? 0,
    eurUsd: fx,
    spyPct: active?.spyPct,
    relativePct: active?.relativePct,
  });
  const navUsd = view.navUsd;
  const startUsd = view.depositedUsd;
  const vsStart = ((navUsd - startUsd) / startUsd) * 100;
  const live = Boolean(active && active.status !== "complete" && active.status !== "idle");
  const paused = active?.status === "paused";
  const month = monthKey();
  const payout = monthTotals(harvests, month);
  const lastHarvested = lastWeek ? harvests.some((h) => h.week === lastWeek.week) : false;
  const projected = projectMonthEnd(payout.harvestedNet, monthlyGrossRate(demos), liveNotional);
  const generatedWeeks = demos.filter((d) => d.generated).length;
  const decision = abortDecision({
    harvestedNet: payout.harvestedNet,
    projectedNet: projected,
    liveStatus,
    generatedWeeks,
  });

  return (
    <div className="space-y-6" data-vesper="demo.watch">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Kicker>Demo-Desk · {formatUsd(START_USD, 0)} Paper · kein Echtgeld · Autopilot {autoPilot ? "an" : "Halt"}</Kicker>
          <h1 className="text-3xl text-fg sm:text-4xl">Paper kauft und verkauft. Der Gewinn bleibt.</h1>
          <p className="max-w-2xl text-sm text-muted">
            300 Dollar digitaler Einsatz, echte Schlusskurse, kein Echtgeld. Mitnehmen, Cash, nachkaufen. Lehrwochen sind Beispiele.
          </p>
          <p className="font-mono text-2xs text-subtle">
            {sessionLabel}
            {autoPilot ? ` · Tick ${tickCount}` : ""}
          </p>
        </div>
        {!autoPilot && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void startWatch()} disabled={tapeLoading || demoRunning || live}>
              {tapeLoading ? "Lade Tape…" : "Watch starten"}
            </Button>
            <Button variant="ghost" onClick={() => void runWatchWeek()} disabled={demoRunning || tapeLoading}>
              Woche durchspielen
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                void loadTape().then(() => toast("Tape aktualisiert."));
              }}
              disabled={tapeLoading}
            >
              Tape holen
            </Button>
          </div>
        )}
      </header>

      <ColorLegend />
      <EnginePanel />
      <PulseTape compact />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel className="p-4">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Eingezahlt</p>
          <p className="mt-1 font-display text-2xl text-fg">{formatUsd(startUsd)}</p>
          <p className="mt-1 text-xs text-muted">Digitaler Einsatz</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Stand</p>
          <p className="mt-1 font-display text-2xl text-fg">{formatUsd(navUsd)}</p>
          <p className={cn("mt-1 text-xs", signedClass(vsStart))}>
            {vsStart >= 0 ? "+" : ""}
            {vsStart.toFixed(1)}% vs. Start
          </p>
        </Panel>
        <Panel className="p-4">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Gewinn</p>
          <p className={cn("mt-1 font-display text-2xl", signedClass(navUsd - startUsd))}>
            {navUsd - startUsd >= 0 ? "+" : ""}
            {formatUsd(navUsd - startUsd)}
          </p>
          <p className="mt-1 text-xs text-muted">Kein Echtgeld</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Cash</p>
          <p className="mt-1 font-display text-2xl text-fg">
            {formatUsd(active ? usdFromEur(active.cashEur, active.eurUsd) : 0)}
          </p>
          <p className="mt-1 text-xs text-muted">wartet auf den nächsten Kauf</p>
        </Panel>
      </div>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Kicker>Realisiert diesen Monat · bleibt im Book · kein Konto</Kicker>
            <p className="mt-1 font-display text-3xl text-fg">
              {formatUsd(usdFromEur(payout.harvestedNet, fx))}
            </p>
            <p className="mt-1 text-xs text-muted">
              Nur Plus der Beimischung plus Dividende, Kern bleibt. Wird wieder eingesetzt, nicht abgehoben. Simulation auf {formatUsd(START_USD, 0)}.
            </p>
          </div>
          {decision.kill ? (
            <Badge tone="warn">Abbruch</Badge>
          ) : payout.hit ? (
            <Badge tone="long">Boden steht</Badge>
          ) : (
            <Badge tone="sage">Live</Badge>
          )}
        </div>
        {decision.kill && <p className="mt-3 text-sm text-short">{decision.reason}</p>}
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-2xs tracking-[0.12em] text-muted uppercase">
            <tr className="border-y border-border">
              <th className="py-2 pr-3 font-medium">Woche</th>
              <th className="px-3 py-2 text-right font-medium">Brutto</th>
              <th className="px-3 py-2 text-right font-medium">Steuer</th>
              <th className="py-2 pl-3 text-right font-medium">Netto</th>
            </tr>
          </thead>
          <tbody>
            {[...payout.rows]
              .sort((a, b) => (b.week ?? "").localeCompare(a.week ?? ""))
              .map((h) => (
              <tr key={h.id} className="border-b border-border last:border-0">
                <td className="py-2 pr-3">{h.week ?? h.source}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{formatEur(h.grossEur)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{formatEur(h.taxEur)}</td>
                <td className="py-2 pl-3 text-right font-mono tabular-nums text-long">{formatEur(h.netEur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lastWeek && !lastHarvested && liveStatus !== "abort" && lastWeek.bookPct > 0 && !autoPilot && (
          <Button className="mt-3" size="sm" onClick={() => harvestWeek(lastWeek)}>
            {lastWeek.week} ernten
          </Button>
        )}
      </Panel>

      {lastError && <p className="text-sm text-short">{lastError}</p>}

      {active && (
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Kicker>
                Watch · Tag {active.day}/{WATCH_DAYS} · {WATCH_STATUS[active.status] ?? active.status}
              </Kicker>
              <p className="mt-1 font-display text-2xl text-fg">{formatUsd(usdFromEur(active.navEur, active.eurUsd))}</p>
              <p className="mt-1 text-xs text-muted">
                Book <Pct value={active.bookPct} className="text-xs" /> · Markt{" "}
                <Pct value={active.spyPct} className="text-xs" /> · Abstand {active.relativePct >= 0 ? "+" : ""}
                {active.relativePct.toFixed(2)} Prozentpunkte
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!autoPilot && live && !paused && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => void advanceWatchDay()} disabled={demoRunning || tapeLoading}>
                    Tag weiter
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void holdStandup()}>
                    Meeting
                  </Button>
                </>
              )}
              {!autoPilot && live && paused && (
                <Button size="sm" onClick={() => intervene("resume")}>
                  {INTERVENE_LABEL.resume}
                </Button>
              )}
              {live && !paused && active.status !== "complete" && (
                <Button size="sm" variant="ghost" onClick={() => intervene("halt")}>
                  {INTERVENE_LABEL.halt}
                </Button>
              )}
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">Eingriff jederzeit — Beimischung, Grundstock, Tesla raus.</p>
          {active.status !== "complete" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => intervene("rebalance")}>
                {INTERVENE_LABEL.rebalance}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => intervene("trim-overlay")}>
                {INTERVENE_LABEL["trim-overlay"]}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => intervene("add-core")}>
                {INTERVENE_LABEL["add-core"]}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => intervene("flat", "TSLA")}>
                Tesla raus
              </Button>
            </div>
          )}
        </Panel>
      )}

      <Panel>
        <Kicker>Paper gegen den Markt · {formatUsd(START_USD, 0)} Start · klick eine Woche</Kicker>
        <p className="mt-1 text-xs text-muted">
          Hell = unser Paper. Grau = derselbe Start im großen US-Aktienkorb. W31 enthält den 29. Juli.
        </p>
        <div className="mt-2 h-56 cursor-pointer">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={curve}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              onClick={(state) => {
                const week = (state?.activePayload?.[0]?.payload as CurvePoint | undefined)?.week;
                if (week) setPicked(week);
              }}
            >
              <CartesianGrid stroke="rgba(230,228,223,0.06)" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: "#8a8f8b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "#8a8f8b", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v: number) => `${v.toFixed(1)}`}
              />
              <Tooltip
                contentStyle={{
                  background: "#181b1d",
                  border: "1px solid rgba(230,228,223,0.12)",
                  borderRadius: 8,
                  color: "#e6e4df",
                }}
                formatter={(value) => {
                  const n = typeof value === "number" ? value : Number(value);
                  return [Number.isFinite(n) ? formatUsd(n) : String(value ?? ""), ""];
                }}
                labelFormatter={(label) => `${label} · Klick für Gründe`}
              />
              {selected && <ReferenceLine x={selected} stroke="#c8d4cc" strokeDasharray="4 4" strokeOpacity={0.45} />}
              <Area type="monotone" dataKey="spy" stroke="#8a8f8b" fill="rgba(138,143,139,0.08)" strokeWidth={1.2} />
              <Area
                type="monotone"
                dataKey="book"
                stroke="#c8d4cc"
                fill="rgba(200,212,204,0.16)"
                strokeWidth={1.6}
                dot={(props: Record<string, unknown>) => {
                  const week = (props.payload as CurvePoint | undefined)?.week;
                  const cx = props.cx as number | undefined;
                  const cy = props.cy as number | undefined;
                  if (!week || week !== selected || cx == null || cy == null) {
                    return <g key={String(week ?? "x")} />;
                  }
                  return <circle key={week} cx={cx} cy={cy} r={5} fill="#c8d4cc" stroke="#e6e4df" strokeWidth={1.5} />;
                }}
                activeDot={{ r: 5, stroke: "#e6e4df", strokeWidth: 1.5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-2xs tracking-wide text-subtle uppercase">Klick auf den Punkt · Stichpunkte darunter</p>
        <DayBrief
          key={`${reading?.symbol}-${reading?.date}`}
          reading={reading}
          onAsk={(r) =>
            runAgent(
              "demo",
              `Prism, Anfaenger. Paper-Woche ${r.symbol}, ${r.date}, Relativ ${r.changePct.toFixed(2)} pp vs SPY. Stichpunkte, leicht verstaendlich: was lief, was nicht, was wir daraus machen. 300 Dollar digital, Gewinn bleibt im Book.`,
            )
          }
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="overflow-x-auto lg:col-span-3">
          <Kicker>Positionen · mark-to-market</Kicker>
          <table className="mt-3 w-full min-w-[560px] text-left text-sm">
            <thead className="text-2xs tracking-[0.12em] text-muted uppercase">
              <tr className="border-y border-border">
                <th className="py-2 pr-3 font-medium">Ticker</th>
                <th className="px-3 py-2 font-medium">Sleeve</th>
                <th className="px-3 py-2 text-right font-medium">Stück</th>
                <th className="px-3 py-2 text-right font-medium">Last</th>
                <th className="py-2 pl-3 text-right font-medium">Gewicht</th>
              </tr>
            </thead>
            <tbody>
              {(active?.positions ?? [])
                .slice()
                .sort((a, b) => b.weightPct - a.weightPct)
                .map((p) => (
                  <tr key={p.ticker} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3">
                      <TickerMark symbol={p.ticker} />
                    </td>
                    <td className="px-3 py-2.5 text-muted">
                      {p.sleeve === "core" ? "Kern" : p.sleeve === "toll" ? "Tollbooth" : "Overlay"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatShares(p.shares)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatUsd(p.lastUsd)}</td>
                    <td className="py-2.5 pl-3 text-right font-mono tabular-nums">{p.weightPct.toFixed(1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!active && (
            <p className="mt-3 text-sm text-muted">Watch starten, dann liegt das 50-€-Book auf dem letzten Close.</p>
          )}
          {active && active.cashEur > 0.01 && (
            <p className="mt-2 text-xs text-muted">Cash {formatEur(active.cashEur)}</p>
          )}
        </Panel>

        <Panel className="lg:col-span-2">
          <Kicker>Tägliche Meetings</Kicker>
          <ul className="mt-3 space-y-3">
            {(active?.standups ?? [])
              .slice()
              .reverse()
              .map((s) => (
                <li key={s.id} className="rounded-lg bg-elevated p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-2xs text-subtle">
                      Tag {s.day}/7 · {s.date} · {formatEt(s.at)}
                    </p>
                    <Pct value={s.relativePct} className="text-2xs" />
                  </div>
                  <p className="mt-1.5 text-sm text-fg">{s.note}</p>
                </li>
              ))}
            {!active && <li className="text-sm text-muted">Noch kein Standup. Watch starten.</li>}
          </ul>
        </Panel>
      </div>

      <Panel>
        <Kicker>Lessons · Fehler, die wir nicht wiederholen</Kicker>
        <ul className="mt-3 space-y-3">
          {lessons.map((l) => (
            <li key={l.id} className="rounded-lg bg-elevated p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-2xs text-subtle">
                  {l.week} · {floorName(l.owner)} · {LESSON_STATUS_LABEL[l.status]}
                </p>
                {l.status === "open" && !autoPilot && (
                  <Button size="sm" variant="ghost" onClick={() => applyLesson(l.id)}>
                    Anwenden
                  </Button>
                )}
              </div>
              <p className="mt-1 text-sm text-fg">{l.mistake}</p>
              <p className="mt-1 text-xs text-muted">{l.fix}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <Kicker>Abgeschlossene Wochen</Kicker>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {demos.map((d) => {
            const pay = harvests.find((h) => h.week === d.week);
            const on = selected === d.week;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setPicked(d.week)}
                  className={cn(
                    "w-full rounded-lg bg-elevated p-3 text-left",
                    on ? "shadow-[var(--shadow-border-hover)]" : "",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-fg">
                      {d.week} · {d.label}
                      {d.lesson ? " · Lehrwoche" : d.generated ? " · gerechnet" : ""}
                    </p>
                    <span className={cn("font-mono text-2xs tabular-nums", signedClass(d.relativePct))}>
                      {d.relativePct >= 0 ? "+" : ""}
                      {d.relativePct.toFixed(2)} pp
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{d.verdict}</p>
                  {pay && (
                    <p className="mt-2 text-xs text-long">
                      Geerntet {formatEur(pay.netEur)} netto
                      {pay.lesson ? " · Lehrbeispiel" : " · Hochrechnung"}
                    </p>
                  )}
                  <ul className="mt-2 space-y-0.5">
                    {d.trades.map((t) => (
                      <li key={t.id} className="font-mono text-2xs text-subtle">
                        {t.ticker} {SIDE_LABEL[t.side]} {t.pnlPct >= 0 ? "+" : ""}
                        {t.pnlPct.toFixed(1)}% · {t.note}
                      </li>
                    ))}
                  </ul>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
