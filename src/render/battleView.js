// ============================================================================
//  תצוגת שדה הקרב התלת-ממדי (15x11 משושים) — זירה מפוסלת, לפידים, ביצורים ואפקטים
// ============================================================================
import * as THREE from 'three';
import { COLS, ROWS, key, neighbors, hexDist } from '../battle/battleLogic.js';
import { CREATURES } from '../data/creatures.js';
import { TERRAINS } from '../data/terrain.js';
import { SPELLS, EFFECT_NAMES } from '../data/spells.js';
import { createCreatureModel, createHeroModel } from './creatureModels.js';
import {
  getDecorationGeometry,
  getDecorationMaterial,
  makeBanner,
  updateStructureTime,
} from './structureModels.js';
import {
  grainTexture,
  terrainNormalTexture,
  stoneWallTexture,
  stoneBumpTexture,
  glowTexture,
  contactShadowTexture,
} from './textures.js';
import { tween, ease, wait } from './engine.js';
import { audio } from '../audio/audio.js';

const HEX_R = 0.92;
const HEX_W = Math.sqrt(3) * HEX_R; // ~1.593
const HEX_H = 1.5 * HEX_R;          // ~1.38

export function hexToWorld(col, row) {
  const x = (col - (COLS - 1) / 2 + (row & 1 ? 0.5 : 0)) * HEX_W;
  const z = (row - (ROWS - 1) / 2) * HEX_H;
  return new THREE.Vector3(x, 0, z);
}

const ARENA_SKIES = {
  grass: ['#25599e', '#6da7dc', '#c9dff0'],
  dirt:  ['#375d8f', '#89a7c4', '#d8cdb8'],
  sand:  ['#2b6ba8', '#89b4cf', '#ecd09b'],
  snow:  ['#355b8a', '#8aaec9', '#d5e4f0'],
  swamp: ['#1b3332', '#395a50', '#70846f'],
  rough: ['#3d4a66', '#838391', '#c9b89c'],
  ash:   ['#0b0714', '#271333', '#522238'],
};

export class BattleView {
  constructor(battle, setup, overlay, callbacks) {
    this.battle = battle;
    this.setup = setup;
    this.overlay = overlay;
    this.cb = callbacks || {};
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.5, 250);
    this.cameraBase = new THREE.Vector3(0, 19.2, 20.6);
    this.cameraTarget = new THREE.Vector3(0, -0.6, 0.9);
    this.shakeAmt = 0;

    this.hexMeshes = new Map();     // key -> Mesh (fill)
    this.hexBorders = new Map();    // key -> LineLoop
    this.unitGroups = new Map();    // unit.id -> THREE.Group
    this.unitBadges = new Map();    // unit.id -> HTMLElement
    this.floaters = [];
    this.vfxList = [];
    this.torchFlames = [];
    this.hoveredHex = null;
    this.attackFromHex = null;
    this.spellMode = null;          // spellId when player is targeting a spell
    this.resurrectMode = false;     // archangel resurrect targeting
    this.speedMult = 1;             // 1 normal, 1.9 fast, 3.0 ultra

