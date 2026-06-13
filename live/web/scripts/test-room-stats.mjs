const API = process.env.API_BASE || "http://127.0.0.1:8765";
const WEB = process.env.WEB_BASE || "http://127.0.0.1:8080";

async function checkFollowStatus(base, label, room) {
  const res = await fetch(`${base}/api/follows/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rooms: [room] }),
  });
  const data = await res.json();
  const snap = data.list?.[0] || {};
  console.log(`\n[${label}] ${room.site}/${room.id}`);
  console.log("  ok:", data.ok, "state:", snap.state);
  if (room.site === "douyu") {
    console.log("  观众:", snap.online || "(空)");
    console.log("  钻粉:", snap.diamondFans || "(空)");
    console.log("  粉丝团:", snap.fanGroup || "(空)");
    const ok = Boolean(snap.online && snap.diamondFans && snap.fanGroup);
    console.log("  判定:", ok ? "PASS" : "FAIL — API 仍是旧版或未重启");
    return ok;
  }
  console.log("  观众:", snap.online || "(空)");
  console.log("  贵宾:", snap.vip || "(空)");
  return Boolean(snap.online);
}

async function checkWebBundle() {
  const res = await fetch(`${WEB}/assets/PlayView-xH88SGHo.js`, { cache: "no-store" });
  const js = await res.text();
  const hasStats = js.includes("diamondFans") && js.includes("fanGroup") && js.includes("play-stat-item");
  console.log(`\n[前端 bundle] PlayView-xH88SGHo.js`);
  console.log("  HTTP:", res.status, "含统计 UI:", hasStats ? "是" : "否");
  return hasStats;
}

const douyuOk = await checkFollowStatus(API, "API 直连", { site: "douyu", id: "252140" });
await checkFollowStatus(WEB, "Web 反代", { site: "douyu", id: "252140" });
const bundleOk = await checkWebBundle();

if (douyuOk && bundleOk) {
  console.log("\n结论: 后端与前端构建均正常。若页面仍不显示，请 Ctrl+F5 强刷播放页。");
} else {
  console.log("\n结论: 见上方 FAIL 项。API 需重启 start-api.bat，前端需重新 build.bat。");
  process.exit(1);
}
