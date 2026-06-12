# Live 发布目录

**线上**：https://trianglestrip.github.io/live/（GitHub Pages 静态前端）  
**API**：本机运行 `server\start.bat`（`live-api.exe` + `config.json`）

前端 `config.json` 中 `api.baseUrl` 指向 `http://127.0.0.1:8765`，仅在本机同时开启 API 时可用。

## CI

- **deploy.yml**：`paths-ignore: live/**`，改 live 不触发；博客全量发布时拷贝 `dist/web` 到 gh-pages `/live/`，避免 `force_orphan` 清空子目录

## 打包

```powershell
cd live
.\build-dist.ps1
```

## 本地启动

```powershell
cd live
.\start.ps1
```

或 `dist\start-all.bat` / `server\start.bat` + `web\start.bat`。

## 注意

HTTPS 页面访问本机 HTTP API 需浏览器允许（Chrome 私有网络访问）；API 已返回 `Access-Control-Allow-Private-Network`。仅本人本机使用，访客无法访问你的 127.0.0.1。
