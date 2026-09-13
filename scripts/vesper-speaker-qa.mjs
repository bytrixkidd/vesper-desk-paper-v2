import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const url = process.argv[2] ?? "http://127.0.0.1:8080/";
await mkdir("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(800);

const input = page.locator('input[placeholder="Oder schreiben…"], input[placeholder="Schreiben…"]').first();
await input.waitFor({ timeout: 8000 });
await input.fill("Wie viel Gewinn haben wir?");
await input.press("Enter");

const display = page.locator("[data-vesper='vesper.room'] p.font-display").first();
await display.waitFor({ timeout: 8000 });

let spoken = "";
const deadline = Date.now() + 45000;
while (Date.now() < deadline) {
  spoken = ((await display.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
  const stillGreet = /willkommen|womit soll ich beginnen/i.test(spoken);
  const hit = /dollar|gewinn|eingezahlt|paper|testlauf|300|stand |kein echtgeld/i.test(spoken);
  const canned = spoken === "Natürlich, Sir." || spoken === "Natürlich, Sir";
  if (!stillGreet && hit && !canned && spoken.length > 40) break;
  await page.waitForTimeout(800);
}

await page.screenshot({ path: "/workspace/screenshots/vesper-speaker.png", fullPage: false });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await page.screenshot({ path: "/workspace/screenshots/vesper-speaker-mobile.png", fullPage: false });

const has350 = /350[-\s]?€|350 Euro|Monatsziel von 350/i.test(spoken);
const canned = spoken === "Natürlich, Sir." || spoken === "Natürlich, Sir";
const answered = /dollar|gewinn|eingezahlt|paper|testlauf|300|stand |kein echtgeld/i.test(spoken) && spoken.length > 40 && !/womit soll ich beginnen/i.test(spoken);

await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(new URL("/universe", url).toString(), { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(800);
const uni = await page.locator("body").innerText();
const deposited = /300[,.]00\s*\$|300\s*\$/.test(uni) || /Eingezahlt[\s\S]{0,80}300/.test(uni);
await page.screenshot({ path: "/workspace/screenshots/universe-now.png", fullPage: false });

await browser.close();
console.log(
  JSON.stringify(
    {
      answered,
      has350,
      canned,
      spokenPreview: spoken.slice(0, 520),
      deposited300: deposited,
      errors,
    },
    null,
    2,
  ),
);
process.exit(answered && !has350 && !canned ? 0 : 1);
