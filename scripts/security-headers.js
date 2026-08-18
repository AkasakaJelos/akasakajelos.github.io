'use strict';

// Inject security meta tags into <head>.
//
// GitHub Pages serves no configurable response headers (verified: it returns only
// strict-transport-security), so a <meta http-equiv> CSP is the only lever available.
// Two consequences are baked into the choices below:
//
//   * frame-ancestors, report-uri and sandbox are ignored by browsers when the policy
//     is delivered via <meta>. Clickjacking is therefore handled by the frame-guard
//     script at the bottom of this file, not by CSP.
//   * X-Content-Type-Options is likewise only honoured as a real header. The meta tag
//     is kept because it costs nothing and some proxies/CDNs promote it to a header,
//     but it provides no protection on GitHub Pages today.
//
// 'unsafe-inline' stays in script-src/style-src on purpose: the theme emits inline
// event handlers (onload=, onclick=) and Hexo output is static, so nonces cannot be
// generated per response and hashes would not cover the attribute handlers.

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://s4.zstatic.net https://at.alicdn.com https://fonts.googleapis.com https://comment-akasakajelos-projects.vercel.app https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://s4.zstatic.net https://at.alicdn.com https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com https://at.alicdn.com https://s4.zstatic.net",
  "img-src 'self' data: https:",
  "connect-src 'self' https://comment-akasakajelos-projects.vercel.app https://fonts.googleapis.com",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'self'",
  // form-action is not covered by default-src, so without it a form injected into a
  // post could POST to an attacker-controlled endpoint.
  "form-action 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  'upgrade-insecure-requests'
].join('; ');

// Clickjacking defence, since neither frame-ancestors (meta) nor X-Frame-Options
// (no header control) apply here. localhost is exempt so `hexo server` previews and
// local iframe testing keep working.
const frameGuard = `<script>
(function(){
  try {
    if (window.top === window.self) return;
    if (/^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname)) return;
    document.documentElement.style.display = 'none';
    window.top.location = window.self.location.href;
  } catch (e) {
    document.documentElement.style.display = 'none';
  }
})();
</script>`;

const META = [
  '<meta http-equiv="Content-Security-Policy" content="' + CSP + '">',
  '<meta http-equiv="X-Content-Type-Options" content="nosniff">',
  '<meta name="referrer" content="strict-origin-when-cross-origin">',
  frameGuard
].join('\n    ');

hexo.extend.filter.register('after_render:html', function (data) {
  if (data.indexOf('http-equiv="Content-Security-Policy"') !== -1) return data;

  // The CSP must land inside <head> and, per spec, within the first 1024 bytes of the
  // document for the charset declaration to stay valid. Anchoring on a single literal
  // string meant a theme upgrade could silently drop the policy, so fall back through
  // progressively looser anchors and warn loudly if none match.
  const charset = data.match(/<meta[^>]+charset=[^>]*>/i);
  if (charset) {
    return data.replace(charset[0], charset[0] + '\n    ' + META);
  }

  const head = data.match(/<head[^>]*>/i);
  if (head) {
    return data.replace(head[0], head[0] + '\n    ' + META);
  }

  hexo.log.warn('[security-headers] no <head> or charset meta found; security meta tags were NOT injected');
  return data;
});
