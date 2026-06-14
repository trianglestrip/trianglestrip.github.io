<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="item in toasts"
        :key="item.id"
        class="toast-item"
        :class="`toast-item--${item.kind || 'info'}`"
      >
        <button type="button" class="toast-item__main" @click="onClick(item)">
          <span class="toast-item__title">{{ item.title }}</span>
          <span class="toast-item__text">{{ item.text || item.message }}</span>
          <span v-if="item.platform" class="toast-item__meta">{{ item.platform }}</span>
        </button>
        <button
          type="button"
          class="toast-item__close"
          title="关闭"
          aria-label="关闭提醒"
          @click="dismiss(item.id)"
        >
          <Icon name="close" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import Icon from "./Icon.vue";
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
  gap: .32rem;
  width: min(300px, calc(100vw - 1.5rem));
  pointer-events: none;
}

.toast-item {
  display: flex;
  align-items: flex-start;
  gap: .25rem;
  width: 100%;
  padding: .38rem .4rem .38rem .55rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  box-shadow: 0 6px 18px rgba(0, 0, 0, .2);
  pointer-events: auto;
  transition: transform .18s ease, opacity .18s ease, border-color .18s ease;
}

.toast-item:hover {
  transform: translateY(-1px);
  border-color: var(--amber);
}

.toast-item__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: .04rem;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.toast-item__close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.45rem;
  height: 1.45rem;
  margin: -.04rem -.04rem 0 0;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  font-size: .8rem;
  line-height: 1;
  cursor: pointer;
  transition: color .15s, background .15s;
}

.toast-item__close:hover {
  color: var(--text);
  background: var(--dark-6);
}

.toast-item__title {
  font-size: .72rem;
  font-weight: 600;
  color: var(--muted);
  line-height: 1.2;
}

.toast-item__text {
  font-size: .82rem;
  line-height: 1.25;
}

.toast-item__meta {
  font-size: .68rem;
  line-height: 1.2;
  color: var(--muted);
}

.toast-item--live {
  border-color: color-mix(in srgb, var(--live) 45%, var(--border));
}

.toast-item--live .toast-item__title {
  color: var(--live);
}

.toast-item--offline {
  border-color: var(--chrome-border);
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
