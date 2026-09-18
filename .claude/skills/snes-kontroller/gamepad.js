/**
 * SNES stilusu USB kontrollerek bekotese bongeszos jatekokhoz.
 *
 * Egyetlen fuggosegmentes ES modul. Ket dolgot tud:
 *
 *   1. SZEMANTIKUS OLVASAS. A jatek nem gombindexeket nez, hanem azt kerdezi,
 *      hogy "az 1. jatekos nyomja-e a balt". A nyers HID-indexeket a
 *      profiltabla forditja at.
 *
 *   2. BILLENTYU-EMULACIO. A padgombok valodi keydown/keyup esemenyeket
 *      kuldenek. Egy billentyuzetre irt jatek igy egyetlen sor valtoztatas
 *      nelkul iranyithato kontrollerrel.
 *
 * Miert kell egyaltalan profil: az olcso USB padek nem XInput-eszkozok,
 * ezert a bongeszo "nem szabvanyos" mappinggel adja oket. Ilyenkor a
 * navigator.getGamepads() csak nyers gombsorszamokat ad, es hogy a 2-es
 * sorszam eppen a B vagy az X gomb-e, az gyartonkent mas. Ezert van
 * eszkozazonositohoz kototT profiltabla, es ezert van kalibralas is.
 */

// ---------------------------------------------------------------- gombnevek

/** A 12 SNES gomb. Ebben a sorrendben kerdezi vegig a kalibralas is. */
export const BUTTONS = [
  'up', 'down', 'left', 'right',
  'b', 'a', 'y', 'x',
  'l', 'r', 'select', 'start',
];

/** Ember altal olvashato nevek, a kalibralo kepernyohoz. */
export const BUTTON_LABELS = {
  up: '↑ FEL', down: '↓ LE', left: '← BAL', right: '→ JOBB',
  b: 'B', a: 'A', y: 'Y', x: 'X',
  l: 'L váll', r: 'R váll', select: 'SELECT', start: 'START',
};

// ---------------------------------------------------------------- profilok

/**
 * Ismert eszkozok gombkiosztasa. A kulcs a "gyarto:termek" azonosito, amit a
 * bongeszo a gamepad.id szovegebe ir bele.
 *
 * 081f:e401 - Padix/Rockfire chip. Ez van a joy-it SBC-Gamepad-SNES padekben
 * es szamos mas, SNES formaju olcso USB gamepadben.
 */
export const PROFILES = {
  '081f:e401': {
    name: 'SNES USB gamepad (Padix 081f:e401)',
    buttons: { x: 0, a: 1, b: 2, y: 3, l: 4, r: 5, select: 8, start: 9 },
    axes: { x: 0, y: 1 },
  },
};

/**
 * Szabvanyos ("standard") mappingu padek, pl. Xbox- es PlayStation-kontroller.
 * A W3C sorrendben a 0-as gomb az ALSO arcgomb, ami a SNES-en a B.
 */
const STANDARD = {
  name: 'Szabványos gamepad',
  buttons: { b: 0, a: 1, y: 2, x: 3, l: 4, r: 5, select: 8, start: 9 },
  axes: { x: 0, y: 1 },
  dpad: { up: 12, down: 13, left: 14, right: 15 },
};

/**
 * Vegso menedek ismeretlen padre. A legtobb olcso HID gamepad ezt a sorrendet
 * hasznalja, es az iranyokat az elso ket tengelyen adja. Ha melleny fog, a
 * kalibralas kijavitja.
 */
const GENERIC = {
  name: 'Ismeretlen gamepad (találgatott kiosztás)',
  guess: true,
  buttons: { x: 0, a: 1, b: 2, y: 3, l: 4, r: 5, select: 8, start: 9 },
  axes: { x: 0, y: 1 },
};

/** A gamepad.id-bol kiszedi a "gyarto:termek" azonositot. */
export function signature(pad) {
  const m = /vendor:\s*([0-9a-f]{4}).*?product:\s*([0-9a-f]{4})/i.exec(pad.id || '');
  if (m) return (m[1] + ':' + m[2]).toLowerCase();
  return (pad.id || 'ismeretlen').trim().slice(0, 48).toLowerCase();
}

