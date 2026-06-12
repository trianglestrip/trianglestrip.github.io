# 直播解析与播放

博客根目录下的直播实验模块，参考 [lemon-live](https://github.com/lemonfog/lemon-live)：

- **解析**：本机 `streamget`（getH5PlayV1 + hw-h5，douyucdn 直链）
- **对照**：可与 `live.muxia.site` 对比档位名、线路名、FLV 文件名是否一致
- **播放**：flv.js 浏览器直连 CDN（**无本机流代理**）

## 目录

```
live/player/
  serve.py           # 本地 HTTP 服务（页面 + 纯解析 API）
  resolve_douyu.py   # streamget 斗鱼多档解析
  compare_streams.py # streamget vs muxia 对比
  muxia_api.py       # muxia 解析封装（仅对照用）
  player.html        # 播放页
  static/            # 样式与脚本
```

## 安装

```powershell
cd live/player
py -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
streamget install-node
```

## 启动

```powershell
.\.venv\Scripts\python serve.py
```

浏览器打开 http://127.0.0.1:8765/

- **播放**：选 streamget，点「播放」→ 直连 douyucdn
- **对比**：点「对比 muxia」→ 表格显示各档是否与 muxia 一致

## API

| 端点 | 说明 |
|------|------|
| `GET /api/room?site=douyu&room=5720533&source=local` | streamget 纯解析 |
| `GET /api/room?site=douyu&room=5720533&source=muxia` | muxia 解析（对照） |
| `GET /api/compare?site=douyu&room=5720533` | 同时解析并对比 |
| `POST /api/resolve` / `POST /api/compare` | 同上，JSON body |

## 命令行

```powershell
# 多档解析 → stream.json
.\.venv\Scripts\python resolve_douyu.py 5720533

# 与 muxia 对比
.\.venv\Scripts\python resolve_douyu.py 5720533 --compare
```

实测 **5720533**：4 档（原画1080P60、蓝光4M、超清、高清）档位名、线路7、FLV 文件名与 muxia 一致。
