# Tập hợp & Generics trong JavaScript / TypeScript

Tham chiếu thực dụng cho cấu trúc dữ liệu built-in và generics/utility types của TypeScript. Baseline: **ES2024+ / Node 26**, **TS 7**.

---

## Mục lục

1. [Array](#1-array)
2. [Map & Set](#2-map--set)
3. [WeakMap & WeakSet](#3-weakmap--weakset)
4. [TypedArrays (tóm tắt)](#4-typedarrays-tóm-tắt)
5. [Utility types: `Record` / `Partial` / `Pick` / `Omit` / `Readonly`](#5-utility-types-record--partial--pick--omit--readonly)
6. [Generics: constraints, `keyof`](#6-generics-constraints-keyof)
7. [Conditional types & `infer` (overview)](#7-conditional-types--infer-overview)
8. [`ReadonlyArray` & `as const` tuples](#8-readonlyarray--as-const-tuples)
9. [Cheat sheet chọn cấu trúc](#9-cheat-sheet-chọn-cấu-trúc)

---

## 1. Array

```ts
const xs: number[] = [1, 2, 3];
const ys: Array<string> = ["a", "b"];

xs.push(4);
xs.length; // 4
xs.at(-1); // 4 — hỗ trợ index âm
```

### 1.1 Thao tác thường dùng

```ts
const nums = [3, 1, 2];

nums.slice();           // shallow copy
nums.concat([4]);       // mảng mới
nums.includes(1);       // true
nums.indexOf(1);        // 1
nums.find((n) => n > 2);
nums.findIndex((n) => n > 2);
nums.every((n) => n > 0);
nums.some((n) => n > 2);

const sorted = [...nums].sort((a, b) => a - b); // sort in-place — copy trước!
const reversed = [...nums].toReversed();        // bản copy (modern)
const sorted2 = nums.toSorted((a, b) => a - b); // không mutate
```

Mutating vs copying (hiện đại):

| Mutating | Non-mutating (ES2023+) |
|---|---|
| `sort`, `reverse`, `splice` | `toSorted`, `toReversed`, `toSpliced`, `with` |

### 1.2 Hiệu năng & pattern

- Append cuối: amortized O(1); `unshift`/`splice(0,…)` O(n).
- Sparse array (`arr[1000]=1`) — tránh; dùng `Map` nếu key thưa.
- Prefill: `Array.from({ length: n }, (_, i) => i)`.
- Tránh `delete arr[i]` (tạo hole); dùng `splice` hoặc filter tạo mảng mới.

```ts
const matrix = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => 0));
```

### 1.3 Typed arrays of objects

```ts
type User = { id: string; name: string };
const users: User[] = [];
const readonlyUsers: readonly User[] = users;
```

---

## 2. Map & Set

### 2.1 `Map<K, V>`

```ts
const m = new Map<string, number>();
m.set("a", 1);
m.get("a");          // 1
m.has("a");          // true
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

Đặc điểm:

- Key **bất kỳ** (object, function…) — so sánh theo `SameValueZero` (NaN được).
- Thứ tự duyệt: **insertion order**.
- Khác object plain: không prototype pollution; key không bị ép thành string.

```ts
const objKey = { id: 1 };
const map = new Map<object, string>();
map.set(objKey, "x");
map.get(objKey); // "x"
map.get({ id: 1 }); // undefined — khác reference
```

Object ↔ Map:

```ts
const obj = { a: 1, b: 2 };
const map = new Map(Object.entries(obj));
const back = Object.fromEntries(map);
```

### 2.1b `getOrInsert` / `getOrInsertComputed` (Node 26)

Trên **Node 26**, `Map` (và `WeakMap`) có API “get or create” — tránh pattern `if (!m.has(k)) m.set(k, …)`:

```ts
const counts = new Map<string, number>();

counts.getOrInsert("a", 0);           // 0 — insert nếu thiếu
counts.getOrInsert("a", 99);          // 0 — đã có, không ghi đè

counts.getOrInsertComputed("b", (key) => key.length); // 1
counts.getOrInsertComputed("b", () => 999);           // 1 — đã có

// WeakMap tương tự (key object):
const wm = new WeakMap<object, string[]>();
const obj = {};
wm.getOrInsert(obj, []);
wm.getOrInsertComputed(obj, () => ["lazy"]);
```

- `getOrInsert(key, defaultValue)`: trả value hiện có hoặc set `defaultValue` rồi trả.  
- `getOrInsertComputed(key, callback)`: chỉ gọi `callback(key)` khi key **chưa** có — tiện lazy init / cache.

### 2.2 `Set<T>`

```ts
const s = new Set<number>([1, 2, 2, 3]);
s.size; // 3
s.add(4);
s.has(2);
s.delete(2);

// Unique list
const unique = [...new Set(["a", "b", "a"])]; // ["a", "b"]
```

Set operations (ES2025 / có trong Node hiện đại — kiểm tra version nếu cần polyfill):

```ts
const a = new Set([1, 2, 3]);
const b = new Set([3, 4]);

a.union(b);                // 1,2,3,4
a.intersection(b);         // 3
a.difference(b);           // 1,2
a.symmetricDifference(b);  // 1,2,4
a.isSubsetOf(b);
a.isSupersetOf(b);
a.isDisjointFrom(b);
```

Nếu runtime chưa có: implement bằng vòng lặp / thư viện.

---

## 3. WeakMap & WeakSet

```ts
const wm = new WeakMap<object, string>();
const ws = new WeakSet<object>();

let obj: object | null = { n: 1 };
wm.set(obj, "meta");
ws.add(obj);

obj = null; // có thể được GC — entry weak không giữ object sống
```

Đặc điểm:

- Key **chỉ object** (hoặc symbol trong một số weak collection mới — WeakMap key chủ yếu object).
- **Không** iterable, không `.size`, không duyệt được.
- Dùng gắn metadata riêng mà không leak bộ nhớ (DOM node cache, private data side-table).

```ts
type Instance = { /* ... */ };
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

`WeakRef` / `FinalizationRegistry` — nâng cao, dùng thận trọng (GC không đảm bảo thời điểm).

---

## 4. TypedArrays (tóm tắt)

```ts
const buf = new ArrayBuffer(16);
const u8 = new Uint8Array(buf);
const f64 = new Float64Array(buf);

u8[0] = 255;
const view = new DataView(buf);
view.setUint32(0, 0x12345678, true); // littleEndian
```

| Type | Byte / element |
|---|---|
| `Int8Array` / `Uint8Array` / `Uint8ClampedArray` | 1 |
| `Int16Array` / `Uint16Array` | 2 |
| `Int32Array` / `Uint32Array` / `Float32Array` | 4 |
| `Float64Array` / `BigInt64Array` / `BigUint64Array` | 8 |

Dùng khi: binary protocol, crypto, image, WASM, `fs.read` buffer. Node: `Buffer` extends `Uint8Array`.

```ts
import { Buffer } from "node:buffer";

const b = Buffer.from("hello", "utf8");
const u8 = new Uint8Array(b);
```

---

## 5. Utility types: `Record` / `Partial` / `Pick` / `Omit` / `Readonly`

```ts
type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
};
```

### 5.1 `Partial<T>` / `Required<T>`

```ts
type UserPatch = Partial<User>; // tất cả optional — patch API
type StrictUser = Required<User>; // tất cả required
```

### 5.2 `Pick` / `Omit`

```ts
type UserPublic = Pick<User, "id" | "name" | "role">;
type UserWithoutEmail = Omit<User, "email">;
```

### 5.3 `Readonly<T>`

```ts
type FrozenUser = Readonly<User>;
// frozen.name = "x"; // lỗi TS — shallow
```

### 5.4 `Record<K, V>`

```ts
type Role = "admin" | "user" | "guest";
const permissions: Record<Role, string[]> = {
  admin: ["*"],
  user: ["read"],
  guest: [],
};

type Dict = Record<string, number>; // index signature tương đương gần
```

### 5.5 Kết hợp

```ts
type UserCreate = Omit<User, "id">;
type UserUpdate = Partial<Pick<User, "name" | "email" | "role">>;
```

Các utility khác đáng nhớ: `Exclude`, `Extract`, `NonNullable`, `ReturnType`, `Parameters`, `InstanceType`, `Awaited`.

```ts
type R = ReturnType<typeof JSON.parse>; // any (theo lib) — cẩn thận
type P = Parameters<(a: number, b: string) => void>; // [number, string]
type V = Awaited<Promise<number>>; // number
```

---

## 6. Generics: constraints, `keyof`

### 6.1 Generic cơ bản

```ts
function identity<T>(value: T): T {
  return value;
}

class Box<T> {
  constructor(public value: T) {}
}
```

### 6.2 Constraints (`extends`)

```ts
function longer<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}

longer("ab", "c");
longer([1, 2], [3]);
```

### 6.3 `keyof` & indexed access

```ts
type UserKeys = keyof User; // "id" | "name" | "email" | "role"

function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const name = getProp({ id: 1, name: "a" }, "name"); // string
```

### 6.4 Mapped types (overview)

```ts
type OptionalFlags<T> = {
  [K in keyof T]?: boolean;
};

type UserFlags = OptionalFlags<User>;
```

`Readonly`, `Partial`… được implement bằng mapped types trong lib TS.

### 6.5 Generic defaults

```ts
type ApiResponse<T = unknown> = {
  data: T;
  status: number;
};
```

---

## 7. Conditional types & `infer` (overview)

### 7.1 Conditional

```ts
type IsString<T> = T extends string ? true : false;

type A = IsString<"x">; // true
type B = IsString<number>; // false
```

Phân phối trên union (distributive):

```ts
type ToArray<T> = T extends any ? T[] : never;
type T1 = ToArray<string | number>; // string[] | number[]
```

Bọc `[]` để tắt distributive khi cần:

```ts
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;
type T2 = ToArrayNonDist<string | number>; // (string | number)[]
```

### 7.2 `infer`

```ts
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
type E = ElementOf<string[]>; // string

type AwaitedLike<T> = T extends Promise<infer U> ? AwaitedLike<U> : T;
type X = AwaitedLike<Promise<Promise<number>>>; // number

type ReturnOf<T> = T extends (...args: any) => infer R ? R : never;
```

### 7.3 Template & intrinsic (nhắc nhanh)

```ts
type EventName = `on${Capitalize<"click" | "focus">}`; // "onClick" | "onFocus"
```

Dùng có chừng mực — type-level programming nặng làm compile chậm và khó đọc.

---

## 8. `ReadonlyArray` & `as const` tuples

### 8.1 `ReadonlyArray<T>` / `readonly T[]`

```ts
function sum(xs: ReadonlyArray<number>) {
  // xs.push(1); // lỗi
  return xs.reduce((a, b) => a + b, 0);
}

const arr = [1, 2, 3];
sum(arr); // OK — Array tương thích readonly input (variance thực dụng)
```

API nhận input: prefer `readonly T[]` để không mutate nhầm và chấp nhận cả `readonly` lẫn mutable.

### 8.2 Tuple

```ts
type Pair = [string, number];
const p: Pair = ["age", 18];

type OptionalTail = [string, number?];
type Rest = [string, ...number[]];
```

### 8.3 `as const`

```ts
const roles = ["admin", "user", "guest"] as const;
type Role = (typeof roles)[number]; // "admin" | "user" | "guest"

const point = { x: 1, y: 2 } as const;
// point.x = 3; // lỗi — readonly + literal types
```

`as const` làm:

- Infer literal type thay vì widen (`"admin"` thay vì `string`).
- Deep `readonly` cho object/array.

```ts
function createRoute<const T extends string>(path: T) {
  return { path };
}
const r = createRoute("/users"); // path: "/users"
```

(`const` type parameters — TS 5.0+)

### 8.4 Tuple labeled

```ts
type Point3D = [x: number, y: number, z: number];
```

---

## 9. Cheat sheet chọn cấu trúc

| Nhu cầu | Cấu trúc |
|---|---|
| Danh sách có thứ tự, index số | `Array` / `readonly T[]` |
| Key tùy ý, giữ insertion order | `Map` |
| Tập unique | `Set` |
| Metadata không leak | `WeakMap` / `WeakSet` |
| Binary / số học buffer | `TypedArray` / `Buffer` |
| Dictionary string key đơn giản | plain object / `Record<string, V>` |
| Enum runtime + type | `as const` array/object |

**Generics — nên**

- Đặt tên `T`, `TKey`, `TResult` rõ.
- Constraint tối thiểu cần dùng.
- Prefer `K extends keyof T` hơn `string` cho property access.

**Tránh**

- `Map` khi chỉ cần object JSON serialize đơn giản (Map không JSON ra đẹp mặc định).
- Mutate array đang iterate / shared state.
- `any` trong generic “cho nhanh” — dùng `unknown` + thu hẹp.

```ts
const map = new Map<string, number>();
const set = new Set<string>();
type Patch = Partial<Pick<User, "name" | "email">>;
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
const dirs = ["asc", "desc"] as const;
```

---

## Tài liệu liên quan

- [Iterator, Iterable & “LINQ-like”](iterables-linq.md)
- [Lập trình hướng đối tượng trong TypeScript](oop.md)
- [Hệ thống kiểu dữ liệu](typesystem.md)
- [Hàm & Method](functions-methods.md)
