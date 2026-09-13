import {
  CFG_VERSION,
  LEGACY_BOOK_ID,
  LEGACY_EXPERIMENT_ID,
  PAPER_BOOK_PREFIX,
  PAPER_INDEX_KEY,
  PAPER_KEY,
  PAPER_V2_BOOK_ID,
  PAPER_V2_EXPERIMENT_ID,
  START_USD,
} from "./config.ts";
import { usdFromEur } from "./paper.ts";
import type { TiltReport } from "./engine.ts";
import type { BookIndex, BookRecord, DemoWatch, HarvestEvent, PaperFill, PulseEvent, BookStrategy, DemoWeek, LiveStatus } from "./types.ts";

export type PaperSave = {
  watch: DemoWatch | null;
  extraDemos: DemoWeek[];
  extraHarvests: HarvestEvent[];
  liveStatus: LiveStatus;
  tickCount: number;
  strategy?: BookStrategy;
  lastTilt?: TiltReport | null;
  pulseLog?: PulseEvent[];
  fills?: PaperFill[];
  experimentId?: string;
  bookId?: string;
  historyStatus?: "complete" | "incomplete";
};

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

export function bookStorageKey(bookId: string) {
  return `${PAPER_BOOK_PREFIX}${bookId}`;
}

export const LEGACY_HISTORY_NOTE =
  "Historie unvollständig. Der Browserzustand des Nutzers ist von dieser Umgebung nicht lesbar und wird nicht gelöscht. Alte Verluste bleiben im Gesamtbericht stehen, sind hier aber nicht rekonstruierbar.";

export function defaultIndex(splitAt = new Date().toISOString()): BookIndex {
  return {
    version: 1,
    activeBookId: PAPER_V2_BOOK_ID,
    splitAt,
    books: [
      {
        experimentId: LEGACY_EXPERIMENT_ID,
        bookId: LEGACY_BOOK_ID,
        role: "archive",
        cfgVersion: "legacy",
        historyStatus: "incomplete",
        historyNote: LEGACY_HISTORY_NOTE,
        createdAt: splitAt,
        archivedAt: splitAt,
        startUsd: START_USD,
        navUsd: null,
        pnlUsd: null,
        storageKey: bookStorageKey(LEGACY_BOOK_ID),
      },
      {
        experimentId: PAPER_V2_EXPERIMENT_ID,
        bookId: PAPER_V2_BOOK_ID,
        role: "active",
        cfgVersion: CFG_VERSION,
        historyStatus: "complete",
        historyNote: "Neues Paper-Book. Start 300 Dollar Cash, keine übernommenen Positionen.",
        createdAt: splitAt,
        startUsd: START_USD,
        navUsd: START_USD,
        pnlUsd: 0,
        storageKey: bookStorageKey(PAPER_V2_BOOK_ID),
      },
    ],
  };
}

function parseSave(raw: string | null): PaperSave | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PaperSave;
  } catch {
    return null;
  }
}

