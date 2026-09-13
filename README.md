# Vesper Desk

Grok-Programm von xAI. Kein Claude, kein Anthropic.

Paper-Trading, 300 Dollar virtuell. Modellaufrufe (Briefings/Chat) gehen nur über `XAI_API_KEY` an Grok. Der Handelspfad braucht kein Modell.

Kurzstart: [PAPER-START.md](PAPER-START.md)

```
cp env.example .env
npm install
npm run test:paper
npm run dev
```

`node_modules` und die Plattform-Ordner (`scripts/grok-pwa-*`, Auth-Vorlagen) sind Gerüst vom Grok App Builder. Die Strategie steht in `src/lib/engine.ts`, `src/lib/hypotheses.ts`, `src/lib/pulse-exec.ts`.

Keine Zugangsdaten in diesem Paket. Legacy-Archiv (`vesper-paper-v6`) wird nicht überschrieben.
