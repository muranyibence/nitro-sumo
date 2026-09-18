/**
 * LÖKDÖSŐ ARÉNA
 *
 * A teljes szabályt, a timing-számokat és az esemény-/boost-listát a
 * SPECIFIKACIO.md írja le (a projekt gyökerében). Ez a fájl annak az
 * implementációja.
 *
 * Ez a fájl SEHOL nem olvas kontrollert, csak billentyűzetet: a padgombok
 * valódi billentyűeseményt küldenek, tehát úgy íródott, mintha billentyűzetes
 * kétjátékos játék lenne.
 */

import { pads } from './gamepad.js';
import { padGate } from './pad-gate.js';

// ---------------------------------------------------------------- billentyuk
//
// Pontosan az AGENTS.md gomb-tablaja: b = lokes/dash, a = horgony/blokk.

const P1_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', b: 'KeyG', a: 'KeyH' };
const P2_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', b: 'KeyK', a: 'KeyL' };
const START_KEYS = ['KeyV', 'Space'];

const ALAP = [
  { szin: '#6fb4ff', keys: P1_KEYS, alapnev: '1. JÁTÉKOS' },
  { szin: '#ff7a7a', keys: P2_KEYS, alapnev: '2. JÁTÉKOS' },
];

const nyomva = new Set();

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;

  // Fejlesztes kozben ne kelljen vegignyomkodni a padgombokat: Escape a
  // pad-gate mar meglevo "BILLENTYUZETTEL" gombjara kattint. A pad-gate.js-t
  // ez nem modositja, csak kivulrol hasznalja a sajat gombjat.
  if (e.code === 'Escape') {
    const kihagy = document.getElementById('pgkb');
    if (kihagy) { kihagy.click(); return; }
  }

  nyomva.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', (e) => nyomva.delete(e.code));
window.addEventListener('blur', () => nyomva.clear());

// Elu-pillanatkep az elozo kepkockarol: kell, hogy a lapozas/megerosites egy
// gombnyomasra egyszer suljon el, ne a gomb minden kepkockajaban.
let nyomvaElozo = new Set();
function frissenLenyomva(kod) {
  return nyomva.has(kod) && !nyomvaElozo.has(kod);
}

// -------------------------------------------------------------- alapmeretek

const canvas = document.getElementById('jatek');
const c = canvas.getContext('2d');
const SZELESSEG = canvas.width;
const MAGASSAG = canvas.height;
const KOZEP_X = SZELESSEG / 2;
const KOZEP_Y = MAGASSAG / 2;

// -------------------------------------------------------------- finomhangolas
//
// Minden szam a SPECIFIKACIO.md-bol jon; ha a jatek erzese miatt hangolni
// kell, azt is ott vezessuk at, ne csak itt.

const KOR_HOSSZ = 60;
const ZSUGOR_VEGE = 52;
const HIRTELEN_HALAL_KEZDET = 55;
const HIRTELEN_HALAL_VEGE = 58;

const R0 = 260;
const RMIN = 70;
const RMIN2 = 20;
const ZONA_MINIMUM = 8; // sose menjen 0 ala, kulonben a tavolsag-szamitasok elszallnak

const JATEKOS_SUGAR = 26;
const FEJ_KEP_SZORZO = 2.3;

const V0 = 300;
const DASH_SEBESSEG = V0 * 3.5;
const DASH_IDO = 0.18;
const DASH_COOLDOWN = 1.2;
const DASH_BUFFER_IDO = 0.15; // ha kicsit korabban nyomjak, mint amikor a cooldown letelik, ne essen ki

const HORGONY_TOMEG = 3;
const HORGONY_MAX_TARTAS = 1.5;
const HORGONY_COOLDOWN = 1;

const KNOCKBACK_CSILLAPODAS = 6; // 1/mp: ilyen rataval csillapul a lokes-sebesseg
const PUSH_ALAP = 460;
const DASH_LOKES_SZORZO = 1.8;
const NAGY_LOKES_SZORZO = 2.5;
const PAJZS_TOMEG = 1000; // "vegtelen tomeg" helyett, hogy ne kelljen NaN-okkal foglalkozni

const ESEMENY_ALAP_KOZ = 13;
const ESEMENY_JITTER = 2;
const ESEMENY_FIGYELMEZTETES = 2;
const ZSUGOR_LOKES_MERTEK = 40;
const SODRAS_ERO = 140;
const FLASH_HATRA = 0.4;

const BOOST_MAX = 3; // egyszerre ennyi lehet a palyan
const BOOST_COOLDOWN = 4; // ennyi idonkent probal ujat spawnolni, amig nincs meg a max
const BOOST_ELSO_SPAWN = 3;
const BOOST_SUGAR = 16;

const VISSZASZAMLALAS_HOSSZ = 3;
const RESTART_ABLAK = 0.5;
const VALASZTO_FEJ_MERET = 180;

const ESEMENYEK = {
  turbo: { nev: 'TURBÓ', tartam: 6 },
  zavar: { nev: 'ZAVAR', tartam: 5 },
  csuszas: { nev: 'CSÚSZÁS', tartam: 7 },
  sotetedes: { nev: 'SÖTÉTEDÉS', tartam: 8 },
  sodras: { nev: 'SODRÁS', tartam: 6 },
  zsugorlokes: { nev: 'ZSUGORODÁS-LÖKET', tartam: 0 },
};
const ESEMENY_TIPUSOK = Object.keys(ESEMENYEK);

