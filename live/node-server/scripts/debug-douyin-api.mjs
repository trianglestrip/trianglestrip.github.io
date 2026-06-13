import { abSign } from "../dist/resolve/douyin/ab-sign.js";

const webRid = process.argv[2] || "755100469482";
const PC_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  referer: "https://live.douyin.com/",
};

const params = new URLSearchParams({
  aid: "6383",
  app_name: "douyin_web",
  live_id: "1",
  device_platform: "web",
  language: "zh-CN",
  browser_language: "zh-CN",
  browser_platform: "Win32",
  browser_name: "Chrome",
  browser_version: "116.0.0.0",
  web_rid: webRid,
  is_need_double_stream: "false",
  msToken: "",
});
const query = params.toString();
const api = `https://live.douyin.com/webcast/room/web/enter/?${query}&a_bogus=${encodeURIComponent(abSign(query, PC_HEADERS["user-agent"]))}`;

const page = await fetch(`https://live.douyin.com/${webRid}`, { headers: PC_HEADERS, redirect: "follow" });
const cookies = page.headers.getSetCookie?.() || [];
const cookie = cookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
console.log("cookie parts:", cookies.length);

const res = await fetch(api, { headers: { ...PC_HEADERS, cookie } });
console.log("HTTP", res.status);
const text = await res.text();
console.log("body head:", text.slice(0, 500));
try {
  const json = JSON.parse(text);
  console.log("status_code", json.status_code);
  console.log("data keys", json.data ? Object.keys(json.data) : null);
  console.log("prompts", json.data?.prompts);
  console.log("message", json.data?.message);
  console.log("rooms", json.data?.data?.length);
  if (json.data?.data?.[0]) {
    const r = json.data.data[0];
    console.log("room status", r.status, "title", r.title);
  }
} catch (e) {
  console.log("parse err", e.message);
}
