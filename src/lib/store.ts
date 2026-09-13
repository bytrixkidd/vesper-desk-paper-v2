import { create } from "zustand";
import { compileLocalBrief, compileLocalWeekly, localIdea, localInsight, makeAutoEvent, writeAutoPref } from "@/lib/autopilot";
import { FLOOR_SEED } from "@/lib/floor";
import { bookIdentity, lastCloseDate, lastBarTime, riskSizeUsd } from "@/lib/ledger";
import { persistBook, splitBooks, tagFills, tagWatch, type PaperSave } from "@/lib/books";
import { executePulseTick } from "@/lib/pulse-exec";
import { CFG_VERSION, PAPER_V2_BOOK_ID, PAPER_V2_EXPERIMENT_ID } from "@/lib/config";
import { runDeskAgent, runFloorChat } from "@/lib/grok";
import {
  abortDecision,
  addToCore,
  allocateBook,
  applyDayMarks,
  diagnoseCompletedWeek,
  eurFromUsd,
  flattenTicker,
  harvestFromReturn,
  isTestBook,
  LIVE_NOTIONAL_EUR,
  localStandupNote,
  makeHarvest,
  makeStandup,
  markLiveBook,
  markPositions,
  monthKey,
  monthTotals,
  monthlyGrossRate,
  navUsd,
  priorClose,
  projectMonthEnd,
  rebalanceTo,
  replayWindow,
  snapshot,
  sleeveOf,
  START_EUR,
  START_USD,
  toEur,
  trimOverlay,
  usdFromEur,
  WATCH_DAYS,
  windowKey,
  withWeights,
} from "@/lib/paper";
import {
  applyTilt,
  applyPulseToWatch,
  buyTicker,
  cashTakeFromWeek,
  cloneStrategy,
  decideAutoIntervene,
  decidePulse,
  huddleStance,
  makePulseEvent,
  markWatchSession,
  overlayNavEur,
  overlayRoomEur,
  sliceTicker,
  TICKS_PER_DAY,
  tiltStrategy,
  trialFromTape,
  withPeaks,
  type TiltReport,
} from "@/lib/engine";
import { fetchAssetTape, fetchTape } from "@/lib/quotes";
import {
  ALERTS,
  ALL_BOTS,
  DEMO_WEEKS,
  EARNINGS,
  FILINGS,
  HARVESTS,
  INSIGHTS,
  LESSONS,
  MACRO,
  MANDATE_PLANS,
  MORNING_BRIEF,
  OPS_TASKS,
  PROFILE_PROPOSALS,
  SENTIMENT,
  STRATEGY,
  TRADE_IDEAS,
  TRADE_TRIALS,
  WATCHLIST,
  WEEKLY_BRIEF,
} from "@/lib/seed";
import type {
  Agent,
  AlertItem,
  AssetTape,
  AutoEvent,
  Bar,
  BookIndex,
  BookStrategy,
  BotHuddle,
  ChartSpan,
  DemoTrade,
  DemoWatch,
  DemoWeek,
  FloorAuthor,
  FloorMessage,
  HarvestEvent,
  Insight,
  InterveneKind,
  Lesson,
  LiveStatus,
  MandatePlan,
  MorningBrief,
  OpsTask,
  ProfileProposal,
  ProfileStatus,
  PulseEvent,
  PaperFill,
  SentimentRow,
  TapePayload,
  TradeIdea,
  TradeTrial,
  WeeklyBrief,
} from "@/lib/types";

type AgentDesk =
  | "research"
  | "filings"
  | "sentiment"
  | "flows"
  | "earnings"
  | "macro"
  | "ops"
  | "charts"
  | "universe"
  | "mandate"
  | "trade"
  | "demo"
  | "feedback";

type DeskState = {
  watchlist: typeof WATCHLIST;
  bots: Agent[];
  briefs: MorningBrief[];
  weeklies: WeeklyBrief[];
  alerts: AlertItem[];
  filings: typeof FILINGS;
  sentiment: SentimentRow[];
  earnings: typeof EARNINGS;
  macro: typeof MACRO;
  ops: OpsTask[];
  lessons: Lesson[];
  demos: DemoWeek[];
  strategy: BookStrategy;
  lastTilt: TiltReport | null;
  messages: FloorMessage[];
  tape: Record<string, Bar[]>;
  tapeAsOf: string | null;
  tapeSource: "yahoo" | "seed" | null;
  sessionLabel: string;
  eurUsd: number;
  market: "open" | "closed";
  tapeLoading: boolean;
  watch: DemoWatch | null;
  harvests: HarvestEvent[];
  liveNotional: number;
  liveStatus: LiveStatus;
  mandates: MandatePlan[];
  insights: Insight[];
  ideas: TradeIdea[];
  trials: TradeTrial[];
  proposals: ProfileProposal[];
  assetTapes: Record<string, AssetTape>;
  training: boolean;
  autoPilot: boolean;
  ticking: boolean;
  tickCount: number;
  lastTick: string | null;
  autoLog: AutoEvent[];
  pulseLog: PulseEvent[];
  lastHuddle: BotHuddle | null;
  fills: PaperFill[];
  bookIndex: BookIndex | null;
  running: boolean;
  chatting: boolean;
  demoRunning: boolean;
  reviewing: boolean;
  aiAvailable: boolean | null;
  lastError: string | null;
  assetLoading: string | null;
  setAiAvailable: (v: boolean) => void;
  loadTape: () => Promise<void>;
  loadAsset: (symbol: string, span: ChartSpan) => Promise<AssetTape | null>;
  startWatch: (phase?: "replay" | "live") => Promise<void>;
  advanceWatchDay: () => Promise<void>;
  runWatchWeek: () => Promise<void>;
  holdStandup: () => Promise<void>;
  intervene: (kind: InterveneKind, ticker?: string) => void;
  harvestWeek: (week: DemoWeek) => void;
  abortLive: (reason?: string) => void;
  resumeLive: () => void;
  sendMandateToDemo: (id: string) => void;
  trainTeam: (team: "trade" | "mandate" | "research") => Promise<void>;
  decideProposal: (id: string, status: ProfileStatus) => void;
  setAutoPilot: (on: boolean) => void;
  tickAutopilot: () => Promise<void>;
  runOvernight: () => Promise<void>;
  runWeekly: () => Promise<void>;
  runAgent: (desk: AgentDesk, prompt: string) => Promise<string | null>;
  sendFloor: (text: string) => Promise<void>;
  markOps: (id: string, status: OpsTask["status"], preview?: string) => void;
  addOpsDraft: (task: OpsTask) => void;
  applyLesson: (id: string) => void;
};

function persistPaper(state: {
  watch: DemoWatch | null;
  demos: DemoWeek[];
  harvests: HarvestEvent[];
  liveStatus: LiveStatus;
  tickCount: number;
  strategy: BookStrategy;
  lastTilt: TiltReport | null;
  pulseLog?: PulseEvent[];
  fills?: PaperFill[];
}) {
  if (typeof window === "undefined") return;
  const payload: PaperSave = {
    watch: tagWatch(state.watch, PAPER_V2_EXPERIMENT_ID, PAPER_V2_BOOK_ID, "complete"),
    extraDemos: state.demos.filter((d) => d.generated),
    extraHarvests: state.harvests.filter((h) => !h.lesson),
    liveStatus: state.liveStatus,
    tickCount: state.tickCount,
    strategy: state.strategy,
    lastTilt: state.lastTilt,
    pulseLog: (state.pulseLog ?? []).slice(0, 40),
    fills: tagFills((state.fills ?? []).slice(0, 80), PAPER_V2_EXPERIMENT_ID, PAPER_V2_BOOK_ID),
    experimentId: PAPER_V2_EXPERIMENT_ID,
    bookId: PAPER_V2_BOOK_ID,
    historyStatus: "complete",
  };
  persistBook(window.localStorage, PAPER_V2_BOOK_ID, payload);
}

