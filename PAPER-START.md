# Vesper Desk · Paper-Paket

Grok-Programm (xAI). Kein Claude. Nur virtuelles Geld. Kein Broker, kein Echtgeld. Legacy-Archiv (`book-legacy-incomplete` / `vesper-paper-v6`) nicht überschreiben.

Stand dieses Pakets: 13.09.2026. Parameter `paper-v2-hyp-1`. Experiment aktiv: `exp-paper-v2-2026-09` / `book-paper-v2`.

## Start

Voraussetzungen: Node 22, npm.

```
cp env.example .env
npm install
npm run test:paper
npm run dev
```

Die Oberfläche liegt unter Port 8080. Autopilot läuft nur, solange die Seite offen ist.

Ohne `XAI_API_KEY` funktionieren Briefings und Floor-Chat lokal/ohne Modell. Der Handelspfad braucht kein Modell.

`npm run test:paper` ist der Paper-Nachweis (Ledger + Audit).  
`npm test` enthält zusätzlich Plattform-PWA-Tests. In diesem Lauf scheiterten 8 davon, weil der Injektor `og:title` auf `VESPER` setzt. Das sind keine Handelsfälle.

## 1. Entscheidungsweg

```
Tape / Schlusskurse
  → tiltStrategy / scoreSleeves (15 Handelstage vs SPY)     src/lib/engine.ts
  → overlayTrigger S1 dann S2                               src/lib/hypotheses.ts
  → pickBuy wählt den stärksten gültigen Overlay-Namen
  → decidePulse (Stops, Trim, Kauf, Trail)                  src/lib/engine.ts
  → executePulseTick: Gate, Revalidation, Fill              src/lib/pulse-exec.ts
  → applyPulseToWatch: Stücke und Cash                      src/lib/engine.ts
```

Wer wählt Kandidaten? Nur `pickBuy` anhand von `overlayTrigger`. Reihenfolge: Overlay-Watchlist, Tesla aus, kein Score → kein Trigger, S1 vor S2, dann höchste relative Stärke. Bot-Namen (Till, Vein, Skipper, Forge, Drift) sind **Etiketten** auf der schon getroffenen Regel.

Was darf eine Entscheidung **ändern**?

| Stelle | Datei | Wirkung |
|---|---|---|
| `overlayTrigger` | `src/lib/hypotheses.ts` | S1/S2 ja/nein |
| `pickBuy` / `decidePulse` | `src/lib/engine.ts` | welche Order, welches Limit |
| `riskLock` / `riskSizeUsd` | `src/lib/ledger.ts` | Sperre und Größe |
| `revalidateOrder` | `src/lib/orders.ts` | planned halten, stornieren oder füllen |
| `canSimulateFill` | `src/lib/ledger.ts` | Sitzung zu → kein Fill |
| geplante Orders + reserviertes Cash | Book | bindet Guthaben |

Was ändert **keine** Order (reine Erklärung)?

- `huddleStance` und `botLines` mit `kind: "explanation"`
- Floor-Chat und `runDeskAgent` (Modell, falls Schlüssel da)
- Seed-Nachrichten (`origin: "seed"`, Lehrbeispiele)
- Autopilot-Zähler (Programmzeit, kein neuer Kurs)
- CHECK-Texte, Chart-Sprache (Prism), Filings/Earnings-Notizen

Modellaufrufe im Kaufpfad: immer `[]`. Test `kein-modell-im-handel`: bestanden.

## 2. Strategieprüfung

Parameterstand `paper-v2-hyp-1`. S0 (Kern) und S3 (Ereignis) sind **nicht auto**.

**S1 Trendfolge relative Stärke** (`S1-RS`)

- Daten: 1d Schluss, 15 Handelstage gegen SPY
- Einstieg: relPct ≥ +1,0 pp, Watchlist, nicht Tesla
- Ausstieg: rel ≤ −4 pp oder Stop
- Größe: min(freies Cash, 15 % NAV, 0,5 % NAV / Stopabstand)
- Halt: mindestens zwei Handelstage, eine Entscheidung je Schlussdatum
- Ausschluss: kein Score, Risikosperre, Goldman nach Sitzungsplus ≥ 2 %, Nvidia ohne Bonus

**S2 Rücksetzer im intakten Trend** (`S2-PULL`)

- 15-Tage-Rendite des Namens > 0
- letzter Sitzungstag ≤ −1,5 %
- relPct ≥ −0,5 vs SPY
- sonst wie S1
- Ein gefallener Kurs allein reicht nicht

Getrennte Tests (beide bestanden):

| Fall | Input | Ergebnis |
|---|---|---|
| S1 Broadcom | rel +3 | Kauf AVGO, 45 $ (15-%-Cap), nicht 240 $ |
| S2 ohne S1 | AVGO 15d +2,4 %, rel −0,1, Tag −2,1 % | Trigger `S2-PULL`, Kauf AVGO |
| S1 vor S2 | JPM rel +3 und Tag −2 % | `S1-RS`, nicht S2 |
| Goldman | GS Session +3,73 % | Trigger `null` |
| kein Score | leeres Tape | `decidePulse` = null (Halten) |

