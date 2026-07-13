// Picker for the 5 white-mycelium Hyphal Extension art options, each shown on the
// real card face. Reads assets/card_options/hyphal-extension-w{1..5}.jpg (data URIs).
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const target = process.argv[2] || join(ROOT, 'hyphex-picker.html');

const CARD = { name: 'Hyphal Extension', type: 'basic', e: 0, effect: 'Grow 1 step: toward all food sources in range.' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SET = process.env.HYPHEX_SET || 's';   // 's' = single-colony round; 'w' = first round
const uri = (n) => { const p = join(ROOT, 'assets', 'card_options', `hyphal-extension-${SET}${n}.jpg`); return existsSync(p) ? 'data:image/jpeg;base64,' + readFileSync(p).toString('base64') : null; };
const LENS = ['Establishing', 'Macro', 'Trunk → branches', 'Side crown', 'Sparse'];

const css = `
:root{--bg:#0a1210;--bg2:#060d0b;--panel:#101c17;--panel2:#0c1713;--line:rgba(126,240,192,.16);--ink:#e6f4ec;--ink-dim:#8fb3a4;--mint:#7ef0c0;--ring:#eafff2;
 --accent:#7fe6a3;--serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;}
:root[data-theme="light"]{--bg:#eef3ef;--bg2:#e3ebe5;--panel:#fff;--panel2:#f4f8f5;--line:rgba(20,60,45,.14);--ink:#12201a;--ink-dim:#5a726a;--mint:#128a5e;--ring:#0c5f42;}
@media(prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#eef3ef;--bg2:#e3ebe5;--panel:#fff;--panel2:#f4f8f5;--line:rgba(20,60,45,.14);--ink:#12201a;--ink-dim:#5a726a;--mint:#128a5e;--ring:#0c5f42;}}
*{box-sizing:border-box}
.wrap{max-width:1180px;margin:0 auto;padding:30px 20px 120px;color:var(--ink);font-family:"Segoe UI",Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
 background:radial-gradient(1100px 460px at 30% -8%,rgba(126,240,192,.06),transparent 60%),linear-gradient(180deg,var(--bg),var(--bg2));min-height:100vh}
.eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--mint);font-weight:700;margin:0 0 6px}
h1{font-size:28px;line-height:1.12;margin:0 0 8px;font-weight:800}
.lede{color:var(--ink-dim);font-size:14px;max-width:64ch;line-height:1.55;margin:0 0 6px}
.opts{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:22px}
@media(max-width:900px){.opts{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.opts{grid-template-columns:1fr}}
.opt{position:relative;cursor:pointer;border:2px solid transparent;border-radius:12px;padding:6px;background:var(--panel2);transition:.12s}
.opt:hover{transform:translateY(-2px);border-color:rgba(126,240,192,.5)}
.opt.sel{border-color:var(--ring);box-shadow:0 0 0 2px var(--mint),0 0 22px -4px var(--mint)}
.check{position:absolute;top:12px;right:12px;width:24px;height:24px;border-radius:50%;background:var(--mint);color:#04140d;display:none;align-items:center;justify-content:center;font-weight:900;z-index:9}
.opt.sel .check{display:flex}
.olbl{display:flex;justify-content:space-between;font-size:11px;color:var(--ink-dim);padding:6px 3px 2px}.onum{font-weight:800;color:var(--ink)}.opt.sel .onum{color:var(--mint)}
.cardbtn{position:relative;display:flex;flex-direction:column;aspect-ratio:5/7;overflow:hidden;background:linear-gradient(158deg,#101a15,#070c0a 72%);border:2px solid rgba(130,230,166,.5);border-radius:14px;color:#d7e6dc;box-shadow:0 0 9px -2px rgba(130,230,166,.45),inset 0 0 0 1px rgba(130,230,166,.16)}
.cart{position:relative;margin:6px 6px 0;aspect-ratio:3/2;overflow:hidden;border-radius:10px 10px 30px 30px/10px 10px 16px 16px;box-shadow:inset 0 0 0 1px rgba(130,230,166,.28)}
.caimg{width:100%;height:100%;object-fit:cover;display:block}
.pips{position:absolute;top:12px;left:12px}.cc{font-size:10px;font-weight:700;border-radius:5px;padding:1px 5px;color:var(--accent);background:rgba(255,255,255,.06)}
.cplate{text-align:center;padding:5px 9px 2px}.cn{font-family:var(--serif);font-size:13.5px;font-weight:600;color:#eaf4ee;display:block}.ct{font-size:8px;color:var(--accent);text-transform:uppercase;letter-spacing:.14em;margin-top:2px;display:block}
.crules{margin:2px 7px 8px;padding:5px 8px;flex:1;border:1px solid rgba(130,230,166,.16);border-radius:9px;background:linear-gradient(180deg,rgba(10,16,13,.5),rgba(6,10,8,.68));font-size:10px;line-height:1.3;color:#d3e2da}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--panel);border-top:1px solid var(--line);padding:12px 20px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;z-index:20}
.barwrap{max-width:1180px;margin:0 auto;width:100%;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.picks{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--mint);flex:1}
.btn{font:inherit;font-weight:700;font-size:13px;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;color:#04140d;background:linear-gradient(180deg,#9bf0b8,#57cf8c)}
.btn:disabled{opacity:.45;cursor:not-allowed}
.toast{position:fixed;bottom:82px;left:50%;transform:translateX(-50%);background:var(--mint);color:#04140d;font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;opacity:0;transition:.2s;pointer-events:none;z-index:30}.toast.on{opacity:1}
`;

let opts = '';
for (let n = 1; n <= 5; n++) {
  const u = uri(n);
  opts += `<div class="opt" data-opt="${n}"><div class="check">✓</div>`
    + `<div class="cardbtn"><span class="cart">${u ? `<img class="caimg" src="${u}" alt="">` : ''}</span>`
    + `<span class="pips"><span class="cc">free</span></span>`
    + `<span class="cplate"><span class="cn">${esc(CARD.name)}</span><span class="ct">${CARD.type}</span></span>`
    + `<span class="crules">${esc(CARD.effect)}</span></div>`
    + `<div class="olbl"><span class="onum">${n}</span><span>${LENS[n - 1]}</span></div></div>`;
}

const body = `<style>${css}</style>
<div class="wrap">
  <p class="eyebrow">Mycelium · Hyphal Extension art</p>
  <h1>Pick the new Hyphal Extension art</h1>
  <p class="lede">Five white-mycelium options (branching left→right), shown on the real card. Tap one, hit Copy, and paste it back to me — I'll bake it into the deck.</p>
  <div class="opts">${opts}</div>
</div>
<div class="bar"><div class="barwrap">
  <span class="picks" id="picks">(no pick yet)</span>
  <button class="btn" id="copy" disabled>Copy pick</button>
</div></div>
<div class="toast" id="toast">Copied</div>
<script>
(function(){var sel=null;
 document.querySelectorAll('.opt').forEach(function(o){o.addEventListener('click',function(){
   document.querySelectorAll('.opt').forEach(function(x){x.classList.remove('sel');});o.classList.add('sel');sel=+o.dataset.opt;
   document.getElementById('picks').textContent='hyphal-extension: option '+sel+' (${SET}'+sel+')';document.getElementById('copy').disabled=false;});});
 document.getElementById('copy').addEventListener('click',function(){
   var s='hyphal-extension: ${SET}'+sel;var t=document.getElementById('toast');
   var done=function(){t.classList.add('on');setTimeout(function(){t.classList.remove('on');},1200);};
   if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(s).then(done,done);}else{done();}});
})();
</script>`;
writeFileSync(target, body);
console.log('wrote', target, '(' + (body.length / 1024 / 1024).toFixed(2) + ' MB)');
