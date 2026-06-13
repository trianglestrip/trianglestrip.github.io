/** 抖音 web enter 接口 a_bogus 签名（移植自 streamget ab_sign.py）。 */

function leftRotate(x: number, n: number): number {
  n %= 32;
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

function getTj(j: number): number {
  if (j >= 0 && j < 16) return 2043430169;
  if (j >= 16 && j < 64) return 2055708042;
  throw new Error("invalid j for constant Tj");
}

function ffJ(j: number, x: number, y: number, z: number): number {
  if (j >= 0 && j < 16) return (x ^ y ^ z) >>> 0;
  if (j >= 16 && j < 64) return ((x & y) | (x & z) | (y & z)) >>> 0;
  throw new Error("invalid j for bool function FF");
}

function ggJ(j: number, x: number, y: number, z: number): number {
  if (j >= 0 && j < 16) return (x ^ y ^ z) >>> 0;
  if (j >= 16 && j < 64) return ((x & y) | ((~x >>> 0) & z)) >>> 0;
  throw new Error("invalid j for bool function GG");
}

function rc4Encrypt(plaintext: string, key: string): string {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    [s[i], s[j]] = [s[j], s[i]];
  }
  let i = 0;
  j = 0;
  let out = "";
  for (const char of plaintext) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    [s[i], s[j]] = [s[j], s[i]];
    const t = (s[i] + s[j]) % 256;
    out += String.fromCharCode(s[t] ^ char.charCodeAt(0));
  }
  return out;
}

class SM3 {
  private reg: number[] = [];
  private chunk: number[] = [];
  private size = 0;

  reset(): void {
    this.reg = [1937774191, 1226093241, 388252375, 3666478592, 2842636476, 372324522, 3817729613, 2969243214];
    this.chunk = [];
    this.size = 0;
  }

  write(data: string | number[]): void {
    const bytes = typeof data === "string" ? [...new TextEncoder().encode(data)] : [...data];
    this.size += bytes.length;
    let offset = 0;
    while (offset < bytes.length) {
      const space = 64 - this.chunk.length;
      const take = Math.min(space, bytes.length - offset);
      this.chunk.push(...bytes.slice(offset, offset + take));
      offset += take;
      while (this.chunk.length >= 64) {
        this.compress(this.chunk.slice(0, 64));
        this.chunk = this.chunk.slice(64);
      }
    }
  }

  private fill(): void {
    const bitLength = 8 * this.size;
    let paddingPos = this.chunk.length;
    this.chunk.push(0x80);
    paddingPos = (paddingPos + 1) % 64;
    if (64 - paddingPos < 8) paddingPos -= 64;
    while (paddingPos < 56) {
      this.chunk.push(0);
      paddingPos += 1;
    }
    const highBits = Math.floor(bitLength / 4294967296);
    for (let i = 3; i >= 0; i--) this.chunk.push((highBits >>> (8 * i)) & 0xff);
    for (let i = 3; i >= 0; i--) this.chunk.push((bitLength >>> (8 * i)) & 0xff);
  }

  private compress(data: number[]): void {
    const w = new Array<number>(132).fill(0);
    for (let t = 0; t < 16; t++) {
      w[t] =
        ((data[4 * t] << 24) | (data[4 * t + 1] << 16) | (data[4 * t + 2] << 8) | data[4 * t + 3]) >>> 0;
    }
    for (let j = 16; j < 68; j++) {
      const a = (w[j - 16] ^ w[j - 9] ^ leftRotate(w[j - 3], 15)) >>> 0;
      const b = (a ^ leftRotate(a, 15) ^ leftRotate(a, 23)) >>> 0;
      w[j] = (b ^ leftRotate(w[j - 13], 7) ^ w[j - 6]) >>> 0;
    }
    for (let j = 0; j < 64; j++) w[j + 68] = (w[j] ^ w[j + 4]) >>> 0;

    let [a, b, c, d, e, f, g, h] = this.reg;
    for (let j = 0; j < 64; j++) {
      const ss1 = leftRotate(
        (leftRotate(a, 12) + e + leftRotate(getTj(j), j)) >>> 0,
        7,
      );
      const ss2 = (ss1 ^ leftRotate(a, 12)) >>> 0;
      const tt1 = (ffJ(j, a, b, c) + d + ss2 + w[j + 68]) >>> 0;
      const tt2 = (ggJ(j, e, f, g) + h + ss1 + w[j]) >>> 0;
      d = c;
      c = leftRotate(b, 9);
      b = a;
      a = tt1;
      h = g;
      g = leftRotate(f, 19);
      f = e;
      e = (tt2 ^ leftRotate(tt2, 9) ^ leftRotate(tt2, 17)) >>> 0;
    }
    this.reg[0] ^= a;
    this.reg[1] ^= b;
    this.reg[2] ^= c;
    this.reg[3] ^= d;
    this.reg[4] ^= e;
    this.reg[5] ^= f;
    this.reg[6] ^= g;
    this.reg[7] ^= h;
  }

