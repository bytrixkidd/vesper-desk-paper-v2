import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:8080/";
const out = process.argv[3] ?? "/workspace/screenshots/vesper-qa.png";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
await page.getByRole("button", { name: "Vesper öffnen" }).click();
await page.waitForTimeout(600);
const greet = await page.getByText("Hallo, willkommen, Sir.").count();
await page.getByRole("button", { name: "Öffne NVIDIA" }).click();
await page.waitForTimeout(1800);
const path = new URL(page.url()).pathname;
const nvda = await page.getByText("NVIDIA", { exact: false }).count();
await page.screenshot({ path: out, fullPage: false });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: out.replace(".png", "-mobile.png") });
await browser.close();
console.log(
  JSON.stringify(
    { greet: greet > 0, path, nvda, errors, screenshot: out },
    null,
    2,
  ),
);
