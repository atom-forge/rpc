# Changelog

## [Unreleased]

---

## [0.3.16] - 2026-07-30

### Added

- Add `.request(args, options?)` to client RPC methods for in-process handler tests without an HTTP server.
- Add `.response(response)` and `.handle(handler, args, options?)` helpers for decoded in-process test responses.

---

## [0.3.15] - 2026-06-01

### Changed

- **npm publish workflow** — switched the GitHub Actions release job to the explicit Node 24 + Bun build + `npm publish --ignore-scripts` flow to better match npm trusted publishing recommendations and avoid implicit script behavior during CI release runs.

---

## [0.3.14] - 2026-06-01

### Changed

- **`prepublishOnly` release flow** — removed the legacy prepublish automation script and limited publish-time work to a plain build so GitHub Actions trusted publishing can run without npm login, version bumping, or git mutations.

---

## [0.3.13] - 2026-06-01

### Added

- **npm publish workflow** — added a GitHub Actions workflow that publishes the package to npm on `v*` tag pushes using trusted publishing.

---

## [0.3.11] - 2026-05-20

### Added

- **Hungarian documentation** — added a full translation of the documentation in the `docs/hu/` folder.

### Changed

- **Documentation restructuring** — split the monolithic `README.en.md` into multiple smaller markdown files under the `docs/en/` directory for better readability and navigation.
- **npm package contents** — updated `package.json` to explicitly include the `docs/` folder and root `README` files (`README.md`, `README.en.md`, `README.hu.md`) in the published package.

---

## [0.3.3] - 2026-03-28

### Fixed

- **Node.js / Bun compatibility for file uploads** — some runtimes (e.g. Node.js/undici) do not preserve the MIME type of a blob when using multipart form data. If `argsBlob.type` is empty, the server now falls back to `application/msgpack` instead of throwing a `ParseError`.

---

## [0.3.2] - 2026-03-23

### Added

- **Patron License** — added own license document (`LICENSE`).

### Changed

- **`package.json` metadata** — keywords, repository URL, author and license fields updated.
- **README** — license and contribution sections expanded.

---

## [0.3.0] - 2026-03-xx

### Added

- **Client logger** (`src/client/logger.ts`) — standalone module for client-side debug logging.
- **Cookie utility** (`src/util/cookies.ts`) — cookie handler utility for server context.
- **`ServerContext` cookie API** — `ctx.cookies` is now available in handlers.

### Changed

- **Documentation restructuring** — `README.md` split into `README.en.md`, `README.hu.md`, `README.llm.md` files.
- **`createClient` logger integration** — debug logging is now handled via the dedicated logger module.

---

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

## [0.1.7] - 2026-xx-xx

### Changed

- Dependency updates.
- Zod re-export with `tz` name (`import { tz } from "@atom-forge/rpc"`).
- Code style unification (concise imports, tab indent) across all source files.
- Pipeline middleware behavior refined: returns `undefined` if no middleware matches.

---

## [0.1.0] - 2025-xx-xx

Initial implementation: type-safe RPC framework with middleware support, Zod validation, file uploads and progress tracking.
