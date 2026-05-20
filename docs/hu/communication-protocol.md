# Kommunikációs protokoll

Az Rpc elsődleges kommunikációs protokollként a **MessagePack**-et használja a hatékonyság és a teljesítmény érdekében. Olyan kliensek esetében, amelyek nem támogatják a MessagePack-et, visszatérhet a **JSON** használatához.

- **`$command`**: A kérés törzsében (body) küldi el az adatokat MessagePack-kel kódolva (`application/msgpack`). A szerver az egyszerű JSON-t (`application/json`) is elfogadja.
- **`$query`**: Az URL query stringjében küldi el az adatokat MessagePack-kel és Base64-gyel kódolva. Ez az ajánlott módszer a gyorsítótárazható (cacheable) lekérdezésekhez.
- **`$get`**: Egyszerű szövegként küldi el az adatokat az URL query stringjében. Hasznos olyan kliensek számára, amelyek nem támogatják a MessagePack-et, vagy egyszerűbb lekérdezésekhez.

A szerver automatikusan észleli a kliens `Accept` fejlécét, és MessagePack vagy JSON formátumban válaszol.

## Válasz fejlécek (Response Headers)

Minden válasz tartalmazza az alábbi fejléceket:

| Fejléc | Leírás |
|---|---|
| `x-atom-forge-rpc-exec-time` | Szerveroldali végrehajtási idő ezredmásodpercben (ms). |
