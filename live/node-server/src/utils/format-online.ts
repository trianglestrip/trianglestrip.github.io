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
