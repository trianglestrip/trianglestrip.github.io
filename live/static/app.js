/* global flvjs */

const SITES = [
  { id: "douyu", name: "斗鱼", icon: "🐟" },
  { id: "huya", name: "虎牙", icon: "🐯" },
  { id: "bilibili", name: "哔哩", icon: "📺" },
  { id: "douyin", name: "抖音", icon: "🎵" },
];

const SEGMENT_BATCH = 5;

const state = {
  site: "douyu",
  source: "local",
  room: "9999",
  qualityIndex: 0,
  lineIndex: 0,
  payload: null,
  player: null,
  useProxy: true,
  loopActive: false,
  blobUrl: null,
};

const els = {
  siteTabs: document.getElementById("siteTabs"),
  room: document.getElementById("room"),
  source: document.getElementById("source"),
  proxyMode: document.getElementById("proxyMode"),
  quality: document.getElementById("quality"),
  line: document.getElementById("line"),
  playBtn: document.getElementById("playBtn"),
  stopBtn: document.getElementById("stopBtn"),
  status: document.getElementById("status"),
  roomTitle: document.getElementById("roomTitle"),
  roomAnchor: document.getElementById("roomAnchor"),
  roomCover: document.getElementById("roomCover"),
  liveBadge: document.getElementById("liveBadge"),
  video: document.getElementById("player"),
};

function setStatus(text, ok = true) {
  els.status.className = "status " + (ok ? "ok" : "err");
  els.status.textContent = text;
}

function parseRoomId(value) {
  const text = value.trim();
  if (/^\d+$/.test(text)) return text;
  const match = text.match(/(?:douyu|huya|bilibili|douyin)\.com\/([a-zA-Z0-9]+)/);
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
      renderSiteTabs();
    });
    els.siteTabs.appendChild(btn);
  }
}

