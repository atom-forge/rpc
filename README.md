# Rpc

Rpc is a full-stack RPC (Remote Procedure Call) framework for TypeScript projects. It simplifies the communication between the client and the server by providing a type-safe API.

## Installation

```bash
npm install @atom-forge/rpc
pnpm add @atom-forge/rpc
yarn add @atom-forge/rpc
bun add @atom-forge/rpc
```

## Core Concept: End-to-End Type Safety

Rpc's main feature is providing end-to-end type safety between your server and client. You define your API on the server, and then share the type of that definition with the client. This gives you autocompletion and type checking for your API calls.

**1. Define your API and create a handler on the server:**

```typescript
// src/hooks.server.ts (or your server's entry point)
import { createHandler, rpc } from '@atom-forge/rpc';

const api = {
  posts: {
    list: rpc.query(async ({ page }: { page: number }, ctx) => {
      // ... fetch posts
      return { posts: [{ id: 1, title: 'Hello' }] };
    }),
    create: rpc.command(async ({ title }: { title: string }) => {
      // ... create post
      return { success: true };
    }),
  },
};

// The handler and the definition are created here.
// The definition is what we'll use on the client.
export const [handler, definition] = createHandler(api);
```

**2. Use the type on the client:**

```typescript
// src/lib/client/rpc.ts
import { createClient } from '@atom-forge/rpc';
import { definition } from '../../hooks.server'; // Import the definition object

const [api, cfg] = createClient<typeof definition>('/api/rpc');

// Every call returns a RpcResponse
const res = await api.posts.list.$query({ page: 1 });
if (res.isOK()) {
  console.log(res.result); // typed as { posts: { id: number, title: string }[] }
}

await api.posts.create.$command({ title: 'My New Post' });

export default api;
```

## Communication Protocol

Rpc uses **MessagePack** as its primary communication protocol for efficiency and performance. For clients that do not support MessagePack, it can fall back to **JSON**.

- **`$command`**: Sends data in the request body, encoded with MessagePack (`application/msgpack`). Plain JSON (`application/json`) is also accepted by the server.
- **`$query`**: Sends data in the URL's query string, encoded with MessagePack and Base64. This is the recommended method for queries.
- **`$get`**: Sends data as plain text in the URL's query string. This is useful for clients that do not support MessagePack, or for simple, non-complex queries.

The server will automatically detect the client's `Accept` header and respond with either MessagePack or JSON.

### Response Headers

Every response includes the following headers:

| Header | Description |
|---|---|
| `x-atom-forge-rpc-exec-time` | Server-side execution time in milliseconds. |

## Client-side Usage

### `createClient`

The `createClient` function is used to create a new API client. The way you call an endpoint on the client (`$query` or `$get`) must match how it was defined on the server (`rpc.query` or `rpc.get`).

```typescript
import { createClient } from '@atom-forge/rpc';
import { definition } from '../../hooks.server'; // Import the definition object from your server

const [api, cfg] = createClient<typeof definition>('/api/rpc');

// If the server endpoint is defined with rpc.query:
const result = await api.posts.list.$query({ page: 1 });

// Example of calling a command
await api.posts.create.$command({ title: 'Hello World' });
```

You can also enable debug logging for all calls made through the client:

```typescript
const [api, cfg] = createClient<typeof definition>('/api/rpc', { debug: true });
```

### Call Options

Every RPC method (`$command`, `$query`, `$get`) accepts an optional second argument with per-call options:

```typescript
const result = await api.posts.list.$query({ page: 1 }, {
  // Abort the request using an AbortController
  abortSignal: controller.signal,

  // Track upload/download progress (uses XHR internally)
  onProgress: ({ loaded, total, percent, phase }) => {
    console.log(`${phase}: ${percent}%`);
  },

  // Add custom request headers for this call only
  headers: new Headers({ 'X-Custom-Header': 'value' }),

  // Enable per-call debug logging
  debug: true,
});
```

### `RpcResponse`

Every RPC call returns a `RpcResponse` with these members:

| Member | Description |
|---|---|
| `res.isOK()` | `true` if the call succeeded |
| `res.isError(code?)` | `true` if error; optionally checks a specific code |
| `res.status` | `'OK'` on success, or the error code string |
| `res.result` | Typed success data, or error details |
| `res.ctx` | The full `ClientContext` for this call |

**Error code format:**
- Application-level errors: `'INVALID_ARGUMENT'`, `'PERMISSION_DENIED'`, custom codes, etc.
- Transport errors: `'HTTP:401'`, `'HTTP:404'`, `'HTTP:500'`, etc.
- Network errors: `'NETWORK_ERROR'`

```typescript
const res = await api.posts.create.$command({ title: 'Hello' });

if (res.isOK()) {
  console.log(res.result);             // typed result
} else if (res.isError('INVALID_ARGUMENT')) {
  console.log(res.result.message);     // error details
} else if (res.isError('HTTP:401')) {
  // redirect to login
} else {
  console.log(res.status, res.result); // any other error
}

// Access context (response headers, elapsed time, etc.)
console.log(res.ctx.response?.status);
console.log(res.ctx.elapsedTime);
```

