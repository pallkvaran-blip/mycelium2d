// Build the tempo-card ART REVIEW tool: each of the 5 options rendered on the
// REAL in-game card face (same markup/CSS as the deck), with 👍 / 👎 / comment
// per option and a copyable export. Images inlined as data: URIs (Artifact CSP
// blocks external hosts). Emits an .html fragment (host adds doctype/head/body).
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const OPTDIR = join(ROOT, 'assets', 'card_options');
const target = process.argv[2] || join(ROOT, 'tempo-card-review.html');

// The six tempo cards (data mirrors docs/cards.json). costW/costP are 0 (Energy only).
const CARDS = [
  { slug: 'quickened-reflex', name: 'Quickened Reflex', type: 'event', fam: 'action', e: 10, effect: 'Speed up one installed action: it becomes ready 1 round sooner between uses (permanent).' },
  { slug: 'impulse-relay', name: 'Impulse Relay', type: 'event', fam: 'action', e: 18, effect: 'Speed up one installed action: it becomes ready 2 rounds sooner between uses (permanent).' },
  { slug: 'hair-trigger-hyphae', name: 'Hair-Trigger Hyphae', type: 'event', fam: 'action', e: 28, effect: 'Speed up one installed action: it becomes ready 3 rounds sooner between uses (permanent).' },
  { slug: 'brisk-metabolism', name: 'Brisk Metabolism', type: 'event', fam: 'engine', e: 10, effect: 'Speed up one resource engine: it pays out 1 round sooner (permanent).' },
  { slug: 'enzyme-overclock', name: 'Enzyme Overclock', type: 'event', fam: 'engine', e: 18, effect: 'Speed up one resource engine: it pays out 2 rounds sooner (permanent).' },
  { slug: 'metabolic-surge', name: 'Metabolic Surge', type: 'event', fam: 'engine', e: 28, effect: 'Speed up one resource engine: it pays out 3 rounds sooner (permanent).' },
];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function dataUri(slug, n) {
  const p = join(OPTDIR, `${slug}-${n}.jpg`);
  return existsSync(p) ? 'data:image/jpeg;base64,' + readFileSync(p).toString('base64') : null;
}

// --- in-game card-face CSS (lifted from index.html, scoped under .stage) ------
const cardCss = `
.stage{ --accent:#7fe6a3; --ink:#d7e6dc; --ink-dim:#8aa193;
  --serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif; }
.cardbtn{ position:relative; display:flex; flex-direction:column; align-items:stretch; aspect-ratio:5/7;
  width:100%; padding:0; overflow:hidden; background:linear-gradient(158deg,#101a15,#070c0a 72%);
  border:2px solid rgba(130,230,166,0.5); border-radius:14px; color:var(--ink); text-align:left;
  box-shadow:0 0 9px -2px rgba(130,230,166,0.45), inset 0 0 0 1px rgba(130,230,166,0.16), 0 8px 18px -9px rgba(0,0,0,0.75); }
.cart{ position:relative; margin:6px 6px 0; aspect-ratio:3/2; flex:0 0 auto; overflow:hidden;
  border-radius:10px 10px 30px 30px / 10px 10px 16px 16px;
  background:radial-gradient(circle at 50% 40%,#16241c,#060f0b);
  box-shadow:inset 0 0 0 1px rgba(130,230,166,0.28), inset 0 -14px 20px -12px rgba(4,7,6,0.9); }
.caimg{ width:100%; height:100%; object-fit:cover; display:block; }
.pips{ position:absolute; top:12px; left:12px; z-index:6; display:flex; flex-direction:column; gap:4px; }
.cplate{ text-align:center; padding:5px 9px 2px; flex:0 0 auto; }
.cplate .cn{ font-family:var(--serif); font-size:13.5px; font-weight:600; line-height:1.1; color:#eaf4ee; text-shadow:0 1px 6px rgba(0,0,0,0.6); display:block; }
.cplate .ct{ font-size:8px; color:var(--accent); text-transform:uppercase; letter-spacing:0.14em; margin-top:2px; display:block; }
.crules{ margin:2px 7px 8px; padding:5px 8px; flex:1 1 auto; min-height:0; overflow:hidden; display:flex; align-items:flex-start;
  border:1px solid rgba(130,230,166,0.16); border-radius:9px;
  background:linear-gradient(180deg,rgba(10,16,13,0.5),rgba(6,10,8,0.68)); font-size:10px; line-height:1.3; color:#d3e2da; }
.cc{ font-size:10px; font-weight:700; border-radius:5px; padding:1px 5px; }
.cc.e{ color:var(--accent); background:rgba(127,230,163,0.14); }
.cc.free{ color:var(--ink-dim); background:rgba(255,255,255,0.06); }
`;

