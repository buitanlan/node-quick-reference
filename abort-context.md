# AbortSignal & request context

*(AbortController / AbortSignal, propagation, AsyncLocalStorage — analogue của Go `context`)*

Baseline: **Node.js 26**, **TypeScript 7**, ESM. Trong Node không có `context.Context` thống nhất; **hủy** dùng `AbortSignal`, **request-scoped values** dùng `AsyncLocalStorage` (hoặc truyền tham số tường minh). Promise / combinators leftover → [async.md](async.md).

> **Ánh xạ Go → Node**

| Go | Node |
|----|------|
| `ctx.Done()` / cancel | `AbortSignal` / `AbortController.abort` |
| `WithTimeout` / deadline | `AbortSignal.timeout(ms)` / timeout còn lại đến deadline |
| `WithCancelCause` / `Cause` | `abort(reason)` / `signal.reason` |
| `WithValue` | `AsyncLocalStorage` (hoặc param) |
| `ctx` tham số đầu | `signal?: AbortSignal` (convention) |
| `errors.Is(..., Canceled)` | detect AbortError / `signal.aborted` |

---

## Mục lục

- [1. AbortController / AbortSignal API](#1-abortcontroller--abortsignal-api)
  - [1.1 Abort khi controller đã aborted](#11-abort-khi-controller-đã-aborted)
- [2. timeout, deadline, cancel, reason](#2-timeout-deadline-cancel-reason)
  - [2.1 `reason` là `any`](#21-reason-là-any)
  - [2.2 Bảng API nhanh](#22-bảng-api-nhanh)
- [3. Cây propagation, `any`, diamond](#3-cây-propagation-any-diamond)
  - [3.1 `AbortSignal.any` — reason của ai?](#31-abortsignalany--reason-của-ai)
  - [3.2 Diamond — một parent, nhiều `any`](#32-diamond--một-parent-nhiều-any)
  - [3.3 Link thủ công (khi không dùng `any`)](#33-link-thủ-công-khi-không-dùng-any)
  - [3.4 Detach (hiếm — `WithoutCancel`)](#34-detach-hiếm--withoutcancel)
  - [3.5 Ngân sách lồng nhau (số)](#35-ngân-sách-lồng-nhau-số)
- [4. EventTarget: `once`, already-aborted](#4-eventtarget-once-already-aborted)
- [5. API nhận `signal` (fetch / HTTP / fs / undici)](#5-api-nhận-signal-fetch--http--fs--undici)
  - [5.1 `fetch` abort ≠ “HTTP cancel” phía server](#51-fetch-abort--http-cancel-phía-server)
  - [5.2 Undici `Dispatcher` / `Agent`](#52-undici-dispatcher--agent)
  - [5.3 `fs/promises` + `signal`](#53-fspromises--signal)
  - [5.4 API chưa hỗ trợ signal](#54-api-chưa-hỗ-trợ-signal)
  - [5.5 HTTP server — client ngắt](#55-http-server--client-ngắt)
  - [5.6 `IncomingMessage`: `aborted` / `close` / `destroy`](#56-incomingmessage-aborted--close--destroy)
  - [5.7 Stream + abort](#57-stream--abort)
  - [5.8 Request hoàn tất khác response bị ngắt](#58-request-hoàn-tất-khác-response-bị-ngắt)
- [6. HTTP 499 vs 500](#6-http-499-vs-500)
- [7. AsyncLocalStorage](#7-asynclocalstorage)
  - [7.1 `run` vs `enterWith`](#71-run-vs-enterwith)
  - [7.2 Nested `run`](#72-nested-run)
  - [7.3 Được lưu / không lưu](#73-được-lưu--không-lưu)
  - [7.4 `exit`, `disable`, `defaultValue`](#74-exit-disable-defaultvalue)
  - [7.5 Custom pool: `AsyncResource` & emission context](#75-custom-pool-asyncresource--emission-context)
- [8. `using` + abort cleanup](#8-using--abort-cleanup)
- [9. Patterns thực tế](#9-patterns-thực-tế)
  - [9.1 HTTP cancel + graceful timeout](#91-http-cancel--graceful-timeout)
  - [9.2 Cleanup on abort](#92-cleanup-on-abort)
  - [9.3 Fan-out leftover + shutdown](#93-fan-out-leftover--shutdown)
  - [9.4 Vòng đời request (ghép hết)](#94-vòng-đời-request-ghép-hết)
  - [9.5 `fetch` timeline abort](#95-fetch-timeline-abort)
- [10. AbortError detection](#10-aborterror-detection)
- [11. Test patterns](#11-test-patterns)
- [12. Pitfalls](#12-pitfalls)
  - [12.1 Compose helpers (copy-paste)](#121-compose-helpers-copy-paste)
  - [12.2 `addEventListener` options `signal`](#122-addeventlistener-options-signal)
- [13. Best practices](#13-best-practices)
- [14. Checklist](#14-checklist)
- [15. Cheat sheet](#15-cheat-sheet)
- [16. Version notes](#16-version-notes)
- [17. Tài liệu liên quan](#17-tài-liệu-liên-quan)

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
| `reason` | giá trị truyền vào `abort(reason)` — **mọi kiểu** |
| `addEventListener("abort", …)` | cleanup khi hủy |
| `throwIfAborted()` | throw `reason` ngay nếu đã aborted |

`AbortSignal` kế thừa `EventTarget` — lắng nghe `"abort"` một lần khi cần hủy timer / socket / công việc phụ.

Convention API:

```ts
async function query(sql: string, signal?: AbortSignal): Promise<Row[]> {
  signal?.throwIfAborted();
  // ... truyền signal xuống driver / fetch
}
```

Giống Go: truyền **cùng** hoặc **derived** signal xuống mọi I/O; không “nuốt” tín hiệu ở tầng giữa.

### 1.1 Abort khi controller đã aborted

`abort()` **idempotent**: lần sau **không** đổi `reason`, **không** emit `"abort"` lần hai.

```ts
const ac = new AbortController();
ac.abort(new Error("first"));
ac.abort(new Error("second")); // no-op
ac.signal.reason; // Error "first"
```

Hệ quả:

- Listener đăng ký **sau** abort **không** chạy (event đã qua).
- Phải `if (signal.aborted) cleanup()` **trước** `addEventListener`.
- `throwIfAborted()` an toàn gọi nhiều lần; throw `reason` gốc.
- `fetch` / `readFile` với signal đã aborted: reject **sync-or-microtask ngay**, không bắt đầu I/O.

Nhiều listener trên một signal: tất cả nhận `"abort"` (một lần). Thứ tự listener = thứ tự đăng ký EventTarget. Cleanup độc lập phải **idempotent** (destroy socket hai lần an toàn).

```ts
const already = AbortSignal.abort(new Error("pre-canceled"));
already.aborted; // true
already.throwIfAborted(); // throw Error("pre-canceled")
```

`AbortSignal.abort(reason?)` — signal **đã** aborted (test / stub). `fetch(url, { signal: already })` reject ngay, không ra mạng.

> **Pitfall:** “abort lại cho chắc” với reason mới **không** cập nhật telemetry. Lần đầu thắng — abort **đúng reason** ngay từ đầu (timeout vs client vs SIGTERM).

---

## 2. timeout, deadline, cancel, reason

Ba ý niệm hay bị gộp thành một `setTimeout`:

| | Ý | API điển hình |
|--|---|----------------|
| **Cancel** | Chủ động dừng (user, client disconnect, shutdown) | `AbortController.abort(reason)` |
| **Timeout** | Ngân sách **tương đối** từ *bây giờ* | `AbortSignal.timeout(ms)` |
| **Deadline** | Mốc **tuyệt đối** (`Date.now() + remaining`) | Tự `timeout(deadline - Date.now())` + `any` với parent |

Không có `AbortSignal.deadline(epochMs)` built-in. Lồng nhiều tầng: truyền **deadline** số, mỗi tầng `timeout(Math.max(0, deadline - Date.now()))` rồi `any([parent, t])` — giống Go `WithDeadline` (shortest wins).

```ts
function withDeadline(parent: AbortSignal | undefined, deadlineMs: number): AbortSignal {
  const ms = Math.max(0, deadlineMs - Date.now());
  const t = AbortSignal.timeout(ms);
  return parent ? AbortSignal.any([parent, t]) : t;
}

const deadline = Date.now() + 5_000;
await inner(withDeadline(reqSignal, deadline)); // inner không được timeout dài hơn remaining
```

`AbortSignal.timeout(ms)` hết hạn → abort với `DOMException` `name === "TimeoutError"` (không phải AbortError thuần). Phân nhánh log: timeout vs user cancel.

### 2.1 `reason` là `any`

```ts
ac.abort(new DOMException("upstream slow", "TimeoutError"));
ac.abort("CLIENT_GONE"); // hợp lệ — primitive
ac.abort({ code: 499 }); // hợp lệ — object
```

- `abort()` không argument → `reason` thường `DOMException` AbortError.
- `throwIfAborted()` **throw đúng `reason`** — có thể không phải `Error` → `catch (e)` + `instanceof Error` thất bại.
- Telemetry: chuẩn hóa `reason` thành Error ở **biên** abort (controller của bạn), không tin mọi callee abort Error.

```ts
function abortAsError(signal: AbortSignal, fallback: string): Error {
  const r = signal.reason;
  if (r instanceof Error) return r;
  return new Error(fallback, { cause: r });
}
```

> **Pitfall:** `abort(undefined)` sau khi đã có reason mặc định — lần đầu vẫn thắng; đừng kỳ vọng “ghi đè undefined”. JSON log `reason` primitive thì không có stack.

Bảng reason thường gặp:

| Nguồn | `reason` điển hình | `name` |
|-------|-------------------|--------|
| `abort()` không arg | `DOMException` | `AbortError` |
| `AbortSignal.timeout` | `DOMException` | `TimeoutError` |
| `abort(new Error("client"))` | `Error` | `Error` |
| `abort("CLIENT_GONE")` | string | — |
| Undici abort request | `RequestAbortedError` / AbortError | tùy phiên |
| `throwIfAborted` | **đúng** `signal.reason` | tùy bạn abort |

Map ở biên HTTP: TimeoutError → 504; AbortError + client close → 499; còn lại 500. Đừng `String(reason)` mất stack.

### 2.2 Bảng API nhanh

| API | Việc |
|-----|------|
| `new AbortController()` | tạo cặp controller/signal |
| `ac.abort(reason?)` | hủy; reason lần đầu thắng |
| `signal.aborted` / `signal.reason` | trạng thái & lý do |
| `signal.throwIfAborted()` | throw `reason` nếu đã hủy |
| `AbortSignal.timeout(ms)` | tự abort sau ms (TimeoutError) |
| `AbortSignal.any([...])` | abort khi một trong các signal abort |
| `AbortSignal.abort(reason?)` | signal đã aborted sẵn |

---

## 3. Cây propagation, `any`, diamond

```text
request signal (client disconnect)
 └── AbortSignal.any([req, timeout(10s)])     ← budget request
      └── child any([parent, timeout(3s)])    ← chặt hơn
           └── fetch / db / fs
```

Không có cây tự động như Go `WithCancel(parent)`. Bạn **phải compose** tường minh.

```ts
function deriveTimeout(parent: AbortSignal | undefined, ms: number): AbortSignal {
  const t = AbortSignal.timeout(ms);
  return parent ? AbortSignal.any([parent, t]) : t;
}
```

**Shortest wins:** timeout con chỉ chặt hơn nếu `any` với parent. Timeout mới **bỏ parent** → mất hủy khi client ngắt.

### 3.1 `AbortSignal.any` — reason của ai?

Settle khi **bất kỳ** input abort. `reason` lấy từ signal abort **đầu tiên** (không gộp). Input rỗng: signal **không** tự abort (không có nguồn). Input đã aborted: kết quả **aborted ngay** với reason đó.

```ts
const user = reqSignal;
const combined = AbortSignal.any([user, AbortSignal.timeout(10_000)]);
await doWork({ signal: combined });
```

### 3.2 Diamond — một parent, nhiều `any`

```text
            parent P
           /         \
     any([P, T1])   any([P, T2])     ← S1, S2
           \         /
          any([S1, S2])              ← D (kim cương)
```

```ts
const p = new AbortController();
const s1 = AbortSignal.any([p.signal, AbortSignal.timeout(3_000)]);
const s2 = AbortSignal.any([p.signal, AbortSignal.timeout(5_000)]);
const d = AbortSignal.any([s1, s2]);

p.abort(new Error("client"));
// S1, S2, D đều aborted; reason "client" (P thắng trước timer)
```

Hợp lệ và phổ biến (nhiều callee tự `any` với cùng request signal). Hệ quả:

- Theo chuẩn WHATWG DOM và Node 22.x+/24/26, `AbortSignal.any()` giữ liên kết bằng **weak references** nội bộ: derived signal được GC bình thường khi không còn tham chiếu mạnh (kể cả khi parent là process-level `SIGINT` controller). Leak thật đến từ việc bạn **tự gắn `addEventListener("abort", ...)` mà không gỡ** hoặc **cache/giữ strong reference** tới các derived signal trên parent sống lâu.
- Kim cương không “abort hai lần” trên P; P idempotent. D abort một lần theo nhánh nhanh hơn.
- Đừng tạo `any([s1, s2])` nếu chỉ cần P — thừa; truyền P hoặc một derived.

> **Pitfall:** `AbortSignal.any([timeout(100), timeout(100)])` — hai timer độc lập; reason là TimeoutError của timer fire trước (không xác định cái nào nếu cùng ms). Một `timeout` rồi share signal.

### 3.3 Link thủ công (khi không dùng `any`)

```ts
function linkSignal(parent: AbortSignal): { signal: AbortSignal; dispose: () => void } {
  const ac = new AbortController();
  const onAbort = () => ac.abort(parent.reason);
  if (parent.aborted) ac.abort(parent.reason);
  else parent.addEventListener("abort", onAbort);
  return {
    signal: ac.signal,
    dispose: () => parent.removeEventListener("abort", onAbort),
  };
}
```

Luôn `dispose` / `{ once: true }` khi parent sống lâu hơn child (server process).

### 3.4 Detach (hiếm — `WithoutCancel`)

Nhánh phải chạy xong dù request hủy (audit):

```ts
async function auditAfter(_reqSignal: AbortSignal, payload: unknown) {
  const signal = AbortSignal.timeout(2_000); // không gắn parent
  await writeAudit(payload, { signal });
}
```

Gắn timeout riêng; đừng detach vô hạn.

### 3.5 Ngân sách lồng nhau (số)

```ts
async function handler(reqSignal: AbortSignal) {
  const deadline = Date.now() + 10_000; // 10s cả request
  const signal = withDeadline(reqSignal, deadline);
  const user = await fetchUser(signal);
  const orders = await loadOrders(withDeadline(reqSignal, deadline));
  return { user, orders };
}
```

Sai: mỗi tầng `timeout(10_000)` **mới** — tổng có thể >> 10s nếu hiểu nhầm “mỗi call 10s”. Đúng: **deadline tuyệt đối** hoặc trừ elapsed. `AbortSignal.timeout` không “còn lại tự động” khi lồng.

Hai `timeout(5000)` song song trên cùng parent: cả hai độc lập; parent abort hủy cả hai qua `any`.

---

## 4. EventTarget: `once`, already-aborted

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

| Option / API | Việc |
|--------------|------|
| `{ once: true }` | Tự gỡ sau lần abort (abort chỉ fire một lần anyway) |
| `{ signal: other }` | Gỡ listener khi `other` abort — hữu ích listener phụ thuộc đời child |
| `removeEventListener` trong `finally` | Bắt buộc nếu không `once` / parent sống lâu |
| `onabort = fn` | Một slot; dễ ghi đè — ưu tiên `addEventListener` |

**Already-aborted:** `addEventListener("abort", fn)` **không** gọi `fn` nếu `aborted === true`. Helper bắt buộc:

```ts
function onAbort(signal: AbortSignal, fn: () => void): () => void {
  if (signal.aborted) {
    fn();
    return () => {};
  }
  signal.addEventListener("abort", fn, { once: true });
  return () => signal.removeEventListener("abort", fn);
}
```

`throwIfAborted()` đầu hàm **và** trước vòng lặp / I/O đắt — tránh mở fd rồi mới biết đã hủy.

**Fan-out nhiều listener & `util.aborted`:**

- `AbortSignal` có ngưỡng mặc định 10 listener trước khi Node phát `MaxListenersExceededWarning`. Khi một signal dùng chung fan-out sang nhiều nhánh (>10 tác vụ song song hoặc process shutdown signal), nâng ngưỡng tường minh bằng `events.setMaxListeners(n, signal)` (không lạm dụng để che leak listener thật):
  ```ts
  import { setMaxListeners } from "node:events";

  const ac = new AbortController();
  setMaxListeners(50, ac.signal);
  ```
- `util.aborted(signal, resource)` (từ `node:util`): trả về `Promise<void>` resolve khi `signal` abort, nhưng chỉ giữ **weak reference** tới `resource` — nếu `resource` bị GC trước khi `signal` abort thì Promise đó cũng được thu hồi thay vì giữ leak listener trên signal sống lâu.

> Event `"abort"` không cancelable; không `preventDefault`. Không dùng `signal` làm EventEmitter Node (`on("abort")` trên AbortSignal là DOM EventTarget — `once` option khác `emitter.once`).

---

## 5. API nhận `signal` (fetch / HTTP / fs / undici)

| API | Ví dụ |
|-----|--------|
| `fetch` / Undici | `fetch(url, { signal })` — hủy lúc gửi **và** lúc đọc body |
| `undici.request` / `Agent` | `{ signal }` per request; **không** `destroy()` Agent khi một request abort |
| `fs/promises` | `readFile` / `writeFile` có `{ signal }`; không suy ra `copyFile`/`cp` hay mọi method đều nhận |
| `stream/promises` | `pipeline(src, …, dest, { signal })` |
| `timers/promises` | `setTimeout(ms, undefined, { signal })` |
| `child_process` | `spawn(cmd, args, { signal })`, `fork(mod, args, { signal })`, `promisify(execFile)(file, args, { signal })` — [threading.md](threading.md#44-promise-api) |

### 5.1 `fetch` abort ≠ “HTTP cancel” phía server

Client `abort()`:

- Undici **dừng** request: có thể chưa gửi, đang gửi, hoặc đã có headers — hủy phần còn lại.
- HTTP/1.1: thường destroy socket / không reuse connection bẩn.
- HTTP/2: `RST_STREAM` cho stream đó — connection (session) có thể **còn**.
- **Server đã xử lý** thì không rollback magically: handler phải xem disconnect (§6).
- Abort `fetch` sau khi có `Response`: **consume hoặc cancel body** (`res.body.cancel()` / đừng bỏ Readable). Body dở + signal → stream `error` dễ uncaught.

```ts
const ac = new AbortController();
const res = await fetch(url, { signal: ac.signal });
if (!res.ok) {
  await res.body?.cancel(); // giải phóng kết nối khi không đọc body
  throw new Error(`HTTP ${res.status}`);
}
// res.json() khóa (lock) và consume stream; không cần (và không được) cancel sau khi đã gọi json()
return await res.json();
```

Timeout **chỉ** `Promise.race` không abort → TCP/HTTP vẫn sống. Timeout thật: `AbortSignal.timeout` hoặc `any`. Lưu ý HTTP/2 multiplex dùng `RST_STREAM` cho từng stream trong khi session vẫn giữ, nên số active sockets không giảm 1-1 theo số lần abort; với HTTP/1.1 abort giữa body, kết nối thường không được reuse.

### 5.2 Undici `Dispatcher` / `Agent`

`fetch` global dùng Undici. API thấp hơn:

```ts
import { Agent, request } from "undici";

// Khởi tạo Agent ở module/app scope để dùng lại connection pool; đóng lúc shutdown bằng agent.close()
const agent = new Agent({ connections: 16 });

async function fetchJson(url: string, signal: AbortSignal) {
  const { statusCode, body } = await request(url, {
    dispatcher: agent,
    signal,
    method: "GET",
  });
  if (statusCode < 200 || statusCode >= 300) {
    await body.dump(); // đọc bỏ hết body để giữ HTTP/1.1 keep-alive (thay vì body.destroy())
    throw new Error(`HTTP ${statusCode}`);
  }
  return await body.json(); // đã consume xong stream — không gọi body.destroy() sau đó
}
```

| | Việc |
|--|------|
| `{ signal }` trên `request` | Abort **một** request |
| `agent.close()` | Graceful: hết request đang chạy, không nhận mới |
| `agent.destroy(err)` | Abort **mọi** pending/running trên dispatcher |

> **Pitfall:** abort request ≠ `dispatcher.destroy()`. Destroy Agent khi một client ngắt = cắt nhầm mọi request origin đó. Body Undici là stream: abort lúc đang đọc → `body` emit `error` (`RequestAbortedError`) — phải `catch` / `destroy`, không chỉ `await request()`.

### 5.3 `fs/promises` + `signal`

```ts
import { readFile, writeFile } from "node:fs/promises";

await readFile(path, { encoding: "utf8", signal });
await writeFile(path, data, { signal });
```

Hủy **hợp tác** ở ranh giới JS/libuv: syscall đang chạy trên threadpool có thể **xong** rồi mới thấy abort (reject, có thể file đã ghi một phần). Không phải kill(9) OS thread. Vẫn luôn truyền `signal` để **không bắt đầu** việc tiếp / đóng handle sớm.

`FileHandle.readFile` / `writeFile` hỗ trợ signal qua options; `read`/`write` và các method khác có hợp đồng riêng. Hủy buffering không undo syscall hay bytes đã ghi. Pipeline fs stream + `{ signal }` → [async.md](async.md) §14. [FS cancellation](https://nodejs.org/api/fs.html#fspromiseswritefilefile-data-options).

### 5.4 API chưa hỗ trợ signal

Race Promise với abort listener chỉ **reject sớm** — Promise gốc **vẫn chạy**. Cancel thật: `destroy` / `close` trong listener, hoặc đừng bọc giả.

### 5.5 HTTP server — client ngắt

Node core `http.IncomingMessage` **không** có `req.signal` sẵn. Tự bọc:

```ts
import http from "node:http";

http.createServer((req, res) => {
  const ac = new AbortController();
  req.once("close", () => {
    if (!req.complete) ac.abort(new Error("request interrupted"));
  });
  res.once("close", () => {
    if (!res.writableFinished) ac.abort(new Error("response interrupted"));
  });
  void handle(req, res, ac.signal).catch((err) => {
    if (ac.signal.aborted) {
      // Client đã ngắt: ghi metric cancellation, không gửi HTTP status.
      if (!res.destroyed) res.destroy();
      return;
    }
    console.error(err);
    if (!res.destroyed) {
      if (!res.headersSent) {
        res.writeHead(500);
        res.end();
      } else {
        // Headers đã gửi: destroy socket để client nhận lỗi mạng thay vì body bị cắt cụt (silent truncation).
        res.destroy(err instanceof Error ? err : undefined);
      }
    }
  });
});
```

Framework có sẵn `req.signal` (Hono, Undici, …): dùng `req.signal` làm parent và compose bằng `AbortSignal.any([req.signal, ...])`, đừng tạo controller rời mà quên nối với `req.signal`.

Lưu ý về timeout tầng server: `req.socket.on("timeout")` (từ option `timeout`) và `http.Server` `requestTimeout` / `headersTimeout` chỉ ngắt socket/request ở tầng HTTP — vẫn cần nối vào `ac.abort(...)` (thường qua `res`/`req` `'close'`) để dừng JS và fan-out phía sau.

### 5.6 `IncomingMessage`: `aborted` / `close` / `destroy`

Trên `http.IncomingMessage` (Node):

| Sự kiện / field | Ý |
|-----------------|-----|
| `'aborted'` | Client abort request (legacy; vẫn gặp) |
| `'close'` trên `req` | Request message hoàn tất/đóng; `!req.complete` mới là request bị cắt. Theo dõi response bằng `res.close` + `!res.writableFinished` |
| `req.aborted` | Boolean — **chính thức deprecated** từ Node 16.12 / 17.0; dùng `'close'` + `!req.complete` / `!res.writableFinished` |
| `req.destroy(err)` | Hủy socket phía server |

Abort **sau** `res.writeHead(200)`: không “đổi” thành 499 — headers đã đi. Chỉ dừng work còn lại (DB, fan-out); nếu handler lỗi giữa chừng sau khi đã gửi headers, gọi `res.destroy(err)` thay vì `res.end()` để tránh client hiểu nhầm response hợp lệ bị cắt cụt. Metric: `canceled_after_headers`. Nếu nghiệp vụ buộc phải hoàn tất dù client ngắt, dùng handler idempotent + tách job nền (detach + timeout riêng, §3.4).

Body request chưa đọc hết khi client ngắt: `req` emit error/close; `pipeline(req, …)` với signal liên kết `close` tránh treo parser.

### 5.7 Stream + abort

```ts
import { pipeline } from "node:stream/promises";

await pipeline(req, transform, dest, { signal });
```

Abort → destroy các stage, Promise reject. Đừng `race(pipeline, sleep)` rồi bỏ stream. Chi tiết destroy → [async.md](async.md) §14.

### 5.8 Request hoàn tất khác response bị ngắt

Từ Node 16, `IncomingMessage.close` phản ánh request message, không còn đồng nghĩa socket đã đóng. Request GET đã đọc xong có thể emit `close` trong khi server vẫn tính và chưa gửi response. Vì vậy không abort mọi `req.close`; mẫu §5.5 kiểm request bị cắt và response đóng trước `writableFinished`. [HTTP lifecycle](https://nodejs.org/api/http.html#event-close).

---

## 6. HTTP 499 vs 500

| Tình huống | Status gợi ý | Log |
|------------|--------------|-----|
| Client ngắt: `!req.complete` khi request close hoặc `!res.writableFinished` khi response close | **499** trong access log/metric; connection đã chết thì không gửi status | info/debug, tách khỏi 5xx |
| Timeout **server** (budget hết, upstream chậm) | **504** / **408** tùy tầng | warning + timeout metric |
| Bug, invariant, lỗi chưa phân loại | **500** | error + stack |
| Validation / not found | 4xx nghiệp vụ | không gắn abort |

> **Pitfall:** Phân biệt reason của client disconnect, deadline và shutdown; không gom mọi `signal.aborted` thành 499. Abort xảy ra sau một bug không chứng minh bug do abort: đối chiếu lỗi/reason từ API đang await trước khi bỏ error log.

499 không bắt buộc — quan trọng là **không đếm 5xx**. Health check / SLO: tách `canceled` khỏi `failed`.

---

## 7. AsyncLocalStorage

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

```ts
als.run({ reqId: crypto.randomUUID() }, () => {
  void handleRequest(); // await bên trong vẫn thấy store
});
```

Snapshot tại `await` (continuation restore store của `run`) — [async.md](async.md) §16.

Từ **Node 24/26**, **`AsyncContextFrame`** (dựa trên V8 continuation preserved embedder data) là backend mặc định của `AsyncLocalStorage`, thay thế `async_hooks` legacy và giảm mạnh chi phí propagation trên đường nóng. Cờ `--no-async-context-frame` chỉ là fallback khi cần tương thích với thư viện cũ còn dựa vào hành vi `async_hooks`.

### 7.1 `run` vs `enterWith`

| | `run(store, fn)` | `enterWith(store)` |
|--|------------------|---------------------|
| Phạm vi | `fn` + async tree do `fn` tạo | Phần **sync còn lại** của turn hiện tại + async sau |
| Tự restore | Có khi `fn` return | **Không** — leak đến handler / request kế trên cùng resource |
| Request HTTP | **Ưu tiên** | Tránh |

`enterWith` (experimental hơn `run` về mặt “dùng hàng ngày”): gọi trong middleware rồi `next()` ngoài phạm vi → request sau có thể thấy store cũ. Một số test harness dùng `enterWith` cho tiện — production request path: `run`.

```ts
// ❌ leak: enterWith trong 'connection' rồi mọi request share
als.enterWith({ reqId: "global" });

// ✅
als.run({ reqId: crypto.randomUUID() }, () => handle(req, res));
```

### 7.2 Nested `run`

Inner shadow outer; sau inner, outer trở lại. Job nền không nên giữ HTTP store + **không** nên giữ AbortSignal request nếu phải sống sót (detach + timeout riêng).

`AsyncLocalStorage.snapshot()` / `bind(fn)`: chụp context cho callback lệch cây (queue, EventEmitter). Ổn định trên Node 22.15+ / baseline 26.

### 7.3 Được lưu / không lưu

**Được (hẹp):** request ID, trace, user identity readonly, logger child.

| Tránh | Vì sao |
|-------|--------|
| DB pool / client mutable | lifetime ≠ request |
| Tham số bắt buộc | không hiện signature |
| **AbortController “giấu” / singleton trong ALS** | mọi request abort lẫn nhau; quên propagate `signal`; test không thấy hợp đồng |
| Config / feature flags | DI hoặc module |
| Object mutate lung tung | race handlers |

> Nếu thiếu value làm hàm sai → đó là **parameter**, không phải ALS. **Đặc biệt:** đừng `als.getStore()!.ac.abort()` như cancel toàn cục. Mỗi request một `AbortController` **địa phương**, truyền `signal` tường minh; ALS chỉ metadata.

Worker/process **không** kế thừa ALS. Tránh native callback mất context — test `getStore()`.

### 7.4 `exit`, `disable`, `defaultValue`

```ts
als.run({ reqId: "A" }, () => {
  als.exit(() => {
    als.getStore(); // undefined — log hệ thống không dính request
  });
  als.getStore()?.reqId; // "A" lại
});
```

`exit(fn)` chạy `fn` **ngoài** store hiện tại (fire-and-forget audit không nên giữ user PII từ ALS — hoặc `run` store khác). `disable()`: mọi `getStore()` → `undefined` đến `run`/`enterWith` kế; trên backend `AsyncContextFrame` mặc định (Node 24/26) việc GC instance ALS không còn gánh chi phí hook toàn cục như `async_hooks` legacy (chủ yếu chỉ cần lưu ý nếu chạy `--no-async-context-frame`).

Node 24+: `new AsyncLocalStorage({ name: "req", defaultValue })` — `getStore()` ngoài `run` trả `defaultValue` thay `undefined`. **Đừng** `defaultValue` là `AbortController` dùng chung.

```ts
const als = new AsyncLocalStorage<{ reqId: string }>({ name: "http-req" });
```

`name` giúp nhận diện instance khi debug / inspect `AsyncContextFrame` (và diagnostics). `snapshot()` khi bind queue job đã nêu [async.md](async.md) §16.

### 7.5 Custom pool: `AsyncResource` & emission context

EventEmitter gọi listener trong context của **lúc emit**, không tự nhớ ALS store của lúc đăng ký. Với custom worker/task queue:

- Tạo `AsyncResource` tại lúc nhận job, gọi callback qua `runInAsyncScope`, rồi `emitDestroy` ở success/fail/cancel. Mỗi job có resource riêng, đừng dùng một resource sống mãi cho cả pool.
- Khi custom class kế thừa `EventEmitter` cần tự gắn context của lúc khởi tạo cho mọi lần emit, dùng **`EventEmitterAsyncResource`** từ `node:events` (kết hợp `EventEmitter` + `AsyncResource`, tự động `runInAsyncScope` khi `emit`, gọi `emitDestroy()` khi xong vòng đời).
- `AsyncLocalStorage.snapshot()` / `bind()` phù hợp callback cần capture đơn giản; message sang worker thread vẫn phải gửi metadata (`reqId`, trace) tường minh. [AsyncResource for worker pools](https://nodejs.org/api/async_context.html#using-asyncresource-for-a-worker-thread-pool).

---

## 8. `using` + abort cleanup

Dispose chạy khi rời block kể cả abort reject — bổ sung listener, không thay thế.

Node.js cung cấp sẵn **`addAbortListener(signal, fn)`** từ `node:events` (ổn định trên Node 22/24/26): trả về object implement `Disposable` (`[Symbol.dispose]`), dùng trực tiếp với `using` mà không cần tự viết class `AbortListener`:

```ts
import { addAbortListener } from "node:events";

async function watch(signal: AbortSignal) {
  using _l = addAbortListener(signal, () => socket.destroy());
  await using conn = await openConn();
  await conn.readLoop(signal);
}
```

Lưu ý: nếu `signal` đã aborted sẵn, `addAbortListener` gọi `fn` qua `queueMicrotask` (không gọi sync như helper `onAbort` ở §4); nên kết hợp `signal.throwIfAborted()` đầu hàm nếu muốn chặn ngay trước khi mở resource.

Thứ tự LIFO: `conn` dispose trước `_l` nếu khai báo sau — khai báo hook **trước** resource nếu destroy phải xảy ra trong lúc handle còn mở, hoặc destroy trong `asyncDispose` của chính resource.

```ts
import { addAbortListener } from "node:events";

type RawHandle = { destroy(): void; close(): Promise<void> };

class Conn implements AsyncDisposable {
  #stop: Disposable;
  handle: RawHandle;

  constructor(handle: RawHandle, signal: AbortSignal) {
    // Khởi tạo handle TRƯỚC khi đăng ký abort listener để tránh crash TypeError khi signal đã aborted sẵn;
    // không dùng parameter property (private signal: ...) để tương thích erasableSyntaxOnly.
    this.handle = handle;
    this.#stop = addAbortListener(signal, () => this.handle.destroy());
  }

  async [Symbol.asyncDispose]() {
    this.#stop[Symbol.dispose]();
    await this.handle.close();
  }
}
```

`await using worker` → `terminate()` — khác abort hợp tác; xem [threading.md](threading.md). ERM grammar → [statements.md](statements.md).

---

## 9. Patterns thực tế

### 9.1 HTTP cancel + graceful timeout

```ts
async function loadUser(id: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const res = await fetch(`https://api.example/users/${id}`, { signal });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`HTTP ${res.status}`);
  }
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

await withBudget(reqSignal, 5_000, (s) => loadUser(id, s));
```

### 9.2 Cleanup on abort

```ts
async function watch(signal: AbortSignal) {
  const iv = setInterval(() => ping(), 1_000);
  const off = onAbort(signal, () => clearInterval(iv));
  try {
    await sleepForever(signal);
  } finally {
    clearInterval(iv);
    off();
  }
}
```

`finally` vẫn chạy khi abort reject — đóng fd / clear timer dù listener đã fire.

### 9.3 Fan-out leftover + shutdown

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

### 9.4 Vòng đời request (ghép hết)

```ts
import type { IncomingMessage, ServerResponse } from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import { addAbortListener } from "node:events";

const als = new AsyncLocalStorage<{ reqId: string }>();

async function onRequest(req: IncomingMessage, res: ServerResponse) {
  const ac = new AbortController();
  req.once("close", () => {
    if (!req.complete) ac.abort(new Error("request interrupted"));
  });
  res.once("close", () => {
    if (!res.writableFinished) ac.abort(new Error("response interrupted"));
  });
  const timeout = AbortSignal.timeout(15_000);
  const signal = AbortSignal.any([ac.signal, timeout]);
  const reqId = crypto.randomUUID();

  await als.run({ reqId }, async () => {
    using _hook = addAbortListener(signal, () => {
      /* hủy timer phụ */
    });
    try {
      const body = await readJson(req, signal);
      // Dùng allOrAbort để khi loadA fail thì hủy luôn loadB (tránh leftover chạy nền)
      const result = await allOrAbort(
        [(s) => loadA(body, s), (s) => loadB(body, s)],
        signal,
      );
      if (!res.headersSent && !res.destroyed) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(result));
      }
    } catch (e) {
      const fromAbort = isAbortError(e) || (signal.aborted && e === signal.reason);
      if (fromAbort && ac.signal.aborted) {
        if (!res.destroyed) res.destroy(); // metric cancellation có thể ghi 499
        return;
      }
      if (fromAbort && timeout.aborted) {
        if (!res.destroyed) {
          if (!res.headersSent) {
            res.writeHead(504);
            res.end();
          } else {
            res.destroy(e instanceof Error ? e : undefined);
          }
        }
        return;
      }
      console.error({ reqId, err: e });
      if (!res.destroyed) {
        if (!res.headersSent) {
          res.writeHead(500);
          res.end();
        } else {
          res.destroy(e instanceof Error ? e : undefined);
        }
      }
    }
  });
}
```

Fan-out bằng `allOrAbort`: khi timeout, client ngắt, hoặc một nhánh fail, nhánh còn lại nhận abort ngay — không còn leftover. Đối chiếu lỗi `e` với `isAbortError(e)` / `signal.reason` trước khi bỏ error log để bug thật trùng lúc abort không bị phân loại nhầm thành 499/504 (§6). ALS `reqId` sống qua `await`; **không** lấy `ac` từ ALS.

### 9.5 `fetch` timeline abort

| Thời điểm abort | Việc xảy ra |
|-----------------|-------------|
| Trước `fetch` (already-aborted) | Reject ngay, không DNS/TCP |
| Đang handshake / gửi headers | Undici hủy; có thể không có Response |
| Đã có Response, đang `res.json()` | Body destroy / cancel; `json()` reject |
| Sau `res.json()` xong | Muộn — abort không undo CPU parse đã chạy |

Parse JSON lớn **sau** khi body về vẫn block loop — abort không cắt `JSON.parse`. Worker nếu payload khổng lồ — [threading.md](threading.md).

---

## 10. AbortError detection

Abort thường throw `DOMException` `name === "AbortError"` hoặc `"TimeoutError"`. Undici có thể `RequestAbortedError`. `throwIfAborted()` throw **`reason`** (Error tùy bạn).

```ts
function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException) {
    return e.name === "AbortError" || e.name === "TimeoutError";
  }
  if (e instanceof Error) {
    if (
      e.name === "AbortError" ||
      e.name === "TimeoutError" ||
      e.name === "RequestAbortedError"
    ) {
      return true;
    }
    const code = (e as { code?: unknown }).code;
    if (code === "ABORT_ERR" || code === "UND_ERR_ABORTED") {
      return true;
    }
  }
  return false;
}

function isTimeoutError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "TimeoutError";
}
```

```ts
try {
  await work(signal);
} catch (e) {
  if (isAbortError(e) || (signal.aborted && e === signal.reason)) {
    // hủy / timeout có chủ đích — không nuốt bug thật (vd TypeError) trùng lúc abort
    return;
  }
  throw e;
}
```

Đừng `catch` mọi Error rồi nuốt, cũng đừng chỉ kiểm `signal.aborted` không đối chiếu `e === signal.reason` (vì bug thật xảy ra ngay sát lúc abort sẽ bị che mất). Đối chiếu `e === signal.reason` vẫn bắt được `reason` primitive. Xem [exceptions.md](exceptions.md).

---

## 11. Test patterns

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

test("already-aborted không gọi I/O", async () => {
  const signal = AbortSignal.abort(new Error("pre"));
  await assert.rejects(() => loadUser("1", signal), /pre/);
});

test("abort giữa chừng", async () => {
  const ac = new AbortController();
  const p = loadUser("1", ac.signal);
  ac.abort(new Error("stop"));
  await assert.rejects(() => p, (e: unknown) => {
    assert.ok(ac.signal.aborted);
    return isAbortError(e) || ac.signal.reason === e;
  });
});

test("timeout vs cancel", async () => {
  const user = new AbortController();
  const signal = AbortSignal.any([user.signal, AbortSignal.timeout(50)]);
  await assert.rejects(() => sleepForever(signal));
  assert.equal((signal.reason as DOMException).name, "TimeoutError");
});

test("truyền t.signal của node:test xuống I/O", { timeout: 2_000 }, async (t) => {
  // t.signal tự abort khi test hết timeout hoặc runner dừng — dọn resource tự động
  await assert.doesNotReject(() => doQuickIo(t.signal));
});
```

| Case | Cách |
|------|------|
| Already-aborted | `AbortSignal.abort(reason)` — tức thì, không qua timers (`timeout(0)` vẫn schedule timer) |
| Mid-flight | `abort()` sau khi Promise đã start; fake `fetch` treo + abort |
| Test timeout tích hợp | Dùng **`t.signal`** của `node:test` truyền thẳng xuống SUT / server / fetch |
| Timeout | `AbortSignal.timeout` **thật** (fake timer không luôn hook timer nội bộ) — dùng delay ngắn hoặc inject clock/`timeout` helper |
| Diamond / `any` | Abort parent; assert mọi derived `aborted` cùng `reason` |
| Listener leak | Parent process-level: `dispose` / `once` / `addAbortListener`; optional đếm `listenerCount` nếu EventEmitter |
| Client disconnect vs bug | Test `req.close` bình thường không abort; `res.close` chưa finish hủy work; không ghi 5xx giả |
| ALS | `als.run` trong test; assert không abort nhầm request khác |

> **Pitfall:** `sinon.useFakeTimers()` / `@sinonjs/fake-timers` **không đảm bảo** điều khiển `AbortSignal.timeout` (timer C++/libuv). Test timeout: delay ngắn thật, hoặc abstraction `timeoutFn(ms) => AbortSignal` để mock.

Helper `onAbort` đã-aborted: test `fn` gọi **sync** khi `AbortSignal.abort()`, không đợi event (lưu ý `addAbortListener` từ `node:events` gọi qua microtask khi signal đã aborted sẵn).

```ts
test("onAbort already-aborted sync", () => {
  const s = AbortSignal.abort("x");
  let n = 0;
  onAbort(s, () => {
    n++;
  });
  assert.equal(n, 1);
});

test("499 không log 500", async () => {
  const logs: string[] = [];
  const ac = new AbortController();
  ac.abort(new Error("client closed"));
  try {
    await service(ac.signal);
  } catch (e) {
    if (isAbortError(e) || (ac.signal.aborted && e === ac.signal.reason)) logs.push("canceled");
    else logs.push("500");
  }
  assert.deepEqual(logs, ["canceled"]);
});
```

Test `AbortSignal.any` diamond: abort `P`, assert `s1.aborted && s2.aborted && d.aborted` và `reason` cùng instance (hoặc cùng message). Test timeout **không** abort parent.

---

## 12. Pitfalls

1. **`Promise.race` + sleep ≠ cancel** — dùng `AbortSignal.timeout`.
2. **Quên truyền `signal`** — tầng trên abort, I/O dưới vẫn chạy.
3. **Already-aborted** — listener muộn không chạy; check `aborted` / `throwIfAborted()` trước.
4. **Listener không gỡ** — `{ once: true }` hoặc `removeEventListener` trong `finally` / `using`.
5. **`abort()` lần sau không đổi `reason`** — lần đầu thắng.
6. **Timeout bỏ parent** — mất client-disconnect; luôn `any([parent, timeout])`.
7. **Wrap Promise “fake cancel”** — chỉ reject sớm, việc gốc vẫn chạy.
8. **ALS thay signal / giấu AbortController singleton** — abort xuyên request.
9. **Nuốt AbortError** mọi tầng — map 499 ở biên, không 500.
10. **CPU loop không check abort** — `throwIfAborted()` định kỳ; CPU nặng → worker ([event-loop.md](event-loop.md)).
11. **`agent.destroy` vì một abort** — cắt nhầm pool.
12. **`reason` primitive** — `instanceof Error` fail; chuẩn hóa ở biên.
13. **Giữ strong reference / `addEventListener` thủ công không gỡ trên parent process-lifetime** — gây leak (`AbortSignal.any()` tự dùng weak reference nội bộ nên tự GC khi không bị giữ tham chiếu mạnh).
14. **`fetch` abort hoặc `!res.ok` quên cancel/dump body** — stream error / mất HTTP/1.1 keep-alive.

### 12.1 Compose helpers (copy-paste)

```ts
export function remainingTimeout(deadlineMs: number): AbortSignal {
  return AbortSignal.timeout(Math.max(0, deadlineMs - Date.now()));
}

export function link(parent: AbortSignal | undefined, deadlineMs?: number): AbortSignal {
  const parts: AbortSignal[] = [];
  if (parent) parts.push(parent);
  if (deadlineMs !== undefined) parts.push(remainingTimeout(deadlineMs));
  if (parts.length === 0) return new AbortController().signal; // không bao giờ abort — hiếm, cân nhắc cấm
  if (parts.length === 1) return parts[0]!;
  return AbortSignal.any(parts);
}

export function isCanceled(e: unknown, signal?: AbortSignal): boolean {
  return isAbortError(e) || Boolean(signal?.aborted && e === signal.reason);
}
```

Cấm gọi `link()` không parent không deadline trên production I/O — dễ quên timeout. Default: luôn có deadline request. Gộp nhiều timeout trong cùng hàm thành một deadline thay vì tạo nhiều `AbortSignal.timeout` tách rời (mỗi cái tạo một timer). Lưu ý `remainingTimeout(past)` gọi `AbortSignal.timeout(0)` vẫn đi qua hàng đợi timer, khác `AbortSignal.abort()` (aborted tức thì).

### 12.2 `addEventListener` options `signal`

```ts
const et = new EventTarget();
const lifetime = new AbortController();
et.addEventListener("ping", handler, { signal: lifetime.signal });
lifetime.abort(); // gỡ handler dù "ping" chưa fire
```

`AbortSignal` là `EventTarget`: option `{ signal }` của `addEventListener` tự động gỡ listener khi `options.signal` abort — rất gọn khi gắn nhiều listener lên một object sống lâu và muốn dọn tất cả bằng một lệnh `lifetime.abort()`. Khi gắn trên 10 listener vào cùng `lifetime.signal`, gọi `events.setMaxListeners(n, lifetime.signal)` để tránh cảnh báo `MaxListenersExceededWarning`.

---

## 13. Best practices

1. Hàm I/O nhận / propagate `signal`; compose `any([parent, timeout(ms)])` hoặc deadline còn lại.
2. `throwIfAborted()` đầu hàm; cleanup `onAbort` (already-aborted) **và** `finally` / `using`.
3. Phân biệt AbortError / TimeoutError / 499 vs 500; ALS chỉ request-scoped hẹp — **không** cất controller.
4. Fan-out fail-fast: abort leftover; `run` không `enterWith` trên request path.
5. Undici: abort **request**; `close` Agent lúc shutdown, không `destroy` per abort.
6. Test: already-aborted, mid-flight, timeout (không dựa fake timers mù), 499.

---

## 14. Checklist

```text
□ I/O propagate signal; timeout/deadline compose với parent
□ throwIfAborted / already-aborted trước khi mở resource
□ Listener once hoặc remove / using (`addAbortListener`); không giữ strong ref thừa trên parent dài hạn
□ fetch/fs/pipeline/timers/undici.request/spawn/fork nhận signal thật
□ fetch/undici: cancel hoặc dump body khi không đọc; không destroy Agent
□ AbortError → 499/cancel metric, không 500; không nuốt bug trùng lúc abort
□ ALS run + snapshot; không giấu AbortController
□ Fan-out abort leftover; SIGINT/SIGTERM → root abort
□ Test already-aborted + mid-flight + timeout + `t.signal`
```

---

## 15. Cheat sheet

| API / pattern | Việc |
|---------------|------|
| `AbortController` / `abort(reason)` | tạo & hủy; reason lần đầu |
| `throwIfAborted` / `aborted` / `reason` | trạng thái (`reason` là `any`) |
| `AbortSignal.timeout` / `.any` / `.abort` | timeout / gộp (weak ref) / stub |
| `addAbortListener` / `onAbort` | cleanup an toàn (`using` / sync check) |
| `events.setMaxListeners(n, signal)` / `util.aborted` | fan-out >10 listeners / weak-ref Promise |
| `{ signal }` fetch / fs / pipeline / `request` / `spawn` | hủy thật |
| `agent.close` vs `destroy` vs request `signal` | shutdown vs một request |
| `AsyncLocalStorage.run` / `snapshot` / `EventEmitterAsyncResource` | request values (`AsyncContextFrame`) |
| 499 vs 500 / `res.destroy(err)` sau `headersSent` | client cancel vs bug (tránh silent truncation) |
| `isAbortError` / `isTimeoutError` | phân nhánh |

```ts
async function handle(reqSignal: AbortSignal) {
  const signal = AbortSignal.any([reqSignal, AbortSignal.timeout(10_000)]);
  return als.run({ reqId: crypto.randomUUID() }, async () => {
    try {
      return await service(signal);
    } catch (e) {
      if (isAbortError(e) || (signal.aborted && e === signal.reason)) return;
      throw e;
    }
  });
}
```

---

## 16. Version notes

| Mốc | Ghi chú |
|-----|---------|
| AbortController trên Node | ổn định từ ~16+ |
| `req.aborted` | chính thức **deprecated** từ Node 16.12 / 17.0 |
| `AbortSignal.timeout` | 17.3+ / 16.14+ |
| `AbortSignal.any` | 20.3+ (weak references theo spec WHATWG); ổn định trên **26** |
| `addAbortListener` / `EventEmitterAsyncResource` | `node:events`, ổn định trên Node 22/24/26 |
| `util.aborted(signal, resource)` | `node:util`, weak-ref Promise chờ abort |
| `AsyncContextFrame` (`AsyncLocalStorage`) | backend **mặc định** từ Node 24/26 (thay `async_hooks` legacy; `--no-async-context-frame` là fallback) |
| `AsyncLocalStorage.snapshot` / `bind` | ổn định 22.15+ / 23.11+ |
| `enterWith` | dễ leak — không dùng cho request boundary |
| ERM `using` | Ngữ pháp native Node 24/26; `addAbortListener` trả `Disposable` dùng trực tiếp với `using` |

---

## 17. Tài liệu liên quan

- [async.md](async.md) — Promise, combinators leftover, ALS snapshot tại await, `await using`
- [event-loop.md](event-loop.md) — abort không cứu CPU sync
- [main-function.md](main-function.md) — entry, process signal, shutdown
- [exceptions.md](exceptions.md) — AbortError vs lỗi thật
- [nodejs-apis.md](nodejs-apis.md) — fetch, fs, stream, http
- [threading.md](threading.md) — terminate vs abort worker
- [statements.md](statements.md) — `using` / `finally`

- [HTTP lifecycle và cancellation tests](testing.md)
- [Context/log/tracing](diagnostics.md)
