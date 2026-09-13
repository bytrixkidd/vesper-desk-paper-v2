import { createFileRoute } from "@tanstack/react-router";
import { SentimentDesk } from "@/components/desks/sentiment-desk";

export const Route = createFileRoute("/_desk/sentiment")({
  component: SentimentDesk,
});
