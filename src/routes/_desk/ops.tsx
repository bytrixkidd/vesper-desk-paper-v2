import { createFileRoute } from "@tanstack/react-router";
import { OpsDesk } from "@/components/desks/ops-desk";

export const Route = createFileRoute("/_desk/ops")({
  component: OpsDesk,
});
