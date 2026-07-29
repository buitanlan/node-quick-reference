# Hệ thống kiểu dữ liệu (JavaScript runtime & TypeScript)

JavaScript là ngôn ngữ **dynamic** tại runtime (kiểu gắn với *giá trị*). TypeScript thêm lớp **static types** bị xóa khi biên dịch / type-strip — không tồn tại trên V8. Tài liệu này tập trung **TypeScript 7** chạy trên **Node.js 26** (ESM ưu tiên). Mục tiêu: tham chiếu thực dụng, không phải tutorial nhập môn.

> Baseline: **TypeScript 7** (compiler Go) + **Node.js 26** (type stripping ổn định). Node **24** vẫn Maintenance LTS trong giai đoạn chuyển — xem [node26-ts7.md](node26-ts7.md).

---

## Mục lục

- [Hệ thống kiểu dữ liệu (JavaScript runtime & TypeScript)](#hệ-thống-kiểu-dữ-liệu-javascript-runtime--typescript)
  - [Mục lục](#mục-lục)
  - [1. Runtime types (JS) vs static types (TS)](#1-runtime-types-js-vs-static-types-ts)
  - [2. Primitive types](#2-primitive-types)
    - [2.1 `number`, NaN, `Object.is`](#21-number-nan-objectis)
    - [2.2 `typeof` quirks](#22-typeof-quirks)
    - [2.3 `null` vs `undefined`](#23-null-vs-undefined)
  - [3. `object`, functions, arrays](#3-object-functions-arrays)
    - [3.1 `Record` & index signatures](#31-record--index-signatures)
  - [4. Tuples](#4-tuples)
  - [5. Enums vs const objects / unions](#5-enums-vs-const-objects--unions)
  - [6. `any` / `unknown` / `never` / `void`](#6-any--unknown--never--void)
  - [7. Union, intersection, literal types](#7-union-intersection-literal-types)
    - [7.1 Discriminated unions](#71-discriminated-unions)
  - [8. Type aliases vs interfaces](#8-type-aliases-vs-interfaces)
    - [8.1 Declaration merging](#81-declaration-merging)
  - [9. Narrowing, type guards, assertion functions](#9-narrowing-type-guards-assertion-functions)
  - [10. Generics](#10-generics)
    - [10.1 Constraints, defaults, `keyof`](#101-constraints-defaults-keyof)
    - [10.2 Variance (góc nhìn ngắn)](#102-variance-góc-nhìn-ngắn)
  - [11. Mapped, conditional, `infer`, template literal types](#11-mapped-conditional-infer-template-literal-types)
    - [11.1 Mapped types](#111-mapped-types)
    - [11.2 Conditional types & `infer`](#112-conditional-types--infer)
    - [11.3 Template literal types](#113-template-literal-types)
  - [12. Structural typing](#12-structural-typing)
    - [12.1 Excess property check](#121-excess-property-check)
    - [12.2 Branded / nominal patterns](#122-branded--nominal-patterns)
  - [13. Strictness flags](#13-strictness-flags)
  - [14. `satisfies` & const assertions](#14-satisfies--const-assertions)
  - [15. Type stripping trên Node 26](#15-type-stripping-trên-node-26)
  - [16. Module augmentation, ambient, `this` types](#16-module-augmentation-ambient-this-types)
  - [17. Assignability / widen / narrow](#17-assignability--widen--narrow)
  - [18. Best practices, checklist, cheat sheet](#18-best-practices-checklist-cheat-sheet)

---

## 1. Runtime types (JS) vs static types (TS)

| Tầng | Cơ chế | Ví dụ |
| --- | --- | --- |
| **Runtime (JS)** | `typeof`, prototype, brand checks | `typeof x === "string"` |
| **Compile-time (TS)** | checker, inference, assignability | `const x: string = ...` |

```ts
let x: string = "hi";
// Sau emit / type strip: chỉ còn  let x = "hi";
```

- TS **không** thêm runtime validation trừ khi bạn tự viết (zod, valibot, type guards, schema).
- `typeof` runtime ≠ `typeof` trong type position (xem [keywords](keywords.md)).
- Type strip / `tsc` erase annotations — V8 chỉ thấy JS; sai dữ liệu từ JSON/HTTP vẫn qua được nếu không validate.
- Hai “sự thật” song song: **kiểu tĩnh** (checker tin) và **giá trị runtime** (thực tế). Khi lệch → bug khó thấy.

> Quy tắc biên: mọi input ngoài process (HTTP body, env, file, message queue) là `unknown` cho đến khi parse/validate.

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
- `bigint`: không trộn trực tiếp với `number` (`1n + 1` lỗi).
- Wrapper objects (`new String()`) — tránh; `typeof new String()` là `"object"`.
- `symbol` luôn unique (trừ `Symbol.for`); hay dùng làm brand / key ẩn.

### 2.1 `number`, NaN, `Object.is`

```ts
Number.isNaN(NaN); // true
NaN === NaN; // false
Object.is(NaN, NaN); // true
Object.is(+0, -0); // false  (=== thì true)
```

| So sánh | `===` | `Object.is` | `Number.isNaN` |
| --- | --- | --- | --- |
| `NaN` vs `NaN` | `false` | `true` | — |
| `+0` vs `-0` | `true` | `false` | — |
| `"1"` vs `1` | `false` | `false` | — |

- `isNaN("x")` (global) ép kiểu → `true` — **đừng dùng**; dùng `Number.isNaN`.
- `parseInt("08")` / float parse: luôn kiểm tra `Number.isFinite` khi cần số hợp lệ.
- Map/Set key bằng `number`: `NaN` được coi **cùng một key** (spec đặc biệt), khác `===`.

> Tiền tệ / số thập phân chính xác: không dùng `number` thô — dùng integer cents, `bigint`, hoặc thư viện decimal.

### 2.2 `typeof` quirks

| Biểu thức | `typeof` | Ghi chú |
| --- | --- | --- |
| `"hi"` | `"string"` | |
| `42` / `NaN` | `"number"` | `NaN` vẫn `"number"` |
| `10n` | `"bigint"` | |
| `true` | `"boolean"` | |
| `undefined` | `"undefined"` | |
| `null` | `"object"` | bug lịch sử — không sửa được |
| `{}` / `[]` / `new Date()` | `"object"` | phân biệt bằng `Array.isArray` / brand |
| `() => {}` | `"function"` | hàm cũng là object ở runtime |
| `Symbol()` | `"symbol"` | |

```ts
function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
```

- Type guard dựa `typeof` phải xử lý `null` và mảng tường minh.
- `typeof` trong **type position** (`typeof value`) lấy kiểu của giá trị/biến — khác toán tử runtime.

### 2.3 `null` vs `undefined`

| | `undefined` | `null` |
| --- | --- | --- |
| Ý nghĩa thường gặp | “chưa có / thiếu” | “cố ý trống” |
| Biến chưa gán | `undefined` | — |
| Prop thiếu trên object | `undefined` khi đọc | — |
| JSON | thường bị omit | serialize thành `null` |
| `typeof` | `"undefined"` | `"object"` |
| Default param `f(x = 1)` | trigger khi `undefined` | **không** trigger với `null` |

```ts
function f(x: number | null | undefined = 1) {
  return x;
}
f(); // 1
f(undefined); // 1
f(null); // null  ← không thay bằng default
```

- Với `strictNullChecks` (nằm trong `strict`): `null` / `undefined` không gán vào `T` trừ khi union tường minh.
- `exactOptionalPropertyTypes`: phân biệt `{ x?: number }` (thiếu key) vs `{ x: number | undefined }` — xem §13.

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

Function type:

```ts
type Mapper = (n: number) => string;
type Handler = { (event: Event): void; name: string }; // call signature + props
```

- Tham số hàm **contravariant** theo mặc định với `strictFunctionTypes` (method params có ngoại lệ lịch sử bivariant — ưu tiên function property thay method khi cần chặt).
- Optional param `f(x?: number)` ≈ `f(x: number | undefined)` về gọi, nhưng khác declaration emit / excess args.

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
- `readonly [T, U]` ngăn mutate phần tử; `as const` trên literal array → tuple readonly hẹp (xem §14).
- Variadic tuple + generics: nền tảng cho kiểu `zip`, `concat`, infer rest params.

```ts
function head<T extends unknown[]>(tuple: [...T]): T[0] {
  return tuple[0];
}
const h = head(["a", 1] as const); // "a"
```

- Optional element `T?` khác `T | undefined` ở giữa tuple cố định — vị trí optional thường ở cuối.
- Destructure giữ kiểu vị trí: `const [a, b]: Pair = p` → `a: string`, `b: number`.

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

> Node 26 đã gỡ `--experimental-transform-types` — không còn “biến enum thành JS lúc chạy”. Chọn cú pháp erasable hoặc build trước.

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
- Pattern thay class hierarchy cho dữ liệu bất biến / message / state machine.

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

- Merge cùng tên trong cùng scope — hữu ích cho augmentation (§16), nguy hiểm nếu merge nhầm file.
- `type` **không** merge: khai báo lại → lỗi duplicate.
- Interface có thể merge với namespace cùng tên (pattern class + namespace legacy) — tránh với `erasableSyntaxOnly`.

---

## 9. Narrowing, type guards, assertion functions

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

**User-defined type guard:**

```ts
function isString(x: unknown): x is string {
  return typeof x === "string";
}
```

**Assertion function:**

```ts
function assert(cond: unknown, msg?: string): asserts cond {
  if (!cond) throw new Error(msg ?? "Assertion failed");
}

function assertString(x: unknown): asserts x is string {
  if (typeof x !== "string") throw new Error("not string");
}

function demo(x: unknown) {
  assertString(x);
  x.toUpperCase(); // string
}
```

- Guard trả `boolean` + `x is T`; assertion `asserts` / `asserts x is T` (thường `void` về giá trị trả).
- Sai guard = lỗ hổng an toàn kiểu — viết chặt, test biên.
- Narrowing **không** xuyên qua callback khác closure nếu biến bị gán lại (aliasing); dùng `const` hoặc copy local.
- `switch` + `assertNever` trong `default` bắt thiếu case khi thêm variant.

---

## 10. Generics

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

### 10.2 Variance (góc nhìn ngắn)

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
- Chi tiết collections: [collections-generics.md](collections-generics.md).

---

## 11. Mapped, conditional, `infer`, template literal types

Các công cụ **type-level** — không phát sinh runtime. Nền tảng utility types (`Partial`, `Pick`, `Omit`, `Readonly`, …).

### 11.1 Mapped types

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

- Utility chuẩn: `Partial<T>`, `Required<T>`, `Readonly<T>`, `Pick<T, K>`, `Omit<T, K>`, `Record<K, V>`, `Exclude`, `Extract`, `NonNullable`.

### 11.2 Conditional types & `infer`

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

- `infer` chỉ trong nhánh `extends` của conditional — đặt tên biến kiểu tại vị trí cần bắt.
- Thứ tự nhánh quan trọng; đặt case hẹp trước khi case rộng.
- Vòng đệ quy type quá sâu → lỗi compiler; giới hạn độ sâu có chủ đích.

### 11.3 Template literal types

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

> Đừng thay schema runtime bằng template types: chúng chỉ kiểm tra chuỗi **đã biết lúc compile**.

---

## 12. Structural typing

TypeScript dùng **structural** (duck typing tĩnh), không nominal theo mặc định:

```ts
type P = { x: number; y: number };
const q = { x: 1, y: 2, z: 3 };
const p: P = q; // OK — có đủ x, y
```

- Hai kiểu “trùng shape” là tương thích dù tên khác nhau.
- Khác Go/Java named types: `type UserId = string` **không** tạo brand — vẫn là `string`.

### 12.1 Excess property check

```ts
type P = { x: number; y: number };

const p1: P = { x: 1, y: 2, z: 3 }; // lỗi — literal thừa z
const tmp = { x: 1, y: 2, z: 3 };
const p2: P = tmp; // OK — qua biến trung gian
```

- Excess property check chặt với **object literal** gán trực tiếp / return / argument.
- Qua biến → chỉ kiểm tra “có đủ property cần” (open style).
- Escape có chủ đích: type assertion, hoặc rest destructure khi cố ý bỏ field thừa.

### 12.2 Branded / nominal patterns

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

- Brand chỉ tồn tại ở hệ thống kiểu — runtime vẫn là `string`/`number`.
- Unique `symbol` brand chắc hơn string `"UserId"` nếu sợ đụng tên.
- Validate ở biên rồi brand; đừng `as UserId` trên mọi string lung tung.

---

## 13. Strictness flags

Bật `"strict": true` (TS 7: default chặt hơn theo hướng TS 6+) gồm nhiều cờ con; vẫn nên biết từng lá.

| Flag | Ý nghĩa ngắn |
| --- | --- |
| `strictNullChecks` | `null`/`undefined` không thuộc mọi kiểu |
| `strictFunctionTypes` | so sánh function params chặt (contravariant) |
| `strictBindCallApply` | `bind`/`call`/`apply` có kiểu đúng |
| `noImplicitAny` | cấm any ngầm |
| `noImplicitThis` | `this` phải có kiểu |
| `alwaysStrict` | emit `"use strict"` (kém liên quan ESM) |
| `useUnknownInCatchVariables` | `catch (e)` → `unknown` |
| `noUncheckedIndexedAccess` | `obj[key]` thêm `\| undefined` (**không** trong `strict`) |
| `exactOptionalPropertyTypes` | thiếu prop ≠ `undefined` tường minh |
| `verbatimModuleSyntax` | import/export giữ nguyên; bắt `import type` |
| `erasableSyntaxOnly` | cấm cú pháp không erasable (enum, namespace runtime, param props, …) |

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2024",
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "rewriteRelativeImportExtensions": true
  }
}
```

- `skipLibCheck`: tăng tốc CI; vẫn type-check code mình.
- TS 7: `moduleResolution: "node"` / `node10` / `classic` → **error**; ưu tiên `NodeNext` / `bundler`.
- `verbatimModuleSyntax` + Node strip: thiếu `type` trên type-only import → runtime trỏ export không tồn tại.

> Chi tiết tsconfig: [tsconfig.md](tsconfig.md) · [node26-ts7.md](node26-ts7.md).

---

## 14. `satisfies` & const assertions

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
// cfg.port là 3000 (literal), không bị widen thành string | number

const bad = {
  port: 3000,
  host: true,
} satisfies Config; // lỗi: boolean không khớp
```

| Cách | Kiểm tra shape | Giữ literal |
| --- | --- | --- |
| `const x: Config = {...}` | ✓ | ✗ (widen) |
| `const x = {...} as Config` | ✗ (nói dối được) | tùy assertion |
| `const x = {...} satisfies Config` | ✓ | ✓ |
| `as const satisfies Config` | ✓ | ✓ + readonly |

- `as Config` có thể **nới** hoặc nói dối checker; `satisfies` bắt thiếu/sai key mà không mất literal.
- Pattern mạnh: bảng route, theme token, enum-like maps, openAPI path constants.

---

## 15. Type stripping trên Node 26

```bash
node src/app.ts   # Node 26: strip types ổn định, không type-check
```

| | Hành vi |
| --- | --- |
| Làm gì | Xóa annotation / type-only syntax → JS chạy trên V8 |
| Không làm | Type-check, path alias `tsconfig`, downlevel cú pháp JS mới |
| Cờ cũ | `--experimental-transform-types` **đã gỡ** trên Node 26 |

**Erasable (OK với strip):**

- Type annotations, `type` / `interface`, generics erasable
- `satisfies`, `as` / `as const` (assertion)
- `import type` / `export type` / modifier `type` trên named import

**Không erasable (cần `tsc` / bundler / `tsx`):**

- `enum` / `const enum`
- `namespace` / `module` có runtime code
- Parameter properties (`constructor(private x: string)`)
- `import =` / `export =`
- Decorators (nếu emit metadata / transform) — xem [decorators.md](decorators.md)

```ts
// OK strip
export type Id = string;
export function greet(name: string): string {
  return `hi ${name}`;
}

// Phải tránh nếu chạy bằng node file.ts
// enum Kind { A, B }
// class C { constructor(private x: number) {} }
```

- Production phổ biến: `tsc` emit + `node dist/...`; CI luôn `tsc --noEmit`.
- Dev script erasable: `node src/index.ts` hợp lệ khi bám `erasableSyntaxOnly`.
- Node **bỏ qua** `tsconfig.json` khi chạy — `paths` / JSX transform không có phép màu.

---

## 16. Module augmentation, ambient, `this` types

### Module augmentation

Mở rộng module có sẵn (pattern `@types` và plugin):

```ts
// types/express-augment.d.ts
declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}
export {}; // đảm bảo file là module
```

- Augment đúng tên module (subpath) mà lib export type.
- File `.d.ts` cần `export {}` nếu không có import/export — tránh thành global script vô tình.
- Augmentation **merge** interface; không thay thế type alias của lib.

### Ambient declarations

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

### `this` parameter & polymorphic `this`

```ts
function say(this: { name: string }, greeting: string) {
  return `${greeting}, ${this.name}`;
}

class Builder {
  setName(this: this, name: string): this {
    // ...
    return this;
  }
}
```

- `this` giả ở tham số đầu: chỉ kiểm tra lúc gọi với call/apply/method; erase khi emit.
- `this: this` (polymorphic) giữ subtype khi fluent API / inheritance.
- `noImplicitThis`: callback DOM/`function()` cũ hay lỗi — chuyển arrow hoặc annotate `this`.

---

## 17. Assignability / widen / narrow

### Widen vs narrow

| Hiện tượng | Ví dụ | Kết quả |
| --- | --- | --- |
| Literal widen (mutable `let`) | `let x = "a"` | `string` |
| Giữ literal (`const`) | `const x = "a"` | `"a"` |
| Context sensitive | `const c: "a" \| "b" = "a"` | `"a"` gán vào union |
| `as const` | `{ a: "x" } as const` | deep readonly literal |
| Narrow control-flow | `if (typeof x === "string")` | `x` là `string` trong nhánh |
| Assertion | `x as string` | ép — **không** hẹp runtime |

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
| object literal thừa prop → `T` | ✗ | excess property |
| biến cùng shape thừa prop → `T` | ✓ | open assignability |
| `() => string` → `() => void` | ✓ | đặc hiệu `void` |
| `(x: string) => void` → `(x: "a") => void` | ✓ (strict) | param contravariant ngược intuition? — tham số đích hẹp hơn → nguồn nhận rộng hơn OK |

> Nhớ: **assignable ≠ identical ≠ “cùng ý nghĩa domain”**. Brand khi cần tách `UserId` / `OrderId`.

---

## 18. Best practices, checklist, cheat sheet

### Best practices

1. Prefer `unknown` hơn `any`; validate I/O tại biên (schema), rồi hẹp / brand.
2. Discriminated unions thay hierarchy class khi mô hình dữ liệu / message.
3. Union literal hoặc `as const` object thay `enum` khi chạy ESM + Node type strip.
4. Bật `strict` + `noUncheckedIndexedAccess` (+ cân nhắc `exactOptionalPropertyTypes`).
5. `erasableSyntaxOnly` + `verbatimModuleSyntax` khi workflow `node file.ts`.
6. Dùng `satisfies` (và/hoặc `as const satisfies`) cho config / maps literal.
7. Type guard viết chặt; assertion function chỉ khi throw thật sự.
8. Generic: constraint tối thiểu; đừng over-abstract một chỗ dùng.
9. Mapped / conditional cho API type-level — tránh “logic nghiệp vụ” chỉ sống trong types.
10. Nhớ: kiểu TS **không** bảo vệ runtime — kết hợp validation khi cần.

### Checklist

- □ Input ngoài process được coi là `unknown` / đã parse?
- □ Có `enum` / param properties / namespace runtime trong đường `node *.ts`?
- □ Discriminant unions đã exhaustive (`assertNever`)?
- □ Index access đã chấp nhận `| undefined` (hoặc guard)?
- □ `import type` đủ cho type-only (verbatim + strip)?
- □ CI chạy `tsc --noEmit` dù dev dùng type strip?
- □ ID / tiền tệ / đơn vị có brand hoặc kiểu riêng?
- □ Object literal config dùng `satisfies` thay `as`?

### Cheat sheet

| Cần | Dùng |
| --- | --- |
| Input chưa tin | `unknown` + guard / schema |
| “Không bao giờ” | `never` + `assertNever` |
| Map key hữu hạn | `Record<"a" \| "b", V>` hoặc const object |
| Enum erasable | `as const` + `(typeof O)[keyof typeof O]` |
| Giữ literal + check shape | `satisfies` |
| Readonly sâu literal | `as const` |
| Đổi shape type-level | mapped + key remapping |
| Bắt type từ pattern | conditional + `infer` |
| Tách ID cùng base | branded intersection |
| Fluent subclass | `this: this` |
| Mở rộng lib types | `declare module "..."` |
| Chạy TS trực tiếp Node 26 | chỉ cú pháp erasable |

### Ma trận phiên bản (liên quan hệ thống kiểu)

| Thành phần | Liên quan type system |
| --- | --- |
| **TS 4.7+** | `in`/`out` variance annotations trên type params |
| **TS 4.9+** | `satisfies` |
| **TS 5.0+** | decorators chuẩn (khi bật), `const` type params |
| **TS 5.4+** | `NoInfer`, cải thiện narrowing |
| **TS 5.8+** | `erasableSyntaxOnly` |
| **TS 6 → 7** | default chặt (`strict`); bỏ `moduleResolution` legacy; compiler Go (TS 7) |
| **ES / Node** | ESM-first; `NodeNext` |
| **Node 22.6+** | type stripping (experimental → dần ổn định) |
| **Node 24** | Maintenance LTS; strip ổn định (nhánh 24.x gần đây) |
| **Node 26** | strip **ổn định** mặc định; **gỡ** `--experimental-transform-types` |

### Tài liệu liên quan

- [Node 26 & TypeScript 7 highlights](node26-ts7.md)
- [tsconfig & biên dịch](tsconfig.md)
- [Literal](literals.md)
- [Từ khóa](keywords.md)
- [Hàm & Method](functions-methods.md)
- [Function type, Callback & Lambda](functions-callbacks.md)
- [Tập hợp & Generics](collections-generics.md)
- [Modules & Packages](modules-packages.md)
- [Lập trình hướng đối tượng](oop.md)
- [Decorators & Metadata](decorators.md)
