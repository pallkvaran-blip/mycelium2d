// =============================================================================
// LEVEL INTRO — a full-screen BLACK card shown at the start of every campaign
// level, BEFORE the map fades in. It announces "Level N" and the threats waiting
// in this map (ant / nematode / trichoderma), each a square portrait with a white
// glow border (matching the tutorial's) and an ×count. A click ANYWHERE fades the
// overlay out — and because the finished map is already drawn behind it at full
// opacity, that fade IS the map fading in (main.js sets the canvas opaque first).
//
//   showLevelIntro({ level, threats, onDismiss, onDone }) → controller { destroy(), active }
//
// threats: [{ slug, label, count }, ...] — already filtered to count > 0 by the
// caller. `slug` names the art file assets/tutorial/<slug>.jpg (reused from the
// first-run tutorial). `note` is an optional one-line subtitle under the wordmark —
// main.js passes `species.js escalationNote(level)`, which is non-null only on the
// levels where the threat rate steps up.
//
// Two callbacks, and the difference matters visually:
//   onDismiss — fires the instant the player clicks, BEFORE the fade begins, while the
//     screen is still solid black. Anything that changes the HUD's LAYOUT belongs here
//     (main.js re-expands the hand carousel), so it settles unseen and is simply part of
//     the scene the fade reveals. Doing it in onDone instead makes it pop in a beat after
//     the map is already on screen.
//   onDone — fires once the overlay has faded out and been removed. For things that
//     should only start on a visible map (main.js: the deferred first-run tutorial).
// =============================================================================

import { growMyceliumTitle } from './mycelium_title.js';

const VER = (typeof globalThis !== 'undefined' && globalThis.__ASSET_VER) ? '?v=' + globalThis.__ASSET_VER : '';

const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };

// Level number spelled out in words (the wordmark reads "LEVEL ONE", "LEVEL TWO",
// … up to "LEVEL ONE HUNDRED"). Falls back to the numeral outside 1..100.
const LI_ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
const LI_TEENS = ['TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const LI_TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
function levelWord(n) {
  n = n | 0;
  if (n <= 0) return String(n);
  if (n === 100) return 'ONE HUNDRED';
  if (n < 10) return LI_ONES[n];
  if (n < 20) return LI_TEENS[n - 10];
  if (n < 100) { const t = (n / 10) | 0, o = n % 10; return LI_TENS[t] + (o ? ' ' + LI_ONES[o] : ''); }
  return String(n);
}

export function showLevelIntro(opts) {
  const level = (opts && opts.level) || 1;
  const threats = (opts && opts.threats) || [];
  const onDismiss = opts && opts.onDismiss;
  const onDone = opts && opts.onDone;

  const root = el('div'); root.id = 'levelIntro';
  const inner = el('div', 'li-inner');
  // The level title is the procedural mycelium wordmark ("LEVEL ONE", …), grown
  // once when the card appears (mirrors the title screen / high-scores heading).
  // Title + optional escalation subtitle share a `.li-head` wrapper so the subtitle
  // sits TIGHT under the wordmark: `.li-inner`'s gap between sections is large, and
  // `.li-level` is a fixed-size box that growMyceliumTitle measures, so the subtitle
  // can't just live inside it.
  const head = el('div', 'li-head');
  const titleWrap = el('div', 'li-level');
  titleWrap.setAttribute('role', 'img');
  titleWrap.setAttribute('aria-label', 'Level ' + level);
  head.appendChild(titleWrap);
  if (opts && opts.note) head.appendChild(el('div', 'li-sub', String(opts.note)));
  inner.appendChild(head);

  const row = el('div', 'li-threats');
  for (const th of threats) {
    const cell = el('div', 'li-threat');
    const pic = el('div', 'li-pic li-pic--' + th.slug);
    const img = el('img');
    img.src = 'assets/tutorial/' + th.slug + '.jpg' + VER;
    img.alt = th.label || th.slug;
    img.draggable = false;
    img.onerror = () => { pic.classList.add('li-pic--noimg'); };   // keep the count if art is missing
    pic.appendChild(img);
    cell.appendChild(pic);
    cell.appendChild(el('div', 'li-count', '&times;' + th.count));
    row.appendChild(cell);
  }
  inner.appendChild(row);
  inner.appendChild(el('div', 'li-hint', 'Click anywhere to begin'));
  root.appendChild(inner);
  document.body.appendChild(root);

  // Grow the "LEVEL <word>" wordmark now the container is in the DOM and sized.
  let myc = null;
  try { myc = growMyceliumTitle(titleWrap, { word: 'LEVEL ' + levelWord(level) }); } catch (_) {}
  const killMyc = () => { try { myc && myc.destroy(); } catch (_) {} myc = null; };

  let alive = true;
  function unbind() {
    root.removeEventListener('click', dismiss);
    document.removeEventListener('keydown', onKey);
  }
  // User dismiss (click / key): fade the overlay out — the map appears behind it —
  // then remove the node and run onDone (which kicks off any deferred tutorial).
  function dismiss() {
    if (!alive) return;
    alive = false;
    unbind();
    // Let the caller restore its HUD FIRST, while the overlay is still fully opaque, so
    // any layout change lands behind black and the fade reveals a settled screen.
    try { onDismiss && onDismiss(); } catch (_) {}
    root.classList.add('li-out');            // CSS fades opacity 1 -> 0
    let removed = false;
    const finishOut = () => {
      if (removed) return; removed = true;
      killMyc();
      root.remove();
      try { onDone && onDone(); } catch (_) {}
    };
    root.addEventListener('transitionend', (e) => { if (e.target === root && e.propertyName === 'opacity') finishOut(); });
    setTimeout(finishOut, 1700);             // fallback if transitionend never fires
  }
  // Programmatic teardown (a superseding begin()): drop the overlay at once, and
  // DON'T run onDone — that level's deferred tutorial is no longer wanted.
  function destroy() {
    if (!alive && !root.isConnected) return;
    alive = false;
    unbind();
    killMyc();
    root.remove();
  }
  const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') dismiss(); };
  root.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKey);

  // Fade the CONTENT in on the next frame (so it eases up rather than hard-cutting).
  requestAnimationFrame(() => { if (alive) root.classList.add('li-in'); });

  return { destroy, get active() { return alive; } };
}
