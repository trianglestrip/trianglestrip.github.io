/* global flvjs, Hls */

const SITES = [
  { id: "douyu", name: "斗鱼", icon: "🐟", defaultFormat: "flv", defaultEngine: "streamget" },
  { id: "huya", name: "虎牙", icon: "🐯", defaultFormat: "flv", defaultEngine: "lsf" },
  { id: "bilibili", name: "哔哩", icon: "📺", defaultFormat: "flv", defaultEngine: "lsf" },
  { id: "douyin", name: "抖音", icon: "🎵", defaultFormat: "flv", defaultEngine: "lsf" },
  { id: "twitch", name: "Twitch", icon: "🎮", defaultFormat: "m3u8", defaultEngine: "lsf" },
  { id: "kick", name: "Kick", icon: "🟢", defaultFormat: "m3u8", defaultEngine: "lsf" },
];

const state = {
  site: "douyu",
  room: "5720533",
  engine: "streamget",
  qualityIndex: 0,
  payload: null,
  player: null,
  hls: null,
  loopActive: false,
  config: { lsf_base: "http://127.0.0.1:8770" },
};

const els = {
  siteTabs: document.getElementById("siteTabs"),
  room: document.getElementById("room"),
  engine: document.getElementById("engine"),
  quality: document.getElementById("quality"),
  format: document.getElementById("format"),
  playBtn: document.getElementById("playBtn"),
  stopBtn: document.getElementById("stopBtn"),
  status: document.getElementById("status"),
  streamUrl: document.getElementById("streamUrl"),
  video: document.getElementById("player"),
};

function setStatus(text, ok = true) {
  els.status.className = "status " + (ok ? "ok" : "err");
  els.status.textContent = text;
}

function parseRoomId(value) {
  const text = value.trim();
  if (/^\d+$/.test(text)) return text;
  const match = text.match(
    /(?:douyu|huya|bilibili|live\.bilibili|douyin|twitch\.tv|kick\.com)\/?([\w-]+)/i
  );
  return match ? match[1] : text;
}

function renderSiteTabs() {
  els.siteTabs.innerHTML = "";
  for (const site of SITES) {
    const btn = document.createElement("button");
    btn.className = "tab" + (site.id === state.site ? " active" : "");
    btn.textContent = `${site.icon} ${site.name}`;
    btn.addEventListener("click", () => {
      state.site = site.id;
      els.format.value = site.defaultFormat || "flv";
      els.engine.value = site.defaultEngine || "lsf";
      state.engine = els.engine.value;
      syncDouyuControls();
      renderSiteTabs();
    });
    els.siteTabs.appendChild(btn);
  }
}

function syncDouyuControls() {
  const isDouyu = state.site === "douyu";
  els.engine.style.display = isDouyu ? "" : "none";
  els.quality.style.display = isDouyu && state.engine === "streamget" ? "" : "none";
}

function buildLsfPath(roomId, format) {
  return `/${state.site}/${encodeURIComponent(roomId)}?format=${encodeURIComponent(format)}`;
}

function destroyHls() {
  if (state.hls) {
    try { state.hls.destroy(); } catch (_) {}
    state.hls = null;
  }
}

function destroyFlv() {
  if (state.player) {
    try {
      state.player.pause();
      state.player.unload();
      state.player.detachMediaElement();
      state.player.destroy();
    } catch (_) {}
    state.player = null;
  }
}

function destroyPlayer() {
  state.loopActive = false;
  destroyFlv();
  destroyHls();
  els.video.removeAttribute("src");
  els.video.load();
}

function flvConfig() {
  return {
    enableWorker: false,
    enableStashBuffer: true,
    stashInitialSize: 512 * 1024,
    lazyLoad: false,
    deferLoadAfterSourceOpen: false,
    autoCleanupSourceBuffer: true,
    fixAudioTimestampGap: true,
  };
}

function playFlv(url, metaText) {
  if (!window.flvjs || !flvjs.isSupported()) {
    throw new Error("当前浏览器不支持 flv.js");
  }
  destroyFlv();
  state.loopActive = true;

  state.player = flvjs.createPlayer(
    { type: "flv", url, isLive: true, hasAudio: true, hasVideo: true },
    flvConfig()
  );
  state.player.attachMediaElement(els.video);
  state.player.on(flvjs.Events.ERROR, (_, info, detail) => {
    if (!state.loopActive) return;
    const msg = [info, detail && detail.code, detail && detail.msg].filter(Boolean).join(" | ");
    setStatus(`${metaText}\n播放错误: ${msg}`, false);
  });
  state.player.on(flvjs.Events.MEDIA_INFO, () => {
    state.player.play().catch(() => {});
    setStatus(`${metaText}\n播放中`, true);
  });
  state.player.load();
  state.player.play().catch(() => {});
}

async function playM3u8(url, metaText) {
  destroyHls();
  state.loopActive = true;
  if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({ enableWorker: false, lowLatencyMode: true });
    state.hls = hls;
    hls.loadSource(url);
    hls.attachMedia(els.video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      els.video.play().catch(() => {});
      setStatus(`${metaText}\n播放中 (HLS)`, true);
    });
    return;
  }
  if (els.video.canPlayType("application/vnd.apple.mpegurl")) {
    els.video.src = url;
    await els.video.play();
    setStatus(`${metaText}\n播放中`, true);
    return;
  }
  throw new Error("浏览器不支持 HLS");
}

