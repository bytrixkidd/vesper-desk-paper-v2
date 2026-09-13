import { createFileRoute } from "@tanstack/react-router";
import { VesperBridge } from "@/components/vesper/bridge";

export const Route = createFileRoute("/_desk/")({
  component: VesperBridge,
});
