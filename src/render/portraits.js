// ============================================================================
//  portraits.js — מחולל דיוקנאות תלת-ממדיים ליצורים וגיבורים (Offscreen WebGL -> DataURL)
// ============================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CREATURES } from '../data/creatures.js';
import { createCreatureModel, createHeroModel, disposeModel } from './creatureModels.js';

const SIZE = 256;
const CACHE = new Map();

let glState = null;

function getGL() {
  if (glState !== null) return glState;
  if (typeof document === 'undefined') {
    glState = false;
    return false;
  }
  try {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(2);
    renderer.setSize(SIZE, SIZE, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;

    const scene = new THREE.Scene();

    // Procedural studio environment reflection so metallic armor, gold trim & blades gleam
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      if ('environmentIntensity' in scene) scene.environmentIntensity = 0.45;
      pmrem.dispose();
    } catch {
      // Fallback if PMREM fails in constrained context
    }

    const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 30);

    // Dramatic 3-point portrait studio lighting (warm golden key, cool fill, crisp rim)
    const hemi = new THREE.HemisphereLight('#f4f8ff', '#3d2e20', 0.82);

    const keyLight = new THREE.DirectionalLight('#fff1d0', 2.05);
    keyLight.position.set(3.2, 4.2, 3.4);

    const fillLight = new THREE.DirectionalLight('#8ab8ff', 0.85);
    fillLight.position.set(-3.2, 1.8, 2.8);

    const rimLight = new THREE.DirectionalLight('#ffd27d', 1.65);
    rimLight.position.set(-2.4, 3.8, -3.2);

    const underLight = new THREE.DirectionalLight('#d8b888', 0.35);
    underLight.position.set(1.0, -2.5, 2.0);

    const holder = new THREE.Group();
    scene.add(hemi, keyLight, fillLight, rimLight, underLight, holder);

    glState = { renderer, scene, camera, holder, rimLight, fillLight };
  } catch {
    glState = false;
  }
  return glState;
}

const FACTION_BG = {
  castle: {
    c0: '#4f88eb',
    c1: '#1f4082',
    c2: '#0b1733',
    mist: 'rgba(130, 190, 255, 0.22)',
    glow: '#ffe07d',
    gem: ['#64b5ff', '#1b5fd6', '#092252'],
    rimColor: '#ffd88a',
    fillColor: '#9ac4ff',
  },
  necropolis: {
    c0: '#6e38a8',
    c1: '#2d1447',
    c2: '#0c0517',
    mist: 'rgba(110, 255, 160, 0.16)',
    glow: '#7dff9e',
    gem: ['#80ff9e', '#1fa84f', '#083b1a'],
    rimColor: '#9effb8',
    fillColor: '#b48aff',
  },
  neutral: {
    c0: '#82623a',
    c1: '#3b2b18',
    c2: '#140e08',
    mist: 'rgba(255, 205, 125, 0.18)',
    glow: '#f2c166',
    gem: ['#ffd06b', '#c47a1b', '#4a2805'],
    rimColor: '#ffd280',
    fillColor: '#a8c5eb',
  },
};

function drawBackground(ctx, faction = 'neutral', upgraded = false) {
  const S = SIZE;
  const pal = FACTION_BG[faction] || FACTION_BG.neutral;

  // Base painted radial gradient
  const grad = ctx.createRadialGradient(S * 0.46, S * 0.38, S * 0.04, S * 0.5, S * 0.5, S * 0.74);
  grad.addColorStop(0, pal.c0);
  grad.addColorStop(0.52, pal.c1);
  grad.addColorStop(1, pal.c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  // Subtle painted atmospheric mist clouds
  for (const [mx, my, mr] of [
    [0.28, 0.32, 0.38],
    [0.72, 0.28, 0.34],
    [0.52, 0.68, 0.44],
  ]) {
    const mGrad = ctx.createRadialGradient(S * mx, S * my, 2, S * mx, S * my, S * mr);
    mGrad.addColorStop(0, pal.mist);
    mGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mGrad;
    ctx.fillRect(0, 0, S, S);
  }

  // Heroic crest rays & halo for upgraded creatures and heroes
  if (upgraded) {
    ctx.save();
    ctx.translate(S * 0.5, S * 0.42);
    const rayCount = 16;
    for (let i = 0; i < rayCount; i++) {
      const a0 = (i / rayCount) * Math.PI * 2;
      const a1 = a0 + (Math.PI / rayCount) * 0.55;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, S * 0.56, a0, a1);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 235, 165, 0.055)';
      ctx.fill();
    }
    ctx.restore();

    const glow = ctx.createRadialGradient(S * 0.5, S * 0.42, 4, S * 0.5, S * 0.42, S * 0.5);
    glow.addColorStop(0, pal.glow + '55');
    glow.addColorStop(0.55, pal.glow + '18');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, S, S);
  }
}

