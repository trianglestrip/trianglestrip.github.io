import { buildHuyaJoinPayload, HUYA_HEARTBEAT, parseHuyaChatMessages } from "../src/utils/huyaJce.js";

const roomId = process.argv[2] || "660000";
const apiBase = process.env.API_BASE || "http://127.0.0.1:8765";

async function fetchSession(room) {
  const res = await fetch(`${apiBase}/api/huya/danmaku?room=${room}`);
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function main() {
  const session = await fetchSession(roomId);
  console.log(`[huya] room=${roomId} ayyuid=${session.ayyuid} topSid=${session.topSid}`);

  const ws = new WebSocket("wss://cdnws.api.huya.com/");
  ws.binaryType = "arraybuffer";

  let heartbeat = null;
  let count = 0;

  ws.onopen = () => {
    console.log("[huya] connected");
    ws.send(buildHuyaJoinPayload(session.ayyuid, session.topSid));
    heartbeat = setInterval(() => ws.send(HUYA_HEARTBEAT), 60000);
  };

  ws.onmessage = (event) => {
    const chats = parseHuyaChatMessages(event.data);
    for (const chat of chats) {
      count += 1;
      console.log(`[chat ${count}] ${chat.user}: ${chat.text}`);
    }
  };

  ws.onerror = (err) => console.error("[huya] error", err);
  ws.onclose = () => {
    clearInterval(heartbeat);
    console.log("[huya] closed");
  };

  setTimeout(() => {
    console.log(`[huya] done, received ${count} chat messages`);
    ws.close();
    process.exit(0);
  }, 20000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
