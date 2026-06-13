/** 虎牙弹幕所需的最小 TARS/JCE 读写（仅覆盖 join 与聊天解析）。 */

const T = {
  INT8: 0,
  INT16: 1,
  INT32: 2,
  INT64: 3,
  FLOAT: 4,
  DOUBLE: 5,
  STRING1: 6,
  STRING4: 7,
  MAP: 8,
  LIST: 9,
  STRUCT_BEGIN: 10,
  STRUCT_END: 11,
  ZERO: 12,
  SIMPLE_LIST: 13,
};

function writeHead(writer, tag, type) {
  if (tag < 15) {
    writer.push((tag << 4) | type);
    return;
  }
  writer.push(0xf0 | type, tag);
}

function writeInt32(writer, tag, value) {
  const num = Number(value) || 0;
  if (num === 0) {
    writeHead(writer, tag, T.ZERO);
    return;
  }
  if (num >= -128 && num <= 127) {
    writeHead(writer, tag, T.INT8);
    writer.push(num & 0xff);
    return;
  }
  if (num >= -32768 && num <= 32767) {
    writeHead(writer, tag, T.INT16);
    const view = new DataView(new ArrayBuffer(2));
    view.setInt16(0, num, false);
    writer.push(...new Uint8Array(view.buffer));
    return;
  }
  writeHead(writer, tag, T.INT32);
  const view = new DataView(new ArrayBuffer(4));
  view.setInt32(0, num, false);
  writer.push(...new Uint8Array(view.buffer));
}

function writeInt64(writer, tag, value) {
  const num = Number(value) || 0;
  if (num >= -2147483648 && num <= 2147483647) {
    writeInt32(writer, tag, num);
    return;
  }
  writeHead(writer, tag, T.INT64);
  const view = new DataView(new ArrayBuffer(8));
  view.setBigInt64(0, BigInt(num), false);
  writer.push(...new Uint8Array(view.buffer));
}

function writeBool(writer, tag, value) {
  writeInt32(writer, tag, value ? 1 : 0);
}

function writeString(writer, tag, value) {
  const text = String(value ?? "");
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 255) {
    writeHead(writer, tag, T.STRING4);
    const lenView = new DataView(new ArrayBuffer(4));
    lenView.setInt32(0, bytes.length, false);
    writer.push(...new Uint8Array(lenView.buffer), ...bytes);
    return;
  }
  writeHead(writer, tag, T.STRING1);
  writer.push(bytes.length, ...bytes);
}

function writeBytes(writer, tag, bytes) {
  writeHead(writer, tag, T.SIMPLE_LIST);
  writeHead(writer, 0, T.INT8);
  writeInt32(writer, 0, bytes.length);
  writer.push(...bytes);
}

function writeStruct(writer, tag, fn) {
  writeHead(writer, tag, T.STRUCT_BEGIN);
  fn(writer);
  writeHead(writer, 0, T.STRUCT_END);
}

function encodeStruct(fn) {
  const writer = [];
  fn(writer);
  return new Uint8Array(writer);
}

export function buildHuyaJoinPayload(ayyuid, topSid) {
  const inner = encodeStruct((writer) => {
    writeInt64(writer, 0, ayyuid);
    writeBool(writer, 1, true);
    writeString(writer, 2, "");
    writeString(writer, 3, "");
    writeInt32(writer, 4, topSid);
    writeInt32(writer, 5, topSid);
    writeInt32(writer, 6, 0);
    writeInt32(writer, 7, 0);
  });
  const outer = encodeStruct((writer) => {
    writeInt32(writer, 0, 1);
    writeBytes(writer, 1, inner);
  });
  return outer.buffer;
}

export const HUYA_HEARTBEAT = Uint8Array.from(atob("ABQdAAwsNgBM"), (ch) => ch.charCodeAt(0));

class JceReader {
  constructor(buffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
    this.pos = 0;
    this.len = buffer.byteLength;
  }

  readHead() {
    let head = this.bytes[this.pos++];
    let tag = (head & 0xf0) >> 4;
    let type = head & 0x0f;
    if (tag >= 15) tag = this.bytes[this.pos++];
    return { tag, type };
  }

