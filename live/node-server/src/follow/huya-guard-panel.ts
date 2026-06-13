// @ts-nocheck
import TarsStream from "@tars/stream";

const Tup = TarsStream.Tup;
const Tars = TarsStream;

const WUP_URL = "https://cdnws.api.huya.com/?baseinfo=default";

const WUP_HEADERS = {
  "Content-Type": "application/octet-stream",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: "https://www.huya.com",
  Referer: "https://www.huya.com/",
};

class HuyaUserId {
  _writeTo(os) {
    os.writeString(3, "webh5&0.0.0&official");
  }
}

class NobleLevelInfo {
  constructor() {
    this.iNobleLevel = 0;
    this.iAttrType = 0;
  }
  _readFrom(is) {
    this.iNobleLevel = is.readInt32(0, false, 0);
    this.iAttrType = is.readInt32(1, false, 0);
  }
}

class GuardianScoreRankItem {
  constructor() {
    this.tNobleLevel = new NobleLevelInfo();
  }
  _readFrom(is) {
    is.readInt64(0, false, 0);
    is.readString(1, false, "");
    is.readString(2, false, "");
    is.readInt64(3, false, 0);
    is.readInt32(4, false, 0);
    is.readInt32(5, false, 0);
    is.readInt32(6, false, 0);
    is.readInt64(7, false, 0);
    is.readInt64(8, false, 0);
    is.readStruct(9, false, this.tNobleLevel);
    is.readString(10, false, "");
    is.readInt64(11, false, 0);
    is.readInt32(12, false, 0);
  }
}
GuardianScoreRankItem._read = (is, tag, def) => is.readStruct(tag, true, def);
GuardianScoreRankItem._readFrom = (is) => {
  const tmp = new GuardianScoreRankItem();
  tmp._readFrom(is);
  return tmp;
};

class UserGuardianRankInfo {
  constructor() {
    this.tRankInfo = new GuardianScoreRankItem();
  }
  _readFrom(is) {
    is.readStruct(0, false, this.tRankInfo);
    is.readInt32(1, false, 0);
  }
}
UserGuardianRankInfo._read = (is, tag, def) => is.readStruct(tag, true, def);
UserGuardianRankInfo._readFrom = (is) => {
  const tmp = new UserGuardianRankInfo();
  tmp._readFrom(is);
  return tmp;
};

class UserGuardianRankTotal {
  constructor() {
    this.iGuardType = 0;
    this.lGuardCount = 0;
  }
  _readFrom(is) {
    this.iGuardType = is.readInt32(0, false, 0);
    this.lGuardCount = Number(is.readInt64(1, false, 0));
    is.readString(2, false, "");
  }
}
UserGuardianRankTotal._read = (is, tag, def) => is.readStruct(tag, true, def);
UserGuardianRankTotal._readFrom = (is) => {
  const tmp = new UserGuardianRankTotal();
  tmp._readFrom(is);
  return tmp;
};

class GuardianScoreRankPanelReq {
  constructor(lPid) {
    this.tUserId = new HuyaUserId();
    this.lPid = lPid;
    this.iPage = 0;
    this.iCount = 20;
  }
  _writeTo(os) {
    os.writeStruct(0, this.tUserId);
    os.writeInt64(1, this.lPid);
    os.writeInt32(2, this.iPage);
    os.writeInt32(3, this.iCount);
  }
}

class GuardianScoreRankPanelRsp {
  constructor() {
    this.items = [];
  }
  _readFrom(is) {
    is.readList(0, false, Tars.List(GuardianScoreRankItem));
    is.readInt64(1, false, 0);
    is.readMap(2, false, new Tars.Map(Tars.Int32, Tars.Int64));
    is.readStruct(3, false, new UserGuardianRankInfo());
    is.readString(4, false, "");
    is.readString(5, false, "");
    is.readInt32(7, false, 0);
    const vec = is.readList(8, false, Tars.List(UserGuardianRankTotal));
    this.items = (vec.value || []).map((x) => ({
      iGuardType: x.iGuardType,
      lGuardCount: x.lGuardCount,
    }));
  }
}

async function callWup(func, req, RspClass, minBytes = 60) {
  const tup = new Tup();
  tup.tupVersion = 3;
  tup.requestId = Math.floor(Math.random() * 1_000_000);
  tup.servantName = "wupui";
  tup.funcName = func;
  tup.writeStruct("tReq", req);
  const res = await fetch(WUP_URL, {
    method: "POST",
    headers: WUP_HEADERS,
    signal: AbortSignal.timeout(10_000),
    body: tup.encode().toNodeBuffer(),
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < minBytes) return null;
  const bin = new TarsStream.BinBuffer();
  bin.writeNodeBuffer(buf);
  const out = new Tup();
  out.decode(bin);
  const rsp = new RspClass();
  out.readStruct("tRsp", rsp);
  return rsp;
}

function readGuardItems(items) {
  const breakdown = { total: 0, normal: 0, super: 0, supreme: 0 };
  for (const item of items || []) {
    const count = Number(item?.lGuardCount || 0);
    if (!count) continue;
    breakdown.total += count;
    if (item.iGuardType === 0) breakdown.normal += count;
    else if (item.iGuardType === 2) breakdown.super += count;
    else if (item.iGuardType === 3) breakdown.supreme += count;
  }
  return breakdown;
}

/** getGuardianScoreRankPanel2 → vGuardTotal（iGuardType: 0普通 2超关 3至尊） */
export async function fetchGuardBreakdown(presenterUid: number) {
  const lPid = Number(presenterUid) || 0;
  if (!lPid) return { total: 0, normal: 0, super: 0, supreme: 0 };
  try {
    const rsp = await callWup("getGuardianScoreRankPanel2", new GuardianScoreRankPanelReq(lPid), GuardianScoreRankPanelRsp);
    return readGuardItems(rsp?.items);
  } catch {
    return { total: 0, normal: 0, super: 0, supreme: 0 };
  }
}
