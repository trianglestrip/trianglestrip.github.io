<template>
  <div class="follow-batch" :class="{ 'follow-batch--inline': inline }">
    <button
      type="button"
      class="follow-batch__toggle"
      :class="{ 'btn btn-sm': inline }"
      @click="expanded = !expanded"
    >
      {{ expanded ? "收起" : "批量加入" }}
    </button>
    <div v-if="expanded" class="follow-batch__panel">
      <div class="platform-radio-group" role="radiogroup" aria-label="选择平台">
        <label
          v-for="p in enabledPlatforms"
          :key="p.id"
          class="platform-radio"
          :class="[`platform-radio--${p.id}`, { active: site === p.id }]"
          :title="p.label"
        >
          <input
            v-model="site"
            type="radio"
            class="platform-radio__input"
            :value="p.id"
          />
          <span class="platform-radio__label">{{ p.label }}</span>
        </label>
      </div>
      <textarea
        v-model="text"
        class="follow-batch__input"
        rows="3"
        :placeholder="batchPlaceholder"
      />
      <div class="follow-batch__actions">
        <button type="button" class="btn btn-primary btn-sm" :disabled="submitting" @click="submit">
          加入关注
        </button>
        <span v-if="message" class="follow-batch__msg">{{ message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { PLATFORMS } from "../config/platforms.js";
import { useFollow } from "../composables/useFollow.js";
import { parseFollowImport } from "../utils/parseFollowImport.js";

defineProps({
  inline: { type: Boolean, default: false },
});

const { importFollows } = useFollow();

const expanded = ref(false);
const site = ref("douyu");
const text = ref("");
const message = ref("");
const submitting = ref(false);

const enabledPlatforms = computed(() => PLATFORMS.filter((p) => p.enabled));

const batchPlaceholder = computed(() =>
  site.value === "douyin"
    ? "房间号或 live.douyin.com/xxx 链接，逗号分隔"
    : "房间号，用英文逗号分隔",
);

function submit() {
  message.value = "";
  const items = parseFollowImport(text.value, site.value);
  if (!items.length) {
    message.value = "未识别到有效房间号";
    return;
  }
  submitting.value = true;
  const added = importFollows(items);
  message.value = `已加入 ${added} 个新关注（共 ${items.length} 个房间号）`;
  if (added > 0) text.value = "";
  submitting.value = false;
}
</script>

<style scoped>
.follow-batch {
  flex-shrink: 0;
  padding: .5rem .55rem .45rem;
  border-bottom: 1px solid var(--chrome-border);
}

.follow-batch--inline {
  display: contents;
}

.follow-batch--inline .follow-batch__toggle {
  width: auto;
  padding: .38rem .65rem;
  border-color: var(--border);
  background: transparent;
  white-space: nowrap;
}

.follow-batch--inline .follow-batch__panel {
  flex-basis: 100%;
  width: 100%;
  margin-top: 0;
  padding-bottom: .15rem;
}

.follow-batch__toggle {
  width: 100%;
  padding: .45rem .55rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-soft);
  color: var(--muted);
  font: inherit;
  font-size: .82rem;
  cursor: pointer;
  transition: border-color .15s, color .15s;
}

.follow-batch__toggle:hover {
  border-color: var(--amber);
  color: var(--amber);
}

.follow-batch__panel {
  margin-top: .5rem;
  display: flex;
  flex-direction: column;
  gap: .45rem;
}

.platform-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
}

.platform-radio {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: .16rem .32rem;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color .15s, background-color .15s, color .15s;
}

.platform-radio__label {
  font-size: .62rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: .02em;
  white-space: nowrap;
}

.platform-radio--douyu {
  color: var(--platform-douyu-text);
  background: var(--follow-tag-douyu-bg, var(--sidebar-tag-douyu-bg));
}

.platform-radio--huya {
  color: var(--platform-huya-text);
  background: var(--follow-tag-huya-bg, var(--sidebar-tag-huya-bg));
}

.platform-radio--douyin {
  color: var(--platform-douyin-text);
  background: var(--follow-tag-douyin-bg, var(--sidebar-tag-douyin-bg));
}

.platform-radio--douyu.active {
  border-color: color-mix(in srgb, var(--platform-douyu) 55%, var(--border));
  background: var(--follow-filter-douyu-active-bg, var(--sidebar-filter-douyu-active-bg));
  color: var(--platform-douyu-text-em);
}

.platform-radio--huya.active {
  border-color: color-mix(in srgb, var(--platform-huya) 55%, var(--border));
  background: var(--follow-filter-huya-active-bg, var(--sidebar-filter-huya-active-bg));
  color: var(--platform-huya-text-em);
}

.platform-radio--douyin.active {
  border-color: color-mix(in srgb, var(--platform-douyin) 55%, var(--border));
  background: var(--follow-filter-douyin-active-bg, var(--sidebar-filter-douyin-active-bg));
  color: var(--platform-douyin-text-em);
}

.platform-radio:hover {
  filter: brightness(1.08);
}

.platform-radio.active {
  box-shadow: 0 0 0 1px var(--chrome-border);
}

.platform-radio__input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.follow-batch__input {
  width: 100%;
  resize: vertical;
  min-height: 4.5rem;
  font-family: inherit;
  font-size: .82rem;
  line-height: 1.45;
}

.follow-batch__actions {
  display: flex;
  align-items: center;
  gap: .5rem;
  flex-wrap: wrap;
}

.btn-sm {
  padding: .4rem .65rem;
  font-size: .82rem;
}

.follow-batch__msg {
  font-size: .78rem;
  color: var(--muted);
}
</style>
