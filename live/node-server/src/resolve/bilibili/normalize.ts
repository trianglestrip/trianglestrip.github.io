export function normalizeUrl(value: string): string {
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    return `https://live.bilibili.com/${text}`;
  }
  if (!text.includes("bilibili.com")) {
    throw new Error(`无效的 B 站直播地址: ${value}`);
  }
  if (!text.startsWith("http")) {
    return `https://${text}`;
  }
  return text;
}

export function roomIdFromUrl(url: string): string {
  const normalized = normalizeUrl(url);
  const match = normalized.match(/live\.bilibili\.com\/(?:blanc\/)?(\d+)/);
  if (match) return match[1];
  return normalized.replace(/\/$/, "").split("/").pop() || "";
}
