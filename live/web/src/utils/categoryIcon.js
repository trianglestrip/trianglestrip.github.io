/** 分类无图或加载失败时的占位图 */
export const DEFAULT_CATEGORY_ICON = "/category-default.svg";

export function categoryIconSrc(pic) {
  const url = String(pic || "").trim();
  return url || DEFAULT_CATEGORY_ICON;
}
