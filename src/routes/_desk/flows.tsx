import { createFileRoute } from "@tanstack/react-router";
import { FlowsDesk } from "@/components/desks/flows-desk";

export const Route = createFileRoute("/_desk/flows")({
  component: FlowsDesk,
});
