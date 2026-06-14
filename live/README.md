# live

博客直播实验目录（**前后端完全解耦**）。

- 平台适配与 API 说明：[PLATFORMS.md](PLATFORMS.md)
- 解耦 / B 站接入任务清单：[TASK.md](TASK.md)

## 目录

| 子目录 | 说明 | 配置 |
|--------|------|------|
| [web/](web/) | Vue 3 前端 | `web/public/config.json` |
| [node-server/](node-server/) | 解析 API（Node，推荐） | `node-server/config.json` |
| [server/](server/) | 解析 API（Python，过渡保留） | `server/config.json` |
| [dist/](dist/) | 发布包；前端部署到站点 `/live/`，API 本机运行 | `dist/server/config.json` |

## 线上 + 本地 API

- 前端：https://trianglestrip.github.io/live/（随博客 **deploy.yml** 全量发布时拷贝 `dist/web`）
- API：本机 `dist\start.bat` / `dist\stop.bat`

`deploy.yml` 已 `paths-ignore: live/**`，改 live 不会单独触发 CI；博客全量发布时仍会拷贝 `dist/web`，避免 `force_orphan` 清空子目录。

## 本地打包与启动

```powershell
cd live/web
.\build.bat             # 或 npm run build

cd ../node-server
.\build.bat             # 或 npm run build

cd ../dist
.\start.bat             # 一键启动 API + Web
.\start-api.bat         # 仅 API
.\start-web.bat         # 仅前端
.\stop.bat              # 停止 API + 前端
```

- API：http://127.0.0.1:8765
- 前端：http://127.0.0.1:8080/

启动脚本均在 `dist/` 根目录，共用 `node.exe`。

## 开发模式（源码）

```powershell
# 终端 1：API 源码（改 node-server/src 后重启此终端）
cd live/node-server
.\start-dev.bat

# 终端 2：前端源码（Vite 热更新）
cd live/web
npm install
.\start-dev.bat
```

- 前端：http://127.0.0.1:8080/（`web/src` 直读，保存即热更新）
- API：http://127.0.0.1:8765/api/health（`node-server/src`，**不会**随前端一起更新）

若用 `node-server\start.bat` 或 `dist\start-api.bat`，跑的是 **已编译** 的 `dist/server/live-api.mjs`，改完 `src` 须先 `npm run build` 再重启 API。

## 配置说明

**后端** `live/node-server/config.json`（或过渡用 `live/server/config.json`）：端口、CORS、是否托管静态页（默认 `static.enabled: false`）。

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

## GitHub Pages 子路径构建

博客全量发布拷贝到 `/live/` 时需单独构建：

```powershell
cd live/web
npm run build:pages
```

`npm run build` 已直接输出到 `live/dist/web/`（无需再拷贝）；GitHub Pages 构建后提交 `dist/web` 或由博客 deploy 拷贝到 `public/live/`。

## 生产部署（分离）

1. 本地包：`npm run build`（根路径 `/`）；线上子路径：`npm run build:pages`
2. 后端：在服务器运行 `live/node-server`（或 `dist/server` 包），`config.json` 中开启 CORS
3. 前端 `config.json` 的 `api.baseUrl` 指向后端公网地址
