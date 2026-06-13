const ROOM_RES: Record<string, RegExp> = {
  douyu: /(?:douyu\.com\/)?(\d+)$/,
  huya: /(?:huya\.com\/)?(\d+)$/,
  douyin: /(?:(?:live\.)?douyin\.com\/)?(\d+)$/,
};

export function parseRoomId(value: string, site = "douyu"): string {
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    return text;
  }
  const cleaned = text.replace(/^https?:\/\//, "");
  const pattern = ROOM_RES[site] || ROOM_RES.douyu;
  const match = cleaned.match(pattern);
  if (match) {
    return match[1];
  }
  throw new Error(`无效房间号: ${value}`);
}
