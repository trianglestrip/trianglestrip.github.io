# Live 平台适配说明

> 轻量注册表解耦前后端；新增平台只需实现 adapter 并在 registry 注册。  
> 并行任务与波次见 [TASK.md](TASK.md)。

## Adapter 契约

后端定义于 `node-server/src/platforms/types.ts`：

| 接口 | 职责 |
|------|------|
| `ResolveAdapter` | `loadMeta` / `resolveTier` / `resolveAllTiers` / `normalizeUrl` |
| `BrowseAdapter` | `fetchCategories` / `fetchRecommendRooms` / `fetchCategoryRooms`；可选 `fetchGroupRooms` |
| `DanmakuAdapter` | `fetchSession(roomId)` → WS/SSE 所需参数 |
| `PlatformDef` | `id`, `resolve`, `browse?`, `danmaku?`, `crossWeight?`, `roomIdPattern?` |

注册表：`node-server/src/platforms/registry.ts`  
导出：`PLATFORMS`, `getPlatform(id)`, `BROWSE_SITE_IDS`, `CROSS_SITE_WEIGHTS`, `ROOM_ID_PATTERNS`

前端弹幕：`web/src/platforms/danmakuRegistry.js` + `connectors/{id}.js`

### 加平台 Checklist

1. 实现 `resolve/{id}/`（可选 `browse/{id}.ts`、`danmaku/{id}.ts`）
2. 在 `registry.ts` 注册 `PlatformDef`
3. 前端 `connectors/{id}.js` + 注册到 `danmakuRegistry.js`（若需弹幕）
4. `web/src/config/platforms.js` 启用 UI
5. sync 脚本增加分类源 + `sites.{id}` 映射（见 `category-cross-map.ts`）
6. 更新本文件

---

## HTTP API

| 路径 | 方法 | 参数 | 说明 |
|------|------|------|------|
| `/api/room` | GET | `site`, `room`, `mode`, `quality`, `force` | 解析房间流地址 |
| `/api/categories` | GET | `site`, `force` | 分类树（磁盘缓存 24h） |
| `/api/rooms` | GET | `site`, `cid`, `pid`, `page`, `recommend` | 分区或推荐房间列表 |
| `/api/cross-rooms` | GET | `key`, `page`, `limit` | 跨平台热门分类房间 |
| `/api/recommend-related` | GET | `site`, `category`, `cid`, `page` | 侧栏相关推荐 |
| `/api/{site}/danmaku` | GET | `room` | 弹幕 session（虎牙/抖音等） |
| `/api/huya/danmaku` | GET | `room` | 虎牙 session（legacy alias） |
| `/api/douyin/danmaku` | GET | `room` | 抖音 session（legacy alias） |
| `/api/douyin/danmaku/stream` | GET | `room` | 抖音 SSE 弹幕流 |

---

## 斗鱼 (douyu)

| 能力 | 模块 | 说明 |
|------|------|------|
| Resolve | `resolve/douyu/` | betard + play-v1，多档 FLV |
| Browse | `browse/douyu.ts` | 分类 / 推荐 / 分区 / cate1 大类 |
| Danmaku | 前端直连 | `wss://danmuproxy.douyu.com:8506/` |
| 图标 | 分类 API | 随 categories 返回 |
| crossWeight | 2 | 跨平台聚合权重 |

---

## 虎牙 (huya)

| 能力 | 模块 | 说明 |
|------|------|------|
| Resolve | `resolve/huya/` | web-stream + anti-code |
| Browse | `browse/huya.ts` | 分类 / 推荐 / gid 大类 |
| Danmaku | `danmaku/huya.ts` + 前端 WS | `/api/huya/danmaku` → JCE join |
| 图标 | 分类 API | 随 categories 返回 |
| crossWeight | 2 | |

---

## 抖音 (douyin)

| 能力 | 模块 | 说明 |
|------|------|------|
| Resolve | `resolve/douyin/` | web-stream + ab-sign |
| Browse | `browse/douyin.ts` | 游戏分类；`fetchGroupRooms` 经 registry wrapper |
| Danmaku | `danmaku/douyin.ts` | session + SSE `/api/douyin/danmaku/stream` |
| 图标 | `douyin-game-icons.data.ts` | 本地映射 + resolver |
| crossWeight | 1 | |

---

## Bilibili (bilibili)

| 能力 | 模块 | 说明 |
|------|------|------|
| Resolve | `resolve/bilibili/` | get_info + getRoomPlayInfo，qn 10000/400/250/150/80 |
| Browse | `browse/bilibili.ts` | Area/getList、getRoomList、second/getList（失败降级 get_user_recommend） |
| Danmaku | `danmaku/bilibili.ts` + 前端 WS | getDanmuInfo（失败降级 getConf）→ op=7 鉴权、op=2 心跳 |
| 图标 | 分类 API `pic` | 随 categories 返回 |
| crossWeight | 1 | 跨平台聚合权重 2:2:1:1 |

**Resolve API**

| 接口 | 用途 |
|------|------|
| `room/v1/Room/get_info` | 房间 meta、live_status |
| `xlive/web-room/v2/index/getRoomPlayInfo` | 多档 FLV（http_stream/flv） |

**Browse API**

| 接口 | 用途 |
|------|------|
| `room/v1/Area/getList` | 分类树（parent 2/3/6/1 → 网游/手游/单机/娱乐） |
| `room/v1/Area/getRoomList` | 分区房间（cid=area_id, pid=parent_area_id） |
| `xlive/web-interface/v1/second/getList` | 推荐（风控时降级 `room/v1/Room/get_user_recommend`） |

**Danmaku**

| 接口 / 协议 | 说明 |
|-------------|------|
| `xlive/web-room/v1/index/getDanmuInfo` | host_list + token（失败降级 `room/v1/Danmu/getConf`） |
| WS `wss://{host}:{port}/sub` | 鉴权 op=7，心跳 op=2，消息 op=5（Brotli + DANMU_MSG） |

---

## 相关文档

- [TASK.md](TASK.md) — 波次任务清单
- [README.md](README.md) — 构建与部署
- [server/streamget-douyu.md](server/streamget-douyu.md) — 斗鱼解析细节