function drawOrnateBorder(ctx, faction = 'neutral', upgraded = false) {
  const S = SIZE;
  const pal = FACTION_BG[faction] || FACTION_BG.neutral;
  ctx.save();

  // Inner dark shadow vignette to give depth to the 3D render
  const vig = ctx.createRadialGradient(S * 0.5, S * 0.48, S * 0.33, S * 0.5, S * 0.5, S * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.7, 'rgba(0,0,0,0.18)');
  vig.addColorStop(1, 'rgba(0,0,0,0.58)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, S, S);

  // Outer dark bronze casing
  ctx.strokeStyle = '#1a1006';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, S - 12, S - 12);

  // Outer bevel highlight
  const outerGrad = ctx.createLinearGradient(0, 0, S, S);
  outerGrad.addColorStop(0, upgraded ? '#fff3b8' : '#e8be62');
  outerGrad.addColorStop(0.35, upgraded ? '#f0be48' : '#c49232');
  outerGrad.addColorStop(0.7, upgraded ? '#9e6e18' : '#7d5614');
  outerGrad.addColorStop(1, '#4a3008');
  ctx.strokeStyle = outerGrad;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, S - 12, S - 12);

  // Recessed dark groove between double bevels
  ctx.strokeStyle = '#241608';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, S - 20, S - 20);

  // Inner gold fillet trim
  const innerGrad = ctx.createLinearGradient(0, S, S, 0);
  innerGrad.addColorStop(0, '#6e4c14');
  innerGrad.addColorStop(0.5, upgraded ? '#ffd86b' : '#d6a442');
  innerGrad.addColorStop(1, upgraded ? '#fff4c2' : '#f2cf78');
  ctx.strokeStyle = innerGrad;
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, S - 24, S - 24);

  // Crisp inner specular hairline
  ctx.strokeStyle = 'rgba(255, 244, 200, 0.38)';
  ctx.lineWidth = 1;
  ctx.strokeRect(13.5, 13.5, S - 27, S - 27);

  // Corner ornamental plates & faceted gems
  const corners = [
    [11, 11],
    [S - 11, 11],
    [11, S - 11],
    [S - 11, S - 11],
  ];
  for (const [cx, cy] of corners) {
    // Gold diamond mounting plate
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 8, cy);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx - 8, cy);
    ctx.closePath();
    ctx.fillStyle = upgraded ? '#ffd86b' : '#cfa03c';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#2b1a07';
    ctx.stroke();

    // Faceted corner gem
    const gemGrad = ctx.createRadialGradient(cx - 1.5, cy - 1.5, 0.5, cx, cy, 5);
    gemGrad.addColorStop(0, pal.gem[0]);
    gemGrad.addColorStop(0.55, pal.gem[1]);
    gemGrad.addColorStop(1, pal.gem[2]);
    ctx.beginPath();
    ctx.arc(cx, cy, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = gemGrad;
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = upgraded ? '#fff2b2' : '#ebc265';
    ctx.stroke();

    // Gem specular glint
    ctx.beginPath();
    ctx.arc(cx - 1.3, cy - 1.3, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
  }

  ctx.restore();
}

