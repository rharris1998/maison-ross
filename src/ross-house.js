// Ross Home · House view. A cut-away 3D model of 122 Glenview built from
// house-plan.js, with Ross's devices pinned where they are. Rooms glow while
// their lights are on, the sky follows the sun and the weather, and in
// placement mode pins are dragged into place and saved to the dashboard.
import * as THREE from 'three';
import {OrbitControls} from '../vendor/three/OrbitControls.js';
import {HOUSE} from './house-plan.js';

const WALL_T = 0.1;
// Walls are cut away at this height so you can see into every room.
const CUT = 1.45;
const PIN_DOMAINS = ['light', 'camera', 'fan', 'binary_sensor', 'sensor', 'climate', 'humidifier', 'media_player', 'vacuum', 'lock', 'cover', 'switch'];
const AUTO_SENSOR_CLASSES = ['motion', 'occupancy', 'door', 'window', 'temperature', 'humidity'];
const FLOOR_COLOURS = {wood: 0xb68a60, tile: 0xd6d1c7, carpet: 0x98a2ad};
const C = {
  wall: 0xeeebe6, glass: 0x9fd0ff, plinth: 0x2b313a, wood: 0x8a6a4e, oak: 0xc29a6b, white: 0xf3f2ef,
  dark: 0x2a2f36, fabric: 0x5f6d7c, linen: 0xe9e3d8, duvet: 0x8fa7b8, accent: 0xc9a46a, rug: 0x7d8a96,
  leaf: 0x4f7d4a, stair: 0x9c7b5a, grass: 0x3c5a34, paving: 0x59606a, street: 0x3a3f46,
};

const css = `
.hv [hidden]{display:none!important}
.hv{position:fixed;inset:0;z-index:15;overflow:hidden;color:var(--text);font-family:inherit;background:var(--hv-bg,#0b1018);transition:background 1.2s}
.hv canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.hv-pins{position:absolute;inset:0;pointer-events:none}
.pin{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;display:grid;place-items:center;pointer-events:auto;cursor:pointer;
  border:1.5px solid rgba(255,255,255,.18);background:rgba(16,22,32,.78);color:#dfe6ef;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  box-shadow:0 6px 16px rgba(0,0,0,.35);transition:background .3s,color .3s,box-shadow .3s;touch-action:none;padding:0;font:inherit}
.pin svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.pin.on{background:#fbbf24;color:#3a2600;border-color:#fde68a;box-shadow:0 0 0 6px rgba(251,191,36,.22),0 0 26px rgba(251,191,36,.65)}
.pin.k-camera.on{background:#38bdf8;color:#04263a;border-color:#bae6fd;box-shadow:0 0 0 6px rgba(56,189,248,.2),0 0 22px rgba(56,189,248,.5)}
.pin.k-fan.on{background:#34d399;color:#03291c;border-color:#a7f3d0;box-shadow:0 0 0 6px rgba(52,211,153,.2),0 0 22px rgba(52,211,153,.5)}
.pin.alert{background:#ff5d7a;color:#fff;border-color:#ffc2cd;box-shadow:0 0 0 6px rgba(255,93,122,.22),0 0 24px rgba(255,93,122,.6)}
.pin.off-line{opacity:.45}
.pin .pv{position:absolute;top:100%;margin-top:4px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:12px;font-weight:700;padding:2px 7px;border-radius:999px;background:rgba(16,22,32,.82);color:#eef2f7}
.pin.edit{border:2px dashed #8d7bff;cursor:grab}
.pin.edit.drag{cursor:grabbing;box-shadow:0 0 0 8px rgba(141,123,255,.35),0 10px 24px rgba(0,0,0,.45)}
.pin .rm{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#ff5d7a;color:#fff;font-size:13px;line-height:20px;text-align:center;font-weight:700}
.rlabel{position:absolute;left:0;top:0;white-space:nowrap;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 9px;border-radius:999px;
  background:rgba(16,22,32,.6);color:#e6ebf2;pointer-events:none;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.rlabel b{font-weight:800;color:#fbbf24;margin-left:6px;letter-spacing:0}
.hv-top{position:absolute;top:calc(env(safe-area-inset-top,0px) + 16px);left:calc(env(safe-area-inset-left,0px) + 16px);right:calc(env(safe-area-inset-right,0px) + 16px);display:flex;align-items:center;gap:10px;flex-wrap:wrap;pointer-events:none}
.hv-top>*{pointer-events:auto}
.hv-chip{display:inline-flex;align-items:center;gap:10px;min-height:48px;padding:0 16px;border-radius:999px;background:rgba(16,22,32,.72);color:#eef2f7;border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font:inherit;font-size:15px}
.hv-chip b{font-weight:700}.hv-chip .dim{color:#a3acbb}
.hv-seg{display:inline-flex;padding:4px;gap:4px;border-radius:999px;background:rgba(16,22,32,.72);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.hv-seg button{min-height:40px;padding:0 16px;border-radius:999px;border:0;background:none;color:#c9d1dc;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.hv-seg button.on{background:#eef2f7;color:#101722}
.hv-btn{min-height:48px;min-width:48px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(16,22,32,.72);color:#eef2f7;font:inherit;font-size:14px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.hv-btn svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.hv-btn.primary{background:#8d7bff;border-color:#8d7bff;color:#fff}
.hv-spacer{flex:1}
.hv-wx{position:absolute;right:calc(env(safe-area-inset-right,0px) + 20px);bottom:calc(env(safe-area-inset-bottom,0px) + 18px);text-align:right;color:#eef2f7;text-shadow:0 2px 12px rgba(0,0,0,.5);pointer-events:none}
.hv-wx .t{font-size:34px;font-weight:500;line-height:1}.hv-wx .t small{font-size:16px;margin-left:6px;font-weight:600}
.hv-wx .s{font-size:13px;color:#cdd5e0;margin-top:4px}
.hv-room{position:absolute;left:calc(env(safe-area-inset-left,0px) + 16px);bottom:calc(env(safe-area-inset-bottom,0px) + 16px);width:min(360px,calc(100% - 32px));max-height:55%;overflow:auto;padding:16px;border-radius:24px;background:rgba(16,22,32,.86);color:#eef2f7;
  border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 18px 40px rgba(0,0,0,.4)}
.hv-room h3{margin:0;font-size:20px;font-weight:600;display:flex;align-items:center;gap:10px}
.hv-room h3 .x{margin-left:auto}
.hv-room .sub{color:#a3acbb;font-size:13px;margin:4px 0 10px}
.hv-row{display:flex;align-items:center;gap:12px;min-height:56px;padding:6px 10px;border-radius:16px;background:rgba(255,255,255,.05);margin-top:6px;width:100%;border:0;color:inherit;font:inherit;text-align:left;cursor:pointer}
.hv-row .i{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.08)}
.hv-row .i svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.hv-row.on .i{background:#fbbf24;color:#3a2600}
.hv-row .n{flex:1;min-width:0}.hv-row .n div:first-child{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hv-row .n div:last-child{font-size:12.5px;color:#a3acbb}
.hv-tray{position:absolute;left:calc(env(safe-area-inset-left,0px) + 16px);right:calc(env(safe-area-inset-right,0px) + 16px);bottom:calc(env(safe-area-inset-bottom,0px) + 16px);padding:12px;border-radius:22px;background:rgba(16,22,32,.88);border:1px solid rgba(255,255,255,.1);color:#eef2f7;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.hv-tray .hint{font-size:13px;color:#a3acbb;margin:0 4px 8px}
.hv-tray .chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px}
.hv-tray .chip{flex:none;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:inherit;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}
.hv-tray .chip svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.hv-toast{position:absolute;left:50%;top:80px;transform:translateX(-50%);padding:10px 16px;border-radius:999px;background:rgba(16,22,32,.9);color:#eef2f7;font-size:14px;font-weight:600;pointer-events:none}
.hv-fail{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:32px;color:#cdd5e0}
@media (max-width:720px){
  .hv-top{top:calc(env(safe-area-inset-top,0px) + 10px);left:10px;right:10px;gap:8px;flex-wrap:nowrap}
  .hv-chip.title,.hv-chip.sum{display:none}
  .hv-seg button{padding:0 13px;min-height:40px}
  .hv-btn{min-width:46px;min-height:46px;padding:0 12px}.hv-btn .lbl{display:none}
  .hv-btn.save .lbl,.hv-btn.cancel .lbl{display:inline}
  .hv-wx{right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px)}.hv-wx .t{font-size:26px}.hv-wx .s{font-size:12px}
  .hv-room{left:10px;right:10px;width:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 10px)}
  .hv-tray{left:10px;right:10px;bottom:calc(env(safe-area-inset-bottom,0px) + 10px)}
}
`;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const domainOf = (id) => id.split('.')[0];
const centroid = (poly) => {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length], f = x1 * z2 - x2 * z1;
    a += f; cx += (x1 + x2) * f; cz += (z1 + z2) * f;
  }
  a /= 2;
  return Math.abs(a) < 1e-6 ? poly[0] : [cx / (6 * a), cz / (6 * a)];
};
const insidePoly = (poly, x, z) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

