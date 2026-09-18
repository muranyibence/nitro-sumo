# Lökdöső Aréna — specifikáció

> Munkacím. A koncepció, az állapotgép, az összes timing-szám, az
> esemény- és boost-lista véglegesítve. Ez a dokumentum az, amit
> implementációba viszünk át; ha közben módosul valami, ezt a fájlt
> frissítsük, ne csak a kódot.

## Koncepció egy mondatban

Két korong (a kiválasztott kollégafejjel) egy zsugorodó körarénában
lökdösi egymást; aki leesik a pályáról, veszít, és ha senki nem esik le,
a zsugorodás garantáltan eldönti a kört 60 másodpercen belül.

## Irányítás

A meglévő `up down left right  b a y x  l r  select start` gombnevekre
épül (`gamepad.js`), új jelentéssel:

| Pad gomb | Szerep |
|---|---|
| D-pad (`up/down/left/right`) | Mozgás |
| `b` | **Lökés/dash** — rövid, erős lendület előre, cooldown-nal |
| `a` | **Horgony/blokk** — amíg nyomva tartod, nem mozogsz, de nehezebb ellökni |
| `start` | Kör újraindítása a végén (mindkét kontrolleren, ahogy eddig is) |

`y`, `x`, `l`, `r` nincs kiosztva ehhez a mechanikához — marad szabad, ha
később kell (pl. hangjelzés/extra akció).

## Állapotgép

| Fázis | Mit csinál | Kilépés |
|---|---|---|
| **PAD_GATE** | Meglévő `pad-gate.js`, változatlan. | Mindkét pad START-ot nyomva tart. |
| **KARAKTERVÁLASZTÁS** | Lásd lent. | Mindkét játékos megerősíti a fejét. |
| **VISSZASZÁMLÁLÁS** | 3-2-1, mindkét korong rögzítve a kezdőponton, aréna teljes méret. ~2 mp. | Lejár az idő. |
| **JÁTÉK** | Fő logika: mozgás, dash, horgony, zsugorodás, esemény/boost spawn, 60 mp-es óra. | Valaki leesik / lejár az idő / hirtelen halál eldönt. |
| **KÖR VÉGE** | Győztes kiírás, "mindkét START új körhöz". | Mindkét pad START-ot nyom 0,5 mp-en belül. |

Kör vége → **VISSZASZÁMLÁLÁS** (a karakterválasztást nem ismételjük meg
körönként — ha ez kell, külön kérésre bővíthető).

## Karakterválasztás

- A pad-gate után egy roszter-képernyő: mindkét játékos **egymástól
  függetlenül** lapoz a kollégák listáján D-paddel (`left`/`right`),
  `b`-vel megerősít.
- A képen a **teljes név** és a fej látszik nagyban (karakterválasztó
  szabály az `AGENTS.md` szerint); a játék közbeni HUD-on a **becenév**
  jelenik meg.
- Ha véletlenül mindketten ugyanazt választják: engedett, két egyforma
  fejjel is lehet játszani (nincs ütközés-tiltás — kevesebb szabály,
  kevesebb hiba a bemutatón).
- Adatforrás: `starter/img/kollegak.json` + `starter/img/<id>.png`
  (letöltve, lokális fájlok, szerver-cím nincs a kódban).

## Aréna és zsugorodás

- Kör alakú aréna, középpont a canvas közepén (`480, 270` a 960×540-es
  vászonhoz).
- Kezdő sugár **R0 = 260 px**.
- Folyamatos zsugorodás **t=0**-tól **t=52 mp**-ig, lineárisan
  `R0`-ról **Rmin = 70 px**-re (ennyi már csak egy 26 px sugarú korongnak
  elég kényelmesen, kettőnek nem).
- **Hirtelen halál**: ha **t=55 mp**-nél még nem dőlt el semmi, 3 mp
  alatt (t=55→58) tovább zsugorodik **Rmin2 = 20 px**-re — ez a
  brainstormban említett "zsugorodás-löket", itt a garantált végjátékra.
