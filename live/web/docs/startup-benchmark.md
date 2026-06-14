# Lemon Live 启动与加载耗时基准

> 生成时间: 2026-06-14T16:55:50.573Z
> 测试地址: http://127.0.0.1:8090
> 环境: Node v22.22.0, Playwright, headless Chrome
> 构建: production dist（8090 生产静态）

## 测试方法

1. `npm run build` 构建 production
2. 启动 API：`live/node-server` → `npm run dev`（8765）
3. 启动静态：`node live/dist/web/server.mjs 8090`
4. 运行：`npm run benchmark:startup -- http://127.0.0.1:8090 --out docs/startup-benchmark.md`

Playwright headless Chrome，每次场景使用全新 context（无缓存 cookie）。指标自 `navigationStart` 起算。

## 摘要

| 场景 | 视口 | FCP | DOM | 内容就绪 | 播放/侧栏 | 首 1s 图片 | 问题 |
|------|------|-----|-----|----------|-----------|------------|------|
| all-home-ipad | 1180x820 | 248ms | 26ms | 149ms | 149ms | 30 | 首 1s 图片请求过多 (30 个) |
| douyu-home-ipad | 1180x820 | 108ms | 25ms | 191ms | 191ms | 30 | 首 1s 图片请求过多 (30 个) |
| douyu-home-mobile | 390x844 | 108ms | 31ms | 164ms | 164ms | 12 | 首 1s 图片请求过多 (12 个) |
| follow-ipad | 1180x820 | 40ms | 13ms | — | — | 0 | — |
| play-douyu-ipad | 1180x820 | 88ms | 23ms | 121ms | 播放 1781ms / 侧栏 1826ms | 0 | — |

## 分场景明细

### all-home-ipad

- 路径: `/all`
- 视口: 1180x820

| 指标 | 耗时 |
|------|------|
| HTML 响应 | 3ms |
| DOM Interactive | 9ms |
| DOM ContentLoaded | 23ms |
| 浏览器 FCP | 248ms |
| DOM ready (Playwright) | 26ms |
| 文字可见 | 140ms |
| 列表/内容就绪 | 149ms |
| config.json | 33ms |
| 列表 API 首次响应 | 100ms |
| load 事件 | 24ms |
| 首 1s / 3s 图片请求 | 30 / 30 |
| JS 传输量 | 274 KB |
| CSS 传输量 | 136 KB |

**发现的问题:**
- 首 1s 图片请求过多 (30 个)

**较慢资源 Top 10:**

