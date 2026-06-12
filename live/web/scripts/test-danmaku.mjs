import WebSocket from 'ws';

function encodeDouyuMsg(msg) {
  const payload = Buffer.from(msg + '\0', 'utf8');
  const len = payload.length + 8;
  const buf = Buffer.alloc(len + 4);
  buf.writeInt32LE(len, 0);
  buf.writeInt32LE(len, 4);
  buf.writeInt16LE(689, 8); // magic
  buf.writeInt16LE(0, 10);
  payload.copy(buf, 12);
  return buf;
}

function parseDouyuMsg(buffer) {
  const msgs = [];
  let offset = 0;
  while (offset + 12 < buffer.length) {
    const len = buffer.readInt32LE(offset);
    if (len <= 8 || offset + len + 4 > buffer.length) break;
    const msgBuf = buffer.subarray(offset + 12, offset + len + 4 - 1);
    msgs.push(msgBuf.toString('utf8'));
    offset += len + 4;
  }
  return msgs;
}

const ws = new WebSocket('wss://danmuproxy.douyu.com:8506/');
ws.on('open', () => {
  console.log('connected');
  ws.send(encodeDouyuMsg('type@=loginreq/roomid@=252140/'));
  ws.send(encodeDouyuMsg('type@=joingroup/rid@=252140/gid@=-9999/'));
});

ws.on('message', data => {
  const msgs = parseDouyuMsg(data);
  for (const m of msgs) {
    if (m.includes('type@=chatmsg')) {
      const parts = m.split('/');
      const msg = {};
      for (const p of parts) {
        if (!p) continue;
        const [k, v] = p.split('@=');
        if (k && v) msg[k] = v.replace(/@S/g, '/').replace(/@A/g, '@');
      }
      console.log(`[${msg.nn}] ${msg.txt}`);
    }
  }
});
