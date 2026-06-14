<template>
  <Teleport to="body">
    <Transition name="search-dialog">
      <div
        v-if="searchOpen"
        class="search-dialog"
        role="presentation"
        @click.self="closeSearch"
      >
        <div
          class="search-dialog__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="search-dialog-title"
          @keydown.esc="closeSearch"
        >
          <header class="search-dialog__header">
            <h2 id="search-dialog-title" class="search-dialog__title">搜索进房</h2>
            <button
              type="button"
              class="search-dialog__close"
              aria-label="关闭"
              @click="closeSearch"
            >
              <Icon name="close" />
            </button>
          </header>
          <p class="search-dialog__hint">选择平台，输入房间号或直播间链接进入播放页</p>

          <form class="search-dialog__form" @submit.prevent="goRoom">
            <div class="search-dialog__platforms" role="radiogroup" aria-label="平台">
              <label
                v-for="platform in enabledPlatforms"
                :key="platform.id"
                class="search-dialog__platform"
                :class="{ 'search-dialog__platform--active': selectedSite === platform.id }"
                :title="platform.label"
              >
                <input
                  v-model="selectedSite"
                  class="search-dialog__radio"
                  type="radio"
                  name="search-dialog-platform"
                  :value="platform.id"
                >
                <PlatformIcon :id="platform.id" size="sm" />
                <span class="search-dialog__platform-name">{{ platform.label }}</span>
              </label>
            </div>

            <div class="search-dialog__entry">
              <input
                ref="inputRef"
                v-model="roomInput"
                type="text"
                :placeholder="inputPlaceholder"
                autocomplete="off"
                inputmode="text"
              >
              <button type="submit" class="btn btn-primary">进入直播间</button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import Icon from "./Icon.vue";
import PlatformIcon from "./PlatformIcon.vue";
import { PLATFORMS } from "../config/platforms.js";
import { parseRoomId } from "../api/room.js";
import { useSearchDialog } from "../composables/useSearchDialog.js";

const router = useRouter();
const { searchOpen, searchDefaultSite, closeSearch } = useSearchDialog();

const selectedSite = ref("douyu");
const roomInput = ref("");
const inputRef = ref(null);

const enabledPlatforms = computed(() => PLATFORMS.filter((p) => p.enabled));

const inputPlaceholder = computed(() => {
  if (selectedSite.value === "douyin") return "房间号或 live.douyin.com/xxx";
  return "房间号或直播间链接";
});

watch(searchOpen, async (open) => {
  if (!open) {
    roomInput.value = "";
    return;
  }
  selectedSite.value = searchDefaultSite.value || "douyu";
  await nextTick();
  inputRef.value?.focus();
});

function goRoom() {
  const id = parseRoomId(roomInput.value);
  if (!id) return;
  closeSearch();
  router.push({ name: "play", params: { site: selectedSite.value, id } });
}
</script>

<style scoped>
.search-dialog {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: max(4.5rem, 12vh) 1rem 1.5rem;
  background: rgba(0, 0, 0, .52);
  backdrop-filter: blur(2px);
}

.search-dialog__panel {
  width: min(100%, 28rem);
  padding: 1rem 1.05rem 1.1rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel);
  color: var(--text);
  box-shadow: 0 16px 40px rgba(0, 0, 0, .32);
}

.search-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  margin-bottom: .35rem;
}

.search-dialog__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.search-dialog__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: 1rem;
  cursor: pointer;
  transition: color .15s, background .15s;
}

.search-dialog__close:hover {
  color: var(--text);
  background: var(--bg-soft);
}

.search-dialog__hint {
  margin: 0 0 1rem;
  color: var(--muted);
  font-size: .84rem;
  line-height: 1.4;
}

.search-dialog__form {
  display: flex;
  flex-direction: column;
  gap: .85rem;
}

.search-dialog__platforms {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
}

.search-dialog__platform {
  display: inline-flex;
  align-items: center;
  gap: .38rem;
  padding: .38rem .55rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-soft);
  cursor: pointer;
  transition: border-color .15s, background .15s, box-shadow .15s;
}

.search-dialog__platform--active {
  border-color: var(--amber);
  background: var(--primary-soft-08);
  box-shadow: 0 0 0 1px var(--primary-glow-22);
}

.search-dialog__radio {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.search-dialog__platform-name {
  font-size: .84rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1;
}

.search-dialog__entry {
  display: flex;
  align-items: center;
  gap: .55rem;
}

.search-dialog__entry input {
  flex: 1;
  min-width: 0;
}

.search-dialog-enter-active,
.search-dialog-leave-active {
  transition: opacity .18s ease;
}

.search-dialog-enter-active .search-dialog__panel,
.search-dialog-leave-active .search-dialog__panel {
  transition: transform .18s ease, opacity .18s ease;
}

.search-dialog-enter-from,
.search-dialog-leave-to {
  opacity: 0;
}

.search-dialog-enter-from .search-dialog__panel,
.search-dialog-leave-to .search-dialog__panel {
  transform: translateY(-8px) scale(.98);
  opacity: 0;
}

@media (max-width: 520px) {
  .search-dialog {
    align-items: flex-end;
    padding: 0;
  }

  .search-dialog__panel {
    width: 100%;
    border-radius: 12px 12px 0 0;
    border-bottom: none;
  }

  .search-dialog__entry {
    flex-direction: column;
    align-items: stretch;
  }

  .search-dialog__entry .btn {
    width: 100%;
  }
}
</style>
