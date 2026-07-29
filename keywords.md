# Keywords

Từ khóa và từ khóa ngữ cảnh (contextual) quan trọng của **JavaScript** và **TypeScript 7**, dùng trên **Node.js 26**. Phong cách tham chiếu: mục đích → ví dụ → ghi chú thực tế. Không liệt kê hết mọi reserved word lịch sử nếu ít dùng; tập trung những gì gặp hàng ngày khi viết ESM + TS.

---

## Mục lục

- [Keywords](#keywords)
  - [Mục lục](#mục-lục)
  - [1. Khai báo: `const` / `let` / `var`](#1-khai-báo-const--let--var)
  - [2. Hàm: `function` / `return` / `yield`](#2-hàm-function--return--yield)
  - [3. Bất đồng bộ: `async` / `await`](#3-bất-đồng-bộ-async--await)
  - [4. Lớp \& OOP: `class` / `extends` / `implements` / `super` / `static` / `this` / `new` / `constructor`](#4-lớp--oop-class--extends--implements--super--static--this--new--constructor)
  - [5. Module: `import` / `export` / `from` / `as` / `default`](#5-module-import--export--from--as--default)
  - [6. Điều khiển luồng: `if` / `else` / `switch` / `case` / `default` / `for` / `while` / `do` / `break` / `continue`](#6-điều-khiển-luồng-if--else--switch--case--default--for--while--do--break--continue)
  - [7. Exception: `try` / `catch` / `finally` / `throw`](#7-exception-try--catch--finally--throw)
  - [8. Toán tử-từ khóa: `typeof` / `instanceof` / `in` / `void` / `delete`](#8-toán-tử-từ-khóa-typeof--instanceof--in--void--delete)
  - [9. Giá trị: `true` / `false` / `null` / `undefined`](#9-giá-trị-true--false--null--undefined)
  - [10. TypeScript — kiểu: `type` / `interface` / `enum` / `namespace` / `declare` / `abstract` / `readonly` / `keyof` / `infer` / `satisfies` / `asserts` / `is`](#10-typescript--kiểu-type--interface--enum--namespace--declare--abstract--readonly--keyof--infer--satisfies--asserts--is)
  - [11. TypeScript — modifier \& directive: `public` / `private` / `protected` / `override` / `implements` / `import type` / `export type`](#11-typescript--modifier--directive-public--private--protected--override--implements--import-type--export-type)
  - [12. Resource management: `using` / `await using`](#12-resource-management-using--await-using)
  - [13. Khác: `debugger` / `with` / `of` / `get` / `set` / `async` generators](#13-khác-debugger--with--of--get--set--async-generators)
  - [14. Bảng nhanh reserved vs contextual](#14-bảng-nhanh-reserved-vs-contextual)

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

**Ghi chú:**  
TDZ (temporal dead zone) với `let`/`const` trước dòng khởi tạo. Prefer `const` mặc định, `let` khi cần gán lại; không dùng `var`.

---

## 2. Hàm: `function` / `return` / `yield`

```ts
function add(a: number, b: number): number {
  return a + b;
}

function* range(n: number) {
  for (let i = 0; i < n; i++) yield i;
}
```

- `function` declaration được hoist; expression thì không.  
- `return` thoát hàm; không `return` ⇒ `undefined`.  
- `yield` chỉ trong generator (`function*`); `yield*` ủy quyền iterable khác.

---

## 3. Bất đồng bộ: `async` / `await`

```ts
async function load(url: string): Promise<string> {
  const res = await fetch(url);
  return res.text();
}

const text = await load("https://example.com"); // top-level await: ESM
```

- `async` hàm luôn trả `Promise`.  
- `await` pause tới settle; chỉ trong `async` hoặc top-level ESM.  
- `await using` — xem mục 12 (khác `await` đơn).

---

## 4. Lớp & OOP: `class` / `extends` / `implements` / `super` / `static` / `this` / `new` / `constructor`

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

- `implements` chỉ TS (erase); không có runtime check.  
- `extends` một class; mixins bằng cách khác.  
- `#private` field (JS) khác `private` TS (chỉ compile-time).  
- `new.target` hữu ích factory/abstract pattern.

```ts
class A {
  #secret = 1; // JS private
  private tsOnly = 2; // TS — vẫn có thể lộ sau emit nếu không dùng # 
}
```

---

## 5. Module: `import` / `export` / `from` / `as` / `default`

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

- ESM: extension `.js` trong import path thường **bắt buộc** với NodeNext dù source là `.ts`.  
- `import type` / `export type` erase hoàn toàn — an toàn type strip.  
- CJS: `require` / `module.exports` — không phải keyword TS nhưng API runtime.

```js
// CJS
const fs = require("node:fs");
module.exports = { fs };
```

---

## 6. Điều khiển luồng: `if` / `else` / `switch` / `case` / `default` / `for` / `while` / `do` / `break` / `continue`

```ts
if (x > 0) {
  /* ... */
} else if (x < 0) {
  /* ... */
} else {
  /* ... */
}

switch (code) {
  case 200:
    break;
  case 404:
  case 410:
    break;
  default:
    break;
}

for (let i = 0; i < 3; i++) {}
for (const item of items) {}
for (const key in obj) {}
while (ok) {}
do {} while (ok);
```

- `for...of` — iterable; `for...in` — enumerable keys (kể cả prototype; thường kèm `Object.hasOwn`).  
- `break`/`continue` có thể kèm **label**.

---

## 7. Exception: `try` / `catch` / `finally` / `throw`

```ts
try {
  throw new Error("boom");
} catch (e) {
  // e: unknown với useUnknownInCatchVariables
  if (e instanceof Error) console.error(e.message);
} finally {
  cleanup();
}
```

- `throw` mọi giá trị — nên `Error`.  
- Optional catch binding: `catch { }` khi không dùng error.  
- `finally` luôn chạy (trừ khi process bị kill cứng).

---

## 8. Toán tử-từ khóa: `typeof` / `instanceof` / `in` / `void` / `delete`

Xem chi tiết [operators.md](operators.md). Tóm tắt TS:

```ts
type T = typeof config; // type position: lấy kiểu của value
type K = keyof T;

if (typeof x === "string") {
  x.toUpperCase();
}
```

- `typeof` value vs type position khác ngữ nghĩa.  
- `void` operator ≠ `void` return type annotation.

---

## 9. Giá trị: `true` / `false` / `null` / `undefined`

```ts
const ok: boolean = true;
const z: null = null;
let u: undefined = undefined;
```

- `undefined` vừa là giá trị vừa là kiểu TS.  
- `null` chỉ là giá trị; kiểu là `null`.

---

## 10. TypeScript — kiểu: `type` / `interface` / `enum` / `namespace` / `declare` / `abstract` / `readonly` / `keyof` / `infer` / `satisfies` / `asserts` / `is`

### `type` / `interface`

```ts
type ID = string | number;
interface User {
  id: ID;
  name: string;
}
```

### `enum` / `namespace`

```ts
enum Color {
  Red = "red",
  Blue = "blue",
}

namespace Legacy {
  export function helper() {}
}
```

- Prefer union + `as const` hơn `enum` khi dùng Node type stripping / `erasableSyntaxOnly`.  
- `namespace` (formerly internal modules) — hạn chế; dùng ESM.

### `declare`

```ts
declare const MAGIC: string;
declare function nativeApi(x: number): void;
declare module "some-untyped-pkg";
```

- Ambient: không emit runtime. Dùng trong `.d.ts` hoặc ambient blocks.

### `abstract` / `readonly`

```ts
abstract class Base {
  abstract run(): void;
  readonly id: string = crypto.randomUUID();
}
```

### `keyof` / `typeof` (type) / `infer`

```ts
type UserKeys = keyof User;
type Config = typeof config;

type Elem<T> = T extends (infer U)[] ? U : never;
```

### `satisfies`

```ts
const routes = {
  home: "/",
} satisfies Record<string, string>;
```

### `asserts` / `is` (type predicates)

```ts
function isStr(x: unknown): x is string {
  return typeof x === "string";
}

function assertStr(x: unknown): asserts x is string {
  if (typeof x !== "string") throw new Error();
}
```

---

## 11. TypeScript — modifier & directive: `public` / `private` / `protected` / `override` / `implements` / `import type` / `export type`

```ts
class Service {
  public name: string;
  protected url: string;
  private token: string;
  #runtimePrivate = true; // JS

  override toString(): string {
    return this.name;
  }
}
```

- Visibility TS erase; `#field` mới là private runtime.  
- `override` (TS 4.3+) bắt khớp member base khi `noImplicitOverride`.  
- `verbatimModuleSyntax`: phân biệt type-only import rõ ràng.

```ts
import type { User } from "./user.js";
export type { User };
```

---

## 12. Resource management: `using` / `await using`

Explicit Resource Management (JS + TS): đăng ký `[Symbol.dispose]` / `[Symbol.asyncDispose]`.

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
} // tự gọi dispose khi ra khỏi block

await using db = await openDb(); // AsyncDisposable
```

- Cần target/lib hỗ trợ (`ESNext` / `ES2025` + types phù hợp).  
- Node 26+: hỗ trợ rộng hơn cho dispose; kiểm tra API cụ thể (stream, handle) đã implement symbol chưa — nhiều API vẫn dùng `.close()` thủ công.  
- Stack dispose: LIFO khi nhiều `using` trong cùng block.  
- Lỗi trong dispose có thể gắn `SuppressedError`.

```ts
function open(): Disposable & { fd: number } {
  return {
    fd: 3,
    [Symbol.dispose]() {
      /* close */
    },
  };
}

{
  using a = open();
  using b = open();
} // dispose b rồi a
```

---

## 13. Khác: `debugger` / `with` / `of` / `get` / `set` / `async` generators

```ts
debugger; // breakpoint khi attach inspector

// with (obj) { }  — cấm trong strict / ESM; không dùng

for (const n of [1, 2, 3]) {
}

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

- `of` contextual trong `for...of` / `await using` contexts liên quan iteration.  
- `get`/`set` contextual trong object/class.

---

## 14. Bảng nhanh reserved vs contextual

| Nhóm | Ví dụ |
|------|--------|
| Reserved luôn | `class`, `const`, `let`, `function`, `return`, `throw`, `typeof`, … |
| Contextual | `async`, `await`, `from`, `of`, `satisfies`, `override`, `get`, `set`, `type` (TS), `implements` |
| TS-only (erase) | `interface`, `type`, `implements`, `private`, `readonly`, `declare`, `abstract`, `satisfies`, `keyof`, `infer` |
| Tránh | `with`, `var` (trong code mới), numeric `enum` + strip |

> Khi đặt tên biến/API: tránh reserved; contextual thường đặt tên được ngoài ngữ cảnh đặc biệt — vẫn nên tránh gây confuse (`await` làm tên trong module async có thể lỗi).
