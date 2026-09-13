export type DeskId =
  | "vesper"
  | "command"
  | "chat"
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

export type BotStatus = "idle" | "running" | "done" | "alert";

export type Ticker = {
  symbol: string;
  name: string;
  sector: string;
  last: number;
  changePct: number;
  cik: string;
};

export type Agent = {
  id: string;
  name: string;
  desk: DeskId;
  vertical: string;
  status: BotStatus;
  lastRun: string;
  summary: string;
};

export type AlertItem = {
  id: string;
  ts: string;
  desk: DeskId;
  severity: "info" | "watch" | "material";
  ticker?: string;
  headline: string;
  body: string;
};

export type BriefSection = {
  heading: string;
  body: string;
  tickers?: string[];
};

export type BriefAction = {
  ticker: string;
  action: string;
  rationale: string;
};

export type MorningBrief = {
  id: string;
  deliveredAt: string;
  title: string;
  lede: string;
  sections: BriefSection[];
  actions: BriefAction[];
  generated?: boolean;
};

export type Filing = {
  id: string;
  ticker: string;
  form: "10-K" | "10-Q" | "8-K" | "13F-HR" | "13D" | "4";
  filedAt: string;
  title: string;
  material: boolean;
  delta: string;
  accession: string;
};

export type SentimentPost = {
  handle: string;
  text: string;
  faves: number;
  ts: string;
};

export type SentimentRow = {
  ticker: string;
  mentions24h: number;
  baseline30d: number;
  zscore: number;
  tone: number;
  flag: boolean;
  posts: SentimentPost[];
};

export type WhaleAction = "new" | "add" | "hold" | "trim" | "exit";

export type WhalePosition = {
  id: string;
  fund: string;
  ticker: string;
  shares: number;
  priorShares: number;
  valueMm: number;
  changePct: number;
  action: WhaleAction;
};

export type EarningsQa = {
  analyst: string;
  exchange: string;
};

export type EarningsGuidance = "raised" | "maintained" | "lowered" | "cut" | "withdrawn";

export type EarningsNote = {
  ticker: string;
  date: string;
  ceoTone: number;
  cfoTone: number;
  epsActual: number;
  epsCons: number;
  revActualB: number;
  revConsB: number;
  guidance: EarningsGuidance;
  qa: EarningsQa[];
  summary: string;
};

export type MacroEvent = {
  id: string;
  when: string;
  type: string;
  title: string;
  implication: string;
  watchlistMovePct: number;
  flagged: boolean;
};

export type OpsKind = "lp" | "invoice" | "calendar" | "intel" | "coord";
export type OpsStatus = "queued" | "drafted" | "sent";

export type OpsTask = {
  id: string;
  kind: OpsKind;
  title: string;
  status: OpsStatus;
  preview: string;
};

