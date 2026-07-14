// Picker for the 9 new cards' art: each of 3 options rendered on the REAL card
// face, pick one per card, copy the picks. Images inlined as data: URIs.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const OPTDIR = join(ROOT, 'assets', 'card_options');
const target = process.argv[2] || join(ROOT, 'newcards-picker.html');

const SLUGS = process.env.NEWPICK_SLUGS ? process.env.NEWPICK_SLUGS.split(',')
  : ['turgor-spark', 'vacuolar-burst', 'glycogen-crush', 'cytoplasmic-cascade',
     'cord-capillary', 'rhizomorph-dynamo', 'amputate', 'severing-cords', 'sclerotial-rind'];
const SET = process.env.PICK_SET || '';   // '' -> <slug>-<n>.jpg ; 'c' -> <slug>-c<n>.jpg
const NOPT = +(process.env.NEWPICK_OPTS || 3);   // options per card
const cards = JSON.parse(readFileSync(join(ROOT, 'docs', 'cards.json'), 'utf8'));
const slugOf = (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const bySlug = {}; cards.forEach((c) => { bySlug[slugOf(c.name)] = c; });
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const uri = (slug, n) => { const p = join(OPTDIR, `${slug}-${SET}${n}.jpg`); return existsSync(p) ? 'data:image/jpeg;base64,' + readFileSync(p).toString('base64') : null; };

function pips(c) {
  const g = [];
  if (c.buyCostEnergy) g.push(`<span class="cc e">${c.buyCostEnergy}⚡</span>`);
  if (c.type !== 'action') {
    if (c.playCostWater) g.push(`<span class="cc w">${c.playCostWater}💧</span>`);
    if (c.playCostPhosphorus) g.push(`<span class="cc p">${c.playCostPhosphorus}✦</span>`);
  }
  return g.join('') || `<span class="cc free">free</span>`;
}
function face(c, u) {
  return `<div class="cardbtn"><span class="cart">${u ? `<img class="caimg" src="${u}" alt="">` : ''}</span>`
    + `<span class="pips">${pips(c)}</span>`
    + `<span class="cplate"><span class="cn">${esc(c.name)}</span><span class="ct">${esc(c.type)}</span></span>`
    + `<span class="crules">${esc(c.effect)}</span></div>`;
}

const css = `
:root{--bg:#0a1210;--bg2:#060d0b;--panel:#101c17;--panel2:#0c1713;--line:rgba(126,240,192,.16);--ink:#e6f4ec;--ink-dim:#8fb3a4;--mint:#7ef0c0;--ring:#eafff2;
 --accent:#7fe6a3;--serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;}
:root[data-theme="light"]{--bg:#eef3ef;--bg2:#e3ebe5;--panel:#fff;--panel2:#f4f8f5;--line:rgba(20,60,45,.14);--ink:#12201a;--ink-dim:#5a726a;--mint:#128a5e;--ring:#0c5f42;}
@media(prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#eef3ef;--bg2:#e3ebe5;--panel:#fff;--panel2:#f4f8f5;--line:rgba(20,60,45,.14);--ink:#12201a;--ink-dim:#5a726a;--mint:#128a5e;--ring:#0c5f42;}}
*{box-sizing:border-box}
.wrap{max-width:1180px;margin:0 auto;padding:28px 20px 120px;color:var(--ink);font-family:"Segoe UI",Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
 background:radial-gradient(1100px 460px at 30% -8%,rgba(126,240,192,.06),transparent 60%),radial-gradient(900px 460px at 90% 4%,rgba(255,185,94,.05),transparent 55%),linear-gradient(180deg,var(--bg),var(--bg2));min-height:100vh}
.eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--mint);font-weight:700;margin:0 0 6px}
h1{font-size:27px;line-height:1.12;margin:0 0 8px;font-weight:800}
.lede{color:var(--ink-dim);font-size:14px;max-width:66ch;line-height:1.55;margin:0}
.card{margin-top:24px;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:15px 15px 17px;box-shadow:0 14px 40px -24px rgba(0,0,0,.7)}
.chead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:2px 3px 13px}
.cn2{font-size:17px;font-weight:800}.ceff{color:var(--ink-dim);font-size:12.5px;flex:1 1 220px;min-width:180px}
.opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}
@media(max-width:620px){.opts{grid-template-columns:1fr}}
.opt{position:relative;cursor:pointer;border:2px solid transparent;border-radius:12px;padding:6px;background:var(--panel2);transition:.12s}
.opt:hover{transform:translateY(-2px);border-color:rgba(126,240,192,.5)}
.opt.sel{border-color:var(--ring);box-shadow:0 0 0 2px var(--mint),0 0 22px -4px var(--mint)}
.check{position:absolute;top:11px;right:11px;width:24px;height:24px;border-radius:50%;background:var(--mint);color:#04140d;display:none;align-items:center;justify-content:center;font-weight:900;z-index:9}
.opt.sel .check{display:flex}
.olbl{text-align:center;font-size:11px;color:var(--ink-dim);padding:6px 0 2px}.opt.sel .olbl{color:var(--mint);font-weight:700}
.cardbtn{position:relative;display:flex;flex-direction:column;aspect-ratio:5/7;overflow:hidden;background:linear-gradient(158deg,#101a15,#070c0a 72%);border:2px solid rgba(130,230,166,.5);border-radius:14px;color:#d7e6dc;box-shadow:0 0 9px -2px rgba(130,230,166,.45),inset 0 0 0 1px rgba(130,230,166,.16)}
.cart{position:relative;margin:6px 6px 0;aspect-ratio:3/2;overflow:hidden;border-radius:10px 10px 30px 30px/10px 10px 16px 16px;box-shadow:inset 0 0 0 1px rgba(130,230,166,.28)}
.caimg{width:100%;height:100%;object-fit:cover;display:block}
.pips{position:absolute;top:12px;left:12px;display:flex;flex-direction:column;gap:4px}
.cc{font-size:10px;font-weight:700;border-radius:5px;padding:1px 5px}.cc.e{color:var(--accent);background:rgba(127,230,163,.14)}.cc.w{color:#7fd0e0;background:rgba(70,184,204,.15)}.cc.p{color:#c79be6;background:rgba(179,128,224,.15)}.cc.free{color:var(--ink-dim);background:rgba(255,255,255,.06)}
.cplate{text-align:center;padding:5px 9px 2px}.cn{font-family:var(--serif);font-size:13.5px;font-weight:600;color:#eaf4ee;display:block}.ct{font-size:8px;color:var(--accent);text-transform:uppercase;letter-spacing:.14em;margin-top:2px;display:block}
.crules{margin:2px 7px 8px;padding:5px 8px;flex:1;border:1px solid rgba(130,230,166,.16);border-radius:9px;background:linear-gradient(180deg,rgba(10,16,13,.5),rgba(6,10,8,.68));font-size:10px;line-height:1.3;color:#d3e2da}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--panel);border-top:1px solid var(--line);padding:12px 20px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;z-index:20}
.barwrap{max-width:1180px;margin:0 auto;width:100%;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.count{font-size:13px;color:var(--ink-dim)}.count b{color:var(--ink)}
.picks{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--mint);flex:1 1 260px;min-width:200px;word-break:break-all;line-height:1.5}
.btn{font:inherit;font-weight:700;font-size:13px;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;color:#04140d;background:linear-gradient(180deg,#9bf0b8,#57cf8c)}.btn:disabled{opacity:.45;cursor:not-allowed}.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--ink)}
.toast{position:fixed;bottom:82px;left:50%;transform:translateX(-50%);background:var(--mint);color:#04140d;font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;opacity:0;transition:.2s;pointer-events:none;z-index:30}.toast.on{opacity:1}
`;

let sections = ''; const missing = [];
for (const slug of SLUGS) {
  const c = bySlug[slug]; if (!c) continue;
  let opts = '';
  for (let n = 1; n <= NOPT; n++) {
    const u = uri(slug, n); if (!u) missing.push(`${slug}-${n}`);
    opts += `<div class="opt" data-slug="${slug}" data-opt="${n}"><div class="check">✓</div>${face(c, u)}<div class="olbl">option ${n}</div></div>`;
  }
  sections += `<section class="card"><div class="chead"><span class="cn2">${esc(c.name)}</span><span class="ceff">${esc(c.effect)}</span></div><div class="opts">${opts}</div></section>`;
}
if (missing.length) console.error('MISSING', missing.join(', '));
const ORDER = JSON.stringify(SLUGS);

const body = `<style>${css}</style>
<div class="wrap">
  <p class="eyebrow">Mycelium · new card art</p>
  <h1>Pick art for the ${SLUGS.length} new cards</h1>
  <p class="lede">Three options per card, on the real card face. Tap one per card, then Copy picks and paste them back to me and I'll bake them in.</p>
  ${sections}
</div>
<div class="bar"><div class="barwrap">
  <span class="count"><b id="cdone">0</b> / ${SLUGS.length} chosen</span>
  <span class="picks" id="picks">(no picks yet)</span>
  <button class="btn ghost" id="clear">Clear</button>
  <button class="btn" id="copy" disabled>Copy picks</button>
</div></div>
<div class="toast" id="toast">Copied</div>
<script>
(function(){
  var ORDER=${ORDER}; var sel={};
  function refresh(){
    var ks=Object.keys(sel);
    document.getElementById('cdone').textContent=ks.length;
    var str=ORDER.filter(function(s){return sel[s]!=null;}).map(function(s){return s+':'+${JSON.stringify(SET)}+sel[s];}).join(', ');
    document.getElementById('picks').textContent=str||'(no picks yet)';
    document.getElementById('copy').disabled=ks.length===0;
  }
  document.querySelectorAll('.opt').forEach(function(op){op.addEventListener('click',function(){
    var slug=op.dataset.slug,o=+op.dataset.opt;
    document.querySelectorAll('.opt[data-slug="'+slug+'"]').forEach(function(x){x.classList.remove('sel');});
    op.classList.add('sel'); sel[slug]=o; refresh();
  });});
  document.getElementById('clear').addEventListener('click',function(){sel={};document.querySelectorAll('.opt.sel').forEach(function(x){x.classList.remove('sel');});refresh();});
  document.getElementById('copy').addEventListener('click',function(){
    var str=document.getElementById('picks').textContent; var t=document.getElementById('toast');
    var done=function(){t.classList.add('on');setTimeout(function(){t.classList.remove('on');},1200);};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(str).then(done,done);}else{done();}
  });
  refresh();
})();
</script>`;
writeFileSync(target, body);
console.log('wrote', target, '(' + (body.length / 1024 / 1024).toFixed(2) + ' MB)', missing.length ? `MISSING ${missing.length}` : 'all 27 present');
