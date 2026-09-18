/**
 * Kontroller-kapu: toltokepernyo, ami addig all a jatek elott, amig a
 * kontrollerek nincsenek rendben.
 *
 * Tiszta DOM-atfedes, tehat mindegy, hogy a jatek canvasra, DOM-ba vagy
 * WebGL-be rajzol: a hatterben sotetitve latszik, es nem nyul hozza semmihez.
 *
 * Mit tud:
 *   - megmutatja, hany kontroller van bedugva es mit lat beloluk a bongeszo,
 *   - gombnyomassal donti el, melyik pad az 1. es melyik a 2. jatekos,
 *   - minden gombot elore kirajzol: a MOST nyomott elenkzold, a mar egyszer
 *     kiprobalt halvanyzold, tehat vegig lehet nyomkodni mind a 12-t es
 *     latszik, melyik maradt ki,
 *   - ismeretlen padre inditja a bemerest,
 *   - csak akkor engedi tovabb a jatekot, ha minden a helyen van.
 *
 * Hasznalat:
 *   import { padGate } from './pad-gate.js';
 *   padGate({ players: 2, onStart: () => startGame() });
 */

import { pads, BUTTONS, BUTTON_LABELS } from './gamepad.js';

const CSS = `
.pg-root {
  position: fixed; inset: 0; z-index: 99999; overflow: hidden;
  display: flex; flex-direction: column;
  padding: clamp(10px, 2.2vh, 26px) clamp(12px, 2.5vw, 34px);
  background: rgba(6, 8, 12, 0.86);
  font: clamp(11px, 1.15vw, 14px)/1.45 ui-monospace, "Cascadia Mono", Consolas, monospace;
  color: #e8ecf4; -webkit-font-smoothing: none;
}
.pg-root * { box-sizing: border-box; min-width: 0; }
.pg-title { font-size: clamp(15px, 2.1vw, 24px); letter-spacing: .16em; margin: 0; color: #ffd479; }
.pg-sub { color: #8a93aa; margin: 2px 0 0; }

.pg-state {
  display: flex; align-items: center; gap: 10px; flex: none; flex-wrap: wrap;
  border: 1px solid #39405a; padding: 8px 13px; margin: clamp(8px, 1.4vh, 16px) 0;
  background: #1b1f2b;
}
.pg-dot { width: 10px; height: 10px; background: #f0616e; flex: none; }
.pg-dot.half { background: #f5b942; }
.pg-dot.ok { background: #5fd97e; }
.pg-state b { letter-spacing: .06em; white-space: nowrap; }
.pg-state span { color: #8a93aa; margin-left: auto; text-align: right; }

/* A ket jatekos egymas mellett, es EGYUTT toltik ki a maradek magassagot.
   Igy sehol nincs gordulés: ami nem fer el, az zsugorodik. */
.pg-slots {
  flex: 1 1 auto; min-height: 0; overflow: auto;
  display: flex; gap: clamp(8px, 1.4vw, 18px); align-items: stretch;
}
.pg-slot {
  flex: 1 1 0; min-width: 0;
  border: 1px solid #39405a; background: #191d27;
  padding: clamp(8px, 1.4vh, 16px);
  display: flex; flex-direction: column; align-items: center;
}
.pg-slot.wait { border-color: #f5b942; }
.pg-slot.ready { border-color: #3d7a4e; }
.pg-slot h3 { margin: 0; font-size: 1em; letter-spacing: .12em; align-self: flex-start; }
.pg-slot.p1 h3 { color: #6fb4ff; }
.pg-slot.p2 h3 { color: #ff7a7a; }
.pg-slot .pg-id {
  color: #6f7891; font-size: .85em; align-self: flex-start; max-width: 100%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pg-slot .pg-msg { margin-top: auto; padding-top: 6px; color: #f5b942; text-align: center; }
.pg-slot.ready .pg-msg { color: #5fd97e; }
.pg-count { color: #6f7891; font-size: .9em; margin-top: 8px; }
.pg-count b { color: #5fd97e; }
.pg-count.all { color: #5fd97e; }

/* --- kontroller rajz: minden meret SZAZALEKBAN, tehat egyben zsugorodik --- */
.pg-pad {
  position: relative; width: 100%; max-width: 440px; aspect-ratio: 258 / 116;
  margin: clamp(6px, 1.4vh, 16px) 0 0; flex: none;
  container-type: inline-size;
}
.pg-pad .bd { position: absolute; left: 0; right: 0; top: 10.34%; bottom: 0; background: #464c5e; }
.pg-pad i { position: absolute; display: block; background: #2b303e; }
.pg-pad u {
  position: absolute; display: flex; align-items: center; justify-content: center;
  text-decoration: none; font-weight: 700; font-size: 4.2cqw; color: #cfd6e6;
  background: #6a5a8e; border-radius: 50%; width: 8.91%; height: 19.83%;
}
.pg-pad u.xy { background: #8a7ab5; }
.pg-pad s {
  position: absolute; display: block; text-decoration: none; background: #5a6076;
  width: 11.63%; height: 8.62%; transform: rotate(-16deg);
}
.pg-pad em {
  position: absolute; font-style: normal; font-size: 3.4cqw; color: #8a93aa;
  white-space: nowrap;
}
.pg-pad b.sh {
  position: absolute; top: 0; width: 20.93%; height: 12.93%; background: #3a4053;
  font-weight: 700; font-size: 3.6cqw; line-height: 1; color: #aab3c6;
  display: flex; align-items: center; justify-content: center;
}
/* Mar kiprobalt gomb: halvanyzold. A most nyomott felulirja. */
.pg-pad .done { background: #2f6b45 !important; color: #bff0d0 !important; }
.pg-pad .on {
  background: #5fd97e !important; color: #0e2b18 !important;
  box-shadow: 0 0 12px 2px rgba(95, 217, 126, .6);
}

.pg-cal {
  border: 1px solid #f5b942; background: #201a10; padding: 14px; text-align: center;
  margin-bottom: clamp(8px, 1.4vh, 16px); flex: none;
}
.pg-cal .q { color: #8a93aa; }
.pg-cal .n { font-size: clamp(20px, 3vw, 34px); font-weight: 700; letter-spacing: .1em;
             margin: 4px 0 2px; color: #ffd479; }
.pg-cal .p { display: flex; gap: 3px; justify-content: center; margin-top: 10px; }
.pg-cal .p i { width: 16px; height: 4px; background: #39405a; display: block; }
.pg-cal .p i.d { background: #5fd97e; } .pg-cal .p i.c { background: #f5b942; }

.pg-row {
  display: flex; gap: 8px; flex-wrap: wrap; align-items: center; flex: none;
  margin-top: clamp(8px, 1.4vh, 16px);
}
.pg-root button {
  font: 500 1em/1 ui-monospace, Consolas, monospace; color: #e8ecf4;
  background: #262c3a; border: 1px solid #39405a; padding: 9px 13px; cursor: pointer;
  letter-spacing: .06em;
}
.pg-root button:hover { background: #313849; }
.pg-root button.go {
  background: #2f6f45; border-color: #47a065; color: #eafff0; position: relative;
  overflow: hidden; z-index: 0;
}
.pg-root button.go:hover { background: #3a8654; }
/* A START nyomva tartasat toltodo sav mutatja a gombon belul. */
.pg-root button.go::before {
  content: ''; position: absolute; inset: 0; z-index: -1; transform-origin: left center;
  transform: scaleX(var(--hold, 0)); background: #5fd97e;
}
.pg-root button:disabled { opacity: .35; cursor: default; }
.pg-hint { color: #6f7891; font-size: .88em; margin: 8px 0 0; flex: none; }
.pg-hint kbd { background: #262c3a; border: 1px solid #39405a; padding: 1px 5px; }

/* Keskeny ablak: a ket jatekos egymas ala kerul. */
@media (max-aspect-ratio: 1/1), (max-width: 720px) {
  .pg-slots { flex-direction: column; }
}

/* Ha a bongeszo nem ismeri a container query egysegeket, essen vissza
   allando meretre: attol meg minden olvashato marad. */
@supports not (font-size: 1cqw) {
  .pg-pad u { font-size: 11px; }
  .pg-pad em { font-size: 8px; }
  .pg-pad b.sh { font-size: 9px; }
}
`;

