(function () {
  'use strict';

  var openId = null;
  var container = null;

  function getSettings() {
    return window.HLS_SETTINGS || {};
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildLinks(links) {
    if (!links || !links.length) {
      return '<span class="nav-dd-no-link">In development</span>';
    }
    return links.map(function (link) {
      return '<a class="nav-dd-link" href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(link.label) + ' <span aria-hidden="true">↗</span></a>';
    }).join('');
  }

  function renderDropdown(id, title, subtitle, bodyHtml) {
    return (
      '<div class="nav-dropdown" id="dropdown-' + id + '" data-dropdown-panel="' + id + '" hidden>' +
        '<div class="nav-dropdown-panel glass">' +
          '<header class="nav-dropdown-head">' +
            '<h2>' + escapeHtml(title) + '</h2>' +
            '<p>' + escapeHtml(subtitle) + '</p>' +
          '</header>' +
          '<div class="nav-dropdown-scroll">' + bodyHtml + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function buildDropdowns() {
    var s = getSettings();
    var root = document.getElementById('nav-dropdowns');
    if (!root) return;

    var productsHtml = (s.products || []).map(function (p) {
      return (
        '<article class="nav-dd-card">' +
          '<div class="nav-dd-card-head">' +
            '<h3>' + escapeHtml(p.name) + '</h3>' +
            '<span class="nav-dd-tag">' + escapeHtml(p.tagline) + '</span>' +
          '</div>' +
          '<p>' + escapeHtml(p.description) + '</p>' +
          '<div class="nav-dd-links">' + buildLinks(p.links) + '</div>' +
        '</article>'
      );
    }).join('');

    var researchHtml = (s.research || []).map(function (r) {
      return (
        '<article class="nav-dd-card">' +
          '<h3>' + escapeHtml(r.name) + '</h3>' +
          '<p>' + escapeHtml(r.description) + '</p>' +
          '<div class="nav-dd-links">' + buildLinks(r.links) + '</div>' +
        '</article>'
      );
    }).join('');

    var techExisting = (s.tech && s.tech.existing || []).map(function (t) {
      return (
        '<article class="nav-dd-card">' +
          '<h3>' + escapeHtml(t.name) + '</h3>' +
          '<p>' + escapeHtml(t.description) + '</p>' +
          '<div class="nav-dd-links">' + buildLinks(t.links) + '</div>' +
        '</article>'
      );
    }).join('');

    var techPlanned = (s.tech && s.tech.planned || []).map(function (t) {
      return (
        '<article class="nav-dd-card nav-dd-card--planned">' +
          '<div class="nav-dd-card-head">' +
            '<h3>' + escapeHtml(t.name) + '</h3>' +
            '<span class="nav-dd-badge">Roadmap</span>' +
          '</div>' +
          '<p>' + escapeHtml(t.description) + '</p>' +
        '</article>'
      );
    }).join('');

    var intros = s.dropdownIntros || {};

    root.innerHTML =
      renderDropdown('products', 'Products', intros.products || 'Shipped platforms for Earth markets and the path to interplanetary infrastructure.', productsHtml) +
      renderDropdown('research', 'Research', intros.research || 'R&D aligned with protocol-first strategy — from TON rails to edge AI and deep-space networking.', researchHtml) +
      renderDropdown('tech', 'Technologies', intros.tech || 'Production stack today and hardened protocols we are building for industrial and orbital scale.', (
        '<p class="nav-dd-section">In production</p>' + techExisting +
        '<p class="nav-dd-section nav-dd-section--planned">Building toward</p>' + techPlanned
      ));
  }

  function closeDropdowns() {
    openId = null;
    document.querySelectorAll('[data-dropdown-panel]').forEach(function (panel) {
      panel.hidden = true;
    });
    document.querySelectorAll('[data-dropdown]').forEach(function (btn) {
      btn.setAttribute('aria-expanded', 'false');
      btn.classList.remove('is-open');
    });
    document.body.classList.remove('nav-dropdown-open');
  }

  function openDropdown(id) {
    if (openId === id) {
      closeDropdowns();
      return;
    }
    closeDropdowns();
    var panel = document.getElementById('dropdown-' + id);
    var btn = document.querySelector('[data-dropdown="' + id + '"]');
    if (!panel || !btn) return;

    var headerPanel = document.getElementById('header-panel');
    if (headerPanel) headerPanel.classList.remove('open');
    var toggle = document.querySelector('.menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');

    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    btn.classList.add('is-open');
    openId = id;
    document.body.classList.add('nav-dropdown-open');
  }

  function initTriggers() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-dropdown]');
      if (btn) {
        e.preventDefault();
        openDropdown(btn.getAttribute('data-dropdown'));
        return;
      }

      if (openId && !e.target.closest('.nav-dropdown-panel') && !e.target.closest('[data-dropdown]')) {
        closeDropdowns();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openId) closeDropdowns();
    });
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
        return '<li>' + escapeHtml(f) + '</li>';
      }).join('');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    buildDropdowns();
    applySettingsToDom();
    initTriggers();
  });

  window.HLS = window.HLS || {};
  window.HLS.closeNavDropdowns = closeDropdowns;
})();