### File Uploads

`$command` endpoints automatically detect `File` or `File[]` values in the arguments and switch to a `multipart/form-data` request. You can combine file uploads with regular arguments and track progress.

```typescript
// Server-side
const api = {
  posts: {
    create: rpc.command(async ({ title, cover }: { title: string; cover: File }) => {
      // cover is a File object
    }),
  },
};

// Client-side
const coverFile = document.querySelector('input[type=file]').files[0];

await api.posts.create.$command(
  { title: 'Hello', cover: coverFile },
  {
    onProgress: ({ percent, phase }) => console.log(`${phase}: ${percent}%`),
  }
);
```

For multiple files, use an array and suffix the key with `[]`:

```typescript
// Server-side
const api = {
  media: {
    upload: rpc.command(async ({ files }: { files: File[] }) => { ... }),
  },
};

// Client-side
await api.media.upload.$command({ 'files[]': selectedFiles });
```

### `makeClientMiddleware`

The `makeClientMiddleware` function is used to create a client-side middleware.

> ⚠️ **Always `return await next()`** in your middleware. If you call `next()` without returning its result, the response will be lost and the caller will receive `undefined`.

```typescript
import { makeClientMiddleware } from '@atom-forge/rpc';

const loggerMiddleware = makeClientMiddleware(async (ctx, next) => {
  console.log('Request:', ctx.path, ctx.getArgs());
  const result = await next(); // ✅ always return the result of next()
  console.log('Response:', ctx.result);
  return result;
});

// Apply middleware to all routes
cfg.$ = loggerMiddleware;
```

## Server-side Usage

### `createHandler`

The `createHandler` function creates a request handler for your server and returns the handler and a typed API definition.

```typescript
import { createHandler, rpc } from '@atom-forge/rpc';

const api = {
  posts: {
    // This endpoint expects a $query call from the client
    list: rpc.query(async ({ page }, ctx) => {
      ctx.cache.set(60);
      return { posts: [] };
    }),
    // This endpoint expects a $get call from the client
    getById: rpc.get(async ({ id }, ctx) => {
      return { id, title: 'Example Post' };
    }),
    // This endpoint expects a $command call from the client
    create: rpc.command(async ({ title }) => {
      // create a new post
    }),
  },
};

export const [handler, definition] = createHandler(api);
```

#### Custom Server Context

You can provide a custom server context factory to inject your own properties (e.g. authenticated user) into every handler:

```typescript
import { createHandler, ServerContext } from '@atom-forge/rpc';

class AppContext extends ServerContext {
  get user() {
    return this.event.locals.user;
  }
}

export const [handler, definition] = createHandler(api, {
  createServerContext: (args, event) => new AppContext(args, event),
});
```

### `rpc` object

The `rpc` object provides methods for defining your API endpoints. The method you use on the server determines how the client must call the endpoint.

*   `rpc.query`: Defines a query endpoint that expects arguments encoded with MessagePack. The client must use **`$query`**.
*   `rpc.get`: Defines a query endpoint that expects arguments as plain text in the URL. The client must use **`$get`**.
*   `rpc.command`: Defines a command endpoint. The client must use **`$command`**.

#### `rpcFactory`

If you use a custom server context (see above), use `rpcFactory` to create a typed `rpc` instance so that `ctx` is properly typed in your handlers:

```typescript
import { rpcFactory } from '@atom-forge/rpc';

const rpc = rpcFactory<AppContext>();

const api = {
  posts: {
    list: rpc.query(async ({ page }, ctx) => {
      // ctx is typed as AppContext
      const user = ctx.user;
      return { posts: [] };
    }),
  },
};
```

### Server Context (`ctx`)

Every handler and server-side middleware receives a `ctx` object with the following members:

| Member | Description |
|---|---|
| `ctx.event` | The raw SvelteKit `RequestEvent`. |
| `ctx.getArgs()` | Returns all arguments as a plain object. |
| `ctx.args` | The arguments as a `Map<string, any>`. |
| `ctx.cookies` | Shorthand for `ctx.event.cookies`. |
| `ctx.headers.request` | The incoming request headers. |
| `ctx.headers.response` | The mutable response headers. |
| `ctx.cache.set(seconds)` | Sets the `Cache-Control` max-age for GET responses. |
| `ctx.cache.get()` | Returns the current cache duration. |
| `ctx.status.set(code)` | Sets the HTTP response status code. |
| `ctx.status.notFound()` | Shorthand for common HTTP codes (see below). |
| `ctx.env` | A `Map<string\|symbol, any>` for passing data between middlewares. |
| `ctx.elapsedTime` | Server-side elapsed time in milliseconds. |

**Status shortcuts:** `ok`, `created`, `accepted`, `noContent`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `methodNotAllowed`, `conflict`, `tooManyRequests`, `serverError`, `serviceUnavailable`, and more.

### Caching

Rpc supports server-side caching for `GET` requests (both `rpc.query` and `rpc.get`). You can set the cache duration in seconds using the `ctx.cache.set()` method within your endpoint implementation.

