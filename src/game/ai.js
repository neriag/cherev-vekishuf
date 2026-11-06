// ============================================================================
//  בינה מלאכותית למפת ההרפתקאות
// ============================================================================
import { CREATURES } from '../data/creatures.js';
import { ARTIFACTS } from '../data/artifacts.js';
import { RESOURCE_VALUE } from '../data/objects.js';
import { SPELLS } from '../data/spells.js';
import {
  idx, playerHeroes, playerTowns, heroStrength, armyValue, armyAdd, armyCanAdd, buildStatus, doBuild, recruitOptions,
  maxAffordable, pay, canLearnSpell, heroMaxMana, armyTotal, MAX_HEROES, HERO_COST, emptyArmy, townBuildings,
} from '../core/state.js';
import { marketCount, tradeQuote } from '../core/market.js';
import { computeReach, planPath } from '../map/pathfinding.js';

const BUILD_PRIORITY = [
  'dw2', 'hall2', 'dw3', 'mage1', 'blacksmith', 'marketplace', 'dw4', 'citadel', 'dw5', 'hall3', 'dw6', 'castle',
  'dw1u', 'dw2u', 'dw3u', 'dw4u', 'mage2', 'dw7', 'silo', 'dw5u', 'dw6u', 'hall4', 'dw7u', 'mage3', 'special', 'mage4',
];

export async function runAITurn(game, pid) {
  const s = game.state;
  const player = s.players[pid];
  // ------------------------------------------------ towns: build & recruit
  for (const town of playerTowns(s, pid)) {
    aiBuild(game, town);
    aiRecruit(game, town);
  }
  // ------------------------------------------------ hire heroes
  const heroes = playerHeroes(s, pid);
  const wantHeroes = s.day < 8 ? 2 : s.day < 22 ? 3 : 4;
  if (heroes.length < Math.min(wantHeroes, MAX_HEROES) && player.resources.gold > HERO_COST + 2500) {
    for (const town of playerTowns(s, pid)) {
      if (s.heroAt[idx(s, town.entrance.x, town.entrance.y)]) continue;
      const rid = player.tavern[0];
      if (!rid) break;
      const h = game.hireHero(pid, town, rid);
      if (h) {
        // hand over garrison to the new hero
        for (let i = 0; i < town.garrison.length; i++) {
          const st = town.garrison[i];
          if (st && armyAdd(h.army, st.type, st.count)) town.garrison[i] = null;
        }
        break;
      }
    }
  }
  // ------------------------------------------------ heroes act
  const order = playerHeroes(s, pid).sort((a, b) => heroStrength(b) - heroStrength(a));
  for (const hero of order) {
    for (let iter = 0; iter < 12 && hero.alive && hero.mp > 0 && !s.gameOver; iter++) {
      const before = `${hero.x},${hero.y},${hero.mp}`;
      const target = chooseTarget(game, hero, iter);
      if (!target) break;
      await game.moveHero(hero, target.plan, { animate: false });
      if (!hero.alive || s.gameOver) break;
      // at a town? recruit
      const town = game.townAt(hero.x, hero.y);
      if (town && town.owner === pid) { aiRecruit(game, town); mergeGarrison(town, hero); }
      if (`${hero.x},${hero.y},${hero.mp}` === before) break;
    }
  }
  for (const town of playerTowns(s, pid)) aiRecruit(game, town);
}

function aiBuild(game, town) {
  const s = game.state;
  const player = s.players[town.owner];
  const hasMarket = marketCount(s, town.owner) > 0;
  for (const id of BUILD_PRIORITY) {
    let st = buildStatus(town, player.resources, id);
    if (st === 'noMoney' && hasMarket) {
      // try buying missing resources with gold
      const cost = townBuildings(town)[id].cost;
      let goldNeeded = cost.gold || 0;
      const buys = [];
      for (const k in cost) {
        if (k === 'gold') continue;
        const miss = cost[k] - player.resources[k];
        if (miss > 0) {
          const q = tradeQuote(s, town.owner, 'gold', k);
          goldNeeded += miss * q.give;
          buys.push([k, miss, q.give]);
        }
      }
      if (buys.length && player.resources.gold >= goldNeeded + 1500) {
        for (const [k, miss, price] of buys) { player.resources.gold -= miss * price; player.resources[k] += miss; }
        st = buildStatus(town, player.resources, id);
      }
    }
    if (st === 'ok') { doBuild(s, town, id); return id; }
    if (st === 'noMoney' && ['dw2', 'dw3', 'dw4', 'hall2', 'citadel'].includes(id)) return null; // save up for key buildings
  }
  return null;
}

