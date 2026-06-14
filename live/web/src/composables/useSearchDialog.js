import { ref } from "vue";

const searchOpen = ref(false);
const searchDefaultSite = ref("douyu");

export function useSearchDialog() {
  function openSearch(site = "douyu") {
    searchDefaultSite.value = String(site || "douyu");
    searchOpen.value = true;
  }

  function closeSearch() {
    searchOpen.value = false;
  }

  return {
    searchOpen,
    searchDefaultSite,
    openSearch,
    closeSearch,
  };
}
