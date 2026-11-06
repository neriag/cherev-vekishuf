// ============================================================================
//  מחולל מפות אקראי
// ============================================================================
import { RNG, makeNoise2D } from '../core/rng.js';
import { TERRAINS } from '../data/terrain.js';
import { CREATURES, FACTIONS, NEUTRAL_POOL, FACTION_LINEUP } from '../data/creatures.js';
import { ARTIFACTS } from '../data/artifacts.js';
import { HERO_ROSTER, HERO_CLASSES } from '../data/heroes.js';
import { SKILLS } from '../data/skills.js';
import { spellsOfLevel } from '../data/spells.js';
import { SIGN_TEXTS } from '../data/objects.js';
import {
  PLAYER_COLORS, DIFFICULTIES, createHero, createTown, rebuildIndex, reveal, emptyRes, addRes, heroVision,
} from '../core/state.js';

const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export const MAP_SIZES = {
  small: { name: 'קטנה', size: 36 },
  medium: { name: 'בינונית', size: 48 },
  large: { name: 'גדולה', size: 64 },
};

/**
 * @param {{seed:number, size:number, difficulty:string, players:{faction:string, human:boolean, heroId?:string}[]}} opts
 */
export function generateGame(opts) {
  const seed = opts.seed >>> 0;
  const rng = new RNG(seed);
  const N = opts.size;
  const w = N, h = N, n = w * h;
  const noise = makeNoise2D(seed);
  const noise2 = makeNoise2D(seed + 101);
  const noise3 = makeNoise2D(seed + 202);
  const diff = DIFFICULTIES[opts.difficulty] || DIFFICULTIES.normal;

  const state = {
    version: 1, seed, day: 1, difficulty: opts.difficulty, nextId: 1,
    map: { w, h, terrain: new Array(n), obstacle: new Array(n).fill(null), road: new Array(n).fill(0), blocked: new Uint8Array(n) },
    objects: {}, heroes: {}, players: [], currentPlayer: 0, weekCreature: null, log: [], gameOver: null,
  };
  const M = state.map;
  const I = (x, y) => y * w + x;
  const inB = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

  // ------------------------------------------------------------- town positions
  const margin = Math.max(6, Math.round(N * 0.16));
  const corners = [[margin, margin], [w - 1 - margin, h - 1 - margin], [w - 1 - margin, margin], [margin, h - 1 - margin]];
  if (rng.chance(0.5)) { [corners[0], corners[2]] = [corners[2], corners[0]]; [corners[1], corners[3]] = [corners[3], corners[1]]; }
  if (rng.chance(0.5)) { [corners[0], corners[1]] = [corners[1], corners[0]]; [corners[2], corners[3]] = [corners[3], corners[2]]; }
  const numP = opts.players.length;
  const townPos = opts.players.map((_, i) => corners[i]);
  townPos.forEach((p) => { p[0] += rng.int(-1, 1); p[1] += rng.int(-1, 1); });

  // ------------------------------------------------------------- biomes (warped voronoi)
  const seeds = townPos.map((p, i) => ({ x: p[0], y: p[1], t: FACTIONS[opts.players[i].faction].native, weight: 0.8 }));
  const pool = ['grass', 'dirt', 'sand', 'snow', 'swamp', 'rough', 'grass', 'dirt'];
  const extra = Math.round((N * N) / 170);
  for (let i = 0; i < extra; i++) {
    const x = rng.int(2, w - 3), y = rng.int(2, h - 3);
    // keep start areas mostly native
    if (townPos.some((p) => Math.hypot(p[0] - x, p[1] - y) < N * 0.18)) { i--; continue; }
    seeds.push({ x, y, t: rng.pick(pool), weight: 1 });
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const wx = x + noise.fbm(x * 0.08, y * 0.08, 3) * 7;
    const wy = y + noise.fbm(x * 0.08 + 50, y * 0.08 + 50, 3) * 7;
    let best = Infinity, bt = 'grass';
    for (const s of seeds) {
      const d = Math.hypot(s.x - wx, s.y - wy) * s.weight;
      if (d < best) { best = d; bt = s.t; }
    }
    M.terrain[I(x, y)] = bt;
  }

  // ------------------------------------------------------------- water: ocean ring + lakes
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.min(x, y, w - 1 - x, h - 1 - y);
    const e = d + noise2.fbm(x * 0.15, y * 0.15, 3) * 3.2;
    let water = e < 1.6;
    const lake = noise2.fbm(x * 0.09 + 300, y * 0.09 + 300, 4);
    if (lake > 0.3 && d > 4) water = true;
    if (townPos.some((p) => Math.hypot(p[0] - x, p[1] - y) < 6)) water = water && d < 2;
    if (water) { M.terrain[I(x, y)] = 'water'; M.blocked[I(x, y)] = 1; }
  }

  // ------------------------------------------------------------- obstacles
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = I(x, y);
    if (M.terrain[i] === 'water') continue;
    const f = noise3.fbm(x * 0.13, y * 0.13, 4) + rng.float(-0.12, 0.12);
    const mtn = noise.fbm(x * 0.07 + 900, y * 0.07 + 900, 3);
    let near = Infinity;
    for (const p of townPos) near = Math.min(near, Math.hypot(p[0] - x, p[1] - y));
    if (near < 4.2) continue;
    const thr = near < 7 ? 0.2 : 0.06;
    if (f > thr) {
      const t = TERRAINS[M.terrain[i]];
      M.obstacle[i] = mtn > 0.12 || (M.terrain[i] === 'rough' && mtn > -0.05) ? 'mountain' : 'tree';
      if (!t.obstacles.length) M.obstacle[i] = 'mountain';
      M.blocked[i] = 1;
    }
  }

  // ------------------------------------------------------------- towns
  const players = opts.players.map((p, i) => ({
    id: i, color: PLAYER_COLORS[i].id, colorHex: PLAYER_COLORS[i].hex, name: PLAYER_COLORS[i].name,
    human: !!p.human, faction: p.faction, resources: emptyRes(), explored: new Uint8Array(n), alive: true,
    tavern: [], daysWithoutTown: 0,
  }));
  state.players = players;
  players.forEach((p) => addRes(p.resources, diff.res, p.human ? 1 : diff.aiRes));
  players.forEach((p) => { for (const k in p.resources) p.resources[k] = Math.round(p.resources[k]); });

  const usedTownNames = new Set();
  const towns = townPos.map(([x, y], i) => {
    const fac = opts.players[i].faction;
    const names = FACTIONS[fac].townNames.filter((nm) => !usedTownNames.has(nm));
    const name = rng.pick(names);
    usedTownNames.add(name);
    // clear area
    for (let dy = -3; dy <= 4; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (!inB(x + dx, y + dy)) continue;
      const j = I(x + dx, y + dy);
      M.obstacle[j] = null; M.blocked[j] = 0;
      if (M.terrain[j] === 'water') M.terrain[j] = FACTIONS[fac].native;
    }
    return createTown(state, fac, i, x, y, name);
  });

  // reserved tiles (no objects): town blocks + entrance approach
  const reserved = new Uint8Array(n);
  towns.forEach((t) => {
    for (let dy = -2; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) if (inB(t.x + dx, t.y + dy)) reserved[I(t.x + dx, t.y + dy)] = 1;
  });

  // ------------------------------------------------------------- roads (A*)
  function carvePath(sx, sy, tx, ty, opts2 = {}) {
    const cost = new Float32Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const open = [[0, I(sx, sy)]];
    cost[I(sx, sy)] = 0;
    const target = I(tx, ty);
    while (open.length) {
      // simple binary-heap-less selection (maps are small)
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, cur] = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      if (cur === target) break;
      const cx = cur % w, cy = (cur / w) | 0;
      for (const [dx, dy] of DIRS8.slice(0, opts2.diag ? 8 : 4)) {
        const nx = cx + dx, ny = cy + dy;
        if (!inB(nx, ny)) continue;
        const j = I(nx, ny);
        let c = (dx && dy) ? 1.5 : 1;
        if (M.terrain[j] === 'water') c += opts2.waterCost ?? 40;
        else if (M.obstacle[j]) c += opts2.obstacleCost ?? 5;
        if (M.road[j]) c *= 0.3;
        c += (noise2(nx * 0.3, ny * 0.3) + 1) * 0.6;
        const nc = cost[cur] + c;
        if (nc < cost[j]) {
          cost[j] = nc; prev[j] = cur;
          open.push([nc + Math.hypot(tx - nx, ty - ny), j]);
        }
      }
    }
    const path = [];
    let cur = target;
    while (cur >= 0) { path.push(cur); cur = prev[cur]; }
    return path.reverse();
  }
  function makeRoad(path) {
    for (const j of path) {
      if (M.terrain[j] === 'water') M.terrain[j] = 'dirt';
      M.obstacle[j] = null; M.blocked[j] = 0; M.road[j] = 1; reserved[j] = 1;
    }
  }
  // connect each town to the next (ring) + center hub
  const hub = [Math.floor(w / 2) + rng.int(-2, 2), Math.floor(h / 2) + rng.int(-2, 2)];
  towns.forEach((t) => {
    const p = carvePath(t.entrance.x, t.entrance.y + 1, hub[0], hub[1]);
    makeRoad([I(t.entrance.x, t.entrance.y + 1), ...p]);
  });
  if (numP > 2) {
    for (let i = 0; i < numP; i++) {
      const a = towns[i], b = towns[(i + 1) % numP];
      if (rng.chance(0.5)) makeRoad(carvePath(a.entrance.x, a.entrance.y + 1, b.entrance.x, b.entrance.y + 1));
    }
  }
  // hub plaza
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const j = I(hub[0] + dx, hub[1] + dy);
    if (M.terrain[j] === 'water') M.terrain[j] = 'dirt';
    M.obstacle[j] = null; M.blocked[j] = 0;
  }

  // ------------------------------------------------------------- connectivity repair
  const objBlock = new Uint8Array(n); // tiles blocked by non-monster objects
  towns.forEach((t) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) objBlock[I(t.x + dx, t.y + dy)] = 1;
    objBlock[I(t.entrance.x, t.entrance.y)] = 0;
  });
  const startIdx = I(towns[0].entrance.x, towns[0].entrance.y);
  function flood(from = startIdx) {
    const seen = new Uint8Array(n);
    const stack = [from];
    seen[from] = 1;
    let count = 0;
    while (stack.length) {
      const cur = stack.pop();
      count++;
      const cx = cur % w, cy = (cur / w) | 0;
      for (const [dx, dy] of DIRS8) {
        const nx = cx + dx, ny = cy + dy;
        if (!inB(nx, ny)) continue;
        const j = I(nx, ny);
        if (seen[j] || M.blocked[j] || objBlock[j]) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    return { seen, count };
  }
  for (let iter = 0; iter < 60; iter++) {
    const { seen } = flood();
    // find an unreached passable tile
    let found = -1;
    for (let j = 0; j < n; j++) if (!seen[j] && !M.blocked[j] && !objBlock[j]) { found = j; break; }
    if (found < 0) break;
    // measure its component
    const comp = flood(found);
    if (comp.count < 6) {
      for (let j = 0; j < n; j++) if (comp.seen[j] && !objBlock[j]) {
        M.blocked[j] = 1;
        M.obstacle[j] = TERRAINS[M.terrain[j]].obstacles.length ? 'tree' : 'mountain';
      }
    } else {
      // carve to nearest reached tile
      let best = -1, bd = Infinity;
      const fx = found % w, fy = (found / w) | 0;
      for (let j = 0; j < n; j++) if (seen[j]) {
        const d = Math.hypot((j % w) - fx, ((j / w) | 0) - fy);
        if (d < bd) { bd = d; best = j; }
      }
      const p = carvePath(fx, fy, best % w, (best / w) | 0, { waterCost: 60, obstacleCost: 2 });
      for (const j of p) { if (M.terrain[j] === 'water') M.terrain[j] = 'sand'; M.obstacle[j] = null; M.blocked[j] = 0; }
    }
  }

  // ------------------------------------------------------------- danger map (0 near players → 1 far)
  const danger = new Float32Array(n);
  const maxD = N * 0.55;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let d = Infinity;
    for (const t of towns) d = Math.min(d, Math.hypot(t.x - x, t.y - y));
    danger[I(x, y)] = Math.min(1.2, d / maxD);
  }

  // ------------------------------------------------------------- object placement
  let reachCount = flood().count;
  const objAtGen = new Array(n).fill(null);
  towns.forEach((t) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) objAtGen[I(t.x + dx, t.y + dy)] = t.id;
  });

  function spacingOK(x, y, r = 1) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (!inB(x + dx, y + dy)) continue;
      if (objAtGen[I(x + dx, y + dy)]) return false;
    }
    return true;
  }
  function addObject(obj) {
    const id = 'o' + (state.nextId++);
    obj.id = id;
    state.objects[id] = obj;
    objAtGen[I(obj.x, obj.y)] = id;
    return obj;
  }
  /** find tile and place blocking object keeping connectivity. filter(x,y,i)->bool */
  function place(obj, filter = () => true, tries = 400, spacing = 1) {
    for (let t = 0; t < tries; t++) {
      const x = rng.int(2, w - 3), y = rng.int(2, h - 3), i = I(x, y);
      if (M.blocked[i] || reserved[i] || objAtGen[i] || !filter(x, y, i)) continue;
      if (!spacingOK(x, y, spacing)) continue;
      objBlock[i] = 1;
      const f = flood();
      if (f.count !== reachCount - 1) { objBlock[i] = 0; continue; }
      // must have reachable neighbour
      let ok = false;
      for (const [dx, dy] of DIRS8) {
        const j = I(x + dx, y + dy);
        if (inB(x + dx, y + dy) && f.seen[j]) { ok = true; break; }
      }
      if (!ok) { objBlock[i] = 0; continue; }
      reachCount--;
      obj.x = x; obj.y = y;
      return addObject(obj);
    }
    return null;
  }
  const distTo = (t, x, y) => Math.hypot(t.x - x, t.entrance.y - y);

  // ------------------------------------------------------------- monsters
  const allMonsterTypes = [...NEUTRAL_POOL, ...FACTION_LINEUP.castle, ...FACTION_LINEUP.necropolis];
  function pickMonster(budget) {
    const cands = allMonsterTypes.filter((id) => {
      const k = budget / CREATURES[id].value;
      return k >= 4 && k <= 40;
    });
    const list = cands.length ? cands : [budget > 20000 ? 'greenDragon' : 'goblin'];
    const type = rng.pick(list);
    const count = Math.max(1, Math.round(budget / CREATURES[type].value * rng.float(0.85, 1.15)));
    return { type, count };
  }
  function addMonsterAt(x, y, budget) {
    const i = I(x, y);
    if (M.blocked[i] || objAtGen[i] || reserved[i]) return null;
    const { type, count } = pickMonster(budget * diff.monsterMult);
    const disp = rng.weighted({ aggressive: 3, hostile: 4, savage: 2, compliant: 1 });
    return addObject({ type: 'monster', creature: type, count, x, y, disposition: disp, growthWeeks: 0 });
  }
  function guard(obj, budget) {
    if (!obj || budget <= 0) return;
    const opts3 = rng.shuffle(DIRS8.slice());
    // prefer tiles towards the nearest town (front side)
    const t0 = towns.reduce((a, t) => (distTo(t, obj.x, obj.y) < distTo(a, obj.x, obj.y) ? t : a), towns[0]);
    opts3.sort((a, b) => distTo(t0, obj.x + a[0], obj.y + a[1]) - distTo(t0, obj.x + b[0], obj.y + b[1]));
    for (const [dx, dy] of opts3) {
      const x = obj.x + dx, y = obj.y + dy;
      if (!inB(x, y)) continue;
      const i = I(x, y);
      if (M.blocked[i] || objAtGen[i] || reserved[i] && !M.road[i]) continue;
      const m = addMonsterAt(x, y, budget * (0.6 + danger[I(obj.x, obj.y)] * 1.4));
      if (m) { m.guarding = obj.id; return m; }
    }
  }

  // ------------------------------------------------------------- mines
  const RARE = ['mercury', 'sulfur', 'crystal', 'gems'];
  towns.forEach((t) => {
    for (const res of ['wood', 'ore']) {
      place({ type: 'mine', resource: res, owner: null }, (x, y) => { const d = distTo(t, x, y); return d >= 4 && d <= 8; });
    }
    const rares = rng.shuffle(RARE.slice()).slice(0, 2);
    for (const res of rares) {
      const m = place({ type: 'mine', resource: res, owner: null }, (x, y) => { const d = distTo(t, x, y); return d >= 8 && d <= 14; });
      guard(m, 1200);
    }
    const gm = place({ type: 'mine', resource: 'gold', owner: null }, (x, y) => { const d = distTo(t, x, y); return d >= 10 && d <= 18; });
    guard(gm, 3500);
  });
  const extraMines = Math.round(N * N / 500);
  for (let k = 0; k < extraMines; k++) {
    const res = rng.pick(['wood', 'ore', ...RARE, 'gold']);
    const m = place({ type: 'mine', resource: res, owner: null }, (x, y, i) => danger[i] > 0.45);
    guard(m, res === 'gold' ? 5000 : 2500);
  }

  // ------------------------------------------------------------- structures
  const structures = [
    ['learningStone', 2, 1200], ['marlettoTower', 1, 1500], ['mercenaryCamp', 1, 1500], ['starAxis', 1, 1500],
    ['gardenOfRevelation', 1, 1500], ['witchHut', 2, 900], ['treeOfKnowledge', 1, 4500], ['stables', 1, 0],
    ['fountain', 1, 0], ['temple', 1, 0], ['windmill', 1, 0], ['waterwheel', 1, 0], ['well', 2, 0],
    ['lookout', 1, 0], ['pandora', 2, 6000], ['crypt', 1, 0], ['prison', 1, 3500],
    ['shrine', 3, 0], ['sign', 4, 0], ['dwelling', 2, 1800],
  ];
  const scale = N / 48;
  const skillIds = Object.keys(SKILLS).filter((s) => s !== 'necromancy');
  let shrineLvl = 1;
  for (const [type, baseCount, budget] of structures) {
    const count = Math.max(1, Math.round(baseCount * scale));
    for (let k = 0; k < count; k++) {
      const obj = { type };
      let filter = () => true;
      if (type === 'shrine') { obj.level = Math.min(3, shrineLvl++); obj.spell = rng.pick(spellsOfLevel(obj.level)); filter = (x, y, i) => danger[i] > 0.2 + obj.level * 0.15; }
      if (type === 'witchHut') obj.skill = rng.pick(skillIds);
      if (type === 'sign') obj.text = rng.pick(SIGN_TEXTS);
      if (type === 'dwelling') { obj.creature = rng.pick(['goblin', 'wolf', 'orc', 'stoneGolem']); obj.available = CREATURES[obj.creature].growth; obj.owner = null; }
      if (type === 'pandora') obj.content = makePandora(rng, danger);
      if (type === 'crypt') { obj.guards = [['skeleton', rng.int(20, 30)], ['walkingDead', rng.int(10, 16)], ['wight', rng.int(4, 8)]]; obj.reward = { gold: 2500, artifact: pickArtifact(rng, 'minor') }; filter = (x, y, i) => danger[i] > 0.35; }
      if (type === 'prison') {
        obj.heroRoster = null; // assigned after start heroes chosen
        obj.level = rng.int(3, 5);
        filter = (x, y, i) => danger[i] > 0.4;
      }
      if (['treeOfKnowledge', 'pandora', 'learningStone'].includes(type)) filter = (x, y, i) => danger[i] > 0.3;
      if (['stables', 'well', 'windmill', 'waterwheel', 'sign'].includes(type)) filter = (x, y, i) => danger[i] < 0.9;
      const o = place(obj, filter);
      if (o && type !== 'crypt') guard(o, budget);
    }
  }

  // ------------------------------------------------------------- treasures
  const resCount = Math.round(N * N / 45);
  for (let k = 0; k < resCount; k++) {
    const res = rng.weighted({ wood: 4, ore: 4, gold: 4, mercury: 1.2, sulfur: 1.2, crystal: 1.2, gems: 1.2 });
    const amount = res === 'gold' ? rng.int(5, 10) * 100 : (res === 'wood' || res === 'ore') ? rng.int(5, 10) : rng.int(3, 6);
    const o = place({ type: 'resource', resource: res, amount }, () => true, 200, 0);
    if (o && rng.chance(0.18)) guard(o, 500);
  }
  const chestCount = Math.round(N * N / 110);
  for (let k = 0; k < chestCount; k++) {
    const o = place({ type: 'chest', gold: rng.pick([1000, 1500, 2000]) }, () => true, 200, 0);
    if (o && rng.chance(0.3)) guard(o, 800);
  }
  const fireCount = Math.round(N * N / 220);
  for (let k = 0; k < fireCount; k++) {
    place({ type: 'campfire', gold: rng.int(4, 6) * 100, resource: rng.pick(['wood', 'ore', ...RARE]), amount: rng.int(4, 6) }, () => true, 200, 0);
  }
  const artCount = Math.round(N * N / 200);
  for (let k = 0; k < artCount; k++) {
    const rarity = rng.weighted({ minor: 6, major: 3 });
    const o = place({ type: 'artifact', artifact: pickArtifact(rng, rarity) }, (x, y, i) => danger[i] > 0.2);
    guard(o, rarity === 'minor' ? 2500 : 5500);
  }
  // relic near the middle, heavily guarded
  {
    const o = place({ type: 'artifact', artifact: pickArtifact(rng, 'relic') }, (x, y, i) => danger[i] > 0.75, 800);
    guard(o, 16000);
  }
  // teleport pair
  if (numP >= 2) {
    const a = place({ type: 'teleport' }, (x, y) => { const d = distTo(towns[0], x, y); return d > 7 && d < 13; });
    const b = place({ type: 'teleport' }, (x, y) => { const d = distTo(towns[1], x, y); return d > 9 && d < 16; });
    if (a && b) { a.target = b.id; b.target = a.id; } else { if (a) delete state.objects[a.id]; if (b) delete state.objects[b.id]; }
  }

  // ------------------------------------------------------------- wandering monsters (road blockers + free)
  towns.forEach((t) => {
    // first guard along the road out of each town (weak) and a stronger one further
    const roadTiles = [];
    for (let j = 0; j < n; j++) if (M.road[j] && !objAtGen[j]) roadTiles.push(j);
    roadTiles.sort((a, b) => distTo(t, a % w, (a / w) | 0) - distTo(t, b % w, (b / w) | 0));
    const near = roadTiles.find((j) => distTo(t, j % w, (j / w) | 0) > 9);
    if (near != null) addMonsterAt(near % w, (near / w) | 0, 900);
    const far = roadTiles.find((j) => distTo(t, j % w, (j / w) | 0) > N * 0.32);
    if (far != null) addMonsterAt(far % w, (far / w) | 0, 4000);
  });
  // big guardian at the hub
  addMonsterAt(hub[0], hub[1], 9000);
  const wander = Math.round(N * N / 110);
  for (let k = 0; k < wander; k++) {
    const x = rng.int(2, w - 3), y = rng.int(2, h - 3), i = I(x, y);
    if (M.blocked[i] || objAtGen[i] || (reserved[i] && !M.road[i]) || !spacingOK(x, y, 1)) continue;
    if (danger[i] < 0.22) continue;
    addMonsterAt(x, y, 400 + danger[i] * 4500);
  }

  // ------------------------------------------------------------- players: heroes & tavern
  const usedHeroes = new Set();
  opts.players.forEach((p, i) => {
    const t = towns[i];
    let rosterId = p.heroId;
    if (!rosterId || usedHeroes.has(rosterId)) {
      const cands = HERO_ROSTER.filter((r) => HERO_CLASSES[r.cls].faction === p.faction && !usedHeroes.has(r.id));
      rosterId = rng.pick(cands).id;
    }
    usedHeroes.add(rosterId);
    const hero = createHero(state, rosterId, i, t.entrance.x, t.entrance.y, { rng });
    if (!p.human) {
      // AI gets a slightly stronger start on higher difficulties
      for (const s of hero.army) if (s) s.count = Math.round(s.count * diff.aiBonus);
    }
  });
  // prisons get a random unused hero (of any faction)
  for (const o of Object.values(state.objects)) {
    if (o.type !== 'prison') continue;
    const cands = HERO_ROSTER.filter((r) => !usedHeroes.has(r.id));
    if (!cands.length) { delete state.objects[o.id]; continue; }
    const r = rng.pick(cands);
    usedHeroes.add(r.id);
    o.heroRoster = r.id;
  }
  state.usedHeroes = [...usedHeroes];
  players.forEach((p) => refreshTavern(state, p.id, rng));

  // ------------------------------------------------------------- fog
  rebuildIndex(state);
  players.forEach((p, i) => {
    const t = towns[i];
    reveal(state, i, t.x, t.y, 8);
    for (const hId in state.heroes) {
      const hh = state.heroes[hId];
      if (hh.owner === i) reveal(state, i, hh.x, hh.y, heroVision(hh));
    }
  });

  // week creature for week 1
  state.weekCreature = null;
  state.townIds = towns.map((t) => t.id);
  return state;
}

