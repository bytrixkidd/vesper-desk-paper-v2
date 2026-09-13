import type { ChartRange } from "@/lib/charts";
import type { DeskId, FloorAuthor } from "@/lib/types";

export const TICKER_ALIAS: Record<string, string> = {
  nvidia: "NVDA",
  nvidias: "NVDA",
  nvda: "NVDA",
  apple: "AAPL",
  aapl: "AAPL",
  microsoft: "MSFT",
  msft: "MSFT",
  amazon: "AMZN",
  amzn: "AMZN",
  meta: "META",
  facebook: "META",
  tesla: "TSLA",
  tsla: "TSLA",
  alphabet: "GOOGL",
  google: "GOOGL",
  googl: "GOOGL",
  broadcom: "AVGO",
  avgo: "AVGO",
  jpmorgan: "JPM",
  jp: "JPM",
  jpm: "JPM",
  lilly: "LLY",
  "eli lilly": "LLY",
  lly: "LLY",
  unitedhealth: "UNH",
  unh: "UNH",
  goldman: "GS",
  "goldman sachs": "GS",
  gs: "GS",
  blackrock: "BLK",
  "black rock": "BLK",
  blk: "BLK",
  spy: "SPY",
  "s&p": "SPY",
  "s&p500": "SPY",
  "s&p 500": "SPY",
  "s and p": "SPY",
  "s und p": "SPY",
  index: "SPY",
  aktienkorb: "SPY",
  "us-aktienkorb": "SPY",
  "us aktienkorb": "SPY",
  "grosse us-aktienkorb": "SPY",
  "grosse us aktienkorb": "SPY",
  "der grosse us-aktienkorb": "SPY",
  vanguard: "VOO",
  voo: "VOO",
  "vanguard-aktienkorb": "VOO",
  "vanguard aktienkorb": "VOO",
  bitcoin: "BTC",
  btc: "BTC",
  ethereum: "ETH",
  eth: "ETH",
  solana: "SOL",
  sol: "SOL",
  gold: "GLD",
  gld: "GLD",
  silber: "SLV",
  silver: "SLV",
  slv: "SLV",
  "msci world": "URTH",
  msci: "URTH",
  urth: "URTH",
  nasdaq: "QQQ",
  qqq: "QQQ",
  russell: "IWM",
  iwm: "IWM",
  tlt: "TLT",
  anleihen: "TLT",
};

export const DESK_ALIAS: Record<string, DeskId> = {
  vesper: "vesper",
  kern: "vesper",
  jarvis: "vesper",
  start: "vesper",
  home: "vesper",
  startseite: "vesper",
  kommando: "command",
  command: "command",
  chat: "chat",
  floor: "chat",
  "floor chat": "chat",
  "floor-chat": "chat",
  discussion: "chat",
  diskussion: "chat",
  charts: "charts",
  chart: "charts",
  universum: "universe",
  universe: "universe",
  demo: "demo",
  paper: "demo",
  trading: "trade",
  trade: "trade",
  mandat: "mandate",
  mandate: "mandate",
  feedback: "feedback",
  overnight: "research",
  research: "research",
  filings: "filings",
  filing: "filings",
  edgar: "filings",
  sentiment: "sentiment",
  whale: "flows",
  whales: "flows",
  flows: "flows",
  "whale-flows": "flows",
  earnings: "earnings",
  transkript: "earnings",
  makro: "macro",
  macro: "macro",
  fed: "macro",
  stabschef: "ops",
  ops: "ops",
};

export const BOT_ALIAS: Record<string, FloorAuthor> = {
  ledger: "ledger",
  callbook: "callbook",
  meridian: "meridian",
  pulse: "pulse",
  shadow: "shadow",
  helmsman: "helmsman",
  stab: "stab",
  forge: "forge",
  gauge: "gauge",
  canon: "canon",
  audit: "audit",
  scout: "scout",
  score: "score",
  cart: "cart",
  signal: "signal",
  till: "till",
  drift: "drift",
  vein: "vein",
  skipper: "skipper",
  anvil: "anvil",
  caliper: "caliper",
  edict: "edict",
  prism: "prism",
};

export const EXAMPLE_ASKS = [
  { id: "check", label: "Prüfung", text: "CHECK" },
  { id: "test", label: "Testlauf", text: "Was macht der 300-Dollar-Test gerade?" },
  { id: "plain", label: "Einfach", text: "Erkläre den Stand in einfachen Worten." },
  { id: "nvda", label: "Nvidia", text: "Was hat Nvidia gemacht?" },
  { id: "bots", label: "Bots", text: "Was machen die Bots gerade?" },
  { id: "buy", label: "Kauf", text: "Warum wird nicht mehr gekauft?" },
] as const;

export function fold(s: string) {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveTicker(raw: string): string | null {
  const f = fold(raw);
  if (TICKER_ALIAS[f]) return TICKER_ALIAS[f]!;
  const upper = raw.trim().toUpperCase();
  if (/^[A-Z]{2,5}$/.test(upper) && TICKER_ALIAS[fold(upper)]) return TICKER_ALIAS[fold(upper)]!;
  for (const [k, v] of Object.entries(TICKER_ALIAS)) {
    if (f.includes(k)) return v;
  }
  return null;
}

export function findAllTickers(raw: string): string[] {
  const f = fold(raw);
  const found: string[] = [];
  const keys = Object.keys(TICKER_ALIAS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k.length < 3 && !new RegExp(`\\b${k}\\b`).test(f)) continue;
    if (f.includes(k)) {
      const sym = TICKER_ALIAS[k]!;
      if (!found.includes(sym)) found.push(sym);
    }
  }
  return found;
}

export function resolveDesk(raw: string): DeskId | null {
  const f = fold(raw);
  if (DESK_ALIAS[f]) return DESK_ALIAS[f];
  for (const [k, v] of Object.entries(DESK_ALIAS)) {
    if (f.includes(k)) return v;
  }
  return null;
}

export function resolveRange(raw: string): ChartRange | null {
  const f = fold(raw);
  if (/gesamtlaufzeit|gesamtzeit|seit beginn|ganze laufzeit|\balles\b|\bmax\b|\bgesamt\b/.test(f)) return "ALL";
  if (/10\s*j|zehn\s*jahr|10y|10j/.test(f)) return "10J";
  if (/5\s*j|fuenf\s*jahr|5y|5j/.test(f)) return "5J";
  if (/1\s*j|ein\s*jahr|jahr|1y|1j/.test(f)) return "1J";
  if (/3\s*m|drei\s*monat|quartal|3m/.test(f)) return "3M";
  if (/1\s*m|monat|30\s*tag|1m/.test(f)) return "1M";
  if (/woche|7\s*tag|1w|diese woche/.test(f)) return "1W";
  return null;
}

export function resolveBot(raw: string): FloorAuthor | null {
  const f = fold(raw);
  for (const [k, v] of Object.entries(BOT_ALIAS)) {
    if (f.includes(k)) return v;
  }
  return null;
}
