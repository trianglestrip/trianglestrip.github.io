import { PLATFORMS, PREFS_KEY, apiBase } from "./config.js";

const state = {
  site: "douyu",
  room: "5720533",
  qualityIndex: 0,
  lineIndex: 0,
  payload: null,
  player: null,
  playing: false,
  loading: false,
};

const els = {
  platformTabs: document.getElementById("platformTabs"),
  roomInput: document.getElementById("roomInput"),
  qualitySelect: document.getElementById("qualitySelect"),
  lineSelect: document.getElementById("lineSelect"),
  playBtn: document.getElementById("playBtn"),
  stopBtn: document.getElementById("stopBtn"),
  statusText: document.getElementById("statusText"),
  roomTitle: document.getElementById("roomTitle"),
  roomAnchor: document.getElementById("roomAnchor"),
  roomCover: document.getElementById("roomCover"),
  liveBadge: document.getElementById("liveBadge"),
  video: document.getElementById("player"),
  placeholder: document.getElementById("playerPlaceholder"),
};

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function savePrefs(patch) {
  const next = { ...loadPrefs(), ...patch };
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
}

function currentPlatform() {
  return PLATFORMS.find((item) => item.id === state.site) || PLATFORMS[0];
}

function setStatus(text, kind = "info") {
  els.statusText.textContent = text;
  els.statusText.className = "status" + (kind === "ok" ? " ok" : kind === "err" ? " err" : "");
}

function parseRoomId(value) {
  const text = value.trim();
  if (/^\d+$/.test(text)) return text;
  const match = text.match(/(?:douyu|huya|bilibili|douyin)\.com\/([a-zA-Z0-9]+)/);
  return match ? match[1] : text;
}

function qualityNames(payload) {
  const list = payload?.available_qualities || [];
  if (list.length) return list.map((item) => item.name || String(item));
  return (payload?.streams || []).map((item) => item.name || "默认");
}

function streamByName(payload, name) {
  return (payload?.streams || []).find((item) => item.name === name) || null;
}

function streamHasUrl(stream) {
  const url = stream?.lines?.[0]?.url || "";
  return !!url && !url.includes("edgesrv.com");
}

function findQualityIndex(names, preferred) {
  if (!names.length) return 0;
  if (preferred) {
    const exact = names.findIndex((name) => name === preferred);
    if (exact >= 0) return exact;
    const fuzzy = names.findIndex((name) => name.includes(preferred) || preferred.includes(name));
    if (fuzzy >= 0) return fuzzy;
  }
  for (const tag of ["高清", "超清", "蓝光"]) {
    const index = names.findIndex((name) => name.includes(tag));
    if (index >= 0) return index;
  }
  return 0;
}

function mergePayload(existing, incoming) {
  const streams = [...(existing?.streams || [])];
  for (const item of incoming.streams || []) {
    const index = streams.findIndex((entry) => entry.name === item.name);
    if (index >= 0) streams[index] = item;
    else streams.push(item);
  }
  return {
    ...(existing || {}),
    ...incoming,
    streams,
    available_qualities: incoming.available_qualities || existing?.available_qualities || [],
  };
}

function renderPlatforms() {
  els.platformTabs.innerHTML = "";
  for (const platform of PLATFORMS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "platform-btn" + (platform.id === state.site ? " active" : "");
    btn.textContent = platform.label;
    btn.disabled = !platform.enabled;
    btn.addEventListener("click", () => {
      if (!platform.enabled) return;
      state.site = platform.id;
      state.room = platform.defaultRoom || "";
      state.payload = null;
      savePrefs({ site: state.site, qualityName: "" });
      syncControls();
      renderPlatforms();
      setStatus(`${platform.label} · 输入房间号后播放`);
    });
    els.platformTabs.appendChild(btn);
  }
}

function syncControls() {
  els.roomInput.value = state.room;
}

