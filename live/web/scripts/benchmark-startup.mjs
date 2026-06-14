/**
 * 启动与页面加载耗时基准
 * 用法: node scripts/benchmark-startup.mjs [baseUrl] [--out docs/startup-benchmark.md]
 *
 * 需先启动 API (8765) + 静态服务 (8080)，并已 build dist/web。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = (process.argv[2] || "http://127.0.0.1:8080").replace(/\/$/, "");
const outArgIdx = process.argv.indexOf("--out");
const outPath = outArgIdx >= 0
  ? path.resolve(process.argv[outArgIdx + 1])
  : path.resolve(__dirname, "../docs/startup-benchmark.md");

const IPAD_VIEWPORT = { width: 1180, height: 820 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

function avg(nums) {
  const vals = nums.filter((n) => Number.isFinite(n));
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function fmtMs(v) {
  return v == null ? "—" : `${v}ms`;
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function classifyRequest(url) {
  if (url.includes("/api/room")) return "api-room";
  if (url.includes("/api/follows/status")) return "api-follow-status";
  if (url.includes("/api/rooms") || url.includes("/api/recommend") || url.includes("/api/cross-rooms")) return "api-browse";
  if (url.includes("/api/categories") || url.includes("/api/cross")) return "api-category";
  if (url.includes("config.json")) return "config";
  if (url.includes("flv.min.js")) return "flv-js";
  if (/\.(js|css)(\?|$)/.test(url)) return "static-js-css";
  if (/\.(woff2?|ttf)(\?|$)/.test(url)) return "font";
  if (/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(url)) return "image";
  if (/\/(live-cover|asrpic|webcast-cover|huyalive|cdnimage|upload\/avatar)/i.test(url)) return "image";
  return "other";
}

async function measureScenario(browser, scenario) {
  const context = await browser.newContext({
    viewport: scenario.viewport || IPAD_VIEWPORT,
    locale: "zh-CN",
  });
  await context.clearCookies();
  const page = await context.newPage();

  const events = [];
  const t0 = Date.now();

  page.on("request", (req) => {
    events.push({ t: Date.now() - t0, type: "req", kind: classifyRequest(req.url()), url: req.url() });
  });
  page.on("response", (res) => {
    events.push({
      t: Date.now() - t0,
      type: "res",
      kind: classifyRequest(res.url()),
      url: res.url(),
      status: res.status(),
    });
  });

  const navStart = Date.now();
  await page.goto(`${base}${scenario.path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const domReadyMs = Date.now() - navStart;

  let textVisibleMs = null;
  if (scenario.textSelector) {
    try {
      await page.waitForSelector(scenario.textSelector, { timeout: 30000 });
      textVisibleMs = Date.now() - navStart;
    } catch {
      textVisibleMs = null;
    }
  }

  let contentReadyMs = null;
  if (scenario.contentSelector) {
    try {
      await page.waitForSelector(scenario.contentSelector, { timeout: 45000 });
      contentReadyMs = Date.now() - navStart;
    } catch {
      contentReadyMs = null;
    }
  }

  let playingMs = null;
  if (scenario.waitPlaying) {
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
  }

  let sidePanelMs = null;
  if (scenario.waitSidePanel) {
    try {
      await page.waitForSelector(".play-side", { timeout: 30000 });
      sidePanelMs = Date.now() - navStart;
    } catch {
      sidePanelMs = null;
    }
  }

  // 额外等待 idle 后资源
  if (scenario.postWaitMs) {
    await page.waitForTimeout(scenario.postWaitMs);
  }

  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = performance.getEntriesByType("paint");
    const fcp = paints.find((p) => p.name === "first-contentful-paint");
    const resources = performance.getEntriesByType("resource").map((e) => ({
      name: e.name,
      dur: Math.round(e.duration),
      ttfb: Math.round(e.responseStart - e.startTime),
      size: e.transferSize || 0,
      start: Math.round(e.startTime),
    }));
    return {
      htmlMs: nav ? Math.round(nav.responseEnd - nav.startTime) : null,
      domInteractiveMs: nav ? Math.round(nav.domInteractive - nav.startTime) : null,
      dclMs: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
      loadMs: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
      fcpMs: fcp ? Math.round(fcp.startTime) : null,
      resources,
    };
  });

  const firstOfKind = (kind) => {
    const hit = events.find((e) => e.type === "res" && e.kind === kind);
    return hit?.t ?? null;
  };

  const imagesInWindow = (ms) =>
    events.filter((e) => e.type === "req" && e.kind === "image" && e.t <= ms).length;

  const jsTransfer = timing.resources
    .filter((r) => /\.(js)(\?|$)/.test(r.name))
    .reduce((sum, r) => sum + (r.size || 0), 0);

  const cssTransfer = timing.resources
    .filter((r) => /\.(css)(\?|$)/.test(r.name))
    .reduce((sum, r) => sum + (r.size || 0), 0);

  const topResources = [...timing.resources]
    .sort((a, b) => b.dur - a.dur)
    .slice(0, 10)
    .map((r) => ({
      name: shortUrl(r.name),
      dur: r.dur,
      ttfb: r.ttfb,
      sizeKb: r.size ? Math.round(r.size / 1024) : 0,
      startMs: r.start,
    }));

  const issues = [];
  if (scenario.waitPlaying) {
    const followBeforePlay = events.find(
      (e) => e.type === "req" && e.kind === "api-follow-status" && (playingMs == null || e.t < playingMs),
    );
    if (followBeforePlay) {
      issues.push(`播放前出现 fetchFollowStatus (${followBeforePlay.t}ms)`);
    }
    const flvT = firstOfKind("flv-js");
    if (flvT != null && playingMs != null && flvT > playingMs * 0.8) {
      issues.push(`flv.js 加载偏晚 (${flvT}ms)`);
    }
  }
  if (imagesInWindow(1000) > (scenario.maxImages1s ?? 8)) {
    issues.push(`首 1s 图片请求过多 (${imagesInWindow(1000)} 个)`);
  }
  if (domReadyMs > 3000) issues.push(`DOM ready 偏慢 (${domReadyMs}ms)`);

  await context.close();

  return {
    id: scenario.id,
    path: scenario.path,
    viewport: scenario.viewport?.width ? `${scenario.viewport.width}x${scenario.viewport.height}` : "1180x820",
    domReadyMs,
    textVisibleMs,
    contentReadyMs,
    playingMs,
    sidePanelMs,
    fcpMs: timing.fcpMs,
    htmlMs: timing.htmlMs,
    domInteractiveMs: timing.domInteractiveMs,
    dclMs: timing.dclMs,
    loadMs: timing.loadMs,
    configMs: firstOfKind("config"),
    apiBrowseMs: firstOfKind("api-browse") ?? firstOfKind("api-category"),
    apiRoomMs: firstOfKind("api-room"),
    flvJsMs: firstOfKind("flv-js"),
    followStatusMs: firstOfKind("api-follow-status"),
    images1s: imagesInWindow(1000),
    images3s: imagesInWindow(3000),
    jsTransferKb: Math.round(jsTransfer / 1024),
    cssTransferKb: Math.round(cssTransfer / 1024),
    topResources,
    issues,
  };
}

const scenarios = [
  {
    id: "all-home-ipad",
    path: "/all",
    viewport: IPAD_VIEWPORT,
    textSelector: ".room-title, .page-msg",
    contentSelector: ".room-item",
    postWaitMs: 1500,
    maxImages1s: 6,
  },
  {
    id: "douyu-home-ipad",
    path: "/douyu",
    viewport: IPAD_VIEWPORT,
    textSelector: ".room-title, .page-msg",
    contentSelector: ".room-item",
    postWaitMs: 1500,
    maxImages1s: 6,
  },
  {
    id: "douyu-home-mobile",
    path: "/douyu",
    viewport: MOBILE_VIEWPORT,
    textSelector: ".room-title, .page-msg",
    contentSelector: ".room-item",
    postWaitMs: 1500,
    maxImages1s: 3,
  },
  {
    id: "follow-ipad",
    path: "/follow",
    viewport: IPAD_VIEWPORT,
    textSelector: ".follow-header h1, .page-msg, .follow-item",
    contentSelector: ".page-msg, .follow-item, .room-item",
    postWaitMs: 2000,
    maxImages1s: 4,
  },
  {
    id: "play-douyu-ipad",
    path: "/douyu/play/252140",
    viewport: IPAD_VIEWPORT,
    textSelector: ".play-title, .play-header",
    waitPlaying: true,
    waitSidePanel: true,
    postWaitMs: 3500,
    maxImages1s: 3,
  },
];

function buildMarkdown(report) {
  const lines = [];
  lines.push("# Lemon Live 启动与加载耗时基准");
  lines.push("");
  lines.push(`> 生成时间: ${report.generatedAt}`);
  lines.push(`> 测试地址: ${report.baseUrl}`);
  lines.push(`> 环境: ${report.environment}`);
  lines.push(`> 构建: production dist（${report.baseUrl.includes(":8090") ? "8090 生产静态" : "请优先使用 8090 端口测 production"}）`);
  lines.push("");
  lines.push("## 测试方法");
  lines.push("");
  lines.push("1. `npm run build` 构建 production");
  lines.push("2. 启动 API：`live/node-server` → `npm run dev`（8765）");
  lines.push("3. 启动静态：`node live/dist/web/server.mjs 8090`");
  lines.push("4. 运行：`npm run benchmark:startup -- http://127.0.0.1:8090 --out docs/startup-benchmark.md`");
  lines.push("");
  lines.push("Playwright headless Chrome，每次场景使用全新 context（无缓存 cookie）。指标自 `navigationStart` 起算。");
  lines.push("");
  lines.push("## 摘要");
  lines.push("");
  lines.push("| 场景 | 视口 | FCP | DOM | 内容就绪 | 播放/侧栏 | 首 1s 图片 | 问题 |");
  lines.push("|------|------|-----|-----|----------|-----------|------------|------|");
  for (const row of report.results) {
    const playCol = row.playingMs != null
      ? `播放 ${fmtMs(row.playingMs)} / 侧栏 ${fmtMs(row.sidePanelMs)}`
      : fmtMs(row.contentReadyMs);
    lines.push(
      `| ${row.id} | ${row.viewport} | ${fmtMs(row.fcpMs)} | ${fmtMs(row.domReadyMs)} | ${fmtMs(row.contentReadyMs ?? row.textVisibleMs)} | ${playCol} | ${row.images1s} | ${row.issues.length ? row.issues.join("; ") : "—"} |`,
    );
  }
  lines.push("");
  lines.push("## 分场景明细");
  lines.push("");

  for (const row of report.results) {
    lines.push(`### ${row.id}`);
    lines.push("");
    lines.push(`- 路径: \`${row.path}\``);
    lines.push(`- 视口: ${row.viewport}`);
    lines.push("");
    lines.push("| 指标 | 耗时 |");
    lines.push("|------|------|");
    lines.push(`| HTML 响应 | ${fmtMs(row.htmlMs)} |`);
    lines.push(`| DOM Interactive | ${fmtMs(row.domInteractiveMs)} |`);
    lines.push(`| DOM ContentLoaded | ${fmtMs(row.dclMs)} |`);
    lines.push(`| 浏览器 FCP | ${fmtMs(row.fcpMs)} |`);
    lines.push(`| DOM ready (Playwright) | ${fmtMs(row.domReadyMs)} |`);
    lines.push(`| 文字可见 | ${fmtMs(row.textVisibleMs)} |`);
    lines.push(`| 列表/内容就绪 | ${fmtMs(row.contentReadyMs)} |`);
    if (row.configMs != null) lines.push(`| config.json | ${fmtMs(row.configMs)} |`);
    if (row.apiBrowseMs != null) lines.push(`| 列表 API 首次响应 | ${fmtMs(row.apiBrowseMs)} |`);
    if (row.apiRoomMs != null) lines.push(`| /api/room | ${fmtMs(row.apiRoomMs)} |`);
    if (row.flvJsMs != null) lines.push(`| flv.min.js | ${fmtMs(row.flvJsMs)} |`);
    if (row.playingMs != null) lines.push(`| 视频 playing | ${fmtMs(row.playingMs)} |`);
    if (row.sidePanelMs != null) lines.push(`| 侧栏出现 | ${fmtMs(row.sidePanelMs)} |`);
    if (row.followStatusMs != null) lines.push(`| fetchFollowStatus | ${fmtMs(row.followStatusMs)} |`);
    lines.push(`| load 事件 | ${fmtMs(row.loadMs)} |`);
    lines.push(`| 首 1s / 3s 图片请求 | ${row.images1s} / ${row.images3s} |`);
    lines.push(`| JS 传输量 | ${row.jsTransferKb} KB |`);
    lines.push(`| CSS 传输量 | ${row.cssTransferKb} KB |`);
    lines.push("");

    if (row.issues.length) {
      lines.push("**发现的问题:**");
      for (const issue of row.issues) lines.push(`- ${issue}`);
      lines.push("");
    }

    lines.push("**较慢资源 Top 10:**");
    lines.push("");
    lines.push("| 资源 | 开始 | 耗时 | TTFB | 大小 |");
    lines.push("|------|------|------|------|------|");
    for (const r of row.topResources) {
      lines.push(`| ${r.name} | ${r.startMs}ms | ${r.dur}ms | ${r.ttfb}ms | ${r.sizeKb}KB |`);
    }
    lines.push("");
  }

  lines.push("## 播放页阶段分解（目标对照）");
  lines.push("");
  lines.push("```");
  lines.push("Phase1 阻塞: HTML → JS → config → /api/room → flv.js → playing");
  lines.push("Phase2 首帧后: 弹幕 overlay + idle → 侧栏 + connectDm");
  lines.push("Phase3 延后: fetchFollowStatus（应在 playing 之后）");
  lines.push("```");
  lines.push("");

  const play = report.results.find((r) => r.id === "play-douyu-ipad");
  if (play) {
    lines.push("| 阶段 | 实际耗时 | 说明 |");
    lines.push("|------|----------|------|");
    lines.push(`| 导航 → DOM | ${fmtMs(play.domReadyMs)} | 含主包 + 路由 chunk |`);
    lines.push(`| 导航 → /api/room | ${fmtMs(play.apiRoomMs)} | 房间解析 |`);
    lines.push(`| 导航 → flv.js | ${fmtMs(play.flvJsMs)} | 按需加载 |`);
    lines.push(`| 导航 → playing | ${fmtMs(play.playingMs)} | 首帧播放 |`);
    lines.push(`| 导航 → 侧栏 | ${fmtMs(play.sidePanelMs)} | idle 后挂载 |`);
    lines.push(`| 导航 → follow status | ${fmtMs(play.followStatusMs)} | 应 > playing |`);
    lines.push("");
    if (play.followStatusMs != null && play.playingMs != null && play.followStatusMs < play.playingMs) {
      lines.push("> ⚠️ follow status 早于 playing，与优化目标不符。");
    } else if (play.followStatusMs != null && play.playingMs != null) {
      lines.push(`> ✓ follow status 在 playing 后 ${play.followStatusMs - play.playingMs}ms`);
    }
    lines.push("");
  }

  lines.push("## 当前主要问题（自动诊断）");
  lines.push("");

  const allHome = report.results.find((r) => r.id === "all-home-ipad");
  if (allHome?.contentReadyMs != null && allHome.contentReadyMs > 1500) {
    lines.push(`- **全站首页列表慢**（${allHome.contentReadyMs}ms）：cross-rooms API 或 prefetchUntil 第二页阻塞首屏卡片渲染。`);
  }

  const douyu = report.results.find((r) => r.id === "douyu-home-ipad");
  if (douyu?.images3s > 5) {
    lines.push(`- **斗鱼首页封面并发**（3s 内 ${douyu.images3s} 张）：首行 eager 之外仍有大量封面在 ~500ms 后开始加载，单张 CDN 耗时可达 1s+。`);
  }

  if (douyu?.jsTransferKb > 1400) {
    lines.push(`- **首屏 JS 体积偏大**（${douyu.jsTransferKb}KB）：含 vue(82KB) + 路由 chunk + preloadPlayView 预拉 play 相关资源。`);
  }

  if (play) {
    const apiRoomDur = play.topResources?.find((r) => r.name.includes("/api/room"))?.dur;
    if (apiRoomDur > 400) {
      lines.push(`- **/api/room 解析偏慢**（${apiRoomDur}ms）：占播放前等待的主要部分。`);
    }
    if (play.flvJsMs != null && play.apiRoomMs != null && play.flvJsMs - play.apiRoomMs > 500) {
      lines.push(`- **flv.js 按需加载**（${play.flvJsMs}ms）：在 room API 之后额外 ${play.flvJsMs - play.apiRoomMs}ms，可考虑与 play chunk 并行 preload。`);
    }
    const playGap = play.playingMs - (play.flvJsMs || 0);
    if (playGap > 1000) {
      lines.push(`- **FLV 拉流缓冲**（flv.js → playing 约 ${playGap}ms）：网络/流首包是播放主瓶颈。`);
    }
    const sideGap = play.sidePanelMs - play.playingMs;
    if (sideGap > 0 && sideGap < 500) {
      lines.push(`- 侧栏在 playing 后 ${sideGap}ms 出现，符合 idle 延后策略。`);
    }
    const followGap = play.followStatusMs - play.playingMs;
    if (followGap >= 0) {
      lines.push(`- fetchFollowStatus 在 playing 后 ${followGap}ms（+2s 定时），符合优化目标。`);
    } else {
      lines.push(`- ⚠️ fetchFollowStatus 早于 playing ${-followGap}ms，需排查。`);
    }
    const dupFollow = play.topResources?.filter((r) => r.name.includes("/api/follows/status")).length;
    if (dupFollow > 1) {
      lines.push(`- **重复 follow status 请求**（${dupFollow} 次）：header 与侧栏可能仍各拉一次，可合并。`);
    }
  }

  const isDev = report.results.some((r) =>
    r.topResources?.some((res) => res.name.includes("/src/") || res.name.includes("@vite")),
  );
  if (isDev) {
    lines.push("- ⚠️ 检测到 Vite 开发资源路径（/src/），本次数据来自 dev server，生产 build 体积与耗时会不同。");
  }

  lines.push("");
  lines.push("## 后续优化建议（基于本次测量）");
  lines.push("");
  lines.push("1. 对比 `jsTransferKb` 与路由分包效果，关注 play chunk 是否被首页预拉过早触发。");
  lines.push("2. 若 `images1s` 仍高于列数，继续收紧 LazyImage rootMargin 或 eager 范围。");
  lines.push("3. 播放页关注 `/api/room` 与 flv 拉流占比；若 API > 500ms 优先后端缓存。");
  lines.push("4. 侧栏出现晚于 playing 超过 2.5s 时，可调低 requestIdleCallback timeout。");
  lines.push("5. 定期运行 production 基准: `npm run benchmark:startup -- http://127.0.0.1:8090 --out docs/startup-benchmark.md`");
  lines.push("");

  return lines.join("\n");
}

