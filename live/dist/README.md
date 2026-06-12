# Live 发布目录

运行 `live/package-dist.ps1` 后生成，只放**前后端各自的最小包**。

| 目录 | 内容 |
|------|------|
| `server/` | API 运行所需 `.py` + `config.json` + `start.bat` |
| `web/` | `npm run build` 产物 + `config.json` + `serve_spa.py` + `start.bat` |

## 依赖（dist 自包含，不依赖 `live/server` 源码）

| 依赖 | 说明 |
|------|------|
| Python 3.10+ | 系统已安装即可 |
| pip 包 | 仅在 `server/` 下执行一次：`pip install -r requirements.txt`（建议在 `server` 里建 `.venv`） |
| Node | **不需要**（前端已是静态文件） |

`web/` 只用 Python 标准库托管静态页，可与 API 共用 `server/.venv`，或用系统 `python`。

## 打包

```powershell
cd live
.\package-dist.ps1
```

## 启动

- `server\start.bat` → http://127.0.0.1:8765
- `web\start.bat` → http://127.0.0.1:8080
- `start-all.bat` → 两个窗口

首次部署示例：

```powershell
cd dist\server
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\start.bat
```
