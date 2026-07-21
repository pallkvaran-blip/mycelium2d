// =============================================================================
// Boot loading screen (#loadscreen / .ld-*).
//
// A deliberately minimal overlay: a small, centered, white % counter while ALL
// art decodes up front (canvas sprites + every card / species / threat portrait
// + the spore icon), so nothing pops in lazily once you're playing. When ready
// the counter becomes a small centered "Click" — and that click doubles as the
// user gesture browsers require before audio can start.
//
//   const ld = showLoading();
//   ld.setProgress(pct);         // 0..100
//   ld.ready(() => { ...enter... });   // swap % → "Click", resolve on tap
//   ld.destroy();                // fade out + remove
// =============================================================================

export function showLoading() {
  const root = document.createElement('div');
  root.id = 'loadscreen';
  root.innerHTML = '<div class="ld-pct" id="ldPct">0%</div>';
  document.body.appendChild(root);
  const pctEl = root.querySelector('#ldPct');
  let armed = false, shown = 0;

  function setProgress(pct) {
    if (armed) return;   // once "Click" is showing, stop overwriting it with numbers
    const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
    if (p < shown) return;   // monotonic — the two progress sources settle at different
    shown = p;               // times, so ignore any transient backward tick
    pctEl.textContent = p + '%';
  }
  // Everything is decoded: show the "Click" prompt and resolve `onClick` on the first
  // tap/click anywhere on the screen (which also unlocks audio autoplay).
  function ready(onClick) {
    if (armed) return; armed = true;
    pctEl.textContent = 'Click';
    root.classList.add('ld-ready');
    const go = () => { root.removeEventListener('click', go); onClick && onClick(); };
    root.addEventListener('click', go);
  }
  function destroy() { root.classList.add('ld-out'); setTimeout(() => { try { root.remove(); } catch (_) {} }, 450); }

  return { setProgress, ready, destroy, root };
}
