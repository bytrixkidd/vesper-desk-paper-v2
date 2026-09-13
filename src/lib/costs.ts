import { COST_BPS } from "./config.ts";

export function applySideCost(priceUsd: number, side: "buy" | "sell", bps = COST_BPS) {
  const slip = priceUsd * (bps / 10_000);
  return side === "buy" ? priceUsd + slip : Math.max(0, priceUsd - slip);
}
