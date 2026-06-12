/**
 * Chrome 视觉对照 + 控制台/网络采集
 * 用法: node scripts/visual-audit.mjs [localBase]
 * 输出: live/web/audit-output/report.json + 截图
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const localBase = process.argv[2] || "http://127.0.0.1:8765";
const refBase = "https://lemonlive.deno.dev";
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "audit-output");
mkdirSync(outDir, { recursive: true });

const viewport = { width: 1400, height: 900 };

const scenarios = [
  { id: "home-douyu", local: "/douyu", ref: "/douyu", waitMs: 4000 },
  { id: "category", local: "/douyu/category", ref: "/douyu/category", waitMs: 4000 },
  { id: "category-rooms", local: "/douyu/category/1?pid=1", ref: "/douyu/category/1", waitMs: 4000 },
  { id: "play", local: "/douyu/play/5720533", ref: "/douyu/play/5720533", waitMs: 8000 },
];

function slug(url) {
  return url.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60);
}

async function auditSite(browser, label, base, scenario) {
  const page = await browser.newPage({ viewport });
  const url = `${base}${scenario.path || scenario.local || scenario.ref}`;
  const path = label === "local" ? scenario.local : scenario.ref;
  const fullUrl = `${base}${path}`;

  const consoleLogs = [];
  const failedRequests = [];

  page.on("console", (msg) => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
    });
  });
  page.on("pageerror", (err) => {
    consoleLogs.push({ type: "pageerror", text: err.message });
  });
  page.on("requestfailed", (req) => {
    failedRequests.push({
      url: req.url(),
      failure: req.failure()?.errorText || "unknown",
    });
  });

  let status = 0;
  let error = null;
  try {
    const resp = await page.goto(fullUrl, {
      waitUntil: path.includes("/play/") ? "domcontentloaded" : "networkidle",
      timeout: 60000,
    });
    status = resp?.status() ?? 0;
    if (label === "ref") {
      await page.waitForSelector("#app", { timeout: 15000 }).catch(() => {});
    }
    await page.waitForTimeout(scenario.waitMs);
  } catch (e) {
    error = String(e);
  }

  const shotName = `${scenario.id}-${label}.png`;
  await page.screenshot({ path: join(outDir, shotName), fullPage: false });

  const metrics = await page.evaluate(() => {
    const app = document.querySelector("#app");
    const nav = document.querySelector(".nav-sidebar, nav");
    const tabs = document.querySelector(".tab-headers, .platform-tabs");
    const videos = [...document.querySelectorAll("video")];
    return {
      title: document.title,
      appTextLen: app?.innerText?.length || 0,
      appTextPreview: (app?.innerText || "").slice(0, 200).replace(/\s+/g, " "),
      hasNav: !!nav,
      hasTabs: !!tabs,
      roomCards: document.querySelectorAll(".room-item, .room-grid .room-item").length,
      categoryItems: document.querySelectorAll(".category-item, .category-grid a").length,
      videoCount: videos.length,
      videoNativeControls: videos.filter((v) => v.controls).length,
      overlayControls: document.querySelectorAll(".player-controls--overlay").length,
      sideCoverEmpty: !!document.querySelector(".room-cover--empty"),
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });

  await page.close();

  return {
    label,
    url: fullUrl,
    status,
    error,
    screenshot: shotName,
    metrics,
    consoleErrors: consoleLogs.filter((l) => l.type === "error" || l.type === "pageerror"),
    consoleWarnings: consoleLogs.filter((l) => l.type === "warning").slice(0, 5),
    failedRequests: failedRequests.filter((r) => !r.url.includes("flv") && !r.url.includes("m3u8")).slice(0, 15),
  };
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const report = { at: new Date().toISOString(), localBase, refBase, viewport, scenarios: [] };

for (const scenario of scenarios) {
  console.log(`\n=== ${scenario.id} ===`);
  const local = await auditSite(browser, "local", localBase, scenario);
  let ref = null;
  try {
    ref = await auditSite(browser, "ref", refBase, scenario);
  } catch (e) {
    ref = { label: "ref", error: String(e) };
  }

  const entry = { id: scenario.id, local, ref };
  report.scenarios.push(entry);

  const lm = local.metrics || {};
  console.log(
    `local: cards=${lm.roomCards} cats=${lm.categoryItems} videoCtrl=${lm.videoNativeControls}/${lm.videoCount} overlay=${lm.overlayControls} coverEmpty=${lm.sideCoverEmpty} errors=${local.consoleErrors.length} failed=${local.failedRequests.length}`,
  );
  if (ref?.metrics) {
    console.log(` ref: cards=${ref.metrics.roomCards} cats=${ref.metrics.categoryItems} errors=${ref.consoleErrors.length}`);
  }
  if (local.consoleErrors.length) {
    for (const e of local.consoleErrors.slice(0, 3)) console.log(`  console: ${e.text.slice(0, 120)}`);
  }
  if (local.failedRequests.length) {
    for (const r of local.failedRequests.slice(0, 3)) console.log(`  network: ${r.url.slice(0, 100)}`);
  }
}

await browser.close();

writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(`\nReport: ${join(outDir, "report.json")}`);
console.log(`Screenshots: ${outDir}`);
