import { useVesperStore } from "@/lib/vesper/store";
import { cn } from "@/lib/utils";

export function MicMeter({ className }: { className?: string }) {
  const level = useVesperStore((s) => s.micLevel);
  const micOn = useVesperStore((s) => s.micOn);
  const bars = 8;
  return (
    <div className={cn("flex h-8 items-end gap-0.5", className)} aria-hidden>
      {Array.from({ length: bars }, (_, i) => {
        const threshold = (i + 1) / bars;
        const on = micOn && level > threshold * 0.12;
        return (
          <span
            key={i}
            className={cn(
              "h-7 w-1 origin-bottom rounded-sm transition-[transform,background-color] duration-75",
              on ? "bg-long" : "bg-elevated",
            )}
            style={{ transform: `scaleY(${0.28 + i * 0.09})` }}
          />
        );
      })}
    </div>
  );
}
