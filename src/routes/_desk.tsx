import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_desk")({
  component: DeskLayout,
});

function DeskLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
