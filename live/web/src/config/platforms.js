export const PLATFORMS = [
  {
    id: "douyu",
    label: "斗鱼",
    enabled: true,
    defaultRoom: "5720533",
    description: "支持 FLV 多档多线路，懒加载解析。",
  },
  {
    id: "huya",
    label: "虎牙",
    enabled: true,
    defaultRoom: "579236",
    description: "支持 FLV 多档多线路，懒加载解析。",
  },
  {
    id: "bilibili",
    label: "哔哩",
    enabled: false,
    defaultRoom: "",
    description: "占位，解析尚未接入。",
  },
  {
    id: "douyin",
    label: "抖音",
    enabled: false,
    defaultRoom: "",
    description: "占位，解析尚未接入。",
  },
];

export const PREFS_KEY = "live.web.prefs";

export function getPlatform(site) {
  return PLATFORMS.find((item) => item.id === site) || null;
}

export function apiBase() {
  return "";
}
