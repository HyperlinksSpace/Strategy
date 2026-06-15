(function () {
  'use strict';

  var instances = [];

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isLightTheme() {
    return window.HLS && window.HLS.isLightTheme ? window.HLS.isLightTheme() : false;
  }

  function createGlassLayer(host) {
    var canvas = document.createElement('canvas');
    canvas.className = 'liquid-glass-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, host.firstChild);

    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    var bg = document.getElementById('scene-bg');
    var time = 0;
    var raf = 0;
    var dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = host.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width));
      var h = Math.max(1, Math.round(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function sampleBackground(sx, sy, sw, sh, dx, dy, dw, dh, zoom) {
      if (!bg || !bg.width || !bg.height) return false;
      try {
        var z = zoom || 1.12;
        var cropW = sw / z;
        var cropH = sh / z;
        var cropX = sx + (sw - cropW) * 0.5;
        var cropY = sy + (sh - cropH) * 0.5;
        ctx.drawImage(bg, cropX, cropY, cropW, cropH, dx, dy, dw, dh);
        return true;
      } catch (e) {
        return false;
      }
    }

    function drawFrame(now) {
      time = now * 0.001;
      resize();

      var w = canvas.width / dpr;
      var h = canvas.height / dpr;
      var hostRect = host.getBoundingClientRect();
      var bgRect = bg ? bg.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

      ctx.clearRect(0, 0, w, h);

      var sx = (hostRect.left - bgRect.left) * (bg.width / bgRect.width);
      var sy = (hostRect.top - bgRect.top) * (bg.height / bgRect.height);
      var sw = hostRect.width * (bg.width / bgRect.width);
      var sh = hostRect.height * (bg.height / bgRect.height);

      var zoom = 1.14 + Math.sin(time * 0.55) * 0.04;
      var drew = sampleBackground(sx, sy, sw, sh, 0, 0, w, h, zoom);

      if (drew) {
        var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var data = img.data;
        var shift = Math.sin(time * 0.9) * 1.2 + 1.8;
        for (var y = 0; y < canvas.height; y += 2) {
          for (var x = 0; x < canvas.width; x += 2) {
            var i = (y * canvas.width + x) * 4;
            var ri = ((y * canvas.width + Math.min(canvas.width - 1, x + shift)) * 4);
            var bi = ((y * canvas.width + Math.max(0, x - shift)) * 4);
            data[i] = data[ri];
            data[i + 2] = data[bi];
          }
        }
        ctx.putImageData(img, 0, 0);
      }

      var light = isLightTheme();
      var grad = ctx.createLinearGradient(0, 0, w, h);
      if (light) {
        grad.addColorStop(0, 'rgba(255,255,255,0.72)');
        grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
        grad.addColorStop(1, 'rgba(230,245,255,0.62)');
      } else {
        grad.addColorStop(0, 'rgba(12,12,18,0.55)');
        grad.addColorStop(0.5, 'rgba(8,8,14,0.42)');
        grad.addColorStop(1, 'rgba(6,18,10,0.48)');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      var sheen = ctx.createLinearGradient(0, 0, w * 0.6, h);
      sheen.addColorStop(0, 'rgba(255,255,255,' + (light ? 0.35 : 0.14) + ')');
      sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);

      var edge = ctx.createLinearGradient(0, h - 2, 0, h);
      edge.addColorStop(0, 'rgba(26,170,17,0)');
      edge.addColorStop(1, 'rgba(26,170,17,' + (light ? 0.18 : 0.28) + ')');
      if (host.classList.contains('section-strip')) {
        edge = ctx.createLinearGradient(0, 0, 0, 2);
        edge.addColorStop(0, 'rgba(74,108,247,' + (light ? 0.2 : 0.35) + ')');
        edge.addColorStop(1, 'rgba(74,108,247,0)');
        ctx.fillStyle = edge;
        ctx.fillRect(0, 0, w, 2);
      } else {
        ctx.fillStyle = edge;
        ctx.fillRect(0, h - 2, w, 2);
      }

      raf = requestAnimationFrame(drawFrame);
    }

    function start() {
      cancelAnimationFrame(raf);
      if (prefersReducedMotion()) {
        resize();
        return;
      }
      raf = requestAnimationFrame(drawFrame);
    }

    function stop() {
      cancelAnimationFrame(raf);
    }

    resize();
    start();

    return { stop: stop, start: start, resize: resize };
  }

  function init() {
    instances.forEach(function (inst) { inst.stop(); });
    instances = [];

    document.querySelectorAll('.liquid-glass-host').forEach(function (host) {
      var inst = createGlassLayer(host);
      if (inst) instances.push(inst);
    });
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
    window.addEventListener('resize', sync);
    window.addEventListener('hls:locale-change', function () {
      setTimeout(sync, 80);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 120);
      initStripCenter();
    });
  } else {
    setTimeout(init, 120);
    initStripCenter();
  }

  window.addEventListener('resize', function () {
    instances.forEach(function (inst) { inst.resize(); });
  });

  window.addEventListener('hls:theme-applied', function () {
    setTimeout(init, 80);
  });

  window.HLS = window.HLS || {};
  window.HLS.initLiquidGlass = init;
})();
