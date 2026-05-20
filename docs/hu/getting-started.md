# Első lépések az @atom-forge/rpc-vel

## Telepítés

```bash
npm install @atom-forge/rpc
pnpm add @atom-forge/rpc
yarn add @atom-forge/rpc
bun add @atom-forge/rpc
```

## Alapkoncepció: Végpontok közötti típusbiztonság (End-to-End Type Safety)

Az Rpc fő funkciója a végpontok közötti típusbiztonság biztosítása a szerver és a kliens között. Definiálod az API-dat a szerveren, majd megosztod ennek a definíciónak a típusát a klienssel. Ez automatikus kiegészítést és típusellenőrzést biztosít az API hívásaidhoz.

**1. Definiáld az API-t a szerveren:**

```typescript
// api.ts (megosztott API definíció)
import {rpc} from '@atom-forge/rpc';

export const api = {
	posts: {
		list: rpc.query(async ({page}: { page: number }, ctx) => {
			// ... bejegyzések lekérése
			return {posts: [{id: 1, title: 'Hello'}]};
		}),
		create: rpc.command(async ({title}: { title: string }) => {
			// ... bejegyzés létrehozása
			return {success: true};
		}),
	},
};
```

```typescript
// SvelteKit: src/routes/rpc/[...path]/+server.ts
import {createHandler} from '@atom-forge/rpc';
import {api} from '$lib/api';

const rpc = createHandler(api, '/rpc');
export const GET = ({request}) => rpc.handle(request);
export const POST = GET;
```

**2. Használd a típust a kliensen:**

```typescript
// src/lib/client/rpc.ts
import {createClient} from '@atom-forge/rpc';
import type {api} from '$lib/api';

const [client, cfg] = createClient<typeof api>('/rpc');

// Minden hívás egy RpcResponse-szal tér vissza
const res = await client.posts.list.$query({page: 1});
if (res.isOK()) {
	console.log(res.result); // a típusa: { posts: { id: number, title: string }[] }
}

await client.posts.create.$command({title: 'Új bejegyzésem'});

export default client;
```
