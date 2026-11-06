// ============================================================================
//  בינה מלאכותית לקרב
// ============================================================================
import { SPELLS } from '../data/spells.js';
import { key, unkey, neighbors, hexDist } from './battleLogic.js';

function unitValue(b, u) { return b.def(u).value; }
function threat(b, u) {
  const c = b.def(u);
  return u.count * (c.minDmg + c.maxDmg) / 2 * (1 + 0.05 * b.attackOf(u)) * (c.abilities.shots && u.shots ? 1.5 : 1);
}
function killValue(b, target, dmg) {
  const kills = b.killsFor(target, dmg);
  const partial = Math.min(1, (dmg - 0) / b.totalHp(target));
  return kills * unitValue(b, target) + partial * 0.15 * unitValue(b, target) * target.count * 0.1;
}

/** Decide an action for unit u. Returns { type: 'shoot'|'attack'|'move'|'defend'|'wait', ... } */
export function decideAction(b, u) {
  const enemies = b.alive(1 - u.side);
  if (!enemies.length) return { type: 'defend' };

  // 1) shooting
  if (b.canShoot(u)) {
    let best = null, bs = -Infinity;
    for (const e of enemies) {
      const far = hexDist(u, e) > 10;
      const avg = (b.damage(u, e, { ranged: true, far, mode: 'min' }) + b.damage(u, e, { ranged: true, far, mode: 'max' })) / 2;
      const s = killValue(b, e, avg) + threat(b, e) * 0.5 + (b.def(e).abilities.shots ? 200 : 0);
      if (s > bs) { bs = s; best = e; }
    }
    if (best) return { type: 'shoot', target: best };
  }

  // 2) melee attack reachable enemy
  const reach = b.reachable(u);
  let best = null, bs = -Infinity;
  for (const e of enemies) {
    const hexes = b.attackHexes(u, e, reach);
    if (!hexes.length) continue;
    const avg = (b.damage(u, e, { mode: 'min', moved: 0, meleeShooter: !!b.def(u).abilities.shots }) + b.damage(u, e, { mode: 'max', meleeShooter: !!b.def(u).abilities.shots })) / 2;
    let s = killValue(b, e, avg) + threat(b, e) * 0.4;
    // retaliation estimate
    if (!b.def(u).abilities.noRetaliation && e.retaliations > 0) {
      const remaining = { ...e };
      const kills = b.killsFor(e, avg);
      remaining.count = Math.max(0, e.count - kills);
      if (remaining.count > 0) {
        const c = b.def(e);
        const retal = remaining.count * (c.minDmg + c.maxDmg) / 2;
        s -= killValue(b, u, retal) * 0.6;
      }
    }
    if (b.def(e).abilities.shots) s += 150; // love killing shooters
    // choose hex: prefer the one with smallest distance (jousting: largest)
    let hex = hexes[0];
    for (const hx of hexes) {
      if (b.def(u).abilities.jousting ? hx.dist > hex.dist : hx.dist < hex.dist) hex = hx;
    }
    if (s > bs) { bs = s; best = { type: 'attack', target: e, x: hex.x, y: hex.y }; }
  }
  if (best) return best;

  // shooters without targets in reach but adjacent enemies were handled above (melee); otherwise move.
  // 3) approach: pick most attractive enemy weighted by distance
  const field = b.distanceField(u);
  let target = null, ts = -Infinity;
  for (const e of enemies) {
    let d = Infinity;
    for (const nb of neighbors(e.x, e.y)) { const v = field.get(key(nb.x, nb.y)); if (v != null) d = Math.min(d, v); }
    if (d === Infinity) d = hexDist(u, e) + 6;
    const s = threat(b, e) / (d + 1) + (b.def(e).abilities.shots ? 30 : 0);
    if (s > ts) { ts = s; target = e; }
  }
  if (!target) return { type: 'defend' };
  // if we are a shooter (no shots left) or slow, consider waiting once
  if (!u.waited && b.round <= 1 && !b.isFlyer(u) && b.speedOf(u) <= 4 && u.side === 1 && !b.def(u).abilities.shots) {
    // defenders often hold position in round 1
    return { type: 'wait' };
  }
  // choose reachable hex minimizing distance to target
  let bestHex = null, bd = Infinity;
  const tf = new Map();
  // compute distance-to-target field using BFS from target neighbours (ignoring units), cheap for 165 hexes
  const q = [];
  for (const nb of neighbors(target.x, target.y)) { const k = key(nb.x, nb.y); if (!b.obstacles.has(k)) { tf.set(k, 0); q.push(nb); } }
  while (q.length) {
    const cur = q.shift();
    const d = tf.get(key(cur.x, cur.y));
    for (const nb of neighbors(cur.x, cur.y)) {
      const k = key(nb.x, nb.y);
      if (tf.has(k) || (!b.isFlyer(u) && b.obstacles.has(k))) continue;
      tf.set(k, d + 1);
      q.push(nb);
    }
  }
  for (const [k] of reach) {
    const d = tf.get(k) ?? 99;
    if (d < bd) { bd = d; bestHex = unkey(k); }
  }
  if (bestHex) return { type: 'move', x: bestHex.x, y: bestHex.y };
  return { type: 'defend' };
}

