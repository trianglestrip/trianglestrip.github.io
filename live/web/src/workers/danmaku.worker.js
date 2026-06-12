function parseDouyuMsg(buffer) {
  const view = new DataView(buffer);
  const msgs = [];
  let offset = 0;
  const decoder = new TextDecoder("utf-8");
  while (offset + 12 < buffer.byteLength) {
    const len = view.getInt32(offset, true);
    if (len <= 8 || offset + len + 4 > buffer.byteLength) break;
    const end = offset + len + 4 - 1;
    msgs.push(decoder.decode(new Uint8Array(buffer, offset + 12, end - (offset + 12))));
    offset += len + 4;
  }
  return msgs;
}

function parseChatMsg(raw) {
  const msg = {};
  for (const part of raw.split("/")) {
    if (!part) continue;
    const idx = part.indexOf("@=");
    if (idx === -1) continue;
    const key = part.slice(0, idx);
    const value = part.slice(idx + 2).replace(/@S/g, "/").replace(/@A/g, "@");
    msg[key] = value;
  }
  return msg;
}

function colorFromDouyu(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "#ffffff";
  return `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;
}

self.onmessage = (event) => {
  const { type, buffer, seq } = event.data;
  if (type !== "parse" || !(buffer instanceof ArrayBuffer)) return;

  const items = [];
  let localSeq = 0;
  for (const raw of parseDouyuMsg(buffer)) {
    if (!raw.includes("type@=chatmsg")) continue;
    const msg = parseChatMsg(raw);
    if (!msg.nn || !msg.txt) continue;
    localSeq += 1;
    items.push({
      id: msg.cid || `${seq}-${localSeq}`,
      user: msg.nn,
      text: msg.txt,
      color: colorFromDouyu(msg.col),
    });
  }

  if (items.length) {
    self.postMessage({ type: "messages", items });
  }
};
