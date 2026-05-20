# Server-side Usage

## `createHandler`

`createHandler` creates a handler object for processing RPC requests.

```typescript
import {createHandler, rpc} from '@atom-forge/rpc';

const api = {
	posts: {
		// expects $query from the client
		list: rpc.query(async ({page}, ctx) => {
			ctx.cache.set(60);
			return {posts: []};
		}),
		// expects $get from the client
		getById: rpc.get(async ({id}, ctx) => {
			return {id, title: 'Example Post'};
		}),
		// expects $command from the client
		create: rpc.command(async ({title}) => {
			// create a new post
		}),
	},
};

const rpcHandler = createHandler(api, '/rpc');
rpcHandler.match(request); // boolean — does this request belong to this handler?
rpcHandler.handle(request); // Promise<Response>
```

### Custom Server Context

You can provide a custom server context factory to inject your own properties (e.g. authenticated user) into every handler:

```typescript
import {createHandler, ServerContext} from '@atom-forge/rpc';

class AppContext extends ServerContext {
	get user() {
		return this.env.get('user'); // populated by an auth middleware
	}
}

const rpcHandler = createHandler(api, '/rpc', {
	createServerContext: (args, request) => new AppContext(args, request),
});
```

## The `rpc` object

The `rpc` object provides methods for defining your API endpoints. The method you use on the server determines how the client must call the endpoint.

* `rpc.query`: Defines a query endpoint that expects arguments encoded with MessagePack. The client must use **`$query`**.
* `rpc.get`: Defines a query endpoint that expects arguments as plain text in the URL. The client must use **`$get`**.
* `rpc.command`: Defines a command endpoint. The client must use **`$command`**.

### `rpcFactory`

If you use a custom server context (see above), use `rpcFactory` to create a typed `rpc` instance so that `ctx` is properly typed in your handlers:

```typescript
import {rpcFactory} from '@atom-forge/rpc';

const rpc = rpcFactory<AppContext>();

const api = {
	posts: {
		list: rpc.query(async ({page}, ctx) => {
			// ctx is typed as AppContext
			const user = ctx.user;
			return {posts: []};
		}),
	},
};
```

## Server Context (`ctx`)

Every handler and server-side middleware receives a `ctx` object with the following members:

| Member                   | Description                                                                                |
|--------------------------|--------------------------------------------------------------------------------------------|
| `ctx.request`            | The standard Web API `Request` object.                                                     |
| `ctx.getArgs()`          | Returns all arguments as a plain object.                                                   |
| `ctx.args`               | The arguments as a `Map<string, any>`.                                                     |
| `ctx.cookies`            | Cookie manager: `get(name)`, `set(name, value, opts?)`, `delete(name, opts?)`, `getAll()`. |
| `ctx.headers.request`    | The incoming request headers.                                                              |
| `ctx.headers.response`   | The mutable response headers.                                                              |
| `ctx.cache.set(seconds)` | Sets the `Cache-Control` max-age for GET responses.                                        |
| `ctx.cache.get()`        | Returns the current cache duration.                                                        |
| `ctx.status.set(code)`   | Sets the HTTP response status code.                                                        |
| `ctx.status.notFound()`  | Shorthand for common HTTP codes (see below).                                               |
| `ctx.env`                | A `Map<string\|symbol, any>` for passing data between middlewares.                         |
| `ctx.elapsedTime`        | Server-side elapsed time in milliseconds.                                                  |

**Status shortcuts:** `ok`, `created`, `accepted`, `noContent`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `methodNotAllowed`, `conflict`, `tooManyRequests`, `serverError`, `serviceUnavailable`, and more.

## Caching

Rpc supports server-side caching for `GET` requests (both `rpc.query` and `rpc.get`). Set the cache duration in seconds using `ctx.cache.set()` within your endpoint implementation.

```typescript
const api = {
	posts: {
		list: rpc.query(async ({page}, ctx) => {
			ctx.cache.set(60); // Cache the response for 60 seconds
			return {posts: []};
		}),
	},
};
```

## Error Handling

Use the built-in error helpers to return application-level errors from handlers. These always produce a `200 OK` response with the `atomforge.rpc.error` key, so the client receives a typed `RpcResponse`.

```typescript
import {rpc} from '@atom-forge/rpc';

const api = {
	posts: {
		create: rpc.command(async ({title}, ctx) => {
			if (!ctx.env.get('user')) return rpc.error.permissionDenied();
			if (title.length < 3) return rpc.error.invalidArgument({message: 'Title too short'});
			// ...
			return {id: 1, title};
		}),
	},
};
```

