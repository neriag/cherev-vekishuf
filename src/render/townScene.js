// ============================================================================
//  זירת העיר התלת־ממדית — דיורמה אינטראקטיבית של טירה (Castle) ונקרופוליס (Necropolis)
//  Procedural 3D town diorama + all 30 building models per faction + construction FX.
// ============================================================================

import * as THREE from 'three';
import { getBuildings } from '../data/buildings.js';
import {
  Builder,
  mat,
  MAT,
  C,
  glow,
  jitter,
  prismGeo,
  cachedGroup,
  makeFlag,
  makeBanner,
  portalMaterial,
  smokeTexture,
  updateStructureTime,
  rng,
} from './structureModels.js';
import { engine } from './engine.js';
import {
  waterNormalTexture,
  roadTexture,
  terrainNormalTexture,
  glowTexture,
} from './textures.js';

const PI = Math.PI;
const TAU = Math.PI * 2;

// Ensure procedural canvas textures in structureModels.js work in headless Node tests too
if (typeof document === 'undefined') {
  const noop = () => {};
  const grad = { addColorStop: noop };
  const ctx2d = {
    createRadialGradient: () => grad,
    fillRect: noop,
    clearRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    fill: noop,
    fillText: noop,
  };
  globalThis.document = {
    createElement: () => ({ width: 64, height: 64, getContext: () => ctx2d }),
  };
}

// ---------------------------------------------------------------------------
//  Slot layout: 15 distinct slots on terraced hills facing the camera (+Z)
//  All slots sit comfortably in the upper ~78% of the screen (bottom ~22% reserved for UI).
// ---------------------------------------------------------------------------
const SLOTS = {
  // Civic & Core
  hall:        { pos: [-4.3, 2.05, -5.4], ry:  0.18 },
  fort:        { pos: [ 4.1, 2.20, -5.7], ry: -0.18 },
  tavern:      { pos: [-7.3, 0.35,  2.1], ry:  0.32 },
  marketplace: { pos: [-4.2, 0.30,  2.5], ry:  0.12 },
  blacksmith:  { pos: [-1.4, 0.42,  0.9], ry:  0.08 },
  silo:        { pos: [ 7.4, 0.38,  2.1], ry: -0.28 },
  mage:        { pos: [-8.1, 1.85, -4.1], ry:  0.25 },
  special:     { pos: [ 4.5, 0.45,  1.4], ry: -0.15 },

  // Creature Dwellings (Tiers 1..7)
  dw1:         { pos: [ 1.5, 0.42,  1.6], ry: -0.06 },
  dw2:         { pos: [ 2.2, 0.90, -1.8], ry: -0.08 },
  dw3:         { pos: [-6.4, 1.15, -1.1], ry:  0.22 },
  dw4:         { pos: [-2.3, 0.90, -2.0], ry:  0.06 },
  dw5:         { pos: [ 8.0, 1.75, -3.9], ry: -0.26 },
  dw6:         { pos: [ 6.4, 0.95, -0.7], ry: -0.22 },
  dw7:         { pos: [ 0.0, 3.30, -7.8], ry:  0.00 },
};

function slotKeyForBuilding(id) {
  if (id.startsWith('hall')) return 'hall';
  if (id === 'fort' || id === 'citadel' || id === 'castle') return 'fort';
  if (id.startsWith('mage')) return 'mage';
  if (id.startsWith('dw')) return id.slice(0, 3);
  return id;
}

// ---------------------------------------------------------------------------
//  Small procedural helpers
// ---------------------------------------------------------------------------
function addSmoke(group, x, y, z, o = {}) {
  const n = o.count ?? 4;
  const size = o.size ?? 0.24;
  const rise = o.rise ?? 0.85;
  const color = o.color ?? '#c8c2ba';
  const speed = o.speed ?? 0.32;
  const op = o.opacity ?? 0.5;
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({
      map: smokeTexture(),
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const s = new THREE.Sprite(m);
    s.renderOrder = 2;
    group.add(s);
    puffs.push({ s, off: i / n, drift: (i % 2 ? 1 : -1) * 0.09 });
  }
  const ph = Math.random() * 10;
  return (dt, t) => {
    for (const p of puffs) {
      const k = (t * speed + p.off + ph) % 1;
      p.s.position.set(
        x + Math.sin(k * 3 + p.off * 6) * 0.05 + k * p.drift + k * 0.1,
        y + k * rise,
        z
      );
      p.s.scale.setScalar(size * (0.45 + k * 1.25));
      p.s.material.opacity = op * Math.sin(Math.min(1, k * 1.15) * PI);
    }
  };
}

function column(b, m, capM, x, y, z, h, r = 0.05) {
  b.cylB(capM, r * 1.35, r * 1.35, 0.04, x, y, z, 8);
  b.cylB(m, r * 0.95, r * 1.05, Math.max(0.05, h - 0.08), x, y + 0.04, z, 8);
  b.cylB(capM, r * 1.4, r * 1.15, 0.04, x, y + h - 0.04, z, 8);
}

function wallRun(b, m, trimM, x1, z1, x2, z2, h, thick = 0.16, y0 = 0, spiky = false) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(-dz, dx);
  b.push([(x1 + x2) / 2, y0, (z1 + z2) / 2], [0, ang, 0]);
  b.boxB(m, len, h, thick, 0, 0, 0);
  b.boxB(trimM, len + 0.02, 0.05, thick + 0.04, 0, h - 0.05, 0);
  const n = Math.max(2, Math.round(len / 0.22));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + 0.5) * (len / n);
    if (spiky) {
      b.add(new THREE.ConeGeometry(0.045, 0.16, 4), trimM, [x, h + 0.08, 0], [0, PI / 4, 0]);
    } else {
      b.boxB(m, (len / n) * 0.54, 0.09, thick + 0.02, x, h, 0);
    }
  }
  b.pop();
}

function horsePart(b, x, y, z, ry, coatColor, maneColor = '#2a1a10') {
  const hm = mat(coatColor);
  const mm = mat(maneColor);
  b.push([x, y, z], [0, ry, 0]);
  b.boxB(hm, 0.28, 0.12, 0.1, 0, 0.15, 0);
  for (const [lx, lz] of [[-0.1, -0.032], [-0.1, 0.032], [0.1, -0.032], [0.1, 0.032]]) {
    b.boxB(hm, 0.032, 0.15, 0.032, lx, 0, lz);
  }
  b.box(hm, 0.075, 0.16, 0.065, 0.14, 0.29, 0, 0, 0, -0.5);
  b.box(hm, 0.12, 0.055, 0.055, 0.21, 0.35, 0, 0, 0, 0.3);
  b.box(mm, 0.035, 0.15, 0.068, 0.11, 0.31, 0, 0, 0, -0.5);
  b.cyl(mm, 0.008, 0.02, 0.16, -0.16, 0.17, 0, 5, 0, 0, 0.85);
  b.pop();
}

function tagBuildingId(obj, id) {
  obj.name = `building_${id}`;
  obj.traverse((c) => {
    c.userData.buildingId = id;
  });
  obj.userData.buildingId = id;
  return obj;
}

// ---------------------------------------------------------------------------
//  Environment Diorama: Sky Dome, Mountains, Terraces, Roads, Water/Mist, Trees
// ---------------------------------------------------------------------------
function makeSkyDome(isNecro) {
  const topCol = new THREE.Color(isNecro ? '#080512' : '#2b66c0');
  const midCol = new THREE.Color(isNecro ? '#1f1037' : '#7ebdf2');
  const horizonCol = new THREE.Color(isNecro ? '#411e58' : '#ffdca4');
  const geo = new THREE.SphereGeometry(56, 32, 20);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = Math.max(0, Math.min(1, (pos.getY(i) + 6) / 50));
    if (y < 0.35) c.lerpColors(horizonCol, midCol, y / 0.35);
    else c.lerpColors(midCol, topCol, (y - 0.35) / 0.65);
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.renderOrder = -10;
  return mesh;
}

