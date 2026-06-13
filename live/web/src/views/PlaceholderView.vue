<template>
  <AppLayout active-site="douyu">
    <div class="placeholder-page">
      <Icon :name="iconName" class="placeholder-icon" />
      <h1>{{ title }}</h1>
      <p>{{ message }}</p>
      <RouterLink to="/douyu" class="btn btn-primary">返回首页</RouterLink>
    </div>
  </AppLayout>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import Icon from "../components/Icon.vue";

const route = useRoute();

const meta = computed(() => {
  if (route.path === "/follow") {
    return { icon: "heart", title: "关注", message: "关注列表尚未接入，与 Lemon Live 一致预留入口。" };
  }
  if (route.path === "/search") {
    return { icon: "search", title: "搜索", message: "搜索功能尚未接入。" };
  }
  return { icon: "user", title: "用户", message: "用户中心尚未接入。" };
});

const iconName = computed(() => meta.value.icon);
const title = computed(() => meta.value.title);
const message = computed(() => meta.value.message);
</script>

<style scoped>
.placeholder-page {
  display: grid;
  place-content: center;
  gap: .75rem;
  min-height: 50vh;
  text-align: center;
  padding: 2rem 1rem;
}

.placeholder-icon {
  font-size: 2.5rem;
  line-height: 1;
  justify-self: center;
  color: var(--amber);
}

.placeholder-page h1 {
  margin: 0;
  font-size: 1.25rem;
}

.placeholder-page p {
  margin: 0;
  color: var(--muted);
  max-width: 22rem;
}

.placeholder-page .btn {
  justify-self: center;
  margin-top: .5rem;
}
</style>
