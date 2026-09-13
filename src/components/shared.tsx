import type { ReactNode } from "react";
import { displayName, replaceTickers } from "@/lib/names";
import { cn } from "@/lib/utils";

import { SEVERITY_LABEL, signedClass } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5", className)}>
      {children}
    </section>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="text-2xs font-medium tracking-[0.16em] text-muted uppercase">{children}</p>
  );
}

export function TickerMark({ symbol, className }: { symbol: string; className?: string }) {
  return (
    <span className={cn("text-sm font-medium text-fg", className)}>
      {displayName(symbol)}
      <span className="ml-1.5 font-mono text-2xs text-muted">{symbol}</span>
    </span>
  );
}

export function Pct({ value, className }: { value: number; className?: string }) {
  const sign = value > 0 ? "+" : "";
  return (
    <span className={cn("font-mono tabular-nums", signedClass(value), className)}>
      {sign}
      {value.toFixed(1)}%
    </span>
  );
}

export function StatusDot({ status }: { status: "idle" | "running" | "done" | "alert" }) {
  const color =
    status === "running"
      ? "bg-warn pulse-dot"
      : status === "alert"
        ? "bg-short"
        : status === "done"
          ? "bg-long"
          : "bg-subtle";
  return <span className={cn("inline-block size-1.5 rounded-full", color)} aria-hidden />;
}

export function SeverityBadge({ severity }: { severity: "info" | "watch" | "material" }) {
  return <Badge tone={severity}>{SEVERITY_LABEL[severity]}</Badge>;
}

export function ToneBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(((value + 1) / 2) * 100);
  const color = value > 0.15 ? "text-long" : value < -0.15 ? "text-short" : "text-muted";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted">{label}</span>
        <span className={cn("font-mono text-xs tabular-nums", color)}>
          {value > 0 ? "+" : ""}
          {value.toFixed(2)}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-elevated">
        <div
          className={cn("h-full rounded-full", value >= 0 ? "bg-long" : "bg-short")}
          style={{ width: `${Math.max(8, pct)}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted">{children}</p>;
}

export function AgentNote({ text }: { text: string }) {
  const blocks = replaceTickers(text).split(/\n{2,}/).filter(Boolean);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-fg/90">
      {blocks.map((b, i) => {
        const heading = /^(filings|earnings|sentiment|flows|macro|actions|insider|sector|coordination|aktionen|sektor|koordination|makro|strategie|weekly|forge|gauge|canon|inklusion|post-mortem|effizienz)[:.\s-]/i.test(
          b.split("\n")[0] ?? "",
        );
        if (heading) {
          const [h, ...rest] = b.split("\n");
          return (
            <div key={i}>
              <p className="mb-1 text-2xs font-medium tracking-[0.14em] text-muted uppercase">{h}</p>
              <p className="whitespace-pre-wrap">{rest.join("\n")}</p>
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {b}
          </p>
        );
      })}
    </div>
  );
}
