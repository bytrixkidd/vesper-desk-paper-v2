/** Rekonstruktion der Screenshot-Cashstände. Archiv, nicht paper-v2. */

export const LEGACY_CASH_FINDINGS = [
  {
    label: "BELEGT",
    text: "12.09.2026 17:20: NAV 297,65 $ bei Einsatz 300 $, Cash 12,10 $. 17:32: NAV weiter 297,65 $, Cash 2,42 $.",
  },
  {
    label: "BELEGT",
    text: "12,10 × 0,80 (alte Regel BUY_CASH_FRAC) = 9,68 $ Einsatz, Rest 2,42 $. NAV bleibt, weil zum Last gekauft wird — Marktwert gegen Cash getauscht. Die 80-%-Regel ist kein wirtschaftlicher Kaufgrund; sie erklärt nur die Arithmetik.",
  },
  {
    label: "VERDACHT",
    text: "2,42 $ → 2,59 $ bei weiter gleichem NAV: Wechselkurs-Anzeige, Rundung EUR/USD oder späteres Mark. In dieser Umgebung nicht rekonstruierbar.",
  },
  {
    label: "BELEGT",
    text: "Diese Stände gehören zu exp-legacy-300-v1 / book-legacy-incomplete. paper-v2 ist ein getrenntes Book mit 300 $ Cash ohne übernommene Stücke. Alter Browser-Schlüssel vesper-paper-v6 wird nicht überschrieben.",
  },
  {
    label: "NICHT PRÜFBAR",
    text: "Der Nutzer-Browser ist von hier nicht lesbar. Fehlende Fills des Legacy-Books bleiben unvollständig.",
  },
] as const;
