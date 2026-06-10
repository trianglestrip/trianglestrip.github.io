window.$docsify = window.$docsify || {};
window.$docsify.plugins = window.$docsify.plugins || [];

window.$docsify.plugins.push(function (hook, vm) {
  var postsCache = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadPosts() {
    if (postsCache) {
      return Promise.resolve(postsCache);
    }
    return fetch("posts.json")
      .then(function (res) {
        if (!res.ok) throw new Error("posts.json not found");
        return res.json();
      })
      .then(function (posts) {
        postsCache = posts;
        return posts;
      });
  }

  function buildMetaText(post, includeViews) {
    var parts = [];
    if (post.created) {
      parts.push("发布 " + escapeHtml(post.created));
    }
    if (post.updated && post.updated !== post.created) {
      parts.push("更新 " + escapeHtml(post.updated));
    }
    if (includeViews) {
      parts.push(
        '阅读 <span id="busuanzi_value_page_pv">...</span> 次'
      );
    }
    return parts.join(" · ");
  }

  function refreshPageViews() {
    if (typeof window.busuanzi !== "undefined" && window.busuanzi.pageViews) {
      window.busuanzi.pageViews();
    }
  }

  function renderPostList(el, posts) {
    if (!posts.length) {
      el.innerHTML =
        '<p class="post-excerpt">暂无文章，在 docs/posts/ 新建 .md 即可。</p>';
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
            '<p class="post-meta">' +
            buildMetaText(post, false) +
            "</p>" +
            (post.excerpt
              ? '<p class="post-excerpt">' + escapeHtml(post.excerpt) + "</p>"
              : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function renderPostMeta(file) {
    if (!file || !file.startsWith("posts/")) return;

    loadPosts()
      .then(function (posts) {
        var post = posts.find(function (item) {
          return item.file === file;
        });
        if (!post) return;

        var section = document.querySelector(".markdown-section");
        if (!section) return;

        var bar = section.querySelector(".post-meta-bar");
        if (!bar) {
          bar = document.createElement("div");
          bar.className = "post-meta-bar";
          section.insertBefore(bar, section.firstChild);
        }
        bar.innerHTML = buildMetaText(post, true);
        refreshPageViews();
      })
      .catch(function () {});
  }

  hook.doneEach(function () {
    if (!vm.route) return;

    var file = vm.route.file;
    var isHome =
      file === "index.md" || vm.route.path === "/" || vm.route.path === "";

    if (isHome) {
      var el = document.querySelector("#post-list");
      if (!el) return;
      loadPosts()
        .then(function (posts) {
          renderPostList(el, posts);
        })
        .catch(function () {
          el.innerHTML = '<p class="post-excerpt">文章列表加载失败</p>';
        });
      return;
    }

    renderPostMeta(file);
  });
});
