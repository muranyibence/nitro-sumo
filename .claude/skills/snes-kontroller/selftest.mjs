// Onellenorzes a gamepad.js-hez. Bongeszo nelkul fut: minimalis DOM-utanzat
// es hamis padek. Ha ez elhasal, a gamepad.js serult.
//
//   node selftest.mjs

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

class FakeKeyboardEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.key = init.key;
    this.code = init.code;
    this.bubbles = !!init.bubbles;
  }
}
globalThis.KeyboardEvent = FakeKeyboardEvent;

// A korabbi utanzat csak feljegyezte a window.dispatchEvent hivasokat, es
// ezzel elrejtette a legfontosabb hibat: a window-ra kuldott esemenyt CSAK a
// window-ra rakott figyelok kapjak meg. Ezert itt most valodi buborekolo
// lancot epitunk: canvas -> body -> document -> window.
const keyLog = [];

function makeTarget(name, parent) {
  const ls = Object.create(null);
  return {
    __name: name,
    __parent: parent,
    __ls: ls,
    addEventListener: (t, fn) => { (ls[t] = ls[t] || []).push(fn); },
    removeEventListener: (t, fn) => {
      const a = ls[t] || []; const i2 = a.indexOf(fn); if (i2 >= 0) a.splice(i2, 1);
    },
    dispatchEvent(ev) {
      let node = this;
      while (node) {
        for (const fn of (node.__ls[ev.type] || []).slice()) fn(ev);
        node = ev.bubbles ? node.__parent : null;
      }
      return true;
    },
    // A teszt igy tud "valodi" bongeszo-esemenyt kivaltani (blur stb.).
    fire(t, ev) { for (const fn of (ls[t] || []).slice()) fn(ev || {}); },
  };
}

const win = makeTarget('window', null);
const doc = makeTarget('document', win);
const body = makeTarget('body', doc);

globalThis.window = win;
globalThis.document = Object.assign(doc, {
  hidden: false,
  activeElement: null,
  body,
  createElement: (tag) => makeTarget(tag, body),
});
globalThis.document.documentElement = body;

// Minden szinten figyelunk, hogy latszodjon, kihez ert el az esemeny.
for (const t of [win, doc, body]) {
  for (const type of ['keydown', 'keyup']) {
    t.addEventListener(type, (ev) => {
      keyLog.push(t.__name + ' ' + ev.type + ' ' + ev.code
        + ' key=' + JSON.stringify(ev.key) + ' kc=' + ev.keyCode);
    });
  }
}

/** Csak a window szintjen latott esemenyek, roviditett alakban. */
function winLog() {
  return keyLog.filter((l) => l.startsWith('window '))
    .map((l) => l.slice('window '.length));
}

globalThis.requestAnimationFrame = () => 0;   // a belso ciklust nem hasznaljuk
globalThis.cancelAnimationFrame = () => {};
globalThis.performance = { now: () => Date.now() };

// --------------------------------------------------------------- hamis padek
function mkPad(index, id, nButtons = 10, nAxes = 4) {
  return {
    index, id, mapping: '', connected: true,
    buttons: Array.from({ length: nButtons }, () => ({ pressed: false, value: 0 })),
    axes: new Array(nAxes).fill(0),
  };
}
const SNES = 'usb gamepad           (Vendor: 081f Product: e401)';
let live = [];
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    getGamepads: () => {
      // A valodi API a pad sajat indexe szerint feltoltott, ritkas tombot ad.
      const out = [null, null, null, null];
      for (const p of live) out[p.index] = p;
      return out;
    },
  },
});

// --------------------------------------------------------------- keretrendszer
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++; fails.push(name + (extra ? '   >> ' + extra : ''));
}
// Az objektumok kulcssorrendje nem szamit: az egyesitett profilnal a
// sorrend valtozhat, az ertekek nem.
function norm(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = norm(v[k]);
    return o;
  }
  return Array.isArray(v) ? v.map(norm) : v;
}
function eq(name, got, want) {
  ok(name, JSON.stringify(norm(got)) === JSON.stringify(norm(want)),
    'kapott ' + JSON.stringify(got) + ', vart ' + JSON.stringify(want));
}

const M = await import('./gamepad.js');
const { pads, signature, profileFor, decodeHat, keyFields, readPad } = M;

