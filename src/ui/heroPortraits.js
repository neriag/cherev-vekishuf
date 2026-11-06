// ============================================================================
//  מחולל דיוקנאות גיבורים (Canvas 2D) — סגנון ציור שמן פנטזיה קלאסי (HoMM3)
//  מצויר פרוצדורלית ברזולוציה גבוהה (256x256) ונשמר במטמון
// ============================================================================

import { HERO_ROSTER } from '../data/heroes.js';

const PORTRAIT_CACHE = new Map();
const INTERNAL_RES = 256;

// ============================================================================
//  פרופילי אופי ואמנות ייחודיים ל-16 הגיבורים הקנוניים
// ============================================================================
const HERO_PRESETS = {
  // ---- המבצר: אבירים (Knights) ----
  gideon: {
    skin: '#df9f74', skinShadow: '#7d4427', skinHighlight: '#f9d5b8',
    hair: '#422512', hairHi: '#7d4b28', hairStyle: 'wavyNoble', beard: 'royalTrim',
    helm: 'circlet', eye: '#2e6f9e', eyeGlow: false, scar: false,
    accent: '#1d4ed8', secondary: '#f59e0b', rimLight: '#fbbf24',
    turn: 1, browTilt: 0.15, expression: 'noble', emblem: 'torchSun',
    pauldronStyle: 'flutedGold', cloakColor: '#1e3a8a',
  },
  yoav: {
    skin: '#c9885c', skinShadow: '#69371c', skinHighlight: '#ebb894',
    hair: '#1e130d', hairHi: '#4a3325', hairStyle: 'cropped', beard: 'fullWar',
    helm: 'crest', eye: '#4a2e16', eyeGlow: false, scar: 'rightEye',
    accent: '#b91c1c', secondary: '#cbd5e1', rimLight: '#f97316',
    turn: -1, browTilt: 0.45, expression: 'fierce', emblem: 'crossedSwords',
    pauldronStyle: 'heavySteel', cloakColor: '#7f1d1d',
  },
  shimshon: {
    skin: '#d18e5c', skinShadow: '#6e3b19', skinHighlight: '#f2c199',
    hair: '#241308', hairHi: '#593318', hairStyle: 'nazariteLocks', beard: 'heroicLong',
    helm: 'band', eye: '#633b15', eyeGlow: false, scar: false,
    accent: '#d97706', secondary: '#b45309', rimLight: '#fde047',
    turn: 1, browTilt: 0.35, expression: 'determined', emblem: 'lionHead',
    pauldronStyle: 'lionPelt', cloakColor: '#92400e',
  },
  yael: {
    skin: '#e5ae86', skinShadow: '#874d2f', skinHighlight: '#fde0c9',
    hair: '#211109', hairHi: '#542e1b', hairStyle: 'windBraids', beard: 'none',
    helm: 'tiara', eye: '#1f7a4c', eyeGlow: false, scar: false,
    accent: '#0284c7', secondary: '#eab308', rimLight: '#38bdf8',
    turn: -1, browTilt: 0.22, expression: 'cunning', emblem: 'starSpear',
    pauldronStyle: 'valkyrieWing', cloakColor: '#0c4a6e',
  },
  benayahu: {
    skin: '#cf9165', skinShadow: '#6b3b1e', skinHighlight: '#f0c09c',
    hair: '#523218', hairHi: '#8a5a36', hairStyle: 'wavyNoble', beard: 'veteran',
    helm: 'lion', eye: '#6e4720', eyeGlow: false, scar: 'cheek',
    accent: '#1e40af', secondary: '#f59e0b', rimLight: '#60a5fa',
    turn: 1, browTilt: 0.3, expression: 'stern', emblem: 'lionSun',
    pauldronStyle: 'lionGold', cloakColor: '#172554',
  },

  // ---- המבצר: כוהנים (Clerics) ----
  devora: {
    skin: '#e2ac80', skinShadow: '#82492a', skinHighlight: '#fce2c9',
    hair: '#331a0d', hairHi: '#6b381e', hairStyle: 'prophetessLocks', beard: 'none',
    helm: 'haloCrown', eye: '#6b3e19', eyeGlow: '#fde68a', scar: false,
    accent: '#eab308', secondary: '#fef08a', rimLight: '#fef08a',
    turn: 1, browTilt: 0.05, expression: 'serene', emblem: 'palmSun',
    pauldronStyle: 'goldBrooch', cloakColor: '#fefce8',
  },
  avigail: {
    skin: '#f2c29d', skinShadow: '#94583b', skinHighlight: '#fff0e3',
    hair: '#6e2c14', hairHi: '#b5532f', hairStyle: 'auburnWaves', beard: 'none',
    helm: 'veil', eye: '#2563eb', eyeGlow: false, scar: false,
    accent: '#38bdf8', secondary: '#f8fafc', rimLight: '#7dd3fc',
    turn: -1, browTilt: -0.05, expression: 'gentle', emblem: 'doveChalice',
    pauldronStyle: 'pearlStole', cloakColor: '#e0f2fe',
  },
  shmuel: {
    skin: '#d9a177', skinShadow: '#784628', skinHighlight: '#f7d2b5',
    hair: '#d8dee9', hairHi: '#ffffff', hairStyle: 'prophetMane', beard: 'patriarch',
    helm: 'mitre', eye: '#475569', eyeGlow: '#fef9c3', scar: false,
    accent: '#f59e0b', secondary: '#1d4ed8', rimLight: '#fde047',
    turn: 1, browTilt: 0.25, expression: 'stern', emblem: 'hoshen',
    pauldronStyle: 'ephod', cloakColor: '#f8fafc',
  },
  elisha: {
    skin: '#d8a882', skinShadow: '#754829', skinHighlight: '#f5d2b8',
    hair: '#7d6552', hairHi: '#c4b2a3', hairStyle: 'recedingSage', beard: 'sageLong',
    helm: 'hoodLight', eye: '#14b8a6', eyeGlow: '#99f6e4', scar: false,
    accent: '#3b82f6', secondary: '#2dd4bf', rimLight: '#5eead4',
    turn: -1, browTilt: 0.12, expression: 'noble', emblem: 'waterSpring',
    pauldronStyle: 'mantle', cloakColor: '#f1f5f9',
  },

  // ---- הנקרופוליס: אבירי מוות (Death Knights) ----
  belial: {
    skin: '#939da8', skinShadow: '#333942', skinHighlight: '#c8d2dc',
    hair: '#111317', hairHi: '#343b47', hairStyle: 'darkSwept', beard: 'goatee',
    helm: 'horns', eye: '#ff1e42', eyeGlow: '#ff4d6d', scar: 'leftEye',
    accent: '#991b1b', secondary: '#ef4444', rimLight: '#ef4444',
    turn: 1, browTilt: 0.5, expression: 'fierce', emblem: 'bloodSkull',
    pauldronStyle: 'darkSpikes', cloakColor: '#450a0a',
  },
  azazel: {
    skin: '#877b73', skinShadow: '#2e2520', skinHighlight: '#b8aba3',
    hair: '#1a1412', hairHi: '#42342f', hairStyle: 'cropped', beard: 'jaggedWar',
    helm: 'spiked', eye: '#ff6b1a', eyeGlow: '#fb923c', scar: 'slash',
    accent: '#c2410c', secondary: '#f97316', rimLight: '#f97316',
    turn: -1, browTilt: 0.48, expression: 'fierce', emblem: 'emberRune',
    pauldronStyle: 'scorchedPlate', cloakColor: '#431407',
  },
  ashmedai: {
    skin: '#94899e', skinShadow: '#372b42', skinHighlight: '#c9bed4',
    hair: '#170d24', hairHi: '#47296b', hairStyle: 'aristocratLong', beard: 'imperial',
    helm: 'darkCrown', eye: '#facc15', eyeGlow: '#fde047', scar: false,
    accent: '#7e22ce', secondary: '#eab308', rimLight: '#c084fc',
    turn: 1, browTilt: 0.35, expression: 'cunning', emblem: 'demonCrown',
    pauldronStyle: 'abyssalGold', cloakColor: '#3b0764',
  },

  // ---- הנקרופוליס: נקרומנסרים (Necromancers) ----
  lilith: {
    skin: '#cfc2db', skinShadow: '#543f69', skinHighlight: '#f2e8fc',
    hair: '#12091f', hairHi: '#4c2675', hairStyle: 'nightCurls', beard: 'none',
    helm: 'crescent', eye: '#e879f9', eyeGlow: '#f0abfc', scar: false,
    accent: '#9333ea', secondary: '#c084fc', rimLight: '#d946ef',
    turn: -1, browTilt: 0.25, expression: 'cunning', emblem: 'nightMoon',
    pauldronStyle: 'velvetBone', cloakColor: '#2e1065',
  },
  agrat: {
    skin: '#b2c2b7', skinShadow: '#3c4f43', skinHighlight: '#dfede4',
    hair: '#122118', hairHi: '#2d543c', hairStyle: 'witchBraids', beard: 'none',
    helm: 'boneTiara', eye: '#4ade80', eyeGlow: '#86efac', scar: false,
    accent: '#16a34a', secondary: '#4ade80', rimLight: '#22c55e',
    turn: 1, browTilt: 0.3, expression: 'cunning', emblem: 'emeraldSkull',
    pauldronStyle: 'boneSpines', cloakColor: '#052e16',
  },
  samael: {
    skin: '#aab4c2', skinShadow: '#384152', skinHighlight: '#dde5f0',
    hair: '#cfd8e3', hairHi: '#ffffff', hairStyle: 'wraithLocks', beard: 'none',
    helm: 'cowl', eye: '#38bdf8', eyeGlow: '#7dd3fc', scar: 'leftEye',
    accent: '#4f46e5', secondary: '#38bdf8', rimLight: '#38bdf8',
    turn: -1, browTilt: 0.38, expression: 'stern', emblem: 'deathWing',
    pauldronStyle: 'reaperCowl', cloakColor: '#0f172a',
  },
  naama: {
    skin: '#d9bfc9', skinShadow: '#613c4b', skinHighlight: '#faeaf0',
    hair: '#33091f', hairHi: '#781b4b', hairStyle: 'sirenWaves', beard: 'none',
    helm: 'boneCrown', eye: '#fb7185', eyeGlow: '#fda4af', scar: false,
    accent: '#be185d', secondary: '#f43f5e', rimLight: '#fb7185',
    turn: 1, browTilt: 0.18, expression: 'cunning', emblem: 'bloodRose',
    pauldronStyle: 'crimsonLace', cloakColor: '#4c0519',
  },
};

