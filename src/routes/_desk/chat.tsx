import { createFileRoute } from "@tanstack/react-router";
import { FloorChat } from "@/components/desks/floor-chat";

export const Route = createFileRoute("/_desk/chat")({
  component: FloorChat,
});
