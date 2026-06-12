# live/web

聚合直播前端（参考 [Lemon Live](https://lemonlive.deno.dev/) 布局）。

与解析后端 [`../player/`](../player/) 分离：本目录仅含静态页面，API 由 `serve.py` 托管。

## 开发

```powershell
cd live/player
.\.venv\Scripts\python serve.py
```

浏览器打开 http://127.0.0.1:8765/

- `/` — 新前端（本目录）
- `/legacy` — 旧调试页（player/player.html）
- `/api/room` — 解析 API

## 结构

```
web/
  index.html
  static/css/main.css
  static/js/config.js
  static/js/app.js
```
