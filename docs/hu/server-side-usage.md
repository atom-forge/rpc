# Szerveroldali használat

## `createHandler`

A `createHandler` létrehoz egy kezelő (handler) objektumot az RPC kérések feldolgozására.

```typescript
import {createHandler, rpc} from '@atom-forge/rpc';

const api = {
	posts: {
		// $query kérést vár a klienstől
		list: rpc.query(async ({page}, ctx) => {
			ctx.cache.set(60);
			return {posts: []};
		}),
		// $get kérést vár a klienstől
		getById: rpc.get(async ({id}, ctx) => {
			return {id, title: 'Example Post'};
		}),
		// $command kérést vár a klienstől
		create: rpc.command(async ({title}) => {
			// új bejegyzés létrehozása
		}),
	},
};

const rpcHandler = createHandler(api, '/rpc');
rpcHandler.match(request); // boolean — ez a kérés ehhez a kezelőhöz tartozik?
rpcHandler.handle(request); // Promise<Response>
```

### Egyedi szerver kontextus (Custom Server Context)

Megadhatsz egy egyedi szerver kontextus gyárat (factory), hogy saját tulajdonságokat (pl. az azonosított felhasználót) fecskendezz be minden kezelőbe:

```typescript
import {createHandler, ServerContext} from '@atom-forge/rpc';

class AppContext extends ServerContext {
	get user() {
		return this.env.get('user'); // egy auth middleware tölti fel
	}
}

const rpcHandler = createHandler(api, '/rpc', {
	createServerContext: (args, request) => new AppContext(args, request),
});
```

## Az `rpc` objektum

Az `rpc` objektum metódusokat biztosít az API végpontjaid definiálásához. A szerveren használt metódus határozza meg, hogy a kliensnek hogyan kell meghívnia a végpontot.

* `rpc.query`: Egy query végpontot definiál, amely MessagePack-kel kódolt argumentumokat vár. A kliensnek a **`$query`**-t kell használnia.
* `rpc.get`: Egy query végpontot definiál, amely az argumentumokat egyszerű szövegként várja az URL-ben. A kliensnek a **`$get`**-et kell használnia.
* `rpc.command`: Egy command (parancs) végpontot definiál. A kliensnek a **`$command`**-ot kell használnia.

### `rpcFactory`

Ha egyedi szerver kontextust használsz (lásd fent), használd az `rpcFactory`-t egy típusos `rpc` példány létrehozásához, így a `ctx` megfelelően típusos lesz a kezelőidben:

```typescript
import {rpcFactory} from '@atom-forge/rpc';

const rpc = rpcFactory<AppContext>();

const api = {
	posts: {
		list: rpc.query(async ({page}, ctx) => {
			// A ctx típusa AppContext
			const user = ctx.user;
			return {posts: []};
		}),
	},
};
```

## Szerver kontextus (`ctx`)

Minden kezelő és szerveroldali middleware kap egy `ctx` objektumot a következő tagokkal:

| Tag | Leírás |
|---|---|
| `ctx.request` | A szabványos Web API `Request` objektum. |
| `ctx.getArgs()` | Visszaadja az összes argumentumot egy egyszerű (plain) objektumként. |
| `ctx.args` | Az argumentumok mint `Map<string, any>`. |
| `ctx.cookies` | Süti (Cookie) kezelő: `get(name)`, `set(name, value, opts?)`, `delete(name, opts?)`, `getAll()`. |
| `ctx.headers.request` | A bejövő kérés (request) fejlécei. |
| `ctx.headers.response` | A módosítható válasz (response) fejlécek. |
| `ctx.cache.set(seconds)` | Beállítja a `Cache-Control` max-age értékét GET válaszokhoz. |
| `ctx.cache.get()` | Visszaadja az aktuális gyorsítótár (cache) időtartamot. |
| `ctx.status.set(code)` | Beállítja a HTTP válasz státuszkódját. |
| `ctx.status.notFound()` | Rövidítés a gyakori HTTP kódokhoz (lásd alább). |
| `ctx.env` | Egy `Map<string\|symbol, any>` adatok átadására a middleware-ek között. |
| `ctx.elapsedTime` | Szerveroldali végrehajtási idő ezredmásodpercben. |

**Státusz rövidítések:** `ok`, `created`, `accepted`, `noContent`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `methodNotAllowed`, `conflict`, `tooManyRequests`, `serverError`, `serviceUnavailable`, és sok más.

## Gyorsítótárazás (Caching)

Az Rpc támogatja a szerveroldali gyorsítótárazást a `GET` kéréseknél (mind `rpc.query`, mind `rpc.get` esetén). Állítsd be a gyorsítótár időtartamát másodpercben a `ctx.cache.set()` használatával a végpont implementációján belül.

```typescript
const api = {
	posts: {
		list: rpc.query(async ({page}, ctx) => {
			ctx.cache.set(60); // A válasz gyorsítótárazása 60 másodpercre
			return {posts: []};
		}),
	},
};
```

## Hibakezelés (Error Handling)

Használd a beépített hiba (error) segédfüggvényeket, hogy alkalmazásszintű hibákkal térj vissza a kezelőkből. Ezek mindig egy `200 OK` választ eredményeznek az `atomforge.rpc.error` kulccsal, így a kliens egy típusos `RpcResponse`-t kap.

```typescript
import {rpc} from '@atom-forge/rpc';

const api = {
	posts: {
		create: rpc.command(async ({title}, ctx) => {
			if (!ctx.env.get('user')) return rpc.error.permissionDenied();
			if (title.length < 3) return rpc.error.invalidArgument({message: 'A cím túl rövid'});
			// ...
			return {id: 1, title};
		}),
	},
};
```

