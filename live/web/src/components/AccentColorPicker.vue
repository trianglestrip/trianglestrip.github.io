<template>
  <div
    class="accent-picker"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @focusin="onMouseEnter"
    @focusout="onFocusOut"
  >
    <button
      type="button"
      class="nav-item accent-picker__trigger"
      title="主色调"
      aria-label="选择主色调"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="accent-picker__swatch" :style="{ background: currentHex }" aria-hidden="true" />
    </button>
    <div v-if="open" class="accent-picker__panel" role="listbox" aria-label="主色预设">
      <button
        v-for="preset in presets"
        :key="preset.id"
        type="button"
        role="option"
        class="accent-picker__option"
        :class="{ 'accent-picker__option--active': preset.id === accentId }"
        :title="preset.label"
        :aria-selected="preset.id === accentId"
        @click="select(preset.id)"
      >
        <span class="accent-picker__option-swatch" :style="{ background: preset.hex }" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { getAccentHex, getAccentPresets } from "../utils/accent.js";
import { getAccent, setAccent } from "../utils/theme.js";

const presets = getAccentPresets();
const open = ref(false);
const accentId = ref(getAccent());
const currentHex = ref(getAccentHex(accentId.value));
let closeTimer = null;

onMounted(() => {
  accentId.value = getAccent();
  currentHex.value = getAccentHex(accentId.value);
});

function onMouseEnter() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  open.value = true;
}

function onMouseLeave() {
  closeTimer = setTimeout(() => {
    open.value = false;
    closeTimer = null;
  }, 160);
}

function select(id) {
  accentId.value = setAccent(id);
  currentHex.value = getAccentHex(accentId.value);
  open.value = false;
}

function onFocusOut(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    open.value = false;
  }
}
</script>

<style scoped>
.accent-picker {
  position: relative;
}

.accent-picker__trigger {
  cursor: pointer;
}

.accent-picker__swatch {
  display: block;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 4px;
  border: 2px solid var(--border);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
}

.accent-picker__panel {
  position: absolute;
  right: 0;
  bottom: 100%;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(4, 1.65rem);
  gap: .35rem;
  padding: .45rem;
  margin-bottom: 2px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.accent-picker__panel::before {
  content: "";
  position: absolute;
  left: -6px;
  right: -6px;
  height: 12px;
  bottom: -10px;
  pointer-events: auto;
}

@media (min-width: 768px) {
  .accent-picker__panel {
    bottom: auto;
    top: 100%;
    margin-bottom: 0;
    margin-top: 2px;
  }

  .accent-picker__panel::before {
    top: -10px;
    bottom: auto;
  }
}

.accent-picker__option {
  display: grid;
  place-items: center;
  width: 1.65rem;
  height: 1.65rem;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.12s;
}

.accent-picker__option:hover {
  transform: scale(1.06);
  border-color: var(--border);
}

.accent-picker__option--active {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary-ring);
}

.accent-picker__option-swatch {
  display: block;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
}
</style>
