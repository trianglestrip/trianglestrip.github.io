/** 快速探测 B 站弹幕 WS 是否收到 DANMU_MSG */
import WebSocket from "ws";
import { brotliDecompressSync, inflateSync } from "node:zlib";

const room = process.argv[2] || "817160";
const api = "http://127.0.0.1:8765";

function encodePacket(op, body = "") {
  const bodyBytes = body ? Buffer.from(body, "utf8") : Buffer.alloc(0);
  const packetLen = 16 + bodyBytes.length;
  const buf = Buffer.alloc(packetLen);
  buf.writeInt32BE(packetLen, 0);
  buf.writeInt16BE(16, 4);
  buf.writeInt16BE(1, 6);
  buf.writeInt32BE(op, 8);
  buf.writeInt32BE(1, 12);
  bodyBytes.copy(buf, 16);
  return buf;
}

function decompressBody(body, ver) {
  if (ver === 2) return inflateSync(body);
  if (ver === 3) return brotliDecompressSync(body);
  return body;
}

function countDanmuInBuffer(data, stats) {
  let offset = 0;
  while (offset + 16 <= data.length) {
    const packetLen = data.readInt32BE(offset);
    if (packetLen < 16 || offset + packetLen > data.length) break;
    const ver = data.readInt16BE(offset + 6);
    const op = data.readInt32BE(offset + 8);
    stats.opCounts[op] = (stats.opCounts[op] || 0) + 1;
    const body = data.subarray(offset + 16, offset + packetLen);
    if (op === 5) {
      if (ver === 2 || ver === 3) {
        try {
          countDanmuInBuffer(decompressBody(body, ver), stats);
        } catch {
          /* ignore */
        }
      } else {
        const text = body.toString("utf8");
        if (text.includes("DANMU_MSG")) stats.danmuCount += 1;
      }
    }
    offset += packetLen;
  }
}

const sessionRes = await fetch(`${api}/api/bilibili/danmaku?room=${room}`);
const session = await sessionRes.json();
if (!session.ok) throw new Error(session.error || "danmaku session failed");

const buvidRes = await fetch("https://www.bilibili.com/", { redirect: "manual" });
const setCookies = buvidRes.headers.getSetCookie?.() ?? [];
const cookie = setCookies.map((item) => item.split(";")[0]).join("; ");

const host = String(session.host).replace(/^https?:\/\//, "");
const url = `wss://${host}:${session.wss_port || 443}/sub`;
const auth = JSON.stringify({
  uid: 0,
  roomid: Number(session.room_id),
  protover: 3,
  platform: "web",
  type: 2,
  key: session.token,
});

const stats = { danmuCount: 0, opCounts: {}, connected: false, authOk: false, msgCount: 0 };

const ws = new WebSocket(url, {
  headers: {
    Origin: "https://live.bilibili.com",
    Referer: `https://live.bilibili.com/${room}`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    ...(cookie ? { Cookie: cookie } : {}),
  },
});
const timer = setTimeout(() => {
  console.log(JSON.stringify({ ok: stats.connected, ...stats, timeout: true }));
  ws.close();
  process.exit(stats.connected ? 0 : 1);
}, 15000);

ws.on("open", () => {
  stats.connected = true;
  ws.send(encodePacket(7, auth));
  setInterval(() => ws.send(encodePacket(2)), 30000);
});

ws.on("close", (code, reason) => {
  stats.closeCode = code;
  stats.closeReason = reason?.toString?.() || "";
});

ws.on("message", (data) => {
  stats.msgCount = (stats.msgCount || 0) + 1;
  stats.lastMsgLen = data.length;
  countDanmuInBuffer(data, stats);
  if (stats.opCounts[8]) stats.authOk = true;
  if (stats.danmuCount >= 2) {
    clearTimeout(timer);
    console.log(JSON.stringify({ ok: true, ...stats }));
    ws.close();
    process.exit(0);
  }
});

ws.on("error", (err) => {
  clearTimeout(timer);
  console.log(JSON.stringify({ ok: false, error: err.message, ...stats }));
  process.exit(1);
});
