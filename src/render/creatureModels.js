// ============================================================================
//  creatureModels.js — דגמי יצורים פרוצדורליים (low-poly) עם אנימציה פרוצדורלית
//  Procedural low-poly creature models, hero-on-horse model and a procedural
//  animator (idle / walk / attack / shoot / cast / hit / defend / death / revive).
//
//  Conventions: model stands at origin, feet on y=0, facing +X, right hand = +Z.
// ============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CREATURES } from '../data/creatures.js';

const PI = Math.PI, TAU = PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (u) => u * u * (3 - 2 * u);
const lerp = (a, b, t) => a + (b - a) * t;
const r2 = (v) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- geometry cache
const GEO = new Map();
function cachedGeo(key, make) {
  let g = GEO.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    GEO.set(key, g);
  }
  return g;
}

const G = {
  box: () => cachedGeo('box', () => new THREE.BoxGeometry(1, 1, 1)),
  /** box whose top face (y>0) is scaled by tx/tz and shifted in x by sh */
  tbox: (tx = 1, tz = 1, sh = 0) =>
    cachedGeo(`tbox${r2(tx)}_${r2(tz)}_${r2(sh)}`, () => {
      const g = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        if (y > -0.49) {
          const u = (y + 0.5);
          p.setX(i, p.getX(i) * (1 + (tx - 1) * u) + sh * u);
          p.setZ(i, p.getZ(i) * (1 + (tz - 1) * u));
        }
      }
      g.computeVertexNormals();
      return g;
    }),
  sph: (d = 1) => cachedGeo('sph' + d, () => new THREE.IcosahedronGeometry(1, d + 1)),
  ball: (w = 14, h = 10) => cachedGeo(`ball${w}_${h}`, () => new THREE.SphereGeometry(1, Math.max(w, 14), Math.max(h, 10))),
  dome: (w = 14, h = 6, frac = 0.5) =>
    cachedGeo(`dome${w}_${h}_${frac}`, () => new THREE.SphereGeometry(1, Math.max(w, 14), Math.max(h, 6), 0, TAU, 0, PI * frac)),
  cyl: (rt = 1, rb = 1, seg = 8, open = false) => {
    rt = r2(rt); rb = r2(rb);
    const s = seg < 5 ? seg : Math.max(seg + 4, 12);
    return cachedGeo(`cyl${rt}_${rb}_${s}_${open}`, () => new THREE.CylinderGeometry(rt, rb, 1, s, 1, open));
  },
  cone: (seg = 8) => {
    const s = seg <= 4 ? seg : Math.max(seg + 4, 10);
    return cachedGeo('cone' + s, () => new THREE.ConeGeometry(1, 1, s));
  },
  torus: (tube = 0.2, arc = TAU, rs = 6, ts = 16) =>
    cachedGeo(`tor${r2(tube)}_${r2(arc)}_${rs}_${ts}`, () => new THREE.TorusGeometry(1, tube, Math.max(rs, 6), Math.max(ts, 16), arc)),
  oct: () => cachedGeo('oct', () => new THREE.OctahedronGeometry(1, 0)),
  dodec: () => cachedGeo('dodec', () => new THREE.DodecahedronGeometry(1, 0)),
  tet: () => cachedGeo('tet', () => new THREE.TetrahedronGeometry(1, 0)),
  plane: () => cachedGeo('plane', () => new THREE.PlaneGeometry(1, 1)),
  /** open cylinder with a jagged, tattered lower hem */
  tatter: (rt, rb, seg = 12, jag = 0.22) =>
    cachedGeo(`tat${r2(rt)}_${r2(rb)}_${seg}_${r2(jag)}`, () => {
      const s = Math.max(seg, 12);
      const g = new THREE.CylinderGeometry(rt, rb, 1, s, 3, true);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        if (p.getY(i) < -0.49) {
          const ang = Math.atan2(p.getX(i), p.getZ(i));
          const k = Math.round(((ang + PI) / TAU) * s) % s;
          p.setY(i, p.getY(i) + (k % 2 ? jag : jag * 0.12) + ((k * 7) % 3) * jag * 0.15);
        }
      }
      g.computeVertexNormals();
      return g;
    }),
  /** flat polygon in the local XZ plane, from [[x,z],...] */
  poly: (key, pts) =>
    cachedGeo('poly_' + key, () => {
      const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
      const g = new THREE.ShapeGeometry(s);
      g.rotateX(PI / 2);
      return g;
    }),
};

// ---------------------------------------------------------------- procedural surface textures & material cache
const TEX = new Map();
function surfaceTex(kind) {
  if (!kind || kind === 'none' || typeof document === 'undefined') return null;
  const key = 'surf_' + kind;
  let t = TEX.get(key);
  if (t) return t;

  const S = 128;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);

  // Deterministic pseudo-random helper for repeatable procedural micro-surface
  let seed = kind.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 17);
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed & 0xffff) / 0xffff;
  };

  if (kind === 'metal') {
    // Brushed & hammered plate metal micro-texture
    for (let y = 0; y < S; y += 2) {
      const v = Math.round(115 + (rnd() - 0.5) * 32);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, S, 1);
    }
    for (let i = 0; i < 65; i++) {
      const x = rnd() * S, y = rnd() * S, r = 3 + rnd() * 6;
      const g = ctx.createRadialGradient(x, y, 0.5, x, y, r);
      const hi = rnd() > 0.5 ? 'rgba(215,215,215,0.22)' : 'rgba(65,65,65,0.22)';
      g.addColorStop(0, hi);
      g.addColorStop(1, 'rgba(128,128,128,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  } else if (kind === 'cloth') {
    // Woven linen/velvet warp & weft threads
    for (let y = 0; y < S; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? 'rgba(170,170,170,0.35)' : 'rgba(90,90,90,0.35)';
      ctx.fillRect(0, y, S, 2);
    }
    for (let x = 0; x < S; x += 4) {
      ctx.fillStyle = x % 8 === 0 ? 'rgba(165,165,165,0.35)' : 'rgba(95,95,95,0.35)';
      ctx.fillRect(x, 0, 2, S);
    }
  } else if (kind === 'scales') {
    // Overlapping reptile scales / feather barbs / chainmail rings
    const step = 16;
    ctx.strokeStyle = '#383838';
    ctx.lineWidth = 2;
    for (let row = -1; row <= S / (step * 0.75) + 1; row++) {
      const cy = row * step * 0.75;
      const off = (row & 1) ? step * 0.5 : 0;
      for (let col = -1; col <= S / step + 1; col++) {
        const cx = col * step + off;
        const g = ctx.createRadialGradient(cx, cy - 2, 1, cx, cy, step * 0.55);
        g.addColorStop(0, '#c8c8c8');
        g.addColorStop(0.75, '#7c7c7c');
        g.addColorStop(1, '#444444');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, step * 0.52, 0, PI);
        ctx.fill();
        ctx.stroke();
      }
    }
  } else if (kind === 'bone') {
    // Pitted bone & chiseled stone grain
    for (let i = 0; i < 180; i++) {
      const x = rnd() * S, y = rnd() * S, r = 1.5 + rnd() * 4.5;
      ctx.fillStyle = rnd() > 0.45 ? 'rgba(65,65,65,0.28)' : 'rgba(195,195,195,0.25)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(45,45,45,0.35)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) {
      const x = rnd() * S, y = rnd() * S;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 28, y + (rnd() - 0.5) * 28);
      ctx.stroke();
    }
  } else if (kind === 'wood') {
    // Wood grain fibers
    for (let x = 0; x < S; x += 2) {
      const v = Math.round(120 + Math.sin(x * 0.25) * 24 + (rnd() - 0.5) * 22);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, 0, 2, S);
    }
  } else {
    // Leather / organic hide pores
    for (let i = 0; i < 140; i++) {
      const x = rnd() * S, y = rnd() * S, r = 1 + rnd() * 3.2;
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(80,80,80,0.24)' : 'rgba(175,175,175,0.22)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  }

  t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.userData.shared = true;
  TEX.set(key, t);
  return t;
}

const MATS = new Map();
function mat(color, o = {}) {
  const texKind = o.tex ?? (o.e ? 'none' : (o.m ?? 0) >= 0.35 ? 'metal' : (o.r ?? 0.82) >= 0.89 ? 'bone' : 'cloth');
  const flat = o.flat ?? false;
  const key = [color, o.r, o.m, o.e, o.ei, o.op, o.ds ? 1 : 0, o.dw, o.add ? 1 : 0, texKind, flat ? 1 : 0].join('|');
  let m = MATS.get(key);
  if (!m) {
    const surf = surfaceTex(texKind);
    m = new THREE.MeshStandardMaterial({
      color,
      flatShading: flat,
      roughness: o.r ?? 0.76,
      metalness: o.m ?? 0.05,
    });
    if (surf) {
      m.bumpMap = surf;
      m.bumpScale = o.bs ?? (texKind === 'scales' ? 0.022 : texKind === 'bone' ? 0.018 : texKind === 'metal' ? 0.011 : 0.014);
      if (texKind === 'metal') m.roughnessMap = surf;
    }
    if (o.e) { m.emissive.set(o.e); m.emissiveIntensity = o.ei ?? 1.6; }
    if (o.op !== undefined && o.op < 1) {
      m.transparent = true; m.opacity = o.op; m.depthWrite = o.dw ?? false;
    }
    if (o.add) m.blending = THREE.AdditiveBlending;
    if (o.ds) m.side = THREE.DoubleSide;
    m.userData.shared = true;
    MATS.set(key, m);
  }
  return m;
}

const PAL = {
  steel: () => mat('#cfd6e0', { m: 0.74, r: 0.26, tex: 'metal', bs: 0.011 }),
  steelDark: () => mat('#828e9c', { m: 0.70, r: 0.33, tex: 'metal', bs: 0.013 }),
  chain: () => mat('#949da8', { m: 0.62, r: 0.42, tex: 'scales', bs: 0.024 }),
  gold: () => mat('#f0c252', { m: 0.82, r: 0.22, tex: 'metal', bs: 0.011 }),
  goldDark: () => mat('#bd8c2a', { m: 0.76, r: 0.30, tex: 'metal', bs: 0.013 }),
  royal: () => mat('#2e62c7', { r: 0.72, tex: 'cloth' }),
  royalDark: () => mat('#204591', { r: 0.76, tex: 'cloth' }),
  white: () => mat('#f5f1e8', { r: 0.74, tex: 'cloth' }),
  cream: () => mat('#e5d9bc', { r: 0.78, tex: 'cloth' }),
  red: () => mat('#bd242e', { r: 0.70, tex: 'cloth' }),
  redDark: () => mat('#73141d', { r: 0.75, tex: 'cloth' }),
  leather: () => mat('#855530', { r: 0.78, tex: 'leather' }),
  leatherDark: () => mat('#52341f', { r: 0.82, tex: 'leather' }),
  wood: () => mat('#8f6038', { r: 0.84, tex: 'wood' }),
  woodDark: () => mat('#5c3b22', { r: 0.86, tex: 'wood' }),
  skin: () => mat('#edb995', { r: 0.68, tex: 'leather', bs: 0.006 }),
  hairBrown: () => mat('#5e3b20', { r: 0.82, tex: 'wood' }),
  hairBlond: () => mat('#f2d47e', { r: 0.65, tex: 'wood' }),
  hairBlack: () => mat('#1b181d', { r: 0.58, tex: 'wood' }),
  black: () => mat('#141417', { r: 0.62, tex: 'none' }),
  eye: () => mat('#1d1712', { r: 0.25, tex: 'none' }),
  bone: () => mat('#ece3c8', { r: 0.76, tex: 'bone' }),
  boneDark: () => mat('#b8a884', { r: 0.84, tex: 'bone' }),
  iron: () => mat('#4d505e', { m: 0.68, r: 0.35, tex: 'metal', bs: 0.014 }),
  ironDark: () => mat('#2c2d36', { m: 0.64, r: 0.40, tex: 'metal', bs: 0.015 }),
  purple: () => mat('#612c8f', { r: 0.74, tex: 'cloth' }),
  purpleDark: () => mat('#371a52', { r: 0.78, tex: 'cloth' }),
  rust: () => mat('#8f5c3c', { m: 0.44, r: 0.58, tex: 'bone', bs: 0.022 }),
  glowGreen: () => mat('#9dff8c', { e: '#62ff4c', ei: 2.3 }),
  glowRed: () => mat('#ff5a4a', { e: '#ff2a1a', ei: 2.5 }),
  glowGold: () => mat('#ffe494', { e: '#ffc43d', ei: 1.95 }),
  glowPurple: () => mat('#e2a8ff', { e: '#b45cff', ei: 2.3 }),
  glowBlue: () => mat('#b6f0ff', { e: '#58c8ff', ei: 2.1 }),
  glowYellow: () => mat('#fff27a', { e: '#ffd400', ei: 2.1 }),
  fire: () => mat('#ffc466', { e: '#ff7a1a', ei: 2.7 }),
};

// ---------------------------------------------------------------- mesh helpers
function M(geo, mtl, parent, p, s, r) {
  const m = new THREE.Mesh(geo, mtl);
  m.castShadow = true;
  if (p) m.position.set(p[0], p[1], p[2]);
  if (s !== undefined && s !== null) {
    if (typeof s === 'number') m.scale.setScalar(s);
    else m.scale.set(s[0], s[1], s[2]);
  }
  if (r) m.rotation.set(r[0], r[1], r[2]);
  if (parent) parent.add(m);
  return m;
}
function grp(parent, p, r) {
  const g = new THREE.Group();
  if (p) g.position.set(p[0], p[1], p[2]);
  if (r) g.rotation.set(r[0], r[1], r[2]);
  if (parent) parent.add(g);
  return g;
}
const _up = new THREE.Vector3(0, 1, 0);
const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _vd = new THREE.Vector3();
/** cylinder from point a (radius r0) to point b (radius r1) */
function seg(parent, mtl, a, b, r0, r1 = r0, sides = 6) {
  const m = new THREE.Mesh(G.cyl(r1 / r0, 1, sides), mtl);
  m.castShadow = true;
  m.userData.r0 = r0;
  setSeg(m, a, b, r0);
  parent.add(m);
  return m;
}
function setSeg(m, a, b, r0 = m.userData.r0) {
  _va.set(a[0] ?? a.x, a[1] ?? a.y, a[2] ?? a.z);
  _vb.set(b[0] ?? b.x, b[1] ?? b.y, b[2] ?? b.z);
  _vd.subVectors(_vb, _va);
  const len = _vd.length() || 1e-4;
  m.position.copy(_va).addScaledVector(_vd, 0.5);
  m.quaternion.setFromUnitVectors(_up, _vd.multiplyScalar(1 / len));
  m.scale.set(r0, len, r0);
}
/** limb hanging down from a pivot: 0 .. -len along Y */
function limb(parent, mtl, len, r0, r1 = r0, sides = 6) {
  return M(G.cyl(1, r1 / r0, sides), mtl, parent, [0, -len / 2, 0], [r0, len, r0]);
}
function mirrorGroup(parent, p, side) {
  const g = grp(parent, p);
  if (side < 0) g.scale.z = -1;
  return g;
}

// ---------------------------------------------------------------- canvas textures
function textTexture(key, text, color, font) {
  let t = TEX.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 128);
  g.font = font || 'bold 84px "Frank Ruhl Libre", "David", serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.direction = 'rtl';
  g.shadowColor = color; g.shadowBlur = 14;
  g.fillStyle = color;
  g.fillText(text, 128, 70);
  g.shadowBlur = 0;
  g.fillStyle = '#fff6c8';
  g.fillText(text, 128, 70);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.shared = true;
  TEX.set(key, t);
  return t;
}
function emetMaterial() {
  const key = 'emetMat';
  let m = MATS.get(key);
  if (!m) {
    const tex = textTexture('emet', 'אמת', '#ffb030');
    m = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: new THREE.Color('#ffc050'), emissiveIntensity: 1.8,
      transparent: true, depthWrite: false, roughness: 0.8, side: THREE.DoubleSide,
    });
    m.userData.shared = true;
    MATS.set(key, m);
  }
  return m;
}

// ============================================================================
//  PROPS — weapons, shields, bows, helmets, capes...
// ============================================================================
function sword(parent, o = {}) {
  const L = o.len ?? 0.4, W = o.w ?? 0.05;
  const g = grp(parent, o.p, o.r);
  const blade = o.blade ?? PAL.steel(), guard = o.guard ?? PAL.gold(), grip = o.grip ?? PAL.leatherDark();
  const gw = o.guardW ?? 0.15;
  M(G.cyl(1, 1, 6), grip, g, [0, 0, 0], [0.017, 0.11, 0.017]);
  M(G.sph(0), guard, g, [0, -0.065, 0], 0.026);
  M(G.oct(), o.gem ?? PAL.red(), g, [0, -0.065, 0], [0.015, 0.018, 0.03]);
  M(G.box(), guard, g, [0, 0.06, 0], [gw, 0.026, 0.034]);
  M(G.sph(0), guard, g, [gw * 0.5, 0.06, 0], 0.018);
  M(G.sph(0), guard, g, [-gw * 0.5, 0.06, 0], 0.018);
  M(G.tbox(0.72, 1), blade, g, [0, 0.073 + L / 2, 0], [W, L, 0.014]);
  // Central blood-fuller ridge along the blade
  M(G.box(), o.fuller ?? PAL.steelDark(), g, [0, 0.073 + L * 0.4, 0], [W * 0.26, L * 0.72, 0.016]);
  M(G.cone(4), blade, g, [0, 0.073 + L + 0.045, 0], [W * 0.37, 0.09, 0.007]);
  if (o.flame) {
    // flames licking along the blade
    for (let i = 0; i < 4; i++) {
      M(G.cone(4), o.flame, g, [(i % 2 ? 1 : -1) * W * 0.55, 0.14 + i * L * 0.22, 0],
        [W * 0.45, L * 0.22, 0.02], [0, 0, (i % 2 ? -1 : 1) * 0.35]);
    }
  }
  return g;
}

function kiteGeo() {
  return cachedGeo('kiteShield', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.125, 0.12);
    s.quadraticCurveTo(0, 0.15, 0.125, 0.12);
    s.quadraticCurveTo(0.13, -0.06, 0, -0.21);
    s.quadraticCurveTo(-0.13, -0.06, -0.125, 0.12);
    const e = new THREE.ExtrudeGeometry(s, {
      depth: 0.022,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.004,
      bevelSegments: 2,
      curveSegments: 8,
    });
    e.translate(0, 0, -0.011);
    return e;
  });
}
/** kite / heater shield, face normal -Z (outward, for the left arm) */
function shieldKite(parent, o = {}) {
  const g = grp(parent, o.p, o.r);
  const s = o.s ?? 1;
  const rim = o.rim ?? PAL.gold();
  M(kiteGeo(), rim, g, [0, 0, 0.006], [1.09 * s, 1.07 * s, 1]);
  M(kiteGeo(), o.face ?? PAL.royal(), g, [0, 0, 0], [s, s, 1]);
  const em = o.emblem ?? PAL.gold();
  if (o.cross !== false) {
    M(G.box(), em, g, [0, -0.02 * s, -0.016], [0.035 * s, 0.25 * s, 0.01]);
    M(G.box(), em, g, [0, 0.045 * s, -0.016], [0.17 * s, 0.035 * s, 0.01]);
    M(G.oct(), o.gem ?? PAL.white(), g, [0, 0.045 * s, -0.02], [0.022 * s, 0.022 * s, 0.012]);
  }
  for (const [rx, ry] of [[-0.1, 0.1], [0.1, 0.1], [-0.09, -0.05], [0.09, -0.05], [0, -0.17]]) {
    M(G.sph(0), rim, g, [rx * s, ry * s, -0.015], 0.009 * s);
  }
  return g;
}
function shieldRound(parent, o = {}) {
  const g = grp(parent, o.p, o.r);
  const R = o.R ?? 0.14;
  const rim = o.rim ?? PAL.iron();
  M(G.cyl(1, 1, 16), o.face ?? PAL.wood(), g, [0, 0, 0], [R, 0.025, R], [PI / 2, 0, 0]);
  M(G.torus(0.12, TAU, 6, 18), rim, g, [0, 0, 0], [R, R, R]);
  M(G.dome(12, 5), o.boss ?? PAL.iron(), g, [0, 0, -0.012], [R * 0.3, R * 0.25, R * 0.3], [-PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    M(G.sph(0), o.boss ?? rim, g, [Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88, -0.014], R * 0.065);
  }
  return g;
}

/** bow: pivot group, limbs in the pivot's XY plane, belly toward +X, string toward -X */
function bow(parent, o = {}) {
  const pivot = grp(parent, o.p, o.r);
  const R = o.R ?? 0.36, arc = 2.1;
  const lm = o.mat ?? PAL.wood();
  M(G.torus(0.05, arc, 4, 10), lm, pivot, [-R, 0, 0], [R, R, R], [0, 0, -arc / 2]);
  M(G.cyl(1, 1, 6), o.grip ?? PAL.leatherDark(), pivot, [0.002, 0, 0], [0.022, 0.09, 0.022]);
  const tx = -R + R * Math.cos(arc / 2), ty = R * Math.sin(arc / 2);
  if (o.tips) {
    M(G.sph(0), o.tips, pivot, [tx, ty, 0], 0.02);
    M(G.sph(0), o.tips, pivot, [tx, -ty, 0], 0.02);
  }
  const nock = grp(pivot, [tx, 0, 0]);
  const sm = mat('#f2ead2', { r: 0.6 });
  const strTop = seg(pivot, sm, [tx, ty, 0], [tx, 0, 0], 0.004, 0.004, 3);
  const strBot = seg(pivot, sm, [tx, -ty, 0], [tx, 0, 0], 0.004, 0.004, 3);
  // nocked arrow (only visible while drawing)
  const arrow = grp(nock);
  M(G.cyl(1, 1, 4), PAL.wood(), arrow, [0.24, 0, 0], [0.006, 0.5, 0.006], [0, 0, PI / 2]);
  M(G.cone(4), PAL.steel(), arrow, [0.51, 0, 0], [0.016, 0.05, 0.016], [0, 0, -PI / 2]);
  M(G.box(), PAL.white(), arrow, [0.03, 0, 0], [0.06, 0.03, 0.003]);
  arrow.visible = false;
  return { pivot, nock, strTop, strBot, arrow, tx, ty, R };
}
function updateBow(b, draw) {
  b.nock.position.x = b.tx - draw * b.R * 0.55;
  setSeg(b.strTop, [b.tx, b.ty, 0], b.nock.position);
  setSeg(b.strBot, [b.tx, -b.ty, 0], b.nock.position);
}

function quiver(parent, o = {}) {
  const g = grp(parent, o.p, o.r);
  M(G.cyl(1, 0.85, 6), o.mat ?? PAL.leather(), g, [0, 0, 0], [0.045, 0.28, 0.045]);
  M(G.cyl(1, 1, 6), o.trim ?? PAL.leatherDark(), g, [0, 0.13, 0], [0.05, 0.03, 0.05]);
  const fl = o.fletch ?? PAL.red();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const x = Math.cos(a) * 0.022, z = Math.sin(a) * 0.022;
    M(G.cyl(1, 1, 3), PAL.wood(), g, [x, 0.17, z], [0.005, 0.1, 0.005]);
    M(G.box(), fl, g, [x, 0.21 + (i % 2) * 0.01, z], [0.006, 0.055, 0.03], [0, a, 0]);
  }
  return g;
}

