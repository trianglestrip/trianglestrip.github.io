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
  const uid = Number(infoJson.data?.uid ?? 0);

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
    uid,
    host: String(hostItem.host),
    port: Number(hostItem.wss_port || hostItem.port || 443),
    wss_port: Number(hostItem.wss_port || hostItem.port || 443),
    token,
    is_live: liveStatus === 1,
  };
}
