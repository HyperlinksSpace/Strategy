(function () {
  'use strict';

  var LANG_KEY = 'hls-lang';
  var THEME_KEY = 'hls-theme';
  var SUPPORTED_LANGS = { en: true, ru: true, zh: true };

  function detectSystemLang() {
    var list = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || 'en'];

    for (var i = 0; i < list.length; i++) {
      var code = String(list[i]).toLowerCase().split('-')[0];
      if (SUPPORTED_LANGS[code]) return code;
    }
    return 'en';
  }

  function getLang() {
    return localStorage.getItem(LANG_KEY) || detectSystemLang();
  }

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'system';
  }

  function applyLang(lang, persist) {
    var dict = window.HLS_I18N[lang] || window.HLS_I18N.en;
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });

    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    if (persist) localStorage.setItem(LANG_KEY, lang);
  }

  function applyTheme(theme, persist) {
    document.documentElement.setAttribute('data-theme', theme);

    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
    });

    if (persist) localStorage.setItem(THEME_KEY, theme);
  }

  function initLangSwitch() {
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyLang(btn.getAttribute('data-lang'), true);
      });
    });
  }

  function initThemeSwitch() {
    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyTheme(btn.getAttribute('data-theme'), true);
      });
    });

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (getTheme() === 'system') applyTheme('system', false);
      });
    }
  }

  function closeMobileDrawer() {
    var drawer = document.getElementById('header-drawer');
    var toggle = document.querySelector('.menu-toggle');
    if (drawer) drawer.classList.remove('open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function initMobileMenu() {
    var toggle = document.querySelector('.menu-toggle');
    var drawer = document.getElementById('header-drawer');
    if (!toggle || !drawer) return;

    toggle.addEventListener('click', function () {
      var open = drawer.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });

    drawer.querySelectorAll('a, .theme-btn').forEach(function (el) {
      el.addEventListener('click', closeMobileDrawer);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMobileDrawer();
    });
  }

  function initScrollReveal() {
    var sections = document.querySelectorAll('.section, .hero-content, .hero-visual');
    sections.forEach(function (el) { el.classList.add('reveal'); });

    if (!('IntersectionObserver' in window)) {
      sections.forEach(function (el) { el.classList.add('visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    sections.forEach(function (el) { observer.observe(el); });
  }

  function initHeaderShadow() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    window.addEventListener('scroll', function () {
      header.style.boxShadow = window.scrollY > 20 ? 'var(--shadow)' : 'none';
    }, { passive: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyLang(getLang(), false);
    applyTheme(getTheme(), false);
    initLangSwitch();
    initThemeSwitch();
    initMobileMenu();
    initScrollReveal();
    initHeaderShadow();
  });
})();
