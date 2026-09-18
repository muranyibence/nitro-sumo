/**
 * Hang: soha nem dob, soha nem logol.
 * A jatek ciklustol fuggetlen HTMLAudioElement.
 */

function noop() {}

function makeAudio(src, loop) {
  const a = new Audio();
  try {
    a.preload = 'auto';
    a.loop = !!loop;
    a.src = src;
    a.addEventListener('error', noop);
    a.addEventListener('stalled', noop);
    a.addEventListener('abort', noop);
  } catch (_) { /* */ }
  return a;
}

function playSafe(a) {
  try {
    const p = a.play();
    if (p && typeof p.then === 'function') {
      return p.then(() => true, () => false);
    }
    return Promise.resolve(!a.paused);
  } catch (_) {
    return Promise.resolve(false);
  }
}

function stopSafe(a) {
  try {
    a.pause();
    a.currentTime = 0;
  } catch (_) { /* */ }
}

function track(name, loop) {
  return makeAudio('soundtrack/' + encodeURIComponent(name), loop);
}

const sting = makeAudio('soundtrack/intro_soundtrack_new.mp3', false);
const bell = track('Boxing Bell Sound Effect.mp3', false);
const crowd = track('Large Arena Concert Crowd Cheering & Applauding 1.mp3', true);
const battle = track('Siegius Arena - Without Rest - Boss Battle.mp3', false);
const finale = track('5 seconds timer with sound effect #timer #countdown.mp3', false);

try { sting.volume = 0.9; } catch (_) { /* */ }
try { bell.volume = 0.85; } catch (_) { /* */ }
try { battle.volume = 0.52; } catch (_) { /* */ }
try { crowd.volume = 0.34; } catch (_) { /* */ }
try { finale.volume = 0.85; } catch (_) { /* */ }

let arenaWanted = false;
let finaleWanted = false;

function keepPlaying(a, n) {
  if (!arenaWanted || finaleWanted) return Promise.resolve(false);
  return playSafe(a).then((ok) => {
    if (ok || !arenaWanted || finaleWanted || n >= 8) return ok;
    return new Promise((resolve) => {
      setTimeout(() => { resolve(keepPlaying(a, n + 1)); }, 220);
    });
  });
}

function keepFinale(n) {
  if (!finaleWanted) return Promise.resolve(false);
  return playSafe(finale).then((ok) => {
    if (ok || !finaleWanted || n >= 8) return ok;
    return new Promise((resolve) => {
      setTimeout(() => { resolve(keepFinale(n + 1)); }, 220);
    });
  });
}

function playFinale() {
  if (!arenaWanted) return;
  finaleWanted = true;
  stopSafe(crowd);
  stopSafe(battle);
  stopSafe(finale);
  keepFinale(0);
}

export function playSting() {
  stopSafe(sting);
  return playSafe(sting);
}

export function stopSting() {
  stopSafe(sting);
}

export function playBell() {
  stopSafe(bell);
  return playSafe(bell);
}

export function startArena() {
  finaleWanted = false;
  stopSafe(finale);
  stopSafe(crowd);
  stopSafe(battle);
  arenaWanted = true;
  keepPlaying(crowd, 0);
  keepPlaying(battle, 0);
}

export function stopArena() {
  arenaWanted = false;
  finaleWanted = false;
  stopSafe(crowd);
  stopSafe(battle);
  stopSafe(finale);
}

try {
  crowd.addEventListener('ended', () => {
    if (arenaWanted && !finaleWanted) keepPlaying(crowd, 0);
  });
  battle.addEventListener('ended', () => { playFinale(); });
} catch (_) { /* */ }

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (finaleWanted) keepFinale(0);
  else if (arenaWanted) {
    keepPlaying(crowd, 0);
    keepPlaying(battle, 0);
  }
});