// ============================================================================
//  פונקציות עזר מתמטיות וצבעוניות (Color & Math Utilities)
// ============================================================================
function hashString(str) {
  let h = 2166136261 >>> 0;
  const s = String(str || 'hero');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
  let s = (seed >>> 0) || 123456789;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const clean = String(hex || '#888888').replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0');
  const num = parseInt(full.slice(0, 6), 16) || 0;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToCss({ r, g, b }, alpha = 1) {
  const rr = Math.max(0, Math.min(255, Math.round(r)));
  const gg = Math.max(0, Math.min(255, Math.round(g)));
  const bb = Math.max(0, Math.min(255, Math.round(b)));
  return alpha >= 0.999 ? `rgb(${rr},${gg},${bb})` : `rgba(${rr},${gg},${bb},${alpha.toFixed(3)})`;
}

function mixHex(hexA, hexB, t = 0.5, alpha = 1) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToCss({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }, alpha);
}

function shadeHex(hex, amount = 0, alpha = 1) {
  return amount >= 0
    ? mixHex(hex, '#ffffff', amount, alpha)
    : mixHex(hex, '#08050a', -amount, alpha);
}

function withAlpha(hex, alpha) {
  return rgbToCss(hexToRgb(hex), alpha);
}

// בניית פרופיל מלא גם לגיבור אקראי שאינו ב-HERO_PRESETS
function resolveProfile(id, cls, gender, rng) {
  const base = HERO_PRESETS[id];
  if (base) return base;

  const isUndead = cls === 'deathKnight' || cls === 'necromancer';
  const humanSkins = [
    ['#df9f74', '#7d4427', '#f9d5b8'],
    ['#c9885c', '#69371c', '#ebb894'],
    ['#e5ae86', '#874d2f', '#fde0c9'],
    ['#f0bfa0', '#8f5538', '#fff0e5'],
  ];
  const undeadSkins = [
    ['#939da8', '#333942', '#c8d2dc'],
    ['#b2c2b7', '#3c4f43', '#dfede4'],
    ['#cfc2db', '#543f69', '#f2e8fc'],
    ['#94899e', '#372b42', '#c9bed4'],
  ];
  const palette = isUndead ? undeadSkins : humanSkins;
  const [skin, skinShadow, skinHighlight] = palette[Math.floor(rng() * palette.length)];

  const hairs = [
    ['#241308', '#593318'],
    ['#422512', '#7d4b28'],
    ['#6e2c14', '#b5532f'],
    ['#12091f', '#4c2675'],
    ['#d8dee9', '#ffffff'],
  ];
  const [hair, hairHi] = hairs[Math.floor(rng() * hairs.length)];

  return {
    skin, skinShadow, skinHighlight,
    hair, hairHi,
    hairStyle: gender === 'f' ? 'auburnWaves' : 'wavyNoble',
    beard: gender === 'f' ? 'none' : (isUndead ? 'goatee' : 'royalTrim'),
    helm: cls === 'knight' ? 'circlet' : cls === 'cleric' ? 'haloCrown' : cls === 'deathKnight' ? 'horns' : 'cowl',
    eye: isUndead ? '#4ade80' : '#2563eb',
    eyeGlow: isUndead ? '#86efac' : false,
    scar: rng() > 0.7 ? 'cheek' : false,
    accent: cls === 'knight' ? '#1d4ed8' : cls === 'cleric' ? '#eab308' : cls === 'deathKnight' ? '#991b1b' : '#7e22ce',
    secondary: '#f59e0b',
    rimLight: isUndead ? '#4ade80' : '#fbbf24',
    turn: rng() > 0.5 ? 1 : -1,
    browTilt: 0.2,
    expression: 'noble',
    emblem: 'torchSun',
    pauldronStyle: cls === 'knight' ? 'flutedGold' : cls === 'cleric' ? 'goldBrooch' : cls === 'deathKnight' ? 'darkSpikes' : 'reaperCowl',
    cloakColor: isUndead ? '#1e1030' : '#1e3a8a',
  };
}

// ============================================================================
//  הפונקציה הראשית — heroPortrait(heroInput, size = 128)
// ============================================================================
export function heroPortrait(heroInput, size = 128) {
  const hero = typeof heroInput === 'string'
    ? (HERO_ROSTER.find((h) => h.id === heroInput) || { id: heroInput, name: heroInput, gender: 'm', cls: 'knight' })
    : (heroInput || { id: 'default', gender: 'm', cls: 'knight' });

  const id = hero.id || hero.name || 'hero';
  const cls = hero.cls || 'knight';
  const gender = hero.gender || 'm';
  const seed = hero.portraitSeed != null ? Number(hero.portraitSeed) : hashString(`${id}:${cls}:${gender}`);
  const cacheKey = `${id}_${size}_${cls}_${gender}_${seed}`;

  if (PORTRAIT_CACHE.has(cacheKey)) {
    return PORTRAIT_CACHE.get(cacheKey);
  }

  if (typeof document === 'undefined') {
    return '';
  }

  // רינדור פנימי תמיד ברזולוציה גבוהה (לפחות 256x256) לקבלת חדות מקסימלית
  const renderSize = Math.max(INTERNAL_RES, size);
  const canvas = document.createElement('canvas');
  canvas.width = renderSize;
  canvas.height = renderSize;
  const ctx = canvas.getContext('2d');

  ctx.save();
  const scale = renderSize / INTERNAL_RES;
  ctx.scale(scale, scale);

  const rng = makeRng(seed);
  const profile = resolveProfile(id, cls, gender, rng);

  // 1. רקע דרמטי עשיר עם סצנה, תאורה אטמוספרית ומשיכות מכחול
  drawPainterlyBackdrop(ctx, id, cls, rng, profile);

  // 2. שיער אחורי וגלימה אחורית לפני הכתפיים והראש
  drawBackCloakAndHair(ctx, id, cls, gender, rng, profile);

  // 3. צווארנטומיה ומבנה צוואר וכתפיים
  drawNeckAndCollarbone(ctx, id, cls, gender, rng, profile);

  // 4. שריון, גלימות, מגני כתפיים (Pauldrons), תכשיטים וסמלים
  drawArmorAndVestments(ctx, id, cls, gender, rng, profile);

  // 5. פנים אנטומיים מפוסלים בתאורת קיארוסקורו (3/4 View)
  drawSculptedHeadAndFace(ctx, id, cls, gender, rng, profile);

  // 6. אפקטי קסם קדמיים, תאורת קצה (Rim Light) וטקסטורת בד ציור שמן
  drawAtmosphereAndCanvasTexture(ctx, id, cls, rng, profile);

  // 7. מסגרת זהב עתיקה משופעת עם פינות פיליגרן ואבני חן
  drawOrnateGoldFrame(ctx, cls, profile);

  ctx.restore();

  const dataUrl = canvas.toDataURL('image/png');
  PORTRAIT_CACHE.set(cacheKey, dataUrl);
  return dataUrl;
}

