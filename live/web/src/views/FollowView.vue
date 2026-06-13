<template>
  <AppLayout active-site="douyu">
    <div class="follow-page">
      <header class="follow-header">
        <h1>我的关注</h1>
      </header>

      <div class="follow-list scrolly">
        <FollowRoomList
          :rooms="sortedFollows"
          :loading="followStatusLoading"
          empty-text="暂无关注，在播放页点击 ♥ 添加"
          @select="goPlay"
          @unfollow="onUnfollow"
        />
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import FollowRoomList from "../components/FollowRoomList.vue";
import { useFollow } from "../composables/useFollow.js";
import { useFollowStatus } from "../composables/useFollowStatus.js";

const router = useRouter();
const { follows, unfollow } = useFollow();
const { sortedFollows, loading: followStatusLoading } = useFollowStatus(follows);

function goPlay(room) {
  router.push({ name: "play", params: { site: room.site, id: room.id } });
}

function onUnfollow(room) {
  unfollow(room.site, room.id);
}
</script>

<style scoped>
.follow-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  max-width: 720px;
}

.follow-header {
  padding: .75rem 1rem .5rem;
}

.follow-header h1 {
  margin: 0;
  font-size: 1.15rem;
}

.follow-list {
  flex: 1;
  min-height: 0;
}
</style>
