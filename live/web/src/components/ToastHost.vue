<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast">
      <button
        v-for="item in toasts"
        :key="item.id"
        type="button"
        class="toast-item"
        :class="`toast-item--${item.kind || 'info'}`"
        @click="onClick(item)"
      >
        <span class="toast-item__title">{{ item.title }}</span>
        <span class="toast-item__text">{{ item.text || item.message }}</span>
        <span v-if="item.platform" class="toast-item__meta">{{ item.platform }}</span>
      </button>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { useToast } from "../composables/useToast.js";

const props = defineProps({
  onNavigate: { type: Function, default: null },
});

const { toasts, dismiss } = useToast();

function onClick(item) {
  props.onNavigate?.(item);
  dismiss(item.id);
}
</script>

<style scoped>
.toast-host {
  position: fixed;
  top: .75rem;
  right: .75rem;
  z-index: 120;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: .45rem;
  width: min(320px, calc(100vw - 1.5rem));
  pointer-events: none;
}

.toast-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: .12rem;
  width: 100%;
  padding: .62rem .72rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
  color: var(--text);
  text-align: left;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .22);
  cursor: pointer;
  pointer-events: auto;
  transition: transform .18s ease, opacity .18s ease, border-color .18s ease;
}

.toast-item:hover {
  transform: translateY(-1px);
  border-color: var(--amber);
}

.toast-item__title {
  font-size: .78rem;
  font-weight: 600;
  color: var(--muted);
}

.toast-item__text {
  font-size: .92rem;
  line-height: 1.35;
}

.toast-item__meta {
  font-size: .72rem;
  color: var(--muted);
}

.toast-item--live {
  border-color: rgba(61, 220, 132, .45);
}

.toast-item--live .toast-item__title {
  color: var(--live);
}

.toast-item--offline {
  border-color: rgba(255, 255, 255, .12);
}

.toast-enter-active,
.toast-leave-active {
  transition: all .22s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

.toast-move {
  transition: transform .22s ease;
}
</style>
