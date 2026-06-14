<template>
  <div
    class="range-slider__track"
    :class="[
      size === 'compact' ? 'range-slider__track--compact' : 'range-slider__track--fill',
      { 'range-slider__track--disabled': disabled },
    ]"
    role="slider"
    :tabindex="disabled ? -1 : 0"
    :aria-valuenow="modelValue"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-label="ariaLabel"
    :aria-disabled="disabled || undefined"
    :style="{ '--range-ratio': ratio }"
    @pointerdown="onPointerDown"
    @keydown="onKeydown"
  >
    <div class="range-slider__fill" aria-hidden="true"></div>
    <div class="range-slider__thumb" aria-hidden="true"></div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const THUMB = 10;

const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  disabled: { type: Boolean, default: false },
  ariaLabel: { type: String, default: "" },
  size: {
    type: String,
    default: "fill",
    validator: (v) => v === "fill" || v === "compact",
  },
});

const emit = defineEmits(["update:modelValue"]);

const ratio = computed(() => {
  const range = props.max - props.min;
  if (range <= 0) return 0;
  return Math.min(1, Math.max(0, (Number(props.modelValue) - props.min) / range));
});

function clampValue(value) {
  const next = Math.min(props.max, Math.max(props.min, value));
  if (props.step > 0 && props.step < 1) {
    return Math.round(next / props.step) * props.step;
  }
  if (props.step >= 1) {
    return Math.round(next / props.step) * props.step;
  }
  return next;
}

function valueFromPointer(clientX, trackEl) {
  const rect = trackEl.getBoundingClientRect();
  const inner = Math.max(rect.width - THUMB, 1);
  const offset = Math.min(Math.max(clientX - rect.left - THUMB / 2, 0), inner);
  const raw = props.min + (offset / inner) * (props.max - props.min);
  return clampValue(raw);
}

function emitFromPointer(event) {
  const track = event.currentTarget;
  if (!(track instanceof HTMLElement) || props.disabled) return;
  emit("update:modelValue", valueFromPointer(event.clientX, track));
}

function onPointerDown(event) {
  if (event.button !== 0 || props.disabled) return;
  const track = event.currentTarget;
  if (!(track instanceof HTMLElement)) return;
  event.preventDefault();
  emitFromPointer(event);
  track.setPointerCapture(event.pointerId);
  const onMove = (moveEvent) => emitFromPointer(moveEvent);
  const onUp = (upEvent) => {
    track.releasePointerCapture(upEvent.pointerId);
    track.removeEventListener("pointermove", onMove);
    track.removeEventListener("pointerup", onUp);
    track.removeEventListener("pointercancel", onUp);
  };
  track.addEventListener("pointermove", onMove);
  track.addEventListener("pointerup", onUp);
  track.addEventListener("pointercancel", onUp);
}

function onKeydown(event) {
  if (props.disabled) return;
  let next = Number(props.modelValue);
  const delta = props.step > 0 ? props.step : 1;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") next += delta;
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= delta;
  else return;
  event.preventDefault();
  emit("update:modelValue", clampValue(next));
}
</script>

<style scoped>
.range-slider__track {
  --range-thumb: 10px;
  --range-thumb-half: calc(var(--range-thumb) / 2);
  position: relative;
  height: var(--range-thumb);
  flex-shrink: 0;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  outline: none;
}

.range-slider__track--fill {
  width: 100%;
  min-width: 0;
}

.range-slider__track--compact {
  width: 4.5rem;
}

.range-slider__track--disabled {
  opacity: .45;
  cursor: not-allowed;
  pointer-events: none;
}

.range-slider__track::before {
  content: "";
  position: absolute;
  left: var(--range-thumb-half);
  right: var(--range-thumb-half);
  top: 50%;
  height: .2rem;
  transform: translateY(-50%);
  border-radius: 999px;
  background: var(--play-range-track);
  pointer-events: none;
}

.range-slider__fill {
  position: absolute;
  left: var(--range-thumb-half);
  top: 50%;
  width: calc((100% - var(--range-thumb)) * var(--range-ratio, 0));
  height: .2rem;
  transform: translateY(-50%);
  border-radius: 999px;
  background: var(--amber);
  pointer-events: none;
}

.range-slider__thumb {
  position: absolute;
  left: calc(var(--range-thumb-half) + (100% - var(--range-thumb)) * var(--range-ratio, 0));
  top: 50%;
  width: var(--range-thumb);
  height: var(--range-thumb);
  border: 2px solid #1a1a1a;
  border-radius: 50%;
  background: var(--amber);
  box-sizing: border-box;
  box-shadow: 0 0 0 1px var(--primary-ring);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.range-slider__track:focus-visible .range-slider__thumb {
  box-shadow: 0 0 0 2px var(--primary-ring);
}

@media (max-width: 640px) {
  .range-slider__track--compact {
    width: 3.25rem;
  }
}
</style>