function polearm(parent, o = {}) {
  const g = grp(parent, o.p, o.r);
  const y0 = o.y0 ?? -0.5, y1 = o.y1 ?? 1.0;
  M(G.cyl(1, 1, 6), o.shaft ?? PAL.wood(), g, [0, (y0 + y1) / 2, 0], [o.thick ?? 0.016, y1 - y0, o.thick ?? 0.016]);
  const hm = o.head ?? PAL.steel();
  if (o.type === 'pike') {
    M(G.cyl(1, 1, 6), PAL.steelDark(), g, [0, y1, 0], [0.022, 0.04, 0.022]);
    M(G.oct(), hm, g, [0, y1 + 0.1, 0], [0.035, 0.14, 0.012]);
    if (o.tassel) M(G.cone(5), o.tassel, g, [0, y1 - 0.06, 0], [0.035, 0.08, 0.035], [PI, 0, 0]);
  } else if (o.type === 'halberd') {
    M(G.cyl(1, 1, 6), o.trim ?? PAL.gold(), g, [0, y1 - 0.02, 0], [0.024, 0.05, 0.024]);
    M(G.cone(4), hm, g, [0, y1 + 0.16, 0], [0.025, 0.26, 0.01]);
    // axe blade (forward, +X)
    M(G.tbox(1, 1, 0.03), hm, g, [0.075, y1 + 0.02, 0], [0.12, 0.16, 0.01], [0, 0, 0]);
    M(G.box(), hm, g, [0.135, y1 + 0.02, 0], [0.03, 0.2, 0.012]);
    // back hook
    M(G.cone(4), hm, g, [-0.06, y1 + 0.04, 0], [0.02, 0.1, 0.008], [0, 0, PI / 2 + 0.3]);
    if (o.tassel) M(G.cone(5), o.tassel, g, [0, y1 - 0.08, 0], [0.04, 0.09, 0.04], [PI, 0, 0]);
  } else if (o.type === 'lance') {
    M(G.cyl(0.25, 1, 8), o.shaftMat ?? PAL.white(), g, [0, y1 * 0.55, 0], [0.032, y1 * 0.9, 0.032]);
    M(G.cone(8), o.trim ?? PAL.gold(), g, [0, 0.08, 0], [0.065, 0.12, 0.065]);
    M(G.cone(6), hm, g, [0, y1 + 0.02, 0], [0.018, 0.1, 0.018]);
    if (o.stripe) for (let i = 0; i < 3; i++) M(G.cyl(1, 1, 8), o.stripe, g, [0, 0.3 + i * 0.22, 0], [0.03 - i * 0.004, 0.05, 0.03 - i * 0.004]);
    if (o.pennant) {
      const pg = grp(g, [0, y1 - 0.1, 0]);
      M(G.poly('pennant', [[0, 0], [-0.1, -0.24], [0.02, -0.24]]), o.pennant, pg, [0, 0, 0], [1, 1, 1], [PI / 2, 0, 0]);
      g.userData.pennant = pg;
    }
  }
  return g;
}

function staff(parent, o = {}) {
  const g = grp(parent, o.p, o.r);
  const y0 = o.y0 ?? -0.45, y1 = o.y1 ?? 0.75;
  M(G.cyl(0.85, 1, 6), o.shaft ?? PAL.wood(), g, [0, (y0 + y1) / 2, 0], [o.thick ?? 0.018, y1 - y0, o.thick ?? 0.018]);
  g.userData.top = grp(g, [0, y1, 0]);
  return g;
}

function plume(parent, mtl, p, len = 0.16, dir = -1, n = 4) {
  const g = grp(parent, p);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = 0.3 + t * 1.6;
    M(G.sph(0), mtl, g, [dir * Math.sin(a) * len * 0.55, Math.cos(a) * len * 0.45 + 0.02, 0],
      [0.035 + 0.01 * (1 - t), 0.024, 0.026], [0, 0, -dir * a]);
  }
  return g;
}

// helmets / heads ------------------------------------------------------------
function helmKettle(h, mtl, trim) {
  const r = h.P.headR;
  M(G.cyl(1, 1, 12), mtl, h.head, [0, r * 1.28, 0], [r * 1.55, 0.015, r * 1.55]);
  M(G.dome(14, 6), mtl, h.head, [0, r * 1.25, 0], [r * 1.04, r * 0.98, r * 1.04]);
  if (trim) M(G.cyl(1, 1, 12), trim, h.head, [0, r * 1.33, 0], [r * 1.06, 0.022, r * 1.06]);
  M(G.cone(8), trim ?? mtl, h.head, [0, r * 2.25, 0], [r * 0.18, r * 0.26, r * 0.18]);
}
function helmGreat(h, mtl, trim, o = {}) {
  const r = h.P.headR;
  const tr = trim ?? PAL.gold();
  M(G.cyl(0.92, 1, 12), mtl, h.head, [0, r * 1.05, 0], [r * 1.1, r * 1.75, r * 1.06]);
  M(G.dome(12, 5), mtl, h.head, [0, r * 1.92, 0], [r * 1.01, r * 0.4, r * 0.98]);
  // visor slit + ocularia brow + breaths
  M(G.box(), PAL.black(), h.head, [r * 1.03, r * 1.3, 0], [0.02, r * 0.14, r * 1.5]);
  M(G.box(), tr, h.head, [r * 1.07, r * 1.38, 0], [0.015, r * 0.07, r * 1.52]);
  M(G.box(), tr, h.head, [r * 1.08, r * 1.0, 0], [0.014, r * 1.6, r * 0.18]);
  for (const s of [1, -1]) {
    for (let i = 0; i < 3; i++) {
      M(G.sph(0), PAL.black(), h.head, [r * 1.02, r * (0.72 + i * 0.16), s * (r * 0.36 + i * 0.08)], 0.008);
    }
  }
  if (trim) M(G.cyl(1, 1, 12), trim, h.head, [0, r * 0.25, 0], [r * 1.14, r * 0.12, r * 1.1]);
  if (o.crown) {
    M(G.cyl(1, 1, 12), o.crown, h.head, [0, r * 1.98, 0], [r * 0.92, r * 0.18, r * 0.9]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      M(G.cone(4), o.crown, h.head, [Math.cos(a) * r * 0.84, r * 2.15, Math.sin(a) * r * 0.84], [r * 0.12, r * 0.32, r * 0.12]);
    }
    M(G.oct(), PAL.red(), h.head, [r * 0.92, r * 1.98, 0], [0.014, 0.02, 0.02]);
  }
}
function helmBarbute(h, mtl, trim) {
  const r = h.P.headR;
  M(G.dome(14, 6, 0.62), mtl, h.head, [0, r * 0.95, 0], [r * 1.12, r * 1.2, r * 1.1]);
  M(G.box(), mtl, h.head, [r * 0.55, r * 0.55, r * 0.75], [r * 0.7, r * 0.9, 0.025]);
  M(G.box(), mtl, h.head, [r * 0.55, r * 0.55, -r * 0.75], [r * 0.7, r * 0.9, 0.025]);
  M(G.box(), mtl, h.head, [r * 1.02, r * 1.0, 0], [0.03, r * 0.6, r * 0.2]); // nasal
  if (trim) M(G.cyl(1, 1, 12), trim, h.head, [0, r * 1.45, 0], [r * 1.0, 0.02, r * 1.0]);
}
function hair(h, mtl, o = {}) {
  const r = h.P.headR;
  M(G.sph(1), mtl, h.head, [-r * 0.15, r * 1.25, 0], [r * 0.95, r * 0.8, r * 0.98]);
  if (o.long) M(G.tbox(1.2, 1.1), mtl, h.head, [-r * 0.65, r * 0.6, 0], [r * 0.5, r * 1.4, r * 1.6]);
}
function beard(h, mtl, len = 1) {
  const r = h.P.headR;
  M(G.cone(6), mtl, h.head, [r * 0.62, r * 0.38, 0], [r * 0.62, r * 0.8 * len, r * 0.7], [PI, 0, -0.35]);
}
function face(h, P) {
  const r = P.headR;
  const em = P.eyeMat ?? PAL.eye();
  const es = P.eyeSize ?? 1;
  const browMat = P.browMat ?? PAL.hairBrown();
  for (const s of [1, -1]) {
    if (!P.eyeMat) {
      // Sclera + iris + sculpted brow for expressive humanoid eyes
      M(G.sph(0), PAL.white(), h.head, [r * 0.83, r * 1.12, s * r * 0.36], [0.012, 0.015 * es, 0.02 * es]);
      M(G.box(), browMat, h.head, [r * 0.86, r * 1.26, s * r * 0.36], [0.014, 0.011, 0.032], [s * -0.1, 0, 0]);
    }
    M(G.sph(0), em, h.head, [r * 0.88, r * 1.12, s * r * 0.36], [0.01, 0.012 * es, 0.014 * es]);
  }
  if (!P.noNose) {
    M(G.cone(4), P.noseMat ?? P.skin, h.head, [r * 0.96, r * 0.95, 0], [r * 0.18 * (P.nose ?? 1), r * 0.4 * (P.nose ?? 1), r * 0.2 * (P.nose ?? 1)], [0, 0, -PI / 2]);
    if (!P.eyeMat) {
      M(G.box(), mat('#984e40', { r: 0.68 }), h.head, [r * 0.88, r * 0.72, 0], [0.012, 0.009, r * 0.36]);
    }
  }
}
function pauldrons(h, mtl, o = {}) {
  const s = o.s ?? 1, a = h.P.armR;
  for (const arm of [h.armR, h.armL]) {
    M(G.dome(12, 5), mtl, arm.sh, [0, 0.005, 0], [a * 2.1 * s, a * 1.7 * s, a * 2.2 * s], [arm.side * 0.35, 0, 0]);
    if (o.trim) M(G.torus(0.15, TAU, 5, 14), o.trim, arm.sh, [0, 0.0, 0], [a * 2.1 * s, a * 2.2 * s, a * 2.1 * s], [PI / 2 + arm.side * 0.35, 0, 0]);
    if (o.spikes) M(G.cone(5), o.spikes, arm.sh, [0, a * 1.5 * s, arm.side * a * 0.6], [a * 0.5, a * 2.2 * s, a * 0.5], [arm.side * 0.5, 0, 0]);
  }
}
function belt(h, mtl, buckle) {
  const P = h.P;
  M(G.cyl(1, 1, 8), mtl, h.torso, [0, 0.025, 0], [P.torsoD / 2 * P.taper + 0.012, 0.04, P.torsoW / 2 * P.taper + 0.012]);
  if (buckle) M(G.box(), buckle, h.torso, [P.torsoD / 2 * P.taper + 0.014, 0.025, 0], [0.014, 0.048, 0.048]);
}
/** surcoat/tabard over the chest: slightly bigger copy of the chest */
function overChest(h, mtl, k = 1.06, hk = 0.82) {
  const P = h.P;
  return M(G.cyl(1, P.taper, 8), mtl, h.torso, [0, P.torsoLen * hk / 2, 0], [P.torsoD / 2 * k, P.torsoLen * hk, P.torsoW / 2 * k]);
}
/** skirt / tabard hanging from the hips */
function skirt(h, mtl, len = 0.18, flare = 1.25, open = false) {
  const P = h.P;
  const g = grp(h.hips, [0, 0.04, 0]);
  M(G.cyl(1, flare, 8, open), mtl, g, [0, -len / 2, 0], [P.torsoD / 2 * P.taper + 0.01, len, P.torsoW / 2 * P.taper + 0.01]);
  return g;
}
function tabardPanel(h, mtl, len = 0.2, emblem) {
  const P = h.P;
  const g = grp(h.hips, [P.torsoD / 2 * P.taper + 0.012, 0.05, 0]);
  M(G.tbox(1, 1 / 1.25), mtl, g, [0, -len / 2, 0], [0.012, len, P.torsoW * 0.55]);
  if (emblem) M(G.box(), emblem, g, [0.008, -len * 0.45, 0], [0.006, len * 0.5, 0.025]);
  const b = grp(h.hips, [-(P.torsoD / 2 * P.taper + 0.012), 0.05, 0]);
  M(G.tbox(1, 1 / 1.25), mtl, b, [0, -len / 2, 0], [0.012, len, P.torsoW * 0.55]);
  return [g, b];
}
function chestEmblemCross(h, mtl, k = 1.07) {
  const P = h.P;
  const x = P.torsoD / 2 * k * 0.93 + 0.004;
  M(G.box(), mtl, h.torso, [x, P.torsoLen * 0.5, 0], [0.008, P.torsoLen * 0.6, 0.03]);
  M(G.box(), mtl, h.torso, [x, P.torsoLen * 0.6, 0], [0.008, 0.03, P.torsoW * 0.45]);
  M(G.oct(), PAL.gold(), h.torso, [x + 0.004, P.torsoLen * 0.6, 0], [0.008, 0.02, 0.02]);
}
function cape(h, mtl, o = {}) {
  const P = h.P;
  const len = o.len ?? P.torsoLen + P.legLen * 0.7;
  const w = o.w ?? P.torsoW * 0.95;
  const piv = grp(h.torso, [-P.torsoD / 2 - 0.012, P.torsoLen - 0.02, 0], [0, 0, -0.08]);
  M(G.tbox(1, 1 / (o.flare ?? 1.35)), mtl, piv, [0, -len / 2, 0], [0.014, len, w * (o.flare ?? 1.35)]);
  if (o.inner) M(G.tbox(1, 1 / (o.flare ?? 1.35)), o.inner, piv, [0.009, -len / 2 + 0.01, 0], [0.006, len - 0.02, w * (o.flare ?? 1.35) * 0.96]);
  if (o.clasp) {
    M(G.sph(0), o.clasp, h.torso, [P.torsoD * 0.25, P.torsoLen - 0.01, P.torsoW * 0.42], 0.022);
    M(G.sph(0), o.clasp, h.torso, [P.torsoD * 0.25, P.torsoLen - 0.01, -P.torsoW * 0.42], 0.022);
  }
  h.cape = piv;
  return piv;
}
function robe(h, mtl, o = {}) {
  const P = h.P;
  const len = o.len ?? P.legLen + 0.06;
  const g = grp(h.hips, [0, 0.06, 0]);
  const geo = o.tatter ? G.tatter(1, o.flare ?? 1.5, 10, o.tatter) : G.cyl(1, o.flare ?? 1.5, 8, true);
  M(geo, mtl, g, [0, -len / 2, 0], [P.torsoD / 2 * P.taper + 0.012, len, P.torsoW / 2 * P.taper + 0.012]);
  if (o.hem) M(G.cyl(1, 1, 8, true), o.hem, g, [0, -len + 0.025, 0], [(P.torsoD / 2 * P.taper + 0.012) * (o.flare ?? 1.5) * 1.01, 0.04, (P.torsoW / 2 * P.taper + 0.012) * (o.flare ?? 1.5) * 1.01]);
  h.robe = g;
  return g;
}
function hood(h, mtl, o = {}) {
  const r = h.P.headR;
  const g = grp(h.head, [0, 0, 0]);
  M(G.dome(12, 5, 0.7), mtl, g, [-r * 0.12, r * 0.95, 0], [r * 1.35, r * 1.45, r * 1.3]);
  M(G.cone(6), mtl, g, [-r * 0.85, r * 1.6, 0], [r * 0.5, r * 0.9, r * 0.5], [0, 0, 1.2]);
  M(G.cyl(1.2, 1, 8, true), mtl, g, [-r * 0.1, r * 0.2, 0], [r * 1.2, r * 0.5, r * 1.25]);
  return g;
}
function skull(parent, r, o = {}) {
  const bm = o.mat ?? PAL.bone();
  const g = grp(parent, o.p ?? [0, 0, 0]);
  M(G.sph(1), bm, g, [0, r * 1.15, 0], [r * 0.95, r * 0.95, r * 0.85]);
  M(G.tbox(1, 0.85), bm, g, [r * 0.35, r * 0.45, 0], [r * 0.9, r * 0.5, r * 1.15]);
  // eye sockets + glowing eyes
  M(G.sph(0), PAL.black(), g, [r * 0.72, r * 1.0, r * 0.36], [r * 0.25, r * 0.22, r * 0.22]);
  M(G.sph(0), PAL.black(), g, [r * 0.72, r * 1.0, -r * 0.36], [r * 0.25, r * 0.22, r * 0.22]);
  const em = o.eyes ?? PAL.glowGreen();
  M(G.sph(0), em, g, [r * 0.83, r * 1.0, r * 0.34], r * 0.11);
  M(G.sph(0), em, g, [r * 0.83, r * 1.0, -r * 0.34], r * 0.11);
  M(G.cone(3), PAL.black(), g, [r * 0.85, r * 0.72, 0], [r * 0.1, r * 0.16, r * 0.1]);
  // teeth row
  M(G.box(), o.teeth ?? PAL.cream(), g, [r * 0.78, r * 0.38, 0], [r * 0.08, r * 0.12, r * 0.7]);
  return g;
}
function ribcage(parent, w, h, d, mtl, n = 4, y0 = 0.08) {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const k = 1 - Math.abs(t - 0.45) * 0.55;
    M(G.torus(0.13, PI * 1.55, 4, 12), mtl, parent, [0, y0 + t * h, 0], [d * k, w * k, d * 0.6], [PI / 2, 0, PI * 0.225]);
  }
}

// ============================================================================
//  BODY PLANS
// ============================================================================
function newRig(plan, scale = 1) {
  const root = new THREE.Group();
  root.name = 'creature';
  const scaler = grp(root);
  scaler.scale.setScalar(scale);
  const mover = grp(scaler);
  return {
    plan, root, scaler, mover, scale,
    wings: [], tail: [], cloth: [], bows: [], glows: [],
    hover: 0, flapIdle: 0.3, flapWalk: 0.75, flapSpeed: 6,
    impactTime: 0.36, durK: 1, attack: 'swing', shoot: null,
    walkSpeed: 1.5, fall: 'back', ph: Math.random() * 10,
  };
}

