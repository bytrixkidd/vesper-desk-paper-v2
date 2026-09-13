# Paper-Audit · 13. September 2026

Nur Paper. Kein Echtgeld. Kein Broker.

## Zugriff

Der Browserzustand des Nutzers ist von dieser Umgebung **nicht lesbar**.
`vesper-paper-v6` auf dem Gerät des Nutzers wird nicht überschrieben und nicht gelöscht.
Was dort stand, ist hier **nicht rekonstruierbar** und bleibt im Gesamtbericht als unvollständig stehen.

## 1. Getrennte Depots

| Rolle | experiment_id | book_id | Speicher | Historie |
|---|---|---|---|---|
| Archiv | exp-legacy-300-v1 | book-legacy-incomplete | Kopie nach `vesper-paper-book:book-legacy-incomplete`. Original `vesper-paper-v6` unangetastet. | unvollständig |
| Aktiv | exp-paper-v2-2026-09 | book-paper-v2 | `vesper-paper-book:book-paper-v2` | vollständig ab Split |

Ansichten:

- Kommando CHECK, Buchleiste, Positionen, Vesper-Stand, Puls → **book-paper-v2**
- CHECK-Zeile Archiv → **book-legacy-incomplete**
- Ein neuer Test entfernt alte Verluste nicht aus dem Gesamtbericht.

Test `legacy-key-untouched`: bestanden. Alter Schlüssel unverändert.
Test `alte-verluste-bleiben`: bestanden. Negatives Ergebnis bleibt im Archiv.

## 2. Geplante Goldman-Order

Im aktuellen Projektcode und im neuen Book gibt es **keine persistierte Goldman-Order**.

Kandidatenprüfung (paper-v2):

- Erstellungszeit: keine
- Entscheidungsgrundlage: Zahler-Regel (Till). Freitagsplus ist Ereignis, kein Regime. Nachkauf nur auf Schwäche.
- Geplanter Betrag: keiner
- Gültigkeit: keine
- Status: `none`, nicht ausführbar

Was der Autopilot am Sonntag, 13.09.2026, 08:32 UTC, auf einem leeren 300-$-Book tatsächlich geplant hat: **Broadcom (AVGO) kaufen**, Status PLANNED, weil die Sitzung zu ist. Nicht Goldman.

Würde eine Goldman-Order aus einer früheren Sitzung existieren:

- Börsenstart allein hält sie auf PLANNED (Test `goldman-boersenstart-kein-fill`).
- Sitzungsplus ≥ 2 % storniert sie als Ereignis, nicht Regime (Test `goldman-event-cancel`).
- Jede Änderung wird in `reviews[]` protokolliert.

## 3. Entscheidungslogik · konkreter Durchlauf

Funktionen:

- `decidePulse` in `src/lib/engine.ts` — einzige Handelsentscheidung, regelbasiert
- `executePulseTick` in `src/lib/pulse-exec.ts` — Gate, Revalidation, Fill
- `revalidateOrder` in `src/lib/orders.ts` — geplante Order vor Ausführung
- `riskLock` / `bookIdentity` / `canSimulateFill` in `src/lib/ledger.ts`
- `applyPulseToWatch` — Buchung der Stücke und des Cash

Durchlauf 13.09.2026 08:32:00.000Z, leeres paper-v2, 300 $ Cash:

| Frage | Antwort |
|---|---|
| Daten | Schluss 2026-09-11 20:00:00.000Z (Freitag). Quelle im Test: yahoo-Stempel. Markt: geschlossen. |
| Modellaufrufe | **0**. Der Handelspfad ruft kein Modell. |
| Bot-Ausgabe Entscheidung | Till: Nachkauf Broadcom aus Cash (decidePulse, Zahler zuerst, AVGO vor GS in der Sleeve-Liste). |
| Bot-Ausgaben nur Erklärung | Skipper, Forge, Drift: Halt-/Regeltext, keine Order. |
| Prüfschritt der die Order verhindert | `canSimulateFill`: Sitzung zu. Keine Ausführung zum Freitagsschluss. Order bleibt PLANNED. |

