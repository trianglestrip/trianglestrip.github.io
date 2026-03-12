// ==UserScript==
// @name         GitHub Pages 博客编辑器 - 简化版
// @namespace    https://trianglestrip.github.io/
// @version      5.0.0
// @description  打开本地 HTML 文件作为编辑器
// @author       trianglestrip
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      api.github.com
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        REPO_OWNER: 'trianglestrip',
        REPO_NAME: 'trianglestrip.github.io',
        BRANCH: 'master'
    };

    let editorWindow = null;

    function createFloatingButton() {
        if (document.getElementById('blog-editor-btn')) return;

        const btn = document.createElement('div');
        btn.id = 'blog-editor-btn';
        btn.textContent = '📝';
        btn.title = '打开博客编辑器';
        
        Object.assign(btn.style, {
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
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: '999998',
            transition: 'all 0.3s'
        });
        
        btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
        btn.onmouseout = () => btn.style.transform = 'scale(1)';
        btn.onclick = openEditor;
        
        document.body.appendChild(btn);
        console.log('✅ 悬浮按钮已创建');
    }

    function openEditor() {
        if (editorWindow && !editorWindow.closed) {
            editorWindow.focus();
            return;
        }

        const editorURL = 'https://trianglestrip.github.io/blog-editor.html';
        editorWindow = window.open(editorURL, 'BlogEditor', 'width=1000,height=800');
        
        if (!editorWindow) {
            alert('❌ 无法打开窗口。请允许弹出窗口，或使用菜单打开。');
        }
    }

    function getFileSHA(path, token) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/${path}`,
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                onload: (r) => {
                    if (r.status === 200) {
                        try {
                            resolve(JSON.parse(r.responseText).sha);
                        } catch (e) {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                },
                onerror: () => resolve(null)
            });
        });
    }

    function publishToGitHub(path, body, token) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'PUT',
                url: `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/${path}`,
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                data: body,
                onload: (r) => {
                    if (r.status >= 200 && r.status < 300) {
                        resolve(JSON.parse(r.responseText));
                    } else {
                        try {
                            const err = JSON.parse(r.responseText);
                            reject(new Error(err.message || '发布失败'));
                        } catch (e) {
                            reject(new Error(`发布失败: ${r.status}`));
                        }
                    }
                },
                onerror: () => reject(new Error('网络请求失败'))
            });
        });
    }

    window.addEventListener('message', async (e) => {
        if (e.data.type === 'SAVE_TOKEN') {
            GM_setValue('github_token', e.data.token);
        } else if (e.data.type === 'REQUEST_TOKEN') {
            const token = GM_getValue('github_token', '');
            if (token && e.source) {
                e.source.postMessage({
                    type: 'INIT_TOKEN',
                    token: token
                }, '*');
            }
        } else if (e.data.type === 'PUBLISH_REQUEST') {
            const token = GM_getValue('github_token', '');
            
            try {
                const sha = await getFileSHA(e.data.path, token);
                const encoded = btoa(unescape(encodeURIComponent(e.data.content)));
                
                const body = {
                    message: `新文章: ${e.data.title}`,
                    content: encoded,
                    branch: CONFIG.BRANCH
                };
                if (sha) body.sha = sha;
                
                await publishToGitHub(e.data.path, JSON.stringify(body), token);
                
                e.source.postMessage({
                    type: 'PUBLISH_RESPONSE',
                    success: true
                }, '*');
                
            } catch (error) {
                e.source.postMessage({
                    type: 'PUBLISH_RESPONSE',
                    success: false,
                    error: error.message
                }, '*');
            }
        }
    });

    GM_registerMenuCommand('📝 打开编辑器', openEditor);
    GM_registerMenuCommand('⚙️ 设置 Token', () => {
        const t = prompt('输入 GitHub Token:', GM_getValue('github_token', ''));
        if (t) {
            GM_setValue('github_token', t);
            alert('✅ Token 已保存');
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createFloatingButton);
    } else {
        createFloatingButton();
    }

})();
