# 直播解析 API（live/server）

博客根目录下的直播后端，参考 [lemon-live](https://github.com/lemonfog/lemon-live) / [Lemon Live](https://lemonlive.deno.dev/)：

- **解析**：本机 `streamget`（斗鱼 getH5PlayV1、虎牙页面 + anti-code）
- **架构**：`room_schema` meta/tier 分层 + `resolve_service` 统一调度
- **前端**：[`../web/`](../web/) Vue 聚合页（`npm run build` 后由本服务托管 `dist/`）

## 目录

```
live/server/
  serve.py            # API + 托管 ../web/dist
  resolve_service.py  # meta/tier 缓存与多平台调度
  room_schema.py      # 统一 meta/tier/payload 结构
  resolve_douyu.py    # 斗鱼适配
  resolve_huya.py     # 虎牙适配
  resolve_cache.py    # 分层缓存
  resolve_timing.py   # /api/time 耗时基准
  text_sanitize.py    # muxia 响应 Unicode 清理
  compare_streams.py  # 对比逻辑（serve / CLI --compare 共用）
  muxia_api.py        # muxia 解析封装（对照用）
  benchmark_resolve.py # 本地解析压测（可选）
  streamget-douyu.md  # 斗鱼转换说明（文档）
```

## 安装

```powershell
cd live/server
py -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
streamget install-node
```

## 启动

```powershell
.\start.ps1
# 或 .\.venv\Scripts\python serve.py
```

浏览器打开 http://127.0.0.1:8765/（需先 `cd ../web && npm run build`）

## API

| 端点 | 说明 |
|------|------|
| `GET /api/room?site=douyu&room=5720533&source=local` | streamget 懒加载（默认只解析一档） |
| `GET /api/room?...&quality=超清` | 指定档位；45s 内同房间同档走服务端缓存 |
| `GET /api/room?...&mode=full` | 一次解析全部档位（对比用） |
| `GET /api/categories?site=douyu\|huya` | 分类列表 |
| `GET /api/rooms?site=...&recommend=1` | 推荐房间 |
| `GET /api/time?run=1` | 解析耗时基准 |
| `GET /api/compare?site=douyu&room=5720533` | 同时解析并对比 muxia |

## 命令行

```powershell
.\.venv\Scripts\python resolve_douyu.py 5720533
.\.venv\Scripts\python resolve_douyu.py 5720533 --compare
.\.venv\Scripts\python benchmark_resolve.py 252140
```
