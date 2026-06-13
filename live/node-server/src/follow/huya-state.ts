export type HuyaRoomState = "live" | "replay" | "offline";

export interface HuyaPageRoomFlags {
  isOn?: boolean;
  isReplay?: boolean;
}

function isReplayFlag(value: unknown): boolean {
  return value === 1 || value === "1" || value === true;
}

function isReplayStatus(status: string): boolean {
  return status === "REPLAY" || status === "VOD";
}

function hlsLooksReplay(liveData: Record<string, unknown>): boolean {
  const hls = String(liveData.hls || liveData.hlsUrl || "");
  if (!hls) return false;
  return hls.includes("livereplay") || hls.includes("al-vod.cdn.huya.com") || hls.includes("/vhuya/clips/");
}

function hasFlvStreamList(data: Record<string, unknown>): boolean {
  const stream = (data.stream || {}) as Record<string, unknown>;
  const baseList = stream.baseSteamInfoList as unknown[] | undefined;
  return Boolean(baseList?.length);
}

/** profileRoom 在「无 FLV 流」且可能是录播/重播时，需再读页面 TT_ROOM_DATA.isOn 区分真重播与已下播。 */
export function profileNeedsPageCheck(data: Record<string, unknown>): boolean {
  if (hasFlvStreamList(data)) return false;
  const liveData = (data.liveData || {}) as Record<string, unknown>;
  const liveStatus = String(data.liveStatus || "").toUpperCase();
  const realLiveStatus = String(data.realLiveStatus || "").toUpperCase();
  if (isReplayFlag(liveData.isReplay)) return true;
  if (isReplayStatus(liveStatus) || isReplayStatus(realLiveStatus)) return true;
  if (hlsLooksReplay(liveData)) return true;
  return false;
}

/**
 * 根据 profileRoom 数据判断虎牙房间状态。
 * page.isOn === false 表示页面认定未在播（含录播已结束），应视为 offline。
 */
export function huyaRoomState(data: Record<string, unknown>, page?: HuyaPageRoomFlags): HuyaRoomState {
  const liveData = (data.liveData || {}) as Record<string, unknown>;
  const liveStatus = String(data.liveStatus || "").toUpperCase();
  const realLiveStatus = String(data.realLiveStatus || "").toUpperCase();
  const hasFlv = hasFlvStreamList(data);

  if (liveStatus === "OFF" && realLiveStatus === "OFF") return "offline";

  if (page?.isOn === false) return "offline";

  const replayHint =
    isReplayFlag(liveData.isReplay) ||
    isReplayStatus(liveStatus) ||
    isReplayStatus(realLiveStatus) ||
    hlsLooksReplay(liveData);

  if (liveStatus === "ON" || realLiveStatus === "ON") {
    if (isReplayFlag(liveData.isReplay) || page?.isReplay) return "replay";
    return "live";
  }

  if (replayHint) {
    if (hasFlv || page?.isOn === true) return "replay";
    return "offline";
  }

  if (hasFlv && liveStatus !== "OFF" && realLiveStatus !== "OFF") return "live";

  return "offline";
}
