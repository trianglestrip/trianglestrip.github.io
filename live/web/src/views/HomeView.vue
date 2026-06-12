<template>
  <AppLayout>
    <main class="stage home-stage">
      <section class="intro-block">
        <h2 class="page-title">选择平台</h2>
        <p class="page-desc">参考 Lemon Live 布局，对接本机 streamget 解析 API。支持斗鱼、虎牙 FLV 直链播放。</p>
      </section>
      <div class="home-grid">
        <article
          v-for="platform in PLATFORMS"
          :key="platform.id"
          class="platform-card"
          :class="{ disabled: !platform.enabled }"
        >
          <h2>{{ platform.label }}</h2>
          <p>{{ platform.description }}</p>
          <div class="card-actions">
            <RouterLink
              v-if="platform.enabled"
              :to="{ name: 'watch', params: { site: platform.id, room: platform.defaultRoom } }"
              class="card-link primary"
            >
              立即观看
            </RouterLink>
            <RouterLink
              :to="{ name: 'platform', params: { site: platform.id } }"
              class="card-link"
            >
              平台详情
            </RouterLink>
          </div>
        </article>
      </div>
    </main>
  </AppLayout>
</template>

<script setup>
import { RouterLink } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import { PLATFORMS } from "../config/platforms";
</script>

<style scoped>
.home-stage {
  display: block;
}

.intro-block {
  margin-bottom: 1rem;
}

.page-title {
  margin: 0 0 .35rem;
  font-size: 1.15rem;
}

.page-desc {
  margin: 0;
  color: var(--muted);
  font-size: .9rem;
  line-height: 1.55;
}

.home-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.platform-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.1rem;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: .65rem;
}

.platform-card.disabled { opacity: .55; }

.platform-card h2 {
  margin: 0;
  font-size: 1.05rem;
}

.platform-card p {
  margin: 0;
  color: var(--muted);
  font-size: .88rem;
  line-height: 1.5;
  flex: 1;
}

.card-actions {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
}

.card-link {
  display: inline-block;
  padding: .45rem .85rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-soft);
  color: var(--text);
  text-decoration: none;
  font-size: .85rem;
}

.card-link:hover {
  border-color: var(--lemon);
  color: var(--lemon);
}

.card-link.primary {
  border: none;
  background: linear-gradient(145deg, #ffe066, #e8b923);
  color: #1a1400;
  font-weight: 700;
}
</style>
