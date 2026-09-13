/** Human labels. Ticker bleibt sichtbar, damit SPY/VOO/BLK nicht verwechselt werden. */
export const TITLE_NAMES: Record<string, string> = {
  NVDA: "Nvidia",
  AAPL: "Apple",
  MSFT: "Microsoft",
  AMZN: "Amazon",
  GOOGL: "Alphabet",
  GOOG: "Alphabet",
  META: "Meta",
  TSLA: "Tesla",
  AVGO: "Broadcom",
  LLY: "Eli Lilly",
  JPM: "JPMorgan",
  UNH: "UnitedHealth",
  GS: "Goldman Sachs",
  BLK: "BlackRock",
  SPY: "US-Aktienkorb",
  VOO: "Vanguard-Aktienkorb",
  QQQ: "Nasdaq-Korb",
  IWM: "Korb kleiner Firmen",
  TLT: "lange US-Anleihen",
  GLD: "Gold",
  SLV: "Silber",
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  URTH: "Welt-Aktienkorb",
  EEM: "Schwellenländer-Aktien",
  VGK: "Europa-Aktien",
};

/** Was das Instrument wirklich ist. Keine Marketing-Hülle. */
export const INSTRUMENT_NOTE: Record<string, string> = {
  SPY: "SPDR S&P 500 ETF. Derselbe Index wie VOO, nur ein anderes Vehikel.",
  VOO: "Vanguard S&P 500 ETF. Derselbe Index wie SPY, nicht ein zweiter Markt.",
  BLK: "BlackRock Inc., Einzelaktie des Verwalters. Kein iShares-Fonds, keine breite Streuung.",
  QQQ: "Invesco QQQ, Nasdaq-100.",
};

const SPOKEN: Record<string, string> = {
  SPY: "der große US-Aktienkorb SPY, also der S-und-P 500",
  VOO: "der Vanguard-Aktienkorb VOO, derselbe S-und-P 500 wie SPY",
  QQQ: "der Nasdaq-Korb",
  IWM: "der Korb kleiner US-Firmen",
  URTH: "der Welt-Aktienkorb",
  TLT: "lange US-Anleihen",
  EEM: "Aktien aus Schwellenländern",
  VGK: "europäische Aktien",
  BLK: "die BlackRock-Aktie, nicht der Fonds",
};

const SORTED = Object.keys(TITLE_NAMES).sort((a, b) => b.length - a.length);

export function displayName(symbol: string, name?: string) {
  if (TITLE_NAMES[symbol]) return TITLE_NAMES[symbol];
  if (name) {
    return name
      .replace(/\bNVIDIA\b/g, "Nvidia")
      .replace(/SPDR S&P 500/g, "US-Aktienkorb")
      .replace(/Vanguard S&P 500/g, "Vanguard-Aktienkorb")
      .replace(/S&P 500/g, "US-Aktienkorb")
      .replace(/SPDR /g, "")
      .replace(/iShares /g, "")
      .replace(/Invesco /g, "");
  }
  return symbol;
}

export function instrumentNote(symbol: string) {
  return INSTRUMENT_NOTE[symbol] ?? null;
}

export function spokenTitle(symbol: string, name?: string) {
  return SPOKEN[symbol] ?? displayName(symbol, name);
}

export function replaceTickers(text: string) {
  let s = text;
  for (const sym of SORTED) {
    const name = TITLE_NAMES[sym]!;
    s = s.replace(new RegExp(`\\b${sym}\\b`, "g"), `${name} (${sym})`);
  }
  return s
    .replace(/\bNVIDIA\b/g, "Nvidia")
    .replace(/\s+/g, " ")
    .trim();
}