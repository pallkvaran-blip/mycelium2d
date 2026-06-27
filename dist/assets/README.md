# Art assets

Image assets (textures + sprites) loaded by the game at runtime.

## How it works
- `manifest.json` lists the assets that **actually exist**. The game preloads
  them at boot (`src/render/assets.js`).
- Renderers call `hasAsset(key)` before drawing, so the game runs perfectly with
  an **empty manifest** — it just uses the procedural look. Drop a PNG in, add a
  manifest entry, and it appears in-game. No code change required.
- `build.mjs` copies this whole folder into `dist/assets/`, which GitHub Pages
  serves next to `index.html`.

## Manifest entry
```json
{ "key": "soil", "file": "soil.png", "kind": "texture",
  "opacity": 0.5, "blend": "soft-light", "scale": 0.25 }
```
- `kind`: `"texture"` (seamless, tiled as a repeating pattern) or `"sprite"`
  (single transparent PNG drawn with drawImage).
- `opacity` / `blend` / `scale` (textures): how strongly it overlays the earth,
  the canvas composite mode, and how large one tile is in world units.

## Style
All assets follow `docs/STYLE_GUIDE.md` (bioluminescent deep-earth). The
per-asset specs + generation prompts live in `docs/ASSETS.md`.
