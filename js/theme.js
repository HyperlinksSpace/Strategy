(function () {
  'use strict';

  function isTelegramWebView() {
    if (/Telegram/i.test(navigator.userAgent || '')) return true;
    try {
      return !!(window.Telegram && window.Telegram.WebApp);
    } catch (e) {
      return false;
    }
  }

  function resolveSystemTheme() {
    if (isTelegramWebView()) {
      try {
        var tgScheme = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.colorScheme;
        if (tgScheme === 'light' || tgScheme === 'dark') return tgScheme;
      } catch (e) { /* ignore */ }
      return 'dark';
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  function resolveTheme(preference) {
    if (preference === 'light' || preference === 'dark') return preference;
    return resolveSystemTheme();
  }

  function applyThemePreference(preference) {
    var pref = preference || 'system';
    var resolved = resolveTheme(pref);
    document.documentElement.setAttribute('data-theme-pref', pref);
    document.documentElement.setAttribute('data-theme', resolved);
    return resolved;
  }

  function isLightTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  function getThemePreference() {
    return document.documentElement.getAttribute('data-theme-pref') || 'system';
  }

  window.HLS = window.HLS || {};
  window.HLS.isTelegramWebView = isTelegramWebView;
  window.HLS.resolveSystemTheme = resolveSystemTheme;
  window.HLS.resolveTheme = resolveTheme;
  window.HLS.applyThemePreference = applyThemePreference;
  window.HLS.isLightTheme = isLightTheme;
  window.HLS.isDarkTheme = function () { return !isLightTheme(); };
  window.HLS.getThemePreference = getThemePreference;
})();
