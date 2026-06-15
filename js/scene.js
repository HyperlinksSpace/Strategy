(function () {
  'use strict';

  function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vsSource, fsSource) {
    var vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    var fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return null;
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  function buildOrbFs(steps, light, lite) {
    var rippleAmp = lite ? 0.018 : 0.028;

    var orbBody = light ? [
      '      float grid = surfaceGrid(p, n, uTime);',
      '      col = vec3(0.55, 0.68, 0.92) + vec3(0.2, 0.45, 1.0) * diff * 0.75;',
      '      col += vec3(0.12, 0.55, 0.95) * grid * 0.85;',
      '      col += vec3(0.45, 0.2, 0.92) * rim * 1.0;',
      '      col += aura * vec3(0.35, 0.65, 1.0);',
      '      alpha = 0.55 + rim * 0.32 + grid * 0.12 + aura * 0.2;'
    ] : [
      '      float grid = surfaceGrid(p, n, uTime);',
      '      col = vec3(0.03, 0.06, 0.14) + vec3(0.15, 0.38, 1.0) * diff * 0.65;',
      '      col += vec3(0.08, 0.95, 0.55) * grid * 1.05;',
      '      col += vec3(0.55, 0.18, 1.0) * rim * 0.95;',
      '      col += aura * vec3(0.25, 0.85, 0.55);',
      '      col += aura * vec3(0.4, 0.35, 1.0) * 0.5;',
      '      alpha = 0.5 + rim * 0.38 + grid * 0.15 + aura * 0.28;'
    ];

    return [
      'precision mediump float;',
      'varying vec2 vUv;',
      'uniform float uTime;',
      'uniform vec2 uResolution;',
      'const float RIPPLE_AMP = ' + rippleAmp + ';',
      'float sdSphere(vec3 p, float r){ return length(p) - r; }',
      'float sceneDist(vec3 p){',
      '  float t = uTime;',
      '  float baseR = 0.52 + 0.025 * sin(t * 1.15);',
      '  vec3 pn = normalize(p + vec3(0.0001));',
      '  float ripple = sin(4.0 * pn.x + t * 1.1) * sin(4.0 * pn.y - t * 0.85) * sin(4.0 * pn.z + t * 0.95);',
      '  ripple += 0.5 * sin(6.0 * (pn.x + pn.y) - t * 0.7);',
      '  ripple *= RIPPLE_AMP;',
      '  return sdSphere(p, baseR + ripple);',
      '}',
      'vec3 calcNormal(vec3 p){',
      '  vec2 e = vec2(0.0012, 0.0);',
      '  return normalize(vec3(',
      '    sceneDist(p + e.xyy) - sceneDist(p - e.xyy),',
      '    sceneDist(p + e.yxy) - sceneDist(p - e.yxy),',
      '    sceneDist(p + e.yyx) - sceneDist(p - e.yyx)));',
      '}',
      'float surfaceGrid(vec3 p, vec3 n, float t){',
      '  vec3 q = p + n * sin(t * 1.2 + dot(p, vec3(1.0, 1.7, 2.3))) * 0.02;',
      '  vec2 cell = abs(fract(q.xy * 7.0) - 0.5);',
      '  float lines = 1.0 - smoothstep(0.0, 0.08, min(cell.x, cell.y));',
      '  return lines * 0.85;',
      '}',
      'float softAura(vec3 p){',
      '  return exp(-max(length(p) - 0.52, 0.0) * 8.0) * smoothstep(1.05, 0.12, length(p));',
      '}',
      'void main(){',
      '  vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);',
      '  vec3 ro = vec3(0.0, 0.0, 2.85);',
      '  vec3 rd = normalize(vec3(uv, -1.58));',
      '  float march = 0.0; float hit = 0.0; vec3 p;',
      '  for (int i = 0; i < ' + steps + '; i++) {',
      '    float d = sceneDist(ro + rd * march);',
      '    if (d < 0.0012) { hit = 1.0; p = ro + rd * march; break; }',
      '    march += d * 0.92;',
      '    if (march > 5.0) break;',
      '  }',
      '  float aura = hit > 0.5 ? softAura(p) : softAura(ro + rd * 3.2);',
      '  vec3 col = vec3(0.0);',
      '  float alpha = aura * 0.3;',
      '  if (hit > 0.5) {',
      '    vec3 n = calcNormal(p);',
      '    vec3 lightDir = normalize(vec3(0.45, 0.85, 1.0));',
      '    float diff = max(dot(n, lightDir), 0.0);',
      '    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);',
      orbBody.join('\n'),
      '  }',
      '  float halo = smoothstep(0.92, 0.08, length(uv));',
      '  col += vec3(0.12, 0.55, 0.95) * halo * aura * 0.4;',
      '  alpha = max(alpha, halo * (0.2 + aura * 0.32));',
      '  gl_FragColor = vec4(col, alpha);',
      '}'
    ].join('\n');
  }

  var BG_VS = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var BG_FS = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform float uTime;',
    'uniform vec2 uResolution;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  float a = hash(i); float b = hash(i + vec2(1.0, 0.0));',
    '  float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0; float a = 0.5;',
    '  for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }',
    '  return v;',
    '}',
    'void main(){',
    '  vec2 uv = vUv;',
    '  vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);',
    '  float t = uTime * 0.08;',
    '  float n = fbm(p * 2.5 + vec2(t, -t * 0.7));',
    '  float orb = length(p - vec2(0.28, -0.05));',
    '  float sphere = smoothstep(0.55, 0.0, orb);',
    '  float glow = sphere * (0.35 + 0.25 * sin(uTime * 0.6 + n * 6.0));',
    '  vec3 col = vec3(0.0);',
    '  col += vec3(0.04, 0.05, 0.12) * n;',
    '  col += vec3(0.10, 0.18, 1.0) * glow * 0.35;',
    '  col += vec3(0.48, 0.17, 1.0) * glow * sphere * 0.25;',
    '  col += vec3(0.10, 0.67, 0.07) * glow * sphere * 0.08;',
    '  float vig = smoothstep(1.2, 0.2, length(p));',
    '  col *= vig;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var BG_FS_LIGHT = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform float uTime;',
    'uniform vec2 uResolution;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  float a = hash(i); float b = hash(i + vec2(1.0, 0.0));',
    '  float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0; float a = 0.5;',
    '  for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }',
    '  return v;',
    '}',
    'void main(){',
    '  vec2 uv = vUv;',
    '  vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);',
    '  float t = uTime * 0.06;',
    '  float n = fbm(p * 2.2 + vec2(t, -t * 0.5));',
    '  float orb = length(p - vec2(0.28, -0.05));',
    '  float sphere = smoothstep(0.55, 0.0, orb);',
    '  float glow = sphere * (0.28 + 0.18 * sin(uTime * 0.5 + n * 5.0));',
    '  vec3 col = vec3(0.96, 0.97, 0.99);',
    '  col += vec3(0.55, 0.72, 0.98) * n * 0.18;',
    '  col += vec3(0.72, 0.55, 0.95) * glow * 0.28;',
    '  col += vec3(0.15, 0.62, 0.12) * glow * sphere * 0.2;',
    '  float vig = smoothstep(1.1, 0.35, length(p));',
    '  col = mix(vec3(0.995), col, vig);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function initGlCanvas(canvas, fragmentSource, opts) {
    opts = opts || {};
    var quality = window.HLS && window.HLS.getQuality ? window.HLS.getQuality() : { dpr: 1, lite: false };
    var gl = canvas.getContext('webgl', {
      alpha: !!opts.alpha,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: quality.lite ? 'low-power' : 'high-performance',
      desynchronized: true
    });
    if (!gl) return null;

    var program = createProgram(gl, BG_VS, fragmentSource);
    if (!program) return null;

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    var aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);
    var uTime = gl.getUniformLocation(program, 'uTime');
    var uResolution = gl.getUniformLocation(program, 'uResolution');

    var dpr = quality.dpr;
    var maxPx = opts.maxPx || 0;
    var baseFrameSkip = opts.frameSkip || 1;
    var frameCount = 0;
    var running = true;
    var raf = 0;
    var start = performance.now();

    function resize() {
      var w = canvas.clientWidth;
      var h = canvas.clientHeight;
      if (w < 1 || h < 1) return;
      var q = window.HLS && window.HLS.getQuality ? window.HLS.getQuality() : { dpr: dpr };
      var nextDpr = q.dpr;
      if (maxPx > 0) {
        nextDpr = Math.min(nextDpr, maxPx / Math.max(w, h));
      }
      var bw = Math.max(1, Math.round(w * nextDpr));
      var bh = Math.max(1, Math.round(h * nextDpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        dpr = nextDpr;
        canvas.width = bw;
        canvas.height = bh;
        gl.viewport(0, 0, bw, bh);
      }
    }

    function shouldRun() {
      if (opts.heroOnly) {
        return window.HLS && window.HLS.shouldAnimateHero ? window.HLS.shouldAnimateHero() : true;
      }
      if (opts.pauseOffscreen) {
        return window.HLS && window.HLS.shouldAnimateBg ? window.HLS.shouldAnimateBg() : !document.hidden;
      }
      return !document.hidden;
    }

    function drawFrame(now) {
      raf = 0;
      if (!running || !shouldRun()) return;

      frameCount += 1;
      var q = window.HLS && window.HLS.getQuality ? window.HLS.getQuality() : null;
      var frameSkip = baseFrameSkip;
      if (q) {
        frameSkip = opts.heroOnly ? (q.orbFrameSkip || baseFrameSkip) : (q.bgFrameSkip || baseFrameSkip);
      }
      if (frameCount % frameSkip !== 0) {
        schedule();
        return;
      }

      resize();

      if (opts.light) {
        gl.clearColor(0.96, 0.97, 0.99, opts.alpha ? 0 : 1);
      } else {
        gl.clearColor(0, 0, 0, opts.alpha ? 0 : 1);
      }
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, (now - start) * 0.001);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      schedule();
    }

    function schedule() {
      if (raf || !running) return;
      if (!shouldRun()) return;
      raf = requestAnimationFrame(drawFrame);
    }

    function wake() {
      schedule();
    }

    if (window.ResizeObserver) {
      new ResizeObserver(function () { resize(); }).observe(canvas);
    }
    window.addEventListener('hls:visibility', wake);
    window.addEventListener('hls:hero-visibility', wake);
    window.addEventListener('hls:scroll-idle', wake);

    resize();
    schedule();

    return function dispose() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('hls:visibility', wake);
      window.removeEventListener('hls:hero-visibility', wake);
      window.removeEventListener('hls:scroll-idle', wake);
    };
  }

  var disposers = [];

  function disposeAll() {
    disposers.forEach(function (d) { d(); });
    disposers = [];
  }

  function isLightTheme() {
    return window.HLS && window.HLS.isLightTheme ? window.HLS.isLightTheme() : false;
  }

  function init() {
    disposeAll();
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var light = isLightTheme();
    var quality = window.HLS && window.HLS.getQuality ? window.HLS.getQuality() : {
      orbSteps: 36, lite: false, bgWebgl: true, orbFrameSkip: 1, bgFrameSkip: 2, orbMaxPx: 560
    };
    var bg = document.getElementById('scene-bg');
    var orb = document.getElementById('hero-orb');

    if (bg) {
      if (quality.bgWebgl !== false) {
        disposers.push(initGlCanvas(bg, light ? BG_FS_LIGHT : BG_FS, {
          alpha: false,
          light: light,
          pauseOffscreen: true,
          frameSkip: quality.bgFrameSkip || 2
        }));
      } else {
        bg.classList.add('scene-bg--static');
      }
    }

    if (orb) {
      var gl = orb.getContext('webgl', {
        alpha: true,
        antialias: false,
        premultipliedAlpha: false,
        desynchronized: true
      });
      if (gl) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
      disposers.push(initGlCanvas(
        orb,
        buildOrbFs(quality.orbSteps || 36, light, !!quality.lite),
        {
          alpha: true,
          light: light,
          heroOnly: true,
          frameSkip: quality.orbFrameSkip || 1,
          maxPx: quality.orbMaxPx || 560
        }
      ));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('hls:theme-applied', init);
})();