/** Felhasznaloi kalibralasbol szarmazo profilok, eszkozazonosito szerint. */
const learned = Object.create(null);

const STORE_KEY = 'snesPadProfiles';

function loadLearned() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (raw && typeof raw === 'object') Object.assign(learned, raw);
  } catch (e) { /* privat mod vagy elso indulas */ }
}

function saveLearned() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(learned)); } catch (e) { /* nem baj */ }
}

loadLearned();

/**
 * Egy padhez tartozo profil.
 *
 * A kalibralt ertekek ELSOBBSEGET elveznek, de nem TORLIK a beepitett
 * profilt: a ketto ossze van fesulve. Enelkul egy felbehagyott vagy
 * kihagyott lepesekkel vegigvitt bemeres NEMAVA tenne gombokat, pedig a
 * beepitett tabla tudja a helyes indexuket. Ez a hiba nehezen talalhato
 * meg, mert csak azon az egy gepen jelentkezik, ahol bemertek a padet.
 */
export function profileFor(pad) {
  if (!pad) return GENERIC;
  const sig = signature(pad);
  const base = PROFILES[sig] || (pad.mapping === 'standard' ? STANDARD : GENERIC);
  const learn = learned[sig];
  if (!learn) return base;
  return {
    name: learn.name || base.name,
    buttons: Object.assign({}, base.buttons, learn.buttons),
    axes: Object.assign({}, base.axes, learn.axes),
    dpad: base.dpad,
  };
}

// ---------------------------------------------------------------- hat-switch

/**
 * A POV-kapcsolo (hat switch) egyetlen tengelyen adja a nyolc iranyt.
 * Nyugalomban 1-nel nagyobb erteket kuld: Chrome-ban tipikusan 3.2857.
 */
export function decodeHat(v) {
  if (!(v >= -1.05 && v <= 1.05)) return null;
  const s = Math.max(0, Math.min(7, Math.round((v + 1) * 3.5)));
  return [
    { up: 1 }, { up: 1, right: 1 }, { right: 1 }, { right: 1, down: 1 },
    { down: 1 }, { down: 1, left: 1 }, { left: 1 }, { up: 1, left: 1 },
  ][s];
}

// ---------------------------------------------------------------- kiosztas

/**
 * Alapertelmezett billentyu-kiosztas. Az 1. pad a billentyuzet BAL oldalat
 * kapja (WASD), a 2. pad a JOBB oldalt (nyilak). Ez a ket klasszikus
 * ketjatekos kiosztas, tehat a legtobb, billentyuzetre irt jatek
 * valtoztatas nelkul mukodik vele.
 *
 * A negy arcgomb es a ket valgomb ugyanezt a logikat koveti: mindket padnel
 * a sajat oldalan, gyemant alakban ul, ahogy a paden is.
 *
 *      1. pad (bal kez)                 2. pad (jobb kez)
 *        Q  W  E    <- L ↑ R              U  ↑  O    <- L ↑ R
 *        A  S  D    <- ← ↓ →              ←  ↓  →
 *           T  (X)                           I  (X)
 *         F   H     (Y  A)                 J   L     (Y  A)
 *           G  (B)                            K  (B)
 *        C  V       <- SELECT START       ENTER SPACE
 */
export const DEFAULT_KEYS = [
  {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
    b: 'KeyG', a: 'KeyH', y: 'KeyF', x: 'KeyT',
    l: 'KeyQ', r: 'KeyE', select: 'KeyC', start: 'KeyV',
  },
  {
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    b: 'KeyK', a: 'KeyL', y: 'KeyJ', x: 'KeyI',
    l: 'KeyU', r: 'KeyO', select: 'Enter', start: 'Space',
  },
];

