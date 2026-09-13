import { useMemo } from "react";
import { useVesperStore } from "@/lib/vesper/store";
import { cn } from "@/lib/utils";
import type { VesperPhase, VesperStatus } from "@/lib/vesper/types";

const CX = 240;
const CY = 240;

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: Number((CX + r * Math.cos(a)).toFixed(2)), y: Number((CY + r * Math.sin(a)).toFixed(2)) };
}

function arcPath(r: number, startDeg: number, sweepDeg: number) {
  const s = polar(r, startDeg);
  const e = polar(r, startDeg + sweepDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

const OUTER = [0, 90, 180, 270].map((start) => arcPath(208, start + 8, 74));
const MID = [45, 135, 225, 315].map((start) => arcPath(176, start + 6, 48));
const INNER = [0, 120, 240].map((start) => arcPath(124, start, 72));
const PARTICLES = Array.from({ length: 8 }, (_, i) => polar(152, i * 45));

const PHASE_LABEL: Record<VesperPhase, string> = {
  ready: "Bereit",
  listening: "Hört zu",
  understanding: "Versteht",
  analyzing: "Prüft",
  opening: "Öffnet",
  marking: "Markiert",
  speaking: "Spricht",
  warning: "Achtung",
};

function phaseOf(status: VesperStatus, micOn: boolean, blocked: boolean, storePhase?: VesperPhase): VesperPhase {
  if (blocked) return "warning";
  if (micOn || status === "listening") return "listening";
  if (storePhase && storePhase !== "ready") return storePhase;
  if (status === "speaking") return "speaking";
  if (status === "thinking") return "analyzing";
  if (status === "executing") return "opening";
  return "ready";
}

export function VesperCore({
  status,
  micOn,
  blocked,
  onClick,
  size = "lg",
  caption = true,
}: {
  status: VesperStatus;
  micOn: boolean;
  blocked?: boolean;
  onClick: () => void;
  size?: "lg" | "md" | "sm";
  caption?: boolean;
}) {
  const level = useVesperStore((s) => s.micLevel);
  const storePhase = useVesperStore((s) => s.phase);
  const phase = phaseOf(status, micOn, Boolean(blocked), storePhase);
  const dim = size === "lg" ? "size-[20rem] sm:size-[24rem]" : size === "md" ? "size-20" : "size-11";
  const tickScale = useMemo(() => (phase === "listening" ? 1 + Math.min(0.12, level * 1.8) : 1), [phase, level]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={blocked ? "Mikrofon nicht verfügbar" : PHASE_LABEL[phase]}
      aria-pressed={micOn}
      data-state={phase}
      data-vesper="vesper.core"
      className={cn("vesper-core relative mx-auto flex items-center justify-center", dim)}
      style={{ ["--vesper-mic" as string]: String(tickScale) }}
    >
      <svg viewBox="0 0 480 480" className="vesper-core-svg h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="vesper-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="48%" stopColor="currentColor" stopOpacity="0.06" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="vesper-disc" cx="50%" cy="38%" r="62%">
            <stop offset="0%" stopColor="var(--color-elevated)" />
            <stop offset="100%" stopColor="var(--color-surface)" />
          </radialGradient>
        </defs>

        <circle className="vesper-glow" cx={CX} cy={CY} r="228" fill="url(#vesper-glow)" />
        <circle cx={CX} cy={CY} r="214" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.22" />
        <circle cx={CX} cy={CY} r="164" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.18" />
        <circle cx={CX} cy={CY} r="96" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.16" />

        <g className="vesper-ticks">
          {OUTER.map((d, i) => (
            <path key={`o${i}`} d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
          ))}
        </g>
        <g className="vesper-mid">
          {MID.map((d, i) => (
            <path key={`m${i}`} d={d} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.38" />
          ))}
        </g>
        <g className="vesper-spin">
          {INNER.map((d, i) => (
            <path key={`i${i}`} d={d} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" opacity="0.72" />
          ))}
        </g>
        <g className="vesper-orbit">
          {PARTICLES.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i % 2 === 0 ? 1.7 : 1.1} fill="currentColor" opacity={i % 2 === 0 ? 0.65 : 0.32} />
          ))}
        </g>
        <path className="vesper-sweep" d={arcPath(176, -18, 40)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

        <circle className="vesper-disc-ring" cx={CX} cy={CY} r="70" fill="url(#vesper-disc)" stroke="currentColor" strokeWidth="1" />
        <path
          d="M 218 220 L 240 258 L 262 220"
          fill="none"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="vesper-letter"
        />
      </svg>
      {caption && size === "lg" ? (
        <span
          className={cn(
            "absolute -bottom-9 left-1/2 z-10 w-max -translate-x-1/2 text-2xs tracking-[0.2em] text-muted uppercase",
            phase === "listening" && "text-long",
            (phase === "speaking" || phase === "opening" || phase === "marking") && "text-fg",
            phase === "warning" && "text-short",
          )}
        >
          {blocked ? "Kein Mikrofon" : PHASE_LABEL[phase]}
        </span>
      ) : null}
    </button>
  );
}
