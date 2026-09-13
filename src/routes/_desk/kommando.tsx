import { createFileRoute } from "@tanstack/react-router";
import { CommandCenter } from "@/components/desks/command-center";

export const Route = createFileRoute("/_desk/kommando")({
  component: CommandCenter,
});
