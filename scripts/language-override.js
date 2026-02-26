'use strict';

hexo.extend.filter.register('after_init', function () {
  const i18n = hexo.theme.i18n;
  const lang = 'en';
  const data = i18n.get(lang) || {};

  data['symbols_count_time'] = Object.assign(data['symbols_count_time'] || {}, {
    count: 'Words: ',
    count_total: 'Total words: ',
    time: 'Read time: ',
    time_total: 'Total read time: ',
    time_minutes: 'min',
    word: '',
    view: 'views'
  });

  i18n.set(lang, data);
});
