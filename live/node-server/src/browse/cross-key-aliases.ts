/** 历史/自动生成的冗长 key → 当前简短 key（兼容旧链接与本地缓存） */
export const CROSS_KEY_ALIASES: Record<string, string> = {
  g4133_9449_1011032_878: "sjz",
  g4133_9449_1011032: "sjz",
  "3": "jx3",
  g1227_6219_1010016_666: "yjwj",
  g1227_6219_1010016: "yjwj",
  g1223_5489_1010039_321: "ys",
  g1223_5489_1010039: "ys",
  g3379_7349_1010043_549: "bhxy",
  g3379_7349_1010043: "bhxy",
  g3133_7209_1010018_502: "aqtw",
  g3133_7209_1010018: "aqtw",
  g3358_6909_1010011_571: "dzpd",
  g3358_6909_1010011: "dzpd",
  g356_3115_1010041_163: "dwrg",
  g356_3115_1010041: "dwrg",
  g2075_6111_1010358_804: "hmwk",
  g2075_6111_1010358: "hmwk",
  g2556_7185_1010055_514: "jcc",
  g2556_7185_1010055: "jcc",
  g3671_7711_1010155_662: "jql",
  g3671_7711_1010155: "jql",
  g201_2168_145: "yanzhi",
};

export function resolveCrossCategoryKey(key: string): string {
  const text = String(key || "").trim();
  if (!text) return "";
  return CROSS_KEY_ALIASES[text] || text;
}
