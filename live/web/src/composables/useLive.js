import { ref } from "vue";
import {
  fetchRoom,
  mergePayload,
  parseRoomId,
  qualityNames,
  streamByName,
  streamHasUrl,
  findQualityIndex,
  currentPlayUrl,
} from "../api/room";
import { getPlatform, PREFS_KEY } from "../config/platforms";

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

  function fillFromPayload(data, preferredName = "") {
    const names = qualityNames(data);
    const preferred = preferredName || loadPrefs().qualityName || "";
    qualityIndex.value = findQualityIndex(names, preferred);
    const stream = streamByName(data, names[qualityIndex.value]);
    lineIndex.value = 0;
    if (stream?.lines?.length) {
      lineIndex.value = Math.min(lineIndex.value, stream.lines.length - 1);
    }
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
      const preferred = loadPrefs().qualityName || "";
      const data = await fetchRoom({
        site,
        room: roomId,
        mode: "lazy",
        quality: preferred || undefined,
      });

      if (!data.is_live && !data.status) {
        payload.value = data;
        throw new Error("房间未开播");
      }

      payload.value = data;
      fillFromPayload(data, preferred);
      setStatus(`${platform.label} · 解析完成`);

      if (autoPlay && playFn) {
        await playFn();
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
    fillFromPayload(payload.value, qualityName);
    return payload.value;
  }

  async function resolvePlayUrl() {
    const names = qualityNames(payload.value);
    const qualityName = names[qualityIndex.value];
    if (!qualityName) throw new Error("未选择清晰度");
    savePrefs({ qualityName });
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
  }

  function onLineChange(index) {
    lineIndex.value = Number(index) || 0;
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
    savePrefs,
  };
}

export function usePlayer() {
  const playing = ref(false);
  let player = null;

  function flvjs() {
    const api = window.flvjs;
    if (!api) {
      throw new Error("flv.js 未加载，请确认 index.html 已引入 /flv.min.js");
    }
    return api;
  }

  function destroy() {
    playing.value = false;
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

  function playFlv(videoEl, url, { onError, onReady } = {}) {
    const flv = flvjs();
    if (!flv.isSupported()) {
      throw new Error("当前浏览器不支持 flv.js");
    }
    destroy();
    playing.value = true;

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

    player.attachMediaElement(videoEl);
    player.on(flv.Events.ERROR, () => {
      if (!playing.value) return;
      onError?.();
    });
    player.on(flv.Events.MEDIA_INFO, () => {
      videoEl.play().catch(() => {});
    });
    const onPlaying = () => {
      playing.value = true;
      onReady?.();
    };
    videoEl.addEventListener("playing", onPlaying, { once: true });
    player.load();
    player.play().catch(() => {});
  }

  return { playing, destroy, playFlv };
}
