# Hệ thống kiểu dữ liệu (JavaScript runtime & TypeScript)

JavaScript là ngôn ngữ **dynamic** tại runtime (kiểu gắn với *giá trị*). TypeScript thêm lớp **static types** bị xóa khi biên dịch / type-strip — không tồn tại trên V8. Tài liệu này tập trung **TypeScript 7** chạy trên **Node.js 26** (ESM ưu tiên). Mục tiêu: tham chiếu thực dụng, không phải tutorial nhập môn.

---

## Mục lục

- [Hệ thống kiểu dữ liệu (JavaScript runtime \& TypeScript)](#hệ-thống-kiểu-dữ-liệu-javascript-runtime--typescript)
  - [Mục lục](#mục-lục)
  - [1. Runtime types (JS) vs static types (TS)](#1-runtime-types-js-vs-static-types-ts)
  - [2. Primitive types](#2-primitive-types)
  - [3. `object`, functions, arrays](#3-object-functions-arrays)
  - [4. Tuples](#4-tuples)
  - [5. Enums](#5-enums)
  - [6. `any` / `unknown` / `never` / `void`](#6-any--unknown--never--void)
  - [7. Union, intersection, literal types](#7-union-intersection-literal-types)
  - [8. Type aliases vs interfaces](#8-type-aliases-vs-interfaces)
  - [9. Narrowing, type guards, assertion functions](#9-narrowing-type-guards-assertion-functions)
  - [10. Generics (overview)](#10-generics-overview)
  - [11. Structural typing](#11-structural-typing)
  - [12. Strictness flags](#12-strictness-flags)
  - [13. `satisfies` \& const assertions](#13-satisfies--const-assertions)
  - [14. Type stripping trên Node](#14-type-stripping-trên-node)
  - [15. Best practices ngắn](#15-best-practices-ngắn)

---

## 1. Runtime types (JS) vs static types (TS)

| Tầng | Cơ chế | Ví dụ |
|------|--------|--------|
| **Runtime (JS)** | `typeof`, prototype, brand checks | `typeof x === "string"` |
| **Compile-time (TS)** | checker, inference, assignability | `const x: string = ...` |

```ts
let x: string = "hi";
// Sau emit / type strip: chỉ còn  let x = "hi";
```

- TS **không** thêm runtime validation trừ khi bạn tự viết (zod, valibot, type guards).  
- `typeof` runtime ≠ `typeof` trong type position (xem [keywords](keywords.md)).

---

## 2. Primitive types

Runtime primitives: `string`, `number`, `bigint`, `boolean`, `symbol`, `undefined`, `null`.

```ts
const s: string = "text";
const n: number = 3.14;          // IEEE-754 double (không có int riêng)
const b: bigint = 10n;
const ok: boolean = true;
const sym: symbol = Symbol("id");
const u: undefined = undefined;
const z: null = null;
```

- **`number`**: mọi số hữu hạn/NaN/±Infinity; không phân biệt int/float ở cấp kiểu.  
- **`bigint`**: không trộn trực tiếp với `number` (`1n + 1` lỗi).  
- **`null` vs `undefined`**: khác nhau; với `strictNullChecks`, cả hai không gán vào `T` trừ `T | null | undefined`.  
- Wrapper objects (`new String()`) — tránh; `typeof new String()` là `"object"`.

---

## 3. `object`, functions, arrays

```ts
const o: object = { a: 1 };           // non-primitive (ít dùng; ưu tiên shape cụ thể)
const f: (x: number) => number = (x) => x * 2;
const arr: number[] = [1, 2, 3];
const arr2: Array<string> = ["a"];
const ro: ReadonlyArray<number> = [1, 2];
```

- Mọi non-primitive là object ở runtime (kể cả hàm, mảng, Date).  
- Function type: tham số **contravariant** theo mặc định strictFunctionTypes (cho method params có ngoại lệ lịch sử).  
- Array là object; kiểu phần tử chỉ tồn tại ở TS.

```ts
type Dict = Record<string, unknown>;
type MapLike = { [key: string]: number };
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
```

- Tuple ≠ mảng mở: độ dài / vị trí có nghĩa.  
- `as const` trên literal array → tuple readonly hẹp (xem mục 13).  
- Destructure giữ kiểu vị trí.

---

## 5. Enums

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

- Numeric enum có reverse mapping; string enum thì không.  
- `const enum` inline giá trị — **cẩn thận** với `isolatedModules` / bundler / type stripping (có thể không hỗ trợ tốt).  
- Node type stripping: ưu tiên **union literal** hoặc object `as const` thay enum cổ điển.

```ts
const Direction = {
  Up: "Up",
  Down: "Down",
} as const;
type Direction = (typeof Direction)[keyof typeof Direction];
```

---

## 6. `any` / `unknown` / `never` / `void`

| Kiểu | Ý nghĩa | Khi dùng |
|------|---------|----------|
| `any` | Tắt kiểm tra | Escape hatch — hạn chế |
| `unknown` | An toàn: phải hẹp trước khi dùng | Input bên ngoài, JSON |
| `never` | Không bao giờ xảy ra | Exhaustiveness, throw |
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

- Gán `any` lan truyền độc; `unknown` buộc narrowing.  
- `void` không phải “không có giá trị” tuyệt đối ở runtime — hàm vẫn có thể `return` gì đó; caller không nên dùng.

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

- Union: giá trị thuộc **một** nhánh; dùng narrowing.  
- Intersection: phải thỏa **mọi** thành phần (với primitive mâu thuẫn → `never`).  
- Discriminated unions:

```ts
type Result =
  | { ok: true; value: string }
  | { ok: false; error: Error };

function unwrap(r: Result): string {
  if (r.ok) return r.value;
  throw r.error;
}
```

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
|--|-------------|--------|
| Object shape | ✅ | ✅ |
| Union / tuple / mapped | hạn chế | ✅ mạnh |
| Declaration merging | ✅ | ❌ |
| `extends` | ✅ | dùng intersection |

- Lib DOM/Node thường dùng `interface` để merge.  
- App code hiện đại: `type` linh hoạt; `interface` khi cần extend/merge công khai.  
- Không có khác biệt runtime — cả hai erase.

---

## 9. Narrowing, type guards, assertion functions

**Narrowing tự động**: `typeof`, `===`, `in`, `instanceof`, truthiness, discriminated union, control flow.

```ts
function len(x: string | string[]) {
  if (typeof x === "string") return x.length;
  return x.length; // string[]
}
```

**User-defined type guard**:

```ts
function isString(x: unknown): x is string {
  return typeof x === "string";
}
```

**Assertion function** (TS 3.7+):

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

- Guard trả `boolean` + `x is T`; assertion `asserts` / `asserts x is T` không trả về hữu ích (thường `void`).  
- Sai guard = lỗ hổng an toàn kiểu — viết chặt.

---

## 10. Generics (overview)

```ts
function identity<T>(value: T): T {
  return value;
}

type ApiResponse<T> = { data: T; status: number };

interface Repo<T extends { id: string }> {
  get(id: string): Promise<T | undefined>;
}
```

- Constraints: `T extends U`.  
- `keyof`, mapped types, conditional types: xem thêm collections/generics (file riêng nếu có).  
- Infer: `infer` trong conditional types.

```ts
type Awaitedish<T> = T extends Promise<infer U> ? U : T;
```

---

## 11. Structural typing

TypeScript dùng **structural** (duck typing tĩnh), không nominal:

```ts
type P = { x: number; y: number };
const q = { x: 1, y: 2, z: 3 };
const p: P = q; // OK — có đủ x, y (excess property check lỏng khi qua biến)
```

- Excess property check chặt hơn với **object literal** gán trực tiếp.  
- Muốn nominal: brand/tag:

```ts
type UserId = string & { readonly __brand: "UserId" };
```

---

## 12. Strictness flags

Bật `"strict": true` (khuyến nghị; **mặc định trên TS 7**) gồm nhiều cờ.

| Flag | Ý nghĩa ngắn |
|------|----------------|
| `strictNullChecks` | `null`/`undefined` không thuộc mọi kiểu |
| `strictFunctionTypes` | so sánh function params chặt hơn |
| `strictBindCallApply` | `bind`/`call`/`apply` có kiểu đúng |
| `noImplicitAny` | cấm any ngầm |
| `noImplicitThis` | `this` phải có kiểu |
| `alwaysStrict` | emit `"use strict"` |
| `useUnknownInCatchVariables` | `catch (e)` → `unknown` |
| `noUncheckedIndexedAccess` | `obj[key]` thêm `\| undefined` (không nằm trong `strict`, nên bật riêng) |
| `exactOptionalPropertyTypes` | phân biệt thiếu prop vs `undefined` tường minh |

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2024",
    "verbatimModuleSyntax": true
  }
}
```

- `skipLibCheck`: tăng tốc CI; vẫn type-check code mình.  
- `erasableSyntaxOnly`: hạn chế cú pháp không erasable — **khuyến nghị** khi dùng Node type stripping (`node file.ts`). Kết hợp `verbatimModuleSyntax`.

---

## 13. `satisfies` & const assertions

**`as const`**: hẹp literal, deep readonly.

```ts
const routes = {
  home: "/",
  user: "/users/:id",
} as const;
// typeof routes.home === "/"
```

**`satisfies`**: kiểm tra gán được vào kiểu mà **giữ** kiểu hẹp suy luận (không widen như annotation).

```ts
type Config = Record<string, string | number>;

const cfg = {
  port: 3000,
  host: "localhost",
} satisfies Config;
// cfg.port là 3000 (literal), không bị widen thành string | number
```

- `as Config` có thể **nới** hoặc nói dối checker; `satisfies` bắt lỗi thiếu/sai key mà không mất literal.

---

## 14. Type stripping trên Node

```bash
node src/app.ts   # Node 26: strip types mặc định, không type-check
```

- Hợp lệ: type annotations, `interface`, `type`, `satisfies`, import type (tùy), generics erasable.  
- **Không** erasable qua strip: `enum` / `namespace` / decorators / parameter properties → `tsc` / `tsx` / bundler.  
- Node 26 **đã gỡ** `--experimental-transform-types`.  
- Khuyến nghị: `erasableSyntaxOnly` + `verbatimModuleSyntax`; production: `tsc` emit + `node dist/...`; CI luôn `tsc --noEmit`.

---

## 15. Best practices ngắn

- Prefer `unknown` hơn `any`; validate I/O tại biên.  
- Discriminated unions thay hierarchy class khi mô hình dữ liệu.  
- Union literal / `as const` object thay enum khi publish ESM + strip.  
- Bật `strict` + `noUncheckedIndexedAccess`.  
- Dùng `satisfies` cho config/maps literal.  
- Nhớ: kiểu TS **không** bảo vệ runtime — kết hợp schema validation khi cần.
