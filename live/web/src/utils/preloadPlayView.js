let preloadPromise = null;

/** 列表页预拉 PlayView 路由 chunk，减少首次进房 JS 等待 */
export function preloadPlayView() {
  if (!preloadPromise) {
    preloadPromise = import("../views/PlayView.vue");
  }
  return preloadPromise;
}
