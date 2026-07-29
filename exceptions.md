# Exception / Error trong JavaScript, TypeScript & Node.js

Xử lý lỗi đúng cách: **không nuốt lỗi**, phân biệt lỗi vận hành vs bug, luôn `throw` `Error` (có `cause`), biết catalog `SystemError` / `ERR_*`, và xử lý an toàn `unhandledRejection` / `uncaughtException` trên Node.

Baseline: **Node.js 26**, **TypeScript 7**, ESM.

---

## Mục lục

1. [Tổng quan & triết lý](#1-tổng-quan--triết-lý)
2. [Hệ phân cấp Error & SystemError](#2-hệ-phân-cấp-error--systemerror)
3. [Custom errors](#3-custom-errors)
4. [AggregateError & cây lỗi](#4-aggregateerror--cây-lỗi)
5. [`try` / `catch` / `finally`](#5-try--catch--finally)
6. [Rethrow & `cause`](#6-rethrow--cause)
7. [Async: rejection & Promise combinators](#7-async-rejection--promise-combinators)
8. [`unhandledRejection` / `uncaughtException` / `rejectionHandled`](#8-unhandledrejection--uncaughtexception--rejectionhandled)
9. [Result / union vs `throw`](#9-result--union-vs-throw)
10. [Never swallow & log một lần ở biên](#10-never-swallow--log-một-lần-ở-biên)
11. [Node error codes & `util.getSystemErrorName`](#11-node-error-codes--utilgetsystemerrorname)
12. [Testing errors](#12-testing-errors)
13. [Khi nào KHÔNG dùng `throw`](#13-khi-nào-không-dùng-throw)
14. [AbortError / `DOMException` aborted](#14-aborterror--domexception-aborted)
15. [Best practices & checklist](#15-best-practices--checklist)

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

### 1.2 Luôn throw `Error` (hoặc subclass)

Mọi giá trị đều `throw` được; **luôn throw `Error`** để có `name`, `message`, `stack`, và (ES2022+) `cause`.

```ts
throw new Error("boom");
throw new TypeError("expected string");
// Tránh: throw "boom"; throw 404; throw { code: 1 };
```

> **Pitfall:** `throw 404` / `throw "fail"` → `catch` nhận primitive, mất stack; `instanceof Error` thất bại; logger structured khó chuẩn hóa.

Trong TypeScript hiện đại, `catch (e)` mặc định là `unknown` — phải thu hẹp trước khi đọc field.

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
├─ DOMException       // web platform (AbortError, …) — Node cũng có
└─ (Node) SystemError // err.code: ENOENT, EADDRINUSE, … + errno
```

Ngoài ra Node có lỗi nội bộ với `code` dạng `ERR_*` (thường kèm `TypeError` / `Error` / `RangeError`), và `assert.AssertionError`.

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
| `cause` | nguyên nhân gốc; chuỗi wrap |
| `code` | (Node / custom) mã ổn định: `ENOENT`, `ERR_INVALID_ARG_TYPE`, `NOT_FOUND` |

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

| `code` | Tình huống điển hình |
|--------|----------------------|
| `ENOENT` | path / file không tồn tại |
| `EACCES` / `EPERM` | không đủ quyền |
| `EEXIST` | tạo khi đã tồn tại (`O_EXCL`) |
| `EISDIR` / `ENOTDIR` | kỳ vọng file vs thư mục sai |
| `EMFILE` / `ENFILE` | hết fd / file table |
| `EADDRINUSE` | `listen` cổng / address đã bị chiếm |
| `EADDRNOTAVAIL` | address không gán được trên máy |
| `ECONNREFUSED` | peer từ chối (service chưa lên) |
| `ECONNRESET` | peer đóng / reset giữa chừng |
| `ECONNABORTED` | kết nối bị abort phía local |
| `EPIPE` | ghi vào pipe/socket đã đóng |
| `ETIMEDOUT` | connect/send hết hạn chờ |
| `ENOTFOUND` | DNS lookup thất bại (`getaddrinfo`) |
| `EAI_AGAIN` | DNS tạm thời lỗi — thường retry được |

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
```

---

## 3. Custom errors

### 3.1 Class chuẩn với `name`, `code`, `ErrorOptions`

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

### 3.2 Gợi ý thiết kế

- Đặt `name` rõ — filter log / APM theo tên class.
- Thêm `code` **ổn định** cho máy đọc (API JSON, CLI). Đổi `message` được; đổi `code` là breaking.
- Không nhồi PII / secret vào `message` hoặc `cause` nếu log ra ngoài.
- Dùng `cause` thay vì invent `innerException` trừ khi tương thích cũ.
- Export ít loại: opaque mặc định; typed chỉ khi caller **thật sự** rẽ nhánh.

### 3.3 Prototype / `instanceof` notes

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

---

## 4. AggregateError & cây lỗi

### 4.1 `AggregateError`

```ts
const ag = new AggregateError(
  [new Error("a"), new Error("b")],
  "multiple failures",
);
console.log(ag.name);          // "AggregateError"
console.log(ag.errors.length); // 2
```

Xuất hiện khi: `Promise.any` (tất cả reject); tự gom validation / batch / shutdown nhiều resource.

```ts
const results = await Promise.allSettled(tasks);
const errors = results
  .filter((r): r is PromiseRejectedResult => r.status === "rejected")
  .map((r) => r.reason);

if (errors.length) {
  throw new AggregateError(errors, `${errors.length} tasks failed`);
}
```

### 4.2 Duyệt `error.errors` và cây `cause`

Một lỗi có thể wrap **một** nguyên nhân qua `cause`, gom **nhiều** qua `AggregateError.errors`, hoặc lồng cả hai.

```ts
function* walkErrors(e: unknown, seen = new Set<unknown>()): Generator<unknown> {
  if (e == null || seen.has(e)) return;
  seen.add(e);
  yield e;

  if (e instanceof AggregateError) {
    for (const child of e.errors) yield* walkErrors(child, seen);
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
```

> **Pitfall:** vòng `cause` tự tham chiếu → luôn dùng `Set` khi duyệt. Thứ tự nên **pre-order**: bản thân → `errors[]` → `cause`.

---

## 5. `try` / `catch` / `finally`

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

### 5.1 Thu hẹp `unknown` trong `catch`

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

### 5.2 `finally` & `return` / `throw`

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

> **Pitfall:** `return` trong `finally` **ghi đè** completion của `try`/`catch`, kể cả khi đang có exception. Chỉ dùng `finally` cho cleanup side-effect.

### 5.3 Phạm vi `try` hẹp

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

---

## 6. Rethrow & `cause`

### 6.1 Rethrow nguyên gốc

Khi tầng hiện tại không thêm ngữ cảnh — chỉ metric / side-effect:

```ts
try {
  await save(user);
} catch (e) {
  metrics.increment("save_fail");
  throw e; // giữ stack / identity / code
}
```

### 6.2 Wrap với `cause` (khuyến nghị khi thêm context)

```ts
try {
  await save(user);
} catch (e) {
  throw new Error(`failed to save user ${user.id}`, { cause: e });
}
```

Mỗi tầng thêm **ngữ cảnh mới** (operation, id, path) — không lặp `"failed: failed: failed"`.

### 6.3 `formatErr` — in chuỗi cause

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
  if (e.cause !== undefined) {
    parts.push(`${pad}Caused by: ${formatErr(e.cause, depth + 1).trimStart()}`);
  }
  return parts.join("\n");
}
```

`util.inspect(err)` trên Node cũng recursively hiện `[cause]` — tiện debug REPL.

### 6.4 Đừng mất stack / identity

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

---

## 7. Async: rejection & Promise combinators

### 7.1 `async`/`await` và rejection

```ts
async function load() {
  const res = await fetch("https://example.com");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

### 7.2 Floating promises

```ts
// Xấu
load();

// Chủ đích fire-and-forget CÓ xử lý lỗi
void load().catch((e) => logger.error("load failed", { err: e }));
```

Bật `@typescript-eslint/no-floating-promises` để CI bắt sớm.

### 7.3 Combinators vs lỗi

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

### 7.4 Anti-pattern: `new Promise(async …)`

```ts
// Xấu: reject bên trong dễ thành unhandled nếu thiếu try/catch
new Promise(async (resolve, reject) => {
  const x = await f();
  resolve(x);
});
```

Viết `async function` rồi gọi trực tiếp; Promise constructor chỉ cho wrapping callback-style.

---

## 8. `unhandledRejection` / `uncaughtException` / `rejectionHandled`

### 8.1 `unhandledRejection`

Promise reject mà **không** có handler:

```ts
process.on("unhandledRejection", (reason, promise) => {
  console.error("unhandledRejection", reason, promise);
});
```

Node hiện đại coi unhandled rejection nghiêm trọng. **Đừng** dùng handler toàn cục để “sửa” logic — sửa tại nguồn (`await` / `.catch`).

### 8.2 `uncaughtException`

```ts
process.on("uncaughtException", (err, origin) => {
  console.error("uncaughtException", origin, err);
});
```

Sau sự kiện này, **trạng thái process có thể không tin cậy** (invariants, locks, half-written state).

### 8.3 Fatal shutdown pattern (khuyến nghị service)

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

### 8.4 `rejectionHandled`

```ts
process.on("rejectionHandled", (promise) => {
  console.warn("rejectionHandled late", promise);
});
```

Reject được gắn `.catch` **muộn** (sau `unhandledRejection`) — tín hiệu race / quên `await`. Dùng để debug, không phải recovery. Debug thêm: `--trace-uncaught`, inspector.

---

## 9. Result / union vs `throw`

### 9.1 Khi nào `throw`

- Bug / invariant vỡ (`assert`).
- Không thể tiếp tục theo hợp đồng hàm (I/O fail mà caller phải biết).
- Thư viện fail-fast; caller chủ động `try/catch`.

### 9.2 Khi nào Result / discriminated union

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

### 9.3 Nhất quán biên API

| Tầng | Chiến lược gợi ý |
|------|------------------|
| Domain / use-case | union cho nhánh nghiệp vụ; throw cho invariant |
| Infrastructure (fs, db) | thường throw / reject; map ở biên |
| HTTP handler | bắt mọi thứ → status + body; log 1 lần |
| Library công khai | document rõ: throw gì / trả gì; đừng trộn |

Tránh: cùng một lớp lỗi đôi khi `throw`, đôi khi `null`, đôi khi `{ error }`.

---

## 10. Never swallow & log một lần ở biên

### 10.1 Nuốt lỗi

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

### 10.2 Log một lần ở biên — structured keys

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

---

## 11. Node error codes & `util.getSystemErrorName`

### 11.1 Hai họ mã

| Họ | Dạng | Ví dụ | Cách nhận diện |
|----|------|-------|----------------|
| System / errno | `E*` | `ENOENT`, `EADDRINUSE` | `err.code` (+ `errno`/`syscall`) |
| Node nội bộ | `ERR_*` | `ERR_INVALID_ARG_TYPE` | `err.code` |
| Web abort | `ABORT_ERR` / name `AbortError` | hủy `AbortSignal` | `DOMException` / name — §14 |

**Đừng parse `message`.** Message Node có thể đổi; `code` mới là hợp đồng.

### 11.2 `util.getSystemErrorName` / `Map` / `Message`

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
| `util.getSystemErrorMap()` | `Map<number, string>` toàn bộ |

Thực tế app thường đọc `err.code === "ENOENT"`; helper trên hữu ích khi chỉ có số `errno`.

### 11.3 `ERR_*` thường gặp (catalog rút gọn)

| `code` | Ý nghĩa ngắn |
|--------|----------------|
| `ERR_INVALID_ARG_TYPE` | sai kiểu đối số (rất hay gặp) |
| `ERR_INVALID_ARG_VALUE` | đúng kiểu nhưng giá trị không hợp lệ |
| `ERR_INVALID_URL` | `new URL` / parse URL fail |
| `ERR_INVALID_URL_SCHEME` | scheme không được hỗ trợ |
| `ERR_MODULE_NOT_FOUND` | resolve module thất bại |
| `ERR_REQUIRE_ESM` | `require()` ESM thuần không được |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | subpath không nằm trong `exports` |
| `ERR_STREAM_DESTROYED` | thao tác trên stream đã destroy |
| `ERR_STREAM_PREMATURE_CLOSE` | stream đóng sớm khi còn kỳ vọng data |
| `ERR_SERVER_ALREADY_LISTEN` | `listen` lần hai |
| `ERR_SERVER_NOT_RUNNING` | method khi server chưa chạy |
| `ERR_SOCKET_CLOSED` | socket đã đóng |
| `ERR_HTTP_HEADERS_SENT` | ghi header sau khi đã gửi |
| `ERR_OUT_OF_RANGE` | số / độ dài ngoài khoảng |
| `ERR_UNHANDLED_ERROR` | `EventEmitter` emit `'error'` không listener |
| `ABORT_ERR` | aborted — tương thích web `AbortError` |

```ts
function readCode(e: unknown): string | undefined {
  if (typeof e === "object" && e && "code" in e) {
    const c = (e as { code: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
}
```

`EventEmitter` không có listener `'error'` → có thể crash với `ERR_UNHANDLED_ERROR`. **Luôn** `.on("error", …)` cho stream/socket, hoặc dùng API promise (`once`, `stream/promises`).

---

## 12. Testing errors

### 12.1 Nguyên tắc: đừng assert message string

`message` đổi khi thêm wrap → test giòn. Assert **`code`**, **`instanceof`**, **`cause`**, hoặc predicate.

### 12.2 Đồng bộ: `assert.throws`

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

### 12.3 Async: `assert.rejects` + `cause`

```ts
import assert from "node:assert/strict";
import { it } from "node:test";

it("readConfig maps ENOENT", async () => {
  await assert.rejects(
    () => readConfig("no-such-file.json"),
    (e: unknown) => e instanceof NotFoundError && e.code === "NOT_FOUND",
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

### 12.4 `AggregateError` & table-driven

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

---

## 13. Khi nào KHÔNG dùng `throw`

| Dùng giá trị / Result / union | Dùng `throw` / reject |
|------------------------------|------------------------|
| Validation input user (form, CLI arg thường sai) | Bug / invariant nội bộ vỡ |
| “Not found” là nhánh business (404) | Không thể tiếp tục I/O theo hợp đồng |
| Parse mềm ở biên API → 400 | Thư viện fail-fast đã document |
| Control flow thường xuyên trên hot path | Hiếm, bất thường |
| Hủy có chủ đích → AbortError (§14), thường **không** log như failure | Không recover nửa vời sau programmer error |

| Tránh | Lý do |
|-------|-------|
| `throw` mọi 404 rồi `catch` ở mọi call site | ồn ào, khó đọc kiểu |
| Result cho mọi bug (`ok: false` khi null deref) | che programmer error |
| `throw "string"` / status code số | mất stack & chuẩn hóa |
| Dùng exception làm `goto` lồng sâu | khó theo dõi |

> **Tóm lại:** throw cho **bất thường theo hợp đồng hàm**; Result/union cho **nhánh mong đợi**; Abort cho **hủy**.

---

## 14. AbortError / `DOMException` aborted

### 14.1 Hủy ≠ lỗi vận hành thông thường

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

### 14.2 `signal` + timeout

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

### 14.3 Logging & fatal handlers

| Tình huống | Nên |
|------------|-----|
| User hủy request | không tính lỗi server; tránh `unhandledRejection` |
| Timeout chủ đích | map 504 / retry; log warn nếu cần |
| Abort rồi wrap `{ cause }` | giữ `isAbortError(cause)` để biên không thành 500 |
| Abort trong worker nền | vẫn phải `.catch` |

> **Pitfall:** chỉ check `signal.aborted` sau khi nuốt mọi lỗi → có thể nuốt lỗi thật khi race. Check `isAbortError(e) \|\| signal.aborted` rồi **rethrow** nhánh còn lại.

---

## 15. Best practices & checklist

1. **Luôn throw `Error` (subclass)** — không primitive / plain object.
2. Phân biệt **operational vs programmer**; đừng recover qua loa sau bug.
3. Nhận diện bằng **`code` / `instanceof` / type guard**, không so `message`.
4. Wrap với **`{ cause }`** khi thêm ngữ cảnh; rethrow nguyên gốc khi không thêm gì.
5. **`catch (e: unknown)`** rồi thu hẹp; đừng `any`.
6. Không `return`/`throw` trong **`finally`** — chỉ cleanup.
7. Không để **floating promise**; bật lint; `void p.catch(…)`.
8. Global `uncaughtException` / `unhandledRejection` = **fatal shutdown**, không business recovery.
9. **Log một lần** ở biên với key thống nhất (`err`, `errCode`, `op`, `reqId`).
10. Test bằng **`assert.rejects` / predicate / `code` / `cause`**, không assert chuỗi message.

### Checklist call site

```text
□ throw Error/subclass, có message hữu ích
□ lỗi máy đọc dùng code ổn định (ENOENT / ERR_* / NOT_FOUND)
□ wrap có cause; không String(e) rồi mất gốc
□ catch unknown + thu hẹp; không empty catch im lặng
□ finally không return/throw
□ await hoặc .catch mọi Promise
□ AbortError tách khỏi failure path / 5xx
□ biên HTTP/CLI: log 1 lần + map status
□ unhandledRejection/uncaughtException → shutdown có trật tự
□ test assert code/cause/instanceof, không assert message
```

### Cheat sheet

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
```

| Tình huống | Hướng xử lý |
|---|---|
| JSON sai | `SyntaxError` → validation / 400 |
| File thiếu | `code === "ENOENT"` |
| Cổng bận | `EADDRINUSE` |
| Peer reset / timeout | `ECONNRESET` / `ETIMEDOUT` — cân nhắc retry |
| Sai đối số Node API | `ERR_INVALID_ARG_TYPE` |
| Nhiều task lỗi | `AggregateError` / `allSettled` |
| Hủy | `AbortError` / `ABORT_ERR` — đừng log như crash |
| Promise quên catch | sửa nguồn; handler global chỉ safety net |
| Lỗi mong đợi ở biên | Result / union |
| Lỗi bất thường | `throw` + cause + log 1 lần + (service) exit nếu fatal |

| API | Việc |
|-----|------|
| `new Error(msg, { cause })` | wrap ES2022+ |
| `AggregateError` | gom nhiều lỗi |
| `err.code` | nhận diện ổn định |
| `util.getSystemErrorName` | `errno` → `ENOENT` |
| `assert.rejects` | test async lỗi |
| `AbortSignal` / `isAbortError` | hủy hợp tác |
| `process.on("unhandledRejection")` | safety net → shutdown |

### Tính năng theo phiên bản

| Version / nền | Liên quan error |
|---------------|-----------------|
| ES2022 / ~Node 16.9+ | `Error` option `cause`; `ErrorOptions` |
| ES2021 / rộng rãi | `AggregateError` (cũng từ `Promise.any`) |
| Node (lâu) | `SystemError` fields, `ERR_*`, `util.getSystemErrorName` |
| Node 15+ | unhandled rejection ngày càng “strict” hơn theo mặc định/flag |
| Node 22.12+ / 23.1+ | `util.getSystemErrorMessage` |
| Node 18+ / hiện đại | `AbortSignal.timeout`, `throwIfAborted`, `AbortSignal.any` |
| Node 26 (baseline) | đầy đủ `cause`, AggregateError, Abort/`DOMException`, catalog `ERR_*` |
| TypeScript 4.4+ / 7 | `catch` → `unknown` dưới strict / `useUnknownInCatchVariables` |

---

## Tài liệu liên quan

- [Lập trình bất đồng bộ](async.md) — Promise combinators, `AbortSignal`, anti-pattern
- [Event loop & concurrency model](event-loop.md) — microtask rejection timing
- [Function type, Callback & Lambda](functions-callbacks.md) — callback `(err, value)`
- [Hàm & Method](functions-methods.md)
- [Node.js built-ins](nodejs-apis.md) — `process` events, fs/net errors
- [Node 26 & TypeScript 7 highlights](node26-ts7.md)
