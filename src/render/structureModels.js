// ============================================================================
//  מודלים פרוצדורליים של מבנים על מפת ההרפתקאות, קישוטי שטח ועיירות
//  Procedural low-poly models: adventure-map structures, terrain decorations
//  (for instancing) and 3x3 town models. All geometry/materials are cached.
//  Conventions: 1 tile = 1 unit, base on y=0, front/entrance faces +Z.
// ============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARTIFACTS, RARITY_COLORS } from '../data/artifacts.js';
import {
  grainTexture,
  stoneWallTexture,
  roofTileTexture,
  woodPlankTexture,
  stoneBumpTexture,
  woodBumpTexture,
  roofBumpTexture,
} from './textures.js';

const PI = Math.PI, TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
//  Shared time uniform (flags, portals). Every update() refreshes it.
// ---------------------------------------------------------------------------
export const TIME = { value: 0 };
export function updateStructureTime(time) { TIME.value = time; }

// ---------------------------------------------------------------------------
//  Seeded random + hashing
// ---------------------------------------------------------------------------
export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash3(x, y, z, s) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.19) * 43758.5453;
  return h - Math.floor(h);
}

// ---------------------------------------------------------------------------
//  Palette & materials
// ---------------------------------------------------------------------------
export const C = {
  woodDark: '#5a3a20', wood: '#8a5a32', woodLight: '#b47d47', plank: '#c4925a', bark: '#6b4529', logEnd: '#e0b77e',
  stoneL: '#e2dccd', stone: '#aca595', stoneD: '#78726a', rock: '#8c857b', rockD: '#5e5852', cobble: '#a39b8d',
  thatch: '#d6a94c', roofRed: '#b8452e', roofBlue: '#3c6fc0', slate: '#4f5a6b',
  gold: '#f7c444', iron: '#59606a', steel: '#c3cad2', rope: '#c9ab74',
  leaf: '#4e9a38', leafD: '#3a7b2c', leafL: '#7dbb4b', cloth: '#c23b35', cream: '#f0e4c4',
  water: '#3d8fd2', dark: '#16110f', bone: '#ebe1c6', hay: '#e2c15a', mud: '#7a5a3a',
};

const STONE_WALL_COLORS = new Set([
  C.stoneL, C.stone, C.stoneD, C.cobble,
  '#eee8da', '#eee7d6', '#e6dfd0', '#e8e0cf', '#dfd6c3', '#d8cfc0', '#e4dccb', '#f5efe0',
  '#d2c9b6', '#bdb39e', '#c2b8a3', '#cfc5b0', '#c6bda8', '#d6cebe', '#b8af9e', '#b7ad97', '#c8bfa9',
  '#4a4452', '#37323e', '#5d5666', '#4a4356', '#463f52', '#484154', '#322c3c', '#3e3a40', '#4c4650',
]);
const ROOF_COLORS = new Set([
  C.roofRed, C.roofBlue, C.thatch, C.slate,
  '#3a6cc8', '#2c56a6', '#2b5cb8', '#1f4694', '#b8452e', '#9e3520',
  '#5e3a86', '#47296a', '#4c2e72', '#382058',
]);
const WOOD_COLORS = new Set([
  C.wood, C.woodDark, C.woodLight, C.plank, C.bark, '#7a5232', '#6a3a1e', '#5c3b22', '#3a302a',
]);

const _mats = new Map();
/** Cached PBR-enhanced MeshStandardMaterial. o: {e: emissive, ei, m: metalness, r: roughness, op: opacity, ds: doubleSide, map, normalMap, normalScale, flat} */
export function mat(color, o = {}) {
  const key = [
    color, o.e || '', o.ei ?? '', o.m ?? '', o.r ?? '', o.op ?? '', o.ds ? 1 : 0,
    o.map?.uuid || '', o.normalMap?.uuid || '', o.normalScale ?? '', o.flat ?? '',
  ].join('|');
  let m = _mats.get(key);
  if (!m) {
    const isTrans = o.op != null && o.op < 1;
    const isMetal = (o.m ?? 0) >= 0.25;
    const cStr = String(color).toLowerCase();
    const isWood = WOOD_COLORS.has(cStr);
    const isRoof = ROOF_COLORS.has(cStr);
    const isStoneWall = STONE_WALL_COLORS.has(cStr);
    const isFoliage = cStr === C.leaf || cStr === C.leafD || cStr === C.leafL || cStr === '#2f6d34';
    m = new THREE.MeshStandardMaterial({
      color,
      flatShading: o.flat ?? (!isMetal && !isFoliage),
      roughness: o.r ?? (isMetal ? 0.26 : isRoof ? 0.68 : isWood ? 0.80 : 0.78),
      metalness: o.m ?? (isMetal ? 0.74 : 0.04),
    });
    if (o.map) {
      m.map = o.map;
    } else if (!isTrans && !o.e) {
      m.map = isStoneWall
        ? stoneWallTexture()
        : isRoof
          ? roofTileTexture()
          : isWood
            ? woodPlankTexture()
            : grainTexture();
    }
    if (o.normalMap) {
      m.normalMap = o.normalMap;
      const ns = o.normalScale ?? 0.35;
      m.normalScale = new THREE.Vector2(ns, ns);
    } else if (!isTrans && !o.e) {
      m.bumpMap = isWood ? woodBumpTexture() : isRoof ? roofBumpTexture() : stoneBumpTexture();
      m.bumpScale = isMetal ? 0.006 : isRoof ? 0.032 : isStoneWall ? 0.028 : isWood ? 0.024 : 0.016;
    }
    if (o.e) { m.emissive.set(o.e); m.emissiveIntensity = o.ei ?? 1; }
    if (isTrans) { m.transparent = true; m.opacity = o.op; m.depthWrite = false; }
    if (o.ds) m.side = THREE.DoubleSide;
    _mats.set(key, m);
  }
  return m;
}
// frequently used materials
export const MAT = {
  get gold() { return mat('#f6c648', { m: 0.84, r: 0.20, e: '#5e3800', ei: 0.28 }); },
  get goldDim() { return mat('#dca434', { m: 0.76, r: 0.28, e: '#382000', ei: 0.22 }); },
  get iron() { return mat(C.iron, { m: 0.70, r: 0.38 }); },
  get steel() { return mat(C.steel, { m: 0.82, r: 0.22, e: '#1c2228', ei: 0.2 }); },
  get dark() { return mat(C.dark, { r: 1 }); },
  get glass() { return mat('#cfeaff', { op: 0.45, r: 0.05, m: 0.22, e: '#4b6a80', ei: 0.35 }); },
  get water() { return mat(C.water, { r: 0.08, m: 0.24, e: '#0d3a66', ei: 0.35 }); },
};

// ---------------------------------------------------------------------------
//  Procedural canvas textures (glow, sparkle, smoke, runes)
// ---------------------------------------------------------------------------
const _tex = {};
function canvasTex(key, size, draw) {
  if (_tex[key]) return _tex[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (_tex[key] = t);
}
export function glowTexture() {
  return canvasTex('glow', 128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.18, 'rgba(255,255,255,0.65)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.2)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
}
function sparkleTexture() {
  return canvasTex('sparkle', 64, (g, s) => {
    const h = s / 2;
    const gr = g.createRadialGradient(h, h, 0, h, h, h * 0.5);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    for (const [w, l] of [[3, h], [1.5, h * 0.6]]) {
      g.beginPath(); g.moveTo(h, h - l); g.lineTo(h + w, h); g.lineTo(h, h + l); g.lineTo(h - w, h); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(h - l, h); g.lineTo(h, h - w); g.lineTo(h + l, h); g.lineTo(h, h + w); g.closePath(); g.fill();
    }
  });
}
export function smokeTexture() {
  return canvasTex('smoke', 64, (g, s) => {
    const R = rng(5);
    for (let i = 0; i < 7; i++) {
      const x = s * (0.32 + R() * 0.36), y = s * (0.32 + R() * 0.36), r = s * (0.16 + R() * 0.14);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }
  });
}
function runeTexture() {
  return canvasTex('runes', 256, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(120,240,255,1)'; g.shadowBlur = 14;
    g.fillStyle = 'rgba(210,255,255,1)';
    const L = ['א', 'ש', 'ת', 'ק', 'ל', 'מ', 'ה', 'ע', 'ד', 'ר', 'ט', 'צ'];
    const R = rng(9);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        g.font = `bold ${44 + Math.floor(R() * 10)}px serif`;
        g.fillText(L[Math.floor(R() * L.length)], s * (0.22 + col * 0.28), s * (0.14 + row * 0.24));
      }
    }
    g.shadowBlur = 0; g.fillRect(s * 0.1, s * 0.94, s * 0.8, 4);
  });
}

