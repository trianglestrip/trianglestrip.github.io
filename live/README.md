# live

博客直播实验目录（**前后端完全解耦**）：

| 子目录 | 说明 | 配置 |
|--------|------|------|
| [web/](web/) | Vue 3 前端 | `web/public/config.json` |
| [server/](server/) | 解析 API | `server/config.json` |
| [dist/](dist/) | 发布包；前端部署到站点 `/live/`，API 本机运行 | `dist/server/config.json` |

## 线上 + 本地 API

- 前端：https://trianglestrip.github.io/live/（**live-deploy.yml** 独立部署 `dist/web`，与 Hugo 解耦）
- API：本机 `dist\server\start.bat`

改 `live/dist/web/**` 会触发 `live-deploy.yml`；改博客不会。Hugo 全量发布（`deploy.yml`）时仍会拷贝一份 live/news，避免 `force_orphan` 清空子目录。

## 本地打包

```powershell
cd live
.\package-dist.ps1
# dist\server\start.bat  /  dist\web\start.bat
```

## 快速启动

```powershell
# 终端 1：API
cd live/server
.\start.ps1

# 终端 2：前端（开发）
cd live/web
npm install
npm run dev
```

- 前端：http://127.0.0.1:5173/
- API：http://127.0.0.1:8765/api/health

## 配置说明

**后端** `live/server/config.json`：端口、CORS、是否托管静态页（默认 `static.enabled: false`）。

**前端** `live/web/public/config.json`：

```json
{
  "appTitle": "Lemon live",
  "api": {
    "baseUrl": "",
    "devBaseUrl": "http://127.0.0.1:8765"
  }
}
```

| 字段 | 开发 | 生产构建 |
|------|------|----------|
| `api.devBaseUrl` | 直连 API 或留空走 Vite 代理 | — |
| `api.baseUrl` | — | 填 API 根地址，如 `https://api.example.com`；同域部署可留空 |

本地敏感覆盖：复制为 `config.local.json`（server / web/public 均可，已 gitignore）。

## 生产部署（分离）

1. 前端：`cd live/web && npm run build`，将 `dist/` 部署到 GitHub Pages / Nginx
2. 后端：在服务器运行 `live/server`，`config.json` 中开启 CORS
3. 前端 `config.json` 的 `api.baseUrl` 指向后端公网地址

功能规划：[web/FEATURES.md](web/FEATURES.md)