function buildTownAmbientParticles(root, anims, isNecro) {
  const count = 140;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const c1 = new THREE.Color(isNecro ? '#54ff9f' : '#ffea9f');
  const c2 = new THREE.Color(isNecro ? '#a56eff' : '#ffffff');
  const tmp = new THREE.Color();
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 24;
    positions[i * 3 + 1] = 0.4 + Math.random() * 6.5;
    positions[i * 3 + 2] = -8.5 + Math.random() * 14.5;
    phases[i] = Math.random() * TAU;
    tmp.lerpColors(c1, c2, Math.random());
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const pMat = new THREE.PointsMaterial({
    size: isNecro ? 0.24 : 0.19,
    map: glowTexture(),
    vertexColors: true,
    transparent: true,
    opacity: isNecro ? 0.62 : 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pts = new THREE.Points(geo, pMat);
  pts.renderOrder = 4;
  root.add(pts);

  anims.push((dt, t) => {
    const arr = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const ph = phases[i];
      arr[i * 3] += Math.sin(t * 0.45 + ph) * dt * 0.14;
      arr[i * 3 + 1] += (isNecro ? 0.22 : 0.08 * Math.cos(t * 0.6 + ph)) * dt;
      if (arr[i * 3 + 1] > 7.2) arr[i * 3 + 1] = 0.4;
      if (arr[i * 3 + 1] < 0.3) arr[i * 3 + 1] = 6.8;
    }
    geo.attributes.position.needsUpdate = true;
  });
}

function buildCastleEnvironment(root, anims) {
  root.add(makeSkyDome(false));

  // Warm sun disc + multi-layered golden corona in upper sky
  const sunGroup = new THREE.Group();
  sunGroup.position.set(9.5, 13.5, -26);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.3, 32),
    new THREE.MeshBasicMaterial({ color: '#fffbe0', fog: false })
  );
  sunGroup.add(sunDisc);
  const sunHalo = glow('#ffdf88', 6.8, 0.55);
  const sunHaloOuter = glow('#ffae42', 10.5, 0.24);
  sunGroup.add(sunHalo, sunHaloOuter);
  root.add(sunGroup);

  // Drifting volumetric clouds
  const cloudGroup = new THREE.Group();
  const cloudMat = mat('#fffaf0', { e: '#d8e6f8', ei: 0.35, r: 0.95 });
  const cloudSeeds = [
    [-14, 10.5, -18, 1.35],
    [-4.5, 11.8, -21, 1.55],
    [5.8, 11.2, -19, 1.25],
    [15, 9.8, -17, 1.4],
  ];
  const clouds = cloudSeeds.map(([x, y, z, s], idx) => {
    const cg = cachedGroup('castle_cloud_v2_' + idx, (b) => {
      b.sph(cloudMat, 0.95, 0, 0, 0, 2, [1.55, 0.65, 0.9]);
      b.sph(cloudMat, 0.74, -0.85, -0.1, 0.1, 2, [1.3, 0.6, 0.85]);
      b.sph(cloudMat, 0.78, 0.85, -0.08, -0.05, 2, [1.3, 0.6, 0.85]);
    });
    cg.children.forEach((m) => { m.castShadow = false; });
    cg.position.set(x, y, z);
    cg.scale.setScalar(s);
    cloudGroup.add(cg);
    return { cg, x0: x, phase: idx * 1.7 };
  });
  root.add(cloudGroup);
  anims.push((dt, t) => {
    for (const cl of clouds) {
      cl.cg.position.x = cl.x0 + Math.sin(t * 0.08 + cl.phase) * 1.2;
    }
  });

  // Static terrain, terraces, retaining walls, roads, bridge, mountains, trees, fountain
  const envMesh = cachedGroup('env_castle_terrain_v2', (b) => {
    const tNorm = terrainNormalTexture();
    const rTex = roadTexture();
    const grass1 = mat('#5ca042', { normalMap: tNorm, normalScale: 0.35 });
    const grass2 = mat('#4e8e38', { normalMap: tNorm, normalScale: 0.35 });
    const grass3 = mat('#6db34f', { normalMap: tNorm, normalScale: 0.35 });
    const cliff = mat('#8f887c');
    const cliffD = mat('#726c62');
    const farPeakMat = mat('#7b8ba4', { r: 0.88 });
    const wallSt = mat('#d6cebe');
    const wallTrim = mat('#b8af9e');
    const cobble = mat('#c8beac', { map: rTex });
    const cobble2 = mat('#b0a694', { map: rTex });
    const snow = mat('#f4f7fb', { e: '#bfd4ee', ei: 0.22 });

    // Base valley ground
    b.cylB(grass2, 26, 28, 1.2, 0, -1.2, -1.5, 28);
    b.boxB(grass1, 28, 0.35, 18, 0, -0.05, -2.0);

    // Lower plaza terrace (y = 0..0.32)
    b.boxB(grass1, 21.5, 0.32, 9.5, 0, 0, 1.4);
    // Retaining stone wall along river bank with buttresses (z ≈ 4.1)
    b.boxB(wallSt, 20.5, 0.42, 0.35, 0, -0.05, 4.1);
    b.boxB(wallTrim, 20.7, 0.08, 0.42, 0, 0.34, 4.1);
    for (let bx = -9; bx <= 9; bx += 3) {
      if (Math.abs(bx) < 1.5) continue;
      b.boxB(wallTrim, 0.32, 0.46, 0.46, bx, -0.05, 4.12);
    }

    // Mid terrace (y = 0.85)
    b.boxB(cliff, 20.2, 0.85, 6.2, 0, 0, -1.5);
    b.boxB(grass3, 19.8, 0.14, 5.9, 0, 0.78, -1.5);
    b.boxB(wallSt, 19.6, 0.82, 0.32, 0, 0.05, 1.55);
    b.boxB(wallTrim, 19.8, 0.08, 0.38, 0, 0.84, 1.55);

    // Upper left civic terrace (Hall + Mage, y = 1.85..2.05)
    b.boxB(cliffD, 10.6, 1.9, 6.0, -5.4, 0, -5.0);
    b.boxB(grass1, 10.2, 0.22, 5.7, -5.4, 1.84, -5.0);
    b.boxB(wallSt, 10.0, 1.15, 0.32, -5.4, 0.85, -2.1);
    b.boxB(wallTrim, 10.2, 0.08, 0.38, -5.4, 1.98, -2.1);

    // Upper right castle/monastery terrace (Fort + dw5, y = 1.75..2.20)
    b.boxB(cliffD, 10.6, 1.95, 6.0, 5.4, 0, -5.0);
    b.boxB(grass1, 10.2, 0.25, 5.7, 5.4, 1.88, -5.0);
    b.boxB(wallSt, 10.0, 1.2, 0.32, 5.4, 0.85, -2.1);
    b.boxB(wallTrim, 10.2, 0.08, 0.38, 5.4, 2.02, -2.1);

    // Central high peak for Portal of Glory (dw7, y = 3.30)
    b.add(jitter(new THREE.CylinderGeometry(2.7, 4.2, 3.3, 12), 0.18, 17), cliff, [0, 1.65, -7.8]);
    b.cylB(grass3, 2.55, 2.7, 0.18, 0, 3.15, -7.8, 12);
    // Stone stairway from mid terrace up to central peak
    for (let i = 0; i < 8; i++) {
      b.boxB(wallSt, 1.3, 0.22, 0.42, 0, 0.9 + i * 0.3, -3.6 - i * 0.32);
    }

    // Cobblestone roads & central royal plaza + stepped ramps between terraces
    b.boxB(cobble, 16.5, 0.05, 1.15, 0, 0.31, 2.0);
    b.boxB(cobble, 1.7, 0.06, 4.2, 0, 0.31, 2.8);
    b.cylB(cobble, 1.25, 1.3, 0.06, 0, 0.31, 2.0, 16);
    b.boxB(cobble2, 13.5, 0.05, 0.95, 0, 0.9, -1.3);

    // Royal Marble & Gold Fountain in the central lower plaza (x = 0, z = 2.0)
    b.cylB(wallSt, 0.62, 0.68, 0.16, 0, 0.34, 2.0, 14);
    b.cylB(mat('#3898e8', { r: 0.12, m: 0.2, e: '#1060b8', ei: 0.5 }), 0.52, 0.52, 0.12, 0, 0.39, 2.0, 14);
    b.cylB(wallSt, 0.12, 0.16, 0.42, 0, 0.42, 2.0, 10);
    b.cylB(wallSt, 0.3, 0.18, 0.08, 0, 0.78, 2.0, 12);
    b.sph(MAT.gold, 0.09, 0, 0.92, 2.0, 1);

    for (let i = 0; i < 5; i++) {
      b.boxB(wallSt, 1.5, 0.14, 0.36, -3.2, 0.32 + i * 0.12, 1.3 - i * 0.22);
      b.boxB(wallSt, 1.5, 0.14, 0.36, 3.2, 0.32 + i * 0.12, 1.3 - i * 0.22);
      b.boxB(wallSt, 1.4, 0.22, 0.36, -4.2, 0.92 + i * 0.22, -2.3 - i * 0.24);
      b.boxB(wallSt, 1.4, 0.22, 0.36, 4.0, 0.92 + i * 0.24, -2.3 - i * 0.24);
    }

    // Foreground river banks + stone arched bridge at x = 0, z = 4.9
    b.boxB(grass2, 26, 0.32, 4.0, 0, -0.02, 7.6);
    b.boxB(wallSt, 2.2, 0.55, 2.1, 0, 0.05, 4.95);
    b.boxB(cobble, 1.8, 0.08, 2.2, 0, 0.58, 4.95);
    for (const s of [-1, 1]) {
      b.boxB(wallTrim, 0.18, 0.32, 2.2, s * 0.95, 0.58, 4.95);
      for (const z of [4.0, 4.95, 5.9]) {
        b.boxB(wallSt, 0.24, 0.44, 0.24, s * 0.95, 0.58, z);
        b.sph(MAT.gold, 0.06, s * 0.95, 1.06, z);
      }
    }

    // Multi-ridge mountain backdrop arc (near rocky ridge + far alpine horizon ridge)
    const peaks = [
      [-15.5, -11.5, 4.2, 7.2],
      [-11.2, -13.0, 4.8, 8.8],
      [-6.5, -13.8, 4.4, 7.8],
      [-2.2, -14.2, 4.6, 8.5],
      [2.5, -14.0, 4.5, 8.2],
      [7.0, -13.5, 4.8, 9.0],
      [11.5, -12.6, 4.4, 7.6],
      [15.5, -11.0, 4.0, 6.8],
    ];
    peaks.forEach(([px, pz, pr, ph], i) => {
      b.add(jitter(new THREE.ConeGeometry(pr, ph, 9), 0.35, 30 + i), i % 2 ? cliff : cliffD, [px, ph / 2 - 0.3, pz]);
      b.add(jitter(new THREE.ConeGeometry(pr * 0.44, ph * 0.38, 9), 0.12, 60 + i), snow, [px, ph * 0.81 - 0.3, pz]);
    });
    const farPeaks = [
      [-18.0, -16.5, 5.6, 10.5],
      [-9.0, -18.2, 6.2, 12.2],
      [0.0, -19.0, 6.5, 13.0],
      [9.5, -18.0, 6.0, 11.8],
      [18.0, -16.2, 5.4, 10.2],
    ];
    farPeaks.forEach(([px, pz, pr, ph], i) => {
      b.add(jitter(new THREE.ConeGeometry(pr, ph, 8), 0.45, 120 + i), farPeakMat, [px, ph / 2 - 0.5, pz]);
      b.add(jitter(new THREE.ConeGeometry(pr * 0.48, ph * 0.42, 8), 0.15, 150 + i), snow, [px, ph * 0.79 - 0.5, pz]);
    });

    // Lush oak & pine trees framing the hills
    const bark = mat(C.bark);
    const leaf1 = mat(C.leaf);
    const leaf2 = mat(C.leafL);
    const pineM = mat('#2f6d34');
    const treeCoords = [
      [-10.2, 0.32, 2.8, 1.1],
      [-9.8, 0.32, 0.5, 1.2],
      [-10.4, 1.9, -2.5, 1.15],
      [-10.2, 1.9, -6.5, 1.25],
      [-1.8, 2.0, -6.2, 1.0],
      [1.8, 2.0, -6.2, 1.0],
      [10.2, 1.95, -6.2, 1.2],
      [10.3, 1.9, -2.2, 1.15],
      [9.8, 0.35, 0.6, 1.1],
      [10.2, 0.35, 2.9, 1.15],
      [-5.6, 0.32, 3.6, 0.85],
      [5.6, 0.32, 3.6, 0.85],
    ];
    treeCoords.forEach(([tx, ty, tz, ts], i) => {
      b.push([tx, ty, tz], [0, i * 1.1, 0], ts);
      b.cylB(bark, 0.08, 0.12, 0.55, 0, 0, 0, 7);
      if (i % 2 === 0) {
        b.sph(leaf1, 0.42, 0, 0.72, 0, 2);
        b.sph(leaf2, 0.3, 0.22, 0.62, 0.12, 2);
        b.sph(leaf1, 0.28, -0.2, 0.64, -0.1, 2);
      } else {
        b.coneB(pineM, 0.45, 0.65, 0, 0.38, 0, 8);
        b.coneB(pineM, 0.36, 0.55, 0, 0.72, 0, 8);
        b.coneB(leaf1, 0.25, 0.45, 0, 1.02, 0, 8);
      }
      b.pop();
    });

    // Street lanterns along the main bridge and plaza
    const lanternCoords = [
      [-1.2, 0.32, 3.7],
      [1.2, 0.32, 3.7],
      [-2.8, 0.32, 1.6],
      [2.8, 0.32, 1.6],
      [-1.0, 0.9, -1.0],
      [1.0, 0.9, -1.0],
    ];
    lanternCoords.forEach(([lx, ly, lz]) => {
      b.cylB(MAT.iron, 0.03, 0.045, 0.55, lx, ly, lz, 6);
      b.boxB(mat('#ffe28a', { e: '#ffaa22', ei: 1.5 }), 0.1, 0.12, 0.1, lx, ly + 0.55, lz);
      b.pyramid(MAT.iron, 0.08, 0.07, lx, ly + 0.67, lz);
    });
  });
  root.add(envMesh);

  // Sparkling animated normal-mapped river in foreground (z ≈ 4.95)
  const wNorm = waterNormalTexture();
  const waterMat = new THREE.MeshStandardMaterial({
    color: '#2c8cd8',
    roughness: 0.12,
    metalness: 0.28,
    emissive: new THREE.Color('#0c4480'),
    emissiveIntensity: 0.4,
    normalMap: wNorm,
    normalScale: new THREE.Vector2(0.35, 0.35),
  });
  const river = new THREE.Mesh(new THREE.BoxGeometry(27, 0.12, 1.55, 24, 1, 4), waterMat);
  river.position.set(0, 0.18, 4.95);
  river.receiveShadow = true;
  root.add(river);

  // Waterfall / fountain cascade from central peak into river + plaza fountain spray
  const cascadeMat = mat('#7ad4ff', { e: '#2ca4ff', ei: 0.7, op: 0.72 });
  const cascade = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 2.2, 2, 8), cascadeMat);
  cascade.position.set(-0.95, 2.05, -6.2);
  cascade.rotation.x = -0.35;
  root.add(cascade);
  const splash = glow('#bfefff', 0.9, 0.5, true);
  splash.position.set(-0.95, 1.0, -5.8);
  root.add(splash);
  const fountainGlow = glow('#9ee4ff', 0.75, 0.48, true);
  fountainGlow.position.set(0, 0.95, 2.0);
  root.add(fountainGlow);

  // Waving town banners along terraces
  for (const [bx, by, bz] of [
    [-1.2, 0.95, 3.8],
    [1.2, 0.95, 3.8],
    [-3.5, 1.5, 1.55],
    [3.5, 1.5, 1.55],
  ]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.85, 6), mat(C.woodDark));
    pole.position.set(bx, by, bz);
    root.add(pole);
    const fl = makeFlag('#2860c8', 0.38, false);
    fl.position.set(bx + 0.02, by + 0.35, bz);
    root.add(fl);
  }

  buildTownAmbientParticles(root, anims, false);

  anims.push((dt, t) => {
    river.position.y = 0.18 + Math.sin(t * 2.2) * 0.025;
    wNorm.offset.x = (t * 0.06) % 1;
    wNorm.offset.y = Math.sin(t * 0.4) * 0.04;
    splash.material.opacity = 0.38 + Math.sin(t * 5.0) * 0.12;
    fountainGlow.material.opacity = 0.36 + Math.sin(t * 6.2) * 0.12;
  });
}

