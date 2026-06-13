export function normalizeUrl(value: string): string {
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    return `https://live.douyin.com/${text}`;
  }
  if (!text.includes("douyin.com")) {
    throw new Error(`无效的抖音地址: ${value}`);
  }
  if (!text.startsWith("http")) {
    return `https://${text}`;
  }
  return text;
}

export function webRidFromUrl(url: string): string {
  return url.split("?")[0].split("/").filter(Boolean).pop() || "";
}
