// Tiny seedable PRNG (mulberry32). Kept in the engine so simulation is fully
// deterministic given a seed — important for reproducible runs and headless
// tests. The browser seeds it from the clock; tests seed it with a constant.
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const rng = function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
  rng.range = (min, max) => min + rng() * (max - min);
  rng.chance = (p) => rng() < p;
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return rng;
}
