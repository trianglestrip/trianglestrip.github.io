export function formatOnline(count: number | string | null | undefined): string {
  let value: number;
  try {
    value = Number(count ?? 0);
    if (Number.isNaN(value)) {
      return "";
    }
  } catch {
    return "";
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}千`;
  }
  if (value > 0) {
    return String(Math.trunc(value));
  }
  return "";
}

/** 贵宾/守护/钻粉等：显示实际数字，不做万/千省略 */
export function formatCount(count: number | string | null | undefined): string {
  const value = Number(count ?? 0);
  if (Number.isNaN(value) || value <= 0) return "";
  return String(Math.trunc(value));
}

/** 在线人数：始终显示完整数字，不缩写；兼容「1.2万」「3万+」「3w+」等 */
export function formatPlainCount(count: number | string | null | undefined): string {
  if (typeof count === "number" && Number.isFinite(count)) {
    if (count <= 0) return "";
    return String(Math.trunc(count));
  }

  const s = String(count ?? "").trim();
  if (!s) return "";

  const cleaned = s.replace(/\+$/u, "").trim();
  if (cleaned.endsWith("万")) {
    const n = parseFloat(cleaned.slice(0, -1));
    if (Number.isFinite(n) && n > 0) return String(Math.round(n * 10_000));
  }
  if (cleaned.endsWith("千")) {
    const n = parseFloat(cleaned.slice(0, -1));
    if (Number.isFinite(n) && n > 0) return String(Math.round(n * 1_000));
  }

  const wk = cleaned.match(/^([\d.]+)\s*([wkWK])$/u);
  if (wk) {
    const n = parseFloat(wk[1]);
    const unit = wk[2].toLowerCase();
    if (Number.isFinite(n) && n > 0) {
      return String(Math.round(n * (unit === "w" ? 10_000 : 1_000)));
    }
  }

  const value = Number(cleaned.replace(/,/g, ""));
  if (Number.isNaN(value) || value <= 0) return "";
  return String(Math.trunc(value));
}