// ---------------------------------------------------------------- humanoid
function makeHumanoid(parent, o = {}) {
  const P = Object.assign({
    legLen: 0.42, torsoLen: 0.3, torsoW: 0.22, torsoD: 0.15, taper: 0.8, headR: 0.1, neckLen: 0.035,
    armLen: 0.34, armR: 0.036, legR: 0.045, hipW: 0.055, footL: 0.12,
  }, o);
  P.skin ??= PAL.skin(); P.top ??= PAL.royal(); P.bottom ??= PAL.leather(); P.boots ??= PAL.leatherDark();
  P.sleeve ??= P.top; P.fore ??= P.sleeve; P.handMat ??= P.skin; P.thigh ??= P.bottom; P.shin ??= P.boots;
  const h = { P, kind: 'biped' };
  h.base = grp(parent, o.basePos);
  h.hips = grp(h.base, [0, P.legLen, 0]);
  if (!P.noPelvis) M(G.box(), P.bottom, h.hips, [0, 0.015, 0], [P.torsoD * 0.88, 0.1, P.torsoW * 0.82]);
  h.torso = grp(h.hips, [0, 0.03, 0], [0, 0, P.hunch ?? 0]);
  if (!P.noChest) h.chest = M(G.cyl(1, P.taper, 8), P.top, h.torso, [0, P.torsoLen / 2, 0], [P.torsoD / 2, P.torsoLen, P.torsoW / 2]);
  if (!P.noNeck) M(G.cyl(1, 1, 6), P.neckMat ?? P.skin, h.torso, [0, P.torsoLen + P.neckLen / 2, 0], [P.headR * 0.42, P.neckLen + 0.03, P.headR * 0.42]);
  h.head = grp(h.torso, [P.headFwd ?? 0, P.torsoLen + P.neckLen, 0], [0, 0, P.headTilt ?? 0]);
  if (!P.noHead) {
    h.headMesh = M(G.sph(1), P.skin, h.head, [0, P.headR, 0], [P.headR * 0.95, P.headR * 1.08, P.headR * 0.9]);
    if (!P.noFace) face(h, P);
  }
  const shY = P.torsoLen - P.armR * 1.3, shZ = P.torsoW / 2 + P.armR * 0.6;
  h.armR = makeArm(h.torso, P, [0, shY, shZ], 1);
  h.armL = makeArm(h.torso, P, [0, shY, -shZ], -1);
  if (!P.noLegs) {
    h.legR = makeLeg(h.hips, P, [0, 0, P.hipW], 1);
    h.legL = makeLeg(h.hips, P, [0, 0, -P.hipW], -1);
  }
  h.armR.sh.rotation.set(-0.1, 0, 0.1);
  h.armL.sh.rotation.set(0.1, 0, 0.1);
  h.armR.el.rotation.z = 0.3;
  h.armL.el.rotation.z = 0.3;
  return h;
}
function makeArm(parent, P, pos, side) {
  const sh = grp(parent, pos);
  const up = P.armLen * 0.5, lo = P.armLen * 0.5;
  M(G.sph(0), P.sleeve, sh, [0, -0.005, 0], P.armR * 1.15);
  limb(sh, P.sleeve, up, P.armR, P.armR * 0.85);
  const el = grp(sh, [0, -up, 0]);
  limb(el, P.fore, lo, P.armR * 0.85, P.armR * 0.72);
  const hand = grp(el, [0, -lo, 0]);
  if (!P.noHands) M(G.sph(0), P.handMat, hand, [0, -P.armR * 0.5, 0], [P.armR * 1.0, P.armR * 1.15, P.armR * 0.95]);
  return { sh, el, hand, side };
}
function makeLeg(parent, P, pos, side) {
  const hip = grp(parent, pos);
  const th = P.legLen * 0.5, sl = P.legLen * 0.5;
  limb(hip, P.thigh, th, P.legR, P.legR * 0.85);
  const knee = grp(hip, [0, -th, 0]);
  limb(knee, P.shin, sl - 0.03, P.legR * 0.85, P.legR * 0.75);
  if (!P.noFeet) M(G.tbox(0.8, 0.9), P.boots, knee, [P.footL * 0.28, -sl + 0.028, 0], [P.footL, 0.056, P.legR * 1.7]);
  return { hip, knee, side };
}
function bipedRig(scale, o) {
  const rig = newRig('biped', scale);
  const h = makeHumanoid(rig.mover, o);
  rig.h = h;
  h.lunge = rig.mover;
  return rig;
}

/** skeletal humanoid (skeletons, liches' hands...) */
function skeletonBody(rig, o = {}) {
  const bone = o.bone ?? PAL.bone();
  const h = makeHumanoid(rig.mover, {
    legLen: 0.42, torsoLen: 0.29, torsoW: 0.2, torsoD: 0.12, headR: 0.095, armR: 0.018, legR: 0.022, hipW: 0.05,
    skin: bone, top: bone, bottom: bone, boots: bone, noChest: true, noHead: true, noPelvis: true, noNeck: true,
    footL: 0.1, ...o,
  });
  rig.h = h;
  h.lunge = rig.mover;
  M(G.tbox(1.25, 1.3), bone, h.hips, [0, 0.0, 0], [0.07, 0.06, 0.13]);
  for (let i = 0; i < 5; i++) M(G.box(), bone, h.torso, [-0.035, 0.02 + i * 0.05, 0], [0.032, 0.028, 0.032]);
  ribcage(h.torso, 0.095, 0.14, 0.068, bone, 4, 0.11);
  M(G.box(), bone, h.torso, [0, h.P.torsoLen - 0.02, 0], [0.025, 0.02, 0.2]);
  M(G.cyl(1, 1, 5), bone, h.torso, [0, h.P.torsoLen + 0.025, 0], [0.018, 0.06, 0.018]);
  h.skull = skull(h.head, h.P.headR, { eyes: o.eyes });
  for (const L of [h.legR, h.legL]) M(G.sph(0), bone, L.knee, [0, 0, 0], 0.026);
  for (const A of [h.armR, h.armL]) M(G.sph(0), bone, A.el, [0, 0, 0], 0.022);
  return h;
}

// ---------------------------------------------------------------- horse
function makeHorse(parent, o = {}) {
  const coat = o.coat ?? mat('#efe9df', { tex: 'leather' }), mane = o.mane ?? mat('#cfc6b8', { tex: 'wood' }), hoof = o.hoof ?? PAL.black();
  const q = { kind: 'quad', legs: [], tail: [] };
  const body = grp(parent, [0, 0.58, 0]);
  q.body = body;
  M(G.sph(1), coat, body, [0, 0, 0], [0.34, 0.165, 0.15]);
  M(G.sph(1), coat, body, [0.23, 0.025, 0], [0.17, 0.175, 0.14]);
  M(G.sph(1), coat, body, [-0.24, 0.02, 0], [0.17, 0.165, 0.155]);
  // neck + mane
  const neck = grp(body, [0.3, 0.07, 0], [0, 0, -0.62]);
  q.neck = neck;
  M(G.cyl(0.68, 1, 8), coat, neck, [0, 0.15, 0], [0.095, 0.34, 0.075]);
  for (let i = 0; i < 5; i++) M(G.box(), mane, neck, [-0.065, 0.03 + i * 0.065, 0], [0.05, 0.09, 0.024], [0, 0, 0.3]);
  const head = grp(neck, [0, 0.32, 0], [0, 0, 0.62]);
  q.head = head;
  seg(head, coat, [-0.03, 0.04, 0], [0.19, -0.13, 0], 0.068, 0.048, 8);
  M(G.sph(1), o.muzzle ?? coat, head, [0.2, -0.14, 0], [0.06, 0.05, 0.05]);
  M(G.box(), PAL.black(), head, [0.248, -0.15, 0.022], [0.012, 0.014, 0.014]);
  M(G.box(), PAL.black(), head, [0.248, -0.15, -0.022], [0.012, 0.014, 0.014]);
  const eye = o.eye ?? PAL.eye();
  const es = o.eyeGlow ? 0.02 : 0.015;
  M(G.sph(0), eye, head, [0.045, 0.0, 0.055], es);
  M(G.sph(0), eye, head, [0.045, 0.0, -0.055], es);
  M(G.cone(4), coat, head, [-0.03, 0.11, 0.035], [0.022, 0.08, 0.016], [0.25, 0, -0.25]);
  M(G.cone(4), coat, head, [-0.03, 0.11, -0.035], [0.022, 0.08, 0.016], [-0.25, 0, -0.25]);
  M(G.box(), mane, head, [0.0, 0.075, 0], [0.06, 0.05, 0.03], [0, 0, -0.5]);
  // bridle + bit rings + reins
  M(G.cyl(1, 1, 8, true), PAL.leatherDark(), head, [0.13, -0.08, 0], [0.058, 0.025, 0.058], [0, 0, 0.9]);
  for (const s of [1, -1]) {
    M(G.torus(0.22, TAU, 4, 10), PAL.gold(), head, [0.16, -0.12, s * 0.052], 0.018);
    seg(head, PAL.leatherDark(), [0.15, -0.12, s * 0.055], [-0.18, -0.16, s * 0.075], 0.006, 0.006, 4);
  }
  // legs
  const legDef = [[0.22, 0.085, 0, true], [0.22, -0.085, PI, true], [-0.25, 0.085, PI, false], [-0.25, -0.085, 0, false]];
  for (const [x, z, phase, front] of legDef) {
    const hip = grp(body, [x, -0.06, z]);
    limb(hip, coat, 0.25, front ? 0.05 : 0.068, 0.034);
    const knee = grp(hip, [0, -0.25, 0]);
    limb(knee, o.legLow ?? coat, 0.22, 0.032, 0.028);
    if (o.feathers) M(G.cyl(0.6, 1, 6), o.feathers, knee, [0, -0.19, 0], [0.04, 0.05, 0.04]);
    M(G.cyl(0.8, 1, 6), hoof, knee, [0.005, -0.245, 0], [0.04, 0.05, 0.04]);
    q.legs.push({ hip, knee, phase, front });
  }
  // tail
  let tp = grp(body, [-0.38, 0.08, 0], [0, 0, -0.55]);
  for (let i = 0; i < 3; i++) {
    M(G.cyl(1, 0.6, 5), mane, tp, [0, -0.075, 0], [0.042 - i * 0.006, 0.16, 0.032]);
    q.tail.push(tp);
    tp = grp(tp, [0, -0.14, 0], [0, 0, -0.18]);
  }
  // saddle & stirrups
  M(G.tbox(0.85, 0.9), o.saddle ?? PAL.leather(), body, [-0.03, 0.165, 0], [0.22, 0.05, 0.2]);
  M(G.box(), o.saddle ?? PAL.leather(), body, [-0.13, 0.2, 0], [0.04, 0.07, 0.17], [0, 0, 0.3]);
  M(G.box(), o.saddle ?? PAL.leather(), body, [0.08, 0.19, 0], [0.035, 0.05, 0.1], [0, 0, -0.3]);
  for (const s of [1, -1]) {
    seg(body, PAL.leatherDark(), [-0.02, 0.14, s * 0.155], [-0.02, -0.04, s * 0.17], 0.006, 0.006, 4);
    M(G.torus(0.2, TAU, 4, 10), PAL.goldDark(), body, [-0.02, -0.055, s * 0.172], [0.022, 0.026, 0.02], [0, PI / 2, 0]);
  }
  if (o.saddleCloth) {
    M(G.box(), o.saddleCloth, body, [-0.03, 0.15, 0], [0.3, 0.014, 0.3]);
    M(G.box(), o.saddleCloth, body, [-0.03, 0.08, 0.152], [0.26, 0.15, 0.012]);
    M(G.box(), o.saddleCloth, body, [-0.03, 0.08, -0.152], [0.26, 0.15, 0.012]);
    if (o.clothTrim) {
      M(G.box(), o.clothTrim, body, [-0.03, 0.005, 0.155], [0.27, 0.02, 0.012]);
      M(G.box(), o.clothTrim, body, [-0.03, 0.005, -0.155], [0.27, 0.02, 0.012]);
    }
  }
  if (o.capar) {
    M(G.tatter(1, 1.1, 12, o.caparTatter ?? 0.0001), o.capar, body, [0, -0.06, 0], [0.44, 0.24, 0.19]);
    M(G.sph(1), o.capar, body, [0.0, 0.03, 0], [0.41, 0.15, 0.172]);
    if (o.trim) M(G.cyl(1, 1, 12, true), o.trim, body, [0, -0.175, 0], [0.485, 0.03, 0.21]);
    if (o.emblem) {
      o.emblem(body, 1); o.emblem(body, -1);
    }
  }
  if (o.armor) {
    const a = o.armor, t = o.armorTrim ?? a;
    M(G.tbox(0.7, 0.85), a, head, [0.08, 0.01, 0], [0.2, 0.05, 0.1], [0, 0, -0.65]); // chanfron
    if (o.armorSpike) M(G.cone(5), o.armorSpike, head, [0.04, 0.09, 0], [0.018, 0.1, 0.018], [0, 0, -0.7]);
    for (let i = 0; i < 4; i++) M(G.box(), a, neck, [-0.045, 0.06 + i * 0.07, 0], [0.06, 0.06, 0.1], [0, 0, 0.25]);
    M(G.sph(1), a, body, [0.32, 0.0, 0], [0.11, 0.17, 0.165]);
    M(G.cyl(1, 1, 8, true), t, body, [0.33, -0.12, 0], [0.1, 0.03, 0.16], [0, 0, -0.3]);
    if (o.armorSpike) {
      M(G.cone(5), o.armorSpike, body, [0.43, 0.02, 0.07], [0.02, 0.09, 0.02], [0, 0, -PI / 2]);
      M(G.cone(5), o.armorSpike, body, [0.43, 0.02, -0.07], [0.02, 0.09, 0.02], [0, 0, -PI / 2]);
    }
  }
  return q;
}

/** horse + humanoid rider */
function riderRig(scale, horseOpts, humanOpts) {
  const rig = newRig('rider', scale);
  const q = makeHorse(rig.mover, horseOpts);
  rig.q = q;
  const legLen = humanOpts.legLen ?? 0.42;
  const h = makeHumanoid(q.body, { ...humanOpts, basePos: [-0.04, 0.185 - legLen, 0] });
  h.riding = true;
  h.lunge = null;
  rig.h = h;
  for (const L of [h.legR, h.legL]) {
    L.hip.rotation.set(-L.side * 0.5, 0, 1.35);
    L.knee.rotation.z = -1.5;
  }
  rig.fall = 'side';
  rig.walkSpeed = 1.6;
  rig.quadAttack = 'charge';
  return rig;
}

// ---------------------------------------------------------------- wings
function featherWing(parent, side, o) {
  const S = o.span ?? 0.6;
  const mg = mirrorGroup(parent, o.p, side);
  const pivot = grp(mg, [0, 0, 0], o.rest ?? [-0.45, -0.6, 0]);
  const m1 = o.mat, m2 = o.mat2 ?? o.mat, tip = o.tip ?? m1;
  seg(pivot, m2, [0, 0, 0], [0.02, 0.01, S * 0.45], 0.032, 0.026, 6);
  M(G.sph(1), m2, pivot, [-S * 0.1, 0, S * 0.22], [S * 0.16, 0.03, S * 0.25]);
  for (let i = 0; i < 4; i++) {
    const z = S * (0.06 + i * 0.1);
    M(G.sph(0), m1, pivot, [-S * 0.28, -0.006, z], [S * 0.21, 0.013, S * 0.072], [0, 0.1 + i * 0.07, 0]);
  }
  const outer = grp(pivot, [0.02, 0.01, S * 0.45]);
  seg(outer, m2, [0, 0, 0], [0.01, 0, S * 0.36], 0.026, 0.012, 6);
  M(G.sph(1), m2, outer, [-S * 0.07, 0.004, S * 0.13], [S * 0.11, 0.025, S * 0.18]);
  const n = (o.n ?? 5) + 1;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const z = S * (0.02 + t * 0.34);
    const len = S * (0.34 + t * 0.22);
    const f = grp(outer, [0, -0.004 * i, z], [0, 0.15 + t * 0.95, 0]);
    M(G.sph(0), t > 0.55 ? tip : m1, f, [-len * 0.5, 0, 0], [len * 0.5, 0.011, S * 0.048]);
  }
  return { pivot, outer, side, mg };
}
function membraneWing(parent, side, o) {
  const S = o.span ?? 1, R = o.r ?? 0.035;
  const mg = mirrorGroup(parent, o.p, side);
  const pivot = grp(mg, [0, 0, 0], o.rest ?? [-0.5, -0.5, 0]);
  const bm = o.bone, mm = o.membrane;
  const E = [0.04 * S, 0.02 * S, 0.42 * S];
  seg(pivot, bm, [0, 0, 0], E, R, R * 0.8, 6);
  const tt = o.tatter ? 1 : 0;
  M(G.poly(`mwi${r2(S)}_${tt}`, [[0.02 * S, 0.01 * S], [E[0], E[2]], [-0.42 * S, 0.49 * S], tt ? [-0.33 * S, 0.33 * S] : [-0.38 * S, 0.26 * S],
    tt ? [-0.4 * S, 0.2 * S] : [-0.33 * S, 0.12 * S], [-0.24 * S, 0.02 * S]]), mm, pivot, [0, 0, 0]);
  const outer = grp(pivot, E);
  const f = [[0.1 * S, 0.56 * S], [-0.14 * S, 0.52 * S], [-0.33 * S, 0.37 * S], [-0.46 * S, 0.07 * S]];
  seg(outer, bm, [0, 0, 0], [f[0][0], 0, f[0][1]], R * 0.8, R * 0.3, 5);
  for (let i = 1; i < 4; i++) seg(outer, bm, [0, 0, 0], [f[i][0], 0, f[i][1]], R * 0.55, R * 0.2, 4);
  M(G.cone(4), o.claw ?? bm, outer, [0.05 * S, 0.02, 0.0], [R * 0.6, 0.08 * S, R * 0.6], [0, 0, -PI / 2]);
  const pts = [[0, 0]];
  for (let i = 0; i < 4; i++) {
    pts.push(f[i]);
    if (i < 3) {
      const mx = (f[i][0] + f[i + 1][0]) / 2, mz = (f[i][1] + f[i + 1][1]) / 2;
      const k = tt ? 0.62 : 0.8;
      if (tt) {
        pts.push([mx * 0.95 + (f[i][0] - mx) * 0.4, mz * 0.95 + (f[i][1] - mz) * 0.4]);
        pts.push([mx * k, mz * k]);
        pts.push([mx * 0.9 + (f[i + 1][0] - mx) * 0.45, mz * 0.9 + (f[i + 1][1] - mz) * 0.45]);
      } else pts.push([mx * k, mz * k]);
    }
  }
  M(G.poly(`mwo${r2(S)}_${tt}`, pts), mm, outer, [0, 0, 0]);
  return { pivot, outer, side, mg };
}

// ---------------------------------------------------------------- generic quadruped legs
function quadLeg(q, body, pos, len, o) {
  const hip = grp(body, pos, [0, 0, -(body.rotation.z || 0)]);
  const up = len * (o.split ?? 0.52), lo = len - up - (o.foot ?? 0.02);
  limb(hip, o.upMat, up, o.rUp, o.rKnee ?? o.rUp * 0.7);
  const knee = grp(hip, [0, -up, 0]);
  limb(knee, o.lowMat ?? o.upMat, lo, o.rKnee ?? o.rUp * 0.7, o.rLow ?? o.rUp * 0.55);
  if (o.paw) o.paw(knee, -lo);
  const L = { hip, knee, phase: o.phase ?? 0, front: !!o.front };
  q.legs.push(L);
  return L;
}
function hipWorldY(body, pos) {
  const v = new THREE.Vector3(pos[0], pos[1], pos[2]).applyEuler(body.rotation);
  return v.y + body.position.y;
}
function talons(knee, y, mtl, r = 0.016, len = 0.06) {
  for (let i = -1; i <= 1; i++) M(G.cone(4), mtl, knee, [0.035, y + 0.01, i * 0.022], [r, len, r], [0, i * 0.35, -PI / 2 - 0.25]);
  M(G.cone(4), mtl, knee, [-0.025, y + 0.012, 0], [r * 0.8, len * 0.7, r * 0.8], [0, 0, PI / 2 + 0.3]);
}

// ============================================================================
//  CREATURE BUILDERS
// ============================================================================
const steelSet = () => ({
  top: PAL.steel(), sleeve: PAL.steel(), fore: PAL.steel(), handMat: PAL.steelDark(),
  bottom: PAL.chain(), thigh: PAL.steel(), shin: PAL.steel(), boots: PAL.steelDark(),
});
function kneeCops(h, mtl) {
  for (const L of [h.legR, h.legL]) M(G.sph(0), mtl, L.knee, [0.02, 0, 0], h.P.legR * 1.1);
}
/** held weapon pivot: world angle phi (0 = up, -PI/2 = forward), given the arm rest pose */
function holdPivot(h, arm, phi, p = [0, -0.035, 0]) {
  const tot = arm.sh.rotation.z + arm.el.rotation.z + (h.torso.rotation.z || 0);
  return grp(arm.hand, p, [0, 0, phi - tot]);
}
function axeProp(parent, o = {}) {
  const g = grp(parent, o.p, o.r);
  M(G.cyl(1, 1, 5), o.handle ?? PAL.wood(), g, [0, 0.1, 0], [0.014, 0.3, 0.014]);
  M(G.tbox(1.7, 1, 0.02), o.blade ?? PAL.iron(), g, [0.05, 0.21, 0], [0.07, 0.09, 0.014], [0, 0, -PI / 2]);
  M(G.box(), o.blade ?? PAL.iron(), g, [0.095, 0.21, 0], [0.012, 0.13, 0.016]);
  M(G.cone(4), o.blade ?? PAL.iron(), g, [-0.03, 0.22, 0], [0.012, 0.05, 0.01], [0, 0, PI / 2]);
  return g;
}

const BUILD = {};

