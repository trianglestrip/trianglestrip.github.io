import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8080";
const room = process.argv[3] || "9999";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${base}/douyu/play/${room}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(5000);
  const side = await page.locator(".play-side").isVisible();
  const panelMsg = await page.locator(".player-placeholder").textContent().catch(() => "");
  console.log(`room ${room}: side=${side} placeholder=${panelMsg?.trim()}`);
  await browser.close();
  if (!side) process.exitCode = 1;
}

main();
