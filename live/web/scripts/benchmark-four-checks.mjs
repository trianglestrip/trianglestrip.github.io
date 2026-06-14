/**
 * 四项优化建议专项测量
 * 1. jsTransfer vs play chunk 预拉时机
 * 2. images1s vs 列表列数
 * 3. 播放页 /api/room vs flv 拉流占比
 * 4. 侧栏相对 playing 延迟（>2.5s 需调 idle timeout）
 *
 * 用法: node scripts/benchmark-four-checks.mjs [baseUrl]
 */
import { chromium } from "playwright";

const base = (process.argv[2] || "http://127.0.0.1:8090").replace(/\/$/, "");
const IPAD = { width: 1180, height: 820 };

function shortUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function isPlayChunk(url) {
  const p = shortUrl(url);
  if (/preloadPlayView/i.test(p)) return false;
  return /PlayView|PlayerControls|DanmakuOverlay|PlaySidePanel|useLive|\/play[-.]/i.test(p);
}

function isImage(url) {
  if (/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(url)) return true;
  return /\/(live-cover|asrpic|webcast-cover|huyalive|cdnimage|upload\/avatar)/i.test(url);
}

async function measureHomePlayPreload(browser) {
  const ctx = await browser.newContext({ viewport: IPAD, locale: "zh-CN" });
  await ctx.clearCookies();
  const page = await ctx.newPage();
  const t0 = Date.now();
  const jsEvents = [];

  page.on("request", (req) => {
    const url = req.url();
    if (!/\.js(\?|$)/.test(url)) return;
    jsEvents.push({ t: Date.now() - t0, url, play: isPlayChunk(url) });
  });

  const navStart = Date.now();
  await page.goto(`${base}/douyu`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".room-item", { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource")
      .filter((e) => /\.js(\?|$)/.test(e.name))
      .map((e) => ({
        name: e.name,
        size: e.transferSize || 0,
        start: Math.round(e.startTime),
      })),
  );

  const jsTransferKb = Math.round(resources.reduce((s, r) => s + (r.size || 0), 0) / 1024);
  const playJs = resources.filter((r) => isPlayChunk(r.name));
  const playKb = Math.round(playJs.reduce((s, r) => s + (r.size || 0), 0) / 1024);
  const mainKb = jsTransferKb - playKb;
  const firstPlay = jsEvents.find((e) => e.play);
  const contentMs = Date.now() - navStart;

  await ctx.close();

  return {
    jsTransferKb,
    mainKb,
    playKb,
    playChunkCount: playJs.length,
    firstPlayChunkMs: firstPlay?.t ?? null,
    firstPlayChunkUrl: firstPlay ? shortUrl(firstPlay.url) : null,
    contentReadyMs: contentMs,
    earlyPreload: firstPlay != null && firstPlay.t < 800,
  };
}

async function measureImages1s(browser) {
  const ctx = await browser.newContext({ viewport: IPAD, locale: "zh-CN" });
  await ctx.clearCookies();
  const page = await ctx.newPage();
  const t0 = Date.now();
  let images1s = 0;

  page.on("request", (req) => {
    if (isImage(req.url()) && Date.now() - t0 <= 1000) images1s += 1;
  });

  await page.goto(`${base}/douyu`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);

  const gridCols = await page.evaluate(() => {
    const w = window.innerWidth;
    if (w >= 1920) return 6;
    if (w >= 1536) return 6;
    if (w >= 1024) return 5;
    if (w >= 768) return 4;
    if (w >= 640) return 3;
    return 2;
  });

  await ctx.close();

  return {
    viewport: `${IPAD.width}x${IPAD.height}`,
    gridCols,
    images1s,
    overBudget: images1s > gridCols,
    delta: images1s - gridCols,
  };
}

async function measurePlayApiVsFlv(browser) {
  const ctx = await browser.newContext({ viewport: IPAD, locale: "zh-CN" });
  await ctx.clearCookies();
  const page = await ctx.newPage();
  const t0 = Date.now();
  const events = [];

  page.on("response", async (res) => {
    const url = res.url();
    const kind = url.includes("/api/room")
      ? "api-room"
      : url.includes("flv.min.js")
        ? "flv-js"
        : null;
    if (!kind) return;
    const timing = res.request().timing();
    events.push({
      kind,
      t: Date.now() - t0,
      status: res.status(),
      dur: timing ? Math.round(timing.responseEnd) : null,
    });
  });

  const navStart = Date.now();
  await page.goto(`${base}/douyu/play/252140`, { waitUntil: "domcontentloaded", timeout: 90000 });

  let playingMs = null;
  try {
    await page.waitForFunction(
      () => {
        const v = document.querySelector("video");
        return v && !v.paused && v.readyState >= 2;
      },
      { timeout: 90000 },
    );
    playingMs = Date.now() - navStart;
  } catch {
    playingMs = null;
  }

  const apiHit = events.find((e) => e.kind === "api-room");
  const flvHit = events.find((e) => e.kind === "flv-js");

  const apiDur = await page.evaluate(() => {
    const hit = performance.getEntriesByType("resource").find((e) => e.name.includes("/api/room"));
    return hit ? Math.round(hit.duration) : null;
  });

  const flvToPlay = playingMs != null && flvHit ? playingMs - flvHit.t : null;
  const apiToPlay = playingMs != null && apiHit ? playingMs - apiHit.t : null;

  await ctx.close();

  return {
    apiRoomMs: apiHit?.t ?? null,
    apiRoomDur: apiDur,
    apiSlow: apiDur != null && apiDur > 500,
    flvJsMs: flvHit?.t ?? null,
    playingMs,
    flvToPlayingMs: flvToPlay,
    apiToPlayingMs: apiToPlay,
    apiSharePct: playingMs && apiHit ? Math.round((apiDur || 0) / playingMs * 100) : null,
    flvSharePct: playingMs && flvToPlay != null ? Math.round(flvToPlay / playingMs * 100) : null,
  };
}

async function measureSidePanelDelay(browser) {
  const ctx = await browser.newContext({ viewport: IPAD, locale: "zh-CN" });
  await ctx.clearCookies();
  const page = await ctx.newPage();
  const navStart = Date.now();

  await page.goto(`${base}/douyu/play/252140`, { waitUntil: "domcontentloaded", timeout: 90000 });

  let playingMs = null;
  try {
    await page.waitForFunction(
      () => {
        const v = document.querySelector("video");
        return v && !v.paused && v.readyState >= 2;
      },
      { timeout: 90000 },
    );
    playingMs = Date.now() - navStart;
  } catch {
    playingMs = null;
  }

  let sidePanelMs = null;
  try {
    await page.waitForSelector(".play-side", { timeout: 30000 });
    sidePanelMs = Date.now() - navStart;
  } catch {
    sidePanelMs = null;
  }

  const gap = playingMs != null && sidePanelMs != null ? sidePanelMs - playingMs : null;

  await ctx.close();

  return {
    playingMs,
    sidePanelMs,
    gapMs: gap,
    needsLowerIdleTimeout: gap != null && gap > 2500,
    idleTimeoutCurrent: 2500,
  };
}

console.log(`\n=== 四项专项测量 @ ${base} ===\n`);

try {
  const ping = await fetch(`${base}/config.json`, { cache: "no-store" });
  if (!ping.ok) throw new Error(`config.json ${ping.status}`);
} catch (err) {
  console.error(`无法访问 ${base}: ${err.message}`);
  process.exit(1);
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });

