/**
 * Vesper — CEO overlay for Vesper Desk.
 * Decisions:
 * - No new route. Overlay on every desk via AppShell.
 * - Auth/DB off: memory, audit, diagnoses in localStorage; session greeting in sessionStorage.
 * - Tools are real Zustand/router actions. A spoken claim without a tool result is not "done".
 * - Voice: xAI TTS (leo, de) + xAI STT; Web Speech fallback; speechSynthesis fallback.
 * - Home `/` is the Vesper core. Kommando lives at `/kommando`.
 * - Live execute default OFF. No broker — live drafts stay drafts.
 * - Local parser always drives UI; grok-4.5 refines the spoken CEO reply when available.
 */
export { useVesperStore } from "./store";
export { parseIntent } from "./parse";
export { PERMISSION_HINT, PERMISSION_LABEL } from "./permissions";
export { DESK_HREF } from "./types";