const BOOSTOK = {
  sebesseg: { nev: 'SEBESSÉG', szin: '#7cf29c', ikon: '⚡' },
  pajzs: { nev: 'PAJZS', szin: '#7cc9ff', ikon: '🛡️' },
  nagylokes: { nev: 'NAGY LÖKÉS', szin: '#ffb454', ikon: '💥' },
  magnes: { nev: 'MÁGNES', szin: '#d98cff', ikon: '🧲' },
  fagyasztas: { nev: 'FAGYASZTÁS', szin: '#bfe9ff', ikon: '❄️' },
  zsugoritas: { nev: 'ZSUGORÍTÁS', szin: '#ff8c8c', ikon: '🎯' },
};
const BOOST_TIPUSOK = Object.keys(BOOSTOK);

// ------------------------------------------------------------ kollegafejek
//
// Opcionalis: ha a starter/img/kollegak.json nincs meg (nem kertek fejeket),
// a karakterValasztasLepes automatikusan fallback-el sima szinu korongra.

let kollegak = [];
const fejKepek = new Map(); // id -> HTMLImageElement
let kepekKeszek = false;

async function betoltKepek() {
  try {
    const res = await fetch('img/kollegak.json');
    const adat = await res.json();
    kollegak = adat.kollegak ?? [];
    if (kollegak.length > 1) karakterValasztas.index[1] = 1;
    await Promise.all(kollegak.map((k) => new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = k.kep;
      fejKepek.set(k.id, img);
    })));
  } catch {
    kollegak = [];
  } finally {
    kepekKeszek = true;
  }
}

// ------------------------------------------------------------- arena-logo
//
// A logo JPG, tehat feher a hattere, nem atlatszo. Egyszer, betolteskor
// pixelenkent atlatszova tesszuk a feher reszt, hogy a sotet arena-alapon
// csak a kek gyuru/jel latszodjon, ne egy feher negyzet.

const LOGO_UTVONAL = 'img/logo/Nitrowise New Logo_Nitrowise_Blue_40.jpg';
let logoKep = null; // feldolgozas utan: <canvas>, feher hatter nelkul

function feherAthatszova(img) {
  const ideiglenes = document.createElement('canvas');
  ideiglenes.width = img.naturalWidth;
  ideiglenes.height = img.naturalHeight;
  const ic = ideiglenes.getContext('2d');
  ic.drawImage(img, 0, 0);
  const adat = ic.getImageData(0, 0, ideiglenes.width, ideiglenes.height);
  const p = adat.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    // Minel feherebb a pixel, annal atlatszobb: nem 0/100%-os vagas, hanem
    // fokozatos alpha, kulonben a JPEG-el elmosott szeleken recés lenne.
    const feherseg = Math.min(r, g, b);
    const alpha = 255 - feherseg;
    if (alpha <= 0) { p[i + 3] = 0; continue; }
    // A felig atlatszo szelpixelek szine a feher fele csuszott a JPEG-tomoritestol;
    // ezt visszaszamoljuk, kulonben a gyuru pereme kimosott szurkenek latszana.
    const arany = 255 / alpha;
    p[i] = Math.min(255, Math.round((r - feherseg) * arany));
    p[i + 1] = Math.min(255, Math.round((g - feherseg) * arany));
    p[i + 2] = Math.min(255, Math.round((b - feherseg) * arany));
    p[i + 3] = alpha;
  }
  ic.putImageData(adat, 0, 0);
  return ideiglenes;
}

{
  const img = new Image();
  img.onload = () => { logoKep = feherAthatszova(img); };
  img.src = encodeURI(LOGO_UTVONAL);
}

// ---------------------------------------------------------------- allapot

let allapot = 'KARAKTERVALASZTAS'; // KARAKTERVALASZTAS | VISSZASZAMLALAS | JATEK
let jelenlegiIdo = 0; // folyamatosan no, mp-ben: pulzalasokhoz es a restart-ablakhoz

const karakterValasztas = { index: [0, 0], kesz: [false, false], inditasKesz: 0 };

let jatekosok = [];
let visszaszamlalasHatra = 0;
let hatra = KOR_HOSSZ;
let vege = false;
let gyoztes = null;
let legutobbiZonaSugar = R0;
const startNyomasIdo = [null, null];

let aktivEsemeny = null; // { tipus, hatraLevo, ...extra }
let elozoEsemenyTipus = null;
let esemenyFazis = 'VARAKOZAS'; // VARAKOZAS | FIGYELMEZTETES
let esemenyIdozito = 0;
let kovetkezoEsemenyTipus = null;
let zsugorLokesOsszeg = 0;

let boostok = []; // { tipus, x, y }[]
let boostIdozito = BOOST_ELSO_SPAWN;

// -------------------------------------------------------------- segedfuggvenyek

function veletlenEsemenyIdo() {
  return ESEMENY_ALAP_KOZ + (Math.random() * 2 - 1) * ESEMENY_JITTER;
}

