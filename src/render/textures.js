// ============================================================================
//  טקסטורות פרוצדורליות (PBR, מפות נורמלים, בליטות ואפקטים)
// ============================================================================
import * as THREE from 'three';
import { RNG, makeNoise2D } from '../core/rng.js';

const cache = {};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function heightToNormalCanvas(h, S, strength = 1.0) {
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const v = new THREE.Vector3();
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const xp = (x + 1) % S, xm = (x - 1 + S) % S;
      const yp = (y + 1) % S, ym = (y - 1 + S) % S;
      const dx = (h[y * S + xp] - h[y * S + xm]) * strength;
      const dy = (h[yp * S + x] - h[ym * S + x]) * strength;
      v.set(-dx, -dy, 1).normalize();
      const i = (y * S + x) * 4;
      img.data[i] = Math.round((v.x * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round((v.y * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round((v.z * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Rich multi-layered organic grain & micro-foliage albedo detail texture. */
export function grainTexture() {
  if (cache.grain) return cache.grain;
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const r = new RNG(42);
  const n2 = makeNoise2D(101);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Tileable domain-warped noise
      const ax = (x / S) * Math.PI * 2, ay = (y / S) * Math.PI * 2;
      const nx = Math.cos(ax) * 1.4 + Math.sin(ay) * 0.4;
      const ny = Math.sin(ax) * 0.4 + Math.cos(ay) * 1.4;
      const f = n2.fbm(nx * 2.5, ny * 2.5, 3) * 18;
      const speck = (r.next() - 0.5) * 28;
      const v = Math.max(155, Math.min(255, Math.round(218 + f + speck)));
      const i = (y * S + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = Math.min(255, Math.round(v * 1.01));
      img.data[i + 2] = Math.max(140, Math.round(v * 0.97));
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // Soft organic blotches (wrapped across edges)
  for (let k = 0; k < 160; k++) {
    const x = r.next() * S, y = r.next() * S, rad = 5 + r.next() * 22;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = r.next() * 0.13;
    grd.addColorStop(0, `rgba(${r.next() < 0.52 ? '15,12,8' : '255,252,240'},${a})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        g.save();
        g.translate(ox, oy);
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        g.restore();
      }
    }
  }

  // Tiny grass blade / soil strokes
  g.lineWidth = 1.1;
  for (let k = 0; k < 420; k++) {
    const x = r.next() * S, y = r.next() * S;
    const len = 3 + r.next() * 5;
    const ang = -Math.PI / 2 + (r.next() - 0.5) * 0.9;
    g.strokeStyle = r.next() < 0.5 ? 'rgba(255,255,245,0.14)' : 'rgba(20,18,12,0.14)';
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.lineTo(x + ox + Math.cos(ang) * len, y + oy + Math.sin(ang) * len);
        g.stroke();
      }
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.grain = t;
  return t;
}

/** Tileable normal map for terrain micro-relief (pebbles, soil ridges, grass clumps). */
export function terrainNormalTexture() {
  if (cache.terrainN) return cache.terrainN;
  const S = 256;
  const h = new Float32Array(S * S);
  const r = new RNG(313);
  const waves = Array.from({ length: 18 }, () => ({
    kx: r.int(-8, 8) || 2,
    ky: r.int(-8, 8) || 3,
    ph: r.next() * Math.PI * 2,
    a: r.float(0.15, 0.55),
  }));
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let v = (r.next() - 0.5) * 0.35;
      for (const wv of waves) {
        v += wv.a * Math.sin(((wv.kx * x + wv.ky * y) / S) * Math.PI * 2 + wv.ph);
      }
      h[y * S + x] = v;
    }
  }
  // Add small pebbles & clumps
  for (let k = 0; k < 280; k++) {
    const cx = r.int(0, S - 1), cy = r.int(0, S - 1), rad = r.int(2, 6);
    const amp = r.float(0.4, 1.1) * (r.next() < 0.8 ? 1 : -0.6);
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 >= rad * rad) continue;
        const w = 1 - Math.sqrt(d2) / rad;
        const px = (cx + dx + S) % S, py = (cy + dy + S) % S;
        h[py * S + px] += amp * w * w;
      }
    }
  }
  const c = heightToNormalCanvas(h, S, 0.55);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  cache.terrainN = t;
  return t;
}

/** Cobblestone road texture (tiles along U, feathered along V). */
export function roadTexture() {
  if (cache.road) return cache.road;
  const W = 256, H = 256;
  const c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#5e4e38';
  g.fillRect(0, 0, W, H);
  const r = new RNG(17);

  // Mortar grit
  for (let i = 0; i < 900; i++) {
    const l = 65 + r.int(-15, 20);
    g.fillStyle = `rgb(${l + 12},${l + 4},${l - 10})`;
    g.fillRect(r.next() * W, r.next() * H, 2, 2);
  }

  // Courses of fitted flagstones/cobbles
  const rows = 10, cols = 10;
  const cw = W / cols, ch = H / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ox = (row % 2) * (cw * 0.48) + r.float(-2.5, 2.5);
      const oy = r.float(-2.0, 2.0);
      const cx = ((col * cw + ox + W) % W);
      const cy = row * ch + ch * 0.5 + oy;
      const rx = cw * (0.41 + r.float(-0.04, 0.05));
      const ry = ch * (0.39 + r.float(-0.04, 0.05));
      const base = 128 + r.int(-26, 30);
      const warm = r.int(-8, 14);
      const rot = (r.next() - 0.5) * 0.28;

      for (const wrapX of [-W, 0, W]) {
        const sx = cx + wrapX;
        if (sx + rx < -10 || sx - rx > W + 10) continue;
        // Dark mortar shadow
        g.fillStyle = 'rgba(22, 16, 10, 0.65)';
        g.beginPath();
        g.ellipse(sx + 1.2, cy + 1.5, rx + 1.2, ry + 1.2, rot, 0, Math.PI * 2);
        g.fill();

        // Stone body gradient
        const grd = g.createRadialGradient(sx - rx * 0.25, cy - ry * 0.25, 1, sx, cy, Math.max(rx, ry));
        grd.addColorStop(0, `rgb(${base + 34 + warm},${base + 20 + warm * 0.6},${base - 2})`);
        grd.addColorStop(0.7, `rgb(${base + 14 + warm},${base + 4},${base - 14})`);
        grd.addColorStop(1, `rgb(${base - 12},${base - 18},${base - 30})`);
        g.fillStyle = grd;
        g.beginPath();
        g.ellipse(sx, cy, rx, ry, rot, 0, Math.PI * 2);
        g.fill();

        // Top-left bevel highlight
        g.strokeStyle = 'rgba(255, 246, 220, 0.22)';
        g.lineWidth = 1.2;
        g.beginPath();
        g.ellipse(sx - 0.5, cy - 0.5, rx * 0.85, ry * 0.82, rot, Math.PI * 0.9, Math.PI * 1.85);
        g.stroke();
      }
    }
  }

  // Wheel rut subtle shading & grassy edge blending
  const img = g.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const edge = Math.min(1, Math.min(v, 1 - v) * 5.2);
    const smoothEdge = edge * edge * (3 - 2 * edge);
    for (let x = 0; x < W; x++) {
      const n = (Math.sin(x * 0.19 + y * 0.11) * 0.5 + 0.5) * 0.15;
      const alpha = Math.max(0, Math.min(1, smoothEdge - (1 - smoothEdge) * n));
      img.data[(y * W + x) * 4 + 3] = Math.round(255 * alpha);
    }
  }
  g.putImageData(img, 0, 0);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.road = t;
  return t;
}

/** Tileable normal map for water ripples (multi-layered capillary + swell waves). */
export function waterNormalTexture() {
  if (cache.waterN) return cache.waterN;
  const S = 256;
  const h = new Float32Array(S * S);
  const r = new RNG(99);
  const waves = Array.from({ length: 22 }, (_, idx) => ({
    kx: r.int(-9, 9) || 3,
    ky: r.int(-9, 9) || -4,
    ph: r.next() * Math.PI * 2,
    a: idx < 8 ? r.float(0.45, 1.0) : r.float(0.15, 0.42),
  }));
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let v = 0;
      for (const wv of waves) {
        v += wv.a * Math.sin(((wv.kx * x + wv.ky * y) / S) * Math.PI * 2 + wv.ph);
      }
      h[y * S + x] = v;
    }
  }
  const c = heightToNormalCanvas(h, S, 0.72);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.waterN = t;
  return t;
}

/** Tileable stone masonry texture for castles, towers, walls, and ruins (white-balanced for color tinting). */
export function stoneWallTexture() {
  if (cache.stoneWall) return cache.stoneWall;
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#70685e';
  g.fillRect(0, 0, S, S);
  const r = new RNG(505);
  const rows = 8;
  const rh = S / rows;

  for (let row = 0; row < rows; row++) {
    const y = row * rh;
    const cols = 4 + (row % 2);
    let x = (row % 2) * 22;
    for (let col = 0; col < cols; col++) {
      const bw = (S / cols) + r.float(-5, 5);
      const shade = 224 + r.int(-24, 24);
      const warm = r.int(-5, 8);
      for (const ox of [-S, 0, S]) {
        const bx = x + ox;
        const grd = g.createLinearGradient(bx, y, bx, y + rh);
        const hi = Math.min(255, shade + 14);
        const lo = Math.max(150, shade - 16);
        grd.addColorStop(0, `rgb(${hi + warm},${hi + Math.round(warm * 0.5)},${hi - 4})`);
        grd.addColorStop(0.82, `rgb(${shade + warm},${shade + Math.round(warm * 0.5)},${shade - 5})`);
        grd.addColorStop(1, `rgb(${lo},${lo - 2},${lo - 6})`);
        g.fillStyle = grd;
        g.fillRect(bx + 2, y + 2, bw - 3.5, rh - 3.5);
        // Crisp top-left stone bevel highlight & bottom-right chiseled edge
        g.strokeStyle = 'rgba(255,252,242,0.45)';
        g.lineWidth = 1.4;
        g.strokeRect(bx + 2.5, y + 2.5, bw - 5, rh - 5);
        g.strokeStyle = 'rgba(28,22,18,0.55)';
        g.lineWidth = 1.2;
        g.strokeRect(bx + 1.5, y + 1.5, bw - 3, rh - 3);
      }
      x += bw;
    }
  }
  // Fine stone grain
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < S * S; i++) {
    const n = (r.next() - 0.5) * 18;
    img.data[i * 4] = Math.max(0, Math.min(255, img.data[i * 4] + n));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, img.data[i * 4 + 1] + n));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, img.data[i * 4 + 2] + n));
  }
  g.putImageData(img, 0, 0);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.stoneWall = t;
  return t;
}

/** Tileable roof shingle albedo texture (white-balanced so material.color tints cleanly). */
export function roofTileTexture() {
  if (cache.roofTile) return cache.roofTile;
  const S = 128;
  const c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#909090';
  g.fillRect(0, 0, S, S);
  const r = new RNG(612);
  const rows = 8, cols = 8;
  const rh = S / rows, cw = S / cols;
  for (let row = 0; row < rows; row++) {
    for (let col = -1; col <= cols; col++) {
      const x = col * cw + (row % 2) * (cw * 0.5);
      const y = row * rh;
      const v = 226 + r.int(-18, 20);
      const grd = g.createLinearGradient(x, y, x, y + rh);
      grd.addColorStop(0, `rgb(${Math.max(140, v - 38)},${Math.max(140, v - 38)},${Math.max(140, v - 38)})`);
      grd.addColorStop(0.3, `rgb(${v},${v},${v})`);
      grd.addColorStop(0.86, `rgb(${Math.min(255, v + 18)},${Math.min(255, v + 18)},${Math.min(255, v + 18)})`);
      grd.addColorStop(1, '#585858');
      g.fillStyle = grd;
      g.beginPath();
      g.roundRect(x + 0.8, y + 0.8, cw - 1.6, rh - 0.8, [0, 0, 5, 5]);
      g.fill();
      g.strokeStyle = 'rgba(25,25,25,0.42)';
      g.lineWidth = 1;
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.roofTile = t;
  return t;
}

/** Tileable wood plank albedo texture (white-balanced for color tinting). */
export function woodPlankTexture() {
  if (cache.woodPlank) return cache.woodPlank;
  const S = 128;
  const c = canvas(S, S), g = c.getContext('2d');
  const r = new RNG(808);
  for (let x = 0; x < S; x++) {
    const plankIdx = Math.floor(x / 32);
    const plankTone = (plankIdx % 2 === 0 ? 6 : -6);
    const plankEdge = (x % 32 === 0 || x % 32 === 31) ? -58 : 0;
    for (let y = 0; y < S; y++) {
      const fiber = Math.sin(x * 0.9 + Math.sin(y * 0.14) * 2.5) * 16 + (r.next() - 0.5) * 12;
      const v = Math.max(95, Math.min(255, Math.round(226 + plankTone + fiber + plankEdge)));
      g.fillStyle = `rgb(${v},${Math.round(v * 0.98)},${Math.round(v * 0.95)})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.woodPlank = t;
  return t;
}

/** Grayscale bump map matching stoneWallTexture / generic stone surfaces. */
export function stoneBumpTexture() {
  if (cache.stoneBump) return cache.stoneBump;
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#404040';
  g.fillRect(0, 0, S, S);
  const r = new RNG(505);
  const rows = 8, rh = S / rows;
  for (let row = 0; row < rows; row++) {
    const y = row * rh;
    const cols = 4 + (row % 2);
    let x = (row % 2) * 22;
    for (let col = 0; col < cols; col++) {
      const bw = (S / cols) + r.float(-5, 5);
      const h = 185 + r.int(-30, 35);
      for (const ox of [-S, 0, S]) {
        g.fillStyle = `rgb(${h},${h},${h})`;
        g.fillRect(x + ox + 2, y + 2, bw - 4, rh - 4);
      }
      x += bw;
    }
  }
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < S * S; i++) {
    const n = (r.next() - 0.5) * 32;
    const v = Math.max(0, Math.min(255, img.data[i * 4] + n));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.stoneBump = t;
  return t;
}

/** Tileable wood plank / timber grain bump map. */
export function woodBumpTexture() {
  if (cache.woodBump) return cache.woodBump;
  const S = 128;
  const c = canvas(S, S), g = c.getContext('2d');
  const r = new RNG(808);
  g.fillStyle = '#909090';
  g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x++) {
    const plankEdge = (x % 32 === 0 || x % 32 === 31) ? -55 : 0;
    for (let y = 0; y < S; y++) {
      const fiber = Math.sin(x * 0.9 + Math.sin(y * 0.14) * 2.5) * 24 + (r.next() - 0.5) * 16;
      const v = Math.max(0, Math.min(255, Math.round(145 + fiber + plankEdge)));
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.woodBump = t;
  return t;
}

/** Tileable roof shingle bump map. */
export function roofBumpTexture() {
  if (cache.roofBump) return cache.roofBump;
  const S = 128;
  const c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#555';
  g.fillRect(0, 0, S, S);
  const rows = 8, cols = 8;
  const rh = S / rows, cw = S / cols;
  for (let row = 0; row < rows; row++) {
    for (let col = -1; col <= cols; col++) {
      const x = col * cw + (row % 2) * (cw * 0.5);
      const y = row * rh;
      const grd = g.createLinearGradient(x, y, x, y + rh);
      grd.addColorStop(0, '#707070');
      grd.addColorStop(0.85, '#dcdcdc');
      grd.addColorStop(1, '#252525');
      g.fillStyle = grd;
      g.beginPath();
      g.roundRect(x + 1, y + 1, cw - 2, rh - 1, [0, 0, 5, 5]);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.roofBump = t;
  return t;
}

/** Soft seamless cloud shadow noise texture for atmospheric ground lighting. */
export function cloudShadowTexture() {
  if (cache.cloud) return cache.cloud;
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const n2 = makeNoise2D(777);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const ax = (x / S) * Math.PI * 2, ay = (y / S) * Math.PI * 2;
      const u = Math.cos(ax) * 1.2 + Math.sin(ay) * 0.5;
      const v = Math.sin(ax) * 0.5 + Math.cos(ay) * 1.2;
      const f = n2.fbm(u * 1.6, v * 1.6, 4) * 0.5 + 0.5;
      const cVal = Math.round(THREE.MathUtils.smoothstep(f, 0.25, 0.78) * 255);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = cVal;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.cloud = t;
  return t;
}

/** Soft radial glow sprite texture. */
export function glowTexture(color = '#ffffff') {
  const k = 'glow' + color;
  if (cache[k]) return cache[k];
  const c = canvas(128, 128), g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, color);
  grd.addColorStop(0.25, color + 'aa');
  grd.addColorStop(0.6, color + '33');
  grd.addColorStop(1, color + '00');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache[k] = t;
  return t;
}

/** Hex outline texture for battle grid cells. */
export function ringTexture() {
  if (cache.ring) return cache.ring;
  const c = canvas(128, 128), g = c.getContext('2d');
  g.strokeStyle = '#ffffff';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  cache.ring = t;
  return t;
}
