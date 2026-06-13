import { createApp } from "vue";
import App from "./App.vue";
import router, { consumeGhPagesRedirect } from "./router";
import { loadAppConfig } from "./config/app.js";
import { applyPendingFollowImport } from "./utils/prefStore.js";
import { initTheme } from "./utils/theme.js";
import { startFollowSync } from "./utils/followSync.js";
import { useFollow } from "./composables/useFollow.js";
import "./styles/main.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

initTheme();

loadAppConfig().then(() => {
  const pendingAdded = applyPendingFollowImport();
  const { follows } = useFollow();
  startFollowSync((merged) => {
    follows.value = merged;
  });
  const app = createApp(App).use(router);
  app.mount("#app");
  consumeGhPagesRedirect(router);
  if (pendingAdded > 0) {
    console.info(`[Lemon Live] 已从 Tampermonkey 同步 ${pendingAdded} 个关注`);
  }
});
