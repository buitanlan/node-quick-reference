# Lập trình bất đồng bộ

*(Callbacks, Promises, async/await, combinators, concurrency limits, streams, top-level await)*

Baseline: **Node.js 26**, **TypeScript 7**, ESM-first. Async hiện đại = **Promise + async/await + AbortSignal**; callback kiểu Node `(err, value)` vẫn gặp ở API cũ. Hủy hợp tác (cancellation) chi tiết → [abort-context.md](abort-context.md). Microtask / phases / `nextTick` → [event-loop.md](event-loop.md). CPU song song thật → [threading.md](threading.md).

> **So với Go:** Promise ≈ future của một kết quả; `AbortSignal` ≈ `ctx.Done()`; `AsyncLocalStorage` ≈ `context.Value` (request-scoped). Không có goroutine — concurrency I/O dựa trên **không block** main thread. `await` chỉ nhường continuation, không chuyển CPU sang core khác.

---

## Mục lục

- [1. Từ callback → Promise → async/await](#1-từ-callback--promise--asyncawait)
  - [1.1 Callback style (Node)](#11-callback-style-node)
  - [1.2 Promise](#12-promise)
  - [1.3 async/await](#13-asyncawait)
- [2. Promise internals & thenable assimilation](#2-promise-internals--thenable-assimilation)
  - [2.1 Settled exactly once](#21-settled-exactly-once)
  - [2.2 Thenable là gì?](#22-thenable-là-gì)
  - [2.3 Quy tắc assimilate (cần nhớ)](#23-quy-tắc-assimilate-cần-nhớ)
  - [2.4 TypeScript: `PromiseLike<T>` vs `Promise<T>`](#24-typescript-promiselike-vs-promise)
  - [2.5 Thenable async & reentrancy](#25-thenable-async--reentrancy)
  - [2.6 `await` không phải “yield thread”](#26-await-không-phải-yield-thread)
- [3. Microtask scheduling (và event loop)](#3-microtask-scheduling-và-event-loop)
- [4. Tạo & chuyển đổi Promise](#4-tạo--chuyển-đổi-promise)
  - [4.1 Constructor, `resolve`, `reject`](#41-constructor-resolve-reject)
  - [4.2 `Promise.try` (baseline 26)](#42-promisetry-baseline-26)
  - [4.3 `Promise.withResolvers()`](#43-promisewithresolvers)
- [5. `then` vs `await` — exception paths](#5-then-vs-await--exception-paths)
  - [5.1 `await` + `try/catch`](#51-await--trycatch)
  - [5.2 `.then(onFulfilled, onRejected)` — hai nhánh **không** bắt lỗi nhau](#52-thenonfulfilled-onrejected--hai-nhánh-không-bắt-lỗi-nhau)
  - [5.3 `return` thenable trong `async`](#53-return-thenable-trong-async)
  - [5.4 `catch` vs `then(undefined, handler)`](#54-catch-vs-thenundefined-handler)
- [6. `finally` trên Promise vs `try/finally`](#6-finally-trên-promise-vs-tryfinally)
  - [6.1 `Promise.prototype.finally`](#61-promiseprototypefinally)
  - [6.2 `try/finally` với `await`](#62-tryfinally-với-await)
- [7. `queueMicrotask` vs `Promise.resolve().then`](#7-queuemicrotask-vs-promiseresolvethen)
- [8. Kết hợp nhiều Promise (combinators)](#8-kết-hợp-nhiều-promise-combinators)
  - [8.1 `Promise.all`](#81-promiseall)
  - [8.2 `Promise.allSettled`](#82-promiseallsettled)
  - [8.3 `Promise.race`](#83-promiserace)
  - [8.4 `Promise.any`](#84-promiseany)
  - [8.5 Abort gắn combinator](#85-abort-gắn-combinator)
  - [8.6 Chọn combinator nhanh](#86-chọn-combinator-nhanh)
  - [8.7 Combinator với promise đã settle](#87-combinator-với-promise-đã-settle)
  - [8.8 `all` và kiểu lỗi](#88-all-và-kiểu-lỗi)
- [9. Tuần tự vs song song vs pool](#9-tuần-tự-vs-song-song-vs-pool)
  - [9.1 Ba chế độ](#91-ba-chế-độ)
  - [9.2 `mapPool`](#92-mappool)
  - [9.3 Backpressure tư duy](#93-backpressure-tư-duy)
  - [9.4 Pipeline giai đoạn (seq of parallel)](#94-pipeline-giai-đoạn-seq-of-parallel)
  - [9.5 Retry phải nằm trong deadline & idempotency budget](#95-retry-phải-nằm-trong-deadline--idempotency-budget)
- [10. Lỗi: unhandledRejection vs catch-after-tick](#10-lỗi-unhandledrejection-vs-catch-after-tick)
  - [10.1 Cùng turn vs sau tick](#101-cùng-turn-vs-sau-tick)
  - [10.2 Floating promises & async constructor](#102-floating-promises--async-constructor)
  - [10.3 Nuốt lỗi / empty catch](#103-nuốt-lỗi--empty-catch)
- [11. `await using` & async dispose](#11-await-using--async-dispose)
- [12. `AbortSignal` — overview](#12-abortsignal--overview)
- [13. `util.promisify` & callbackify](#13-utilpromisify--callbackify)
- [14. `node:stream/promises` — pipeline & destroy](#14-nodestreampromises--pipeline--destroy)
  - [14.1 `pipeline`](#141-pipeline)
  - [14.2 Lỗi, `destroy`, abort](#142-lỗi-destroy-abort)
  - [14.3 `finished` & `for await`](#143-finished--for-await)
  - [14.4 Web Streams / `fetch` body](#144-web-streams--fetch-body)
- [15. Top-level await & TLA cycles](#15-top-level-await--tla-cycles)
  - [15.1 Hệ quả lên module graph](#151-hệ-quả-lên-module-graph)
  - [15.2 Cycle + TLA](#152-cycle--tla)
  - [15.3 CJS không có TLA](#153-cjs-không-có-tla)
  - [15.4 Khi nên / không nên TLA](#154-khi-nên--không-nên-tla)
- [16. `AsyncLocalStorage` snapshot tại `await`](#16-asynclocalstorage-snapshot-tại-await)
  - [16.1 Snapshot / restore tại `await`](#161-snapshot--restore-tại-await)
  - [16.2 `run` vs `enterWith` vs `snapshot`](#162-run-vs-enterwith-vs-snapshot)
  - [16.3 Nested `run`](#163-nested-run)
  - [16.4 Mất context — checklist ngắn](#164-mất-context--checklist-ngắn)
  - [16.5 Async generator (tóm tắt)](#165-async-generator-tóm-tắt)
  - [16.6 Pitfalls async (bảng)](#166-pitfalls-async-bảng)
- [17. Best practices](#17-best-practices)
- [18. Checklist](#18-checklist)
- [19. Cheat sheet](#19-cheat-sheet)
- [20. Version matrix](#20-version-matrix)
- [21. Tài liệu liên quan](#21-tài-liệu-liên-quan)

---

## 1. Từ callback → Promise → async/await

### 1.1 Callback style (Node)

```js
import fs from "node:fs";

fs.readFile("a.txt", "utf8", (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(data);
});
```

Vấn đề: lồng callback (“callback hell”), khó `try/catch` tuần tự, dễ quên xử lý `err`, khó hủy giữa chừng. Error-first `(err, value)` vẫn là hợp đồng của nhiều API C++ / native cũ.

### 1.2 Promise

```ts
import fs from "node:fs/promises";

fs.readFile("a.txt", "utf8")
  .then((data) => console.log(data))
  .catch((err) => console.error(err))
  .finally(() => console.log("done"));
```

Promise trạng thái: **pending** → **fulfilled** | **rejected** (settled **một lần** — xem §2). `.then` trả Promise **mới** (derived), không mutate promise gốc.

### 1.3 async/await

```ts
import fs from "node:fs/promises";

async function main() {
  try {
    const data = await fs.readFile("a.txt", "utf8");
    console.log(data);
  } catch (err) {
    console.error(err);
  }
}

void main();
```

| Khái niệm | Ý nghĩa |
|-----------|---------|
| `async function` | luôn trả về **Promise** (kể cả `return` sync) |
| `await` | tạm dừng **hàm async** đến khi thenable settle; **không** block event loop |
| throw trong async | → Promise **reject** |
| `return x` trong async | → Promise **fulfill** với `x` (nếu `x` thenable thì flatten) |

```ts
async function f() {
  return 1; // tương đương Promise.resolve(1)
}
async function g() {
  throw new Error("x"); // tương đương Promise.reject(...)
}
```

`async` arrow / method: `const load = async () => …` / `async find() { … }` — `this` theo quy tắc hàm thường (method vs arrow), không phải “magic async this”. Chi tiết hàm → [functions-methods.md](functions-methods.md).

---

## 2. Promise internals & thenable assimilation

### 2.1 Settled exactly once

```ts
const p = new Promise<number>((resolve, reject) => {
  resolve(1);
  resolve(2); // bị bỏ qua
  reject(new Error("late")); // bị bỏ qua
});
// p luôn fulfill với 1
```

Sau khi settled, thêm `.then` / `.catch` vẫn chạy (microtask) với kết quả đã cố định — không “re-settle”. Executor chạy **sync** ngay khi `new Promise`.

> **Pitfall:** `resolve(thenable)` không “đóng” promise ngay — engine **follow** thenable. `resolve` lần hai vẫn bị bỏ qua, nhưng fulfillment cuối cùng phụ thuộc thenable.

### 2.2 Thenable là gì?

Mọi object có method `then` callable đều có thể được `await` / được Promise **assimilate** (spec: *PromiseResolveThenableJob*):

```ts
const thenable = {
  then(onFulfilled: (v: number) => void) {
    onFulfilled(42);
  },
};

const v = await thenable; // 42
const p = Promise.resolve(thenable); // Promise<number> fulfill 42
```

`Promise.resolve(x)`:

| `x` | Kết quả |
|-----|---------|
| Promise native | **cùng instance** (không wrap lại) |
| Thenable (`then` callable) | Promise **mới**, follow `then` |
| Không thenable | fulfill với `x` (reaction vẫn qua microtask) |
| Getter `then` ném | reject với lỗi getter |
| `then` không callable (`{ then: 1 }`) | fulfill với chính object đó |

```ts
const native = Promise.resolve(1);
Promise.resolve(native) === native; // true

const t = { then(f: (n: number) => void) { f(1); } };
const wrapped = Promise.resolve(t);
wrapped !== t; // true — assimilate vào Promise mới
```

### 2.3 Quy tắc assimilate (cần nhớ)

1. **First-call wins** trong `then(onFulfilled, onRejected)`: gọi cả resolve lẫn reject → lần đầu thắng, lần sau bỏ.
2. `then` chạy **sync hoặc async** đều hợp lệ; engine không đòi microtask từ thenable lạ.
3. `onFulfilled` nhận thenable khác → assimilate **đệ quy** (flatten).
4. `then` ném sync → Promise assimilating **reject**.
5. Thenable resolve bằng **chính promise đang follow** → `TypeError` (cycle).
6. `await x` dùng cùng semantics `Promise.resolve` rồi đợi — `await 1` vẫn qua một microtask.

```ts
const evil = {
  then(ok: (v: unknown) => void, fail: (e: unknown) => void) {
    ok(1);
    fail(new Error("ignored"));
    ok(2);
  },
};
await evil; // 1
```

> **Pitfall:** object “giống Promise” từ thư viện cũ / jQuery deferred có `then` lệch spec. `await` sẽ follow — đừng giả định identity hay timing giống native Promise. Test bằng `await Promise.resolve(x)` trước khi nhét vào combinator.

### 2.4 TypeScript: `PromiseLike<T>` vs `Promise<T>`

```ts
function acceptThen<T>(p: PromiseLike<T>): Promise<T> {
  return Promise.resolve(p); // assimilate
}

async function f(): Promise<number> {
  return 1;
}
const pl: PromiseLike<number> = f();
```

- `await` chấp nhận `PromiseLike` (thenable).
- Kiểu trả về `async function` là `Promise<T>`, không phải `PromiseLike`.
- Thư viện cũ export thenable không có `.catch` / `.finally` — bọc `Promise.resolve(x)` trước khi combinator.

`Promise.reject(reason)` **không** assimilate `reason` (kể cả khi reason là Promise). `resolve(thenable)` mới follow.

### 2.5 Thenable async & reentrancy

```ts
const deferred = {
  then(ok: (v: string) => void) {
    setTimeout(() => ok("later"), 0); // macrotask — không phải microtask
  },
};
// await deferred đợi timer, không settle trong microtask turn hiện tại
```

Thenable native-like thường gọi `ok` trong microtask; thenable “tự chế” có thể gọi sync (như §2.2) **hoặc** timer. Combinator không đổi lịch thenable lạ.

Gọi `ok` sync **trong** `then` khi `Promise.resolve(thenable)`: engine vẫn schedule job assimilate — tránh giả định “đã có value ngay dòng sau `Promise.resolve`”. Value chỉ chắc sau `await` / `.then`.

### 2.6 `await` không phải “yield thread”

```ts
async function cpuBound() {
  await Promise.resolve(); // chỉ nhường một microtask turn
  for (let i = 0; i < 1e9; i++) {
    /* vẫn chặn event loop */
  }
}
```

I/O async tốt; CPU nặng vẫn cần worker / chia batch `setImmediate` — xem [threading.md](threading.md), [event-loop.md](event-loop.md).

---

## 3. Microtask scheduling (và event loop)

```ts
console.log("A");
Promise.resolve().then(() => console.log("B")); // microtask
queueMicrotask(() => console.log("C"));
console.log("D");
// A D → B C  (thứ tự B/C theo enqueue)
```

- Reaction của Promise (`.then` / resume `await`) chạy trên **microtask queue** (job queue V8).
- Sau mỗi turn sync/macrotask, engine **xả hết** microtasks trước macrotask tiếp theo.
- Trên Node, `process.nextTick` **trước** Promise jobs — đừng nhầm “tick” với `setTimeout(0)`.
- Đệ quy chỉ enqueue microtask / `nextTick` → **starve** I/O và timer.

```ts
async function f() {
  console.log("1");
  await 0; // ≈ Promise.resolve(0) rồi continuation
  console.log("3");
}
f();
console.log("2");
// 1 → 2 → 3
```

> Phases libuv (`timers` / `poll` / `check` / `close`), starvation, `setImmediate` trong/ngoài I/O: **[event-loop.md](event-loop.md)** — đừng nhân đôi giả định thứ tự ở đây.

---

## 4. Tạo & chuyển đổi Promise

### 4.1 Constructor, `resolve`, `reject`

```ts
const p = new Promise<number>((resolve, reject) => {
  setTimeout(() => resolve(42), 100);
});

const done = Promise.resolve(1);
const fail = Promise.reject(new Error("boom")); // luôn gắn .catch nếu không await
```

Wrap API callback (khi chưa có `*/promises`):

```ts
function readFileP(path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    import("node:fs").then((fs) => {
      fs.readFile(path, (err, data) => (err ? reject(err) : resolve(data)));
    });
  });
}
```

Ưu tiên sẵn `node:fs/promises`, `node:timers/promises`, `util.promisify` thay vì tự wrap. Chỉ `new Promise` khi **cầu nối** callback / EventEmitter một lần.

### 4.2 `Promise.try` (baseline 26)

`Promise.try(fn, ...args)` chạy `fn` và **luôn** trả Promise: return sync → fulfill; throw sync → reject; return thenable → assimilate. Bỏ điệu nhảy `try/catch` + `Promise.resolve` quanh hàm “có thể sync, có thể async”.

```ts
const value = await Promise.try(() => 42);

await Promise.try(() => {
  throw new Error("boom");
}).catch((e: unknown) => console.error(e));

const doubled = await Promise.try((n: number) => n * 2, 21); // 42

async function maybeAsync(x: number) {
  if (x < 0) throw new Error("neg");
  return x;
}
await Promise.try(maybeAsync, 3);
```

| Thay vì | Dùng |
|---------|------|
| `Promise.resolve().then(fn)` để bắt throw sync | `Promise.try(fn)` |
| `new Promise((res, rej) => { try { res(fn()) } catch (e) { rej(e) } })` | `Promise.try(fn)` |
| Gọi hàm user plugin không biết sync/async | `Promise.try(plugin, input)` |

> `Promise.try` **không** thay `new Promise` khi cần `resolve`/`reject` từ event sau đó — lúc đó dùng `withResolvers`.

So với `Promise.resolve().then(fn)`:

- `then(fn)` **không** chạy `fn` sync: luôn microtask; throw trong `fn` → reject derived.
- `Promise.try(fn)` chạy `fn` **ngay** (sync); throw sync → Promise đã reject (handler gắn cùng turn vẫn kịp).
- `try` flatten thenable return; `resolve().then` cũng flatten return của `fn`.

```ts
let n = 0;
Promise.try(() => {
  n = 1;
});
console.log(n); // 1 — đã chạy sync

n = 0;
Promise.resolve().then(() => {
  n = 1;
});
console.log(n); // 0 — chưa chạy
```

Dùng `try` khi bọc plugin sync/async. Dùng `then` khi **cố ý** hoãn sang microtask.

### 4.3 `Promise.withResolvers()`

ES2024 / Node hiện đại — tách `resolve`/`reject` ra ngoài executor:

```ts
const { promise, resolve, reject } = Promise.withResolvers<number>();
setTimeout(() => resolve(1), 10);
await promise;
```

Hữu ích khi cầu nối EventEmitter / callback một lần, hoặc hàng đợi “lần đọc tiếp theo” trên stream. Vẫn tránh async executor (§10.2).

```ts
async function* readableToChunks(stream: NodeJS.ReadableStream) {
  let { promise, resolve, reject } = Promise.withResolvers<void>();
  stream.on("error", (err) => reject(err));
  stream.on("end", () => resolve());
  stream.on("readable", () => resolve());
  while (stream.readable) {
    await promise;
    let chunk;
    while ((chunk = (stream as NodeJS.ReadableStream & { read(): unknown }).read())) {
      yield chunk;
    }
    ({ promise, resolve, reject } = Promise.withResolvers<void>());
  }
}
```

---

## 5. `then` vs `await` — exception paths

Hai kiểu nhìn khác nhau cùng một Promise — chỗ hay sai là **throw trong callback `then`**.

### 5.1 `await` + `try/catch`

```ts
async function load() {
  try {
    const v = await mightReject();
    return transform(v); // throw ở đây cũng vào catch
  } catch (e) {
    throw new Error("load failed", { cause: e });
  }
}
```

`catch` bắt: rejection của `await`, **và** throw sync sau `await` trong cùng `try`. Continuation sau `await` là microtask; stack gốc của caller đã không còn — `cause` / log có `async` stack (Node 26 đủ dùng; đừng kỳ vọng stack callback-style).

### 5.2 `.then(onFulfilled, onRejected)` — hai nhánh **không** bắt lỗi nhau

```ts
p.then(
  () => {
    throw new Error("in then"); // ❌ onRejected KHÔNG bắt
  },
  (err) => {
    console.error("only original reject", err);
  },
);
// Promise derived reject "in then" — dễ unhandled nếu không .catch sau
```

Đúng:

```ts
p.then((v) => transform(v)).catch((err) => {
  console.error(err);
});
```

| Tình huống | `await` + try | `.then(ok, fail)` | `.then(ok).catch(fail)` |
|------------|---------------|-------------------|-------------------------|
| `p` reject | `catch` | `fail` | `fail` |
| `ok` / thân sau await throw | `catch` | **không** vào `fail` | `fail` |
| `fail` throw | — | derived reject | derived reject (cần catch tiếp) |

> **Pitfall:** mix `.then` và `await` trong cùng hàm làm exception path khó đọc. Chọn một phong cách trong một function.

### 5.3 `return` thenable trong `async`

```ts
async function wrap() {
  return mightReject(); // flatten — wrap() reject nếu mightReject reject
}
async function wrapAwait() {
  return await mightReject(); // stack + semantics tương đương flatten, hơi khác stack trace
}
```

Cả hai đều propagate rejection. `return await` hữu ích khi cần `try/finally` quanh việc đó (dispose trước khi fulfill ra ngoài).

### 5.4 `catch` vs `then(undefined, handler)`

```ts
p.catch(handler);
p.then(undefined, handler); // tương đương về mặt reaction reject
```

Khác chuỗi: `p.then(ok).catch(handler)` bắt cả reject của `p` **và** throw/`reject` từ `ok`. `p.then(ok, handler)` thì `handler` chỉ bắt reject **gốc** của `p`.

```ts
await Promise.resolve()
  .then(() => {
    throw new Error("from then");
  })
  .catch((e) => "recovered"); // "recovered" — fulfill
```

`await` trong `try/catch` tương đương `.catch` trên derived (bắt cả rejection lẫn throw sau await). Không có “hai-arg then” khi dùng `await`.

---

## 6. `finally` trên Promise vs `try/finally`

### 6.1 `Promise.prototype.finally`

```ts
const result = await doWork()
  .finally(() => {
    console.log("cleanup");
    // return 42;  — bị bỏ qua nếu doWork fulfill
  });
```

- Callback `finally` **không nhận** value/reason.
- Return value của callback **không** thay fulfillment gốc.
- Nếu callback **throw** hoặc return Promise reject → **thay** kết quả (fulfill thành reject, hoặc đổi reason).
- Nếu callback return thenable pending, derived promise đợi thenable đó rồi mới settle theo giá trị **gốc** (trừ khi thenable reject).

```ts
Promise.resolve(1)
  .finally(() => {
    throw new Error("cleanup failed");
  })
  .catch((e) => console.error(e)); // "cleanup failed" — mất value 1
```

### 6.2 `try/finally` với `await`

```ts
async function withLock() {
  const lock = await acquire();
  try {
    return await work(lock);
  } finally {
    await lock.release(); // luôn chạy khi rời try — kể cả return / throw
  }
}
```

| | `promise.finally(fn)` | `try { await p } finally { … }` |
|--|----------------------|----------------------------------|
| Nhận value | Không | Có, trong `try` |
| Đổi fulfillment bằng `return` | Không (bỏ qua) | `return` trong `finally` **ghi đè** (bẫy) |
| Throw trong cleanup | Thay reason | Nuốt lỗi gốc nếu `finally` throw — xem [statements.md](statements.md) |
| Resource async | Dễ quên `await` cleanup | `await using` (§11) rõ hơn |

> **Pitfall:** `return` / `throw` trong `finally` của JS **che** kết quả `try` — khác `Promise.finally` (không đổi value khi cleanup thành công). Cleanup async: `await using` hoặc `try/finally` có `await dispose()`.

---

## 7. `queueMicrotask` vs `Promise.resolve().then`

Cả hai enqueue **cùng** microtask queue (sau `nextTick` trên Node). Khác nhau ở **Promise object** và **khi callback ném**.

```ts
queueMicrotask(() => console.log("q"));
Promise.resolve().then(() => console.log("p"));
// thứ tự: theo enqueue — ở đây q rồi p nếu gọi theo thứ tự trên
```

| | `queueMicrotask(fn)` | `Promise.resolve().then(fn)` |
|--|---------------------|------------------------------|
| Tạo Promise | Không | Có (derived) |
| `fn` throw | **uncaughtException** (không đi qua Promise) | derived **reject** → `unhandledRejection` nếu không catch |
| Assimilate thenable | Không | `Promise.resolve(x).then` follow `x` |
| Chi phí | Thấp hơn một chút | Thêm allocation Promise |
| Ý định | “chạy sau stack hiện tại” | Chain Promise |

```ts
queueMicrotask(() => {
  throw new Error("micro-boom"); // process uncaught — không phải rejection
});

Promise.resolve()
  .then(() => {
    throw new Error("then-boom");
  })
  .catch((e) => console.error("caught", e));
```

> **Pitfall:** đừng dùng `Promise.resolve().then(fn)` như “defer” nếu `fn` có thể throw mà bạn muốn uncaught vs rejection khác nhau. Defer thuần: `queueMicrotask`. Chain giá trị: `.then`. Nhường **macrotask** (I/O/timer): `setImmediate` — [event-loop.md](event-loop.md).

`queueMicrotask` **không** phải `nextTick` và **không** phải `setTimeout(0)`.

---

## 8. Kết hợp nhiều Promise (combinators)

| API | Thành công khi | Thất bại khi | Kết quả |
|-----|----------------|--------------|---------|
| `Promise.all` | tất cả fulfill | **một** reject (fail-fast) | `T[]` |
| `Promise.allSettled` | tất cả settle | không throw vì nhánh | `{status, value\|reason}[]` |
| `Promise.race` | settle **nhanh nhất** | settle nhanh nhất là reject | `T` |
| `Promise.any` | fulfill **đầu tiên** | **tất cả** reject | `T` / `AggregateError` |

**Mọi combinator đều không hủy nhánh thua / leftover.** Fail-fast chỉ **bỏ qua kết quả** — việc kia vẫn chạy trừ khi bạn `abort`.

### 8.1 `Promise.all`

```ts
const [a, b] = await Promise.all([
  fetch("https://example.com/a").then((r) => r.text()),
  fetch("https://example.com/b").then((r) => r.text()),
]);
```

**Edge case — fail-fast ≠ cancel:**

```ts
const slow = fetch(urlSlow); // vẫn chạy dù all đã reject
const fastFail = Promise.reject(new Error("boom"));

try {
  await Promise.all([slow, fastFail]);
} catch {
  // slow vẫn pending / vẫn tốn tài nguyên trừ khi bạn abort
}
```

Dùng khi mọi nhánh đều cần thành công. Muốn dừng leftover → cùng `AbortSignal`, `abort()` khi một nhánh fail ([abort-context.md](abort-context.md)).

Input rỗng: `await Promise.all([])` → `[]` ngay (microtask). Một phần tử reject → reject với reason đó (không bọc `AggregateError`).

### 8.2 `Promise.allSettled`

```ts
const results = await Promise.allSettled([p1, p2, p3]);
for (const r of results) {
  if (r.status === "fulfilled") console.log(r.value);
  else console.error(r.reason);
}
```

Phù hợp fan-out báo cáo / cleanup nhiều việc độc lập — **không** fail-fast. Leftover vẫn chạy đến settle; abort nếu bạn muốn dừng sớm vì budget hết.

### 8.3 `Promise.race`

```ts
import { setTimeout as sleep } from "node:timers/promises";

const result = await Promise.race([
  doWork(),
  sleep(5_000).then(() => {
    throw new Error("timeout");
  }),
]);
```

**`race` không hủy nhánh thua.** Timeout bằng `race` chỉ “bỏ qua kết quả” — `doWork()` vẫn chạy. Cancel thật:

```ts
const signal = AbortSignal.timeout(5_000);
await doWork({ signal });
```

`race` hợp lý cho “event nào tới trước” (lần đầu message, once-lock) — vẫn abort nhánh kia nếu việc đó tốn tài nguyên.

### 8.4 `Promise.any`

```ts
try {
  const data = await Promise.any([
    mirror1.fetch(),
    mirror2.fetch(),
    mirror3.fetch(),
  ]);
} catch (e) {
  if (e instanceof AggregateError) {
    console.error(e.errors); // mọi rejection
  }
  throw e;
}
```

- Fulfill theo thành công **đầu tiên**.
- Chỉ reject khi **tất cả** reject → `AggregateError` (`e.errors: unknown[]`).
- Nhánh còn lại sau fulfill đầu **không** bị cancel tự động — abort leftover nếu mirror tốn tiền / connection.

Input rỗng: `Promise.any([])` reject `AggregateError` ngay.

### 8.5 Abort gắn combinator

```ts
async function allOrAbort<T>(
  tasks: ((signal: AbortSignal) => Promise<T>)[],
  parent?: AbortSignal,
): Promise<T[]> {
  const ac = new AbortController();
  const signal = parent ? AbortSignal.any([parent, ac.signal]) : ac.signal;
  try {
    return await Promise.all(tasks.map((t) => t(signal)));
  } catch (e) {
    ac.abort(e);
    throw e;
  }
}
```

`allSettled` ít khi abort leftover (cần mọi kết quả). `any`/`race`/`all` fail-fast: abort ngay trong `catch`. Chi tiết cây signal → [abort-context.md](abort-context.md).

### 8.6 Chọn combinator nhanh

| Nhu cầu | Chọn |
|---------|------|
| Tất cả phải OK, song song | `all` + signal nếu cần cancel leftover |
| Thu thập cả thành công/lỗi | `allSettled` |
| Timeout / first event | `AbortSignal.timeout` (không chỉ `race`+sleep) |
| First success (mirror) | `any` + abort leftover |
| Giới hạn độ song song | `mapPool` (§9), không `all` trần |
| Iterable async → mảng | `Array.fromAsync` (ES2024 / Node 26) |

```ts
const rows = await Array.fromAsync(ids, async (id) => fetchRow(id));
// tuần tự theo iterator — không phải song song
```

`Array.fromAsync` **không** fan-out song song; đừng nhầm với `Promise.all(array.map(...))`.

### 8.7 Combinator với promise đã settle

```ts
const done = Promise.resolve("ok");
const pending = sleep(1000).then(() => "late");
await Promise.race([done, pending]); // "ok" ngay (microtask) — pending vẫn chạy
```

`all` / `race` / `any` không “pause” nhánh: mọi input **đã start** nếu bạn tạo Promise trước khi gọi combinator.

```ts
// ❌ start trước, rồi all — không khác gì
const jobs = ids.map((id) => fetchUser(id));
await Promise.all(jobs);

// Lazy task: chưa fetch cho đến khi pool gọi
await mapPool(ids, 8, (id) => fetchUser(id));
```

Muốn **lazy** + abort leftover: truyền `() => Promise` vào helper, đừng `map` ra Promise rồi mới `all`.

### 8.8 `all` và kiểu lỗi

Một reject → `all` reject **reason đó** (không gói). Muốn mọi lỗi: `allSettled` rồi tự `AggregateError`. `any` mới `AggregateError` khi **mọi** nhánh fail. Wrap HTTP:

```ts
const settled = await Promise.allSettled(jobs);
const errors = settled
  .filter((r): r is PromiseRejectedResult => r.status === "rejected")
  .map((r) => r.reason);
if (errors.length) throw new AggregateError(errors, "fan-out");
```

---

## 9. Tuần tự vs song song vs pool

### 9.1 Ba chế độ

```ts
// Tuần tự — chậm nếu độc lập; đúng khi phụ thuộc / rate-limit / thứ tự side-effect
for (const id of ids) {
  await fetchUser(id);
}

// Song song không giới hạn — dễ storm (fd, RAM, 429, libuv pool)
await Promise.all(ids.map((id) => fetchUser(id)));

// Song song có giới hạn — pool / semaphore
await mapPool(ids, 8, (id) => fetchUser(id));
```

| | Tuần tự | `all` trần | Pool (`mapPool` / `p-limit`) |
|--|---------|------------|------------------------------|
| Latency tổng | Tổng từng việc | ≈ max(nhánh) nếu OK | Giữa hai cực |
| Storm | Không | Có | Kiểm soát |
| Fail-fast | Dừng vòng nếu throw | Có (leftover sống) | Tùy impl + signal |
| Thứ tự kết quả | Theo vòng | Theo index mảng | Theo index nếu gán slot |

Dùng tuần tự khi: phụ thuộc kết quả trước, rate-limit chặt, hoặc side-effect phải theo thứ tự (migration, rename file).

### 9.2 `mapPool`

Giống worker pool / semaphore — giới hạn số Promise “in flight”:

```ts
async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new RangeError("limit must be a positive safe integer");
  }
  signal?.throwIfAborted();
  const out = new Array<R>(items.length);
  let next = 0;
  let failed = false;

  async function worker() {
    while (!failed) {
      signal?.throwIfAborted();
      const i = next++;
      if (i >= items.length) return;
      try {
        out[i] = await fn(items[i]!, i);
      } catch (error) {
        failed = true; // ngừng nhận job mới; các job đang chạy vẫn cần signal
        throw error;
      }
    }
  }

  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}
```

Fail-fast + dừng leftover: bọc `AbortController`, `abort()` trong `catch`, truyền cùng `signal` xuống `fn`. Thư viện cùng ý tưởng: `p-limit`, `p-map`.

| Tình huống | Gợi ý `limit` |
|------------|----------------|
| HTTP outbound | 8–32 (theo quota upstream) |
| `fs` song song | thấp hơn (threadpool libuv mặc định **4**) |
| CPU / `worker_threads` | ≈ số worker, không phải “vài trăm Promise” |

> **Pitfall:** pool Promise trên main **không** song song CPU. 100 `JSON.parse` lớn vẫn tuần tự trên một thread giữa các await. CPU → [threading.md](threading.md). fs/crypto native → pool libuv [event-loop.md](event-loop.md).

### 9.3 Backpressure tư duy

- HTTP handler `await mapPool` với `limit` cố định theo process, không theo “số request × N”.
- Queue job unbounded + `all` = OOM ẩn.
- Kết hợp `AbortSignal` request: hủy pool khi client ngắt — worker loop `throwIfAborted()`.

### 9.4 Pipeline giai đoạn (seq of parallel)

```ts
async function ingest(ids: string[], signal: AbortSignal) {
  const users = await mapPool(ids, 8, (id) => fetchUser(id, signal), signal);
  // tuần tự giữa các giai đoạn — song song bên trong
  const enriched = await mapPool(users, 4, (u) => enrich(u, signal), signal);
  await writeAll(enriched, signal); // một I/O phụ thuộc dữ liệu đủ
  return enriched;
}
```

Đừng `Promise.all([fetchAll, writeAll])` khi write cần kết quả fetch. Đừng tuần tự từng user `fetch+enrich+write` nếu ba giai đoạn độc lập theo **tập**.

| Pattern | Khi |
|---------|-----|
| Seq toàn bộ | Phụ thuộc chặt / quota 1 |
| Parallel toàn bộ | Độc lập, N nhỏ |
| Pool | Độc lập, N lớn |
| Seq-of-pools | Pipeline ETL / request handler nhiều bước |

### 9.5 Retry phải nằm trong deadline & idempotency budget

Retry chỉ khi phân loại lỗi là transient và operation an toàn để lặp; timeout không chứng minh server chưa commit. POST/payment cần idempotency key cùng hợp đồng phía server. Giới hạn attempts, backoff exponential có jitter, tôn trọng `Retry-After` khi phù hợp; không retry validation/auth/abort của caller.

Mọi attempt và sleep dùng **deadline tổng** ban đầu, không tạo timeout đầy đủ mới mỗi lần. Giới hạn retry concurrency/queue toàn process để tránh khuếch đại overload. Test số attempt, elapsed budget và side effect trùng. `Promise.race` chỉ reject ngoài mà không abort công việc thì retry có thể tạo hai attempt cùng chạy. Xem [cancellation](abort-context.md) và [testing](testing.md).

---

## 10. Lỗi: unhandledRejection vs catch-after-tick

Chi tiết catalog Error / fatal shutdown → [exceptions.md](exceptions.md). Ở đây: **khi nào** rejection được coi là “đã bắt”.

### 10.1 Cùng turn vs sau tick

Node emit `unhandledRejection` khi Promise reject mà **không** có handler trong **một turn** của event loop. Gắn `.catch` **muộn** (macrotask sau) → `rejectionHandled` — promise vẫn từng “unhandled”.

```ts
process.on("unhandledRejection", (reason, promise) => {
  console.error("unhandledRejection", reason, promise);
});
process.on("rejectionHandled", (promise) => {
  console.warn("catch attached too late", promise);
});

const p = Promise.reject(new Error("late"));
setTimeout(() => {
  void p.catch(() => {}); // sau tick → unhandledRejection rồi rejectionHandled
}, 0);
```

Cùng synchronous turn:

```ts
const q = Promise.reject(new Error("ok"));
void q.catch(() => {}); // handler gắn trước khi rời turn → không unhandled
```

`process.nextTick` / `queueMicrotask` để gắn catch **có thể** vẫn trễ hơn detection — **đừng** dựa vào. Macrotask (`setTimeout` / `setImmediate`) thì **chắc** là after-tick: `unhandledRejection` rồi `rejectionHandled`.

```ts
const r = Promise.reject(new Error("tick"));
queueMicrotask(() => {
  void r.catch(() => {}); // đua với kiểm tra unhandled — không portable
});
```

| Gắn handler | Kết quả điển hình (Node 26) |
|-------------|------------------------------|
| Cùng sync block với `reject` / `throw` trong async | Handled |
| `.catch` trên chuỗi tạo ra ngay (`fetch().catch`) | Handled |
| `setTimeout` / `setImmediate` / I/O callback sau | `unhandledRejection` + có thể `rejectionHandled` |
| “Nhớ” catch ở cuối request, promise tạo ở đầu | Dễ after-tick nếu có `await` khác xen |

> **Đừng** “sửa” floating promise bằng `setTimeout(() => p.catch(...))`. Đó là catch-after-tick: telemetry ồn, process có thể đã log nghiêm trọng. Sửa tại nguồn: `await`, `.catch` ngay, hoặc `void p.catch(log)` **cùng chỗ tạo**. Handler toàn cục **không** biến after-tick thành “đã thiết kế”.

### 10.2 Floating promises & async constructor

```ts
async function oops() {
  mightFail(); // ❌ quên await — lỗi dễ unhandled
}

void saveAudit(row); // ❌ fire-and-forget không catch

void saveAudit(row).catch((err) => logger.error(err)); // ✅ có chủ đích
```

```ts
// ❌ executor async — Promise nội bộ bị bỏ rơi
new Promise(async (resolve, reject) => {
  const x = await f();
  resolve(x);
});

// ✅
async function load() {
  return f();
}
```

Executor `async` trả Promise bị **bỏ rơi** — reject của `f` có thể thành `unhandledRejection` dù bạn nghĩ đã `resolve`. Chỉ `new Promise` khi cầu nối callback/event.

### 10.3 Nuốt lỗi / empty catch

```ts
try {
  await mightFail();
} catch {
  // ❌ nuốt — ít nhất log + metric, hoặc rethrow có cause
}
```

Unhandled rejection: Node log nghiêm trọng; **đừng** dựa vào handler toàn cục để “sửa” logic. Service: coi `unhandledRejection` như fatal — [exceptions.md](exceptions.md) §8.

---

## 11. `await using` & async dispose

Explicit Resource Management (JS + TS 7 / V8 trên Node 26): rời block → gọi `[Symbol.dispose]` / `[Symbol.asyncDispose]` **LIFO**, kể cả khi throw. Nhiều API Node **chưa** Disposable — wrapper gọi `.close()`.

```ts
class Conn implements AsyncDisposable {
  async close() {
    /* shutdown socket / transaction */
  }
  async [Symbol.asyncDispose]() {
    await this.close();
  }
}

async function query() {
  await using c = new Conn();
  await c /* ... */;
} // await asyncDispose — kể cả throw
```

| | |
|--|--|
| `using x = …` | sync `Disposable` (`Symbol.dispose`) |
| `await using x = …` | `AsyncDisposable` (`Symbol.asyncDispose`) |
| Nhiều binding cùng block | Dispose **LIFO** |
| Lỗi body + lỗi dispose | Có thể `SuppressedError` (`.error` / `.suppressed`) |

```ts
async function processFiles(paths: string[]) {
  for (const p of paths) {
    await using f = await openTracked(p); // wrapper minh họa — không phải mọi fs handle đã Disposable
    await handle(f);
  } // dispose mỗi iteration trước vòng sau
}
```

Kết hợp abort: dispose **vẫn chạy** khi `await` reject vì abort — giống `finally`. Listener abort để chủ động `destroy` sớm; `await using` bảo đảm nhánh thành công cũng đóng.

```ts
async function readWithAbort(signal: AbortSignal) {
  await using tracked = acquireTracked(signal);
  signal.throwIfAborted();
  return await tracked.read();
}
```

`Worker` (Node 22.18+ / 24.2+): `await using worker = new Worker(...)` gọi `terminate()` khi rời scope — [threading.md](threading.md).

Abort không thay dispose: signal reject `await` **rồi** engine vẫn chạy asyncDispose. Thứ tự: rời block (throw abort) → LIFO dispose → reject lan ra caller. Đừng `return` sớm mà bỏ resource không `using`.

```ts
class AbortHook implements AsyncDisposable {
  #fn: () => void;
  constructor(
    private signal: AbortSignal,
    fn: () => void,
  ) {
    this.#fn = fn;
    if (signal.aborted) fn();
    else signal.addEventListener("abort", fn, { once: true });
  }
  async [Symbol.asyncDispose]() {
    this.signal.removeEventListener("abort", this.#fn);
  }
}

async function work(signal: AbortSignal) {
  await using _hook = new AbortHook(signal, () => socket.destroy());
  await using conn = await connect();
  return await conn.query("…", { signal });
}
```

> Sync `using` trên resource cần `await close()` → sai. Grammar / `SuppressedError` → [statements.md](statements.md#11-using-vs-tryfinally), [functions-methods.md](functions-methods.md) §11. Abort + cleanup → [abort-context.md](abort-context.md).

---

## 12. `AbortSignal` — overview

Chuẩn hủy hợp tác (tương tự hướng `context` / `CancellationToken`):

```ts
const ac = new AbortController();
setTimeout(() => ac.abort(new Error("timeout")), 3_000);

try {
  const res = await fetch("https://example.com", { signal: ac.signal });
  const text = await res.text();
} catch (err) {
  if (ac.signal.aborted) console.error("aborted", ac.signal.reason);
  else throw err;
}
```

Helpers nhanh:

```ts
const signal = AbortSignal.timeout(5_000);
const combined = AbortSignal.any([userSignal, AbortSignal.timeout(10_000)]);
signal.throwIfAborted();
```

Pattern hàm hỗ trợ cancel:

```ts
async function loadUser(id: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const res = await fetch(`/api/users/${id}`, { signal });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}
```

> **Độ sâu đầy đủ** (already-aborted, diamond `any`, timeout vs deadline, fetch vs HTTP cancel, ALS, 499 vs 500, test): **[abort-context.md](abort-context.md)** — analogue của Go `context.md`.

`Promise.race` timeout **không** thay AbortSignal (§8.3). Combinator leftover **không** tự abort.

---

## 13. `util.promisify` & callbackify

```ts
import { promisify, callbackify } from "node:util";
import fs from "node:fs";

const readFile = promisify(fs.readFile);
const buf = await readFile("a.txt");
```

Yêu cầu: callback **error-first** `(err, value)`. Một số hàm có overload đặc biệt — kiểm tra docs; ưu tiên sẵn `*/promises`.

TypeScript: `@types/node` hỗ trợ nhiều overload; đôi khi cần assert kiểu.

Ngược lại (hiếm — API đòi callback):

```ts
const legacy = callbackify(async (path: string) => fs.promises.readFile(path));
legacy("a.txt", (err, data) => {
  /* ... */
});
```

`promisify.custom` — symbol để thư viện tự cung cấp bản Promise tối ưu (tránh wrap kém). `promisify` **không** tự gắn `AbortSignal` — API gốc phải hỗ trợ.

`util.promisify` trên hàm đã Promise-returning: đừng bọc hai lần. Callbackify một `async` function: rejection → `err` argument; đừng `throw` trong callback style sau khi đã callbackify (double).

`node:timers/promises.setImmediate` / `setTimeout`: macrotask (check / timers) — không phải microtask. Hủy: `{ signal }`.

---

## 14. `node:stream/promises` — pipeline & destroy

### 14.1 `pipeline`

```ts
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createGzip } from "node:zlib";

await pipeline(
  createReadStream("in.txt"),
  createGzip(),
  createWriteStream("out.txt.gz"),
);
```

- Gắn error handling / `destroy` đúng cách hơn `.pipe()` thủ công.
- Một stage lỗi → **destroy** các stage khác (tránh leak fd / backpressure kẹt).
- Promise reject với lỗi đầu; các stream được dọn.

`.pipe()` trần: lỗi giữa chừng dễ **không** propagate, source không destroy, dest không `finish` — fd treo.

### 14.2 Lỗi, `destroy`, abort

```ts
const ac = new AbortController();
try {
  await pipeline(src, transform, dest, { signal: ac.signal });
} catch (e) {
  // AbortError / lỗi stage — các stream đã destroy
  throw e;
}
// ac.abort() → pipeline reject; streams được destroy
```

| Hành vi | Ý nghĩa |
|---------|---------|
| Stage `error` | `pipeline` destroy các stream còn lại với lỗi đó |
| `signal` abort | destroy + reject `AbortError` / `reason` |
| `dest` fail | `src` bị destroy (không đọc tiếp) |
| Listener `error` riêng trên từng stream | Dễ **double-handle** / nuốt lỗi pipeline đang chờ |

> **Pitfall:** `pipeline` đã listen `error`. Tự `.on("error")` rồi quên — hoặc `destroy()` thủ công song song — dễ `uncaught` lần hai trên EventEmitter. Abort sớm: `{ signal }`, không `race` + bỏ stream chạy.

Web `fetch` body: abort request **và** `res.body.cancel()` / đừng bỏ dở ReadableStream — socket/pool hang. Undici abort chi tiết → [abort-context.md](abort-context.md), [nodejs-apis.md](nodejs-apis.md).

### 14.3 `finished` & `for await`

```ts
import { finished } from "node:stream/promises";
import { createWriteStream } from "node:fs";

const ws = createWriteStream("out.bin");
ws.end(Buffer.from("hi"));
await finished(ws);
```

Promise khi stream `end` / `finish` / error — hữu ích khi tự quản lý pipe (không qua `pipeline`).

```ts
async function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
```

Tôn trọng backpressure; hủy bằng `signal` + `stream.destroy(err)`. `for await` trên Readable lỗi → reject vòng lặp; vẫn `destroy` trong `finally` nếu bạn giữ reference.

### 14.4 Web Streams / `fetch` body

```ts
const res = await fetch(url);
const text = await res.text(); // consume body
// hoặc res.body (ReadableStream) + stream/web helpers
```

Đừng quên consume / cancel body khi abort sớm. Xem thêm [nodejs-apis.md](nodejs-apis.md).

`finished(stream, { signal })` reject khi abort — **không** luôn destroy giúp bạn; tự `stream.destroy(err)` trong `catch` nếu bạn không dùng `pipeline`. `pipeline` = finished + destroy + wire lỗi. Mix `.pipe()` giữa chừng với `pipeline` → hai ông chủ backpressure.

---

## 15. Top-level await & TLA cycles

Trong **ESM** (`.mjs` hoặc `"type":"module"`):

```ts
const config = await import("./config.js").then((m) => m.load());
export { config };
```

### 15.1 Hệ quả lên module graph

```text
entry.mjs
  └── awaits import A
        └── A top-level await (I/O)
              └── B, C chờ A evaluate xong mới tiếp tục
```

- Module có TLA **block** evaluation của importer cho đến khi await xong.
- Sibling imports có thể **song song** nếu không phụ thuộc lẫn nhau — runtime tối ưu theo dependency DAG.
- Lạm dụng TLA ở nhiều tầng → **cold start chậm**, khó đoán thứ tự side-effect.

### 15.2 Cycle + TLA

```text
A.mjs  --import-->  B.mjs
  ▲                   │
  └──── import ───────┘
cả hai có top-level await
```

Module ESM đang evaluate ở trạng thái “in progress”. Nếu A `await` thứ phụ thuộc B **và** B `await` thứ phụ thuộc A (trực tiếp hoặc qua binding chưa khởi tạo): **deadlock evaluation** hoặc lỗi graph — process treo lúc boot, không phải “Promise pending bình thường”.

| An toàn | Nguy hiểm |
|---------|-----------|
| TLA chỉ ở entry / config leaf | Hai module import vòng + cả hai TLA |
| Cycle **không** TLA (vẫn tránh) | `await import()` lẫn nhau để “phá cycle” nhưng vẫn chờ nhau |
| Side-effect sync tối thiểu trước await | Export binding dùng trước khi TLA xong |

> **Pitfall:** CJS `require()` một ESM có TLA → `ERR_REQUIRE_ASYNC_MODULE` (không load sync được). Entry dual package: bọc `async function main()` — [main-function.md](main-function.md), [modules-packages.md](modules-packages.md).

Tránh circular await: đảo dependency, tách `ports.ts` sync, TLA một phía.

```ts
// ports.ts — sync, không TLA
export const hooks: { db?: Db } = {};

// db.ts
import { hooks } from "./ports.js";
export const db = await connect(); // TLA một phía
hooks.db = db;

// other.ts import ports, không import db lúc evaluate nếu chỉ cần hook muộn
```

Pattern “slot sync” chỉ khi bắt buộc; tốt hơn: entry `await boot()` rồi mới import graph tĩnh không TLA.

### 15.3 CJS không có TLA

```ts
async function main() {
  const { boot } = await import("./boot.js");
  await boot();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

### 15.4 Khi nên / không nên TLA

| Nên | Không nên |
|-----|-----------|
| Load config một lần trước export | Await trong mọi leaf module |
| Feature detect ở boundary | I/O side-effect sâu trong lib reusable |
| Script ESM ngắn | Thay lazy init trên request path |

---

## 16. `AsyncLocalStorage` snapshot tại `await`

Giống `context.Value` — gắn value **theo chuỗi async** (request ID, logger) không cần truyền mọi hàm. ALS **không** hủy việc (dùng AbortSignal). Đầy đủ cây abort / `enterWith` / cấm singleton controller → **[abort-context.md](abort-context.md)** §5.

```ts
import { AsyncLocalStorage } from "node:async_hooks";

const als = new AsyncLocalStorage<{ reqId: string }>();

als.run({ reqId: "abc" }, async () => {
  await doWork();
  console.log(als.getStore()?.reqId); // "abc" — continuation sau await vẫn trong run
});
```

### 16.1 Snapshot / restore tại `await`

Khi `await` settle, continuation resume với **async context đã gắn lúc suspend** — `getStore()` ra store của `run` đang active, không phải request “đang chạy trên stack khác”. Hai request xen kẽ:

```ts
als.run({ reqId: "A" }, async () => {
  await sleep(10);
  als.getStore()?.reqId; // "A"
});
als.run({ reqId: "B" }, async () => {
  await sleep(1);
  als.getStore()?.reqId; // "B"
});
```

**Mutate in-place** object store → mọi continuation thấy mutation (cùng reference). **Thay** store: `run` lồng / `enterWith` — không gán `store = …` lên biến ngoài rồi kỳ vọng ALS đổi.

### 16.2 `run` vs `enterWith` vs `snapshot`

| API | Việc |
|-----|------|
| `als.run(store, fn)` | Gắn store cho `fn` và async tree nó tạo; rời `fn` thì hết (ưu tiên) |
| `als.enterWith(store)` | Đổi context **phần sync còn lại + async sau** — dễ leak sang handler kế |
| `AsyncLocalStorage.snapshot()` | Chụp context hiện tại, trả hàm gọi `fn` trong context đó |
| `AsyncLocalStorage.bind(fn)` | Bind `fn` vào context lúc gọi `bind` |

```ts
const als = new AsyncLocalStorage<number>();
const resume = als.run(123, () => AsyncLocalStorage.snapshot());
als.run(321, () => resume(() => als.getStore())); // 123 — không phải 321
```

Dùng `snapshot()` khi đăng ký callback lâu (EventEmitter, queue) cần **giữ** request context — không `enterWith` ở middleware rồi quên.

> **Pitfall:** `await` không “chụp” AbortController giấu trong ALS thay cho tham số `signal`. Worker/process **không** kế thừa ALS. Một số native callback có thể **mất** async context — test `getStore()` trong hook. Đừng `enterWith` trên hot path request.

### 16.3 Nested `run`

```ts
als.run({ reqId: "outer" }, async () => {
  als.run({ reqId: "inner" }, async () => {
    await sleep(1);
    als.getStore()?.reqId; // "inner"
  });
  await sleep(1);
  als.getStore()?.reqId; // "outer"
});
```

Inner shadow outer đến khi inner callback xong. Fire-and-forget job **không** nên giữ HTTP store: `als.run(undefined, () => audit())` hoặc payload tường minh — và **không** dùng AbortSignal của request nếu job phải sống sót.

### 16.4 Mất context — checklist ngắn

- Callback đăng ký **trước** `run` (pool connection `error` lúc boot) → không có store request.
- `setInterval` toàn cục không tạo trong `run` → mất ID.
- Worker thread: `getStore()` **undefined** (isolate khác) — gửi `reqId` qua `workerData` / message.
- Native addon không propagate async_hooks → test thực tế.

Pointer hủy + cấm giấu `AbortController` trong ALS: [abort-context.md](abort-context.md).

---

### 16.5 Async generator (tóm tắt)

```ts
async function* pages(signal: AbortSignal) {
  let cursor: string | undefined;
  do {
    signal.throwIfAborted();
    const page = await fetchPage(cursor, signal);
    yield page.items;
    cursor = page.next;
  } while (cursor);
}

for await (const items of pages(signal)) {
  await mapPool(items, 8, handleOne, signal);
}
```

`for await...of` gọi `iterator.return()` khi `break`/`throw` — generator nhận `return()`; vẫn chủ động `abort` I/O bên dưới. Sâu iterator → [iterables-linq.md](iterables-linq.md).

---

### 16.6 Pitfalls async (bảng)

| Bẫy | Hệ quả | Cách |
|-----|--------|------|
| Quên `await` | `unhandledRejection` / race | ESLint `@typescript-eslint/no-floating-promises` |
| Catch sau `setTimeout` | `rejectionHandled` ồn | Catch cùng turn |
| `new Promise(async …)` | Reject nội bộ bỏ rơi | `async function` / `try` |
| `Promise.race` + sleep | Việc gốc chạy tiếp | `AbortSignal.timeout` |
| `all` fail-fast | Leftover tốn tài nguyên | Abort leftover |
| `then(ok, fail)` | Throw trong `ok` thoát `fail` | `.then(ok).catch(fail)` hoặc `await` |
| `return` trong `finally` | Che kết quả `try` | Không return trong `finally` |
| Thenable `{ then }` | Assimilate lệch | `Promise.resolve` có chủ đích |
| TLA + import vòng | Deadlock boot | TLA một phía / `main()` |
| `pipeline` + `.on("error")` kép | uncaught lần 2 | Để `pipeline` xử lý |
| `await` CPU loop | Lag p99 | Worker / `setImmediate` batch |
| ALS `enterWith` | Leak request | `run` / `snapshot` |

---

## 17. Best practices

1. Ưu tiên `async/await` + `try/catch`; `.then` khi chain ngắn. Không mix lung tung trong một hàm.
2. Song song: `Promise.all` / `mapPool` có giới hạn — tránh storm. Leftover → `AbortSignal`.
3. Cancel thật → `AbortSignal`, không chỉ `Promise.race` + sleep.
4. Không block event loop (CPU / `*Sync`) — [event-loop.md](event-loop.md).
5. Luôn xử lý rejection **cùng turn**: `await`, `.catch`, hoặc `void p.catch(...)` có chủ đích. Đừng catch-after-tick.
6. Tránh `new Promise(async ...)`; wrap callback/event bằng constructor hoặc `withResolvers`. Hàm “sync hoặc async”: `Promise.try`.
7. `finally` Promise không đổi value; `return` trong `try/finally` thì có. Resource: `await using`.
8. Stream: `pipeline` + `signal` hơn `.pipe()`; hiểu `destroy` khi lỗi.
9. TLA chỉ ở boot/config; **không** cycle + TLA. API mới = Promise + `signal`.
10. ALS: `run` per request; `snapshot` cho callback lệch cây; hủy = AbortSignal, không giấu controller.

---

## 18. Checklist

```text
□ Mọi Promise “bỏ rơi” đều có catch có chủ đích (cùng turn, không setTimeout)
□ Không dùng async Promise constructor
□ Thenable lạ đã hiểu assimilate / first-call-wins
□ then(ok, fail): throw trong ok không vào fail — đã .catch sau hoặc dùng await
□ all/race/any: leftover work + AbortSignal
□ Fan-out lớn dùng mapPool / p-limit, không all trần
□ Timeout = AbortSignal.timeout (hoặc any), không chỉ race+sleep
□ Stream dùng pipeline(+signal); lỗi → destroy; không pipe quên error
□ await using cho AsyncDisposable; không using sync trên close async
□ TLA chỉ ở entry/config; không circular await
□ ALS run/snapshot đúng; hủy dùng AbortSignal — [abort-context.md]
□ CPU nặng offload worker; không await “ảo” để nghĩ đã nhường thread
□ queueMicrotask vs then: throw → uncaught vs rejection đúng ý
```

---

## 19. Cheat sheet

| API / pattern | Việc |
|---------------|------|
| `async` / `await` | viết flow tuần tự trên Promise |
| `Promise.all` | song song, fail-fast (**không** cancel leftover) |
| `Promise.allSettled` | chờ tất cả, không fail-fast |
| `Promise.race` | settle nhanh nhất (**không** cancel) |
| `Promise.any` | fulfill đầu; all fail → `AggregateError` |
| `Promise.try(fn, …args)` | sync throw/return → Promise |
| `Promise.withResolvers` | tách resolve/reject |
| `Promise.resolve` / thenable | wrap / assimilate |
| `queueMicrotask` | defer microtask, không Promise |
| `p.finally` | cleanup; không đổi value nếu fn OK |
| `await using` | `Symbol.asyncDispose` LIFO |
| `mapPool` | giới hạn concurrency |
| `AbortSignal.timeout` / `.any` | hủy / gộp tín hiệu |
| `util.promisify` | callback → Promise |
| `stream/promises.pipeline` | pipe + destroy + optional signal |
| Top-level `await` | ESM boot / config — tránh cycle |
| `AsyncLocalStorage.run` / `snapshot` | request-scoped; restore sau await |

```ts
async function run(signal: AbortSignal) {
  signal.throwIfAborted();
  await using _gate = acquireGate(signal);
  const rows = await mapPool(ids, 8, (id) => fetchOne(id, signal), signal);
  await pipeline(src, dest, { signal });
  return rows;
}
```

---

## 20. Version matrix

| Phiên bản / giai | Liên quan async |
|-----------------|-----------------|
| ES2015 / Node cũ | Promise |
| ES2017 | async/await |
| ES2020 | `allSettled` |
| ES2021 | `Promise.any`, `AggregateError` |
| Node 15+ | Unhandled rejection nghiêm hơn |
| Node 17.3+ / 16.14+ | `AbortSignal.timeout` |
| Node 20+ | `AbortSignal.any`; Web Streams mạnh hơn |
| ES2024 / Node 22+ | `Promise.withResolvers`, `Array.fromAsync` |
| Node 24/26 | `Promise.try`; ngữ pháp ERM `await using` (không suy từ Symbol trên Node 22) |
| Node 22.15+ / 23.11+ | `AsyncLocalStorage.snapshot` / `bind` ổn định |
| Node 24–26 | Baseline: fetch/undici + signal trên fs/stream; `await using Worker` |

Baseline repo: **Node 26** + **TS 7** — dùng `timeout` / `any` / `withResolvers` / `try` / `throwIfAborted` / `await using` thoải mái.

---

## 21. Tài liệu liên quan

- [abort-context.md](abort-context.md) — AbortSignal, ALS, 499/500, patterns hủy (sâu)
- [event-loop.md](event-loop.md) — microtask, `nextTick`, phases, blocking
- [exceptions.md](exceptions.md) — rejection, AggregateError, unhandledRejection
- [main-function.md](main-function.md) — entry / TLA / shutdown
- [threading.md](threading.md) — worker khi cần song song thật
- [nodejs-apis.md](nodejs-apis.md) — fs, http, fetch, stream
- [statements.md](statements.md) — `try/finally`, `await using`
- [functions-methods.md](functions-methods.md) — `async` function, Disposable
- [modules-packages.md](modules-packages.md) — ESM graph, CJS interop

- [Retry/cancellation tests](testing.md)
- [Latency và queue measurements](diagnostics.md)
