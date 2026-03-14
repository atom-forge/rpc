# Rpc

Az Rpc egy teljes stackes RPC (Remote Procedure Call) keretrendszer TypeScript projektekhez. Leegyűsíti a kliens és a szerver közötti kommunikációt egy típusbiztos API biztosításával.

## Telepítés

```bash
npm install @atom-forge/rpc
pnpm add @atom-forge/rpc
yarn add @atom-forge/rpc
bun add @atom-forge/rpc
```

## Alapkoncepció: Végpontok közötti típusbiztonság

Az Rpc fő funkciója a szerver és a kliens közötti végpontok közötti típusbiztonság biztosítása. Az API-t a szerveren definiálod, majd megosztod a definíció típusát a klienssel. Ez automatikus kiegészítést és típusellenőrzést biztosít az API-hívásokhoz.

**1. Definiáld az API-t és hozd létre a handlert a szerveren:**

```typescript
// src/hooks.server.ts (vagy a szerver belépési pontja)
import { createHandler, rpc } from '@atom-forge/rpc';

const api = {
  posts: {
    list: rpc.query(async ({ page }: { page: number }, ctx) => {
      // ... bejegyzések lekérése
      return { posts: [{ id: 1, title: 'Helló' }] };
    }),
    create: rpc.command(async ({ title }: { title: string }) => {
      // ... bejegyzés létrehozása
      return { success: true };
    }),
  },
};

// A handler és a definíció itt jön létre.
// A definíciót fogjuk majd a kliensen használni.
export const [handler, definition] = createHandler(api);
```

**2. Használd a típust a kliensen:**

```typescript
// src/lib/client/rpc.ts
import { createClient } from '@atom-forge/rpc';
import { definition } from '../../hooks.server'; // Importáld a definíció objektumot

const [api, cfg] = createClient<typeof definition>('/api/rpc');

// Minden hívás RpcResponse-t ad vissza
const res = await api.posts.list.$query({ page: 1 });
if (res.isOK()) {
  console.log(res.result); // típusa: { posts: { id: number, title: string }[] }
}

await api.posts.create.$command({ title: 'Új bejegyzésem' });

export default api;
```

## Kommunikációs protokoll

Az Rpc elsődlegesen a **MessagePack** protokollt használja a hatékonyság és teljesítmény érdekében. Azon kliensek számára, amelyek nem támogatják a MessagePacket, **JSON** formátumra is visszaeshet.

- **`$command`**: Az adatokat a kérés törzsében küldi, MessagePack kódolással (`application/msgpack`). A szerver az egyszerű JSON-t (`application/json`) is elfogadja.
- **`$query`**: Az adatokat az URL lekérdezési paraméterében küldi, MessagePack és Base64 kódolással. Ez az ajánlott módszer lekérdezésekhez.
- **`$get`**: Az adatokat egyszerű szövegként küldi az URL lekérdezési paraméterében. Hasznos, ha a kliens nem támogatja a MessagePacket, vagy egyszerű, nem összetett lekérdezéseknél.

A szerver automatikusan észleli a kliens `Accept` fejlécét, és vagy MessagePack vagy JSON formátumban válaszol.

### Válasz fejlécek

Minden válasz tartalmazza az alábbi fejléceket:

| Fejléc | Leírás |
|---|---|
| `x-atom-forge-rpc-exec-time` | Szerver oldali végrehajtási idő milliszekundumban. |

## Kliens oldali használat

### `createClient`

A `createClient` függvény új API klienst hoz létre. A kliens oldali hívás módja (`$query` vagy `$get`) meg kell, hogy egyezzen a szerveren definiált módszerrel (`rpc.query` vagy `rpc.get`).

```typescript
import { createClient } from '@atom-forge/rpc';
import { definition } from '../../hooks.server';

const [api, cfg] = createClient<typeof definition>('/api/rpc');

// Ha a szerver oldali endpoint rpc.query-vel van definiálva:
const result = await api.posts.list.$query({ page: 1 });

// Command hívás példa
await api.posts.create.$command({ title: 'Hello Világ' });
```

Debug naplózást is engedélyezhetsz az összes híváshoz:

```typescript
const [api, cfg] = createClient<typeof definition>('/api/rpc', { debug: true });
```

### Hívási opciók

Minden RPC metódus (`$command`, `$query`, `$get`) egy opcionális második argumentumot fogad el hívás szintű beállításokhoz:

```typescript
const result = await api.posts.list.$query({ page: 1 }, {
  // Kérés megszakítása AbortController segítségével
  abortSignal: controller.signal,

  // Upload/download haladás követése (XHR-t használ belül)
  onProgress: ({ loaded, total, percent, phase }) => {
    console.log(`${phase}: ${percent}%`);
  },

  // Egyedi kérés fejlécek hozzáadása csak ehhez a híváshoz
  headers: new Headers({ 'X-Custom-Header': 'érték' }),

  // Hívás szintű debug naplózás engedélyezése
  debug: true,
});
```

