# Hệ thống kiểu dữ liệu (JavaScript runtime & TypeScript)

JavaScript là ngôn ngữ **dynamic** tại runtime (kiểu gắn với *giá trị*). TypeScript thêm lớp **static types** bị xóa khi biên dịch / type-strip — không tồn tại trên V8. Tài liệu này tập trung **TypeScript 7** chạy trên **Node.js 26** (ESM ưu tiên). Mục tiêu: tham chiếu thực dụng, không phải tutorial nhập môn.

> Baseline: **TypeScript 7** (compiler Go) + **Node.js 26** (type stripping ổn định). Node **24** còn Active LTS tại ngày rà soát; lịch chuyển Maintenance ở [README](README.md). TS 7: `strict` mặc định **true**; `moduleResolution: "node"` / `node10` / `classic` → **error**.

---

## Mục lục

- [1. Runtime types (JS) vs static types (TS)](#1-runtime-types-js-vs-static-types-ts)
- [2. Primitive types](#2-primitive-types)
  - [2.1 Bảng `typeof` runtime (đủ cho Node)](#21-bảng-typeof-runtime-đủ-cho-node)
  - [2.2 `number`, NaN, `Object.is`, boxed `Number`](#22-number-nan-objectis-boxed-number)
  - [2.3 `bigint` mixing](#23-bigint-mixing)
  - [2.4 `null` vs `undefined`](#24-null-vs-undefined)
  - [2.5 `symbol` & well-known symbols](#25-symbol--well-known-symbols)
- [3. `object`, functions, arrays](#3-object-functions-arrays)
  - [3.1 `Record` & index signatures](#31-record--index-signatures)
- [4. Tuples](#4-tuples)
- [5. Enums vs const objects / unions](#5-enums-vs-const-objects--unions)
- [6. `any` / `unknown` / `never` / `void`](#6-any--unknown--never--void)
- [7. Union, intersection, literal types](#7-union-intersection-literal-types)
  - [7.1 Discriminated unions](#71-discriminated-unions)
- [8. Type aliases vs interfaces](#8-type-aliases-vs-interfaces)
  - [8.1 Declaration merging](#81-declaration-merging)
  - [8.2 Collision khi merge](#82-collision-khi-merge)
- [9. Narrowing: predicates vs asserts vs `satisfies`](#9-narrowing-predicates-vs-asserts-vs-satisfies)
  - [9.1 Type predicate (`x is T`)](#91-type-predicate-x-is-t)
  - [9.2 Assertion function (`asserts`)](#92-assertion-function-asserts)
  - [9.3 `satisfies` (không hẹp runtime, không predicate)](#93-satisfies-không-hẹp-runtime-không-predicate)
  - [9.4 Bảng quyết định](#94-bảng-quyết-định)
- [10. Generics: constraints, `const` type params, `NoInfer`](#10-generics-constraints-const-type-params-noinfer)
  - [10.1 Constraints, defaults, `keyof`](#101-constraints-defaults-keyof)
  - [10.2 `const` type parameters (TS 5.0+)](#102-const-type-parameters-ts-50)
  - [10.3 `NoInfer<T>` (TS 5.4+)](#103-noinfer-ts-54)
  - [10.4 Variance ngắn](#104-variance-ngắn)
  - [10.5 Instantiation expressions & `import()` types](#105-instantiation-expressions--import-types)
  - [10.6 Recursive types](#106-recursive-types)
- [11. Mapped, conditional, `infer`, template literal types](#11-mapped-conditional-infer-template-literal-types)
  - [11.1 Mapped types & template literal key remapping](#111-mapped-types--template-literal-key-remapping)
  - [11.2 Conditional types & distributive](#112-conditional-types--distributive)
  - [11.3 `infer` trong tuples](#113-infer-trong-tuples)
  - [11.4 Template literal types](#114-template-literal-types)
  - [11.5 TS 7: template inference theo code point](#115-ts-7-template-inference-theo-code-point)
- [12. Structural typing, freshness, branded types](#12-structural-typing-freshness-branded-types)
  - [12.1 Excess property check vs freshness](#121-excess-property-check-vs-freshness)
  - [12.2 Class private → gần nominal](#122-class-private--gần-nominal)
  - [12.3 Branded / nominal patterns + `unique symbol`](#123-branded--nominal-patterns--unique-symbol)
- [13. Variance: methods vs functions](#13-variance-methods-vs-functions)
- [14. Strictness flags & TS 7 defaults](#14-strictness-flags--ts-7-defaults)
  - [TS 7 — defaults cứng](#ts-7--defaults-cứng)
- [15. `satisfies` vs `as const` vs annotation](#15-satisfies-vs-as-const-vs-annotation)
  - [15.1 `as const` không freeze object hay alias](#151-as-const-không-freeze-object-hay-alias)
- [16. Type stripping & `erasableSyntaxOnly`](#16-type-stripping--erasablesyntaxonly)
- [17. Declaration merging, module augmentation, `this` types](#17-declaration-merging-module-augmentation-this-types)
  - [17.1 Ba cơ chế dễ nhầm](#171-ba-cơ-chế-dễ-nhầm)
  - [17.2 Ambient declarations](#172-ambient-declarations)
  - [17.3 `this` parameter, polymorphic `this`, callback](#173-this-parameter-polymorphic-this-callback)
- [18. Assignability / widen / narrow](#18-assignability--widen--narrow)
  - [Widen vs narrow](#widen-vs-narrow)
  - [Bảng gán hay gặp](#bảng-gán-hay-gặp)
  - [18.1 Function assignability: optional, rest, `void`](#181-function-assignability-optional-rest-void)
  - [18.2 Overload assignability (rút)](#182-overload-assignability-rút)
  - [18.3 Optional property vs `| undefined`](#183-optional-property-vs--undefined)
- [19. Worked examples: `typeof` duality](#19-worked-examples-typeof-duality)
  - [19.1 Giá trị vs kiểu](#191-giá-trị-vs-kiểu)
  - [19.2 Narrowing: runtime `typeof` dẫn type `typeof`](#192-narrowing-runtime-typeof-dẫn-type-typeof)
  - [19.3 Bẫy: `typeof null`, boxed, class](#193-bẫy-typeof-null-boxed-class)
  - [19.4 Import type vs typeof module](#194-import-type-vs-typeof-module)
  - [19.5 CFA không xuyên closure](#195-cfa-không-xuyên-closure)
  - [19.6 `in` vs optional vs index signature](#196-in-vs-optional-vs-index-signature)
  - [19.7 Utility types — khi nào dùng](#197-utility-types--khi-nào-dùng)
  - [19.8 Empty types](#198-empty-types)
- [20. Khi nào KHÔNG dùng](#20-khi-nào-không-dùng)
- [21. Best practices](#21-best-practices)
- [22. Checklist](#22-checklist)
- [23. Cheat sheet](#23-cheat-sheet)
- [24. Version matrix](#24-version-matrix)
- [25. Tài liệu liên quan](#25-tài-liệu-liên-quan)

---

## 1. Runtime types (JS) vs static types (TS)

| Tầng | Cơ chế | Ví dụ |
| --- | --- | --- |
| **Runtime (JS)** | `typeof`, prototype, brand checks, `Object.is` | `typeof x === "string"` |
| **Compile-time (TS)** | checker, inference, assignability | `const x: string = ...` |

```ts
let x: string = "hi";
// Sau emit / type strip: chỉ còn  let x = "hi";
```

- TS **không** thêm runtime validation trừ khi bạn tự viết (zod, valibot, type guards, schema).
- `typeof` runtime ≠ `typeof` trong type position (xem [keywords.md](keywords.md), §19).
- Type strip / `tsc` erase annotations — V8 chỉ thấy JS; sai dữ liệu từ JSON/HTTP vẫn qua được nếu không validate.
- Hai “sự thật” song song: **kiểu tĩnh** (checker tin) và **giá trị runtime** (thực tế). Khi lệch → bug khó thấy.

> Quy tắc biên: mọi input ngoài process (HTTP body, env, file, message queue) là `unknown` cho đến khi parse/validate. Xem [exceptions.md](exceptions.md) khi parse fail.

Hai tầng lệch nhau theo những đường điển hình:

| Tình huống | Checker | Runtime |
| --- | --- | --- |
| `JSON.parse` không generic | bạn annotate `Foo` | bất kỳ JSON nào |
| `as Foo` / `!` | tin tưởng | không kiểm |
| Type predicate viết sai | hẹp thành `T` | giá trị khác `T` |
| `erasableSyntaxOnly` + `enum` | lỗi compile | Node strip cũng không emit enum |
| Cross-realm `instanceof` | `Error` | `instanceof` fail — [oop.md](oop.md) |

```ts
type User = { id: string };
const body: User = JSON.parse(raw); // checker hài lòng — runtime có thể { id: 1 }
```

---

## 2. Primitive types

Runtime primitives: `string`, `number`, `bigint`, `boolean`, `symbol`, `undefined`, `null`.

```ts
const s: string = "text";
const n: number = 3.14; // IEEE-754 double (không có int riêng)
const b: bigint = 10n;
const ok: boolean = true;
const sym: symbol = Symbol("id");
const u: undefined = undefined;
const z: null = null;
```

- `number`: mọi số hữu hạn / `NaN` / `±Infinity`; không phân biệt int/float ở cấp kiểu.
- `bigint`: không trộn trực tiếp với `number` (`1n + 1` lỗi runtime **và** TS).
- Wrapper objects (`new String()`) — tránh; `typeof new String()` là `"object"`.
- `symbol` luôn unique (trừ `Symbol.for`); hay dùng làm brand / key ẩn.

### 2.1 Bảng `typeof` runtime (đủ cho Node)

`typeof` luôn trả **một trong 8 chuỗi**: `"undefined"` | `"boolean"` | `"number"` | `"bigint"` | `"string"` | `"symbol"` | `"object"` | `"function"`. Không có `"null"`, `"array"`, `"class"`.

| Biểu thức | `typeof` | Ghi chú |
| --- | --- | --- |
| `"hi"` | `"string"` | |
| `42` / `NaN` / `Infinity` / `-0` | `"number"` | `NaN` vẫn `"number"` |
| `10n` | `"bigint"` | |
| `true` / `false` | `"boolean"` | |
| `undefined` / biến chưa gán | `"undefined"` | |
| `null` | `"object"` | bug lịch sử — không sửa được |
| `{}` / `[]` / `new Date()` | `"object"` | phân biệt bằng `Array.isArray` / brand |
| `/re/` / `new Map()` / `new Set()` | `"object"` | |
| `Promise.resolve(1)` | `"object"` | thenable, không phải `"function"` |
| `() => {}` / `function f() {}` | `"function"` | hàm cũng là object ở runtime |
| `async function () {}` | `"function"` | |
| `function* () {}` | `"function"` | |
| `class C {}` | `"function"` | constructor |
| `Symbol()` / `Symbol.iterator` | `"symbol"` | |
| `new String("a")` / `Object("a")` | `"object"` | boxed primitive |
| `new Number(1)` / `new Number(NaN)` | `"object"` | boxed; `NaN` boxed vẫn object |
| `new Boolean(false)` | `"object"` | truthy! (object luôn truthy) |
| `new Proxy(fn, {})` | `"function"` | theo target callable |
| `new Proxy({}, {})` | `"object"` | |
| `import("node:fs")` (giá trị Promise) | `"object"` | dynamic import trả Promise |

```ts
function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isCallable(x: unknown): x is (...args: never[]) => unknown {
  return typeof x === "function";
}
```

- Type guard dựa `typeof` phải xử lý `null` và mảng tường minh.
- `typeof` trong **type position** (`typeof value`) lấy kiểu của giá trị/biến — khác toán tử runtime. Xem §19.
- `typeof` không ném với undeclared binding trong sloppy mode; ESM luôn strict — undeclared → `ReferenceError`.
- Không dùng `typeof x === "array"` — không bao giờ đúng.

> `typeof null === "object"` là bất biến web. Guard object: `x !== null && typeof x === "object"`.

### 2.2 `number`, NaN, `Object.is`, boxed `Number`

```ts
Number.isNaN(NaN); // true
NaN === NaN; // false
Object.is(NaN, NaN); // true
Object.is(+0, -0); // false  (=== thì true)
```

| So sánh | `===` (strict equality) | `Object.is` (SameValue) | `==` (loose) | `Number.isNaN` |
| --- | --- | --- | --- | --- |
| `NaN` vs `NaN` | `false` | `true` | `false` | `true` trên từng bên |
| `+0` vs `-0` | `true` | `false` | `true` | — |
| `"1"` vs `1` | `false` | `false` | `true` | — |
| `1n` vs `1` | `false` | `false` | `true` | — |
| `Object(NaN)` vs `NaN` | `false` | `false` | `true` (unbox) | `Number.isNaN` **false** (không unbox) |

Thuật toán:

| API | Spec | Dùng khi |
| --- | --- | --- |
| `===` / `!==` | Strict Equality (`+0 === -0`, `NaN !== NaN`) | gần như mọi so sánh app |
| `Object.is` | SameValue (`+0` ≠ `-0`, `NaN` = `NaN`) | Map/Set-like, detect `-0`, polyfill `SameValue` |
| `Object.isExtensible` unrelated | — | đừng nhầm với `Object.is` |
| SameValueZero | `Object.is` nhưng `+0` = `-0` | `Map`/`Set`/`includes` keys |

```ts
const boxed = new Number(NaN);
typeof boxed;                 // "object"
boxed === NaN;                // false
Number.isNaN(boxed);          // false — không ép Object → primitive
Number.isNaN(Number(boxed));  // true
isNaN(boxed);                 // true — global isNaN ép ToNumber
Object.is(boxed.valueOf(), NaN); // true

Boolean(new Boolean(false));  // true  ← boxed Boolean luôn truthy
```

- `isNaN("x")` (global) ép kiểu → `true` — **đừng dùng**; dùng `Number.isNaN`.
- `parseInt("08")` / float parse: luôn kiểm tra `Number.isFinite` khi cần số hợp lệ.
- Map/Set key bằng `number`: `NaN` được coi **cùng một key** (SameValueZero), khác `===`.
- `+0` và `-0` là **cùng key** trong Map/Set/`Array.includes`; `Object.is` mới tách được.
- `new Number(3)` không gán vào `number` dưới `strict` theo nghĩa hữu ích: TS có `Number` (wrapper) ≠ `number` (primitive).

```ts
const p: number = 1;
const w: Number = new Number(1);
// const bad: number = w; // lỗi — wrapper ≠ primitive
```

> Tiền tệ / số thập phân chính xác: không dùng `number` thô — dùng integer cents, `bigint`, hoặc thư viện decimal. `0.1 + 0.2 !== 0.3`.

```ts
function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
```

### 2.3 `bigint` mixing

```ts
const a = 10n;
// a + 1;           // TypeError runtime; TS lỗi
// a * 1.5;         // TypeError
Number(a) + 1;      // 11 — mất precision nếu bigint > Number.MAX_SAFE_INTEGER
BigInt(10) + 1n;    // 11n
// BigInt(1.5);     // RangeError
1n === 1;           // false
1n == 1;            // true (loose) — tránh
```

| Thao tác | Kết quả |
| --- | --- |
| `bigint` `+`/`-`/`*`/`%`/`**` `number` | **TypeError** |
| So sánh `<` `>` giữa `bigint` và `number` | được, theo toán học |
| `===` giữa hai kiểu | luôn `false` |
| Mix trong typed array | `BigInt64Array` ≠ `Float64Array` |
| `JSON.stringify(1n)` | **TypeError** (không serialize mặc định) |
| TS kiểu `bigint` gán vào `number` | lỗi |

```ts
function asSafeInt(n: bigint): number {
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError("bigint outside MAX_SAFE_INTEGER");
  }
  return Number(n);
}
```

- TS không có implicit conversion; annotate tường minh `bigint` vs `number`.
- Literal: `10n` → kiểu `10n` (bigint literal) khi `const`; `let x = 10n` → `bigint`.
- **Khi nào KHÔNG dùng `bigint`:** timestamp ms, JSON API, tọa độ UI, mọi chỗ serialize mặc định / trộn IEEE-754.

### 2.4 `null` vs `undefined`

| | `undefined` | `null` |
| --- | --- | --- |
| Ý nghĩa thường gặp | “chưa có / thiếu” | “cố ý trống” |
| Biến chưa gán | `undefined` | — |
| Prop thiếu trên object | `undefined` khi đọc | — |
| JSON | thường bị omit | serialize thành `null` |
| `typeof` | `"undefined"` | `"object"` |
| Default param `f(x = 1)` | trigger khi `undefined` | **không** trigger với `null` |
| `??` / `?.` | cả hai là nullish | cả hai là nullish |
| `||` | cả hai falsy | cả hai falsy — đừng dùng thay `??` |

```ts
function f(x: number | null | undefined = 1) {
  return x;
}
f(); // 1
f(undefined); // 1
f(null); // null  ← không thay bằng default
```

- Với `strictNullChecks` (nằm trong `strict`): `null` / `undefined` không gán vào `T` trừ khi union tường minh.
- `exactOptionalPropertyTypes`: phân biệt `{ x?: number }` (thiếu key) vs `{ x: number | undefined }` — xem §14.
- `void 0` là `undefined` an toàn lịch sử; ESM không cần.

### 2.5 `symbol` & well-known symbols

```ts
const a = Symbol("id");
const b = Symbol("id");
a === b; // false

const g1 = Symbol.for("app.id");
const g2 = Symbol.for("app.id");
g1 === g2; // true — registry toàn cục
Symbol.keyFor(g1); // "app.id"
Symbol.keyFor(a);  // undefined (không đăng ký)
```

| Well-known | Vai trò |
| --- | --- |
| `Symbol.iterator` | `for...of`, spread iterable |
| `Symbol.asyncIterator` | `for await...of` |
| `Symbol.toStringTag` | `Object.prototype.toString` → `[object Xxx]` |
| `Symbol.hasInstance` | tùy biến `instanceof` — [oop.md](oop.md) |
| `Symbol.toPrimitive` | hint `"number"` / `"string"` / `"default"` |
| `Symbol.species` | constructor cho bản copy (`Array.map`, `RegExp`) |
| `Symbol.isConcatSpreadable` | `concat` có trải phần tử không |
| `Symbol.match` / `matchAll` / `replace` / `search` / `split` | hook string |
| `Symbol.unscopables` | `with` (cấm ESM) |
| `Symbol.dispose` / `Symbol.asyncDispose` | `using` / `await using` — [statements.md](statements.md) |
| `Symbol.metadata` | decorator metadata (Stage 3) — [decorators.md](decorators.md) |

```ts
class Box {
  [Symbol.toStringTag] = "Box";
  *[Symbol.iterator]() {
    yield 1;
    yield 2;
  }
}
Object.prototype.toString.call(new Box()); // "[object Box]"
[...new Box()]; // [1, 2]
```

- Key symbol **không** đi vào `JSON.stringify`, `Object.keys`, `for...in` — hữu ích cho brand ẩn.
- `unique symbol` (TS): kiểu nominal cho từng `const` / `declare const` symbol — nền tảng branded types (§12.3).
- **Khi nào KHÔNG dùng symbol key:** API JSON, config file, mọi chỗ cần enumerate / serialize.

---

## 3. `object`, functions, arrays

```ts
const o: object = { a: 1 }; // non-primitive (ít dùng; ưu tiên shape cụ thể)
const f: (x: number) => number = (x) => x * 2;
const arr: number[] = [1, 2, 3];
const arr2: Array<string> = ["a"];
const ro: ReadonlyArray<number> = [1, 2];
```

- Mọi non-primitive là object ở runtime (kể cả hàm, mảng, `Date`).
- Kiểu `object` / `{}` quá rộng — hầu như luôn nên mô tả shape cụ thể hoặc `Record<...>`.
- `{}` trong TS nghĩa là “mọi giá trị trừ `null`/`undefined`” (kể cả số!) nếu không bật vài cờ chặt — tránh dùng làm “object rỗng”.
- Array là object; kiểu phần tử chỉ tồn tại ở TS. `ReadonlyArray<T>` / `readonly T[]` cấm `push` ở cấp kiểu.

```ts
const empty: {} = 42;      // OK — 42 gán được vào {}
const obj: object = 42;    // lỗi — primitive không gán vào object
const obj2: object = [];   // OK
```

Function type:

```ts
type Mapper = (x: number) => string;
type Handler = { (event: Event): void; name: string }; // call signature + props
```

- Tham số hàm **contravariant** theo mặc định với `strictFunctionTypes` (method params có ngoại lệ lịch sử bivariant — §13).
- Optional param `f(x?: number)` ≈ `f(x: number | undefined)` về gọi, nhưng khác declaration emit / excess args.
- Call signature trên object type (method vs property function) khác variance — đừng nhầm.

### 3.1 `Record` & index signatures

```ts
type Dict = Record<string, unknown>;
type MapLike = { [key: string]: number };
type Strict = Record<"a" | "b", number>; // { a: number; b: number }
```

| Dạng | Khi dùng | Bẫy |
| --- | --- | --- |
| `Record<K, V>` | map key hữu hạn / string key đồng nhất | `Record<string, V>` cho phép mọi string key |
| Index signature | object mở, JSON-like | mọi prop đã khai phải khớp `V` |
| Mapped type | biến đổi khóa có kiểm soát | xem §11 |

```ts
interface Bag {
  [key: string]: number;
  // count: string; // lỗi: phải gán được vào number
  size: number; // OK
}
```

- Với `noUncheckedIndexedAccess`: `dict[key]` thành `V | undefined` — phản ánh runtime.
- `symbol` / number keys: index signature `string` cũng bắt number keys (ép `number → string`); dùng mapped/`Record` khi cần chính xác hơn.
- `Record<string, V>` **không** mô tả “object có toString riêng”: mọi key string, kể cả `"toString"`, phải là `V`.

```ts
type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };
```

---

## 4. Tuples

```ts
type Pair = [string, number];
const p: Pair = ["age", 30];

type Opt = [string, number?];
type Rest = [string, ...number[]];
type Labeled = [id: string, qty: number];
type ReadonlyTuple = readonly [number, number];
type Variadic = [...string[], number]; // phần tử cuối cố định
```

- Tuple ≠ mảng mở: độ dài / vị trí có nghĩa; `Pair` không gán thoải mái cho `string[]` theo hai chiều.
- Label (`id: string`) chỉ là documentation cho destructure / hover — không tạo nominal type.
- `readonly [T, U]` ngăn mutate phần tử; `as const` trên literal array → tuple readonly hẹp (xem §15).
- Variadic tuple + generics: nền tảng cho kiểu `zip`, `concat`, infer rest params.

```ts
function head<T extends unknown[]>(tuple: [...T]): T[0] {
  return tuple[0];
}
const h = head(["a", 1] as const); // "a"
```

- Optional element `T?` khác `T | undefined` ở giữa tuple cố định — vị trí optional thường ở cuối.
- Destructure giữ kiểu vị trí: `const [a, b]: Pair = p` → `a: string`, `b: number`.

Open vs closed:

| | Tuple `[string, number]` | Array `(string \| number)[]` |
| --- | --- | --- |
| Độ dài | cố định (hoặc rest) | mở |
| `push` | TS hạn chế trên tuple cố định | OK |
| Gán sang array | thường ✓ (mất length) | — |
| Array → tuple | ✗ | |

`infer` trong tuple: xem §11.3.

---

## 5. Enums vs const objects / unions

```ts
enum Direction {
  Up,
  Down,
  Left,
  Right,
}

const enum Compact {
  A = 1,
  B = 2,
}

type Status = "idle" | "running" | "done"; // thường Prefer union hơn enum
```

| Cách | Runtime | Type-strip Node 26 | Ghi chú |
| --- | --- | --- | --- |
| Numeric / string `enum` | object (+ reverse map numeric) | **Không** erasable | Cần `tsc`/bundler |
| `const enum` | inline giá trị | **Không** erasable / nguy hiểm với isolated | Tránh với ESM strip |
| Union literal | không | OK | Đơn giản, tree-shake tốt |
| `as const` object + typeof | object thật | OK | Có runtime map & type |

```ts
const Direction = {
  Up: "Up",
  Down: "Down",
} as const;
type Direction = (typeof Direction)[keyof typeof Direction]; // "Up" | "Down"
```

- Numeric enum có reverse mapping (`Direction[0] === "Up"`); string enum thì không.
- `erasableSyntaxOnly` (khuyến nghị với Node strip): `enum` / `const enum` → lỗi biên dịch.
- Publish library ESM: union / const object dễ consume hơn enum (tránh dual emit CJS quirks).
- Numeric enum là **cả** `number` lẫn tên — `Direction.Up` gán được vào `number`; ngược lại `0 as Direction` cũng lách được. String enum chặt hơn.

```ts
enum Mix {
  A = 1,
  B = "b",
} // heterogenous — tránh
```

> Node 26 đã gỡ `--experimental-transform-types` — không còn “biến enum thành JS lúc chạy”. Chọn cú pháp erasable hoặc build trước.

**Khi nào KHÔNG dùng enum:** mọi codebase `node file.ts` / `erasableSyntaxOnly`; lib ESM public; khi union 3–10 literal đủ.

---

## 6. `any` / `unknown` / `never` / `void`

| Kiểu | Ý nghĩa | Khi dùng |
| --- | --- | --- |
| `any` | Tắt kiểm tra | Escape hatch — hạn chế tuyệt đối |
| `unknown` | An toàn: phải hẹp trước khi dùng | Input bên ngoài, JSON |
| `never` | Không bao giờ xảy ra | Exhaustiveness, throw, dead branch |
| `void` | “không quan tâm giá trị trả” | Callback, hàm side-effect |

```ts
function parse(json: string): unknown {
  return JSON.parse(json);
}

function assertNever(x: never): never {
  throw new Error(`Unexpected: ${String(x)}`);
}

function log(msg: string): void {
  console.log(msg);
}
```

**Assignability (rút gọn):**

| Từ ↓ / Đến → | `any` | `unknown` | `never` | `void` | `string` |
| --- | --- | --- | --- | --- | --- |
| `any` | ✓ | ✓ | ✓* | ✓ | ✓ |
| `unknown` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `never` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `void` | ✓ | ✓ | ✗ | ✓ | ✗ |
| `string` | ✓ | ✓ | ✗ | ✗** | ✓ |

\*Gán vào `never` từ `any` được checker cho phép nhưng vô nghĩa — đừng dựa vào.  
\*\*`void` đặc biệt: hàm trả `string` có thể gán cho `() => void` (caller bỏ qua return); ngược lại không gán `void` vào chỗ cần `string`.

- Gán `any` lan truyền độc; `unknown` buộc narrowing.
- `never` là subtype của mọi kiểu (bottom); intersection mâu thuẫn → `never`.
- `void` không phải “không có giá trị” tuyệt đối ở runtime — hàm vẫn có thể `return` gì đó; **caller không nên dùng**.
- `undefined` gán được vào `void` trong nhiều vị trí; `null` thì không (với `strictNullChecks`).

```ts
type Fail = string & number; // never

function loop(): never {
  throw new Error("no");
}
```

**Khi nào KHÔNG dùng `any`:** input I/O (dùng `unknown`); generic “cho tiện” (`T` + constraint); `as any` để tắt excess property (dùng `satisfies` hoặc biến trung gian có chủ đích).

**Khi nào KHÔNG dùng `never` làm giá trị trả thực tế:** API có thể thành công — `never` chỉ cho throw / infinite loop / exhaustive default.

---

## 7. Union, intersection, literal types

```ts
type Id = string | number;
type A = { a: number };
type B = { b: string };
type AB = A & B; // { a: number; b: string }

type Direction = "N" | "S" | "E" | "W";
type Dice = 1 | 2 | 3 | 4 | 5 | 6;
type Flag = true; // literal boolean
```

- Union: giá trị thuộc **một** nhánh; dùng narrowing trước khi truy cập field riêng.
- Intersection: phải thỏa **mọi** thành phần (primitive mâu thuẫn → `never`: `string & number`).
- Literal types hẹp hơn base (`"N"` gán được vào `string`, ngược lại không).
- Union lớn + property access: chỉ thấy member **chung**; member riêng cần discriminant / guard.

```ts
type Ok = { ok: true; value: string };
type Err = { ok: false; error: string };
type Result = Ok | Err;
// Result["value"] → lỗi — không chung cả hai nhánh
```

Intersection object: property cùng tên → intersection kiểu (mâu thuẫn → `never` cho property đó).

```ts
type Clash = { x: string } & { x: number }; // { x: never }
```

### 7.1 Discriminated unions

```ts
type Result =
  | { ok: true; value: string }
  | { ok: false; error: Error };

function unwrap(r: Result): string {
  if (r.ok) return r.value;
  throw r.error;
}

function handle(r: Result): string {
  switch (r.ok) {
    case true:
      return r.value;
    case false:
      return r.error.message;
    default:
      return assertNever(r);
  }
}
```

- Discriminant nên là literal (`"success" | "failure"`, `true | false`) — ổn định, so sánh `===`.
- Tránh optional discriminant (`kind?: "a"`) — dễ phá narrowing.
- Pattern thay class hierarchy cho dữ liệu bất biến / message / state machine — [oop.md](oop.md).

**Khi nào KHÔNG dùng union khổng lồ:** 50+ variant không discriminant; lúc đó schema runtime (zod) + `unknown` hơn type-level nổ tổ hợp.

---

## 8. Type aliases vs interfaces

```ts
type Point = { x: number; y: number };
interface PointI {
  x: number;
  y: number;
}

type Sum = (a: number, b: number) => number;
type Id = string | number; // chỉ type alias làm được union
```

| | `interface` | `type` |
| --- | --- | --- |
| Object shape | ✓ | ✓ |
| Union / tuple / mapped / conditional | hạn chế | ✓ mạnh |
| Declaration merging | ✓ | ✗ |
| `extends` | ✓ | dùng `&` intersection |
| `implements` | ✓ | ✓ (object type) |

- Lib DOM/Node/`@types/*` thường dùng `interface` để merge.
- App code hiện đại: `type` linh hoạt; `interface` khi cần extend/merge công khai API.
- Không có khác biệt runtime — cả hai erase.

### 8.1 Declaration merging

```ts
interface User {
  id: string;
}
interface User {
  name: string;
}
// User = { id: string; name: string }
```

- Merge cùng tên trong cùng scope — hữu ích cho augmentation (§17), nguy hiểm nếu merge nhầm file.
- `type` **không** merge: khai báo lại → lỗi duplicate.
- Interface có thể merge với namespace cùng tên (pattern class + namespace legacy) — tránh với `erasableSyntaxOnly`.

### 8.2 Collision khi merge

| Tình huống | Kết quả |
| --- | --- |
| Cùng prop, cùng kiểu | OK, gộp |
| Cùng prop, kiểu khác (`string` vs `number`) | **lỗi** conflict |
| Function members | overload list (thứ tự merge = thứ tự file/load) |
| `interface` + `class` cùng tên | instance side của class gộp với interface — [oop.md](oop.md) |
| Hai `type` cùng tên | duplicate identifier |
| Module augmentation đụng lib | merge vào interface lib; conflict → lỗi checker |

```ts
interface Cfg {
  port: number;
}
interface Cfg {
  // port: string; // lỗi: subsequent property declarations must have the same type
  host: string;
}
```

Thứ tự overload sau merge **khó đoán** giữa nhiều file — đừng dựa vào thứ tự overload từ merge vô tình. Prefer một declaration nguồn.

Chi tiết augmentation vs merging: §17.

---

## 9. Narrowing: predicates vs asserts vs `satisfies`

**Narrowing tự động**: `typeof`, `===` / `!==`, `in`, `instanceof`, truthiness, discriminated union, control-flow analysis, assignment.

```ts
function len(x: string | string[]) {
  if (typeof x === "string") return x.length;
  return x.length; // string[]
}

function hasId(x: object): x is { id: string } {
  return "id" in x && typeof (x as { id: unknown }).id === "string";
}
```

### 9.1 Type predicate (`x is T`)

```ts
function isString(x: unknown): x is string {
  return typeof x === "string";
}

function pick(x: unknown) {
  if (isString(x)) x.toUpperCase(); // hẹp ở nhánh true
  // x vẫn unknown ở đây
}
```

- Guard trả `boolean` + `x is T`.
- Sai guard = lỗ hổng an toàn kiểu — viết chặt, test biên.
- Predicate **không** throw; nhánh false không khẳng định “không phải T” trừ khi checker chứng minh (thường vẫn union).

```ts
function isCat(x: Animal): x is Cat {
  return x.kind === "cat";
}
```

### 9.2 Assertion function (`asserts`)

```ts
function assert(cond: unknown, msg?: string): asserts cond {
  if (!cond) throw new Error(msg ?? "Assertion failed");
}

function assertString(x: unknown): asserts x is string {
  if (typeof x !== "string") throw new Error("not string");
}

function demo(x: unknown) {
  assertString(x);
  x.toUpperCase(); // string — sau lời gọi, không cần if
}
```

- `asserts cond` hẹp truthiness của `cond`; `asserts x is T` hẹp `x`.
- Thường `void` về giá trị trả; **phải throw** khi sai — nếu return im lặng, checker vẫn tin.
- Dùng cho invariant / programmer error — [exceptions.md](exceptions.md).

### 9.3 `satisfies` (không hẹp runtime, không predicate)

`satisfies` **không** tạo type guard, **không** emit JS, **không** hẹp biến đã có. Nó kiểm tra biểu thức khớp bound mà **giữ** kiểu suy luận. Chi tiết đối chiếu §15.

```ts
const cfg = { port: 3000 } satisfies { port: number };
```

### 9.4 Bảng quyết định

| Cơ chế | Runtime | Ảnh hưởng checker | Khi dùng |
| --- | --- | --- | --- |
| `typeof` / `in` / `instanceof` | có | hẹp trong nhánh | narrowing tự nhiên |
| `x is T` | `boolean` | hẹp nếu `true` | parse/validate trả boolean |
| `asserts x is T` | throw hoặc qua | hẹp **sau** call | invariant, “từ đây chắc chắn T” |
| `as T` | không | ép — có thể nói dối | escape có chủ đích, sau validate |
| `satisfies T` | không | check, **không** đổi sang `T` | literal/config giữ hẹp |
| `!` (non-null) | không | bỏ `null`/`undefined` | chỉ khi chắc |

- Narrowing **không** xuyên qua callback khác closure nếu biến bị gán lại (aliasing); dùng `const` hoặc copy local.
- `switch` + `assertNever` trong `default` bắt thiếu case khi thêm variant.
- `this is T` predicate trên method: hẹp `this` (hiếm, class hierarchy).

```ts
class Response {
  header(name: string) {
    return "";
  }
  isJson(): this is Response & { json(): unknown } {
    return this.header("content-type").includes("json");
  }
}
```

> Predicate/assert sai còn tệ hơn `any`: checker *tắt cảnh báo đúng*. Test guard bằng giá trị biên (`null`, boxed, array).

**Khi nào KHÔNG dùng assertion function:** luồng nghiệp vụ thường xuyên (validation user) — trả Result/union thay vì throw. **Khi nào KHÔNG dùng `as`:** thay `satisfies` hoặc annotate. **Khi nào KHÔNG dùng predicate:** khi bạn không trả boolean thật (đừng `return true` cố định).

---

## 10. Generics: constraints, `const` type params, `NoInfer`

```ts
function identity<T>(value: T): T {
  return value;
}

type ApiResponse<T> = { data: T; status: number };

interface Repo<T extends { id: string }> {
  get(id: string): Promise<T | undefined>;
}
```

- Type parameter là **compile-time**; erase hoàn toàn — không `typeof T` runtime.
- Ưu tiên suy luận từ đối số; chỉ annotate khi inference rộng quá / sai.
- Generic hàm vs generic type: `function f<T>(...)` / `type F<T> = ...` / `interface I<T>`.

### 10.1 Constraints, defaults, `keyof`

```ts
function pluck<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

type Box<T = string> = { value: T };
// Box ≡ Box<string>

type Keys = keyof { a: 1; b: "x" }; // "a" | "b"
type Prop = { a: 1; b: "x" }["b"]; // "x"
```

- `T extends U`: `T` phải gán được vào `U`.
- `keyof T` với index signature → `string | number` (và có thể `symbol`) — kết hợp `noUncheckedIndexedAccess`.
- `T[keyof T]` = union mọi value type — hay dùng lấy “value union” từ const object.
- Default type param: chỉ các tham số bên phải mới được default (giống optional params).

```ts
type AwaitedOwn<T> = T extends Promise<infer U> ? U : T;
// Stdlib: Awaited<T> xử lý đệ quy / thenable sâu hơn
```

### 10.2 `const` type parameters (TS 5.0+)

Mặc định, generic inference **widen** literal. `const T` bảo inference giữ literal / tuple readonly như `as const`.

```ts
function titles<T extends string[]>(xs: T): T {
  return xs;
}
titles(["a", "b"]); // string[]

function titlesConst<const T extends readonly string[]>(xs: T): T {
  return xs;
}
titlesConst(["a", "b"]); // readonly ["a", "b"]
```

```ts
function route<const P extends string>(path: P): P {
  return path;
}
const r = route("/users/:id"); // "/users/:id", không phải string
```

| | Inference thường | `const` type param |
| --- | --- | --- |
| `["a", "b"]` | `string[]` | `readonly ["a", "b"]` |
| `{ status: "ok" }` | `{ status: string }` | `{ readonly status: "ok" }` |
| Caller vẫn `as const` | được | thường không cần |

- `const` trên type param ≠ `const` assertion trên giá trị, nhưng cùng mục tiêu: chống widen.
- Kết hợp constraint `extends readonly ...[]` để cấm mutate đầu vào kiểu.

**Khi nào KHÔNG dùng `const T`:** hàm thật sự cần `string` rộng (lưu DB, concat tự do); API muốn chấp nhận bất kỳ `string` không chỉ literal.

### 10.3 `NoInfer<T>` (TS 5.4+)

Chặn một vị trí tham gia **suy luận**. Các đối số khác suy `T`; vị trí `NoInfer<T>` chỉ **kiểm tra** khớp.

```ts
function pair<T>(primary: T, secondary: NoInfer<T>): [T, T] {
  return [primary, secondary];
}

pair("a", "a");       // T = "a"
pair("a", "b");       // lỗi — "b" không gán vào "a"
pair<string>("a", "b"); // OK nếu annotate T = string
```

Pattern hay gặp: default / fallback không được “kéo” `T` thành union rộng.

```ts
declare function setConfig<T>(
  actual: T,
  fallback: NoInfer<T>,
): T;

setConfig({ port: 3000 as const }, { port: 3000 });
// không để fallback suy T = { port: number }
```

Trước `NoInfer`, người ta dùng `T & {}` hack hoặc tách hàm — đừng dùng hack nếu TS ≥ 5.4.

**Khi nào KHÔNG dùng `NoInfer`:** một tham số duy nhất (không có gì để “cạnh tranh” inference); API muốn union từ mọi đối số (`Promise.all` style).

### 10.4 Variance ngắn

| Vị trí | Hướng | Ví dụ |
| --- | --- | --- |
| Output / property đọc | covariant | `() => Animal` nhận `() => Dog` |
| Input param (strictFunctionTypes) | contravariant | `(a: Dog) => void` **không** nhận `(a: Animal) => void` |
| Mutable prop | invariant thực dụng | `Box<Animal>` ≠ `Box<Dog>` khi ghi |

```ts
type Producer<out T> = () => T; // out/in modifiers (TS 4.7+) — chủ yếu cho type params phức tạp
type Consumer<in T> = (value: T) => void;
```

- Arrays mutable: `Dog[]` không gán an toàn cho `Animal[]` nếu ghi (TS vẫn cho trong vài trường hợp lịch sử — ưu tiên `readonly T[]` khi chỉ đọc).
- Chi tiết collections: [collections-generics.md](collections-generics.md). Method vs function property: §13.

### 10.5 Instantiation expressions & `import()` types

```ts
class Box<T> {
  constructor(public value: T) {}
}
const StringBox = Box<string>; // instantiation expression — giá trị constructor đã gắn T
new StringBox("ok");

type Fs = typeof import("node:fs/promises");
type ReadFile = Fs["readFile"];
```

- `Box<string>` ở **value position** (TS 4.7+) tạo constructor chuyên biệt mà không `new`.
- `import("mod").X` lấy kiểu từ module mà không import runtime — khác `import type` (cần specifier ổn định).
- `typeof import("node:fs")` hữu ích khi viết wrapper / mock.

### 10.6 Recursive types

```ts
type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

type Linked<T> = { value: T; next: Linked<T> | null };

type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? T[K] extends (...args: never[]) => unknown
      ? T[K]
      : DeepReadonly<T[K]>
    : T[K];
};
```

- Interface có thể tự tham chiếu trực tiếp; `type` alias cũng được nếu gián tiếp (qua object/array).
- `type T = T[]` trực tiếp → lỗi circular; `type T = { x: T }` OK.
- Độ sâu đệ quy conditional bị giới hạn (khoảng 50+ tùy phiên bản) — đừng parse HTML bằng type.

```ts
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
type Depth = 5; // chặn đệ quy cố ý
```

**Khi nào KHÔNG đệ quy type:** transform runtime data (dùng hàm); schema JSON Schema phức tạp (dùng lib).

---

## 11. Mapped, conditional, `infer`, template literal types

Các công cụ **type-level** — không phát sinh runtime. Nền tảng utility types (`Partial`, `Pick`, `Omit`, `Readonly`, …).

### 11.1 Mapped types & template literal key remapping

```ts
type ReadonlyDeepish<T> = {
  readonly [K in keyof T]: T[K];
};

type Optional<T> = {
  [K in keyof T]?: T[K];
};

type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};
```

- `in keyof T` lặp key; `as` (key remapping) đổi / lọc key (`as never` để bỏ).
- Modifier `readonly` / `?` thêm hoặc bỏ bằng `-readonly` / `-?`:

```ts
type Mutable<T> = {
  -readonly [K in keyof T]-?: T[K];
};
```

Key remapping — đổi tên, lọc prefix, bỏ key:

```ts
type EventMap = {
  click: MouseEvent;
  focus: FocusEvent;
  id: string;
};

type Handlers = {
  [K in keyof EventMap as K extends "id"
    ? never
    : `on${Capitalize<K & string>}`]: (e: EventMap[K]) => void;
};
// { onClick: (e: MouseEvent) => void; onFocus: (e: FocusEvent) => void }

type OnlyOn<T> = {
  [K in keyof T as K extends `on${string}` ? K : never]: T[K];
};

type GettersOf<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};
```

```ts
type Snake<S extends string> = S extends `${infer H}${infer T}`
  ? T extends Uncapitalize<T>
    ? `${Lowercase<H>}${Snake<T>}`
    : `${Lowercase<H>}_${Snake<Uncapitalize<T>>}`
  : S;
// minh họa — union lớn + đệ quy string dễ chậm checker
```

- Utility chuẩn: `Partial<T>`, `Required<T>`, `Readonly<T>`, `Pick<T, K>`, `Omit<T, K>`, `Record<K, V>`, `Exclude`, `Extract`, `NonNullable`.
- `string & K` vì `keyof` có thể `string | number | symbol`; `Capitalize` chỉ nhận `string`.

> Đừng remap mọi key REST API bằng template types nếu union path hàng trăm literal — checker chậm, thông báo khó đọc.

### 11.2 Conditional types & distributive

```ts
type IsString<T> = T extends string ? true : false;

type ElementOf<T> = T extends readonly (infer E)[] ? E : never;

type ReturnOf<T> = T extends (...args: never[]) => infer R ? R : never;

type Unwrap<T> = T extends Promise<infer U>
  ? Unwrap<U>
  : T extends { data: infer D }
    ? D
    : T;
```

- Phân phối (distributive) trên **naked** type param: `T extends X ? A : B` khi `T` = union → áp từng thành viên.

```ts
type Dist<T> = T extends string ? T : never;
type R = Dist<"a" | 1>; // "a"  (1 bị loại)

// Tắt distributive: bọc tuple
type NoDist<T> = [T] extends [string] ? T : never;
type R2 = NoDist<"a" | 1>; // never
```

Distributive vs không — bảng:

| `T` | `T extends any ? T[] : never` | `[T] extends [any] ? T[] : never` |
| --- | --- | --- |
| `"a" \| "b"` | `"a"[] \| "b"[]` | `("a" \| "b")[]` |
| `string \| number` | `string[] \| number[]` | `(string \| number)[]` |

```ts
type ToArray<T> = T extends unknown ? T[] : never;
type A = ToArray<string | number>; // string[] | number[]

type ToArrayOnce<T> = [T] extends [unknown] ? T[] : never;
type B = ToArrayOnce<string | number>; // (string | number)[]
```

- `never` phân phối thành “không nhánh” — `Dist<never>` → `never`.
- `T extends any` / `T extends unknown` đều phân phối khi `T` naked.
- `infer` chỉ trong nhánh `extends` của conditional — đặt tên biến kiểu tại vị trí cần bắt.
- Thứ tự nhánh quan trọng; đặt case hẹp trước khi case rộng.
- Vòng đệ quy type quá sâu → lỗi compiler; giới hạn độ sâu có chủ đích.

```ts
type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;
// ("a" | "b") → không phải lúc nào cũng làm được ngược; pattern này cho object unions
```

**Khi nào KHÔNG bật distributive:** khi bạn muốn union đi **nguyên khối** (một mảng hỗn hợp, một Promise all). Bọc `[T]`.

### 11.3 `infer` trong tuples

```ts
type Head<T> = T extends readonly [infer H, ...unknown[]] ? H : never;
type Tail<T> = T extends readonly [unknown, ...infer R] ? R : never;
type Last<T> = T extends readonly [...unknown[], infer L] ? L : never;
type Init<T> = T extends readonly [...infer I, unknown] ? I : never;

type H = Head<["a", 1, true]>; // "a"
type T = Tail<["a", 1, true]>; // [1, true]
type L = Last<["a", 1, true]>; // true
```

Variadic + optional:

```ts
type Params<F> = F extends (...args: infer P) => unknown ? P : never;

type DropOptional<T extends unknown[]> = T extends [...infer R, infer L?]
  ? L extends undefined
    ? DropOptional<R>
    : T
  : T;

type Cons<H, T extends unknown[]> = [H, ...T];
type Concat<A extends unknown[], B extends unknown[]> = [...A, ...B];
```

```ts
function zip<A extends unknown[], B extends unknown[]>(
  a: [...A],
  b: [...B],
): { [K in keyof A]: [A[K], K extends keyof B ? B[K] : never] } {
  return a.map((x, i) => [x, b[i]]) as never;
}
```

- `infer R` ở rest position bắt **tuple còn lại**, không phải array mở, nếu input là tuple.
- `T['length']` trên tuple là số literal; trên array là `number`.
- Pattern `Parameters<F>` / `ReturnType<F>` / `ConstructorParameters<C>` là stdlib dựa `infer`.

### 11.4 Template literal types

```ts
type EventName = "click" | "focus";
type Handler = `on${Capitalize<EventName>}`; // "onClick" | "onFocus"

type Path = `/api/${string}`;
type ExtractId<S> = S extends `user:${infer Id}` ? Id : never;
type Id = ExtractId<"user:42">; // "42"
```

- Intrinsic string modifiers: `Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize`.
- Kết hợp union → phân phối trên từng literal (bùng nổ tổ hợp — giữ union nhỏ).
- Pattern: typed routes, CSS-in-JS keys, event maps, parse chuỗi có cấu trúc ở type-level.

```ts
type Split<S extends string, D extends string> = S extends `${infer A}${D}${infer B}`
  ? [A, ...Split<B, D>]
  : [S];

type Parts = Split<"a.b.c", ".">; // ["a", "b", "c"]
```

> Đừng thay schema runtime bằng template types: chúng chỉ kiểm tra chuỗi **đã biết lúc compile**. `string` rộng (`req.url`) không hẹp thành `` `/users/${string}` `` nếu không parse.

### 11.5 TS 7: template inference theo code point

TS 7 tách `infer` từng ký tự của template literal theo Unicode code point, thay vì UTF-16 code unit như compiler cũ:

```ts
type HeadTail<S extends string> = S extends `${infer H}${infer T}` ? [H, T] : never;
type Example = HeadTail<"😀abc">; // TS 7: ["😀", "abc"]
```

Runtime `"😀".length` vẫn là 2 và indexing vẫn theo code unit. Code point chưa phải grapheme (emoji ghép/dấu kết hợp); generic parser cần type test khi nâng compiler. [TS 7 changes](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

---

## 12. Structural typing, freshness, branded types

TypeScript dùng **structural** (duck typing tĩnh), không nominal theo mặc định:

```ts
type P = { x: number; y: number };
const q = { x: 1, y: 2, z: 3 };
const p: P = q; // OK — có đủ x, y
```

- Hai kiểu “trùng shape” là tương thích dù tên khác nhau.
- Khác Go/Java named types: `type UserId = string` **không** tạo brand — vẫn là `string`.

### 12.1 Excess property check vs freshness

```ts
type P = { x: number; y: number };

const p1: P = { x: 1, y: 2, z: 3 }; // lỗi — literal thừa z
const tmp = { x: 1, y: 2, z: 3 };
const p2: P = tmp; // OK — qua biến trung gian (mất freshness)
```

**Freshness:** object literal ở vị trí “trực tiếp” (gán annotate, return, argument) bị TS coi là *fresh* → excess property check. Qua biến, freshness mất → chỉ còn structural (“có đủ field bắt buộc”).

| Vị trí | Fresh? | Excess check |
| --- | --- | --- |
| `const p: T = { ... }` | ✓ | có |
| `f({ extra: 1 })` với `f(x: T)` | ✓ | có |
| `return { extra: 1 }` kiểu trả `T` | ✓ | có |
| `const tmp = { extra }; use(tmp)` | ✗ | không (open) |
| Spread `const p: T = { ...tmp }` | một phần | field thừa từ literal còn lại vẫn bắt |
| `as T` | bỏ check | assertion |

```ts
function take(p: P) {
  return p.x + p.y;
}
take({ x: 1, y: 2, z: 3 }); // lỗi fresh
const v = { x: 1, y: 2, z: 3 };
take(v); // OK

const p3: P = { x: 1, y: 2, ...{ z: 3 } }; // vẫn excess trên z nếu checker thấy
```

Weak types (mọi prop optional): gán object không chồng key nào → lỗi, kể cả không fresh — chống `{}` gán nhầm.

```ts
type Opts = { debug?: boolean; verbose?: boolean };
const o: Opts = { debuug: true }; // excess + typo
```

- Escape có chủ đích: type assertion, hoặc rest destructure khi cố ý bỏ field thừa.
- Nested literal: excess check đi xuống object con nếu vị trí fresh.

**Khi nào KHÔNG tin excess check:** dữ liệu đã qua biến / JSON / map. Đó không phải validation runtime.

### 12.2 Class private → gần nominal

```ts
class A {
  private id = 1;
}
class B {
  private id = 1;
}
// const x: A = new B(); // lỗi — private identity khác
```

Object literal không gán vào class có `private`/`protected`. `#private` runtime còn mạnh hơn — [oop.md](oop.md).

### 12.3 Branded / nominal patterns + `unique symbol`

```ts
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

function asUserId(raw: string): UserId {
  return raw as UserId; // validate trước khi brand
}

function loadUser(id: UserId) {
  /* ... */
}

const oid = "o1" as OrderId;
// loadUser(oid); // lỗi — không gán OrderId vào UserId
```

String brand (`__brand: "UserId"`) **có thể đụng** nếu hai lib dùng cùng tag. `unique symbol` không đụng:

```ts
declare const UserIdBrand: unique symbol;
declare const OrderIdBrand: unique symbol;

type UserId = string & { readonly [UserIdBrand]: void };
type OrderId = string & { readonly [OrderIdBrand]: void };

function UserId(raw: string): UserId {
  if (!raw) throw new Error("empty id");
  return raw as UserId;
}
```

```ts
const k: unique symbol = Symbol("k");
type Box = { readonly [k]: true };
```

| Brand | Collision | Runtime | Ghi chú |
| --- | --- | --- | --- |
| `string & { __brand: "UserId" }` | tag trùng tên | vẫn `string` | đơn giản |
| `unique symbol` field | không | vẫn `string` | khuyến nghị lib |
| `class UserId { private brand }` | nominal-ish | object | JSON khó |
| `#brand` field | runtime brand check | object | [oop.md](oop.md) |

- Brand chỉ tồn tại ở hệ thống kiểu — runtime vẫn là `string`/`number` trừ khi dùng class/`#field`.
- Validate ở biên rồi brand; đừng `as UserId` trên mọi string lung tung.
- `unique symbol` phải là `const` hoặc `declare const` — `let s: unique symbol` không hợp lệ.

**Khi nào KHÔNG brand:** `string` thuần đủ (log line, HTML); brand mọi thứ → ma sát API, `as` tràn.

---

## 13. Variance: methods vs functions

Với `strictFunctionTypes` (trong `strict`): **function type** so sánh param **contravariant**; **method** trong object type / class vẫn **bivariant** (lịch sử DOM/event).

```ts
class Animal {
  move() {}
}
class Dog extends Animal {
  bark() {}
}

type Fn = (a: Animal) => void;
const takeDog: (d: Dog) => void = (d) => d.bark();
// const f: Fn = takeDog; // lỗi — Animal có thể không phải Dog

type Meth = { handler(a: Animal): void };
const m: Meth = {
  handler(d: Dog) {
    d.bark(); // checker CHO PHÉP (bivariant method) — runtime có thể nổ
  },
};
```

Function property (không method shorthand) theo `strictFunctionTypes`:

```ts
type Prop = { handler: (a: Animal) => void };
const p: Prop = {
  handler: takeDog, // lỗi — giống function type
};
```

| Khai báo | Variance param (`strictFunctionTypes`) |
| --- | --- |
| `(x: T) => void` | contravariant |
| `{ f(x: T): void }` method | **bivariant** |
| `{ f: (x: T) => void }` property | contravariant |
| Class method | bivariant (giống method) |
| Callback trong interface DOM-style | thường method → lỏng |

```ts
interface Listener {
  (this: HTMLElement, ev: Event): void;
}
```

Quyết định:

| Nhu cầu | Chọn |
| --- | --- |
| Callback an toàn (không gọi với base khi handler cần subclass) | function property / type `(x: T) => R` |
| Override class / DOM-like | method — chấp nhận bivariance |
| Event emitter typed | function property + generic `T` |

`in` / `out` trên type parameter:

```ts
interface Producer<out T> {
  get(): T;
}
interface Consumer<in T> {
  set(value: T): void;
}
interface Box<in out T> {
  get(): T;
  set(value: T): void;
}
```

- `out T` (covariant): chỉ xuất hiện ở vị trí đọc.
- `in T` (contravariant): chỉ vị trí ghi/param.
- Vi phạm vị trí → lỗi checker — dùng để bắt sớm API generic phức tạp.
- Chi tiết list/readonly: [collections-generics.md](collections-generics.md). Callback: [functions-callbacks.md](functions-callbacks.md).

> Prefer **function property** khi thiết kế port/callback. Method bivariant là lỗ hổng có chủ đích cho OOP DOM, không phải “an toàn hơn”.

**Khi nào KHÔNG dùng method shorthand trên interface callback:** public API library, chỗ `Dog`-handler không được nhận `Animal`.

---

## 14. Strictness flags & TS 7 defaults

Bật `"strict": true` (TS 7: **mặc định true**) gồm nhiều cờ con; vẫn nên biết từng lá.

| Flag | Ý nghĩa ngắn |
| --- | --- |
| `strictNullChecks` | `null`/`undefined` không thuộc mọi kiểu |
| `strictFunctionTypes` | so sánh function params chặt (contravariant) |
| `strictBindCallApply` | `bind`/`call`/`apply` có kiểu đúng |
| `strictPropertyInitialization` | field class phải gán |
| `noImplicitAny` | cấm any ngầm |
| `noImplicitThis` | `this` phải có kiểu |
| `alwaysStrict` | emit `"use strict"` (kém liên quan ESM) |
| `useUnknownInCatchVariables` | `catch (e)` → `unknown` |
| `noUncheckedIndexedAccess` | `obj[key]` thêm `\| undefined` (**không** trong `strict`) |
| `exactOptionalPropertyTypes` | thiếu prop ≠ `undefined` tường minh |
| `verbatimModuleSyntax` | import/export giữ nguyên; bắt `import type` |
| `erasableSyntaxOnly` | cấm cú pháp không erasable (enum, namespace runtime, param props, …) |
| `noImplicitOverride` | bắt `override` — [oop.md](oop.md) |

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2024",
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "rewriteRelativeImportExtensions": true
  }
}
```

### TS 7 — defaults cứng

| Mục | TS 7 |
| --- | --- |
| `strict` | mặc định **true** |
| `moduleResolution: "node"` / `node10` / `classic` | **error** — dùng `NodeNext` / `bundler` |
| `target: es5` (và vài target cũ) | **error** — Node 26: `ES2024` / `ESNext` |
| Compiler | Go; ngữ nghĩa ~ TS 6 |

- `skipLibCheck`: tăng tốc CI; vẫn type-check code mình.
- `verbatimModuleSyntax` + Node strip: thiếu `type` trên type-only import → runtime trỏ export không tồn tại.
- `exactOptionalPropertyTypes`: `{ x?: number }` không nhận `{ x: undefined }` trừ khi `x?: number | undefined`.

```ts
function f(opts: { timeout?: number }) {
  const t = opts.timeout ?? 1000;
}
f({ timeout: undefined }); // lỗi nếu exactOptionalPropertyTypes
f({}); // OK — thiếu key
```

> Chi tiết tsconfig: [tsconfig.md](tsconfig.md). Tooling: [tooling.md](tooling.md).

---

## 15. `satisfies` vs `as const` vs annotation

`as const`: hẹp literal, deep readonly.

```ts
const routes = {
  home: "/",
  user: "/users/:id",
} as const;
// typeof routes.home === "/"
// typeof routes → { readonly home: "/"; readonly user: "/users/:id" }
```

`satisfies`: kiểm tra gán được vào kiểu mà **giữ** kiểu hẹp suy luận (không widen như annotation).

```ts
type Config = Record<string, string | number>;

const cfg = {
  port: 3000,
  host: "localhost",
} satisfies Config;
// cfg.port là number; không bị thay thành toàn bộ union string | number

const bad = {
  port: 3000,
  host: true,
} satisfies Config; // lỗi: boolean không khớp
```

| Cách | Kiểm tra shape | Giữ literal | Readonly sâu | Nói dối checker |
| --- | --- | --- | --- | --- |
| `const x: Config = {...}` | ✓ | ✗ (widen) | ✗ | ✗ |
| `const x = {...} as Config` | ✗ | tùy | ✗ | **có** |
| `const x = {...} satisfies Config` | ✓ | tùy contextual type | ✗ | ✗ |
| `{...} as const` | ✗ (không bound) | ✓ | ✓ | ✗ |
| `as const satisfies Config` | ✓ | ✓ | ✓ | ✗ |

Worked:

```ts
type Theme = { primary: string; radius: number };

const t1: Theme = { primary: "#00f", radius: 4 };
t1.primary; // string — mất "#00f"

const t2 = { primary: "#00f", radius: 4 } as Theme;
t2.primary; // string
// Assertion vẫn bị từ chối nếu hai kiểu không đủ giao nhau:
// const t2lie = { primary: 1, radius: 4 } as Theme; // lỗi

const t3 = { primary: "#00f", radius: 4 } satisfies Theme;
t3.primary; // string — property mutable vẫn widen

const t4 = { primary: "#00f", radius: 4 } as const satisfies Theme;
t4.radius; // 4
// t4.radius = 8; // lỗi readonly
```

- `as Config` có thể che sai lệch mà checker cho phép; `satisfies` kiểm tra assignability và giữ kiểu của biểu thức sau contextual typing. Dùng `as const satisfies Config` khi cần literal và readonly. [TS 4.9](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator).
- Pattern mạnh: bảng route, theme token, enum-like maps, openAPI path constants.
- `satisfies` trên hàm: `(x) satisfies (n: number) => string` hiếm — thường annotate.

**Khi nào KHÔNG dùng `as const`:** object cần mutate; mảng cần `push`. **Khi nào KHÔNG dùng annotation `T`:** bảng literal cần key hẹp (dùng `satisfies`). **Khi nào KHÔNG dùng `as T`:** gần như luôn — trừ sau validate / brand.

### 15.1 `as const` không freeze object hay alias

```ts
const mutable: number[] = [1];
const wrapped = { values: mutable } as const;
mutable.push(2);          // vẫn hợp lệ
wrapped.values.push(3);   // reference vẫn là number[], không readonly tuple
// wrapped.values = [];  // lỗi: property readonly
```

Const assertion giữ literal/readonly của literal expression, không biến toàn bộ object graph đã tồn tại thành immutable. `Readonly<T>` cũng shallow; `Object.freeze` chỉ freeze object trực tiếp ở runtime. Dữ liệu ngoài process cần validation, không dùng `satisfies` làm validator. [TS const assertions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions).

---

## 16. Type stripping & `erasableSyntaxOnly`

```bash
node src/app.ts   # Node 26: strip types ổn định, không type-check
```

| | Hành vi |
| --- | --- |
| Làm gì | Xóa annotation / type-only syntax → JS chạy trên V8 |
| Không làm | Type-check, path alias `tsconfig`, downlevel cú pháp JS mới |
| Cờ cũ | `--experimental-transform-types` **đã gỡ** trên Node 26 |

**Erasable (OK với strip + `erasableSyntaxOnly`):**

- Type annotations, `type` / `interface`, generics erasable
- `satisfies`, `as` / `as const` (assertion)
- `import type` / `export type` / modifier `type` trên named import
- `override`, `implements`, `abstract` (xóa, class còn lại)
- `public`/`private`/`protected` trên field **tường minh** (modifier xóa, field còn)
- `readonly` (xóa)

**Không erasable (cần `tsc` / bundler / `tsx`; `erasableSyntaxOnly` báo lỗi):**

- `enum` / `const enum`
- `namespace` / `module` có runtime code
- Parameter properties (`constructor(private x: string)`)
- `import =` / `export =`

Decorators là trường hợp riêng: `erasableSyntaxOnly` không chặn `@dec`, nhưng **Node 26 không parse decorator** và không transform chúng. Cần pipeline emit; xem [decorators.md](decorators.md).

```ts
// OK strip
export type Id = string;
export function greet(name: string): string {
  return `hi ${name}`;
}

class C {
  private x: number; // OK — field tường minh
  constructor(x: number) {
    this.x = x;
  }
}

// Phải tránh nếu chạy bằng node file.ts
// enum Kind { A, B }
// namespace N { export const x = 1 }
// class C { constructor(private x: number) {} }
```

| Cú pháp | `erasableSyntaxOnly` | Node 26 `node file.ts` |
| --- | --- | --- |
| `type` / `interface` | ✓ | strip |
| `enum` | ✗ | **không** transform |
| `constructor(private x: T)` | ✗ | còn `private` là syntax lỗi JS |
| `namespace A { export const x = 1 }` | ✗ | không phải JS |
| `import type` | ✓ | xóa |
| Stage 3 decorator | cho phép | parser error; cần `tsc` emit — [decorators.md](decorators.md) |

- Production phổ biến: `tsc` emit + `node dist/...`; CI luôn `tsc --noEmit`.
- Dev strip cần cú pháp erasable và phần JS còn lại được parser Node hỗ trợ; `erasableSyntaxOnly` không kiểm hết giới hạn runtime, nhất là decorator.
- Node **bỏ qua** `tsconfig.json` khi chạy — `paths` / JSX transform không có phép màu.

> `erasableSyntaxOnly` là lưới **compiler**; Node strip là lưới **runtime**. Bật cả hai. Chi tiết: [tsconfig.md](tsconfig.md).

---

## 17. Declaration merging, module augmentation, `this` types

### 17.1 Ba cơ chế dễ nhầm

| Cơ chế | Cú pháp | Merge gì | Collision |
| --- | --- | --- | --- |
| Interface merging | nhiều `interface Foo` | members | prop khác kiểu → lỗi |
| Module augmentation | `declare module "pkg" { … }` | merge vào module đó | sai tên module → ambient mới / miss |
| Global augmentation | `declare global { … }` | global | pollute global; cần `export {}` |
| Class + interface | `class Foo` + `interface Foo` | instance type | runtime không có member interface |
| Class + namespace | `class Foo` + `namespace Foo` | static side | **không** erasable nếu namespace có giá trị |
| Type alias | `type Foo =` | **không** merge | duplicate |

```ts
// types/express-augment.d.ts
declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}
export {}; // đảm bảo file là module
```

```ts
declare global {
  interface Error {
    code?: string;
  }
}
export {};
```

- Augment đúng tên module (subpath) mà lib export type — [modules-packages.md](modules-packages.md).
- File `.d.ts` cần `export {}` nếu không có import/export — tránh thành global script vô tình.
- Augmentation **merge** interface; không thay thế type alias của lib. Lib dùng `type Request = …` → bạn **không** merge được; phải wrap.
- Hai package cùng augment `Request.user` khác kiểu → conflict. App nên augment **một** chỗ (types nội bộ).

```ts
// Lib:
export type Handler = (req: { id: string }) => void;
// Không merge được Handler; tạo:
export type AppHandler = (req: { id: string; userId?: string }) => void;
```

### 17.2 Ambient declarations

```ts
declare const VERSION: string;
declare function asset(path: string): string;

declare module "*.css" {
  const classes: Record<string, string>;
  export default classes;
}
```

- Ambient mô tả giá trị **tồn tại ở runtime** do bundler / global inject — TS không tạo chúng.
- Tránh `declare` che giấu thiếu dependency thật.

### 17.3 `this` parameter, polymorphic `this`, callback

```ts
function say(this: { name: string }, greeting: string) {
  return `${greeting}, ${this.name}`;
}

class Builder {
  setName(this: this, name: string): this {
    return this;
  }
}
```

- `this` giả ở tham số đầu: chỉ kiểm tra lúc gọi với call/apply/method; erase khi emit.
- `this: this` (polymorphic) giữ subtype khi fluent API / inheritance — [oop.md](oop.md), [functions-methods.md](functions-methods.md).
- `noImplicitThis`: callback DOM/`function()` cũ hay lỗi — chuyển arrow hoặc annotate `this`.

```ts
type ThisHandler = (this: { id: string }, n: number) => void;

const obj = {
  id: "1",
  handle: function (this: { id: string }, n: number) {
    return this.id + n;
  },
};

const detached = obj.handle;
// detached(1); // TS lỗi nếu this bắt buộc; runtime this sai

detached.call(obj, 1); // OK
```

Arrow **không** có `this` parameter — lexical `this`. Gán arrow vào chỗ cần `this` đặc biệt có thể lệch.

```ts
interface Clickable {
  onClick(this: this, ev: unknown): void;
}
```

| Tình huống | `this` |
| --- | --- |
| Method prototype | receiver lúc gọi |
| Arrow field | lexical instance |
| `function` callback rời | `undefined` (strict / ESM) |
| `this: T` annotate | checker bắt `call`/`apply` đúng `T` |

> Callback mất `this` là bug runtime phổ biến; kiểu `this` chỉ giúp nếu callback type **khai** `this`. Chi tiết: [functions-methods.md](functions-methods.md), [functions-callbacks.md](functions-callbacks.md).

---

## 18. Assignability / widen / narrow

### Widen vs narrow

| Hiện tượng | Ví dụ | Kết quả |
| --- | --- | --- |
| Literal widen (mutable `let`) | `let x = "a"` | `string` |
| Giữ literal (`const`) | `const x = "a"` | `"a"` |
| Context sensitive | `const c: "a" \| "b" = "a"` | `"a"` gán vào union |
| `as const` | `{ a: "x" } as const` | deep readonly literal |
| Narrow control-flow | `if (typeof x === "string")` | `x` là `string` trong nhánh |
| Assertion | `x as string` | ép — **không** hẹp runtime |
| `const` type param | `f("a")` với `<const T>` | `"a"` |

```ts
let w = "hello"; // string (widened)
const c = "hello"; // "hello"
const arr = [1, 2]; // number[]
const tup = [1, 2] as const; // readonly [1, 2]
```

### Bảng gán hay gặp

| Cặp | Gán trực tiếp? | Ghi chú |
| --- | --- | --- |
| `"a"` → `string` | ✓ | literal → base |
| `string` → `"a"` | ✗ | cần narrow / assert |
| `Dog` → `Animal` (structural) | ✓ nếu shape khớp | không cần `extends` runtime |
| `Animal` → `Dog` | ✗ | thiếu field / hẹp hơn |
| `T` → `T \| U` | ✓ | |
| `T \| U` → `T` | ✗ | cần narrow |
| `T` → `unknown` | ✓ | |
| `unknown` → `T` | ✗ | narrow / assert |
| `T` → `any` | ✓ | |
| `any` → `T` | ✓ | tắt an toàn |
| `never` → `T` | ✓ | bottom |
| `T[]` → `readonly T[]` | ✓ | |
| `readonly T[]` → `T[]` | ✗ | |
| `[string, number]` → `string[]` | ✓ (một chiều thường) | mất độ dài cố định |
| object literal thừa prop → `T` | ✗ | excess / freshness |
| biến cùng shape thừa prop → `T` | ✓ | open assignability |
| `() => string` → `() => void` | ✓ | đặc hiệu `void` |
| `(x: string) => void` → `(x: "a") => void` | ✓ (strict) | param contravariant: đích hẹp hơn → nguồn nhận rộng hơn OK |
| `(x: Animal) => void` → `(x: Dog) => void` | ✓ | handler Animal nhận được Dog |
| `(x: Dog) => void` → `(x: Animal) => void` | ✗ function / ✓ method bivariant | §13 |
| `UserId` branded → `string` | ✓ (thường) | brand là intersection |
| `string` → `UserId` | ✗ | cần factory / assert |

> Nhớ: **assignable ≠ identical ≠ “cùng ý nghĩa domain”**. Brand khi cần tách `UserId` / `OrderId`.

### 18.1 Function assignability: optional, rest, `void`

```ts
type NeedTwo = (a: number, b: number) => void;
const one = (a: number) => {};
const two: NeedTwo = one; // OK — JS bỏ qua extra args; TS cho source ít param hơn

type NeedOne = (a: number) => void;
const maybe = (a: number, b?: number) => {};
const ok1: NeedOne = maybe; // OK

const rest = (...xs: number[]) => {};
const ok2: NeedTwo = rest; // OK — rest nhận 2 số
```

| Nguồn → đích | Thường |
| --- | --- |
| Ít param bắt buộc hơn | ✓ (extra args bị bỏ) |
| Nhiều param bắt buộc hơn | ✗ |
| Optional thêm ở nguồn | ✓ |
| Rest vs tuple params | structural trên từng vị trí |
| Return `string` → `void` | ✓ (đặc hiệu) |
| Return `void` → `string` | ✗ |
| Return `undefined` → `void` | ✓ |
| `Promise<void>` vs `void` | không thay thế nhau |

```ts
async function save(): Promise<void> {}
const cb: () => void = save; // OK kiểu (trả Promise bị bỏ) — **floating promise** nếu gọi như sync
```

> Gán `async` vào `() => void` là bẫy: checker cho phép, runtime trả Promise bị bỏ → [exceptions.md](exceptions.md) / `@typescript-eslint/no-floating-promises`.

### 18.2 Overload assignability (rút)

Hàm overload: **mọi** signature nguồn phải khớp đích theo từng call — thực dụng: đừng gán overload phức tạp vào một function type duy nhất; wrap.

```ts
function f(x: string): number;
function f(x: number): string;
function f(x: string | number): string | number {
  return typeof x === "string" ? x.length : String(x);
}
const g: (x: string | number) => string | number = f; // có thể lỗi — overload ≠ union implementation
```

Implementation signature **không** visible với caller — chỉ overload list. Chi tiết: [functions-methods.md](functions-methods.md).

### 18.3 Optional property vs `| undefined`

```ts
type A = { x?: number };
type B = { x: number | undefined };

const a: A = {};
// const b: B = {}; // lỗi — thiếu x
const b: B = { x: undefined };

// với exactOptionalPropertyTypes:
// const a2: A = { x: undefined }; // lỗi
```

`Partial<T>` dùng `?` — không phải “mọi field `T | undefined`” khi bật `exactOptionalPropertyTypes`.

---

## 19. Worked examples: `typeof` duality

Cùng chữ `typeof` — hai vũ trụ.

### 19.1 Giá trị vs kiểu

```ts
const user = { id: "u1", n: 1 as const };

typeof user;          // runtime: "object"
type User = typeof user; // { id: string; n: 1 }

typeof user.id;       // "string"
type Id = typeof user.id; // string

const fn = (x: number) => x;
typeof fn;            // "function"
type Fn = typeof fn;  // (x: number) => number
```

```ts
class Service {
  static version = 1;
  ping() {
    return "ok" as const;
  }
}

typeof Service;              // runtime: "function"
type SCtor = typeof Service; // typeof class (constructor + static)
type SInst = Service;        // instance
type SInst2 = InstanceType<typeof Service>; // instance
```

`typeof` **type position** cần giá trị trong scope (variable, function, class). Không `typeof T` khi `T` chỉ là type parameter / type alias — dùng `T` trực tiếp.

```ts
function f<T>(x: T) {
  // type R = typeof T; // lỗi
  type R = T;
  return x;
}
```

### 19.2 Narrowing: runtime `typeof` dẫn type `typeof`

```ts
function format(x: string | number) {
  if (typeof x === "string") {
    type N = typeof x; // string
    return x.toUpperCase();
  }
  type N = typeof x; // number
  return x.toFixed(1);
}
```

### 19.3 Bẫy: `typeof null`, boxed, class

```ts
function dump(x: unknown) {
  if (typeof x === "object") {
    // x: object | null
    if (x === null) return "null";
    return Object.keys(x);
  }
  if (typeof x === "function") {
    return x.name;
  }
  return typeof x;
}

dump(new String("a")); // keys của wrapper — không phải "string"
dump(String);          // "function" (built-in constructor)
```

```ts
const EnumLike = { A: "A", B: "B" } as const;
type EnumLike = (typeof EnumLike)[keyof typeof EnumLike];
// runtime typeof EnumLike === "object"
// type EnumLike === "A" | "B"  (nhờ merging type/value cùng tên)
```

### 19.4 Import type vs typeof module

```ts
import { readFile } from "node:fs/promises";
type ReadFile = typeof readFile; // kiểu hàm

import type { Dirent } from "node:fs";
// typeof Dirent  — Dirent là type-only, không có giá trị runtime
```

Với `verbatimModuleSyntax`, `import { type Dirent }` / `import type` không còn binding runtime.

### 19.5 CFA không xuyên closure

```ts
function handle(x: string | undefined) {
  if (!x) return;
  const later = () => x.toUpperCase(); // OK — x không reassign

  let y = x;
  fetch("/").then(() => {
    y.toUpperCase(); // vẫn string nếu y không gán lại
  });
}

function handleMut(x: string | number) {
  if (typeof x === "string") {
    setTimeout(() => {
      // x.toUpperCase(); // lỗi nếu x bị coi có thể gán lại
    }, 0);
  }
  x = 1; // assignment sau → checker thận trọng với closure
}
```

Copy `const s = x` sau narrow rồi capture `s`.

### 19.6 `in` vs optional vs index signature

```ts
function f(x: { a?: number } | { b: string }) {
  if ("a" in x) {
    x.a; // number | undefined — `in` true không bỏ optional
  }
}

function g(x: Record<string, number>) {
  if ("a" in x) {
    x.a; // number | undefined với noUncheckedIndexedAccess
  }
}
```

`in` kiểm tra prototype chain runtime — ` "toString" in {}` là `true`. Guard JSON: `Object.hasOwn` / `Object.hasOwn(x, "a")`.

```ts
function hasOwn<K extends PropertyKey>(
  o: object,
  k: K,
): o is Record<K, unknown> {
  return Object.hasOwn(o, k);
}
```

### 19.7 Utility types — khi nào dùng

| Utility | Việc | Bẫy |
| --- | --- | --- |
| `Partial<T>` | mọi field optional | sâu một tầng |
| `Required<T>` | bỏ `?` | không bỏ `| undefined` trong value |
| `Readonly<T>` | một tầng | mutate nested vẫn được |
| `Pick<T, K>` | chọn key | `K` phải ⊆ `keyof T` |
| `Omit<T, K>` | bỏ key | union `T` phân phối khác trực giác |
| `Exclude<U, E>` / `Extract<U, E>` | lọc union | dựa assignability |
| `NonNullable<T>` | bỏ `null` \| `undefined` | không bỏ `void` theo cách giống |
| `Parameters<F>` / `ReturnType<F>` | từ function type | overload → last signature (thường) |
| `ConstructorParameters<C>` / `InstanceType<C>` | từ constructor | `typeof Class` |
| `Awaited<T>` | unwrap Promise đệ quy | thenable lạ có thể lệch |
| `Record<K, V>` | map keys | `string` key quá rộng |
| `ThisParameterType<F>` / `OmitThisParameter<F>` | `this` giả | arrow không có this param |

```ts
type T0 = Omit<{ a: 1 } | { b: 2 }, "a">;
// T0 = {}: keyof union không có key chung, built-in Omit không phân phối.
```

`Pick` / `Omit` built-in trên union không tự phân phối: chỉ giữ các key chung từ `keyof (A | B)`. Muốn giữ từng nhánh, dùng conditional type với naked type parameter: `type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never`.

### 19.8 Empty types

| Kiểu | Nhận gì |
| --- | --- |
| `{}` | mọi thứ trừ `null`/`undefined` (kể cả `1`, `"a"`) |
| `object` | non-primitive |
| `Record<string, never>` | object không có string keys hữu ích — gần “rỗng” |
| `Record<PropertyKey, never>` | chặt hơn |
| `[]` / `never[]` | mảng không phần tử / không push hữu ích |
| `[ ]` tuple rỗng `[]` | chỉ `[]` |
| `never` | không giá trị |

```ts
type EmptyObj = Record<string, never>;
const e: EmptyObj = {};
// e.x = 1; // lỗi
```

Đừng annotate DTO bằng `{}`.

---

## 20. Khi nào KHÔNG dùng

| Tránh | Lý do | Dùng thay |
| --- | --- | --- |
| `any` cho JSON | lan độc | `unknown` + schema |
| `enum` + `node file.ts` | không erasable | union / `as const` object |
| Parameter properties | không erasable | field tường minh |
| `namespace` runtime | không erasable, ESM lệch | module ES |
| `as T` cho config | nói dối | `satisfies` / `as const satisfies` |
| `{}` / `object` cho DTO | quá rộng | shape / `Record` |
| Template types thay validator | chỉ literal compile-time | zod/valibot |
| Method shorthand cho callback an toàn | bivariant | function property |
| Brand mọi `string` | ma sát | brand ID/tiền tệ thôi |
| `new Number` / `new Boolean` | truthy / typeof lệch | primitive |
| `isNaN` global | ép chuỗi | `Number.isNaN` |
| Mix `bigint` + `number` | TypeError | một kiểu, convert tường minh |
| Distributive khi muốn một array hỗn hợp | `T[] \| U[]` không mong | `[T] extends …` |
| Module augmentation sai tên | miss im lặng / ambient rác | đúng subpath lib |
| `typeof` type trên type param | không hợp lệ | dùng `T` |

---

## 21. Best practices

1. Prefer `unknown` hơn `any`; validate I/O tại biên (schema), rồi hẹp / brand.
2. Discriminated unions thay hierarchy class khi mô hình dữ liệu / message.
3. Union literal hoặc `as const` object thay `enum` khi chạy ESM + Node type strip.
4. Bật `strict` + `noUncheckedIndexedAccess` (+ cân nhắc `exactOptionalPropertyTypes`). TS 7 đã default `strict`.
5. `erasableSyntaxOnly` + `verbatimModuleSyntax` khi workflow `node file.ts`.
6. Dùng `satisfies` (và/hoặc `as const satisfies`) cho config / maps literal — không `as`.
7. Type guard viết chặt; assertion function chỉ khi throw thật sự; đừng nhầm với `satisfies`.
8. Generic: constraint tối thiểu; `const` type param khi cần literal; `NoInfer` khi default làm bẩn inference.
9. Mapped / conditional cho API type-level — tránh “logic nghiệp vụ” chỉ sống trong types.
10. Function property cho callback cần contravariance; method khi OOP/DOM.
11. Brand ID bằng `unique symbol`; validate rồi brand.
12. Nhớ: kiểu TS **không** bảo vệ runtime — kết hợp validation khi cần.

---

## 22. Checklist

- □ Input ngoài process được coi là `unknown` / đã parse?
- □ Có `enum` / param properties / namespace runtime trong đường `node *.ts`?
- □ Discriminant unions đã exhaustive (`assertNever`)?
- □ Index access đã chấp nhận `| undefined` (hoặc guard)?
- □ `import type` đủ cho type-only (verbatim + strip)?
- □ CI chạy `tsc --noEmit` dù dev dùng type strip?
- □ ID / tiền tệ / đơn vị có brand (`unique symbol`) hoặc kiểu riêng?
- □ Object literal config dùng `satisfies` thay `as`?
- □ `moduleResolution` là `NodeNext` / `bundler` (không `node10`)?
- □ Callback public: function property, không method bivariant vô tình?
- □ Guard/`asserts` đã test biên? Không `return true` giả?
- □ `typeof` runtime đã xử lý `null` / boxed / array?
- □ Mix `bigint`/`number` đã bị cấm ở biên API?

---

## 23. Cheat sheet

| Cần | Dùng |
| --- | --- |
| Input chưa tin | `unknown` + guard / schema |
| “Không bao giờ” | `never` + `assertNever` |
| Map key hữu hạn | `Record<"a" \| "b", V>` hoặc const object |
| Enum erasable | `as const` + `(typeof O)[keyof typeof O]` |
| Giữ literal + check shape | `as const satisfies T` |
| Readonly sâu literal | `as const` / `as const satisfies T` |
| Đổi shape type-level | mapped + key remapping `` as `on${…}` `` |
| Bắt type từ pattern | conditional + `infer` |
| Tắt distributive | `[T] extends [U]` |
| Infer phần tử tuple | `T extends [infer H, ...infer R]` |
| Tách ID cùng base | branded + `unique symbol` |
| Chống widen generic | `<const T>` |
| Chặn suy luận một vị trí | `NoInfer<T>` |
| Fluent subclass | `this: this` |
| Mở rộng lib types | `declare module "..."` + `export {}` |
| Chạy TS trực tiếp Node 26 | chỉ cú pháp erasable |
| So sánh NaN / `-0` | `Object.is` / `Number.isNaN` |
| Callback an toàn | `(x: T) => void` property |
| `typeof` kiểu constructor | `typeof Class` / `InstanceType<typeof Class>` |

```ts
declare const Brand: unique symbol;
type UserId = string & { readonly [Brand]: void };

function parseUser(x: unknown): UserId {
  if (typeof x !== "string" || !x) throw new Error("id");
  return x as UserId;
}

const cfg = { port: 3000, host: "localhost" } as const satisfies Record<
  string,
  string | number
>;
```

---

## 24. Version matrix

| Thành phần | Liên quan type system |
| --- | --- |
| **TS 4.7+** | `in`/`out` variance annotations trên type params |
| **TS 4.9+** | `satisfies` |
| **TS 5.0+** | decorators chuẩn (khi bật), `const` type params |
| **TS 5.4+** | `NoInfer`, cải thiện narrowing |
| **TS 5.8+** | `erasableSyntaxOnly` |
| **TS 6 → 7** | default `strict: true`; `moduleResolution` `node`/`node10`/`classic` **error**; compiler Go (TS 7) |
| **ES / Node** | ESM-first; `NodeNext` |
| **Node 22.6+** | type stripping (experimental → dần ổn định) |
| **Node 24** | Active LTS tại 2026-10-06; strip ổn định từ 24.12.0 |
| **Node 26** | strip **ổn định** mặc định; **gỡ** `--experimental-transform-types` |
| **Explicit Resource Management** | `Symbol.dispose` / `using` — [statements.md](statements.md) |

---

## 25. Tài liệu liên quan

- [tsconfig & biên dịch](tsconfig.md)
- [Literal](literals.md)
- [Từ khóa](keywords.md)
- [Toán tử](operators.md)
- [Hàm & Method](functions-methods.md)
- [Function type, Callback & Lambda](functions-callbacks.md)
- [Tập hợp & Generics](collections-generics.md)
- [Modules & Packages](modules-packages.md)
- [Lập trình hướng đối tượng](oop.md)
- [Decorators & Metadata](decorators.md)
- [Exception / Error](exceptions.md)
- [Tooling](tooling.md)

- [Type tests & consumer contracts](testing.md)
- [Runtime validation ở biên](security.md)
