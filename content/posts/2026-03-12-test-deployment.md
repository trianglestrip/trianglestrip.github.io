---
title: "使用油猴脚本打造无服务器博客发布系统"
date: 2026-03-12T16:45:00+08:00
slug: "tampermonkey-blog-editor"
categories: ["documentation"]
tags: ["configuration", "content"]
draft: false
---

## 前言

作为一个技术博客作者，我一直在寻找一种简单、高效的方式来发布文章。传统的方式需要：

1. 本地编写 Markdown
2. 手动提交到 Git
3. 推送到 GitHub
4. 等待构建部署

这个流程虽然不复杂，但每次都要打开终端、输入命令，还是有点繁琐。于是我开发了一个**油猴脚本 + GitHub Actions** 的解决方案，实现了真正的一键发布。

## 技术架构

### 整体方案

```
浏览器插件（油猴脚本）
    ↓
GitHub API（直接提交文件）
    ↓
GitHub Actions（自动触发）
    ↓
Hugo 构建 + GitHub Pages 部署
```

### 核心优势

- ✅ **无需服务器** - 纯前端实现，零成本
- ✅ **随时随地** - 任意网页都能打开编辑器
- ✅ **自动化** - 提交后自动构建部署
- ✅ **实时预览** - 边写边看效果
- ✅ **安全可靠** - Token 本地存储，直连 GitHub API

## 实现细节

### 1. 油猴脚本设计

使用 Tampermonkey 创建一个全局脚本，核心功能包括：

**悬浮按钮**
```javascript
function createFloatingButton() {
    const button = document.createElement('div');
    button.innerHTML = '📝';
    Object.assign(button.style, {
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        width: '60px',
        height: '60px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '50%',
        zIndex: '999999'
    });
    button.addEventListener('click', openEditor);
    document.body.appendChild(button);
}
```

**编辑器窗口**

使用 `Blob` + `URL.createObjectURL()` 创建独立的编辑器页面，避免 Trusted Types 限制：

```javascript
function openEditor() {
    const editorHTML = createEditorHTML();
    const blob = new Blob([editorHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, 'BlogEditor', 'width=1400,height=900');
}
```

### 2. GitHub API 集成

使用 GitHub Contents API 直接提交文件：

```javascript
async function publishToGitHub(filename, content) {
    const path = `posts/${filename}`;
    const response = await fetch(
        `https://api.github.com/repos/owner/repo/contents/${path}`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `新文章: ${title}`,
                content: btoa(unescape(encodeURIComponent(content))),
                branch: 'master'
            })
        }
    );
    return response.json();
}
```

**关键点：**
- 使用 Personal Access Token 认证
- 内容需要 Base64 编码
- 支持中文需要 `unescape(encodeURIComponent())`

### 3. GitHub Actions 自动化

创建 `.github/workflows/auto-build.yml`：

```yaml
name: 自动构建和部署博客

on:
  push:
    branches:
      - master
    paths:
      - 'posts/**/*.md'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: 检出代码
        uses: actions/checkout@v4
      
      - name: 设置 Hugo
        uses: peaceiris/actions-hugo@v2
        with:
          hugo-version: 'latest'
      
      - name: 构建网站
        run: hugo --minify
      
      - name: 部署到 GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
```

**触发条件：**
- 监听 `posts/` 目录下的 `.md` 文件变化
- 自动执行构建和部署

### 4. Markdown 实时预览

使用 `marked.js` 库实现实时渲染：

```javascript
marked.setOptions({
    breaks: true,
    gfm: true
});

function updatePreview() {
    const markdown = markdownInput.value;
    previewContent.innerHTML = marked.parse(markdown);
}

markdownInput.addEventListener('input', updatePreview);
```

## 使用体验

### 发布流程

1. 在任意网页点击右下角 📝 按钮
2. 填写标题、标签、分类
3. 编写 Markdown 内容
4. 实时预览效果
5. 点击"发布到 GitHub"
6. 等待 1-2 分钟，文章自动上线

### 性能表现

- **编辑器打开速度**：< 1 秒
- **文章提交时间**：2-5 秒
- **GitHub Actions 构建**：30-60 秒
- **总发布时间**：约 1-2 分钟

## 技术难点与解决方案

### 难点 1：浏览器安全策略

**问题**：`document.write()` 被 Trusted Types 阻止

**解决**：使用 Blob URL
```javascript
const blob = new Blob([html], { type: 'text/html' });
const url = URL.createObjectURL(blob);
window.open(url);
```

### 难点 2：中文编码问题

**问题**：直接 `btoa()` 中文会报错

**解决**：先进行 URI 编码
```javascript
btoa(unescape(encodeURIComponent(content)))
```

### 难点 3：防止重复打开窗口

**问题**：多次点击会打开多个编辑器

**解决**：保存窗口引用并检查状态
```javascript
let editorWindow = null;

function openEditor() {
    if (editorWindow && !editorWindow.closed) {
        editorWindow.focus();
        return;
    }
    editorWindow = window.open(...);
}
```

## 安全考虑

### Token 管理

- Token 存储在浏览器本地（`GM_getValue/GM_setValue`）
- 不经过任何第三方服务器
- 建议设置过期时间并定期更换

### 权限最小化

只需要 `repo` 权限：
- ✅ 可以读写仓库
- ❌ 不能删除仓库
- ❌ 不能修改设置

### HTTPS 通信

所有 API 请求都通过 HTTPS：
- GitHub API: `https://api.github.com`
- CDN 资源: `https://cdn.jsdelivr.net`

## 扩展可能

### 功能增强

1. **图片上传** - 集成图床 API
2. **草稿管理** - 云端同步草稿
3. **文章列表** - 查看和编辑已发布文章
4. **多仓库支持** - 管理多个博客
5. **模板系统** - 预设文章模板

### 适配其他平台

这个方案可以轻松适配到：
- Jekyll 博客
- Hexo 博客
- VuePress 文档
- 任何基于 Git 的静态网站

## 总结

通过这个解决方案，我实现了：

- 🚀 **发布效率提升 80%** - 从 5 步减少到 1 步
- 💰 **零成本运行** - 无需服务器
- 🎨 **优秀的用户体验** - 实时预览、自动保存
- 🔒 **安全可靠** - 直连 GitHub，无中间人

如果你也在使用 GitHub Pages，不妨试试这个方案。源码已开源在我的 GitHub 仓库，欢迎使用和改进！

## 参考资源

- [GitHub API 文档](https://docs.github.com/rest)
- [Tampermonkey 文档](https://www.tampermonkey.net/documentation.php)
- [GitHub Actions 文档](https://docs.github.com/actions)
- [Marked.js 文档](https://marked.js.org/)

---

**项目地址**：https://github.com/trianglestrip/trianglestrip.github.io

**在线演示**：安装脚本后在任意网页点击右下角 📝 按钮

欢迎 Star 和 Fork！
