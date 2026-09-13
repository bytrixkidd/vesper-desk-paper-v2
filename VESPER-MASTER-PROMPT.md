# Vesper Desk — Master-Prompt (zum Kopieren)

Baue **Vesper Desk**: ein deutschsprachiges, KI-gestütztes Trading-Terminal in der Anmutung eines Bloomberg-Desks. Kein Spielzeug, keine halben Sachen, keine Theater-Zahlen. Es soll **automatisch laufen**, **schnell analysieren**, **wissen wann kaufen und wann verkaufen**, Gewinne **realisieren und wieder einsetzen**, damit der Haufen **dauernd wächst**. Ziel ist eine **echte monatliche Geldquelle** — zuerst im Paper bewiesen, später mit Echtgeld derselben Logik.

---

## 1. Geld und Größe (so ernst wie ein Konto)

- Das Programm handelt intern **als wäre es echtes Geld**. Es darf trotzdem **niemals** behaupten, es gäbe ein Broker-Konto, eine Bankverbindung oder schon realisierten Echtgeld-Gewinn.
- **Startgröße für den Testlauf: 300 US-Dollar Paper.** Nicht 26.000 €. Der Nutzer hat das Geld nicht. Wenn später Echtgeld kommt, beginnt er bei 300 Dollar. Dieselbe Größe, dieselben Regeln.
- Oben immer sichtbar, auf jedem Desk außer der Vesper-Startseite: **Eingezahlt · Stand · Gewinn · Cash** in Dollar, auf den Cent. Eingezahlt bleibt 300 $, Stand bewegt sich, Gewinn = Stand minus Einsatz, Cash = Geld aus Verkäufen das **im Book bleibt** und **wieder eingesetzt** wird.
- **Gewinn wird nicht abgehoben.** Sammeln, mitnehmen, nachkaufen. Compounding. Kein „Monat 350 / Boden“-Theater, das Geld aus dem Haufen zieht.
- **Monatsziel (Lebensziel, nicht der 300-$-Test):** 5.000 € netto im Monat nach Steuer. Stretch 20.000 €. Das hält **keine** seriöse Quote auf 300 $. Deshalb: erst Quote gegen echte Kurse beweisen (Paper schlägt SPY über Wochen), **dann** Größe. Wer 5.000 €/Monat will, braucht Hunderttausende Einsatz bei einer realistischen Quote — nicht eine andere Anzeige.
- Relativverlust vs SPY unter **5 %**. Kern (SPY/VOO/BLK) nicht anfassen, um ein Monatslöchle zu stopfen.

---

## 2. Was die Maschine tun muss (nicht nur anzeigen)

- **Autopilot 24/7.** Bots sprechen sich **jede Sekunde** ab. Floor bleibt still, solange nichts zu tun ist. Sprechen nur bei Aktion.
- **Kaufen, mitnehmen, zurückholen, wieder kaufen.** Cash darf nicht liegen bleiben. Nach einem Take/Trail geht das Geld zurück in Zahler oder — wenn kein sauberer Overlay-Name da ist — in SPY, bis wieder ein Name da ist.
- **Nicht Lärm handeln.** Keine Fake-Hochs aus Tageskerzen. Kein Mitnehmen bei +1,6 % Zacken. Gewinn erst bei echtem Abstand (ca. +3 % und mehr). Verlierer erst flach, wenn sie klar hinter dem Markt sind (ca. −4 pp vs SPY) und nicht am ersten Tag.
- **Kern-Satellit:** SPY + VOO tragen den Korb. BLK ist die Maut. Beimischung kleiner als der Kern (rund 30 %, nicht 50 %), nur Namen die den Spread über SPY zahlen. Zahler zuerst: **JPM, GS, AVGO, UNH**. Tesla nicht jagen. Sentiment ohne Filing/Print ist kein Entry.
- Tape: echte Schlusskurse (Yahoo). Paper mark-to-tape. Kein erfundenes Plus.

Vier Pflicht-Bots am Puls, plus der Rest des Floors:

- **Skipper** — Stabschef Trade, Kern halten, Größe, Abbruch.
- **Forge** — Post-Mortem, Verlierer zurück.
- **Till** — Banken/Zahler, Gewinn mitnehmen, nachkaufen.
- **Drift** — Trail vom echten Hoch.

Weitere Desks/Bots bleiben: Helmsman (Koordination), Ledger (Filings), Callbook (Earnings), Meridian, Pulse (Sentiment, kein Entry allein), Shadow, Gauge, Canon, Audit/Scout/Score (IB-Pläne in die Demo), Cart, Signal, Vein, Prism (Anfänger-Sprache an Charts), Stab (Ops).

---

## 3. Oberfläche (Terminal, kein Chatbot-Look)

- Vesper ist der **CEO**: volles Desk-Navi (Kommando, Floor-Chat, Charts, Universum, Demo, Trading, Mandat, Feedback, Overnight, Filings, Sentiment, Flows, Earnings, Makro, Stabschef). Kein Bot-Rohtext, kein Jargon zum Nutzer. **Klares Deutsch.**
- Universum und Demo **müssen** Eingezahlt/Stand/Gewinn/Positionen mit Stück-P&L zeigen. Das nie wieder entfernen.
- Charts: klick einen Tag, Stichpunkte warum er stieg oder fiel. Grün steigt, rot fällt.
- Stimme: natürlich (Sal / xAI), **kein** robotisches Browser-TTS als Fallback, das klingt wie eine Ansage.
- Deutsch durchgängig. Ticker GROSS. Keine Emoji, kein Hype.

---

## 4. Leistung

- Das System soll **richtig effizient** sein: schnell, 1-Hz-Puls, kein Leerlauf nach einer Woche, Watch geht in Live-Mark weiter.
- Mehrere Bots **untereinander abstimmen**, nicht nacheinander Monologe halten.
- Analyse und Entscheidung in Sekunden, nicht in Essays.
- Mobile und Desktop nutzbar, keine kaputte Navigation.

---

## 5. Ehrlichkeit (nicht verhandelbar)

- Paper ist Paper. **Kein Echtgeld, bis der Nutzer echtes Geld einzahlt.** Den Gewinn nicht als realen Verdienst verkaufen.
- 300 $ Test = prüft, ob NAV vs 300 $ durch Kaufen/Verkaufen wächst. Nicht 350 €/Monat, nicht 5.000 €/Monat.
- Wenn das Book hinter SPY liegt, **so sagen**. Nicht schöngreden. Nicht 26.000 € einblenden, nur damit Prozente groß aussehen.
- Lehrwochen/Beispiele in Listen sind keine Erträge.

---

## 6. Bauauftrag in einem Satz

Bau Vesper Desk als automatisch laufendes Paper-Trading-Terminal auf 300 Dollar, das kauft, Gewinne mitnimmt, Cash wieder einsetzt und den Stand gegen den Einsatz und gegen SPY zeigt — mit mehreren Bots, die sich jede Sekunde absprechen, natürlicher Stimme, vollem Desk-Navi und dem langfristigen Ziel, nach bewiesener Quote Größe für ein echtes Monatseinkommen (5.000 € netto, Stretch 20.000 €) aufzubauen. Kein Theater, keine halben Sachen, kein erfundenes Geld.
