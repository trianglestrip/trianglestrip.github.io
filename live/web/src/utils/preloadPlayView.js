import { runIdle } from "./runIdle.js";

let preloadPromise = null;

/** 列表页 idle 后预拉 PlayView 及播放相关 chunk，避免与首屏争带宽 */
export function preloadPlayView() {
  runIdle(() => {
    setTimeout(() => {
      if (!preloadPromise) {
        preloadPromise = Promise.all([
          import("../views/PlayView.vue"),
          import("../components/PlayerControls.vue"),
          import("../components/DanmakuOverlay.vue"),
        ]);
      }
    }, 1200);
  }, { timeout: 6000 });
  return preloadPromise;
}