export function hydratePaper() {
  if (typeof window === "undefined") return;
  const split = splitBooks(window.localStorage);
  const cur = useDeskStore.getState();
  const saved = split.active;
  const extraDemos = (saved?.extraDemos ?? []).filter(
    (d) => d.generated && !cur.demos.some((x) => x.id === d.id) && (d.startEur == null || isTestBook(d.startEur)),
  );
  const extraHarvests = (saved?.extraHarvests ?? []).filter((h) => !h.lesson && !cur.harvests.some((x) => x.id === h.id));
  const rawWatch = saved?.watch && isTestBook(saved.watch.startEur) ? saved.watch : cur.watch;
  const watch = tagWatch(rawWatch, PAPER_V2_EXPERIMENT_ID, PAPER_V2_BOOK_ID, "complete");
  const ident =
    watch &&
    bookIdentity({
      positions: watch.positions,
      cashEur: watch.cashEur,
      eurUsd: watch.eurUsd,
      navEur: watch.navEur,
    });
  const locked = watch && ident && !ident.ok ? { ...watch, tradeLock: ident.lock, cfgVersion: CFG_VERSION } : watch ? { ...watch, cfgVersion: watch.cfgVersion ?? CFG_VERSION } : watch;
  useDeskStore.setState({
    watch: locked,
    demos: extraDemos.length ? [...extraDemos, ...cur.demos] : cur.demos,
    harvests: extraHarvests.length ? [...extraHarvests, ...cur.harvests] : cur.harvests,
    liveStatus: saved?.liveStatus ?? cur.liveStatus,
    tickCount: Math.max(cur.tickCount, saved?.tickCount ?? 0),
    strategy: saved?.strategy?.sleeves?.length ? saved.strategy : cur.strategy,
    lastTilt: saved?.lastTilt ?? cur.lastTilt,
    pulseLog: saved?.pulseLog?.length ? saved.pulseLog : cur.pulseLog,
    fills: tagFills(saved?.fills?.length ? saved.fills : cur.fills, PAPER_V2_EXPERIMENT_ID, PAPER_V2_BOOK_ID),
    bookIndex: split.index,
  });
}

