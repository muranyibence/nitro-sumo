/**
 * NYITÓKÉPERNYŐ: karakterválasztás.
 *
 * A pad-gate.js (kontroller-kapu) után ez a képernyő fut, amíg mindkét
 * játékos ki nem választja a kollégafejét. Ha nincs letöltve kollégafej-lista
 * (starter/img/kollegak.json), automatikusan kihagyja magát: a jatek.js akkor
 * sima színes korongokkal indít.
 *
 * A jatek.js hívja: nyitoLepes()/nyitoRajzol() minden kepkockan, amíg az
 * allapot 'KARAKTERVALASZTAS'; amikor nyitoKeszAll() igazzal ter vissza, a
 * jatek.js lekeri nyitoValasztottak()-kal a vegleges valasztast, es tovabblep.
 */

const VALASZTO_FEJ_MERET = 180;

let kollegak = [];
const fejKepek = new Map(); // id -> HTMLImageElement
let kepekKeszek = false;

async function betoltKepek() {
  try {
    const res = await fetch('img/kollegak.json');
    const adat = await res.json();
    kollegak = adat.kollegak ?? [];
    if (kollegak.length > 1) valasztas.index[1] = 1;
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

const valasztas = { index: [0, 0], kesz: [false, false], inditasKesz: 0 };

betoltKepek();

/** profilok: az ALAP tömb a jatek.js-ből, [{ szin, keys, alapnev }, ...]. */
export function nyitoLepes(dt, profilok, frissenLenyomva) {
  if (!kepekKeszek || kollegak.length === 0) return;

  profilok.forEach((_, i) => {
    if (valasztas.kesz[i]) return;
    const keys = profilok[i].keys;
    if (frissenLenyomva(keys.left)) {
      valasztas.index[i] = (valasztas.index[i] - 1 + kollegak.length) % kollegak.length;
    }
    if (frissenLenyomva(keys.right)) {
      valasztas.index[i] = (valasztas.index[i] + 1) % kollegak.length;
    }
    if (frissenLenyomva(keys.b)) valasztas.kesz[i] = true;
  });

  if (valasztas.kesz[0] && valasztas.kesz[1]) valasztas.inditasKesz += dt;
}

/** Igaz, amint a jatek.js tovabbleptethet a visszaszamlalasra. */
export function nyitoKeszAll() {
  return kepekKeszek && (kollegak.length === 0 || valasztas.inditasKesz >= 0.6);
}

/** A vegleges valasztas: [{ nev, becenev, fejKep }, ...], profilonkent egy. */
export function nyitoValasztottak(profilok) {
  return profilok.map((a, i) => {
    const k = kollegak[valasztas.index[i]];
    return {
      nev: k ? k.nev : a.alapnev,
      becenev: k ? k.becenev : a.alapnev,
      fejKep: k ? fejKepek.get(k.id) : null,
    };
  });
}

/** A ket kivalasztotton kivul MINDENKI, aki a nevsorban van: { becenev, fejKep }[]. */
export function nyitoSzurkolok() {
  const valasztottIndexek = new Set(valasztas.index);
  return kollegak
    .filter((_, i) => !valasztottIndexek.has(i))
    .map((k) => ({ becenev: k.becenev, fejKep: fejKepek.get(k.id) }));
}

export function nyitoRajzol(c, szelesseg, magassag, profilok) {
  c.fillStyle = '#12141c';
  c.fillRect(0, 0, szelesseg, magassag);

  if (!kepekKeszek) {
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#8b93a7';
    c.font = '600 22px ui-sans-serif, system-ui, sans-serif';
    c.fillText('Fejek betöltése…', szelesseg / 2, magassag / 2);
    return;
  }

  c.strokeStyle = '#2a2f3b';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(szelesseg / 2, 0);
  c.lineTo(szelesseg / 2, magassag);
  c.stroke();

  profilok.forEach((a, i) => {
    const kozepX = i === 0 ? szelesseg * 0.25 : szelesseg * 0.75;
    const kollega = kollegak[valasztas.index[i]];
    const kep = kollega ? fejKepek.get(kollega.id) : null;

    if (kep) {
      c.drawImage(
        kep,
        kozepX - VALASZTO_FEJ_MERET / 2,
        magassag / 2 - VALASZTO_FEJ_MERET / 2 - 20,
        VALASZTO_FEJ_MERET,
        VALASZTO_FEJ_MERET,
      );
    }

    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.font = '700 26px ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = a.szin;
    c.fillText(kollega ? kollega.nev : a.alapnev, kozepX, magassag / 2 + 90);

    c.font = '400 15px ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#8b93a7';
    c.fillText(valasztas.kesz[i] ? 'KÉSZ ✓' : '◄ ► váltás   B: kész', kozepX, magassag / 2 + 120);
  });
}
