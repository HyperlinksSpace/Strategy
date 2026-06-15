(function () {
  'use strict';

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStripCenter);
  } else {
    initStripCenter();
  }
})();
