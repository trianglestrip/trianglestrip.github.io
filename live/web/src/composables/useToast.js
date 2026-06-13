import { ref } from "vue";

const toasts = ref([]);
let seed = 0;
const AUTO_DISMISS_MS = 10000;
const MAX_TOASTS = 5;

export function useToast() {
  function notify(item) {
    const id = ++seed;
    const toast = { id, createdAt: Date.now(), ...item };
    toasts.value = [...toasts.value, toast].slice(-MAX_TOASTS);
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    return id;
  }

  function dismiss(id) {
    toasts.value = toasts.value.filter((item) => item.id !== id);
  }

  return { toasts, notify, dismiss };
}
