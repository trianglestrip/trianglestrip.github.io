/** 聊天侧栏系统消息精简（去掉 URL、线路详情等） */

export function briefPlayStatus(text) {
  if (!text) return "";
  const lines = String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (/https?:\/\//i.test(line)) continue;
    if (/ · .+ · .+/.test(line) && !/播放|缓冲|解析|失败|出错/.test(line)) continue;

    if (/^播放中/.test(line)) return line;
    if (/正在缓冲|^缓冲中/.test(line)) return "缓冲中…";
    if (/正在解析|^解析/.test(line)) return "解析中…";
    if (/解析完成/.test(line)) return "解析完成";
    if (/播放出错/.test(line)) return "播放出错";
    if (/^失败:/.test(line) || /^播放失败:/.test(line) || /^切换/.test(line) || /^刷新失败:/.test(line)) {
      return line.length > 48 ? `${line.slice(0, 48)}…` : line;
    }
    if (/失效|重新解析/.test(line)) return line;
    if (line.length <= 24) return line;
  }

  return "";
}

export function briefDanmakuStatus(text) {
  if (!text || text === "弹幕已断开") return "";
  const map = [
    [/连接成功/, "弹幕已连接"],
    [/开始连接|连接中/, "弹幕连接中…"],
    [/已断开|重连/, "弹幕重连中…"],
    [/获取.*房间/, "弹幕准备中…"],
    [/参数获取失败/, "弹幕连接失败"],
    [/连接出错|出错/, "弹幕异常"],
    [/缺少房间/, "弹幕不可用"],
    [/暂不支持/, "弹幕不可用"],
  ];
  for (const [pattern, label] of map) {
    if (pattern.test(text)) return label;
  }
  return text.length > 16 ? `${text.slice(0, 16)}…` : text;
}
