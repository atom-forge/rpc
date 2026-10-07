# @atom-forge/rpc — AI Usage Guide

Start here when using `@atom-forge/rpc` in a TypeScript application. This guide covers the mental model, essential rules, and a minimal working flow. Read the linked English documentation for detailed API behavior; do not invent APIs or framework-specific adapter signatures.

## Mental model

Rpc is a framework-agnostic, end-to-end type-safe RPC framework built on standard Web API `Request`/`Response` objects. Define a nested API object on the server, expose it through `createHandler`, and pass its **type** to `createClient`. The client proxy mirrors the API structure. MessagePack is the default transport; JSON and file uploads are also supported.

```bash
npm install @atom-forge/rpc zod
```

Zod is a peer dependency (version 4 or later). Import `z` from `zod`, not from `@atom-forge/rpc`.

## Essential rules

1. **Keep server code on the server.** Use `import type` to share the API definition with the client; do not bundle server implementations or secrets into browser code.
2. **Match endpoint kinds.** Define `rpc.query`, `rpc.get`, or `rpc.command`; call them with `$query`, `$get`, or `$command`, respectively. Queries and gets use GET; commands use POST. Use commands for mutations.
3. **Validate untrusted input.** TypeScript types do not validate requests at runtime. Use `rpc.zod({ ... })` for runtime validation. Plain `get` query parameters arrive as strings, so account for that in schemas.
4. **Use the same base path on both sides.** For example, pair `createHandler(api, '/rpc')` with `createClient<typeof api>('/rpc')`.
5. **Wire the framework's actual Web Request.** `handler.handle(request)` accepts a `Request`, not a framework event or context. Adapter signatures differ by framework; use the framework's current request-handler signature.
6. **Return the middleware result.** In both server and client middleware, use `return await next()`, or return the saved result after post-processing. An intentional early exit may skip `next()`.
7. **Inspect `RpcResponse`, not just HTTP status.** Calls return a response wrapper. Use `res.isOK()` before reading success data from `res.result`, and `res.isError(code?)` for errors. Application errors, including Zod failures, normally use HTTP 200.
8. **Distinguish error layers.** Application codes include `INVALID_ARGUMENT` and `PERMISSION_DENIED`; HTTP errors use codes such as `HTTP:401`; network failures use `NETWORK_ERROR`. Use `rpc.error` helpers for application errors and `ctx.status` for HTTP status.
9. **Do not construct endpoint URLs manually.** Client paths are dot-separated and kebab-case: `client.posts.getById.$query(...)` targets `/rpc/posts.get-by-id`. Framework routes must accept these paths (typically with a catch-all route).
10. **Let the client encode requests.** Queries use MessagePack encoded in the URL; commands use a request body. File arguments automatically switch commands to multipart encoding. For file arrays, use a key ending in `[]`.

## Minimal server-to-client flow

### 1. Define and expose the server API

```typescript
// server/api.ts
import { createHandler, rpc } from '@atom-forge/rpc';
import { z } from 'zod';

export const api = {
  posts: {
    getById: rpc.zod({ id: z.number().int().positive() }).query(async ({ id }) => {
      return { id, title: 'Hello' };
    }),
    create: rpc.zod({ title: z.string().min(1) }).command(async ({ title }) => {
      return { id: 1, title };
    }),
  },
};

export const handler = createHandler(api, '/rpc');
```

Wire incoming RPC requests to `handler.handle(request)` and return its `Response`. When intercepting requests in a shared hook, first check `handler.match(request)` and let unrelated requests continue normally. See [framework adapters](docs/en/framework-adapters.md) for integration examples.

### 2. Create and use the typed client

```typescript
// client/api.ts
import { createClient } from '@atom-forge/rpc';
import type { api } from '../server/api';

export const [client, cfg] = createClient<typeof api>('/rpc');

const res = await client.posts.getById.$query({ id: 1 });
if (res.isOK()) {
  console.log(res.result.title);
} else if (res.isError('INVALID_ARGUMENT')) {
  console.error('Invalid input', res.result);
} else {
  console.error(res.status, res.result);
}
```

The relative import above illustrates the type-only connection; adapt it to your application's directory structure.

## Common extensions

- **Custom server context:** use `rpcFactory<AppContext>()` for typed endpoints and `createHandler`'s `createServerContext` option to supply the runtime context.
- **Server middleware:** define it with `makeServerMiddleware`, then attach it with `rpc.middleware(mw)` or `.on(group)`. Context exposes request/response headers, cookies, status, GET caching, and shared `ctx.env` state.
- **Client middleware:** define it with `makeClientMiddleware`. Assign `cfg.$ = mw` globally, `cfg.posts.$ = mw` for a group, or `cfg.posts.create = mw` for one endpoint. Arrays attach multiple middleware functions.
- **Debug logging:** attach `clientLogger('/rpc')` to `cfg.$`; its base URL must match the client's.
- **Cancellation and progress:** pass `abortSignal` and/or `onProgress` in call options. Progress tracking uses XHR instead of fetch.
- **File uploads:** call `$command({ file })` or `$command({ 'files[]': files })` with `File` values.
- **Result types:** `RpcResult<typeof client.posts.getById>` extracts an endpoint's success result type.
- **In-process tests:** `client.posts.getById.$query.handle(handler, { id: 1 })` builds a request, invokes the handler, and decodes the response without an HTTP server. Alternatively use `.request(args, options)` and `.response(response)`. Request building does not execute client middleware; provide test headers/cookies explicitly in call options.

## Detailed English documentation

Read only the sections relevant to the task rather than loading the entire reference:

| Document | Use it for |
| --- | --- |
| [Documentation index](docs/en/index.md) | Overview and navigation |
| [Getting started](docs/en/getting-started.md) | Installation and the basic server/client setup |
| [Server-side usage](docs/en/server-side-usage.md) | Endpoint definitions, Zod validation, context, middleware, status, cookies, and error helpers |
| [Client-side usage](docs/en/client-side-usage.md) | Calls, response narrowing, result types, middleware, uploads, options, and in-process testing |
| [Framework adapters](docs/en/framework-adapters.md) | SvelteKit, Next.js, Nuxt, Express, and Hono integration |
| [Communication protocol](docs/en/communication-protocol.md) | Wire formats, content negotiation, and response headers |

For implementation-sensitive questions, verify the installed version's types and source rather than assuming behavior from another RPC library. See [CHANGELOG.md](CHANGELOG.md) for version changes and [LICENSE](LICENSE) for usage terms.
