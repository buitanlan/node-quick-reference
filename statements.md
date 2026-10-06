# Statements (Phát biểu)

**Statement** là đơn vị thực thi (khác *expression* cho giá trị). Tham chiếu **ES hiện đại + TypeScript 7** trên **Node.js 26** (ESM ưu tiên). Bao gồm Explicit Resource Management: `using` / `await using`, ASI, dangling `else`, `switch (true)`, và các bẫy `return` trong `finally` / constructor.

---

## Mục lục

- [1. Tổng quan & phân loại](#1-tổng-quan--phân-loại)
- [2. Khối vs function scope](#2-khối-vs-function-scope)
- [3. Declaration statements](#3-declaration-statements)
- [4. Expression statements](#4-expression-statements)
- [5. `if` / `else` — dangling else](#5-if--else--dangling-else)
  - [Dangling else](#dangling-else)
- [6. `switch` exhaustive & `switch (true)`](#6-switch-exhaustive--switch-true)
  - [Exhaustiveness với discriminated union (TS)](#exhaustiveness-với-discriminated-union-ts)
  - [`switch (true)`](#switch-true)
- [7. Vòng lặp: `for-in` inherited vs `for-of` vs `for await`](#7-vòng-lặp-for-in-inherited-vs-for-of-vs-for-await)
  - [`while` / `do` / `for`](#while--do--for)
  - [`for...in` — inherited enumerable keys](#forin--inherited-enumerable-keys)
  - [`for...of` vs `for await...of`](#forof-vs-for-awaitof)
- [8. Jump: labeled `break` / `continue` / `return` / `throw`](#8-jump-labeled-break--continue--return--throw)
- [9. `return` trong constructor](#9-return-trong-constructor)
- [10. `try` / `catch` / `finally` — return-overwrite](#10-try--catch--finally--return-overwrite)
  - [Completion: `return` / `throw` trong `finally`](#completion-return--throw-trong-finally)
- [11. `using` vs `try`/`finally`](#11-using-vs-tryfinally)
  - [`for (using x of iterable)`](#for-using-x-of-iterable)
- [12. `throw` & empty statement](#12-throw--empty-statement)
  - [Empty statement `;`](#empty-statement-)
- [13. ASI — bảng hazards](#13-asi--bảng-hazards)
- [14. `with` (không dùng) & `debugger`](#14-with-không-dùng--debugger)
- [15. Bẫy thường gặp](#15-bẫy-thường-gặp)
- [16. Best practices](#16-best-practices)
- [17. Checklist](#17-checklist)
- [18. Cheat sheet](#18-cheat-sheet)
- [19. Version notes](#19-version-notes)
- [20. Tài liệu liên quan](#20-tài-liệu-liên-quan)

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

Statement **không** trả giá trị cho biểu thức bao quanh (trừ completion nội bộ: `eval` / completion record). Muốn giá trị → expression (`?:`, `&&`, IIFE, hàm).

---

## 2. Khối vs function scope

```ts
const x = 1;
{
  const x = 2; // shadow — hợp lệ, nên tránh
  console.log(x); // 2
}
console.log(x); // 1
```

| Binding | Scope | Hoist / TDZ |
|---------|-------|-------------|
| `let` / `const` / `class` / `using` | **block** `{ }` | TDZ đến init |
| `var` | **function** (hoặc module/script) | hoist = `undefined` |
| `function` declaration | block trong ESM/strict; historically function | hoist cả thân |
| Function params | function | init từ đối số |

- `let`/`const`/`class` có **TDZ**: truy cập trước khởi tạo → `ReferenceError`.
- Block của `if`/`for`/`while`/`switch` case (với `{}`) tạo scope cho `let`/`const`.
- Function body luôn là scope riêng — `var` không leak ra ngoài hàm, **có** leak khỏi `if` bên trong hàm.

```ts
function outer() {
  if (true) {
    var leaked = 1;
    const blocked = 2;
  }
  console.log(leaked); // 1
  // console.log(blocked); // ReferenceError
}
```

```ts
for (let i = 0; i < 3; i++) {
  // mỗi iteration có binding i riêng (closure-friendly, ES2015+)
}
```

`switch` **không** tạo scope theo `case` — cả `switch` là một block:

```ts
switch (k) {
  case 1: {
    const msg = "one";
    break;
  }
  case 2: {
    const msg = "two"; // OK — block riêng
    break;
  }
}
```

**Bẫy scope:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Shadow vô ý | biến ngoài không đổi | tên khác / tách hàm |
| `switch` case chung scope | `let` trùng tên giữa case | bọc `{ }` mỗi case |
| Closure trong `var` + `for` | cùng binding | `let` |
| Nhầm block object literal | `{ a: 1 }` đầu statement = **label** | mục 4 |
| `var` trong `if` | sống cả hàm | `let`/`const` |

---

## 3. Declaration statements

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
- Parameter properties / `enum` — **không** erasable cho Node type strip — [keywords.md](keywords.md).
- `using` / `await using`: mục 11. Module-level `import`/`export` không nằm trong block thường (trừ `import()` động).
- Destructure `undefined`/`null` → TypeError — default `= {}` / guard.

```ts
const { a = 1 } = undefined as unknown as { a?: number }; // TypeError runtime nếu thật undefined
const { a = 1 } = {} ; // a === 1
```

**Bẫy declaration:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Destructure nullish | TypeError | `?? {}` / optional |
| `import` trong block | SyntaxError | top-level / `import()` |
| Trùng `let` cùng block | SyntaxError | tên khác |

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

```ts
function f() {
  return
  { ok: true }; // ASI: return; rồi block { ok: true } với label `ok`
}
```

**Bẫy expression-stmt:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `{ a: 1 }` đầu dòng sau `return` | thành block/label | `return { a: 1 }` cùng dòng / `(` |
| `void promise` | unhandled rejection | `.catch` |
| IIFE thiếu `;` trước | dính gọi hàm dòng trên | ASI mục 13 |

---

## 5. `if` / `else` — dangling else

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
- **Luôn** dùng `{ }` cho thân `if`/`else`/`for` — kể cả một dòng.

### Dangling else

`else` gắn **`if` trong cùng gần nhất** chưa có `else` — không phải `if` ngoài theo indent.

```ts
if (a)
  if (b)
    inner();
  else
    oops(); // else thuộc `if (b)`, không phải `if (a)`
```

Indent dễ lừa. Tường minh:

```ts
if (a) {
  if (b) {
    inner();
  } else {
    oops();
  }
}

if (a) {
  if (b) inner();
} else {
  outerElse();
}
```

Gán trong điều kiện:

```ts
if (x = 1) {
  /* luôn truthy 1 — bug điển hình */
}
if ((x = next()) !== null) {
  /* gán có chủ đích — ngoặc + so sánh */
}
```

**Bẫy `if`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Dangling else | `else` gắn if trong | `{ }` mọi nhánh |
| `if (x = 1)` | gán thay so sánh | `===`; lint `no-cond-assign` |
| `if (count)` | `0` bị bỏ | `count !== undefined` |
| `if (c);` | empty body — mục 12 | không `;` sau `)` |
| Truthiness object | luôn true kể cả `{}` | kiểm field |

---

## 6. `switch` exhaustive & `switch (true)`

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

- `case` dùng **`===`** (strict) với biểu thức `switch`.
- Fall-through có chủ đích cần comment; quên `break`/`return` là bug kinh điển.
- Không có `switch` expression riêng như C#; dùng map / ternary / hàm nhỏ.
- `default` không bắt buộc; thiếu thì không khớp → không làm gì.

### Exhaustiveness với discriminated union (TS)

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

Thêm variant vào union → `default` không còn `never` → lỗi compile. **Đừng** `default: break` nuốt case mới.

### `switch (true)`

Mỗi `case` là biểu thức boolean; khớp **`caseExpr === true`** (không phải truthiness của `caseExpr` trừ khi nó thực sự `=== true`).

```ts
function grade(score: number): string {
  switch (true) {
    case score >= 90:
      return "A";
    case score >= 80:
      return "B";
    case score >= 0:
      return "C";
    default:
      return "?";
  }
}
```

Thứ tự `case` quan trọng (đánh giá tuần tự). `case score` **không** chạy như C `switch` range — `score === true` hầu như false.

```ts
switch (true) {
  case 1: // 1 === true → false
    break;
  case Boolean(1): // true === true
    break;
}
```

Lookup table thường rõ hơn `switch (true)` cho map giá trị; `switch (true)` hợp khi **dải điều kiện**.

Fall-through có chủ đích:

```ts
switch (code) {
  case 200:
  case 201:
  case 204:
    // cố ý chung — comment
    return "ok";
  default:
    return "other";
}
```

Không dựa indent để “nhóm” `case` mà thiếu `break` ở nhánh có lệnh.

**Bẫy `switch`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Fall-through | chạy nhầm case | `break` / `return` |
| `default` nuốt union mới | quên cập nhật | `assertNever` |
| `switch (true)` + `case 1` | `1 !== true` | `case x > 0:` boolean |
| `case` coercion nghĩ `==` | là `===` | `"1"` không khớp `1` |
| Scope `let` giữa case | SyntaxError trùng | `{ }` mỗi case |
| `break` tưởng thoát `for` | chỉ thoát `switch` | label mục 8 |

---

## 7. Vòng lặp: `for-in` inherited vs `for-of` vs `for await`

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

- `do...while` chạy thân **ít nhất một lần**.
- `for (;;)` + `break` — vô hạn có chủ đích; comment điều kiện thoát.

### `for...in` — inherited enumerable keys

`for...in` đi **chuỗi prototype**, mọi enumerable **string** keys (không symbol).

```ts
Object.prototype.polluted = "x"; // minh họa — đừng làm thật
const obj = { a: 1 };
for (const key in obj) {
  console.log(key); // "a", và có thể "polluted"
}

for (const key in obj) {
  if (!Object.hasOwn(obj, key)) continue;
  console.log(key, obj[key as keyof typeof obj]);
}
```

```ts
const arr = ["p", "q"];
for (const k in arr) {
  typeof k; // "string" — "0", "1", có thể extra enumerable
}
```

| Duyệt | Nhận | Inherited? |
|-------|------|------------|
| `for...in` | string keys | **có** |
| `Object.keys` | own enumerable string | không |
| `Object.getOwnPropertyNames` | own string kể cả non-enum | không |
| `for...of` object thường | TypeError (không iterable) | — |
| `for...of Object.entries` | `[key, value]` own enum | không |

**Không** dùng `for...in` trên Array (index string, hole, prototype).

### `for...of` vs `for await...of`

```ts
for (const line of lines) {
  console.log(line);
}
for (const [k, v] of map) {
  console.log(k, v);
}

async function readAll(iterable: AsyncIterable<string>) {
  for await (const item of iterable) {
    console.log(item);
  }
}
```

| | `for...of` | `for await...of` |
|--|------------|------------------|
| Sync iterable | lấy `next().value` | **cũng được** — `await` từng value nếu thenable |
| Async iterable | lấy object iterator **sai** (không unwrap async) | đúng |
 | Promise trong mảng | **không** unwrap | unwrap từng `await` |
| Ngữ cảnh | sync/async | **chỉ** async function / TLA |

```ts
const ps = [Promise.resolve(1), Promise.resolve(2)];
for (const x of ps) {
  // x: Promise
}
for await (const x of ps) {
  // x: 1, rồi 2 — await từng phần tử
}
```

- Node `Readable` hiện đại thường async iterable — `for await` chunks.
- Sửa collection đang `of` → copy / index tự quản.
- `await` tuần tự trong vòng = waterfall; batch `Promise.all` khi độc lập.

```ts
import { createReadStream } from "node:fs";

async function dump(path: string) {
  const stream = createReadStream(path, { encoding: "utf8" });
  for await (const chunk of stream) {
    process.stdout.write(chunk);
  }
}
```

`break` / `return` khỏi `for await` vẫn đóng iterator (`return()` protocol) — với stream, hủy/đóng phụ thuộc implementation; AbortSignal vẫn nên dùng khi request path — [abort-context.md](abort-context.md).

**Bẫy vòng:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `for...in` array | index string + proto | `for...of` / index `for` |
| `for...in` không `hasOwn` | inherited | `Object.keys` / `hasOwn` |
| `for...of` async iterable | không await next | `for await` |
| `for await` mảng Promise **cố ý** | tuần tự | `Promise.all` nếu song song |
| `await` trong `for-of` sync | chậm | pool / `all` |
| Sửa mảng đang duyệt `of` | skip/dup | copy snapshot |

---

## 8. Jump: labeled `break` / `continue` / `return` / `throw`

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

- **Labeled statement**: `label: statement` — `break label` thoát statement gắn nhãn; `continue label` chỉ với **loop**.
- Label trên **block** (không phải loop) chỉ `break`, không `continue`:

```ts
block: {
  if (skip) break block;
  work();
}
```

- `break` trong `switch` thoát switch, **không** thoát `for` bọc ngoài — trừ khi label trên `for`.
- Tránh lạm dụng label; refactor hàm nhỏ thường rõ hơn.
- `return` trong `finally` ghi đè — mục 10.
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

```ts
loop: for (const x of xs) {
  switch (x) {
    case "skip":
      continue loop; // tiếp vòng for, không fall switch
    case "stop":
      break loop;
    default:
      break; // chỉ switch
  }
}
```

**Bẫy jump:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `break` trong `switch` tưởng thoát `for` | chỉ thoát switch | label trên `for` |
| `continue` với label không phải loop | SyntaxError | chỉ loop |
| Label khó đọc | control flow ẩn | tách hàm |
| `throw` xuống dòng | ASI | mục 13 |
| Label trùng / unused | nhiễu | tên `outer:` rõ |

---

## 9. `return` trong constructor

`new Ctor()`:

1. Tạo object, `[[Prototype]]` = `Ctor.prototype`.
2. Gọi `Ctor` với `this` = object đó.
3. Nếu constructor `return` một **object** (kể cả function) → **đó** là kết quả `new`.
4. Nếu `return` primitive / `return;` / không `return` → kết quả là `this`.

```ts
class Hijack {
  constructor() {
    return { hijacked: true };
  }
}
const h = new Hijack();
h instanceof Hijack; // false
h; // { hijacked: true }

class Keep {
  constructor() {
    return 1; // ignored
  }
}
new Keep() instanceof Keep; // true
```

```ts
function F() {
  if (new.target === undefined) {
    return new F(); // factory dual
  }
}
```

- Class constructor gọi không `new` → TypeError (không dual-call như `function`).
- Arrow không làm constructor.
- Factory `return` object là pattern hợp lệ — **đừng** mix với `instanceof` giả định.
- `return this` thừa trong constructor class.

**Bẫy constructor return:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `return {}` vô tình | mất instance/class fields | không return object trừ factory |
| `instanceof` sau factory | false | brand / không dùng `new` |
| `return Promise` trong ctor | object → `new` ra Promise, **không** await fields | `async` factory, không ctor async |
| Param properties + strip | không erasable | field tường minh |

---

## 10. `try` / `catch` / `finally` — return-overwrite

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
- `try` có thể chứa `using` — dispose theo scope khi rời block (phối hợp thứ tự với `finally` theo spec ERM: dispose `using` **trước** khi chạy `finally` của cùng block? Thực tế: `using` gắn block; rời block chạy dispose; `try/finally` là statement — đặt `using` **trong** `try` để dispose trước `finally` của `try` đó).

### Completion: `return` / `throw` trong `finally`

Nếu `try`/`catch` đang `return` hoặc `throw`, rồi `finally` hoàn thành **bình thường** → completion cũ tiếp tục.

Nếu `finally` **`return` / `throw` / `break` / `continue`** → **ghi đè** completion pending (lỗi trong `try` có thể **mất**).

```ts
function bad(): number {
  try {
    return 1;
  } finally {
    return 2; // ghi đè — caller nhận 2
  }
}

function swallow(): void {
  try {
    throw new Error("x");
  } finally {
    return; // nuốt exception
  }
}

function replaceThrow(): void {
  try {
    throw new Error("x");
  } finally {
    throw new Error("y"); // caller thấy y; x mất trừ khi wrap
  }
}
```

**Quy tắc:** `finally` chỉ cleanup (đóng handle, release lock). Không `return`/`throw`/`break`/`continue` trừ khi hiểu rõ và có lý do cực mạnh (hiếm). Lỗi cleanup: log / `SuppressedError` / `AggregateError` — đừng `return`.

```ts
try {
  run();
} catch (e) {
  if (!(e instanceof NetworkError)) throw e;
  retry();
}
```

**Bẫy `finally`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `return` trong `finally` | sai giá trị / nuốt throw | chỉ cleanup |
| `throw` trong `finally` | che lỗi gốc | `SuppressedError` / cause |
| `await` trong `finally` quên | resource treo | `await close()` |
| Catch `any` | mất type | `unknown` |

---

## 11. `using` vs `try`/`finally`

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

Tương đương ý (rút gọn) với `try`/`finally`:

```ts
function withLockFinally() {
  const lock = new Lock();
  try {
    criticalSection();
  } finally {
    lock[Symbol.dispose]();
  }
}
```

`using` **thêm**: LIFO nhiều resource, `SuppressedError` khi cả body lẫn dispose ném, `null` no-op, tích hợp `DisposableStack`.

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
}
```

| | `using` / `await using` | `try`/`finally` |
|--|-------------------------|-----------------|
| Syntax | declaration + block | tường minh |
| Nhiều resource | LIFO tự động | lồng `try` hoặc stack tay |
| Dual error | `SuppressedError` | dễ nuốt một phía |
| API chỉ `.close()` | wrapper `Symbol.dispose` | gọi `close()` trong `finally` |
| Hỗ trợ Node 26 | ngữ pháp native | luôn có |

Nhiều API Node **chưa** expose Disposable — wrapper gọi `.close()`. Kiểm tra docs major hiện tại.

Thứ tự khi **lồng** `try` + `using` cùng hàm:

```ts
function mixed() {
  using a = openA();
  try {
    using b = openB();
    work();
  } finally {
    log("finally");
  }
}
// rời try → dispose b → finally log → rời hàm → dispose a
```

- `using` gắn **block** chứa nó, không gắn `try` trừ khi khai báo bên trong `try`.
- `finally` của `try` chạy khi rời `try` statement — dispose `using` **trong** `try` chạy như một phần rời block `try` (trước `finally` của cùng `try`).
- Test một lần với log nếu cleanup thứ tự quan trọng (lock vs socket).

### `for (using x of iterable)`

```ts
for (using r of getResources()) {
  r.work();
} // dispose r mỗi iteration — kể cả continue
```

```ts
for await (await using c of getConns()) {
  await c.query();
}
```

Cặp với mục 7: đừng `for...of` resource rồi quên close; `using` trong header là hình thức gọn. Không kết hợp `for...in`.

---

```ts
async function processFiles(paths: string[]) {
  for (const p of paths) {
    await using f = await openTracked(p); // wrapper minh họa
    await handle(f);
  } // dispose mỗi file trước file sau
}
```

Chọn:

- Có `[Symbol.dispose]` / tự viết wrapper ổn định → `using`.
- Cleanup một lần, API callback cũ, hoặc logic nhánh phức tạp → `try`/`finally` vẫn đúng.
- **Không** mix `return` trong `finally` với `using` cùng block mà không hiểu thứ tự.

**Bẫy `using` vs `finally`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Sync `using` + async close | không `await` close | `await using` |
| Kỳ vọng mọi `fs` Disposable | chưa chắc | wrapper |
| `using` cả hàm lớn | sống quá lâu | `{ }` hẹp |
| `finally` + `using` nghĩ thay nhau thứ tự | đọc block | một cơ chế / test |

Keyword-level: [keywords.md](keywords.md) §7.

---

## 12. `throw` & empty statement

```ts
throw new Error("fail");
throw new AppError("nope", "E_NOPE");
```

- `throw expr` — `expr` bắt buộc; `throw;` SyntaxError.
- Nên `Error` + `cause` / `code`. Primitive string: khó lọc.
- `throw` xuống dòng → ASI giống `return` (bảng mục 13).

### Empty statement `;`

`;` đơn là statement **no-op**. Nguy hiểm sát `if`/`for`/`while`:

```ts
if (ok); // empty — thân if là no-op
{
  oops(); // luôn chạy
}

for (let i = 0; i < n; i++); // vòng không làm gì
  process(i); // i có thể ngoài scope / chạy 1 lần
```

- Empty `;` cố ý (hiếm) — comment `/* no-op */`.
- Formatter + eslint `no-empty` / `curly` giảm rủi ro.

**Bẫy empty / throw:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `if (c);` | thân rỗng | `{ }` |
| `throw "x"` | không `instanceof Error` | `new Error` |
| `for (...);` | vòng rỗng | thân block |

---

## 13. ASI — bảng hazards

Automatic Semicolon Insertion — engine chèn `;` khi newline + token không tiếp tục statement hợp lệ (quy tắc spec, không phải “mọi xuống dòng”).

| Hazard | Code | Parse thực | Cách đúng |
|--------|------|------------|-----------|
| `return` xuống dòng | `return\nvalue` | `return;` rồi `value;` | `return value` / `return (value)` |
| `throw` xuống dòng | `throw\nerr` | SyntaxError hoặc không như ý | cùng dòng |
| `yield` xuống dòng | `yield\nx` | `yield;` | cùng dòng |
| Object sau `return` | `return\n{ a: 1 }` | `return;` + block | `return { a: 1 }` |
| `(` đầu dòng | `a\n(b)` | `a(b)` — gọi hàm | `;` trước `(b)` hoặc cùng dòng |
| `[` đầu dòng | `a\n[0]` | `a[0]` | `;` trước `[` nếu statement mới |
| `` ` `` đầu dòng | `fn\n\`x\`` | tagged call | `;` nếu không phải tag |
| `++` đầu dòng | `a\n++b` | `a; ++b` (thường) | cùng dòng `a++` |
| `if (c);` | empty | không phải ASI thuần nhưng cặp nguy hiểm | `{ }` |

```ts
return
  value; // undefined!

const x = a
[0]; // thường `const x = a[0]` — formatter giúp

foo
(); // gọi foo() — có thể không cố ý
```

- Formatter (Prettier) + eslint `semi` giảm rủi ro.
- `"use strict";` cần trong CJS script/function; **không cần** trong ESM.
- Style “no semicolons” **phải** `;` bảo vệ trước `(`, `[`, `` ` ``, `/`, `+`, `-`.

```ts
const a = b
const c = d
;(function boot() {})() // ; bắt buộc nếu style no-semi
```

Regex literal đầu dòng sau expression:

```ts
a
/b/g; // có thể parse thành phép chia a / b / g — ASI không cứu
```

```ts
for (;;) {
  break; // vòng cố ý — vẫn nên rõ ràng
}
```

**Bẫy ASI:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `return` multiline object | `undefined` | `(` sau `return` |
| IIFE sau expression | dính call | `;` trước `(` |
| Regex `/a/` đầu dòng | chia `/` | `;` / ngoặc |
| Tin ASI = “không cần `;` mọi chỗ” | token tiếp tục | spec + formatter |

---

## 14. `with` (không dùng) & `debugger`

```ts
debugger; // dừng nếu inspector đang gắn (node --inspect)
```

- **`with (obj) { ... }`**: thêm object vào scope chain — **cấm trong strict / ESM**. Không dùng. [keywords.md](keywords.md).
- `debugger` để trống trong production nếu bundler strip; không thay logging.
- `debugger` trong vòng nóng + inspector = treo process — gỡ trước load test.

`debugger` không nhận điều kiện trong ngôn ngữ (`debugger if x` không tồn tại). Bọc `if`:

```ts
if (process.env.DEBUG_BREAK === "1") debugger;
```

---

## 15. Bẫy thường gặp

| Bẫy | Dấu hiệu | Cách đúng |
|-----|----------|-----------|
| `for...in` array | index string / prototype | `for...of` |
| `for...in` không lọc | inherited keys | `hasOwn` / `Object.keys` |
| `for...of` vs `for await` | Promise còn nguyên / async iter sai | bảng §7 |
| `switch` thiếu `break` | fall-through | break/return/comment |
| `switch (true)` + non-bool | `=== true` fail | `case cond:` boolean |
| Union không exhaustive | case mới compile vẫn qua | `assertNever` |
| Dangling else | else sai if | `{ }` |
| `return` trong `finally` | sai giá trị / nuốt lỗi | chỉ cleanup |
| ASI `return\\n` | `undefined` | cùng dòng |
| Object literal làm statement | thành label/block | `({...})` |
| Empty `if (c);` | thân rỗng | `{ }` |
| `using` sai sync/async | resource lệch | `await using` |
| Label/`break` nhầm tầng | thoát sai cấu trúc | label đúng hoặc tách hàm |
| `return {}` trong constructor | mất instance | factory tường minh |
| Destructure `undefined` | TypeError | default / guard |
| `await` tuần tự không cần | chậm | song song có kiểm soát |
| Block vs function `var` | leak | `let`/`const` |

---

## 16. Best practices

1. Prefer `const` + `for...of` hơn `for...in` / index khi không cần index; `for...in` chỉ object + `hasOwn`.
2. `switch` discriminant + `assertNever` cho exhaustiveness; `switch (true)` chỉ dải điều kiện boolean.
3. `using`/`await using` khi có dispose; không thì `try`/`finally` + `close()` — một cơ chế, không `return` trong `finally`.
4. Luôn `{ }` cho `if`/`else`/`for` — chặn dangling else và `if (c);`.
5. TLA chỉ entry; formatter bật để giảm ASI; `return`/`throw`/`yield` không tách dòng.
6. Constructor: không `return` object trừ factory có chủ đích; không `async` constructor.
7. Node 26: `process.exitCode` + drain loop thường sạch hơn `process.exit` giữa cleanup.
8. Label hiếm; ưu tiên hàm nhỏ.
9. `switch (true)` chỉ khi mọi `case` là boolean; `for await` trên Readable nhớ hủy/AbortSignal.
10. ASI: `return`/`throw`/`yield` cùng dòng; `(` `[` `` ` `` đầu dòng thì `;` bảo vệ.

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

## 17. Checklist

```text
□ for-of cho iterable; for-in chỉ object + hasOwn?
□ for await khi async iterable / cố ý await từng Promise?
□ switch có break/return; union có assertNever? switch(true) case là boolean?
□ if/else luôn { } — không dangling, không if (c);?
□ finally chỉ cleanup? return/throw/yield không bị ASI tách dòng?
□ using vs await using vs try/finally đúng? wrapper .close()?
□ Constructor không return object vô tình?
□ Không with / var leak / empty statement?
□ Entry: TLA hoặc main().catch + exitCode?
```

---

## 18. Cheat sheet

| Statement | Việc |
|-----------|------|
| `const`/`let` / `using` | khai báo (+ dispose LIFO) |
| `{ }` | block scope — khác function/`var` |
| `if` / `else` | `{ }` chống dangling |
| `switch` / `switch (true)` | `===`; exhaustive `never` |
| `for...of` / `for await...of` | iterable / async iterable |
| `for...in` | keys inherited — lọc `hasOwn` |
| `break` / `continue` + label | nhảy tầng (switch ≠ for) |
| `try`/`catch`/`finally` | lỗi — finally = cleanup, không overwrite |
| `return`/`throw` | thoát; ASI; constructor return object |
| `;` rỗng | no-op — cấm sau `if (c)` |
| `debugger` | inspector |

```ts
outer: for (const row of rows) {
  for (const cell of row) {
    if (cell === "x") break outer;
  }
}

switch (ev.type) {
  case "ping":
    break;
  default: {
    const _n: never = ev;
    return _n;
  }
}
```

---

## 19. Version notes

| Giai đoạn | Liên quan statement |
|-----------|---------------------|
| ES5 | `try`/`finally`; strict cấm `with` |
| ES2015–18 | `let`/`const`; `for...of`; `async`/`await`; `for await...of` |
| ES2020+ | top-level await |
| ERM hiện đại | `using` / `await using` / `for (using of)` / `SuppressedError` / `DisposableStack` |
| TS | `assertNever`; `useUnknownInCatchVariables` |
| Node 26 | baseline — kiểm tra API có `Disposable` hay không; ESM strict |

Baseline: **Node 26** + **TS 7**.

---

## 20. Tài liệu liên quan

- [keywords.md](keywords.md) — từng từ khóa / `using` / TDZ / `enum` strip
- [operators.md](operators.md) — biểu thức trong statement, comma, `void`
- [literals.md](literals.md) — object literal vs block
- [exceptions.md](exceptions.md) — Error, catch, AggregateError, `SuppressedError`
- [async.md](async.md) — await, TLA, vòng async
- [iterables-linq.md](iterables-linq.md) — iterable / async iterable
- [event-loop.md](event-loop.md) — khi statement “treo” loop
- [main-function.md](main-function.md) — entry / shutdown
- [functions-methods.md](functions-methods.md) — constructor, `new.target`
- [oop.md](oop.md) — class fields vs return hijack
