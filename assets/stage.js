/* The stage: a sculpted chrome object in a fixed canvas behind the whole page.
   It reshapes itself section by section as you scroll, and bulges where the
   cursor touches it. Classic script (works from file://); three.js is pulled
   in with a dynamic import resolved by the importmap in index.html. */
(function () {
  'use strict';

  var canvas = document.getElementById('stage');
  if (!canvas) return;

  function webglOK() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }
  if (!webglOK()) { canvas.remove(); return; }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function boot() {
    import('three')
      .then(function (THREE) { init(THREE); })
      .catch(function (e) { console.error('stage:', e); canvas.remove(); });
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot, { once: true });

  // Ashima 3D simplex noise (MIT)
  var NOISE = [
    'vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}',
    'vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}',
    'vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}',
    'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}',
    'float snoise(vec3 v){',
    ' const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);',
    ' vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);',
    ' vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);',
    ' vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;',
    ' i=mod289(i);',
    ' vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));',
    ' float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;',
    ' vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);',
    ' vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);',
    ' vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);',
    ' vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));',
    ' vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
    ' vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);',
    ' vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
    ' p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;',
    ' vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;',
    ' return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
    '}'
  ].join('\n');

  // Scroll story: one keyframe per anchor section, in document order.
  // sx/sy are screen fractions; s is scale; amp/freq shape the surface.
  var KEYS = [
    { sel: '#hero',           sx: .78, sy: .46, s: .82, amp: .11, freq: 1.0, wire: 0,   cluster: 0, op: 1,   spin: .12 },
    { sel: '#description',    sx: .83, sy: .50, s: .62, amp: .2,  freq: 1.6, wire: .45, cluster: 0, op: .9,  spin: .2 },
    { sel: '#certifications', sx: .83, sy: .48, s: .7,  amp: .03, freq: .8,  wire: .2,  cluster: 0, op: .95, spin: .06 },
    { sel: '#history',        sx: .87, sy: .52, s: .5,  amp: .18, freq: 1.3, wire: .1,  cluster: 0, op: .55, spin: .3 },
    { sel: '#challenges',     sx: .85, sy: .50, s: .62, amp: .42, freq: 2.4, wire: .35, cluster: 0, op: .38, spin: .5 },
    { sel: '#projects',       sx: .87, sy: .50, s: .26, amp: .1,  freq: 1.4, wire: 0,   cluster: 1, op: .6,  spin: .18 },
    { sel: '#files',          sx: .86, sy: .62, s: .5,  amp: .14, freq: 1.2, wire: .25, cluster: 0, op: .45, spin: .14 },
    { sel: '#author',         sx: .74, sy: .48, s: .85, amp: .16, freq: 1.0, wire: 0,   cluster: 0, op: .9,  spin: .1 }
  ];
  var PROPS = ['sx', 'sy', 's', 'amp', 'freq', 'wire', 'cluster', 'op', 'spin'];

  function init(THREE) {
    var narrowMQ = window.matchMedia('(max-width: 900px)');
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var pmrem = new THREE.PMREMGenerator(renderer);
    // monochrome photo studio: black room, white strip lights -> crisp chrome
    function studio() {
      var env = new THREE.Scene();
      env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: 0x262626, side: THREE.BackSide })));
      function panel(w, h, x, y, z, k) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
        m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
      }
      panel(10, 2.4, 0, 9, 1, 5);      // top softbox
      panel(1.2, 12, -9, 0, 3, 3.2);   // left strip
      panel(.8, 12, 9, 1, -1, 2.6);    // right strip
      panel(8, .5, 0, -4, -10, 1.6);   // low back rim
      panel(3.5, 3.5, 5, 4, 9, 4);     // front key
      panel(2, 2, -6, -6, 6, .9);      // under fill
      panel(40, 1.4, 0, .5, -14, 2.2); // horizon band
      panel(2.5, 6, -7, 2, 8, 2.4);    // front-left strip
      return env;
    }
    scene.environment = pmrem.fromScene(studio(), 0.02).texture;

    var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 8);

    var R = 1.5;
    var U = {
      uTime: { value: 0 }, uAmp: { value: .16 }, uFreq: { value: 1.1 }, uR: { value: R },
      uHit: { value: new THREE.Vector3(0, 0, 1) }, uHitK: { value: 0 }
    };

    var chrome = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1
    });
    chrome.onBeforeCompile = function (sh) {
      Object.keys(U).forEach(function (k) { sh.uniforms[k] = U[k]; });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', [
          '#include <common>',
          'uniform float uTime; uniform float uAmp; uniform float uFreq; uniform float uR;',
          'uniform vec3 uHit; uniform float uHitK;',
          NOISE,
          'float field(vec3 n){',
          '  float f = uAmp * snoise(n * uFreq + vec3(0., uTime * .18, uTime * .11));',
          '  f += uAmp * .35 * snoise(n * uFreq * 2.3 - uTime * .07);',
          '  float d = distance(n, uHit);',
          '  f += uHitK * (.32 * exp(-d * d * 9.) + .05 * sin(d * 22. - uTime * 5.) * exp(-d * 3.));',
          '  return f;',
          '}',
          'vec3 dispP(vec3 n){ return n * (uR + field(n)); }'
        ].join('\n'))
        .replace('#include <beginnormal_vertex>', [
          'vec3 nDir = normalize(position);',
          'vec3 tg = normalize(cross(nDir, abs(nDir.y) < .99 ? vec3(0., 1., 0.) : vec3(1., 0., 0.)));',
          'vec3 bt = normalize(cross(nDir, tg));',
          'vec3 q0 = dispP(nDir);',
          'vec3 q1 = dispP(normalize(nDir + tg * .012));',
          'vec3 q2 = dispP(normalize(nDir + bt * .012));',
          'vec3 objectNormal = normalize(cross(q1 - q0, q2 - q0));',
          'if (dot(objectNormal, nDir) < 0.) objectNormal = -objectNormal;'
        ].join('\n'))
        .replace('#include <begin_vertex>', 'vec3 transformed = q0;');
    };

    var narrow = narrowMQ.matches;
    var aegis = new THREE.Mesh(new THREE.IcosahedronGeometry(1, narrow ? 40 : 96), chrome);
    var rig = new THREE.Group();
    rig.add(aegis);
    scene.add(rig);

    // wireframe halo
    var wireMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    var wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(R * 1.32, 1)), wireMat);
    rig.add(wire);

    // the homelab: 1 lb, 3 control planes, 15 workers
    var plain = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1, clearcoat: 1, envMapIntensity: 1.25 });
    var nodes = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 32, 24), plain, 19);
    var home = [];
    home.push([0, 0, 0, .34]);
    for (var i = 0; i < 3; i++) { var a = i / 3 * Math.PI * 2 + .5; home.push([Math.cos(a) * 1.35, .35, Math.sin(a) * 1.35, .24]); }
    for (var w = 0; w < 15; w++) {
      var y = 1 - (w + .5) / 15 * 2, rr = Math.sqrt(1 - y * y), t = w * 2.39996;
      home.push([Math.cos(t) * rr * 2.8, y * 2.2, Math.sin(t) * rr * 2.8, .17]);
    }
    var links = [];
    for (i = 1; i <= 3; i++) links.push([0, i]);
    for (w = 0; w < 15; w++) { links.push([1 + w % 3, 4 + w]); links.push([4 + w, 4 + (w + 1) % 15]); }
    var linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(links.length * 6), 3));
    var linkMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    var linkLines = new THREE.LineSegments(linkGeo, linkMat);
    var cluster = new THREE.Group();
    cluster.add(nodes, linkLines);
    scene.add(cluster);

    // dust
    var DUST = narrow ? 500 : 1300;
    var dpos = new Float32Array(DUST * 3);
    for (i = 0; i < DUST; i++) {
      dpos[i * 3] = (Math.random() - .5) * 22;
      dpos[i * 3 + 1] = (Math.random() - .5) * 14;
      dpos[i * 3 + 2] = (Math.random() - .5) * 10 - 2;
    }
    var dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    var dustMat = new THREE.PointsMaterial({ color: 0xffffff, size: .018, transparent: true, opacity: .55, depthWrite: false });
    var dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    // ----- theme -----
    function applyTheme() {
      var paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
      var light = paper && parseInt(paper.replace('#', '').slice(0, 2), 16) > 128;
      renderer.toneMappingExposure = light ? .85 : 1;
      chrome.color.set(light ? 0x9a9a9a : 0xffffff);
      plain.color.copy(chrome.color);
      var ink = light ? 0x000000 : 0xffffff;
      wireMat.color.set(ink); linkMat.color.set(ink); dustMat.color.set(ink);
      dustMat.opacity = light ? .35 : .55;
    }
    applyTheme();
    window.addEventListener('themechange', applyTheme);
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);

    // ----- layout -----
    var W = 1, H = 1, halfW = 1, halfH = 1, anchors = [];
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      narrow = narrowMQ.matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      halfH = Math.tan(camera.fov * Math.PI / 360) * camera.position.z;
      halfW = halfH * camera.aspect;
      measure();
    }
    function measure() {
      anchors = [];
      KEYS.forEach(function (k) {
        var el = document.querySelector(k.sel);
        if (el) anchors.push({ y: el.getBoundingClientRect().top + window.scrollY - H * .45, k: k });
      });
      if (anchors.length) anchors[0].y = 0;
    }
    resize();
    window.addEventListener('resize', resize);
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);

    function smooth(t) { return t * t * (3 - 2 * t); }
    function target() {
      var y = window.scrollY, out = {}, a = anchors[0], b = anchors[0], t = 0;
      for (var i = 0; i < anchors.length; i++) {
        if (anchors[i].y <= y) { a = anchors[i]; b = anchors[Math.min(i + 1, anchors.length - 1)]; }
      }
      if (b !== a) t = smooth(Math.min(1, Math.max(0, (y - a.y) / Math.max(1, b.y - a.y))));
      PROPS.forEach(function (p) { out[p] = a.k[p] + (b.k[p] - a.k[p]) * t; });
      if (narrow) {
        out.sx = .5;
        out.sy = a.k.sel === '#hero' && t < .5 ? .3 : .5;
        out.op = Math.min(out.op, a.k.sel === '#hero' && t < .5 ? 1 : .32);
        out.s *= .85;
      }
      return out;
    }
    var S = target();

    // ----- pointer -----
    var ptr = new THREE.Vector2(0, 0), ptrT = new THREE.Vector2(0, 0), hasPtr = false;
    var ray = new THREE.Raycaster(), hitLocal = new THREE.Vector3(), inv = new THREE.Matrix4();
    var sphere = new THREE.Sphere(new THREE.Vector3(), R * 1.1);
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      hasPtr = true;
      ptrT.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1);
    }, { passive: true });
    document.addEventListener('pointerleave', function () { hasPtr = false; });

    // ----- loop -----
    var clock = new THREE.Clock(), time = 0, spin = 0, running = true, hitK = 0;
    var tmp = new THREE.Vector3(), dummy = new THREE.Object3D();
    var hitT = new THREE.Vector3(0, 0, 1);

    function frame() {
      if (!running) return;
      var dt = Math.min(.05, clock.getDelta());
      if (!reduce) time += dt;

      var T = target(), k = reduce ? 1 : 1 - Math.pow(.0016, dt);
      PROPS.forEach(function (p) { S[p] += (T[p] - S[p]) * k; });
      ptr.lerp(ptrT, reduce ? 1 : 1 - Math.pow(.02, dt));

      spin += dt * (reduce ? 0 : S.spin);
      rig.position.set((S.sx * 2 - 1) * halfW, -(S.sy * 2 - 1) * halfH, 0);
      rig.scale.setScalar(S.s * (narrow ? Math.min(1, halfW / 2.2) : 1));
      rig.rotation.set(.25 + ptr.y * .35, spin + ptr.x * .5, 0);
      wire.rotation.set(-spin * .6, -spin * .4, 0);
      wireMat.opacity = S.wire * .5;

      U.uTime.value = time;
      U.uAmp.value = S.amp;
      U.uFreq.value = S.freq;

      // cursor bulge
      var want = 0;
      if (hasPtr && !narrow) {
        rig.updateMatrixWorld();
        ray.setFromCamera(ptr, camera);
        inv.copy(aegis.matrixWorld).invert();
        var r = ray.ray.clone().applyMatrix4(inv);
        if (r.intersectSphere(sphere, hitLocal)) { hitT.copy(hitLocal).normalize(); want = 1; }
      }
      hitK += (want - hitK) * (1 - Math.pow(.01, dt));
      U.uHit.value.lerp(hitT, 1 - Math.pow(.004, dt)).normalize();
      U.uHitK.value = hitK * (reduce ? .6 : 1);

      // cluster assembles out of the centre
      var c = S.cluster;
      aegis.visible = c < .98;
      cluster.visible = c > .02;
      if (cluster.visible) {
        cluster.position.copy(rig.position);
        cluster.rotation.set(.3 + ptr.y * .3, spin * 1.4 + ptr.x * .5, 0);
        var cs = (narrow ? .5 : .46) * (narrow ? Math.min(1, halfW / 2.2) : 1);
        cluster.scale.setScalar(cs);
        var arr = linkGeo.attributes.position.array, pos = [];
        for (var n = 0; n < 19; n++) {
          var h = home[n], e = smooth(Math.min(1, Math.max(0, c * 1.6 - n * .03)));
          tmp.set(h[0] * e, h[1] * e, h[2] * e);
          pos.push(tmp.clone());
          dummy.position.copy(tmp);
          dummy.scale.setScalar(h[3] * e);
          dummy.updateMatrix();
          nodes.setMatrixAt(n, dummy.matrix);
        }
        nodes.instanceMatrix.needsUpdate = true;
        links.forEach(function (l, j) { pos[l[0]].toArray(arr, j * 6); pos[l[1]].toArray(arr, j * 6 + 3); });
        linkGeo.attributes.position.needsUpdate = true;
        linkMat.opacity = c * .35;
      }

      if (!reduce) dust.rotation.y += dt * .01;
      dust.position.y = window.scrollY * .0012 % 4;
      canvas.style.opacity = S.op.toFixed(3);

      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', function () {
      var vis = !document.hidden;
      if (vis && !running) { running = true; clock.getDelta(); requestAnimationFrame(frame); }
      running = vis;
    });
    canvas.classList.add('is-live');
    requestAnimationFrame(frame);
  }
})();
