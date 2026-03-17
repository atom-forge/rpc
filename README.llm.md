# Rpc — LLM Reference

Rpc is a full-stack TypeScript RPC framework. **Framework-agnostic** — works with SvelteKit, Next.js, Nuxt, Express, Hono, and any runtime that supports the Web API `Request`/`Response`. It provides end-to-end type safety between server and client using MessagePack as the primary transport protocol.

## Package

```bash
npm install @atom-forge/rpc
pnpm add @atom-forge/rpc
yarn add @atom-forge/rpc
bun add @atom-forge/rpc
```

## Exports

```typescript
import { createClient, makeClientMiddleware, clientLogger, RpcResponse } from '@atom-forge/rpc'; // client
import { createCoreHandler, flattenApiDefinition, rpc, rpcFactory, makeServerMiddleware } from '@atom-forge/rpc'; // server
import { z } from 'zod'; // install zod as a peer dependency in your project
```

---

## Server

### Defining endpoints

Use the `rpc` singleton (or a typed instance from `rpcFactory<CTX>()`) to define endpoints:

```typescript
rpc.query(async (args, ctx) => result)    // GET /path?args=<msgpack+base64>
rpc.get(async (args, ctx) => result)      // GET /path?key=value (plain strings)
rpc.command(async (args, ctx) => result)  // POST /path (body: msgpack or JSON)
```

Add Zod validation (import `z` from `zod` directly):

```typescript
rpc.zod({ id: z.number(), name: z.string() }).query(...)
rpc.zod({ ... }).command(...)
rpc.zod({ ... }).get(...)
```

Add server middleware:

```typescript
rpc.middleware(mw).query(...)
rpc.middleware(mw).command(...)
rpc.middleware(mw).zod({ ... }).command(...)
rpc.middleware(mw).on(existingObject)  // attach to any object/group
```

### `flattenApiDefinition` + `createCoreHandler`

```typescript
const endpointMap = flattenApiDefinition(apiObject);

const handle = createCoreHandler(endpointMap, {
  createServerContext?: (args, request: Request, adapterContext: TAdapter) => ServerContext<TAdapter>
});

// handle signature:
// (request: Request, routeInfo: { path: string }, adapterContext?: TAdapter) => Promise<Response>
```

- Accepted HTTP methods: `GET` for `query`/`get`, `POST` for `command`.
- Accepted `Content-Type` for POST: `application/msgpack` (default), `application/json`, `multipart/form-data`. Unknown → `415`.
- `adapterContext` is passed through as `ctx.adapterContext` in every handler.

### Framework adapter wiring

**SvelteKit** — route file `src/routes/rpc/[...path]/+server.ts`:
```typescript
const handle = createCoreHandler(flattenApiDefinition(api));
export const GET = (event) => handle(event.request, { path: event.params.path }, event);
export const POST = GET;
// ctx.adapterContext === RequestEvent
```

**SvelteKit** — alternative via `src/hooks.server.ts` (no route file needed):
```typescript
const handleRpc = createCoreHandler(flattenApiDefinition(api));
export const handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/rpc/')) {
    return handleRpc(event.request, { path: event.url.pathname.slice('/rpc/'.length) }, event);
  }
  return resolve(event);
};
```

**Next.js App Router** — `app/rpc/[...path]/route.ts`:
```typescript
const handle = createCoreHandler(flattenApiDefinition(api));
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;           // params is a Promise in Next.js 15+
  return handle(request, { path: path.join('.') }, { request, params });
}
export const POST = GET;
```

**Nuxt 3** — `server/routes/rpc/[...path].ts`:
```typescript
import { getRouterParam, toWebRequest } from 'h3';
const handle = createCoreHandler(flattenApiDefinition(api));
export default defineEventHandler(async (event) => {
  return handle(toWebRequest(event), { path: getRouterParam(event, 'path') ?? '' }, event);
});
```

**Express**:
```typescript
const handle = createCoreHandler(flattenApiDefinition(api));
app.all('/rpc/:path', async (req, res) => {
  const request = new Request(`${req.protocol}://${req.get('host')}${req.originalUrl}`,
    { method: req.method, headers: req.headers as any, body: req.method !== 'GET' ? req : null });
  const response = await handle(request, { path: req.params.path }, { req, res });
  res.status(response.status);
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.send(Buffer.from(await response.arrayBuffer()));
});
```

**Hono**:
```typescript
const handle = createCoreHandler(flattenApiDefinition(api));
app.all('/rpc/:path', (c) => handle(c.req.raw, { path: c.req.param('path') }, c));
```

### `rpcFactory`

Creates a typed `rpc` instance bound to a custom context type:

```typescript
const rpc = rpcFactory<AppContext>();
```

### `makeServerMiddleware`

> ⚠️ Always `return await next()` — omitting the `return` silently drops the handler's result.

```typescript
const mw = makeServerMiddleware(
  async (ctx, next) => {
    // early exit without calling next() is valid:
    // ctx.status.unauthorized(); return { error: '...' };
    return await next(); // ✅ must return
  },
  { isAdmin: (ctx) => (ctx.adapterContext as RequestEvent).locals.user?.role === 'admin' }
);

