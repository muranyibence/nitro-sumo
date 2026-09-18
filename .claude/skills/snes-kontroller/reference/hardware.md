# A hardver és amit a böngésző lát belőle

## Az eszköz

A joy-it **SBC-Gamepad-SNES** (Simac Electronics) egy SNES formájú, generikus
USB HID gamepad. Windows a következőképp azonosítja:

```
HID-compliant game controller     HID\VID_081F&PID_E401\...
```

- **VID `081f`** - Padix Co., Ltd. (Rockfire)
- **PID `e401`** - a klasszikus, sokfelé újracímkézett SNES-pad chip

Ugyanez a chip van rengeteg más, olcsó "retro USB gamepad" mögött, tehát az itt
leírtak nem csak erre az egy termékre igazak.

Windowson így lehet megnézni, mi van bedugva:

```powershell
Get-PnpDevice -PresentOnly | Where-Object { $_.FriendlyName -match 'game controller' } | Format-List Status,FriendlyName,InstanceId
```

Linuxon `lsusb`, macOS-en `system_profiler SPUSBDataType`.

## Amit a böngésző ad

A pad **nem XInput-eszköz**, tehát a Gamepad API nem tudja szabványos alakra
hozni. Chrome-ban ez így néz ki:

```js
{
  id: "usb gamepad           (Vendor: 081f Product: e401)",
  mapping: "",          // <- ÜRES: nem szabványos kiosztás
  buttons: [ ... ],     // nyers sorszámok, jelentés nélkül
  axes:    [ ... ],     // az iránykereszt az első két tengelyen
}
```

A `mapping: "standard"` esetén (Xbox, PlayStation) a W3C rögzíti, melyik index
melyik gomb. Itt ez nincs meg, ezért kell eszközazonosítóhoz kötött profil.

### A 081f:e401 kiosztása

A böngésző **2 tengelyt és 10 gombot** lát rajta, hat switch nélkül.

| Gomb | Gombindex |
|---|---|
| X | 0 |
| A | 1 |
| B | 2 |
| Y | 3 |
| L | 4 |
| R | 5 |
| SELECT | 8 |
| START | 9 |

A 6-os és 7-es index nincs bekötve.

Az iránykereszt **nem gomb, hanem tengely**:

| Irány | Tengely | Érték |
|---|---|---|
| bal / jobb | `axes[0]` | -1 / +1 |
| fel / le | `axes[1]` | -1 / +1 |

Nyugalomban a tengely nem pontosan 0, hanem `-0.00392` (vagyis -1/255): a 8 bites
nyers érték középállása nem esik egybe a lebegőpontos nullával. A `gamepad.js`
0.5-ös küszöböt használ, tehát ez a zaj nem számít.

### Hat switch (POV-kapcsoló)

Sok más olcsó pad az iránykeresztet **egyetlen tengelyen**, nyolcirányú
kapcsolóként adja. Ilyenkor a nyugalmi érték 1-nél nagyobb, Chrome-ban tipikusan
`3.2857142857142856`. A nyolc irány `-1` és `+1` között oszlik el:

| Érték | Irány |
|---|---|
| -1.000 | fel |
| -0.714 | fel-jobb |
| -0.429 | jobb |
| -0.143 | jobb-le |
| 0.143 | le |
| 0.429 | le-bal |
| 0.714 | bal |
| 1.000 | bal-fel |
| > 1.05 | középállás |

A `decodeHat()` ezt fordítja vissza. A kalibrálás felismeri, hogy hat-tengelyről
van szó: ha a nyugalmi érték 1-nél nagyobb, `axes.hat`-ként menti el.

## Rezgés és egyéb kimenetek

**A 081f:e401 nem tud rezegni.** Ez nem tippelés: a Windows HID rétegétől
lekérdezett report-leíró mondja meg.

| Report | Méret | Tartalom |
|---|---|---|
| INPUT | 9 bájt | 10 gomb (Button usage page, `0x01`-`0x0A`) és 2 tengely |
| OUTPUT | 8 bájt | 1 érték-cap, **UsagePage `0xFF00`** (gyártóspecifikus), logikai tartomány `0..0` |
| FEATURE | 0 bájt | nincs |

Az OUTPUT report létezik, de két okból használhatatlan. Egy: nem a szabványos
force feedback lapon van (`0x0F`, PID), hanem a gyártóspecifikus `0xFF00`-n,
tehát semmilyen szabvány nem mondja meg, mit jelentenek a bájtjai. Kettő: a
logikai tartománya `0..0`, vagyis a leíró szerint semmilyen értéket nem lehet
benne átadni. Ez a chip általános leírójából maradt bent, nem valódi képesség.

Ettől függetlenül a böngésző sem adna hozzá hozzáférést: Chrome csak azoknál
az eszközöknél hoz létre `vibrationActuator`-t, amikhez ismeri a rezgetés
protokollját (XInput-eszközök, DualShock 4, DualSense, Switch Pro). Egy
általános DirectInput HID padnél a `gamepad.vibrationActuator` `undefined`.

