import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { ACTION_LABEL, formatShares } from "@/lib/format";
import { FUNDS, WHALES } from "@/lib/seed";
import { useDeskStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentNote, Kicker, Panel, TickerMark } from "@/components/shared";
import type { WhaleAction } from "@/lib/types";

const ACTION_TONE: Record<WhaleAction, "sage" | "long" | "short" | "warn" | "default"> = {
  new: "sage",
  add: "long",
  trim: "warn",
  exit: "short",
  hold: "default",
};

export function FlowsDesk() {
  const runAgent = useDeskStore((s) => s.runAgent);
  const [fund, setFund] = useState<(typeof FUNDS)[number] | "All">("All");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const rows = useMemo(() => (fund === "All" ? WHALES : WHALES.filter((w) => w.fund === fund)), [fund]);

  const clusters = useMemo(() => {
    const byTicker = new Map<string, typeof WHALES>();
    for (const w of WHALES) {
      if (w.action === "add" || w.action === "new") {
        const list = byTicker.get(w.ticker) ?? [];
        list.push(w);
        byTicker.set(w.ticker, list);
      }
    }
    return [...byTicker.entries()]
      .filter(([, v]) => v.length >= 2)
      .sort((a, b) => b[1].length - a[1].length);
  }, []);

  const chart = rows
    .filter((r) => r.action !== "hold")
    .slice()
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 8)
    .map((r) => ({
      name: `${r.ticker} ${r.fund.split(" ")[0].slice(0, 3)}`,
      pct: r.changePct,
    }));

  async function analyze() {
    setBusy(true);
    const text = await runAgent(
      "flows",
      `Interpretiere den aktuellen 13F-Flow für ${fund === "All" ? "Bridgewater, Renaissance, Citadel, Two Sigma, Third Point, Tiger Global, D.E. Shaw und Millennium" : fund}. Watchlist: NVDA AAPL MSFT AMZN META TSLA GOOGL AVGO JPM LLY UNH GS. Hebe neue Initiationen, Positionszuwächse über 25 % und vollständige Exits hervor. Cluster-Buy-Literatur (Cohen, Malloy, Pomorski), wenn drei oder mehr Fonds übereinstimmen.`,
    );
    setBusy(false);
    if (text) {
      setNote(text);
      toast("Whale-Tracker hat eine Flow-Notiz abgelegt.");
    } else toast("Flow-Agent erreicht das Modell nicht.");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Kicker>13F-Whale-Tracker</Kicker>
          <h1 className="text-3xl text-fg sm:text-4xl">Institutioneller Flow, namentlich.</h1>
          <p className="max-w-2xl text-sm text-muted">
            Bridgewater, Renaissance, Citadel, Two Sigma, Third Point, Tiger Global, D.E. Shaw, Millennium. Neue
            Initiationen, Adds über fünfundzwanzig Prozent, vollständige Exits. Cluster-Buying hat historisch 5,3 %
            annualisierte Alpha generiert.
          </p>
        </div>
        <Button onClick={() => void analyze()} disabled={busy}>
          {busy ? "Lese 13Fs…" : "Flow interpretieren"}
        </Button>
      </header>

      <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1">
        <Button size="sm" className="shrink-0" variant={fund === "All" ? "default" : "ghost"} onClick={() => setFund("All")}>
          Alle Fonds
        </Button>
        {FUNDS.map((f) => (
          <Button
            key={f}
            size="sm"
            className="shrink-0"
            variant={fund === f ? "default" : "ghost"}
            onClick={() => setFund(f)}
          >
            {f.replace(" Associates", "").replace(" Advisors", "").replace(" Management", "")}
          </Button>
        ))}
      </div>

      {clusters.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {clusters.map(([ticker, list]) => (
            <Panel key={ticker} className="p-4" data-vesper={`flow-${ticker}`}>
              <div className="flex items-center justify-between">
                <TickerMark symbol={ticker} />
                <Badge tone="sage">Cluster · {list.length}</Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {list.map((w) => `${w.fund.split(" ")[0]} ${w.changePct.toFixed(0)}%`).join(" · ")}
              </p>
            </Panel>
          ))}
        </div>
      )}

      {chart.length > 0 && (
        <Panel className="h-80">
          <Kicker>Größte Positionsänderungen %</Kicker>
          <div className="mt-2 h-[calc(100%-1.25rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="rgba(230,228,223,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#8a8f8b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={88}
                  tick={{ fill: "#e6e4df", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                  axisLine={false}
                  tickLine={false}
                />
                <RTooltip
                  contentStyle={{ background: "#181b1d", border: "1px solid rgba(230,228,223,0.12)", borderRadius: 8, color: "#e6e4df" }}
                />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                  {chart.map((e) => (
                    <Cell key={e.name} fill={e.pct >= 0 ? "#5aa07a" : "#c45c4e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      <Panel className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-2xs tracking-[0.12em] text-muted uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 font-medium sm:px-5">Fonds</th>
              <th className="px-3 py-2.5 font-medium">Ticker</th>
              <th className="px-3 py-2.5 text-right font-medium">Stück</th>
              <th className="px-3 py-2.5 text-right font-medium">Vorperiode</th>
              <th className="px-3 py-2.5 text-right font-medium">Wert</th>
              <th className="px-3 py-2.5 text-right font-medium">Δ</th>
              <th className="px-4 py-2.5 text-right font-medium sm:px-5">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-fg sm:px-5">{w.fund}</td>
                <td className="px-3 py-2.5">
                  <TickerMark symbol={w.ticker} />
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatShares(w.shares)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted">
                  {formatShares(w.priorShares)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">${w.valueMm.toFixed(0)}mm</td>
                <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${w.changePct >= 0 ? "text-long" : "text-short"}`}>
                  {w.changePct > 0 ? "+" : ""}
                  {w.changePct.toFixed(1)}%
                </td>
                <td className="px-4 py-2.5 text-right sm:px-5">
                  <Badge tone={ACTION_TONE[w.action]}>{ACTION_LABEL[w.action]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {note && (
        <Panel>
          <Kicker>Flow-Notiz</Kicker>
          <div className="mt-3">
            <AgentNote text={note} />
          </div>
        </Panel>
      )}
    </div>
  );
}
