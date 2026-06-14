/**
 * 为抖音缺失图标的游戏分区，从 iTunes / Steam 搜索官方图标并生成静态映射。
 * 运行：npm run sync:douyin-icons
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchDouyinGameCategories } from "../dist/browse/douyin.js";
import { DOUYIN_GAME_ICONS as EXISTING } from "../dist/browse/douyin-game-icons.data.js";
import { resolveGameIconFromWeb } from "../dist/browse/douyin-game-icon-resolver.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src/browse/douyin-game-icons.data.ts");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isWebIconUrl(pic) {
  return /mzstatic\.com|steamstatic\.com/i.test(pic);
}

const groups = await fetchDouyinGameCategories();
const items = groups.flatMap((g) => g.list);
const seen = new Set(EXISTING.map((entry) => entry.douyin));
const resolved = [...EXISTING];

const pending = items.filter((item) => !item.pic && !seen.has(String(item.cid)));
console.log(`existing web icons ${EXISTING.length}, still missing ${pending.length}`);

for (const item of pending) {
  const hit = await resolveGameIconFromWeb(item.name);
  if (hit?.pic && isWebIconUrl(hit.pic)) {
    const id = String(item.cid);
    resolved.push({ douyin: id, name: item.name, pic: hit.pic });
    seen.add(id);
    console.log(`+ ${item.name} (${hit.source})`);
  } else {
    console.log(`- ${item.name}`);
  }
  await sleep(200);
}

const body = `/** 自动生成：npm run sync:douyin-icons */
export interface DouyinGameIconEntry {
  douyin: string;
  name: string;
  pic: string;
}

export const DOUYIN_GAME_ICONS: DouyinGameIconEntry[] = ${JSON.stringify(
  resolved.map(({ douyin, name, pic }) => ({ douyin, name, pic })),
  null,
  2,
)};
`;

writeFileSync(OUT, body, "utf8");
console.log(`\nWrote ${resolved.length} web icons -> ${OUT}`);
