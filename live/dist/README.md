# Live 发布目录

前后端解耦后的打包产物目录。运行 `live/package-dist.ps1` 生成/更新 `server/` 与 `web/` 内的文件。

## 目录

| 路径 | 说明 |
|------|------|
| `server/` | Python API 服务及 `start.bat` |
| `web/` | Vue 构建产物、`serve_spa.py` 与 `start.bat` |
| `start-all.bat` | 同时启动后端与前端 |

## 使用

1. 打包（在 `live/` 目录）：

   ```powershell
   .\package-dist.ps1
   ```

2. 启动：

   - 仅 API：`dist\server\start.bat` → http://127.0.0.1:8765
   - 仅前端：`dist\web\start.bat` → http://127.0.0.1:8080
   - 一键：`dist\start-all.bat`

3. 浏览器打开 http://127.0.0.1:8080 ，前端通过 `web/config.json` 中的 `api.baseUrl` 访问后端。

## 依赖

- Python 3.10+（优先使用 `live/server/.venv`）
- 后端依赖：`pip install -r server/requirements.txt`（开发环境 venv 已安装则可复用）
