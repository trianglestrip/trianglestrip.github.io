/**
 * 播放页打开速度基准测试
 * node scripts/benchmark-play.mjs [baseUrl] [roomId] [runs]
 */
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8765";
const room = process.argv[3] || "252140";
const runs = Math.max(1, Number(process.argv[4]) || 3);
const url = `${base}/douyu/play/${room}`;

async function measureApiRoom() {
  const t0 = performance.now();
  const res = await fetch(
    `${base}/api/room?site=douyu&room=${room}&mode=lazy&source=local`,
  );
  const json = await res.json();
  const ms = performance.now() - t0;
  return { ms, cached: !!json.cached, ok: json.ok !== false };
}

async function measurePage(browser) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const marks = { apiRoomMs: null, wsConnectMs: null };

  page.on("request", (req) => {
    if (req.url().includes("/api/room") && marks.apiRoomStart == null) {
      marks.apiRoomStart = Date.now();
    }
  });
  page.on("response", async (res) => {
    if (res.url().includes("/api/room") && marks.apiRoomMs == null) {
      marks.apiRoomMs = Date.now() - marks.apiRoomStart;
      try {
        const json = await res.json();
        marks.apiCached = !!json.cached;
      } catch {
        marks.apiCached = false;
      }
    }
  });

  const navStart = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  const domReadyMs = Date.now() - navStart;

  await page.waitForSelector("video", { timeout: 30000 });
  const videoElMs = Date.now() - navStart;

  await page.waitForFunction(
    () => {
      const v = document.querySelector("video");
      return v && v.readyState >= 1;
    },
    { timeout: 60000 },
  );
  const videoMetaMs = Date.now() - navStart;

  await page.waitForFunction(
    () => {
      const v = document.querySelector("video");
      return v && !v.paused && v.readyState >= 2;
    },
    { timeout: 60000 },
  );
  const playingMs = Date.now() - navStart;

  const wsMs = await page.evaluate(() => {
    return new Promise((resolve) => {
      const start = performance.now();
      const check = () => {
        const entries = performance.getEntriesByType("resource");
        const ws = entries.find((e) => e.name.includes("danmuproxy.douyu.com"));
        if (ws) {
          resolve(Math.round(ws.responseEnd || ws.duration || 0));
          return;
        }
        if (performance.now() - start > 500) {
          resolve(null);
          return;
        }
        requestAnimationFrame(check);
      };
      setTimeout(() => resolve(null), 8000);
      check();
    });
  });

  const resources = await page.evaluate(() => {
    return performance.getEntriesByType("resource").map((e) => ({
      name: e.name.split("/").slice(-2).join("/"),
      dur: Math.round(e.duration),
      size: e.transferSize || 0,
    }));
  });

  await page.close();

  return {
    domReadyMs,
    videoElMs,
    videoMetaMs,
    playingMs,
    apiRoomMs: marks.apiRoomMs,
    apiCached: marks.apiCached,
    wsResourceMs: wsMs,
    topResources: resources
      .filter((r) => r.dur > 50)
      .sort((a, b) => b.dur - a.dur)
      .slice(0, 8),
  };
}

function avg(rows, key) {
  const vals = rows.map((r) => r[key]).filter((v) => v != null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

console.log(`\n=== 播放页基准 ${url} (${runs} 次) ===\n`);

const api = await measureApiRoom();
console.log(`API /api/room 直连: ${Math.round(api.ms)}ms${api.cached ? " (cached)" : ""}`);

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = [];
for (let i = 0; i < runs; i += 1) {
  const row = await measurePage(browser);
  results.push(row);
  console.log(
    `Run ${i + 1}: DOM ${row.domReadyMs}ms | video标签 ${row.videoElMs}ms | 首帧元数据 ${row.videoMetaMs}ms | 播放中 ${row.playingMs}ms | API ${row.apiRoomMs ?? "?"}ms`,
  );
}
await browser.close();

console.log("\n--- 平均 ---");
console.log(`DOM ready:     ${avg(results, "domReadyMs")}ms`);
console.log(`video 出现:    ${avg(results, "videoElMs")}ms`);
console.log(`video 元数据:  ${avg(results, "videoMetaMs")}ms`);
console.log(`开始播放:      ${avg(results, "playingMs")}ms`);
console.log(`API /api/room: ${avg(results, "apiRoomMs")}ms`);

const last = results[results.length - 1];
if (last?.topResources?.length) {
  console.log("\n--- 较慢资源 (末次) ---");
  for (const r of last.topResources) {
    console.log(`  ${r.dur}ms  ${r.name}`);
  }
}

console.log("");
