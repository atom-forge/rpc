# Changelog

## [0.3.3] - 2026-03-28

### Fixed

- **Node.js / Bun kompatibilitás fájlfeltöltésnél** — egyes runtime-ok (pl. Node.js/undici) multipart form data esetén nem őrzik meg a blob MIME típusát. Ha `argsBlob.type` üres, a szerver mostantól `application/msgpack`-re esik vissza, ahelyett hogy `ParseError`-t dobna.

---

## [0.3.2] - 2026-03-23

### Added

- **Patron License** — saját licencdokumentum hozzáadva (`LICENSE`).

### Changed

- **`package.json` metaadatok** — kulcsszavak, repository URL, szerző és licencmező frissítve.
- **README** — licenc- és közreműködési szekció bővítve.

---

## [0.3.0] - 2026-03-xx

### Added

- **Client logger** (`src/client/logger.ts`) — önálló modul a kliens oldali debug naplózáshoz.
- **Cookie segédlet** (`src/util/cookies.ts`) — cookie kezelő utility a szerver kontextushoz.
- **`ServerContext` cookie API** — `ctx.cookies` elérhetővé vált a handler-ekben.

### Changed

- **Dokumentáció átstrukturálás** — `README.md` felosztva: `README.en.md`, `README.hu.md`, `README.llm.md` fájlokra.
- **`createClient` logger integráció** — a debug logging a dedikált logger modulon keresztül történik.

---

## [0.2.0] - 2026-02-27

### Breaking Changes

- **URL formátum megváltozott.** A kliensoldali hívások mostantól pont-szeparátoros, teljes egészében `kebab-case` URL-t generálnak.
  - Régi: `/api/users/getProfile`
  - Új: `/api/users.get-profile`
- **SvelteKit routing:** a `src/routes/api/[...path]/+server.ts` fájlt ajánlott `[path]`-ra cserélni, hogy a régi formátumú kérések ne kerüljenek részleges feldolgozásra.

### Added

- **`flattenApiDefinition`** — a szerver indulásakor az API definícióból egy lapos `Map<string, { rpcType, handler }>` épül fel. Minden `handler` egy előre összerakott pipeline closure (middleware-ek + Zod-validáció + implementation), így kérésenként csak egy `Map.get()` és egy függvényhívás szükséges.
- **`camelToKebabCase`** utility (`src/util/string.ts`) — megosztott segédfüggvény a kliens és szerver között, akronimákat helyesen kezelő regex-szel (`getUserID` → `get-user-id`).
- **415 Unsupported Media Type** válasz ismeretlen `Content-Type` esetén `command` kéréseknél (korábban szótlanul msgpackr-rel próbálkozott).

### Changed

- **`tango.ts` refaktor** — a `query`/`command`/`get` hármas és a Zod-kezelés duplikációja megszűnt. Két belső helper (`makeDescriptor`, `makeZodMethodSet`) váltja ki a korábbi ~195 soros, triplikált logikát (~76 sorra csökkentve).
- **`endpointMap`** — a korábbi félrevezető `flatMap` név helyett.
- **Kliens debug logging** — `isDebug` konstans (korábban kétszer kiértékelt feltétel); hiba esetén az error a konzolcsoporton belül jelenik meg, a csoport mindig bezárul (korábban pipeline-hiba esetén nyitva maradt).
- **Kliens `middlewareMap` kulcsok** — az új URL-konvencióval konzisztens formátumra frissítve (`.` szeparátor, kebab-case).

### Fixed

- **Heterogén File tömb feltöltés** — a feltöltési logika mostantól az összes tömbelemre ellenőrzi, hogy `File`-e (`every()`), nem csak az elsőre.
- **`abortSignal` / `onProgress`** — felesleges ternary operátor eltávolítva a `ClientContext` konstruktorában.

---

## [0.1.7] - 2026-xx-xx

### Changed

- Függőség-frissítések.
- Zod re-export `tz` névvel (`import { tz } from "@atom-forge/rpc"`).
- Kódstílus-egységesítés (tömör importok, tab indentáció) az összes forrásfájlban.
- Pipeline middleware viselkedés finomítva: `undefined`-ot ad vissza, ha nincs illeszkedő middleware.

---

## [0.1.0] - 2025-xx-xx

Kezdeti implementáció: type-safe RPC keretrendszer middleware támogatással, Zod validációval, fájlfeltöltéssel és progress tracking-gel.
