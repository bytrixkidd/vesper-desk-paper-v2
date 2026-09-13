import { createFileRoute } from "@tanstack/react-router";
import { ChartDesk } from "@/components/desks/chart-desk";

export const Route = createFileRoute("/_desk/charts")({
  component: ChartDesk,
});
