import { DEFAULT_PREFS, type AuditEntry, type Diagnosis, type TradeDraft, type VesperMemory, type VesperPrefs } from "./types";
import type { IntelBundle, IntelCard, IntelNotice } from "./intel";

const MEM_KEY = "vesper-memory-v1";
const AUDIT_KEY = "vesper-audit-v1";
const DIAG_KEY = "vesper-diag-v1";
const DRAFT_KEY = "vesper-drafts-v1";
const SESSION_KEY = "vesper-session-v1";
const INTEL_KEY = "vesper-intel-v4";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

export function loadMemory(): VesperMemory {
  const raw = readJson<Partial<VesperMemory> & { voiceMigrated?: boolean; speechLoosened?: boolean }>(MEM_KEY, {});
  const merged = { ...DEFAULT_PREFS, ...(raw.prefs ?? {}) };
  const migrated = Boolean((raw as { voiceMigrated?: boolean }).voiceMigrated);
  if (!migrated && (!raw.prefs?.voiceId || raw.prefs.voiceId === "leo")) {
    merged.voiceId = "sal";
  }
  if (!(raw as { speechLoosened?: boolean }).speechLoosened && merged.reportLength === "kurz") {
    merged.reportLength = "normal";
  }
  return {
    lastVisit: raw.lastVisit ?? null,
    lastBriefDay: raw.lastBriefDay ?? null,
    lastSeenAlert: raw.lastSeenAlert ?? null,
    greetedSession: false,
    preferredMarkets: raw.preferredMarkets ?? ["US-Aktien", "S&P 500"],
    riskNote: raw.riskNote ?? "300 $ Testlauf. Relativverlust vs SPY unter 5 %.",
    rejected: raw.rejected ?? [],
    prefs: merged,
  };
}

export function saveMemory(mem: VesperMemory) {
  writeJson(MEM_KEY, { ...mem, greetedSession: undefined, voiceMigrated: true, speechLoosened: true });
}

export function loadSession(): { greeted: boolean; id: string } {
  if (typeof window === "undefined") return { greeted: false, id: "ssr" };
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as { greeted: boolean; id: string };
  } catch {
    /* ignore */
  }
  const fresh = { greeted: false, id: `s-${Date.now()}` };
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
  } catch {
    /* ignore */
  }
  return fresh;
}

export function markSessionGreeted() {
  if (typeof window === "undefined") return;
  try {
    const cur = loadSession();
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...cur, greeted: true }));
  } catch {
    /* ignore */
  }
}

export function loadAudit(): AuditEntry[] {
  return readJson<AuditEntry[]>(AUDIT_KEY, []).slice(0, 200);
}

export function saveAudit(rows: AuditEntry[]) {
  writeJson(AUDIT_KEY, rows.slice(0, 200));
}

export function loadDiagnoses(): Diagnosis[] {
  return readJson<Diagnosis[]>(DIAG_KEY, []);
}

export function saveDiagnoses(rows: Diagnosis[]) {
  writeJson(DIAG_KEY, rows);
}

export function loadDrafts(): TradeDraft[] {
  return readJson<TradeDraft[]>(DRAFT_KEY, []);
}

export function saveDrafts(rows: TradeDraft[]) {
  writeJson(DRAFT_KEY, rows.slice(0, 40));
}

export function loadIntel(): { cards: Record<string, IntelCard>; notices: IntelNotice[]; briefSpoken: string; briefDisplay: string; asOf: string } {
  return readJson(INTEL_KEY, { cards: {}, notices: [], briefSpoken: "", briefDisplay: "", asOf: "" });
}

export function saveIntel(bundle: Pick<IntelBundle, "cards" | "notices" | "briefSpoken" | "briefDisplay" | "asOf">) {
  writeJson(INTEL_KEY, {
    cards: bundle.cards,
    notices: bundle.notices.slice(0, 24),
    briefSpoken: bundle.briefSpoken,
    briefDisplay: bundle.briefDisplay,
    asOf: bundle.asOf,
  });
}

export function patchPrefs(partial: Partial<VesperPrefs>): VesperPrefs {
  const mem = loadMemory();
  const prefs = { ...mem.prefs, ...partial };
  saveMemory({ ...mem, prefs });
  return prefs;
}