- **Kemény határidő t=60 mp**: ha ezután is mindketten állnak (a fenti
  méret mellett ez valós esély szerint nem történhet meg), a **pálya
  közepéhez közelebbi** játékos nyer; egyenlő távolságnál a zóna azonnal
  0-ra ugrik (azonnali eldöntés, nincs második hirtelen halál kör).
- Vizuális jelzés: a határ színe/pulzálása jelezze a fázist — nyugodt
  kék-fehér pulzálás normál zsugorodás alatt, élénk piros gyors pulzálás
  a hirtelen halál 3 mp-ében.

## Lökés (dash) és horgony (blokk)

Alapsebesség **V0 = 300 px/mp**, korong sugara **26 px**.

| Paraméter | Érték |
|---|---|
| Dash sebesség | V0 × 3.5 (~840 px/mp) |
| Dash időtartam | 0.18 mp |
| Dash cooldown | 1.2 mp (a dash vége után indul) |
| Dash közben irányváltás | nincs — a dash pillanatában rögzített irány tart ki |
| Horgony alatt mozgás | 0 (nem lehet mozogni) |
| Horgony tömegszorzó | ×3 (ellökési impulzus rá ×3-mal osztva) |
| Horgony max. folytonos tartás | 1.5 mp, utána automatikusan kikapcsol |
| Horgony újra-aktiválás cooldown | 1 mp a kikapcsolás után |

**Ütközés-fizika:** a két korong körbe ütközik; átfedésnél szétválasztás
a normálvektor mentén, és impulzus mindkettőre a relatív sebesség és a
tömegszorzók alapján. Ha az egyik dash-ben van, az ő impulzusa extra
×1.8-cal erősebb (ez adja a "lökés" élét, nem csak egy finom
egymáshoz-érés).

## Random események

Új esemény **13 mp** (±2 mp jitter) gyakorisággal, **2 mp figyelmeztető
villanással/felirattal** a kezdete előtt. Nem jöhet kétszer egymás után
ugyanaz.

| Esemény | Hatás | Tartam |
|---|---|---|
| **Turbó** | Mindkét játékos sebessége ×1.6 | 6 mp |
| **Zavar** | Egy véletlenül kisorsolt játékos D-padja megfordul (fel↔le, bal↔jobb) | 5 mp |
| **Csúszás** | Mozgás megcsúszik: gyorsulás/lassulás helyett tehetetlenség (jégpálya-érzés) | 7 mp |
| **Sötétedés** | A vászon elsötétül, csak egy ~140 px sugarú kör látszik mindkét játékos körül | 8 mp |
| **Sodrás** | Konstans "szél"-erő egy véletlen irányból, mindkét játékost lassan tolja | 6 mp |
| **Zsugorodás-löket** | Azonnali, egyszeri –40 px sugár az arénán (nincs saját tartama) | pillanat |

## Boostok (powerupok)

Egyszerre **max 1** boost van a pályán; felvétel után **8 mp** cooldown
az újraspawnig, véletlen pozíció az aktuális (zsugorodott) körön belül.

| Boost | Hatás | Tartam |
|---|---|---|
| **Sebesség** | +50% mozgássebesség | 5 mp |
| **Pajzs** | Immunitás lökésre (nincs knockback, dash-nek nekifutva sem) | 4 mp |
| **Nagy lökés** | A következő dash ereje ×2.5, amíg el nem használja | 1 felhasználásig |
| **Mágnes** | Az ellenfelet folyamatos, gyenge erővel magad felé húzza | 3 mp |
| **Fagyasztás** | Felvétel pillanatában az **ellenfél** nem mozoghat/dash-elhet | 1.2 mp |
| **Zsugorítás** | Felvétel pillanatában az **ellenfél** hitboxa nő (könnyebb eltalálni) | 6 mp |

Fagyasztás és Zsugorítás azonnal az ellenfélre hat felvételkor (nincs
"eltárolt" használat), a többi a felvevőre, azonnal aktiválódik.

## Győzelem és restart

