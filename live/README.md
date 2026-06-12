# live

博客直播实验目录：

| 子目录 | 说明 |
|--------|------|
| [web/](web/) | 聚合直播前端（Lemon Live 风格布局） |
| [player/](player/) | 解析 API 后端（meta/tier 分层 + streamget） |

```powershell
cd live/player
.\.venv\Scripts\python serve.py
```

浏览器打开 http://127.0.0.1:8765/

- 首页 `/` → `live/web`
- 调试页 `/legacy` → 旧版 `player.html`
- API `/api/room?site=douyu|huya&room=<id>`

本地虚拟环境在 `player/.venv/`（已 gitignore，勿提交）。
