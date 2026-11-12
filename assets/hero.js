/* fig. 0 — the k8s homelab (1 HAProxy, 3 control planes, 15 workers on
   Rook Ceph) drawn in three.js, then re-rendered as monospace glyphs so the
   scene reads as part of the manual page. Falls back to the static <pre>
   when WebGL or motion is unavailable. */

const hero = document.getElementById('hero');
const canvas = document.getElementById('hero-canvas');
const label = document.getElementById('hero-label');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(pointer: fine)');

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

// ---------- The cluster (same layout as the static fallback) ----------
export function layout() {
  const nodes = [{ name: 'haproxy-lb', role: 'lb', info: 'load balancer · :6443 → cp-1..3', p: [0, -0.15, 0] }];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    nodes.push({ name: 'cp-' + (i + 1), role: 'cp', info: 'control-plane · etcd member', p: [Math.cos(a) * 1.15, 0.45, Math.sin(a) * 1.15] });
  }
  const R = 2.55;
  for (let i = 0; i < 15; i++) {
    const y = 1 - ((i + 0.5) / 15) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = i * 2.39996;
    const n = String(i + 1).padStart(2, '0');
    nodes.push({ name: 'worker-' + n, role: 'w', info: 'worker · ceph-osd.' + i + ' · 500G', p: [Math.cos(t) * r * R, y * R * 0.82, Math.sin(t) * r * R] });
  }
  const strong = [], mesh = [];
  for (let i = 1; i <= 3; i++) strong.push([0, i]);
  strong.push([1, 2], [2, 3], [3, 1]);
  for (let w = 0; w < 15; w++) strong.push([1 + (w % 3), 4 + w]);
  for (let w = 0; w < 15; w++) {
    mesh.push([4 + w, 4 + ((w + 1) % 15)]);
    mesh.push([4 + w, 4 + ((w + 4) % 15)]);
  }
  return { nodes, strong, mesh };
}

const GLYPHS = ' .:-=+*#%@';

function readInk() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--ink-strong').trim() || '#ffffff';
  const hex = v.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

