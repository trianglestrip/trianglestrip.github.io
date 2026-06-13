const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": USER_AGENT,
  Referer: "https://www.douyu.com/",
};

export interface BetardRoom {
  room_id: number;
  nickname?: string;
  show_status?: number;
  room_name?: string;
  room_pic?: string;
  coverSrc?: string;
  room_src?: string;
  videoLoop?: number;
}

export async function getRoomId(url: string): Promise<string> {
  const ridMatch = url.match(/douyu\.com\/(\d+)/) || url.match(/rid=(\d+)/);
  if (ridMatch) {
    return ridMatch[1];
  }
  const path = url.split("douyu.com/")[1]?.split("?")[0]?.split("/")[0];
  if (!path) {
    throw new Error(`无效的斗鱼地址: ${url}`);
  }
  const res = await fetch(`https://m.douyu.com/${path}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  const html = await res.text();
  const match = html.match(/"rid":(\d+)/);
  if (!match) {
    throw new Error(`无法解析房间号: ${url}`);
  }
  return match[1];
}

export async function fetchBetard(rid: string): Promise<BetardRoom> {
  const res = await fetch(`https://www.douyu.com/betard/${rid}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`betard HTTP ${res.status}`);
  }
  const data = (await res.json()) as { room: BetardRoom };
  return data.room;
}

export function coverFromRoom(room: BetardRoom): string {
  let cover = String(room.room_pic || room.coverSrc || "").trim();
  if (!cover) {
    const src = String(room.room_src || "").trim();
    if (src.startsWith("//")) {
      cover = `https:${src}`;
    } else if (src.startsWith("http")) {
      cover = src;
    } else if (src) {
      cover = `https://rpic.douyucdn.cn/${src.replace(/^\//, "")}`;
    }
  } else if (cover.startsWith("//")) {
    cover = `https:${cover}`;
  }
  return cover;
}
