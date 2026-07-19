// Generate a self-contained "new grow-card review" tool: for each of the 9 new grow cards,
// pick one of its ART OPTIONS, edit its costs + description, and leave a comment — then copy a
// summary to paste back to Claude. Emits ARTIFACT-BODY html (style + markup + script only; no
// <!doctype>/<html>/<head>/<body>) so it can be published straight as an Artifact.
//   node scripts/gen_newcards_review.mjs [out.html]
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'docs', 'newcards-review.html');
// NC_CARDS = comma-separated card names (default: all 9). NC_WHITE=1 shows the "-w<n>" redo
// options (white / less-stylized batch) instead of the original "-<n>" options.
const NEW = process.env.NC_CARDS
  ? process.env.NC_CARDS.split(',').map((s) => s.trim()).filter(Boolean)
  : ['Guerrilla Runners', 'Turgor Thrust', 'Vesicle Surge', 'Translocation Cord',
     'Explorer Cord', 'Turgor Line', 'Vesicle Supply Line', 'Bulk-Flow Cord', 'Rhizomorph Cable'];
const WHITE = !!process.env.NC_WHITE;

const all = JSON.parse(readFileSync(join(ROOT, 'docs', 'cards.json'), 'utf8'));
const cards = NEW.map((n) => all.find((c) => c.name === n)).filter(Boolean);
const slugOf = (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Inline each card's ART OPTIONS (assets/card_options/<slug>-N.jpg), sorted, as data URIs.
const OPTDIR = join(ROOT, 'assets', 'card_options');
const opts = {};
for (const c of cards) {
  const slug = slugOf(c.name);
  const re = WHITE ? new RegExp('^' + slug + '-w\\d+\\.jpg$') : new RegExp('^' + slug + '-\\d+\\.jpg$');
  const numOf = (f) => +f.match(/-w?(\d+)\.jpg$/)[1];
  const files = existsSync(OPTDIR)
    ? readdirSync(OPTDIR).filter((f) => re.test(f)).sort((a, b) => numOf(a) - numOf(b))
    : [];
  opts[c.name] = files.map((f) => ({
    n: numOf(f), file: f,
    uri: 'data:image/jpeg;base64,' + readFileSync(join(OPTDIR, f)).toString('base64'),
  }));
}

const esc = (s) => String(s == null ? '' : s).replace(/<\//g, '<\\/');
const dataJson = JSON.stringify(cards.map((c) => ({
  name: c.name, type: c.type, displayCategory: c.displayCategory || c.type, category: c.category || '',
  buyCostEnergy: c.buyCostEnergy || 0, buyCostPhosphorus: c.buyCostPhosphorus || 0,
  playCostEnergy: c.playCostEnergy || 0, playCostWater: c.playCostWater || 0, playCostPhosphorus: c.playCostPhosphorus || 0,
  effect: c.effect || '', flavor: c.flavor || '',
}))).replace(/<\//g, '<\\/');
const artJson = JSON.stringify(opts).replace(/<\//g, '<\\/');

const css = `
:root{ color-scheme:dark;
  --bg:#08110d; --bg2:#050b08; --panel:#0e1a15; --panel2:#0a1410; --line:rgba(126,240,192,.16);
  --ink:#e6f4ec; --dim:#8fb3a4; --mint:#7ef0c0; --amber:#ffd76a; --water:#6cc7ff; --phos:#c79bff; --edit:#ffd76a;
  --sans:"Segoe UI",Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace; --accent:#7fe6a3; --fink:#d7e6dc; --fdim:#8aa193;
  --fserif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif; }
*{box-sizing:border-box}
html,body{margin:0;max-width:100%;overflow-x:hidden}
body{color:var(--ink);font-family:var(--sans);line-height:1.5;
  background:radial-gradient(1100px 480px at 22% -10%,rgba(126,240,192,.07),transparent 60%),
    radial-gradient(900px 480px at 92% 2%,rgba(108,199,255,.05),transparent 55%),linear-gradient(180deg,var(--bg),var(--bg2));min-height:100vh}
.wrap{max-width:1180px;margin:0 auto;padding:26px 18px 132px}
.eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--mint);font-weight:700;margin:0 0 7px}
h1{font-size:27px;line-height:1.1;margin:0 0 9px;font-weight:800;letter-spacing:-.01em;text-wrap:balance}
.lede{color:var(--dim);font-size:14px;max-width:74ch;margin:0 0 2px}
.lede b{color:var(--ink)}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:18px}
@media(max-width:820px){.grid{grid-template-columns:1fr}}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:15px;min-width:0;
  box-shadow:0 16px 44px -30px rgba(0,0,0,.75)}
.card.touched{border-color:rgba(255,215,106,.5)}
.crow{display:flex;gap:15px;align-items:flex-start;flex-wrap:wrap}
.left{flex:0 0 auto;display:flex;flex-direction:column;gap:9px}
.right{flex:1 1 230px;min-width:0}
.chead{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin:0 0 4px}
.cn2{font-size:16px;font-weight:800;letter-spacing:-.01em}
.badge{font-size:9px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;padding:3px 7px;border-radius:999px;
  background:var(--panel2);border:1px solid var(--line);color:var(--dim)}
.badge.engine{color:#2b1805;background:var(--amber);border-color:transparent}

/* real in-game card face */
.facewrap .cardbtn{position:relative;display:flex;flex-direction:column;align-items:stretch;aspect-ratio:5/7;width:172px;
  --cacc:130,230,166;--cink:#7fe6a3;padding:0;overflow:hidden;background:linear-gradient(158deg,#101a15,#070c0a 72%);
  border:2px solid rgba(var(--cacc),0.5);border-radius:14px;color:var(--fink);text-align:left;
  box-shadow:0 0 9px -2px rgba(var(--cacc),0.45),inset 0 0 0 1px rgba(var(--cacc),0.16),0 8px 18px -9px rgba(0,0,0,0.75)}
.facewrap .cardbtn.cat-engine{--cacc:226,118,108;--cink:#e58a7e}
.facewrap .cart{position:relative;margin:6px 6px 0;aspect-ratio:3/2;flex:0 0 auto;overflow:hidden;
  border-radius:10px 10px 30px 30px / 10px 10px 16px 16px;background:radial-gradient(circle at 50% 40%,#16241c,#060f0b);
  box-shadow:inset 0 0 0 1px rgba(var(--cacc),0.28),inset 0 -14px 20px -12px rgba(4,7,6,0.9)}
.facewrap .caimg{width:100%;height:100%;object-fit:cover;display:block}
.facewrap .pips{position:absolute;top:10px;left:10px;z-index:6;display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.facewrap .cplate{text-align:center;padding:5px 9px 2px;flex:0 0 auto}
.facewrap .cplate .cn{font-family:var(--fserif);font-size:14px;font-weight:600;line-height:1.1;color:#eaf4ee;text-shadow:0 1px 6px rgba(0,0,0,.6);display:block}
.facewrap .cplate .ct{font-size:8px;color:var(--cink);text-transform:uppercase;letter-spacing:.14em;margin-top:2px;display:block}
.facewrap .crules{margin:2px 7px 8px;padding:5px 8px;flex:1 1 auto;min-height:0;overflow:hidden;display:flex;align-items:flex-start;
  border:1px solid rgba(var(--cacc),0.16);border-radius:9px;background:linear-gradient(180deg,rgba(10,16,13,.5),rgba(6,10,8,.68));font-size:10px;line-height:1.3;color:#d3e2da}
.facewrap .cc{display:inline-flex;align-items:center;gap:1px;font-size:10px;font-weight:700;border-radius:5px;padding:1px 5px}
.facewrap .cc.e{color:var(--accent);background:rgba(127,230,163,.14)}
.facewrap .cc.w{color:#7fd0e0;background:rgba(70,184,204,.15)}
.facewrap .cc.p{color:#c79be6;background:rgba(179,128,224,.15)}
.facewrap .cc.free{color:var(--fdim);background:rgba(255,255,255,.06)}
.facewrap .ri{display:inline-block;width:1em;height:1em;flex:0 0 auto;vertical-align:-0.14em}

/* art option thumbnails */
.optlabel{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin:2px 0 0}
.thumbs{display:flex;gap:7px;flex-wrap:wrap}
.thumb{position:relative;width:52px;aspect-ratio:3/2;border-radius:7px;overflow:hidden;cursor:pointer;padding:0;
  border:2px solid transparent;background:#0a1410;box-shadow:inset 0 0 0 1px var(--line)}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.thumb .num{position:absolute;top:2px;left:3px;font-size:9px;font-weight:800;color:#eaf4ee;text-shadow:0 1px 3px #000}
.thumb.sel{border-color:var(--mint);box-shadow:0 0 0 2px rgba(126,240,192,.35)}
.thumb:focus-visible{outline:2px solid var(--mint);outline-offset:2px}

/* costs + text */
.costs{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:12px 0 4px}
.cost{display:flex;flex-direction:column;gap:3px}
.cost label{font-size:9.5px;font-weight:700;letter-spacing:.03em;color:var(--dim);text-transform:uppercase}
.cost input{width:100%;min-width:0;font:inherit;font-size:15px;font-weight:700;text-align:center;border-radius:8px;padding:7px 3px;
  background:var(--panel2);border:1px solid var(--line);color:var(--ink)}
.cost input:focus{outline:none;border-color:var(--mint)}
.cost input.diff{border-color:var(--edit);color:var(--edit)}
.cost.p label{color:var(--phos)} .cost.w label{color:var(--water)} .cost.e label{color:var(--mint)}
.hint{font-size:10px;color:var(--dim);margin:1px 0 8px}
.fl{display:block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin:9px 0 4px}
textarea{width:100%;font:inherit;font-size:13px;line-height:1.4;border-radius:9px;padding:8px 10px;background:var(--panel2);border:1px solid var(--line);color:var(--ink);resize:vertical}
textarea:focus{outline:none;border-color:var(--mint)}
textarea.eff{min-height:48px} textarea.flav{min-height:38px;color:var(--dim);font-style:italic}
textarea.diff{border-color:var(--edit)}
textarea.comment{min-height:42px;border-style:dashed;border-color:rgba(108,199,255,.42);color:#cfe6f5}
textarea.comment:focus{border-style:solid;border-color:var(--water)}
textarea.comment.has{border-style:solid;border-color:var(--water);background:rgba(108,199,255,.06)}
.fldim{font-weight:600;letter-spacing:0;text-transform:none;color:var(--dim);opacity:.8;font-size:9.5px}

.bar{position:fixed;left:0;right:0;bottom:0;z-index:40;background:var(--panel);border-top:1px solid var(--line);
  padding:12px 18px;backdrop-filter:blur(6px);box-shadow:0 -10px 30px -22px rgba(0,0,0,.85)}
.barin{max-width:1180px;margin:0 auto;display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.metric{font-size:12.5px;color:var(--dim)} .metric b{color:var(--edit)} .metric .sep{opacity:.4;margin:0 5px}
.btn{font:inherit;font-weight:700;font-size:13px;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;color:#06120c;background:linear-gradient(180deg,#9bf0c0,#57cf94)}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--ink)} .btn.ghost:hover{border-color:var(--mint)}
.btn:focus-visible{outline:2px solid var(--mint);outline-offset:2px}
.modal{position:fixed;inset:0;z-index:60;background:rgba(3,7,5,.72);display:none;align-items:center;justify-content:center;padding:20px}
.modal.on{display:flex}
.mbox{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;max-width:700px;width:100%}
.mbox h2{margin:0 0 3px;font-size:17px} .mbox p{margin:0 0 10px;color:var(--dim);font-size:12.5px}
.mbox textarea{height:340px;font-family:var(--mono);font-size:12.5px;line-height:1.5}
.mrow{display:flex;gap:10px;justify-content:flex-end;margin-top:11px}
.toast{position:fixed;left:50%;bottom:82px;transform:translateX(-50%);z-index:70;background:var(--mint);color:#06120c;font-weight:700;font-size:13px;padding:9px 17px;border-radius:999px;opacity:0;transition:.2s;pointer-events:none}
.toast.on{opacity:1}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

const body = `<div class="wrap">
  <p class="eyebrow">Mycelium · new grow cards${WHITE ? ' · white redo' : ''}</p>
  <h1>${WHITE ? 'Pick the white art' : 'Pick the art, tune the costs'}</h1>
  <p class="lede">${WHITE
    ? `Fresh <b>white / less-stylized</b> options for the ${cards.length} cards you didn't like — 4 each. `
    : `The ${cards.length} new grow cards, each on its <b>real card face</b>. `}For every card:
  <b>pick your favourite art</b> (click a thumbnail — the face updates), <b>adjust any cost</b>, tweak the
  <b>description</b>, and leave a <b>comment</b> for anything else. Then hit <b>Copy for Claude</b> and paste it
  back. Everything saves in this browser.</p>
  <div class="grid" id="grid"></div>
</div>
<div class="bar"><div class="barin">
  <span class="metric"><b id="mArt">0</b>/${cards.length} art picked<span class="sep">·</span><b id="mEdits">0</b> cost/text edits<span class="sep">·</span><b id="mComments">0</b> comments</span>
  <span style="flex:1"></span>
  <button class="btn ghost" id="btnReset" type="button">Reset all</button>
  <button class="btn ghost" id="btnDownload" type="button">Download .md</button>
  <button class="btn" id="btnCopy" type="button">Copy for Claude</button>
</div></div>
<div class="modal" id="modal"><div class="mbox">
  <h2>Your picks &amp; edits</h2>
  <p>This is what gets copied — paste it straight into the chat.</p>
  <textarea id="out" readonly></textarea>
  <div class="mrow"><button class="btn ghost" id="mClose" type="button">Close</button><button class="btn" id="mCopy" type="button">Copy</button></div>
</div></div>
<div class="toast" id="toast">Copied</div>
<script type="application/json" id="cardData">${dataJson}</script>
<script type="application/json" id="cardArt">${artJson}</script>
<script>
(function(){
  var CARDS=JSON.parse(document.getElementById('cardData').textContent);
  var ART=JSON.parse(document.getElementById('cardArt').textContent);
  var COST_FIELDS=['buyCostEnergy','buyCostPhosphorus','playCostEnergy','playCostWater','playCostPhosphorus'];
  var TEXT_FIELDS=['effect','flavor'];
  var KEY='mycelium-newcards-v1';
  var st={}; try{ st=JSON.parse(localStorage.getItem(KEY))||{}; }catch(e){ st={}; }
  function get(name){ return st[name]||(st[name]={art:(ART[name]&&ART[name][0]?ART[name][0].n:0),edits:{},comment:''}); }
  function save(){ try{ localStorage.setItem(KEY,JSON.stringify(st)); }catch(e){} }
  var esc=function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  var pip=function(n){ return (n|0); };
  var RES={ e:'<svg class="ri" viewBox="0 0 24 24"><path d="M13.5 2 4 13.5h6L9 22l9.5-11.5h-6L13.5 2Z" fill="#f4c22e"/></svg>',
    w:'<svg class="ri" viewBox="0 0 24 24"><path d="M12 2.5C12 2.5 5.5 10 5.5 14.5a6.5 6.5 0 1 0 13 0C18.5 10 12 2.5 12 2.5Z" fill="#7fd0e0"/></svg>',
    p:'<svg class="ri" viewBox="0 0 24 24"><path d="M12 1.5c1 6.2 4.3 9.5 10.5 10.5C16.3 13 13 16.3 12 22.5 11 16.3 7.7 13 1.5 12 7.7 11 11 7.7 12 1.5Z" fill="#c79be6"/></svg>' };
  function cur(card,f){ var e=st[card.name]&&st[card.name].edits; return (e&&e[f]!==undefined)?e[f]:card[f]; }
  function isDiff(card,f){ var v=cur(card,f),o=card[f]; return COST_FIELDS.indexOf(f)>=0?((v|0)!==(o|0)):(String(v==null?'':v)!==String(o==null?'':o)); }
  function setEdit(card,f,val){ var s=get(card.name); var o=card[f];
    var same=COST_FIELDS.indexOf(f)>=0?((val|0)===(o|0)):(String(val==null?'':val)===String(o==null?'':o));
    if(same) delete s.edits[f]; else s.edits[f]=val; save(); }
  function artUri(name){ var s=get(name); var list=ART[name]||[]; for(var i=0;i<list.length;i++) if(list[i].n===s.art) return list[i].uri; return list[0]?list[0].uri:''; }
  function faceCat(card){ var dc=card.displayCategory||card.type; return dc==='engine'?'cat-engine':'cat-basic'; }
  function pipHTML(card){ var g=[]; var be=pip(cur(card,'buyCostEnergy')); if(be)g.push('<span class="cc e">'+be+RES.e+'</span>');
    var bp=pip(cur(card,'buyCostPhosphorus')); if(bp)g.push('<span class="cc p">'+bp+RES.p+'</span>');
    if(card.type!=='action'){ var w=pip(cur(card,'playCostWater')); if(w)g.push('<span class="cc w">'+w+RES.w+'</span>');
      var p=pip(cur(card,'playCostPhosphorus')); if(p)g.push('<span class="cc p">'+p+RES.p+'</span>'); }
    return g.join('')||'<span class="cc free">free</span>'; }
  function faceHTML(card){ var uri=artUri(card.name);
    return '<div class="cardbtn '+faceCat(card)+'"><span class="cart">'+(uri?'<img class="caimg" src="'+uri+'" alt="">':'')+'</span>'+
      '<span class="pips">'+pipHTML(card)+'</span>'+
      '<span class="cplate"><span class="cn">'+esc(card.name)+'</span><span class="ct">'+esc(card.displayCategory||card.type)+'</span></span>'+
      '<span class="crules">'+esc(cur(card,'effect'))+'</span></div>'; }

  var grid=document.getElementById('grid'); var nodes={};
  CARDS.forEach(function(card){
    var isEng=(card.displayCategory||card.type)==='engine';
    var thumbs=(ART[card.name]||[]).map(function(o){ var s=get(card.name);
      return '<button type="button" class="thumb'+(s.art===o.n?' sel':'')+'" data-n="'+o.n+'"><img src="'+o.uri+'" alt=""><span class="num">'+o.n+'</span></button>'; }).join('');
    var sec=document.createElement('section'); sec.className='card'; sec.dataset.name=card.name;
    sec.innerHTML=
      '<div class="crow">'+
        '<div class="left"><div class="facewrap">'+faceHTML(card)+'</div>'+
          '<div class="optlabel">Art — pick one</div><div class="thumbs">'+thumbs+'</div></div>'+
        '<div class="right">'+
          '<div class="chead"><span class="cn2">'+esc(card.name)+'</span><span class="badge'+(isEng?' engine':'')+'">'+esc(card.displayCategory||card.type)+'</span></div>'+
          '<div class="costs">'+
            '<div class="cost e"><label>Buy ⚡</label><input type="number" min="0" step="1" data-f="buyCostEnergy"></div>'+
            '<div class="cost p"><label>Buy P</label><input type="number" min="0" step="1" data-f="buyCostPhosphorus"></div>'+
            '<div class="cost e"><label>Play ⚡</label><input type="number" min="0" step="1" data-f="playCostEnergy"></div>'+
            '<div class="cost w"><label>Play 💧</label><input type="number" min="0" step="1" data-f="playCostWater"></div>'+
            '<div class="cost p"><label>Play P</label><input type="number" min="0" step="1" data-f="playCostPhosphorus"></div>'+
          '</div>'+
          '<div class="hint">'+(card.type==='action'?'Engine: play 💧/P is the per-use cost (paid each activation), not shown on the face.':'Face shows buy ⚡ + buy P + play 💧/P.')+'</div>'+
          '<label class="fl">Description</label><textarea class="eff" data-f="effect"></textarea>'+
          '<label class="fl">Flavour</label><textarea class="flav" data-f="flavor"></textarea>'+
          '<label class="fl">Comment <span class="fldim">— anything beyond art/cost/text (mechanic, name…)</span></label>'+
          '<textarea class="comment" data-comment="1" placeholder="e.g. rename to X; make it 6 steps; too strong for the cost…"></textarea>'+
        '</div>'+
      '</div>';
    grid.appendChild(sec); nodes[card.name]=sec;
    sec.querySelectorAll('input[data-f]').forEach(function(inp){ var f=inp.dataset.f; inp.value=pip(cur(card,f));
      inp.addEventListener('input',function(){ var v=inp.value===''?0:parseInt(inp.value,10); if(isNaN(v)||v<0)v=0; setEdit(card,f,v); refresh(card); metrics(); }); });
    sec.querySelectorAll('textarea[data-f]').forEach(function(ta){ var f=ta.dataset.f; ta.value=cur(card,f)||'';
      ta.addEventListener('input',function(){ setEdit(card,f,ta.value); refresh(card); metrics(); }); });
    var cta=sec.querySelector('textarea[data-comment]'); cta.value=get(card.name).comment||'';
    cta.addEventListener('input',function(){ get(card.name).comment=cta.value; save(); refresh(card); metrics(); });
    sec.querySelectorAll('.thumb').forEach(function(t){ t.addEventListener('click',function(){ get(card.name).art=+t.dataset.n; save(); refresh(card); metrics(); }); });
    refresh(card);
  });

  function refresh(card){ var sec=nodes[card.name];
    sec.querySelector('.facewrap').innerHTML=faceHTML(card);
    sec.querySelectorAll('input[data-f]').forEach(function(inp){ inp.classList.toggle('diff',isDiff(card,inp.dataset.f)); });
    sec.querySelectorAll('textarea[data-f]').forEach(function(ta){ ta.classList.toggle('diff',isDiff(card,ta.dataset.f)); });
    var cta=sec.querySelector('textarea[data-comment]'); cta.classList.toggle('has',!!(cta.value&&cta.value.trim()));
    sec.querySelectorAll('.thumb').forEach(function(t){ t.classList.toggle('sel',+t.dataset.n===get(card.name).art); });
    var edited=COST_FIELDS.concat(TEXT_FIELDS).some(function(f){return isDiff(card,f);})||!!(get(card.name).comment&&get(card.name).comment.trim());
    sec.classList.toggle('touched',edited);
  }

  function metrics(){ var art=0,ed=0,cm=0;
    CARDS.forEach(function(card){ var s=st[card.name]; if(s&&s.art)art++;
      if(s&&s.edits&&Object.keys(s.edits).length)ed+=Object.keys(s.edits).length;
      if(s&&s.comment&&s.comment.trim())cm++; });
    document.getElementById('mArt').textContent=art;
    document.getElementById('mEdits').textContent=ed;
    document.getElementById('mComments').textContent=cm; }
  metrics();

  function build(){ var L=['# Mycelium — new grow cards: art picks + edits',''];
    CARDS.forEach(function(card){ var s=get(card.name); var opt=(ART[card.name]||[]).find(function(o){return o.n===s.art;});
      var edits=s.edits||{}, ekeys=COST_FIELDS.concat(TEXT_FIELDS).filter(function(f){return isDiff(card,f);});
      var cm=s.comment&&s.comment.trim();
      L.push('## '+card.name);
      L.push('- Art: option '+s.art+(opt?' ('+opt.file+')':''));
      COST_FIELDS.forEach(function(f){ if(isDiff(card,f)) L.push('- '+f+': '+(card[f]|0)+' -> '+(cur(card,f)|0)); });
      TEXT_FIELDS.forEach(function(f){ if(isDiff(card,f)){ L.push('- '+f+':'); L.push('    FROM: '+(card[f]||'')); L.push('    TO:   '+(cur(card,f)||'')); } });
      if(cm) L.push('- COMMENT: '+cm);
      L.push('');
    });
    return L.join('\\n'); }

  var toast=document.getElementById('toast');
  function ping(m){ toast.textContent=m||'Copied'; toast.classList.add('on'); setTimeout(function(){toast.classList.remove('on');},1400); }
  function copy(t,m){ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(function(){ping(m);},function(){ping(m);}); }
    else{ var x=document.createElement('textarea'); x.value=t; document.body.appendChild(x); x.select(); try{document.execCommand('copy');}catch(e){} x.remove(); ping(m); } }

  var modal=document.getElementById('modal');
  document.getElementById('btnCopy').addEventListener('click',function(){ document.getElementById('out').value=build(); modal.classList.add('on'); copy(build(),'Copied — paste it to Claude'); });
  document.getElementById('mCopy').addEventListener('click',function(){ copy(document.getElementById('out').value,'Copied'); });
  document.getElementById('mClose').addEventListener('click',function(){ modal.classList.remove('on'); });
  modal.addEventListener('click',function(e){ if(e.target===modal) modal.classList.remove('on'); });
  document.getElementById('btnDownload').addEventListener('click',function(){ var b=new Blob([build()],{type:'text/markdown'}); var u=URL.createObjectURL(b);
    var a=document.createElement('a'); a.href=u; a.download='new-grow-cards.md'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(u);},4000); ping('Downloaded .md'); });
  document.getElementById('btnReset').addEventListener('click',function(){ if(!confirm('Discard every art pick, cost edit and comment?'))return;
    st={}; save(); CARDS.forEach(function(card){ var sec=nodes[card.name];
      sec.querySelectorAll('input[data-f]').forEach(function(inp){ inp.value=pip(card[inp.dataset.f]); });
      sec.querySelectorAll('textarea[data-f]').forEach(function(ta){ ta.value=card[ta.dataset.f]||''; });
      sec.querySelector('textarea[data-comment]').value=''; refresh(card); }); metrics(); ping('Reset'); });
})();
</script>`;

const html = css.replace(/^/, '<style>').replace(/$/, '</style>\n') + body + '\n';
writeFileSync(OUT, html);
const kb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
console.log('wrote', OUT, '(' + kb + ' MB, ' + cards.length + ' cards, ' +
  Object.values(opts).reduce((n, a) => n + a.length, 0) + ' art options inlined)');
