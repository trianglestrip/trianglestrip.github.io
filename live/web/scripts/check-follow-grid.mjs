import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8080";

async function gridInfo(page, selector) {
  return page.evaluate((sel) => {
    const grid = document.querySelector(sel);
    if (!grid) return { found: false };
    const style = getComputedStyle(grid);
    const items = [...grid.querySelectorAll(".follow-preview-item")].slice(0, 6);
    const rects = items.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
    });
    const rows = new Map();
    for (const r of rects) {
      const key = r.y;
      rows.set(key, (rows.get(key) || 0) + 1);
    }
    return {
      found: true,
      className: grid.className,
      gridTemplateColumns: style.gridTemplateColumns,
      width: Math.round(grid.getBoundingClientRect().width),
      itemCount: items.length,
      colsInFirstRow: rows.size ? Math.max(...rows.values()) : 0,
      rects,
    };
  }, selector);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.addInitScript(() => {
    const follows = Array.from({ length: 6 }, (_, i) => ({
      site: "douyu",
      id: String(100000 + i),
      anchor: `主播${i + 1}`,
      cover: "",
    }));
    localStorage.setItem("lemon_live.follows", JSON.stringify(follows));
    localStorage.setItem(
      "lemon_live.prefs.global.play_follow_ui",
      JSON.stringify({ previewCover: true }),
    );
  });

  await page.goto(`${base}/douyu/play/6979222`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".play-side", { timeout: 60000 });
  await page.waitForTimeout(4000);

  await page.locator(".tabs button", { hasText: "推荐" }).click();
  await page.waitForTimeout(2500);
  const recommend = await gridInfo(page, ".recommend-tab .follow-preview-grid");

  await page.locator(".tabs button", { hasText: "关注" }).click();
  await page.waitForTimeout(1500);
  const followBeforeToggle = await gridInfo(page, ".follow-tab .follow-preview-grid");

  const listModeBtn = page.locator(".follow-list-mode-btn");
  const isListMode = await listModeBtn.evaluate((el) => el.classList.contains("follow-list-mode-btn--active"));
  if (isListMode) {
    await listModeBtn.click();
    await page.waitForTimeout(500);
  }
  const follow = await gridInfo(page, ".follow-tab .follow-preview-grid");

  console.log(JSON.stringify({ recommend, followBeforeToggle, follow, previewCoverMode: !isListMode }, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