| 资源 | 开始 | 耗时 | TTFB | 大小 |
|------|------|------|------|------|
| /huyalive/1820796294-1820796294-7820260535408001024-3641716044-10057-A-0-1/20260615005202.jpg?sign=9RGty4ulGIks7lwfsMgTlv4jbs5hPTEyNTM0OTg3MDEmYj1odXlhLXNjcmVlbnNob3RzLXJldmlldy0xMjUzNDk4NzAxJms9QUtJRFFpcTNSbEJtV0p6ZUxKTVZrMklWdVEybm1pY2RkRWdEJmU9MTc5NzAwNzkyMiZ0PTE3ODE0NTU5MjImcj0xMjM0NTY3OCZmPS9odXlhbGl2ZS8xODIwNzk2Mjk0LTE4MjA3OTYyOTQtNzgyMDI2MDUzNTQwODAwMTAyNC0zNjQxNzE2MDQ0LTEwMDU3LUEtMC0xLzIwMjYwNjE1MDA1MjAyLmpwZw== | 132ms | 1238ms | 1195ms | 90KB |
| /cdnimage/anchorpost/1013/0d/b579da5cb7196acdb2e83f264779f9_0_1691420266.jpg?spformat=png,webp | 132ms | 1235ms | -132ms | 0KB |
| /huyalive/1199538803826-1199538803826-5338336150664773632-2399077731108-10057-A-0-1/20260615005228.jpg?sign=HtBLTNajJeZq+rEmO9D1Ls6GqQ5hPTEyNTM0OTg3MDEmYj1odXlhLXNjcmVlbnNob3RzLXJldmlldy0xMjUzNDk4NzAxJms9QUtJRFFpcTNSbEJtV0p6ZUxKTVZrMklWdVEybm1pY2RkRWdEJmU9MTc5NzAwNzk0OCZ0PTE3ODE0NTU5NDgmcj0xMjM0NTY3OCZmPS9odXlhbGl2ZS8xMTk5NTM4ODAzODI2LTExOTk1Mzg4MDM4MjYtNTMzODMzNjE1MDY2NDc3MzYzMi0yMzk5MDc3NzMxMTA4LTEwMDU3LUEtMC0xLzIwMjYwNjE1MDA1MjI4LmpwZw== | 132ms | 1232ms | 1184ms | 103KB |
| /cdnimage/anchorpost/1099/79/8928b5040c05f167e2e1ac67e74338_3_0_1771992106.jpg?spformat=png,webp | 133ms | 1229ms | -132ms | 0KB |
| /asrpic/260615/226037_src_0048.avif/dy1 | 132ms | 1204ms | -132ms | 0KB |
| /asrpic/260615/666743_src_0048.avif/dy1 | 132ms | 1192ms | -132ms | 0KB |
| /asrpic/260615/312212_src_0048.avif/dy1 | 132ms | 1191ms | -132ms | 0KB |
| /img/aweme-avatar/tos-cn-avt-0015_cc64901c5ddf2fbdbfdf1d010b10116e~tplv-resize:640:0.webp?biz_tag=app_6383_webcast&from=webcast.room.pack&l=202606150053558D13B6A7085A14673432&s=web_feed&sc=webcast_cover | 273ms | 1189ms | 1184ms | 18KB |
| /asrpic/260615/138243_src_0048.avif/dy1 | 132ms | 1185ms | -132ms | 0KB |
| /webcast-cover/7354232468687604507~tplv-qz53dukwul-common-resize:640:0.webp?biz_tag=app_6383_webcast&from=webcast.room.pack&l=20260615005354A56D801BD16DE557E9D3&lk3s=39e7556e&s=web_feed&sc=webcast_cover&x-expires=1784048034&x-signature=brwMVPjHidmTMxzRNWlaF86pYw4%3D | 244ms | 1185ms | 1185ms | 8KB |

### douyu-home-ipad

- 路径: `/douyu`
- 视口: 1180x820

| 指标 | 耗时 |
|------|------|
| HTML 响应 | 2ms |
| DOM Interactive | 7ms |
| DOM ContentLoaded | 23ms |
| 浏览器 FCP | 108ms |
| DOM ready (Playwright) | 25ms |
| 文字可见 | 156ms |
| 列表/内容就绪 | 191ms |
| config.json | 31ms |
| 列表 API 首次响应 | 100ms |
| /api/room | 99ms |
| load 事件 | 24ms |
| 首 1s / 3s 图片请求 | 30 / 30 |
| JS 传输量 | 274 KB |
| CSS 传输量 | 137 KB |

**发现的问题:**
- 首 1s 图片请求过多 (30 个)

**较慢资源 Top 10:**

| 资源 | 开始 | 耗时 | TTFB | 大小 |
|------|------|------|------|------|
| /asrpic/260615/71415_src_0048.avif/dy1 | 123ms | 1146ms | -123ms | 0KB |
| /asrpic/260615/36252_src_0048.avif/dy1 | 123ms | 1145ms | -123ms | 0KB |
| /live-cover/coverupdate/2026/06/02/7908ecdeff37cb2187fe92faaed7f6ab.jpg/dy1 | 166ms | 1136ms | -166ms | 0KB |
| /asrpic/260615/24422_src_0048.avif/dy1 | 123ms | 1129ms | -123ms | 0KB |
| /live-cover/roomCover/2026/03/19/37b37d8b7c7ba1723a17f15a79370950_big.png/dy1 | 123ms | 1128ms | -123ms | 0KB |
| /live-cover/coverupdate/2026/06/12/07f6b4853ed5aeb33184293e7e3a5445.jpg/dy1 | 123ms | 1126ms | -123ms | 0KB |
| /asrpic/260615/793400_src_0048.avif/dy1 | 166ms | 1126ms | -166ms | 0KB |
| /live-cover/coverupdate/2026/05/18/db9507c997f85bceacef1d90101ea7ab.jpg/dy1 | 167ms | 1123ms | -166ms | 0KB |
| /live-cover/appCovers/2026/01/27/12484836_20260127200843_small.jpg/dy1 | 123ms | 1122ms | -123ms | 0KB |
| /live-cover/coverupdate/2026/06/02/a76e34aa1abd4e4f3d3677502d997d0d.jpg/dy1 | 123ms | 1121ms | -123ms | 0KB |

