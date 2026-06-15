(function () {
  'use strict';

  var hosts = [];
  var raf = 0;
  var shimmer = 0;
  var reducedMotion = false;

  function getQuality() {
    return window.HLS && window.HLS.getQuality ? window.HLS.getQuality() : { lite: false };
  }

  function ensureLayers(el) {
    if (el.querySelector('.liquid-glass-lens')) return;
    var lens = document.createElement('div');
    lens.className = 'liquid-glass-lens';
    lens.setAttribute('aria-hidden', 'true');
    var sheen = document.createElement('div');
    sheen.className = 'liquid-glass-sheen';
    sheen.setAttribute('aria-hidden', 'true');
    var rim = document.createElement('div');
    rim.className = 'liquid-glass-rim';
    rim.setAttribute('aria-hidden', 'true');
    el.insertBefore(rim, el.firstChild);
    el.insertBefore(sheen, el.firstChild);
    el.insertBefore(lens, el.firstChild);
  }

  function initHost(el) {
    if (!el || el.dataset.lgInit === '1') return;
    el.dataset.lgInit = '1';
    ensureLayers(el);
    if (hosts.indexOf(el) === -1) hosts.push(el);
  }

  function initAllHosts() {
    document.querySelectorAll('.liquid-glass-host, .liquid-glass-pill, .nav-dropdown-panel.liquid-glass-pillow').forEach(initHost);
  }

  function setPointer(el, clientX, clientY) {
    var rect = el.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return;
    }
    var x = ((clientX - rect.left) / rect.width) * 100;
    var y = ((clientY - rect.top) / rect.height) * 100;
    el.style.setProperty('--lg-x', x.toFixed(1) + '%');
    el.style.setProperty('--lg-y', y.toFixed(1) + '%');
    el.style.setProperty('--lg-intensity', '1');
  }

  function onPointerMove(e) {
    var x = e.clientX;
    var y = e.clientY;
    hosts.forEach(function (host) {
      setPointer(host, x, y);
    });
  }

  function onPointerLeave() {
    hosts.forEach(function (host) {
      host.style.setProperty('--lg-intensity', '0.35');
      host.style.setProperty('--lg-x', '50%');
      host.style.setProperty('--lg-y', '28%');
    });
  }

  function tick() {
    if (!reducedMotion && !getQuality().lite) {
      shimmer += 0.0035;
      hosts.forEach(function (host) {
        host.style.setProperty('--lg-shimmer', String(shimmer));
      });
    }
    raf = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (raf || reducedMotion) return;
    raf = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function initStripCenter() {
    var strip = document.querySelector('.section-strip');
    if (!strip) return;

    function sync() {
      if (strip.scrollWidth <= strip.clientWidth + 2) {
        strip.classList.add('is-centered');
      } else {
        strip.classList.remove('is-centered');
      }
    }

    sync();
    window.addEventListener('resize', sync, { passive: true });
    window.addEventListener('hls:locale-change', function () {
      setTimeout(sync, 80);
    });
  }

  function init() {
    reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    initAllHosts();
    initStripCenter();

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);

    window.addEventListener('hls:theme-applied', initAllHosts);
    window.addEventListener('hls:locale-change', function () {
      setTimeout(initAllHosts, 50);
    });

    if (!reducedMotion) startLoop();

    window.HLS = window.HLS || {};
    window.HLS.refreshLiquidGlass = initAllHosts;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
