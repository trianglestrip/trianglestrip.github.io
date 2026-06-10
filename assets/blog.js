window.$docsify = window.$docsify || {};
window.$docsify.plugins = window.$docsify.plugins || [];

window.$docsify.plugins.push(function (hook) {
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderPostList(el, posts) {
    if (!posts.length) {
      el.innerHTML = '<p class="post-excerpt">暂无文章，在 docs/posts/ 新建 .md 即可。</p>';
      return;
    }
    el.innerHTML =
      '<ul class="post-list">' +
      posts
        .map(function (post) {
          return (
            '<li class="post-item">' +
            '<a href="' +
            escapeHtml(post.file) +
            '">' +
            escapeHtml(post.title) +
            "</a>" +
            (post.date
              ? '<p class="post-meta">' + escapeHtml(post.date) + "</p>"
              : "") +
            (post.excerpt
              ? '<p class="post-excerpt">' + escapeHtml(post.excerpt) + "</p>"
              : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul>";
  }

  hook.doneEach(function () {
    var el = document.querySelector("#post-list");
    if (!el || this.route.file !== "index.md") return;

    fetch("posts.json")
      .then(function (res) {
        if (!res.ok) throw new Error("posts.json not found");
        return res.json();
      })
      .then(function (posts) {
        renderPostList(el, posts);
      })
      .catch(function () {
        el.innerHTML = '<p class="post-excerpt">文章列表加载失败</p>';
      });
  });
});