async function start() {
  const THREE = await import('three');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  } catch (e) { return; }
  renderer.setClearColor(0x000000, 0);

  // ----- glyph atlas -----
  try { await document.fonts.load('600 32px "IBM Plex Mono"'); } catch (e) { /* system mono is fine */ }
  const GW = 24, GH = 40;
  const atlas = document.createElement('canvas');
  atlas.width = GW * GLYPHS.length; atlas.height = GH;
  const ctx = atlas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.font = '600 32px "IBM Plex Mono", ui-monospace, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < GLYPHS.length; i++) ctx.fillText(GLYPHS[i], i * GW + GW / 2, GH / 2 + 2);
  const glyphTex = new THREE.CanvasTexture(atlas);
  glyphTex.minFilter = THREE.LinearFilter;
  glyphTex.magFilter = THREE.LinearFilter;
  glyphTex.generateMipmaps = false;

  // ----- scene -----
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 5.2, 10.5);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
  camera.position.set(0, 0, 7.4);
  const group = new THREE.Group();
  scene.add(group);

  const { nodes, strong, mesh } = layout();
  const V = nodes.map((n) => new THREE.Vector3(n.p[0], n.p[1], n.p[2]));

  function edges(list, color) {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(list.length * 6);
    list.forEach(([a, b], i) => { V[a].toArray(arr, i * 6); V[b].toArray(arr, i * 6 + 3); });
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, fog: true }));
  }
  group.add(edges(strong, 0xffffff));
  group.add(edges(mesh, 0x8c8c8c));

  const shell = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(3.35, 1)),
    new THREE.LineBasicMaterial({ color: 0x3c3c3c, fog: true })
  );
  group.add(shell);

  function points(idx, size, color) {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(idx.length * 3);
    idx.forEach((k, i) => V[k].toArray(arr, i * 3));
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, color, fog: true }));
  }
  group.add(points([0], 5, 0xffffff));
  group.add(points([1, 2, 3], 4, 0xffffff));
  group.add(points(nodes.map((_, i) => i).slice(4), 3, 0xdddddd));

  // hovered node + travelling packet
  const hot = points([0], 7, 0xffffff); hot.visible = false; group.add(hot);
  const packet = points([0], 3, 0xffffff); group.add(packet);
  const allEdges = strong.concat(mesh);
  let pk = { a: V[0], b: V[1], t: 1, wait: 0.6 };

  // ----- ASCII pass -----
  const rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  const uniforms = {
    tScene: { value: rt.texture },
    tGlyph: { value: glyphTex },
    uCell: { value: new THREE.Vector2(8, 13) },
    uGrid: { value: new THREE.Vector2(1, 1) },
    uCount: { value: GLYPHS.length },
    uDissolve: { value: 0 },
    uInk: { value: new THREE.Vector3(...readInk()) }
  };
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        precision highp float;
        uniform sampler2D tScene; uniform sampler2D tGlyph;
        uniform vec2 uCell; uniform vec2 uGrid; uniform float uCount; uniform float uDissolve; uniform vec3 uInk;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          vec2 p = gl_FragCoord.xy;
          vec2 cell = floor(p / uCell);
          float l = texture2D(tScene, (cell + 0.5) / uGrid).r;
          if (hash(cell) < uDissolve) l = 0.0;
          float idx = floor(clamp(l, 0.0, 0.999) * uCount);
          if (idx < 0.5) discard;
          vec2 local = fract(p / uCell);
          float a = texture2D(tGlyph, vec2((idx + 0.04 + local.x * 0.92) / uCount, local.y)).a;
          gl_FragColor = vec4(uInk * a, a);
        }`
    })
  );
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ----- sizing -----
  let W = 1, H = 1, narrow = false;
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    narrow = W < 720;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    const cw = (narrow ? 7 : 8) * dpr, ch = (narrow ? 11.5 : 13) * dpr;
    const cols = Math.ceil((W * dpr) / cw), rows = Math.ceil((H * dpr) / ch);
    uniforms.uCell.value.set(cw, ch);
    uniforms.uGrid.value.set(cols, rows);
    rt.setSize(cols, rows);
    camera.aspect = (cols * cw) / (rows * ch);
    camera.updateProjectionMatrix();
    // keep the cluster clear of the name: right on desktop, top on phones
    const halfW = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * camera.aspect;
    if (narrow) { group.position.set(0, 1.15, 0); group.scale.setScalar(Math.min(0.8, halfW / 3)); }
    else { group.position.set(halfW * 0.6, 0.35, 0); group.scale.setScalar(Math.min(0.85, halfW / 5.4)); }
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  // ----- input -----
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, px: -1, py: -1 };
  hero.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.px = e.clientX - r.left; pointer.py = e.clientY - r.top;
    pointer.tx = (pointer.px / r.width) * 2 - 1;
    pointer.ty = (pointer.py / r.height) * 2 - 1;
  });
  hero.addEventListener('pointerleave', () => { pointer.tx = pointer.ty = 0; pointer.px = pointer.py = -1; });

  window.addEventListener('themechange', () => uniforms.uInk.value.set(...readInk()));
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => uniforms.uInk.value.set(...readInk()));

  // ----- loop -----
  let visible = true, running = false, last = 0, spin = 0.6;
  const tmp = new THREE.Vector3();
  const defaultLabel = finePointer.matches ? 'hover a node' : '';
  let hoverIdx = -1;

  function hover() {
    if (!finePointer.matches || pointer.px < 0 || narrow) return -1;
    let best = -1, bd = 26 * 26;
    for (let i = 0; i < V.length; i++) {
      tmp.copy(V[i]).applyMatrix4(group.matrixWorld).project(camera);
      const sx = (tmp.x * 0.5 + 0.5) * W, sy = (-tmp.y * 0.5 + 0.5) * H;
      const d = (sx - pointer.px) ** 2 + (sy - pointer.py) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;

    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    if (hoverIdx < 0) spin += dt * 0.09;
    group.rotation.set(0.32 + pointer.y * 0.22, spin + pointer.x * 0.45, 0);

    // packet along a random edge
    if (pk.t >= 1) {
      pk.wait -= dt;
      packet.visible = false;
      if (pk.wait <= 0) {
        const e = allEdges[(Math.random() * allEdges.length) | 0];
        pk = Math.random() < 0.5 ? { a: V[e[0]], b: V[e[1]], t: 0, wait: 0.5 + Math.random() } : { a: V[e[1]], b: V[e[0]], t: 0, wait: 0.5 + Math.random() };
      }
    } else {
      pk.t = Math.min(1, pk.t + dt * 1.1);
      packet.visible = true;
      tmp.copy(pk.a).lerp(pk.b, pk.t);
      packet.geometry.attributes.position.setXYZ(0, tmp.x, tmp.y, tmp.z);
      packet.geometry.attributes.position.needsUpdate = true;
    }

    group.updateMatrixWorld();
    const h = hover();
    if (h !== hoverIdx) {
      hoverIdx = h;
      hot.visible = h >= 0;
      if (h >= 0) {
        hot.geometry.attributes.position.setXYZ(0, V[h].x, V[h].y, V[h].z);
        hot.geometry.attributes.position.needsUpdate = true;
        label.textContent = nodes[h].name + '  Ready  ' + nodes[h].info;
      } else label.textContent = defaultLabel;
      hero.classList.toggle('is-probing', h >= 0);
    }

    const scrolled = Math.max(0, window.scrollY) / Math.max(1, hero.offsetHeight);
    uniforms.uDissolve.value = Math.min(0.9, scrolled * 1.1);

    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 1);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 0);
    renderer.render(quadScene, quadCam);
    requestAnimationFrame(frame);
  }

  function setRunning() {
    const want = visible && !document.hidden;
    if (want && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    else if (!want) running = false;
  }
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; setRunning(); }).observe(hero);
  document.addEventListener('visibilitychange', setRunning);

  label.textContent = defaultLabel;
  hero.classList.add('is-live');
  setRunning();
}

if (hero && canvas && !reduce.matches && webglOK()) {
  const go = () => start().catch(() => hero.classList.remove('is-live'));
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}
