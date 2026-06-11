/* global FlvPlayer */

const SITES = [
  { id: "douyu", name: "斗鱼", icon: "🐟", referer: "https://www.douyu.com/" },
  { id: "huya", name: "虎牙", icon: "🐯", referer: "https://www.huya.com/" },
  { id: "bilibili", name: "哔哩", icon: "📺", referer: "https://live.bilibili.com/" },
  { id: "douyin", name: "抖音", icon: "🎵", referer: "https://live.douyin.com/" },
];

const state = {
  site: "douyu",
  source: "local",
  room: "9999",
  qualityIndex: 0,
  lineIndex: 0,
  payload: null,
  player: null,
  useProxy: true,
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

function destroyPlayer() {
  if (state.player) {
    try {
      state.player.destroy();
    } catch (_) {}
    state.player = null;
  }
}

function buildPlayUrl(payload) {
  return `${payload.proxy_url}&mode=live&_ts=${Date.now()}`;
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

function startPlayer(url) {
  destroyPlayer();
  if (!window.FlvPlayer) {
    throw new Error("xgplayer-flv 未加载，请检查网络或刷新页面");
  }
  if (FlvPlayer.isSupported && !FlvPlayer.isSupported()) {
    throw new Error("当前浏览器不支持 MSE，无法播放 FLV");
  }

  const referer = siteReferer(state.site);
  state.player = new FlvPlayer({
    id: "player",
    url,
    isLive: true,
    autoplay: true,
    playsinline: true,
    fluid: true,
    lang: "zh-cn",
    volume: 0.7,
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
    setStatus(`播放出错: ${detail}\n可切换线路，或将播放方式改为「直连 CDN」`, false);
  });
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
    let payload = await fetchRoom();
    if (!payload.is_live && !payload.status) {
      updateRoomMeta(payload);
      throw new Error("房间未开播");
    }

    fillSelectors(payload);
    updateRoomMeta(payload);

    const directUrl = currentPlayUrl(payload);
    if (!directUrl) throw new Error("未获取到播放地址");

    let playUrl = directUrl;
    if (state.useProxy) {
      const proxyPayload = await registerProxy(directUrl, payload);
      playUrl = buildPlayUrl(proxyPayload);
      payload = { ...payload, ...proxyPayload };
    }

    state.payload = payload;
    startPlayer(playUrl);

    const q = payload.streams?.[state.qualityIndex]?.name || "默认";
    const line = payload.streams?.[state.qualityIndex]?.lines?.[state.lineIndex]?.name || "";
    setStatus(
      `解析源: ${payload.source}（本机） | ${q} / ${line}\n` +
      `${state.useProxy ? "代理直播" : "直连 CDN"}: ${directUrl.slice(0, 100)}…`,
      true,
    );
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
