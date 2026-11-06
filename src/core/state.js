// ============================================================================
//  מצב המשחק וחוקי הליבה
// ============================================================================
import { CREATURES, FACTION_LINEUP } from '../data/creatures.js';
import { HERO_CLASSES, HERO_ROSTER, xpForLevel } from '../data/heroes.js';
import { SKILLS, MAX_SKILLS } from '../data/skills.js';
import { ARTIFACTS } from '../data/artifacts.js';
import { SPELLS, spellsOfLevel } from '../data/spells.js';
import { getBuildings, STARTING_BUILDINGS } from '../data/buildings.js';
import { MINES, RESOURCES } from '../data/objects.js';
import { RNG, rand } from './rng.js';

export const PLAYER_COLORS = [
  { id: 'red', name: 'האדום', hex: '#d8392b' },
  { id: 'blue', name: 'הכחול', hex: '#2f6fe0' },
  { id: 'green', name: 'הירוק', hex: '#2fa84a' },
  { id: 'orange', name: 'הכתום', hex: '#e88a1a' },
];

export const DIFFICULTIES = {
  easy: { name: 'קל', res: { gold: 30000, wood: 30, ore: 30, mercury: 15, sulfur: 15, crystal: 15, gems: 15 }, aiRes: 0.6, monsterMult: 0.7, aiBonus: 0.8 },
  normal: { name: 'רגיל', res: { gold: 20000, wood: 20, ore: 20, mercury: 10, sulfur: 10, crystal: 10, gems: 10 }, aiRes: 1, monsterMult: 1, aiBonus: 1 },
  hard: { name: 'קשה', res: { gold: 15000, wood: 15, ore: 15, mercury: 7, sulfur: 7, crystal: 7, gems: 7 }, aiRes: 1.3, monsterMult: 1.25, aiBonus: 1.2 },
  legend: { name: 'אגדי', res: { gold: 10000, wood: 10, ore: 10, mercury: 4, sulfur: 4, crystal: 4, gems: 4 }, aiRes: 1.6, monsterMult: 1.5, aiBonus: 1.45 },
};

export const MAX_HEROES = 6;
export const ARMY_SLOTS = 7;
export const HERO_COST = 2500;

// --------------------------------------------------------------------------- dates
export function dateOf(day) {
  const d = day - 1;
  return { month: Math.floor(d / 28) + 1, week: Math.floor((d % 28) / 7) + 1, day: (d % 7) + 1 };
}
export function dateText(day) {
  const { month, week, day: dd } = dateOf(day);
  return `חודש ${month}, שבוע ${week}, יום ${dd}`;
}

// --------------------------------------------------------------------------- resources
export function emptyRes() { return { gold: 0, wood: 0, ore: 0, mercury: 0, sulfur: 0, crystal: 0, gems: 0 }; }
export function canAfford(res, cost, mult = 1) {
  for (const k in cost) if ((res[k] || 0) < cost[k] * mult) return false;
  return true;
}
export function pay(res, cost, mult = 1) { for (const k in cost) res[k] -= cost[k] * mult; }
export function addRes(res, gain, mult = 1) { for (const k in gain) res[k] = (res[k] || 0) + gain[k] * mult; }
export function maxAffordable(res, cost) {
  let n = Infinity;
  for (const k in cost) if (cost[k] > 0) n = Math.min(n, Math.floor((res[k] || 0) / cost[k]));
  return n === Infinity ? 0 : n;
}

// --------------------------------------------------------------------------- army
export function emptyArmy() { return new Array(ARMY_SLOTS).fill(null); }
export function armyAdd(army, type, count) {
  if (count <= 0) return true;
  for (const s of army) if (s && s.type === type) { s.count += count; return true; }
  const i = army.findIndex((s) => !s);
  if (i < 0) return false;
  army[i] = { type, count };
  return true;
}
export function armyCanAdd(army, type) {
  return army.some((s) => !s || s.type === type);
}
export function armyTotal(army) { return army.reduce((a, s) => a + (s ? s.count : 0), 0); }
export function armyStacks(army) { return army.filter(Boolean).length; }
export function armyValue(army) {
  return army.reduce((a, s) => a + (s ? s.count * CREATURES[s.type].value : 0), 0);
}
export function armyMinSpeed(army) {
  let m = Infinity;
  for (const s of army) if (s) m = Math.min(m, CREATURES[s.type].speed);
  return m === Infinity ? 5 : m;
}
export function cloneArmy(army) { return army.map((s) => (s ? { ...s } : null)); }

