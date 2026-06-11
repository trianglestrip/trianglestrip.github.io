/* global FlvPlayer */

const SITES = [
  { id: "douyu", name: "斗鱼", icon: "🐟", referer: "https://www.douyu.com/" },
  { id: "huya", name: "虎牙", icon: "🐯", referer: "https://www.huya.com/" },
  { id: "bilibili", name: "哔哩", icon: "📺", referer: "https://live.bilibili.com/" },
  { id: "douyin", name: "抖音", icon: "🎵", referer: "https://live.douyin.com/" },
];

const SEGMENT_BATCH = 3;

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
  proxyBase: "",
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
};

function siteReferer(siteId) {
  return SITES.find((item) => item.id === siteId)?.referer || "https://www.douyu.com/";
}

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
      state.player.destroy();
    } catch (_) {}
    state.player = null;
  }
}

function destroyPlayer() {
  state.loopActive = false;
  destroyPlayerInstance();
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

function ensureFlvPlayer() {
  if (!window.FlvPlayer) throw new Error("xgplayer-flv 未加载，请检查网络或刷新页面");
  if (FlvPlayer.isSupported && !FlvPlayer.isSupported()) {
    throw new Error("当前浏览器不支持 MSE，无法播放 FLV");
  }
}

function playBlob(buffer, referer) {
  return new Promise((resolve, reject) => {
    ensureFlvPlayer();
    destroyPlayerInstance();

    state.blobUrl = URL.createObjectURL(new Blob([buffer], { type: "video/x-flv" }));
    state.player = new FlvPlayer({
      id: "player",
      url: state.blobUrl,
      isLive: false,
      autoplay: true,
      playsinline: true,
      fluid: true,
      lang: "zh-cn",
      volume: 0.7,
      muted: true,
      cors: true,
      fitVideoSize: "fixWidth",
      flv: {
        cors: true,
        fetchOptions: {
          headers: { Referer: referer },
        },
      },
    });

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fail = (detail) => {
      if (settled) return;
      settled = true;
      reject(new Error(detail || "播放失败"));
    };

    state.player.on("playing", done);
    state.player.on("canplay", done);
    state.player.on("ended", done);
    state.player.on("error", (err) => {
      fail(err?.message || err?.type || "播放器错误");
    });

    setTimeout(() => {
      if (!settled && state.player && !state.player.paused) done();
    }, 3000);
    setTimeout(() => fail("播放超时"), 12000);
  });
}

function startDirectPlayer(url, referer) {
  ensureFlvPlayer();
  destroyPlayer();
  state.loopActive = true;
  state.player = new FlvPlayer({
    id: "player",
    url,
    isLive: true,
    autoplay: true,
    playsinline: true,
    fluid: true,
    lang: "zh-cn",
    volume: 0.7,
    muted: true,
    seamlesslyReload: true,
    retryCount: 3,
    retryDelay: 1000,
    loadTimeout: 15000,
    preloadTime: 4,
    cors: true,
    fitVideoSize: "fixWidth",
    flv: {
      seamlesslyReload: true,
      cors: true,
      fetchOptions: {
        headers: { Referer: referer },
      },
    },
  });

  state.player.on("error", (err) => {
    const detail = err?.message || err?.type || "未知错误";
    setStatus(`直连播放出错: ${detail}`, false);
  });
}

async function proxyPlaybackLoop(proxyBase, referer, metaText) {
  state.proxyBase = proxyBase;
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
      await playBlob(merged, referer);
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
    const metaText =
      `解析源: ${payload.source}（本机） | ${q} / ${line}\n` +
      `${state.useProxy ? "代理播放" : "直连 CDN"}: ${directUrl.slice(0, 100)}…\n` +
      "（已静音自动播放，可在播放器控件中打开声音）";

    state.payload = payload;
    const referer = siteReferer(state.site);

    if (state.useProxy) {
      const proxyPayload = await registerProxy(directUrl, payload);
      if (!proxyPayload.proxy_url) throw new Error("代理注册失败");
      proxyPlaybackLoop(proxyPayload.proxy_url, referer, metaText);
      return;
    }

    setStatus(metaText, true);
    startDirectPlayer(directUrl, referer);
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
setStatus("默认：本机 streamget 解析 + 代理播放，点击「播放」开始", true);
