import { createFileRoute } from "@tanstack/react-router";
import { OvernightDesk } from "@/components/desks/overnight-desk";

export const Route = createFileRoute("/_desk/research")({
  component: OvernightDesk,
});
