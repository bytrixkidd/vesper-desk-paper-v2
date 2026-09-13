import { Link, useRouterState } from "@tanstack/react-router";
import { Download, Menu } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { CATCH_UP_MAX, readAutoPref, TICK_MS } from "@/lib/autopilot";
import { formatUsd } from "@/lib/format";
import { getAiStatus } from "@/lib/grok";
import { bookView } from "@/lib/paper";
import { useDeskStore, hydratePaper } from "@/lib/store";
import { useVesperStore } from "@/lib/vesper/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LiveClock } from "@/components/clock";
import { NAV } from "@/components/nav-items";
import { BookBar } from "@/components/desks/book-strip";
import { VesperDock } from "@/components/vesper/dock";
import { VesperHost } from "@/components/vesper/host";
import { Toaster } from "sonner";
import { CODE_ZIP_HREF, CODE_ZIP_NAME } from "@/lib/code-zip";

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-1">
      <span className="flex size-8 items-center justify-center rounded-sm bg-elevated shadow-[var(--shadow-border)]">
        <span className="font-display text-lg leading-none text-primary">V</span>
      </span>
      <span className="flex flex-col">
        <span className="font-display text-lg leading-none tracking-tight text-fg">Vesper</span>
        <span className="text-2xs tracking-[0.14em] text-muted uppercase">Desk</span>
      </span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Desks">
      {NAV.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            to={item.href}
            data-vesper={item.action}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-2.5 text-sm transition-colors duration-150",
              active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{item.label}</span>
              <span className="truncate text-2xs text-subtle">{item.kicker}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function Sidebar({ className }: { className?: string }) {
  const watch = useDeskStore((s) => s.watch);
  const storeEur = useDeskStore((s) => s.eurUsd);
  const view = bookView({
    startEur: watch?.startEur,
    navEur: watch?.navEur,
    cashEur: watch?.cashEur,
    eurUsd: watch?.eurUsd || storeEur,
  });
  const nav = view.navUsd;
  const start = view.depositedUsd;
  const pnl = view.pnlUsd;
  return (
    <aside className={cn("flex h-full w-sidebar shrink-0 flex-col gap-4 border-r border-border bg-bg px-3 py-4", className)}>
      <Brand />
      <div className="shell-scroll min-h-0 flex-1 pr-1">
        <NavList />
      </div>
      <div className="shrink-0 space-y-1 px-1">
        <LiveClock />
        <p className="text-2xs leading-relaxed text-subtle">
          Eingezahlt {formatUsd(start)}
        </p>
        <p className="text-2xs leading-relaxed text-subtle">
          Stand {formatUsd(nav)} · {pnl >= 0 ? "+" : ""}
          {formatUsd(pnl)}
        </p>
      </div>
    </aside>
  );
}

function PreviewMicHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(window.parent !== window);
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;
  return (
    <div className="flex items-center gap-2">
      <p className="hidden text-2xs text-muted xl:block">Die Vorschau gibt das Mikrofon nicht an Vesper weiter.</p>
      <Button
        size="sm"
        variant="secondary"
        title="Die Vorschau gibt das Mikrofon nicht an Vesper weiter."
        onClick={() => window.open(window.location.href, "_blank", "noopener")}
      >
        In eigenem Tab öffnen
      </Button>
    </div>
  );
}

