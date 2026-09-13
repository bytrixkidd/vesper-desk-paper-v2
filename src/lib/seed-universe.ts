import type { UniverseAsset } from "./types";

export const UNIVERSE: UniverseAsset[] = [
  { symbol: "BTC", yahoo: "BTC-USD", name: "Bitcoin", class: "crypto", last: 121400, changePct: 1.82, currency: "USD" },
  { symbol: "ETH", yahoo: "ETH-USD", name: "Ethereum", class: "crypto", last: 4125.4, changePct: 0.94, currency: "USD" },
  { symbol: "SOL", yahoo: "SOL-USD", name: "Solana", class: "crypto", last: 186.4, changePct: 2.41, currency: "USD" },
  { symbol: "GLD", yahoo: "GLD", name: "Gold", class: "metal", last: 334.8, changePct: 0.62, currency: "USD" },
  { symbol: "SLV", yahoo: "SLV", name: "Silber", class: "metal", last: 38.24, changePct: 0.88, currency: "USD" },
  { symbol: "URTH", yahoo: "URTH", name: "Welt-Aktienkorb", class: "world", last: 184.62, changePct: 0.37, currency: "USD" },
  { symbol: "QQQ", yahoo: "QQQ", name: "Nasdaq-Korb", class: "world", last: 598.2, changePct: 0.51, currency: "USD" },
  { symbol: "IWM", yahoo: "IWM", name: "Korb kleiner Firmen", class: "world", last: 241.5, changePct: -0.22, currency: "USD" },
  { symbol: "EEM", yahoo: "EEM", name: "Schwellenländer-Aktien", class: "world", last: 48.92, changePct: 0.18, currency: "USD" },
  { symbol: "VGK", yahoo: "VGK", name: "Europa-Aktien", class: "world", last: 81.4, changePct: 0.29, currency: "USD" },
  { symbol: "TLT", yahoo: "TLT", name: "lange US-Anleihen", class: "bond", last: 88.64, changePct: -0.41, currency: "USD" },
];

export const ASSET_CLASS_LABEL: Record<UniverseAsset["class"], string> = {
  equity: "Aktien",
  crypto: "Krypto",
  metal: "Metalle",
  world: "Welt / Index",
  bond: "Anleihen",
};

export function findUniverse(symbol: string) {
  return UNIVERSE.find((a) => a.symbol === symbol || a.yahoo === symbol) ?? null;
}
