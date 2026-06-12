# live

博客直播实验目录，各方案独立子目录：

| 子目录 | 说明 |
|--------|------|
| [player/](player/) | streamget 解析 + muxia 对比 + flv.js 播放页（`serve.py`） |

```powershell
cd live/player
.\.venv\Scripts\python serve.py
```

浏览器打开 http://127.0.0.1:8765/

本地虚拟环境在 `player/.venv/`（已 gitignore，勿提交）。
