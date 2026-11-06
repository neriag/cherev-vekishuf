import { generateGame } from '../src/map/generator.js';
import { Game } from '../src/game/game.js';
import { playerHeroes, playerTowns, armyValue, buildStatus } from '../src/core/state.js';
import { BUILD_ORDER } from '../src/data/buildings.js';

const log = [];
const { runAutoBattle } = await import('../src/battle/battleAI.js');
const ui = new Proxy({}, { get: (t, k) => (...a) => { if (k === 'battle') { runAutoBattle(a[0]); return Promise.resolve(); } if (k === 'message' || k === 'toast') log.push(k + ':' + JSON.stringify(a[0]).slice(0, 120)); return k === 'choice' || k === 'levelUp' ? Promise.resolve(0) : k === 'confirm' ? Promise.resolve(true) : Promise.resolve(); } });
const s = generateGame({ seed: +(process.argv[2] || 777), size: 48, difficulty: 'normal', players: [{ faction: 'castle', human: true }, { faction: 'necropolis' }, { faction: 'castle' }] });
const game = new Game(s, ui, null);
const origFight = game.fight.bind(game);
game.fight = async (hero, def, kind, m) => {
  const before = Math.round(armyValue(hero.army));
  const r = await origFight(hero, def, kind, m);
  console.log(`day ${s.day} ${hero.name}(${s.players[hero.owner].name}) fights ${kind} ${def.name || def.hero?.name} army ${before} vs ${Math.round(armyValue(def.army))} -> ${r.attackerWon ? 'WIN' : 'LOSS'} now ${Math.round(armyValue(hero.army))} L${hero.level}`);
  return r;
};
const origVisit = game.visitObject.bind(game);
const visits = {};
game.visitObject = async (h, o) => { visits[o.type] = (visits[o.type] || 0) + 1; return origVisit(h, o); };
for (let d = 0; d < 40 && !s.gameOver; d++) {
  await game.endTurn();
  if (d % 10 === 9) {
    for (const p of s.players.slice(1)) {
      const hs = playerHeroes(s, p.id);
      console.log('day', s.day, p.name, 'alive', p.alive, JSON.stringify(p.resources), 'towns', playerTowns(s, p.id).length, 'tavern', p.tavern, 'heroes', hs.map((h) => `${h.name}:L${h.level}:${Math.round(armyValue(h.army))}`).join(' '));
      for (const t of playerTowns(s, p.id)) console.log('   town', t.name, t.built.join(','), 'next:', BUILD_ORDER.filter((b) => buildStatus(t, p.resources, b) !== 'built').map((b) => b + '=' + buildStatus(t, p.resources, b)).slice(0, 8).join(' '));
    }
  }
}
console.log(visits);
