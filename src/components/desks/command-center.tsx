import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { formatEt, formatEur, formatPct, formatUsd } from "@/lib/format";
import { sliceRange, tapeForWatchlist } from "@/lib/charts";
import { explainPoint, pickBar } from "@/lib/explain";
import {
  abortDecision,
  blendedYield,
  bookView,
  capitalForMonthlyNet,
  monthKey,
  monthLabel,
  monthTotals,
  monthlyGrossRate,
  projectMonthEnd,
  START_USD,
} from "@/lib/paper";
import { floorName } from "@/lib/floor";
import { replaceTickers } from "@/lib/names";
import { useDeskStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kicker, Panel, Pct, SeverityBadge, StatusDot, TickerMark } from "@/components/shared";
import { DayBrief } from "@/components/desks/day-brief";
import { PrismGuide } from "@/components/desks/prism-guide";
import { PlanLadder } from "@/components/desks/plan-ladder";
import { EnginePanel } from "@/components/desks/engine-panel";
import { PulseTape } from "@/components/desks/pulse-tape";
import { TapeChart } from "@/components/desks/tape-chart";
import { CheckPanel } from "@/components/desks/check-panel";
import { useVesperFocus } from "@/lib/vesper/use-focus";
import { ZipDownload } from "@/components/zip-download";

