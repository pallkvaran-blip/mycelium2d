# Species photo work — text-only transfer

This branch (`claude/species-photos-b64`) ships the finished species-portrait work as
**base64 text** because binary (`.jpg` / `dist/`) pushes from the origin session kept
failing while plain-text pushes go through. Everything needed to reconstruct the binary
commit is here as text.

The original binary commit that could not be pushed was:

```
5cb60e8  Species: all-real photos, full credits list, Split Gill <-> Conk swap
  parent 848554f  (== origin/claude/mycelium-phase-1-build-urvq5e, already pushed:
                    the 2 earlier real photos + the Credits popup)
```

This branch is based on the already-pushed `848554f`, plus **one text-only commit** that
carries the code/doc changes and this `transfer/` folder. No `.jpg` and no `dist/` are in
the branch, so the push is pure text.

---

## What's in `transfer/`

- `*.jpg.b64` — base64 of **all 11** final species portraits (`assets/species/<img>.jpg`,
  560×720). All 11 are included to be safe, even though only 9 were new in `5cb60e8`
  (the other 2 already shipped in `848554f`).
- `MANIFEST.sha256` — sha256 of each **decoded** `.jpg`. Verified round-tripping cleanly
  before this was committed.
- `NOTES.md` — this file.

### Reconstruct the images (on the receiving side)

```bash
# from repo root, on this branch
mkdir -p assets/species
for f in transfer/*.jpg.b64; do
  base64 -d "$f" > "assets/species/$(basename "$f" .b64)"   # -> assets/species/<name>.jpg
done
sha256sum -c transfer/MANIFEST.sha256      # must report all OK
node build.mjs                             # rebuilds dist/ and copies assets/ into dist/assets/
```

`build.mjs` copies `assets/` into `dist/assets/`, so rebuilding is all that's needed for
the `dist/assets/species/*.jpg` copies — do not hand-copy them. The `src/render/credits.js`
and `src/species.js` code changes below are **already committed on this branch**, so once
the images are decoded and `dist/` is rebuilt, the game is complete.

---

## The 9 species that got NEW photos in this commit

Each portrait is a real, CC-licensed iNaturalist photo, cover-cropped to 560×720.
`img` = the `assets/species/<img>.jpg` basename; photographer + profile URL are the
Credits-popup lines (already wired in `src/render/credits.js`).

| Species (in-game name) | img (`.jpg`) | Photographer | iNaturalist profile |
|---|---|---|---|
| Fairy Ring Champignon · *Marasmius oreades* | `marasmius-oreades` | David Harbour | https://www.inaturalist.org/people/david3613 |
| Honey Fungus · *Armillaria ostoyae* | `armillaria-ostoyae` | Jenn Wren | https://www.inaturalist.org/people/jennwren |
| Common Earthball · *Scleroderma citrinum* | `scleroderma-citrinum` | Will Kuhn | https://www.inaturalist.org/people/willkuhn |
| Oyster Mushroom · *Pleurotus ostreatus* | `pleurotus-ostreatus` | Павлик Лисицын | https://www.inaturalist.org/people/lisopavlik |
| Split Gill · *Schizophyllum commune* | `schizophyllum-commune` | Alan Rockefeller | https://www.inaturalist.org/people/alan_rockefeller |
| Wine Cap · *Stropharia rugosoannulata* | `stropharia-rugosoannulata` | Hector Hind | https://www.inaturalist.org/people/rotceh_dnih |
| Violet Webcap · *Cortinarius violaceus* | `cortinarius-violaceus` | Alan Rockefeller | https://www.inaturalist.org/people/alan_rockefeller |
| Dry Rot · *Serpula lacrymans* | `serpula-lacrymans` | David Orlovich | https://www.inaturalist.org/people/davidorlovich |
| Artist's Conk · *Ganoderma applanatum* | `ganoderma-applanatum` | Derek | https://www.inaturalist.org/people/calloftheloon |

(Dry Rot's crop was reframed to drop a collection note that was in the frame.)

### The 2 photos already on origin (in `848554f`) — included here as `.b64` for safety

| Species | img (`.jpg`) | Photographer | iNaturalist profile |
|---|---|---|---|
| Slippery Jack · *Suillus luteus* | `suillus-luteus` | Daniel Seth Jackson | https://www.inaturalist.org/people/stonescottages |
| Bleeding Tooth Fungus · *Hydnellum peckii* | `hydnellum-peckii` | Morten Ross | https://www.inaturalist.org/people/morten |

With these two, **all 11 species portraits are now real photography** (no AI art remains).

---

## The two species that were "switched around" — Split Gill ↔ Artist's Conk

This is a **game-role swap, not an image swap** — each species keeps its own name, Latin
name, photo, vibe, and core biology blurb. What was traded between them (in
`src/species.js`) is their mechanical role in the campaign:

**Split Gill (`id: 'schizophyllum'`)** — promoted to the **level-10 top prize**:
- `unlock: 'Complete level 10'`, `memPick: 15`, `memEngines: 2`
- `startLevelMin: 3`, `startLevelMax: 10`
- resources `res: { energy: 20, water: 52, phosphorus: 16 }`
- starting `hand: [ { Apical Drive ×5 } ]` (opens with just five runners)
- blurb's memory clause → "hand-pick 15 cards and 2 engines you drafted last run"

**Artist's Conk (`id: 'ganoderma'`)** — demoted to the **level-5 simpler memory colony**:
- `unlock: 'Complete level 5'` (no `memPick` / `memEngines` caps → defaults)
- `startLevelMin: 2`, `startLevelMax: 5`
- resources `res: { energy: 10, water: 37, phosphorus: 6 }`
- starting `hand: [ { Aquaporin Channels ×1 }, { Apical Drive ×5 } ]`
- blurb's memory clause → "hand-pick cards you drafted during your last run … your first run may be a little rough"

In short: the two memory species traded unlock tier, memory pick/engine caps, start-level
range, resources, starting hand, and the memory clause of each blurb. Their identities
(name / Latin / photo / core blurb) stayed put.

---

## Code / doc files changed (already committed on this branch as text)

- `src/species.js` — the Split Gill ↔ Artist's Conk role swap (the two entries above).
- `src/render/credits.js` — added the 9 new photo-credit rows; the Credits popup now
  lists all 11 species with photographer + link (see `PHOTO_CREDITS`).
- `CLAUDE.md` — orientation updates (species-roster section, session handoff).
- `docs/CHECKPOINT.md` — §9 recent-work-log entry for this work.

## Not in this branch (regenerate from the above)

- `assets/species/*.jpg` — decode from `transfer/*.jpg.b64` (see reconstruct steps).
- `dist/**` — rebuild with `node build.mjs` (do not hand-edit / hand-copy).
