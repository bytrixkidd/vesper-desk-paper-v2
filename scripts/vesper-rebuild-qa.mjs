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

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
}

async function say(text) {
  const input = page.locator('input[placeholder="Oder schreiben…"], input[placeholder="Schreiben…"]').first();
  await input.waitFor({ timeout: 8000 });
  await input.fill(text);
  await input.press("Enter");
  await page.waitForTimeout(1400);
}

await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(800);

const navLabels = [
  "Vesper",
  "Kommando",
  "Floor-Chat",
  "Charts",
  "Universum",
  "Demo",
  "Trading",
  "Mandat",
  "Feedback",
  "Overnight",
  "Filings",
  "Sentiment",
  "Whale-Flows",
  "Earnings",
  "Makro",
  "Stabschef",
];
const navHits = {};
for (const label of navLabels) {
  navHits[label] = (await page.getByRole("link", { name: label }).count()) > 0;
}
const body = await page.locator("body").innerText();
const banned = ["watching Tag", "NAV", "rel -", "Paper-Watch", "S&P 500 ETF", "Risk-on"];
const bannedHits = banned.filter((b) => body.includes(b));
const core = await page.locator("[data-vesper='vesper.core']").count();
await shot("vesper-home");

await say("Öffne Nvidia.");
await page.waitForTimeout(1600);
const path1 = new URL(page.url()).pathname;
const nvdaVisible = (await page.getByText("Nvidia", { exact: false }).count()) > 0 || (await page.getByText("NVIDIA", { exact: false }).count()) > 0;
const mark = await page.locator("[data-vesper-on='1']").count();
await shot("vesper-nvidia");

await say("Markiere den letzten Rückgang.");
await page.waitForTimeout(1200);
await shot("vesper-mark");

await say("Zeig mir die Diagnose.");
await page.waitForTimeout(1200);
const diag = (await page.getByText("Prüfung", { exact: false }).count()) > 0 || (await page.getByText("Tag ", { exact: false }).count()) > 0;
await shot("vesper-diag");

await say("Vergleiche Nvidia mit Tesla.");
await page.waitForTimeout(1200);
const compare = (await page.getByText("Tesla", { exact: false }).count()) > 0;
await shot("vesper-compare");

await page.setViewportSize({ width: 1920, height: 1080 });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await shot("vesper-home-1920");

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Menü öffnen" }).click().catch(() => {});
await page.waitForTimeout(400);
await shot("vesper-home-mobile");

await browser.close();
console.log(
  JSON.stringify(
    {
      navHits,
      navOk: Object.values(navHits).every(Boolean),
      core: core > 0,
      bannedHits,
      pathAfterOpen: path1,
      nvdaVisible,
      mark,
      diag,
      compare,
      errors: errors.slice(0, 12),
    },
    null,
    2,
  ),
);
