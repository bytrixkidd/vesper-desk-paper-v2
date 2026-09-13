import { generateBars } from "@/lib/charts";
import { changePct, explainPoint, pickBar } from "@/lib/explain";
import { DIVIDEND_YIELD, REL_LOSS_CAP, MONTHLY_NET_EUR, sleeveOf } from "@/lib/paper";
import { WHALES } from "@/lib/seed";
import { findUniverse } from "@/lib/seed-universe";
import { useDeskStore } from "@/lib/store";
import type { Bar, EarningsNote, Filing, MacroEvent, SentimentRow, WhalePosition } from "@/lib/types";
import type {
  CheckKind,
  CheckStatus,
  Diagnosis,
  DiagnosisBaseline,
  DiagnosisCheck,
  DiagnosisDay,
  DiagnosisWindow,
  SleeveRole,
  ThesisState,
  VesperConfidence,
  WindowPattern,
} from "./types";

export type DiagnoseCtx = {
  symbol: string;
  name: string;
  bars: Bar[];
  spy: Bar[];
  filings: Filing[];
  earnings: EarningsNote[];
  sentiment: SentimentRow | undefined;
  whales: WhalePosition[];
  macro: MacroEvent[];
  sleeve: SleeveRole;
};

export const DIAG_MATRIX: { id: string; short: string }[] = [
  { id: "hold-low", short: "Tief" },
  { id: "volume", short: "Vol" },
  { id: "vs-spy", short: "SPY" },
  { id: "close-loc", short: "Schluss" },
  { id: "filing", short: "Filing" },
  { id: "sentiment", short: "Sent." },
  { id: "earnings", short: "Print" },
  { id: "mandate", short: "Mandat" },
];

const EMPTY_WINDOW: DiagnosisWindow = {
  sumPct: 0,
  cumVsSpy: null,
  upDays: 0,
  downDays: 0,
  volUp: 0,
  volDown: 0,
  failDays: 0,
  watchDays: 0,
};

