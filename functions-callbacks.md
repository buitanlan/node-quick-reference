# Function type, Callback & Lambda

Trong JavaScript/TypeScript, hàm là **giá trị first-class**: gán biến, truyền đối số, trả về từ hàm khác. Chương này tập trung **kiểu hàm (TS)**, callback (Node err-first vs Promise), higher-order, predicate, variance (`strictFunctionTypes`), và overload vs union params.

> Đọc kèm (cú pháp khai báo / `this` / overload runtime): [Hàm & Method](functions-methods.md). Async sâu: [async.md](async.md). Lỗi: [exceptions.md](exceptions.md). Event loop: [event-loop.md](event-loop.md).

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

Composition **trái → phải** như `reduce` trên (pipeline Unix). `compose` toán học thường phải → trái: `(f, g) => (x) => f(g(x))`. Đặt tên rõ `pipe` vs `compose` — đừng mix.

Hàm first-class có `name`/`length` — wrap HOF nên giữ `name` nếu stack production quan trọng. So sánh tham chiếu (`fn === greet`) đứt sau bind/wrap.

### 1.1 Identity / map types (HOF ở tầng type)

TS **không** có higher-kinded types thật (`Functor<F<_>>`). Mô phỏng bằng alias generic **trên hàm**, không gắn `T` sẵn trên alias:

```ts
type Identity = <T>(value: T) => T;
const id: Identity = (value) => value;
id("a"); // string
id(1);   // number

type IdentityFixed<T> = (value: T) => T;
const idNum: IdentityFixed<number> = (value) => value;
// idNum("a"); // lỗi — T đã đóng

type Mapper<T, U> = (value: T, index: number) => U;
type Predicate<T> = (value: T) => boolean;
type Refinement<A, B extends A> = (value: A) => value is B;
type Endo<T> = (value: T) => T;
type Thunk<T> = () => T;
type Task<T> = () => Promise<T>;
```

| Alias | Ý nghĩa |
|---|---|
| `Identity` (generic trên hàm) | Giữ nguyên kiểu từng lần gọi |
| `IdentityFixed<T>` | Một `T` cho cả lifetime alias |
| `Mapper<T,U>` | Select / `map` |
| `Predicate<T>` | `filter` boolean — **không** thu hẹp union |
| `Refinement<A,B>` | type guard |
| `Endo<T>` | transform cùng kiểu (pipeline) |

`Array.prototype.map` typed gần `Mapper`; truyền predicate thường `filter` không hẹp trừ khi `x is T`.

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

Pyramid điển hình (tránh):

```js
fs.readFile("a.json", "utf8", (e1, a) => {
  if (e1) return cb(e1);
  fs.readFile("b.json", "utf8", (e2, b) => {
    if (e2) return cb(e2);
    cb(null, [a, b]);
  });
});
```

`Promise.all` + `fs/promises` thay lồng. `async.waterfall` kiểu cũ không cần trên Node 26.

### 2.2 Hợp đồng `err`: `null` vs `undefined`

Node core **thường** gọi `cb(null, value)` khi thành công. Một số thư viện / code tay dùng `cb(undefined, value)` hoặc `cb()`. Consumer an toàn:

| Kiểm tra | `null` | `undefined` | `Error` | `0` / `""` / `false` |
|---|---|---|---|---|
| `if (err)` | falsy → OK | falsy → OK | vào nhánh lỗi | **nhầm thành công** |
| `if (err != null)` | OK | OK | OK | **nhầm** nếu err “falsy” |
| `if (err === null)` | OK | **bỏ sót** `undefined` | OK | không vào |

> **Callout:** `if (err)` đủ cho Node core (`null` / `Error`). **Không** dùng giá trị falsy làm `err`. Thành công: `cb(null, result)` (hoặc `cb(null)` nếu không có value). Thất bại: `cb(err)` — **không** kèm `result` (tránh caller đọc data khi lỗi).

Không bao giờ:

- `cb(err, result)` **và** `throw` cùng path.
- Gọi callback **hai lần** (lỗi cổ điển addon / “forgot return”).
- `cb("string")` — không phải `Error`; TS/`unknown` sẽ đau. Prefer `Error` + `cause`.

```ts
type NodeCb<T> = (err: NodeJS.ErrnoException | null, result?: T) => void;

function readJson(path: string, cb: NodeCb<unknown>) {
  fs.readFile(path, "utf8", (err, data) => {
    if (err) return cb(err);
    try {
      cb(null, JSON.parse(data));
    } catch (e) {
      cb(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
```