/** A padrajz egy slothoz. A gombelemek id-je: pg{slot}-{gombnev}. */
function padMarkup(slot) {
  const q = (n) => `id="pg${slot}-${n}"`;
  // A dobozok merete szazalekban: 17/258 = 6.59% szeles, 17/116 = 14.66% magas.
  const D = 'width:6.59%;height:14.66%';
  return `
  <div class="pg-pad">
    <b class="sh" style="left:5.43%" ${q('l')}>L</b>
    <b class="sh" style="right:5.43%" ${q('r')}>R</b>
    <div class="bd"></div>
    <i ${q('up')}    style="left:14.73%;top:32.76%;${D}"></i>
    <i ${q('left')}  style="left:8.14%;top:47.41%;${D}"></i>
    <i               style="left:14.73%;top:47.41%;${D}"></i>
    <i ${q('right')} style="left:21.32%;top:47.41%;${D}"></i>
    <i ${q('down')}  style="left:14.73%;top:62.07%;${D}"></i>
    <s ${q('select')} style="left:36.43%;top:60.34%"></s>
    <s ${q('start')}  style="left:50.39%;top:60.34%"></s>
    <em style="left:35.5%;top:74%">SELECT</em>
    <em style="left:51.5%;top:74%">START</em>
    <u class="xy" ${q('x')} style="left:79.46%;top:28.45%">X</u>
    <u class="xy" ${q('y')} style="left:69.77%;top:49.14%">Y</u>
    <u            ${q('a')} style="left:89.15%;top:49.14%">A</u>
    <u            ${q('b')} style="left:79.46%;top:69.83%">B</u>
  </div>`;
}