### douyu-home-mobile

- 路径: `/douyu`
- 视口: 390x844

| 指标 | 耗时 |
|------|------|
| HTML 响应 | 2ms |
| DOM Interactive | 8ms |
| DOM ContentLoaded | 24ms |
| 浏览器 FCP | 108ms |
| DOM ready (Playwright) | 31ms |
| 文字可见 | 140ms |
| 列表/内容就绪 | 164ms |
| config.json | 35ms |
| /api/room | 91ms |
| load 事件 | 24ms |
| 首 1s / 3s 图片请求 | 12 / 12 |
| JS 传输量 | 274 KB |
| CSS 传输量 | 137 KB |

**发现的问题:**
- 首 1s 图片请求过多 (12 个)

**较慢资源 Top 10:**

| 资源 | 开始 | 耗时 | TTFB | 大小 |
|------|------|------|------|------|
| /asrpic/260615/71415_src_0048.avif/dy1 | 119ms | 1186ms | -119ms | 0KB |
| /asrpic/260615/36252_src_0048.avif/dy1 | 119ms | 1185ms | -119ms | 0KB |
| /live-cover/appCovers/2026/01/27/12484836_20260127200843_small.jpg/dy1 | 119ms | 1181ms | -119ms | 0KB |
| /asrpic/260615/252140_src_0048.avif/dy1 | 119ms | 1180ms | -119ms | 0KB |
| /asrpic/260615/24422_src_0048.avif/dy1 | 119ms | 1178ms | -119ms | 0KB |
| /live-cover/roomCover/2026/03/19/37b37d8b7c7ba1723a17f15a79370950_big.png/dy1 | 119ms | 1175ms | -119ms | 0KB |
| /live-cover/coverupdate/2026/06/02/a76e34aa1abd4e4f3d3677502d997d0d.jpg/dy1 | 119ms | 1172ms | -119ms | 0KB |
| /live-cover/coverupdate/2026/06/12/07f6b4853ed5aeb33184293e7e3a5445.jpg/dy1 | 119ms | 1169ms | -119ms | 0KB |
| /live-cover/coverupdate/2026/05/18/9280fc83315e0c56db767b990f3d6751.jpg/dy1 | 147ms | 1166ms | -147ms | 0KB |
| /asrpic/260615/3168536_src_0049.avif/dy1 | 147ms | 1160ms | -147ms | 0KB |

### follow-ipad

- 路径: `/follow`
- 视口: 1180x820

| 指标 | 耗时 |
|------|------|
| HTML 响应 | 2ms |
| DOM Interactive | 9ms |
| DOM ContentLoaded | 9ms |
| 浏览器 FCP | 40ms |
| DOM ready (Playwright) | 13ms |
| 文字可见 | — |
| 列表/内容就绪 | — |
| load 事件 | 9ms |
| 首 1s / 3s 图片请求 | 0 / 0 |
| JS 传输量 | 0 KB |
| CSS 传输量 | 0 KB |

**较慢资源 Top 10:**

| 资源 | 开始 | 耗时 | TTFB | 大小 |
|------|------|------|------|------|
| /favicon.ico | 14ms | 2ms | 2ms | 0KB |

### play-douyu-ipad

- 路径: `/douyu/play/252140`
- 视口: 1180x820

