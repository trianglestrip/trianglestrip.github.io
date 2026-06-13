/**
 * 前端冒烟：dist/web @ 8080（含 API 反代）
 * 用法: node scripts/smoke-front.mjs [baseUrl]
 */
import { chromium } from "playwright";

const base = (process.argv[2] || "http://127.0.0.1:8080").replace(/\/$/, "");
const errors = [];
const apiCalls = [];

const scenarios = [
  {
    id: "douyu-home",
    path: "/douyu",
    waitMs: 3000,
    check: async (page) => {
      const cards = await page.locator(".room-item").count();
      if (cards === 0) errors.push("douyu-home: 无推荐卡片");
    },
    forbidApi: [/site=douyin/],
  },
  {
    id: "douyin-home",
    path: "/douyin",
    waitMs: 1500,
    check: async (page) => {
      const text = await page.locator("#app").innerText();
      if (!text.includes("暂不支持推荐列表") && !text.includes("输入房间号")) {
        errors.push("douyin-home: 缺少直连房间提示");
      }
      const bad = apiCalls.filter((u) => u.includes("/api/rooms") && u.includes("site=douyin"));
      if (bad.length) errors.push(`douyin-home: 不应请求列表 API (${bad.length} 次)`);
    },
  },
  {
    id: "douyu-play",
    path: "/douyu/play/5720533",
    waitMs: 10000,
    check: async (page) => {
      const overlay = await page.locator(".play-overlay").first().innerText().catch(() => "");
      if (/失败|404|暂不支持/i.test(overlay)) {
        errors.push(`douyu-play: ${overlay.slice(0, 120)}`);
      }
    },
  },
  {
    id: "douyin-play-error",
    path: "/douyin/play/755100469482",
    waitMs: 5000,
    check: async (page) => {
      const overlay = await page.locator(".play-overlay").first().innerText().catch(() => "");
      if (!/失败|无法查看|未开播/i.test(overlay)) {
        errors.push(`douyin-play-error: 应显示解析失败提示，实际: ${overlay.slice(0, 80) || "(空)"}`);
      }
    },
  },
  {
    id: "time",
    path: "/time",
    waitMs: 2000,
    check: async (page) => {
      const text = await page.locator("#app").innerText();
      if (!text.includes("缓存状态") && !text.includes("解析耗时")) {
        errors.push("time: 页面未加载 /api/time 数据");
      }
      if (text.includes("Unexpected token") || text.includes("服务器响应异常")) {
        errors.push("time: API 响应异常");
      }
    },
  },
  {
    id: "huya-home",
    path: "/huya",
    waitMs: 3000,
    check: async (page) => {
      const cards = await page.locator(".room-item").count();
      if (cards === 0) errors.push("huya-home: 无推荐卡片");
    },
  },
];

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

page.on("console", (msg) => {
  if (msg.type() !== "error") return;
  const text = msg.text();
  if (/404 \(Not Found\)/.test(text)) return;
  if (/Early-EOF|IOController|TransmuxingController/.test(text)) return;
  errors.push(`console @ ${page.url()}: ${text}`);
});
page.on("response", (res) => {
  const url = res.url();
  if (url.includes("/api/")) {
    apiCalls.push(url);
    if (res.status() >= 500) errors.push(`HTTP ${res.status()} ${url}`);
  }
});

for (const s of scenarios) {
  apiCalls.length = 0;
  try {
    const resp = await page.goto(`${base}${s.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    if ((resp?.status() ?? 0) !== 200) errors.push(`${s.id}: HTTP ${resp?.status()}`);
    await page.waitForTimeout(s.waitMs);
    await s.check(page);
    console.log(`OK ${s.id}`);
  } catch (e) {
    errors.push(`${s.id}: ${e.message}`);
  }
}

await browser.close();

if (errors.length) {
  console.error("\n=== FAILURES ===");
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log("\nAll smoke checks passed.");