// Accessor functions are attached to the middleware function object itself:
const api = {
  admin: {
    deletePost: rpc.middleware(mw).command(async ({ id }, ctx) => {
      if (!mw.isAdmin(ctx)) { ctx.status.forbidden(); return { error: 'Admin only' }; }
    }),
  },
};
```

### `ServerContext<TAdapter>` — `ctx` properties

| Property | Type | Description |
|---|---|---|
| `ctx.request` | `Request` | Standard Web API Request object |
| `ctx.adapterContext` | `TAdapter` | Framework-specific context (e.g. `RequestEvent`, Hono `Context`) |
| `ctx.args` | `Map<string, any>` | Parsed request arguments |
| `ctx.getArgs()` | `() => Record<string, any>` | Args as plain object |
| `ctx.cookies` | `CookieManager` | `get(name)`, `set(name, value, opts?)`, `delete(name, opts?)`, `getAll()` |
| `ctx.headers.request` | `Headers` | Incoming request headers |
| `ctx.headers.response` | `Headers` | Mutable outgoing response headers |
| `ctx.cache.set(n)` | `(seconds: number) => void` | Set `Cache-Control` max-age (GET only) |
| `ctx.cache.get()` | `() => number` | Get current cache value |
| `ctx.status.set(n)` | `(code: number) => void` | Set response status code |
| `ctx.status.<shortcut>()` | `() => void` | e.g. `notFound()`, `unauthorized()`, `created()` |
| `ctx.env` | `Map<string\|symbol, any>` | Shared state across middlewares |
| `ctx.elapsedTime` | `number` | ms since context was created |

**All status shortcuts:** `continue`, `switchingProtocols`, `processing`, `ok`, `created`, `accepted`, `noContent`, `resetContent`, `partialContent`, `multipleChoices`, `movedPermanently`, `found`, `seeOther`, `notModified`, `temporaryRedirect`, `permanentRedirect`, `badRequest`, `unauthorized`, `paymentRequired`, `forbidden`, `notFound`, `methodNotAllowed`, `notAcceptable`, `conflict`, `gone`, `lengthRequired`, `preconditionFailed`, `payloadTooLarge`, `uriTooLong`, `badContent`, `rangeNotSatisfiable`, `expectationFailed`, `tooManyRequests`, `serverError`, `notImplemented`, `badGateway`, `serviceUnavailable`, `gatewayTimeout`, `httpVersionNotSupported`.

### Response headers sent by the server

| Header | When |
|---|---|
| `x-atom-forge-rpc-exec-time` | Always — server-side execution time in ms |
| `Content-Type` | `application/msgpack` or `application/json` (based on `Accept` header) |
| `Cache-Control` | Only on GET when `ctx.cache.set(n)` was called |
| `Set-Cookie` | When `ctx.cookies.set()` or `ctx.cookies.delete()` is called |

### Zod validation errors

Zod failures are returned as application-level errors (status `200 OK`):

- Body: `{ "atomforge.rpc.error": "INVALID_ARGUMENT", issues: ZodIssue[] }`

### Error helpers

Return these from handlers to signal application-level errors. All produce a `200 OK` response with the `atomforge.rpc.error` key set.

```typescript
return rpc.error.invalidArgument({ message: 'Title too short' })   // code: "INVALID_ARGUMENT"
return rpc.error.permissionDenied({ message: 'Admins only' })      // code: "PERMISSION_DENIED"
return rpc.error.internalError()                                   // code: "INTERNAL_ERROR", auto correlationId
return rpc.error.make('POST_ALREADY_EXISTS', 'Already exists', { slug: post.slug })  // custom
```

---

## Client

### `createClient`

```typescript
const [api, cfg] = createClient<typeof apiDefinition>(
  baseUrl: string = '/api'
);
```

- `api`: recursive proxy matching the server API shape. Use `typeof api` (the server-side api object) as the generic.
- `cfg`: middleware configuration proxy.

### Calling endpoints

Every call returns a `RpcResponse`. Use `isOK()` / `isError()` to branch:

```typescript
const res = await api.posts.list.$query(args, options?)
const res = await api.posts.create.$command(args, options?)
const res = await api.posts.getById.$get(args, options?)

