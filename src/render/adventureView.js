// ============================================================================
//  תצוגת מפת ההרפתקאות (Three.js) — שטח מפוסל, קצף גלים, תאורה וחלקיקים
// ============================================================================
import * as THREE from 'three';
import { tween, ease } from './engine.js';
import { fogUniforms, patchFog, patchObjectFog } from './fog.js';
import { grainTexture, terrainNormalTexture, roadTexture, waterNormalTexture, glowTexture } from './textures.js';
import { TERRAINS } from '../data/terrain.js';
import { CREATURES } from '../data/creatures.js';
import { createMapObjectModel, createTownMapModel, getDecorationGeometry, getDecorationMaterial } from './structureModels.js';
import { createCreatureModel, createHeroModel } from './creatureModels.js';
import { hash2, makeNoise2D } from '../core/rng.js';

const R = 5; // terrain vertices per tile edge (higher subdivision for sculpted hills & coastlines)
const CAM_PITCH = THREE.MathUtils.degToRad(52);
const SEABED = [0.14, 0.22, 0.26];
const SHALLOW = [0.22, 0.52, 0.56];
const SAND = [0.85, 0.77, 0.54];

export class AdventureView {
  constructor(state, overlay) {
    this.state = state;
    this.overlay = overlay; // DOM element for floating texts
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.5, 400);
    this.target = new THREE.Vector3(state.map.w / 2, 0, state.map.h / 2);
    this.camTarget = this.target.clone();
    this.dist = 16;
    this.distTarget = 16;
    this.objModels = new Map();
    this.heroModels = new Map();
    this.animated = [];
    this.floaters = [];
    this.pathMarkers = [];
    this.follow = null;
    this.selectedHeroId = null;
    this.humanId = state.players.find((p) => p.human).id;
    this.handlers = {};
    this.noise = makeNoise2D(state.seed + 5);
    this.time = 0;