### Amit a Gamepad API egyáltalán adhat egy padről

A gombokon és tengelyeken kívül ennyi van, se több, se kevesebb:

| Mező | Mire jó | Van a 081f:e401-en? |
|---|---|---|
| `vibrationActuator` | rezgés (`dual-rumble`, `trigger-rumble`) | nincs |
| `hapticActuators` | régi, elavult rezgés-tömb | nincs |
| `touchEvents` | érintőfelület (DualShock, DualSense) | nincs |
| `pose`, `hand` | térbeli helyzet, VR-kontrollereknél | nincs |
| `buttons[i].value` | analóg ravasz, 0..1 | nincs, minden gomb 0 vagy 1 |
| `buttons[i].touched` | érintés lenyomás nélkül | nincs |
| `axes` | analóg karok | 2 tengely, de csak `-1 / 0 / +1` |
| `mapping` | szabványos kiosztás-e | üres, tehát nem |
| `timestamp` | mikor frissült az állapot | van |

**Nincs benne** LED, hangszóró, giroszkóp, gyorsulásmérő, akkumulátor-szint és
mikrofon. A Gamepad API ilyet nem is ad: ezekhez a DualSense-nél is a WebHID
kell.

A `pads.capabilities(slot)` pontosan ezt kérdezi le futásidőben, a csomag
`kontroller-teszt.html` fájlja pedig ki is írja minden bedugott padre.

### Ha valakinek mégis rezgő padje lesz

A `pads.rumble(slot, { duration, strong, weak })` működik minden olyan paden,
amit a böngésző rezgetni tud, és **csendben nem csinál semmit** azokon, amiket
nem. A játék kódját tehát nem kell elágaztatni:

```js
if (talalat) pads.rumble(slot, { duration: 180, strong: 0.9, weak: 0.4 });
```

`pads.canRumble(slot)` mondja meg, van-e egyáltalán, `pads.stopRumble(slot)`
azonnal leállítja.

## A gombnyomás-követelmény

Chrome (és Safari) **addig nem adja oda a padet, amíg meg nem nyomnak rajta egy
gombot** a fókuszált lapon. Ez ujjlenyomat-védelem: enélkül minden weboldal
végig tudná olvasni, milyen eszközök vannak a gépen.

Következmények:

- Betöltéskor `navigator.getGamepads()` csupa `null`, akkor is, ha minden be van dugva.
- A `gamepadconnected` esemény sem sül el a gombnyomásig.
- **Nem lehet megkerülni.** A töltőképernyő nem kényelmi funkció, hanem ez a
  megoldás rá: az első gombnyomás egyben a felismerés is.

Firefox nem kér gombnyomást, ott azonnal látszanak.

## Rejtett lap

Ha a lap háttérbe kerül, a `requestAnimationFrame` **teljesen leáll** (nem lassul,
hanem áll). Ha ekkor épp nyomva volt egy gomb, az örökre lenyomva ragadna.

A `gamepad.js` a `visibilitychange` és a `blur` eseményre is elenged mindent, és
visszatéréskor újraindítja a ciklust. Ha saját billentyűkezelésed van, ott is
kell egy `window.addEventListener('blur', () => lenyomottak.clear())`.

## Két egyforma pad

Két azonos kontrollernél a `gamepad.id` betűre ugyanaz. Megkülönböztetni csak
`gamepad.index` szerint lehet, az viszont az USB-felismerés sorrendjétől függ,
nem attól, ki melyiket fogja a kezében.

Ezért a `pads.claim(slot)`: a hívás után az első pad, amin gombot nyomnak, kerül
az adott helyre. A töltőképernyő sorban végigkérdezi a játékosokat.

Ha valaki kihúz egy padet, a `gamepad.index` újraosztódhat. A `gamepad.js` a
kiesett helyet kiüríti, és ha az 1. hely marad üresen, előre tömöríti a
megmaradt padet, hogy ne legyen "senki az 1. játékos" állapot. Két meglévő padet
viszont sosem cserél fel magától.

## Biztonságos környezet

A Gamepad API secure contextet kér:

| Cím | Működik |
|---|---|
| `https://...` | igen |
| `http://localhost:...` | igen |
| `file:///...` | igen |
| `http://192.168.x.x:...` | **nem** |

Ha a játékot másik gépről nyitják meg a helyi hálózaton, kell egy HTTPS-t adó
tunnel, vagy a böngésző `--unsafely-treat-insecure-origin-as-secure` kapcsolója.

## Ha OS szintű átkötés kell

Ez a skill **böngészőn belül** köti át a padet billentyűre, tehát csak a saját
lapján hat. Ha egy natív programnak kellene billentyűzetnek látszania a pad, az
más eszköz dolga (Windowson AntiMicroX vagy Xpadder, Linuxon `antimicrox`,
`qjoypad`). Böngészős játékhoz erre nincs szükség, és nem is ajánlott: telepítést
igényel, és minden gépen külön be kell állítani.
