import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto("https://lemonlive.deno.dev/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("#app", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  function summarize(el, depth = 0) {
    if (depth > 5 || !el) return "";
    const tag = el.tagName?.toLowerCase() || "";
    const cls =
      el.className && typeof el.className === "string"
        ? el.className.split(/\s+/).filter(Boolean).slice(0, 6).join(".")
        : "";
    const text =
      el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
        ? el.textContent.trim().slice(0, 40)
        : "";
    let out = `${"  ".repeat(depth)}${tag}${cls ? `.${cls}` : ""}${text ? ` [${text}]` : ""}\n`;
    for (const child of el.children) out += summarize(child, depth + 1);
    return out;
  }
  const app = document.querySelector("#app");
  const tabs = [...document.querySelectorAll("a,button")].slice(0, 12).map((el) => ({
    tag: el.tagName,
    text: el.textContent?.trim().slice(0, 20),
    class: el.className,
  }));
  return {
    title: document.title,
    tree: app ? summarize(app) : "no #app",
    tabs,
    bodyBg: getComputedStyle(document.body).backgroundColor,
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
