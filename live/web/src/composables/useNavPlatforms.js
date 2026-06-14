import { computed } from "vue";
import { useRoute } from "vue-router";
import { PLATFORMS, supportsBrowse } from "../config/platforms.js";

export function useNavPlatforms(siteRef) {
  const route = useRoute();

  const showCenterPlatforms = computed(
    () =>
      route.name === "all-home" ||
      route.name === "all-category-rooms" ||
      route.name === "site-home" ||
      route.name === "category-index" ||
      route.name === "category-rooms",
  );

  const categoryNavMode = computed(
    () =>
      route.name === "category-index" ||
      route.name === "category-rooms" ||
      route.name === "all-category-rooms",
  );

  const activePlatformId = computed(() => {
    if (route.name === "all-home") return "all";
    if (String(route.params.site || "") === "all") return "all";
    const site = typeof siteRef === "function" ? siteRef() : siteRef?.value ?? siteRef;
    return site || "douyu";
  });

  const navPlatforms = computed(() =>
    PLATFORMS.filter((p) => p.enabled && (p.crossBrowse || supportsBrowse(p.id))),
  );

  function platformNavLink(platformId) {
    if (platformId === "all") {
      return categoryNavMode.value ? "/all/category" : "/all";
    }
    if (categoryNavMode.value && supportsBrowse(platformId)) {
      return `/${platformId}/category`;
    }
    return `/${platformId}`;
  }

  function platformLabel(platformId) {
    return PLATFORMS.find((p) => p.id === platformId)?.label || platformId;
  }

  return {
    showCenterPlatforms,
    categoryNavMode,
    activePlatformId,
    navPlatforms,
    platformNavLink,
    platformLabel,
  };
}
