# AbortSignal & request context

*(AbortController / AbortSignal, propagation, AsyncLocalStorage — analogue của Go `context`)*

Baseline: **Node.js 26**, **TypeScript 7**, ESM. Trong Node không có `context.Context` thống nhất; **hủy** dùng `AbortSignal`, **request-scoped values** dùng `AsyncLocalStorage` (hoặc truyền tham số tường minh). Promise / combinators → [async.md](async.md).

> **Ánh xạ Go → Node**

| Go | Node |
|----|------|
| `ctx.Done()` / cancel | `AbortSignal` / `AbortController.abort` |
| `WithTimeout` / deadline | `AbortSignal.timeout(ms)` |
| `WithCancelCause` / `Cause` | `abort(reason)` / `signal.reason` |
| `WithValue` | `AsyncLocalStorage` (hoặc param) |
| `ctx` tham số đầu | `signal?: AbortSignal` (convention) |
| `errors.Is(..., Canceled)` | detect AbortError / `signal.aborted` |

---

## Mục lục

1. [AbortController / AbortSignal API](#1-abortcontroller--abortsignal-api)
2. [timeout, any, abort(reason), throwIfAborted](#2-timeout-any-abortreason-throwifaborted)
3. [Cây propagation & composing signals](#3-cây-propagation--composing-signals)
4. [API nhận `signal` (fetch / fs / undici / Node)](#4-api-nhận-signal-fetch--fs--undici--node)
5. [AsyncLocalStorage (như context.Value)](#5-asynclocalstorage-như-contextvalue)
6. [Patterns thực tế](#6-patterns-thực-tế)
7. [AbortError / DOMException detection](#7-aborterror--domexception-detection)
8. [Pitfalls](#8-pitfalls)
9. [Best practices](#9-best-practices)
10. [Checklist](#10-checklist)
11. [Cheat sheet](#11-cheat-sheet)
12. [Version notes](#12-version-notes)

---

## 1. AbortController / AbortSignal API

```ts
const ac = new AbortController();
const { signal } = ac;

signal.aborted;  // boolean
signal.reason;   // any — lý do sau khi abort (undefined trước đó / tùy engine)
ac.abort();      // hoặc ac.abort(reason)
```

| Thành phần | Vai trò |
|------------|---------|
| `AbortController` | chủ sở hữu — gọi `abort()` |
| `AbortSignal` | tín hiệu chỉ-đọc truyền xuống callee |
| `aborted` | đã hủy chưa |
| `reason` | giá trị truyền vào `abort(reason)` |
| `addEventListener("abort", …)` | cleanup khi hủy |
| `throwIfAborted()` | throw ngay nếu đã aborted |

`AbortSignal` kế thừa `EventTarget` — lắng nghe `"abort"` một lần khi cần hủy timer / socket / công việc phụ.

```ts
const ac = new AbortController();

ac.signal.addEventListener(
  "abort",
  () => {
    console.log("aborted:", ac.signal.reason);
  },
  { once: true },
);

ac.abort(new Error("user cancel"));
```

Convention API:

```ts
async function query(sql: string, signal?: AbortSignal): Promise<Row[]> {
  signal?.throwIfAborted();
  // ... truyền signal xuống driver / fetch
}
```

Giống Go: truyền **cùng** hoặc **derived** signal xuống mọi I/O; không “nuốt” tín hiệu ở tầng giữa.

---

## 2. timeout, any, abort(reason), throwIfAborted

### 2.1 `abort(reason)`

```ts
const ac = new AbortController();
ac.abort(new DOMException("upstream slow", "TimeoutError"));
// ac.signal.aborted === true
// ac.signal.reason === DOMException ...
```

- `abort()` idempotent: lần sau **không** đổi `reason` (lần đầu thắng).
- `abort()` không có argument → `reason` thường là `DOMException` AbortError (tùy runtime).
- Truyền `reason` có ý nghĩa (timeout vs client disconnect) giúp telemetry / nhánh xử lý.

### 2.2 `throwIfAborted`

```ts
function startWork(signal?: AbortSignal) {
  signal?.throwIfAborted(); // fail fast trước khi mở resource
  // ...
}
```

Gọi ở **đầu** hàm và trước vòng lặp dài / trước I/O đắt — tránh bắt đầu việc đã bị hủy.

### 2.3 `AbortSignal.timeout(ms)`

```ts
const signal = AbortSignal.timeout(5_000);
await fetch(url, { signal });
// hết hạn → abort với TimeoutError (DOMException name "TimeoutError")
```

Tương đương ý `WithTimeout`: không cần `setTimeout` + `AbortController` thủ công (và khó quên clear).

### 2.4 `AbortSignal.any(iterable)`

```ts
const user = req.signal; // ví dụ IncomingMessage / framework
const signal = AbortSignal.any([user, AbortSignal.timeout(10_000)]);
await doWork({ signal });
```

Settle (abort) khi **bất kỳ** signal con abort — `reason` lấy từ signal abort **đầu tiên**.

### 2.5 `AbortSignal.abort(reason?)` (static)

```ts
const already = AbortSignal.abort(new Error("pre-canceled"));
already.aborted; // true
```

Tiện cho test / stub “đã hủy sẵn”.

### 2.6 Bảng nhanh

| API | Việc |
|-----|------|
| `new AbortController()` | tạo cặp controller/signal |
| `ac.abort(reason?)` | hủy; reason lần đầu thắng |
| `signal.aborted` / `signal.reason` | trạng thái & lý do |
| `signal.throwIfAborted()` | throw nếu đã hủy |
| `AbortSignal.timeout(ms)` | tự abort sau ms |
| `AbortSignal.any([...])` | abort khi một trong các signal abort |
| `AbortSignal.abort(reason?)` | signal đã aborted sẵn |

---

## 3. Cây propagation & composing signals

```text
request signal (client disconnect)
 └── AbortSignal.any([req, timeout(10s)])
      └── child op timeout(3s)  — chặt hơn
           └── fetch / db / fs
```

### 3.1 Parent abort → child phải dừng

Không có cây tự động như Go `WithCancel(parent)`. Bạn **phải compose** tường minh:

```ts
function deriveTimeout(parent: AbortSignal | undefined, ms: number): AbortSignal {
  const t = AbortSignal.timeout(ms);
  return parent ? AbortSignal.any([parent, t]) : t;
}

async function handler(reqSignal: AbortSignal) {
  const signal = deriveTimeout(reqSignal, 3_000);
  await fetch(url, { signal });
}
```

**Shortest wins:** timeout con chỉ có thể **chặt hơn** parent nếu bạn `any` với parent — đừng tạo timeout mới **bỏ qua** parent (mất hủy khi client ngắt).

### 3.2 Liên kết listener thủ công (khi không dùng `any`)

```ts
function linkSignal(parent: AbortSignal): { signal: AbortSignal; dispose: () => void } {
  const ac = new AbortController();
  const onAbort = () => ac.abort(parent.reason);
  if (parent.aborted) {
    ac.abort(parent.reason);
  } else {
    parent.addEventListener("abort", onAbort);
  }
  return {
    signal: ac.signal,
    dispose: () => parent.removeEventListener("abort", onAbort),
  };
}
```

Luôn `dispose` / `{ once: true }` để tránh leak listener khi parent sống lâu (server process).

### 3.3 Detach (hiếm — như `WithoutCancel`)

Đôi khi nhánh phải chạy xong dù request đã hủy (audit log):

```ts
async function auditAfter(reqSignal: AbortSignal, payload: unknown) {
  // không truyền reqSignal xuống — hoặc timeout riêng
  const signal = AbortSignal.timeout(2_000);
  await writeAudit(payload, { signal });
}
```

Gắn **timeout riêng**; đừng để việc “detach” chạy vô hạn.

---

## 4. API nhận `signal` (fetch / fs / undici / Node)

| API | Ví dụ |
|-----|--------|
| `fetch` / Undici | `fetch(url, { signal })` — hủy cả lúc đọc body |
| `fs/promises` | `readFile` / `writeFile` / … + `{ signal }` |
| `stream/promises` | `pipeline(src, …, dest, { signal })` |
| `timers/promises` | `setTimeout(ms, undefined, { signal })` |

### 4.1 HTTP server — client ngắt

```ts
import http from "node:http";

http.createServer((req, res) => {
  const ac = new AbortController();
  req.on("close", () => {
    if (!res.writableFinished) ac.abort(new Error("client closed"));
  });
  void handle(req, res, ac.signal).catch(() => {
    if (!res.headersSent) res.writeHead(499);
    res.end();
  });
});
```

Framework (Fastify/Hono/…): dùng `req.signal` (hoặc tương đương) làm parent. Abort request ≠ luôn đóng mọi socket pool ngay — nhưng JS của bạn phải dừng.

### 4.2 API chưa hỗ trợ signal

Có thể race Promise với `abort` listener để **reject sớm** — Promise gốc **vẫn chạy**. Cancel thật chỉ khi API tôn trọng `signal` (hoặc `destroy` trong listener).

---

## 5. AsyncLocalStorage (như context.Value)

```ts
import { AsyncLocalStorage } from "node:async_hooks";

type Store = { reqId: string; userId?: string };
const als = new AsyncLocalStorage<Store>();

export function runWithRequest<T>(store: Store, fn: () => T): T {
  return als.run(store, fn);
}

export function reqId(): string | undefined {
  return als.getStore()?.reqId;
}
```

Middleware / entry:

```ts
als.run({ reqId: crypto.randomUUID() }, () => {
  void handleRequest(); // await bên trong vẫn thấy store
});
```

### 5.1 Được lưu (hẹp)

- Request ID / trace / correlation ID  
- User identity đã auth (readonly snapshot)  
- Logger child gắn request  

### 5.2 Không lưu

| Tránh | Vì sao |
|-------|--------|
| DB pool / client mutable | lifetime ≠ request; khó test |
| Tham số bắt buộc của hàm | không hiện signature — dùng argument |
| AbortController “giấu” | dễ quên propagate; truyền `signal` tường minh |
| Config toàn cục / feature flags | DI hoặc import module |
| Object bị mutate lung tung | race giữa handlers |

> Nếu thiếu value làm hàm sai → đó là **parameter**, không phải ALS store.

### 5.3 ALS ≠ cancellation; mất store

ALS chỉ metadata; AbortSignal mới dừng việc (`fetch(url, { signal })`). Worker/process **không** kế thừa ALS. Tránh `enterWith` (dễ leak store sang request sau). Một số native callback có thể **mất** async context — kiểm tra khi integrate. Chi tiết Promise → [async.md](async.md).

---

## 6. Patterns thực tế

### 6.1 HTTP cancel + graceful timeout

```ts
async function loadUser(id: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const res = await fetch(`https://api.example/users/${id}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function withBudget<T>(
  parent: AbortSignal | undefined,
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const signal = parent
    ? AbortSignal.any([parent, AbortSignal.timeout(ms)])
    : AbortSignal.timeout(ms);
  return fn(signal);
}

await withBudget(req.signal, 5_000, (s) => loadUser(id, s));
```

### 6.2 Cleanup on abort

```ts
async function watch(signal: AbortSignal) {
  const iv = setInterval(() => ping(), 1_000);
  const onAbort = () => clearInterval(iv);
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    await sleepForever(signal);
  } finally {
    clearInterval(iv);
    signal.removeEventListener("abort", onAbort);
  }
}
```

`finally` vẫn chạy khi abort reject — đóng fd / clear timer dù listener đã fire.

### 6.3 Fan-out hủy leftover + shutdown

```ts
async function allOrAbort<T>(
  tasks: ((signal: AbortSignal) => Promise<T>)[],
  parent?: AbortSignal,
): Promise<T[]> {
  const ac = new AbortController();
  const linked = parent ? AbortSignal.any([parent, ac.signal]) : ac.signal;
  try {
    return await Promise.all(tasks.map((t) => t(linked)));
  } catch (e) {
    ac.abort(e);
    throw e;
  }
}

const root = new AbortController();
process.on("SIGINT", () => root.abort(new Error("SIGINT")));
process.on("SIGTERM", () => root.abort(new Error("SIGTERM")));
await runServer(root.signal);
```

Combinators → [async.md](async.md). Entry / graceful shutdown → [main-function.md](main-function.md).

---

## 7. AbortError / DOMException detection

Abort thường throw `DOMException` với `name === "AbortError"` hoặc `"TimeoutError"` (tùy `timeout` vs `abort()`).

```ts
function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException) {
    return e.name === "AbortError" || e.name === "TimeoutError";
  }
  if (e instanceof Error && e.name === "AbortError") return true;
  return false;
}

function isTimeoutError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "TimeoutError";
}
```

Kết hợp `signal`:

```ts
try {
  await work(signal);
} catch (e) {
  if (signal.aborted || isAbortError(e)) {
    // hủy / timeout có chủ đích — thường không log error-level
    return;
  }
  throw e; // hoặc wrap { cause: e } — exceptions.md
}
```

Đừng chỉ `catch` mọi Error rồi nuốt — phân biệt abort vs lỗi thật. Xem [exceptions.md](exceptions.md).

---

## 8. Pitfalls

1. **`Promise.race` + sleep ≠ cancel** — dùng `AbortSignal.timeout`.
2. **Quên truyền `signal`** — tầng trên abort, I/O dưới vẫn chạy.
3. **Already-aborted** — listener đăng ký muộn không chạy; check `aborted` / `throwIfAborted()` trước.
4. **Listener không gỡ** — `{ once: true }` hoặc `removeEventListener` trong `finally`.
5. **`abort()` lần sau không đổi `reason`** — lần đầu thắng.
6. **Timeout bỏ parent** — mất client-disconnect; luôn `any([parent, timeout])`.
7. **Wrap Promise “fake cancel”** — chỉ reject sớm, việc gốc vẫn chạy.
8. **ALS thay signal / DI** — sai trách nhiệm.
9. **Nuốt AbortError** mọi tầng — map ở biên HTTP (499 / client-closed).
10. **CPU loop không check abort** — `throwIfAborted()` định kỳ; CPU nặng → worker ([event-loop.md](event-loop.md)).

```ts
function onAbort(signal: AbortSignal, fn: () => void) {
  if (signal.aborted) {
    fn();
    return;
  }
  signal.addEventListener("abort", fn, { once: true });
}
```

---

## 9. Best practices

1. Hàm I/O nhận / propagate `signal`; compose `any([parent, timeout(ms)])`.
2. `throwIfAborted()` đầu hàm; cleanup trong listener **và** `finally`.
3. Phân biệt AbortError / TimeoutError khi log; ALS chỉ request-scoped hẹp.
4. Fan-out fail-fast: abort leftover; test abort giữa chừng + already-aborted.
5. Không cất request `AbortController` vào singleton process-lifetime.

---

## 10. Checklist

```text
□ I/O propagate signal; timeout compose với parent
□ throwIfAborted / already-aborted trước khi mở resource
□ Listener once hoặc remove trong finally
□ fetch/fs/pipeline/timers nhận signal thật
□ AbortError ≠ 500; ALS không giấu signal
□ Fan-out abort leftover; SIGINT/SIGTERM → root abort
```

---

## 11. Cheat sheet

| API / pattern | Việc |
|---------------|------|
| `AbortController` / `abort(reason)` | tạo & hủy |
| `throwIfAborted` / `aborted` / `reason` | trạng thái |
| `AbortSignal.timeout` / `.any` / `.abort` | deadline / gộp / stub |
| `addEventListener("abort", …, { once })` | cleanup |
| `{ signal }` trên fetch/fs/pipeline/timers | hủy thật |
| `AsyncLocalStorage.run` | request values |
| `isAbortError` / `isTimeoutError` | phân nhánh |

```ts
async function handle(reqSignal: AbortSignal) {
  const signal = AbortSignal.any([reqSignal, AbortSignal.timeout(10_000)]);
  return als.run({ reqId: crypto.randomUUID() }, async () => {
    try {
      return await service(signal);
    } catch (e) {
      if (signal.aborted || isAbortError(e)) return;
      throw e;
    }
  });
}
```

---

## 12. Version notes

| Mốc | Ghi chú |
|-----|---------|
| AbortController trên Node | ổn định từ ~16+ |
| `AbortSignal.timeout` | 17.3+ / 16.14+ |
| `AbortSignal.any` | 20.3+; thoải mái trên **26** |
| `throwIfAborted` / `reason` | Web IDL / Node hiện đại |
| fs + signal, ALS | baseline **26** — không cần polyfill |

---

## Tài liệu liên quan

- [async.md](async.md) — Promise, combinators, mapPool, TLA
- [event-loop.md](event-loop.md) — abort không cứu CPU sync
- [main-function.md](main-function.md) — entry, process signal, shutdown
- [exceptions.md](exceptions.md) — AbortError vs lỗi thật
- [nodejs-apis.md](nodejs-apis.md) — fetch, fs, stream, http