function computePortraitFraming(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const rig = model.userData.rig;
  const s = rig?.scale || 1;
  const plan = rig?.plan || 'biped';
  const focus = new THREE.Vector3();
  let span = 0.62 * s;
  let dir = new THREE.Vector3(0.78, 0.16, 0.60).normalize();

  const headObj = rig?.h?.head || rig?.q?.head;
  const bodyObj = rig?.h?.torso || rig?.q?.body;
  const headPos = new THREE.Vector3();
  const bodyPos = new THREE.Vector3();

  if (headObj) headObj.getWorldPosition(headPos);
  if (bodyObj) bodyObj.getWorldPosition(bodyPos);

  if (plan === 'rider' && rig?.h?.head && rig?.q?.head) {
    const horseHead = new THREE.Vector3();
    rig.q.head.getWorldPosition(horseHead);
    // Frame both the mounted knight/hero and the warhorse's armored head
    focus.copy(headPos).multiplyScalar(0.56).addScaledVector(horseHead, 0.44);
    focus.y -= 0.04 * s;
    span = 0.78 * s;
    dir.set(0.74, 0.17, 0.65).normalize();
  } else if (plan === 'dragon' && headObj && bodyObj) {
    focus.copy(headPos).multiplyScalar(0.62).addScaledVector(bodyPos, 0.38);
    focus.y += 0.03 * s;
    span = 0.76 * s;
    dir.set(0.75, 0.18, 0.64).normalize();
  } else if ((plan === 'griffin' || plan === 'quad') && headObj && bodyObj) {
    focus.copy(headPos).multiplyScalar(0.64).addScaledVector(bodyPos, 0.36);
    focus.y += 0.02 * s;
    span = (plan === 'griffin' ? 0.66 : 0.56) * s;
    dir.set(0.76, 0.18, 0.62).normalize();
  } else if (headObj && bodyObj) {
    // Biped / ghost: tight heroic upper-body & head framing, ignoring overly tall pikes/staves
    focus.copy(headPos).multiplyScalar(0.64).addScaledVector(bodyPos, 0.36);
    focus.y += 0.03 * s;
    const hasWings = rig?.wings?.length > 0;
    span = (hasWings ? 0.64 : 0.49) * s;
    dir.set(0.80, 0.14, 0.58).normalize();
  } else {
    focus.set(center.x, box.min.y + size.y * 0.64, center.z);
    span = Math.max(size.y * 0.62, size.x * 0.58, 0.45);
  }

  return { focus, span, dir };
}

function renderModelToDataURL(model, { faction = 'neutral', upgraded = false, label = '' } = {}) {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  drawBackground(ctx, faction, upgraded);

  const gl = getGL();
  if (gl) {
    const { renderer, scene, camera, holder, rimLight, fillLight } = gl;
    const pal = FACTION_BG[faction] || FACTION_BG.neutral;
    rimLight.color.set(pal.rimColor);
    fillLight.color.set(pal.fillColor);

    while (holder.children.length) holder.remove(holder.children[0]);
    holder.add(model);

    // Advance idle pose slightly so capes, wings & weapons sit in a dynamic heroic pose
    model.userData.animator?.update(0.35);
    model.updateMatrixWorld(true);

    const { focus, span, dir } = computePortraitFraming(model);
    const dist = (span * 0.54) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));

    camera.position.copy(focus).addScaledVector(dir, dist);
    camera.lookAt(focus);
    camera.updateProjectionMatrix();

    renderer.clear();
    renderer.render(scene, camera);
    ctx.drawImage(renderer.domElement, 0, 0, SIZE, SIZE);
    holder.remove(model);
  } else if (label) {
    ctx.fillStyle = '#fff5d6';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, SIZE / 2, SIZE / 2);
  }

  drawOrnateBorder(ctx, faction, upgraded);
  return canvas.toDataURL('image/png');
}

export function getCreaturePortrait(id) {
  if (CACHE.has(id)) return CACHE.get(id);
  const c = CREATURES[id] || CREATURES.pikeman;
  const model = createCreatureModel(id, { static: true });
  const url = renderModelToDataURL(model, {
    faction: c?.faction || 'neutral',
    upgraded: !!c?.upgraded,
    label: c?.name || id,
  });
  disposeModel(model);
  CACHE.set(id, url);
  return url;
}

export function getHeroModelPortrait(faction = 'castle', heroClass = 'knight', color = '#d8392b') {
  const key = `hero|${faction}|${heroClass}|${color}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const model = createHeroModel({ faction, heroClass, color, static: true });
  const url = renderModelToDataURL(model, {
    faction,
    upgraded: true,
    label: heroClass,
  });
  disposeModel(model);
  CACHE.set(key, url);
  return url;
}