const BOT_IDS: FloorAuthor[] = [
	"ledger",
	"callbook",
	"meridian",
	"pulse",
	"shadow",
	"helmsman",
	"stab",
	"forge",
	"gauge",
	"canon",
	"audit",
	"scout",
	"score",
	"cart",
	"signal",
	"till",
	"drift",
	"vein",
	"skipper",
	"anvil",
	"caliper",
	"edict",
	"prism"
];
function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}
function parseFloorReplies(raw: string): { bot: FloorAuthor; text: string }[] {
	const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "").trim();
	try {
		const replies = ((JSON.parse(trimmed) as { replies?: { bot?: string; text?: string }[] }).replies ?? []).filter((r: { bot?: string; text?: string }) => r.bot && r.text && BOT_IDS.includes(r.bot as FloorAuthor)).map((r: { bot?: string; text?: string }) => ({
			bot: r.bot as FloorAuthor,
			text: String(r.text).slice(0, 800)
		}));
		if (replies.length > 0) return replies.slice(0, 3);
	} catch {}
	return [{
		bot: "helmsman",
		text: raw.slice(0, 800)
	}];
}
function applyTapeToWatchlist(watchlist: typeof WATCHLIST, payload: TapePayload) {
	return watchlist.map((t) => {
		const q = payload.quotes[t.symbol];
		return q ? {
			...t,
			last: q.last,
			changePct: q.changePct
		} : t;
	});
}
function lastMapFromTape(tape: Record<string, Bar[]>, fallback: typeof WATCHLIST, date?: string): Record<string, number> {
	const out: Record<string, number> = {};
	for (const t of fallback) {
		const bars = tape[t.symbol] ?? [];
		if (date) out[t.symbol] = priorClose(bars, date, t.last);
		else out[t.symbol] = bars.at(-1)?.c ?? t.last;
	}
	return out;
}
function finishWatch(watch: DemoWatch, positions: DemoWatch["positions"], cashEur: number): DemoWatch {
	const nav = toEur(navUsd(positions, cashEur, watch.eurUsd), watch.eurUsd);
	const snap = snapshot({
		startEur: watch.startEur,
		navEur: nav,
		spyStart: watch.spyStart,
		spyLast: watch.spyLast
	});
	return {
		...watch,
		positions: withWeights(positions, cashEur, watch.eurUsd),
		cashEur,
		navEur: Number(nav.toFixed(4)),
		...snap
	};
}
function harvestFromPulse(before: DemoWatch, realizedUsd: number, at: string, note: string, liveStatus: LiveStatus): HarvestEvent | null {
	if (liveStatus === "abort") return null;
	const realizedEur = before.eurUsd ? Math.max(0, realizedUsd / before.eurUsd) : 0;
	const gross = Number(Math.min(realizedEur, overlayRoomEur(before)).toFixed(2));
	if (gross <= 0) return null;
	return makeHarvest({
		at,
		month: monthKey(),
		source: "overlay",
		week: before.label,
		...harvestFromReturn(gross, 100),
		note: `${note} Realisiert, bleibt im Book.`,
	});
}
export const useDeskStore = create<DeskState>((set, get) => ({
	watchlist: WATCHLIST,
	bots: ALL_BOTS,
	briefs: [MORNING_BRIEF],
	weeklies: [WEEKLY_BRIEF],
	alerts: ALERTS,
	filings: FILINGS,
	sentiment: SENTIMENT,
	earnings: EARNINGS,
	macro: MACRO,
	ops: OPS_TASKS,
	lessons: LESSONS,
	demos: DEMO_WEEKS,
	strategy: cloneStrategy(STRATEGY),
	lastTilt: null,
	messages: FLOOR_SEED.map((m) => ({ ...m, origin: "seed" as const })),
	tape: {},
	tapeAsOf: null,
	tapeSource: null,
	sessionLabel: "Tape wird geladen…",
	eurUsd: 1.1678,
	market: "closed",
	tapeLoading: false,
	watch: null,
	harvests: HARVESTS,
	liveNotional: LIVE_NOTIONAL_EUR,
	liveStatus: "live",
	mandates: MANDATE_PLANS,
	insights: INSIGHTS,
	ideas: TRADE_IDEAS,
	trials: TRADE_TRIALS,
	proposals: PROFILE_PROPOSALS,
	assetTapes: {},
	assetLoading: null,
	training: false,
	autoPilot: true,
	ticking: false,
	tickCount: 0,
	lastTick: null,
	autoLog: [],
	pulseLog: [],
	fills: [],
	bookIndex: null,
	lastHuddle: null,
	running: false,
	chatting: false,
	demoRunning: false,
	reviewing: false,
	aiAvailable: null,
	lastError: null,
	setAiAvailable: (v) => set({ aiAvailable: v }),
	loadTape: async () => {
		if (get().tapeLoading) return;
		set({
			tapeLoading: true,
			lastError: null
		});
		try {
			const payload = await fetchTape();
			const watchlist = applyTapeToWatchlist(get().watchlist, payload);
			const last = lastMapFromTape(payload.bars, watchlist);
			const liveWatch = get().watch;
			const marked = liveWatch && liveWatch.status !== "complete" ? markLiveBook(liveWatch, last, payload.eurUsd) : liveWatch;
			const report = tiltStrategy({
				base: STRATEGY,
				tape: payload.bars,
				lessons: get().lessons,
				liveStatus: get().liveStatus,
			});
			set({
				watchlist,
				tape: payload.bars,
				tapeAsOf: payload.asOf,
				tapeSource: payload.source,
				sessionLabel: payload.sessionLabel,
				eurUsd: payload.eurUsd,
				market: payload.market,
				tapeLoading: false,
				watch: marked,
				lastTilt: report,
			});
			persistPaper({ ...get(), watch: marked, lastTilt: report });
		} catch (err) {
			set({
				tapeLoading: false,
				tapeSource: "seed",
				sessionLabel: "Tape nicht erreichbar — lokaler Close",
				lastError: err instanceof Error ? err.message : "Tape nicht erreichbar"
			});
		}
	},
	loadAsset: async (symbol, span) => {
		const key = `${symbol}:${span}`;
		const cached = get().assetTapes[key];
		if (cached && Date.now() - Date.parse(cached.asOf) < 9e4) return cached;
		set({
			assetLoading: key,
			lastError: null
		});
		try {
			const tape = await fetchAssetTape({ data: {
				symbol,
				span
			} });
			set((s) => ({
				assetTapes: {
					...s.assetTapes,
					[key]: tape
				},
				assetLoading: null
			}));
			return tape;
		} catch (err) {
			set({
				assetLoading: null,
				lastError: err instanceof Error ? err.message : "Asset-Tape nicht erreichbar"
			});
			return null;
		}
	},
	startWatch: async (phase: "replay" | "live" = "live") => {
		const current = get().watch;
		if (current && (current.status === "watching" || current.status === "paused" || current.status === "meeting") && current.phase === "live" && phase === "live") return;
		if (current && (current.status === "watching" || current.status === "paused" || current.status === "meeting") && current.phase === "replay" && phase === "replay") return;
		if (!get().tapeAsOf) await get().loadTape();
		const { tape, watchlist, eurUsd, market } = get();
		const spyBars = tape.SPY ?? [];
		const window = replayWindow(spyBars, WATCH_DAYS);
		if (window.length === 0) {
			set({ lastError: "Kein Tape für die Watch." });
			return;
		}
		const key = windowKey(window);
		if (current && current.windowKey === key && current.positions.some((p) => p.shares > 0) && isTestBook(current.startEur)) {
			if (phase === "live" && current.phase !== "live") {
				set({ watch: { ...current, status: "watching", phase: "live" } });
				persistPaper(get());
			}
			return;
		}
		const firstDate = window[0]!.date;
		const markDate = phase === "replay" ? firstDate : undefined;
		const last = lastMapFromTape(tape, watchlist, markDate);
		const report = tiltStrategy({
			base: STRATEGY,
			tape,
			lessons: get().lessons,
			liveStatus: get().liveStatus,
			beforeDate: phase === "replay" ? firstDate : undefined,
		});
		const tilted = applyTilt(STRATEGY, report);
		let positions;
		let cashEur = 0;
		let startEur = eurFromUsd(START_USD, eurUsd);
		let navSeed = startEur;
		if (current && current.positions.some((p) => p.shares > 0) && isTestBook(current.startEur)) {
			startEur = current.startEur;
			const marked = markPositions(current.positions, last);
			navSeed = toEur(navUsd(marked, current.cashEur, eurUsd), eurUsd);
			positions = withWeights(marked, current.cashEur, eurUsd);
			cashEur = current.cashEur;
		} else if (phase === "replay") {
			const raw = allocateBook(tilted, last, eurUsd, startEur);
			const used = raw.reduce((a, p) => a + p.shares * p.lastUsd, 0);
			cashEur = eurUsd ? Math.max(0, (startEur * eurUsd - used) / eurUsd) : 0;
			positions = withWeights(raw, cashEur, eurUsd);
		} else {
			positions = withWeights(
				tilted.sleeves
					.filter((s) => last[s.ticker])
					.map((s) => ({
						ticker: s.ticker,
						shares: 0,
						costUsd: last[s.ticker]!,
						lastUsd: last[s.ticker]!,
						weightPct: 0,
						sleeve: sleeveOf(s.ticker),
					})),
				startEur,
				eurUsd,
			);
			cashEur = startEur;
			navSeed = startEur;
		}
		const overlayStart = overlayNavEur(positions, eurUsd);
		const spyStart = last.SPY ?? watchlist.find((t) => t.symbol === "SPY")?.last ?? 0;
		const startedAt = new Date().toISOString();
		const endsAt = new Date(Date.parse(startedAt) + 6048e5).toISOString();
		const startUsd = usdFromEur(startEur, eurUsd);
		const navUsdNow = usdFromEur(navSeed, eurUsd);
		const opening = makeStandup({
			day: 0,
			at: startedAt,
			date: phase === "replay" ? firstDate : (lastCloseDate(spyBars) || firstDate),
			navEur: navSeed,
			bookPct: startEur ? ((navSeed - startEur) / startEur) * 100 : 0,
			spyPct: 0,
			relativePct: startEur ? ((navSeed - startEur) / startEur) * 100 : 0,
			market,
			note:
				phase === "replay"
					? `Rekonstruktion ${window[0]!.date} – ${window[window.length - 1]!.date}. Einsatz ${startUsd.toFixed(0)} $, Stand ${navUsdNow.toFixed(2)} $. Kein Echtgeld.`
					: `Live-Paper eröffnet. Einsatz ${startUsd.toFixed(0)} $ als Cash. Käufe erst in der nächsten Sitzung, nicht zum alten Schluss. ${CFG_VERSION}.`,
		});
		const snap = snapshot({ startEur, navEur: navSeed, spyStart, spyLast: spyStart });
		const watch = {
			id: `w-${startedAt}`,
			label: phase === "live" ? `Paper ${START_USD} $` : `7×24h · ${window[0]!.date.slice(8, 10)}.–${window[window.length - 1]!.date.slice(8, 10)}.`,
			startedAt,
			endsAt,
			day: 0,
			status: "watching" as const,
			startEur,
			navEur: Number(navSeed.toFixed(4)),
			cashEur,
			spyStart,
			spyLast: spyStart,
			eurUsd,
			...snap,
			positions,
			standups: [opening],
			interventions: current && isTestBook(current.startEur) ? current.interventions : [],
			equity: [{
				t: startedAt,
				nav: navSeed,
				spy: startEur,
				day: 0
			}],
			window,
			windowKey: key,
			overlayStartEur: overlayStart,
			peaks: {},
			phase,
			sessionStep: 0,
			harvestedOverlayEur: 0,
			tapeCloseDate: lastCloseDate(spyBars),
			actedKeys: current?.actedKeys ?? [],
			bookVersion: current?.bookVersion ?? 0,
			cfgVersion: CFG_VERSION,
			prevCloseNavEur: navSeed,
			sessionDate: lastCloseDate(spyBars),
			experimentId: PAPER_V2_EXPERIMENT_ID,
			bookId: PAPER_V2_BOOK_ID,
			historyStatus: "complete" as const,
		} as DemoWatch;
		set((s) => ({
			watch,
			strategy: tilted,
			lastTilt: report,
			lastError: null,
			messages: [...s.messages, {
				id: `c-wstart-${startedAt}`,
				ts: startedAt,
				author: "forge" as const,
				text: opening.note,
				origin: "system" as const,
			}]
		}));
		persistPaper(get());
	},
	advanceWatchDay: async () => {
		const watch = get().watch;
		if (!watch || watch.status === "complete") return;
		if (watch.day >= 7) return;
		const date = watch.window[watch.day]?.date;
		if (!date) return;
		const { positions: marked, session } = applyDayMarks(watch.positions, get().tape, date);
		const spyLast = (get().tape.SPY ?? []).find((b) => b.t.slice(0, 10) === date)?.c ?? watch.spyLast;
		const day = watch.day + 1;
		const at = new Date().toISOString();
		let next = finishWatch({
			...watch,
			day,
			spyLast,
			status: day >= 7 ? "complete" : watch.status
		}, marked, watch.cashEur);
		const auto = next.status !== "complete" ? decideAutoIntervene(next, date) : null;
		if (auto) {
			let positions = next.positions;
			let cashEur = next.cashEur;
			if (auto.kind === "trim-overlay") positions = trimOverlay(positions);
			else if (auto.kind === "flat" && auto.ticker) {
				const flat = flattenTicker(positions, auto.ticker);
				positions = flat.positions;
				cashEur += flat.cashUsd / next.eurUsd;
			} else if (auto.kind === "add-core") positions = addToCore(positions);
			next = finishWatch({
				...next,
				interventions: [...next.interventions, {
					id: `i-auto-${at}`,
					at,
					day,
					kind: auto.kind,
					ticker: auto.ticker,
					note: auto.note,
				}],
			}, positions, cashEur);
		}
		const note = auto?.note ?? localStandupNote({
			day,
			date,
			session,
			bookPct: next.bookPct,
			spyPct: next.spyPct,
			relativePct: next.relativePct,
			navEur: next.navEur
		});
		const standup = makeStandup({
			day,
			at,
			date,
			navEur: next.navEur,
			bookPct: next.bookPct,
			spyPct: next.spyPct,
			relativePct: next.relativePct,
			market: session ? "open" : "closed",
			note
		});
		next = {
			...next,
			standups: [...watch.standups, standup],
			equity: [...watch.equity, {
				t: at,
				nav: next.navEur,
				spy: next.startEur * (1 + next.spyPct / 100),
				day
			}]
		};
		let week: DemoWeek | null = null;
		let lesson: Lesson | null = null;
		let take: ReturnType<typeof cashTakeFromWeek> | null = null;
		if (next.status === "complete") {
			const trades: DemoTrade[] = next.positions.filter((p) => p.shares > 0).slice().sort((a, b) => b.weightPct - a.weightPct).slice(0, 6).map((p, i) => ({
				id: `t-${next.id}-${i}`,
				ticker: p.ticker,
				side: (p.shares > 0 ? "long" : "flat") as DemoTrade["side"],
				entry: p.costUsd,
				exit: p.lastUsd,
				pnlPct: p.costUsd ? (p.lastUsd - p.costUsd) / p.costUsd * 100 : 0,
				note: p.sleeve === "core" ? "Kern." : p.sleeve === "toll" ? "Tollbooth." : "Beimischung."
			}));
			take = cashTakeFromWeek({
				overlayStartEur: next.overlayStartEur ?? overlayNavEur(watch.positions, watch.eurUsd),
				overlayEndEur: overlayNavEur(next.positions, next.eurUsd),
				startEur: next.startEur,
				sleeves: get().strategy.sleeves,
				harvestedOverlayEur: next.harvestedOverlayEur ?? 0,
			});
			week = {
				id: next.id,
				week: `W${35 + get().demos.filter((d) => d.generated).length}`,
				label: next.label,
				startedAt: next.startedAt,
				startEur: next.startEur,
				navEur: next.navEur,
				bookPct: next.bookPct,
				spyPct: next.spyPct,
				relativePct: next.relativePct,
				trades,
				verdict: `${diagnoseCompletedWeek({
					bookPct: next.bookPct,
					spyPct: next.spyPct,
					relativePct: next.relativePct,
					trades,
					navEur: next.navEur,
					startEur: next.startEur,
				})} ${take.note}`,
				generated: true,
				windowKey: next.windowKey ?? windowKey(next.window),
				overlayEur: take.overlayEur,
				divEur: take.divEur,
				tiltNote: get().strategy.tiltNote,
			};
			if (take.overlayEur <= 0 || next.relativePct < 0) lesson = {
				id: `l-${next.id}`,
				week: week.week,
				source: "demo",
				mistake: `7×24h-Watch. Spread ${next.relativePct.toFixed(2)} pp. Beimischung hat den Monat nicht gefüllt.`,
				fix: "Größe zurück in SPY/VOO und Zahler (JPM, GS, AVGO, UNH). Nächster Add erst nach zwei grünen Watches.",
				owner: "forge",
				status: "open",
				tickers: next.positions.filter((p) => p.sleeve === "overlay" && p.costUsd > 0 && p.lastUsd < p.costUsd).map((p) => p.ticker).slice(0, 3),
				effect: "trim",
			};
		}
		const payout = week && take && take.grossEur > 0 && get().liveStatus !== "abort" && !get().harvests.some((h) => h.week === week.week) ? makeHarvest({
			at,
			month: monthKey(),
			source: take.overlayEur > 0 ? "overlay" : "div",
			week: week.week,
			grossEur: take.grossEur,
			taxEur: take.taxEur,
			netEur: take.netEur,
			note: `${week.week}: ${take.note}`,
		}) : null;
		if (next.status === "complete") {
			next = {
				...next,
				overlayStartEur: overlayNavEur(next.positions, next.eurUsd),
				harvestedOverlayEur: 0,
			};
		}
		set((s) => ({
			watch: next,
			demos: week ? [week, ...s.demos] : s.demos,
			lessons: lesson ? [lesson, ...s.lessons] : s.lessons,
			harvests: payout ? [payout, ...s.harvests] : s.harvests,
			messages: [
				...s.messages,
				{
					id: `c-wday-${at}`,
					ts: at,
					author: auto ? "skipper" as const : "forge" as const,
					text: note
				},
				...payout ? [{
					id: `c-pay-${at}`,
					ts: at,
					author: "forge" as const,
					text: `Realisiert ${payout.netEur.toFixed(2)} € auf dem Paper (${payout.grossEur.toFixed(2)} €, Steuer nur Rechnung). Bleibt im Book. ${payout.note}`
				}] : week && take && take.grossEur <= 0 ? [{
					id: `c-pay-${at}`,
					ts: at,
					author: "forge" as const,
					text: `${week.week}: Beimischung nicht im Plus. Nichts zum Wiederanlegen. 300-$-Test läuft weiter.`
				}] : week && get().liveStatus === "abort" ? [{
					id: `c-pay-${at}`,
					ts: at,
					author: "skipper" as const,
					text: `${week.week} nicht gebucht — Overlay ist manuell pausiert.`
				}] : []
			]
		}));
		persistPaper(get());
	},
	runWatchWeek: async () => {
		if (get().demoRunning) return;
		set({
			demoRunning: true,
			lastError: null
		});
		const currentWatch = get().watch;
		if (!currentWatch || currentWatch.status === "complete") await get().startWatch("replay");
		for (;;) {
			const w = get().watch;
			if (!w || w.day >= 7 || w.status === "paused" || w.status === "complete") break;
			await sleep(900);
			if (get().watch?.status === "paused") break;
			await get().advanceWatchDay();
		}
		set({ demoRunning: false });
	},
	holdStandup: async () => {
		if (!get().watch) await get().startWatch();
		const w = get().watch;
		if (!w) return;
		set({ watch: {
			...w,
			status: w.status === "complete" ? "complete" : "meeting"
		} });
		const prompt = `Tägliches Demo-Meeting, MET. Tag ${w.day}/7. NAV ${w.navEur.toFixed(2)} EUR (Start ${w.startEur}). Book ${w.bookPct.toFixed(2)} %, SPY ${w.spyPct.toFixed(2)} %, relativ ${w.relativePct.toFixed(2)} pp. Limit Relativverlust 5 % über 90 Tage bis 23. Nov. Tape: ${get().sessionLabel}. Positionen: ${w.positions.slice().sort((a, b) => b.weightPct - a.weightPct).slice(0, 8).map((p) => `${p.ticker} ${p.weightPct.toFixed(1)}% @ ${p.lastUsd.toFixed(2)}`).join(", ")}. Standup: Lage, ob Eingriff nötig, ob Overlay den Spread zahlt.`;
		let text = null;
		try {
			const result = await runDeskAgent({ data: {
				desk: "demo",
				prompt
			} });
			if (result.ok) text = result.text;
			else set({ lastError: result.error });
		} catch (err) {
			set({ lastError: err instanceof Error ? err.message : "Meeting fehlgeschlagen" });
		}
		const at = new Date().toISOString();
		const date = w.window[Math.max(0, w.day - 1)]?.date ?? w.window[0]?.date ?? at.slice(0, 10);
		const standup = makeStandup({
			day: w.day,
			at,
			date,
			navEur: w.navEur,
			bookPct: w.bookPct,
			spyPct: w.spyPct,
			relativePct: w.relativePct,
			market: get().market,
			note: text ?? localStandupNote({
				day: w.day || 1,
				date,
				session: get().market === "open",
				bookPct: w.bookPct,
				spyPct: w.spyPct,
				relativePct: w.relativePct,
				navEur: w.navEur
			})
		});
		set((s) => {
			const cur = s.watch;
			if (!cur) return { watch: cur };
			return {
				watch: {
					...cur,
					status: cur.status === "complete" ? "complete" : cur.status === "paused" ? "paused" : "watching",
					standups: [...cur.standups, standup]
				},
				messages: [...s.messages, {
					id: `c-meet-${at}`,
					ts: at,
					author: "forge" as const,
					text: `Meeting Tag ${cur.day}/7. ${standup.note.slice(0, 240)}`
				}]
			};
		});
	},
	intervene: (kind, ticker) => {
		const watch = get().watch;
		if (!watch || watch.status === "complete") return;
		const at = new Date().toISOString();
		let positions = watch.positions;
		let cashEur = watch.cashEur;
		let status = watch.status;
		let note = "";
		if (kind === "halt") {
			status = "paused";
			note = "Watch pausiert. Book steht. Jederzeit fortsetzen.";
		} else if (kind === "resume") {
			status = "watching";
			note = "Watch weiter. 24h-Blick wieder an.";
		} else if (kind === "rebalance") {
			const next = rebalanceTo(get().strategy, positions, cashEur, watch.eurUsd);
			positions = next.positions;
			cashEur = next.cashEur;
			note = "Rebalance auf Kern-Satellit zu aktuellen Lasts.";
		} else if (kind === "trim-overlay") {
			positions = trimOverlay(positions);
			note = "Overlay halbiert, Differenz in SPY.";
		} else if (kind === "add-core") {
			positions = addToCore(positions);
			note = "10 % Overlay in SPY/VOO geschoben.";
		} else if (kind === "flat" && ticker) {
			const flat = flattenTicker(positions, ticker);
			positions = flat.positions;
			cashEur += flat.cashUsd / watch.eurUsd;
			note = `${ticker} flach. Erlös in Cash.`;
		} else if ((kind === "take-profit" || kind === "trail") && ticker) {
			const keep = kind === "take-profit" ? 0.5 : 0;
			const cut = sliceTicker(positions, ticker, keep);
			positions = cut.positions;
			cashEur += cut.soldUsd / watch.eurUsd;
			note = kind === "take-profit" ? `${ticker}: Hälfte Gewinn in Cash, bleibt im Book.` : `${ticker}: Trail, flach, Cash bleibt.`;
		} else if (kind === "add-overlay" && ticker) {
			const last = positions.find((p) => p.ticker === ticker)?.lastUsd ?? 0;
			const cashUsd = cashEur * watch.eurUsd;
			if (last > 0 && cashUsd >= 5) {
				const nav = navUsd(positions, cashEur, watch.eurUsd);
				const held = (positions.find((p) => p.ticker === ticker)?.shares ?? 0) * last;
				const spend = riskSizeUsd({ navUsd: nav, availableUsd: cashUsd, capPct: 15, heldUsd: held });
				if (spend < 4) return;
				const bought = buyTicker(positions, ticker, spend, last);
				positions = bought.positions;
				cashEur -= bought.spentUsd / watch.eurUsd;
				note = `${ticker} nachgekauft. ${bought.spentUsd.toFixed(2)} $ — Größe aus Risiko, nicht 80 % Cash.`;
			} else return;
		} else return;
		const intervention = {
			id: `i-${at}`,
			at,
			day: watch.day,
			kind,
			ticker,
			note
		};
		const next = finishWatch({
			...watch,
			status,
			spyLast: watch.spyLast
		}, positions, cashEur);
		set((s) => ({
			watch: {
				...next,
				interventions: [...watch.interventions, intervention]
			},
			messages: [
				...s.messages,
				{
					id: `c-int-${at}`,
					ts: at,
					author: "you" as const,
					text: `Eingriff: ${note}`
				},
				{
					id: `c-int-${at}-f`,
					ts: at,
					author: "forge" as const,
					text: `Notiert. Tag ${watch.day}/7, NAV ${next.navEur.toFixed(2)} €.`
				}
			]
		}));
	},
	runOvernight: async () => {
		if (get().running) return;
		set({
			running: true,
			lastError: null
		});
		const order = [
			"ledger",
			"callbook",
			"meridian",
			"pulse",
			"shadow",
			"helmsman",
			"forge",
			"gauge",
			"canon"
		];
		set({ bots: get().bots.map((b) => ({
			...b,
			status: "idle"
		})) });
		for (const id of order) {
			set({ bots: get().bots.map((b) => b.id === id ? {
				...b,
				status: "running"
			} : b) });
			await sleep(380);
			set({ bots: get().bots.map((b) => b.id === id ? {
				...b,
				status: "done",
				lastRun: new Date().toISOString()
			} : b) });
		}
		const names = get().watchlist.map((t) => `${t.symbol} (${t.name}, ${t.changePct > 0 ? "+" : ""}${t.changePct.toFixed(1)}%)`).join(", ");
		const w = get().watch;
		const prompt = `Erstelle Morgenbriefing PLUS Weekly-Feedback.
Watchlist: ${names}.
Strategie: Kern-Satellit SPY/VOO 55 / BLK 15 / Beimischung 30, Tilt folgt dem Tape. Testlauf 300 Dollar digital. Gewinn bleibt im Book und wird wieder eingesetzt. Duales Mandat Cash-jetzt und Kapital. Kein Echtgeld.
Paper: 300 USD digital, 7x24h-Watch, Relativverlust-Limit 5 % vs SPY über 90 Tage.
August-Ausschuettung bisher ${get().harvests.filter((h) => h.month === "2026-08" && !h.lesson).reduce((a, h) => a + h.netEur, 0).toFixed(2)} EUR Paper, bleibt im Book.
${w ? `Aktuelle Watch Tag ${w.day}/7, NAV ${usdFromEur(w.navEur, w.eurUsd).toFixed(2)} USD, relativ ${w.relativePct.toFixed(2)} pp.` : "Watch noch nicht gestartet."}
${w ? `Aktuelle Watch Tag ${w.day}/7, NAV ${w.navEur.toFixed(2)} EUR, relativ ${w.relativePct.toFixed(2)} pp.` : "Watch noch nicht gestartet."}
Heute Sonntag 23. August 2026, Zustellung Montag 06:00 MET. Jackson Hole Montag. NVDA Print Mittwoch.
Abschnitte: Strategie, Filings, Earnings, Sentiment, Flows, Makro, Aktionen.
Danach Weekly: Forge-Post-Mortem, Gauge-Effizienz, Canon-Inklusionsplan mit Owner und ETA, Profilvorschlaege aller Teams (add/remove). Duales Mandat. Deutsch, konkret, nichts erfinden das oeffentlichen Fakten widerspricht.`;
		let text = null;
		try {
			const result = await runDeskAgent({ data: {
				desk: "research",
				prompt
			} });
			if (result.ok) text = result.text;
			else set({ lastError: result.error });
		} catch (err) {
			set({ lastError: err instanceof Error ? err.message : "Overnight-Lauf fehlgeschlagen" });
		}
		const deliveredAt = new Date().toISOString();
		const brief = text ? {
			id: `brief-${deliveredAt}`,
			deliveredAt,
			title: "Overnight-Buch — Helmsman kompiliert",
			lede: text.split("\n").filter(Boolean)[0] ?? "Einheitliches Morgenbriefing, kompiliert von Helmsman.",
			sections: [{
				heading: "Helmsman-Brief",
				body: text
			}],
			actions: [],
			generated: true
		} : {
			id: `brief-${deliveredAt}`,
			deliveredAt,
			title: "Overnight-Buch — lokale Synthese (Modell offline)",
			lede: "Helmsman hat ohne Live-Modell kompiliert. Kern SPY/VOO/BLK unverändert. Jackson Hole bleibt das Montagsrisiko.",
			sections: MORNING_BRIEF.sections,
			actions: MORNING_BRIEF.actions,
			generated: true
		};
		const weekly = {
			id: `weekly-${deliveredAt}`,
			weekOf: deliveredAt.slice(0, 10),
			deliveredAt,
			title: "Weekly — Forge, Gauge, Canon, Edict",
			lede: text ? "Live-Review an das Morgenbrief gehängt. Boden, Dual, Profile." : WEEKLY_BRIEF.lede,
			revenue: WEEKLY_BRIEF.revenue,
			feedback: text ? [{
				bot: "Canon",
				heading: "Live-Review",
				body: text
			}] : WEEKLY_BRIEF.feedback,
			inclusion: WEEKLY_BRIEF.inclusion,
			proposals: get().proposals,
			dual: WEEKLY_BRIEF.dual,
			generated: true
		};
		set((s) => ({
			briefs: [brief, ...s.briefs],
			weeklies: [weekly, ...s.weeklies],
			alerts: [{
				id: `a-${deliveredAt}`,
				ts: deliveredAt,
				desk: "research",
				severity: "info",
				headline: "Morgenbrief und Weekly zugestellt",
				body: brief.title
			}, ...s.alerts],
			messages: [
				...s.messages,
				{
					id: `c-${deliveredAt}`,
					ts: deliveredAt,
					author: "helmsman" as const,
					text: `Overnight durch. Brief und Weekly liegen: ${brief.title}`
				},
				{
					id: `c-${deliveredAt}-c`,
					ts: deliveredAt,
					author: "canon" as const,
					text: "Inklusionsplan hängt am Weekly. Testlauf 300 $. Chart- und Universum-Desk vor Overlay-Add. Profilvorschläge drin."
				}
			],
			running: false
		}));
	},
	runWeekly: async () => {
		if (get().reviewing) return;
		set({
			reviewing: true,
			lastError: null
		});
		for (const id of [
			"forge",
			"gauge",
			"canon"
		]) {
			set({ bots: get().bots.map((b) => b.id === id ? {
				...b,
				status: "running"
			} : b) });
			await sleep(420);
			set({ bots: get().bots.map((b) => b.id === id ? {
				...b,
				status: "done",
				lastRun: new Date().toISOString()
			} : b) });
		}
		const open = get().lessons.filter((l) => l.status === "open").map((l) => l.mistake).join(" | ");
		const w = get().watch;
		const prompt = `Weekly Self-Improve. Offene Lessons: ${open || "keine"}. Demo-Wochen: ${get().demos.map((d) => `${d.week} Book ${d.bookPct}% vs SPY ${d.spyPct}% NAV ${d.navEur}€`).join("; ")}.
${w ? `Live-Watch Tag ${w.day}/7 NAV ${w.navEur.toFixed(2)}€ relativ ${w.relativePct.toFixed(2)}pp.` : ""}
Kern SPY/VOO/BLK, Beimischung 30 % mit Tape-Tilt. Testlauf 300 Dollar digital. Gewinn bleibt im Book. Duales Mandat. Relativverlust-Limit 5% in 90 Tagen. Liefere Forge-Post-Mortem, Gauge-Effizienz, Canon-Inklusionsplan, Edict-Profilvorschlaege aller Teams.`;
		let text = null;
		try {
			const result = await runDeskAgent({ data: {
				desk: "feedback",
				prompt
			} });
			if (result.ok) text = result.text;
			else set({ lastError: result.error });
		} catch (err) {
			set({ lastError: err instanceof Error ? err.message : "Weekly fehlgeschlagen" });
		}
		const deliveredAt = new Date().toISOString();
		const weekly = {
			id: `weekly-${deliveredAt}`,
			weekOf: deliveredAt.slice(0, 10),
			deliveredAt,
			title: "Weekly — Live-Kompilat",
			lede: text?.split("\n").filter(Boolean)[0] ?? "Forge, Gauge und Canon haben lokal kompiliert.",
			revenue: WEEKLY_BRIEF.revenue,
			feedback: text ? [
				{
					bot: "Forge",
					heading: "Post-Mortem",
					body: text
				},
				{
					bot: "Gauge",
					heading: "Effizienz",
					body: "Siehe Kompilat. Throttle und FactSet-Flag unverändert."
				},
				{
					bot: "Canon",
					heading: "Inklusion",
					body: "Plan hängt am Brief. Owner bleiben Forge/Gauge/Canon/Helmsman."
				}
			] : WEEKLY_BRIEF.feedback,
			inclusion: WEEKLY_BRIEF.inclusion,
			proposals: get().proposals,
			dual: WEEKLY_BRIEF.dual,
			generated: true
		};
		set((s) => ({
			weeklies: [weekly, ...s.weeklies],
			messages: [...s.messages, {
				id: `c-w-${deliveredAt}`,
				ts: deliveredAt,
				author: "canon" as const,
				text: `Weekly kompiliert. ${weekly.title}`
			}],
			reviewing: false
		}));
	},
	runAgent: async (desk, prompt) => {
		set({ lastError: null });
		try {
			const result = await runDeskAgent({ data: {
				desk,
				prompt
			} });
			if (!result.ok) {
				set({ lastError: result.error });
				return null;
			}
			const ts = new Date().toISOString();
			set((s) => ({ alerts: [{
				id: `a-${ts}`,
				ts,
				desk,
				severity: "info",
				headline: `${desk}-Agent hat eine Notiz geliefert`,
				body: result.text.slice(0, 180)
			}, ...s.alerts] }));
			return result.text;
		} catch (err) {
			set({ lastError: err instanceof Error ? err.message : "Agent fehlgeschlagen" });
			return null;
		}
	},
	sendFloor: async (text) => {
		const trimmed = text.trim();
		if (!trimmed || get().chatting) return;
		const userMsg = {
			id: `c-${Date.now()}`,
			ts: new Date().toISOString(),
			author: "you" as const,
			text: trimmed
		};
		set((s) => ({
			messages: [...s.messages, userMsg],
			chatting: true,
			lastError: null
		}));
		const prompt = `Verlauf:\n${get().messages.slice(-14).map((m) => `${m.author}: ${m.text}`).join("\n")}\n\nNeue Nachricht von Du:\n${trimmed}`;
		let replies: { bot: FloorAuthor; text: string }[] = [];
		try {
			const result = await runFloorChat({ data: { prompt } });
			if (result.ok) replies = parseFloorReplies(result.text);
			else set({ lastError: result.error });
		} catch (err) {
			set({ lastError: err instanceof Error ? err.message : "Floor-Chat fehlgeschlagen" });
		}
		if (replies.length === 0) replies = [{
			bot: "helmsman",
			text: "Modell gerade nicht erreichbar. Lage: Testlauf 300 Dollar Paper. Kern SPY/VOO/BLK halten. Keine Ausführung zum alten Schluss."
		}];
		for (const reply of replies) {
			await sleep(280);
			const msg = {
				id: `c-${Date.now()}-${reply.bot}`,
				ts: new Date().toISOString(),
				author: reply.bot as FloorAuthor,
				text: reply.text,
				origin: "model" as const,
			};
			set((s) => ({ messages: [...s.messages, msg] }));
		}
		set({ chatting: false });
	},
	markOps: (id, status, preview) => set((s) => ({ ops: s.ops.map((t) => t.id === id ? {
		...t,
		status,
		preview: preview ?? t.preview
	} : t) })),
	addOpsDraft: (task) => set((s) => ({ ops: [task, ...s.ops] })),
	harvestWeek: (week) => {
		if (week.lesson) return;
		if (get().harvests.some((h) => h.week === week.week)) return;
		if (get().liveStatus === "abort") return;
		const at = new Date().toISOString();
		const overlayEur = week.overlayEur ?? 0;
		const divEur = week.divEur ?? 0;
		const gross = week.overlayEur != null ? overlayEur + divEur : harvestFromReturn(week.startEur || START_EUR, week.bookPct).grossEur;
		if (gross <= 0) return;
		const priced = harvestFromReturn(gross, 100);
		const payout = makeHarvest({
			at,
			month: monthKey(),
			source: overlayEur > 0 ? "overlay" : "div",
			week: week.week,
			...priced,
			note: week.overlayEur != null
				? `Paper ${week.week}: realisiert Beimischung ${overlayEur.toFixed(2)} € plus Dividende ${divEur.toFixed(2)} €. Bleibt im Book. Kein Echtgeld.`
				: `Paper ${week.week}: digital ${week.startEur.toLocaleString("de-DE")} €. Kein Echtgeld.`,
		});
		const harvests = [payout, ...get().harvests];
		const totals = monthTotals(harvests);
		const generatedWeeks = get().demos.filter((d) => d.generated).length;
		const projected = projectMonthEnd(totals.harvestedNet, monthlyGrossRate(get().demos), get().liveNotional);
		const decision = abortDecision({
			harvestedNet: totals.harvestedNet,
			projectedNet: projected,
			liveStatus: "live",
			generatedWeeks,
		});
		set((s) => ({
			harvests,
			liveStatus: decision.status,
			messages: [
				...s.messages,
				{
					id: `c-pay-${at}`,
					ts: at,
					author: "forge" as const,
					text: `Gebucht ${payout.netEur.toFixed(2)} € auf dem Paper. ${payout.note}`
				},
				...decision.kill ? [{
					id: `c-abort-${at}`,
					ts: at,
					author: "skipper" as const,
					text: decision.reason
				}] : []
			]
		}));
		persistPaper(get());
	},
	abortLive: (reason) => {
		const at = new Date().toISOString();
		const watch = get().watch;
		let nextWatch = watch;
		if (watch && watch.status !== "complete") {
			const positions = trimOverlay(watch.positions);
			nextWatch = {
				...finishWatch({
					...watch,
					status: "paused",
					spyLast: watch.spyLast
				}, positions, watch.cashEur),
				interventions: [...watch.interventions, {
					id: `i-abort-${at}`,
					at,
					day: watch.day,
					kind: "trim-overlay",
					note: "Abbruch: Overlay halbiert, Kern bleibt."
				}]
			};
		}
		set((s) => ({
			liveStatus: "abort",
			watch: nextWatch,
			messages: [...s.messages, {
				id: `c-abort-${at}`,
				ts: at,
				author: "skipper" as const,
				text: reason ?? "Overlay manuell pausiert. Kern SPY/VOO/BLK steht. 300-$-Test läuft als Paper weiter."
			}]
		}));
	},
	resumeLive: () => {
		const at = new Date().toISOString();
		const totals = monthTotals(get().harvests);
		const projected = projectMonthEnd(totals.harvestedNet, monthlyGrossRate(get().demos), get().liveNotional);
		const decision = abortDecision({
			harvestedNet: totals.harvestedNet,
			projectedNet: projected,
			liveStatus: "live",
			generatedWeeks: get().demos.filter((d) => d.generated).length,
		});
		if (decision.kill) {
			set((s) => ({
				lastError: "Overlay bleibt pausiert, bis du es wieder startest.",
				messages: [...s.messages, {
					id: `c-resume-${at}`,
					ts: at,
					author: "skipper" as const,
					text: decision.reason
				}]
			}));
			return;
		}
		set((s) => ({
			liveStatus: "live",
			lastError: null,
			messages: [...s.messages, {
				id: `c-resume-${at}`,
				ts: at,
				author: "skipper" as const,
				text: `Live wieder an. ${decision.reason}`
			}]
		}));
	},
	sendMandateToDemo: (id) => {
		const plan = get().mandates.find((m) => m.id === id);
		if (!plan) return;
		if (get().trials.some((t) => t.sourceId === id && t.week.startsWith("T-"))) {
			if (get().trials.find((t) => t.sourceId === id)) return;
		}
		const at = new Date().toISOString();
		const tape = get().tape;
		const ticker = plan.universe[0] ?? "SPY";
		const trial = Object.keys(tape).length
			? trialFromTape({
				id: `tt-${at}`,
				ticker,
				sourceId: id,
				tape,
				at,
				thesis: plan.fix,
			})
			: {
				id: `tt-${at}`,
				week: `T-${plan.house.split(" ")[0] ?? "IB"}`.slice(0, 12),
				source: "mandate" as const,
				sourceId: id,
				label: `${plan.house} — Quote offen`,
				startedAt: at,
				bookPct: 0,
				spyPct: 0,
				relativePct: 0,
				hit: false,
				note: `${plan.fix} Kein Tape, keine erfundene Wochenrendite aus der 10J-CAGR.`,
			};
		set((s) => ({
			trials: [trial, ...s.trials],
			mandates: s.mandates.map((m) => m.id === id ? {
				...m,
				status: "sent" as const,
				trialId: trial.id
			} : m),
			messages: [...s.messages, {
				id: `c-mand-${at}`,
				ts: at,
				author: "score" as const,
				text: `${plan.house} in die Trading-Demo. Korrigierte 10J-Quote ${plan.improvedHit} %, CAGR ${plan.improvedCagr} % gegen SPY ${plan.spyCagr10y} %.`
			}]
		}));
	},
	trainTeam: async (team) => {
		if (get().training) return;
		set({
			training: true,
			lastError: null
		});
		const ids = team === "trade" ? [
			"cart",
			"signal",
			"till",
			"drift",
			"vein",
			"skipper"
		] : team === "mandate" ? [
			"audit",
			"scout",
			"score"
		] : [
			"ledger",
			"callbook",
			"meridian",
			"pulse",
			"shadow",
			"helmsman"
		];
		for (const id of ids) {
			set({ bots: get().bots.map((b) => b.id === id ? {
				...b,
				status: "running"
			} : b) });
			await sleep(280);
			set({ bots: get().bots.map((b) => b.id === id ? {
				...b,
				status: "done",
				lastRun: new Date().toISOString()
			} : b) });
		}
		const desk = team === "research" ? "research" : team;
		const prompt = team === "trade" ? "Schulung Trading-Team. Hole den neuesten Stand hoher Wichtigkeit (Konsum, Social, Banken, Trends) UND das, was andere uebersehen (Insides). Testlauf 300 Dollar: was fuellt das Book, was ist Kapital. Keine Sentiment-Entries ohne Filing. Kurz, Ticker GROSS." : team === "mandate" ? "Schulung Mandat-Team. Neueste oeffentliche Modellportfolios von Goldman, JPM, Morgan Stanley, UBS, Vanguard, BlackRock, Schwab, Fidelity. Fehler, Korrektur, 10J vs SPY. Was in die Demo muss." : "Schulung Research. Latest Filings, Prints, 13F, Makro hoher Wichtigkeit plus das Uebersehene. 300-Dollar-Test zuerst.";
		let text = null;
		try {
			const result = await runDeskAgent({ data: {
				desk,
				prompt
			} });
			if (result.ok) text = result.text;
			else set({ lastError: result.error });
		} catch (err) {
			set({ lastError: err instanceof Error ? err.message : "Schulung fehlgeschlagen" });
		}
		const at = new Date().toISOString();
		const insight: Insight = {
			id: `in-${at}`,
			at,
			team,
			bot: (team === "trade" ? "skipper" : team === "mandate" ? "audit" : "helmsman") as FloorAuthor,
			kind: "fresh" as const,
			heading: text ? text.split("\n").filter(Boolean)[0].slice(0, 88) : "Schulung lokal — Modell offline",
			body: text ?? "Ohne Live-Modell: AVGO-ASIC-Threads und URTH-Flow bleiben die Insides. TSLA-Spike bleibt Lärm.",
			tickers: [
				"AVGO",
				"URTH",
				"BLK",
				"JPM"
			],
			weight: "high" as const
		};
		set((s) => ({
			insights: [insight, ...s.insights],
			training: false,
			messages: [...s.messages, {
				id: `c-train-${at}`,
				ts: at,
				author: insight.bot,
				text: `Schulung ${team} durch. ${insight.heading}`
			}]
		}));
	},
	decideProposal: (id, status) => {
		const at = new Date().toISOString();
		set((s) => ({
			proposals: s.proposals.map((p) => p.id === id ? {
				...p,
				status
			} : p),
			messages: [...s.messages, {
				id: `c-pp-${at}`,
				ts: at,
				author: "edict" as const,
				text: `Profil ${id}: ${status}. Geht ins nächste Weekly.`
			}]
		}));
	},
	setAutoPilot: (on) => {
		writeAutoPref(on, get().lastTick);
		const at = new Date().toISOString();
		set((s) => ({
			autoPilot: on,
			messages: [...s.messages.slice(-79), {
				id: `c-auto-${at}`,
				ts: at,
				author: "skipper" as const,
				text: on ? "Autopilot an. Paper 24/7, kein echtes Geld. Weekly kommt von selbst." : "Autopilot Halt. Bots stehen. Du greifst manuell ein."
			}],
			autoLog: [makeAutoEvent("skipper", "trade", on ? "Autopilot an." : "Autopilot Halt.", at), ...s.autoLog].slice(0, 24)
		}));
	},
	tickAutopilot: async () => {
		if (!get().autoPilot || get().ticking) return;
		if (get().demoRunning || get().running || get().reviewing || get().training) return;
		set({
			ticking: true,
			lastError: null
		});
		const at = new Date().toISOString();
		const n = get().tickCount + 1;
		try {
			const prevMarket = get().market;
			if (!get().tapeAsOf || Date.now() - Date.parse(get().tapeAsOf ?? at) > 18e4) await get().loadTape();
			const marketJustOpened = prevMarket === "closed" && get().market === "open";
			let watch = get().watch;
			if (!watch || watch.status === "idle") await get().startWatch("live");
			else if (watch.status === "complete") await get().startWatch("live");
			watch = get().watch;
			if (watch && watch.status === "watching") {
				const closeDate = lastCloseDate(get().tape.SPY);
				const live = watch.phase === "live" || watch.day >= 7;
				if (live) {
					const last = lastMapFromTape(get().tape, get().watchlist);
					const prevNav = watch.sessionDate === closeDate ? watch.prevCloseNavEur : watch.navEur;
					watch = withPeaks(markLiveBook({
						...watch,
						phase: "live",
						status: "watching",
						tapeCloseDate: closeDate,
						sessionDate: closeDate,
						prevCloseNavEur: prevNav ?? watch.navEur,
					}, last, get().eurUsd || watch.eurUsd));
					const ident = bookIdentity({
						positions: watch.positions,
						cashEur: watch.cashEur,
						eurUsd: watch.eurUsd,
						navEur: watch.navEur,
					});
					if (ident.lock && !watch.tradeLock) watch = { ...watch, tradeLock: ident.lock };
				} else {
					const step = (watch.sessionStep ?? 0) + 1;
					if (step >= TICKS_PER_DAY) {
						await get().advanceWatchDay();
						watch = get().watch;
						if (watch && watch.status === "complete") {
							watch = { ...watch, status: "watching", phase: "live", sessionStep: 0, tapeCloseDate: closeDate };
						} else if (watch) {
							watch = { ...watch, sessionStep: 0 };
						}
					} else {
						watch = markWatchSession(watch, get().tape, step);
					}
				}
				let pulseEvent: PulseEvent | null = null;
				let payout: HarvestEvent | null = null;
				if (watch && watch.status !== "paused") {
					const quotes: Record<string, { last: number; asOf: string; source: "yahoo" | "seed" | "unknown" }> = {};
					const tape = get().tape;
					for (const pos of watch.positions) {
						const bars = tape[pos.ticker] ?? [];
						quotes[pos.ticker] = {
							last: pos.lastUsd,
							asOf: lastBarTime(bars) ?? closeDate,
							source: get().tapeSource ?? "unknown",
						};
					}
					const sessionChange: Record<string, number> = {};
					for (const t of get().watchlist) sessionChange[t.symbol] = t.changePct;
					const before = watch;
					const tick = executePulseTick({
						watch,
						fills: get().fills,
						market: get().market,
						closeDate,
						tapeAsOf: get().tapeAsOf,
						tapeSource: get().tapeSource === "yahoo" ? "yahoo" : "seed",
						now: new Date(at),
						quotes,
						marketJustOpened,
						sessionChangePct: sessionChange,
						scores: get().lastTilt?.scores,
					});
					watch = tick.watch;
					pulseEvent = tick.pulseEvent;
					payout = harvestFromPulse(before, tick.realizedUsd, at, tick.decision?.note ?? "", get().liveStatus);
					const huddle = {
						at,
						action: tick.decision?.kind ?? ("hold" as const),
						skipper: tick.botLines.find((b) => b.bot === "skipper")?.text ?? "",
						forge: tick.botLines.find((b) => b.bot === "forge")?.text ?? "",
						till: tick.botLines.find((b) => b.bot === "till")?.text ?? "",
						drift: tick.botLines.find((b) => b.bot === "drift")?.text ?? "",
					};
					const huddleBots: FloorAuthor[] = ["skipper", "forge", "till", "drift"];
					set((s) => ({
						watch,
						lastHuddle: huddle,
						bots: s.bots.map((b) => {
							if (!huddleBots.includes(b.id as FloorAuthor)) return b;
							const line =
								b.id === "skipper" ? huddle.skipper
								: b.id === "forge" ? huddle.forge
								: b.id === "till" ? huddle.till
								: huddle.drift;
							return {
								...b,
								status: pulseEvent && pulseEvent.bot === b.id ? "alert" : "done",
								lastRun: at,
								summary: line,
							};
						}),
						pulseLog: pulseEvent ? [pulseEvent, ...s.pulseLog].slice(0, 40) : s.pulseLog,
						fills: tick.fills.slice(0, 80),
						harvests: payout ? [payout, ...s.harvests] : s.harvests,
						messages: pulseEvent
							? [...s.messages.slice(-79), {
								id: `c-pulse-${at}`,
								ts: at,
								author: pulseEvent.bot,
								text: pulseEvent.text,
								origin: "pulse" as const,
							}]
							: s.messages,
						autoLog: pulseEvent
							? [makeAutoEvent(pulseEvent.bot, "trade", pulseEvent.text, at), ...s.autoLog].slice(0, 24)
							: s.autoLog,
					}));
					if (pulseEvent) persistPaper(get());
				} else if (watch) {
					set({ watch });
				}
			}
			if (n % 60 === 1) {
				const pending = get().mandates.find((m) => m.status === "review" || m.status === "scored" && !m.trialId);
				if (pending) get().sendMandateToDemo(pending.id);
			}
			if (n % 60 === 20) {
				const insight = localInsight(get().watchlist, n, at);
				set((s) => ({ insights: [insight, ...s.insights].slice(0, 20) }));
			}
			if (n % 90 === 3) {
				const idea = localIdea(get().watchlist, n);
				if (idea && !get().ideas.some((i) => i.id === idea.id || i.ticker === idea.ticker && i.status === "open")) set((s) => ({ ideas: [idea, ...s.ideas].slice(0, 16) }));
				const open = get().ideas.find((i) => i.status === "open");
				if (open && !get().trials.some((t) => t.sourceId === open.id)) {
					const trial = trialFromTape({
						id: `tt-auto-${at}`,
						ticker: open.ticker,
						sourceId: open.id,
						tape: get().tape,
						at,
						thesis: open.thesis,
					});
					set((s) => ({
						ideas: s.ideas.map((i) => i.id === open.id ? {
							...i,
							status: "in-demo"
						} : i),
						trials: [trial, ...s.trials].slice(0, 16)
					}));
				}
			}
			const weeklyDue = n % 120 === 0;
			if (weeklyDue) {
				const totals = monthTotals(get().harvests);
				const projected = projectMonthEnd(totals.harvestedNet, monthlyGrossRate(get().demos), get().liveNotional);
				const weekly = compileLocalWeekly({
					harvests: get().harvests,
					demos: get().demos,
					watch: get().watch,
					liveStatus: get().liveStatus,
					liveNotional: get().liveNotional,
					proposals: get().proposals,
					lessons: get().lessons,
					trials: get().trials,
					tickCount: n
				});
				const brief = compileLocalBrief({
					watchlist: get().watchlist,
					watch: get().watch,
					liveStatus: get().liveStatus,
					harvestedNet: totals.harvestedNet,
					projected,
					tickCount: n
				});
				set((s) => ({
					weeklies: [weekly, ...s.weeklies].slice(0, 8),
					briefs: [brief, ...s.briefs].slice(0, 6)
				}));
			}
			writeAutoPref(true, at);
			set((s) => ({
				tickCount: n,
				lastTick: at,
				ticking: false,
			}));
			if (n % TICKS_PER_DAY === 0) persistPaper(get());
		} catch (err) {
			set({
				ticking: false,
				lastError: err instanceof Error ? err.message : "Autopilot-Tick fehlgeschlagen"
			});
		}
	},
	applyLesson: (id) => {
		const lesson = get().lessons.find((l) => l.id === id);
		if (!lesson || lesson.status === "applied") return;
		const lessons = get().lessons.map((l) => l.id === id ? { ...l, status: "applied" as const } : l);
		const report = tiltStrategy({
			base: STRATEGY,
			tape: get().tape,
			lessons,
			liveStatus: get().liveStatus,
		});
		const tilted = applyTilt(STRATEGY, report);
		let watch = get().watch;
		if (watch && watch.status !== "complete" && lesson.tickers?.length) {
			let positions = watch.positions;
			let cashEur = watch.cashEur;
			for (const ticker of lesson.tickers) {
				if (lesson.effect === "ban") {
					const flat = flattenTicker(positions, ticker);
					positions = flat.positions;
					cashEur += flat.cashUsd / watch.eurUsd;
				}
			}
			watch = finishWatch({ ...watch }, positions, cashEur);
			watch = {
				...watch,
				interventions: [...watch.interventions, {
					id: `i-lesson-${id}`,
					at: new Date().toISOString(),
					day: watch.day,
					kind: "flat",
					ticker: lesson.tickers[0],
					note: `Lesson ${lesson.week} applied. ${lesson.tickers.join(", ")} ${lesson.effect === "ban" ? "flach" : "verkleinert"}.`,
				}],
			};
		}
		set({
			lessons,
			strategy: tilted,
			lastTilt: report,
			watch,
		});
		persistPaper(get());
	},
}));
