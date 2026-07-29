# Keywords

Từ khóa và từ khóa ngữ cảnh (contextual) quan trọng của **JavaScript** và **TypeScript 7**, dùng trên **Node.js 26**. Phong cách: mục đích → ví dụ → **bẫy theo nhóm** — không liệt kê máy móc mọi reserved word lịch sử. Tập trung ESM + TS hàng ngày.

---

## Mục lục

- [Keywords](#keywords)
  - [Mục lục](#mục-lục)
  - [1. Khai báo: `const` / `let` / `var`](#1-khai-báo-const--let--var)
  - [2. Hàm: `function` / `return` / `yield`](#2-hàm-function--return--yield)
  - [3. Bất đồng bộ: `async` / `await`](#3-bất-đồng-bộ-async--await)
  - [4. Lớp \& OOP](#4-lớp--oop)
  - [5. Module: `import` / `export`](#5-module-import--export)
  - [6. Điều khiển luồng](#6-điều-khiển-luồng)
  - [7. Exception: `try` / `catch` / `finally` / `throw`](#7-exception-try--catch--finally--throw)
  - [8. Toán tử-từ khóa](#8-toán-tử-từ-khóa)
  - [9. Giá trị: `true` / `false` / `null` / `undefined`](#9-giá-trị-true--false--null--undefined)
  - [10. TypeScript — kiểu](#10-typescript--kiểu)
  - [11. TypeScript — modifier \& type-only](#11-typescript--modifier--type-only)
  - [12. Resource management: `using` / `await using`](#12-resource-management-using--await-using)
  - [13. Khác: `debugger` / `with` / `of` / `get` / `set`](#13-khác-debugger--with--of--get--set)
  - [14. Reserved vs contextual](#14-reserved-vs-contextual)
  - [15. Best practices](#15-best-practices)
  - [16. Checklist](#16-checklist)
  - [17. Cheat sheet](#17-cheat-sheet)
  - [18. Version notes](#18-version-notes)
  - [19. Tài liệu liên quan](#19-tài-liệu-liên-quan)

---

## 1. Khai báo: `const` / `let` / `var`

- **Loại:** reserved  
- **Mục đích:** khai báo binding. `const`/`let` block-scoped; `var` function-scoped + hoisting.

```ts
const PI = 3.14;      // không rebind; object vẫn mutable
let count = 0;
count = 1;

var legacy = 1;       // tránh trong code mới
```

**TDZ (Temporal Dead Zone):** từ đầu scope đến dòng khởi tạo, truy cập `let`/`const` → `ReferenceError` (khác `var` = `undefined`).

```ts
{
  // console.log(x); // ReferenceError
  let x = 1;
}
```

**Bẫy `let`/`const`/`var`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Dùng trước khai báo | TDZ | khai báo trên trước khi đọc |
| `const` = immutable sâu | chỉ cấm rebind | `Object.freeze` / `as const` nếu cần |
| `var` trong `for` + closure | một binding chia sẻ | `let` trong `for` |
| Redeclare `let` cùng scope | SyntaxError | tên khác / block |
| `const` thiếu init | SyntaxError | luôn khởi tạo |

Prefer `const` mặc định, `let` khi cần gán lại; **không** `var` trong ESM/TS mới.

---

## 2. Hàm: `function` / `return` / `yield`

```ts
function add(a: number, b: number): number {
  return a + b;
}

function* range(n: number) {
  for (let i = 0; i < n; i++) yield i;
}

function* outer() {
  yield* range(3); // ủy quyền iterable/generator khác
}
```

- `function` **declaration** được hoist (có thể gọi trước dòng khai báo trong cùng scope).
- `function` **expression** / arrow không hoist tên như declaration.
- Không `return` ⇒ `undefined`; `return` sau ASI nguy hiểm — xem [statements.md](statements.md).
- `yield` chỉ trong generator (`function*` / `async function*`); `yield*` ủy quyền.

**Bẫy:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Nhầm declaration vs expression | `const f = function(){}` không hoist | biết chỗ gọi |
| `return` xuống dòng | ASI → `return;` | cùng dòng / ngoặc `(`` |
| `yield` ngoài generator | SyntaxError | `function*` |
| Generator sync vs async | `yield` vs `await` + `yield` | `async function*` khi I/O |

---

## 3. Bất đồng bộ: `async` / `await`

```ts
async function load(url: string): Promise<string> {
  const res = await fetch(url);
  return res.text();
}

const text = await load("https://example.com"); // top-level await: ESM
```

- `async` function **luôn** trả `Promise` (kể cả `return` sync / `throw` → reject).
- `await` dừng tới settle; chỉ trong `async` hoặc **top-level await** ESM.
- `await` thenable không phải Promise vẫn chạy theo protocol thenable.
- `await using` — khác `await` đơn — mục 12.

**Bẫy `async`/`await`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Quên `await` | Promise “treo” / race | await hoặc void+catch có chủ đích |
| `async` trong `Promise` ctor | anti-pattern | xem [async.md](async.md) |
| `await` trong vòng tuần tự chậm | waterfall | `Promise.all` / pool |
| TLA trong lib xuất | side effect import | TLA chỉ entry/config |
| Catch nuốt lỗi | `try/catch` rộng | bắt hẹp / rethrow |

Chi tiết concurrency: [async.md](async.md), [event-loop.md](event-loop.md).

---

## 4. Lớp & OOP

Từ khóa liên quan: `class` / `extends` / `implements` / `super` / `static` / `this` / `new` / `constructor` (+ TS `abstract`, `override`, visibility).

```ts
interface Printable {
  print(): void;
}

abstract class Shape {
  abstract area(): number;
}

class Circle extends Shape implements Printable {
  constructor(public readonly r: number) {
    super();
  }

  static unit(): Circle {
    return new Circle(1);
  }

  area(): number {
    return Math.PI * this.r ** 2;
  }

  print(): void {
    console.log(this.area());
  }
}
```

- `implements` chỉ TS (erase) — **không** runtime check.
- `extends` một class; mixins bằng composition / helper.
- `#private` (JS) khác `private` TS (compile-time only; vẫn có thể lộ sau emit nếu không dùng `#`).
- Class declaration có TDZ — không dùng trước khởi tạo.
- Parameter properties (`constructor(public r: number)`) **không** erasable cho Node type strip — tránh khi `erasableSyntaxOnly`.

```ts
class A {
  #secret = 1;      // JS private thật
  private tsOnly = 2; // TS — erase visibility
}
```

**Bẫy class:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Tin `private` TS đủ | vẫn enumerable/accessible sau emit tùy cách | `#field` khi cần runtime |
| Quên `super()` trước `this` | ReferenceError | `super()` đầu constructor derived |
| `this` trong callback | mất receiver | arrow / `bind` |
| `new` quên | `this` sai / undefined strict | bắt `new.target` |
| Param properties + strip | không chạy `node file.ts` | field tường minh |

Xem [oop.md](oop.md).

---

## 5. Module: `import` / `export`

```ts
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import type { Dirent } from "node:fs";
import cfg, { port as listenPort } from "./config.js";

export const VERSION = "1.0.0";
export default function main() {}
export { Circle as Disk };
export type { Point };
```

- ESM: extension `.js` trong import path thường **bắt buộc** với `NodeNext` dù source `.ts`.
- `import type` / `export type` erase hoàn toàn — an toàn type strip + `verbatimModuleSyntax`.
- `import()` động trả Promise; hỗ trợ TLA.
- CJS: `require` / `module.exports` — API runtime, không phải keyword TS.

```js
// CJS
const fs = require("node:fs");
module.exports = { fs };
```

**Bẫy module:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Import value chỉ để lấy type | giữ binding runtime | `import type` |
| Thiếu `.js` trong relative | ERR_MODULE_NOT_FOUND | `NodeNext` + đuôi `.js` |
| Side-effect import vô ý | chạy module | import tường minh |
| Default + named lẫn CJS interop | `esModuleInterop` / Node rules | biết synthetic default |
| `export type` lẫn value | emit/strip lệch | tách type-only |

Xem [modules-packages.md](modules-packages.md).

---

## 6. Điều khiển luồng

`if` / `else` / `switch` / `case` / `default` / `for` / `while` / `do` / `break` / `continue` — hình thức đầy đủ: [statements.md](statements.md).

Bẫy keyword-level: `for...in` trên array → `for...of`; quên `break` trong `switch`; union thiếu `never` exhaustive.

---

## 7. Exception: `try` / `catch` / `finally` / `throw`

```ts
try {
  throw new Error("boom");
} catch (e) {
  if (e instanceof Error) console.error(e.message);
  else throw e;
} finally {
  cleanup();
}
```

- `throw` mọi giá trị — nên `Error` / subclass.
- Optional catch binding: `catch { }` khi không dùng.
- TS `useUnknownInCatchVariables`: `e` là `unknown`.
- `finally` luôn chạy (trừ process kill cứng); **`return`/`throw` trong `finally` ghi đè** completion đang pending — anti-pattern.

**Bẫy:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `catch (e)` kiểu `any` cũ | mất an toàn | `unknown` + narrow |
| `return` trong `finally` | nuốt lỗi / đổi giá trị trả | chỉ cleanup |
| `throw "string"` | khó `instanceof` | `new Error` |
| Catch rồi nuốt | debug khó | log + rethrow / xử lý đủ |

Xem [exceptions.md](exceptions.md), [statements.md](statements.md).

---

## 8. Toán tử-từ khóa

`typeof` / `instanceof` / `in` / `void` / `delete` — hành vi đầy đủ: [operators.md](operators.md).

```ts
type T = typeof config; // type position
if (typeof x === "string") {
  x.toUpperCase();
}
```

- `typeof` value vs type position khác nghĩa.
- `void` operator ≠ annotation `void` return type.
- `in` / `delete` dễ bẫy prototype / sparse — prefer `Object.hasOwn`, tránh `delete` array.

---

## 9. Giá trị: `true` / `false` / `null` / `undefined`

```ts
const ok: boolean = true;
const z: null = null;
let u: undefined = undefined;
```

- `undefined` vừa giá trị vừa kiểu TS; `null` giá trị + kiểu `null`.
- Trong JSON: `null` có; `undefined` bị omit hoặc không hợp lệ tùy chỗ.
- Keyword `null`; `undefined` là global binding (có thể shadow — đừng).

---

## 10. TypeScript — kiểu

`type` / `interface` / `enum` / `namespace` / `declare` / `abstract` / `readonly` / `keyof` / `infer` / `satisfies` / `asserts` / `is` — chi tiết hệ thống kiểu: [typesystem.md](typesystem.md).

```ts
type ID = string | number;
interface User { id: ID; name: string }

declare const MAGIC: string;
abstract class Base {
  abstract run(): void;
  readonly id: string = crypto.randomUUID();
}

type Elem<T> = T extends (infer U)[] ? U : never;
const routes = { home: "/" } satisfies Record<string, string>;

function isStr(x: unknown): x is string {
  return typeof x === "string";
}
function assertStr(x: unknown): asserts x is string {
  if (typeof x !== "string") throw new Error();
}
```

- Prefer union + `as const` hơn `enum` / tránh `namespace` runtime khi Node type strip + `erasableSyntaxOnly`.
- `satisfies` / predicates **erase** — không thay validate I/O; predicate sai → TS tin nhầm.

---

## 11. TypeScript — modifier & type-only

```ts
class Service {
  public name: string = "";
  protected url: string = "";
  private token: string = "";
  #runtimePrivate = true;

  override toString(): string {
    return this.name;
  }
}

import type { User } from "./user.js";
export type { User };
```

- Visibility TS erase; `#field` mới private runtime.
- `override` + `noImplicitOverride` bắt khớp member base.
- `verbatimModuleSyntax`: type-only phải `import type` / `export type` rõ.
- `implements` / `readonly` / `public`… không còn sau emit (trừ khi kèm giá trị thật).

---

## 12. Resource management: `using` / `await using`

Explicit Resource Management: đăng ký `[Symbol.dispose]` / `[Symbol.asyncDispose]`. Có trong JS hiện đại + TS; **V8/Node 26** hỗ trợ ngữ pháp; **không** suy ra mọi API Node đã implement symbol — nhiều chỗ vẫn `.close()` thủ công hoặc cần wrapper.

```ts
class FileHandle implements Disposable {
  constructor(private path: string) {}
  [Symbol.dispose]() {
    console.log("close", this.path);
  }
}

{
  using f = new FileHandle("./x.txt");
  // ...
} // dispose khi rời block

await using db = await openDb(); // AsyncDisposable — minh họa
```

- Stack dispose: **LIFO** khi nhiều `using` cùng block.
- Lỗi body + dispose → có thể `SuppressedError` (`.error` / `.suppressed`).
- `await using` trong async function / TLA context.
- Lib/types: `Disposable`, `Symbol.dispose` (target/lib đủ mới).

```ts
{
  using a = open();
  using b = open();
} // dispose b rồi a
```

**Bẫy `using`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Kỳ vọng `fs` trả Disposable sẵn | nhiều API chưa | wrapper `[Symbol.dispose]` gọi `close()` |
| Quên `await using` cho async | dispose sync trên async resource | `await using` |
| Dispose ném nuốt lỗi gốc | SuppressedError | inspect `.suppressed` |
| `using` ngoài block hợp lệ | binding scope | dùng block `{ }` tường minh |

Xem [statements.md](statements.md) § resource.

---

## 13. Khác: `debugger` / `with` / `of` / `get` / `set`

```ts
debugger; // breakpoint khi attach inspector (`node --inspect`)

// with (obj) { }  — cấm trong strict / ESM; không dùng

for (const n of [1, 2, 3]) {}

const obj = {
  get value() {
    return 1;
  },
  set value(v: number) {
    /* ... */
  },
};

async function* stream() {
  yield await Promise.resolve(1);
}
```

- `of` contextual trong `for...of`.
- `get`/`set` contextual trong object/class.
- `with` — **cấm** ESM; gây tối nghĩa — không bao giờ dùng.

---

## 14. Reserved vs contextual

| Nhóm | Ví dụ |
|------|--------|
| Reserved luôn | `class`, `const`, `let`, `function`, `return`, `throw`, `typeof`, … |
| Contextual | `async`, `await`, `from`, `of`, `satisfies`, `override`, `get`, `set`, `type` (TS), `implements`, `using` |
| TS-only (erase) | `interface`, `type`, `implements`, `private`, `readonly`, `declare`, `abstract`, `satisfies`, `keyof`, `infer` |
| Tránh | `with`, `var` (code mới), numeric `enum` + strip |

> Đặt tên: tránh reserved; contextual ngoài ngữ cảnh đặc biệt đôi khi đặt được — vẫn tránh (`await` làm tên trong module async dễ lỗi).

---

## 15. Best practices

1. `const` mặc định; `let` khi cần; không `var` / `with`.
2. ESM + `import type` / `export type` với `verbatimModuleSyntax`.
3. `async`/`await` rõ; TLA chỉ boot — [async.md](async.md).
4. `#private` khi cần encapsulation runtime; tránh param properties / `enum` nếu strip.
5. `using`/`await using` khi có dispose protocol; không thì `try`/`finally` + `close()`.
6. `catch` với `unknown`; không `return` trong `finally`.

---

## 16. Checklist

```text
□ Không var / with / enum runtime trên đường node *.ts?
□ let/const không đọc trong TDZ? import type đủ?
□ async: mọi Promise có await hoặc bắt lỗi?
□ private runtime → #field? finally chỉ cleanup?
□ using/await using đúng sync vs async dispose?
```

---

## 17. Cheat sheet

| Keyword / dạng | Việc |
|----------------|------|
| `const` / `let` | block binding; TDZ |
| `function*` / `async` / `await` | generator / Promise |
| `class` / `extends` / `#field` | OOP + private runtime |
| `import` / `export` / `import type` | ESM (+ erase) |
| `try` / `catch` / `finally` / `throw` | lỗi |
| `using` / `await using` | dispose LIFO |
| `satisfies` / `is` / `asserts` | TS narrowing |

---

## 18. Version notes

| Giai đoạn | Liên quan keyword |
|-----------|-------------------|
| ES2015 | `let`/`const`/`class`/`import`/`export`/`yield` |
| ES2017–18 | `async`/`await`; async generators |
| ES2020–22 | TLA; `#private` |
| ERM (JS + TS) | `using` / `await using` / `Disposable` |
| TS 4.3+ / 4.9+ / 5.8+ | `override`; `satisfies`; `erasableSyntaxOnly` |
| Node 26 | strip ổn định (chỉ erasable); kiểm tra API có Disposable chưa |

Baseline: **Node 26** + **TS 7**.

---

## 19. Tài liệu liên quan

- [statements.md](statements.md) — hình thức phát biểu, `using`, ASI
- [operators.md](operators.md) — `typeof`/`delete`/`void`/`in`
- [typesystem.md](typesystem.md) — `satisfies`, predicates, strip
- [async.md](async.md) — async/await sâu
- [exceptions.md](exceptions.md) — throw/catch
- [modules-packages.md](modules-packages.md) — import/export
- [oop.md](oop.md) — class
- [literals.md](literals.md) — `true`/`null`/const object
- [node26-ts7.md](node26-ts7.md) — baseline
