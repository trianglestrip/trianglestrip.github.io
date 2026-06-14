import { createRouter, createWebHistory } from "vue-router";
import { PLATFORMS, supportsBrowse, supportsCrossBrowse } from "./config/platforms";
import { useSearchDialog } from "./composables/useSearchDialog.js";

const SiteHomeView = () => import("./views/SiteHomeView.vue");
const AllPlatformHomeView = () => import("./views/AllPlatformHomeView.vue");
const AllPlatformCategoryRoomsView = () => import("./views/AllPlatformCategoryRoomsView.vue");
const CategoryIndexView = () => import("./views/CategoryIndexView.vue");
const CategoryRoomsView = () => import("./views/CategoryRoomsView.vue");
const FollowView = () => import("./views/FollowView.vue");
const TimeView = () => import("./views/TimeView.vue");
const PlaceholderView = () => import("./views/PlaceholderView.vue");

const enabledSites = new Set(PLATFORMS.filter((p) => p.enabled).map((p) => p.id));

function categoryRouteGuard(to) {
  const site = String(to.params.site || "");
  if (site === "all") {
    return supportsCrossBrowse("all") ? true : "/all";
  }
  if (!enabledSites.has(site)) {
    return supportsBrowse("douyu") ? "/douyu/category" : "/douyu";
  }
  if (!supportsBrowse(site)) {
    return { name: "site-home", params: { site } };
  }
  return true;
}

const GH_PAGES_REDIRECT_KEY = "live-gh-pages-path";

/** GitHub Pages 子路径 SPA：由根 404.html 写入，在此恢复路由 */
export function consumeGhPagesRedirect(router) {
  try {
    const saved = sessionStorage.getItem(GH_PAGES_REDIRECT_KEY);
    if (!saved) return;
    sessionStorage.removeItem(GH_PAGES_REDIRECT_KEY);
    router.replace(saved).catch(() => {});
  } catch {
    /* ignore */
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/all" },
    { path: "/all", name: "all-home", component: AllPlatformHomeView },
    {
      path: "/all/category/:key",
      name: "all-category-rooms",
      component: AllPlatformCategoryRoomsView,
      props: (route) => ({ crossKey: String(route.params.key || "") }),
      beforeEnter: () => (supportsCrossBrowse("all") ? true : "/all"),
    },
    { path: "/follow", name: "follow", component: FollowView },
    { path: "/time", name: "time", component: TimeView },
    { path: "/search", name: "search", redirect: "/douyu" },
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
      beforeEnter: categoryRouteGuard,
    },
    {
      path: "/:site/category",
      name: "category-index",
      component: CategoryIndexView,
      props: true,
      beforeEnter: categoryRouteGuard,
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

const { openSearch } = useSearchDialog();

router.beforeEach((to, from) => {
  if (to.name !== "search") return true;
  const fromSite = typeof from.params?.site === "string" ? from.params.site : "";
  openSearch(enabledSites.has(fromSite) ? fromSite : "douyu");
  return true;
});

export default router;
