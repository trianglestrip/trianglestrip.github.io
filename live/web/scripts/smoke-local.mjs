import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8080";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  console.log("open", `${base}/douyu`);
  await page.goto(`${base}/douyu`, { waitUntil: "networkidle", timeout: 30000 });

  const roomCount = await page.locator(".room-item").count();
  const pageMsg = await page.locator(".page-msg").first().textContent().catch(() => "");
  console.log("room-items:", roomCount, "page-msg:", pageMsg?.trim() || "(none)");

  await page.goto(`${base}/douyu/play/6979222`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(8000);

  const sideVisible = await page.locator(".play-side").isVisible();
  const video = await page.locator("video").count();
  const status = await page.locator(".play-title").textContent().catch(() => "");
  console.log("play page: side=", sideVisible, "video=", video, "title=", status?.trim());

  await page.locator(".tabs button", { hasText: "推荐" }).click();
  await page.waitForTimeout(2000);
  const recommendItems = await page.locator(".recommend-tab .follow-preview-item").count();
  const recommendHint = await page.locator(".recommend-hint").first().textContent().catch(() => "");
  console.log("recommend tab: items=", recommendItems, "hint=", recommendHint?.trim() || "(none)");

  const followBtn = page.locator(".follow-btn");
  const followText = await followBtn.textContent().catch(() => "");
  await followBtn.click();
  await page.waitForTimeout(300);
  const followTextAfter = await followBtn.textContent().catch(() => "");
  console.log("follow btn:", followText?.trim(), "->", followTextAfter?.trim());

  if (errors.length) {
    console.log("ERRORS:");
    errors.forEach((e) => console.log(e));
  } else {
    console.log("no js errors");
  }

  await browser.close();
  if (errors.length || roomCount === 0 && !pageMsg.includes("加载")) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