const _glowMats = new Map();
/** Additive glow sprite. unique=true → own material (for per-instance opacity animation). */
export function glow(color, size, opacity = 0.8, unique = false) {
  const key = color + '|' + opacity;
  let m = unique ? null : _glowMats.get(key);
  if (!m) {
    m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    if (!unique) _glowMats.set(key, m);
  }
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  s.renderOrder = 3;
  return s;
}
function sparkle(color, size) {
  const m = new THREE.SpriteMaterial({ map: sparkleTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  s.renderOrder = 4;
  return s;
}

// ---------------------------------------------------------------------------
//  Geometry builder: merges static parts per material
// ---------------------------------------------------------------------------
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _sv = new THREE.Vector3();
function compose(p, r, s) {
  _e.set(r ? r[0] || 0 : 0, r ? r[1] || 0 : 0, r ? r[2] || 0 : 0);
  _q.setFromEuler(_e);
  if (s == null) _sv.set(1, 1, 1); else if (typeof s === 'number') _sv.set(s, s, s); else _sv.set(s[0], s[1], s[2]);
  return new THREE.Matrix4().compose(_v.set(p ? p[0] || 0 : 0, p ? p[1] || 0 : 0, p ? p[2] || 0 : 0), _q, _sv);
}
function prep(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
/** Displace vertices pseudo-randomly (consistent for shared positions). */
export function jitter(geo, amt, seed = 1, ay = 1) {
  const g = prep(geo);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i,
      x + (hash3(x, y, z, seed) - 0.5) * 2 * amt,
      y + (hash3(y, z, x, seed + 3) - 0.5) * 2 * amt * ay,
      z + (hash3(z, x, y, seed + 7) - 0.5) * 2 * amt);
  }
  g.computeVertexNormals();
  return g;
}

/** Triangular prism: triangle (-w/2,0)-(w/2,0)-(0,h) in XY, extruded along Z (depth d). */
export function prismGeo(w, h, d) {
  const hw = w / 2, hd = d / 2;
  const v = [
    -hw, 0, hd, hw, 0, hd, 0, h, hd,
    hw, 0, -hd, -hw, 0, -hd, 0, h, -hd,
    -hw, 0, hd, 0, h, hd, 0, h, -hd, -hw, 0, hd, 0, h, -hd, -hw, 0, -hd,
    hw, 0, hd, hw, 0, -hd, 0, h, -hd, hw, 0, hd, 0, h, -hd, 0, h, hd,
    -hw, 0, hd, -hw, 0, -hd, hw, 0, -hd, -hw, 0, hd, hw, 0, -hd, hw, 0, hd,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export class Builder {
  constructor() { this.groups = new Map(); this.stack = [new THREE.Matrix4()]; }
  top() { return this.stack[this.stack.length - 1]; }
  push(p, r, s) { this.stack.push(this.top().clone().multiply(compose(p, r, s))); return this; }
  pop() { this.stack.pop(); return this; }
  add(geo, material, p, r, s) {
    const g = prep(geo);
    g.applyMatrix4(this.top().clone().multiply(compose(p, r, s)));
    let arr = this.groups.get(material);
    if (!arr) this.groups.set(material, (arr = []));
    arr.push(g);
    return this;
  }
  /** center-based box */
  box(m, w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { return this.add(new THREE.BoxGeometry(w, h, d), m, [x, y, z], [rx, ry, rz]); }
  /** base-based box (y = bottom) */
  boxB(m, w, h, d, x = 0, y = 0, z = 0, ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), m, [x, y + h / 2, z], [0, ry, 0]); }
  /** base-based cylinder */
  cylB(m, rt, rb, h, x = 0, y = 0, z = 0, seg = 8, ry = 0) { const s = seg >= 8 ? Math.max(seg, 14) : seg; return this.add(new THREE.CylinderGeometry(rt, rb, h, s), m, [x, y + h / 2, z], [0, ry, 0]); }
  /** center-based cylinder with rotation */
  cyl(m, rt, rb, h, x = 0, y = 0, z = 0, seg = 8, rx = 0, ry = 0, rz = 0) { const s = seg >= 8 ? Math.max(seg, 14) : seg; return this.add(new THREE.CylinderGeometry(rt, rb, h, s), m, [x, y, z], [rx, ry, rz]); }
  coneB(m, r, h, x = 0, y = 0, z = 0, seg = 8, ry = 0) { const s = seg >= 8 ? Math.max(seg, 14) : seg; return this.add(new THREE.ConeGeometry(r, h, s), m, [x, y + h / 2, z], [0, ry, 0]); }
  sph(m, r, x = 0, y = 0, z = 0, detail = 0, s) { return this.add(new THREE.IcosahedronGeometry(r, detail), m, [x, y, z], null, s); }
  /** gable roof, ridge along X (gable ends face ±X) unless alongZ */
  roof(m, w, h, d, x = 0, y = 0, z = 0, ridgeAlongZ = false) {
    return ridgeAlongZ ? this.add(prismGeo(w, h, d), m, [x, y, z]) : this.add(prismGeo(d, h, w), m, [x, y, z], [0, PI / 2, 0]);
  }
  /** square pyramid roof, base at y */
  pyramid(m, half, h, x = 0, y = 0, z = 0) { return this.add(new THREE.ConeGeometry(half * Math.SQRT2, h, 4), m, [x, y + h / 2, z], [0, PI / 4, 0]); }
  parts() {
    const out = [];
    for (const [m, arr] of this.groups) {
      const g = arr.length === 1 ? arr[0] : mergeGeometries(arr, false);
      g.computeVertexNormals();
      const p = g.attributes.position, n = g.attributes.normal;
      const uvs = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
        if (ny > nx && ny > nz) { uvs[i * 2] = x * 2.2; uvs[i * 2 + 1] = z * 2.2; }
        else if (nx > nz) { uvs[i * 2] = z * 2.2; uvs[i * 2 + 1] = y * 2.2; }
        else { uvs[i * 2] = x * 2.2; uvs[i * 2 + 1] = y * 2.2; }
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      g.computeBoundingSphere(); g.computeBoundingBox();
      out.push({ geometry: g, material: m });
    }
    return out;
  }
}

const _static = new Map();
function staticParts(key, fn) {
  let p = _static.get(key);
  if (!p) { const b = new Builder(); fn(b); p = b.parts(); _static.set(key, p); }
  return p;
}
function addParts(target, parts) {
  for (const { geometry, material } of parts) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = !material.transparent;
    m.receiveShadow = true;
    target.add(m);
  }
  return target;
}
/** Instantiate a cached static model into a new Group. */
export function cachedGroup(key, fn) { return addParts(new THREE.Group(), staticParts(key, fn)); }

// ---------------------------------------------------------------------------
//  Flags / banners with GPU wave (shared TIME uniform)
// ---------------------------------------------------------------------------
const _flagMats = new Map();
export function flagMat(color, mode = 'flag') {
  const key = color + '|' + mode;
  let m = _flagMats.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, flatShading: true, roughness: 0.85 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float fph = modelMatrix[3].x * 1.7 + modelMatrix[3].z * 2.3 + modelMatrix[3].y * 3.1;
      ${mode === 'flag'
        ? 'float fk = max(transformed.x, 0.0); transformed.z += sin(uTime * 5.0 - transformed.x * 7.0 + fph) * 0.13 * fk; transformed.y += sin(uTime * 3.3 - transformed.x * 5.0 + fph) * 0.035 * fk;'
        : 'float fk = max(-transformed.y, 0.0); transformed.z += sin(uTime * 2.4 + transformed.y * 4.0 + fph) * 0.09 * fk; transformed.x += sin(uTime * 1.7 + fph) * 0.025 * fk;'}
    `);
  };
  m.customProgramCacheKey = () => 'flagwave_' + mode;
  _flagMats.set(key, m);
  return m;
}
let _flagGeo, _bannerGeo, _pennantGeo;
export function flagGeo() {
  if (!_flagGeo) _flagGeo = new THREE.PlaneGeometry(1, 0.62, 8, 3).translate(0.5, 0, 0);
  return _flagGeo;
}
/** pennant: triangular flag, pole edge at x=0 */
function pennantGeo() {
  if (!_pennantGeo) {
    const g = new THREE.PlaneGeometry(1, 0.5, 8, 2).translate(0.5, 0, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * (1 - p.getX(i) * 0.92));
    _pennantGeo = g;
  }
  return _pennantGeo;
}
/** hanging banner: top edge at y=0, hangs down to y≈-1.15 with a point */
export function bannerGeo() {
  if (!_bannerGeo) {
    const g = new THREE.PlaneGeometry(0.5, 1, 2, 6).translate(0, -0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.99 && Math.abs(p.getX(i)) < 0.01) p.setY(i, -1.18);
    _bannerGeo = g;
  }
  return _bannerGeo;
}
export const NEUTRAL_FLAG = '#dedbd2';
/** Creates a waving flag mesh (pole edge at local origin). */
export function makeFlag(color = NEUTRAL_FLAG, size = 0.3, pennant = false) {
  const f = new THREE.Mesh(pennant ? pennantGeo() : flagGeo(), flagMat(color, 'flag'));
  f.scale.setScalar(size);
  f.castShadow = true;
  return f;
}
export function makeBanner(color, size = 0.3) {
  const f = new THREE.Mesh(bannerGeo(), flagMat(color, 'banner'));
  f.scale.setScalar(size);
  f.castShadow = true;
  return f;
}
/** Adds pole geometry to a builder (pole base at x,z, height h). */
function polePart(b, x, z, h, y0 = 0) {
  b.cylB(mat(C.woodDark), 0.018, 0.024, h, x, y0, z, 6);
  b.sph(MAT.gold, 0.035, x, y0 + h + 0.02, z);
}

// ---------------------------------------------------------------------------
//  Smoke puffs (per-instance materials for fading)
// ---------------------------------------------------------------------------
function makeSmoke(group, x, y, z, o = {}) {
  const n = o.count ?? 4, size = o.size ?? 0.22, rise = o.rise ?? 0.8, color = o.color ?? '#b9b4ae', speed = o.speed ?? 0.35, op = o.opacity ?? 0.55;
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({ map: smokeTexture(), color, transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(m);
    s.renderOrder = 2;
    group.add(s);
    puffs.push({ s, off: i / n, drift: (i % 2 ? 1 : -1) * 0.1 });
  }
  const ph = Math.random();
  return (dt, t) => {
    for (const p of puffs) {
      const k = (t * speed + p.off + ph) % 1;
      p.s.position.set(x + Math.sin(k * 3 + p.off * 6) * 0.05 + k * p.drift + k * 0.12, y + k * rise, z);
      p.s.scale.setScalar(size * (0.45 + k * 1.3));
      p.s.material.opacity = op * Math.sin(Math.min(1, k * 1.15) * PI) * (o.fade ?? 1);
    }
  };
}

// ---------------------------------------------------------------------------
//  Small reusable parts
// ---------------------------------------------------------------------------
function logPart(b, len, r, x, y, z, ry = 0, rz = 0) {
  // log lying horizontally along X (rotated by ry)
  b.push([x, y, z], [0, ry, rz]);
  b.cyl(mat(C.bark), r, r, len, 0, 0, 0, 7, 0, 0, PI / 2);
  b.cyl(mat(C.logEnd), r * 0.82, r * 0.82, len + 0.012, 0, 0, 0, 7, 0, 0, PI / 2);
  b.pop();
}
function crystalPart(b, m, r, h, x, y, z, rx = 0, rz = 0, ry = 0) {
  b.push([x, y, z], [rx, ry, rz]);
  b.add(new THREE.CylinderGeometry(r, r * 0.85, h, 6), m, [0, h / 2, 0]);
  b.add(new THREE.ConeGeometry(r, r * 1.6, 6), m, [0, h + r * 0.8, 0]);
  b.pop();
}
function rockPart(b, m, r, x, y, z, s = [1, 0.75, 1], seed = 1, detail = 0) {
  b.add(jitter(new THREE.DodecahedronGeometry(r, detail), r * 0.18, seed), m, [x, y, z], [seed * 0.7, seed * 1.3, 0], s);
}
function coinPart(b, x, y, z, rx = 0, rz = 0, r = 0.05) {
  b.add(new THREE.CylinderGeometry(r, r, r * 0.32, 8), MAT.gold, [x, y, z], [rx, 0, rz]);
}
function stoneRing(b, R, n, r, m, seed = 3, y = 0) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    rockPart(b, m, r, Math.cos(a) * R, y + r * 0.45, Math.sin(a) * R, [1, 0.7, 1], seed + i);
  }
}
function grassPatch(b, R, n, seed, x0 = 0, z0 = 0) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = R * (0.4 + r() * 0.6);
    const x = x0 + Math.cos(a) * d, z = z0 + Math.sin(a) * d;
    for (let j = 0; j < 3; j++) b.add(new THREE.ConeGeometry(0.012, 0.09 + r() * 0.05, 3), mat(j ? C.leaf : C.leafL), [x + (j - 1) * 0.015, 0.05, z], [(r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6]);
  }
}
/** Fire: returns {group, update} (flames + glow), scaled by s. */
function makeFire(s = 1, color = '#ff7a1a') {
  const g = new THREE.Group();
  const flames = cachedGroup('fireflames', (b) => {
    b.add(new THREE.ConeGeometry(0.075, 0.24, 6), mat('#ff6a14', { e: '#ff5a00', ei: 1.6 }), [0, 0.12, 0]);
    b.add(new THREE.ConeGeometry(0.05, 0.17, 5), mat('#ff9b2a', { e: '#ff8a10', ei: 1.8 }), [0.035, 0.085, 0.02], [0, 0, -0.25]);
    b.add(new THREE.ConeGeometry(0.045, 0.15, 5), mat('#ff9b2a', { e: '#ff8a10', ei: 1.8 }), [-0.035, 0.075, -0.015], [0.2, 0, 0.3]);
    b.add(new THREE.ConeGeometry(0.04, 0.14, 5), mat('#ffe27a', { e: '#ffd040', ei: 2.2 }), [0, 0.07, 0.01]);
  });
  flames.children.forEach((m) => { m.castShadow = false; });
  g.add(flames);
  const gl = glow(color, 0.7 * s, 0.75, true);
  gl.position.y = 0.12;
  g.add(gl);
  g.scale.setScalar(s);
  const ph = Math.random() * 10;
  const update = (dt, t) => {
    const f = 1 + Math.sin(t * 13 + ph) * 0.08 + Math.sin(t * 23.7 + ph * 2) * 0.06;
    flames.scale.set(1 + Math.sin(t * 17 + ph) * 0.05, f, 1 + Math.cos(t * 15 + ph) * 0.05);
    flames.rotation.y = Math.sin(t * 3 + ph) * 0.3;
    gl.scale.setScalar(0.7 * (0.92 + Math.sin(t * 11 + ph) * 0.06 + Math.sin(t * 29 + ph) * 0.04));
    gl.material.opacity = 0.62 + Math.sin(t * 19 + ph) * 0.1;
  };
  return { group: g, update };
}

// ---------------------------------------------------------------------------
//  Resource piles
// ---------------------------------------------------------------------------
const RES_BUILD = {
  gold(b) {
    const R = rng(11);
    b.add(new THREE.SphereGeometry(0.21, 9, 4, 0, TAU, 0, PI / 2), MAT.goldDim, [0, 0, 0], null, [1, 0.62, 0.9]);
    for (let i = 0; i < 30; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * 0.22;
      const y = Math.max(0.012, (1 - (d / 0.23) ** 2) * 0.13) + 0.005;
      coinPart(b, Math.cos(a) * d, y, Math.sin(a) * d * 0.9, (R() - 0.5) * 0.9, (R() - 0.5) * 0.9, 0.048);
    }
    const ingot = new THREE.CylinderGeometry(0.06, 0.075, 0.055, 4).rotateY(PI / 4);
    for (const [x, z, ry, y] of [[0.17, 0.12, 0.4, 0.028], [-0.2, 0.08, -0.3, 0.028], [-0.03, 0.2, 0.1, 0.028], [-0.11, 0.13, -0.6, 0.075]]) {
      b.push([x, y, z], [0, ry, 0]); b.add(ingot, MAT.gold, null, null, [1.7, 1, 0.85]); b.pop();
    }
  },
  wood(b) {
    const rows = [[-0.16, -0.055, 0.055, 0.165], [-0.105, 0, 0.105], [-0.055, 0.055]];
    const r = 0.058;
    rows.forEach((row, ri) => row.forEach((x) => {
      b.push([x, r + ri * r * 1.72, 0], [0, 0, 0]);
      b.cyl(mat(C.bark), r, r, 0.5, 0, 0, 0, 7, PI / 2);
      b.cyl(mat(C.logEnd), r * 0.8, r * 0.8, 0.512, 0, 0, 0, 7, PI / 2);
      b.pop();
    }));
    b.boxB(mat(C.woodDark), 0.04, 0.2, 0.04, -0.24, 0, 0.12);
    b.boxB(mat(C.woodDark), 0.04, 0.2, 0.04, 0.24, 0, 0.12);
  },
  ore(b) {
    const R = rng(21);
    const rock = mat('#7d828b', { r: 0.9 }), rockD = mat('#5d626b');
    const pts = [[0, 0.1, -0.02, 0.15], [0.16, 0.07, 0.08, 0.1], [-0.16, 0.07, 0.07, 0.11], [0.05, 0.06, 0.17, 0.08], [-0.05, 0.2, 0.02, 0.09], [0.18, 0.05, -0.12, 0.08], [-0.17, 0.05, -0.12, 0.08]];
    pts.forEach(([x, y, z, r], i) => rockPart(b, i % 2 ? rockD : rock, r, x, y, z, [1, 0.8, 1], 10 + i));
    const fleck = mat('#e8eef5', { m: 0.4, r: 0.25, e: '#7f8b99', ei: 0.6 }), rust = mat('#c4683a', { e: '#4a1a05', ei: 0.4 });
    for (let i = 0; i < 16; i++) {
      const p = pts[i % pts.length], a = R() * TAU, el = R() * 1.2;
      b.add(new THREE.OctahedronGeometry(0.022 + R() * 0.012), i % 4 === 3 ? rust : fleck,
        [p[0] + Math.cos(a) * Math.cos(el) * p[3] * 0.9, p[1] + Math.sin(el) * p[3] * 0.7, p[2] + Math.sin(a) * Math.cos(el) * p[3] * 0.9], [R(), R(), R()]);
    }
    // pickaxe
    b.cyl(mat(C.woodLight), 0.012, 0.012, 0.32, 0.12, 0.03, 0.2, 5, PI / 2, 0, PI / 2.6);
    b.add(new THREE.BoxGeometry(0.2, 0.025, 0.03), MAT.iron, [0.24, 0.035, 0.26], [0, -0.85, 0.1]);
  },
  mercury(b) {
    // small crate
    b.boxB(mat(C.wood), 0.3, 0.13, 0.22, 0, 0, -0.05);
    b.boxB(mat(C.woodDark), 0.31, 0.025, 0.23, 0, 0.11, -0.05);
    const liquid = mat('#e6edf5', { m: 0.45, r: 0.12, e: '#7e8fa3', ei: 0.55 });
    const flask = (x, y, z, r, neck) => {
      b.sph(liquid, r * 0.84, x, y + r * 0.95, z, 1, [1, 0.85, 1]);
      b.sph(MAT.glass, r, x, y + r, z, 1);
      b.cylB(MAT.glass, r * 0.32, r * 0.38, neck, x, y + r * 1.8, z, 7);
      b.cylB(mat(C.woodLight), r * 0.36, r * 0.34, r * 0.4, x, y + r * 1.8 + neck, z, 6);
    };
    flask(0, 0.135, -0.05, 0.1, 0.1);
    flask(0.2, 0, 0.12, 0.075, 0.08);
    flask(-0.19, 0, 0.13, 0.065, 0.07);
  },
  sulfur(b) {
    const y = mat('#e9d22e', { e: '#4d3f00', ei: 0.35 }), y2 = mat('#c9a821', { e: '#2e2400', ei: 0.3 });
    b.add(jitter(new THREE.IcosahedronGeometry(0.24, 1), 0.035, 4), y, [0, 0, 0], null, [1, 0.62, 0.9]);
    b.add(jitter(new THREE.IcosahedronGeometry(0.11, 0), 0.02, 6), y2, [0.17, 0.03, 0.13], null, [1, 0.7, 1]);
    b.add(jitter(new THREE.IcosahedronGeometry(0.09, 0), 0.02, 7), y2, [-0.19, 0.03, 0.12], null, [1, 0.7, 1]);
    const cr = mat('#fff06a', { e: '#c9a400', ei: 0.6 });
    const R = rng(31);
    for (let i = 0; i < 7; i++) {
      const a = R() * TAU, d = 0.06 + R() * 0.13;
      b.add(new THREE.OctahedronGeometry(0.035 + R() * 0.02), cr, [Math.cos(a) * d, 0.1 + (0.2 - d) * 0.5, Math.sin(a) * d], [R(), R(), R()], [0.8, 1.5, 0.8]);
    }
  },
  crystal(b) {
    rockPart(b, mat('#5b5560'), 0.16, 0, 0.04, 0, [1.3, 0.4, 1.1], 3);
    const m = mat('#e8414c', { e: '#9a0a1a', ei: 0.75, r: 0.25 }), m2 = mat('#ff7b84', { e: '#b5202e', ei: 0.8, r: 0.2 });
    crystalPart(b, m, 0.06, 0.26, 0, 0.04, 0, 0, 0);
    crystalPart(b, m2, 0.045, 0.18, 0.08, 0.04, 0.03, 0.15, -0.45);
    crystalPart(b, m, 0.045, 0.16, -0.09, 0.04, 0.02, -0.1, 0.5);
    crystalPart(b, m2, 0.035, 0.12, 0.02, 0.04, 0.1, 0.55, 0.1);
    crystalPart(b, m, 0.035, 0.11, -0.03, 0.04, -0.09, -0.5, -0.1);
    crystalPart(b, m2, 0.03, 0.09, 0.16, 0.0, -0.06, 0.2, -0.8);
    crystalPart(b, m, 0.03, 0.08, -0.17, 0.0, 0.1, 0.4, 0.9);
  },
  gems(b) {
    b.add(new THREE.CylinderGeometry(0.2, 0.24, 0.05, 8), mat('#6d3a7a'), [0, 0.025, 0]);
    b.add(new THREE.TorusGeometry(0.215, 0.022, 4, 8), MAT.goldDim, [0, 0.045, 0], [PI / 2, 0, 0]);
    const G = mat('#36d46a', { e: '#0a6b28', ei: 0.7, r: 0.2 }), B = mat('#3f8cff', { e: '#0b2f8a', ei: 0.7, r: 0.2 }), P = mat('#b65cff', { e: '#4c0f8a', ei: 0.7, r: 0.2 }), W = mat('#e9fbff', { e: '#5a7f8a', ei: 0.6, r: 0.15 });
    const brill = (m, x, y, z, s, rx = 0, rz = 0) => {
      b.push([x, y, z], [rx, 0, rz], s);
      b.add(new THREE.ConeGeometry(0.06, 0.06, 8), m, [0, 0.03, 0], [PI, 0, 0]);
      b.add(new THREE.CylinderGeometry(0.035, 0.06, 0.025, 8), m, [0, 0.0725, 0]);
      b.pop();
    };
    b.add(new THREE.OctahedronGeometry(0.075), G, [0, 0.12, 0], [0, 0.3, 0], [1, 1.25, 1]);
    b.add(new THREE.IcosahedronGeometry(0.06), B, [0.11, 0.1, 0.06]);
    brill(P, -0.11, 0.05, 0.07, 1.1, 0.2, 0.3);
    b.add(new THREE.OctahedronGeometry(0.05), G, [-0.05, 0.08, 0.15], [0.4, 0.2, 0], [1, 1.2, 1]);
    brill(B, 0.07, 0.05, -0.1, 0.9, -0.3, 0);
    b.add(new THREE.OctahedronGeometry(0.048), P, [0.15, 0.07, -0.05], [0.3, 0, 0.5]);
    b.add(new THREE.IcosahedronGeometry(0.04), W, [-0.13, 0.07, -0.07]);
    brill(G, 0.03, 0.06, 0.15, 0.8, 0.5, -0.2);
  },
};
const RES_GLOW = { gold: '#ffd76a', wood: null, ore: '#cfd8e6', mercury: '#c9dcff', sulfur: '#ffe95a', crystal: '#ff4b5a', gems: '#7dffb0' };

function buildResource(obj) {
  const r = RES_BUILD[obj.resource] ? obj.resource : 'gold';
  const g = cachedGroup('res_' + r, RES_BUILD[r]);
  const anims = [];
  const gc = RES_GLOW[r];
  if (gc) {
    const gl = glow(gc, r === 'crystal' ? 0.75 : 0.55, r === 'crystal' ? 0.5 : 0.32, true);
    gl.position.y = r === 'mercury' ? 0.28 : 0.14;
    g.add(gl);
    const ph = Math.random() * 10;
    anims.push((dt, t) => { gl.material.opacity = (r === 'crystal' ? 0.45 : 0.28) + Math.sin(t * 2.2 + ph) * 0.12; });
  }
  if (r === 'gold' || r === 'gems' || r === 'ore' || r === 'crystal') addTwinkles(g, anims, r === 'gems' ? '#d8fff0' : '#fff6cf', 3, 0.22, 0.1, 0.22);
  g.userData.height = 0.35;
  return finish(g, anims);
}
function addTwinkles(g, anims, color, n, spread, y0, yr, size = 0.14) {
  const sp = [];
  for (let i = 0; i < n; i++) {
    const s = sparkle(color, size);
    s.position.set((Math.random() - 0.5) * 2 * spread, y0 + Math.random() * yr, (Math.random() - 0.2) * spread);
    g.add(s);
    sp.push({ s, ph: Math.random() * 10, sp: 1.5 + Math.random() * 1.5, base: s.position.clone() });
  }
  anims.push((dt, t) => {
    for (const p of sp) {
      const k = Math.max(0, Math.sin(t * p.sp + p.ph));
      const v = k ** 6;
      p.s.scale.setScalar(size * (0.15 + v));
      p.s.material.opacity = v;
      p.s.material.rotation = t * 0.8 + p.ph;
      if (k < 0.02) { p.s.position.set(p.base.x + (Math.random() - 0.5) * 0.08, p.base.y + (Math.random() - 0.5) * 0.06, p.base.z); }
    }
  });
}
function finish(g, anims) {
  g.userData.update = (dt, t) => { TIME.value = t; for (const a of anims) a(dt, t); };
  return g;
}

// ---------------------------------------------------------------------------
//  Chest, campfire
// ---------------------------------------------------------------------------
function buildChest() {
  const g = cachedGroup('chest', (b) => {
    const w = mat('#8a5228'), wd = mat('#5e3618');
    b.boxB(w, 0.5, 0.25, 0.32, 0, 0, 0);
    b.boxB(wd, 0.51, 0.03, 0.33, 0, 0, 0);
    // gold inside
    b.add(new THREE.SphereGeometry(0.2, 8, 3, 0, TAU, 0, PI / 2), MAT.gold, [0, 0.215, 0], null, [1.15, 0.35, 0.72]);
    for (const x of [-0.17, 0.17]) b.boxB(MAT.gold, 0.035, 0.256, 0.335, x, 0, 0);
    b.boxB(MAT.gold, 0.07, 0.08, 0.02, 0, 0.16, 0.165);
    b.boxB(MAT.dark, 0.02, 0.03, 0.005, 0, 0.18, 0.176);
    // lid (hinged at back-top, opened)
    b.push([0, 0.25, -0.16], [-0.62, 0, 0]);
    b.box(w, 0.5, 0.05, 0.32, 0, 0.025, 0.16);
    b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 8, 1, false, 0, PI), w, [0, 0.05, 0.16], [0, 0, PI / 2], [1, 1, 0.55]);
    for (const x of [-0.17, 0.17]) b.add(new THREE.CylinderGeometry(0.163, 0.163, 0.036, 8, 1, false, 0, PI), MAT.gold, [x, 0.05, 0.16], [0, 0, PI / 2], [1, 1, 0.56]);
    b.pop();
    coinPart(b, 0.22, 0.012, 0.2, 0, 0, 0.04);
    coinPart(b, 0.3, 0.012, 0.12, 0.2, 0, 0.04);
    coinPart(b, -0.27, 0.012, 0.19, 0, 0.1, 0.04);
  });
  const anims = [];
  const gl = glow('#ffcf5a', 0.6, 0.5, true);
  gl.position.set(0, 0.32, 0);
  g.add(gl);
  const ph = Math.random() * 10;
  anims.push((dt, t) => { gl.material.opacity = 0.38 + Math.sin(t * 2 + ph) * 0.12; gl.scale.setScalar(0.55 + Math.sin(t * 1.3 + ph) * 0.04); });
  addTwinkles(g, anims, '#fff2c0', 2, 0.15, 0.25, 0.1);
  g.userData.height = 0.45;
  return finish(g, anims);
}

function buildCampfire() {
  const g = cachedGroup('campfire', (b) => {
    stoneRing(b, 0.17, 8, 0.045, mat('#8b8680'), 40);
    b.add(new THREE.CylinderGeometry(0.15, 0.16, 0.012, 8), mat('#2a2220'), [0, 0.006, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.3;
      b.push([Math.cos(a) * 0.07, 0.06, Math.sin(a) * 0.07], [0, -a, 0]);
      b.cyl(mat(C.bark), 0.022, 0.026, 0.2, 0, 0, 0, 6, 0, 0, 1.05);
      b.pop();
    }
    for (let i = 0; i < 5; i++) b.sph(mat('#ff6a1a', { e: '#ff3c00', ei: 1.2 }), 0.02, Math.cos(i * 1.3) * 0.07, 0.015, Math.sin(i * 1.3) * 0.07);
    // resources left beside the fire: logs + sack of gold
    logPart(b, 0.32, 0.04, -0.3, 0.04, 0.14, 0.4);
    logPart(b, 0.3, 0.038, -0.31, 0.04, 0.24, 0.3);
    logPart(b, 0.28, 0.036, -0.3, 0.11, 0.19, 0.35);
    const sack = mat('#b08a55');
    b.sph(sack, 0.1, 0.3, 0.085, 0.15, 1, [1, 0.9, 1]);
    b.cylB(sack, 0.03, 0.05, 0.06, 0.3, 0.16, 0.15, 6);
    b.add(new THREE.TorusGeometry(0.035, 0.01, 4, 8), mat(C.rope), [0.3, 0.19, 0.15], [PI / 2, 0, 0]);
    b.add(new THREE.SphereGeometry(0.06, 7, 3, 0, TAU, 0, PI / 2), MAT.gold, [0.31, 0.15, 0.17], null, [1, 0.5, 1]);
    for (let i = 0; i < 4; i++) coinPart(b, 0.2 + i * 0.05, 0.01, 0.28 - i * 0.02, 0.1 * i, 0, 0.035);
    b.add(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 7), mat('#6c6f75', { m: 0.3 }), [0.08, 0.04, -0.27]); // pot
    b.add(new THREE.CylinderGeometry(0.0, 0.02, 0.3, 4), mat(C.woodDark), [-0.12, 0.13, -0.24], [0.3, 0, 0.4]);
  });
  const fire = makeFire(1);
  fire.group.position.y = 0.02;
  g.add(fire.group);
  const anims = [fire.update, makeSmoke(g, 0, 0.32, 0, { count: 4, size: 0.2, rise: 0.75, opacity: 0.4 })];
  g.userData.height = 0.4;
  return finish(g, anims);
}

// ---------------------------------------------------------------------------
//  Artifact (floating icon by slot on a small plinth)
// ---------------------------------------------------------------------------
function artifactIcon(b, a) {
  const id = a?.id || '', slot = a?.slot || 'misc';
  const gold = MAT.gold, steel = MAT.steel;
  const rc = RARITY_COLORS[a?.rarity || 'minor'];
  const gem = mat(rc, { e: rc, ei: 0.8, r: 0.2 });
  if (slot === 'weapon' && id === 'giantAxe') {
    b.cyl(mat(C.woodDark), 0.018, 0.018, 0.42, 0, 0, 0, 6);
    b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.025, 8, 1, false, -PI / 2, PI), steel, [0.0, 0.13, 0], [PI / 2, 0, 0], [1, 1, 1]);
    b.sph(gem, 0.025, 0, 0.13, 0.02);
  } else if (slot === 'weapon' && id === 'davidsSling') {
    b.add(new THREE.TorusGeometry(0.12, 0.012, 4, 12, PI), mat('#9a6a3a'), [0, 0.05, 0], [0, 0, PI]);
    b.add(new THREE.SphereGeometry(0.045, 8, 6), mat('#7a6a5a'), [0, -0.075, 0], null, [1, 0.6, 0.7]);
    b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.16), mat(C.rope), [-0.12, 0.13, 0]);
    b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.16), mat(C.rope), [0.12, 0.13, 0]);
    b.sph(gem, 0.03, 0, 0.22, 0);
  } else if (slot === 'weapon') {
    b.add(new THREE.BoxGeometry(0.045, 0.34, 0.014), steel, [0, 0.06, 0]);
    b.add(new THREE.ConeGeometry(0.032, 0.06, 4), steel, [0, 0.26, 0], [0, PI / 4, 0], [1, 1, 0.3]);
    b.add(new THREE.BoxGeometry(0.17, 0.03, 0.035), gold, [0, -0.12, 0]);
    b.cyl(mat('#5a2d1a'), 0.016, 0.016, 0.1, 0, -0.18, 0, 6);
    b.sph(gem, 0.028, 0, -0.245, 0);
  } else if (slot === 'shield') {
    const face = mat(id === 'dragonShield' ? '#3c8a5a' : '#b33a35');
    b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 10), face, [0, 0, 0], [PI / 2, 0, 0], [1, 1, 1.25]);
    b.add(new THREE.TorusGeometry(0.16, 0.016, 4, 10), gold, [0, 0, 0], null, [1, 1.25, 1]);
    b.sph(gold, 0.045, 0, 0.0, 0.02, 0, [1, 1, 0.6]);
    b.sph(gem, 0.022, 0, 0.0, 0.045);
  } else if (slot === 'head' && (id === 'kingsCrown' || id === 'crownOfWisdom')) {
    b.add(new THREE.CylinderGeometry(0.13, 0.12, 0.09, 10, 1, true), mat('#f3bd3c', { m: 0.35, r: 0.32, e: '#7a4d00', ei: 0.55, ds: true }), [0, 0, 0]);
    for (let i = 0; i < 6; i++) {
      const an = (i / 6) * TAU;
      b.add(new THREE.ConeGeometry(0.03, 0.09, 4), gold, [Math.sin(an) * 0.125, 0.085, Math.cos(an) * 0.125]);
      b.sph(gem, 0.018, Math.sin(an) * 0.13, 0, Math.cos(an) * 0.13);
    }
  } else if (slot === 'head') {
    b.add(new THREE.SphereGeometry(0.13, 10, 6, 0, TAU, 0, PI * 0.6), steel, [0, -0.02, 0]);
    b.box(steel, 0.025, 0.12, 0.03, 0, -0.06, 0.12);
    b.add(new THREE.TorusGeometry(0.125, 0.012, 4, 12), gold, [0, -0.03, 0], [PI / 2, 0, 0]);
    b.add(new THREE.ConeGeometry(0.03, 0.16, 5), mat('#c22e2e'), [0, 0.17, -0.02], [-0.35, 0, 0]);
  } else if (slot === 'torso') {
    const m = id === 'wizardCoat' ? mat('#3b3f9a') : steel;
    b.add(new THREE.CylinderGeometry(0.13, 0.095, 0.26, 6), m, [0, 0, 0], null, [1, 1, 0.6]);
    b.sph(m, 0.06, -0.13, 0.1, 0, 0);
    b.sph(m, 0.06, 0.13, 0.1, 0, 0);
    b.box(gold, 0.2, 0.025, 0.12, 0, -0.06, 0.01);
    b.sph(gem, 0.025, 0, 0.06, 0.07);
  } else if (slot === 'neck') {
    b.add(new THREE.TorusGeometry(0.11, 0.01, 4, 14), gold, [0, 0.05, 0]);
    b.add(new THREE.OctahedronGeometry(0.055), gem, [0, -0.08, 0.01], null, [1, 1.3, 0.6]);
    b.add(new THREE.TorusGeometry(0.05, 0.01, 4, 8), gold, [0, -0.08, 0.01]);
  } else if (slot === 'ring') {
    b.add(new THREE.TorusGeometry(0.1, 0.022, 5, 14), gold, [0, 0, 0], [0.4, 0, 0]);
    b.add(new THREE.OctahedronGeometry(0.05), gem, [0, 0.12, 0.04]);
  } else if (slot === 'feet') {
    const lth = mat(id === 'bootsOfSpeed' ? '#2f6db5' : '#8a5a32');
    b.box(lth, 0.09, 0.2, 0.1, 0, 0.04, -0.02);
    b.box(lth, 0.1, 0.07, 0.2, 0, -0.08, 0.03);
    b.box(gold, 0.1, 0.025, 0.11, 0, 0.13, -0.02);
    b.add(new THREE.ConeGeometry(0.04, 0.12, 3), mat('#ffffff', { e: '#9fd0ff', ei: 0.5 }), [-0.06, 0.08, -0.04], [0, 0, 1.2], [0.6, 1, 1]);
  } else if (slot === 'cape') {
    b.add(new THREE.CylinderGeometry(0.08, 0.17, 0.32, 10, 1, true, PI * 0.6, PI * 0.8), mat(id === 'shadowCloak' ? '#3a2f4a' : '#b0232f', { ds: true }), [0, 0, 0], [0, PI, 0]);
    b.sph(gold, 0.03, 0, 0.15, 0.06);
  } else if (id === 'shofar') {
    b.add(new THREE.TorusGeometry(0.11, 0.025, 6, 12, PI * 1.1), mat('#d8b67a'), [0, 0, 0]);
    b.add(new THREE.ConeGeometry(0.06, 0.1, 8, 1, true), mat('#d8b67a', { ds: true }), [0.11, -0.02, 0], [0, 0, 0]);
    b.add(new THREE.TorusGeometry(0.03, 0.008, 4, 8), gold, [-0.0, 0.11, 0], [0, PI / 2, 0]);
  } else if (id === 'fireTome') {
    b.box(mat('#a3241c'), 0.2, 0.26, 0.06, 0, 0, 0);
    b.box(mat(C.cream), 0.19, 0.24, 0.065, 0.008, 0, 0);
    b.box(gold, 0.08, 0.08, 0.07, 0, 0.02, 0);
    b.sph(mat('#ff7a1a', { e: '#ff5a00', ei: 1.4 }), 0.03, 0, 0.02, 0.04);
  } else if (id === 'goldSack') {
    b.sph(mat('#b08a55'), 0.12, 0, -0.03, 0, 1);
    b.cyl(mat('#b08a55'), 0.03, 0.05, 0.06, 0, 0.1, 0, 6);
    b.add(new THREE.SphereGeometry(0.07, 8, 3, 0, TAU, 0, PI / 2), gold, [0, 0.12, 0], null, [1, 0.5, 1]);
  } else if (id === 'spyglass') {
    b.cyl(mat('#7a4a2a'), 0.035, 0.035, 0.18, -0.05, 0, 0, 8, 0, 0, PI / 2.4);
    b.cyl(gold, 0.028, 0.028, 0.14, 0.08, 0.05, 0, 8, 0, 0, PI / 2.4);
    b.add(new THREE.TorusGeometry(0.036, 0.008, 4, 8), gold, [-0.13, -0.035, 0], [0, PI / 2, 0.4]);
  } else {
    b.sph(gem, 0.1, 0, 0, 0, 1);
    b.add(new THREE.TorusGeometry(0.13, 0.012, 4, 12), gold, [0, 0, 0], [PI / 2, 0, 0]);
  }
}
function buildArtifact(obj) {
  const a = ARTIFACTS[obj.artifact] || { rarity: 'minor', slot: 'misc', id: 'orb' };
  const rc = RARITY_COLORS[a.rarity] || RARITY_COLORS.minor;
  const g = cachedGroup('artifact_base_' + a.rarity, (b) => {
    b.cylB(mat('#9d968a'), 0.13, 0.17, 0.06, 0, 0, 0, 8);
    b.cylB(mat('#b9b2a4'), 0.11, 0.13, 0.03, 0, 0.06, 0, 8);
    b.add(new THREE.TorusGeometry(0.135, 0.012, 4, 16), mat(rc, { e: rc, ei: 1.2 }), [0, 0.07, 0], [PI / 2, 0, 0]);
  });
  const icon = cachedGroup('artifact_icon_' + (a.id || 'x'), (b) => artifactIcon(b, a));
  icon.position.y = 0.38;
  icon.rotation.x = -0.25;
  g.add(icon);
  const gl = glow(rc, 0.7, 0.55, true);
  gl.position.y = 0.38;
  g.add(gl);
  const anims = [];
  const ph = Math.random() * 10;
  const sp = [];
  for (let i = 0; i < 3; i++) { const s = sparkle(rc, 0.1); g.add(s); sp.push(s); }
  anims.push((dt, t) => {
    icon.position.y = 0.38 + Math.sin(t * 2 + ph) * 0.04;
    icon.rotation.y = Math.sin(t * 0.9 + ph) * 0.9;
    gl.position.y = icon.position.y;
    gl.material.opacity = 0.45 + Math.sin(t * 3 + ph) * 0.12;
    sp.forEach((s, i) => {
      const an = t * 1.4 + (i * TAU) / 3 + ph;
      s.position.set(Math.cos(an) * 0.2, 0.3 + Math.sin(t * 2.3 + i * 2) * 0.12, Math.sin(an) * 0.2);
      const v = 0.5 + 0.5 * Math.sin(t * 5 + i * 2.1);
      s.scale.setScalar(0.05 + v * 0.08);
    });
  });
  g.userData.height = 0.55;
  return finish(g, anims);
}

// ---------------------------------------------------------------------------
//  Owner flag (flaggables)
// ---------------------------------------------------------------------------
function addOwnerFlag(g, x, z, h, size = 0.26, y0 = 0) {
  const f = makeFlag(NEUTRAL_FLAG, size);
  f.position.set(x + 0.018, y0 + h - size * 0.31, z);
  g.add(f);
  g.userData.flagMeshes = [f];
  g.userData.setOwnerColor = (c) => { f.material = flagMat(c || NEUTRAL_FLAG); };
}

// ---------------------------------------------------------------------------
//  Mines
// ---------------------------------------------------------------------------
function rockHill(b, m1, m2, seed = 1, scale = 1) {
  const s = scale;
  const blobs = [
    [-0.27, 0.16, -0.22, 0.27, m1], [0.25, 0.17, -0.24, 0.28, m2], [0, 0.3, -0.3, 0.3, m1],
    [-0.4, 0.07, 0.02, 0.17, m2], [0.4, 0.07, 0.0, 0.17, m1], [-0.2, 0.42, -0.36, 0.2, m2], [0.18, 0.44, -0.38, 0.18, m1],
    [-0.2, 0.12, 0.0, 0.14, m1], [0.21, 0.12, -0.0, 0.14, m2],
  ];
  blobs.forEach(([x, y, z, r, m], i) => b.add(jitter(new THREE.IcosahedronGeometry(r * s, 1), r * s * 0.16, seed + i), m, [x * s, y * s, z * s], [i, i * 2, 0], [1, 0.82, 0.9]));
}
function mineEntrance(b, z = 0.05, w = 0.26, h = 0.3) {
  const tim = mat(C.wood);
  b.boxB(MAT.dark, w, h, 0.16, 0, 0, z - 0.09);
  b.boxB(tim, 0.05, h, 0.05, -w / 2 - 0.02, 0, z);
  b.boxB(tim, 0.05, h, 0.05, w / 2 + 0.02, 0, z);
  b.box(tim, w + 0.16, 0.055, 0.07, 0, h + 0.02, z);
  b.box(mat(C.woodDark), 0.03, 0.12, 0.02, -w / 2 + 0.01, h * 0.9, z + 0.03, 0, 0, 0.7);
  b.box(mat(C.woodDark), 0.03, 0.12, 0.02, w / 2 - 0.01, h * 0.9, z + 0.03, 0, 0, -0.7);
}
function rails(b, z0, z1) {
  const len = z1 - z0, zc = (z0 + z1) / 2;
  for (const x of [-0.065, 0.065]) b.boxB(MAT.iron, 0.02, 0.022, len, x, 0.022, zc);
  for (let z = z0 + 0.03; z < z1; z += 0.085) b.boxB(mat(C.woodDark), 0.2, 0.022, 0.04, 0, 0, z);
}
function minecart(b, x, z, load) {
  b.push([x, 0.04, z]);
  b.add(new THREE.CylinderGeometry(0.13, 0.095, 0.12, 4).rotateY(PI / 4), mat('#6b4a2e'), [0, 0.1, 0], null, [1, 1, 0.78]);
  b.box(MAT.iron, 0.19, 0.02, 0.15, 0, 0.155, 0);
  for (const sx of [-0.075, 0.075]) for (const sz of [-0.055, 0.055]) b.cyl(MAT.iron, 0.03, 0.03, 0.02, sx, 0.03, sz, 8, 0, 0, PI / 2);
  load(b);
  b.pop();
}
function lantern(b, x, z, h = 0.38) {
  b.cylB(mat(C.woodDark), 0.012, 0.014, h, x, 0, z, 5);
  b.box(mat(C.woodDark), 0.08, 0.012, 0.012, x + 0.03, h, z);
  b.boxB(mat('#ffcf6a', { e: '#ff9a20', ei: 1.4 }), 0.03, 0.04, 0.03, x + 0.06, h - 0.055, z);
}

const MINE_BUILD = {
  wood(b) {
    b.boxB(mat('#9c7a52'), 0.92, 0.04, 0.7, 0, 0, -0.05);
    // shed
    for (const [x, z] of [[-0.42, -0.34], [0.12, -0.34], [-0.42, 0.1], [0.12, 0.1]]) b.boxB(mat(C.woodDark), 0.05, 0.42, 0.05, x, 0.04, z);
    b.boxB(mat(C.plank), 0.56, 0.36, 0.04, -0.15, 0.04, -0.36);
    b.boxB(mat(C.wood), 0.04, 0.3, 0.42, -0.44, 0.04, -0.13);
    b.push([-0.15, 0.46, -0.12]);
    b.box(mat('#9b5a30'), 0.68, 0.035, 0.36, 0, 0.06, -0.12, 0.42);
    b.box(mat('#8a4e28'), 0.68, 0.035, 0.36, 0, 0.06, 0.15, -0.42);
    b.box(mat(C.woodDark), 0.7, 0.04, 0.04, 0, 0.13, 0.015);
    b.pop();
    // bench + log being cut
    b.boxB(mat(C.wood), 0.5, 0.16, 0.12, -0.1, 0.04, -0.04);
    logPart(b, 0.62, 0.05, -0.12, 0.25, -0.04, 0);
    // log pile
    for (const [x, y, z] of [[0.3, 0.09, 0.2], [0.3, 0.09, 0.3], [0.3, 0.09, 0.1], [0.3, 0.17, 0.25], [0.3, 0.17, 0.15]]) logPart(b, 0.3, 0.045, x, y, z, PI / 2);
    // saw-dust & small planks stack
    b.boxB(mat(C.plank), 0.3, 0.025, 0.08, -0.27, 0.04, 0.23, 0.1);
    b.boxB(mat(C.woodLight), 0.3, 0.025, 0.08, -0.26, 0.065, 0.23, 0.05);
    b.add(new THREE.SphereGeometry(0.08, 6, 3, 0, TAU, 0, PI / 2), mat('#e6c48a'), [0.15, 0.04, 0.12], null, [1, 0.35, 1]);
    polePart(b, 0.4, -0.3, 0.95);
  },
  ore(b) { mineBase(b, mat('#867f76'), mat('#6f6962'), false); },
  gold(b) { mineBase(b, mat('#957f62'), mat('#7a664d'), true); },
  mercury(b) {
    b.boxB(mat('#8e8678'), 0.86, 0.04, 0.7, 0, 0, -0.05);
    const wall = mat('#b9ad98');
    b.boxB(wall, 0.52, 0.38, 0.4, -0.12, 0.04, -0.17);
    b.boxB(mat('#8a7f6d'), 0.54, 0.05, 0.42, -0.12, 0.04, -0.17);
    b.roof(mat('#5b4e7a'), 0.6, 0.24, 0.48, -0.12, 0.42, -0.17);
    b.boxB(mat('#7a6f5e'), 0.1, 0.42, 0.1, 0.06, 0.42, -0.28);
    b.boxB(mat('#5e5548'), 0.13, 0.04, 0.13, 0.06, 0.84, -0.28);
    b.boxB(mat(C.woodDark), 0.12, 0.2, 0.02, -0.2, 0.04, 0.035);
    b.add(new THREE.CircleGeometry(0.055, 8), mat('#9ffff0', { e: '#30d0c0', ei: 1.3 }), [0.03, 0.3, 0.032]);
    b.add(new THREE.TorusGeometry(0.058, 0.012, 4, 8), mat(C.woodDark), [0.03, 0.3, 0.034]);
    // big alembic on stand
    b.push([0.27, 0.04, 0.12]);
    b.cylB(MAT.iron, 0.1, 0.12, 0.08, 0, 0, 0, 6);
    b.sph(mat('#ff7a2a', { e: '#ff4a00', ei: 1.3 }), 0.04, 0, 0.06, 0.07);
    const liquid = mat('#e6edf5', { m: 0.45, r: 0.12, e: '#8a9db3', ei: 0.6 });
    b.sph(liquid, 0.1, 0, 0.18, 0, 1, [1, 0.8, 1]);
    b.sph(MAT.glass, 0.12, 0, 0.2, 0, 1);
    b.cylB(MAT.glass, 0.03, 0.04, 0.15, 0, 0.3, 0, 6);
    b.add(new THREE.TorusGeometry(0.1, 0.014, 5, 10, PI), MAT.glass, [-0.1, 0.45, 0], [0, 0, 0]);
    b.pop();
    // flasks on a little table
    b.boxB(mat(C.wood), 0.26, 0.14, 0.14, -0.22, 0.04, 0.2);
    for (const [x, c] of [[-0.3, '#7dff9a'], [-0.22, '#d7e3f0'], [-0.14, '#b98cff']]) {
      b.sph(mat(c, { e: c, ei: 0.6, r: 0.2 }), 0.03, x, 0.21, 0.2);
      b.cylB(MAT.glass, 0.01, 0.012, 0.05, x, 0.235, 0.2, 5);
    }
    polePart(b, -0.4, -0.38, 1.0);
  },
  sulfur(b) {
    const y = mat('#e3c932', { e: '#3e3200', ei: 0.3 }), y2 = mat('#c9a528'), y3 = mat('#f0dc58', { e: '#4d4000', ei: 0.3 });
    b.add(jitter(new THREE.IcosahedronGeometry(0.42, 1), 0.06, 2), y, [0.0, 0, -0.12], null, [1.15, 0.55, 0.85]);
    b.add(jitter(new THREE.IcosahedronGeometry(0.25, 1), 0.04, 5), y2, [-0.3, 0, 0.12], null, [1, 0.5, 0.9]);
    b.add(jitter(new THREE.IcosahedronGeometry(0.22, 1), 0.04, 8), y3, [0.32, 0, 0.1], null, [1, 0.45, 1]);
    // vents
    for (const [x, yy, z] of [[-0.1, 0.2, 0.07], [0.15, 0.18, -0.02], [-0.05, 0.24, -0.25]]) {
      b.add(new THREE.CylinderGeometry(0.04, 0.07, 0.06, 7), mat('#6b5418'), [x, yy, z]);
      b.add(new THREE.CircleGeometry(0.035, 7), mat('#ffb21a', { e: '#ff7a00', ei: 1.5 }), [x, yy + 0.031, z], [-PI / 2, 0, 0]);
    }
    const cr = mat('#fff27a', { e: '#d0a800', ei: 0.7 });
    crystalPart(b, cr, 0.03, 0.08, 0.25, 0.1, 0.22, 0.3, -0.3);
    crystalPart(b, cr, 0.025, 0.06, 0.3, 0.08, 0.27, -0.2, 0.5);
    crystalPart(b, cr, 0.03, 0.07, -0.33, 0.08, 0.25, 0.2, 0.4);
    // bucket & shovel
    b.cylB(mat(C.wood), 0.05, 0.04, 0.08, 0.05, 0, 0.36, 8);
    b.add(new THREE.SphereGeometry(0.045, 6, 3, 0, TAU, 0, PI / 2), y3, [0.05, 0.075, 0.36], null, [1, 0.5, 1]);
    b.cyl(mat(C.woodLight), 0.01, 0.01, 0.3, -0.12, 0.13, 0.32, 5, 0.2, 0, 0.6);
    polePart(b, 0.42, -0.3, 0.95);
  },
  crystal(b) {
    const r1 = mat('#6b6070'), r2 = mat('#544b5a');
    rockHill(b, r1, r2, 30);
    mineEntrance(b, 0.07, 0.24, 0.27);
    const m = mat('#ec3e4c', { e: '#a00818', ei: 0.85, r: 0.25 }), m2 = mat('#ff7d88', { e: '#c01e30', ei: 0.9, r: 0.2 });
    crystalPart(b, m, 0.07, 0.36, -0.28, 0.25, -0.14, 0.1, 0.5);
    crystalPart(b, m2, 0.05, 0.24, -0.36, 0.18, -0.02, 0.3, 0.9);
    crystalPart(b, m, 0.08, 0.4, 0.07, 0.48, -0.36, -0.3, -0.2);
    crystalPart(b, m2, 0.05, 0.22, 0.32, 0.25, -0.12, 0.2, -0.7);
    crystalPart(b, m, 0.045, 0.18, 0.4, 0.12, 0.04, 0.2, -1.0);
    crystalPart(b, m2, 0.04, 0.14, -0.1, 0.45, -0.25, 0.4, 0.3);
    crystalPart(b, m, 0.05, 0.16, 0.2, 0.0, 0.3, 0.2, -0.3);
    crystalPart(b, m2, 0.035, 0.1, 0.27, 0.0, 0.34, 0.1, 0.6);
    crystalPart(b, m, 0.04, 0.12, -0.24, 0.0, 0.3, -0.1, 0.4);
    polePart(b, 0.42, 0.15, 0.95);
  },
  gems(b) {
    b.add(new THREE.CylinderGeometry(0.4, 0.42, 0.03, 12), mat('#7a8a5a'), [0, 0.015, -0.02]);
    b.add(new THREE.CylinderGeometry(0.31, 0.31, 0.02, 12), mat('#2f8fb0', { r: 0.1, e: '#0a4a66', ei: 0.5 }), [0, 0.032, -0.02]);
    stoneRing(b, 0.34, 13, 0.06, mat('#9a948a'), 60, 0.01);
    const G = mat('#30d66a', { e: '#078a30', ei: 0.85, r: 0.2 }), G2 = mat('#7dffaa', { e: '#14a048', ei: 0.9, r: 0.2 });
    crystalPart(b, G, 0.05, 0.16, -0.12, 0.02, -0.1, 0.2, 0.3);
    crystalPart(b, G2, 0.04, 0.12, -0.06, 0.02, -0.16, -0.2, -0.2);
    crystalPart(b, G, 0.06, 0.2, 0.36, 0.02, -0.24, 0.1, -0.4);
    crystalPart(b, G2, 0.04, 0.12, 0.42, 0.02, -0.12, 0.3, -0.6);
    b.add(new THREE.OctahedronGeometry(0.05), G2, [0.1, 0.05, 0.08], [0.3, 0.3, 0], [1, 1.2, 1]);
    b.add(new THREE.OctahedronGeometry(0.04), G, [-0.36, 0.06, 0.22], [0.3, 0.6, 0]);
    b.add(new THREE.OctahedronGeometry(0.035), G2, [-0.3, 0.06, 0.3], [0.1, 0.6, 0.4]);
    // reeds
    const R = rng(66);
    for (let i = 0; i < 7; i++) {
      const x = -0.36 + R() * 0.12, z = -0.32 + R() * 0.15, h = 0.2 + R() * 0.12;
      b.cylB(mat('#5d8a3a'), 0.006, 0.01, h, x, 0.02, z, 4);
      b.cylB(mat('#6a4425'), 0.014, 0.014, 0.05, x, 0.02 + h * 0.7, z, 5);
    }
    polePart(b, 0.42, 0.3, 0.9);
  },
};
function mineBase(b, r1, r2, isGold) {
  rockHill(b, r1, r2, isGold ? 20 : 10);
  b.add(new THREE.CylinderGeometry(0.34, 0.4, 0.03, 10), mat('#8a7a62'), [0, 0.015, 0.22], null, [1, 1, 0.7]);
  mineEntrance(b, 0.06);
  rails(b, 0.04, 0.48);
  minecart(b, 0.0, 0.3, (bb) => {
    if (isGold) {
      bb.add(new THREE.SphereGeometry(0.09, 8, 3, 0, TAU, 0, PI / 2), MAT.gold, [0, 0.15, 0], null, [1.05, 0.55, 0.8]);
      for (let i = 0; i < 4; i++) bb.add(new THREE.OctahedronGeometry(0.03), MAT.gold, [-0.06 + i * 0.04, 0.19, (i % 2) * 0.03 - 0.015], [i, i, 0]);
    } else {
      for (let i = 0; i < 5; i++) rockPart(bb, i % 2 ? mat('#7d828b') : mat('#646a73'), 0.04, -0.06 + i * 0.03, 0.17 + (i % 2) * 0.02, (i % 3 - 1) * 0.03, [1, 0.8, 1], 70 + i);
      bb.add(new THREE.OctahedronGeometry(0.018), mat('#e8eef5', { e: '#7f8b99', ei: 0.6 }), [0.02, 0.21, 0.01]);
    }
  });
  if (isGold) {
    const R = rng(77);
    const blobs = [[-0.27, 0.16, -0.22, 0.27], [0.25, 0.17, -0.24, 0.28], [0, 0.3, -0.3, 0.3], [-0.4, 0.07, 0.02, 0.17], [0.4, 0.07, 0, 0.17]];
    for (let i = 0; i < 14; i++) {
      const p = blobs[i % blobs.length], a = -0.2 + R() * 1.6 - PI / 2 + PI, el = 0.1 + R() * 0.9;
      b.add(new THREE.OctahedronGeometry(0.03 + R() * 0.015), MAT.gold, [p[0] + Math.cos(a) * Math.cos(el) * p[3] * 0.85, p[1] + Math.sin(el) * p[3] * 0.7, p[2] + Math.abs(Math.sin(a)) * Math.cos(el) * p[3] * 0.8 + 0.02], [R(), R(), R()]);
    }
  }
  lantern(b, -0.2, 0.14);
  polePart(b, 0.38, 0.12, 0.95);
}
const MINE_FLAG = { wood: [0.4, -0.3, 0.95], ore: [0.38, 0.12, 0.95], gold: [0.38, 0.12, 0.95], mercury: [-0.4, -0.38, 1.0], sulfur: [0.42, -0.3, 0.95], crystal: [0.42, 0.15, 0.95], gems: [0.42, 0.3, 0.9] };

function buildMine(obj) {
  const r = MINE_BUILD[obj.resource] ? obj.resource : 'ore';
  const g = cachedGroup('mine_' + r, MINE_BUILD[r]);
  const anims = [];
  const ph = Math.random() * 10;
  if (r === 'wood') {
    const saw = cachedGroup('sawblade', (b) => {
      b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 16), MAT.steel, [0, 0, 0], [PI / 2, 0, 0]);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        b.add(new THREE.ConeGeometry(0.022, 0.045, 3), MAT.steel, [Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0], [0, 0, a - PI / 2 + 0.4], [1, 1, 0.3]);
      }
      b.add(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8), MAT.gold, [0, 0, 0], [PI / 2, 0, 0]);
    });
    saw.position.set(0.12, 0.22, 0.03);
    g.add(saw);
    anims.push((dt) => { saw.rotation.z -= dt * 7; });
  } else if (r === 'ore' || r === 'gold') {
    const gl = glow('#ffb54a', 0.22, 0.8); gl.position.set(-0.14, 0.34, 0.14); g.add(gl);
    if (r === 'gold') addTwinkles(g, anims, '#fff1b0', 5, 0.38, 0.12, 0.35, 0.16);
  } else if (r === 'mercury') {
    anims.push(makeSmoke(g, 0.06, 0.92, -0.28, { count: 4, size: 0.24, rise: 0.8, color: '#cfc8e8', opacity: 0.5 }));
    const gl = glow('#a8e8ff', 0.45, 0.4, true); gl.position.set(0.27, 0.26, 0.12); g.add(gl);
    anims.push((dt, t) => { gl.material.opacity = 0.35 + Math.sin(t * 3 + ph) * 0.12; });
  } else if (r === 'sulfur') {
    for (const [x, y, z] of [[-0.1, 0.24, 0.07], [0.15, 0.22, -0.02], [-0.05, 0.28, -0.25]]) {
      anims.push(makeSmoke(g, x, y, z, { count: 3, size: 0.17, rise: 0.5, color: '#f2e27a', opacity: 0.45, speed: 0.45 }));
      const gl = glow('#ffb020', 0.2, 0.7); gl.position.set(x, y, z); g.add(gl);
    }
  } else if (r === 'crystal') {
    const gls = [];
    for (const [x, y, z, s] of [[-0.3, 0.42, -0.1, 0.55], [0.08, 0.7, -0.38, 0.6], [0.34, 0.35, -0.1, 0.45], [0.2, 0.12, 0.32, 0.35]]) {
      const gl = glow('#ff3848', s, 0.45, true); gl.position.set(x, y, z); g.add(gl); gls.push(gl);
    }
    const gl2 = glow('#ff5a5a', 0.3, 0.6); gl2.position.set(0, 0.15, 0.06); g.add(gl2);
    anims.push((dt, t) => gls.forEach((gl, i) => { gl.material.opacity = 0.35 + Math.sin(t * 2.1 + i * 1.7 + ph) * 0.18; }));
  } else if (r === 'gems') {
    const gl = glow('#5dffa0', 0.9, 0.25, true); gl.position.set(0, 0.08, -0.02); g.add(gl);
    anims.push((dt, t) => { gl.material.opacity = 0.2 + Math.sin(t * 1.7 + ph) * 0.08; });
    addTwinkles(g, anims, '#d0ffe0', 4, 0.35, 0.05, 0.2, 0.15);
  }
  const [fx, fz, fh] = MINE_FLAG[r];
  addOwnerFlag(g, fx, fz, fh);
  g.userData.height = r === 'mercury' ? 0.95 : 0.8;
  return finish(g, anims);
}

// ---------------------------------------------------------------------------
//  Creature dwellings (neutral)
// ---------------------------------------------------------------------------
const DWELL_BUILD = {
  goblin(b) {
    b.add(new THREE.CylinderGeometry(0.45, 0.47, 0.03, 10), mat('#8a7550'), [0, 0.015, -0.02]);
    const hut = (x, z, s, roofC) => {
      b.push([x, 0, z], [0, 0, 0], s);
      b.cylB(mat('#8a6a45'), 0.17, 0.19, 0.2, 0, 0, 0, 8);
      b.add(jitter(new THREE.ConeGeometry(0.25, 0.3, 8), 0.02, x * 10), mat(roofC), [0, 0.33, 0]);
      b.add(new THREE.ConeGeometry(0.04, 0.12, 4), mat(C.woodDark), [0.02, 0.5, 0], [0, 0, 0.3]);
      b.boxB(MAT.dark, 0.08, 0.12, 0.04, 0, 0, 0.17);
      b.pop();
    };
    hut(-0.18, -0.18, 1.1, '#a58a48');
    hut(0.22, -0.08, 0.85, '#9b7d3e');
    hut(-0.02, 0.2, 0.7, '#b39550');
    // palisade stakes along back
    for (let i = 0; i < 11; i++) {
      const a = PI + 0.15 + (i / 10) * (PI - 0.3);
      const x = Math.cos(a) * 0.43, z = Math.sin(a) * 0.38 - 0.02;
      b.cylB(mat(C.wood), 0.025, 0.028, 0.24 + (i % 3) * 0.03, x, 0, z, 5);
      b.add(new THREE.ConeGeometry(0.026, 0.06, 5), mat(C.woodLight), [x, 0.27 + (i % 3) * 0.03 + 0.03, z]);
    }
    // totem with skull
    b.cylB(mat(C.woodDark), 0.025, 0.03, 0.5, 0.36, 0, 0.18, 6);
    b.sph(mat(C.bone), 0.05, 0.36, 0.52, 0.18, 0, [1, 0.9, 1]);
    b.sph(MAT.dark, 0.014, 0.345, 0.53, 0.225); b.sph(MAT.dark, 0.014, 0.375, 0.53, 0.225);
    b.add(new THREE.ConeGeometry(0.015, 0.08, 4), mat(C.bone), [0.31, 0.56, 0.18], [0, 0, 0.8]);
    b.add(new THREE.ConeGeometry(0.015, 0.08, 4), mat(C.bone), [0.41, 0.56, 0.18], [0, 0, -0.8]);
    polePart(b, -0.42, 0.22, 0.85);
  },
  wolf(b) {
    const r1 = mat('#7d756c'), r2 = mat('#655e57');
    rockHill(b, r1, r2, 50, 1.02);
    b.add(new THREE.SphereGeometry(0.17, 8, 5, 0, TAU, 0, PI / 2), MAT.dark, [0, 0, 0.03], null, [1.1, 1.2, 0.7]);
    b.add(new THREE.CylinderGeometry(0.36, 0.4, 0.025, 10), mat('#6d5f4a'), [0, 0.012, 0.25], null, [1, 1, 0.6]);
    // bones
    const bone = mat(C.bone);
    for (const [x, z, ry] of [[0.15, 0.3, 0.4], [-0.18, 0.34, -0.6], [0.0, 0.4, 1.2], [0.25, 0.2, -0.2]]) {
      b.cyl(bone, 0.012, 0.012, 0.12, x, 0.015, z, 5, 0, ry, PI / 2);
      b.sph(bone, 0.02, x + Math.cos(ry) * 0.06, 0.015, z - Math.sin(ry) * 0.06);
      b.sph(bone, 0.02, x - Math.cos(ry) * 0.06, 0.015, z + Math.sin(ry) * 0.06);
    }
    b.sph(bone, 0.04, -0.28, 0.035, 0.22, 0, [1.2, 0.8, 1]);
    // dead tree
    b.push([0.34, 0, 0.2]);
    b.cylB(mat('#5d4a3a'), 0.02, 0.04, 0.5, 0, 0, 0, 5);
    b.cyl(mat('#5d4a3a'), 0.012, 0.02, 0.22, 0.07, 0.4, 0, 5, 0, 0, -0.8);
    b.cyl(mat('#5d4a3a'), 0.01, 0.018, 0.18, -0.06, 0.32, 0.02, 5, 0, 0, 0.9);
    b.pop();
    polePart(b, -0.42, 0.18, 0.9);
  },
  orc(b) {
    b.add(new THREE.CylinderGeometry(0.46, 0.48, 0.03, 10), mat('#7d6a4a'), [0, 0.015, 0]);
    const tent = (x, z, s, c1, c2, ry) => {
      b.push([x, 0, z], [0, ry, 0], s);
      b.add(new THREE.ConeGeometry(0.26, 0.42, 6), mat(c1), [0, 0.21, 0]);
      b.add(new THREE.ConeGeometry(0.265, 0.12, 6), mat(c2), [0, 0.06, 0], null, [1, 1, 1]);
      b.add(new THREE.ConeGeometry(0.12, 0.2, 3), MAT.dark, [0, 0.1, 0.13], [0, 0, 0], [0.7, 1, 0.45]);
      for (let i = 0; i < 3; i++) b.cyl(mat(C.woodDark), 0.01, 0.01, 0.14, Math.cos(i * 2.1) * 0.03, 0.45, Math.sin(i * 2.1) * 0.03, 4, Math.cos(i * 2.1) * 0.3, 0, Math.sin(i * 2.1) * 0.3);
      b.pop();
    };
    tent(-0.18, -0.15, 1.05, '#8e4a2a', '#6a3218', 0.2);
    tent(0.23, -0.05, 0.85, '#9a6a38', '#6e4a22', -0.3);
    // totem with horned skull banner
    b.cylB(mat(C.woodDark), 0.025, 0.03, 0.62, -0.3, 0, 0.22, 6);
    b.box(mat(C.woodDark), 0.24, 0.025, 0.025, -0.3, 0.55, 0.22);
    b.box(mat('#7a1e1e'), 0.2, 0.25, 0.01, -0.3, 0.42, 0.23);
    b.sph(mat(C.bone), 0.05, -0.3, 0.64, 0.23, 0);
    b.add(new THREE.ConeGeometry(0.018, 0.1, 4), mat(C.bone), [-0.36, 0.69, 0.23], [0, 0, 1.0]);
    b.add(new THREE.ConeGeometry(0.018, 0.1, 4), mat(C.bone), [-0.24, 0.69, 0.23], [0, 0, -1.0]);
    // crossed axes
    b.push([0.15, 0, 0.3]);
    for (const s of [-1, 1]) {
      b.cyl(mat(C.wood), 0.012, 0.012, 0.3, 0, 0.13, 0, 5, 0, 0, s * 0.5);
      b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 6, 1, false, 0, PI), MAT.iron, [s * -0.07, 0.25, 0], [PI / 2, 0, PI / 2 + s * 0.5]);
    }
    b.pop();
    stoneRing(b, 0.07, 6, 0.025, mat('#7a756f'), 80);
    b.push([0.36, 0, 0.26]); b.pop();
    polePart(b, 0.42, -0.32, 0.9);
  },
  stoneGolem(b) {
    b.add(new THREE.BoxGeometry(0.92, 0.04, 0.8), mat('#8a8478'), [0, 0.02, -0.02]);
    const st = mat('#9b958a'), st2 = mat('#827c72');
    // workshop: stone blocks building
    b.boxB(st, 0.56, 0.4, 0.38, -0.12, 0.04, -0.2);
    for (let i = 0; i < 4; i++) b.boxB(i % 2 ? st2 : st, 0.58, 0.02, 0.4, -0.12, 0.12 + i * 0.09, -0.2);
    b.roof(mat('#5a6578'), 0.66, 0.2, 0.46, -0.12, 0.44, -0.2);
    b.boxB(MAT.dark, 0.14, 0.22, 0.02, -0.12, 0.04, 0.0);
    b.box(st2, 0.2, 0.05, 0.05, -0.12, 0.29, 0.0);
    // golem statue (half built)
    b.push([0.27, 0.04, 0.12]);
    const gs = mat('#a8a296');
    b.boxB(gs, 0.08, 0.12, 0.08, -0.05, 0, 0); b.boxB(gs, 0.08, 0.12, 0.08, 0.05, 0, 0);
    b.boxB(gs, 0.22, 0.18, 0.14, 0, 0.12, 0);
    b.boxB(gs, 0.1, 0.09, 0.1, 0, 0.3, 0.01);
    b.boxB(gs, 0.07, 0.17, 0.07, -0.15, 0.12, 0.0); b.boxB(gs, 0.07, 0.17, 0.07, 0.15, 0.12, 0.0);
    b.box(mat('#6fd8ff', { e: '#2aa8ff', ei: 1.6 }), 0.07, 0.015, 0.01, 0, 0.345, 0.062);
    b.box(mat('#6fd8ff', { e: '#2aa8ff', ei: 1.6 }), 0.05, 0.05, 0.01, 0, 0.22, 0.072, 0, 0, PI / 4);
    b.pop();
    // anvil + blocks
    b.boxB(MAT.iron, 0.12, 0.04, 0.06, -0.3, 0.12, 0.22);
    b.boxB(mat(C.woodDark), 0.08, 0.08, 0.08, -0.3, 0.04, 0.22);
    b.boxB(st, 0.12, 0.1, 0.12, 0.05, 0.04, 0.3, 0.3);
    b.boxB(st2, 0.1, 0.08, 0.1, 0.06, 0.14, 0.3, 0.6);
    b.add(new THREE.CylinderGeometry(0.01, 0.01, 0.2), mat(C.woodLight), [-0.18, 0.1, 0.28], [0, 0, 1.2]);
    polePart(b, 0.42, -0.32, 0.95);
  },
};
const DWELL_FLAG = { goblin: [-0.42, 0.22, 0.85], wolf: [-0.42, 0.18, 0.9], orc: [0.42, -0.32, 0.9], stoneGolem: [0.42, -0.32, 0.95] };

function buildDwelling(obj) {
  const c = DWELL_BUILD[obj.creature] ? obj.creature : 'goblin';
  const g = cachedGroup('dw_' + c, DWELL_BUILD[c]);
  const anims = [];
  if (c === 'orc') {
    const f = makeFire(0.8); f.group.position.set(0, 0.0, 0.0); g.add(f.group); anims.push(f.update);
    anims.push(makeSmoke(g, 0, 0.3, 0, { count: 3, size: 0.18, rise: 0.6, opacity: 0.35 }));
  } else if (c === 'wolf') {
    for (const x of [-0.05, 0.05]) { const e = glow('#ffcc33', 0.07, 0.95); e.position.set(x, 0.1, 0.06); g.add(e); }
  } else if (c === 'stoneGolem') {
    const gl = glow('#4ab8ff', 0.35, 0.5, true); gl.position.set(0.27, 0.32, 0.18); g.add(gl);
    const ph = Math.random() * 10;
    anims.push((dt, t) => { gl.material.opacity = 0.35 + Math.sin(t * 2.5 + ph) * 0.15; });
  } else if (c === 'goblin') {
    anims.push(makeSmoke(g, -0.16, 0.6, -0.18, { count: 3, size: 0.15, rise: 0.5, opacity: 0.35 }));
  }
  const [fx, fz, fh] = DWELL_FLAG[c];
  addOwnerFlag(g, fx, fz, fh);
  g.userData.height = 0.8;
  return finish(g, anims);
}

// ---------------------------------------------------------------------------
//  Portal swirl shader (shared TIME)
// ---------------------------------------------------------------------------
const _portalMats = new Map();
export function portalMaterial(c1 = '#5a2dff', c2 = '#4ff0ff') {
  const key = c1 + c2;
  if (_portalMats.has(key)) return _portalMats.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: TIME, uC1: { value: new THREE.Color(c1) }, uC2: { value: new THREE.Color(c2) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; uniform vec3 uC1; uniform vec3 uC2; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
        float s1 = sin(a * 3.0 + r * 11.0 - uTime * 3.2) * 0.5 + 0.5;
        float s2 = sin(a * 5.0 - r * 16.0 + uTime * 2.1) * 0.5 + 0.5;
        vec3 col = mix(uC1, uC2, s1 * 0.7 + s2 * 0.3);
        col += vec3(1.0) * pow(1.0 - r, 3.0) * 0.9;
        col *= 0.75 + 0.6 * s1;
        float alpha = smoothstep(1.0, 0.86, r) * (0.75 + 0.25 * s2);
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  _portalMats.set(key, m);
  return m;
}

// ---------------------------------------------------------------------------
//  Visitable structures
// ---------------------------------------------------------------------------
function columnPart(b, m, x, y, z, h, r = 0.04, capM = m) {
  b.cylB(capM, r * 1.35, r * 1.35, 0.03, x, y, z, 8);
  b.cylB(m, r, r * 1.08, h - 0.06, x, y + 0.03, z, 8);
  b.cylB(capM, r * 1.45, r * 1.15, 0.03, x, y + h - 0.03, z, 8);
}
function tombstone(b, m, x, z, s = 1, rz = 0) {
  b.push([x, 0, z], [0, 0, rz], s);
  b.boxB(m, 0.1, 0.12, 0.035, 0, 0, 0);
  b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 8, 1, false, -PI / 2, PI), m, [0, 0.12, 0], [PI / 2, 0, 0]);
  b.box(mat('#5d5a55'), 0.05, 0.012, 0.005, 0, 0.12, 0.019);
  b.box(mat('#5d5a55'), 0.012, 0.06, 0.005, 0, 0.11, 0.019);
  b.pop();
}
function tentPart(b, x, z, s, c1, c2, ry = 0) {
  // A-frame tent, ridge along Z, opening faces +Z
  b.push([x, 0, z], [0, ry, 0], s);
  b.add(prismGeo(0.34, 0.28, 0.42), mat(c1), [0, 0, 0], null);
  b.add(prismGeo(0.36, 0.06, 0.43), mat(c2), [0, 0.0, 0], null, [1, 1, 1]);
  b.add(prismGeo(0.14, 0.18, 0.02), MAT.dark, [0, 0, 0.205]);
  b.cylB(mat(C.woodDark), 0.008, 0.008, 0.34, 0, 0, 0.215, 4);
  b.pop();
}
function flowerHeads(b, n, R, cx, cz, rad, y0, colors) {
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * rad;
    b.sph(mat(colors[i % colors.length], { e: colors[i % colors.length], ei: 0.15 }), 0.022 + R() * 0.01, cx + Math.cos(a) * d, y0 + R() * 0.03, cz + Math.sin(a) * d);
  }
}

const OBJ_BUILD = {
  windmill(b) {
    const st = mat('#d7cfbd'), st2 = mat('#bdb3a0');
    b.add(new THREE.CylinderGeometry(0.4, 0.42, 0.04, 10), mat('#8f8a6a'), [0, 0.02, 0]);
    b.cylB(st, 0.2, 0.28, 0.82, 0, 0.04, 0, 8);
    b.cylB(st2, 0.285, 0.29, 0.06, 0, 0.04, 0, 8);
    b.cylB(mat(C.wood), 0.23, 0.21, 0.2, 0, 0.86, 0, 8);
    b.coneB(mat(C.roofRed), 0.28, 0.36, 0, 1.06, 0, 8);
    b.sph(MAT.gold, 0.03, 0, 1.43, 0);
    b.boxB(mat(C.woodDark), 0.13, 0.22, 0.04, 0, 0.04, 0.26);
    b.add(prismGeo(0.17, 0.06, 0.06), mat(C.roofRed), [0, 0.26, 0.27]);
    b.boxB(mat('#ffd890', { e: '#c88a30', ei: 0.7 }), 0.07, 0.09, 0.03, 0, 0.5, 0.23);
    b.boxB(mat('#ffd890', { e: '#c88a30', ei: 0.7 }), 0.06, 0.08, 0.03, -0.17, 0.32, 0.18, -0.6);
    b.cyl(mat(C.woodDark), 0.03, 0.03, 0.18, 0, 0.98, 0.2, 6, PI / 2);
    // sacks
    const sack = mat('#e2d2a8');
    b.sph(sack, 0.07, 0.25, 0.1, 0.25, 1, [1, 1.1, 1]);
    b.sph(sack, 0.06, 0.33, 0.09, 0.17, 1, [1, 1.1, 1]);
    b.sph(sack, 0.06, -0.3, 0.09, 0.22, 1, [1, 1.1, 1]);
  },
  waterwheel(b) {
    // stream along X in front
    b.boxB(mat('#6f8a52'), 1.0, 0.03, 0.9, 0, 0, -0.05);
    b.boxB(MAT.water, 1.02, 0.02, 0.26, 0, 0.02, 0.27);
    for (let i = 0; i < 9; i++) rockPart(b, mat(i % 2 ? '#9a948a' : '#85807a'), 0.04, -0.48 + i * 0.12, 0.03, 0.42, [1, 0.6, 1], 90 + i);
    // millhouse
    const st = mat('#c9bea6'), w = mat(C.wood);
    b.boxB(st, 0.62, 0.3, 0.42, -0.08, 0.03, -0.18);
    b.boxB(w, 0.62, 0.2, 0.42, -0.08, 0.33, -0.18);
    for (let i = 0; i < 5; i++) b.boxB(mat(C.woodDark), 0.03, 0.2, 0.43, -0.37 + i * 0.145, 0.33, -0.18);
    b.roof(mat('#9c4a2c'), 0.72, 0.28, 0.52, -0.08, 0.53, -0.18);
    b.boxB(mat('#7a6f60'), 0.08, 0.2, 0.08, -0.26, 0.6, -0.26);
    b.boxB(mat(C.woodDark), 0.12, 0.2, 0.02, -0.25, 0.03, 0.035);
    b.boxB(mat('#ffd890', { e: '#c88a30', ei: 0.7 }), 0.08, 0.08, 0.02, 0.06, 0.38, 0.035);
    // axle support
    b.boxB(mat(C.woodDark), 0.05, 0.36, 0.05, 0.3, 0.03, 0.05);
    b.cyl(MAT.iron, 0.025, 0.025, 0.3, 0.3, 0.33, 0.13, 6, PI / 2);
    // sluice chute
    b.box(w, 0.32, 0.04, 0.12, 0.42, 0.62, 0.22, 0, 0, -0.2);
  },
  well(b) {
    b.add(new THREE.CylinderGeometry(0.34, 0.36, 0.03, 10), mat('#a59b88'), [0, 0.015, 0]);
    const st = mat('#a8a294'), st2 = mat('#8f897c');
    b.cylB(st, 0.2, 0.22, 0.22, 0, 0.03, 0, 10);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; b.boxB(i % 2 ? st2 : st, 0.11, 0.06, 0.05, Math.cos(a) * 0.19, 0.22, Math.sin(a) * 0.19, -a + PI / 2); }
    b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.01, 10), mat('#2f74c4', { e: '#1050a0', ei: 0.6, r: 0.1 }), [0, 0.2, 0]);
    for (const x of [-0.21, 0.21]) b.boxB(mat(C.wood), 0.04, 0.46, 0.04, x, 0.22, 0);
    b.cyl(mat(C.woodDark), 0.02, 0.02, 0.48, 0, 0.56, 0, 6, 0, 0, PI / 2);
    b.cyl(mat(C.rope), 0.03, 0.03, 0.08, 0, 0.56, 0, 8, 0, 0, PI / 2);
    b.roof(mat('#9c4a2c'), 0.6, 0.2, 0.4, 0, 0.66, 0);
    b.cylB(mat(C.rope), 0.004, 0.004, 0.2, 0.0, 0.34, 0.0, 4);
    b.cylB(mat(C.wood), 0.04, 0.035, 0.06, 0, 0.3, 0, 7);
    b.cylB(mat(C.wood), 0.04, 0.035, 0.07, 0.24, 0.03, 0.18, 7);
  },
  learningStone(b) {
    b.add(new THREE.CylinderGeometry(0.34, 0.36, 0.025, 10), mat('#7f8f5a'), [0, 0.012, 0]);
    b.add(jitter(new THREE.BoxGeometry(0.36, 0.78, 0.12, 2, 3, 1), 0.012, 4), mat('#9a9890'), [0, 0.39, 0], [0, 0, 0.04]);
    b.add(jitter(new THREE.BoxGeometry(0.4, 0.06, 0.16), 0.01, 6), mat('#7a7870'), [0, 0.03, 0]);
    rockPart(b, mat('#8a8880'), 0.07, -0.25, 0.04, 0.12, [1, 0.7, 1], 3);
    rockPart(b, mat('#8a8880'), 0.05, 0.25, 0.03, 0.16, [1, 0.7, 1], 4);
    rockPart(b, mat('#7a7870'), 0.06, 0.22, 0.03, -0.14, [1, 0.6, 1], 5);
    grassPatch(b, 0.3, 8, 11);
  },
  marlettoTower(b) {
    b.add(new THREE.CylinderGeometry(0.4, 0.42, 0.03, 8), mat('#8a8a6a'), [0, 0.015, 0]);
    const st = mat('#b4ab99'), st2 = mat('#968d7c');
    b.add(new THREE.CylinderGeometry(0.2, 0.25, 1.1, 4).rotateY(PI / 4), st, [0, 0.58, 0]);
    for (let i = 0; i < 5; i++) b.add(new THREE.CylinderGeometry(0.255 - i * 0.012, 0.255 - i * 0.012, 0.025, 4).rotateY(PI / 4), st2, [0, 0.12 + i * 0.22, 0]);
    b.add(new THREE.CylinderGeometry(0.26, 0.22, 0.1, 4).rotateY(PI / 4), st2, [0, 1.17, 0]);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const t = -0.18 + j * 0.18;
      const [x, z] = [[t, 0.18], [t, -0.18], [0.18, t], [-0.18, t]][i];
      b.boxB(st, 0.08, 0.09, 0.08, x, 1.22, z);
    }
    b.boxB(mat(C.woodDark), 0.12, 0.2, 0.02, 0, 0.03, 0.23);
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8, 1, false, -PI / 2, PI), mat(C.woodDark), [0, 0.23, 0.23], [PI / 2, 0, 0]);
    for (const y of [0.55, 0.85]) b.boxB(MAT.dark, 0.035, 0.11, 0.02, 0, y, 0.2);
    b.boxB(MAT.dark, 0.02, 0.1, 0.035, 0.2, 0.7, 0);
    polePart(b, 0, 0, 0.42, 1.22);
    // training targets
    b.cylB(mat(C.woodDark), 0.012, 0.012, 0.2, 0.32, 0.03, 0.2, 4);
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10), mat('#e8dcc0'), [0.32, 0.22, 0.21], [PI / 2, 0, 0]);
    b.add(new THREE.CylinderGeometry(0.035, 0.035, 0.022, 10), mat('#c23b35'), [0.32, 0.22, 0.21], [PI / 2, 0, 0]);
  },
  mercenaryCamp(b) {
    b.add(new THREE.CylinderGeometry(0.46, 0.48, 0.025, 10), mat('#8d7a55'), [0, 0.012, 0]);
    tentPart(b, -0.22, -0.18, 1.0, '#c9b48a', '#8e2d2a', 0.25);
    tentPart(b, 0.2, -0.22, 0.85, '#b39a6a', '#2d4a8e', -0.2);
    // weapon rack
    b.push([0.22, 0, 0.2], [0, -0.3, 0]);
    b.boxB(mat(C.woodDark), 0.03, 0.26, 0.03, -0.13, 0, 0); b.boxB(mat(C.woodDark), 0.03, 0.26, 0.03, 0.13, 0, 0);
    b.box(mat(C.wood), 0.3, 0.025, 0.03, 0, 0.22, 0);
    b.box(mat(C.wood), 0.3, 0.025, 0.03, 0, 0.08, 0);
    for (let i = 0; i < 4; i++) {
      b.cylB(mat(C.woodLight), 0.007, 0.007, 0.34, -0.1 + i * 0.065, 0.0, 0.02, 4);
      b.add(new THREE.ConeGeometry(0.016, 0.06, 4), MAT.steel, [-0.1 + i * 0.065, 0.37, 0.02]);
    }
    b.pop();
    for (const [x, z, c] of [[0.0, 0.3, '#b33a35'], [0.42, 0.06, '#3a62b3']]) {
      b.add(new THREE.CylinderGeometry(0.065, 0.065, 0.02, 10), mat(c), [x, 0.07, z], [PI / 2 - 0.3, 0, 0]);
      b.sph(MAT.gold, 0.018, x, 0.075, z + 0.02);
    }
    // training dummy
    b.push([-0.32, 0, 0.18]);
    b.cylB(mat(C.woodDark), 0.015, 0.015, 0.36, 0, 0, 0, 5);
    b.box(mat(C.wood), 0.22, 0.025, 0.025, 0, 0.27, 0);
    b.sph(mat(C.hay), 0.07, 0, 0.22, 0, 0, [1, 1.2, 0.8]);
    b.sph(mat('#d9c38a'), 0.045, 0, 0.36, 0);
    b.pop();
    stoneRing(b, 0.07, 6, 0.025, mat('#7a756f'), 120);
  },
  starAxis(b) {
    b.add(new THREE.CylinderGeometry(0.4, 0.42, 0.03, 8), mat('#8a8a7a'), [0, 0.015, 0]);
    const st = mat('#c9c2b2'), st2 = mat('#a49d8d');
    b.cylB(st2, 0.32, 0.34, 0.06, 0, 0.03, 0, 8);
    b.cylB(st, 0.25, 0.28, 0.06, 0, 0.09, 0, 8);
    b.cylB(st, 0.07, 0.1, 0.32, 0, 0.15, 0, 8);
    b.cylB(st2, 0.12, 0.08, 0.05, 0, 0.47, 0, 8);
    // static meridian ring + stand
    b.add(new THREE.TorusGeometry(0.3, 0.014, 5, 24), mat('#b8862e', { m: 0.3, r: 0.4, e: '#3a2400', ei: 0.4 }), [0, 0.82, 0], [0, 0.3, 0]);
    b.add(new THREE.TorusGeometry(0.3, 0.014, 5, 24, PI), mat('#b8862e', { m: 0.3, r: 0.4, e: '#3a2400', ei: 0.4 }), [0, 0.82, 0], [PI / 2, 0, 0]);
    b.cylB(MAT.goldDim, 0.015, 0.015, 0.06, 0, 0.5, 0, 6);
    // star rune stones
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + PI / 4; b.boxB(st2, 0.06, 0.12, 0.04, Math.cos(a) * 0.36, 0.03, Math.sin(a) * 0.36, -a); }
  },
  gardenOfRevelation(b) {
    b.add(new THREE.CylinderGeometry(0.46, 0.48, 0.025, 12), mat('#5f9a3e'), [0, 0.012, 0]);
    b.boxB(mat('#d8ccb0'), 0.16, 0.012, 0.5, 0, 0.02, 0.2);
    const hedge = mat('#3e7a2e'), hedge2 = mat('#4a8a36');
    b.add(jitter(new THREE.BoxGeometry(0.75, 0.16, 0.12, 3, 1, 1), 0.015, 2), hedge, [0, 0.1, -0.36]);
    b.add(jitter(new THREE.BoxGeometry(0.12, 0.16, 0.5, 1, 1, 2), 0.015, 3), hedge2, [-0.38, 0.1, -0.08]);
    b.add(jitter(new THREE.BoxGeometry(0.12, 0.16, 0.5, 1, 1, 2), 0.015, 4), hedge2, [0.38, 0.1, -0.08]);
    // trellis arch (front)
    const wh = mat('#efe8da');
    b.add(new THREE.TorusGeometry(0.17, 0.016, 4, 12, PI), wh, [0, 0.34, 0.3]);
    b.boxB(wh, 0.03, 0.34, 0.03, -0.17, 0, 0.3); b.boxB(wh, 0.03, 0.34, 0.03, 0.17, 0, 0.3);
    const R = rng(14);
    for (let i = 0; i < 16; i++) {
      const a = (i / 15) * PI, x = Math.cos(a) * 0.17, y = 0.34 + Math.sin(a) * 0.17;
      b.sph(mat(['#ff7ab6', '#ffffff', '#c58aff', '#ffd25a'][i % 4], { e: '#401030', ei: 0.2 }), 0.028, x + (R() - 0.5) * 0.02, y + (R() - 0.5) * 0.02, 0.3 + (R() - 0.5) * 0.03);
      if (i % 2) b.sph(mat(C.leafL), 0.025, x, y - 0.02, 0.31);
    }
    // fountain
    b.cylB(mat('#cfc6b2'), 0.16, 0.17, 0.08, 0, 0.02, -0.12, 10);
    b.cylB(mat('#5fd8ff', { e: '#20b0ff', ei: 0.9, r: 0.1 }), 0.135, 0.135, 0.07, 0, 0.035, -0.12, 10);
    b.cylB(mat('#cfc6b2'), 0.03, 0.04, 0.18, 0, 0.08, -0.12, 6);
    b.cylB(mat('#cfc6b2'), 0.07, 0.03, 0.04, 0, 0.26, -0.12, 8);
    b.add(new THREE.ConeGeometry(0.035, 0.14, 6), mat('#a8f0ff', { e: '#40d0ff', ei: 1.4, op: 0.75 }), [0, 0.37, -0.12]);
    // flower beds
    flowerHeads(b, 12, R, -0.24, 0.05, 0.1, 0.05, ['#ff5a7a', '#ffd25a', '#ffffff']);
    flowerHeads(b, 12, R, 0.24, 0.05, 0.1, 0.05, ['#b06aff', '#ff9a4a', '#ffffff']);
    for (const x of [-0.24, 0.24]) b.add(new THREE.SphereGeometry(0.11, 7, 3, 0, TAU, 0, PI / 2), mat(C.leafD), [x, 0.02, 0.05], null, [1, 0.35, 1]);
    flowerHeads(b, 10, R, 0, -0.36, 0.3, 0.17, ['#ff7ab6', '#ffffff', '#ffd25a']);
  },
  witchHut(b) {
    b.add(new THREE.CylinderGeometry(0.42, 0.44, 0.025, 10), mat('#5d6a3a'), [0, 0.012, 0]);
    // chicken legs
    const leg = mat('#d9a441');
    for (const s of [-1, 1]) {
      b.cyl(leg, 0.025, 0.03, 0.22, s * 0.09, 0.32, -0.04, 6, 0.35, 0, s * 0.15);
      b.cyl(leg, 0.018, 0.02, 0.22, s * 0.1, 0.12, 0.0, 6, -0.3, 0, -s * 0.05);
      for (const a of [-0.6, 0, 0.6]) b.cyl(leg, 0.006, 0.01, 0.09, s * 0.1 + Math.sin(a) * 0.04, 0.012, 0.03 + Math.cos(a) * 0.04, 4, PI / 2, a, 0);
    }
    // hut (crooked)
    b.push([0, 0.42, -0.05], [0.03, 0.1, 0.07]);
    b.boxB(mat('#6e5034'), 0.4, 0.3, 0.32, 0, 0, 0);
    for (let i = 0; i < 4; i++) b.cyl(mat('#5a3e26'), 0.018, 0.018, 0.42, 0, 0.04 + i * 0.075, 0.165, 5, 0, 0, PI / 2);
    b.add(jitter(new THREE.ConeGeometry(0.34, 0.36, 4), 0.025, 7).rotateY(PI / 4), mat('#4a4a2a'), [0.02, 0.48, 0], [0, 0, -0.12]);
    b.boxB(mat('#a8ff7a', { e: '#60ff30', ei: 1.4 }), 0.08, 0.08, 0.02, 0.09, 0.13, 0.165);
    b.boxB(mat('#3a2a1a'), 0.1, 0.17, 0.02, -0.1, 0, 0.165);
    b.boxB(mat('#5d5548'), 0.07, 0.3, 0.07, -0.12, 0.3, -0.08);
    b.pop();
    // cauldron
    b.push([0.27, 0, 0.22]);
    b.add(new THREE.SphereGeometry(0.08, 8, 5, 0, TAU, PI * 0.35, PI * 0.65), MAT.dark, [0, 0.09, 0]);
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 8), mat('#7dff4a', { e: '#40ff10', ei: 1.4 }), [0, 0.12, 0]);
    for (let i = 0; i < 3; i++) b.cyl(mat(C.woodDark), 0.008, 0.008, 0.2, Math.cos(i * 2.1) * 0.06, 0.08, Math.sin(i * 2.1) * 0.06, 4, Math.cos(i * 2.1) * 0.3, 0, Math.sin(i * 2.1) * 0.3);
    b.pop();
    b.cyl(mat(C.woodDark), 0.01, 0.01, 0.48, -0.17, 0.22, 0.15, 4, -0.5, 0, 0.1);
    b.cyl(mat(C.woodDark), 0.01, 0.01, 0.48, -0.05, 0.22, 0.15, 4, -0.5, 0, 0.1);
    // dead bush + skull
    b.sph(mat(C.bone), 0.035, -0.3, 0.03, 0.25);
  },
  treeOfKnowledge(b) {
    b.add(new THREE.CylinderGeometry(0.46, 0.48, 0.025, 12), mat('#6aa24a'), [0, 0.012, 0]);
    stoneRing(b, 0.36, 14, 0.04, mat('#b0a898'), 140, 0.01);
    const bark = mat('#7a5534');
    b.add(jitter(new THREE.CylinderGeometry(0.09, 0.15, 0.6, 7, 3), 0.02, 3), bark, [0, 0.3, 0]);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; b.cyl(bark, 0.02, 0.05, 0.22, Math.cos(a) * 0.12, 0.04, Math.sin(a) * 0.12, 5, Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); }
    b.cyl(bark, 0.04, 0.07, 0.3, -0.1, 0.62, 0, 6, 0, 0, 0.6);
    b.cyl(bark, 0.04, 0.07, 0.3, 0.11, 0.64, 0.02, 6, 0, 0, -0.6);
    const lf = [mat('#3f8a35'), mat('#4f9d3c'), mat('#357a2f')];
    const blobs = [[0, 1.0, 0, 0.34], [-0.28, 0.82, 0.04, 0.26], [0.28, 0.84, 0.0, 0.27], [0, 0.85, 0.22, 0.25], [0.05, 0.86, -0.22, 0.26], [-0.16, 1.12, -0.05, 0.22], [0.17, 1.1, 0.05, 0.22]];
    blobs.forEach(([x, y, z, r], i) => b.add(jitter(new THREE.IcosahedronGeometry(r, 1), r * 0.12, 20 + i), lf[i % 3], [x, y, z]));
  },
  stables(b) {
    b.add(new THREE.BoxGeometry(0.98, 0.025, 0.86), mat('#8a7a4a'), [0, 0.012, -0.02]);
    const red = mat('#a8432e'), trim = mat('#efe6d4');
    b.boxB(red, 0.56, 0.36, 0.42, -0.14, 0.02, -0.18);
    b.add(prismGeo(0.56, 0.18, 0.42), red, [-0.14, 0.38, -0.18], [0, PI / 2, 0], [1, 1, 1]);
    b.box(mat('#5a4a3e'), 0.33, 0.03, 0.66, -0.14 - 0.15, 0.48, -0.18, 0, 0, 0.55);
    b.box(mat('#5a4a3e'), 0.33, 0.03, 0.66, -0.14 + 0.15, 0.48, -0.18, 0, 0, -0.55);
    // front gable shows: big door with white X
    b.boxB(mat('#6a2a1e'), 0.22, 0.25, 0.02, -0.14, 0.02, 0.035);
    b.box(trim, 0.32, 0.018, 0.01, -0.14, 0.145, 0.047, 0, 0, 0.85);
    b.box(trim, 0.32, 0.018, 0.01, -0.14, 0.145, 0.047, 0, 0, -0.85);
    b.box(trim, 0.24, 0.02, 0.01, -0.14, 0.27, 0.047);
    b.boxB(mat(C.dark), 0.1, 0.08, 0.02, -0.14, 0.38, 0.035);
    b.boxB(mat(C.hay), 0.08, 0.03, 0.02, -0.14, 0.38, 0.04);
    // fence paddock
    const fw = mat(C.woodLight);
    const posts = [[0.18, 0.4], [0.3, 0.4], [0.44, 0.4], [0.44, 0.2], [0.44, 0.0], [0.44, -0.2]];
    posts.forEach(([x, z]) => b.boxB(fw, 0.03, 0.18, 0.03, x, 0.02, z));
    b.box(fw, 0.27, 0.02, 0.015, 0.31, 0.15, 0.4); b.box(fw, 0.27, 0.02, 0.015, 0.31, 0.08, 0.4);
    b.box(fw, 0.015, 0.02, 0.6, 0.44, 0.15, 0.1); b.box(fw, 0.015, 0.02, 0.6, 0.44, 0.08, 0.1);
    // hay bales + trough
    b.cyl(mat(C.hay), 0.07, 0.07, 0.12, 0.25, 0.09, -0.15, 9, 0, 0, PI / 2);
    b.cyl(mat('#d4b04a'), 0.065, 0.065, 0.12, 0.26, 0.22, -0.15, 9, 0, 0, PI / 2);
    b.cyl(mat(C.hay), 0.07, 0.07, 0.12, 0.25, 0.09, -0.3, 9, 0, 0, PI / 2);
    b.boxB(mat(C.wood), 0.22, 0.06, 0.08, 0.2, 0.02, 0.18);
    b.boxB(MAT.water, 0.19, 0.01, 0.06, 0.2, 0.07, 0.18);
    // horse (simple)
    b.push([-0.27, 0.02, 0.28], [0, 0.5, 0]);
    const hm = mat('#7a4a2a');
    b.boxB(hm, 0.22, 0.09, 0.08, 0, 0.12, 0);
    for (const [x, z] of [[-0.08, -0.025], [-0.08, 0.025], [0.08, -0.025], [0.08, 0.025]]) b.boxB(hm, 0.025, 0.12, 0.025, x, 0, z);
    b.box(hm, 0.06, 0.13, 0.05, 0.12, 0.24, 0, 0, 0, -0.5);
    b.box(hm, 0.1, 0.045, 0.045, 0.18, 0.29, 0, 0, 0, 0.3);
    b.box(mat('#2a1a10'), 0.03, 0.12, 0.052, 0.1, 0.26, 0, 0, 0, -0.5);
    b.cyl(mat('#2a1a10'), 0.006, 0.015, 0.12, -0.13, 0.13, 0, 4, 0, 0, 0.9);
    b.pop();
  },
  fountain(b) {
    b.add(new THREE.CylinderGeometry(0.46, 0.48, 0.025, 12), mat('#b9b09c'), [0, 0.012, 0]);
    const st = mat('#e0d8c6'), st2 = mat('#c4bba7');
    b.cylB(st2, 0.38, 0.4, 0.12, 0, 0.02, 0, 14);
    b.cylB(st, 0.4, 0.4, 0.03, 0, 0.14, 0, 14);
    b.cylB(mat('#4fb0e8', { e: '#1870b0', ei: 0.55, r: 0.08 }), 0.34, 0.34, 0.1, 0, 0.05, 0, 14);
    b.cylB(st, 0.06, 0.08, 0.3, 0, 0.1, 0, 8);
    b.cylB(st2, 0.18, 0.06, 0.06, 0, 0.36, 0, 10);
    b.cylB(mat('#6ac4f0', { e: '#2080c0', ei: 0.6, r: 0.08 }), 0.16, 0.16, 0.012, 0, 0.405, 0, 10);
    b.cylB(st, 0.025, 0.035, 0.14, 0, 0.42, 0, 6);
    b.cylB(st2, 0.08, 0.03, 0.04, 0, 0.56, 0, 8);
    b.sph(MAT.gold, 0.04, 0, 0.63, 0);
    // coins in water
    const R = rng(77);
    for (let i = 0; i < 14; i++) { const a = R() * TAU, d = 0.12 + R() * 0.2; coinPart(b, Math.cos(a) * d, 0.155, Math.sin(a) * d, 0, 0, 0.022); }
  },
  temple(b) {
    const st = mat('#e6dfcf'), st2 = mat('#c9c0ad');
    b.boxB(st2, 0.82, 0.05, 0.72, 0, 0, -0.05);
    b.boxB(st, 0.74, 0.05, 0.64, 0, 0.05, -0.07);
    b.boxB(st2, 0.66, 0.05, 0.56, 0, 0.1, -0.09);
    b.boxB(st, 0.5, 0.44, 0.36, 0, 0.15, -0.18);
    b.boxB(mat('#2a1e18'), 0.14, 0.24, 0.02, 0, 0.15, 0.005);
    b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 8, 1, false, -PI / 2, PI), mat('#2a1e18'), [0, 0.39, 0.005], [PI / 2, 0, 0]);
    for (const x of [-0.27, -0.12, 0.12, 0.27]) columnPart(b, st, x, 0.15, 0.13, 0.44, 0.032, st2);
    b.boxB(st2, 0.64, 0.05, 0.54, 0, 0.59, -0.09);
    b.add(prismGeo(0.64, 0.2, 0.54), st, [0, 0.64, -0.09]);
    b.add(prismGeo(0.3, 0.09, 0.02), MAT.goldDim, [0, 0.67, 0.185]);
    b.sph(MAT.gold, 0.035, 0, 0.87, 0.16);
    // braziers
    for (const x of [-0.36, 0.36]) {
      b.cylB(st2, 0.03, 0.045, 0.2, x, 0.0, 0.26, 6);
      b.cylB(MAT.goldDim, 0.06, 0.035, 0.05, x, 0.2, 0.26, 8);
    }
    // banner poles on sides
    for (const x of [-0.31, 0.31]) b.cylB(mat(C.woodDark), 0.01, 0.01, 0.6, x, 0.15, -0.38, 4);
  },
  lookout(b) {
    b.add(new THREE.CylinderGeometry(0.42, 0.44, 0.025, 10), mat('#7f8f5a'), [0, 0.012, 0]);
    const w = mat(C.wood), wd = mat(C.woodDark);
    const H = 1.45;
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      b.cyl(w, 0.025, 0.035, H, x * 0.2, H / 2, z * 0.2, 6, -z * 0.1, 0, x * 0.1);
    }
    for (const y of [0.35, 0.8, 1.2]) {
      const k = 0.2 + (H - y) * 0.07;
      b.box(wd, k * 2, 0.025, 0.025, 0, y, k); b.box(wd, k * 2, 0.025, 0.025, 0, y, -k);
      b.box(wd, 0.025, 0.025, k * 2, k, y, 0); b.box(wd, 0.025, 0.025, k * 2, -k, y, 0);
    }
    b.box(wd, 0.5, 0.02, 0.02, 0, 0.58, 0.245, 0, 0, 0.75);
    b.box(wd, 0.5, 0.02, 0.02, 0, 0.58, 0.245, 0, 0, -0.75);
    b.boxB(mat(C.plank), 0.5, 0.04, 0.5, 0, H, 0);
    for (const [x, z, ww, dd] of [[0, 0.24, 0.5, 0.02], [0, -0.24, 0.5, 0.02], [0.24, 0, 0.02, 0.5], [-0.24, 0, 0.02, 0.5]]) b.boxB(w, ww, 0.16, dd, x, H + 0.04, z);
    for (const [x, z] of [[-0.23, -0.23], [0.23, -0.23], [-0.23, 0.23], [0.23, 0.23]]) b.boxB(wd, 0.025, 0.36, 0.025, x, H, z);
    b.pyramid(mat('#9c4a2c'), 0.31, 0.26, 0, H + 0.36, 0);
    // ladder
    b.cyl(wd, 0.01, 0.01, H, -0.05, H / 2, 0.3, 4, -0.12, 0, 0);
    b.cyl(wd, 0.01, 0.01, H, 0.05, H / 2, 0.3, 4, -0.12, 0, 0);
    for (let y = 0.12; y < H; y += 0.12) b.box(w, 0.1, 0.012, 0.012, 0, y, 0.3 + (H / 2 - y) * 0.12);
    // telescope
    b.cyl(MAT.goldDim, 0.025, 0.035, 0.24, 0.1, H + 0.2, 0.08, 7, 1.1, 0.4, 0);
  },
  pandora(b) {
    b.add(new THREE.CylinderGeometry(0.3, 0.32, 0.025, 10), mat('#8a8070'), [0, 0.012, 0]);
    b.cylB(mat('#cfc6b2'), 0.2, 0.24, 0.08, 0, 0.02, 0, 8);
    b.cylB(mat('#b4ab96'), 0.17, 0.2, 0.05, 0, 0.1, 0, 8);
    const body = mat('#5a2d8a'), gold = MAT.gold;
    b.boxB(body, 0.32, 0.18, 0.24, 0, 0.15, 0);
    b.boxB(mat('#6b38a5'), 0.34, 0.07, 0.26, 0, 0.345, 0);
    b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 8, 1, false, -PI / 2, PI), mat('#6b38a5'), [0, 0.415, 0], [0, 0, PI / 2], [1, 0.6, 1.05]);
    for (const [x, z] of [[-0.16, -0.12], [0.16, -0.12], [-0.16, 0.12], [0.16, 0.12]]) b.boxB(gold, 0.03, 0.26, 0.03, x, 0.15, z);
    b.boxB(gold, 0.34, 0.025, 0.26, 0, 0.15, 0);
    b.boxB(gold, 0.35, 0.025, 0.27, 0, 0.33, 0);
    b.box(gold, 0.36, 0.03, 0.03, 0, 0.49, 0);
    b.add(new THREE.OctahedronGeometry(0.05), mat('#ff5ad0', { e: '#ff2ab0', ei: 1.0 }), [0, 0.25, 0.125], null, [1, 1, 0.4]);
    b.add(new THREE.TorusGeometry(0.055, 0.012, 4, 10), gold, [0, 0.25, 0.122]);
    b.boxB(mat('#ffe9a0', { e: '#ffb020', ei: 2.0 }), 0.33, 0.012, 0.25, 0, 0.335, 0);
  },
  crypt(b) {
    b.add(new THREE.BoxGeometry(0.96, 0.025, 0.86), mat('#5a5a48'), [0, 0.012, -0.02]);
    const st = mat('#8f8a90'), st2 = mat('#726c74');
    b.boxB(st2, 0.6, 0.05, 0.5, 0, 0.02, -0.18);
    b.boxB(st, 0.52, 0.38, 0.42, 0, 0.07, -0.2);
    b.boxB(st2, 0.58, 0.05, 0.48, 0, 0.45, -0.2);
    b.add(prismGeo(0.58, 0.18, 0.48), st, [0, 0.5, -0.2]);
    b.add(new THREE.ConeGeometry(0.035, 0.12, 4), st2, [0, 0.74, 0.03]);
    b.boxB(mat('#0e1a12'), 0.18, 0.26, 0.02, 0, 0.07, 0.015);
    b.add(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 8, 1, false, -PI / 2, PI), mat('#0e1a12'), [0, 0.33, 0.015], [PI / 2, 0, 0]);
    b.boxB(mat('#7dffa0', { e: '#30ff70', ei: 1.0, op: 0.55 }), 0.16, 0.24, 0.01, 0, 0.07, 0.03);
    for (const x of [-0.2, 0.2]) columnPart(b, st, x, 0.07, 0.04, 0.38, 0.03, st2);
    b.sph(mat(C.bone), 0.045, 0, 0.42, 0.04, 0, [1, 0.9, 0.8]);
    b.sph(MAT.dark, 0.012, -0.016, 0.425, 0.075); b.sph(MAT.dark, 0.012, 0.016, 0.425, 0.075);
    const ts = mat('#9a9590');
    tombstone(b, ts, -0.34, 0.2, 1, 0.12); tombstone(b, ts, 0.36, 0.24, 0.9, -0.15); tombstone(b, ts, -0.18, 0.36, 0.8, -0.08); tombstone(b, ts, 0.36, -0.05, 0.85, 0.05);
    b.push([-0.4, 0, -0.18]);
    b.cylB(mat('#4a3e36'), 0.018, 0.035, 0.5, 0, 0, 0, 5);
    b.cyl(mat('#4a3e36'), 0.01, 0.018, 0.2, 0.06, 0.42, 0, 5, 0, 0, -0.9);
    b.cyl(mat('#4a3e36'), 0.008, 0.016, 0.16, -0.05, 0.36, 0.02, 5, 0, 0, 1.0);
    b.pop();
    for (let i = 0; i < 5; i++) b.cylB(MAT.iron, 0.006, 0.006, 0.16, 0.12 + i * 0.05, 0.0, 0.38, 4);
    b.box(MAT.iron, 0.24, 0.01, 0.01, 0.22, 0.13, 0.38);
  },
  sign(b) {
    b.add(new THREE.CylinderGeometry(0.16, 0.18, 0.02, 8), mat('#7f8f5a'), [0, 0.01, 0]);
    b.cylB(mat(C.woodDark), 0.025, 0.03, 0.6, 0, 0, 0, 6);
    b.sph(mat('#8a8478'), 0.06, 0.08, 0.02, 0.05, 0, [1, 0.6, 1]);
    const pl = mat(C.plank);
    b.push([0.08, 0.48, 0.03], [0, 0, 0.06]);
    b.box(pl, 0.26, 0.08, 0.025, 0, 0, 0);
    b.add(new THREE.CylinderGeometry(0.057, 0.057, 0.025, 3), pl, [0.13, 0, 0], [PI / 2, 0, -PI / 2], [1, 1, 1]);
    b.pop();
    b.push([-0.08, 0.36, 0.03], [0, 0, -0.08]);
    b.box(mat(C.woodLight), 0.24, 0.07, 0.025, 0, 0, 0);
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.025, 3), mat(C.woodLight), [-0.12, 0, 0], [PI / 2, 0, PI / 2]);
    b.pop();
    for (const [y, x] of [[0.48, 0.06], [0.36, -0.08]]) b.box(mat('#3a2412'), 0.14, 0.012, 0.005, x, y, 0.045);
  },
  prison(b) {
    b.add(new THREE.CylinderGeometry(0.4, 0.42, 0.025, 10), mat('#7a7a6a'), [0, 0.012, 0]);
    const st = mat('#8e887e');
    b.add(new THREE.CylinderGeometry(0.3, 0.33, 0.1, 8), st, [0, 0.06, 0]);
    b.add(new THREE.CylinderGeometry(0.28, 0.3, 0.03, 8), mat('#a49e92'), [0, 0.125, 0]);
    const ir = mat('#4a4f58', { m: 0.35, r: 0.5 });
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; b.cylB(ir, 0.012, 0.012, 0.5, Math.cos(a) * 0.24, 0.14, Math.sin(a) * 0.24, 4); }
    b.add(new THREE.TorusGeometry(0.24, 0.018, 4, 14), ir, [0, 0.36, 0], [PI / 2, 0, 0]);
    b.add(new THREE.SphereGeometry(0.25, 10, 4, 0, TAU, 0, PI / 2), ir, [0, 0.62, 0], null, [1, 0.5, 1]);
    b.add(new THREE.TorusGeometry(0.25, 0.022, 4, 14), ir, [0, 0.63, 0], [PI / 2, 0, 0]);
    b.add(new THREE.TorusGeometry(0.05, 0.012, 4, 8), ir, [0, 0.79, 0]);
    // prisoner
    const pm = mat('#4a3a5a');
    b.cylB(pm, 0.06, 0.08, 0.22, 0, 0.14, -0.04, 7);
    b.sph(mat('#d6a888'), 0.055, 0, 0.42, -0.04, 1);
    b.cyl(pm, 0.02, 0.02, 0.16, 0.07, 0.28, 0.02, 5, -0.9, 0, -0.4);
    b.cyl(pm, 0.02, 0.02, 0.16, -0.07, 0.28, 0.02, 5, -0.9, 0, 0.4);
    // lock
    b.boxB(MAT.goldDim, 0.05, 0.06, 0.02, 0, 0.26, 0.25);
    // torch post
    b.cylB(mat(C.woodDark), 0.015, 0.02, 0.4, 0.36, 0, 0.18, 5);
  },
  teleport(b) {
    b.add(new THREE.CylinderGeometry(0.45, 0.47, 0.03, 12), mat('#6a6a7a'), [0, 0.015, 0]);
    b.boxB(mat('#8e8a96'), 0.7, 0.07, 0.3, 0, 0.02, 0);
    b.boxB(mat('#a29eaa'), 0.6, 0.04, 0.24, 0, 0.09, 0);
    const st = [mat('#9a96a4'), mat('#85818f')];
    const n = 13, R = 0.4, cy = 0.53;
    for (let i = 0; i < n; i++) {
      const a = -PI / 2 + (i + 0.5) / n * TAU;
      if (Math.abs(a + PI / 2) < 0.2) continue;
      b.add(new THREE.BoxGeometry(0.16, 0.12, 0.14), st[i % 2], [Math.cos(a) * R, cy + Math.sin(a) * R, 0], [0, 0, a + PI / 2]);
      b.add(new THREE.BoxGeometry(0.035, 0.035, 0.145), mat('#8ff0ff', { e: '#40c8ff', ei: 1.3 }), [Math.cos(a) * (R - 0.02), cy + Math.sin(a) * (R - 0.02), 0.002], [0, 0, a + PI / 4]);
    }
    b.add(new THREE.BoxGeometry(0.14, 0.16, 0.18), mat('#b2aebd'), [0, cy + R + 0.03, 0]);
    b.add(new THREE.OctahedronGeometry(0.04), mat('#c08aff', { e: '#9040ff', ei: 1.5 }), [0, cy + R + 0.03, 0.095], null, [1, 1.3, 0.5]);
    for (const x of [-0.38, 0.38]) { b.boxB(st[1], 0.08, 0.14, 0.08, x, 0.02, 0.22); b.add(new THREE.OctahedronGeometry(0.035), mat('#8ff0ff', { e: '#40c8ff', ei: 1.3 }), [x, 0.21, 0.22]); }
  },
};

function shrineBuild(level) {
  return (b) => {
    const L = level;
    const colors = { 1: '#6fb8ff', 2: '#7dffb0', 3: '#ffcf4a' };
    const st = mat(L === 3 ? '#efe7d6' : '#d9d2c2'), st2 = mat(L === 3 ? '#cbbf9f' : '#b4ab98');
    const w = 0.5 + L * 0.06;
    b.add(new THREE.CylinderGeometry(w * 0.85, w * 0.9, 0.025, 10), mat('#8a9a6a'), [0, 0.012, 0]);
    b.cylB(st2, w * 0.72, w * 0.76, 0.05, 0, 0.02, 0, L === 1 ? 4 : 8, L === 1 ? PI / 4 : 0);
    b.cylB(st, w * 0.62, w * 0.66, 0.05, 0, 0.07, 0, L === 1 ? 4 : 8, L === 1 ? PI / 4 : 0);
    const n = L === 1 ? 4 : L === 2 ? 6 : 8, cr = w * 0.43, ch = 0.36 + L * 0.06;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + PI / n;
      columnPart(b, st, Math.cos(a) * cr, 0.12, Math.sin(a) * cr, ch, 0.028 + L * 0.004, st2);
    }
    const top = 0.12 + ch;
    b.cylB(st2, cr + 0.06, cr + 0.06, 0.05, 0, top, 0, L === 1 ? 4 : 8, L === 1 ? PI / 4 : 0);
    if (L === 1) b.pyramid(mat('#4a6fae'), cr + 0.05, 0.24, 0, top + 0.05, 0);
    else if (L === 2) b.add(new THREE.SphereGeometry(cr + 0.04, 8, 4, 0, TAU, 0, PI / 2), mat('#3f9a7a'), [0, top + 0.05, 0]);
    else {
      b.cylB(st, cr * 0.8, cr * 0.85, 0.08, 0, top + 0.05, 0, 8);
      b.add(new THREE.SphereGeometry(cr * 0.82, 10, 5, 0, TAU, 0, PI / 2), MAT.gold, [0, top + 0.13, 0]);
      b.coneB(MAT.gold, 0.03, 0.16, 0, top + 0.13 + cr * 0.8, 0, 6);
      for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + PI / 4; b.cylB(MAT.goldDim, 0.04, 0.025, 0.08, Math.cos(a) * w * 0.66, 0.12, Math.sin(a) * w * 0.66, 6); }
    }
    b.coneB(MAT.gold, 0.025, 0.08, 0, top + (L === 1 ? 0.29 : L === 2 ? 0.05 + cr + 0.04 : 0.99), 0, 5);
    // altar
    b.cylB(st2, 0.07, 0.09, 0.12, 0, 0.12, 0, 6);
    b.cylB(mat(colors[L], { e: colors[L], ei: 0.8 }), 0.06, 0.06, 0.01, 0, 0.24, 0, 6);
  };
}

function buildObject(obj) {
  const t = obj.type;
  const anims = [];
  const ph = Math.random() * 10;
  let g;
  let h = 0.8;
  switch (t) {
    case 'windmill': {
      g = cachedGroup('windmill', OBJ_BUILD.windmill);
      const blades = cachedGroup('windmill_blades', (b) => {
        b.cyl(MAT.goldDim, 0.045, 0.045, 0.05, 0, 0, 0, 8, PI / 2);
        for (let i = 0; i < 4; i++) {
          b.push([0, 0, 0.02], [0, 0, (i / 4) * TAU]);
          b.box(mat(C.woodDark), 0.03, 0.62, 0.025, 0, 0.33, 0);
          b.box(mat('#f2e8d2', { ds: true }), 0.15, 0.46, 0.008, 0.09, 0.38, 0.0);
          for (let j = 0; j < 4; j++) b.box(mat(C.wood), 0.16, 0.012, 0.014, 0.09, 0.17 + j * 0.13, 0.006);
          b.box(mat(C.wood), 0.012, 0.47, 0.014, 0.165, 0.38, 0.006);
          b.pop();
        }
      });
      blades.position.set(0, 1.0, 0.3);
      g.add(blades);
      anims.push((dt) => { blades.rotation.z -= dt * 0.9; });
      h = 1.6;
      break;
    }
    case 'waterwheel': {
      g = cachedGroup('waterwheel', OBJ_BUILD.waterwheel);
      const wheel = cachedGroup('waterwheel_wheel', (b) => {
        const w = mat(C.wood), wd = mat(C.woodDark);
        for (const z of [-0.07, 0.07]) b.add(new THREE.TorusGeometry(0.29, 0.018, 4, 16), wd, [0, 0, z]);
        for (let i = 0; i < 8; i++) b.box(w, 0.02, 0.56, 0.02, 0, 0, 0.075, 0, 0, (i / 8) * PI);
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; b.box(w, 0.1, 0.02, 0.16, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0, 0, 0, a); }
        b.cyl(MAT.iron, 0.04, 0.04, 0.2, 0, 0, 0, 8, PI / 2);
      });
      wheel.position.set(0.3, 0.33, 0.24);
      g.add(wheel);
      const foam = glow('#ffffff', 0.35, 0.35, true); foam.position.set(0.3, 0.06, 0.3); g.add(foam);
      anims.push((dt, t) => { wheel.rotation.z -= dt * 0.8; foam.material.opacity = 0.3 + Math.sin(t * 7 + ph) * 0.1; });
      h = 0.85;
      break;
    }
    case 'well': {
      g = cachedGroup('well', OBJ_BUILD.well);
      const gl = glow('#6ab8ff', 0.4, 0.35, true); gl.position.y = 0.25; g.add(gl);
      anims.push((dt, t) => { gl.material.opacity = 0.25 + Math.sin(t * 1.8 + ph) * 0.1; });
      h = 0.9;
      break;
    }
    case 'shrine': {
      const L = Math.max(1, Math.min(3, obj.level || 1));
      g = cachedGroup('shrine' + L, shrineBuild(L));
      const col = { 1: '#6fb8ff', 2: '#7dffb0', 3: '#ffcf4a' }[L];
      const rune = cachedGroup('shrine_rune' + L, (b) => {
        b.add(new THREE.OctahedronGeometry(0.055), mat(col, { e: col, ei: 1.3, r: 0.2 }), [0, 0, 0], null, [1, 1.5, 1]);
        b.add(new THREE.TorusGeometry(0.09, 0.006, 3, 16), mat(col, { e: col, ei: 1.6 }), [0, 0, 0], [PI / 2, 0, 0]);
      });
      rune.position.y = 0.36;
      g.add(rune);
      const gl = glow(col, 0.55, 0.6, true); gl.position.y = 0.36; g.add(gl);
      anims.push((dt, t) => {
        rune.rotation.y += dt * 1.5; rune.position.y = 0.36 + Math.sin(t * 2 + ph) * 0.025;
        gl.material.opacity = 0.45 + Math.sin(t * 2.6 + ph) * 0.15;
      });
      h = 0.7 + L * 0.12;
      break;
    }
    case 'learningStone': {
      g = cachedGroup('learningStone', OBJ_BUILD.learningStone);
      const m = new THREE.MeshBasicMaterial({ map: runeTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: '#9ff4ff' });
      const runes = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.6), m);
      runes.position.set(0, 0.41, 0.066);
      runes.rotation.z = 0.04;
      g.add(runes);
      const gl = glow('#6ff0ff', 0.6, 0.25, true); gl.position.set(0, 0.42, 0.1); g.add(gl);
      anims.push((dt, t) => { const k = 0.65 + Math.sin(t * 1.6 + ph) * 0.3; m.opacity = k; gl.material.opacity = 0.18 * k + 0.05; });
      h = 0.85;
      break;
    }
    case 'marlettoTower': {
      g = cachedGroup('marlettoTower', OBJ_BUILD.marlettoTower);
      const f = makeFlag('#b8322d', 0.24, true); f.position.set(0.018, 1.22 + 0.42 - 0.07, 0); g.add(f);
      h = 1.65;
      break;
    }
    case 'mercenaryCamp': {
      g = cachedGroup('mercenaryCamp', OBJ_BUILD.mercenaryCamp);
      const fire = makeFire(0.7); g.add(fire.group); anims.push(fire.update);
      anims.push(makeSmoke(g, 0, 0.26, 0, { count: 3, size: 0.16, rise: 0.55, opacity: 0.35 }));
      const f = makeFlag('#8e2d2a', 0.18, true); f.position.set(-0.22, 0.42, -0.18); g.add(f);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), mat(C.woodDark)); pole.position.set(-0.22, 0.36, -0.18); g.add(pole);
      h = 0.6;
      break;
    }
    case 'starAxis': {
      g = cachedGroup('starAxis', OBJ_BUILD.starAxis);
      const ringM = mat('#d9a840', { m: 0.35, r: 0.35, e: '#5a3a00', ei: 0.5 });
      const mk = (r, key) => { const m = new THREE.Mesh(_ringGeo(r, key), ringM); m.castShadow = true; return m; };
      const pivot = new THREE.Group(); pivot.position.y = 0.82; g.add(pivot);
      const r1 = mk(0.25, 'a'), r2 = mk(0.2, 'b'), r3 = mk(0.15, 'c');
      r2.rotation.x = PI / 2; r3.rotation.y = PI / 2;
      const ecl = new THREE.Group(); ecl.rotation.z = 0.4; ecl.add(r1); pivot.add(ecl, r2, r3);
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), mat('#bfe6ff', { e: '#6ab8ff', ei: 1.6 }));
      pivot.add(orb);
      const gl = glow('#8fd0ff', 0.6, 0.55, true); pivot.add(gl);
      const sp = [];
      for (let i = 0; i < 4; i++) { const s = sparkle('#e8f4ff', 0.1); pivot.add(s); sp.push(s); }
      anims.push((dt, t) => {
        r1.rotation.z += dt * 0.6; r2.rotation.z -= dt * 0.9; r3.rotation.x += dt * 0.5; pivot.rotation.y += dt * 0.3;
        gl.material.opacity = 0.45 + Math.sin(t * 2 + ph) * 0.12;
        sp.forEach((s, i) => { const a = t * 0.7 + i * 1.6 + ph; s.position.set(Math.cos(a) * 0.3, Math.sin(a * 1.3) * 0.2, Math.sin(a) * 0.3); s.scale.setScalar(0.04 + 0.07 * Math.max(0, Math.sin(t * 3 + i * 2))); });
      });
      h = 1.15;
      break;
    }
    case 'gardenOfRevelation': {
      g = cachedGroup('garden', OBJ_BUILD.gardenOfRevelation);
      const gl = glow('#7fe8ff', 0.5, 0.5, true); gl.position.set(0, 0.36, -0.12); g.add(gl);
      addTwinkles(g, anims, '#e8ffff', 3, 0.15, 0.3, 0.2, 0.12);
      anims.push((dt, t) => { gl.material.opacity = 0.4 + Math.sin(t * 2.2 + ph) * 0.15; });
      h = 0.6;
      break;
    }
    case 'witchHut': {
      g = cachedGroup('witchHut', OBJ_BUILD.witchHut);
      anims.push(makeSmoke(g, -0.11, 0.98, -0.1, { count: 4, size: 0.2, rise: 0.7, color: '#a8b89a', opacity: 0.5 }));
      const gl = glow('#7dff4a', 0.35, 0.6, true); gl.position.set(0.27, 0.16, 0.22); g.add(gl);
      const w = glow('#8aff5a', 0.2, 0.6); w.position.set(0.1, 0.58, 0.14); g.add(w);
      anims.push((dt, t) => { gl.material.opacity = 0.45 + Math.sin(t * 4 + ph) * 0.15; });
      h = 1.15;
      break;
    }
    case 'treeOfKnowledge': {
      g = cachedGroup('treeOfKnowledge', OBJ_BUILD.treeOfKnowledge);
      const fruit = cachedGroup('tok_fruit', (b) => {
        const fm = mat('#ffd040', { e: '#ffb000', ei: 1.2, r: 0.3 });
        const R = rng(5);
        const blobs = [[0, 1.0, 0, 0.34], [-0.28, 0.82, 0.04, 0.26], [0.28, 0.84, 0.0, 0.27], [0, 0.85, 0.22, 0.25], [0.05, 0.86, -0.22, 0.26], [-0.16, 1.12, -0.05, 0.22], [0.17, 1.1, 0.05, 0.22]];
        for (let i = 0; i < 16; i++) {
          const [x, y, z, r] = blobs[i % blobs.length];
          const a = R() * PI + PI * 0.1, el = (R() - 0.3) * 1.1;
          b.sph(fm, 0.035, x + Math.cos(a) * Math.cos(el) * r * 0.98, y + Math.sin(el) * r, z + Math.abs(Math.sin(a)) * Math.cos(el) * r * 0.98, 1);
        }
      });
      fruit.children.forEach((m) => (m.castShadow = false));
      g.add(fruit);
      const gls = [];
      for (const [x, y, z] of [[0, 1.05, 0.3], [-0.3, 0.85, 0.22], [0.3, 0.9, 0.2], [0.05, 0.75, 0.42]]) { const gl = glow('#ffd860', 0.32, 0.5, true); gl.position.set(x, y, z); g.add(gl); gls.push(gl); }
      addTwinkles(g, anims, '#fff4c0', 4, 0.35, 0.7, 0.5, 0.14);
      anims.push((dt, t) => gls.forEach((gl, i) => { gl.material.opacity = 0.35 + Math.sin(t * 1.8 + i * 1.9 + ph) * 0.18; }));
      h = 1.4;
      break;
    }
    case 'stables': g = cachedGroup('stables', OBJ_BUILD.stables); h = 0.7; break;
    case 'fountain': {
      g = cachedGroup('fountain', OBJ_BUILD.fountain);
      const spray = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6, 1, true), mat('#bff0ff', { e: '#60c8ff', ei: 1.0, op: 0.6, ds: true }));
      spray.position.y = 0.68; spray.rotation.x = PI; g.add(spray);
      addTwinkles(g, anims, '#fff1b0', 5, 0.28, 0.16, 0.03, 0.12);
      anims.push((dt, t) => { spray.scale.set(1 + Math.sin(t * 9 + ph) * 0.1, 1 + Math.sin(t * 7 + ph) * 0.12, 1 + Math.cos(t * 8 + ph) * 0.1); });
      h = 0.75;
      break;
    }
    case 'temple': {
      g = cachedGroup('temple', OBJ_BUILD.temple);
      for (const x of [-0.31, 0.31]) { const bn = makeBanner('#b8282d', 0.28); bn.position.set(x, 0.72, -0.37); g.add(bn); }
      for (const x of [-0.36, 0.36]) { const f = makeFire(0.45); f.group.position.set(x, 0.24, 0.26); g.add(f.group); anims.push(f.update); }
      h = 0.9;
      break;
    }
    case 'lookout': g = cachedGroup('lookout', OBJ_BUILD.lookout); h = 2.0; break;
    case 'pandora': {
      g = cachedGroup('pandora', OBJ_BUILD.pandora);
      const gl = glow('#ffb8ff', 0.75, 0.5, true); gl.position.y = 0.36; g.add(gl);
      addTwinkles(g, anims, '#ffe0ff', 4, 0.22, 0.3, 0.3, 0.14);
      anims.push((dt, t) => { gl.material.opacity = 0.35 + Math.sin(t * 2.4 + ph) * 0.15; gl.scale.setScalar(0.7 + Math.sin(t * 1.5 + ph) * 0.06); });
      h = 0.6;
      break;
    }
    case 'crypt': {
      g = cachedGroup('crypt', OBJ_BUILD.crypt);
      const gl = glow('#50ff8a', 0.55, 0.5, true); gl.position.set(0, 0.2, 0.06); g.add(gl);
      const wisps = [];
      for (let i = 0; i < 3; i++) { const w = glow('#8affb0', 0.1, 0.8, true); g.add(w); wisps.push(w); }
      anims.push((dt, t) => {
        gl.material.opacity = 0.38 + Math.sin(t * 1.7 + ph) * 0.15 + Math.sin(t * 7.3) * 0.04;
        wisps.forEach((w, i) => { const a = t * 0.6 + i * 2.1 + ph; w.position.set(Math.cos(a) * 0.38, 0.2 + Math.sin(a * 1.7) * 0.08 + 0.1, 0.12 + Math.sin(a) * 0.25); w.material.opacity = 0.5 + 0.4 * Math.sin(t * 3 + i); });
      });
      h = 0.8;
      break;
    }
    case 'sign': g = cachedGroup('sign', OBJ_BUILD.sign); h = 0.65; break;
    case 'prison': {
      g = cachedGroup('prison', OBJ_BUILD.prison);
      const f = makeFire(0.4); f.group.position.set(0.36, 0.4, 0.18); g.add(f.group); anims.push(f.update);
      h = 0.85;
      break;
    }
    case 'teleport': {
      g = cachedGroup('teleport', OBJ_BUILD.teleport);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), portalMaterial());
      disc.position.set(0, 0.53, 0);
      disc.renderOrder = 2;
      g.add(disc);
      const gl = glow('#8a6aff', 1.1, 0.4, true); gl.position.set(0, 0.53, 0.05); g.add(gl);
      const sp = [];
      for (let i = 0; i < 4; i++) { const s = sparkle('#b0f4ff', 0.1); g.add(s); sp.push(s); }
      anims.push((dt, t) => {
        disc.rotation.z = -t * 0.6;
        gl.material.opacity = 0.32 + Math.sin(t * 2.3 + ph) * 0.1;
        sp.forEach((s, i) => { const k = (t * 0.5 + i / 4 + ph) % 1; const a = i * 1.7 + t; s.position.set(Math.cos(a) * 0.3 * (1 - k), 0.53 + Math.sin(a) * 0.3 * (1 - k), 0.05); s.scale.setScalar(0.12 * (1 - k)); });
      });
      h = 1.0;
      break;
    }
    default:
      return null;
  }
  g.userData.height = h;
  return finish(g, anims);
}
const _ringGeos = {};
function _ringGeo(r, key) { return _ringGeos[key] || (_ringGeos[key] = new THREE.TorusGeometry(r, 0.012, 4, 28)); }

// ---------------------------------------------------------------------------
//  Town models for the adventure map (3x3, gate at +Z)
// ---------------------------------------------------------------------------
function wallSeg(b, m, mm, x1, z1, x2, z2, h, t = 0.12, merlon = 'box') {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx);
  b.push([(x1 + x2) / 2, 0, (z1 + z2) / 2], [0, ang, 0]);
  b.boxB(m, len, h, t, 0, 0.03, 0);
  b.boxB(mm, len + 0.01, 0.04, t + 0.03, 0, h - 0.04, 0);
  const n = Math.max(2, Math.round(len / 0.13));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + 0.5) * (len / n);
    if (merlon === 'box') b.boxB(m, len / n * 0.55, 0.07, t + 0.02, x, h + 0.03, 0);
    else b.add(new THREE.ConeGeometry(0.035, 0.12, 4), m, [x, h + 0.09, t / 2], [0, PI / 4, 0]);
  }
  b.pop();
}
const CASTLE_FLAGS = [[-1.3, 0.55, 1.64], [1.3, 0.55, 1.64], [-1.3, -1.35, 1.64], [1.3, -1.35, 1.64], [0, -0.55, 2.52]];
const CASTLE_BANNERS = [[-0.3, 0.76, 0.62], [0.3, 0.76, 0.62], [-0.2, 0.92, -0.17], [0.2, 0.92, -0.17]];
function castleTownBuild(b) {
  const W = mat('#eee8da'), W2 = mat('#d2c9b6'), W3 = mat('#bdb39e'), roof = mat('#3a6cc8'), roofD = mat('#2c56a6'), gold = MAT.gold;
  const win = mat('#ffe39a', { e: '#ffb640', ei: 0.9 });
  b.boxB(mat('#b7ad97'), 2.82, 0.03, 2.08, 0, 0, -0.4);
  b.boxB(mat('#c8bfa9'), 0.5, 0.032, 0.5, 0, 0, 0.62);
  // walls
  const wh = 0.44;
  wallSeg(b, W, W2, -1.3, 0.55, -0.32, 0.55, wh);
  wallSeg(b, W, W2, 0.32, 0.55, 1.3, 0.55, wh);
  wallSeg(b, W, W2, -1.3, 0.55, -1.3, -1.35, wh);
  wallSeg(b, W, W2, 1.3, 0.55, 1.3, -1.35, wh);
  wallSeg(b, W, W2, -1.3, -1.35, 1.3, -1.35, wh);
  // corner towers
  const tower = (x, z, r, h, rr, rh) => {
    b.cylB(W, r, r * 1.08, h, x, 0.03, z, 10);
    b.cylB(W3, r * 1.12, r * 1.12, 0.05, x, 0.03, z, 10);
    b.cylB(W2, r + 0.035, r, 0.07, x, h - 0.04, z, 10);
    b.coneB(roof, rr, rh, x, h + 0.03, z, 10);
    b.cylB(gold, rr * 1.01, rr * 1.01, 0.02, x, h + 0.03, z, 10);
    b.boxB(MAT.dark, 0.035, 0.1, 0.02, x, h * 0.55, z + r - 0.005);
    b.boxB(win, 0.04, 0.07, 0.02, x, h * 0.78, z + r - 0.005);
  };
  for (const [x, z] of [[-1.3, 0.55], [1.3, 0.55], [-1.3, -1.35], [1.3, -1.35]]) { tower(x, z, 0.21, 0.92, 0.27, 0.5); polePart(b, x, z, 0.22, 1.42); }
  // gatehouse
  tower(-0.3, 0.6, 0.15, 0.78, 0.19, 0.36);
  tower(0.3, 0.6, 0.15, 0.78, 0.19, 0.36);
  b.boxB(W, 0.46, 0.56, 0.24, 0, 0.03, 0.56);
  b.boxB(W2, 0.5, 0.05, 0.27, 0, 0.56, 0.56);
  for (let i = 0; i < 4; i++) b.boxB(W, 0.07, 0.07, 0.26, -0.18 + i * 0.12, 0.61, 0.56);
  b.boxB(MAT.dark, 0.22, 0.26, 0.04, 0, 0.03, 0.67);
  b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 10, 1, false, -PI / 2, PI), MAT.dark, [0, 0.29, 0.67], [PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) b.boxB(mat('#3a3a40'), 0.012, 0.3, 0.012, -0.075 + i * 0.05, 0.05, 0.69);
  b.add(new THREE.TorusGeometry(0.13, 0.02, 4, 10, PI), W2, [0, 0.29, 0.685]);
  b.add(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 8), gold, [0, 0.46, 0.685], [PI / 2, 0, 0]);
  // keep
  const kz = -0.55;
  b.boxB(W, 0.86, 1.0, 0.72, 0, 0.03, kz);
  b.boxB(W3, 0.9, 0.06, 0.76, 0, 0.03, kz);
  b.boxB(W2, 0.92, 0.06, 0.78, 0, 0.98, kz);
  for (let i = 0; i < 6; i++) b.boxB(W, 0.08, 0.08, 0.8, -0.38 + i * 0.152, 1.04, kz);
  b.boxB(W, 0.62, 0.42, 0.5, 0, 1.03, kz);
  b.boxB(W2, 0.66, 0.05, 0.54, 0, 1.43, kz);
  b.pyramid(roof, 0.36, 0.5, 0, 1.47, kz);
  b.add(new THREE.ConeGeometry(0.06, 0.55, 6), roofD, [0, 1.97 + 0.27, kz]);
  b.sph(gold, 0.04, 0, 1.97, kz);
  polePart(b, 0, kz, 0.2, 2.32);
  for (const [x, z] of [[-0.43, kz + 0.36], [0.43, kz + 0.36], [-0.43, kz - 0.36], [0.43, kz - 0.36]]) {
    b.cylB(W, 0.1, 0.1, 1.28, x, 0.03, z, 8);
    b.cylB(W2, 0.125, 0.1, 0.06, x, 1.25, z, 8);
    b.coneB(roof, 0.14, 0.4, x, 1.31, z, 8);
    b.sph(gold, 0.025, x, 1.73, z);
  }
  for (const [x, y] of [[-0.22, 0.5], [0.22, 0.5], [-0.22, 0.78], [0.22, 0.78], [0, 1.2], [-0.18, 1.2], [0.18, 1.2]]) {
    const zf = y > 1 ? kz + 0.255 : kz + 0.365;
    b.boxB(win, 0.07, 0.11, 0.02, x, y, zf);
    b.add(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 8, 1, false, -PI / 2, PI), win, [x, y + 0.11, zf], [PI / 2, 0, 0]);
  }
  b.boxB(mat('#6a3a1e'), 0.16, 0.24, 0.02, 0, 0.03, kz + 0.365);
  b.add(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 8, 1, false, -PI / 2, PI), mat('#6a3a1e'), [0, 0.27, kz + 0.365], [PI / 2, 0, 0]);
  b.box(gold, 0.86, 0.025, 0.02, 0, 0.92, kz + 0.365);
  // inner buildings
  const house = (x, z, w, h, d, rc, ry = 0) => {
    b.push([x, 0.03, z], [0, ry, 0]);
    b.boxB(mat('#efe2c6'), w, h, d, 0, 0, 0);
    for (const s of [-1, 1]) b.boxB(mat('#7a5232'), 0.025, h, 0.02, s * w * 0.48, 0, d / 2 + 0.005);
    b.roof(mat(rc), w + 0.06, h * 0.8, d + 0.08, 0, h, 0, true);
    b.boxB(win, 0.05, 0.06, 0.02, 0, h * 0.45, d / 2 + 0.006);
    b.pop();
  };
  house(-0.78, 0.0, 0.34, 0.26, 0.3, '#b8452e');
  house(-0.72, -0.62, 0.3, 0.3, 0.34, '#3a6cc8', 0.1);
  house(0.78, 0.0, 0.34, 0.26, 0.3, '#b8452e');
  house(0.75, -0.66, 0.3, 0.28, 0.3, '#b8452e', -0.1);
  // chapel steeple
  b.boxB(W, 0.16, 0.6, 0.16, 0.95, 0.03, -0.95);
  b.pyramid(roof, 0.1, 0.3, 0.95, 0.63, -0.95);
  b.boxB(win, 0.05, 0.08, 0.02, 0.95, 0.42, -0.865);
  // trees inside
  for (const [x, z] of [[-1.0, -1.05], [-0.42, 0.18], [0.42, 0.18]]) {
    b.cylB(mat(C.bark), 0.025, 0.03, 0.12, x, 0.03, z, 5);
    b.add(jitter(new THREE.IcosahedronGeometry(0.11, 0), 0.015, x * 9), mat(C.leaf), [x, 0.22, z]);
  }
}
const NECRO_FLAGS = [[-1.3, 0.55, 1.75], [1.3, 0.55, 1.75], [-1.3, -1.35, 1.75], [1.3, -1.35, 1.75], [0, -0.6, 2.56]];
const NECRO_BANNERS = [[-0.33, 0.78, 0.66], [0.33, 0.78, 0.66]];
function necroTownBuild(b) {
  const W = mat('#4a4452'), W2 = mat('#37323e'), W3 = mat('#5d5666'), roof = mat('#5e3a86'), roofD = mat('#47296a');
  const bone = mat(C.bone), win = mat('#7dffa0', { e: '#2cff6a', ei: 1.3 });
  b.boxB(mat('#3e3a40'), 2.82, 0.03, 2.08, 0, 0, -0.4);
  b.boxB(mat('#4c4650'), 0.5, 0.032, 0.5, 0, 0, 0.62);
  const wh = 0.46;
  wallSeg(b, W, W2, -1.3, 0.55, -0.34, 0.55, wh, 0.12, 'spike');
  wallSeg(b, W, W2, 0.34, 0.55, 1.3, 0.55, wh, 0.12, 'spike');
  wallSeg(b, W, W2, -1.3, 0.55, -1.3, -1.35, wh, 0.12, 'spike');
  wallSeg(b, W, W2, 1.3, 0.55, 1.3, -1.35, wh, 0.12, 'spike');
  wallSeg(b, W, W2, -1.3, -1.35, 1.3, -1.35, wh, 0.12, 'spike');
  // bone spikes on front wall
  for (let i = 0; i < 6; i++) {
    const x = -1.15 + i * 0.16 + (i > 2 ? 1.34 : 0) - (i > 2 ? 0.0 : 0);
    if (Math.abs(x) < 0.4) continue;
    b.add(new THREE.ConeGeometry(0.018, 0.14, 4), bone, [x, 0.3, 0.66], [PI / 2 - 0.3, 0, 0]);
  }
  const tower = (x, z, r, h, rr, rh) => {
    b.cylB(W, r * 0.92, r * 1.1, h, x, 0.03, z, 6);
    b.cylB(W2, r + 0.04, r * 0.95, 0.07, x, h - 0.04, z, 6);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; b.add(new THREE.ConeGeometry(0.025, 0.12, 4), W3, [x + Math.cos(a) * (r + 0.02), h + 0.08, z + Math.sin(a) * (r + 0.02)]); }
    b.coneB(roof, rr, rh, x, h + 0.02, z, 6);
    b.boxB(win, 0.035, 0.12, 0.02, x, h * 0.6, z + r * 0.9);
    b.boxB(win, 0.03, 0.08, 0.02, x, h * 0.3, z + r * 0.92);
  };
  for (const [x, z] of [[-1.3, 0.55], [1.3, 0.55], [-1.3, -1.35], [1.3, -1.35]]) { tower(x, z, 0.2, 0.86, 0.2, 0.72); polePart(b, x, z, 0.2, 1.55); }
  // skull gate
  tower(-0.33, 0.62, 0.15, 0.82, 0.15, 0.55);
  tower(0.33, 0.62, 0.15, 0.82, 0.15, 0.55);
  b.boxB(W, 0.52, 0.56, 0.24, 0, 0.03, 0.57);
  b.boxB(W2, 0.56, 0.05, 0.27, 0, 0.56, 0.57);
  b.boxB(mat('#0a0d0b'), 0.22, 0.27, 0.04, 0, 0.03, 0.68);
  b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 3, 1, false, -PI / 2, PI), mat('#0a0d0b'), [0, 0.3, 0.68], [PI / 2, 0, 0], [1, 1, 1.4]);
  b.add(new THREE.IcosahedronGeometry(0.13, 1), bone, [0, 0.52, 0.66], null, [1, 0.92, 0.8]);
  b.box(bone, 0.13, 0.06, 0.08, 0, 0.4, 0.7);
  for (let i = 0; i < 4; i++) b.box(mat('#c9bfa4'), 0.012, 0.03, 0.01, -0.045 + i * 0.03, 0.39, 0.745);
  b.sph(mat('#9dffb8', { e: '#30ff70', ei: 2 }), 0.03, -0.045, 0.53, 0.75);
  b.sph(mat('#9dffb8', { e: '#30ff70', ei: 2 }), 0.03, 0.045, 0.53, 0.75);
  b.add(new THREE.ConeGeometry(0.02, 0.03, 3), MAT.dark, [0, 0.47, 0.76], [PI, 0, 0]);
  for (const s of [-1, 1]) b.add(new THREE.ConeGeometry(0.03, 0.22, 5), bone, [s * 0.16, 0.66, 0.62], [0, 0, -s * 0.7]);
  // cathedral
  const kz = -0.6;
  b.boxB(W, 0.8, 0.9, 0.8, 0, 0.03, kz);
  b.boxB(W2, 0.84, 0.05, 0.84, 0, 0.03, kz);
  b.add(prismGeo(0.84, 0.45, 0.86), roof, [0, 0.93, kz]);
  b.boxB(W, 0.42, 0.5, 0.42, 0, 0.93, kz);
  b.boxB(W2, 0.46, 0.05, 0.46, 0, 1.42, kz);
  b.add(new THREE.ConeGeometry(0.28, 1.0, 4).rotateY(PI / 4), roof, [0, 1.47 + 0.5, kz]);
  polePart(b, 0, kz, 0.2, 2.36);
  for (const [x, z] of [[-0.4, kz + 0.4], [0.4, kz + 0.4], [-0.4, kz - 0.4], [0.4, kz - 0.4]]) {
    b.cylB(W3, 0.07, 0.09, 1.1, x, 0.03, z, 6);
    b.coneB(roofD, 0.09, 0.55, x, 1.13, z, 6);
    b.add(new THREE.ConeGeometry(0.015, 0.12, 4), bone, [x, 1.75, z]);
  }
  // rose window + gothic windows
  b.add(new THREE.CircleGeometry(0.12, 10), win, [0, 0.72, kz + 0.405]);
  b.add(new THREE.TorusGeometry(0.125, 0.02, 4, 10), W3, [0, 0.72, kz + 0.41]);
  for (const x of [-0.2, 0.2]) {
    b.boxB(win, 0.07, 0.22, 0.02, x, 0.25, kz + 0.405);
    b.add(new THREE.ConeGeometry(0.05, 0.08, 4).rotateY(PI / 4), win, [x, 0.51, kz + 0.405], null, [1, 1, 0.3]);
  }
  b.boxB(win, 0.06, 0.18, 0.02, 0, 1.12, kz + 0.215);
  b.boxB(mat('#0a0d0b'), 0.16, 0.26, 0.02, 0, 0.03, kz + 0.405);
  // crypts & obelisks inside
  const crypt = (x, z, ry) => {
    b.push([x, 0.03, z], [0, ry, 0]);
    b.boxB(W3, 0.3, 0.22, 0.26, 0, 0, 0);
    b.add(prismGeo(0.34, 0.14, 0.3), roofD, [0, 0.22, 0]);
    b.boxB(win, 0.07, 0.11, 0.02, 0, 0.0, 0.135);
    b.pop();
  };
  crypt(-0.8, -0.05, 0.1); crypt(0.8, -0.05, -0.1); crypt(-0.78, -0.75, 0); crypt(0.82, -0.8, 0);
  for (const [x, z] of [[-0.45, 0.2], [0.45, 0.2], [-1.02, -1.08], [1.02, -1.08]]) {
    b.boxB(W2, 0.08, 0.04, 0.08, x, 0.03, z);
    b.add(new THREE.CylinderGeometry(0.0, 0.04, 0.42, 4).rotateY(PI / 4), W3, [x, 0.28, z]);
  }
  // ribcage arches along back wall
  for (const x of [-0.75, 0.75]) for (let i = 0; i < 4; i++) b.add(new THREE.TorusGeometry(0.12 - i * 0.012, 0.012, 3, 8, PI), bone, [x - 0.15 + i * 0.1, 0.5, -1.27], [0, PI / 2, 0]);
  // dead trees
  for (const [x, z] of [[-1.05, 0.25], [1.05, 0.25]]) {
    b.cylB(mat('#3a302a'), 0.012, 0.025, 0.32, x, 0.03, z, 5);
    b.cyl(mat('#3a302a'), 0.007, 0.012, 0.13, x + 0.04, 0.28, z, 4, 0, 0, -0.9);
    b.cyl(mat('#3a302a'), 0.007, 0.012, 0.1, x - 0.03, 0.24, z, 4, 0, 0, 0.9);
  }
}

export function createTownMapModel(faction) {
  const isNecro = faction === 'necropolis';
  const g = cachedGroup(isNecro ? 'town_necro' : 'town_castle', isNecro ? necroTownBuild : castleTownBuild);
  const flags = [];
  for (const [x, z, h] of isNecro ? NECRO_FLAGS : CASTLE_FLAGS) {
    const f = makeFlag(NEUTRAL_FLAG, h > 2 ? 0.34 : 0.26, isNecro);
    f.position.set(x + 0.018, h - (h > 2 ? 0.08 : 0.07), z);
    g.add(f); flags.push(f);
  }
  for (const [x, y, z] of isNecro ? NECRO_BANNERS : CASTLE_BANNERS) {
    const bn = makeBanner(NEUTRAL_FLAG, 0.36);
    bn.position.set(x, y, z + 0.13);
    g.add(bn); flags.push(bn);
  }
  const anims = [];
  const ph = Math.random() * 10;
  if (isNecro) {
    const eyes = glow('#40ff80', 0.42, 0.55, true); eyes.position.set(0, 0.53, 0.8); g.add(eyes);
    const rose = glow('#40ff80', 0.6, 0.4, true); rose.position.set(0, 0.72, -0.15); g.add(rose);
    const wisps = [];
    for (let i = 0; i < 4; i++) { const w = glow('#8affb0', 0.13, 0.7, true); g.add(w); wisps.push(w); }
    anims.push((dt, t) => {
      eyes.material.opacity = 0.45 + Math.sin(t * 2.1 + ph) * 0.15;
      rose.material.opacity = 0.32 + Math.sin(t * 1.3 + ph) * 0.1;
      wisps.forEach((w, i) => { const a = t * 0.35 + i * 1.6 + ph; w.position.set(Math.cos(a) * 1.05, 0.7 + Math.sin(a * 2.3 + i) * 0.25, -0.4 + Math.sin(a) * 0.8); w.material.opacity = 0.45 + 0.35 * Math.sin(t * 2 + i * 1.3); });
    });
  } else {
    const gl = glow('#ffd88a', 0.5, 0.3, true); gl.position.set(0, 0.95, -0.15); g.add(gl);
    anims.push((dt, t) => { gl.material.opacity = 0.22 + Math.sin(t * 1.5 + ph) * 0.06; });
    anims.push(makeSmoke(g, -0.72, 0.62, -0.62, { count: 3, size: 0.16, rise: 0.5, opacity: 0.3 }));
  }
  g.userData.flagMeshes = flags;
  g.userData.setOwnerColor = (c) => { const m1 = flagMat(c || NEUTRAL_FLAG, 'flag'), m2 = flagMat(c || NEUTRAL_FLAG, 'banner'); flags.forEach((f) => { f.material = f.geometry === bannerGeo() ? m2 : m1; }); };
  g.userData.height = 2.6;
  g.userData.faction = isNecro ? 'necropolis' : 'castle';
  g.name = 'town_' + g.userData.faction;
  return finish(g, anims);
}

// ---------------------------------------------------------------------------
//  Decorations (vertex-colored, for InstancedMesh with one shared material)
// ---------------------------------------------------------------------------
class VBuilder {
  constructor(seed = 1) { this.geos = []; this.R = rng(seed); this.stack = [new THREE.Matrix4()]; }
  top() { return this.stack[this.stack.length - 1]; }
  push(p, r, s) { this.stack.push(this.top().clone().multiply(compose(p, r, s))); return this; }
  pop() { this.stack.pop(); return this; }
  add(geo, color, p, r, s, o = {}) {
    const g = o.jit ? jitter(geo, o.jit, o.seed ?? Math.floor(this.R() * 1000)) : prep(geo);
    g.applyMatrix4(this.top().clone().multiply(compose(p, r, s)));
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    const base = new THREE.Color(color), c = new THREE.Color();
    const cj = o.cj ?? 0.06;
    for (let f = 0; f < n; f += 3) {
      c.copy(base).offsetHSL((this.R() - 0.5) * 0.015, 0, (this.R() - 0.5) * cj);
      for (let k = 0; k < 3 && f + k < n; k++) { col[(f + k) * 3] = c.r; col[(f + k) * 3 + 1] = c.g; col[(f + k) * 3 + 2] = c.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geos.push(g);
    return this;
  }
  build(sway = 'tree') {
    const g = mergeGeometries(this.geos, false);
    g.computeBoundingBox();
    g.computeVertexNormals();
    const H = Math.max(0.01, g.boundingBox.max.y);
    const p = g.attributes.position, n = g.attributes.normal, col = g.attributes.color;
    const sw = new Float32Array(p.count);
    const uvs = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = Math.min(1, Math.max(0, y / H));
      sw[i] = sway === 'rigid' ? 0 : sway === 'tree' ? Math.pow(k, 1.4) : k;
      // Ground ambient occlusion & crown sun-kissed gradient
      const ao = 0.80 + 0.25 * Math.min(1, Math.pow(k, 0.65));
      col.setXYZ(i, Math.min(1, col.getX(i) * ao), Math.min(1, col.getY(i) * ao), Math.min(1, col.getZ(i) * ao));
      const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
      if (ny > nx && ny > nz) { uvs[i * 2] = x * 2.0; uvs[i * 2 + 1] = z * 2.0; }
      else if (nx > nz) { uvs[i * 2] = z * 2.0; uvs[i * 2 + 1] = y * 2.0; }
      else { uvs[i * 2] = x * 2.0; uvs[i * 2 + 1] = y * 2.0; }
    }
    g.setAttribute('sway', new THREE.BufferAttribute(sw, 1));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.computeBoundingSphere();
    return g;
  }
}
/** Recolor each triangle via fn(cx, cy, cz, ny, R) -> THREE.Color|hex. */
function recolorFaces(g, fn, seed = 1) {
  const p = g.attributes.position, col = g.attributes.color, R = rng(seed);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), cc = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    const res = fn((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3, n.y, R);
    if (res == null) continue;
    cc.set(res);
    cc.offsetHSL(0, 0, (R() - 0.5) * 0.05);
    for (let k = 0; k < 3; k++) col.setXYZ(i + k, cc.r, cc.g, cc.b);
  }
}

function peak(v, r, h, x, z, seed, seg = 7, color = '#888888') {
  v.add(new THREE.ConeGeometry(r, h, seg, 3), color, [x, h / 2, z], [0, seed, 0], null, { jit: r * 0.13, seed });
}
const DECOR_BUILD = {
  pine() {
    const v = new VBuilder(1);
    v.add(new THREE.CylinderGeometry(0.036, 0.068, 0.28, 7), '#5e3f24', [0, 0.14, 0]);
    const tiers = [
      [0.36, 0.38, 0.14, '#1f542b'],
      [0.30, 0.34, 0.32, '#276634'],
      [0.23, 0.30, 0.50, '#317a3e'],
      [0.15, 0.26, 0.68, '#3d8f49'],
    ];
    tiers.forEach(([r, h, y, c], i) => v.add(new THREE.ConeGeometry(r, h, 9, 1), c, [0, y + h / 2, 0], [0, i * 0.65, 0], null, { jit: 0.022, cj: 0.08 }));
    return v.build('tree');
  },
  snowPine() {
    const v = new VBuilder(2);
    v.add(new THREE.CylinderGeometry(0.036, 0.068, 0.28, 7), '#543b28', [0, 0.14, 0]);
    const tiers = [[0.36, 0.38, 0.14], [0.29, 0.34, 0.33], [0.22, 0.30, 0.52], [0.15, 0.26, 0.69]];
    tiers.forEach(([r, h, y], i) => {
      v.add(new THREE.ConeGeometry(r, h, 9, 1), '#245238', [0, y + h / 2, 0], [0, i * 0.65, 0], null, { jit: 0.02, cj: 0.06 });
      v.add(new THREE.ConeGeometry(r * 0.74, h * 0.52, 9, 1), '#f2f6fa', [0, y + h * 0.74 + 0.012, 0], [0, i * 0.65 + 0.2, 0], null, { jit: 0.012, cj: 0.03 });
    });
    for (let i = 0; i < 5; i++) v.add(new THREE.SphereGeometry(0.06, 5, 3, 0, TAU, 0, PI / 2), '#eef3f8', [Math.cos(i * 1.3) * 0.24, 0.0, Math.sin(i * 1.3) * 0.24], null, [1.3, 0.4, 1.3], { cj: 0.02 });
    return v.build('tree');
  },
  oak() {
    const v = new VBuilder(3);
    v.add(new THREE.CylinderGeometry(0.045, 0.085, 0.42, 7), '#634124', [0, 0.21, 0], null, null, { jit: 0.01 });
    v.add(new THREE.CylinderGeometry(0.022, 0.038, 0.22, 5), '#634124', [0.07, 0.42, 0], [0, 0, -0.7]);
    v.add(new THREE.CylinderGeometry(0.022, 0.038, 0.20, 5), '#634124', [-0.06, 0.4, 0.02], [0.2, 0, 0.7]);
    const blobs = [
      [0, 0.62, 0, 0.28, '#3c842c'],
      [-0.18, 0.52, 0.08, 0.20, '#4a9636'],
      [0.19, 0.54, -0.04, 0.21, '#347626'],
      [0.02, 0.81, -0.02, 0.19, '#5ca840'],
      [0.04, 0.55, -0.18, 0.19, '#2e6c22'],
      [-0.08, 0.70, -0.10, 0.17, '#4f9c3a'],
      [0.12, 0.69, 0.11, 0.16, '#56a43e'],
    ];
    blobs.forEach(([x, y, z, r, c], i) => v.add(new THREE.IcosahedronGeometry(r, 1), c, [x, y, z], [i, i, 0], [1, 0.9, 1], { jit: r * 0.12, cj: 0.08 }));
    return v.build('tree');
  },
  deadTree() {
    const v = new VBuilder(4);
    const c = '#6d5c4c';
    v.add(new THREE.CylinderGeometry(0.035, 0.06, 0.45, 6), c, [0, 0.225, 0], [0, 0, 0.05], null, { jit: 0.008 });
    v.add(new THREE.CylinderGeometry(0.02, 0.035, 0.32, 5), c, [-0.03, 0.58, 0], [0, 0, 0.25]);
    v.add(new THREE.CylinderGeometry(0.012, 0.025, 0.28, 5), c, [0.1, 0.5, 0.02], [0.1, 0, -0.9]);
    v.add(new THREE.CylinderGeometry(0.01, 0.02, 0.22, 5), c, [-0.12, 0.42, -0.02], [-0.2, 0, 1.0]);
    v.add(new THREE.CylinderGeometry(0.008, 0.016, 0.18, 4), c, [0.02, 0.78, 0.02], [0, 0, -0.5]);
    v.add(new THREE.CylinderGeometry(0.008, 0.014, 0.16, 4), c, [0.2, 0.62, 0.02], [0, 0, -0.2]);
    v.add(new THREE.CylinderGeometry(0.006, 0.012, 0.14, 4), c, [-0.13, 0.66, 0.0], [0.3, 0, 0.6]);
    for (let i = 0; i < 3; i++) v.add(new THREE.CylinderGeometry(0.01, 0.03, 0.14, 4), c, [Math.cos(i * 2.1) * 0.06, 0.03, Math.sin(i * 2.1) * 0.06], [Math.sin(i * 2.1) * 1.2, 0, -Math.cos(i * 2.1) * 1.2]);
    return v.build('tree');
  },
  palm() {
    const v = new VBuilder(5);
    let x = 0, y = 0, tilt = 0;
    for (let i = 0; i < 6; i++) {
      const h = 0.15;
      v.add(new THREE.CylinderGeometry(0.035, 0.042, h, 6), i % 2 ? '#8a6a44' : '#9c7a4e', [x, y + h / 2, 0], [0, 0, -tilt]);
      x += Math.sin(tilt) * h; y += Math.cos(tilt) * h; tilt += 0.05;
    }
    const top = [x, y, 0];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      v.push(top, [0, a, 0]);
      v.add(new THREE.ConeGeometry(0.07, 0.42, 3), i % 2 ? '#3f8f3a' : '#4fa443', [0.18, -0.06, 0], [0, 0, -PI / 2 - 0.45], [1, 1, 0.25], { cj: 0.05 });
      v.pop();
    }
    for (let i = 0; i < 3; i++) v.add(new THREE.IcosahedronGeometry(0.035, 0), '#6a4a26', [x + Math.cos(i * 2.1) * 0.04, y - 0.05, Math.sin(i * 2.1) * 0.04]);
    return v.build('tree');
  },
  cactus() {
    const v = new VBuilder(6);
    const g1 = '#4c8c3c', g2 = '#5ba04a';
    v.add(new THREE.CylinderGeometry(0.07, 0.075, 0.55, 8), g1, [0, 0.275, 0]);
    v.add(new THREE.SphereGeometry(0.07, 8, 4, 0, TAU, 0, PI / 2), g1, [0, 0.55, 0]);
    v.add(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 7), g2, [0.1, 0.25, 0], [0, 0, PI / 2]);
    v.add(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 7), g2, [0.16, 0.34, 0]);
    v.add(new THREE.SphereGeometry(0.045, 7, 3, 0, TAU, 0, PI / 2), g2, [0.16, 0.44, 0]);
    v.add(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 7), g2, [-0.09, 0.34, 0], [0, 0, PI / 2]);
    v.add(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 7), g2, [-0.14, 0.4, 0]);
    v.add(new THREE.SphereGeometry(0.04, 7, 3, 0, TAU, 0, PI / 2), g2, [-0.14, 0.47, 0]);
    v.add(new THREE.IcosahedronGeometry(0.025, 0), '#ff6a9a', [0, 0.625, 0], null, null, { cj: 0.02 });
    v.add(new THREE.DodecahedronGeometry(0.06), '#b89a6a', [0.12, 0.02, 0.1], null, [1, 0.6, 1], { jit: 0.01 });
    v.add(new THREE.DodecahedronGeometry(0.045), '#a88a5a', [-0.1, 0.015, 0.12], null, [1, 0.6, 1], { jit: 0.01 });
    return v.build('tree');
  },
  willow() {
    const v = new VBuilder(7);
    v.add(new THREE.CylinderGeometry(0.05, 0.1, 0.45, 6), '#4d3e2c', [0, 0.225, 0], [0, 0, 0.06], null, { jit: 0.015 });
    v.add(new THREE.IcosahedronGeometry(0.36, 1), '#5d7a38', [0.02, 0.62, 0], null, [1, 0.55, 1], { jit: 0.04, cj: 0.08 });
    v.add(new THREE.IcosahedronGeometry(0.22, 1), '#6a8a40', [0.02, 0.76, 0], null, [1, 0.6, 1], { jit: 0.03, cj: 0.08 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU, r = 0.3 + (i % 2) * 0.04;
      v.add(new THREE.ConeGeometry(0.045, 0.36 + (i % 3) * 0.06, 3), i % 2 ? '#6b8a42' : '#57753a', [0.02 + Math.cos(a) * r, 0.42, Math.sin(a) * r], [PI, a, 0], [1, 1, 0.5], { cj: 0.06 });
    }
    return v.build('tree');
  },
  mountain() { return mountainGeo(11, 'normal'); },
  snowMountain() { return mountainGeo(12, 'snow'); },
  darkMountain() { return mountainGeo(13, 'dark'); },
  desertRock() {
    const v = new VBuilder(14);
    v.add(new THREE.CylinderGeometry(0.44, 0.56, 0.34, 7, 2), '#c98a4e', [0, 0.17, 0], null, [1, 1, 0.85], { jit: 0.04, seed: 3 });
    v.add(new THREE.CylinderGeometry(0.34, 0.42, 0.3, 7, 2), '#d49a5c', [-0.04, 0.49, -0.02], [0, 0.3, 0], [1, 1, 0.85], { jit: 0.035, seed: 4 });
    v.add(new THREE.CylinderGeometry(0.22, 0.3, 0.24, 6, 1), '#c07e45', [-0.1, 0.76, -0.03], [0, 0.7, 0], [1, 1, 0.9], { jit: 0.03, seed: 5 });
    v.add(new THREE.CylinderGeometry(0.1, 0.16, 0.35, 6, 1), '#c98a4e', [0.32, 0.5, 0.06], null, null, { jit: 0.025, seed: 6 });
    v.add(new THREE.DodecahedronGeometry(0.12), '#b8784a', [0.4, 0.06, 0.32], null, [1, 0.6, 1], { jit: 0.02 });
    v.add(new THREE.DodecahedronGeometry(0.09), '#c98a4e', [-0.42, 0.04, 0.3], null, [1, 0.6, 1], { jit: 0.02 });
    const g = v.build('rigid');
    const bands = ['#c4834a', '#d9a066', '#b5713f', '#e3b47c', '#c98a50', '#d29558', '#ad6a3a'];
    recolorFaces(g, (x, y, z, ny) => (ny > 0.75 ? '#e2b27a' : bands[Math.floor((y + 0.02) / 0.11) % bands.length]), 14);
    return g;
  },
  rock() {
    const v = new VBuilder(15);
    v.add(new THREE.DodecahedronGeometry(0.17), '#8c877f', [0, 0.11, 0], [0.3, 0.2, 0], [1.2, 0.75, 1], { jit: 0.03 });
    v.add(new THREE.DodecahedronGeometry(0.1), '#9a948a', [0.19, 0.06, 0.08], [0.6, 0, 0], [1, 0.7, 1], { jit: 0.02 });
    v.add(new THREE.DodecahedronGeometry(0.07), '#7f7a73', [-0.16, 0.04, 0.1], null, [1, 0.7, 1], { jit: 0.015 });
    const g = v.build('rigid');
    recolorFaces(g, (x, y, z, ny, R) => (ny > 0.8 && R() < 0.5 ? '#7a9150' : null), 15);
    return g;
  },
  darkRock() {
    const v = new VBuilder(16);
    v.add(new THREE.DodecahedronGeometry(0.17), '#4a4450', [0, 0.11, 0], [0.3, 0.2, 0], [1.1, 0.85, 1], { jit: 0.035 });
    v.add(new THREE.DodecahedronGeometry(0.1), '#3d3843', [0.18, 0.06, 0.08], [0.6, 0, 0], [1, 0.8, 1], { jit: 0.02 });
    v.add(new THREE.ConeGeometry(0.05, 0.22, 4), '#544a5e', [-0.13, 0.11, 0.05], [0, 0, 0.25], null, { jit: 0.01 });
    const g = v.build('rigid');
    recolorFaces(g, (x, y, z, ny, R) => (R() < 0.08 ? '#d4552a' : ny > 0.8 ? '#5d4a6a' : null), 16);
    return g;
  },
  iceRock() {
    const v = new VBuilder(17);
    v.add(new THREE.OctahedronGeometry(0.1), '#cfeefc', [0, 0.16, 0], [0, 0.3, 0.1], [1, 1.7, 1], { cj: 0.12 });
    v.add(new THREE.OctahedronGeometry(0.08), '#a9d9f2', [0.13, 0.1, 0.05], [0, 0.6, -0.4], [1, 1.5, 1], { cj: 0.12 });
    v.add(new THREE.OctahedronGeometry(0.06), '#e6f7ff', [-0.12, 0.07, 0.06], [0, 0.2, 0.5], [1, 1.5, 1], { cj: 0.12 });
    v.add(new THREE.DodecahedronGeometry(0.12), '#bcd8e8', [0, 0.04, -0.02], null, [1.4, 0.4, 1.2], { jit: 0.02 });
    return v.build('rigid');
  },
  bush() {
    const v = new VBuilder(18);
    v.add(new THREE.IcosahedronGeometry(0.15, 0), '#4a9238', [0, 0.12, 0], null, [1, 0.85, 1], { jit: 0.025, cj: 0.1 });
    v.add(new THREE.IcosahedronGeometry(0.12, 0), '#58a442', [0.13, 0.09, 0.04], null, [1, 0.85, 1], { jit: 0.02, cj: 0.1 });
    v.add(new THREE.IcosahedronGeometry(0.11, 0), '#3f8232', [-0.12, 0.08, 0.03], null, [1, 0.85, 1], { jit: 0.02, cj: 0.1 });
    for (let i = 0; i < 5; i++) v.add(new THREE.IcosahedronGeometry(0.018, 0), '#d8323a', [Math.cos(i * 1.7) * 0.13, 0.12 + (i % 2) * 0.05, 0.08 + Math.sin(i * 1.7) * 0.05], null, null, { cj: 0.03 });
    return v.build('grass');
  },
  flowers() {
    const v = new VBuilder(19);
    const cols = ['#ff5a6e', '#ffd84a', '#ffffff', '#b46aff', '#ff9a3a', '#5ab8ff'];
    const R = rng(19);
    for (let c = 0; c < 3; c++) {
      const cx = Math.cos(c * 2.1) * 0.15, cz = Math.sin(c * 2.1) * 0.15;
      const col = cols[(c * 2 + 1) % cols.length];
      for (let i = 0; i < 5; i++) {
        const x = cx + (R() - 0.5) * 0.12, z = cz + (R() - 0.5) * 0.12, h = 0.08 + R() * 0.07;
        v.add(new THREE.CylinderGeometry(0.004, 0.006, h, 3), '#4a8a34', [x, h / 2, z]);
        v.add(new THREE.IcosahedronGeometry(0.022, 0), i === 4 ? cols[(c * 2) % cols.length] : col, [x, h + 0.01, z], null, [1, 0.6, 1], { cj: 0.04 });
      }
      v.add(new THREE.ConeGeometry(0.06, 0.05, 5), '#4f9a3a', [cx, 0.02, cz], null, [1, 1, 1], { cj: 0.08 });
    }
    return v.build('grass');
  },
  grassTuft() {
    const v = new VBuilder(20);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU, d = 0.03 + (i % 3) * 0.03, h = 0.14 + (i % 4) * 0.035;
      v.add(new THREE.ConeGeometry(0.022, h, 3), i % 2 ? '#5f9e3a' : '#7ab84a', [Math.cos(a) * d, h / 2, Math.sin(a) * d], [Math.sin(a) * 0.35, a, -Math.cos(a) * 0.35], [1, 1, 0.35], { cj: 0.08 });
    }
    return v.build('grass');
  },
  reeds() {
    const v = new VBuilder(21);
    const R = rng(21);
    for (let i = 0; i < 9; i++) {
      const x = (R() - 0.5) * 0.25, z = (R() - 0.5) * 0.25, h = 0.32 + R() * 0.2, t = (R() - 0.5) * 0.2;
      v.add(new THREE.CylinderGeometry(0.005, 0.009, h, 3), '#6a8a3a', [x, h / 2, z], [t, 0, t]);
      if (i % 2 === 0) v.add(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 5), '#6a4426', [x + t * h * 0.95, h * 0.95, z - t * h * 0.95]);
      else v.add(new THREE.ConeGeometry(0.02, h * 0.7, 3), '#7a9a42', [x, h * 0.35, z], [t * 2, R() * 3, -t], [1, 1, 0.3]);
    }
    return v.build('grass');
  },
  mushroom() {
    const v = new VBuilder(22);
    const m = (x, z, s, cap) => {
      v.add(new THREE.CylinderGeometry(0.02 * s, 0.026 * s, 0.1 * s, 6), '#efe4c8', [x, 0.05 * s, z]);
      v.add(new THREE.SphereGeometry(0.07 * s, 8, 4, 0, TAU, 0, PI / 2), cap, [x, 0.095 * s, z], null, [1, 0.75, 1], { cj: 0.06 });
      for (let i = 0; i < 3; i++) v.add(new THREE.IcosahedronGeometry(0.01 * s, 0), '#fff8e8', [x + Math.cos(i * 2.2) * 0.035 * s, 0.14 * s, z + Math.sin(i * 2.2) * 0.035 * s], null, null, { cj: 0.01 });
    };
    m(0, 0, 1.6, '#c8382c'); m(0.12, 0.07, 1.0, '#a8402e'); m(-0.1, 0.08, 1.1, '#8a4fb0'); m(0.02, 0.15, 0.7, '#c8382c');
    return v.build('grass');
  },
  bones() {
    const v = new VBuilder(23);
    const bone = '#e8dfc6';
    v.add(new THREE.IcosahedronGeometry(0.065, 1), bone, [0, 0.06, 0], null, [1, 0.9, 1.1], { cj: 0.03 });
    v.add(new THREE.BoxGeometry(0.07, 0.035, 0.05), '#ddd3b8', [0, 0.02, 0.05]);
    v.add(new THREE.IcosahedronGeometry(0.018, 0), '#2a2420', [-0.025, 0.07, 0.06], null, null, { cj: 0 });
    v.add(new THREE.IcosahedronGeometry(0.018, 0), '#2a2420', [0.025, 0.07, 0.06], null, null, { cj: 0 });
    const bn = (x, z, ry, l) => {
      v.add(new THREE.CylinderGeometry(0.012, 0.012, l, 5), bone, [x, 0.014, z], [0, ry, PI / 2]);
      for (const s of [-1, 1]) v.add(new THREE.IcosahedronGeometry(0.02, 0), bone, [x + Math.cos(ry) * s * l / 2, 0.016, z - Math.sin(ry) * s * l / 2]);
    };
    bn(0.15, 0.05, 0.5, 0.16); bn(-0.14, 0.08, -0.4, 0.14); bn(0.04, -0.13, 1.4, 0.18);
    for (let i = 0; i < 4; i++) v.add(new THREE.TorusGeometry(0.06, 0.008, 3, 6, PI), '#e2d8bc', [-0.12 + i * 0.035, 0.0, -0.1], [0, PI / 2, 0]);
    return v.build('rigid');
  },
};
function mountainGeo(seed, kind) {
  const v = new VBuilder(seed);
  const base = kind === 'dark' ? '#4a4252' : kind === 'snow' ? '#7f8796' : '#857c72';
  peak(v, 0.5, 1.3, 0, -0.06, 1, 7, base);
  peak(v, 0.36, 0.8, -0.33, 0.12, 2, 6, base);
  peak(v, 0.32, 0.68, 0.34, 0.1, 3, 6, base);
  peak(v, 0.22, 0.42, 0.08, 0.36, 4, 5, base);
  peak(v, 0.24, 0.5, 0.2, -0.36, 5, 5, base);
  for (let i = 0; i < 3; i++) v.add(new THREE.DodecahedronGeometry(0.08), base, [Math.cos(i * 2.3 + 0.4) * 0.5, 0.03, 0.15 + Math.sin(i * 2.3 + 0.4) * 0.3], null, [1, 0.6, 1], { jit: 0.02 });
  const g = v.build('rigid');
  recolorFaces(g, (x, y, z, ny, R) => {
    if (kind === 'snow') {
      if (y > 0.5 && ny > 0.25) return R() < 0.85 ? '#f3f6fa' : '#dfe7f0';
      if (y > 0.85) return '#e8eef5';
      if (y < 0.12) return '#c9d4de';
      return ny > 0.45 ? '#8e97a6' : R() < 0.5 ? '#6f7786' : '#7b8392';
    }
    if (kind === 'dark') {
      if (y < 0.2 && R() < 0.14) return '#ff6a2a';
      if (y > 0.95) return '#7a5a90';
      if (y < 0.1) return '#3a3238';
      return ny > 0.45 ? '#5a4f64' : R() < 0.5 ? '#3a3440' : '#463e4e';
    }
    if (y > 1.02 && ny > 0.1) return '#f2f4f6';
    if (y < 0.13) return R() < 0.5 ? '#6f8a48' : '#7c8a50';
    if (y < 0.3 && ny > 0.4) return '#7f8f52';
    return ny > 0.45 ? '#9a9086' : R() < 0.5 ? '#7a7168' : '#857c72';
  }, seed);
  return g;
}

const _decorGeos = {};
let _decorMat = null;
export function getDecorationGeometry(kind) {
  if (_decorGeos[kind]) return _decorGeos[kind];
  const fn = DECOR_BUILD[kind] || DECOR_BUILD.rock;
  return (_decorGeos[kind] = fn());
}
export function getDecorationMaterial() {
  if (!_decorMat) {
    _decorMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: grainTexture(),
      bumpMap: stoneBumpTexture(),
      bumpScale: 0.014,
      flatShading: true,
      roughness: 0.84,
      metalness: 0.02,
    });
  }
  return _decorMat;
}
export const DECORATION_LIST = Object.keys(DECOR_BUILD);

// ---------------------------------------------------------------------------
//  Main entry
// ---------------------------------------------------------------------------
export function createMapObjectModel(obj = {}) {
  let g;
  switch (obj.type) {
    case 'resource': g = buildResource(obj); break;
    case 'chest': g = buildChest(obj); break;
    case 'campfire': g = buildCampfire(obj); break;
    case 'artifact': g = buildArtifact(obj); break;
    case 'mine': g = buildMine(obj); break;
    case 'dwelling': g = buildDwelling(obj); break;
    default: g = buildObject(obj);
  }
  if (!g) { g = buildObject({ type: 'sign' }); }
  g.name = 'mapObject_' + obj.type;
  g.userData.objectType = obj.type;
  return g;
}
