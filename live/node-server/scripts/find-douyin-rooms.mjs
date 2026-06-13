import { abSign } from "../dist/resolve/douyin/ab-sign.js";

const PC_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  referer: "https://live.douyin.com/",
};

async function testRoom(webRid) {
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

  const res = await fetch(api, { headers: { ...PC_HEADERS, cookie } });
  const json = await res.json();
  const room = json.data?.data?.[0];
  return {
    webRid,
    status_code: json.status_code,
    prompts: json.data?.prompts,
    live: room?.status === 2,
    title: room?.title,
  };
}

const page = await fetch("https://live.douyin.com/", { headers: PC_HEADERS, redirect: "follow" });
const html = await page.text();
const ids = [...new Set([...html.matchAll(/live\.douyin\.com\/(\d+)/g)].map((m) => m[1]))].slice(0, 15);
console.log("found ids:", ids.join(", "));

for (const id of ids.slice(0, 8)) {
  const r = await testRoom(id);
  console.log(JSON.stringify(r));
}
