// ==UserScript==
// @name         GitHub Pages 博客编辑器
// @namespace    https://trianglestrip.github.io/
// @version      1.0.1
// @description  在任意网页添加悬浮按钮，点击打开 Markdown 编辑器，直接发布到 GitHub Pages
// @author       trianglestrip
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @connect      api.github.com
// @require      https://cdn.jsdelivr.net/npm/marked@4.0.0/marked.min.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        GITHUB_API: 'https://api.github.com',
        REPO_OWNER: 'trianglestrip',
        REPO_NAME: 'trianglestrip.github.io',
        BRANCH: 'master',
        POSTS_DIR: 'posts'
    };

    let editorWindow = null;

    function createFloatingButton() {
        if (document.getElementById('blog-editor-float-btn')) {
            return;
        }

        const button = document.createElement('div');
        button.id = 'blog-editor-float-btn';
        button.innerHTML = '📝';
        button.title = '打开博客编辑器';
        
        Object.assign(button.style, {
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            width: '60px',
            height: '60px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: '999999',
            transition: 'all 0.3s',
            userSelect: 'none'
        });

        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.1)';
            button.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        });

        button.addEventListener('click', openEditor);
        
        document.body.appendChild(button);
        console.log('✅ 博客编辑器按钮已创建');
    }

    function openEditor() {
        if (editorWindow && !editorWindow.closed) {
            editorWindow.focus();
            return;
        }

        const editorHTML = createEditorDataURL();
        const blob = new Blob([editorHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        editorWindow = window.open(url, 'BlogEditor', 'width=1400,height=900,menubar=no,toolbar=no,location=no,status=no');
        
        if (!editorWindow) {
            alert('❌ 无法打开窗口，请检查浏览器是否阻止了弹出窗口');
        } else {
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    }

    function createEditorDataURL() {
        const token = GM_getValue('github_token', '');
        
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Markdown 编辑器</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.1.0/github-markdown.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            position: relative;
        }

        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 1.1em; }

        .close-btn {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 20px;
        }

        .editor-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            height: calc(100vh - 240px);
            min-height: 500px;
        }

        .editor-panel, .preview-panel {
            padding: 30px;
            overflow-y: auto;
        }

        .editor-panel {
            border-right: 2px solid #e0e0e0;
            background: #f8f9fa;
        }

        .panel-title {
            font-size: 1.2em;
            font-weight: 600;
            margin-bottom: 15px;
            color: #333;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #555;
        }

        .form-group input, .form-group textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 1em;
            font-family: inherit;
        }

        .form-group input:focus, .form-group textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        #markdown-input {
            font-family: 'Consolas', 'Monaco', monospace;
            min-height: 300px;
            resize: vertical;
            line-height: 1.6;
        }

        .tags-input {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 8px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            min-height: 45px;
        }

        .tag {
            background: #667eea;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .tag-remove {
            cursor: pointer;
            font-weight: bold;
        }

        .tag-input-field {
            border: none;
            outline: none;
            flex: 1;
            min-width: 120px;
            background: transparent;
        }

        .button-group {
            display: flex;
            gap: 15px;
            margin-top: 20px;
        }

        .btn {
            flex: 1;
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            font-size: 1em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }

        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }

        .btn-secondary {
            background: #6c757d;
            color: white;
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .status-message {
            margin-top: 15px;
            padding: 12px;
            border-radius: 8px;
            display: none;
        }

        .status-message.success {
            background: #d4edda;
            color: #155724;
        }

        .status-message.error {
            background: #f8d7da;
            color: #721c24;
        }

        .status-message.info {
            background: #d1ecf1;
            color: #0c5460;
        }

        .warning-box {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            color: #856404;
        }

        .warning-box a {
            color: #667eea;
            font-weight: 600;
        }

        .token-group {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        .token-group input {
            flex: 1;
        }

        .token-group button {
            padding: 12px 20px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
        }

        .preview-content {
            line-height: 1.8;
            padding: 20px;
        }

        .markdown-body {
            box-sizing: border-box;
            min-width: 200px;
            max-width: 980px;
            margin: 0 auto;
        }

        .spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <button class="close-btn" onclick="window.close()">×</button>
            <h1>📝 Markdown 编辑器</h1>
            <p>编写文章并发布到 GitHub Pages</p>
        </div>

        <div class="editor-container">
            <div class="editor-panel">
                <div class="panel-title">✍️ 编辑器</div>
                
                <div class="warning-box" id="tokenWarning" style="display: ${token ? 'none' : 'block'}">
                    ⚠️ 请先设置 GitHub Token
                    <div class="token-group">
                        <input type="password" id="token-input" placeholder="ghp_xxxxxxxxxxxx" value="${token}">
                        <button id="save-token-btn">保存 Token</button>
                    </div>
                    <p style="margin-top: 10px; font-size: 0.9em;">
                        <a href="https://github.com/settings/tokens/new?scopes=repo&description=Blog%20Editor" target="_blank">
                            点击这里创建 Token →
                        </a> (需要 repo 权限)
                    </p>
                </div>

                <div class="form-group">
                    <label>📌 文章标题 *</label>
                    <input type="text" id="title-input" placeholder="输入文章标题...">
                </div>

                <div class="form-group">
                    <label>🔗 URL 别名（可选）</label>
                    <input type="text" id="slug-input" placeholder="my-post（留空自动生成）">
                </div>

                <div class="form-group">
                    <label>🏷️ 标签</label>
                    <div class="tags-input" id="tags-container">
                        <input type="text" class="tag-input-field" id="tag-input" placeholder="输入标签后按回车...">
                    </div>
                </div>

                <div class="form-group">
                    <label>📂 分类</label>
                    <input type="text" id="category-input" placeholder="技术、生活、随笔...">
                </div>

                <div class="form-group">
                    <label>📄 Markdown 内容 *</label>
                    <textarea id="markdown-input" placeholder="在这里编写 Markdown..."></textarea>
                </div>

                <div class="button-group">
                    <button class="btn btn-primary" id="publish-btn">🚀 发布到 GitHub</button>
                    <button class="btn btn-secondary" id="save-draft-btn">💾 保存草稿</button>
                    <button class="btn btn-secondary" id="clear-btn">🗑️ 清空</button>
                </div>

                <div class="status-message" id="status-message"></div>
            </div>

            <div class="preview-panel">
                <div class="panel-title">👁️ 实时预览</div>
                <div class="preview-content">
                    <div class="markdown-body" id="preview-content">
                        <p style="color: #999; text-align: center; padding: 50px 20px;">
                            开始编写 Markdown，预览将实时显示在这里...
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/marked@4.0.0/marked.min.js"></script>
    <script>
        const CONFIG = ${JSON.stringify(CONFIG)};
        let githubToken = '${token}';
        let tags = [];

        marked.setOptions({ breaks: true, gfm: true });

        const elements = {
            title: document.getElementById('title-input'),
            slug: document.getElementById('slug-input'),
            category: document.getElementById('category-input'),
            markdown: document.getElementById('markdown-input'),
            preview: document.getElementById('preview-content'),
            publishBtn: document.getElementById('publish-btn'),
            saveDraftBtn: document.getElementById('save-draft-btn'),
            clearBtn: document.getElementById('clear-btn'),
            status: document.getElementById('status-message'),
            tagInput: document.getElementById('tag-input'),
            tagsContainer: document.getElementById('tags-container'),
            tokenWarning: document.getElementById('tokenWarning'),
            tokenInput: document.getElementById('token-input'),
            saveTokenBtn: document.getElementById('save-token-btn')
        };

        function showStatus(message, type) {
            elements.status.textContent = message;
            elements.status.className = 'status-message ' + type;
            elements.status.style.display = 'block';
            if (type === 'success') setTimeout(() => elements.status.style.display = 'none', 5000);
        }

        function updatePreview() {
            const markdown = elements.markdown.value;
            if (!markdown.trim()) {
                elements.preview.innerHTML = '<p style="color: #999; text-align: center; padding: 50px 20px;">开始编写 Markdown，预览将实时显示在这里...</p>';
            } else {
                elements.preview.innerHTML = marked.parse(markdown);
            }
        }

        function generateSlug(title) {
            return title.toLowerCase()
                .replace(/[^\\w\\s\\u4e00-\\u9fa5-]/g, '')
                .replace(/\\s+/g, '-')
                .replace(/-+/g, '-')
                .trim()
                .substring(0, 50);
        }

        function addTag(tagText) {
            tagText = tagText.trim();
            if (tagText && !tags.includes(tagText)) {
                tags.push(tagText);
                renderTags();
            }
        }

        window.removeTag = function(tagText) {
            tags = tags.filter(t => t !== tagText);
            renderTags();
        };

        function renderTags() {
            document.querySelectorAll('.tag').forEach(tag => tag.remove());
            tags.forEach(tagText => {
                const tagEl = document.createElement('div');
                tagEl.className = 'tag';
                tagEl.innerHTML = '<span>' + tagText + '</span><span class="tag-remove" onclick="removeTag(\\'' + tagText + '\\')">×</span>';
                elements.tagsContainer.insertBefore(tagEl, elements.tagInput);
            });
        }

        function generateFrontMatter() {
            const title = elements.title.value.trim();
            const slug = elements.slug.value.trim() || generateSlug(title);
            const category = elements.category.value.trim();
            const date = new Date().toISOString();

            let fm = '---\\n';
            fm += 'title: "' + title + '"\\n';
            fm += 'date: ' + date + '\\n';
            if (slug) fm += 'slug: "' + slug + '"\\n';
            if (category) fm += 'categories: ["' + category + '"]\\n';
            if (tags.length > 0) fm += 'tags: [' + tags.map(t => '"' + t + '"').join(', ') + ']\\n';
            fm += 'draft: false\\n---\\n\\n';
            return fm;
        }

        function saveDraft() {
            const title = elements.title.value.trim() || 'untitled';
            const slug = elements.slug.value.trim() || generateSlug(title);
            const content = generateFrontMatter() + elements.markdown.value;
            const blob = new Blob([content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = slug + '.md';
            a.click();
            URL.revokeObjectURL(url);
            showStatus('✅ 草稿已保存到本地！', 'success');
        }

        async function publishPost() {
            const title = elements.title.value.trim();
            const markdown = elements.markdown.value.trim();

            if (!title) return showStatus('❌ 请输入文章标题！', 'error');
            if (!markdown) return showStatus('❌ 请输入文章内容！', 'error');
            if (!githubToken) {
                elements.tokenWarning.style.display = 'block';
                return showStatus('❌ 请先设置 GitHub Token！', 'error');
            }

            elements.publishBtn.disabled = true;
            elements.publishBtn.innerHTML = '<span class="spinner"></span> 发布中...';

            try {
                const slug = elements.slug.value.trim() || generateSlug(title);
                const timestamp = new Date().toISOString().split('T')[0];
                const filename = timestamp + '-' + slug + '.md';
                const content = generateFrontMatter() + markdown;

                showStatus('📤 正在上传到 GitHub...', 'info');

                const path = CONFIG.POSTS_DIR + '/' + filename;
                const sha = await getFileSHA(path);
                
                const body = {
                    message: '新文章: ' + title,
                    content: btoa(unescape(encodeURIComponent(content))),
                    branch: CONFIG.BRANCH
                };
                if (sha) body.sha = sha;

                const response = await fetch(
                    CONFIG.GITHUB_API + '/repos/' + CONFIG.REPO_OWNER + '/' + CONFIG.REPO_NAME + '/contents/' + path,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': 'token ' + githubToken,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(body)
                    }
                );

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || '发布失败');
                }

                showStatus('✅ 文章发布成功！GitHub Actions 将自动构建和部署。', 'success');
                setTimeout(clearForm, 2000);

            } catch (error) {
                showStatus('❌ 发布失败: ' + error.message, 'error');
            } finally {
                elements.publishBtn.disabled = false;
                elements.publishBtn.innerHTML = '🚀 发布到 GitHub';
            }
        }

        async function getFileSHA(path) {
            try {
                const response = await fetch(
                    CONFIG.GITHUB_API + '/repos/' + CONFIG.REPO_OWNER + '/' + CONFIG.REPO_NAME + '/contents/' + path,
                    {
                        headers: {
                            'Authorization': 'token ' + githubToken,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                if (response.ok) {
                    const data = await response.json();
                    return data.sha;
                }
            } catch (e) {}
            return null;
        }

        function clearForm() {
            elements.title.value = '';
            elements.slug.value = '';
            elements.category.value = '';
            elements.markdown.value = '';
            tags = [];
            renderTags();
            updatePreview();
            localStorage.removeItem('draft');
        }

        function autoSave() {
            localStorage.setItem('draft', JSON.stringify({
                title: elements.title.value,
                slug: elements.slug.value,
                category: elements.category.value,
                markdown: elements.markdown.value,
                tags: tags
            }));
        }

        function loadDraft() {
            const draft = localStorage.getItem('draft');
            if (draft) {
                const data = JSON.parse(draft);
                elements.title.value = data.title || '';
                elements.slug.value = data.slug || '';
                elements.category.value = data.category || '';
                elements.markdown.value = data.markdown || '';
                tags = data.tags || [];
                renderTags();
                updatePreview();
            }
        }

        elements.markdown.addEventListener('input', () => { updatePreview(); autoSave(); });
        elements.title.addEventListener('input', autoSave);
        elements.slug.addEventListener('input', autoSave);
        elements.category.addEventListener('input', autoSave);

        elements.tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag(elements.tagInput.value);
                elements.tagInput.value = '';
                autoSave();
            }
        });

        elements.publishBtn.addEventListener('click', publishPost);
        elements.saveDraftBtn.addEventListener('click', saveDraft);
        elements.clearBtn.addEventListener('click', () => {
            if (confirm('确定要清空所有内容吗？')) clearForm();
        });

        elements.saveTokenBtn.addEventListener('click', () => {
            const newToken = elements.tokenInput.value.trim();
            if (newToken) {
                githubToken = newToken;
                window.opener.postMessage({ type: 'SAVE_TOKEN', token: newToken }, '*');
                elements.tokenWarning.style.display = 'none';
                showStatus('✅ Token 已保存', 'success');
            }
        });

        loadDraft();
        
        if (!elements.markdown.value) {
            elements.markdown.value = '# 欢迎使用 Markdown 编辑器\\n\\n开始编写你的文章...\\n\\n## 功能特点\\n\\n- 实时预览\\n- 一键发布\\n- 自动保存';
            updatePreview();
        }
    </script>
</body>
</html>`;
    }

    GM_registerMenuCommand('📝 打开博客编辑器', openEditor);
    GM_registerMenuCommand('⚙️ 设置 GitHub Token', () => {
        const token = prompt('请输入 GitHub Personal Access Token:', GM_getValue('github_token', ''));
        if (token) {
            GM_setValue('github_token', token);
            alert('✅ Token 已保存！');
        }
    });

    window.addEventListener('message', (event) => {
        if (event.data.type === 'SAVE_TOKEN') {
            GM_setValue('github_token', event.data.token);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createFloatingButton);
    } else {
        createFloatingButton();
    }

    console.log('✅ GitHub Pages 博客编辑器脚本已加载');

})();
