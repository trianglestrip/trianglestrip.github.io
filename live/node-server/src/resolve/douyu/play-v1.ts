import { computeAuth, DEFAULT_DID, type WhiteKey } from "./encryption.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const VER = "219032101";

export interface PlayV1Response {
  error: number;
  msg?: string;
  data?: {
    rtmp_url?: string;
    rtmp_live?: string;
    rtmp_cdn?: string;
    multirates?: Array<{ name?: string; rate?: number; bit?: number }>;
    cdnsWithName?: Array<{ name?: string; cdn?: string }>;
  };
}

export async function fetchH5PlayV1(
  rid: string,
  rate: string,
  white: WhiteKey,
  cdn = "hw-h5",
): Promise<PlayV1Response> {
  const ts = Math.floor(Date.now() / 1000);
  const auth = computeAuth(rid, white, ts);
  const body = new URLSearchParams({
    rate,
    ver: VER,
    iar: "0",
    ive: "0",
    rid,
    hevc: "0",
    fa: "0",
    sov: "0",
    enc_data: white.enc_data,
    tt: String(ts),
    did: DEFAULT_DID,
    auth,
    cdn,
  });

  const res = await fetch(`https://playweb.douyucdn.cn/lapi/live/getH5PlayV1/${rid}`, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://www.douyu.com/",
      Origin: "https://www.douyu.com",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`getH5PlayV1 HTTP ${res.status}`);
  }
  return (await res.json()) as PlayV1Response;
}

export function flvFromApiData(data: { rtmp_url?: string; rtmp_live?: string }): string {
  return `${data.rtmp_url}/${data.rtmp_live}`;
}

export function isDouyucdnUrl(url: string): boolean {
  return Boolean(url) && url.includes("douyucdn") && !url.includes("edgesrv.com");
}
