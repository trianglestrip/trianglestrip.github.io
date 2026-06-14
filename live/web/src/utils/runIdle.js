/** 浏览器空闲时执行，避免与首屏/播放争用主线程 */
export function runIdle(fn, { timeout = 2500, fallbackMs = 48 } = {}) {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(fn, { timeout });
  } else {
    setTimeout(fn, fallbackMs);
  }
}

/** 列表 API 预填：idle 后再拉取后续页 */
export function scheduleIdleTask(fn, { timeout = 3000, fallbackMs = 100 } = {}) {
  runIdle(fn, { timeout, fallbackMs });
}
