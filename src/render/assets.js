// =============================================================================
// Assets — runtime image loader + registry (art pipeline).
//
// The game ships an `assets/` folder with a `manifest.json` listing the images
// that actually exist. At boot we fetch the manifest and preload each image.
// Renderers ask `hasAsset(key)` before drawing, so the game ALWAYS works with
// zero assets present (it just falls back to the procedural look) and any image
// dropped into the manifest appears automatically — no code change needed.
//
// Kinds:
//   - 'texture' : tileable, used as a repeating CanvasPattern (soil, rock face)
//   - 'sprite'  : a single transparent PNG drawn with drawImage (props, props)
//
// Renderer-agnostic except that it constructs Image()/patterns — i.e. browser
// only. It is never imported by the engine.
// =============================================================================

const REG = {};              // key -> { img, ready, meta }
const _patterns = new Map(); // key -> CanvasPattern (cached)

// Cache-bust query (build-time content hash, injected by build.mjs). Ensures a
// new deploy refetches manifest.json + images instead of serving stale cached
// copies (GitHub Pages sends max-age=600 on everything).
const VER = (typeof globalThis !== 'undefined' && globalThis.__ASSET_VER) ? '?v=' + globalThis.__ASSET_VER : '';

// Fetch the manifest and preload every listed image. Resolves once all images
// have settled (loaded OR failed) so a missing file never blocks boot.
export function loadAssets(basePath = 'assets/') {
  return fetch(basePath + 'manifest.json' + VER)
    .then((r) => (r.ok ? r.json() : { assets: [] }))
    .catch(() => ({ assets: [] }))
    .then((m) => {
      const list = (m && m.assets) || [];
      return Promise.all(list.map((a) => loadOne(basePath, a)));
    })
    .catch(() => {});
}

function loadOne(basePath, a) {
  return new Promise((resolve) => {
    if (!a || !a.key || !a.file) return resolve();
    const img = new Image();
    img.onload = () => { REG[a.key] = { img, ready: true, meta: a }; resolve(); };
    img.onerror = () => { REG[a.key] = { img: null, ready: false, meta: a }; resolve(); };
    img.src = basePath + a.file + VER;
  });
}

// Warm the browser cache with the card-face JPGs so they don't pop in one by one
// when a draft offer or the hand carousel first shows them. These are DOM <img>
// (drawn by ui.js), not canvas assets — so we just prime the HTTP cache with the
// SAME urls ui.js uses (no version query, matching cardArt()). Fire-and-forget.
export function preloadCardArt(slugs, basePath = 'assets/cards/') {
  for (const slug of slugs) { const img = new Image(); img.src = basePath + slug + '.jpg'; }
}

export function hasAsset(key) { return !!(REG[key] && REG[key].ready); }
export function asset(key) { const e = REG[key]; return e && e.ready ? e.img : null; }
export function assetMeta(key) { const e = REG[key]; return e ? e.meta : null; }

// A cached repeating pattern for a tileable texture (null if not loaded).
export function pattern(ctx, key) {
  if (!hasAsset(key)) return null;
  if (_patterns.has(key)) return _patterns.get(key);
  const p = ctx.createPattern(REG[key].img, 'repeat');
  _patterns.set(key, p);
  return p;
}
