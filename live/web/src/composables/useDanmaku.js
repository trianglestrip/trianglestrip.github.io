import { ref, watch, onUnmounted } from "vue";
import {
  loadGlobalPref,
  loadJson,
  migrateGlobalCookiePref,
  migrateLocalPref,
  platformPrefKey,
  saveGlobalPref,
} from "../utils/prefStore.js";
import {
  buildHuyaJoinPayload,
  fetchHuyaDanmakuSession,
  HUYA_HEARTBEAT,
} from "../utils/huyaDanmaku.js";

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
};

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

function encodeDouyuMsg(msg) {
  const payload = new TextEncoder().encode(`${msg}\0`);
  const len = payload.length + 8;
  const buf = new ArrayBuffer(len + 4);
  const view = new DataView(buf);
  view.setInt32(0, len, true);
  view.setInt32(4, len, true);
  view.setInt16(8, 689, true);
  view.setInt16(10, 0, true);
  new Uint8Array(buf, 12).set(payload);
  return buf;
}

export function useDanmaku(siteRef, roomIdRef) {
  const messages = ref([]);
  const status = ref("等待连接…");
  const overlaySettings = ref(loadOverlaySettings());
  const chatSettings = ref(loadChatSettings());

  let ws = null;
  let heartbeat = null;
  let reconnectTimer = null;
  let parseWorker = null;
  let parseSeq = 0;
  let activeSite = null;
  let pendingMsgs = [];
  let flushRaf = 0;
  let alive = true;

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
      if (!parseWorker || !alive || event.data?.type !== "messages") return;
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
    if (messages.value.length > 300) {
      messages.value.splice(0, messages.value.length - 300);
    }
  }

  function flushPendingMsgs() {
    flushRaf = 0;
    if (!alive || !pendingMsgs.length) return;
    messages.value.push(...pendingMsgs);
    pendingMsgs = [];
    trimMessages();
  }

  function queueMsgs(items) {
    if (!alive || !items.length) return;
    pendingMsgs.push(...items);
    if (flushRaf) return;
    flushRaf = requestAnimationFrame(flushPendingMsgs);
  }

  function clearTimers() {
    clearInterval(heartbeat);
    clearTimeout(reconnectTimer);
    heartbeat = null;
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
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      status.value = "弹幕服务器连接成功";
    };

    ws.onmessage = (event) => {
      const buffer = event.data;
      if (!(buffer instanceof ArrayBuffer)) return;
      parseSeq += 1;
      ensureParseWorker().postMessage({ type: "parse", site: activeSite, buffer, seq: parseSeq }, [buffer]);
    };

    ws.onerror = () => {
      status.value = "弹幕连接出错";
    };

    ws.onclose = () => {
      status.value = "弹幕服务器已断开，3 秒后重连…";
      clearTimers();
      scheduleReconnect();
    };
  }

  function connectDouyu(roomId) {
    messages.value = [];
    status.value = "开始连接弹幕服务器";
    ensureParseWorker();

    ws = new WebSocket("wss://danmuproxy.douyu.com:8506/");
    bindSocketHandlers("douyu");

    const prevOnOpen = ws.onopen;
    ws.onopen = () => {
      prevOnOpen?.();
      ws.send(encodeDouyuMsg(`type@=loginreq/roomid@=${roomId}/`));
      ws.send(encodeDouyuMsg(`type@=joingroup/rid@=${roomId}/gid@=-9999/`));
      heartbeat = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(encodeDouyuMsg("type@=mrkl/"));
        }
      }, 45000);
    };
  }

  async function connectHuya(roomId) {
    messages.value = [];
    status.value = "正在获取虎牙房间信息…";
    ensureParseWorker();

    let session;
    try {
      session = await fetchHuyaDanmakuSession(roomId);
    } catch (err) {
      status.value = `虎牙弹幕参数获取失败：${err?.message || err}`;
      scheduleReconnect();
      return;
    }

    status.value = "开始连接虎牙弹幕服务器";
    ws = new WebSocket("wss://cdnws.api.huya.com/");
    bindSocketHandlers("huya");

    const prevOnOpen = ws.onopen;
    ws.onopen = () => {
      prevOnOpen?.();
      ws.send(buildHuyaJoinPayload(session.ayyuid, session.topSid));
      heartbeat = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(HUYA_HEARTBEAT);
        }
      }, 60000);
    };
  }

  function connect() {
    disconnect(false);
    const site = siteRef.value;
    const roomId = String(roomIdRef.value || "").trim();
    if (!roomId) {
      status.value = "缺少房间号";
      return;
    }
    if (site === "douyu") {
      connectDouyu(roomId);
      return;
    }
    if (site === "huya") {
      connectHuya(roomId);
      return;
    }
    status.value = "暂不支持该平台弹幕";
  }

  function disconnect(resetStatus = true) {
    clearTimers();
    releaseParseWorker();
    activeSite = null;
    pendingMsgs = [];
    messages.value = [];
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
    if (resetStatus) {
      status.value = "弹幕已断开";
    }
  }

  onUnmounted(() => {
    alive = false;
    disconnect();
  });

  return {
    messages,
    status,
    overlaySettings,
    chatSettings,
    connect,
    disconnect,
  };
}