`result?` trên success: một số API luôn truyền `result` (kể cả `undefined` hợp lệ). Phân biệt “lỗi” vs “không có data”: **chỉ** nhìn `err`, không nhìn `result == null`.

### 2.3 Callback **once** vs maybe-once

Hợp đồng err-first: callback **đúng một lần**. Double-call → race (resolve + reject Promise, double-write, uncaught).

```ts
function onceCb<T>(cb: NodeCb<T>): NodeCb<T> {
  let called = false;
  return (err, result) => {
    if (called) return; // maybe-once: nuốt lần sau — log nếu debug
    called = true;
    cb(err, result);
  };
}
```

| Pattern | Hành vi |
|---|---|
| **once** | Lần 2 ném / assert — bắt bug producer |
| **maybe-once** | Lần 2 bỏ qua — phòng stream `error` + `finish` |
| Không bảo vệ | Double `cb` = undefined behavior |

Stream / `error` + `close`: cả hai có thể emit. Wrap maybe-once **hoặc** `pipeline` / `finished` (Promise) — [async.md](async.md) §9.

`events.once` **không** phải err-first callback; nó là Promise cho **một** event (kèm `error` reject trên EventEmitter):

```ts
import { once, EventEmitter } from "node:events";

const ee = new EventEmitter();
const p = once(ee, "ready"); // Promise<unknown[]>
```

> **Callout:** “once” listener (`ee.once`) ≠ “callback once”. Listener gỡ sau lần 1; producer err-first vẫn có thể gọi `cb` hai lần nếu bug.

### 2.4 Promise / async-await (khuyến nghị)

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

### 2.5 `util.promisify` & symbol tùy biến

`promisify(fn)` giả định **đối số cuối** là err-first callback; trả function bỏ callback, return `Promise`. Không phải hàm → throw. Sai convention (callback giữa, continuation-passing khác) → Promise treo hoặc hành vi lạ.

**`this`:** `promisify(obj.method)` detach — `this === undefined` lúc gọi. Bind: `promisify(obj.method.bind(obj))` hoặc `promisify(obj.method).call(obj, …)`.

Thư viện tự cung cấp bản Promise tối ưu qua **`util.promisify.custom`** (cũng là `Symbol.for("nodejs.util.promisify.custom")` — xuyên realm/bundle):

```ts
import { promisify } from "node:util";

function delay(ms: number, cb: (err: Error | null) => void) {
  setTimeout(() => cb(null), ms);
}

delay[promisify.custom] = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const wait = promisify(delay);
// wait === delay[promisify.custom]
await wait(10);
```

Nếu `promisify.custom` **có** nhưng không phải function → `promisify` throw. Dùng custom khi:

- Callback overload không err-first chuẩn,
- Đã có Promise native (tránh wrap kép),
- Cần `AbortSignal` / nhiều value (`cb(null, a, b)` — promisify mặc định chỉ lấy **một** result; custom trả tuple).

`callbackify(asyncFn)` ngược lại (hiếm): API đòi err-first. Rejection → `cb(err)`; fulfill → `cb(null, value)`.

Chi tiết combinators → [async.md](async.md) §8.

`promisify` trên hàm **đã** trả Promise: vẫn inject callback cuối trừ khi có `.custom` — dễ double-then. Detect: nếu API có cả callback overload và Promise overload (nhiều Node builtin), **gọi bản Promise** (`fs.promises`) chứ đừng `promisify` bản callback.

Nhiều giá trị: `cb(null, a, b)` → `promisify` chỉ fulfill `a`. Custom trả tuple `[a, b]` nếu caller cần cả hai.

### 2.6 So sánh

| | Err-first callback | Promise / async | EventEmitter |
|---|---|---|---|
| Lỗi | `err` đối số đầu | reject / throw | `"error"` (không listener → crash) |
| Số lần | **một** (once) | settle một lần | 0..N events |
| Chuỗi | lồng nhau | `then` / `await` | không phải pipeline giá trị |
| Song song | thủ công | `Promise.all` | nhiều emit |
| Hủy | tùy API | `AbortSignal` phổ biến | `off` / `{ signal }` |
| TypeScript | `(err, data) => void` | `Promise<T>` | generic event map |

### 2.7 Typed err-first (khi bắt buộc)

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

> API **mới** của bạn: đừng invent err-first. Nếu phải giữ callback surface (C++ addon / legacy), cung cấp thêm bản Promise — và gắn `promisify.custom` nếu `promisify` cần đi đường tắt.

