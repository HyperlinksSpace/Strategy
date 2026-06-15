(function () {
  'use strict';

  var LANG_KEY = 'hls-lang';
  var THEME_KEY = 'hls-theme';

  function getLang() {
    return localStorage.getItem(LANG_KEY) || 'en';
  }

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'system';
  }

  function applyLang(lang) {
    var dict = window.HLS_I18N[lang] || window.HLS_I18N.en;
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });

    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    localStorage.setItem(LANG_KEY, lang);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
    });

    localStorage.setItem(THEME_KEY, theme);
  }

  function initLangSwitch() {
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyLang(btn.getAttribute('data-lang'));
      });
    });
  }

  function initThemeSwitch() {
    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyTheme(btn.getAttribute('data-theme'));
      });
    });

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (getTheme() === 'system') applyTheme('system');
      });
    }
  }

  function initMobileMenu() {
    var toggle = document.querySelector('.menu-toggle');
    var nav = document.querySelector('.nav-main');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
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
    applyLang(getLang());
    applyTheme(getTheme());
    initLangSwitch();
    initThemeSwitch();
    initMobileMenu();
    initScrollReveal();
    initHeaderShadow();
  });
})();
