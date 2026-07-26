// Bundles the ES-module game into a single self-contained HTML file.
//
//   node build.mjs
//
// Produces:
//   dist/index.html    — full standalone page (open or deploy anywhere)
//   dist/artifact.html — body-only (for hosts that supply their own <head>)
//
// Each module is wrapped in its own closure and registered in a small registry,
// so every module KEEPS ITS OWN SCOPE — two modules can define a private helper
// of the same name without clobbering each other (which a flat concatenation
// would do). Imports are rewired to read from the registry; exports are
// collected from each closure's return value. No runtime module loading.

import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, readdirSync, statSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, posix } from 'path';

const root = dirname(fileURLToPath(import.meta.url));
const R = (p) => join(root, p);

// Dependency order: a module's deps must be registered before it runs.
const MODULES = [
  'src/config.js',
  'src/cards-data.js',
  'src/levels-data.js',
  'src/species.js',
  'src/highscores.js',
  'src/net_scores.js',
  'src/engine/rng.js',
  'src/engine/substrate.js',
  'src/engine/network.js',
  'src/engine/nematodes.js',
  'src/engine/threats.js',
  'src/engine/ants.js',
  'src/engine/puzzle.js',
  'src/engine/level.js',
  'src/engine/state.js',
  'src/engine/cards.js',
  'src/engine/turn.js',
  'src/engine/actions.js',
  'src/render/camera.js',
  'src/render/noise.js',
  'src/render/assets.js',
  'src/render/substrate.js',
  'src/render/sfx.js',
  'src/render/network.js',
  'src/render/lighting.js',
  'src/render/music.js',
  'src/render/ui.js',
  'src/render/mycelium_title.js',
  'src/render/species_select.js',
  'src/render/loadout_select.js',
  'src/render/title_screen.js',
  'src/render/tutorial.js',
  'src/render/level_intro.js',
  'src/render/loading.js',
  'src/render/highscores.js',
  'src/render/credits.js',
  'src/main.js',
];

