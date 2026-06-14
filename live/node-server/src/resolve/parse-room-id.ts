import { ROOM_ID_PATTERNS, getPlatform } from "../platforms/registry.js";

export { ROOM_ID_PATTERNS };

export function parseRoomId(value: string, site = "douyu"): string {
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    return text;
  }
  const cleaned = text.replace(/^https?:\/\//, "");
  const pattern = getPlatform(site)?.roomIdPattern ?? ROOM_ID_PATTERNS.douyu;
  const match = cleaned.match(pattern);
  if (match) {
    return match[1];
  }
  throw new Error(`无效房间号: ${value}`);
}
