import { ref, watch, onUnmounted } from "vue";
import { getDanmakuConnector } from "../platforms/danmakuRegistry.js";
import {
  loadGlobalPref,
  loadJson,
  migrateGlobalCookiePref,
  migrateLocalPref,
  platformPrefKey,
  saveGlobalPref,
} from "../utils/prefStore.js";

const DEFAULT_OVERLAY = {
  show: true,
  opacity: 100,
  fontSize: 20,
  speed: 5,
  area: 1,
};

const DEFAULT_CHAT = {
  show: true,
  opacity: 100,
  fontSize: 14,
  gap: 4,
  speedLimit: true,
  /** 开启限速后，每隔 N 秒显示 1 条 */
  speed: 1,
};

/** 聊天列表与飘屏共用的消息缓冲上限 */
const MESSAGE_LIMIT = 100;

const DANMAKU_PLATFORMS = ["douyu", "huya", "bilibili", "douyin"];

function migratePlatformDanmakuPref(category) {
  return () => {
    for (const site of DANMAKU_PLATFORMS) {
      const key = platformPrefKey(site, category);
      const stored = loadJson(key);
      if (stored && typeof stored === "object" && Object.keys(stored).length) {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(key);
        }
        return stored;
      }
    }
    return null;
  };
}

function loadOverlaySettings() {
  return loadGlobalPref("danmaku.overlay", DEFAULT_OVERLAY, [
    migrateGlobalCookiePref("", "", "lemon_dm_overlay", DEFAULT_OVERLAY),
    migrateLocalPref("", "", "lemon_danmaku_settings"),
    migratePlatformDanmakuPref("danmaku.overlay"),
  ]);
}

function loadChatSettings() {
  return loadGlobalPref("danmaku.chat", DEFAULT_CHAT, [
    migrateGlobalCookiePref("", "", "lemon_dm_chat", DEFAULT_CHAT),
    migratePlatformDanmakuPref("danmaku.chat"),
  ]);
}

export function useDanmaku(siteRef, roomIdRef) {
  const messages = ref([]);
  const status = ref("等待连接…");
  const roomMeta = ref({ liveStartAt: 0, fanGroup: "" });
  const overlaySettings = ref(loadOverlaySettings());
  const chatSettings = ref(loadChatSettings());

  const wsRef = { current: null };
  const eventSourceRef = { current: null };
  const heartbeatRef = { current: null };
  let reconnectTimer = null;
  let parseWorker = null;
  let parseSeq = 0;
  let activeSite = null;
  let pendingMsgs = [];
  let flushRaf = 0;
  const aliveRef = { current: true };

  watch(
    overlaySettings,
    (val) => {
      saveGlobalPref("danmaku.overlay", val);
    },
    { deep: true },
  );

  watch(
    chatSettings,
    (val) => {
      saveGlobalPref("danmaku.chat", val);
    },
    { deep: true },
  );

  function ensureParseWorker() {
    if (parseWorker) return parseWorker;
    parseWorker = new Worker(new URL("../workers/danmaku.worker.js", import.meta.url), {
      type: "module",
    });
    parseWorker.onmessage = (event) => {
      if (!parseWorker || !aliveRef.current || event.data?.type !== "messages") return;
      queueMsgs(event.data.items || []);
    };
    return parseWorker;
  }

  function releaseParseWorker() {
    if (flushRaf) {
      cancelAnimationFrame(flushRaf);
      flushRaf = 0;
    }
    pendingMsgs = [];
    if (!parseWorker) return;
    parseWorker.onmessage = null;
    parseWorker.terminate();
    parseWorker = null;
    parseSeq = 0;
  }

  function trimMessages() {
    if (messages.value.length > MESSAGE_LIMIT) {
      messages.value.splice(0, messages.value.length - MESSAGE_LIMIT);
    }
  }

  /** 聊天侧栏按可视高度裁剪时，从头部删除最旧消息 */
  function trimFromStart(count) {
    const n = Math.min(Math.max(0, Number(count) || 0), messages.value.length);
    if (n > 0) messages.value.splice(0, n);
  }

  function flushPendingMsgs() {
    flushRaf = 0;
    if (!aliveRef.current || !pendingMsgs.length) return;
    messages.value.push(...pendingMsgs);
    pendingMsgs = [];
    trimMessages();
  }

  function queueMsgs(items) {
    if (!aliveRef.current || !items.length) return;
    pendingMsgs.push(...items);
    if (flushRaf) return;
    flushRaf = requestAnimationFrame(flushPendingMsgs);
  }

  function clearTimers() {
    clearInterval(heartbeatRef.current);
    clearTimeout(reconnectTimer);
    heartbeatRef.current = null;
    reconnectTimer = null;
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 3000);
  }

  function bindSocketHandlers(site) {
    activeSite = site;
    wsRef.current.binaryType = "arraybuffer";

    wsRef.current.onopen = () => {
      status.value = "弹幕已连接";
    };

    wsRef.current.onmessage = (event) => {
      const buffer = event.data;
      if (!(buffer instanceof ArrayBuffer)) return;
      parseSeq += 1;
      ensureParseWorker().postMessage({ type: "parse", site: activeSite, buffer, seq: parseSeq }, [buffer]);
    };

    wsRef.current.onerror = () => {
      status.value = "弹幕连接出错";
    };

    wsRef.current.onclose = () => {
      status.value = "弹幕重连中…";
      clearTimers();
      scheduleReconnect();
    };
  }

  const connectorCtx = {
    messages,
    status,
    roomMeta,
    wsRef,
    eventSourceRef,
    heartbeatRef,
    aliveRef,
    bindSocketHandlers,
    clearTimers,
    ensureParseWorker,
    queueMsgs,
    scheduleReconnect,
  };

  function connect() {
    disconnect(false);
    const site = siteRef.value;
    const roomId = String(roomIdRef.value || "").trim();
    if (!roomId) {
      status.value = "缺少房间号";
      return;
    }
    const connector = getDanmakuConnector(site);
    if (!connector) {
      status.value = "暂不支持该平台弹幕";
      return;
    }
    connector(connectorCtx, roomId);
  }

  function disconnect(resetStatus = true) {
    clearTimers();
    releaseParseWorker();
    activeSite = null;
    pendingMsgs = [];
    messages.value = [];
    roomMeta.value = { liveStartAt: 0, fanGroup: "" };
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (resetStatus) {
      status.value = "弹幕已断开";
    }
  }

  onUnmounted(() => {
    aliveRef.current = false;
    disconnect();
  });

  return {
    messages,
    status,
    roomMeta,
    overlaySettings,
    chatSettings,
    connect,
    disconnect,
    trimFromStart,
  };
}