/** Nevesitett billentyuk esemenymezoi. A jatekok hol e.code-ot, hol e.key-t nezik. */
const NAMED = {
  ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40],
  ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39],
  Space: [' ', 32], Enter: ['Enter', 13], Escape: ['Escape', 27],
  Tab: ['Tab', 9], Backspace: ['Backspace', 8],
  ShiftLeft: ['Shift', 16], ShiftRight: ['Shift', 16],
  ControlLeft: ['Control', 17], ControlRight: ['Control', 17],
  Minus: ['-', 189], Equal: ['=', 187], Comma: [',', 188], Period: ['.', 190],
  Slash: ['/', 191], Semicolon: [';', 186], Quote: ["'", 222],
  BracketLeft: ['[', 219], BracketRight: [']', 221], Backslash: ['\\', 220],
};

/** Egy billentyukodhoz megadja a KeyboardEvent mezoit. */
export function keyFields(code) {
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return { code, key: m[1].toLowerCase(), keyCode: m[1].charCodeAt(0) };
  m = /^Digit(\d)$/.exec(code);
  if (m) return { code, key: m[1], keyCode: 48 + Number(m[1]) };
  m = /^Numpad(\d)$/.exec(code);
  if (m) return { code, key: m[1], keyCode: 96 + Number(m[1]) };
  const n = NAMED[code];
  return n ? { code, key: n[0], keyCode: n[1] } : { code, key: code, keyCode: 0 };
}

// ---------------------------------------------------------------- allapot

const NONE = Object.freeze(BUTTONS.reduce((o, b) => (o[b] = false, o), {}));

function blank() { return BUTTONS.reduce((o, b) => (o[b] = false, o), {}); }

const st = {
  slots: [null, null],       // slot -> gamepad.index
  cur: [blank(), blank()],   // most lenyomva
  prev: [blank(), blank()],  // az elozo poll()-kor lenyomva
  keyHeld: [{}, {}],
  keys: DEFAULT_KEYS.map((k) => Object.assign({}, k)),
  emulate: false,
  slotCount: 2,
  running: false,
  auto: true,
  keyTarget: null,           // ide megy a szintetikus billentyuesemeny
  manualPoll: false,
  listeners: [],
  claiming: -1,              // melyik slot var gombnyomasra
  claimCb: null,
  claimSkip: null,           // ezeket a padeket ne fogadja el
  claimBase: null,           // a foglalas kezdetekor mar nyomva tartott padek
  calib: null,
};

function rawPads() {
  const raw = navigator.getGamepads ? navigator.getGamepads() : [];
  const out = [];
  for (let i = 0; i < raw.length; i++) if (raw[i] && raw[i].connected) out.push(raw[i]);
  return out;
}

function padAt(slot) {
  const want = st.slots[slot];
  if (want == null) return null;
  const raw = navigator.getGamepads ? navigator.getGamepads() : [];
  // A szabvany szerint a tomb a pad sajat indexe szerint van feltoltve,
  // de nem minden kornyezet tartja ezt: ezert van visszaeso kereses is.
  const fast = raw[want];
  if (fast && fast.connected && fast.index === want) return fast;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] && raw[i].connected && raw[i].index === want) return raw[i];
  }
  return null;
}

/** A slotokat a padek sajat indexe szerint tolti fel, es a kihuzottakat kiuriti. */
function syncSlots() {
  const live = rawPads();
  const have = new Set(live.map((p) => p.index));
  for (let s = 0; s < st.slotCount; s++) {
    if (st.slots[s] != null && !have.has(st.slots[s])) st.slots[s] = null;
  }

  // Lyuk elore tomorites. Ha kihuztak az 1. jatekos padjet, a masik nem
  // maradhat a 2. helyen egy ures elso hely mogott: ugy senki nem lenne
  // 1. jatekos. Ket MEGLEVO padet viszont sosem cserelunk fel.
  for (let s = 0; s < st.slotCount; s++) {
    if (st.slots[s] != null) continue;
    for (let t = s + 1; t < st.slotCount; t++) {
      if (st.slots[t] == null) continue;
      st.slots[s] = st.slots[t];
      st.slots[t] = null;
      break;
    }
  }

  for (const p of live) {
    if (st.slots.indexOf(p.index) >= 0) continue;
    const free = st.slots.indexOf(null);
    if (free >= 0 && free < st.slotCount) st.slots[free] = p.index;
  }
}

