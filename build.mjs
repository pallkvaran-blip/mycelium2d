// Bundles the ES-module game into a single self-contained HTML file.
//
//   node build.mjs
//
// Produces:
//   dist/index.html    — full standalone page (open or deploy anywhere)
//   dist/artifact.html — body-only (for hosts that supply their own <head>)
//
// Strategy: strip import/export keywords and concatenate every module in
// dependency order inside one IIFE in a plain <script>. The game exposes
// nothing globally except window.__game (dev handle), so a single shared
// function scope is safe and avoids any module-resolution at runtime.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(fileURLToPath(import.meta.url));
const R = (p) => join(root, p);

// Dependency order: classes must be defined before the code that runs them.
const MODULES = [
  'src/config.js',
  'src/engine/rng.js',
  'src/engine/substrate.js',
  'src/engine/network.js',
  'src/engine/threats.js',
  'src/engine/state.js',
  'src/engine/actions.js',
  'src/engine/turn.js',
  'src/render/camera.js',
  'src/render/substrate.js',
  'src/render/network.js',
  'src/render/ui.js',
  'src/main.js',
];

function strip(src) {
  return src
    .split('\n')
    .filter((line) => !/^\s*import\s.+from\s+['"].+['"];?\s*$/.test(line))
    .join('\n')
    .replace(/^export\s+/gm, '');
}

const js = MODULES
  .map((f) => `// ===================== ${f} =====================\n${strip(readFileSync(R(f), 'utf8'))}`)
  .join('\n\n');

// Pull the CSS straight out of index.html so there is one source of truth.
const indexHtml = readFileSync(R('index.html'), 'utf8');
const css = indexHtml.match(/<style>([\s\S]*?)<\/style>/)[1].trim();

const body = `<title>Mycelium — Phase 1</title>
<meta name="description" content="A 2D roguelike engine-builder themed on the life of a fungal colony — steer, defend, and fruit a living mycelial network." />
<style>
${css}
</style>
<canvas id="game"></canvas>
<div id="ui"></div>
<script>
(function () {
'use strict';
${js}
})();
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
console.log('Built dist/index.html and dist/artifact.html');
console.log(`Bundle size: ${(standalone.length / 1024).toFixed(1)} KB`);
