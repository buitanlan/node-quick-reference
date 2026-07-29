# Function type, Callback & Lambda

Trong JavaScript/TypeScript, hàm là **giá trị first-class**: gán biến, truyền đối số, trả về từ hàm khác. Phần này tập trung kiểu hàm (TS), callback (Node-style vs Promise), higher-order function, closure, và gợi ý `EventEmitter`.

> Đọc kèm: [Hàm & Method](functions-methods.md), [Lập trình bất đồng bộ](async.md), [Exception / Error](exceptions.md).

---

## Mục lục

1. [First-class functions](#1-first-class-functions)
2. [Callback Node-style (err-first) vs Promises](#2-callback-node-style-err-first-vs-promises)
3. [Kiểu hàm trong TypeScript](#3-kiểu-hàm-trong-typescript)
4. [Callable interface & construct signature](#4-callable-interface--construct-signature)
5. [Generic functions](#5-generic-functions)
6. [Higher-order functions](#6-higher-order-functions)
7. [Closure & capturing](#7-closure--capturing)
8. [Lambda / arrow như callback](#8-lambda--arrow-như-callback)
9. [EventEmitter — pointer](#9-eventemitter--pointer)
10. [Best practices](#10-best-practices)

---

## 1. First-class functions

```ts
function greet(name: string) {
  return `Hello, ${name}`;
}

const g = greet;                 // gán
const fns = [greet, (n: string) => n.toUpperCase()]; // lưu trong collection
const once = (f: typeof greet) => f; // truyền / trả về

console.log(g("Node"));
```

Hệ quả thực tế:

- Middleware, plugin, strategy, pipeline đều là “truyền hàm”.
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

### 2.2 Promise / async-await (khuyến nghị hiện đại)

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

### 2.3 So sánh nhanh

| | Err-first callback | Promise / async |
|---|---|---|
| Lỗi | `err` đối số đầu | reject / throw |
| Chuỗi thao tác | lồng nhau | `then` / `await` |
| Song song | thủ công | `Promise.all` / `allSettled` |
| TypeScript | `(err, data) => void` | `Promise<T>` rõ ràng hơn |

### 2.4 Typed err-first (khi bắt buộc)

```ts
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

---

## 3. Kiểu hàm trong TypeScript

### 3.1 Function type expression

```ts
type Mapper = (n: number) => number;
type Predicate<T> = (value: T) => boolean;
type Thunk = () => void;

const double: Mapper = (n) => n * 2;
```

### 3.2 Optional / rest trong kiểu hàm

```ts
type Log = (message: string, ...details: unknown[]) => void;
type Handler = (req: Request, res?: Response) => void | Promise<void>;
```

### 3.3 `void` vs `undefined` vs không trả về

```ts
type Effect = () => void;

const ok: Effect = () => 1; // cho phép — TS bỏ qua return value khi target là void
// hữu ích với forEach: callback có thể return gì cũng được
```

- `void` ở vị trí return của callback: “caller không dùng giá trị trả về”.
- Public API đồng bộ nên dùng `undefined` rõ hoặc kiểu cụ thể nếu caller cần giá trị.

### 3.4 Union của function types

```ts
type StringOrNumFn = ((x: string) => string) | ((x: number) => number);
// Gọi trực tiếp khó — thường thu hẹp bằng overload / generic
```

---

## 4. Callable interface & construct signature

### 4.1 Call signature

```ts
interface Formatter {
  (value: number): string;
  pattern: string; // property kèm theo — giống callable object
}

const fmt: Formatter = Object.assign(
  (value: number) => value.toFixed(2),
  { pattern: "0.00" },
);

fmt(3.14159); // "3.14"
fmt.pattern;
```

Tương đương gần:

```ts
type FormatterFn = ((value: number) => string) & { pattern: string };
```

### 4.2 Construct signature

```ts
interface RepoConstructor {
  new (uri: string): { list(): Promise<string[]> };
}

function create(Ctor: RepoConstructor, uri: string) {
  return new Ctor(uri);
}
```

### 4.3 Phân biệt call vs construct

```ts
type DateCtor = {
  new (value: number): Date; // new Date(0)
  (value: number): string;   // Date(0) — không khuyến khích
};
```

Trong lib DOM/Node, nhiều built-in vừa callable vừa constructable (di sản).

---

## 5. Generic functions

```ts
function first<T>(items: readonly T[]): T | undefined {
  return items[0];
}

first([1, 2, 3]);        // number | undefined
first(["a", "b"]);       // string | undefined
```

### 5.1 Constraints

```ts
function prop<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const name = prop({ id: 1, name: "a" }, "name"); // string
```

### 5.2 Multiple type params & inference

```ts
function map<T, U>(arr: readonly T[], fn: (item: T, index: number) => U): U[] {
  const out: U[] = [];
  for (let i = 0; i < arr.length; i++) out.push(fn(arr[i]!, i));
  return out;
}

map(["a", "bb"], (s) => s.length); // number[]
```

TS suy luận `T`/`U` từ đối số; chỉ annotate khi inference sai / cần thu hẹp.

### 5.3 Generic function type

```ts
type Identity = <T>(value: T) => T;

const id: Identity = (value) => value;
```

Khác `type Identity<T> = (value: T) => T` (generic trên type alias — cố định `T` khi dùng alias).

### 5.4 Constraints với conditional (overview)

```ts
type AwaitedLike<T> = T extends Promise<infer U> ? U : T;

async function unwrap<T>(value: T): Promise<AwaitedLike<T>> {
  return await value as AwaitedLike<T>;
}
```

Chi tiết utility types: xem [Tập hợp & Generics](collections-generics.md).

---

## 6. Higher-order functions

Higher-order function (HOF): nhận và/hoặc trả về hàm.

```ts
function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
): () => Promise<T> {
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

const load = withRetry(() => fetch("https://example.com").then((r) => r.text()));
```

### 6.1 Decorator-style wrapper

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

const work = timed("sum", (n: number) => {
  let s = 0;
  for (let i = 0; i < n; i++) s += i;
  return s;
});
```

### 6.2 Partial application / curry (thực dụng)

```ts
const bindHost = (host: string) => (path: string) => `https://${host}${path}`;
const api = bindHost("api.example.com");
api("/users"); // https://api.example.com/users
```

Không cần thư viện curry nặng — arrow lồng nhau thường đủ.

---

## 7. Closure & capturing

Closure: hàm **nhớ** biến lexical từ scope ngoài dù scope đó đã kết thúc.

```ts
function makeCounter(start = 0) {
  let n = start;
  return {
    inc: () => ++n,
    value: () => n,
  };
}

const c = makeCounter(10);
c.inc(); // 11
c.value(); // 11
```

### 7.1 Module-level closure (Node ESM)

```ts
// secrets.ts
const key = process.env.APP_KEY ?? "";

export function sign(payload: string) {
  // capture `key` — không export trực tiếp
  return `${payload}.${key.length}`;
}
```

### 7.2 Pitfall: capture trong vòng lặp

```ts
// var (tránh) → cùng một binding
// let/const trong for → mỗi vòng một binding

const handlers: Array<() => number> = [];
for (let i = 0; i < 3; i++) {
  handlers.push(() => i);
}
handlers.map((h) => h()); // [0, 1, 2]
```

### 7.3 Closure giữ reference → memory

```ts
function attach(huge: Uint8Array) {
  const head = huge.subarray(0, 4);
  return () => head[0]; // có thể giữ toàn bộ `huge` tùy engine/opt
}
```

Tránh capture object lớn không cần thiết; copy phần nhỏ cần dùng.

---

## 8. Lambda / arrow như callback

```ts
const nums = [1, 2, 3, 4];
const evens = nums.filter((n) => n % 2 === 0);
const labels = nums.map((n) => `#${n}`);
```

Async callback:

```ts
const urls = ["/a", "/b"];

// Sai phổ biến: map async trả Promise[] — cần Promise.all
const pages = await Promise.all(urls.map(async (u) => {
  const res = await fetch(u);
  return res.text();
}));
```

`forEach` + `async` **không** await được:

```ts
// Tránh
items.forEach(async (x) => {
  await save(x); // fire-and-forget
});

// Nên
for (const x of items) {
  await save(x);
}
// hoặc
await Promise.all(items.map((x) => save(x)));
```

---

## 9. EventEmitter — pointer

Node dùng **observer pattern** qua `EventEmitter` (`node:events`): đăng ký hàm listener, phát event.

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
auth.on("login", (userId) => {
  console.log("welcome", userId);
});
auth.on("error", (err) => {
  console.error(err);
});
```

Ghi chú thực dụng:

- Listener là callback thường / arrow; cẩn thận `this` nếu dùng method thường.
- Luôn lắng `error` trên stream/emitter — error không có listener có thể crash process.
- Prefer typed events (generic `EventEmitter` trong Node hiện đại / thư viện).
- `once`, `off`/`removeListener`, `removeAllListeners` để tránh leak.
- Chi tiết lifecycle & backpressure: xem tài liệu Event loop / Node APIs.

`EventTarget` / `AbortSignal` cũng dùng callback theo hướng Web API — ngày càng phổ biến trong Node.

---

## 10. Best practices

**Nên**

- API mới: trả `Promise<T>` / `async function`, không invent err-first mới.
- Đặt tên kiểu hàm rõ: `Predicate<T>`, `Mapper<T,U>`, `Middleware`.
- HOF để tái sử dụng cross-cutting (retry, timeout, log) thay vì copy-paste.
- Dùng `unknown` cho `err` rồi thu hẹp — xem `exceptions.md`.

**Tránh**

- Callback hell; nếu phải giữ callback API → cung cấp bản `promisify`.
- Nuốt lỗi trong callback: `if (err) return;` mà không log/forward.
- Generic “quá thông minh” làm inference vỡ — simplify chữ ký.
- Capture state mutable lớn trong closure sống lâu (cache toàn process).

**Cheat sheet kiểu hàm**

```ts
type Fn = (a: number, b?: string) => boolean;
interface Callable { (x: string): void; meta: string }
type GenFn = <T>(x: T) => T;
type HOF = <T>(fn: () => T) => () => T;
```

---

## Tài liệu liên quan

- [Hàm & Method](functions-methods.md)
- [Exception / Error](exceptions.md)
- [Lập trình bất đồng bộ](async.md)
- [Iterator, Iterable & “LINQ-like”](iterables-linq.md)
