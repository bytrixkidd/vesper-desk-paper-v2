import { create } from "zustand";
import { toast } from "sonner";
import { LIVE_NOTIONAL_EUR } from "@/lib/paper";
import { useDeskStore } from "@/lib/store";
import type { FloorAuthor, TradeIdea } from "@/lib/types";
import { greetingText, localCeo } from "./ceo";
import { advanceDiagnosis, createDiagnosis, diagnosisLine, killDiagnosis, migrateDiagnosis, refreshDiagnosis } from "./diagnose";
import { loadAudit, loadDiagnoses, loadDrafts, loadIntel, loadMemory, loadSession, markSessionGreeted, saveAudit, saveDiagnoses, saveDrafts, saveIntel, saveMemory } from "./memory";
import { parseIntent } from "./parse";
import { gate } from "./permissions";
import { buildSnapshot, lastDrop, lastMove, lastRise } from "./snapshot";
import { WHALES } from "@/lib/seed";
import { buildBundle, gatherDesk, suggestDiagnosisDays, type IntelCard, type IntelNotice } from "./intel";
import type {
  AnswerStage,
  AuditEntry,
  Diagnosis,
  PermissionLevel,
  TalkTopic,
  TradeDraft,
  VesperAction,
  VesperFocus,
  VesperMemory,
  VesperPhase,
  VesperPrefs,
  VesperSource,
  VesperStatus,
  VesperStyle,
  VesperTurn,
} from "./types";
import { DESK_HREF } from "./types";

const emptyFocus = (): VesperFocus => ({
  nonce: 0,
  desk: null,
  symbol: null,
  range: null,
  iso: null,
  markLabel: null,
  highlightId: null,
  highlightLabel: null,
  filingId: null,
  earningsTicker: null,
  sentimentTicker: null,
  flowTicker: null,
  floorBot: null,
  scrollId: null,
  compare: null,
  chartStart: null,
  chartEnd: null,
  caption: null,
  topic: null,
  detailOpen: false,
});

