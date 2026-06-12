# live

博客直播实验目录，各方案独立子目录：

| 子目录 | 说明 |
|--------|------|
| [player/](player/) | muxia / streamget 解析 + flv.js 播放页（`serve.py`） |
| [lsf/](lsf/) | lsf（MIT）+ 斗鱼 streamget 开源解析 + flv.js 播放 |

```powershell
# player（muxia / streamget）
cd live/player
.\.venv\Scripts\python serve.py

# lsf（全开源 Go 解析 + 代理）
cd live/lsf
.\install.ps1
.\start.ps1
```

本地虚拟环境在 `player/.venv/`（已 gitignore，勿提交）。
