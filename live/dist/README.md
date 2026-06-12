# Live 发布目录

运行 `live/package-dist.ps1` 后生成，只放**前后端各自的最小包**：

| 目录 | 内容 |
|------|------|
| `server/` | API 运行所需 `.py` + `config.json` + `start.bat` |
| `web/` | `npm run build` 产物 + `config.json` + `start.bat` |

## 打包

```powershell
cd live
.\package-dist.ps1
```

## 启动

- `server\start.bat` → http://127.0.0.1:8765
- `web\start.bat` → http://127.0.0.1:8080
- `start-all.bat` → 上面两个各开一个窗口

Python 优先用 `live/server/.venv`；首次需在该目录 `pip install -r requirements.txt`。