/** Egy pad nyers allapotanak leforditasa SNES-gombnevekre. */
export function readPad(pad) {
  const out = blank();
  if (!pad) return out;
  const prof = profileFor(pad);
  const b = pad.buttons;
  const ax = pad.axes;

  for (const name in prof.buttons) {
    const i = prof.buttons[name];
    if (b[i] && (b[i].pressed || b[i].value > 0.5)) out[name] = true;
  }
  if (prof.dpad) {
    for (const name in prof.dpad) {
      const i = prof.dpad[name];
      if (b[i] && (b[i].pressed || b[i].value > 0.5)) out[name] = true;
    }
  }

  const a = prof.axes || {};
  if (a.hat != null && ax.length > a.hat) {
    const h = decodeHat(ax[a.hat]);
    if (h) for (const k in h) out[k] = true;
  }
  if (a.x != null && ax.length > a.x) {
    if (ax[a.x] < -0.5) out.left = true;
    if (ax[a.x] > 0.5) out.right = true;
  }
  if (a.y != null && ax.length > a.y) {
    if (ax[a.y] < -0.5) out.up = true;
    if (ax[a.y] > 0.5) out.down = true;
  }

  // Ismeretlen padnel minden tengelyt megnezunk, hatha hat-kapcsolo.
  if (prof.guess) {
    for (let i = 2; i < ax.length; i++) {
      const h = decodeHat(ax[i]);
      if (h) for (const k in h) out[k] = true;
    }
  }
  return out;
}

// ---------------------------------------------------------------- billentyu

/**
 * Hova kuldjuk a szintetikus billentyuesemenyt.
 *
 * NEM a window-ra. A DOM szabvany szerint a dispatchEvent az esemeny utjat a
 * CELTARGY OSEIBOL szamolja, es a window-nak nincs ose: a window-ra kuldott
 * esemenyt CSAK a window-ra rakott figyelok kapjak meg. Egy olyan jatek, ami
 * document.addEventListener('keydown', ...) modon figyel (ez a leggyakoribb
 * minta), semmit nem kapna.
 *
 * Valodi billentyunel a celtargy a fokuszalt elem, fokusz hijan a body, es
 * onnan buborekol fel a document-en at a window-ig. Ugyanezt csinaljuk, tehat
 * mindharom szint megkapja, pontosan egyszer.
 *
 * A keyTarget azoknak a motoroknak valo, amik a sajat canvasukon figyelnek
 * anelkul, hogy fokuszt kernenek ra.
 */
function keyTarget() {
  if (st.keyTarget) return st.keyTarget;
  const el = document.activeElement;
  if (el && el !== document.body && el.dispatchEvent) return el;
  return document.body || document.documentElement;
}

function sendKey(type, code) {
  const f = keyFields(code);
  const ev = new KeyboardEvent(type, {
    key: f.key, code: f.code, bubbles: true, cancelable: true, composed: true,
  });
  // A konstruktor a keyCode/which mezoket lenullazza, pedig regebbi jatekok
  // meg ezeket nezik. Ezert utolag tesszuk vissza.
  try {
    Object.defineProperty(ev, 'keyCode', { get: () => f.keyCode });
    Object.defineProperty(ev, 'which', { get: () => f.keyCode });
  } catch (e) { /* nem kritikus */ }
  const t = keyTarget();
  if (t) t.dispatchEvent(ev);
}

function pumpKeys(slot, now) {
  const map = st.keys[slot];
  if (!map) return;
  const held = st.keyHeld[slot];
  for (const name of BUTTONS) {
    const code = map[name];
    if (!code) continue;
    const on = now[name];
    if (on && !held[code]) { held[code] = true; sendKey('keydown', code); }
    else if (!on && held[code]) { held[code] = false; sendKey('keyup', code); }
  }
}

