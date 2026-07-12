#!/usr/bin/env python3
# Generate docs/card-review.html — a self-contained, offline card-review tool
# covering EVERY card (live + archived). Each card's comment box is pre-filled
# with its current description (effect text) so it's easy to edit in place;
# export bundles up the edits/verdicts to paste back into chat.
#
#   python3 scripts/gen_review_tool.py
#
# Reads docs/cards.json (all cards), the ARCHIVED set from src/engine/cards.js
# (so the archived flag never drifts), and the chosen art in assets/cards/<slug>.jpg
# (downscaled + inlined as base64 so the file works by double-clicking / as an artifact).
import json, re, base64, io
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CARDS = json.loads((ROOT / "docs/cards.json").read_text())
ART = ROOT / "assets/cards"
OUT = ROOT / "docs/card-review.html"
THUMB_W = 400   # inlined thumbnail width (card art shows ~220px; 400 covers retina)

def slug(name):
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", name.lower()))

# --- archived set: pull it straight out of engine/cards.js so it stays in sync ---
def archived_set():
    src = (ROOT / "src/engine/cards.js").read_text()
    m = re.search(r"const ARCHIVED = new Set\(\[(.*?)\]\);", src, re.S)
    if not m:
        return set()
    return set(re.findall(r"'([^']+)'", m.group(1)))

ARCHIVED = archived_set()

# --- category/type -> filter group ---
GROUP_LABEL = {
    "grow": "Grow", "substrate": "Substrate", "digest": "Digest",
    "water": "Water", "mineral": "Mineral", "energy": "Energy",
    "engine": "Engine", "action": "Action", "event": "Event",
    "defense": "Defense", "extender": "Draw", "other": "Other",
}

def group_of(c):
    t = c.get("type")
    if t == "extender": return "extender"
    if t == "engine":   return "engine"
    if t == "action":   return "action"
    if t == "event":    return "event"
    cat = c.get("category", "")
    if cat in ("growth", "utility"): return "grow"
    if cat == "substrate":           return "substrate"
    if cat == "economy":             return "digest"
    if cat == "defense":             return "defense"
    if cat == "water-harvest":       return "water"
    if cat == "phosphorus-mining":   return "mineral"
    return "other"

def pips(c):
    out = []
    if c.get("buyCostEnergy", 0):
        out.append(["e", f"{c['buyCostEnergy']}⚡"])
    w = c.get("playCostWater", 0)
    p = (c.get("playCostPhosphorus", 0) or 0) + (c.get("playCostNitrogen", 0) or 0)
    if w: out.append(["w", f"{w}W"])
    if p: out.append(["p", f"{p}P"])
    return out

