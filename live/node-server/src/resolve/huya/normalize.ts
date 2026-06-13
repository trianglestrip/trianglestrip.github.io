export function normalizeUrl(value: string): string {
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    return `https://www.huya.com/${text}`;
  }
  if (!text.includes("huya.com")) {
    throw new Error(`无效的虎牙地址: ${value}`);
  }
  if (!text.startsWith("http")) {
    return `https://${text}`;
  }
  return text;
}