Use `rpc.error.make` for custom error codes:

```typescript
return rpc.error.make('POST_ALREADY_EXISTS', 'This slug already exists', {slug: post.slug});
```

| Method                                    | Error code          | Use when                                        |
|-------------------------------------------|---------------------|-------------------------------------------------|
| `rpc.error.invalidArgument(details?)`     | `INVALID_ARGUMENT`  | Business logic validation (beyond Zod)          |
| `rpc.error.permissionDenied(details?)`    | `PERMISSION_DENIED` | Authorization failure                           |
| `rpc.error.internalError(details?)`       | `INTERNAL_ERROR`    | Handled internal failure (auto `correlationId`) |
| `rpc.error.make(code, message?, result?)` | custom              | Any custom error code                           |

## `zod` integration

Rpc has built-in support for `zod` for input validation. Install `zod` as a dependency of your project and import it directly.

If validation fails, Rpc automatically returns an application-level error (`200 OK`) with code `INVALID_ARGUMENT` and the `ZodIssue` array in the `issues` field. The handler does not run.

```typescript
// Server-side
import {rpc} from '@atom-forge/rpc';
import {z} from 'zod';

const api = {
	posts: {
		create: rpc.zod({
			title: z.string().min(3, "Title must be at least 3 characters long."),
			content: z.string().min(10),
		}).command(async ({title, content}) => {
			// This code only runs if validation passes
		}),
	},
};
```

`rpc.zod` also works with `query` and `get`:

```typescript
rpc.zod({id: z.number()}).query(async ({id}, ctx) => { ...
})
rpc.zod({id: z.number()}).get(async ({id}, ctx) => { ...
})
```

Handle validation errors on the client via `RpcResponse`:

```typescript
// Client-side
const res = await client.posts.create.$command({title: 'Hi'});
if (res.isError('INVALID_ARGUMENT')) {
	console.log(res.result.issues); // ZodIssue[]
}
```

## `makeServerMiddleware`

The `makeServerMiddleware` function is used to create server-side middleware. An optional second argument lets you attach accessor functions to the middleware, which is useful for creating reusable, self-contained middleware with helpers.

> ⚠️ **Always `return await next()`** in your middleware. If you call `next()` without returning its result, the handler's return value will be lost and the client will receive `undefined`.

```typescript
import {makeServerMiddleware} from '@atom-forge/rpc';

const authMiddleware = makeServerMiddleware(
	async (ctx, next) => {
		const token = ctx.cookies.get('session') ?? ctx.headers.request.get('Authorization');
		const user = await verifyToken(token);
		if (!user) {
			ctx.status.unauthorized();
			return {error: 'Unauthorized'}; // ✅ early return, no next() call needed
		}
		ctx.env.set('user', user);
		return await next(); // ✅ always return the result of next()
	},
	// Optional accessors attached to the middleware function itself
	{
		isAdmin: (ctx) => ctx.env.get('user')?.role === 'admin',
	}
);
```

The accessor functions are attached directly to the middleware function object, keeping the middleware and its associated helpers co-located. Call them from within endpoint implementations by passing `ctx`:

```typescript
const api = {
	admin: {
		deletePost: rpc.middleware(authMiddleware).command(async ({id}, ctx) => {
			if (!authMiddleware.isAdmin(ctx)) {
				ctx.status.forbidden();
				return {error: 'Admin only'};
			}
			// proceed...
		}),
	},
};
```

This pattern keeps the middleware's knowledge — what constitutes an `isAdmin` check — in one place rather than repeating the logic in every endpoint.

## Applying Middleware with `rpc.middleware`

Use `rpc.middleware()` to attach one or more server middlewares to an endpoint:

```typescript
import {rpc} from '@atom-forge/rpc';
import {z} from 'zod';

// Apply middleware to a specific endpoint
const api = {
	posts: {
		create: rpc.middleware(authMiddleware).command(async ({title}) => {
			// ...
		}),
		// Combine middleware with zod validation
		update: rpc.middleware(authMiddleware).zod({
			id: z.number(),
			title: z.string(),
		}).command(async ({id, title}) => {
			// ...
		}),
	},
};
```

You can also attach middleware to any existing object with `.on()`:

```typescript
const postsApi = {
	list: rpc.query(async () => { ...
	}),
	create: rpc.command(async () => { ...
	}),
};

// Attach authMiddleware to the whole postsApi group
rpc.middleware(authMiddleware).on(postsApi);

const api = {posts: postsApi};
```
