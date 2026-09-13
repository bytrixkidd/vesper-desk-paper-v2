import { Area, Bar as VolumeBar, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RANGE_OPTIONS, type ChartRange, rangeLabel } from "@/lib/charts";
import { formatCompact, formatEtDate, formatUsd } from "@/lib/format";
import type { Bar } from "@/lib/types";
import { Button } from "@/components/ui/button";

type Point = { t: string; iso: string; c: number; v: number };

function tickLabel(iso: string, count: number) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (count <= 10) return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric" });
  if (count <= 40) return d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
  if (count <= 90) return d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
  if (count <= 400) return d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("de-DE", { year: "numeric" });
}

export function HorizonButtons({
  value,
  onChange,
}: {
  value: ChartRange;
  onChange: (range: ChartRange) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Zeitraum">
      {RANGE_OPTIONS.map((r) => (
        <Button
          key={r.id}
          size="sm"
          variant={value === r.id ? "default" : "ghost"}
          data-vesper={r.target}
          className="min-h-11 px-3"
          onClick={() => onChange(r.id)}
        >
          {r.label}
        </Button>
      ))}
    </div>
  );
}

export function TapeChart({
  bars,
  height = 280,
  id = "tape",
  selectedIso,
  onSelect,
  showVolume = true,
  horizon,
}: {
  bars: Bar[];
  height?: number;
  id?: string;
  selectedIso?: string | null;
  onSelect?: (bar: Bar) => void;
  showVolume?: boolean;
  horizon?: ChartRange;
}) {
  const data: Point[] = bars.map((b) => ({
    t: formatEtDate(b.t),
    iso: b.t.slice(0, 10),
    c: b.c,
    v: b.v,
  }));
  const up = (bars.at(-1)?.c ?? 0) >= (bars[0]?.o ?? bars[0]?.c ?? 0);
  const stroke = up ? "var(--color-long)" : "var(--color-short)";
  const gid = `fill-${id}`;
  const selected = selectedIso?.slice(0, 10);
  const count = data.length;
  const start = bars[0]?.c ?? 0;
  const firstIso = data[0]?.iso;
  const lastIso = data.at(-1)?.iso;
  const priceH = showVolume ? Math.round(height * 0.78) : height;
  const volH = Math.max(56, height - priceH);

  function choose(iso?: string) {
    if (!iso || !onSelect) return;
    const bar = bars.find((b) => b.t.slice(0, 10) === iso);
    if (bar) onSelect(bar);
  }

  if (bars.length < 2) {
    return <p className="py-16 text-center text-sm text-muted">Verlauf wird geladen…</p>;
  }

  return (
    <div className="w-full">
      <div style={{ height: priceH }} className={onSelect ? "w-full cursor-pointer" : "w-full"}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            onClick={(state) => {
              const iso = (state?.activePayload?.[0]?.payload as Point | undefined)?.iso;
              choose(iso);
            }}
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="iso" hide={showVolume} tick={{ fill: "var(--color-muted)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={36} tickFormatter={(iso: string) => tickLabel(iso, count)} />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "var(--color-muted)", fontSize: 11, fontFamily: "IBM Plex Mono" }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v: number) => (v >= 1000 ? formatCompact(v) : v.toFixed(v >= 100 ? 0 : 1))}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-border-strong)", strokeWidth: 1 }}
              contentStyle={{
                background: "var(--color-elevated)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: 8,
                color: "var(--color-fg)",
              }}
              formatter={(value, name) => {
                const n = typeof value === "number" ? value : Number(value);
                if (name === "v") return [formatCompact(n), "Umsatz"];
                return [Number.isFinite(n) ? formatUsd(n) : String(value ?? ""), "Kurs"];
              }}
              labelFormatter={(label) => {
                const pretty = formatEtDate(String(label));
                return onSelect ? `${pretty} · Punkt antippen` : pretty;
              }}
            />
            {start > 0 ? <ReferenceLine y={start} stroke="var(--color-subtle)" strokeDasharray="3 6" strokeOpacity={0.7} /> : null}
            {selected ? <ReferenceLine x={selected} stroke="var(--color-primary)" strokeDasharray="4 4" strokeOpacity={0.5} /> : null}
            <Area type="monotone" dataKey="c" stroke={stroke} fill={`url(#${gid})`} strokeWidth={1.7} dot={false} activeDot={{ r: 4, stroke: "var(--color-fg)", strokeWidth: 1.5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {showVolume ? (
        <div style={{ height: volH }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
              onClick={(state) => {
                const iso = (state?.activePayload?.[0]?.payload as Point | undefined)?.iso;
                choose(iso);
              }}
            >
              <XAxis
                dataKey="iso"
                tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={36}
                tickFormatter={(iso: string) => tickLabel(iso, count)}
              />
              <YAxis hide domain={[0, "auto"]} width={56} />
              <Tooltip
                cursor={{ fill: "var(--color-border)" }}
                contentStyle={{
                  background: "var(--color-elevated)",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: 8,
                  color: "var(--color-fg)",
                }}
                formatter={(value) => {
                  const n = typeof value === "number" ? value : Number(value);
                  return [formatCompact(n), "Umsatz"];
                }}
                labelFormatter={(label) => formatEtDate(String(label))}
              />
              {selected ? <ReferenceLine x={selected} stroke="var(--color-primary)" strokeDasharray="4 4" strokeOpacity={0.5} /> : null}
              <VolumeBar dataKey="v" fill={stroke} fillOpacity={0.35} radius={[1, 1, 0, 0]} maxBarSize={8} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-2xs text-subtle">
        <p>
          {firstIso && lastIso ? `${formatEtDate(firstIso)} – ${formatEtDate(lastIso)}` : null}
          {horizon ? ` · ${rangeLabel(horizon)}` : ""}
        </p>
        {onSelect ? <p>Punkt antippen für den Tag</p> : null}
      </div>
    </div>
  );
}

export function Spark({ bars, id }: { bars: Bar[]; id: string }) {
  const data = bars.map((b) => ({ c: b.c }));
  const up = (bars.at(-1)?.c ?? 0) >= (bars[0]?.c ?? 0);
  const stroke = up ? "var(--color-long)" : "var(--color-short)";
  const gid = `sp-${id}`;
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="c" stroke={stroke} fill={`url(#${gid})`} strokeWidth={1.25} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
