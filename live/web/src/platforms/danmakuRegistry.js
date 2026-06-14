import { connectBilibili } from "./connectors/bilibili.js";
import { connectDouyin } from "./connectors/douyin.js";
import { connectDouyu } from "./connectors/douyu.js";
import { connectHuya } from "./connectors/huya.js";

const CONNECTORS = {
  douyu: connectDouyu,
  huya: connectHuya,
  douyin: connectDouyin,
  bilibili: connectBilibili,
};

export function getDanmakuConnector(site) {
  return CONNECTORS[site] || null;
}
