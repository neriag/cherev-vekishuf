// ============================================================================
//  מציאת מסלול על מפת ההרפתקאות (דייקסטרה רב-תורית)
// ============================================================================
import { TERRAINS, ROAD_COST } from '../data/terrain.js';
import { heroMaxMP, skillValue } from '../core/state.js';

const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function stepCost(state, hero, fx, fy, tx, ty) {
  const M = state.map, w = M.w;
  const a = fy * w + fx, b = ty * w + tx;
  let c;
  if (M.road[a] && M.road[b]) c = ROAD_COST;
  else {
    const base = TERRAINS[M.terrain[b]].cost;
    const pf = hero ? skillValue(hero, 'pathfinding') : 0;
    c = 100 + Math.max(0, base - 100) * (1 - pf);
    // native terrain: no penalty
    if (hero && (hero.faction === 'castle' && M.terrain[b] === 'grass' || hero.faction === 'necropolis' && M.terrain[b] === 'ash')) c = Math.min(c, 100);
  }
  if (fx !== tx && fy !== ty) c *= 1.414;
  return Math.round(c);
}

/** What occupies a tile from the hero's point of view. */
export function tileInfo(state, x, y, hero) {
  const i = y * state.map.w + x;
  const heroId = state.heroAt[i];
  if (heroId && heroId !== hero.id) return { kind: 'hero', id: heroId };
  const objId = state.objAt[i];
  if (objId) {
    const o = state.objects[objId];
    if (o.type === 'town') {
      if (o.entrance.x === x && o.entrance.y === y) return { kind: 'townEntrance', id: objId };
      return { kind: 'townBlock', id: objId };
    }
    return { kind: 'object', id: objId };
  }
  if (state.map.blocked[i]) return { kind: 'blocked' };
  if (state.guardAt[i]) return { kind: 'guarded', id: state.guardAt[i] };
  return { kind: 'free' };
}

/**
 * Multi-turn Dijkstra from the hero's position.
 * Returns { turn: Int16Array, left: Int32Array, prev: Int32Array }
 * Tiles: free tiles and town entrances are standable; guarded tiles are standable but not expandable.
 */
export function computeReach(state, hero, maxTurns = 8) {
  const M = state.map, w = M.w, h = M.h, n = w * h;
  const turn = new Int16Array(n).fill(32767);
  const left = new Int32Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const maxMP = heroMaxMP(hero);
  const start = hero.y * w + hero.x;
  turn[start] = 0; left[start] = hero.mp;
  // simple bucketed priority: key = turn * 100000 + (maxMP*2 - left)
  const heap = new MinHeap();
  heap.push(0 * 100000 + (200000 - hero.mp) / 10, start);
  const better = (t1, l1, t2, l2) => t1 < t2 || (t1 === t2 && l1 > l2);
  while (heap.size) {
    const cur = heap.pop();
    const cx = cur % w, cy = (cur / w) | 0;
    if (cur !== start) {
      const info = tileInfo(state, cx, cy, hero);
      if (info.kind === 'guarded' || info.kind === 'townEntrance') continue; // cannot pass through
    }
    for (const [dx, dy] of DIRS8) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      const info = tileInfo(state, nx, ny, hero);
      if (info.kind !== 'free' && info.kind !== 'guarded' && info.kind !== 'townEntrance') continue;
      const c = stepCost(state, hero, cx, cy, nx, ny);
      let t = turn[cur], l = left[cur];
      if (l >= c) l -= c;
      else { t += 1; l = maxMP - c; }
      if (t > maxTurns) continue;
      if (better(t, l, turn[j], left[j])) {
        turn[j] = t; left[j] = l; prev[j] = cur;
        heap.push(t * 100000 + (200000 - l) / 10, j);
      }
    }
  }
  return { turn, left, prev, maxMP };
}

function reconstruct(state, reach, endIdx) {
  const w = state.map.w;
  const steps = [];
  let cur = endIdx;
  while (cur >= 0 && reach.prev[cur] >= 0) {
    steps.push({ x: cur % w, y: (cur / w) | 0, turn: reach.turn[cur], left: reach.left[cur] });
    cur = reach.prev[cur];
  }
  return steps.reverse();
}

/**
 * Plan a path to clicked tile (tx,ty).
 * Returns null if unreachable, else { steps:[{x,y,turn}], interact:{kind,id,x,y,turn}|null }
 */
export function planPath(state, hero, tx, ty, reach = null) {
  reach = reach || computeReach(state, hero, 12);
  const w = state.map.w;
  if (tx === hero.x && ty === hero.y) return null;
  let info = tileInfo(state, tx, ty, hero);
  if (info.kind === 'townBlock') {
    const t = state.objects[info.id];
    tx = t.entrance.x; ty = t.entrance.y;
    info = tileInfo(state, tx, ty, hero);
    if (tx === hero.x && ty === hero.y) return { steps: [], interact: { kind: 'town', id: t.id, x: tx, y: ty, turn: 0, inPlace: true } };
  }
  if (info.kind === 'blocked') return null;
  if (info.kind === 'free' || info.kind === 'guarded' || info.kind === 'townEntrance') {
    const j = ty * w + tx;
    if (reach.left[j] < 0) return null;
    const steps = reconstruct(state, reach, j);
    let interact = null;
    if (info.kind === 'townEntrance') interact = { kind: 'town', id: info.id, x: tx, y: ty, turn: reach.turn[j] };
    return { steps, interact };
  }
  // bump interactions: object or hero → stand on best adjacent tile then bump
  let best = -1, bt = 32767, bl = -1;
  const startIdx = hero.y * w + hero.x;
  for (const [dx, dy] of DIRS8) {
    const nx = tx + dx, ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= state.map.h) continue;
    const j = ny * w + nx;
    if (reach.left[j] < 0) continue;
    if (j !== startIdx) {
      const ni = tileInfo(state, nx, ny, hero);
      // can't stand on a guarded tile of a different monster before bumping, or on a town entrance
      if (ni.kind === 'townEntrance') continue;
      if (ni.kind === 'guarded' && ni.id !== info.id) continue;
    }
    // cost of the bump
    const c = stepCost(state, hero, nx, ny, tx, ty);
    let t = reach.turn[j], l = reach.left[j];
    if (l >= c) l -= c; else { t++; l = reach.maxMP - c; }
    if (t < bt || (t === bt && l > bl)) { bt = t; bl = l; best = j; }
  }
  if (best < 0) return null;
  const steps = best === startIdx ? [] : reconstruct(state, reach, best);
  return { steps, interact: { kind: info.kind, id: info.id, x: tx, y: ty, turn: bt } };
}

// --------------------------------------------------------------------------- binary heap
class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    k.push(key); v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop() {
    const k = this.k, v = this.v;
    const top = v[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}
