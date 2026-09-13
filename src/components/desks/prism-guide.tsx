import { Kicker, Panel } from "@/components/shared";

export function ColorLegend() {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-muted">
      <li className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-long" />
        Grün = gestiegen / verdient
      </li>
      <li className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-short" />
        Rot = gefallen / verloren
      </li>
      <li className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-primary" />
        Hell = Kern, den wir halten
      </li>
      <li className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-warn" />
        Amber = Achtung, noch kein Abbruch
      </li>
    </ul>
  );
}

export function PrismGuide() {
  return (
    <Panel className="enter-up">
      <Kicker>Prism · So liest du den Desk</Kicker>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        Drei Zahlen, sonst nichts. Der Rest ist Erklärung. Klick auf einen Chart-Punkt — dann kommt der Tag in
        Stichpunkten, ohne Fachchinesisch. Beispiel: 29. Juli 2026, US-Aktienkorb gefallen.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        <li className="rounded-lg bg-elevated p-3">
          <p className="text-2xs tracking-[0.14em] text-muted uppercase">1 · Einsatz</p>
          <p className="mt-1 font-display text-2xl text-fg">300 $</p>
          <p className="mt-1 text-xs text-muted">Testlauf. Paper, kein Konto.</p>
        </li>
        <li className="rounded-lg bg-elevated p-3">
          <p className="text-2xs tracking-[0.14em] text-muted uppercase">2 · Regel</p>
          <p className="mt-1 font-display text-2xl text-fg">Kauf / Verkauf</p>
          <p className="mt-1 text-xs text-muted">Mitnehmen, Cash, wieder kaufen. Gewinn bleibt im Book.</p>
        </li>
        <li className="rounded-lg bg-elevated p-3">
          <p className="text-2xs tracking-[0.14em] text-muted uppercase">3 · Kern</p>
          <p className="mt-1 font-display text-2xl text-fg">US-Aktienkorb</p>
          <p className="mt-1 text-xs text-muted">Der große US-Markt. Fällt er, fällt oft alles. Deshalb der Maßstab.</p>
        </li>
      </ul>
      <div className="mt-4">
        <ColorLegend />
      </div>
    </Panel>
  );
}
