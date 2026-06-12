/**
 * 验证播放页暂停后可恢复
 * node scripts/test-pause-resume.mjs [baseUrl] [roomId]
 */
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8765";
const room = process.argv[3] || "252140";

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
await page.goto(`${base}/douyu/play/${room}`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("video", { timeout: 30000 });
await page.waitForFunction(() => {
  const v = document.querySelector("video");
  return v && !v.paused && v.readyState >= 2;
}, { timeout: 30000 });

await page.click('button[title="暂停"]');
await page.waitForFunction(() => document.querySelector("video")?.paused === true, { timeout: 5000 });

await page.click('button[title="播放"]');
await page.waitForFunction(() => {
  const v = document.querySelector("video");
  return v && !v.paused;
}, { timeout: 10000 });

const state = await page.evaluate(() => {
  const v = document.querySelector("video");
  return { paused: v?.paused, readyState: v?.readyState };
});
console.log("OK pause/resume:", state);
await browser.close();
