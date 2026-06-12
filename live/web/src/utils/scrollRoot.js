/** 查找最近的可滚动祖先，供 IntersectionObserver 与无限滚动共用 */
export function findScrollRoot(el) {
  let node = el?.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    const overflowY = style.overflowY;
    if (overflowY === "auto" || overflowY === "scroll") {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}
