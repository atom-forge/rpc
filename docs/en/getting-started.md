# Getting Started with @atom-forge/rpc

## Installation

```bash
npm install @atom-forge/rpc
pnpm add @atom-forge/rpc
yarn add @atom-forge/rpc
bun add @atom-forge/rpc
```

## Core Concept: End-to-End Type Safety

Rpc's main feature is providing end-to-end type safety between your server and client. You define your API on the server, then share the type of that definition with the client. This gives you autocompletion and type checking for your API calls.

**1. Define your API on the server:**

```typescript
// api.ts (shared API definition)
import {rpc} from '@atom-forge/rpc';

export const api = {
	posts: {
		list: rpc.query(async ({page}: { page: number }, ctx) => {
			// ... fetch posts
			return {posts: [{id: 1, title: 'Hello'}]};
		}),
		create: rpc.command(async ({title}: { title: string }) => {
			// ... create post
			return {success: true};
		}),
	},
};
```

```typescript
// SvelteKit: src/routes/rpc/[...path]/+server.ts
import {createHandler} from '@atom-forge/rpc';
import {api} from '$lib/api';

const rpc = createHandler(api, '/rpc');
export const GET = ({request}) => rpc.handle(request);
export const POST = GET;
```

**2. Use the type on the client:**

```typescript
// src/lib/client/rpc.ts
import {createClient} from '@atom-forge/rpc';
import type {api} from '$lib/api';

const [client, cfg] = createClient<typeof api>('/rpc');

// Every call returns a RpcResponse
const res = await client.posts.list.$query({page: 1});
if (res.isOK()) {
	console.log(res.result); // typed as { posts: { id: number, title: string }[] }
}

await client.posts.create.$command({title: 'My New Post'});

export default client;
```
