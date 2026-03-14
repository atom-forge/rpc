# Rpc — LLM Reference

Rpc is a full-stack TypeScript RPC framework for SvelteKit. It provides end-to-end type safety between server and client using MessagePack as the primary transport protocol.

## Package

```bash
npm install @atom-forge/rpc
pnpm add @atom-forge/rpc
yarn add @atom-forge/rpc
bun add @atom-forge/rpc
```

## Exports

```typescript
import { createClient, makeClientMiddleware, RpcResponse } from '@atom-forge/rpc'; // client
import { createHandler, rpc, rpcFactory, makeServerMiddleware, invalidArgument, permissionDenied, internalError } from '@atom-forge/rpc'; // server
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
import { rpc } from '@atom-forge/rpc';
import { z } from 'zod';

rpc.zod({ id: z.number(), name: z.string() }).query(...)
rpc.zod({ ... }).command(...)
rpc.zod({ ... }).get(...)
```

Add server middleware:

```typescript
rpc.middleware(mw).query(...)
rpc.middleware(mw).command(...)
rpc.middleware(mw).zod({ ... }).command(...)
rpc.middleware(mw).on(existingObject)  // attach to any object
```

### `createHandler`

```typescript
const [handler, definition] = createHandler(apiObject, {
  createServerContext?: (args, event: RequestEvent) => ServerContext
});
```

- `handler`: `(event: RequestEvent) => Promise<Response>` — wire this to your SvelteKit route.
- `definition`: the same `apiObject`, typed. Export this and import its `typeof` on the client.
- Accepted HTTP methods: `GET` for `query`/`get`, `POST` for `command`.
- Accepted `Content-Type` for POST: `application/msgpack` (default), `application/json`, `multipart/form-data`. Unknown `Content-Type` → `415 Unsupported Media Type`.

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
  { isAdmin: (ctx) => ctx.event.locals.user?.role === 'admin' }  // attached to the function object
);

// Call accessors from endpoint implementations by passing ctx:
const api = {
  admin: {
    deletePost: rpc.middleware(mw).command(async ({ id }, ctx) => {
      if (!mw.isAdmin(ctx)) { ctx.status.forbidden(); return { error: 'Admin only' }; }
    }),
  },
};
```

### `ServerContext` — `ctx` properties

| Property | Type | Description |
|---|---|---|
| `ctx.event` | `RequestEvent` | Raw SvelteKit event |
| `ctx.args` | `Map<string, any>` | Parsed request arguments |
| `ctx.getArgs()` | `() => Record<string, any>` | Args as plain object |
| `ctx.cookies` | `Cookies` | Shorthand for `ctx.event.cookies` |
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
const [api, cfg] = createClient<typeof definition>(
  baseUrl: string = '/api',
  options?: { debug?: boolean }
);
```

- `api`: recursive proxy matching the server API shape.
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
  debug?: boolean;
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
cfg.$ = mw                   // global (all routes)
cfg.posts.$ = mw             // all endpoints under /posts
cfg.posts.create = mw        // single endpoint /posts/create
cfg.posts.create = [mw1, mw2] // multiple middlewares
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

Client-side calls generate dot-separated, fully kebab-case URLs. For example, `api.posts.getById.$query(...)` maps to `/api/rpc/posts.get-by-id`.

## SvelteKit wiring example

```typescript
// src/routes/api/rpc/[path]/+server.ts
import { handler } from '$lib/server/rpc';
export const GET = handler;
export const POST = handler;
```

Use `[path]` (not `[...path]`) so the dot-separated route is treated as a single segment.

