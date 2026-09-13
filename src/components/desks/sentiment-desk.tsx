import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { formatCompact, formatEt } from "@/lib/format";
import { useDeskStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentNote, Kicker, Panel, TickerMark } from "@/components/shared";
import { useVesperFocus } from "@/lib/vesper/use-focus";

export function SentimentDesk() {
  const rows = useDeskStore((s) => s.sentiment);
  const runAgent = useDeskStore((s) => s.runAgent);
  const [selected, setSelected] = useState(rows[0]?.ticker ?? "TSLA");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const active = rows.find((r) => r.ticker === selected) ?? rows[0];

  useVesperFocus((focus) => {
    if (focus.sentimentTicker && rows.some((r) => r.ticker === focus.sentimentTicker)) {
      setSelected(focus.sentimentTicker);
      setNote(null);
    }
  }, [rows]);

  const chart = rows.map((r) => ({
    ticker: r.ticker,
    z: Number(r.zscore.toFixed(2)),
    flag: r.flag,
  }));

  async function refresh() {
    setBusy(true);
    const text = await runAgent(
      "sentiment",
      `Scanne X-Mention-Volumen und Sentiment für ${selected} über die letzten 24 Stunden gegen eine rollierende 30-Tage-Baseline. Flagge, wenn das Volumen drei Standardabweichungen überschreitet. Zitiere die relevantesten Posts.`,
    );
    setBusy(false);
    if (text) {
      setNote(text);
      toast(`Pulse hat ${selected} aktualisiert.`);
    } else toast("Pulse erreicht die X-Suche nicht.");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Kicker>Echtzeit-X-Sentiment</Kicker>
          <h1 className="text-3xl text-fg sm:text-4xl">Volumen gegen das 30-Tage-Tape.</h1>
          <p className="max-w-2xl text-sm text-muted">
            Pulse trackt Mention-Volumen gegen eine rollierende 30-Tage-Baseline im persistenten State. Ticker über
            drei Standardabweichungen werden geflaggt. Da, Engelberg und Gao: Suchvolumen sagt Near-Term-Returns voraus.
          </p>
        </div>
        <Button onClick={() => void refresh()} disabled={busy}>
          {busy ? "Scanne X…" : `${selected} aktualisieren`}
        </Button>
      </header>

      <Panel className="h-80 sm:h-96">
        <Kicker>Z-Score vs. 30-Tage-Baseline</Kicker>
        <div className="mt-2 h-[calc(100%-1.25rem)]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="rgba(230,228,223,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#8a8f8b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="ticker"
                width={52}
                tick={{ fill: "#e6e4df", fontSize: 11, fontFamily: "IBM Plex Mono" }}
                axisLine={false}
                tickLine={false}
              />
              <RTooltip
                cursor={{ fill: "rgba(200,212,204,0.06)" }}
                contentStyle={{
                  background: "#181b1d",
                  border: "1px solid rgba(230,228,223,0.12)",
                  borderRadius: 8,
                  color: "#e6e4df",
                }}
              />
              <Bar dataKey="z" radius={[0, 4, 4, 0]}>
                {chart.map((e) => (
                  <Cell key={e.ticker} fill={e.flag ? "#c45c4e" : "#c8d4cc"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="overflow-x-auto p-0 lg:col-span-3">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-2xs tracking-[0.12em] text-muted uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium sm:px-5">Ticker</th>
                <th className="px-3 py-2.5 text-right font-medium">24h</th>
                <th className="px-3 py-2.5 text-right font-medium">30d-Basis</th>
                <th className="px-3 py-2.5 text-right font-medium">Z</th>
                <th className="px-4 py-2.5 text-right font-medium sm:px-5">Ton</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.ticker}
                  data-vesper={`sent-${r.ticker}`}
                  className={`cursor-pointer border-b border-border last:border-0 ${selected === r.ticker ? "bg-elevated" : "hover:bg-elevated/50"}`}
                  onClick={() => {
                    setSelected(r.ticker);
                    setNote(null);
                  }}
                >
                  <td className="px-4 py-2.5 sm:px-5">
                    <span className="flex items-center gap-2">
                      <TickerMark symbol={r.ticker} />
                      {r.flag && <Badge tone="watch">3σ</Badge>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{formatCompact(r.mentions24h)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted">
                    {formatCompact(r.baseline30d)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {r.zscore > 0 ? "+" : ""}
                    {r.zscore.toFixed(2)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono tabular-nums sm:px-5 ${r.tone < 0 ? "text-short" : "text-long"}`}>
                    {r.tone > 0 ? "+" : ""}
                    {r.tone.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel className="lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <Kicker>Stichprobe · {active.ticker}</Kicker>
            {active.flag && <Badge tone="watch">Geflaggt</Badge>}
          </div>
          {active.posts.length === 0 ? (
            <p className="mt-6 text-sm text-muted">Ruhiges Tape. Keine Posts über dem Filter.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {active.posts.map((p, i) => (
                <li key={i} className="rounded-md bg-elevated p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-xs text-primary">{p.handle}</span>
                    <span className="font-mono text-2xs text-subtle">{formatEt(p.ts)}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg/90">{p.text}</p>
                  <p className="mt-1 font-mono text-2xs text-muted">{formatCompact(p.faves)} Likes</p>
                </li>
              ))}
            </ul>
          )}
          {note && (
            <div className="mt-4 border-t border-border pt-4">
              <Kicker>Pulse · live</Kicker>
              <div className="mt-2">
                <AgentNote text={note} />
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
