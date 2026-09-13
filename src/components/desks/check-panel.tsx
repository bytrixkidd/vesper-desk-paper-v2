import { Kicker, Panel } from "@/components/shared";
import { CFG_VERSION } from "@/lib/config";
import { checkSnapshot } from "@/lib/check";
import { formatUsd } from "@/lib/format";
import { RUNTIME_NOTE } from "@/lib/roles";
import { useDeskStore } from "@/lib/store";

export function CheckPanel() {
  const tickCount = useDeskStore((s) => s.tickCount);
  const lastTick = useDeskStore((s) => s.lastTick);
  const fills = useDeskStore((s) => s.fills);
  const watch = useDeskStore((s) => s.watch);
  const bookIndex = useDeskStore((s) => s.bookIndex);
  const snap = checkSnapshot();

  return (
    <Panel className="enter-up" data-vesper="check.panel">
      <Kicker>CHECK · {CFG_VERSION} · Paper only</Kicker>
      <h2 className="mt-1 font-display text-2xl text-fg">Bestand, nicht Behauptung</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        Aktives Book {snap.bookId}, Experiment {snap.experimentId}. Autopilot-Takt {tickCount}
        {lastTick ? `, zuletzt ${new Date(lastTick).toLocaleString("de-DE")}` : ""}. Journal {fills.length} Zeilen.
        Watch {watch ? watch.label : "fehlt"}. {RUNTIME_NOTE}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-elevated p-3">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Guthaben gesamt</p>
          <p className="mt-1 font-display text-xl tabular-nums text-fg">{formatUsd(snap.cash.totalUsd)}</p>
        </div>
        <div className="rounded-lg bg-elevated p-3">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Reserviert</p>
          <p className="mt-1 font-display text-xl tabular-nums text-fg">{formatUsd(snap.cash.reservedUsd)}</p>
          <p className="mt-1 text-xs text-muted">Offene Kauforders</p>
        </div>
        <div className="rounded-lg bg-elevated p-3">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Verfügbar</p>
          <p className="mt-1 font-display text-xl tabular-nums text-fg">{formatUsd(snap.cash.availableUsd)}</p>
          <p className="mt-1 text-xs text-muted">Darf liegen. Kein Kaufzwang.</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        Tatsächliches Aktiengewicht {snap.equityWeightPct.toFixed(1)} %. Bei leerem Depot ist das null, unabhängig vom Soll.
      </p>
      {snap.lock ? <p className="mt-2 text-sm text-short">{snap.lock}</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Bestand (Ist)</p>
          {snap.holdings.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Keine Stücke. Aktiengewicht 0 %.</p>
          ) : (
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {snap.holdings.map((h) => (
                <li key={h.ticker} className="rounded-md bg-elevated px-3 py-2">
                  {h.name} ({h.ticker}) · {h.shares.toFixed(4)} · Ist {h.actualWeightPct.toFixed(1)} %
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Zielgewichte (Soll, nicht Bestand)</p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-muted">
            {snap.targets.slice(0, 8).map((t) => (
              <li key={t.ticker} className="rounded-md bg-elevated px-3 py-2">
                {t.name} ({t.ticker}) Soll {t.targetWeightPct.toFixed(1)} %
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-2xs tracking-[0.12em] text-muted uppercase">Offene Orders</p>
        {snap.openOrders.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Keine offenen Orders.</p>
        ) : (
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {snap.openOrders.map((f) => (
              <li key={f.id} className="rounded-md bg-elevated px-3 py-2">
                {f.status} {f.side} {f.symbol} {f.shares.toFixed(4)} · entschieden {f.decidedAt}
                {f.dataAsOf ? ` · Daten ${f.dataAsOf}` : ""} {f.priceAsOf ? ` · Kurs ${f.priceAsOf}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <p className="text-2xs tracking-[0.12em] text-muted uppercase">Chancen (höchstens drei)</p>
        {snap.chances.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Keine S1/S2-Chance. S3 inaktiv. S0-Kern nicht automatisch.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {snap.chances.map((c) => (
              <li key={c.ticker} className="rounded-md bg-elevated px-3 py-2">
                {c.name} ({c.ticker}): {c.hyp}. Gegenargument: {c.against}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 rounded-lg bg-elevated p-3">
        <p className="text-2xs tracking-[0.12em] text-muted uppercase">Goldman Sachs</p>
        <p className="mt-1 text-sm text-fg">{snap.goldman.note}</p>
        <p className="mt-1 text-xs text-muted">
          {snap.goldman.exists
            ? `Status ${snap.goldman.status}. Geplant ${snap.goldman.plannedUsd?.toFixed(2) ?? "—"} $. Ausführbar: ${snap.goldman.executable ? "ja" : "nein"}.`
            : "Keine persistierte Order in diesem Book."}{" "}
          {snap.goldman.basis}
        </p>
      </div>

      {bookIndex ? (
        <div className="mt-4">
          <p className="text-2xs tracking-[0.12em] text-muted uppercase">Depots</p>
          <ul className="mt-2 space-y-2 text-xs leading-relaxed">
            {snap.books.map((b) => (
              <li key={b.bookId} className="rounded-md bg-elevated px-3 py-2">
                <span className="font-medium text-fg">{b.role === "active" ? "Aktiv" : "Archiv"}</span> {b.bookId} / {b.experimentId}.
                Historie {b.historyStatus}. {b.historyNote}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-muted">{snap.plan}</p>
      <p className="mt-1 text-xs text-muted">{snap.identityLine}</p>
    </Panel>
  );
}
