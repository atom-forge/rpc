# Kliensoldali használat

## `createClient`

A `createClient` függvény egy új API klienst hoz létre. Annak a módja, ahogyan egy végpontot meghívsz a kliensen (`$query` vagy `$get`), meg kell hogy egyezzen azzal, ahogyan az a szerveren definiálva lett (`rpc.query` vagy `rpc.get`).

```typescript
import {createClient} from '@atom-forge/rpc';
import type {api} from './api';

const [client, cfg] = createClient<typeof api>('/rpc');

// Ha a szerver végpont rpc.query-vel lett definiálva:
const result = await client.posts.list.$query({page: 1});

// Command (parancs) hívás
await client.posts.create.$command({title: 'Hello World'});
```

## Hívási opciók (Call Options)

Minden RPC metódus (`$command`, `$query`, `$get`) elfogad egy opcionális második argumentumot hívásonkénti opciókkal:

```typescript
const result = await client.posts.list.$query({page: 1}, {
	// A kérés megszakítása egy AbortController használatával
	abortSignal: controller.signal,

	// Feltöltési/letöltési folyamat követése (belsőleg XHR-t használ)
	onProgress: ({loaded, total, percent, phase}) => {
		console.log(`${phase}: ${percent}%`);
	},

	// Egyéni kérés (request) fejlécek hozzáadása csak ehhez a híváshoz
	headers: new Headers({'X-Custom-Header': 'value'}),
});
```

## `RpcResult<T>`

Egy segédtípus (utility type), amely kinyeri a sikeres visszatérési típust egy RPC metódusból. Hasznos állapot (state) változók vagy függvény visszatérési típusok típusozásához anélkül, hogy manuálisan ki kellene írni a teljes válasz (response) típust.

```typescript
import type {RpcResult} from '@atom-forge/rpc';

// Ajánlott: add át a metódus leíró objektumot
type Posts = RpcResult<typeof client.posts.list>;

// Szintén működik: add át közvetlenül a hívható függvényt
type Posts = RpcResult<typeof client.posts.list.$query>;

// Példa Svelte $state-tel
let posts = $state<RpcResult<typeof client.posts.list>>([]);
```

## `RpcResponse`

Minden RPC hívás egy `RpcResponse` objektummal tér vissza, amely a következő tagokkal rendelkezik:

| Tag | Leírás |
|---|---|
| `res.isOK()` | `true` ha a hívás sikeres volt — a `res.result`-ot a sikeres típusra szűkíti |
| `res.isError(code?)` | `true` ha hiba történt; opcionálisan ellenőriz egy specifikus kódot |
| `res.status` | `'OK'` siker esetén, vagy a hibakód stringje |
| `res.result` | `TSuccess` az `isOK()` után, egyébként a teljes unió |
| `res.ctx` | A teljes `ClientContext` ehhez a híváshoz |

**Hibakód formátum:**

- Alkalmazásszintű hibák: `'INVALID_ARGUMENT'`, `'PERMISSION_DENIED'`, egyedi kódok, stb.
- Transzport hibák: `'HTTP:401'`, `'HTTP:404'`, `'HTTP:500'`, stb.
- Hálózati hibák: `'NETWORK_ERROR'`

```typescript
const res = await client.posts.create.$command({title: 'Hello'});

if (res.isOK()) {
	console.log(res.result);             // típusos eredmény
} else if (res.isError('INVALID_ARGUMENT')) {
	console.log(res.result.message);     // hiba részletei
} else if (res.isError('HTTP:401')) {
	// átirányítás a bejelentkezéshez
} else {
	console.log(res.status, res.result); // bármilyen más hiba
}

// Hozzáférés a kontextushoz (válasz fejlécek, eltelt idő, stb.)
console.log(res.ctx.response?.status);
console.log(res.ctx.elapsedTime);
```

## Fájlfeltöltések (File Uploads)

A `$command` végpontok automatikusan felismerik a `File` vagy `File[]` értékeket az argumentumokban, és átváltanak egy `multipart/form-data` kérésre. Kombinálhatod a fájlfeltöltéseket normál argumentumokkal, és követheted a folyamatot (progress).

```typescript
// Szerveroldal
const api = {
	posts: {
		create: rpc.command(async ({title, cover}: { title: string; cover: File }) => {
			// A cover egy File objektum
		}),
	},
};

// Kliensoldal
const coverFile = document.querySelector('input[type=file]').files[0];

await client.posts.create.$command(
	{title: 'Hello', cover: coverFile},
	{
		onProgress: ({percent, phase}) => console.log(`${phase}: ${percent}%`),
	}
);
```

Több fájl esetén használj egy tömböt, és tegyél `[]` utótagot a kulcshoz:

```typescript
// Szerveroldal
const api = {
	media: {
		upload: rpc.command(async ({files}: { files: File[] }) => { ...
		}),
	},
};

// Kliensoldal
await client.media.upload.$command({'files[]': selectedFiles});
```

## `clientLogger`

A `clientLogger` egy beépített kliensoldali middleware, amely naplózza az RPC hívás részleteit a böngésző konzoljába — beleértve a kérés útvonalát, az argumentumokat, a választ, az időzítést és a HTTP státuszkódot.

```typescript
import {createClient, clientLogger} from '@atom-forge/rpc';

const [client, cfg] = createClient<typeof api>('/rpc');
cfg.$ = clientLogger('/rpc'); // globális alkalmazás
```

## `makeClientMiddleware`

A `makeClientMiddleware` függvény kliensoldali middleware létrehozására szolgál.

> ⚠️ **Mindig térj vissza (`return`) az `await next()` hívással** a middleware-edben. Ha meghívod a `next()`-et anélkül, hogy visszatérnél az eredményével, a válasz elveszik, és a hívó `undefined`-ot fog kapni.

```typescript
import {makeClientMiddleware} from '@atom-forge/rpc';

const loggerMiddleware = makeClientMiddleware(async (ctx, next) => {
	console.log('Kérés:', ctx.path, ctx.getArgs());
	const result = await next(); // ✅ mindig térj vissza a next() eredményével
	console.log('Válasz:', ctx.result);
	return result;
});

// Middleware alkalmazása az összes útvonalra
cfg.$ = loggerMiddleware;
```
