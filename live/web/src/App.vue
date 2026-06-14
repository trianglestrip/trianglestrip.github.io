<template>
  <RouterView />
  <SearchDialog />
  <ToastHost :on-navigate="onToastClick" />
</template>

<script setup>
import { RouterView } from "vue-router";
import SearchDialog from "./components/SearchDialog.vue";
import ToastHost from "./components/ToastHost.vue";
import { useFollowLiveNotify } from "./composables/useFollowLiveNotify.js";

const { onToastClick } = useFollowLiveNotify();
</script>