function parseIndex(raw: string | null): BookIndex | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BookIndex;
    if (parsed?.version !== 1 || !parsed.activeBookId || !Array.isArray(parsed.books)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function viewFromWatch(watch: DemoWatch | null) {
  if (!watch) return { startUsd: START_USD, navUsd: null as number | null, pnlUsd: null as number | null };
  const fx = watch.eurUsd || 1;
  const startUsd = usdFromEur(watch.startEur, fx);
  const navUsd = usdFromEur(watch.navEur, fx);
  return { startUsd, navUsd, pnlUsd: navUsd - startUsd };
}

export function tagWatch(watch: DemoWatch | null, experimentId: string, bookId: string, historyStatus: "complete" | "incomplete"): DemoWatch | null {
  if (!watch) return null;
  return { ...watch, experimentId, bookId, historyStatus, cfgVersion: watch.cfgVersion ?? CFG_VERSION };
}

export function tagFills(fills: PaperFill[] | undefined, experimentId: string, bookId: string): PaperFill[] {
  return (fills ?? []).map((f) => ({
    ...f,
    experimentId: f.experimentId ?? experimentId,
    bookId: f.bookId ?? bookId,
  }));
}

export type PersistResult = { wrote: boolean; reason: string };

/** Schreibt nur das genannte Book. Nie den Legacy-Schlüssel. Nie ein fremdes Book. */
export function persistBook(storage: StorageLike, bookId: string, payload: PaperSave): PersistResult {
  if (bookId === LEGACY_BOOK_ID) {
    return { wrote: false, reason: "Archiv ist schreibgeschützt." };
  }
  const key = bookStorageKey(bookId);
  const existing = parseSave(storage.getItem(key));
  const existingVer = existing?.watch?.bookVersion ?? 0;
  const nextVer = payload.watch?.bookVersion ?? 0;
  if (existing && existingVer > nextVer) {
    return { wrote: false, reason: "Veralteter Tab. Gespeicherte Version ist neuer." };
  }
  const stamped: PaperSave = {
    ...payload,
    experimentId: payload.experimentId ?? PAPER_V2_EXPERIMENT_ID,
    bookId,
    historyStatus: payload.historyStatus ?? "complete",
  };
  try {
    storage.setItem(key, JSON.stringify(stamped));
    return { wrote: true, reason: "geschrieben" };
  } catch {
    return { wrote: false, reason: "Speicher voll oder gesperrt." };
  }
}

export function loadBook(storage: StorageLike, bookId: string): PaperSave | null {
  return parseSave(storage.getItem(bookStorageKey(bookId)));
}

function archiveLegacyOnce(storage: StorageLike, index: BookIndex): BookIndex {
  const legacyRaw = storage.getItem(PAPER_KEY);
  const archiveKey = bookStorageKey(LEGACY_BOOK_ID);
  if (!legacyRaw) return index;
  if (storage.getItem(archiveKey)) return index;
  const save = parseSave(legacyRaw);
  const view = viewFromWatch(save?.watch ?? null);
  const copy: PaperSave = save
    ? {
        ...save,
        watch: tagWatch(save.watch, LEGACY_EXPERIMENT_ID, LEGACY_BOOK_ID, "incomplete"),
        fills: tagFills(save.fills, LEGACY_EXPERIMENT_ID, LEGACY_BOOK_ID),
        experimentId: LEGACY_EXPERIMENT_ID,
        bookId: LEGACY_BOOK_ID,
        historyStatus: "incomplete",
      }
    : {
        watch: null,
        extraDemos: [],
        extraHarvests: [],
        liveStatus: "live",
        tickCount: 0,
        experimentId: LEGACY_EXPERIMENT_ID,
        bookId: LEGACY_BOOK_ID,
        historyStatus: "incomplete",
      };
  try {
    storage.setItem(archiveKey, JSON.stringify(copy));
  } catch {
    /* quota — Archiv-Stub bleibt im Index */
  }
  return {
    ...index,
    books: index.books.map((b) =>
      b.bookId === LEGACY_BOOK_ID
        ? {
            ...b,
            startUsd: view.startUsd || START_USD,
            navUsd: view.navUsd,
            pnlUsd: view.pnlUsd,
            historyNote: save?.watch
              ? `Kopie des alten Speichers ${PAPER_KEY} zum Split. Original bleibt unangetastet. ${LEGACY_HISTORY_NOTE}`
              : LEGACY_HISTORY_NOTE,
          }
        : b,
    ),
  };
}

export function readIndex(storage: StorageLike): BookIndex {
  return parseIndex(storage.getItem(PAPER_INDEX_KEY)) ?? defaultIndex();
}

export function writeIndex(storage: StorageLike, index: BookIndex) {
  storage.setItem(PAPER_INDEX_KEY, JSON.stringify(index));
}

export type SplitState = {
  index: BookIndex;
  active: PaperSave | null;
  archive: PaperSave | null;
  legacyUntouched: boolean;
};

/** Trennt die Depots. Schreibt nie in vesper-paper-v6. */
export function splitBooks(storage: StorageLike, now = new Date()): SplitState {
  const splitAt = now.toISOString();
  let index = parseIndex(storage.getItem(PAPER_INDEX_KEY));
  const hadIndex = Boolean(index);
  if (!index) index = defaultIndex(splitAt);
  const beforeLegacy = storage.getItem(PAPER_KEY);
  index = archiveLegacyOnce(storage, index);
  if (!hadIndex || !storage.getItem(PAPER_INDEX_KEY)) writeIndex(storage, index);
  else writeIndex(storage, index);
  const afterLegacy = storage.getItem(PAPER_KEY);
  return {
    index,
    active: loadBook(storage, PAPER_V2_BOOK_ID),
    archive: loadBook(storage, LEGACY_BOOK_ID),
    legacyUntouched: beforeLegacy === afterLegacy,
  };
}

export function combinedReport(index: BookIndex, archive: PaperSave | null, active: PaperSave | null) {
  const archView = viewFromWatch(archive?.watch ?? null);
  const actView = viewFromWatch(active?.watch ?? null);
  const rows = index.books.map((b) => {
    const save = b.bookId === LEGACY_BOOK_ID ? archive : b.bookId === PAPER_V2_BOOK_ID ? active : null;
    const view = viewFromWatch(save?.watch ?? null);
    return {
      ...b,
      startUsd: view.startUsd || b.startUsd,
      navUsd: view.navUsd,
      pnlUsd: view.pnlUsd,
      historyStatus: save?.historyStatus ?? b.historyStatus,
    };
  });
  return {
    rows,
    archiveIncomplete: (archive?.historyStatus ?? "incomplete") === "incomplete",
    archivePnlUsd: archView.pnlUsd,
    activePnlUsd: actView.pnlUsd,
    note: "Ein neuer Test entfernt alte Verluste nicht aus diesem Bericht. Unvollständige Historie bleibt gekennzeichnet.",
  };
}

export function whichViewUses(bookId: string, experimentId: string) {
  if (bookId === PAPER_V2_BOOK_ID) {
    return {
      bookId,
      experimentId,
      views: ["Kommando CHECK", "Buchleiste", "Positionen", "Vesper-Stand", "Puls"],
      role: "active" as const,
    };
  }
  return {
    bookId,
    experimentId,
    views: ["CHECK Gesamtbericht (Archivzeile)"],
    role: "archive" as const,
  };
}