/**
 * Megnyitja a kaput. Visszaad egy vezerlot: { close, el, closed }.
 *
 *   players  hany jatekos kell (alapbol 2)
 *   onStart  akkor hivodik, amikor a kapu bezarul es indulhat a jatek
 *   onClose  minden bezaraskor lefut, meg akkor is, ha billentyuzettel
 *            jatszanak tovabb; kap egy { keyboard: true|false } objektumot
 *   allowKeyboard  legyen-e "billentyuzettel jatszom" kiut (alapbol igen)
 *   title, subtitle  sajat felirat
 */
export function padGate(opts = {}) {
  const players = opts.players || 2;
  const allowKeyboard = opts.allowKeyboard !== false;

  const root = document.createElement('div');
  root.className = 'pg-root';
  const style = document.createElement('style');
  style.textContent = CSS;

  let slotsHtml = '';
  for (let s = 0; s < players; s++) {
    slotsHtml += `
      <div class="pg-slot p${s + 1}" id="pgslot${s}">
        <h3>${s + 1}. JÁTÉKOS</h3>
        <div class="pg-id" id="pgid${s}">-</div>
        ${padMarkup(s)}
        <div class="pg-count" id="pgcnt${s}"></div>
        <div class="pg-msg" id="pgmsg${s}"></div>
      </div>`;
  }

  root.innerHTML = `
    <h1 class="pg-title">${opts.title || 'KONTROLLEREK'}</h1>
    <p class="pg-sub">${opts.subtitle || 'Dugd be a két USB kontrollert, és nyomj meg rajtuk egy gombot.'}</p>
    <div class="pg-state">
      <span class="pg-dot" id="pgdot"></span>
      <b id="pgstate">0 / ${players} kontroller</b>
      <span id="pghint">A böngésző csak az első gombnyomás után látja meg a padet.</span>
    </div>
    <div class="pg-cal" id="pgcal" style="display:none">
      <div class="q">Nyomd meg ezt a gombot a <b id="pgcalpad">1.</b> kontrolleren:</div>
      <div class="n" id="pgcalname">START</div>
      <div class="q" id="pgcalhint">Ha nincs ilyen gomb, hagyd ki.</div>
      <div class="p" id="pgcalprog"></div>
      <div class="pg-row" style="justify-content:center">
        <button id="pgcalskip">KIHAGYÁS</button>
        <button id="pgcalstop">MÉGSE</button>
      </div>
    </div>
    <div class="pg-slots" id="pgslots">${slotsHtml}</div>
    <div class="pg-row" id="pgrow">
      <button class="go" id="pggo" disabled>INDULHAT</button>
      <button id="pgswap">CSERE</button>
      <button id="pgcal2">BEMÉRÉS</button>
      <button id="pgclear">GOMBTESZT ÚJRA</button>
      ${allowKeyboard ? '<button id="pgkb">BILLENTYŰZETTEL</button>' : ''}
    </div>
    <p class="pg-hint" id="pgfoot"></p>`;

  document.head.appendChild(style);
  document.body.appendChild(root);

  const $ = (id) => root.querySelector('#' + id);
  const claimed = new Array(players).fill(false);
  // Melyik gombot nyomtak mar meg legalabb egyszer. Ez teszi vegignyomkodhatova
  // a padet: latszik, melyik maradt ki.
  const seen = [];
  for (let s = 0; s < players; s++) seen.push(Object.create(null));
  let closed = false;
  let calibrating = false;
  let raf = 0;

  // ------------------------------------------------------------ foglalas
  // Ket egyforma kontrollernel csak gombnyomasbol lehet eldonteni, melyik
  // melyik. Sorban vegigkerdezzuk a jatekosokat.
  const taken = [];

  function nextClaim() {
    if (closed || calibrating) return;
    for (let s = 0; s < players; s++) {
      if (!claimed[s]) {
        // A mar kiosztott padeket kihagyjuk: aki egyszer 1. jatekos lett, azt
        // egy ujabb gombnyomas ne tegye 2. jatekossa is.
        pads.claim(s, (p) => {
          claimed[s] = true;
          taken.push(p.index);
          nextClaim();
        }, taken);
        return;
      }
    }
    pads.cancelClaim();
  }

  // ------------------------------------------------------------ bemeres
  function startCalib(slot) {
    const ok = pads.calibrate(slot, (i, name) => {
      $('pgcalname').textContent = BUTTON_LABELS[name] || name;
      $('pgcalpad').textContent = (slot + 1) + '.';
      let h = '';
      for (let k = 0; k < BUTTONS.length; k++) {
        h += `<i class="${k < i ? 'd' : k === i ? 'c' : ''}"></i>`;
      }
      $('pgcalprog').innerHTML = h;
    }, () => {
      calibrating = false;
      $('pgcal').style.display = 'none';
      $('pgrow').style.display = '';
      seen[slot] = Object.create(null);      // uj kiosztas, uj gombteszt
      nextClaim();
    });
    if (!ok) return;
    calibrating = true;
    pads.cancelClaim();
    $('pgcal').style.display = '';
    $('pgrow').style.display = 'none';
  }

  $('pgcalskip').onclick = () => pads.calibrateSkip();
  $('pgcalstop').onclick = () => {
    pads.cancelCalibrate();
    calibrating = false;
    $('pgcal').style.display = 'none';
    $('pgrow').style.display = '';
    nextClaim();
  };
  $('pgcal2').onclick = () => {
    for (let s = 0; s < players; s++) if (pads.has(s)) { startCalib(s); return; }
  };
  $('pgswap').onclick = () => {
    pads.swap(0, 1);
    const t = seen[0]; seen[0] = seen[1]; seen[1] = t;
  };
  $('pgclear').onclick = () => {
    for (let s = 0; s < players; s++) seen[s] = Object.create(null);
  };
  $('pggo').onclick = () => close(false);
  if (allowKeyboard) $('pgkb').onclick = () => close(true);

  // ------------------------------------------------------------ meretezes
  /**
   * A padrajz fix aranyu doboz, tehat a CSS egymaga nem tudja beilleszteni:
   * vagy a szelesseget koveti es kilog aluk, vagy forditva. Ezert megmerjuk,
   * mennyi hely marad a szoveges sorok utan, es abbol adjuk a szelesseget.
   * Igy sehol nincs gordules, meg alacsony ablakban sem.
   */
  const RATIO = 258 / 116;

  function fitPads() {
    for (let s = 0; s < players; s++) {
      const slot = $('pgslot' + s);
      if (!slot) continue;
      const pad = slot.querySelector('.pg-pad');
      if (!pad) continue;
      const cs = getComputedStyle(slot);
      const padTop = parseFloat(cs.paddingTop) || 0;
      const padBot = parseFloat(cs.paddingBottom) || 0;
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      let used = 0;
      for (const ch of slot.children) {
        if (ch !== pad) used += ch.getBoundingClientRect().height;
      }
      const mt = parseFloat(getComputedStyle(pad).marginTop) || 0;
      const availH = slot.clientHeight - padTop - padBot - used - mt;
      const availW = slot.clientWidth - padL - padR;
      const w = String(Math.max(84, Math.floor(Math.min(440, availW, availH * RATIO)))) + 'px';
      // Csak valodi valtozasnal irunk: kulonben a ResizeObserver sajat magat
      // hivogatna vegtelen korben.
      if (pad.style.width !== w) pad.style.width = w;
    }
  }

  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(fitPads);
    for (let s = 0; s < players; s++) ro.observe($('pgslot' + s));
  }
  window.addEventListener('resize', fitPads);

  // ------------------------------------------------------------ rajzolas
  const idCache = new Array(players).fill('');

  // Itt jegyezzuk fel, melyik gombot probaltak mar ki. Ez fut akkor is, ha
  // eppen a START-ot nyomjak: igy a START is tesztelheto gomb marad.
  let fitDirty = true;
  const offBtn = pads.onButton((slot, name, isDown) => {
    if (!isDown || closed) return;
    if (slot < players) seen[slot][name] = true;
  });

  // A jatekot a START NYOMVA TARTASA inditja, nem egy koccintas.
  //
  // Ket dolgot old meg egyszerre. Egy: az a gombnyomas, amivel a masodik
  // jatekos kivalasztja magat, nem inditja el egybol a meccset. Ketto: a
  // START-ot is vegig lehet probalni a tobbi gombbal egyutt, mert egy rovid
  // nyomas csak zoldre valtja, nem indit.
  const HOLD = 0.6;
  let held = 0;

  function holdStep(dt, ready) {
    if (!ready || calibrating) { held = 0; return false; }
    let on = false;
    for (let s = 0; s < players; s++) if (claimed[s] && pads.down(s, 'start')) on = true;
    held = on ? held + dt : 0;
    return held >= HOLD;
  }

  let lastT = performance.now();

  function frame() {
    if (closed) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(0.25, (now - lastT) / 1000);
    lastT = now;

    let ready = 0;
    for (let s = 0; s < players; s++) {
      const info = pads.info(s);
      const box = $('pgslot' + s);
      const key = info ? info.id + '|' + info.profile : '';
      if (idCache[s] !== key) {
        idCache[s] = key;
        $('pgid' + s).textContent = info
          ? info.id + (info.guessed ? '   [nincs bemérve]' : '   [' + info.profile + ']')
          : 'nincs csatlakoztatva';
      }

      const has = !!info;
      const ok = has && claimed[s];
      if (ok) ready++;
      box.className = 'pg-slot p' + (s + 1) + (ok ? ' ready' : has ? ' wait' : '');

      const stt = pads.state(s);
      let done = 0;
      for (const name of BUTTONS) {
        const el = $('pg' + s + '-' + name);
        if (!el) continue;
        const hit = !!seen[s][name];
        if (hit) done++;
        el.classList.toggle('done', hit);
        el.classList.toggle('on', !!stt[name]);
      }

      const cnt = $('pgcnt' + s);
      cnt.className = 'pg-count' + (done >= BUTTONS.length ? ' all' : '');
      const cntText = !has ? ''
        : done >= BUTTONS.length
          ? 'mind a ' + BUTTONS.length + ' gomb működik'
          : '<b>' + done + '</b> / ' + BUTTONS.length + ' gomb kipróbálva';
      if (cnt.innerHTML !== cntText) { cnt.innerHTML = cntText; fitDirty = true; }

      const msgText = !has
        ? 'Dugd be a kontrollert.'
        : !claimed[s]
          ? 'Nyomj meg rajta egy gombot.'
          : done >= BUTTONS.length ? 'Kész.' : 'Próbáld végig a gombokat.';
      const msg = $('pgmsg' + s);
      if (msg.textContent !== msgText) { msg.textContent = msgText; fitDirty = true; }
    }

    const n = pads.count();
    $('pgdot').className = 'pg-dot ' + (ready >= players ? 'ok' : n > 0 ? 'half' : '');
    $('pgstate').textContent = ready >= players
      ? players + ' / ' + players + ' kontroller kész'
      : n + ' / ' + players + ' kontroller';
    $('pghint').textContent = ready >= players
      ? 'Tartsd nyomva a START-ot a kezdéshez.'
      : n === 0
        ? 'A böngésző csak az első gombnyomás után látja meg a padet.'
        : 'Válaszd ki, melyik pad melyik játékosé.';

    const go = $('pggo');
    go.disabled = ready < players;

    if (fitDirty) { fitDirty = false; fitPads(); }

    const fire = holdStep(dt, ready >= players);
    go.style.setProperty('--hold', (held / HOLD).toFixed(3));
    go.textContent = held > 0.05 ? 'INDÍTÁS...' : 'INDULHAT';
    if (fire) { close(false); return; }
  }

  function close(keyboard) {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    if (ro) ro.disconnect();
    window.removeEventListener('resize', fitPads);
    offBtn();
    pads.cancelClaim();
    pads.cancelCalibrate();
    root.remove();
    style.remove();
    if (opts.onClose) opts.onClose({ keyboard: !!keyboard });
    if (!keyboard && opts.onStart) opts.onStart();
  }

  $('pgfoot').innerHTML = 'Az éppen nyomott gomb élénkzöld, a már kipróbált halványzöld: '
    + 'így végig lehet nyomkodni mind a 12-t, a START-ot is. '
    + 'Az indításhoz <b>tartsd nyomva</b> a START-ot. '
    + (allowKeyboard ? 'Kontroller nélkül a <kbd>BILLENTYŰZETTEL</kbd> gombbal is indulhatsz. ' : '')
    + 'Rossz gomb gyullad ki? Nyomd meg a <kbd>BEMÉRÉS</kbd>-t.';

  nextClaim();
  fitPads();
  frame();

  return {
    close: () => close(false),
    el: root,
    get closed() { return closed; },
  };
}

export default padGate;