// --------------------------------------------------------------------------- hero stats
export function artifactBonus(hero, key) {
  let v = 0;
  for (const slot in hero.equipped) {
    const id = hero.equipped[slot];
    if (id && ARTIFACTS[id].bonus[key]) v += ARTIFACTS[id].bonus[key];
  }
  return v;
}
export function skillLevel(hero, id) {
  const s = hero.skills.find((k) => k.id === id);
  return s ? s.level : 0;
}
export function skillValue(hero, id) {
  return SKILLS[id].values[skillLevel(hero, id)];
}
export function heroStat(hero, stat) {
  return Math.max(stat === 'power' || stat === 'knowledge' ? 1 : 0, hero[stat] + artifactBonus(hero, stat));
}
export function heroMaxMana(hero) {
  return Math.round(10 * heroStat(hero, 'knowledge') * (1 + skillValue(hero, 'intelligence')));
}
export function heroMaxMP(hero) {
  const slow = armyMinSpeed(hero.army);
  const base = Math.max(1500, Math.min(2000, 1300 + 60 * slow));
  return Math.round((base + artifactBonus(hero, 'mp')) * (1 + skillValue(hero, 'logistics')));
}
export function heroVision(hero) {
  return 5 + skillValue(hero, 'scouting') + artifactBonus(hero, 'vision');
}
export function heroMorale(hero, army = hero?.army) {
  let m = 0;
  if (hero) m += skillValue(hero, 'leadership') + artifactBonus(hero, 'morale') + (hero.tempMorale || 0);
  // faction mixing penalty
  const factions = new Set();
  let allUndead = true, angel = false;
  for (const s of army) {
    if (!s) continue;
    const c = CREATURES[s.type];
    if (!c.abilities.undead) allUndead = false;
    if (c.abilities.moraleBonus) angel = true;
    factions.add(c.faction);
  }
  if (factions.size >= 2) m -= factions.size - 1;
  else if (factions.size === 1) m += 1;
  if (angel) m += 1;
  if (allUndead) return 0;
  return Math.max(-3, Math.min(3, m));
}
export function heroLuck(hero) {
  if (!hero) return 0;
  const l = skillValue(hero, 'luck') + artifactBonus(hero, 'luck') + (hero.tempLuck || 0);
  return Math.max(-3, Math.min(3, l));
}
export function heroStrength(hero) {
  const a = heroStat(hero, 'attack'), d = heroStat(hero, 'defense');
  const mult = Math.sqrt((1 + 0.05 * a) * (1 + 0.05 * d));
  const magic = 1 + 0.03 * heroStat(hero, 'power') * Math.min(1, hero.spells.length / 3);
  return armyValue(hero.army) * mult * magic;
}
export function maxSpellLevel(hero) {
  return SKILLS.wisdom.values[skillLevel(hero, 'wisdom')];
}
export function canLearnSpell(hero, spellId) {
  return !hero.spells.includes(spellId) && SPELLS[spellId].level <= maxSpellLevel(hero);
}

export function heroTitle(hero) {
  const cls = HERO_CLASSES[hero.cls];
  return hero.gender === 'f' ? cls.nameF : cls.name;
}
/** gendered word helper: g(hero, 'הלך', 'הלכה') */
export function g(hero, m, f) { return hero && hero.gender === 'f' ? f : m; }

