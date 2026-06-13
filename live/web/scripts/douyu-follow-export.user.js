// ==UserScript==
// @name         斗鱼关注列表导出 (Lemon Live)
// @namespace    https://trianglestrip.github.io/
// @version      1.0.0
// @description  在斗鱼一键获取完整关注列表，复制或同步到 Lemon Live
// @author       trianglestrip
// @match        https://www.douyu.com/*
// @match        http://127.0.0.1/*
// @match        http://localhost/*
// @match        https://trianglestrip.github.io/*
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const GM_STORE_KEY = "lemon_live_pending_follows";
  const SITE = "douyu";

  const isDouyu = location.hostname.includes("douyu.com");
  const isLemonLive =
    location.hostname === "127.0.0.1" ||
    location.hostname === "localhost" ||
    location.hostname === "trianglestrip.github.io";

  function toast(msg, ms = 2800) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText =
      "position:fixed;z-index:2147483647;left:50%;top:18%;transform:translateX(-50%);" +
      "background:rgba(24,24,24,.92);color:#f3d04e;padding:10px 16px;border-radius:8px;" +
      "font:14px/1.4 'Segoe UI','PingFang SC',sans-serif;box-shadow:0 4px 20px #0006;max-width:90vw;";
    document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  function parsePageCount(text) {
    const m = text.match(/"pageCount"\s*:\s*(\d+)/);
    return m ? Number(m[1]) : 1;
  }

  function pickField(block, field) {
    const re = new RegExp(`"${field}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`);
    const m = block.match(re);
    if (m) return m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    const num = block.match(new RegExp(`"${field}"\\s*:\\s*(\\d+)`));
    return num ? num[1] : "";
  }

  function extractRoomsFromText(text) {
    const rooms = new Map();
    const idMatches = [...text.matchAll(/"room_id"\s*:\s*(\d+)/g)];
    for (const m of idMatches) {
      const id = m[1];
      const start = Math.max(0, m.index - 400);
      const end = Math.min(text.length, m.index + 1200);
      const block = text.slice(start, end);
      const room = {
        site: SITE,
        id,
        title: pickField(block, "room_name"),
        anchor: pickField(block, "nickname"),
        cover: pickField(block, "room_src"),
        avatar: pickField(block, "avatar_small"),
        addedAt: Date.now(),
      };
      rooms.set(id, room);
    }
    return rooms;
  }

  async function douyuFetch(path, options = {}) {
    const url = path.startsWith("http") ? path : `${location.origin}${path}`;
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        ...(options.headers || {}),
      },
      ...options,
    });
    const text = await res.text();
    return { text, json: safeJson(text) };
  }

  function safeJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async function fetchFollowListPages() {
    const rooms = new Map();
    let page = 1;
    let pageCount = 1;

    while (page <= pageCount) {
      const { text, json } = await douyuFetch(
        `/wgapi/livenc/liveweb/follow/list?page=${page}&sort=0&cid1=0`,
      );
      if (!json || json.error !== 0) {
        throw new Error(json?.msg || "获取关注列表失败，请确认已登录斗鱼");
      }
      pageCount = parsePageCount(text);
      for (const [id, room] of extractRoomsFromText(text)) rooms.set(id, room);
      page += 1;
    }
    return rooms;
  }

  async function fetchGroupRooms() {
    const rooms = new Map();
    const { text, json } = await douyuFetch("/wgapi/livenc/liveweb/followgroup/list", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "",
    });
    if (!json || json.error !== 0) return rooms;

    const gids = [...text.matchAll(/"gid"\s*:\s*(\d+)/g)].map((m) => m[1]);
    for (const gid of gids) {
      let offset = 0;
      const limit = 120;
      let more = true;
      while (more) {
        const body = new URLSearchParams({
          gid,
          offset: String(offset),
          sort: "0",
          limit: String(limit),
        });
        const { text: pageText } = await douyuFetch(
          "/wgapi/livenc/liveweb/follow/listbygroup",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
          },
        );
        const chunk = extractRoomsFromText(pageText);
        if (!chunk.size) more = false;
        for (const [id, room] of chunk) rooms.set(id, room);
        offset += limit;
        if (chunk.size < limit) more = false;
      }
    }
    return rooms;
  }

  async function fetchAllDouyuFollows() {
    const main = await fetchFollowListPages();
    const groups = await fetchGroupRooms();
    const merged = new Map([...main, ...groups]);
    return [...merged.values()].sort((a, b) => Number(a.id) - Number(b.id));
  }

  function toLemonJson(rooms) {
    return JSON.stringify(rooms, null, 2);
  }

  function mergeFollows(existing, incoming) {
    const map = new Map();
    for (const item of existing || []) {
      const site = String(item?.site || "").trim();
      const id = String(item?.id || "").trim();
      if (site && id) map.set(`${site}:${id}`, item);
    }
    for (const item of incoming || []) {
      const site = String(item?.site || "").trim();
      const id = String(item?.id || "").trim();
      if (site && id) map.set(`${site}:${id}`, item);
    }
    return [...map.values()];
  }

  function syncToLemonLive(rooms) {
    GM_setValue(GM_STORE_KEY, rooms);
    toast(`已缓存 ${rooms.length} 个关注，请打开 Lemon Live 页面自动同步`);
  }

  function applyGmToLocalStorage() {
    const pending = GM_getValue(GM_STORE_KEY, null);
    if (!Array.isArray(pending) || !pending.length) return 0;

    const followKey = "lemon_live.follows";
    let existing = [];
    try {
      existing = JSON.parse(localStorage.getItem(followKey) || "[]");
    } catch {
      existing = [];
    }
    const before = new Set(existing.map((r) => `${r.site}:${r.id}`));
    const merged = mergeFollows(existing, pending);
    localStorage.setItem(followKey, JSON.stringify(merged));
    GM_deleteValue(GM_STORE_KEY);

    const added = merged.filter((r) => !before.has(`${r.site}:${r.id}`)).length;
    if (added > 0) toast(`已同步 ${added} 个新关注到 Lemon Live`);
    return added;
  }

  function createDouyuUi() {
    if (document.getElementById("lemon-douyu-follow-tool")) return;

    const wrap = document.createElement("div");
    wrap.id = "lemon-douyu-follow-tool";
    wrap.style.cssText =
      "position:fixed;z-index:2147483646;right:16px;bottom:88px;display:flex;flex-direction:column;gap:6px;";

    const styleBtn = (btn) => {
      btn.style.cssText =
        "cursor:pointer;border:1px solid #f3d04e;background:#181818;color:#f3d04e;" +
        "padding:8px 12px;border-radius:8px;font:13px 'Segoe UI','PingFang SC',sans-serif;" +
        "box-shadow:0 2px 12px #0005;";
    };

    const btnFetch = document.createElement("button");
    btnFetch.type = "button";
    btnFetch.textContent = "获取斗鱼关注";
    styleBtn(btnFetch);

    const btnCopy = document.createElement("button");
    btnCopy.type = "button";
    btnCopy.textContent = "复制 JSON";
    styleBtn(btnCopy);
    btnCopy.disabled = true;

    const btnSync = document.createElement("button");
    btnSync.type = "button";
    btnSync.textContent = "同步到 Lemon Live";
    styleBtn(btnSync);
    btnSync.disabled = true;

    let lastRooms = [];

    btnFetch.addEventListener("click", async () => {
      btnFetch.disabled = true;
      btnFetch.textContent = "获取中…";
      try {
        lastRooms = await fetchAllDouyuFollows();
        btnCopy.disabled = lastRooms.length === 0;
        btnSync.disabled = lastRooms.length === 0;
        toast(`获取到 ${lastRooms.length} 个关注房间`);
        btnFetch.textContent = `已获取 (${lastRooms.length})`;
      } catch (err) {
        toast(err.message || "获取失败");
        btnFetch.textContent = "获取斗鱼关注";
      } finally {
        btnFetch.disabled = false;
      }
    });

    btnCopy.addEventListener("click", () => {
      if (!lastRooms.length) return;
      GM_setClipboard(toLemonJson(lastRooms), { type: "text", mimetype: "text/plain" });
      toast(`已复制 ${lastRooms.length} 条 JSON 到剪贴板`);
    });

    btnSync.addEventListener("click", () => {
      if (!lastRooms.length) return;
      syncToLemonLive(lastRooms);
    });

    wrap.append(btnFetch, btnCopy, btnSync);
    document.documentElement.appendChild(wrap);
  }

  if (isDouyu) {
    createDouyuUi();
  }

  if (isLemonLive) {
    const added = applyGmToLocalStorage();
    if (added === 0 && GM_getValue(GM_STORE_KEY, null)) {
      // GM 有数据但合并后无新增
      GM_deleteValue(GM_STORE_KEY);
    }
  }
})();
