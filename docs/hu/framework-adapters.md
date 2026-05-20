# Keretrendszer adapterek

A `createHandler` a szabványos `Request` → `Response` felületen működik. Minden keretrendszerhez nagyjából 2–5 soros adapterkódra van szükség.

### SvelteKit

```typescript
// src/routes/rpc/[...path]/+server.ts
import {createHandler} from '@atom-forge/rpc';
import {api} from '$lib/api';

const rpc = createHandler(api, '/rpc');
export const GET = ({request}) => rpc.handle(request);
export const POST = GET;
```

**Alternatíva: `hooks.server.ts`**

Egy route fájl helyett közvetlenül a server hookban is elfoghatod az RPC kéréseket — ez hasznos, ha már van egy `hooks.server.ts` fájlod, vagy jobban szereted egy helyen tartani az összes szerver logikát:

```typescript
// src/hooks.server.ts
import { createHandler } from '@atom-forge/rpc';
import { api } from '$lib/api';

const rpc = createHandler(api, '/rpc');

export const handle = async ({ event, resolve }) => {
  if (rpc.match(event.request)) return rpc.handle(event.request);
  return resolve(event);
};
```

Nincs szükség route fájlra. A hook a SvelteKit routere előtt fut le, így valamivel gyorsabb, és nem igényel egy `src/routes/rpc/` könyvtárat.

### Express

```typescript
import { createHandler } from '@atom-forge/rpc';
import { api } from './api';

const rpc = createHandler(api, '/rpc');

app.use(async (req, res, next) => {
  const request = new Request(
    `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    { method: req.method, headers: req.headers as any, body: req.method !== 'GET' ? req : null }
  );
  if (!rpc.match(request)) return next();
  const response = await rpc.handle(request);
  res.status(response.status);
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.send(Buffer.from(await response.arrayBuffer()));
});
```

### Hono

```typescript
import { createHandler } from '@atom-forge/rpc';
import { api } from './api';

const rpc = createHandler(api, '/rpc');
app.all('/rpc/*', (c) => rpc.handle(c.req.raw));
```

### Next.js (App Router)

```typescript
// app/rpc/[...path]/route.ts
import { createHandler } from '@atom-forge/rpc';
import { api } from '@/lib/api';

const rpc = createHandler(api, '/rpc');
export const GET = ({ request }: { request: Request }) => rpc.handle(request);
export const POST = GET;
```

### Nuxt 3

```typescript
// server/routes/rpc/[...path].ts
import { createHandler } from '@atom-forge/rpc';
import { toWebRequest } from 'h3';
import { api } from '~/lib/api';

const rpc = createHandler(api, '/rpc');
export default defineEventHandler((event) => rpc.handle(toWebRequest(event)));
```

> A `toWebRequest()` átalakítja az h3 eventet egy szabványos `Request` objektummá. A `defineEventHandler` natívan elfogad egy `Response` visszatérési értéket.
