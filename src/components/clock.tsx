import { useEffect, useState } from "react";
import { formatEtDate, formatEtTime, nyseStatus } from "@/lib/format";

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  if (!now) {
    return <div className="h-4 w-28 rounded-sm bg-elevated" aria-hidden />;
  }
  const nyse = nyseStatus(now);
  return (
    <div className="flex flex-col gap-0.5 font-mono text-xs tabular-nums text-muted">
      <div className="flex items-baseline gap-2">
        <span>{formatEtDate(now)}</span>
        <span className="text-fg">{formatEtTime(now)} MET</span>
      </div>
      <span className="text-2xs text-subtle">
        {nyse.label} · {nyse.next}
      </span>
    </div>
  );
}
