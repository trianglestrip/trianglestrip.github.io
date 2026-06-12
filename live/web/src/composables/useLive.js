import { ref } from "vue";
import {
  fetchRoom,
  mergePayload,
  parseRoomId,
  qualityNames,
  streamByName,
  streamHasUrl,
  findQualityIndex,
  findLineIndex,
  currentPlayUrl,
} from "../api/room";
import { getPlatform } from "../config/platforms";
import {
  loadPlatformPref,
  migrateGlobalQualityToPlatform,
  savePlatformPref,
} from "../utils/prefStore.js";

const DEFAULT_PLAY_PREFS = { qualityName: "", lineName: "" };

function loadPlayPrefs(site) {
  return loadPlatformPref(site, "quality", DEFAULT_PLAY_PREFS, [migrateGlobalQualityToPlatform(site)]);
}

function savePlayPrefs(site, patch) {
  const prev = loadPlayPrefs(site);
  const next = { ...prev, ...patch };
  if (!next.qualityName && !next.lineName) return;
  savePlatformPref(site, "quality", next);
}

export function useRoom(siteRef) {
  const payload = ref(null);
  const loading = ref(false);
  const statusText = ref("");
  const statusKind = ref("info");
  const qualityIndex = ref(0);
  const lineIndex = ref(0);

  function setStatus(text, kind = "info") {
    statusText.value = text;
    statusKind.value = kind;
  }

  function fillFromPayload(data, prefs = loadPlayPrefs(siteRef.value)) {
    const names = qualityNames(data);
    qualityIndex.value = findQualityIndex(names, prefs.qualityName);
    const stream = streamByName(data, names[qualityIndex.value]);
    lineIndex.value = findLineIndex(stream?.lines || [], prefs.lineName);
  }

  async function loadRoom(roomInput, { autoPlay = false, playFn } = {}) {
    if (loading.value) return;
    loading.value = true;
    setStatus("正在解析…");

    try {
      const site = siteRef.value;
      const platform = getPlatform(site);
      if (!platform?.enabled) throw new Error("该平台尚未接入");

      const roomId = parseRoomId(roomInput);
      const prefs = loadPlayPrefs(site);
      const data = await fetchRoom({
        site,
        room: roomId,
        mode: "lazy",
        quality: prefs.qualityName || undefined,
      });

      if (!data.is_live && !data.status) {
        payload.value = data;
        throw new Error("房间未开播");
      }

      payload.value = data;
      fillFromPayload(data, prefs);

      if (autoPlay && playFn) {
        loading.value = false;
        setStatus("正在缓冲…");
        await playFn();
      } else {
        setStatus(`${platform.label} · 解析完成`);
      }
      return roomId;
    } catch (err) {
      setStatus(`失败: ${err.message}`, "err");
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function ensureQualityLoaded(qualityName) {
    const existing = streamByName(payload.value, qualityName);
    if (streamHasUrl(existing)) return payload.value;
    setStatus(`加载档位 ${qualityName}…`);
    const incoming = await fetchRoom({
      site: siteRef.value,
      room: payload.value?.room_id || "",
      mode: "lazy",
      quality: qualityName,
    });
    payload.value = mergePayload(payload.value, incoming);
    fillFromPayload(payload.value, loadPlayPrefs(siteRef.value));
    return payload.value;
  }

  async function resolvePlayUrl() {
    const names = qualityNames(payload.value);
    const qualityName = names[qualityIndex.value];
    if (!qualityName) throw new Error("未选择清晰度");
    const data = await ensureQualityLoaded(qualityName);
    const url = currentPlayUrl(data, qualityIndex.value, lineIndex.value);
    if (!url) throw new Error(`档位 ${qualityName} 暂无播放地址`);
    return { url, data, qualityName };
  }

  function qualityOptions() {
    const names = qualityNames(payload.value);
    return names.map((name, index) => ({
      index,
      name,
      loaded: streamHasUrl(streamByName(payload.value, name)),
    }));
  }

  function lineOptions() {
    const names = qualityNames(payload.value);
    const stream = streamByName(payload.value, names[qualityIndex.value]);
    return stream?.lines || [];
  }

  function onQualityChange(index) {
    qualityIndex.value = Number(index) || 0;
    lineIndex.value = 0;
    const names = qualityNames(payload.value);
    const selected = names[qualityIndex.value];
    const stream = streamByName(payload.value, selected);
    const line = stream?.lines?.[0];
    if (selected && names.includes(selected)) {
      savePlayPrefs(siteRef.value, {
        qualityName: selected,
        lineName: line?.name || "",
      });
    }
  }

  function onLineChange(index) {
    lineIndex.value = Number(index) || 0;
    const names = qualityNames(payload.value);
    const stream = streamByName(payload.value, names[qualityIndex.value]);
    const line = stream?.lines?.[lineIndex.value];
    if (line?.name) {
      savePlayPrefs(siteRef.value, { lineName: line.name });
    }
  }

  function buildMetaText(url) {
    const platform = getPlatform(siteRef.value);
    const names = qualityNames(payload.value);
    const q = names[qualityIndex.value] || "默认";
    const stream = streamByName(payload.value, q);
    const line = stream?.lines?.[lineIndex.value]?.name || stream?.lines?.[0]?.name || "";
    const cache = payload.value?.cached ? " · 缓存" : "";
    const room = payload.value?.room_id || "";
    return `${platform?.label || siteRef.value} ${room} · ${q} / ${line}${cache}\n${url.slice(0, 96)}…`;
  }

  return {
    payload,
    loading,
    statusText,
    statusKind,
    qualityIndex,
    lineIndex,
    setStatus,
    loadRoom,
    resolvePlayUrl,
    qualityOptions,
    lineOptions,
    onQualityChange,
    onLineChange,
    buildMetaText,
  };
}

function flvOptionsForSite(site) {
  const config = {
    enableWorker: false,
    enableStashBuffer: true,
    stashInitialSize: 2 * 1024 * 1024,
    lazyLoad: false,
    autoCleanupSourceBuffer: false,
    fixAudioTimestampGap: false,
  };
  if (site === "douyu") {
    config.headers = {
      Referer: "https://www.douyu.com/",
      Origin: "https://www.douyu.com",
    };
  } else if (site === "huya") {
    config.headers = {
      Referer: "https://www.huya.com/",
      Origin: "https://www.huya.com",
    };
  }
  return config;
}

export function usePlayer() {
  const playing = ref(false);
  const streamActive = ref(false);
  const volume = ref(1);
  const muted = ref(false);
  let player = null;
  let videoEl = null;

  function flvjs() {
    const api = window.flvjs;
    if (!api) {
      throw new Error("flv.js 未加载，请确认 index.html 已引入 /flv.min.js");
    }
    return api;
  }

  function syncPlaying() {
    if (!videoEl) {
      playing.value = false;
      return;
    }
    playing.value = !videoEl.paused && !videoEl.ended;
  }

  function syncVolume() {
    if (!videoEl) {
      volume.value = 1;
      muted.value = false;
      return;
    }
    volume.value = videoEl.volume;
    muted.value = videoEl.muted;
  }

  function bindVideoEvents(el) {
    if (videoEl === el) return;
    unbindVideoEvents();
    videoEl = el;
    el.addEventListener("pause", syncPlaying);
    el.addEventListener("playing", syncPlaying);
    el.addEventListener("timeupdate", syncPlaying);
    el.addEventListener("ended", syncPlaying);
    el.addEventListener("volumechange", syncVolume);
    syncVolume();
  }

  function unbindVideoEvents() {
    if (!videoEl) return;
    videoEl.removeEventListener("pause", syncPlaying);
    videoEl.removeEventListener("playing", syncPlaying);
    videoEl.removeEventListener("timeupdate", syncPlaying);
    videoEl.removeEventListener("ended", syncPlaying);
    videoEl.removeEventListener("volumechange", syncVolume);
    videoEl = null;
  }

  function teardownPlayer() {
    if (!player) return;
    try {
      player.pause();
      player.unload();
      player.detachMediaElement();
      player.destroy();
    } catch {
      /* ignore */
    }
    player = null;
  }

  function destroy() {
    playing.value = false;
    streamActive.value = false;
    volume.value = 1;
    muted.value = false;
    teardownPlayer();
    unbindVideoEvents();
  }

  async function startPlay() {
    if (!videoEl) return false;
    try {
      player?.play?.()?.catch?.(() => {});
      await videoEl.play();
      syncPlaying();
      return true;
    } catch {
      syncPlaying();
      return false;
    }
  }

  function pausePlayback() {
    if (player) player.pause();
    else videoEl?.pause();
    syncPlaying();
  }

  function togglePlay() {
    if (!streamActive.value) return;
    if (playing.value) pausePlayback();
    else startPlay();
  }

  function setVolume(value) {
    if (!videoEl) return;
    const next = Math.min(1, Math.max(0, Number(value)));
    videoEl.volume = next;
    videoEl.muted = next === 0;
    syncVolume();
  }

  function toggleMute() {
    if (!videoEl) return;
    videoEl.muted = !videoEl.muted;
    if (!videoEl.muted && videoEl.volume === 0) videoEl.volume = 1;
    syncVolume();
  }

  function playFlv(el, url, { site = "", onError, onReady } = {}) {
    const flv = flvjs();
    if (!flv.isSupported()) {
      throw new Error("当前浏览器不支持 flv.js");
    }

    teardownPlayer();
    bindVideoEvents(el);
    streamActive.value = true;

    player = flv.createPlayer(
      {
        type: "flv",
        url,
        isLive: true,
        hasAudio: true,
        hasVideo: true,
        cors: true,
      },
      flvOptionsForSite(site),
    );

    player.attachMediaElement(el);
    el.playsInline = true;
    el.muted = false;
    el.volume = 1;
    syncVolume();

    player.on(flv.Events.ERROR, () => {
      if (!streamActive.value) return;
      onError?.();
    });

    const onFirstPlaying = () => {
      syncPlaying();
      onReady?.();
    };
    el.addEventListener("playing", onFirstPlaying, { once: true });
    player.load();
  }

  return {
    playing,
    streamActive,
    volume,
    muted,
    destroy,
    playFlv,
    startPlay,
    togglePlay,
    pausePlayback,
    setVolume,
    toggleMute,
  };
}
