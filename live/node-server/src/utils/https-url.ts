export function httpsUrl(text: string): string {
  const value = String(text || "").trim();
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}
