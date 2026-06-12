/** 播放页侧栏结构检查 */
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8765";
const room = process.argv[3] || "252140";

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
await page.goto(`${base}/douyu/play/${room}`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(".play-side", { timeout: 20000 });
await page.waitForTimeout(8000);

const info = await page.evaluate(() => ({
  tabs: [...document.querySelectorAll(".play-side .tabs button")].map((b) => b.textContent?.trim()),
  hasChat: !!document.querySelector(".chat-list"),
  hasFollowTab: [...document.querySelectorAll(".play-side .tabs button")].some((b) => b.textContent?.includes("关注")),
  hasSettings: [...document.querySelectorAll(".play-side .tabs button")].some((b) => b.textContent?.includes("设置")),
  chatItems: document.querySelectorAll(".chat-item").length,
  danmakuCanvas: !!document.querySelector(".danmaku-canvas"),
  hasQuickJump: !!document.querySelector(".quick-row"),
  hasRecommend: document.body.innerText.includes("推荐直播"),
}));

console.log(info);
await browser.close();
