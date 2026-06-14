import { buildHuyaJoinPayload, fetchHuyaDanmakuSession, HUYA_HEARTBEAT } from "../../utils/huyaDanmaku.js";

export async function connectHuya(ctx, roomId) {
  const { bindSocketHandlers, clearTimers, ensureParseWorker, messages, scheduleReconnect, status, wsRef, heartbeatRef } =
    ctx;

  messages.value = [];
  status.value = "弹幕准备中…";
  ensureParseWorker();

  let session;
  try {
    session = await fetchHuyaDanmakuSession(roomId);
  } catch (err) {
    status.value = `虎牙弹幕参数获取失败：${err?.message || err}`;
    scheduleReconnect();
    return;
  }

  status.value = "弹幕连接中…";
  wsRef.current = new WebSocket("wss://cdnws.api.huya.com/");
  bindSocketHandlers("huya");

  const prevOnOpen = wsRef.current.onopen;
  wsRef.current.onopen = () => {
    prevOnOpen?.();
    wsRef.current.send(buildHuyaJoinPayload(session.ayyuid, session.topSid));
    clearTimers();
    heartbeatRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(HUYA_HEARTBEAT);
      }
    }, 60000);
  };
}