// --- tool chrome CSS ----------------------------------------------------------
const uiCss = `
:root{ --bg:#0a1210; --bg2:#060d0b; --panel:#101c17; --panel2:#0c1713; --line:rgba(126,240,192,.16);
  --tink:#e6f4ec; --tink-dim:#8fb3a4; --mint:#7ef0c0; --amber:#ffb95e; --up:#57cf8c; --down:#ff7a7a; }
*{box-sizing:border-box}
.wrap{max-width:1200px;margin:0 auto;padding:26px 18px 130px;color:var(--tink);
  font-family:"Segoe UI",Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  background:radial-gradient(1100px 460px at 28% -8%,rgba(126,240,192,.06),transparent 60%),
    radial-gradient(900px 460px at 92% 4%,rgba(255,185,94,.05),transparent 55%),linear-gradient(180deg,var(--bg),var(--bg2));min-height:100vh}
.eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--mint);font-weight:700;margin:0 0 6px}
h1{font-size:28px;line-height:1.12;margin:0 0 8px;font-weight:800;letter-spacing:-.01em}
.lede{color:var(--tink-dim);font-size:14px;max-width:64ch;line-height:1.55;margin:0}
.card{margin-top:24px;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:15px 15px 17px;box-shadow:0 14px 40px -24px rgba(0,0,0,.7)}
.chead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:2px 3px 13px}
.cn2{font-size:17px;font-weight:800;letter-spacing:-.01em}
.fam{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:999px}
.fam.action{color:#062b1f;background:var(--mint)} .fam.engine{color:#2b1805;background:var(--amber)}
.ceff{color:var(--tink-dim);font-size:12.5px;flex:1 1 220px;min-width:180px}
.opts{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
@media(max-width:1000px){.opts{grid-template-columns:repeat(3,1fr)}}
@media(max-width:680px){.opts{grid-template-columns:repeat(2,1fr)}}
@media(max-width:460px){.opts{grid-template-columns:1fr}}
.opt{display:flex;flex-direction:column;gap:8px}
.stage{position:relative}
.optn{position:absolute;top:-9px;left:-6px;z-index:8;background:var(--panel);border:1px solid var(--line);color:var(--tink);
  font-size:11px;font-weight:800;border-radius:999px;padding:2px 8px}
.votes{display:flex;gap:8px}
.vbtn{flex:1;font:inherit;font-weight:700;font-size:15px;border:1px solid var(--line);background:var(--panel2);color:var(--tink);
  border-radius:10px;padding:7px 0;cursor:pointer;transition:.12s}
.vbtn:hover{border-color:rgba(126,240,192,.5)}
.vbtn.up.on{background:rgba(87,207,140,.22);border-color:var(--up);color:#d6ffe8}
.vbtn.down.on{background:rgba(255,122,122,.18);border-color:var(--down);color:#ffdede}
.note{width:100%;resize:vertical;min-height:38px;font:inherit;font-size:12px;border-radius:9px;padding:7px 9px;
  background:var(--panel2);border:1px solid var(--line);color:var(--tink)}
.note::placeholder{color:var(--tink-dim)}
.note:focus{outline:none;border-color:var(--mint)}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--panel);border-top:1px solid var(--line);padding:12px 18px;
  display:flex;gap:14px;flex-wrap:wrap;align-items:center;backdrop-filter:blur(6px);box-shadow:0 -10px 30px -20px rgba(0,0,0,.8);z-index:40}
.barwrap{max-width:1200px;margin:0 auto;width:100%;display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.metric{font-size:13px;color:var(--tink-dim)} .metric b{color:var(--tink)} .metric .u{color:var(--up)} .metric .d{color:var(--down)}
.btn{font:inherit;font-weight:700;font-size:13px;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;color:#04140d;background:linear-gradient(180deg,#9bf0b8,#57cf8c)}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--tink)}
.modal{position:fixed;inset:0;background:rgba(3,7,5,.72);display:none;align-items:center;justify-content:center;z-index:60;padding:20px}
.modal.open{display:flex}
.mbox{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;max-width:640px;width:100%}
.mbox h2{margin:0 0 4px;font-size:17px}
.mbox p{margin:0 0 10px;color:var(--tink-dim);font-size:12.5px}
.mbox textarea{width:100%;height:300px;font-family:ui-monospace,Menlo,monospace;font-size:12px;border-radius:9px;padding:10px;background:var(--panel2);border:1px solid var(--line);color:var(--tink);resize:vertical}
.mrow{display:flex;gap:10px;justify-content:flex-end;margin-top:10px}
.toast{position:fixed;bottom:82px;left:50%;transform:translateX(-50%);background:var(--mint);color:#04140d;font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;opacity:0;transition:.2s;pointer-events:none;z-index:70}
.toast.on{opacity:1}
`;