// --------------------------------------------------------------------------- hero creation
let heroIdCounter = 1;
export function createHero(state, rosterId, owner, x, y, opts = {}) {
  const r = HERO_ROSTER.find((h) => h.id === rosterId);
  const cls = HERO_CLASSES[r.cls];
  const id = 'h' + (state.nextId++);
  const hero = {
    id, rosterId, name: r.name, gender: r.gender, cls: r.cls, faction: cls.faction, bio: r.bio,
    owner, x, y, level: 1, xp: 0,
    attack: cls.start.attack, defense: cls.start.defense, power: cls.start.power, knowledge: cls.start.knowledge,
    mana: 0, mp: 0,
    army: emptyArmy(),
    skills: r.skills.map(([sid, lvl]) => ({ id: sid, level: lvl })),
    spells: r.spell ? [r.spell] : [],
    equipped: {}, backpack: [], visited: {},
    portraitSeed: (HERO_ROSTER.indexOf(r) + 1) * 7919,
    tempMorale: 0, tempLuck: 0, alive: true, sleeping: false, facing: 1,
  };
  const rng = opts.rng || rand;
  if (opts.army !== false) {
    const counts = { 1: [10, 22], 2: [4, 8], 3: [2, 4] };
    r.army.forEach((type) => {
      const tier = CREATURES[type].tier;
      const [a, b] = counts[tier] || [1, 3];
      armyAdd(hero.army, type, rng.int(a, b));
    });
  }
  hero.mana = heroMaxMana(hero);
  hero.mp = heroMaxMP(hero);
  state.heroes[id] = hero;
  return hero;
}
void heroIdCounter;

// --------------------------------------------------------------------------- XP & level up
export function xpNeeded(hero) { return xpForLevel(hero.level + 1); }
export function gainXP(hero, amount) {
  const gained = Math.round(amount * (1 + skillValue(hero, 'learning')));
  hero.xp += gained;
  let levels = 0;
  while (hero.xp >= xpForLevel(hero.level + 1 + levels)) levels++;
  return { gained, levels };
}

/** Returns {primary, options:[skill choices]} for a level up. Choices are {id, level}. */
export function rollLevelUp(hero, rng = rand) {
  const cls = HERO_CLASSES[hero.cls];
  const primary = rng.weighted(cls.probs);
  const options = [];
  const upgradable = hero.skills.filter((s) => s.level < 3);
  const weights = { ...cls.skillWeights };
  // necromancy only for necropolis heroes
  if (hero.faction !== 'necropolis') delete weights.necromancy;
  for (const s of hero.skills) delete weights[s.id];
  const canNew = hero.skills.length < MAX_SKILLS && Object.keys(weights).length > 0;
  if (upgradable.length) {
    const s = rng.pick(upgradable);
    options.push({ id: s.id, level: s.level + 1 });
  }
  if (canNew) {
    const id = rng.weighted(weights);
    options.push({ id, level: 1 });
    if (options.length < 2) {
      delete weights[id];
      if (Object.keys(weights).length) options.push({ id: rng.weighted(weights), level: 1 });
    }
  } else if (upgradable.length > 1 && options.length < 2) {
    const s2 = rng.pick(upgradable.filter((s) => s.id !== options[0].id));
    if (s2) options.push({ id: s2.id, level: s2.level + 1 });
  }
  return { primary, options };
}
export function applyLevelUp(hero, roll, choiceIdx) {
  hero.level++;
  hero[roll.primary]++;
  const c = roll.options[choiceIdx];
  if (c) {
    const s = hero.skills.find((k) => k.id === c.id);
    if (s) s.level = c.level;
    else hero.skills.push({ id: c.id, level: c.level });
  }
}
export function learnSkill(hero, id) {
  const s = hero.skills.find((k) => k.id === id);
  if (s) { if (s.level < 3) { s.level++; return true; } return false; }
  if (hero.skills.length >= MAX_SKILLS) return false;
  hero.skills.push({ id, level: 1 });
  return true;
}

// --------------------------------------------------------------------------- artifacts
export function giveArtifact(hero, artId) {
  const slot = ARTIFACTS[artId].slot;
  if (!hero.equipped[slot]) hero.equipped[slot] = artId;
  else hero.backpack.push(artId);
}
export function equipFromBackpack(hero, idx) {
  const artId = hero.backpack[idx];
  if (!artId) return;
  const slot = ARTIFACTS[artId].slot;
  hero.backpack.splice(idx, 1);
  if (hero.equipped[slot]) hero.backpack.push(hero.equipped[slot]);
  hero.equipped[slot] = artId;
}
export function unequip(hero, slot) {
  if (!hero.equipped[slot]) return;
  hero.backpack.push(hero.equipped[slot]);
  delete hero.equipped[slot];
}