type VesperState = {
  open: boolean;
  focusMode: boolean;
  status: VesperStatus;
  turns: VesperTurn[];
  sources: VesperSource[];
  audit: AuditEntry[];
  diagnoses: Diagnosis[];
  drafts: TradeDraft[];
  pending: TradeDraft | null;
  focus: VesperFocus;
  memory: VesperMemory;
  insight: boolean;
  navPath: string | null;
  lastError: string | null;
  abortSpeak: number;
  diagTick: number;
  micOn: boolean;
  partial: string;
  audioReady: boolean;
  conversation: boolean;
  micLevel: number;
  micCause: "permission" | "iframe" | "device" | "signal" | "secure" | null;
  ttsProvider: "xai" | "browser" | null;
  voiceTrace: { micMs: number; sttMs: number; modelMs: number; ttsMs: number; audioMs: number };
  intel: Record<string, IntelCard>;
  intelBriefSpoken: string;
  intelBriefDisplay: string;
  notices: IntelNotice[];
  pendingNoticeSpeak: string | null;
  spokenNoticeIds: string[];
  intelReady: boolean;
  phase: VesperPhase;
  stage: AnswerStage;
  history: string[];
  caption: string | null;
  setOpen: (open: boolean) => void;
  setFocusMode: (v: boolean) => void;
  setPrefs: (p: Partial<VesperPrefs>) => void;
  setPermission: (level: PermissionLevel) => void;
  greetIfNeeded: () => void;
  ask: (text: string, source: "typed" | "voice") => Promise<void>;
  applyAi: (say: string, actions: VesperAction[], sources: VesperSource[]) => void;
  confirmDraft: (id: string, accept: boolean) => void;
  tickDiagnoses: () => void;
  stop: () => void;
  checkAutoOpen: () => void;
  rebuildIntel: () => void;
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function resolveMarkIso(symbol: string, iso: string): { iso: string; label: string; dir: "up" | "down" | "flat" } {
  const bars = useDeskStore.getState().tape[symbol] ?? [];
  if (iso === "DROP") {
    const drop = lastDrop(bars);
    if (!drop) return { iso: "2026-07-29", label: "Letzter Rückgang", dir: "down" };
    return { iso: drop.iso, label: `Rückgang ${drop.iso}`, dir: "down" };
  }
  if (iso === "RISE") {
    const rise = lastRise(bars);
    if (!rise) return { iso: bars.at(-1)?.t.slice(0, 10) ?? "2026-08-21", label: "Letzter Anstieg", dir: "up" };
    return { iso: rise.iso, label: `Anstieg ${rise.iso}`, dir: "up" };
  }
  if (iso === "MOVE") {
    const move = lastMove(bars);
    if (!move) return { iso: bars.at(-1)?.t.slice(0, 10) ?? "2026-08-21", label: "Letzte Veränderung", dir: "flat" };
    return {
      iso: move.iso,
      label: move.dir === "down" ? "Hier begann der Rückgang." : "Hier begann der Anstieg.",
      dir: move.dir,
    };
  }
  return { iso, label: iso, dir: "flat" };
}

function emptyIntel() {
  if (typeof window === "undefined") return { cards: {} as Record<string, IntelCard>, notices: [] as IntelNotice[], briefSpoken: "", briefDisplay: "", asOf: "" };
  return loadIntel();
}

const bootIntel = emptyIntel();

export const useVesperStore = create<VesperState>((set, get) => ({
  open: false,
  focusMode: false,
  status: "idle",
  turns: [],
  sources: [],
  audit: typeof window === "undefined" ? [] : loadAudit(),
  diagnoses: typeof window === "undefined" ? [] : loadDiagnoses().map(migrateDiagnosis),
  drafts: typeof window === "undefined" ? [] : loadDrafts(),
  pending: null,
  focus: emptyFocus(),
  memory: typeof window === "undefined" ? loadMemory() : loadMemory(),
  insight: false,
  navPath: null,
  lastError: null,
  abortSpeak: 0,
  diagTick: 0,
  micOn: false,
  partial: "",
  audioReady: false,
  conversation: false,
  micLevel: 0,
  micCause: null,
  ttsProvider: null,
  voiceTrace: { micMs: 0, sttMs: 0, modelMs: 0, ttsMs: 0, audioMs: 0 },
  intel: bootIntel.cards,
  intelBriefSpoken: bootIntel.briefSpoken,
  intelBriefDisplay: bootIntel.briefDisplay,
  notices: bootIntel.notices,
  pendingNoticeSpeak: null,
  spokenNoticeIds: [],
  intelReady: false,
  phase: "ready",
  stage: 1,
  history: [],
  caption: null,
  setOpen: (open) => {
    set({ open });
    if (open) get().greetIfNeeded();
  },
  setFocusMode: (v) => set({ focusMode: v, open: v ? true : get().open }),
  setPrefs: (p) => {
    const memory = { ...get().memory, prefs: { ...get().memory.prefs, ...p } };
    saveMemory(memory);
    set({ memory });
  },
  setPermission: (level) => get().setPrefs({ permission: level }),
  greetIfNeeded: () => {
    const session = loadSession();
    if (session.greeted) return;
    get().rebuildIntel();
    const snap = buildSnapshot();
    const first = true;
    const text = greetingText(snap, get().memory.lastVisit, first, get().intelBriefSpoken || undefined);
    markSessionGreeted();
    const memory = { ...get().memory, lastVisit: new Date().toISOString(), greetedSession: true };
    saveMemory(memory);
    const turn: VesperTurn = {
      id: uid("t"),
      ts: new Date().toISOString(),
      role: "vesper",
      text: "Hallo.",
      spoken: "Hallo.",
      source: "system",
    };
    set({ memory, turns: [...get().turns, turn] });
  },
  stop: () => set({ status: "idle", phase: "ready", abortSpeak: get().abortSpeak + 1, conversation: false, micOn: false, partial: "" }),
  ask: async (text, source) => {
    const trimmed = text.trim();
    if (trimmed.length < 1) return;
    const user: VesperTurn = {
      id: uid("u"),
      ts: new Date().toISOString(),
      role: "user",
      text: trimmed,
      source,
    };
    set({ turns: [...get().turns, user], status: "thinking", lastError: null, open: true });
    try {
    const parsed = parseIntent(trimmed, { symbol: get().focus.symbol, topic: get().focus.topic, stage: get().stage });
    if (parsed.stop) {
      if (parsed.actions.some((a) => a.type === "mute")) get().setPrefs({ muted: true, autoSpeak: false });
      get().stop();
      const turn: VesperTurn = {
        id: uid("t"),
        ts: new Date().toISOString(),
        role: "vesper",
        text: parsed.actions.some((a) => a.type === "mute") ? "Ton ist aus." : "In Ordnung.",
        spoken: parsed.actions.some((a) => a.type === "mute") ? "Ton ist aus." : "In Ordnung.",
        source: "system",
        actions: parsed.actions,
      };
      set({ turns: [...get().turns, turn], status: "idle" });
      return;
    }
    const styleAct = parsed.actions.find((a) => a.type === "setStyle");
    if (styleAct && styleAct.type === "setStyle") get().setPrefs({ style: styleAct.style });

    set({ status: "executing", phase: parsed.actions.some((a) => a.type === "navigate") ? "opening" : "analyzing" });
    const execNotes = await executeActions(parsed.actions, get, parsed.topic, parsed.stage);
    get().rebuildIntel();
    const snap = buildSnapshot();
    const local = localCeo({
      text: trimmed,
      parsed,
      snap,
      style: get().memory.prefs.style,
      diagnoses: get().diagnoses,
      drafts: get().drafts,
      length: get().memory.prefs.reportLength,
      intel: get().intel,
      briefSpoken: get().intelBriefSpoken,
      briefDisplay: get().intelBriefDisplay,
      focusSymbol: get().focus.symbol,
      stage: parsed.stage,
      kind: parsed.kind,
    });
    const vesper: VesperTurn = {
      id: uid("t"),
      ts: new Date().toISOString(),
      role: "vesper",
      text: local.say,
      spoken: local.spoken,
      source: "system",
      actions: parsed.actions,
      sources: local.sources,
      confidence: local.confidence,
    };
    const audit: AuditEntry = {
      id: uid("a"),
      ts: vesper.ts,
      command: trimmed,
      interpretation: parsed.interpretation,
      tools: parsed.actions.map((a) => a.type),
      bots: parsed.actions.flatMap((a) => (a.type === "consultBots" ? (["helmsman", "forge", "pulse"] as FloorAuthor[]) : [])),
      data: snap.sessionLabel,
      ui: execNotes.join("; ") || "keine UI",
      financial: parsed.actions.some((a) => a.type === "preparePaper" || a.type === "prepareLive")
        ? "Entwurf"
        : "keine",
    };
    const auditAll = [audit, ...get().audit].slice(0, 200);
    saveAudit(auditAll);
    set({
      turns: [...get().turns, vesper],
      sources: local.sources,
      audit: auditAll,
      status: "idle",
      phase: "ready",
      open: true,
    });
    } catch {
      set({
        status: "idle",
        phase: "ready",
        lastError: "Die Antwort ist nicht durchgekommen. Nochmal senden.",
      });
    }
  },
  applyAi: (say, actions, sources) => {
    if (actions.length) void executeActions(actions, get, get().focus.topic, get().stage);
    const last = get().turns.at(-1);
    if (last && last.role === "vesper") {
      set({
        turns: get().turns.map((t) => (t.id === last.id ? { ...t, text: say, spoken: say, sources, actions } : t)),
        sources,
      });
    }
  },
  confirmDraft: (id, accept) => {
    const drafts = get().drafts.map((d) => {
      if (d.id !== id) return d;
      if (!accept) return { ...d, status: "rejected" as const };
      if (d.mode === "live") {
        if (!get().memory.prefs.liveExecute || get().memory.prefs.permission !== "execute") {
          return {
            ...d,
            status: "blocked" as const,
            note: "Kein Broker, Live-Ausführung bleibt aus. Entwurf nicht gesendet.",
          };
        }
        return { ...d, status: "blocked" as const, note: "Kein Broker angebunden." };
      }
      const idea: TradeIdea = {
        id: uid("idea"),
        bot: "skipper",
        ticker: d.symbol,
        side: d.side === "sell" ? "short" : "long",
        thesis: `Paper über Vesper: ${d.note}`,
        cashNow: `${d.amountEur} € Test`,
        capital: "Kein Live",
        status: "in-demo",
      };
      useDeskStore.setState((s) => ({
        ideas: [idea, ...s.ideas],
        messages: [
          ...s.messages,
          {
            id: uid("c"),
            ts: new Date().toISOString(),
            author: "you",
            text: `Vesper Paper: ${d.side} ${d.symbol} ${d.amountEur} €. Nur Demo.`,
          },
        ],
      }));
      toast(`Paper-Plan ${d.symbol} liegt im Trading-Desk.`);
      return { ...d, status: "done" as const };
    });
    saveDrafts(drafts);
    set({ drafts, pending: null });
  },
  tickDiagnoses: () => {
    let changed = false;
    let doneNow = false;
    const next = get().diagnoses.map((d) => {
      if (d.status !== "running") return d;
      const advanced = advanceDiagnosis(d);
      if (advanced === d) return d;
      if (advanced.day !== d.day || advanced.status !== d.status) {
        changed = true;
        if (advanced.status === "done") doneNow = true;
        return advanced;
      }
      return d;
    });
    if (!changed) {
      get().rebuildIntel();
      return;
    }
    saveDiagnoses(next);
    set({
      diagnoses: next,
      insight: doneNow || get().insight,
      diagTick: doneNow ? get().diagTick + 1 : get().diagTick,
    });
    get().rebuildIntel();
  },
  checkAutoOpen: () => {
    const s = useDeskStore.getState();
    const lastSeen = get().memory.lastSeenAlert;
    const newest = s.alerts[0];
    const abort = s.liveStatus === "abort";
    const due = get().diagnoses.some((d) => d.status === "running" && d.day >= d.days);
    const material = newest && newest.severity === "material" && newest.ts !== lastSeen;
    const notice = get().notices[0];
    if (abort || due || material || notice) {
      set({ insight: true });
      if (!get().open && (abort || due || (notice && notice.needDecision))) {
        set({ open: true });
        get().greetIfNeeded();
      }
    }
  },
  rebuildIntel: () => {
    const s = useDeskStore.getState();
    const desk = gatherDesk({
      tapeAsOf: s.tapeAsOf,
      tapeSource: s.tapeSource,
      sessionLabel: s.sessionLabel,
      watchlist: s.watchlist,
      tape: s.tape,
      bots: s.bots,
      filings: s.filings,
      earnings: s.earnings,
      sentiment: s.sentiment,
      whales: WHALES,
      macro: s.macro,
      alerts: s.alerts,
      messages: s.messages,
      ideas: s.ideas,
      briefs: s.briefs,
      lessons: s.lessons,
      liveAbort: s.liveStatus === "abort",
    });
    let diags = get().diagnoses;
    const running = diags.filter((d) => d.status === "running").length;
    if (running < 3) {
      const extra: Diagnosis[] = [];
      for (const t of desk.watchlist) {
        if (diags.some((d) => d.symbol === t.symbol)) continue;
        const sug = suggestDiagnosisDays(t.symbol, desk);
        if (!sug) continue;
        extra.push(createDiagnosis(t.symbol, sug.days, `${sug.thesis} ${sug.why}`));
        if (running + extra.length >= 3) break;
      }
      if (extra.length) {
        diags = [...extra, ...diags].filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i).slice(0, 12);
        saveDiagnoses(diags);
      }
    }
    const bundle = buildBundle(desk, diags, get().intel);
    const prev = get().intel;
    const same =
      bundle.notices.length === 0 &&
      Object.keys(bundle.cards).length === Object.keys(prev).length &&
      Object.values(bundle.cards).every((c) => prev[c.symbol]?.fingerprint === c.fingerprint && prev[c.symbol]?.spoken === c.spoken);
    if (same && get().intelBriefSpoken === bundle.briefSpoken) return;
    saveIntel(bundle);
    const known = new Set(get().spokenNoticeIds);
    const fresh = bundle.notices.filter((n) => !known.has(n.id));
    const booted = get().intelReady;
    const nextSpeak = booted ? get().pendingNoticeSpeak ?? fresh[0]?.spoken ?? null : null;
    const spokenIds = booted && fresh[0] && !get().pendingNoticeSpeak ? [...known, fresh[0].id] : [...known, ...fresh.map((n) => n.id)];
    set({
      diagnoses: diags,
      intel: bundle.cards,
      intelBriefSpoken: bundle.briefSpoken,
      intelBriefDisplay: bundle.briefDisplay,
      notices: [...bundle.notices, ...get().notices].slice(0, 24),
      insight: (booted && bundle.notices.length > 0) || get().insight,
      pendingNoticeSpeak: nextSpeak,
      spokenNoticeIds: spokenIds.slice(-80),
      intelReady: true,
    });
  },
}));