/** Minden virtualisan lenyomva tartott billentyu elengedese. */
function releaseAll() {
  for (let s = 0; s < st.slotCount; s++) {
    for (const code in st.keyHeld[s]) {
      if (st.keyHeld[s][code]) sendKey('keyup', code);
    }
    st.keyHeld[s] = {};
  }
}

// ---------------------------------------------------------------- fociklus

function sample() {
  syncSlots();
  if (st.claiming >= 0) claimStep();
  if (st.calib) calibStep();

  for (let s = 0; s < st.slotCount; s++) {
    const pad = padAt(s);
    const now = readPad(pad);
    const cur = st.cur[s];
    for (const name of BUTTONS) {
      if (now[name] !== cur[name]) {
        cur[name] = now[name];
        for (const fn of st.listeners) {
          try { fn(s, name, now[name], pad); } catch (e) { console.error(e); }
        }
      }
    }
    // Kalibralas kozben nem kuldunk billentyut: a kalibralo kepernyot
    // sajat maga zavarna ossze.
    if (st.emulate && !st.calib) pumpKeys(s, cur);
  }
}

let looping = false;

function loop() {
  looping = false;
  if (!st.running || !st.auto || document.hidden) return;
  sample();
  if (!st.manualPoll) poll();
  if (!looping) { looping = true; requestAnimationFrame(loop); }
}

// ---------------------------------------------------------------- foglalas

/**
 * "Melyik pad az 1. jatekos?" A hivas utan az elso pad, amin gombot nyomnak,
 * a megadott slotba kerul. Ket egyforma kontrollernel csak igy lehet
 * egyertelmuen szetvalasztani oket.
 */
export function claim(slot, cb, exclude) {
  st.claiming = slot;
  st.claimCb = cb || null;
  st.claimSkip = exclude || [];
  // A foglalas UJ gombnyomasra var, nem lenyomva tartottra. Kulonben az a
  // nyomas, amivel valaki az 1. jatekos lett, a felengedesig a 2. helyet is
  // elfoglalna, es a masik pad soha nem kerulne sorra.
  st.claimBase = Object.create(null);
  for (const p of rawPads()) st.claimBase[p.index] = anyPressed(p);
}

export function cancelClaim() {
  st.claiming = -1;
  st.claimCb = null;
  st.claimBase = null;
}

function anyPressed(p) {
  for (let i = 0; i < p.buttons.length; i++) {
    if (p.buttons[i].pressed || p.buttons[i].value > 0.5) return true;
  }
  return false;
}

function claimStep() {
  const slot = st.claiming;
  const base = st.claimBase || Object.create(null);
  for (const p of rawPads()) {
    const hit = anyPressed(p);
    // Ami mar a foglalas kezdetekor nyomva volt, az nem szamit. Amint
    // elengedik, ujra jatekba kerul.
    if (!hit) { base[p.index] = false; continue; }
    if (base[p.index]) continue;
    if (st.claimSkip && st.claimSkip.indexOf(p.index) >= 0) continue;
    // A masik slotbol kivesszuk, ha eddig ott volt, es ide tesszuk.
    const at = st.slots.indexOf(p.index);
    if (at === slot) { finishClaim(p); return; }
    const old = st.slots[slot];
    if (at >= 0) st.slots[at] = old;
    st.slots[slot] = p.index;
    finishClaim(p);
    return;
  }
}

function finishClaim(p) {
  const cb = st.claimCb;
  st.claiming = -1;
  st.claimCb = null;
  st.claimBase = null;
  if (cb) cb(p);
}

// ---------------------------------------------------------------- kalibralas

/**
 * Vegigkerdezi a 12 gombot, es eszkozazonositohoz kotve elmenti a kiosztast.
 * onStep(index, buttonName) minden lepesnel meghivodik, onDone(profil) a vegen.
 */
export function calibrate(slot, onStep, onDone) {
  const pad = padAt(slot);
  if (!pad) return false;
  releaseAll();
  st.calib = {
    slot, step: 0, sig: signature(pad),
    prof: { name: 'Kalibrált: ' + (pad.id || '?'), buttons: {}, axes: {} },
    base: null, wait: false, onStep, onDone,
  };
  if (onStep) onStep(0, BUTTONS[0]);
  return true;
}