// ------------------------------------------------------------------ CASTLE
BUILD.pikeman = () => {
  const rig = bipedRig(1.0, {
    top: PAL.chain(), sleeve: PAL.chain(), fore: PAL.leather(), bottom: PAL.royalDark(),
    thigh: PAL.royalDark(), shin: PAL.leatherDark(), boots: PAL.leatherDark(),
  });
  const h = rig.h, r = h.P.headR;
  overChest(h, PAL.royal(), 1.08, 0.8);
  chestEmblemCross(h, PAL.white(), 1.08);
  belt(h, PAL.leatherDark(), PAL.gold());
  skirt(h, PAL.royal(), 0.15, 1.22);
  helmKettle(h, PAL.steel(), PAL.steelDark());
  M(G.box(), PAL.leatherDark(), h.head, [r * 0.35, r * 0.55, 0], [0.012, r * 0.9, r * 1.8]); // chin strap
  beard(h, PAL.hairBrown(), 0.6);
  M(G.cyl(1, 1, 6), PAL.leatherDark(), h.armR.el, [0, -0.12, 0], [0.036, 0.06, 0.036]);
  h.armR.sh.rotation.set(-0.12, 0, 0.35);
  h.armR.el.rotation.z = 1.1;
  h.armL.sh.rotation.set(0.12, 0, 0.2);
  h.armL.el.rotation.z = 0.45;
  rig.weapon = holdPivot(h, h.armR, -0.1);
  polearm(rig.weapon, { type: 'pike', y0: -0.42, y1: 1.05, tassel: PAL.royal() });
  rig.attack = 'thrust';
  return rig;
};

BUILD.halberdier = () => {
  const rig = bipedRig(1.05, { ...steelSet(), sleeve: PAL.chain(), bottom: PAL.royalDark() });
  const h = rig.h, r = h.P.headR;
  overChest(h, PAL.royal(), 1.07, 0.5);
  M(G.box(), PAL.gold(), h.torso, [h.P.torsoD / 2 + 0.006, h.P.torsoLen * 0.62, 0], [0.01, 0.025, h.P.torsoW * 0.8]);
  M(G.torus(0.2, TAU, 3, 8), PAL.gold(), h.torso, [0, h.P.torsoLen, 0], [0.06, 0.07, 0.05], [PI / 2, 0, 0]);
  belt(h, PAL.gold(), PAL.gold());
  tabardPanel(h, PAL.royal(), 0.2, PAL.gold());
  pauldrons(h, PAL.steel(), { trim: PAL.gold() });
  kneeCops(h, PAL.steel());
  helmKettle(h, PAL.steel(), PAL.gold());
  plume(h.head, PAL.white(), [-r * 0.1, r * 2.2, 0], 0.17);
  plume(h.head, PAL.royal(), [-r * 0.2, r * 2.15, 0], 0.13, -1, 3);
  beard(h, PAL.hairBrown(), 0.8);
  h.armR.sh.rotation.set(-0.12, 0, 0.35);
  h.armR.el.rotation.z = 1.1;
  h.armL.sh.rotation.set(0.12, 0, 0.2);
  h.armL.el.rotation.z = 0.45;
  rig.weapon = holdPivot(h, h.armR, -0.08);
  polearm(rig.weapon, { type: 'halberd', y0: -0.42, y1: 1.02, trim: PAL.gold(), tassel: PAL.royal(), thick: 0.018 });
  rig.attack = 'swing';
  return rig;
};

function archerBase(marks) {
  const rig = bipedRig(marks ? 1.02 : 0.98, {
    top: marks ? PAL.royal() : mat('#3a64b8'), sleeve: marks ? PAL.white() : mat('#3a64b8'),
    fore: marks ? PAL.white() : PAL.leather(), bottom: PAL.leather(), thigh: mat('#6e5a44'),
    shin: PAL.leatherDark(), boots: PAL.leatherDark(),
  });
  const h = rig.h, r = h.P.headR;
  overChest(h, marks ? mat('#24489a') : PAL.leather(), 1.07, marks ? 0.85 : 0.6);
  belt(h, PAL.leatherDark(), PAL.gold());
  skirt(h, marks ? PAL.royal() : mat('#3a64b8'), 0.15, 1.25);
  hair(h, marks ? PAL.hairBlond() : PAL.hairBrown());
  if (marks) {
    // wide-brimmed feathered hat
    M(G.cyl(1, 1, 10), mat('#23324f'), h.head, [0, r * 1.62, 0], [r * 1.95, 0.016, r * 1.95], [0.12, 0, 0.12]);
    M(G.cyl(0.8, 1, 8), mat('#23324f'), h.head, [0, r * 1.92, 0], [r * 0.95, r * 0.6, r * 0.95]);
    M(G.cyl(1, 1, 8), PAL.gold(), h.head, [0, r * 1.7, 0], [r * 0.97, 0.02, r * 0.97]);
    plume(h.head, PAL.white(), [-r * 0.2, r * 2.0, r * 0.55], 0.26, -1, 5);
    plume(h.head, mat('#d33b3b'), [-r * 0.3, r * 1.95, r * 0.7], 0.16, -1, 3);
    M(G.cone(4), PAL.hairBlond(), h.head, [r * 0.82, r * 0.42, 0], [r * 0.25, r * 0.4, r * 0.25], [PI, 0, -0.3]);
    cape(h, PAL.royal(), { len: 0.55, inner: PAL.gold(), clasp: PAL.gold(), flare: 1.25 });
    M(G.dome(8, 3), PAL.leather(), h.armR.sh, [0, 0.005, 0], [0.075, 0.06, 0.08], [0.35, 0, 0]);
  } else {
    M(G.cone(6), PAL.leather(), h.head, [-r * 0.15, r * 1.75, 0], [r * 1.05, r * 0.95, r * 0.98], [0, 0, 0.45]);
    M(G.cyl(1, 1, 8), PAL.leatherDark(), h.head, [0, r * 1.42, 0], [r * 1.02, 0.025, r * 1.0]);
    M(G.sph(0), PAL.red(), h.head, [-r * 0.5, r * 1.75, r * 0.75], [0.1, 0.012, 0.028], [0.3, 0.4, 0.7]);
  }
  quiver(h.torso, { p: [-h.P.torsoD / 2 - 0.035, 0.2, 0.05], r: [0.4, 0, 0.25], fletch: marks ? PAL.white() : PAL.red() });
  if (marks) quiver(h.torso, { p: [-h.P.torsoD / 2 - 0.035, 0.18, -0.05], r: [-0.4, 0, 0.25], fletch: mat('#d33b3b') });
  M(G.cyl(1, 1, 6), PAL.leatherDark(), h.armL.el, [0, -0.11, 0], [0.036, 0.09, 0.036]);
  h.armL.sh.rotation.set(0.1, 0, 0.15);
  h.armL.el.rotation.z = 0.35;
  const b = bow(h.armL.hand, {
    p: [0, -0.035, 0], r: [0, 0, -0.5], R: marks ? 0.42 : 0.36,
    mat: marks ? mat('#6b3d1e') : PAL.wood(), tips: marks ? PAL.gold() : null,
  });
  rig.bows.push(b);
  rig.bow = b;
  rig.proj = b.pivot;
  rig.shoot = 'bow';
  rig.attack = 'swingL';
  return rig;
}
BUILD.archer = () => archerBase(false);
BUILD.marksman = () => archerBase(true);

function griffinRig(royal) {
  const rig = newRig('griffin', royal ? 1.12 : 1.02);
  const lion = mat(royal ? '#d2a35a' : '#c58f4a', { tex: 'leather' }), lionD = mat(royal ? '#8c6330' : '#7a522a', { tex: 'leather' });
  const feath = mat(royal ? '#6e4022' : '#8a5a32', { tex: 'scales' }), light = mat(royal ? '#fbf6ec' : '#eadfc6', { tex: 'scales' });
  const headM = mat(royal ? '#ffffff' : '#efe6d2', { tex: 'scales' });
  const beakM = mat('#f0b52e', { r: 0.42, m: 0.15 }), talon = mat('#2a2622', { tex: 'bone' }), legY = mat('#e8b23a', { tex: 'scales' });
  const wingM = mat(royal ? '#7a4826' : '#9a6a3a', { tex: 'scales' }), wingM2 = mat(royal ? '#5e361c' : '#7a5230', { tex: 'scales' });
  const tipM = royal ? PAL.gold() : mat('#4a3020', { tex: 'scales' });
  const q = { kind: 'quad', legs: [], tail: [] };
  rig.q = q;
  const body = grp(rig.mover, [0, 0.52, 0], [0, 0, 0.2]);
  q.body = body;
  M(G.sph(1), lion, body, [-0.12, -0.01, 0], [0.26, 0.145, 0.135]);
  M(G.sph(1), feath, body, [0.12, 0.03, 0], [0.19, 0.17, 0.15]);
  M(G.sph(1), light, body, [0.22, 0.0, 0], [0.12, 0.15, 0.11]);
  for (let i = 0; i < 4; i++) M(G.cone(4), light, body, [0.27, -0.06 - i * 0.024, (i - 1.5) * 0.04], [0.032, 0.085, 0.022], [0, 0, PI - 0.4]);
  // neck + eagle head
  const neck = grp(body, [0.24, 0.13, 0], [0, 0, -0.55]);
  q.neck = neck;
  M(G.cyl(0.75, 1, 8), headM, neck, [0, 0.08, 0], [0.085, 0.2, 0.08]);
  M(G.cone(8), light, neck, [0, 0.0, 0], [0.13, 0.14, 0.13], [PI, 0, 0]);
  const head = grp(neck, [0, 0.18, 0], [0, 0, 0.55 - 0.2 + 0.05]);
  q.head = head;
  M(G.sph(1), headM, head, [0, 0.05, 0], [0.09, 0.085, 0.078]);
  M(G.cone(4), beakM, head, [0.11, 0.035, 0], [0.034, 0.11, 0.03], [0, 0, -PI / 2 - 0.2]);
  M(G.cone(4), beakM, head, [0.162, 0.005, 0], [0.016, 0.05, 0.02], [0, 0, -PI + 0.4]);
  q.jaw = grp(head, [0.06, 0.008, 0]);
  M(G.cone(4), beakM, q.jaw, [0.04, -0.005, 0], [0.022, 0.07, 0.02], [0, 0, -PI / 2 - 0.15]);
  for (const s of [1, -1]) {
    M(G.sph(0), mat('#1a1208'), head, [0.06, 0.075, s * 0.05], 0.017);
    M(G.sph(0), mat('#ffd23a', { e: '#c08000', ei: 0.9 }), head, [0.055, 0.075, s * 0.052], 0.012);
    M(G.box(), headM, head, [0.06, 0.1, s * 0.045], [0.06, 0.02, 0.035], [s * 0.2, 0, -0.2]);
    M(G.cone(4), headM, head, [-0.07, 0.12, s * 0.04], [0.022, 0.1, 0.016], [s * 0.3, 0, 0.95]);
  }
  if (royal) {
    M(G.cyl(1, 1, 8), PAL.gold(), head, [-0.005, 0.125, 0], [0.052, 0.026, 0.048]);
    for (let i = 0; i < 4; i++) M(G.cone(4), PAL.gold(), head, [-0.035 + i * 0.024, 0.155, 0], [0.012, 0.052, 0.012]);
    M(G.box(), PAL.royal(), body, [-0.05, 0.12, 0], [0.24, 0.02, 0.24]);
    M(G.box(), PAL.royal(), body, [-0.05, 0.04, 0.122], [0.22, 0.16, 0.01]);
    M(G.box(), PAL.royal(), body, [-0.05, 0.04, -0.122], [0.22, 0.16, 0.01]);
    M(G.box(), PAL.gold(), body, [-0.05, -0.04, 0.125], [0.23, 0.02, 0.01]);
    M(G.box(), PAL.gold(), body, [-0.05, -0.04, -0.125], [0.23, 0.02, 0.01]);
    M(G.sph(1), PAL.gold(), body, [0.26, 0.02, 0], [0.08, 0.11, 0.125]);
  }
  // legs
  for (const s of [1, -1]) {
    const fp = [0.17, -0.08, s * 0.075];
    quadLeg(q, body, fp, hipWorldY(body, fp), {
      upMat: feath, lowMat: legY, rUp: 0.045, rKnee: 0.024, rLow: 0.02, front: true, phase: s > 0 ? 0 : PI,
      paw: (k, y) => talons(k, y, talon),
    });
    const hp = [-0.24, -0.03, s * 0.08];
    quadLeg(q, body, hp, hipWorldY(body, hp), {
      upMat: lion, rUp: 0.062, rKnee: 0.034, rLow: 0.03, phase: s > 0 ? PI : 0,
      paw: (k, y) => M(G.sph(0), lion, k, [0.02, y + 0.015, 0], [0.042, 0.022, 0.036]),
    });
  }
  // lion tail
  let tp = grp(body, [-0.36, 0.03, 0], [0, 0, -1.05]);
  for (let i = 0; i < 3; i++) {
    limb(tp, lion, 0.13, 0.02, 0.016, 5);
    q.tail.push(tp);
    tp = grp(tp, [0, -0.12, 0], [0, 0, 0.35]);
  }
  M(G.sph(0), lionD, tp, [0, -0.02, 0], [0.035, 0.05, 0.035]);
  for (const s of [1, -1]) {
    rig.wings.push(featherWing(body, s, {
      p: [0.08, 0.13, s * 0.1], span: royal ? 0.66 : 0.62, mat: wingM, mat2: wingM2, tip: tipM, rest: [-0.5, -0.8, 0],
    }));
  }
  rig.hover = 0.14;
  rig.quadAttack = 'claw';
  rig.fall = 'side';
  rig.walkSpeed = 1.6;
  rig.proj = head;
  return rig;
}
BUILD.griffin = () => griffinRig(false);
BUILD.royalGriffin = () => griffinRig(true);

function swordsmanBase(crus) {
  const rig = bipedRig(crus ? 1.25 : 1.2, { ...steelSet(), torsoW: 0.24, torsoD: 0.16 });
  const h = rig.h, r = h.P.headR;
  overChest(h, crus ? PAL.white() : PAL.royal(), 1.07, 0.82);
  chestEmblemCross(h, crus ? PAL.red() : PAL.gold());
  belt(h, crus ? PAL.gold() : PAL.leatherDark(), PAL.gold());
  tabardPanel(h, crus ? PAL.white() : PAL.royal(), 0.21, crus ? PAL.red() : PAL.gold());
  pauldrons(h, PAL.steel(), { trim: PAL.gold(), s: crus ? 1.2 : 1.05 });
  kneeCops(h, PAL.steel());
  helmGreat(h, PAL.steel(), PAL.gold(), { crown: crus ? PAL.gold() : null });
  plume(h.head, crus ? PAL.red() : PAL.royal(), [0, r * (crus ? 2.25 : 2.05), 0], 0.2, -1, 5);
  if (crus) cape(h, PAL.red(), { inner: PAL.redDark(), clasp: PAL.gold() });
  rig.weapon = holdPivot(h, h.armR, -0.75);
  sword(rig.weapon, { len: crus ? 0.44 : 0.42, w: 0.05 });
  if (crus) {
    rig.weapon2 = holdPivot(h, h.armL, -0.75);
    sword(rig.weapon2, { len: 0.44, w: 0.05 });
    rig.attack = 'dual';
  } else {
    rig.shield = grp(h.armL.el, [0.0, -0.11, -0.055], [0, -0.45, 0]);
    shieldKite(rig.shield, { s: 1.1 });
    rig.attack = 'swing';
  }
  return rig;
}
BUILD.swordsman = () => swordsmanBase(false);
BUILD.crusader = () => swordsmanBase(true);

function monkBase(zeal) {
  const robeM = zeal ? PAL.white() : mat('#7a5634');
  const robeD = zeal ? PAL.gold() : mat('#5a3d22');
  const rig = bipedRig(zeal ? 1.48 : 1.42, {
    top: robeM, sleeve: robeM, fore: robeM, bottom: robeM, thigh: robeM, shin: robeM,
    boots: PAL.leatherDark(), torsoW: 0.23, torsoD: 0.16, taper: 0.9,
  });
  const h = rig.h, r = h.P.headR;
  robe(h, mat(zeal ? '#f2eee4' : '#7a5634', { ds: true }), { flare: 1.7, hem: zeal ? mat('#e9b949', { m: 0.8, r: 0.3, ds: true }) : mat('#5a3d22', { ds: true }) });
  belt(h, zeal ? PAL.gold() : mat('#d8c48a'), zeal ? PAL.royal() : null);
  seg(h.torso, zeal ? PAL.gold() : mat('#d8c48a'), [h.P.torsoD * 0.45, 0.02, 0.05], [h.P.torsoD * 0.55, -0.22, 0.07], 0.008);
  for (const A of [h.armR, h.armL]) M(G.cyl(1, 1.7, 6, true), mat(zeal ? '#f2eee4' : '#7a5634', { ds: true }), A.el, [0, -0.1, 0], [0.042, 0.16, 0.042]);
  if (zeal) {
    // stole + mitre
    for (const s of [1, -1]) M(G.box(), PAL.royal(), h.torso, [h.P.torsoD / 2 * 0.92, 0.1, s * 0.05], [0.012, 0.42, 0.035], [s * -0.12, 0, 0]);
    M(G.box(), PAL.gold(), h.torso, [h.P.torsoD / 2 * 0.95, -0.08, 0.06], [0.012, 0.03, 0.04]);
    M(G.box(), PAL.gold(), h.torso, [h.P.torsoD / 2 * 0.95, -0.08, -0.06], [0.012, 0.03, 0.04]);
    M(G.tbox(0.75, 0.25), PAL.white(), h.head, [0, r * 2.0, 0], [r * 1.25, r * 1.4, r * 1.6]);
    M(G.box(), PAL.gold(), h.head, [r * 0.55, r * 2.05, 0], [0.01, r * 1.1, r * 0.18]);
    M(G.box(), PAL.gold(), h.head, [r * 0.55, r * 2.15, 0], [0.01, r * 0.18, r * 0.65]);
    M(G.cyl(1, 1, 8), PAL.gold(), h.head, [0, r * 1.4, 0], [r * 1.0, 0.025, r * 0.98]);
    beard(h, mat('#d8d4c8'), 1.2);
    pauldrons(h, PAL.gold(), { s: 0.9 });
  } else {
    M(G.torus(0.35, TAU, 4, 8), robeD, h.torso, [-0.01, h.P.torsoLen, 0], [0.1, 0.13, 0.1], [PI / 2, 0, 0]);
    M(G.torus(0.3, TAU, 3, 10), PAL.hairBrown(), h.head, [-0.01, r * 1.2, 0], [r * 0.92, r * 0.92, r * 0.6], [PI / 2, 0, 0]);
    beard(h, PAL.hairBrown(), 1.0);
    M(G.box(), PAL.gold(), h.torso, [h.P.torsoD / 2 + 0.008, h.P.torsoLen * 0.6, 0], [0.008, 0.06, 0.012]);
    M(G.box(), PAL.gold(), h.torso, [h.P.torsoD / 2 + 0.008, h.P.torsoLen * 0.63, 0], [0.008, 0.012, 0.04]);
  }
  h.armR.sh.rotation.set(-0.1, 0, 0.25);
  h.armR.el.rotation.z = 0.9;
  rig.weapon = holdPivot(h, h.armR, 0.05);
  const st = staff(rig.weapon, { y0: -0.5, y1: zeal ? 0.66 : 0.6, shaft: zeal ? PAL.gold() : PAL.wood() });
  const top = st.userData.top;
  const glow = grp(top, [0, 0.07, 0]);
  if (zeal) {
    M(G.torus(0.15, TAU, 3, 12), PAL.gold(), top, [0, 0.08, 0], [0.085, 0.085, 0.085]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      M(G.cone(4), PAL.gold(), top, [0, 0.08 + Math.cos(a) * 0.11, Math.sin(a) * 0.11], [0.012, 0.05, 0.012], [-a, 0, 0]);
    }
    M(G.oct(), PAL.glowGold(), glow, [0, 0.01, 0], [0.045, 0.06, 0.045]);
  } else {
    M(G.torus(0.18, TAU, 3, 10), PAL.gold(), top, [0, 0.07, 0], [0.065, 0.065, 0.065]);
    M(G.sph(1), PAL.glowGold(), glow, [0, 0, 0], 0.035);
  }
  rig.glows.push(glow);
  rig.proj = glow;
  rig.shoot = 'cast';
  rig.attack = 'swing';
  return rig;
}
BUILD.monk = () => monkBase(false);
BUILD.zealot = () => monkBase(true);

