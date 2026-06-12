/**
 * Chrome 无头采集控制台与页面状态，写入 debug-79f7ec.log
 * 用法: node scripts/chrome-debug.mjs [baseUrl]
 */
import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const LOG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "debug-79f7ec.log");
const base = process.argv[2] || "http://127.0.0.1:8765";
const sessionId = "79f7ec";

function log(hypothesisId, location, message, data = {}) {
  const line = JSON.stringify({
    sessionId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
    runId: "chrome-sim",
  });
  appendFileSync(LOG, `${line}\n`);
}

const urls = [
  `${base}/`,
  `${base}/watch/douyu/5720533`,
  `${base}/platform/huya`,
];

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext();
const page = await context.newPage();

page.on("console", (msg) => {
  log("H3", "chrome:console", msg.type(), {
    text: msg.text(),
    url: page.url(),
  });
});

page.on("pageerror", (err) => {
  log("H1", "chrome:pageerror", err.message, { url: page.url(), stack: err.stack?.slice(0, 500) });
});

for (const url of urls) {
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
    const html = await page.content();
    const hasSrcMain = html.includes("/src/main.js");
    const hasAssets = /\/assets\/index-[^"]+\.js/.test(html);
    const appText = await page.locator("#app").innerText().catch(() => "");
    log("H1", "chrome:goto", "page loaded", {
      url,
      status: resp?.status(),
      hasSrcMain,
      hasAssets,
      appTextPreview: appText.slice(0, 120),
      title: await page.title(),
    });
    if (url.includes("/watch/")) {
      const playBtn = page.locator("button.btn-primary, button:has-text('播放')").first();
      if (await playBtn.count()) {
        await playBtn.click();
        await page.waitForTimeout(4000);
        log("H3", "chrome:watch", "after play click", {
          url: page.url(),
          statusText: await page.locator(".status, .tips .status").first().innerText().catch(() => ""),
        });
      }
    }
  } catch (err) {
    log("H4", "chrome:goto", "navigation failed", { url, error: String(err) });
  }
}

await browser.close();
console.log("logged to", LOG);
