# 直播解析与播放

博客根目录下的直播实验模块，参考 [lemon-live](https://github.com/lemonfog/lemon-live)：

- **解析**：默认走 `live.muxia.site`（与 lemon-live 相同），可切换本地 `streamget`
- **播放**：`xgplayer-flv` 直播模式（`isLive` + `seamlesslyReload`），可选本地 FLV 代理

## 目录

```
live/
  serve.py          # 本地 HTTP 服务（页面 + API + 代理）
  resolve_douyu.py  # streamget 斗鱼解析
  muxia_api.py      # muxia 解析封装
  player.html       # 播放页
  static/           # 样式与脚本
```

## 安装

```powershell
cd live
py -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
```

斗鱼 streamget 解析还需要 Node.js（可用 `streamget install-node`）。

## 启动

```powershell
.\.venv\Scripts\python serve.py
```

浏览器打开 http://127.0.0.1:8765/

## API

| 端点 | 说明 |
|------|------|
| `GET /api/room?site=douyu&room=9999&source=muxia` | muxia 解析并注册代理 |
| `GET /api/room?site=douyu&room=9999&source=local` | streamget 解析 |
| `POST /api/resolve` | 同上，JSON body |
| `GET /api/proxy?sid=...&mode=segment` | FLV 代理（绕过 CORS） |

## 仅命令行解析

```powershell
.\.venv\Scripts\python resolve_douyu.py 9999
```

结果写入 `stream.json`。
