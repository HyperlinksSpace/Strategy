(function () {
  'use strict';

  var disposeFn = null;

  function isLightTheme() {
    return window.HLS && window.HLS.isLightTheme ? window.HLS.isLightTheme() : false;
  }

  function palette(light) {
    return light
      ? [
        'rgba(18, 138, 12, 0.72)',
        'rgba(30, 64, 175, 0.65)',
        'rgba(122, 44, 255, 0.58)',
        'rgba(0, 140, 120, 0.62)',
        'rgba(180, 100, 0, 0.55)',
        'rgba(0, 120, 200, 0.6)'
      ]
      : [
        'rgba(26, 170, 17, 0.85)',
        'rgba(0, 220, 255, 0.8)',
        'rgba(255, 60, 220, 0.72)',
        'rgba(120, 80, 255, 0.78)',
        'rgba(255, 220, 40, 0.7)',
        'rgba(0, 180, 255, 0.75)'
      ];
  }

  function pick(arr, i) {
    return arr[i % arr.length];
  }

  function createChain(color, segments, spacing, phase, speed, rx, ry, tilt) {
    var points = [];
    var i;
    for (i = 0; i < segments; i++) {
      points.push({ x: 0, y: 0 });
    }
    return {
      type: 'chain',
      color: color,
      points: points,
      spacing: spacing,
      phase: phase,
      speed: speed,
      rx: rx,
      ry: ry,
      tilt: tilt
    };
  }

  function createLinkPair(color, phase, speed, orbit, size) {
    return {
      type: 'link',
      color: color,
      phase: phase,
      speed: speed,
      orbit: orbit,
      size: size,
      spin: Math.random() * Math.PI * 2
    };
  }

  function createRing(color, phase, speed, radius, arc, width) {
    return {
      type: 'ring',
      color: color,
      phase: phase,
      speed: speed,
      radius: radius,
      arc: arc,
      width: width
    };
  }

  function createGlyph(color, phase, speed, orbit, kind) {
    return {
      type: 'glyph',
      color: color,
      phase: phase,
      speed: speed,
      orbit: orbit,
      kind: kind,
      spin: Math.random() * Math.PI * 2
    };
  }

  function createStream(color, phase, speed, angle) {
    return {
      type: 'stream',
      color: color,
      phase: phase,
      speed: speed,
      angle: angle,
      tail: 6 + Math.floor(Math.random() * 5)
    };
  }

  function buildScene(colors, count) {
    var items = [];
    var n = Math.max(8, count);

    items.push(createChain(pick(colors, 0), 9, 13, 0.2, 0.42, 0.38, 0.28, 0.4));
    items.push(createChain(pick(colors, 1), 8, 15, 2.1, -0.36, 0.32, 0.34, -0.55));
    items.push(createChain(pick(colors, 2), 10, 11, 4.4, 0.28, 0.44, 0.22, 1.1));
    items.push(createChain(pick(colors, 3), 7, 16, 1.3, -0.48, 0.28, 0.36, 0.85));

    items.push(createLinkPair(pick(colors, 4), 0.6, 0.55, 0.34, 10));
    items.push(createLinkPair(pick(colors, 5), 2.8, -0.42, 0.4, 8));
    items.push(createLinkPair(pick(colors, 0), 4.2, 0.38, 0.26, 9));

    items.push(createRing(pick(colors, 1), 0, 0.22, 0.22, 1.6, 1.2));
    items.push(createRing(pick(colors, 2), 1.4, -0.18, 0.3, 2.2, 1));
    items.push(createRing(pick(colors, 3), 2.6, 0.15, 0.38, 1.3, 0.9));

    var kinds = ['tri', 'hex', 'diamond'];
    items.push(createGlyph(pick(colors, 4), 0.9, 0.5, 0.42, kinds[0]));
    items.push(createGlyph(pick(colors, 5), 3.1, -0.44, 0.36, kinds[1]));
    items.push(createGlyph(pick(colors, 1), 5.2, 0.33, 0.48, kinds[2]));

    var streams = Math.min(8, Math.max(4, Math.floor(n * 0.28)));
    for (var s = 0; s < streams; s++) {
      items.push(createStream(
        pick(colors, s + 2),
        s * 0.77,
        0.55 + (s % 3) * 0.12,
        (s / streams) * Math.PI * 2
      ));
    }

    return items;
  }

  function orbInfluence(x, y, cx, cy, r) {
    var d = Math.hypot(x - cx, y - cy);
    return Math.max(0, 1 - d / r);
  }

  function headPoint(item, t, cx, cy, minDim) {
    var a = item.phase + t * item.speed;
    var rx = item.rx * minDim;
    var ry = item.ry * minDim;
    return {
      x: cx + Math.cos(a + item.tilt) * rx,
      y: cy + Math.sin(a * 1.25 + item.tilt * 0.6) * ry
    };
  }

  function updateChain(item, t, cx, cy, minDim) {
    var head = headPoint(item, t, cx, cy, minDim);
    item.points[0].x = head.x;
    item.points[0].y = head.y;
    var i;
    for (i = 1; i < item.points.length; i++) {
      var prev = item.points[i - 1];
      var cur = item.points[i];
      var dx = prev.x - cur.x;
      var dy = prev.y - cur.y;
      var dist = Math.hypot(dx, dy) || 0.001;
      var gap = item.spacing;
      if (dist > gap) {
        var pull = (dist - gap) / dist;
        cur.x += dx * pull;
        cur.y += dy * pull;
      }
    }
  }

  function drawChain(ctx, item, cx, cy, orbR, light) {
    var pts = item.points;
    var i;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (i = 0; i < pts.length - 1; i++) {
      var mx = (pts[i].x + pts[i + 1].x) * 0.5;
      var my = (pts[i].y + pts[i + 1].y) * 0.5;
      var glow = orbInfluence(mx, my, cx, cy, orbR);
      ctx.strokeStyle = item.color;
      ctx.globalAlpha = (light ? 0.35 : 0.25) + glow * (light ? 0.45 : 0.65);
      ctx.lineWidth = 0.8 + glow * 1.6;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.stroke();
    }

    for (i = 0; i < pts.length; i++) {
      var inf = orbInfluence(pts[i].x, pts[i].y, cx, cy, orbR);
      var r = 1.6 + inf * 2.4;
      ctx.fillStyle = item.color;
      ctx.globalAlpha = (light ? 0.4 : 0.35) + inf * (light ? 0.5 : 0.6);
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLinkPair(ctx, item, t, cx, cy, minDim, orbR, light) {
    var a = item.phase + t * item.speed;
    var r = item.orbit * minDim;
    var x1 = cx + Math.cos(a) * r;
    var y1 = cy + Math.sin(a * 1.15) * r * 0.82;
    var x2 = cx + Math.cos(a + 0.55) * r * 0.92;
    var y2 = cy + Math.sin(a * 1.15 + 0.8) * r * 0.76;
    var mx = (x1 + x2) * 0.5;
    var my = (y1 + y2) * 0.5;
    var glow = orbInfluence(mx, my, cx, cy, orbR);
    var s = item.size + glow * 4;
    item.spin += 0.012;

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(item.spin);
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.globalAlpha = (light ? 0.38 : 0.32) + glow * (light ? 0.48 : 0.58);
    ctx.lineWidth = 1.2 + glow * 1.2;
    ctx.beginPath();
    ctx.arc(-s, 0, s * 0.42, 0, Math.PI * 2);
    ctx.arc(s, 0, s * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, 0);
    ctx.lineTo(s * 0.55, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawRing(ctx, item, t, cx, cy, minDim, orbR, light) {
    var a = item.phase + t * item.speed;
    var r = item.radius * minDim;
    var glow = orbInfluence(
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r,
      cx, cy, orbR
    );
    ctx.strokeStyle = item.color;
    ctx.globalAlpha = (light ? 0.28 : 0.22) + glow * (light ? 0.42 : 0.55);
    ctx.lineWidth = item.width + glow * 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a, a + item.arc);
    ctx.stroke();
  }

  function drawGlyph(ctx, item, t, cx, cy, minDim, orbR, light) {
    var a = item.phase + t * item.speed;
    var r = item.orbit * minDim;
    var x = cx + Math.cos(a * 0.9) * r;
    var y = cy + Math.sin(a * 1.1 + 0.5) * r * 0.85;
    var glow = orbInfluence(x, y, cx, cy, orbR);
    var size = 5 + glow * 7;
    item.spin += 0.008;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(item.spin);
    ctx.strokeStyle = item.color;
    ctx.globalAlpha = (light ? 0.32 : 0.28) + glow * (light ? 0.5 : 0.62);
    ctx.lineWidth = 1 + glow * 0.8;
    ctx.beginPath();
    if (item.kind === 'tri') {
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.86, size * 0.5);
      ctx.lineTo(-size * 0.86, size * 0.5);
      ctx.closePath();
    } else if (item.kind === 'hex') {
      var i;
      for (i = 0; i < 6; i++) {
        var ang = (Math.PI / 3) * i - Math.PI / 6;
        var px = Math.cos(ang) * size;
        var py = Math.sin(ang) * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      ctx.rect(-size * 0.55, -size * 0.55, size * 1.1, size * 1.1);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawStream(ctx, item, t, cx, cy, minDim, orbR, light) {
    var prog = (item.phase + t * item.speed) % 1;
    var len = minDim * 0.55;
    var cos = Math.cos(item.angle);
    var sin = Math.sin(item.angle);
    var i;

    for (i = 0; i < item.tail; i++) {
      var p = prog - i * 0.045;
      if (p < 0) p += 1;
      var ease = Math.sin(p * Math.PI);
      var x = cx + (p - 0.5) * len * cos * 1.35;
      var y = cy + (p - 0.5) * len * sin * 1.35;
      var glow = orbInfluence(x, y, cx, cy, orbR);
      var alpha = ease * ((light ? 0.35 : 0.3) + glow * (light ? 0.55 : 0.65));
      if (alpha < 0.04) continue;
      ctx.fillStyle = item.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + glow * 2.2 + ease * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function init() {
    if (disposeFn) {
      disposeFn();
      disposeFn = null;
    }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var canvas = document.getElementById('hero-flow');
    if (!canvas) return;

    var quality = window.HLS && window.HLS.getQuality ? window.HLS.getQuality() : { lite: false, dpr: 1, flow: true };
    if (quality.flow === false) return;

    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    var light = isLightTheme();
    var colors = palette(light);
    var items = buildScene(colors, quality.flowCount || 24);
    var raf = 0;
    var time = 0;
    var dpr = quality.dpr || 1;
    var sizeDirty = true;
    var skip = quality.lite ? 2 : 1;
    var frame = 0;

    function resize() {
      var w = canvas.clientWidth;
      var h = canvas.clientHeight;
      if (w < 1 || h < 1) return;
      var nextDpr = window.HLS && window.HLS.getQuality ? window.HLS.getQuality().dpr : dpr;
      canvas.width = Math.round(w * nextDpr);
      canvas.height = Math.round(h * nextDpr);
      ctx.setTransform(nextDpr, 0, 0, nextDpr, 0, 0);
      dpr = nextDpr;
    }

    function shouldRun() {
      return window.HLS && window.HLS.shouldAnimateHero ? window.HLS.shouldAnimateHero() : !document.hidden;
    }

    function draw(now) {
      raf = requestAnimationFrame(draw);
      if (!shouldRun()) return;

      frame += 1;
      if (frame % skip !== 0) return;

      if (sizeDirty) {
        resize();
        sizeDirty = false;
      }

      var w = canvas.clientWidth;
      var h = canvas.clientHeight;
      if (w < 1 || h < 1) return;

      time += skip * 0.016;
      var cx = w * 0.5;
      var cy = h * 0.48;
      var minDim = Math.min(w, h);
      var orbR = minDim * 0.22;

      ctx.clearRect(0, 0, w, h);

      var i;
      for (i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.type === 'chain') {
          updateChain(item, time, cx, cy, minDim);
          drawChain(ctx, item, cx, cy, orbR, light);
        } else if (item.type === 'link') {
          drawLinkPair(ctx, item, time, cx, cy, minDim, orbR, light);
        } else if (item.type === 'ring') {
          drawRing(ctx, item, time, cx, cy, minDim, orbR, light);
        } else if (item.type === 'glyph') {
          drawGlyph(ctx, item, time, cx, cy, minDim, orbR, light);
        } else if (item.type === 'stream') {
          drawStream(ctx, item, time, cx, cy, minDim, orbR, light);
        }
      }

      ctx.globalAlpha = 1;
    }

    function onResize() {
      sizeDirty = true;
    }

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('hls:hero-visibility', onResize);

    resize();
    raf = requestAnimationFrame(draw);

    disposeFn = function () {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('hls:hero-visibility', onResize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('hls:theme-applied', init);
})();