### 2.8 EventEmitter vs callback (một kết quả)

Dùng **callback / Promise** khi: một kết quả, một lỗi, caller `await`. Dùng **EventEmitter** khi: nhiều lần (`data` chunks), nhiều loại event, fan-out listeners.

```ts
// Sai: EventEmitter cho “load config một lần”
ee.on("config", handler);
ee.on("error", …);

// Đúng hơn: Promise<Config> hoặc callback once
```

`stream.Readable` vừa iterable-async vừa emitter — không thay bằng một callback `cb(err, allChunks)` trừ khi đã buffer hết (tốn RAM). Backpressure → [iterables-linq.md](iterables-linq.md), [nodejs-apis.md](nodejs-apis.md).

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
- `() => undefined` **không** nhận `() => 1` chặt như `void` (tùy `strictNullChecks`).
- Promise callback: `() => Promise<void>` vẫn có thể return Promise\<number\> vì Promise covariant… **không** — Promise là invariant/covariant theo vị trí; `Promise<number>` gán `Promise<void>` thường OK vì `number` → không dùng. Listener async trả Promise bị discard → unhandled rejection nếu reject. Fire-and-forget: void-wrap `void promise` hoặc `.catch`.

### 3.4 Union của function types

```ts
type StringOrNumFn = ((x: string) => string) | ((x: number) => number);
// Gọi trực tiếp khó — thu hẹp bằng overload / generic
```

Union hàm gần như **không gọi được** (intersection của param). Prefer overload, generic, hoặc discriminated wrapper `{ kind, fn }`.

### 3.5 `this` trên function type

```ts
type BoundGreet = (this: { name: string }, punct: string) => string;
```

Gán arrow vào `BoundGreet`: `this` lexical vs annotated — TS có thể lỗi. Method extract: `OmitThisParameter`. Chi tiết binding → [functions-methods.md](functions-methods.md) §2.

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

Nhiều call signature = overload trên interface (merge).

### 4.2 Construct signature

```ts
interface RepoConstructor {
  new (uri: string): { list(): Promise<string[]> };
}

function create(Ctor: RepoConstructor, uri: string) {
  return new Ctor(uri);
}
```

`InstanceType<typeof Cls>` / `ConstructorParameters<typeof Cls>` suy từ class.

### 4.3 Call vs construct

```ts
type DateCtor = {
  new (value: number): Date;
  (value: number): string; // Date(0) — di sản, không khuyến khích
};
```

Class TS emit cả hai nếu `class` — `typeof MyClass` là construct type. Arrow **không** construct. Mixin / DI: nhận `new (...args: A) => T` chứ không `(...args: A) => T`.

### 4.4 `typeof fn` vs `(...args) => R`

`typeof greet` lấy chữ ký thực (overload, `this`, generic). Alias `type G = (name: string) => string` **bỏ** overload. Prefer `typeof` khi wrap đúng một hàm có sẵn (`Parameters<typeof fs.readFile>` — overload phức tạp, đôi khi cần helper).

`new (...a: never[]) => unknown` từ chối arbitrary construct khi chỉ cần callable. Ngược lại `abstract new` cho abstract class constructor type.

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

### 5.1 `filter` + guard vs boolean

```ts
const mixed: Array<string | number> = ["a", 1];
mixed.filter((x) => typeof x === "string"); // vẫn (string|number)[] — boolean không hẹp
mixed.filter((x): x is string => typeof x === "string"); // string[]
```

`Boolean` / `Boolean` constructor **không** phải type guard chuẩn cho `T | null` trên mọi version — viết `isDefined`:

```ts
function isDefined<T>(x: T | null | undefined): x is T {
  return x != null;
}
xs.filter(isDefined);
```

### 5.2 Unsound guards

TS **tin** chữ ký `x is T`. Guard sai → lỗ thủng:

```ts
function asUser(x: unknown): x is { id: string } {
  return true; // dối — x.id crash runtime
}
```

Guard nên kiểm tra **đủ field** cần dùng (zod/valibot cho I/O). Nội bộ: `typeof` / `instanceof` / discriminant `kind`.

`instanceof` cross-realm (`vm`, worker) fail — [oop.md](oop.md) §8, [exceptions.md](exceptions.md).

### 5.3 Discriminated union > ad-hoc guard

```ts
type Ev = { type: "open"; fd: number } | { type: "err"; error: Error };

function isOpen(e: Ev): e is Extract<Ev, { type: "open" }> {
  return e.type === "open";
}
```

