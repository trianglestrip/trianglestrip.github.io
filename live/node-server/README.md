# live-api (Node)

替代 `live/server` 的 Node 解析 API，接口契约与 Python 版一致。

## 开发启动

```powershell
cd live/node-server
.\start.ps1
```

或：

```powershell
npm install
npm run build   # 首次或改源码后
npm start       # node live-api.mjs
```

- 健康检查：http://127.0.0.1:8765/api/health
- 配置：`config.json`（可选 `config.local.json` 覆盖）

## 构建

```powershell
npm run build   # tsc + esbuild -> live-api.mjs
```

发布包由 `live/build-dist.bat` 复制 `node.exe` + `live-api.mjs` + `config.json` 到 `dist/server/`。

详见 [MIGRATION.md](./MIGRATION.md)。
