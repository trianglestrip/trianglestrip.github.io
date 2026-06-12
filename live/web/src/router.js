import { createRouter, createWebHistory } from "vue-router";
import WatchView from "./views/WatchView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: { name: "watch", params: { site: "douyu" } } },
    {
      path: "/watch/:site/category/:cid",
      name: "browse-category",
      component: WatchView,
      props: (route) => ({
        site: route.params.site,
        categoryId: route.params.cid,
        pid: route.query.pid ? String(route.query.pid) : "",
        room: "",
      }),
    },
    { path: "/watch/:site/:room?", name: "watch", component: WatchView, props: true },
    {
      path: "/platform/:site",
      redirect: (to) => ({ name: "watch", params: { site: to.params.site } }),
    },
  ],
});

export default router;
