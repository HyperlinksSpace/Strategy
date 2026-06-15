/**
 * Shared locale helpers — single source of truth for active language.
 */
(function () {
  'use strict';

  var LANG_KEY = 'hls-lang';
  var SUPPORTED = { en: true, ru: true, zh: true };

  function detectSystemLang() {
    var list = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || 'en'];

    for (var i = 0; i < list.length; i++) {
      var code = String(list[i]).toLowerCase().split('-')[0];
      if (SUPPORTED[code]) return code;
    }
    return 'en';
  }

  window.HLS = window.HLS || {};

  window.HLS.getLang = function () {
    var htmlLang = document.documentElement && document.documentElement.lang;
    if (htmlLang && window.HLS_I18N && window.HLS_I18N[htmlLang]) return htmlLang;

    var stored = localStorage.getItem(LANG_KEY);
    if (stored && window.HLS_I18N && window.HLS_I18N[stored]) return stored;

    return detectSystemLang();
  };

  window.HLS.t = function (key, vars, lang) {
    lang = lang || window.HLS.getLang();
    var dict = (window.HLS_I18N && window.HLS_I18N[lang]) || window.HLS_I18N.en;
    var text = (dict && dict[key]) || (window.HLS_I18N.en && window.HLS_I18N.en[key]) || key;

    if (vars) {
      Object.keys(vars).forEach(function (k) {
        text = text.split('{' + k + '}').join(vars[k]);
      });
    }
    return text;
  };
})();
