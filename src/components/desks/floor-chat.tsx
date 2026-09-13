import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { FLOOR_BOTS, FLOOR_TEAM_LABEL, floorName } from "@/lib/floor";
import { formatEt } from "@/lib/format";
import { useDeskStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kicker } from "@/components/shared";
import type { FloorAuthor, FloorTeam } from "@/lib/types";
import { useVesperFocus } from "@/lib/vesper/use-focus";

const AVATAR: Record<FloorAuthor, string> = {
  you: "DU",
  ledger: "LE",
  callbook: "CA",
  meridian: "ME",
  pulse: "PU",
  shadow: "SH",
  helmsman: "HE",
  stab: "ST",
  forge: "FO",
  gauge: "GA",
  canon: "CN",
  audit: "AU",
  scout: "SC",
  score: "SO",
  cart: "CT",
  signal: "SI",
  till: "TI",
  drift: "DR",
  vein: "VE",
  skipper: "SK",
  anvil: "AN",
  caliper: "CL",
  edict: "ED",
  prism: "PR",
};

const TEAMS: FloorTeam[] = ["research", "feedback", "mandate", "trade", "design"];

export function FloorChat() {
  const messages = useDeskStore((s) => s.messages);
  const chatting = useDeskStore((s) => s.chatting);
  const sendFloor = useDeskStore((s) => s.sendFloor);
  const lastError = useDeskStore((s) => s.lastError);
  const [draft, setDraft] = useState("");
  const [team, setTeam] = useState<FloorTeam | "all">("all");
  const bottomRef = useRef<HTMLDivElement>(null);

  useVesperFocus((focus) => {
    if (focus.floorBot) {
      const bot = FLOOR_BOTS.find((b) => b.id === focus.floorBot);
      if (bot && !bot.you) setTeam(bot.team);
    }
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, chatting]);

  function submit() {
    const text = draft.trim();
    if (text.length < 2 || chatting) return;
    setDraft("");
    void sendFloor(text);
  }

  const visibleBots = FLOOR_BOTS.filter((b) => b.you || team === "all" || b.team === team);

  return (
    <div className="-mx-3 -mt-5 -mb-5 flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden sm:-mx-5 sm:-mt-6 sm:-mb-6">
      <header className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <Kicker>Gemeinsamer Floor</Kicker>
        <h1 className="mt-1 text-xl text-fg sm:text-3xl">Alle Bots. Und du.</h1>
        <p className="mt-1 hidden max-w-2xl text-sm text-muted sm:block">
          Research, Feedback, Mandat, Trading. Mit @Name adressierst du direkt. 300 $ Testlauf.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="shrink-0 overflow-x-auto border-b border-border lg:w-52 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <div className="flex gap-1 p-2 lg:flex-col lg:gap-0.5 lg:p-3">
            <button
              type="button"
              onClick={() => setTeam("all")}
              className={cn(
                "min-h-9 rounded-md px-2.5 text-left text-2xs tracking-[0.12em] uppercase",
                team === "all" ? "bg-elevated text-fg" : "text-subtle hover:text-fg",
              )}
            >
              Alle
            </button>
            {TEAMS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTeam(t)}
                className={cn(
                  "min-h-9 rounded-md px-2.5 text-left text-2xs tracking-[0.12em] uppercase",
                  team === t ? "bg-elevated text-fg" : "text-subtle hover:text-fg",
                )}
              >
                {FLOOR_TEAM_LABEL[t]}
              </button>
            ))}
          </div>
          <ul className="flex gap-1 p-2 lg:flex-col lg:gap-0.5 lg:p-3" data-vesper="floor.bots">
            {visibleBots.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  data-vesper={`floor-${b.id}`}
                  onClick={() => {
                    if (b.id === "you") return;
                    setDraft((d) => (d.includes(`@${b.name}`) ? d : `${d}${d && !d.endsWith(" ") ? " " : ""}@${b.name} `));
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm",
                    b.you ? "text-fg" : "text-muted hover:bg-elevated hover:text-fg",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-sm font-mono text-2xs",
                      b.you ? "bg-primary text-primary-foreground" : "bg-elevated text-fg",
                    )}
                  >
                    {AVATAR[b.id]}
                  </span>
                  <span className="hidden min-w-0 flex-col lg:flex">
                    <span className="truncate font-medium">{b.name}</span>
                    <span className="truncate text-2xs text-subtle">{b.role}</span>
                  </span>
                  <span className="lg:hidden font-medium">{b.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <ul className="mx-auto max-w-3xl space-y-4">
              {messages.map((m) => {
                const you = m.author === "you";
                return (
                  <li key={m.id} className={cn("flex gap-3", you && "flex-row-reverse")}>
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm font-mono text-2xs",
                        you ? "bg-primary text-primary-foreground" : "bg-elevated text-fg",
                      )}
                    >
                      {AVATAR[m.author]}
                    </span>
                    <div className={cn("min-w-0 max-w-[min(36rem,85%)]", you && "text-right")}>
                      <div className={cn("flex items-baseline gap-2", you && "justify-end")}>
                        <span className="text-sm font-medium text-fg">{floorName(m.author)}</span>
                        <span className="font-mono text-2xs tabular-nums text-subtle">{formatEt(m.ts)}</span>
                        {m.origin === "seed" ? (
                          <span className="text-2xs uppercase tracking-[0.12em] text-warn">Lehrbeispiel</span>
                        ) : m.origin === "pulse" ? (
                          <span className="text-2xs uppercase tracking-[0.12em] text-muted">Autopilot</span>
                        ) : m.origin === "model" ? (
                          <span className="text-2xs uppercase tracking-[0.12em] text-muted">Modell</span>
                        ) : m.origin === "system" ? (
                          <span className="text-2xs uppercase tracking-[0.12em] text-muted">System</span>
                        ) : null}
                      </div>
                      <p
                        className={cn(
                          "mt-1 rounded-lg px-3 py-2 text-left text-sm leading-relaxed",
                          you ? "bg-primary/15 text-fg" : "bg-elevated text-fg/90",
                        )}
                      >
                        {m.text}
                      </p>
                    </div>
                  </li>
                );
              })}
              {chatting && (
                <li className="flex gap-3 text-sm text-muted">
                  <span className="flex size-8 items-center justify-center rounded-sm bg-elevated font-mono text-2xs">
                    ···
                  </span>
                  <p className="pt-1.5">Floor schreibt…</p>
                </li>
              )}
              <div ref={bottomRef} />
            </ul>
          </div>

          <div className="shrink-0 border-t border-border px-4 py-3 sm:px-6">
            {lastError && <p className="mb-2 text-xs text-short">{lastError}</p>}
            <form
              className="mx-auto flex max-w-3xl flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="flex flex-wrap gap-1">
                {visibleBots.filter((b) => !b.you).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() =>
                      setDraft((d) => (d.includes(`@${b.name}`) ? d : `${d}${d && !d.endsWith(" ") ? " " : ""}@${b.name} `))
                    }
                    className="rounded-md bg-elevated px-2 py-1 font-mono text-2xs text-muted hover:text-fg"
                  >
                    @{b.name}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <label className="sr-only" htmlFor="floor-input">
                  Nachricht an den Floor
                </label>
                <textarea
                  id="floor-input"
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder="An den Floor — @Pulse @Ledger …"
                  className="min-h-11 max-h-32 flex-1 resize-none rounded-md bg-elevated px-3 py-2.5 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                />
                <Button type="submit" size="icon" disabled={chatting || draft.trim().length < 2} aria-label="Senden">
                  <Send />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
