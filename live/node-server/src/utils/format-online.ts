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
    return formatWan(value);
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}千`;
  }
  if (value > 0) {
    return String(Math.trunc(value));
  }
  return "";
}

function formatWan(value: number): string {
  const wan = value / 10000;
  const text = Number.isInteger(wan) ? String(wan) : wan.toFixed(1).replace(/\.0$/, "");
  return `${text}万`;
}

/** 在线人数：过万显示 X万 / X.X万，否则完整数字；兼容抖音等 API 的「1.2万」「3w+」 */
export function formatOnlineWan(count: number | string | null | undefined): string {
  const plain = formatPlainCount(count);
  if (!plain) return "";
  const value = Number(plain);
  if (value >= 10000) {
    return formatWan(value);
  }
  return plain;
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
