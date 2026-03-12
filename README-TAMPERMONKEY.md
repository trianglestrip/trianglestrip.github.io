# 📝 油猴脚本 - GitHub Pages 博客编辑器

这是一个 Tampermonkey 油猴脚本，让你可以在任意网页打开一个 Markdown 编辑器，直接发布文章到 GitHub Pages，无需服务器！

## ✨ 功能特点

- 🌐 **在任意网页使用** - 右下角悬浮按钮，随时打开编辑器
- 📝 **实时预览** - 边写边看，所见即所得
- 🚀 **一键发布** - 直接提交到 GitHub，触发自动构建
- 💾 **自动保存** - 草稿自动保存，刷新不丢失
- 🏷️ **标签和分类** - 完整的元数据支持
- 🔒 **安全可靠** - Token 存储在本地，不经过第三方服务器
- 🎨 **现代 UI** - 美观的渐变设计和流畅动画

## 🚀 快速开始

### 第一步：安装 Tampermonkey

如果还没有安装 Tampermonkey：

1. **Chrome 浏览器**：[Chrome 网上应用店](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. **Edge 浏览器**：[Edge 加载项](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
3. **Firefox 浏览器**：[Firefox 附加组件](https://addons.mozilla.org/firefox/addon/tampermonkey/)

### 第二步：安装脚本

1. 点击 Tampermonkey 图标
2. 选择"管理面板"
3. 点击"实用工具"标签
4. 在"从 URL 安装"中粘贴脚本地址，或者：
5. 点击"+"号创建新脚本
6. 复制 `tampermonkey-blog-editor.user.js` 的内容
7. 粘贴并保存（Ctrl+S）

### 第三步：创建 GitHub Token

1. 访问 [GitHub Token 创建页面](https://github.com/settings/tokens/new?scopes=repo&description=Blog%20Editor)
2. 勾选 **repo** 权限（完整的仓库访问权限）
3. 点击"Generate token"
4. **复制生成的 Token**（格式：`ghp_xxxxxxxxxxxx`）

### 第四步：配置脚本

**方法一：通过菜单配置**
1. 点击 Tampermonkey 图标
2. 选择"GitHub Pages 博客编辑器"
3. 点击"设置 GitHub Token"
4. 输入你的 Token 并保存

**方法二：在编辑器中配置**
1. 打开编辑器（点击悬浮按钮或菜单）
2. 看到黄色提示框时，点击链接创建 Token
3. 在输入框中粘贴 Token 并点击"保存"

### 第五步：开始写作

1. 在任意网页，点击右下角的 📝 悬浮按钮
2. 或者点击 Tampermonkey 菜单 → "打开博客编辑器"
3. 填写标题、分类、标签
4. 编写 Markdown 内容
5. 右侧实时预览
6. 点击"🚀 发布到 GitHub"
7. 等待几秒，文章就会自动发布！

## 📖 使用说明

### 编辑器界面

- **左侧编辑区**：
  - 文章标题（必填）
  - URL 别名（可选，留空自动生成）
  - 标签（输入后按回车添加，可添加多个）
  - 分类（可选）
  - Markdown 内容（必填）

- **右侧预览区**：
  - 实时显示 Markdown 渲染效果
  - 支持所有标准 Markdown 语法

### 按钮功能

- **🚀 发布到 GitHub**：提交文章到 GitHub 仓库，触发自动构建
- **💾 保存草稿**：下载 Markdown 文件到本地
- **🗑️ 清空**：清空所有输入内容

### 自动保存

编辑器会自动保存你的草稿到浏览器本地存储：
- 关闭窗口后再打开，内容会自动恢复
- 可以放心关闭窗口，不会丢失内容

## 🔄 工作流程

1. **编写文章** → 在编辑器中写 Markdown
2. **点击发布** → 脚本通过 GitHub API 提交文件到 `posts/` 目录
3. **触发 Actions** → GitHub Actions 自动检测到新文件
4. **自动构建** → Hugo 构建静态网站
5. **自动部署** → 更新到 GitHub Pages
6. **访问网站** → https://trianglestrip.github.io

整个过程大约需要 1-2 分钟。

## 📁 文件存储位置

文章会被保存到仓库的 `posts/` 目录，文件名格式：

```
posts/2026-03-12-my-article-title.md
```

## 🎯 Markdown Front Matter

每篇文章会自动生成 Front Matter：

```markdown
---
title: "文章标题"
date: 2026-03-12T16:30:00.000Z
slug: "my-article-title"
categories: ["技术"]
tags: ["Hugo", "Markdown", "博客"]
draft: false
---

文章内容...
```

## 🛠️ 自定义配置

如果需要修改配置，编辑脚本中的 `CONFIG` 对象：

```javascript
const CONFIG = {
    GITHUB_API: 'https://api.github.com',
    REPO_OWNER: 'trianglestrip',           // 你的 GitHub 用户名
    REPO_NAME: 'trianglestrip.github.io',  // 仓库名
    BRANCH: 'master',                       // 分支名
    POSTS_DIR: 'posts'                      // 文章保存目录
};
```

## 🔐 安全说明

- Token 存储在浏览器本地，不会上传到任何服务器
- 使用 GitHub API 直接通信，无中间人
- 建议定期更换 Token
- 不要在公共电脑上使用

## 🐛 常见问题

### Q: 点击发布后没有反应？

**A:** 检查以下几点：
1. 是否设置了 GitHub Token
2. Token 是否有 `repo` 权限
3. 打开浏览器控制台（F12）查看错误信息

### Q: 发布成功但网站没有更新？

**A:** 
1. 访问 GitHub 仓库的 Actions 标签页
2. 查看最新的工作流运行状态
3. 等待 1-2 分钟让 GitHub Pages 更新

### Q: 如何修改已发布的文章？

**A:** 
1. 在编辑器中重新编写文章
2. 使用相同的文件名（日期-标题）
3. 发布时会自动覆盖原文件

### Q: 悬浮按钮挡住了网页内容怎么办？

**A:** 
1. 可以拖动按钮到其他位置（需要修改脚本）
2. 或者通过 Tampermonkey 菜单打开编辑器
3. 可以在脚本中注释掉 `createFloatingButton()` 这行

### Q: 能否在移动设备上使用？

**A:** 
- iOS Safari：支持 Userscripts 扩展
- Android Chrome：支持 Tampermonkey
- 但建议在桌面浏览器使用以获得最佳体验

## 📊 GitHub Actions 说明

工作流会在以下情况触发：

- ✅ 当 `posts/` 目录下的 `.md` 文件有变化时
- ✅ 手动触发（在 Actions 页面点击"Run workflow"）

工作流会自动：

1. 检出代码
2. 检查是否有新文章
3. 设置 Hugo 环境
4. 将 `posts/` 中的文章复制到 `content/posts/`
5. 使用 Hugo 构建网站
6. 部署到 GitHub Pages

## 🎨 自定义样式

如果想修改编辑器外观，编辑脚本中的 CSS 部分：

- 修改颜色主题：搜索 `#667eea` 和 `#764ba2`
- 修改窗口大小：修改 `width=1400,height=900`
- 修改悬浮按钮位置：修改 `bottom: 30px; right: 30px;`

## 📝 Markdown 语法支持

支持所有标准 Markdown 语法：

- 标题：`# H1` `## H2` `### H3`
- 粗体：`**粗体**`
- 斜体：`*斜体*`
- 列表：`- 项目` 或 `1. 项目`
- 链接：`[文本](url)`
- 图片：`![alt](url)`
- 代码：`` `代码` `` 或 ` ```语言\n代码块\n``` `
- 引用：`> 引用文本`
- 分隔线：`---`

## 🔗 相关链接

- [GitHub 仓库](https://github.com/trianglestrip/trianglestrip.github.io)
- [博客地址](https://trianglestrip.github.io)
- [Hugo 文档](https://gohugo.io/documentation/)
- [Markdown 指南](https://www.markdownguide.org/)

## 💡 使用技巧

1. **快速打开**：使用快捷键（在 Tampermonkey 设置中配置）
2. **批量标签**：用逗号分隔一次输入多个标签
3. **保存草稿**：不确定是否发布？先保存草稿到本地
4. **URL 优化**：手动设置 slug 可以让 URL 更友好

## 🎉 开始使用

现在你可以：

1. 在任意网页点击右下角的 📝 按钮
2. 或者点击 Tampermonkey 图标 → "打开博客编辑器"
3. 开始写作并发布你的第一篇文章！

祝你写作愉快！✨

---

**提示**：如果遇到问题，请检查：
- GitHub Token 是否正确设置
- Token 是否有 repo 权限
- 网络连接是否正常
- 浏览器控制台是否有错误信息
