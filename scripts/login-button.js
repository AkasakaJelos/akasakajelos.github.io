'use strict';

const css = `
<style>
.site-login-btn {
  position: fixed;
  top: 12px;
  right: 16px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border: none;
  border-radius: 20px;
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(8px);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
  text-decoration: none;
  font-family: inherit;
}
.site-login-btn:hover {
  background: rgba(255,255,255,0.22);
}
.site-login-btn img {
  width: 22px;
  height: 22px;
  border-radius: 50%;
}
.site-login-dropdown {
  position: fixed;
  top: 46px;
  right: 16px;
  z-index: 9999;
  background: rgba(30,30,30,0.95);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  padding: 6px 0;
  display: none;
  min-width: 120px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
}
.site-login-dropdown.show {
  display: block;
}
.site-login-dropdown a {
  display: block;
  padding: 8px 16px;
  color: #eee;
  text-decoration: none;
  font-size: 13px;
}
.site-login-dropdown a:hover {
  background: rgba(255,255,255,0.1);
}
</style>
`;

const js = `
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

  function openLoginPopup() {
    var w = 450, h = 450;
    var left = (screen.width - w) / 2;
    var top = (screen.height - h) / 2;

    var popup = window.open(
      serverURL + '/ui/login?lng=en',
      '_blank',
      'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top +
      ',scrollbars=no,resizable=no,status=no,location=no,toolbar=no,menubar=no'
    );

    if (popup) {
      popup.postMessage({type: 'TOKEN', data: null}, '*');
    }

    var handler = function(event) {
      if (event.origin !== serverURL) return;
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type !== 'userInfo') return;
      if (event.data.data && event.data.data.token) {
        if (popup) popup.close();
        window.removeEventListener('message', handler);
        localStorage.setItem('WALINE_USER', JSON.stringify(event.data.data));
        location.reload();
      }
    };
    window.addEventListener('message', handler);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function render() {
    var existing = document.getElementById('site-login-container');
    if (existing) existing.remove();

    var container = document.createElement('div');
    container.id = 'site-login-container';
    var user = getUser();

    if (user) {
      var avatar = user.avatar || '';
      var safeAvatar = escapeHtml(avatar);
      var safeName = escapeHtml(user.display_name);
      var imgHtml = avatar ? '<img src="' + safeAvatar + '" alt="">' : '';
      container.innerHTML =
        '<button class="site-login-btn" id="site-login-toggle">' +
          imgHtml + safeName +
        '</button>' +
        '<div class="site-login-dropdown" id="site-login-dropdown">' +
          '<a href="' + serverURL + '/ui/profile" target="_blank">Profile</a>' +
          '<a href="#" id="site-logout-btn">Logout</a>' +
        '</div>';
      document.body.appendChild(container);

      document.getElementById('site-login-toggle').addEventListener('click', function(e) {
        e.stopPropagation();
        document.getElementById('site-login-dropdown').classList.toggle('show');
      });
      document.addEventListener('click', function() {
        var dd = document.getElementById('site-login-dropdown');
        if (dd) dd.classList.remove('show');
      });
      document.getElementById('site-logout-btn').addEventListener('click', function(e) {
        e.preventDefault();
        localStorage.removeItem('WALINE_USER');
        render();
        location.reload();
      });
    } else {
      container.innerHTML =
        '<button class="site-login-btn" id="site-login-btn">Login</button>';
      document.body.appendChild(container);
      document.getElementById('site-login-btn').addEventListener('click', openLoginPopup);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
</script>
`;

hexo.extend.injector.register('head_end', css, 'default');
hexo.extend.injector.register('body_end', js, 'default');
