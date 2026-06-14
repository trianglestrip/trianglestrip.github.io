let loadPromise = null;

/** 按需加载 flv.js（列表页不加载） */
export function loadFlvJs() {
  if (typeof window !== "undefined" && window.flvjs) {
    return Promise.resolve(window.flvjs);
  }
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const base = import.meta.env.BASE_URL || "/";
      const src = `${base}flv.min.js`.replace(/\/{2,}/g, "/").replace(":/", "://");
      const existing = document.querySelector(`script[data-flv-loader]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(window.flvjs));
        existing.addEventListener("error", reject);
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.flvLoader = "1";
      script.onload = () => resolve(window.flvjs);
      script.onerror = () => {
        loadPromise = null;
        reject(new Error("flv.js 加载失败"));
      };
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}
