# 热榜（news）

与博客 Hugo 站点独立的热榜模块，线上地址：https://trianglestrip.github.io/news/

## 目录

```
news/
  data/              # 各平台热榜 JSON 缓存
  fetch-hot.py       # 抓取脚本（GitHub Actions / 本地）
  build-hot-html.py  # 生成 index.html
  build-hot-icons.py # 重新生成 favicon 雪碧图
  hot-sources.json   # 平台源配置
  index.html         # 生成的静态页（提交到仓库）
  icons-sprite*.png  # 图标雪碧图
```

## 本地

```powershell
pip install hotboard beautifulsoup4 feedparser lxml pillow
python news/fetch-hot.py
python news/build-hot-html.py
```

浏览器打开 `news/index.html` 预览（或通过任意静态服务器）。

## CI

- **hot-fetch.yml**：定时 / push `news/**` / 手动触发；只部署 `news/publish/` 到 gh-pages 的 `/news/`
- **deploy.yml**：`paths-ignore: news/**`，改热榜不触发 Hugo 全站构建

博客导航仍指向 `/news/`，与 Hugo 构建解耦。
