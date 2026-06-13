import fs from "fs";
import path from "path";

const harPath = process.argv[2];
if (!harPath) {
  console.error("用法: node extract-douyu-har.mjs <关注.har或.txt>");
  process.exit(1);
}

const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
const fromPreload = new Set();
const fromAsrpic = new Set();

for (const e of har.log.entries) {
  const url = e.request?.url || "";
  for (const m of url.matchAll(/getH5Preload\/(\d+)/g)) fromPreload.add(m[1]);
  for (const m of url.matchAll(/asrpic\/\d+\/(\d+)(?:_src_|_\d+\.)/g)) fromAsrpic.add(m[1]);
}

const merged = [...new Set([...fromPreload, ...fromAsrpic])].sort((a, b) => Number(a) - Number(b));
const items = merged.map((id) => ({ site: "douyu", id }));

console.log(`getH5Preload: ${fromPreload.size}, asrpic: ${fromAsrpic.size}, 合计: ${merged.length}`);
console.log(merged.join("\n"));

const outPath = process.argv[3];
if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify(items, null, 2) + "\n", "utf8");
  console.log(`已写入 ${outPath}`);
}
