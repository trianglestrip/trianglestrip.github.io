export const PLATFORMS = [
  {
    id: "all",
    label: "全平台",
    tabLabel: "全平台",
    enabled: true,
    browse: true,
    crossBrowse: true,
    defaultRoom: "",
    description: "热门游戏跨平台聚合 · 斗鱼/虎牙/B站/抖音约 2:2:1:1",
    features: ["热门分类", "跨平台聚合", "本机 API"],
  },
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
    enabled: true,
    browse: true,
    defaultRoom: "545068",
    description: "本机 API 解析 · 多档 FLV · getDanmuInfo 弹幕",
    features: ["原画/蓝光/超清", "分区浏览", "本机 API"],
  },
  {
    id: "douyin",
    label: "抖音",
    tabLabel: "抖音游戏",
    enabled: true,
    browse: true,
    browseGameOnly: true,
    defaultRoom: "64040369495",
    description: "游戏直播分类 · 本机 API 解析 · 多档 FLV/HLS",
    features: ["游戏分类", "原画/蓝光/高清", "本机 API"],
  },
];

export function supportsBrowse(site) {
  const platform = getPlatform(site);
  return Boolean(platform?.enabled && platform?.browse !== false);
}

export function supportsCrossBrowse(site) {
  const platform = getPlatform(site);
  return Boolean(platform?.enabled && platform?.crossBrowse);
}

export const PREFS_KEY = "live.web.prefs";

export function getPlatform(site) {
  return PLATFORMS.find((item) => item.id === site) || null;
}