async function fetchRoom() {
  const roomId = parseRoomId(els.room.value || state.room);
  state.room = roomId;
  const params = new URLSearchParams({
    site: state.site,
    room: roomId,
    source: state.source,
    quality: "OD",
  });
  const res = await fetch(`/api/room?${params.toString()}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function fillSelectors(payload) {
  const streams = payload.streams || [];
  els.quality.innerHTML = "";
  els.line.innerHTML = "";

  if (!streams.length) {
    const opt = document.createElement("option");
    opt.textContent = "默认";
    opt.value = "0";
    els.quality.appendChild(opt);
    els.line.disabled = true;
    return;
  }

  streams.forEach((item, index) => {
    const opt = document.createElement("option");
    opt.value = String(index);
    opt.textContent = item.name;
    els.quality.appendChild(opt);
  });

  state.qualityIndex = Math.min(state.qualityIndex, streams.length - 1);
  els.quality.value = String(state.qualityIndex);
  fillLines(streams[state.qualityIndex]);
}

function fillLines(stream) {
  els.line.innerHTML = "";
  const lines = stream?.lines || [];
  if (!lines.length) {
    els.line.disabled = true;
    return;
  }
  els.line.disabled = false;
  lines.forEach((item, index) => {
    const opt = document.createElement("option");
    opt.value = String(index);
    opt.textContent = item.name;
    els.line.appendChild(opt);
  });
  state.lineIndex = Math.min(state.lineIndex, lines.length - 1);
  els.line.value = String(state.lineIndex);
}

function currentPlayUrl(payload) {
  const streams = payload.streams || [];
  if (streams.length) {
    const stream = streams[state.qualityIndex] || streams[0];
    const line = stream.lines[state.lineIndex] || stream.lines[0];
    if (line?.url) return line.url;
  }
  return payload.play_url || payload.flv_url || payload.m3u8_url || "";
}

function collectBackupUrls(payload, directUrl) {
  const urls = [];
  for (const group of payload.streams || []) {
    for (const line of group.lines || []) {
      if (line.url && line.url !== directUrl) urls.push(line.url);
    }
  }
  for (const item of payload.backup_urls || []) {
    if (item && item !== directUrl && !urls.includes(item)) urls.push(item);
  }
  return urls;
}

function revokeBlob() {
  if (state.blobUrl) {
    URL.revokeObjectURL(state.blobUrl);
    state.blobUrl = null;
  }
}

function destroyPlayerInstance() {
  revokeBlob();
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
  destroyPlayerInstance();
}

function ensureFlvJs() {
  if (!window.flvjs || !flvjs.isSupported()) {
    throw new Error("当前浏览器不支持 flv.js");
  }
}

function segmentUrl(proxyBase) {
  return `${proxyBase}&mode=segment&_ts=${Date.now()}`;
}

function isFlvBuffer(buffer) {
  if (!buffer || buffer.byteLength < 4) return false;
  const head = new Uint8Array(buffer, 0, 4);
  return head[0] === 0x46 && head[1] === 0x4c && head[2] === 0x56;
}

async function fetchSegment(proxyBase) {
  const res = await fetch(segmentUrl(proxyBase), { cache: "no-store" });
  if (!res.ok) throw new Error(`代理段 HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  if (!isFlvBuffer(buffer)) throw new Error("代理返回非 FLV");
  return buffer;
}

function concatFlvSegments(buffers) {
  const FLV_HEADER_SIZE = 13;
  const parts = [];
  let total = 0;
  for (let i = 0; i < buffers.length; i += 1) {
    const bytes = new Uint8Array(buffers[i]);
    const slice = i === 0 ? bytes : bytes.subarray(
      bytes.length > FLV_HEADER_SIZE && isFlvBuffer(bytes.buffer) ? FLV_HEADER_SIZE : 0,
    );
    parts.push(slice);
    total += slice.length;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return merged.buffer;
}

async function fetchMergedSegments(proxyBase) {
  const buffers = await Promise.all(
    Array.from({ length: SEGMENT_BATCH }, () => fetchSegment(proxyBase)),
  );
  return concatFlvSegments(buffers);
}

function playBuffer(buffer) {
  return new Promise((resolve, reject) => {
    ensureFlvJs();
    destroyPlayerInstance();

    state.blobUrl = URL.createObjectURL(new Blob([buffer], { type: "video/x-flv" }));
    state.player = flvjs.createPlayer({
      type: "flv",
      url: state.blobUrl,
      isLive: false,
      hasAudio: true,
      hasVideo: true,
    }, {
      enableWorker: false,
      enableStashBuffer: false,
      lazyLoad: false,
      deferLoadAfterSourceOpen: false,
    });

    const cleanup = () => {
      state.player.off(flvjs.Events.LOADING_COMPLETE, onComplete);
      state.player.off(flvjs.Events.ERROR, onError);
      state.player.off(flvjs.Events.MEDIA_INFO, onMediaInfo);
    };
    const onComplete = () => {
      cleanup();
      resolve();
    };
    const onError = (_, info, detail) => {
      cleanup();
      const msg = [info, detail && detail.code, detail && detail.msg].filter(Boolean).join(" | ");
      reject(new Error(msg || "flv error"));
    };
    const onMediaInfo = () => {
      state.player.play().catch(() => {});
    };

    state.player.attachMediaElement(els.video);
    state.player.on(flvjs.Events.LOADING_COMPLETE, onComplete);
    state.player.on(flvjs.Events.ERROR, onError);
    state.player.on(flvjs.Events.MEDIA_INFO, onMediaInfo);
    state.player.load();
  });
}

function playDirect(url) {
  ensureFlvJs();
  destroyPlayerInstance();
  state.player = flvjs.createPlayer({
    type: "flv",
    url,
    isLive: true,
    hasAudio: true,
    hasVideo: true,
  }, {
    enableWorker: false,
    enableStashBuffer: true,
    lazyLoad: false,
  });
  state.player.attachMediaElement(els.video);
  state.player.on(flvjs.Events.ERROR, (_, info, detail) => {
    const msg = [info, detail && detail.code, detail && detail.msg].filter(Boolean).join(" | ");
    setStatus(`直连播放出错: ${msg}\n建议改回「代理播放」`, false);
  });
  state.player.load();
  state.player.play().catch(() => {});
}

async function proxyPlaybackLoop(proxyBase, metaText) {
  state.loopActive = true;
  let batch = 0;
  let nextBatchPromise = fetchMergedSegments(proxyBase);

  while (state.loopActive) {
    let merged;
    try {
      merged = await nextBatchPromise;
    } catch (err) {
      if (!state.loopActive) break;
      setStatus(`缓存失败: ${err.message}\n0.5 秒后重试…`, false);
      await new Promise((r) => setTimeout(r, 500));
      nextBatchPromise = fetchMergedSegments(proxyBase);
      continue;
    }

    nextBatchPromise = fetchMergedSegments(proxyBase);
    batch += 1;
    const mb = (merged.byteLength / (1024 * 1024)).toFixed(2);
    setStatus(`${metaText}\n批次 ${batch} | 已缓存 ${SEGMENT_BATCH} 段 (~${mb} MB)`, true);

    try {
      await playBuffer(merged);
    } catch (err) {
      if (!state.loopActive) break;
      setStatus(`播放中断: ${err.message}\n0.5 秒后重试…`, false);
      await new Promise((r) => setTimeout(r, 500));
      nextBatchPromise = fetchMergedSegments(proxyBase);
    }
  }
}

async function registerProxy(directUrl, payload) {
  const res = await fetch("/api/proxy/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      play_url: directUrl,
      backup_urls: collectBackupUrls(payload, directUrl),
    }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function updateRoomMeta(payload) {
  els.roomTitle.textContent = payload.title || payload.anchor_name || "未知标题";
  els.roomAnchor.textContent = payload.anchor_name || payload.title || "";
  if (payload.cover) {
    els.roomCover.src = payload.cover;
    els.roomCover.style.display = "block";
  } else {
    els.roomCover.removeAttribute("src");
    els.roomCover.style.display = "none";
  }
  const live = payload.is_live || payload.status;
  els.liveBadge.textContent = live ? "直播中" : "未开播";
  els.liveBadge.className = "badge " + (live ? "live" : "");
}

async function playRoom() {
  destroyPlayer();
  setStatus("正在通过本机服务解析…", true);
  try {
    const payload = await fetchRoom();
    if (!payload.is_live && !payload.status) {
      updateRoomMeta(payload);
      throw new Error("房间未开播");
    }

    fillSelectors(payload);
    updateRoomMeta(payload);

    const directUrl = currentPlayUrl(payload);
    if (!directUrl) throw new Error("未获取到播放地址");

    const q = payload.streams?.[state.qualityIndex]?.name || "默认";
    const line = payload.streams?.[state.qualityIndex]?.lines?.[state.lineIndex]?.name || "";
    const sourceLabel = state.source === "local" ? "streamget（本机）" : "muxia";
    const metaText =
      `解析源: ${sourceLabel} | ${q} / ${line}\n` +
      `${state.useProxy ? "代理播放" : "直连 CDN"}: ${directUrl.slice(0, 100)}…`;

    state.payload = payload;

    if (state.useProxy) {
      const proxyPayload = await registerProxy(directUrl, payload);
      if (!proxyPayload.proxy_url) throw new Error("代理注册失败");
      proxyPlaybackLoop(proxyPayload.proxy_url, metaText);
      return;
    }

    setStatus(metaText, true);
    playDirect(directUrl);
  } catch (err) {
    setStatus(`失败: ${err.message}`, false);
  }
}

function stopPlay() {
  destroyPlayer();
  setStatus("已停止", true);
}

function bindEvents() {
  els.playBtn.addEventListener("click", playRoom);
  els.stopBtn.addEventListener("click", stopPlay);
  els.source.addEventListener("change", () => {
    state.source = els.source.value;
  });
  els.proxyMode.addEventListener("change", () => {
    state.useProxy = els.proxyMode.value === "proxy";
  });
  els.quality.addEventListener("change", () => {
    state.qualityIndex = Number(els.quality.value) || 0;
    const streams = state.payload?.streams || [];
    fillLines(streams[state.qualityIndex]);
    if (state.payload) playRoom();
  });
  els.line.addEventListener("change", () => {
    state.lineIndex = Number(els.line.value) || 0;
    if (state.payload) playRoom();
  });
}

function syncControls() {
  els.source.value = state.source;
  els.proxyMode.value = state.useProxy ? "proxy" : "direct";
}

renderSiteTabs();
syncControls();
bindEvents();
setStatus("默认：本机 streamget 解析 + 代理播放（flv.js），点击「播放」开始", true);
