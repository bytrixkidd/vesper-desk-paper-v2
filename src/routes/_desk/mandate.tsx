import { createFileRoute } from "@tanstack/react-router";
import { MandateDesk } from "@/components/desks/mandate-desk";

export const Route = createFileRoute("/_desk/mandate")({
  component: MandateDesk,
});