```typescript
const api = {
  posts: {
    list: rpc.query(async ({ page }, ctx) => {
      ctx.cache.set(60); // Cache the response for 60 seconds
      return { posts: [] };
    }),
  },
};
```

### Error Handling

Use the built-in error helpers to return application-level errors from handlers. These always produce a `200 OK` response with the `atomforge.rpc.error` key, so the client receives a typed `RpcResponse`.

```typescript
import { rpc } from '@atom-forge/rpc';

const api = {
  posts: {
    create: rpc.command(async ({ title }, ctx) => {
      if (!ctx.event.locals.user) return rpc.error.permissionDenied();
      if (title.length < 3) return rpc.error.invalidArgument({ message: 'Title too short' });
      // ...
      return { id: 1, title };
    }),
  },
};
```

Use `rpc.error.make` for custom error codes:

```typescript
return rpc.error.make('POST_ALREADY_EXISTS', 'This slug already exists', { slug: post.slug });
```

| Method | Error code | Use when |
|---|---|---|
| `rpc.error.invalidArgument(details?)` | `INVALID_ARGUMENT` | Business logic validation (beyond Zod) |
| `rpc.error.permissionDenied(details?)` | `PERMISSION_DENIED` | Authorization failure |
| `rpc.error.internalError(details?)` | `INTERNAL_ERROR` | Handled internal failure (auto `correlationId`) |
| `rpc.error.make(code, message?, result?)` | custom | Any custom error code |

### `zod` integration

Rpc has built-in support for `zod` for input validation. Install `zod` as a dependency of your project and import it directly.

If validation fails, Rpc automatically returns an application-level error (`200 OK`) with code `INVALID_ARGUMENT` and the `ZodIssue` array in the `issues` field. The handler does not run.

```typescript
// Server-side
import { rpc } from '@atom-forge/rpc';
import { z } from 'zod';

const api = {
  posts: {
    create: rpc.zod({
      title: z.string().min(3, "Title must be at least 3 characters long."),
      content: z.string().min(10),
    }).command(async ({ title, content }) => {
      // This code only runs if validation passes
    }),
  },
};
```

`rpc.zod` also works with `query` and `get`:

```typescript
rpc.zod({ id: z.number() }).query(async ({ id }, ctx) => { ... })
rpc.zod({ id: z.number() }).get(async ({ id }, ctx) => { ... })
```

Handle validation errors on the client via `RpcResponse`:

```typescript
// Client-side
const res = await api.posts.create.$command({ title: 'Hi' });
if (res.isError('INVALID_ARGUMENT')) {
  console.log(res.result.issues); // ZodIssue[]
}
```

### `makeServerMiddleware`

The `makeServerMiddleware` function is used to create a server-side middleware. An optional second argument lets you attach accessor functions to the middleware, which is useful for creating reusable, self-contained middleware with helpers.

> ⚠️ **Always `return await next()`** in your middleware. If you call `next()` without returning its result, the handler's return value will be lost and the client will receive `undefined`.

```typescript
import { makeServerMiddleware } from '@atom-forge/rpc';

const authMiddleware = makeServerMiddleware(
  async (ctx, next) => {
    if (!ctx.event.locals.user) {
      ctx.status.unauthorized();
      return { error: 'Unauthorized' }; // ✅ early return, no next() call needed
    }
    return await next(); // ✅ always return the result of next()
  },
  // Optional accessors attached to the middleware function itself
  {
    isAdmin: (ctx) => ctx.event.locals.user?.role === 'admin',
  }
);
```

The accessor functions are attached directly to the middleware function object, keeping the middleware and its associated helpers co-located. Call them from within endpoint implementations by passing `ctx`:

```typescript
const api = {
  admin: {
    deletePost: rpc.middleware(authMiddleware).command(async ({ id }, ctx) => {
      if (!authMiddleware.isAdmin(ctx)) {
        ctx.status.forbidden();
        return { error: 'Admin only' };
      }
      // proceed...
    }),
  },
};
```

This pattern keeps the middleware's knowledge — what constitutes an `isAdmin` check — in one place rather than repeating the logic in every endpoint.

### Applying Middleware with `rpc.middleware`

Use `rpc.middleware()` to attach one or more server middlewares to an endpoint:

```typescript
import { rpc } from '@atom-forge/rpc';
import { z } from 'zod';

// Apply middleware to a specific endpoint
const api = {
  posts: {
    create: rpc.middleware(authMiddleware).command(async ({ title }) => {
      // ...
    }),
    // Combine middleware with zod validation
    update: rpc.middleware(authMiddleware).zod({
      id: z.number(),
      title: z.string(),
    }).command(async ({ id, title }) => {
      // ...
    }),
  },
};
```

You can also attach middleware to any existing object with `.on()`:

```typescript
const postsApi = {
  list: rpc.query(async () => { ... }),
  create: rpc.command(async () => { ... }),
};

// Attach authMiddleware to the whole postsApi group
rpc.middleware(authMiddleware).on(postsApi);

const api = { posts: postsApi };
```
