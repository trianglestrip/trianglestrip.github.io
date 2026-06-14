import { apiUrl } from "../../config/app.js";

export function connectDouyin(ctx, roomId) {
  const { eventSourceRef, messages, queueMsgs, roomMeta, scheduleReconnect, status, aliveRef } = ctx;

  messages.value = [];
  roomMeta.value = { liveStartAt: 0, fanGroup: "" };
  status.value = "弹幕连接中…";
  const url = apiUrl(`/api/douyin/danmaku/stream?room=${encodeURIComponent(roomId)}`);
  eventSourceRef.current = new EventSource(url);

  eventSourceRef.current.addEventListener("ready", () => {
    status.value = "弹幕已连接";
  });

  eventSourceRef.current.addEventListener("chat", (event) => {
    try {
      const item = JSON.parse(event.data);
      if (item?.user && item?.text) queueMsgs([item]);
    } catch {
      /* ignore malformed payload */
    }
  });

  eventSourceRef.current.addEventListener("close", () => {
    if (!aliveRef.current) return;
    status.value = "弹幕重连中…";
    scheduleReconnect();
  });

  eventSourceRef.current.onerror = () => {
    if (!aliveRef.current) return;
    if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
      status.value = "弹幕重连中…";
      scheduleReconnect();
      return;
    }
    status.value = "弹幕连接出错";
  };
}