console.log(`\n=== 启动加载基准 @ ${base} ===\n`);

// 健康检查
try {
  const ping = await fetch(`${base}/config.json`, { cache: "no-store" });
  if (!ping.ok) throw new Error(`config.json ${ping.status}`);
} catch (err) {
  console.error(`无法访问 ${base}，请先 build 并启动静态服务 + API。\n${err.message}`);
  process.exit(1);
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = [];

for (const scenario of scenarios) {
  process.stdout.write(`→ ${scenario.id} ... `);
  try {
    const row = await measureScenario(browser, scenario);
    results.push(row);
    console.log(
      `DOM ${row.domReadyMs}ms | 内容 ${row.contentReadyMs ?? "—"}ms | 图@${1}s ${row.images1s}${row.playingMs ? ` | 播放 ${row.playingMs}ms` : ""}`,
    );
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
    results.push({
      id: scenario.id,
      path: scenario.path,
      viewport: `${scenario.viewport?.width || 1180}x${scenario.viewport?.height || 820}`,
      issues: [`测量失败: ${err.message}`],
    });
  }
}

await browser.close();

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: base,
  environment: `Node ${process.version}, Playwright, headless Chrome`,
  results,
};

const md = buildMarkdown(report);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, md, "utf8");

console.log(`\n报告已写入: ${outPath}\n`);
