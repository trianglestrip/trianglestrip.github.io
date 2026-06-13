import type { ResolveCache } from "../cache/resolve-cache.js";
import type { ResolveService } from "./service.js";

function wallResolve(
  resolveService: ResolveService,
  site: string,
  room: string,
  quality: string | null | undefined,
  force: boolean,
) {
  const t0 = performance.now();
  return resolveService
    .resolveRoom({ site, roomId: room, mode: "lazy", quality, force })
    .then((payload) => {
      const wallMs = Math.trunc(performance.now() - t0);
      const timing = (payload._timing as Record<string, unknown>) || {};
      return {
        wall_ms: wallMs,
        timing,
        cached: Boolean(payload.cached),
        cached_meta: Boolean(timing.meta_cached),
        cached_tier: Boolean(timing.tier_cached),
        payload_cached: Boolean(timing.payload_cached),
        anchor: String(payload.anchor_name || payload.title || ""),
        is_live: payload.is_live,
      };
    });
}

export function buildTimeReport(
  resolveService: ResolveService,
  cache: ResolveCache,
  site: string,
  room: string,
  opts?: { quality?: string | null; run?: boolean },
): Promise<Record<string, unknown>> {
  const quality = opts?.quality;
  const run = opts?.run ?? false;

  const report: Record<string, unknown> = {
    ok: true,
    server_time: new Date().toISOString(),
    cache: cache.stats(),
    params: {
      site,
      room,
      quality: quality || "",
      run,
    },
  };

  if (!run) {
    return Promise.resolve(report);
  }

  return Promise.all([
    wallResolve(resolveService, site, room, quality, true),
    wallResolve(resolveService, site, room, quality, false),
  ]).then(([cold, warm]) => {
    report.benchmark = {
      site,
      room,
      quality: quality || "",
      runs: [
        { label: "cold", desc: "force=1 跳过缓存", ...cold },
        { label: "warm", desc: "命中 payload 缓存", ...warm },
      ],
    };
    return report;
  });
}