if (res.isOK()) {
  const data = res.result  // typed success data
} else if (res.isError('INVALID_ARGUMENT')) {
  console.log(res.result)  // error details
} else if (res.isError('HTTP:401')) {
  // transport-level error
} else {
  console.log(res.status, res.result)
}
```

### `RpcResponse<TSuccess, TError>`

| Member | Description |
|---|---|
| `res.isOK()` | `true` if the call succeeded |
| `res.isError(code?)` | `true` if error; optional specific code check |
| `res.status` / `res.getStatus()` | `'OK'` on success, error code string otherwise |
| `res.result` / `res.getResult()` | Typed success data or error details |
| `res.ctx` / `res.getCtx()` | The full `ClientContext` for this call |

**Error code format:**
- Application-level errors: `'INVALID_ARGUMENT'`, `'PERMISSION_DENIED'`, `'NOT_FOUND'`, etc.
- Transport errors: `'HTTP:401'`, `'HTTP:404'`, `'HTTP:500'`, etc.
- Network errors: `'NETWORK_ERROR'`

### `CallOptions`

```typescript
type CallOptions = {
  abortSignal?: AbortSignal;
  onProgress?: (p: { loaded: number; total: number; percent: number; phase: 'upload' | 'download' }) => void;
  headers?: Headers;
}
```

- When `onProgress` is provided, the request uses **XHR** instead of `fetch`.

### File uploads

Pass `File` or `File[]` as an argument value in a `$command` call. Rpc automatically switches to `multipart/form-data`. For arrays, suffix the key with `[]`:

```typescript
await api.media.upload.$command({ 'files[]': fileArray });
```

### `ClientContext` properties

| Property | Type | Description |
|---|---|---|
| `ctx.result` | `T \| undefined` | The typed result |
| `ctx.response` | `Response \| undefined` | The raw Response object |
| `ctx.path` | `string[]` | Request path segments |
| `ctx.args` | `Map<string, any>` | Arguments map |
| `ctx.getArgs()` | `() => Record<string, any>` | Args as plain object |
| `ctx.rpcType` | `'query' \| 'command' \| 'get'` | RPC method type |
| `ctx.elapsedTime` | `number` | ms since context was created |
| `ctx.env` | `Map<string\|symbol, any>` | Shared state across middlewares |
| `ctx.abortSignal` | `AbortSignal \| undefined` | The abort signal if provided |
| `ctx.onProgress` | `OnProgress \| undefined` | The progress callback if provided |
| `ctx.request.headers` | `Headers` | Outgoing request headers |

### Applying client middleware

```typescript
cfg.$ = mw                    // global (all routes)
cfg.posts.$ = mw              // all endpoints under /posts
cfg.posts.create = mw         // single endpoint /posts/create
cfg.posts.create = [mw1, mw2] // multiple middlewares
```

### `clientLogger`

Built-in debug middleware. Logs path, args, result, timing, and HTTP status to the browser console.

```typescript
const [api, cfg] = createClient<typeof apiDefinition>('/rpc');
cfg.$ = clientLogger('/rpc'); // baseUrl must match createClient's baseUrl
```

### `makeClientMiddleware`

> ⚠️ Always `return await next()` — omitting the `return` silently drops the response.

```typescript
const mw = makeClientMiddleware(async (ctx, next) => {
  // before request
  const result = await next(); // ✅ must return
  // after request — ctx.result is available
  return result;
});
```

---

## Protocol details

| RPC type | HTTP method | Args encoding | Body |
|---|---|---|---|
| `get` | GET | `?key=value` (plain strings) | — |
| `query` | GET | `?args=<base64url(msgpack(args))>` | — |
| `command` (no files) | POST | — | `msgpack(args)` or `JSON(args)` |
| `command` (with files) | POST | — | `multipart/form-data` (args blob + file parts) |

Response body is `msgpack` by default. Send `Accept: application/json` to get JSON instead.

---

## URL format

Client-side calls generate dot-separated, fully kebab-case paths. For example, `api.posts.getById.$query(...)` maps to `/rpc/posts.get-by-id`.

Use `[...path]` (catch-all) in your framework's router so the dot-separated path is treated as a single segment. With Next.js (array params), join with `.`: `params.path.join('.')`.
