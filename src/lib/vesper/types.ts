import type { ChartRange } from "@/lib/charts";
import type { DeskId, FloorAuthor } from "@/lib/types";

export type PermissionLevel = "view" | "analyze" | "propose" | "prepare" | "execute";

export type VesperStatus = "idle" | "listening" | "thinking" | "executing" | "speaking";

export type VesperPhase =
  | "ready"
  | "listening"
  | "understanding"
  | "analyzing"
  | "opening"
  | "marking"
  | "speaking"
  | "warning";

export type VesperStyle = "normal" | "short" | "plain";

export type SourceTier = "fact" | "calc" | "interpretation";

export type VoiceProvider = "xai" | "browser";

export type SpeechLength = "kurz" | "normal" | "ausfuehrlich";

export type SpeechRate = "langsam" | "natuerlich" | "zuegig";

export type AnswerStage = 1 | 2 | 3;

export type TalkTopic =
  | "security"
  | "diagnosis"
  | "filing"
  | "bots"
  | "flows"
  | "chart"
  | "scenario"
  | "risk"
  | "brief"
  | null;

export type VesperAction =
  | { type: "navigate"; desk: DeskId }
  | { type: "selectTicker"; symbol: string }
  | { type: "setChartRange"; range: ChartRange }
  | { type: "markDay"; iso: string; label?: string }
  | { type: "highlight"; targetId: string; label: string }
  | { type: "scrollTo"; targetId: string }
  | { type: "openFiling"; id?: string; symbol?: string }
  | { type: "openEarnings"; ticker: string }
  | { type: "showSentiment"; ticker: string }
  | { type: "showFlows"; ticker: string }
  | { type: "openFloorBot"; bot: FloorAuthor }
  | { type: "consultBots"; question: string }
  | { type: "dailyBrief" }
  | { type: "computeRisk"; amountEur: number; symbol?: string }
  | { type: "compare"; left: string; right: string }
  | { type: "scenario"; which: "base" | "up" | "down"; symbol?: string }
  | { type: "startDiagnosis"; symbol: string; days: number; thesis?: string }
  | { type: "diagnosisStatus" }
  | { type: "killDiagnosis" }
  | { type: "refreshDiagnosis" }
  | { type: "intelAsk"; which: "need" | "odds" | "bots" | "why" | "next" | "falsify" | "for" | "against" | "change" }
  | { type: "preparePaper"; symbol: string; side: "buy" | "sell"; amountEur: number }
  | { type: "prepareLive"; symbol: string; side: "buy" | "sell"; amountEur: number }
  | { type: "stop" }
  | { type: "mute" }
  | { type: "setStyle"; style: VesperStyle }
  | { type: "openSection"; sectionId: DeskId }
  | { type: "openSecurity"; symbol: string }
  | { type: "selectChartRange"; range: ChartRange }
  | { type: "selectChartDate"; date: string }
  | { type: "focusElement"; targetId: string }
  | { type: "highlightElement"; targetId: string; label?: string }
  | { type: "highlightChartRange"; start: string; end: string }
  | { type: "scrollToElement"; targetId: string }
  | { type: "openEvidence"; evidenceId?: string; symbol?: string }
  | { type: "openSource"; sourceId?: string; symbol?: string }
  | { type: "showBotOpinions"; symbol?: string }
  | { type: "showDiagnosis"; diagnosisId?: string; symbol?: string }
  | { type: "showCurrentDiagnoses"; symbol?: string }
  | { type: "updateDiagnosis"; diagnosisId?: string }
  | { type: "compareSecurities"; symbols: string[] }
  | { type: "showScenario"; symbol?: string; scenario: "base" | "up" | "down" }
  | { type: "showPortfolioPosition"; symbol: string }
  | { type: "prepareTradePlan"; symbol: string }
  | { type: "goBack" }
  | { type: "closeDetail" }
  | { type: "setStage"; stage: AnswerStage };

export type VesperSource = {
  title: string;
  kind: "filing" | "tape" | "bot" | "macro" | "calc" | "earnings" | "sentiment" | "flows" | "brief";
  at: string;
  fetchedAt: string;
  bot?: FloorAuthor;
  symbol?: string;
  note: string;
  tier: SourceTier;
  href?: string;
  stale?: boolean;
};

export type VesperConfidence = {
  label: "niedrig" | "mittel" | "hoch";
  why: string;
  strengthens: string[];
  weakens: string[];
};

export type VesperTurn = {
  id: string;
  ts: string;
  role: "user" | "vesper";
  text: string;
  spoken?: string;
  source: "typed" | "voice" | "system";
  actions?: VesperAction[];
  sources?: VesperSource[];
  confidence?: VesperConfidence;
};

export type AuditEntry = {
  id: string;
  ts: string;
  command: string;
  interpretation: string;
  tools: string[];
  bots: FloorAuthor[];
  data: string;
  ui: string;
  financial: string;
  confirm?: string;
  error?: string;
};

export type TradeDraft = {
  id: string;
  ts: string;
  mode: "paper" | "live";
  symbol: string;
  side: "buy" | "sell";
  amountEur: number;
  orderType: "market" | "limit";
  limit?: number;
  expectedValue: number;
  fees: number;
  riskEur: number;
  allocationNote: string;
  status: "draft" | "awaiting-confirm" | "done" | "rejected" | "blocked";
  note: string;
};

