import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const url = process.argv[2] ?? "http://127.0.0.1:8080/";
await mkdir("/workspace/screenshots", { recursive: true });

const TICKER = /\b(NVDA|AAPL|MSFT|AMZN|GOOGL|META|TSLA|AVGO|LLY|JPM|UNH|GS|BLK|SPY|VOO|QQQ|IWM|TLT)\b/;
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error" && !/caret-color/.test(m.text())) errors.push(m.text());
});

await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(1200);

const hints = await page.locator("[data-vesper='vesper.room'] button").allInnerTexts();
const hintText = hints.join(" | ");
const hintsHaveTicker = TICKER.test(hintText);
const hintsHaveTip = /Noch nicht kaufen|Halten|Weniger halten|Nicht kaufen|Genau anschauen/.test(hintText);
const hintsHaveName = /Nvidia|Apple|Microsoft|US-Aktienkorb|Tesla|Alphabet/.test(hintText);

const input = page.locator('input[placeholder="Oder schreiben…"], input[placeholder="Schreiben…"]').first();
await input.waitFor({ timeout: 8000 });
await input.fill("Was empfiehlst du bei Nvidia?");
await input.press("Enter");

const room = page.locator("[data-vesper='vesper.room']");
await room.waitFor({ timeout: 8000 });
const display = page.locator("[data-vesper='vesper.room'] p.font-display").first();

let spoken = "";
const deadline = Date.now() + 50000;
while (Date.now() < deadline) {
  spoken = ((await display.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
  const stillWait = /prüft|willkommen|womit soll ich beginnen/i.test(spoken);
  const hit = /kaufen|halten|zuschauen|prüfen|Nvidia/i.test(spoken);
  if (!stillWait && hit && spoken.length > 30) break;
  await page.waitForTimeout(700);
}

const stayedHome = (await page.url()).replace(/\/$/, "") === url.replace(/\/$/, "");
await page.screenshot({ path: "/workspace/screenshots/vesper-advice.png", fullPage: false });

await page.goto(new URL("/universe", url).toString(), { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(900);
const uni = await page.locator("body").innerText();
const uniTickers = uni.match(/\b(NVDA|AAPL|MSFT|SPY|VOO|TSLA|QQQ)\b/g) ?? [];
await page.screenshot({ path: "/workspace/screenshots/universe-names.png", fullPage: false });

await page.goto(new URL("/kommando", url).toString(), { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(800);
const komm = await page.locator("body").innerText();
const kommTickers = (komm.match(/\b(NVDA|SPY|VOO|TSLA)\b/g) ?? []).filter((t, i, a) => a.indexOf(t) === i);
await page.screenshot({ path: "/workspace/screenshots/kommando-names.png", fullPage: false });

await browser.close();
const spokenHasTicker = TICKER.test(spoken);
const spokenHasTip = /kaufen|halten|zuschauen|prüfen/i.test(spoken);
const ok =
  !hintsHaveTicker &&
  hintsHaveTip &&
  hintsHaveName &&
  stayedHome &&
  !spokenHasTicker &&
  spokenHasTip &&
  uniTickers.length === 0 &&
  errors.length === 0;

console.log(
  JSON.stringify(
    {
      ok,
      hintsHaveTicker,
      hintsHaveTip,
      hintsHaveName,
      hintText: hintText.slice(0, 400),
      stayedHome,
      spokenHasTicker,
      spokenHasTip,
      spokenPreview: spoken.slice(0, 500),
      uniTickers,
      kommTickers,
      errors,
    },
    null,
    2,
  ),
);
process.exit(ok ? 0 : 1);
