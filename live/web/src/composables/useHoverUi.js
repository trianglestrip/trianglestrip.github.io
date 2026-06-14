import { onBeforeUnmount, onMounted, ref } from "vue";
import { hoverUiMediaQuery } from "../utils/breakpoints.js";

export function useHoverUi() {
  const hoverUi = ref(false);
  let mq = null;

  function sync() {
    hoverUi.value = window.matchMedia(hoverUiMediaQuery()).matches;
  }

  onMounted(() => {
    sync();
    mq = window.matchMedia(hoverUiMediaQuery());
    mq.addEventListener("change", sync);
  });

  onBeforeUnmount(() => {
    mq?.removeEventListener("change", sync);
  });

  return { hoverUi };
}
