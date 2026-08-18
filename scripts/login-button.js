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
        if (parsed && parsed.display_name) {
          if (parsed._expires && Date.now() > parsed._expires) {
            localStorage.removeItem('WALINE_USER');
            return null;
          }
          return parsed;
        }
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
      popup.postMessage({type: 'TOKEN', data: null}, serverURL);
    }

    var handler = function(event) {
      if (event.origin !== serverURL) return;
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type !== 'userInfo') return;
      if (event.data.data && event.data.data.token) {
        if (popup) popup.close();
        window.removeEventListener('message', handler);
        var userData = {
          token: String(event.data.data.token),
          display_name: String(event.data.data.display_name || ''),
          avatar: String(event.data.data.avatar || ''),
          _expires: Date.now() + (7 * 24 * 60 * 60 * 1000)
        };
        localStorage.setItem('WALINE_USER', JSON.stringify(userData));
        location.reload();
      }
    };
    window.addEventListener('message', handler);
  }

  // Only http(s) and inline image data URLs may reach an <img src>.
  // Rejects javascript:, vbscript:, and other scheme-based payloads.
  function safeImageUrl(raw) {
    if (!raw) return '';
    try {
      var parsed = new URL(raw, location.href);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
      if (parsed.protocol === 'data:' && /^data:image\//i.test(parsed.href)) return parsed.href;
    } catch (e) {}
    return '';
  }

  function render() {
    var existing = document.getElementById('site-login-container');
    if (existing) existing.remove();

    var container = document.createElement('div');
    container.id = 'site-login-container';
    var user = getUser();

    if (user) {
      // Built with DOM APIs rather than innerHTML: display_name and avatar are
      // attacker-influencable, and string interpolation into an attribute lets a
      // quote in the value break out and inject event handlers.
      var toggle = document.createElement('button');
      toggle.className = 'site-login-btn';
      toggle.id = 'site-login-toggle';

      var avatarUrl = safeImageUrl(user.avatar);
      if (avatarUrl) {
        var img = document.createElement('img');
        img.setAttribute('src', avatarUrl);
        img.setAttribute('alt', '');
        toggle.appendChild(img);
      }
      toggle.appendChild(document.createTextNode(user.display_name));

      var dropdown = document.createElement('div');
      dropdown.className = 'site-login-dropdown';
      dropdown.id = 'site-login-dropdown';

      var profile = document.createElement('a');
      profile.setAttribute('href', serverURL + '/ui/profile');
      profile.setAttribute('target', '_blank');
      profile.setAttribute('rel', 'noopener noreferrer');
      profile.appendChild(document.createTextNode('Profile'));

      var logout = document.createElement('a');
      logout.setAttribute('href', '#');
      logout.id = 'site-logout-btn';
      logout.appendChild(document.createTextNode('Logout'));

      dropdown.appendChild(profile);
      dropdown.appendChild(logout);
      container.appendChild(toggle);
      container.appendChild(dropdown);
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