`runDeskAgent` / Floor-Chat laufen nur für Briefings und Sprache. Sie dürfen nicht kaufen.

## 4. Ausführung · Zeiten

Für den geplanten AVGO-Kauf aus dem Test:

- Entscheidungszeit: 2026-09-13T08:32:00.000Z
- Daten-Verfügbarkeit: 2026-09-11T20:00:00.000Z
- Kurszeit: 2026-09-11T20:00:00.000Z
- Simulierte Ausführung: **null** (nicht gefüllt)
- Quelle: yahoo (im Teststempel)
- Kosten: 10 bp je Seite, nicht angewendet weil kein Fill

Kein später bekannter Tageswert wird in eine frühere Entscheidung zurückgeschrieben.

## 5. Tests (ausgeführt, 23/23)

| Fall | Start | Aktion | Erwartung | Ist | Ergebnis |
|---|---|---|---|---|---|
| Doppeleingang | 1 geplante Order | zweiter identischer Tick | keine zweite Buchung | first=1 second=1 | bestanden |
| Reload | cash 200, Version 3 | persist + laden | dieselben Werte | cash=200 ver=3 | bestanden |
| Zwei Tabs | A v5 NAV 250, B v2 NAV 100 | B schreibt | wrote false, NAV 250 | wrote=false nav=250 | bestanden |
| Sitzung zu | Sonntag, Freitagsschluss | canSimulateFill | ok false | false | bestanden |
| Veralteter Kurs | closeDate ≠ Sitzungstag | canSimulateFill | ok false | false | bestanden |
| Gemeinsames Guthaben | 300 $, zwei Orders je 240 $ | competingBuys | 1 akzeptiert, 1 blockiert | acc=1 blk=1 | bestanden |
| Gebühren / Bruch | 10 $ @ 100 buy | sharesFromNotional | 100.1, 4 Nachkommastellen | px=100.1 sh=0.0999 | bestanden |
| Stop-Gap | Einstieg 100, Last 97 | gapFillPrice + decidePulse | Fill 97, Verkauf GS | 97, pull GS | bestanden |
| Ansichten | leeres Book | CHECK vs identity vs cashSplit | Aktiengewicht 0, Cash 300 | eq=0 hold=0 | bestanden |

Nicht behauptet: ein Test gegen den echten Browser des Nutzers (kein Zugriff).

## 6. CHECK

Getrennt ausgewiesen:

- Bestand (Ist, Stücke > 0)
- Zielgewichte (Soll, nicht Bestand)
- Offene Orders (nicht im Bestand)
- Guthaben gesamt / reserviert / verfügbar

Leeres Depot: tatsächliches Aktiengewicht **0 %**, auch wenn Soll 55 % Kern sagt.

## Verbleibende Probleme

1. Zwei Tabs mit **gleicher** bookVersion: letzter Schreibvorgang gewinnt. Nur ältere Versionen werden abgewiesen.
2. `storage`-Ereignis gilt nur zwischen Tabs, nicht in dem Tab der schreibt.
3. Yahoo-Tape kann auf Seed fallen. Dann ist `priceSource` seed, nicht yahoo.
4. Alte Verluste im Nutzer-Browser sind hier nicht rekonstruierbar. Sie werden nicht gelöscht.
5. Autopilot läuft nur bei offener Seite.
6. Lehrwochen W31–W34 sind Beispiele, kein Journal dieses Books.

## Dateien

- `src/lib/books.ts` — Identitäten, Split, Persistenz
- `src/lib/orders.ts` — Revalidation, Goldman-Bericht
- `src/lib/pulse-exec.ts` — Ausführung mit Zeitstempeln
- `src/lib/ledger.ts` — Cash-Split, Stop, Rundung
- `src/lib/engine.ts` — decidePulse inkl. Stop und reserviertem Cash
- `src/lib/check-report.ts` — CHECK-Struktur
- `src/lib/paper-audit.test.ts` — die obigen Tests
