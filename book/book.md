---
title: RPC
subtitle: "@atom-forge/rpc"
id: atom-forge-rpc
language: en
author: AtomForge
tags: [typescript, rpc, web-development]
intro: "Build end-to-end type-safe APIs with @atom-forge/rpc: server endpoints, typed clients, validation, middleware, framework integration, and the wire protocol."
children:
  - "[[getting-started.md]]"
  - "[[server-side-usage.md]]"
  - "[[client-side-usage.md]]"
  - "[[framework-adapters.md]]"
  - "[[communication-protocol.md]]"
---
# Rpc — Type-safe APIs with TypeScript

Rpc is a full-stack RPC (Remote Procedure Call) framework for TypeScript. Define an API on the server and share its type with the client to get autocompletion and end-to-end type checking, without sharing server implementations with the browser.

The framework uses standard Web API `Request` and `Response` objects. It works with SvelteKit, Next.js, Nuxt, Express, Hono, and compatible Node.js or edge runtimes. MessagePack is the primary transport, with JSON support and multipart file uploads.

The central idea is to keep the API contract close to its implementation. A nested server object becomes the shape of the client: related endpoints can live under groups such as `posts`, and callers use those same names rather than assembling endpoint URLs themselves. The shared contract is a TypeScript type, while the actual call still crosses an HTTP boundary.

## Who this book is for

This book is for TypeScript developers integrating Rpc into an application. Familiarity with async functions, HTTP, and your chosen web framework is helpful. The chapters adapt the project's English documentation into a self-contained BookMD book.

## Reading guide

1. [Getting started](getting-started.md): install the package and connect a server API to a typed client.
2. [Server-side usage](server-side-usage.md): define endpoints, validate input, customize context, handle errors, and apply middleware.
3. [Client-side usage](client-side-usage.md): call endpoints, narrow response types, upload files, and test handlers without an HTTP server.
4. [Framework adapters](framework-adapters.md): connect the handler to your application's request lifecycle.
5. [Communication protocol](communication-protocol.md): understand request encoding and response negotiation.

You can read the chapters in order or go directly to the topic needed for your integration.

For a first integration, start with one read endpoint and one command, then connect them through the adapter for your framework. Once that round trip works, add validation and authorization before expanding the API. The protocol chapter is most useful when inspecting requests, integrating a non-Rpc client, or diagnosing an encoding mismatch.

> [!warning] Type safety is not runtime validation
> Keep server imports type-only on the client, validate untrusted inputs with Zod, and inspect `RpcResponse.isOK()` before treating a result as success. Application errors can have HTTP status 200.

> [!tip] Match both sides of the API
> Use the same base path for the handler and client. Pair `rpc.query` with `$query`, `rpc.get` with `$get`, and `rpc.command` with `$command`. Middleware must return the result of `next()`.
