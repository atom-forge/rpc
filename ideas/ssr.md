# SSR Client Handler

In SSR contexts (Next.js, SvelteKit, Nuxt, plain Node.js), your server-side
code and the RPC handler run in the same process. Making HTTP requests to
your own server is wasteful — it adds network overhead, serialization
round-trips, and latency for no benefit.

The SSR client handler solves this by replacing the `fetch` transport with a
direct in-process call to the RPC handler.

## Setup

Call `configureSsrHandler` once at server startup, before handling any
requests. From that point on, every `createClient` call on the server
automatically uses the handler directly instead of fetch.

```ts
import { configureSsrHandler } from '@atom-forge/rpc';
import { rpcHandler } from './handler';

configureSsrHandler(rpcHandler);
```

`configureSsrHandler` also accepts a raw transport function for testing or
advanced scenarios:

```ts
configureSsrHandler((req) => myCustomHandler.handle(req));
```

In the browser, `configureSsrHandler` is never called, so `createClient`
falls back to the normal `fetch`-based transport.

## Usage

After setup, `createClient` works identically on server and browser — no
conditional logic needed:

```ts
// Same code runs on server and in the browser
const [api] = createClient<MyApi>('/api');
const result = await api.users.get({ id: 1 }).$get();
// server  → handler.handle() called directly, no HTTP
// browser → fetch('/api/users.get')
```

## Cookies and authentication

`configureSsrHandler` is module-level — it solves the transport, but not
per-request data. In the browser, `fetch` sends cookies automatically via
`credentials: "include"`. The SSR transport has no such mechanism: the
synthetic `Request` has no cookies from the incoming HTTP request.

If your RPC handlers depend on cookies (session IDs, auth tokens), you need
to forward them explicitly. The approach depends on the framework.

### `withSsrTransport` — Express, SvelteKit, plain Node.js

For frameworks that expose a `next()` function, `withSsrTransport` wraps the
entire request handling in an `AsyncLocalStorage` context. It sets both the
handler and the incoming request's headers so they are automatically
forwarded to every synthetic request within that async chain.

```ts
// Express
app.use((req, res, next) => {
    withSsrTransport(rpcHandler, req, next);
});

// SvelteKit — src/hooks.server.ts
export const handle = ({ event, resolve }) =>
    withSsrTransport(rpcHandler, event.request, () => resolve(event));
```

Any `createClient` call made within the request lifecycle automatically
inherits the incoming cookies and auth headers — no further setup needed.

### Nuxt

Nuxt's Nitro server middleware has no explicit `next()` — if you return a
value it becomes the response, otherwise Nitro continues automatically.
`withSsrTransport` cannot cleanly wrap the rendering pipeline here.

Nuxt however provides its own per-request context primitives
(`useRequestHeaders`, `useRequestEvent`) that solve the same problem
idiomatically. Use a server-side Nuxt plugin that runs on every request:

```ts
// plugins/rpc.server.ts
export default defineNuxtPlugin(() => {
    const headers = useRequestHeaders(['cookie', 'authorization']);
    const [, cfg] = createClient<MyApi>('/api');
    cfg.$ = (ctx, next) => {
        if (headers.cookie) ctx.request.headers.set('cookie', headers.cookie);
        return next();
    };
});
```

`configureSsrHandler` is still needed to set up the transport — do that once
in `server/plugins/rpc.ts` at startup:

```ts
// server/plugins/rpc.ts
export default defineNitroPlugin(() => {
    configureSsrHandler(rpcHandler);
});
```

### Next.js — Server Components

In the App Router, `cookies()` from `next/headers` provides access to the
incoming request's cookies within any Server Component or server action.
Forward them via a client middleware the same way as Nuxt above.

```ts
import { cookies } from 'next/headers';

const cookieHeader = (await cookies()).toString();
const [, cfg] = createClient<MyApi>('/api');
cfg.$ = (ctx, next) => {
    ctx.request.headers.set('cookie', cookieHeader);
    return next();
};
```

## Implementation notes

### URL construction

In Node.js without a window, `new URL('/api/...')` throws because there is
no origin. The SSR transport constructs the synthetic `Request` with a dummy
absolute base (`http://localhost`) — the handler only inspects `pathname`,
so the host value is irrelevant.

### Progress tracking

The browser transport uses `XMLHttpRequest` to report upload/download
progress when `options.onProgress` is set. The SSR transport has no network
and therefore cannot report progress — `onProgress` callbacks are silently
ignored.

### Single-handler assumption

`configureSsrHandler` is module-level state: one handler per process. If
your app composes multiple `RpcHandler` instances mounted at different
prefixes, pass a custom transport function that dispatches to the correct
handler based on the request URL.