`switch (e.type)` thường đủ, không cần hàm `isOpen` trừ khi reuse.

### 5.4 `asserts` vs `x is T`

| | `x is T` | `asserts x is T` |
|---|---|---|
| Return | `boolean` | `void` (throw nếu sai) |
| Dùng | `if (isT(x))` / `filter` | `assertT(x)` rồi dùng tiếp |
| Sai | nhánh else | ném — control flow hẹp sau câu lệnh |

`asserts` không dùng trong `filter`. `assert` Node (`node:assert`) **không** hẹp TS trừ wrapping.

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

`T extends object`, `T extends (...args: never[]) => unknown` cho “phải là hàm”. Constraint tối thiểu — tránh `any`. Variance collections → [collections-generics.md](collections-generics.md).

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

`const` type params (TS 5+/7): `function f<const T extends readonly unknown[]>(…)` — infer literal tuple thay widen.

### 6.4 Callback generic & inference fail

```ts
function callApi<T>(parse: (raw: unknown) => T, raw: unknown): T {
  return parse(raw);
}
```

Truyền `parse` quá rộng `(x: unknown) => unknown` → `T = unknown`. Annotate `callApi<User>(…)` hoặc predicate `x is User`. Context-sensitive inference: `(n) => n * 2` trong `map` infer `n` từ mảng; **tách biến** `const fn = (n) => n * 2` có thể thành implicit `any` nếu không annotate — bật `noImplicitAny`.

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

Giữ `this` nếu wrap method: `function (this: This, ...args: A)` + `fn.apply(this, args)`. Copy `name`/`length` nếu stack/ops quan trọng — [functions-methods.md](functions-methods.md) §8.

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

### 7.3 `once` / `memoize` — pitfalls

```ts
function once<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let done = false;
  let value: R;
  return (...args: A) => {
    if (!done) {
      value = fn(...args);
      done = true;
    }
    return value;
  };
}
```

| Bẫy | Chi tiết |
|---|---|
| **Bỏ args** | `once` điển hình **không** key theo args — lần 2 nuốt input khác |
| **`this`** | Wrap method: mất `this` nếu không `apply` |
| **Throw** | `once` sync: throw lần 1 → lần 2 có thể retry hoặc cache lỗi (chọn một) |
| **Promise** | `once` async: cache **Promise** (in-flight) kẻo stampede; reject có cache? thường xóa cache để retry |
| **Memoize unbounded** | `Map` theo JSON key → leak bộ nhớ; key object theo reference |
| **Memoize mutation** | Cache object rồi caller mutate → lần sau bẩn |
| **WeakMap** | Chỉ khi key là object + lifetime theo key |

```ts
function memoize<K, V>(fn: (key: K) => V): (key: K) => V {
  const cache = new Map<K, V>();
  return (key) => cache.getOrInsertComputed(key, fn);
}
```

`getOrInsertComputed` (Node 26) đúng “compute một lần / key”. Key primitive OK trên `Map`; object key = reference. Không JSON.stringify key phức tạp (thứ tự field, `undefined`).

`once` event (`ee.once`) ≠ `once(fn)` HOF.

### 7.4 Debounce / throttle (sketch)

Không thay lodash; đủ để không invent sai semantics.

**Debounce:** chờ yên `ms` rồi gọi **lần cuối**. **Throttle:** tối đa một lần / `ms` (leading và/hoặc trailing).

```ts
function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
  signal?: AbortSignal,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abort = () => {
    if (timer !== undefined) clearTimeout(timer);
  };
  signal?.addEventListener("abort", abort, { once: true });
  return (...args: A) => {
    if (signal?.aborted) return;
    abort();
    timer = setTimeout(() => fn(...args), ms);
  };
}

function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let locked = false;
  let pending: A | undefined;
  return (...args: A) => {
    if (locked) {
      pending = args; // trailing sketch
      return;
    }
    fn(...args);
    locked = true;
    setTimeout(() => {
      locked = false;
      if (pending) {
        const p = pending;
        pending = undefined;
        fn(...p);
      }
    }, ms);
  };
}
```

| | Debounce | Throttle |
|---|---|---|
| Gõ search | Chờ user dừng | — |
| Scroll / mousemove | — | Giới hạn tần suất |
| Async `fn` | Không cancel in-flight trừ AbortSignal | Có thể chồng nếu `fn` chậm hơn `ms` |
| Test | Fake timer | Fake timer |