  sum(data?: string | number[]): number[] {
    if (data !== undefined) {
      this.reset();
      this.write(data);
    }
    this.fill();
    for (let f = 0; f < this.chunk.length; f += 64) {
      this.compress(this.chunk.slice(f, f + 64));
    }
    const result: number[] = [];
    for (const val of this.reg) {
      result.push((val >>> 24) & 0xff, (val >>> 16) & 0xff, (val >>> 8) & 0xff, val & 0xff);
    }
    this.reset();
    return result;
  }
}

function getLongInt(roundNum: number, longStr: string): number {
  const round = roundNum * 3;
  const char1 = round < longStr.length ? longStr.charCodeAt(round) : 0;
  const char2 = round + 1 < longStr.length ? longStr.charCodeAt(round + 1) : 0;
  const char3 = round + 2 < longStr.length ? longStr.charCodeAt(round + 2) : 0;
  return (char1 << 16) | (char2 << 8) | char3;
}

function resultEncrypt(longStr: string, tableKey: keyof typeof ENCODING_TABLES): string {
  const encodingTable = ENCODING_TABLES[tableKey];
  const masks = [16515072, 258048, 4032, 63];
  const shifts = [18, 12, 6, 0];
  let result = "";
  let roundNum = 0;
  let longInt = getLongInt(roundNum, longStr);
  const totalChars = Math.ceil((longStr.length / 3) * 4);
  for (let i = 0; i < totalChars; i++) {
    if (Math.floor(i / 4) !== roundNum) {
      roundNum += 1;
      longInt = getLongInt(roundNum, longStr);
    }
    const index = i % 4;
    const charIndex = (longInt & masks[index]) >> shifts[index];
    result += encodingTable[charIndex];
  }
  return result;
}

const ENCODING_TABLES = {
  s0: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  s3: "ckdp1h4ZKsUB80/Mfvw36XIgR25+WQAlEi7NLboqYTOPuzmFjJnryx9HVGDaStCe",
  s4: "Dkdpgh2ZmsQB80/MfvV36XI1R45-WUAlEixNLwoqYTOPuzKFjJnry79HbGcaStCe",
};

function generRandom(randomNum: number, option: number[]): number[] {
  const byte1 = randomNum & 255;
  const byte2 = (randomNum >> 8) & 255;
  return [
    (byte1 & 170) | (option[0] & 85),
    (byte1 & 85) | (option[0] & 170),
    (byte2 & 170) | (option[1] & 85),
    (byte2 & 85) | (option[1] & 170),
  ];
}

function generateRandomStr(): string {
  const randomValues = [0.123456789, 0.987654321, 0.555555555];
  const bytes: number[] = [];
  bytes.push(...generRandom(Math.trunc(randomValues[0] * 10000), [3, 45]));
  bytes.push(...generRandom(Math.trunc(randomValues[1] * 10000), [1, 0]));
  bytes.push(...generRandom(Math.trunc(randomValues[2] * 10000), [1, 5]));
  return String.fromCharCode(...bytes);
}

function splitToBytes(num: number): number[] {
  return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255];
}