const idOf = (p) => p.replace(/^src\//, '').replace(/\.js$/, '');
const safe = (id) => '__m_' + id.replace(/[^a-z0-9]/gi, '_');

// Resolve an import specifier relative to the importing file (src-relative id).
function resolveSpec(fromFile, spec) {
  const fromId = idOf(fromFile);            // e.g. render/substrate
  const dir = posix.dirname('src/' + fromId + '.js'); // src/render
  const abs = posix.normalize(posix.join(dir, spec));  // src/render/../engine/rng.js
  return idOf(abs.replace(/^src\//, 'src/'));
}

const IMPORT_RE = /^\s*import\s*\{([^}]*)\}\s*from\s*['"](.+?)['"];?\s*$/;
const EXPORT_DECL_RE = /^\s*export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/;

function transform(file) {
  const src = readFileSync(R(file), 'utf8');
  const id = idOf(file);
  const lines = src.split('\n');
  const injects = [];   // `const { a, b } = __m_dep;`
  const exports = [];   // exported names
  const body = [];

  for (const line of lines) {
    const imp = line.match(IMPORT_RE);
    if (imp) {
      const names = imp[1].split(',').map((s) => s.trim()).filter(Boolean);
      const dep = resolveSpec(file, imp[2]);
      injects.push(`  const { ${names.join(', ')} } = ${safe(dep)};`);
      continue;
    }
    const exp = line.match(EXPORT_DECL_RE);
    if (exp) exports.push(exp[1]);
    body.push(line.replace(/^(\s*)export\s+/, '$1'));
  }

  return `const ${safe(id)} = (function () {\n` +
    injects.join('\n') + (injects.length ? '\n' : '') +
    body.join('\n') + '\n' +
    `  return { ${exports.join(', ')} };\n` +
    `})();`;
}

// A short build stamp so a running device can be identified (shown in the HUD).
const BUILD = (process.env.GITHUB_SHA || '').slice(0, 7)
  || ('local ' + new Date().toISOString().slice(5, 16).replace('T', ' '));
const js = `globalThis.__BUILD__ = ${JSON.stringify(BUILD)};\n\n` + MODULES
  .map((f) => `// ===================== ${f} =====================\n${transform(f)}`)
  .join('\n\n');

// Pull the CSS straight out of index.html so there is one source of truth.
const indexHtml = readFileSync(R('index.html'), 'utf8');
const css = indexHtml.match(/<style>([\s\S]*?)<\/style>/)[1].trim();

// Content-based asset version: changes when the bundle OR any asset file
// changes, so a new deploy always busts the cached manifest.json + image
// fetches (GitHub Pages serves everything with max-age=600, which otherwise
// hides freshly-changed art).
const ver = (() => {
  let h = 5381;
  const mix = (s) => { for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; };
  mix(js); mix(css);
  // fold in each asset's name + size + mtime so changed art bumps the version
  try {
    for (const f of readdirSync(R('assets')).sort()) {
      const st = statSync(R('assets/' + f));
      if (st.isFile()) mix(f + ':' + st.size + ':' + Math.floor(st.mtimeMs));
    }
  } catch {}
  return (h >>> 0).toString(36);
})();

const faviconDataUri = 'data:image/svg+xml;base64,' + readFileSync(R('assets/favicon.svg')).toString('base64');
const body = `<title>Mycelium</title>
<meta name="description" content="A 2D roguelike engine-builder themed on the life of a fungal colony — steer, defend, and fruit a living mycelial network." />
<style>
${css}
</style>
<canvas id="game"></canvas>
<div id="ui"></div>
<script>
'use strict';
window.__ASSET_VER = ${JSON.stringify(ver)};
${js}
</script>`;

const standalone = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="icon" type="image/svg+xml" href="${faviconDataUri}" />
${body}
</head>
<body>
</body>
</html>`;

mkdirSync(R('dist'), { recursive: true });
writeFileSync(R('dist/index.html'), standalone);
writeFileSync(R('dist/artifact.html'), body);

// Copy the image-asset folder (textures/sprites + manifest) alongside the build
// so the deployed page can load them at runtime. Optional — the game runs fine
// with no assets folder at all. We SKIP the authoring-candidate folders (*_options,
// card_art_archive) — the runtime never fetches them (nothing in manifest.json or the
// UI references them), so they'd only bloat the deploy (~36MB). Source assets/ is
// untouched; only the dist copy is slimmed.
const SKIP_ASSET_DIR = /(?:^|[\/\\])(?:[^\/\\]*_options|card_art_archive)(?:[\/\\]|$)/;
if (existsSync(R('assets'))) {
  rmSync(R('dist/assets'), { recursive: true, force: true });   // clean slate so trimmed folders don't linger
  cpSync(R('assets'), R('dist/assets'), { recursive: true, filter: (src) => !SKIP_ASSET_DIR.test(src) });
  console.log('Copied assets/ -> dist/assets/ (authoring candidates excluded)');
}

// Publish the standalone card cost/description editor alongside the game so it's
// reachable on the deployed site at <site>/card-editor.html. It's self-contained
// (cards.json inlined); regenerate it with `node scripts/build_cardeditor.mjs`.
if (existsSync(R('docs/card-editor.html'))) {
  cpSync(R('docs/card-editor.html'), R('dist/card-editor.html'));
  console.log('Copied docs/card-editor.html -> dist/card-editor.html');
}

// Publish the run-analytics dashboard at <site>/analytics.html (owner tool; reads the
// Supabase `events` telemetry table). Self-contained; excluded from the itch zip (which
// only ships index.html + assets/). Bake the species id->common-name map so the dashboard
// shows "Fairy Ring Champignon" instead of "marasmius".
if (existsSync(R('docs/analytics.html'))) {
  const sp = await import('./src/species.js');
  const names = {};
  for (const s of sp.SPECIES) names[s.id] = s.name;
  let aHtml = readFileSync(R('docs/analytics.html'), 'utf8');
  aHtml = aHtml.replace('<script id="speciesNames" type="application/json"></script>',
    '<script id="speciesNames" type="application/json">' + JSON.stringify(names).replace(/</g, '\\u003c') + '</script>');
  writeFileSync(R('dist/analytics.html'), aHtml);
  console.log('Copied docs/analytics.html -> dist/analytics.html (species names injected)');
}

// Publish the species editor at <site>/species-editor.html. It live-imports ../src when
// run from the source tree, but dist/ has no src/, so BAKE the current roster + a slim
// card list into its #injectedData tag (the page prefers that when present).
if (existsSync(R('docs/species-editor.html'))) {
  const sp = await import('./src/species.js');
  const cd = await import('./src/cards-data.js');
  const slimCards = cd.CARD_DATA.map((c) => ({ name: c.name, type: c.type, displayCategory: c.displayCategory }));
  const data = JSON.stringify({ SPECIES: sp.SPECIES, LOCKED_TIERS: sp.LOCKED_TIERS, CARD_DATA: slimCards }).replace(/</g, '\\u003c');
  let seHtml = readFileSync(R('docs/species-editor.html'), 'utf8');
  seHtml = seHtml.replace('<script id="injectedData" type="application/json"></script>',
    '<script id="injectedData" type="application/json">' + data + '</script>');
  writeFileSync(R('dist/species-editor.html'), seHtml);
  console.log('Copied docs/species-editor.html -> dist/species-editor.html (roster injected)');
}

// Publish the level editor at <site>/level-editor.html. It's fully self-contained
// (no src/ imports) and finds the sprite folder itself — ../assets/ from the source
// tree, assets/ from dist/ — so a plain copy is all it needs. Owner tool; excluded
// from the itch zip, which ships only index.html + assets/.
if (existsSync(R('docs/level-editor.html'))) {
  cpSync(R('docs/level-editor.html'), R('dist/level-editor.html'));
  console.log('Copied docs/level-editor.html -> dist/level-editor.html');
}

// Publish the rock tuner at <site>/rock-tuner.html — the owner grades new rock sprites there
// and hands back a settings JSON that scripts/rock_cut.py applies. Self-contained and it finds
// its own sprite folder, same as the level editor. It reads assets/rock_candidates/, which is
// NOT an authoring *_options folder so the asset copy above already brings it along. Owner tool;
// excluded from the itch zip.
if (existsSync(R('docs/rock-tuner.html'))) {
  cpSync(R('docs/rock-tuner.html'), R('dist/rock-tuner.html'));
  console.log('Copied docs/rock-tuner.html -> dist/rock-tuner.html');
}

console.log('Built dist/index.html and dist/artifact.html');
console.log(`Bundle size: ${(standalone.length / 1024).toFixed(1)} KB`);
