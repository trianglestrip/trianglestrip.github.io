/* global Player, FlvPlayer, LZString */

const MUXIA_API = "https://live.muxia.site/api/";
const SITES = [
  { id: "douyu", name: "斗鱼", icon: "🐟" },
  { id: "huya", name: "虎牙", icon: "🐯" },
  { id: "bilibili", name: "哔哩", icon: "📺" },
  { id: "douyin", name: "抖音", icon: "🎵" },
];

const state = {
  site: "douyu",
  source: "muxia",
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

async function fetchMuxiaRoom(site, roomId) {
  const url = `${MUXIA_API}${site}/getRoomDetail?id=${encodeURIComponent(roomId)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`muxia HTTP ${res.status}`);
  const raw = await res.text();
  if (!raw) throw new Error("muxia 返回空响应");
  const text = LZString.decompressFromBase64(raw);
  if (!text) throw new Error("muxia 响应解码失败");
  const payload = JSON.parse(text);
  if (payload.code !== 200) throw new Error(payload.msg || "muxia API 错误");
  return normalizeMuxia(site, roomId, payload.data);
}

function normalizeMuxia(site, roomId, data) {
  const streams = (data.stream || [])
    .map((item) => ({
      name: item.name || "默认",
      lines: (item.lines || [])
        .filter((line) => line.url)
        .map((line) => ({ name: line.name || "线路", url: line.url })),
    }))
    .filter((item) => item.lines.length > 0);

  const firstUrl = streams[0]?.lines[0]?.url || "";
  const backup = [];
  for (const group of streams) {
    for (const line of group.lines) backup.push(line.url);
  }

  return {
    source: "muxia",
    site,
    room_id: roomId,
    title: data.title || "",
    anchor_name: data.nickname || data.title || "",
    status: !!data.status,
    is_live: !!data.status,
    cover: data.cover || "",
    streams,
    play_url: firstUrl,
    backup_urls: backup.filter((url) => url !== firstUrl),
  };
}

async function fetchLocalRoom(site, room) {
  const params = new URLSearchParams({
    site,
    room,
    source: "local",
    quality: "OD",
  });
  const res = await fetch(`/api/room?${params.toString()}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function fetchRoom() {
  const roomId = parseRoomId(els.room.value || state.room);
  state.room = roomId;
  if (state.source === "muxia") {
    return fetchMuxiaRoom(state.site, roomId);
  }
  return fetchLocalRoom(state.site, roomId);
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

function destroyPlayer() {
  if (state.player) {
    try {
      state.player.destroy();
    } catch (_) {}
    state.player = null;
  }
}

function buildPlayUrl(payload, directUrl) {
  if (!state.useProxy || !payload.proxy_url) return directUrl;
  return `${payload.proxy_url}&mode=segment&_ts=${Date.now()}`;
}

async function resolveAndRegisterProxy(payload, directUrl) {
  if (payload.proxy_url) return payload;
  const res = await fetch("/api/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      room: state.room,
      site: state.site,
      source: state.source === "muxia" ? "muxia" : "local",
      quality: "OD",
    }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  data.streams = payload.streams;
  data.title = payload.title || data.title;
  data.cover = payload.cover || data.cover;
  data.play_url = directUrl || data.play_url;
  return data;
}

function startPlayer(url) {
  destroyPlayer();
  if (!window.Player || !window.FlvPlayer) {
    throw new Error("xgplayer / xgplayer-flv 未加载");
  }
  if (FlvPlayer.isSupported && !FlvPlayer.isSupported()) {
    throw new Error("当前环境不支持 FLV 播放");
  }

  state.player = new Player({
    id: "player",
    url,
    isLive: true,
    autoplay: true,
    playsinline: true,
    fluid: true,
    lang: "zh-cn",
    volume: 0.7,
    plugins: [FlvPlayer],
    flv: {
      seamlesslyReload: true,
      retryCount: 2,
      retryDelay: 1000,
      loadTimeout: 12000,
      preloadTime: 4,
      cors: true,
    },
  });

  state.player.on("error", () => {
    setStatus("播放出错，可尝试切换线路或开启代理", false);
  });
}

function updateRoomMeta(payload) {
  els.roomTitle.textContent = payload.title || "未知标题";
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
  setStatus("正在解析房间…", true);
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

    if (state.useProxy) {
      payload = await resolveAndRegisterProxy(payload, directUrl);
    }

    const playUrl = state.useProxy ? buildPlayUrl(payload, directUrl) : directUrl;
    state.payload = payload;
    startPlayer(playUrl);

    const q = payload.streams?.[state.qualityIndex]?.name || "默认";
    const line = payload.streams?.[state.qualityIndex]?.lines?.[state.lineIndex]?.name || "";
    setStatus(
      `解析源: ${payload.source} | ${q} / ${line}\n` +
      `${state.useProxy ? "代理播放" : "直连播放"}: ${directUrl.slice(0, 100)}…`,
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

renderSiteTabs();
bindEvents();
setStatus("输入房间号后点击播放", true);
