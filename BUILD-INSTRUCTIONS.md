# 📖 如何让文章显示在网站上

## 🔍 当前情况

你的仓库结构：
- **master 分支** - 已构建的静态 HTML 网站（当前分支）
- **blog-source 分支** - 可能是 Hugo 源文件
- **posts/ 目录** - 通过油猴脚本提交的 Markdown 文章

## ❓ 为什么文章不显示

因为 `master` 分支是**静态 HTML**，不会自动处理 Markdown 文件。需要：
1. 将 Markdown 转换为 HTML
2. 更新网站的索引和链接

## 🎯 解决方案

### 方案一：手动构建（简单但需要每次操作）

如果你有 Hugo 源文件：

```bash
# 1. 切换到源文件分支
git checkout blog-source

# 2. 复制新文章到 content 目录
cp posts/*.md content/posts/

# 3. 使用 Hugo 构建
hugo

# 4. 切换回 master 分支
git checkout master

# 5. 复制构建结果
cp -r public/* .

# 6. 提交并推送
git add .
git commit -m "更新博客"
git push origin master
```

### 方案二：修改油猴脚本直接生成 HTML（推荐）

让油猴脚本直接提交 HTML 文件，而不是 Markdown：

1. 修改脚本，将 Markdown 转换为 HTML
2. 提交到对应的目录（如 `posts/2026-03-12-title/index.html`）
3. 更新 `index.html` 添加文章链接

### 方案三：使用 GitHub Actions 自动构建（需要配置）

需要：
1. 在 `blog-source` 分支配置 Actions
2. 监听 `master` 分支的 `posts/` 变化
3. 自动拉取、构建、部署

## 💡 我的建议

**最简单的方案**：修改油猴脚本，让它提交 HTML 而不是 Markdown。

这样：
- ✅ 不需要构建步骤
- ✅ 文章立即可见
- ✅ 完全自动化

需要我帮你实现这个方案吗？
