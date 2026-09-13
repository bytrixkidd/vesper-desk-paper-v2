import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alreadyActed,
  applySideCost,
  bookIdentity,
  canSimulateFill,
  dataKey,
  fillExists,
  makeFill,
  riskLock,
  sharesFromNotional,
} from "./ledger.ts";
import { START_USD } from "./config.ts";

describe("paper-v2 buchhaltung", () => {
  it("identität: equity + cash = nav", () => {
    const positions = [
      { ticker: "SPY", shares: 0.1, costUsd: 500, lastUsd: 500, weightPct: 50, sleeve: "core" as const },
    ];
    const cashEur = 100;
    const eurUsd = 1.2;
    const navEur = (0.1 * 500 + cashEur * eurUsd) / eurUsd;
    const ident = bookIdentity({ positions, cashEur, eurUsd, navEur });
    assert.equal(ident.ok, true);
    assert.ok(Math.abs(ident.computedUsd - 170) < 1e-9);
  });

  it("drift sperrt", () => {
    const ident = bookIdentity({
      positions: [{ ticker: "SPY", shares: 1, costUsd: 100, lastUsd: 100, weightPct: 100, sleeve: "core" }],
      cashEur: 0,
      eurUsd: 1,
      navEur: 80,
    });
    assert.equal(ident.ok, false);
    assert.ok(ident.lock);
  });

  it("kosten je seite 10 bp", () => {
    assert.equal(applySideCost(100, "buy"), 100.1);
    assert.equal(applySideCost(100, "sell"), 99.9);
  });

  it("gleicher datakey zählt als bereits gebucht", () => {
    const key = dataKey("2026-09-11", "buy", "SPY");
    const fills = [
      makeFill({
        bookVersion: 1,
        decidedAt: "2026-09-13T08:00:00.000Z",
        filledAt: "2026-09-13T08:00:00.000Z",
        status: "simulated_filled",
        symbol: "SPY",
        side: "buy",
        shares: 0.1,
        priceUsd: 500,
        costUsd: 0.05,
        dataKey: key,
        note: "test",
      }),
    ];
    assert.equal(fillExists(fills, key), true);
    assert.equal(alreadyActed([key], key), true);
    assert.equal(fillExists(fills, dataKey("2026-09-11", "buy", "AAPL")), false);
  });

  it("sonntag live: kein fill zum freitagsschluss", () => {
    const sunday = new Date("2026-09-13T08:00:00.000Z");
    const gate = canSimulateFill({
      market: "closed",
      phase: "live",
      closeDate: "2026-09-11",
      now: sunday,
    });
    assert.equal(gate.ok, false);
    assert.match(gate.reason, /PLANNED|Schluss/i);
  });

  it("replay darf rekonstruieren", () => {
    const gate = canSimulateFill({
      market: "closed",
      phase: "replay",
      closeDate: "2026-09-04",
      now: new Date("2026-09-13T08:00:00.000Z"),
    });
    assert.equal(gate.ok, true);
  });

  it("tagessperre nutzt tagesverlust, nicht den start", () => {
    const lock = riskLock({
      startEur: 256,
      navEur: 255,
      peakEur: 256,
      bookPct: -0.4,
      dayPct: -2.1,
    });
    assert.ok(lock && lock.startsWith("Tagessperre"));
    const none = riskLock({
      startEur: 256,
      navEur: 250,
      peakEur: 256,
      bookPct: -2.3,
      dayPct: -0.2,
    });
    assert.equal(none, null);
  });

  it("stückzahl aus notional inkl. kosten", () => {
    const s = sharesFromNotional(10, 100, "buy");
    assert.equal(s.priceUsd, 100.1);
    assert.equal(s.shares, Math.round((10 / 100.1) * 10_000) / 10_000);
  });

  it("zweimal derselbe eingang bleibt eine buchung", () => {
    const key = dataKey("2026-09-11", "buy", "SPY");
    const a = makeFill({
      bookVersion: 1,
      decidedAt: "t1",
      filledAt: "t1",
      status: "planned",
      symbol: "SPY",
      side: "buy",
      shares: 0.2,
      priceUsd: 500,
      costUsd: 0.1,
      dataKey: key,
      note: "a",
    });
    const b = makeFill({
      bookVersion: 1,
      decidedAt: "t2",
      filledAt: "t2",
      status: "simulated_filled",
      symbol: "SPY",
      side: "buy",
      shares: 0.2,
      priceUsd: 500,
      costUsd: 0.1,
      dataKey: key,
      note: "b",
    });
    assert.equal(fillExists([a], key), true);
    assert.equal(fillExists([a, b], key), true);
    assert.equal(START_USD, 300);
  });
});