def thumb_b64(name):
    fp = ART / f"{slug(name)}.jpg"
    if not fp.exists():
        return ""
    im = Image.open(fp).convert("RGB")
    if im.width > THUMB_W:
        im = im.resize((THUMB_W, round(im.height * THUMB_W / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=80, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

data = []
for c in CARDS:
    g = group_of(c)
    data.append({
        "slug": slug(c["name"]),
        "name": c["name"],
        "type": c.get("type", ""),
        "category": c.get("category", ""),
        "groupKey": g,
        "groupLabel": GROUP_LABEL.get(g, "Other"),
        "pips": pips(c),
        "effect": c.get("effect", ""),
        "flavor": c.get("flavor", ""),
        "tutorial": bool(c.get("tutorial")),
        "startCopies": c.get("startCopies", 0),
        "archived": c["name"] in ARCHIVED,
        "img": thumb_b64(c["name"]),
    })

live = sum(0 if d["archived"] else 1 for d in data)
print(f"{len(data)} cards ({live} live / {len(data)-live} archived) · {len(ARCHIVED)} in ARCHIVED set")

DATA = json.dumps(data, separators=(",", ":"))

HTML = r'''<title>Mycelium — Card Review</title>
<style>
  :root{
    --bg:#05070d; --bg2:#080d16;
    --panel:rgba(16,22,34,0.86); --panel-border:rgba(120,160,140,0.18);
    --ink:#d7e6dc; --ink-dim:#8aa193; --ink-faint:#5f7268;
    --accent:#7fe6a3; --accent-dim:#3a6f50;
    --up:#7fe6a3; --down:#e06a6a; --warn:#e0a85a; --edit:#e0c05a;
    --serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
    --ui:"Segoe UI",system-ui,-apple-system,sans-serif;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;}
  .rv-root{
    min-height:100vh; margin:0; color:var(--ink); font-family:var(--ui);
    background:
      radial-gradient(1200px 600px at 50% -10%, rgba(127,230,163,0.10), transparent 60%),
      radial-gradient(900px 500px at 12% 108%, rgba(70,120,90,0.12), transparent 55%),
      linear-gradient(180deg, var(--bg2), var(--bg) 55%);
    -webkit-font-smoothing:antialiased;
  }
  .rv-wrap{max-width:1220px; margin:0 auto; padding:0 18px 90px;}

  /* ---- header ---- */
  .rv-head{position:sticky; top:0; z-index:40; margin:0 -18px 22px; padding:14px 18px 12px;
    background:linear-gradient(180deg, rgba(6,10,16,0.94), rgba(6,10,16,0.80));
    backdrop-filter:blur(9px); border-bottom:1px solid var(--panel-border);}
  .rv-titlerow{display:flex; align-items:baseline; gap:12px; flex-wrap:wrap;}
  .rv-title{font-family:var(--serif); font-size:23px; font-weight:600; letter-spacing:.01em; margin:0;}
  .rv-title .spore{color:var(--accent);}
  .rv-sub{color:var(--ink-dim); font-size:13px;}
  .rv-tag{color:var(--ink-faint); font-size:12px; margin-left:auto;}

  .rv-metrics{display:flex; gap:16px; flex-wrap:wrap; align-items:center; margin-top:11px;}
  .rv-stat{display:flex; align-items:baseline; gap:6px; font-variant-numeric:tabular-nums;}
  .rv-stat .n{font-size:19px; font-weight:700;}
  .rv-stat .l{font-size:11px; color:var(--ink-dim); text-transform:uppercase; letter-spacing:.09em;}
  .rv-stat.up .n{color:var(--up);} .rv-stat.down .n{color:var(--down);} .rv-stat.edit .n{color:var(--edit);}
  .rv-bar{flex:1 1 160px; min-width:120px; height:7px; border-radius:5px; overflow:hidden;
    background:rgba(255,255,255,0.07); position:relative;}
  .rv-bar .fill{position:absolute; inset:0 auto 0 0; width:0; background:linear-gradient(90deg,var(--accent-dim),var(--accent));
    transition:width .35s ease;}
  .rv-actions{display:flex; gap:8px; flex-wrap:wrap;}
  .rv-btn{font-family:var(--ui); font-size:12.5px; font-weight:600; color:var(--ink);
    background:rgba(255,255,255,0.05); border:1px solid var(--panel-border); border-radius:8px;
    padding:7px 12px; cursor:pointer; transition:border-color .1s, background .1s, color .1s;}
  .rv-btn:hover{border-color:rgba(170,255,205,0.55); background:rgba(127,230,163,0.10);}
  .rv-btn.primary{color:#06110a; background:var(--accent); border-color:var(--accent);}
  .rv-btn.primary:hover{background:#9bf0b8;}
  .rv-btn.ghost{color:var(--ink-dim);}
  .rv-btn.ghost:hover{color:var(--down); border-color:rgba(224,106,106,0.5); background:rgba(224,106,106,0.08);}

  .rv-filters{display:flex; gap:7px; flex-wrap:wrap; margin-top:12px;}
  .fchip{font-family:var(--ui); font-size:12px; font-weight:600; color:var(--ink-dim);
    background:rgba(255,255,255,0.04); border:1px solid var(--panel-border); border-radius:999px;
    padding:5px 11px; cursor:pointer; display:inline-flex; gap:6px; align-items:center; transition:all .1s;}
  .fchip:hover{color:var(--ink); border-color:rgba(170,255,205,0.4);}
  .fchip.on{color:#06110a; background:var(--accent); border-color:var(--accent);}
  .fchip .cnt{font-variant-numeric:tabular-nums; opacity:.7; font-weight:700; font-size:11px;}
  .fchip.on .cnt{opacity:.85;}

  /* ---- grid ---- */
  .rv-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(232px,1fr)); gap:20px; align-items:start;}
  .rv-cell{display:flex; flex-direction:column;}
  .rv-cell.hidden{display:none;}

  /* card face — mirrors the in-game CCG frame */
  .card{position:relative; display:flex; flex-direction:column; align-items:stretch; overflow:hidden;
    background:linear-gradient(158deg,#101a15,#070c0a 72%); border:2px solid rgba(130,230,166,0.5);
    border-radius:14px; color:var(--ink);
    box-shadow:0 0 9px -2px rgba(130,230,166,0.45), inset 0 0 0 1px rgba(130,230,166,0.16), 0 8px 18px -9px rgba(0,0,0,0.75);
    transition:border-color .12s, box-shadow .12s;}
  .rv-cell.up .card{border-color:rgba(127,230,163,0.95);
    box-shadow:0 0 0 2px rgba(127,230,163,0.55), 0 0 18px -3px rgba(127,230,163,0.6), inset 0 0 0 1px rgba(130,230,166,0.2);}
  .rv-cell.down .card{border-color:rgba(224,106,106,0.9);
    box-shadow:0 0 0 2px rgba(224,106,106,0.5), 0 0 18px -4px rgba(224,106,106,0.5), inset 0 0 0 1px rgba(224,106,106,0.18);}
  .rv-cell.arch .card{border-style:dashed; border-color:rgba(150,170,160,0.4); filter:saturate(.72);}
  .cart{position:relative; margin:6px 6px 0; height:150px; overflow:hidden;
    border-radius:10px 10px 30px 30px / 10px 10px 16px 16px;
    background:radial-gradient(circle at 50% 40%,#16241c,#060f0b);
    box-shadow:inset 0 0 0 1px rgba(130,230,166,0.28), inset 0 -14px 20px -12px rgba(4,7,6,0.9);}
  .caimg{width:100%; height:100%; object-fit:cover; display:block;}
  .cart.none{display:flex; align-items:center; justify-content:center; color:var(--ink-faint); font-size:11px;}
  .pips{position:absolute; top:12px; left:12px; z-index:6; display:flex; flex-direction:column; gap:4px;}
  .cc{font-size:10px; font-weight:700; border-radius:5px; padding:1px 5px; align-self:flex-start;}
  .cc.e{color:var(--accent); background:rgba(127,230,163,0.16);}
  .cc.w{color:#7fd0e0; background:rgba(70,184,204,0.18);}
  .cc.p{color:#c79be6; background:rgba(179,128,224,0.18);}
  .cc.free{color:var(--ink-dim); background:rgba(255,255,255,0.07);}
  .badges{position:absolute; top:12px; right:12px; z-index:6; display:flex; flex-direction:column; gap:4px; align-items:flex-end;}
  .badge{font-size:9px; font-weight:700; letter-spacing:.05em; border-radius:6px; padding:2px 6px;}
  .badge.tut{color:#06110a; background:rgba(127,230,163,0.9);}
  .badge.arch{color:#0a0d10; background:rgba(200,210,205,0.85);}
  .cplate{text-align:center; padding:8px 9px 3px;}
  .cplate .cn{font-family:var(--serif); font-size:15px; font-weight:600; line-height:1.12; color:#eaf4ee;
    text-shadow:0 1px 6px rgba(0,0,0,0.6); display:block;}
  .cplate .ct{font-size:8px; color:var(--accent); text-transform:uppercase; letter-spacing:.14em; margin-top:3px; display:block;}
  .crules{margin:4px 8px 4px; padding:7px 9px; border:1px solid rgba(130,230,166,0.16); border-radius:9px;
    background:linear-gradient(180deg,rgba(10,16,13,0.5),rgba(6,10,8,0.68));
    font-size:11px; line-height:1.42; color:#d3e2da;}
  .crules .lbl{display:block; font-size:8px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-faint); margin-bottom:3px;}
  .cflav{margin:0 10px 9px; font-size:10px; line-height:1.4; color:var(--ink-faint); font-style:italic;}

  /* review controls */
  .rv-ctl{margin-top:9px; display:flex; flex-direction:column; gap:8px;}
  .votes{display:flex; gap:8px;}
  .vote{flex:1; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;
    font-family:var(--ui); font-size:14px; font-weight:600; color:var(--ink-dim);
    background:rgba(255,255,255,0.04); border:1px solid var(--panel-border); border-radius:9px; padding:8px 0;
    transition:all .1s;}
  .vote .em{font-size:16px; filter:grayscale(1) opacity(.75);}
  .vote:hover{color:var(--ink); border-color:rgba(170,255,205,0.4);}
  .vote.up.on{color:#06110a; background:var(--up); border-color:var(--up);}
  .vote.down.on{color:#150707; background:var(--down); border-color:var(--down);}
  .vote.on .em{filter:none;}
  .ed-head{display:flex; align-items:center; gap:6px;}
  .ed-lbl{font-size:9px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-faint);}
  .ed-reset{margin-left:auto; font-family:var(--ui); font-size:10px; font-weight:600; color:var(--ink-faint);
    background:none; border:none; cursor:pointer; padding:0;}
  .ed-reset:hover{color:var(--warn);} .ed-reset[disabled]{opacity:.3; cursor:default;}
  .cmt{width:100%; resize:vertical; min-height:80px; font-family:var(--ui); font-size:12.5px; color:var(--ink);
    background:rgba(0,0,0,0.28); border:1px solid var(--panel-border); border-radius:9px; padding:8px 10px; line-height:1.42;}
  .cmt:focus{outline:none; border-color:rgba(170,255,205,0.55); background:rgba(0,0,0,0.4);}
  .cmt::placeholder{color:var(--ink-faint);}
  .cmt.edited{border-color:rgba(224,192,90,0.6); background:rgba(40,32,8,0.28);}

  .rv-empty{grid-column:1/-1; text-align:center; color:var(--ink-dim); padding:60px 0; font-size:14px;}

  /* export modal */
  .rv-modal{position:fixed; inset:0; z-index:80; display:none; align-items:center; justify-content:center;
    background:rgba(4,7,11,0.78); padding:18px;}
  .rv-modal.open{display:flex;}
  .rv-modalbox{background:var(--panel); border:1px solid var(--panel-border); border-radius:16px; padding:18px;
    width:min(760px,100%); max-height:86vh; display:flex; flex-direction:column; gap:12px;
    box-shadow:0 20px 60px rgba(0,0,0,0.6); backdrop-filter:blur(10px);}
  .rv-modalhead{display:flex; align-items:center; gap:10px;}
  .rv-modalhead h2{font-family:var(--serif); font-size:18px; margin:0; font-weight:600;}
  .rv-modalhead .x{margin-left:auto;}
  .rv-out{flex:1; min-height:240px; width:100%; resize:none; font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
    font-size:12px; line-height:1.5; color:var(--ink); background:rgba(0,0,0,0.35);
    border:1px solid var(--panel-border); border-radius:10px; padding:12px;}
  .rv-copied{color:var(--accent); font-size:12.5px; font-weight:600; opacity:0; transition:opacity .2s;}
  .rv-copied.show{opacity:1;}

  @media (max-width:520px){
    .rv-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:14px;}
    .cart{height:118px;}
    .rv-title{font-size:19px;}
    .rv-wrap{padding:0 12px 80px;}
    .rv-head{margin:0 -12px 18px; padding:12px 12px 10px;}
  }
</style>

<div class="rv-root">
<div class="rv-wrap">
  <header class="rv-head">
    <div class="rv-titlerow">
      <h1 class="rv-title"><span class="spore">Mycelium</span> — Card Review</h1>
      <span class="rv-sub">Every card, archived included. Edit the description box to rewrite a card, thumb it, add notes. Export when done.</span>
      <span class="rv-tag" id="rvTag"></span>
    </div>
    <div class="rv-metrics">
      <div class="rv-stat"><span class="n" id="mReviewed">0</span><span class="l">of <span id="mTotal">0</span> reviewed</span></div>
      <div class="rv-stat up"><span class="n" id="mUp">0</span><span class="l">liked</span></div>
      <div class="rv-stat down"><span class="n" id="mDown">0</span><span class="l">disliked</span></div>
      <div class="rv-stat edit"><span class="n" id="mEdit">0</span><span class="l">rewritten</span></div>
      <div class="rv-bar"><div class="fill" id="mBar"></div></div>
      <div class="rv-actions">
        <button class="rv-btn primary" id="btnExport">Export results</button>
        <button class="rv-btn ghost" id="btnReset">Reset all</button>
      </div>
    </div>
    <div class="rv-filters" id="rvFilters"></div>
  </header>

  <main class="rv-grid" id="rvGrid"></main>
</div>
</div>

<div class="rv-modal" id="rvModal">
  <div class="rv-modalbox">
    <div class="rv-modalhead">
      <h2>Review results</h2>
      <span class="rv-copied" id="rvCopied">Copied &check;</span>
      <button class="rv-btn primary" id="btnCopy">Copy</button>
      <button class="rv-btn ghost x" id="btnCloseModal">Close</button>
    </div>
    <textarea class="rv-out" id="rvOut" readonly></textarea>
    <div class="rv-sub" style="font-size:12px">Paste this back into the chat and I'll apply your rewrites and verdicts.</div>
  </div>
</div>

<script>
const CARDS = __DATA__;
const KEY = 'mycelium-card-review-v2';
const GROUPS = ['grow','substrate','digest','water','mineral','energy','engine','action','event','defense','extender','other'];
const GLABEL = {grow:'Grow',substrate:'Substrate',digest:'Digest',water:'Water',mineral:'Mineral',energy:'Energy',engine:'Engine',action:'Action',event:'Event',defense:'Defense',extender:'Draw',other:'Other'};
const CBY = Object.fromEntries(CARDS.map(c=>[c.slug,c]));

let store = load();
let filter = 'all';

function load(){ try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ return {}; } }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(store)); }catch(e){} }
// A record's `desc` defaults to the card's current effect text (so the box starts
// pre-filled and editable); `vote` and `note` start empty.
function rec(slug){
  if(!store[slug]) store[slug] = {vote:null, desc:CBY[slug].effect, note:''};
  if(store[slug].desc==null) store[slug].desc = CBY[slug].effect;
  return store[slug];
}
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function edited(c){ const r=store[c.slug]; return !!(r && (r.desc||'').trim() !== (c.effect||'').trim()); }

function matches(c){
  const r = store[c.slug] || {};
  switch(filter){
    case 'all': return true;
    case 'todo': return !r.vote && !edited(c);
    case 'up': return r.vote==='up';
    case 'down': return r.vote==='down';
    case 'edited': return edited(c);
    case 'archived': return !!c.archived;
    case 'live': return !c.archived;
    default: return c.groupKey===filter;
  }
}

function pipHTML(c){
  if(!c.pips.length) return '<span class="cc free">free</span>';
  return c.pips.map(p=>`<span class="cc ${p[0]}">${esc(p[1])}</span>`).join('');
}

function buildGrid(){
  const grid = document.getElementById('rvGrid');
  grid.innerHTML = '';
  let shown = 0;
  CARDS.forEach(c=>{
    const r = rec(c.slug);
    const cell = document.createElement('div');
    cell.className = 'rv-cell' + (r.vote==='up'?' up':r.vote==='down'?' down':'') + (c.archived?' arch':'');
    if(!matches(c)) cell.classList.add('hidden'); else shown++;
    cell.dataset.slug = c.slug;
    const art = c.img
      ? `<span class="cart"><img class="caimg" src="${c.img}" alt="${esc(c.name)}" loading="lazy"></span>`
      : `<span class="cart none">no art</span>`;
    const badges = (c.tutorial?'<span class="badge tut">TUTORIAL</span>':'') + (c.archived?'<span class="badge arch">ARCHIVED</span>':'');
    cell.innerHTML =
      `<div class="card">
        ${art}
        <span class="pips">${pipHTML(c)}</span>
        <span class="badges">${badges}</span>
        <span class="cplate"><span class="cn">${esc(c.name)}</span><span class="ct">${esc(c.type)} &middot; ${esc(c.groupLabel)}</span></span>
        <span class="crules"><span class="lbl">Current description</span>${esc(c.effect)}</span>
        ${c.flavor?`<span class="cflav">${esc(c.flavor)}</span>`:''}
      </div>
      <div class="rv-ctl">
        <div class="votes">
          <button class="vote up${r.vote==='up'?' on':''}" data-v="up"><span class="em">&#128077;</span>Like</button>
          <button class="vote down${r.vote==='down'?' on':''}" data-v="down"><span class="em">&#128078;</span>Nope</button>
        </div>
        <div class="ed-head">
          <span class="ed-lbl">Description &mdash; edit to rewrite</span>
          <button class="ed-reset" data-r="1"${edited(c)?'':' disabled'}>&#8634; reset</button>
        </div>
        <textarea class="cmt desc${edited(c)?' edited':''}" data-k="desc">${esc(r.desc||'')}</textarea>
        <textarea class="cmt note${r.note&&r.note.trim()?' edited':''}" data-k="note" placeholder="Extra notes (optional)&hellip;">${esc(r.note||'')}</textarea>
      </div>`;
    // votes
    cell.querySelectorAll('.vote').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const v = btn.dataset.v, rr = rec(c.slug);
        rr.vote = (rr.vote===v) ? null : v;
        save();
        cell.classList.toggle('up', rr.vote==='up');
        cell.classList.toggle('down', rr.vote==='down');
        cell.querySelectorAll('.vote').forEach(b=>b.classList.toggle('on', b.dataset.v===rr.vote));
        refreshMetrics();
        if(filter!=='all' && !GROUPS.includes(filter) && filter!=='archived' && filter!=='live') applyFilter();
      });
    });
    // description + note
    cell.querySelectorAll('.cmt').forEach(ta=>{
      ta.addEventListener('input', ()=>{
        const rr = rec(c.slug), k = ta.dataset.k;
        rr[k] = ta.value; save();
        if(k==='desc'){
          const isEd = edited(c);
          ta.classList.toggle('edited', isEd);
          cell.querySelector('.ed-reset').disabled = !isEd;
        } else {
          ta.classList.toggle('edited', !!ta.value.trim());
        }
        refreshMetrics();
      });
    });
    // reset description to the card's original effect
    cell.querySelector('.ed-reset').addEventListener('click', ()=>{
      const rr = rec(c.slug); rr.desc = c.effect; save();
      const ta = cell.querySelector('.cmt.desc');
      ta.value = c.effect; ta.classList.remove('edited');
      cell.querySelector('.ed-reset').disabled = true;
      refreshMetrics();
    });
    grid.appendChild(cell);
  });
  ensureEmpty(shown);
}

let emptyEl=null;
function ensureEmpty(shown){
  const grid=document.getElementById('rvGrid');
  if(!emptyEl){ emptyEl=document.createElement('div'); emptyEl.className='rv-empty'; }
  if(shown===0){ emptyEl.textContent='No cards match this filter.'; grid.appendChild(emptyEl); }
  else if(emptyEl.parentNode){ emptyEl.remove(); }
}

function applyFilter(){
  let shown=0;
  document.querySelectorAll('.rv-cell').forEach(cell=>{
    const c = CBY[cell.dataset.slug];
    const m = matches(c);
    cell.classList.toggle('hidden', !m);
    if(m) shown++;
  });
  ensureEmpty(shown);
}

function counts(){
  let up=0,down=0,ed=0,rev=0;
  CARDS.forEach(c=>{ const r=store[c.slug]; const e=edited(c);
    if(r&&r.vote==='up')up++; if(r&&r.vote==='down')down++;
    if(e)ed++; if((r&&r.vote)||e)rev++; });
  return {up,down,ed,rev};
}
function refreshMetrics(){
  const t=CARDS.length, k=counts();
  document.getElementById('mReviewed').textContent=k.rev;
  document.getElementById('mTotal').textContent=t;
  document.getElementById('mUp').textContent=k.up;
  document.getElementById('mDown').textContent=k.down;
  document.getElementById('mEdit').textContent=k.ed;
  document.getElementById('mBar').style.width=(t?Math.round(k.rev/t*100):0)+'%';
  const arch=CARDS.filter(c=>c.archived).length;
  document.getElementById('rvTag').textContent=`${t} cards (${t-arch} live · ${arch} archived) · saved locally`;
  buildFilters();
}

function filterDefs(){
  const inGroup = g => CARDS.filter(c=>c.groupKey===g).length;
  const k=counts();
  const base = [
    ['all','All', CARDS.length],
    ['live','Live', CARDS.filter(c=>!c.archived).length],
    ['archived','Archived', CARDS.filter(c=>c.archived).length],
    ['todo','Untouched', CARDS.filter(c=>!(store[c.slug]&&store[c.slug].vote)&&!edited(c)).length],
    ['edited','✏️ Rewritten', k.ed],
    ['up','👍 Liked', k.up],
    ['down','👎 Disliked', k.down],
  ];
  const groups = GROUPS.filter(g=>inGroup(g)>0).map(g=>[g, GLABEL[g], inGroup(g)]);
  return base.concat(groups);
}
function buildFilters(){
  const el=document.getElementById('rvFilters');
  el.innerHTML='';
  filterDefs().forEach(([k,label,n])=>{
    const b=document.createElement('button');
    b.className='fchip'+(filter===k?' on':'');
    b.innerHTML=`${esc(label)}<span class="cnt">${n}</span>`;
    b.addEventListener('click', ()=>{ filter=k; buildFilters(); applyFilter(); });
    el.appendChild(b);
  });
}

function oneLine(s){ return String(s||'').trim().replace(/\s+/g,' '); }
function exportText(){
  const k=counts(), t=CARDS.length;
  const L=[];
  L.push(`# Mycelium — Card Review`);
  L.push(`${k.rev}/${t} cards touched · ✏️ ${k.ed} rewritten · 👍 ${k.up} liked · 👎 ${k.down} disliked`);
  L.push('');
  const rewrites = CARDS.filter(c=>edited(c));
  if(rewrites.length){
    L.push(`## ✏️ Rewritten descriptions (${rewrites.length})`);
    L.push('');
    rewrites.forEach(c=>{
      const r=store[c.slug]||{};
      const vote = r.vote==='up'?' 👍':r.vote==='down'?' 👎':'';
      L.push(`### ${c.name}${c.archived?' [ARCHIVED]':''} — ${c.type} · ${c.groupLabel}${vote}`);
      L.push(`OLD: ${oneLine(c.effect)}`);
      L.push(`NEW: ${oneLine(r.desc)}`);
      if(r.note&&r.note.trim()) L.push(`NOTE: ${oneLine(r.note)}`);
      L.push('');
    });
  }
  const noteOnly = CARDS.filter(c=>!edited(c) && (store[c.slug]||{}).note && store[c.slug].note.trim());
  const voteLine = c => {
    const r=store[c.slug]||{};
    const note = (r.note&&r.note.trim()) ? ` — ${oneLine(r.note)}` : '';
    return `- ${c.name}${c.archived?' [archived]':''}${note}`;
  };
  const down = CARDS.filter(c=>(store[c.slug]||{}).vote==='down');
  const up   = CARDS.filter(c=>(store[c.slug]||{}).vote==='up' && !edited(c));
  if(down.length){ L.push(`## 👎 Disliked (${down.length})`); down.forEach(c=>L.push(voteLine(c))); L.push(''); }
  if(up.length){ L.push(`## 👍 Liked, description unchanged (${up.length})`); up.forEach(c=>L.push(voteLine(c))); L.push(''); }
  if(noteOnly.length){ L.push(`## 💬 Notes, no rewrite (${noteOnly.length})`); noteOnly.forEach(c=>L.push(voteLine(c))); L.push(''); }
  const untouched = CARDS.filter(c=>{const r=store[c.slug]||{}; return !r.vote && !edited(c) && !(r.note&&r.note.trim());});
  if(untouched.length){ L.push(`## Not reviewed (${untouched.length})`); L.push(untouched.map(c=>c.name+(c.archived?' [archived]':'')).join(', ')); }
  return L.join('\n');
}

// modal
const modal=document.getElementById('rvModal');
document.getElementById('btnExport').addEventListener('click', ()=>{
  document.getElementById('rvOut').value = exportText();
  modal.classList.add('open');
});
document.getElementById('btnCloseModal').addEventListener('click', ()=>modal.classList.remove('open'));
modal.addEventListener('click', e=>{ if(e.target===modal) modal.classList.remove('open'); });
document.getElementById('btnCopy').addEventListener('click', ()=>{
  const out=document.getElementById('rvOut'); out.select();
  const done=()=>{ const c=document.getElementById('rvCopied'); c.classList.add('show'); setTimeout(()=>c.classList.remove('show'),1400); };
  if(navigator.clipboard){ navigator.clipboard.writeText(out.value).then(done, ()=>{document.execCommand('copy');done();}); }
  else { document.execCommand('copy'); done(); }
});
document.getElementById('btnReset').addEventListener('click', ()=>{
  if(confirm('Clear every vote, rewrite and note? This restores all descriptions to their originals and cannot be undone.')){
    store={}; save(); buildGrid(); refreshMetrics();
  }
});

buildGrid();
refreshMetrics();
</script>
'''

HTML = HTML.replace("__DATA__", DATA)
OUT.write_text(HTML)
print(f"wrote {OUT.relative_to(ROOT)} ({round(len(HTML)/1024)} KB)")
