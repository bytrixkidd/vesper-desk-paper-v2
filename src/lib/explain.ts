import { notesFor } from "@/lib/seed-notes";
import { displayName, replaceTickers } from "@/lib/names";
import type { Bar, DemoStandup, DemoWeek, TapeReading, TapeTone } from "@/lib/types";

export function barDate(bar: Bar) {
  return bar.t.slice(0, 10);
}

function toneOf(pct: number): TapeTone {
  if (pct > 0.15) return "up";
  if (pct < -0.15) return "down";
  return "flat";
}

function germanDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1)).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function changePct(bar: Bar, prev?: Bar) {
  const base = prev?.c ?? bar.o;
  if (!base) return 0;
  return ((bar.c - base) / base) * 100;
}

export function explainPoint(args: {
  symbol: string;
  name?: string;
  bar: Bar;
  prev?: Bar;
  spyBar?: Bar;
  spyPrev?: Bar;
}): TapeReading {
  const date = barDate(args.bar);
  const pct = changePct(args.bar, args.prev);
  const tone = toneOf(pct);
  const name = displayName(args.symbol, args.name);
  const seed = notesFor(date, args.symbol);
  const spyPct = args.spyBar ? changePct(args.spyBar, args.spyPrev) : null;
  const label = germanDate(date);
  const signed = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)} %`;

  if (seed && seed.tone === tone) {
    return {
      date,
      symbol: args.symbol,
      changePct: pct,
      headline: replaceTickers(seed.headline),
      bullets: seed.bullets.map(replaceTickers),
      source: "seed",
      tone,
    };
  }

  const bullets: string[] = [];
  if (tone === "down") {
    bullets.push(`${name} ist an diesem Tag ${signed} gefallen. Rot im Chart = der Schlusskurs liegt unter dem Vortag.`);
    bullets.push("Fallen heißt nicht automatisch verkaufen. Ein Tag ist Rauschen, ein Trend braucht mehrere Tage.");
  } else if (tone === "up") {
    bullets.push(`${name} ist an diesem Tag ${signed} gestiegen. Grün = Schlusskurs über dem Vortag.`);
    bullets.push("Steigen heißt nicht automatisch nachkaufen. Erst prüfen, ob es den 300-Dollar-Test wirklich füllt.");
  } else {
    bullets.push(`${name} hat sich kaum bewegt (${signed}). Flache Tage sind oft die ehrlichen.`);
  }

  if (spyPct != null && args.symbol !== "SPY") {
    const vs = pct - spyPct;
    if (vs > 0.3) bullets.push(`Stärker als der große US-Aktienkorb (${spyPct >= 0 ? "plus" : "minus"} ${Math.abs(spyPct).toFixed(1)} Prozent).`);
    else if (vs < -0.3) bullets.push(`Schwächer als der große US-Aktienkorb (${spyPct >= 0 ? "plus" : "minus"} ${Math.abs(spyPct).toFixed(1)} Prozent). Der Grundstock war der sicherere Platz.`);
    else bullets.push(`Fast gleichauf mit dem großen US-Aktienkorb. Kein Extra verdient, kein Extra verloren.`);
  }

  if (args.symbol === "SPY" || args.symbol === "VOO") {
    bullets.push("Das ist der Grundstock. An schwachen Tagen fassen wir ihn nicht an.");
  }
  if (args.symbol === "BLK") {
    bullets.push("BlackRock verdient an denselben Zuflüssen wie der Index (iShares). Ein Index-Tag färbt oft auch BLK.");
  }

  bullets.push("Klick auf „Mehr Gründe“, wenn du eine aktuelle Einordnung vom Desk willst.");

  const verb = tone === "down" ? "gefallen" : tone === "up" ? "gestiegen" : "seitwärts gelaufen";
  return {
    date,
    symbol: args.symbol,
    changePct: pct,
    headline: `${name} ist am ${label} ${verb}`,
    bullets,
    source: "tape",
    tone,
  };
}

export function pickBar(bars: Bar[], iso?: string | null) {
  if (!bars.length) return { bar: null as Bar | null, prev: undefined as Bar | undefined, index: -1 };
  if (iso) {
    const index = bars.findIndex((b) => barDate(b) === iso.slice(0, 10));
    if (index >= 0) return { bar: bars[index]!, prev: index > 0 ? bars[index - 1] : undefined, index };
  }
  const index = bars.length - 1;
  return { bar: bars[index]!, prev: index > 0 ? bars[index - 1] : undefined, index };
}

export function explainDemoWeek(week: DemoWeek): TapeReading {
  const tone = toneOf(week.relativePct);
  const bullets: string[] = [
    `Spielgeld: Start ${week.startEur.toFixed(2)} €, Ende ${week.navEur.toFixed(2)} €.`,
    `Unser Book ${week.bookPct >= 0 ? "+" : ""}${week.bookPct.toFixed(2)} %. Der große US-Aktienkorb ${week.spyPct >= 0 ? "+" : ""}${week.spyPct.toFixed(2)} %.`,
  ];
  if (week.relativePct >= 0) {
    bullets.push(
      `Grün gegen den Markt: ${week.relativePct.toFixed(2)} Prozentpunkte Vorsprung. In dieser Woche hat die Strategie funktioniert.`,
    );
  } else {
    bullets.push(
      `Rot gegen den Markt: ${Math.abs(week.relativePct).toFixed(2)} Prozentpunkte Rückstand. Das merken wir uns — nicht nachkaufen, Regel lesen.`,
    );
  }
  bullets.push(week.verdict);
  for (const t of week.trades.slice(0, 3)) {
    const sign = t.pnlPct >= 0 ? "+" : "";
    bullets.push(`${t.ticker} ${sign}${t.pnlPct.toFixed(1)} % — ${t.note}`);
  }
  if (week.week === "W31") {
    bullets.push(
      "In dieser Woche liegt der 29. Juli: der große US-Aktienkorb ist an dem einen Tag gefallen. Die Woche insgesamt war trotzdem plus — ein Tag ist kein Monat.",
    );
  }
  return {
    date: week.label,
    symbol: week.week,
    changePct: week.relativePct,
    headline: week.relativePct >= 0 ? `${week.week}: Paper hat den Markt geschlagen` : `${week.week}: Paper hinter dem Markt`,
    bullets,
    source: "tape",
    tone,
  };
}

export function explainWatchDay(standup: DemoStandup): TapeReading {
  const tone = toneOf(standup.relativePct);
  return {
    date: standup.date,
    symbol: `T${standup.day}`,
    changePct: standup.relativePct,
    headline: `Tag ${standup.day}/7 — ${standup.relativePct >= 0 ? "vor dem Markt" : "hinter dem Markt"}`,
    bullets: [
      `Paper steht bei ${standup.navEur.toFixed(2)} € (${standup.bookPct >= 0 ? "+" : ""}${standup.bookPct.toFixed(2)} %).`,
      `Markt ${standup.spyPct >= 0 ? "+" : ""}${standup.spyPct.toFixed(2)} Prozent. Abstand ${standup.relativePct >= 0 ? "+" : ""}${standup.relativePct.toFixed(2)} Prozentpunkte.`,
      standup.note,
      "Grün gegen den Markt = die Quote hat an dem Tag funktioniert. Rot = lernen, nicht nachlegen.",
    ],
    source: "tape",
    tone,
  };
}