function pickArtifact(rng, rarity) {
  const list = Object.values(ARTIFACTS).filter((a) => a.rarity === rarity);
  return rng.pick(list).id;
}

function makePandora(rng) {
  const kind = rng.weighted({ gold: 2, xp: 2, creatures: 2, spell: 1, battle: 2, resources: 1 });
  switch (kind) {
    case 'gold': return { kind, gold: rng.pick([3000, 5000, 7500]) };
    case 'xp': return { kind, xp: rng.pick([3000, 5000]) };
    case 'creatures': {
      const type = rng.pick(['griffin', 'wight', 'orc', 'stoneGolem', 'swordsman', 'vampire']);
      return { kind, creature: type, count: Math.max(2, Math.round(2500 / CREATURES[type].value)) };
    }
    case 'spell': return { kind, spell: rng.pick([...spellsOfLevel(2), ...spellsOfLevel(3)]) };
    case 'resources': return { kind, res: { wood: 10, ore: 10, mercury: 4, sulfur: 4, crystal: 4, gems: 4 } };
    default: {
      const type = rng.pick(['troll', 'cyclops', 'blackKnight', 'cavalier']);
      return { kind: 'battle', creature: type, count: Math.max(3, Math.round(7000 / CREATURES[type].value)), gold: 5000, xpBonus: 2000 };
    }
  }
}

/** Fill a player's tavern with 2 available heroes (one native, one random). */
export function refreshTavern(state, pid, rng) {
  const p = state.players[pid];
  const used = new Set();
  for (const q of state.players) for (const r of q.tavern) used.add(r);
  for (const h of Object.values(state.heroes)) if (h.alive) used.add(h.rosterId);
  for (const o of Object.values(state.objects)) if (o.type === 'prison' && o.heroRoster) used.add(o.heroRoster);
  p.tavern = p.tavern.filter((r) => !Object.values(state.heroes).some((h) => h.rosterId === r && h.alive));
  const native = HERO_ROSTER.filter((r) => HERO_CLASSES[r.cls].faction === p.faction && !used.has(r.id));
  const any = HERO_ROSTER.filter((r) => !used.has(r.id));
  while (p.tavern.length < 2) {
    const list = p.tavern.length === 0 && native.length ? native : any.filter((r) => !p.tavern.includes(r.id));
    if (!list.length) break;
    const r = rng.pick(list);
    p.tavern.push(r.id);
    used.add(r.id);
  }
}
