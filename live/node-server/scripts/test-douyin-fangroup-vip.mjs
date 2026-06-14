const API = process.env.API_BASE || "http://127.0.0.1:8765";

const CASES = [
  {
    id: "660292215268",
    label: "大热直播间",
    expect: { state: "live", fanGroupMin: 1, vipMin: 1 },
  },
  {
    id: "593965650185",
    label: "演唱会/活动场",
    expect: { allowOffline: true, fanGroupWhenLiveMax: 0, vipWhenLiveMax: 0 },
  },
  {
    id: "504083195059",
    label: "大房间对照",
    expect: { state: "live", vipMin: 1 },
  },
];

async function fetchSnap(id) {
  const res = await fetch(`${API}/api/follows/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rooms: [{ site: "douyin", id }] }),
    signal: AbortSignal.timeout(45_000),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(`HTTP ${res.status} ok=${data.ok}`);
  }
  return data.list?.[0] || {};
}

function parseNum(text) {
  const raw = String(text ?? "").trim();
  if (!raw || raw === "—" || raw === "-") return null;
  const plus = raw.endsWith("+");
  const n = Number(raw.replace(/[+万]/g, (m) => (m === "万" ? "" : "")));
  if (!Number.isFinite(n)) {
    const plain = Number(raw.replace(/\+$/, ""));
    return Number.isFinite(plain) ? plain : null;
  }
  return n;
}

function checkCase(snap, expect) {
  const issues = [];
  if (expect.allowOffline && snap.state === "offline") {
    return issues;
  }
  if (expect.state && snap.state !== expect.state) {
    issues.push(`state=${snap.state} 期望 ${expect.state}`);
  }
  const fan = parseNum(snap.fanGroup);
  const vip = parseNum(snap.vip);
  if (expect.fanGroupMin != null && (fan == null || fan < expect.fanGroupMin)) {
    issues.push(`粉丝团=${snap.fanGroup || "(空)"} 期望 >= ${expect.fanGroupMin}`);
  }
  if (expect.fanGroupMax != null && fan != null && fan > expect.fanGroupMax) {
    issues.push(`粉丝团=${snap.fanGroup} 期望 <= ${expect.fanGroupMax}`);
  }
  if (expect.fanGroupWhenLiveMax != null && snap.state === "live" && fan != null && fan > expect.fanGroupWhenLiveMax) {
    issues.push(`粉丝团=${snap.fanGroup} 期望 <= ${expect.fanGroupWhenLiveMax}`);
  }
  if (expect.vipMin != null && (vip == null || vip < expect.vipMin)) {
    issues.push(`贵宾=${snap.vip || "(空)"} 期望 >= ${expect.vipMin}`);
  }
  if (expect.vipMax != null && vip != null && vip > expect.vipMax) {
    issues.push(`贵宾=${snap.vip} 期望 <= ${expect.vipMax}`);
  }
  if (expect.vipWhenLiveMax != null && snap.state === "live" && vip != null && vip > expect.vipWhenLiveMax) {
    issues.push(`贵宾=${snap.vip} 期望 <= ${expect.vipWhenLiveMax}`);
  }
  return issues;
}

let failed = 0;
console.log(`API: ${API}`);
for (const item of CASES) {
  try {
    const snap = await fetchSnap(item.id);
    const issues = checkCase(snap, item.expect);
    console.log(`\n[${item.label}] douyin/${item.id}`);
    console.log(`  状态: ${snap.state}`);
    console.log(`  观众: ${snap.online || "(空)"}`);
    console.log(`  粉丝团: ${snap.fanGroup || "(空)"}`);
    console.log(`  贵宾: ${snap.vip || "(空)"}`);
    if (item.expect.allowOffline && snap.state === "offline") {
      console.log("  判定: SKIP — 房间已下播，跳过粉丝团/贵宾校验");
      continue;
    }
    if (issues.length) {
      failed += 1;
      console.log(`  判定: FAIL — ${issues.join("; ")}`);
    } else {
      console.log("  判定: PASS");
    }
  } catch (err) {
    failed += 1;
    console.log(`\n[${item.label}] douyin/${item.id}`);
    console.log(`  判定: ERROR — ${err?.message || err}`);
  }
}

console.log(`\n汇总: ${CASES.length - failed}/${CASES.length} 通过`);
if (failed) process.exit(1);
