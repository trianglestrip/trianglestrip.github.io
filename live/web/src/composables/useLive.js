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
import { COOKIE_KEYS, getCookieJson, setCookieJson } from "../utils/cookieStore.js";

function loadPlayPrefs() {
  const fromCookie = getCookieJson(COOKIE_KEYS.quality);
  if (fromCookie?.qualityName || fromCookie?.lineName) {
    return {
      qualityName: fromCookie.qualityName ? String(fromCookie.qualityName) : "",
      lineName: fromCookie.lineName ? String(fromCookie.lineName) : "",
    };
  }
  try {
    const legacy = JSON.parse(localStorage.getItem("live.web.prefs") || "{}");
    if (legacy.qualityName) {
      const migrated = {
        qualityName: String(legacy.qualityName),
        lineName: legacy.lineName ? String(legacy.lineName) : "",
      };
      setCookieJson(COOKIE_KEYS.quality, migrated);
      return migrated;
    }
  } catch {
    /* ignore */
  }
  return { qualityName: "", lineName: "" };
}

function savePlayPrefs(patch) {
  const prev = loadPlayPrefs();
  const next = { ...prev, ...patch };
  if (!next.qualityName && !next.lineName) return;
  setCookieJson(COOKIE_KEYS.quality, next);
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

  function fillFromPayload(data, prefs = loadPlayPrefs()) {
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
      const prefs = loadPlayPrefs();
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
    fillFromPayload(payload.value, loadPlayPrefs());
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
      savePlayPrefs({
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
      savePlayPrefs({ lineName: line.name });
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

export function usePlayer() {
  const playing = ref(false);
  const streamActive = ref(false);
  const autoplayBlocked = ref(false);
  const mutedAutoplay = ref(false);
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
    el.addEventListener("ended", syncPlaying);
    el.addEventListener("volumechange", syncVolume);
    syncVolume();
  }

  function unbindVideoEvents() {
    if (!videoEl) return;
    videoEl.removeEventListener("pause", syncPlaying);
    videoEl.removeEventListener("playing", syncPlaying);
    videoEl.removeEventListener("ended", syncPlaying);
    videoEl.removeEventListener("volumechange", syncVolume);
    videoEl = null;
  }

  function destroy() {
    playing.value = false;
    streamActive.value = false;
    autoplayBlocked.value = false;
    mutedAutoplay.value = false;
    volume.value = 1;
    muted.value = false;
    unbindVideoEvents();
    if (player) {
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
  }

  function safePlayerPlay() {
    if (!player) return;
    try {
      const pending = player.play();
      pending?.catch?.(() => {});
    } catch {
      /* ignore */
    }
  }

  async function resumePlayback({ preferSound = false } = {}) {
    if (!videoEl) return false;
    if (preferSound) videoEl.muted = false;

    const attemptPlay = async () => {
      safePlayerPlay();
      await videoEl.play();
    };

    try {
      await attemptPlay();
      mutedAutoplay.value = videoEl.muted;
      autoplayBlocked.value = false;
      syncPlaying();
      syncVolume();
      return true;
    } catch (err) {
      if (err?.name !== "NotAllowedError") {
        syncPlaying();
        return false;
      }
      if (!videoEl.muted) {
        videoEl.muted = true;
        try {
          await attemptPlay();
          mutedAutoplay.value = true;
          autoplayBlocked.value = false;
          syncPlaying();
          syncVolume();
          return true;
        } catch {
          /* still blocked */
        }
      }
      autoplayBlocked.value = true;
      mutedAutoplay.value = false;
      syncPlaying();
      return false;
    }
  }

  async function unlockAutoplay() {
    if (!videoEl) return;
    mutedAutoplay.value = false;
    const ok = await resumePlayback({ preferSound: true });
    if (!ok) {
      autoplayBlocked.value = true;
      mutedAutoplay.value = videoEl.muted;
    } else {
      autoplayBlocked.value = false;
    }
    syncVolume();
  }

  function setVolume(value) {
    if (!videoEl) return;
    const next = Math.min(1, Math.max(0, Number(value)));
    videoEl.volume = next;
    if (next > 0) {
      videoEl.muted = false;
      mutedAutoplay.value = false;
      autoplayBlocked.value = false;
    } else {
      videoEl.muted = true;
    }
    syncVolume();
  }

  function toggleMute() {
    if (!videoEl) return;
    if (autoplayBlocked.value || mutedAutoplay.value) {
      unlockAutoplay();
      return;
    }
    videoEl.muted = !videoEl.muted;
    syncVolume();
  }

  /** 进房后立即静音 play()，尽量占用导航点击的用户手势窗口 */
  function primeVideoForAutoplay(el) {
    if (!el) return;
    el.muted = true;
    el.playsInline = true;
    el.play().catch(() => {});
  }

  function pausePlayback() {
    if (player) player.pause();
    else videoEl?.pause();
  }

  function togglePlay() {
    if (!streamActive.value) return;
    if (playing.value) {
      pausePlayback();
    } else if (mutedAutoplay.value) {
      unlockAutoplay();
    } else {
      resumePlayback();
    }
    queueMicrotask(syncPlaying);
  }

  function switchUrl(url) {
    if (!url || !videoEl) return false;
    if (player?.switchURL) {
      try {
        player.switchURL(url, true);
        resumePlayback();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  function playFlv(el, url, { onError, onReady } = {}) {
    const flv = flvjs();
    if (!flv.isSupported()) {
      throw new Error("当前浏览器不支持 flv.js");
    }
    destroy();
    bindVideoEvents(el);
    streamActive.value = true;

    player = flv.createPlayer(
      {
        type: "flv",
        url,
        isLive: true,
        hasAudio: true,
        hasVideo: true,
      },
      {
        enableWorker: false,
        enableStashBuffer: true,
        stashInitialSize: 512 * 1024,
        lazyLoad: false,
        autoCleanupSourceBuffer: true,
        fixAudioTimestampGap: true,
      },
    );

    player.attachMediaElement(el);
    el.muted = true;
    el.playsInline = true;
    mutedAutoplay.value = true;
    muted.value = true;
    player.on(flv.Events.ERROR, () => {
      if (!streamActive.value) return;
      onError?.();
    });
    player.on(flv.Events.MEDIA_INFO, () => {
      resumePlayback();
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
    autoplayBlocked,
    mutedAutoplay,
    volume,
    muted,
    destroy,
    playFlv,
    togglePlay,
    pausePlayback,
    resumePlayback,
    switchUrl,
    unlockAutoplay,
    primeVideoForAutoplay,
    setVolume,
    toggleMute,
  };
}