export type Bar = {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type Quote = {
  last: number;
  prev: number;
  changePct: number;
  currency: string;
};

export type ChartSpan = "3mo" | "1y" | "5y" | "10y" | "max";

export type TapePayload = {
  asOf: string;
  source: "yahoo" | "seed";
  market: "open" | "closed";
  sessionLabel: string;
  eurUsd: number;
  quotes: Record<string, Quote>;
  bars: Record<string, Bar[]>;
};

export type AssetClass = "equity" | "crypto" | "metal" | "world" | "bond";

export type UniverseAsset = {
  symbol: string;
  yahoo: string;
  name: string;
  class: AssetClass;
  last: number;
  changePct: number;
  currency: "USD" | "EUR";
};

export type AssetTape = {
  symbol: string;
  yahoo: string;
  asOf: string;
  source: "yahoo" | "seed";
  interval: "1d" | "1wk";
  span: ChartSpan;
  quote: Quote;
  bars: Bar[];
};

export type TapeTone = "up" | "down" | "flat";

export type TapeNote = {
  date: string;
  ticker: string;
  tone: TapeTone;
  headline: string;
  bullets: string[];
};

export type TapeReading = {
  date: string;
  symbol: string;
  changePct: number;
  headline: string;
  bullets: string[];
  source: "seed" | "tape";
  tone: TapeTone;
};

export type StrategyGroup = {
  id: string;
  label: string;
  weightPct: number;
  tickers: string[];
  note: string;
};

export type StrategySleeve = {
  ticker: string;
  weightPct: number;
  role: string;
};

export type BookStrategy = {
  id: string;
  name: string;
  thesis: string;
  target: string;
  groups: StrategyGroup[];
  sleeves: StrategySleeve[];
  tiltNote?: string;
};

export type FloorTeam = "pm" | "research" | "feedback" | "mandate" | "trade" | "design";

export type FloorAuthor =
  | "you"
  | "ledger"
  | "callbook"
  | "meridian"
  | "pulse"
  | "shadow"
  | "helmsman"
  | "stab"
  | "forge"
  | "gauge"
  | "canon"
  | "audit"
  | "scout"
  | "score"
  | "cart"
  | "signal"
  | "till"
  | "drift"
  | "vein"
  | "skipper"
  | "anvil"
  | "caliper"
  | "edict"
  | "prism";

export type FloorMessage = {
  id: string;
  ts: string;
  author: FloorAuthor;
  text: string;
  origin?: "seed" | "model" | "system" | "pulse";
};

export type LessonStatus = "open" | "applied";

export type Lesson = {
  id: string;
  week: string;
  source: "demo" | "live" | "bot";
  mistake: string;
  fix: string;
  owner: FloorAuthor;
  status: LessonStatus;
  tickers?: string[];
  effect?: "ban" | "trim" | "note";
};

export type DemoTrade = {
  id: string;
  ticker: string;
  side: "long" | "short" | "flat";
  entry: number;
  exit: number;
  pnlPct: number;
  note: string;
};

export type DemoWeek = {
  id: string;
  week: string;
  label: string;
  startedAt: string;
  bookPct: number;
  spyPct: number;
  startEur: number;
  navEur: number;
  relativePct: number;
  trades: DemoTrade[];
  verdict: string;
  generated?: boolean;
  lesson?: boolean;
  windowKey?: string;
  overlayEur?: number;
  divEur?: number;
  tiltNote?: string;
};

export type DemoPosition = {
  ticker: string;
  shares: number;
  costUsd: number;
  lastUsd: number;
  weightPct: number;
  sleeve: "core" | "toll" | "overlay";
};

export type DemoStandup = {
  id: string;
  day: number;
  at: string;
  date: string;
  navEur: number;
  bookPct: number;
  spyPct: number;
  relativePct: number;
  note: string;
  market: "open" | "closed";
};

export type InterveneKind =
  | "rebalance"
  | "trim-overlay"
  | "add-core"
  | "flat"
  | "halt"
  | "resume"
  | "take-profit"
  | "trail"
  | "add-overlay";

export type DemoIntervention = {
  id: string;
  at: string;
  day: number;
  kind: InterveneKind;
  note: string;
  ticker?: string;
};

export type DemoWatchStatus = "idle" | "watching" | "paused" | "meeting" | "complete";

export type DemoWatch = {
  id: string;
  label: string;
  startedAt: string;
  endsAt: string;
  day: number;
  status: DemoWatchStatus;
  startEur: number;
  navEur: number;
  cashEur: number;
  spyStart: number;
  spyLast: number;
  eurUsd: number;
  bookPct: number;
  spyPct: number;
  relativePct: number;
  positions: DemoPosition[];
  standups: DemoStandup[];
  interventions: DemoIntervention[];
  equity: { t: string; nav: number; spy: number; day: number }[];
  window: { date: string }[];
  windowKey?: string;
  overlayStartEur?: number;
  peaks?: Record<string, number>;
  phase?: "replay" | "live";
  sessionStep?: number;
  harvestedOverlayEur?: number;
  tapeCloseDate?: string;
  actedKeys?: string[];
  bookVersion?: number;
  tradeLock?: string | null;
  cfgVersion?: string;
  prevCloseNavEur?: number;
  sessionDate?: string;
  experimentId?: string;
  bookId?: string;
  historyStatus?: "complete" | "incomplete";
};

export type PaperFillStatus = "planned" | "simulated_filled" | "cancelled" | "blocked";

export type PriceSource = "yahoo" | "seed" | "unknown";

export type OrderReviewAction = "keep-planned" | "fill" | "cancel" | "block";

export type OrderReview = {
  at: string;
  action: OrderReviewAction;
  reason: string;
};

export type PaperFill = {
  id: string;
  bookVersion: number;
  decidedAt: string;
  filledAt: string | null;
  status: PaperFillStatus;
  symbol: string;
  side: "buy" | "sell";
  shares: number;
  priceUsd: number;
  costUsd: number;
  cashDeltaUsd: number;
  dataKey: string;
  note: string;
  sessionDate?: string;
  market?: "open" | "closed";
  experimentId?: string;
  bookId?: string;
  dataAsOf?: string | null;
  priceAsOf?: string | null;
  priceSource?: PriceSource;
  costBps?: number;
  stopUsd?: number | null;
  reservedUsd?: number;
  validUntil?: string | null;
  thesis?: string;
  reviews?: OrderReview[];
};

export type BookHistoryStatus = "complete" | "incomplete";
export type BookRole = "active" | "archive";

export type BookRecord = {
  experimentId: string;
  bookId: string;
  role: BookRole;
  cfgVersion: string;
  historyStatus: BookHistoryStatus;
  historyNote: string;
  createdAt: string;
  archivedAt?: string;
  startUsd: number;
  navUsd: number | null;
  pnlUsd: number | null;
  storageKey: string;
};

export type BookIndex = {
  version: 1;
  activeBookId: string;
  books: BookRecord[];
  splitAt: string;
};

export type HarvestSource = "overlay" | "div" | "core";

export type HarvestEvent = {
  id: string;
  at: string;
  month: string;
  source: HarvestSource;
  week?: string;
  grossEur: number;
  taxEur: number;
  netEur: number;
  note: string;
  lesson?: boolean;
};

export type InclusionItem = {
  item: string;
  owner: string;
  eta: string;
  status: "queued" | "drafted" | "applied";
};

export type ProfileKind = "add" | "remove" | "expand" | "trim";
export type ProfileStatus = "discuss" | "queued" | "applied" | "rejected";
export type ProfileTeam = "research" | "feedback" | "mandate" | "trade";

export type ProfileProposal = {
  id: string;
  team: ProfileTeam;
  kind: ProfileKind;
  profile: string;
  rationale: string;
  owner: FloorAuthor;
  status: ProfileStatus;
};

export type WeeklyBrief = {
  id: string;
  weekOf: string;
  deliveredAt: string;
  title: string;
  lede: string;
  revenue: { bookPct: number; spyPct: number; note: string };
  feedback: { bot: string; heading: string; body: string }[];
  inclusion?: InclusionItem[];
  proposals: ProfileProposal[];
  dual: { cashNote: string; capitalNote: string };
  generated?: boolean;
};

export type MandatePlan = {
  id: string;
  house: string;
  title: string;
  published: string;
  universe: string[];
  thesis: string;
  flaws: string[];
  fix: string;
  hitRate10y: number;
  cagr10y: number;
  spyCagr10y: number;
  maxDd: number;
  improvedCagr: number;
  improvedHit: number;
  status: "review" | "scored" | "sent" | "applied";
  trialId?: string;
};

export type Insight = {
  id: string;
  at: string;
  team: ProfileTeam;
  bot: FloorAuthor;
  kind: "fresh" | "overlooked";
  heading: string;
  body: string;
  tickers: string[];
  weight: "high" | "mid" | "low";
};

export type TradeIdea = {
  id: string;
  bot: FloorAuthor;
  ticker: string;
  side: "long" | "short" | "flat";
  thesis: string;
  cashNow: string;
  capital: string;
  status: "open" | "in-demo" | "killed";
};

export type TradeTrial = {
  id: string;
  week: string;
  source: "mandate" | "trade" | "demo";
  sourceId: string;
  label: string;
  startedAt: string;
  bookPct: number;
  spyPct: number;
  relativePct: number;
  hit: boolean;
  note: string;
};

export type LiveStatus = "live" | "abort";

export type AutoEvent = {
  id: string;
  at: string;
  bot: FloorAuthor;
  desk: DeskId;
  text: string;
};

export type PulseKind = "hold" | "take" | "trail" | "pull" | "trim" | "buy";

export type PulseEvent = {
  id: string;
  at: string;
  bot: FloorAuthor;
  kind: PulseKind;
  ticker?: string;
  text: string;
  grossEur?: number;
};

export type BotHuddle = {
  at: string;
  skipper: string;
  forge: string;
  till: string;
  drift: string;
  action: PulseKind;
};