    this.buildArena();
    this.buildGrid();
    this.buildObstacles();
    this.buildCommanders();
    if (setup.town) this.buildSiegeWalls(setup.town);
    this.buildUnits();
    this.buildAtmosphere();
    this.setupPointer();
    this.updateCamera(0);
    this.refreshHighlights();
  }

  // ===================================================================== scene & arena
  buildArena() {
    const tKey = this.battle.terrain || 'grass';
    const T = TERRAINS[tKey] || TERRAINS.grass;
    const skyCols = ARENA_SKIES[tKey] || ARENA_SKIES.grass;
    this.scene.background = new THREE.Color(skyCols[1]);
    this.scene.fog = new THREE.Fog(skyCols[2], 32, 82);

    // Painted 3D horizon sky dome
    const skyGeo = new THREE.SphereGeometry(76, 28, 16);
    const skyPos = skyGeo.attributes.position;
    const skyVertCols = new Float32Array(skyPos.count * 3);
    const cTop = new THREE.Color(skyCols[0]);
    const cMid = new THREE.Color(skyCols[1]);
    const cHor = new THREE.Color(skyCols[2]);
    const cTmp = new THREE.Color();
    for (let i = 0; i < skyPos.count; i++) {
      const y = Math.max(0, Math.min(1, (skyPos.getY(i) + 6) / 62));
      if (y < 0.35) cTmp.lerpColors(cHor, cMid, y / 0.35);
      else cTmp.lerpColors(cMid, cTop, (y - 0.35) / 0.65);
      skyVertCols[i * 3] = cTmp.r;
      skyVertCols[i * 3 + 1] = cTmp.g;
      skyVertCols[i * 3 + 2] = cTmp.b;
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(skyVertCols, 3));
    const skyDome = new THREE.Mesh(
      skyGeo,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    skyDome.renderOrder = -10;
    this.scene.add(skyDome);

    const hemi = new THREE.HemisphereLight('#e6f2ff', '#4c3d28', 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff2d6', 1.95);
    sun.position.set(-15, 27, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -19; sc.right = 19; sc.top = 15; sc.bottom = -15; sc.near = 1; sc.far = 68;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.018;
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight('#84b4ff', 0.45);
    rim.position.set(16, 16, -15);
    this.scene.add(rim);

    // Dynamic VFX impact point light
    this.vfxLight = new THREE.PointLight('#ffaa44', 0, 10);
    this.scene.add(this.vfxLight);

    // High-subdivision sculpted ground plane with vertex colors + normal map
    const gw = 68, gh = 52, segX = 112, segZ = 84;
    const geo = new THREE.PlaneGeometry(gw, gh, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const uvs = geo.attributes.uv;
    const cols = new Float32Array(pos.count * 3);
    const c1 = T.color, c2 = T.color2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      uvs.setXY(i, x * 0.45, z * 0.45);
      const inArena = Math.abs(x) < 13.6 && Math.abs(z) < 8.5;
      const n =
        Math.sin(x * 0.42 + Math.cos(z * 0.35)) * Math.cos(z * 0.44 - Math.sin(x * 0.3)) * 0.5 + 0.5;
      if (!inArena) {
        const edgeX = Math.max(0, Math.abs(x) - 13.6);
        const edgeZ = Math.max(0, Math.abs(z) - 8.5);
        const edge = Math.min(1.5, Math.hypot(edgeX, edgeZ * 1.1) / 5.2);
        // Keep front camera view clear (z > 8.2 stays low)
        const frontSuppress = z > 7.5 ? Math.max(0.15, 1 - (z - 7.5) / 4.5) : 1;
        const hgt =
          (edge * edge * 1.65 +
            Math.sin(x * 0.65 + z * 0.5) * 0.32 * edge +
            Math.cos(x * 1.3 - z * 1.1) * 0.14 * edge) *
          frontSuppress;
        pos.setY(i, hgt);
      } else {
        // Subtle micro-undulation inside the arena
        pos.setY(i, Math.sin(x * 0.8) * Math.cos(z * 0.9) * 0.015);
      }
      // Subtle worn battle-arena center pathing + rich border shading
      const arenaCenter = Math.max(0, 1 - Math.hypot(x / 11.5, z / 7.2));
      const wear = inArena ? arenaCenter * 0.14 : 0;
      const shade = inArena ? 1.02 : 0.84;
      let r = (c1[0] + (c2[0] - c1[0]) * n) * shade;
      let g = (c1[1] + (c2[1] - c1[1]) * n) * shade;
      let b = (c1[2] + (c2[2] - c1[2]) * n) * shade;
      if (wear > 0 && tKey !== 'snow') {
        r = THREE.MathUtils.lerp(r, 0.56, wear);
        g = THREE.MathUtils.lerp(g, 0.48, wear);
        b = THREE.MathUtils.lerp(b, 0.34, wear);
      }
      cols[i * 3] = Math.pow(Math.max(0, Math.min(1, r)), 2.05);
      cols[i * 3 + 1] = Math.pow(Math.max(0, Math.min(1, g)), 2.05);
      cols[i * 3 + 2] = Math.pow(Math.max(0, Math.min(1, b)), 2.05);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: grainTexture(),
        normalMap: terrainNormalTexture(),
        normalScale: new THREE.Vector2(0.48, 0.48),
        roughness: 0.84,
        metalness: 0.03,
      }),
    );
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;

    // Lush Perimeter Scenery (dense trees, crags, outer mountain peaks & wildflower tufts)
    const decMat = getDecorationMaterial();
    const propKinds = T.obstacles.length ? T.obstacles : ['rock'];
    const decorKinds = T.decor?.length ? T.decor : ['bush'];
    const mtnKind = T.mountains || 'mountain';
    const placeDec = (kind, x, z, s, rot, yOff = 0) => {
      try {
        const g = getDecorationGeometry(kind);
        const m = new THREE.Mesh(g, decMat);
        m.position.set(x, yOff, z);
        m.scale.setScalar(s);
        m.rotation.y = rot;
        m.castShadow = true;
        m.receiveShadow = true;
        this.scene.add(m);
      } catch {}
    };
    for (let i = 0; i < 54; i++) {
      const a = (i / 54) * Math.PI * 2;
      const rx = 15.2 + (i % 4) * 1.45;
      const rz = 9.8 + (i % 3) * 1.35;
      const x = Math.cos(a) * rx, z = Math.sin(a) * rz;
      if (z > 8.4) continue; // keep front camera view clear
      if (i % 3 === 0) {
        placeDec(mtnKind, x * 1.18, z * 1.16 - 1.2, 1.85 + (i % 3) * 0.45, i * 1.1);
      } else {
        placeDec(propKinds[i % propKinds.length], x, z, 1.05 + (i % 3) * 0.34, i * 1.7);
      }
      if (i % 2 === 0) {
        placeDec(
          decorKinds[i % decorKinds.length],
          x * 0.89,
          z * 0.89,
          0.8 + (i % 3) * 0.24,
          i * 2.3,
        );
      }
    }

    // 4 Corner Burning War Braziers
    const brazierCoords = [
      [-12.6, -7.6],
      [12.6, -7.6],
      [-12.6, 6.8],
      [12.6, 6.8],
    ];
    const ironMat = new THREE.MeshStandardMaterial({
      color: '#3a3d42',
      roughness: 0.42,
      metalness: 0.72,
      bumpMap: stoneBumpTexture(),
      bumpScale: 0.015,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneWallTexture(),
      bumpMap: stoneBumpTexture(),
      bumpScale: 0.02,
      roughness: 0.85,
    });
    const fireColor = tKey === 'ash' ? '#55ff90' : '#ff8428';
    brazierCoords.forEach(([bx, bz], idx) => {
      const bg = new THREE.Group();
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.55, 8), stoneMat);
      plinth.position.y = 0.275;
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.85, 8), ironMat);
      column.position.y = 0.95;
      column.castShadow = true;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.22, 0.32, 10), ironMat);
      bowl.position.y = 1.48;
      bowl.castShadow = true;
      bg.add(plinth, column, bowl);

      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.26, 0.65, 7),
        new THREE.MeshBasicMaterial({ color: fireColor }),
      );
      flame.position.y = 1.85;
      bg.add(flame);

      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture(fireColor),
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      spr.position.y = 1.9;
      spr.scale.setScalar(1.9);
      bg.add(spr);

      if (idx < 2) {
        const ptLight = new THREE.PointLight(fireColor, 1.35, 9.5);
        ptLight.position.y = 2.2;
        bg.add(ptLight);
      }

      bg.position.set(bx, 0, bz);
      this.scene.add(bg);
      this.torchFlames.push({ flame, spr, phase: idx * 1.7 });
    });
  }

  buildAtmosphere() {
    const tKey = this.battle.terrain || 'grass';
    const count = 180;
    const pos = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = 0.2 + Math.random() * 5.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const col = tKey === 'ash' ? '#ff6830' : tKey === 'snow' ? '#e8f4ff' : '#ffe89a';
    const mat = new THREE.PointsMaterial({
      map: glowTexture(col),
      color: col,
      size: tKey === 'snow' ? 0.24 : 0.22,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.atmoParticles = { pts, pos, phases, count, tKey };
  }

  buildGrid() {
    const hexShape = new THREE.BufferGeometry();
    const verts = [0, 0, 0];
    const ringPts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      const x = Math.cos(a) * (HEX_R * 0.95), z = Math.sin(a) * (HEX_R * 0.95);
      verts.push(x, 0, z);
      ringPts.push(new THREE.Vector3(x, 0.018, z));
    }
    const idx = [];
    for (let i = 1; i <= 6; i++) idx.push(0, i === 6 ? 1 : i + 1, i);
    hexShape.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    hexShape.setIndex(idx);
    hexShape.computeVertexNormals();

    const lineGeo = new THREE.BufferGeometry().setFromPoints([...ringPts, ringPts[0]]);
    this.gridGroup = new THREE.Group();
    this.scene.add(this.gridGroup);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const k = key(c, r);
        const p = hexToWorld(c, r);
        const fillMat = new THREE.MeshBasicMaterial({
          color: '#000000',
          transparent: true,
          opacity: 0.06,
          depthWrite: false,
        });
        const fill = new THREE.Mesh(hexShape, fillMat);
        fill.position.set(p.x, 0.022, p.z);
        fill.userData.hex = { x: c, y: r };
        this.gridGroup.add(fill);
        this.hexMeshes.set(k, fill);

        const borderMat = new THREE.LineBasicMaterial({
          color: '#d8c488',
          transparent: true,
          opacity: 0.24,
        });
        const border = new THREE.Line(lineGeo, borderMat);
        border.position.set(p.x, 0.027, p.z);
        this.gridGroup.add(border);
        this.hexBorders.set(k, border);
      }
    }

    // Active unit golden halo ring on the ground
    const actGeo = new THREE.RingGeometry(HEX_R * 0.68, HEX_R * 0.92, 6);
    actGeo.rotateX(-Math.PI / 2);
    actGeo.rotateY(Math.PI / 6);
    this.activeUnitRing = new THREE.Mesh(
      actGeo,
      new THREE.MeshBasicMaterial({
        color: '#ffe066',
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    this.activeUnitRing.position.y = 0.036;
    this.activeUnitRing.visible = false;
    this.scene.add(this.activeUnitRing);

    // Approach direction indicator (sword/arrow on hex)
    const indGeo = new THREE.RingGeometry(HEX_R * 0.55, HEX_R * 0.78, 6);
    indGeo.rotateX(-Math.PI / 2);
    indGeo.rotateY(Math.PI / 6);
    this.approachRing = new THREE.Mesh(
      indGeo,
      new THREE.MeshBasicMaterial({
        color: '#ff4433',
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    this.approachRing.position.y = 0.045;
    this.approachRing.visible = false;
    this.scene.add(this.approachRing);

    // 3D movement / flight path preview markers
    this.pathPreviewGroup = new THREE.Group();
    this.scene.add(this.pathPreviewGroup);
  }

  updatePathPreview(active, destHex, isAttack = false) {
    if (!this.pathPreviewGroup) return;
    while (this.pathPreviewGroup.children.length) {
      const ch = this.pathPreviewGroup.children[0];
      this.pathPreviewGroup.remove(ch);
      ch.geometry?.dispose?.();
      ch.material?.dispose?.();
    }
    if (!active || !destHex || (destHex.x === active.x && destHex.y === active.y)) return;
    const isFly = this.battle.isFlyer(active);
    const col = isAttack ? '#ff7a52' : '#7ef5a2';
    const dotMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.88, depthWrite: false });
    if (isFly) {
      const a = hexToWorld(active.x, active.y), b = hexToWorld(destHex.x, destHex.y);
      const steps = Math.max(5, Math.ceil(a.distanceTo(b) * 1.4));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const p = new THREE.Vector3().lerpVectors(a, b, t);
        p.y = 0.08 + Math.sin(t * Math.PI) * 0.9;
        const m = new THREE.Mesh(new THREE.SphereGeometry(i === steps ? 0.11 : 0.075, 8, 6), dotMat);
        m.position.copy(p);
        this.pathPreviewGroup.add(m);
      }
    } else {
      const path = this.battle.pathTo(active, destHex.x, destHex.y);
      if (!path?.length) return;
      const pts = [hexToWorld(active.x, active.y), ...path.map((h) => hexToWorld(h.x, h.y))];
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 10), dotMat);
        m.position.set(p.x, 0.05, p.z);
        this.pathPreviewGroup.add(m);
      }
      const linePts = pts.map((p) => new THREE.Vector3(p.x, 0.055, p.z));
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(linePts),
        new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.78 }),
      );
      this.pathPreviewGroup.add(line);
    }
  }

  buildObstacles() {
    const decMat = getDecorationMaterial();
    const tKey = this.battle.terrain || 'grass';
    const kind = tKey === 'ash' ? 'darkRock' : tKey === 'snow' ? 'iceRock' : 'rock';
    for (const k of this.battle.obstacles) {
      const c = k % COLS, r = Math.floor(k / COLS);
      const p = hexToWorld(c, r);
      const g = new THREE.Group();
      try {
        const rock = new THREE.Mesh(getDecorationGeometry(kind), decMat);
        rock.scale.set(1.38, 1.28, 1.38);
        rock.rotation.y = (k * 1.7) % 6.28;
        rock.castShadow = true;
        rock.receiveShadow = true;
        g.add(rock);
      } catch {
        const fallback = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.55),
          new THREE.MeshStandardMaterial({ color: '#6b655e', flatShading: true }),
        );
        fallback.position.y = 0.3;
        fallback.castShadow = true;
        g.add(fallback);
      }
      g.position.copy(p);
      this.scene.add(g);
    }
  }

  buildCommanders() {
    this.commanderGroups = [];
    const pedMat = new THREE.MeshStandardMaterial({
      color: '#b8b0a0',
      map: stoneWallTexture(),
      bumpMap: stoneBumpTexture(),
      bumpScale: 0.02,
      roughness: 0.78,
    });
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: '#e6b848',
      roughness: 0.25,
      metalness: 0.78,
    });
    this.battle.sides.forEach((s, i) => {
      if (!s.hero) return;
      const x = i === 0 ? -13.3 : 13.3;
      const z = -1.2;
      const dais = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.28, 0.25, 12), pedMat);
      base.position.y = 0.125;
      base.castShadow = true;
      base.receiveShadow = true;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.32, 12), pedMat);
      top.position.y = 0.38;
      top.castShadow = true;
      top.receiveShadow = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.045, 6, 24), goldTrimMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.52;
      dais.add(base, top, ring);

      const color = i === 0 ? '#d8392b' : '#2f6fe0';
      // Flanking war standards on poles
      for (const dz of [-1.25, 1.25]) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.045, 2.5, 8),
          goldTrimMat,
        );
        pole.position.set(0, 1.25, dz);
        pole.castShadow = true;
        dais.add(pole);
        const bn = makeBanner(color, 0.75);
        bn.position.set(i === 0 ? 0.05 : -0.05, 2.35, dz);
        bn.rotation.y = i === 0 ? Math.PI / 2 : -Math.PI / 2;
        dais.add(bn);
      }

      dais.position.set(x, 0, z);
      this.scene.add(dais);

      const hm = createHeroModel({
        faction: s.hero.faction || 'castle',
        heroClass: s.hero.cls || 'knight',
        color,
      });
      hm.position.set(x, 0.54, z);
      hm.scale.setScalar(1.28);
      hm.rotation.y = i === 0 ? 0 : Math.PI;
      this.scene.add(hm);
      this.commanderGroups[i] = hm;
    });
  }

  buildSiegeWalls(town) {
    const isNecro = town.faction === 'necropolis';
    const wallMat = new THREE.MeshStandardMaterial({
      color: isNecro ? '#4e4658' : '#dcd4c4',
      map: stoneWallTexture(),
      bumpMap: stoneBumpTexture(),
      bumpScale: 0.025,
      roughness: 0.82,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: isNecro ? '#642c88' : '#285ca8',
      roughness: 0.55,
      metalness: 0.15,
    });
    const ironMat = new THREE.MeshStandardMaterial({
      color: '#32363c',
      roughness: 0.38,
      metalness: 0.75,
    });
    this.towerPositions = [];
    const wallX = 10.6;
    for (let z = -7.5; z <= 7.5; z += 3.0) {
      const isGate = Math.abs(z) < 0.5;
      const segGroup = new THREE.Group();
      if (isGate) {
        // Gatehouse arch + iron portcullis
        const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.3, 0.75), wallMat);
        leftPillar.position.set(0, 1.15, -0.95);
        const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.3, 0.75), wallMat);
        rightPillar.position.set(0, 1.15, 0.95);
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 2.65), wallMat);
        lintel.position.set(0, 2.15, 0);
        segGroup.add(leftPillar, rightPillar, lintel);
        for (let gz = -0.5; gz <= 0.5; gz += 0.25) {
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.75, 6), ironMat);
          bar.position.set(0, 0.9, gz);
          segGroup.add(bar);
        }
      } else {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.85, 2.65), wallMat);
        seg.position.set(0, 0.925, 0);
        seg.castShadow = true;
        seg.receiveShadow = true;
        segGroup.add(seg);
        // Crenellations (merlons)
        for (let mz = -1.0; mz <= 1.0; mz += 0.65) {
          const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.36, 0.38), wallMat);
          merlon.position.set(0, 2.02, mz);
          merlon.castShadow = true;
          segGroup.add(merlon);
        }
      }
      segGroup.position.set(wallX, 0, z);
      this.scene.add(segGroup);
    }
    for (const z of [-7.9, 0, 7.9]) {
      if (z === 0) continue;
      const tw = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.08, 3.0, 12), wallMat);
      base.position.y = 1.5;
      base.castShadow = true;
      base.receiveShadow = true;
      const parapet = new THREE.Mesh(new THREE.CylinderGeometry(1.04, 0.96, 0.38, 12), wallMat);
      parapet.position.y = 3.05;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.18, 1.45, 12), roofMat);
      roof.position.y = 3.92;
      roof.castShadow = true;
      tw.add(base, parapet, roof);
      tw.position.set(11.85, 0, z);
      this.scene.add(tw);
      this.towerPositions.push(new THREE.Vector3(11.85, 2.9, z));
    }
  }

  // ===================================================================== units & badges
  buildUnits() {
    const shGeo = new THREE.PlaneGeometry(1, 1);
    shGeo.rotateX(-Math.PI / 2);
    const shMat = new THREE.MeshBasicMaterial({
      map: contactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.68,
    });
    for (const u of this.battle.units) {
      const wrap = new THREE.Group();
      const model = createCreatureModel(u.type);
      const tier = CREATURES[u.type].tier;
      const sc = tier <= 2 ? 0.92 : tier <= 4 ? 0.88 : tier <= 6 ? 0.84 : 0.78;
      model.scale.setScalar(sc);
      model.rotation.y = u.side === 0 ? 0 : Math.PI;
      wrap.add(model);
      const sh = new THREE.Mesh(shGeo, shMat);
      sh.scale.set(tier >= 6 ? 1.42 : 1.12, 1, tier >= 6 ? 1.42 : 1.12);
      sh.position.y = 0.028;
      sh.renderOrder = 1;
      wrap.add(sh);
      wrap.userData.model = model;
      wrap.userData.animator = model.userData.animator;
      wrap.userData.unit = u;
      wrap.position.copy(hexToWorld(u.x, u.y));
      this.scene.add(wrap);
      this.unitGroups.set(u.id, wrap);

      // HTML badge for stack size & status effects
      const badge = document.createElement('div');
      badge.className = `unit-badge side-${u.side}`;
      this.overlay.appendChild(badge);
      this.unitBadges.set(u.id, badge);
      this.updateUnitBadge(u);
    }
  }

  updateUnitBadge(u) {
    const badge = this.unitBadges.get(u.id);
    if (!badge) return;
    if (u.dead || u.count <= 0) {
      badge.style.display = 'none';
      return;
    }
    badge.style.display = 'flex';
    const effs = u.effects
      .map((e) => {
        const good = ['bless', 'stoneSkin', 'shield', 'haste', 'bloodlust', 'prayer'].includes(e.id);
        return `<span class="eff-dot ${good ? 'good' : 'bad'}" title="${EFFECT_NAMES[e.id] || e.id} (${e.rounds})"></span>`;
      })
      .join('');
    badge.innerHTML = `<span class="cnt">${u.count}</span>${effs ? `<span class="effs">${effs}</span>` : ''}`;
  }

  updateAllBadges() {
    for (const u of this.battle.units) this.updateUnitBadge(u);
  }

  // ===================================================================== highlights & pointer
  refreshHighlights() {
    const b = this.battle;
    const active = b.active;
    const humanTurn = active && !b.sides[active.side].ai && !b.result && !this.playing;
    const reach = humanTurn ? b.reachable(active) : new Map();

    // Compute live AOE spell affected hexes when hovering in spell mode
    const aoeSet = new Set();
    if (this.spellMode && humanTurn && this.hoveredHex) {
      const aff = b.spellAffectedHexes(active.side, this.spellMode, this.hoveredHex.x, this.hoveredHex.y);
      for (const h of aff) aoeSet.add(key(h.x, h.y));
    }

    for (const [id, wrap] of this.unitGroups) {
      wrap.userData.animator?.setHighlight?.(active && active.id === id && !active.dead);
    }

    if (active && !active.dead && this.activeUnitRing) {
      const ap = hexToWorld(active.x, active.y);
      this.activeUnitRing.position.set(ap.x, 0.036, ap.z);
      this.activeUnitRing.visible = true;
    } else if (this.activeUnitRing) {
      this.activeUnitRing.visible = false;
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const k = key(c, r);
        const fill = this.hexMeshes.get(k);
        const border = this.hexBorders.get(k);
        const u = b.unitAt(c, r);
        const isObs = b.obstacles.has(k);

        let col = '#000000', op = 0.03, bCol = '#d8c488', bOp = 0.13;
        if (isObs) {
          op = 0.0;
          bOp = 0.04;
        } else if (this.spellMode && humanTurn) {
          const valid = b.spellTargetValid(active.side, this.spellMode, c, r);
          if (aoeSet.has(k)) {
            const friendlyDanger = u && u.side === active.side && SPELLS[this.spellMode].kind === 'damage';
            col = friendlyDanger ? '#ff3a28' : '#e080ff';
            op = 0.50;
            bCol = friendlyDanger ? '#ff9988' : '#ffffff';
            bOp = 0.95;
          } else if (valid) {
            col = '#9d55e8'; op = 0.24; bCol = '#dcb4ff'; bOp = 0.58;
          }
        } else if (this.resurrectMode && humanTurn) {
          const corpse = b.corpseAt(c, r) || u;
          if (
            corpse &&
            corpse.side === active.side &&
            (corpse.dead || corpse.count < corpse.initialCount) &&
            !b.def(corpse).abilities.undead
          ) {
            col = '#ffe066'; op = 0.42; bCol = '#fff5b0'; bOp = 0.85;
          }
        } else if (humanTurn) {
          if (c === active.x && r === active.y) {
            col = '#ffd84a'; op = 0.36; bCol = '#ffe87a'; bOp = 0.9;
          } else if (u && u.side !== active.side) {
            const canShoot = b.canShoot(active);
            const canMelee = b.attackHexes(active, u, reach).length > 0;
            if (canShoot || canMelee) {
              col = '#e03a2f'; op = 0.34; bCol = '#ff8070'; bOp = 0.82;
            }
          } else if (reach.has(k)) {
            col = '#38b858'; op = 0.20; bCol = '#7ae894'; bOp = 0.46;
          }
        }

        if (this.hoveredHex && this.hoveredHex.x === c && this.hoveredHex.y === r && !isObs && !aoeSet.has(k)) {
          op = Math.min(0.62, op + 0.18);
          bOp = 0.92;
        }
        fill.material.color.set(col);
        fill.material.opacity = op;
        border.material.color.set(bCol);
        border.material.opacity = bOp;
      }
    }
  }

  setupPointer() {
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pt = new THREE.Vector3();

    const getHexAndPoint = (e) => {
      const ndc = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );
      ray.setFromCamera(ndc, this.camera);
      if (!ray.ray.intersectPlane(plane, pt)) return null;
      let best = null, bd = HEX_R * 1.05;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const hc = hexToWorld(c, r);
          const d = Math.hypot(pt.x - hc.x, pt.z - hc.z);
          if (d < bd) {
            bd = d;
            best = { x: c, y: r, world: pt.clone(), center: hc };
          }
        }
      }
      return best;
    };

    this.onPointerMove = (e) => {
      if (e.target.closest('.battle-ui, .modal-backdrop')) return;
      const hit = getHexAndPoint(e);
      this.hoveredHex = hit ? { x: hit.x, y: hit.y } : null;
      this.attackFromHex = null;
      this.approachRing.visible = false;
      this.updatePathPreview(null, null);

      const b = this.battle;
      const active = b.active;
      const humanTurn = active && !b.sides[active.side].ai && !b.result && !this.playing;
      if (hit && humanTurn && !this.spellMode && !this.resurrectMode) {
        const target = b.unitAt(hit.x, hit.y);
        if (target && target.side !== active.side) {
          if (b.canShoot(active)) {
            const far = hexDist(active, target) > 10;
            const est = b.estimate(active, target, { ranged: true, far });
            const dbl = b.def(active).abilities.doubleShot && active.shots >= 2 ? ' (×2 יריות)' : '';
            this.cb.onPreview?.(
              `ירי על ${b.name(target, 2)}${far ? ' [טווח רחוק - חצי נזק]' : ''}${dbl}: ${est.lo}–${est.hi} נזק (${est.killsLo}–${est.killsHi} הרוגים)`,
            );
          } else {
            const hexes = b.attackHexes(active, target);
            if (hexes.length) {
              let chosen = hexes[0], bestD = Infinity;
              for (const h of hexes) {
                const hw = hexToWorld(h.x, h.y);
                const d = Math.hypot(hit.world.x - hw.x, hit.world.z - hw.z);
                if (d < bestD) { bestD = d; chosen = h; }
              }
              this.attackFromHex = chosen;
              const apPos = hexToWorld(chosen.x, chosen.y);
              this.approachRing.position.set(apPos.x, 0.045, apPos.z);
              this.approachRing.visible = true;
              this.updatePathPreview(active, chosen, true);
              const est = b.estimate(active, target, {
                moved: chosen.dist,
                meleeShooter: !!b.def(active).abilities.shots,
              });
              const willRetal = !b.def(active).abilities.noRetaliation && target.retaliations > 0 && !b.hasEffect(target, 'blind');
              const retalStr = willRetal ? ' • ⚔️ האויב יגיב' : ' • ✓ ללא תגובת אויב';
              const joustStr = b.def(active).abilities.jousting && !b.def(target).abilities.antiCavalry && chosen.dist > 0
                ? ` • +${chosen.dist * 5}% דהירה`
                : '';
              const dblStr = b.def(active).abilities.doubleAttack ? ' (×2 מכות)' : '';
              this.cb.onPreview?.(
                `תקיפת ${b.name(target, 2)}${dblStr}: ${est.lo}–${est.hi} נזק (${est.killsLo}–${est.killsHi} הרוגים)${joustStr}${retalStr}`,
              );
            } else {
              this.cb.onPreview?.(`${b.name(target, 2)} (${target.count}) — מחוץ לטווח תנועה`);
            }
          }
        } else if (target) {
          const effNames = target.effects.map((ef) => `${EFFECT_NAMES[ef.id] || ef.id}(${ef.rounds})`).join(', ');
          this.cb.onPreview?.(
            `${b.name(target, 2)} (${target.count}) — נק"פ: ${target.hpLeft}/${b.unitHp(target)} • תגובות: ${target.retaliations > 99 ? '∞' : target.retaliations}${effNames ? ` • ${effNames}` : ''}`,
          );
        } else if (b.reachable(active).has(key(hit.x, hit.y))) {
          this.updatePathPreview(active, hit, false);
          this.cb.onPreview?.(`תנועה למשבצת (${hit.x + 1}, ${hit.y + 1})`);
        } else {
          this.cb.onPreview?.('');
        }
      } else if (hit && this.spellMode && humanTurn) {
        const sp = SPELLS[this.spellMode];
        const prev = b.spellPreview(active.side, this.spellMode, hit.x, hit.y);
        if (prev) {
          if (prev.kind === 'damage') {
            const ff = prev.friendlyHits ? ' • ⚠ פוגע בכוחותיך!' : '';
            this.cb.onPreview?.(
              `"${sp.name}": ${prev.count} יחידות ייפגעו • ${prev.totalDmg} נזק (${prev.totalKills} הרוגים)${ff}`,
            );
          } else if (prev.kind === 'resurrect') {
            this.cb.onPreview?.(
              `"${sp.name}" על ${b.name(prev.target, 2)}: יקים לתחייה ${prev.revived} יצורים (${prev.healAmt} נק"פ)`,
            );
          } else if (prev.kind === 'heal') {
            this.cb.onPreview?.(`"${sp.name}" על ${b.name(prev.target, 2)}: ריפוי ${prev.healAmt} נק"פ והסרת קללות`);
          } else {
            this.cb.onPreview?.(`הטלת "${sp.name}" (${EFFECT_NAMES[prev.effect] || sp.name}, ${prev.rounds} סבבים)`);
          }
        } else {
          this.cb.onPreview?.(`מטרה לא חוקית ללחש "${sp.name}" (קליק ימני / Esc לביטול)`);
        }
      }
      this.refreshHighlights();
    };

    this.onPointerDown = (e) => {
      if (e.target.closest('.battle-ui, .modal-backdrop')) return;
      const hit = getHexAndPoint(e);
      if (e.button === 2) {
        if (this.spellMode || this.resurrectMode) {
          this.spellMode = null;
          this.resurrectMode = false;
          this.refreshHighlights();
          this.cb.onCancelMode?.();
          return;
        }
        if (hit) {
          const u = this.battle.unitAt(hit.x, hit.y);
          if (u) this.cb.onInspectUnit?.(u, e.clientX, e.clientY);
        }
        return;
      }
      if (e.button !== 0 || !hit) return;
      this.cb.onHexClick?.(hit.x, hit.y, this.attackFromHex);
    };

    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerdown', this.onPointerDown);
  }

  flashVfxLight(pos, color = '#ffaa44', intensity = 3.2, duration = 0.28) {
    if (!this.vfxLight) return;
    this.vfxLight.color.set(color);
    this.vfxLight.position.copy(pos).add(new THREE.Vector3(0, 1.2, 0));
    tween(duration, (t) => {
      this.vfxLight.intensity = intensity * (1 - t);
    });
  }

  // ===================================================================== event playback
  async playEvents(events) {
    this.playing = true;
    this.approachRing.visible = false;
    this.updatePathPreview(null, null);
    this.refreshHighlights();
    for (const ev of events) {
      if (ev.msg) this.cb.onLog?.(ev.msg);
      const spd = this.speedMult;
      switch (ev.t) {
        case 'turn':
          this.updateAllBadges();
          this.cb.onTurnChange?.(ev.unit);
          break;
        case 'round':
          this.cb.onRoundChange?.(ev.round);
          break;
        case 'move':
          await this.animMove(ev.unit, ev.from, ev.path, ev.fly, spd);
          break;
        case 'attack':
          await this.animMelee(ev, spd);
          break;
        case 'shoot':
          await this.animShoot(ev, spd);
          break;
        case 'tower':
          await this.animTower(ev, spd);
          break;
        case 'splash':
          await this.animSplash(ev, spd);
          break;
        case 'spell':
          await this.animSpell(ev, spd);
          break;
        case 'death':
          await this.animDeath(ev.unit, spd);
          break;
        case 'resurrect':
          await this.animResurrect(ev, spd);
          break;
        case 'drain':
        case 'regen':
          this.spawnBurst(hexToWorld(ev.unit.x, ev.unit.y), '#55ff88', 12);
          this.floatOnUnit(ev.unit, ev.revived ? `+${ev.revived}` : '+נק"פ', '#66ff99');
          this.updateUnitBadge(ev.unit);
          break;
        case 'morale':
          audio.play(ev.good ? 'buff' : 'debuff');
          this.spawnBurst(hexToWorld(ev.unit.x, ev.unit.y), ev.good ? '#ffd84a' : '#7a3bb0', 16);
          this.floatOnUnit(ev.unit, ev.good ? 'מורל גבוה!' : 'פחד!', ev.good ? '#ffe26a' : '#b57cff');
          await wait(320 / spd);
          break;
        case 'defend':
          audio.play('click');
          this.unitGroups.get(ev.unit.id)?.userData.animator?.play?.('defend');
          this.floatOnUnit(ev.unit, 'הגנה', '#88c8ff');
          await wait(240 / spd);
          break;
        case 'wait':
          audio.play('turn');
          this.floatOnUnit(ev.unit, 'המתנה', '#e8d288');
          await wait(180 / spd);
          break;
        case 'status':
          this.updateUnitBadge(ev.unit);
          break;
        default:
          break;
      }
      this.updateAllBadges();
      this.cb.onQueueUpdate?.();
    }
    this.playing = false;
    this.refreshHighlights();
  }

  async animMove(u, from, path, fly, spd) {
    const wrap = this.unitGroups.get(u.id);
    if (!wrap || !path.length) return;
    const model = wrap.userData.model;
    const anim = wrap.userData.animator;
    anim?.play?.('walk');
    if (fly) {
      const start = hexToWorld(from.x, from.y);
      const end = hexToWorld(path[path.length - 1].x, path[path.length - 1].y);
      model.rotation.y = Math.atan2(-(end.z - start.z), end.x - start.x);
      audio.play('swing', { pitch: 0.8 });
      const dur = Math.min(0.75, 0.25 + start.distanceTo(end) * 0.04) / spd;
      await tween(dur, (t) => {
        wrap.position.lerpVectors(start, end, ease.inOut(t));
        wrap.position.y = Math.sin(t * Math.PI) * 0.85;
      });
      wrap.position.y = 0;
    } else {
      let cur = from;
      for (const step of path) {
        const a = hexToWorld(cur.x, cur.y), b = hexToWorld(step.x, step.y);
        model.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
        audio.play('step', { volume: 0.45 });
        await tween(0.15 / spd, (t) => {
          wrap.position.lerpVectors(a, b, t);
        });
        cur = step;
      }
    }
    model.rotation.y = u.side === 0 ? 0 : Math.PI;
    anim?.play?.('idle');
  }

  async animMelee(ev, spd) {
    const attWrap = this.unitGroups.get(ev.unit.id);
    const defWrap = this.unitGroups.get(ev.target.id);
    if (!attWrap || !defWrap) return;
    const attM = attWrap.userData.model, defM = defWrap.userData.model;
    const aPos = attWrap.position, dPos = defWrap.position;
    attM.rotation.y = Math.atan2(-(dPos.z - aPos.z), dPos.x - aPos.x);
    defM.rotation.y = Math.atan2(-(aPos.z - dPos.z), aPos.x - dPos.x);

    if (ev.lucky) {
      this.spawnBurst(aPos, '#ffe46a', 18);
      this.spawnShockwave(aPos, '#ffe46a', 1.45);
      this.floatOnUnit(ev.unit, 'מזל!', '#ffe46a');
    }
    if (ev.deathBlow) {
      this.spawnBurst(dPos, '#ff2222', 22);
      this.spawnShockwave(dPos, '#ff3322', 1.75);
      this.floatOnUnit(ev.unit, 'מכת מוות!', '#ff4444');
    }

    audio.play('swing');
    const anim = attWrap.userData.animator;
    const p = anim?.play ? anim.play('attack') : wait(450 / spd);
    await wait(((anim?.impactTime || 0.32) * 1000) / spd);

    audio.play('hit');
    defWrap.userData.animator?.flash?.('#ff3322', 0.32);
    defWrap.userData.animator?.play?.('hit');
    this.flashVfxLight(dPos, '#ff7733', 2.8, 0.24);
    this.spawnBurst(dPos.clone().add(new THREE.Vector3(0, 0.55, 0)), '#ff5533', 14);
    if (ev.kills > 0 || ev.lucky || ev.deathBlow) this.spawnShockwave(dPos, ev.deathBlow ? '#ff3322' : '#ff9944', 1.25);
    this.floatOnUnit(ev.target, `-${ev.dmg}${ev.kills ? ` (${ev.kills}☠)` : ''}`, '#ff6655');
    if (ev.kills > 0 || ev.dmg > 40) this.shakeAmt = Math.min(0.28, 0.08 + ev.dmg * 0.0015);
    this.updateUnitBadge(ev.target);
    await Promise.race([p, wait(380 / spd)]);
    attM.rotation.y = ev.unit.side === 0 ? 0 : Math.PI;
    if (!ev.target.dead) defM.rotation.y = ev.target.side === 0 ? 0 : Math.PI;
  }

  async animShoot(ev, spd) {
    const attWrap = this.unitGroups.get(ev.unit.id);
    const defWrap = this.unitGroups.get(ev.target.id);
    if (!attWrap || !defWrap) return;
    const attM = attWrap.userData.model;
    const aPos = attWrap.position, dPos = defWrap.position;
    attM.rotation.y = Math.atan2(-(dPos.z - aPos.z), dPos.x - aPos.x);

    if (ev.lucky) {
      this.spawnShockwave(aPos, '#ffe46a', 1.3);
      this.floatOnUnit(ev.unit, 'מזל!', '#ffe46a');
    }
    audio.play('arrow');
    const anim = attWrap.userData.animator;
    anim?.play?.('shoot');
    await wait(((anim?.impactTime || 0.28) * 1000) / spd);

    const start = aPos.clone().add(new THREE.Vector3(0, 0.75, 0));
    const end = dPos.clone().add(new THREE.Vector3(0, 0.65, 0));
    await this.flyProjectile(ev.projectile || 'arrow', start, end, spd);

    audio.play('hit');
    defWrap.userData.animator?.flash?.('#ff3322', 0.3);
    defWrap.userData.animator?.play?.('hit');
    const hitCol = ev.projectile === 'skull' ? '#7dff6a' : ev.projectile === 'holy' ? '#ffe87a' : '#ff6644';
    this.flashVfxLight(dPos, hitCol, 2.5, 0.22);
    this.spawnBurst(end, hitCol, 14);
    if (ev.projectile === 'skull' || ev.projectile === 'holy') this.spawnShockwave(dPos, hitCol, 1.35);
    this.floatOnUnit(ev.target, `-${ev.dmg}${ev.kills ? ` (${ev.kills}☠)` : ''}`, '#ff6655');
    this.updateUnitBadge(ev.target);
    await wait(160 / spd);
    attM.rotation.y = ev.unit.side === 0 ? 0 : Math.PI;
  }

  async animTower(ev, spd) {
    const defWrap = this.unitGroups.get(ev.target.id);
    if (!defWrap) return;
    const start = this.towerPositions?.[ev.tower] || new THREE.Vector3(11.5, 2.8, -6);
    const end = defWrap.position.clone().add(new THREE.Vector3(0, 0.65, 0));
    audio.play('arrow');
    await this.flyProjectile('arrow', start, end, spd);
    audio.play('hit');
    defWrap.userData.animator?.flash?.('#ff3322', 0.3);
    defWrap.userData.animator?.play?.('hit');
    this.floatOnUnit(ev.target, `-${ev.dmg}${ev.kills ? ` (${ev.kills}☠)` : ''}`, '#ff6655');
    this.updateUnitBadge(ev.target);
  }

  async animSplash(ev, spd) {
    for (const h of ev.hits) {
      const w = this.unitGroups.get(h.unit.id);
      if (!w) continue;
      const col = ev.kind === 'cloud' ? '#66ff66' : '#ff6622';
      this.spawnBurst(w.position.clone().add(new THREE.Vector3(0, 0.5, 0)), col, 16);
      this.spawnShockwave(w.position, col, 1.35);
      w.userData.animator?.flash?.('#ff4422', 0.3);
      this.floatOnUnit(h.unit, `-${h.dmg}${h.kills ? ` (${h.kills}☠)` : ''}`, '#ff7744');
      this.updateUnitBadge(h.unit);
    }
    await wait(240 / spd);
  }

  async animSpell(ev, spd) {
    const sp = SPELLS[ev.spell];
    const cmd = this.commanderGroups[ev.side];
    cmd?.userData.animator?.play?.('cast');
    const center = hexToWorld(ev.x, ev.y);
    const col = sp.color || '#b48cff';

    if (sp.vfx === 'lightning') {
      audio.play('lightning');
      for (const h of ev.hits) {
        const p = hexToWorld(h.unit.x, h.unit.y);
        this.spawnLightningBolt(p.clone().add(new THREE.Vector3(0, 9.5, 0)), p.clone().add(new THREE.Vector3(0, 0.4, 0)), col);
        this.spawnShockwave(p, col, 1.6);
      }
      this.flashVfxLight(center, '#aaddff', 4.5, 0.32);
      this.shakeAmt = 0.22;
      await wait(320 / spd);
    } else if (sp.vfx === 'chain') {
      audio.play('lightning');
      let prevPos = null;
      for (let i = 0; i < ev.hits.length; i++) {
        const p = hexToWorld(ev.hits[i].unit.x, ev.hits[i].unit.y);
        const start = prevPos ? prevPos.clone().add(new THREE.Vector3(0, 0.9, 0)) : p.clone().add(new THREE.Vector3(0, 9.5, 0));
        this.spawnLightningBolt(start, p.clone().add(new THREE.Vector3(0, 0.7, 0)), col);
        this.spawnShockwave(p, col, 1.45 - i * 0.18);
        this.flashVfxLight(p, '#aaddff', 4.2, 0.26);
        prevPos = p;
        await wait(115 / spd);
      }
      this.shakeAmt = 0.25;
      await wait(220 / spd);
    } else if (sp.vfx === 'meteor') {
      audio.play('meteor');
      const offsets = [[0, 0], [-0.9, -0.6], [0.95, 0.5], [-0.3, 0.9]];
      await Promise.all(
        offsets.map(async ([ox, oz], idx) => {
          await wait((idx * 65) / spd);
          const dst = center.clone().add(new THREE.Vector3(ox, 0.25, oz));
          const src = dst.clone().add(new THREE.Vector3(-3.2, 8.8, -2.2));
          await this.flyProjectile('fireball', src, dst, spd);
          this.spawnExplosion(dst, col, idx === 0 ? 2.4 : 1.5);
          this.spawnShockwave(dst, '#ff8828', idx === 0 ? 2.6 : 1.6);
        }),
      );
      this.flashVfxLight(center, '#ff7722', 5.2, 0.42);
      this.shakeAmt = 0.30;
      await wait(260 / spd);
    } else if (sp.vfx === 'fireball' || sp.vfx === 'armageddon') {
      audio.play('fire');
      const targets = sp.vfx === 'armageddon' ? this.battle.alive().map((u) => hexToWorld(u.x, u.y)) : [center];
      await Promise.all(targets.map((t) => this.flyProjectile('fireball', t.clone().add(new THREE.Vector3(-3, 8, -2)), t.clone().add(new THREE.Vector3(0, 0.3, 0)), spd)));
      for (const t of targets) {
        this.spawnExplosion(t, col, sp.vfx === 'armageddon' ? 2.4 : 2.1);
        this.spawnShockwave(t, col, 2.3);
      }
      this.flashVfxLight(center, '#ff7722', 5.0, 0.38);
      this.shakeAmt = 0.28;
      await wait(340 / spd);
    } else if (sp.vfx === 'frost') {
      audio.play('frost');
      this.spawnShockwave(center, '#9ad8ff', 2.4);
      for (const nb of neighbors(ev.x, ev.y)) {
        const np = hexToWorld(nb.x, nb.y);
        this.spawnIceSpike(np);
        this.spawnBurst(np.clone().add(new THREE.Vector3(0, 0.3, 0)), '#9ad8ff', 10);
      }
      this.flashVfxLight(center, '#88d8ff', 3.5, 0.32);
      await wait(360 / spd);
    } else if (sp.vfx === 'implosion') {
      audio.play('spell');
      this.spawnExplosion(center.clone().add(new THREE.Vector3(0, 0.6, 0)), '#c070ff', 1.9);
      this.spawnShockwave(center, '#c070ff', 2.0);
      this.flashVfxLight(center, '#c070ff', 4.2, 0.35);
      this.shakeAmt = 0.26;
      await wait(350 / spd);
    } else if (sp.vfx === 'arrow') {
      audio.play('magicArrow');
      const from = cmd ? cmd.position.clone().add(new THREE.Vector3(0, 1.1, 0)) : new THREE.Vector3(ev.side === 0 ? -12 : 12, 2, 0);
      await this.flyProjectile('magic', from, center.clone().add(new THREE.Vector3(0, 0.6, 0)), spd);
      this.flashVfxLight(center, col, 3.0, 0.25);
      this.spawnBurst(center.clone().add(new THREE.Vector3(0, 0.6, 0)), col, 16);
      this.spawnShockwave(center, col, 1.3);
    } else {
      audio.play(sp.kind === 'heal' || sp.kind === 'resurrect' ? 'heal' : sp.kind === 'buff' ? 'buff' : 'debuff');
      for (const h of ev.hits) {
        const p = hexToWorld(h.unit.x, h.unit.y);
        this.spawnPillar(p, col);
        this.spawnShockwave(p, col, 1.45);
      }
      this.flashVfxLight(center, col, 3.2, 0.35);
      await wait(360 / spd);
    }

    for (const h of ev.hits) {
      const w = this.unitGroups.get(h.unit.id);
      if (h.dmg) {
        w?.userData.animator?.flash?.('#ff3322', 0.32);
        w?.userData.animator?.play?.('hit');
        this.floatOnUnit(h.unit, `-${h.dmg}${h.kills ? ` (${h.kills}☠)` : ''}`, '#ff6655');
      } else if (h.revived) {
        w?.userData.animator?.play?.('revive');
        this.floatOnUnit(h.unit, `+${h.revived} קמו לתחייה!`, sp.undeadOnly ? '#66ff9e' : '#ffe97a');
      } else if (h.healed) {
        this.floatOnUnit(h.unit, `+${h.healed} נק"פ`, '#7dffb0');
      } else if (h.effect) {
        w?.userData.animator?.flash?.(col, 0.35);
        this.floatOnUnit(h.unit, EFFECT_NAMES[h.effect] || sp.name, col);
      }
      this.updateUnitBadge(h.unit);
    }
    await wait(220 / spd);
  }

  async animDeath(u, spd) {
    audio.play('death');
    const wrap = this.unitGroups.get(u.id);
    this.updateUnitBadge(u);
    if (wrap?.userData.animator?.play) {
      await Promise.race([wrap.userData.animator.play('death'), wait(550 / spd)]);
    }
  }

  async animResurrect(ev, spd) {
    audio.play('heal');
    const p = hexToWorld(ev.target.x, ev.target.y);
    this.spawnPillar(p, '#ffe97a');
    this.spawnShockwave(p, '#ffe97a', 1.8);
    this.flashVfxLight(p, '#ffe97a', 3.5, 0.4);
    const w = this.unitGroups.get(ev.target.id);
    w?.userData.animator?.play?.('revive');
    this.floatOnUnit(ev.target, `+${ev.revived} קמו לתחייה!`, '#ffe97a');
    this.updateUnitBadge(ev.target);
    await wait(450 / spd);
  }

  // ===================================================================== 3D projectiles & VFX
  spawnShockwave(pos, color, maxRadius = 1.6) {
    const geo = new THREE.RingGeometry(0.18, 0.34, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(pos.x, 0.06, pos.z);
    this.scene.add(ring);
    tween(0.36, (t) => {
      ring.scale.setScalar(0.5 + t * maxRadius * 2.4);
      mat.opacity = (1 - t) * 0.82;
    }).then(() => {
      this.scene.remove(ring);
      geo.dispose();
      mat.dispose();
    });
  }

  spawnIceSpike(pos) {
    const geo = new THREE.ConeGeometry(0.24, 1.35, 5);
    const mat = new THREE.MeshStandardMaterial({
      color: '#b8ecff',
      emissive: new THREE.Color('#4ab8ff'),
      emissiveIntensity: 0.9,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    });
    const spike = new THREE.Mesh(geo, mat);
    spike.position.set(pos.x, -0.5, pos.z);
    spike.rotation.y = Math.random() * Math.PI;
    this.scene.add(spike);
    tween(0.45, (t) => {
      const k = t < 0.35 ? ease.out(t / 0.35) : 1 - (t - 0.35) / 0.65;
      spike.position.y = -0.5 + k * 1.15;
      mat.opacity = Math.max(0, k * 0.92);
    }).then(() => {
      this.scene.remove(spike);
      geo.dispose();
      mat.dispose();
    });
  }
  async flyProjectile(kind, start, end, spd) {
    const g = new THREE.Group();
    if (kind === 'arrow') {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.65, 5),
        new THREE.MeshBasicMaterial({ color: '#c8a26a' }),
      );
      shaft.rotation.z = -Math.PI / 2;
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.16, 5),
        new THREE.MeshBasicMaterial({ color: '#dfe6ee' }),
      );
      tip.rotation.z = -Math.PI / 2;
      tip.position.x = 0.35;
      g.add(shaft, tip);
    } else if (kind === 'boulder') {
      g.add(
        new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.24),
          new THREE.MeshStandardMaterial({ color: '#7a7268', flatShading: true }),
        ),
      );
    } else if (kind === 'axe') {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.22, 0.05),
        new THREE.MeshBasicMaterial({ color: '#cfd6de' }),
      );
      g.add(m);
    } else {
      const col =
        kind === 'skull' ? '#7dff6a' : kind === 'holy' ? '#ffe87a' : kind === 'fireball' ? '#ff6a22' : '#c488ff';
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 10),
        new THREE.MeshBasicMaterial({ color: col }),
      );
      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture(col),
          transparent: true,
          blending: THREE.AdditiveBlending,
        }),
      );
      spr.scale.setScalar(0.95);
      g.add(orb, spr);
    }
    this.scene.add(g);
    const dist = start.distanceTo(end);
    const dur = Math.max(0.16, Math.min(0.45, dist * 0.025)) / spd;
    const arc = kind === 'arrow' || kind === 'boulder' || kind === 'axe' ? Math.min(1.6, dist * 0.1) : 0.15;
    await tween(dur, (t) => {
      g.position.lerpVectors(start, end, t);
      g.position.y += Math.sin(t * Math.PI) * arc;
      if (kind === 'axe' || kind === 'boulder') g.rotation.z = t * 14;
      else g.lookAt(end);
    });
    this.scene.remove(g);
  }

  spawnBurst(pos, color, count = 12) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const geo = new THREE.OctahedronGeometry(0.08, 0);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat.clone());
      m.position.copy(pos);
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd = 1.4 + Math.random() * 2.2;
      const vy = 1.5 + Math.random() * 2.4;
      this.scene.add(m);
      this.vfxList.push({
        mesh: m,
        vx: Math.cos(a) * spd,
        vy,
        vz: Math.sin(a) * spd,
        age: 0,
        life: 0.48,
      });
    }
  }

  spawnExplosion(pos, color, radius = 2.0) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 14, 12),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      }),
    );
    sphere.position.copy(pos);
    this.scene.add(sphere);
    this.spawnBurst(pos, color, 20);
    tween(0.38, (t) => {
      sphere.scale.setScalar(0.2 + t * radius);
      sphere.material.opacity = (1 - t) * 0.85;
    }).then(() => this.scene.remove(sphere));
  }

  spawnPillar(pos, color) {
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 4.5, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    cyl.position.copy(pos).add(new THREE.Vector3(0, 2.2, 0));
    this.scene.add(cyl);
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.4, 0)), color, 14);
    tween(0.45, (t) => {
      cyl.scale.set(1 + t * 0.35, 1, 1 + t * 0.35);
      cyl.material.opacity = (1 - t) * 0.65;
    }).then(() => this.scene.remove(cyl));
  }

  spawnLightningBolt(from, to, color) {
    const pts = [];
    const segs = 9;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = new THREE.Vector3().lerpVectors(from, to, t);
      if (i > 0 && i < segs) {
        p.x += (Math.random() - 0.5) * 0.7;
        p.z += (Math.random() - 0.5) * 0.7;
      }
      pts.push(p);
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: '#ffffff' }),
    );
    this.scene.add(line);
    this.spawnBurst(to, color, 16);
    setTimeout(() => this.scene.remove(line), 240);
  }

  floatOnUnit(u, text, color = '#fff') {
    const wrap = this.unitGroups.get(u.id);
    const pos = (wrap ? wrap.position.clone() : hexToWorld(u.x, u.y)).add(new THREE.Vector3(0, 1.35, 0));
    const el = document.createElement('div');
    el.className = 'float-text battle-float';
    el.style.color = color;
    el.textContent = text;
    this.overlay.appendChild(el);
    this.floaters.push({ el, pos, t: 0 });
  }

  worldToScreen(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight };
  }

  updateCamera(time) {
    const shX = this.shakeAmt > 0 ? Math.sin(time * 55) * this.shakeAmt : 0;
    const shY = this.shakeAmt > 0 ? Math.cos(time * 48) * this.shakeAmt : 0;
    this.camera.position.set(this.cameraBase.x + shX, this.cameraBase.y + shY, this.cameraBase.z);
    this.camera.lookAt(this.cameraTarget);
  }

  update(dt, time) {
    updateStructureTime(time);
    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.1);
    this.updateCamera(time);

    if (this.activeUnitRing?.visible) {
      this.activeUnitRing.scale.setScalar(1 + Math.sin(time * 4.5) * 0.05);
      this.activeUnitRing.material.opacity = 0.72 + Math.sin(time * 4.5) * 0.18;
    }

    for (const tf of this.torchFlames) {
      const f = 1 + Math.sin(time * 14 + tf.phase) * 0.12 + Math.cos(time * 23 + tf.phase) * 0.08;
      tf.flame.scale.set(1 + Math.sin(time * 17 + tf.phase) * 0.06, f, 1);
      tf.spr.scale.setScalar(1.8 + Math.sin(time * 11 + tf.phase) * 0.2);
    }

    if (this.atmoParticles) {
      const { pts, pos, phases, count, tKey } = this.atmoParticles;
      for (let i = 0; i < count; i++) {
        const ph = phases[i];
        pos[i * 3] += Math.sin(time * 0.6 + ph) * dt * 0.15;
        if (tKey === 'snow') {
          pos[i * 3 + 1] -= dt * 0.45;
          if (pos[i * 3 + 1] < 0.1) pos[i * 3 + 1] = 5.5;
        } else {
          pos[i * 3 + 1] += dt * 0.22;
          if (pos[i * 3 + 1] > 5.5) pos[i * 3 + 1] = 0.2;
        }
      }
      pts.geometry.attributes.position.needsUpdate = true;
    }

    for (const wrap of this.unitGroups.values()) {
      wrap.userData.animator?.update?.(dt);
      const u = wrap.userData.unit;
      const badge = this.unitBadges.get(u.id);
      if (badge && badge.style.display !== 'none') {
        const s = this.worldToScreen(wrap.position.clone().add(new THREE.Vector3(0.32, 0.08, 0.38)));
        badge.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
      }
    }
    for (const c of this.commanderGroups) c?.userData.animator?.update?.(dt);

    for (let i = this.vfxList.length - 1; i >= 0; i--) {
      const p = this.vfxList[i];
      p.age += dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 6.5 * dt;
      p.mesh.material.opacity = Math.max(0, 1 - p.age / p.life);
      if (p.age >= p.life) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.vfxList.splice(i, 1);
      }
    }

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      const s = this.worldToScreen(f.pos.clone().add(new THREE.Vector3(0, f.t * 0.9, 0)));
      f.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
      f.el.style.opacity = String(Math.max(0, 1 - Math.max(0, f.t - 0.7) / 0.5));
      if (f.t > 1.2) {
        f.el.remove();
        this.floaters.splice(i, 1);
      }
    }
  }

  dispose() {
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
    for (const b of this.unitBadges.values()) b.remove();
    for (const f of this.floaters) f.el.remove();
    this.unitBadges.clear();
    this.floaters = [];
  }
}
