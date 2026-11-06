import { generateGame } from '../src/map/generator.js';
import { Battle } from '../src/battle/battleLogic.js';
import { runAutoBattle } from '../src/battle/battleAI.js';
import { computeReach, planPath } from '../src/map/pathfinding.js';

for (const size of [36, 48, 64]) {
  const t0 = Date.now();
  const s = generateGame({ seed: 1234 + size, size, difficulty: 'normal', players: [{ faction: 'castle', human: true }, { faction: 'necropolis' }, ...(size === 64 ? [{ faction: 'castle' }] : [])] });
  const objs = Object.values(s.objects);
  const counts = {};
  for (const o of objs) counts[o.type] = (counts[o.type] || 0) + 1;
  console.log('size', size, 'ms', Date.now() - t0, counts);
  const hero = Object.values(s.heroes)[0];
  const reach = computeReach(s, hero, 10);
  let reachable = 0; for (let i = 0; i < reach.left.length; i++) if (reach.left[i] >= 0) reachable++;
  const enemyTown = s.objects[s.townIds[1]];
  const p = planPath(s, hero, enemyTown.entrance.x, enemyTown.entrance.y, reach);
  console.log(' reachable tiles', reachable, 'path to enemy town', p ? p.steps.length : null);
  // ascii map
  if (size === 36) {
    let out = '';
    for (let y = 0; y < s.map.h; y++) {
      let row = '';
      for (let x = 0; x < s.map.w; x++) {
        const i = y * s.map.w + x;
        const o = s.objAt[i] ? s.objects[s.objAt[i]] : null;
        const hh = s.heroAt[i];
        row += hh ? 'H' : o ? ({ town: 'T', monster: 'm', mine: 'M', resource: 'r', chest: 'c', artifact: 'a' }[o.type] || 'o')
          : s.map.terrain[i] === 'water' ? '~' : s.map.obstacle[i] === 'mountain' ? '^' : s.map.obstacle[i] ? '*' : s.map.road[i] ? '=' : '.';
      }
      out += row + '\n';
    }
    console.log(out);
  }
}

// battle test
let wins = [0, 0];
for (let k = 0; k < 50; k++) {
  const b = new Battle({
    sides: [
      { hero: { name: 'א', gender: 'm', attack: 2, defense: 2, power: 1, knowledge: 1, equipped: {}, skills: [], spells: ['magicArrow'], mana: 10 }, army: [{ type: 'pikeman', count: 20 }, { type: 'archer', count: 10 }, { type: 'griffin', count: 5 }, null, null, null, null] },
      { hero: null, army: [{ type: 'wolf', count: 25 }, { type: 'orc', count: 10 }, null, null, null, null, null] },
    ],
  });
  runAutoBattle(b);
  wins[b.result.winner]++;
  if (k === 0) { b.applyResults(); console.log('round', b.round, 'summary', JSON.stringify(b.summary)); }
}
console.log('wins', wins);
