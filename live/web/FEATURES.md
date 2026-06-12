# Live Web 功能规划

参考 [Lemon Live](https://lemonlive.deno.dev/) 的信息架构与布局，对接本仓库 `live/server` 解析 API，实现 Vue 多页面前端。

## 1. 页面信息架构（IA）

```
┌─────────────────────────────────────────────────────────────┐
│  TopBar：品牌 · 平台 Tab/Pill · 导航（首页 / 平台 / 播放）   │
├──────────────────────────────┬──────────────────────────────┤
│  左侧主舞台                   │  右侧控制面板                 │
│  · 16:9 播放器 / 占位         │  · 房间号 / 链接输入          │
│  · 封面 + 标题 + 主播 + 状态  │  · 清晰度 / 线路下拉          │
│                              │  · 播放 / 停止                │
│                              │  · 状态与提示                 │
└──────────────────────────────┴──────────────────────────────┘
```

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 | 各平台入口卡片、简介、默认房间快捷链接 |
| `/platform/:site` | 平台详情 | 单平台说明、支持档位/线路、跳转播放 |
| `/watch/:site/:room` | 播放页 | Lemon 主布局：播放器 + 房间信息 + 控制面板 |
| `/legacy`（后端） | 旧调试页 | `server/legacy.html` |

平台 Tab：斗鱼、虎牙（可用）；哔哩、抖音（占位 disabled）。

## 2. 各平台展示内容清单

| 字段 | 来源 | 展示位置 |
|------|------|----------|
| `title` | API | 房间标题 |
| `anchor_name` | API | 主播名 |
| `cover` | API | 封面缩略图 |
| `is_live` / `status` | API | 「直播中 / 未开播」徽章 |
| `available_qualities` | API | 清晰度下拉（含「待加载」态） |
| `streams[].name` | API | 档位名称 |
| `streams[].lines[]` | API | 线路下拉（`name` + `url`） |
| `play_url` / `flv_url` | API | 默认播放地址（fallback） |
| `platform` / `site` | API | 平台标识 |
| `room_id` | API | 房间号 |
| `cached` | API | 状态栏可选展示 |
| `fetched_at` | API | 调试信息（可选） |

平台详情页额外展示：平台中文名、是否接入、默认示例房间、说明文案。

## 3. 与 live/server API 接口约定

**Base URL**：与前端同源（`serve.py` 托管 `dist/` 时为空字符串；Vite dev 通过 proxy 转发）。

### GET `/api/room`

| 参数 | 必填 | 说明 |
|------|------|------|
| `site` | 否 | `douyu` \| `huya`，默认 `douyu` |
| `room` | 否 | 房间号或 URL 片段，默认示例房 |
| `source` | 否 | `local`（streamget）\| `muxia`，默认 `local` |
| `mode` | 否 | `lazy`（默认，单档）\| `full`（全档） |
| `quality` | 否 | 指定档位名，懒加载该档 |

**成功响应**（`ok: true`）：见 `room_schema.build_room_payload` 结构。

**失败**：HTTP 404/500，body `{ "ok": false, "error": "..." }`。

### 前端调用策略

1. 首次播放：`mode=lazy`，可选 `quality`（localStorage 记忆）。
2. 切换清晰度：若该档 `streams` 无有效 URL，再请求 `quality=<档名>`。
3. 合并多档响应：`streams` 按 `name` 合并（与 legacy `app.js` 一致）。
4. 播放：优先 `streams[档].lines[线路].url`，过滤含 `edgesrv.com` 的占位地址。

### 其他端点（后续）

| 端点 | 用途 |
|------|------|
| `GET /api/compare` | 本地 vs muxia 对比（调试） |
| `POST /api/resolve` | JSON  body 解析 |

## 4. 任务解耦

```
┌─────────────────┐     HTTP      ┌──────────────────┐
│  live/web       │ ────────────► │  live/server     │
│  Vue 前端       │  /api/room    │  serve.py + 解析  │
└─────────────────┘               └──────────────────┘
        │                                   │
        │ npm run build                     │ streamget / 缓存
        ▼                                   ▼
   live/web/dist/                    resolve_*.py
```

| 模块 | 职责 | 依赖 |
|------|------|------|
| **前端** `live/web` | 路由、UI、flv.js 播放、localStorage 偏好 | API 契约稳定即可 |
| **后端** `live/server` | 解析、缓存、CORS、静态托管 dist | 无前端框架依赖 |
| **部署** | `npm run build` → `dist/`；`serve.py` 优先 `web/dist` | 先 build 再启动 serve |

前端不嵌入 Python；后端不生成 Vue 产物。联调：dev 时 Vite `:5173` + proxy `/api` → `:8765`。

## 5. Vue Router 设计

```js
routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/platform/:site', name: 'platform', component: PlatformView },
  { path: '/watch/:site/:room?', name: 'watch', component: WatchView },
]
```

- `createWebHistory()`；`serve.py` 对非文件路径 fallback 到 `index.html`。
- 平台 Tab 使用 `router-link`，active 匹配当前 `site`。
- 播放页 URL 可分享：`/watch/douyu/5720533`。

## 6. 实施里程碑

| 阶段 | 内容 | 状态 |
|------|------|------|
| M0 | FEATURES.md 规划 | ✅ |
| M1 | Vue 3 + Vite 脚手架、`dist` 构建 | ✅ |
| M2 | 首页 / 平台页 / 播放页 + Lemon 布局 | ✅ |
| M3 | `/api/room` 对接 + flv 播放 | ✅ |
| M4 | `serve.py` 优先 dist + SPA fallback | ✅ |
| M5 | README、build 联调 | ✅ |
| M6 | 哔哩 / 抖音解析接入 | 待办 |
| M7 | M3U8 / HLS 非 FLV 平台 | 待办 |
| M8 | `/api/compare` 可视化对比页 | 待办 |
| M9 | GitHub Pages 静态部署（仅 dist + 远程 API） | 待办 |

## 7. 目录结构（目标）

```
live/web/
  FEATURES.md
  package.json
  vite.config.js
  index.html
  src/
    main.js
    App.vue
    router.js
    config/platforms.js
    api/room.js
    composables/useRoom.js
    composables/usePlayer.js
    styles/main.css
    components/
    views/
  legacy-static/          # 旧纯 HTML 雏形（归档）
  dist/                   # 构建产物（gitignore）
```
