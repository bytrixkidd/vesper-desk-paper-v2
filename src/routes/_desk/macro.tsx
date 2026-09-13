import { createFileRoute } from "@tanstack/react-router";
import { MacroDesk } from "@/components/desks/macro-desk";

export const Route = createFileRoute("/_desk/macro")({
  component: MacroDesk,
});
