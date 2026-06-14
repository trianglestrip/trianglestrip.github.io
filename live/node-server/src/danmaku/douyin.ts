import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import type { ServerResponse } from "node:http";
import WebSocket from "ws";
import {
  DOUYIN_PC_HEADERS,
  fetchDouyinSessionCookie,
  fetchWebStreamData,
  resolveDouyinInternalRoomId,
} from "../resolve/douyin/web-stream.js";
import type { ServerConfig } from "../config/load-config.js";
import { applyCorsHeaders } from "../middleware/cors.js";
import {
  decodeFields,
  encodePushFrame,
  fieldBool,
  fieldBytes,
  fieldString,
  fieldUint,
  parseChatMessage,
  parseCommonCreateTime,
  parseEmojiChatMessage,
  parseUpdateFanTicketMessage,
  repeatedBytes,
  isPlausibleLiveStartAt,
} from "./protobuf-lite.js";
import { patchDouyinRoomMeta } from "./douyin-meta.js";

const WS_HOST = "wss://webcast100-ws-web-lq.douyin.com/webcast/im/push/v2/";
const SIGN_KEYS = [
  "live_id",
  "aid",
  "version_code",
  "webcast_sdk_version",
  "room_id",
  "sub_room_id",
  "sub_channel_id",
  "did_rule",
  "user_unique_id",
  "device_platform",
  "device_type",
  "ac",
  "identity",
] as const;

let wsSignFn: ((md5: string) => string) | null = null;

function loadWsSign(): (md5: string) => string {
  if (wsSignFn) return wsSignFn;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "../../vendor/douyin-ws-sign.cjs"),
    path.join(here, "../vendor/douyin-ws-sign.cjs"),
    path.join(process.cwd(), "vendor/douyin-ws-sign.cjs"),
  ];
  const require = createRequire(import.meta.url);
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    wsSignFn = require(candidate).get_sign as (md5: string) => string;
    return wsSignFn;
  }
  throw new Error("缺少 douyin-ws-sign.cjs");
}

function randomUserUniqueId(): string {
  const base = BigInt("7319483754668557238");
  const jitter = BigInt(Math.floor(Math.random() * 1_000_000));
  return String(base + jitter);
}

function buildWsUrl(internalRoomId: string): string {
  const userUniqueId = randomUserUniqueId();
  const now = Date.now();
  const params = new URLSearchParams({
    app_name: "douyin_web",
    version_code: "180800",
    webcast_sdk_version: "1.0.14-beta.0",
    update_version_code: "1.0.14-beta.0",
    compress: "gzip",
    device_platform: "web",
    cookie_enabled: "true",
    screen_width: "1920",
    screen_height: "1080",
    browser_language: "zh-CN",
    browser_platform: "Win32",
    browser_name: "Mozilla",
    browser_version:
      "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    browser_online: "true",
    tz_name: "Asia/Shanghai",
    cursor: "d-1_u-1_fh-7392091211001140287_t-1721106114633_r-1",
    internal_ext: `internal_src:dim|wss_push_room_id:${internalRoomId}|wss_push_did:${userUniqueId}|first_req_ms:${now - 12}|fetch_time:${now}|seq:1|wss_info:0-${now}-0-0|wrds_v:7392094459690748497`,
    host: "https://live.douyin.com",
    aid: "6383",
    live_id: "1",
    did_rule: "3",
    endpoint: "live_pc",
    support_wrds: "1",
    user_unique_id: userUniqueId,
    im_path: "/webcast/im/fetch/",
    identity: "audience",
    need_persist_msg_count: "15",
    room_id: internalRoomId,
    heartbeatDuration: "0",
  });

  const query = params.toString();
  const pairs = query.split("&").map((part) => part.split("="));
  const map = Object.fromEntries(pairs.map(([k, v]) => [k, decodeURIComponent(v || "")]));
  const stub = SIGN_KEYS.map((key) => `${key}=${map[key] ?? ""}`).join(",");
  const signature = loadWsSign()(createHash("md5").update(stub).digest("hex"));
  return `${WS_HOST}?${query}&signature=${signature}`;
}

export interface DouyinDanmakuSession {
  room_id: string;
  internal_room_id: string;
  is_live: boolean;
}

export async function fetchDouyinDanmakuSession(webRid: string): Promise<DouyinDanmakuSession> {
  const rid = String(webRid).trim();
  if (!/^\d+$/.test(rid)) {
    throw new Error(`无效抖音房间号: ${webRid}`);
  }
  const room = await fetchWebStreamData(rid);
  const status = Number(room.status || 0);
  if (status !== 2) {
    throw new Error("房间未开播或缺少弹幕连接参数");
  }
  const internalRoomId = await resolveDouyinInternalRoomId(rid, room);
  if (!internalRoomId) {
    throw new Error("房间未开播或缺少弹幕连接参数");
  }
  return {
    room_id: rid,
    internal_room_id: internalRoomId,
    is_live: true,
  };
}

function writeSse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function extractTtwidCookie(cookie: string): string {
  const ttwid = (cookie.match(/ttwid=([^;]+)/) || [])[1]?.trim();
  return ttwid ? `ttwid=${ttwid}` : cookie;
}

