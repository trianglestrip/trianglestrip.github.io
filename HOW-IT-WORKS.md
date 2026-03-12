# 🚀 博客自动发布系统说明

## 📋 系统架构

```
油猴脚本 → GitHub (master/posts/*.md) → GitHub Actions → Hugo 构建 → 部署到网站
```

## 🔄 完整流程

### 1. 写文章（油猴脚本）

- 在任意网页点击 📝 按钮
- 打开编辑器：https://trianglestrip.github.io/blog-editor.html
- 填写标题、内容、分类、标签
- 点击"发布到 GitHub"

### 2. 提交到 GitHub

油猴脚本会：
- 将 Markdown 文件提交到 `master` 分支的 `posts/` 目录
- 文件名格式：`2026-03-12-标题.md`

### 3. 自动构建（GitHub Actions）

检测到 `posts/` 目录有新文件时：

1. **检出两个分支**
   - `master` - 静态网站 + posts 目录
   - `blog-source` - Hugo 源文件

2. **复制文章**
   ```bash
   master/posts/*.md → blog-source/content/posts/
   ```

3. **Hugo 构建**
   ```bash
   cd blog-source
   hugo --minify
   # 生成 public/ 目录
   ```

4. **部署到 master**
   ```bash
   cd master
   rm -rf 旧的HTML文件
   cp -r blog-source/public/* .
   git commit && git push
   ```

### 4. 自动发布

- GitHub Pages 自动检测 `master` 分支的更新
- 约 1-2 分钟后，新文章出现在 https://trianglestrip.github.io

## 📁 分支说明

### master 分支（当前）
```
master/
├── posts/               # 📝 油猴脚本提交的 Markdown 文章
│   ├── 2026-03-12-222.md
│   └── 2026-03-12-test-deployment.md
├── first/               # 🌐 已构建的文章页面
│   ├── index.html
│   └── index.md
├── index.html           # 🏠 网站首页
├── css/                 # 🎨 样式文件
├── js/                  # ⚡ JavaScript
└── .github/
    └── workflows/
        └── auto-build.yml  # 🤖 自动构建脚本
```

### blog-source 分支
```
blog-source/
├── content/             # 📝 Hugo 源文章
│   └── posts/
├── themes/              # 🎨 Hugo 主题
├── config.toml          # ⚙️ Hugo 配置
└── public/              # 🏗️ 构建输出（临时）
```

## ⏱️ 时间线

| 步骤 | 时间 | 说明 |
|------|------|------|
| 1. 编写文章 | 即时 | 在编辑器中填写 |
| 2. 提交到 GitHub | ~5秒 | 油猴脚本上传 |
| 3. 触发 Actions | ~10秒 | GitHub 检测到变更 |
| 4. Hugo 构建 | ~30秒 | Actions 运行构建 |
| 5. 部署到 master | ~10秒 | 推送构建结果 |
| 6. GitHub Pages 更新 | ~1分钟 | 网站自动更新 |
| **总计** | **~2分钟** | 从发布到可见 |

## 🔍 如何查看构建状态

1. 访问：https://github.com/trianglestrip/trianglestrip.github.io/actions
2. 查看最新的 "自动构建博客" 工作流
3. 如果失败，点击查看日志

## ⚠️ 常见问题

### Q: 文章发布成功但网站上看不到？

**A:** 等待 2-3 分钟，GitHub Actions 需要时间构建。

### Q: 如何查看构建日志？

**A:** 
1. 打开 https://github.com/trianglestrip/trianglestrip.github.io/actions
2. 点击最新的工作流运行
3. 查看每个步骤的输出

### Q: 构建失败怎么办？

**A:** 检查：
1. `blog-source` 分支是否存在
2. Hugo 配置文件是否正确
3. 文章的 Front Matter 格式是否正确

### Q: 可以手动触发构建吗？

**A:** 可以！
1. 打开 https://github.com/trianglestrip/trianglestrip.github.io/actions
2. 选择 "自动构建博客"
3. 点击 "Run workflow"

## 🎯 优势

✅ **完全自动化** - 写完就发布，无需手动操作  
✅ **版本控制** - 所有文章都在 Git 中  
✅ **随时随地** - 任意网页都能写文章  
✅ **专业构建** - 使用 Hugo 生成优化的静态网站  
✅ **免费托管** - GitHub Pages 永久免费  

## 🔧 技术栈

- **编辑器**: HTML + JavaScript + Marked.js
- **脚本**: Tampermonkey (GM_xmlhttpRequest)
- **构建**: Hugo + GitHub Actions
- **托管**: GitHub Pages
- **版本控制**: Git

---

**🎉 现在你可以在任何网页上写博客了！**
