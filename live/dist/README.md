# Live 发布目录

**线上**：https://trianglestrip.github.io/live/（GitHub Pages 静态前端）  
**API**：本机运行 `server\start.bat`（`live-api.exe` + `config.json`）

前端 `config.json` 中 `api.baseUrl` 指向 `http://127.0.0.1:8765`，仅在本机同时开启 API 时可用。

## 打包

```powershell
cd live
.\package-dist.ps1
```

## 本地

- `server\start.bat` → API :8765
- `web\start.bat` → http://127.0.0.1:8080/live/
- `start-all.bat`

## 注意

HTTPS 页面访问本机 HTTP API 需浏览器允许（Chrome 私有网络访问）；API 已返回 `Access-Control-Allow-Private-Network`。仅本人本机使用，访客无法访问你的 127.0.0.1。
