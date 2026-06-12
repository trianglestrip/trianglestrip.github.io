# live/web

Vue 3 多页面聚合直播前端（参考 [Lemon Live](https://lemonlive.deno.dev/) 布局）。功能规划见 [FEATURES.md](./FEATURES.md)。

## 结构

```
web/
  FEATURES.md           # 功能规划
  package.json
  vite.config.js
  index.html
  src/
    main.js
    App.vue
    router.js
    config/platforms.js
    api/room.js
    composables/useLive.js
    components/         # AppLayout, PlayerPanel, ControlPanel…
    views/              # Home, Platform, Watch
    styles/main.css
  legacy-static/        # 旧纯 HTML 雏形归档
  dist/                 # npm run build 产物（serve.py 优先托管）
```

## 路由

| 路径 | 页面 |
|------|------|
| `/` | 首页 · 平台入口卡片 |
| `/platform/:site` | 平台详情（douyu / huya / bilibili / douyin） |
| `/watch/:site/:room?` | 播放页（Lemon 主布局） |

## 开发

**方式 A — Vite 热更新（推荐改 UI 时）**

```powershell
# 终端 1：API
cd live/player
.\.venv\Scripts\python serve.py

# 终端 2：前端
cd live/web
npm install
npm run dev
```

浏览器打开 http://127.0.0.1:5173/（`/api` 已 proxy 到 `:8765`）

**方式 B — 构建后由 serve.py 统一托管**

```powershell
cd live/web
npm install
npm run build

cd ../player
.\.venv\Scripts\python serve.py
```

浏览器打开 http://127.0.0.1:8765/

- `/` — Vue 前端（**必须**先 `npm run build`，仅托管 `dist/`；无 dist 时显示构建说明页）
- `/legacy` — 旧调试页（`player/player.html`）
- `/api/room` — 解析 API

> **勿**在未 build 的情况下指望 `:8765` 加载源码 `index.html`：浏览器无法解析 `import "vue"`。改 UI 请用 `npm run dev`（`:5173`）。

> **控制台** 若出现 `Permissions policy violation: unload`，来自 flv.js 内部；已在 serve/Vite 设置 `Permissions-Policy: unload=(self)`，一般可忽略，不影响播放。

## API 对接

`GET /api/room?site=douyu|huya&room=<id>&mode=lazy|full&quality=<档名>`

详见 [FEATURES.md](./FEATURES.md) 与 [`../player/README.md`](../player/README.md)。
