# Hibakezelési stratégia a Rpc-ben

Ez a dokumentum a Rpc projektben alkalmazott hibakezelési stratégiát írja le. A cél egy konzisztens, robusztus és fejlesztőbarát hibamodell kialakítása, amely a szerveroldali egyszerűséget és a kliensoldali kényelmet helyezi előtérbe.

## Alapelvek

1.  **Tiszta "Happy Path":** A sikeres műveletek esetén a szerver a nyers, csomagolás nélküli adattal tér vissza.
2.  **Egyértelmű hibajelzés:** Az alkalmazás-szintű hibákat egy speciális, névtérrel ellátott kulcs (`atomforge.rpc.error`) jelzi a válaszobjektumban. Ez a megközelítés kiküszöböli az ütközéseket a felhasználó saját adatmodelljével.
3.  **Intelligens kliensoldali wrapper:** A kliens egy `RpcResponse` wrapper objektumot kap, amely **minden** választ lefed – beleértve a transport-szintű HTTP hibákat is. Nincs szükség `try-catch` blokkra.

## Szerveroldali hibakezelés

### 1. Sikeres válasz (`200 OK`)

A sikeres művelet esetén a handler a **nyers adattal** tér vissza. A keretrendszer ezt az adatot szerializálja és küldi el a kliensnek `200 OK` státusszal.

*   **Példa:**
    ```typescript
    // A handler csak ennyit ad vissza:
    return { id: 1, title: 'My Post' };
    ```
*   **HTTP válasz törzse:**
    ```json
    { "id": 1, "title": "My Post" }
    ```

### 2. Alkalmazás-szintű hiba (`200 OK`)

Hiba esetén a handler egy olyan objektumot ad vissza, amely tartalmazza az `atomforge.rpc.error` kulcsot. Ennek a kulcsnak az értéke az RPC hibakód. A többi mező a hiba részleteit tartalmazza.

A keretrendszer beépített kényelmi függvényeket biztosít a leggyakoribb esetekre (lásd lent). Ezeken túl a fejlesztő tetszőleges saját hibakódot is visszaadhat.

*   **Példa beépített helperrel:**
    ```typescript
    return rpc.error.invalidArgument({ message: 'Title must be at least 3 characters long.' });
    ```
*   **Példa saját hibakóddal:**
    ```typescript
    return rpc.error.make('POST_ALREADY_EXISTS', 'Ez a slug már foglalt.', { slug: post.slug });
    ```
*   **HTTP válasz törzse:**
    ```json
    {
      "atomforge.rpc.error": "INVALID_ARGUMENT",
      "message": "Title must be at least 3 characters long."
    }
    ```

**Példák alkalmazás-szintű hibákra:**

*   **Üzleti validáció:** `atomforge.rpc.error: "INVALID_ARGUMENT"` (beépített)
*   **Autorizációs hiba:** `atomforge.rpc.error: "PERMISSION_DENIED"` (beépített)
*   **Erőforrás nem található:** `atomforge.rpc.error: "NOT_FOUND"` (fejlesztő definiálja)

### 3. Transport-szintű és váratlan hibák (`4xx`, `5xx`)

Ezek a státuszkódok csak akkor használatosak, ha a hiba megakadályozza a szervert abban, hogy egyáltalán eljusson az RPC üzleti logikájáig, vagy ha egy váratlan, **nem kezelt** hiba történik.

*   **`401 Unauthorized`:** A felhasználó nincs hitelesítve. → kliensnél: `HTTP:401`
*   **`404 Not Found`:** Az URL útvonal (endpoint) maga nem létezik. → kliensnél: `HTTP:404`
*   **`500 Internal Server Error`:** Váratlan, nem kezelt szerveroldali hiba. → kliensnél: `HTTP:500`

    A válasz törzse tartalmaz egy `correlationId`-t a hibakereséshez:
    ```json
    {
      "atomforge.rpc.error": "INTERNAL_ERROR",
      "message": "A szerver váratlan hibába ütközött.",
      "correlationId": "xxx-xxx-xxx-xxx-xxx"
    }
    ```

