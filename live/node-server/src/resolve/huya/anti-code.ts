import { createHash, randomInt } from "node:crypto";

export function buildAntiCode(oldAntiCode: string, streamName: string): string {
  const paramsT = 100;
  const sdkVersion = 2403051612;
  const t13 = Math.floor(Date.now() / 1000) * 1000;
  const sdkSid = t13;
  const initUuid = (Math.trunc((t13 % 10 ** 10) * 1000) + Math.trunc(1000 * Math.random())) % 4294967295;
  const uid = randomInt(1400000000000, 1400009999999);
  const seqId = uid + sdkSid;
  const targetUnixTime = Math.trunc((t13 + 110624) / 1000);
  const wsTime = targetUnixTime.toString(16).toLowerCase();

  const urlQuery = new URLSearchParams(oldAntiCode);
  const fm = urlQuery.get("fm");
  const ctype = urlQuery.get("ctype");
  const fs = urlQuery.get("fs");
  if (!fm || !ctype || !fs) {
    throw new Error("无效的 anti_code");
  }

  const wsSecretPf = Buffer.from(decodeURIComponent(fm), "base64")
    .toString("utf8")
    .split("_")[0];
  const wsSecretHash = createHash("md5").update(`${seqId}|${ctype}|${paramsT}`).digest("hex");
  const wsSecret = `${wsSecretPf}_${uid}_${streamName}_${wsSecretHash}_${wsTime}`;
  const wsSecretMd5 = createHash("md5").update(wsSecret).digest("hex");

  return (
    `wsSecret=${wsSecretMd5}&wsTime=${wsTime}&seqid=${seqId}&ctype=${ctype}&ver=1` +
    `&fs=${fs}&uuid=${initUuid}&u=${uid}&t=${paramsT}&sv=${sdkVersion}` +
    `&sdk_sid=${sdkSid}&codec=264`
  );
}
