import type { TapeNote } from "./types";

/** Feste Tagesnotizen, Anfänger-Deutsch. Richtung muss zum Tape passen, sonst greift der Tape-Erklärer. */
export const TAPE_NOTES: TapeNote[] = [
  {
    date: "2026-07-29",
    ticker: "SPY",
    tone: "down",
    headline: "Der US-Aktienkorb ist am 29. Juli gefallen",
    bullets: [
      "Der große US-Aktienkorb bündelt die 500 größten US-Firmen. Fällt er, fällt oft das ganze Book mit.",
      "An dem Tag kamen starke Konjunkturdaten. Starke Daten heißen: die Notenbank muss die Zinsen nicht senken. Höhere Zinsen machen Aktien weniger attraktiv.",
      "Nach der Sommer-Rally haben viele verkauft, um Gewinn mitzunehmen. Das drückt den Kurs, ohne dass die Firmen schlechter geworden sind.",
      "Technik-Schwergewichte (Nvidia, Broadcom) gaben besonders nach — die ziehen den Korb, weil sie darin groß sind.",
      "Für uns: Grundstock nicht anfassen. Beimischung erst nach dem nächsten ruhigen Tag.",
    ],
  },
  {
    date: "2026-07-29",
    ticker: "VOO",
    tone: "down",
    headline: "Der Vanguard-Aktienkorb ist mit dem Markt gefallen",
    bullets: [
      "Das ist derselbe Korb wie der große US-Aktienkorb, nur von Vanguard. Deshalb bewegt er sich fast eins zu eins mit.",
      "Der Rückgang kommt vom Markt, nicht von einem Fehler bei Vanguard.",
      "Wir halten ihn als ruhigen Grundstock. Ein einzelner schwacher Tag ändert die Strategie nicht.",
    ],
  },
  {
    date: "2026-07-29",
    ticker: "NVDA",
    tone: "down",
    headline: "Nvidia ist am 29. Juli stärker gefallen als der Markt",
    bullets: [
      "Nvidia ist eine Chip-Firma. Wenn der ganze Markt nervös ist, fallen teure Wachstumsaktien oft stärker.",
      "Der große US-Aktienkorb war schwach. Nvidia hat den Schub nach unten verstärkt, nicht ausgelöst.",
      "Kein Nachkaufen nur weil der Kurs fällt. Erst neue Meldungen oder der nächste Schluss.",
    ],
  },
  {
    date: "2026-08-15",
    ticker: "SPY",
    tone: "up",
    headline: "Der US-Aktienkorb hat die Woche ruhig eröffnet",
    bullets: [
      "Kleine Plus-Tage nach einem schwachen Stück sind oft nur eine Pause, kein neuer Trend.",
      "Jackson Hole (Fed-Rede) lag noch vor uns — der Kern bleibt Ballast.",
      "Grün heißt nicht automatisch kaufen. Erst Chart-Blick, dann Demo.",
    ],
  },
  {
    date: "2026-08-21",
    ticker: "SPY",
    tone: "up",
    headline: "Freitag, 21. August: ruhiger Schluss vor dem Wochenende",
    bullets: [
      "Märkte waren zu, als wir den letzten Print genommen haben. Das ist der Wall-Street-Schluss, den du siehst.",
      "Plus an dem Tag: der Korb ist leicht gestiegen. Kein Drama, kein Signal zum Umschichten.",
      "Nächstes großes Ereignis: Jackson Hole (Notenbank). Beimischung erst danach.",
    ],
  },
  {
    date: "2026-08-21",
    ticker: "GS",
    tone: "up",
    headline: "Goldman Sachs ist am Freitag stark gestiegen",
    bullets: [
      "Goldman ist eine Bank. Starke Bank-Tage helfen unserer monatlichen Ausschüttung, weil GS eine Dividende zahlt.",
      "Ein einzelner starker Tag ist kein Freibrief, nachzulaufen. Add nur auf Schwäche, wenn die Demo grün ist.",
      "Till (Banken-Bot) sieht das als Event, nicht als neues Regime.",
    ],
  },
  {
    date: "2026-08-21",
    ticker: "TSLA",
    tone: "up",
    headline: "Tesla ist stark gestiegen — das ist Lärm, keine These",
    bullets: [
      "Tesla hat keine Dividende. Ein Plus-Tag füllt den 300-Dollar-Test nicht.",
      "Viel Gerede auf X (Social Media) ohne neuen Geschäftsbericht. Genau das hat die Demo in Woche 32 verbrannt.",
      "Regel: nicht nachlaufen. Bestand bleibt minimal.",
    ],
  },
  {
    date: "2026-08-08",
    ticker: "AVGO",
    tone: "up",
    headline: "Broadcom ist nach Zahlen gestiegen",
    bullets: [
      "Broadcom baut Spezial-Chips. Gute Zahlen heißen: mehr Auftrag, mehr Cash.",
      "Das war einer der Tage, an denen das Overlay den S&P geschlagen hat — deshalb darf so ein Trade in die Demo.",
      "Zahler zuerst: Broadcom schüttet auch etwas aus, im Gegensatz zu Tesla.",
    ],
  },
];

export function notesFor(date: string, ticker: string): TapeNote | null {
  return TAPE_NOTES.find((n) => n.date === date && n.ticker === ticker) ?? TAPE_NOTES.find((n) => n.date === date && !n.ticker) ?? null;
}