function buildNecroEnvironment(root, anims) {
  root.add(makeSkyDome(true));

  // Giant pale full moon + eerie green-violet halo
  const moonGroup = new THREE.Group();
  moonGroup.position.set(-8.5, 12.8, -25);
  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.9, 32),
    new THREE.MeshBasicMaterial({ color: '#e6f5ec', fog: false })
  );
  moonGroup.add(moonDisc);
  const moonHalo1 = glow('#88ffb8', 6.8, 0.38);
  const moonHalo2 = glow('#9a5cff', 10.5, 0.28);
  moonGroup.add(moonHalo1, moonHalo2);
  root.add(moonGroup);

  const envMesh = cachedGroup('env_necro_terrain_v2', (b) => {
    const tNorm = terrainNormalTexture();
    const rTex = roadTexture();
    const ash1 = mat('#2a2533', { normalMap: tNorm, normalScale: 0.4 });
    const ash2 = mat('#1e1a26', { normalMap: tNorm, normalScale: 0.4 });
    const ash3 = mat('#352f42', { normalMap: tNorm, normalScale: 0.4 });
    const crag = mat('#3e384a');
    const cragD = mat('#292433');
    const farCrag = mat('#1c1528', { r: 0.92 });
    const wallSt = mat('#484154');
    const wallTrim = mat('#322c3c');
    const slate = mat('#524b5e', { map: rTex });
    const bone = mat(C.bone);
    const runeM = mat('#58ff9a', { e: '#20e068', ei: 1.5 });
    const violetM = mat('#b070ff', { e: '#7830e0', ei: 1.4 });

    // Base ground
    b.cylB(ash2, 26, 28, 1.2, 0, -1.2, -1.5, 28);
    b.boxB(ash1, 28, 0.35, 18, 0, -0.05, -2.0);

    // Lower terrace (y = 0..0.32)
    b.boxB(ash1, 21.5, 0.32, 9.5, 0, 0, 1.4);
    b.boxB(wallSt, 20.5, 0.44, 0.35, 0, -0.05, 4.1);
    b.boxB(wallTrim, 20.7, 0.08, 0.42, 0, 0.35, 4.1);

    // Mid terrace (y = 0.85)
    b.boxB(crag, 20.2, 0.85, 6.2, 0, 0, -1.5);
    b.boxB(ash3, 19.8, 0.14, 5.9, 0, 0.78, -1.5);
    b.boxB(wallSt, 19.6, 0.82, 0.32, 0, 0.05, 1.55);
    b.boxB(wallTrim, 19.8, 0.08, 0.38, 0, 0.84, 1.55);

    // Upper left terrace (Hall + Mage, y = 1.85..2.05)
    b.boxB(cragD, 10.6, 1.9, 6.0, -5.4, 0, -5.0);
    b.boxB(ash1, 10.2, 0.22, 5.7, -5.4, 1.84, -5.0);
    b.boxB(wallSt, 10.0, 1.15, 0.32, -5.4, 0.85, -2.1);

    // Upper right terrace (Fort + dw5, y = 1.75..2.20)
    b.boxB(cragD, 10.6, 1.95, 6.0, 5.4, 0, -5.0);
    b.boxB(ash1, 10.2, 0.25, 5.7, 5.4, 1.88, -5.0);
    b.boxB(wallSt, 10.0, 1.2, 0.32, 5.4, 0.85, -2.1);

    // Central jagged crag for Dragon Vault (dw7, y = 3.30)
    b.add(jitter(new THREE.CylinderGeometry(2.7, 4.3, 3.35, 10), 0.24, 91), cragD, [0, 1.65, -7.8]);
    b.cylB(ash3, 2.55, 2.75, 0.18, 0, 3.16, -7.8, 10);
    for (let i = 0; i < 8; i++) {
      b.boxB(wallSt, 1.3, 0.22, 0.42, 0, 0.9 + i * 0.3, -3.6 - i * 0.32);
    }

    // Cracked slate roads, central ritual circle & ramps
    b.boxB(slate, 16.5, 0.05, 1.05, 0, 0.31, 2.0);
    b.boxB(slate, 1.6, 0.06, 4.2, 0, 0.31, 2.8);
    b.cylB(slate, 1.25, 1.3, 0.06, 0, 0.31, 2.0, 16);
    b.boxB(slate, 13.5, 0.05, 0.95, 0, 0.9, -1.3);

    // Central Soul Well / Necromantic Altar in lower plaza (x = 0, z = 2.0)
    b.cylB(wallTrim, 0.62, 0.7, 0.16, 0, 0.34, 2.0, 12);
    b.cylB(runeM, 0.48, 0.48, 0.12, 0, 0.39, 2.0, 12);
    for (let a = 0; a < 4; a++) {
      const ang = (a / 4) * TAU + PI / 4;
      b.add(
        new THREE.ConeGeometry(0.08, 0.42, 4),
        bone,
        [Math.cos(ang) * 0.56, 0.58, 2.0 + Math.sin(ang) * 0.56],
        [Math.sin(ang) * 0.25, 0, -Math.cos(ang) * 0.25]
      );
    }
    b.sph(violetM, 0.14, 0, 0.85, 2.0, 0);

    for (let i = 0; i < 5; i++) {
      b.boxB(wallSt, 1.5, 0.14, 0.36, -3.2, 0.32 + i * 0.12, 1.3 - i * 0.22);
      b.boxB(wallSt, 1.5, 0.14, 0.36, 3.2, 0.32 + i * 0.12, 1.3 - i * 0.22);
      b.boxB(wallSt, 1.4, 0.22, 0.36, -4.2, 0.92 + i * 0.22, -2.3 - i * 0.24);
      b.boxB(wallSt, 1.4, 0.22, 0.36, 4.0, 0.92 + i * 0.24, -2.3 - i * 0.24);
    }

    // Foreground bone-spiked bridge over toxic river
    b.boxB(ash2, 26, 0.32, 4.0, 0, -0.02, 7.6);
    b.boxB(wallSt, 2.2, 0.55, 2.1, 0, 0.05, 4.95);
    b.boxB(slate, 1.8, 0.08, 2.2, 0, 0.58, 4.95);
    for (const s of [-1, 1]) {
      b.boxB(wallTrim, 0.16, 0.3, 2.2, s * 0.95, 0.58, 4.95);
      for (const z of [4.0, 4.95, 5.9]) {
        b.add(new THREE.ConeGeometry(0.1, 0.48, 4), bone, [s * 0.98, 0.85, z], [0, 0, -s * 0.22]);
      }
    }

    // Multi-ridge jagged dark mountain spires in background
    const peaks = [
      [-15.5, -11.5, 3.6, 8.2],
      [-11.2, -13.0, 4.0, 9.8],
      [-6.5, -13.8, 3.8, 8.8],
      [-2.2, -14.2, 4.1, 9.6],
      [2.5, -14.0, 3.9, 9.2],
      [7.0, -13.5, 4.2, 10.0],
      [11.5, -12.6, 3.8, 8.5],
      [15.5, -11.0, 3.5, 7.6],
    ];
    peaks.forEach(([px, pz, pr, ph], i) => {
      b.add(jitter(new THREE.ConeGeometry(pr, ph, 7), 0.42, 70 + i), i % 2 ? crag : cragD, [px, ph / 2 - 0.3, pz]);
    });
    const farPeaks = [
      [-18.0, -16.5, 5.0, 11.2],
      [-9.0, -18.2, 5.8, 13.0],
      [0.0, -19.0, 6.2, 13.8],
      [9.5, -18.0, 5.6, 12.6],
      [18.0, -16.2, 5.0, 11.0],
    ];
    farPeaks.forEach(([px, pz, pr, ph], i) => {
      b.add(jitter(new THREE.ConeGeometry(pr, ph, 7), 0.5, 190 + i), farCrag, [px, ph / 2 - 0.5, pz]);
    });

    // Dead twisted trees, iron fences, gravestones, and glowing obelisks
    const deadWood = mat('#3b302c');
    const treeCoords = [
      [-10.2, 0.32, 2.8, 1.15],
      [-9.8, 0.32, 0.5, 1.2],
      [-10.4, 1.9, -2.5, 1.2],
      [-10.2, 1.9, -6.5, 1.3],
      [10.2, 1.95, -6.2, 1.25],
      [10.3, 1.9, -2.2, 1.2],
      [9.8, 0.35, 0.6, 1.15],
      [10.2, 0.35, 2.9, 1.2],
    ];
    treeCoords.forEach(([tx, ty, tz, ts], i) => {
      b.push([tx, ty, tz], [0, i * 0.9, 0], ts);
      b.cylB(deadWood, 0.05, 0.12, 0.75, 0, 0, 0, 5);
      b.cyl(deadWood, 0.025, 0.05, 0.45, 0.14, 0.68, 0, 4, 0, 0, -0.75);
      b.cyl(deadWood, 0.02, 0.045, 0.4, -0.14, 0.62, 0.05, 4, 0.2, 0, 0.8);
      b.cyl(deadWood, 0.018, 0.035, 0.32, 0, 0.72, -0.12, 4, -0.7, 0, 0);
      b.pop();
    });

    // Glowing Necromantic Obelisks along the terraces
    const obelisks = [
      [-1.3, 0.32, 3.7],
      [1.3, 0.32, 3.7],
      [-3.0, 0.32, 1.6],
      [3.0, 0.32, 1.6],
      [-1.1, 0.9, -1.0],
      [1.1, 0.9, -1.0],
    ];
    obelisks.forEach(([ox, oy, oz]) => {
      b.boxB(wallTrim, 0.26, 0.12, 0.26, ox, oy, oz);
      b.add(new THREE.CylinderGeometry(0.05, 0.11, 0.75, 4).rotateY(PI / 4), wallSt, [ox, oy + 0.49, oz]);
      b.add(new THREE.ConeGeometry(0.075, 0.18, 4).rotateY(PI / 4), runeM, [ox, oy + 0.95, oz]);
    });

    // Wrought-iron fence segments & scattered gravestones
    for (const fx of [-6.0, -5.2, 5.2, 6.0]) {
      b.box(MAT.iron, 0.75, 0.025, 0.025, fx, 0.58, 3.8);
      b.box(MAT.iron, 0.75, 0.025, 0.025, fx, 0.38, 3.8);
      for (let i = -3; i <= 3; i++) {
        b.cylB(MAT.iron, 0.012, 0.012, 0.36, fx + i * 0.11, 0.3, 3.8, 4);
      }
    }
  });
  root.add(envMesh);

  // Bubbling toxic green/purple normal-mapped mist river & pools
  const wNorm = waterNormalTexture();
  const mistRiverMat = new THREE.MeshStandardMaterial({
    color: '#22a665',
    roughness: 0.18,
    metalness: 0.2,
    emissive: new THREE.Color('#187a46'),
    emissiveIntensity: 0.85,
    normalMap: wNorm,
    normalScale: new THREE.Vector2(0.4, 0.4),
  });
  const mistRiver = new THREE.Mesh(new THREE.BoxGeometry(27, 0.12, 1.55), mistRiverMat);
  mistRiver.position.set(0, 0.18, 4.95);
  root.add(mistRiver);

  // Glowing mist sprites drifting over the river and terraces
  const mistSprites = [];
  for (const [mx, my, mz, col, sz] of [
    [-5.5, 0.45, 4.9, '#48ff98', 2.4],
    [-2.0, 0.45, 4.9, '#8c48ff', 2.2],
    [0.0, 0.85, 2.0, '#62ffaa', 1.6],
    [2.2, 0.45, 4.9, '#48ff98', 2.4],
    [6.0, 0.45, 4.9, '#8c48ff', 2.2],
    [-4.8, 1.1, -0.4, '#50ff9a', 1.8],
    [4.8, 1.1, -0.4, '#9254ff', 1.8],
  ]) {
    const sp = glow(col, sz, 0.32, true);
    sp.position.set(mx, my, mz);
    root.add(sp);
    mistSprites.push({ sp, x0: mx, y0: my, ph: mx * 0.7 + mz });
  }

  buildTownAmbientParticles(root, anims, true);

  anims.push((dt, t) => {
    mistRiver.position.y = 0.18 + Math.sin(t * 1.8) * 0.025;
    wNorm.offset.x = (t * 0.04) % 1;
    for (const m of mistSprites) {
      m.sp.position.x = m.x0 + Math.sin(t * 0.5 + m.ph) * 0.35;
      m.sp.material.opacity = 0.24 + Math.sin(t * 1.6 + m.ph) * 0.1;
    }
  });
}

