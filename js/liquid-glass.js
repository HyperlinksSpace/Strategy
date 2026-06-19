(function () {
  'use strict';

  var hosts = [];
  var reducedMotion = false;
  var pointerBound = false;
  var pendingPointer = null;
  var pointerActive = false;
  var pointerIdleTimer = 0;
  var driftStart = performance.now();
  var driftRaf = 0;

  function getQuality() {
    return window.HLS && window.HLS.getQuality ? window.HLS.getQuality() : { lite: true };
  }

  function layerNames() {
    return [
      'liquid-glass-caustics',
      'liquid-glass-dispersion',
      'liquid-glass-chroma',
      'liquid-glass-iridescent',
      'liquid-glass-specular',
      'liquid-glass-sheen',
      'liquid-glass-lens',
      'liquid-glass-rim'
    ];
  }

  function ensureLayers(el) {
    if (el.querySelector('.liquid-glass-lens')) return;

    var isHeader = el.classList.contains('site-header');
    var isStrip = el.classList.contains('section-strip');
    var chroma = null;
    var dispersion = null;
    var i;
    var layer;
    var order = ['caustics', 'iridescent', 'specular', 'sheen', 'lens', 'rim'];

    if (isHeader) {
      chroma = document.createElement('div');
      chroma.className = 'liquid-glass-chroma';
      chroma.setAttribute('aria-hidden', 'true');

      dispersion = document.createElement('div');
      dispersion.className = 'liquid-glass-dispersion';
      dispersion.setAttribute('aria-hidden', 'true');
    }

    for (i = 0; i < order.length; i++) {
      layer = document.createElement('div');
      layer.className = 'liquid-glass-' + order[i];
      layer.setAttribute('aria-hidden', 'true');
      el.insertBefore(layer, el.firstChild);
    }

    if (dispersion) el.insertBefore(dispersion, el.firstChild);
    if (chroma) el.insertBefore(chroma, el.firstChild);

    el.classList.add('liquid-glass-host');
    if (isStrip) el.classList.add('liquid-glass-strip');
    if (!el.dataset.lgPhase) {
      el.dataset.lgPhase = String(Math.random() * 6.28);
    }
    if (!el.dataset.lgSpeed) {
      el.dataset.lgSpeed = String(0.82 + Math.random() * 0.36);
    }
  }

  function initHost(el) {
    if (!el || el.dataset.lgInit === '1') return;
    el.dataset.lgInit = '1';
    ensureLayers(el);
    if (hosts.indexOf(el) === -1) hosts.push(el);
  }

  function hostSelector() {
    return '.site-header.glass-pillow, .section-strip.glass-pillow, .presentation-stop.glass-pillow, .nav-dropdown-panel.liquid-glass-pillow, .liquid-glass-pill';
  }

  function initAllHosts() {
    document.querySelectorAll(hostSelector()).forEach(initHost);
    syncPointerBinding();
    syncHeaderChromaJob();
    syncDriftJob();
  }

  function headerOverHero() {
    var hero = document.getElementById('hero');
    if (!hero) return false;
    var rect = hero.getBoundingClientRect();
    return rect.top < 96 && rect.bottom > 48;
  }

  function syncHeaderChroma() {
    var header = document.querySelector('.site-header.liquid-glass-host');
    if (!header) return;
    var over = headerOverHero();
    header.classList.toggle('header-over-hero', over);
    header.style.setProperty('--lg-hero-proximity', over ? '1' : '0');
  }

  function syncHeaderChromaJob() {
    if (!window.HLS || !window.HLS.raf) return;
    window.HLS.raf.remove('header-chroma');
    var header = document.querySelector('.site-header.glass-pillow');
    if (!header) return;
    window.HLS.raf.add('header-chroma', syncHeaderChroma, {
      when: function () {
        return window.HLS.shouldAnimateHero && window.HLS.shouldAnimateHero();
      },
      skip: getQuality().lite ? 4 : 2
    });
  }

  function applyPointer(clientX, clientY) {
    hosts.forEach(function (host) {
      if (!host.offsetParent && !host.classList.contains('is-open')) return;
      var rect = host.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        return;
      }
      var x = ((clientX - rect.left) / rect.width) * 100;
      var y = ((clientY - rect.top) / rect.height) * 100;
      host.style.setProperty('--lg-x', x.toFixed(1) + '%');
      host.style.setProperty('--lg-y', y.toFixed(1) + '%');
      host.style.setProperty('--lg-intensity', '1');
    });
  }

  function flushPointer() {
    if (!pendingPointer) return;
    applyPointer(pendingPointer.x, pendingPointer.y);
    pendingPointer = null;
  }

  function onPointerMove(e) {
    pointerActive = true;
    if (pointerIdleTimer) clearTimeout(pointerIdleTimer);
    pointerIdleTimer = setTimeout(function () {
      pointerActive = false;
    }, 1400);

    pendingPointer = { x: e.clientX, y: e.clientY };
    if (window.HLS && window.HLS.throttleRaf) {
      if (!onPointerMove._scheduled) {
        onPointerMove._scheduled = true;
        requestAnimationFrame(function () {
          onPointerMove._scheduled = false;
          flushPointer();
        });
      }
    } else {
      flushPointer();
    }
  }

  function onPointerLeave() {
    pendingPointer = null;
    pointerActive = false;
    if (pointerIdleTimer) clearTimeout(pointerIdleTimer);
  }

  function tickDrift(now) {
    driftRaf = 0;
    if (reducedMotion || getQuality().lite || !hosts.length) return;

    var t = (now - driftStart) * 0.001;
    var shimmer = (t * 0.041) % 1;

    document.documentElement.style.setProperty('--lg-shimmer-global', String(shimmer));

    if (!pointerActive) {
      hosts.forEach(function (host, index) {
        var phase = parseFloat(host.dataset.lgPhase || '0') + index * 0.91;
        var speed = parseFloat(host.dataset.lgSpeed || '1');
        var isStrip = host.classList.contains('liquid-glass-strip');
        var ampX = isStrip ? 8 : 14;
        var ampY = isStrip ? 6 : 11;
        var x = 50 +
          Math.sin(t * 0.29 * speed + phase) * ampX +
          Math.sin(t * 0.17 * speed + phase * 1.7) * (ampX * 0.45);
        var y = (isStrip ? 50 : 28) +
          Math.cos(t * 0.23 * speed + phase * 0.8) * ampY +
          Math.cos(t * 0.13 * speed + phase * 1.3) * (ampY * 0.4);
        var intensity = 0.38 + Math.sin(t * 0.37 * speed + phase) * 0.14;

        host.style.setProperty('--lg-x', x.toFixed(1) + '%');
        host.style.setProperty('--lg-y', y.toFixed(1) + '%');
        host.style.setProperty('--lg-intensity', intensity.toFixed(2));
        host.style.setProperty('--lg-phase', (t * 0.19 * speed + phase).toFixed(3));
        host.style.setProperty('--lg-shimmer', String(shimmer));
      });
    } else {
      hosts.forEach(function (host) {
        host.style.setProperty('--lg-shimmer', String(shimmer));
        host.style.setProperty('--lg-phase', (t * 0.19).toFixed(3));
      });
    }

    scheduleDrift();
  }

  function scheduleDrift() {
    if (driftRaf || reducedMotion || getQuality().lite) return;
    driftRaf = requestAnimationFrame(tickDrift);
  }

  function syncDriftJob() {
    if (driftRaf) {
      cancelAnimationFrame(driftRaf);
      driftRaf = 0;
    }
    if (reducedMotion || getQuality().lite) return;
    scheduleDrift();
  }

  function syncPointerBinding() {
    var enable = hosts.length && !getQuality().lite && !reducedMotion;
    if (enable && !pointerBound) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onPointerLeave);
      pointerBound = true;
    }
  }

  function initStripCenter() {
    /* Overflow layout is owned by app.js initSectionSpy (is-overflow / undercover). */
  }

  function init() {
    reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    initAllHosts();
    initStripCenter();

    var header = document.querySelector('.site-header.liquid-glass-host');
    if (header) {
      header.classList.toggle('header-over-hero', headerOverHero());
      header.style.setProperty('--lg-hero-proximity', headerOverHero() ? '1' : '0');
    }

    window.addEventListener('hls:theme-applied', initAllHosts);
    window.addEventListener('hls:hero-scene-ready', syncHeaderChromaJob);
    window.addEventListener('hls:quality-change', function () {
      syncHeaderChromaJob();
      syncDriftJob();
    });
    window.addEventListener('hls:locale-change', function () {
      setTimeout(initAllHosts, 50);
    });

    if (window.HLS && window.HLS.onScroll) {
      window.HLS.onScroll(function () {
        var h = document.querySelector('.site-header.liquid-glass-host');
        if (h) {
          h.classList.toggle('header-over-hero', headerOverHero());
          h.style.setProperty('--lg-hero-proximity', headerOverHero() ? '1' : '0');
        }
      });
    }

    window.HLS = window.HLS || {};
    window.HLS.refreshLiquidGlass = initAllHosts;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
