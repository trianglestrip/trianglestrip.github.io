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
/** 已飘屏的消息 id，避免按数组下标追踪时在 trim/暂停后漏发或停发 */
const spawnedIds = new Set();
/** 暂无可用轨道时排队，每帧重试 */
const pendingSpawn = [];
const PENDING_SPAWN_LIMIT = 80;
let layout = { dpr: 1, cssW: 1, cssH: 1 };

function minTrackGap(fontSize) {
  return Math.max(28, Math.round(fontSize * 1.1));
}

function trackHeightFor(fontSize) {
  return Math.ceil(fontSize * 1.52 + 6);
}

function danmakuFontFamily() {
  const fromVar = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-sans")
    .trim();
  if (fromVar) return fromVar;
  return getComputedStyle(document.documentElement).fontFamily;
}

function danmakuFont(fontSize) {
  return `normal ${fontSize}px ${danmakuFontFamily()}`;
}

function measureText(text, fontSize) {
  if (!ctx) return 0;
  ctx.font = danmakuFont(fontSize);
  return ctx.measureText(text).width;
}

function danmakuSpeed(speedSetting, canvasWidth) {
  const speed = Number(speedSetting) || 5;
  return speed * (canvasWidth / 1000) * 0.5 + Math.random() * 0.35;
}

function trackMetrics(fontSize) {
  const trackHeight = trackHeightFor(fontSize);
  const areaRatio = Number(props.settings.area) || 1;
  const maxTracks = Math.max(1, Math.floor((layout.cssH * areaRatio) / trackHeight));
  return { trackHeight, maxTracks };
}

function itemsOnTrack(track) {
  return activeDanmakus.filter((d) => d.track === track);
}

/** 新弹幕从右侧进入时，是否与轨道上已有弹幕发生碰撞（含速度差追尾） */
function canSpawnOnTrack(track, newWidth, newSpeed, fontSize) {
  const gap = minTrackGap(fontSize);
  const newX = layout.cssW;
  for (const d of itemsOnTrack(track)) {
    if (newX < d.x + d.width + gap) return false;

    if (newSpeed > d.speed + 0.02) {
      const tailGap = newX - d.x - d.width - gap;
      if (tailGap <= 0) return false;
      const catchTime = tailGap / (newSpeed - d.speed);
      const tailAtCatch = d.x - d.speed * catchTime + d.width;
      if (tailAtCatch > 0) return false;
    }
  }
  return true;
}

function pickTrack(fontSize, textWidth, speed) {
  const { maxTracks } = trackMetrics(fontSize);
  const start = Math.floor(Math.random() * maxTracks);
  for (let i = 0; i < maxTracks; i += 1) {
    const track = (start + i) % maxTracks;
    if (canSpawnOnTrack(track, textWidth, speed, fontSize)) return track;
  }
  return -1;
}

function spawnDanmaku(msg) {
  if (!canvasRef.value || !props.settings.show) return false;
  const fontSize = Number(props.settings.fontSize) || 20;
  const textWidth = measureText(msg.text, fontSize);
  const speed = danmakuSpeed(props.settings.speed, layout.cssW);
  const track = pickTrack(fontSize, textWidth, speed);
  if (track < 0) return false;

  const { trackHeight } = trackMetrics(fontSize);
  activeDanmakus.push({
    text: msg.text,
    track,
    x: layout.cssW,
    y: track * trackHeight + trackHeight / 2,
    width: textWidth,
    speed,
    color: msg.color || "#ffffff",
  });
  return true;
}

function enqueuePendingSpawn(msg) {
  if (pendingSpawn.some((item) => item.id === msg.id)) return;
  pendingSpawn.push(msg);
  if (pendingSpawn.length > PENDING_SPAWN_LIMIT) {
    pendingSpawn.splice(0, pendingSpawn.length - PENDING_SPAWN_LIMIT);
  }
}

function flushPendingSpawn() {
  if (!pendingSpawn.length || !props.settings.show || !props.playing) return;
  const remain = [];
  for (const msg of pendingSpawn) {
    if (!spawnDanmaku(msg)) remain.push(msg);
  }
  pendingSpawn.length = 0;
  pendingSpawn.push(...remain);
}

function resize() {
  if (!canvasRef.value?.parentElement || !ctx) return;
  const canvas = canvasRef.value;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  layout.dpr = dpr;
  layout.cssW = Math.max(1, rect.width);
  layout.cssH = Math.max(1, rect.height);
  canvas.width = Math.max(1, Math.floor(layout.cssW * dpr));
  canvas.height = Math.max(1, Math.floor(layout.cssH * dpr));
  canvas.style.width = `${layout.cssW}px`;
  canvas.style.height = `${layout.cssH}px`;
}

function drawDanmakuText(d, fontSize) {
  ctx.font = danmakuFont(fontSize);
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = d.color;
  ctx.fillText(d.text, d.x, d.y);
  ctx.shadowColor = "transparent";
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function loop() {
  if (!canvasRef.value || !ctx) return;
  ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
  ctx.clearRect(0, 0, layout.cssW, layout.cssH);

  if (props.settings.show && props.streamActive && props.playing) {
    const fontSize = Number(props.settings.fontSize) || 20;
    ctx.globalAlpha = (Number(props.settings.opacity) || 100) / 100;

    for (let i = activeDanmakus.length - 1; i >= 0; i -= 1) {
      const d = activeDanmakus[i];
      d.x -= d.speed;
      drawDanmakuText(d, fontSize);
      if (d.x + d.width < 0) {
        activeDanmakus.splice(i, 1);
      }
    }

    flushPendingSpawn();
  }

  rafId = requestAnimationFrame(loop);
}

function spawnPendingMessages(msgs) {
  if (!props.settings.show || !props.playing || !msgs?.length) return;
  for (const msg of msgs) {
    if (!msg?.id || spawnedIds.has(msg.id)) continue;
    spawnedIds.add(msg.id);
    if (!spawnDanmaku(msg)) enqueuePendingSpawn(msg);
  }
  if (spawnedIds.size > 500) {
    const overflow = spawnedIds.size - 300;
    let removed = 0;
    for (const id of spawnedIds) {
      spawnedIds.delete(id);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}

watch(
  () => props.messages,
  (newMsgs) => {
    if (!newMsgs.length) {
      spawnedIds.clear();
      activeDanmakus = [];
      pendingSpawn.length = 0;
      return;
    }
    spawnPendingMessages(newMsgs);
  },
  { deep: true },
);

watch(
  () => props.playing,
  (playing) => {
    if (playing) spawnPendingMessages(props.messages);
  },
);

watch(
  () => props.settings.show,
  (show) => {
    if (!show) {
      activeDanmakus = [];
      pendingSpawn.length = 0;
      return;
    }
    spawnPendingMessages(props.messages);
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
  image-rendering: auto;
}
</style>
