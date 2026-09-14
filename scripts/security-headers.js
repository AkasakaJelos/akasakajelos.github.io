'use strict';

const crypto = require('crypto');

// Inject security meta tags into <head>.
//
// GitHub Pages serves no configurable response headers (verified: it returns only
// strict-transport-security), so a <meta http-equiv> CSP is the only lever available.
// Two consequences are baked into the choices below:
//
//   * frame-ancestors, report-uri and sandbox are ignored by browsers when the policy
//     is delivered via <meta>. Clickjacking is therefore handled by the frame-guard
//     script, not by CSP.
//   * X-Content-Type-Options is likewise only honoured as a real header. The meta tag
//     is kept because it costs nothing and some proxies/CDNs promote it to a header,
//     but it provides no protection on GitHub Pages today.
//
// script-src does NOT use 'unsafe-inline'. Every inline <script> is hashed at build
// time instead. That is only sound because Hexo runs injectors before
// after_render:html filters:
//
//     view.render(locals)
//       .then(result => ctx.extend.injector.exec(result, locals))
//       .then(result => ctx.execFilter('_after_html_render', result, ...))
//                                              -- hexo/dist/hexo/index.js
//
// so by the time this filter runs the document already contains every inline script
// the page will ever ship. The filter is registered at priority 100 (hexo sorts
// ascending, default 10) so it also runs after the other after_render:html filters
// in this directory. Both scripts this file contributes go through the injector for
// the same reason -- anything appended after hashing would be blocked by its own policy.
//
// style-src keeps 'unsafe-inline': the theme emits ~150 per-element style="..."
// attributes for post cover images. Attribute styles cannot be hashed, and
// style-src-attr is not available via <meta>. Style injection is a far weaker
// primitive than script injection, so this is an accepted residual.

const SCRIPT_HOSTS = [
  "'self'",
  'https://s4.zstatic.net',
  'https://at.alicdn.com',
  'https://comment-akasakajelos-projects.vercel.app',
  'https://challenges.cloudflare.com'
];

// img-src keeps https: because commenter avatars are fetched at runtime from
// whichever host Waline resolves them to; pinning it would break avatars.
function buildCSP (scriptHashes) {
  return [
    "default-src 'self'",
    'script-src ' + SCRIPT_HOSTS.concat(scriptHashes).join(' '),
    "style-src 'self' 'unsafe-inline' https://s4.zstatic.net https://at.alicdn.com https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://at.alicdn.com https://s4.zstatic.net",
    "img-src 'self' data: https:",
    "connect-src 'self' https://comment-akasakajelos-projects.vercel.app https://fonts.googleapis.com",
    'frame-src https://challenges.cloudflare.com',
    "frame-ancestors 'self'",
    // form-action is not covered by default-src, so without it a form injected into a
    // post could POST to an attacker-controlled endpoint.
    "form-action 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    'upgrade-insecure-requests'
  ].join('; ');
}

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

// Replaces the inline event handlers stripped by HANDLER_REWRITES below. Inline
// handlers are unreachable under a hash-based script-src, so the behaviour has to be
// reattached from a script that is itself hashed.
const cspCompat = `<script>
(function(){
  function applyAsyncCss() {
    var links = document.querySelectorAll('link[data-css-async]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].media !== 'all') links[i].media = 'all';
    }
  }
  function suppressNoop(e) {
    var t = e.target;
    if (t && t.closest && t.closest('[data-noop]')) e.preventDefault();
  }
  try {
    // Run immediately and again later: stylesheets that are still parsing when this
    // executes would otherwise stay at media="none" and never paint.
    applyAsyncCss();
    document.addEventListener('DOMContentLoaded', applyAsyncCss);
    window.addEventListener('load', applyAsyncCss);
    document.addEventListener('pjax:complete', applyAsyncCss);
    document.addEventListener('click', suppressNoop, true);
  } catch (e) {}
})();
</script>`;

const HANDLER_REWRITES = [
  // Theme's non-blocking CSS pattern: media="none" onload="this.media='all'".
  // Hexo HTML-escapes the attribute on most pages, so both forms are matched.
  [/\sonload="this\.media(?:=|&#x3D;)(?:'|&#39;)all(?:'|&#39;)"/gi, ' data-css-async'],
  // Placeholder anchors whose handler only suppresses navigation.
  [/\sonclick="return false;"/gi, ' data-noop']
];

const SCRIPT_TAG = /<script([^>]*)>([\s\S]*?)<\/script>/gi;

// Scripts with src= are already covered by the host allowlist. Non-JS <script>
// blocks (e.g. application/ld+json) are data, never executed, and need no hash.
function isExecutableInline (attrs) {
  if (/\ssrc\s*=/i.test(attrs)) return false;
  const type = attrs.match(/\stype\s*=\s*["']?([^"'\s>]+)/i);
  if (!type) return true;
  const value = type[1].toLowerCase();
  return value === 'module' || value === 'text/javascript' || value === 'application/javascript';
}

function collectHashes (html) {
  const hashes = new Set();
  let match;
  SCRIPT_TAG.lastIndex = 0;
  while ((match = SCRIPT_TAG.exec(html)) !== null) {
    if (!isExecutableInline(match[1])) continue;
    hashes.add("'sha256-" + crypto.createHash('sha256').update(match[2], 'utf8').digest('base64') + "'");
  }
  return Array.from(hashes);
}

hexo.extend.injector.register('head_end', frameGuard, 'default');
hexo.extend.injector.register('head_end', cspCompat, 'default');

hexo.extend.filter.register('after_render:html', function (data) {
  if (data.indexOf('http-equiv="Content-Security-Policy"') !== -1) return data;

  for (const [pattern, replacement] of HANDLER_REWRITES) {
    data = data.replace(pattern, replacement);
  }

  // A handler this file does not know about would silently stop firing once
  // 'unsafe-inline' is gone. Fail loudly at build time instead of shipping it.
  const leftover = data.replace(SCRIPT_TAG, '').match(/\son[a-z]+\s*=\s*["']/gi);
  if (leftover) {
    const kinds = Array.from(new Set(leftover.map(s => s.trim()))).join(', ');
    hexo.log.warn('[security-headers] inline event handlers remain (' + kinds +
      ') and will be blocked by CSP; add a rewrite rule for them');
  }

  const META = [
    '<meta http-equiv="Content-Security-Policy" content="' + buildCSP(collectHashes(data)) + '">',
    '<meta http-equiv="X-Content-Type-Options" content="nosniff">',
    '<meta name="referrer" content="strict-origin-when-cross-origin">'
  ].join('\n    ');

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
}, 100);
