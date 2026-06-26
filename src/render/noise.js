// =============================================================================
// Value noise + fbm — for organic, painterly terrain texture (render only).
// Seeded so a baked map is stable and never shimmers between re-bakes.
// =============================================================================

import { makeRng } from '../engine/rng.js';

export function makeNoise(seed = 1) {
  const rng = makeRng(seed);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) vals[i] = rng() * 2 - 1; // [-1, 1]
  const perm = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const at = (xi, yi) => vals[perm[(perm[xi & 255] + yi) & 255]];

  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = fade(xf), v = fade(yf);
    return lerp(
      lerp(at(xi, yi), at(xi + 1, yi), u),
      lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u),
      v,
    );
  }

  // Fractal sum — richer, cloudier texture. Returns roughly [-1, 1].
  function fbm(x, y, octaves = 4) {
    let amp = 0.5, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise2(x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }

  return { noise2, fbm };
}
