export const PLATFORMS = [
  {
    id: "douyu",
    label: "斗鱼",
    tabLabel: "斗鱼直播",
    enabled: true,
    defaultRoom: "5720533",
    description: "streamget 解析 · 多档 FLV 直链 · 懒加载切档",
    features: ["多清晰度", "CDN 线路", "本机 API"],
  },
  {
    id: "huya",
    label: "虎牙",
    tabLabel: "虎牙直播",
    enabled: true,
    defaultRoom: "660116",
    description: "streamget 解析 · 多档多线路 · anti-code 本地拼装",
    features: ["蓝光/超清/流畅", "线路3/5/14", "本机 API"],
  },
  {
    id: "bilibili",
    label: "哔哩",
    tabLabel: "哔哩直播",
    enabled: false,
    defaultRoom: "",
    description: "占位，解析尚未接入。",
    features: ["待接入"],
  },
  {
    id: "douyin",
    label: "抖音",
    tabLabel: "抖音直播",
    enabled: false,
    defaultRoom: "",
    description: "占位，解析尚未接入。",
    features: ["待接入"],
  },
];

export const PREFS_KEY = "live.web.prefs";

export function getPlatform(site) {
  return PLATFORMS.find((item) => item.id === site) || null;
}
