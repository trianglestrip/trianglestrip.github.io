<template>
  <div
    class="follow-avatar-root"
    :class="{
      'follow-avatar-root--compact': compact,
      'follow-avatar-root--grid': grid,
    }"
  >
    <div
      class="follow-avatar-wrap"
      :class="{
        'follow-avatar-wrap--live': state === 'live' && !hideLiveFrame && !isSuper,
        'follow-avatar-wrap--replay': state === 'replay' && !isSuper,
        'follow-avatar-wrap--super-live': isSuper && state === 'live' && !hideLiveFrame,
        'follow-avatar-wrap--super-replay': isSuper && state === 'replay',
      }"
    >
      <LazyImage
        v-if="src"
        :src="src"
        image-class="follow-avatar"
        :root-margin="rootMargin"
        :eager="eager"
        :priority="priority"
      />
      <div v-else class="follow-avatar follow-avatar--empty">{{ label }}</div>
    </div>
  </div>
</template>

<script setup>
import LazyImage from "./LazyImage.vue";

defineProps({
  src: { type: String, default: "" },
  label: { type: String, default: "?" },
  /** 与关注列表 compact 模式一致（侧栏、关注 Tab 列表） */
  compact: { type: Boolean, default: false },
  /** 与关注列表 grid 模式一致 */
  grid: { type: Boolean, default: false },
  state: { type: String, default: "" },
  eager: { type: Boolean, default: false },
  rootMargin: { type: String, default: "120px" },
  priority: { type: String, default: "auto" },
  hideLiveFrame: { type: Boolean, default: false },
  isSuper: { type: Boolean, default: false },
});
</script>

<style scoped>
.follow-avatar-wrap {
  position: relative;
  flex-shrink: 0;
  line-height: 0;
  align-self: flex-start;
}

.follow-avatar-wrap--live::after,
.follow-avatar-wrap--replay::after,
.follow-avatar-wrap--super-live::after,
.follow-avatar-wrap--super-replay::after {
  content: "";
  position: absolute;
  inset: -2px;
  z-index: 2;
  border-radius: 5px;
  pointer-events: none;
  box-sizing: border-box;
}

.follow-avatar-wrap--live::after {
  border: 2.5px solid var(--danger-border);
  animation: follow-avatar-live-ring 2.2s ease-in-out infinite;
}

.follow-avatar-wrap--replay::after {
  border: 2px solid var(--primary-border-72);
}

.follow-avatar-wrap--super-live::after {
  border: 2.5px solid var(--follow-state-super-accent);
  animation: follow-avatar-super-live-ring 2.2s ease-in-out infinite;
}

.follow-avatar-wrap--super-replay::after {
  border: 2px solid color-mix(in srgb, var(--follow-state-super-accent) 72%, var(--primary-border-72));
}

.follow-avatar-root--grid .follow-avatar-wrap--live::after,
.follow-avatar-root--grid .follow-avatar-wrap--replay::after,
.follow-avatar-root--grid .follow-avatar-wrap--super-live::after,
.follow-avatar-root--grid .follow-avatar-wrap--super-replay::after {
  border-radius: 6px;
}

.follow-avatar-root--compact .follow-avatar-wrap--live::after,
.follow-avatar-root--compact .follow-avatar-wrap--replay::after,
.follow-avatar-root--compact .follow-avatar-wrap--super-live::after,
.follow-avatar-root--compact .follow-avatar-wrap--super-replay::after {
  border-radius: 4px;
}

@keyframes follow-avatar-live-ring {
  0%, 100% {
    border-color: color-mix(in srgb, var(--danger) 72%, transparent);
    box-shadow: 0 0 0 0 transparent;
  }
  50% {
    border-color: var(--danger);
    box-shadow: 0 0 0 2px var(--danger-glow-22), 0 0 10px color-mix(in srgb, var(--danger) 28%, transparent);
  }
}

@keyframes follow-avatar-super-live-ring {
  0%, 100% {
    border-color: color-mix(in srgb, var(--follow-state-super-accent) 72%, transparent);
    box-shadow: 0 0 0 0 transparent;
  }
  50% {
    border-color: var(--follow-state-super-accent);
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--follow-state-super-accent) 28%, transparent),
      0 0 10px color-mix(in srgb, var(--follow-state-super-accent) 32%, transparent);
  }
}

.follow-avatar-root :deep(.follow-avatar) {
  width: 2rem;
  height: 2rem;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
  display: block;
  background: var(--bg-soft);
}

.follow-avatar--empty {
  width: 2rem;
  height: 2rem;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: .72rem;
  color: var(--muted);
  border: 1px dashed var(--border);
  background: var(--bg-soft);
}

.follow-avatar-root--compact :deep(.follow-avatar),
.follow-avatar-root--compact .follow-avatar--empty {
  width: 1.72rem;
  height: 1.72rem;
  border-radius: 3px;
}

.follow-avatar-root--compact .follow-avatar--empty {
  font-size: .64rem;
}

.follow-avatar-root--grid :deep(.follow-avatar),
.follow-avatar-root--grid .follow-avatar--empty {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 5px;
}
</style>
