# live/web

Vue 3 聚合直播前端，通过 `public/config.json` 配置 API 地址，与 `live/server` **完全解耦**。

## 配置 `public/config.json`

```json
{
  "appTitle": "Lemon live",
  "api": {
    "baseUrl": "",
    "devBaseUrl": "http://127.0.0.1:8765"
  }
}
```

| 字段 | 说明 |
|------|------|
| `appTitle` | 页面标题 |
| `api.devBaseUrl` | 开发环境 API 根地址；留空则使用 Vite 代理 `/api` → server |
| `api.baseUrl` | 生产构建后的 API 根地址；与 API 同域可留空 |

本地覆盖：复制为 `public/config.local.json`（gitignore），或在部署时直接改 `dist/config.json`。

`vite.config.js` 会读取 `../server/config.json` 的 `port` 作为开发代理目标。

## 结构

```
web/
  public/config.json    # 前端运行时配置（构建时复制到 dist/）
  src/config/app.js     # 加载 config.json，导出 apiBase()
  src/                  # Vue 源码
  dist/                 # npm run build（单独部署）
```

## 开发

```powershell
# 终端 1
cd live/node-server
.\start.bat

# 终端 2
cd live/web
npm install
npm run dev
```

打开 http://127.0.0.1:5173/

## 生产构建

```powershell
cd live/web
npm run build
```

将 `dist/` 部署到任意静态托管；确保 `dist/config.json` 中 `api.baseUrl` 指向你的 API。

## API

前端通过 `apiBase()` 请求 `${apiBase}/api/room` 等，详见 [`../node-server/README.md`](../node-server/README.md)。
