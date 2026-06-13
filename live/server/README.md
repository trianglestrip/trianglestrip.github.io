# 直播解析 API（live/server）

> **已弃用**：默认 API 已切换到 [`live/node-server`](../node-server/README.md)。`start.ps1` 会转发到 Node 版。本目录仅作过渡保留与对比基准。

纯 API 服务，与 `live/web` 前端**完全解耦**。配置见 `config.json`（本地覆盖用 `config.local.json`，已 gitignore）。

## 配置 `config.json`

```json
{
  "host": "127.0.0.1",
  "port": 8765,
  "cors": { "enabled": true, "allowOrigin": "*" },
  "static": { "enabled": false, "distPath": "../web/dist" }
}
```

| 字段 | 说明 |
|------|------|
| `host` / `port` | 监听地址 |
| `cors` | 跨域，供独立部署的前端调用 |
| `static.enabled` | `false`（默认）仅 API；`true` 时顺带托管 `distPath` 下的 Vue 构建产物 |

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
```

浏览器或前端配置中的 API 地址：`http://127.0.0.1:8765`

## API

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 健康检查（含 mode: api-only / static+api） |
| `GET /api/room?site=douyu\|huya&room=<id>` | streamget 本地解析直播流 |
| `GET /api/categories?site=douyu\|huya` | 直连平台分类（非 muxia） |
| `GET /api/rooms?site=...&recommend=1` | 推荐房间列表 |
| `GET /api/time?run=1` | 解析耗时基准 |

## 命令行

```powershell
.\.venv\Scripts\python resolve_douyu.py 5720533
.\.venv\Scripts\python benchmark_resolve.py 252140
```
