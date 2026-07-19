// Build the CARD COST + DESCRIPTION EDITOR — a self-contained, directly-openable
// tool (docs/card-editor.html) that inlines the live docs/cards.json AND shows the
// REAL in-game card face beside each card (art + cost pips + name + rules, using the
// game's own markup/CSS), so you review and edit every card's costs (buy ⚡, play
// ⚡/💧/P) and its description (effect) + flavour with a live preview.
//
// Round-trip two ways:
//   1) "Download cards.json" → drop it over docs/cards.json, then
//      `node scripts/gen-carddata.mjs && node build.mjs`.
//   2) "Copy changes" → paste the change summary back to Claude to apply.
// Edits persist in localStorage. Card art is inlined as data: URIs so the tool is
// self-contained (works from disk, a local server, or the hosted site). Regenerate
// (`node scripts/build_cardeditor.mjs`) whenever cards.json or the art changes.
//
// NOTE: emits a FULL standalone HTML document — it's opened straight from disk / the site.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SRC = join(ROOT, 'docs', 'cards.json');
const ARTDIR = join(ROOT, 'assets', 'cards');
const target = process.argv[2] || join(ROOT, 'docs', 'card-editor.html');

const cards = JSON.parse(readFileSync(SRC, 'utf8'));
if (!Array.isArray(cards)) throw new Error('cards.json is not an array');

// Match src/render/ui.js cardSlug(): name -> art file stem.
const slugOf = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Inline each card's art (assets/cards/<slug>.jpg) as a data: URI, keyed by card name.
const art = {};
let haveArt = 0;
for (const c of cards) {
  const p = join(ARTDIR, slugOf(c.name) + '.jpg');
  if (existsSync(p)) { art[c.name] = 'data:image/jpeg;base64,' + readFileSync(p).toString('base64'); haveArt++; }
}