Node: `setTimeout` không drift-compensate. Server debounce theo **request** + `AbortSignal` (client hủy) — [abort-context.md](abort-context.md). Đừng debounce toàn process một user nếu multi-tenant.

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

### 8.2 Bảng variance (function types)

Giả sử `Dog extends Animal`. Cột “gán vào biến kiểu…”.

| Giá trị có kiểu | `(a: Animal) => void` | `(d: Dog) => void` | `() => Animal` | `() => Dog` |
|---|---|---|---|---|
| `(a: Animal) => void` | OK | OK (contra) | — | — |
| `(d: Dog) => void` | **Không** (strict) | OK | — | — |
| `() => Animal` | — | — | OK | **Không** |
| `() => Dog` | — | — | OK (co) | OK |

Return **covariant**; param **contravariant**. Generic default invariant trừ `in`/`out` (TS 4.7+; dùng khi viết thư viện container).

`Promise<T>`: `T` covariant trên fulfill value — `Promise<Dog>` ~ `Promise<Animal>` (readonly). **Mutable** `Array<Dog>` gán `Array<Animal>` là lỗ TS có chủ đích (bivariant array historically / covariant unsound) — [collections-generics.md](collections-generics.md).

### 8.3 Method syntax vs function syntax trong object type

Theo lịch sử TS, **method** trong object type có thể vẫn bivariant (tương thích DOM/legacy); **function property** tuân `strictFunctionTypes` chặt hơn:

```ts
type HandlerMethod = { handle(x: Animal): void };
type HandlerProp = { handle: (x: Animal) => void };

const onlyDog = {
  handle(x: Dog) {
    x.bark();
  },
};

const asMethod: HandlerMethod = onlyDog; // thường OK — bivariant method (không an toàn)
// const asProp: HandlerProp = onlyDog; // lỗi dưới strictFunctionTypes
```

Khi thiết kế API callback: prefer **function property** / type alias hàm rõ ràng.

> **Callout:** Class method, object method shorthand, và interface `m(): void` đi cửa **method**. `m: () => void` đi cửa **function**. DOM `addEventListener` sống nhờ bivariance — đừng copy thói quen đó sang service layer.

### 8.4 Thực dụng

- Đừng tắt `strictFunctionTypes` để “cho qua” — sửa chữ ký (generic, overload, union đúng).
- Event listener typed: tham số event phải đủ rộng cho mọi emit thực tế.
- Callback generic `fn: (x: T) => void` với `T` invariant: đừng ép `T` hẹp hơn nguồn.

```ts
function onEach<T>(xs: readonly T[], fn: (x: T) => void) {
  for (const x of xs) fn(x);
}
```

`fn` phải chấp nhận **mọi** `T` trong mảng — contra so với producer.

### 8.5 Optional / rest params & assignability

Hàm **ít param hơn** gán được vào kiểu nhiều param (param extra bị bỏ): `(a: number) => void` gán `(a: number, b: string) => void`. Ngược lại **không**. Rest: `(...args: number[]) => void` vs tuple params — kiểm tra từng case; `strictBindCallApply` siết `bind`/`call`.

`void` return: `(x: number) => number` gán `(x: number) => void` (bỏ return). Ngược lại không nếu caller dùng giá trị.

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

Implementation signature phải bao hết overload; caller chỉ thấy overload công khai. Chi tiết impl vs declaration → [functions-methods.md](functions-methods.md) §4.

### 9.3 Khi nào chọn gì (decision table)

| Tình huống | Chọn | Tránh |
|---|---|---|
| Cùng return, xử lý gần giống | union param | Overload song song 2 chữ ký giống hệt |
| Return type khác theo input | overload **hoặc** generic có điều kiện | Union return bắt caller hẹp tay |
| `string` vs `string[]` dễ nhầm overload đầu | overload cụ thể + test call-site | `any` làm match overload 1 |
| Nhiều overload (>3–4) khó đọc | options object / discriminated union | 12 overload `fs.readFile`-style |
| Callback library C-style | overload + xem [functions-methods.md](functions-methods.md) | Union hàm không gọi được (§3.4) |
| Type predicate theo tag | overload `x is A` / `x is B` | Một `x is A \| B` |
| Domain app 2–3 biến thể | discriminated union | Overload + impl `if` trùng discriminant |
| Conditional type `T extends string ? …` | generic public | Overload trùng logic conditional |

```ts
type Result =
  | { kind: "text"; value: string }
  | { kind: "bin"; value: Buffer };

function encode(r: Result): string {
  return r.kind === "text" ? r.value : r.value.toString("base64");
}
```

