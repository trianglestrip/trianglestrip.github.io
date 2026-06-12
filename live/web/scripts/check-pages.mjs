/**
 * 检查 live 页面与 API
 * 用法: node scripts/check-pages.mjs [baseUrl]
 */
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8765";

const pages = [
  { path: "/douyu", expect: ["斗鱼直播", "虎牙直播"] },
  { path: "/douyu/category", expect: ["斗鱼直播"] },
  { path: "/douyu/category/1?pid=1", expect: [] },
  { path: "/douyu/play/5720533", expect: [] },
  { path: "/watch/douyu/5720533", expect: [] },
];

const apiChecks = [
  "/api/health",
  "/api/categories?site=douyu",
  "/api/rooms?site=douyu&recommend=1&page=1",
];

const errors = [];
const consoleErrors = [];

async function checkApi(fetch, url) {
  const res = await fetch(`${base}${url}`);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    errors.push(`API ${url}: 非 JSON (${res.status}) ${text.slice(0, 80)}`);
    return;
  }
  if (!res.ok || json.ok === false) {
    errors.push(`API ${url}: ${res.status} ${json.error || text.slice(0, 80)}`);
    return;
  }
  console.log(`OK API ${url}`);
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push({ url: page.url(), text: msg.text() });
});

page.on("pageerror", (err) => {
  errors.push(`PAGE ERROR @ ${page.url()}: ${err.message}`);
});

for (const url of apiChecks) {
  try {
    const res = await fetch(`${base}${url}`);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      errors.push(`API ${url}: 非 JSON (${res.status})`);
      continue;
    }
    if (!res.ok || json.ok === false) {
      errors.push(`API ${url}: ${res.status} ${json.error || ""}`);
    } else {
      console.log(`OK API ${url}`);
    }
  } catch (e) {
    errors.push(`API ${url}: ${e.message}`);
  }
}

for (const item of pages) {
  const url = `${base}${item.path}`;
  try {
    const resp = await page.goto(url, {
      waitUntil: url.includes("/play/") ? "domcontentloaded" : "networkidle",
      timeout: 45000,
    });
    const status = resp?.status();
    const html = await page.content();
    const hasDist = /\/assets\/index-[^"]+\.js/.test(html);
    const hasSrc = html.includes("/src/main.js");
    const appText = await page.locator("#app").innerText().catch(() => "");

    if (status !== 200) errors.push(`${item.path}: HTTP ${status}`);
    if (hasSrc && !hasDist) errors.push(`${item.path}: 托管了源码 index（/src/main.js）`);
    if (!hasDist) errors.push(`${item.path}: 缺少 dist 资源`);

    for (const text of item.expect) {
      if (!appText.includes(text)) errors.push(`${item.path}: 缺少文案「${text}」`);
    }

    if (item.path === "/douyu") {
      const cards = await page.locator(".room-item").count();
      if (cards === 0) errors.push("/douyu: 推荐列表无 .room-item 卡片");
      else console.log(`OK /douyu room cards: ${cards}`);
    }

    if (item.path.startsWith("/douyu/category/1")) {
      await page.waitForTimeout(2000);
      const cards = await page.locator(".room-item").count();
      if (cards === 0) errors.push("/douyu/category/1: 分类下无直播间");
      else console.log(`OK category rooms: ${cards}`);
    }

    if (item.path.includes("/play/") || item.path.includes("/watch/")) {
      await page.waitForTimeout(6000);
      const video = page.locator("video");
      if ((await video.count()) === 0) errors.push(`${item.path}: 无 video 元素`);
      const status = await page.locator(".status").first().innerText().catch(() => "");
      const title = await page.locator(".play-title").first().innerText().catch(() => "");
      console.log(`PLAY ${item.path} title=${title.slice(0, 30)} status=${status.slice(0, 80)}`);
      if (/失败|未就绪|404/i.test(status) && !/播放中|flv|m3u8/i.test(status)) {
        errors.push(`${item.path}: 播放异常 - ${status.slice(0, 100)}`);
      }
    }

    console.log(`OK page ${item.path} title=${await page.title()}`);
  } catch (e) {
    errors.push(`${item.path}: ${e.message}`);
  }
}

await browser.close();

if (consoleErrors.length) {
  console.log("\nConsole errors:");
  for (const e of consoleErrors.slice(0, 10)) console.log(`  [${e.url}] ${e.text}`);
}

if (errors.length) {
  console.error("\n=== FAILURES ===");
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log("\nAll checks passed.");
