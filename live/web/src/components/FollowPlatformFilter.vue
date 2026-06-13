<template>
  <div class="follow-platform-filter" role="radiogroup" aria-label="平台筛选">
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

const filterPlatforms = PLATFORMS.filter((p) => p.enabled && p.id !== "bilibili");
</script>

<style scoped>
.follow-platform-filter {
  display: flex;
  align-items: center;
  gap: .24rem;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.follow-platform-filter__item {
  flex-shrink: 0;
  padding: .16rem .32rem;
  border: 1px solid transparent;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--muted);
  font-size: .62rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: .02em;
  cursor: pointer;
  transition: border-color .12s ease, background-color .12s ease, color .12s ease;
}

.follow-platform-filter__item:hover {
  color: var(--text);
}

.follow-platform-filter__item--active {
  border-color: rgba(255, 255, 255, 0.22);
  color: var(--text);
  background: rgba(255, 255, 255, 0.12);
}

.follow-platform-filter__item--douyu {
  color: #ff8a2a;
  background: rgba(255, 138, 42, 0.14);
}

.follow-platform-filter__item--douyu.follow-platform-filter__item--active {
  border-color: rgba(255, 138, 42, 0.45);
  background: rgba(255, 138, 42, 0.28);
  color: #ffb066;
}

.follow-platform-filter__item--huya {
  color: #ffb800;
  background: rgba(255, 184, 0, 0.14);
}

.follow-platform-filter__item--huya.follow-platform-filter__item--active {
  border-color: rgba(255, 184, 0, 0.45);
  background: rgba(255, 184, 0, 0.28);
  color: #ffd24a;
}

.follow-platform-filter__item--douyin {
  color: #fe2c55;
  background: rgba(254, 44, 85, 0.14);
}

.follow-platform-filter__item--douyin.follow-platform-filter__item--active {
  border-color: rgba(254, 44, 85, 0.45);
  background: rgba(254, 44, 85, 0.28);
  color: #ff6b8a;
}
</style>