Discriminated union thường **rõ hơn** overload dài cho domain app.

### 9.4 Overload vs conditional

```ts
function wrap<T extends string | number>(x: T): T extends string ? number : string {
  return (typeof x === "string" ? x.length : String(x)) as never;
}
```

Generic conditional: một chữ ký, caller thấy return phụ thuộc `T`. Overload dễ đọc hơn với 2–3 case literal; conditional scale theo `T` phức tạp. `as never` trong impl = tín hiệu: TS không chứng minh — test runtime.

### 9.5 Overload matching thực tế

TS chọn overload **đầu tiên assignable**, không phải “cụ thể nhất”:

```ts
function fmt(x: unknown): string;
function fmt(x: string): number; // chết — unknown đã nuốt string
function fmt(x: unknown): string | number {
  return typeof x === "string" ? x.length : String(x);
}
```

Đặt `string` **trước** `unknown`. Literal `0` match `number` trước `string | number` nếu thứ tự đúng. `any` match **overload đầu** — `noImplicitAny` + tránh `any` ở call-site.

Spread args `fmt(...arr)` dễ rơi impl/union — annotate tuple `as const` hoặc overload rest.

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

Secret trong closure module **không** an toàn hơn biến thường — vẫn dump heap. Chỉ giới hạn surface.

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

HOF `memoize` / `once` **giữ** `fn` + cache mãi — gỡ reference nếu request-scoped.

### 10.4 Callback queues & stale closure

```ts
function makeHandler(version: number) {
  return () => version; // đóng over `version` lúc tạo
}
let v = 1;
const h = makeHandler(v);
v = 2;
h(); // 1 — primitive capture-by-value qua binding lúc gọi makeHandler
```

Object capture-by-reference: mutate field vẫn thấy. Stale: debounce giữ `args` cuối — OK; giữ `req` object rồi reuse sau `await` khi request đã abort — bug. Kết hợp `AbortSignal.aborted` trước khi gọi `fn`.

Listener đăng ký trong vòng `for (const item of items) ee.on("x", () => item)`: `const` mỗi vòng một binding — đúng. `var` — sai.

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

Arrow không `arguments` — rest. Debounce/throttle/once wrap **trả** function thường hoặc arrow; nếu cần `this` dynamic, đừng dùng arrow wrapper.

`map(async)` tạo **mọi** Promise ngay — không backpressure. Pool: [async.md](async.md) §6. Iterator lazy: [iterables-linq.md](iterables-linq.md).

`sort` comparator `(a, b) => a - b` là callback thuần; trả boolean là bug (xem [collections-generics.md](collections-generics.md)). Predicate `find` short-circuit — HOF khác `map`.

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
- Listener **không** err-first: lỗi qua event `error` hoặc Promise API (`once(ee, "e")`).
- `prependListener` / `rawListeners` hiếm khi cần app — debugging.
- Max listeners (`setMaxListeners`) cảnh báo leak, không phải hợp đồng nghiệp vụ.

Chi tiết: [nodejs-apis.md](nodejs-apis.md), [event-loop.md](event-loop.md). So sánh callback §2.8.

`EventEmitter` generic (Node hiện đại / `@types/node`): map event → tuple args. Function property listener `(...args: UserEvents["login"]) => void` — variance §8: event payload **rộng** trên emit, listener chấp nhận payload đó (contra).

### 12.1 `on` / `once` / `off` / `addListener`

| API | Ý nghĩa |
|---|---|
| `on` / `addListener` | Đăng ký, gọi mỗi emit |
| `once` | Tự `off` sau lần 1 |
| `off` / `removeListener` | Gỡ **cùng reference** — arrow mới mỗi lần không gỡ được |
| `removeAllListeners(evt?)` | Nặng tay; test teardown |
| `{ signal }` trên `on` (Node hiện đại) | Abort → gỡ listener |

```ts
const ac = new AbortController();
ee.on("data", onData, { signal: ac.signal });
ac.abort(); // listener gỡ
```

Hai arrow khác reference: `off` không match. Giữ `const onData = …`.

`prependListener` chạy trước listener thường — middleware logging. `listeners(evt)` snapshot; mutate trong emit: Node clone list. Emit reentrant (`emit` trong listener) — thứ tự khó đoán; tránh.

### 12.2 `"error"` đặc biệt

Không có listener `error` → `EventEmitter` throw (có thể crash process / `uncaughtException`). Stream pipe: luôn `.on("error")` hoặc `pipeline`. Promise `once(ee, "evt")` reject khi `error` trong lúc chờ — đừng quên.