// ---------------------------------------------------------------------------
//  1. HALL CHAIN: hall1 .. hall4
// ---------------------------------------------------------------------------
function buildHallModel(faction, level, anims) {
  const isNecro = faction === 'necropolis';
  const key = `town_b_${faction}_hall_${level}`;
  const g = cachedGroup(key, (b) => {
    const W = mat(isNecro ? '#4a4356' : '#eee7d6');
    const W2 = mat(isNecro ? '#342e3e' : '#cfc5b0');
    const roof = mat(isNecro ? '#5c3488' : '#2f62be');
    const roof2 = mat(isNecro ? '#412264' : '#b8422c');
    const gold = isNecro ? mat('#64ff9e', { e: '#1fb85a', ei: 1.1 }) : MAT.gold;
    const win = mat(isNecro ? '#7effa8' : '#ffe39a', { e: isNecro ? '#28ff68' : '#ffb438', ei: 1.1 });

    // Stepped stone foundation
    const bw = 1.6 + level * 0.28;
    const bd = 1.2 + level * 0.18;
    b.boxB(W2, bw + 0.25, 0.14, bd + 0.25, 0, 0, 0);
    b.boxB(W, bw + 0.1, 0.12, bd + 0.1, 0, 0.14, 0);

    // Main hall body
    const bh = 0.65 + level * 0.18;
    b.boxB(W, bw, bh, bd, 0, 0.26, 0);
    b.boxB(W2, bw + 0.06, 0.06, bd + 0.06, 0, 0.26 + bh - 0.04, 0);
    b.roof(level === 1 ? roof2 : roof, bw + 0.14, 0.38 + level * 0.05, bd + 0.14, 0, 0.26 + bh, 0);

    // Front portico + columns
    const colN = level >= 3 ? 4 : 2;
    for (let i = 0; i < colN; i++) {
      const cx = (i - (colN - 1) / 2) * 0.34;
      column(b, W, W2, cx, 0.26, bd / 2 + 0.14, bh * 0.78, 0.05);
    }
    b.boxB(W2, colN * 0.36 + 0.16, 0.06, 0.32, 0, 0.26 + bh * 0.78, bd / 2 + 0.06);
    b.add(prismGeo(colN * 0.36 + 0.2, 0.22, 0.34), roof, [0, 0.32 + bh * 0.78, bd / 2 + 0.06]);

    // Arched entrance & windows
    b.boxB(MAT.dark, 0.24, 0.34, 0.04, 0, 0.26, bd / 2 + 0.01);
    for (const s of [-1, 1]) {
      b.boxB(win, 0.1, 0.2, 0.03, s * (bw * 0.3), 0.5, bd / 2 + 0.01);
      if (level >= 2) b.boxB(win, 0.1, 0.18, 0.03, s * (bw * 0.3), 0.85, bd / 2 + 0.01);
    }

    // Level 2+: Side wings + central bell/clock tower
    if (level >= 2) {
      for (const s of [-1, 1]) {
        b.boxB(W, 0.52, bh * 0.82, 0.85, s * (bw / 2 + 0.2), 0.26, -0.05);
        b.roof(roof, 0.6, 0.28, 0.92, s * (bw / 2 + 0.2), 0.26 + bh * 0.82, -0.05, true);
        b.boxB(win, 0.09, 0.18, 0.03, s * (bw / 2 + 0.2), 0.5, 0.38);
      }
      b.boxB(W, 0.46, 0.55, 0.46, 0, 0.26 + bh + 0.2, -0.05);
      b.pyramid(roof, 0.3, 0.42, 0, 0.26 + bh + 0.75, -0.05);
      b.sph(gold, 0.05, 0, 0.26 + bh + 1.2, -0.05);
    }

    // Level 3+: Twin flanking towers
    if (level >= 3) {
      for (const s of [-1, 1]) {
        const tx = s * (bw / 2 + 0.38);
        b.cylB(W, 0.22, 0.25, bh + 0.55, tx, 0.26, 0.25, 8);
        b.coneB(roof, 0.28, 0.48, tx, 0.26 + bh + 0.55, 0.25, 8);
        b.sph(gold, 0.04, tx, 0.26 + bh + 1.05, 0.25);
      }
    }

    // Level 4: Monumental Capitol Dome & gold/emerald colonnade drum
    if (level >= 4) {
      const dy = 0.26 + bh + 0.32;
      b.cylB(W2, 0.56, 0.6, 0.38, 0, dy, -0.05, 12);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        b.cylB(W, 0.035, 0.035, 0.36, Math.cos(a) * 0.54, dy + 0.02, -0.05 + Math.sin(a) * 0.54, 6);
      }
      b.add(
        new THREE.SphereGeometry(0.56, 14, 8, 0, TAU, 0, PI / 2),
        isNecro ? roof : MAT.gold,
        [0, dy + 0.38, -0.05]
      );
      b.cylB(gold, 0.08, 0.12, 0.35, 0, dy + 0.92, -0.05, 8);
      b.sph(gold, 0.08, 0, dy + 1.32, -0.05);
    }
  });

  // Banners & glow for higher tiers
  if (level >= 2) {
    const col = isNecro ? '#7a28b8' : '#2458c6';
    for (const s of [-1, 1]) {
      const bn = makeBanner(col, 0.36 + level * 0.04);
      bn.position.set(s * 0.55, 0.85 + level * 0.12, 0.72 + level * 0.08);
      g.add(bn);
    }
  }
  if (level >= 4) {
    const gl = glow(isNecro ? '#48ff98' : '#ffd86b', 1.8, 0.55, true);
    gl.position.set(0, 2.2, 0);
    g.add(gl);
    const ph = Math.random() * 10;
    anims.push((dt, t) => {
      gl.material.opacity = 0.42 + Math.sin(t * 2.2 + ph) * 0.14;
    });
  }
  return g;
}

