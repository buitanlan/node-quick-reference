# Exception / Error trong JavaScript, TypeScript & Node.js

Xử lý lỗi đúng cách: **không nuốt lỗi**, phân biệt lỗi vận hành vs bug, luôn `throw` `Error` (có `cause`), biết catalog `SystemError` / `ERR_*`, và xử lý an toàn `unhandledRejection` / `uncaughtException` trên Node.

Baseline: **Node.js 26**, **TypeScript 7**, ESM. Abort: [abort-context.md](abort-context.md). `using` / `SuppressedError`: [statements.md](statements.md). Worker: [threading.md](threading.md).

---

## Mục lục

- [1. Tổng quan & triết lý](#1-tổng-quan--triết-lý)
  - [1.1 Operational vs programmer errors](#11-operational-vs-programmer-errors)
  - [1.2 Luôn throw `Error` (hoặc subclass)](#12-luôn-throw-error-hoặc-subclass)
  - [1.3 Hợp đồng theo tầng](#13-hợp-đồng-theo-tầng)
- [2. Hệ phân cấp Error & SystemError](#2-hệ-phân-cấp-error--systemerror)
  - [2.1 Thuộc tính quan trọng](#21-thuộc-tính-quan-trọng)
  - [2.2 Node `SystemError` & errno thường gặp](#22-node-systemerror--errno-thường-gặp)
    - [Catalog errno hay gặp](#catalog-errno-hay-gặp)
  - [2.3 `instanceof` & cross-realm](#23-instanceof--cross-realm)
- [3. Stack: `captureStackTrace`, `stackTraceLimit`, `prepareStackTrace`](#3-stack-capturestacktrace-stacktracelimit-preparestacktrace)
  - [3.1 `Error.stackTraceLimit`](#31-errorstacktracelimit)
  - [3.2 `Error.captureStackTrace(target, constructorOpt?)`](#32-errorcapturestacktracetarget-constructoropt)
  - [3.3 `Error.prepareStackTrace` — cẩn thận](#33-errorpreparestacktrace--cẩn-thận)
  - [3.4 Async stack traces](#34-async-stack-traces)
- [4. Custom errors](#4-custom-errors)
  - [4.1 Class chuẩn với `name`, `code`, `ErrorOptions`](#41-class-chuẩn-với-name-code-erroroptions)
  - [4.2 Gợi ý thiết kế](#42-gợi-ý-thiết-kế)
  - [4.3 Prototype / `instanceof` notes](#43-prototype--instanceof-notes)
- [5. AggregateError & cây lỗi](#5-aggregateerror--cây-lỗi)
  - [5.1 `AggregateError`](#51-aggregateerror)
  - [5.2 `Error.cause` vs `AggregateError.errors`](#52-errorcause-vs-aggregateerrorerrors)
  - [5.3 Duyệt đệ quy — `errors` rồi `cause`](#53-duyệt-đệ-quy--errors-rồi-cause)
- [6. `try` / `catch` / `finally`](#6-try--catch--finally)
  - [6.1 Thu hẹp `unknown` trong `catch`](#61-thu-hẹp-unknown-trong-catch)
  - [6.2 `finally` & `return` / `throw`](#62-finally--return--throw)
  - [6.3 Phạm vi `try` hẹp](#63-phạm-vi-try-hẹp)
- [7. Rethrow & `cause`](#7-rethrow--cause)
  - [7.1 Rethrow nguyên gốc](#71-rethrow-nguyên-gốc)
  - [7.2 Wrap với `cause` (khuyến nghị khi thêm context)](#72-wrap-với-cause-khuyến-nghị-khi-thêm-context)
  - [7.3 `formatErr` — in chuỗi cause + aggregate](#73-formaterr--in-chuỗi-cause--aggregate)
  - [7.4 Đừng mất stack / identity](#74-đừng-mất-stack--identity)
- [8. Async: rejection, combinators, async stack](#8-async-rejection-combinators-async-stack)
  - [8.1 `async`/`await` và rejection](#81-asyncawait-và-rejection)
  - [8.2 Floating promises](#82-floating-promises)
  - [8.3 Combinators vs lỗi](#83-combinators-vs-lỗi)
  - [8.4 Anti-pattern: `new Promise(async …)`](#84-anti-pattern-new-promiseasync-)
  - [8.5 Async stack — thực hành](#85-async-stack--thực-hành)
- [9. `unhandledRejection` / `uncaughtException` / `rejectionHandled`](#9-unhandledrejection--uncaughtexception--rejectionhandled)
  - [9.1 `unhandledRejection`](#91-unhandledrejection)
  - [9.2 `uncaughtException`](#92-uncaughtexception)
  - [9.3 Fatal shutdown pattern (khuyến nghị service)](#93-fatal-shutdown-pattern-khuyến-nghị-service)
  - [9.4 `rejectionHandled`](#94-rejectionhandled)
  - [9.5 Worker không đi vào handler parent](#95-worker-không-đi-vào-handler-parent)
- [10. Result / union vs `throw`](#10-result--union-vs-throw)
  - [10.1 Khi nào `throw`](#101-khi-nào-throw)
  - [10.2 Khi nào Result / discriminated union](#102-khi-nào-result--discriminated-union)
  - [10.3 Nhất quán biên API](#103-nhất-quán-biên-api)
- [11. Never swallow, log một lần, OpenTelemetry attributes](#11-never-swallow-log-một-lần-opentelemetry-attributes)
  - [11.1 Nuốt lỗi](#111-nuốt-lỗi)
  - [11.2 Log một lần ở biên — structured keys](#112-log-một-lần-ở-biên--structured-keys)
  - [11.3 OpenTelemetry-style attributes](#113-opentelemetry-style-attributes)
- [12. Node error codes, `ERR_*`, `util.getSystemErrorMap`](#12-node-error-codes-err_-utilgetsystemerrormap)
  - [12.1 Hai họ mã](#121-hai-họ-mã)
  - [12.2 `util.getSystemErrorName` / `Map` / `Message`](#122-utilgetsystemerrorname--map--message)
  - [12.3 Catalog `ERR_*` mở rộng](#123-catalog-err_-mở-rộng)
  - [12.4 `ERR_INVALID_ARG_TYPE` / `ERR_MODULE_NOT_FOUND` / `ERR_REQUIRE_ESM` / `ERR_UNKNOWN_FILE_EXTENSION`](#124-err_invalid_arg_type--err_module_not_found--err_require_esm--err_unknown_file_extension)
  - [12.5 `assert.AssertionError`](#125-assertassertionerror)
  - [12.6 `process.exitCode` vs `process.exit`](#126-processexitcode-vs-processexit)
- [13. `fetch` / undici: TypeError vs AbortError vs HTTP status](#13-fetch--undici-typeerror-vs-aborterror-vs-http-status)
- [14. Map lỗi → HTTP status](#14-map-lỗi--http-status)
- [15. AbortError / `DOMException` aborted](#15-aborterror--domexception-aborted)
  - [15.1 Hủy ≠ lỗi vận hành thông thường](#151-hủy--lỗi-vận-hành-thông-thường)
  - [15.2 `signal` + timeout](#152-signal--timeout)
  - [15.3 Logging & fatal handlers](#153-logging--fatal-handlers)
- [16. `using` / Disposable & lỗi khi dispose](#16-using--disposable--lỗi-khi-dispose)
  - [16.1 Lỗi body + lỗi dispose → `SuppressedError`](#161-lỗi-body--lỗi-dispose--suppressederror)
  - [16.2 Khi nào KHÔNG dựa `using` nuốt lỗi](#162-khi-nào-không-dựa-using-nuốt-lỗi)
- [17. Worker error vs process chính](#17-worker-error-vs-process-chính)
  - [17.1 Serialize lỗi qua clone / IPC](#171-serialize-lỗi-qua-clone--ipc)
  - [17.2 Diagnostic: `process.report`](#172-diagnostic-processreport)
- [18. `domain` đã chết](#18-domain-đã-chết)
  - [18.1 `setUncaughtExceptionCaptureCallback`](#181-setuncaughtexceptioncapturecallback)
- [19. Testing errors](#19-testing-errors)
  - [19.1 Nguyên tắc: đừng assert message string](#191-nguyên-tắc-đừng-assert-message-string)
  - [19.2 Đồng bộ: `assert.throws`](#192-đồng-bộ-assertthrows)
  - [19.3 Async: `assert.rejects` khớp `code`](#193-async-assertrejects-khớp-code)
  - [19.4 `AggregateError` & table-driven](#194-aggregateerror--table-driven)
- [20. Khi nào KHÔNG dùng `throw`](#20-khi-nào-không-dùng-throw)
- [21. Best practices](#21-best-practices)
- [22. Checklist](#22-checklist)
- [23. Cheat sheet](#23-cheat-sheet)
- [24. Version matrix](#24-version-matrix)
- [25. Tài liệu liên quan](#25-tài-liệu-liên-quan)

---

## 1. Tổng quan & triết lý

### 1.1 Operational vs programmer errors

| Loại | Ví dụ | Phản ứng điển hình |
|------|--------|-------------------|
| **Operational** (vận hành) | file thiếu, cổng bận, DB timeout, HTTP 5xx peer | bắt, log, retry / map HTTP status / báo user |
| **Programmer** (bug) | `undefined` deref, invariant vỡ, sai kiểu nội bộ | fail-fast; đừng “che” rồi chạy tiếp |

- `throw` dùng cho **tình huống bất thường** / không thể tiếp tục thao tác hiện tại theo hợp đồng API.
- Lỗi **mong đợi** ở I/O biên (file thiếu, validation user, “not found”): Result / union / `null` **hoặc** throw có chủ đích — nhưng **nhất quán theo tầng**.
- Phân biệt giúp tránh hai cực: throw mọi thứ rồi `catch` rỗng; hoặc trả `null` cho cả bug khiến caller không bao giờ biết hệ thống đã hỏng.

Abort / hủy hợp tác **không** phải operational failure thông thường — §15, [abort-context.md](abort-context.md).

### 1.2 Luôn throw `Error` (hoặc subclass)

Mọi giá trị đều `throw` được; **luôn throw `Error`** để có `name`, `message`, `stack`, và (ES2022+) `cause`.

```ts
throw new Error("boom");
throw new TypeError("expected string");
// Tránh: throw "boom"; throw 404; throw { code: 1 };
```

> **Pitfall:** `throw 404` / `throw "fail"` → `catch` nhận primitive, mất stack; `instanceof Error` thất bại; logger structured khó chuẩn hóa.

Trong TypeScript hiện đại, `catch (e)` mặc định là `unknown` — phải thu hẹp trước khi đọc field. Xem [typesystem.md](typesystem.md) (`useUnknownInCatchVariables`).

### 1.3 Hợp đồng theo tầng

| Tầng | Throw? | Ghi chú |
|------|--------|---------|
| Pure domain | invariant / bug | Result cho nhánh nghiệp vụ |
| Infra (fs, net, db driver) | thường reject/throw | `code` errno / `ERR_*` |
| Application service | wrap `cause` | thêm op / id |
| HTTP / CLI / queue biên | bắt hết | log 1 lần, map status / exit code |
| Library công khai | document | một style, không trộn |

---

## 2. Hệ phân cấp Error & SystemError

```
Error
├─ TypeError          // sai kiểu / thao tác không hợp lệ trên giá trị
├─ RangeError         // số ngoài khoảng
├─ SyntaxError        // parse (JSON.parse, eval, …)
├─ ReferenceError     // biến không tồn tại
├─ URIError           // encodeURI / decodeURI
├─ EvalError          // di sản, hiếm dùng
├─ AggregateError     // nhóm nhiều lỗi (Promise.any, batch, …)
│     └─ (có thể lồng) SuppressedError  // ERM: lỗi gốc + lỗi dispose
├─ DOMException       // web platform (AbortError, …) — Node cũng có
└─ (Node) SystemError // err.code: ENOENT, EADDRINUSE, … + errno
```

Ngoài ra Node có lỗi nội bộ với `code` dạng `ERR_*` (thường kèm `TypeError` / `Error` / `RangeError`), `assert.AssertionError`, và lỗi worker/clone.

### 2.1 Thuộc tính quan trọng

```ts
const err = new Error("fail", { cause: new Error("root") });
err.name;       // "Error"
err.message;    // "fail"
err.stack;      // stack string (engine-dependent)
err.cause;      // lỗi gốc (ES2022+)
```

| Thuộc tính | Ý nghĩa |
|------------|---------|
| `name` | loại lỗi cho người / filter log (`"TypeError"`, `"AppError"`) |
| `message` | mô tả; **đừng** dùng làm khóa máy đọc ổn định |
| `stack` | chuỗi stack; có thể bị minify / giới hạn `Error.stackTraceLimit` |
| `cause` | nguyên nhân gốc; chuỗi wrap **một** nhánh |
| `code` | (Node / custom) mã ổn định: `ENOENT`, `ERR_INVALID_ARG_TYPE`, `NOT_FOUND` |
| `errors` | chỉ `AggregateError` — mảng sibling |

> **Quy ước Node:** `error.message` có thể đổi giữa các phiên bản. **Nhận diện bằng `error.code`** (hoặc `name` với `DOMException`), không parse `message`.

### 2.2 Node `SystemError` & errno thường gặp

Khi app vi phạm ràng buộc OS (mở file không tồn tại, bind cổng đã dùng, …), Node tạo **SystemError**:

| Field | Ý nghĩa |
|-------|---------|
| `code` | chuỗi errno-style: `ENOENT`, `EACCES`, … |
| `errno` | số âm (libuv); Windows được normalize |
| `syscall` | tên syscall (`open`, `listen`, `connect`, …) |
| `path` / `dest` | đường dẫn (fs) |
| `address` / `port` | mạng khi có |
| `info` | một số lỗi (ít gặp) object phụ |

Kiểu TS thường gặp: `NodeJS.ErrnoException`.

```ts
import fs from "node:fs/promises";

try {
  await fs.readFile("missing.txt");
} catch (e) {
  if (e instanceof Error && "code" in e && e.code === "ENOENT") {
    console.error("file not found");
  } else {
    throw e;
  }
}
```

#### Catalog errno hay gặp

| `code` | Tình huống điển hình | Retry? |
|--------|----------------------|--------|
| `ENOENT` | path / file không tồn tại | không (trừ race create) |
| `EACCES` / `EPERM` | không đủ quyền | không |
| `EEXIST` | tạo khi đã tồn tại (`O_EXCL`) | không — conflict |
| `EISDIR` / `ENOTDIR` | kỳ vọng file vs thư mục sai | không |
| `EMFILE` / `ENFILE` | hết fd / file table | backoff; tăng ulimit |
| `EADDRINUSE` | `listen` cổng / address đã bị chiếm | không (đổi cổng / chờ) |
| `EADDRNOTAVAIL` | address không gán được trên máy | không |
| `ECONNREFUSED` | peer từ chối (service chưa lên) | có, bounded |
| `ECONNRESET` | peer đóng / reset giữa chừng | có, idempotent only |
| `ECONNABORTED` | kết nối bị abort phía local | tùy |
| `EPIPE` | ghi vào pipe/socket đã đóng | không |
| `ETIMEDOUT` | connect/send hết hạn chờ | có |
| `ENOTFOUND` | DNS lookup thất bại (`getaddrinfo`) | hiếm |
| `EAI_AGAIN` | DNS tạm thời lỗi | có |
| `EHOSTUNREACH` / `ENETUNREACH` | routing | có, bounded |
| `EAGAIN` / `EWOULDBLOCK` | resource tạm bận | có |

```ts
function isRetryableNet(e: unknown): boolean {
  if (!(e instanceof Error) || !("code" in e)) return false;
  const code = String((e as { code: unknown }).code);
  return ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ECONNREFUSED"].includes(code);
}
```

### 2.3 `instanceof` & cross-realm

```ts
function isError(e: unknown): e is Error {
  return e instanceof Error;
}
```

Lỗi từ **vm / worker / iframe** khác realm có thể làm `instanceof Error` thất bại:

```ts
import { types } from "node:util";

function isErrorLike(e: unknown): e is { message: string; name?: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  );
}

function hasErrnoCode(e: unknown, code: string): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: unknown }).code === code
  );
}

types.isNativeError(new Error("x")); // native Error, kể cả một số cross-realm
```

`util.types.isNativeError` nhận diện Error **của engine**, không nhận custom `class AppError extends Error` nếu… thực ra subclass JS hiện đại vẫn là native Error object. Cross-realm `Error` từ `vm` khác: `instanceof` fail, `isNativeError` thường vẫn true.

Chi tiết `instanceof` / `Symbol.hasInstance`: [oop.md](oop.md).

---

## 3. Stack: `captureStackTrace`, `stackTraceLimit`, `prepareStackTrace`

V8/Node cung cấp API **không** có trên mọi engine (Bun/khác có thể khác). Trên Node 26 đầy đủ.

### 3.1 `Error.stackTraceLimit`

```ts
Error.stackTraceLimit; // mặc định thường 10
Error.stackTraceLimit = 50; // sâu hơn — tốn CPU/chuỗi khi throw nhiều
```

- `0` → gần như không stack.
- `Infinity` → stack rất sâu; **không** bật mặc định production hot path.
- Chỉ ảnh hưởng frame **sau** khi gán, khi Error **được tạo**.

### 3.2 `Error.captureStackTrace(target, constructorOpt?)`

Gắn `.stack` lên object bất kỳ (pattern custom error / V8):

```ts
class AppError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AppError";
    Error.captureStackTrace(this, AppError); // ẩn frame constructor AppError
  }
}
```

| Đối số | Việc |
|--------|------|
| `target` | object nhận `stack` (thường `this`) |
| `constructorOpt` | hàm/class **bỏ** khỏi stack (constructor + trên nó tới call site) |

```ts
function makeErr(msg: string): Error {
  const e = new Error(msg);
  Error.captureStackTrace(e, makeErr); // caller thấy frame gọi makeErr, không thấy makeErr
  return e;
}
```

- Class `extends Error` hiện đại trên Node thường **đã** có stack từ `super()` — `captureStackTrace` chủ yếu để **cắt constructor** khỏi stack.
- Không có trên mọi runtime; guard: `typeof Error.captureStackTrace === "function"`.
- `target` không cần là `Error` — có thể gắn stack lên POJO (hiếm, logger).

### 3.3 `Error.prepareStackTrace` — cẩn thận

V8 gọi (nếu gán) khi **đọc** `.stack` lần đầu:

```ts
type CallSite = {
  getThis(): unknown;
  getTypeName(): string | null;
  getFunctionName(): string | null;
  getMethodName(): string | null;
  getFileName(): string | null;
  getLineNumber(): number | null;
  getColumnNumber(): number | null;
  isNative(): boolean;
  isToplevel(): boolean;
  isEval(): boolean;
  isConstructor(): boolean;
  getFunction?: () => unknown;
};

Error.prepareStackTrace = (err, structuredStackTrace: CallSite[]) => {
  return structuredStackTrace.map((cs) => cs.getFileName()).join("\n");
};
```

| Nguy | Lý do |
|------|--------|
| Global monkey-patch | đè APM / Node inspector / test runner |
| `getThis()` / `getFunction()` | giữ reference, **leak** object / closure |
| Format khác chuẩn | log parser / Sentry / OTel lệch |
| Chạy lúc throw hot path | chậm |
| Nuốt structured frames | mất source map |

```ts
function withStack<T>(fn: () => T): T {
  const prev = Error.prepareStackTrace;
  try {
    Error.prepareStackTrace = (err, callsites) => {
      (err as { callsites?: CallSite[] }).callsites = callsites;
      return prev ? prev(err, callsites) : String(err);
    };
    return fn();
  } finally {
    Error.prepareStackTrace = prev; // luôn restore
  }
}
```

> **Quy tắc:** production app **đừng** gán `Error.prepareStackTrace` global. Để SDK tracing làm. Nếu debug, restore ngay. Không log `getThis()`.

### 3.4 Async stack traces

V8 **ghép** frame qua `await` / microtask (async stack traces, mặc định bật trên Node hiện đại):

```ts
async function inner() {
  throw new Error("leaf");
}
async function outer() {
  await inner();
}
await outer();
// stack thường hiện cả outer và inner, không chỉ leaf tick
```

- `await` giữ liên kết; `.then()` chain dài có thể **mỏng** hơn.
- `--async-stack-traces` (mặc định on) / `--no-async-stack-traces` khi đo perf cực đoan.
- `queueMicrotask` / raw Promise constructor có thể **cắt** ngữ cảnh async stack.
- Worker stack **không** ghép vào parent — parent nhận serialize message / `error` event (§17).

```ts
// Mỏng stack hơn await
function inner() {
  return Promise.reject(new Error("leaf"));
}
```

> Throw trong `setImmediate` / `setTimeout` không gắn stack caller trừ khi bạn wrap Error lúc schedule. Capture `new Error("context")` làm `cause` nếu cần.

---

## 4. Custom errors

### 4.1 Class chuẩn với `name`, `code`, `ErrorOptions`

```ts
class AppError extends Error {
  readonly code: string;

  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
    // Prototype fix: cần khi transpile ES5 / target cũ.
    // Node 26 + TS modern (ES2022+) thường không bắt buộc, nhưng vô hại.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, options?: ErrorOptions) {
    super(`${resource} not found`, "NOT_FOUND", options);
    this.name = "NotFoundError";
  }
}

throw new NotFoundError("User", { cause: new Error("db miss") });
```

`ErrorOptions` (ES2022): `{ cause?: unknown }`.

Field enumerable: `code` trên instance thường enumerable (class field). `name` / `message` trên Error thường **non-enumerable** — `JSON.stringify(err)` có thể `{}`. Logger phải đọc property tường minh, không `JSON.stringify(error)`.

### 4.2 Gợi ý thiết kế

- Đặt `name` rõ — filter log / APM theo tên class.
- Thêm `code` **ổn định** cho máy đọc (API JSON, CLI). Đổi `message` được; đổi `code` là breaking.
- Không nhồi PII / secret vào `message` hoặc `cause` nếu log ra ngoài.
- Dùng `cause` thay vì invent `innerException` trừ khi tương thích cũ.
- Export ít loại: opaque mặc định; typed chỉ khi caller **thật sự** rẽ nhánh.
- HTTP mapping: gắn `code` domain (`NOT_FOUND`), **không** gắn `statusCode` vào mọi Error trừ biên HTTP (tránh leak tầng).

### 4.3 Prototype / `instanceof` notes

| Target / môi trường | Ghi chú |
|---------------------|---------|
| ES2015+ class native | `extends Error` + `instanceof` ổn trên Node hiện đại |
| Downlevel ES5 | cần `Object.setPrototypeOf(this, new.target.prototype)` |
| Cross-realm | `instanceof AppError` có thể fail — check `name` / `code` |

```ts
function isAppError(e: unknown): e is AppError {
  return (
    e instanceof AppError ||
    (isErrorLike(e) && (e as { name?: string }).name === "AppError")
  );
}
```

**Khi nào KHÔNG tạo hierarchy 8 tầng Error:** filter bằng `code` union (`"NOT_FOUND" | "CONFLICT"`) đủ cho hầu hết service.

---

## 5. AggregateError & cây lỗi

### 5.1 `AggregateError`

```ts
const ag = new AggregateError(
  [new Error("a"), new Error("b")],
  "multiple failures",
);
console.log(ag.name);          // "AggregateError"
console.log(ag.errors.length); // 2
```

Xuất hiện khi: `Promise.any` (tất cả reject); tự gom validation / batch / shutdown nhiều resource; `SuppressedError` là **subclass** liên quan ERM — không phải mọi dual-error đều `AggregateError`.

```ts
const results = await Promise.allSettled(tasks);
const errors = results
  .filter((r): r is PromiseRejectedResult => r.status === "rejected")
  .map((r) => r.reason);

if (errors.length) {
  throw new AggregateError(errors, `${errors.length} tasks failed`);
}
```

`AggregateError` **cũng** có `cause` (ErrorOptions) — khác `errors[]`. Đừng nhầm: `cause` = một gốc wrap; `errors` = nhiều sibling.

### 5.2 `Error.cause` vs `AggregateError.errors`

| | `error.cause` | `AggregateError.errors` |
|--|---------------|-------------------------|
| Số nhánh | 0..1 | 0..n |
| Ý nghĩa | wrap / rethrow có ngữ cảnh | nhiều thất bại song song |
| `Promise.any` | không (trừ bạn gán) | toàn bộ rejection |
| Shutdown nhiều socket | có thể wrap | thường `errors[]` |
| Duyệt | chuỗi linked list | mảng + đệ quy từng phần tử |

Cây hỗn hợp: `AppError { cause: AggregateError { errors: [ ENOENT, TypeError { cause: … } ] } }`.

### 5.3 Duyệt đệ quy — `errors` rồi `cause`

```ts
function* walkErrors(e: unknown, seen = new Set<unknown>()): Generator<unknown> {
  if (e == null || seen.has(e)) return;
  seen.add(e);
  yield e;

  if (typeof e === "object" && e !== null && "errors" in e) {
    const list = (e as { errors: unknown }).errors;
    if (Array.isArray(list)) {
      for (const child of list) yield* walkErrors(child, seen);
    }
  }
  if (e instanceof Error && e.cause !== undefined) {
    yield* walkErrors(e.cause, seen);
  }
}

function findCode(e: unknown, code: string): boolean {
  for (const node of walkErrors(e)) {
    if (
      typeof node === "object" &&
      node !== null &&
      "code" in node &&
      (node as { code: unknown }).code === code
    ) {
      return true;
    }
  }
  return false;
}

function flattenMessages(e: unknown): string[] {
  const out: string[] = [];
  for (const node of walkErrors(e)) {
    if (node instanceof Error) out.push(`${node.name}: ${node.message}`);
    else out.push(String(node));
  }
  return out;
}
```

`SuppressedError` (ES ERM): `error` (lỗi chính) + `suppressed` (lỗi dispose). Nên walk cả hai:

```ts
function walkSuppressed(e: unknown, seen: Set<unknown>): Generator<unknown> {
  return (function* () {
    if (typeof e === "object" && e !== null && "suppressed" in e) {
      yield* walkErrors((e as { suppressed: unknown }).suppressed, seen);
    }
    if (typeof e === "object" && e !== null && "error" in e && !(e instanceof Error && !("errors" in e))) {
      const inner = (e as { error?: unknown }).error;
      if (inner !== undefined && inner !== (e as Error).cause) {
        yield* walkErrors(inner, seen);
      }
    }
  })();
}
```

Thực dụng: check `e instanceof Error && "suppressed" in e` rồi `walkErrors(e.suppressed)`. Spec: `SuppressedError.prototype` có `.error` và `.suppressed`.

> **Pitfall:** vòng `cause` tự tham chiếu → luôn dùng `Set` khi duyệt. Thứ tự nên **pre-order**: bản thân → `errors[]` → `suppressed`/`error` ERM → `cause`.

```ts
function isAbortInTree(e: unknown): boolean {
  for (const node of walkErrors(e)) {
    if (isAbortError(node)) return true;
  }
  return false;
}
```

---

## 6. `try` / `catch` / `finally`

```ts
try {
  risky();
} catch (e) {
  console.error(e);
  throw e;
} finally {
  cleanup(); // luôn chạy (trừ process bị kill cứng)
}
```

### 6.1 Thu hẹp `unknown` trong `catch`

```ts
try {
  JSON.parse(text);
} catch (e: unknown) {
  if (e instanceof SyntaxError) {
    console.error("invalid JSON", e.message);
  } else if (e instanceof Error) {
    console.error(e.message);
  } else {
    console.error("unknown throw", e);
  }
}
```

Đừng `catch (e: any)` rồi đọc `e.code` mù quáng.

### 6.2 `finally` & `return` / `throw`

```ts
function read(): number {
  try {
    return 1;
  } finally {
    console.log("cleanup"); // vẫn chạy trước khi return thoát thật
  }
}
```

**Tránh `return` / `throw` trong `finally`:**

```ts
function bad(): number {
  try {
    throw new Error("root");
  } finally {
    return 0; // nuốt Error("root") — caller nhận 0!
  }
}

function alsoBad(): never {
  try {
    throw new Error("root");
  } finally {
    throw new Error("finally"); // che mất root
  }
}
```

> **Pitfall:** `return` trong `finally` **ghi đè** completion của `try`/`catch`, kể cả khi đang có exception. Chỉ dùng `finally` cho cleanup side-effect. Dual error → `using` / `SuppressedError` (§16) tốt hơn tự throw trong `finally`.

### 6.3 Phạm vi `try` hẹp

Bắt đúng thao tác có thể lỗi; đừng bọc cả hàm 200 dòng thành một `catch` generic.

```ts
let raw: string;
try {
  raw = await fs.readFile(path, "utf8");
} catch (e) {
  if (hasErrnoCode(e, "ENOENT")) return defaults;
  throw e;
}
const config = parseConfig(raw); // bug parse → để nổi lên
```

`try` hẹp + `using` trong block: dispose khi rời block, phối hợp `finally` theo spec ERM (dispose trước `finally` của cùng block — xem [statements.md](statements.md)).

---

## 7. Rethrow & `cause`

### 7.1 Rethrow nguyên gốc

Khi tầng hiện tại không thêm ngữ cảnh — chỉ metric / side-effect:

```ts
try {
  await save(user);
} catch (e) {
  metrics.increment("save_fail");
  throw e; // giữ stack / identity / code
}
```

### 7.2 Wrap với `cause` (khuyến nghị khi thêm context)

```ts
try {
  await save(user);
} catch (e) {
  throw new Error(`failed to save user ${user.id}`, { cause: e });
}
```

Mỗi tầng thêm **ngữ cảnh mới** (operation, id, path) — không lặp `"failed: failed: failed"`.

### 7.3 `formatErr` — in chuỗi cause + aggregate

```ts
function formatErr(e: unknown, depth = 0): string {
  if (!(e instanceof Error)) return String(e);
  const pad = "  ".repeat(depth);
  const parts = [`${pad}${e.name}: ${e.message}`];
  if (e instanceof AggregateError) {
    for (const [i, child] of e.errors.entries()) {
      parts.push(`${pad}  [${i}] ${formatErr(child, depth + 1).trimStart()}`);
    }
  }
  if ("suppressed" in e && (e as { suppressed?: unknown }).suppressed !== undefined) {
    parts.push(`${pad}Suppressed: ${formatErr((e as { suppressed: unknown }).suppressed, depth + 1).trimStart()}`);
  }
  if (e.cause !== undefined) {
    parts.push(`${pad}Caused by: ${formatErr(e.cause, depth + 1).trimStart()}`);
  }
  return parts.join("\n");
}
```

`util.inspect(err)` trên Node cũng recursively hiện `[cause]` — tiện debug REPL. `util.inspect(err, { depth: 8 })`.

### 7.4 Đừng mất stack / identity

```ts
catch (e) {
  // Xấu: mất code, stack gốc, instanceof
  throw new Error(String(e));
}
```

Map sang domain error **vẫn** giữ `cause`:

```ts
catch (e) {
  if (hasErrnoCode(e, "ENOENT")) {
    throw new NotFoundError("Config", { cause: e });
  }
  throw e;
}
```

Wrap AbortError thành `Error("load failed", { cause })` **mất** tín hiệu hủy ở biên nếu không `walkErrors` / `isAbortInTree`. Prefer rethrow abort nguyên hoặc gắn `code: "ABORT_ERR"` trên wrapper.

---

## 8. Async: rejection, combinators, async stack

### 8.1 `async`/`await` và rejection

```ts
async function load() {
  const res = await fetch("https://example.com");
  if (!res.ok) throw new Error(`HTTP ${res.status}`); // status KHÔNG tự throw — §13
  return res.text();
}

try {
  await load();
} catch (e) {
  console.error(formatErr(e));
}
```

- `await` promise reject → **throw** tại dòng `await`.
- Quên `await` / `.catch` → **floating promise** → `unhandledRejection`.
- Chi tiết Promise: [async.md](async.md), [event-loop.md](event-loop.md).

### 8.2 Floating promises

```ts
// Xấu
load();

// Chủ đích fire-and-forget CÓ xử lý lỗi
void load().catch((e) => logger.error("load failed", { err: e }));
```

Bật `@typescript-eslint/no-floating-promises` để CI bắt sớm. Gán `async` vào `() => void` là lỗ hổng kiểu — [typesystem.md](typesystem.md) §18.1.

### 8.3 Combinators vs lỗi

| API | Hành vi khi lỗi |
|-----|-----------------|
| `Promise.all` | **fail-fast**: một reject → cả cụm reject |
| `Promise.allSettled` | luôn fulfill; từng phần `{ status, value \| reason }` |
| `Promise.race` | settle theo promise **nhanh nhất** (fulfill hoặc reject) |
| `Promise.any` | fulfill đầu thành công; **tất cả** reject → `AggregateError` |

```ts
const [a, b] = await Promise.all([loadA(), loadB()]);

const settled = await Promise.allSettled([loadA(), loadB()]);
for (const r of settled) {
  if (r.status === "rejected") logger.error("task failed", { err: r.reason });
}

try {
  await Promise.any([primary(), backup()]);
} catch (e) {
  if (e instanceof AggregateError) {
    throw new Error("all sources failed", { cause: e });
  }
  throw e;
}
```

> **Pitfall `Promise.all`:** khi một task fail, các task khác **không bị cancel** trừ khi truyền chung `AbortSignal`.

### 8.4 Anti-pattern: `new Promise(async …)`

```ts
// Xấu: reject bên trong dễ thành unhandled nếu thiếu try/catch
new Promise(async (resolve, reject) => {
  const x = await f();
  resolve(x);
});
```

Viết `async function` rồi gọi trực tiếp; Promise constructor chỉ cho wrapping callback-style.

### 8.5 Async stack — thực hành

| Pattern | Stack |
|---------|--------|
| `async`/`await` thẳng | tốt (V8 stitch) |
| `return inner()` không await | frame `outer` có thể mỏng |
| `void p` floating | `unhandledRejection` — stack tại throw, không tại “quên await” |
| Worker `postMessage` | stack worker, không parent |

```ts
async function outer() {
  return inner(); // vẫn await ẩn khi return Promise — stack khá tốt
}
```

---

## 9. `unhandledRejection` / `uncaughtException` / `rejectionHandled`

### 9.1 `unhandledRejection`

Promise reject mà **không** có handler:

```ts
process.on("unhandledRejection", (reason, promise) => {
  console.error("unhandledRejection", reason, promise);
});
```

Node hiện đại coi unhandled rejection nghiêm trọng. **Đừng** dùng handler toàn cục để “sửa” logic — sửa tại nguồn (`await` / `.catch`).

### 9.2 `uncaughtException`

```ts
process.on("uncaughtException", (err, origin) => {
  console.error("uncaughtException", origin, err);
});
```

`origin`: `'uncaughtException'` | `'unhandledRejection'` (tùy phiên bản/event). Sau sự kiện này, **trạng thái process có thể không tin cậy** (invariants, locks, half-written state).

### 9.3 Fatal shutdown pattern (khuyến nghị service)

1. Coi `uncaughtException` là **fatal**: log (+ flush), đóng server/DB với timeout, rồi `process.exit(1)`.
2. **Không** recover rồi phục vụ request tiếp như bình thường.
3. `unhandledRejection` trên service production: cùng chiến lược trừ khi đã phân loại noise.
4. Đăng ký handler **sớm** (entry file), trước khi listen.
5. Tách `SIGINT`/`SIGTERM` (shutdown êm) khỏi fatal path.

```ts
let shuttingDown = false;

async function fatal(err: unknown, label: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(label, formatErr(err));
  try {
    await Promise.race([
      shutdown(),
      new Promise((r) => setTimeout(r, 5_000)),
    ]);
  } finally {
    process.exit(1);
  }
}

process.on("uncaughtException", (err) => {
  void fatal(err, "uncaughtException");
});
process.on("unhandledRejection", (reason) => {
  void fatal(reason, "unhandledRejection");
});
```

`process.exit` **bỏ qua** `await using` / `finally` còn treo — timeout + `shutdown()` chủ động đóng resource.

### 9.4 `rejectionHandled`

```ts
process.on("rejectionHandled", (promise) => {
  console.warn("rejectionHandled late", promise);
});
```

Reject được gắn `.catch` **muộn** (sau `unhandledRejection`) — tín hiệu race / quên `await`. Dùng để debug, không phải recovery. Debug thêm: `--trace-uncaught`, inspector.

### 9.5 Worker không đi vào handler parent

`uncaughtException` trên **main không** nhận throw trong `Worker` thread. Worker có event `error` / `exit` — §17. Cluster/child_process: `'error'` trên ChildProcess, kênh IPC.

---

## 10. Result / union vs `throw`

### 10.1 Khi nào `throw`

- Bug / invariant vỡ (`assert`).
- Không thể tiếp tục theo hợp đồng hàm (I/O fail mà caller phải biết).
- Thư viện fail-fast; caller chủ động `try/catch`.

### 10.2 Khi nào Result / discriminated union

- Parse / validate input user (nhánh thường xuyên).
- “Không tìm thấy” là luồng nghiệp vụ bình thường (HTTP 404).
- Muốn **ép** caller xử lý cả hai nhánh ở hệ thống kiểu.

```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function parsePort(raw: string): Result<number, string> {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    return { ok: false, error: "invalid port" };
  }
  return { ok: true, value: n };
}

const r = parsePort("8080");
if (!r.ok) console.error(r.error);
else console.log(r.value);
```

Union đơn giản cũng đủ:

```ts
type FindUser =
  | { status: "found"; user: { id: string } }
  | { status: "missing" }
  | { status: "failed"; error: Error };
```

### 10.3 Nhất quán biên API

| Tầng | Chiến lược gợi ý |
|------|------------------|
| Domain / use-case | union cho nhánh nghiệp vụ; throw cho invariant |
| Infrastructure (fs, db) | thường throw / reject; map ở biên |
| HTTP handler | bắt mọi thứ → status + body; log 1 lần |
| Library công khai | document rõ: throw gì / trả gì; đừng trộn |

Tránh: cùng một lớp lỗi đôi khi `throw`, đôi khi `null`, đôi khi `{ error }`.

---

## 11. Never swallow, log một lần, OpenTelemetry attributes

### 11.1 Nuốt lỗi

```ts
// Xấu
try {
  await sendEmail(order);
} catch {
  // im lặng
}

// Xấu
try {
  return JSON.parse(text);
} catch {
  return {}; // che SyntaxError
}
```

Chấp nhận được khi **chủ đích** và có quan sát:

```ts
try {
  await sendEmail(order);
} catch (e) {
  logger.error("sendEmail failed", {
    orderId: order.id,
    err: e,
    errCode: e instanceof Error && "code" in e ? e.code : undefined,
  });
  metrics.increment("email_fail");
  throw e; // hoặc retry queue — đừng im lặng
}
```

Empty `catch` chỉ khi có comment **tại sao** an toàn + metric/log tối thiểu.

### 11.2 Log một lần ở biên — structured keys

- Tầng dưới: wrap/`cause` rồi `throw`.
- Tầng biên (HTTP middleware, CLI `main`, queue consumer): **log một lần**.

| Key | Nội dung |
|-----|----------|
| `err` | đối tượng Error (serializer: `name`/`message`/`stack`/`cause`) |
| `errCode` | `code` ổn định nếu có |
| `op` | tên thao tác (`"user.save"`) |
| `reqId` / `traceId` | tương quan request |

```ts
try {
  await handle(req);
} catch (e) {
  logger.error("request failed", {
    op: "POST /orders",
    reqId,
    err: e,
    errCode: typeof e === "object" && e && "code" in e ? e.code : undefined,
  });
  res.statusCode = e instanceof NotFoundError ? 404 : 500;
  res.end();
}
```

> **Pitfall:** log ở mọi tầng + rethrow → spam trùng, khó đếm metric, dễ lộ PII nhiều lần.

### 11.3 OpenTelemetry-style attributes

Semantic conventions (OTel): exception trên span khi **status error**; cancellation thường **không** set error status.

| Attribute | Giá trị gợi ý |
|-----------|----------------|
| `exception.type` | `err.name` / `constructor.name` |
| `exception.message` | `err.message` (cắt PII) |
| `exception.stacktrace` | `err.stack` |
| `error.type` | `err.code` hoặc `err.name` (ổn định hơn message) |
| `http.response.status_code` | sau khi map (§14) |
| `thread.id` / `code.function` | nếu có |

```ts
function otelExceptionAttrs(e: unknown): Record<string, string> {
  if (!(e instanceof Error)) {
    return { "exception.type": typeof e, "exception.message": String(e) };
  }
  const attrs: Record<string, string> = {
    "exception.type": e.name,
    "exception.message": e.message,
  };
  if (e.stack) attrs["exception.stacktrace"] = e.stack;
  if ("code" in e && typeof e.code === "string") attrs["error.type"] = e.code;
  return attrs;
}
```

- Ghi exception **trên span hiện tại** ở biên; không `span.recordException` mỗi tầng wrap.
- Abort: `span.setStatus({ code: UNSET hoặc OK })` + event `cancelled` — không `ERROR` trừ timeout 5xx.
- `error.type` nên **thấp cardinality** (`ENOENT`, `NotFoundError`) — đừng dùng full message.

Serializer log:

```ts
function errFields(e: unknown) {
  return {
    "exception.type": e instanceof Error ? e.name : typeof e,
    "exception.message": e instanceof Error ? e.message : String(e),
    "error.type": readCode(e) ?? (e instanceof Error ? e.name : "unknown"),
    cause: e instanceof Error && e.cause instanceof Error ? e.cause.name : undefined,
  };
}
```

---

## 12. Node error codes, `ERR_*`, `util.getSystemErrorMap`

### 12.1 Hai họ mã

| Họ | Dạng | Ví dụ | Cách nhận diện |
|----|------|-------|----------------|
| System / errno | `E*` | `ENOENT`, `EADDRINUSE` | `err.code` (+ `errno`/`syscall`) |
| Node nội bộ | `ERR_*` | `ERR_INVALID_ARG_TYPE` | `err.code` |
| Web abort | `ABORT_ERR` / name `AbortError` | hủy `AbortSignal` | `DOMException` / name — §15 |

**Đừng parse `message`.** Message Node có thể đổi; `code` mới là hợp đồng.

### 12.2 `util.getSystemErrorName` / `Map` / `Message`

```ts
import fs from "node:fs";
import util from "node:util";

fs.access("missing", (err) => {
  if (!err) return;
  console.log(util.getSystemErrorName(err.errno));    // "ENOENT"
  console.log(util.getSystemErrorMessage(err.errno)); // "No such file or directory"
  console.log(util.getSystemErrorMap().get(err.errno)); // "ENOENT"
});
```

| API | Việc |
|-----|------|
| `util.getSystemErrorName(errno)` | số → tên (`ENOENT`) |
| `util.getSystemErrorMessage(errno)` | số → mô tả OS (Node 22.12+ / 23.1+) |
| `util.getSystemErrorMap()` | `Map<number, string>` errno → tên |

```ts
const map = util.getSystemErrorMap();
for (const [errno, name] of map) {
  // Windows và POSIX: cùng name, errno khác nhau có thể
}
```

- Map **không** chứa `ERR_*` (đó không phải errno OS).
- App thường đọc `err.code === "ENOENT"`; helper hữu ích khi chỉ có số `errno` (addon, C++).
- `getSystemErrorMap()` tạo Map mỗi lần gọi — cache nếu hot (hiếm).

### 12.3 Catalog `ERR_*` mở rộng

Nhóm **đối số / kiểu** (thường `TypeError`):

| `code` | Ý nghĩa |
|--------|---------|
| `ERR_INVALID_ARG_TYPE` | sai kiểu đối số — rất hay gặp (`expected string, got number`) |
| `ERR_INVALID_ARG_VALUE` | đúng kiểu, giá trị không hợp lệ |
| `ERR_INVALID_CALLBACK` | callback không phải function |
| `ERR_MISSING_ARGS` | thiếu đối số bắt buộc |
| `ERR_OUT_OF_RANGE` | số / độ dài ngoài khoảng |
| `ERR_INVALID_THIS` | `this` sai khi gọi method built-in |
| `ERR_ILLEGAL_CONSTRUCTOR` | `new` không được phép |
| `ERR_INVALID_URL` | `new URL` / parse URL fail |
| `ERR_INVALID_URL_SCHEME` | scheme không hỗ trợ |
| `ERR_INVALID_FILE_URL_PATH` / `HOST` | `file:` URL sai |
| `ERR_INVALID_IP_ADDRESS` | IP parse |
| `ERR_INVALID_PROTOCOL` | protocol lệch |

Nhóm **module / ESM** (hay gặp khi migrate ESM):

| `code` | Ý nghĩa |
|--------|---------|
| `ERR_MODULE_NOT_FOUND` | resolve module / file thất bại |
| `ERR_REQUIRE_ESM` | `require()` ESM thuần (không có CJS named export) |
| `ERR_UNKNOWN_FILE_EXTENSION` | import đuôi không hỗ trợ (`.ts` khi strip tắt / `.foo`) |
| `ERR_UNKNOWN_MODULE_FORMAT` | format không nhận |
| `ERR_UNSUPPORTED_ESM_URL_SCHEME` | `import` scheme lạ |
| `ERR_UNSUPPORTED_DIR_IMPORT` | import thư mục không có index hợp lệ |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | subpath không nằm trong `exports` |
| `ERR_PACKAGE_IMPORT_NOT_DEFINED` | `#imports` không định nghĩa |
| `ERR_INVALID_MODULE_SPECIFIER` | specifier sai |
| `ERR_INVALID_PACKAGE_CONFIG` | `package.json` hỏng |
| `ERR_INVALID_PACKAGE_TARGET` | `exports` target không hợp lệ |
| `ERR_NETWORK_IMPORT_DISALLOWED` | import HTTP bị cấm (policy) |
| `ERR_UNKNOWN_BUILTIN_MODULE` | `node:foo` không tồn tại |

Nhóm **stream / HTTP / socket**:

| `code` | Ý nghĩa |
|--------|---------|
| `ERR_STREAM_DESTROYED` | thao tác trên stream đã destroy |
| `ERR_STREAM_PREMATURE_CLOSE` | đóng sớm khi còn kỳ vọng data |
| `ERR_STREAM_WRITE_AFTER_END` | write sau end |
| `ERR_STREAM_ALREADY_FINISHED` | finished rồi |
| `ERR_STREAM_CANNOT_PIPE` | pipe không hợp lệ |
| `ERR_SERVER_ALREADY_LISTEN` | `listen` lần hai |
| `ERR_SERVER_NOT_RUNNING` | method khi server chưa chạy |
| `ERR_SOCKET_CLOSED` | socket đã đóng |
| `ERR_SOCKET_CLOSED_BEFORE_CONNECTION` | đóng trước connect |
| `ERR_HTTP_HEADERS_SENT` | ghi header sau khi đã gửi |
| `ERR_HTTP_INVALID_STATUS_CODE` | status không hợp lệ |
| `ERR_UNHANDLED_ERROR` | `EventEmitter` emit `'error'` không listener |

Nhóm **abort / worker / hệ thống**:

| `code` | Ý nghĩa |
|--------|---------|
| `ABORT_ERR` | aborted — web `AbortError` / `DOMException.code` 20 |
| `ERR_WORKER_NOT_RUNNING` | worker đã dừng |
| `ERR_WORKER_PATH` | đường dẫn worker sai |
| `ERR_WORKER_UNSERIALIZABLE_ERROR` | không clone lỗi worker → parent |
| `ERR_WORKER_UNSUPPORTED_OPERATION` | API không trên worker |
| `ERR_SCRIPT_EXECUTION_INTERRUPTED` | VM interrupt |
| `ERR_UNCAUGHT_EXCEPTION_CAPTURE_ALREADY_SET` | `setUncaughtExceptionCaptureCallback` lần hai |
| `ERR_SYSTEM_ERROR` | lỗi hệ thống generic |
| `ERR_INTERNAL_ASSERTION` | bug Node — báo issue |
| `ERR_TEST_FAILURE` | `node:test` |

```ts
function readCode(e: unknown): string | undefined {
  if (typeof e === "object" && e && "code" in e) {
    const c = (e as { code: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
}
```

`EventEmitter` không có listener `'error'` → có thể crash với `ERR_UNHANDLED_ERROR`. **Luôn** `.on("error", …)` cho stream/socket, hoặc dùng API promise (`once`, `stream/promises`).

```ts
import { EventEmitter, once } from "node:events";
import { createReadStream } from "node:fs";

const ee = new EventEmitter();
ee.on("error", (err: unknown) => {
  logger.error("ee", { err });
});

const rs = createReadStream("x");
rs.on("error", (err) => {
  if (hasErrnoCode(err, "ENOENT")) return;
  throw err; // vẫn uncaught nếu throw trong handler — log rồi đừng throw nếu đã xử lý
});

await once(rs, "close"); // reject khi 'error' — bắt bằng try/catch
```

Throw **bên trong** listener `'error'` → có thể `uncaughtException`. Handler chỉ log / forward, không rethrow trừ khi bạn muốn fatal.

### 12.4 `ERR_INVALID_ARG_TYPE` / `ERR_MODULE_NOT_FOUND` / `ERR_REQUIRE_ESM` / `ERR_UNKNOWN_FILE_EXTENSION`

```ts
import { readFile } from "node:fs/promises";

try {
  // @ts-expect-error minh họa runtime
  await readFile(1 as unknown as string);
} catch (e) {
  readCode(e); // "ERR_INVALID_ARG_TYPE"
}
```

| Code | Khi nào thấy | Xử lý |
|------|----------------|--------|
| `ERR_INVALID_ARG_TYPE` | caller truyền sai kiểu vào Node API | programmer error — fail-fast, đừng retry |
| `ERR_MODULE_NOT_FOUND` | sai path, thiếu package, `exports` chặn | cài dep / sửa specifier; **không** bắt làm 404 HTTP trừ khi đó là user path |
| `ERR_REQUIRE_ESM` | CJS `require` file `"type": "module"` | đổi `import`, hoặc dual package; Node 22+ có một số `require(esm)` — đừng dựa nếu lib thuần ESM |
| `ERR_UNKNOWN_FILE_EXTENSION` | `import "./x.ts"` khi runtime không strip; hoặc `.css` không loader | Node 26 strip `.ts`; `.tsx` / `.mts` tùy; bundler cho non-JS |
| Abort `ABORT_ERR` | `signal` abort giữa API | §15 — không log 5xx |

> `ERR_MODULE_NOT_FOUND` **khác** `ENOENT`: cái trước là resolver ESM/CJS; cái sau là syscall fs. Dynamic `import(userPath)` cần chặn path traversal trước khi map 404.

### 12.5 `assert.AssertionError`

```ts
import assert from "node:assert/strict";

try {
  assert.equal(1, 2);
} catch (e) {
  if (e instanceof assert.AssertionError) {
    e.code;      // "ERR_ASSERTION"
    e.actual;
    e.expected;
    e.operator;
  }
}
```

Dùng `assert` cho **programmer invariant**, không cho validation user (trả 400). Test runner `node:test` bắt AssertionError như fail test, không phải crash HTTP.

`assert.ok(x)` message mặc định nghèo — `assert.ok(x, "user must be loaded")`.

### 12.6 `process.exitCode` vs `process.exit`

```ts
process.exitCode = 1; // để event loop kết thúc rồi thoát — cho logger flush
// process.exit(1); // cắt ngay — có thể mất log
```

Fatal handler: flush rồi `exit`. CLI map lỗi → `exitCode` (ENOENT → 2 kiểu POSIX tùy convention app; thường 1).

JSON serialize Error:

```ts
JSON.stringify(new Error("x")); // "{}" — name/message non-enumerable
JSON.stringify(new Error("x"), ["message", "name", "stack"]); // vẫn có thể thiếu
```

Dùng serializer tường minh (`errFields` / `formatErr`), không `JSON.stringify(err)` làm payload HTTP.

---

## 13. `fetch` / undici: TypeError vs AbortError vs HTTP status

Node 26 dùng **Undici** cho `fetch` toàn cục. **HTTP status 4xx/5xx không throw.**

```ts
const res = await fetch(url, { signal });
res.ok;      // status 200–299
res.status;  // 404, 500, … — không phải exception
if (!res.ok) {
  throw new Error(`HTTP ${res.status}`, { cause: { status: res.status } });
}
```

| Tình huống | Throw? | Kiểu điển hình |
|------------|--------|----------------|
| DNS fail, TCP refused, TLS, reset | **có** | `TypeError` (`fetch failed`) — `cause` có thể SystemError (`ECONNREFUSED`, …) |
| Abort `signal` | **có** | `DOMException` `name === "AbortError"` / `ABORT_ERR` |
| Timeout `AbortSignal.timeout` | **có** | AbortError; `signal.reason` thường `TimeoutError` / `DOMException` |
| HTTP 404 / 500 | **không** | `Response` — tự kiểm `ok`/`status` |
| Body đã consume hai lần | **có** | `TypeError` (body used) |
| URL invalid | **có** | `TypeError` / `ERR_INVALID_URL` |

```ts
async function loadJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw new Error(`fetch ${url}`, { cause: e }); // TypeError mạng
  }
  if (!res.ok) {
    throw new HttpError(res.status, res.statusText); // tự định nghĩa — không phải throw của fetch
  }
  return res.json() as Promise<unknown>;
}
```

```ts
class HttpError extends Error {
  constructor(
    readonly status: number,
    statusText: string,
    options?: ErrorOptions,
  ) {
    super(`HTTP ${status} ${statusText}`, options);
    this.name = "HttpError";
    this.code = "HTTP_STATUS";
  }
  readonly code: string;
}
```

- Undici có thể đặt `err.cause` là lỗi socket — `walkErrors` / `readCode(cause)` để retry `ECONNRESET`.
- `TypeError: fetch failed` **message không ổn định** — đừng match chuỗi; nhìn `cause.code` / `name`.
- `res.json()` trên body rỗng / HTML → `SyntaxError` — khác HTTP status.

**Khi nào KHÔNG `throw` vì status:** proxy thuần, health check, client cố ý đọc 404 body. Trả `Result<{ status, body }>`.

Chi tiết `signal`: [abort-context.md](abort-context.md). HTTP built-in: [nodejs-apis.md](nodejs-apis.md).

---

## 14. Map lỗi → HTTP status

Chỉ map ở **biên HTTP**, một lần, sau khi đã log.

| Điều kiện | Status | Ghi chú |
|-----------|--------|---------|
| `NotFoundError` / `code === "NOT_FOUND"` | 404 | resource nghiệp vụ |
| `ENOENT` **sau khi** map file user | 404 | đừng 404 mọi ENOENT (thiếu template nội bộ = 500) |
| Validation / `SyntaxError` JSON body | 400 | |
| Auth thiếu | 401 | |
| Cấm | 403 | |
| `EEXIST` / conflict domain | 409 | |
| Payload lớn | 413 | |
| Rate limit | 429 | |
| `isAbortError` + client hủy | **không** 500; 499 (nginx) hoặc im lặng drop | |
| Timeout server / `AbortSignal.timeout` | 504 | |
| `ECONNREFUSED` tới dependency | 503 | retry-after tùy |
| Programmer / unknown | 500 | log stack; body không leak stack production |
| `ERR_INVALID_ARG_TYPE` từ input user đã validate? | 400 nếu input; 500 nếu bug nội bộ | |

```ts
function toHttpStatus(e: unknown): number {
  if (isAbortError(e)) return 499;
  if (e instanceof NotFoundError) return 404;
  if (e instanceof HttpError) return e.status;
  if (hasErrnoCode(e, "ENOENT")) return 404; // chỉ khi hàm này dành cho user-path
  if (e instanceof SyntaxError) return 400;
  if (e instanceof RangeError) return 400;
  return 500;
}
```

```ts
function errorBody(e: unknown, publicMode: boolean) {
  const code = readCode(e) ?? "INTERNAL";
  if (publicMode) return { error: code };
  return { error: code, message: e instanceof Error ? e.message : String(e) };
}
```

> **Khi nào KHÔNG map:** CLI (dùng exit code); queue consumer (retry / DLQ); WebSocket (đóng khung, không HTTP). Đừng gắn `statusCode` vào Error domain rồi import HTTP vào core.

---

## 15. AbortError / `DOMException` aborted

### 15.1 Hủy ≠ lỗi vận hành thông thường

`AbortController` / `AbortSignal` hủy thao tác hợp tác. Khi abort, API thường reject/throw với:

- `DOMException` có `name === "AbortError"`, và/hoặc
- `code === 20` (`ABORT_ERR`) / `code: "ABORT_ERR"` tùy API.

```ts
function isAbortError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const any = e as { name?: string; code?: string | number };
  return any.name === "AbortError" || any.code === "ABORT_ERR" || any.code === 20;
}

const ac = new AbortController();
ac.abort();

try {
  await fetch("https://example.com", { signal: ac.signal });
} catch (e) {
  if (isAbortError(e)) return; // không log như 5xx
  throw e;
}
```

`TimeoutError` (`name === "TimeoutError"`) từ `AbortSignal.timeout` — **không** luôn `AbortError`. Check `signal.reason` / `name`.

### 15.2 `signal` + timeout

```ts
async function load(url: string, signal: AbortSignal) {
  signal.throwIfAborted();
  try {
    const res = await fetch(url, { signal });
    return res.text();
  } catch (e) {
    if (signal.aborted || isAbortError(e)) throw e;
    throw new Error(`load ${url}`, { cause: e });
  }
}

const signal = AbortSignal.timeout(5_000);
try {
  await fs.readFile("big.bin", { signal });
} catch (e) {
  if (signal.aborted) {
    console.error("aborted", signal.reason); // timeout vs user-cancel
    return;
  }
  throw e;
}
```

### 15.3 Logging & fatal handlers

| Tình huống | Nên |
|------------|-----|
| User hủy request | không tính lỗi server; tránh `unhandledRejection` |
| Timeout chủ đích | map 504 / retry; log warn nếu cần |
| Abort rồi wrap `{ cause }` | `isAbortInTree` để biên không thành 500 |
| Abort trong worker nền | vẫn phải `.catch` |

> **Pitfall:** chỉ check `signal.aborted` sau khi nuốt mọi lỗi → có thể nuốt lỗi thật khi race. Check `isAbortError(e) \|\| signal.aborted` rồi **rethrow** nhánh còn lại.

Chi tiết propagation: [abort-context.md](abort-context.md).

---

## 16. `using` / Disposable & lỗi khi dispose

Explicit Resource Management: [statements.md](statements.md#11-using-vs-tryfinally), [functions-methods.md](functions-methods.md), [keywords.md](keywords.md).

```ts
class FileTracker implements Disposable {
  constructor(readonly path: string) {}
  [Symbol.dispose]() {
    /* close fd */
  }
}

function process() {
  using f = new FileTracker("./x.txt");
  throw new Error("work"); // vẫn dispose
}
```

### 16.1 Lỗi body + lỗi dispose → `SuppressedError`

Nếu **thân block throw** và `[Symbol.dispose]` cũng throw, runtime tạo `SuppressedError`:

| Field | Ý nghĩa |
|-------|---------|
| `error` | lỗi **gốc** (body) |
| `suppressed` | lỗi **dispose** |
| `name` | `"SuppressedError"` |
| `message` | mô tả dual |

```ts
function isSuppressedError(
  e: unknown,
): e is Error & { error: unknown; suppressed: unknown } {
  return (
    typeof e === "object" &&
    e !== null &&
    e.constructor?.name === "SuppressedError" &&
    "error" in e &&
    "suppressed" in e
  );
}
```

`globalThis.SuppressedError` có trên Node hiện đại khi ERM bật.

```ts
try {
  using r = {
    [Symbol.dispose]() {
      throw new Error("dispose failed");
    },
  };
  throw new Error("work failed");
} catch (e) {
  if (isSuppressedError(e)) {
    console.error("primary", e.error);
    console.error("dispose", e.suppressed);
  }
  throw e;
}
```

- Nhiều `using` LIFO: dispose ngược thứ tự khai. Lỗi dispose tầng trong có thể suppressed chồng.
- `await using` + `Symbol.asyncDispose`: dual error tương tự, async.
- **`finally` throw** che body — ERM chuẩn hóa dual error; prefer `using` hơn `finally { throw }`.

### 16.2 Khi nào KHÔNG dựa `using` nuốt lỗi

- Dispose **phải** thành công (fsync, commit): kiểm tra lỗi dispose riêng, đừng để suppressed im lặng.
- Nhiều API Node **chưa** `Disposable` — wrapper `[Symbol.dispose]() { this.close(); }` ; `close()` async → `AsyncDisposable` / `await using`.
- Sync `using` trên async close → leak hoặc throw đồng bộ sai.

```ts
class Handle implements AsyncDisposable {
  constructor(private fd: { close(): Promise<void> }) {}
  async [Symbol.asyncDispose]() {
    await this.fd.close();
  }
}
```

---

## 17. Worker error vs process chính

Chi tiết pool/API: [threading.md](threading.md).

```ts
import { Worker } from "node:worker_threads";

const worker = new Worker(new URL("./job.js", import.meta.url));

worker.on("error", (err) => {
  // uncaught trong worker thread — KHÔNG vào uncaughtException của main
  console.error("worker error", err);
});
worker.on("messageerror", (err) => {
  // deserialize message thất bại (clone)
  console.error("messageerror", err);
});
worker.on("exit", (code) => {
  if (code !== 0) console.error("worker exit", code);
});
```

| Nơi throw | Main `uncaughtException` | Worker `error` | `exit` |
|-----------|--------------------------|----------------|--------|
| Main thread | có | không | n/a |
| Worker uncaught | **không** | có | ≠ 0 |
| `postMessage` không clone được | throw phía gửi | — | — |
| Lỗi trong worker không serialize | parent nhận `ERR_WORKER_UNSERIALIZABLE_ERROR` / Error generic | tùy | ≠ 0 |
| `terminate()` | không | có thể | ngay |

```ts
parentPort!.on("message", (msg) => {
  void handle(msg).catch((err: unknown) => {
    parentPort!.postMessage({
      ok: false,
      error: {
        message: err instanceof Error ? err.message : String(err),
        code: readCode(err),
        name: err instanceof Error ? err.name : "Error",
      },
    });
  });
});
```

- Structured clone **không** giữ class `AppError` / stack đầy đủ — serialize `code`/`message`/`name` tường minh.
- Native addon crash có thể **hạ cả process** (cùng isolate không áp dụng; addon trong worker vẫn có thể nặng).
- Test worker: assert `'error'` event + `exit` code, không expect main fatal handler.

**Khi nào KHÔNG** để worker tự `throw` lên parent như HTTP: luôn protocol `{ ok, error }` + `error` event như safety net.

### 17.1 Serialize lỗi qua clone / IPC

Structured clone / `postMessage` / `workerData`:

| Giữ được | Mất |
|----------|-----|
| `Error.message`, `name`, `stack` (thường) | class `AppError`, method |
| enumerable own fields tùy engine | `cause` **có thể** clone trên Node hiện đại — đừng giả định mọi runtime |
| | non-enumerable custom field |

```ts
function toDto(e: unknown): { name: string; message: string; code?: string } {
  return {
    name: e instanceof Error ? e.name : "Error",
    message: e instanceof Error ? e.message : String(e),
    code: readCode(e),
  };
}
```

`ERR_WORKER_UNSERIALIZABLE_ERROR` khi throw giá trị không clone (circular, native handle). Luôn `try/catch` trong worker rồi `postMessage(toDto(err))`.

Child process `fork`: `'error'`, `'exit'`, `stdio` — lỗi uncaught child **không** phải `uncaughtException` parent; IPC message tương tự clone hạn chế.

### 17.2 Diagnostic: `process.report`

```ts
process.report.writeReport(); // heap/stack dump — ops, không phải API app thường
```

Fatal handler có thể `writeReport` trước `exit` khi điều tra production; đừng gọi mỗi request.

---

## 18. `domain` đã chết

Module `node:domain` (và `require('domain')`) là **legacy**. Không dùng cho error handling mới.

| Ngày xưa `domain` hứa | Thực tế |
|------------------------|---------|
| Bắt lỗi async “theo request” | lỗ hổng, implicit, không tương thích Promise đầy đủ |
| Thay `try/catch` | che bug, giữ process sống nửa vời |

Thay:

| Nhu cầu | Dùng |
|---------|------|
| Hủy theo request | `AbortSignal` — [abort-context.md](abort-context.md) |
| Giá trị theo request | `AsyncLocalStorage` |
| Lỗi async | `await` / `.catch` / `unhandledRejection` fatal |
| HTTP isolation | bắt ở middleware; không domain.bind |

```ts
import { AsyncLocalStorage } from "node:async_hooks";
const reqContext = new AsyncLocalStorage<{ reqId: string }>();
```

`process.setUncaughtExceptionCaptureCallback` cũng **không** phải recovery — một callback, fatal vẫn nên exit. Không kết hợp domain.

> Docs Node đánh dấu Domain historical. Code mới mention `domain` → smell.

### 18.1 `setUncaughtExceptionCaptureCallback`

```ts
process.setUncaughtExceptionCaptureCallback((err) => {
  console.error("captured", err);
  process.exit(1);
});
```

Chỉ **một** callback; đăng ký lần hai → `ERR_UNCAUGHT_EXCEPTION_CAPTURE_ALREADY_SET`. Không kết hợp như recovery. APM đôi khi dùng — đừng chồng hai lớp. `uncaughtException` event có thể không chạy nếu capture đã set (tùy thứ tự) — đọc docs Node trước khi mix.

`worker_threads` có `setUncaughtExceptionCaptureCallback` **theo thread** — main capture không bắt worker.

> **Khi nào KHÔNG** `setUncaughtExceptionCaptureCallback`: app thường — đủ `process.on("uncaughtException")` + exit. Chỉ khi APM document rõ exclusive capture.

---


## 19. Testing errors

### 19.1 Nguyên tắc: đừng assert message string

`message` đổi khi thêm wrap → test giòn. Assert **`code`**, **`instanceof`**, **`cause`**, hoặc predicate.

### 19.2 Đồng bộ: `assert.throws`

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("parsePort", () => {
  it("rejects empty", () => {
    assert.throws(
      () => parsePortOrThrow(""),
      (e: unknown) =>
        e instanceof RangeError && (e as { code?: string }).code === "ERR_PORT",
    );
  });
});
```

Object matcher (Node `assert`):

```ts
assert.throws(() => fs.readFileSync("nope"), { code: "ENOENT" });
```

### 19.3 Async: `assert.rejects` khớp `code`

```ts
import assert from "node:assert/strict";
import { it } from "node:test";

it("readConfig maps ENOENT", async () => {
  await assert.rejects(
    () => readConfig("no-such-file.json"),
    (e: unknown) => e instanceof NotFoundError && e.code === "NOT_FOUND",
  );
});

it("rejects with code", async () => {
  await assert.rejects(() => fs.readFile("nope"), { code: "ENOENT" });
});

it("ERR_INVALID_ARG_TYPE", async () => {
  await assert.rejects(
    async () => {
      await fs.readFile(undefined as unknown as string);
    },
    { code: "ERR_INVALID_ARG_TYPE" },
  );
});

it("wraps syscall", async () => {
  try {
    await readConfig("no-such-file.json");
    assert.fail("expected throw");
  } catch (e) {
    assert.ok(e instanceof NotFoundError);
    assert.ok(e.cause instanceof Error);
    assert.equal((e.cause as NodeJS.ErrnoException).code, "ENOENT");
  }
});
```

`assert.rejects(promise, error)` — `error` có thể là:

| Dạng | Việc |
|------|------|
| class (`TypeError`) | `instanceof` |
| `{ code: "ENOENT" }` | `deepEqual` subset trên error object |
| `{ name, code }` | kết hợp |
| predicate `(err) => boolean` | linh hoạt; **phải** return true |
| `RegExp` | khớp **message** — giòn, tránh |

ValidationError của `assert.rejects` nếu predicate trả `false` — đọc kỹ, đừng nuốt.

### 19.4 `AggregateError` & table-driven

```ts
await assert.rejects(
  () => Promise.any([Promise.reject(new Error("a")), Promise.reject(new Error("b"))]),
  (e: unknown) => e instanceof AggregateError && e.errors.length === 2,
);

const cases = [
  { name: "ok", in: "8080", ok: true },
  { name: "bad", in: "x", ok: false, code: "ERR_PORT" },
] as const;

for (const tt of cases) {
  it(tt.name, () => {
    if (tt.ok) {
      assert.equal(parsePortOrThrow(tt.in), 8080);
    } else {
      assert.throws(() => parsePortOrThrow(tt.in), (e: unknown) =>
        typeof e === "object" && e !== null && "code" in e && e.code === tt.code,
      );
    }
  });
}
```

Đừng assert **thứ tự** message trong `errors[]` nếu production không cam kết thứ tự.

Abort:

```ts
await assert.rejects(
  () => fetch("https://example.com", { signal: AbortSignal.abort() }),
  (e: unknown) => isAbortError(e),
);
```

---

## 20. Khi nào KHÔNG dùng `throw`

| Dùng giá trị / Result / union | Dùng `throw` / reject |
|------------------------------|------------------------|
| Validation input user (form, CLI arg thường sai) | Bug / invariant nội bộ vỡ |
| “Not found” là nhánh business (404) | Không thể tiếp tục I/O theo hợp đồng |
| Parse mềm ở biên API → 400 | Thư viện fail-fast đã document |
| Control flow thường xuyên trên hot path | Hiếm, bất thường |
| Hủy có chủ đích → AbortError (§15), thường **không** log như failure | Không recover nửa vời sau programmer error |
| HTTP status từ `fetch` | Mạng down (`TypeError`) |

| Tránh | Lý do |
|-------|-------|
| `throw` mọi 404 rồi `catch` ở mọi call site | ồn ào, khó đọc kiểu |
| Result cho mọi bug (`ok: false` khi null deref) | che programmer error |
| `throw "string"` / status code số | mất stack & chuẩn hóa |
| Dùng exception làm `goto` lồng sâu | khó theo dõi |
| `domain` bind | module chết |
| `prepareStackTrace` global | đè tooling |
| Map mọi `ENOENT` → 404 | leak / sai nghĩa |
| Log + rethrow mọi tầng | spam |
| `return` trong `finally` | nuốt lỗi |
| Tin `fetch` throw khi 500 | **không throw** |

> **Tóm lại:** throw cho **bất thường theo hợp đồng hàm**; Result/union cho **nhánh mong đợi**; Abort cho **hủy**; HTTP status cho **biên**.

---

## 21. Best practices

1. **Luôn throw `Error` (subclass)** — không primitive / plain object.
2. Phân biệt **operational vs programmer**; đừng recover qua loa sau bug.
3. Nhận diện bằng **`code` / `instanceof` / type guard**, không so `message`.
4. Wrap với **`{ cause }`** khi thêm ngữ cảnh; rethrow nguyên gốc khi không thêm gì.
5. **`catch (e: unknown)`** rồi thu hẹp; đừng `any`.
6. Không `return`/`throw` trong **`finally`** — chỉ cleanup; dual error → `using` / `SuppressedError`.
7. Không để **floating promise**; bật lint; `void p.catch(…)`.
8. Global `uncaughtException` / `unhandledRejection` = **fatal shutdown**, không business recovery.
9. **Log một lần** ở biên với key thống nhất (`err`, `errCode`, `op`, `reqId`) + OTel `exception.*` / `error.type`.
10. Test bằng **`assert.rejects` / `{ code }` / `cause`**, không assert chuỗi message.
11. `fetch`: kiểm `res.ok`; abort tách khỏi TypeError mạng.
12. Worker: protocol serialize + `error` event; đừng đợi main `uncaughtException`.
13. Không dùng `domain`. Không `prepareStackTrace` global production.
14. `Error.stackTraceLimit` vừa đủ; `captureStackTrace` chỉ để cắt constructor.

---

## 22. Checklist

```text
□ throw Error/subclass, có message hữu ích
□ lỗi máy đọc dùng code ổn định (ENOENT / ERR_* / NOT_FOUND)
□ wrap có cause; không String(e) rồi mất gốc
□ catch unknown + thu hẹp; không empty catch im lặng
□ finally không return/throw
□ await hoặc .catch mọi Promise
□ AbortError tách khỏi failure path / 5xx
□ fetch: res.ok — status không tự throw
□ biên HTTP/CLI: log 1 lần + map status (ENOENT không phải lúc nào 404)
□ unhandledRejection/uncaughtException → shutdown có trật tự
□ test assert code/cause/instanceof, không assert message
□ using: inspect SuppressedError.error / .suppressed
□ worker: on('error')/'exit'; serialize error fields
□ không domain; không prepareStackTrace global
□ OTel: exception.type / error.type cardinality thấp
```

---

## 23. Cheat sheet

```ts
try {
  await work(signal);
} catch (e: unknown) {
  if (isAbortError(e) || signal.aborted) throw e;
  throw new Error("work failed", { cause: e });
} finally {
  await close(); // không return ở đây
}

class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AppError";
  }
}

process.on("uncaughtException", (err) => {
  console.error(formatErr(err));
  process.exit(1);
});

await assert.rejects(() => fs.readFile("nope"), { code: "ENOENT" });
```

| Tình huống | Hướng xử lý |
|---|---|
| JSON sai | `SyntaxError` → validation / 400 |
| File thiếu | `code === "ENOENT"` |
| Cổng bận | `EADDRINUSE` |
| Peer reset / timeout | `ECONNRESET` / `ETIMEDOUT` — cân nhắc retry |
| Sai đối số Node API | `ERR_INVALID_ARG_TYPE` |
| Sai file import | `ERR_MODULE_NOT_FOUND` / `ERR_UNKNOWN_FILE_EXTENSION` |
| `require` ESM | `ERR_REQUIRE_ESM` |
| Nhiều task lỗi | `AggregateError` / `allSettled` |
| Body + dispose lỗi | `SuppressedError` |
| Hủy | `AbortError` / `ABORT_ERR` — đừng log như crash |
| `fetch` 404 | `res.status` — không throw |
| `fetch` mạng | `TypeError` + `cause` |
| Promise quên catch | sửa nguồn; handler global chỉ safety net |
| Capture callback đã set | `ERR_UNCAUGHT_EXCEPTION_CAPTURE_ALREADY_SET` |
| `JSON.stringify(Error)` | `{}` — serializer riêng |
| Lỗi mong đợi ở biên | Result / union |
| Lỗi bất thường | `throw` + cause + log 1 lần + (service) exit nếu fatal |
| Worker throw | `'error'` trên Worker, không main uncaught |

| API | Việc |
|-----|------|
| `new Error(msg, { cause })` | wrap ES2022+ |
| `AggregateError` | gom nhiều lỗi |
| `err.code` | nhận diện ổn định |
| `Error.captureStackTrace` | cắt constructor khỏi stack |
| `Error.stackTraceLimit` | độ sâu stack |
| `util.getSystemErrorName` / `Map` / `Message` | `errno` ↔ tên |
| `assert.rejects(..., { code })` | test async lỗi |
| `AbortSignal` / `isAbortError` | hủy hợp tác |
| `process.on("unhandledRejection")` | safety net → shutdown |
| `util.types.isNativeError` | Error cross-realm hơn `instanceof` |

---

## 24. Version matrix

| Version / nền | Liên quan error |
|---------------|-----------------|
| ES2022 / ~Node 16.9+ | `Error` option `cause`; `ErrorOptions` |
| ES2021 / rộng rãi | `AggregateError` (cũng từ `Promise.any`) |
| V8 / Node (lâu) | `captureStackTrace`, `stackTraceLimit`, `prepareStackTrace` |
| Node (lâu) | `SystemError` fields, `ERR_*`, `util.getSystemErrorName` |
| Node 15+ | unhandled rejection ngày càng “strict” hơn theo mặc định/flag |
| Node 18+ / hiện đại | `AbortSignal.timeout`, `throwIfAborted`, `AbortSignal.any` |
| Node 22.12+ / 23.1+ | `util.getSystemErrorMessage` |
| Explicit Resource Management | `using`, `Symbol.dispose`, `SuppressedError` |
| Node 26 (baseline) | `cause`, AggregateError, Abort/`DOMException`, catalog `ERR_*`, `fetch` Undici, strip `.ts` |
| TypeScript 4.4+ / 7 | `catch` → `unknown` dưới strict / `useUnknownInCatchVariables` |
| `domain` | historical — không dùng |

---

## 25. Tài liệu liên quan

- [Lập trình bất đồng bộ](async.md) — Promise combinators, `AbortSignal`, anti-pattern
- [AbortSignal & request context](abort-context.md) — hủy, `AsyncLocalStorage`
- [Event loop & concurrency model](event-loop.md) — microtask rejection timing
- [Function type, Callback & Lambda](functions-callbacks.md) — callback `(err, value)`
- [Hàm & Method](functions-methods.md) — `using`, `this`
- [Statements](statements.md) — `try`/`finally`, ERM
- [Node.js built-ins](nodejs-apis.md) — `process` events, fs/net errors
- [Worker Threads](threading.md) — `error` / `messageerror` / `exit`
- [Hệ thống kiểu](typesystem.md) — `unknown` trong `catch`
- [OOP](oop.md) — `instanceof`, custom class
- [Keywords](keywords.md) — `throw` / `try` / `using`

---

- [Testing runtime/async](testing.md)
- [Stack, report & log](diagnostics.md)
