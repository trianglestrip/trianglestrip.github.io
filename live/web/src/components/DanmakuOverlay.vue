<template>
  <canvas v-show="settings.show && streamActive" ref="canvasRef" class="danmaku-canvas"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from "vue";

const props = defineProps({
  messages: { type: Array, required: true },
  settings: { type: Object, required: true },
  streamActive: { type: Boolean, default: false },
  playing: { type: Boolean, default: false },
});

const canvasRef = ref(null);
let ctx = null;
let activeDanmakus = [];
let rafId = null;
let lastProcessedIndex = 0;

function measureText(text, fontSize) {
  if (!ctx) return 0;
  ctx.font = `bold ${fontSize}px sans-serif`;
  return ctx.measureText(text).width;
}

function spawnDanmaku(msg) {
  if (!canvasRef.value || !props.settings.show) return;
  const canvas = canvasRef.value;
  const fontSize = Number(props.settings.fontSize) || 20;
  const speed = Number(props.settings.speed) || 5;
  const textWidth = measureText(msg.text, fontSize);

  const trackHeight = fontSize + 8;
  const areaRatio = Number(props.settings.area) || 1;
  const maxTracks = Math.max(1, Math.floor((canvas.height * areaRatio) / trackHeight));

  let selectedTrack = Math.floor(Math.random() * maxTracks);
  for (let i = 0; i < maxTracks; i += 1) {
    const track = (selectedTrack + i) % maxTracks;
    const y = track * trackHeight + fontSize;
    const itemsInTrack = activeDanmakus.filter((d) => d.y === y);
    if (itemsInTrack.length === 0) {
      selectedTrack = track;
      break;
    }
    const lastItem = itemsInTrack[itemsInTrack.length - 1];
    if (lastItem && lastItem.x + lastItem.width < canvas.width - 50) {
      selectedTrack = track;
      break;
    }
  }

  activeDanmakus.push({
    text: msg.text,
    x: canvas.width,
    y: selectedTrack * trackHeight + fontSize,
    width: textWidth,
    speed: speed * (canvas.width / 1000) * 0.5 + Math.random() * 0.5,
    color: msg.color || "#ffffff",
  });
}

function resize() {
  if (!canvasRef.value?.parentElement) return;
  const canvas = canvasRef.value;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width));
  canvas.height = Math.max(1, Math.floor(rect.height));
}

function loop() {
  if (!canvasRef.value || !ctx) return;
  const canvas = canvasRef.value;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (props.settings.show && props.streamActive && props.playing) {
    ctx.globalAlpha = (Number(props.settings.opacity) || 100) / 100;
    ctx.font = `bold ${props.settings.fontSize}px sans-serif`;
    ctx.textBaseline = "bottom";

    for (let i = activeDanmakus.length - 1; i >= 0; i -= 1) {
      const d = activeDanmakus[i];
      d.x -= d.speed;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.strokeText(d.text, d.x, d.y);
      ctx.fillStyle = d.color;
      ctx.fillText(d.text, d.x, d.y);
      if (d.x + d.width < 0) {
        activeDanmakus.splice(i, 1);
      }
    }
  }

  rafId = requestAnimationFrame(loop);
}

watch(
  () => props.messages,
  (newMsgs) => {
    if (!props.settings.show || !props.playing) {
      lastProcessedIndex = newMsgs.length;
      return;
    }
    if (lastProcessedIndex < newMsgs.length) {
      for (let i = lastProcessedIndex; i < newMsgs.length; i += 1) {
        spawnDanmaku(newMsgs[i]);
      }
      lastProcessedIndex = newMsgs.length;
    } else if (newMsgs.length < lastProcessedIndex) {
      lastProcessedIndex = newMsgs.length;
      activeDanmakus = [];
    }
  },
  { deep: true },
);

watch(
  () => props.settings.show,
  (show) => {
    if (!show) activeDanmakus = [];
  },
);

onMounted(() => {
  ctx = canvasRef.value.getContext("2d");
  window.addEventListener("resize", resize);
  resize();
  loop();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resize);
  if (rafId) cancelAnimationFrame(rafId);
});
</script>

<style scoped>
.danmaku-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}
</style>
