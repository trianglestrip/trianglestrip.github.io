# 直播解析与播放

博客根目录下的直播实验模块，参考 [lemon-live](https://github.com/lemonfog/lemon-live) / [Lemon Live](https://lemonlive.deno.dev/)：

- **解析**：本机 `streamget`（斗鱼 getH5PlayV1、虎牙页面 + anti-code）
- **架构**：`room_schema` meta/tier 分层 + `resolve_service` 统一调度
- **前端**：[`../web/`](../web/) 聚合页；本目录 `player.html` 为 `/legacy` 调试页

## 目录

```
live/player/
  serve.py           # API + 托管 ../web 前端
  resolve_service.py # meta/tier 缓存与多平台调度
  room_schema.py     # 统一 meta/tier/payload 结构
  resolve_douyu.py   # 斗鱼适配
  resolve_huya.py    # 虎牙适配
  resolve_cache.py   # 分层缓存
  compare_streams.py # 对比逻辑（serve / CLI --compare 共用）
  muxia_api.py       # muxia 解析封装（对照用）
  player.html        # Legacy 调试页（/legacy）
  streamget-douyu.md # 斗鱼转换说明
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

浏览器打开 http://127.0.0.1:8765/（Web 前端）或 http://127.0.0.1:8765/legacy（调试页）

- **播放**：点「播放」→ 仅解析默认档（浏览器 localStorage 记住上次选的清晰度）
- **切档**：换清晰度时再请求该档；已解析过的档 45s 内走服务端缓存
- **对比**：点「对比 muxia」→ 全档解析并表格对比

## API

| 端点 | 说明 |
|------|------|
| `GET /api/room?site=douyu&room=5720533&source=local` | streamget 懒加载（默认只解析一档） |
| `GET /api/room?...&quality=超清` | 指定档位；45s 内同房间同档走服务端缓存 |
| `GET /api/room?...&mode=full` | 一次解析全部档位（对比用） |
| `GET /api/room?site=douyu&room=5720533&source=muxia` | muxia 解析（对照） |
| `GET /api/compare?site=douyu&room=5720533` | 同时解析并对比 |
| `POST /api/resolve` / `POST /api/compare` | 同上，JSON body |

## 命令行

```powershell
# 多档解析（打印各档 FLV 文件名）
.\.venv\Scripts\python resolve_douyu.py 5720533

# 与 muxia 对比
.\.venv\Scripts\python resolve_douyu.py 5720533 --compare

# 可选：导出 JSON
.\.venv\Scripts\python resolve_douyu.py 5720533 --out result.json
```

实测 **5720533**：4 档（原画1080P60、蓝光4M、超清、高清）档位名、线路7、FLV 文件名与 muxia 一致。
