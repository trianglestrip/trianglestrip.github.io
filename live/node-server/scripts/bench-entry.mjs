/**
 * 模拟进房 API 路径：旧逻辑双 force vs 新逻辑单次解析。
 * Usage: node scripts/bench-entry.mjs [baseUrl] [room] [site]
 */
const base = (process.argv[2] || "http://127.0.0.1:8765").replace(/\/$/, "");
const room = process.argv[3] || "6188551";
const site = process.argv[4] || "douyu";

async function fetchRoom(force) {
  const url = `${base}/api/room?site=${site}&room=${room}&mode=lazy&source=local${force ? "&force=1" : ""}`;
  const t0 = performance.now();
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  return {
    ok: res.ok && data.ok,
    wall_ms: Math.round(performance.now() - t0),
    cached: Boolean(data.cached),
    timing: data._timing || {},
  };
}

async function simulateOldEntry() {
  const a = await fetchRoom(true);
  const b = await fetchRoom(true);
  return {
    label: "old_double_force",
    total_ms: a.wall_ms + b.wall_ms,
    steps: [a, b],
  };
}

async function simulateNewEntry() {
  const a = await fetchRoom(false);
  return {
    label: "new_single",
    total_ms: a.wall_ms,
    steps: [a],
  };
}

async function simulateHoverEntry() {
  await fetchRoom(false);
  const a = await fetchRoom(false);
  return {
    label: "hover_then_enter",
    total_ms: a.wall_ms,
    steps: [a],
  };
}

function printSim(sim) {
  console.log(`${sim.label}: ${sim.total_ms}ms total`);
  for (const [i, step] of sim.steps.entries()) {
    const flags = step.cached ? "cached" : "cold";
    const meta = step.timing.meta_ms ?? "?";
    console.log(`  step${i + 1} ${step.wall_ms}ms (${flags}, meta=${meta}ms)`);
  }
}

async function main() {
  console.log(`entry bench ${site}/${room} @ ${base}`);
  console.log("--- warm server cache first ---");
  await fetchRoom(true);
  console.log("");
  const oldSim = await simulateOldEntry();
  printSim(oldSim);
  console.log("");
  const newSim = await simulateNewEntry();
  printSim(newSim);
  console.log("");
  const hoverSim = await simulateHoverEntry();
  printSim(hoverSim);
  console.log("");
  console.log(
    `saved vs old_double_force: ${oldSim.total_ms - newSim.total_ms}ms (single parse)`,
  );
  console.log(
    `saved vs old_double_force: ${oldSim.total_ms - hoverSim.total_ms}ms (hover + single client cache)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