| 指标 | 耗时 |
|------|------|
| HTML 响应 | 2ms |
| DOM Interactive | 7ms |
| DOM ContentLoaded | 20ms |
| 浏览器 FCP | 88ms |
| DOM ready (Playwright) | 23ms |
| 文字可见 | 121ms |
| 列表/内容就绪 | — |
| config.json | 27ms |
| 列表 API 首次响应 | 85ms |
| /api/room | 375ms |
| flv.min.js | 382ms |
| 视频 playing | 1781ms |
| 侧栏出现 | 1826ms |
| fetchFollowStatus | 2292ms |
| load 事件 | 21ms |
| 首 1s / 3s 图片请求 | 0 / 1 |
| JS 传输量 | 441 KB |
| CSS 传输量 | 158 KB |

**较慢资源 Top 10:**

| 资源 | 开始 | 耗时 | TTFB | 大小 |
|------|------|------|------|------|
| /live/252140rz7aIq14cx.flv?wsAuth=f02ef510519b31b19ced9056fb3f3cc1&token=web-h5-0-252140-4a0485261c3115823c7a75c74b9787663cb0b04b1e875653&logo=0&expire=0&did=10000000000000000000000000001501&ver=219032101&pt=2&st=0&sid=432564562&mcid2=0&origin=dy&fcdn=hw&fo=0&mix=0&isp= | 389ms | 1349ms | -389ms | 0KB |
| /api/follows/status | 1787ms | 502ms | 500ms | 1KB |
| /api/room?site=douyu&room=252140&source=local&mode=lazy | 49ms | 325ms | 325ms | 3KB |
| /api/follows/status | 3782ms | 89ms | 89ms | 1KB |
| /upload/avatar_v3/202004/df57d3efec57443994b960caec579364_big.jpg | 1798ms | 85ms | -1798ms | 0KB |
| /assets/fa-regular-400-nyy7hhHF.woff2 | 52ms | 30ms | 30ms | 19KB |
| /assets/fa-solid-900-DRAAbZTg.woff2 | 52ms | 29ms | 29ms | 112KB |
| /assets/play-BngHDZS2.js | 4ms | 5ms | 5ms | 134KB |
| /assets/index-CuODegpo.css | 4ms | 5ms | 4ms | 81KB |
| /api/hot-categories | 45ms | 5ms | 4ms | 1KB |

## 播放页阶段分解（目标对照）

```
Phase1 阻塞: HTML → JS → config → /api/room → flv.js → playing
Phase2 首帧后: 弹幕 overlay + idle → 侧栏 + connectDm
Phase3 延后: fetchFollowStatus（应在 playing 之后）
```

| 阶段 | 实际耗时 | 说明 |
|------|----------|------|
| 导航 → DOM | 23ms | 含主包 + 路由 chunk |
| 导航 → /api/room | 375ms | 房间解析 |
| 导航 → flv.js | 382ms | 按需加载 |
| 导航 → playing | 1781ms | 首帧播放 |
| 导航 → 侧栏 | 1826ms | idle 后挂载 |
| 导航 → follow status | 2292ms | 应 > playing |

> ✓ follow status 在 playing 后 511ms

## 当前主要问题（自动诊断）

- **斗鱼首页封面并发**（3s 内 30 张）：首行 eager 之外仍有大量封面在 ~500ms 后开始加载，单张 CDN 耗时可达 1s+。
- **FLV 拉流缓冲**（flv.js → playing 约 1399ms）：网络/流首包是播放主瓶颈。
- 侧栏在 playing 后 45ms 出现，符合 idle 延后策略。
- fetchFollowStatus 在 playing 后 511ms（+2s 定时），符合优化目标。
- **重复 follow status 请求**（2 次）：header 与侧栏可能仍各拉一次，可合并。

## 后续优化建议（基于本次测量）

1. 对比 `jsTransferKb` 与路由分包效果，关注 play chunk 是否被首页预拉过早触发。
2. 若 `images1s` 仍高于列数，继续收紧 LazyImage rootMargin 或 eager 范围。
3. 播放页关注 `/api/room` 与 flv 拉流占比；若 API > 500ms 优先后端缓存。
4. 侧栏出现晚于 playing 超过 2.5s 时，可调低 requestIdleCallback timeout。
5. 定期运行 production 基准: `npm run benchmark:startup -- http://127.0.0.1:8090 --out docs/startup-benchmark.md`