## Beépített helper kódok

A keretrendszer az alábbi kényelmi függvényeket biztosítja a szerveren:

| Metódus | Error kód | Mikor használandó |
|---|---|---|
| `rpc.error.permissionDenied(details?)` | `PERMISSION_DENIED` | Jogosultság hiánya |
| `rpc.error.invalidArgument(details?)` | `INVALID_ARGUMENT` | Üzleti validáció (Zod-on kívül) |
| `rpc.error.internalError(details?)` | `INTERNAL_ERROR` | Kezelt belső hiba, automatikus `correlationId`-vel |
| `rpc.error.make(code, message?, result?)` | egyedi | Tetszőleges egyedi hibakód |

A `details` / `result` paraméter egy tetszőleges objektum, amelynek mezői bekerülnek a választörzsbe az error kulcs mellé.

## Kliensoldali hibakezelés: A Válasz-wrapper

Az rpc kliens egy `RpcResponse` wrapper objektumot ad vissza, amely intelligensen kezeli a szerverről érkező **összes** választ: sikeres adatot, alkalmazás-szintű hibát és transport hibát egyaránt.

A transport-szintű hibák (4xx, 5xx) `HTTP:<státuszkód>` formátumú kódként jelennek meg (pl. `HTTP:401`, `HTTP:500`). Ez egyértelműen elkülöníti őket az alkalmazás-szintű hibakódoktól.

**A wrapper felépítése:**

```typescript
const RPC_ERROR_KEY = 'atomforge.rpc.error';

interface RpcResponse<TSuccess, TError> {
  // Ellenőrzi, hogy a hívás sikeres volt-e.
  isOK(): this is { getResult: () => TSuccess };

  // Ellenőrzi, hogy a hívás hibára futott-e.
  // Ha a 'code' paraméter meg van adva, egy konkrét hibakódot keres.
  // Alkalmazás-szintű kód: 'INVALID_ARGUMENT', 'NOT_FOUND', stb.
  // Transport hiba kód: 'HTTP:401', 'HTTP:404', 'HTTP:500', stb.
  isError(code?: string): this is { getResult: () => TError };

  // Visszaadja a státuszkódot stringként:
  // - Siker esetén: 'OK'
  // - Alkalmazás-szintű hiba esetén: az atomforge.rpc.error értéke (pl. 'NOT_FOUND')
  // - Transport hiba esetén: 'HTTP:<státuszkód>' (pl. 'HTTP:401')
  getStatus(): 'OK' | string;

  // Visszaadja a válasz "törzsét":
  // - Siker esetén a nyers adatot.
  // - Hiba esetén a hiba részleteit (a speciális hibakulcs nélkül).
  getResult(): TSuccess | TError;
}
```

**Használat a gyakorlatban:**

```typescript
const response = await api.posts.create.$command({ title: 'Egy új poszt' });

if (response.isOK()) {
  const post = response.getResult();
  console.log('Sikeresen létrehozva:', post.id);
  // UI frissítése a sikeres adattal

} else if (response.isError('INVALID_ARGUMENT')) {
  const errorDetails = response.getResult();
  console.log('Validációs hiba:', errorDetails.message);
  // UI frissítése a validációs hibával

} else if (response.isError('HTTP:401')) {
  console.log('Hitelesítés szükséges, átirányítás a login oldalra');

} else {
  // Bármilyen egyéb hiba (más üzleti kód, HTTP:500, stb.)
  console.log(`Hiba: ${response.getStatus()}`, response.getResult());
}
```

---
Ez a modell egyensúlyt teremt a robusztus hibakezelés és a kiváló fejlesztői élmény között. A szerveroldali kód tiszta marad, a hibajelzés egyértelmű és ütközésmentes, a kliensoldali feldolgozás pedig kényelmes, típusbiztos, és `try-catch` nélkül is teljes körű.
