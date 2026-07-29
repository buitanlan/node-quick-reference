# Hàm & Method trong JavaScript / TypeScript

Trong JS/TS, **hàm** là giá trị first-class; **method** là hàm gắn object/class. Baseline: **ESM**, **Node.js 26**, **TypeScript 7**.

Kiểu hàm / callback / HOF → [functions-callbacks.md](functions-callbacks.md). `async` → [async.md](async.md). `using` đầy đủ → [statements.md](statements.md) §9.

---

## Mục lục

1. [Declaration vs expression vs arrow](#1-declaration-vs-expression-vs-arrow)
2. [`this` binding](#2-this-binding)
3. [Tham số: default, rest, spread, optional](#3-tham-số-default-rest-spread-optional)
4. [Overload trong TypeScript](#4-overload-trong-typescript)
5. [Closure, TDZ & loop capture](#5-closure-tdz--loop-capture)
6. [Method trên object & class](#6-method-trên-object--class)
7. [Getter / Setter](#7-getter--setter)
8. [`call` / `apply` / `bind`](#8-call--apply--bind)
9. [Generator functions](#9-generator-functions)
10. [`async function` (tóm tắt)](#10-async-function-tóm-tắt)
11. [`using` & Explicit Resource Management](#11-using--explicit-resource-management)
12. [Chi phí & pitfalls](#12-chi-phí--pitfalls)
13. [Best practices](#13-best-practices)
14. [Checklist](#14-checklist)
15. [Cheat sheet](#15-cheat-sheet)
16. [Version matrix](#16-version-matrix)
17. [Tài liệu liên quan](#17-tài-liệu-liên-quan)

---

## 1. Declaration vs expression vs arrow

### 1.1 Declaration (hoisted)

```ts
function add(a: number, b: number): number {
  return a + b;
}
add(2, 3); // gọi được trước khai báo — hoist cả thân
```

Có `prototype` → `new` được (hiếm trong code hiện đại).

### 1.2 Expression

```ts
const multiply = function (a: number, b: number): number {
  return a * b;
};

const factorial = function fact(n: number): number {
  return n <= 1 ? 1 : n * fact(n - 1); // tên nội bộ chỉ trong thân
};
```

`const`/`let` → **TDZ**; không gọi trước khởi tạo.

### 1.3 Arrow

```ts
const square = (x: number) => x * x;
const toPoint = (x: number, y: number) => ({ x, y }); // object → bọc `(...)`
```

- **`this` lexical**; không `arguments` / `super` / `new.target` riêng; không làm constructor.
- Phù hợp callback khi không cần `this` dynamic.

### 1.4 So sánh

| | Declaration | Expression | Arrow |
|---|---|---|---|
| Hoist | Có (cả thân) | Không (TDZ) | Không |
| `this` | Dynamic | Dynamic | **Lexical** |
| `arguments` | Có | Có | Không → rest |
| `new` / `prototype` | Có | Có | **Không** |

> **Callout:** Public API có tên → declaration; callback ngắn → arrow; gán có điều kiện / named FE đệ quy → expression.

---

## 2. `this` binding

### 2.1 Quy tắc (non-arrow)

1. `obj.method()` → `this === obj`
2. `fn()` (strict/ESM) → `this === undefined`
3. `call`/`apply`/`bind` → `this` chỉ định
4. `new Fn()` → object mới
5. Arrow → bỏ qua 1–4, dùng lexical `this`

```ts
const obj = {
  name: "node",
  greet() {
    return `hi ${this.name}`;
  },
};
const greet = obj.greet;
obj.greet(); // "hi node"
greet();     // TypeError / undefined (strict)
```

### 2.2 Class method vs arrow field

```ts
class Counter {
  count = 0;
  inc = () => {
    this.count++;
  }; // mỗi instance một hàm — callback OK
  dec() {
    this.count--;
  } // prototype — cần bind nếu tách
}

const c = new Counter();
setTimeout(c.inc, 0); // OK
setTimeout(c.dec, 0); // this sai
```

| Cách | Callback giữ `this`? | Bộ nhớ |
|---|---|---|
| Prototype method | Không (trừ bind) | Share |
| Arrow field / `bind` ctor | Có | Mỗi instance |
| Wrap `() => svc.handle()` | Có | Closure mỗi lần gán |

> Arrow field / bind trên hàng loạt instance tốn bộ nhớ hơn. Hot path → prototype + bind khi cần, hoặc wrap call-site.

### 2.3 Annotate `this` (TS)

```ts
function label(this: { name: string }, punct: string) {
  return `${this.name}${punct}`;
}
label.call({ name: "Lan" }, "!");
```

`this` parameter không phải đối số runtime — chỉ kiểm tra kiểu.

---

## 3. Tham số: default, rest, spread, optional

### 3.1 Default

```ts
function connect(host = "127.0.0.1", port = 5432) {
  return `${host}:${port}`;
}
connect();
connect(undefined, 3306); // default host
connect(null as any, 1);  // host = null — null ≠ undefined!
```

Default chỉ khi **`undefined`**. Biểu thức đánh giá lúc gọi (lazy):

```ts
function createId(factory = () => crypto.randomUUID()) {
  return factory();
}
```

### 3.2 Rest & spread

```ts
function sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
sum(1, 2, 3);
sum(...([1, 2, 3] as const));
```

| | Rest | `arguments` |
|---|---|---|
| Kiểu | `Array` thật | Array-like |
| Arrow | OK | **Không có** |
| TS | Typed rõ | Legacy |

Rest phải ở cuối.

### 3.3 Destructuring & options object

```ts
type FetchOpts = {
  method?: "GET" | "POST";
  timeoutMs?: number;
  headers?: Record<string, string>;
};

function fetchJson(
  url: string,
  { method = "GET", timeoutMs = 5_000, headers = {} }: FetchOpts = {},
) {
  return { url, method, timeoutMs, headers };
}
```

> Prefer **options object** khi ≥ 3 tham số tùy chọn.

### 3.4 Optional (TS)

```ts
function f(a: number, b?: number, c = 1) {}
// b?: ≈ number | undefined ở call-site; required không đứng sau optional (trừ default/rest)
```

---

## 4. Overload trong TypeScript

Runtime không có overload thật — TS: nhiều chữ ký + một implementation.

```ts
function parse(input: string): object;
function parse(input: string, reviver: (k: string, v: unknown) => unknown): object;
function parse(input: Buffer): object;
function parse(
  input: string | Buffer,
  reviver?: (k: string, v: unknown) => unknown,
): object {
  const text = typeof input === "string" ? input : input.toString("utf8");
  return reviver ? JSON.parse(text, reviver) : JSON.parse(text);
}
```

1. Overload signatures = public API.
2. Implementation bao các overload (caller không thấy).
3. Cụ thể trước, rộng sau — TS match đầu tiên phù hợp.

```ts
class Encoder {
  encode(value: string): Uint8Array;
  encode(value: number): Uint8Array;
  encode(value: string | number): Uint8Array {
    return new TextEncoder().encode(String(value));
  }
}
```

Khi union/generic đủ rõ → khỏi overload (`identity<T>(x: T): T`).

---

## 5. Closure, TDZ & loop capture

### 5.1 Closure

```ts
function makeCounter(start = 0) {
  let n = start;
  return () => ++n;
}
const c = makeCounter();
c(); // 1
```

Giữ reference lexical — object lớn captured trì hoãn GC. HOF/callback → [functions-callbacks.md](functions-callbacks.md).

### 5.2 TDZ

```ts
// console.log(x); // ReferenceError
const x = 1;
const fn = () => y;
const y = 2;
fn(); // 2 — gọi trước init y → ReferenceError
```

### 5.3 Loop capture

```ts
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0); // 3,3,3 — một binding
}
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log(j), 0); // 0,1,2 — mỗi iter một binding
}
```

> Prefer `let`/`const` trong vòng. `var` legacy: IIFE hoặc bind đối số. Async trong vòng ≠ “closure sai” — xem [async.md](async.md).

---

## 6. Method trên object & class

```ts
const calculator = {
  base: 10,
  add(x: number) {
    return this.base + x;
  },
};

class UserRepo {
  constructor(private readonly db: { query: (sql: string) => Promise<unknown> }) {}
  async findById(id: string) {
    return this.db.query("select * from users where id = $1");
  }
  static empty() {
    return new UserRepo({ query: async () => null });
  }
}
```

- Instance method trên `prototype` (share); `static` qua class.
- Parameter property TS tiện DI đơn giản.

```ts
class Hasher {
  hash(input: string) {
    return this.#digest(input);
  }
  #digest(input: string) {
    return input;
  } // native private
  private legacy(input: string) {
    return input;
  } // TS-only — erase lúc emit
}
```

Prefer `#` khi cần ẩn runtime.

---

## 7. Getter / Setter

```ts
class Temperature {
  #celsius = 0;
  get celsius() {
    return this.#celsius;
  }
  set celsius(value: number) {
    if (!Number.isFinite(value)) throw new TypeError("invalid temperature");
    this.#celsius = value;
  }
  get fahrenheit() {
    return (this.#celsius * 9) / 5 + 32;
  }
  set fahrenheit(f: number) {
    this.celsius = ((f - 32) * 5) / 9;
  }
}
const t = new Temperature();
t.fahrenheit = 212;
t.celsius; // 100
```

- Không gọi `t.celsius()` — trông như property.
- Tránh I/O / side-effect nặng trong getter.
- Setter: validate rồi `throw`; `Object.defineProperty` khi cần `enumerable`/`configurable`.

---

## 8. `call` / `apply` / `bind`

```ts
function intro(this: { name: string }, greeting: string, punct: string) {
  return `${greeting}, ${this.name}${punct}`;
}
const person = { name: "Lan" };

intro.call(person, "Xin chào", "!");
intro.apply(person, ["Xin chào", "!"]);
const bound = intro.bind(person, "Hello");
bound("."); // "Hello, Lan."
```

| API | Khi nào |
|---|---|
| `call` | Gọi ngay, args rời |
| `apply` | Args mảng (legacy; thường `fn(...arr)`) |
| `bind` | Callback giữ `this` / partial |

`bind` nhiều lần: `this` lần **đầu** thắng. Modern partial: `() => fn(a, b)`.

> **`apply` + mảng cực lớn** có thể vượt arg/stack limit — chunk hoặc vòng.

---

## 9. Generator functions

```ts
function* range(from: number, to: number) {
  for (let i = from; i <= to; i++) yield i;
}
for (const n of range(1, 3)) console.log(n);

function* outer() {
  yield 1;
  yield* [2, 3];
  yield* range(4, 5);
  return "done"; // for...of bỏ qua return value
}
[...outer()]; // [1,2,3,4,5]
```

- `function*` / `*method()` → `Generator` (iterable + iterator).
- Instance **one-shot** — exhaust rồi rỗng; cần lại → gọi factory.
- `.throw()` / `.return()` điều khiển từ ngoài (hiếm).

```ts
class Page {
  constructor(private items: string[]) {}
  *chunks(size: number) {
    for (let i = 0; i < this.items.length; i += size) {
      yield this.items.slice(i, i + size);
    }
  }
}
```

Async generator: `async function*` + `for await...of` → [iterables-linq.md](iterables-linq.md), [async.md](async.md).

---

## 10. `async function` (tóm tắt)

```ts
async function load(id: string): Promise<User> {
  const res = await fetch(`/api/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<User>;
}
```

| | Hành vi |
|---|---|
| Return | Luôn `Promise` |
| `throw` | Rejection |
| Arrow / method | `async () => …` / `async find() { … }` |
| `this` | Như hàm thường (method vs arrow) |

Đừng `new Promise(async …)`. Combinators / AbortSignal → **[async.md](async.md)**.

---

## 11. `using` & Explicit Resource Management

Node 26 + TS hỗ trợ `using` / `await using`. Chi tiết → [statements.md](statements.md) §9.

```ts
class FileTracker implements Disposable {
  constructor(readonly path: string) {}
  [Symbol.dispose]() {
    console.log("dispose", this.path);
  }
}

function process() {
  using f = new FileTracker("./x.txt");
} // dispose luôn — kể cả throw

class Conn implements AsyncDisposable {
  async [Symbol.asyncDispose]() {
    await this.close();
  }
  async close() {}
}

async function query() {
  await using c = new Conn();
}
```

| | |
|---|---|
| `using x = …` | sync `Disposable` |
| `await using x = …` | `AsyncDisposable` |
| Nhiều resource | Dispose **LIFO** |

> Nhiều API Node chưa `Disposable` — wrapper gọi `.close()` trong dispose. Lỗi dual → `SuppressedError`. Factory nên trả `Disposable` khi cleanup deterministic quan trọng.

---

## 12. Chi phí & pitfalls

| Pattern | Vấn đề | Xử lý |
|---|---|---|
| Arrow/bind trong hot loop | Alloc + GC | Tái sử dụng handler; bind một lần |
| Arrow field hàng loạt instance | Mỗi object một fn | Prototype nếu không cần bound |
| `apply` mảng khổng lồ | Stack/arg limit | Chunk / vòng |
| Closure giữ object lớn | Trì hoãn GC | Thu hẹp capture |
| Getter side-effect | Khó debug | Method `getX()` |
| `arguments` | Arrow không có | Rest |
| `var` + loop closure | Capture sai | `let`/`const` |

```ts
// Tránh trên hot path
for (const item of items) {
  el.on("click", () => this.handle(item));
}
```

Micro-optimize sau khi đo; ưu tiên đúng `this` và không leak closure.

---

## 13. Best practices

1. Public API: `function` có tên hoặc `const` typed — tránh anonymous khó stack.
2. Options object khi ≥ 3 optional.
3. Annotate `this` khi phụ thuộc; prefer truyền deps nếu được.
4. Prototype method mặc định; arrow field/bind chỉ khi callback bắt buộc.
5. Overload khi union chưa đủ; cụ thể trước; implementation rộng.
6. Closure: hiểu lifetime; `let` trong vòng.
7. Generator lazy; async generator cho stream.
8. `async` + `try/catch`; không Promise constructor bọc async.
9. Resource: `using` / `await using` khi cleanup deterministic.
10. Tránh tạo hàm mới trong hot loop khi binding/`this` quan trọng.

---

## 14. Checklist

```text
□ Declaration / expression / arrow đúng (this, hoist, new)
□ Callback method đã bind / wrap / arrow field có chủ đích
□ Default chỉ dựa undefined — không nhầm null
□ Rest thay arguments; options object khi nhiều optional
□ Overload: cụ thể trước; implementation bao hết
□ Loop + closure dùng let/const
□ Getter không I/O nặng; setter validate + throw
□ apply không truyền mảng cực lớn một phát
□ async: không new Promise(async …)
□ Resource: using / finally / Symbol.dispose
□ Hot path không alloc hàm thừa mỗi iteration
```

---

## 15. Cheat sheet

```ts
function decl(a: number, b = 1, ...rest: number[]) {}
const arrow = (x: number) => x * 2;
fn.call(thisArg, a, b);
fn.apply(thisArg, [a, b]);
const bound = fn.bind(thisArg, a);
function* gen() {
  yield 1;
  yield* other();
}
async function load() {
  return await fetch("/");
}
{
  using r = acquire();
  await using c = await connect();
}
```

| Cần | Chọn |
|---|---|
| Hoist + tên rõ | `function` |
| Lexical `this` | arrow |
| Share prototype | class method |
| Callback giữ instance | bind / arrow field / wrap |
| Lazy sequence | `function*` |
| I/O async | `async function` → [async.md](async.md) |
| Cleanup deterministic | `using` / `await using` |

---

## 16. Version matrix

| Nền | Liên quan |
|---|---|
| ES2015 | arrow, default/rest, class, generators |
| ES2017 | async/await |
| ES2018+ | async generators |
| TS | overload, `this` param, parameter properties |
| TS 5+/7 | `const` type params |
| ERM | `using` / `await using`, `Disposable`, `SuppressedError` |
| **Node 26** | ESM; `using` với lib/types phù hợp |

Baseline: **Node 26** + **TS 7**. Bật `lib` có `Disposable`/ESNext khi dùng `using`.

---

## 17. Tài liệu liên quan

- [Function type, Callback & Lambda](functions-callbacks.md)
- [Iterator, Iterable & “LINQ-like”](iterables-linq.md)
- [Lập trình bất đồng bộ](async.md)
- [Phát biểu](statements.md) — `using` chi tiết
- [Lập trình hướng đối tượng trong TypeScript](oop.md)
- [Exception / Error](exceptions.md)
- [Tập hợp & Generics](collections-generics.md)
- [Node 26 & TypeScript 7 highlights](node26-ts7.md)
