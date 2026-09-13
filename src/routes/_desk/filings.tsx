import { createFileRoute } from "@tanstack/react-router";
import { FilingsDesk } from "@/components/desks/filings-desk";

export const Route = createFileRoute("/_desk/filings")({
  component: FilingsDesk,
});
