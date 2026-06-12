/**
 * 播放页稳定性与开声测试
 * node scripts/test-playback.mjs [baseUrl] [roomId]
 */
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:5173";
const room = process.argv[3] || "252140";
const url = `${base}/douyu/play/${room}`;

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
const issues = [];
page.on("console", (m) => {
  const t = m.text();
  if (t.includes("SourceEnded") || t.includes("not valid JSON")) issues.push(t);
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("video", { timeout: 30000 });

const errText = await page.evaluate(() => document.body.innerText);
if (errText.includes("not valid JSON")) {
  console.error("FAIL: API 返回 HTML，检查 config 或代理");
  process.exit(1);
}

await page.waitForFunction(
  () => {
    const v = document.querySelector("video");
    return v && !v.paused && v.currentTime > 0.5;
  },
  { timeout: 30000 },
);

for (let i = 0; i < 16; i += 1) {
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => {
    const v = document.querySelector("video");
    return { paused: v?.paused, ended: v?.ended, ct: v?.currentTime };
  });
  if (s.ended) {
    console.error("FAIL: 播放中断", s, issues);
    process.exit(1);
  }
  if (i === 15) console.log("OK: 8s 稳定播放", s);
}

await page.mouse.move(400, 300);
await page.waitForFunction(
  () => {
    const v = document.querySelector("video");
    return v && !v.paused && !v.muted && v.currentTime > 0.5;
  },
  { timeout: 20000 },
);

const after = await page.evaluate(() => {
  const v = document.querySelector("video");
  return { paused: v?.paused, ended: v?.ended, muted: v?.muted, ct: v?.currentTime };
});
if (after.muted) {
  console.error("FAIL: 开声后仍静音", after);
  process.exit(1);
}
console.log("OK: 静音自动播 + 点击开声", after, issues.length ? `warnings: ${issues.join(" | ")}` : "");
await browser.close();
