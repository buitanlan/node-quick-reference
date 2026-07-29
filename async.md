# Lập trình bất đồng bộ

*(Callbacks, Promises, async/await, combinators, concurrency limits, streams, top-level await)*

Baseline: **Node.js 26**, **TypeScript 7**, ESM-first. Async hiện đại = **Promise + async/await + AbortSignal**; callback kiểu Node `(err, value)` vẫn gặp ở API cũ. Hủy hợp tác (cancellation) chi tiết → [abort-context.md](abort-context.md). Microtask / event loop → [event-loop.md](event-loop.md).

> **So với Go:** Promise ≈ future của một kết quả; `AbortSignal` ≈ `ctx.Done()`; `AsyncLocalStorage` ≈ `context.Value` (request-scoped). Không có goroutine — concurrency I/O dựa trên không block main thread.

---

## Mục lục

- [Lập trình bất đồng bộ](#lập-trình-bất-đồng-bộ)
  - [Mục lục](#mục-lục)
  - [1. Từ callback → Promise → async/await](#1-từ-callback--promise--asyncawait)
  - [2. Promise internals \& semantics](#2-promise-internals--semantics)
  - [3. Tạo \& chuyển đổi Promise](#3-tạo--chuyển-đổi-promise)
  - [4. Kết hợp nhiều Promise (combinators)](#4-kết-hợp-nhiều-promise-combinators)
  - [5. Lỗi \& anti-pattern sâu](#5-lỗi--anti-pattern-sâu)
  - [6. Concurrency limit / `mapPool`](#6-concurrency-limit--mappool)
  - [7. `AbortSignal` — overview](#7-abortsignal--overview)
  - [8. `util.promisify` \& callbackify](#8-utilpromisify--callbackify)
  - [9. `node:stream/promises`](#9-nodestreampromises)
  - [10. Top-level await \& module graph](#10-top-level-await--module-graph)
  - [11. `AsyncLocalStorage` (tóm tắt)](#11-asynclocalstorage-tóm-tắt)
  - [12. Best practices](#12-best-practices)
  - [13. Checklist](#13-checklist)
  - [14. Cheat sheet](#14-cheat-sheet)
  - [15. Version matrix](#15-version-matrix)

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

Vấn đề: lồng callback (“callback hell”), khó `try/catch` tuần tự, dễ quên xử lý `err`, khó hủy giữa chừng.

### 1.2 Promise

```ts
import fs from "node:fs/promises";

fs.readFile("a.txt", "utf8")
  .then((data) => console.log(data))
  .catch((err) => console.error(err))
  .finally(() => console.log("done"));
```

Promise trạng thái: **pending** → **fulfilled** | **rejected** (settled **một lần** — xem §2).

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

main();
```

| Khái niệm | Ý nghĩa |
|-----------|---------|
| `async function` | luôn trả về **Promise** (kể cả `return` sync) |
| `await` | tạm dừng **hàm async** đến khi thenable settle; **không** block event loop |
| throw trong async | → Promise **reject** |
| `return x` trong async | → Promise **fulfill** với `x` |

```ts
async function f() {
  return 1; // tương đương Promise.resolve(1)
}
async function g() {
  throw new Error("x"); // tương đương Promise.reject(...)
}
```

---

## 2. Promise internals & semantics

### 2.1 Settled exactly once

```ts
const p = new Promise<number>((resolve, reject) => {
  resolve(1);
  resolve(2); // bị bỏ qua
  reject(new Error("late")); // bị bỏ qua
});
// p luôn fulfill với 1
```

Sau khi settled, thêm `.then` / `.catch` vẫn chạy (microtask) với kết quả đã cố định — không “re-settle”.

### 2.2 Thenables

Mọi object có method `then` callable đều có thể được `await` / được Promise “assimilate”:

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

- nếu `x` đã là Promise → trả về **cùng** instance (thường);
- nếu thenable → wrap và follow;
- ngược lại → fulfill ngay (vẫn qua microtask khi có reaction).

### 2.3 Microtask scheduling (tóm tắt)

```ts
console.log("A");
Promise.resolve().then(() => console.log("B")); // microtask
queueMicrotask(() => console.log("C"));
console.log("D");
// A D → B C  (thứ tự B/C theo enqueue)
```

- Reaction của Promise (`.then` / resume `await`) chạy trên **microtask queue**.
- Sau mỗi turn sync/macrotask, engine **xả hết** microtasks trước macrotask tiếp theo.
- Chi tiết phases, `nextTick`, starvation → [event-loop.md](event-loop.md).

### 2.4 `await` không phải “yield thread”

```ts
async function cpuBound() {
  await Promise.resolve(); // chỉ nhường một microtask turn
  for (let i = 0; i < 1e9; i++) {
    /* vẫn chặn event loop */
  }
}
```

I/O async tốt; CPU nặng vẫn cần worker / chia nhỏ — xem [threading.md](threading.md), [event-loop.md](event-loop.md).

---

## 3. Tạo & chuyển đổi Promise

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

Ưu tiên sẵn `node:fs/promises`, `node:timers/promises`, `util.promisify` thay vì tự wrap.

`Promise.withResolvers()` (ES2024 / Node hiện đại) — tách `resolve`/`reject` ra ngoài executor:

```ts
const { promise, resolve, reject } = Promise.withResolvers<number>();
setTimeout(() => resolve(1), 10);
await promise;
```

Hữu ích khi cầu nối event emitter / callback một lần; vẫn tránh async executor (§5.1).

---

## 4. Kết hợp nhiều Promise (combinators)

| API | Thành công khi | Thất bại khi | Kết quả |
|-----|----------------|--------------|---------|
| `Promise.all` | tất cả fulfill | **một** reject (fail-fast) | `T[]` |
| `Promise.allSettled` | tất cả settle | không throw vì nhánh | `{status,value\|reason}[]` |
| `Promise.race` | settle **nhanh nhất** | settle nhanh nhất là reject | `T` |
| `Promise.any` | fulfill **đầu tiên** | **tất cả** reject | `T` / `AggregateError` |

### 4.1 `Promise.all`

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

Dùng khi mọi nhánh đều cần thành công. Muốn dừng leftover work → truyền cùng `AbortSignal` và `abort()` khi một nhánh fail (xem [abort-context.md](abort-context.md)).

Input rỗng: `await Promise.all([])` → `[]` ngay (microtask).

### 4.2 `Promise.allSettled`

```ts
const results = await Promise.allSettled([p1, p2, p3]);
for (const r of results) {
  if (r.status === "fulfilled") console.log(r.value);
  else console.error(r.reason);
}
```

Phù hợp fan-out báo cáo / cleanup nhiều việc độc lập — **không** fail-fast.

### 4.3 `Promise.race`

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

### 4.4 `Promise.any`

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
- Nhánh còn lại sau fulfill đầu **không** bị cancel tự động.

### 4.5 Chọn combinator nhanh

| Nhu cầu | Chọn |
|---------|------|
| Tất cả phải OK, song song | `all` + signal nếu cần cancel leftover |
| Thu thập cả thành công/lỗi | `allSettled` |
| Timeout / first event | `race` **hoặc** tốt hơn: `AbortSignal.timeout` |
| First success (mirror) | `any` |
| Giới hạn độ song song | `mapPool` (§6), không `all` trần |

---

## 5. Lỗi & anti-pattern sâu

### 5.1 Async Promise constructor (anti-pattern)

```ts
// ❌
new Promise(async (resolve, reject) => {
  const x = await f(); // reject của f không tự vào reject() nếu quên try
  resolve(x);
});
```

Vấn đề:

- Executor `async` trả Promise bị **bỏ rơi** — lỗi có thể thành unhandled rejection.
- `resolve`/`reject` dễ race với throw muộn.
- Thừa lớp: bên ngoài đã là Promise.

```ts
// ✅
async function load() {
  return await f();
}
// hoặc
function load() {
  return f();
}
```

Chỉ dùng `new Promise` khi **cầu nối** API callback / event → Promise.

### 5.2 Floating promises

```ts
async function oops() {
  mightFail(); // ❌ quên await — lỗi dễ unhandled
}

// ❌ fire-and-forget không catch
saveAudit(row);

// ✅ có chủ đích
void saveAudit(row).catch((err) => logger.error(err));
```

Unhandled rejection: Node log nghiêm trọng; đừng dựa vào handler toàn cục để “sửa” logic — xem [exceptions.md](exceptions.md).

### 5.3 `await` trong vòng lặp vs `all`

```ts
// Tuần tự — chậm nếu độc lập
for (const id of ids) {
  await fetchUser(id);
}

// Song song không giới hạn — dễ storm
await Promise.all(ids.map((id) => fetchUser(id)));

// Song song có giới hạn — §6
await mapPool(ids, 8, (id) => fetchUser(id));
```

Dùng tuần tự khi: phụ thuộc kết quả trước, rate-limit chặt, hoặc side-effect phải theo thứ tự.

### 5.4 Nuốt lỗi / empty catch

```ts
try {
  await mightFail();
} catch {
  // ❌ nuốt — ít nhất log + metric, hoặc rethrow có cause
}
```

### 5.5 Mixed styles — đừng xen `.then` + `await` lung tung trong cùng hàm.

---

## 6. Concurrency limit / `mapPool`

Giống worker pool / semaphore trong Go — giới hạn số Promise “in flight”:

```ts
async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      signal?.throwIfAborted();
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  }

  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}
```

Fail-fast + dừng leftover: bọc `AbortController`, `abort()` trong `catch`, truyền cùng `signal` xuống `fn` (chi tiết compose → [abort-context.md](abort-context.md)). Thư viện cùng ý tưởng: `p-limit`, `p-map`.

| Tình huống | Gợi ý `limit` |
|------------|----------------|
| HTTP outbound | 8–32 (theo quota upstream) |
| `fs` song song | thấp hơn (threadpool libuv mặc định 4) |
| CPU / worker | ≈ số worker threads |

---

## 7. `AbortSignal` — overview

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

> **Độ sâu đầy đủ** (propagation trees, `AsyncLocalStorage`, AbortError detection, pitfalls, checklist): **[abort-context.md](abort-context.md)** — analogue của Go `context.md`.

`Promise.race` timeout **không** thay AbortSignal (§4.3).

---

## 8. `util.promisify` & callbackify

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
legacy("a.txt", (err, data) => { /* ... */ });
```

`promisify.custom` — symbol để thư viện tự cung cấp bản Promise tối ưu.

---

## 9. `node:stream/promises`

### 9.1 `pipeline`

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
- Một stage lỗi → hủy các stage khác (tránh leak fd / backpressure kẹt).

### 9.2 `finished`

```ts
import { finished } from "node:stream/promises";
import { createWriteStream } from "node:fs";

const ws = createWriteStream("out.bin");
ws.end(Buffer.from("hi"));
await finished(ws);
```

Promise khi stream `end` / `finish` / error — hữu ích khi tự quản lý pipe.

### 9.3 AbortSignal với streams

```ts
const ac = new AbortController();
await pipeline(src, transform, dest, { signal: ac.signal });
// ac.abort() → pipeline reject; streams được destroy
```

Nhiều Node stream API nhận `{ signal }` trong options (pipeline, một số `fs` / readline). Chi tiết hủy → [abort-context.md](abort-context.md).

### 9.4 Web Streams / `fetch` body

```ts
const res = await fetch(url);
const text = await res.text(); // consume body
// hoặc res.body (ReadableStream) + stream/web helpers
```

Đừng quên consume / cancel body khi abort sớm — tránh socket hang. Xem thêm [nodejs-apis.md](nodejs-apis.md).

### 9.5 `for await` trên Readable

```ts
async function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
```

Tôn trọng backpressure; hủy bằng `signal` + `stream.destroy(err)`.

---

## 10. Top-level await & module graph

Trong **ESM** (`.mjs` hoặc `"type":"module"`):

```ts
const config = await import("./config.js").then((m) => m.load());
export { config };
```

### 10.1 Hệ quả lên module graph

```text
entry.mjs
  └── awaits import A
        └── A top-level await (I/O)
              └── B, C chờ A evaluate xong mới tiếp tục
```

- Module có TLA **block** evaluation của importer cho đến khi await xong.
- Sibling imports có thể **song song** nếu không phụ thuộc lẫn nhau — runtime tối ưu theo dependency DAG.
- Lạm dụng TLA ở nhiều tầng → **cold start chậm**, khó đoán thứ tự side-effect.
- Cycle + TLA dễ deadlock / lỗi evaluation — tránh circular await.

### 10.2 CJS không có TLA

Entry CJS / dual package: bọc `async function main()`:

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

Chi tiết entrypoint → [main-function.md](main-function.md).

### 10.3 Khi nên / không nên TLA

| Nên | Không nên |
|-----|-----------|
| Load config một lần trước export | Await trong mọi leaf module |
| Feature detect ở boundary | I/O side-effect sâu trong lib reusable |
| Script ESM ngắn | Thay lazy init trên request path |

---

## 11. `AsyncLocalStorage` (tóm tắt)

Giống `context.Value` — gắn value **theo chuỗi async** (request ID, logger) không cần truyền mọi hàm:

```ts
import { AsyncLocalStorage } from "node:async_hooks";

const als = new AsyncLocalStorage<{ reqId: string }>();

als.run({ reqId: "abc" }, async () => {
  await doWork();
  console.log(als.getStore()?.reqId); // "abc"
});
```

ALS **không** hủy việc (dùng AbortSignal). Đừng nhét DB handle / thay DI bắt buộc. Đầy đủ → **[abort-context.md](abort-context.md)** (§5).

---

## 12. Best practices

1. Ưu tiên `async/await` + `try/catch`; `.then` khi chain ngắn.
2. Song song: `Promise.all` / `mapPool` có giới hạn — tránh storm.
3. Cancel thật → `AbortSignal`, không chỉ `Promise.race` timeout.
4. Không block event loop (CPU / `*Sync`) — [event-loop.md](event-loop.md).
5. Luôn xử lý rejection: `await`, `.catch`, hoặc `void p.catch(...)` có chủ đích.
6. Tránh `new Promise(async ...)`; chỉ wrap callback/event.
7. Combinator: leftover work vẫn chạy — abort khi cần dừng thật.
8. Stream: `pipeline` + `signal` hơn `.pipe()` thủ công.
9. TLA chỉ ở boot/config; API mới = Promise + `signal`.

---

## 13. Checklist

```text
□ Mọi Promise “bỏ rơi” đều có catch có chủ đích
□ Không dùng async Promise constructor
□ all/race/any: đã cân nhắc leftover work + AbortSignal
□ Fan-out lớn dùng mapPool / p-limit, không all trần
□ Timeout = AbortSignal.timeout (hoặc any), không chỉ race+sleep
□ Stream dùng pipeline(+signal); không pipe quên error
□ TLA chỉ ở entry/config; CJS entry có main().catch
□ ALS chỉ request-scoped hẹp; hủy dùng AbortSignal
□ CPU nặng offload worker; không await “ảo” để nghĩ đã nhường thread
```

---

## 14. Cheat sheet

| API / pattern | Việc |
|---------------|------|
| `async` / `await` | viết flow tuần tự trên Promise |
| `Promise.all` | song song, fail-fast |
| `Promise.allSettled` | chờ tất cả, không fail-fast |
| `Promise.race` | settle nhanh nhất (**không** cancel) |
| `Promise.any` | fulfill đầu; all fail → `AggregateError` |
| `Promise.withResolvers` | tách resolve/reject |
| `Promise.resolve` / thenable | wrap / assimilate |
| `mapPool` | giới hạn concurrency |
| `AbortSignal.timeout` / `.any` | hủy / gộp tín hiệu |
| `util.promisify` | callback → Promise |
| `stream/promises.pipeline` | pipe an toàn + optional signal |
| Top-level `await` | ESM boot / config |
| `AsyncLocalStorage` | request-scoped values |

```ts
// Skeleton an toàn
async function run(signal: AbortSignal) {
  signal.throwIfAborted();
  const rows = await mapPool(ids, 8, (id) => fetchOne(id, signal), signal);
  await pipeline(src, dest, { signal });
  return rows;
}
```

---

## 15. Version matrix

| Phiên bản / giai | Liên quan async |
|-----------------|-----------------|
| ES2015 / Node cũ | Promise |
| ES2017 | async/await |
| ES2020 | `allSettled`, `matchAll`… |
| ES2021 | `Promise.any`, `AggregateError` |
| Node 15+ | Unhandled rejection nghiêm hơn (theo flag/version) |
| Node 17.3+ / 16.14+ | `AbortSignal.timeout` (ổn định dần) |
| Node 20+ | `AbortSignal.any` rộng rãi; Web Streams mạnh hơn |
| ES2024 / Node 22+ | `Promise.withResolvers` |
| Node 24–26 | Baseline tài liệu: fetch/undici + signal phổ biến trên fs/stream |

Baseline repo: **Node 26** + **TS 7** — dùng `timeout` / `any` / `withResolvers` / `throwIfAborted` thoải mái.

---

## Tài liệu liên quan

- [abort-context.md](abort-context.md) — AbortSignal, ALS, patterns hủy (sâu)
- [event-loop.md](event-loop.md) — microtask, phases, blocking
- [exceptions.md](exceptions.md) — rejection, AggregateError, unhandledRejection
- [main-function.md](main-function.md) — entry / TLA / shutdown
- [threading.md](threading.md) — worker khi cần song song thật
- [nodejs-apis.md](nodejs-apis.md) — fs, http, fetch, stream
