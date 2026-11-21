# Tập hợp & Generics trong JavaScript / TypeScript

Tham chiếu thực dụng cho cấu trúc dữ liệu built-in và generics / utility types của TypeScript khi làm việc với collections. Baseline: **ES2025/2026 · Node.js 26 Active LTS ("Lithium", V8 14.6+)**, **TypeScript 7.0**.

Iterator / LINQ-like sâu hơn → [iterables-linq.md](iterables-linq.md). Type-level siêu nâng cao → [typesystem.md](typesystem.md). Hàm generic / variance callback → [functions-callbacks.md](functions-callbacks.md).

---

## Mục lục

- [1. Array — semantics & methods](#1-array--semantics--methods)
  - [1.1 Mutating vs copy — bảng đủ method thường dùng](#11-mutating-vs-copy--bảng-đủ-method-thường-dùng)
  - [1.2 Tra cứu, transform & sparse / holes](#12-tra-cứu-transform--sparse--holes)
  - [1.3 `sort` comparator — bẫy](#13-sort-comparator--bẫy)
  - [1.4 Static `Array` & factory](#14-static-array--factory)
  - [1.5 `copyWithin` / `fill` / `length`](#15-copywithin--fill--length)
  - [1.6 Shallow copy — chọn API](#16-shallow-copy--chọn-api)
- [2. Map](#2-map)
  - [2.1 Key equality — SameValueZero](#21-key-equality--samevaluezero)
  - [2.2 Object ↔ Map](#22-object--map)
  - [2.3 `getOrInsert` / `getOrInsertComputed` (Node 26)](#23-getorinsert--getorinsertcomputed-node-26)
  - [2.4 Clone, JSON, `structuredClone`](#24-clone-json-structuredclone)
  - [2.5 `NaN`, object key, intern](#25-nan-object-key-intern)
- [3. Set](#3-set)
  - [3.1 Set operations (ES2025 / Node 26)](#31-set-operations-es2025--node-26)
  - [3.2 Set-like & thứ tự](#32-set-like--thứ-tự)
  - [3.3 Mutable iterate](#33-mutable-iterate)
- [4. WeakMap, WeakSet, WeakRef & FinalizationRegistry](#4-weakmap-weakset-weakref--finalizationregistry)
  - [4.1 So sánh với Map / Set](#41-so-sánh-với-map--set)
  - [4.2 Pattern: private data side-table](#42-pattern-private-data-side-table)
  - [4.3 `WeakRef` vs `FinalizationRegistry` vs `WeakMap`](#43-weakref-vs-finalizationregistry-vs-weakmap)
  - [4.4 Cache WeakRef (minh họa — đo trước khi dùng)](#44-cache-weakref-minh-họa--đo-trước-khi-dùng)
  - [4.5 WeakSet](#45-weakset)
- [5. Object vs Map vs Record](#5-object-vs-map-vs-record)
  - [5.1 Bảng quyết định ngắn](#51-bảng-quyết-định-ngắn)
- [6. TypedArray, ArrayBuffer & Buffer](#6-typedarray-arraybuffer--buffer)
  - [6.1 Overview](#61-overview)
  - [6.2 Endian & views](#62-endian--views)
  - [6.3 Node `Buffer`](#63-node-buffer)
  - [6.4 Pitfalls](#64-pitfalls)
  - [6.5 TypedArray vs `Array` methods](#65-typedarray-vs-array-methods)
  - [6.6 Transfer, Resizable `ArrayBuffer` & Growable `SharedArrayBuffer`](#66-transfer-resizable-arraybuffer--growable-sharedarraybuffer)
  - [6.7 Encoding `Buffer`](#67-encoding-buffer)
  - [6.8 `Uint8Array` Base64 & Hex (ES2026 / Node 26)](#68-uint8array-base64--hex-es2026--node-26)
- [7. Utility types cho collections](#7-utility-types-cho-collections)
  - [7.1 `Readonly` / `Partial` + excess property](#71-readonly--partial--excess-property)
  - [7.2 `Omit` / `Pick` pitfalls](#72-omit--pick-pitfalls)
- [8. Generics thực dụng với collections](#8-generics-thực-dụng-với-collections)
  - [8.1 Constraints + variance](#81-constraints--variance)
  - [8.2 Branded / nominal keys](#82-branded--nominal-keys)
  - [8.3 Default type param & inference fail](#83-default-type-param--inference-fail)
  - [8.4 `satisfies` với collections](#84-satisfies-với-collections)
  - [8.5 `Array` covariant — ví dụ lỗ](#85-array-covariant--ví-dụ-lỗ)
- [9. Conditional types, `infer` & mapped types](#9-conditional-types-infer--mapped-types)
  - [9.1 Mapped `-readonly` / `-?` (nhắc)](#91-mapped--readonly----nhắc)
- [10. `ReadonlyArray`, tuple & `as const`](#10-readonlyarray-tuple--as-const)
  - [10.1 Variadic tuple & collections](#101-variadic-tuple--collections)
- [11. Iterator protocol (tóm tắt)](#11-iterator-protocol-tóm-tắt)
  - [11.1 `Object.groupBy` / `Map.groupBy`](#111-objectgroupby--mapgroupby)
- [12. Hiệu năng & pitfalls](#12-hiệu-năng--pitfalls)
  - [12.1 Memory: Map vs object vs Array](#121-memory-map-vs-object-vs-array)
  - [12.2 `structuredClone` vs JSON vs spread](#122-structuredclone-vs-json-vs-spread)
  - [12.3 Index `number` vs string trên Array](#123-index-number-vs-string-trên-array)
- [13. Best practices](#13-best-practices)
- [14. Checklist](#14-checklist)
- [15. Cheat sheet](#15-cheat-sheet)
- [16. Version matrix](#16-version-matrix)
- [17. Tài liệu liên quan](#17-tài-liệu-liên-quan)

---

## 1. Array — semantics & methods

```ts
const xs: number[] = [1, 2, 3];
const ys: Array<string> = ["a", "b"];

xs.push(4);
xs.length; // 4
xs.at(-1); // 4 — index âm (ES2022+)
```

Hai cách ghi kiểu tương đương: `T[]` và `Array<T>`. Prefer `readonly T[]` / `ReadonlyArray<T>` cho **input** API (không mutate nhầm).

### 1.1 Mutating vs copy — bảng đủ method thường dùng

| Method | Mutate? | Trả về | Độ phức tạp (điển hình) |
|---|---|---|---|
| `push` / `pop` | Có | `length` / phần tử | O(1) amortized cuối |
| `unshift` / `shift` | Có | `length` / phần tử | **O(n)** — tránh hot path |
| `splice(i, del, …ins)` | Có | mảng phần tử xóa | O(n) |
| `toSpliced(…)` | Không | mảng mới | O(n) — ES2023+ |
| `sort(cmp?)` | Có | **cùng** mảng | O(n log n) |
| `toSorted(cmp?)` | Không | mảng mới | O(n log n) |
| `reverse` | Có | cùng mảng | O(n) |
| `toReversed` | Không | mảng mới | O(n) |
| `fill(v, start?, end?)` | Có | cùng mảng | O(k) |
| `copyWithin(t, s, e?)` | Có | cùng mảng | O(k) |
| `with(index, value)` | Không | mảng mới (1 index) | O(n) — ES2023+ |
| `slice` / `concat` | Không | mảng mới (shallow) | O(k) / O(n+m) |
| `map` / `filter` / `flat` / `flatMap` | Không | mảng mới | O(n) (+ flat độ sâu) |
| `reduce` / `reduceRight` | Acc có thể | giá trị | O(n) |
| `forEach` | Callback có thể | `undefined` | O(n) |
| `at` / `includes` / `indexOf` / `lastIndexOf` | Không | scalar | O(1) / O(n) |
| `find` / `findLast` / `findIndex` / `findLastIndex` | Không | phần tử / index | O(n) |
| `every` / `some` | Không | boolean (short-circuit) | O(n) |
| `join` / `toString` / `toLocaleString` | Không | string | O(n) |
| `keys` / `values` / `entries` | Không | iterator | lazy |
| `length = n` | Có (cắt/sparse) | — | cắt O(1) engine; tăng có thể hole |

```ts
const nums = [3, 1, 2];

nums.slice();                    // shallow copy
nums.concat([4]);                // mảng mới
[...nums].sort((a, b) => a - b); // copy rồi sort in-place
nums.toSorted((a, b) => a - b);  // không mutate (ES2023+)
nums.toReversed();
nums.with(0, 99);                // [99, 1, 2] — nums không đổi
```

> **Callout:** `sort` / `reverse` / `splice` mutate. Trong React state / shared cache / test snapshot — dùng `toSorted` / `toReversed` / `toSpliced` / `with`, hoặc spread rồi mutate bản copy.

Shallow: `map`/`slice` **không** clone phần tử object. Nested mutate vẫn đụng gốc.

### 1.2 Tra cứu, transform & sparse / holes

| Method | Ghi chú |
|---|---|
| `includes` | SameValueZero — NaN tìm được (`indexOf` thì không) |
| `find` / `findLast` / `*Index` | predicate; index `-1` nếu thiếu |
| `every` / `some` | short-circuit |
| `at(i)` | index âm (ES2022+) |
| `map` / `filter` / `flat` / `flatMap` / `reduce` | luôn alloc mới (shallow); `reduce` phức tạp → tách/`for` |
| `map(async …)` | `Promise[]` — cần `Promise.all` → [async.md](async.md) |

```ts
[NaN].includes(NaN); // true
[NaN].indexOf(NaN);  // -1

const a: number[] = [];
a[2] = 1;    // sparse — tránh
delete a[2]; // tạo hole — tránh; dùng splice/filter
[,,,].map(() => 1); // hole: callback không chạy

Array.from({ length: 5 }, (_, i) => i);
// Array(n).fill([]) — mọi hàng cùng reference! Dùng Array.from factory
```

**Hole** vs `undefined`:

| Thao tác | Hole `[1, , 3]` | Dense `[1, undefined, 3]` |
|---|---|---|
| `arr.length` | 3 | 3 |
| `forEach` / `map` / `filter` | **bỏ hole** (`map` giữ hole) | gọi callback với `undefined` |
| `for...of` / spread | `undefined` cho hole | `undefined` |
| `Object.keys` | bỏ hole | gồm `"1"` |
| `JSON.stringify` | hole → `null` | `undefined` trong array → `null` |

`map` trên sparse: **giữ hole** (callback không chạy). `filter` bỏ hole. `Array.from(sparse)` materialize hole thành `undefined`.

- `at(-1)` trên mảng rỗng trả `undefined` (không mutate, khác `pop()`).
- `includes` dùng SameValueZero (`NaN` tìm được; object theo reference). Tìm dãy con byte → `Buffer.prototype.indexOf` (Array không có subsequence search built-in).

> **Tránh** sparse / `delete arr[i]`. Key thưa → `Map`. `new Array(n)` không fill = n holes.

### 1.3 `sort` comparator — bẫy

Mặc định `sort()` convert `ToString` — **không** số học:

```ts
[10, 2, 1].sort(); // [1, 10, 2] — "10" < "2" theo UTF-16
[10, 2, 1].sort((a, b) => a - b); // [1, 2, 10]
```

| Bẫy | Hậu quả |
|---|---|
| Không `cmp` trên number | Sai thứ tự thập phân |
| `cmp` trả boolean (`a > b`) | Ép `true→1`, `false→0` — **thiếu** giá trị âm → sort hỏng |
| `cmp` không anti-symmetric | Engine không đảm bảo; có thể không terminate “đúng” |
| `NaN` / `undefined` trong cmp | `a - b` ra `NaN` — thứ tự không định nghĩa |
| Mutate phần tử trong cmp | UB thực dụng |
| Locale chuỗi | `localeCompare` / `Intl.Collator` — không `<` raw |
| Tin “unstable” | ES2019+ **stable** — equal keys giữ thứ tự; vẫn đừng dựa nếu polyfill cũ |

```ts
const collator = new Intl.Collator("vi"); // cache instance ngoài comparator — tạo mới mỗi lần so rất chậm
names.toSorted((a, b) => collator.compare(a, b));
```

Object: so sánh field số `a.n - b.n`; tie-break field 2 (stable giúp nhưng tie-break rõ hơn). `toSorted` khi cần giữ gốc.

### 1.4 Static `Array` & factory

| API | Việc |
|---|---|
| `Array.isArray(x)` | Phân biệt array thật — **không** TypedArray (`isArray(uint8) === false`) |
| `Array.from(x, mapFn?)` | Iterable hoặc array-like → mảng; xem [iterables-linq.md](iterables-linq.md) |
| `Array.fromAsync` | Async iterable / thenables |
| `Array.of(...items)` | `Array.of(3)` → `[3]` — khác `Array(3)` (length 3 holes) |
| `Array.prototype[Symbol.unscopables]` | Legacy `with` — bỏ qua |

```ts
Array.isArray([]);              // true
Array.isArray({ length: 0 });   // false
Array.isArray(new Uint8Array()); // false — dùng ArrayBuffer.isView / constructor

Array.of(1, 2); // [1, 2]
Array(2);       // [ <2 empty> ] — sparse
```

`instanceof Array` fail cross-realm (`vm`); `Array.isArray` đúng hơn.

### 1.5 `copyWithin` / `fill` / `length`

```ts
const w = [1, 2, 3, 4];
w.copyWithin(0, 2); // [3, 4, 3, 4] — overlap được spec định nghĩa
w.fill(0, 1, 3);    // fill [start, end)
```

`fill` với object: **một** reference. `length = 0` xóa hết (dense). Tăng `length` tạo hole. Gán `arr[arr.length] = x` = `push` semantics.

`splice` xóa giữa: O(n) dồn. Hàng đợi đầu mảng → `shift` O(n); dùng index cursor hoặc cấu trúc khác. `unshift` nhiều arg tốn O(n+k) — xây mảng ngược bằng `push` rồi `reverse()` thường nhanh hơn `unshift` trong vòng lặp.

Tránh `arr.push(...huge)` / `push.apply(arr, huge)` với mảng hàng trăm nghìn phần tử (vượt giới hạn call stack arguments) — duyệt `for...of` và `push` từng phần tử.

### 1.6 Shallow copy — chọn API

| Cách | Copy? | Hole | Note |
|---|---|---|---|
| `[...a]` | shallow | hole → `undefined` | Cần iterable |
| `a.slice()` | shallow | **giữ hole** | |
| `Array.from(a)` | shallow | hole → `undefined` | |
| `structuredClone(a)` | **deep** (hạn chế) | — | Không function; `Date` OK; **`Buffer` bị biến thành `Uint8Array` thuần** (`Buffer.isBuffer === false`) |
| `a.concat()` | shallow | giữ hole | |

Shared nested object: copy shallow rồi mutate child → đụng gốc. Deep: `structuredClone` (Node) hoặc schema tay.

---

## 2. Map

```ts
const m = new Map<string, number>();
m.set("a", 1);
m.get("a");    // 1
m.has("a");    // true
m.delete("a");
m.clear();
m.size;

for (const [k, v] of m) {
  console.log(k, v);
}

m.keys();
m.values();
m.entries();
```

`set` trả `this` (chain). `get` thiếu → `undefined` (không phân biệt value `undefined` vs thiếu — dùng `has` hoặc sentinel).

### 2.1 Key equality — SameValueZero

| Khía cạnh | Hành vi |
|---|---|
| So sánh key | **SameValueZero** (`===` nhưng `NaN` === `NaN`) |
| `+0` vs `-0` | **Giống nhau** (như `===`) |
| Object / function key | Theo **reference**, không deep-equal |
| Thứ tự duyệt | **Insertion order** (ổn định; `set` lại key đã có **không** đổi vị trí) |
| Key kiểu | Bất kỳ (primitive, object, function…) |

```ts
const objKey = { id: 1 };
const map = new Map<object, string>();
map.set(objKey, "x");
map.get(objKey);      // "x"
map.get({ id: 1 });   // undefined — khác reference

new Map([[NaN, 1]]).get(NaN); // 1
new Map([[+0, "z"]]).get(-0); // "z"
```

| Thuật toán | `NaN` vs `NaN` | `+0` vs `-0` |
|---|---|---|
| `===` | khác | giống |
| `Object.is` (SameValue) | giống | **khác** |
| SameValueZero (`Map`/`Set`/`includes`) | giống | giống |

Không có “custom equals”. Composite key: stringify có chủ đích hoặc `Map` lồng / tuple intern. Khi debug số âm 0: `Map` coi `-0` và `+0` là một key (khác `Object.is(k, -0)`).

### 2.2 Object ↔ Map

```ts
const obj = { a: 1, b: 2 };
const map = new Map(Object.entries(obj));
const back = Object.fromEntries(map);
```

`Object.entries` chỉ lấy enumerable own **string** keys — không lấy symbol / non-enumerable. `Object.fromEntries` dùng `ToPropertyKey` (giữ nguyên `Symbol` key; các key khác như `number` bị ép thành string).

### 2.3 `getOrInsert` / `getOrInsertComputed` (Node 26)

V8 14.6 / Node 26: upsert. Tránh pattern `if (!m.has(k)) m.set(k, …)` (hai lookup + race logic tay):

```ts
const counts = new Map<string, number>();

counts.getOrInsert("a", 0);  // 0 — insert nếu thiếu (primitive rẻ, dùng getOrInsert OK)
counts.getOrInsert("a", 99); // 0 — đã có, không ghi đè

counts.getOrInsertComputed("b", (key) => key.length); // 1
counts.getOrInsertComputed("b", () => 999);           // 1 — không gọi lại

const wm = new WeakMap<object, string[]>();
const obj = {};
wm.getOrInsertComputed(obj, () => ["lazy"]); // tránh alloc [] thừa khi key đã tồn tại
```

- `getOrInsert(key, defaultValue)` — trả value hiện có hoặc set rồi trả. `defaultValue` **luôn** đánh giá (eager) — kể cả khi key đã có, nên chỉ dùng cho primitive/hằng rẻ; với object/array luôn dùng `getOrInsertComputed`.
- `getOrInsertComputed(key, callback)` — chỉ gọi `callback(key)` khi key **chưa** có (lazy init / cache). Callback là **đồng bộ** — nếu trả `Promise`, map sẽ lưu chính `Promise` đó (pattern in-flight dedup; xem memoize ở [functions-callbacks.md](functions-callbacks.md)).

```ts
// Multimap — dùng getOrInsertComputed để không cấp phát mảng [] rác mỗi lần gọi
map.getOrInsertComputed(key, () => [] as string[]).push(value);
```

`get(k) ?? def` **sai** khi `undefined` là value hợp lệ; `has` + `getOrInsert` đúng. Không ghi đè value hiện có (khác `set`).

`WeakMap` cùng cặp method — key object hoặc non-registered `Symbol` (§4.1).

### 2.4 Clone, JSON, `structuredClone`

```ts
const m = new Map([["a", 1]]);
JSON.stringify(m); // "{}" — Map không enumerable own data
JSON.stringify(Object.fromEntries(m)); // '{"a":1}'

const clone = structuredClone(m); // Map mới, deep value (nếu cloneable)
const shallow = new Map(m);       // copy entries; value object **cùng** ref
```

Key object: `structuredClone` clone key → **mất** identity (get bằng object cũ fail). WeakMap **không** clone được qua JSON; `structuredClone` trên WeakMap ném.

`Map.groupBy(items, keyFn)` (ES2024): trả `Map` — insertion order nhóm theo lần key đầu.

Duyệt vừa `set` key mới: key mới có thể được thăm nếu chèn sau cursor. `delete` key chưa thăm: không thăm. Spec Map: đừng dựa micro-detail — copy ` [...m.keys()]` nếu xóa hàng loạt.

### 2.5 `NaN`, object key, intern

Composite: `const key = `${userId}:${role}`` trên `Map<string, V>` hoặc tuple intern:

```ts
const intern = new Map<string, { userId: string; role: string }>();
function keyOf(userId: string, role: string) {
  const k = `${userId}\0${role}`;
  return intern.getOrInsertComputed(k, () => ({ userId, role }));
}
```

Object literal mỗi lần `get({id})` là key mới. Cache identity (intern) khi cần lookup lặp.

---

## 3. Set

```ts
const s = new Set<number>([1, 2, 2, 3]);
s.size; // 3
s.add(4);
s.has(2);
s.delete(2);

const unique = [...new Set(["a", "b", "a"])]; // ["a", "b"]
```

- Equality: SameValueZero (giống Map).
- Thứ tự: insertion order.
- Unique list từ array: `[...new Set(arr)]` — O(n), mất lần trùng (giữ lần đầu).

`add` trả `this`. Iterate: `for (const x of s)` — `keys()`/`values()` cùng phần tử (Set-as-map-like). `JSON.stringify(set)` trả `"{}"` — luôn chuyển sang mảng `[...set]` trước khi serialize (`new Set(JSON.parse(json))` để round-trip).

### 3.1 Set operations (ES2025 / Node 26)

```ts
const a = new Set([1, 2, 3]);
const b = new Set([3, 4]);

a.union(b);               // {1,2,3,4}
a.intersection(b);        // {3}
a.difference(b);          // {1,2}
a.symmetricDifference(b); // {1,2,4}
a.isSubsetOf(b);
a.isSupersetOf(b);
a.isDisjointFrom(b);
```

Các method tạo tập kết quả **không mutate** `a`; các predicate trả boolean. Đối số nhận Set-like (`size` + `has` + `keys()`): **Map hợp lệ**, các method xét **keys** của Map. Array không có protocol này.

| Method | Ý nghĩa | Pattern tay (runtime cũ) |
|---|---|---|
| `union` | A ∪ B | `new Set([...a, ...b])` |
| `intersection` | A ∩ B | `[...a].filter(x => b.has(x))` |
| `difference` | A ∖ B | `[...a].filter(x => !b.has(x))` |
| `symmetricDifference` | (A ∖ B) ∪ (B ∖ A) | union minus intersection |
| `isSubsetOf` | A ⊆ B | `every` + `has` |
| `isSupersetOf` | A ⊇ B | đảo subset |
| `isDisjointFrom` | A ∩ B = ∅ | `![...a].some(x => b.has(x))` |

Chọn Set nhỏ hơn khi `intersection` tay (lặp set nhỏ, `has` set lớn). Baseline Node 26: dùng native (`union` độ phức tạp điển hình O(|A|+|B|); chain dài như `a.union(b).intersection(c)` cấp phát Set trung gian — đo nếu N lớn).

```ts
function except<T>(xs: Iterable<T>, blocked: Set<T>): T[] {
  return [...xs].filter((x) => !blocked.has(x));
}
```

### 3.2 Set-like & thứ tự

Method đại số chấp nhận **Set-like**: object có `size`, `has`, `keys()`. Array **không** Set-like (`has` khác `includes` naming). Wrap `new Set(arr)`.

```ts
a.union(new Set(array)); // OK
// a.union(array); // TypeError nếu array không đủ protocol
```

`isSubsetOf` trên Set rỗng: `true` (∅ ⊆ A). `isDisjointFrom` rỗng: `true`.

Object trong Set: unique theo reference — `{id:1}` hai lần = hai phần tử. Dedup DTO: map về id `new Set(rows.map(r => r.id))` rồi filter, hoặc `Map` id → row (giữ lần cuối / đầu).

### 3.3 Mutable iterate

Giống Map: `add` trong `for...of` có thể thăm phần tử mới. Pattern “drain”: `while (set.size) { const x = set.values().next().value; set.delete(x); }` — cẩn recursion/CPU. Copy `[...set]` rồi duyệt snapshot.

---

## 4. WeakMap, WeakSet, WeakRef & FinalizationRegistry

```ts
const wm = new WeakMap<WeakKey, string>();
const ws = new WeakSet<WeakKey>();

let obj: object | null = { n: 1 };
const localSym = Symbol("token"); // ES2023+: non-registered symbol hợp lệ làm WeakKey
wm.set(obj, "meta");
wm.set(localSym, "sym-meta");
// wm.set(Symbol.for("global"), "x"); // TypeError: registered symbol không được làm WeakKey
ws.add(obj);

obj = null; // entry có thể được GC — Weak* không giữ object sống
```

### 4.1 So sánh với Map / Set

| | `Map` / `Set` | `WeakMap` / `WeakSet` |
|---|---|---|
| Key | Bất kỳ | **Object hoặc non-registered `Symbol`** (ES2023+; `Symbol.for(...)` bị từ chối — TS built-in type: `WeakKey`) |
| Iterable / `.size` | Có | **Không** — không duyệt được |
| Giữ key sống? | Có (strong ref) | **Không** (weak) |
| Use-case | Dictionary / unique set | Metadata side-table, cache gắn instance |

> **Memory lifetime:** Khi không còn strong reference tới key object, entry Weak* **có thể** biến mất sau GC. Không đảm bảo thời điểm — đừng dùng cho logic “phải chạy lúc object chết” trừ khi kết hợp `FinalizationRegistry` (hiếm, thận trọng).

### 4.2 Pattern: private data side-table

```ts
type Instance = object;
const secrets = new WeakMap<Instance, string>();

class Token {
  constructor(secret: string) {
    secrets.set(this, secret);
  }
  peek() {
    return secrets.get(this);
  }
}
```

DOM node / class instance metadata mà không muốn leak khi node/instance biến mất → WeakMap.

Node 26: `WeakMap.prototype.getOrInsert` / `getOrInsertComputed` — §2.3.

### 4.3 `WeakRef` vs `FinalizationRegistry` vs `WeakMap`

Ba API **không** thay thế nhau:

| API | Giữ object? | Đọc lại? | Callback khi GC? |
|---|---|---|---|
| `WeakMap` | Không (key weak) | Có, **nếu còn key** trên tay | Không |
| `WeakRef` | Không | `deref()` → object hoặc `undefined` | Không |
| `FinalizationRegistry` | Không | Không (held value là token) | **Best-effort**, không kịp thời |

```ts
const ref = new WeakRef<{ n: number }>(obj);
ref.deref()?.n; // undefined nếu đã GC

const registry = new FinalizationRegistry<string>((held) => {
  // KHÔNG: đóng fd / logic nghiệp vụ bắt buộc
  console.log("maybe collected", held);
});
registry.register(obj, "id-1", unregisterToken);
registry.unregister(unregisterToken);
```

**Cấm / tránh:**

- Dùng FR như destructor C++ — GC có thể **không** chạy trước exit; delay vô hạn.
- `deref()` rồi cache mạnh trở lại (“resurrection”) — khó đoán.
- Cleanup I/O **bắt buộc** → `using` / `try/finally` / `Disposable` — [statements.md](statements.md), [functions-methods.md](functions-methods.md) §11.
- WeakRef cache: luôn null-check; coi miss là bình thường.

`WeakMap`: “tôi đang giữ `obj`, cần metadata”. `WeakRef`: “tôi **không** muốn giữ `obj` sống, thỉnh thoảng peek”. FR: telemetry / debug, không phải correctness.

### 4.4 Cache WeakRef (minh họa — đo trước khi dùng)

```ts
const cache = new Map<string, WeakRef<{ payload: Buffer }>>();

function getCached(id: string) {
  const hit = cache.get(id)?.deref();
  if (hit) return hit;
  cache.delete(id);
  return undefined;
}

function setCached(id: string, obj: { payload: Buffer }) {
  cache.set(id, new WeakRef(obj));
}
```

`Map` giữ **WeakRef** (small), không giữ `obj`. GC `obj` → `deref()` undefined. **Key string** trên `Map` vẫn sống — phải `delete` khi miss kẻo Map đầy WeakRef rỗng. FR `unregister` khi evict tay.

Pattern này **không** thay Redis/LRU với `maxSize`. Chỉ khi object lớn + identity đã có chỗ khác giữ mạnh (request). Production: LRU tường minh (`max`, TTL) dễ suy luận hơn GC.

### 4.5 WeakSet

`WeakSet` chỉ `add`/`has`/`delete` — đánh dấu “đã thăm” graph mà không giữ node. DFS:

```ts
type TreeNode = { children: TreeNode[] };

function walk(root: TreeNode, seen = new WeakSet<TreeNode>()) {
  if (seen.has(root)) return;
  seen.add(root);
  for (const c of root.children) walk(c, seen);
}
```

Không iterate “mọi node đã thăm”. Cần list → `Set` mạnh + chấp nhận giữ sống, hoặc copy id.

---

## 5. Object vs Map vs Record

| Nhu cầu | Prefer | Lý do |
|---|---|---|
| Record cố định, shape biết trước | plain object / `interface` | JSON-friendly, typed fields |
| Dictionary string key động, JSON | `Record<string, V>` / object | `JSON.stringify` trực tiếp |
| Key không phải string (object, number ổn định…) | `Map` | Object ép key thành string |
| Insertion order + duyệt ổn định | `Map` (object hiện đại cũng insertion-order string keys — Map **intent** rõ) | |
| Tránh prototype pollution | `Map` hoặc `Object.create(null)` | `__proto__` / inherited keys |
| Metadata không leak | `WeakMap` | Xem §4 |
| Serialize / config / DTO | object | Map → `Object.fromEntries` trước JSON |
| Cần `.size` O(1) | `Map` | Object phải `Object.keys` O(n) |
| Key `symbol` | object hoặc `Map` | `JSON` bỏ symbol |

```ts
// Object key bị ép string — dễ bug:
const o: Record<string, number> = {};
o[1] = 10;
o["1"]; // 10

const m = new Map<number, number>();
m.set(1, 10);
m.get(1); // 10 — number key thật
```

`Record<K, V>` là **type** (mapped), không phải runtime class. `K` thường `string | number | symbol` / union literal. `Record<string, V>` chấp nhận **mọi** string key — không exhaustive. `Record<Role, V>` với `Role` union **ép đủ key**.

```ts
type Role = "admin" | "user";
const permissions: Record<Role, string[]> = {
  admin: ["*"],
  user: ["read"],
}; // thiếu key → lỗi TS
```

Index signature vs `Map`: excess property trên **object literal** gán `interface` bị bắt; gán qua biến đã widen thì không. `Map` không có excess — key nào `set` cũng được.

> **Rule of thumb:** shape tĩnh / JSON → object. Key động / non-string / cần `.size` / insertion semantics rõ → `Map`. Type-level dictionary → `Record`.

`Object.hasOwn` / `Object.create(null)` khi object-as-map. `for...in` đi prototype — tránh; `Object.keys` / `Object.entries`.

### 5.1 Bảng quyết định ngắn

```text
Cần JSON / DTO shape tĩnh?     → object / interface
Cần đủ key union (Role)?       → Record<Role, V>
Key string động + JSON?        → object hoặc Map rồi fromEntries
Key number thật / object?      → Map
Metadata theo đời instance?    → WeakMap
Unique + đại số tập hợp?       → Set
Danh sách index?               → Array
```

`null` prototype: `Object.create(null)` + `in` không đi `Object.prototype`. Vẫn không có `.size`. `__proto__` key trên object thường: pollution — `Object.hasOwn` / `Map`.

`JSON.parse` luôn object/array/primitive — không bao giờ `Map`. Reviver có thể xây `Map` tay.

---

## 6. TypedArray, ArrayBuffer & Buffer

### 6.1 Overview

```ts
const buf = new ArrayBuffer(16);
const u8 = new Uint8Array(buf);
const f64 = new Float64Array(buf); // cùng backing — aliasing!

u8[0] = 255;
const view = new DataView(buf);
view.setUint32(0, 0x12345678, true); // littleEndian
```

| Type | Bytes / element |
|---|---|
| `Int8Array` / `Uint8Array` / `Uint8ClampedArray` | 1 |
| `Int16Array` / `Uint16Array` / `Float16Array` (ES2025 / Node 26) | 2 |
| `Int32Array` / `Uint32Array` / `Float32Array` | 4 |
| `Float64Array` / `BigInt64Array` / `BigUint64Array` | 8 |

Dùng khi: binary protocol, crypto, image, AI/ML tensor (`Float16Array`), WASM, I/O buffer. `DataView` khi cần endian / offset linh hoạt (hỗ trợ cả `getFloat16` / `setFloat16` từ ES2025 / Node 26). `ArrayBuffer.isView(x)` trả `true` cho mọi TypedArray và `DataView` — **không** cho `ArrayBuffer` trần.

### 6.2 Endian & views

Multi-byte TypedArray (`Uint32Array`, `Float64Array`, …) dùng **endian của máy** (Node x64: little-endian). Wire protocol BE/LE tường minh → **`DataView`** (`littleEndian` boolean), không đọc `uint32[0]` rồi serialize chéo platform.

```ts
const ab = new ArrayBuffer(4);
const dv = new DataView(ab);
dv.setUint16(0, 0x1234, false); // big-endian
dv.getUint16(0, true);          // diễn giải LE — số khác
```

Nhiều view trên **cùng** `ArrayBuffer` (offset/length) = alias: ghi `u8` đổi `f64`. `subarray` = view; `slice` trên TypedArray = **copy** buffer mới (khác `Array#slice` semantics tương tự copy; khác `Buffer#slice` lịch sử).

`SharedArrayBuffer` + `Atomics`: cross-thread — [threading.md](threading.md). Không nhầm `ArrayBuffer` thường.

### 6.3 Node `Buffer`

```ts
import { Buffer } from "node:buffer";

const b = Buffer.from("hello", "utf8");
b.equals(Buffer.from("hello"));
Buffer.concat([b, Buffer.from("!")]);

// Buffer extends Uint8Array — nhưng có API riêng (alloc, write*, …)
const u8: Uint8Array = b;
```

| API | Việc |
|---|---|
| `Buffer.alloc(n)` | zero-fill — an toàn |
| `Buffer.allocUnsafe(n)` | nhanh hơn, **có thể chứa dữ liệu cũ** (pool) |
| `Buffer.allocUnsafeSlow(n)` | unsafe, không pool |
| `Buffer.from(...)` | từ string / array / ArrayBuffer |
| `buf.subarray(start, end)` | view (không copy) — Node hiện đại prefer hơn `slice` legacy |
| `buf.slice` | historically view trên Buffer (khác `Uint8Array#slice` copy) — **dùng `subarray`/`copy` tường minh** |
| `readUInt32LE` / `writeUInt32BE` / … | endian tường minh |
| `toString(enc)` / `write(str, enc)` | `utf8`, `hex`, `base64`, `base64url`, `latin1`… |
| `equals` / `compare` / `copy` | so sánh / copy byte |

`JSON.stringify(buffer)` → `{ type: "Buffer", data: number[] }` (tốn). Wire/HTTP: `Uint8Array` / web `Blob` tùy API; nhiều Node stream vẫn `Buffer`.

Web API (`fetch` body, `crypto.subtle`) thích `Uint8Array` / `ArrayBuffer`. `Buffer` gán được vì subclass — đừng giả mọi `Uint8Array` có `buf.equals`.

`new Buffer()` / `Buffer(n)` **deprecated** (unsafe). Luôn `alloc` / `from`.

### 6.4 Pitfalls

1. **Aliasing:** nhiều TypedArray trên cùng `ArrayBuffer` ghi đè lẫn nhau.
2. **Endian:** multi-byte cần biết LE/BE — dùng `DataView` hoặc `read*LE`/`BE`.
3. **`allocUnsafe`:** chỉ dùng khi ghi đè toàn bộ trước khi đọc / không lộ ra ngoài.
4. **SharedArrayBuffer / Atomics:** cross-thread — xem [threading.md](threading.md).
5. **Copy vs view:** `subarray` / tạo TypedArray từ buffer khác offset = view; cần độc lập → `Uint8Array.from` / `Buffer.from` / `structuredClone` tùy case.
6. **UTF-8 cắt giữa code unit:** `buf.subarray` giữa chuỗi → `toString` replacement character. Dùng `textDecoder` stream hoặc cắt theo ranh giới.

### 6.5 TypedArray vs `Array` methods

TypedArray có nhiều method giống Array (`map`, `filter`, `slice`, `subarray`, `sort`, `toSorted` trên engine hiện đại, `set`, `fill`) nhưng:

| | `Array` | TypedArray |
|---|---|---|
| Phần tử | Mọi kiểu | Homogeneous số / bigint |
| Hole | Có | **Không** — mọi index 0..length-1 |
| `map` return | `Array` | **cùng** TypedArray kind (thường) |
| `push`/`pop` | Có | **Không** — length cố định (trừ resizable AB) |
| `Array.isArray` | true | false |
| `concat` | Có | Không giống Array; dùng `set` + offset |

`buf.set(other, offset)` copy bytes. `Float64Array.sort()` / `Uint8Array.sort()` mặc định so sánh **theo số** (khác `Array#sort` so chuỗi): `-0` đứng trước `+0`, `NaN` đứng sau mọi số ([CompareTypedArrayElements](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-comparetypedarrayelements)).

`Uint8ClampedArray`: gán ngoài 0..255 clamp — canvas. Crypto: `Uint8Array`.

### 6.6 Transfer, Resizable `ArrayBuffer` & Growable `SharedArrayBuffer`

- **Transfer (ES2024 / Node 22+–26):** `arrayBuffer.transfer()` / `transferToFixedLength()` chuyển ownership không copy; buffer nguồn bị **detached** (`byteLength === 0`). Worker `postMessage(buf, [buf])` tương tự. Sau detach, TypedArray view có `view.length === 0` và đọc `view[0]` trả `undefined` (còn `DataView` hoặc một số method như `.set()`/`.subarray()` trên buffer detached sẽ ném `TypeError`).
- **`Buffer` pool:** `Buffer.allocUnsafe()` nhỏ có thể cắt từ slab pool chung — **không** transfer `buf.buffer` nếu còn view khác chia sẻ cùng `ArrayBuffer`.
- **Resizable `ArrayBuffer` & Growable `SharedArrayBuffer` (ES2024 / Node 20+–26):**

```ts
const ab = new ArrayBuffer(8, { maxByteLength: 64 });
const view = new Uint8Array(ab); // length-tracking view
ab.resize(32);                   // có thể tăng hoặc co (0..maxByteLength); view.length === 32

const sab = new SharedArrayBuffer(8, { maxByteLength: 64 });
sab.grow(32);                    // CHỈ tăng (monotonic, không co được để an toàn multi-thread)
```

### 6.7 Encoding `Buffer`

| Encoding | Ghi chú |
|---|---|
| `utf8` | Mặc định; cắt giữa code point → U+FFFD |
| `utf16le` | 2 byte/unit |
| `latin1` / `binary` | 1 byte — **không** Unicode đầy đủ |
| `hex` | 2 char / byte |
| `base64` / `base64url` | Padding / alphabet khác nhau |
| `ascii` | 7-bit |

`Buffer.byteLength(str, enc)` ≠ `str.length` (UTF-16 units). Cắt string theo byte budget: encode rồi `subarray`, hoặc library grapheme.

> **Cảnh báo bảo mật — so sánh byte:** `buf.equals(other)` dùng `memcmp` (early-exit, **KHÔNG constant-time**); `===` chỉ so sánh **reference**. Khi so sánh secret, HMAC, chữ ký hay token, bắt buộc dùng **`crypto.timingSafeEqual(a, b)`** (kiểm `a.byteLength === b.byteLength` trước vì lệch độ dài sẽ ném `RangeError`). `Buffer.compare(a, b)` / `buf.compare` so sánh lexicographic theo byte (không theo locale).

`buf.toJSON()` → `{ type: "Buffer", data: [...] }` — payload lớn. Log: `hex` slice.

### 6.8 `Uint8Array` Base64 & Hex (ES2026 / Node 26)

V8 14.6 / Node 26 bổ sung trực tiếp các method chuyển đổi Base64 & Hex chuẩn ECMAScript lên `Uint8Array` — chạy đồng nhất giữa Node và trình duyệt mà không cần `node:buffer`:

```ts
const bytes = Uint8Array.fromBase64("SGVsbG8=");
bytes.toBase64();                            // "SGVsbG8="
bytes.toBase64({ alphabet: "base64url", omitPadding: true }); // "SGVsbG8"

const hexBytes = Uint8Array.fromHex("deadbeef");
hexBytes.toHex();                            // "deadbeef"

// Ghi trực tiếp vào buffer có sẵn (tránh cấp phát mới):
const dst = new Uint8Array(16);
const { read, written } = dst.setFromBase64("SGVsbG8=");
dst.setFromHex("cafe");
```

---

## 7. Utility types cho collections

```ts
type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
};
```

```ts
type UserPatch = Partial<User>;              // PATCH — mọi field optional
type StrictUser = Required<User>;
type FrozenUser = Readonly<User>;            // shallow — nested vẫn mutable
type UserPublic = Pick<User, "id" | "name" | "role">;
type UserCreate = Omit<User, "id">;
type UserUpdate = Partial<Pick<User, "name" | "email" | "role">>;

type Role = "admin" | "user" | "guest";
const permissions: Record<Role, string[]> = {
  admin: ["*"],
  user: ["read"],
  guest: [],
}; // Record ép đủ key trong union — exhaustive

type P = Parameters<(a: number, b: string) => void>; // [number, string]
type V = Awaited<Promise<number>>; // number
```

| Type | Việc |
|---|---|
| `Partial` / `Required` / `Readonly` | optional / required / shallow readonly type |
| `Pick` / `Omit` / `Record` | subset / bỏ field / dictionary |
| `Exclude` / `Extract` / `NonNullable` | lọc union |
| `ReturnType` / `Parameters` / `Awaited` / `InstanceType` | suy từ hàm / Promise / class |

### 7.1 `Readonly` / `Partial` + excess property

Cả hai **shallow**: `Partial<{ a: { n: number } }>` vẫn `a.n` bắt buộc nếu `a` có mặt. `Readonly` không đóng băng nested; `as const` mới deep-ish literal.

```ts
type Patch = Partial<User>;
// @ts-expect-error excess property `extra` bị chặn trên fresh literal
const literal: Patch = { id: "1", extra: true };
const widened = { id: "1", extra: true };
const ok: Patch = widened; // excess **không** bắt — đã widen
```

> **Callout:** Excess property check chỉ object **fresh**. `Partial` không chặn field lạ sau khi đi qua biến. Validate I/O (JSON) bằng schema, không chỉ `Partial<T>`.

Readonly property trên object không tạo tính bất biến runtime và TS vẫn cho nhiều phép gán sang kiểu mutable tương ứng. `readonly T[]` được kiểm chặt hơn: không gán vào `T[]` vì thiếu method mutate. Thiết kế API nhận readonly và tránh alias mutable.

`Partial<Readonly<T>>` và `Readonly<Partial<T>>` tạo cùng optional/readonly modifiers cho object thông thường. PATCH API: `Partial<Pick<…>>` rõ hơn `Partial<T>` bao cả `id`.

`exactOptionalPropertyTypes`: `Partial` cho phép omit, việc truyền `undefined` tường minh có thể lỗi.

### 7.2 `Omit` / `Pick` pitfalls

`Pick`/`Omit` trên union chỉ giữ key chung từ `keyof T`, không tự phân phối như `Exclude`. Dùng `type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never` để giữ từng variant.

`keyof` trên `any` = `string | number | symbol`. `keyof` trên object với index signature rộng. `Pick<T, K>` đòi `K extends keyof T`.

`Record<string, V>` + known keys: index signature cho phép thêm field — **không** exhaustive. Prefer union key `Record<Role, V>`.

`NonNullable<T>` (từ TS 4.8+) là `T & {}` (loại `null | undefined`, giữ nguyên các kiểu khác). Optional `?` vẫn có thể là `T | undefined` tùy `exactOptionalPropertyTypes`.

---

## 8. Generics thực dụng với collections

```ts
function identity<T>(value: T): T {
  return value;
}
class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}
function first<T>(xs: readonly T[]): T | undefined {
  return xs[0];
}

function longer<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b; // constraint tối thiểu — tránh any
}

function pluck<T, K extends keyof T>(rows: readonly T[], key: K): T[K][] {
  return rows.map((r) => r[key]);
}

type ApiResponse<T = unknown> = { data: T; status: number };

function groupBy<T, K extends PropertyKey>(
  xs: readonly T[],
  keyFn: (x: T) => K,
): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of xs) {
    m.getOrInsertComputed(keyFn(x), () => []).push(x);
  }
  return m;
}
```

- Input: prefer `readonly T[]` (chấp nhận mutable lẫn readonly).
- Trong TS, `Map<K, V>` và `Set<T>` **covariant trên value/element** (unsound giống `Array<T>`) do method bivariance — `Map<string, Dog>` gán được vào `Map<string, Animal>`; dùng `ReadonlyMap`/`ReadonlySet` cho consumer chỉ đọc, hoặc tự bọc / dùng `in out` khi cần invariant thật (§8.5).
- `Object.groupBy` / `Map.groupBy` → [iterables-linq.md](iterables-linq.md).

### 8.1 Constraints + variance

| Container | Variance TS (thực dụng) | Hệ quả |
|---|---|---|
| `Array<T>` | **covariant** (unsound) | `Dog[]` gán `Animal[]` — `push(cat)` runtime lỗ |
| `readonly T[]` | covariant (an toàn cho **đọc**) | Prefer cho input |
| `Map<K,V>` / `Set<T>` | **covariant** trên value/element (unsound do method bivariance) | `Map<string, Dog>` gán được `Map<string, Animal>`; dùng `ReadonlyMap`/`ReadonlySet` cho input chỉ đọc |
| `Promise<T>` | covariant value | `Promise<Dog>` gán `Promise<Animal>` |
| Function `(x: T) => U` | contra `T`, co `U` | [functions-callbacks.md](functions-callbacks.md) §8 |

`T extends U` = constraint (`T` phải gán được vào `U`), **không** phải runtime check. `K extends keyof T` + indexed access `T[K]` — pattern pluck/prop.

**Variance annotations (`in` / `out` — TS 4.7+) & `NoInfer<T>` (TS 5.4+ / 7.0):**

```ts
interface Producer<out T> { get(): T }             // covariant
interface Consumer<in T> { accept(v: T): void }    // contravariant
interface Cell<in out T> { get(): T; set(v: T): void } // invariant — chặn alias rộng

// NoInfer<T>: chặn fallback làm widen T thành union rộng hơn items
function pickOrDefault<T extends string>(
  items: readonly T[],
  fallback: NoInfer<T>,
): T {
  return items[0] ?? fallback;
}
pickOrDefault(["red", "blue"], "red"); // OK — T là "red" | "blue"
// pickOrDefault(["red", "blue"], "green"); // lỗi TS — không bị suy thành "red" | "blue" | "green"
```

`const` type params (`<const T>`): infer literal/readonly từ input. Đừng `T extends any` / default `any`; prefer `unknown` + thu hẹp.

### 8.2 Branded / nominal keys

```ts
type UserId = string & { readonly __brand: "UserId" };
function asUserId(s: string): UserId {
  return s as UserId;
}
const byUser = new Map<UserId, User>();
```

Brand chỉ TS — runtime vẫn string. `Map` equality vẫn SameValueZero trên string. Tránh nhầm `UserId` với `OrderId` ở call-site.

### 8.3 Default type param & inference fail

`type ApiResponse<T = unknown>`: quên `<User>` → `unknown`. Factory `function wrap<T>(d: T): ApiResponse<T>` infer từ value.

`groupBy` `K extends PropertyKey` **không** nhận object key — dùng `Map` thủ công với object key (reference).

`ReadonlyMap<K,V>` / `ReadonlySet<T>` (TS lib): không `set`/`add` trên kiểu — runtime vẫn mutate được nếu object thật là Map. Chỉ bảo vệ compile-time.

### 8.4 `satisfies` với collections

```ts
const table = {
  admin: ["*"],
  user: ["read"],
  guest: [],
} as const satisfies Record<Role, readonly string[]>;
```

`satisfies` kiểm đủ key và giữ kiểu sau contextual typing; property mutable vẫn có thể widen. Dùng `as const satisfies` nếu cần literal/readonly, như [typesystem.md](typesystem.md#15-satisfies-vs-as-const-vs-annotation).

### 8.5 `Array` covariant — ví dụ lỗ

```ts
const dogs: Dog[] = [];
const animals: Animal[] = dogs; // TS cho phép
// animals.push(cat); // runtime: dogs chứa Cat
```

Truyền `Dog[]` vào `function f(xs: Animal[]) { xs.push(cat); }` — lỗ. Input: `readonly Animal[]` không `push`. Output builder: `Animal[]` tạo mới, không alias `Dog[]`.

`Set<Dog>` có thể gán sang `Set<Animal>` trong hệ kiểu TS dù mutate qua alias rộng là không sound. Method parameters có ngoại lệ bivariance; `strictFunctionTypes` không tự làm collection mutable invariant. Nhận `ReadonlySet<Animal>` ở API chỉ đọc. [Method variance](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-6.html#strict-function-types).

`Map<string, Dog>` cũng có thể được nhìn qua alias `Map<string, Animal>` và bị thêm giá trị khác. Dùng `ReadonlyMap` cho consumer chỉ đọc; khi cần invariant thực sự, thiết kế wrapper với function property cho cả input/output và kiểm type tests. Readonly view vẫn chia cùng object runtime.

---


## 9. Conditional types, `infer` & mapped types

```ts
type IsString<T> = T extends string ? true : false;

// Distributive trên union — bọc [T] để tắt
type ToArray<T> = T extends any ? T[] : never;
type T1 = ToArray<string | number>; // string[] | number[]
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;
type T2 = ToArrayNonDist<string | number>; // (string | number)[]

type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
type MapValue<T> = T extends Map<unknown, infer V> ? V : never;
type SetElement<T> = T extends Set<infer E> ? E : never;

type OptionalFlags<T> = { [K in keyof T]?: boolean }; // Partial/Readonly = mapped trong lib
type EventName = `on${Capitalize<"click" | "focus">}`;
```

Ultra-advanced (`-readonly`, key remapping `as`) → [typesystem.md](typesystem.md). Type-level nặng → compile chậm.

`infer` trong `T extends Promise<infer U>` ~ `Awaited` đơn giản (không recursive thenable). Collection: `ElementOf` trên tuple vs Array — tuple `infer` giữ literal nếu `as const`.

### 9.1 Mapped `-readonly` / `-?` (nhắc)

```ts
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type RequiredKeys<T> = { [K in keyof T]-?: T[K] };
```

`Mutable<Readonly<User>>` không deep. `-?` gỡ modifier optional — đây chính là cách thư viện chuẩn định nghĩa `Required<T>`. Key remapping `as` → [typesystem.md](typesystem.md).

`keyof` `string[]` gồm number + `"length"` + methods — `Pick` array hiếm khi đúng; dùng tuple / `T[number]`.

---

## 10. `ReadonlyArray`, tuple & `as const`

```ts
function sum(xs: ReadonlyArray<number>) {
  return xs.reduce((a, b) => a + b, 0); // không push được
}
sum([1, 2, 3]); // Array OK vào readonly input

type Pair = [string, number];
type Rest = [string, ...number[]];
type Point3D = [x: number, y: number, z: number];

const roles = ["admin", "user", "guest"] as const;
type Role = (typeof roles)[number]; // literal union + deep readonly

function createRoute<const T extends string>(path: T) {
  return { path };
}
const r = createRoute("/users"); // path: "/users" — const type params (TS 5+)
```

API nhận input: prefer `readonly T[]`. `as const` → literal thay widen + deep readonly.

Tuple vs Array: `map` trên tuple widen thành Array (mất length). `satisfies readonly […]` giữ.

### 10.1 Variadic tuple & collections

```ts
type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]]
  ? H
  : never;
type PairList<T> = Array<[T, T]>;
```

`as const` trên `[[1, "a"], [2, "b"]]` → readonly tuple of tuples — `Map` ctor nhận `Iterable<readonly [K, V]>` (nên mảng tuple `as const` truyền trực tiếp được).

`readonly [string, number]` không gán `[string, number]` (mutate index). Spread `[...tuple]` → Array widen.

---

## 11. Iterator protocol (tóm tắt)

Collections built-in đều iterable:

```ts
for (const x of [1, 2, 3]) {}
for (const [k, v] of new Map([["a", 1]])) {}
for (const x of new Set([1, 2])) {}
for (const byte of new Uint8Array([1, 2])) {}
```

- Iterable: có `[Symbol.iterator]()`.
- Iterator: `{ next(): { value, done } }`.
- `for...of`, spread `[...iter]`, `Array.from` đều dựa protocol này.
- **WeakMap / WeakSet không iterable.**

Generators / lazy LINQ / async generators / iterator helpers → **[iterables-linq.md](iterables-linq.md)**.

```ts
function* take<T>(xs: Iterable<T>, n: number) {
  let i = 0;
  for (const x of xs) {
    if (i++ >= n) return;
    yield x;
  }
}
```

`Map`/`Set` iterator **live**: mutate trong lúc `for...of` — insertion sau cursor có thể được thăm (spec Map/Set). Đừng mutate vừa duyệt trừ khi hiểu rõ; copy key list nếu xóa.

### 11.1 `Object.groupBy` / `Map.groupBy`

```ts
const g = Object.groupBy(people, (p) => p.city);
// TS: Partial<Record<string, Person[]>> — runtime: null-prototype object (Object.create(null))
const gm = Map.groupBy(people, (p) => p.city);
// Map<string, Person[]>
```

Key `undefined` / symbol: xem spec — `Object.groupBy` key `ToPropertyKey`. Object key thật → `Map.groupBy`. Không mutate mảng nguồn; mảng nhóm **shallow** (cùng phần tử).

---

## 12. Hiệu năng & pitfalls

| Pattern | Vấn đề | Hướng xử lý |
|---|---|---|
| `unshift` / `splice(0,…)` trong vòng | O(n²) | `push` + `reverse`, hoặc cấu trúc khác |
| `arr.includes` trong vòng lồng | O(n²) | `Set` O(1) lookup |
| Sparse array | hole + tối ưu engine kém | dense array hoặc `Map` |
| `delete arr[i]` | tạo hole | `splice` / filter copy |
| Nested `map`+`filter`+`map` trên mảng lớn | nhiều alloc | một vòng `for`, hoặc generator lazy |
| Shared `fill([])` / `fill({})` | cùng reference | `Array.from` factory |
| JSON `Map` trực tiếp | `{}` rỗng / mất dữ liệu | `Object.fromEntries` |
| Giữ reference object làm Map key lâu | leak nếu không cần | WeakMap hoặc xóa tay |
| `sort` không cmp | sai thứ tự số | `(a,b) => a-b` / `toSorted` |
| `get(k) ?? x` trên Map | `undefined` value hợp lệ | `has` / `getOrInsert` |
| WeakRef làm lock file | GC không đảm bảo | `using` / finally |

```ts
// Bad: O(n²)
for (const x of xs) {
  if (ys.includes(x)) { /* ... */ }
}

// Good: O(n)
const set = new Set(ys);
for (const x of xs) {
  if (set.has(x)) { /* ... */ }
}
```

Prefill khi biết kích thước: `Array.from({ length: n }, …)` hoặc `new Array(n)` rồi gán — tránh `push` lặp nếu profile cho thấy realloc đáng kể (thường engine đã ổn). `new Array(n)` **không** gán = sparse.

`reduce` xây object lớn vs `for` + `getOrInsert`: `for` thường rõ hơn — [iterables-linq.md](iterables-linq.md) “khi reduce tệ”.

### 12.1 Memory: Map vs object vs Array

| N phần tử | Ghi chú thực dụng (không benchmark thay đo) |
|---|---|
| Array dense number | Tối ưu hidden class / packed elements |
| Array hole | Fallback slow elements |
| Object string keys | Hidden class; nhiều key động → dict mode |
| `Map` | Ổn định với insert/delete liên tục |
| `Set` lookup vs `includes` | `Set` thắng khi N lookup lớn |

Đo với dữ liệu thật. Micro-benchmark V8 warmup dễ đánh lừa.

Hidden class: gán field cùng thứ tự trên object-as-record. Dictionary động → `Map` đỡ đau hơn xóa field liên tục (`delete obj[k]`).

### 12.2 `structuredClone` vs JSON vs spread

| | JSON | `structuredClone` | spread / `slice` |
|---|---|---|---|
| `Map`/`Set` | mất / `{}` | giữ | không (shallow ref) |
| `Date` | string | `Date` | ref |
| `Buffer` / `Uint8Array` | `{ type: "Buffer", data }` / object chỉ số | copy bytes (**`Buffer` thành `Uint8Array` thuần**) | `[...u8]` là `number[]` copy; `u8.slice()` là `Uint8Array` copy (chỉ `Buffer#slice` legacy mới là view) |
| function | bỏ / lỗi | **ném** | ref |
| cycle | ném | giữ | ref cycle |

Clone DTO JSON-safe: JSON. Clone `Map` + `Date`: `structuredClone` (global sẵn trên Node, dùng cùng thuật toán với Worker/`postMessage`). Copy mảng object: spread **không** deep.

### 12.3 Index `number` vs string trên Array

`arr[0]` và `arr["0"]` cùng element. `arr[-1]` **không** phải `at(-1)` — tạo property `"-1"` (không đổi `length`). Tương tự `arr[1.2]` tạo property `"1.2"`, không phải element 1 — luôn kiểm `Number.isInteger(i)` khi index đến từ tính toán/input. Sparse `length` lớn + một index cuối = tốn metadata, không phải packed.

---

## 13. Best practices

1. Input API: `readonly T[]` / `Iterable<T>` khi chỉ duyệt; đừng bắt buộc mutable `T[]`.
2. Prefer `toSorted` / `toReversed` / `toSpliced` / `with` khi cần bất biến. `sort` cmp số/locale đúng.
3. Dictionary key động / non-string → `Map`; DTO/JSON shape tĩnh → object; type dict → `Record`.
4. Metadata theo đời object → `WeakMap` / `WeakSet`. Cleanup bắt buộc **không** phải FR/WeakRef.
5. Unique + lookup nhanh → `Set` (+ algebra native); đừng `includes` trong vòng nóng.
6. Binary I/O → `Uint8Array` / `Buffer`; endian qua `DataView` / `read*LE`; tránh `allocUnsafe` lộ dữ liệu.
7. Generic: `K extends keyof T`, constraint tối thiểu; `Array`, `Map`, `Set` đều covariant (unsound khi mutate qua alias rộng) — dùng `readonly T[]` / `ReadonlyMap` / `ReadonlySet` cho input chỉ đọc (hoặc `in out` trên container tự viết).
8. Utility: `Partial`/`Pick`/`Omit`/`Record` cho DTO; shallow + excess chỉ fresh literal; I/O cần schema.
9. Tránh sparse array và O(n²) nested scan. Cache: `getOrInsertComputed` (Node 26).
10. Type-level phức tạp → tách type alias có tên; ultra-advanced → [typesystem.md](typesystem.md).

---

## 14. Checklist

```text
□ Mutating sort/reverse/splice có chủ đích, hoặc dùng toSorted/…
□ Comparator sort: số a-b; không boolean; NaN đã lọc
□ Không sparse / delete index trên Array; hiểu hole vs undefined
□ Lookup trong vòng dùng Set/Map, không includes O(n)
□ Object vs Map vs Record đã chọn đúng (JSON shape vs key động vs type)
□ Map key: SameValueZero; +0/-0; NaN; reference object
□ getOrInsert vs getOrInsertComputed (eager default vs lazy)
□ Weak* chỉ khi cần weak lifetime; không duyệt; không FR cho I/O
□ Buffer: alloc vs allocUnsafe; view vs copy; endian
□ API input dùng readonly T[] / Iterable khi phù hợp
□ Generic constraint tối thiểu; không any; hiểu Array/Map/Set covariant (dùng Readonly* cho input)
□ Partial/Readonly hiểu là shallow; excess không chặn widened
□ JSON Map qua Object.fromEntries / entries
□ Set algebra native (union/intersection/…) khi Node 26
```

---

## 15. Cheat sheet

| Nhu cầu | Cấu trúc |
|---|---|
| Danh sách có thứ tự, index số | `Array` / `readonly T[]` |
| Key tùy ý, insertion order | `Map` |
| Tập unique + đại số tập hợp | `Set` |
| Metadata không leak | `WeakMap` / `WeakSet` |
| Peek không giữ sống | `WeakRef` (cẩn thận) |
| Binary / buffer | `TypedArray` / `Buffer` + `DataView` |
| Dictionary string đơn giản | object / `Record<string, V>` |
| Enum runtime + type | `as const` array/object |

```ts
const map = new Map<string, number>();
map.getOrInsertComputed("a", () => 0);

const set = new Set<string>(["a", "b"]);
const uniq = [...new Set(arr)];
set.union(other);

nums.toSorted((a, b) => a - b);
type Patch = Partial<Pick<User, "name" | "email">>;

function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const dirs = ["asc", "desc"] as const;
type Dir = (typeof dirs)[number];
```

| Mutating | Copy (ES2023+) |
|---|---|
| `sort` / `reverse` / `splice` | `toSorted` / `toReversed` / `toSpliced` / `with` |

---

## 16. Version matrix

| Phiên bản / nền | Liên quan collections |
|---|---|
| ES2015 | `Map`, `Set`, `WeakMap`, `WeakSet`, TypedArray |
| ES2021 | `WeakRef`, `FinalizationRegistry` |
| ES2022 | `at`, `Object.hasOwn`, … |
| ES2023 | `toSorted`, `toReversed`, `toSpliced`, `with`, `findLast*`, non-registered `Symbol` làm `WeakKey` |
| ES2024 | `Object.groupBy`, `Map.groupBy`, `ArrayBuffer.prototype.transfer()`, resizable `ArrayBuffer` / growable `SharedArrayBuffer` |
| ES2025 | Set methods (`union`, `intersection`, `difference`, …), `Float16Array` & `DataView.{get,set}Float16` |
| ES2026 / Node 26 (baseline) | `Map`/`WeakMap` `getOrInsert` / `getOrInsertComputed`, `Uint8Array` Base64 & Hex (`fromBase64`/`toBase64`/`fromHex`/`toHex`), V8 14.6+ |
| Node `Buffer` | `Uint8Array` subclass; `alloc` / `allocUnsafe` / `timingSafeEqual` (từ `node:crypto`) |
| TypeScript 7.0 | generics, conditional, `infer`, mapped, `const` type params, `in`/`out`, `NoInfer<T>` (TS 5.4+) |

Baseline repo: **Node 26 Active LTS (V8 14.6+)** + **TS 7.0** — dùng các API trên trực tiếp; thư viện public hỗ trợ Node cũ hơn nên feature-detect (vd `typeof buf.transfer === "function"`, `typeof Map.prototype.getOrInsertComputed === "function"`) hoặc ghi rõ `engines.node`.

---

## 17. Tài liệu liên quan

- [Iterator, Iterable & “LINQ-like”](iterables-linq.md) — protocol, generators, helpers, lazy pipelines
- [Hệ thống kiểu dữ liệu](typesystem.md) — type-level nâng cao
- [Hàm & Method](functions-methods.md)
- [Function type, Callback & Lambda](functions-callbacks.md) — variance hàm
- [Lập trình hướng đối tượng trong TypeScript](oop.md)
- [Lập trình bất đồng bộ](async.md) — `map(async)` + `Promise.all`
- [Worker Threads & Child Process](threading.md) — SharedArrayBuffer / Atomics
- [Phát biểu](statements.md) — `using` thay FinalizationRegistry cho resource
- [Type tests cho public generics](testing.md)
