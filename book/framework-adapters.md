---
title: Framework Adapters
type: chapter
---
# Framework Adapters

`createHandler` works on standard `Request` → `Response`. Each framework needs ~2–5 lines of adapter code.

The adapter is the integration boundary, not a second API implementation. It receives the framework's incoming request, passes a standard Web API `Request` to Rpc, and returns the resulting `Response` without losing its status, headers, or body. Keep the mounted path aligned with the base path passed to both `createHandler` and `createClient`.

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

A dedicated route keeps ownership of `/rpc` visible in the route tree. A hook is useful when requests already pass through centralized server logic, but it must let non-RPC traffic continue to `resolve`. In either arrangement, review where authentication runs: intercepting a request earlier in the framework lifecycle can change which application hooks or middleware it reaches.

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

Express requires more bridging because its request and response objects are not the Web API objects used by Rpc. Preserve the incoming body for the handler rather than consuming it first with an unrelated body parser. When adapting this example to your Node.js runtime, check its requirements for constructing a `Request` from a streaming body, and test commands and uploads as well as GET requests.

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

After mounting an adapter, verify one query and one command through the actual application server. In-process handler tests cannot catch a missing route export, a consumed request body, or response headers dropped by an adapter. If the framework already supplies a standard `Request`, prefer forwarding it directly instead of reconstructing it.