function generateRc4BbStr(
  urlSearchParams: string,
  userAgent: string,
  windowEnvStr: string,
  suffix = "cus",
  args: number[] = [0, 1, 14],
): string {
  const sm3 = new SM3();
  const startTime = Date.now();
  const urlSearchParamsList = sm3.sum(sm3.sum(urlSearchParams + suffix));
  const cus = sm3.sum(sm3.sum(suffix));
  const uaKey = String.fromCharCode(0, 1, 14);
  const ua = sm3.sum(resultEncrypt(rc4Encrypt(userAgent, uaKey), "s3"));
  const endTime = startTime + 100;

  const b: Record<number, number | number[] | Record<string, unknown>> = {
    8: 3,
    10: endTime,
    15: { aid: 6383, pageId: 110624 },
    16: startTime,
    18: 44,
    19: [1, 0, 1, 5],
  };

  const startBytes = splitToBytes(b[16] as number);
  b[20] = startBytes[0];
  b[21] = startBytes[1];
  b[22] = startBytes[2];
  b[23] = startBytes[3];
  b[24] = Math.trunc((b[16] as number) / 2 ** 32) & 255;
  b[25] = Math.trunc((b[16] as number) / 2 ** 40) & 255;

  const arg0Bytes = splitToBytes(args[0]);
  b[26] = arg0Bytes[0];
  b[27] = arg0Bytes[1];
  b[28] = arg0Bytes[2];
  b[29] = arg0Bytes[3];
  b[30] = Math.trunc(args[1] / 256) & 255;
  b[31] = args[1] % 256;
  const arg1Bytes = splitToBytes(args[1]);
  b[32] = arg1Bytes[0];
  b[33] = arg1Bytes[1];
  const arg2Bytes = splitToBytes(args[2]);
  b[34] = arg2Bytes[0];
  b[35] = arg2Bytes[1];
  b[36] = arg2Bytes[2];
  b[37] = arg2Bytes[3];

  b[38] = urlSearchParamsList[21];
  b[39] = urlSearchParamsList[22];
  b[40] = cus[21];
  b[41] = cus[22];
  b[42] = ua[23];
  b[43] = ua[24];

  const endBytes = splitToBytes(b[10] as number);
  b[44] = endBytes[0];
  b[45] = endBytes[1];
  b[46] = endBytes[2];
  b[47] = endBytes[3];
  b[48] = b[8] as number;
  b[49] = Math.trunc((b[10] as number) / 2 ** 32) & 255;
  b[50] = Math.trunc((b[10] as number) / 2 ** 40) & 255;

  const pageId = (b[15] as { pageId: number }).pageId;
  b[51] = pageId;
  const pageIdBytes = splitToBytes(pageId);
  b[52] = pageIdBytes[0];
  b[53] = pageIdBytes[1];
  b[54] = pageIdBytes[2];
  b[55] = pageIdBytes[3];
  const aid = (b[15] as { aid: number }).aid;
  b[56] = aid;
  b[57] = aid & 255;
  b[58] = (aid >> 8) & 255;
  b[59] = (aid >> 16) & 255;
  b[60] = (aid >> 24) & 255;

  const windowEnvList = [...windowEnvStr].map((ch) => ch.charCodeAt(0));
  b[64] = windowEnvList.length;
  b[65] = (b[64] as number) & 255;
  b[66] = ((b[64] as number) >> 8) & 255;
  b[69] = 0;
  b[70] = 0;
  b[71] = 0;
  b[72] =
    (b[18] as number) ^
    (b[20] as number) ^
    (b[26] as number) ^
    (b[30] as number) ^
    (b[38] as number) ^
    (b[40] as number) ^
    (b[42] as number) ^
    (b[21] as number) ^
    (b[27] as number) ^
    (b[31] as number) ^
    (b[35] as number) ^
    (b[39] as number) ^
    (b[41] as number) ^
    (b[43] as number) ^
    (b[22] as number) ^
    (b[28] as number) ^
    (b[32] as number) ^
    (b[36] as number) ^
    (b[23] as number) ^
    (b[29] as number) ^
    (b[33] as number) ^
    (b[37] as number) ^
    (b[44] as number) ^
    (b[45] as number) ^
    (b[46] as number) ^
    (b[47] as number) ^
    (b[48] as number) ^
    (b[49] as number) ^
    (b[50] as number) ^
    (b[24] as number) ^
    (b[25] as number) ^
    (b[52] as number) ^
    (b[53] as number) ^
    (b[54] as number) ^
    (b[55] as number) ^
    (b[57] as number) ^
    (b[58] as number) ^
    (b[59] as number) ^
    (b[60] as number) ^
    (b[65] as number) ^
    (b[66] as number) ^
    (b[70] as number) ^
    (b[71] as number);

  const bb = [
    b[18], b[20], b[52], b[26], b[30], b[34], b[58], b[38], b[40], b[53], b[42], b[21],
    b[27], b[54], b[55], b[31], b[35], b[57], b[39], b[41], b[43], b[22], b[28], b[32],
    b[60], b[36], b[23], b[29], b[33], b[37], b[44], b[45], b[59], b[46], b[47], b[48],
    b[49], b[50], b[24], b[25], b[65], b[66], b[70], b[71],
  ] as number[];
  bb.push(...windowEnvList);
  bb.push(b[72] as number);
  return rc4Encrypt(bb.map((byte) => String.fromCharCode(byte)).join(""), String.fromCharCode(121));
}

export function abSign(urlSearchParams: string, userAgent: string): string {
  const windowEnvStr = "1920|1080|1920|1040|0|30|0|0|1872|92|1920|1040|1857|92|1|24|Win32";
  return (
    resultEncrypt(generateRandomStr() + generateRc4BbStr(urlSearchParams, userAgent, windowEnvStr), "s4") + "="
  );
}
