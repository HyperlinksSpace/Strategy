(function () {
  'use strict';

  var THREE_VER = '0.170.0';
  var depsPromise = null;
  var disposer = null;
  var loadGen = 0;

  var GRAPH_NODES = [
    { x: 0, y: 0.42, z: 0, r: 0.14, hub: true },
    { x: -0.95, y: 0.08, z: -0.55, r: 0.07 },
    { x: 0.88, y: 0.12, z: -0.48, r: 0.08 },
    { x: -0.52, y: -0.05, z: 0.82, r: 0.065 },
    { x: 0.62, y: 0.02, z: 0.75, r: 0.07 },
    { x: -0.78, y: 0.22, z: 0.38, r: 0.055 },
    { x: 0.72, y: 0.18, z: 0.42, r: 0.06 },
    { x: 0.05, y: -0.12, z: -0.88, r: 0.055 },
    { x: -0.28, y: 0.28, z: -0.62, r: 0.05 },
    { x: 0.35, y: 0.24, z: -0.58, r: 0.052 }
  ];

  var GRAPH_EDGES = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
    [1, 5], [1, 8], [2, 6], [2, 9], [3, 4], [3, 5],
    [4, 6], [1, 7], [2, 7], [8, 7], [9, 7], [5, 8], [6, 9]
  ];

  function loadDeps() {
    if (window.__THREE__) return Promise.resolve({ THREE: window.__THREE__ });
    if (!depsPromise) {
      depsPromise = import('https://cdn.jsdelivr.net/npm/three@' + THREE_VER + '/build/three.module.js')
        .then(function (mod) {
          window.__THREE__ = mod;
          return { THREE: mod };
        })
        .catch(function (err) {
          depsPromise = null;
          throw err;
        });
    }
    return depsPromise;
  }

  function getQ() {
    return window.HLS && window.HLS.getQuality ? window.HLS.getQuality() : {
      lite: false, dpr: 1, orbMaxPx: 1280, orbFrameSkip: 1
    };
  }

  function shouldRun() {
    return window.HLS && window.HLS.shouldAnimateHero ? window.HLS.shouldAnimateHero() : !document.hidden;
  }

  function isLight() {
    return window.HLS && window.HLS.isLightTheme ? window.HLS.isLightTheme() : false;
  }

  function getReactive() {
    return window.HLS && window.HLS.getOrbReactive ? window.HLS.getOrbReactive() : {
      intensity: 0.14, hue: 248, pulse: 0.32, speed: 1, mode: 'idle',
      speakingPhase: 0, cursorX: 0, cursorY: 0, cursorActive: 0
    };
  }

  function boundsForCanvas(w, h) {
    var aspect = w / Math.max(h, 1);
    return {
      cx: 0, cy: aspect > 2 || h < 220 ? -0.04 : 0.02, cz: 0,
      r: aspect > 2 || h < 220 ? 1.15 : 1.45,
      strip: aspect > 2 || h < 220
    };
  }

  function createHeroScene(deps, canvas) {
    var THREE = deps.THREE;
    var q = getQ();
    var running = true;
    var raf = 0;
    var frame = 0;
    var start = performance.now();
    var bounds = boundsForCanvas(canvas.clientWidth, canvas.clientHeight);
    var center = new THREE.Vector3(bounds.cx, bounds.cy, bounds.cz);

    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: !q.lite,
      powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isLight() ? 1.02 : 1.55;

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(isLight() ? 0xe8eef8 : 0x060812, isLight() ? 0.08 : 0.14);

    var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    var fitGroup = new THREE.Group();
    var graphGroup = new THREE.Group();
    fitGroup.add(graphGroup);
    scene.add(fitGroup);

    var nodeMeshes = [];
    var nodeMats = [];
    var ni;
    for (ni = 0; ni < GRAPH_NODES.length; ni++) {
      var nd = GRAPH_NODES[ni];
      var geo = nd.hub
        ? new THREE.OctahedronGeometry(nd.r, 0)
        : new THREE.IcosahedronGeometry(nd.r, 0);
      var mat = new THREE.MeshPhysicalMaterial({
        color: isLight() ? 0xd8e4ff : 0x12182a,
        emissive: nd.hub ? 0x7c3aed : 0x2563eb,
        emissiveIntensity: nd.hub ? 1.4 : 0.85,
        metalness: 0.82,
        roughness: 0.12,
        transmission: isLight() ? 0.25 : 0.48,
        thickness: 0.8,
        transparent: true,
        opacity: 0.92,
        clearcoat: 0.6,
        clearcoatRoughness: 0.15
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(nd.x, nd.y, nd.z);
      mesh.userData = { index: ni, hub: !!nd.hub, phase: ni * 0.85, base: nd };
      graphGroup.add(mesh);
      nodeMeshes.push(mesh);
      nodeMats.push(mat);

      if (nd.hub) {
        var haloGeo = new THREE.OctahedronGeometry(nd.r * 1.85, 1);
        var haloMat = new THREE.MeshBasicMaterial({
          color: 0xa78bfa,
          transparent: true,
          opacity: 0.08,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          wireframe: true
        });
        var halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.copy(mesh.position);
        halo.userData = { isHalo: true };
        graphGroup.add(halo);
        nodeMeshes.push(halo);
        nodeMats.push(haloMat);
      }
    }

    var edgePositions = [];
    var edgeColors = [];
    var ei;
    for (ei = 0; ei < GRAPH_EDGES.length; ei++) {
      var a = GRAPH_NODES[GRAPH_EDGES[ei][0]];
      var b = GRAPH_NODES[GRAPH_EDGES[ei][1]];
      edgePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      edgeColors.push(0.55, 0.45, 0.95, 0.75, 0.55, 0.98);
    }
    var edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
    edgeGeo.setAttribute('color', new THREE.Float32BufferAttribute(edgeColors, 3));
    var edgeMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var edges = new THREE.LineSegments(edgeGeo, edgeMat);
    graphGroup.add(edges);

    var packetCount = q.lite ? 14 : 28;
    var packetGeo = new THREE.BufferGeometry();
    var packetPos = new Float32Array(packetCount * 3);
    packetGeo.setAttribute('position', new THREE.BufferAttribute(packetPos, 3));
    var packetMat = new THREE.PointsMaterial({
      size: q.lite ? 0.028 : 0.042,
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    var packets = new THREE.Points(packetGeo, packetMat);
    graphGroup.add(packets);

    var packetState = [];
    for (ei = 0; ei < packetCount; ei++) {
      packetState.push({
        edge: ei % GRAPH_EDGES.length,
        t: Math.random(),
        speed: 0.12 + Math.random() * 0.22
      });
    }

    var starCount = q.lite ? 120 : 220;
    var starPos = new Float32Array(starCount * 3);
    for (ei = 0; ei < starCount; ei++) {
      starPos[ei * 3] = (Math.random() - 0.5) * 12;
      starPos[ei * 3 + 1] = (Math.random() - 0.5) * 8;
      starPos[ei * 3 + 2] = -2 - Math.random() * 6;
    }
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    var starMat = new THREE.PointsMaterial({
      size: 0.015,
      color: 0xc4b5fd,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    var stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    var pulseWaves = [];
    var impulseFlash = 0;
    var shockRings = [];

    document.addEventListener('ai-core:orb', function (e) {
      var d = e.detail || {};
      if (d.mode === 'user' || d.mode === 'navigate') {
        impulseFlash = Math.max(impulseFlash, d.impulse || 0.85);
        pulseWaves.push({ t: 0, speed: d.mode === 'user' ? 2.8 : 2.1, strength: d.impulse || 0.7 });
        var ringGeo = new THREE.RingGeometry(0.06, 0.11, 40);
        var ringMat = new THREE.MeshBasicMaterial({
          color: d.mode === 'user' ? 0xf472b6 : 0x38bdf8,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        var ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -0.6;
        ring.position.set(0, 0.42, 0);
        graphGroup.add(ring);
        shockRings.push({ mesh: ring, mat: ringMat, t: 0, speed: d.mode === 'user' ? 2.6 : 2 });
      } else if (d.mode === 'listening') {
        pulseWaves.push({ t: 0, speed: 1.6, strength: 0.55 });
        impulseFlash = Math.max(impulseFlash, 0.35);
        var listenGeo = new THREE.RingGeometry(0.05, 0.09, 36);
        var listenMat = new THREE.MeshBasicMaterial({
          color: 0x34d399,
          transparent: true,
          opacity: 0.45,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        var listenRing = new THREE.Mesh(listenGeo, listenMat);
        listenRing.rotation.x = -0.55;
        listenRing.position.set(0, 0.42, 0);
        graphGroup.add(listenRing);
        shockRings.push({ mesh: listenRing, mat: listenMat, t: 0, speed: 1.8 });
      } else if (d.mode === 'speaking') {
        pulseWaves.push({ t: 0, speed: 1.2, strength: 0.5 });
        impulseFlash = Math.max(impulseFlash, 0.28);
      } else if (d.mode === 'thinking' || d.mode === 'typing') {
        pulseWaves.push({ t: 0, speed: 1.35, strength: 0.42 });
      }
    });

    var amb = new THREE.AmbientLight(isLight() ? 0xeef2ff : 0x080a14, isLight() ? 0.75 : 0.35);
    var key = new THREE.DirectionalLight(0x818cf8, isLight() ? 0.9 : 2.4);
    key.position.set(2.5, 4, 3);
    var rim = new THREE.DirectionalLight(0x22d3ee, isLight() ? 0.45 : 1.15);
    rim.position.set(-3.5, 0.5, -2);
    var hubLight = new THREE.PointLight(0xa78bfa, 1.2, 8);
    hubLight.position.set(0, 0.42, 0);
    var cursorLight = new THREE.PointLight(0xf472b6, 0, 14);
    scene.add(amb, key, rim, hubLight, cursorLight);

    var rotX = 0.14;
    var rotY = -0.38;
    var targetRotX = rotX;
    var targetRotY = rotY;

    function lerpNode(a, b, t) {
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t
      };
    }

    function applyReactive(t, rx) {
      var energy = rx.intensity || 0.14;
      var hue = (rx.hue || 248) / 360;
      var pulse = rx.pulse || 0.3;
      var speed = rx.speed || 1;
      var mode = rx.mode || 'idle';
      var speakWave = mode === 'speaking'
        ? Math.sin(rx.speakingPhase || t * 3.5) * 0.5 + 0.5
        : 0;
      var cx = rx.cursorX || 0;
      var cy = rx.cursorY || 0;
      var cActive = rx.cursorActive || 0;

      var waveBoost = 0;
      var wi;
      for (wi = pulseWaves.length - 1; wi >= 0; wi--) {
        pulseWaves[wi].t += 0.019 * pulseWaves[wi].speed;
        waveBoost = Math.max(waveBoost, Math.max(0, 1 - pulseWaves[wi].t) * pulseWaves[wi].strength);
        if (pulseWaves[wi].t > 1) pulseWaves.splice(wi, 1);
      }

      var meshIdx;
      for (meshIdx = 0; meshIdx < nodeMeshes.length; meshIdx++) {
        var mesh = nodeMeshes[meshIdx];
        var mat = nodeMats[meshIdx];
        if (mesh.userData.isHalo) {
          mesh.rotation.y = t * 0.35 * speed;
          mesh.rotation.x = t * 0.22;
          mat.opacity = 0.06 + energy * 0.12 + speakWave * 0.08 + waveBoost * 0.15;
          continue;
        }
        var base = mesh.userData.base;
        var wobble = Math.sin(t * 1.4 * speed + mesh.userData.phase) * 0.025 * energy;
        var cPull = cActive * 0.08;
        mesh.position.x = base.x + wobble + cx * cPull * (base.hub ? 0.3 : 0.6);
        mesh.position.y = base.y + Math.sin(t * 0.9 + mesh.userData.phase) * 0.02 * pulse + speakWave * 0.04;
        mesh.position.z = base.z + cy * cPull * (base.hub ? 0.25 : 0.5);

        if (base.hub) {
          mesh.rotation.y = t * 0.55 * speed;
          mesh.scale.setScalar(1 + speakWave * 0.18 + waveBoost * 0.12 + impulseFlash * 0.1);
          hubLight.intensity = 1 + energy * 2.5 + speakWave * 1.8 + waveBoost * 2;
          hubLight.color.setHSL((hue + 0.72) % 1, 0.85, 0.58);
        } else {
          mesh.rotation.x = t * 0.4 + mesh.userData.phase;
          mesh.rotation.z = t * 0.28 * speed;
          var nScale = 1 + speakWave * 0.15 + (mode === 'user' ? impulseFlash * 0.25 : 0);
          mesh.scale.setScalar(nScale);
        }

        if (mat.emissive) {
          mat.emissive.setHSL((hue + mesh.userData.index * 0.025 + (base.hub ? 0.65 : 0.45)) % 1, 0.78, 0.42 + energy * 0.12);
          mat.emissiveIntensity = (base.hub ? 1.1 : 0.65) + energy * 1.8 + speakWave * 0.9 + waveBoost;
        }
      }

      edgeMat.opacity = Math.min(0.92, 0.22 + energy * 0.45 + waveBoost * 0.55 + speakWave * 0.15);
      var ec = edgeGeo.attributes.color.array;
      for (ei = 0; ei < GRAPH_EDGES.length; ei++) {
        var eh = (hue + ei * 0.012 + waveBoost * 0.06) % 1;
        ec[ei * 6] = ec[ei * 6 + 3] = eh;
        ec[ei * 6 + 1] = ec[ei * 6 + 4] = 0.72;
        ec[ei * 6 + 2] = ec[ei * 6 + 5] = 0.58 + speakWave * 0.12;
      }
      edgeGeo.attributes.color.needsUpdate = true;
      packetMat.color.setHSL((hue + 0.48) % 1, 0.85, 0.58);
      packetMat.opacity = 0.4 + energy * 0.45 + (mode === 'thinking' ? 0.35 : 0);
      packetMat.size = (q.lite ? 0.028 : 0.042) * (1 + speakWave * 0.35);

      var pi;
      var pArr = packetGeo.attributes.position.array;
      for (pi = 0; pi < packetCount; pi++) {
        var ps = packetState[pi];
        ps.t += ps.speed * 0.007 * speed * (
          mode === 'thinking' ? 2.8 : mode === 'typing' ? 2.1 : mode === 'listening' ? 1.6 : 1
        );
        if (ps.t > 1) ps.t -= 1;
        var edge = GRAPH_EDGES[ps.edge];
        var pA = GRAPH_NODES[edge[0]];
        var pB = GRAPH_NODES[edge[1]];
        var pt = lerpNode(pA, pB, ps.t);
        pArr[pi * 3] = pt.x;
        pArr[pi * 3 + 1] = pt.y;
        pArr[pi * 3 + 2] = pt.z;
      }
      packetGeo.attributes.position.needsUpdate = true;

      var sri;
      for (sri = shockRings.length - 1; sri >= 0; sri--) {
        var sr = shockRings[sri];
        sr.t += 0.024 * sr.speed;
        sr.mesh.scale.setScalar(1 + sr.t * 3.8);
        sr.mat.opacity = Math.max(0, 0.55 - sr.t * 0.6);
        if (sr.t > 1) {
          graphGroup.remove(sr.mesh);
          sr.mesh.geometry.dispose();
          sr.mat.dispose();
          shockRings.splice(sri, 1);
        }
      }

      key.intensity = (isLight() ? 0.8 : 1.4) + energy * 2.2 + speakWave;
      key.color.setHSL((hue + 0.08) % 1, 0.72, 0.55);
      rim.intensity = (isLight() ? 0.35 : 0.85) + energy * 1.3;
      rim.color.setHSL((hue + 0.42) % 1, 0.78, 0.52);

      targetRotY = -0.38 + cx * 0.72 * cActive + impulseFlash * 0.15;
      targetRotX = 0.14 + cy * 0.48 * cActive;
      rotX += (targetRotX - rotX) * 0.085;
      rotY += (targetRotY - rotY) * 0.085;
      graphGroup.rotation.x = rotX;
      graphGroup.rotation.y = rotY + Math.sin(t * 0.04 * speed) * 0.02 * energy;
      impulseFlash *= 0.86;

      cursorLight.intensity = cActive * (2.8 + energy * 3);
      cursorLight.color.setHSL((hue + 0.55) % 1, 0.9, 0.58);
      cursorLight.position.set(cx * 2.6, 0.5 - cy * 2, 2.8);

      if (mode === 'navigate') {
        graphGroup.rotation.z = Math.sin(t * 1.3) * 0.07 * pulse;
        fitGroup.position.y = center.y + Math.sin(t * 0.75) * 0.05 * pulse;
      } else {
        graphGroup.rotation.z *= 0.9;
        fitGroup.position.y += (center.y - fitGroup.position.y) * 0.06;
      }

      graphGroup.scale.setScalar(1 + (energy - 0.12) * 0.06 + impulseFlash * 0.04);
      starMat.opacity = 0.2 + energy * 0.25 + waveBoost * 0.15;
      stars.rotation.y = t * 0.008 * speed;
    }

    function fitCamera() {
      var dir = new THREE.Vector3(1.5, -0.95, 4.4).normalize();
      var halfRad = (camera.fov * Math.PI) / 360;
      var dist = (bounds.r * 0.9) / Math.tan(halfRad);
      camera.position.copy(center).add(dir.multiplyScalar(dist));
      camera.lookAt(center.x, center.y + 0.05, center.z);
    }

    function resize() {
      var cw = canvas.clientWidth;
      var ch = canvas.clientHeight;
      if (cw < 1 || ch < 1) return;
      bounds = boundsForCanvas(cw, ch);
      center.set(bounds.cx, bounds.cy, bounds.cz);
      var qq = getQ();
      var dpr = qq.lite ? 1 : Math.min(qq.dpr || 2, window.devicePixelRatio || 1, 2);
      var maxPx = qq.orbMaxPx || 1280;
      if (maxPx > 0) dpr = Math.min(dpr, maxPx / Math.max(cw, ch));
      renderer.setPixelRatio(dpr);
      renderer.setSize(cw, ch, false);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      fitCamera();
      fitGroup.scale.setScalar(bounds.strip ? 0.78 : 1);
      fitGroup.position.copy(center);
    }

    function tick(now) {
      raf = 0;
      if (!running || !shouldRun()) return;
      frame += 1;
      if (frame % (getQ().orbFrameSkip || 1) !== 0) { schedule(); return; }
      var t = (now - start) * 0.001;
      applyReactive(t, getReactive());
      var t0 = performance.now();
      renderer.render(scene, camera);
      if (!canvas.dataset.live) canvas.dataset.live = '1';
      if (window.HLS && window.HLS.reportFrameTime) {
        window.HLS.reportFrameTime(performance.now() - t0);
      }
      schedule();
    }

    function schedule() {
      if (!raf && running && shouldRun()) raf = requestAnimationFrame(tick);
    }

    function wake() { resize(); schedule(); }

    if (window.ResizeObserver) new ResizeObserver(wake).observe(canvas);
    ['hls:visibility', 'hls:hero-visibility', 'hls:scroll-idle', 'hls:quality-change', 'hls:theme-applied'].forEach(function (ev) {
      window.addEventListener(ev, wake);
    });

    resize();
    schedule();
    window.dispatchEvent(new Event('hls:hero-scene-ready'));

    return function dispose() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      edgeGeo.dispose();
      edgeMat.dispose();
      packetGeo.dispose();
      packetMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      nodeMeshes.forEach(function (m) {
        if (m.geometry) m.geometry.dispose();
      });
      nodeMats.forEach(function (m) { m.dispose(); });
      shockRings.forEach(function (sr) {
        sr.mesh.geometry.dispose();
        sr.mat.dispose();
      });
      renderer.dispose();
    };
  }

  function init() {
    loadGen += 1;
    if (disposer) { disposer(); disposer = null; }
    var bg = document.getElementById('scene-bg');
    if (bg) bg.classList.add('scene-bg--static');
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var canvas = document.getElementById('hero-orb');
    if (!canvas) return;
    var gen = loadGen;
    loadDeps().then(function (deps) {
      if (gen !== loadGen) return;
      disposer = createHeroScene(deps, canvas);
    }).catch(function (err) {
      console.warn('[scene]', err);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('hls:theme-applied', init);
})();
