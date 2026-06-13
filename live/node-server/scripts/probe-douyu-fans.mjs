const h = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
  Referer: "https://www.douyu.com/",
  Origin: "https://www.douyu.com",
  "Client-Type": "web",
};
const rid = process.argv[2] || "252140";

// mobile vike context
const mhtml = await fetch(`https://m.douyu.com/${rid}`, { headers: h }).then((r) => r.text());
const mmatch = mhtml.match(/id="vike_pageContext"[^>]*>([\s\S]*?)<\/script>/);
if (mmatch) {
  const ctx = JSON.parse(mmatch[1]);
  const block = ctx.pageProps?.room?.roomInfo;
  const ri = block?.roomInfo || block || {};
  console.log("mobile roomInfo fan-related:", {
    ownerId: ri.ownerId,
    owner_uid: ri.owner_uid,
    fans: ri.fans,
    fansNum: ri.fansNum,
    follow: ri.follow,
    followNum: ri.followNum,
    hn: ri.hn,
  });
}

// desktop page patterns
const dhtml = await fetch(`https://www.douyu.com/${rid}`, { headers: h }).then((r) => r.text());
for (const p of ["fansNum", "fans_num", "follow_num", "followNum", "fan_count", "owner_uid"]) {
  const re = new RegExp(`${p}["']?\\s*[:=]\\s*["']?(\\d+)`, "i");
  const mm = dhtml.match(re);
  if (mm) console.log("desktop", p, mm[1]);
}

const spaceMatch = dhtml.match(/\$ROOM\s*=\s*(\{[\s\S]*?\});/);
if (spaceMatch) {
  try {
    const roomObj = JSON.parse(spaceMatch[1]);
    console.log("ROOM fan fields:", {
      fans: roomObj.fans,
      fans_num: roomObj.fans_num,
      follow: roomObj.follow,
      owner_uid: roomObj.owner_uid,
    });
  } catch {
    console.log("ROOM raw slice", spaceMatch[1].slice(0, 300));
  }
}

const ownerUid = process.argv[3] || "";
const betard = await fetch(`https://www.douyu.com/betard/${rid}`, { headers: h }).then((r) => r.json());
const room = betard.room || {};
console.log(
  "betard fan keys:",
  Object.keys(room).filter((k) => /fan|follow|sub|owner/i.test(k)),
);
console.log(
  "betard sample:",
  JSON.stringify(
    {
      owner_uid: room.owner_uid,
      owner_id: room.owner_id,
      fans: room.fans,
      fans_num: room.fans_num,
      fans_bn: room.fans_bn,
      is_set_fans_badge: room.is_set_fans_badge,
    },
    null,
    2,
  ),
);

// desktop HTML: anchor profile block
const fanMatch = dhtml.match(/"fansNum"\s*:\s*(\d+)/);
const followMatch = dhtml.match(/"followNum"\s*:\s*(\d+)/);
const badgeMatch = dhtml.match(/"badgeNum"\s*:\s*(\d+)/);
console.log("desktop json fansNum", fanMatch?.[1], "followNum", followMatch?.[1], "badgeNum", badgeMatch?.[1]);

const uidUrls = ownerUid
  ? [
      `https://www.douyu.com/lapi/member/cp/getFansBadgeNum?room_id=${rid}&owner_uid=${ownerUid}`,
      `https://www.douyu.com/lapi/web/anchor/anchorprofile/getAnchorProfile?room_id=${rid}&owner_uid=${ownerUid}`,
      `https://www.douyu.com/lapi/member/follow/getFollowNum?room_id=${rid}`,
      `https://www.douyu.com/lapi/member/follow/getFollowNum?uid=${ownerUid}`,
      `https://www.douyu.com/lapi/member/follow/getFollowNum?owner_uid=${ownerUid}`,
    ]
  : [];

const urls = [
  `https://www.douyu.com/lapi/member/cp/getFansBadgeNum?room_id=${rid}`,
  `https://www.douyu.com/lapi/web/anchor/anchorprofile/getAnchorProfile?room_id=${rid}`,
  `https://www.douyu.com/swf_api/getRoomInfo?room_id=${rid}`,
  `https://m.douyu.com/api/room/info?rid=${rid}`,
  `https://www.douyu.com/betard/${rid}`,
];

for (const u of [...uidUrls, ...urls]) {
  try {
    const r = await fetch(u, { headers: h });
    const t = await r.text();
    console.log("URL:", u);
    console.log("status:", r.status);
    console.log(t.slice(0, 600));
  } catch (e) {
    console.log("ERR", u, e.message);
  }
  console.log("---");
}