**Stop 2 %**

Startannahme, kein Optimum. Gegen Seed-Kerzen (`generateBars`, kein Live-Yahoo in diesem Lauf):

| Name | Seed-Vol/Tag | ATR Seed | 2 % / ATR |
|---|---|---|---|
| SPY | 0,7 % | 0,44 % | 4,59 |
| Broadcom | 1,7 % | 1,21 % | 1,66 |
| Nvidia | 1,8 % | 1,15 % | 1,74 |

Live-ATR aus Yahoo: **nicht ausgeführt**. Kurslücken füllen zum vorliegenden Kurs, nicht zum Stop.

## 3. Zeitlicher Ablauf (ausgeführter Test `ablauf-s2`)

S2 Broadcom, 0,12 Stück, geplant 45 $. Quelle der Kurse im Test: übergebene Quote-Stempel, kein Live-Broker.

| Schritt | Zeit | Was |
|---|---|---|
| Daten | 2026-09-11T20:00:00.000Z | Schluss, Quelle yahoo-Stempel im Test |
| Entscheidung | 2026-09-13T10:00:00.000Z | S2, Sitzung zu → Status `planned` |
| Gültigkeit | bis 2026-09-14T16:00:00.000-04:00 | nächste Sitzung 16:00 New York |
| Börsenstart | 2026-09-14T13:31:00.000Z | bleibt `planned` (Open allein reicht nicht) |
| Fill | 2026-09-14T17:45:00.000Z | `simulated_filled`, 10 bp, eine Order |

Ausführungspreis im Test: **360 $** (Last im Book der Planung). Das Montags-Quote **361 $** wurde nicht in die Buchung geschrieben. Offener Punkt: geplante Orders behalten beim Fill den Planpreis.

## 4. Vergleich (identischer Start 300 $, Kosten 10 bp je Seite)

Getrennte Experiment-IDs. Legacy unangetastet. Kein Lane überschreibt einen anderen.

| Lane | ID | Status | Dieser Lauf |
|---|---|---|---|
| A feste Regeln | `exp-paper-v2-2026-09-compare-a-rules` | implementiert | +0,00 % (leeres Book, nur Cash) |
| B Regeln + Modell + Gegenprüfung | `exp-paper-v2-2026-09-compare-b-model` | **NICHT IMPLEMENTIERT** | keine Zahl |
| C passiv SPY halten | `exp-paper-v2-2026-09-compare-c-spy` | implementiert, **Seed-Kerzen** | −2,053 % auf 2026-07-27–2026-08-21 |

C ist kein Live-Marktvergleich. Yahoo-Tape für denselben Fenstervergleich: **nicht ausgeführt**.  
A gegen C über echte Schlüsse: **nicht ausgeführt**.  
B ändert `decidePulse` nicht; Floor-Chat bleibt Erklärung.

## 5. Nachweise

Ausgeführt am 13.09.2026 in dieser Umgebung:

```
node --experimental-strip-types --test src/lib/ledger.test.ts src/lib/paper-audit.test.ts src/lib/app-data/app-data.test.ts src/lib/auth/gate-identity.test.ts
# tests 55  pass 55  fail 0
```

Paper-Audit schreibt `artifacts/paper-audit-cases.json` (31 Fälle, alle `pass: true`).

Ausgeführt unter anderem: Legacy unangetastet, Goldman nicht ausführbar, Idempotenz, Reload, Tabs, Sitzung zu, veralteter Kurs, gemeinsames Cash, Gebühren/Bruch, Stop-Lücke, CHECK Ist/Soll, kein Kauf ohne Score, S1-Größe, S2 ohne S1, Ablauf PLANNED→Fill, Vergleich A/B/C.

Nicht ausgeführt:

- Live-Yahoo-ATR
- Live-Vergleich A gegen C über echte Schlüsse
- Lane B
- Nutzer-Browser-Archiv `vesper-paper-v6` (hier nicht lesbar)
- `npm test` komplett grün (8 Plattform-PWA-Fälle rot, siehe oben)

## Speicher

- Aktiv: `vesper-paper-book:book-paper-v2`
- Archiv: Kopie `vesper-paper-book:book-legacy-incomplete`
- Alter Schlüssel `vesper-paper-v6`: nur lesen

## Paketinhalt

Enthalten: `src/`, `scripts/`, `public/`, `server/`, `migrations/`, Tests, `package.json` + Lock, Vite/TS/ESLint, `startup.sh`, `PAPER-START.md`, `README.md`, `env.example` (leer), Nachweise unter `artifacts/paper-audit-*.json|md`.

Nicht enthalten: `node_modules/`, `dist/`, Screenshots, `.grok/`, `.env`, Zugangsdaten, das alte Archiv `vesper-paper-audit.tar.gz` (bleibt unangetastet außerhalb dieses ZIP).
