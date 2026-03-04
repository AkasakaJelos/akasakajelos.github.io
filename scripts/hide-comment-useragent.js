'use strict';

const hideUserAgentCss = `
<style>
.wl-meta > .wl-browser,
.wl-meta > .wl-os {
  display: none !important;
}
</style>
`;

hexo.extend.injector.register('head_end', hideUserAgentCss, 'default');
