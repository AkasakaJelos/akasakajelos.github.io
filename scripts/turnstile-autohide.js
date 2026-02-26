'use strict';

const turnstileJs = `
<script>
(function() {
  function hideTurnstile() {
    var widgets = document.querySelectorAll('.wl-captcha-container iframe, .wl-captcha-container > div');
    widgets.forEach(function(w) {
      var parent = w.closest('.wl-captcha-container') || w.parentElement;
      if (parent && parent.textContent && parent.textContent.indexOf('Success') !== -1) {
        parent.style.transition = 'opacity 0.3s';
        parent.style.opacity = '0';
        setTimeout(function() { parent.style.display = 'none'; }, 300);
      }
    });

    // Also check for standalone Turnstile response divs
    document.querySelectorAll('[id^="cf-chl"]').forEach(function(el) {
      var container = el.closest('div');
      if (container && container.offsetHeight > 0) {
        var text = container.textContent || '';
        if (text.indexOf('Success') !== -1) {
          container.style.transition = 'opacity 0.3s';
          container.style.opacity = '0';
          setTimeout(function() { container.style.display = 'none'; }, 300);
        }
      }
    });
  }

  // Poll for success state
  var observer = new MutationObserver(function() {
    hideTurnstile();
  });

  function startObserving() {
    var target = document.getElementById('comments') || document.body;
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    // Also poll periodically as fallback
    setInterval(hideTurnstile, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserving);
  } else {
    startObserving();
  }
})();
</script>
`;

hexo.extend.injector.register('body_end', turnstileJs, 'default');