1. **Elsődleges:** aki középpontja a zóna sugarán kívülre kerül →
   azonnali vereség, a másik nyer, kör lezárva.
2. **Tartalék (t=60 mp, ha még mindig áll mindkettő):** a zóna
   közepéhez közelebbi játékos nyer; egyenlő távolság → azonnali 0-ra
   ugró zóna dönt.
3. **Restart:** mindkét kontroller START gombja **0.5 mp-en belül**
   lenyomva → **VISSZASZÁMLÁLÁS**, nincs lap-újratöltés, a
   karakterválasztás marad az előző kör választása.

## Vizuális jelölés (szín-kód, "gyors, letisztult" irány)

A test egy egyszerű, színes korong a kollégafejjel — az állapotot a
korong színe/aurája jelzi, nem külön ikon:

| Állapot | Jelzés |
|---|---|
| Alap | Játékos saját színe (P1 kék, P2 piros — mint most) |
| Dash aktív | Élénk fehér "csík" a mozgás irányában, 0.18 mp |
| Horgony aktív | Szürkés/fémes árnyalat a korongon |
| Pajzs | Világos glow-gyűrű a korong körül |
| Fagyasztva | Kék-fehér, statikus (nincs animáció rajta) |
| Zsugorítva (nagyobb hitbox) | Korong mérete vizuálisan is nő |
| Esemény-figyelmeztetés | Képernyő szélén rövid villanás + felirat a névvel |

## Ütközések visszajelzése

- Az ütközés helyén 10–32 arany-fehér szikra és egy táguló fénygyűrű jelenik meg; erősebb lökés több szikrát ad.
- Rövid, lecsengő képernyőrázás: 3–10 px, legfeljebb 0,23 mp. Csak a pálya mozog, a feliratok stabilak; csökkentett mozgás beállításnál nincs rázás.
- Rövid, szintetizált puffanás, nagyobb lökésnél mélyebb és erősebb hang. A hang billentyűleütéssel vagy a „Hang bekapcsolása” gombbal engedélyezhető, ugyanott némítható; kontrollerhez egérkattintás szükséges lehet.
- Az effektek között minimum 0,1 mp telik el. A szikrák 0,2–0,45 mp, a fénygyűrű 0,22 mp alatt eltűnik; új körben minden vizuális effekt törlődik.
- Az effektek nem módosítják az ütközés erejét, az irányítást vagy a kör idejét.
- Dash közben 0,045 mp-enként halvány fej- és korongmásolat marad a játékos mögött; 0,18 mp alatt eltűnik, két játékosnál összesen legfeljebb 8 másolat látszik. A másolatok az eredeti pozíciójukon maradnak, a játékosok alatt rajzolódnak.
- Ütközéskor 35–60% eséllyel (lökéserő szerint) elágazó, meleg fényű repedések jelennek meg a talajon. 0,9 mp után eltűnnek, két repedés keletkezése között legalább 0,65 mp telik el. Az aktuális arénahatáron kívül nem látszanak; csak vizuálisak. Új körben a repedések és a dash-másolatok is törlődnek.

## MVP a 2 órás határidőhöz

A három kemény feltétel (két kontroller, 1 percen belüli döntés,
újraindítható lap-reload nélkül) már az alapmechanikával + zsugorodással
teljesül. Ha az idő szűkül, ebben a sorrendben vágható:

1. **Első kör kötelező:** mozgás, dash, horgony, zsugorodó aréna,
   leesés = vereség, 60 mp hirtelen halál, restart.
2. **Második kör (ha van idő):** 2-3 random esemény (Turbó, Zavar,
   Sötétedés — ezek adják a legtöbb "cirkuszt" kevés kódért), 2-3 boost
   (Pajzs, Nagy lökés, Fagyasztás).
3. **Ha még marad idő:** teljes esemény- és boost-lista, karakterválasztó
   képernyő a kollégafejekkel.
4. **Kollégafejek nélkül is teljes játék:** ha a képválasztó nem fér be
   időben, a korongok maradhatnak sima színes körök — a mechanika ettől
   függetlenül működik.
