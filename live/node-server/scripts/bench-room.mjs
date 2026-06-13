/** Benchmark /api/room cold resolve. Usage: node scripts/bench-room.mjs [baseUrl] */
const base = (process.argv[2] || "http://127.0.0.1:8765").replace(/\/$/, "");
const room = process.argv[3] || "6188551";
const site = process.argv[4] || "douyu";

async function once(force) {
  const url = `${base}/api/room?site=${site}&room=${room}&mode=lazy&source=local${force ? "&force=1" : ""}`;
  const t0 = performance.now();
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  const wall = Math.round(performance.now() - t0);
  const timing = data._timing || {};
  return {
    ok: res.ok && data.ok,
    wall_ms: wall,
    timing,
    cached: Boolean(data.cached),
    error: data.error,
  };
}

async function main() {
  console.log(`bench ${site}/${room} @ ${base}`);
  const cold = await once(true);
  console.log("cold", JSON.stringify(cold));
  const warm = await once(false);
  console.log("warm", JSON.stringify(warm));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
