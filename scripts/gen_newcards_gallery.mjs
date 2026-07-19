// Gallery of the FINAL art picks for the 9 new grow cards — each on its real card face using
// the applied assets/cards/<slug>.jpg, with a caption noting which option was chosen. Read-only
// (no editing). Emits ARTIFACT-BODY html (no <!doctype>/<html>/<head>/<body>).
//   node scripts/gen_newcards_gallery.mjs [out.html]
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'docs', 'newcards-gallery.html');
// [name, "which option was chosen" caption]
const PICKS = [
  ['Guerrilla Runners', 'Translocation Cord — option 1'],
  ['Turgor Thrust', 'long-reach white — option 4'],
  ['Vesicle Surge', 'option 1'],
  ['Translocation Cord', 'white — option 4'],
  ['Explorer Cord', 'Translocation Cord white — option 2'],
  ['Turgor Line', 'option 1'],
  ['Vesicle Supply Line', 'option 1'],
  ['Bulk-Flow Cord', 'option 1'],
  ['Rhizomorph Cable', 'option 1'],
];
const all = JSON.parse(readFileSync(join(ROOT, 'docs', 'cards.json'), 'utf8'));
const slugOf = (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const RES = {
  e: '<svg class="ri" viewBox="0 0 24 24"><path d="M13.5 2 4 13.5h6L9 22l9.5-11.5h-6L13.5 2Z" fill="#f4c22e"/></svg>',
  w: '<svg class="ri" viewBox="0 0 24 24"><path d="M12 2.5C12 2.5 5.5 10 5.5 14.5a6.5 6.5 0 1 0 13 0C18.5 10 12 2.5 12 2.5Z" fill="#7fd0e0"/></svg>',
  p: '<svg class="ri" viewBox="0 0 24 24"><path d="M12 1.5c1 6.2 4.3 9.5 10.5 10.5C16.3 13 13 16.3 12 22.5 11 16.3 7.7 13 1.5 12 7.7 11 11 7.7 12 1.5Z" fill="#c79be6"/></svg>',
};
function pips(c) {
  const g = [];
  if (c.buyCostEnergy) g.push(`<span class="cc e">${c.buyCostEnergy}${RES.e}</span>`);
  if (c.buyCostPhosphorus) g.push(`<span class="cc p">${c.buyCostPhosphorus}${RES.p}</span>`);
  if (c.type !== 'action') {
    if (c.playCostWater) g.push(`<span class="cc w">${c.playCostWater}${RES.w}</span>`);
    if (c.playCostPhosphorus) g.push(`<span class="cc p">${c.playCostPhosphorus}${RES.p}</span>`);
  }
  return g.join('') || '<span class="cc free">free</span>';
}

const faces = PICKS.map(([name, pick]) => {
  const c = all.find((x) => x.name === name); if (!c) return '';
  const slug = slugOf(name);
  const p = join(ROOT, 'assets', 'cards', slug + '.jpg');
  const uri = existsSync(p) ? 'data:image/jpeg;base64,' + readFileSync(p).toString('base64') : '';
  const isEng = (c.displayCategory || c.type) === 'engine';
  return `<figure class="cell">
    <div class="facewrap"><div class="cardbtn ${isEng ? 'cat-engine' : 'cat-basic'}">
      <span class="cart">${uri ? `<img class="caimg" src="${uri}" alt="${esc(name)} art">` : ''}</span>
      <span class="pips">${pips(c)}</span>
      <span class="cplate"><span class="cn">${esc(name)}</span><span class="ct">${esc(c.displayCategory || c.type)}</span></span>
      <span class="crules">${esc(c.effect || '')}</span>
    </div></div>
    <figcaption>${esc(pick)}</figcaption>
  </figure>`;
}).join('\n');

const css = `
:root{ color-scheme:dark; --bg:#08110d; --bg2:#050b08; --line:rgba(126,240,192,.16);
  --ink:#e6f4ec; --dim:#8fb3a4; --mint:#7ef0c0; --accent:#7fe6a3; --fink:#d7e6dc; --fdim:#8aa193;
  --sans:"Segoe UI",Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  --fserif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif; }
*{box-sizing:border-box} html,body{margin:0;max-width:100%;overflow-x:hidden}
body{color:var(--ink);font-family:var(--sans);line-height:1.5;
  background:radial-gradient(1100px 480px at 24% -10%,rgba(126,240,192,.07),transparent 60%),linear-gradient(180deg,var(--bg),var(--bg2));min-height:100vh}
.wrap{max-width:1120px;margin:0 auto;padding:28px 18px 48px}
.eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--mint);font-weight:700;margin:0 0 7px}
h1{font-size:28px;line-height:1.1;margin:0 0 9px;font-weight:800;letter-spacing:-.01em}
.lede{color:var(--dim);font-size:14px;max-width:70ch;margin:0 0 6px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:22px 18px;margin-top:22px;justify-items:center}
.cell{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}
figcaption{font-size:11px;color:var(--dim);text-align:center;letter-spacing:.02em}
.facewrap .cardbtn{position:relative;display:flex;flex-direction:column;align-items:stretch;aspect-ratio:5/7;width:190px;
  --cacc:130,230,166;--cink:#7fe6a3;padding:0;overflow:hidden;background:linear-gradient(158deg,#101a15,#070c0a 72%);
  border:2px solid rgba(var(--cacc),0.5);border-radius:15px;color:var(--fink);text-align:left;
  box-shadow:0 0 10px -2px rgba(var(--cacc),0.45),inset 0 0 0 1px rgba(var(--cacc),0.16),0 10px 22px -10px rgba(0,0,0,0.75)}
.facewrap .cardbtn.cat-engine{--cacc:226,118,108;--cink:#e58a7e}
.facewrap .cart{position:relative;margin:6px 6px 0;aspect-ratio:3/2;flex:0 0 auto;overflow:hidden;
  border-radius:10px 10px 30px 30px / 10px 10px 16px 16px;background:radial-gradient(circle at 50% 40%,#16241c,#060f0b);
  box-shadow:inset 0 0 0 1px rgba(var(--cacc),0.28),inset 0 -14px 20px -12px rgba(4,7,6,0.9)}
.facewrap .caimg{width:100%;height:100%;object-fit:cover;display:block}
.facewrap .pips{position:absolute;top:10px;left:10px;z-index:6;display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.facewrap .cplate{text-align:center;padding:6px 9px 2px;flex:0 0 auto}
.facewrap .cplate .cn{font-family:var(--fserif);font-size:15px;font-weight:600;line-height:1.1;color:#eaf4ee;text-shadow:0 1px 6px rgba(0,0,0,.6);display:block}
.facewrap .cplate .ct{font-size:8px;color:var(--cink);text-transform:uppercase;letter-spacing:.14em;margin-top:2px;display:block}
.facewrap .crules{margin:2px 7px 8px;padding:5px 8px;flex:1 1 auto;min-height:0;overflow:hidden;display:flex;align-items:flex-start;
  border:1px solid rgba(var(--cacc),0.16);border-radius:9px;background:linear-gradient(180deg,rgba(10,16,13,.5),rgba(6,10,8,.68));font-size:10px;line-height:1.3;color:#d3e2da}
.facewrap .cc{display:inline-flex;align-items:center;gap:1px;font-size:10px;font-weight:700;border-radius:5px;padding:1px 5px}
.facewrap .cc.e{color:var(--accent);background:rgba(127,230,163,.14)}
.facewrap .cc.w{color:#7fd0e0;background:rgba(70,184,204,.15)}
.facewrap .cc.p{color:#c79be6;background:rgba(179,128,224,.15)}
.facewrap .cc.free{color:var(--fdim);background:rgba(255,255,255,.06)}
.facewrap .ri{display:inline-block;width:1em;height:1em;flex:0 0 auto;vertical-align:-0.14em}
`;

const body = `<div class="wrap">
  <p class="eyebrow">Mycelium · new grow cards</p>
  <h1>Your final set — 9 grow cards</h1>
  <p class="lede">The art you chose across all rounds, each on its real in-game card face. Caption =
  which option won. All nine are applied to the game.</p>
  <div class="grid">
${faces}
  </div>
</div>`;

writeFileSync(OUT, '<style>' + css + '</style>\n' + body + '\n');
console.log('wrote', OUT, '(' + (Buffer.byteLength(readFileSync(OUT)) / 1024 / 1024).toFixed(2) + ' MB, ' + PICKS.length + ' cards)');