// --------------------------------------------------------------- 1. azonosito
eq('signature 081f:e401', signature({ id: SNES }), '081f:e401');
eq('signature ismeretlen', signature({ id: 'Valami Pad' }), 'valami pad');
ok('081f profil beepitve', profileFor({ id: SNES }).guess !== true);
ok('standard mapping profil', profileFor({ id: 'x', mapping: 'standard' }).buttons.b === 0);
ok('ismeretlen -> talalgatas', profileFor({ id: 'zzz', mapping: '' }).guess === true);

// --------------------------------------------------------------- 2. hat
eq('hat fel', decodeHat(-1), { up: 1 });
eq('hat jobb', decodeHat(-0.42857), { right: 1 });
eq('hat le', decodeHat(0.14286), { down: 1 });
eq('hat bal', decodeHat(0.71429), { left: 1 });
eq('hat kozep (3.2857)', decodeHat(3.2857142857142856), null);

// --------------------------------------------------------------- 3. keyFields
eq('keyFields KeyW', keyFields('KeyW'), { code: 'KeyW', key: 'w', keyCode: 87 });
eq('keyFields Space', keyFields('Space'), { code: 'Space', key: ' ', keyCode: 32 });
eq('keyFields ArrowLeft', keyFields('ArrowLeft'), { code: 'ArrowLeft', key: 'ArrowLeft', keyCode: 37 });

// --------------------------------------------------------------- 4. readPad
{
  const p = mkPad(0, SNES);
  p.buttons[9].pressed = true;                    // 081f profil: start = 9
  eq('start = gomb[9]', readPad(p).start, true);
  p.buttons[9].pressed = false;
  p.buttons[2].pressed = true;                    // b = 2
  eq('b = gomb[2]', readPad(p).b, true);
  p.buttons[2].pressed = false;
  p.axes[0] = -1;
  eq('bal = tengely[0] negativ', readPad(p).left, true);
  p.axes[0] = 0; p.axes[1] = 1;
  eq('le = tengely[1] pozitiv', readPad(p).down, true);
}

// --------------------------------------------------------------- 5. slotok
pads.init({ auto: false, slots: 2, keyboard: false });
live = [mkPad(0, SNES), mkPad(1, SNES)];
pads.update();
eq('ket pad, ket slot', pads.list().map((x) => x.slot), [0, 1]);
eq('count', pads.count(), 2);

// --------------------------------------------------------------- 6. foglalas
// A MASODIK fizikai padot akarjuk 1. jatekosnak. A foglalas utan a masik
// automatikusan a szabadon maradt helyre kerul.
let claimed = null;
pads.claim(0, (p) => { claimed = p.index; });
live[1].buttons[9].pressed = true;
pads.update();
eq('foglalas: a 2. pad lett az 1. jatekos', claimed, 1);
eq('slot0 = pad1', pads.info(0).index, 1);
eq('slot1 = pad0', pads.info(1).index, 0);
live[1].buttons[9].pressed = false;
pads.update();

// --------------------------------------------------------------- 6b. foglalas elei
// Lenyomva TARTOTT gomb nem foglal: kulonben az a nyomas, amivel valaki 1.
// jatekos lett, a felengedesig a 2. helyet is elvinne.
{
  live = [mkPad(0, SNES), mkPad(1, SNES)];
  pads.update();
  live[0].buttons[9].pressed = true;               // mar nyomva, MIELOTT kerdeznenk
  pads.update();
  let got = null;
  pads.claim(1, (p) => { got = p.index; });
  pads.update(); pads.update();
  eq('tartott gomb nem foglal', got, null);
  live[0].buttons[9].pressed = false;
  pads.update();
  live[0].buttons[9].pressed = true;               // ujra lenyomva: MOST mar foglal
  pads.update();
  eq('ujranyomas foglal', got, 0);
  live[0].buttons[9].pressed = false;
  pads.update();

  // Kizart pad: aki mar kapott helyet, ne kapjon masikat is.
  got = null;
  pads.claim(0, (p) => { got = p.index; }, [0]);
  live[0].buttons[9].pressed = true;
  pads.update(); pads.update();
  eq('kizart pad nem foglal', got, null);
  live[1].buttons[9].pressed = true;               // a MASIK pad viszont igen
  pads.update();
  eq('a masik pad foglal', got, 1);
  live[0].buttons[9].pressed = false;
  live[1].buttons[9].pressed = false;
  pads.update();
  pads.cancelClaim();
}

