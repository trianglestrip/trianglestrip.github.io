<template>
  <div
    class="follow-platform-filter"
    :class="{ 'follow-platform-filter--compact': compact }"
    role="radiogroup"
    aria-label="平台筛选"
  >
    <button
      type="button"
      role="radio"
      class="follow-platform-filter__item"
      :class="{ 'follow-platform-filter__item--active': modelValue === '' }"
      :aria-checked="modelValue === ''"
      @click="modelValue = ''"
    >
      全部
    </button>
    <button
      v-for="platform in filterPlatforms"
      :key="platform.id"
      type="button"
      role="radio"
      class="follow-platform-filter__item"
      :class="[
        `follow-platform-filter__item--${platform.id}`,
        { 'follow-platform-filter__item--active': modelValue === platform.id },
      ]"
      :aria-checked="modelValue === platform.id"
      @click="modelValue = platform.id"
    >
      {{ platform.label }}
    </button>
  </div>
</template>

<script setup>
import { PLATFORMS } from "../config/platforms";

const modelValue = defineModel({ type: String, default: "" });

defineProps({
  compact: { type: Boolean, default: false },
});

const filterPlatforms = PLATFORMS.filter((p) => p.enabled && p.id !== "bilibili");
</script>

<style scoped>
.follow-platform-filter {
  display: flex;
  align-items: center;
  gap: .36rem;
  min-width: 0;
  flex-wrap: wrap;
}

.follow-platform-filter__item {
  flex-shrink: 0;
  padding: .32rem .58rem;
  border: 1px solid transparent;
  border-radius: 5px;
  background: var(--follow-filter-bg, var(--dark-6));
  color: var(--muted);
  font-size: .92rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: .02em;
  cursor: pointer;
  transition: border-color .12s ease, background-color .12s ease, color .12s ease;
}

.follow-platform-filter--compact {
  gap: .24rem;
}

.follow-platform-filter--compact .follow-platform-filter__item {
  padding: .16rem .32rem;
  border-radius: 3px;
  font-size: .62rem;
}

.follow-platform-filter__item:hover {
  color: var(--text);
}

.follow-platform-filter__item--active {
  border-color: var(--border);
  color: var(--text);
  background: var(--follow-filter-active-bg, var(--sidebar-chip-active-bg, var(--dark-6)));
}

.follow-platform-filter__item--douyu {
  color: var(--platform-douyu-text);
  background: var(--follow-filter-douyu-bg, var(--sidebar-filter-douyu-bg));
}

.follow-platform-filter__item--douyu.follow-platform-filter__item--active {
  border-color: color-mix(in srgb, var(--platform-douyu) 55%, var(--border));
  background: var(--follow-filter-douyu-active-bg, var(--sidebar-filter-douyu-active-bg));
  color: var(--platform-douyu-text-em);
}

.follow-platform-filter__item--huya {
  color: var(--platform-huya-text);
  background: var(--follow-filter-huya-bg, var(--sidebar-filter-huya-bg));
}

.follow-platform-filter__item--huya.follow-platform-filter__item--active {
  border-color: color-mix(in srgb, var(--platform-huya) 55%, var(--border));
  background: var(--follow-filter-huya-active-bg, var(--sidebar-filter-huya-active-bg));
  color: var(--platform-huya-text-em);
}

.follow-platform-filter__item--douyin {
  color: var(--platform-douyin-text);
  background: var(--follow-filter-douyin-bg, var(--sidebar-filter-douyin-bg));
}

.follow-platform-filter__item--douyin.follow-platform-filter__item--active {
  border-color: color-mix(in srgb, var(--platform-douyin) 55%, var(--border));
  background: var(--follow-filter-douyin-active-bg, var(--sidebar-filter-douyin-active-bg));
  color: var(--platform-douyin-text-em);
}
</style>
