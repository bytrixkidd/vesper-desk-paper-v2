import { createFileRoute } from "@tanstack/react-router";
import { DemoDesk } from "@/components/desks/demo-desk";

export const Route = createFileRoute("/_desk/demo")({
  component: DemoDesk,
});
