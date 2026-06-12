import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import PlatformView from "./views/PlatformView.vue";
import WatchView from "./views/WatchView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/platform/:site", name: "platform", component: PlatformView, props: true },
    { path: "/watch/:site/:room?", name: "watch", component: WatchView, props: true },
  ],
});

export default router;
