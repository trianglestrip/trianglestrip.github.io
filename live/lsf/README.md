# live-stream-forwarder（lsf）

基于 [nv4d1k/live-stream-forwarder](https://github.com/nv4d1k/live-stream-forwarder)（**MIT 开源**）的本地部署与播放实验。

lsf 内置各平台 **extractor 解析**，将上游直播流透明代理为本地 HTTP 地址，例如：

```
http://127.0.0.1:8770/douyu/9999?format=flv
```

本目录在此基础上提供：

- `install.ps1` — 下载 Windows 版 `lsf.exe`（不入库）
- `start.ps1` — 启动 lsf + 播放页
- `serve.py` — 静态播放页 + 斗鱼 **streamget** 解析 API（**仅返回 douyucdn 直链，不转发流**）
- `douyu_resolve.py` — 斗鱼 getH5PlayV1 + hw-h5 多档解析（开源，无 muxia）
- `player.html` + `static/` — flv.js 直连 CDN 播放

## 安装

```powershell
cd live/lsf
.\install.ps1
```

播放页复用 `live/player/.venv`（含 streamget + requests + Node.js）。若未安装：

```powershell
cd live/player
py -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
streamget install-node
```

## 启动

```powershell
cd live/lsf
.\start.ps1
```

- **播放页**：http://127.0.0.1:8771/
- **斗鱼解析 API**：`GET http://127.0.0.1:8771/api/room?room=5720533`
- **lsf 流地址（VLC）**：http://127.0.0.1:8770/douyu/9999?format=flv

## 斗鱼两种开源路径

| 模式 | 解析 | 浏览器 flv.js | 说明 |
|------|------|----------------|------|
| **streamget**（默认） | getH5PlayV1 + hw-h5 | ✅ 通常可用 | 返回 douyucdn 直链，浏览器直连，无服务端代理 |
| **lsf** | lsf 内置 Go extractor | ❌ P2P 房间不稳定 | 建议 VLC 打开 `8770` 地址 |

实测 **5720533**：lsf 走 edgesrv P2P → flv.js `Unsupported tag`；streamget 走 douyucdn 可播。

斗鱼 `format=m3u8` 在 lsf 内无效（仍出 FLV）。

诊断：

```powershell
.\player\.venv\Scripts\python lsf\_test_room.py 5720533
```

## 支持平台（lsf 直连）

| 平台 | lsf token |
|------|-----------|
| 斗鱼 | `douyu` |
| 虎牙 | `huya` |
| 哔哩 | `bilibili` |
| 抖音 | `douyin` |
| Twitch | `twitch` |
| Kick | `kick` |

非斗鱼平台在播放页内提示用 VLC 打开 lsf 地址；本服务不再代理 lsf 流。

## 停止 lsf 进程

```powershell
Stop-Process -Name lsf -Force -ErrorAction SilentlyContinue
```
