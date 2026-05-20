# Client-side Usage

## `createClient`

The `createClient` function creates a new API client. The way you call an endpoint on the client (`$query` or `$get`) must match how it was defined on the server (`rpc.query` or `rpc.get`).

```typescript
import {createClient} from '@atom-forge/rpc';
import type {api} from './api';

const [client, cfg] = createClient<typeof api>('/rpc');

// If the server endpoint is defined with rpc.query:
const result = await client.posts.list.$query({page: 1});

// Command call
await client.posts.create.$command({title: 'Hello World'});
```

## Call Options

Every RPC method (`$command`, `$query`, `$get`) accepts an optional second argument with per-call options:

```typescript
const result = await client.posts.list.$query({page: 1}, {
	// Abort the request using an AbortController
	abortSignal: controller.signal,

	// Track upload/download progress (uses XHR internally)
	onProgress: ({loaded, total, percent, phase}) => {
		console.log(`${phase}: ${percent}%`);
	},

	// Add custom request headers for this call only
	headers: new Headers({'X-Custom-Header': 'value'}),
});
```

## `RpcResult<T>`

A utility type that extracts the success return type from an RPC method. Useful for typing state variables or function return types without manually writing out the full response type.

```typescript
import type {RpcResult} from '@atom-forge/rpc';

// Preferred: pass the method descriptor object
type Posts = RpcResult<typeof client.posts.list>;

// Also works: pass the callable directly
type Posts = RpcResult<typeof client.posts.list.$query>;

// Example with Svelte $state
let posts = $state<RpcResult<typeof client.posts.list>>([]);
```

## `RpcResponse`

Every RPC call returns a `RpcResponse` with these members:

| Member               | Description                                                             |
|----------------------|-------------------------------------------------------------------------|
| `res.isOK()`         | `true` if the call succeeded — narrows `res.result` to the success type |
| `res.isError(code?)` | `true` if error; optionally checks a specific code                      |
| `res.status`         | `'OK'` on success, or the error code string                             |
| `res.result`         | `TSuccess` after `isOK()`, full union otherwise                         |
| `res.ctx`            | The full `ClientContext` for this call                                  |

**Error code format:**

- Application-level errors: `'INVALID_ARGUMENT'`, `'PERMISSION_DENIED'`, custom codes, etc.
- Transport errors: `'HTTP:401'`, `'HTTP:404'`, `'HTTP:500'`, etc.
- Network errors: `'NETWORK_ERROR'`

```typescript
const res = await client.posts.create.$command({title: 'Hello'});

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

## File Uploads

`$command` endpoints automatically detect `File` or `File[]` values in the arguments and switch to a `multipart/form-data` request. You can combine file uploads with regular arguments and track progress.

```typescript
// Server-side
const api = {
	posts: {
		create: rpc.command(async ({title, cover}: { title: string; cover: File }) => {
			// cover is a File object
		}),
	},
};

// Client-side
const coverFile = document.querySelector('input[type=file]').files[0];

await client.posts.create.$command(
	{title: 'Hello', cover: coverFile},
	{
		onProgress: ({percent, phase}) => console.log(`${phase}: ${percent}%`),
	}
);
```

For multiple files, use an array and suffix the key with `[]`:

```typescript
// Server-side
const api = {
	media: {
		upload: rpc.command(async ({files}: { files: File[] }) => { ...
		}),
	},
};

// Client-side
await client.media.upload.$command({'files[]': selectedFiles});
```

## `clientLogger`

`clientLogger` is a built-in client middleware that logs RPC call details to the browser console — including the request path, arguments, response, timing, and HTTP status code.

```typescript
import {createClient, clientLogger} from '@atom-forge/rpc';

const [client, cfg] = createClient<typeof api>('/rpc');
cfg.$ = clientLogger('/rpc'); // apply globally
```

## `makeClientMiddleware`

The `makeClientMiddleware` function is used to create a client-side middleware.

> ⚠️ **Always `return await next()`** in your middleware. If you call `next()` without returning its result, the response will be lost and the caller will receive `undefined`.

```typescript
import {makeClientMiddleware} from '@atom-forge/rpc';

const loggerMiddleware = makeClientMiddleware(async (ctx, next) => {
	console.log('Request:', ctx.path, ctx.getArgs());
	const result = await next(); // ✅ always return the result of next()
	console.log('Response:', ctx.result);
	return result;
});

// Apply middleware to all routes
cfg.$ = loggerMiddleware;
```
