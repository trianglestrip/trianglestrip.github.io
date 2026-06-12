import { createApp } from "vue";
import App from "./App.vue";
import router, { consumeGhPagesRedirect } from "./router";
import { loadAppConfig } from "./config/app.js";
import "./styles/main.css";

loadAppConfig().then(() => {
  const app = createApp(App).use(router);
  app.mount("#app");
  consumeGhPagesRedirect(router);
});