// ---------------------------------------------------------------------------
//  2. FORT CHAIN: fort -> citadel -> castle
// ---------------------------------------------------------------------------
function buildFortModel(faction, tier, anims) {
  const isNecro = faction === 'necropolis';
  const key = `town_b_${faction}_fort_${tier}`;
  const g = cachedGroup(key, (b) => {
    const W = mat(isNecro ? '#463f52' : '#e6dfd0');
    const W2 = mat(isNecro ? '#312b3a' : '#c6bda8');
    const roof = mat(isNecro ? '#542e7a' : '#2d5cb8');
    const bone = mat(C.bone);
    const gold = isNecro ? mat('#52ff92', { e: '#18c858', ei: 1.2 }) : MAT.gold;
    const win = mat(isNecro ? '#7effa8' : '#ffe39a', { e: isNecro ? '#28ff68' : '#ffb438', ei: 1.1 });

    // Base rocky bastion platform
    b.boxB(W2, 3.2, 0.18, 2.5, 0, 0, 0);

    // Tier 2+ (Citadel / Castle): Moat around front of bastion
    if (tier >= 2) {
      const moatMat = isNecro
        ? mat('#24b868', { e: '#168848', ei: 0.9, r: 0.15 })
        : mat('#2b86d6', { e: '#0d4480', ei: 0.45, r: 0.1 });
      b.boxB(moatMat, 3.4, 0.06, 0.42, 0, 0.14, 1.32);
      b.boxB(mat(C.woodDark), 0.58, 0.08, 0.5, 0, 0.16, 1.32);
    }

    // Perimeter fortification walls
    const wh = 0.52 + tier * 0.12;
    wallRun(b, W, W2, -1.35, 0.95, -0.36, 0.95, wh, 0.18, 0.18, isNecro);
    wallRun(b, W, W2, 0.36, 0.95, 1.35, 0.95, wh, 0.18, 0.18, isNecro);
    wallRun(b, W, W2, -1.35, 0.95, -1.35, -0.95, wh, 0.18, 0.18, isNecro);
    wallRun(b, W, W2, 1.35, 0.95, 1.35, -0.95, wh, 0.18, 0.18, isNecro);
    wallRun(b, W, W2, -1.35, -0.95, 1.35, -0.95, wh, 0.18, 0.18, isNecro);

    // 4 Corner Towers
    const tower = (tx, tz, r, h, rh) => {
      b.cylB(W, r, r * 1.1, h, tx, 0.18, tz, isNecro ? 6 : 10);
      b.cylB(W2, r * 1.14, r * 1.02, 0.08, tx, 0.18 + h - 0.06, tz, isNecro ? 6 : 10);
      b.coneB(roof, r * 1.22, rh, tx, 0.18 + h + 0.02, tz, isNecro ? 6 : 10);
      b.sph(gold, 0.04, tx, 0.18 + h + rh + 0.03, tz);
      b.boxB(win, 0.06, 0.14, 0.03, tx, 0.18 + h * 0.62, tz + r);
    };
    const th = 0.95 + tier * 0.22;
    for (const [tx, tz] of [[-1.35, 0.95], [1.35, 0.95], [-1.35, -0.95], [1.35, -0.95]]) {
      tower(tx, tz, 0.24, th, 0.46);
    }

    // Gatehouse
    tower(-0.38, 1.0, 0.18, th * 0.85, 0.36);
    tower(0.38, 1.0, 0.18, th * 0.85, 0.36);
    b.boxB(W, 0.62, wh + 0.18, 0.3, 0, 0.18, 0.96);
    b.boxB(MAT.dark, 0.3, 0.38, 0.06, 0, 0.18, 1.1);
    if (isNecro) {
      b.sph(bone, 0.14, 0, 0.72, 1.12, 1, [1, 0.9, 0.75]);
      b.sph(gold, 0.03, -0.05, 0.73, 1.2);
      b.sph(gold, 0.03, 0.05, 0.73, 1.2);
    }

    // Tier 2+ (Citadel): Central Keep + Arrow Tower
    if (tier >= 2) {
      const kh = 1.15 + (tier - 1) * 0.35;
      b.boxB(W, 1.15, kh, 0.95, 0, 0.18, -0.15);
      b.boxB(W2, 1.22, 0.08, 1.02, 0, 0.18 + kh - 0.05, -0.15);
      b.pyramid(roof, 0.68, 0.55, 0, 0.18 + kh + 0.03, -0.15);
      for (const x of [-0.3, 0, 0.3]) {
        b.boxB(win, 0.09, 0.2, 0.03, x, 0.75, 0.34);
      }
    }

    // Tier 3 (Castle): Soaring Sovereign Spire + Twin Flanking Arrow Keeps
    if (tier >= 3) {
      b.cylB(W, 0.32, 0.36, 1.1, 0, 1.65, -0.15, 8);
      b.coneB(roof, 0.4, 0.75, 0, 2.75, -0.15, 8);
      b.sph(gold, 0.07, 0, 3.52, -0.15);
      for (const s of [-1, 1]) {
        tower(s * 0.72, -0.15, 0.22, 2.05, 0.55);
      }
    }
  });

  // Waving flags on corner towers and central keep
  const flagCol = isNecro ? '#6e28b0' : '#2458c6';
  const th = 0.95 + tier * 0.22;
  for (const [fx, fz] of [[-1.35, 0.95], [1.35, 0.95]]) {
    const fl = makeFlag(flagCol, 0.34, isNecro);
    fl.position.set(fx + 0.02, 0.18 + th + 0.46, fz);
    g.add(fl);
  }
  if (tier >= 3) {
    const topFlag = makeFlag(flagCol, 0.45, isNecro);
    topFlag.position.set(0.02, 3.55, -0.15);
    g.add(topFlag);
  }
  return g;
}

// ---------------------------------------------------------------------------
//  3. TAVERN, MARKETPLACE, SILO, BLACKSMITH
// ---------------------------------------------------------------------------
function buildTavernModel(faction, anims) {
  const isNecro = faction === 'necropolis';
  const g = cachedGroup(`town_b_${faction}_tavern`, (b) => {
    const W = mat(isNecro ? '#4c4356' : '#f2e6cc');
    const timber = mat(isNecro ? '#28222e' : C.woodDark);
    const roof = mat(isNecro ? '#3d2856' : '#b8432c');
    const win = mat(isNecro ? '#84ffa8' : '#ffd880', { e: isNecro ? '#2cff6a' : '#ff9c24', ei: 1.2 });

    b.boxB(mat(isNecro ? '#352f3d' : '#a89f8e'), 1.65, 0.14, 1.35, 0, 0, 0);
    // Main two-story hall
    b.boxB(W, 1.25, 0.48, 0.95, -0.1, 0.14, -0.05);
    b.boxB(W, 1.34, 0.44, 1.04, -0.1, 0.62, -0.05);
    for (let i = -2; i <= 2; i++) {
      b.boxB(timber, 0.04, 0.44, 1.06, -0.1 + i * 0.28, 0.62, -0.05);
    }
    b.roof(roof, 1.48, 0.52, 1.16, -0.1, 1.06, -0.05);

    // Side porch + barrels + sign post
    b.boxB(W, 0.55, 0.52, 0.75, 0.48, 0.14, 0.05);
    b.roof(roof, 0.64, 0.3, 0.84, 0.48, 0.66, 0.05, true);
    // Chimney
    b.boxB(mat('#6e665e'), 0.2, 0.95, 0.2, -0.52, 0.55, -0.25);

    // Door & glowing windows
    b.boxB(timber, 0.22, 0.34, 0.04, -0.1, 0.14, 0.44);
    for (const x of [-0.42, 0.22]) {
      b.boxB(win, 0.14, 0.16, 0.03, x, 0.28, 0.44);
      b.boxB(win, 0.14, 0.16, 0.03, x, 0.74, 0.48);
    }

    // Hanging tavern sign & barrels outside
    b.cylB(timber, 0.03, 0.035, 0.72, 0.52, 0.14, 0.52, 6);
    b.box(timber, 0.3, 0.03, 0.03, 0.64, 0.8, 0.52);
    b.cylB(mat('#f0c848', { e: '#a06800', ei: 0.4 }), 0.07, 0.07, 0.14, 0.72, 0.6, 0.52, 8);
    for (const [bx, bz] of [[0.32, 0.5], [0.46, 0.52]]) {
      b.cylB(mat(C.wood), 0.08, 0.08, 0.18, bx, 0.14, bz, 8);
    }
  });
  anims.push(
    addSmoke(g, -0.52, 1.52, -0.25, {
      count: 4,
      size: 0.22,
      rise: 0.8,
      color: isNecro ? '#8e74a8' : '#d8d2c8',
      opacity: 0.48,
    })
  );
  return g;
}

function buildMarketplaceModel(faction) {
  const isNecro = faction === 'necropolis';
  return cachedGroup(`town_b_${faction}_marketplace`, (b) => {
    const baseM = mat(isNecro ? '#3b3446' : '#c4ba9e');
    const wood = mat(isNecro ? '#3a2d38' : C.wood);
    b.boxB(baseM, 2.05, 0.1, 1.55, 0, 0, 0);

    const stallColors = isNecro
      ? [['#582c7a', '#261834'], ['#246652', '#1a2824'], ['#6a244e', '#281828']]
      : [['#c8382e', '#f5ebd6'], ['#2b64ba', '#f5ebd6'], ['#d89c28', '#3c8838']];

    const stalls = [
      [-0.58, -0.28, 0.15, stallColors[0]],
      [0.58, -0.28, -0.15, stallColors[1]],
      [-0.52, 0.38, 0.08, stallColors[2]],
    ];
    for (const [sx, sz, ry, [c1, c2]] of stalls) {
      b.push([sx, 0.1, sz], [0, ry, 0]);
      b.boxB(wood, 0.68, 0.24, 0.38, 0, 0, 0);
      for (const lx of [-0.3, 0.3]) {
        for (const lz of [-0.15, 0.15]) b.cylB(wood, 0.02, 0.02, 0.58, lx, 0, lz, 5);
      }
      for (let i = -2; i <= 2; i++) {
        b.box(mat(i % 2 ? c1 : c2), 0.15, 0.06, 0.48, i * 0.14, 0.6, 0, 0.18, 0, 0);
      }
      b.pop();
    }

    // Goods: crates, sacks, gold/crystal piles, merchant cart
    b.boxB(wood, 0.52, 0.16, 0.34, 0.48, 0.18, 0.36, -0.25);
    for (const s of [-1, 1]) {
      b.add(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 10), wood, [0.48 + s * 0.24, 0.18, 0.36], [0, 0, PI / 2]);
    }
    b.sph(mat('#dfd0a6'), 0.12, -0.05, 0.2, 0.1, 1);
    b.sph(mat('#dfd0a6'), 0.11, 0.12, 0.19, 0.15, 1);
    b.sph(isNecro ? mat('#52ff98', { e: '#18c060', ei: 1.2 }) : MAT.gold, 0.1, 0.48, 0.38, 0.36, 1);
  });
}

function buildSiloModel(faction) {
  const isNecro = faction === 'necropolis';
  return cachedGroup(`town_b_${faction}_silo`, (b) => {
    const W = mat(isNecro ? '#443d50' : '#dfd6c3');
    const W2 = mat(isNecro ? '#2e2938' : '#b8ae9a');
    const roof = mat(isNecro ? '#542c7c' : '#b4422c');
    const wood = mat(C.woodDark);
    const crystal = mat(isNecro ? '#4eff90' : '#4ec8ff', { e: isNecro ? '#18b858' : '#1878c8', ei: 1.2 });

    b.boxB(W2, 1.65, 0.14, 1.35, 0, 0, 0);
    // Tall cylindrical granary/resource tower
    b.cylB(W, 0.46, 0.52, 1.38, -0.25, 0.14, -0.1, 10);
    for (const y of [0.45, 0.85, 1.25]) {
      b.cylB(MAT.iron, 0.51, 0.51, 0.04, -0.25, y, -0.1, 10);
    }
    b.coneB(roof, 0.58, 0.52, -0.25, 1.52, -0.1, 10);
    b.sph(MAT.gold, 0.05, -0.25, 2.06, -0.1);

    // Hoist crane arm + resource storehouse shed
    b.box(wood, 0.55, 0.05, 0.05, 0.12, 1.38, -0.1);
    b.boxB(W, 0.68, 0.62, 0.72, 0.42, 0.14, 0.05);
    b.roof(roof, 0.76, 0.3, 0.8, 0.42, 0.76, 0.05);

    // Stacked wood, ore & glowing crystals in front
    for (let i = 0; i < 3; i++) {
      b.cyl(mat(C.bark), 0.06, 0.06, 0.45, -0.35 + i * 0.13, 0.2, 0.46, 6, 0, 0, PI / 2);
    }
    b.add(new THREE.OctahedronGeometry(0.14), crystal, [0.35, 0.28, 0.5]);
    b.add(new THREE.OctahedronGeometry(0.1), MAT.gold, [0.52, 0.24, 0.48]);
  });
}

