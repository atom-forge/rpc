## Framework Adapters

`createHandler` works on standard `Request` → `Response`. Each framework needs ~2–5 lines of adapter code.

### SvelteKit

```typescript
// src/routes/rpc/[...path]/+server.ts
import {createHandler} from '@atom-forge/rpc';
import {api} from '$lib/api';

const rpc = createHandler(api, '/rpc');
export const GET = ({request}) => rpc.handle(request);
export const POST = GET;
```

**Alternative: `hooks.server.ts`**

Instead of a route file, you can intercept RPC requests directly in the server hook — useful if you already have a `hooks.server.ts` or prefer to keep all server logic in one place:

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

No route file needed. The hook runs before SvelteKit's router, so it's marginally faster and doesn't require a `src/routes/rpc/` directory.

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

> `toWebRequest()` converts the h3 event into a standard `Request`. `defineEventHandler` natively accepts a `Response` return value.