---

## 13. Best practices

1. API mới: `Promise<T>` / `async function` — không invent err-first. Legacy: `cb(null, v)` một lần; gắn `promisify.custom` nếu cần.
2. `if (err)` cho Node core; không dùng falsy làm error; không `cb(err, result)` đồng thời.
3. Đặt tên kiểu rõ: `Predicate<T>`, `Mapper<T,U>`, `Middleware`. Identity generic **trên hàm** khi infer từng call.
4. HOF cho cross-cutting (retry, timeout, log) thay copy-paste. Debounce/throttle có `AbortSignal`; memoize bounded / `getOrInsertComputed`.
5. `unknown` cho `err` rồi thu hẹp — [exceptions.md](exceptions.md). Type guard phải sound; `filter` cần `x is T`.
6. Giữ `strictFunctionTypes`; sửa chữ ký thay vì nới lỏng. Callback API = **function property**, không method bivariant.
7. Overload khi return phụ thuộc arg; discriminated union khi domain phức tạp; union param khi cùng shape.
8. Curry nhẹ (1–2 tầng); tránh curry framework.
9. `map(async)` → nhớ `Promise.all` / pool có giới hạn.
10. Callback method: bind / arrow — xem OOP. `promisify` method phải bind `this`.
11. EventEmitter: `error` listener, `off`/`signal`; một-shot → Promise/`once`, không pub/sub giả.
12. Cross-link khai báo hàm đầy đủ ở [functions-methods.md](functions-methods.md).

---

## 14. Checklist

```text
□ Callback legacy? có bản Promise / promisify / promisify.custom
□ err-first: null lúc OK; gọi đúng một lần (once / maybe-once)
□ Không throw + cb; không falsy err
□ promisify method: bind this
□ Function type / callable interface đặt tên rõ (Identity vs Identity<T>)
□ Predicate / type guard khi filter union; không Boolean giả
□ Generic: inference đủ; annotate khi cần; const type params nếu literal
□ HOF wrap không nuốt lỗi; once/memoize hiểu cache & throw
□ debounce/throttle + AbortSignal; không debounce nhầm tenant
□ strictFunctionTypes: param callback an toàn; function prop không method bivariant
□ Overload cụ thể trước; impl bao hết — hoặc dùng union/discriminant
□ Closure: let trong loop; không giữ buffer khổng lồ
□ forEach+async tránh; Promise.all / for-await
□ EventEmitter: off / signal; listen error; đừng dùng EE cho one-shot
```

---

## 15. Cheat sheet

```ts
type Fn = (a: number, b?: string) => boolean;
type Predicate<T> = (value: T) => boolean;
type Identity = <T>(value: T) => T;
type Mapper<T, U> = (value: T) => U;
interface Callable {
  (x: string): void;
  meta: string;
}
type HOF = <T>(fn: () => T) => () => T;

function isStr(x: unknown): x is string {
  return typeof x === "string";
}

function f(x: string): number;
function f(x: number): string;
function f(x: string | number): number | string {
  return typeof x === "string" ? x.length : String(x);
}

import { promisify } from "node:util";
fn[promisify.custom] = (a: A) => Promise.resolve(/* … */);
```

| Cần | Chọn |
|---|---|
| I/O mới | Promise / async |
| Legacy Node | err-first + `promisify` / `.custom` |
| Một event | `events.once` / Promise |
| Nhiều event | `EventEmitter` + `error` |
| Thu hẹp kiểu | `x is T` predicate |
| Partial config | curry nhẹ / partial |
| Return phụ thuộc arg | overload / conditional type |
| Cùng shape | union param |
| Domain 2–3 kind | discriminated union |
| Listener typed | function prop + strictFunctionTypes |
| Compute 1 lần/key | `Map.getOrInsertComputed` |

---

## 16. Version notes

| Nền | Liên quan |
|---|---|
| ES2015 | arrow, rest/default, Promise |
| ES2017 | async/await |
| Node cổ điển | err-first callback |
| Node hiện đại | `fs/promises`, `fetch`, `util.promisify` / `promisify.custom` |
| `events.once` | Promise cho một event |
| TS | function types, call/construct signatures, overload, `x is T` |
| TS `strictFunctionTypes` | param callback contravariant (trong `strict`) |
| **TS 7** | `strict` mặc định → variance chặt hơn codebase cũ |
| **Node 26** | Promise-first builtins; AbortSignal phổ biến; `Map.getOrInsertComputed` cho memoize |

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
- [Tập hợp & Generics](collections-generics.md) — `getOrInsertComputed`, variance Array/Map
- [Event loop & concurrency model](event-loop.md)