/** Decide whether the side's hero should cast a spell now. Returns {spell, x, y} or null. */
export function decideSpell(b, side) {
  if (!b.canCast(side)) return null;
  const hero = b.sides[side].hero;
  const power = b.spellPower(side);
  let best = null, bs = 0;
  const enemies = b.alive(1 - side), allies = b.alive(side);
  for (const id of hero.spells) {
    const sp = SPELLS[id];
    if (sp.mana > hero.mana) continue;
    const consider = (x, y, s) => { if (s > bs) { bs = s; best = { spell: id, x, y }; } };
    if (sp.kind === 'damage') {
      if (sp.target === 'enemy') {
        for (const e of enemies) {
          const dmg = b.spellDamageTo(side, sp, e, sp.dmg(power) * (id === 'chainLightning' ? 1.6 : 1));
          consider(e.x, e.y, killValue(b, e, dmg) + threat(b, e) * 0.2);
        }
      } else if (sp.target === 'area' || sp.target === 'ring') {
        for (const c of [...enemies, ...enemies.flatMap((e) => neighbors(e.x, e.y))]) {
          const hexes = sp.target === 'area' ? [c, ...neighbors(c.x, c.y)] : neighbors(c.x, c.y);
          let s = 0;
          for (const hx of hexes) {
            const v = b.unitAt(hx.x, hx.y);
            if (!v) continue;
            const val = killValue(b, v, b.spellDamageTo(side, sp, v, sp.dmg(power)));
            s += v.side === side ? -1.5 * val : val;
          }
          consider(c.x, c.y, s);
        }
      } else if (sp.target === 'all') {
        let s = 0;
        for (const v of b.alive()) {
          const val = killValue(b, v, b.spellDamageTo(side, sp, v, sp.dmg(power)));
          s += v.side === side ? -1.3 * val : val;
        }
        consider(0, 0, s);
      }
    } else if (sp.kind === 'buff') {
      for (const a of allies) {
        if (b.hasEffect(a, sp.effect)) continue;
        const v = a.count * b.def(a).value;
        let f = 0.12;
        if (sp.effect === 'bloodlust' && b.def(a).abilities.shots) f = 0.02;
        if (sp.effect === 'haste' && b.isFlyer(a)) f = 0.05;
        if (sp.effect === 'prayer') f = 0.2;
        consider(a.x, a.y, v * f);
      }
    } else if (sp.kind === 'debuff') {
      for (const e of enemies) {
        if (b.hasEffect(e, sp.effect)) continue;
        if (sp.mind && (b.def(e).abilities.undead || b.def(e).abilities.mindImmune)) continue;
        const v = e.count * b.def(e).value;
        consider(e.x, e.y, v * (sp.effect === 'blind' ? 0.25 : 0.1));
      }
    } else if (sp.kind === 'heal') {
      for (const a of allies) {
        const missing = b.unitHp(a) - a.hpLeft;
        const bad = a.effects.some((e) => ['curse', 'slow', 'weakness', 'blind', 'disease'].includes(e.id));
        consider(a.x, a.y, missing * b.def(a).value / b.def(a).hp * 0.5 + (bad ? a.count * b.def(a).value * 0.08 : 0));
      }
    } else if (sp.kind === 'resurrect') {
      for (const a of b.units.filter((u) => u.side === side && (u.dead || u.count < u.initialCount) && !b.def(u).abilities.undead)) {
        if (a.dead && b.unitAt(a.x, a.y)) continue;
        const lost = a.initialCount - (a.dead ? 0 : a.count);
        const can = Math.min(lost, Math.floor(sp.heal(power) / b.def(a).hp));
        consider(a.x, a.y, can * b.def(a).value * 0.9);
      }
    }
  }
  // spend mana only if worthwhile
  if (best && bs > SPELLS[best.spell].mana * 12) return best;
  return null;
}

/** Execute an action object on the battle, returning events. */
export function performAction(b, u, a) {
  switch (a.type) {
    case 'shoot': return b.doShoot(u, a.target);
    case 'attack': return b.doAttack(u, a.target, a.x, a.y);
    case 'move': return b.doMove(u, a.x, a.y);
    case 'wait': return b.doWait(u);
    case 'resurrect': return b.doResurrect(u, a.target);
    default: return b.doDefend(u);
  }
}

/** Archangel AI: resurrect a fallen ally if worthwhile. */
export function decideSpecial(b, u) {
  if (!b.def(u).abilities.resurrectOnce || u.resurrectUsed) return null;
  let best = null, bv = 0;
  for (const t of b.units) {
    if (t.side !== u.side || b.def(t).abilities.undead || t === u) continue;
    if (t.dead && b.unitAt(t.x, t.y)) continue;
    const lost = t.initialCount - (t.dead ? 0 : t.count);
    const can = Math.min(lost, Math.floor(100 * u.count / b.def(t).hp));
    const v = can * b.def(t).value;
    if (v > bv) { bv = v; best = t; }
  }
  if (best && bv > b.def(u).value * u.count * 0.3) return { type: 'resurrect', target: best };
  return null;
}

/** Fully resolve a battle without visuals (AI vs AI / neutral). */
export function runAutoBattle(b) {
  let guard = 0;
  while (!b.result && guard++ < 4000) {
    b.beginTurn();
    if (b.result) break;
    const u = b.active;
    if (!u || u.dead) continue;
    if (b.round > 60) break;
    const sp = decideSpell(b, u.side);
    if (sp) b.castSpell(u.side, sp.spell, sp.x, sp.y);
    if (b.result) break;
    performAction(b, u, decideSpecial(b, u) || decideAction(b, u));
  }
  if (!b.result) b.result = { winner: b.sideValue(0) > b.sideValue(1) * 1.5 ? 0 : 1 };
  return b.result;
}
