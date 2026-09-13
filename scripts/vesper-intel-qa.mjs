import { chromium } from "playwright";
import fs from "node:fs";

const dir = "/workspace/artifacts/qa";
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--disable-web-security"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(45000);

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

// TEST 1: prepared card exists before the user asks
const before = await page.evaluate(() => {
  try {
    const raw = localStorage.getItem("vesper-intel-v1");
    const bundle = raw ? JSON.parse(raw) : null;
    const card = bundle?.cards?.NVDA;
    return {
      hasCard: Boolean(card),
      spoken: card?.spoken ?? null,
      rec: card?.rec ?? null,
      diagnosis: card?.diagnosis ?? null,
      bots: card?.bots?.length ?? 0,
      stale: card?.stale ?? null,
    };
  } catch (e) {
    return { error: String(e) };
  }
});
console.log("TEST1 before open", JSON.stringify(before, null, 2));

await page.screenshot({ path: `${dir}/intel-home.png`, fullPage: false });

const input = page.locator("input[placeholder='Oder schreiben…']");
await input.fill("Öffne NVIDIA");
await page.getByRole("button", { name: "Senden" }).click();

await page.waitForTimeout(2500);
const url = page.url();
console.log("url after open", url);

const after = await page.evaluate(() => {
  const raw = localStorage.getItem("vesper-intel-v1");
  const bundle = raw ? JSON.parse(raw) : null;
  const card = bundle?.cards?.NVDA;
  const diags = JSON.parse(localStorage.getItem("vesper-diag-v1") || "[]");
  const nvdaDx = diags.filter((d) => d.symbol === "NVDA");
  return {
    spoken: card?.spoken ?? null,
    rec: card?.rec ?? null,
    diagnosis: card?.diagnosis ?? null,
    displayHead: (card?.display ?? "").split("\n").slice(0, 4),
    bots: (card?.bots ?? []).map((b) => `${b.name}:${b.stance}`),
    nextCheck: card?.nextCheck ?? null,
    dxCount: nvdaDx.length,
    dxDays: nvdaDx.map((d) => `${d.status}:${d.day}/${d.days}`),
  };
});
console.log("TEST2 after open store", JSON.stringify(after, null, 2));

const companionText = await page.locator("aside[aria-label='Vesper'] p.font-display").first().textContent().catch(() => null);
console.log("companion spoken", companionText);

await page.screenshot({ path: `${dir}/intel-nvda-open.png`, fullPage: false });

async function ask(text) {
  const box = page.locator("aside[aria-label='Vesper'] input[placeholder='Schreiben…']");
  await box.fill(text);
  await box.press("Enter");
  await page.waitForTimeout(1800);
  const spoken = await page.locator("aside[aria-label='Vesper'] p.font-display").first().textContent();
  return spoken;
}

const need = await ask("Was müsste passieren?");
console.log("TEST follow need", need);
const odds = await ask("Wie wahrscheinlich ist das?");
console.log("TEST follow odds", odds);
const bots = await ask("Was sagen die Bots?");
console.log("TEST follow bots", bots);
const keep = await ask("Beobachte es weiter.");
console.log("TEST follow keep", keep);

const afterFollow = await page.evaluate(() => {
  const diags = JSON.parse(localStorage.getItem("vesper-diag-v1") || "[]");
  return diags.filter((d) => d.symbol === "NVDA").map((d) => `${d.status}:${d.day}/${d.days}:${d.id}`);
});
console.log("TEST4 diagnoses after beobachte weiter", afterFollow);

await page.screenshot({ path: `${dir}/intel-nvda-follow.png`, fullPage: false });

const falsePromise = /in zwei Tagen können wir investieren|in 2 Tagen kaufen|Kaufzusage/i.test(
  `${after.spoken} ${after.nextCheck} ${keep}`,
);
console.log("TEST8 false time promise", falsePromise);

const contentOk = before.hasCard && after.spoken && after.spoken !== "Natürlich, Sir." && /Diagnose|einsteigen|abwarten|halten/i.test(after.spoken);
console.log("CONTENT_OK", contentOk, after.spoken);

await browser.close();
