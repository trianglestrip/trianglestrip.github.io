import { createRouter, createWebHistory } from "vue-router";
import SiteHomeView from "./views/SiteHomeView.vue";
import CategoryIndexView from "./views/CategoryIndexView.vue";
import CategoryRoomsView from "./views/CategoryRoomsView.vue";
import FollowView from "./views/FollowView.vue";
import TimeView from "./views/TimeView.vue";
import PlaceholderView from "./views/PlaceholderView.vue";
import { PLATFORMS } from "./config/platforms";

const enabledSites = new Set(PLATFORMS.filter((p) => p.enabled).map((p) => p.id));

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/douyu" },
    { path: "/follow", name: "follow", component: FollowView },
    { path: "/time", name: "time", component: TimeView },
    { path: "/search", name: "search", component: PlaceholderView },
    { path: "/user", name: "user", component: PlaceholderView },
    {
      path: "/:site/play/:id",
      name: "play",
      component: () => import("./views/PlayView.vue"),
      props: true,
      beforeEnter: (to) => enabledSites.has(to.params.site) || "/douyu",
    },
    {
      path: "/:site/category/:cid",
      name: "category-rooms",
      component: CategoryRoomsView,
      props: (route) => ({
        site: route.params.site,
        cid: route.params.cid,
        pid: route.query.pid ? String(route.query.pid) : "",
      }),
      beforeEnter: (to) => enabledSites.has(to.params.site) || "/douyu/category",
    },
    {
      path: "/:site/category",
      name: "category-index",
      component: CategoryIndexView,
      props: true,
    },
    {
      path: "/:site",
      name: "site-home",
      component: SiteHomeView,
      props: true,
    },
    {
      path: "/watch/:site/play/:id",
      redirect: (to) => ({ name: "play", params: { site: to.params.site, id: to.params.id } }),
    },
    {
      path: "/watch/:site/category/:cid",
      redirect: (to) => ({
        name: "category-rooms",
        params: { site: to.params.site, cid: to.params.cid },
        query: to.query,
      }),
    },
    {
      path: "/watch/:site/:room?",
      redirect: (to) =>
        to.params.room
          ? { name: "play", params: { site: to.params.site, id: to.params.room } }
          : { name: "site-home", params: { site: to.params.site } },
    },
    {
      path: "/platform/:site",
      redirect: (to) => `/${to.params.site}`,
    },
  ],
});

export default router;