export function calibrateSkip() { if (st.calib) calibAdvance(); }

export function cancelCalibrate() { st.calib = null; }

function calibAdvance() {
  const c = st.calib;
  c.step++;
  c.base = null;
  c.wait = false;
  if (c.step < BUTTONS.length) {
    if (c.onStep) c.onStep(c.step, BUTTONS[c.step]);
    return;
  }
  learned[c.sig] = c.prof;
  saveLearned();
  st.calib = null;
  if (c.onDone) c.onDone(c.prof);
}

function calibStep() {
  const c = st.calib;
  const p = padAt(c.slot);
  if (!p) return;

  if (!c.base) {
    c.base = {
      b: Array.prototype.map.call(p.buttons, (x) => x.pressed || x.value > 0.5),
      a: Array.prototype.slice.call(p.axes),
    };
    return;
  }

  // A gombot el kell engedni, mielott a kovetkezot kerdezzuk, kulonben egy
  // hosszabb nyomas vegigfutna a listan.
  if (c.wait) {
    let still = false;
    for (let i = 0; i < p.buttons.length; i++) {
      if ((p.buttons[i].pressed || p.buttons[i].value > 0.5) !== c.base.b[i]) still = true;
    }
    for (let i = 0; i < p.axes.length; i++) {
      if (Math.abs(p.axes[i] - c.base.a[i]) > 0.5) still = true;
    }
    if (!still) calibAdvance();
    return;
  }

  const name = BUTTONS[c.step];
  for (let i = 0; i < p.buttons.length; i++) {
    const on = p.buttons[i].pressed || p.buttons[i].value > 0.5;
    if (on && on !== c.base.b[i]) { c.prof.buttons[name] = i; c.wait = true; return; }
  }
  for (let i = 0; i < p.axes.length; i++) {
    const d = p.axes[i] - c.base.a[i];
    if (Math.abs(d) <= 0.5) continue;
    if (Math.abs(c.base.a[i]) > 1.05) c.prof.axes.hat = i;         // POV-kapcsolo
    else if (name === 'left' || name === 'right') c.prof.axes.x = i;
    else if (name === 'up' || name === 'down') c.prof.axes.y = i;
    c.wait = true;
    return;
  }
}

/** Elmentett kalibralasok torlese. */
export function forgetProfiles() {
  for (const k in learned) delete learned[k];
  saveLearned();
}

// ---------------------------------------------------------------- publikus

