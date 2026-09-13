/** Verbindliche Testkonfiguration. Nicht rückwirkend ändern, nach Verlusten Limits nicht erhöhen. */

export const CFG_VERSION = "paper-v2";
export const MODE = "PAPER_ONLY" as const;

export const START_USD = 300;
export const DEFAULT_EUR_USD = 1.17;

/** Altes 300-$-Experiment. Browserzustand nicht überschreiben, Historie ggf. unvollständig. */
export const LEGACY_EXPERIMENT_ID = "exp-legacy-300-v1";
export const LEGACY_BOOK_ID = "book-legacy-incomplete";
/** Aktives paper-v2-Book. Getrenntes Journal, eigene Persistenz. */
export const PAPER_V2_EXPERIMENT_ID = "exp-paper-v2-2026-09";
export const PAPER_V2_BOOK_ID = "book-paper-v2";

/** Zielgewichte der neuen Testversion. Bestand nicht allein dafür verkaufen. */
export const CORE_TARGET_PCT = 55;
export const TOLL_TARGET_PCT = 15;
export const OVERLAY_TARGET_PCT = 30;
export const MAX_ACTIVE_OVERLAY = 5;
export const MAX_SINGLE_PCT = 15;
export const MAX_ETF_PCT = 60;
/** Gilt für aktive Einzelwerte eines Themas. SPY+VOO als Index-Kern sind bewusst höher und separat geregelt. */
export const MAX_CLUSTER_PCT = 35;

export const COST_BPS = 10;
export const STRESS_COST_BPS = 30;
export const CASH_YIELD = 0;

/** Geplanter Verlust inkl. Kosten je neuem aktivem Trade. 0,5 % von 300 $ = 1,50 $. */
export const PER_TRADE_RISK_PCT = 0.5;
export const OPEN_RISK_CAP_PCT = 2;
export const DAY_LOSS_LOCK_PCT = -2;
export const MONTH_LOSS_LOCK_PCT = -6;
export const PEAK_DD_LOCK_PCT = -10;
export const REL_LOSS_CAP = 5;

/** Vorläufiger Stopabstand, solange kein ATR aus dem Tape gebunden ist. Nicht als Optimum verkaufen. */
export const STOP_PCT_DEFAULT = 2;

/** Bruchstücke sind in dieser Simulation zulässig und werden mit 4 Nachkommastellen geführt. */
export const FRACTIONAL_SHARES = true;
/** Alte Restkassen-Regel. Kein Kaufgrund. Nur noch Obergrenze, nicht Auslöser. */
export const BUY_CASH_FRAC = 0.8;
export const MIN_BUY_USD = 4;

/** Nur noch lesen. Nie wieder beschreiben — alter Browserzustand bleibt. */
export const PAPER_KEY = "vesper-paper-v6";
export const PAPER_INDEX_KEY = "vesper-paper-index-v1";
export const PAPER_BOOK_PREFIX = "vesper-paper-book:";

export const CONFIG_NOTE = [
  `${CFG_VERSION}, ${MODE}, Einsatz ${START_USD} USD.`,
  `Aktiv: ${PAPER_V2_BOOK_ID} / ${PAPER_V2_EXPERIMENT_ID}. Archiv: ${LEGACY_BOOK_ID} / ${LEGACY_EXPERIMENT_ID}.`,
  `Kern SPY+VOO ${CORE_TARGET_PCT} % (beide S&P 500), BlackRock-Aktie ${TOLL_TARGET_PCT} %, Beimischung-Ziel ${OVERLAY_TARGET_PCT} %.`,
  `Je Einzelaktie höchstens ${MAX_SINGLE_PCT} %, je ETF ${MAX_ETF_PCT} %, höchstens ${MAX_ACTIVE_OVERLAY} aktive Einzelwerte neben dem Kern.`,
  `Kosten ${COST_BPS} bp je Seite (Stresstest ${STRESS_COST_BPS} bp). Guthabenzins ${CASH_YIELD} %. Ergebnisse vor Steuer.`,
  `Neue Käufe gesperrt bei ${DAY_LOSS_LOCK_PCT} % Tagesverlust, ${MONTH_LOSS_LOCK_PCT} % Monat oder ${PEAK_DD_LOCK_PCT} % vom Hoch.`,
  `Nachkauf nur mit Strategieauslöser S1/S2. ${BUY_CASH_FRAC * 100} % vom Cash ist keine Begründung. Cash und HALTEN sind erlaubt.`,
  `Stop vorläufig ${STOP_PCT_DEFAULT} % unter Einstieg, Ausführung zum vorliegenden Kurs. Positionsgröße aus Risiko, nicht aus Restkasse.`,
  `Börsenstart allein ist kein Kaufgrund. Geplante Orders werden vor der Ausführung neu geprüft.`,
  `Bestehende Stücke werden nicht nur verkauft, um diese Zielwerte zu treffen.`,
].join(" ");
