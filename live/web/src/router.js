import { createRouter, createWebHistory } from "vue-router";
import WatchView from "./views/WatchView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: { name: "watch", params: { site: "douyu", room: "5720533" } } },
    { path: "/platform/:site", redirect: (to) => ({ name: "watch", params: { site: to.params.site, room: getDefaultRoom(to.params.site) } }) },
    { path: "/watch/:site/:room?", name: "watch", component: WatchView, props: true },
  ],
});

function getDefaultRoom(site) {
  const map = { douyu: "5720533", huya: "579236" };
  return map[site] || "";
}

export default router;
