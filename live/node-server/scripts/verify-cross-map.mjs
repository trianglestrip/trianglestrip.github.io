/**
 * 校验全平台跨分类映射：热门 key、别名、虎牙图标 cid、数据完整性
 * 用法: npm run verify:cross-map
 */
import { CROSS_CATEGORIES } from "../src/browse/cross-categories.data.ts";
import {
  HOT_CROSS_CATEGORY_KEYS,
  findCrossCategoryByKey,
  listHotCrossCategories,
} from "../src/browse/hot-cross-categories.ts";
import { CROSS_KEY_ALIASES } from "../src/browse/cross-key-aliases.ts";

const issues = [];

function hasHuyaIconSource(entry) {
  if (entry?.huya) return true;
  return false;
}

for (const key of HOT_CROSS_CATEGORY_KEYS) {
  const entry = findCrossCategoryByKey(key);
  if (!entry) {
    issues.push(`热门 key 无法解析: ${key}`);
    continue;
  }
  if (entry.key !== key) {
    issues.push(`热门 key 不一致: 请求 ${key}，实际 ${entry.key}`);
  }
  if (!hasHuyaIconSource(entry)) {
    issues.push(`热门 ${key}（${entry.name}）缺少虎牙 cid，全平台图标将回退默认图`);
  }
  const hasRoomSource =
    entry.douyu ||
    entry.huya ||
    entry.douyin ||
    entry.douyinPartitions?.length ||
    entry.sites?.bilibili?.cid;
  if (!hasRoomSource) {
    issues.push(`热门 ${key}（${entry.name}）无任何平台 cid，无法拉取直播间`);
  }
}

for (const [oldKey, newKey] of Object.entries(CROSS_KEY_ALIASES)) {
  const entry = findCrossCategoryByKey(oldKey);
  if (!entry) {
    issues.push(`别名失效: ${oldKey} → ${newKey}（找不到条目）`);
    continue;
  }
  if (entry.key !== newKey) {
    issues.push(`别名失效: ${oldKey} → ${newKey}（实际 ${entry.key}）`);
  }
}

const hotList = listHotCrossCategories();
if (hotList.length !== HOT_CROSS_CATEGORY_KEYS.length) {
  issues.push(
    `热门列表数量 ${hotList.length} ≠ 配置 ${HOT_CROSS_CATEGORY_KEYS.length}`,
  );
}

const seenKeys = new Set();
for (const entry of CROSS_CATEGORIES) {
  if (seenKeys.has(entry.key)) {
    issues.push(`重复 key: ${entry.key}`);
  }
  seenKeys.add(entry.key);
}

const manualHotNames = hotList.map((item) => item.name).join("、");
console.log(`热门分类 ${hotList.length} 项: ${manualHotNames}`);

if (issues.length) {
  console.error("\n校验失败:\n" + issues.map((line) => `  - ${line}`).join("\n"));
  process.exit(1);
}

console.log("校验通过: 热门 key、别名、虎牙图标、拉流 cid 均正常");