function knightRider(champ) {
  const capar = mat('#2f5fbf', { ds: true }), trim = mat('#e9b949', { m: 0.8, r: 0.3, ds: true });
  const rig = riderRig(champ ? 1.27 : 1.22, {
    coat: mat(champ ? '#6e4a2c' : '#f1ece4', { tex: 'leather' }), mane: mat(champ ? '#1b1714' : '#d8d0c4', { tex: 'wood' }),
    muzzle: mat(champ ? '#4a3220' : '#ddd3c8', { tex: 'leather' }), capar, trim,
    armor: champ ? PAL.steel() : null, armorTrim: PAL.gold(),
    emblem: (body, s) => {
      M(G.box(), PAL.gold(), body, [-0.02, -0.07, s * 0.2], [0.03, 0.14, 0.012]);
      M(G.box(), PAL.gold(), body, [-0.02, -0.04, s * 0.2], [0.11, 0.03, 0.012]);
    },
  }, { ...steelSet() });
  const h = rig.h, r = h.P.headR;
  overChest(h, PAL.royal(), 1.07, 0.78);
  chestEmblemCross(h, champ ? PAL.gold() : PAL.white());
  belt(h, PAL.gold(), PAL.gold());
  pauldrons(h, PAL.steel(), { trim: PAL.gold(), s: champ ? 1.2 : 1 });
  helmGreat(h, PAL.steel(), PAL.gold(), { crown: champ ? PAL.gold() : null });
  plume(h.head, PAL.white(), [0, r * (champ ? 2.25 : 2.05), 0], 0.2, -1, 5);
  plume(h.head, PAL.royal(), [-0.01, r * (champ ? 2.2 : 2.0), 0], 0.14, -1, 3);
  if (champ) cape(h, PAL.royal(), { len: 0.32, inner: PAL.gold(), clasp: PAL.gold(), flare: 1.3 });
  h.armR.sh.rotation.set(-0.15, 0, 0.3);
  h.armR.el.rotation.z = 1.15;
  rig.weapon = holdPivot(h, h.armR, -PI / 2 + 0.45);
  const lance = polearm(rig.weapon, {
    type: 'lance', y0: -0.25, y1: champ ? 0.95 : 0.88, stripe: PAL.royal(),
    shaftMat: PAL.white(), trim: PAL.gold(), pennant: champ ? mat('#2f5fbf', { ds: true }) : null,
  });
  if (lance.userData.pennant) rig.cloth.push({ o: lance.userData.pennant, axis: 'y', amp: 0.35, speed: 5 });
  h.armL.sh.rotation.set(0.25, 0, 0.5);
  h.armL.el.rotation.z = 0.7;
  rig.shield = grp(h.armL.el, [0.0, -0.1, -0.055], [0, -0.45, 0]);
  shieldKite(rig.shield, { s: 1.0, cross: true });
  rig.attack = 'lance';
  rig.proj = h.head;
  return rig;
}
BUILD.cavalier = () => knightRider(false);
BUILD.champion = () => knightRider(true);

function angelRig(arch) {
  const skinA = mat('#f4cfae', { tex: 'leather', bs: 0.005 });
  const rig = bipedRig(arch ? 2.12 : 1.98, {
    skin: skinA, top: arch ? PAL.gold() : PAL.white(), sleeve: PAL.white(), fore: arch ? PAL.gold() : skinA,
    bottom: PAL.white(), thigh: PAL.white(), shin: PAL.white(), boots: PAL.gold(), handMat: skinA,
    torsoW: 0.21, torsoD: 0.14, legLen: 0.44, headR: 0.094, armR: 0.032, legR: 0.04, eyeMat: mat('#2a62c8', { e: '#4a90ff', ei: 0.9 }),
  });
  const h = rig.h, r = h.P.headR;
  const robeM = mat('#f6f3ec', { ds: true });
  robe(h, robeM, { flare: 1.65, len: 0.46, hem: mat(arch ? '#c8202a' : '#e9b949', { m: arch ? 0 : 0.8, r: 0.35, ds: true }) });
  if (arch) {
    overChest(h, PAL.gold(), 1.07, 0.7);
    M(G.box(), PAL.red(), h.torso, [h.P.torsoD / 2 * 1.02, h.P.torsoLen * 0.42, 0], [0.012, 0.03, h.P.torsoW * 0.95], [0.6, 0, 0]);
    pauldrons(h, PAL.gold(), { s: 1.15, trim: PAL.white() });
    cape(h, PAL.red(), { len: 0.62, inner: PAL.gold(), clasp: PAL.gold(), flare: 1.35 });
  } else {
    M(G.box(), PAL.gold(), h.torso, [h.P.torsoD / 2 * 0.98, h.P.torsoLen * 0.55, 0], [0.01, 0.025, h.P.torsoW * 0.95], [0.6, 0, 0]);
  }
  belt(h, PAL.gold(), PAL.gold());
  hair(h, PAL.hairBlond(), { long: true });
  if (arch) {
    M(G.cyl(1, 1, 12), PAL.gold(), h.head, [0, r * 1.5, 0], [r * 1.02, 0.028, r * 1.0]);
    for (let i = 0; i < 5; i++) M(G.cone(4), PAL.gold(), h.head, [r * Math.cos((i - 2) * 0.4) * 0.95, r * 1.62, r * Math.sin((i - 2) * 0.4) * 0.95], [0.012, 0.05, 0.012]);
  }
  const halo = grp(h.head, [-0.03, r * 2.75, 0], [0, 0, 0.25]);
  M(G.torus(0.13, TAU, 6, 20), PAL.glowGold(), halo, [0, 0, 0], arch ? r * 1.15 : r * 0.95, [PI / 2, 0, 0]);
  if (arch) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      M(G.cone(4), PAL.glowGold(), halo, [Math.cos(a) * r * 1.25, 0, Math.sin(a) * r * 1.25], [0.008, 0.038, 0.008], [0, -a, -PI / 2]);
    }
  }
  rig.glows.push(halo);
  for (const s of [1, -1]) {
    rig.wings.push(featherWing(h.torso, s, {
      p: [-0.07, 0.25, s * 0.05], span: arch ? 0.66 : 0.60, n: 7,
      mat: PAL.white(), mat2: mat('#e8e2d4', { tex: 'scales' }), tip: arch ? PAL.gold() : mat('#dcd6ca', { tex: 'scales' }), rest: [-0.25, -0.95, 0],
    }));
  }
  rig.weapon = holdPivot(h, h.armR, -0.7);
  sword(rig.weapon, arch
    ? { len: 0.54, w: 0.062, blade: PAL.fire(), fuller: PAL.glowGold(), guard: PAL.gold(), flame: mat('#ffdd66', { e: '#ff8a1a', ei: 2.5 }) }
    : { len: 0.48, w: 0.052, blade: mat('#e8eef8', { m: 0.85, r: 0.18, tex: 'metal' }), fuller: PAL.gold(), guard: PAL.gold() });
  rig.hover = 0.12;
  rig.flapIdle = 0.22;
  rig.glide = true;
  rig.durK = 1.1;
  rig.impactTime = 0.4;
  return rig;
}
BUILD.angel = () => angelRig(false);
BUILD.archangel = () => angelRig(true);

// ------------------------------------------------------------------ NECROPOLIS
BUILD.skeleton = () => {
  const rig = newRig('biped', 1.0);
  const h = skeletonBody(rig, {});
  M(G.tatter(1, 1.2, 8, 0.45), mat('#5a4632', { ds: true }), h.hips, [0, -0.06, 0], [0.075, 0.15, 0.1]);
  h.armR.sh.rotation.set(-0.1, 0, 0.25);
  h.armR.el.rotation.z = 0.5;
  rig.weapon = holdPivot(h, h.armR, -0.9);
  sword(rig.weapon, { len: 0.3, w: 0.05, blade: PAL.rust(), guard: PAL.iron(), grip: PAL.leatherDark(), guardW: 0.11 });
  M(G.box(), PAL.black(), rig.weapon, [0.022, 0.25, 0], [0.012, 0.03, 0.02]);
  rig.attack = 'swing';
  return rig;
};
BUILD.skeletonWarrior = () => {
  const rig = newRig('biped', 1.03);
  const h = skeletonBody(rig, {});
  const r = h.P.headR;
  M(G.tatter(1, 1.15, 8, 0.35), mat('#4a2468', { ds: true }), h.hips, [0, -0.07, 0], [0.08, 0.17, 0.105]);
  M(G.box(), PAL.purple(), h.torso, [0.05, 0.12, 0], [0.012, 0.22, 0.09]);
  belt(h, PAL.leatherDark(), PAL.iron());
  // helmet with nasal + crest
  M(G.dome(10, 4, 0.55), PAL.iron(), h.head, [0, r * 1.05, 0], [r * 1.1, r * 1.2, r * 1.05]);
  M(G.box(), PAL.iron(), h.head, [r * 0.95, r * 0.95, 0], [0.025, r * 0.7, r * 0.22]);
  M(G.box(), PAL.purple(), h.head, [-r * 0.1, r * 2.25, 0], [r * 1.5, r * 0.25, 0.02]);
  M(G.dome(8, 3), PAL.iron(), h.armR.sh, [0, 0.01, 0], [0.06, 0.05, 0.065], [0.35, 0, 0]);
  M(G.cone(4), PAL.ironDark(), h.armR.sh, [0, 0.05, 0.02], [0.012, 0.06, 0.012], [0.4, 0, 0]);
  h.armR.sh.rotation.set(-0.1, 0, 0.25);
  h.armR.el.rotation.z = 0.5;
  rig.weapon = holdPivot(h, h.armR, -0.85);
  sword(rig.weapon, { len: 0.38, w: 0.052, blade: PAL.steel(), guard: PAL.iron(), grip: PAL.purpleDark() });
  rig.shield = grp(h.armL.el, [0.0, -0.11, -0.05], [0, -0.4, 0]);
  shieldRound(rig.shield, { R: 0.13, face: PAL.purpleDark(), rim: PAL.iron(), boss: PAL.bone() });
  skull(rig.shield, 0.03, { p: [0, -0.04, -0.024], mat: PAL.bone() }).rotation.set(0, -PI / 2, 0);
  rig.attack = 'swing';
  return rig;
};

function zombieBase(z) {
  const skinZ = mat(z ? '#6f9a4a' : '#a7ae90', { tex: 'leather' }), rot = mat(z ? '#4b6a30' : '#7d8670', { tex: 'bone' });
  const shirt = mat(z ? '#4c2f5e' : '#6b5d4a', { ds: true }), pants = mat(z ? '#2e2a2a' : '#3f3a35');
  const rig = bipedRig(z ? 1.04 : 1.0, {
    skin: skinZ, top: shirt, sleeve: shirt, fore: skinZ, bottom: pants, thigh: pants, shin: skinZ,
    boots: mat('#4a4038'), hunch: z ? -0.42 : -0.3, headTilt: z ? 0.38 : 0.25, headFwd: 0.03,
    eyeMat: z ? mat('#d6ff9a', { e: '#8dff40', ei: 2.0 }) : mat('#e0f0b0', { e: '#9adf60', ei: 1.0 }),
    torsoW: z ? 0.24 : 0.22, torsoD: z ? 0.17 : 0.15,
  });
  const h = rig.h, r = h.P.headR;
  M(G.tatter(0.9, 1.05, 8, 0.35), shirt, h.torso, [0, 0.13, 0], [h.P.torsoD / 2 * 1.04, 0.24, h.P.torsoW / 2 * 1.04]);
  M(G.tatter(1, 1.1, 8, 0.3), mat(z ? '#2e2a2a' : '#3f3a35', { ds: true }), h.hips, [0, -0.06, 0], [h.P.torsoD * 0.5, 0.12, h.P.torsoW * 0.47]);
  // rot patches
  M(G.sph(0), rot, h.head, [r * 0.5, r * 1.5, r * 0.45], [0.03, 0.025, 0.03]);
  M(G.sph(0), rot, h.armL.el, [0.01, -0.08, -0.02], [0.03, 0.04, 0.03]);
  M(G.box(), PAL.black(), h.head, [r * 0.9, r * 0.6, 0], [0.01, 0.02, r * 0.6]);
  M(G.sph(0), mat('#2b2a24'), h.head, [-r * 0.2, r * 1.75, -r * 0.3], [0.05, 0.03, 0.04]);
  if (z) {
    // exposed ribs + belly
    ribcage(h.torso, 0.07, 0.08, 0.06, PAL.bone(), 3, 0.15);
    M(G.sph(1), skinZ, h.torso, [0.03, 0.06, 0], [0.09, 0.08, 0.1]);
    M(G.sph(0), rot, h.torso, [0.1, 0.08, 0.05], [0.03, 0.04, 0.03]);
    M(G.box(), PAL.bone(), h.armR.el, [0, -0.1, 0.025], [0.012, 0.1, 0.012]);
    rig.weapon = holdPivot(h, h.armR, -0.6, [0, -0.03, 0]);
    M(G.cyl(1, 1, 5), PAL.woodDark(), rig.weapon, [0, 0.02, 0], [0.014, 0.12, 0.014]);
    M(G.box(), PAL.rust(), rig.weapon, [0.035, 0.15, 0], [0.09, 0.16, 0.01]);
  } else {
    M(G.box(), PAL.bone(), h.torso, [0.06, 0.15, h.P.torsoW * 0.45], [0.06, 0.012, 0.02]);
    M(G.box(), PAL.bone(), h.torso, [0.06, 0.12, h.P.torsoW * 0.45], [0.06, 0.012, 0.02]);
  }
  h.armR.sh.rotation.set(-0.12, 0, 1.25);
  h.armL.sh.rotation.set(0.18, 0, 1.12);
  h.armR.el.rotation.z = 0.15;
  h.armL.el.rotation.z = 0.25;
  h.swingR = 0.3; h.swingL = 0.3;
  rig.attack = 'claw';
  rig.walkSpeed = 1.1;
  return rig;
}
BUILD.walkingDead = () => zombieBase(false);
BUILD.zombie = () => zombieBase(true);

function ghostRig(wraith) {
  const rig = newRig('ghost', wraith ? 0.98 : 0.92);
  const cloak = mat(wraith ? '#1b1622' : '#5a6575', { ds: true });
  const cloak2 = mat(wraith ? '#2a1f38' : '#47505e', { ds: true });
  const inner = mat('#050508', { ds: true });
  const eyes = wraith ? PAL.glowPurple() : PAL.glowGreen();
  const P = { headR: 0.1, torsoLen: 0.3, torsoW: 0.24, torsoD: 0.17, taper: 0.8, armLen: 0.36, armR: 0.03 };
  const h = { P, kind: 'ghost' };
  rig.h = h;
  h.lunge = rig.mover;
  h.body = grp(rig.mover);
  h.hips = grp(h.body, [0, 0.6, 0]);
  h.torso = grp(h.hips, [0, 0, 0], [0, 0, -0.12]);
  h.robe = grp(h.torso, [0, 0.3, 0]);
  M(G.tatter(0.5, 1, 12, 0.2), cloak, h.robe, [0, -0.45, 0], [0.3, 0.9, 0.3]);
  M(G.cyl(0.5, 1, 10, true), inner, h.robe, [0, -0.5, 0], [0.26, 0.8, 0.26]);
  M(G.sph(1), cloak2, h.torso, [0, 0.27, 0], [0.15, 0.09, 0.2]);
  M(G.tatter(0.8, 1, 10, 0.3), cloak2, h.torso, [0, 0.2, 0], [0.18, 0.18, 0.23]);
  h.head = grp(h.torso, [0.03, 0.32, 0]);
  M(G.sph(1), inner, h.head, [0.02, 0.1, 0], [0.085, 0.1, 0.085]);
  if (!wraith) {
    skull(h.head, 0.07, { p: [0.03, 0.02, 0], eyes });
  } else {
    for (const s of [1, -1]) M(G.sph(0), eyes, h.head, [0.085, 0.11, s * 0.035], [0.014, 0.01, 0.018]);
    M(G.sph(0), mat('#8a40d0', { e: '#6a20b0', ei: 1.4, op: 0.5 }), h.head, [0.07, 0.1, 0], [0.04, 0.03, 0.06]);
  }
  hood(h, cloak);
  // arms: flared sleeves + bony clawed hands
  const clawLen = wraith ? 0.11 : 0.06;
  const mk = (side) => {
    const sh = grp(h.torso, [0, 0.25, side * 0.15]);
    M(G.tatter(0.45, 1, 7, 0.35), cloak, sh, [0, -0.11, 0], [0.065, 0.24, 0.065]);
    const el = grp(sh, [0, -0.18, 0]);
    M(G.tatter(0.6, 1, 7, 0.4), cloak2, el, [0, -0.06, 0], [0.07, 0.14, 0.07]);
    const hand = grp(el, [0, -0.13, 0]);
    M(G.sph(0), PAL.bone(), hand, [0, -0.01, 0], [0.025, 0.03, 0.03]);
    for (let i = -1; i <= 1; i++) {
      M(G.cone(4), wraith ? PAL.ironDark() : PAL.boneDark(), hand, [0.01, -0.03 - clawLen / 2, i * 0.014], [0.007, clawLen, 0.007], [i * 0.15, 0, 0.35]);
    }
    return { sh, el, hand, side };
  };
  h.armR = mk(1); h.armL = mk(-1);
  h.armR.sh.rotation.set(-0.15, 0, 0.5); h.armL.sh.rotation.set(0.15, 0, 0.6);
  h.armR.el.rotation.z = 0.5; h.armL.el.rotation.z = 0.4;
  // trailing strips and wisps
  for (let i = 0; i < 3; i++) {
    const a = PI * (0.75 + i * 0.25);
    const st = grp(h.robe, [Math.cos(a) * 0.27, -0.82, Math.sin(a) * 0.27]);
    M(G.tbox(0.4, 1), cloak, st, [0, -0.07, 0], [0.012, 0.16, 0.06], [PI, 0, 0]);
    rig.cloth.push({ o: st, axis: 'z', amp: 0.25, speed: 2.4 + i * 0.4, ph: i });
  }
  const wisp = grp(h.robe, [0, -0.92, 0]);
  M(G.cone(8), mat(wraith ? '#5a2a8a' : '#8fd8a8', { op: 0.38, e: wraith ? '#40106a' : '#2a8a50', ei: 1.2 }), wisp, [0, -0.03, 0], [0.18, 0.25, 0.18], [PI, 0, 0]);
  rig.glows.push(wisp);
  if (wraith) {
    M(G.torus(0.25, TAU, 4, 12), PAL.ironDark(), h.torso, [0.02, 0.05, 0], [0.12, 0.15, 0.1], [PI / 2, 0.15, 0]);
  }
  rig.hover = 0.2;
  rig.attack = 'claw';
  rig.fall = 'sink';
  rig.proj = h.head;
  return rig;
}
BUILD.wight = () => ghostRig(false);
BUILD.wraith = () => ghostRig(true);

function vampireBase(lord) {
  const skinV = mat('#ddd6d2', { tex: 'leather', bs: 0.005 }), coat = mat(lord ? '#5e1020' : '#2b1f3a'), dark = mat('#17131c');
  const rig = bipedRig(lord ? 1.3 : 1.25, {
    skin: skinV, top: coat, sleeve: coat, fore: coat, handMat: skinV, bottom: dark, thigh: dark, shin: dark,
    boots: PAL.black(), torsoW: 0.2, torsoD: 0.13, taper: 0.7, headR: 0.09, eyeMat: PAL.glowRed(), legLen: 0.45,
  });
  const h = rig.h, r = h.P.headR;
  hair(h, PAL.hairBlack());
  M(G.cone(3), PAL.hairBlack(), h.head, [r * 0.7, r * 1.65, 0], [0.025, 0.06, 0.02], [0, 0, PI + 0.6]);
  for (const s of [1, -1]) {
    M(G.cone(4), skinV, h.head, [-r * 0.1, r * 1.25, s * r * 0.95], [0.018, 0.08, 0.012], [s * 1.2, 0, 0.5]);
    M(G.cone(3), PAL.white(), h.head, [r * 0.86, r * 0.62, s * 0.017], [0.006, 0.025, 0.006], [PI, 0, 0]);
  }
  M(G.cone(4), PAL.white(), h.torso, [h.P.torsoD / 2 + 0.008, h.P.torsoLen - 0.07, 0], [0.03, 0.09, 0.035], [PI, 0, 0]);
  belt(h, PAL.black(), lord ? PAL.gold() : PAL.steelDark());
  skirt(h, coat, 0.16, 1.4);
  cape(h, mat('#121016'), {
    inner: mat(lord ? '#b01828' : '#7a1426'), len: h.P.torsoLen + h.P.legLen * 0.9, flare: 1.8,
    clasp: lord ? PAL.gold() : PAL.steelDark(), w: 0.24,
  });
  if (lord) {
    for (const s of [1, -1]) {
      const c = grp(h.torso, [-0.05, h.P.torsoLen - 0.01, s * 0.07], [s * 0.35, 0, -0.18]);
      M(G.tbox(1.3, 1.5), mat('#121016'), c, [0, 0.1, 0], [0.012, 0.2, 0.1]);
      M(G.tbox(1.3, 1.5), mat('#b01828'), c, [0.008, 0.1, 0], [0.006, 0.18, 0.09]);
    }
    M(G.cyl(1, 1, 8), PAL.gold(), h.torso, [h.P.torsoD / 2 + 0.006, h.P.torsoLen * 0.6, 0], [0.03, 0.01, 0.03], [0, 0, PI / 2]);
    M(G.sph(0), PAL.glowRed(), h.torso, [h.P.torsoD / 2 + 0.012, h.P.torsoLen * 0.6, 0], 0.012);
    pauldrons(h, PAL.gold(), { s: 0.8 });
    overChest(h, mat('#8a1424'), 1.04, 0.55);
  }
  for (const A of [h.armR, h.armL]) for (let i = -1; i <= 1; i++) {
    M(G.cone(3), PAL.ironDark(), A.hand, [0.01, -0.065, i * 0.012], [0.005, 0.04, 0.005], [0, 0, 0.3]);
  }
  h.armR.sh.rotation.set(-0.2, 0, 0.25);
  h.armL.sh.rotation.set(0.2, 0, 0.15);
  rig.hover = 0.06;
  rig.glide = true;
  rig.flapIdle = 0;
  rig.attack = 'claw';
  return rig;
}
BUILD.vampire = () => vampireBase(false);
BUILD.vampireLord = () => vampireBase(true);

