# Live 发布目录

前后端解耦后的打包产物。运行 `live/package-dist.ps1` 生成/更新 `server/` 与 `web/` 内的文件。

**启动方式统一为 Node**：`npm run start:api` / `start:web`（API 仍由 Node 拉起 Python `serve.py`）。

## 目录

| 路径 | 说明 |
|------|------|
| `server/` | Python API 及 `start.bat` |
| `web/` | Vue 构建产物及 `start.bat` |
| `scripts/` | Node 启动脚本 |
| `start-all.bat` | 双窗口同时启动 |

## 使用

1. 打包（在 `live/` 目录）：

   ```powershell
   .\package-dist.ps1
   ```

2. 安装依赖（首次，在 `live/dist/`）：

   ```powershell
   npm install
   ```

3. 启动：

   | 方式 | 命令 | 地址 |
   |------|------|------|
   | 仅 API | `npm run start:api` 或 `server\start.bat` | http://127.0.0.1:8765 |
   | 仅前端 | `npm run start:web` 或 `web\start.bat` | http://127.0.0.1:8080 |
   | 同终端 | `npm start` | 先后端 + 前端 |
   | 双窗口 | `start-all.bat` | 同上 |

4. 浏览器打开 http://127.0.0.1:8080 ，前端通过 `web/config.json` 的 `api.baseUrl` 访问后端。

## 依赖

- Node.js 18+
- Python 3.10+（优先使用 `live/server/.venv`）
- 后端 Python 包：`pip install -r server/requirements.txt`