function valasszEsemenyt() {
  const lehetseges = ESEMENY_TIPUSOK.filter((t) => t !== elozoEsemenyTipus);
  return lehetseges[Math.floor(Math.random() * lehetseges.length)];
}

function zonaSugarSzamitas(eltelt) {
  let r;
  if (eltelt <= ZSUGOR_VEGE) {
    r = R0 - (R0 - RMIN) * (eltelt / ZSUGOR_VEGE);
  } else if (eltelt <= HIRTELEN_HALAL_KEZDET) {
    r = RMIN;
  } else if (eltelt <= HIRTELEN_HALAL_VEGE) {
    const t = (eltelt - HIRTELEN_HALAL_KEZDET) / (HIRTELEN_HALAL_VEGE - HIRTELEN_HALAL_KEZDET);
    r = RMIN - (RMIN - RMIN2) * t;
  } else {
    r = RMIN2;
  }
  return Math.max(r - zsugorLokesOsszeg, ZONA_MINIMUM);
}

function sebessegSzorzo(j) {
  let szorzo = 1;
  if (aktivEsemeny && aktivEsemeny.tipus === 'turbo') szorzo *= 1.6;
  if (j.sebessegBoostHatra > 0) szorzo *= 1.5;
  return szorzo;
}

function megvanForditva(j) {
  return !!(aktivEsemeny && aktivEsemeny.tipus === 'zavar' && aktivEsemeny.celSlot === j.slot);
}

