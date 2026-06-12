import { ref, watch, onUnmounted } from "vue";
import {
  loadPlatformPref,
  migrateGlobalCookiePref,
  migrateLocalPref,
  savePlatformPref,
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
};

function loadOverlaySettings(site) {
  return loadPlatformPref(site, "danmaku.overlay", DEFAULT_OVERLAY, [
    migrateGlobalCookiePref(site, "danmaku.overlay", "lemon_dm_overlay", DEFAULT_OVERLAY, "douyu"),
    migrateLocalPref(site, "danmaku.overlay", "lemon_danmaku_settings", "douyu"),
  ]);
}

function loadChatSettings(site) {
  return loadPlatformPref(site, "danmaku.chat", DEFAULT_CHAT, [
    migrateGlobalCookiePref(site, "danmaku.chat", "lemon_dm_chat", DEFAULT_CHAT, "douyu"),
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
  const overlaySettings = ref(loadOverlaySettings(siteRef.value));
  const chatSettings = ref(loadChatSettings(siteRef.value));

  let ws = null;
  let heartbeat = null;
  let reconnectTimer = null;
  let parseWorker = null;
  let parseSeq = 0;
  let syncingPrefs = false;

  function reloadPlatformPrefs(site) {
    syncingPrefs = true;
    overlaySettings.value = loadOverlaySettings(site);
    chatSettings.value = loadChatSettings(site);
    syncingPrefs = false;
  }

  watch(siteRef, (site) => {
    reloadPlatformPrefs(site);
  });

  watch(
    overlaySettings,
    (val) => {
      if (syncingPrefs) return;
      savePlatformPref(siteRef.value, "danmaku.overlay", val);
    },
    { deep: true },
  );

  watch(
    chatSettings,
    (val) => {
      if (syncingPrefs) return;
      savePlatformPref(siteRef.value, "danmaku.chat", val);
    },
    { deep: true },
  );

  function ensureParseWorker() {
    if (parseWorker) return parseWorker;
    parseWorker = new Worker(new URL("../workers/danmaku.worker.js", import.meta.url));
    parseWorker.onmessage = (event) => {
      if (event.data?.type !== "messages") return;
      for (const item of event.data.items) {
        pushMsg(item);
      }
    };
    return parseWorker;
  }

  function releaseParseWorker() {
    if (!parseWorker) return;
    parseWorker.terminate();
    parseWorker = null;
    parseSeq = 0;
  }

  function pushMsg(entry) {
    messages.value.push(entry);
    if (messages.value.length > 300) {
      messages.value.splice(0, messages.value.length - 300);
    }
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

  function connect() {
    disconnect(false);
    const site = siteRef.value;
    const roomId = String(roomIdRef.value || "").trim();
    if (!roomId) {
      status.value = "缺少房间号";
      return;
    }
    if (site !== "douyu") {
      status.value = "暂不支持该平台弹幕";
      return;
    }

    messages.value = [];
    status.value = "开始连接弹幕服务器";
    ensureParseWorker();

    ws = new WebSocket("wss://danmuproxy.douyu.com:8506/");
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      status.value = "弹幕服务器连接成功";
      ws.send(encodeDouyuMsg(`type@=loginreq/roomid@=${roomId}/`));
      ws.send(encodeDouyuMsg(`type@=joingroup/rid@=${roomId}/gid@=-9999/`));
      heartbeat = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(encodeDouyuMsg("type@=mrkl/"));
        }
      }, 45000);
    };

    ws.onmessage = (event) => {
      const buffer = event.data;
      if (!(buffer instanceof ArrayBuffer)) return;
      parseSeq += 1;
      ensureParseWorker().postMessage({ type: "parse", buffer, seq: parseSeq }, [buffer]);
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

  function disconnect(resetStatus = true) {
    clearTimers();
    releaseParseWorker();
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