function buildBlacksmithModel(faction, anims) {
  const isNecro = faction === 'necropolis';
  const g = cachedGroup(`town_b_${faction}_blacksmith`, (b) => {
    const W = mat(isNecro ? '#463f52' : '#d8cfc0');
    const roof = mat(isNecro ? '#382a48' : '#586272');
    const stone = mat('#6e6862');
    const fireCol = isNecro ? '#48ff88' : '#ff6818';

    b.boxB(stone, 1.75, 0.14, 1.4, 0, 0, 0);
    // Main smithy hall
    b.boxB(W, 1.05, 0.68, 0.88, -0.22, 0.14, -0.1);
    b.roof(roof, 1.18, 0.38, 0.98, -0.22, 0.82, -0.1);

    // Tall stone smelter furnace + chimney
    b.boxB(stone, 0.48, 1.32, 0.48, -0.52, 0.14, -0.22);
    b.boxB(MAT.iron, 0.54, 0.08, 0.54, -0.52, 1.4, -0.22);

    // Covered outdoor forge porch on right
    b.box(mat(C.woodDark), 0.78, 0.06, 0.86, 0.42, 0.68, 0.05, 0, 0, -0.15);
    for (const [px, pz] of [[0.72, 0.4], [0.72, -0.3]]) {
      b.cylB(mat(C.woodDark), 0.035, 0.04, 0.54, px, 0.14, pz, 6);
    }
    // Glowing forge hearth + anvil + weapon rack
    b.boxB(stone, 0.38, 0.28, 0.36, 0.25, 0.14, -0.12);
    b.boxB(mat(fireCol, { e: fireCol, ei: 1.8 }), 0.26, 0.1, 0.24, 0.25, 0.36, -0.12);
    b.boxB(MAT.iron, 0.22, 0.14, 0.1, 0.45, 0.14, 0.28);
    b.cylB(MAT.steel, 0.12, 0.12, 0.03, -0.1, 0.32, 0.42, 8);
  });

  const fireGlow = glow(isNecro ? '#48ff88' : '#ff7a20', 0.95, 0.65, true);
  fireGlow.position.set(0.25, 0.48, -0.05);
  g.add(fireGlow);
  const ph = Math.random() * 10;
  anims.push((dt, t) => {
    fireGlow.material.opacity = 0.5 + Math.sin(t * 11 + ph) * 0.16;
  });
  anims.push(
    addSmoke(g, -0.52, 1.52, -0.22, {
      count: 4,
      size: 0.25,
      rise: 0.9,
      color: isNecro ? '#6ae89a' : '#8a847e',
      opacity: 0.52,
    })
  );
  return g;
}

// ---------------------------------------------------------------------------
//  4. MAGE GUILD CHAIN: mage1 .. mage4
// ---------------------------------------------------------------------------
function buildMageModel(faction, level, anims) {
  const isNecro = faction === 'necropolis';
  const g = cachedGroup(`town_b_${faction}_mage_${level}`, (b) => {
    const W = mat(isNecro ? '#423954' : '#e8e0cf');
    const W2 = mat(isNecro ? '#2e263c' : '#c5bba6');
    const roof = mat(isNecro ? '#5c2c90' : '#3b4fb8');
    const accent = mat(isNecro ? '#4eff98' : '#58c8ff', { e: isNecro ? '#18c860' : '#2488e8', ei: 1.4 });

    b.cylB(W2, 0.92, 1.02, 0.18, 0, 0, 0, 10);
    // Stacked octagonal wizard tiers (1..4)
    let y = 0.18;
    for (let t = 0; t < level; t++) {
      const rBot = 0.58 - t * 0.08;
      const rTop = 0.52 - t * 0.08;
      const th = 0.58 - t * 0.03;
      b.cylB(W, rTop, rBot, th, 0, y, 0, 8);
      b.cylB(W2, rTop + 0.05, rTop + 0.02, 0.06, 0, y + th - 0.04, 0, 8);
      for (let w = 0; w < 4; w++) {
        const a = (w / 4) * TAU;
        b.boxB(accent, 0.07, 0.18, 0.04, Math.cos(a) * rTop, y + th * 0.38, Math.sin(a) * rTop, -a + PI / 2);
      }
      y += th;
    }
    // Conical spire roof + crystal finial
    const rFinal = 0.56 - (level - 1) * 0.08;
    b.coneB(roof, rFinal, 0.65 + level * 0.08, 0, y, 0, 8);
    const tipY = y + 0.65 + level * 0.08;
    b.add(new THREE.OctahedronGeometry(0.11 + level * 0.02), accent, [0, tipY + 0.08, 0]);
  });

  // Orbiting arcane rings (1 ring per mage level)
  const ringPivot = new THREE.Group();
  const topY = 0.6 + level * 0.55;
  ringPivot.position.set(0, topY, 0);
  g.add(ringPivot);

  const ringMat = mat(isNecro ? '#68ffaa' : '#ffd258', {
    e: isNecro ? '#20c868' : '#c87800',
    ei: 1.1,
    m: 0.4,
    r: 0.25,
  });
  const rings = [];
  for (let i = 0; i < level; i++) {
    const rm = new THREE.Mesh(new THREE.TorusGeometry(0.66 + i * 0.12, 0.02, 5, 28), ringMat);
    rm.rotation.x = 0.45 + i * 0.38;
    rm.rotation.y = i * 0.6;
    ringPivot.add(rm);
    rings.push(rm);
  }
  const gl = glow(isNecro ? '#58ffa0' : '#7fd4ff', 1.2 + level * 0.25, 0.55, true);
  gl.position.set(0, topY + 0.35, 0);
  g.add(gl);

  anims.push((dt, t) => {
    rings.forEach((r, i) => {
      r.rotation.z += dt * (0.7 + i * 0.25) * (i % 2 ? -1 : 1);
      r.rotation.x += dt * 0.25;
    });
    gl.material.opacity = 0.42 + Math.sin(t * 2.5) * 0.15;
  });
  return g;
}

// ---------------------------------------------------------------------------
//  5. SPECIAL BUILDING: Castle Stables / Necropolis Soul Amplifier
// ---------------------------------------------------------------------------
function buildSpecialModel(faction, anims) {
  if (faction === 'castle') {
    const g = cachedGroup('town_b_castle_special', (b) => {
      const red = mat('#b4422e');
      const trim = mat('#f2ead8');
      const wood = mat(C.woodLight);
      b.boxB(mat('#9a8c68'), 1.85, 0.12, 1.45, 0, 0, 0);
      // Barn with hayloft
      b.boxB(red, 0.95, 0.62, 0.78, -0.35, 0.12, -0.15);
      b.roof(mat('#54483e'), 1.08, 0.36, 0.88, -0.35, 0.74, -0.15);
      b.boxB(trim, 0.32, 0.4, 0.03, -0.35, 0.12, 0.25);

      // Paddock fence + water trough + 2 steeds
      for (const [fx, fz] of [[0.2, 0.55], [0.75, 0.55], [0.75, 0.0], [0.75, -0.45], [0.2, -0.45]]) {
        b.boxB(wood, 0.05, 0.32, 0.05, fx, 0.12, fz);
      }
      b.box(wood, 0.58, 0.035, 0.03, 0.48, 0.34, 0.55);
      b.box(wood, 0.03, 0.035, 1.0, 0.75, 0.34, 0.05);
      b.boxB(MAT.water, 0.32, 0.12, 0.16, 0.2, 0.12, -0.25);

      horsePart(b, 0.32, 0.12, 0.18, 0.45, '#7c4828', '#24140a');
      horsePart(b, 0.55, 0.12, -0.08, -0.35, '#ece6dc', '#c8beaa');
    });
    return g;
  }

  // Necropolis: Soul Amplifier (מגבר הנשמות) with skyward emerald necromantic beam
  const g = cachedGroup('town_b_necro_special', (b) => {
    const ob = mat('#322a40');
    const bone = mat(C.bone);
    const rune = mat('#4eff98', { e: '#18d868', ei: 1.6 });
    b.cylB(ob, 0.88, 0.98, 0.16, 0, 0, 0, 8);
    b.cylB(mat('#463c58'), 0.62, 0.72, 0.16, 0, 0.16, 0, 8);
    // 4 curved bone claws surrounding central pylon
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + PI / 4;
      b.push([Math.cos(a) * 0.52, 0.32, Math.sin(a) * 0.52], [0, -a, 0.28]);
      b.add(new THREE.ConeGeometry(0.09, 1.15, 5), bone, [0, 0.55, 0]);
      b.pop();
    }
    b.cylB(ob, 0.18, 0.28, 1.25, 0, 0.32, 0, 6);
    b.add(new THREE.OctahedronGeometry(0.24), rune, [0, 1.78, 0]);
  });

  const beamMat = mat('#58ffa0', { e: '#28ff78', ei: 0.65, op: 0.22, ds: true });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 2.2, 10, 1, true), beamMat);
  beam.position.set(0, 2.65, 0);
  g.add(beam);
  const coreGlow = glow('#58ffa0', 0.95, 0.35, true);
  coreGlow.position.set(0, 1.78, 0);
  g.add(coreGlow);

  anims.push((dt, t) => {
    beam.rotation.y += dt * 1.4;
    coreGlow.material.opacity = 0.28 + Math.sin(t * 3.5) * 0.1;
  });
  return g;
}