function fillQualityOptions(payload, preferredName = "") {
  const names = qualityNames(payload);
  els.qualitySelect.innerHTML = "";
  els.lineSelect.innerHTML = "";

  if (!names.length) {
    const opt = document.createElement("option");
    opt.textContent = "默认";
    els.qualitySelect.appendChild(opt);
    els.qualitySelect.disabled = true;
    els.lineSelect.disabled = true;
    return;
  }

  names.forEach((name, index) => {
    const opt = document.createElement("option");
    opt.value = String(index);
    const loaded = streamHasUrl(streamByName(payload, name));
    opt.textContent = loaded ? name : `${name}（待加载）`;
    els.qualitySelect.appendChild(opt);
  });

  const prefs = loadPrefs();
  const preferred = preferredName || prefs.qualityName || "";
  state.qualityIndex = findQualityIndex(names, preferred);
  els.qualitySelect.value = String(state.qualityIndex);
  els.qualitySelect.disabled = false;

  const currentName = names[state.qualityIndex];
  fillLineOptions(streamByName(payload, currentName));
}

function fillLineOptions(stream) {
  els.lineSelect.innerHTML = "";
  const lines = stream?.lines || [];
  if (!lines.length) {
    els.lineSelect.disabled = true;
    return;
  }
  lines.forEach((line, index) => {
    const opt = document.createElement("option");
    opt.value = String(index);
    opt.textContent = line.name;
    els.lineSelect.appendChild(opt);
  });
  state.lineIndex = Math.min(state.lineIndex, lines.length - 1);
  els.lineSelect.value = String(state.lineIndex);
  els.lineSelect.disabled = false;
}

function updateRoomMeta(payload) {
  els.roomTitle.textContent = payload.title || payload.anchor_name || "未知标题";
  els.roomAnchor.textContent = payload.anchor_name || "";
  const live = payload.is_live || payload.status;
  els.liveBadge.textContent = live ? "直播中" : "未开播";
  els.liveBadge.className = "pill" + (live ? " live" : "");

  if (payload.cover) {
    els.roomCover.src = payload.cover;
    els.roomCover.hidden = false;
  } else {
    els.roomCover.hidden = true;
    els.roomCover.removeAttribute("src");
  }
}

function currentPlayUrl(payload) {
  const names = qualityNames(payload);
  const name = names[state.qualityIndex];
  const stream = streamByName(payload, name) || payload.streams?.[state.qualityIndex];
  if (stream) {
    const line = stream.lines?.[state.lineIndex] || stream.lines?.[0];
    if (line?.url && !line.url.includes("edgesrv.com")) return line.url;
  }
  for (const candidate of [payload.play_url, payload.flv_url, payload.m3u8_url]) {
    if (candidate && !candidate.includes("edgesrv.com")) return candidate;
  }
  return "";
}

