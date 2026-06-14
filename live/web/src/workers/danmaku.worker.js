import { parseHuyaChatMessages } from "../utils/huyaJce.js";

function parseDouyuMsg(buffer) {
  const view = new DataView(buffer);
  const msgs = [];
  let offset = 0;
  const decoder = new TextDecoder("utf-8");
  while (offset + 12 < buffer.byteLength) {
    const len = view.getInt32(offset, true);
    if (len <= 8 || offset + len + 4 > buffer.byteLength) break;
    const end = offset + len + 4 - 1;
    msgs.push(decoder.decode(new Uint8Array(buffer, offset + 12, end - (offset + 12))));
    offset += len + 4;
  }
  return msgs;
}

function parseChatMsg(raw) {
  const msg = {};
  for (const part of raw.split("/")) {
    if (!part) continue;
    const idx = part.indexOf("@=");
    if (idx === -1) continue;
    const key = part.slice(0, idx);
    const value = part.slice(idx + 2).replace(/@S/g, "/").replace(/@A/g, "@");
    msg[key] = value;
  }
  return msg;
}

function colorFromDouyu(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "#ffffff";
  return `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;
}

function colorFromDecimal(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "#ffffff";
  return `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;
}

function parseDouyuBuffer(buffer, seq) {
  const items = [];
  let localSeq = 0;
  for (const raw of parseDouyuMsg(buffer)) {
    if (!raw.includes("type@=chatmsg")) continue;
    const msg = parseChatMsg(raw);
    if (!msg.nn || !msg.txt) continue;
    localSeq += 1;
    items.push({
      id: msg.cid || `${seq}-${localSeq}`,
      user: msg.nn,
      text: msg.txt,
      color: colorFromDouyu(msg.col),
    });
  }
  return items;
}

function parseHuyaBuffer(buffer, seq) {
  const items = [];
  let localSeq = 0;
  for (const chat of parseHuyaChatMessages(buffer)) {
    localSeq += 1;
    items.push({
      id: `${seq}-${localSeq}`,
      user: chat.user,
      text: chat.text,
      color: chat.color,
    });
  }
  return items;
}

function readInt32Be(view, offset) {
  return view.getInt32(offset, false);
}

function splitPackets(buffer) {
  const view = new DataView(buffer);
  const packets = [];
  let offset = 0;
  while (offset + 16 <= buffer.byteLength) {
    const packetLen = readInt32Be(view, offset);
    if (packetLen < 16 || offset + packetLen > buffer.byteLength) break;
    const headerLen = view.getInt16(offset + 4, false);
    const ver = view.getInt16(offset + 6, false);
    const op = readInt32Be(view, offset + 8);
    const body = buffer.slice(offset + headerLen, offset + packetLen);
    packets.push({ ver, op, body });
    offset += packetLen;
  }
  return packets;
}

async function decompressBrotli(buffer) {
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("brotli"));
  return new Response(stream).arrayBuffer();
}

function danmakuTextFromInfo(info) {
  const segment = info?.[1];
  if (typeof segment === "string") return segment;
  if (Array.isArray(segment)) {
    if (typeof segment[0] === "string") return segment[0];
    if (Array.isArray(segment[0])) return segment[0][1] || segment[0][0] || "";
  }
  return "";
}

function extractBilibiliDanmaku(data, seq, localSeqRef) {
  if (data?.cmd !== "DANMU_MSG" || !Array.isArray(data.info)) return null;
  const info = data.info;
  const text = danmakuTextFromInfo(info);
  const user = info?.[2]?.[1] || "";
  if (!text || !user) return null;
  localSeqRef.value += 1;
  return {
    id: `${seq}-${localSeqRef.value}`,
    user,
    text,
    color: colorFromDecimal(info?.[0]?.[3]),
  };
}

function parseBilibiliJsonMessages(body, seq, localSeqRef) {
  const items = [];
  const text = new TextDecoder("utf-8").decode(body).trim();
  if (!text) return items;

  const chunks = text.includes("\0") ? text.split("\0") : [text];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    try {
      const data = JSON.parse(trimmed);
      const item = extractBilibiliDanmaku(data, seq, localSeqRef);
      if (item) items.push(item);
    } catch {
      /* 忽略非 JSON 片段 */
    }
  }
  return items;
}

async function parseBilibiliPackets(buffer, seq, localSeqRef) {
  const items = [];
  for (const packet of splitPackets(buffer)) {
    if (packet.op !== 5) continue;
    if (packet.ver === 1) {
      try {
        const inflated = await decompressBrotli(packet.body);
        items.push(...(await parseBilibiliPackets(inflated, seq, localSeqRef)));
      } catch {
        /* brotli 解压失败 */
      }
      continue;
    }
    items.push(...parseBilibiliJsonMessages(packet.body, seq, localSeqRef));
  }
  return items;
}

async function parseBilibiliBuffer(buffer, seq) {
  const localSeqRef = { value: 0 };
  return parseBilibiliPackets(buffer, seq, localSeqRef);
}

self.onmessage = async (event) => {
  const { type, site = "douyu", buffer, seq } = event.data;
  if (type !== "parse" || !(buffer instanceof ArrayBuffer)) return;

  let items = [];
  if (site === "huya") {
    items = parseHuyaBuffer(buffer, seq);
  } else if (site === "bilibili") {
    items = await parseBilibiliBuffer(buffer, seq);
  } else {
    items = parseDouyuBuffer(buffer, seq);
  }

  if (items.length) {
    self.postMessage({ type: "messages", items });
  }
};
