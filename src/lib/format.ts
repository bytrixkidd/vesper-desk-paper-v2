const metDate: Intl.DateTimeFormatOptions = {
  timeZone: "Europe/Berlin",
  month: "short",
  day: "numeric",
};

const metTime: Intl.DateTimeFormatOptions = {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

const metFull: Intl.DateTimeFormatOptions = {
  timeZone: "Europe/Berlin",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

export const DESK_TZ = "Europe/Berlin";
export const DESK_TZ_LABEL = "MET";

export function formatEtDate(input: string | number | Date = new Date()) {
  return new Date(input).toLocaleDateString("de-DE", metDate);
}

export function formatEtTime(input: string | number | Date = new Date()) {
  return new Date(input).toLocaleTimeString("de-DE", metTime);
}

export function formatEt(input: string | number | Date = new Date()) {
  return `${new Date(input).toLocaleString("de-DE", metFull)} MET`;
}

export function formatPct(n: number, digits = 1) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function formatUsd(n: number, digits = 2) {
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatEur(n: number, digits = 2) {
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCompact(n: number) {
  return new Intl.NumberFormat("de-DE", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatShares(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) < 1) return n.toFixed(4);
  return n.toLocaleString("de-DE", { maximumFractionDigits: 4 });
}

export function signedClass(n: number) {
  if (n > 0) return "text-long";
  if (n < 0) return "text-short";
  return "text-muted";
}

export function nyseStatus(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  const ymd = `${y}-${m}-${d}`;
  const mins = hour * 60 + minute;
  const holiday = NYSE_HOLIDAYS.has(ymd);
  const weekday = !["Sat", "Sun"].includes(wd) && !holiday;
  const open = weekday && mins >= 9 * 60 + 30 && mins < 16 * 60;
  return {
    open,
    label: open ? "NYSE offen" : holiday ? "NYSE Feiertag" : "NYSE zu",
    next: open ? "Close 22:00 MET" : weekday && mins < 9 * 60 + 30 ? "Open 15:30 MET" : "Open Mo 15:30 MET",
    etDate: ymd,
  };
}

/** NYSE-Vollfeiertage 2026. Kein Anspruch auf Vollständigkeit für andere Jahre. */
export const NYSE_HOLIDAYS = new Set([
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
]);

export const SEVERITY_LABEL = {
  info: "Info",
  watch: "Beobachten",
  material: "Materiell",
} as const;

export const ACTION_LABEL = {
  new: "Neu",
  add: "Plus",
  trim: "Minus",
  exit: "Exit",
  hold: "Halt",
} as const;

export const GUIDE_LABEL = {
  raised: "Angehoben",
  maintained: "Bestätigt",
  lowered: "Gesenkt",
  cut: "Gesenkt",
  withdrawn: "Zurückgezogen",
} as const;

export const OPS_STATUS_LABEL = {
  queued: "Warteschlange",
  drafted: "Entwurf",
  sent: "Gesendet",
} as const;

export const LESSON_STATUS_LABEL = {
  open: "Offen",
  applied: "Umgesetzt",
} as const;

export const INCLUSION_STATUS_LABEL = {
  queued: "Warteschlange",
  drafted: "Entwurf",
  applied: "Umgesetzt",
} as const;

export const SIDE_LABEL = {
  long: "Long",
  short: "Short",
  flat: "Flat",
} as const;

export const INTERVENE_LABEL = {
  rebalance: "Neu verteilen",
  "trim-overlay": "Beimischung halbieren",
  "add-core": "In den Grundstock",
  flat: "Raus",
  halt: "Halt",
  resume: "Weiter",
  "take-profit": "Gewinn mitnehmen",
  trail: "Nachziehen",
  "add-overlay": "Nachkaufen",
} as const;

export const PULSE_KIND_LABEL = {
  hold: "Halten",
  take: "Gewinn",
  trail: "Sichern",
  pull: "Zurück",
  trim: "Kürzen",
  buy: "Kaufen",
} as const;

export const PROFILE_KIND_LABEL = {
  add: "Aufnehmen",
  remove: "Heraus",
  expand: "Erweitern",
  trim: "Trimmen",
} as const;

export const PROFILE_STATUS_LABEL = {
  discuss: "Diskussion",
  queued: "Warteschlange",
  applied: "Umgesetzt",
  rejected: "Verworfen",
} as const;

export const PROFILE_TEAM_LABEL = {
  research: "Research",
  feedback: "Feedback",
  mandate: "Mandat",
  trade: "Trading",
} as const;

export const MANDATE_STATUS_LABEL = {
  review: "Prüfung",
  sent: "In der Demo",
  scored: "Bewertet",
  applied: "Umgesetzt",
} as const;

export const INSIGHT_KIND_LABEL = {
  fresh: "Latest",
  overlooked: "Übersehen",
} as const;