function lichBase(power) {
  const robeM = mat(power ? '#1e1626' : '#3c2456', { ds: true });
  const robe2 = mat(power ? '#4a1a6a' : '#2a1a3c', { ds: true });
  const rig = newRig('biped', power ? 1.5 : 1.42);
  const h = makeHumanoid(rig.mover, {
    top: robeM, sleeve: robeM, fore: PAL.bone(), handMat: PAL.bone(), bottom: robeM, thigh: robeM,
    shin: PAL.bone(), boots: PAL.bone(), noHead: true, noNeck: true, torsoW: 0.22, torsoD: 0.15,
    taper: 0.85, headR: 0.092, armR: 0.03,
  });
  rig.h = h;
  h.lunge = rig.mover;
  const r = h.P.headR;
  M(G.cyl(1, 1, 5), PAL.bone(), h.torso, [0, h.P.torsoLen + 0.02, 0], [0.018, 0.06, 0.018]);
  skull(h.head, r, { eyes: PAL.glowGreen() });
  robe(h, robeM, { tatter: 0.28, flare: 1.85, len: h.P.legLen + 0.05 });
  M(G.tatter(0.6, 1, 10, 0.25), robe2, h.torso, [0, h.P.torsoLen - 0.07, 0], [0.15, 0.17, 0.19]);
  ribcage(h.torso, 0.06, 0.08, 0.075, PAL.bone(), 3, 0.12);
  for (const A of [h.armR, h.armL]) {
    M(G.tatter(0.55, 1, 7, 0.35), robeM, A.sh, [0, -0.13, 0], [0.06, 0.26, 0.06]);
    for (let i = -1; i <= 1; i++) M(G.cone(3), PAL.bone(), A.hand, [0.01, -0.05, i * 0.012], [0.006, 0.04, 0.006], [0, 0, 0.3]);
  }
  if (power) {
    M(G.cyl(1, 1, 8), PAL.gold(), h.head, [0, r * 1.75, 0], [r * 0.85, r * 0.2, r * 0.8]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      M(G.cone(4), PAL.gold(), h.head, [Math.cos(a) * r * 0.8, r * 2.0, Math.sin(a) * r * 0.75], [r * 0.12, r * 0.45, r * 0.12]);
    }
    M(G.oct(), PAL.glowGreen(), h.head, [r * 0.8, r * 1.82, 0], [0.014, 0.02, 0.014]);
    pauldrons(h, PAL.ironDark(), { spikes: PAL.gold(), s: 1.1 });
    for (const s of [1, -1]) {
      const c = grp(h.torso, [-0.05, h.P.torsoLen - 0.02, s * 0.07], [s * 0.3, 0, -0.15]);
      M(G.tbox(1.3, 1.5), robe2, c, [0, 0.1, 0], [0.012, 0.2, 0.1]);
    }
  } else {
    hood(h, robeM);
  }
  h.armR.sh.rotation.set(-0.12, 0, 0.3);
  h.armR.el.rotation.z = 0.9;
  rig.weapon = holdPivot(h, h.armR, 0.05);
  const st = staff(rig.weapon, { y0: -0.5, y1: power ? 0.72 : 0.62, shaft: power ? PAL.ironDark() : PAL.woodDark(), thick: power ? 0.02 : 0.017 });
  const top = st.userData.top;
  const glow = grp(top, [0, power ? 0.12 : 0.1, 0]);
  if (power) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      M(G.cone(4), PAL.gold(), top, [Math.cos(a) * 0.04, 0.07, Math.sin(a) * 0.04], [0.012, 0.14, 0.012], [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4]);
    }
    M(G.oct(), PAL.glowGreen(), glow, [0, 0, 0], [0.05, 0.085, 0.05]);
    M(G.torus(0.1, TAU, 4, 14), PAL.glowPurple(), glow, [0, 0, 0], 0.075, [0.8, 0.4, 0]);
    M(G.sph(1), mat('#7dff6a', { op: 0.28, e: '#40ff30', ei: 1.6 }), glow, [0, 0, 0], 0.085);
  } else {
    skull(top, 0.035, { p: [0, -0.01, 0] });
    M(G.sph(1), PAL.glowGreen(), glow, [0, 0.02, 0], 0.03);
    M(G.sph(1), mat('#7dff6a', { op: 0.28, e: '#40ff30', ei: 1.6 }), glow, [0, 0.02, 0], 0.055);
  }
  rig.glows.push(glow);
  rig.proj = glow;
  rig.shoot = 'cast';
  rig.attack = 'swing';
  return rig;
}
BUILD.lich = () => lichBase(false);
BUILD.powerLich = () => lichBase(true);

function darkKnight(dread) {
  const eyeG = dread ? PAL.glowRed() : PAL.glowGreen();
  const capar = mat(dread ? '#4a0e14' : '#3a1c56', { ds: true });
  const rig = riderRig(dread ? 1.32 : 1.28, {
    coat: mat('#1e1c22'), mane: mat('#0c0b0e'), muzzle: mat('#16141a'), eye: eyeG, eyeGlow: true,
    hoof: PAL.ironDark(), capar, caparTatter: 0.35, trim: mat('#454753', { m: 0.6, r: 0.45, ds: true }),
    armor: PAL.iron(), armorTrim: dread ? PAL.redDark() : PAL.ironDark(), armorSpike: dread ? PAL.ironDark() : null,
    saddle: PAL.ironDark(),
    emblem: dread ? (body, s) => { skull(body, 0.05, { p: [0.02, -0.12, s * 0.205], eyes: PAL.glowRed() }).rotation.set(0, -s * PI / 2, 0); } : null,
  }, {
    top: PAL.iron(), sleeve: PAL.iron(), fore: PAL.iron(), handMat: PAL.ironDark(), bottom: PAL.ironDark(),
    thigh: PAL.iron(), shin: PAL.iron(), boots: PAL.ironDark(), torsoW: 0.24, torsoD: 0.16,
  });
  const h = rig.h, r = h.P.headR;
  overChest(h, mat(dread ? '#5a1018' : '#3a1c56'), 1.07, 0.55);
  belt(h, PAL.ironDark(), dread ? PAL.glowRed() : PAL.glowGreen());
  pauldrons(h, PAL.iron(), { spikes: PAL.ironDark(), s: dread ? 1.35 : 1.15 });
  // helmet
  M(G.cyl(0.9, 1, 8), PAL.iron(), h.head, [0, r * 1.05, 0], [r * 1.12, r * 1.8, r * 1.08]);
  M(G.cone(8), PAL.iron(), h.head, [0, r * 2.15, 0], [r * 1.1, r * 0.5, r * 1.05]);
  M(G.box(), PAL.black(), h.head, [r * 1.05, r * 1.25, 0], [0.02, r * 0.16, r * 1.4]);
  for (const s of [1, -1]) M(G.sph(0), eyeG, h.head, [r * 1.08, r * 1.25, s * r * 0.35], [0.008, 0.012, 0.022]);
  if (dread) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI - PI / 2;
      M(G.cone(4), PAL.ironDark(), h.head, [Math.cos(a) * r * 0.7 - r * 0.2, r * 2.3, Math.sin(a) * r * 0.9], [r * 0.15, r * 0.7, r * 0.15], [Math.sin(a) * 0.4, 0, 0.3]);
    }
    for (let i = 0; i < 3; i++) M(G.cone(4), PAL.ironDark(), h.torso, [-h.P.torsoD / 2 - 0.01, 0.1 + i * 0.07, 0], [0.012, 0.06, 0.012], [0, 0, PI / 2]);
  } else {
    for (const s of [1, -1]) {
      seg(h.head, PAL.bone(), [-r * 0.1, r * 1.7, s * r * 0.9], [-r * 0.2, r * 2.2, s * r * 1.6], 0.022, 0.016, 5);
      seg(h.head, PAL.bone(), [-r * 0.2, r * 2.2, s * r * 1.6], [-r * 0.15, r * 3.0, s * r * 1.75], 0.016, 0.003, 5);
    }
  }
  cape(h, mat(dread ? '#3a0a10' : '#2a1440', { ds: true }), { len: 0.38, flare: 1.4 });
  h.armR.sh.rotation.set(-0.15, 0, 0.35);
  h.armR.el.rotation.z = 0.7;
  h.armL.sh.rotation.set(0.15, 0, 0.5);
  h.armL.el.rotation.z = 1.0;
  rig.weapon = holdPivot(h, h.armR, -0.55);
  const sw = sword(rig.weapon, {
    len: dread ? 0.58 : 0.52, w: dread ? 0.07 : 0.06, blade: dread ? mat('#2a2a32', { m: 0.7, r: 0.3 }) : PAL.steelDark(),
    guard: dread ? PAL.redDark() : PAL.ironDark(), guardW: 0.18,
  });
  if (dread) {
    M(G.box(), PAL.glowRed(), sw, [0, 0.35, 0], [0.012, 0.42, 0.016]);
    for (let i = 0; i < 3; i++) M(G.cone(3), mat('#2a2a32', { m: 0.7, r: 0.3 }), sw, [0.042, 0.16 + i * 0.15, 0], [0.02, 0.05, 0.008], [0, 0, -0.9]);
  }
  rig.attack = 'swing';
  rig.proj = h.head;
  return rig;
}
BUILD.blackKnight = () => darkKnight(false);
BUILD.dreadKnight = () => darkKnight(true);

function undeadDragon(ghost) {
  const rig = newRig('dragon', ghost ? 1.48 : 1.42);
  const boneM = ghost ? mat('#b4f5e0', { e: '#22b890', ei: 1.15, op: 0.84, r: 0.4 }) : PAL.bone();
  const boneD = ghost ? mat('#62d8b4', { e: '#188a6c', ei: 1.35, op: 0.74, r: 0.45 }) : PAL.boneDark();
  const wingM = ghost
    ? mat('#48e0b8', { e: '#18a882', ei: 1.5, op: 0.42, ds: true })
    : mat('#3a2d24', { op: 0.72, ds: true, r: 0.92 });
  const eyeM = ghost ? PAL.glowBlue() : PAL.glowRed();

  const q = { kind: 'quad', legs: [], tail: [] };
  rig.q = q;
  const body = grp(rig.mover, [0, 0.56, 0], [0, 0, 0.16]);
  q.body = body;

  // Arched spine & dorsal spikes
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = -0.32 + t * 0.62;
    const y = Math.sin(t * PI) * 0.06;
    M(G.box(), boneM, body, [x, y + 0.06, 0], [0.065, 0.055, 0.065]);
    M(G.cone(4), boneD, body, [x - 0.01, y + 0.13, 0], [0.018, 0.085, 0.018], [0, 0, 0.28]);
  }
  // Ribcage & pelvis/shoulder girdles
  ribcage(body, 0.16, 0.34, 0.15, boneM, 5, -0.12);
  body.children.slice(-5).forEach((rib, idx) => {
    rib.position.set(-0.12 + idx * 0.08, 0.0, 0);
    rib.rotation.set(0, PI / 2, 0);
  });
  M(G.tbox(0.85, 1.15), boneD, body, [0.22, 0.02, 0], [0.14, 0.13, 0.24]);
  M(G.tbox(1.1, 0.9), boneD, body, [-0.26, 0.0, 0], [0.14, 0.11, 0.2]);

  if (ghost) {
    const core = grp(body, [0.02, -0.01, 0]);
    M(G.sph(1), mat('#7affdc', { e: '#2affc4', ei: 2.0, op: 0.42 }), core, [0, 0, 0], [0.22, 0.11, 0.11]);
    rig.glows.push(core);
  }

  // Segmented skeletal neck
  const neck = grp(body, [0.28, 0.08, 0], [0, 0, -0.58]);
  q.neck = neck;
  for (let i = 0; i < 4; i++) {
    const y = 0.04 + i * 0.065;
    M(G.cyl(0.85, 1, 6), boneM, neck, [0, y, 0], [0.048 - i * 0.004, 0.06, 0.048 - i * 0.004]);
    M(G.cone(4), boneD, neck, [-0.045, y + 0.01, 0], [0.014, 0.065, 0.014], [0, 0, 0.95]);
  }

  // Dragon skull head + hinged jaw
  const head = grp(neck, [0.02, 0.28, 0], [0, 0, 0.44]);
  q.head = head;
  M(G.tbox(0.75, 0.85), boneM, head, [0.02, 0.05, 0], [0.13, 0.095, 0.12]);
  M(G.tbox(0.55, 0.65), boneM, head, [0.14, 0.035, 0], [0.15, 0.065, 0.095]);
  // Eye sockets & glowing eyes
  for (const s of [1, -1]) {
    M(G.sph(0), PAL.black(), head, [0.055, 0.06, s * 0.052], [0.026, 0.024, 0.022]);
    M(G.sph(0), eyeM, head, [0.062, 0.06, s * 0.056], 0.015);
    // Swept-back horns
    seg(head, boneD, [-0.02, 0.09, s * 0.045], [-0.16, 0.17, s * 0.095], 0.024, 0.014, 5);
    seg(head, boneD, [-0.16, 0.17, s * 0.095], [-0.27, 0.24, s * 0.11], 0.014, 0.004, 5);
    // Upper fangs
    for (let k = 0; k < 3; k++) {
      M(G.cone(3), boneM, head, [0.09 + k * 0.038, -0.008, s * 0.036], [0.008, 0.028, 0.008], [PI, 0, 0]);
    }
  }
  q.jaw = grp(head, [0.03, 0.0, 0], [0, 0, -0.08]);
  M(G.tbox(0.55, 0.65), boneD, q.jaw, [0.09, -0.018, 0], [0.15, 0.032, 0.08]);
  for (const s of [1, -1]) {
    for (let k = 0; k < 2; k++) {
      M(G.cone(3), boneM, q.jaw, [0.07 + k * 0.045, 0.006, s * 0.03], [0.007, 0.024, 0.007]);
    }
  }

  // 4 skeletal legs
  for (const s of [1, -1]) {
    const fp = [0.19, -0.05, s * 0.1];
    quadLeg(q, body, fp, hipWorldY(body, fp), {
      upMat: boneM, lowMat: boneD, rUp: 0.034, rKnee: 0.026, rLow: 0.02, front: true, phase: s > 0 ? 0 : PI,
      paw: (k, y) => talons(k, y, boneD, 0.015, 0.065),
    });
    const hp = [-0.24, -0.03, s * 0.095];
    quadLeg(q, body, hp, hipWorldY(body, hp), {
      upMat: boneM, lowMat: boneD, rUp: 0.04, rKnee: 0.028, rLow: 0.022, phase: s > 0 ? PI : 0,
      paw: (k, y) => talons(k, y, boneD, 0.015, 0.065),
    });
  }

  // Segmented bone tail
  let tp = grp(body, [-0.34, 0.02, 0], [0, 0, -1.15]);
  for (let i = 0; i < 5; i++) {
    const r0 = 0.026 - i * 0.0035;
    limb(tp, boneM, 0.13, r0, r0 * 0.82, 5);
    M(G.cone(4), boneD, tp, [-0.02, -0.06, 0], [0.011, 0.04, 0.011], [0, 0, PI / 2]);
    q.tail.push(tp);
    tp = grp(tp, [0, -0.12, 0], [0, 0, 0.16]);
  }
  M(G.oct(), boneD, tp, [0, -0.04, 0], [0.028, 0.06, 0.012]);

  // Tattered skeletal wings
  for (const s of [1, -1]) {
    rig.wings.push(membraneWing(body, s, {
      p: [0.12, 0.12, s * 0.09], span: ghost ? 1.04 : 0.98, r: 0.028,
      bone: boneM, membrane: wingM, claw: boneD, tatter: true, rest: [-0.45, -0.55, 0],
    }));
  }

  rig.hover = ghost ? 0.16 : 0.08;
  rig.quadAttack = 'bite';
  rig.fall = 'side';
  rig.walkSpeed = 1.45;
  rig.proj = head;
  return rig;
}
BUILD.boneDragon = () => undeadDragon(false);
BUILD.ghostDragon = () => undeadDragon(true);

// ------------------------------------------------------------------ NEUTRALS
BUILD.goblin = () => {
  const skinG = mat('#6ca844', { tex: 'leather' }), skinD = mat('#4e822c', { tex: 'leather' });
  const rig = bipedRig(0.76, {
    skin: skinG, top: PAL.leatherDark(), sleeve: skinG, fore: skinG, handMat: skinG,
    bottom: PAL.leather(), thigh: skinG, shin: skinG, boots: PAL.leatherDark(),
    legLen: 0.36, torsoLen: 0.26, torsoW: 0.2, torsoD: 0.14, headR: 0.112,
    hunch: -0.18, headFwd: 0.025, nose: 1.5, noseMat: skinD, eyeMat: PAL.glowYellow(),
  });
  const h = rig.h, r = h.P.headR;
  // Big pointed goblin ears + gold earring
  for (const s of [1, -1]) {
    M(G.cone(4), skinD, h.head, [-r * 0.05, r * 1.05, s * r * 1.18], [0.026, 0.12, 0.018], [s * 1.18, 0, 0.25]);
  }
  M(G.torus(0.22, TAU, 4, 10), PAL.gold(), h.head, [-r * 0.05, r * 0.88, r * 1.38], 0.016);
  // Ragged leather vest, belt & tattered loincloth
  overChest(h, PAL.leather(), 1.06, 0.68);
  belt(h, PAL.leatherDark(), PAL.iron());
  M(G.tatter(1, 1.2, 8, 0.32), mat('#6e4728', { ds: true }), h.hips, [0, -0.05, 0], [0.08, 0.14, 0.1]);
  // Spiked wooden club
  h.armR.sh.rotation.set(-0.12, 0, 0.3);
  h.armR.el.rotation.z = 0.65;
  rig.weapon = holdPivot(h, h.armR, -0.75);
  M(G.cyl(1.45, 0.85, 6), PAL.woodDark(), rig.weapon, [0, 0.14, 0], [0.024, 0.34, 0.024]);
  M(G.cyl(1, 1, 8), PAL.iron(), rig.weapon, [0, 0.24, 0], [0.029, 0.028, 0.029]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    M(G.cone(4), PAL.iron(), rig.weapon, [Math.cos(a) * 0.032, 0.22 + (i % 2) * 0.04, Math.sin(a) * 0.032],
      [0.01, 0.04, 0.01], [Math.sin(a) * (PI / 2), 0, -Math.cos(a) * (PI / 2)]);
  }
  rig.attack = 'swing';
  rig.walkSpeed = 1.75;
  return rig;
};

BUILD.wolf = () => {
  const rig = newRig('quad', 0.96);
  const fur = mat('#6e7278', { tex: 'scales' }), furD = mat('#43464c', { tex: 'scales' }), belly = mat('#b4b8bf', { tex: 'leather' });
  const q = { kind: 'quad', legs: [], tail: [] };
  rig.q = q;
  const body = grp(rig.mover, [0, 0.42, 0], [0, 0, 0.06]);
  q.body = body;
  M(G.sph(1), fur, body, [-0.08, 0, 0], [0.25, 0.13, 0.12]);
  M(G.sph(1), fur, body, [0.14, 0.02, 0], [0.17, 0.15, 0.135]);
  M(G.sph(1), belly, body, [0.2, -0.02, 0], [0.12, 0.12, 0.11]);
  M(G.sph(1), furD, body, [0.04, 0.08, 0], [0.24, 0.07, 0.09]);

  const neck = grp(body, [0.22, 0.08, 0], [0, 0, -0.48]);
  q.neck = neck;
  M(G.cyl(0.8, 1, 8), fur, neck, [0, 0.07, 0], [0.085, 0.16, 0.08]);

  const head = grp(neck, [0.02, 0.14, 0], [0, 0, 0.42]);
  q.head = head;
  M(G.sph(1), fur, head, [0, 0.04, 0], [0.085, 0.078, 0.075]);
  // Snout + nose
  M(G.tbox(0.65, 0.7), fur, head, [0.1, 0.025, 0], [0.11, 0.052, 0.068]);
  M(G.sph(0), PAL.black(), head, [0.158, 0.035, 0], 0.018);
  // Jaw + fangs
  q.jaw = grp(head, [0.04, -0.005, 0], [0, 0, -0.08]);
  M(G.tbox(0.6, 0.65), belly, q.jaw, [0.05, -0.01, 0], [0.095, 0.026, 0.055]);
  for (const s of [1, -1]) {
    M(G.sph(0), PAL.glowYellow(), head, [0.055, 0.062, s * 0.046], 0.014);
    M(G.cone(4), furD, head, [-0.02, 0.115, s * 0.045], [0.024, 0.075, 0.018], [s * 0.18, 0, -0.15]);
    M(G.cone(3), PAL.white(), q.jaw, [0.075, 0.008, s * 0.02], [0.006, 0.02, 0.006]);
  }

  for (const s of [1, -1]) {
    const fp = [0.16, -0.05, s * 0.075];
    quadLeg(q, body, fp, hipWorldY(body, fp), {
      upMat: fur, lowMat: belly, rUp: 0.042, rKnee: 0.026, rLow: 0.022, front: true, phase: s > 0 ? 0 : PI,
      paw: (k, y) => M(G.sph(0), belly, k, [0.018, y + 0.014, 0], [0.036, 0.02, 0.03]),
    });
    const hp = [-0.22, -0.03, s * 0.08];
    quadLeg(q, body, hp, hipWorldY(body, hp), {
      upMat: fur, lowMat: belly, rUp: 0.05, rKnee: 0.028, rLow: 0.024, phase: s > 0 ? PI : 0,
      paw: (k, y) => M(G.sph(0), belly, k, [0.018, y + 0.014, 0], [0.038, 0.02, 0.03]),
    });
  }

  let tp = grp(body, [-0.3, 0.03, 0], [0, 0, -0.75]);
  for (let i = 0; i < 3; i++) {
    limb(tp, i === 2 ? furD : fur, 0.11, 0.034 - i * 0.005, 0.028 - i * 0.005, 5);
    q.tail.push(tp);
    tp = grp(tp, [0, -0.1, 0], [0, 0, -0.12]);
  }

  rig.quadAttack = 'bite';
  rig.fall = 'side';
  rig.walkSpeed = 1.95;
  rig.proj = head;
  return rig;
};

