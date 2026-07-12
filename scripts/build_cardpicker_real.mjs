// Build the tempo-card art picker artifact from the REAL Replicate/FLUX options
// in assets/card_options/<slug>-<n>.jpg. Images are inlined as data: URIs
// (the Artifact CSP blocks external image hosts). Emits an .html fragment.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const OPTDIR = join(ROOT, 'assets', 'card_options');
const target = process.argv[2] || join(ROOT, 'tempo-card-picker-real.html');

const CARDS = [
  ['quickened-reflex', 'Quickened Reflex', 'action', 'Speed up one installed action: ready 1 round sooner (permanent).'],
  ['impulse-relay', 'Impulse Relay', 'action', 'Speed up one installed action: ready 2 rounds sooner (permanent).'],
  ['hair-trigger-hyphae', 'Hair-Trigger Hyphae', 'action', 'Speed up one installed action: ready 3 rounds sooner (permanent).'],
  ['brisk-metabolism', 'Brisk Metabolism', 'engine', 'Speed up one resource engine: pays out 1 round sooner (permanent).'],
  ['enzyme-overclock', 'Enzyme Overclock', 'engine', 'Speed up one resource engine: pays out 2 rounds sooner (permanent).'],
  ['metabolic-surge', 'Metabolic Surge', 'engine', 'Speed up one resource engine: pays out 3 rounds sooner (permanent).'],
];
const LENS_LABEL = ['Establishing', 'Macro', 'Motion', 'Radial burst', 'Painterly'];

function dataUri(slug, n) {
  const p = join(OPTDIR, `${slug}-${n}.jpg`);
  if (!existsSync(p)) return null;
  return 'data:image/jpeg;base64,' + readFileSync(p).toString('base64');
}

const css = `
:root{
  --bg:#0a1210; --bg2:#060d0b; --panel:#101c17; --panel2:#0c1713; --line:rgba(126,240,192,.16);
  --ink:#e6f4ec; --ink-dim:#8fb3a4; --mint:#7ef0c0; --amber:#ffb95e; --ring:#eafff2;
}
:root[data-theme="light"]{ --bg:#eef3ef; --bg2:#e3ebe5; --panel:#ffffff; --panel2:#f4f8f5;
  --line:rgba(20,60,45,.14); --ink:#12201a; --ink-dim:#5a726a; --mint:#128a5e; --amber:#b5771e; --ring:#0c5f42; }
@media (prefers-color-scheme: light){ :root:not([data-theme="dark"]){
  --bg:#eef3ef; --bg2:#e3ebe5; --panel:#ffffff; --panel2:#f4f8f5; --line:rgba(20,60,45,.14);
  --ink:#12201a; --ink-dim:#5a726a; --mint:#128a5e; --amber:#b5771e; --ring:#0c5f42; } }
*{box-sizing:border-box}
.wrap{max-width:1180px;margin:0 auto;padding:30px 20px 120px;
  font-family:"Segoe UI",Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  color:var(--ink);background:
    radial-gradient(1200px 500px at 30% -8%, rgba(126,240,192,.06), transparent 60%),
    radial-gradient(900px 500px at 90% 5%, rgba(255,185,94,.05), transparent 55%),
    linear-gradient(180deg,var(--bg),var(--bg2));min-height:100vh}
.eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--mint);font-weight:700;margin:0 0 6px}
h1{font-size:30px;line-height:1.1;margin:0 0 8px;font-weight:800;letter-spacing:-.01em}
.lede{color:var(--ink-dim);font-size:14.5px;max-width:62ch;line-height:1.55;margin:0 0 4px}
.card{margin-top:26px;background:var(--panel);border:1px solid var(--line);border-radius:16px;
  padding:16px 16px 18px;box-shadow:0 14px 40px -22px rgba(0,0,0,.7)}
.chead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:2px 4px 12px}
.cn{font-size:18px;font-weight:800;letter-spacing:-.01em}
.fam{font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:999px}
.fam.action{color:#062b1f;background:var(--mint)}
.fam.engine{color:#2b1805;background:var(--amber)}
.ceff{color:var(--ink-dim);font-size:13px;flex:1 1 220px;min-width:180px}
.opts{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
@media(max-width:900px){.opts{grid-template-columns:repeat(2,1fr)}}
@media(max-width:520px){.opts{grid-template-columns:1fr}}
.opt{position:relative;cursor:pointer;border:2px solid transparent;border-radius:11px;padding:5px;
  background:var(--panel2);transition:border-color .12s,transform .08s,box-shadow .12s}
.opt:hover{transform:translateY(-2px);border-color:rgba(126,240,192,.5)}
.opt.sel{border-color:var(--ring);box-shadow:0 0 0 2px var(--mint),0 0 22px -4px var(--mint)}
.opt img{width:100%;aspect-ratio:520/404;object-fit:cover;display:block;border-radius:7px;background:#04090c}
.olbl{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--ink-dim);padding:6px 3px 2px}
.onum{font-weight:800;color:var(--ink)}
.opt.sel .onum{color:var(--mint)}
.check{position:absolute;top:10px;right:10px;width:24px;height:24px;border-radius:50%;
  background:var(--mint);color:#04140d;display:none;align-items:center;justify-content:center;font-weight:900;font-size:14px}
.opt.sel .check{display:flex}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--panel);border-top:1px solid var(--line);
  padding:12px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;backdrop-filter:blur(6px);
  box-shadow:0 -10px 30px -20px rgba(0,0,0,.8);z-index:20}
.barwrap{max-width:1180px;margin:0 auto;width:100%;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.count{font-size:13px;color:var(--ink-dim)}
.count b{color:var(--ink)}
.picks{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--mint);
  flex:1 1 260px;min-width:200px;word-break:break-all;line-height:1.5}
.btn{font:inherit;font-weight:700;font-size:13px;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;
  color:#04140d;background:linear-gradient(180deg,#9bf0b8,#57cf8c)}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--ink)}
.toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--mint);color:#04140d;
  font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:30}
.toast.on{opacity:1}
`;

