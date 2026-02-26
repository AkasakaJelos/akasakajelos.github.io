'use strict';

const turnstileCss = `
<style>
.wl-captcha-container {
  transition: opacity 0.3s, max-height 0.3s;
  overflow: hidden;
}
.wl-captcha-container.verified {
  opacity: 0;
  max-height: 0 !important;
  pointer-events: none;
  margin: 0 !important;
  padding: 0 !important;
}
</style>
`;

const turnstileJs = `
<script>
(function() {
  function checkAndHide() {
    // Turnstile adds a response input when verified
    var inputs = document.querySelectorAll('input[name="cf-turnstile-response"]');
    inputs.forEach(function(input) {
      if (input.value && input.value.length > 0) {
        var container = input.closest('.wl-captcha-container') || input.parentElement;
        if (container && !container.classList.contains('verified')) {
          container.classList.add('verified');
        }
      }
    });

    // Also check for any Turnstile iframes that have completed
    var iframes = document.querySelectorAll('iframe[src*="turnstile"], iframe[src*="cloudflare"]');
    iframes.forEach(function(iframe) {
      var container = iframe.closest('.wl-captcha-container') || iframe.parentElement;
      if (container) {
        var responseInput = container.querySelector('input[type="hidden"]');
        if (responseInput && responseInput.value && responseInput.value.length > 10) {
          if (!container.classList.contains('verified')) {
            container.classList.add('verified');
          }
        }
      }
    });
  }

  setInterval(checkAndHide, 500);
  document.addEventListener('pjax:complete', function() {
    setTimeout(checkAndHide, 1000);
  });
})();
</script>
`;

hexo.extend.injector.register('head_end', turnstileCss, 'default');
hexo.extend.injector.register('body_end', turnstileJs, 'default');
