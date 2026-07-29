# Exception / Error trong JavaScript, TypeScript & Node.js

Xử lý lỗi đúng cách: **không nuốt lỗi**, phân biệt lỗi vận hành vs bug, dùng `Error` có `cause`, và biết các bẫy `unhandledRejection` / `uncaughtException` trên Node.

Baseline: **Node.js 26**, **TypeScript 7**, ESM.

---

## Mục lục

1. [Tổng quan & triết lý](#1-tổng-quan--triết-lý)
2. [Hệ phân cấp Error](#2-hệ-phân-cấp-error)
3. [Custom errors & AggregateError](#3-custom-errors--aggregateerror)
4. [`try` / `catch` / `finally`](#4-try--catch--finally)
5. [Rethrow & `cause`](#5-rethrow--cause)
6. [Async: Promise rejection & async/await](#6-async-promise-rejection--asyncawait)
7. [`unhandledRejection` / `uncaughtException` (Node)](#7-unhandledrejection--uncaughtexception-node)
8. [Result-like patterns vs `throw`](#8-result-like-patterns-vs-throw)
9. [Never swallow](#9-never-swallow)
10. [Cheat sheet](#10-cheat-sheet)

---

## 1. Tổng quan & triết lý

- `throw` dùng cho **tình huống bất thường** / không thể tiếp tục thao tác hiện tại.
- Lỗi **mong đợi** ở I/O biên (file thiếu, HTTP 404, validation user): thường trả về kiểu có phân biệt (Result, `null`, union) **hoặc** throw có chủ đích tùy tầng API — nhưng **nhất quán**.
- Mọi giá trị đều `throw` được; **luôn throw `Error` (hoặc subclass)** để có stack + message.
- Trong TS, `catch (e)` mặc định là `unknown` (với config hiện đại) — phải thu hẹp trước khi dùng.

```ts
throw new Error("boom");
throw new TypeError("expected string");
// Tránh: throw "boom"; throw 404;
```

---

## 2. Hệ phân cấp Error

```
Error
├─ TypeError          // sai kiểu / thao tác không hợp lệ trên giá trị
├─ RangeError         // số ngoài khoảng
├─ SyntaxError        // parse (JSON.parse, eval, …)
├─ ReferenceError     // biến không tồn tại
├─ URIError           // encodeURI/decodeURI
├─ EvalError          // di sản, hiếm
├─ AggregateError     // nhóm nhiều lỗi (Promise.any, …)
└─ (Node) SystemError // err.code: ENOENT, EADDRINUSE, …
```

### 2.1 Thuộc tính quan trọng

```ts
const err = new Error("fail");
err.name;       // "Error"
err.message;    // "fail"
err.stack;      // stack string (engine-dependent)
err.cause;      // lỗi gốc (ES2022+)
```

Node `SystemError` / nhiều errno-style:

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

### 2.2 `instanceof` & cross-realm

```ts
function isError(e: unknown): e is Error {
  return e instanceof Error;
}
```

Lưu ý: lỗi từ **vm / worker / iframe** khác realm có thể làm `instanceof Error` thất bại. Fallback:

```ts
function isErrorLike(e: unknown): e is { message: string; name?: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  );
}
```

---

## 3. Custom errors & AggregateError

### 3.1 Custom error class

```ts
class AppError extends Error {
  readonly code: string;

  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
    // khôi phục prototype chain khi target ES5 (ít cần với Node 26 + modern TS)
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

Gợi ý thiết kế:

- Đặt `name` rõ (dễ log/filter).
- Thêm `code` ổn định cho máy đọc (API/CLI).
- Không nhồi PII / secret vào `message`.
- Dùng `cause` thay vì tự invent `innerException` trừ khi cần tương thích cũ.

### 3.2 `AggregateError`

```ts
const ag = new AggregateError(
  [new Error("a"), new Error("b")],
  "multiple failures",
);

console.log(ag.errors.length); // 2
```

Xuất hiện khi:

- `Promise.any` — tất cả reject → `AggregateError`.
- Tự gom lỗi validation / batch jobs.

```ts
const results = await Promise.allSettled(tasks);
const errors = results
  .filter((r): r is PromiseRejectedResult => r.status === "rejected")
  .map((r) => r.reason);

if (errors.length) {
  throw new AggregateError(errors, `${errors.length} tasks failed`);
}
```

---

## 4. `try` / `catch` / `finally`

```ts
try {
  risky();
} catch (e) {
  console.error(e);
  throw e; // hoặc xử lý phục hồi
} finally {
  cleanup(); // luôn chạy (trừ khi process bị kill / abort cứng)
}
```

### 4.1 Thu hẹp kiểu trong `catch`

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

### 4.2 `finally` & return

```ts
function read(): number {
  try {
    return 1;
  } finally {
    console.log("cleanup"); // vẫn chạy trước khi return thật sự thoát
  }
}
```

Tránh `return` / `throw` trong `finally` — dễ **che** lỗi gốc hoặc giá trị return từ `try`.

### 4.3 Try quanh phạm vi nhỏ

Bắt hẹp đúng thao tác có thể lỗi; đừng bọc cả hàm 200 dòng thành một `catch` generic.

---

## 5. Rethrow & `cause`

### 5.1 Rethrow nguyên gốc

```ts
try {
  await save(user);
} catch (e) {
  metrics.increment("save_fail");
  throw e; // giữ stack / identity
}
```

### 5.2 Wrap với `cause` (khuyến nghị)

```ts
try {
  await save(user);
} catch (e) {
  throw new Error("failed to save user", { cause: e });
}
```

In log:

```ts
function formatErr(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const parts = [`${e.name}: ${e.message}`];
  if (e.cause) parts.push(`Caused by: ${formatErr(e.cause)}`);
  return parts.join("\n");
}
```

### 5.3 Đừng mất stack vô ý

```ts
catch (e) {
  // Xấu: tạo Error mới không cause / không giữ thông tin
  throw new Error(String(e));
}
```

---

## 6. Async: Promise rejection & async/await

```ts
async function load() {
  const res = await fetch("https://example.com");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

load().catch((e) => {
  console.error(e);
});
```

- `await` trên promise reject → **throw** tại dòng `await` (bắt bằng `try/catch`).
- Quên `await` / `.catch` → nguy cơ `unhandledRejection`.
- `Promise.all`: một reject → cả cụm reject (fail-fast).
- `Promise.allSettled`: luôn fulfill với trạng thái từng phần tử.
- `Promise.any`: lấy fulfill đầu; tất cả reject → `AggregateError`.

```ts
const [a, b] = await Promise.all([loadA(), loadB()]);

const settled = await Promise.allSettled([loadA(), loadB()]);
```

Floating promise (eslint hay cảnh báo):

```ts
void load().catch(console.error); // chủ đích fire-and-forget có xử lý lỗi
```

---

## 7. `unhandledRejection` / `uncaughtException` (Node)

### 7.1 `unhandledRejection`

Khi Promise reject mà **không** có handler:

```ts
process.on("unhandledRejection", (reason, promise) => {
  console.error("unhandledRejection", reason, promise);
  // Best practice: log + thoát có kiểm soát trong hầu hết service dài hơi
});
```

Node hiện đại mặc định coi unhandled rejection nghiêm trọng (hành vi theo version/flag). **Đừng phụ thuộc** vào handler toàn cục để “sửa” logic — sửa tại nguồn (thêm `catch` / `await`).

### 7.2 `uncaughtException`

Lỗi đồng bộ / throw không bắt được:

```ts
process.on("uncaughtException", (err, origin) => {
  console.error("uncaughtException", origin, err);
  // After this, process state có thể không tin cậy
});
```

**Best practices (Node):**

1. Coi `uncaughtException` là **fatal**: log (và flush), rồi **`process.exit(1)`** (hoặc để process manager restart).
2. **Không** cố “recover” và chạy tiếp như bình thường — heap/locks/invariants có thể đã hỏng.
3. `unhandledRejection`: tương tự với service production — log + shutdown có trật tự nếu rejection bất ngờ.
4. Đăng ký handler **sớm** (entry file), trước khi start server.
5. Dùng framework shutdown hook (`SIGINT`/`SIGTERM`) riêng với lỗi fatal.

```ts
function fatal(err: unknown, label: string) {
  console.error(label, err);
  process.exitCode = 1;
  // đóng server/db với timeout rồi:
  process.exit(1);
}

process.on("uncaughtException", (err) => fatal(err, "uncaughtException"));
process.on("unhandledRejection", (reason) => fatal(reason, "unhandledRejection"));
```

### 7.3 `rejectionHandled` & debug

- `rejectionHandled`: reject được gắn handler **muộn** — tín hiệu code race/async sai thứ tự.
- Chạy với `--trace-uncaught` / inspector khi điều tra.

---

## 8. Result-like patterns vs `throw`

### 8.1 Khi nào `throw`

- Bug / invariant vỡ (`assert`).
- Không thể tiếp tục (I/O thất bại mà caller tầng trên phải biết).
- Thư viện muốn fail-fast, caller dùng `try/catch`.

### 8.2 Khi nào Result / union

- Parse / validate input user (luồng thường).
- Business rule “không tìm thấy” có thể là nhánh bình thường.
- API muốn buộc caller xử lý cả hai nhánh ở kiểu.

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
if (!r.ok) {
  console.error(r.error);
} else {
  console.log(r.value);
}
```

Discriminated union đơn giản cũng đủ — không bắt buộc thư viện:

```ts
type FindUser =
  | { status: "found"; user: { id: string } }
  | { status: "missing" }
  | { status: "failed"; error: Error };
```

### 8.3 Đừng trộn loạn một API

Tránh: đôi khi `throw`, đôi khi trả `null`, đôi khi trả `{ error }` cho **cùng một lớp lỗi**. Document và giữ một chiến lược theo tầng (domain vs infrastructure).

---

## 9. Never swallow

**Nuốt lỗi** = `catch` rồi bỏ qua / return mặc định che mất tín hiệu:

```ts
// Xấu
try {
  await sendEmail(order);
} catch {
  // im lặng — ops không biết email thất bại
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
  logger.error("sendEmail failed", { orderId: order.id, err: e });
  metrics.increment("email_fail");
  // quyết định: retry queue / đánh dấu order / rethrow
  throw e;
}
```

Empty catch chỉ khi:

- Có comment **tại sao** an toàn;
- Không bỏ qua lỗi bảo mật / toàn vẹn dữ liệu;
- Thường kèm metric.

---

## 10. Cheat sheet

```ts
try {
  await work();
} catch (e: unknown) {
  throw new Error("work failed", { cause: e });
} finally {
  await close();
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
  console.error(err);
  process.exit(1);
});
```

| Tình huống | Hướng xử lý |
|---|---|
| JSON sai | `SyntaxError` → báo validation |
| File thiếu | `code === "ENOENT"` |
| Nhiều task lỗi | `AggregateError` / `allSettled` |
| Promise quên catch | sửa nguồn; handler global chỉ safety net |
| Lỗi mong đợi ở biên | Result / union |
| Lỗi bất thường | `throw` + log + (service) exit |

---

## Tài liệu liên quan

- [Function type, Callback & Lambda](functions-callbacks.md)
- [Lập trình bất đồng bộ](async.md)
- [Hàm & Method](functions-methods.md)