BUILD.orc = () => {
  const skinO = mat('#6d8c3a', { tex: 'leather' }), skinD = mat('#4e6826', { tex: 'leather' });
  const rig = bipedRig(1.14, {
    skin: skinO, top: PAL.leather(), sleeve: skinO, fore: PAL.leatherDark(), handMat: skinO,
    bottom: PAL.leatherDark(), thigh: PAL.leather(), shin: PAL.leatherDark(), boots: PAL.leatherDark(),
    torsoW: 0.26, torsoD: 0.18, armR: 0.044, legR: 0.052, headR: 0.105,
    hunch: -0.08, eyeMat: PAL.glowRed(), noseMat: skinD,
  });
  const h = rig.h, r = h.P.headR;
  // Lower jaw & tusks
  M(G.box(), skinO, h.head, [r * 0.55, r * 0.42, 0], [r * 0.85, r * 0.45, r * 1.05]);
  for (const s of [1, -1]) {
    M(G.cone(4), PAL.bone(), h.head, [r * 0.95, r * 0.68, s * r * 0.38], [0.012, 0.048, 0.012], [0, 0, -0.2]);
    M(G.cone(4), skinD, h.head, [-r * 0.05, r * 1.05, s * r * 0.98], [0.018, 0.06, 0.014], [s * 0.9, 0, 0.2]);
  }
  // Horned iron cap helm
  M(G.dome(12, 5, 0.55), PAL.iron(), h.head, [0, r * 1.15, 0], [r * 1.08, r * 1.05, r * 1.04]);
  for (const s of [1, -1]) {
    M(G.cone(4), PAL.bone(), h.head, [0, r * 1.65, s * r * 0.95], [0.02, 0.085, 0.02], [s * 0.85, 0, 0]);
  }
  // Leather harness, belt, fur skirt & spiked pauldrons
  overChest(h, PAL.leatherDark(), 1.06, 0.72);
  belt(h, PAL.leatherDark(), PAL.iron());
  skirt(h, PAL.leather(), 0.16, 1.25);
  pauldrons(h, PAL.iron(), { spikes: PAL.bone(), s: 1.05 });

  // Throwing axe in right hand + round shield on left arm
  h.armR.sh.rotation.set(-0.12, 0, 0.35);
  h.armR.el.rotation.z = 0.65;
  rig.weapon = holdPivot(h, h.armR, -0.7);
  axeProp(rig.weapon, { handle: PAL.woodDark(), blade: PAL.steelDark() });

  rig.shield = grp(h.armL.el, [0, -0.11, -0.055], [0, -0.45, 0]);
  shieldRound(rig.shield, { R: 0.135, face: PAL.woodDark(), rim: PAL.iron(), boss: PAL.iron() });

  rig.shoot = 'throw';
  rig.attack = 'swing';
  rig.proj = h.armR.hand;
  return rig;
};

BUILD.stoneGolem = () => {
  const st = mat('#8d877e', { r: 0.92, tex: 'bone', bs: 0.024 }), stD = mat('#656058', { r: 0.95, tex: 'bone', bs: 0.026 });
  const rune = PAL.glowGold();
  const rig = bipedRig(1.28, {
    skin: st, top: st, sleeve: stD, fore: st, handMat: stD,
    bottom: stD, thigh: st, shin: stD, boots: st,
    torsoW: 0.29, torsoD: 0.21, armR: 0.052, legR: 0.06, headR: 0.105,
    noHead: true, noNeck: true,
  });
  const h = rig.h, r = h.P.headR;
  // Blocky carved head with glowing eyes & Hebrew אמת on forehead
  M(G.tbox(0.92, 0.92), st, h.head, [0, r * 1.05, 0], [r * 1.85, r * 2.0, r * 1.85]);
  M(G.box(), stD, h.head, [r * 0.92, r * 1.35, 0], [0.025, r * 0.24, r * 1.5]);
  for (const s of [1, -1]) {
    M(G.box(), rune, h.head, [r * 0.94, r * 1.15, s * r * 0.42], [0.015, 0.024, 0.036]);
  }
  const emetMat = typeof document !== 'undefined' ? emetMaterial() : rune;
  M(G.plane(), emetMat, h.head, [r * 0.96, r * 1.66, 0], [0.11, 0.055, 1], [0, PI / 2, 0]);

  // Carved stone chest slabs, rune core & heavy stone pauldrons/fists
  M(G.tbox(1.12, 1.12), stD, h.torso, [0, h.P.torsoLen * 0.55, 0], [h.P.torsoD * 1.08, h.P.torsoLen * 0.85, h.P.torsoW * 1.08]);
  const core = grp(h.torso, [h.P.torsoD * 0.55, h.P.torsoLen * 0.58, 0]);
  M(G.oct(), rune, core, [0, 0, 0], [0.022, 0.06, 0.048]);
  rig.glows.push(core);
  belt(h, stD, rune);
  pauldrons(h, st, { trim: stD, s: 1.25 });
  for (const A of [h.armR, h.armL]) {
    M(G.box(), st, A.el, [0, -0.09, 0], [0.11, 0.14, 0.11]);
    M(G.box(), rune, A.el, [0.056, -0.09, 0], [0.008, 0.09, 0.02]);
    M(G.box(), stD, A.hand, [0, -0.03, 0], [0.1, 0.1, 0.1]);
  }
  rig.attack = 'swing';
  rig.walkSpeed = 1.05;
  return rig;
};

BUILD.troll = () => {
  const skinT = mat('#3d8578', { tex: 'scales' }), moss = mat('#4d7a38', { tex: 'bone' }), hairM = mat('#b84a24', { tex: 'wood' });
  const rig = bipedRig(1.38, {
    skin: skinT, top: skinT, sleeve: skinT, fore: skinT, handMat: skinT,
    bottom: PAL.leatherDark(), thigh: skinT, shin: skinT, boots: skinT,
    torsoW: 0.27, torsoD: 0.19, armLen: 0.4, armR: 0.048, legR: 0.055, headR: 0.108,
    hunch: -0.24, headFwd: 0.035, nose: 1.65, noseMat: mat('#2d6b60', { tex: 'scales' }), eyeMat: PAL.glowYellow(),
  });
  const h = rig.h, r = h.P.headR;
  // Wild mohawk hair, pointed ears & lower tusks
  for (let i = 0; i < 4; i++) {
    M(G.cone(5), hairM, h.head, [-r * 0.1 - i * 0.025, r * 1.95 - i * 0.02, 0], [0.04, 0.11, 0.04], [0, 0, 0.35 + i * 0.15]);
  }
  for (const s of [1, -1]) {
    M(G.cone(4), skinT, h.head, [-r * 0.05, r * 1.05, s * r * 1.08], [0.024, 0.09, 0.018], [s * 1.05, 0, 0.2]);
    M(G.cone(4), PAL.bone(), h.head, [r * 0.88, r * 0.58, s * r * 0.38], [0.014, 0.052, 0.014], [0, 0, -0.25]);
  }
  // Mossy shoulder/back humps & ragged hide loincloth
  M(G.sph(1), moss, h.torso, [-0.04, h.P.torsoLen * 0.78, 0], [0.11, 0.08, 0.15]);
  belt(h, PAL.leatherDark(), PAL.bone());
  M(G.tatter(1, 1.25, 8, 0.35), mat('#5a3d24', { ds: true }), h.hips, [0, -0.07, 0], [0.1, 0.18, 0.13]);

  // Heavy gnarled club
  h.armR.sh.rotation.set(-0.15, 0, 0.35);
  h.armR.el.rotation.z = 0.65;
  rig.weapon = holdPivot(h, h.armR, -0.7);
  M(G.cyl(1.6, 0.9, 6), PAL.woodDark(), rig.weapon, [0, 0.18, 0], [0.032, 0.44, 0.032]);
  M(G.dodec(), mat('#6b655e', { tex: 'bone' }), rig.weapon, [0, 0.38, 0], [0.075, 0.095, 0.075]);
  rig.attack = 'swing';
  rig.walkSpeed = 1.25;
  return rig;
};

BUILD.cyclops = () => {
  const skinC = mat('#c88762', { tex: 'leather' }), tunic = mat('#6b4428', { tex: 'cloth' });
  const rig = bipedRig(1.56, {
    skin: skinC, top: tunic, sleeve: skinC, fore: skinC, handMat: skinC,
    bottom: tunic, thigh: skinC, shin: skinC, boots: PAL.leatherDark(),
    torsoW: 0.28, torsoD: 0.19, armLen: 0.38, armR: 0.05, legLen: 0.45, legR: 0.058, headR: 0.11,
    noFace: true,
  });
  const h = rig.h, r = h.P.headR;
  // Single large central eye, heavy brow ridge, forehead horn & beard
  M(G.sph(1), PAL.white(), h.head, [r * 0.82, r * 1.15, 0], [0.022, 0.036, 0.036]);
  M(G.sph(0), PAL.glowRed(), h.head, [r * 0.96, r * 1.15, 0], [0.012, 0.02, 0.02]);
  M(G.box(), skinC, h.head, [r * 0.88, r * 1.42, 0], [0.028, 0.022, r * 1.1]);
  M(G.cone(5), PAL.bone(), h.head, [r * 0.65, r * 1.95, 0], [0.024, 0.095, 0.024], [0, 0, -0.35]);
  beard(h, PAL.hairBlack(), 0.75);

  // Diagonal hide strap, bronze belt, kilt & wrist bracers
  M(G.box(), PAL.leatherDark(), h.torso, [h.P.torsoD * 0.48, h.P.torsoLen * 0.55, 0], [0.02, h.P.torsoLen * 0.95, 0.045], [0.55, 0, 0]);
  belt(h, PAL.goldDark(), PAL.gold());
  skirt(h, tunic, 0.18, 1.25);
  for (const A of [h.armR, h.armL]) {
    M(G.cyl(1, 1, 8), PAL.goldDark(), A.el, [0, -0.12, 0], [0.048, 0.075, 0.048]);
  }

  // Hurling boulder held in right hand
  h.armR.sh.rotation.set(-0.2, 0, 0.55);
  h.armR.el.rotation.z = 0.85;
  rig.weapon = holdPivot(h, h.armR, 0);
  M(G.dodec(), mat('#7a7268', { r: 0.92, tex: 'bone' }), rig.weapon, [0.02, 0.02, 0], [0.11, 0.1, 0.11]);

  rig.shoot = 'throw';
  rig.attack = 'swing';
  rig.proj = h.armR.hand;
  return rig;
};

BUILD.greenDragon = () => {
  const rig = newRig('dragon', 1.54);
  const scaleG = mat('#2d8a3e', { r: 0.52, m: 0.18, tex: 'scales', bs: 0.025 });
  const scaleD = mat('#1d5e2a', { r: 0.62, tex: 'scales', bs: 0.025 });
  const bellyG = mat('#d8a838', { r: 0.45, m: 0.32, tex: 'scales', bs: 0.02 });
  const wingM = mat('#b88428', { ds: true, r: 0.68, tex: 'leather' });
  const hornM = PAL.gold();

  const q = { kind: 'quad', legs: [], tail: [] };
  rig.q = q;
  const body = grp(rig.mover, [0, 0.56, 0], [0, 0, 0.18]);
  q.body = body;
  M(G.sph(1), scaleG, body, [-0.1, 0, 0], [0.28, 0.16, 0.15]);
  M(G.sph(1), scaleG, body, [0.14, 0.03, 0], [0.2, 0.18, 0.165]);
  M(G.sph(1), bellyG, body, [0.05, -0.04, 0], [0.28, 0.13, 0.13]);
  for (let i = 0; i < 6; i++) {
    M(G.cone(4), hornM, body, [-0.28 + i * 0.1, 0.17, 0], [0.022, 0.09, 0.022], [0, 0, 0.25]);
  }

  const neck = grp(body, [0.26, 0.12, 0], [0, 0, -0.58]);
  q.neck = neck;
  M(G.cyl(0.75, 1, 8), scaleG, neck, [0, 0.12, 0], [0.085, 0.26, 0.08]);
  M(G.cyl(0.75, 1, 8), bellyG, neck, [0.025, 0.12, 0], [0.065, 0.25, 0.065]);
  for (let i = 0; i < 3; i++) {
    M(G.cone(4), hornM, neck, [-0.075, 0.05 + i * 0.08, 0], [0.016, 0.07, 0.016], [0, 0, 0.9]);
  }

  const head = grp(neck, [0.02, 0.26, 0], [0, 0, 0.42]);
  q.head = head;
  M(G.tbox(0.75, 0.85), scaleG, head, [0.02, 0.05, 0], [0.14, 0.1, 0.125]);
  M(G.tbox(0.55, 0.65), scaleG, head, [0.15, 0.035, 0], [0.16, 0.07, 0.095]);
  for (const s of [1, -1]) {
    M(G.sph(0), PAL.glowGold(), head, [0.06, 0.068, s * 0.055], 0.016);
    M(G.box(), scaleD, head, [0.06, 0.092, s * 0.05], [0.07, 0.018, 0.03], [s * 0.2, 0, -0.15]);
    seg(head, hornM, [-0.02, 0.09, s * 0.048], [-0.17, 0.18, s * 0.095], 0.026, 0.014, 6);
    seg(head, hornM, [-0.17, 0.18, s * 0.095], [-0.28, 0.25, s * 0.11], 0.014, 0.004, 6);
    for (let k = 0; k < 3; k++) {
      M(G.cone(3), PAL.bone(), head, [0.09 + k * 0.04, -0.006, s * 0.036], [0.007, 0.025, 0.007], [PI, 0, 0]);
    }
  }
  q.jaw = grp(head, [0.03, 0.0, 0], [0, 0, -0.06]);
  M(G.tbox(0.55, 0.65), bellyG, q.jaw, [0.09, -0.018, 0], [0.15, 0.035, 0.082]);
  M(G.sph(0), PAL.fire(), q.jaw, [0.05, 0.008, 0], [0.035, 0.018, 0.03]);

  for (const s of [1, -1]) {
    const fp = [0.18, -0.06, s * 0.1];
    quadLeg(q, body, fp, hipWorldY(body, fp), {
      upMat: scaleG, lowMat: scaleD, rUp: 0.048, rKnee: 0.034, rLow: 0.028, front: true, phase: s > 0 ? 0 : PI,
      paw: (k, y) => talons(k, y, hornM, 0.016, 0.065),
    });
    const hp = [-0.24, -0.03, s * 0.1];
    quadLeg(q, body, hp, hipWorldY(body, hp), {
      upMat: scaleG, lowMat: scaleD, rUp: 0.058, rKnee: 0.038, rLow: 0.03, phase: s > 0 ? PI : 0,
      paw: (k, y) => talons(k, y, hornM, 0.016, 0.065),
    });
  }

  let tp = grp(body, [-0.35, 0.02, 0], [0, 0, -1.12]);
  for (let i = 0; i < 5; i++) {
    const r0 = 0.038 - i * 0.005;
    limb(tp, scaleG, 0.13, r0, r0 * 0.82, 6);
    M(G.cone(4), hornM, tp, [-0.025, -0.06, 0], [0.012, 0.045, 0.012], [0, 0, PI / 2]);
    q.tail.push(tp);
    tp = grp(tp, [0, -0.12, 0], [0, 0, 0.16]);
  }
  M(G.oct(), hornM, tp, [0, -0.04, 0], [0.032, 0.065, 0.014]);

  for (const s of [1, -1]) {
    rig.wings.push(membraneWing(body, s, {
      p: [0.11, 0.14, s * 0.11], span: 1.05, r: 0.034,
      bone: scaleD, membrane: wingM, claw: hornM, tatter: false, rest: [-0.45, -0.55, 0],
    }));
  }

  rig.hover = 0.1;
  rig.quadAttack = 'bite';
  rig.fall = 'side';
  rig.walkSpeed = 1.5;
  rig.proj = head;
  return rig;
};

// ---------------------------------------------------------------- grounding pedestal ring for battle / map units
function addGroundPedestal(rig, faction = 'neutral', upgraded = false) {
  const isQuad = rig.plan === 'dragon' || rig.plan === 'griffin' || rig.plan === 'quad' || rig.plan === 'rider';
  const rx = (isQuad ? 0.42 : 0.25) * rig.scale;
  const rz = (isQuad ? 0.30 : 0.25) * rig.scale;

  const base = grp(rig.root, [0, 0.004, 0]);
  const shadowMat = mat('#080604', { op: 0.34, r: 1, m: 0, tex: 'none' });
  const disc = M(G.cyl(1, 1, 20), shadowMat, base, [0, 0, 0], [rx, 0.004, rz]);
  disc.castShadow = false;
  disc.receiveShadow = true;
  disc.userData.noShadow = true;
  disc.userData.noFlash = true;

  const ringMat = upgraded
    ? PAL.gold()
    : faction === 'necropolis'
      ? PAL.iron()
      : PAL.goldDark();
  const ring = M(G.torus(0.032, TAU, 6, 24), ringMat, base, [0, 0.003, 0], [rx * 1.02, rz * 1.02, 0.28], [PI / 2, 0, 0]);
  ring.castShadow = false;
  ring.receiveShadow = true;
  ring.userData.noShadow = true;
  ring.userData.noFlash = true;
}

// ============================================================================
//  PROCEDURAL ANIMATOR
// ============================================================================
function saveRest(obj) {
  if (!obj || obj.userData._restSaved) return;
  obj.userData._restPos = obj.position.clone();
  obj.userData._restRot = obj.rotation.clone();
  obj.userData._restScale = obj.scale.clone();
  obj.userData._restSaved = true;
}

function resetRest(obj) {
  if (!obj || !obj.userData._restSaved) return;
  obj.position.copy(obj.userData._restPos);
  obj.rotation.copy(obj.userData._restRot);
  obj.scale.copy(obj.userData._restScale);
}

function collectRigNodes(rig) {
  const list = [rig.scaler, rig.mover, rig.weapon, rig.weapon2, rig.shield];
  const h = rig.h;
  if (h) {
    list.push(
      h.base, h.body, h.hips, h.torso, h.head, h.cape, h.robe,
      h.armR?.sh, h.armR?.el, h.armR?.hand,
      h.armL?.sh, h.armL?.el, h.armL?.hand,
      h.legR?.hip, h.legR?.knee,
      h.legL?.hip, h.legL?.knee,
    );
  }
  const q = rig.q;
  if (q) {
    list.push(q.body, q.neck, q.head, q.jaw);
    for (const L of q.legs) list.push(L.hip, L.knee);
    for (const T of q.tail) list.push(T);
  }
  for (const w of rig.wings) list.push(w.pivot, w.outer);
  for (const t of rig.tail) list.push(t);
  for (const c of rig.cloth) list.push(c.o);
  for (const g of rig.glows) list.push(g);
  return list.filter(Boolean);
}

