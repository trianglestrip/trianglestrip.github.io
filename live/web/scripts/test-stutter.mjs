/**
 * 检测播放卡顿：统计 currentTime 停滞次数
 * node scripts/test-stutter.mjs [baseUrl] [roomId] [seconds]
 */
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8080";
const room = process.argv[3] || "252140";
const seconds = Number(process.argv[4]) || 20;
const url = `${base}/douyu/play/${room}`;

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(
  () => {
    const v = document.querySelector("video");
    return v && !v.paused && v.currentTime > 1;
  },
  { timeout: 30000 },
);

const result = await page.evaluate(async (durationSec) => {
  const v = document.querySelector("video");
  let last = v.currentTime;
  let stallMs = 0;
  let stallEvents = 0;
  let ended = false;
  const start = performance.now();
  while (performance.now() - start < durationSec * 1000) {
    await new Promise((r) => setTimeout(r, 200));
    if (v.ended) {
      ended = true;
      break;
    }
    const ct = v.currentTime;
    if (!v.paused && Math.abs(ct - last) < 0.05) {
      stallMs += 200;
      if (stallMs >= 600 && stallMs - 200 < 600) stallEvents += 1;
    } else {
      stallMs = 0;
    }
    last = ct;
  }
  return {
    ended,
    paused: v.paused,
    ct: v.currentTime,
    stallEvents,
    buffered: v.buffered.length
      ? Array.from({ length: v.buffered.length }, (_, i) => ({
          start: v.buffered.start(i),
          end: v.buffered.end(i),
        }))
      : [],
  };
}, seconds);

console.log(`${seconds}s 监测`, result);
if (result.ended) {
  console.error("FAIL: 播放中断");
  process.exit(1);
}
if (result.stallEvents > 2) {
  console.error(`FAIL: 卡顿 ${result.stallEvents} 次`);
  process.exit(1);
}
console.log("OK: 流畅度可接受");
await browser.close();
