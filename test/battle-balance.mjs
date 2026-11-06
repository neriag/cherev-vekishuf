import { Battle } from '../src/battle/battleLogic.js';
import { runAutoBattle } from '../src/battle/battleAI.js';

function trial(a, b, n = 100) {
  const wins = [0, 0]; let rounds = 0;
  for (let k = 0; k < n; k++) {
    const bt = new Battle({ sides: [{ hero: null, army: [...a.map((x) => ({ ...x })), ...Array(7 - a.length).fill(null)] }, { hero: null, army: [...b.map((x) => ({ ...x })), ...Array(7 - b.length).fill(null)] }] });
    runAutoBattle(bt); wins[bt.result.winner]++; rounds += bt.round;
  }
  return { wins, avgRounds: rounds / n };
}
const A = [{ type: 'pikeman', count: 20 }, { type: 'archer', count: 10 }, { type: 'griffin', count: 5 }];
console.log('mirror', trial(A, A));
console.log('vs wolves', trial(A, [{ type: 'wolf', count: 25 }, { type: 'orc', count: 10 }]));
console.log('vs wolves small', trial(A, [{ type: 'wolf', count: 12 }, { type: 'orc', count: 5 }]));
console.log('pike vs skel', trial([{ type: 'pikeman', count: 30 }], [{ type: 'skeleton', count: 40 }]));
console.log('angel vs bone', trial([{ type: 'angel', count: 3 }], [{ type: 'boneDragon', count: 4 }]));
console.log('lich vs archers', trial([{ type: 'lich', count: 10 }], [{ type: 'archer', count: 60 }]));
