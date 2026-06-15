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
    var blobCount = lite ? 5 : 8;
    var volSteps = lite ? 16 : 24;
    var tendrils = lite ? 3 : 5;

    var orbBody = light ? [
      '      float grid = surfaceGrid(p, n, uTime);',
      '      float flow = internalFlow(p, uTime);',
      '      col = vec3(0.55, 0.68, 0.92) + vec3(0.2, 0.45, 1.0) * diff * 0.75;',
      '      col += vec3(0.12, 0.55, 0.95) * grid * 0.85;',
      '      col += vec3(0.45, 0.2, 0.92) * rim * 1.0;',
      '      col += vec3(0.95, 0.3, 0.75) * rim * flow * 0.55;',
      '      col += vec3(0.0, 0.75, 0.95) * bolt * 0.95;',
      '      col += vec3(0.15, 0.55, 1.0) * flow * 0.35;',
      '      col += aura * vec3(0.35, 0.65, 1.0);',
      '      alpha = 0.55 + rim * 0.32 + grid * 0.12 + aura * 0.2;'
    ] : [
      '      float grid = surfaceGrid(p, n, uTime);',
      '      float flow = internalFlow(p, uTime);',
      '      col = vec3(0.03, 0.06, 0.14) + vec3(0.15, 0.38, 1.0) * diff * 0.65;',
      '      col += vec3(0.08, 0.95, 0.55) * grid * 1.05;',
      '      col += vec3(0.55, 0.18, 1.0) * rim * 0.95;',
      '      col += vec3(1.0, 0.28, 0.88) * rim * flow * 0.6;',
      '      col += vec3(0.0, 0.95, 1.0) * bolt * 0.85;',
      '      col += vec3(0.2, 1.0, 0.45) * flow * 0.45;',
      '      col += aura * vec3(0.25, 0.85, 0.55);',
      '      col += aura * vec3(0.4, 0.35, 1.0) * 0.5;',
      '      alpha = 0.5 + rim * 0.38 + grid * 0.15 + aura * 0.28;'
    ];

    return [
      'precision mediump float;',
      'varying vec2 vUv;',
      'uniform float uTime;',
      'uniform vec2 uResolution;',
      'const float BLOB_COUNT = ' + blobCount + '.0;',
      'const float VOL_STEPS = ' + volSteps + '.0;',
      'const float TENDRILS = ' + tendrils + '.0;',
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(41.0, 289.0))) * 1031.0); }',
      'float hash1(float n){ return fract(sin(n * 127.1) * 43758.5453); }',
      'float noise(vec3 p){',
      '  vec3 i = floor(p); vec3 f = fract(p);',
      '  float n = dot(i, vec3(1.0, 57.0, 113.0));',
      '  vec3 u = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(mix(hash(vec2(n)), hash(vec2(n + 1.0)), u.x),',
      '    mix(hash(vec2(n + 57.0)), hash(vec2(n + 58.0)), u.x), u.y),',
      '    mix(mix(hash(vec2(n + 113.0)), hash(vec2(n + 114.0)), u.x),',
      '    mix(hash(vec2(n + 170.0)), hash(vec2(n + 171.0)), u.x), u.y), u.z);',
      '}',
      'float fbm(vec3 p){',
      '  float v = 0.0; float a = 0.5; mat3 m = mat3(1.0);',
      '  for (int i = 0; i < 3; i++) {',
      '    v += a * noise(p * m);',
      '    p = m * p * 1.9 + vec3(0.7, 1.3, 0.4);',
      '    a *= 0.5;',
      '  }',
      '  return v;',
      '}',
      'mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c); }',
      'mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0,0.0,0.0, 0.0,c,-s, 0.0,s,c); }',
      'float smin(float a, float b, float k){',
      '  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);',
      '  return mix(b, a, h) - k * h * (1.0 - h);',
      '}',
      'float sdSphere(vec3 p, float r){ return length(p) - r; }',
      'vec3 blobCenter(float i, float t){',
      '  float fi = i;',
      '  float seed = hash1(fi + 2.17);',
      '  float seed2 = hash1(fi + 9.31);',
      '  float sp = 0.55 + seed * 0.65;',
      '  float sq = 0.42 + seed2 * 0.58;',
      '  float orbit = 0.08 + 0.42 * (0.5 + 0.5 * sin(t * 0.31 + fi * 1.73));',
      '  if (i < 0.5) orbit *= 0.35;',
      '  float wobble = sin(t * sp + fi * 6.283) * cos(t * sq * 0.7 + fi * 3.1);',
      '  return vec3(',
      '    sin(t * sp + fi * 2.399) * orbit + wobble * 0.12,',
      '    cos(t * sq + fi * 1.618) * orbit * 0.88 - wobble * 0.1,',
      '    sin(t * sp * 0.82 + t * sq * 0.61 + fi * 4.2) * orbit * 0.75 + wobble * 0.14',
      '  );',
      '}',
      'float blobRadius(float i, float t){',
      '  float fi = i;',
      '  float pulse = sin(t * (1.1 + hash1(fi) * 0.8) + fi * 2.4);',
      '  float base = (i < 0.5) ? 0.38 : 0.11;',
      '  return base + 0.09 * pulse + 0.05 * sin(t * 2.3 + fi * 5.1);',
      '}',
      'vec3 tendrilPoint(float ti, float seg, float t, float seed){',
      '  float ang = t * (0.52 + seed * 0.2) + seg * 0.85 + seed * 6.28;',
      '  float rad = 0.55 + 0.35 * sin(t * 0.38 + seed * 3.0 + seg * 0.4);',
      '  return vec3(cos(ang) * rad, sin(ang * 1.22) * rad * 0.62, sin(ang * 0.88) * rad * 0.5);',
      '}',
      'float tendrilsMap(vec3 p, float t){',
      '  float d = 1000.0;',
      '  for (float j = 0.0; j < TENDRILS; j += 1.0) {',
      '    float seed = hash1(j + 4.7);',
      '    vec3 prev = tendrilPoint(j, 0.0, t, seed);',
      '    d = min(d, sdSphere(p - prev, 0.028));',
      '    for (float s = 1.0; s < 6.0; s += 1.0) {',
      '      vec3 cur = tendrilPoint(j, s, t, seed);',
      '      d = smin(d, sdSphere(p - cur, 0.022 + 0.008 * sin(t * 2.0 + s)), 0.08);',
      '      vec3 mid = mix(prev, cur, 0.5);',
      '      d = smin(d, sdSphere(p - mid, 0.018), 0.06);',
      '      prev = cur;',
      '    }',
      '  }',
      '  return d;',
      '}',
      'float liquidMap(vec3 p, float t){',
      '  vec3 warp = vec3(',
      '    fbm(p * 1.6 + vec3(t * 0.15, -t * 0.11, t * 0.08)),',
      '    fbm(p * 1.6 + vec3(4.1, t * 0.13, 1.7)),',
      '    fbm(p * 1.6 + vec3(2.3, 5.9, -t * 0.12))',
      '  );',
      '  p += (warp - 0.5) * 0.22;',
      '  float d = 1000.0;',
      '  for (float i = 0.0; i < BLOB_COUNT; i += 1.0) {',
      '    vec3 c = blobCenter(i, t);',
      '    float r = blobRadius(i, t);',
      '    float k = 0.14 + 0.1 * (0.5 + 0.5 * sin(t * 0.47 + i));',
      '    d = smin(d, sdSphere(p - c, r), k);',
      '  }',
      '  d = smin(d, tendrilsMap(p, t), 0.12);',
      '  float ripples = 0.1 * sin(length(p) * 9.0 - t * 1.8);',
      '  ripples += 0.06 * sin(atan(p.y, p.x) * 6.0 + t * 1.2);',
      '  ripples += 0.08 * (fbm(p * 5.0 + t * 0.25) - 0.5);',
      '  d += ripples * smoothstep(0.95, 0.45, length(p));',
      '  return d;',
      '}',
      'float sceneDist(vec3 p){ return liquidMap(p, uTime); }',
      'vec3 calcNormal(vec3 p){',
      '  vec2 e = vec2(0.001, 0.0);',
      '  return normalize(vec3(',
      '    sceneDist(p + e.xyy) - sceneDist(p - e.xyy),',
      '    sceneDist(p + e.yxy) - sceneDist(p - e.yxy),',
      '    sceneDist(p + e.yyx) - sceneDist(p - e.yyx)));',
      '}',
      'float surfaceGrid(vec3 p, vec3 n, float t){',
      '  vec3 q = p + n * sin(t * 1.6 + p.y * 4.0) * 0.04;',
      '  q = rotY(t * 0.25) * rotX(t * 0.18) * q;',
      '  vec2 cell = abs(fract(q.xy * 7.5) - 0.5);',
      '  float lines = 1.0 - smoothstep(0.0, 0.09, min(cell.x, cell.y));',
      '  float dots = smoothstep(0.18, 0.06, length(fract(q.xy * 7.5) - 0.5));',
      '  return clamp(lines * 0.75 + dots * 0.35, 0.0, 1.0);',
      '}',
      'float internalFlow(vec3 p, float t){',
      '  vec3 q = p * 2.2 + vec3(t * 0.35, -t * 0.28, t * 0.22);',
      '  float f = fbm(q);',
      '  f *= fbm(q * 1.7 + vec3(0.0, t * 0.5, 1.3));',
      '  return smoothstep(0.15, 0.85, f);',
      '}',
      'float lightning(vec3 p, float t){',
      '  float arc = sin(p.x * 16.0 + t * 5.5) * sin(p.y * 13.0 - t * 4.8) * sin(p.z * 15.0 + t * 4.2);',
      '  arc = pow(abs(arc), 0.2);',
      '  return smoothstep(0.5, 0.92, arc) * smoothstep(0.9, 0.15, length(p));',
      '}',
      'float liquidAura(vec3 ro, vec3 rd, float tMax){',
      '  float aura = 0.0;',
      '  for (float i = 0.0; i < VOL_STEPS; i += 1.0) {',
      '    float h = (i + 0.5) / VOL_STEPS;',
      '    vec3 p = ro + rd * tMax * h;',
      '    float d = liquidMap(p, uTime);',
      '    float density = exp(-max(d, 0.0) * 7.5);',
      '    float core = smoothstep(1.1, 0.15, length(p));',
      '    aura += density * core * (1.0 / VOL_STEPS);',
      '  }',
      '  return aura * 2.2;',
      '}',
      'void main(){',
      '  vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);',
      '  vec3 ro = vec3(0.0, 0.0, 2.85);',
      '  vec3 rd = normalize(vec3(uv, -1.58));',
      '  float t = 0.0; float hit = 0.0; vec3 p;',
      '  for (int i = 0; i < ' + steps + '; i++) {',
      '    float d = sceneDist(ro + rd * t);',
      '    if (d < 0.001) { hit = 1.0; p = ro + rd * t; break; }',
      '    t += d * 0.92;',
      '    if (t > 5.5) break;',
      '  }',
      '  float aura = liquidAura(ro, rd, hit > 0.5 ? t : 4.2);',
      '  vec3 col = vec3(0.0);',
      '  float alpha = aura * 0.35;',
      '  if (hit > 0.5) {',
      '    vec3 n = calcNormal(p);',
      '    vec3 lightDir = normalize(vec3(0.45, 0.85, 1.0));',
      '    float diff = max(dot(n, lightDir), 0.0);',
      '    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.2);',
      '    float bolt = lightning(p, uTime);',
      orbBody.join('\n'),
      '  }',
      '  float halo = smoothstep(0.92, 0.08, length(uv));',
      '  col += vec3(0.12, 0.55, 0.95) * halo * aura * 0.45;',
      '  col += vec3(0.45, 0.15, 0.95) * halo * 0.06;',
      '  alpha = max(alpha, halo * (0.22 + aura * 0.35));',
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
    '  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }',
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
    '  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }',
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
    var gl = canvas.getContext('webgl', {
      alpha: !!opts.alpha,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance'
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

    var quality = window.HLS && window.HLS.getQuality ? window.HLS.getQuality() : { dpr: 1 };
    var dpr = quality.dpr;
    var sizeDirty = true;
    var raf = 0;
    var start = performance.now();
    var running = true;

    function resize() {
      var w = canvas.clientWidth;
      var h = canvas.clientHeight;
      if (w < 1 || h < 1) return;
      var nextDpr = window.HLS && window.HLS.getQuality ? window.HLS.getQuality().dpr : dpr;
      if (canvas.width !== Math.round(w * nextDpr) || canvas.height !== Math.round(h * nextDpr)) {
        dpr = nextDpr;
        canvas.width = Math.round(w * nextDpr);
        canvas.height = Math.round(h * nextDpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    }

    function shouldRun() {
      if (opts.heroOnly) {
        return window.HLS && window.HLS.shouldAnimateHero ? window.HLS.shouldAnimateHero() : true;
      }
      return !(document.hidden);
    }

    function draw(now) {
      raf = requestAnimationFrame(draw);
      if (!running) return;
      if (!shouldRun()) return;

      if (sizeDirty) {
        resize();
        sizeDirty = false;
      }

      if (opts.light) {
        gl.clearColor(0.96, 0.97, 0.99, opts.alpha ? 0 : 1);
      } else {
        gl.clearColor(0, 0, 0, opts.alpha ? 0 : 1);
      }
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, (now - start) * 0.001);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function onResize() {
      sizeDirty = true;
    }

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('hls:visibility', onResize);
    window.addEventListener('hls:hero-visibility', onResize);

    resize();
    raf = requestAnimationFrame(draw);

    return function dispose() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('hls:visibility', onResize);
      window.removeEventListener('hls:hero-visibility', onResize);
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
    var quality = window.HLS && window.HLS.getQuality ? window.HLS.getQuality() : { orbSteps: 72, lite: false };
    var bg = document.getElementById('scene-bg');
    var orb = document.getElementById('hero-orb');

    if (bg) {
      disposers.push(initGlCanvas(bg, light ? BG_FS_LIGHT : BG_FS, { alpha: false, light: light }));
    }

    if (orb) {
      var gl = orb.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false });
      if (gl) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
      disposers.push(initGlCanvas(
        orb,
        buildOrbFs(quality.orbSteps || 72, light, !!quality.lite),
        { alpha: true, light: light, heroOnly: true }
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
