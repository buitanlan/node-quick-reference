# Keywords

Từ khóa và từ khóa ngữ cảnh (contextual) quan trọng của **JavaScript** và **TypeScript 7**, dùng trên **Node.js 26**. Phong cách: **mục đích → ví dụ → bẫy theo từ khóa** — không liệt kê máy móc mọi reserved word lịch sử. Tập trung ESM + TS hàng ngày + Explicit Resource Management.

---

## Mục lục

- [1. `let` / `const` và TDZ](#1-let--const-và-tdz)
- [2. `var` — function-scope](#2-var--function-scope)
- [3. `class` TDZ & OOP keywords](#3-class-tdz--oop-keywords)
- [4. `function` / `return` / `yield`](#4-function--return--yield)
- [5. `async` / `await`](#5-async--await)
- [6. `import type` / `export type`](#6-import-type--export-type)
- [7. `using` / `await using` + Disposable](#7-using--await-using--disposable)
  - [`for (using x of …)`](#for-using-x-of-)
- [8. `try` / `catch` / `finally` / `throw`](#8-try--catch--finally--throw)
- [9. `enum` / `namespace` vs type strip](#9-enum--namespace-vs-type-strip)
- [10. `debugger` / `with`](#10-debugger--with)
  - [`with` — cấm](#with--cấm)
- [11. Điều khiển luồng (keyword-level)](#11-điều-khiển-luồng-keyword-level)
- [12. Toán tử-từ khóa](#12-toán-tử-từ-khóa)
- [13. `true` / `false` / `null` / `undefined`](#13-true--false--null--undefined)
- [14. TypeScript: `type` / `interface` / `is` / `satisfies`](#14-typescript-type--interface--is--satisfies)
- [15. Modifier: `public` / `private` / `#` / `override`](#15-modifier-public--private----override)
- [16. Reserved vs contextual](#16-reserved-vs-contextual)
  - [`this` / `super` / `new` — bẫy keyword](#this--super--new--bẫy-keyword)
  - [`with` statement vs `with` import attributes](#with-statement-vs-with-import-attributes)
- [17. Best practices](#17-best-practices)
- [18. Checklist](#18-checklist)
- [19. Cheat sheet](#19-cheat-sheet)
- [20. Version notes](#20-version-notes)
- [21. Tài liệu liên quan](#21-tài-liệu-liên-quan)

---

## 1. `let` / `const` và TDZ

- **Loại:** reserved  
- **Mục đích:** binding block-scoped. `const` cấm **rebind**; object/array vẫn mutate được.

```ts
const PI = 3.14;
let count = 0;
count = 1;

const cfg = { port: 3000 };
cfg.port = 3001; // OK — không phải deep freeze
// cfg = {};    // TypeError
```

**TDZ (Temporal Dead Zone):** từ **đầu block** đến dòng khởi tạo, đọc/ghi `let`/`const` → `ReferenceError`. Khác `var` (hoist = `undefined`).

```ts
{
  // console.log(x); // ReferenceError — TDZ, không phải undefined
  let x = 1;
  console.log(x); // 1
}
```

TDZ áp dụng cả `typeof`:

```ts
{
  // typeof y; // ReferenceError
  let y = 1;
}
typeof notDeclaredAtAll; // "undefined" — identifier chưa khai báo, không TDZ
```

Closure bắt binding **theo lần lặp** với `let` trong `for`:

```ts
const fns: Array<() => number> = [];
for (let i = 0; i < 3; i++) {
  fns.push(() => i);
}
fns.map((f) => f()); // [0, 1, 2]
```

**Bẫy `let`/`const`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Dùng trước khai báo | TDZ `ReferenceError` | khai báo trên trước khi đọc |
| `typeof` trong TDZ | vẫn ném — khác undeclared | không “probe” bằng `typeof` |
| `const` = immutable sâu | chỉ cấm rebind | `Object.freeze` / `as const` nếu cần |
| Redeclare cùng scope | SyntaxError | tên khác / block |
| `const` thiếu init | SyntaxError | luôn khởi tạo |
| `const` trong `for` header | `for (const x of xs)` OK; `for (const i = 0; i < n; i++)` **sai** (`i++` rebind) | `let` khi cần tăng |
| Shadow block | biến ngoài “không đổi” | tên khác / tách hàm |

Prefer `const` mặc định, `let` khi cần gán lại. Hình thức statement: [statements.md](statements.md).

---

## 2. `var` — function-scope

`var` **function-scoped** (hoặc script-scoped), hoist binding + khởi tạo `undefined`. **Không** dùng trong ESM/TS mới.

```ts
function f() {
  if (false) {
    var x = 1;
  }
  console.log(x); // undefined — binding đã có, không TDZ
}

function g() {
  var i = 0;
  for (var i = 10; i < 12; i++) {} // cùng `i`
  console.log(i); // 12 — leak khỏi for
}
```

Closure + `var` trong `for` = **một** binding:

```ts
const fns: Array<() => number> = [];
for (var i = 0; i < 3; i++) {
  fns.push(() => i);
}
fns.map((f) => f()); // [3, 3, 3]
```

`var` redeclare cùng function **được** (im lặng) — che bug rename.

**Bẫy `var`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Hoist `undefined` | đọc trước thấy `undefined` | `let`/`const` — fail sớm |
| `for` + closure | mọi callback cùng `i` | `let` |
| Leak khỏi block | `if`/`for` không tạo scope `var` | `let`/`const` |
| Redeclare | nuốt trùng tên | `let` SyntaxError hữu ích |
| `var` ở module ESM | vẫn function/module scope lệch thói quen block | đừng dùng |

CJS legacy có thể còn `var`; migrate từng file, không hỗn hợp trong cùng hàm.

---

## 3. `class` TDZ & OOP keywords

Từ khóa liên quan: `class` / `extends` / `implements` / `super` / `static` / `this` / `new` / `constructor` (+ TS `abstract`, `override`, visibility).

**Class declaration có TDZ** — không hoist thân như `function`:

```ts
// new A(); // ReferenceError
class A {
  constructor(readonly n: number) {}
}
new A(1);
```

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
- `#private` (JS) khác `private` TS (compile-time only).
- Parameter properties (`constructor(public r: number)`) **không** erasable cho Node type strip — tránh khi `erasableSyntaxOnly`.
- Derived constructor: `super()` **trước** `this`.
- Class expression `const C = class {}` cũng TDZ theo binding `const`.
- `static {}` initialization block chạy khi evaluate class — cũng nằm sau TDZ của tên class, có thể đọc `this` (constructor function) / static fields đã init phía trên.

```ts
class Counter {
  static #n = 0;
  static {
    Counter.#n = 1; // OK — class binding đã init khi chạy block
  }
}
```

```ts
class A {
  #secret = 1;        // JS private thật
  private tsOnly = 2; // TS — erase visibility
}
```

**Bẫy `class`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Gọi class trước dòng | TDZ | khai báo trên |
| Tin `private` TS đủ | accessible sau emit | `#field` khi cần runtime |
| Quên `super()` trước `this` | ReferenceError | `super()` đầu constructor derived |
| `this` trong callback | mất receiver | arrow / `bind` — [functions-methods.md](functions-methods.md) |
| `new` quên trên `function` | `this` sai / undefined strict | class (bắt buộc `new`) / `new.target` |
| Param properties + `node file.ts` | không strip được | field tường minh |
| `implements` nghĩ là guard | erase | schema / type guard |

Xem [oop.md](oop.md).

---

## 4. `function` / `return` / `yield`

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

- `function` **declaration** hoist cả thân (gọi trước dòng trong cùng scope).
- `function` **expression** / arrow: binding theo `const`/`let` → TDZ.
- Không `return` ⇒ `undefined`; `return` sau ASI → `return;` — [statements.md](statements.md).
- `yield` chỉ trong generator (`function*` / `async function*`); `yield*` ủy quyền.
- `yield` là **biểu thức** (nhận giá trị `.next(x)`); ngoặc khi trộn toán tử — [operators.md](operators.md).
- `yield*` ủy quyền: iterate inner, forward `.return()` / `.throw()` theo protocol generator.

```ts
function* inner() {
  yield 1;
  yield 2;
}
function* outer() {
  const last = yield* inner(); // last = return value của inner (undefined nếu không return)
  yield last;
}

const it = range(2);
it.next();        // { value: 0, done: false }
it.next();        // { value: 1, done: false }
it.return?.(99);  // đóng generator — chạy `finally` bên trong nếu có
```

```ts
// add(1, 2); OK nếu add là function declaration phía dưới

const mul = function (a: number, b: number) {
  return a * b;
};
// mul trước dòng này → TDZ
```

**Bẫy:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Nhầm declaration vs expression | `const f = function(){}` không hoist | biết chỗ gọi |
| `return` xuống dòng | ASI → `undefined` | cùng dòng / ngoặc `(` |
| `yield` ngoài generator | SyntaxError | `function*` |
| `yield` xuống dòng | ASI giống `return` | cùng dòng |
| Generator sync vs async | `yield` vs `await` + `yield` | `async function*` khi I/O |
| `return` trong `finally` | ghi đè — §8 | chỉ cleanup |
| `return` object trong constructor | thay `this` | [statements.md](statements.md) |

---

## 5. `async` / `await`

```ts
async function load(url: string): Promise<string> {
  const res = await fetch(url);
  return res.text();
}

const text = await load("https://example.com"); // top-level await: ESM
```

- `async` function **luôn** trả `Promise` (kể cả `return` sync / `throw` → reject).
- `await` dừng tới settle; chỉ trong `async` hoặc **top-level await** ESM.
- `await` thenable (`.then`) không phải `Promise` vẫn theo protocol.
- `await using` — **khác** `await` đơn — mục 7: đây là **declaration**, không phải đợi Promise thường.
- `async` là contextual: đặt tên biến `async` ngoài vị trí function đôi khi được — vẫn tránh.
- Top-level `await` **chỉ ESM**; CJS `require` graph không TLA. Module có TLA làm importer **đợi** (async module).

```ts
// entry.ts
const cfg = await loadConfig(); // TLA OK
export { cfg };
```

```ts
async function f() {
  return 1; // Promise.resolve(1)
}
f() instanceof Promise; // true

await 1;              // 1 — wrap non-thenable
await { then() {} };  // thenable
```

**Bẫy `async`/`await`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Quên `await` | Promise “treo” / race / `void` vô tình | await hoặc void+catch có chủ đích |
| `async` trong `new Promise` | anti-pattern | [async.md](async.md) |
| `await` trong vòng tuần tự chậm | waterfall | `Promise.all` / pool |
| TLA trong lib xuất | side effect import | TLA chỉ entry/config |
| Catch nuốt lỗi | `try/catch` rộng | bắt hẹp / rethrow |
| `await` trên sync generator | không iterate async | `for await` + async iterable |
| Nhầm `await using` | không phải `await resource` | mục 7 |
| `return await x` vs `return x` | khác stack/microtask nhẹ; `return await` trong `try` **cần** để catch reject | `try { return await x }` |

Chi tiết concurrency: [async.md](async.md), [event-loop.md](event-loop.md).

---

## 6. `import type` / `export type`

```ts
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import type { Dirent } from "node:fs";
import { type Stats } from "node:fs"; // inline type-only (verbatim)
import cfg, { port as listenPort } from "./config.js";

export const VERSION = "1.0.0";
export default function main() {}
export { Circle as Disk };
export type { Point };
export type { User as PublicUser } from "./user.js";
```

- ESM: extension `.js` trong import path thường **bắt buộc** với `NodeNext` dù source `.ts`.
- `import type` / `export type` **erase hoàn toàn** — an toàn type strip + `verbatimModuleSyntax`.
- `import { type X, y }` — `X` erase, `y` runtime.
- `export type * from "./mod.js"` không tồn tại như value `export *`; type re-export dùng `export type { A, B } from "./mod.js"`.
- `import()` động trả Promise; hỗ trợ TLA.
- CJS: `require` / `module.exports` — API runtime, không phải keyword TS.

```js
// CJS
const fs = require("node:fs");
module.exports = { fs };
```

**Bẫy module keywords:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Import value chỉ để lấy type | giữ binding runtime; circular / strip lệch | `import type` |
| Thiếu `.js` relative | `ERR_MODULE_NOT_FOUND` | `NodeNext` + đuôi `.js` |
| Side-effect import vô ý | chạy module | import tường minh |
| Default + named lẫn CJS interop | `esModuleInterop` / Node rules | biết synthetic default |
| `export type` lẫn value | emit/strip lệch | tách type-only |
| `verbatimModuleSyntax` + `import { Type }` | lỗi — Type bị coi value | `import type` / `type` modifier |
| `import type` rồi dùng làm giá trị | TS error | import value |
| Enum import như type-only | enum **là** value nếu emit | tránh enum — mục 9 |

Xem [modules-packages.md](modules-packages.md), [tsconfig.md](tsconfig.md).

---

## 7. `using` / `await using` + Disposable

Explicit Resource Management (ERM): binding block-scoped, dispose khi rời scope. Node **26** / V8: ngữ pháp + `Symbol.dispose` / `Symbol.asyncDispose` + `DisposableStack` / `AsyncDisposableStack` + `SuppressedError`.

**Không** suy ra mọi API Node đã implement symbol — nhiều chỗ vẫn `.close()` / `.destroy()`; bọc wrapper.

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
} // dispose khi rời block — kể cả throw
```

```ts
class Conn implements AsyncDisposable {
  async [Symbol.asyncDispose]() {
    await this.close();
  }
  async close() {
    /* native .close() */
  }
}

async function query() {
  await using db = new Conn();
}
```

| Declaration | Yêu cầu giá trị | Khi nào |
|-------------|-----------------|---------|
| `using x = …` | `null` / `undefined` / `[Symbol.dispose]` | sync cleanup |
| `await using x = …` | `null` / `undefined` / `[Symbol.asyncDispose]` hoặc fallback `[Symbol.dispose]` | async function / TLA |

- Stack dispose: **LIFO** khi nhiều `using` cùng block.
- Lỗi body + dispose → `SuppressedError` (`.error` lỗi mới hơn, `.suppressed` lỗi bị che — đọc cả hai).
- `using` giống `const`: không rebind; TDZ đến init.
- `await using` trong vòng: dispose **mỗi** iteration trước vòng sau.

```ts
{
  using a = openA();
  using b = openB();
} // dispose b rồi a
```

Wrapper khi stdlib chỉ có `.close()`:

```ts
import fs from "node:fs/promises";

async function openTracked(path: string) {
  const fh = await fs.open(path);
  return {
    fh,
    async [Symbol.asyncDispose]() {
      await fh.close();
    },
  };
}

async function processFile(p: string) {
  await using tracked = await openTracked(p);
  await tracked.fh.readFile("utf8");
}
```

Một số handle Node hiện đại **có thể** đã có `[Symbol.asyncDispose]` (gọi `close`) — kiểm tra docs **đúng major**; không giả định mọi `EventEmitter` / socket.

`DisposableStack` gom cleanup (cũng là `Disposable`):

```ts
{
  using stack = new DisposableStack();
  stack.defer(() => console.log("last"));
  const r = stack.use(new FileHandle("./x"));
  // stack.adopt(raw, (v) => v.close()) — giá trị không có Symbol.dispose
}
```

| Method | Việc |
|--------|------|
| `use(disposable)` | đăng ký `Disposable`; dispose LIFO khi stack dispose |
| `adopt(value, onDispose)` | bọc giá trị **không** có `Symbol.dispose` |
| `defer(onDispose)` | callback cleanup, không kèm value |
| `move()` | chuyển ownership — stack cũ emptied, không dispose khi rời |
| `dispose()` / `[Symbol.dispose]()` | chạy ngay |

`AsyncDisposableStack`: `use`/`adopt`/`defer`/`move` + `[Symbol.asyncDispose]`. Dùng khi gom nhiều handle `.close()` async trong một scope.

```ts
async function withMany(paths: string[]) {
  await using stack = new AsyncDisposableStack();
  for (const p of paths) {
    const fh = await fs.open(p);
    stack.adopt(fh, (f) => f.close());
  }
} // close LIFO
```

`move()` khi factory mở resource rồi trả ra ngoài — caller nhận stack đã move, callee không dispose sớm.

### `for (using x of …)`

ERM cho phép `using` trong header `for...of` — dispose **mỗi** phần tử khi kết thúc iteration (kể cả `continue`):

```ts
function* files(): Generator<FileHandle> {
  yield new FileHandle("a.txt");
  yield new FileHandle("b.txt");
}

for (using f of files()) {
  // f.dispose khi xong vòng này, rồi lấy phần tử sau
}
```

```ts
async function walk(resources: AsyncIterable<Conn>) {
  for await (await using c of resources) {
    await c.query();
  }
}
```

- `for (await using x of syncIterable)` — mỗi value async-dispose (nếu protocol có).
- Không viết `for (using x in obj)` — `in` không phải iterator ERM.
- Body `return`/`throw` vẫn dispose phần tử hiện tại rồi mới thoát.
- `for (using x of xs)` yêu cầu từng `x` nullish hoặc `Disposable` — giống declaration.

Xem [statements.md](statements.md) vòng lặp + resource.

**Bẫy `using`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Kỳ vọng `fs.open` luôn Disposable | nhiều API chỉ `.close()` | wrapper `[Symbol.asyncDispose]` |
| `using` trên async resource | dispose sync trên Promise close | `await using` |
| Quên `await` factory | `using x = open()` khi `open` async | `await using x = await open()` |
| Dispose ném nuốt lỗi gốc | `SuppressedError` | inspect `.error` / `.suppressed` |
| `using` ngoài block hợp lệ | binding sống dài (cả hàm) | `{ }` tường minh |
| Bound/proxy dispose function | V8 có thể từ chối “không phải function” | method thật trên object, đừng `.bind` symbol |
| Nhầm `await using` với `await` | syntax declaration | không `await using` như expression |
| `null` resource | `using x = null` OK (no-op) | hữu ích nhánh tùy chọn |

Xem [statements.md](statements.md) § resource.

---

## 8. `try` / `catch` / `finally` / `throw`

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

- `throw` mọi giá trị — nên `Error` / subclass (`cause` option).
- Optional catch binding: `catch { }` khi không dùng.
- TS `useUnknownInCatchVariables`: `e` là `unknown`.
- `finally` luôn chạy (trừ process kill cứng); **`return`/`throw`/`break` trong `finally` ghi đè** completion đang pending — anti-pattern.

```ts
function bad(): number {
  try {
    return 1;
  } finally {
    return 2; // caller nhận 2
  }
}
```

**Bẫy:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `catch (e)` kiểu `any` cũ | mất an toàn | `unknown` + narrow |
| `return` trong `finally` | nuốt lỗi / đổi giá trị | chỉ cleanup |
| `throw "string"` | khó `instanceof` | `new Error` |
| Catch rồi nuốt | debug khó | log + rethrow / xử lý đủ |
| `instanceof Error` qua realm | fail | `Array.isArray`-style: brand / `error.code` |
| `throw` xuống dòng | ASI | cùng dòng |

Xem [exceptions.md](exceptions.md), [statements.md](statements.md).

---

## 9. `enum` / `namespace` vs type strip

Node 26: `node file.ts` **chỉ** erasable syntax. `enum`, `namespace` runtime, parameter properties **không** strip — cần `tsc`/bundler. `erasableSyntaxOnly` bắt lỗi lúc biên dịch.

```ts
// KHÔNG erasable — đừng trên đường node *.ts
enum Color {
  Red,
  Blue,
}
namespace Util {
  export function f() {
    return 1;
  }
}
```

```ts
// Erasable
const Color = { Red: "red", Blue: "blue" } as const;
type Color = (typeof Color)[keyof typeof Color];

const Util = {
  f() {
    return 1;
  },
};
```

| Cú pháp | Runtime | `node *.ts` |
|---------|---------|-------------|
| Numeric / string `enum` | object (+ reverse map numeric) | **Không** |
| `const enum` | inline (tsc) | **Không** / nguy hiểm isolated |
| `namespace` / `module` có lệnh | object | **Không** |
| `declare namespace` (ambient) | không emit | OK nếu chỉ types |
| Union + `as const` object | object thường | **OK** |
| `type` / `interface` | erase | **OK** |

- Numeric enum: `Color[0] === "Red"` reverse map — union string không có.
- `namespace` merge với `interface` cùng tên — pattern legacy; tránh với strip.
- Chi tiết: [typesystem.md](typesystem.md) § enum.

```ts
enum Legacy {
  A, // 0
  B, // 1
}
Legacy[0]; // "A" — reverse mapping (numeric only)
Legacy.A;  // 0

const Kind = { A: "A", B: "B" } as const;
type Kind = (typeof Kind)[keyof typeof Kind];
Kind.A; // "A" — không có Kind[0]
```

`declare enum` / `declare namespace` chỉ types: hợp lệ strip **nếu** không emit giá trị — runtime phải có global/import thật.

**Bẫy enum/namespace:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `enum` + type strip | Syntax/transform không còn | const object |
| `const enum` + isolated | giá trị biến mất / lệch | union |
| `import { Color }` type-only trong khi enum value | runtime `undefined` nếu emit lệch | không enum |
| `namespace` + `export` hàm | không erasable | object / ESM |

---

## 10. `debugger` / `with`

```ts
debugger; // breakpoint khi attach inspector (`node --inspect`)
```

- `debugger` là statement; **no-op** nếu không có debug hook — không thay logging.
- Bundler production đôi khi strip; đừng dựa `debugger` làm feature flag.

### `with` — cấm

```ts
// with (obj) { console.log(x) }  — cấm trong strict / ESM
```

- `with (obj)` thêm object vào scope chain — identifier `x` có thể là `obj.x` hoặc biến ngoài: **không tối ưu được**, không phân tích tĩnh.
- **SyntaxError trong strict mode**. ESM **luôn** strict → `with` **không tồn tại** trên đường Node module hiện đại.
- Sloppy CJS cũ còn parse được — **không bao giờ** dùng; không “polyfill” bằng `with`.
- `import … with { type: "json" }` **không** phải statement `with` — mục 16 (import attributes).

**Bẫy:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Copy snippet `with` | SyntaxError ESM | destructure / `obj.x` |
| `debugger` production im lặng | tưởng đã dừng | `--inspect` + DevTools |
| `eval` + `with` | còn tệ hơn | không |

---

## 11. Điều khiển luồng (keyword-level)

`if` / `else` / `switch` / `case` / `default` / `for` / `while` / `do` / `break` / `continue` — hình thức đầy đủ: [statements.md](statements.md).

Bẫy **từ khóa** (không lặp lại toàn bộ statement):

| Keyword | Bẫy | Cách đúng |
|---------|-----|-----------|
| `for...in` | inherited keys; array index string | `for...of` + `hasOwn` |
| `switch` | quên `break`; `case` dùng `===` | `return` / comment fall-through |
| `default` | nuốt union mới | `assertNever` |
| `break` | trong `switch` không thoát `for` | label / tách hàm |
| `of` | contextual — chỉ `for...of` | không phải toán tử membership (`in`) |

`of` / `from` / `as` (import) là **contextual** — không phải reserved mọi chỗ.

---

## 12. Toán tử-từ khóa

`typeof` / `instanceof` / `in` / `void` / `delete` — hành vi đầy đủ: [operators.md](operators.md).

```ts
type T = typeof config; // type position — erase
if (typeof x === "string") {
  x.toUpperCase();
}
```

**Bẫy keyword-ops:**

| Keyword | Bẫy | Cách đúng |
|---------|-----|-----------|
| `typeof` | `null` → `"object"`; TDZ ném | `=== null`; khai báo trước |
| `typeof` value vs type | hai ngữ nghĩa | [typesystem.md](typesystem.md) |
| `void` operator vs `void` return | khác nhau | operator: `void 0`; type: không dùng giá trị trả |
| `in` | prototype | `Object.hasOwn` |
| `delete` | sparse / non-configurable | `splice` / omit |
| `instanceof` | realm | `Array.isArray` / brand |

---

## 13. `true` / `false` / `null` / `undefined`

```ts
const ok: boolean = true;
const z: null = null;
let u: undefined = undefined;
```

- `undefined` vừa giá trị vừa kiểu TS; `null` giá trị + kiểu `null`.
- JSON: `null` có; `undefined` bị omit hoặc không hợp lệ tùy chỗ.
- Keyword `null`; `undefined` là global binding (có thể shadow — đừng). `void 0` an toàn hơn khi paranoid.

**Bẫy:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `if (x)` với `0` | falsy | `x != null` / `===` |
| `typeof null` | `"object"` | `=== null` |
| Shadow `undefined` | `const undefined = 1` | không bao giờ; `void 0` |
| Optional `?` vs `| undefined` | hơi khác assignability | [typesystem.md](typesystem.md) |

---

## 14. TypeScript: `type` / `interface` / `is` / `satisfies`

`type` / `interface` / `declare` / `abstract` / `readonly` / `keyof` / `infer` / `satisfies` / `asserts` / `is` — chi tiết: [typesystem.md](typesystem.md).

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

- `type` / `interface` erase; `interface` có thể merge — `type` thì không.
- `satisfies` / predicates **erase** — không thay validate I/O; predicate sai → TS tin nhầm.
- `declare` ambient: không emit giá trị — runtime `MAGIC` phải có thật (global / import).

**Bẫy TS keywords:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `is` return luôn `true` | narrowing độc | implement runtime đúng |
| `satisfies` nghĩ freeze | chỉ check | `as const` nếu cần hẹp |
| `declare` thiếu runtime | `undefined` lúc chạy | import / polyfill |
| `interface` merge vô ý | hai file cùng tên | `type` alias |

---

## 15. Modifier: `public` / `private` / `#` / `override`

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

- Visibility TS (`public`/`private`/`protected`) **erase**; `#field` mới private runtime.
- `override` + `noImplicitOverride` bắt khớp member base.
- `readonly` TS erase (trừ `const`); runtime vẫn ghi được nếu không freeze.
- Parameter properties = visibility + binding — **không** erasable.

**Bẫy modifier:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `private` nghĩ ẩn khỏi `obj["token"]` | vẫn access JS | `#token` |
| Quên `override` | đổi tên base im lặng | `noImplicitOverride` |
| `readonly` + mutate object lồng | chỉ top-level TS | `as const` / freeze |
| Mix `#` và `private` cùng ý | hai hệ | chọn một; `#` cho secret |

---

## 16. Reserved vs contextual

| Nhóm | Ví dụ |
|------|--------|
| Reserved luôn | `class`, `const`, `let`, `function`, `return`, `throw`, `typeof`, `with`, … |
| Contextual | `async`, `await`, `from`, `of`, `as`, `satisfies`, `override`, `get`, `set`, `type` (TS), `implements`, `using` |
| TS-only (erase) | `interface`, `type`, `implements`, `private`, `readonly`, `declare`, `abstract`, `satisfies`, `keyof`, `infer` |
| Tránh | `with`, `var` (code mới), numeric `enum` + strip |

```ts
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

- `get`/`set` contextual trong object/class.
- Đặt tên: tránh reserved; contextual ngoài ngữ cảnh đặc biệt đôi khi đặt được — vẫn tránh (`await` làm tên trong module async dễ lỗi).
- Future reserved (`enum` từng là reserved JS nhưng TS dùng) — đừng đặt tên `enum` / `await` / `yield`.

**Bẫy đặt tên:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `const type = 1` trong TS | xung đột contextual | tên khác |
| `function get() {}` | OK nhưng nhiễu | tránh |
| Package `import` name clash | reserved | không |

### `this` / `super` / `new` — bẫy keyword

Không phải toán tử thuần; bẫy hay gặp khi trộn class + callback:

| Keyword | Bẫy | Cách đúng |
|---------|-----|-----------|
| `this` trong arrow | lexical — không phải receiver gọi | method shorthand khi cần dynamic `this` |
| `this` module ESM | `undefined` (strict) | không dùng `this` làm global |
| `super.x` ngoài class/object method | SyntaxError | chỉ derived method |
| `new` trên arrow | TypeError | `function` / `class` |
| `new.target` ngoài function | SyntaxError | constructor / `function` |
| `super()` hai lần | ReferenceError | một lần, trước `this` |

```ts
const obj = {
  n: 1,
  f() {
    return this.n;
  },
  g: () => {
    // this: lexical (module ESM → undefined)
  },
};

obj.f(); // 1
const detached = obj.f;
detached(); // TypeError hoặc undefined.n — mất receiver
```

Chi tiết `this`: [functions-methods.md](functions-methods.md). `new` + return object: [statements.md](statements.md).

### `with` statement vs `with` import attributes

Hai ngữ cảnh **khác nhau** — đừng cấm nhầm import attributes:

```ts
import cfg from "./cfg.json" with { type: "json" };
const mod = await import("./cfg.json", { with: { type: "json" } });
```

| Dạng | Hợp lệ ESM Node 26? |
|------|---------------------|
| `with (obj) { … }` | **Không** — SyntaxError strict |
| `import x from "./a.json" with { type: "json" }` | **Có** — import attributes |
| `import("./a.json", { with: { type: "json" } })` | **Có** |

Chi tiết attributes: [modules-packages.md](modules-packages.md).

---

## 17. Best practices

1. `const` mặc định; `let` khi cần; không `var` / `with`.
2. Hiểu TDZ: `let`/`const`/`class` — `typeof` không cứu được.
3. ESM + `import type` / `export type` với `verbatimModuleSyntax`.
4. `async`/`await` rõ; TLA chỉ boot — [async.md](async.md). Đừng nhầm `await using`.
5. `#private` khi cần encapsulation runtime; tránh param properties / `enum` / `namespace` runtime nếu strip.
6. `using`/`await using` khi có dispose protocol; không thì `try`/`finally` + `close()`.
7. `catch` với `unknown`; không `return` trong `finally`.
8. `debugger` chỉ khi inspect; không thay logger.
9. Keyword-ops: `Object.hasOwn`, `Array.isArray` — [operators.md](operators.md).
10. Per-keyword traps quan trọng hơn thuộc lòng danh sách reserved 1999.

---

## 18. Checklist

```text
□ Không var / with / enum runtime / namespace runtime trên đường node *.ts?
□ let/const/class không đọc trong TDZ? typeof không dùng để “thăm” TDZ?
□ import type / export type đủ? verbatimModuleSyntax sạch?
□ async: mọi Promise có await hoặc bắt lỗi? TLA không nằm lib?
□ private runtime → #field? param properties đã bỏ nếu strip?
□ using vs await using đúng sync/async? wrapper .close() nếu thiếu Symbol.dispose?
□ finally chỉ cleanup? throw Error không string?
□ debugger không phải feature production?
□ with statement không lẫn import attributes `with { type: "json" }`?
□ this/super/new đúng ngữ cảnh? generator .return() có finally?
```

---

## 19. Cheat sheet

| Keyword / dạng | Việc | Bẫy chính |
|----------------|------|-----------|
| `const` / `let` | block binding | TDZ |
| `var` | function scope | leak / closure `for` |
| `class` | OOP | TDZ; `super()`; `#` vs `private` |
| `function*` / `yield` | generator | ASI; ngoài `*` |
| `async` / `await` | Promise | quên await; TLA lib |
| `import type` / `export type` | erase | thiếu `type` + verbatim |
| `using` / `await using` | dispose LIFO | `.close()` wrapper; `SuppressedError` |
| `try` / `catch` / `finally` / `throw` | lỗi | `return` trong `finally` |
| `enum` / `namespace` | TS runtime | **không** strip |
| `debugger` / `with` | debug / cấm | ESM cấm `with`; attributes `with { type }` OK |
| `import … with` | JSON/module attributes | không phải `with` statement |
| `satisfies` / `is` / `asserts` | TS narrowing | erase; predicate sai |
| `this` / `super` / `new` | OOP call | TDZ class; mất receiver |
| `for (using of)` | dispose mỗi vòng | không `for...in`; LIFO từng phần tử |

```ts
const Color = { Red: "red" } as const;
type Color = (typeof Color)[keyof typeof Color];

{
  using stack = new DisposableStack();
  stack.defer(() => {});
}

import type { User } from "./user.js";
import data from "./cfg.json" with { type: "json" };
```

---

## 20. Version notes

| Giai đoạn | Liên quan keyword |
|-----------|-------------------|
| ES2015 | `let`/`const`/`class`/`import`/`export`/`yield` |
| ES2017–18 | `async`/`await`; async generators |
| ES2020–22 | TLA; `#private` |
| ES2022 | `Object.hasOwn` (API, không keyword) |
| ERM (JS + TS) | `using` / `await using` / `for (using of)` / `Disposable` / `DisposableStack` / `SuppressedError` |
| TS 4.3+ / 4.9+ / 5.8+ | `override`; `satisfies`; `erasableSyntaxOnly` |
| Node 26 | strip ổn định (chỉ erasable); ERM native (`using`, `DisposableStack`); **kiểm tra** API có Disposable chưa; Temporal không thuộc keyword |

Baseline: **Node 26** + **TS 7**.

---

## 21. Tài liệu liên quan

- [statements.md](statements.md) — hình thức phát biểu, `using`, ASI, `return` constructor
- [operators.md](operators.md) — `typeof`/`delete`/`void`/`in`/`instanceof`
- [typesystem.md](typesystem.md) — `satisfies`, predicates, strip, enum
- [async.md](async.md) — async/await sâu
- [exceptions.md](exceptions.md) — throw/catch
- [modules-packages.md](modules-packages.md) — import/export
- [oop.md](oop.md) — class
- [literals.md](literals.md) — `true`/`null`/const object
- [functions-methods.md](functions-methods.md) — `this`, generator
- [tsconfig.md](tsconfig.md) — `verbatimModuleSyntax`, `erasableSyntaxOnly`
- [abort-context.md](abort-context.md) — hủy khi `await` vòng I/O
- [nodejs-apis.md](nodejs-apis.md) — `.close()` trên handle khi wrap `using`
- [iterables-linq.md](iterables-linq.md) — `for...of` / generator / `yield*`
- [event-loop.md](event-loop.md) — microtask khi `await`
