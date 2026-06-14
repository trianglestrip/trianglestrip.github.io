const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141";

const SEARCH_ALIASES: Record<string, string[]> = {
  战地1: ["Battlefield 1"],
  战地5: ["Battlefield V", "Battlefield 5"],
  街头霸王6: ["Street Fighter 6"],
  街头霸王2: ["Street Fighter 2"],
  掘地求升: ["Getting Over It"],
  木筏求生: ["Raft"],
  "F1 车队经理 2024": ["F1 Manager 2024"],
  绝地潜兵2: ["Helldivers 2"],
  "塞尔达传说：旷野之息": ["The Legend of Zelda Breath of the Wild"],
  恐惧饥荒: ["Dread Hunger"],
  战神: ["God of War"],
  泰坦陨落: ["Titanfall 2", "Titanfall"],
  公路救赎: ["Road Redemption"],
  祖玛: ["Zuma Deluxe"],
  三国志11: ["Romance of the Three Kingdoms XI", "三國志11"],
  从军: ["Enlisted"],
  米塔: ["MiSide"],
  "沙盒与副本：英勇之地": ["英勇之地"],
  仓库猎人模拟器: ["Storage Hunter Simulator"],
  宝可梦朱紫: ["Pokemon Scarlet", "Pokemon Violet"],
  拳皇97: ["The King of Fighters 97", "拳皇97"],
  "鹅鸭杀（手游）": ["鹅鸭杀", "Goose Goose Duck"],
  "The Finals": ["THE FINALS"],
  骗子酒馆: ["Liar's Bar"],
  链在一起: ["Chained Together"],
  土豆兄弟: ["Brotato"],
  海底大猎杀: ["Feed and Grow Fish"],
  途游斗地主: ["途游斗地主"],
  禅游斗地主: ["禅游斗地主"],
  JJ麻将: ["JJ麻将"],
};

export function normGameSearchName(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[：:!！?？·]/g, "")
    .replace(/[\s\u3000]+/g, "");
}

export function scoreGameNameMatch(query: string, candidate: string): number {
  const q = normGameSearchName(query);
  const c = normGameSearchName(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.includes(q)) {
    if (q.length >= 3) return 85;
  }
  if (q.includes(c)) {
    if (c.length >= 3) return Math.min(85, Math.round((c.length / q.length) * 100));
  }
  const head = query.split(/[：:]/)[0]?.trim();
  if (head && normGameSearchName(head) === c) return 85;
  return 0;
}

export function gameIconSearchTerms(name: string): string[] {
  const terms = [name];
  const head = name.split(/[：:]/)[0]?.trim();
  if (head && head !== name) terms.push(head);
  for (const extra of SEARCH_ALIASES[name] || []) terms.push(extra);
  return [...new Set(terms.filter(Boolean))];
}

function isLatinText(text: string): boolean {
  return /^[\x20-\x7E]+$/.test(text.trim());
}

function pickItunesIcon(
  searchTerm: string,
  matchName: string,
  results: Array<{ trackName?: string; artworkUrl100?: string }>,
): string {
  const aliasTerms = SEARCH_ALIASES[matchName] || [];
  const trustFirst = aliasTerms.includes(searchTerm) || (searchTerm !== matchName && isLatinText(searchTerm));
  if (trustFirst && results[0]?.artworkUrl100) {
    return String(results[0].artworkUrl100).replace(/100x100bb/, "512x512bb");
  }

  let best = "";
  let bestScore = 0;
  for (const item of results) {
    const score = scoreGameNameMatch(matchName, item.trackName || "");
    if (score >= 55 && score > bestScore && item.artworkUrl100) {
      bestScore = score;
      best = String(item.artworkUrl100).replace(/100x100bb/, "512x512bb");
    }
  }
  return best;
}

function pickSteamIcon(
  searchTerm: string,
  matchName: string,
  items: Array<{ id?: number; name?: string }>,
): string {
  const aliasTerms = SEARCH_ALIASES[matchName] || [];
  const trustFirst = aliasTerms.includes(searchTerm) || (searchTerm !== matchName && isLatinText(searchTerm));
  const first = items[0];
  if (trustFirst && first?.id) {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${first.id}/library_600x900.jpg`;
  }

  let best: { id?: number; name?: string } | null = null;
  let bestScore = 0;
  for (const item of items) {
    const score = scoreGameNameMatch(matchName, item.name || "");
    if (score >= 50 && score > bestScore && item.id) {
      bestScore = score;
      best = item;
    }
  }
  if (!best?.id) return "";
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${best.id}/library_600x900.jpg`;
}

export async function itunesGameIcon(searchTerm: string, matchName = searchTerm): Promise<string> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=software&country=cn&limit=6`;
  const data = (await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
  }).then((r) => r.json())) as {
    results?: Array<{ trackName?: string; artworkUrl100?: string }>;
  };
  return pickItunesIcon(searchTerm, matchName, data.results || []);
}

export async function steamGameIcon(searchTerm: string, matchName = searchTerm): Promise<string> {
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(searchTerm)}&l=schinese&cc=CN`;
  const data = (await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
  }).then((r) => r.json())) as {
    items?: Array<{ id?: number; name?: string }>;
  };
  return pickSteamIcon(searchTerm, matchName, data.items || []);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveGameIconFromWeb(
  name: string,
  delayMs = 180,
): Promise<{ pic: string; source: "itunes" | "steam" } | null> {
  for (const term of gameIconSearchTerms(name)) {
    try {
      const ios = await itunesGameIcon(term, name);
      if (ios) return { pic: ios, source: "itunes" };
    } catch {
      /* ignore */
    }
    await sleep(delayMs);
    try {
      const steam = await steamGameIcon(term, name);
      if (steam) return { pic: steam, source: "steam" };
    } catch {
      /* ignore */
    }
    await sleep(delayMs);
  }
  return null;
}