// A kovetkezo lepesek a 6. pontbeli kiosztast varjak, ezert visszaallitjuk.
live = [mkPad(0, SNES), mkPad(1, SNES)];
pads.update();
pads.claim(0, () => {});
live[1].buttons[9].pressed = true;
pads.update();
live[1].buttons[9].pressed = false;
pads.update();
eq('visszaallitva: slot0 = pad1', pads.info(0).index, 1);

// --------------------------------------------------------------- 7. elek
pads.poll();
live[1].axes[0] = -1;                            // az 1. jatekos padje: balra
pads.update();
ok('down(0,left)', pads.down(0, 'left'));
ok('pressed(0,left) az elso pollig', pads.pressed(0, 'left'));
pads.poll();
ok('pressed mar nem, de down igen', !pads.pressed(0, 'left') && pads.down(0, 'left'));
live[1].axes[0] = 0;
pads.update();
ok('released(0,left)', pads.released(0, 'left'));
pads.poll();

// --------------------------------------------------------------- 8. billentyu
keyLog.length = 0;
pads.keyboard(true);
live[1].axes[0] = -1;                            // 1. jatekos bal -> KeyA
live[0].buttons[9].pressed = true;               // 2. jatekos START -> Space
pads.update();
eq('lenyomas ket padrol', winLog(), [
  'keydown KeyA key="a" kc=65',
  'keydown Space key=" " kc=32',
]);
keyLog.length = 0;
live[1].axes[0] = 0;
live[0].buttons[9].pressed = false;
pads.update();
eq('felengedes', winLog(), [
  'keyup KeyA key="a" kc=65',
  'keyup Space key=" " kc=32',
]);

// --------------------------------------------------------------- 8b. utvonal
// A szintetikus esemenynek UGYANAZT az utat kell bejarnia, mint egy valodi
// billentyunek: a celtargytol felfele, minden szinten PONTOSAN egyszer.
// Ha ez elromlik, egy document-re figyelo jatek nemava valik, es ez csak az
// eles hasznalatkor derulne ki.
{
  // Melyik fizikai pad ul az 1. helyen: a slotkiosztas fugg az elozmenyektol.
  const PAD0 = live.find((p) => p.index === pads.info(0).index);
  keyLog.length = 0;
  PAD0.buttons[9].pressed = true;                  // START
  pads.update();
  const down = keyLog.slice();
  keyLog.length = 0;
  PAD0.buttons[9].pressed = false;
  pads.update();
  const up = keyLog.slice();

  const startKey = pads.keys[0].start;
  const at = (log, name) => log.filter((l) => l.startsWith(name + ' '));

  for (const level of ['body', 'document', 'window']) {
    eq('lenyomas elér a ' + level + '-hoz, pontosan egyszer',
      at(down, level).length, 1);
    eq('felengedes elér a ' + level + '-hoz, pontosan egyszer',
      at(up, level).length, 1);
  }
  ok('a body kapja elsokent (ott a celtargy)', down[0] && down[0].startsWith('body '), down[0]);
  ok('a window kapja utoljara', down[down.length - 1].startsWith('window '), down[down.length - 1]);
  ok('a helyes billentyukod megy at', down.every((l) => l.includes(startKey)), down.join(' | '));

  // keyTarget: sajat celtargy, pl. egy canvas, ami nem kap fokuszt.
  const canvas = document.createElement('canvas');
  const canvasSeen = [];
  canvas.addEventListener('keydown', () => canvasSeen.push('down'));
  pads.init({ keyTarget: canvas });
  keyLog.length = 0;
  PAD0.buttons[9].pressed = true;
  pads.update();
  eq('keyTarget: a canvas megkapja', canvasSeen.length, 1);
  eq('keyTarget: onnan is felbuborekol a document-re', at(keyLog, 'document').length, 1);
  eq('keyTarget: es a window-ra is', at(keyLog, 'window').length, 1);
  PAD0.buttons[9].pressed = false;
  pads.update();

  // Az init() csak azt irja felul, amit megadtak: a keyboard nem kapcsolt le.
  keyLog.length = 0;
  pads.init({ keyTarget: null });
  PAD0.buttons[9].pressed = true;
  pads.update();
  ok('az init nem kapcsolta le az emulaciot', keyLog.length > 0, 'keyLog ures');
  PAD0.buttons[9].pressed = false;
  pads.update();
  keyLog.length = 0;
}

