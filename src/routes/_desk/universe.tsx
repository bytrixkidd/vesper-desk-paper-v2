import { createFileRoute } from "@tanstack/react-router";
import { UniverseDesk } from "@/components/desks/universe-desk";

export const Route = createFileRoute("/_desk/universe")({
  component: UniverseDesk,
});
