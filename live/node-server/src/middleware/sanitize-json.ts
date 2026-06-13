export function sanitizeUnicode<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
      "\uFFFD",
    ) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnicode(item)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeUnicode(v);
    }
    return out as T;
  }
  return value;
}
