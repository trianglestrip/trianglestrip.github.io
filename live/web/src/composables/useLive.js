import { ref, watch } from "vue";
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
import { getPrefetchedRoom } from "../utils/roomPrefetch.js";

const DEFAULT_PLAY_PREFS = { qualityName: "", lineName: "" };
const DEFAULT_VOLUME_PREFS = { volume: 1 };

function loadPlayPrefs(site) {
  return loadPlatformPref(site, "quality", DEFAULT_PLAY_PREFS, [migrateGlobalQualityToPlatform(site)]);
}

function savePlayPrefs(site, patch) {
  const prev = loadPlayPrefs(site);
  const next = { ...prev, ...patch };
  if (!next.qualityName && !next.lineName) return;
  savePlatformPref(site, "quality", next);
}

function loadVolumePrefs(site) {
  if (!site) return { ...DEFAULT_VOLUME_PREFS };
  return loadPlatformPref(site, "volume", DEFAULT_VOLUME_PREFS);
}

function saveVolumePrefs(site, volumeValue) {
  if (!site) return;
  const next = Math.min(1, Math.max(0, Number(volumeValue)));
  savePlatformPref(site, "volume", { volume: next });
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

  async function loadRoom(roomInput, { autoPlay = false, playFn, force = false } = {}) {
    if (loading.value) return;
    loading.value = true;
    setStatus("正在解析…");

    try {
      const site = siteRef.value;
      const platform = getPlatform(site);
      if (!platform?.enabled) throw new Error("该平台尚未接入");

      const roomId = parseRoomId(roomInput);
      const prefs = loadPlayPrefs(site);
      let data = !force ? getPrefetchedRoom(site, roomId) : null;
      if (!data) {
        data = await fetchRoom({
          site,
          room: roomId,
          mode: "lazy",
          quality: prefs.qualityName || undefined,
          force,
        });
      }

      if (!data.is_live && !data.status) {
        payload.value = data;
        throw new Error("房间未开播");
      }

      payload.value = data;
      fillFromPayload(data, prefs);

      if (autoPlay && playFn) {
        loading.value = false;
        setStatus("缓冲中…");
        await playFn();
      } else {
        setStatus("解析完成");
      }
      return roomId;
    } catch (err) {
      setStatus(`失败: ${err.message}`, "err");
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function ensureQualityLoaded(qualityName, { force = false } = {}) {
    const existing = streamByName(payload.value, qualityName);
    if (!force && streamHasUrl(existing)) return payload.value;
    setStatus(`加载档位 ${qualityName}…`);
    const incoming = await fetchRoom({
      site: siteRef.value,
      room: payload.value?.room_id || "",
      mode: "lazy",
      quality: qualityName,
      force,
    });
    payload.value = mergePayload(payload.value, incoming);
    fillFromPayload(payload.value, loadPlayPrefs(siteRef.value));
    return payload.value;
  }

  async function refetchRoom({ force = true } = {}) {
    const prefs = loadPlayPrefs(siteRef.value);
    const names = qualityNames(payload.value);
    const qualityName = names[qualityIndex.value] || prefs.qualityName || undefined;
    const data = await fetchRoom({
      site: siteRef.value,
      room: payload.value?.room_id || "",
      mode: "lazy",
      quality: qualityName,
      force,
    });
    payload.value = data;
    fillFromPayload(data, prefs);
    return data;
  }

  async function resolvePlayUrl({ force = false } = {}) {
    const names = qualityNames(payload.value);
    const qualityName = names[qualityIndex.value];
    if (!qualityName) throw new Error("未选择清晰度");
    const data = await ensureQualityLoaded(qualityName, { force });
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
    refetchRoom,
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
    stashInitialSize: 512 * 1024,
    lazyLoad: false,
    autoCleanupSourceBuffer: false,
    fixAudioTimestampGap: true,
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
  } else if (site === "douyin") {
    config.headers = {
      Referer: "https://live.douyin.com/",
      Origin: "https://live.douyin.com",
    };
  }
  return config;
}

export function usePlayer(siteRef) {
  const playing = ref(false);
  const streamActive = ref(false);
  const volume = ref(loadVolumePrefs(siteRef?.value).volume);
  const muted = ref(false);
  let player = null;
  let videoEl = null;
  let onCanPlayResume = null;
  /** playFlv 传入的静音意图；已开声切房时为 false，避免 startPlay 失败时误降级静音 */
  let playMutedIntent = true;

  function cachedVolume() {
    return loadVolumePrefs(siteRef?.value).volume;
  }

  function persistVolume(value) {
    const site = siteRef?.value;
    if (!site) return;
    const next = Math.min(1, Math.max(0, Number(value)));
    saveVolumePrefs(site, next);
    volume.value = next;
  }

  function applyCachedVolume(el) {
    const v = cachedVolume();
    const next = v > 0 ? v : 1;
    el.volume = next;
    volume.value = next;
  }

  if (siteRef) {
    watch(
      () => siteRef.value,
      (site) => {
        volume.value = loadVolumePrefs(site).volume;
      },
    );
  }

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
      volume.value = cachedVolume();
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
    onCanPlayResume = () => {
      if (!streamActive.value || !videoEl || !videoEl.paused) return;
      startPlay();
    };
    el.addEventListener("pause", syncPlaying);
    el.addEventListener("playing", syncPlaying);
    el.addEventListener("timeupdate", syncPlaying);
    el.addEventListener("ended", syncPlaying);
    el.addEventListener("volumechange", syncVolume);
    el.addEventListener("canplay", onCanPlayResume);
    el.addEventListener("loadeddata", onCanPlayResume);
    syncVolume();
  }

  function unbindVideoEvents() {
    if (!videoEl) return;
    videoEl.removeEventListener("pause", syncPlaying);
    videoEl.removeEventListener("playing", syncPlaying);
    videoEl.removeEventListener("timeupdate", syncPlaying);
    videoEl.removeEventListener("ended", syncPlaying);
    videoEl.removeEventListener("volumechange", syncVolume);
    if (onCanPlayResume) {
      videoEl.removeEventListener("canplay", onCanPlayResume);
      videoEl.removeEventListener("loadeddata", onCanPlayResume);
      onCanPlayResume = null;
    }
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
    volume.value = cachedVolume();
    muted.value = false;
    playMutedIntent = true;
    teardownPlayer();
    unbindVideoEvents();
  }

  function waitForCanPlay(el, timeoutMs = 10000) {
    if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.removeEventListener("canplay", onReady);
        el.removeEventListener("loadeddata", onReady);
        clearTimeout(timer);
        resolve();
      };
      const onReady = () => finish();
      const timer = setTimeout(finish, timeoutMs);
      el.addEventListener("canplay", onReady, { once: true });
      el.addEventListener("loadeddata", onReady, { once: true });
    });
  }

  async function startPlay() {
    if (!videoEl) return false;
    const tryOnce = async () => {
      player?.play?.()?.catch?.(() => {});
      await videoEl.play();
    };
    const attemptPlay = async () => {
      for (let i = 0; i < 2; i += 1) {
        try {
          await tryOnce();
          syncPlaying();
          return true;
        } catch {
          if (!videoEl.muted && !playMutedIntent) return false;
          if (!videoEl.muted && playMutedIntent) {
            videoEl.muted = true;
            syncVolume();
          }
        }
      }
      return false;
    };

    if (await attemptPlay()) return true;

    for (let retry = 0; retry < 6; retry += 1) {
      await waitForCanPlay(videoEl, 2000);
      if (await attemptPlay()) return true;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    syncPlaying();
    return !videoEl.paused;
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
    persistVolume(next);
  }

  function toggleMute() {
    if (!videoEl) return;
    videoEl.muted = !videoEl.muted;
    if (!videoEl.muted && videoEl.volume === 0) {
      const v = cachedVolume() > 0 ? cachedVolume() : 1;
      videoEl.volume = v;
      persistVolume(v);
    }
    syncVolume();
  }

  /** 在用户操作时直接取消静音，勿重建播放器（重建会打断 CDN 连接导致断流） */
  async function unmutePlayback({ soft = false } = {}) {
    if (!videoEl) return false;
    videoEl.muted = false;
    const v = cachedVolume() > 0 ? cachedVolume() : 1;
    if (videoEl.volume === 0) videoEl.volume = v;
    syncVolume();
    const ok = await startPlay();
    if (!ok || videoEl.paused) {
      if (!soft) {
        videoEl.muted = true;
        syncVolume();
        await startPlay();
      }
      return false;
    }
    return true;
  }

  function playFlv(el, url, { site = "", onError, onReady, startMuted = true } = {}) {
    const flv = flvjs();
    if (!flv.isSupported()) {
      throw new Error("当前浏览器不支持 flv.js");
    }

    teardownPlayer();
    bindVideoEvents(el);
    streamActive.value = true;
    playMutedIntent = startMuted;

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
    el.autoplay = true;
    applyCachedVolume(el);
    el.muted = startMuted;
    syncVolume();

    player.on(flv.Events.ERROR, () => {
      if (!streamActive.value) return;
      onError?.();
    });

    player.on(flv.Events.MEDIA_INFO, () => {
      startPlay();
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
    unmutePlayback,
    setVolume,
    toggleMute,
  };
}
