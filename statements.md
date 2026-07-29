# Statements (Phát biểu) trong JavaScript / TypeScript

**Statement** là đơn vị thực thi (khác *expression* cho giá trị). Tài liệu tham chiếu theo **ES hiện đại + TypeScript 7** trên **Node.js 26** (ESM ưu tiên). Bao gồm Explicit Resource Management: `using` / `await using`.

---

## Mục lục

- [Statements (Phát biểu) trong JavaScript / TypeScript](#statements-phát-biểu-trong-javascript--typescript)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan \& phân loại](#1-tổng-quan--phân-loại)
  - [2. Khối `{ ... }`, scope \& TDZ](#2-khối----scope--tdz)
  - [3. Declaration statements](#3-declaration-statements)
    - [3.1 `const` / `let` / `var`](#31-const--let--var)
    - [3.2 Destructuring declaration](#32-destructuring-declaration)
    - [3.3 `using` / `await using` declarations](#33-using--await-using-declarations)
    - [3.4 Function \& class declarations](#34-function--class-declarations)
    - [3.5 `import` / `export`](#35-import--export)
  - [4. Expression statements](#4-expression-statements)
  - [5. Selection: `if` / `else`, `switch`](#5-selection-if--else-switch)
  - [6. Iteration: `while` / `do` / `for` / `for...of` / `for...in` / `for await...of`](#6-iteration-while--do--for--forof--forin--for-awaitof)
  - [7. Jump: `break` / `continue` / `return` / `throw` / labeled](#7-jump-break--continue--return--throw--labeled)
  - [8. `try` / `catch` / `finally`](#8-try--catch--finally)
  - [9. Explicit Resource Management (chi tiết)](#9-explicit-resource-management-chi-tiết)
  - [10. `with` (không dùng) \& `debugger`](#10-with-không-dùng--debugger)
  - [11. Empty statement \& strict mode](#11-empty-statement--strict-mode)
  - [12. Mẹo \& best practices](#12-mẹo--best-practices)

---

## 1. Tổng quan & phân loại

| Nhóm | Ví dụ |
|------|--------|
| Declaration | `const`/`let`, `function`, `class`, `using`, `import` |
| Expression | gọi hàm, gán, `await`, `++` |
| Selection | `if`, `switch` |
| Iteration | `for`, `while`, `for...of`, `for await...of` |
| Jump | `break`, `continue`, `return`, `throw` |
| Exception / resource | `try`/`catch`/`finally`, `using` |
| Misc | `debugger`, label, empty `;` |

Module ESM toàn bộ ở **strict mode** mặc định.

---

## 2. Khối `{ ... }`, scope & TDZ

```ts
const x = 1;
{
  const x = 2; // shadow — hợp lệ, nên tránh
  console.log(x); // 2
}
console.log(x); // 1
```

- `let`/`const`/`class` có **TDZ**: truy cập trước khởi tạo → `ReferenceError`.  
- `var` hoist + khởi tạo `undefined` — tránh.  
- Block của `if`/`for`/`while` tạo scope cho `let`/`const`.

```ts
for (let i = 0; i < 3; i++) {
  // mỗi iteration có binding i riêng (closure-friendly)
}
```

---

## 3. Declaration statements

### 3.1 `const` / `let` / `var`

```ts
const host = "127.0.0.1";
let port = 3000;
port = 3001;

// const obj = {}; obj.x = 1; // OK — const cấm rebind, không deep-freeze
```

- Một statement có thể khai báo nhiều binding: `let a = 1, b = 2;`.  
- `const` bắt buộc khởi tạo.

### 3.2 Destructuring declaration

```ts
const { name, age = 0 } = user;
const [first, ...rest] = items;
const { nested: { id } } = payload;
```

- Default & rest trong pattern.  
- Đổi tên: `{ name: userName }`.

### 3.3 `using` / `await using` declarations

```ts
{
  using resource = acquire();
  // resource[Symbol.dispose]() khi rời block
}

async function work() {
  await using conn = await connect();
  // conn[Symbol.asyncDispose]()
}
```

Chi tiết mục 9.

### 3.4 Function & class declarations

```ts
function helper() {}
async function load() {}
function* gen() {
  yield 1;
}
async function* agen() {
  yield await Promise.resolve(1);
}

class Service {
  run() {}
}
```

- Function declaration hoist (body khởi tạo sớm).  
- Class declaration không dùng trước TDZ kết thúc.  
- Trong TS: `abstract class`, parameter properties trong `constructor`.

### 3.5 `import` / `export`

Là module-level statements (không nằm trong block thường):

```ts
import { readFile } from "node:fs/promises";
export const VERSION = 1;
```

---

## 4. Expression statements

```ts
doWork();
x = 1;
x += 1;
await flush();
obj.method?.();
void queueMicrotask(() => {});
```

- Mọi expression có thể đứng một mình như statement (trừ một số bị hạn chế như bare `object literal` dễ nhầm block — dùng `({ a: 1 })` hoặc gán).  
- Prefer bỏ giá trị thừa bằng cách không dùng, hoặc `void` khi cố ý.

---

## 5. Selection: `if` / `else`, `switch`

```ts
if (status === "ok") {
  handleOk();
} else if (status === "retry") {
  handleRetry();
} else {
  handleOther();
}
```

- Điều kiện dùng truthiness; prefer so sánh tường minh với boolean/nullish khi cần.

```ts
switch (code) {
  case 200:
  case 201:
    return "ok";
  case 404:
    return "missing";
  default:
    return "other";
}
```

- `case` dùng `===`.  
- Fall-through có chủ đích cần comment; quên `break` là bug kinh điển.  
- TS: `switch` trên discriminated union + `assertNever` cho exhaustiveness.

```ts
type Ev = { type: "ping" } | { type: "msg"; text: string };

function handle(ev: Ev) {
  switch (ev.type) {
    case "ping":
      return;
    case "msg":
      console.log(ev.text);
      return;
    default: {
      const _exhaustive: never = ev;
      return _exhaustive;
    }
  }
}
```

- Không có `switch` expression riêng như C#; dùng map / ternary / IIFE.

---

## 6. Iteration: `while` / `do` / `for` / `for...of` / `for...in` / `for await...of`

### `while` / `do`

```ts
let n = 3;
while (n > 0) {
  n--;
}

do {
  n++;
} while (n < 3);
```

### `for` cổ điển

```ts
for (let i = 0; i < list.length; i++) {
  console.log(list[i]);
}
```

### `for...of` (iterable)

```ts
for (const line of lines) {
  console.log(line);
}

for (const [k, v] of map) {
  console.log(k, v);
}
```

- Phù hợp Array, Map, Set, string, Node streams (async iterable), v.v.

### `for...in` (keys)

```ts
for (const key in obj) {
  if (!Object.hasOwn(obj, key)) continue;
  console.log(key, obj[key as keyof typeof obj]);
}
```

- Duyệt enumerable string keys trên prototype chain — **dễ bug**; thường thay bằng `Object.keys` / `Object.entries` / `Object.hasOwn`.

### `for await...of`

```ts
for await (const chunk of asyncIterable) {
  consume(chunk);
}
```

- Chỉ trong async function / top-level ESM await context.  
- Node: đọc stream async iterable hiện đại.

```ts
import { createReadStream } from "node:fs";
import { readline } from "node:readline/promises"; // minh họa API — chọn API phù hợp version

// Pattern chung:
async function readAll(iterable: AsyncIterable<string>) {
  for await (const item of iterable) {
    console.log(item);
  }
}
```

---

## 7. Jump: `break` / `continue` / `return` / `throw` / labeled

```ts
outer: for (const row of rows) {
  for (const cell of row) {
    if (cell === "stop") break outer;
    if (cell === "skip") continue;
  }
}

function f(): number {
  return 1;
}

throw new Error("fail");
```

- **Labeled statement**: `label: statement` — `break label` / `continue label` (continue chỉ với loop).  
- Tránh lạm dụng label; refactor hàm nhỏ thường rõ hơn.  
- `return` trong `finally` ghi đè return/throw đang pending — anti-pattern.  
- `throw` non-Error được phép nhưng khó `instanceof` — nên `Error` / subclass.

```ts
class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
```

---

## 8. `try` / `catch` / `finally`

```ts
try {
  await risky();
} catch (e) {
  if (e instanceof AppError) {
    console.error(e.code, e.message);
  } else {
    throw e; // rethrow
  }
} finally {
  await release();
}
```

- `catch` optional binding: `catch { }`.  
- TS `useUnknownInCatchVariables`: `e` là `unknown`.  
- `try` có thể kèm `using` bên trong block — dispose chạy theo quy tắc scope (thường trước khi rời block, phối hợp với finally theo spec).  
- Không có conditional `catch when` như C# — lọc bằng `if` trong catch.

```ts
try {
  run();
} catch (e) {
  if (!(e instanceof NetworkError)) throw e;
  retry();
}
```

---

## 9. Explicit Resource Management (chi tiết)

Chuẩn hóa pattern “RAII-like” cho JS:

```ts
class Lock implements Disposable {
  #held = true;
  [Symbol.dispose]() {
    if (this.#held) {
      this.#held = false;
      releaseLock();
    }
  }
}

function withLock() {
  using _lock = new Lock();
  criticalSection();
} // dispose luôn — kể cả throw
```

**Async:**

```ts
class Conn implements AsyncDisposable {
  async [Symbol.asyncDispose]() {
    await this.close();
  }
  async close() {
    /* ... */
  }
}

async function query() {
  await using c = new Conn();
  return c;
}
```

**Nhiều resource — thứ tự LIFO:**

```ts
{
  using a = makeA();
  using b = makeB();
} // dispose b, rồi a
```

**Ghi chú Node / TS:**

- Bật lib/types có `Disposable`, `Symbol.dispose` (`lib`: ESNext hoặc phù hợp).  
- Nhiều API Node vẫn chưa expose `Disposable` — wrapper mỏng gọi `.close()` / `.unref()` trong dispose.  
- `await using` trong vòng lặp: mỗi iteration dispose trước iteration sau (hữu ích file handles).  
- Lỗi dual (body + dispose) → `SuppressedError` (`.error` / `.suppressed`).

```ts
async function processFiles(paths: string[]) {
  for (const p of paths) {
    await using f = await openTracked(p);
    await handle(f);
  }
}
```

---

## 10. `with` (không dùng) & `debugger`

```ts
debugger; // dừng nếu inspector đang gắn (node --inspect)
```

- **`with (obj) { ... }`**: thêm object vào scope chain — **cấm trong strict mode** (và mọi ESM). Không dùng; gây tối nghĩa & tối ưu kém.  
- `debugger` để trống trong production build nếu bundler strip; không dựa vào như logging.

---

## 11. Empty statement & strict mode

```ts
if (ok); // empty — thường bug
for (;;) {
  /* intentional empty body? vẫn nên có comment */
}
```

- Dấu `;` một mình là empty statement.  
- ASI (Automatic Semicolon Insertion) có edge case (`return\nvalue` → return undefined) — style nhất quán + formatter.  
- `"use strict";` cần trong CJS script/function; **không cần** trong ESM module.

---

## 12. Mẹo & best practices

- Prefer `const` + `for...of` / iterators hơn `for...in` / index thủ công khi không cần index.  
- Dùng `using`/`await using` khi resource có protocol dispose; nếu không — `try`/`finally` + `close()`.  
- Giữ `switch` exhaustiveness với `never` cho union.  
- Tránh `return`/`throw` trong `finally`.  
- Top-level await chỉ entry ESM; lib xuất sync API hoặc async function tường minh.  
- Node 26: event-loop vẫn chạy nếu còn handle; `process.exitCode` + để loop drain thường sạch hơn `process.exit` giữa chừng statement cleanup.

```ts
async function main() {
  await using app = await bootstrap();
  await app.listen();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```