function iranyBemenet(j) {
  let dx = 0, dy = 0;
  if (nyomva.has(j.keys.left)) dx -= 1;
  if (nyomva.has(j.keys.right)) dx += 1;
  if (nyomva.has(j.keys.up)) dy -= 1;
  if (nyomva.has(j.keys.down)) dy += 1;
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
  if (megvanForditva(j)) { dx = -dx; dy = -dy; }
  return { dx, dy };
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function keverSzin(a, b, t) {
  const [ar, ag, ab] = hexRgb(a);
  const [br, bg, bb] = hexRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

function pulzalasSzin(szin1, szin2, frekvencia) {
  const t = (Math.sin(jelenlegiIdo * frekvencia) + 1) / 2;
  return keverSzin(szin1, szin2, t);
}

// -------------------------------------------------------------- kor inditas

function jatekosokLetrehozasa() {
  jatekosok = ALAP.map((a, i) => {
    const k = kollegak[karakterValasztas.index[i]];
    return {
      slot: i,
      szin: a.szin,
      keys: a.keys,
      nev: k ? k.nev : a.alapnev,
      becenev: k ? k.becenev : a.alapnev,
      fejKep: k ? fejKepek.get(k.id) : null,
      x: 0, y: 0,
      kbx: 0, kby: 0,
      iranyX: i === 0 ? 1 : -1, iranyY: 0,
      jegVX: 0, jegVY: 0,
      dashAktiv: false, dashHatra: 0, dashIranyX: 0, dashIranyY: 0, dashCooldownHatra: 0, dashBufferHatra: 0,
      horgony: false, horgonyHatra: 0, horgonyCooldownHatra: 0,
      fagyasztvaHatra: 0, pajzsHatra: 0, sebessegBoostHatra: 0, magnesHatra: 0, nagyHitboxHatra: 0,
      nagyLokesKeszen: false,
    };
  });
}

function korIndit() {
  jatekosok[0].x = KOZEP_X - 100; jatekosok[0].y = KOZEP_Y;
  jatekosok[1].x = KOZEP_X + 100; jatekosok[1].y = KOZEP_Y;
  for (const j of jatekosok) {
    j.kbx = 0; j.kby = 0; j.jegVX = 0; j.jegVY = 0;
    j.dashAktiv = false; j.dashHatra = 0; j.dashCooldownHatra = 0; j.dashBufferHatra = 0;
    j.horgony = false; j.horgonyHatra = 0; j.horgonyCooldownHatra = 0;
    j.fagyasztvaHatra = 0; j.pajzsHatra = 0; j.sebessegBoostHatra = 0;
    j.magnesHatra = 0; j.nagyHitboxHatra = 0; j.nagyLokesKeszen = false;
  }

  hatra = KOR_HOSSZ;
  vege = false;
  gyoztes = null;
  zsugorLokesOsszeg = 0;
  legutobbiZonaSugar = R0;

  aktivEsemeny = null;
  elozoEsemenyTipus = null;
  esemenyFazis = 'VARAKOZAS';
  esemenyIdozito = veletlenEsemenyIdo() - ESEMENY_FIGYELMEZTETES;
  kovetkezoEsemenyTipus = null;

  boostok = [];
  boostIdozito = BOOST_ELSO_SPAWN;

  startNyomasIdo[0] = null;
  startNyomasIdo[1] = null;
}

function visszaszamlalasIndit() {
  allapot = 'VISSZASZAMLALAS';
  visszaszamlalasHatra = VISSZASZAMLALAS_HOSSZ;
  korIndit();
}

// ---------------------------------------------------------------- fizika

function lokesFrissitesCsakKnockback(j, dt) {
  j.x += j.kbx * dt;
  j.y += j.kby * dt;
  const csillapitas = Math.exp(-KNOCKBACK_CSILLAPODAS * dt);
  j.kbx *= csillapitas;
  j.kby *= csillapitas;
}

function jatekosLepes(j, ellenfel, dt) {
  j.dashCooldownHatra = Math.max(0, j.dashCooldownHatra - dt);
  j.dashBufferHatra = Math.max(0, j.dashBufferHatra - dt);
  j.horgonyCooldownHatra = Math.max(0, j.horgonyCooldownHatra - dt);
  j.fagyasztvaHatra = Math.max(0, j.fagyasztvaHatra - dt);
  j.pajzsHatra = Math.max(0, j.pajzsHatra - dt);
  j.sebessegBoostHatra = Math.max(0, j.sebessegBoostHatra - dt);
  j.magnesHatra = Math.max(0, j.magnesHatra - dt);
  j.nagyHitboxHatra = Math.max(0, j.nagyHitboxHatra - dt);

  if (j.fagyasztvaHatra > 0) {
    j.dashAktiv = false;
    j.horgony = false;
    lokesFrissitesCsakKnockback(j, dt);
    return;
  }

  const { dx, dy } = iranyBemenet(j);
  if (dx || dy) { j.iranyX = dx; j.iranyY = dy; }

  if (frissenLenyomva(j.keys.b)) j.dashBufferHatra = DASH_BUFFER_IDO;

  if (j.dashBufferHatra > 0 && j.dashCooldownHatra <= 0 && !j.horgony) {
    j.dashAktiv = true;
    j.dashHatra = DASH_IDO;
    j.dashBufferHatra = 0;
    const hossz = Math.hypot(j.iranyX, j.iranyY) || 1;
    j.dashIranyX = j.iranyX / hossz;
    j.dashIranyY = j.iranyY / hossz;
  }

  if (!j.dashAktiv) {
    const horgonyGomb = nyomva.has(j.keys.a);
    if (horgonyGomb && !j.horgony && j.horgonyCooldownHatra <= 0) {
      j.horgony = true;
      j.horgonyHatra = 0;
    }
    if (j.horgony) {
      if (!horgonyGomb || j.horgonyHatra >= HORGONY_MAX_TARTAS) {
        j.horgony = false;
        j.horgonyCooldownHatra = HORGONY_COOLDOWN;
        j.horgonyHatra = 0;
      } else {
        j.horgonyHatra += dt;
      }
    }
  }

  const csuszkal = !!(aktivEsemeny && aktivEsemeny.tipus === 'csuszas');
  if (!csuszkal) { j.jegVX = 0; j.jegVY = 0; }

  if (j.dashAktiv) {
    j.x += j.dashIranyX * DASH_SEBESSEG * dt;
    j.y += j.dashIranyY * DASH_SEBESSEG * dt;
    j.dashHatra -= dt;
    if (j.dashHatra <= 0) {
      j.dashAktiv = false;
      j.dashCooldownHatra = DASH_COOLDOWN;
    }
  } else if (j.horgony) {
    // nem mozog: ez a horgony arat
  } else if (csuszkal) {
    const gyorsulas = 900;
    j.jegVX += dx * gyorsulas * dt;
    j.jegVY += dy * gyorsulas * dt;
    const frikcio = Math.pow(0.4, dt);
    j.jegVX *= frikcio;
    j.jegVY *= frikcio;
    const maxSebesseg = V0 * sebessegSzorzo(j) * 1.4;
    const seb = Math.hypot(j.jegVX, j.jegVY);
    if (seb > maxSebesseg) { j.jegVX *= maxSebesseg / seb; j.jegVY *= maxSebesseg / seb; }
    j.x += j.jegVX * dt;
    j.y += j.jegVY * dt;
  } else {
    const seb = V0 * sebessegSzorzo(j);
    j.x += dx * seb * dt;
    j.y += dy * seb * dt;
  }

  if (aktivEsemeny && aktivEsemeny.tipus === 'sodras') {
    j.x += aktivEsemeny.szelX * dt;
    j.y += aktivEsemeny.szelY * dt;
  }

  if (j.magnesHatra > 0) {
    const vx = j.x - ellenfel.x, vy = j.y - ellenfel.y;
    const d = Math.hypot(vx, vy) || 1;
    const ero = 90;
    ellenfel.x += (vx / d) * ero * dt;
    ellenfel.y += (vy / d) * ero * dt;
  }

  lokesFrissitesCsakKnockback(j, dt);
}

function utkozesFeldolgozas(A, B) {
  const rA = JATEKOS_SUGAR * (A.nagyHitboxHatra > 0 ? 1.4 : 1);
  const rB = JATEKOS_SUGAR * (B.nagyHitboxHatra > 0 ? 1.4 : 1);
  let dx = B.x - A.x, dy = B.y - A.y;
  let dist = Math.hypot(dx, dy);
  const minDist = rA + rB;
  if (dist >= minDist) return;
  if (dist < 0.0001) { dx = 1; dy = 0; dist = 0.0001; }
  const nx = dx / dist, ny = dy / dist;
  const atfedes = minDist - dist;

  const tomegA = A.pajzsHatra > 0 ? PAJZS_TOMEG : (A.horgony ? HORGONY_TOMEG : 1);
  const tomegB = B.pajzsHatra > 0 ? PAJZS_TOMEG : (B.horgony ? HORGONY_TOMEG : 1);
  const osszTomeg = tomegA + tomegB;
  const aranyA = tomegB / osszTomeg;
  const aranyB = tomegA / osszTomeg;

  A.x -= nx * atfedes * aranyA;
  A.y -= ny * atfedes * aranyA;
  B.x += nx * atfedes * aranyB;
  B.y += ny * atfedes * aranyB;

  let erosseg = PUSH_ALAP;
  if (A.dashAktiv) {
    erosseg *= DASH_LOKES_SZORZO * (A.nagyLokesKeszen ? NAGY_LOKES_SZORZO : 1);
    A.nagyLokesKeszen = false;
  }
  if (B.dashAktiv) {
    erosseg *= DASH_LOKES_SZORZO * (B.nagyLokesKeszen ? NAGY_LOKES_SZORZO : 1);
    B.nagyLokesKeszen = false;
  }

  A.kbx -= nx * erosseg * aranyA;
  A.kby -= ny * erosseg * aranyA;
  B.kbx += nx * erosseg * aranyB;
  B.kby += ny * erosseg * aranyB;
}

function esesEllenorzes(eltelt) {
  const zonaSugar = zonaSugarSzamitas(eltelt);
  legutobbiZonaSugar = zonaSugar;
  const kieso = jatekosok.filter((j) => Math.hypot(j.x - KOZEP_X, j.y - KOZEP_Y) > zonaSugar);
  if (kieso.length === 1) {
    vege = true;
    gyoztes = kieso[0] === jatekosok[0] ? jatekosok[1] : jatekosok[0];
  } else if (kieso.length === 2) {
    vege = true;
    gyoztes = null;
  }
}

// ---------------------------------------------------------------- esemenyek

function esemenyInditas(tipus) {
  elozoEsemenyTipus = tipus;
  const def = ESEMENYEK[tipus];
  aktivEsemeny = { tipus, hatraLevo: def.tartam > 0 ? def.tartam : FLASH_HATRA };

  if (tipus === 'zavar') {
    aktivEsemeny.celSlot = Math.random() < 0.5 ? 0 : 1;
  } else if (tipus === 'sodras') {
    const szog = Math.random() * Math.PI * 2;
    aktivEsemeny.szelX = Math.cos(szog) * SODRAS_ERO;
    aktivEsemeny.szelY = Math.sin(szog) * SODRAS_ERO;
  } else if (tipus === 'zsugorlokes') {
    zsugorLokesOsszeg += ZSUGOR_LOKES_MERTEK;
  }
}

function esemenyFrissites(dt) {
  if (aktivEsemeny) {
    aktivEsemeny.hatraLevo -= dt;
    if (aktivEsemeny.hatraLevo <= 0) aktivEsemeny = null;
  }

  esemenyIdozito -= dt;
  if (esemenyIdozito > 0) return;

  if (esemenyFazis === 'VARAKOZAS') {
    kovetkezoEsemenyTipus = valasszEsemenyt();
    esemenyFazis = 'FIGYELMEZTETES';
    esemenyIdozito = ESEMENY_FIGYELMEZTETES;
  } else {
    esemenyInditas(kovetkezoEsemenyTipus);
    kovetkezoEsemenyTipus = null;
    esemenyFazis = 'VARAKOZAS';
    esemenyIdozito = veletlenEsemenyIdo() - ESEMENY_FIGYELMEZTETES;
  }
}

// ------------------------------------------------------------------- boostok

function boostSpawn() {
  const biztonsagosSugar = Math.max(legutobbiZonaSugar * 0.75, 20);
  const szog = Math.random() * Math.PI * 2;
  const tavolsag = Math.random() * biztonsagosSugar;
  const tipus = BOOST_TIPUSOK[Math.floor(Math.random() * BOOST_TIPUSOK.length)];
  boostok.push({
    tipus,
    x: KOZEP_X + Math.cos(szog) * tavolsag,
    y: KOZEP_Y + Math.sin(szog) * tavolsag,
  });
}

function boostFelvetel(b, felvevo, ellenfel) {
  switch (b.tipus) {
    case 'sebesseg': felvevo.sebessegBoostHatra = 5; break;
    case 'pajzs': felvevo.pajzsHatra = 4; break;
    case 'nagylokes': felvevo.nagyLokesKeszen = true; break;
    case 'magnes': felvevo.magnesHatra = 3; break;
    case 'fagyasztas': ellenfel.fagyasztvaHatra = 1.2; break;
    case 'zsugoritas': ellenfel.nagyHitboxHatra = 6; break;
  }
}

function boostFrissites(dt) {
  for (let i = boostok.length - 1; i >= 0; i--) {
    const b = boostok[i];
    for (const j of jatekosok) {
      const d = Math.hypot(j.x - b.x, j.y - b.y);
      if (d < JATEKOS_SUGAR + BOOST_SUGAR) {
        const ellenfel = j === jatekosok[0] ? jatekosok[1] : jatekosok[0];
        boostFelvetel(b, j, ellenfel);
        boostok.splice(i, 1);
        break;
      }
    }
  }

  boostIdozito -= dt;
  if (boostIdozito <= 0) {
    boostIdozito = BOOST_COOLDOWN;
    if (boostok.length < BOOST_MAX) boostSpawn();
  }
}

// -------------------------------------------------------------------- korok

function restartFigyeles() {
  START_KEYS.forEach((kod, i) => {
    if (frissenLenyomva(kod)) startNyomasIdo[i] = jelenlegiIdo;
  });
  for (let i = 0; i < 2; i++) {
    if (startNyomasIdo[i] != null && jelenlegiIdo - startNyomasIdo[i] > 1) startNyomasIdo[i] = null;
  }
  if (
    startNyomasIdo[0] != null && startNyomasIdo[1] != null &&
    Math.abs(startNyomasIdo[0] - startNyomasIdo[1]) <= RESTART_ABLAK
  ) {
    visszaszamlalasIndit();
  }
}

function jatekLepes(dt) {
  if (vege) { restartFigyeles(); return; }

  hatra -= dt;
  const eltelt = KOR_HOSSZ - hatra;

  esemenyFrissites(dt);
  boostFrissites(dt);

  jatekosLepes(jatekosok[0], jatekosok[1], dt);
  jatekosLepes(jatekosok[1], jatekosok[0], dt);
  utkozesFeldolgozas(jatekosok[0], jatekosok[1]);
  esesEllenorzes(eltelt);

  if (!vege && hatra <= 0) {
    hatra = 0;
    vege = true;
    const dA = Math.hypot(jatekosok[0].x - KOZEP_X, jatekosok[0].y - KOZEP_Y);
    const dB = Math.hypot(jatekosok[1].x - KOZEP_X, jatekosok[1].y - KOZEP_Y);
    gyoztes = dA < dB ? jatekosok[0] : dB < dA ? jatekosok[1] : null;
  }
}

function visszaszamlalasLepes(dt) {
  visszaszamlalasHatra -= dt;
  if (visszaszamlalasHatra <= 0) allapot = 'JATEK';
}

function karakterValasztasLepes(dt) {
  if (!kepekKeszek) return;

  if (kollegak.length === 0) {
    jatekosokLetrehozasa();
    visszaszamlalasIndit();
    return;
  }

  ALAP.forEach((_, i) => {
    if (karakterValasztas.kesz[i]) return;
    const keys = ALAP[i].keys;
    if (frissenLenyomva(keys.left)) {
      karakterValasztas.index[i] = (karakterValasztas.index[i] - 1 + kollegak.length) % kollegak.length;
    }
    if (frissenLenyomva(keys.right)) {
      karakterValasztas.index[i] = (karakterValasztas.index[i] + 1) % kollegak.length;
    }
    if (frissenLenyomva(keys.b)) karakterValasztas.kesz[i] = true;
  });

  if (karakterValasztas.kesz[0] && karakterValasztas.kesz[1]) {
    karakterValasztas.inditasKesz += dt;
    if (karakterValasztas.inditasKesz >= 0.6) {
      jatekosokLetrehozasa();
      visszaszamlalasIndit();
    }
  }
}

function lepes(dt) {
  jelenlegiIdo += dt;
  if (allapot === 'KARAKTERVALASZTAS') karakterValasztasLepes(dt);
  else if (allapot === 'VISSZASZAMLALAS') visszaszamlalasLepes(dt);
  else if (allapot === 'JATEK') jatekLepes(dt);
  nyomvaElozo = new Set(nyomva);
}

// -------------------------------------------------------------------- rajzolas

function rajzolArena(zonaSugar, eltelt) {
  c.fillStyle = '#12141c';
  c.fillRect(0, 0, SZELESSEG, MAGASSAG);

  c.save();
  c.beginPath();
  c.arc(KOZEP_X, KOZEP_Y, zonaSugar, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = '#1d212b';
  c.fillRect(KOZEP_X - zonaSugar, KOZEP_Y - zonaSugar, zonaSugar * 2, zonaSugar * 2);
  if (logoKep) {
    const meret = zonaSugar * 2;
    c.drawImage(logoKep, KOZEP_X - meret / 2, KOZEP_Y - meret / 2, meret, meret);
  }
  c.restore();

  c.beginPath();
  c.arc(KOZEP_X, KOZEP_Y, zonaSugar, 0, Math.PI * 2);
  c.lineWidth = 4;
  c.strokeStyle = eltelt >= HIRTELEN_HALAL_KEZDET
    ? pulzalasSzin('#ff4d4d', '#ffb3b3', 6)
    : pulzalasSzin('#6fd3ff', '#e8f7ff', 2);
  c.stroke();
}

function rajzolJatekos(j) {
  let testSzin = j.szin;
  if (j.fagyasztvaHatra > 0) testSzin = '#bfe9ff';
  else if (j.horgony) testSzin = '#8b93a7';

  const sugar = JATEKOS_SUGAR * (j.nagyHitboxHatra > 0 ? 1.4 : 1);

  if (j.pajzsHatra > 0) {
    c.beginPath();
    c.arc(j.x, j.y, sugar + 8, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(124,201,255,0.9)';
    c.lineWidth = 4;
    c.stroke();
  }

  if (j.dashAktiv) {
    c.beginPath();
    c.moveTo(j.x - j.dashIranyX * sugar * 1.6, j.y - j.dashIranyY * sugar * 1.6);
    c.lineTo(j.x, j.y);
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = sugar * 0.9;
    c.lineCap = 'round';
    c.stroke();
  }

  c.beginPath();
  c.arc(j.x, j.y, sugar, 0, Math.PI * 2);
  c.fillStyle = testSzin;
  c.fill();

  if (j.fejKep) {
    const meret = sugar * FEJ_KEP_SZORZO;
    c.drawImage(j.fejKep, j.x - meret / 2, j.y - meret / 2, meret, meret);
  }
}

const EMOJI_BETUTIPUS = '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif';

function rajzolEgyBoost(b) {
  const def = BOOSTOK[b.tipus];
  c.beginPath();
  c.arc(b.x, b.y, BOOST_SUGAR, 0, Math.PI * 2);
  c.fillStyle = def.szin;
  c.fill();

  c.font = Math.round(BOOST_SUGAR * 1.5) + 'px ' + EMOJI_BETUTIPUS;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(def.ikon, b.x, b.y + 1);

  c.font = '600 12px ui-sans-serif, system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#e8ecf4';
  c.fillText(def.nev, b.x, b.y - BOOST_SUGAR - 6);
}

function rajzolBoostok() {
  for (const b of boostok) rajzolEgyBoost(b);
}

function statusSzoveg(j) {
  const reszek = [];
  if (j.pajzsHatra > 0) reszek.push(BOOSTOK.pajzs.ikon + ' PAJZS');
  if (j.sebessegBoostHatra > 0) reszek.push(BOOSTOK.sebesseg.ikon + ' SEBESSÉG');
  if (j.magnesHatra > 0) reszek.push(BOOSTOK.magnes.ikon + ' MÁGNES');
  if (j.fagyasztvaHatra > 0) reszek.push(BOOSTOK.fagyasztas.ikon + ' FAGYASZTVA');
  if (j.nagyHitboxHatra > 0) reszek.push(BOOSTOK.zsugoritas.ikon + ' NAGYOBB CÉLPONT');
  if (j.nagyLokesKeszen) reszek.push(BOOSTOK.nagylokes.ikon + ' NAGY LÖKÉS KÉSZ');
  if (j.horgony) reszek.push('HORGONY');
  return reszek.join(' · ');
}

function rajzolHud(eltelt) {
  c.textBaseline = 'top';

  c.font = '600 22px ui-sans-serif, system-ui, sans-serif';
  c.textAlign = 'left';
  c.fillStyle = jatekosok[0].szin;
  c.fillText(jatekosok[0].becenev, 20, 16);
  c.font = '400 13px ui-sans-serif, system-ui, sans-serif';
  c.fillStyle = '#8b93a7';
  c.fillText(statusSzoveg(jatekosok[0]), 20, 44);

  c.font = '600 22px ui-sans-serif, system-ui, sans-serif';
  c.textAlign = 'right';
  c.fillStyle = jatekosok[1].szin;
  c.fillText(jatekosok[1].becenev, SZELESSEG - 20, 16);
  c.font = '400 13px ui-sans-serif, system-ui, sans-serif';
  c.fillStyle = '#8b93a7';
  c.fillText(statusSzoveg(jatekosok[1]), SZELESSEG - 20, 44);

  c.font = '600 24px ui-sans-serif, system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillStyle = eltelt >= HIRTELEN_HALAL_KEZDET ? '#ff8080' : '#e8ecf4';
  c.fillText(Math.ceil(Math.max(hatra, 0)) + ' mp', SZELESSEG / 2, 16);
}

function rajzolEsemenyBanner() {
  if (esemenyFazis === 'FIGYELMEZTETES' && kovetkezoEsemenyTipus) {
    const alpha = 0.5 + 0.5 * Math.sin(jelenlegiIdo * 20);
    c.font = '700 20px ui-sans-serif, system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillStyle = `rgba(255,214,102,${alpha.toFixed(2)})`;
    c.fillText('FIGYELEM: ' + ESEMENYEK[kovetkezoEsemenyTipus].nev, SZELESSEG / 2, 46);
    return;
  }

  if (aktivEsemeny && ESEMENYEK[aktivEsemeny.tipus].tartam > 0) {
    c.font = '700 18px ui-sans-serif, system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillStyle = '#ffd666';
    c.fillText(ESEMENYEK[aktivEsemeny.tipus].nev, SZELESSEG / 2, 46);
    return;
  }

  if (aktivEsemeny && aktivEsemeny.tipus === 'zsugorlokes') {
    c.fillStyle = `rgba(255,255,255,${((aktivEsemeny.hatraLevo / FLASH_HATRA) * 0.5).toFixed(2)})`;
    c.fillRect(0, 0, SZELESSEG, MAGASSAG);
  }
}

function sotetedesRajzolas() {
  c.save();
  c.beginPath();
  c.rect(0, 0, SZELESSEG, MAGASSAG);
  for (const j of jatekosok) {
    c.moveTo(j.x + 140, j.y);
    c.arc(j.x, j.y, 140, 0, Math.PI * 2, true);
  }
  c.fillStyle = 'rgba(0,0,0,0.94)';
  c.fill('evenodd');
  c.restore();
}

function rajzolKorVege() {
  c.fillStyle = 'rgba(10,12,16,0.82)';
  c.fillRect(0, 0, SZELESSEG, MAGASSAG);

  const dontetlen = gyoztes == null;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.font = '700 52px ui-sans-serif, system-ui, sans-serif';
  c.fillStyle = dontetlen ? '#e8ecf4' : gyoztes.szin;
  c.fillText(dontetlen ? 'DÖNTETLEN' : gyoztes.becenev + ' NYERT', SZELESSEG / 2, MAGASSAG / 2 - 40);

  c.font = '600 18px ui-sans-serif, system-ui, sans-serif';
  c.fillStyle = '#8b93a7';
  c.fillText('Mindkét kontroller START gombja egyszerre: új kör', SZELESSEG / 2, MAGASSAG / 2 + 20);
}

function rajzolJatek() {
  const eltelt = KOR_HOSSZ - hatra;
  rajzolArena(legutobbiZonaSugar, eltelt);
  rajzolBoostok();
  rajzolJatekos(jatekosok[0]);
  rajzolJatekos(jatekosok[1]);

  if (aktivEsemeny && aktivEsemeny.tipus === 'sotetedes') sotetedesRajzolas();

  rajzolHud(eltelt);
  rajzolEsemenyBanner();

  if (vege) rajzolKorVege();
}

function rajzolVisszaszamlalas() {
  rajzolArena(legutobbiZonaSugar, 0);
  rajzolJatekos(jatekosok[0]);
  rajzolJatekos(jatekosok[1]);

  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.font = '700 72px ui-sans-serif, system-ui, sans-serif';
  c.fillStyle = '#e8ecf4';
  const szam = Math.ceil(visszaszamlalasHatra);
  c.fillText(szam > 0 ? String(szam) : 'RAJT!', SZELESSEG / 2, MAGASSAG / 2 - 10);
}

function rajzolKarakterValasztas() {
  c.fillStyle = '#12141c';
  c.fillRect(0, 0, SZELESSEG, MAGASSAG);

  if (!kepekKeszek) {
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#8b93a7';
    c.font = '600 22px ui-sans-serif, system-ui, sans-serif';
    c.fillText('Fejek betöltése…', SZELESSEG / 2, MAGASSAG / 2);
    return;
  }

  c.strokeStyle = '#2a2f3b';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(SZELESSEG / 2, 0);
  c.lineTo(SZELESSEG / 2, MAGASSAG);
  c.stroke();

  ALAP.forEach((a, i) => {
    const kozepX = i === 0 ? SZELESSEG * 0.25 : SZELESSEG * 0.75;
    const kollega = kollegak[karakterValasztas.index[i]];
    const kep = kollega ? fejKepek.get(kollega.id) : null;

    if (kep) {
      c.drawImage(
        kep,
        kozepX - VALASZTO_FEJ_MERET / 2,
        MAGASSAG / 2 - VALASZTO_FEJ_MERET / 2 - 20,
        VALASZTO_FEJ_MERET,
        VALASZTO_FEJ_MERET,
      );
    }

    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.font = '700 26px ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = a.szin;
    c.fillText(kollega ? kollega.nev : a.alapnev, kozepX, MAGASSAG / 2 + 90);

    c.font = '400 15px ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#8b93a7';
    c.fillText(karakterValasztas.kesz[i] ? 'KÉSZ ✓' : '◄ ► váltás   B: kész', kozepX, MAGASSAG / 2 + 120);
  });
}

function rajzol() {
  if (allapot === 'KARAKTERVALASZTAS') rajzolKarakterValasztas();
  else if (allapot === 'VISSZASZAMLALAS') rajzolVisszaszamlalas();
  else if (allapot === 'JATEK') rajzolJatek();
}

// ----------------------------------------------------------------- ciklus

let utolso = performance.now();
function kepkocka(most) {
  requestAnimationFrame(kepkocka);
  let dt = (most - utolso) / 1000;
  utolso = most;
  if (dt > 0.25) dt = 0.25;
  lepes(dt);
  rajzol();
}

// ---------------------------------------------------------------- indulas

pads.init({ slots: 2, keyboard: false });
betoltKepek();
requestAnimationFrame(kepkocka);

window.jatek = {
  get allapot() { return allapot; },
  get jatekosok() { return jatekosok; },
  get hatra() { return hatra; },
  get vege() { return vege; },
  get gyoztes() { return gyoztes; },
  get aktivEsemeny() { return aktivEsemeny; },
  get boostok() { return boostok; },
  visszaszamlalasIndit,
};

padGate({
  players: 2,
  title: 'LÖKDÖSŐ ARÉNA',
  subtitle: 'Dugd be a két USB kontrollert, és nyomj meg rajtuk egy gombot.',
  onClose: () => {
    pads.keyboard(true);
    nyomva.clear();
  },
});
