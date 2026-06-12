# live

博客直播实验目录：

| 子目录 | 说明 |
|--------|------|
| [web/](web/) | Vue 3 聚合直播前端（Lemon Live 风格，多路由） |
| [player/](player/) | 解析 API 后端（meta/tier 分层 + streamget） |

## 快速启动

```powershell
# 1. 构建前端（首次或改 UI 后）
cd live/web
npm install
npm run build

# 2. 启动 API + 托管 dist
cd ../player
.\.venv\Scripts\python serve.py
```

浏览器打开 http://127.0.0.1:8765/

| URL | 说明 |
|-----|------|
| `/` | Vue 前端（优先 `web/dist/`） |
| `/watch/douyu/5720533` | 播放页（可分享） |
| `/legacy` | 旧版 `player.html` 调试页 |
| `/api/room?site=douyu&room=<id>` | 解析 API |

## 开发模式

前端热更新：`cd live/web && npm run dev` → http://127.0.0.1:5173/（需另开终端运行 `serve.py` 提供 API）。

功能规划：[web/FEATURES.md](web/FEATURES.md)

本地虚拟环境在 `player/.venv/`（已 gitignore，勿提交）。