console.log("→ 检查1: jsTransfer / play chunk 预拉 ...");
const check1 = await measureHomePlayPreload(browser);
console.log(JSON.stringify(check1, null, 2));

console.log("\n→ 检查2: images1s vs 列数 ...");
const check2 = await measureImages1s(browser);
console.log(JSON.stringify(check2, null, 2));

console.log("\n→ 检查3: /api/room vs flv 拉流 ...");
const check3 = await measurePlayApiVsFlv(browser);
console.log(JSON.stringify(check3, null, 2));

console.log("\n→ 检查4: 侧栏 vs playing 延迟 ...");
const check4 = await measureSidePanelDelay(browser);
console.log(JSON.stringify(check4, null, 2));

await browser.close();

console.log("\n=== 结论 ===\n");
console.log(`1. 首页 JS ${check1.jsTransferKb}KB（主包 ${check1.mainKb}KB + play ${check1.playKb}KB）`);
console.log(
  `   play chunk ${check1.playChunkCount} 个，首次 ${check1.firstPlayChunkMs ?? "—"}ms${check1.earlyPreload ? " ⚠️ 过早预拉（<800ms）" : " ✓"}`,
);
console.log(`2. images1s=${check2.images1s}，列数=${check2.gridCols}${check2.overBudget ? ` ⚠️ 超出 ${check2.delta}` : " ✓"}`);
console.log(
  `3. /api/room ${check3.apiRoomDur ?? "—"}ms（导航 ${check3.apiRoomMs ?? "—"}ms），flv→playing ${check3.flvToPlayingMs ?? "—"}ms${check3.apiSlow ? " ⚠️ API>500ms" : " ✓"}`,
);
console.log(
  `4. 侧栏晚于 playing ${check4.gapMs ?? "—"}ms${check4.needsLowerIdleTimeout ? " ⚠️ 建议调低 idle timeout" : " ✓ 无需调整"}`,
);
console.log("");
