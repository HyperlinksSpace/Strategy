(function () {
  'use strict';

  var activePage = null;

  function getSettings() {
    return window.HLS_SETTINGS || {};
  }

  function buildLinks(links) {
    if (!links || !links.length) return '<span class="hub-card-no-link">In development</span>';
    return links.map(function (link) {
      return '<a href="' + link.url + '" target="_blank" rel="noopener noreferrer">' + link.label + ' ↗</a>';
    }).join('');
  }

  function renderHubPage(id) {
    var settings = getSettings();
    var container = document.getElementById('hub-pages');
    if (!container) return;

    var html = '';
    var title = '';
    var subtitle = '';

    if (id === 'products') {
      title = 'Products';
      subtitle = 'Live and in-development products from Hyperlinks Space';
      html = settings.products.map(function (p) {
        return (
          '<article class="hub-card">' +
            '<div class="hub-card-head">' +
              '<h3>' + p.name + '</h3>' +
              '<span class="hub-card-tag">' + p.tagline + '</span>' +
            '</div>' +
            '<p>' + p.description + '</p>' +
            '<div class="hub-card-links">' + buildLinks(p.links) + '</div>' +
          '</article>'
        );
      }).join('');
    } else if (id === 'research') {
      title = 'Research';
      subtitle = 'Active research directions across the GitHub organization';
      html = settings.research.map(function (r) {
        return (
          '<article class="hub-card">' +
            '<div class="hub-card-head"><h3>' + r.name + '</h3></div>' +
            '<p>' + r.description + '</p>' +
            '<div class="hub-card-links">' + buildLinks(r.links) + '</div>' +
          '</article>'
        );
      }).join('');
    } else if (id === 'tech') {
      title = 'Technologies';
      subtitle = 'Stack we ship today and protocols we are building toward';
      html = '<h3 class="hub-section-label">In production</h3>' +
        settings.tech.existing.map(function (t) {
          return (
            '<article class="hub-card hub-card--tech">' +
              '<div class="hub-card-head"><h3>' + t.name + '</h3></div>' +
              '<p>' + t.description + '</p>' +
              '<div class="hub-card-links">' + buildLinks(t.links) + '</div>' +
            '</article>'
          );
        }).join('') +
        '<h3 class="hub-section-label hub-section-label--planned">Roadmap · aiming to build</h3>' +
        settings.tech.planned.map(function (t) {
          return (
            '<article class="hub-card hub-card--planned">' +
              '<div class="hub-card-head"><h3>' + t.name + '</h3><span class="hub-card-badge">Planned</span></div>' +
              '<p>' + t.description + '</p>' +
            '</article>'
          );
        }).join('');
    }

    container.innerHTML =
      '<div class="hub-page" data-hub="' + id + '">' +
        '<header class="hub-page-header">' +
          '<button type="button" class="hub-close" aria-label="Close">&times;</button>' +
          '<h2>' + title + '</h2>' +
          '<p>' + subtitle + '</p>' +
        '</header>' +
        '<div class="hub-page-grid">' + html + '</div>' +
      '</div>';

    container.querySelector('.hub-close').addEventListener('click', closeHub);
  }

  function openHub(id) {
    renderHubPage(id);
    var overlay = document.getElementById('hub-overlay');
    if (!overlay) return;
    var panel = document.getElementById('header-panel');
    if (panel) panel.classList.remove('open');
    var toggle = document.querySelector('.menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    overlay.hidden = false;
    overlay.classList.add('is-open');
    activePage = id;
    document.body.classList.add('hub-open');
    var first = overlay.querySelector('.hub-close');
    if (first) first.focus();
  }

  function closeHub() {
    var overlay = document.getElementById('hub-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.hidden = true;
    activePage = null;
    document.body.classList.remove('hub-open');
  }

  function applySettingsToDom() {
    var s = getSettings().promo;
    if (!s) return;

    var badge = document.querySelector('[data-settings="promo.badge"]');
    var title = document.querySelector('[data-settings="promo.title"]');
    var desc = document.querySelector('[data-settings="promo.desc"]');
    var url = document.querySelector('[data-settings="promo.url"]');
    var headerLink = document.querySelector('[data-settings="promo.headerLink"]');

    if (badge && s.badge) badge.textContent = s.badge;
    if (title && s.title) title.textContent = s.title;
    if (desc && s.description) desc.textContent = s.description;
    if (url && s.urlLabel) url.textContent = s.urlLabel;
    if (headerLink && s.headerLabel) headerLink.textContent = s.headerLabel;

    document.querySelectorAll('[data-settings-href="promo.url"]').forEach(function (el) {
      if (s.url) el.href = s.url;
    });

    var features = document.querySelector('.promo-features');
    if (features && s.features) {
      features.innerHTML = s.features.map(function (f) {
        return '<li>' + f + '</li>';
      }).join('');
    }
  }

  function initHeaderNav() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-hub]');
      if (!btn || btn.tagName === 'A') return;
      e.preventDefault();
      openHub(btn.getAttribute('data-hub'));
    });
  }

  function initOverlay() {
    var overlay = document.getElementById('hub-overlay');
    if (!overlay) return;

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeHub();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && activePage) closeHub();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    applySettingsToDom();
    initHeaderNav();
    initOverlay();
  });

  window.HLS = window.HLS || {};
  window.HLS.openHub = openHub;
  window.HLS.closeHub = closeHub;
})();
