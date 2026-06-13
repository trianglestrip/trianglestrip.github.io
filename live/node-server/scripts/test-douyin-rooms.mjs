import { fetchWebStreamData } from "../dist/resolve/douyin/web-stream.js";

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["755100469482", "253829945344", "8888888"];

for (const id of ids) {
  try {
    const data = await fetchWebStreamData(id);
    const flv = Object.keys(data.stream_url?.flv_pull_url || {});
    console.log(id, "status=", data.status, "title=", (data.title || "").slice(0, 40), "flv=", flv.join(","));
  } catch (err) {
    console.log(id, "ERR", err.message);
  }
}