const esc = (s) => String(s == null ? '' : s).replace(/<\//g, '<\\/');
const dataJson = JSON.stringify(cards).replace(/<\//g, '<\\/');
const artJson = JSON.stringify(art).replace(/<\//g, '<\\/');

const css = `
:root{ --bg:#08110d; --bg2:#050b08; --panel:#0e1a15; --panel2:#0a1410; --line:rgba(126,240,192,.16);
  --ink:#e6f4ec; --dim:#8fb3a4; --mint:#7ef0c0; --amber:#ffb95e; --water:#6cc7ff; --phos:#c79bff; --edit:#ffd76a; }
*{box-sizing:border-box}
body{margin:0}
.wrap{max-width:1240px;margin:0 auto;padding:24px 18px 150px;color:var(--ink);
  font-family:"Segoe UI",Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  background:radial-gradient(1100px 460px at 26% -8%,rgba(126,240,192,.06),transparent 60%),
    radial-gradient(900px 460px at 92% 4%,rgba(255,185,94,.05),transparent 55%),linear-gradient(180deg,var(--bg),var(--bg2));min-height:100vh}
.eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--mint);font-weight:700;margin:0 0 6px}
h1{font-size:27px;line-height:1.12;margin:0 0 8px;font-weight:800;letter-spacing:-.01em}
.lede{color:var(--dim);font-size:13.5px;max-width:82ch;line-height:1.55;margin:0 0 4px}
.lede b{color:var(--ink)} .lede code{background:var(--panel2);border:1px solid var(--line);border-radius:5px;padding:1px 5px;font-size:12px}
.tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:18px 0 4px;position:sticky;top:0;z-index:20;
  padding:10px 0;background:linear-gradient(180deg,var(--bg) 70%,transparent)}
.search{flex:1 1 240px;min-width:180px;font:inherit;font-size:14px;border-radius:10px;padding:9px 12px;background:var(--panel2);border:1px solid var(--line);color:var(--ink)}
.search::placeholder{color:var(--dim)} .search:focus{outline:none;border-color:var(--mint)}
.sel{font:inherit;font-size:13px;border-radius:10px;padding:9px 10px;background:var(--panel2);border:1px solid var(--line);color:var(--ink)}
.chk{display:inline-flex;align-items:center;gap:6px;color:var(--dim);font-size:13px;cursor:pointer;user-select:none}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px}
@media(max-width:980px){.grid{grid-template-columns:1fr}}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 14px 15px;box-shadow:0 14px 40px -26px rgba(0,0,0,.7);position:relative}
.card.changed{border-color:rgba(255,215,106,.55);box-shadow:0 0 0 1px rgba(255,215,106,.25),0 14px 40px -26px rgba(0,0,0,.7)}
.card.hidden{display:none}
.cardrow{display:flex;gap:15px;align-items:flex-start;flex-wrap:wrap}
.facewrap{flex:0 0 auto}
.editwrap{flex:1 1 300px;min-width:250px}
.chead{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin:0 0 10px}
.cn2{font-size:16px;font-weight:800;letter-spacing:-.01em}
.badge{font-size:9.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:3px 7px;border-radius:999px;background:var(--panel2);border:1px solid var(--line);color:var(--dim)}
.badge.engine{color:#2b1805;background:var(--amber);border-color:transparent}
.badge.event{color:#04140d;background:var(--mint);border-color:transparent}
.dot{margin-left:auto;font-size:10.5px;font-weight:800;color:var(--edit);opacity:0;white-space:nowrap}
.card.changed .dot{opacity:1}
.costs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:6px}
.cost{display:flex;flex-direction:column;gap:3px}
.cost label{font-size:10px;font-weight:700;letter-spacing:.04em;color:var(--dim);text-transform:uppercase}
.cost input{font:inherit;font-size:15px;font-weight:700;text-align:center;border-radius:8px;padding:7px 4px;background:var(--panel2);border:1px solid var(--line);color:var(--ink)}
.cost input:focus{outline:none;border-color:var(--mint)}
.cost input.diff{border-color:var(--edit);color:var(--edit)}
.cost.e label{color:var(--mint)} .cost.w label{color:var(--water)} .cost.p label{color:var(--phos)}
.hint{font-size:10.5px;color:var(--dim);margin:2px 0 8px}
.fl{display:block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin:8px 0 3px}
textarea{width:100%;font:inherit;font-size:13px;line-height:1.4;border-radius:9px;padding:8px 10px;background:var(--panel2);border:1px solid var(--line);color:var(--ink);resize:vertical}
textarea:focus{outline:none;border-color:var(--mint)}
textarea.diff{border-color:var(--edit)}
textarea.eff{min-height:52px} textarea.flav{min-height:40px;color:var(--dim);font-style:italic}

/* ---- REAL in-game card face (markup + CSS lifted from index.html) ---- */
.facewrap{ --accent:#7fe6a3; --fink:#d7e6dc; --fdim:#8aa193;
  --fserif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif; }
.facewrap .cardbtn{ position:relative;display:flex;flex-direction:column;align-items:stretch;aspect-ratio:5/7;width:158px;
  --cacc:130,230,166; --chi:170,255,205; --cink:#7fe6a3;
  padding:0;overflow:hidden;background:linear-gradient(158deg,#101a15,#070c0a 72%);
  border:2px solid rgba(var(--cacc),0.5);border-radius:14px;color:var(--fink);text-align:left;
  box-shadow:0 0 9px -2px rgba(var(--cacc),0.45),inset 0 0 0 1px rgba(var(--cacc),0.16),0 8px 18px -9px rgba(0,0,0,0.75); }
.facewrap .cardbtn.cat-engine{ --cacc:226,118,108; --chi:244,158,148; --cink:#e58a7e; }
.facewrap .cardbtn.cat-event{ --cacc:240,166,94; --chi:255,200,150; --cink:#f0aa62; }
.facewrap .cart{ position:relative;margin:6px 6px 0;aspect-ratio:3/2;flex:0 0 auto;overflow:hidden;
  border-radius:10px 10px 30px 30px / 10px 10px 16px 16px;
  background:radial-gradient(circle at 50% 40%,#16241c,#060f0b);
  box-shadow:inset 0 0 0 1px rgba(var(--cacc),0.28),inset 0 -14px 20px -12px rgba(4,7,6,0.9); }
.facewrap .caimg{ width:100%;height:100%;object-fit:cover;display:block; }
.facewrap .pips{ position:absolute;top:10px;left:10px;z-index:6;display:flex;flex-direction:column;gap:4px;align-items:flex-start; }
.facewrap .cplate{ text-align:center;padding:5px 9px 2px;flex:0 0 auto; }
.facewrap .cplate .cn{ font-family:var(--fserif);font-size:13px;font-weight:600;line-height:1.1;color:#eaf4ee;text-shadow:0 1px 6px rgba(0,0,0,0.6);display:block; }
.facewrap .cplate .ct{ font-size:8px;color:var(--cink);text-transform:uppercase;letter-spacing:0.14em;margin-top:2px;display:block; }
.facewrap .crules{ margin:2px 7px 8px;padding:5px 8px;flex:1 1 auto;min-height:0;overflow:hidden;
  display:flex;align-items:flex-start;border:1px solid rgba(var(--cacc),0.16);border-radius:9px;
  background:linear-gradient(180deg,rgba(10,16,13,0.5),rgba(6,10,8,0.68));font-size:9.5px;line-height:1.3;color:#d3e2da; }
.facewrap .cc{ display:inline-flex;align-items:center;gap:1px;font-size:10px;font-weight:700;border-radius:5px;padding:1px 5px; }
.facewrap .cc.e{ color:var(--accent);background:rgba(127,230,163,0.14); }
.facewrap .cc.w{ color:#7fd0e0;background:rgba(70,184,204,0.15); }
.facewrap .cc.p{ color:#c79be6;background:rgba(179,128,224,0.15); }
.facewrap .cc.free{ color:var(--fdim);background:rgba(255,255,255,0.06); }
.facewrap .ri{ display:inline-block;width:1em;height:1em;flex:0 0 auto;vertical-align:-0.14em; }

.bar{position:fixed;left:0;right:0;bottom:0;background:var(--panel);border-top:1px solid var(--line);padding:12px 18px;
  display:flex;gap:14px;flex-wrap:wrap;align-items:center;backdrop-filter:blur(6px);box-shadow:0 -10px 30px -20px rgba(0,0,0,.8);z-index:40}
.barwrap{max-width:1240px;margin:0 auto;width:100%;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.metric{font-size:13px;color:var(--dim)} .metric b{color:var(--edit)}
.btn{font:inherit;font-weight:700;font-size:13px;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;color:#04140d;background:linear-gradient(180deg,#9bf0b8,#57cf8c)}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--ink)}
.modal{position:fixed;inset:0;background:rgba(3,7,5,.72);display:none;align-items:center;justify-content:center;z-index:60;padding:20px}
.modal.open{display:flex}
.mbox{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;max-width:680px;width:100%}
.mbox h2{margin:0 0 4px;font-size:17px} .mbox p{margin:0 0 10px;color:var(--dim);font-size:12.5px}
.mbox textarea{height:320px;font-family:ui-monospace,Menlo,monospace;font-size:12px}
.mrow{display:flex;gap:10px;justify-content:flex-end;margin-top:10px}
.toast{position:fixed;bottom:84px;left:50%;transform:translateX(-50%);background:var(--mint);color:#04140d;font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;opacity:0;transition:.2s;pointer-events:none;z-index:70}
.toast.on{opacity:1}
`;

const body = `<div class="wrap">
  <p class="eyebrow">Mycelium · card editor</p>
  <h1>Review &amp; edit card costs and descriptions</h1>
  <p class="lede">Every card from <code>docs/cards.json</code>, shown on its <b>real in-game face</b>. Change any <b>buy / play cost</b> or the <b>description</b> &amp; <b>flavour</b> — the card face updates live, edited fields glow amber, and your work is saved in this browser. When done, either <b>Download cards.json</b> and drop it over <code>docs/cards.json</code> (then <code>node scripts/gen-carddata.mjs &amp;&amp; node build.mjs</code>), or <b>Copy changes</b> and paste them back to Claude.</p>
  <div class="tools">
    <input class="search" id="search" type="text" placeholder="Search name, type, or effect…">
    <select class="sel" id="typeSel"><option value="">All types</option></select>
    <label class="chk"><input type="checkbox" id="onlyChanged"> Changed only</label>
  </div>
  <div class="grid" id="grid"></div>
</div>
<div class="bar"><div class="barwrap">
  <span class="metric"><b id="mChanged">0</b> cards edited · <b id="mFields">0</b> fields</span>
  <span style="flex:1"></span>
  <button class="btn ghost" id="btnReset">Reset all</button>
  <button class="btn ghost" id="btnCopy">Copy changes</button>
  <button class="btn" id="btnDownload">Download cards.json</button>
</div></div>
<div class="modal" id="modal"><div class="mbox">
  <h2>Changes</h2>
  <p>Paste this back to Claude to apply — or use <b>Download cards.json</b> for the full file.</p>
  <textarea id="out" readonly></textarea>
  <div class="mrow"><button class="btn ghost" id="btnMclose">Close</button><button class="btn" id="btnMcopy">Copy</button></div>
</div></div>
<div class="toast" id="toast">Copied</div>
<script type="application/json" id="cardData">${dataJson}</script>
<script type="application/json" id="cardArt">${artJson}</script>
<script>
(function(){
  var CARDS = JSON.parse(document.getElementById('cardData').textContent);
  var ART = JSON.parse(document.getElementById('cardArt').textContent);
  var COST_FIELDS = ['buyCostEnergy','playCostEnergy','playCostWater','playCostPhosphorus'];
  var TEXT_FIELDS = ['effect','flavor'];
  var KEY = 'mycelium-card-editor-v1';
  var edits = {}; try{ edits = JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ edits = {}; }
  function persist(){ try{ localStorage.setItem(KEY, JSON.stringify(edits)); }catch(e){} }
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
  var pip = function(n){ return (n|0); };

  // ---- edit state ----
  function cur(card, field){ var e = edits[card.name]; if(e && e[field]!==undefined) return e[field]; return card[field]; }
  function isDiff(card, field){
    var v = cur(card, field), o = card[field];
    if(COST_FIELDS.indexOf(field)>=0) return (v|0) !== (o|0);
    return String(v==null?'':v) !== String(o==null?'':o);
  }
  function setEdit(card, field, val){
    var o = card[field];
    var same = COST_FIELDS.indexOf(field)>=0 ? ((val|0)===(o|0)) : (String(val==null?'':val)===String(o==null?'':o));
    if(!edits[card.name]) edits[card.name] = {};
    if(same){ delete edits[card.name][field]; if(!Object.keys(edits[card.name]).length) delete edits[card.name]; }
    else { edits[card.name][field] = val; }
    persist();
  }

  // ---- real in-game card face (mirrors src/render/ui.js) ----
  var RES_ICON = {
    energy: '<svg class="ri" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2 4 13.5h6L9 22l9.5-11.5h-6L13.5 2Z" fill="#f4c22e"/></svg>',
    water: '<svg class="ri" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5C12 2.5 5.5 10 5.5 14.5a6.5 6.5 0 1 0 13 0C18.5 10 12 2.5 12 2.5Z" fill="#7fd0e0"/></svg>',
    phos: '<svg class="ri" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5c1 6.2 4.3 9.5 10.5 10.5C16.3 13 13 16.3 12 22.5 11 16.3 7.7 13 1.5 12 7.7 11 11 7.7 12 1.5Z" fill="#c79be6"/></svg>',
  };
  function faceCat(card){ var dc = card.displayCategory || card.type || ''; return dc==='engine'?'cat-engine':dc==='event'?'cat-event':'cat-basic'; }
  // Card-face pips = the gate the game draws: buy Energy, and (non-action) play Water/Phosphorus.
  function pipHTML(card){
    var g = [];
    var be = pip(cur(card,'buyCostEnergy')); if(be) g.push('<span class="cc e">'+be+RES_ICON.energy+'</span>');
    if(card.type !== 'action'){
      var w = pip(cur(card,'playCostWater')); if(w) g.push('<span class="cc w">'+w+RES_ICON.water+'</span>');
      var p = pip(cur(card,'playCostPhosphorus')); if(p) g.push('<span class="cc p">'+p+RES_ICON.phos+'</span>');
    }
    return g.join('') || '<span class="cc free">free</span>';
  }
  function faceHTML(card){
    var uri = ART[card.name];
    var img = uri ? '<img class="caimg" draggable="false" src="'+uri+'" alt="">' : '';
    return '<div class="cardbtn '+faceCat(card)+'">'
      + '<span class="cart">'+img+'</span>'
      + '<span class="pips">'+pipHTML(card)+'</span>'
      + '<span class="cplate"><span class="cn">'+esc(card.name)+'</span><span class="ct">'+esc(card.displayCategory||card.type||'')+'</span></span>'
      + '<span class="crules">'+esc(cur(card,'effect'))+'</span>'
      + '</div>';
  }

  var TYPES = {}; CARDS.forEach(function(c){ TYPES[c.type||'—']=1; });
  var typeSel = document.getElementById('typeSel');
  Object.keys(TYPES).sort().forEach(function(t){ var o=document.createElement('option'); o.value=t; o.textContent=t; typeSel.appendChild(o); });
  // Filter controls referenced by applyFilter(), which refreshCard() calls DURING the render loop below.
  var search = document.getElementById('search'), onlyChanged = document.getElementById('onlyChanged');

  var grid = document.getElementById('grid');
  var nodes = {};
  CARDS.forEach(function(card){
    var famClass = card.type==='engine' || card.category==='engine' ? 'engine' : (card.type==='event'?'event':'');
    var wrap = document.createElement('section'); wrap.className='card'; wrap.dataset.name=card.name;
    wrap.innerHTML =
      '<div class="cardrow">'+
        '<div class="facewrap">'+faceHTML(card)+'</div>'+
        '<div class="editwrap">'+
          '<div class="chead"><span class="cn2">'+esc(card.name)+'</span>'+
            '<span class="badge '+famClass+'">'+esc(card.type||'')+'</span>'+
            (card.category?'<span class="badge">'+esc(card.category)+'</span>':'')+
            '<span class="dot">● edited</span></div>'+
          '<div class="costs">'+
            '<div class="cost"><label>Buy ⚡</label><input type="number" min="0" step="1" data-f="buyCostEnergy"></div>'+
            '<div class="cost e"><label>Play ⚡</label><input type="number" min="0" step="1" data-f="playCostEnergy"></div>'+
            '<div class="cost w"><label>Play 💧</label><input type="number" min="0" step="1" data-f="playCostWater"></div>'+
            '<div class="cost p"><label>Play P</label><input type="number" min="0" step="1" data-f="playCostPhosphorus"></div>'+
          '</div>'+
          '<div class="hint">Card face shows the buy ⚡ gate'+(card.type==='action'?' (an action\\'s play W/P is a per-use cost, not shown on the face)':' + play 💧/P')+'.</div>'+
          '<label class="fl">Description (effect)</label><textarea class="eff" data-f="effect"></textarea>'+
          '<label class="fl">Flavour</label><textarea class="flav" data-f="flavor"></textarea>'+
        '</div>'+
      '</div>';
    grid.appendChild(wrap);
    nodes[card.name] = wrap;

    wrap.querySelectorAll('input[data-f]').forEach(function(inp){
      var f = inp.dataset.f; inp.value = pip(cur(card,f));
      inp.addEventListener('input', function(){
        var v = inp.value===''?0:parseInt(inp.value,10); if(isNaN(v)||v<0) v=0;
        setEdit(card,f,v); refreshCard(card); metrics();
      });
    });
    wrap.querySelectorAll('textarea[data-f]').forEach(function(ta){
      var f = ta.dataset.f; ta.value = cur(card,f)||'';
      ta.addEventListener('input', function(){ setEdit(card,f,ta.value); refreshCard(card); metrics(); });
    });
    refreshCard(card);
  });

  function refreshCard(card){
    var wrap = nodes[card.name];
    var changed = !!(edits[card.name] && Object.keys(edits[card.name]).length);
    wrap.classList.toggle('changed', changed);
    wrap.querySelectorAll('input[data-f]').forEach(function(inp){ inp.classList.toggle('diff', isDiff(card,inp.dataset.f)); });
    wrap.querySelectorAll('textarea[data-f]').forEach(function(ta){ ta.classList.toggle('diff', isDiff(card,ta.dataset.f)); });
    // Live-update the real card face: pips (costs) + rules (effect).
    var pipsEl = wrap.querySelector('.facewrap .pips'); if(pipsEl) pipsEl.innerHTML = pipHTML(card);
    var rulesEl = wrap.querySelector('.facewrap .crules'); if(rulesEl) rulesEl.textContent = cur(card,'effect')||'';
    applyFilter(card);
  }

  // ---- filtering ----
  function applyFilter(card){
    var wrap = nodes[card.name];
    var q = search.value.trim().toLowerCase();
    var t = typeSel.value;
    var changed = !!(edits[card.name] && Object.keys(edits[card.name]).length);
    var hay = (card.name+' '+(card.type||'')+' '+(card.category||'')+' '+(cur(card,'effect')||'')+' '+(cur(card,'flavor')||'')).toLowerCase();
    var show = (!q || hay.indexOf(q)>=0) && (!t || card.type===t) && (!onlyChanged.checked || changed);
    wrap.classList.toggle('hidden', !show);
  }
  function applyAll(){ CARDS.forEach(applyFilter); }
  search.addEventListener('input', applyAll);
  typeSel.addEventListener('change', applyAll);
  onlyChanged.addEventListener('change', applyAll);

  // ---- metrics ----
  function metrics(){
    var c=0, f=0;
    Object.keys(edits).forEach(function(n){ var k=Object.keys(edits[n]); if(k.length){ c++; f+=k.length; } });
    document.getElementById('mChanged').textContent = c;
    document.getElementById('mFields').textContent = f;
  }
  metrics();

  // ---- exports ----
  function mergedCards(){
    return CARDS.map(function(c){
      var e = edits[c.name]; if(!e) return c;
      var out = {}; for(var k in c) out[k]=c[k];
      COST_FIELDS.concat(TEXT_FIELDS).forEach(function(f){ if(e[f]!==undefined) out[f]=e[f]; });
      return out;
    });
  }
  function changeText(){
    var L=['# Mycelium — card edits',''];
    var any=false;
    CARDS.forEach(function(c){
      var e = edits[c.name]; if(!e || !Object.keys(e).length) return; any=true;
      L.push('## '+c.name);
      COST_FIELDS.forEach(function(f){ if(e[f]!==undefined) L.push('- '+f+': '+(c[f]|0)+' -> '+(e[f]|0)); });
      TEXT_FIELDS.forEach(function(f){ if(e[f]!==undefined){ L.push('- '+f+':'); L.push('    FROM: '+String(c[f]==null?'':c[f])); L.push('    TO:   '+String(e[f]==null?'':e[f])); } });
      L.push('');
    });
    if(!any) L.push('(no changes yet)');
    return L.join('\\n');
  }

  var toast = document.getElementById('toast');
  function ping(msg){ toast.textContent=msg||'Copied'; toast.classList.add('on'); setTimeout(function(){toast.classList.remove('on');},1300); }
  function copy(text, msg){
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(function(){ping(msg);},function(){ping(msg);}); }
    else { var t=document.createElement('textarea'); t.value=text; document.body.appendChild(t); t.select(); try{document.execCommand('copy');}catch(e){} t.remove(); ping(msg); }
  }

  document.getElementById('btnDownload').addEventListener('click', function(){
    var json = JSON.stringify(mergedCards(), null, 2) + '\\n';
    var blob = new Blob([json], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href=url; a.download='cards.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    ping('cards.json downloaded');
  });
  var modal = document.getElementById('modal');
  document.getElementById('btnCopy').addEventListener('click', function(){ document.getElementById('out').value = changeText(); modal.classList.add('open'); });
  document.getElementById('btnMclose').addEventListener('click', function(){ modal.classList.remove('open'); });
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.classList.remove('open'); });
  document.getElementById('btnMcopy').addEventListener('click', function(){ copy(document.getElementById('out').value, 'Changes copied'); });
  document.getElementById('btnReset').addEventListener('click', function(){
    if(!confirm('Discard every edit and restore original costs/descriptions?')) return;
    edits = {}; persist();
    CARDS.forEach(function(card){
      var wrap = nodes[card.name];
      wrap.querySelectorAll('input[data-f]').forEach(function(inp){ inp.value = pip(card[inp.dataset.f]); });
      wrap.querySelectorAll('textarea[data-f]').forEach(function(ta){ ta.value = card[ta.dataset.f]||''; });
      refreshCard(card);
    });
    metrics(); ping('Reset');
  });
})();
</script>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mycelium — Card cost &amp; description editor</title>
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>
`;

writeFileSync(target, html);
console.log('wrote', target, '(' + (html.length / 1024 / 1024).toFixed(2) + ' MB, ' + cards.length + ' cards, ' + haveArt + ' with art)');
