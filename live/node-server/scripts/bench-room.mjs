/**
 * Benchmark /api/room resolve paths.
 * Usage: node scripts/bench-room.mjs [baseUrl] [room] [site]
 *
 * Scenarios:
 *   cold_force     — 强制冷解析（清服务端 payload 缓存语义）
 *   warm           — 命中服务端 60s 缓存（模拟 hover 预热后进房）
 *   cold_force_2   — 再次强制冷解析（whiteKey 进程内缓存应加速 meta）
 */
const base = (process.argv[2] || "http://127.0.0.1:8765").replace(/\/$/, "");
const room = process.argv[3] || "6188551";
const site = process.argv[4] || "douyu";

async function once(label, force) {
  const url = `${base}/api/room?site=${site}&room=${room}&mode=lazy&source=local${force ? "&force=1" : ""}`;
  const t0 = performance.now();
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  const wall = Math.round(performance.now() - t0);
  const timing = data._timing || {};
  return {
    label,
    ok: res.ok && data.ok,
    wall_ms: wall,
    meta_ms: timing.meta_ms ?? null,
    tier_ms: timing.tier_ms ?? null,
    total_ms: timing.total_ms ?? null,
    cached: Boolean(data.cached),
    meta_cached: Boolean(timing.meta_cached),
    tier_cached: Boolean(timing.tier_cached),
    payload_cached: Boolean(timing.payload_cached),
    error: data.error,
  };
}

function printRow(r) {
  const flags = [
    r.payload_cached && "payload",
    r.meta_cached && "meta",
    r.tier_cached && "tier",
  ]
    .filter(Boolean)
    .join("+") || "—";
  const detail = `meta=${r.meta_ms ?? "?"}ms tier=${r.tier_ms ?? "?"}ms cache=${flags}`;
  const status = r.ok ? "ok" : `ERR ${r.error || ""}`;
  console.log(`${r.label.padEnd(14)} ${String(r.wall_ms).padStart(5)}ms wall  ${detail}  [${status}]`);
}

async function main() {
  console.log(`bench ${site}/${room} @ ${base}`);
  console.log("label          wall   breakdown");
  const rows = [
    await once("cold_force", true),
    await once("warm", false),
    await once("hover_sim", false),
    await once("cold_force_2", true),
  ];
  for (const row of rows) {
    printRow(row);
  }
  const cold1 = rows[0].wall_ms;
  const warm = rows[1].wall_ms;
  const cold2 = rows[3].wall_ms;
  console.log("");
  console.log(`warm vs cold_force:  ${cold1 - warm}ms faster (${warm} vs ${cold1})`);
  console.log(`cold2 vs cold_force: ${cold1 - cold2}ms faster (${cold2} vs ${cold1}, whiteKey cache)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