function aiRecruit(game, town) {
  const s = game.state;
  const player = s.players[town.owner];
  const heroId = s.heroAt[idx(s, town.entrance.x, town.entrance.y)];
  const hero = heroId ? s.heroes[heroId] : null;
  const target = hero && hero.owner === town.owner ? hero.army : town.garrison;
  for (let tier = 7; tier >= 1; tier--) {
    const opts = recruitOptions(town, tier);
    if (!opts.length || town.available[tier] <= 0) continue;
    const type = opts[opts.length - 1];
    const c = CREATURES[type];
    let n = Math.min(town.available[tier], maxAffordable(player.resources, c.cost));
    if (n <= 0) continue;
    if (!armyCanAdd(target, type)) {
      if (target !== town.garrison && armyCanAdd(town.garrison, type)) {
        pay(player.resources, c.cost, n); armyAdd(town.garrison, type, n); town.available[tier] -= n;
      }
      continue;
    }
    pay(player.resources, c.cost, n);
    armyAdd(target, type, n);
    town.available[tier] -= n;
  }
  if (hero && hero.owner === town.owner) mergeGarrison(town, hero);
}

function mergeGarrison(town, hero) {
  // keep a small garrison if the hero is strong, otherwise take everything
  for (let i = 0; i < town.garrison.length; i++) {
    const st = town.garrison[i];
    if (st && armyAdd(hero.army, st.type, st.count)) town.garrison[i] = null;
  }
}

function strengthOfArmy(army) { return armyValue(army); }

function objectValue(game, hero, o, strength) {
  const s = game.state;
  const pid = hero.owner;
  switch (o.type) {
    case 'resource': return o.amount * RESOURCE_VALUE[o.resource] * (o.resource === 'gold' ? 1 : 1.2);
    case 'chest': return o.gold;
    case 'campfire': return o.gold + o.amount * RESOURCE_VALUE[o.resource];
    case 'artifact': return { minor: 2500, major: 5000, relic: 10000 }[ARTIFACTS[o.artifact].rarity];
    case 'mine': return o.owner === pid ? 0 : (o.resource === 'gold' ? 7000 : o.resource === 'wood' || o.resource === 'ore' ? 3500 : 4000) * (o.owner != null ? 1.3 : 1);
    case 'dwelling': return o.owner === pid ? (o.available > 0 ? 600 : 0) : 1500;
    case 'monster': {
      const mv = o.count * CREATURES[o.creature].value;
      if (strength < mv * 1.6) return -1;
      return o.count * CREATURES[o.creature].hp * 0.6 + (o.guarding ? 300 : 0) + 200;
    }
    case 'learningStone': case 'marlettoTower': case 'mercenaryCamp': case 'starAxis': case 'gardenOfRevelation':
      return hero.visited[o.id] ? 0 : 1800;
    case 'treeOfKnowledge': return hero.visited[o.id] ? 0 : 3500;
    case 'witchHut': return hero.visited[o.id] || hero.skills.some((k) => k.id === o.skill) || hero.skills.length >= 8 ? 0 : 1200;
    case 'shrine': return canLearnSpell(hero, o.spell) ? 700 * o.level : 0;
    case 'windmill': case 'waterwheel': return o.lastWeek === Math.floor((s.day - 1) / 7) ? 0 : 900;
    case 'well': return hero.mana < heroMaxMana(hero) * 0.4 && hero.visited[o.id] !== s.day ? 400 : 0;
    case 'stables': return hero.visited[o.id] === Math.floor((s.day - 1) / 7) ? 0 : 500;
    case 'fountain': case 'temple': return hero.visited[o.id] ? 0 : 500;
    case 'lookout': return 0;
    case 'pandora': return strength > 9000 ? 3500 : 0;
    case 'crypt': {
      if (o.looted) return 0;
      const gv = o.guards.reduce((a, [t, n]) => a + CREATURES[t].value * n, 0);
      return strength > gv * 1.8 ? 5000 : -1;
    }
    case 'prison': return 5000;
    case 'town': {
      if (o.owner === pid) return 0;
      const dh = s.heroAt[idx(s, o.entrance.x, o.entrance.y)];
      let def = strengthOfArmy(o.garrison) * (1 + 0.3 * (o.built.includes('castle') ? 2 : o.built.includes('citadel') ? 1 : 0));
      if (dh) def += heroStrength(s.heroes[dh]);
      if (strength < def * 1.5 + 500) return -1;
      return def < 300 ? 15000 : 11000;
    }
    default: return 0;
  }
}