function parseDouyinPushFrame(message: ArrayBuffer): {
  logId: number;
  payload: Uint8Array | null;
  needAck: boolean;
  internalExt: string;
  chats: Array<{ user: string; text: string }>;
  meta: { liveStartAt?: number; fanGroup?: string };
} {
  const frame = decodeFields(new Uint8Array(message));
  const logId = fieldUint(frame, 2);
  const encoding = fieldString(frame, 6);
  const payloadType = fieldString(frame, 7);
  const rawPayload = fieldBytes(frame, 8);
  if (payloadType === "hb" || !rawPayload) {
    return { logId, payload: null, needAck: false, internalExt: "", chats: [], meta: {} };
  }

  let body = rawPayload;
  if (encoding === "gzip" || (body[0] === 0x1f && body[1] === 0x8b)) {
    try {
      body = gunzipSync(body);
    } catch {
      return { logId, payload: null, needAck: false, internalExt: "", chats: [], meta: {} };
    }
  }

  const response = decodeFields(body);
  const needAck = fieldBool(response, 9);
  const internalExt = fieldString(response, 5);
  const chats: Array<{ user: string; text: string }> = [];
  const meta: { liveStartAt?: number; fanGroup?: string } = {};

  for (const msgBuf of repeatedBytes(response, 1)) {
    const msgFields = decodeFields(msgBuf);
    const method = fieldString(msgFields, 1);
    const payload = fieldBytes(msgFields, 2);
    if (!payload) continue;
    if (method === "WebcastChatMessage") {
      const chat = parseChatMessage(payload);
      if (chat) chats.push(chat);
      continue;
    }
    if (method === "WebcastEmojiChatMessage") {
      const chat = parseEmojiChatMessage(payload);
      if (chat) chats.push(chat);
      continue;
    }
    if (method === "WebcastRoomStatsMessage") {
      const liveStartAt = parseCommonCreateTime(payload);
      if (liveStartAt && isPlausibleLiveStartAt(liveStartAt)) meta.liveStartAt = liveStartAt;
      continue;
    }
    if (method === "WebcastUpdateFanTicketMessage") {
      const fan = parseUpdateFanTicketMessage(payload);
      if (fan?.fanGroup) meta.fanGroup = fan.fanGroup;
    }
  }

  return { logId, payload: body, needAck, internalExt, chats, meta };
}

function toArrayBuffer(data: unknown): ArrayBuffer | null {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
  }
  return null;
}

export async function streamDouyinDanmaku(
  webRid: string,
  req: { on: (event: string, cb: () => void) => void },
  res: ServerResponse,
  config: ServerConfig,
): Promise<void> {
  const session = await fetchDouyinDanmakuSession(webRid);
  const cookie = extractTtwidCookie(await fetchDouyinSessionCookie());
  const wsUrl = buildWsUrl(session.internal_room_id);

  const headers: Record<string, string | number> = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };
  applyCorsHeaders(headers, config.cors);
  res.writeHead(200, headers);

  let closed = false;
  let ws: WebSocket | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let seq = 0;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.close();
      ws = null;
    }
    if (!res.writableEnded) res.end();
  };

  req.on("close", cleanup);

  try {
    ws = new WebSocket(wsUrl, {
      headers: {
        cookie,
        "user-agent": DOUYIN_PC_HEADERS["user-agent"],
      },
    });
  } catch (err) {
    writeSse(res, "error", { message: err instanceof Error ? err.message : String(err) });
    cleanup();
    return;
  }

  ws.onopen = () => {
    writeSse(res, "ready", { room_id: session.room_id });
    heartbeat = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const hb = encodePushFrame({ payloadType: "hb" });
      ws.send(hb);
    }, 10_000);
  };

  ws.onmessage = (event) => {
    if (closed) return;
    const data = toArrayBuffer(event.data);
    if (!data) return;
    const parsed = parseDouyinPushFrame(data);
    if (parsed.needAck && parsed.internalExt && ws?.readyState === WebSocket.OPEN) {
      const ack = encodePushFrame({
        logId: parsed.logId,
        payloadType: "ack",
        payload: new TextEncoder().encode(parsed.internalExt),
      });
      ws.send(ack);
    }
    for (const chat of parsed.chats) {
      seq += 1;
      writeSse(res, "chat", {
        id: `${session.room_id}-${seq}`,
        user: chat.user,
        text: chat.text,
        color: "#ffffff",
      });
    }
    if (parsed.meta.liveStartAt || parsed.meta.fanGroup) {
      const meta = patchDouyinRoomMeta(session.room_id, parsed.meta);
      writeSse(res, "meta", {
        liveStartAt: meta.liveStartAt || 0,
        fanGroup: meta.fanGroup || "",
      });
    }
  };

  ws.onerror = () => {
    if (!closed) writeSse(res, "error", { message: "弹幕连接出错" });
  };

  ws.onclose = () => {
    if (!closed) writeSse(res, "close", { message: "弹幕连接已断开" });
    cleanup();
  };
}
