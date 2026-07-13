// Build a WHOLE-DECK review tool: every card rendered on its real in-game face
// (art + cost + name + rules), with 👍/👎, an EDITABLE description box prefilled
// with the current text, an optional note, filter chips, live metrics and a
// copyable export. Card art inlined as data: URIs (Artifact CSP blocks hosts).
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const CARDS_JSON = join(ROOT, 'docs', 'cards.json');
const ARTDIR = join(ROOT, 'assets', 'cards');
const target = process.argv[2] || join(ROOT, 'deck-review.html');

const ARCHIVED = new Set(['Leaf Litter Cache', 'Humus Bed', 'Mycorrhizal Mat', 'Leaf Fall', 'Humus Cache', 'Symbiont Weave', 'Saprotrophic Digest', 'Enzyme Priming']);
const GROUP = { basic: 'Basics', engine: 'Resource engines', action: 'Abilities', event: 'Events', extender: 'Draw engines' };
const GROUP_ORDER = ['basic', 'engine', 'action', 'event', 'extender'];

// In-game filter tags — MUST mirror cardGroups() in src/render/ui.js (which keys
// off `category` and `family`; `family` === cards.json `familyKey`). A card can
// carry several. Keeps the tool's chips identical to the deck's own filters.
const TAG_LABELS = { basic: 'Basic', engine: 'Engine', event: 'Event', draw: 'Draw', grow: 'Grow', substrate: 'Substrate', water: 'Water', mineral: 'Mineral', energy: 'Energy', defense: 'Defense' };
const TAG_ORDER = ['basic', 'engine', 'event', 'draw', 'grow', 'substrate', 'water', 'mineral', 'energy', 'defense'];
function cardTags(c) {
  const dc = c.displayCategory || c.type || '', cat = (c.category || '').toLowerCase(), fam = (c.familyKey || '').toLowerCase();
  const k = new Set();
  if (dc === 'basic') k.add('basic'); else if (dc === 'engine') k.add('engine'); else if (dc === 'event') k.add('event'); else if (dc === 'extender') k.add('draw'); else k.add('event');
  if (/growth|mobility|routing|utility|finisher/.test(cat)) k.add('grow');
  if (cat.includes('substrate')) k.add('substrate');
  if (fam === 'water' || cat.includes('water')) k.add('water');
  if (fam === 'phosphorus' || cat.includes('phosphorus') || cat.includes('mineral')) k.add('mineral');
  if (fam === 'energy' || cat.includes('energy')) k.add('energy');
  if (fam === 'defense' || /defense|anti-/.test(cat)) k.add('defense');
  return TAG_ORDER.filter((x) => k.has(x));
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slugOf = (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function artUri(slug) {
  const p = join(ARTDIR, `${slug}.jpg`);
  return existsSync(p) ? 'data:image/jpeg;base64,' + readFileSync(p).toString('base64') : null;
}

const cards = JSON.parse(readFileSync(CARDS_JSON, 'utf8'))
  .map((c) => ({ ...c, slug: slugOf(c.name), archived: ARCHIVED.has(c.name), tags: cardTags(c) }))
  .sort((a, b) => (GROUP_ORDER.indexOf(a.type) - GROUP_ORDER.indexOf(b.type)) || (a.archived - b.archived) || a.name.localeCompare(b.name));

function pips(c) {
  const g = [];
  if (c.buyCostEnergy) g.push(`<span class="cc e">${c.buyCostEnergy}⚡</span>`);
  if (c.type !== 'action') {   // actions pay W/P per use, not to install → not a face gate
    if (c.playCostWater) g.push(`<span class="cc w">${c.playCostWater}💧</span>`);
    if (c.playCostPhosphorus) g.push(`<span class="cc p">${c.playCostPhosphorus}✦</span>`);
  }
  return g.join('') || `<span class="cc free">free</span>`;
}
function faceHTML(c, uri) {
  const img = uri ? `<img class="caimg" src="${uri}" alt="">` : '';
  return `<div class="cardbtn${c.archived ? ' arch' : ''}">`
    + `<span class="cart">${img}</span>`
    + `<span class="pips" data-face-pips>${pips(c)}</span>`
    + (c.archived ? `<span class="archbadge">archived</span>` : '')
    + `<span class="cplate"><span class="cn">${esc(c.name)}</span><span class="ct" data-face-type>${esc(c.displayCategory || c.type)}</span></span>`
    + `<span class="crules" data-face-rules></span>`
    + `</div>`;
}

const cardCss = `
.stage{ --accent:#7fe6a3; --ink:#d7e6dc; --ink-dim:#8aa193; --serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif; }
.cardbtn{ position:relative; display:flex; flex-direction:column; align-items:stretch; aspect-ratio:5/7; width:100%; overflow:hidden;
  background:linear-gradient(158deg,#101a15,#070c0a 72%); border:2px solid rgba(130,230,166,0.5); border-radius:14px; color:var(--ink); text-align:left;
  box-shadow:0 0 9px -2px rgba(130,230,166,0.45), inset 0 0 0 1px rgba(130,230,166,0.16), 0 8px 18px -9px rgba(0,0,0,0.75); }
.cardbtn.arch{ filter:saturate(.65) brightness(.9); border-color:rgba(160,170,165,0.4); }
.cart{ position:relative; margin:6px 6px 0; aspect-ratio:3/2; flex:0 0 auto; overflow:hidden; border-radius:10px 10px 30px 30px / 10px 10px 16px 16px;
  background:radial-gradient(circle at 50% 40%,#16241c,#060f0b); box-shadow:inset 0 0 0 1px rgba(130,230,166,0.28), inset 0 -14px 20px -12px rgba(4,7,6,0.9); }
.caimg{ width:100%; height:100%; object-fit:cover; display:block; }
.pips{ position:absolute; top:12px; left:12px; z-index:6; display:flex; flex-direction:column; gap:4px; }
.archbadge{ position:absolute; top:10px; right:8px; z-index:6; font-size:8.5px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
  color:#0c1210; background:#9aa5a0; border-radius:6px; padding:2px 6px; }
.cplate{ text-align:center; padding:5px 9px 2px; flex:0 0 auto; }
.cplate .cn{ font-family:var(--serif); font-size:13.5px; font-weight:600; line-height:1.1; color:#eaf4ee; text-shadow:0 1px 6px rgba(0,0,0,0.6); display:block; }
.cplate .ct{ font-size:8px; color:var(--accent); text-transform:uppercase; letter-spacing:0.14em; margin-top:2px; display:block; }
.crules{ margin:2px 7px 8px; padding:5px 8px; flex:1 1 auto; min-height:0; overflow:hidden; display:flex; align-items:flex-start;
  border:1px solid rgba(130,230,166,0.16); border-radius:9px; background:linear-gradient(180deg,rgba(10,16,13,0.5),rgba(6,10,8,0.68)); font-size:10px; line-height:1.3; color:#d3e2da; }
.cc{ font-size:10px; font-weight:700; border-radius:5px; padding:1px 5px; }
.cc.e{ color:var(--accent); background:rgba(127,230,163,0.14); }
.cc.w{ color:#7fd0e0; background:rgba(70,184,204,0.15); }
.cc.p{ color:#c79be6; background:rgba(179,128,224,0.15); }
.cc.free{ color:var(--ink-dim); background:rgba(255,255,255,0.06); }
`;

const uiCss = `
:root{ --bg:#0a1210; --bg2:#060d0b; --panel:#101c17; --panel2:#0c1713; --line:rgba(126,240,192,.16);
  --tink:#e6f4ec; --tink-dim:#8fb3a4; --mint:#7ef0c0; --amber:#ffb95e; --up:#57cf8c; --down:#ff7a7a; --edit:#ffd479; --cat:#c79be6; }
*{box-sizing:border-box}
.wrap{max-width:1280px;margin:0 auto;padding:24px 18px 132px;color:var(--tink);
  font-family:"Segoe UI",Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  background:radial-gradient(1100px 460px at 28% -8%,rgba(126,240,192,.06),transparent 60%),
    radial-gradient(900px 460px at 92% 4%,rgba(255,185,94,.05),transparent 55%),linear-gradient(180deg,var(--bg),var(--bg2));min-height:100vh}
.eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--mint);font-weight:700;margin:0 0 6px}
h1{font-size:27px;line-height:1.12;margin:0 0 8px;font-weight:800;letter-spacing:-.01em}
.lede{color:var(--tink-dim);font-size:14px;max-width:70ch;line-height:1.55;margin:0 0 14px}
.filterbar{position:sticky;top:0;z-index:31;background:linear-gradient(180deg,var(--bg),rgba(10,18,16,.92));padding:10px 0 6px;
  display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.fToggle{font:inherit;font-size:13px;font-weight:700;color:var(--tink);background:var(--panel2);border:1px solid var(--line);
  border-radius:10px;padding:8px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.fToggle:hover{border-color:rgba(126,240,192,.5)}
.fToggle .chev{transition:transform .18s;font-size:11px;opacity:.8} .fToggle.open .chev{transform:rotate(180deg)}
.fToggle #filtCur{color:var(--mint);font-weight:600}
.filters{display:none;gap:8px;flex-wrap:wrap;margin:0 0 6px;position:sticky;top:52px;z-index:30;
  background:linear-gradient(180deg,var(--bg),rgba(10,18,16,.9));padding:6px 0 10px;backdrop-filter:blur(4px)}
.filters.open{display:flex}
.fchip{font:inherit;font-size:12.5px;font-weight:600;color:var(--tink);background:var(--panel2);border:1px solid var(--line);
  border-radius:999px;padding:6px 12px;cursor:pointer;display:inline-flex;gap:7px;align-items:center;transition:.12s}
.fchip:hover{border-color:rgba(126,240,192,.5)} .fchip.on{background:var(--mint);color:#062b1f;border-color:var(--mint)}
.fchip .cnt{opacity:.7;font-size:11px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:8px}
@media(max-width:640px){.grid{grid-template-columns:1fr}}
.rv{display:flex;flex-direction:row;gap:12px;align-items:flex-start}
.rv.hide{display:none}
.stage{position:relative;flex:0 0 46%;max-width:230px}
.rvctl{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:8px}
@media(max-width:420px){.rv{flex-direction:column}.stage{flex:0 0 auto;width:100%;max-width:220px}}
.votes{display:flex;gap:8px}
.vbtn{flex:1;font:inherit;font-weight:700;font-size:15px;border:1px solid var(--line);background:var(--panel2);color:var(--tink);border-radius:10px;padding:6px 0;cursor:pointer;transition:.12s}
.vbtn:hover{border-color:rgba(126,240,192,.5)}
.vbtn.up.on{background:rgba(87,207,140,.22);border-color:var(--up);color:#d6ffe8}
.vbtn.down.on{background:rgba(255,122,122,.18);border-color:var(--down);color:#ffdede}
.costs{display:flex;gap:8px;flex-wrap:wrap}
.ci{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:800;background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:4px 7px}
.ci.changed{border-color:var(--edit)}
.ci.e{color:#7fe6a3} .ci.w{color:#7fd0e0} .ci.p{color:#c79be6}
.ci input{width:40px;font:inherit;font-size:13px;font-weight:800;text-align:center;background:rgba(0,0,0,.25);border:1px solid var(--line);border-radius:6px;color:var(--tink);padding:2px 0}
.ci input:focus{outline:none;border-color:var(--mint)}
.ci input::-webkit-outer-spin-button,.ci input::-webkit-inner-spin-button{opacity:.5}
.cats{display:flex;gap:6px}
.catbtn{flex:1;font:inherit;font-weight:700;font-size:11.5px;letter-spacing:.02em;border:1px solid var(--line);background:var(--panel2);color:var(--tink);border-radius:9px;padding:6px 0;cursor:pointer;transition:.12s}
.catbtn:hover{border-color:rgba(126,240,192,.5)}
.catbtn.on{background:rgba(199,155,230,.22);border-color:var(--cat);color:#f0e6ff}
.recat-tag{color:var(--cat);font-weight:700;display:none}
.rv.recat .recat-tag{display:inline}
.lbl{font-size:10.5px;color:var(--tink-dim);margin:2px 0 -4px;display:flex;justify-content:space-between}
.edited-tag{color:var(--edit);font-weight:700;display:none}
.rv.edited .edited-tag{display:inline}
.desc{width:100%;resize:vertical;min-height:64px;font:inherit;font-size:12px;line-height:1.35;border-radius:9px;padding:7px 9px;background:var(--panel2);border:1px solid var(--line);color:var(--tink)}
.rv.edited .desc{border-color:var(--edit)}
.desc:focus{outline:none;border-color:var(--mint)}
.note{width:100%;font:inherit;font-size:11.5px;border-radius:9px;padding:6px 9px;background:var(--panel2);border:1px solid var(--line);color:var(--tink)}
.note::placeholder,.desc::placeholder{color:var(--tink-dim)}
.note:focus{outline:none;border-color:var(--mint)}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--panel);border-top:1px solid var(--line);padding:12px 18px;display:flex;gap:14px;flex-wrap:wrap;align-items:center;backdrop-filter:blur(6px);box-shadow:0 -10px 30px -20px rgba(0,0,0,.8);z-index:40}
.barwrap{max-width:1280px;margin:0 auto;width:100%;display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.metric{font-size:13px;color:var(--tink-dim)} .metric b{color:var(--tink)} .metric .u{color:var(--up)} .metric .d{color:var(--down)} .metric .e{color:var(--edit)} .metric .c{color:var(--cat)}
.btn{font:inherit;font-weight:700;font-size:13px;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;color:#04140d;background:linear-gradient(180deg,#9bf0b8,#57cf8c)}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--tink)}
.modal{position:fixed;inset:0;background:rgba(3,7,5,.72);display:none;align-items:center;justify-content:center;z-index:60;padding:20px}
.modal.open{display:flex}
.mbox{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;max-width:720px;width:100%}
.mbox h2{margin:0 0 4px;font-size:17px}.mbox p{margin:0 0 10px;color:var(--tink-dim);font-size:12.5px}
.mbox textarea{width:100%;height:340px;font-family:ui-monospace,Menlo,monospace;font-size:12px;border-radius:9px;padding:10px;background:var(--panel2);border:1px solid var(--line);color:var(--tink);resize:vertical}
.mrow{display:flex;gap:10px;justify-content:flex-end;margin-top:10px}
.toast{position:fixed;bottom:82px;left:50%;transform:translateX(-50%);background:var(--mint);color:#04140d;font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;opacity:0;transition:.2s;pointer-events:none;z-index:70}
.toast.on{opacity:1}
`;

let cells = '';
for (const c of cards) {
  const uri = artUri(c.slug);
  cells += `<div class="rv" data-slug="${c.slug}" data-group="${c.type}" data-tags="${c.tags.join(' ')}" data-arch="${c.archived ? 1 : 0}">`
    + `<div class="stage">${faceHTML(c, uri)}</div>`
    + `<div class="rvctl">`
    +   `<div class="votes"><button class="vbtn up" data-v="up" title="Thumb up">👍</button><button class="vbtn down" data-v="down" title="Thumb down">👎</button></div>`
    +   `<div class="lbl"><span>Category <span class="recat-tag">· changed</span></span></div>`
    +   `<div class="cats">`
    +     `<button class="catbtn" data-cat="basic">Basic</button>`
    +     `<button class="catbtn" data-cat="engine">Engine</button>`
    +     `<button class="catbtn" data-cat="event">Event</button>`
    +   `</div>`
    +   `<div class="lbl"><span>Costs — install ⚡ · play 💧 ✦</span></div>`
    +   `<div class="costs">`
    +     `<label class="ci e" title="Energy (install / play)">⚡<input type="number" min="0" step="1" inputmode="numeric" data-r="e"></label>`
    +     `<label class="ci w" title="Water (per play / per use)">💧<input type="number" min="0" step="1" inputmode="numeric" data-r="w"></label>`
    +     `<label class="ci p" title="Phosphorus (per play / per use)">✦<input type="number" min="0" step="1" inputmode="numeric" data-r="p"></label>`
    +   `</div>`
    +   `<div class="lbl"><span>Description <span class="edited-tag">· edited</span></span></div>`
    +   `<textarea class="desc" spellcheck="true"></textarea>`
    +   `<input class="note" type="text" placeholder="Note (optional)…">`
    + `</div>`
    + `</div>`;
}

// data the client needs: slug -> {name, type, group, effect(original), archived}
const DATA = JSON.stringify(cards.map((c) => ({ slug: c.slug, name: c.name, type: c.type, dcat: c.displayCategory || c.type, group: GROUP[c.type] || c.type, tags: c.tags, effect: c.effect || '', archived: c.archived, e: c.buyCostEnergy || 0, w: c.playCostWater || 0, p: c.playCostPhosphorus || 0 })));

const body = `<style>${uiCss}${cardCss}</style>
<div class="wrap">
  <p class="eyebrow">Mycelium · full deck review</p>
  <h1>Review the whole deck</h1>
  <p class="lede">Every card on its real face. Re-categorize with the Basic/Engine/Event buttons, retune costs in the ⚡/💧/✦ boxes, and rewrite the description right in its box — all prefilled with the current values, and the card face updates live. 👍/👎 and note anything you want. When you're done, Export &amp; copy and paste it back to me; I'll apply the new categories, costs, rewrites and votes. Your work is saved in this browser. <b>Note:</b> ⚡ is the install/play cost; for abilities, 💧/✦ are the per-use costs (shown in the Actions menu, not on the face).</p>
  <div class="filterbar"><button class="fToggle" id="btnFilters" aria-expanded="true">Filters <span id="filtCur">· All</span> <span class="chev">▾</span></button></div>
  <div class="filters" id="filters"></div>
  <div class="grid" id="grid">${cells}</div>
</div>
<div class="bar"><div class="barwrap">
  <span class="metric"><b id="mRev">0</b>/<b id="mTot">0</b> reviewed · <span class="u">👍 <b id="mUp">0</b></span> · <span class="d">👎 <b id="mDown">0</b></span> · <span class="e">✏️ <b id="mEd">0</b></span> · <span class="e">🔧 <b id="mCost">0</b></span> · <span class="c">🔀 <b id="mReCat">0</b></span></span>
  <span style="flex:1"></span>
  <button class="btn ghost" id="btnReset">Reset</button>
  <button class="btn" id="btnExport">Export &amp; copy</button>
</div></div>
<div class="modal" id="modal"><div class="mbox">
  <h2>Your deck review</h2><p>Paste this back into the chat and I'll apply it.</p>
  <textarea id="out" readonly></textarea>
  <div class="mrow"><button class="btn ghost" id="btnClose">Close</button><button class="btn" id="btnCopy">Copy</button></div>
</div></div>
<div class="toast" id="toast">Copied</div>
<script>
(function(){
  var DATA=${DATA};
  var BY={}; DATA.forEach(function(c){ BY[c.slug]=c; });
  var KEY='mycelium-deck-review-v1';
  var store={}; try{ store=JSON.parse(localStorage.getItem(KEY))||{}; }catch(e){ store={}; }
  function persist(){ try{ localStorage.setItem(KEY,JSON.stringify(store)); }catch(e){} }
  function rec(slug){ return store[slug]||(store[slug]={}); }
  function norm(s){ return String(s||'').trim().replace(/\\s+/g,' '); }
  function curDesc(slug){ var r=store[slug]||{}; return (r.desc!=null)?r.desc:BY[slug].effect; }
  function isEdited(slug){ return norm(curDesc(slug))!==norm(BY[slug].effect); }
  var RES=['e','w','p'], RES_ICON={e:'⚡',w:'💧',p:'✦'};
  function curCost(slug,r){ var c=store[slug]&&store[slug].costs; if(c&&c[r]!=null&&c[r]!=='') return Math.max(0,+c[r]||0); return BY[slug][r]; }
  function costChanged(slug){ return RES.some(function(r){ return curCost(slug,r)!==BY[slug][r]; }); }
  function costDelta(slug){ var out=[]; RES.forEach(function(r){ var o=BY[slug][r],n=curCost(slug,r); if(o!==n) out.push(RES_ICON[r]+' '+o+'→'+n); }); return out.join(', '); }
  function curCat(slug){ var r=store[slug]; return (r&&r.cat)?r.cat:BY[slug].dcat; }
  function catChanged(slug){ return curCat(slug)!==BY[slug].dcat; }
  function changed(slug){ return isEdited(slug)||costChanged(slug)||catChanged(slug); }
  function pipsHTML(slug){ var c=BY[slug],g=[],e=curCost(slug,'e'),w=curCost(slug,'w'),p=curCost(slug,'p');
    if(e) g.push('<span class="cc e">'+e+'⚡</span>');
    if(c.type!=='action'){ if(w) g.push('<span class="cc w">'+w+'💧</span>'); if(p) g.push('<span class="cc p">'+p+'✦</span>'); }
    return g.join('')||'<span class="cc free">free</span>'; }

  document.querySelectorAll('.rv').forEach(function(rv){
    var slug=rv.dataset.slug, r=rec(slug);
    var up=rv.querySelector('.vbtn.up'), down=rv.querySelector('.vbtn.down');
    var desc=rv.querySelector('.desc'), note=rv.querySelector('.note'), face=rv.querySelector('[data-face-rules]'), facePips=rv.querySelector('[data-face-pips]');
    desc.value = curDesc(slug);
    face.textContent = desc.value;
    if(r.note) note.value=r.note;
    if(r.vote==='up') up.classList.add('on'); if(r.vote==='down') down.classList.add('on');
    if(changed(slug)) rv.classList.add('edited');
    // cost inputs — prefill, live-update the face pips, flag changed cells
    rv.querySelectorAll('.ci input').forEach(function(inp){
      var res=inp.dataset.r; inp.value=curCost(slug,res);
      inp.parentNode.classList.toggle('changed', curCost(slug,res)!==BY[slug][res]);
      inp.addEventListener('input',function(){
        var costs=(r.costs=r.costs||{}); costs[res]=inp.value===''?0:Math.max(0,+inp.value||0);
        inp.parentNode.classList.toggle('changed', curCost(slug,res)!==BY[slug][res]);
        facePips.innerHTML=pipsHTML(slug); rv.classList.toggle('edited',changed(slug)); persist(); metrics(); applyFilter();
      });
    });
    // category re-assignment (Basic / Engine / Event) — live-updates the face type
    var faceType=rv.querySelector('[data-face-type]');
    function paintCats(){ var cur=curCat(slug); rv.querySelectorAll('.catbtn').forEach(function(b){ b.classList.toggle('on', b.dataset.cat===cur); }); if(faceType) faceType.textContent=cur; rv.classList.toggle('recat',catChanged(slug)); }
    rv.querySelectorAll('.catbtn').forEach(function(b){ b.addEventListener('click',function(){
      r.cat = (r.cat===b.dataset.cat && b.dataset.cat===BY[slug].dcat) ? null : b.dataset.cat;   // click current baseline again = clear
      if(r.cat===BY[slug].dcat) delete r.cat;
      paintCats(); rv.classList.toggle('edited',changed(slug)); persist(); metrics(); applyFilter();
    }); });
    paintCats();
    up.addEventListener('click',function(){ r.vote=r.vote==='up'?null:'up'; up.classList.toggle('on',r.vote==='up'); down.classList.remove('on'); persist(); metrics(); applyFilter(); });
    down.addEventListener('click',function(){ r.vote=r.vote==='down'?null:'down'; down.classList.toggle('on',r.vote==='down'); up.classList.remove('on'); persist(); metrics(); applyFilter(); });
    desc.addEventListener('input',function(){ r.desc=desc.value; face.textContent=desc.value; rv.classList.toggle('edited',changed(slug)); persist(); metrics(); applyFilter(); });
    note.addEventListener('input',function(){ r.note=note.value; persist(); });
  });

  function metrics(){
    var up=0,down=0,ed=0,cost=0,recat=0,rev=0;
    DATA.forEach(function(c){ var r=store[c.slug]||{}; var e=isEdited(c.slug), cc=costChanged(c.slug), rc=catChanged(c.slug);
      if(r.vote==='up')up++; if(r.vote==='down')down++; if(e)ed++; if(cc)cost++; if(rc)recat++;
      if(r.vote||e||cc||rc||(r.note&&r.note.trim()))rev++; });
    document.getElementById('mUp').textContent=up; document.getElementById('mDown').textContent=down;
    document.getElementById('mEd').textContent=ed; document.getElementById('mCost').textContent=cost;
    document.getElementById('mReCat').textContent=recat;
    document.getElementById('mRev').textContent=rev;
    document.getElementById('mTot').textContent=DATA.length;
    buildFilters();
  }

  var filter='all';
  var TAGLBL={basic:'Basic',engine:'Engine',event:'Event',draw:'Draw',grow:'Grow',substrate:'Substrate',water:'Water',mineral:'Mineral',energy:'Energy',defense:'Defense'};
  var TAGORD=['basic','engine','event','draw','grow','substrate','water','mineral','energy','defense'];
  function counts(){
    var c={all:DATA.length,live:0,archived:0,up:0,down:0,edited:0,cost:0,recat:0,todo:0};
    var tg={};
    DATA.forEach(function(d){ var r=store[d.slug]||{}; var e=isEdited(d.slug), cc=costChanged(d.slug), rc=catChanged(d.slug);
      if(d.archived)c.archived++; else c.live++;
      if(r.vote==='up')c.up++; if(r.vote==='down')c.down++; if(e)c.edited++; if(cc)c.cost++; if(rc)c.recat++;
      if(!r.vote&&!e&&!cc&&!rc&&!(r.note&&r.note.trim()))c.todo++;
      (d.tags||[]).forEach(function(t){ tg[t]=(tg[t]||0)+1; }); });
    return {c:c,tg:tg};
  }
  function filterDefs(){
    var k=counts();
    var base=[['all','All',k.c.all],['live','Live',k.c.live],['archived','Archived',k.c.archived],
      ['todo','Untouched',k.c.todo],['recat','🔀 Recategorized',k.c.recat],['cost','🔧 Cost changed',k.c.cost],['edited','✏️ Text edited',k.c.edited],['up','👍 Liked',k.c.up],['down','👎 Disliked',k.c.down]];
    TAGORD.forEach(function(t){ if(k.tg[t]) base.push([t,TAGLBL[t],k.tg[t]]); });
    return base;
  }
  function filtLabel(k){ var d=filterDefs().find(function(x){return x[0]===k;}); return d?d[1]:k; }
  function updateFiltCur(){ var el=document.getElementById('filtCur'); if(el) el.textContent='· '+filtLabel(filter); }
  function isWide(){ try{ return window.matchMedia('(min-width:760px)').matches; }catch(e){ return true; } }
  function openFilters(){ var p=document.getElementById('filters'),t=document.getElementById('btnFilters');
    p.classList.add('open'); t.classList.add('open'); t.setAttribute('aria-expanded','true'); }
  function closeFilters(){ var p=document.getElementById('filters'),t=document.getElementById('btnFilters');
    p.classList.remove('open'); t.classList.remove('open'); t.setAttribute('aria-expanded','false'); }
  function buildFilters(){
    var el=document.getElementById('filters'); el.innerHTML='';
    filterDefs().forEach(function(d){ var b=document.createElement('button');
      b.className='fchip'+(filter===d[0]?' on':''); b.innerHTML=d[1]+' <span class="cnt">'+d[2]+'</span>';
      b.addEventListener('click',function(){ filter=d[0]; updateFiltCur(); buildFilters(); applyFilter(); if(!isWide()) closeFilters(); }); el.appendChild(b); });
  }
  function match(rv){
    var slug=rv.dataset.slug, arch=rv.dataset.arch==='1', r=store[slug]||{};
    switch(filter){
      case 'all': return true; case 'live': return !arch; case 'archived': return arch;
      case 'todo': return !r.vote && !changed(slug) && !(r.note&&r.note.trim());
      case 'cost': return costChanged(slug); case 'edited': return isEdited(slug); case 'recat': return catChanged(slug);
      case 'up': return r.vote==='up'; case 'down': return r.vote==='down';
      default: return (' '+(rv.dataset.tags||'')+' ').indexOf(' '+filter+' ')>=0;   // in-game effect tag
    }
  }
  function applyFilter(){ document.querySelectorAll('.rv').forEach(function(rv){ rv.classList.toggle('hide',!match(rv)); }); }

  function exportText(){
    var L=['# Mycelium — Full deck review',''];
    var k=counts();
    L.push(k.c.up+' 👍 · '+k.c.down+' 👎 · '+k.c.recat+' 🔀 recategorized · '+k.c.cost+' 🔧 re-costed · '+k.c.edited+' ✏️ text edits (of '+DATA.length+' cards)'); L.push('');
    var recat=DATA.filter(function(d){ return catChanged(d.slug); });
    if(recat.length){ L.push('## 🔀 Recategorized ('+recat.length+')'); L.push('');
      recat.forEach(function(d){ var r=store[d.slug]||{}; var note=(r.note&&r.note.trim())?(' — '+norm(r.note)):'';
        L.push('- '+d.name+(d.archived?' [archived]':'')+': '+d.dcat+' → '+curCat(d.slug)+note); }); L.push(''); }
    var recost=DATA.filter(function(d){ return costChanged(d.slug); });
    if(recost.length){ L.push('## 🔧 Cost changes ('+recost.length+')'); L.push('');
      recost.forEach(function(d){ var r=store[d.slug]||{}; var v=r.vote==='up'?' 👍':r.vote==='down'?' 👎':'';
        var note=(r.note&&r.note.trim())?(' — '+norm(r.note)):'';
        L.push('- '+d.name+(d.archived?' [archived]':'')+': '+costDelta(d.slug)+v+note); }); L.push(''); }
    var edited=DATA.filter(function(d){ return isEdited(d.slug); });
    if(edited.length){ L.push('## ✏️ Rewritten descriptions ('+edited.length+')'); L.push('');
      edited.forEach(function(d){ var r=store[d.slug]||{}; var v=r.vote==='up'?' 👍':r.vote==='down'?' 👎':'';
        L.push('### '+d.name+(d.archived?' [archived]':'')+' — '+d.group+v);
        L.push('OLD: '+norm(d.effect)); L.push('NEW: '+norm(curDesc(d.slug)));
        if(r.note&&r.note.trim()) L.push('NOTE: '+norm(r.note)); L.push(''); }); }
    var down=DATA.filter(function(d){ return (store[d.slug]||{}).vote==='down'; });
    var up=DATA.filter(function(d){ return (store[d.slug]||{}).vote==='up' && !isEdited(d.slug); });
    function line(d){ var r=store[d.slug]||{}; var n=(r.note&&r.note.trim())?(' — '+norm(r.note)):''; return '- '+d.name+(d.archived?' [archived]':'')+n; }
    if(down.length){ L.push('## 👎 Disliked ('+down.length+')'); down.forEach(function(d){L.push(line(d));}); L.push(''); }
    if(up.length){ L.push('## 👍 Liked, description unchanged ('+up.length+')'); up.forEach(function(d){L.push(line(d));}); L.push(''); }
    var noteOnly=DATA.filter(function(d){ var r=store[d.slug]||{}; return !isEdited(d.slug) && !r.vote && r.note && r.note.trim(); });
    if(noteOnly.length){ L.push('## 💬 Notes only ('+noteOnly.length+')'); noteOnly.forEach(function(d){L.push(line(d));}); L.push(''); }
    return L.join('\\n');
  }

  var modal=document.getElementById('modal');
  document.getElementById('btnExport').addEventListener('click',function(){ document.getElementById('out').value=exportText(); modal.classList.add('open'); });
  document.getElementById('btnClose').addEventListener('click',function(){ modal.classList.remove('open'); });
  modal.addEventListener('click',function(e){ if(e.target===modal) modal.classList.remove('open'); });
  document.getElementById('btnCopy').addEventListener('click',function(){ var out=document.getElementById('out'); out.select();
    var done=function(){ var t=document.getElementById('toast'); t.classList.add('on'); setTimeout(function(){t.classList.remove('on');},1300); };
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(out.value).then(done,done); } else { try{document.execCommand('copy');}catch(e){} done(); } });
  document.getElementById('btnReset').addEventListener('click',function(){
    if(confirm('Clear every vote, cost change, rewrite and note? Restores all cards to their originals.')){ store={}; persist();
      document.querySelectorAll('.rv').forEach(function(rv){ var slug=rv.dataset.slug;
        rv.classList.remove('edited'); rv.querySelector('.vbtn.up').classList.remove('on'); rv.querySelector('.vbtn.down').classList.remove('on');
        var d=rv.querySelector('.desc'); d.value=BY[slug].effect; rv.querySelector('[data-face-rules]').textContent=BY[slug].effect; rv.querySelector('.note').value='';
        rv.querySelectorAll('.ci input').forEach(function(inp){ inp.value=BY[slug][inp.dataset.r]; inp.parentNode.classList.remove('changed'); });
        rv.querySelector('[data-face-pips]').innerHTML=pipsHTML(slug);
        rv.classList.remove('recat'); rv.querySelectorAll('.catbtn').forEach(function(b){ b.classList.toggle('on', b.dataset.cat===BY[slug].dcat); });
        var ft=rv.querySelector('[data-face-type]'); if(ft) ft.textContent=BY[slug].dcat; });
      metrics(); applyFilter(); } });

  document.getElementById('btnFilters').addEventListener('click',function(){
    document.getElementById('filters').classList.contains('open') ? closeFilters() : openFilters(); });

  metrics(); applyFilter(); updateFiltCur();
  if(isWide()) openFilters(); else closeFilters();
})();
</script>`;

writeFileSync(target, body);
const missing = cards.filter((c) => !artUri(c.slug)).map((c) => c.slug);
console.log('wrote', target, '(' + (body.length / 1024 / 1024).toFixed(2) + ' MB)', missing.length ? ('MISSING ART: ' + missing.join(', ')) : `all ${cards.length} cards, art present`);