async function fetchRoom({ mode = "lazy", quality } = {}) {
  const roomId = parseRoomId(els.roomInput.value || state.room);
  state.room = roomId;
  const params = new URLSearchParams({
    site: state.site,
    room: roomId,
    source: "local",
    mode,
  });
  if (quality) params.set("quality", quality);

  const res = await fetch(`${apiBase()}/api/room?${params.toString()}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function destroyPlayer() {
  state.playing = false;
  if (state.player) {
    try {
      state.player.pause();
      state.player.unload();
      state.player.detachMediaElement();
      state.player.destroy();
    } catch {}
    state.player = null;
  }
  els.placeholder.classList.remove("hidden");
}

function playFlv(url, metaText) {
  if (!window.flvjs || !flvjs.isSupported()) {
    throw new Error("当前浏览器不支持 flv.js");
  }
  destroyPlayer();
  state.playing = true;
  els.placeholder.classList.add("hidden");

  state.player = flvjs.createPlayer({
    type: "flv",
    url,
    isLive: true,
    hasAudio: true,
    hasVideo: true,
  }, {
    enableWorker: false,
    enableStashBuffer: true,
    stashInitialSize: 512 * 1024,
    lazyLoad: false,
    autoCleanupSourceBuffer: true,
    fixAudioTimestampGap: true,
  });

  state.player.attachMediaElement(els.video);
  state.player.on(flvjs.Events.ERROR, () => {
    if (!state.playing) return;
    setStatus(`${metaText}\n播放中断，可尝试切换线路`, "err");
  });
  state.player.on(flvjs.Events.MEDIA_INFO, () => {
    state.player.play().catch(() => {});
    setStatus(`${metaText}\n播放中`, "ok");
  });
  state.player.load();
  state.player.play().catch(() => {});
}

function buildMetaText(payload, url) {
  const names = qualityNames(payload);
  const q = names[state.qualityIndex] || "默认";
  const stream = streamByName(payload, q);
  const line = stream?.lines?.[state.lineIndex]?.name || stream?.lines?.[0]?.name || "";
  const cache = payload.cached ? " · 缓存" : "";
  return `${currentPlatform().label} ${state.room} · ${q} / ${line}${cache}\n${url.slice(0, 96)}…`;
}

async function ensureQualityLoaded(qualityName) {
  const existing = streamByName(state.payload, qualityName);
  if (streamHasUrl(existing)) return state.payload;
  setStatus(`加载档位 ${qualityName}…`);
  const incoming = await fetchRoom({ mode: "lazy", quality: qualityName });
  state.payload = mergePayload(state.payload, incoming);
  fillQualityOptions(state.payload, qualityName);
  return state.payload;
}

async function playSelection() {
  const names = qualityNames(state.payload);
  const qualityName = names[state.qualityIndex];
  if (!qualityName) throw new Error("未选择清晰度");

  savePrefs({ qualityName });
  const payload = await ensureQualityLoaded(qualityName);
  updateRoomMeta(payload);

  const url = currentPlayUrl(payload);
  if (!url) throw new Error(`档位 ${qualityName} 暂无播放地址`);
  playFlv(url, buildMetaText(payload, url));
}

async function playRoom() {
  if (state.loading) return;
  state.loading = true;
  destroyPlayer();
  state.payload = null;
  setStatus("正在解析…");

  try {
    const platform = currentPlatform();
    if (!platform.enabled) throw new Error("该平台尚未接入");

    const preferred = loadPrefs().qualityName || "";
    const payload = await fetchRoom({ mode: "lazy", quality: preferred || undefined });
    if (!payload.is_live && !payload.status) {
      updateRoomMeta(payload);
      throw new Error("房间未开播");
    }

    state.payload = payload;
    fillQualityOptions(payload, preferred);
    updateRoomMeta(payload);
    await playSelection();
  } catch (err) {
    setStatus(`失败: ${err.message}`, "err");
  } finally {
    state.loading = false;
  }
}

async function onQualityChange() {
  if (!state.payload || state.loading) return;
  state.loading = true;
  try {
    state.qualityIndex = Number(els.qualitySelect.value) || 0;
    const names = qualityNames(state.payload);
    const qualityName = names[state.qualityIndex];
    fillLineOptions(streamByName(state.payload, qualityName));
    destroyPlayer();
    await playSelection();
  } catch (err) {
    setStatus(`切换失败: ${err.message}`, "err");
  } finally {
    state.loading = false;
  }
}

function bindEvents() {
  els.playBtn.addEventListener("click", playRoom);
  els.stopBtn.addEventListener("click", () => {
    destroyPlayer();
    setStatus("已停止");
  });
  els.qualitySelect.addEventListener("change", onQualityChange);
  els.lineSelect.addEventListener("change", () => {
    state.lineIndex = Number(els.lineSelect.value) || 0;
    if (state.payload) {
      playSelection().catch((err) => setStatus(`切换线路失败: ${err.message}`, "err"));
    }
  });
  els.roomInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") playRoom();
  });
}

function bootstrap() {
  const prefs = loadPrefs();
  if (prefs.site && PLATFORMS.some((item) => item.id === prefs.site && item.enabled)) {
    state.site = prefs.site;
  }
  const platform = currentPlatform();
  state.room = platform.defaultRoom || "";
  renderPlatforms();
  syncControls();
  bindEvents();
  setStatus(`${platform.label} · 输入房间号后播放`);
}

bootstrap();