function ymd(d: Date | string) {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function mean(xs: number[]) {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function atrOf(bars: Bar[], n = 14) {
  const slice = bars.slice(-n);
  if (slice.length === 0) return 0;
  return mean(slice.map((b) => b.h - b.l));
}

function volAvg(bars: Bar[], n = 20) {
  const slice = bars.slice(-n);
  if (slice.length === 0) return 0;
  return mean(slice.map((b) => b.v));
}

function smaOf(bars: Bar[], n: number): number | null {
  if (bars.length < Math.min(n, 5)) return null;
  const slice = bars.slice(-n);
  if (slice.length < 2) return null;
  return mean(slice.map((b) => b.c));
}

function daysBetween(a: string, b: string) {
  const A = Date.parse(`${a}T12:00:00.000Z`);
  const B = Date.parse(`${b}T12:00:00.000Z`);
  if (!Number.isFinite(A) || !Number.isFinite(B)) return 999;
  return Math.round((B - A) / 86_400_000);
}

export function gather(symbol: string): DiagnoseCtx {
  const s = useDeskStore.getState();
  const row = s.watchlist.find((t) => t.symbol === symbol);
  const uni = findUniverse(symbol);
  let bars = s.tape[symbol] ?? [];
  const lastPx = row?.last ?? uni?.last;
  if (bars.length < 8 && lastPx) bars = generateBars(symbol, lastPx, 66);
  let spy = s.tape.SPY ?? [];
  if (spy.length < 8) {
    const spyRow = s.watchlist.find((t) => t.symbol === "SPY");
    spy = generateBars("SPY", spyRow?.last ?? 765, 66);
  }
  const sleeveRaw = sleeveOf(symbol);
  const sleeve: SleeveRole = sleeveRaw === "core" || sleeveRaw === "toll" ? sleeveRaw : "overlay";
  return {
    symbol,
    name: row?.name ?? uni?.name ?? symbol,
    bars,
    spy,
    filings: s.filings,
    earnings: s.earnings,
    sentiment: s.sentiment.find((r) => r.ticker === symbol),
    whales: WHALES.filter((w) => w.ticker === symbol),
    macro: s.macro,
    sleeve,
  };
}

function priorWindow(bars: Bar[], days: number) {
  if (bars.length === 0) return { window: [] as Bar[], prior: [] as Bar[] };
  const window = bars.slice(-days);
  const cut = bars.length - window.length;
  const prior = bars.slice(Math.max(0, cut - 20), cut);
  return { window, prior };
}

function baselineFrom(prior: Bar[], windowFirst: Bar | undefined, spy: Bar[]): DiagnosisBaseline | null {
  const ref = prior.length > 0 ? prior : windowFirst ? [windowFirst] : [];
  if (ref.length === 0) return null;
  const last = ref.at(-1)!;
  const lows = ref.slice(-5);
  const highs = ref.slice(-5);
  const spyHit = pickBar(spy, ymd(last.t));
  return {
    close: last.c,
    low5: Math.min(...lows.map((b) => b.l)),
    high5: Math.max(...highs.map((b) => b.h)),
    vol20: volAvg(ref, 20),
    atr: atrOf(ref, 14),
    spyClose: spyHit.bar?.c ?? last.c,
    sma5: smaOf(ref, 5) ?? last.c,
    sma20: smaOf(ref, 20) ?? last.c,
  };
}

function check(id: string, label: string, status: CheckStatus, detail: string, kind: CheckKind): DiagnosisCheck {
  return { id, label, status, detail, kind };
}

function defaultThesis(symbol: string, name: string, n: number, sleeve: SleeveRole): string {
  if (sleeve === "core") {
    return `${name} (${symbol}) ist Kern. These über ${n} Handelstage: Kern nicht anfassen. Tracking gegen SPY ist kein Alpha (Lesson W31).`;
  }
  if (sleeve === "toll") {
    return `${name} (${symbol}) ist Tollbooth. These: AUM-Flow trägt die Sleeve — nicht als Overlay-Alpha verbuchen.`;
  }
  return `${name} (${symbol}) Overlay, ${n} Handelstage. These: die jüngste Bewegung ist Rauschen, kein neuer Trend. Overlay nur nach sauberem Fenster, Kern unangetastet.`;
}

function defaultAntithesis(symbol: string, sleeve: SleeveRole): string {
  if (sleeve === "core") {
    return `${symbol} weicht dauerhaft vom S&P 500 ab oder der Relativverlust im Fenster nähert sich ${REL_LOSS_CAP} %.`;
  }
  return `${symbol} bricht das 5-Tage-Tief zwei Schlüsse, Volumen steigt ohne Filing, Earnings drücken, oder Sentiment treibt allein (W32).`;
}

function nextState(prev: ThesisState, fails: number, watches: number, twoBelow: boolean, weakStreak: boolean): ThesisState {
  if (twoBelow || fails >= 2) return "bricht";
  if (fails >= 1 || weakStreak) return "wankt";
  if (prev === "bricht") return fails === 0 && watches === 0 ? "wankt" : "bricht";
  if (prev === "wankt") return fails === 0 && watches <= 1 ? "hält" : "wankt";
  if (watches >= 3) return "wankt";
  return "hält";
}

function classifyPattern(log: DiagnosisDay[], volUp: number, volDown: number, sumPct: number): WindowPattern {
  if (log.length < 2) return "seitwärts";
  const lows = log.map((d) => d.close).filter((n): n is number => n != null);
  const higherLows = lows.length >= 3 && lows[lows.length - 1]! > lows[0]! && lows[lows.length - 1]! >= lows[Math.floor(lows.length / 2)]!;
  const lowerHighs = lows.length >= 3 && lows[lows.length - 1]! < lows[0]!;
  if (higherLows && volUp > volDown * 1.15 && sumPct > 0.2) return "akkumulation";
  if (lowerHighs && volDown > volUp * 1.15 && sumPct < -0.2) return "distribution";
  if (sumPct > 1.2 && higherLows) return "aufwärts";
  if (sumPct < -1.2 && lowerHighs) return "abwärts";
  return "seitwärts";
}

function form4Buy(delta: string) {
  const d = delta.toLowerCase();
  return /kauf|bought|open.market|initiation/.test(d);
}

function form4Sell(delta: string) {
  const d = delta.toLowerCase();
  return /verkauf|sold|trim|exit|reduction/.test(d);
}

function upcomingItems(date: string, ctx: DiagnoseCtx): string[] {
  const out: string[] = [];
  for (const e of ctx.earnings) {
    if (e.ticker !== ctx.symbol) continue;
    const dist = daysBetween(date, e.date);
    if (dist > 0 && dist <= 7) {
      const empty = e.epsActual === 0 && e.revActualB === 0;
      out.push(empty ? `Print ${e.ticker} am ${e.date} (in ${dist} Tagen) — kein Overlay-Add vor dem Print.` : `Print ${e.ticker} am ${e.date}.`);
    }
  }
  for (const m of ctx.macro) {
    const dist = daysBetween(date, ymd(m.when));
    if (dist > 0 && dist <= 7 && m.flagged) {
      out.push(`${m.title} in ${dist} Tagen. ${m.implication.slice(0, 120)}`);
    }
  }
  return out;
}

function inspectDay(dx: Diagnosis, bar: Bar, ctx: DiagnoseCtx): Diagnosis {
  const date = ymd(bar.t);
  const history = ctx.bars.filter((b) => ymd(b.t) <= date);
  const prevBar = ctx.bars.filter((b) => ymd(b.t) < date).at(-1);
  const pct = changePct(bar, prevBar);
  const spyHit = pickBar(ctx.spy, date);
  const spyPrev = spyHit.prev ?? ctx.spy.filter((b) => ymd(b.t) < date).at(-1);
  const spyPct = spyHit.bar ? changePct(spyHit.bar, spyPrev) : null;
  const vsSpy = spyPct == null ? null : pct - spyPct;
  const volBase = dx.baseline?.vol20 || prevBar?.v || bar.v;
  const volumeRel = volBase ? bar.v / volBase : null;
  const rangePct = bar.c ? ((bar.h - bar.l) / bar.c) * 100 : null;
  const tone: DiagnosisDay["tone"] = pct > 0.15 ? "up" : pct < -0.15 ? "down" : "flat";
  const reading = explainPoint({
    symbol: ctx.symbol,
    name: ctx.name,
    bar,
    prev: prevBar,
    spyBar: spyHit.bar ?? undefined,
    spyPrev: spyPrev,
  });

  const holdLevel = dx.holdLevel ?? dx.baseline?.low5 ?? bar.l;
  const belowLow = bar.c < holdLevel;
  const prevDay = dx.log.at(-1);
  const twoBelow = belowLow && Boolean(prevDay?.close != null && prevDay.close < holdLevel);

  const filingsToday = ctx.filings.filter((f) => f.ticker === ctx.symbol && ymd(f.filedAt) === date);
  const filingsWindow = ctx.filings.filter((f) => {
    if (f.ticker !== ctx.symbol) return false;
    const d = ymd(f.filedAt);
    return d >= dx.startDate && d <= date;
  });
  const earningsToday = ctx.earnings.filter((e) => e.ticker === ctx.symbol && e.date === date);
  const earningsWindow = ctx.earnings.filter((e) => e.ticker === ctx.symbol && e.date >= dx.startDate && e.date <= date && !(e.epsActual === 0 && e.revActualB === 0));
  const macroAround = ctx.macro.filter((m) => Math.abs(daysBetween(date, ymd(m.when))) <= 1);
  const sent = ctx.sentiment;
  const whales = ctx.whales;
  const lastDay = dx.log.length + 1 >= dx.days;
  const closeLoc = bar.h > bar.l ? (bar.c - bar.l) / (bar.h - bar.l) : 0.5;
  const gapPct = prevBar && prevBar.c ? ((bar.o - prevBar.c) / prevBar.c) * 100 : null;
  const sma5 = smaOf(history, 5);
  const sma20 = smaOf(history, 20);
  const prior3 = ctx.bars.filter((b) => ymd(b.t) < date).slice(-3);
  const high3 = prior3.length ? Math.max(...prior3.map((b) => b.h)) : null;
  const chasing = Boolean(high3 != null && prior3.length >= 3 && bar.c > high3);

  const missing: string[] = [];
  if (!ctx.bars.length) missing.push("Tape");
  if (spyPct == null) missing.push("SPY-Vergleich");
  if (!filingsWindow.length) missing.push("kein Filing im Fenster");
  if (!sent) missing.push("Sentiment");
  if (!whales.length) missing.push("Whale-Flows");

  const checks: DiagnosisCheck[] = [];

  checks.push(
    check(
      "hold-low",
      "Schluss über 5-Tage-Tief",
      belowLow ? (twoBelow ? "fail" : "watch") : "pass",
      belowLow
        ? `Schluss ${bar.c.toFixed(2)} unter der Startmarke ${holdLevel.toFixed(2)}${twoBelow ? " — zweiter Schluss, Marke bleibt stehen." : " — erster Bruch."}`
        : `Schluss ${bar.c.toFixed(2)} hält über ${holdLevel.toFixed(2)}.`,
      "price",
    ),
  );

  const volSpikeDown = Boolean(volumeRel && volumeRel >= 1.6 && tone === "down" && filingsToday.length === 0);
  const volClimax = Boolean(volumeRel && volumeRel >= 2.2);
  checks.push(
    check(
      "volume",
      "Volumen passt zur Bewegung",
      volumeRel == null ? "na" : volSpikeDown ? "fail" : volClimax && tone === "up" && chasing ? "watch" : volumeRel >= 1.8 && tone === "up" ? "watch" : "pass",
      volumeRel == null
        ? "Kein Volumen im Tape."
        : volSpikeDown
          ? `Volumen ${volumeRel.toFixed(1)}× Durchschnitt bei Minus, ohne Filing.`
          : volClimax
            ? `Volumen ${volumeRel.toFixed(1)}× — Spitze. ${tone === "down" ? "Abgabedruck." : "Kein Nachlaufen in die Spitze (W34)."}`
            : `Volumen ${volumeRel.toFixed(1)}× 20-Tage-Schnitt.`,
      "volume",
    ),
  );

  const atr = dx.baseline?.atr ?? 0;
  const wide = rangePct != null && atr > 0 && bar.h - bar.l > atr * 1.8;
  checks.push(
    check(
      "range",
      "Tagesrange",
      rangePct == null ? "na" : wide ? "watch" : "pass",
      rangePct == null ? "Keine Range." : `Range ${rangePct.toFixed(2)} %${wide ? " — ungewöhnlich weit gegen ATR." : "."}`,
      "vol",
    ),
  );

  const weakVsSpy = vsSpy != null && vsSpy < -0.6;
  const weakStreak = weakVsSpy && dx.log.filter((d) => d.vsSpy != null && d.vsSpy < -0.6).length >= 1;
  const tracking = ctx.sleeve === "core" && vsSpy != null && Math.abs(vsSpy) < 0.25;
  checks.push(
    check(
      "vs-spy",
      ctx.sleeve === "core" ? "Tracking gegen SPY" : "Relativ zu SPY",
      vsSpy == null ? "na" : ctx.sleeve === "core" ? (Math.abs(vsSpy) > 0.8 ? "watch" : "pass") : weakStreak ? "fail" : weakVsSpy ? "watch" : "pass",
      vsSpy == null
        ? "Kein SPY-Schluss an dem Tag."
        : tracking
          ? `${vsSpy >= 0 ? "+" : ""}${vsSpy.toFixed(2)} Pp — Tracking, kein Alpha (W31).`
          : `${vsSpy >= 0 ? "+" : ""}${vsSpy.toFixed(2)} Prozentpunkte vs S&P 500.`,
      "relative",
    ),
  );

  const betaPain = ctx.sleeve === "overlay" && spyPct != null && spyPct < -0.3 && pct < spyPct * 1.5;
  checks.push(
    check(
      "beta-pain",
      "Beta an einem Minus-Tag des Markts",
      spyPct == null ? "na" : spyPct >= -0.3 ? "na" : betaPain ? "watch" : "pass",
      spyPct == null || spyPct >= -0.3
        ? "Kein Markttag mit echtem Minus."
        : betaPain
          ? `${ctx.symbol} ${pct.toFixed(2)} % bei SPY ${spyPct.toFixed(2)} % — Overlay fällt stärker als der Kern.`
          : `Hält sich an einem SPY-Minus (${spyPct.toFixed(2)} %).`,
      "relative",
    ),
  );

  const locStatus: CheckStatus = closeLoc < 0.33 ? "watch" : "pass";
  checks.push(
    check(
      "close-loc",
      "Schluss in der Tagesrange",
      locStatus,
      `Schluss im ${(closeLoc * 100).toFixed(0)}. Perzentil der Range${closeLoc < 0.33 && tone === "up" ? " — schwache Rallye." : closeLoc > 0.66 && tone === "down" ? " — Abgeber finden Käufer." : "."}`,
      "structure",
    ),
  );

  const gapDown = gapPct != null && gapPct <= -0.8;
  const gapFilled = gapDown && prevBar != null && bar.c >= prevBar.c;
  checks.push(
    check(
      "gap",
      "Gap zum Vortag",
      gapPct == null ? "na" : gapDown ? (gapFilled ? "pass" : "watch") : "pass",
      gapPct == null
        ? "Kein Vortag."
        : gapDown
          ? `Gap ${gapPct.toFixed(2)} %${gapFilled ? ", im Schluss geschlossen." : ", ungefüllt."}`
          : `Eröffnung ${gapPct >= 0 ? "+" : ""}${gapPct.toFixed(2)} % zum Vortag.`,
      "gap",
    ),
  );

  const belowBoth = sma5 != null && sma20 != null && bar.c < sma5 && bar.c < sma20;
  const belowBothStreak = belowBoth && dx.log.filter((d) => d.sma5 != null && d.sma20 != null && d.close != null && d.close < d.sma5 && d.close < d.sma20).length >= 1;
  checks.push(
    check(
      "sma",
      "Schluss gegen 5- und 20-Tage",
      sma5 == null ? "na" : belowBothStreak ? "watch" : belowBoth ? "watch" : "pass",
      sma5 == null
        ? "Zu wenig Historie für den Schnitt."
        : `SMA5 ${sma5.toFixed(2)}${sma20 != null ? `, SMA20 ${sma20.toFixed(2)}` : ""}. Schluss ${bar.c.toFixed(2)}${belowBoth ? " darunter." : " hält die Schnitte."}`,
      "structure",
    ),
  );

  const volUpSoFar = dx.window.volUp + (tone === "up" ? bar.v : 0);
  const volDownSoFar = dx.window.volDown + (tone === "down" ? bar.v : 0);
  const distDay = lastDay && volDownSoFar > volUpSoFar * 1.2 && (dx.window.sumPct + pct) < 0;
  checks.push(
    check(
      "accum",
      "Aufwärts- vs Abwärtsvolumen",
      !lastDay ? "na" : volUpSoFar + volDownSoFar === 0 ? "na" : distDay ? "watch" : volUpSoFar > volDownSoFar * 1.15 ? "pass" : "watch",
      !lastDay
        ? "Wird am Ende des Fensters gewertet."
        : `Aufwärtsvolumen ${volUpSoFar >= volDownSoFar ? "überwiegt" : "unterwiegt"} (↑ ${(volUpSoFar / 1e6).toFixed(1)} Mio / ↓ ${(volDownSoFar / 1e6).toFixed(1)} Mio).`,
      "accum",
    ),
  );

  const sentimentNaked = Boolean(sent?.flag && filingsWindow.length === 0 && lastDay);
  checks.push(
    check(
      "sentiment",
      "Sentiment nur mit Beleg",
      !sent ? "na" : sentimentNaked ? "fail" : sent.flag ? "watch" : "pass",
      !sent
        ? "Kein Sentiment-Stand."
        : sentimentNaked
          ? `z=${sent.zscore.toFixed(1)}, Flag ohne Filing — Lesson W32.`
          : `z=${sent.zscore.toFixed(1)}, Ton ${sent.tone >= 0 ? "+" : ""}${sent.tone.toFixed(2)}${sent.flag ? " (Flag)" : ""}.`,
      "sentiment",
    ),
  );

  checks.push(
    check(
      "filing",
      "Filings an dem Tag",
      filingsToday.length === 0 ? "na" : filingsToday.some((f) => f.material) ? "pass" : "watch",
      filingsToday.length === 0
        ? "Kein Filing an diesem Schluss."
        : filingsToday.map((f) => `${f.form}: ${f.title}`).join(" · "),
      "filing",
    ),
  );

  const f4 = filingsWindow.filter((f) => f.form === "4");
  const f4Buy = f4.some((f) => form4Buy(f.delta) || f.material);
  const f4Sell = f4.some((f) => form4Sell(f.delta));
  checks.push(
    check(
      "insider",
      "Insider / Form 4",
      f4.length === 0 ? "na" : f4Sell && !f4Buy ? "watch" : f4Buy ? "pass" : "watch",
      f4.length === 0 ? "Kein Form 4 im Fenster." : f4.map((f) => f.delta).join(" "),
      "insider",
    ),
  );

  const earn = earningsToday[0] ?? (lastDay ? earningsWindow.at(-1) : undefined);
  const earnBad =
    earn &&
    (earn.guidance === "lowered" ||
      earn.guidance === "withdrawn" ||
      (earn.epsCons && earn.epsActual && earn.epsActual > 0 && earn.epsActual < earn.epsCons * 0.97));
  checks.push(
    check(
      "earnings",
      "Earnings im Fenster",
      !earn ? "na" : earnBad ? "fail" : earn.guidance === "raised" ? "pass" : "watch",
      !earn
        ? lastDay
          ? "Kein Print im Fenster."
          : "Kein Print an dem Tag."
        : `${earn.ticker} ${earn.date}: ${earn.summary.slice(0, 160)}`,
      "earnings",
    ),
  );

  const upcoming = upcomingItems(date, ctx);
  if (lastDay) {
    checks.push(
      check(
        "print-ahead",
        "Nächster Print",
        upcoming.some((u) => u.startsWith("Print")) ? "watch" : "na",
        upcoming.find((u) => u.startsWith("Print")) ?? "Kein Print in den nächsten sieben Kalendertagen.",
        "earnings",
      ),
    );
  }

  const whaleAdds = whales.filter((w) => w.action === "add" || w.action === "new");
  const whaleExits = whales.filter((w) => w.action === "exit" || (w.action === "trim" && w.changePct <= -20));
  checks.push(
    check(
      "whale",
      "Whale-Flows (13F, nicht tagesgenau)",
      !lastDay ? "na" : whales.length === 0 ? "na" : whaleExits.length > whaleAdds.length ? "watch" : whaleAdds.length >= 2 ? "pass" : "watch",
      !lastDay
        ? "13F wird am Ende des Fensters gewertet."
        : whales.length === 0
          ? "Kein 13F-Stand zu diesem Namen."
          : `${whaleAdds.length} Add/New, ${whaleExits.length} Trim/Exit. ${whales
              .slice(0, 3)
              .map((w) => `${w.fund.split(" ")[0]} ${w.action}`)
              .join(", ")}.`,
      "whale",
    ),
  );

  const macroHit = macroAround[0];
  checks.push(
    check(
      "macro",
      "Makro um den Tag (T−1 bis T+1)",
      !macroHit ? "na" : macroHit.flagged ? "watch" : "pass",
      !macroHit ? "Kein terminiertes Makro-Event in der Nähe." : `${macroHit.title}. ${macroHit.implication.slice(0, 140)}`,
      "macro",
    ),
  );

  const cumVsSpy =
    vsSpy == null && dx.window.cumVsSpy == null
      ? null
      : (dx.window.cumVsSpy ?? 0) + (vsSpy ?? 0);
  const relCapHit = cumVsSpy != null && cumVsSpy <= -REL_LOSS_CAP;
  const relCapWatch = cumVsSpy != null && cumVsSpy <= -REL_LOSS_CAP / 2;
  const yieldPct = DIVIDEND_YIELD[ctx.symbol] ?? 0;
  if (lastDay) {
    const mandateDetail =
      ctx.sleeve === "core"
        ? `Kern-Sleeve. Relativ ${cumVsSpy == null ? "n/a" : `${cumVsSpy >= 0 ? "+" : ""}${cumVsSpy.toFixed(2)} Pp`} vs SPY. Cap ${REL_LOSS_CAP} %.`
        : ctx.sleeve === "toll"
          ? `Tollbooth. Darf den Kern nicht ersetzen. Relativ ${cumVsSpy == null ? "n/a" : `${cumVsSpy >= 0 ? "+" : ""}${cumVsSpy.toFixed(2)} Pp`}.`
          : `Overlay. Boden ${MONTHLY_NET_EUR} € netto, Relativcap ${REL_LOSS_CAP} %. Kum. vs SPY ${cumVsSpy == null ? "n/a" : `${cumVsSpy >= 0 ? "+" : ""}${cumVsSpy.toFixed(2)} Pp`}.${yieldPct === 0 ? " Null-Yield — nur wenn der Spread den Boden trägt." : ` Dividende ~${(yieldPct * 100).toFixed(1)} %.`}`;
    checks.push(
      check(
        "mandate",
        "Mandat (Cash jetzt + Kapital)",
        relCapHit ? "fail" : relCapWatch && ctx.sleeve === "overlay" ? "watch" : "pass",
        mandateDetail,
        "mandate",
      ),
    );

    const lessons: string[] = [];
    if (sentimentNaked) lessons.push("W32: Sentiment ohne Filing ist kein Entry.");
    if (chasing) lessons.push("W34: kein Overlay-Add über dem 3-Tage-Hoch.");
    if (ctx.sleeve === "core" && vsSpy != null && Math.abs(cumVsSpy ?? 0) < 0.4) lessons.push("W31: Tracking-Spread ist kein Alpha.");
    if (whaleExits.length && !filingsToday.length) lessons.push("W33: 13F-Trim kommt oft vor dem Tape.");
    checks.push(
      check(
        "lesson",
        "Lesson-Log",
        chasing && ctx.sleeve === "overlay" ? "watch" : sentimentNaked ? "fail" : lessons.length ? "watch" : "pass",
        lessons.length ? lessons.join(" ") : "Keine offene Lesson an diesem Namen.",
        "lesson",
      ),
    );
  }

  let delta = 0;
  for (const c of checks) {
    if (c.status === "pass") delta += 1;
    if (c.status === "fail") delta -= 2;
    if (c.status === "watch") delta -= 0.25;
  }

  const fails = checks.filter((c) => c.status === "fail").length;
  const watches = checks.filter((c) => c.status === "watch").length;
  const thesisState = nextState(dx.thesisState, fails, watches, twoBelow, weakStreak);

  let thesisNow = dx.workingThesis;
  if (thesisState === "bricht") {
    if (twoBelow) thesisNow = `These bricht: ${ctx.symbol} schließt den zweiten Tag unter der Startmarke ${holdLevel.toFixed(2)}.`;
    else if (volSpikeDown) thesisNow = `These bricht: Volumen ohne Filing bei einem Minus-Tag.`;
    else if (sentimentNaked) thesisNow = `These bricht: Sentiment-Flag ohne Filing (Lesson W32).`;
    else if (earnBad) thesisNow = `These bricht: Earnings-Druck (${earn?.guidance ?? "Miss"}).`;
    else if (relCapHit) thesisNow = `These bricht: Relativverlust vs SPY greift den ${REL_LOSS_CAP}-%-Deckel.`;
    else thesisNow = `These bricht: zwei harte Checks sind gefallen.`;
  } else if (thesisState === "wankt") {
    if (weakStreak) thesisNow = `These wankt: ${ctx.symbol} läuft zwei Tage schwächer als der S&P 500.`;
    else if (chasing) thesisNow = `These wankt: Schluss über dem 3-Tage-Hoch — nicht nachlaufen (W34).`;
    else if (belowLow) thesisNow = `These wankt: erster Schluss unter der 5-Tage-Marke.`;
    else thesisNow = `These wankt: gemischte Checks, noch kein zweiter Bruch.`;
  } else if (!belowLow && vsSpy != null && vsSpy >= 0) {
    thesisNow = `These hält: Schluss über der Marke, nicht schwächer als der Korb.`;
  } else {
    thesisNow = `These hält vorerst: Schluss über dem 5-Tage-Tief ${holdLevel.toFixed(2)}.`;
  }

  const support = Math.min(dx.support ?? bar.l, bar.l);
  const resist = Math.max(dx.resist ?? bar.h, bar.h);
  const confirm = dx.score.confirm + (delta > 0 ? delta : 0);
  const reject = dx.score.reject + (delta < 0 ? -delta : 0);

  const note = [
    reading.headline,
    vsSpy != null ? `vs SPY ${vsSpy >= 0 ? "+" : ""}${vsSpy.toFixed(2)} Pp.` : null,
    volumeRel != null ? `Vol ${volumeRel.toFixed(1)}×.` : null,
    filingsToday[0] ? filingsToday[0].form : null,
    thesisState !== "hält" ? thesisState : null,
  ]
    .filter(Boolean)
    .join(" ");

  const day: DiagnosisDay = {
    day: dx.log.length + 1,
    date,
    close: bar.c,
    changePct: pct,
    vsSpy,
    volumeRel,
    rangePct,
    tone,
    note,
    thesisNow,
    thesisState,
    checks,
    confirmDelta: delta,
    missing,
    closeLoc,
    gapPct,
    sma5,
    sma20,
    cumVsSpy,
  };

  const log = [...dx.log, day];
  const volUp = volUpSoFar;
  const volDown = volDownSoFar;
  const sumPct = dx.window.sumPct + pct;
  const window: DiagnosisWindow = {
    sumPct,
    cumVsSpy,
    upDays: dx.window.upDays + (tone === "up" ? 1 : 0),
    downDays: dx.window.downDays + (tone === "down" ? 1 : 0),
    volUp,
    volDown,
    failDays: dx.window.failDays + (fails > 0 ? 1 : 0),
    watchDays: dx.window.watchDays + (watches > 0 ? 1 : 0),
  };
  const pattern = classifyPattern(log, volUp, volDown, sumPct);

  const next: Diagnosis = {
    ...dx,
    day: day.day,
    log,
    support,
    resist,
    holdLevel,
    workingThesis: thesisNow,
    thesisState,
    score: { confirm, reject },
    lastReviewed: new Date().toISOString(),
    endDate: date,
    pattern,
    window,
    upcoming: lastDay ? upcoming : dx.upcoming,
  };

  if (next.day >= next.days) {
    return { ...next, status: "done", result: closeDiagnosis(next) };
  }
  return next;
}

function closeDiagnosis(dx: Diagnosis): NonNullable<Diagnosis["result"]> {
  const hardLow = dx.log.filter((d) => d.checks.some((c) => c.id === "hold-low" && c.status === "fail")).length;
  const sentFail = dx.log.some((d) => d.checks.some((c) => c.id === "sentiment" && c.status === "fail"));
  const earnFail = dx.log.some((d) => d.checks.some((c) => c.id === "earnings" && c.status === "fail"));
  const volFail = dx.log.filter((d) => d.checks.some((c) => c.id === "volume" && c.status === "fail")).length;
  const mandateFail = dx.log.some((d) => d.checks.some((c) => c.id === "mandate" && c.status === "fail"));
  const meanVs = mean(dx.log.map((d) => d.vsSpy).filter((n): n is number => n != null));
  const sumPct = dx.window.sumPct;
  const last = dx.log.at(-1)?.close ?? dx.baseline?.close ?? 0;
  const support = dx.support ?? last;
  const resist = dx.resist ?? last;
  const risk = Math.max(0.01, last - support);
  const reward = Math.max(0, resist - last);
  const rrN = reward / risk;
  const pattern = dx.pattern ?? "seitwärts";
  const chasing = dx.log.some((d) => d.checks.some((c) => c.id === "lesson" && /W34/.test(c.detail) && c.status === "watch"));
  const printAhead = dx.upcoming.some((u) => u.startsWith("Print"));
  const holdLevel = dx.holdLevel ?? dx.baseline?.low5 ?? support;

  let verdict: "bestätigt" | "teilweise" | "widerlegt" = "teilweise";
  if (
    dx.thesisState === "bricht" ||
    hardLow >= 1 ||
    mandateFail ||
    (sentFail && volFail) ||
    (earnFail && hardLow >= 1)
  ) {
    verdict = "widerlegt";
  } else if (
    dx.thesisState === "hält" &&
    dx.score.confirm >= dx.score.reject + 2 &&
    hardLow === 0 &&
    !sentFail &&
    !earnFail &&
    sumPct > -0.4 &&
    pattern !== "distribution" &&
    pattern !== "abwärts"
  ) {
    verdict = "bestätigt";
  }

  let rec: NonNullable<Diagnosis["result"]>["rec"] = "beobachten";
  if (verdict === "widerlegt") rec = "verwerfen";
  else if (verdict === "bestätigt" && dx.sleeve === "overlay" && rrN >= 1.5 && !chasing && !printAhead) rec = "paper";
  else if (verdict === "teilweise" && (dx.log.some((d) => d.checks.some((c) => c.id === "filing" && c.status === "pass")) || printAhead)) rec = "entscheiden";
  else rec = "beobachten";
  if (dx.sleeve === "core" && rec === "paper") rec = "beobachten";

  const evidence = [
    ...dx.log.slice(-3).map((d) => `Tag ${d.day} (${d.date}): ${d.note}`),
    meanVs ? `Mittlere Relativperformance vs SPY: ${meanVs >= 0 ? "+" : ""}${meanVs.toFixed(2)} Pp.` : "",
    `Fenster ${sumPct >= 0 ? "+" : ""}${sumPct.toFixed(2)} %. Muster: ${pattern}. These ${dx.thesisState}.`,
    `Tage ↑${dx.window.upDays} / ↓${dx.window.downDays}. Volumen ↑${(dx.window.volUp / 1e6).toFixed(1)} / ↓${(dx.window.volDown / 1e6).toFixed(1)} Mio.`,
  ].filter(Boolean);

  const risks: string[] = [];
  if (hardLow) risks.push("Mindestens ein Schluss unter der eingefrorenen 5-Tage-Marke.");
  if (sentFail) risks.push("Sentiment-Flag ohne Filing — das war schon mal ein teurer Fehler (W32).");
  if (earnFail) risks.push("Earnings im Fenster sprechen gegen die These.");
  if (volFail) risks.push("Volumenspitze nach unten ohne 8-K.");
  if (mandateFail) risks.push(`Relativverlust greift den ${REL_LOSS_CAP}-%-Deckel.`);
  if (printAhead) risks.push("Print steht bevor — kein Overlay-Add davor.");
  if (chasing) risks.push("Schluss über dem 3-Tage-Hoch. Lesson W34: nicht jagen.");
  if (dx.log.some((d) => d.missing.includes("Whale-Flows"))) risks.push("Kein tagesgenaues Orderbuch, 13F ist quartalsweise.");
  if (risks.length === 0) risks.push("Kurzes Fenster. Ein ruhiger Fünftager ist kein Mandat.");

  const atr = dx.baseline?.atr ?? risk;
  const entryLow = holdLevel;
  const entryHigh = holdLevel + atr * 0.4;
  const exit = resist - atr * 0.2;

  const lessons = [
    ...new Set(
      dx.log
        .flatMap((d) => d.checks.filter((c) => c.id === "lesson" && c.detail !== "Keine offene Lesson an diesem Namen."))
        .map((c) => c.detail),
    ),
  ];

  const sleeveLabel = dx.sleeve === "core" ? "Kern" : dx.sleeve === "toll" ? "Tollbooth" : "Overlay";
  const mandate = `${sleeveLabel}. Duales Mandat: Cash diesen Monat (Boden ${MONTHLY_NET_EUR} € netto) und Kapital über 90 Tage (Relativverlust vs SPY unter ${REL_LOSS_CAP} %). ${
    dx.sleeve === "core" ? "Kern wird in einer Event-Woche nicht angefasst." : "Overlay nur, wenn es den Spread über SPY zahlt und den Boden füllt."
  }`;

  const strengthens = ["Tägliche Schlusskurse gegen eine eingefrorene Marke", "Relativ zu SPY", "Filings, Sentiment, 13F und Makro im selben Raster"];
  const weakens = ["Fünf Tage sind ein kurzes Sample", "13F ist nicht tagesgenau", "Kein Orderbuch, keine Optionen"];
  if (sentFail || volFail) weakens.push("Volumen oder Sentiment ohne Beleg");
  if (dx.log.some((d) => d.missing.length > 2)) weakens.push("Lücken in den Nebenreihen");
  if (printAhead) weakens.push("Print vor der Tür");

  const gaps = dx.log.at(-1)?.missing.length ?? 0;
  const confidence: VesperConfidence = {
    label: dx.log.length >= 8 && gaps < 2 && verdict !== "teilweise" ? "mittel" : dx.log.length >= dx.days && gaps <= 2 ? "mittel" : "niedrig",
    why:
      verdict === "bestätigt"
        ? "Die täglichen Checks halten die These, aber das Fenster ist kurz — deshalb kein Live."
        : verdict === "widerlegt"
          ? "Mindestens ein hartes Kriterium ist gefallen. Die These trägt nicht."
          : "Gemischte Checks. Weder saubere Bestätigung noch klare Widerlegung. Das ist eine Untersuchung, keine Prognose.",
    strengthens,
    weakens,
  };
  if (dx.log.length < 8) confidence.label = "niedrig";

  return {
    verdict,
    evidence,
    risks,
    entry: last
      ? `Zone ${entryLow.toFixed(2)}–${entryHigh.toFixed(2)} (über der Startmarke, ATR ${atr.toFixed(2)}). Kein Jagen über ${resist.toFixed(2)}.`
      : "Keine Einstiegszone — Tape fehlt.",
    exit: `Beobachtungsausstieg unter ${holdLevel.toFixed(2)} oder bei materiellem 8-K. Oben ${exit.toFixed(2)} ist Marke, kein Zielversprechen.`,
    rr: Number.isFinite(rrN)
      ? `${rrN.toFixed(1)} : 1 vom letzten Schluss zu Fenstertief / -hoch. Nur Geometrie, keine Prognose.`
      : "Kein Chance-Risiko ohne klare Marken.",
    confidence,
    rec,
    pattern,
    mandate,
    lessons,
    upcoming: dx.upcoming,
  };
}

export function diagnoseWindow(ctx: DiagnoseCtx, days: number, thesis?: string): Diagnosis {
  const n = Math.min(30, Math.max(1, days));
  const { window, prior } = priorWindow(ctx.bars, n);
  const first = window[0];
  const last = window.at(-1);
  const baseline = baselineFrom(prior, first, ctx.spy);
  const now = new Date();
  const defaultT = thesis ?? defaultThesis(ctx.symbol, ctx.name, n, ctx.sleeve);
  let dx: Diagnosis = {
    id: `dx-${Date.now()}`,
    symbol: ctx.symbol,
    name: ctx.name,
    thesis: defaultT,
    antithesis: defaultAntithesis(ctx.symbol, ctx.sleeve),
    workingThesis: defaultT,
    thesisState: "hält",
    startedAt: now.toISOString(),
    startDate: first ? ymd(first.t) : ymd(now),
    endDate: last ? ymd(last.t) : ymd(now),
    days: n,
    day: 0,
    status: "running",
    support: baseline?.low5 ?? null,
    resist: baseline?.high5 ?? null,
    holdLevel: baseline?.low5 ?? null,
    confirm: [
      "Schlusskurse bleiben über dem eingefrorenen 5-Tage-Tief",
      "Kein Minus-Tag mit Volumen ≥ 1,6× ohne Filing",
      "Nicht zwei Tage hintereinander schwächer als SPY",
      "Kein Sentiment-Flag ohne Filing (W32)",
      "Relativverlust vs SPY bleibt unter 5 %",
    ],
    reject: [
      "Zwei Schlüsse unter der Startmarke",
      "Earnings-Miss oder Guidance-Schnitt im Fenster",
      "Volumenspitze nach unten ohne 8-K",
      "Sentiment allein als Treiber",
      "Relativcap in Gefahr, Paper klar hinter dem Markt",
    ],
    baseline,
    score: { confirm: 0, reject: 0 },
    lastReviewed: now.toISOString(),
    sleeve: ctx.sleeve,
    pattern: null,
    window: { ...EMPTY_WINDOW },
    upcoming: [],
    log: [],
  };
  const lastBar = window.at(-1);
  if (lastBar) dx = inspectDay(dx, lastBar, ctx);
  return dx;
}

export function createDiagnosis(symbol: string, days: number, thesis?: string): Diagnosis {
  return diagnoseWindow(gather(symbol), days, thesis);
}

export function advanceDiagnosis(dx: Diagnosis): Diagnosis {
  if (dx.status !== "running") return dx;
  const ctx = gather(dx.symbol);
  const last = dx.log.at(-1)?.date ?? "0000-00-00";
  const next = ctx.bars.find((b) => ymd(b.t) > last);
  if (!next) {
    if (dx.day >= dx.days) return { ...dx, status: "done", result: dx.result ?? closeDiagnosis(dx) };
    return dx;
  }
  return inspectDay(dx, next, ctx);
}

export function refreshDiagnosis(dx: Diagnosis): Diagnosis {
  if (dx.status === "killed") return dx;
  const ctx = gather(dx.symbol);
  const dates = dx.log.map((d) => d.date);
  const sourceBars =
    dates.length > 0
      ? dates.map((d) => ctx.bars.find((b) => ymd(b.t) === d)).filter((b): b is Bar => Boolean(b))
      : priorWindow(ctx.bars, dx.days).window;
  let fresh: Diagnosis = {
    ...dx,
    status: "running",
    day: 0,
    log: [],
    score: { confirm: 0, reject: 0 },
    workingThesis: dx.thesis,
    thesisState: "hält",
    result: undefined,
    lastReviewed: new Date().toISOString(),
    window: { ...EMPTY_WINDOW },
    pattern: null,
    upcoming: [],
    holdLevel: dx.holdLevel ?? dx.baseline?.low5 ?? null,
  };
  for (const bar of sourceBars) {
    if (fresh.day >= fresh.days) break;
    fresh = inspectDay({ ...fresh, status: "running" }, bar, ctx);
  }
  return fresh;
}

export function killDiagnosis(dx: Diagnosis): Diagnosis {
  return { ...dx, status: "killed", lastReviewed: new Date().toISOString() };
}

export function diagnosisLine(dx: Diagnosis) {
  if (dx.status === "killed") return `Diagnose ${dx.symbol} abgebrochen.`;
  if (dx.status === "done" && dx.result) {
    return `Diagnose Tag ${dx.day} von ${dx.days} — ${dx.symbol}. These ${dx.result.verdict} (${dx.thesisState}, ${dx.result.pattern}). Empfehlung: ${dx.result.rec}.`;
  }
  const last = dx.log.at(-1);
  return `Diagnose Tag ${dx.day} von ${dx.days} — ${dx.symbol}. These ${dx.thesisState}. ${last?.thesisNow ?? dx.workingThesis}`;
}

export function diagnosisSpeech(dx: Diagnosis): string {
  if (dx.status === "killed") return `Die Diagnose zu ${dx.symbol} ist abgebrochen.`;
  const last = dx.log.at(-1);
  const head = `Diagnose Tag ${dx.day} von ${dx.days} — ${dx.name} (${dx.symbol}), ${dx.sleeve === "core" ? "Kern" : dx.sleeve === "toll" ? "Tollbooth" : "Overlay"}.`;
  if (dx.status === "done" && dx.result) {
    const r = dx.result;
    return [
      head,
      `Das ist eine Untersuchung, keine Prognose.`,
      `These ${r.verdict}. Muster ${r.pattern}. Laufende These ${dx.thesisState}.`,
      `Ursprünglich: ${dx.thesis}`,
      `Stand danach: ${dx.workingThesis}`,
      `Gegenthese: ${dx.antithesis}`,
      `Fenster ${dx.window.sumPct >= 0 ? "+" : ""}${dx.window.sumPct.toFixed(2)} %, vs SPY ${dx.window.cumVsSpy == null ? "n/a" : `${dx.window.cumVsSpy >= 0 ? "+" : ""}${dx.window.cumVsSpy.toFixed(2)} Pp`}.`,
      `Belege: ${r.evidence.slice(0, 3).join(" ")}`,
      `Neue Risiken: ${r.risks.join(" ")}`,
      r.upcoming.length ? `Steht bevor: ${r.upcoming.join(" ")}` : "",
      r.mandate,
      r.lessons.length ? `Lessons: ${r.lessons.join(" ")}` : "",
      `Einstieg: ${r.entry}`,
      `Ausstieg: ${r.exit}`,
      `Chance-Risiko: ${r.rr}`,
      `Vertrauen ${r.confidence.label}: ${r.confidence.why} Stärkt: ${r.confidence.strengthens.join(", ")}. Schwächt: ${r.confidence.weakens.join(", ")}.`,
      `Empfehlung: ${r.rec === "paper" ? "Paper-Trade vorbereiten" : r.rec === "verwerfen" ? "verwerfen" : r.rec === "entscheiden" ? "Entscheidung anfordern" : "weiter beobachten"}.`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  const fails = last?.checks.filter((c) => c.status === "fail") ?? [];
  const watches = last?.checks.filter((c) => c.status === "watch") ?? [];
  return [
    head,
    `These ${dx.thesisState}: ${dx.workingThesis}`,
    `Gegenthese: ${dx.antithesis}`,
    last ? `Letzter Handelstag ${last.date}: ${last.note}` : "Noch kein Schluss verbucht.",
    last?.close != null ? `Kursmarken: Startmarke ${dx.holdLevel?.toFixed(2)} / Fenster ${dx.support?.toFixed(2)}–${dx.resist?.toFixed(2)}, Schluss ${last.close.toFixed(2)}.` : "",
    `Bestätigung wenn: ${dx.confirm.join("; ")}.`,
    `Widerlegt wenn: ${dx.reject.join("; ")}.`,
    fails.length ? `Heute gegen die These: ${fails.map((c) => c.detail).join(" ")}` : "Kein hartes Fail an dem letzten Tag.",
    watches.length ? `Beobachten: ${watches.map((c) => c.label).join(", ")}.` : "",
    last?.missing.length ? `Lücken: ${last.missing.join(", ")}.` : "",
    dx.upcoming.length ? `Steht bevor: ${dx.upcoming.join(" ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function migrateDiagnosis(raw: Diagnosis): Diagnosis {
  const log = (raw.log ?? []).map((d, i) => ({
    day: d.day ?? i + 1,
    date: d.date,
    close: d.close ?? null,
    changePct: d.changePct ?? 0,
    vsSpy: d.vsSpy ?? null,
    volumeRel: d.volumeRel ?? null,
    rangePct: d.rangePct ?? null,
    tone: d.tone ?? (d.changePct < -0.15 ? "down" : d.changePct > 0.15 ? "up" : "flat"),
    note: d.note ?? "",
    thesisNow: d.thesisNow ?? raw.thesis,
    thesisState: d.thesisState ?? ("hält" as ThesisState),
    checks: d.checks ?? [],
    confirmDelta: d.confirmDelta ?? 0,
    missing: d.missing ?? [],
    closeLoc: d.closeLoc ?? null,
    gapPct: d.gapPct ?? null,
    sma5: d.sma5 ?? null,
    sma20: d.sma20 ?? null,
    cumVsSpy: d.cumVsSpy ?? null,
  }));
  const baseline = raw.baseline
    ? {
        ...raw.baseline,
        sma5: raw.baseline.sma5 ?? raw.baseline.close,
        sma20: raw.baseline.sma20 ?? raw.baseline.close,
      }
    : null;
  return {
    ...raw,
    name: raw.name ?? raw.symbol,
    workingThesis: raw.workingThesis ?? raw.thesis,
    thesisState: raw.thesisState ?? log.at(-1)?.thesisState ?? "hält",
    baseline,
    score: raw.score ?? { confirm: 0, reject: 0 },
    lastReviewed: raw.lastReviewed ?? raw.startedAt,
    holdLevel: raw.holdLevel ?? baseline?.low5 ?? null,
    sleeve: raw.sleeve ?? (sleeveOf(raw.symbol) === "core" || sleeveOf(raw.symbol) === "toll" ? sleeveOf(raw.symbol) : "overlay"),
    pattern: raw.pattern ?? raw.result?.pattern ?? null,
    window: raw.window ?? {
      sumPct: log.reduce((a, d) => a + d.changePct, 0),
      cumVsSpy: log.at(-1)?.cumVsSpy ?? null,
      upDays: log.filter((d) => d.tone === "up").length,
      downDays: log.filter((d) => d.tone === "down").length,
      volUp: 0,
      volDown: 0,
      failDays: log.filter((d) => d.checks.some((c) => c.status === "fail")).length,
      watchDays: log.filter((d) => d.checks.some((c) => c.status === "watch")).length,
    },
    upcoming: raw.upcoming ?? raw.result?.upcoming ?? [],
    log,
    result: raw.result
      ? {
          ...raw.result,
          pattern: raw.result.pattern ?? "seitwärts",
          mandate: raw.result.mandate ?? "",
          lessons: raw.result.lessons ?? [],
          upcoming: raw.result.upcoming ?? [],
        }
      : raw.result,
  };
}
