---
name: snes-kontroller
description: Két USB SNES gamepad bekötése böngészős játékba. Használd, amikor a játékot USB kontrollerrel, gamepaddel, joystickkal vagy két játékos fizikai kontrollerével kell irányítani, vagy amikor a billentyűzetes irányítást padre kell átkötni. Gamepad API, kontroller mapping, gombkiosztás, kezdőképernyő, joy-it SBC-Gamepad-SNES. Two USB SNES gamepads for browser games.
---

# Két USB SNES kontroller bekötése

## A lényeg

**A játékot billentyűzetes kétjátékos játékként kell megírni. A kontroller
magától működni fog.**

A könyvtár valódi `keydown` és `keyup` eseményt küld a lapnak, tehát a játék
kódja nem tud a kontrollerről, és nem is kell tudnia. Ebből következik, hogy
**mindegy, milyen technológia**: vanilla JS, React, Phaser, Three.js, p5.

Két kész fájl van a csomagban. Ezeket **másold be a projektbe, ne írd újra**:

| Fájl | Mire való |
|---|---|
| `gamepad.js` | A könyvtár. Padolvasás, eszközprofil, billentyű-emuláció, kalibrálás. |
| `pad-gate.js` | Kezdőképernyő: megvárja a kontrollereket, és kipróbálhatóvá teszi a gombjaikat. |

## Bekötés

```js
import { pads } from './gamepad.js';
import { padGate } from './pad-gate.js';

// A kapu alatt MEG NEM kuldunk billentyut: kulonben az a gombnyomas, amivel
// a jatekos kivalasztja magat, mar a jatekba szolna bele.
pads.init({ slots: 2, keyboard: false });

padGate({
  players: 2,
  title: 'A JÁTÉK NEVE',
  onClose: () => { pads.keyboard(true); },   // innentol mennek a billentyuk
});
```

Ennyi. A játék többi része sima billentyűkezelés:

```js
const nyomva = new Set();
document.addEventListener('keydown', (e) => nyomva.add(e.code));
document.addEventListener('keyup', (e) => nyomva.delete(e.code));
window.addEventListener('blur', () => nyomva.clear());   // ne ragadjon be

if (nyomva.has('KeyA')) jatekos1.x -= 2;      // 1. pad: balra
if (nyomva.has('ArrowLeft')) jatekos2.x -= 2; // 2. pad: balra
```

## A billentyűkiosztás

Az 1. pad a billentyűzet **bal** oldalát kapja, a 2. a **jobb** oldalt. Ez a
két klasszikus kétjátékos kiosztás. Minden billentyű lenyomható egy sima
laptop billentyűzeten is, tehát kontroller nélkül is tesztelhető a játék.

| Pad gomb | 1. kontroller | 2. kontroller |
|---|---|---|
| ↑ | `KeyW` | `ArrowUp` |
| ↓ | `KeyS` | `ArrowDown` |
| ← | `KeyA` | `ArrowLeft` |
| → | `KeyD` | `ArrowRight` |
| B | `KeyG` | `KeyK` |
| A | `KeyH` | `KeyL` |
| Y | `KeyF` | `KeyJ` |
| X | `KeyT` | `KeyI` |
| L váll | `KeyQ` | `KeyU` |
| R váll | `KeyE` | `KeyO` |
| SELECT | `KeyC` | `Enter` |
| START | `KeyV` | `Space` |

A négy arcgomb mindkét padnél gyémánt alakban ül a billentyűzeten, ahogy a
paden is, a két vállgomb pedig az irányok fölött:

```
   1. pad (bal kéz)              2. pad (jobb kéz)
     Q  W  E   = L ↑ R             U  ↑  O   = L ↑ R
     A  S  D   = ← ↓ →             ←  ↓  →
        T                             I
      F   H    = X, Y és A         J   L
        G                             K
     C  V      = SELECT START      ENTER SPACE
```

**A két pad START gombja két különböző billentyű.** Ha bármelyik pad
indíthasson, mindkettőt figyeld: `KeyV` és `Space`.

Más kiosztás kell? Egy táblázatot kell átírni, nem a kódot:

```js
pads.setKeys([
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', b: 'Space', /* ... */ },
  { up: 'ArrowUp', /* ... */ },
]);
```

## Kezdőképernyő

A `pad-gate.js` teljes képernyős DOM-átfedés, tehát mindegy, hogy a játék
canvasra, DOM-ba vagy WebGL-be rajzol: a háttérben sötétítve látszik.