async function executeActions(
  actions: VesperAction[],
  get: () => VesperState,
  topic?: TalkTopic,
  stage?: AnswerStage,
): Promise<string[]> {
  const notes: string[] = [];
  const have = get().memory.prefs.permission;
  let focus = { ...get().focus, nonce: get().focus.nonce + 1 };
  if (topic !== undefined) focus.topic = topic;
  let history = get().history;
  let phase: VesperPhase = get().phase;
  let nextStage = stage ?? get().stage;
  let caption: string | null = get().caption;
  for (const action of actions) {
    const blocked = gate(have, action);
    if (blocked) {
      notes.push(blocked);
      toast(blocked);
      continue;
    }
    switch (action.type) {
      case "navigate": {
        if (focus.desk && DESK_HREF[focus.desk] !== DESK_HREF[action.desk]) {
          history = [...history, DESK_HREF[focus.desk]].slice(-12);
        }
        focus.desk = action.desk;
        const href = DESK_HREF[action.desk];
        useVesperStore.setState({ navPath: href, phase: "opening" });
        phase = "opening";
        notes.push(`Desk ${action.desk}`);
        break;
      }
      case "selectTicker":
        focus.symbol = action.symbol;
        notes.push(`Ticker ${action.symbol}`);
        break;
      case "setChartRange":
        focus.range = action.range;
        notes.push(`Zeitraum ${action.range}`);
        break;
      case "markDay": {
        const symbol = focus.symbol ?? "NVDA";
        const resolved = resolveMarkIso(symbol, action.iso);
        focus.iso = resolved.iso;
        focus.markLabel = action.label ?? resolved.label;
        focus.caption = resolved.label;
        caption = resolved.label;
        focus.highlightId = resolved.dir === "down" ? "chart.latestDrop" : resolved.dir === "up" ? "chart.latestRise" : "chart.relevantEvent";
        focus.highlightLabel = resolved.label;
        phase = "marking";
        notes.push(`Markierung ${resolved.iso}`);
        break;
      }
      case "highlight":
        focus.highlightId = action.targetId;
        focus.highlightLabel = action.label;
        focus.caption = action.label;
        caption = action.label;
        phase = "marking";
        notes.push(`Markiert: ${action.label}`);
        break;
      case "scrollTo":
        focus.scrollId = action.targetId;
        notes.push(`Scroll ${action.targetId}`);
        break;
      case "openFiling": {
        focus.desk = "filings";
        useVesperStore.setState({ navPath: "/filings" });
        const filings = useDeskStore.getState().filings;
        const f = action.id
          ? filings.find((x) => x.id === action.id)
          : filings.find((x) => (action.symbol ? x.ticker === action.symbol : true));
        if (f) {
          focus.filingId = f.id;
          focus.highlightId = `filing-${f.id}`;
          focus.highlightLabel = `Von Vesper markiert: ${f.ticker} ${f.form}`;
          notes.push(`Filing ${f.ticker} ${f.form}`);
        }
        break;
      }
      case "openEarnings":
        focus.desk = "earnings";
        focus.earningsTicker = action.ticker;
        focus.highlightId = `earn-${action.ticker}`;
        focus.highlightLabel = `Von Vesper markiert: Earnings ${action.ticker}`;
        useVesperStore.setState({ navPath: "/earnings" });
        notes.push(`Earnings ${action.ticker}`);
        break;
      case "showSentiment":
        focus.desk = "sentiment";
        focus.sentimentTicker = action.ticker;
        focus.highlightId = `sent-${action.ticker}`;
        focus.highlightLabel = `Von Vesper markiert: Sentiment ${action.ticker}`;
        useVesperStore.setState({ navPath: "/sentiment" });
        notes.push(`Sentiment ${action.ticker}`);
        break;
      case "showFlows":
        focus.desk = "flows";
        focus.flowTicker = action.ticker;
        focus.highlightId = `flow-${action.ticker}`;
        focus.highlightLabel = `Von Vesper markiert: Flows ${action.ticker}`;
        useVesperStore.setState({ navPath: "/flows" });
        notes.push(`Flows ${action.ticker}`);
        break;
      case "openFloorBot":
        focus.desk = "chat";
        focus.floorBot = action.bot;
        useVesperStore.setState({ navPath: "/chat" });
        notes.push(`Floor ${action.bot}`);
        break;
      case "consultBots": {
        notes.push("Bots konsultiert (lokal + Floor)");
        useDeskStore.setState((s) => ({
          messages: [
            ...s.messages,
            {
              id: uid("c"),
              ts: new Date().toISOString(),
              author: "you",
              text: `Vesper an den Floor: ${action.question}`,
            },
          ],
        }));
        break;
      }
      case "startDiagnosis": {
        const existing = get().diagnoses.find((d) => d.symbol === action.symbol && d.status === "running");
        if (existing) {
          notes.push(`Diagnose ${action.symbol} läuft bereits (Tag ${existing.day}/${existing.days}). Nicht neu gestartet.`);
          focus.symbol = action.symbol;
          break;
        }
        if (!useDeskStore.getState().tapeAsOf) {
          try {
            await useDeskStore.getState().loadTape();
          } catch {
            /* seed fallback inside gather */
          }
        }
        const dx = createDiagnosis(action.symbol, action.days, action.thesis);
        const diagnoses = [dx, ...get().diagnoses.filter((d) => d.symbol !== action.symbol || d.status === "done")].slice(0, 12);
        saveDiagnoses(diagnoses);
        const last = dx.log.at(-1);
        useVesperStore.setState({
          diagnoses,
          diagTick: get().diagTick + 1,
          insight: dx.status === "done",
        });
        focus.symbol = action.symbol;
        focus.iso = last?.date ?? focus.iso;
        focus.markLabel = last ? `Diagnose ${action.symbol} · Tag ${dx.day} von ${dx.days}` : focus.markLabel;
        notes.push(diagnosisLine(dx));
        toast(`Diagnose ${action.symbol}: Tag ${dx.day} von ${dx.days}.`);
        get().rebuildIntel();
        break;
      }
      case "killDiagnosis": {
        const running = get().diagnoses.findIndex((d) => d.status === "running");
        const idx = running >= 0 ? running : 0;
        const diagnoses = get().diagnoses.map((d, i) => (i === idx ? killDiagnosis(d) : d));
        saveDiagnoses(diagnoses);
        useVesperStore.setState({ diagnoses, diagTick: get().diagTick + 1 });
        notes.push("Diagnose abgebrochen.");
        break;
      }
      case "refreshDiagnosis": {
        const diagnoses = get().diagnoses.map((d, i) => (i === 0 ? refreshDiagnosis(d) : d));
        saveDiagnoses(diagnoses);
        useVesperStore.setState({ diagnoses, diagTick: get().diagTick + 1 });
        const top = diagnoses[0];
        notes.push(top ? diagnosisLine(top) : "Keine Diagnose.");
        break;
      }
      case "preparePaper":
      case "prepareLive": {
        const live = action.type === "prepareLive";
        const last = useDeskStore.getState().watchlist.find((t) => t.symbol === action.symbol)?.last ?? 0;
        const fees = Math.max(1, action.amountEur * 0.001);
        const draft: TradeDraft = {
          id: uid("td"),
          ts: new Date().toISOString(),
          mode: live ? "live" : "paper",
          symbol: action.symbol,
          side: action.side,
          amountEur: action.amountEur,
          orderType: "market",
          expectedValue: action.amountEur,
          fees,
          riskEur: action.amountEur * 0.1,
          allocationNote: live
            ? `${((action.amountEur / LIVE_NOTIONAL_EUR) * 100).toFixed(2)} % vom Soll-Book.`
            : "Paper 300 $ digital. Kein echtes Geld.",
          status: live ? "awaiting-confirm" : "draft",
          note: live
            ? "Live braucht Bestätigung und Mandat. Standard: aus."
            : "Paper-Plan. Bestätigen, dann liegt er im Trading-Desk.",
        };
        const drafts = [draft, ...get().drafts].slice(0, 40);
        saveDrafts(drafts);
        useVesperStore.setState({
          drafts,
          pending: live || action.type === "preparePaper" ? draft : get().pending,
        });
        notes.push(`${live ? "Live-Entwurf" : "Paper-Plan"} ${action.symbol}`);
        break;
      }
      case "diagnosisStatus":
        focus.detailOpen = true;
        focus.highlightId = focus.highlightId ?? "diag.panel";
        focus.highlightLabel = focus.highlightLabel ?? "Laufende Prüfung.";
        caption = "Laufende Prüfung.";
        useVesperStore.setState({ open: true, insight: true });
        notes.push("Prüfung geöffnet.");
        break;
      case "compare":
        focus.compare = action.right;
        focus.symbol = action.left;
        notes.push(`Vergleich ${action.left} ${action.right}`);
        break;
      case "goBack": {
        const prev = history.at(-1);
        history = history.slice(0, -1);
        if (prev) {
          useVesperStore.setState({ navPath: prev, phase: "opening" });
          notes.push("Zurück");
        }
        break;
      }
      case "closeDetail":
        focus.iso = null;
        focus.highlightId = null;
        focus.highlightLabel = null;
        focus.caption = null;
        focus.detailOpen = false;
        caption = null;
        notes.push("Detail zu");
        break;
      case "setStage":
        nextStage = action.stage;
        notes.push(`Stufe ${action.stage}`);
        break;
      case "showPortfolioPosition":
        focus.desk = "trade";
        focus.symbol = action.symbol;
        focus.highlightId = "trade.position";
        focus.highlightLabel = "Position im Book.";
        useVesperStore.setState({ navPath: "/trade" });
        notes.push(`Position ${action.symbol}`);
        break;
      case "highlightChartRange":
        focus.chartStart = action.start;
        focus.chartEnd = action.end;
        notes.push(`Bereich ${action.start}–${action.end}`);
        break;
      case "dailyBrief":
      case "computeRisk":
      case "scenario":
      case "stop":
      case "mute":
      case "setStyle":
      case "openSection":
      case "openSecurity":
      case "selectChartRange":
      case "selectChartDate":
      case "focusElement":
      case "highlightElement":
      case "scrollToElement":
      case "openEvidence":
      case "openSource":
      case "showBotOpinions":
      case "showDiagnosis":
      case "showCurrentDiagnoses":
      case "updateDiagnosis":
      case "compareSecurities":
      case "showScenario":
      case "prepareTradePlan":
      case "intelAsk":
        break;
    }
  }
  useVesperStore.setState({ focus, history, phase, stage: nextStage, caption });
  if (focus.scrollId && typeof document !== "undefined") {
    window.setTimeout(() => {
      document.querySelector(`[data-vesper="${focus.scrollId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
  }
  if (focus.highlightId && typeof document !== "undefined") {
    window.setTimeout(() => {
      document.querySelector(`[data-vesper="${focus.highlightId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
  }
  return notes;
}

export function speakable(text: string) {
  return text
    .replace(/–/g, "")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

export type { VesperStyle };