// --------------------------------------------------------------------------- towns
export function createTown(state, faction, owner, x, y, name) {
  const id = 'o' + (state.nextId++);
  const rng = new RNG(state.seed + state.nextId * 31);
  const guild = {};
  const counts = { 1: 4, 2: 3, 3: 2, 4: 1 };
  for (let lvl = 1; lvl <= 4; lvl++) guild[lvl] = rng.shuffle(spellsOfLevel(lvl)).slice(0, counts[lvl]);
  const town = {
    id, type: 'town', faction, owner, x, y, name,
    entrance: { x, y: y + 1 },
    built: [...STARTING_BUILDINGS],
    available: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
    garrison: emptyArmy(),
    builtToday: false, guild, stablesVisited: {},
  };
  // initial creatures for already built dwellings
  for (const b of town.built) {
    const m = b.match(/^dw(\d)$/);
    if (m) town.available[+m[1]] = CREATURES[FACTION_LINEUP[faction][+m[1] - 1]].growth;
  }
  state.objects[id] = town;
  return town;
}
export function townBuildings(town) { return getBuildings(town.faction); }
export function hasBuilt(town, id) { return town.built.includes(id); }
export function townIncome(town) {
  const b = townBuildings(town);
  let gold = 0;
  for (const id of town.built) if (b[id].income) gold = Math.max(gold, b[id].income);
  const res = { gold };
  if (hasBuilt(town, 'silo')) { res.wood = 1; res.ore = 1; }
  return res;
}
export function townGrowthMult(town) {
  if (hasBuilt(town, 'castle')) return 2;
  if (hasBuilt(town, 'citadel')) return 1.5;
  return 1;
}
export function townGrowth(town, tier, weekCreature) {
  const dw = hasBuilt(town, `dw${tier}`);
  if (!dw) return 0;
  const base = CREATURES[FACTION_LINEUP[town.faction][tier - 1]];
  let g = Math.floor(base.growth * townGrowthMult(town));
  if (weekCreature && (weekCreature === base.id)) g += 5;
  return g;
}
export function townMageLevel(town) {
  let l = 0;
  for (let i = 1; i <= 4; i++) if (hasBuilt(town, `mage${i}`)) l = i;
  return l;
}
export function townTowers(town) {
  if (hasBuilt(town, 'castle')) return 2;
  if (hasBuilt(town, 'citadel')) return 1;
  return 0;
}
/** Buildability: 'built' | 'ok' | 'noMoney' | 'locked' | 'today' */
export function buildStatus(town, res, id) {
  const b = townBuildings(town)[id];
  if (!b) return 'locked';
  if (hasBuilt(town, id)) return 'built';
  for (const r of b.requires) if (!hasBuilt(town, r)) return 'locked';
  if (town.builtToday) return 'today';
  if (!canAfford(res, b.cost)) return 'noMoney';
  return 'ok';
}
export function doBuild(state, town, id) {
  const player = state.players[town.owner];
  const b = townBuildings(town)[id];
  pay(player.resources, b.cost);
  town.built.push(id);
  town.builtToday = true;
  const m = id.match(/^dw(\d)$/);
  if (m) town.available[+m[1]] += CREATURES[FACTION_LINEUP[town.faction][+m[1] - 1]].growth;
}
/** The creature types recruitable at a given tier in this town (base, and upgraded if built). */
export function recruitOptions(town, tier) {
  const base = FACTION_LINEUP[town.faction][tier - 1];
  const out = [];
  if (hasBuilt(town, `dw${tier}`)) out.push(base);
  if (hasBuilt(town, `dw${tier}u`)) out.push(CREATURES[base].upgradeTo);
  return out;
}
export function upgradeCost(fromType, count) {
  const a = CREATURES[fromType], b = CREATURES[a.upgradeTo];
  const cost = {};
  for (const k of RESOURCES) {
    const d = ((b.cost[k] || 0) - (a.cost[k] || 0)) * count;
    if (d > 0) cost[k] = d;
  }
  return cost;
}
export function canUpgradeInTown(town, type) {
  const c = CREATURES[type];
  if (!c.upgradeTo || c.faction !== town.faction) return false;
  return hasBuilt(town, `dw${c.tier}u`);
}

