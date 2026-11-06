// ============================================================================
//  מנוע הקרב — לוגיקה טהורה (ללא רינדור). מפיק "אירועים" שהתצוגה מנגנת.
// ============================================================================
import { CREATURES, creatureName } from '../data/creatures.js';
import { SPELLS, spellDuration, EFFECT_NAMES } from '../data/spells.js';
import { heroStat, heroMorale, heroLuck, skillValue, heroMaxMana } from '../core/state.js';
import { rand } from '../core/rng.js';

export const COLS = 15;
export const ROWS = 11;

// ---------------------------------------------------------------------------- hex math (odd-r offset)
export const key = (x, y) => y * COLS + x;
export const unkey = (k) => ({ x: k % COLS, y: Math.floor(k / COLS) });
export function inField(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
export function neighbors(x, y) {
  const odd = y & 1;
  const d = odd
    ? [[-1, 0], [1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]
    : [[-1, 0], [1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
  const out = [];
  for (const [dx, dy] of d) {
    const nx = x + dx, ny = y + dy;
    if (inField(nx, ny)) out.push({ x: nx, y: ny });
  }
  return out;
}
function toCube(x, y) {
  const q = x - (y - (y & 1)) / 2;
  return { q, r: y, s: -q - y };
}
export function hexDist(a, b) {
  const A = toCube(a.x, a.y), B = toCube(b.x, b.y);
  return Math.max(Math.abs(A.q - B.q), Math.abs(A.r - B.r), Math.abs(A.s - B.s));
}
export function isAdjacent(a, b) { return hexDist(a, b) === 1; }
/** Hex on the far side of `b` as seen from `a` (for breath attacks). */
export function hexBehind(a, b) {
  const A = toCube(a.x, a.y), B = toCube(b.x, b.y);
  const q = 2 * B.q - A.q, r = 2 * B.r - A.r;
  const y = r, x = q + (r - (r & 1)) / 2;
  return inField(x, y) ? { x, y } : null;
}

const FORMATIONS = {
  1: [5], 2: [2, 8], 3: [2, 5, 8], 4: [0, 4, 6, 10], 5: [0, 2, 5, 8, 10], 6: [0, 2, 4, 6, 8, 10], 7: [0, 2, 4, 5, 6, 8, 10],
};

const PROJECTILES = {
  archer: 'arrow', marksman: 'arrow', monk: 'holy', zealot: 'holy', lich: 'skull', powerLich: 'skull',
  orc: 'axe', cyclops: 'boulder',
};

// ---------------------------------------------------------------------------- battle
let unitIdSeq = 1;

export class Battle {
  /**
   * @param {object} setup
   *  sides: [{ hero, army, owner, ai }, { hero, army, owner, ai }]  (army = array of 7 slots; side 0 = attacker)
   *  terrain, towers (number of defender arrow towers), rng
   */
  constructor(setup) {
    this.rng = setup.rng || rand;
    this.terrain = setup.terrain || 'grass';
    this.round = 0;
    this.units = [];
    this.obstacles = new Set();
    this.queue = [];
    this.waitQueue = [];
    this.active = null;
    this.result = null;
    this.extraTurn = false;
    this.events = [];
    this.sides = setup.sides.map((s, i) => ({
      index: i, hero: s.hero || null, army: s.army, owner: s.owner, ai: !!s.ai, castThisRound: false,
      morale: 0, luck: 0, fled: false, name: s.name || '',
    }));
    // arrow towers for town defense
    this.towers = [];
    for (let t = 0; t < (setup.towers || 0); t++) this.towers.push({ side: 1, attack: 10 + (setup.towerBonus || 0), minDmg: 6, maxDmg: 10, row: t === 0 ? 1 : 9 });

    // morale / luck
    this.sides.forEach((s, i) => {
      s.morale = heroMorale(s.hero, s.army);
      s.luck = heroLuck(s.hero);
      const enemy = setup.sides[1 - i].army;
      if (enemy.some((st) => st && CREATURES[st.type].abilities.fearAura)) s.morale -= 1;
      s.morale = Math.max(-3, Math.min(3, s.morale));
    });

    // deploy units
    this.sides.forEach((s, i) => {
      const stacks = s.army.map((st, slot) => (st ? { ...st, slot } : null)).filter(Boolean);
      const rows = FORMATIONS[stacks.length] || FORMATIONS[7];
      stacks.forEach((st, k) => {
        const c = CREATURES[st.type];
        this.units.push({
          id: unitIdSeq++, side: i, type: st.type, count: st.count, initialCount: st.count,
          hpLeft: c.hp, x: i === 0 ? 0 : COLS - 1, y: rows[k], slot: st.slot,
          shots: c.abilities.shots || 0, retaliations: 1, effects: [], defending: false,
          dead: false, waited: false, acted: false, resurrectUsed: false, moved: 0, blindRetal: false,
        });
      });
    });

    // obstacles
    const nObs = this.rng.int(2, 6);
    for (let k = 0; k < nObs; k++) {
      const x = this.rng.int(3, COLS - 4), y = this.rng.int(0, ROWS - 1);
      this.obstacles.add(key(x, y));
      if (this.rng.chance(0.5)) {
        const nb = this.rng.pick(neighbors(x, y));
        if (nb.x >= 3 && nb.x <= COLS - 4) this.obstacles.add(key(nb.x, nb.y));
      }
    }
  }

  // ------------------------------------------------------------------ queries
  unit(id) { return this.units.find((u) => u.id === id); }
  alive(side = null) { return this.units.filter((u) => !u.dead && (side === null || u.side === side)); }
  unitAt(x, y) { return this.units.find((u) => !u.dead && u.x === x && u.y === y) || null; }
  corpseAt(x, y) { return this.units.filter((u) => u.dead && u.x === x && u.y === y).pop() || null; }
  def(u) { return CREATURES[u.type]; }
  hasEffect(u, id) { return u.effects.some((e) => e.id === id); }
  effectVal(u, id) { const e = u.effects.find((x) => x.id === id); return e ? e.value : 0; }
  heroOf(u) { return this.sides[u.side].hero; }

  unitHp(u) { return this.def(u).hp * (this.hasEffect(u, 'aging') ? 0.5 : 1); }
  totalHp(u) { return (u.count - 1) * this.unitHp(u) + u.hpLeft; }

  attackOf(u, melee = true) {
    const c = this.def(u);
    let a = c.attack;
    const hero = this.heroOf(u);
    if (hero) a += heroStat(hero, 'attack');
    if (melee && this.hasEffect(u, 'bloodlust')) a += 3;
    if (this.hasEffect(u, 'prayer')) a += 2;
    if (this.hasEffect(u, 'weakness')) a -= 3;
    if (this.hasEffect(u, 'disease')) a -= 2;
    return Math.max(0, a);
  }
  defenseOf(u) {
    const c = this.def(u);
    let d = c.defense;
    const hero = this.heroOf(u);
    if (hero) d += heroStat(hero, 'defense');
    if (this.hasEffect(u, 'stoneSkin')) d += 3;
    if (this.hasEffect(u, 'prayer')) d += 2;
    if (this.hasEffect(u, 'disease')) d -= 2;
    if (u.defending) d += Math.max(1, Math.ceil(d * 0.2));
    return Math.max(0, d);
  }
  speedOf(u) {
    let s = this.def(u).speed;
    if (this.hasEffect(u, 'haste')) s += 3;
    if (this.hasEffect(u, 'prayer')) s += 2;
    if (this.hasEffect(u, 'slow')) s = Math.max(1, Math.round(s * 0.6));
    return s;
  }
  isFlyer(u) { return !!this.def(u).abilities.flying; }
  isShooter(u) { return !!this.def(u).abilities.shots && u.shots > 0; }
  enemyAdjacent(u) {
    return neighbors(u.x, u.y).some((n) => { const o = this.unitAt(n.x, n.y); return o && o.side !== u.side; });
  }
  canShoot(u) { return this.isShooter(u) && !this.enemyAdjacent(u); }
  hexFree(x, y, ignore = null) {
    if (this.obstacles.has(key(x, y))) return false;
    const o = this.unitAt(x, y);
    return !o || o === ignore;
  }

  /** Map key->distance of hexes the unit can move to this turn (excluding its own hex). */
  reachable(u) {
    const speed = this.speedOf(u);
    const res = new Map();
    if (this.isFlyer(u)) {
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (x === u.x && y === u.y) continue;
        const d = hexDist(u, { x, y });
        if (d <= speed && this.hexFree(x, y)) res.set(key(x, y), d);
      }
      return res;
    }
    const dist = new Map([[key(u.x, u.y), 0]]);
    const q = [{ x: u.x, y: u.y }];
    while (q.length) {
      const cur = q.shift();
      const d = dist.get(key(cur.x, cur.y));
      if (d >= speed) continue;
      for (const nb of neighbors(cur.x, cur.y)) {
        const k = key(nb.x, nb.y);
        if (dist.has(k) || !this.hexFree(nb.x, nb.y)) continue;
        dist.set(k, d + 1);
        res.set(k, d + 1);
        q.push(nb);
      }
    }
    return res;
  }
  /** Shortest walking path (array of hexes, excluding start). */
  pathTo(u, tx, ty) {
    if (this.isFlyer(u)) return [{ x: tx, y: ty }];
    const prev = new Map([[key(u.x, u.y), null]]);
    const q = [{ x: u.x, y: u.y }];
    while (q.length) {
      const cur = q.shift();
      if (cur.x === tx && cur.y === ty) break;
      for (const nb of neighbors(cur.x, cur.y)) {
        const k = key(nb.x, nb.y);
        if (prev.has(k) || !this.hexFree(nb.x, nb.y)) continue;
        prev.set(k, cur);
        q.push(nb);
      }
    }
    const path = [];
    let cur = { x: tx, y: ty };
    if (!prev.has(key(tx, ty))) return null;
    while (cur && !(cur.x === u.x && cur.y === u.y)) { path.push(cur); cur = prev.get(key(cur.x, cur.y)); }
    return path.reverse();
  }
  /** Walking distance ignoring speed limit (for AI approach). Returns Map key->dist. */
  distanceField(u) {
    const dist = new Map([[key(u.x, u.y), 0]]);
    const q = [{ x: u.x, y: u.y }];
    const fly = this.isFlyer(u);
    while (q.length) {
      const cur = q.shift();
      const d = dist.get(key(cur.x, cur.y));
      for (const nb of neighbors(cur.x, cur.y)) {
        const k = key(nb.x, nb.y);
        if (dist.has(k)) continue;
        if (!fly && !this.hexFree(nb.x, nb.y)) {
          continue;
        }
        dist.set(k, d + 1);
        q.push(nb);
      }
    }
    return dist;
  }
  /** Hexes from which `u` could melee `target` this turn: [{x,y,dist}] */
  attackHexes(u, target, reach = null) {
    reach = reach || this.reachable(u);
    const out = [];
    for (const nb of neighbors(target.x, target.y)) {
      if (nb.x === u.x && nb.y === u.y) out.push({ x: nb.x, y: nb.y, dist: 0 });
      else if (reach.has(key(nb.x, nb.y))) out.push({ x: nb.x, y: nb.y, dist: reach.get(key(nb.x, nb.y)) });
    }
    return out;
  }

  // ------------------------------------------------------------------ damage
  /**
   * Compute damage. mode: 'random' | 'min' | 'max'
   */
  damage(att, def, opts = {}) {
    const c = this.def(att);
    const ranged = !!opts.ranged;
    let mode = opts.mode || 'random';
    const blessed = this.hasEffect(att, 'bless'), cursed = this.hasEffect(att, 'curse');
    let base;
    const n = att.count;
    const roll = (m) => {
      if (blessed && !cursed) return c.maxDmg;
      if (cursed && !blessed) return c.minDmg;
      if (m === 'min') return c.minDmg;
      if (m === 'max') return c.maxDmg;
      return this.rng.int(c.minDmg, c.maxDmg);
    };
    if (mode !== 'random' || n <= 10) {
      if (mode === 'random') { base = 0; for (let i = 0; i < n; i++) base += roll(mode); }
      else base = roll(mode) * n;
    } else {
      let s = 0;
      for (let i = 0; i < 10; i++) s += roll('random');
      base = s * n / 10;
    }
    const A = this.attackOf(att, !ranged), D = this.defenseOf(def);
    let mult = 1;
    if (A > D) mult += 0.05 * Math.min(A - D, 60);
    else mult *= 1 - 0.025 * Math.min(D - A, 28);
    let bonus = 0;
    const ah = this.heroOf(att), dh = this.heroOf(def);
    if (ah) bonus += ranged ? skillValue(ah, 'archery') : skillValue(ah, 'offense');
    if (c.abilities.hates && c.abilities.hates.includes(def.type)) bonus += 0.5;
    if (!ranged && c.abilities.jousting && !this.def(def).abilities.antiCavalry) bonus += 0.05 * (opts.moved ?? att.moved);
    let total = base * mult * (1 + bonus);
    if (dh) total *= 1 - skillValue(dh, 'armorer');
    if (ranged && opts.far) total *= 0.5;
    if (opts.meleeShooter && !c.abilities.noMeleePenalty) total *= 0.5;
    if (opts.retaliationHalf) total *= 0.5;
    if (opts.lucky) total *= 2;
    if (opts.deathBlow) total *= 2;
    return Math.max(1, Math.floor(total));
  }
  estimate(att, def, opts = {}) {
    const lo = this.damage(att, def, { ...opts, mode: 'min' });
    const hi = this.damage(att, def, { ...opts, mode: 'max' });
    return { lo, hi, killsLo: this.killsFor(def, lo), killsHi: this.killsFor(def, hi) };
  }
  killsFor(u, dmg) {
    const total = this.totalHp(u) - dmg;
    if (total <= 0) return u.count;
    return u.count - Math.ceil(total / this.unitHp(u));
  }
  applyDamage(u, dmg) {
    const before = u.count;
    const total = this.totalHp(u) - dmg;
    if (total <= 0) {
      u.count = 0; u.hpLeft = 0; u.dead = true;
      return before;
    }
    const hp = this.unitHp(u);
    u.count = Math.ceil(total / hp);
    u.hpLeft = total - (u.count - 1) * hp;
    return before - u.count;
  }
  heal(u, amount, allowRevive) {
    const hp = this.unitHp(u);
    if (!allowRevive) {
      const gained = Math.min(amount, hp - u.hpLeft);
      u.hpLeft += gained;
      return { healed: gained, revived: 0 };
    }
    const maxTotal = u.initialCount * hp;
    const before = u.dead ? 0 : this.totalHp(u);
    const after = Math.min(maxTotal, before + amount);
    const prevCount = u.dead ? 0 : u.count;
    if (after <= 0) return { healed: 0, revived: 0 };
    u.dead = false;
    u.count = Math.ceil(after / hp);
    u.hpLeft = after - (u.count - 1) * hp;
    return { healed: after - before, revived: u.count - prevCount };
  }

  name(u, count = u.count) { return creatureName(u.type, count); }

  // ------------------------------------------------------------------ turn flow
  /** Advance to the next unit. Returns events (round start, regen, morale freezes...). */
  beginTurn() {
    const ev = [];
    if (this.result) return ev;
    if (this.extraTurn && this.active && !this.active.dead) {
      this.extraTurn = false;
      return ev; // same unit acts again
    }
    this.extraTurn = false;
    for (let guard = 0; guard < 200; guard++) {
      if (!this.queue.length && !this.waitQueue.length) {
        if (this.round > 0) this.endRound(ev);
        if (this.result) return ev;
        this.startRound(ev);
      }
      let u;
      if (this.queue.length) u = this.queue.shift();
      else u = this.waitQueue.shift();
      if (!u || u.dead) continue;
      this.active = u;
      u.defending = false;
      ev.push({ t: 'turn', unit: u });
      // regeneration
      if (this.def(u).abilities.regenerate && u.hpLeft < this.unitHp(u)) {
        u.hpLeft = this.unitHp(u);
        ev.push({ t: 'regen', unit: u, msg: `${this.name(u)} מתחדשים.` });
      }
      // mana drain
      if (this.def(u).abilities.manaDrain) {
        const eh = this.sides[1 - u.side].hero;
        if (eh && eh.mana > 0) { const d = Math.min(2, eh.mana); eh.mana -= d; ev.push({ t: 'log', msg: `${this.name(u)} שואבים ${d} מאנה מ${eh.name}.` }); }
      }
      // blind: skip
      if (this.hasEffect(u, 'blind')) {
        ev.push({ t: 'log', unit: u, msg: `${this.name(u)} עיוורים ואינם פועלים.` });
        u.acted = true;
        continue;
      }
      // negative morale
      const m = this.unitMorale(u);
      if (m < 0 && !u.waited && this.rng.chance(-m / 12)) {
        ev.push({ t: 'morale', unit: u, good: false, msg: `מורל נמוך! ${this.name(u)} קופאים מפחד.` });
        u.acted = true;
        continue;
      }
      return ev;
    }
    return ev;
  }
  unitMorale(u) {
    if (this.def(u).abilities.undead || this.def(u).abilities.mindImmune) return 0;
    return this.sides[u.side].morale;
  }
  startRound(ev) {
    this.round++;
    this.sides.forEach((s) => { s.castThisRound = false; });
    for (const u of this.alive()) {
      u.retaliations = this.def(u).abilities.unlimitedRetaliation ? 999 : (this.def(u).abilities.retaliations || 1);
      u.waited = false; u.acted = false; u.moved = 0;
    }
    this.queue = this.alive().sort((a, b) => this.speedOf(b) - this.speedOf(a) || a.side - b.side || a.slot - b.slot);
    this.waitQueue = [];
    ev.push({ t: 'round', round: this.round, msg: `— סבב ${this.round} —` });
  }
  endRound(ev) {
    // towers shoot
    for (let i = 0; i < this.towers.length; i++) {
      const tw = this.towers[i];
      const targets = this.alive(1 - tw.side);
      if (!targets.length) break;
      const target = targets.reduce((a, b) => (this.def(b).value * b.count > this.def(a).value * a.count ? b : a));
      let base = 0;
      for (let k = 0; k < 2; k++) base += this.rng.int(tw.minDmg, tw.maxDmg);
      const D = this.defenseOf(target);
      let mult = 1;
      if (tw.attack > D) mult += 0.05 * (tw.attack - D); else mult *= 1 - 0.025 * Math.min(28, D - tw.attack);
      const dmg = Math.max(1, Math.round(base * 4 * mult));
      const kills = this.applyDamage(target, dmg);
      ev.push({ t: 'tower', tower: i, target, dmg, kills, msg: `מגדל החיצים יורה ב${this.name(target, 2)}: ${dmg} נזק, ${kills} נהרגים.` });
      if (target.dead) ev.push({ t: 'death', unit: target });
      this.checkEnd(ev);
      if (this.result) return;
    }
    // effects tick
    for (const u of this.alive()) {
      for (const e of u.effects) e.rounds--;
      const expired = u.effects.filter((e) => e.rounds <= 0);
      if (expired.length) {
        u.effects = u.effects.filter((e) => e.rounds > 0);
        for (const e of expired) ev.push({ t: 'effectEnd', unit: u, effect: e.id });
        if (u.hpLeft > this.unitHp(u)) u.hpLeft = this.unitHp(u);
      }
    }
  }
  /** Call after an action: handles morale bonus and end checks. */
  finishAction(u, ev, { allowMorale = true } = {}) {
    u.acted = true;
    this.checkEnd(ev);
    if (this.result || u.dead) return;
    const m = this.unitMorale(u);
    if (allowMorale && m > 0 && this.rng.chance(m / 24)) {
      this.extraTurn = true;
      ev.push({ t: 'morale', unit: u, good: true, msg: `מורל גבוה! ${this.name(u)} פועלים שוב.` });
    }
  }
  checkEnd(ev) {
    if (this.result) return;
    const a0 = this.alive(0).length, a1 = this.alive(1).length;
    if (a0 === 0 || a1 === 0) {
      const winner = a0 > 0 ? 0 : 1;
      this.result = { winner };
      ev.push({ t: 'end', winner });
    }
  }

  // ------------------------------------------------------------------ actions
  doWait(u) {
    const ev = [];
    if (u.waited) return this.doDefend(u);
    u.waited = true;
    // insert into wait queue: slower units act first among waiting (HoMM3 behaviour)
    this.waitQueue.push(u);
    this.waitQueue.sort((a, b) => this.speedOf(a) - this.speedOf(b));
    ev.push({ t: 'wait', unit: u, msg: `${this.name(u)} ממתינים.` });
    return ev;
  }
  doDefend(u) {
    const ev = [];
    u.defending = true;
    ev.push({ t: 'defend', unit: u, msg: `${this.name(u)} מתגוננים.` });
    this.finishAction(u, ev, { allowMorale: false });
    return ev;
  }
  doMove(u, x, y) {
    const ev = [];
    const path = this.pathTo(u, x, y);
    if (!path) return ev;
    ev.push({ t: 'move', unit: u, from: { x: u.x, y: u.y }, path, fly: this.isFlyer(u) });
    u.moved = this.isFlyer(u) ? hexDist(u, { x, y }) : path.length;
    u.x = x; u.y = y;
    this.finishAction(u, ev);
    return ev;
  }
  rollLuck(u) {
    if (this.def(u).abilities.undead && false) return false;
    const l = this.sides[u.side].luck;
    return l > 0 && this.rng.chance(l / 24);
  }
  /** One strike (used for attack, retaliation, second strike). */
  strike(att, def, ev, { retaliation = false, ranged = false, far = false, meleeShooter = false } = {}) {
    const lucky = this.rollLuck(att);
    const deathBlow = !!this.def(att).abilities.deathBlow && this.rng.chance(0.2);
    const retaliationHalf = retaliation && att.blindRetal;
    const dmg = this.damage(att, def, { ranged, far, meleeShooter, lucky, deathBlow, retaliationHalf });
    const kills = this.applyDamage(def, dmg);
    const one = att.count === 1;
    const verb = one ? (retaliation ? 'מגיב ותוקף' : ranged ? 'יורה ב' : 'תוקף') : (retaliation ? 'מגיבים ותוקפים' : ranged ? 'יורים ב' : 'תוקפים');
    let msg = `${this.name(att)} ${verb}${ranged ? '' : ' '}${this.name(def, 2)} ${one ? 'וגורם' : 'וגורמים'} ${dmg} נזק.`;
    if (kills > 0) msg += ` ${kills} ${creatureName(def.type, kills)} ${kills === 1 ? 'נהרג' : 'נהרגים'}.`;
    if (lucky) msg = 'מזל! ' + msg;
    if (deathBlow) msg = 'מכת מוות! ' + msg;
    const e = { t: ranged ? 'shoot' : 'attack', unit: att, target: def, dmg, kills, lucky, deathBlow, retaliation, msg, projectile: PROJECTILES[att.type] || 'arrow', far };
    ev.push(e);
    // remove blind / defend effects on hit
    if (def.effects.some((x) => x.id === 'blind')) { def.effects = def.effects.filter((x) => x.id !== 'blind'); def.blindRetal = true; }
    // special on-hit abilities
    const ab = this.def(att).abilities;
    if (!def.dead) {
      if (ab.curseHit && this.rng.chance(0.25) && !this.hasEffect(def, 'curse')) {
        def.effects.push({ id: 'curse', rounds: 3 }); ev.push({ t: 'status', unit: def, effect: 'curse', msg: `${this.name(def)} מקוללים!` });
      }
      if (ab.diseaseHit && this.rng.chance(0.2) && !this.def(def).abilities.undead && !this.hasEffect(def, 'disease')) {
        def.effects.push({ id: 'disease', rounds: 3 }); ev.push({ t: 'status', unit: def, effect: 'disease', msg: `${this.name(def)} חולים!` });
      }
      if (ab.agingHit && this.rng.chance(0.2) && !this.def(def).abilities.undead && !this.hasEffect(def, 'aging')) {
        def.effects.push({ id: 'aging', rounds: 3 });
        if (def.hpLeft > this.unitHp(def)) def.hpLeft = this.unitHp(def);
        ev.push({ t: 'status', unit: def, effect: 'aging', msg: `${this.name(def)} מזדקנים!` });
      }
    }
    // life drain
    if (ab.lifeDrain && !this.def(def).abilities.undead && !this.def(def).abilities.mindImmune) {
      const r = this.heal(att, dmg, true);
      if (r.healed > 0) ev.push({ t: 'drain', unit: att, amount: r.healed, revived: r.revived, msg: r.revived > 0 ? `${this.name(att)} מוצצים חיים ומקימים ${r.revived} חברים.` : `${this.name(att)} מוצצים חיים.` });
    }
    if (def.dead) ev.push({ t: 'death', unit: def, msg: `${this.name(def, 2)} הושמדו.` });
    return e;
  }
  splash(att, centerHex, ev, kind, behindOf = null) {
    const hits = [];
    let hexes = [];
    if (kind === 'cloud') hexes = neighbors(centerHex.x, centerHex.y);
    if (kind === 'breath' && behindOf) { const b = hexBehind(behindOf, centerHex); if (b) hexes = [b]; }
    for (const hx of hexes) {
      const v = this.unitAt(hx.x, hx.y);
      if (!v || v === att) continue;
      if (kind === 'cloud' && this.def(v).abilities.undead) continue;
      const dmg = this.damage(att, v, { ranged: kind === 'cloud' });
      const kills = this.applyDamage(v, dmg);
      hits.push({ unit: v, dmg, kills });
      if (v.dead) ev.push({ t: 'death', unit: v });
    }
    if (hits.length) ev.push({ t: 'splash', unit: att, kind, hits, msg: `${kind === 'cloud' ? 'ענן המוות' : 'נשיפת האש'} פוגע גם ב${hits.map((h) => this.name(h.unit, 2)).join(', ')}.` });
  }
  doAttack(u, target, fromX, fromY) {
    const ev = [];
    if (fromX !== u.x || fromY !== u.y) {
      const path = this.pathTo(u, fromX, fromY);
      if (!path) return ev;
      ev.push({ t: 'move', unit: u, from: { x: u.x, y: u.y }, path, fly: this.isFlyer(u) });
      u.moved = this.isFlyer(u) ? hexDist(u, { x: fromX, y: fromY }) : path.length;
      u.x = fromX; u.y = fromY;
    } else u.moved = 0;
    const meleeShooter = !!this.def(u).abilities.shots;
    const ab = this.def(u).abilities;
    this.strike(u, target, ev, { meleeShooter });
    if (ab.breath) this.splash(u, { x: target.x, y: target.y }, ev, 'breath', { x: u.x, y: u.y });
    // retaliation
    if (!target.dead && !ab.noRetaliation && target.retaliations > 0 && !this.hasEffect(target, 'blind')) {
      target.retaliations--;
      this.strike(target, u, ev, { retaliation: true, meleeShooter: !!this.def(target).abilities.shots });
      if (this.def(target).abilities.breath && !u.dead) this.splash(target, { x: u.x, y: u.y }, ev, 'breath', { x: target.x, y: target.y });
    }
    target.blindRetal = false;
    // double attack
    if (ab.doubleAttack && !u.dead && !target.dead) {
      this.strike(u, target, ev, { meleeShooter });
      if (!target.dead && !ab.noRetaliation && target.retaliations > 0) {
        target.retaliations--;
        this.strike(target, u, ev, { retaliation: true });
      }
    }
    this.finishAction(u, ev);
    return ev;
  }
  doShoot(u, target) {
    const ev = [];
    const far = hexDist(u, target) > 10;
    const ab = this.def(u).abilities;
    const times = ab.doubleShot ? 2 : 1;
    for (let k = 0; k < times && !target.dead && u.shots > 0; k++) {
      u.shots--;
      this.strike(u, target, ev, { ranged: true, far });
      if (ab.cloudShot) this.splash(u, { x: target.x, y: target.y }, ev, 'cloud');
    }
    this.finishAction(u, ev);
    return ev;
  }
  /** Archangel resurrection special. */
  doResurrect(u, target) {
    const ev = [];
    if (u.resurrectUsed) return ev;
    u.resurrectUsed = true;
    const r = this.heal(target, 100 * u.count, true);
    ev.push({ t: 'resurrect', unit: u, target, revived: r.revived, msg: `${this.name(u)} מקימים לתחייה ${r.revived} ${creatureName(target.type, r.revived)}!` });
    this.finishAction(u, ev);
    return ev;
  }

  // ------------------------------------------------------------------ spells
  canCast(side) {
    const s = this.sides[side];
    return !!s.hero && !s.castThisRound && s.hero.spells.length > 0;
  }
  spellPower(side) { return heroStat(this.sides[side].hero, 'power'); }
  spellCost(side, spellId) { return SPELLS[spellId].mana; }
  /** Valid target for a spell at hex? */
  spellTargetValid(side, spellId, x, y) {
    const sp = SPELLS[spellId];
    const u = this.unitAt(x, y);
    if (sp.target === 'all') return true;
    if (sp.target === 'area' || sp.target === 'ring') return inField(x, y);
    if (sp.kind === 'resurrect') {
      const t = u || this.corpseAt(x, y);
      return !!t && t.side === side && (t.dead || t.count < t.initialCount) && !this.def(t).abilities.undead;
    }
    if (!u) return false;
    if (sp.target === 'enemy' && u.side === side) return false;
    if (sp.target === 'ally' && u.side !== side) return false;
    if (sp.mind && (this.def(u).abilities.undead || this.def(u).abilities.mindImmune)) return false;
    return true;
  }
  spellDamageTo(side, sp, u, base) {
    const hero = this.sides[side].hero;
    let d = base * (1 + skillValue(hero, 'sorcery'));
    const mr = this.def(u).abilities.magicResist || 0;
    d *= 1 - mr;
    return Math.max(1, Math.round(d));
  }
  castSpell(side, spellId, x, y) {
    const ev = [];
    const s = this.sides[side];
    const sp = SPELLS[spellId];
    const hero = s.hero;
    hero.mana -= sp.mana;
    s.castThisRound = true;
    const power = heroStat(hero, 'power');
    const hits = [];
    const victims = [];
    if (sp.target === 'area') { const c = this.unitAt(x, y); if (c) victims.push(c); for (const nb of neighbors(x, y)) { const v = this.unitAt(nb.x, nb.y); if (v) victims.push(v); } }
    else if (sp.target === 'ring') { for (const nb of neighbors(x, y)) { const v = this.unitAt(nb.x, nb.y); if (v) victims.push(v); } }
    else if (sp.target === 'all') victims.push(...this.alive());
    else if (sp.kind === 'resurrect') { const t = this.unitAt(x, y) || this.corpseAt(x, y); if (t) victims.push(t); }
    else { const t = this.unitAt(x, y); if (t) victims.push(t); }

    const heroName = hero.name;
    const verb = hero.gender === 'f' ? 'מטילה' : 'מטיל';
    let msg = `${heroName} ${verb} "${sp.name}"`;

    if (sp.kind === 'damage') {
      if (spellId === 'chainLightning') {
        let cur = victims[0];
        let base = sp.dmg(power);
        const hitSet = new Set();
        for (let k = 0; k < 4 && cur; k++) {
          hitSet.add(cur);
          const dmg = this.spellDamageTo(side, sp, cur, base);
          const kills = this.applyDamage(cur, dmg);
          hits.push({ unit: cur, dmg, kills });
          base /= 2;
          const prev = cur;
          cur = this.alive().filter((v) => !hitSet.has(v)).sort((a, b) => hexDist(prev, a) - hexDist(prev, b))[0];
        }
      } else {
        for (const v of victims) {
          const dmg = this.spellDamageTo(side, sp, v, sp.dmg(power));
          const kills = this.applyDamage(v, dmg);
          hits.push({ unit: v, dmg, kills });
        }
      }
      msg += hits.length ? `: ${hits.map((h) => `${this.name(h.unit, 2)} ${h.dmg} נזק${h.kills ? ` (${h.kills} נהרגים)` : ''}`).join(', ')}.` : '.';
    } else if (sp.kind === 'heal') {
      for (const v of victims) {
        v.effects = v.effects.filter((e) => !['curse', 'slow', 'weakness', 'blind', 'disease', 'aging'].includes(e.id));
        const r = this.heal(v, sp.heal(power), false);
        hits.push({ unit: v, healed: r.healed });
      }
      msg += ` על ${victims.map((v) => this.name(v, 2)).join(', ')}.`;
    } else if (sp.kind === 'resurrect') {
      for (const v of victims) {
        const r = this.heal(v, sp.heal(power), true);
        hits.push({ unit: v, healed: r.healed, revived: r.revived });
        msg += ` ו${hero.gender === 'f' ? 'מקימה' : 'מקים'} ${r.revived} ${creatureName(v.type, r.revived)} לתחייה.`;
      }
    } else {
      const dur = spellDuration(power);
      for (const v of victims) {
        // opposing effects cancel
        const opp = { bless: 'curse', curse: 'bless', haste: 'slow', slow: 'haste' }[sp.effect];
        v.effects = v.effects.filter((e) => e.id !== sp.effect && e.id !== opp);
        v.effects.push({ id: sp.effect, rounds: dur });
        hits.push({ unit: v, effect: sp.effect });
      }
      msg += ` על ${victims.map((v) => this.name(v, 2)).join(', ')} (${EFFECT_NAMES[sp.effect]}, ${dur} סבבים).`;
    }
    ev.push({ t: 'spell', side, spell: spellId, x, y, hits, msg });
    for (const h of hits) if (h.unit.dead && sp.kind === 'damage') ev.push({ t: 'death', unit: h.unit });
    this.checkEnd(ev);
    return ev;
  }

  flee(side) {
    const ev = [];
    this.sides[side].fled = true;
    this.result = { winner: 1 - side, fled: side };
    ev.push({ t: 'end', winner: 1 - side, fled: side, msg: `${this.sides[side].hero?.name || ''} נס מהקרב!` });
    return ev;
  }

  // ------------------------------------------------------------------ results
  /** Write results back to armies; returns casualty summary. */
  applyResults() {
    const summary = [{ lost: {}, killedHp: 0 }, { lost: {}, killedHp: 0 }];
    for (const s of this.sides) {
      for (let i = 0; i < s.army.length; i++) if (s.army[i]) s.army[i] = null;
    }
    for (const u of this.units) {
      const side = this.sides[u.side];
      const lost = u.initialCount - (u.dead ? 0 : u.count);
      if (lost > 0) {
        summary[u.side].lost[u.type] = (summary[u.side].lost[u.type] || 0) + lost;
        summary[1 - u.side].killedHp += lost * this.def(u).hp;
      }
      if (!u.dead && u.count > 0 && !side.fled) {
        const slot = u.slot;
        if (!side.army[slot]) side.army[slot] = { type: u.type, count: u.count };
        else if (side.army[slot].type === u.type) side.army[slot].count += u.count;
        else {
          const free = side.army.findIndex((x) => !x);
          if (free >= 0) side.army[free] = { type: u.type, count: u.count };
        }
      }
    }
    // a hero's army must never be empty if the side won: keep at least 1 creature of the strongest original stack
    this.summary = summary;
    return summary;
  }

  /** Total value of units (for AI / auto-resolve). */
  sideValue(side) { return this.alive(side).reduce((a, u) => a + u.count * this.def(u).value, 0); }
}

export function maxManaOf(hero) { return heroMaxMana(hero); }
