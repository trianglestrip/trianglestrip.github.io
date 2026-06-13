import { createHash } from "node:crypto";

export const DEFAULT_DID = "10000000000000000000000000001501";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface WhiteKey {
  key: string;
  rand_str: string;
  enc_time: number;
  enc_data: string;
  is_special: boolean;
}

function md5(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

export async function fetchWhiteKey(): Promise<WhiteKey> {
  const url = `https://www.douyu.com/wgapi/livenc/liveweb/websec/getEncryption?did=${DEFAULT_DID}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`getEncryption HTTP ${res.status}`);
  }
  const data = (await res.json()) as { error?: number; data?: WhiteKey };
  if (data.error !== 0 || !data.data) {
    throw new Error("获取白名单密钥失败");
  }
  return data.data;
}

export function computeAuth(rid: string, white: WhiteKey, ts: number): string {
  let secret = white.rand_str;
  const salt = white.is_special ? "" : `${rid}${ts}`;
  for (let i = 0; i < white.enc_time; i++) {
    secret = md5(secret + white.key);
  }
  return md5(secret + white.key + salt);
}
