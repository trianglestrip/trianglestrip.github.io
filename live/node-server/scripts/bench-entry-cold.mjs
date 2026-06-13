/** Cold entry: old 2x force vs new 1x parse (different rooms to avoid cache). */
const base = (process.argv[2] || "http://127.0.0.1:8765").replace(/\/$/, "");
const site = "douyu";
const rooms = process.argv.slice(3);
const defaultRooms = ["7122246", "606118", "518766", "84452", "9999", "288016"];
const roomList = rooms.length ? rooms : defaultRooms;

async function fetchRoom(room, force) {
  const url = `${base}/api/room?site=${site}&room=${room}&mode=lazy${force ? "&force=1" : ""}`;
  const t0 = performance.now();
  const res = await fetch(url, { cache: "no-store" });
  await res.json();
  return Math.round(performance.now() - t0);
}

async function main() {
  console.log(`cold entry @ ${base}`);
  for (let i = 0; i < roomList.length - 1; i += 2) {
    const oldRoom = roomList[i];
    const newRoom = roomList[i + 1];
    const oldTotal = (await fetchRoom(oldRoom, true)) + (await fetchRoom(oldRoom, true));
    const newTotal = await fetchRoom(newRoom, false);
    console.log(
      `old ${oldRoom} 2xforce=${oldTotal}ms | new ${newRoom} 1x=${newTotal}ms | saved=${oldTotal - newTotal}ms`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