export const pads = {
  /**
   * Elinditja a figyelest.
   *   keyboard:  kuldjon-e valodi keydown/keyup esemenyeket (alapbol nem)
   *   keys:      felulirt billentyu-kiosztas, ket elemu tomb
   *   slots:     hany jatekost kezeljunk (alapbol 2)
   *   keyTarget: ide menjen a billentyuesemeny. Alapbol a fokuszalt elem,
   *              fokusz hijan a body, ahogy egy valodi billentyunel. Csak
   *              akkor allitsd, ha a motorod a sajat canvasan figyel.
   *   auto:      fusson-e a belso rAF ciklus (alapbol igen)
   */
  init(opts = {}) {
    // CSAK azt irjuk felul, amit tenylegesen megadtak. Enelkul egy kesobbi
    // init({ keyTarget: canvas }) csendben lekapcsolna a billentyu-emulaciot,
    // mert a hianyzo keyboard mezot hamisnak vennenk.
    if (opts.keys) st.keys = opts.keys;
    if (opts.slots) st.slotCount = opts.slots;
    if ('keyboard' in opts) st.emulate = !!opts.keyboard;
    if ('auto' in opts) st.auto = opts.auto !== false;
    if ('keyTarget' in opts) st.keyTarget = opts.keyTarget;
    while (st.slots.length < st.slotCount) st.slots.push(null);
    while (st.cur.length < st.slotCount) { st.cur.push(blank()); st.prev.push(blank()); st.keyHeld.push({}); }
    if (!st.running) {
      st.running = true;
      window.addEventListener('gamepadconnected', sample);
      window.addEventListener('gamepaddisconnected', sample);
      // Ablakvaltaskor nem jon tobb padallapot, tehat a lenyomva ragadt
      // billentyuket el kell engedni.
      const drop = () => {
        releaseAll();
        for (let s = 0; s < st.slotCount; s++) st.cur[s] = blank();
      };
      window.addEventListener('blur', drop);
      // Rejtett lapon a requestAnimationFrame teljesen leall, tehat a
      // padallapot befagyna. Ilyenkor mindent elengedunk, es visszateresnel
      // ujraindul a ciklus.
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) drop();
        else if (st.auto && !looping) { looping = true; requestAnimationFrame(loop); }
      });
      if (st.auto && !looping) { looping = true; requestAnimationFrame(loop); }
    }
    return pads;
  },

  /** A jatek fociklusanak elejen hivd meg, hogy a pressed()/released() pontos legyen. */
  poll() {
    st.manualPoll = true;
    poll();
  },

  /**
   * Egyetlen mintavetel kezzel. Csak akkor kell, ha init({ auto: false })
   * mellett a jatek sajat fociklusa lepteti a padeket.
   */
  update() { sample(); },

  /** Hany kontroller van bedugva. */
  count() { return rawPads().length; },

  /** Az adott slotban van-e kontroller. */
  has(slot) { return !!padAt(slot); },

  /** Nyers Gamepad objektum, ha kell. */
  raw(slot) { return padAt(slot); },

  /** Leiro adatok a slotrol: mit lat a bongeszo. */
  info(slot) {
    const p = padAt(slot);
    if (!p) return null;
    const prof = profileFor(p);
    return {
      slot, index: p.index, id: p.id, signature: signature(p),
      mapping: p.mapping || '', buttons: p.buttons.length, axes: p.axes.length,
      profile: prof.name, guessed: !!prof.guess,
    };
  },

  /** Minden bedugott pad leirasa, slottol fuggetlenul. */
  list() {
    return rawPads().map((p) => ({
      index: p.index, id: p.id, signature: signature(p),
      mapping: p.mapping || '', buttons: p.buttons.length, axes: p.axes.length,
      slot: st.slots.indexOf(p.index),
    }));
  },

  /** Eppen le van-e nyomva. */
  down(slot, btn) { return !!(st.cur[slot] && st.cur[slot][btn]); },

  /** A legutobbi poll() ota nyomtak-e le. */
  pressed(slot, btn) {
    return !!(st.cur[slot] && st.cur[slot][btn]) && !(st.prev[slot] && st.prev[slot][btn]);
  },

  /** A legutobbi poll() ota engedtek-e el. */
  released(slot, btn) {
    return !(st.cur[slot] && st.cur[slot][btn]) && !!(st.prev[slot] && st.prev[slot][btn]);
  },

  /** Barmelyik jatekos nyomja-e. */
  anyDown(btn) {
    for (let s = 0; s < st.slotCount; s++) if (pads.down(s, btn)) return true;
    return false;
  },

  anyPressed(btn) {
    for (let s = 0; s < st.slotCount; s++) if (pads.pressed(s, btn)) return true;
    return false;
  },

  /** A slot teljes allapota egy objektumban. */
  state(slot) { return st.cur[slot] || NONE; },

  /**
   * Esemenyfigyelo: fn(slot, buttonName, isDown, pad).
   * Ez soha nem hagy ki egy nyomast sem, meg akkor sem, ha a jatek
   * fociklusa akad egyet. Visszaadja a leiratkozo fuggvenyt.
   */
  onButton(fn) {
    st.listeners.push(fn);
    return () => {
      const i = st.listeners.indexOf(fn);
      if (i >= 0) st.listeners.splice(i, 1);
    };
  },

  /** Billentyu-emulacio ki/be. */
  keyboard(on) {
    if (on === st.emulate) return;
    st.emulate = !!on;
    if (!on) releaseAll();
  },

  /** Az aktualis billentyu-kiosztas. */
  get keys() { return st.keys; },

  /** Kiosztas csereje. Slotonkent egy { gombnev: billentyukod } objektum. */
  setKeys(k) { releaseAll(); st.keys = k; },

  /** Ket slot felcserelese. */
  swap(a = 0, b = 1) {
    const t = st.slots[a]; st.slots[a] = st.slots[b]; st.slots[b] = t;
  },

  /**
   * Mit tud a pad a gombokon TULMENOEN. Ezt nem talalgatjuk: a bongeszotol
   * kerdezzuk meg, es azt adjuk vissza, amit tenylegesen jelent.
   */
  capabilities(slot) {
    const p = padAt(slot);
    if (!p) return null;
    const va = p.vibrationActuator || null;
    const effects = va ? (va.effects || (va.type ? [va.type] : [])) : [];
    let analog = false;      // van-e nem 0/1 gombertek: analog ravasz
    let touch = false;       // jelent-e erintest gombnyomas nelkul
    for (const b of p.buttons) {
      if (b.value > 0.02 && b.value < 0.98) analog = true;
      if (b.touched && !b.pressed) touch = true;
    }
    return {
      id: p.id,
      signature: signature(p),
      mapping: p.mapping || '',
      buttons: p.buttons.length,
      axes: p.axes.length,
      rumble: !!(va && typeof va.playEffect === 'function'),
      rumbleEffects: Array.from(effects),
      hapticActuators: (p.hapticActuators || []).length,
      touchEvents: !!(p.touchEvents && p.touchEvents.length !== undefined),
      pose: !!p.pose,
      hand: p.hand || '',
      analogSeen: analog,
      touchSeen: touch,
    };
  },

  /** Rezeg-e egyaltalan ez a pad. */
  canRumble(slot) {
    const p = padAt(slot);
    return !!(p && p.vibrationActuator && typeof p.vibrationActuator.playEffect === 'function');
  },

  /**
   * Rezges. Ha a pad nem tudja, csendben nem tortenik semmi: a jatek nem
   * fugghet attol, hogy epp milyen kontroller van bedugva.
   *   duration  ezredmasodperc
   *   strong    a nehez, mely motor (0..1)
   *   weak      a konnyu, magas motor (0..1)
   */
  rumble(slot, opts = {}) {
    const p = padAt(slot);
    const va = p && p.vibrationActuator;
    if (!va || typeof va.playEffect !== 'function') return Promise.resolve('nincs');
    const effects = va.effects || (va.type ? [va.type] : ['dual-rumble']);
    const kind = effects.indexOf('dual-rumble') >= 0 ? 'dual-rumble' : effects[0];
    return va.playEffect(kind, {
      startDelay: opts.delay || 0,
      duration: opts.duration == null ? 200 : opts.duration,
      strongMagnitude: opts.strong == null ? 0.8 : opts.strong,
      weakMagnitude: opts.weak == null ? 0.6 : opts.weak,
    }).catch(() => 'hiba');
  },

  /** Rezges azonnali leallitasa. */
  stopRumble(slot) {
    const p = padAt(slot);
    const va = p && p.vibrationActuator;
    if (va && typeof va.reset === 'function') va.reset();
  },

  /** Nyers, eppen lenyomott gombindexek. Hibakeresesehez. */
  rawPressed(slot) {
    const p = padAt(slot);
    if (!p) return [];
    const out = [];
    for (let i = 0; i < p.buttons.length; i++) {
      if (p.buttons[i].pressed || p.buttons[i].value > 0.5) out.push(i);
    }
    return out;
  },

  claim, cancelClaim, calibrate, calibrateSkip, cancelCalibrate,
  forgetProfiles, profileFor, signature, readPad,
  BUTTONS, BUTTON_LABELS,
};

function poll() {
  for (let s = 0; s < st.slotCount; s++) {
    const cur = st.cur[s], prev = st.prev[s];
    for (const name of BUTTONS) prev[name] = cur[name];
  }
}

export default pads;
