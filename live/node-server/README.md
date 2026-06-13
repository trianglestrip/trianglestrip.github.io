# live-api (Node)

替代 `live/server` 的 Node 解析 API，接口契约与 Python 版一致。

## 开发启动

```powershell
cd live/node-server
.\start.bat
```

或：

```powershell
npm install
npm run build   # 首次或改源码后
npm start       # node ../dist/server/live-api.mjs
```

- 健康检查：http://127.0.0.1:8765/api/health
- 配置：`config.json`（可选 `config.local.json` 覆盖）

## 构建

```powershell
.\build.bat     # 或 npm run build
```

`tsc` + esbuild 混淆打包为 `../dist/server/live-api.mjs`，并确保 `../dist/node.exe`。

详见 [MIGRATION.md](./MIGRATION.md)。