    this.scene.background = new THREE.Color('#0c1b2a');
    this.scene.fog = new THREE.Fog('#0c1b2a', 32, 85);
    this.setupLights();
    this.setupFogTexture();
    this.buildTerrain();
    this.buildWater();
    this.buildRoads();
    this.buildDecorations();
    this.buildAllObjects();
    this.buildHelpers();
    this.buildAtmosphereParticles();
    this.updateFog(true);
    this.updateCamera(true);
  }

  // ===================================================================== setup
  setupLights() {
    const hemi = new THREE.HemisphereLight('#d8ecff', '#4e3c24', 0.85);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight('#fff0cc', 1.95);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 95;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.018;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.sunOffset = new THREE.Vector3(-15, 29, 14);

    // Subtle cool sky fill light from the opposite azimuth so shadow sides have rich detail
    const rim = new THREE.DirectionalLight('#7cb2ff', 0.45);
    rim.position.set(16, 18, -14);
    this.scene.add(rim);
  }

  setupFogTexture() {
    const { w, h } = this.state.map;
    const S = 8;
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = w * S;
    this.fogCanvas.height = h * S;
    this.fogSmall = document.createElement('canvas');
    this.fogSmall.width = w;
    this.fogSmall.height = h;
    this.fogTex = new THREE.CanvasTexture(this.fogCanvas);
    this.fogTex.flipY = false;
    this.fogTex.wrapS = this.fogTex.wrapT = THREE.ClampToEdgeWrapping;
    this.fogTex.minFilter = THREE.LinearFilter;
    this.fogTex.magFilter = THREE.LinearFilter;
    this.fogTex.generateMipmaps = false;
    fogUniforms.uFogTex.value = this.fogTex;
    fogUniforms.uFogSize.value.set(w, h);
  }

  // ===================================================================== terrain
  tileTerrain(x, y) {
    const { w, h } = this.state.map;
    x = Math.max(0, Math.min(w - 1, x));
    y = Math.max(0, Math.min(h - 1, y));
    return this.state.map.terrain[y * w + x];
  }

  buildTerrain() {
    const M = this.state.map, { w, h } = M;
    const VW = w * R + 1, VH = h * R + 1;
    const pos = new Float32Array(VW * VH * 3);
    const col = new Float32Array(VW * VH * 3);
    const uv = new Float32Array(VW * VH * 2);
    const shoreMask = new Float32Array(VW * VH);
    this.heights = new Float32Array(VW * VH);
    const n = this.noise;
    const tileLand = (x, y) => (this.tileTerrain(x, y) === 'water' ? 0 : 1);
    const tileMtn = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return 0;
      return M.obstacle[y * w + x] === 'mountain' ? 1 : 0;
    };
    const tileTree = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return 0;
      return M.obstacle[y * w + x] === 'tree' ? 1 : 0;
    };
    const tmp = [0, 0, 0];
    for (let vy = 0; vy < VH; vy++) {
      for (let vx = 0; vx < VW; vx++) {
        const wx = vx / R, wz = vy / R;
        const fx = wx - 0.5, fz = wz - 0.5;
        const x0 = Math.floor(fx), z0 = Math.floor(fz);
        const tx = fx - x0, tz = fz - z0;
        const wts = [(1 - tx) * (1 - tz), tx * (1 - tz), (1 - tx) * tz, tx * tz];
        const cells = [[x0, z0], [x0 + 1, z0], [x0, z0 + 1], [x0 + 1, z0 + 1]];
        let land = 0, mtn = 0, tree = 0;
        tmp[0] = tmp[1] = tmp[2] = 0;
        const v = n.fbm(wx * 0.38, wz * 0.38, 4) * 0.5 + 0.5;
        let sandish = 0, snowy = 0, ashy = 0;
        for (let k = 0; k < 4; k++) {
          const [cx, cz] = cells[k];
          const t = this.tileTerrain(cx, cz);
          const T = TERRAINS[t];
          land += tileLand(cx, cz) * wts[k];
          mtn += tileMtn(cx, cz) * wts[k];
          tree += tileTree(cx, cz) * wts[k];
          const c1 = T.color, c2 = T.color2;
          tmp[0] += (c1[0] + (c2[0] - c1[0]) * v) * wts[k];
          tmp[1] += (c1[1] + (c2[1] - c1[1]) * v) * wts[k];
          tmp[2] += (c1[2] + (c2[2] - c1[2]) * v) * wts[k];
          if (t === 'sand') sandish += wts[k];
          if (t === 'snow') snowy += wts[k];
          if (t === 'ash') ashy += wts[k];
        }
        // Multi-frequency organic color variation
        const fine = n(wx * 2.6, wz * 2.6) * 0.055 + n(wx * 5.2, wz * 5.2) * 0.025;
        let r = tmp[0] + fine, g = tmp[1] + fine, b = tmp[2] + fine * 0.65;

        // Forest floor rich moss/humus darkening
        if (tree > 0.08 && snowy < 0.5) {
          const tf = tree * 0.22;
          r *= 1 - tf * 0.7;
          g *= 1 - tf * 0.35;
          b *= 1 - tf * 0.75;
        }

        // Golden sandy beaches & turquoise shallows
        const shore = 1 - Math.min(1, Math.abs(land - 0.54) * 3.0);
        if (shore > 0 && snowy < 0.5 && ashy < 0.5) {
          const f = shore * 0.82 * (1 - sandish * 0.45);
          r += (SAND[0] - r) * f;
          g += (SAND[1] - g) * f;
          b += (SAND[2] - b) * f;
        }
        if (land < 0.54) {
          const shallowF = THREE.MathUtils.smoothstep(land, 0.22, 0.54);
          const deepF = Math.min(1, (0.54 - land) * 2.4);
          const targetR = THREE.MathUtils.lerp(SEABED[0], SHALLOW[0], shallowF);
          const targetG = THREE.MathUtils.lerp(SEABED[1], SHALLOW[1], shallowF);
          const targetB = THREE.MathUtils.lerp(SEABED[2], SHALLOW[2], shallowF);
          r += (targetR - r) * deepF;
          g += (targetG - g) * deepF;
          b += (targetB - b) * deepF;
        }
        // Mountain foothills rocky slate/granite shading
        if (mtn > 0.04) {
          const f = Math.min(1, mtn * 0.48);
          const rockCol = snowy > 0.4 ? [0.66, 0.7, 0.76] : ashy > 0.4 ? [0.28, 0.24, 0.26] : [0.44, 0.41, 0.37];
          r += (rockCol[0] - r) * f;
          g += (rockCol[1] - g) * f;
          b += (rockCol[2] - b) * f;
        }

        const base =
          n.fbm(wx * 0.2 + 40, wz * 0.2 + 40, 3) * 0.145 +
          n(wx * 1.25, wz * 1.25) * 0.038 +
          tree * 0.045;
        const landF = THREE.MathUtils.smoothstep(land, 0.28, 0.72);
        const hgt = THREE.MathUtils.lerp(-0.74, base + mtn * mtn * 0.54, landF);

        const i = vy * VW + vx;
        this.heights[i] = hgt;
        shoreMask[i] = Math.max(0, 1 - Math.abs(land - 0.46) * 4.2);
        pos[i * 3] = wx;
        pos[i * 3 + 1] = hgt;
        pos[i * 3 + 2] = wz;
        // Convert sRGB terrain palette colors into linear space for Three.js vertexColors
        col[i * 3] = Math.pow(Math.max(0, Math.min(1, r)), 2.05);
        col[i * 3 + 1] = Math.pow(Math.max(0, Math.min(1, g)), 2.05);
        col[i * 3 + 2] = Math.pow(Math.max(0, Math.min(1, b)), 2.05);
        uv[i * 2] = wx / 2.2;
        uv[i * 2 + 1] = wz / 2.2;
      }
    }
    const index = [];
    for (let y = 0; y < VH - 1; y++) {
      for (let x = 0; x < VW - 1; x++) {
        const a = y * VW + x, b2 = a + 1, c = a + VW, d = c + 1;
        if ((x + y) & 1) index.push(a, c, b2, b2, c, d);
        else index.push(a, c, d, a, d, b2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();

    const nMap = terrainNormalTexture();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: grainTexture(),
      normalMap: nMap,
      normalScale: new THREE.Vector2(0.48, 0.48),
      roughness: 0.85,
      metalness: 0.02,
    });
    patchFog(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.terrainMesh = mesh;
    this.VW = VW;
    this.shoreMask = shoreMask;

    // Deep seabed outside the map
    const sbMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(SEABED[0] * 0.55, SEABED[1] * 0.55, SEABED[2] * 0.55),
      roughness: 1,
    });
    patchFog(sbMat);
    const sb = new THREE.Mesh(new THREE.PlaneGeometry(w * 6, h * 6), sbMat);
    sb.rotation.x = -Math.PI / 2;
    sb.position.set(w / 2, -0.7, h / 2);
    this.scene.add(sb);
  }

  heightAt(wx, wz) {
    const VW = this.VW, VH = this.heights.length / VW;
    const fx = Math.max(0, Math.min(VW - 1.001, wx * R));
    const fz = Math.max(0, Math.min(VH - 1.001, wz * R));
    const x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
    const H = this.heights;
    const a = H[z0 * VW + x0], b = H[z0 * VW + x0 + 1], c = H[(z0 + 1) * VW + x0], d = H[(z0 + 1) * VW + x0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  tileCenter(x, y) {
    return new THREE.Vector3(x + 0.5, this.heightAt(x + 0.5, y + 0.5), y + 0.5);
  }

  buildWater() {
    const { w, h } = this.state.map;
    const tex = waterNormalTexture();
    tex.repeat.set((w * 3) / 4.2, (h * 3) / 4.2);
    const mat = new THREE.MeshStandardMaterial({
      color: '#18709e',
      transparent: true,
      opacity: 0.82,
      roughness: 0.08,
      metalness: 0.18,
      normalMap: tex,
      normalScale: new THREE.Vector2(0.55, 0.55),
    });
    patchFog(mat);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(w * 3, h * 3), mat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(w / 2, -0.16, h / 2);
    water.receiveShadow = true;
    this.scene.add(water);
    this.water = water;

    // Second slower specular swell layer
    const tex2 = tex.clone();
    tex2.needsUpdate = true;
    tex2.repeat.set((w * 3) / 9.5, (h * 3) / 9.5);
    const mat2 = new THREE.MeshStandardMaterial({
      color: '#38a2d0',
      transparent: true,
      opacity: 0.26,
      roughness: 0.04,
      metalness: 0.25,
      normalMap: tex2,
      normalScale: new THREE.Vector2(0.4, 0.4),
      depthWrite: false,
    });
    patchFog(mat2);
    const water2 = new THREE.Mesh(new THREE.PlaneGeometry(w * 3, h * 3), mat2);
    water2.rotation.x = -Math.PI / 2;
    water2.position.set(w / 2, -0.148, h / 2);
    this.scene.add(water2);
    this.water2 = water2;

    // Animated coastal shoreline foam mesh along water-land boundaries
    const VW = this.VW, VH = this.heights.length / VW;
    const fPos = [], fUv = [], fIdx = [];
    const vMap = new Int32Array(VW * VH).fill(-1);
    const ensureV = (vx, vy) => {
      const idx = vy * VW + vx;
      if (vMap[idx] >= 0) return vMap[idx];
      const k = fPos.length / 3;
      vMap[idx] = k;
      fPos.push(vx / R, -0.142, vy / R);
      fUv.push(vx / R, this.shoreMask[idx]);
      return k;
    };
    for (let y = 0; y < VH - 1; y++) {
      for (let x = 0; x < VW - 1; x++) {
        const i0 = y * VW + x, i1 = i0 + 1, i2 = i0 + VW, i3 = i2 + 1;
        if (this.shoreMask[i0] + this.shoreMask[i1] + this.shoreMask[i2] + this.shoreMask[i3] < 0.05) continue;
        const a = ensureV(x, y), b = ensureV(x + 1, y), c = ensureV(x, y + 1), d = ensureV(x + 1, y + 1);
        fIdx.push(a, c, b, b, c, d);
      }
    }
    if (fIdx.length > 0) {
      const fGeo = new THREE.BufferGeometry();
      fGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
      fGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fUv, 2));
      fGeo.setIndex(fIdx);
      fGeo.computeVertexNormals();
      const fMat = new THREE.MeshBasicMaterial({
        color: '#eefaff',
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      });
      fMat.onBeforeCompile = (sh) => {
        sh.uniforms.uWindTime = fogUniforms.uWindTime;
        sh.vertexShader = sh.vertexShader.replace(
          '#include <common>',
          `#include <common>\nvarying vec2 vShoreUv;`,
        ).replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>\nvShoreUv = uv;`,
        );
        sh.fragmentShader = sh.fragmentShader.replace(
          '#include <common>',
          `#include <common>\nvarying vec2 vShoreUv;`,
        ).replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          float sMask = vShoreUv.y;
          float wave1 = 0.5 + 0.5 * sin(sMask * 14.0 - uWindTime * 2.8 + sin(vShoreUv.x * 5.0 + uWindTime));
          float wave2 = 0.5 + 0.5 * cos(vShoreUv.x * 9.0 - uWindTime * 1.9);
          float foamA = smoothstep(0.15, 0.85, sMask) * (0.45 * wave1 + 0.35 * wave2);
          gl_FragColor.a *= foamA;`,
        );
      };
      patchFog(fMat);
      const foamMesh = new THREE.Mesh(fGeo, fMat);
      foamMesh.renderOrder = 1;
      this.scene.add(foamMesh);
    }
  }

  buildRoads() {
    const M = this.state.map, { w, h } = M;
    const pos = [], uvs = [], idxs = [];
    const isRoad = (x, y) => x >= 0 && y >= 0 && x < w && y < h && M.road[y * w + x];
    const W2 = 0.22;
    const pushStrip = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az);
      const segs = Math.max(3, Math.ceil(len / 0.16));
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      const nx = -dz * W2, nz = dx * W2;
      const base = pos.length / 3;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
        for (const side of [-1, 1]) {
          const qx = px + nx * side, qz = pz + nz * side;
          pos.push(qx, this.heightAt(qx, qz) + 0.032, qz);
          uvs.push(t * len * 2.1, side < 0 ? 0 : 1);
        }
      }
      for (let s = 0; s < segs; s++) {
        const a = base + s * 2;
        idxs.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!isRoad(x, y)) continue;
        const cx = x + 0.5, cz = y + 0.5;
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          if (isRoad(x + dx, y + dy)) pushStrip(cx, cz, cx + dx, cz + dy);
        }
        for (const [dx, dy] of [[1, 1], [-1, 1]]) {
          if (isRoad(x + dx, y + dy) && !isRoad(x + dx, y) && !isRoad(x, y + dy)) {
            pushStrip(cx, cz, cx + dx, cz + dy);
          }
        }
        // Joint disc
        const base = pos.length / 3;
        pos.push(cx, this.heightAt(cx, cz) + 0.031, cz);
        uvs.push(0.5, 0.5);
        const K = 12;
        for (let k = 0; k <= K; k++) {
          const a = (k / K) * Math.PI * 2;
          const px = cx + Math.cos(a) * W2 * 0.94, pz = cz + Math.sin(a) * W2 * 0.94;
          pos.push(px, this.heightAt(px, pz) + 0.031, pz);
          uvs.push(0.5 + Math.cos(a) * 0.3, 0.5 + Math.sin(a) * 0.4);
        }
        for (let k = 0; k < K; k++) idxs.push(base, base + 1 + k + 1, base + 1 + k);
      }
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idxs);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: roadTexture(),
      transparent: true,
      depthWrite: false,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    });
    patchFog(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    this.scene.add(mesh);
  }

  buildDecorations() {
    const M = this.state.map, { w, h } = M;
    const seed = this.state.seed;
    const groups = {};
    const add = (kind, x, z, s, sy, rot) => {
      (groups[kind] = groups[kind] || []).push([x, z, s, sy, rot]);
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const t = M.terrain[i];
        const T = TERRAINS[t];
        const r = (k) => hash2(x * 7 + k, y * 13 + k * 3, seed);
        if (M.obstacle[i] === 'tree') {
          const kinds = T.obstacles.length ? T.obstacles : ['pine'];
          const cnt = 3 + Math.floor(r(1) * 2.6);
          for (let k = 0; k < cnt; k++) {
            const px = x + 0.14 + r(10 + k) * 0.72, pz = y + 0.14 + r(20 + k) * 0.72;
            add(
              kinds[Math.floor(r(30 + k) * kinds.length)],
              px,
              pz,
              0.68 + r(40 + k) * 0.5,
              0.84 + r(45 + k) * 0.38,
              r(50 + k) * 6.28,
            );
          }
          // Forest undergrowth bush/fern
          if (r(55) < 0.65 && T.decor.length) {
            add(T.decor[0], x + 0.25 + r(56) * 0.5, y + 0.25 + r(57) * 0.5, 0.55 + r(58) * 0.3, 1, r(59) * 6.28);
          }
        } else if (M.obstacle[i] === 'mountain') {
          const kind = T.mountains || 'mountain';
          add(
            kind,
            x + 0.5 + (r(1) - 0.5) * 0.28,
            y + 0.5 + (r(2) - 0.5) * 0.28,
            1.1 + r(3) * 0.48,
            0.85 + r(4) * 0.65,
            r(5) * 6.28,
          );
          // Secondary peak or foothill crags
          const rockKind = T.mountains === 'snowMountain' ? 'iceRock' : t === 'ash' ? 'darkRock' : 'rock';
          if (r(6) < 0.65) {
            add(rockKind, x + 0.18 + r(7) * 0.64, y + 0.18 + r(8) * 0.64, 0.52 + r(9) * 0.42, 0.68, r(11) * 6.28);
          }
          if (r(12) < 0.4) {
            add(rockKind, x + 0.2 + r(13) * 0.6, y + 0.2 + r(14) * 0.6, 0.4 + r(15) * 0.35, 0.6, r(16) * 6.28);
          }
        } else if (t !== 'water' && !M.road[i] && !this.state.objAt[i] && r(60) < 0.46 && T.decor.length) {
          const cnt = 1 + (r(61) < 0.42 ? 1 : 0);
          for (let k = 0; k < cnt; k++) {
            const kind = T.decor[Math.floor(r(70 + k) * T.decor.length)];
            const big = kind === 'snowPine' || kind === 'cactus' || kind === 'bush';
            add(
              kind,
              x + 0.14 + r(80 + k) * 0.72,
              y + 0.14 + r(90 + k) * 0.72,
              (big ? 0.58 : 0.65) + r(100 + k) * 0.38,
              1,
              r(110 + k) * 6.28,
            );
          }
        } else if (t === 'water' && r(120) < 0.065) {
          let nearLand = false;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (this.tileTerrain(x + dx, y + dy) !== 'water') nearLand = true;
          }
          if (nearLand) add('rock', x + 0.5, y + 0.5, 0.52, 0.62, r(121) * 6.28);
        }
      }
    }
    const mat = getDecorationMaterial();
    patchFog(mat, { sway: true });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    for (const [kind, list] of Object.entries(groups)) {
      let geo;
      try { geo = getDecorationGeometry(kind); } catch { geo = null; }
      if (!geo) continue;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, z, s, sy, rot], k) => {
        e.set(0, rot, 0);
        q.setFromEuler(e);
        sc.set(s, s * sy, s);
        p.set(x, this.heightAt(x, z) - 0.02, z);
        m4.compose(p, q, sc);
        im.setMatrixAt(k, m4);
      });
      im.castShadow = true;
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      this.scene.add(im);
    }
  }

  buildAtmosphereParticles() {
    const { w, h } = this.state.map;
    const count = 320;
    const pos = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * w;
      pos[i * 3 + 1] = 0.25 + Math.random() * 2.4;
      pos[i * 3 + 2] = Math.random() * h;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      map: glowTexture('#ffe898'),
      color: '#ffe898',
      size: 0.16,
      transparent: true,
      opacity: 0.40,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.renderOrder = 4;
    this.scene.add(pts);
    this.motes = { pts, pos, phases, count };
  }

  // ===================================================================== objects & heroes
  playerColor(pid) { return pid == null ? null : this.state.players[pid]?.colorHex || null; }

  buildAllObjects() {
    for (const o of Object.values(this.state.objects)) this.addObject(o);
    for (const h of Object.values(this.state.heroes)) if (h.alive) this.addHero(h);
  }
  addObject(o) {
    let g;
    try {
      if (o.type === 'town') {
        g = createTownMapModel(o.faction);
        g.position.set(o.x + 0.5, this.heightAt(o.x + 0.5, o.y + 0.5), o.y + 0.5);
      } else if (o.type === 'monster') {
        g = new THREE.Group();
        const m = createCreatureModel(o.creature, { static: true });
        const tier = CREATURES[o.creature].tier;
        const s = tier <= 2 ? 0.72 : tier <= 4 ? 0.64 : tier <= 6 ? 0.56 : 0.46;
        m.scale.setScalar(s);
        const r = hash2(o.x, o.y, 3);
        m.rotation.y = r < 0.5 ? -0.9 - r * 0.5 : Math.PI + 0.9 + (r - 0.5) * 0.5;
        g.add(m);
        g.userData.animator = m.userData.animator;
        g.position.copy(this.tileCenter(o.x, o.y));
      } else {
        g = createMapObjectModel(o);
        g.position.copy(this.tileCenter(o.x, o.y));
      }
    } catch (err) {
      console.warn('model error', o.type, err);
      g = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: '#f0f' }));
      g.position.copy(this.tileCenter(o.x, o.y));
    }
    g.userData.objId = o.id;
    patchObjectFog(g);
    g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
    this.scene.add(g);
    this.objModels.set(o.id, g);
    this.setObjectOwner(o.id);
    if (o.type === 'crypt' && o.looted) {
      g.traverse((c) => {
        if (c.material?.emissive) {
          c.material = c.material.clone();
          c.material.emissiveIntensity = 0;
        }
      });
    }
  }
  setObjectOwner(id) {
    const o = this.state.objects[id];
    const g = this.objModels.get(id);
    if (!o || !g) return;
    g.userData.setOwnerColor?.(this.playerColor(o.owner));
  }
  removeObject(id) {
    const g = this.objModels.get(id);
    if (!g) return;
    this.objModels.delete(id);
    const s0 = g.scale.clone();
    tween(0.35, (t) => { g.scale.copy(s0).multiplyScalar(1 - t * 0.9); g.position.y += 0.01; }, ease.in)
      .then(() => this.scene.remove(g));
  }
  refreshObject(id) {
    const o = this.state.objects[id];
    if (!o) { this.removeObject(id); return; }
  }
  addHero(h) {
    if (this.heroModels.has(h.id)) return;
    let g;
    try {
      g = createHeroModel({ faction: h.faction, heroClass: h.cls, color: this.playerColor(h.owner) || '#ccc' });
    } catch (err) {
      console.warn('hero model error', err);
      g = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1, 8), new THREE.MeshStandardMaterial({ color: this.playerColor(h.owner) }));
    }
    const wrap = new THREE.Group();
    wrap.add(g);
    wrap.userData.animator = g.userData.animator;
    wrap.userData.heroId = h.id;
    g.rotation.y = h.facing === -1 ? Math.PI : 0;
    patchObjectFog(wrap);
    wrap.position.copy(this.tileCenter(h.x, h.y));
    this.scene.add(wrap);
    this.heroModels.set(h.id, wrap);
  }
  removeHero(id) {
    const g = this.heroModels.get(id);
    if (!g) return;
    this.heroModels.delete(id);
    this.scene.remove(g);
    if (this.selectedHeroId === id) this.selectHero(null);
  }
  snapHero(hero) {
    const g = this.heroModels.get(hero.id);
    if (!g) { if (hero.alive) this.addHero(hero); return; }
    g.position.copy(this.tileCenter(hero.x, hero.y));
    this.updateVisibility();
  }
  faceHero(hero) {
    const g = this.heroModels.get(hero.id);
    if (g) g.children[0].rotation.y = hero.facing === -1 ? Math.PI : 0;
  }
  refreshAll() {
    for (const [id] of this.objModels) if (!this.state.objects[id]) this.removeObject(id);
    for (const o of Object.values(this.state.objects)) {
      if (!this.objModels.has(o.id)) this.addObject(o);
      else this.setObjectOwner(o.id);
    }
    for (const [id] of this.heroModels) { const h = this.state.heroes[id]; if (!h || !h.alive) this.removeHero(id); }
    for (const h of Object.values(this.state.heroes)) {
      if (!h.alive) continue;
      if (!this.heroModels.has(h.id)) this.addHero(h);
      else this.snapHero(h);
    }
    this.updateFog();
  }

  // ===================================================================== helpers: selection ring, path, hover
  buildHelpers() {
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.9, depthWrite: false });
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(0.37, 0.46, 48), ringMat);
    this.selRing.rotation.x = -Math.PI / 2;
    this.selRing.visible = false;
    this.selRing.renderOrder = 2;
    this.scene.add(this.selRing);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture('#ffe9a0'),
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.scale.set(1.4, 1.4, 1);
    this.selGlow = glow;
    this.scene.add(glow);
    glow.visible = false;

    this.heroLight = new THREE.PointLight('#ffd87a', 1.1, 3.6);
    this.heroLight.visible = false;
    this.scene.add(this.heroLight);

    const hoverMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.14, depthWrite: false });
    this.hover = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), hoverMat);
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.visible = false;
    this.hover.renderOrder = 2;
    this.scene.add(this.hover);

    // Arrow geometry for path
    const shape = new THREE.Shape();
    shape.moveTo(0.2, 0); shape.lineTo(-0.02, 0.15); shape.lineTo(-0.02, 0.06); shape.lineTo(-0.18, 0.06);
    shape.lineTo(-0.18, -0.06); shape.lineTo(-0.02, -0.06); shape.lineTo(-0.02, -0.15); shape.closePath();
    this.arrowGeo = new THREE.ShapeGeometry(shape);
    this.arrowGeo.rotateX(-Math.PI / 2);

    const cross = new THREE.Shape();
    const c = 0.05, L = 0.2;
    cross.moveTo(-L, -L + c); cross.lineTo(-L + c, -L); cross.lineTo(0, -c); cross.lineTo(L - c, -L); cross.lineTo(L, -L + c);
    cross.lineTo(c, 0); cross.lineTo(L, L - c); cross.lineTo(L - c, L); cross.lineTo(0, c); cross.lineTo(-L + c, L); cross.lineTo(-L, L - c); cross.lineTo(-c, 0); cross.closePath();
    this.crossGeo = new THREE.ShapeGeometry(cross);
    this.crossGeo.rotateX(-Math.PI / 2);

    this.pathMats = {
      ok: new THREE.MeshBasicMaterial({ color: '#46e05a', transparent: true, opacity: 0.95, depthWrite: false }),
      later: new THREE.MeshBasicMaterial({ color: '#e8503a', transparent: true, opacity: 0.9, depthWrite: false }),
      okEnd: new THREE.MeshBasicMaterial({ color: '#7dff7a', transparent: true, depthWrite: false }),
      laterEnd: new THREE.MeshBasicMaterial({ color: '#ff6a4a', transparent: true, depthWrite: false }),
      shadow: new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false }),
    };
  }
  selectHero(id) {
    this.selectedHeroId = id;
    const h = id && this.state.heroes[id];
    this.selRing.visible = !!h;
    this.selGlow.visible = !!h;
    this.heroLight.visible = !!h;
    if (h) {
      this.selRing.material.color.set(this.playerColor(h.owner) || '#ffd76a').lerp(new THREE.Color('#ffffff'), 0.25);
    }
  }
  clearPath() {
    for (const m of this.pathMarkers) this.scene.remove(m);
    this.pathMarkers = [];
  }
  showPath(plan, hero) {
    this.clearPath();
    if (!plan) return;
    const pts = plan.steps.map((s) => ({ x: s.x, y: s.y, turn: s.turn }));
    if (plan.interact && !(plan.interact.kind === 'town' && pts.length && pts[pts.length - 1].x === plan.interact.x && pts[pts.length - 1].y === plan.interact.y)) {
      pts.push({ x: plan.interact.x, y: plan.interact.y, turn: plan.interact.turn, interact: true });
    }
    let prev = { x: hero.x, y: hero.y };
    pts.forEach((p, k) => {
      const next = pts[k + 1];
      const last = !next;
      const ok = p.turn === 0;
      let mesh;
      if (last) {
        mesh = new THREE.Mesh(this.crossGeo, ok ? this.pathMats.okEnd : this.pathMats.laterEnd);
        mesh.rotation.y = 0;
      } else {
        mesh = new THREE.Mesh(this.arrowGeo, ok ? this.pathMats.ok : this.pathMats.later);
        const dx = next.x - p.x, dz = next.y - p.y;
        mesh.rotation.y = Math.atan2(-dz, dx);
      }
      const c = this.tileCenter(p.x, p.y);
      if (p.interact) {
        c.x = (c.x + prev.x + 0.5) / 2 + (p.x + 0.5 - (prev.x + 0.5)) * 0.25;
        c.z = (c.z + prev.y + 0.5) / 2 + (p.y + 0.5 - (prev.y + 0.5)) * 0.25;
      }
      mesh.position.set(c.x, Math.max(c.y, -0.1) + 0.07, c.z);
      mesh.renderOrder = 3;
      const sh = new THREE.Mesh(mesh.geometry, this.pathMats.shadow);
      sh.position.set(0.03, -0.02, 0.03);
      mesh.add(sh);
      mesh.userData.step = p;
      this.scene.add(mesh);
      this.pathMarkers.push(mesh);
      prev = p;
    });
  }
  consumePathMarker(x, y) {
    const i = this.pathMarkers.findIndex((m) => m.userData.step.x === x && m.userData.step.y === y);
    if (i >= 0) { this.scene.remove(this.pathMarkers[i]); this.pathMarkers.splice(i, 1); }
  }
  setHover(tile) {
    if (!tile) { this.hover.visible = false; return; }
    const c = this.tileCenter(tile.x, tile.y);
    this.hover.position.set(c.x, Math.max(c.y, -0.12) + 0.05, c.z);
    this.hover.visible = true;
  }

  // ===================================================================== movement animation
  onHeroMoveStart(hero) {
    const g = this.heroModels.get(hero.id);
    g?.userData.animator?.play('walk');
    if (hero.owner === this.humanId) this.follow = hero.id;
  }
  onHeroMoveEnd(hero) {
    const g = this.heroModels.get(hero.id);
    g?.userData.animator?.play('idle');
    this.follow = null;
  }
  animateHeroStep(hero, from, to, { fast = false } = {}) {
    let g = this.heroModels.get(hero.id);
    if (!g) { this.addHero(hero); g = this.heroModels.get(hero.id); }
    const a = this.tileCenter(from.x, from.y), b = this.tileCenter(to.x, to.y);
    const diag = from.x !== to.x && from.y !== to.y;
    const dur = (fast ? 0.085 : 0.2) * (diag ? 1.25 : 1);
    const model = g.children[0];
    const targetRot = Math.atan2(-(to.y - from.y), to.x - from.x);
    const startRot = model.rotation.y;
    let dRot = targetRot - startRot;
    while (dRot > Math.PI) dRot -= Math.PI * 2;
    while (dRot < -Math.PI) dRot += Math.PI * 2;
    if (hero.owner !== this.humanId && fast) {
      this.camTarget.lerp(b, 0.25);
    }
    this.consumePathMarker(to.x, to.y);
    this.handlers.onStep?.(hero);
    this.updateVisibility();
    return tween(dur, (t) => {
      g.position.lerpVectors(a, b, t);
      model.rotation.y = startRot + dRot * Math.min(1, t * 2.5);
    });
  }

  // ===================================================================== fog
  updateFog() {
    const { w, h } = this.state.map;
    const p = this.state.players[this.humanId];
    const sm = this.fogSmall.getContext('2d');
    const img = sm.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = p.explored[i] ? 255 : 0;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    sm.putImageData(img, 0, 0);
    const g = this.fogCanvas.getContext('2d');
    g.save();
    g.fillStyle = '#000';
    g.fillRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
    g.imageSmoothingEnabled = true;
    g.filter = 'blur(5.5px)';
    g.drawImage(this.fogSmall, 0, 0, this.fogCanvas.width, this.fogCanvas.height);
    g.restore();
    this.fogTex.needsUpdate = true;
    this.updateVisibility();
  }
  updateVisibility() {
    const p = this.state.players[this.humanId];
    const w = this.state.map.w;
    for (const [id, g] of this.objModels) {
      const o = this.state.objects[id];
      if (!o) continue;
      g.visible = !!p.explored[o.y * w + o.x];
    }
    for (const [id, g] of this.heroModels) {
      const h = this.state.heroes[id];
      if (!h) continue;
      g.visible = !!p.explored[h.y * w + h.x];
    }
  }

  // ===================================================================== floating text
  floatText(x, y, text, color = '#fff', iconName = null) {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.style.color = color;
    el.innerHTML = (iconName && this.iconFn ? this.iconFn(iconName, 22) : '') + `<span>${text}</span>`;
    this.overlay.appendChild(el);
    this.floaters.push({ el, pos: this.tileCenter(x, y).add(new THREE.Vector3(0, 0.8, 0)), t: 0 });
  }

  // ===================================================================== camera
  centerOn(x, y, instant = false) {
    this.camTarget.set(x + 0.5, 0, y + 0.5);
    if (instant) this.target.copy(this.camTarget);
  }
  pan(dx, dz) {
    const k = this.dist * 0.05;
    this.camTarget.x += dx * k;
    this.camTarget.z += dz * k;
    this.clampTarget();
  }
  zoom(delta) {
    this.distTarget = THREE.MathUtils.clamp(this.distTarget * (delta > 0 ? 1.12 : 0.89), 7, 34);
  }
  clampTarget() {
    const { w, h } = this.state.map;
    this.camTarget.x = THREE.MathUtils.clamp(this.camTarget.x, 0, w);
    this.camTarget.z = THREE.MathUtils.clamp(this.camTarget.z, 0, h);
  }
  updateCamera(instant = false) {
    const k = instant ? 1 : 0.14;
    if (this.follow) {
      const g = this.heroModels.get(this.follow);
      if (g) this.camTarget.set(g.position.x, 0, g.position.z);
    }
    this.clampTarget();
    this.target.lerp(this.camTarget, k);
    this.dist += (this.distTarget - this.dist) * (instant ? 1 : 0.12);
    const cy = Math.sin(CAM_PITCH) * this.dist, cz = Math.cos(CAM_PITCH) * this.dist;
    this.camera.position.set(this.target.x, cy, this.target.z + cz);
    this.camera.lookAt(this.target.x, 0, this.target.z);
    this.scene.fog.near = this.dist * 1.65;
    this.scene.fog.far = this.dist * 4.3;
    this.sun.position.copy(this.target).add(this.sunOffset);
    this.sun.target.position.copy(this.target);
    const sc = this.sun.shadow.camera;
    const ext = Math.max(14, this.dist * 1.25);
    if (Math.abs(sc.right - ext) > 0.5) {
      sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
      sc.updateProjectionMatrix();
    }
  }
  /** Project screen point to ground plane → world {x,z} */
  screenToGround(clientX, clientY) {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, p)) return null;
    return p;
  }
  screenToTile(clientX, clientY) {
    const p = this.screenToGround(clientX, clientY);
    if (!p) return null;
    const x = Math.floor(p.x), y = Math.floor(p.z);
    if (x < 0 || y < 0 || x >= this.state.map.w || y >= this.state.map.h) return null;
    return { x, y };
  }
  getViewQuad() {
    const W = window.innerWidth, H = window.innerHeight;
    return [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => this.screenToGround(x, y)).filter(Boolean);
  }
  worldToScreen(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, behind: p.z > 1 };
  }

  // ===================================================================== frame
  update(dt, time) {
    this.time = time;
    fogUniforms.uWindTime.value = time;
    this.updateCamera();
    if (this.water) {
      this.water.material.normalMap.offset.set(time * 0.014, time * 0.022);
      this.water2.material.normalMap.offset.set(-time * 0.009, time * 0.007);
    }
    if (this.motes) {
      const { pts, pos, phases, count } = this.motes;
      for (let i = 0; i < count; i++) {
        const ph = phases[i];
        pos[i * 3] += Math.sin(time * 0.5 + ph) * dt * 0.12;
        pos[i * 3 + 1] = 0.35 + (Math.sin(time * 0.9 + ph) * 0.5 + 0.5) * 1.9;
        pos[i * 3 + 2] += Math.cos(time * 0.4 + ph) * dt * 0.1;
      }
      pts.geometry.attributes.position.needsUpdate = true;
      pts.material.opacity = 0.42 + Math.sin(time * 1.8) * 0.1;
    }
    for (const g of this.objModels.values()) {
      if (!g.visible) continue;
      g.userData.update?.(dt, time);
      g.userData.animator?.update?.(dt);
    }
    for (const g of this.heroModels.values()) g.userData.animator?.update?.(dt);
    // Selection ring follows hero
    if (this.selectedHeroId) {
      const g = this.heroModels.get(this.selectedHeroId);
      if (g) {
        const y = Math.max(g.position.y, -0.12) + 0.04;
        this.selRing.position.set(g.position.x, y, g.position.z);
        this.selRing.scale.setScalar(1 + Math.sin(time * 4) * 0.06);
        this.selGlow.position.set(g.position.x, y + 0.1, g.position.z);
        this.heroLight.position.set(g.position.x, y + 0.95, g.position.z);
        this.selRing.visible = g.visible;
        this.selGlow.visible = g.visible;
        this.heroLight.visible = g.visible;
      }
    }
    // Path arrows pulse
    const pulse = 0.75 + Math.sin(time * 5) * 0.2;
    this.pathMats.ok.opacity = pulse;
    this.pathMats.later.opacity = pulse * 0.95;
    // Floating texts
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      const s = this.worldToScreen(f.pos.clone().add(new THREE.Vector3(0, f.t * 0.6, 0)));
      f.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
      f.el.style.opacity = String(Math.max(0, 1 - Math.max(0, f.t - 1) / 0.8));
      if (f.t > 1.8) { f.el.remove(); this.floaters.splice(i, 1); }
    }
  }
  onBeforeRender() { fogUniforms.uFogOn.value = 1; }
  onAfterRender() { fogUniforms.uFogOn.value = 0; }
  render(renderer) {
    fogUniforms.uFogOn.value = 1;
    renderer.render(this.scene, this.camera);
    fogUniforms.uFogOn.value = 0;
  }
  onActivate() { this.updateFog(); }
  dispose() {
    for (const f of this.floaters) f.el.remove();
    this.floaters = [];
    this.scene.traverse((o) => { if (o.geometry && !o.isInstancedMesh) o.geometry.dispose?.(); });
  }
}
