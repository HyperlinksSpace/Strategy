(function () {
  'use strict';

  var visible = !document.hidden;
  var heroVisible = true;

  document.addEventListener('visibilitychange', function () {
    visible = !document.hidden;
    window.dispatchEvent(new Event('hls:visibility'));
  });

  function observeHero() {
    var hero = document.getElementById('hero');
    if (!hero || !('IntersectionObserver' in window)) return;

    new IntersectionObserver(function (entries) {
      heroVisible = entries.some(function (e) { return e.isIntersecting && e.intersectionRatio > 0.08; });
      window.dispatchEvent(new Event('hls:hero-visibility'));
    }, { threshold: [0, 0.08, 0.2] }).observe(hero);
  }

  function getQuality() {
    var mobile = window.innerWidth < 768;
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
    var saveData = navigator.connection && navigator.connection.saveData;
    var lite = mobile || lowMem || saveData;

    return {
      mobile: mobile,
      coarse: coarse,
      lite: lite,
      dpr: lite ? 1 : Math.min(window.devicePixelRatio || 1, 1.5),
      orbSteps: lite ? 40 : 56,
      fbmOctaves: lite ? 3 : 4,
      lightning: !lite,
      bgAnimate: visible
    };
  }

  function shouldAnimateHero() {
    return visible && heroVisible;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeHero);
  } else {
    observeHero();
  }

  window.HLS = window.HLS || {};
  window.HLS.getQuality = getQuality;
  window.HLS.shouldAnimateHero = shouldAnimateHero;
})();