`node:util` còn `types.isAsyncFunction` / `isPromise` — **không** dùng cho control flow nghiệp vụ (engine-specific, dễ gãy với thenable). Type guard tay (`typeof then === "function"`) cũng không đủ; prefer `await` assimilate.

`Function.prototype[Symbol.hasInstance]` tùy biến `instanceof` — hiếm; đừng dùng để nhận diện callback. Nhận diện “thenable”: chỉ khi assimilate Promise, không phải type guard an toàn.

Symbol well-known liên quan hàm: `Symbol.toStringTag` trên callable object; `promisify.custom` = `Symbol.for("nodejs.util.promisify.custom")`. Không invent symbol riêng trừ khi document rõ.

### 17.1 Ghi chú `strictBindCallApply`

TS `strictBindCallApply` (trong `strict`): `fn.call`/`apply`/`bind` kiểm tra list đối số. Tắt flag để “cho qua” `apply(null, unknown[])` — đừng; annotate tuple. `this` param mismatch bắt ở `call`. Liên quan [functions-methods.md](functions-methods.md) §8.

Callback Node `(err, v) => void` gán vào `(err: Error | null, v?: T) => void` — `err` variance: listener hẹp hơn (`ErrnoException`) **không** an toàn nếu producer gửi `Error` thường — dùng `unknown` rồi hẹp. Xem §8.

`noUncheckedIndexedAccess` làm `args[0]` optional khi wrap rest — annotate tuple generic `A extends unknown[]`.

### Gọi callback đồng bộ vs microtask

Err-first **sync** `cb(null, v)` trước khi hàm return: caller chưa gán handler / stack reentrant. Node convention: I/O callback **async** (kể cả cache hit thường `queueMicrotask` / `setImmediate` tùy API). API mới: Promise luôn async settle (microtask). Tự viết: đừng `cb()` sync nếu document “async continuation” — [event-loop.md](event-loop.md).

`process.nextTick(cb)` đói I/O nếu lặp — không dùng làm “debounce”.

HOF `memoize` sync: lần 1 throw, lần 2 retry — chọn explicit. Promise memoize: cache in-flight `Map<K, Promise<V>>` + xóa khi reject.

### Callback arity & `fn.length`

Err-first: `cb.length === 2` không đảm bảo (arrow rest, default). Node **không** nhìn `length` để quyết định overload luôn — `fs.readFile` nhìn số arg runtime. Wrap: đừng tin `cb.length` để “có error handler”. Truyền luôn `(err, value)`.

`Function.prototype.call.length === 1` (thisArg). Không liên quan số param hàm đích.

Listener async: `ee.on("e", async () => { await x; })` — reject **không** tới `error` event. Bọc try/catch hoặc `void task().catch`. Đây là lý do Promise-first rõ hơn EE cho one-shot I/O.

`once(ee, "e", { signal })` hủy chờ khi abort — [abort-context.md](abort-context.md).

`callbackify` wrap async: rejection `cb(err)` — `err` phải `Error` instance một số path Node (warning nếu không). Throw sync trong asyncFn → reject → cb. Không gọi cb hai lần.

`util.promisify` + `fs.exists` (deprecated) là ví dụ custom symbol lịch sử — dùng `fs.promises.access` / `stat` thay `exists`.

`queueMicrotask(() => cb(null, cached))` khi wrap sync cache thành “async callback” để không reentrant. Đừng `setTimeout(0)` trừ khi muốn macrotask (chậm hơn, khác thứ tự). Chi tiết queue: [event-loop.md](event-loop.md).

Variance `err`: producer gọi `cb(err: unknown)` đòi handler chấp nhận `unknown`. Handler `(err: Error) => void` **quá hẹp** (contra) — hẹp bằng type guard trong body, không hẹp chữ ký callback.

`this` trong err-first: Node gọi bare. Class method `this.read = this.read.bind(this)` trước đưa vào `fs` style. Arrow field: xem [functions-methods.md](functions-methods.md).

`domain` module (legacy) không phải cách bind callback trên Node 26 — bỏ. `AsyncLocalStorage` cho request context, không thay `this`.

`unhandledRejection` từ listener `async` trên EventEmitter: bọc `.catch` hoặc chuyển Promise API. Đừng im lặng nuốt trừ khi log.

---

---

---

---

---

---

---

---

---

---
