<template>
  <AppLayout :active-site="site">
    <main class="stage platform-stage">
      <section v-if="platform" class="platform-detail">
        <h2>{{ platform.label }}</h2>
        <p class="desc">{{ platform.description }}</p>
        <ul class="meta-list">
          <li>状态：<strong>{{ platform.enabled ? "已接入" : "占位 / 未接入" }}</strong></li>
          <li v-if="platform.defaultRoom">
            示例房间：<strong>{{ platform.defaultRoom }}</strong>
          </li>
          <li>解析：streamget 懒加载多档 FLV</li>
        </ul>
        <div class="card-actions">
          <RouterLink
            v-if="platform.enabled"
            :to="{ name: 'watch', params: { site: platform.id, room: platform.defaultRoom } }"
            class="card-link primary"
          >
            进入播放
          </RouterLink>
          <RouterLink to="/" class="card-link">返回首页</RouterLink>
        </div>
      </section>
      <section v-else class="platform-detail">
        <h2>未知平台</h2>
        <p class="desc">请从首页选择已支持的平台。</p>
        <RouterLink to="/" class="card-link">返回首页</RouterLink>
      </section>
    </main>
  </AppLayout>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import { getPlatform } from "../config/platforms";

const props = defineProps({
  site: { type: String, required: true },
});

const platform = computed(() => getPlatform(props.site));
</script>

<style scoped>
.platform-stage {
  display: block;
}

.platform-detail {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
  box-shadow: var(--shadow);
}

.platform-detail h2 {
  margin: 0 0 .5rem;
}

.desc {
  color: var(--muted);
  line-height: 1.6;
  margin: 0 0 1rem;
}

.meta-list {
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
  display: grid;
  gap: .35rem;
  font-size: .9rem;
}

.meta-list li { color: var(--muted); }
.meta-list strong { color: var(--text); font-weight: 600; }

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