export type CheckStatus = "pass" | "fail" | "watch" | "na";

export type CheckKind =
  | "price"
  | "volume"
  | "vol"
  | "relative"
  | "structure"
  | "gap"
  | "accum"
  | "sentiment"
  | "filing"
  | "insider"
  | "earnings"
  | "whale"
  | "macro"
  | "mandate"
  | "lesson";

export type ThesisState = "hält" | "wankt" | "bricht";

export type WindowPattern = "akkumulation" | "distribution" | "seitwärts" | "aufwärts" | "abwärts";

export type SleeveRole = "core" | "toll" | "overlay";

export type DiagnosisCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  kind: CheckKind;
};

export type DiagnosisDay = {
  day: number;
  date: string;
  close: number | null;
  changePct: number;
  vsSpy: number | null;
  volumeRel: number | null;
  rangePct: number | null;
  tone: "up" | "down" | "flat";
  note: string;
  thesisNow: string;
  thesisState: ThesisState;
  checks: DiagnosisCheck[];
  confirmDelta: number;
  missing: string[];
  closeLoc: number | null;
  gapPct: number | null;
  sma5: number | null;
  sma20: number | null;
  cumVsSpy: number | null;
};

export type DiagnosisBaseline = {
  close: number;
  low5: number;
  high5: number;
  vol20: number;
  atr: number;
  spyClose: number;
  sma5: number;
  sma20: number;
};

export type DiagnosisWindow = {
  sumPct: number;
  cumVsSpy: number | null;
  upDays: number;
  downDays: number;
  volUp: number;
  volDown: number;
  failDays: number;
  watchDays: number;
};

export type Diagnosis = {
  id: string;
  symbol: string;
  name: string;
  thesis: string;
  antithesis: string;
  workingThesis: string;
  thesisState: ThesisState;
  startedAt: string;
  startDate: string;
  endDate: string;
  days: number;
  day: number;
  status: "running" | "done" | "killed";
  support: number | null;
  resist: number | null;
  holdLevel: number | null;
  confirm: string[];
  reject: string[];
  baseline: DiagnosisBaseline | null;
  score: { confirm: number; reject: number };
  lastReviewed: string | null;
  sleeve: SleeveRole;
  pattern: WindowPattern | null;
  window: DiagnosisWindow;
  upcoming: string[];
  log: DiagnosisDay[];
  result?: {
    verdict: "bestätigt" | "teilweise" | "widerlegt";
    evidence: string[];
    risks: string[];
    entry: string;
    exit: string;
    rr: string;
    confidence: VesperConfidence;
    rec: "beobachten" | "verwerfen" | "paper" | "entscheiden";
    pattern: WindowPattern;
    mandate: string;
    lessons: string[];
    upcoming: string[];
  };
};

export type VesperPrefs = {
  autoSpeak: boolean;
  muted: boolean;
  volume: number;
  wakeWord: boolean;
  style: VesperStyle;
  permission: PermissionLevel;
  liveExecute: boolean;
  reportLength: SpeechLength;
  voiceId: string;
  speechRate: SpeechRate;
  conversation: boolean;
  bargeIn: boolean;
  captions: boolean;
  micDeviceId: string;
};

export type VesperMemory = {
  lastVisit: string | null;
  lastBriefDay: string | null;
  lastSeenAlert: string | null;
  greetedSession: boolean;
  preferredMarkets: string[];
  riskNote: string;
  rejected: string[];
  prefs: VesperPrefs;
};

export type VesperFocus = {
  nonce: number;
  desk: DeskId | null;
  symbol: string | null;
  range: ChartRange | null;
  iso: string | null;
  markLabel: string | null;
  highlightId: string | null;
  highlightLabel: string | null;
  filingId: string | null;
  earningsTicker: string | null;
  sentimentTicker: string | null;
  flowTicker: string | null;
  floorBot: FloorAuthor | null;
  scrollId: string | null;
  compare: string | null;
  chartStart: string | null;
  chartEnd: string | null;
  caption: string | null;
  topic: TalkTopic;
  detailOpen: boolean;
};

export const DESK_HREF: Record<DeskId, string> = {
  vesper: "/",
  command: "/kommando",
  chat: "/chat",
  research: "/research",
  filings: "/filings",
  sentiment: "/sentiment",
  flows: "/flows",
  earnings: "/earnings",
  macro: "/macro",
  ops: "/ops",
  charts: "/charts",
  universe: "/universe",
  mandate: "/mandate",
  trade: "/trade",
  demo: "/demo",
  feedback: "/feedback",
};

export const PERMISSION_ORDER: PermissionLevel[] = ["view", "analyze", "propose", "prepare", "execute"];

export const DEFAULT_PREFS: VesperPrefs = {
  autoSpeak: true,
  muted: false,
  volume: 0.9,
  wakeWord: false,
  style: "plain",
  permission: "prepare",
  liveExecute: false,
  reportLength: "normal",
  voiceId: "sal",
  speechRate: "natuerlich",
  conversation: true,
  bargeIn: true,
  captions: true,
  micDeviceId: "",
};