Használd az `rpc.error.make`-et egyedi hibakódokhoz:

```typescript
return rpc.error.make('POST_ALREADY_EXISTS', 'Ez a slug már létezik', {slug: post.slug});
```

| Metódus | Hibakód | Mikor használd |
|---|---|---|
| `rpc.error.invalidArgument(details?)` | `INVALID_ARGUMENT` | Üzleti logika validálása (a Zod-on túl) |
| `rpc.error.permissionDenied(details?)` | `PERMISSION_DENIED` | Engedélyezési (Authorization) hiba |
| `rpc.error.internalError(details?)` | `INTERNAL_ERROR` | Kezelt belső hiba (automatikus `correlationId`) |
| `rpc.error.make(code, message?, result?)` | custom (egyedi) | Bármilyen egyedi hibakód |

## `zod` integráció

Az Rpc beépített támogatással rendelkezik a `zod`-hoz a bemenet validálására. Telepítsd a `zod`-ot a projekted függőségeként, és importáld közvetlenül.

Ha a validálás sikertelen, az Rpc automatikusan egy alkalmazásszintű hibát (`200 OK`) ad vissza `INVALID_ARGUMENT` kóddal, és a `ZodIssue` tömböt az `issues` mezőben. A kezelő (handler) nem fut le.

```typescript
// Szerveroldal
import {rpc} from '@atom-forge/rpc';
import {z} from 'zod';

const api = {
	posts: {
		create: rpc.zod({
			title: z.string().min(3, "A címnek legalább 3 karakterből kell állnia."),
			content: z.string().min(10),
		}).command(async ({title, content}) => {
			// Ez a kód csak akkor fut le, ha a validálás sikeres
		}),
	},
};
```

Az `rpc.zod` a `query`-vel és a `get`-tel is működik:

```typescript
rpc.zod({id: z.number()}).query(async ({id}, ctx) => { ...
})
rpc.zod({id: z.number()}).get(async ({id}, ctx) => { ...
})
```

Kezeld a validációs hibákat a kliensen az `RpcResponse` segítségével:

```typescript
// Kliensoldal
const res = await client.posts.create.$command({title: 'Szia'});
if (res.isError('INVALID_ARGUMENT')) {
	console.log(res.result.issues); // ZodIssue[]
}
```

## `makeServerMiddleware`

A `makeServerMiddleware` függvény szerveroldali middleware létrehozására szolgál. Egy opcionális második argumentummal hozzáférő (accessor) függvényeket csatolhatsz a middleware-hez, ami hasznos újrafelhasználható, önálló middleware-ek és segédfüggvények létrehozásához.

> ⚠️ **Mindig térj vissza (`return`) az `await next()` hívással** a middleware-edben. Ha meghívod a `next()`-et anélkül, hogy visszatérnél az eredményével, a kezelő visszatérési értéke elveszik, és a kliens `undefined`-ot fog kapni.

```typescript
import {makeServerMiddleware} from '@atom-forge/rpc';

const authMiddleware = makeServerMiddleware(
	async (ctx, next) => {
		const token = ctx.cookies.get('session') ?? ctx.headers.request.get('Authorization');
		const user = await verifyToken(token);
		if (!user) {
			ctx.status.unauthorized();
			return {error: 'Unauthorized'}; // ✅ korai visszatérés, nem kell next() hívás
		}
		ctx.env.set('user', user);
		return await next(); // ✅ mindig térj vissza a next() eredményével
	},
	// Opcionális hozzáférők (accessors), amik magához a middleware függvényhez vannak csatolva
	{
		isAdmin: (ctx) => ctx.env.get('user')?.role === 'admin',
	}
);
```

A hozzáférő függvények közvetlenül a middleware függvény objektumához vannak csatolva, így a middleware és a hozzá tartozó segédfüggvények egy helyen maradnak. Hívd meg őket a végpont implementációkon belül a `ctx` átadásával:

```typescript
const api = {
	admin: {
		deletePost: rpc.middleware(authMiddleware).command(async ({id}, ctx) => {
			if (!authMiddleware.isAdmin(ctx)) {
				ctx.status.forbidden();
				return {error: 'Csak adminoknak'};
			}
			// folytatás...
		}),
	},
};
```

Ez a minta a middleware tudását — azt, hogy mi számít `isAdmin` ellenőrzésnek — egy helyen tartja, ahelyett, hogy a logikát minden végpontban megismételnéd.

## Middleware alkalmazása az `rpc.middleware` használatával

Használd az `rpc.middleware()`-t egy vagy több szerver middleware csatolásához egy végponthoz:

```typescript
import {rpc} from '@atom-forge/rpc';
import {z} from 'zod';

// Middleware alkalmazása egy adott végpontra
const api = {
	posts: {
		create: rpc.middleware(authMiddleware).command(async ({title}) => {
			// ...
		}),
		// Middleware kombinálása zod validációval
		update: rpc.middleware(authMiddleware).zod({
			id: z.number(),
			title: z.string(),
		}).command(async ({id, title}) => {
			// ...
		}),
	},
};
```

Middleware-t bármilyen meglévő objektumhoz is csatolhatsz az `.on()` használatával:

```typescript
const postsApi = {
	list: rpc.query(async () => { ...
	}),
	create: rpc.command(async () => { ...
	}),
};

// authMiddleware csatolása az egész postsApi csoporthoz
rpc.middleware(authMiddleware).on(postsApi);

const api = {posts: postsApi};
```
