import { createFileRoute } from "@tanstack/react-router";
import { EarningsDesk } from "@/components/desks/earnings-desk";

export const Route = createFileRoute("/_desk/earnings")({
  component: EarningsDesk,
});
