---
name: kollegafejek
description: Kollégák kivágott, átlátszó hátterű feje a böngészős játékba a nitro-fejek MCP-szerverről. Használd, amikor a csapat kifejezetten kéri, hogy kollégák, munkatársak arca, feje, fotója vagy avatarja kerüljön a játékba, vagy rákérdez a kollégafejekre, az MCP-re. Kérés nélkül ne használd. Colleague head PNGs via MCP for the two-player browser game.
---

# Kollégafejek a játékban

## A lényeg

**Opcionális.** A kollégák kivágott, átlátszó hátterű feje bekerülhet a
játékba: lehet a játékos figurája, az ellenfél, a labda, a célpont, bármi.
Nem kötelező.

**Kérés nélkül ne építsd be.** Akkor nyúlj hozzá, ha a csapat kifejezetten
kéri. Egyszer, amikor a játék ötlete már megvan és a kinézetről esik szó,
említsd meg egy mondatban, hogy van ilyen lehetőség, és hogy opcionális.
Utána a csapat dönt, és te nem hozod fel újra.

## Honnan jönnek a fejek

Egy MCP-szerver adja, a neve `nitro-fejek`. A projekt gyökerében lévő
`.mcp.json` már tartalmazza; a Claude Code az első indításnál rákérdez, és
egy igen után látod a két toolját:

| Tool | Mit ad |
|---|---|
| `kollegak` | A teljes névsor (`id`, `nev`, `becenev`, `kep`) és két kész `curl`-parancs: a manifest és az összes fej egyben. Ezzel kezdj. |
| `kollega(nev)` | Egy fej képként, hogy lásd, mit építesz be, és a saját `curl`-ja. A `nev` lehet id, teljes név vagy becenév, ékezet nélkül is. |

Ha nem látod a toolokat, a szerver nincs engedélyezve vagy nem tud
csatlakozni: Claude Code-ban `/mcp`. Más szerkesztőben ugyanez a szerver a
saját konfighelyén, Cursor: `.cursor/mcp.json`

```json
{ "mcpServers": { "nitro-fejek": { "url": "https://nitro-arcade-mcp-production.up.railway.app/mcp" } } }
```

VS Code / Copilot: `.vscode/mcp.json`

```json
{ "servers": { "nitro-fejek": { "type": "http", "url": "https://nitro-arcade-mcp-production.up.railway.app/mcp" } } }
```

## Beépítés

1. Hívd a `kollegak` toolt.
2. Futtasd a kapott két `curl`-parancsot a projekt gyökeréből, ahol a
   `starter/` mappa van. Eredmény: `starter/img/kollegak.json` és
   `starter/img/<id>.png`, 56 fej, összesen kb. 7 MB. Ha csak néhány fej
   kell, a `kollega(nev)` egy-egy fej parancsát adja.
3. A játék a **helyi fájlokat** használja: a listát az `img/kollegak.json`-ból,
   a képeket az `img/<id>.png`-ből, relatív útvonalon. A starter kiszolgálója
   ezeket már kiszolgálja.
4. Rajzolás előtt várd meg, amíg a kép betöltött. Hogy ezt hogyan, és hogyan
   rajzolod ki, a technológiádtól függ: canvas, DOM, Phaser, mindegyikben
   megy, a kód a tiéd.

**A szerver címe nem kerülhet a játék kódjába.** Építés közben van net, a
bemutatón nem biztos: a kész játék a saját mappájából fut, a szervert senki
nem hívja. Képet csak a toolból kapott parancsokkal tölts le.

## A fejek szabványa

Minden fej egyforma, ezért bármelyik cserélhető bármelyikre, újrapozicionálás
nélkül:

| | |
|---|---|
| Vászon | 512×512 px PNG, átlátszó háttér |
| Pozíció | a fej középpontja a vászon közepén |
| Lépték | az arc (homlok–áll) a vászon magasságának 40%-a |
| Alak | tojás alakú fej és nyakcsík, váll nincs |

Négyzetesen rajzold, a kívánt méretben: 40 és 120 px között is jól néz ki.
Ne nyújtsd el.

A manifest alakja:

```json
{ "kollegak": [ { "id": "szoke_tibor", "nev": "Szőke Tibor", "becenev": "Tibi", "kep": "img/szoke_tibor.png" } ] }
```

Becenév a képernyőre, teljes név a karakterválasztóba. A becenév nem egyedi
(több Bence, Tomi, Peti van), hivatkozásra az `id`-t használd.

## Buktatók

| Tünet | Ok |
|---|---|
| Nincs `kollegak` tool | A `.mcp.json` szervere nincs engedélyezve, vagy nem tud csatlakozni. Claude Code: `/mcp`. |
| A `curl` PowerShellben mást csinál | Ott a `curl` az `Invoke-WebRequest` álneve. Írj `curl.exe`-t. |
| A képek nem oda kerültek | A `curl` nem a projekt gyökeréből futott, vagy a projekt szerkezete más, mint a starter. Az `-o` útvonalat igazítsd oda, ahonnan a játék kiszolgál. |
| Első képkockán nincs fej, vagy hiba a rajzolásnál | A kép még nem töltött be. Várd meg. |
| A `kollega` tool több embert sorol | Közös becenév. Add meg az `id`-t vagy a teljes nevet. |
| A bemutatón üres a fej helye | A játék a szerverről tölt helyi fájl helyett. Csak relatív útvonal. |
