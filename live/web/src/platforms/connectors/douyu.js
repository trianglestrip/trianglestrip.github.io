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

export function connectDouyu(ctx, roomId) {
  const { bindSocketHandlers, clearTimers, ensureParseWorker, messages, scheduleReconnect, status, wsRef } = ctx;

  messages.value = [];
  status.value = "弹幕连接中…";
  ensureParseWorker();

  wsRef.current = new WebSocket("wss://danmuproxy.douyu.com:8506/");
  bindSocketHandlers("douyu");

  const prevOnOpen = wsRef.current.onopen;
  wsRef.current.onopen = () => {
    prevOnOpen?.();
    wsRef.current.send(encodeDouyuMsg(`type@=loginreq/roomid@=${roomId}/`));
    wsRef.current.send(encodeDouyuMsg(`type@=joingroup/rid@=${roomId}/gid@=-9999/`));
    clearTimers();
    ctx.heartbeatRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(encodeDouyuMsg("type@=mrkl/"));
      }
    }, 45000);
  };
}
