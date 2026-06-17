(function () {
  'use strict';

  var pending = Object.create(null);

  function loadLocalePack(lang) {
    if (!lang || lang === 'en') return Promise.resolve();
    if (window.HLS_I18N && window.HLS_I18N[lang]) return Promise.resolve();
    if (pending[lang]) return pending[lang];

    pending[lang] = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'js/i18n-' + lang + '.js';
      s.async = true;
      s.onload = function () {
        delete pending[lang];
        resolve();
      };
      s.onerror = function () {
        delete pending[lang];
        resolve();
      };
      document.head.appendChild(s);
    });

    return pending[lang];
  }

  function bootLocale() {
    var lang = window.HLS && window.HLS.getLang ? window.HLS.getLang() : (
      document.documentElement.lang || 'en'
    );
    if (lang !== 'en') loadLocalePack(lang);
  }

  window.HLS = window.HLS || {};
  window.HLS.loadLocalePack = loadLocalePack;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootLocale);
  } else {
    bootLocale();
  }
})();
