# Changelog

## [0.2.0] - 2026-02-27

### Breaking Changes

- **URL format changed.** Client-side calls now generate dot-separated, fully `kebab-case` URLs.
  - Old: `/api/users/getProfile`
  - New: `/api/users.get-profile`
- **SvelteKit routing:** it is recommended to change `src/routes/api/[...path]/+server.ts` to `[path]` to prevent partial processing of old format requests.

### Added

- **`flattenApiDefinition`** — at server startup, a flat `Map<string, { rpcType, handler }>` is built from the API definition. Each `handler` is a pre-assembled pipeline closure (middlewares + Zod validation + implementation), so only a `Map.get()` and a function call are needed per request.
- **`camelToKebabCase`** utility (`src/util/string.ts`) — shared helper function between client and server, with a regex that correctly handles acronyms (`getUserID` → `get-user-id`).
- **415 Unsupported Media Type** response for unknown `Content-Type` in `command` requests (previously it silently tried with msgpackr).

### Changed

- **`tango.ts` refactor** — duplication of `query`/`command`/`get` triad and Zod handling removed. Two internal helpers (`makeDescriptor`, `makeZodMethodSet`) replace the previous ~195 line triplicated logic (reduced to ~76 lines).
- **`endpointMap`** — renamed from the misleading `flatMap` name.
- **Client debug logging** — `isDebug` constant (previously a twice-evaluated condition); in case of error, the error appears inside the console group, and the group always closes (previously it remained open in case of pipeline error).
- **Client `middlewareMap` keys** — updated to a format consistent with the new URL convention (dot separator, kebab-case).

### Fixed

- **Heterogeneous File array upload** — the upload logic now checks if all array elements are `File` (`every()`), not just the first one.
- **`abortSignal` / `onProgress`** — unnecessary ternary operator removed in `ClientContext` constructor.

---

## [0.1.7] - 2025-xx-xx

Dependency updates, Zod re-export with `tz` name, code style unification.

## [0.1.0] - 2025-xx-xx

Initial implementation: RPC framework with middleware support.
