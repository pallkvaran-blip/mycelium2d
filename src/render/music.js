// =============================================================================
// Background music — lazy and non-blocking.
//
// The game boots and is fully playable BEFORE any music is fetched: initMusic()
// is called only after the map is ready. It then streams ONE random track in
// the background and starts it as soon as it can. Browser autoplay policy
// usually needs the first tap/click, so we also (re)try on the first user
// gesture. When a track ends, another random one loads — one at a time, so the
// whole ~13 MB playlist is never force-downloaded. A persisted mute toggle lets
// the player turn it off (and then nothing is fetched at all).
// =============================================================================

const TRACKS = [
  'assets/music/backrooms-vol7.mp3',
  'assets/music/backrooms-vol10.mp3',
  'assets/music/backrooms-vol23.mp3',
  'assets/music/backrooms-vol29.mp3',
];

let audio = null, muted = false, lastIdx = -1, gestureBound = false;
try { muted = localStorage.getItem('mycMuted') === '1'; } catch (e) {}

// Pick a random track (never the one just played). No cache-busting version on
// the URL — music is large and rarely changes, so let the browser cache it
// across refreshes/deploys instead of re-downloading megabytes each time.
function nextSrc() {
  let i = 0;
  if (TRACKS.length > 1) { do { i = Math.floor(Math.random() * TRACKS.length); } while (i === lastIdx); }
  lastIdx = i;
  return TRACKS[i];
}
function playNext() {
  if (!audio) return;
  audio.src = nextSrc();
  audio.load();
  tryPlay();
}
function tryPlay() {
  if (!audio || muted) return;
  const p = audio.play();
  if (p && p.catch) p.catch(() => {});   // blocked by autoplay policy — a gesture will start it
}
function bindGesture() {
  if (gestureBound) return; gestureBound = true;
  const kick = () => tryPlay();           // harmless passive retry; play() no-ops once already playing
  window.addEventListener('pointerdown', kick, true);
  window.addEventListener('keydown', kick, true);
  window.addEventListener('touchend', kick, true);
}

// Start the background music system. Safe to call more than once.
export function initMusic() {
  if (audio) return;
  audio = new Audio();
  audio.preload = 'auto';                 // stream in the background (the page is already rendered)
  audio.volume = 0.32;
  audio.addEventListener('ended', playNext);
  audio.addEventListener('error', () => setTimeout(playNext, 5000));  // skip a track that fails to load
  if (!muted) { playNext(); bindGesture(); }
}

// Flip mute; persists the choice. Returns the new muted state.
export function toggleMusic() {
  muted = !muted;
  try { localStorage.setItem('mycMuted', muted ? '1' : '0'); } catch (e) {}
  if (audio) {
    if (muted) audio.pause();
    else if (!audio.src) { playNext(); bindGesture(); }  // first unmute: only now start fetching
    else tryPlay();
  }
  return muted;
}
export function isMusicMuted() { return muted; }