// one real card face with the option art in the window
function faceHTML(card, n, uri) {
  const pips = card.e ? `<span class="cc e">${card.e}⚡</span>` : `<span class="cc free">free</span>`;
  const img = uri ? `<img class="caimg" src="${uri}" alt="${esc(card.name)} option ${n}">` : '';
  return `<div class="stage"><span class="optn">${n}</span>`
    + `<div class="cardbtn">`
    + `<span class="cart">${img}</span>`
    + `<span class="pips">${pips}</span>`
    + `<span class="cplate"><span class="cn">${esc(card.name)}</span><span class="ct">${esc(card.type)}</span></span>`
    + `<span class="crules">${esc(card.effect)}</span>`
    + `</div></div>`;
}

let sections = '';
const missing = [];
for (const card of CARDS) {
  let opts = '';
  for (let n = 1; n <= 5; n++) {
    const uri = dataUri(card.slug, n);
    if (!uri) missing.push(`${card.slug}-${n}`);
    opts += `<div class="opt" data-slug="${card.slug}" data-opt="${n}">`
      + faceHTML(card, n, uri)
      + `<div class="votes"><button class="vbtn up" data-v="up" title="Thumb up">👍</button>`
      + `<button class="vbtn down" data-v="down" title="Thumb down">👎</button></div>`
      + `<textarea class="note" rows="1" placeholder="Comment (optional)…"></textarea>`
      + `</div>`;
  }
  sections += `<section class="card"><div class="chead">`
    + `<span class="cn2">${esc(card.name)}</span><span class="fam ${card.fam}">${card.fam}</span>`
    + `<span class="ceff">${esc(card.effect)}</span></div>`
    + `<div class="opts">${opts}</div></section>`;
}
if (missing.length) console.error('WARNING missing:', missing.join(', '));

const NAMES = JSON.stringify(CARDS.map((c) => ({ slug: c.slug, name: c.name })));