### `RpcResponse`

Minden RPC hívás `RpcResponse`-t ad vissza, az alábbi tagokkal:

| Tag | Leírás |
|---|---|
| `res.isOK()` | `true`, ha a hívás sikeres volt |
| `res.isError(code?)` | `true`, ha hiba; opcionálisan egy konkrét kódot ellenőriz |
| `res.status` | `'OK'` sikernél, vagy a hibakód stringje |
| `res.result` | Típusos sikeres adat, vagy a hiba részletei |
| `res.ctx` | A híváshoz tartozó teljes `ClientContext` |

**Hibakód formátumok:**
- Alkalmazás-szintű hibák: `'INVALID_ARGUMENT'`, `'PERMISSION_DENIED'`, egyedi kódok, stb.
- Transport hibák: `'HTTP:401'`, `'HTTP:404'`, `'HTTP:500'`, stb.
- Hálózati hibák: `'NETWORK_ERROR'`

```typescript
const res = await api.posts.create.$command({ title: 'Helló' });

if (res.isOK()) {
  console.log(res.result);             // típusos eredmény
} else if (res.isError('INVALID_ARGUMENT')) {
  console.log(res.result.message);     // hiba részletei
} else if (res.isError('HTTP:401')) {
  // átirányítás a bejelentkezési oldalra
} else {
  console.log(res.status, res.result); // bármilyen egyéb hiba
}

// Kontextus elérése (válasz fejlécek, eltelt idő, stb.)
console.log(res.ctx.response?.status);
console.log(res.ctx.elapsedTime);
```

### Fájlfeltöltés

A `$command` endpointok automatikusan felismerik, ha az argumentumokban `File` vagy `File[]` értékek szerepelnek, és átváltanak `multipart/form-data` kérésre. A fájlfeltöltéseket kombinálhatod normál argumentumokkal, és követheted a haladást.

```typescript
// Szerver oldalon
const api = {
  posts: {
    create: rpc.command(async ({ title, cover }: { title: string; cover: File }) => {
      // a cover egy File objektum
    }),
  },
};

// Kliens oldalon
const coverFile = document.querySelector('input[type=file]').files[0];

await api.posts.create.$command(
  { title: 'Helló', cover: coverFile },
  {
    onProgress: ({ percent, phase }) => console.log(`${phase}: ${percent}%`),
  }
);
```

Több fájlhoz használj tömböt és `[]` végzőt a kulcson:

```typescript
// Szerver oldalon
const api = {
  media: {
    upload: rpc.command(async ({ files }: { files: File[] }) => { ... }),
  },
};

// Kliens oldalon
await api.media.upload.$command({ 'files[]': selectedFiles });
```

### `makeClientMiddleware`

A `makeClientMiddleware` függvény kliens oldali middleware létrehozására szolgál.

> ⚠️ **Mindig `return await next()`-et használj** a middleware-ben. Ha a `next()` hívás eredményét nem adod vissza, a válasz elvész és a hívó `undefined`-ot kap.

```typescript
import { makeClientMiddleware } from '@atom-forge/rpc';

const loggerMiddleware = makeClientMiddleware(async (ctx, next) => {
  console.log('Kérés:', ctx.path, ctx.getArgs());
  const result = await next(); // ✅ mindig add vissza a next() eredményét
  console.log('Válasz:', ctx.result);
  return result;
});

// Middleware alkalmazása az összes útvonalra
cfg.$ = loggerMiddleware;
```

## Szerver oldali használat

### `createHandler`

A `createHandler` függvény request handlert hoz létre a szerverhez, és visszaadja a handlert és a típusos API definíciót.

```typescript
import { createHandler, rpc } from '@atom-forge/rpc';

const api = {
  posts: {
    // Ez az endpoint $query hívást vár a klienstől
    list: rpc.query(async ({ page }, ctx) => {
      ctx.cache.set(60);
      return { posts: [] };
    }),
    // Ez az endpoint $get hívást vár a klienstől
    getById: rpc.get(async ({ id }, ctx) => {
      return { id, title: 'Példa bejegyzés' };
    }),
    // Ez az endpoint $command hívást vár a klienstől
    create: rpc.command(async ({ title }) => {
      // új bejegyzés létrehozása
    }),
  },
};

export const [handler, definition] = createHandler(api);
```

#### Egyedi szerver kontextus

Megadhatsz egyedi szerver kontextus factory-t, hogy saját tulajdonságokat (pl. hitelesített felhasználó) injektálj minden handlerbe:

```typescript
import { createHandler, ServerContext } from '@atom-forge/rpc';

class AppContext extends ServerContext {
  get user() {
    return this.event.locals.user;
  }
}

export const [handler, definition] = createHandler(api, {
  createServerContext: (args, event) => new AppContext(args, event),
});
```

### A `rpc` objektum

A `rpc` objektum az API endpointok definiálásához nyújt metódusokat. A szerveren használt metódus határozza meg, hogy a kliens hogyan kell meghívja az endpointot.

*   `rpc.query`: MessagePack kódolt argumentumokat váró lekérdezési endpointot definiál. A kliensnek **`$query`**-t kell használnia.
*   `rpc.get`: Egyszerű szöveges URL argumentumokat váró lekérdezési endpointot definiál. A kliensnek **`$get`**-t kell használnia.
*   `rpc.command`: Parancsi endpointot definiál. A kliensnek **`$command`**-t kell használnia.

#### `rpcFactory`

Ha egyedi szerver kontextust használsz (lásd fent), a `rpcFactory` segítségével hozhatsz létre típusos `rpc` példányt, hogy a `ctx` megfelelően legyen típusozva a handlerekben:

```typescript
import { rpcFactory } from '@atom-forge/rpc';

const rpc = rpcFactory<AppContext>();

const api = {
  posts: {
    list: rpc.query(async ({ page }, ctx) => {
      // ctx típusa: AppContext
      const user = ctx.user;
      return { posts: [] };
    }),
  },
};
```

### Szerver kontextus (`ctx`)

Minden handler és szerver oldali middleware kap egy `ctx` objektumot az alábbi tagokkal:

| Tag | Leírás |
|---|---|
| `ctx.event` | A nyers SvelteKit `RequestEvent`. |
| `ctx.getArgs()` | Visszaadja az összes argumentumot egyszerű objektumként. |
| `ctx.args` | Az argumentumok `Map<string, any>` formában. |
| `ctx.cookies` | A `ctx.event.cookies` rövidítése. |
| `ctx.headers.request` | A bejövő kérés fejlécei. |
| `ctx.headers.response` | A módosítható válasz fejlécek. |
| `ctx.cache.set(seconds)` | Beállítja a `Cache-Control` max-age értékét GET válaszoknál. |
| `ctx.cache.get()` | Visszaadja az aktuális cache időtartamát. |
| `ctx.status.set(code)` | Beállítja a HTTP válasz státuszkódját. |
| `ctx.status.notFound()` | Rövidítés a leggyakoribb HTTP kódokhoz (lásd lent). |
| `ctx.env` | `Map<string\|symbol, any>` az adatok middleware-ek közötti átadásához. |
| `ctx.elapsedTime` | Szerver oldali eltelt idő milliszekundumban. |

**Státusz rövidítések:** `ok`, `created`, `accepted`, `noContent`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `methodNotAllowed`, `conflict`, `tooManyRequests`, `serverError`, `serviceUnavailable`, és még sok más.

### Gyorsítótárazás

Az Rpc támogatja a szerver oldali gyorsítótárazást `GET` kérésekhez (mind `rpc.query`, mind `rpc.get` esetén). A cache időtartamát másodpercekben állíthatod be a `ctx.cache.set()` metódussal az endpoint implementációján belül.

```typescript
const api = {
  posts: {
    list: rpc.query(async ({ page }, ctx) => {
      ctx.cache.set(60); // Válasz gyorsítótárazása 60 másodpercre
      return { posts: [] };
    }),
  },
};
```

### Hibakezelés

A szerveren a beépített helper függvényekkel küldhetsz alkalmazás-szintű hibákat. Ezek mindig `200 OK` választ adnak az `atomforge.rpc.error` kulccsal, így a kliens egy típusos `RpcResponse`-t kap.

```typescript
import { rpc } from '@atom-forge/rpc';

const api = {
  posts: {
    create: rpc.command(async ({ title }, ctx) => {
      if (!ctx.event.locals.user) return rpc.error.permissionDenied();
      if (title.length < 3) return rpc.error.invalidArgument({ message: 'A cím túl rövid' });
      // ...
      return { id: 1, title };
    }),
  },
};
```

Egyedi hibakódhoz használd a `rpc.error.make` metódust:

```typescript
return rpc.error.make('POST_ALREADY_EXISTS', 'Ez a slug már létezik', { slug: post.slug });
```