async function fetchDouyuRoom(roomId) {
  const params = new URLSearchParams({ site: "douyu", room: roomId });
  const res = await fetch(`/api/room?${params}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function preferQualityIndex(streams) {
  for (const name of ["高清", "超清", "蓝光", "原画"]) {
    const idx = streams.findIndex((s) => (s.name || "").includes(name));
    if (idx >= 0) return idx;
  }
  return 0;
}

function fillQualityOptions(payload) {
  const streams = payload.streams || [];
  els.quality.innerHTML = "";
  if (!streams.length) {
    els.quality.disabled = true;
    return;
  }
  streams.forEach((item, index) => {
    const opt = document.createElement("option");
    opt.value = String(index);
    opt.textContent = item.name || `档位${index + 1}`;
    els.quality.appendChild(opt);
  });
  state.qualityIndex = preferQualityIndex(streams);
  els.quality.value = String(state.qualityIndex);
  els.quality.disabled = false;
}

function currentStreamPick(payload) {
  const streams = payload.streams || [];
  const index = Number(els.quality.value || state.qualityIndex) || 0;
  const stream = streams[index] || streams[0];
  const line = (stream?.lines || [])[0];
  const url = line?.url || payload.play_url || payload.flv_url || "";
  return { url, label: `${stream?.name || "默认"}/${line?.name || "线路"}` };
}

async function playStreamgetDouyu(roomId) {
  setStatus(`streamget 解析 ${roomId}…（首次可能 15–30s）`, true);
  const payload = await fetchDouyuRoom(roomId);
  if (!payload.is_live && !payload.status) throw new Error("房间未开播");
  state.payload = payload;
  fillQualityOptions(payload);

  const picked = currentStreamPick(payload);
  if (!picked.url) throw new Error("streamget 未返回播放地址");

  const metaText = `streamget | ${roomId} | ${picked.label}`;
  els.streamUrl.textContent = `CDN 直链: ${picked.url}`;
  playFlv(picked.url, metaText);
}

function playLsfDouyu(roomId) {
  const lsfUrl = `${state.config.lsf_base}/douyu/${roomId}?format=flv`;
  els.streamUrl.textContent = `VLC 打开: ${lsfUrl}`;
  setStatus(
    `斗鱼 lsf 在浏览器内通常无法播放（P2P 转 FLV）。\n` +
      `请用 VLC：媒体 → 打开网络串流 →\n${lsfUrl}\n` +
      `或切换为「streamget（开源）」后点播放。`,
    false
  );
}

async function playLsf(roomId, format) {
  const lsfUrl = `${state.config.lsf_base}${buildLsfPath(roomId, format)}`;
  const metaText = `lsf | ${state.site}/${roomId}`;
  els.streamUrl.textContent = `VLC 打开: ${lsfUrl}`;
  setStatus(
    `非斗鱼平台请用 VLC：媒体 → 打开网络串流 →\n${lsfUrl}\n` +
      `本页不再代理 lsf 流，浏览器内请用斗鱼 streamget 直链。`,
    false
  );
}

async function startPlayback() {
  const roomId = parseRoomId(els.room.value || state.room);
  state.room = roomId;
  state.engine = els.engine.value;
  const format = els.format.value || "flv";
  destroyPlayer();
  try {
    if (state.site === "douyu" && state.engine === "streamget") {
      await playStreamgetDouyu(roomId);
      return;
    }
    if (state.site === "douyu" && state.engine === "lsf") {
      playLsfDouyu(roomId);
      return;
    }
    setStatus(`连接 ${state.site} / ${roomId}…`);
    await playLsf(roomId, format);
  } catch (err) {
    setStatus(`播放失败: ${err.message || err}`, false);
  }
}

function applyUrlParams() {
  const params = new URLSearchParams(location.search);
  if (params.get("room")) {
    state.room = params.get("room");
    els.room.value = state.room;
  }
  const engine = params.get("engine");
  if (engine === "lsf" || engine === "streamget") {
    state.engine = engine;
    els.engine.value = engine;
  } else {
    state.engine = "streamget";
    els.engine.value = "streamget";
  }
  syncDouyuControls();
  return params.get("autoplay") === "1" || params.get("autoplay") === "true";
}

els.playBtn.addEventListener("click", () => startPlayback());
els.stopBtn.addEventListener("click", () => {
  destroyPlayer();
  setStatus("已停止");
});
els.room.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startPlayback();
});
els.engine.addEventListener("change", () => {
  state.engine = els.engine.value;
  syncDouyuControls();
});
els.quality.addEventListener("change", () => {
  state.qualityIndex = Number(els.quality.value) || 0;
  if (state.payload && state.engine === "streamget") startPlayback();
});

renderSiteTabs();
syncDouyuControls();
const shouldAutoplay = applyUrlParams();
els.room.value = state.room;
els.engine.value = state.engine;

fetch("/api/config", { cache: "no-store" })
  .then((r) => (r.ok ? r.json() : null))
  .then((cfg) => { if (cfg) state.config = cfg; })
  .finally(() => {
    if (shouldAutoplay) startPlayback();
    else setStatus("斗鱼默认 streamget 直链（无代理）；其他平台用 VLC 打开 lsf 地址。点「播放」开始。", true);
  });