// ---------------------------------------------------------------------------
//  6. CREATURE DWELLINGS: dw1..dw7 & dw1u..dw7u for Castle & Necropolis
// ---------------------------------------------------------------------------
function buildCastleDwelling(tier, upg, anims) {
  const key = `town_b_castle_dw${tier}${upg ? 'u' : ''}`;
  const W = mat(upg ? '#f5efe0' : '#e4dccb');
  const W2 = mat('#c2b8a3');
  const roof = mat(upg ? '#2456c4' : '#b4452e');
  const gold = MAT.gold;
  const win = mat('#ffe39a', { e: '#ffb438', ei: 1.1 });

  switch (tier) {
    case 1: // Guardhouse / Halberdier Guardhouse
      return cachedGroup(key, (b) => {
        b.boxB(W2, 1.45, 0.14, 1.25, 0, 0, 0);
        const h = upg ? 0.88 : 0.64;
        b.boxB(W, 1.05, h, 0.85, -0.1, 0.14, 0);
        wallRun(b, W, W2, -0.62, 0.42, 0.42, 0.42, 0.16, 0.1, 0.14 + h);
        b.cylB(W, 0.24, 0.27, h + 0.35, 0.42, 0.14, 0.22, 8);
        b.coneB(roof, 0.3, 0.42, 0.42, 0.14 + h + 0.35, 0.22, 8);
        if (upg) {
          b.sph(gold, 0.05, 0.42, 0.14 + h + 0.8, 0.22);
          b.cylB(gold, 0.14, 0.14, 0.03, -0.1, 0.65, 0.44, 6);
        }
        // Weapon rack with pikes
        for (let i = 0; i < 4; i++) {
          b.cylB(mat(C.woodLight), 0.012, 0.012, 0.55, -0.45 + i * 0.1, 0.14, 0.5, 4);
          b.add(new THREE.ConeGeometry(0.025, 0.09, 4), MAT.steel, [-0.45 + i * 0.1, 0.72, 0.5]);
        }
      });

    case 2: // Archers' Tower / Marksmen Tower
      return cachedGroup(key, (b) => {
        b.boxB(W2, 1.45, 0.14, 1.3, 0, 0, 0);
        const h = upg ? 1.38 : 1.05;
        b.boxB(W, 0.74, h, 0.74, -0.18, 0.14, -0.08);
        b.boxB(mat(C.wood), 0.86, 0.22, 0.86, -0.18, 0.14 + h - 0.12, -0.08);
        b.pyramid(roof, 0.54, 0.48, -0.18, 0.14 + h + 0.1, -0.08);
        if (upg) {
          b.cylB(W, 0.2, 0.22, h + 0.25, 0.28, 0.14, -0.08, 8);
          b.coneB(roof, 0.25, 0.42, 0.28, 0.14 + h + 0.25, -0.08, 8);
          b.sph(gold, 0.045, 0.28, 0.14 + h + 0.7, -0.08);
        }
        // Archery bullseye targets
        for (const tx of [0.22, 0.48]) {
          b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 10), mat('#f4ead2'), [tx, 0.32, 0.42], [PI / 2, 0, 0]);
          b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.035, 10), mat('#d2382c'), [tx, 0.32, 0.42], [PI / 2, 0, 0]);
        }
      });

    case 3: // Griffin Tower / Royal Griffin Bastion
      return cachedGroup(key, (b) => {
        b.cylB(W2, 0.82, 0.92, 0.18, 0, 0, 0, 10);
        const h = upg ? 1.55 : 1.22;
        b.cylB(W, 0.44, 0.54, h, 0, 0.18, 0, 10);
        b.cylB(upg ? gold : W2, 0.54, 0.46, 0.12, 0, 0.18 + h, 0, 10);
        // Golden woven aerie nest on summit
        b.add(new THREE.TorusGeometry(0.38, 0.08, 6, 14), mat(C.hay), [0, 0.32 + h, 0], [PI / 2, 0, 0]);
        // Sculpted griffin wings flanking the tower
        for (const s of [-1, 1]) {
          b.box(upg ? gold : W, 0.38, 0.22, 0.08, s * 0.52, 0.18 + h * 0.75, 0.15, 0, 0, s * 0.42);
        }
      });

    case 4: // Barracks / Crusader Hall
      return cachedGroup(key, (b) => {
        b.boxB(W2, 1.75, 0.14, 1.35, 0, 0, 0);
        const h = upg ? 0.85 : 0.65;
        b.boxB(W, 1.45, h, 0.88, 0, 0.14, -0.08);
        b.roof(roof, 1.56, 0.42, 0.98, 0, 0.14 + h, -0.08);
        for (const s of [-1, 1]) {
          b.boxB(win, 0.12, 0.22, 0.03, s * 0.42, 0.38, 0.37);
          if (upg) {
            b.cylB(W, 0.2, 0.22, h + 0.32, s * 0.74, 0.14, 0.28, 8);
            b.coneB(roof, 0.25, 0.38, s * 0.74, 0.14 + h + 0.32, 0.28, 8);
          }
        }
        b.box(gold, 0.08, 0.28, 0.04, 0, 0.62, 0.38);
        b.box(gold, 0.22, 0.08, 0.04, 0, 0.66, 0.38);
      });

    case 5: // Monastery / Zealot Cathedral
      return cachedGroup(key, (b) => {
        b.boxB(W2, 1.7, 0.16, 1.45, 0, 0, 0);
        const h = upg ? 1.05 : 0.82;
        b.boxB(W, 1.15, h, 1.05, 0, 0.16, -0.05);
        b.roof(roof, 1.26, 0.48, 1.14, 0, 0.16 + h, -0.05, true);
        // Rose window
        b.add(new THREE.CircleGeometry(0.2, 12), win, [0, 0.68, 0.485]);
        b.add(new THREE.TorusGeometry(0.2, 0.025, 5, 12), upg ? gold : W2, [0, 0.68, 0.49]);
        // Steeple spires
        const spires = upg ? [-0.48, 0.48] : [0];
        for (const sx of spires) {
          b.boxB(W, 0.28, h + 0.48, 0.28, sx, 0.16, 0.36);
          b.pyramid(upg ? gold : roof, 0.2, 0.55, sx, 0.16 + h + 0.48, 0.36);
        }
      });

    case 6: // Training Grounds / Champions' Jousting Arena
      return cachedGroup(key, (b) => {
        b.boxB(mat('#d8c396'), 2.1, 0.1, 1.55, 0, 0, 0);
        // Central wooden tilt barrier + lances
        b.boxB(mat(C.woodDark), 1.55, 0.2, 0.06, 0, 0.1, 0.12);
        b.box(mat('#f5ebd6'), 1.56, 0.04, 0.07, 0, 0.28, 0.12);
        // Spectator pavilion at back
        b.boxB(W, 1.45, 0.42, 0.45, 0, 0.1, -0.45);
        b.roof(roof, 1.55, 0.32, 0.55, 0, 0.52, -0.45);
        if (upg) {
          b.coneB(gold, 0.36, 0.45, 0, 0.82, -0.45, 8);
          horsePart(b, -0.42, 0.1, 0.36, 0.1, '#f4efe6', '#d8c898');
          horsePart(b, 0.42, 0.1, -0.1, PI - 0.1, '#824c2a', '#26160c');
        }
      });

    case 7: { // Portal of Glory / Exalted Portal of Glory
      const g = cachedGroup(key, (b) => {
        const marble = mat('#faf6ec');
        b.cylB(W2, 1.35, 1.5, 0.18, 0, 0, 0, 12);
        b.cylB(marble, 1.1, 1.25, 0.16, 0, 0.18, 0, 12);
        // Celestial arch
        for (const s of [-1, 1]) {
          column(b, marble, gold, s * 0.58, 0.34, 0, 1.15, 0.09);
          if (upg) {
            column(b, marble, gold, s * 0.92, 0.34, 0.18, 0.92, 0.07);
            // Sculpted angel wings on arch
            b.box(gold, 0.48, 0.26, 0.06, s * 0.82, 1.35, 0, 0, 0, s * 0.48);
          }
        }
        b.add(new THREE.TorusGeometry(0.58, 0.1, 6, 18, PI), upg ? gold : marble, [0, 1.45, 0]);
      });
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.52, 28),
        portalMaterial('#ffbe38', '#fff8d8')
      );
      disc.position.set(0, 1.15, 0);
      g.add(disc);
      const gl = glow('#ffe078', upg ? 1.55 : 1.15, 0.52, true);
      gl.position.set(0, 1.25, 0.05);
      g.add(gl);
      anims.push((dt, t) => {
        disc.rotation.z = -t * 0.5;
        gl.material.opacity = 0.42 + Math.sin(t * 2.4) * 0.14;
      });
      return g;
    }
  }
}

