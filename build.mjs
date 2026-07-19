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

import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, posix } from 'path';

const root = dirname(fileURLToPath(import.meta.url));
const R = (p) => join(root, p);

// Dependency order: a module's deps must be registered before it runs.
const MODULES = [
  'src/config.js',
  'src/cards-data.js',
  'src/species.js',
  'src/engine/rng.js',
  'src/engine/substrate.js',
  'src/engine/network.js',
  'src/engine/nematodes.js',
  'src/engine/threats.js',
  'src/engine/ants.js',
  'src/engine/puzzle.js',
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
  'src/render/title_screen.js',
  'src/render/tutorial.js',
  'src/render/level_intro.js',
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
const EXPORT_DECL_RE = /^\s*export\s+(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/;

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

const body = `<title>Mycelium — Phase 1</title>
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
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><text y='14' font-size='14'>🍄</text></svg>" />
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
// with no assets folder at all.
if (existsSync(R('assets'))) {
  cpSync(R('assets'), R('dist/assets'), { recursive: true });
  console.log('Copied assets/ -> dist/assets/');
}

// Publish the standalone card cost/description editor alongside the game so it's
// reachable on the deployed site at <site>/card-editor.html. It's self-contained
// (cards.json inlined); regenerate it with `node scripts/build_cardeditor.mjs`.
if (existsSync(R('docs/card-editor.html'))) {
  cpSync(R('docs/card-editor.html'), R('dist/card-editor.html'));
  console.log('Copied docs/card-editor.html -> dist/card-editor.html');
}

console.log('Built dist/index.html and dist/artifact.html');
console.log(`Bundle size: ${(standalone.length / 1024).toFixed(1)} KB`);