export class HouseView {
  constructor(host, opts) {
    this.host = host;
    this.o = opts;
    this.floorId = opts.floor || 'ground';
    this.layout = JSON.parse(JSON.stringify(opts.layout || {}));
    this.hidden = [...(opts.hidden || [])];
    this.editing = false;
    this.pins = new Map();
    this.labels = new Map();
    this.need = true;
    host.innerHTML = `<style>${css}</style><div class="hv">
      <div class="hv-pins"></div>
      <div class="hv-top">
        <span class="hv-chip title"><b>Our house</b></span>
        <span class="hv-chip sum"></span>
        <span class="hv-seg">${HOUSE.floors.map((f) => `<button data-floor="${f.id}">${esc(f.name)}</button>`).join('')}</span>
        <span class="hv-spacer"></span>
        <button class="hv-btn place">${opts.icon('plus')}<span class="lbl">Place devices</span></button>
        <button class="hv-btn save primary" hidden>${opts.icon('check')}<span class="lbl">Save</span></button>
        <button class="hv-btn cancel" hidden><span class="lbl">Cancel</span></button>
        <button class="hv-btn close" aria-label="Close">${opts.icon('x')}</button>
      </div>
      <div class="hv-wx"></div>
      <div class="hv-room" hidden></div>
      <div class="hv-tray" hidden></div>
    </div>`;
    this.el = host.querySelector('.hv');
    this.pinLayer = host.querySelector('.hv-pins');
    this._wireHud();
    try { this._initThree(); } catch (e) {
      console.warn('ross-home house', e);
      this.el.insertAdjacentHTML('beforeend', '<div class="hv-fail">This screen can\'t show 3D graphics (WebGL is off or unsupported).</div>');
      this.failed = true;
      return;
    }
    this._buildScene();
    this.setFloor(this.floorId);
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  // ---- Set-up --------------------------------------------------------------
  _wireHud() {
    const q = (s) => this.el.querySelector(s);
    this.el.querySelectorAll('[data-floor]').forEach((b) => b.addEventListener('click', () => this.setFloor(b.dataset.floor)));
    q('.close').addEventListener('click', () => (this.editing ? this._endEdit(false) : this.o.onAction('close')));
    q('.place').addEventListener('click', () => this._startEdit());
    q('.save').addEventListener('click', () => this._endEdit(true));
    q('.cancel').addEventListener('click', () => this._endEdit(false));
  }
  _initThree() {
    const r = this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'high-performance'});
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    this.el.prepend(r.domElement);
    const {w, d} = HOUSE.footprint;
    this.center = new THREE.Vector3(w / 2, 0, d / 2);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.camera.position.set(this.center.x - 1.6, 13.5, this.center.z + 6.2);
    const ctl = this.controls = new OrbitControls(this.camera, r.domElement);
    ctl.target.copy(this.center);
    ctl.enableDamping = true;
    ctl.dampingFactor = 0.09;
    ctl.minDistance = 6;
    ctl.maxDistance = 30;
    ctl.minPolarAngle = 0.12;
    ctl.maxPolarAngle = 1.2;
    ctl.screenSpacePanning = false;
    ctl.addEventListener('change', () => { this.need = true; });
    ctl.addEventListener('start', () => { this._userMoved = true; });
    ctl.update();
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.ro = new ResizeObserver(() => this._resize());
    this.ro.observe(this.el);
    this._resize();
    // A tap on a room (rather than a drag) opens its panel.
    let down = null;
    r.domElement.addEventListener('pointerdown', (e) => { down = {x: e.clientX, y: e.clientY}; });
    r.domElement.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
      down = null;
      // Double-tap the model to put the view back.
      if (Date.now() - (this._lastTap || 0) < 320) { this._lastTap = 0; this._userMoved = false; this._frame(); return; }
      this._lastTap = Date.now();
      const hit = this._pick(e.clientX, e.clientY);
      if (hit && !this.editing) this._openRoom(hit.room.id);
      else if (!hit) this._closeRoom();
    });
  }
  _resize() {
    const {clientWidth: w, clientHeight: h} = this.el;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Until someone moves the view, keep the whole house in frame.
    if (!this._userMoved) this._frame();
    this.need = true;
  }
  // The starting view: portrait screens look along the house so its long
  // side runs up the screen with the street at the bottom; wide screens look
  // across it. The distance is worked out so the whole footprint fits.
  _frame() {
    const {clientWidth: w, clientHeight: h} = this.el;
    if (!w || !h || !this.controls) return;
    const tall = w / h < 0.8;
    this.camera.fov = tall ? 46 : 38;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const {w: fw, d: fd} = HOUSE.footprint;
    const across = tall ? fd + 2.5 : fw + 4, along = tall ? fw + 4.5 : fd + 3;
    const vfov = THREE.MathUtils.degToRad(this.camera.fov), hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const dist = Math.max(along / 2 / Math.tan(vfov / 2), across / 2 / Math.tan(hfov / 2)) * 1.08;
    const dir = (tall ? new THREE.Vector3(-4.2, 13.5, 0.5) : new THREE.Vector3(-1.6, 13.5, 6.2)).normalize();
    // Shift the target a touch towards the street so the top bar never covers the back of the house.
    this.controls.target.copy(this.center).add(tall ? new THREE.Vector3(-0.35, 0, 0) : new THREE.Vector3(0, 0, 0.25));
    this.camera.position.copy(this.controls.target).addScaledVector(dir, Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, dist)));
    this.controls.update();
    this.need = true;
  }

  // ---- Model ---------------------------------------------------------------
  _mat(color, extra = {}) {
    const key = `${color}|${JSON.stringify(extra)}`;
    this._mats = this._mats || new Map();
    if (!this._mats.has(key)) this._mats.set(key, new THREE.MeshStandardMaterial({color, roughness: 0.82, metalness: 0, ...extra}));
    return this._mats.get(key);
  }
  _box(w, h, d, color, x, y, z, extra) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._mat(color, extra));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  _buildScene() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xdfe9ff, 0x3a3226, 0.9);
    s.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    Object.assign(sun.shadow.camera, {left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 60});
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.target.position.copy(this.center);
    s.add(sun, sun.target);
    // Outside: garden behind, path and street in front.
    const {w, d} = HOUSE.footprint;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), this._mat(C.paving, {roughness: 1}));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(w / 2, -0.26, d / 2);
    ground.receiveShadow = true;
    s.add(ground);
    const grass = this._box(9, 0.04, d + 0.6, C.grass, w + 4.5 + 0.15, -0.24, d / 2, {roughness: 1});
    grass.castShadow = false;
    s.add(grass);
    s.add(this._box(3.2, 0.03, d + 4, C.street, -5.2, -0.245, d / 2, {roughness: 1}));
    s.add(this._box(1.1, 0.05, 1.3, 0x8b8f96, -0.6, -0.23, 4.72, {roughness: 1}));
    // A simple garden fence line.
    for (const z of [-0.25, d + 0.25]) s.add(this._box(9, 0.9, 0.05, 0x6b5a48, w + 4.5 + 0.15, 0.2, z));
    s.add(this._box(0.05, 0.9, d + 0.55, 0x6b5a48, w + 9.1, 0.2, d / 2));
    this.floors = new Map();
    for (const f of HOUSE.floors) this.floors.set(f.id, this._buildFloor(f));
    this._buildWeather();
  }
  _buildFloor(f) {
    const g = new THREE.Group();
    const rooms = [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const r of f.rooms) for (const [x, z] of r.poly) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    const pad = 0.16;
    g.add(this._box(maxX - minX + pad * 2, 0.26, maxZ - minZ + pad * 2, C.plinth, (minX + maxX) / 2, -0.13, (minZ + maxZ) / 2, {roughness: 0.95}));
    const openings = [...(f.doors || []).map((s) => ({s, kind: 'door'})), ...(f.windows || []).map((s) => ({s, kind: 'window'}))];
    for (const room of f.rooms) {
      const shape = new THREE.Shape(room.poly.map(([x, z]) => new THREE.Vector2(x, -z)));
      const mat = new THREE.MeshStandardMaterial({color: FLOOR_COLOURS[room.floor] || FLOOR_COLOURS.wood, roughness: 0.78, emissive: 0xffb15c, emissiveIntensity: 0});
      const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.004;
      floor.receiveShadow = true;
      floor.userData.room = room;
      g.add(floor);
      this._walls(g, room.poly, Math.min(CUT, f.height), openings);
      for (const item of room.furniture || []) g.add(this._furniture(item));
      const light = new THREE.PointLight(0xffb76b, 0, 7, 1.6);
      const [cx, cz] = centroid(room.poly);
      light.position.set(cx, Math.min(f.height - 0.2, 2.1), cz);
      g.add(light);
      rooms.push({room, floor, mat, light, c: [cx, cz]});
    }
    for (const st of f.stairs || []) this._stairs(g, st);
    if (f.eaves) {
      // Sloped ceiling hint in the loft: a translucent band at the front.
      const band = new THREE.Mesh(new THREE.PlaneGeometry(f.eaves.x - minX, maxZ - minZ), new THREE.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false}));
      band.rotation.x = -Math.PI / 2;
      band.position.set((minX + f.eaves.x) / 2, 0.012, (minZ + maxZ) / 2);
      g.add(band);
    }
    g.visible = false;
    this.scene.add(g);
    return {f, group: g, rooms};
  }
  _walls(g, poly, h, openings) {
    let area = 0;
    for (let i = 0; i < poly.length; i++) { const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length]; area += x1 * z2 - x2 * z1; }
    const wallMat = [0, 1, 2, 3, 4, 5].map((i) => (i === 2 ? this._mat(0x7d838c, {roughness: 0.9}) : this._mat(C.wall, {roughness: 0.92})));
    const glassMat = this._mat(C.glass, {transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0.1, depthWrite: false});
    for (let i = 0; i < poly.length; i++) {
      const a = new THREE.Vector2(...poly[i]), b = new THREE.Vector2(...poly[(i + 1) % poly.length]);
      const dir = b.clone().sub(a), len = dir.length();
      if (len < 0.05) continue;
      dir.divideScalar(len);
      const n = area > 0 ? new THREE.Vector2(dir.y, -dir.x) : new THREE.Vector2(-dir.y, dir.x);
      // Openings that lie along this edge, as distances from a.
      const gaps = [];
      for (const {s, kind} of openings) {
        const p = new THREE.Vector2(s[0], s[1]), q = new THREE.Vector2(s[2], s[3]);
        const off = (v) => Math.abs((v.x - a.x) * n.x + (v.y - a.y) * n.y);
        if (off(p) > 0.25 || off(q) > 0.25) continue;
        const tp = (p.x - a.x) * dir.x + (p.y - a.y) * dir.y, tq = (q.x - a.x) * dir.x + (q.y - a.y) * dir.y;
        const s0 = Math.max(0, Math.min(tp, tq)), s1 = Math.min(len, Math.max(tp, tq));
        if (s1 - s0 > 0.2) gaps.push({s0, s1, kind});
      }
      gaps.sort((x, y) => x.s0 - y.s0);
      const piece = (s0, s1, y0, y1, mat) => {
        if (s1 - s0 < 0.01 || y1 - y0 < 0.01) return;
        const e0 = s0 <= 0.001 ? -WALL_T : s0, e1 = s1 >= len - 0.001 ? len + WALL_T : s1;
        const mid = a.clone().addScaledVector(dir, (e0 + e1) / 2).addScaledVector(n, WALL_T / 2);
        const m = new THREE.Mesh(new THREE.BoxGeometry(e1 - e0, y1 - y0, mat === glassMat ? 0.02 : WALL_T), mat);
        m.position.set(mid.x, (y0 + y1) / 2, mid.y);
        m.rotation.y = -Math.atan2(dir.y, dir.x);
        m.castShadow = mat !== glassMat;
        m.receiveShadow = true;
        g.add(m);
      };
      let cur = 0;
      for (const gap of gaps) {
        piece(cur, gap.s0, 0, h, wallMat);
        if (gap.kind === 'door') { if (h > 2.05) piece(gap.s0, gap.s1, 2.05, h, wallMat); }
        else { piece(gap.s0, gap.s1, 0, 0.9, wallMat); piece(gap.s0, gap.s1, 0.9, Math.min(2.1, h), glassMat); if (h > 2.1) piece(gap.s0, gap.s1, 2.1, h, wallMat); }
        cur = Math.max(cur, gap.s1);
      }
      piece(cur, len, 0, h, wallMat);
    }
  }
  _stairs(g, st) {
    const steps = 9, alongX = st.run === 'x';
    const L = alongX ? st.x2 - st.x1 : st.z2 - st.z1, W = alongX ? st.z2 - st.z1 : st.x2 - st.x1;
    for (let i = 0; i < steps; i++) {
      const h = 0.16 * (i + 1), t = L / steps;
      const x = alongX ? st.x1 + t * (i + 0.5) : (st.x1 + st.x2) / 2, z = alongX ? (st.z1 + st.z2) / 2 : st.z1 + t * (i + 0.5);
      g.add(this._box(alongX ? t : W, h, alongX ? W : t, C.stair, x, h / 2, z));
    }
  }
  _furniture(it) {
    const g = new THREE.Group();
    g.position.set(it.x, 0, it.z);
    const {w, d} = it, B = (bw, bh, bd, col, x, y, z, ex) => g.add(this._box(bw, bh, bd, col, x, y, z, ex));
    const back = it.back || 'n';
    const backOff = (thick) => ({n: [0, -(d / 2 - thick / 2)], s: [0, d / 2 - thick / 2], w: [-(w / 2 - thick / 2), 0], e: [w / 2 - thick / 2, 0]}[back]);
    const ns = back === 'n' || back === 's';
    switch (it.t) {
      case 'sofa': case 'armchair': {
        B(w, 0.42, d, C.fabric, 0, 0.21, 0);
        const [bx, bz] = backOff(0.22);
        B(ns ? w : 0.22, 0.82, ns ? 0.22 : d, C.fabric, bx, 0.41, bz);
        if (ns) { B(0.18, 0.62, d, C.fabric, -(w / 2 - 0.09), 0.31, 0); B(0.18, 0.62, d, C.fabric, w / 2 - 0.09, 0.31, 0); }
        else { B(w, 0.62, 0.18, C.fabric, 0, 0.31, -(d / 2 - 0.09)); B(w, 0.62, 0.18, C.fabric, 0, 0.31, d / 2 - 0.09); }
        break;
      }
      case 'bed': {
        B(w, 0.3, d, C.wood, 0, 0.15, 0);
        B(w - 0.06, 0.2, d - 0.06, C.linen, 0, 0.4, 0);
        const [hx, hz] = backOff(0.08);
        B(ns ? w : 0.08, 1.0, ns ? 0.08 : d, C.wood, hx, 0.5, hz);
        // Duvet over the foot two-thirds, pillows at the head.
        const foot = {n: [0, 0.18], s: [0, -0.18], w: [0.18, 0], e: [-0.18, 0]}[back];
        B(ns ? w : w * 0.68, 0.06, ns ? d * 0.68 : d, C.duvet, foot[0] * w, 0.52, foot[1] * d);
        const pz = {n: -d / 2 + 0.28, s: d / 2 - 0.28}[back], px = {w: -w / 2 + 0.28, e: w / 2 - 0.28}[back];
        if (ns) { B(w * 0.4, 0.12, 0.32, C.white, -w * 0.23, 0.56, pz); B(w * 0.4, 0.12, 0.32, C.white, w * 0.23, 0.56, pz); }
        else { B(0.32, 0.12, d * 0.4, C.white, px, 0.56, -d * 0.23); B(0.32, 0.12, d * 0.4, C.white, px, 0.56, d * 0.23); }
        break;
      }
      case 'table': case 'desk': {
        B(w, 0.05, d, C.oak, 0, 0.74, 0);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.05, 0.72, 0.05, C.dark, sx * (w / 2 - 0.06), 0.36, sz * (d / 2 - 0.06));
        if (it.t === 'desk') { B(0.05, 0.34, 0.6, C.dark, -w / 2 + 0.15, 0.95, 0); B(0.2, 0.02, 0.35, C.dark, 0.05, 0.775, 0); }
        break;
      }
      case 'chair': B(w, 0.05, d, C.oak, 0, 0.45, 0); B(0.04, 0.44, 0.04, C.dark, 0, 0.22, 0); break;
      case 'coffee': B(w, 0.36, d, C.oak, 0, 0.18, 0); break;
      case 'tv': B(w, 0.45, d, C.dark, 0, 0.225, 0); B(w * 0.78, 0.5, 0.04, 0x0d1117, 0, 0.75, 0, {roughness: 0.3}); break;
      case 'rug': { const m = this._box(w, 0.012, d, C.rug, 0, 0.012, 0, {roughness: 1}); m.castShadow = false; g.add(m); break; }
      case 'plant': {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.32, w * 0.26, 0.38, 16), this._mat(0xd9cbb5));
        pot.position.y = 0.19; pot.castShadow = true; g.add(pot);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(w * 0.5, 14, 10), this._mat(C.leaf));
        leaf.position.y = 0.7; leaf.castShadow = true; g.add(leaf);
        break;
      }
      case 'counter': B(w, 0.88, d, 0x5c6a62, 0, 0.44, 0); B(w + 0.02, 0.04, d + 0.02, 0xe4ded3, 0, 0.9, 0, {roughness: 0.35}); break;
      case 'wardrobe': B(w, 1.4, d, 0xd8cbb8, 0, 0.7, 0); break;
      case 'shelf': B(w, 1.3, d, C.oak, 0, 0.65, 0); break;
      case 'ottoman': B(w, 0.42, d, C.accent, 0, 0.21, 0); break;
      case 'mirror': B(w, 1.6, d, 0xcfe3f2, 0, 0.95, 0, {roughness: 0.1, metalness: 0.5}); break;
      case 'side': B(w, 0.5, d, C.oak, 0, 0.25, 0); { const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), this._mat(0xfff3d6, {emissive: 0xffd9a0, emissiveIntensity: 0.4})); lamp.position.y = 0.62; g.add(lamp); } break;
      case 'bath': B(w, 0.55, d, C.white, 0, 0.275, 0, {roughness: 0.3}); B(w - 0.14, 0.02, d - 0.14, 0xbfe2f2, 0, 0.555, 0, {roughness: 0.2}); break;
      case 'toilet': B(w, 0.4, d * 0.7, C.white, 0, 0.2, d * 0.15, {roughness: 0.3}); B(w, 0.38, d * 0.3, C.white, 0, 0.55, -d * 0.35, {roughness: 0.3}); break;
      case 'basin': B(w, 0.85, d, C.white, 0, 0.425, 0, {roughness: 0.3}); break;
      case 'shower': {
        B(w, 0.06, d, C.white, 0, 0.03, 0, {roughness: 0.3});
        const glass = this._mat(C.glass, {transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false});
        for (const [gw, gd, gx, gz] of [[w, 0.02, 0, -d / 2], [0.02, d, -w / 2, 0]]) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(gw, 1.35, gd), glass);
          m.position.set(gx, 0.72, gz); g.add(m);
        }
        break;
      }
      default: B(w, 0.5, d, C.oak, 0, 0.25, 0);
    }
    return g;
  }
  _buildWeather() {
    const n = 1400, pos = new Float32Array(n * 6);
    this.drops = [];
    for (let i = 0; i < n; i++) {
      const x = -6 + Math.random() * 20, y = Math.random() * 14, z = -5 + Math.random() * 16;
      this.drops.push({x, y, z, v: 9 + Math.random() * 4});
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({color: 0xbcd3ea, transparent: true, opacity: 0.45}));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  // ---- Floors, rooms, pins ---------------------------------------------------
  setFloor(id) {
    if (!this.floors?.has(id)) id = 'ground';
    this.floorId = id;
    for (const [fid, fl] of this.floors) fl.group.visible = fid === id;
    this.el.querySelectorAll('[data-floor]').forEach((b) => b.classList.toggle('on', b.dataset.floor === id));
    this._closeRoom();
    this._userMoved = false;
    this._frame();
    this._syncPins();
    this._syncLabels();
    this.need = true;
  }
  _pick(cx, cy) {
    const fl = this.floors.get(this.floorId), r = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(p, this.camera);
    const hits = this.ray.intersectObjects(fl.rooms.map((x) => x.floor), false);
    if (hits[0]) return fl.rooms.find((x) => x.floor === hits[0].object);
    // Furniture and walls cover the floor: fall back to the plan point.
    const pt = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, pt)) return null;
    return fl.rooms.find((x) => insidePoly(x.room.poly, pt.x, pt.z)) || null;
  }
  _floorPoint(cx, cy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.camera);
    const pt = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, pt) ? pt : null;
  }
  _areaOf(id) {
    const h = this.hass, e = h.entities?.[id];
    if (!e) return null;
    return e.area_id || (e.device_id && h.devices?.[e.device_id]?.area_id) || null;
  }
  _roomForArea(area) {
    for (const [fid, fl] of this.floors) for (const r of fl.rooms) if ((r.room.area || []).includes(area)) return {fid, r};
    return null;
  }
  _pinnable(id, auto) {
    const s = this.hass.states[id];
    if (!s || !PIN_DOMAINS.includes(domainOf(id))) return false;
    const dom = domainOf(id), dc = s.attributes?.device_class;
    if (dom === 'camera' && /last_recording/.test(id)) return false;
    if (!auto) return !!this.hass.entities?.[id] && !this.hass.entities[id].entity_category;
    if (dom === 'light') return !(this.o.excludeLights || []).includes(id) || !!HOUSE.defaults[id];
    if (dom === 'binary_sensor') return ['motion', 'occupancy', 'door', 'window'].includes(dc);
    // Temperatures show on the room label instead of as a pin.
    if (dom === 'sensor') return false;
    if (dom === 'switch' || dom === 'media_player') return false;
    return true;
  }
  // Where every pinned device sits: saved spot, then the house defaults, then
  // the middle of its room.
  _pinList() {
    const out = [], perRoom = new Map(), h = this.hass;
    const ids = new Set([...Object.keys(this.layout), ...Object.keys(HOUSE.defaults), ...Object.keys(h.states).filter((id) => this._pinnable(id, true))]);
    for (const id of ids) {
      if (this.hidden.includes(id) || !h.states[id]) continue;
      let at = this.layout[id] || HOUSE.defaults[id];
      if (!at) {
        const area = this._areaOf(id), rm = area && this._roomForArea(area);
        if (!rm) continue;
        const k = `${rm.fid}:${rm.r.room.id}`, i = perRoom.get(k) || 0;
        perRoom.set(k, i + 1);
        const ang = i * 2.1, rad = i ? 0.55 : 0;
        at = [rm.fid, rm.r.c[0] + Math.cos(ang) * rad, rm.r.c[1] + Math.sin(ang) * rad];
      }
      out.push({id, f: at[0], x: at[1], z: at[2]});
    }
    return out;
  }
  _pinIcon(s) {
    const dom = domainOf(s.entity_id), dc = s.attributes?.device_class;
    if (dom === 'light') return /garden|flood/.test(s.entity_id) ? 'flood' : 'bulb';
    if (dom === 'camera') return 'camera';
    if (dom === 'fan') return 'wind';
    if (dom === 'binary_sensor') return dc === 'door' || dc === 'window' ? 'door' : 'motion';
    if (dom === 'sensor') return dc === 'humidity' ? 'drop' : 'gauge';
    if (dom === 'lock') return 'lock';
    if (dom === 'media_player') return 'screen';
    if (dom === 'humidifier') return 'drop';
    return 'power';
  }
  _pinState(s) {
    const dom = domainOf(s.entity_id), st = s.state;
    const on = dom === 'camera' ? !['unavailable', 'off'].includes(st)
      : dom === 'binary_sensor' ? st === 'on' : ['on', 'playing', 'heat', 'cool', 'open', 'unlocked'].includes(st);
    let val = '';
    if (dom === 'sensor') { const n = Number(st); if (Number.isFinite(n)) val = s.attributes?.device_class === 'temperature' ? `${n.toFixed(1)}°` : `${Math.round(n)}%`; }
    if (dom === 'fan' && this.o.pm25) { const pm = Number(this.hass.states[this.o.pm25]?.state); if (Number.isFinite(pm)) val = `PM ${pm}`; }
    const alert = dom === 'binary_sensor' && st === 'on' && ['door', 'window'].includes(s.attributes?.device_class);
    return {on, val, alert, off: st === 'unavailable'};
  }
  _syncPins() {
    if (!this.hass || this.failed) return;
    const list = this._pinList(), seen = new Set();
    for (const p of list) {
      const s = this.hass.states[p.id];
      let el = this.pins.get(p.id)?.el;
      if (!el) {
        el = document.createElement('button');
        el.className = 'pin';
        el.dataset.pin = p.id;
        this.pinLayer.appendChild(el);
        this._wirePin(el);
      }
      const st = this._pinState(s), name = s.attributes?.friendly_name || p.id;
      el.className = `pin k-${domainOf(p.id)}${st.on ? ' on' : ''}${st.alert ? ' alert' : ''}${st.off ? ' off-line' : ''}${this.editing ? ' edit' : ''}`;
      el.title = name;
      el.setAttribute('aria-label', name);
      const html = `${this.o.icon(this._pinIcon(s))}${st.val ? `<span class="pv">${esc(st.val)}</span>` : ''}${this.editing ? '<span class="rm" data-rm="1">×</span>' : ''}`;
      if (el._html !== html) { el.innerHTML = html; el._html = html; }
      el.style.display = p.f === this.floorId ? '' : 'none';
      this.pins.set(p.id, {el, p});
      seen.add(p.id);
    }
    for (const [id, v] of this.pins) if (!seen.has(id)) { v.el.remove(); this.pins.delete(id); }
    this.need = true;
  }
  _syncLabels() {
    if (!this.hass || this.failed) return;
    const fl = this.floors.get(this.floorId), seen = new Set();
    for (const r of fl.rooms) {
      const key = `${this.floorId}:${r.room.id}`;
      let el = this.labels.get(key)?.el;
      if (!el) { el = document.createElement('div'); el.className = 'rlabel'; this.pinLayer.prepend(el); }
      const temp = this._roomTemp(r.room);
      const html = `${esc(r.room.name)}${temp ? `<b>${esc(temp)}</b>` : ''}`;
      if (el._html !== html) { el.innerHTML = html; el._html = html; }
      this.labels.set(key, {el, r});
      seen.add(key);
    }
    for (const [k, v] of this.labels) if (!seen.has(k)) { v.el.remove(); this.labels.delete(k); }
  }
  _roomEntities(room) {
    return Object.keys(this.hass.states).filter((id) => (room.area || []).includes(this._areaOf(id)));
  }
  _roomTemp(room) {
    const s = this._roomEntities(room).map((id) => this.hass.states[id]).find((x) => x.attributes?.device_class === 'temperature' && Number.isFinite(Number(x.state)));
    return s ? `${Number(s.state).toFixed(1)}°` : '';
  }
  _wirePin(el) {
    let start = null, timer = null, dragging = false;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const id = el.dataset.pin;
      if (this.editing) {
        if (e.target.dataset.rm) { this._removePin(id); return; }
        dragging = true;
        el.classList.add('drag');
        el.setPointerCapture(e.pointerId);
        this.controls.enabled = false;
        return;
      }
      start = {x: e.clientX, y: e.clientY, t: Date.now()};
      timer = setTimeout(() => { timer = null; start = null; this.o.onAction('more', id); }, 550);
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const pt = this._floorPoint(e.clientX, e.clientY);
      if (!pt) return;
      const id = el.dataset.pin;
      this.layout[id] = [this.floorId, +pt.x.toFixed(2), +pt.z.toFixed(2)];
      const v = this.pins.get(id);
      if (v) v.p = {id, f: this.floorId, x: pt.x, z: pt.z};
      this.need = true;
    });
    const up = () => {
      if (dragging) { dragging = false; el.classList.remove('drag'); this.controls.enabled = true; return; }
      if (timer) { clearTimeout(timer); timer = null; }
      if (start) { start = null; this._tapPin(el.dataset.pin); }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => { if (timer) clearTimeout(timer); start = null; dragging = false; el.classList.remove('drag'); this.controls.enabled = true; });
  }
  _tapPin(id) {
    const dom = domainOf(id);
    if (dom === 'light' || dom === 'switch') this.o.onAction('toggle', id);
    else if (dom === 'camera') this.o.onAction('camera', id);
    else if (dom === 'fan' && id === this.o.purifier) this.o.onAction('purifier', id);
    else this.o.onAction('more', id);
  }

  // ---- Room panel -------------------------------------------------------------
  _openRoom(roomId) {
    this.roomOpen = roomId;
    this._renderRoom();
  }
  _closeRoom() {
    this.roomOpen = null;
    const p = this.el.querySelector('.hv-room');
    if (p) p.hidden = true;
  }
  _renderRoom() {
    const p = this.el.querySelector('.hv-room');
    const r = this.floors.get(this.floorId)?.rooms.find((x) => x.room.id === this.roomOpen);
    if (!r || !this.hass) { if (p) p.hidden = true; return; }
    const ids = this._roomEntities(r.room).filter((id) => this._pinnable(id, false) || domainOf(id) === 'light');
    const lights = ids.filter((id) => domainOf(id) === 'light'), lit = lights.filter((id) => this.hass.states[id].state === 'on');
    const temp = this._roomTemp(r.room);
    const rows = ids.slice(0, 12).map((id) => {
      const s = this.hass.states[id], st = this._pinState(s), dom = domainOf(id);
      const line = dom === 'light' ? (s.state === 'on' ? `On${s.attributes?.brightness ? ` · ${Math.round((s.attributes.brightness / 255) * 100)}%` : ''}` : 'Off')
        : st.val || (s.state === 'unavailable' ? 'Offline' : String(s.state).replaceAll('_', ' '));
      return `<button class="hv-row ${st.on && dom === 'light' ? 'on' : ''}" data-row="${esc(id)}"><span class="i">${this.o.icon(this._pinIcon(s))}</span>
        <span class="n"><div>${esc(s.attributes?.friendly_name || id)}</div><div>${esc(line)}</div></span></button>`;
    }).join('');
    const html = `<h3>${esc(r.room.name)}<button class="hv-btn x" data-close="1" aria-label="Close">${this.o.icon('x')}</button></h3>
      <div class="sub">${[temp, lights.length ? `${lit.length} of ${lights.length} lights on` : 'No lights yet'].filter(Boolean).join(' · ')}</div>
      ${rows || '<div class="sub">Nothing connected in this room yet. Devices you add to the ' + esc(r.room.name) + ' area in Home Assistant show up here.</div>'}
      ${lights.length > 1 ? `<button class="hv-row" data-all="${lit.length ? 'off' : 'on'}"><span class="i">${this.o.icon('bulb')}</span><span class="n"><div>Turn all ${lit.length ? 'off' : 'on'}</div><div>${esc(r.room.name)}</div></span></button>` : ''}`;
    if (p._html !== html) {
      p.innerHTML = html;
      p._html = html;
      p.querySelector('[data-close]').onclick = () => this._closeRoom();
      p.querySelectorAll('[data-row]').forEach((b) => { b.onclick = () => this._tapPin(b.dataset.row); });
      const all = p.querySelector('[data-all]');
      if (all) all.onclick = () => this.o.onAction(all.dataset.all === 'off' ? 'lightsOff' : 'lightsOn', lights);
    }
    p.hidden = false;
  }

  // ---- Placement mode ------------------------------------------------------------
  _startEdit() {
    this.editing = true;
    this._saved = {layout: JSON.parse(JSON.stringify(this.layout)), hidden: [...this.hidden]};
    // Pin every device where it currently shows so dragging starts from there.
    for (const p of this._pinList()) if (!this.layout[p.id]) this.layout[p.id] = [p.f, +p.x.toFixed(2), +p.z.toFixed(2)];
    this._closeRoom();
    this._editHud();
    this._syncPins();
    this._renderTray();
  }
  async _endEdit(save) {
    if (save) {
      const res = await this.o.onAction('saveLayout', {layout: this.layout, hidden: this.hidden});
      this._toast(res?.ok ? (res.personal ? 'Saved for your account' : 'Layout saved') : 'Couldn\'t save the layout');
    } else if (this._saved) {
      this.layout = this._saved.layout;
      this.hidden = this._saved.hidden;
    }
    this.editing = false;
    this._editHud();
    this.el.querySelector('.hv-tray').hidden = true;
    this._syncPins();
  }
  _editHud() {
    const q = (s) => this.el.querySelector(s);
    q('.place').hidden = this.editing;
    q('.save').hidden = !this.editing;
    q('.cancel').hidden = !this.editing;
    q('.close').hidden = this.editing;
  }
  _removePin(id) {
    delete this.layout[id];
    if (!this.hidden.includes(id)) this.hidden.push(id);
    this._syncPins();
    this._renderTray();
  }
  _renderTray() {
    const tray = this.el.querySelector('.hv-tray');
    if (!this.editing) { tray.hidden = true; return; }
    const placed = new Set(this._pinList().map((p) => p.id));
    const spare = Object.keys(this.hass.states).filter((id) => !placed.has(id) && this._pinnable(id, false))
      .sort((a, b) => PIN_DOMAINS.indexOf(domainOf(a)) - PIN_DOMAINS.indexOf(domainOf(b)) || a.localeCompare(b)).slice(0, 60);
    tray.innerHTML = `<div class="hint">Drag pins to where things really are. Tap × to remove one, or add a device from below. Then tap Save.</div>
      <div class="chips">${spare.map((id) => `<button class="chip" data-add="${esc(id)}">${this.o.icon(this._pinIcon(this.hass.states[id]))}${esc(this.hass.states[id].attributes?.friendly_name || id)}</button>`).join('') || '<span class="hint">Every device is already on the plan.</span>'}</div>`;
    tray.querySelectorAll('[data-add]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.add;
        this.hidden = this.hidden.filter((x) => x !== id);
        this.layout[id] = [this.floorId, +this.controls.target.x.toFixed(2), +this.controls.target.z.toFixed(2)];
        this._syncPins();
        this._renderTray();
      };
    });
    tray.hidden = false;
  }
  _toast(text) {
    const t = document.createElement('div');
    t.className = 'hv-toast';
    t.textContent = text;
    this.el.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  // ---- Live state ----------------------------------------------------------------
  update(hass, theme) {
    this.hass = hass;
    if (this.failed) return;
    const o = this.o;
    // Who's home and what's on, for the summary chip and the weather corner.
    const d = o.describe ? o.describe() : {};
    const sum = this.el.querySelector('.hv-chip.sum');
    if (sum && sum._t !== d.sub) { sum.innerHTML = d.sub || ''; sum._t = d.sub; sum.hidden = !d.sub; }
    const wx = this.el.querySelector('.hv-wx');
    if (wx && wx._t !== d.wx) { wx.innerHTML = d.wx || ''; wx._t = d.wx; }
    // Sun and sky.
    const sun = hass.states[o.sun || 'sun.sun'], elev = Number(sun?.attributes?.elevation ?? 30), az = Number(sun?.attributes?.azimuth ?? 180);
    const night = elev < -3, dusk = !night && elev < 6;
    const cond = hass.states[o.weather]?.state || '';
    const wet = /rain|pouring|lightning/.test(cond), snow = /snow/.test(cond), dull = wet || snow || /cloud|fog/.test(cond);
    const a = THREE.MathUtils.degToRad(az + (o.north || 0)), e = THREE.MathUtils.degToRad(Math.max(elev, 8));
    this.sun.position.set(this.center.x + Math.sin(a) * Math.cos(e) * 25, Math.sin(e) * 25, this.center.z - Math.cos(a) * Math.cos(e) * 25);
    this.sun.intensity = night ? 0 : (dusk ? 0.9 : 2.5) * (dull ? 0.45 : 1);
    this.sun.color.set(dusk ? 0xffb27a : 0xfff1dc);
    this.hemi.intensity = night ? 0.5 : dull ? 0.75 : 0.95;
    this.hemi.color.set(night ? 0x6f86b0 : 0xdfe9ff);
    this.renderer.toneMappingExposure = night ? 1.25 : 1.05;
    const bg = night ? 'radial-gradient(120% 90% at 50% 20%,#18233a 0%,#0a0f19 70%)'
      : dull ? (theme === 'light' ? 'linear-gradient(#c7cfd8,#9aa5b2)' : 'linear-gradient(#2a3340,#151b24)')
        : dusk ? 'linear-gradient(#f2b483,#5d6b8a)' : (theme === 'light' ? 'linear-gradient(#cfe3f5,#e9eef3)' : 'linear-gradient(#1c2a3d,#0e141d)');
    this.el.style.setProperty('--hv-bg', bg);
    this.rain.visible = wet || snow;
    this.rain.material.color.set(snow ? 0xffffff : 0xbcd3ea);
    this._snow = snow;
    this.scene.fog = /fog/.test(cond) ? new THREE.Fog(night ? 0x0a0f19 : 0x9aa5b2, 12, 34) : null;
    // Rooms glow while their lights are on, brighter after dark.
    for (const [, fl] of this.floors) {
      for (const r of fl.rooms) {
        const lit = this._roomEntities(r.room).some((id) => domainOf(id) === 'light' && hass.states[id].state === 'on' && !(o.excludeLights || []).includes(id));
        r.mat.emissiveIntensity = lit ? (night ? 0.28 : 0.1) : 0;
        r.light.intensity = lit ? (night ? 6 : 1.5) : 0;
      }
    }
    this._syncPins();
    this._syncLabels();
    if (this.roomOpen) this._renderRoom();
    this.need = true;
  }

  _loop(t) {
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, (t - (this._t || t)) / 1000);
    this._t = t;
    let moved = this.controls.update();
    if (this.rain.visible) {
      const arr = this.rain.geometry.attributes.position.array, snow = this._snow;
      for (let i = 0; i < this.drops.length; i++) {
        const p = this.drops[i];
        p.y -= (snow ? 1.2 : p.v) * dt;
        if (snow) p.x += Math.sin(t / 900 + i) * dt * 0.3;
        if (p.y < -0.2) p.y = 12 + Math.random() * 2;
        const len = snow ? 0.05 : 0.35;
        arr.set([p.x, p.y, p.z, p.x - 0.03, p.y + len, p.z], i * 6);
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      moved = true;
    }
    if (!moved && !this.need) return;
    this.need = false;
    this.renderer.render(this.scene, this.camera);
    this._placeOverlays();
  }
  _placeOverlays() {
    const {clientWidth: w, clientHeight: h} = this.el, v = new THREE.Vector3();
    const put = (el, x, y, z) => {
      v.set(x, y, z).project(this.camera);
      if (v.z > 1) { el.style.visibility = 'hidden'; return; }
      el.style.visibility = '';
      el.style.transform = `translate(${((v.x + 1) / 2) * w}px,${((1 - v.y) / 2) * h}px)`;
    };
    const height = HOUSE.floors.find((f) => f.id === this.floorId)?.height || 2.4;
    for (const [, {el, p}] of this.pins) if (p.f === this.floorId) put(el, p.x, Math.min(1.1, height * 0.5), p.z);
    for (const [, {el, r}] of this.labels) {
      put(el, r.c[0], 0.05, r.c[1]);
      el.style.transform += ' translate(-50%,-50%)';
    }
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this.ro?.disconnect();
    this.controls?.dispose();
    this.scene?.traverse((o) => { o.geometry?.dispose?.(); });
    for (const m of this._mats?.values() || []) m.dispose();
    for (const [, fl] of this.floors || []) for (const r of fl.rooms) r.mat.dispose();
    this.renderer?.dispose();
    this.host.innerHTML = '';
  }
}