let cards = '';
const missing = [];
for (const [slug, name, fam, eff] of CARDS) {
  let opts = '';
  for (let n = 1; n <= 5; n++) {
    const uri = dataUri(slug, n);
    if (!uri) { missing.push(`${slug}-${n}`); continue; }
    opts += `<div class="opt" data-slug="${slug}" data-opt="${n}">`
      + `<div class="check">✓</div>`
      + `<img alt="${name} option ${n}" src="${uri}">`
      + `<div class="olbl"><span class="onum">${n}</span><span class="olens">${LENS_LABEL[n - 1]}</span></div>`
      + `</div>`;
  }
  cards += `<section class="card"><div class="chead">`
    + `<span class="cn">${name}</span><span class="fam ${fam}">${fam}</span>`
    + `<span class="ceff">${eff}</span></div>`
    + `<div class="opts">${opts}</div></section>`;
}
if (missing.length) console.error('WARNING missing options:', missing.join(', '));

const body = `
<div class="wrap">
  <p class="eyebrow">Mycelium · card art</p>
  <h1>Pick the art for the six tempo cards</h1>
  <p class="lede">Photographic FLUX renders in the deck's art direction — five per card. Action cards read teal (signal); engine cards read amber (metabolism). Tap one per card, then hit Copy picks and paste them back to me and I'll bake them into the deck.</p>
  ${cards}
</div>
<div class="bar"><div class="barwrap">
  <span class="count"><b id="cdone">0</b> / 6 chosen</span>
  <span class="picks" id="picks">(no picks yet)</span>
  <button class="btn ghost" id="clear">Clear</button>
  <button class="btn" id="copy" disabled>Copy picks</button>
</div></div>
<div class="toast" id="toast">Copied</div>
<script>
(function(){
  var ORDER=['quickened-reflex','impulse-relay','hair-trigger-hyphae','brisk-metabolism','enzyme-overclock','metabolic-surge'];
  var sel={};
  function refresh(){
    var slugs=Object.keys(sel);
    document.getElementById('cdone').textContent=slugs.length;
    var str=ORDER.filter(function(s){return sel[s]!=null;}).map(function(s){return s+':'+sel[s];}).join(', ');
    document.getElementById('picks').textContent=str||'(no picks yet)';
    document.getElementById('copy').disabled=slugs.length===0;
  }
  document.querySelectorAll('.opt').forEach(function(op){
    op.addEventListener('click',function(){
      var slug=op.dataset.slug, o=+op.dataset.opt;
      document.querySelectorAll('.opt[data-slug="'+slug+'"]').forEach(function(x){x.classList.remove('sel');});
      op.classList.add('sel'); sel[slug]=o; refresh();
    });
  });
  document.getElementById('clear').addEventListener('click',function(){
    sel={}; document.querySelectorAll('.opt.sel').forEach(function(x){x.classList.remove('sel');}); refresh();
  });
  document.getElementById('copy').addEventListener('click',function(){
    var str=document.getElementById('picks').textContent;
    var done=function(){var t=document.getElementById('toast');t.classList.add('on');setTimeout(function(){t.classList.remove('on');},1200);};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(str).then(done,done);}else{done();}
  });
  refresh();
})();
</script>`;

writeFileSync(target, body);
console.log('wrote', target, '(' + (body.length / 1024 / 1024).toFixed(2) + ' MB)', missing.length ? `MISSING ${missing.length}` : 'all 30 present');
