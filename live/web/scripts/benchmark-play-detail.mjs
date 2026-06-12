/**
 * 播放页详细耗时分解
 * node scripts/benchmark-play-detail.mjs [baseUrl] [roomId]
 */
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8765";
const room = process.argv[3] || "252140";
const url = `${base}/douyu/play/${room}`;

async function timeApi(label, urlStr) {
  const t0 = performance.now();
  const res = await fetch(urlStr, { cache: "no-store" });
  const json = await res.json();
  return {
    label,
    ms: Math.round(performance.now() - t0),
    cached: !!json.cached || !!json.cached_meta,
    ok: json.ok !== false,
  };
}

console.log(`\n=== 详细基准 ${url} @ ${new Date().toISOString()} ===\n`);

const coldApi = await timeApi(
  "API 冷解析",
  `${base}/api/room?site=douyu&room=${room}&mode=lazy&source=local&_=${Date.now()}`,
);
const warmApi = await timeApi(
  "API 热缓存",
  `${base}/api/room?site=douyu&room=${room}&mode=lazy&source=local`,
);
console.log(`${coldApi.label}: ${coldApi.ms}ms`);
console.log(`${warmApi.label}: ${warmApi.ms}ms${warmApi.cached ? " (cached)" : ""}`);

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const marks = { apiStart: 0, apiEnd: 0, flvEnd: 0, playEnd: 0 };
page.on("request", (req) => {
  if (req.url().includes("/api/room") && !marks.apiStart) marks.apiStart = Date.now();
});
page.on("response", (res) => {
  if (res.url().includes("/api/room") && !marks.apiEnd) marks.apiEnd = Date.now();
  if (res.url().includes("flv.min.js") && !marks.flvEnd) marks.flvEnd = Date.now();
});

const tNav = Date.now();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
const domReady = Date.now() - tNav;

await page.waitForSelector("video", { timeout: 30000 });
const videoEl = Date.now() - tNav;

await page.waitForFunction(
  () => {
    const v = document.querySelector("video");
    return v && !v.paused && v.readyState >= 2;
  },
  { timeout: 60000 },
);
marks.playEnd = Date.now();
const playing = marks.playEnd - tNav;

const timing = await page.evaluate(() => {
  const nav = performance.getEntriesByType("navigation")[0];
  const resources = performance.getEntriesByType("resource")
    .map((e) => ({
      name: e.name.includes("flv.min") ? "flv.min.js" : e.name.split("/").slice(-2).join("/"),
      dur: Math.round(e.duration),
      ttfb: Math.round(e.responseStart - e.startTime),
      size: e.transferSize || 0,
    }))
    .filter((r) => r.dur > 30)
    .sort((a, b) => b.dur - a.dur)
    .slice(0, 12);
  return {
    html: nav ? Math.round(nav.responseEnd - nav.startTime) : null,
    domInteractive: nav ? Math.round(nav.domInteractive - nav.startTime) : null,
    domComplete: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
    resources,
  };
});

await browser.close();

console.log("\n--- 单次完整进页 ---");
console.log(`DOM ready:        ${domReady}ms`);
console.log(`video 标签:       ${videoEl}ms`);
console.log(`开始播放:         ${playing}ms`);
if (marks.apiStart && marks.apiEnd) {
  console.log(`/api/room 页面内: ${marks.apiEnd - marks.apiStart}ms`);
}
if (timing.html != null) {
  console.log(`HTML 下载+解析:   ${timing.html}ms`);
  console.log(`domInteractive:   ${timing.domInteractive}ms`);
}

console.log("\n--- 资源耗时 Top ---");
for (const r of timing.resources) {
  const kb = r.size ? `${Math.round(r.size / 1024)}KB` : "cache";
  console.log(`  ${String(r.dur).padStart(5)}ms  ttfb ${String(r.ttfb).padStart(4)}ms  ${kb.padStart(6)}  ${r.name}`);
}

console.log("");
