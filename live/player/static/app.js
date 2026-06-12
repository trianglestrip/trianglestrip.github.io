/* global flvjs */

const SITES = [
  { id: "douyu", name: "斗鱼", icon: "🐟" },
  { id: "huya", name: "虎牙", icon: "🐯" },
  { id: "bilibili", name: "哔哩", icon: "📺" },
  { id: "douyin", name: "抖音", icon: "🎵" },
];

const state = {
  site: "douyu",
  source: "local",
  room: "5720533",
  qualityIndex: 0,
  lineIndex: 0,
  payload: null,
  player: null,
  loopActive: false,
};

const els = {
  siteTabs: document.getElementById("siteTabs"),
  room: document.getElementById("room"),
  source: document.getElementById("source"),
  quality: document.getElementById("quality"),
  line: document.getElementById("line"),
  playBtn: document.getElementById("playBtn"),
  compareBtn: document.getElementById("compareBtn"),
  stopBtn: document.getElementById("stopBtn"),
  status: document.getElementById("status"),
  roomTitle: document.getElementById("roomTitle"),
  roomAnchor: document.getElementById("roomAnchor"),
  roomCover: document.getElementById("roomCover"),
  liveBadge: document.getElementById("liveBadge"),
  video: document.getElementById("player"),
  compareCard: document.getElementById("compareCard"),
  compareSummary: document.getElementById("compareSummary"),
  compareTable: document.getElementById("compareTable"),
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
  });
  const res = await fetch(`/api/room?${params.toString()}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function fetchCompare() {
  const roomId = parseRoomId(els.room.value || state.room);
  state.room = roomId;
  const params = new URLSearchParams({ site: state.site, room: roomId });
  const res = await fetch(`/api/compare?${params.toString()}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function preferQualityIndex(streams) {
  const wanted = ["高清", "超清", "原画"];
  for (const name of wanted) {
    const index = streams.findIndex((item) => (item.name || "").includes(name));
    if (index >= 0) return index;
  }
  return 0;
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

  if (streams.length > 1) {
    state.qualityIndex = preferQualityIndex(streams);
  } else {
    state.qualityIndex = Math.min(state.qualityIndex, streams.length - 1);
  }
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

function isBadPlayUrl(url) {
  return !url || url.includes("edgesrv.com");
}

function currentPlayUrl(payload) {
  const streams = payload.streams || [];
  if (streams.length) {
    const stream = streams[state.qualityIndex] || streams[0];
    const line = stream.lines[state.lineIndex] || stream.lines[0];
    if (line?.url && !isBadPlayUrl(line.url)) return line.url;
  }
  for (const candidate of [payload.play_url, payload.m3u8_url, payload.flv_url]) {
    if (candidate && !isBadPlayUrl(candidate)) return candidate;
  }
  return "";
}

function destroyPlayerInstance() {
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

function flvConfig(live) {
  return {
    enableWorker: false,
    enableStashBuffer: !!live,
    stashInitialSize: live ? 512 * 1024 : 0,
    lazyLoad: false,
    deferLoadAfterSourceOpen: false,
    autoCleanupSourceBuffer: true,
    fixAudioTimestampGap: true,
  };
}

function playLive(url, metaText) {
  ensureFlvJs();
  destroyPlayerInstance();
  state.loopActive = true;

  state.player = flvjs.createPlayer({
    type: "flv",
    url,
    isLive: true,
    hasAudio: true,
    hasVideo: true,
  }, flvConfig(true));

  state.player.attachMediaElement(els.video);
  state.player.on(flvjs.Events.ERROR, (_, info, detail) => {
    if (!state.loopActive) return;
    const msg = [info, detail && detail.code, detail && detail.msg].filter(Boolean).join(" | ");
    setStatus(`${metaText}\n短暂中断: ${msg}`, false);
  });
  state.player.on(flvjs.Events.MEDIA_INFO, () => {
    state.player.play().catch(() => {});
    setStatus(`${metaText}\n播放中（CDN 直链）`, true);
  });
  state.player.load();
  state.player.play().catch(() => {});
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

function renderCompare(data) {
  const cmp = data.compare || {};
  const rows = cmp.rows || [];
  const tbody = els.compareTable.querySelector("tbody");
  tbody.innerHTML = "";

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.className = row.match ? "match" : "diff";
    const basename = row.flv_match
      ? row.local_basename
      : `${row.local_basename || "—"} / ${row.muxia_basename || "—"}`;
    tr.innerHTML = `
      <td>${row.quality || "—"}</td>
      <td>${row.local_line || "—"} / ${row.muxia_line || "—"}</td>
      <td class="mono">${basename}</td>
      <td>${row.match ? "一致" : row.flv_match ? "线路名不同" : "不一致"}</td>
    `;
    tbody.appendChild(tr);
  }

  const summaryParts = [
    `档位名: ${cmp.quality_names_match ? "一致" : "不一致"}`,
    `FLV 文件: ${cmp.matched}/${cmp.total} 档一致`,
    cmp.all_match ? "结论: 与 muxia 完全一致" : "结论: 存在差异（见上表）",
  ];
  if (cmp.local_only?.length) summaryParts.push(`仅本机: ${cmp.local_only.join("、")}`);
  if (cmp.muxia_only?.length) summaryParts.push(`仅 muxia: ${cmp.muxia_only.join("、")}`);

  els.compareSummary.textContent = summaryParts.join(" · ");
  els.compareSummary.className = "compare-summary " + (cmp.all_match ? "ok" : "warn");
  els.compareCard.hidden = false;
}

async function compareWithMuxia() {
  setStatus("正在解析本机 streamget 与 muxia…", true);
  try {
    const data = await fetchCompare();
    renderCompare(data);
    state.payload = data.local;
    fillSelectors(data.local);
    updateRoomMeta(data.local);
    const cmp = data.compare || {};
    setStatus(
      cmp.all_match
        ? `对比完成：${data.room_id} 与 muxia 完全一致（${cmp.matched} 档）`
        : `对比完成：${data.room_id} 有 ${cmp.total - cmp.matched} 档与 muxia 不一致`,
      cmp.all_match
    );
  } catch (err) {
    setStatus(`对比失败: ${err.message}`, false);
  }
}

async function playRoom() {
  destroyPlayer();
  setStatus("正在解析…", true);
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
    const metaText = `解析源: ${sourceLabel} | ${q} / ${line}\nCDN: ${directUrl.slice(0, 120)}…`;

    state.payload = payload;
    playLive(directUrl, metaText);
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
  els.compareBtn.addEventListener("click", compareWithMuxia);
  els.stopBtn.addEventListener("click", stopPlay);
  els.source.addEventListener("change", () => {
    state.source = els.source.value;
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
  els.room.value = state.room;
}

renderSiteTabs();
syncControls();
bindEvents();
setStatus("默认 streamget 直连播放；点「对比 muxia」可核对档位与 FLV 文件名是否一致", true);
