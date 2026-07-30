# RPC console timeline

## Cél

A párhuzamos RPC kérések kapcsolatát mutassa a böngésző konzolban. Nem az
eltelt idők, hanem az számít, hogy egy kérés mely más kérésekkel futott együtt.

## API

```ts
__rpc.timeline(); // Kirajzolja az eltárolt kérések párhuzamossági képét.
__rpc.clear(); // Törli az eltárolt RPC-logokat.
```

`timeline()` csak megjelenít, nem módosítja a logot. A `clear()` után az üres
logból rajzol.

## Adatmodell

Minden kéréshez el kell tárolni legalább ezt:

```ts
{
    id: string,
    label: string,
    startedAt: number,
    finishedAt: number,
}
```

## Renderelés

Az összes `start` és `end` eseményt időrendbe rendezzük. Minden esemény egy
fix szélességű konzoloszlop. Egy kérés azokon az oszlopokon kap `█` karaktert,
amelyekhez tartozó intervallumban aktív; egyébként szóközt.

Ez nem az időt skálázza, ezért rövid marad, és pontosan megtartja a
párhuzamossági viszonyokat.

```ts
// A start → B start → B end → C start → A end → C end
//
// users.getProfile      ████
// projects.list          ██
// notifications.get        ██
```