- kiírja, hány pad van bedugva és mit lát belőlük a böngésző,
- gombnyomással eldönti, melyik pad melyik játékosé,
- kirajzolja mindkét padet: az **éppen nyomott gomb élénkzöld**, a **már
  kipróbált halványzöld**, és számolja, hány van meg a 12-ből,
- a játékot a **START nyomva tartása** indítja. Így a második játékost
  kiválasztó gombnyomás nem indítja el rögtön a játékot, és a START is
  végigpróbálható gomb marad.

Beállítások: `players`, `title`, `subtitle`, `onStart`, `onClose`,
`allowKeyboard`.

## Ha közvetlenül akarod olvasni a padet

Ez a második út, csak akkor kell, ha konkrét padgombra van szükséged
billentyű helyett:

```js
pads.init({ slots: 2 });          // keyboard nelkul

function frame() {
  pads.poll();                     // a kepkocka ELEJEN, egyszer
  if (pads.down(0, 'left')) jatekos1.x -= 2;
  if (pads.pressed(0, 'b')) jatekos1.ugras();
  if (pads.anyPressed('start')) szunet();
  requestAnimationFrame(frame);
}
```

- `pads.down(slot, gomb)` - éppen le van-e nyomva
- `pads.pressed(slot, gomb)` / `released(slot, gomb)` - él, az előző `poll()` óta
- `pads.anyDown(gomb)` / `anyPressed(gomb)` - bármelyik játékos
- `pads.onButton((slot, gomb, le) => ...)` - eseményfigyelő, sosem hagy ki nyomást

Gombnevek: `up down left right  b a y x  l r  select start`

**Soha ne használd a kettőt egyszerre ugyanarra a bemenetre**, mert akkor
minden gombnyomás kétszer érkezik be.

## Buktatók

| Tünet | Ok |
|---|---|
| `getGamepads()` csupa `null`, pedig be van dugva | Még nem nyomtak rajta gombot. Ujjlenyomat-védelem, nem kerülhető meg. Ezért van a kezdőképernyő. |
| Néma, üres lap | ES modult a böngésző nem tölt be `file://` címről. Kell egy helyi kiszolgáló. |
| A pad megvan, de semmi nem reagál | Nincs `pads.keyboard(true)`, vagy a fül háttérben van. |
| Minden gomb kétszer sül el | Az emuláció és a közvetlen olvasás egyszerre fut. |
| Egy irány lenyomva ragad | A saját billentyűkezelésed nem ürül `blur`-re. |
| Rossz gomb sül el | Nem a várt pad van bedugva. Lásd: kalibrálás. |

**Háttérben lévő fülön a `requestAnimationFrame` teljesen leáll**, nem csak
lassul. A könyvtár ezt kezeli: elenged mindent, és visszatéréskor újraindul.

## Ha a motorod a saját canvasán figyel

Alapból oda megy az esemény, ahova egy valódi billentyűé is: a fókuszált
elemre, fókusz híján a `body`-ra, és onnan felbuborékol a `document`-en át a
`window`-ig. Ha a motorod fókusz nélkül figyel egy elemen:

```js
pads.init({ keyboard: true, keyTarget: document.getElementById('canvas') });
```

## Ismeretlen pad: kalibrálás

A várt eszköz kiosztása be van építve, tehát alapból nem kell semmit tenni. Ha
mégis rossz gomb sül el, a kalibrálás végigkérdezi a 12 gombot, és
eszközazonosítóhoz kötve elmenti:

```js
pads.calibrate(0, (i, gomb) => kiir(gomb), (profil) => console.log(profil));
```

A bemért értékek a beépített tábla **fölé** kerülnek, nem a helyére: egy
félbehagyott bemérés nem tesz némává gombokat.

## Rezgés

**Ez a pad nem tud rezegni**, nincs benne motor. A könyvtár tud rezgetni azon,
ami képes rá, és **csendben nem csinál semmit** a többin, tehát a játék kódját
nem kell elágaztatni:

```js
pads.rumble(slot, { duration: 180, strong: 0.9, weak: 0.4 });
```

`pads.canRumble(slot)`, `pads.stopRumble(slot)`, `pads.capabilities(slot)`.

## Ellenőrzés

`node selftest.mjs` - a könyvtár 76 önellenőrzése hamis padekkel, böngésző
nélkül. Ha ez elhasal, a `gamepad.js` sérült.

Mély részletek, bemért HID adatok: `reference/hardware.md`