export function CommandCenter() {
  const briefs = useDeskStore((s) => s.briefs);
  const weeklies = useDeskStore((s) => s.weeklies);
  const bots = useDeskStore((s) => s.bots);
  const alerts = useDeskStore((s) => s.alerts);
  const watchlist = useDeskStore((s) => s.watchlist);
  const running = useDeskStore((s) => s.running);
  const messages = useDeskStore((s) => s.messages);
  const strategy = useDeskStore((s) => s.strategy);
  const harvests = useDeskStore((s) => s.harvests);
  const demos = useDeskStore((s) => s.demos);
  const liveNotional = useDeskStore((s) => s.liveNotional);
  const liveStatus = useDeskStore((s) => s.liveStatus);
  const abortLive = useDeskStore((s) => s.abortLive);
  const resumeLive = useDeskStore((s) => s.resumeLive);
  const autoPilot = useDeskStore((s) => s.autoPilot);
  const autoLog = useDeskStore((s) => s.autoLog);
  const tickCount = useDeskStore((s) => s.tickCount);
  const ticking = useDeskStore((s) => s.ticking);
  const watch = useDeskStore((s) => s.watch);
  const tape = useDeskStore((s) => s.tape);
  const runAgent = useDeskStore((s) => s.runAgent);
  const [picked, setPicked] = useState<string | null>("2026-07-29");
  const brief = briefs[0];
  const weekly = weeklies[0];
  const floorTape = messages.slice(-4);
  const researchBots = bots.filter((b) => b.desk === "research");
  const feedbackBots = bots.filter((b) => b.desk === "feedback");
  const month = monthKey();
  const payout = monthTotals(harvests, month);
  const runRate = monthlyGrossRate(demos);
  const capNeed = capitalForMonthlyNet(runRate);
  const yld = blendedYield(strategy.sleeves);
  const divMonth = START_USD * (yld / 12);
  const projected = projectMonthEnd(payout.harvestedNet, runRate, liveNotional);
  const generatedWeeks = demos.filter((d) => d.generated).length;
  const decision = abortDecision({
    harvestedNet: payout.harvestedNet,
    projectedNet: projected,
    liveStatus,
    generatedWeeks,
  });
  const view = bookView({
    startEur: watch?.startEur,
    navEur: watch?.navEur,
    cashEur: watch?.cashEur,
    eurUsd: watch?.eurUsd,
    relativePct: watch?.relativePct,
  });
  const fallback = useMemo(() => tapeForWatchlist(watchlist), [watchlist]);
  const spyBars = sliceRange((Object.keys(tape).length > 0 ? tape : fallback).SPY ?? [], "3M");
  const spyHit = pickBar(spyBars, picked);
  const spyReading =
    spyHit.bar &&
    explainPoint({
      symbol: "SPY",
      name: "US-Aktienkorb",
      bar: spyHit.bar,
      prev: spyHit.prev,
    });

  useVesperFocus((focus) => {
    if (focus.iso) setPicked(focus.iso);
  });

  return (
    <div className="space-y-6">
      <Panel className="border-primary/40 bg-elevated p-5">
        <p className="text-xs tracking-[0.14em] text-muted uppercase">Download</p>
        <h2 className="mt-1 font-display text-2xl text-fg">Code-Paket liegt hier</h2>
        <p className="mt-1 max-w-xl text-sm text-muted">
          ZIP mit aktuellem Paper-Code, Tests und Startanleitung. Kein Echtgeld, keine Zugangsdaten. Die Datei kommt in den Ordner Downloads, nicht in diese Vorschau.
        </p>
        <ZipDownload className="mt-4" />
      </Panel>

      <header className="enter-up space-y-2">
        <Kicker>Kommando · {monthLabel(month)} · Autopilot {autoPilot ? "an" : "Halt"}</Kicker>
        <h1 className="max-w-3xl text-3xl text-fg sm:text-4xl">Die Bots laufen. Du liest das Weekly.</h1>
        <p className="max-w-2xl text-sm text-muted sm:text-base">
          Testlauf 300 Dollar Paper, echte Kurse, kein Echtgeld. Die Bots kaufen, nehmen mit, kaufen nach. Gewinn bleibt im Book. 5.000 € im Monat brauchen später mehr Einsatz, nicht diesen Test.
        </p>
      </header>

      <PlanLadder />
      <CheckPanel />
      <EnginePanel />
      <PrismGuide />

      <Panel className="enter-up enter-up-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Kicker>US-Aktienkorb · klick einen Tag</Kicker>
            <h2 className="mt-1 font-display text-2xl text-fg">Warum der Korb sich bewegt</h2>
            <p className="mt-1 text-xs text-muted">
              Beispiel 29. Juli 2026: Index gefallen. Ein Klick, Stichpunkte. Grün/rot wie im Rest des Desks.
            </p>
          </div>
          <Link to="/charts" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:opacity-80">
            Alle Charts <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="mt-4">
          {spyBars.length >= 2 ? (
            <TapeChart
              bars={spyBars}
              id="cmd-spy"
              height={220}
              selectedIso={picked}
              onSelect={(bar) => setPicked(bar.t.slice(0, 10))}
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted">Tape wird geladen…</p>
          )}
        </div>
        <DayBrief
          key={`${spyReading ? spyReading.symbol : "none"}-${spyReading ? spyReading.date : "x"}`}
          reading={spyReading || null}
          onAsk={(r) =>
            runAgent(
              "charts",
              `Prism, Anfaenger. S&P 500 (SPY) am ${r.date}, ${r.changePct.toFixed(2)} %. Stichpunkte, leicht verstaendlich, warum der Tag so lief.`,
            )
          }
        />
      </Panel>

      <div className="enter-up enter-up-1 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { k: "Eingezahlt", v: formatUsd(view.depositedUsd, 0) },
          { k: "Stand", v: view.ready ? formatUsd(view.navUsd, 0) : "—" },
          { k: "Gewinn", v: view.ready ? `${view.pnlUsd >= 0 ? "+" : ""}${formatUsd(view.pnlUsd)}` : "—" },
          { k: "vs Markt", v: watch ? `${watch.relativePct >= 0 ? "+" : ""}${watch.relativePct.toFixed(2)} pp` : "—" },
        ].map((s) => (
          <Panel key={s.k} className="p-4">
            <p className="text-2xs tracking-[0.12em] text-muted uppercase">{s.k}</p>
            <p className="mt-1 font-display text-xl text-fg">{s.v}</p>
          </Panel>
        ))}
      </div>

      <PulseTape compact />

      <Panel className="enter-up enter-up-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Kicker>Autopilot · Paper, kein Live-Geld</Kicker>
            <p className="mt-1 font-display text-2xl text-fg">
              {autoPilot ? (ticking ? "Programmtakt" : `Takt ${tickCount}`) : "Halt"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {watch?.tapeCloseDate
                ? `Letzter Schluss ${watch.tapeCloseDate}. Ein Takt ist keine neue Börsensitzung und kein neuer Kurs.`
                : "Letzter Schluss steht im Tape. Takt zählt nur Programmzeit."}{" "}
              Läuft nur, solange diese Seite offen ist — nicht 24/7 im Hintergrund.
              {watch && watch.status !== "complete"
                ? ` Watch ${watch.label} · Tag ${watch.day}/7 · Stand ${view.ready ? formatUsd(view.navUsd) : "—"}`
                : " Nächste Watch startet als Cash, Käufe erst in der Sitzung."}
              {watch?.tradeLock ? ` Sperre: ${watch.tradeLock}` : ""}
            </p>
          </div>
          <Badge tone={autoPilot ? "long" : "warn"}>{autoPilot ? "24/7" : "Steht"}</Badge>
        </div>
        {autoLog.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-border pt-3">
            {autoLog.slice(0, 5).map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <StatusDot status="done" />
                <span className="min-w-0">
                  <span className="text-fg">{floorName(e.bot)}</span>{" "}
                  <span className="text-muted">{e.text}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div data-vesper="live-overlay">
      <Panel className="enter-up enter-up-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Kicker>Live-Overlay · {decision.status === "abort" ? "abgebrochen" : "an"}</Kicker>
            <p className="mt-1 text-sm leading-relaxed text-fg/90">{decision.reason}</p>
          </div>
          <Badge tone={decision.status === "abort" ? "warn" : payout.hit ? "long" : "sage"}>
            {decision.status === "abort" ? "Abbruch" : "300 $ Test"}
          </Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {liveStatus === "live" ? (
            <Button variant="ghost" onClick={() => abortLive()}>
              Overlay stoppen
            </Button>
          ) : (
            <Button onClick={() => resumeLive()}>Overlay fortsetzen</Button>
          )}
          <Link to="/trade" className="inline-flex min-h-11 items-center text-sm text-primary hover:opacity-80">
            Trading-Floor
          </Link>
        </div>
      </Panel>
      </div>

      <Panel className="enter-up enter-up-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Kicker>Hochrechnung · 300 $ Test · kein Konto</Kicker>
            <p className="mt-1 font-display text-2xl text-fg">
              {view.ready ? `${formatUsd(view.navUsd)} Stand` : "Kein laufendes Book"}
            </p>
            <p className="mt-1 text-xs text-muted">
              Eingezahlt {formatUsd(view.depositedUsd, 0)}. Gewinn {view.pnlUsd >= 0 ? "+" : ""}
              {formatUsd(view.pnlUsd)} bleibt im Book. Quote {formatPct(runRate * 100, 2)} brutto aus gerechneten Wochen.
            </p>
          </div>
          <Badge tone={view.pnlUsd >= 0 ? "long" : "warn"}>
            {view.pnlUsd >= 0 ? "über Start" : "unter Start"}
          </Badge>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-elevated">
          <div
            className={`h-full rounded-full ${view.pnlUsd >= 0 ? "bg-long" : "bg-warn"}`}
            style={{ width: `${Math.max(3, Math.min(100, 50 + view.pnlPct * 8))}%` }}
          />
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          <li>
            <p className="text-2xs tracking-[0.12em] text-muted uppercase">Quote / Monat</p>
            <p className="mt-1 font-mono text-sm text-fg">{formatPct(runRate * 100, 2)} brutto</p>
            <p className="mt-1 text-xs text-muted">
              Nur aus gerechneten Paper-Wochen, nicht aus Lehrbeispielen.
            </p>
          </li>
          <li>
            <p className="text-2xs tracking-[0.12em] text-muted uppercase">Szenario 5.000 € / Mo</p>
            <p className="mt-1 font-mono text-sm text-fg">
              {Number.isFinite(capNeed) ? formatUsd(capNeed, 0) : "—"}
            </p>
            <p className="mt-1 text-xs text-muted">
              Nicht verdient. Rechengröße bei angenommener Quote, anderer Einsatz. Kein Ergebnis des 300-$-Tests.
            </p>
          </li>
          <li>
            <p className="text-2xs tracking-[0.12em] text-muted uppercase">Div-Schätzung</p>
            <p className="mt-1 font-mono text-sm text-fg">{formatUsd(divMonth)} / Mo</p>
            <p className="mt-1 text-xs text-muted">
              Blended {(yld * 100).toFixed(2).replace(".", ",")} % p.a. Nicht gebucht.
            </p>
          </li>
        </ul>
        {payout.rows.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-border pt-3">
            {payout.rows.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="text-fg">
                  {h.week ?? h.source} · {h.note.slice(0, 72)}
                </span>
                <span className="font-mono tabular-nums text-long">{formatEur(h.netEur)} Paper, bleibt im Book</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          to="/demo"
          className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:opacity-80"
        >
          Watch laufen — Lücke schließen <ArrowUpRight className="size-4" />
        </Link>
      </Panel>

      <Panel className="enter-up enter-up-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Kicker>Strategie · Duales Mandat</Kicker>
            <h2 className="mt-1 font-display text-2xl text-fg">{strategy.name}</h2>
          </div>
          <Link
            to="/demo"
            className="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:opacity-80"
          >
            Demo öffnen <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{strategy.thesis}</p>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-elevated">
          {strategy.groups.map((g) => (
            <span
              key={g.id}
              className={g.id === "beta" ? "bg-primary" : g.id === "toll" ? "bg-long" : "bg-warn/70"}
              style={{ flexGrow: g.weightPct, flexBasis: 0 }}
              title={g.label}
            />
          ))}
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {strategy.groups.map((g) => (
            <li key={g.id}>
              <p className="text-sm text-fg">
                {g.label} · {g.weightPct}%
              </p>
              <p className="mt-1 text-xs text-muted">{g.tickers.join(" · ")}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="enter-up enter-up-2 lg:col-span-3">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Kicker>Helmsman · einheitliches Briefing</Kicker>
              <h2 className="mt-1 font-display text-2xl text-fg">{brief?.title}</h2>
              <p className="mt-1 text-xs text-muted">{brief ? formatEt(brief.deliveredAt) : ""}</p>
            </div>
            <Badge tone="sage">{running ? "Läuft" : "Zugestellt"}</Badge>
          </div>
          <p className="text-sm leading-relaxed text-fg/90">{brief ? replaceTickers(brief.lede) : ""}</p>
          <div className="mt-5 space-y-4">
            {brief?.sections.slice(0, 3).map((s) => (
              <div key={s.heading}>
                <p className="text-2xs font-medium tracking-[0.14em] text-muted uppercase">{s.heading}</p>
                <p className="mt-1 text-sm leading-relaxed text-fg/85">{replaceTickers(s.body)}</p>
              </div>
            ))}
          </div>
          {brief && brief.actions.length > 0 && (
            <div className="mt-5 rounded-lg bg-elevated p-3">
              <p className="mb-2 text-2xs font-medium tracking-[0.14em] text-muted uppercase">Buch-Aktionen</p>
              <ul className="space-y-2">
                {brief.actions.map((a) => (
                  <li key={a.ticker} className="flex gap-3 text-sm">
                    <TickerMark symbol={a.ticker} className="shrink-0 pt-0.5" />
                    <span>
                      <span className="text-fg">{a.action}.</span>{" "}
                      <span className="text-muted">{replaceTickers(a.rationale)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link
            to="/research"
            className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:opacity-80"
          >
            Overnight-Desk öffnen <ArrowUpRight className="size-4" />
          </Link>
        </Panel>

        <Panel className="enter-up enter-up-3 lg:col-span-2">
          <Kicker>Research-Bots</Kicker>
          <ul className="mt-3 divide-y divide-border">
            {researchBots.map((b) => (
              <li key={b.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <StatusDot status={running && b.status === "running" ? "running" : b.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-fg">{b.name}</p>
                    <p className="text-2xs text-subtle">{b.vertical}</p>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{replaceTickers(b.summary)}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-border pt-3">
            <Kicker>Feedback-Team</Kicker>
            <ul className="mt-2 space-y-2">
              {feedbackBots.map((b) => (
                <li key={b.id} className="flex items-center gap-2 text-sm">
                  <StatusDot status={b.status} />
                  <span className="text-fg">{b.name}</span>
                  <span className="text-2xs text-subtle">{b.vertical}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/feedback"
              className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:opacity-80"
            >
              Weekly öffnen <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </Panel>
      </div>

      {weekly && (
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Kicker>Weekly · Forge / Gauge / Canon</Kicker>
              <h2 className="mt-1 font-display text-2xl text-fg">{weekly.title}</h2>
              <p className="mt-1 text-xs text-muted">{formatEt(weekly.deliveredAt)}</p>
            </div>
            <Badge tone={view.pnlUsd >= 0 ? "long" : "warn"}>
              {formatUsd(view.pnlUsd)} vs Start
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-fg/90">{replaceTickers(weekly.lede)}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {weekly.feedback.map((f) => (
              <li key={f.bot} className="rounded-lg bg-elevated p-3">
                <p className="text-2xs font-medium tracking-[0.14em] text-muted uppercase">{f.bot}</p>
                <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-fg/85">{replaceTickers(f.body)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Inklusion: {(weekly.inclusion ?? []).filter((i) => i.status === "applied").length} umgesetzt,{" "}
            {(weekly.inclusion ?? []).filter((i) => i.status !== "applied").length} offen.
            {weekly.proposals?.length
              ? ` Profile: ${weekly.proposals.filter((p) => p.status === "discuss").length} in Diskussion.`
              : ""}
          </p>
          {weekly.dual && (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              <li className="rounded-lg bg-elevated p-3">
                <p className="text-2xs tracking-[0.14em] text-muted uppercase">Cash jetzt</p>
                <p className="mt-1 text-xs leading-relaxed text-fg/85">{replaceTickers(weekly.dual.cashNote)}</p>
              </li>
              <li className="rounded-lg bg-elevated p-3">
                <p className="text-2xs tracking-[0.14em] text-muted uppercase">Kapital</p>
                <p className="mt-1 text-xs leading-relaxed text-fg/85">{replaceTickers(weekly.dual.capitalNote)}</p>
              </li>
            </ul>
          )}
        </Panel>
      )}

      <Panel className="enter-up enter-up-4 overflow-hidden p-0">
        <div className="flex items-center justify-between px-4 py-3 sm:px-5">
          <Kicker>Floor · gemeinsamer Channel</Kicker>
          <Link
            to="/chat"
            className="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:opacity-80"
          >
            Chat öffnen <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <ul className="divide-y divide-border">
          {floorTape.map((m) => (
            <li key={m.id} className="flex gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm text-fg">
                  <span className="font-medium">{floorName(m.author)}</span>
                  <span className="text-muted"> · {replaceTickers(m.text)}</span>
                </p>
              </div>
              <p className="shrink-0 font-mono text-2xs tabular-nums text-subtle">{formatEt(m.ts)}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="enter-up enter-up-4 overflow-hidden p-0">
        <div className="flex items-center justify-between px-4 py-3 sm:px-5">
          <Kicker>Alert-Tape</Kicker>
          <span className="text-2xs text-subtle">Materiell · Beobachten · Info</span>
        </div>
        <ul className="divide-y divide-border">
          {alerts.slice(0, 6).map((a) => (
            <li key={a.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
              <div className="flex items-center gap-2 sm:w-40 sm:shrink-0">
                <SeverityBadge severity={a.severity} />
                {a.ticker && <TickerMark symbol={a.ticker} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-fg">{replaceTickers(a.headline)}</p>
                <p className="text-xs text-muted">{replaceTickers(a.body)}</p>
              </div>
              <p className="font-mono text-2xs tabular-nums text-subtle sm:w-28 sm:text-right">
                {formatEt(a.ts)}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="enter-up enter-up-5 overflow-x-auto p-0">
        <div className="px-4 py-3 sm:px-5">
          <Kicker>Aktives Book</Kicker>
        </div>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-2xs tracking-[0.12em] text-muted uppercase">
            <tr className="border-y border-border">
              <th className="px-4 py-2 font-medium sm:px-5">Name</th>
              <th className="px-3 py-2 font-medium">Sektor</th>
              <th className="px-3 py-2 text-right font-medium">Kurs</th>
              <th className="px-4 py-2 text-right font-medium sm:px-5">Tag</th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((t) => (
              <tr key={t.symbol} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 sm:px-5">
                  <TickerMark symbol={t.symbol} />
                </td>
                <td className="px-3 py-2.5 text-muted">{t.sector}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatUsd(t.last)}</td>
                <td className="px-4 py-2.5 text-right sm:px-5">
                  <Pct value={t.changePct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-3 text-2xs text-subtle sm:px-5">
          Zuletzt {formatPct(watchlist.reduce((a, t) => a + t.changePct, 0) / watchlist.length)} im Schnitt. 15 Namen,
          Lasts vom Tape. Coverage-Universum bleibt über Nacht bei hundert Namen.
        </p>
      </Panel>
    </div>
  );
}
