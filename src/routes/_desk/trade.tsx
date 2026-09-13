import { createFileRoute } from "@tanstack/react-router";
import { TradeDesk } from "@/components/desks/trade-desk";

export const Route = createFileRoute("/_desk/trade")({
  component: TradeDesk,
});
