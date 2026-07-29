# Function type, Callback & Lambda

Trong JavaScript/TypeScript, hàm là **giá trị first-class**: gán biến, truyền đối số, trả về từ hàm khác. Chương này tập trung **kiểu hàm (TS)**, callback (Node err-first vs Promise), higher-order, predicate, variance (`strictFunctionTypes`), và overload vs union params.

> Đọc kèm (cú pháp khai báo / `this` / overload runtime): [Hàm & Method](functions-methods.md). Async sâu: [async.md](async.md). Lỗi: [exceptions.md](exceptions.md).

---

## Mục lục

1. [First-class functions](#1-first-class-functions)
2. [Callback Node-style (err-first) vs Promises](#2-callback-node-style-err-first-vs-promises)
3. [Kiểu hàm trong TypeScript](#3-kiểu-hàm-trong-typescript)
4. [Callable interface & construct signature](#4-callable-interface--construct-signature)
5. [Predicates & type guards](#5-predicates--type-guards)
6. [Generic functions](#6-generic-functions)
7. [Higher-order, curry nhẹ](#7-higher-order-curry-nhẹ)
8. [Variance & `strictFunctionTypes`](#8-variance--strictfunctiontypes)
9. [Overloads vs union params](#9-overloads-vs-union-params)
10. [Closure & capturing](#10-closure--capturing)
11. [Lambda / arrow như callback](#11-lambda--arrow-như-callback)
12. [EventEmitter — pointer](#12-eventemitter--pointer)
13. [Best practices](#13-best-practices)
14. [Checklist](#14-checklist)
15. [Cheat sheet](#15-cheat-sheet)
16. [Version notes](#16-version-notes)
17. [Tài liệu liên quan](#17-tài-liệu-liên-quan)

---

## 1. First-class functions

```ts
function greet(name: string) {
  return `Hello, ${name}`;
}

const g = greet;
const fns = [greet, (n: string) => n.toUpperCase()];
const once = (f: typeof greet) => f;

console.log(g("Node"));
```

Hệ quả thực tế:

- Middleware, plugin, strategy, pipeline = “truyền hàm”.
- `Array.map/filter/reduce`, `Promise.then`, `EventEmitter.on` đều nhận callback.

```ts
type Transform = (n: number) => number;

const pipeline =
  (...fs: Transform[]) =>
  (x: number) =>
    fs.reduce((acc, f) => f(acc), x);

const calc = pipeline((n) => n + 1, (n) => n * 2);
calc(3); // 8
```

---

## 2. Callback Node-style (err-first) vs Promises

### 2.1 Error-first callback (di sản Node)

Quy ước cổ điển: callback nhận **`(err, result)`** — `err` là `null`/`undefined` khi thành công.

```js
import fs from "node:fs";

fs.readFile("config.json", "utf8", (err, data) => {
  if (err) {
    console.error("read failed", err);
    return;
  }
  console.log(data);
});
```

Đặc điểm:

- Dễ **callback hell** khi lồng nhiều bước.
- Phải nhớ `return` sau khi xử lý `err`.
- Không kết hợp tốt với `try/catch` đồng bộ.

### 2.2 Promise / async-await (khuyến nghị)

```ts
import fs from "node:fs/promises";

async function loadConfig(path: string) {
  try {
    const data = await fs.readFile(path, "utf8");
    return JSON.parse(data) as unknown;
  } catch (err) {
    throw new Error(`loadConfig(${path}) failed`, { cause: err });
  }
}
```

Chuyển callback → Promise:

```ts
import { promisify } from "node:util";
import fs from "node:fs";

const readFile = promisify(fs.readFile);
const text = await readFile("a.txt", "utf8");
```

Nhiều API Node đã có bản Promise (`node:fs/promises`, `fetch`, …). Prefer **Promise + async/await** cho code mới.

### 2.3 So sánh

| | Err-first callback | Promise / async |
|---|---|---|
| Lỗi | `err` đối số đầu | reject / throw |
| Chuỗi thao tác | lồng nhau | `then` / `await` |
| Song song | thủ công | `Promise.all` / `allSettled` |
| Hủy | tùy API (thường kém) | `AbortSignal` phổ biến hơn |
| TypeScript | `(err, data) => void` | `Promise<T>` rõ hơn |

### 2.4 Typed err-first (khi bắt buộc)

```ts
import fs from "node:fs";

type NodeCb<T> = (err: NodeJS.ErrnoException | null, result?: T) => void;

function readJson(path: string, cb: NodeCb<unknown>) {
  fs.readFile(path, "utf8", (err, data) => {
    if (err) return cb(err);
    try {
      cb(null, JSON.parse(data));
    } catch (e) {
      cb(e as NodeJS.ErrnoException);
    }
  });
}
```

> API **mới** của bạn: đừng invent err-first. Nếu phải giữ callback surface (C++ addon / legacy), cung cấp thêm bản Promise.

---

## 3. Kiểu hàm trong TypeScript

### 3.1 Function type expression

```ts
type Mapper = (n: number) => number;
type Predicate<T> = (value: T) => boolean;
type Thunk = () => void;

const double: Mapper = (n) => n * 2;
```

### 3.2 Optional / rest

```ts
type Log = (message: string, ...details: unknown[]) => void;
type Handler = (req: Request, res?: Response) => void | Promise<void>;
```

### 3.3 `void` vs `undefined`

```ts
type Effect = () => void;

const ok: Effect = () => 1; // cho phép — caller kiểu void bỏ qua return
```

- `void` ở return của callback: “caller không dùng giá trị trả về”.
- Public API đồng bộ nên dùng kiểu cụ thể / `undefined` nếu caller cần giá trị.

### 3.4 Union của function types

```ts
type StringOrNumFn = ((x: string) => string) | ((x: number) => number);
// Gọi trực tiếp khó — thu hẹp bằng overload / generic
```

---

## 4. Callable interface & construct signature

### 4.1 Call signature

```ts
interface Formatter {
  (value: number): string;
  pattern: string;
}

const fmt: Formatter = Object.assign(
  (value: number) => value.toFixed(2),
  { pattern: "0.00" },
);

fmt(3.14159); // "3.14"
fmt.pattern;
```

Tương đương gần: `type FormatterFn = ((value: number) => string) & { pattern: string }`.

### 4.2 Construct signature

```ts
interface RepoConstructor {
  new (uri: string): { list(): Promise<string[]> };
}

function create(Ctor: RepoConstructor, uri: string) {
  return new Ctor(uri);
}
```

### 4.3 Call vs construct

```ts
type DateCtor = {
  new (value: number): Date;
  (value: number): string; // Date(0) — di sản, không khuyến khích
};
```

---

## 5. Predicates & type guards

```ts
type Predicate<T> = (value: T) => boolean;

const isEven: Predicate<number> = (n) => n % 2 === 0;
[1, 2, 3, 4].filter(isEven);
```

**Type predicate** thu hẹp union:

```ts
function isString(x: unknown): x is string {
  return typeof x === "string";
}

function handle(x: string | number) {
  if (isString(x)) {
    x.toUpperCase(); // string
  }
}
```

`asserts` predicate (TS):

```ts
function assertDefined<T>(x: T | null | undefined): asserts x is T {
  if (x == null) throw new Error("undefined");
}
```

Dùng predicate có tên thay anonymous trong hot filter khi tái sử dụng / test.

---

## 6. Generic functions

```ts
function first<T>(items: readonly T[]): T | undefined {
  return items[0];
}

first([1, 2, 3]); // number | undefined
```

### 6.1 Constraints

```ts
function prop<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

### 6.2 Generic function type

```ts
type Identity = <T>(value: T) => T;
const id: Identity = (value) => value;
```

Khác `type Identity<T> = (value: T) => T` — generic trên alias cố định `T` khi dùng alias.

### 6.3 Inference

```ts
function map<T, U>(arr: readonly T[], fn: (item: T, index: number) => U): U[] {
  const out: U[] = [];
  for (let i = 0; i < arr.length; i++) out.push(fn(arr[i]!, i));
  return out;
}

map(["a", "bb"], (s) => s.length); // number[]
```

Chỉ annotate khi inference sai / cần thu hẹp. Utility sâu: [collections-generics.md](collections-generics.md).

---

## 7. Higher-order, curry nhẹ

Higher-order function (HOF): nhận và/hoặc trả về hàm.

```ts
function withRetry<T>(fn: () => Promise<T>, attempts = 3): () => Promise<T> {
  return async () => {
    let last: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        last = e;
      }
    }
    throw last;
  };
}
```

### 7.1 Wrapper timed

```ts
function timed<A extends unknown[], R>(
  label: string,
  fn: (...args: A) => R,
): (...args: A) => R {
  return (...args: A) => {
    const t0 = performance.now();
    try {
      return fn(...args);
    } finally {
      console.log(`${label}: ${(performance.now() - t0).toFixed(2)}ms`);
    }
  };
}
```

### 7.2 Partial application / curry nhẹ

```ts
const bindHost = (host: string) => (path: string) => `https://${host}${path}`;
const api = bindHost("api.example.com");
api("/users");
```

```ts
function partialRight<A, B, R>(fn: (a: A, b: B) => R, b: B) {
  return (a: A) => fn(a, b);
}
```

> Không cần thư viện curry nặng cho app Node điển hình — arrow lồng 1–2 tầng thường đủ. Curry sâu + placeholder dễ hại readability.

---

## 8. Variance & `strictFunctionTypes`

Dưới `strict` (mặc định **TS 7**), **`strictFunctionTypes`** bật: tham số callback kiểm tra **contravariant** (an toàn hơn).

### 8.1 Ý tưởng

- **Return type:** covariant — hàm trả `Dog` dùng được nơi cần `Animal` (nếu `Dog extends Animal`).
- **Parameter type:** contravariant — nơi cần `(animal: Animal) => void` **không** nhận `(dog: Dog) => void` một cách không an toàn (vì caller có thể truyền `Cat`).

```ts
type Animal = { tag: "animal" };
type Dog = Animal & { bark(): void };

let acceptAnimal: (a: Animal) => void;
let acceptDog: (d: Dog) => void;

// acceptAnimal = acceptDog; // lỗi với strictFunctionTypes — không an toàn
acceptDog = acceptAnimal; // OK — chấp nhận Animal thì chấp nhận Dog
```

### 8.2 Method syntax vs function syntax trong object type

Theo lịch sử TS, **method** trong object type có thể vẫn bivariant (tương thích DOM/legacy); **function property** tuân `strictFunctionTypes` chặt hơn:

```ts
type HandlerMethod = { handle(x: Animal): void };
type HandlerProp = { handle: (x: Animal) => void };
```

Khi thiết kế API callback: prefer **function property** / type alias hàm rõ ràng.

### 8.3 Thực dụng

- Đừng tắt `strictFunctionTypes` để “cho qua” — sửa chữ ký (generic, overload, union đúng).
- Event listener typed: tham số event phải đủ rộng cho mọi emit thực tế.

---

## 9. Overloads vs union params

### 9.1 Union params — đơn giản khi behavior cùng shape

```ts
function len(x: string | unknown[]): number {
  return x.length;
}
```

### 9.2 Overload — khi return/type phụ thuộc đối số

```ts
function parse(input: string): object;
function parse(input: Buffer): object;
function parse(input: string | Buffer): object {
  const text = typeof input === "string" ? input : input.toString("utf8");
  return JSON.parse(text) as object;
}
```

Implementation signature phải bao hết overload; caller chỉ thấy overload công khai.

### 9.3 Khi nào chọn gì

| Tình huống | Chọn |
|---|---|
| Cùng return, xử lý gần giống | union param |
| Return type khác theo input | overload hoặc generic có điều kiện |
| Nhiều overload (>3–4) khó đọc | options object / discriminated union |
| Callback library C-style | overload + xem [functions-methods.md](functions-methods.md) |

```ts
type Result =
  | { kind: "text"; value: string }
  | { kind: "bin"; value: Buffer };

function encode(r: Result): string {
  return r.kind === "text" ? r.value : r.value.toString("base64");
}
```

Discriminated union thường **rõ hơn** overload dài cho domain app.

---

## 10. Closure & capturing

```ts
function makeCounter(start = 0) {
  let n = start;
  return {
    inc: () => ++n,
    value: () => n,
  };
}
```

### 10.1 Module-level closure

```ts
const key = process.env.APP_KEY ?? "";

export function sign(payload: string) {
  return `${payload}.${key.length}`;
}
```

### 10.2 Loop capture

```ts
const handlers: Array<() => number> = [];
for (let i = 0; i < 3; i++) {
  handlers.push(() => i);
}
handlers.map((h) => h()); // [0, 1, 2]
```

Dùng `let`/`const` trong `for` — tránh `var`.

### 10.3 Memory

Tránh capture object lớn không cần thiết trong closure sống lâu (cache process-wide). Copy phần nhỏ cần dùng.

---

## 11. Lambda / arrow như callback

```ts
const nums = [1, 2, 3, 4];
const evens = nums.filter((n) => n % 2 === 0);
```

Async + `map`:

```ts
const pages = await Promise.all(
  urls.map(async (u) => {
    const res = await fetch(u);
    return res.text();
  }),
);
```

`forEach` + `async` **không** await được — dùng `for...of` hoặc `Promise.all`.

Chi tiết `this` với method/arrow: [oop.md](oop.md) §9 · [functions-methods.md](functions-methods.md).

---

## 12. EventEmitter — pointer

```ts
import { EventEmitter } from "node:events";

type UserEvents = {
  login: [userId: string];
  error: [err: Error];
};

class Auth extends EventEmitter<UserEvents> {
  signIn(userId: string) {
    this.emit("login", userId);
  }
}

const auth = new Auth();
auth.on("login", (userId) => console.log("welcome", userId));
```

- Luôn lắng `error` trên stream/emitter khi có thể crash process.
- `once` / `off` / `AbortSignal` tránh leak.
- Chi tiết: [nodejs-apis.md](nodejs-apis.md), [event-loop.md](event-loop.md).

---

## 13. Best practices

1. API mới: `Promise<T>` / `async function` — không invent err-first.
2. Đặt tên kiểu rõ: `Predicate<T>`, `Mapper<T,U>`, `Middleware`.
3. HOF cho cross-cutting (retry, timeout, log) thay copy-paste.
4. `unknown` cho `err` rồi thu hẹp — [exceptions.md](exceptions.md).
5. Giữ `strictFunctionTypes`; sửa chữ ký thay vì nới lỏng.
6. Overload khi cần; discriminated union khi domain phức tạp.
7. Curry nhẹ (1–2 tầng); tránh curry framework.
8. `map(async)` → nhớ `Promise.all` / pool có giới hạn.
9. Callback method: bind / arrow — xem OOP.
10. Cross-link khai báo hàm đầy đủ ở [functions-methods.md](functions-methods.md).

---

## 14. Checklist

```text
□ Callback legacy? có bản Promise / promisify
□ Function type / callable interface đặt tên rõ
□ Predicate / type guard khi filter union
□ Generic: inference đủ; annotate khi cần
□ HOF wrap không nuốt lỗi
□ strictFunctionTypes: param callback an toàn
□ Overload cụ thể trước; impl bao hết — hoặc dùng union/discriminant
□ Closure: let trong loop; không giữ buffer khổng lồ
□ forEach+async tránh; Promise.all / for-await
□ EventEmitter: off / signal; listen error
```

---

## 15. Cheat sheet

```ts
type Fn = (a: number, b?: string) => boolean;
type Predicate<T> = (value: T) => boolean;
interface Callable {
  (x: string): void;
  meta: string;
}
type GenFn = <T>(x: T) => T;
type HOF = <T>(fn: () => T) => () => T;

function isStr(x: unknown): x is string {
  return typeof x === "string";
}

// Overload skeleton
function f(x: string): number;
function f(x: number): string;
function f(x: string | number): number | string {
  return typeof x === "string" ? x.length : String(x);
}
```

| Cần | Chọn |
|---|---|
| I/O mới | Promise / async |
| Legacy Node | err-first + `promisify` |
| Thu hẹp kiểu | `x is T` predicate |
| Partial config | curry nhẹ / partial |
| Return phụ thuộc arg | overload / conditional type |
| Listener typed | function prop + strictFunctionTypes |

---

## 16. Version notes

| Nền | Liên quan |
|---|---|
| ES2015 | arrow, rest/default, Promise |
| ES2017 | async/await |
| Node cổ điển | err-first callback |
| Node hiện đại | `fs/promises`, `fetch`, `util.promisify` |
| TS | function types, call/construct signatures, overload |
| TS `strictFunctionTypes` | param callback contravariant (trong `strict`) |
| **TS 7** | `strict` mặc định → variance chặt hơn codebase cũ |
| **Node 26** | Promise-first builtins; AbortSignal phổ biến |

Baseline: **Node 26** + **TS 7**.

---

## 17. Tài liệu liên quan

- [Hàm & Method](functions-methods.md) — declaration, `this`, overload, generators
- [Exception / Error](exceptions.md)
- [Lập trình bất đồng bộ](async.md)
- [AbortSignal & request context](abort-context.md)
- [Iterator, Iterable & “LINQ-like”](iterables-linq.md)
- [Lập trình hướng đối tượng](oop.md)
- [Node.js built-ins](nodejs-apis.md) — `events`
- [Node 26 & TypeScript 7 highlights](node26-ts7.md)
