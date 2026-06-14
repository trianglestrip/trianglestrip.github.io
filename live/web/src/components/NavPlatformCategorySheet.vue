<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="nav-cat-sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="`${platformLabel(platformId)}分类`"
      @click.self="$emit('close')"
    >
      <div class="nav-cat-sheet__panel">
        <header class="nav-cat-sheet__header">
          <span class="nav-cat-sheet__title">{{ platformLabel(platformId) }} · 分类</span>
          <button type="button" class="nav-cat-sheet__close" aria-label="关闭" @click="$emit('close')">
            <Icon name="close" />
          </button>
        </header>
        <NavPlatformCategoryMenu
          :platform-id="platformId"
          embedded
          @navigate="$emit('close')"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import Icon from "./Icon.vue";
import NavPlatformCategoryMenu from "./NavPlatformCategoryMenu.vue";
import { useNavPlatforms } from "../composables/useNavPlatforms.js";

defineProps({
  open: { type: Boolean, default: false },
  platformId: { type: String, required: true },
});

defineEmits(["close", "navigate"]);

const { platformLabel } = useNavPlatforms("douyu");
</script>

<style scoped>
.nav-cat-sheet {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, .45);
}

.nav-cat-sheet__panel {
  width: 100%;
  max-height: min(78vh, 32rem);
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border-radius: 14px 14px 0 0;
  box-shadow: 0 -8px 28px rgba(0, 0, 0, .35);
}

.nav-cat-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  padding: .55rem .75rem .45rem;
  border-bottom: 1px solid var(--chrome-border);
  flex-shrink: 0;
}

.nav-cat-sheet__title {
  font-size: .92rem;
  font-weight: 600;
}

.nav-cat-sheet__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: 1.1rem;
  cursor: pointer;
}
</style>
