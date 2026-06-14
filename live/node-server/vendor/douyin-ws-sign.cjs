/** 在 Node 中加载 douyin-sign.js 并导出 get_sign（WS signature）。 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const signPath = path.join(__dirname, "douyin-sign.js");
const code = fs.readFileSync(signPath, "utf8");
const sandbox = {
  document: {},
  window: {},
  navigator: {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  },
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Buffer,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

module.exports = {
  get_sign: sandbox.get_sign,
};