function chooseTarget(game, hero, iter) {
  const s = game.state;
  const reach = computeReach(s, hero, 4);
  const strength = heroStrength(hero);
  const w = s.map.w;
  let best = null, bestScore = 0;
  const consider = (x, y, value, kindTag) => {
    if (value <= 0) return;
    const plan = planPath(s, hero, x, y, reach);
    if (!plan) return;
    const last = plan.interact || plan.steps[plan.steps.length - 1];
    if (!last) return;
    const turns = last.turn ?? 0;
    // a path ending on a guarded tile means fighting that guard first
    const end = plan.steps[plan.steps.length - 1];
    if (end && !plan.interact) {
      const g = s.guardAt[end.y * w + end.x];
      if (g) {
        const m = s.objects[g];
        if (m && m.count * CREATURES[m.creature].value * 1.6 > strength) return;
      }
    }
    if (plan.interact && plan.interact.kind === 'object') {
      const end2 = plan.steps[plan.steps.length - 1];
      if (end2) {
        const g = s.guardAt[end2.y * w + end2.x];
        if (g && g !== plan.interact.id) {
          const m = s.objects[g];
          if (m && m.count * CREATURES[m.creature].value * 1.6 > strength) return;
        }
      }
    }
    const dist = plan.steps.length + 1;
    const score = value / (1 + turns * 1.5 + dist * 0.04);
    if (score > bestScore) { bestScore = score; best = { plan, kindTag, x, y }; }
  };
  for (const o of Object.values(s.objects)) {
    if (o.type === 'town') {
      if (o.owner === hero.owner) {
        // return home to recruit at start of week or when weak
        const avail = Object.entries(o.available).reduce((a, [tier, n]) => a + n * 100 * tier, 0);
        const heroInside = s.heroAt[idx(s, o.entrance.x, o.entrance.y)];
        if (heroInside && heroInside !== hero.id) continue;
        if (hero.x === o.entrance.x && hero.y === o.entrance.y) continue;
        const v = Math.min(avail, s.players[hero.owner].resources.gold) * 0.6 + armyValue(o.garrison) * 0.5;
        consider(o.entrance.x, o.entrance.y, v, 'home');
      } else {
        consider(o.entrance.x, o.entrance.y, objectValue(game, hero, o, strength), 'town');
      }
      continue;
    }
    if (!s.players[hero.owner].explored[o.y * w + o.x] && iter === 0 && s.day < 3) continue;
    const v = objectValue(game, hero, o, strength);
    consider(o.x, o.y, v, o.type);
  }
  for (const h of Object.values(s.heroes)) {
    if (!h.alive || h.owner === hero.owner) continue;
    const hs = heroStrength(h);
    if (strength > hs * 1.35) consider(h.x, h.y, 6000 + hs * 0.6, 'hero');
  }
  // exploration fallback: walk towards unexplored region
  if (!best) {
    const p = s.players[hero.owner];
    let bx = -1, by = -1, bd = Infinity;
    for (let i = 0; i < reach.left.length; i++) {
      if (reach.left[i] < 0 || reach.turn[i] > 1) continue;
      const x = i % w, y = (i / w) | 0;
      // count unexplored around
      let unexplored = 0;
      for (let dy = -4; dy <= 4; dy += 2) for (let dx = -4; dx <= 4; dx += 2) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < s.map.h && !p.explored[ny * w + nx]) unexplored++;
      }
      if (!unexplored || s.guardAt[i]) continue;
      const d = reach.turn[i] * 10000 - reach.left[i] - unexplored * 60;
      if (d < bd) { bd = d; bx = x; by = y; }
    }
    if (bx >= 0) {
      const plan = planPath(s, hero, bx, by, reach);
      if (plan) best = { plan, kindTag: 'explore' };
    }
  }
  return best;
}

export { emptyArmy, armyTotal, SPELLS };
