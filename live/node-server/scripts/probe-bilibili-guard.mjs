const room = process.argv[2] || "817160";
const PC_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: `https://live.bilibili.com/${room}`,
  Origin: "https://live.bilibili.com",
};

async function probe(name, url) {
  try {
    const res = await fetch(url, { headers: PC_HEADERS, signal: AbortSignal.timeout(12000) });
    const text = await res.text();
    console.log(`\n=== ${name} HTTP ${res.status} ===`);
    console.log(text.slice(0, 1200));
  } catch (err) {
    console.log(`\n=== ${name} ERR ===`, err.message);
  }
}

const infoRes = await fetch(
  `https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${room}`,
  { headers: PC_HEADERS },
);
const info = await infoRes.json();
const uid = info?.data?.uid;
console.log("uid", uid, "online", info?.data?.online);

await probe(
  "getInfoByRoom",
  `https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom?room_id=${room}`,
);
await probe(
  "guardTab topList",
  `https://api.live.bilibili.com/guardTab/topList?roomid=${room}&page=1&ruid=${uid}&page_size=1`,
);
await probe(
  "guard topList v2",
  `https://api.live.bilibili.com/xlive/app-room/v2/guardTab/topList?roomid=${room}&page=1&ruid=${uid}&page_size=1`,
);
await probe(
  "getGuardCount",
  `https://api.live.bilibili.com/xlive/web-room/v1/guard/getGuardCount?roomid=${room}&ruid=${uid}`,
);
await probe(
  "getGuardInfo",
  `https://api.live.bilibili.com/xlive/web-room/v1/guard/getGuardInfo?roomid=${room}&ruid=${uid}`,
);
await probe(
  "getGuardCountByRoom",
  `https://api.live.bilibili.com/xlive/general-interface/v1/guard/getGuardCountByRoom?roomid=${room}&ruid=${uid}`,
);
await probe(
  "topList page_size=50",
  `https://api.live.bilibili.com/xlive/app-room/v2/guardTab/topList?roomid=${room}&page=1&ruid=${uid}&page_size=50`,
);
await probe(
  "wealth rank",
  `https://api.live.bilibili.com/xlive/rank-interface/v1/RoomRank/getWealthMedalRank?room_id=${room}&ruid=${uid}&page=1&page_size=1`,
);
await probe(
  "online gold rank",
  `https://api.live.bilibili.com/xlive/rank-interface/v1/RoomRank/getRoomOnlineRank?room_id=${room}&ruid=${uid}&page=1&page_size=1`,
);
