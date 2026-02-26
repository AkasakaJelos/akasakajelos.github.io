'use strict';

hexo.extend.filter.register('after_render:html', function (data) {
  // Fix visible text labels
  data = data.replace(/>Symbols count in article</g, '>Words: <');
  data = data.replace(/>Reading time</g, '>Read time: <');
  data = data.replace(/>words</g, '><');

  // Fix "mins." → "min" (in both post meta and footer)
  data = data.replace(/(\d+) mins\./g, '$1 min');

  // Fix tooltip titles
  data = data.replace(/title="Symbols count in article"/g, 'title="Word count"');
  data = data.replace(/title="Reading time"/g, 'title="Read time"');
  data = data.replace(/title="Symbols count total"/g, 'title="Total words"');
  data = data.replace(/title="Reading time total"/g, 'title="Total read time"');

  return data;
});