const body = `<style>${uiCss}${cardCss}</style>
<div class="wrap">
  <p class="eyebrow">Mycelium · card art review</p>
  <h1>Rate the tempo-card art — on the cards</h1>
  <p class="lede">Each option is shown on the actual card it's for. 👍 the ones you like, 👎 the ones you don't, and drop a comment on any of them. When you're done, hit Export &amp; copy and paste it back to me — I'll bake your winners into the deck.</p>
  ${sections}
</div>
<div class="bar"><div class="barwrap">
  <span class="metric"><b id="mCards">0</b>/6 cards have a 👍 · <span class="u">👍 <b id="mUp">0</b></span> · <span class="d">👎 <b id="mDown">0</b></span> · 💬 <b id="mNote">0</b></span>
  <span style="flex:1"></span>
  <button class="btn ghost" id="btnReset">Reset</button>
  <button class="btn" id="btnExport">Export &amp; copy</button>
</div></div>
<div class="modal" id="modal"><div class="mbox">
  <h2>Your review</h2>
  <p>Paste this back into the chat and I'll apply it.</p>
  <textarea id="out" readonly></textarea>
  <div class="mrow"><button class="btn ghost" id="btnClose">Close</button><button class="btn" id="btnCopy">Copy</button></div>
</div></div>
<div class="toast" id="toast">Copied</div>
<script>
(function(){
  var NAMES=${NAMES};
  var KEY='mycelium-tempo-art-review';
  var store={}; try{ store=JSON.parse(localStorage.getItem(KEY))||{}; }catch(e){ store={}; }
  function persist(){ try{ localStorage.setItem(KEY,JSON.stringify(store)); }catch(e){} }
  function keyOf(slug,n){ return slug+':'+n; }
  function rec(slug,n){ var k=keyOf(slug,n); return store[k]||(store[k]={}); }

  document.querySelectorAll('.opt').forEach(function(op){
    var slug=op.dataset.slug, n=+op.dataset.opt, r=rec(slug,n);
    var up=op.querySelector('.vbtn.up'), down=op.querySelector('.vbtn.down'), note=op.querySelector('.note');
    if(r.vote==='up') up.classList.add('on'); if(r.vote==='down') down.classList.add('on');
    if(r.note) note.value=r.note;
    up.addEventListener('click',function(){ r.vote=r.vote==='up'?null:'up'; up.classList.toggle('on',r.vote==='up'); down.classList.remove('on'); persist(); metrics(); });
    down.addEventListener('click',function(){ r.vote=r.vote==='down'?null:'down'; down.classList.toggle('on',r.vote==='down'); up.classList.remove('on'); persist(); metrics(); });
    note.addEventListener('input',function(){ r.note=note.value; persist(); metrics(); });
  });

  function metrics(){
    var up=0,down=0,notes=0,cardsWithUp={};
    Object.keys(store).forEach(function(k){ var r=store[k]; var slug=k.split(':')[0];
      if(r.vote==='up'){ up++; cardsWithUp[slug]=1; } if(r.vote==='down') down++;
      if(r.note&&r.note.trim()) notes++; });
    document.getElementById('mUp').textContent=up;
    document.getElementById('mDown').textContent=down;
    document.getElementById('mNote').textContent=notes;
    document.getElementById('mCards').textContent=Object.keys(cardsWithUp).length;
  }
  metrics();

  function exportText(){
    var L=['# Mycelium — Tempo-card art review',''];
    NAMES.forEach(function(c){
      var picked=[], liked=[], disliked=[], notes=[];
      for(var n=1;n<=5;n++){ var r=store[keyOf(c.slug,n)]||{};
        if(r.vote==='up'){ liked.push(n); picked.push(n); }
        if(r.vote==='down') disliked.push(n);
        if(r.note&&r.note.trim()) notes.push('opt '+n+': '+r.note.trim().replace(/\\s+/g,' ')); }
      L.push('## '+c.name+' ('+c.slug+')');
      L.push('WINNER: '+(liked.length===1?('option '+liked[0]):liked.length>1?('liked '+liked.join(', ')+' — pick one'):'(none chosen)'));
      if(disliked.length) L.push('disliked: '+disliked.join(', '));
      notes.forEach(function(x){ L.push('- '+x); });
      L.push('');
    });
    return L.join('\\n');
  }

  var modal=document.getElementById('modal');
  document.getElementById('btnExport').addEventListener('click',function(){ document.getElementById('out').value=exportText(); modal.classList.add('open'); });
  document.getElementById('btnClose').addEventListener('click',function(){ modal.classList.remove('open'); });
  modal.addEventListener('click',function(e){ if(e.target===modal) modal.classList.remove('open'); });
  document.getElementById('btnCopy').addEventListener('click',function(){
    var out=document.getElementById('out'); out.select();
    var done=function(){ var t=document.getElementById('toast'); t.classList.add('on'); setTimeout(function(){t.classList.remove('on');},1300); };
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(out.value).then(done,done); } else { try{document.execCommand('copy');}catch(e){} done(); }
  });
  document.getElementById('btnReset').addEventListener('click',function(){
    if(confirm('Clear every vote and comment?')){ store={}; persist();
      document.querySelectorAll('.vbtn').forEach(function(b){b.classList.remove('on');});
      document.querySelectorAll('.note').forEach(function(t){t.value='';}); metrics(); }
  });
})();
</script>`;

writeFileSync(target, body);
console.log('wrote', target, '(' + (body.length / 1024 / 1024).toFixed(2) + ' MB)', missing.length ? `MISSING ${missing.length}` : 'all 30 present');