function buildNecroDwelling(tier, upg, anims) {
  const key = `town_b_necro_dw${tier}${upg ? 'u' : ''}`;
  const W = mat(upg ? '#524864' : '#433c50');
  const W2 = mat('#2d2736');
  const roof = mat(upg ? '#6c32a8' : '#4c2872');
  const bone = mat(C.bone);
  const green = mat('#58ff9a', { e: '#1ad860', ei: 1.4 });
  const crimson = mat('#ff3858', { e: '#d81038', ei: 1.4 });

  switch (tier) {
    case 1: // Cursed Temple (Skeletons)
      return cachedGroup(key, (b) => {
        b.boxB(W2, 1.5, 0.16, 1.3, 0, 0, 0);
        for (const sx of [-0.52, -0.18, 0.18, 0.52]) {
          column(b, W, W2, sx, 0.16, 0.42, upg ? 0.78 : 0.62, 0.06);
        }
        b.boxB(W, 1.15, 0.65, 0.78, 0, 0.16, -0.12);
        b.add(prismGeo(1.32, 0.34, 1.05), upg ? roof : W2, [0, 0.82, 0]);
        b.cylB(green, 0.14, 0.18, 0.18, 0, 0.16, 0.36, 8);
        if (upg) {
          b.sph(bone, 0.14, 0, 0.98, 0.54);
          b.add(new THREE.ConeGeometry(0.04, 0.24, 4), bone, [-0.18, 1.08, 0.54], [0, 0, 0.6]);
          b.add(new THREE.ConeGeometry(0.04, 0.24, 4), bone, [0.18, 1.08, 0.54], [0, 0, -0.6]);
        }
      });

    case 2: // Graveyard (Zombies)
      return cachedGroup(key, (b) => {
        b.boxB(mat('#2a2630'), 1.75, 0.1, 1.45, 0, 0, 0);
        // Crypt gate + headstones
        b.boxB(W, 0.62, upg ? 0.78 : 0.55, 0.52, 0, 0.1, -0.32);
        b.roof(roof, 0.7, 0.28, 0.6, 0, upg ? 0.88 : 0.65, -0.32);
        const stones = [[-0.55, 0.25], [-0.25, 0.35], [0.28, 0.32], [0.58, 0.22], [-0.48, -0.15], [0.48, -0.15]];
        for (const [tx, tz] of stones) {
          b.boxB(W, 0.16, 0.26, 0.05, tx, 0.1, tz, tx * 0.2);
          if (upg) b.boxB(green, 0.04, 0.14, 0.06, tx, 0.15, tz);
        }
      });

    case 3: { // Tomb of Souls (Wights / Wraiths)
      const g = cachedGroup(key, (b) => {
        b.cylB(W2, 0.85, 0.95, 0.14, 0, 0, 0, 9);
        b.add(jitter(new THREE.SphereGeometry(0.68, 9, 6, 0, TAU, 0, PI / 2), 0.05, 44), W, [0, 0.14, -0.05]);
        b.boxB(W2, 0.46, 0.52, 0.28, 0, 0.14, 0.52);
        b.boxB(green, 0.24, 0.36, 0.06, 0, 0.14, 0.65);
        if (upg) {
          b.add(new THREE.ConeGeometry(0.24, 0.85, 5), roof, [0, 1.15, -0.05]);
          b.add(new THREE.OctahedronGeometry(0.14), green, [0, 1.72, -0.05]);
        }
      });
      const wisp = glow('#68ffb8', upg ? 1.1 : 0.8, 0.48, true);
      wisp.position.set(0, 0.75, 0.4);
      g.add(wisp);
      return g;
    }

    case 4: // Dark Estate (Vampires)
      return cachedGroup(key, (b) => {
        b.boxB(W2, 1.7, 0.15, 1.35, 0, 0, 0);
        const h = upg ? 0.98 : 0.75;
        b.boxB(W, 1.25, h, 0.88, 0, 0.15, -0.05);
        b.roof(roof, 1.38, 0.48, 0.98, 0, 0.15 + h, -0.05);
        for (const s of [-1, 1]) {
          b.cylB(W, 0.22, 0.24, h + 0.38, s * 0.58, 0.15, 0.25, 6);
          b.coneB(roof, 0.28, 0.52, s * 0.58, 0.15 + h + 0.38, 0.25, 6);
          b.boxB(crimson, 0.1, 0.22, 0.03, s * 0.32, 0.48, 0.4);
        }
        if (upg) {
          b.add(new THREE.CircleGeometry(0.18, 10), crimson, [0, 0.82, 0.4]);
        }
      });

    case 5: // Mausoleum (Liches)
      return cachedGroup(key, (b) => {
        b.boxB(W2, 1.7, 0.2, 1.45, 0, 0, 0);
        b.boxB(W, 1.35, 0.24, 1.15, 0, 0.2, 0);
        b.boxB(W, 1.0, upg ? 0.85 : 0.65, 0.85, 0, 0.44, 0);
        b.pyramid(roof, 0.62, 0.45, 0, 0.44 + (upg ? 0.85 : 0.65), 0);
        for (const [ox, oz] of [[-0.68, 0.52], [0.68, 0.52]]) {
          b.add(new THREE.CylinderGeometry(0.04, 0.1, 0.75, 4).rotateY(PI / 4), W2, [ox, 0.56, oz]);
          b.sph(green, 0.06, ox, 0.98, oz);
        }
        if (upg) {
          b.add(new THREE.OctahedronGeometry(0.18), green, [0, 1.92, 0]);
        }
      });

    case 6: // Hall of Darkness (Black / Dread Knights)
      return cachedGroup(key, (b) => {
        const ironD = mat('#282a34', { m: 0.4, r: 0.45 });
        b.boxB(W2, 1.85, 0.16, 1.45, 0, 0, 0);
        const h = upg ? 1.02 : 0.78;
        b.boxB(ironD, 1.35, h, 0.95, 0, 0.16, -0.05);
        for (const s of [-1, 1]) {
          b.cylB(ironD, 0.26, 0.28, h + 0.35, s * 0.65, 0.16, 0.25, 6);
          b.coneB(roof, 0.32, 0.48, s * 0.65, 0.16 + h + 0.35, 0.25, 6);
          b.add(new THREE.ConeGeometry(0.05, 0.28, 4), bone, [s * 0.22, 0.82, 0.46], [0, 0, -s * 0.55]);
        }
        if (upg) {
          b.boxB(green, 0.28, 0.42, 0.04, 0, 0.16, 0.44);
        }
      });

    case 7: { // Dragon Vault (Bone / Ghost Dragons)
      const g = cachedGroup(key, (b) => {
        b.cylB(W2, 1.35, 1.5, 0.18, 0, 0, 0, 10);
        // Giant Dragon Skull & Ribcage Cavern
        b.add(jitter(new THREE.DodecahedronGeometry(0.85, 1), 0.1, 88), W2, [0, 0.72, -0.25], null, [1.25, 0.95, 1.0]);
        b.sph(bone, 0.52, 0, 0.92, 0.22, 1, [1.05, 0.88, 1.15]);
        for (const s of [-1, 1]) {
          b.sph(green, 0.09, s * 0.22, 0.98, 0.62);
          b.add(new THREE.ConeGeometry(0.09, 0.62, 5), bone, [s * 0.42, 1.32, 0.12], [-0.2, 0, -s * 0.62]);
          if (upg) {
            // Outstretched skeletal dragon wings
            b.box(bone, 0.75, 0.06, 0.06, s * 0.85, 1.15, -0.1, 0, 0, s * 0.35);
            b.box(roof, 0.68, 0.42, 0.03, s * 0.85, 0.92, -0.12, 0, 0, s * 0.35);
          }
        }
      });
      const vortex = new THREE.Mesh(
        new THREE.CircleGeometry(0.38, 24),
        portalMaterial('#20d868', '#7828ff')
      );
      vortex.position.set(0, 0.52, 0.48);
      g.add(vortex);
      const gl = glow('#48ff98', upg ? 1.55 : 1.15, 0.48, true);
      gl.position.set(0, 0.72, 0.55);
      g.add(gl);
      anims.push((dt, t) => {
        vortex.rotation.z = t * 0.65;
        gl.material.opacity = 0.38 + Math.sin(t * 2.6) * 0.14;
      });
      return g;
    }
  }
}

// ---------------------------------------------------------------------------
//  Main entry: buildTownLayout(faction)
// ---------------------------------------------------------------------------
export function buildTownLayout(faction = 'castle') {
  const isNecro = faction === 'necropolis';
  const root = new THREE.Group();
  root.name = `townScene_${faction}`;

  const anims = [];
  if (isNecro) buildNecroEnvironment(root, anims);
  else buildCastleEnvironment(root, anims);

  // Create slot anchors
  const slotAnchors = {};
  for (const [slotKey, cfg] of Object.entries(SLOTS)) {
    const anchor = new THREE.Group();
    anchor.name = `slot_${slotKey}`;
    anchor.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    anchor.rotation.y = cfg.ry || 0;
    root.add(anchor);
    slotAnchors[slotKey] = anchor;
  }

  // Instantiate all 30 buildings in getBuildings(faction)
  const defs = getBuildings(faction);
  const buildings = {};

  for (const id of Object.keys(defs)) {
    let model;
    if (id.startsWith('hall')) {
      const lvl = Number(id.slice(4)) || 1;
      model = buildHallModel(faction, lvl, anims);
    } else if (id === 'fort' || id === 'citadel' || id === 'castle') {
      const tier = id === 'fort' ? 1 : id === 'citadel' ? 2 : 3;
      model = buildFortModel(faction, tier, anims);
    } else if (id === 'tavern') {
      model = buildTavernModel(faction, anims);
    } else if (id === 'marketplace') {
      model = buildMarketplaceModel(faction);
    } else if (id === 'silo') {
      model = buildSiloModel(faction);
    } else if (id === 'blacksmith') {
      model = buildBlacksmithModel(faction, anims);
    } else if (id.startsWith('mage')) {
      const lvl = Number(id.slice(4)) || 1;
      model = buildMageModel(faction, lvl, anims);
    } else if (id === 'special') {
      model = buildSpecialModel(faction, anims);
    } else if (id.startsWith('dw')) {
      const tier = Number(id[2]) || 1;
      const upg = id.endsWith('u');
      model = isNecro
        ? buildNecroDwelling(tier, upg, anims)
        : buildCastleDwelling(tier, upg, anims);
    } else {
      model = new THREE.Group();
    }

    const wrapper = new THREE.Group();
    wrapper.add(model);
    tagBuildingId(wrapper, id);

    const slotKey = slotKeyForBuilding(id);
    const parent = slotAnchors[slotKey] || root;
    parent.add(wrapper);
    buildings[id] = wrapper;
  }

  // Camera framed so all 15 slots sit clearly in top ~78% of screen (bottom ~22% reserved for UI)
  const camera = {
    position: [0, 10.8, 19.6],
    target: [0, 0.55, -1.2],
    fov: 42,
  };

  const lighting = isNecro
    ? {
        sunColor: 0xc8daff,
        sunIntensity: 2.05,
        sunPosition: [-12, 22, 15],
        ambientSky: 0x9c88dc,
        ambientGround: 0x3d5248,
        ambientIntensity: 1.18,
        fogColor: 0x181028,
        fogNear: 46,
        fogFar: 118,
      }
    : {
        sunColor: 0xfff0cc,
        sunIntensity: 1.75,
        sunPosition: [14, 22, 14],
        ambientSky: 0xb4dcff,
        ambientGround: 0x4d6038,
        ambientIntensity: 0.76,
        fogColor: 0x88b8e6,
        fogNear: 46,
        fogFar: 118,
      };

  function update(dt = 0.016, time = 0) {
    updateStructureTime(time);
    for (let i = 0; i < anims.length; i++) {
      anims[i](dt, time);
    }
  }

  return {
    root,
    buildings,
    camera,
    lighting,
    update,
  };
}

// ---------------------------------------------------------------------------
//  Construction Animation Effect (~0.9s golden/magical flash + rising scale-in)
// ---------------------------------------------------------------------------
export function playConstructionEffect(layout, buildingId) {
  const obj = layout?.buildings?.[buildingId];
  if (!obj) return Promise.resolve();

  obj.visible = true;
  const y0 = obj.position.y;
  const s0 = obj.scale.clone();

  // Create golden/magical burst at building's world/parent coordinates
  const fxGroup = new THREE.Group();
  if (obj.parent) obj.parent.add(fxGroup);
  fxGroup.position.copy(obj.position);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffdf68,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.95, 28), ringMat);
  ring.rotation.x = -PI / 2;
  ring.position.y = 0.08;
  fxGroup.add(ring);

  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0xffe88a,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 2.8, 18, 1, true), pillarMat);
  pillar.position.y = 1.4;
  fxGroup.add(pillar);

  const flashGlow = glow('#ffe484', 3.4, 0.95, true);
  flashGlow.position.y = 0.9;
  fxGroup.add(flashGlow);

  const duration = 0.9;
  const outBack = (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  return new Promise((resolve) => {
    let elapsed = 0;
    let done = false;
    let offEngine = null;
    let timer = null;

    const cleanup = () => {
      if (done) return;
      done = true;
      if (offEngine) offEngine();
      if (timer) clearInterval(timer);
      obj.position.y = y0;
      obj.scale.copy(s0);
      if (fxGroup.parent) fxGroup.parent.remove(fxGroup);
      ring.geometry.dispose();
      ringMat.dispose();
      pillar.geometry.dispose();
      pillarMat.dispose();
      resolve();
    };

    const step = (dt) => {
      elapsed += dt;
      const t = Math.min(1, elapsed / duration);
      const k = Math.max(0.01, outBack(t));

      obj.position.y = y0 - (1 - Math.min(1, t * 1.25)) * 0.75;
      obj.scale.set(s0.x * k, s0.y * k, s0.z * k);

      ring.scale.setScalar(0.6 + t * 2.2);
      ringMat.opacity = (1 - t) * 0.95;

      pillar.scale.set(0.8 + t * 0.9, 0.5 + t * 1.2, 0.8 + t * 0.9);
      pillarMat.opacity = Math.sin(t * PI) * 0.65;

      flashGlow.scale.setScalar(3.4 * (0.7 + Math.sin(t * PI) * 0.6));
      flashGlow.material.opacity = (1 - t * t) * 0.9;

      if (t >= 1) cleanup();
    };

    step(0);
    if (engine?.renderer) {
      offEngine = engine.onFrame((dt) => step(dt));
    } else {
      timer = setInterval(() => step(0.03), 30);
    }
  });
}