// --------------------------------------------------------------------------- player income
export function playerIncome(state, pid) {
  const inc = emptyRes();
  for (const o of Object.values(state.objects)) {
    if (o.owner !== pid) continue;
    if (o.type === 'town') addRes(inc, townIncome(o));
    else if (o.type === 'mine') inc[o.resource] += MINES[o.resource].income;
  }
  for (const h of Object.values(state.heroes)) {
    if (h.owner !== pid || !h.alive) continue;
    inc.gold += skillValue(h, 'estates') + artifactBonus(h, 'goldPerDay');
  }
  return inc;
}

export function playerHeroes(state, pid) {
  return Object.values(state.heroes).filter((h) => h.owner === pid && h.alive);
}
export function playerTowns(state, pid) {
  return Object.values(state.objects).filter((o) => o.type === 'town' && o.owner === pid);
}

// --------------------------------------------------------------------------- tile helpers
export function idx(state, x, y) { return y * state.map.w + x; }
export function inBounds(state, x, y) { return x >= 0 && y >= 0 && x < state.map.w && y < state.map.h; }

/** Build runtime occupancy indexes (not saved). */
export function rebuildIndex(state) {
  const n = state.map.w * state.map.h;
  state.objAt = new Array(n).fill(null);
  state.heroAt = new Array(n).fill(null);
  for (const o of Object.values(state.objects)) {
    if (o.type === 'town') {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) state.objAt[idx(state, o.x + dx, o.y + dy)] = o.id;
      state.objAt[idx(state, o.entrance.x, o.entrance.y)] = o.id;
    } else {
      state.objAt[idx(state, o.x, o.y)] = o.id;
    }
  }
  for (const h of Object.values(state.heroes)) if (h.alive && h.x >= 0) state.heroAt[idx(state, h.x, h.y)] = h.id;
  // monster zones of control
  state.guardAt = new Array(n).fill(null);
  for (const o of Object.values(state.objects)) {
    if (o.type !== 'monster') continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = o.x + dx, y = o.y + dy;
      if (!inBounds(state, x, y) || (dx === 0 && dy === 0)) continue;
      const i = idx(state, x, y);
      if (!state.map.blocked[i] && !state.objAt[i]) state.guardAt[i] = o.id;
    }
  }
}

export function isTownEntrance(state, x, y) {
  const id = state.objAt[idx(state, x, y)];
  if (!id) return false;
  const o = state.objects[id];
  return o.type === 'town' && o.entrance.x === x && o.entrance.y === y;
}

// --------------------------------------------------------------------------- fog of war
export function reveal(state, pid, cx, cy, r) {
  const p = state.players[pid];
  const { w, h } = state.map;
  let changed = false;
  for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r + r) {
        const i = y * w + x;
        if (!p.explored[i]) { p.explored[i] = 1; changed = true; }
      }
    }
  }
  return changed;
}
export function isExplored(state, pid, x, y) {
  return !!state.players[pid].explored[y * state.map.w + x];
}

// --------------------------------------------------------------------------- serialization
export function serialize(state) {
  const copy = { ...state };
  delete copy.objAt; delete copy.heroAt; delete copy.guardAt;
  copy.players = state.players.map((p) => ({ ...p, explored: Array.from(p.explored).join('') }));
  copy.map = { ...state.map, blocked: Array.from(state.map.blocked).join('') };
  return JSON.stringify(copy);
}
export function deserialize(json) {
  const s = JSON.parse(json);
  s.players.forEach((p) => { p.explored = Uint8Array.from(p.explored, (ch) => +ch); });
  s.map.blocked = Uint8Array.from(s.map.blocked, (ch) => +ch);
  rebuildIndex(s);
  return s;
}