function TopStatusBar({ onMenu }: { onMenu: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = NAV.find((n) => n.href === pathname) ?? NAV[0]!;
  const aiAvailable = useDeskStore((s) => s.aiAvailable);
  const autoPilot = useDeskStore((s) => s.autoPilot);
  const tickCount = useDeskStore((s) => s.tickCount);
  const setAutoPilot = useDeskStore((s) => s.setAutoPilot);
  const open = useVesperStore((s) => s.open);
  const setOpen = useVesperStore((s) => s.setOpen);
  const liveStatus = useDeskStore((s) => s.liveStatus);

  return (
    <header className="flex h-status shrink-0 items-center gap-3 border-b border-border bg-bg px-3">
      <div className="lg:hidden">
        <Button variant="ghost" size="icon" aria-label="Menü öffnen" onClick={onMenu}>
          <Menu />
        </Button>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-fg">{current.label}</p>
        <p className="truncate text-2xs text-subtle">{current.kicker}</p>
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <PreviewMicHint />
        <span className="hidden items-center gap-1.5 text-2xs text-muted md:flex">
          <span className={cn("size-1.5 rounded-full", aiAvailable ? "bg-long" : aiAvailable === false ? "bg-subtle" : "bg-warn pulse-dot")} />
          {aiAvailable ? "Grok" : aiAvailable === false ? "offline" : "…"}
        </span>
        <span className="hidden items-center gap-1.5 text-2xs text-muted lg:flex">
          <span className={cn("size-1.5 rounded-full", autoPilot ? "bg-long pulse-dot" : "bg-subtle")} />
          {autoPilot ? `Autopilot ${tickCount}` : "Halt"}
        </span>
        <span className="hidden text-2xs text-subtle xl:inline">{liveStatus === "live" ? "Live offen" : "Live aus"}</span>
        <Button size="sm" variant={autoPilot ? "ghost" : "secondary"} onClick={() => setAutoPilot(!autoPilot)}>
          {autoPilot ? "Halt" : "Autopilot"}
        </Button>
        <Button asChild size="sm" variant="default">
          <a
            href={CODE_ZIP_HREF}
            download={CODE_ZIP_NAME}
            onClick={() => toast.message("Suche in Downloads nach Vesper-Paper-Code.zip")}
          >
            <Download />
            Code herunterladen
          </a>
        </Button>
        {pathname !== "/" ? (
          <Button size="sm" variant={open ? "secondary" : "ghost"} onClick={() => setOpen(!open)}>
            {open ? "Vesper zu" : "Vesper"}
          </Button>
        ) : null}
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const setAiAvailable = useDeskStore((s) => s.setAiAvailable);
  const autoPilot = useDeskStore((s) => s.autoPilot);
  const loadTape = useDeskStore((s) => s.loadTape);
  const tickAutopilot = useDeskStore((s) => s.tickAutopilot);
  const setAutoPilot = useDeskStore((s) => s.setAutoPilot);
  const onHome = pathname === "/";

  useEffect(() => {
    let cancelled = false;
    getAiStatus()
      .then((r) => {
        if (!cancelled) setAiAvailable(r.available);
      })
      .catch(() => {
        if (!cancelled) setAiAvailable(false);
      });
    hydratePaper();
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key) return;
      if (ev.key.startsWith("vesper-paper-book:") || ev.key === "vesper-paper-index-v1") {
        hydratePaper();
      }
    };
    window.addEventListener("storage", onStorage);
    void loadTape().then(() => useVesperStore.getState().rebuildIntel());
    const pref = readAutoPref();
    if (!pref.on) setAutoPilot(false);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, [setAiAvailable, loadTape, setAutoPilot]);

  useEffect(() => {
    if (!autoPilot) return;
    let cancelled = false;
    let busy = false;
    const run = async (times: number) => {
      if (busy) return;
      busy = true;
      try {
        for (let i = 0; i < times; i++) {
          if (cancelled || !useDeskStore.getState().autoPilot) break;
          await tickAutopilot();
        }
      } finally {
        busy = false;
      }
    };
    const pref = readAutoPref();
    const elapsed = pref.lastTick ? Date.now() - Date.parse(pref.lastTick) : TICK_MS;
    const missed = Math.min(CATCH_UP_MAX, Math.max(1, Math.floor(elapsed / TICK_MS) || 1));
    void run(missed);
    const id = window.setInterval(() => void run(1), TICK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [autoPilot, tickAutopilot]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-dvh overflow-hidden bg-bg text-fg">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Zum Inhalt
        </a>
        <Sidebar className="hidden lg:flex" />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopStatusBar onMenu={() => setMenu(true)} />
          {!onHome ? <BookBar /> : null}
          <div className="relative flex min-h-0 flex-1">
            <main id="main" className={cn("shell-scroll min-h-0 min-w-0 flex-1", onHome ? "overflow-hidden px-0 py-0" : "px-4 py-5 pb-28 sm:px-6")}>
              <div key={pathname} className={cn(onHome ? "h-full min-h-0" : "page-fade min-h-full")}>
                {children}
              </div>
            </main>
            {!onHome ? <VesperDock /> : null}
          </div>
        </div>
        <Sheet open={menu} onOpenChange={setMenu}>
          <SheetContent side="left" className="w-sidebar gap-6 p-0 pt-0">
            <Sidebar />
          </SheetContent>
        </Sheet>
        <Toaster
          theme="dark"
          position="bottom-left"
          toastOptions={{
            style: {
              background: "#181b1d",
              color: "#e6e4df",
              border: "1px solid rgba(230,228,223,0.12)",
            },
          }}
        />
        <VesperHost />
      </div>
    </TooltipProvider>
  );
}
