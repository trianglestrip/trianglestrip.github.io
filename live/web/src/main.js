import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { loadAppConfig } from "./config/app.js";
import "./styles/main.css";

loadAppConfig().then(() => {
  createApp(App).use(router).mount("#app");
});
