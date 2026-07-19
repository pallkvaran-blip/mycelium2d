// =============================================================================
// LEVEL INTRO — a full-screen BLACK card shown at the start of every campaign
// level, BEFORE the map fades in. It announces "Level N" and the threats waiting
// in this map (ant / nematode / trichoderma), each a square portrait with a white
// glow border (matching the tutorial's) and an ×count. A click ANYWHERE fades the
// overlay out — and because the finished map is already drawn behind it at full
// opacity, that fade IS the map fading in (main.js sets the canvas opaque first).
//
//   showLevelIntro({ level, threats, onDone }) → controller { destroy(), active }
//
// threats: [{ slug, label, count }, ...] — already filtered to count > 0 by the
// caller. `slug` names the art file assets/tutorial/<slug>.jpg (reused from the
// first-run tutorial). `onDone` fires once the overlay has faded out and been
// removed — main.js uses it to kick off any deferred first-run tutorial.
// =============================================================================

const VER = (typeof globalThis !== 'undefined' && globalThis.__ASSET_VER) ? '?v=' + globalThis.__ASSET_VER : '';

const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };

export function showLevelIntro(opts) {
  const level = (opts && opts.level) || 1;
  const threats = (opts && opts.threats) || [];
  const onDone = opts && opts.onDone;

  const root = el('div'); root.id = 'levelIntro';
  const inner = el('div', 'li-inner');
  inner.appendChild(el('div', 'li-level', 'Level ' + level));

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
    root.classList.add('li-out');            // CSS fades opacity 1 -> 0
    let removed = false;
    const finishOut = () => {
      if (removed) return; removed = true;
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
    root.remove();
  }
  const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') dismiss(); };
  root.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKey);

  // Fade the CONTENT in on the next frame (so it eases up rather than hard-cutting).
  requestAnimationFrame(() => { if (alive) root.classList.add('li-in'); });

  return { destroy, get active() { return alive; } };
}
