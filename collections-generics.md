# Tập hợp & Generics trong JavaScript / TypeScript

Tham chiếu thực dụng cho cấu trúc dữ liệu built-in và generics / utility types của TypeScript khi làm việc với collections. Baseline: **ES2024+ / Node.js 26**, **TypeScript 7**.

Iterator / LINQ-like sâu hơn → [iterables-linq.md](iterables-linq.md). Type-level siêu nâng cao → [typesystem.md](typesystem.md).

---

## Mục lục

1. [Array — semantics & methods](#1-array--semantics--methods)
2. [Map](#2-map)
3. [Set](#3-set)
4. [WeakMap & WeakSet](#4-weakmap--weakset)
5. [Object vs Map — khi nào dùng gì](#5-object-vs-map--khi-nào-dùng-gì)
6. [TypedArray, ArrayBuffer & Buffer](#6-typedarray-arraybuffer--buffer)
7. [Utility types cho collections](#7-utility-types-cho-collections)
8. [Generics thực dụng với collections](#8-generics-thực-dụng-với-collections)
9. [Conditional types, `infer` & mapped types](#9-conditional-types-infer--mapped-types)
10. [`ReadonlyArray`, tuple & `as const`](#10-readonlyarray-tuple--as-const)
11. [Iterator protocol (tóm tắt)](#11-iterator-protocol-tóm-tắt)
12. [Hiệu năng & pitfalls](#12-hiệu-năng--pitfalls)
13. [Best practices](#13-best-practices)
14. [Checklist](#14-checklist)
15. [Cheat sheet](#15-cheat-sheet)
16. [Version matrix](#16-version-matrix)
17. [Tài liệu liên quan](#17-tài-liệu-liên-quan)

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

### 1.1 Mutating vs copy (bảng so sánh)

| Mutating (sửa tại chỗ) | Non-mutating (trả mảng mới) | Ghi chú |
|---|---|---|
| `push` / `pop` | — | O(1) amortized cuối |
| `unshift` / `shift` | — | O(n) — tránh hot path |
| `splice` | `toSpliced` | ES2023+ |
| `sort` | `toSorted` | `sort` **mutate** — copy trước nếu cần giữ gốc |
| `reverse` | `toReversed` | tương tự |
| `copyWithin`, `fill` | — | ghi đè vùng / fill |
| — | `slice`, `concat`, `map`, `filter`, `flat`, `flatMap` | luôn mảng mới (shallow) |
| — | `with(index, value)` | thay 1 phần tử, trả copy (ES2023+) |

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

### 1.2 Tra cứu, transform & sparse

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

> **Tránh** sparse / `delete arr[i]`. Key thưa → `Map`.
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

### 2.1 Key equality & thứ tự

| Khía cạnh | Hành vi |
|---|---|
| So sánh key | **SameValueZero** (`===` nhưng `NaN` === `NaN`) |
| Object / function key | Theo **reference**, không deep-equal |
| Thứ tự duyệt | **Insertion order** (ổn định) |
| Key kiểu | Bất kỳ (primitive, object, function…) |

```ts
const objKey = { id: 1 };
const map = new Map<object, string>();
map.set(objKey, "x");
map.get(objKey);      // "x"
map.get({ id: 1 });   // undefined — khác reference

new Map([[NaN, 1]]).get(NaN); // 1
```

### 2.2 Object ↔ Map

```ts
const obj = { a: 1, b: 2 };
const map = new Map(Object.entries(obj));
const back = Object.fromEntries(map);
```

`Object.entries` chỉ lấy enumerable own string keys — không lấy symbol / non-enumerable.

### 2.3 `getOrInsert` / `getOrInsertComputed` (Node 26)

Tránh pattern `if (!m.has(k)) m.set(k, …)`:

```ts
const counts = new Map<string, number>();

counts.getOrInsert("a", 0);  // 0 — insert nếu thiếu
counts.getOrInsert("a", 99); // 0 — đã có, không ghi đè

counts.getOrInsertComputed("b", (key) => key.length); // 1
counts.getOrInsertComputed("b", () => 999);           // 1 — không gọi lại

const wm = new WeakMap<object, string[]>();
const obj = {};
wm.getOrInsert(obj, []);
wm.getOrInsertComputed(obj, () => ["lazy"]);
```

- `getOrInsert(key, defaultValue)` — trả value hiện có hoặc set rồi trả.
- `getOrInsertComputed(key, callback)` — chỉ gọi `callback(key)` khi key **chưa** có (lazy init / cache).

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
- Unique list từ array: `[...new Set(arr)]` — O(n), mất thứ tự trùng.

### 3.1 Set operations (ES2025 / Node hiện đại)

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

Baseline Node 26 có sẵn. Runtime cũ hơn: implement bằng vòng lặp hoặc polyfill.

---

## 4. WeakMap & WeakSet

```ts
const wm = new WeakMap<object, string>();
const ws = new WeakSet<object>();

let obj: object | null = { n: 1 };
wm.set(obj, "meta");
ws.add(obj);

obj = null; // entry có thể được GC — Weak* không giữ object sống
```

### 4.1 So sánh với Map / Set

| | `Map` / `Set` | `WeakMap` / `WeakSet` |
|---|---|---|
| Key | Bất kỳ | **Chỉ object** (không primitive) |
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

`WeakRef` / `FinalizationRegistry` — nâng cao; GC không đảm bảo thời điểm gọi. Prefer WeakMap khi chỉ cần “metadata theo đời object”.

---

## 5. Object vs Map — khi nào dùng gì

| Nhu cầu | Prefer | Lý do |
|---|---|---|
| Record cố định, shape biết trước | plain object / `interface` | JSON-friendly, typed fields |
| Dictionary string key động, JSON | `Record<string, V>` / object | `JSON.stringify` trực tiếp |
| Key không phải string (object, number ổn định…) | `Map` | Object ép key thành string |
| Insertion order + duyệt ổn định | `Map` (hoặc object hiện đại — vẫn Map rõ hơn) | Intent rõ |
| Tránh prototype pollution | `Map` hoặc `Object.create(null)` | `__proto__` / inherited keys |
| Metadata không leak | `WeakMap` | Xem §4 |
| Serialize / config / DTO | object | Map → `Object.fromEntries` trước JSON |

```ts
// Object key bị ép string — dễ bug:
const o: Record<string, number> = {};
o[1] = 10;
o["1"]; // 10

const m = new Map<number, number>();
m.set(1, 10);
m.get(1); // 10 — number key thật
```

> **Rule of thumb:** shape tĩnh / JSON → object. Key động / non-string / cần `.size` / insertion semantics rõ → `Map`.

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
| `Int16Array` / `Uint16Array` | 2 |
| `Int32Array` / `Uint32Array` / `Float32Array` | 4 |
| `Float64Array` / `BigInt64Array` / `BigUint64Array` | 8 |

Dùng khi: binary protocol, crypto, image, WASM, I/O buffer. `DataView` khi cần endian / offset linh hoạt.

### 6.2 Node `Buffer`

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
| `Buffer.allocUnsafe(n)` | nhanh hơn, **có thể chứa dữ liệu cũ** |
| `Buffer.from(...)` | từ string / array / ArrayBuffer |
| `buf.subarray(start, end)` | view (không copy) — Node hiện đại prefer hơn `slice` legacy semantics |

### 6.3 Pitfalls

1. **Aliasing:** nhiều TypedArray trên cùng `ArrayBuffer` ghi đè lẫn nhau.
2. **Endian:** multi-byte cần biết LE/BE — dùng `DataView` hoặc API tường minh.
3. **`allocUnsafe`:** chỉ dùng khi ghi đè toàn bộ trước khi đọc / không lộ ra ngoài.
4. **SharedArrayBuffer / Atomics:** cross-thread — xem [threading.md](threading.md); đừng nhầm với `ArrayBuffer` thường.
5. **Copy vs view:** `subarray` / tạo TypedArray từ buffer khác offset = view; cần độc lập → `Uint8Array.from` / `Buffer.from` / `structuredClone` tùy case.

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
| `Partial` / `Required` / `Readonly` | optional / required / shallow freeze |
| `Pick` / `Omit` / `Record` | subset / bỏ field / dictionary |
| `Exclude` / `Extract` / `NonNullable` | lọc union |
| `ReturnType` / `Parameters` / `Awaited` / `InstanceType` | suy từ hàm / Promise / class |
---

## 8. Generics thực dụng với collections

```ts
function identity<T>(value: T): T {
  return value;
}
class Box<T> {
  constructor(public value: T) {}
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
    m.getOrInsert(keyFn(x), []).push(x);
  }
  return m;
}
```

- Input: prefer `readonly T[]` (chấp nhận mutable lẫn readonly).
- `Map`/`Set` invariant — đừng ép kiểu lung tung.
- `Object.groupBy` / `Map.groupBy` → [iterables-linq.md](iterables-linq.md).
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

Prefill khi biết kích thước: `Array.from({ length: n }, …)` hoặc `new Array(n)` rồi gán — tránh `push` lặp nếu profile cho thấy realloc đáng kể (thường engine đã ổn).

---

## 13. Best practices

1. Input API: `readonly T[]` / `Iterable<T>` khi chỉ duyệt; đừng bắt buộc mutable `T[]`.
2. Prefer `toSorted` / `toReversed` / `toSpliced` / `with` khi cần bất biến.
3. Dictionary key động / non-string → `Map`; DTO/JSON shape tĩnh → object.
4. Metadata theo đời object → `WeakMap` / `WeakSet`, không nhét vào instance nếu muốn tách.
5. Unique + lookup nhanh → `Set`; đừng `includes` trong vòng nóng.
6. Binary I/O → `Uint8Array` / `Buffer`; tránh `allocUnsafe` lộ dữ liệu.
7. Generic: `K extends keyof T`, constraint tối thiểu; tránh `any`.
8. Utility: `Partial`/`Pick`/`Omit`/`Record` cho DTO; shallow — biết giới hạn.
9. Tránh sparse array và O(n²) nested scan.
10. Type-level phức tạp → tách type alias có tên; ultra-advanced → [typesystem.md](typesystem.md).

---

## 14. Checklist

```text
□ Mutating sort/reverse/splice có chủ đích, hoặc dùng toSorted/…
□ Không sparse / delete index trên Array
□ Lookup trong vòng dùng Set/Map, không includes O(n)
□ Object vs Map đã chọn đúng (JSON shape vs key động)
□ Weak* chỉ khi cần weak lifetime; không cần duyệt
□ Buffer: alloc vs allocUnsafe đúng chỗ; hiểu view vs copy
□ API input dùng readonly T[] / Iterable khi phù hợp
□ Generic có constraint tối thiểu; không any “cho nhanh”
□ Partial/Readonly hiểu là shallow
□ JSON Map qua Object.fromEntries / entries
```

---

## 15. Cheat sheet

| Nhu cầu | Cấu trúc |
|---|---|
| Danh sách có thứ tự, index số | `Array` / `readonly T[]` |
| Key tùy ý, insertion order | `Map` |
| Tập unique | `Set` |
| Metadata không leak | `WeakMap` / `WeakSet` |
| Binary / buffer | `TypedArray` / `Buffer` |
| Dictionary string đơn giản | object / `Record<string, V>` |
| Enum runtime + type | `as const` array/object |

```ts
const map = new Map<string, number>();
map.getOrInsertComputed("a", () => 0);

const set = new Set<string>(["a", "b"]);
const uniq = [...new Set(arr)];

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
| ES2022 | `at`, `Object.hasOwn`, … |
| ES2023 | `toSorted`, `toReversed`, `toSpliced`, `with`, `findLast*` |
| ES2024 | `Object.groupBy`, `Map.groupBy` (khi có trên runtime) |
| ES2025 | Set methods: `union`, `intersection`, `difference`, … |
| Node Buffer | `Uint8Array` subclass; `alloc` / `allocUnsafe` |
| Node 26 (baseline) | Set ops + `Map`/`WeakMap` `getOrInsert` / `getOrInsertComputed` |
| TypeScript 7 | generics, conditional, `infer`, mapped, `const` type params |

Baseline repo: **Node 26** + **TS 7** — dùng các API trên thoải mái; thư viện public hỗ trợ Node cũ hơn thì feature-detect hoặc document minimum version.

---

## 17. Tài liệu liên quan

- [Iterator, Iterable & “LINQ-like”](iterables-linq.md) — protocol, generators, helpers, lazy pipelines
- [Hệ thống kiểu dữ liệu](typesystem.md) — type-level nâng cao
- [Hàm & Method](functions-methods.md)
- [Lập trình hướng đối tượng trong TypeScript](oop.md)
- [Lập trình bất đồng bộ](async.md) — `map(async)` + `Promise.all`
- [Worker Threads & Child Process](threading.md) — SharedArrayBuffer / Atomics
- [Node 26 & TypeScript 7 highlights](node26-ts7.md)
