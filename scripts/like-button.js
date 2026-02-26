'use strict';

const likeCss = `
<style>
.post-like {
  display: flex;
  justify-content: center;
  margin: 32px 0;
}
.post-like-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border: 2px solid rgba(255,255,255,0.15);
  border-radius: 24px;
  background: transparent;
  color: var(--font-color, #fff);
  font-size: 15px;
  cursor: pointer;
  transition: all 0.25s;
  font-family: inherit;
}
.post-like-btn:hover {
  border-color: #ff6b81;
  color: #ff6b81;
}
.post-like-btn.liked {
  border-color: #ff6b81;
  color: #ff6b81;
}
.post-like-btn.liked .like-heart {
  animation: like-pop 0.4s ease;
}
.post-like-btn .like-heart {
  font-size: 20px;
  line-height: 1;
}
.post-like-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
@keyframes like-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
</style>
`;

const likeJs = `
<script>
(function() {
  var serverURL = 'https://comment-akasakajelos-projects.vercel.app';

  function getUser() {
    try {
      var raw = localStorage.getItem('WALINE_USER');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.display_name) return parsed;
      }
    } catch(e) {}
    return null;
  }

  function getLiked() {
    try {
      var raw = localStorage.getItem('WALINE_LIKES');
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return [];
  }

  function setLiked(path) {
    var liked = getLiked();
    if (liked.indexOf(path) === -1) liked.push(path);
    localStorage.setItem('WALINE_LIKES', JSON.stringify(liked));
  }

  function init() {
    var el = document.getElementById('post-like-container');
    if (!el) return;

    var path = window.location.pathname;

    var user = getUser();
    var hasLiked = getLiked().indexOf(path) !== -1;

    // Fetch current count
    fetch(serverURL + '/api/article?path=' + encodeURIComponent(path) + '&type=reaction0&lang=en')
      .then(function(r) { return r.json(); })
      .then(function(res) {
        var count = 0;
        if (res && res.data && res.data.length > 0) {
          count = res.data[0].reaction0 || 0;
        }
        render(el, path, count, user, hasLiked);
      })
      .catch(function() {
        render(el, path, 0, user, hasLiked);
      });
  }

  function render(el, path, count, user, hasLiked) {
    var btn = document.createElement('button');
    btn.className = 'post-like-btn' + (hasLiked ? ' liked' : '');
    btn.innerHTML = '<span class="like-heart">' + (hasLiked ? '\u2764\uFE0F' : '\u2661') + '</span>' +
      '<span class="like-count">' + count + '</span>' +
      '<span>Like' + (count !== 1 ? 's' : '') + '</span>';

    if (!user) {
      btn.title = 'Login to like this post';
      btn.addEventListener('click', function() {
        alert('Please login first to like this post.');
      });
    } else if (hasLiked) {
      btn.disabled = true;
      btn.title = 'You already liked this post';
    } else {
      btn.addEventListener('click', function() {
        btn.disabled = true;
        fetch(serverURL + '/api/article?lang=en', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: path, type: 'reaction0', action: 'inc' })
        })
        .then(function(r) { return r.json(); })
        .then(function() {
          setLiked(path);
          count++;
          btn.className = 'post-like-btn liked';
          btn.innerHTML = '<span class="like-heart">\u2764\uFE0F</span>' +
            '<span class="like-count">' + count + '</span>' +
            '<span>Like' + (count !== 1 ? 's' : '') + '</span>';
          btn.title = 'You already liked this post';
        })
        .catch(function() {
          btn.disabled = false;
        });
      });
    }

    el.innerHTML = '';
    el.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-init on pjax navigation
  document.addEventListener('pjax:complete', init);
})();
</script>
`;

hexo.extend.injector.register('head_end', likeCss, 'post');
hexo.extend.injector.register('body_end', likeJs, 'post');

// Inject the like button container before the comments section
hexo.extend.filter.register('after_render:html', function (data) {
  if (data.includes('id="comments"')) {
    data = data.replace(
      /(<div[^>]*id="comments")/,
      '<div class="post-like" id="post-like-container"></div>$1'
    );
  }
  return data;
});
