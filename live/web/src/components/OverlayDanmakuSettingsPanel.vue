<template>
  <section class="overlay-settings">
    <h4 class="overlay-settings__title">飘屏弹幕</h4>
    <label class="overlay-settings__row overlay-settings__row--toggle">
      <span class="overlay-settings__label">显示</span>
      <input v-model="settings.show" type="checkbox" class="overlay-settings__check">
    </label>
    <label class="overlay-settings__row">
      <span class="overlay-settings__label">透明度</span>
      <input v-model.number="settings.opacity" class="overlay-settings__range" type="range" min="10" max="100">
      <span class="overlay-settings__value">{{ settings.opacity }}%</span>
    </label>
    <label class="overlay-settings__row">
      <span class="overlay-settings__label">字号</span>
      <input v-model.number="settings.fontSize" class="overlay-settings__range" type="range" min="12" max="36">
      <span class="overlay-settings__value">{{ settings.fontSize }}</span>
    </label>
    <label class="overlay-settings__row">
      <span class="overlay-settings__label">速度</span>
      <input v-model.number="settings.speed" class="overlay-settings__range" type="range" min="1" max="10">
      <span class="overlay-settings__value">{{ settings.speed }}</span>
    </label>
    <label class="overlay-settings__row">
      <span class="overlay-settings__label">区域</span>
      <select v-model.number="settings.area" class="overlay-settings__select">
        <option :value="1">全屏</option>
        <option :value="0.75">3/4</option>
        <option :value="0.5">半屏</option>
        <option :value="0.25">1/4</option>
      </select>
    </label>
  </section>
</template>

<script setup>
const settings = defineModel({ type: Object, required: true });
</script>

<style scoped>
.overlay-settings {
  display: flex;
  flex-direction: column;
  gap: .2rem;
  min-width: 0;
}

.overlay-settings__title {
  margin: 0;
  padding-bottom: .2rem;
  border-bottom: 1px solid var(--on-video-border);
  font-size: .76rem;
  font-weight: 600;
  color: var(--amber);
}

.overlay-settings__row {
  display: grid;
  grid-template-columns: 2.4rem minmax(0, 1fr) auto;
  align-items: center;
  gap: .22rem;
  min-height: 1.35rem;
  cursor: pointer;
}

.overlay-settings__row--toggle {
  grid-template-columns: 2.4rem 1fr;
}

.overlay-settings__label {
  font-size: .74rem;
  color: var(--muted);
  white-space: nowrap;
}

.overlay-settings__value {
  font-size: .7rem;
  font-variant-numeric: tabular-nums;
  color: var(--amber);
  justify-self: end;
}

.overlay-settings__select {
  grid-column: 2 / 4;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: .12rem .26rem;
  font-size: .74rem;
  border-radius: 4px;
}

.overlay-settings__check {
  grid-column: 2;
  width: 1rem;
  height: 1rem;
  margin: 0;
  accent-color: var(--amber);
  cursor: pointer;
}

.overlay-settings__range {
  width: 100%;
  min-width: 0;
  margin: 0;
  accent-color: var(--amber);
  cursor: pointer;
}
</style>
