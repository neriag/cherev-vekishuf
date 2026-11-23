// ============================================================================
//  מחולל מספרים אקראיים עם זרע + רעש (noise) לייצור מפות
// ============================================================================

export class RNG {
  constructor(seed = Date.now()) {
    this.state = (seed >>> 0) || 1;
  }
  next() {
    // mulberry32
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float(a = 0, b = 1) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.next()); } // inclusive
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  weighted(obj) {
    // obj: {key: weight}
    let total = 0;
    for (const k in obj) total += obj[k];
    let r = this.next() * total;
    for (const k in obj) {
      r -= obj[k];
      if (r <= 0) return k;
    }
    return Object.keys(obj)[0];
  }
}

// global non-seeded helper rng for gameplay randomness (battle rolls etc.)
export const rand = new RNG((Math.random() * 2 ** 31) | 0);

/** Hash-based 2D value noise with smooth interpolation. */
export function makeNoise2D(seed) {
  const perm = new Uint8Array(512);
  const r = new RNG(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  r.shuffle(p);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => {
    const g = h & 7;
    const u = g < 4 ? x : y, v = g < 4 ? y : x;
    return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v);
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  function noise(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = perm[X] + Y, b = perm[X + 1] + Y;
    return lerp(
      lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u),
      lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u),
      v,
    ) * 0.25; // ~[-1,1]
  }
  noise.fbm = (x, y, oct = 4) => {
    let s = 0, a = 1, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f); n += a; a *= 0.5; f *= 2; }
    return s / n;
  };
  return noise;
}

export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
