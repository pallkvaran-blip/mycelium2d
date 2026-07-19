// Build the CARD COST + DESCRIPTION EDITOR — a self-contained, directly-openable
// tool (docs/card-editor.html) that inlines the live docs/cards.json and lets you
// review + edit every card's costs (buy ⚡, play ⚡/💧/P) and its description (effect)
// and flavour text, then round-trip the result two ways:
//   1) "Download cards.json" → drop it over docs/cards.json, then
//      `node scripts/gen-carddata.mjs && node build.mjs`.
//   2) "Copy changes" → paste the change summary back to Claude to apply.
// Edits persist in localStorage so a refresh never loses work. Regenerate this file
// (`node scripts/build_cardeditor.mjs`) whenever cards.json changes to refresh the data.
//
// NOTE: emits a FULL standalone HTML document (unlike the Artifact-fragment tools),
// because it's meant to be opened straight from disk / the hosted site.
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SRC = join(ROOT, 'docs', 'cards.json');
const target = process.argv[2] || join(ROOT, 'docs', 'card-editor.html');

const cards = JSON.parse(readFileSync(SRC, 'utf8'));
if (!Array.isArray(cards)) throw new Error('cards.json is not an array');

// Inline the FULL card objects (so download can re-emit every original field, only
// overriding the edited ones). Escape </ so the JSON can't close the <script> early.
const dataJson = JSON.stringify(cards).replace(/<\//g, '<\\/');

const css = `
:root{ --bg:#08110d; --bg2:#050b08; --panel:#0e1a15; --panel2:#0a1410; --line:rgba(126,240,192,.16);
  --ink:#e6f4ec; --dim:#8fb3a4; --mint:#7ef0c0; --amber:#ffb95e; --water:#6cc7ff; --phos:#c79bff; --edit:#ffd76a; }
*{box-sizing:border-box}
body{margin:0}
.wrap{max-width:1180px;margin:0 auto;padding:24px 18px 150px;color:var(--ink);
  font-family:"Segoe UI",Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  background:radial-gradient(1100px 460px at 26% -8%,rgba(126,240,192,.06),transparent 60%),
    radial-gradient(900px 460px at 92% 4%,rgba(255,185,94,.05),transparent 55%),linear-gradient(180deg,var(--bg),var(--bg2));min-height:100vh}
.eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--mint);font-weight:700;margin:0 0 6px}
h1{font-size:27px;line-height:1.12;margin:0 0 8px;font-weight:800;letter-spacing:-.01em}
.lede{color:var(--dim);font-size:13.5px;max-width:78ch;line-height:1.55;margin:0 0 4px}
.lede b{color:var(--ink)} .lede code{background:var(--panel2);border:1px solid var(--line);border-radius:5px;padding:1px 5px;font-size:12px}
.tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:18px 0 4px;position:sticky;top:0;z-index:20;
  padding:10px 0;background:linear-gradient(180deg,var(--bg) 70%,transparent)}
.search{flex:1 1 240px;min-width:180px;font:inherit;font-size:14px;border-radius:10px;padding:9px 12px;background:var(--panel2);border:1px solid var(--line);color:var(--ink)}
.search::placeholder{color:var(--dim)} .search:focus{outline:none;border-color:var(--mint)}
.sel{font:inherit;font-size:13px;border-radius:10px;padding:9px 10px;background:var(--panel2);border:1px solid var(--line);color:var(--ink)}
.chk{display:inline-flex;align-items:center;gap:6px;color:var(--dim);font-size:13px;cursor:pointer;user-select:none}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px}
@media(max-width:820px){.grid{grid-template-columns:1fr}}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 14px 15px;box-shadow:0 14px 40px -26px rgba(0,0,0,.7);position:relative}
.card.changed{border-color:rgba(255,215,106,.55);box-shadow:0 0 0 1px rgba(255,215,106,.25),0 14px 40px -26px rgba(0,0,0,.7)}
.card.hidden{display:none}
.chead{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin:0 0 10px}
.cn{font-size:16px;font-weight:800;letter-spacing:-.01em}
.badge{font-size:9.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:3px 7px;border-radius:999px;background:var(--panel2);border:1px solid var(--line);color:var(--dim)}
.badge.engine{color:#2b1805;background:var(--amber);border-color:transparent}
.badge.event{color:#04140d;background:var(--mint);border-color:transparent}
.dot{margin-left:auto;font-size:10.5px;font-weight:800;color:var(--edit);opacity:0;white-space:nowrap}
.card.changed .dot{opacity:1}
.costs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
.cost{display:flex;flex-direction:column;gap:3px}
.cost label{font-size:10px;font-weight:700;letter-spacing:.04em;color:var(--dim);text-transform:uppercase}
.cost input{font:inherit;font-size:15px;font-weight:700;text-align:center;border-radius:8px;padding:7px 4px;background:var(--panel2);border:1px solid var(--line);color:var(--ink)}
.cost input:focus{outline:none;border-color:var(--mint)}
.cost input.diff{border-color:var(--edit);color:var(--edit)}
.cost.e label{color:var(--mint)} .cost.w label{color:var(--water)} .cost.p label{color:var(--phos)}
.pips{font-size:12px;color:var(--dim);margin:-2px 0 10px;min-height:16px}
.pips b{color:var(--ink)}
.fl{display:block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin:8px 0 3px}
textarea{width:100%;font:inherit;font-size:13px;line-height:1.4;border-radius:9px;padding:8px 10px;background:var(--panel2);border:1px solid var(--line);color:var(--ink);resize:vertical}
textarea:focus{outline:none;border-color:var(--mint)}
textarea.diff{border-color:var(--edit)}
textarea.eff{min-height:52px} textarea.flav{min-height:40px;color:var(--dim);font-style:italic}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--panel);border-top:1px solid var(--line);padding:12px 18px;
  display:flex;gap:14px;flex-wrap:wrap;align-items:center;backdrop-filter:blur(6px);box-shadow:0 -10px 30px -20px rgba(0,0,0,.8);z-index:40}
.barwrap{max-width:1180px;margin:0 auto;width:100%;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.metric{font-size:13px;color:var(--dim)} .metric b{color:var(--edit)}
.btn{font:inherit;font-weight:700;font-size:13px;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;color:#04140d;background:linear-gradient(180deg,#9bf0b8,#57cf8c)}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--ink)}
.btn:disabled{opacity:.45;cursor:not-allowed}
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
  <p class="lede">Every card from <code>docs/cards.json</code>. Change any <b>buy / play cost</b> or the <b>description</b> &amp; <b>flavour</b> — edited fields glow amber and your work is saved in this browser. When you're done, either <b>Download cards.json</b> and drop it over <code>docs/cards.json</code> (then <code>node scripts/gen-carddata.mjs &amp;&amp; node build.mjs</code>), or <b>Copy changes</b> and paste them back to Claude.</p>
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
<script>
(function(){
  var CARDS = JSON.parse(document.getElementById('cardData').textContent);
  var COST_FIELDS = ['buyCostEnergy','playCostEnergy','playCostWater','playCostPhosphorus'];
  var TEXT_FIELDS = ['effect','flavor'];
  var KEY = 'mycelium-card-editor-v1';
  var edits = {}; try{ edits = JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ edits = {}; }
  function persist(){ try{ localStorage.setItem(KEY, JSON.stringify(edits)); }catch(e){} }
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };

  // current value = edit override if present, else original
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

  var pip = function(n){ return (n|0); };
  function pipsLine(card){
    var b=pip(cur(card,'buyCostEnergy')), e=pip(cur(card,'playCostEnergy')), w=pip(cur(card,'playCostWater')), p=pip(cur(card,'playCostPhosphorus'));
    var play = [];
    if(e) play.push(e+'⚡'); if(w) play.push(w+'💧'); if(p) play.push(p+' P');
    return 'Buy <b>'+b+'⚡</b> · Play '+(play.length?'<b>'+play.join(' </b>+<b> ')+'</b>':'<b>free</b>');
  }

  var TYPES = {};
  CARDS.forEach(function(c){ TYPES[c.type||'—']=1; });
  var typeSel = document.getElementById('typeSel');
  Object.keys(TYPES).sort().forEach(function(t){ var o=document.createElement('option'); o.value=t; o.textContent=t; typeSel.appendChild(o); });
  // Filter controls are referenced by applyFilter(), which refreshCard() calls DURING the
  // render loop below — so grab these refs BEFORE the loop (not after) or the loop throws.
  var search = document.getElementById('search'), onlyChanged = document.getElementById('onlyChanged');

  var grid = document.getElementById('grid');
  var nodes = {};
  CARDS.forEach(function(card){
    var famClass = card.type==='engine' || card.category==='engine' ? 'engine' : (card.type==='event'?'event':'');
    var wrap = document.createElement('section'); wrap.className='card'; wrap.dataset.name=card.name;
    wrap.innerHTML =
      '<div class="chead"><span class="cn">'+esc(card.name)+'</span>'+
        '<span class="badge '+famClass+'">'+esc(card.type||'')+'</span>'+
        (card.category?'<span class="badge">'+esc(card.category)+'</span>':'')+
        '<span class="dot">● edited</span></div>'+
      '<div class="costs">'+
        '<div class="cost"><label>Buy ⚡</label><input type="number" min="0" step="1" data-f="buyCostEnergy"></div>'+
        '<div class="cost e"><label>Play ⚡</label><input type="number" min="0" step="1" data-f="playCostEnergy"></div>'+
        '<div class="cost w"><label>Play 💧</label><input type="number" min="0" step="1" data-f="playCostWater"></div>'+
        '<div class="cost p"><label>Play P</label><input type="number" min="0" step="1" data-f="playCostPhosphorus"></div>'+
      '</div>'+
      '<div class="pips"></div>'+
      '<label class="fl">Description (effect)</label><textarea class="eff" data-f="effect"></textarea>'+
      '<label class="fl">Flavour</label><textarea class="flav" data-f="flavor"></textarea>';
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
    wrap.querySelector('.pips').innerHTML = pipsLine(card);
    applyFilter(card);
  }

  // ---- filtering ---- (search/onlyChanged refs are grabbed above, before the render loop)
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
    var cards=0, fields=0;
    Object.keys(edits).forEach(function(n){ var k=Object.keys(edits[n]); if(k.length){ cards++; fields+=k.length; } });
    document.getElementById('mChanged').textContent = cards;
    document.getElementById('mFields').textContent = fields;
    document.getElementById('btnDownload').disabled = false;
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
console.log('wrote', target, '(' + (html.length / 1024).toFixed(0) + ' KB, ' + cards.length + ' cards)');
