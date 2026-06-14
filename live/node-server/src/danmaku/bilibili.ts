import type { IncomingMessage, ServerResponse } from "node:http";
import { brotliDecompressSync, inflateSync } from "node:zlib";
import WebSocket from "ws";
import type { ServerConfig } from "../config/load-config.js";
import { applyCorsHeaders } from "../middleware/cors.js";

const PC_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://live.bilibili.com/",
  Origin: "https://live.bilibili.com",
};

export interface BilibiliDanmakuSession {
  room_id: string;
  uid: number;
  host: string;
  port: number;
  wss_port: number;
  token: string;
  is_live: boolean;
}

interface DanmuHost {
  host?: string;
  port?: number;
  wss_port?: number;
  ws_port?: number;
}

async function fetchBuvidCookie(): Promise<string> {
  const res = await fetch("https://www.bilibili.com/", {
    headers: PC_HEADERS,
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  return cookies.map((item) => item.split(";")[0]).join("; ");
}

async function fetchJson<T>(url: string, params: Record<string, string | number>, cookie: string): Promise<T> {
  const u = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    u.searchParams.set(key, String(value));
  }
  const res = await fetch(u, {
    headers: { ...PC_HEADERS, Cookie: cookie },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    throw new Error(`B 站弹幕 API HTTP ${res.status}`);
  }
  const json = (await res.json()) as { code?: number; message?: string; data?: T };
  if (Number(json.code ?? 0) !== 0) {
    throw new Error(json.message || `B 站弹幕 API 错误 ${json.code ?? "unknown"}`);
  }
  return json.data as T;
}

function pickHost(hostList: DanmuHost[] | undefined): DanmuHost | null {
  if (!hostList?.length) return null;
  return hostList.find((item) => item.host && (item.wss_port || item.port)) || hostList[0];
}

async function fetchDanmuInfo(roomId: string, cookie: string): Promise<{ host_list?: DanmuHost[]; token?: string }> {
  return fetchJson("https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo", { id: roomId, type: 0 }, cookie);
}

async function fetchDanmuConf(
  roomId: string,
  cookie: string,
): Promise<{ host_server_list?: DanmuHost[]; host?: string; port?: number; token?: string }> {
  return fetchJson("https://api.live.bilibili.com/room/v1/Danmu/getConf", { room_id: roomId }, cookie);
}

export async function fetchBilibiliDanmakuSession(roomId: string): Promise<BilibiliDanmakuSession> {
  const room = String(roomId).trim();
  if (!/^\d+$/.test(room)) {
    throw new Error(`无效 B 站房间号: ${roomId}`);
  }

  const cookie = await fetchBuvidCookie();
  const headers = cookie ? { ...PC_HEADERS, Cookie: cookie } : PC_HEADERS;

  const infoRes = await fetch(`https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${room}`, {
    headers,
    signal: AbortSignal.timeout(12000),
  });
  const infoJson = (await infoRes.json()) as {
    data?: { live_status?: number; uid?: number };
  };
  const liveStatus = Number(infoJson.data?.live_status ?? 0);

  let hostList: DanmuHost[] | undefined;
  let token = "";

  try {
    const danmuInfo = await fetchDanmuInfo(room, cookie);
    hostList = danmuInfo.host_list;
    token = String(danmuInfo.token || "");
  } catch {
    /* getDanmuInfo 风控时降级 getConf */
  }

  if (!token || !hostList?.length) {
    const conf = await fetchDanmuConf(room, cookie);
    hostList = conf.host_server_list || (conf.host ? [{ host: conf.host, port: conf.port, wss_port: 443 }] : []);
    token = String(conf.token || "");
  }

  const hostItem = pickHost(hostList);
  if (!hostItem?.host || !token) {
    throw new Error("房间未开播或缺少弹幕连接参数");
  }

  return {
    room_id: room,
    uid: 0,
    host: String(hostItem.host),
    port: Number(hostItem.wss_port || hostItem.port || 443),
    wss_port: Number(hostItem.wss_port || hostItem.port || 443),
    token,
    is_live: liveStatus === 1,
  };
}

function writeSse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function encodeBilibiliPacket(op: number, body = ""): Buffer {
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

function colorFromDecimal(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "#ffffff";
  return `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;
}

function danmakuTextFromInfo(info: unknown[]): string {
  const segment = info?.[1];
  if (typeof segment === "string") return segment;
  if (Array.isArray(segment)) {
    if (typeof segment[0] === "string") return segment[0];
    if (Array.isArray(segment[0])) return String(segment[0][1] || segment[0][0] || "");
  }
  return "";
}

function extractDanmakuFromJson(
  data: Record<string, unknown>,
  seq: number,
): { id: string; user: string; text: string; color: string } | null {
  if (data?.cmd !== "DANMU_MSG" || !Array.isArray(data.info)) return null;
  const info = data.info as unknown[];
  const text = danmakuTextFromInfo(info);
  const userMeta = info?.[2] as unknown[] | undefined;
  const user = String(Array.isArray(userMeta) ? userMeta[1] || "" : "");
  if (!text || !user) return null;
  const styleMeta = info?.[0] as unknown[] | undefined;
  return {
    id: `${seq}`,
    user,
    text,
    color: colorFromDecimal(Array.isArray(styleMeta) ? styleMeta[3] : undefined),
  };
}

function decompressPacketBody(body: Buffer, ver: number): Buffer {
  if (ver === 2) return inflateSync(body);
  if (ver === 3) return brotliDecompressSync(body);
  return body;
}

function collectDanmakuFromBuffer(
  data: Buffer,
  seqRef: { value: number },
  items: Array<{ id: string; user: string; text: string; color: string }>,
): void {
  let offset = 0;
  while (offset + 16 <= data.length) {
    const packetLen = data.readInt32BE(offset);
    if (packetLen < 16 || offset + packetLen > data.length) break;
    const ver = data.readInt16BE(offset + 6);
    const op = data.readInt32BE(offset + 8);
    const body = data.subarray(offset + 16, offset + packetLen);
    if (op === 5) {
      if (ver === 2 || ver === 3) {
        try {
          collectDanmakuFromBuffer(decompressPacketBody(body, ver), seqRef, items);
        } catch {
          /* ignore decompress errors */
        }
      } else {
        const text = body.toString("utf8").trim();
        if (!text) continue;
        const chunks = text.includes("\0") ? text.split("\0") : [text];
        for (const chunk of chunks) {
          const trimmed = chunk.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            seqRef.value += 1;
            const item = extractDanmakuFromJson(parsed, seqRef.value);
            if (item) items.push(item);
          } catch {
            /* ignore non-json */
          }
        }
      }
    }
    offset += packetLen;
  }
}

function toBuffer(data: unknown): Buffer | null {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (Array.isArray(data)) return Buffer.concat(data);
  return null;
}

export async function streamBilibiliDanmaku(
  roomId: string,
  req: IncomingMessage,
  res: ServerResponse,
  config: ServerConfig,
): Promise<void> {
  const session = await fetchBilibiliDanmakuSession(roomId);
  const cookie = await fetchBuvidCookie();
  const auth = JSON.stringify({
    uid: 0,
    roomid: Number(session.room_id),
    protover: 3,
    platform: "web",
    type: 2,
    key: session.token,
  });

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
  const host = String(session.host).replace(/^https?:\/\//, "");
  const url = `wss://${host}/sub`;

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
    ws = new WebSocket(url, {
      headers: {
        ...PC_HEADERS,
        Referer: `https://live.bilibili.com/${session.room_id}`,
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
  } catch (err) {
    writeSse(res, "error", { message: err instanceof Error ? err.message : String(err) });
    cleanup();
    return;
  }

  ws.onopen = () => {
    ws?.send(encodeBilibiliPacket(7, auth));
    writeSse(res, "ready", { room_id: session.room_id });
    heartbeat = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(encodeBilibiliPacket(2));
      }
    }, 30000);
  };

  ws.onmessage = (event) => {
    if (closed) return;
    const data = toBuffer(event.data);
    if (!data) return;
    const seqRef = { value: 0 };
    const items: Array<{ id: string; user: string; text: string; color: string }> = [];
    collectDanmakuFromBuffer(data, seqRef, items);
    for (const item of items) {
      writeSse(res, "chat", item);
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
