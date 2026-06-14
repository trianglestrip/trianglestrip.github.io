<template>
  <Teleport to="#play-frame">
    <Transition name="immersive-side">
      <div
        v-if="open"
        class="play-immersive-side on-video-surface"
      >
        <aside
          class="play-immersive-side__panel"
          role="dialog"
          aria-label="关注与推荐"
          @click.stop
        >
          <PlayFollowRecommendTabs
            show-tab-bar
            :site="site"
            :room-id="roomId"
            :room-category="roomCategory"
            :room-cid="roomCid"
            :room-pid="roomPid"
            :follow-list="followList"
            :secondary-ready="secondaryReady"
            @play-room="onPlayRoom"
          />
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import PlayFollowRecommendTabs from "./PlayFollowRecommendTabs.vue";

defineProps({
  open: { type: Boolean, default: false },
  site: { type: String, default: "" },
  roomId: { type: String, default: "" },
  roomCategory: { type: String, default: "" },
  roomCid: { type: String, default: "" },
  roomPid: { type: String, default: "" },
  followList: { type: Array, default: () => [] },
  secondaryReady: { type: Boolean, default: true },
});

const emit = defineEmits(["update:open", "play-room"]);

function onPlayRoom(room) {
  emit("play-room", room);
  emit("update:open", false);
}
</script>

<style scoped>
.play-immersive-side {
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: auto;
}

.play-immersive-side__panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(17.5rem, 78vw);
  max-width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--on-video-bg-panel);
  border-left: 1px solid var(--on-video-border);
  box-shadow: -6px 0 28px rgba(0, 0, 0, .55);
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: auto;
}

.play-immersive-side__panel :deep(.follow-recommend) {
  height: 100%;
}

.play-immersive-side__panel :deep(.follow-recommend__tabs) {
  border-bottom-color: var(--on-video-border);
}

.play-immersive-side__panel :deep(.follow-recommend__tabs button) {
  color: var(--on-video-muted);
  font-size: .96rem;
  padding-top: .34rem;
  padding-bottom: .36rem;
}

.play-immersive-side__panel :deep(.follow-recommend__tabs button.active) {
  color: var(--amber);
}

.immersive-side-enter-active,
.immersive-side-leave-active {
  transition: opacity .18s ease;
}

.immersive-side-enter-active .play-immersive-side__panel,
.immersive-side-leave-active .play-immersive-side__panel {
  transition: transform .22s ease;
}

.immersive-side-enter-from,
.immersive-side-leave-to {
  opacity: 0;
}

.immersive-side-enter-from .play-immersive-side__panel,
.immersive-side-leave-to .play-immersive-side__panel {
  transform: translateX(100%);
}
</style>
