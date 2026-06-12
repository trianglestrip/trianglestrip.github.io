<template>
  <template v-for="platform in PLATFORMS" :key="platform.id">
    <RouterLink
      v-if="platform.enabled"
      :to="platformLink(platform)"
      class="platform-btn"
      :class="{ active: platform.id === activeSite }"
    >
      {{ platform.label }}
    </RouterLink>
    <button
      v-else
      type="button"
      class="platform-btn"
      disabled
      :title="platform.description"
    >
      {{ platform.label }}
    </button>
  </template>
</template>

<script setup>
import { PLATFORMS } from "../config/platforms";

defineProps({
  activeSite: { type: String, default: "" },
});

function platformLink(platform) {
  if (platform.id === "douyu" || platform.id === "huya") {
    return { name: "watch", params: { site: platform.id, room: platform.defaultRoom } };
  }
  return { name: "platform", params: { site: platform.id } };
}
</script>
