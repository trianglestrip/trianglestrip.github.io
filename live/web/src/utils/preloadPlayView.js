let preloadPromise = null;

/** 列表页预拉 PlayView 及播放相关 chunk，减少首次进房 JS 等待 */
export function preloadPlayView() {
  if (!preloadPromise) {
    preloadPromise = Promise.all([
      import("../views/PlayView.vue"),
      import("../components/PlayerControls.vue"),
      import("../components/DanmakuOverlay.vue"),
    ]);
  }
  return preloadPromise;
}
