# xoyofan 博客 - Hugo 源文件

这是 [trianglestrip.github.io](https://trianglestrip.github.io) 的 Hugo 源文件仓库。

## 📁 仓库结构

### 分支说明

- **hugo-source** - Hugo 源文件（当前分支）
  - 包含 Hugo 配置、主题、内容源文件
  - 用于构建静态网站
  
- **master** - 静态网站（部署分支）
  - 包含构建后的 HTML、CSS、JS 文件
  - GitHub Pages 从此分支部署
  - 包含 `posts/` 目录用于接收油猴脚本提交的文章

## 🚀 工作流程

### 1. 写文章（油猴脚本）

使用 Tampermonkey 脚本在任意网页编写文章：

1. 点击网页右下角的 📝 按钮
2. 在编辑器中填写标题、内容、分类、标签
3. 点击"发布到 GitHub"
4. 文章自动提交到 `master` 分支的 `posts/` 目录

### 2. 自动构建（GitHub Actions）

当检测到 `master/posts/` 或 `hugo-source/content/` 有更新时：

1. 从 `master/posts/` 复制新文章到 `hugo-source/content/posts/`
2. 使用 Hugo 构建静态网站
3. 将构建结果部署到 `master` 分支
4. GitHub Pages 自动发布更新

### 3. 访问网站

约 2-3 分钟后，新文章出现在：https://trianglestrip.github.io

## 📂 目录结构

```
hugo-source/
├── content/              # 内容目录
│   ├── posts/           # 博客文章
│   └── about/           # 关于页面
├── themes/              # 主题目录
│   └── simple/          # 自定义简单主题
├── static/              # 静态资源
│   └── images/          # 图片
├── layouts/             # 自定义布局
├── archetypes/          # 内容模板
├── .github/
│   └── workflows/
│       └── auto-build.yml  # 自动构建工作流
├── hugo.toml            # Hugo 配置文件
└── README.md            # 本文件
```

## 🛠️ 本地开发

### 安装 Hugo

```bash
# Windows (使用 Chocolatey)
choco install hugo-extended

# macOS (使用 Homebrew)
brew install hugo

# Linux (使用包管理器)
sudo apt-get install hugo  # Debian/Ubuntu
```

### 本地预览

```bash
# 克隆仓库
git clone https://github.com/trianglestrip/trianglestrip.github.io.git
cd trianglestrip.github.io

# 切换到 hugo-source 分支
git checkout hugo-source

# 启动开发服务器
hugo server -D

# 访问 http://localhost:1313
```

### 创建新文章

```bash
# 使用 Hugo 命令创建
hugo new posts/my-new-post.md

# 或直接在 content/posts/ 目录创建 .md 文件
```

### 构建网站

```bash
# 构建到 public/ 目录
hugo --minify
```

## 📝 文章格式

文章使用 Markdown 格式，需要包含 Front Matter：

```markdown
---
title: "文章标题"
date: 2026-03-12T10:00:00+08:00
categories: ["分类"]
tags: ["标签1", "标签2"]
draft: false
---

文章内容...
```

## 🎨 主题

当前使用自定义的 `simple` 主题，位于 `themes/simple/`。

如需使用其他主题：

1. 下载主题到 `themes/` 目录
2. 修改 `hugo.toml` 中的 `theme = "主题名"`
3. 根据主题文档调整配置

## 🔧 配置

主要配置文件：`hugo.toml`

```toml
baseURL = "https://trianglestrip.github.io/"
languageCode = "zh-cn"
title = "xoyofan博客"
theme = "simple"

[params]
  description = "xoyofan博客"
  
[menu]
  [[menu.main]]
    name = "所有文章"
    url = "/posts/"
```

## 🤖 GitHub Actions

工作流文件：`.github/workflows/auto-build.yml`

触发条件：
- `master` 分支的 `posts/**/*.md` 有更新
- `hugo-source` 分支的 `content/**/*.md` 有更新
- 手动触发（workflow_dispatch）

## 📖 相关文档

- [Hugo 官方文档](https://gohugo.io/documentation/)
- [Markdown 语法](https://www.markdownguide.org/)
- [GitHub Pages 文档](https://docs.github.com/pages)

## 🎉 开始使用

1. **安装油猴脚本** - 参考 `README-TAMPERMONKEY.md`
2. **设置 GitHub Token** - 在油猴脚本中配置
3. **开始写作** - 在任意网页点击 📝 按钮
4. **自动发布** - 文章会自动构建并发布到网站

---

**Powered by Hugo | Theme: Simple | Deployed on GitHub Pages**
