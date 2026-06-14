import {
  bilibiliDanmakuWsUrl,
  buildBilibiliAuthPacket,
  buildBilibiliHeartbeatPacket,
  fetchBilibiliDanmakuSession,
} from "../../utils/bilibiliDanmaku.js";

export async function connectBilibili(ctx, roomId) {
  const { bindSocketHandlers, clearTimers, ensureParseWorker, messages, scheduleReconnect, status, wsRef, heartbeatRef } =
    ctx;

  messages.value = [];
  status.value = "弹幕准备中…";
  ensureParseWorker();

  let session;
  try {
    session = await fetchBilibiliDanmakuSession(roomId);
  } catch (err) {
    status.value = `B 站弹幕参数获取失败：${err?.message || err}`;
    scheduleReconnect();
    return;
  }

  status.value = "弹幕连接中…";
  wsRef.current = new WebSocket(bilibiliDanmakuWsUrl(session));
  bindSocketHandlers("bilibili");

  const prevOnOpen = wsRef.current.onopen;
  wsRef.current.onopen = () => {
    prevOnOpen?.();
    wsRef.current.send(buildBilibiliAuthPacket(session));
    clearTimers();
    heartbeatRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(buildBilibiliHeartbeatPacket());
      }
    }, 30000);
  };
}
