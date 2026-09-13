import { createFileRoute } from "@tanstack/react-router";
import { FeedbackDesk } from "@/components/desks/feedback-desk";

export const Route = createFileRoute("/_desk/feedback")({
  component: FeedbackDesk,
});
