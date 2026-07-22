// =============================================================================
// CREDITS overlay — title-screen "Credits" button. Plain black & white popup
// (mirrors the high-scores card shell: black card, white border, small ✕).
// Lists the species-photo credits + the music credit; each artist NAME is a
// link that opens in a new tab (works inside the itch iframe via target=_blank).
//
//   showCredits({ onClose }) → { close }
//
// Credit data lives here (small + specific). When a species portrait is swapped
// for a real licensed photo, add its line to PHOTO_CREDITS below.
// =============================================================================

const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };

// {label} — what the credit is for; {name}/{url} — the artist + their page.
const PHOTO_CREDITS = [
  { label: 'Slippery Jack &middot; <i>Suillus luteus</i>', name: 'Daniel Seth Jackson', url: 'https://www.inaturalist.org/people/stonescottages' },
  { label: 'Bleeding Tooth Fungus &middot; <i>Hydnellum peckii</i>', name: 'Morten Ross', url: 'https://www.inaturalist.org/people/morten' },
];
const MUSIC_CREDITS = [
  { label: 'Soundtrack', name: 'Sascha Ende', url: 'https://ende.app/en' },
];

function row(c) {
  return '<div class="cr-row"><span class="cr-what">' + c.label + '</span>'
    + '<a class="cr-who" href="' + c.url + '" target="_blank" rel="noopener noreferrer">' + c.name + '</a></div>';
}
function section(title, list) {
  return '<div class="cr-sec"><div class="cr-head">' + title + '</div>' + list.map(row).join('') + '</div>';
}

export function showCredits({ onClose } = {}) {
  const root = el('div', 'hs-wrap'); root.id = 'crOverlay';
  root.innerHTML =
    '<div class="hs-card cr-card" role="dialog" aria-label="Credits">' +
      '<button class="hs-close" id="crClose" type="button" aria-label="Close">✕</button>' +
      '<h2 class="hs-title cr-title">Credits</h2>' +
      section('Species photography', PHOTO_CREDITS) +
      section('Music', MUSIC_CREDITS) +
    '</div>';
  document.body.appendChild(root);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() { document.removeEventListener('keydown', onKey); root.remove(); if (onClose) onClose(); }
  root.querySelector('#crClose').onclick = close;
  root.addEventListener('click', (e) => { if (e.target === root) close(); });   // click backdrop to dismiss
  document.addEventListener('keydown', onKey);
  return { close };
}