function makeAnimator(rig, opts = {}) {
  const nodes = collectRigNodes(rig);
  for (const n of nodes) saveRest(n);

  const meshes = [];
  rig.root.traverse((c) => {
    if (c.isMesh) {
      if (!c.userData.noShadow) c.castShadow = true;
      if (!c.userData.noFlash) meshes.push(c);
    }
  });

  let state = 'idle';
  let stateTime = 0;
  let totalTime = rig.ph || 0;
  let resolveCur = null;
  let flashTime = 0;
  let flashDur = 0;
  const flashCol = new THREE.Color('#ff3322');
  let highlighted = false;

  const durations = {
    attack: 0.52 * (rig.durK || 1),
    shoot: 0.48 * (rig.durK || 1),
    cast: 0.54 * (rig.durK || 1),
    hit: 0.32,
    death: 0.55,
    revive: 0.5,
  };

  function syncMaterialTint() {
    const activeFlash = flashTime > 0 && flashDur > 0;
    const fAmt = activeFlash ? clamp01(flashTime / flashDur) : 0;
    for (const m of meshes) {
      if (!m.material) continue;
      if (activeFlash || highlighted) {
        if (!m.userData._sharedMat) m.userData._sharedMat = m.material;
        if (!m.userData._ownMat) m.userData._ownMat = m.userData._sharedMat.clone();
        const base = m.userData._sharedMat;
        const own = m.userData._ownMat;
        if (own.emissive) {
          own.emissive.copy(base.emissive || new THREE.Color(0x000000));
          own.emissiveIntensity = base.emissiveIntensity ?? 0;
          if (highlighted) {
            own.emissive.lerp(new THREE.Color('#ffd84a'), 0.45);
            own.emissiveIntensity = Math.max(own.emissiveIntensity, 0.35);
          }
          if (activeFlash) {
            own.emissive.lerp(flashCol, 0.75 * fAmt);
            own.emissiveIntensity = Math.max(own.emissiveIntensity, 1.4 * fAmt);
          }
        }
        m.material = own;
      } else if (m.userData._sharedMat) {
        m.material = m.userData._sharedMat;
      }
    }
  }

  function play(nextState = 'idle') {
    if (resolveCur) {
      const r = resolveCur;
      resolveCur = null;
      r();
    }
    state = nextState;
    stateTime = 0;
    if (rig.bow) {
      rig.bow.arrow.visible = false;
      updateBow(rig.bow, 0);
    }
    const dur = durations[state];
    if (!dur) return Promise.resolve();
    return new Promise((resolve) => {
      resolveCur = resolve;
    });
  }

  function flash(color = '#ff3322', duration = 0.3) {
    flashCol.set(color);
    flashDur = Math.max(0.05, duration);
    flashTime = flashDur;
    syncMaterialTint();
  }

  function setHighlight(on) {
    const b = !!on;
    if (highlighted === b) return;
    highlighted = b;
    syncMaterialTint();
  }

  function applyIdleAndSecondary(t, walkFactor = 0) {
    const h = rig.h, q = rig.q;
    const hoverY = rig.hover > 0
      ? rig.hover + Math.sin(t * 2.6) * 0.042
      : Math.abs(Math.sin(t * 2.1)) * 0.01;
    rig.mover.position.y += hoverY;

    if (h) {
      h.torso.rotation.z += Math.sin(t * 2.1) * 0.025;
      h.torso.rotation.y += Math.sin(t * 1.3) * 0.03;
      h.head.rotation.y += Math.sin(t * 1.1) * 0.045;
      h.head.rotation.z += Math.cos(t * 2.1) * 0.02;
      if (h.armR) h.armR.sh.rotation.z += Math.sin(t * 2.1) * 0.028;
      if (h.armL) h.armL.sh.rotation.z -= Math.sin(t * 2.1) * 0.028;
      if (h.cape) h.cape.rotation.z += -0.04 - walkFactor * 0.18 + Math.sin(t * (3.0 + walkFactor * 3)) * (0.04 + walkFactor * 0.06);
    }
    if (q) {
      q.body.position.y += Math.sin(t * 2.4) * 0.012;
      if (q.neck) q.neck.rotation.z += Math.sin(t * 2.0) * 0.035;
      if (q.head) q.head.rotation.y += Math.sin(t * 1.4) * 0.045;
      if (q.jaw) q.jaw.rotation.z += (Math.sin(t * 2.4) * 0.5 + 0.5) * 0.05;
      for (let i = 0; i < q.tail.length; i++) {
        q.tail[i].rotation.x = Math.sin(t * 3.0 - i * 0.7) * (0.14 + walkFactor * 0.12);
      }
    }
    for (let i = 0; i < rig.wings.length; i++) {
      const w = rig.wings[i];
      const amp = lerp(rig.flapIdle, rig.flapWalk, walkFactor);
      const spd = rig.flapSpeed * (0.65 + walkFactor * 0.65);
      const s = Math.sin(t * spd);
      w.pivot.rotation.x += s * amp;
      w.outer.rotation.x += Math.sin(t * spd - 0.6) * amp * 0.55;
    }
    for (const c of rig.cloth) {
      const ph = c.ph || 0;
      c.o.rotation[c.axis || 'z'] += Math.sin(t * (c.speed || 3) + ph) * (c.amp || 0.2) * (1 + walkFactor * 0.6);
    }
    for (const g of rig.glows) {
      const s = 1 + Math.sin(t * 4.5) * 0.12;
      g.scale.multiplyScalar(s);
    }
  }

  function update(dt = 0.016) {
    totalTime += dt;
    stateTime += dt;

    if (flashTime > 0) {
      flashTime = Math.max(0, flashTime - dt);
      syncMaterialTint();
    }

    for (const n of nodes) resetRest(n);

    const h = rig.h, q = rig.q;
    const dur = durations[state];
    const u = dur ? clamp01(stateTime / dur) : 0;

    if (state === 'idle') {
      applyIdleAndSecondary(totalTime, 0);
    } else if (state === 'walk') {
      applyIdleAndSecondary(totalTime, 1);
      const w = totalTime * 9.0 * (rig.walkSpeed || 1.5);
      if (rig.wings.length > 0 && (rig.hover > 0 || rig.glide)) {
        rig.mover.rotation.z -= 0.16;
        rig.mover.position.y += 0.06;
      } else if (h && !h.riding && h.legR && h.legL) {
        h.legR.hip.rotation.z += Math.sin(w) * 0.55;
        h.legR.knee.rotation.z -= Math.max(0, -Math.cos(w)) * 0.65;
        h.legL.hip.rotation.z -= Math.sin(w) * 0.55;
        h.legL.knee.rotation.z -= Math.max(0, Math.cos(w)) * 0.65;
        h.hips.position.y += Math.abs(Math.cos(w)) * 0.032;
        h.torso.rotation.y -= Math.sin(w) * 0.08;
        if (h.armR) h.armR.sh.rotation.z -= Math.sin(w) * (h.swingR ?? 0.32);
        if (h.armL) h.armL.sh.rotation.z += Math.sin(w) * (h.swingL ?? 0.32);
      }
      if (q) {
        for (const L of q.legs) {
          const lw = w + (L.phase || 0);
          L.hip.rotation.z += Math.sin(lw) * 0.48;
          L.knee.rotation.z += (L.front ? -1 : 1) * Math.max(0, Math.cos(lw)) * 0.52;
        }
        q.body.position.y += Math.abs(Math.sin(w)) * 0.038;
        q.body.rotation.z += Math.cos(w) * 0.045;
        if (q.neck) q.neck.rotation.z -= Math.cos(w) * 0.075;
        if (h && h.riding) h.torso.rotation.z -= Math.cos(w) * 0.055;
      }
    } else if (state === 'defend') {
      applyIdleAndSecondary(totalTime, 0);
      rig.mover.position.y -= 0.035;
      if (h) {
        h.torso.rotation.z -= 0.1;
        if (h.armL) {
          h.armL.sh.rotation.z += 0.55;
          h.armL.el.rotation.z += 0.45;
        }
        if (h.armR) {
          h.armR.sh.rotation.z += 0.3;
          h.armR.el.rotation.z += 0.35;
        }
      }
    } else if (state === 'attack') {
      applyIdleAndSecondary(totalTime, 0.4);
      const lunge = Math.sin(u * PI);
      rig.mover.position.x += lunge * 0.22;
      const swing = u < 0.35
        ? -smooth(u / 0.35) * 0.85
        : u < 0.68
          ? lerp(-0.85, 1.05, smooth((u - 0.35) / 0.33))
          : lerp(1.05, 0, smooth((u - 0.68) / 0.32));

      if (h) {
        h.torso.rotation.z -= lunge * 0.16;
        if (rig.attack === 'thrust' || rig.attack === 'lance') {
          if (h.armR) {
            h.armR.sh.rotation.z += -swing * 0.65;
            h.armR.el.rotation.z -= Math.max(0, swing) * 0.55;
          }
        } else if (rig.attack === 'dual') {
          if (h.armR) h.armR.sh.rotation.z -= swing * 0.9;
          if (h.armL) h.armL.sh.rotation.z -= Math.sin(clamp01((u - 0.15) / 0.85) * PI) * 0.85;
        } else if (rig.attack === 'claw') {
          if (h.armR) h.armR.sh.rotation.z -= swing * 0.75;
          if (h.armL) h.armL.sh.rotation.z -= swing * 0.7;
        } else if (rig.attack === 'swingL') {
          if (h.armL) h.armL.sh.rotation.z -= swing * 0.85;
        } else if (h.armR) {
          h.armR.sh.rotation.z -= swing * 0.95;
          h.armR.el.rotation.z -= Math.max(0, swing) * 0.35;
        }
      }
      if (q) {
        if (rig.quadAttack === 'bite') {
          if (q.neck) q.neck.rotation.z -= swing * 0.35;
          if (q.jaw) q.jaw.rotation.z -= Math.max(0, -swing) * 0.55;
        } else if (rig.quadAttack === 'claw') {
          q.body.rotation.z += lunge * 0.28;
          for (const L of q.legs) if (L.front) L.hip.rotation.z += lunge * 0.75;
        } else {
          q.body.rotation.z -= swing * 0.12;
        }
      }
    } else if (state === 'shoot' || state === 'cast') {
      applyIdleAndSecondary(totalTime, 0.2);
      const pulse = Math.sin(u * PI);
      if (rig.shoot === 'bow' && rig.bow && h) {
        const draw = u < 0.58 ? smooth(u / 0.58) : 1 - smooth((u - 0.58) / 0.42);
        if (h.armL) {
          h.armL.sh.rotation.z += 1.05 * pulse;
          h.armL.el.rotation.z -= 0.25 * pulse;
        }
        if (h.armR) {
          h.armR.sh.rotation.z += 0.95 * draw;
          h.armR.el.rotation.z += 0.85 * draw;
        }
        rig.bow.arrow.visible = u < 0.6;
        updateBow(rig.bow, draw);
      } else if (rig.shoot === 'throw' && h) {
        const thr = u < 0.45
          ? -smooth(u / 0.45) * 0.95
          : lerp(-0.95, 1.1, smooth((u - 0.45) / 0.55));
        h.torso.rotation.y += thr * 0.25;
        if (h.armR) h.armR.sh.rotation.z -= thr * 0.95;
      } else {
        if (h) {
          if (h.armR) h.armR.sh.rotation.z += pulse * 0.85;
          if (h.armL) h.armL.sh.rotation.z += pulse * 0.75;
        }
        for (const g of rig.glows) g.scale.multiplyScalar(1 + pulse * 0.85);
      }
    } else if (state === 'hit') {
      applyIdleAndSecondary(totalTime, 0);
      const k = Math.sin(u * PI);
      rig.mover.position.x -= k * 0.14;
      if (h) {
        h.torso.rotation.z += k * 0.26;
        h.head.rotation.z += k * 0.22;
      }
      if (q) {
        q.body.rotation.z += k * 0.16;
        if (q.neck) q.neck.rotation.z += k * 0.22;
      }
    } else if (state === 'death' || state === 'dead') {
      const k = state === 'dead' ? 1 : smooth(u);
      if (rig.fall === 'sink') {
        rig.mover.position.y -= k * 0.58;
        rig.scaler.scale.setScalar(rig.scale * (1 - k * 0.65));
      } else if (rig.fall === 'side') {
        rig.mover.rotation.x += k * (PI / 2 * 0.9);
        rig.mover.position.y -= k * 0.12;
      } else {
        rig.mover.rotation.z += k * (PI / 2 * 0.92);
        rig.mover.position.y -= k * 0.06;
      }
    } else if (state === 'revive') {
      const k = 1 - smooth(u);
      if (rig.fall === 'sink') {
        rig.mover.position.y -= k * 0.58;
        rig.scaler.scale.setScalar(rig.scale * (1 - k * 0.65));
      } else if (rig.fall === 'side') {
        rig.mover.rotation.x += k * (PI / 2 * 0.9);
        rig.mover.position.y -= k * 0.12;
      } else {
        rig.mover.rotation.z += k * (PI / 2 * 0.92);
        rig.mover.position.y -= k * 0.06;
      }
    }

    if (dur && stateTime >= dur) {
      const done = resolveCur;
      resolveCur = null;
      if (state === 'death') {
        state = 'dead';
      } else {
        state = 'idle';
        stateTime = 0;
        if (rig.bow) {
          rig.bow.arrow.visible = false;
          updateBow(rig.bow, 0);
        }
      }
      if (done) done();
    }
  }

  // Apply initial pose immediately
  update(0);

  return {
    rig,
    get state() { return state; },
    get impactTime() { return rig.impactTime || 0.32; },
    play,
    setState: play,
    update,
    flash,
    setHighlight,
  };
}

// ============================================================================
//  PUBLIC EXPORTS: createCreatureModel, createHeroModel, disposeModel
// ============================================================================
export function createCreatureModel(id, opts = {}) {
  const fn = BUILD[id] || BUILD.pikeman;
  const rig = fn();
  const c = CREATURES[id];
  if (!opts.static) {
    addGroundPedestal(rig, c?.faction || 'neutral', !!c?.upgraded);
  }
  const group = rig.root;
  group.userData.creatureId = id;
  group.userData.rig = rig;
  group.userData.animator = makeAnimator(rig, opts);
  return group;
}

export function createHeroModel({ faction = 'castle', heroClass = 'knight', color = '#d8392b', static: isStatic = false } = {}) {
  const isNecro = faction === 'necropolis' || heroClass === 'deathKnight' || heroClass === 'necromancer';
  const bannerMat = mat(color, { ds: true, r: 0.72, tex: 'cloth' });
  const trimMat = isNecro ? PAL.iron() : PAL.gold();

  let rig;
  if (heroClass === 'cleric') {
    rig = riderRig(1.08, {
      coat: mat('#f4f0e8', { tex: 'leather' }), mane: mat('#dcd4c6', { tex: 'wood' }),
      capar: mat('#f6f3ec', { ds: true, tex: 'cloth' }), trim: mat(color, { ds: true, tex: 'cloth' }),
      saddleCloth: bannerMat, clothTrim: PAL.gold(),
    }, {
      top: PAL.white(), sleeve: PAL.white(), fore: PAL.gold(), handMat: PAL.skin(),
      bottom: PAL.white(), thigh: PAL.white(), shin: PAL.gold(), boots: PAL.goldDark(),
    });
    const h = rig.h, r = h.P.headR;
    overChest(h, bannerMat, 1.06, 0.7);
    chestEmblemCross(h, PAL.gold());
    belt(h, PAL.gold(), PAL.gold());
    pauldrons(h, PAL.gold(), { s: 0.95 });
    M(G.cyl(1, 1, 10), PAL.gold(), h.head, [0, r * 1.48, 0], [r * 1.04, 0.028, r * 1.02]);
    hair(h, PAL.hairBlond(), { long: true });
    cape(h, bannerMat, { len: 0.34, inner: PAL.gold(), clasp: PAL.gold(), flare: 1.35 });
  } else if (heroClass === 'deathKnight') {
    rig = riderRig(1.1, {
      coat: mat('#1e1c22', { tex: 'leather' }), mane: mat('#0c0b0e', { tex: 'wood' }), eye: PAL.glowRed(), eyeGlow: true,
      hoof: PAL.ironDark(), capar: mat('#261830', { ds: true, tex: 'cloth' }), caparTatter: 0.3,
      trim: bannerMat, armor: PAL.iron(), armorTrim: PAL.ironDark(), armorSpike: PAL.ironDark(),
    }, {
      top: PAL.iron(), sleeve: PAL.iron(), fore: PAL.iron(), handMat: PAL.ironDark(),
      bottom: PAL.ironDark(), thigh: PAL.iron(), shin: PAL.iron(), boots: PAL.ironDark(),
    });
    const h = rig.h, r = h.P.headR;
    overChest(h, bannerMat, 1.07, 0.62);
    belt(h, PAL.ironDark(), PAL.glowRed());
    pauldrons(h, PAL.iron(), { spikes: PAL.ironDark(), s: 1.25 });
    helmGreat(h, PAL.iron(), PAL.ironDark(), { crown: PAL.ironDark() });
    plume(h.head, bannerMat, [0, r * 2.2, 0], 0.2, -1, 5);
    cape(h, bannerMat, { len: 0.36, inner: PAL.black(), flare: 1.4 });
    rig.shield = grp(h.armL.el, [0, -0.1, -0.055], [0, -0.45, 0]);
    shieldKite(rig.shield, { s: 0.95, face: bannerMat, rim: PAL.iron(), emblem: PAL.bone(), cross: false });
  } else if (heroClass === 'necromancer') {
    rig = riderRig(1.08, {
      coat: mat('#c8c0ad', { tex: 'leather' }), mane: mat('#3a3530', { tex: 'wood' }), eye: PAL.glowGreen(), eyeGlow: true,
      hoof: PAL.ironDark(), capar: mat('#2b193d', { ds: true, tex: 'cloth' }), caparTatter: 0.35,
      trim: bannerMat,
    }, {
      top: PAL.purpleDark(), sleeve: PAL.purpleDark(), fore: PAL.bone(), handMat: PAL.bone(),
      bottom: PAL.purpleDark(), thigh: PAL.purpleDark(), shin: PAL.bone(), boots: PAL.ironDark(),
      noHead: true, noNeck: true,
    });
    const h = rig.h, r = h.P.headR;
    skull(h.head, r, { eyes: PAL.glowGreen() });
    hood(h, bannerMat);
    overChest(h, bannerMat, 1.06, 0.65);
    belt(h, PAL.ironDark(), PAL.glowGreen());
    cape(h, mat('#241434', { ds: true, tex: 'cloth' }), { len: 0.36, inner: bannerMat, flare: 1.4 });
  } else {
    // Default: 'knight'
    rig = riderRig(1.1, {
      coat: mat('#f1ece4', { tex: 'leather' }), mane: mat('#d8d0c4', { tex: 'wood' }),
      capar: bannerMat, trim: mat('#e9b949', { m: 0.8, r: 0.3, ds: true }),
      armor: PAL.steel(), armorTrim: PAL.gold(),
    }, { ...steelSet() });
    const h = rig.h, r = h.P.headR;
    overChest(h, bannerMat, 1.07, 0.78);
    chestEmblemCross(h, PAL.gold());
    belt(h, PAL.gold(), PAL.gold());
    pauldrons(h, PAL.steel(), { trim: PAL.gold(), s: 1.15 });
    helmGreat(h, PAL.steel(), PAL.gold(), { crown: PAL.gold() });
    plume(h.head, PAL.white(), [0, r * 2.2, 0], 0.2, -1, 5);
    plume(h.head, bannerMat, [-0.01, r * 2.15, 0], 0.14, -1, 3);
    cape(h, bannerMat, { len: 0.34, inner: PAL.gold(), clasp: PAL.gold(), flare: 1.35 });
    rig.shield = grp(h.armL.el, [0, -0.1, -0.055], [0, -0.45, 0]);
    shieldKite(rig.shield, { s: 0.95, face: bannerMat, rim: PAL.gold(), emblem: PAL.gold() });
  }

  // Tall hero banner / standard in right hand
  const h = rig.h;
  h.armR.sh.rotation.set(-0.12, 0, 0.35);
  h.armR.el.rotation.z = 0.95;
  rig.weapon = holdPivot(h, h.armR, -0.12);
  const st = staff(rig.weapon, { y0: -0.3, y1: 0.92, shaft: trimMat, thick: 0.018 });
  const top = st.userData.top;
  if (isNecro) {
    skull(top, 0.036, { p: [0, 0.01, 0], eyes: PAL.glowGreen() });
  } else {
    M(G.oct(), PAL.glowGold(), top, [0, 0.05, 0], [0.035, 0.06, 0.035]);
  }
  const flag = grp(st, [0, 0.76, 0]);
  M(G.tbox(0.85, 1), bannerMat, flag, [-0.14, -0.08, 0], [0.28, 0.22, 0.01]);
  M(G.box(), trimMat, flag, [-0.14, 0.03, 0], [0.29, 0.02, 0.014]);
  rig.cloth.push({ o: flag, axis: 'y', amp: 0.28, speed: 4.5 });

  rig.attack = 'swing';
  rig.shoot = 'cast';
  if (!isStatic) {
    addGroundPedestal(rig, faction, true);
  }
  const group = rig.root;
  group.userData.rig = rig;
  group.userData.animator = makeAnimator(rig);
  return group;
}

export function disposeModel(group) {
  if (!group) return;
  group.traverse((c) => {
    if (c.geometry && !c.geometry.userData?.shared) {
      c.geometry.dispose?.();
    }
    if (c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      for (const m of mats) {
        if (m && !m.userData?.shared) m.dispose?.();
      }
      if (c.userData?._ownMat && !c.userData._ownMat.userData?.shared) {
        c.userData._ownMat.dispose?.();
      }
    }
  });
}