| Metódus | Hibakód | Mikor használd |
|---|---|---|
| `rpc.error.invalidArgument(details?)` | `INVALID_ARGUMENT` | Üzleti logikai validáció (Zod-on túl) |
| `rpc.error.permissionDenied(details?)` | `PERMISSION_DENIED` | Jogosultsági hiba |
| `rpc.error.internalError(details?)` | `INTERNAL_ERROR` | Kezelt belső hiba (auto `correlationId`) |
| `rpc.error.make(code, message?, result?)` | egyedi | Bármilyen egyedi hibakód |

### `zod` integráció

Az Rpc beépített `zod` támogatással rendelkezik a bemeneti validációhoz. Telepítsd a `zod`-ot a projekted függőségeként, és importáld közvetlenül onnan.

Ha a validáció sikertelen, az Rpc automatikusan alkalmazás-szintű hibát küld (`200 OK`) `INVALID_ARGUMENT` kóddal, és a `ZodIssue` tömböt az `issues` mezőben. A handler nem fut le.

```typescript
// Szerver oldalon
import { rpc } from '@atom-forge/rpc';
import { z } from 'zod';

const api = {
  posts: {
    create: rpc.zod({
      title: z.string().min(3, "A cím legalább 3 karakter hosszú kell legyen."),
      content: z.string().min(10),
    }).command(async ({ title, content }) => {
      // Ez a kód csak akkor fut le, ha a validáció sikeres
    }),
  },
};
```

A `rpc.zod` `query` és `get` esetén is működik:

```ts
rpc.zod({ id: z.number() }).query(async ({ id }, ctx) => { ... })
rpc.zod({ id: z.number() }).get(async ({ id }, ctx) => { ... })
```

A validációs hibákat a kliensen a `RpcResponse`-on keresztül kezelheted:

```typescript
// Kliens oldalon
const res = await api.posts.create.$command({ title: 'Hi' });
if (res.isError('INVALID_ARGUMENT')) {
  console.log(res.result.issues); // ZodIssue[]
}
```

### `makeServerMiddleware`

A `makeServerMiddleware` függvény szerver oldali middleware létrehozására szolgál. Egy opcionális második argumentum segítségével accessor függvényeket csatolhatsz a middleware-hez, ami hasznos az újrafelhasználható, önálló middleware-ek és segédprogramok létrehozásához.

> ⚠️ **Mindig `return await next()`-et használj** a middleware-ben. Ha a `next()` hívás eredményét nem adod vissza, a handler visszatérési értéke elvész és a kliens `undefined`-ot kap.

```typescript
import { makeServerMiddleware } from '@atom-forge/rpc';

const authMiddleware = makeServerMiddleware(
  async (ctx, next) => {
    if (!ctx.event.locals.user) {
      ctx.status.unauthorized();
      return { error: 'Nem engedélyezett' }; // ✅ korai visszatérés, next() hívás nem szükséges
    }
    return await next(); // ✅ mindig add vissza a next() eredményét
  },
  // Opcionális accessor-ok, amelyek a middleware függvényhez vannak csatolva
  {
    isAdmin: (ctx) => ctx.event.locals.user?.role === 'admin',
  }
);
```

Az accessor függvények közvetlenül a middleware függvény objektumhoz vannak csatolva, így a middleware és a kapcsolódó segédprogramok egy helyen maradnak. Az endpoint implementációkon belül `ctx` átadásával hívhatók meg:

```typescript
const api = {
  admin: {
    deletePost: rpc.middleware(authMiddleware).command(async ({ id }, ctx) => {
      if (!authMiddleware.isAdmin(ctx)) {
        ctx.status.forbidden();
        return { error: 'Csak adminoknak' };
      }
      // folytatás...
    }),
  },
};
```

Ez a minta egy helyen tartja a middleware tudását — hogy mi számít `isAdmin` ellenőrzésnek —, ahelyett, hogy minden endpointban megismételné a logikát.

### Middleware alkalmazása a `rpc.middleware` segítségével

Használd a `rpc.middleware()` metódust egy vagy több szerver middleware endpoint-hoz csatolásához:

```typescript
import { rpc } from '@atom-forge/rpc';
import { z } from 'zod';

// Middleware alkalmazása egy konkrét endpointra
const api = {
  posts: {
    create: rpc.middleware(authMiddleware).command(async ({ title }) => {
      // ...
    }),
    // Middleware kombinálása zod validációval
    update: rpc.middleware(authMiddleware).zod({
      id: z.number(),
      title: z.string(),
    }).command(async ({ id, title }) => {
      // ...
    }),
  },
};
```

Middleware-t bármilyen meglévő objektumhoz csatolhatsz az `.on()` segítségével:

```typescript
const postsApi = {
  list: rpc.query(async () => { ... }),
  create: rpc.command(async () => { ... }),
};

// authMiddleware csatolása az egész postsApi csoporthoz
rpc.middleware(authMiddleware).on(postsApi);

const api = { posts: postsApi };
```

