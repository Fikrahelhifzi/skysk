/*
 * rng.js — semua angka acak LOGIKA game lewat sini (pengganti modul random Python).
 * Saat main: memakai Math.random. Saat uji paritas: memakai benih tetap (seed) yang
 * sama persis dengan stub Python, sehingga hasil kedua versi bisa dibandingkan.
 */

export function mulberry32(seed) {
  let a = seed | 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bisect_right(arr, x, lo, hi) {
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (x < arr[mid]) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export const R = {
  next: Math.random,
  random() { return this.next(); }, // random.random()
  uniform(a, b) { return a + (b - a) * this.next(); }, // random.uniform(a, b)
  randint(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }, // random.randint(a, b)
  choice(seq) { return seq[Math.floor(this.next() * seq.length)]; }, // random.choice(seq)
  choices(population, weights) { // random.choices(population, weights)
    const cum = [];
    let acc = 0;
    for (const w of weights) { acc += w; cum.push(acc); }
    const total = cum[cum.length - 1] + 0.0;
    return [population[bisect_right(cum, this.next() * total, 0, population.length - 1)]];
  },
  seed(n) { this.next = mulberry32(n); },
  use_math_random() { this.next = Math.random; },
};
