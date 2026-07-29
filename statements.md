# Statements (Phát biểu)

**Statement** là đơn vị thực thi (khác *expression* cho giá trị). Tham chiếu **ES hiện đại + TypeScript 7** trên **Node.js 26** (ESM ưu tiên). Bao gồm Explicit Resource Management: `using` / `await using`, ASI, và các bẫy `return` trong `finally`.

---

## Mục lục

- [Statements (Phát biểu)](#statements-phát-biểu)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan \& phân loại](#1-tổng-quan--phân-loại)
  - [2. Khối `{ ... }`, scope \& TDZ](#2-khối----scope--tdz)
  - [3. Declaration statements](#3-declaration-statements)
  - [4. Expression statements](#4-expression-statements)
  - [5. Selection: `if` / `else`, `switch` exhaustive](#5-selection-if--else-switch-exhaustive)
  - [6. Iteration: `while` / `do` / `for` / `for...of` / `for...in` / `for await...of`](#6-iteration-while--do--for--forof--forin--for-awaitof)
  - [7. Jump: `break` / `continue` / `return` / `throw` / labeled](#7-jump-break--continue--return--throw--labeled)
  - [8. `try` / `catch` / `finally`](#8-try--catch--finally)
  - [9. Explicit Resource Management](#9-explicit-resource-management)
  - [10. ASI \& empty statement](#10-asi--empty-statement)
  - [11. `with` (không dùng) \& `debugger`](#11-with-không-dùng--debugger)
  - [12. Bẫy thường gặp](#12-bẫy-thường-gặp)
  - [13. Best practices](#13-best-practices)
  - [14. Checklist](#14-checklist)
  - [15. Cheat sheet](#15-cheat-sheet)
  - [16. Version notes](#16-version-notes)
  - [17. Tài liệu liên quan](#17-tài-liệu-liên-quan)

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

Module ESM toàn bộ ở **strict mode** mặc định — không cần `"use strict"`.

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
- Block của `if`/`for`/`while`/`switch` case (với `{}`) tạo scope cho `let`/`const`.

```ts
for (let i = 0; i < 3; i++) {
  // mỗi iteration có binding i riêng (closure-friendly, ES2015+)
}
```

**Bẫy scope:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Shadow vô ý | biến ngoài không đổi | tên khác / tách hàm |
| `switch` case chung scope | `let` trùng tên giữa case | bọc `{ }` mỗi case |
| Closure trong `var` + `for` | cùng binding | `let` |

```ts
switch (k) {
  case 1: {
    const msg = "one";
    break;
  }
  case 2: {
    const msg = "two";
    break;
  }
}
```

---

## 3. Declaration statements

### 3.1–3.5 Tóm tắt declaration

```ts
const host = "127.0.0.1";
let port = 3000;
const { name, age = 0 } = user;
const [first, ...rest] = items;

{
  using resource = acquire();
}

function helper() {}
async function* agen() {
  yield await Promise.resolve(1);
}
class Service {
  run() {}
}

import { readFile } from "node:fs/promises";
export const VERSION = 1;
```

- `const` cấm rebind, không deep-freeze; function declaration hoist; class có TDZ.
- Parameter properties / `enum` — **không** erasable cho Node type strip.
- `using` / `await using`: mục 9. Module-level `import`/`export` không nằm trong block thường.

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

- Expression đứng một mình thành statement.
- Bare object literal dễ nhầm **block**: dùng `({ a: 1 })` hoặc gán.
- Prefer bỏ giá trị thừa bằng không dùng, hoặc `void` khi cố ý (và biết hệ quả Promise).

```ts
{
  a: 1; // đây là label `a` + expression statement `1` — không phải object!
}
({ a: 1 }); // object expression
```

---

## 5. Selection: `if` / `else`, `switch` exhaustive

```ts
if (status === "ok") {
  handleOk();
} else if (status === "retry") {
  handleRetry();
} else {
  handleOther();
}
```

- Điều kiện dùng truthiness; prefer so sánh tường minh với boolean/nullish khi `0`/`""` hợp lệ.

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

- `case` dùng `===` (strict).
- Fall-through có chủ đích cần comment; quên `break`/`return` là bug kinh điển.
- Không có `switch` expression riêng như C#; dùng map / ternary / hàm nhỏ.

**Exhaustiveness với discriminated union (TS):**

```ts
type Ev = { type: "ping" } | { type: "msg"; text: string };

function assertNever(x: never): never {
  throw new Error(`Unexpected: ${JSON.stringify(x)}`);
}

function handle(ev: Ev) {
  switch (ev.type) {
    case "ping":
      return;
    case "msg":
      console.log(ev.text);
      return;
    default:
      return assertNever(ev);
  }
}
```

**Bẫy `if`/`switch`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `if (x = 1)` | gán thay so sánh | `===`; lint `no-cond-assign` |
| Fall-through | chạy nhầm case | `break` / `return` |
| `default` nuốt union mới | quên cập nhật | `assertNever` |
| Truthiness `if (count)` | `0` bị bỏ | `count !== undefined` / `??` |

---

## 6. Iteration: `while` / `do` / `for` / `for...of` / `for...in` / `for await...of`

### `while` / `do` / `for`

```ts
let n = 3;
while (n > 0) n--;
do {
  n++;
} while (n < 3);

for (let i = 0; i < list.length; i++) {
  console.log(list[i]);
}
```

### `for...of` vs `for...in`

```ts
for (const line of lines) {
  console.log(line);
}
for (const [k, v] of map) {
  console.log(k, v);
}

for (const key in obj) {
  if (!Object.hasOwn(obj, key)) continue;
  console.log(key, obj[key as keyof typeof obj]);
}
```

- `for...of`: iterable (Array, Map, Set, string, `@@iterator`).
- `for...in`: enumerable string keys trên prototype chain — **dễ bug**; prefer `Object.keys` / `entries` / `hasOwn`. **Không** dùng để duyệt array.

### `for await...of`

```ts
async function readAll(iterable: AsyncIterable<string>) {
  for await (const item of iterable) {
    console.log(item);
  }
}
```

- Chỉ trong async function / TLA ESM. Node Readable hiện đại thường async iterable.

**Bẫy vòng lặp:** `for...in` trên Array → `for...of`; `await` tuần tự không cần → batch; sửa collection đang `of` → copy / index tự quản.

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

- **Labeled statement**: `label: statement` — `break label` thoát statement gắn nhãn; `continue label` chỉ với loop.
- Tránh lạm dụng label; refactor hàm nhỏ thường rõ hơn.
- `return` trong `finally` ghi đè return/throw đang pending — **anti-pattern** (mục 8).
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

**Bẫy jump:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `break` trong `switch` tưởng thoát `for` | chỉ thoát switch | label trên `for` |
| `continue` với label không phải loop | SyntaxError | chỉ loop |
| Label khó đọc | control flow ẩn | tách hàm |

---

## 8. `try` / `catch` / `finally`

```ts
try {
  await risky();
} catch (e) {
  if (e instanceof AppError) {
    console.error(e.code, e.message);
  } else {
    throw e;
  }
} finally {
  await release();
}
```

- `catch` optional binding: `catch { }`.
- TS `useUnknownInCatchVariables`: `e` là `unknown`.
- Không có `catch when` như C# — lọc bằng `if` trong catch.
- `try` có thể chứa `using` — dispose theo scope khi rời block (phối hợp thứ tự với `finally` theo spec ERM).

### `return` / `throw` trong `finally`

```ts
function bad(): number {
  try {
    return 1;
  } finally {
    return 2; // ghi đè — caller nhận 2; lỗi trong try có thể bị nuốt nếu throw rồi return
  }
}

function alsoBad(): void {
  try {
    throw new Error("x");
  } finally {
    return; // nuốt exception
  }
}
```

**Quy tắc:** `finally` chỉ cleanup (đóng handle, release lock). Không `return`/`throw`/`break`/`continue` trừ khi hiểu rõ và có lý do cực mạnh (hiếm).

```ts
try {
  run();
} catch (e) {
  if (!(e instanceof NetworkError)) throw e;
  retry();
}
```

---

## 9. Explicit Resource Management

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
  /* ... */
}
```

- Nhiều `using` cùng block → dispose **LIFO**.
- Lỗi body + dispose → có thể `SuppressedError` (`.error` / `.suppressed`).
- Lib/types cần `Disposable` / `Symbol.dispose`; **nhiều API Node chưa** expose — wrapper gọi `.close()`.
- `await using` trong vòng lặp: dispose mỗi iteration trước vòng sau.

```ts
async function processFiles(paths: string[]) {
  for (const p of paths) {
    await using f = await openTracked(p); // wrapper minh họa, không phải API Node sẵn
    await handle(f);
  }
}
```

**Bẫy `using`:** sync `using` trên async resource → dùng `await using`; quên block → binding sống dài; kỳ vọng mọi fs/handle Disposable → wrapper.

---

## 10. ASI & empty statement

Automatic Semicolon Insertion — engine chèn `;` theo quy tắc. Edge case hay gặp:

```ts
return
  value; // tương đương return; rồi statement `value` — trả undefined!

const x = a
[0]; // có thể parse thành `const x = a[0]` hoặc tách dòng tùy ngữ cảnh — formatter giúp

if (ok); // empty statement — thân if là no-op; khối sau luôn chạy
{
  oops();
}
```

| Bẫy ASI | Kết quả | Cách đúng |
|---------|---------|-----------|
| `return` xuống dòng | `undefined` | `return value` cùng dòng / `(value)` |
| `throw` xuống dòng | tương tự | cùng dòng |
| `yield` xuống dòng (generator) | tương tự | cùng dòng |
| Dòng bắt đầu bằng `(` / `[` / `` ` `` | dính expression trước | `;` trước dòng hoặc style nhất quán |
| `if (c);` | thân rỗng | luôn dùng `{ }` |

- Formatter (Prettier) + eslint `semi` giảm rủi ro.
- Empty `;` cố ý hiếm khi cần — comment nếu cố ý.
- `"use strict";` cần trong CJS script/function; **không cần** trong ESM.

```ts
for (;;) {
  break; // vòng cố ý — vẫn nên rõ ràng
}
```

---

## 11. `with` (không dùng) & `debugger`

```ts
debugger; // dừng nếu inspector đang gắn (node --inspect)
```

- **`with (obj) { ... }`**: thêm object vào scope chain — **cấm trong strict / ESM**. Không dùng.
- `debugger` để trống trong production nếu bundler strip; không thay logging.

---

## 12. Bẫy thường gặp

| Bẫy | Dấu hiệu | Cách đúng |
|-----|----------|-----------|
| `for...in` array | index string / prototype | `for...of` |
| `switch` thiếu `break` | fall-through | break/return/comment |
| Union không exhaustive | case mới compile vẫn qua | `assertNever` |
| `return` trong `finally` | sai giá trị / nuốt lỗi | chỉ cleanup |
| ASI `return\\n` | `undefined` | cùng dòng |
| Object literal làm statement | thành label/block | `({...})` |
| `using` sai sync/async | resource lệch | `await using` |
| Label/`break` nhầm tầng | thoát sai cấu trúc | label đúng hoặc tách hàm |
| Destructuring `undefined` | TypeError | default / guard |
| `await` tuần tự không cần | chậm | song song có kiểm soát |

---

## 13. Best practices

1. Prefer `const` + `for...of` hơn `for...in` / index khi không cần index.
2. `switch` discriminant + `assertNever` cho exhaustiveness.
3. `using`/`await using` khi có dispose; không thì `try`/`finally` + `close()`.
4. Không `return`/`throw`/`break` trong `finally`; luôn `{ }` cho `if`/`for`.
5. TLA chỉ entry; formatter bật để giảm ASI.
6. Node 26: `process.exitCode` + drain loop thường sạch hơn `process.exit` giữa cleanup.

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

---

## 14. Checklist

```text
□ for-of cho iterable; for-in chỉ object + hasOwn?
□ switch có break/return; union có assertNever?
□ finally chỉ cleanup? return/throw không bị ASI tách dòng?
□ using vs await using đúng? Không with / if (c);?
□ Entry: TLA hoặc main().catch + exitCode?
```

---

## 15. Cheat sheet

| Statement | Việc |
|-----------|------|
| `const`/`let` / `using` | khai báo (+ dispose LIFO) |
| `if` / `switch` | nhánh; case dùng `===` |
| `for...of` / `for await...of` | iterable / async iterable |
| `for...in` | keys — cẩn thận prototype |
| `break` / `continue` + label | nhảy tầng |
| `try`/`catch`/`finally` | lỗi — finally = cleanup |
| `return`/`throw` | thoát; tránh trong finally |

---

## 16. Version notes

| Giai đoạn | Liên quan statement |
|-----------|---------------------|
| ES2015–18 | `let`/`const`; `for...of`; `async`/`await`; `for await...of` |
| ES2020+ | top-level await |
| ERM hiện đại | `using` / `await using` / `SuppressedError` |
| TS | `assertNever`; `useUnknownInCatchVariables` |
| Node 26 | baseline — kiểm tra API có `Disposable` hay không |

Baseline: **Node 26** + **TS 7**.

---

## 17. Tài liệu liên quan

- [keywords.md](keywords.md) — từng từ khóa / `using`
- [operators.md](operators.md) — biểu thức trong statement
- [literals.md](literals.md) — object literal vs block
- [exceptions.md](exceptions.md) — Error, catch, AggregateError
- [async.md](async.md) — await, TLA, vòng async
- [iterables-linq.md](iterables-linq.md) — iterable / async iterable
- [event-loop.md](event-loop.md) — khi statement “treo” loop
- [main-function.md](main-function.md) — entry / shutdown
- [node26-ts7.md](node26-ts7.md) — baseline
