'use strict';

// Inject security meta tags into <head>
// Note: On GitHub Pages, only meta-tag-based headers work (no server config)
hexo.extend.filter.register('after_render:html', function (data) {
  const meta = [
    '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' https://s4.zstatic.net https://at.alicdn.com https://fonts.googleapis.com https://comment-exk1qlg3v-akasakajelos-projects.vercel.app https://challenges.cloudflare.com; style-src \'self\' \'unsafe-inline\' https://s4.zstatic.net https://at.alicdn.com https://fonts.googleapis.com; font-src \'self\' https://fonts.gstatic.com https://at.alicdn.com https://s4.zstatic.net; img-src \'self\' data: https:; connect-src \'self\' https://comment-exk1qlg3v-akasakajelos-projects.vercel.app https://fonts.googleapis.com; frame-src https://challenges.cloudflare.com; object-src \'none\'; base-uri \'self\'">',
    '<meta http-equiv="X-Content-Type-Options" content="nosniff">',
    '<meta name="referrer" content="strict-origin-when-cross-origin">'
  ].join('\n    ');

  return data.replace('<meta charset="UTF-8"/>', '<meta charset="UTF-8"/>\n    ' + meta);
});
