import { ref } from "vue";

const toasts = ref([]);
const dismissTimers = new Map();
let seed = 0;
const AUTO_DISMISS_MS = 10000;
const MAX_TOASTS = 5;

export function useToast() {
  function notify(item) {
    const id = ++seed;
    const toast = { ...item, id, createdAt: Date.now() };
    toasts.value = [...toasts.value, toast].slice(-MAX_TOASTS);
    const timer = window.setTimeout(() => {
      dismissTimers.delete(id);
      dismiss(id);
    }, AUTO_DISMISS_MS);
    dismissTimers.set(id, timer);
    return id;
  }

  function dismiss(id) {
    const timer = dismissTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimers.delete(id);
    }
    toasts.value = toasts.value.filter((item) => item.id !== id);
  }

  return { toasts, notify, dismiss };
}