// ============================================================================
//  1. רקע ציורי לפי מחלקה וגיבור (256x256)
// ============================================================================
function drawPainterlyBackdrop(ctx, id, cls, rng, profile) {
  ctx.save();

  // גרדיאנט שמיים עמוק
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 256);
  if (cls === 'knight') {
    skyGrad.addColorStop(0, '#0f2547');
    skyGrad.addColorStop(0.42, '#28558c');
    skyGrad.addColorStop(0.75, '#7c788c');
    skyGrad.addColorStop(1, '#d99b52');
  } else if (cls === 'cleric') {
    skyGrad.addColorStop(0, '#131638');
    skyGrad.addColorStop(0.38, '#3b2d6e');
    skyGrad.addColorStop(0.72, '#9e6b58');
    skyGrad.addColorStop(1, '#f5c76b');
  } else if (cls === 'deathKnight') {
    skyGrad.addColorStop(0, '#090306');
    skyGrad.addColorStop(0.45, '#290810');
    skyGrad.addColorStop(0.8, '#591218');
    skyGrad.addColorStop(1, '#8c2318');
  } else {
    skyGrad.addColorStop(0, '#05040d');
    skyGrad.addColorStop(0.45, '#150d2a');
    skyGrad.addColorStop(0.8, '#132e2b');
    skyGrad.addColorStop(1, '#104538');
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 256, 256);

  // עננים ציוריים ברקע (משיכות מכחול רכות)
  for (let i = 0; i < 18; i++) {
    const cx = rng() * 256;
    const cy = 20 + rng() * 145;
    const rx = 28 + rng() * 55;
    const ry = 10 + rng() * 22;
    const cloudGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
    if (cls === 'knight') {
      cloudGrad.addColorStop(0, 'rgba(255, 232, 185, 0.16)');
      cloudGrad.addColorStop(1, 'rgba(255, 232, 185, 0)');
    } else if (cls === 'cleric') {
      cloudGrad.addColorStop(0, 'rgba(255, 240, 175, 0.18)');
      cloudGrad.addColorStop(1, 'rgba(180, 130, 230, 0)');
    } else if (cls === 'deathKnight') {
      cloudGrad.addColorStop(0, 'rgba(180, 35, 35, 0.16)');
      cloudGrad.addColorStop(1, 'rgba(20, 5, 10, 0)');
    } else {
      cloudGrad.addColorStop(0, 'rgba(74, 222, 128, 0.13)');
      cloudGrad.addColorStop(1, 'rgba(88, 28, 135, 0)');
    }
    ctx.fillStyle = cloudGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, (rng() - 0.5) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (cls === 'knight') {
    // הרים רחוקים באופק
    ctx.fillStyle = 'rgba(24, 42, 74, 0.65)';
    ctx.beginPath();
    ctx.moveTo(0, 180);
    ctx.lineTo(38, 128);
    ctx.lineTo(76, 156);
    ctx.lineTo(135, 118);
    ctx.lineTo(190, 152);
    ctx.lineTo(230, 122);
    ctx.lineTo(256, 148);
    ctx.lineTo(256, 256);
    ctx.lineTo(0, 256);
    ctx.closePath();
    ctx.fill();

    // שמש זהובה קורנת בפינה העליונה
    const sunX = profile.turn > 0 ? 52 : 204;
    const sunGrad = ctx.createRadialGradient(sunX, 54, 4, sunX, 54, 85);
    sunGrad.addColorStop(0, 'rgba(255, 250, 215, 0.85)');
    sunGrad.addColorStop(0.35, 'rgba(253, 210, 115, 0.38)');
    sunGrad.addColorStop(1, 'rgba(253, 210, 115, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, 256, 256);

    // מגדל מבצר עם שיניות (Crenellations)
    const towerX = profile.turn > 0 ? 196 : 22;
    const towerGrad = ctx.createLinearGradient(towerX, 65, towerX + 38, 195);
    towerGrad.addColorStop(0, '#475569');
    towerGrad.addColorStop(0.5, '#334155');
    towerGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = towerGrad;
    ctx.fillRect(towerX, 74, 38, 130);
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(towerX - 2 + i * 11, 65, 7, 11);
    }
    // חלון חרך ירי מואר
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(towerX + 16, 96, 5, 18);

    // דגל מלכותי מתנופף ברוח
    const bannerX = profile.turn > 0 ? 34 : 210;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bannerX, 24);
    ctx.lineTo(bannerX, 165);
    ctx.stroke();

    const dir = profile.turn > 0 ? 1 : -1;
    const flagGrad = ctx.createLinearGradient(bannerX, 30, bannerX + dir * 48, 85);
    flagGrad.addColorStop(0, shadeHex(profile.accent, 0.15));
    flagGrad.addColorStop(0.6, profile.accent);
    flagGrad.addColorStop(1, shadeHex(profile.accent, -0.35));
    ctx.fillStyle = flagGrad;
    ctx.beginPath();
    ctx.moveTo(bannerX, 30);
    ctx.bezierCurveTo(bannerX + dir * 22, 24, bannerX + dir * 34, 44, bannerX + dir * 52, 38);
    ctx.lineTo(bannerX + dir * 40, 58);
    ctx.lineTo(bannerX + dir * 54, 76);
    ctx.bezierCurveTo(bannerX + dir * 30, 82, bannerX + dir * 18, 68, bannerX, 82);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  } else if (cls === 'cleric') {
    // חלון רוזטה גותי / ויטראז' קדוש מאחורי הראש
    const cx = 128;
    const cy = 102;
    const halo = ctx.createRadialGradient(cx, cy, 10, cx, cy, 115);
    halo.addColorStop(0, 'rgba(255, 251, 215, 0.92)');
    halo.addColorStop(0.35, 'rgba(253, 215, 105, 0.52)');
    halo.addColorStop(0.7, 'rgba(217, 119, 6, 0.18)');
    halo.addColorStop(1, 'rgba(217, 119, 6, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 256, 256);

    // קרני אור שמימיות (God Rays)
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      ctx.save();
      ctx.rotate(angle);
      const rayGrad = ctx.createLinearGradient(0, 0, 130, 0);
      rayGrad.addColorStop(0, 'rgba(255, 248, 200, 0.28)');
      rayGrad.addColorStop(1, 'rgba(255, 248, 200, 0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(18, -3);
      ctx.lineTo(135, -14);
      ctx.lineTo(135, 14);
      ctx.lineTo(18, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // טבעות ויטראז' קתדרליות
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 76, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 82, Math.sin(a) * 82, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  } else if (cls === 'deathKnight') {
    // ירח דם עצום ומבצר גותי אפל
    const moonX = profile.turn > 0 ? 58 : 198;
    const moonY = 64;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 8, moonX, moonY, 72);
    moonGlow.addColorStop(0, 'rgba(255, 95, 95, 0.85)');
    moonGlow.addColorStop(0.4, 'rgba(220, 38, 38, 0.45)');
    moonGlow.addColorStop(1, 'rgba(127, 29, 29, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 72, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(254, 202, 202, 0.72)';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 26, 0, Math.PI * 2);
    ctx.fill();
    // מכתשי ירח דם
    ctx.fillStyle = 'rgba(185, 28, 28, 0.35)';
    ctx.beginPath();
    ctx.arc(moonX - 7, moonY - 5, 6, 0, Math.PI * 2);
    ctx.arc(moonX + 9, moonY + 7, 8, 0, Math.PI * 2);
    ctx.fill();

    // צללית מצודת נקרופוליס משוננת
    const keepX = profile.turn > 0 ? 186 : 16;
    ctx.fillStyle = '#0c0407';
    ctx.beginPath();
    ctx.moveTo(keepX, 210);
    ctx.lineTo(keepX + 6, 86);
    ctx.lineTo(keepX + 14, 58);
    ctx.lineTo(keepX + 22, 86);
    ctx.lineTo(keepX + 32, 72);
    ctx.lineTo(keepX + 42, 48);
    ctx.lineTo(keepX + 50, 86);
    ctx.lineTo(keepX + 56, 210);
    ctx.closePath();
    ctx.fill();

    // חלונות בוערים במצודה
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(keepX + 25, 102, 4, 14);
    ctx.fillRect(keepX + 35, 108, 4, 12);
  } else {
    // נקרומנסר — קשתות קריפטה גותיות, ירח חיוור וערפל נשמות מתערבל
    const mist = ctx.createRadialGradient(128, 118, 16, 128, 118, 122);
    mist.addColorStop(0, withAlpha(profile.rimLight || '#4ade80', 0.42));
    mist.addColorStop(0.55, 'rgba(126, 34, 206, 0.28)');
    mist.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, 256, 256);

    // קשתות קריפטה אפלות ברקע
    ctx.strokeStyle = 'rgba(30, 20, 48, 0.85)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(22, 220);
    ctx.lineTo(22, 95);
    ctx.quadraticCurveTo(22, 24, 128, 16);
    ctx.quadraticCurveTo(234, 24, 234, 95);
    ctx.lineTo(234, 220);
    ctx.stroke();

    // שובלי ערפל נקרומנטי מתפתלים
    for (let i = 0; i < 6; i++) {
      const y0 = 60 + i * 28;
      ctx.strokeStyle = withAlpha(profile.eyeGlow || '#4ade80', 0.14 + (i % 2) * 0.08);
      ctx.lineWidth = 6 + i * 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(10, y0);
      ctx.bezierCurveTo(85, y0 - 28, 165, y0 + 28, 246, y0 - 12);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ============================================================================
//  עזר: ציור קווצות שיער בסגנון משיכות מכחול (Painterly Hair Strands)
// ============================================================================
function drawHairRibbon(ctx, x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1, width, baseColor, hiColor, shadowColor) {
  ctx.save();
  ctx.lineCap = 'round';

  // שכבת צל עמוקה
  ctx.strokeStyle = shadowColor;
  ctx.lineWidth = width * 1.15;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x1, y1);
  ctx.stroke();

  // שכבת בסיס
  ctx.strokeStyle = baseColor;
  ctx.lineWidth = width * 0.85;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.bezierCurveTo(cp1x - 1, cp1y, cp2x - 1, cp2y, x1, y1);
  ctx.stroke();

  // סיבי שיער (טקסטורת מברשת)
  ctx.strokeStyle = shadeHex(baseColor, -0.22, 0.7);
  ctx.lineWidth = Math.max(1.2, width * 0.18);
  for (let o = -0.32; o <= 0.32; o += 0.32) {
    const ox = o * width;
    ctx.beginPath();
    ctx.moveTo(x0 + ox * 0.5, y0);
    ctx.bezierCurveTo(cp1x + ox, cp1y, cp2x - ox, cp2y, x1 + ox * 0.4, y1);
    ctx.stroke();
  }

  // ברק ספקולרי (Anisotropic Hair Sheen)
  ctx.strokeStyle = withAlpha(hiColor, 0.58);
  ctx.lineWidth = Math.max(1.5, width * 0.25);
  ctx.beginPath();
  ctx.moveTo(x0 - width * 0.12, y0 + 2);
  ctx.bezierCurveTo(cp1x - width * 0.18, cp1y, cp2x - width * 0.12, cp2y, x1, y1 - 2);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
//  2. גלימה אחורית ושיער אחורי (לפני הכתפיים והפנים)
// ============================================================================
function drawBackCloakAndHair(ctx, id, cls, gender, rng, profile) {
  ctx.save();
  const turn = profile.turn || 1;
  const cx = 128 + turn * 3;

  // הילה אחורית של קונטרסט מאחורי הדמות (Chiaroscuro Backdrop Separation)
  const backGlow = ctx.createRadialGradient(cx, 118, 22, cx, 118, 95);
  backGlow.addColorStop(0, 'rgba(0, 0, 0, 0.48)');
  backGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = backGlow;
  ctx.fillRect(0, 0, 256, 256);

  // גלימה אחורית מתנפנפת
  const cloakGrad = ctx.createLinearGradient(30, 155, 226, 256);
  cloakGrad.addColorStop(0, shadeHex(profile.cloakColor, 0.15));
  cloakGrad.addColorStop(0.5, profile.cloakColor);
  cloakGrad.addColorStop(1, shadeHex(profile.cloakColor, -0.45));
  ctx.fillStyle = cloakGrad;
  ctx.beginPath();
  ctx.moveTo(18, 256);
  ctx.bezierCurveTo(26, 182, 58, 158, 86, 156);
  ctx.lineTo(170, 156);
  ctx.bezierCurveTo(198, 158, 230, 182, 238, 256);
  ctx.closePath();
  ctx.fill();

  // ברדס אחורי עמוק (לנקרומנסרים או אלישע)
  if (profile.helm === 'cowl' || profile.helm === 'hoodLight' || profile.helm === 'veil') {
    const hoodColor = profile.helm === 'hoodLight' ? '#e2e8f0' : profile.helm === 'veil' ? '#bae6fd' : profile.cloakColor;
    const hoodGrad = ctx.createRadialGradient(cx, 96, 18, cx, 96, 74);
    hoodGrad.addColorStop(0, shadeHex(hoodColor, -0.55));
    hoodGrad.addColorStop(0.75, hoodColor);
    hoodGrad.addColorStop(1, shadeHex(hoodColor, -0.35));
    ctx.fillStyle = hoodGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 58, 174);
    ctx.bezierCurveTo(cx - 72, 110, cx - 54, 42, cx, 36);
    ctx.bezierCurveTo(cx + 54, 42, cx + 72, 110, cx + 58, 174);
    ctx.closePath();
    ctx.fill();
  }

  // שיער אחורי שופע (לנשים או לגברים בעלי שיער ארוך כגון שמשון, שמואל, אשמדאי, סמאל)
  const longStyles = ['nazariteLocks', 'windBraids', 'prophetessLocks', 'auburnWaves', 'prophetMane', 'aristocratLong', 'nightCurls', 'witchBraids', 'wraithLocks', 'sirenWaves'];
  if (gender === 'f' || longStyles.includes(profile.hairStyle)) {
    const hBase = profile.hair;
    const hHi = profile.hairHi;
    const hDark = shadeHex(hBase, -0.45);

    // נפח שיער אחורי מרכזי
    ctx.fillStyle = hDark;
    ctx.beginPath();
    ctx.moveTo(cx - 42, 74);
    ctx.bezierCurveTo(cx - 64, 120, cx - 60, 172, cx - 48, 210);
    ctx.lineTo(cx + 48, 210);
    ctx.bezierCurveTo(cx + 60, 172, cx + 64, 120, cx + 42, 74);
    ctx.closePath();
    ctx.fill();

    // קווצות שיער מדורגות משני הצדדים
    const strandsLeft = [
      [cx - 36, 76, cx - 58, 112, cx - 56, 156, cx - 44, 198, 18],
      [cx - 30, 84, cx - 48, 124, cx - 52, 168, cx - 36, 206, 15],
      [cx - 40, 96, cx - 64, 138, cx - 58, 178, cx - 52, 204, 14],
    ];
    const strandsRight = [
      [cx + 36, 76, cx + 58, 112, cx + 56, 156, cx + 44, 198, 18],
      [cx + 30, 84, cx + 48, 124, cx + 52, 168, cx + 36, 206, 15],
      [cx + 40, 96, cx + 64, 138, cx + 58, 178, cx + 52, 204, 14],
    ];
    for (const s of strandsLeft) {
      drawHairRibbon(ctx, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], hBase, hHi, hDark);
    }
    for (const s of strandsRight) {
      drawHairRibbon(ctx, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], hBase, hHi, hDark);
    }

    // לשמשון: שבע מחלפות ראשו העבות על הכתפיים עם חבקי זהב
    if (profile.hairStyle === 'nazariteLocks') {
      const braidCoords = [
        [cx - 38, 110, cx - 54, 152, cx - 48, 196, cx - 42, 228],
        [cx - 28, 118, cx - 40, 160, cx - 36, 202, cx - 30, 234],
        [cx + 28, 118, cx + 40, 160, cx + 36, 202, cx + 30, 234],
        [cx + 38, 110, cx + 54, 152, cx + 48, 196, cx + 42, 228],
      ];
      for (const b of braidCoords) {
        drawHairRibbon(ctx, b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], 13, hBase, hHi, hDark);
        // חבק זהב על המחלפה
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse((b[4] + b[6]) * 0.5, (b[5] + b[7]) * 0.5 - 8, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

// ============================================================================
//  3. צוואר ושרירי צוואר אנטומיים (Sternocleidomastoid & Throat Shading)
// ============================================================================
function drawNeckAndCollarbone(ctx, id, cls, gender, rng, profile) {
  ctx.save();
  const turn = profile.turn || 1;
  const cx = 128 + turn * 3;
  const neckW = gender === 'f' ? 19 : 25;

  const neckGrad = ctx.createLinearGradient(cx - neckW, 138, cx + neckW, 178);
  neckGrad.addColorStop(0, profile.skinHighlight);
  neckGrad.addColorStop(0.45, profile.skin);
  neckGrad.addColorStop(1, profile.skinShadow);

  ctx.fillStyle = neckGrad;
  ctx.beginPath();
  ctx.moveTo(cx - neckW, 134);
  ctx.quadraticCurveTo(cx - neckW - 2, 162, cx - neckW - 14, 184);
  ctx.lineTo(cx + neckW + 14, 184);
  ctx.quadraticCurveTo(cx + neckW + 2, 162, cx + neckW, 134);
  ctx.closePath();
  ctx.fill();

  // הצללת גיד הצוואר (Sternocleidomastoid)
  ctx.strokeStyle = withAlpha(profile.skinShadow, 0.45);
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - neckW * 0.65, 140);
  ctx.quadraticCurveTo(cx - neckW * 0.25, 162, cx - 4, 180);
  ctx.moveTo(cx + neckW * 0.65, 140);
  ctx.quadraticCurveTo(cx + neckW * 0.25, 162, cx + 4, 180);
  ctx.stroke();

  // צל עמוק מתחת לסנטר והלסת (Cast Shadow from Jaw)
  const jawShadow = ctx.createRadialGradient(cx + turn * 3, 146, 4, cx + turn * 3, 152, neckW * 1.25);
  jawShadow.addColorStop(0, 'rgba(10, 5, 8, 0.68)');
  jawShadow.addColorStop(0.55, withAlpha(profile.skinShadow, 0.52));
  jawShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = jawShadow;
  ctx.beginPath();
  ctx.ellipse(cx + turn * 2, 150, neckW * 1.15, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
//  4. שריון, גלימות, מגני כתפיים (Pauldrons) וסמלים ייחודיים
// ============================================================================
function drawArmorAndVestments(ctx, id, cls, gender, rng, profile) {
  ctx.save();
  const turn = profile.turn || 1;
  const cx = 128 + turn * 2;

  if (cls === 'knight') {
    // חולצת שרשראות (Chainmail Coif/Neck) מתחת לשריון
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(cx - 38, 164);
    ctx.quadraticCurveTo(cx, 182, cx + 38, 164);
    ctx.lineTo(cx + 46, 192);
    ctx.lineTo(cx - 46, 192);
    ctx.closePath();
    ctx.fill();
    // טקסטורת טבעות שרשראות
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.35)';
    ctx.lineWidth = 1;
    for (let y = 168; y < 188; y += 4) {
      for (let x = cx - 34; x < cx + 34; x += 5) {
        ctx.beginPath();
        ctx.arc(x + ((y % 8) ? 2 : 0), y, 2.2, 0, Math.PI);
        ctx.stroke();
      }
    }

    // לוח חזה מפלדה מלוטשת (Cuirass)
    const steelGrad = ctx.createLinearGradient(44, 166, 212, 256);
    steelGrad.addColorStop(0, '#f8fafc');
    steelGrad.addColorStop(0.28, '#cbd5e1');
    steelGrad.addColorStop(0.62, '#64748b');
    steelGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = steelGrad;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(38, 256);
    ctx.lineTo(56, 172);
    ctx.quadraticCurveTo(cx, 186, 200, 172);
    ctx.lineTo(218, 256);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // טבארד (Surcoat) עשיר במרכז החזה עם קפלי בד
    const tabardGrad = ctx.createLinearGradient(cx - 42, 174, cx + 42, 256);
    tabardGrad.addColorStop(0, shadeHex(profile.accent, 0.18));
    tabardGrad.addColorStop(0.5, profile.accent);
    tabardGrad.addColorStop(1, shadeHex(profile.accent, -0.42));
    ctx.fillStyle = tabardGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 38, 175);
    ctx.quadraticCurveTo(cx, 188, cx + 38, 175);
    ctx.lineTo(cx + 32, 256);
    ctx.lineTo(cx - 32, 256);
    ctx.closePath();
    ctx.fill();

    // שולי זהב רקומים לטבארד
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // סמל אבירים מוזהב במרכז החזה
    drawChestEmblem(ctx, cx, 214, profile.emblem, '#fde047', '#b45309');

    // רצועות עור ואבזמים
    ctx.fillStyle = '#451a03';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.4;
    ctx.fillRect(cx - 46, 182, 14, 24);
    ctx.strokeRect(cx - 46, 182, 14, 24);
    ctx.fillRect(cx + 32, 182, 14, 24);
    ctx.strokeRect(cx + 32, 182, 14, 24);

    // מגני כתפיים (Layered Steel & Gold Pauldrons)
    const drawKnightPauldron = (px, py, side) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(side, 1);

      if (profile.pauldronStyle === 'lionPelt') {
        // פרוות אריה עבותה לשמשון
        for (let i = 0; i < 14; i++) {
          const ang = (i / 14) * Math.PI * 1.2 - 0.3;
          ctx.fillStyle = i % 2 === 0 ? '#b45309' : '#78350f';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(Math.cos(ang) * 28, Math.sin(ang) * 24, Math.cos(ang + 0.18) * 44, Math.sin(ang + 0.18) * 36);
          ctx.lineTo(Math.cos(ang - 0.15) * 30, Math.sin(ang - 0.15) * 26);
          ctx.closePath();
          ctx.fill();
        }
      }

      // 3 שכבות פלדה מדורגות
      for (let layer = 2; layer >= 0; layer--) {
        const ly = layer * 9;
        const pGrad = ctx.createRadialGradient(-10, ly - 10, 4, 0, ly, 42);
        if (profile.pauldronStyle === 'lionGold') {
          pGrad.addColorStop(0, '#fef08a');
          pGrad.addColorStop(0.5, '#d97706');
          pGrad.addColorStop(1, '#78350f');
        } else {
          pGrad.addColorStop(0, '#ffffff');
          pGrad.addColorStop(0.45, '#94a3b8');
          pGrad.addColorStop(1, '#1e293b');
        }
        ctx.fillStyle = pGrad;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(2, ly, 36 - layer * 3, 20 - layer * 2, 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // מסמרות זהב (Rivets)
        ctx.fillStyle = '#fde68a';
        for (let r = -20; r <= 20; r += 10) {
          ctx.beginPath();
          ctx.arc(r, ly + 4, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    };
    drawKnightPauldron(46, 198, -1);
    drawKnightPauldron(210, 198, 1);

  } else if (cls === 'cleric') {
    // גלימות כהונה לבנות-זהובות מפוארות עם רקמה קדושה
    const robeGrad = ctx.createLinearGradient(36, 168, 220, 256);
    robeGrad.addColorStop(0, '#ffffff');
    robeGrad.addColorStop(0.55, '#e2e8f0');
    robeGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = robeGrad;
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(28, 256);
    ctx.bezierCurveTo(38, 184, 68, 168, 94, 166);
    ctx.quadraticCurveTo(cx, 184, 162, 166);
    ctx.bezierCurveTo(188, 168, 218, 184, 228, 256);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // צווארון גבוה מלכותי מוזהב
    const collarGrad = ctx.createLinearGradient(cx - 48, 152, cx + 48, 182);
    collarGrad.addColorStop(0, '#fef08a');
    collarGrad.addColorStop(0.5, '#d97706');
    collarGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = collarGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 44, 170);
    ctx.quadraticCurveTo(cx - 52, 152, cx - 34, 148);
    ctx.quadraticCurveTo(cx, 178, cx + 34, 148);
    ctx.quadraticCurveTo(cx + 52, 152, cx + 44, 170);
    ctx.quadraticCurveTo(cx, 188, cx - 44, 170);
    ctx.closePath();
    ctx.fill();

    // סטולה (Stole) מוזהבת עם עיטורים
    ctx.fillStyle = '#d97706';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.8;
    const drawStoleBand = (sx, ex) => {
      ctx.beginPath();
      ctx.moveTo(sx, 168);
      ctx.lineTo(sx + (ex > sx ? 24 : -24), 168);
      ctx.lineTo(ex + (ex > sx ? 16 : -16), 256);
      ctx.lineTo(ex - (ex > sx ? 12 : -12), 256);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    drawStoleBand(cx - 42, cx - 54);
    drawStoleBand(cx + 42, cx + 54);

    if (profile.emblem === 'hoshen') {
      // חושן המשפט לשמואל הנביא (12 אבני חן זוהרות במסגרת זהב)
      ctx.fillStyle = '#b45309';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.2;
      ctx.fillRect(cx - 24, 192, 48, 42);
      ctx.strokeRect(cx - 24, 192, 48, 42);
      const gemColors = ['#ef4444', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#84cc16', '#14b8a6', '#6366f1', '#f43f5e'];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          ctx.fillStyle = gemColors[r * 4 + c];
          ctx.beginPath();
          ctx.rect(cx - 19 + c * 10.5, 197 + r * 11.5, 7.5, 8);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.65)';
          ctx.fillRect(cx - 18 + c * 10.5, 198 + r * 11.5, 2.5, 2.5);
        }
      }
    } else {
      // קמע חן קדוש זוהר במרכז החזה
      const amuletGlow = ctx.createRadialGradient(cx, 198, 2, cx, 198, 24);
      amuletGlow.addColorStop(0, '#ffffff');
      amuletGlow.addColorStop(0.4, profile.accent);
      amuletGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = amuletGlow;
      ctx.beginPath();
      ctx.arc(cx, 198, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(cx, 198, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = profile.accent;
      ctx.beginPath();
      ctx.arc(cx, 198, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 3, 195, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (cls === 'deathKnight') {
    // שריון לוחות גותי שחור-אובסידיאן משונן עם רונות זוהרות
    const dkGrad = ctx.createLinearGradient(40, 168, 216, 256);
    dkGrad.addColorStop(0, '#475569');
    dkGrad.addColorStop(0.35, '#1e293b');
    dkGrad.addColorStop(0.7, '#0f172a');
    dkGrad.addColorStop(1, '#020617');
    ctx.fillStyle = dkGrad;
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(32, 256);
    ctx.lineTo(52, 172);
    ctx.quadraticCurveTo(cx, 188, 204, 172);
    ctx.lineTo(224, 256);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // צלעות שריון גותיות ורונות דם/אש זוהרות
    ctx.strokeStyle = profile.rimLight;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const ry = 192 + i * 18;
      ctx.beginPath();
      ctx.moveTo(cx - 38 + i * 5, ry);
      ctx.quadraticCurveTo(cx, ry + 12, cx + 38 - i * 5, ry);
      ctx.stroke();
    }

    // מגני כתפיים גותיים עם קוצים וגולגולות
    const drawDkPauldron = (px, py, side) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(side, 1);

      const pGrad = ctx.createRadialGradient(-8, -8, 4, 0, 0, 44);
      pGrad.addColorStop(0, '#64748b');
      pGrad.addColorStop(0.45, '#1e293b');
      pGrad.addColorStop(1, '#020617');
      ctx.fillStyle = pGrad;
      ctx.strokeStyle = profile.secondary;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.ellipse(0, 4, 38, 22, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 3 קוצים מעוקלים חדים
      const spikes = [[-16, -8, -32, -46, -2, -16], [4, -12, -4, -52, 18, -14], [22, -4, 34, -36, 32, 6]];
      for (const sp of spikes) {
        const spGrad = ctx.createLinearGradient(sp[0], sp[1], sp[2], sp[3]);
        spGrad.addColorStop(0, '#334155');
        spGrad.addColorStop(0.7, '#cbd5e1');
        spGrad.addColorStop(1, profile.rimLight);
        ctx.fillStyle = spGrad;
        ctx.beginPath();
        ctx.moveTo(sp[0], sp[1]);
        ctx.lineTo(sp[2], sp[3]);
        ctx.lineTo(sp[4], sp[5]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    };
    drawDkPauldron(46, 198, -1);
    drawDkPauldron(210, 198, 1);

    // אבן נשמה בוערת במרכז החזה
    drawChestEmblem(ctx, cx, 212, profile.emblem, profile.rimLight, '#450a0a');

  } else {
    // נקרומנסר — גלימות קטיפה אפלות, צווארון עצמות וקמע גולגולת זוהר
    const necroGrad = ctx.createLinearGradient(36, 166, 220, 256);
    necroGrad.addColorStop(0, shadeHex(profile.cloakColor, 0.22));
    necroGrad.addColorStop(0.5, profile.cloakColor);
    necroGrad.addColorStop(1, '#030108');
    ctx.fillStyle = necroGrad;
    ctx.strokeStyle = profile.accent;
    ctx.lineWidth = 2.4;

    ctx.beginPath();
    ctx.moveTo(28, 256);
    ctx.bezierCurveTo(40, 180, 68, 166, 94, 164);
    ctx.quadraticCurveTo(cx, 186, 162, 164);
    ctx.bezierCurveTo(188, 166, 216, 180, 228, 256);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // צווארון מחודד וסיגילים מאגיים רקומים
    ctx.strokeStyle = withAlpha(profile.rimLight, 0.7);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - 48, 168);
    ctx.lineTo(cx - 26, 256);
    ctx.moveTo(cx + 48, 168);
    ctx.lineTo(cx + 26, 256);
    ctx.stroke();

    // צלעות עצם מעוקלות על הכתפיים
    ctx.fillStyle = '#d8dee9';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.4;
    for (let side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(cx + side * (52 + i * 14), 184 + i * 10, 14, 5, side * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // קמע גולגולת ואבן נשמה במרכז הצוואר
    const skullGlow = ctx.createRadialGradient(cx, 198, 2, cx, 198, 28);
    skullGlow.addColorStop(0, withAlpha(profile.rimLight, 0.85));
    skullGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = skullGlow;
    ctx.beginPath();
    ctx.arc(cx, 198, 28, 0, Math.PI * 2);
    ctx.fill();

    // גולגולת מפוסלת
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, 195, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(cx - 6, 202, 12, 7);
    ctx.strokeRect(cx - 6, 202, 12, 7);

    // ארובות עיניים זוהרות בגולגולת
    ctx.fillStyle = profile.eyeGlow || profile.rimLight;
    ctx.beginPath();
    ctx.arc(cx - 4, 195, 3, 0, Math.PI * 2);
    ctx.arc(cx + 4, 195, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawChestEmblem(ctx, cx, cy, emblem, mainColor, darkColor) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = mainColor;
  ctx.strokeStyle = darkColor;
  ctx.lineWidth = 1.8;

  if (emblem === 'crossedSwords') {
    // חרבות שלובות ליואב שר הצבא
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * 0.65);
      ctx.fillRect(-2.5, -20, 5, 34);
      ctx.strokeRect(-2.5, -20, 5, 34);
      ctx.fillRect(-9, 6, 18, 4);
      ctx.restore();
    }
  } else if (emblem === 'lionHead' || emblem === 'lionSun') {
    // מגן אריה מלכותי לשמשון ובניהו
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(15, -10);
    ctx.lineTo(12, 10);
    ctx.lineTo(0, 19);
    ctx.lineTo(-12, 10);
    ctx.lineTo(-15, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.arc(0, -2, 6.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (emblem === 'bloodSkull' || emblem === 'demonCrown') {
    // סמל גולגולת/כתר דם לבליעל ואשמדאי
    ctx.beginPath();
    ctx.arc(0, -3, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-6, 5, 12, 8);
    ctx.fillStyle = '#090408';
    ctx.beginPath();
    ctx.arc(-4.5, -3, 3.2, 0, Math.PI * 2);
    ctx.arc(4.5, -3, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // שמש / כוכב הרלדי או רונת אש
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rOut = i % 2 === 0 ? 18 : 12;
      const rIn = 6;
      ctx.lineTo(Math.cos(a) * rOut, Math.sin(a) * rOut);
      ctx.lineTo(Math.cos(a + Math.PI / 8) * rIn, Math.sin(a + Math.PI / 8) * rIn);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-2, -2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ============================================================================
//  5. פנים אנטומיים מפוסלים בתאורת קיארוסקורו (Sculpted 3/4 Portrait Head)
// ============================================================================
function drawSculptedHeadAndFace(ctx, id, cls, gender, rng, profile) {
  ctx.save();
  const isUndead = cls === 'deathKnight' || cls === 'necromancer';
  const turn = profile.turn || 1; // 1 = פונה מעט ימינה, -1 = פונה מעט שמאלה
  const cx = 128 + turn * 4;
  const cy = 108;

  // ---- אוזניים מפורטות עם אפרכסת פנימית ----
  const drawEar = (ex, ey, side) => {
    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(side, 1);
    const earGrad = ctx.createLinearGradient(-6, -14, 8, 14);
    earGrad.addColorStop(0, profile.skinHighlight);
    earGrad.addColorStop(0.6, profile.skin);
    earGrad.addColorStop(1, profile.skinShadow);
    ctx.fillStyle = earGrad;
    ctx.strokeStyle = shadeHex(profile.skinShadow, -0.35);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 14.5, 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // קפל פנימי באוזן
    ctx.strokeStyle = withAlpha(profile.skinShadow, 0.75);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 4.2, -Math.PI * 0.4, Math.PI * 0.6);
    ctx.stroke();
    ctx.restore();
  };
  drawEar(cx - 43, cy + 4, -1);
  drawEar(cx + 43, cy + 4, 1);

  // ---- משטח הגולגולת, עצמות הלחיים, הלסת והסנטר (Anatomical Head Planes) ----
  ctx.save();
  ctx.beginPath();
  if (gender === 'f') {
    ctx.moveTo(cx - 40, cy - 22);
    ctx.bezierCurveTo(cx - 42, cy + 4, cx - 37, cy + 26, cx - 20, cy + 40);
    ctx.quadraticCurveTo(cx + turn * 2, cy + 49, cx + 20, cy + 40);
    ctx.bezierCurveTo(cx + 37, cy + 26, cx + 42, cy + 4, cx + 40, cy - 22);
    ctx.bezierCurveTo(cx + 38, cy - 54, cx - 38, cy - 54, cx - 40, cy - 22);
  } else {
    ctx.moveTo(cx - 42, cy - 24);
    ctx.lineTo(cx - 41, cy + 8);
    ctx.lineTo(cx - 33, cy + 31);
    ctx.lineTo(cx - 14, cy + 45);
    ctx.lineTo(cx + 14, cy + 45);
    ctx.lineTo(cx + 33, cy + 31);
    ctx.lineTo(cx + 41, cy + 8);
    ctx.lineTo(cx + 42, cy - 24);
    ctx.bezierCurveTo(cx + 40, cy - 56, cx - 40, cy - 56, cx - 42, cy - 24);
  }
  ctx.closePath();

  // תאורת 3/4 קיארוסקורו: אור ראשי משמאל-למעלה, צל עמוק בצד ימין-למטה
  const faceGrad = ctx.createRadialGradient(cx - 16, cy - 18, 8, cx + 8, cy + 6, 68);
  faceGrad.addColorStop(0, profile.skinHighlight);
  faceGrad.addColorStop(0.48, profile.skin);
  faceGrad.addColorStop(0.85, profile.skinShadow);
  faceGrad.addColorStop(1, shadeHex(profile.skinShadow, -0.35));
  ctx.fillStyle = faceGrad;
  ctx.fill();

  // Clip לכל השכבות הפנימיות של הפנים (עצמות לחיים, שקעי עיניים, תאורת קצה)
  ctx.clip();

  // שקע הרקות (Temple Hollows)
  ctx.fillStyle = withAlpha(profile.skinShadow, 0.35);
  ctx.beginPath();
  ctx.ellipse(cx - 36, cy - 14, 9, 16, 0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + 36, cy - 14, 9, 16, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // שקע מתחת לעצמות הלחיים (Cheekbone Hollows — חזק במיוחד לאל-מתים וללוחמים)
  const hollowAlpha = isUndead ? 0.52 : (gender === 'f' ? 0.22 : 0.34);
  ctx.fillStyle = withAlpha(profile.skinShadow, hollowAlpha);
  ctx.beginPath();
  ctx.moveTo(cx - 40, cy + 12);
  ctx.quadraticCurveTo(cx - 24, cy + 18, cx - 18, cy + 34);
  ctx.lineTo(cx - 42, cy + 32);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + 40, cy + 12);
  ctx.quadraticCurveTo(cx + 24, cy + 18, cx + 18, cy + 34);
  ctx.lineTo(cx + 42, cy + 32);
  ctx.closePath();
  ctx.fill();

  // חום תת-עורי על הלחיים והאף (Subsurface Scattering Warmth) או גוון סגול-אפרפר לאל-מתים
  const sssColor = isUndead ? 'rgba(88, 28, 135, 0.22)' : 'rgba(210, 65, 50, 0.18)';
  const drawCheekGlow = (gx, gy) => {
    const cg = ctx.createRadialGradient(gx, gy, 2, gx, gy, 18);
    cg.addColorStop(0, sssColor);
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(gx, gy, 18, 0, Math.PI * 2);
    ctx.fill();
  };
  drawCheekGlow(cx - 24, cy + 10);
  drawCheekGlow(cx + 24, cy + 10);

  // הדגשת אור על עצם הלחי המוארת והמצח
  const hiCheek = ctx.createRadialGradient(cx - 22, cy + 4, 1, cx - 22, cy + 4, 14);
  hiCheek.addColorStop(0, withAlpha(profile.skinHighlight, 0.55));
  hiCheek.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hiCheek;
  ctx.beginPath();
  ctx.arc(cx - 22, cy + 4, 14, 0, Math.PI * 2);
  ctx.fill();

  // תאורת קצה דרמטית (Colored Rim Light) לאורך קו הלסת והלחי הימנית
  const rimGrad = ctx.createLinearGradient(cx + 12, cy, cx + 44, cy + 36);
  rimGrad.addColorStop(0, 'rgba(0,0,0,0)');
  rimGrad.addColorStop(0.65, withAlpha(profile.rimLight, 0.12));
  rimGrad.addColorStop(1, withAlpha(profile.rimLight, 0.72));
  ctx.fillStyle = rimGrad;
  ctx.fillRect(cx, cy - 40, 50, 95);

  ctx.restore(); // סיום Clip הפנים

  // קו מתאר חיצוני מעודן לפנים
  ctx.strokeStyle = shadeHex(profile.skinShadow, -0.42, 0.85);
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // ---- צלקות קרב (Battle Scars) ----
  if (profile.scar) {
    ctx.save();
    const scarX = profile.scar === 'leftEye' ? cx - 19 : cx + 19;
    ctx.strokeStyle = 'rgba(120, 22, 28, 0.72)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(scarX - 4, cy - 18);
    ctx.quadraticCurveTo(scarX + 2, cy + 2, scarX + 5, cy + 22);
    ctx.stroke();
    // קו רקמה מצולקת בהיר לצד הצלקת
    ctx.strokeStyle = withAlpha(profile.skinHighlight, 0.48);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(scarX - 2.5, cy - 18);
    ctx.quadraticCurveTo(scarX + 3.5, cy + 2, scarX + 6.5, cy + 22);
    ctx.stroke();
    ctx.restore();
  }

  // ---- שקעי ארובות העיניים (Orbital Sockets) ----
  const eyeY = cy - 4;
  const leftEyeX = cx - 18 + turn * 1.5;
  const rightEyeX = cx + 18 + turn * 1.5;

  for (const ex of [leftEyeX, rightEyeX]) {
    const sockGrad = ctx.createRadialGradient(ex, eyeY, 2, ex, eyeY, 15);
    sockGrad.addColorStop(0, shadeHex(profile.skinShadow, -0.35, isUndead ? 0.78 : 0.48));
    sockGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sockGrad;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- עיניים מפורטות ומלאות הבעה ----
  const drawDetailedEye = (ex, ey, side) => {
    ctx.save();
    ctx.translate(ex, ey);

    // הילה קסומה מסביב לעין (לגיבורים עם eyeGlow)
    if (profile.eyeGlow) {
      const eg = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
      eg.addColorStop(0, withAlpha(profile.eyeGlow, 0.55));
      eg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // קפל העפעף העליון (Upper Eyelid Crease)
    ctx.strokeStyle = shadeHex(profile.skinShadow, -0.3, 0.75);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.quadraticCurveTo(0, -10.5, 10, -4);
    ctx.stroke();

    // לובן העין (Sclera) עם הצללה תלת-ממדית
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-10.5, 0.5);
    ctx.quadraticCurveTo(-2, -6.5, 10.5, -0.5);
    ctx.quadraticCurveTo(2, 6.2, -10.5, 0.5);
    ctx.closePath();

    const scleraGrad = ctx.createLinearGradient(0, -6, 0, 6);
    if (isUndead) {
      scleraGrad.addColorStop(0, '#090514');
      scleraGrad.addColorStop(0.5, '#1e162e');
      scleraGrad.addColorStop(1, '#33254a');
    } else {
      scleraGrad.addColorStop(0, '#94a3b8');
      scleraGrad.addColorStop(0.35, '#f8fafc');
      scleraGrad.addColorStop(1, '#cbd5e1');
    }
    ctx.fillStyle = scleraGrad;
    ctx.fill();
    ctx.clip();

    // קשתית העין (Multi-tonal Iris + Limbal Ring)
    const irisX = turn * 1.1;
    const irisGrad = ctx.createRadialGradient(irisX, -1, 0.8, irisX, 0, 5.4);
    irisGrad.addColorStop(0, shadeHex(profile.eye, 0.38));
    irisGrad.addColorStop(0.65, profile.eye);
    irisGrad.addColorStop(1, shadeHex(profile.eye, -0.55));
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(irisX, 0, 5.3, 0, Math.PI * 2);
    ctx.fill();

    // אישון (Pupil)
    ctx.fillStyle = isUndead && profile.eyeGlow ? '#ffffff' : '#09090b';
    ctx.beginPath();
    ctx.arc(irisX, 0, 2.3, 0, Math.PI * 2);
    ctx.fill();

    // צל עפעף עליון על גלגל העין
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(-12, -7, 24, 3.8);

    // ניצוץ חי בעין (Dual Catchlights)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(irisX - 1.8, -1.8, 1.5, 0, Math.PI * 2);
    ctx.arc(irisX + 1.6, 1.5, 0.75, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // סוף Clip העין

    // קו ריסים עליון ותחתון (Eyeliner & Lashes)
    ctx.strokeStyle = '#0f0705';
    ctx.lineWidth = gender === 'f' ? 2.4 : 1.9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-11, 0.5);
    ctx.quadraticCurveTo(-2, -6.8, 11, -0.5);
    ctx.stroke();

    // קו מים תחתון מואר (Lower Waterline)
    ctx.strokeStyle = withAlpha(profile.skinHighlight, 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-9, 1.2);
    ctx.quadraticCurveTo(0, 6.2, 9, 0.5);
    ctx.stroke();

    // שקית דמעות בקצה הפנימי (Tear Duct Caruncle)
    ctx.fillStyle = isUndead ? '#4c1d95' : '#be123c';
    ctx.beginPath();
    ctx.arc(side < 0 ? 9 : -9, 0.2, 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };
  drawDetailedEye(leftEyeX, eyeY, -1);
  drawDetailedEye(rightEyeX, eyeY, 1);

  // ---- גבות מפורטות עשויות משיכות שיער ----
  const drawEyebrow = (bx, by, side) => {
    ctx.save();
    const tilt = (profile.browTilt || 0.2) * 8;
    const browColor = shadeHex(profile.hair, -0.15);
    ctx.strokeStyle = browColor;
    ctx.lineWidth = gender === 'f' ? 2.8 : 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx - side * 12, by + tilt * 0.6);
    ctx.quadraticCurveTo(bx + side * 2, by - 5 - tilt * 0.2, bx + side * 12, by + 1.5);
    ctx.stroke();

    // שערות גבה בודדות למראה ריאליסטי
    ctx.strokeStyle = shadeHex(profile.hairHi, -0.1, 0.65);
    ctx.lineWidth = 1.1;
    for (let i = -4; i <= 4; i++) {
      const sx = bx + i * 2.4;
      ctx.beginPath();
      ctx.moveTo(sx, by + 1);
      ctx.lineTo(sx + side * 2, by - 2.5);
      ctx.stroke();
    }
    ctx.restore();
  };
  drawEyebrow(leftEyeX, eyeY - 9, -1);
  drawEyebrow(rightEyeX, eyeY - 9, 1);

  // ---- אף מפוסל בתלת-ממד (Bridge, Tip, Wings, Nostrils, Cast Shadow) ----
  const noseX = cx + turn * 3.5;
  const noseTopY = eyeY - 3;
  const noseBotY = cy + 16;

  // צל צדדי של גשר האף
  ctx.fillStyle = withAlpha(profile.skinShadow, 0.58);
  ctx.beginPath();
  ctx.moveTo(noseX + turn * 2, noseTopY);
  ctx.lineTo(noseX + turn * 9, noseBotY - 1);
  ctx.lineTo(noseX, noseBotY + 3);
  ctx.lineTo(noseX - turn * 2, noseTopY + 4);
  ctx.closePath();
  ctx.fill();

  // צל מתחת לקצה האף והנחיריים
  ctx.fillStyle = shadeHex(profile.skinShadow, -0.32, 0.72);
  ctx.beginPath();
  ctx.ellipse(noseX, noseBotY + 2.5, 9.5, 4.2, 0, 0, Math.PI);
  ctx.fill();

  // נחיריים
  ctx.fillStyle = '#1c0d08';
  ctx.beginPath();
  ctx.ellipse(noseX - 4.5, noseBotY + 1.5, 2.4, 1.3, 0.3, 0, Math.PI * 2);
  ctx.ellipse(noseX + 4.5, noseBotY + 1.5, 2.4, 1.3, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // אור על גשר האף וקצה האף (Nose Bridge & Tip Highlight)
  ctx.strokeStyle = withAlpha(profile.skinHighlight, 0.78);
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + turn * 1.5, noseTopY + 3);
  ctx.lineTo(noseX - turn * 1, noseBotY - 2);
  ctx.stroke();

  ctx.fillStyle = withAlpha(profile.skinHighlight, 0.85);
  ctx.beginPath();
  ctx.arc(noseX - turn * 0.8, noseBotY - 1.5, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // שקע מעל השפה העליונה (Philtrum)
  ctx.strokeStyle = withAlpha(profile.skinShadow, 0.5);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(noseX - 2, noseBotY + 3);
  ctx.lineTo(noseX - 2.5, noseBotY + 9);
  ctx.moveTo(noseX + 2, noseBotY + 3);
  ctx.lineTo(noseX + 2.5, noseBotY + 9);
  ctx.stroke();

  // ---- זקן ושפם מפוסלים במשיכות מכחול (לפני ואחרי הפה) ----
  const mouthY = cy + 28;
  const mouthX = cx + turn * 2.5;
  if (gender === 'm' && profile.beard && profile.beard !== 'none') {
    drawPainterlyBeardUnderlay(ctx, mouthX, mouthY, cy, profile);
  }

  // ---- שפתיים (Cupid's Bow, Upper Lip Shadow, Lower Lip Volume & Sheen) ----
  const lipW = gender === 'f' ? 14 : 15;
  const upperLipColor = gender === 'f'
    ? (isUndead ? '#701a46' : '#9f2c3f')
    : shadeHex(profile.skinShadow, -0.2);
  const lowerLipColor = gender === 'f'
    ? (isUndead ? '#9d174d' : '#c84b5f')
    : mixHex(profile.skin, '#9f3a38', 0.45);

  // שפה עליונה (תמיד מוצלת יותר כי היא פונה כלפי מטה)
  ctx.fillStyle = upperLipColor;
  ctx.beginPath();
  ctx.moveTo(mouthX - lipW, mouthY);
  ctx.quadraticCurveTo(mouthX - lipW * 0.45, mouthY - 4.8, mouthX, mouthY - 2.5);
  ctx.quadraticCurveTo(mouthX + lipW * 0.45, mouthY - 4.8, mouthX + lipW, mouthY);
  ctx.quadraticCurveTo(mouthX, mouthY + 1.5, mouthX - lipW, mouthY);
  ctx.closePath();
  ctx.fill();

  // שפה תחתונה מלאה
  ctx.fillStyle = lowerLipColor;
  ctx.beginPath();
  ctx.moveTo(mouthX - lipW * 0.92, mouthY);
  ctx.quadraticCurveTo(mouthX, mouthY + 8.5, mouthX + lipW * 0.92, mouthY);
  ctx.quadraticCurveTo(mouthX, mouthY + 1.5, mouthX - lipW * 0.92, mouthY);
  ctx.closePath();
  ctx.fill();

  // ברק על השפה התחתונה
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.beginPath();
  ctx.ellipse(mouthX - 2, mouthY + 3.2, 5.5, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // קו החיוך/הבעה בין השפתיים
  const cornerLift = profile.expression === 'cunning' || profile.expression === 'gentle' ? -1.8 : profile.expression === 'fierce' ? 1.8 : 0;
  ctx.strokeStyle = '#1f0a0c';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(mouthX - lipW - 1, mouthY + cornerLift);
  ctx.quadraticCurveTo(mouthX, mouthY + 1.2, mouthX + lipW + 1, mouthY + cornerLift);
  ctx.stroke();

  // צל מתחת לשפה התחתונה וגומת סנטר
  ctx.fillStyle = withAlpha(profile.skinShadow, 0.55);
  ctx.beginPath();
  ctx.ellipse(mouthX, mouthY + 7.5, 8, 2.5, 0, 0, Math.PI);
  ctx.fill();

  // שכבת שפם וזקן עליונה
  if (gender === 'm' && profile.beard && profile.beard !== 'none') {
    drawPainterlyBeardOverlay(ctx, mouthX, mouthY, cy, profile);
  }

  // ---- שיער קדמי ופאות (Forelocks, Bangs & Sideburns) ----
  drawFrontHair(ctx, cx, cy, gender, profile);

  // ---- קסדה, כתר, נזר, הינומה או ברדס ----
  drawOrnateHeadgear(ctx, id, cls, cx, cy, gender, profile);

  ctx.restore();
}

// ============================================================================
//  עזר: ציור זקנים עשירים במשיכות מכחול
// ============================================================================
function drawPainterlyBeardUnderlay(ctx, mx, my, cy, profile) {
  const bType = profile.beard;
  const hBase = profile.hair;
  const hHi = profile.hairHi;
  const hDark = shadeHex(hBase, -0.45);

  ctx.save();
  if (bType === 'royalTrim' || bType === 'goatee' || bType === 'imperial') {
    // זקנקן מלכותי מדויק סביב הסנטר
    ctx.fillStyle = hDark;
    ctx.beginPath();
    ctx.moveTo(mx - 18, my + 2);
    ctx.quadraticCurveTo(mx, my + 6, mx + 18, my + 2);
    ctx.lineTo(mx + 13, my + 24);
    ctx.quadraticCurveTo(mx, my + 32, mx - 13, my + 24);
    ctx.closePath();
    ctx.fill();
  } else {
    // זקן מלא / זקן נביא ארוך
    const len = (bType === 'patriarch' || bType === 'heroicLong' || bType === 'sageLong') ? 66 : 36;
    ctx.fillStyle = hDark;
    ctx.beginPath();
    ctx.moveTo(mx - 39, cy + 8);
    ctx.quadraticCurveTo(mx - 24, my - 2, mx, my - 2);
    ctx.quadraticCurveTo(mx + 24, my - 2, mx + 39, cy + 8);
    ctx.bezierCurveTo(mx + 42, my + len * 0.6, mx + 26, my + len, mx, my + len + 8);
    ctx.bezierCurveTo(mx - 26, my + len, mx - 42, my + len * 0.6, mx - 39, cy + 8);
    ctx.closePath();
    ctx.fill();

    // קווצות שיער בזקן
    for (let i = -3; i <= 3; i++) {
      const sx = mx + i * 9;
      drawHairRibbon(
        ctx,
        sx, my + 4,
        sx + i * 3, my + len * 0.45,
        sx - i * 2, my + len * 0.8,
        sx + i * 1.5, my + len + 4 - Math.abs(i) * 3,
        10, hBase, hHi, hDark
      );
    }
  }
  ctx.restore();
}

function drawPainterlyBeardOverlay(ctx, mx, my, cy, profile) {
  const hBase = profile.hair;
  const hHi = profile.hairHi;
  const hDark = shadeHex(hBase, -0.45);

  ctx.save();
  // שפם מסוגנן מעל הפה
  drawHairRibbon(ctx, mx - 1, my - 4, mx - 10, my - 7, mx - 18, my - 1, mx - 24, my + 5, 6.5, hBase, hHi, hDark);
  drawHairRibbon(ctx, mx + 1, my - 4, mx + 10, my - 7, mx + 18, my - 1, mx + 24, my + 5, 6.5, hBase, hHi, hDark);

  // זקנקן מתחת לשפה התחתונה (Soul Patch & Chin Tuft)
  drawHairRibbon(ctx, mx, my + 7, mx - 2, my + 15, mx + 2, my + 20, mx, my + 26, 8, hBase, hHi, hDark);
  ctx.restore();
}

// ============================================================================
//  עזר: שיער קדמי ומסגור הפנים
// ============================================================================
function drawFrontHair(ctx, cx, cy, gender, profile) {
  const hBase = profile.hair;
  const hHi = profile.hairHi;
  const hDark = shadeHex(hBase, -0.45);

  ctx.save();
  if (profile.hairStyle === 'recedingSage') {
    // פאות ורקות מכסיפות של אלישע הנביא
    drawHairRibbon(ctx, cx - 34, cy - 30, cx - 44, cy - 16, cx - 43, cy + 2, cx - 40, cy + 16, 12, hBase, hHi, hDark);
    drawHairRibbon(ctx, cx + 34, cy - 30, cx + 44, cy - 16, cx + 43, cy + 2, cx + 40, cy + 16, 12, hBase, hHi, hDark);
    ctx.restore();
    return;
  }

  // קו שיער עליון ומסגור הרקות
  drawHairRibbon(ctx, cx - 2, cy - 46, cx - 26, cy - 48, cx - 42, cy - 28, cx - 41, cy - 2, 16, hBase, hHi, hDark);
  drawHairRibbon(ctx, cx + 2, cy - 46, cx + 26, cy - 48, cx + 42, cy - 28, cx + 41, cy - 2, 16, hBase, hHi, hDark);

  // תלתלים או קווצות שיער קדמיות הנופלות לצד הפנים לנשים ולגיבורים ארוכי שיער
  if (gender === 'f' || ['nazariteLocks', 'aristocratLong', 'wraithLocks', 'prophetMane'].includes(profile.hairStyle)) {
    drawHairRibbon(ctx, cx - 36, cy - 18, cx - 48, cy + 12, cx - 44, cy + 44, cx - 34, cy + 72, 12, hBase, hHi, hDark);
    drawHairRibbon(ctx, cx + 36, cy - 18, cx + 48, cy + 12, cx + 44, cy + 44, cx + 34, cy + 72, 12, hBase, hHi, hDark);
  }
  ctx.restore();
}

// ============================================================================
//  עזר: קסדות, כתרים, נזרים וברדסים מפוארים
// ============================================================================
function drawOrnateHeadgear(ctx, id, cls, cx, cy, gender, profile) {
  const helm = profile.helm;
  ctx.save();

  const goldGrad = ctx.createLinearGradient(cx - 44, cy - 60, cx + 44, cy - 20);
  goldGrad.addColorStop(0, '#fef08a');
  goldGrad.addColorStop(0.35, '#f59e0b');
  goldGrad.addColorStop(0.7, '#b45309');
  goldGrad.addColorStop(1, '#fde68a');

  if (helm === 'circlet' || helm === 'tiara' || helm === 'haloCrown') {
    // הילת שמש זהובה לדבורה הנביאה
    if (helm === 'haloCrown') {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.2;
      for (let i = -5; i <= 5; i++) {
        const ang = (i / 5) * 0.95 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * 34, cy - 30 + Math.sin(ang) * 24);
        ctx.lineTo(cx + Math.cos(ang) * 54, cy - 30 + Math.sin(ang) * 42);
        ctx.stroke();
      }
    }

    // נזר זהב מלכותי משובץ אבן חן
    ctx.fillStyle = goldGrad;
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - 42, cy - 26);
    ctx.lineTo(cx - 24, cy - 38);
    ctx.lineTo(cx - 12, cy - 33);
    ctx.lineTo(cx, cy - 50);
    ctx.lineTo(cx + 12, cy - 33);
    ctx.lineTo(cx + 24, cy - 38);
    ctx.lineTo(cx + 42, cy - 26);
    ctx.lineTo(cx + 40, cy - 18);
    ctx.quadraticCurveTo(cx, cy - 26, cx - 40, cy - 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // אבן חן מרכזית בנזר
    ctx.fillStyle = profile.accent;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 42);
    ctx.lineTo(cx + 6, cy - 31);
    ctx.lineTo(cx, cy - 22);
    ctx.lineTo(cx - 6, cy - 31);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 1.5, cy - 33, 1.8, 0, Math.PI * 2);
    ctx.fill();

  } else if (helm === 'band') {
    // סרט מצח מברונזה מוזהבת לשמשון הגיבור
    ctx.fillStyle = goldGrad;
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - 42, cy - 26);
    ctx.quadraticCurveTo(cx, cy - 34, cx + 42, cy - 26);
    ctx.lineTo(cx + 41, cy - 17);
    ctx.quadraticCurveTo(cx, cy - 25, cx - 41, cy - 17);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

  } else if (helm === 'crest' || helm === 'lion') {
    // רעמת נוצות / שיער סוס מפוארת בראש הקסדה
    const plumeColor = helm === 'lion' ? '#f59e0b' : '#dc2626';
    const plumeGrad = ctx.createRadialGradient(cx, cy - 64, 4, cx, cy - 52, 42);
    plumeGrad.addColorStop(0, shadeHex(plumeColor, 0.35));
    plumeGrad.addColorStop(0.6, plumeColor);
    plumeGrad.addColorStop(1, shadeHex(plumeColor, -0.45));
    ctx.fillStyle = plumeGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy - 42);
    ctx.bezierCurveTo(cx - 42, cy - 82, cx + 42, cy - 82, cx + 32, cy - 38);
    ctx.closePath();
    ctx.fill();

    // כיפת קסדת פלדה וזהב עם מגן אף (Nasal Guard)
    const helmGrad = ctx.createLinearGradient(cx - 44, cy - 56, cx + 44, cy - 12);
    helmGrad.addColorStop(0, '#ffffff');
    helmGrad.addColorStop(0.4, '#cbd5e1');
    helmGrad.addColorStop(0.8, '#475569');
    helmGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = helmGrad;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 44, cy - 16);
    ctx.bezierCurveTo(cx - 46, cy - 60, cx + 46, cy - 60, cx + 44, cy - 16);
    ctx.lineTo(cx + 12, cy - 18);
    ctx.lineTo(cx + 4, cy - 2); // מגן אף קצר שלא מסתיר את העיניים
    ctx.lineTo(cx - 4, cy - 2);
    ctx.lineTo(cx - 12, cy - 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // עיטור אריה מוזהב על מצח הקסדה
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 42, cy - 18);
    ctx.quadraticCurveTo(cx, cy - 28, cx + 42, cy - 18);
    ctx.stroke();

  } else if (helm === 'horns' || helm === 'spiked') {
    // כתר ברזל שחור וקרני שד/אביר מוות אדירות
    const drawHorn = (side) => {
      ctx.save();
      const hornGrad = ctx.createLinearGradient(cx + side * 26, cy - 30, cx + side * 66, cy - 84);
      hornGrad.addColorStop(0, '#0f172a');
      hornGrad.addColorStop(0.6, '#334155');
      hornGrad.addColorStop(1, profile.rimLight);
      ctx.fillStyle = hornGrad;
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + side * 28, cy - 26);
      ctx.bezierCurveTo(cx + side * 68, cy - 42, cx + side * 74, cy - 72, cx + side * 52, cy - 92);
      ctx.bezierCurveTo(cx + side * 56, cy - 66, cx + side * 46, cy - 46, cx + side * 14, cy - 36);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    drawHorn(-1);
    drawHorn(1);

    // נזר ברזל גותי משונן על המצח
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 43, cy - 20);
    ctx.lineTo(cx - 28, cy - 40);
    ctx.lineTo(cx - 14, cy - 26);
    ctx.lineTo(cx, cy - 46);
    ctx.lineTo(cx + 14, cy - 26);
    ctx.lineTo(cx + 28, cy - 40);
    ctx.lineTo(cx + 43, cy - 20);
    ctx.quadraticCurveTo(cx, cy - 12, cx - 43, cy - 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // אבן דם זוהרת במרכז
    ctx.fillStyle = profile.rimLight;
    ctx.beginPath();
    ctx.arc(cx, cy - 25, 5, 0, Math.PI * 2);
    ctx.fill();

  } else if (helm === 'darkCrown' || helm === 'crescent' || helm === 'boneCrown' || helm === 'boneTiara') {
    // כתר מלכותי אפל / כתר עצמות וסהר לילה
    const isGold = helm === 'darkCrown';
    ctx.fillStyle = isGold ? goldGrad : '#e2e8f0';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - 42, cy - 22);
    ctx.lineTo(cx - 34, cy - 48);
    ctx.lineTo(cx - 18, cy - 30);
    ctx.lineTo(cx, cy - 58);
    ctx.lineTo(cx + 18, cy - 30);
    ctx.lineTo(cx + 34, cy - 48);
    ctx.lineTo(cx + 42, cy - 22);
    ctx.quadraticCurveTo(cx, cy - 16, cx - 42, cy - 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (helm === 'crescent') {
      // סהר ירח ללילית במרכז הכתר
      ctx.fillStyle = '#f0abfc';
      ctx.beginPath();
      ctx.arc(cx, cy - 44, 9, 0.2 * Math.PI, 1.8 * Math.PI);
      ctx.arc(cx + 3, cy - 46, 7, 1.8 * Math.PI, 0.2 * Math.PI, true);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = profile.accent;
      ctx.beginPath();
      ctx.arc(cx, cy - 32, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (helm === 'mitre') {
    // מצנפת כהן גדול לשמואל עם ציץ זהב קדוש
    const mitreGrad = ctx.createLinearGradient(cx - 40, cy - 80, cx + 40, cy - 20);
    mitreGrad.addColorStop(0, '#ffffff');
    mitreGrad.addColorStop(0.6, '#e2e8f0');
    mitreGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = mitreGrad;
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx - 42, cy - 22);
    ctx.bezierCurveTo(cx - 48, cy - 62, cx - 18, cy - 82, cx, cy - 86);
    ctx.bezierCurveTo(cx + 18, cy - 82, cx + 48, cy - 62, cx + 42, cy - 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ציץ זהב טהור על המצח
    ctx.fillStyle = goldGrad;
    ctx.fillRect(cx - 42, cy - 28, 84, 10);
    ctx.strokeRect(cx - 42, cy - 28, 84, 10);
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(cx, cy - 23, 3.8, 0, Math.PI * 2);
    ctx.fill();

  } else if (helm === 'cowl' || helm === 'hoodLight' || helm === 'veil') {
    // שולי ברדס או הינומה מעל המצח עם עיטור זהב
    const edgeColor = helm === 'veil' ? '#38bdf8' : helm === 'hoodLight' ? '#f59e0b' : profile.accent;
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 48, cy + 12);
    ctx.bezierCurveTo(cx - 48, cy - 38, cx - 22, cy - 52, cx, cy - 52);
    ctx.bezierCurveTo(cx + 22, cy - 52, cx + 48, cy - 38, cx + 48, cy + 12);
    ctx.stroke();
  }

  ctx.restore();
}

// ============================================================================
//  6. ניצוצות קסם, חלקיקי אור וטקסטורת בד ציור שמן (Oil Canvas Grain)
// ============================================================================
function drawAtmosphereAndCanvasTexture(ctx, id, cls, rng, profile) {
  ctx.save();

  // חלקיקי אור / גחלים / ניצוצות מאגיים בחזית
  const particleCount = 14;
  for (let i = 0; i < particleCount; i++) {
    const px = 18 + rng() * 220;
    const py = 18 + rng() * 220;
    // נמנע מהסתרת מרכז הפנים
    if (px > 78 && px < 178 && py > 65 && py < 155) continue;

    const r = 1.2 + rng() * 2.8;
    const pGlow = ctx.createRadialGradient(px, py, 0.2, px, py, r * 3.2);
    pGlow.addColorStop(0, '#ffffff');
    pGlow.addColorStop(0.4, withAlpha(profile.rimLight, 0.75));
    pGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pGlow;
    ctx.beginPath();
    ctx.arc(px, py, r * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // טקסטורת קנבס ציור שמן עדינה (Fine Crosshatch Linen Texture)
  ctx.strokeStyle = 'rgba(255, 245, 220, 0.025)';
  ctx.lineWidth = 1;
  for (let y = 8; y < 248; y += 6) {
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(248, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
  for (let x = 8; x < 248; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, 248);
    ctx.stroke();
  }

  // וינייטה קולנועית (Chiaroscuro Vignette)
  const vig = ctx.createRadialGradient(128, 118, 72, 128, 128, 152);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(0.7, 'rgba(0, 0, 0, 0.22)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.68)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, 256, 256);

  ctx.restore();
}

// ============================================================================
//  7. מסגרת זהב עתיקה משופעת עם פינות פיליגרן ואבני חן (Bevelled Gold Frame)
// ============================================================================
function drawOrnateGoldFrame(ctx, cls, profile) {
  ctx.save();

  // שיפוע חיצוני כהה
  ctx.strokeStyle = '#1c0f05';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 253, 253);

  // גוף המסגרת המוזהבת המשופעת
  const frameGrad = ctx.createLinearGradient(0, 0, 256, 256);
  frameGrad.addColorStop(0, '#fef08a');
  frameGrad.addColorStop(0.25, '#f59e0b');
  frameGrad.addColorStop(0.5, '#92400e');
  frameGrad.addColorStop(0.75, '#f59e0b');
  frameGrad.addColorStop(1, '#451a03');

  ctx.strokeStyle = frameGrad;
  ctx.lineWidth = 10;
  ctx.strokeRect(7, 7, 242, 242);

  // פס הברקה פנימי וחיצוני (Inner & Outer Bevel Specular)
  ctx.strokeStyle = 'rgba(254, 249, 195, 0.7)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(4, 4, 248, 248);

  ctx.strokeStyle = '#271203';
  ctx.lineWidth = 2;
  ctx.strokeRect(12.5, 12.5, 231, 231);

  // פינות פיליגרן ואבני חן קבושון (Cabochon Corner Gems)
  const isCastle = cls === 'knight' || cls === 'cleric';
  const gemColor = isCastle ? '#0ea5e9' : (profile.rimLight || '#a855f7');
  const corners = [
    [13, 13],
    [243, 13],
    [13, 243],
    [243, 243],
  ];

  for (const [cx, cy] of corners) {
    // תושבת זהב מעוטרת
    ctx.fillStyle = '#d97706';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(cx, cy, 7.2, 0, Math.PI * 2);
    ctx.fill();

    // אבן חן קבושון מבריקה
    const gemGrad = ctx.createRadialGradient(cx - 2, cy - 2, 0.5, cx, cy, 5.5);
    gemGrad.addColorStop(0, '#ffffff');
    gemGrad.addColorStop(0.35, gemColor);
    gemGrad.addColorStop(1, shadeHex(gemColor, -0.55));
    ctx.fillStyle = gemGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 5.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
