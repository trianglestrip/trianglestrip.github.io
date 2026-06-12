# Live 发布目录

运行 `live/package-dist.ps1` 生成，**无需 Python**，仅需 Windows。

| 目录 | 内容 |
|------|------|
| `server/` | `live-api.exe` + `config.json`（同 `live/server/config.json`）+ `start.bat` |
| `web/` | Vite 构建产物 + `node.exe` + `server.mjs` + `config.json` + `start.bat` |

## 打包（开发机，需 Python venv 用于构建 exe）

```powershell
cd live
.\package-dist.ps1
```

## 启动（拷贝整个 `dist/` 即可）

- `server\start.bat` → http://127.0.0.1:8765
- `web\start.bat` → http://127.0.0.1:8080
- `start-all.bat` → 两个窗口

配置：改 `server/config.json` 端口/CORS；改 `web/config.json` 的 `api.baseUrl` 指向 API 地址。
