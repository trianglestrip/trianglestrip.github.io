/** 抖音弹幕所需的最小 protobuf 读写（无第三方依赖）。 */

function readVarint(buf: Uint8Array, pos: number): [number, number] {
  let result = 0;
  let shift = 0;
  let offset = pos;
  while (offset < buf.length) {
    const byte = buf[offset++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return [result >>> 0, offset];
}

function writeVarint(value: number): Uint8Array {
  const out: number[] = [];
  let v = value >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return Uint8Array.from(out);
}

function writeTag(fieldNum: number, wireType: number): Uint8Array {
  return writeVarint((fieldNum << 3) | wireType);
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export interface PbField {
  num: number;
  wire: number;
  value: number | Uint8Array;
}

export function decodeFields(buf: Uint8Array): PbField[] {
  const fields: PbField[] = [];
  let pos = 0;
  while (pos < buf.length) {
    const [tag, next] = readVarint(buf, pos);
    if (next <= pos) break;
    pos = next;
    const fieldNum = tag >>> 3;
    const wire = tag & 7;
    if (wire === 0) {
      const [val, p2] = readVarint(buf, pos);
      if (p2 <= pos) break;
      fields.push({ num: fieldNum, wire, value: val });
      pos = p2;
    } else if (wire === 2) {
      const [len, p2] = readVarint(buf, pos);
      if (p2 <= pos) break;
      pos = p2;
      const size = Number(len);
      if (size < 0) break;
      const end = pos + size;
      if (end > buf.length) break;
      fields.push({ num: fieldNum, wire, value: buf.slice(pos, end) });
      pos = end;
    } else if (wire === 1) {
      pos += 8;
    } else if (wire === 5) {
      pos += 4;
    } else {
      break;
    }
  }
  return fields;
}

export function fieldString(fields: PbField[], num: number): string {
  for (const field of fields) {
    if (field.num !== num || field.wire !== 2 || !(field.value instanceof Uint8Array)) continue;
    return new TextDecoder().decode(field.value);
  }
  return "";
}

export function fieldBytes(fields: PbField[], num: number): Uint8Array | null {
  for (const field of fields) {
    if (field.num !== num || field.wire !== 2 || !(field.value instanceof Uint8Array)) continue;
    return field.value;
  }
  return null;
}

export function fieldUint(fields: PbField[], num: number): number {
  for (const field of fields) {
    if (field.num !== num || field.wire !== 0) continue;
    return Number(field.value);
  }
  return 0;
}

/** protobuf 大字段号（如 User.id_str=1028） */
export function fieldStringAny(fields: PbField[], num: number): string {
  for (const field of fields) {
    if (field.num !== num || field.wire !== 2 || !(field.value instanceof Uint8Array)) continue;
    return new TextDecoder().decode(field.value);
  }
  return "";
}

export function parseCommonCreateTime(payload: Uint8Array): number {
  const commonBuf = fieldBytes(decodeFields(payload), 1);
  if (!commonBuf) return 0;
  return normalizeUnixTime(fieldUint(decodeFields(commonBuf), 4));
}

export function normalizeUnixTime(value: number): number {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (num > 1_000_000_000_000) return Math.trunc(num / 1000);
  if (num > 1_000_000_000) return Math.trunc(num);
  return 0;
}

/** 过滤明显不是「本场开播」的 Unix 秒级时间戳 */
export function isPlausibleLiveStartAt(value: number): boolean {
  const ts = normalizeUnixTime(value);
  if (!ts) return false;
  const now = Math.floor(Date.now() / 1000);
  return ts >= now - 3 * 24 * 3600 && ts <= now + 120;
}

function parseUserName(userBuf: Uint8Array | null): string {
  if (!userBuf) return "";
  const userFields = decodeFields(userBuf);
  return (
    fieldString(userFields, 3) ||
    fieldStringAny(userFields, 38) ||
    fieldStringAny(userFields, 1028) ||
    ""
  );
}

function parseTextContent(textBuf: Uint8Array | null): string {
  if (!textBuf) return "";
  const textFields = decodeFields(textBuf);
  return fieldString(textFields, 1) || fieldString(textFields, 2);
}

export function fieldBool(fields: PbField[], num: number): boolean {
  return fieldUint(fields, num) === 1;
}

export function repeatedBytes(fields: PbField[], num: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (const field of fields) {
    if (field.num !== num || field.wire !== 2 || !(field.value instanceof Uint8Array)) continue;
    out.push(field.value);
  }
  return out;
}

function encodeStringField(fieldNum: number, text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  return concatChunks([writeTag(fieldNum, 2), writeVarint(bytes.length), bytes]);
}

function encodeBytesField(fieldNum: number, payload: Uint8Array): Uint8Array {
  return concatChunks([writeTag(fieldNum, 2), writeVarint(payload.length), payload]);
}

function encodeUintField(fieldNum: number, value: number): Uint8Array {
  return concatChunks([writeTag(fieldNum, 0), writeVarint(value)]);
}

export function encodePushFrame(opts: {
  logId?: number;
  payloadType?: string;
  payload?: Uint8Array;
}): Uint8Array {
  const chunks: Uint8Array[] = [];
  if (opts.logId) chunks.push(encodeUintField(2, opts.logId));
  if (opts.payloadType) chunks.push(encodeStringField(7, opts.payloadType));
  if (opts.payload) chunks.push(encodeBytesField(8, opts.payload));
  return concatChunks(chunks);
}

export interface DouyinChatItem {
  user: string;
  text: string;
}

export interface DouyinStreamMeta {
  liveStartAt?: number;
  fanGroup?: string;
}

export function parseChatMessage(payload: Uint8Array): DouyinChatItem | null {
  const fields = decodeFields(payload);
  const content = fieldString(fields, 3) || parseTextContent(fieldBytes(fields, 22));
  if (!content) return null;
  const user = parseUserName(fieldBytes(fields, 2)) || "观众";
  return { user, text: content };
}

export function parseEmojiChatMessage(payload: Uint8Array): DouyinChatItem | null {
  const fields = decodeFields(payload);
  const content = fieldString(fields, 5) || parseTextContent(fieldBytes(fields, 4));
  if (!content) return null;
  const user = parseUserName(fieldBytes(fields, 2)) || "观众";
  return { user, text: content };
}

export function parseUpdateFanTicketMessage(payload: Uint8Array): { fanGroup: string } | null {
  const fields = decodeFields(payload);
  const count = fieldUint(fields, 3);
  const text = fieldString(fields, 2);
  if (count > 0) return { fanGroup: String(count) };
  if (text) return { fanGroup: text };
  return null;
}
