export function normalizeUrl(value: string): string {
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    return `https://www.douyu.com/${text}`;
  }
  if (!text.includes("douyu.com")) {
    throw new Error(`无效的斗鱼地址: ${value}`);
  }
  if (!text.startsWith("http")) {
    return `https://${text}`;
  }
  return text;
}