// --------------------------------------------------------------- 9. ragadas
keyLog.length = 0;
live[1].axes[0] = -1;
pads.update();
eq('lenyomva marad', winLog(), ['keydown KeyA key="a" kc=65']);
keyLog.length = 0;
document.hidden = true;
doc.fire('visibilitychange');
eq('rejtett lapon elengedi', winLog(), ['keyup KeyA key="a" kc=65']);
document.hidden = false;
live[1].axes[0] = 0;
pads.update();

keyLog.length = 0;
live[1].axes[0] = -1;
pads.update();
keyLog.length = 0;
win.fire('blur');
eq('ablakvaltaskor elengedi', winLog(), ['keyup KeyA key="a" kc=65']);
live[1].axes[0] = 0;
pads.update();
pads.keyboard(false);

// --------------------------------------------------------------- 10. bemeres
// Egy kepzelt pad, aminel MINDEN el van csuszva: a kalibralasnak ki kell
// javitania. Az iranyok itt gombok, nem tengelyek.
const ODD = 'Furcsa Pad (Vendor: dead Product: beef)';
live = [mkPad(0, ODD, 14, 2)];
pads.update();
const ORDER = M.BUTTONS;                          // up,down,left,right,b,a,y,x,l,r,select,start
const WIRING = { up: 13, down: 12, left: 11, right: 10, b: 7, a: 6, y: 5, x: 4, l: 3, r: 2, select: 1, start: 0 };
let doneProf = null;
let step = 0;
pads.calibrate(0, (i) => { step = i; }, (prof) => { doneProf = prof; });
for (let i = 0; i < ORDER.length; i++) {
  const name = ORDER[i];
  pads.update();                                  // nyugalmi allapot rogzitese
  live[0].buttons[WIRING[name]].pressed = true;
  pads.update();                                  // felismeres
  live[0].buttons[WIRING[name]].pressed = false;
  pads.update();                                  // elengedes -> kovetkezo
}
ok('bemeres lefutott', !!doneProf, 'step=' + step);
if (doneProf) eq('bemert kiosztas', doneProf.buttons, WIRING);
eq('a bemert profil ervenyre jut', profileFor(live[0]).buttons, WIRING);

// A bemert profillal mar helyesen olvas.
live[0].buttons[WIRING.x].pressed = true;
pads.update();
ok('bemeres utan X jo helyen', pads.down(0, 'x'));
live[0].buttons[WIRING.x].pressed = false;
pads.update();

// Elmentette-e localStorage-ba.
ok('profil elmentve', (localStorage.getItem('snesPadProfiles') || '').includes('dead:beef'));
pads.forgetProfiles();
ok('profil torolheto', profileFor(live[0]).guess === true);

