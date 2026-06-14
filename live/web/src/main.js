import { createApp } from "vue";
import App from "./App.vue";
import router, { consumeGhPagesRedirect } from "./router";
import { loadAppConfig } from "./config/app.js";
import { applyPendingFollowImport } from "./utils/prefStore.js";
import { initTheme } from "./utils/theme.js";
import { loadCategoryCrossMap } from "./utils/categoryDisplay.js";
import "./styles/main.css";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/solid.min.css";
import "@fortawesome/fontawesome-free/css/regular.min.css";

initTheme();

loadAppConfig().then(() => {
  void loadCategoryCrossMap();
  const pendingAdded = applyPendingFollowImport();
  const app = createApp(App).use(router);
  app.mount("#app");
  consumeGhPagesRedirect(router);
  if (pendingAdded > 0) {
    console.info(`[Lemon Live] 已从 Tampermonkey 同步 ${pendingAdded} 个关注`);
  }
});
