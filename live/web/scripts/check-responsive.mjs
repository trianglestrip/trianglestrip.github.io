/**
 * PC / 手机视口页面与布局检查
 * 用法: node scripts/check-responsive.mjs [baseUrl]
 * 输出: audit-output/responsive-report.json + 截图
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const base = (process.argv[2] || "http://127.0.0.1:8090").replace(/\/$/, "");
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "audit-output", "responsive");
mkdirSync(outDir, { recursive: true });

const viewports = {
  pc: { width: 1400, height: 900, label: "PC 1400x900" },
  ipad: { width: 1180, height: 820, label: "iPad 1180x820" },
  mobile: { width: 390, height: 844, label: "Mobile 390x844" },
};

const pages = [
  {
    id: "all-home",
    path: "/all",
    waitMs: 3500,
    expect: { minRoomCards: 1, desktopNav: "sidebar", mobileNav: "strip" },
  },
  {
    id: "douyu-home",
    path: "/douyu",
    waitMs: 3000,
    expect: { minRoomCards: 1, desktopNav: "sidebar", mobileNav: "strip" },
  },
  {
    id: "douyin-home",
    path: "/douyin",
    waitMs: 3500,
    expect: { minRoomCards: 1, desktopNav: "sidebar", mobileNav: "strip" },
  },
  {
    id: "category-index",
    path: "/douyu/category",
    waitMs: 3000,
    expect: { minCategoryItems: 3, desktopNav: "sidebar", mobileNav: "strip" },
  },
  {
    id: "category-rooms",
    path: "/douyu/category/1?pid=1",
    waitMs: 3000,
    expect: { minRoomCards: 1, desktopNav: "sidebar", mobileNav: "strip" },
  },
  {
    id: "follow",
    path: "/follow",
    waitMs: 2000,
    expect: { hasFollowHeader: true, desktopNav: "sidebar", mobileNav: "strip" },
  },
  {
    id: "play",
    path: "/douyu/play/252140",
    waitMs: 8000,
    expect: { hasVideo: true, desktopNav: "sidebar", mobileNav: "strip" },
  },
];

function gridColsFromStyle(style) {
  const m = String(style || "").match(/repeat\((\d+)/);
  return m ? Number(m[1]) : null;
}

async function collectLayout(page) {
  return page.evaluate(() => {
    const grid = document.querySelector(".room-grid, .category-grid");
    const gridStyle = grid ? getComputedStyle(grid).gridTemplateColumns : "";
    const sidebar = document.querySelector(".nav-sidebar");
    const strip = document.querySelector(".nav-platform-strip");
    const sidebarRect = sidebar?.getBoundingClientRect();
    const stripRect = strip?.getBoundingClientRect();
    const playLayout = document.querySelector(".play-layout");
    const playSide = document.querySelector(".play-side");
    const video = document.querySelector("video");

    const isSidebarLeft = sidebarRect
      && sidebarRect.width > 40
      && sidebarRect.left < 20
      && sidebarRect.top < 80;
    const isBottomNav = sidebarRect
      && sidebarRect.height > 40
      && sidebarRect.top > window.innerHeight * 0.6;
    const stripVisible = stripRect && stripRect.height > 20 && stripRect.width > 50;

    return {
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      scrollW: document.documentElement.scrollWidth,
      scrollH: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      verticalOverflow: document.documentElement.scrollHeight > window.innerHeight + 2,
      appTextLen: document.querySelector("#app")?.innerText?.length || 0,
      roomCards: document.querySelectorAll(".room-item").length,
      categoryItems: document.querySelectorAll(".category-item").length,
      gridTemplateColumns: gridStyle,
      hasFollowHeader: !!document.querySelector(".follow-header h1"),
      hasPlayTitle: !!document.querySelector(".play-title"),
      hasVideo: !!video,
      videoPlaying: video ? !video.paused && video.readyState >= 2 : false,
      hasPlaySide: !!playSide && playSide.offsetParent !== null,
      playLayoutDisplay: playLayout ? getComputedStyle(playLayout).display : null,
      navMode: isBottomNav ? "bottom" : isSidebarLeft ? "sidebar" : stripVisible ? "strip" : "unknown",
      stripVisible,
      sidebarVisible: !!sidebar && sidebarRect && sidebarRect.width > 0,
      pageMsg: document.querySelector(".page-msg")?.innerText?.slice(0, 80) || "",
      playError: document.querySelector(".play-overlay, .status")?.innerText?.slice(0, 80) || "",
    };
  });
}

async function runCase(browser, vpKey, vp, pageDef) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  const issues = [];
  const consoleErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  let status = 0;
  let loadError = null;
  try {
    const resp = await page.goto(`${base}${pageDef.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    status = resp?.status() ?? 0;
    await page.waitForTimeout(pageDef.waitMs);
  } catch (err) {
    loadError = String(err);
  }

  const layout = await collectLayout(page);
  const shot = `${pageDef.id}-${vpKey}.png`;
  await page.screenshot({ path: join(outDir, shot), fullPage: false });

  const exp = pageDef.expect || {};
  if (status !== 200) issues.push(`HTTP ${status}`);
  if (loadError) issues.push(loadError);
  if (layout.horizontalOverflow) issues.push(`水平溢出 scrollW=${layout.scrollW} > innerW=${layout.innerW}`);
  if (layout.appTextLen < 10 && !layout.pageMsg) issues.push("页面内容过少");

  const isMobile = vp.width < 768;
  const wantNav = isMobile ? exp.mobileNav : exp.desktopNav;
  if (wantNav === "sidebar" && !isMobile && layout.navMode !== "sidebar") {
    issues.push(`PC 应为左侧导航，实际 ${layout.navMode}`);
  }
  if (wantNav === "strip" && isMobile && !layout.stripVisible && layout.navMode !== "bottom") {
    issues.push(`手机应显示平台条或底栏，实际 ${layout.navMode}`);
  }
  if (wantNav === "strip" && isMobile && layout.navMode === "unknown") {
    issues.push("手机导航未识别");
  }

  if (exp.minRoomCards && layout.roomCards < exp.minRoomCards) {
    issues.push(`直播间卡片不足 (${layout.roomCards})`);
  }
  if (exp.minCategoryItems && layout.categoryItems < exp.minCategoryItems) {
    issues.push(`分类项不足 (${layout.categoryItems})`);
  }
  if (exp.hasFollowHeader && !layout.hasFollowHeader) {
    issues.push("缺少关注页标题");
  }
  if (exp.hasVideo && !layout.hasVideo) {
    issues.push("无 video 元素");
  }
  if (exp.hasVideo && layout.hasVideo && !layout.videoPlaying && /失败|404/i.test(layout.playError)) {
    issues.push(`播放异常: ${layout.playError}`);
  }

  const gridCols = gridColsFromStyle(layout.gridTemplateColumns);
  if (pageDef.id.includes("home") && vpKey === "ipad" && gridCols != null && gridCols < 4) {
    issues.push(`iPad 首页网格列数偏少: ${gridCols}（期望 ≥4）`);
  }
  if (pageDef.id === "douyu-home" && vpKey === "ipad" && gridCols != null && gridCols < 5) {
    issues.push(`iPad 斗鱼首页列数: ${gridCols}（期望 5）`);
  }

  await context.close();

  return {
    id: `${pageDef.id}-${vpKey}`,
    page: pageDef.id,
    viewport: vp.label,
    path: pageDef.path,
    status,
    screenshot: shot,
    gridCols,
    layout,
    consoleErrors: consoleErrors.filter((t) => !/Early-EOF|IOController|404 \(Not Found\)/.test(t)).slice(0, 5),
    issues,
    ok: issues.length === 0,
  };
}

console.log(`\n=== 响应式布局检查 @ ${base} ===\n`);

try {
  const ping = await fetch(`${base}/config.json`);
  if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
} catch (err) {
  console.error(`无法访问 ${base}: ${err.message}`);
  process.exit(1);
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = [];

for (const pageDef of pages) {
  for (const [vpKey, vp] of Object.entries(viewports)) {
    process.stdout.write(`→ ${pageDef.id} @ ${vp.label} ... `);
    const row = await runCase(browser, vpKey, vp, pageDef);
    results.push(row);
    if (row.ok) {
      const extra = row.gridCols ? ` ${row.gridCols}列` : "";
      console.log(`OK${extra}`);
    } else {
      console.log(`FAIL: ${row.issues.join("; ")}`);
    }
  }
}

await browser.close();

const report = {
  at: new Date().toISOString(),
  baseUrl: base,
  viewports,
  results,
  summary: {
    total: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  },
};

writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));

console.log("\n--- 汇总 ---");
console.log(`通过 ${report.summary.passed}/${report.summary.total}`);
console.log(`截图: ${outDir}`);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.log("\n--- 失败项 ---");
  for (const r of failed) {
    console.log(`- [${r.viewport}] ${r.page}: ${r.issues.join("; ")}`);
  }
  process.exit(1);
}

console.log("\n全部通过。");