  skipField(type) {
    switch (type) {
      case T.ZERO:
        return;
      case T.INT8:
        this.pos += 1;
        return;
      case T.INT16:
        this.pos += 2;
        return;
      case T.INT32:
        this.pos += 4;
        return;
      case T.INT64:
        this.pos += 8;
        return;
      case T.FLOAT:
        this.pos += 4;
        return;
      case T.DOUBLE:
        this.pos += 8;
        return;
      case T.STRING1: {
        const len = this.bytes[this.pos++];
        this.pos += len;
        return;
      }
      case T.STRING4: {
        const len = this.view.getInt32(this.pos, false);
        this.pos += 4 + len;
        return;
      }
      case T.MAP: {
        const size = this.readInt32(0);
        for (let i = 0; i < size * 2; i += 1) {
          const head = this.readHead();
          this.skipField(head.type);
        }
        return;
      }
      case T.LIST: {
        const size = this.readInt32(0);
        for (let i = 0; i < size; i += 1) {
          const head = this.readHead();
          this.skipField(head.type);
        }
        return;
      }
      case T.STRUCT_BEGIN:
        this.skipToStructEnd();
        return;
      case T.STRUCT_END:
        return;
      case T.SIMPLE_LIST: {
        const inner = this.readHead();
        if (inner.type !== T.INT8) throw new Error("unexpected simple list type");
        const size = this.readInt32(0);
        this.pos += size;
        return;
      }
      default:
        throw new Error(`unsupported jce type ${type}`);
    }
  }

  skipToStructEnd() {
    while (this.pos < this.len) {
      const head = this.readHead();
      if (head.type === T.STRUCT_END) return;
      this.skipField(head.type);
    }
  }

  skipToTag(tag) {
    while (this.pos < this.len) {
      const saved = this.pos;
      const head = this.readHead();
      if (head.type === T.STRUCT_END) {
        this.pos = saved;
        return false;
      }
      if (head.tag >= tag) {
        this.pos = saved;
        return head.tag === tag;
      }
      this.skipField(head.type);
    }
    return false;
  }

  readInt32(tag) {
    if (!this.skipToTag(tag)) return 0;
    const { type } = this.readHead();
    if (type === T.ZERO) return 0;
    if (type === T.INT8) return this.view.getInt8(this.pos++);
    if (type === T.INT16) {
      const value = this.view.getInt16(this.pos, false);
      this.pos += 2;
      return value;
    }
    if (type === T.INT32) {
      const value = this.view.getInt32(this.pos, false);
      this.pos += 4;
      return value;
    }
    throw new Error(`int32 mismatch tag=${tag} type=${type}`);
  }

  readString(tag) {
    if (!this.skipToTag(tag)) return "";
    const { type } = this.readHead();
    if (type === T.ZERO) return "";
    let len = 0;
    if (type === T.STRING1) len = this.bytes[this.pos++];
    else if (type === T.STRING4) {
      len = this.view.getInt32(this.pos, false);
      this.pos += 4;
    } else {
      throw new Error(`string mismatch tag=${tag} type=${type}`);
    }
    const slice = this.bytes.slice(this.pos, this.pos + len);
    this.pos += len;
    return new TextDecoder().decode(slice);
  }

  readBytes(tag) {
    if (!this.skipToTag(tag)) return null;
    const { type } = this.readHead();
    if (type !== T.SIMPLE_LIST) throw new Error(`bytes mismatch tag=${tag} type=${type}`);
    const inner = this.readHead();
    if (inner.type !== T.INT8) throw new Error("bytes inner type mismatch");
    const size = this.readInt32(0);
    const slice = this.bytes.slice(this.pos, this.pos + size);
    this.pos += size;
    return slice;
  }
}

function colorFromHuya(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "#ffffff";
  return `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;
}

function parseHyMessage(buffer) {
  const reader = new JceReader(buffer);
  let nickName = "";
  let content = "";
  let color = "#ffffff";

  while (reader.pos < reader.len) {
    const start = reader.pos;
    const head = reader.readHead();
    if (head.type === T.STRUCT_END) break;

    if (head.tag === 0 && head.type === T.STRUCT_BEGIN) {
      nickName = reader.readString(2);
      reader.skipToStructEnd();
      continue;
    }
    if (head.tag === 3) {
      reader.pos = start;
      content = reader.readString(3);
      continue;
    }
    if (head.tag === 6 && head.type === T.STRUCT_BEGIN) {
      color = colorFromHuya(reader.readInt32(0));
      reader.skipToStructEnd();
      continue;
    }

    reader.pos = start;
    const skipHead = reader.readHead();
    reader.skipField(skipHead.type);
  }

  if (!nickName || !content) return null;
  return { user: nickName, text: content, color };
}

export function parseHuyaChatMessages(buffer) {
  const reader = new JceReader(buffer);
  const msgType = reader.readInt32(0);
  if (msgType !== 7) return [];

  const payload = reader.readBytes(1);
  if (!payload) return [];

  const pushReader = new JceReader(payload.buffer);
  const uri = pushReader.readInt32(1);
  if (uri !== 1400) return [];

  const msgBytes = pushReader.readBytes(2);
  if (!msgBytes) return [];

  const chat = parseHyMessage(msgBytes.buffer);
  return chat ? [chat] : [];
}