// --------------------------------------------------------------- 10b. rezges
// A Gamepad API csak akkor ad rezgest, ha a bongeszo tud rola. A konyvtarnak
// mindket agat kezelnie kell: rezgo padnel elinditja, rezgestelennel csendben
// nem tortenik semmi (a jatek nem fugghet attol, mi van bedugva).
{
  const plain = mkPad(0, SNES);                    // a mi padunk: nincs motor
  let played = null;
  const rumbly = mkPad(1, 'Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)', 17, 4);
  rumbly.mapping = 'standard';
  rumbly.vibrationActuator = {
    effects: ['dual-rumble', 'trigger-rumble'],
    playEffect: (kind, p2) => { played = { kind, p2 }; return Promise.resolve('complete'); },
    reset: () => { played = 'reset'; },
  };
  live = [plain, rumbly];
  pads.update();

  const a0 = pads.info(0).index === 0 ? 0 : 1;     // melyik slotban van a sima pad
  const a1 = 1 - a0;

  eq('sima pad nem rezeg', pads.canRumble(a0), false);
  eq('rezgo pad rezeg', pads.canRumble(a1), true);

  const c0 = pads.capabilities(a0);
  eq('kepessegek: nincs rezges', [c0.rumble, c0.rumbleEffects, c0.touchEvents, c0.pose], [false, [], false, false]);
  eq('kepessegek: gomb- es tengelyszam', [c0.buttons, c0.axes], [10, 4]);

  const c1 = pads.capabilities(a1);
  eq('kepessegek: van rezges', c1.rumble, true);
  eq('kepessegek: effektusok', c1.rumbleEffects, ['dual-rumble', 'trigger-rumble']);

  await pads.rumble(a1, { duration: 300, strong: 0.5, weak: 0.25 });
  eq('a rezges a dual-rumble-t valasztja', played && played.kind, 'dual-rumble');
  eq('a rezges parameterei atmennek',
    played && [played.p2.duration, played.p2.strongMagnitude, played.p2.weakMagnitude],
    [300, 0.5, 0.25]);

  played = null;
  const r = await pads.rumble(a0, { duration: 300 });
  eq('rezgestelen padnel nem dobal hibat', [r, played], ['nincs', null]);

  pads.stopRumble(a1);
  eq('leallitas', played, 'reset');
  pads.stopRumble(a0);                              // ne dobjon

  // Nyers gombindexek hibakeresesehez
  plain.buttons[5].pressed = true;
  pads.update();
  eq('rawPressed a nyers indexet adja', pads.rawPressed(a0), [5]);
  plain.buttons[5].pressed = false;
  pads.update();
}

// --------------------------------------------------------------- 10c. profil-egyesites
// Egy felbehagyott bemeres nem teheti nemava azokat a gombokat, amiket a
// beepitett profil tud. A kalibralt ertek nyer, de a tobbi megmarad.
{
  live = [mkPad(0, SNES)];
  pads.update();
  eq('bemeres elott a beepitett R', profileFor(live[0]).buttons.r, 5);

  // Hianyos bemeres: csak a START-ot rogzitettuk, mashol kihagyas.
  let prof = null;
  pads.calibrate(0, null, (pr) => { prof = pr; });
  for (let i = 0; i < M.BUTTONS.length; i++) {
    if (M.BUTTONS[i] === 'start') {
      pads.update();
      live[0].buttons[3].pressed = true;  pads.update();
      live[0].buttons[3].pressed = false; pads.update();
    } else {
      pads.calibrateSkip();
      pads.update();
    }
  }
  ok('a hianyos bemeres lefutott', !!prof);
  const merged = profileFor(live[0]);
  eq('a bemert START nyer', merged.buttons.start, 3);
  eq('a kihagyott R megmarad a beepitettbol', merged.buttons.r, 5);
  eq('a kihagyott B is megmarad', merged.buttons.b, 2);
  live[0].buttons[5].pressed = true;
  pads.update();
  ok('a kihagyott gomb tovabbra is olvashato', pads.down(0, 'r'));
  live[0].buttons[5].pressed = false;
  pads.update();
  pads.forgetProfiles();
}

// --------------------------------------------------------------- 11. kihuzas
live = [];
pads.update();
eq('kihuzas utan ures', [pads.has(0), pads.has(1), pads.count()], [false, false, 0]);

// --------------------------------------------------------------- 12. lyuk
// Ha az 1. jatekos padjet kihuzzak, a masodik NEM maradhat a 2. helyen egy
// ures elso hely mogott: ugy senki nem lenne 1. jatekos.
live = [mkPad(0, SNES), mkPad(1, SNES)];
pads.update();
eq('ket pad ket helyen', [pads.info(0).index, pads.info(1).index], [0, 1]);
live = [live[1]];                                  // az elso padet kihuzzak
pads.update();
eq('a megmaradt pad az 1. helyre lep', [pads.info(0) && pads.info(0).index, pads.info(1)], [1, null]);
live = [live[0], mkPad(2, SNES)];                  // uj pad bedugva
pads.update();
eq('ket meglevo padet nem cserel fel', [pads.info(0).index, pads.info(1).index], [1, 2]);

// --------------------------------------------------------------- eredmeny
console.log('\n  ' + pass + ' rendben, ' + fail + ' hibas');
if (fails.length) console.log('\n  HIBAK:\n   - ' + fails.join('\n   - '));
process.exit(fail ? 1 : 0);
