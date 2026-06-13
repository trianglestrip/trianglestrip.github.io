import TarsStream from "@tars/stream";
import { formatCount } from "../utils/format-online.js";
import { fetchGuardBreakdown } from "./huya-guard-panel.js";

const Tup = TarsStream.Tup;

const WUP_URL = "https://cdnws.api.huya.com/?baseinfo=default";

const WUP_HEADERS = {
  "Content-Type": "application/octet-stream",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: "https://www.huya.com",
  Referer: "https://www.huya.com/",
};

class HuyaUserId {
  _writeTo(os: TarsStream.TarsOutputStream) {
    os.writeString(3, "webh5&0.0.0&official");
  }
}

class VipListReq {
  tUserId = new HuyaUserId();
  lTid = 0;
  lSid = 0;
  iStart = 0;
  iCount = 1;
  lPid = 0;
  iUidNum = 0;

  _writeTo(os: TarsStream.TarsOutputStream) {
    os.writeStruct(0, this.tUserId);
    os.writeInt64(1, this.lTid);
    os.writeInt64(2, this.lSid);
    os.writeInt32(3, this.iStart);
    os.writeInt32(4, this.iCount);
    os.writeInt64(5, this.lPid);
    os.writeInt32(6, this.iUidNum);
  }
}

class VipBarListRsp {
  iTotal = 0;
  iTotalNum = 0;

  _readFrom(is: TarsStream.TarsInputStream) {
    is.readInt32(1, false, 0);
    is.readInt32(2, false, 0);
    this.iTotal = is.readInt32(3, false, 0);
    this.iTotalNum = is.readInt32(10, false, 0);
  }
}

type WupWritable = { _writeTo: (os: TarsStream.TarsOutputStream) => void };
type WupReadable = { _readFrom: (is: TarsStream.TarsInputStream) => void };

async function callWup<T extends WupReadable>(
  servant: string,
  func: string,
  req: WupWritable,
  RspClass: new () => T,
  minBytes = 20,
): Promise<T | null> {
  const tup = new Tup();
  tup.tupVersion = 3;
  tup.requestId = Math.floor(Math.random() * 1_000_000);
  tup.servantName = servant;
  tup.funcName = func;
  tup.writeStruct("tReq", req);
  const body = tup.encode().toNodeBuffer();

  const res = await fetch(WUP_URL, {
    method: "POST",
    headers: WUP_HEADERS,
    signal: AbortSignal.timeout(10_000),
    body: new Uint8Array(body),
  });
  if (!res.ok) return null;

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < minBytes) return null;

  const bin = new TarsStream.BinBuffer();
  bin.writeNodeBuffer(buf);
  const out = new Tup();
  out.decode(bin);
  const rsp = new RspClass();
  (out as unknown as { readStruct: (name: string, val: T) => void }).readStruct("tRsp", rsp);
  return rsp;
}

class GetGuardianCountReq implements WupWritable {
  tId = new HuyaUserId();
  lPid = 0;

  _writeTo(os: TarsStream.TarsOutputStream) {
    os.writeStruct(0, this.tId);
    os.writeInt64(1, this.lPid);
  }
}

class GetGuardianCountRsp implements WupReadable {
  iCount = 0;

  _readFrom(is: TarsStream.TarsInputStream) {
    this.iCount = is.readInt32(0, false, 0);
  }
}

export type HuyaGuardBreakdown = {
  total: number;
  normal: number;
  super: number;
  supreme: number;
};

/** 虎牙贵宾总数（liveui/getVipBarList → VipBarListRsp.iTotalNum） */
export async function fetchHuyaVipCount(presenterUid: number, channelId: number): Promise<string> {
  const lPid = Number(presenterUid) || 0;
  const lChannel = Number(channelId) || lPid;
  if (!lPid) return "";

  try {
    const req = new VipListReq();
    req.lPid = lPid;
    req.lTid = lChannel;
    req.lSid = lChannel;
    const rsp = await callWup("liveui", "getVipBarList", req, VipBarListRsp);
    return formatCount(rsp?.iTotalNum || rsp?.iTotal || 0);
  } catch {
    return "";
  }
}

/** 虎牙守护：getGuardianCount，为 0 时用 getGuardianScoreRankPanel2.vGuardTotal 补全 */
export async function fetchHuyaGuardInfo(presenterUid: number): Promise<{
  display: string;
  breakdown: HuyaGuardBreakdown;
}> {
  const lPid = Number(presenterUid) || 0;
  const empty = { total: 0, normal: 0, super: 0, supreme: 0 };
  if (!lPid) return { display: "", breakdown: empty };

  try {
    const req = new GetGuardianCountReq();
    req.lPid = lPid;
    const [countRsp, panel] = await Promise.all([
      callWup("wupui", "getGuardianCount", req, GetGuardianCountRsp, 60),
      fetchGuardBreakdown(lPid),
    ]);
    const countTotal = Number(countRsp?.iCount || 0);
    const total = Math.max(countTotal, panel.total);
    const breakdown: HuyaGuardBreakdown = panel.total > 0 ? panel : { ...empty, total: countTotal };
    if (total > breakdown.total) breakdown.total = total;
    return { display: formatCount(total), breakdown };
  } catch {
    return { display: "", breakdown: empty };
  }
}

/** @deprecated 使用 fetchHuyaGuardInfo */
export async function fetchHuyaGuardCount(presenterUid: number): Promise<string> {
  const info = await fetchHuyaGuardInfo(presenterUid);
  return info.display;
}
