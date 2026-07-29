# Lập trình bất đồng bộ

*(Callbacks, Promises, async/await, AbortSignal, promisify)*

Baseline: **Node.js 26**, **TypeScript 7**, ESM-first. Async hiện đại = **Promise + async/await + AbortSignal**; callback kiểu Node `(err, value)` vẫn gặp ở API cũ.

---

## Mục lục

- [Lập trình bất đồng bộ](#lập-trình-bất-đồng-bộ)
  - [Mục lục](#mục-lục)
  - [1. Từ callback → Promise → async/await](#1-từ-callback--promise--asyncawait)
    - [1.1 Callback style (Node)](#11-callback-style-node)
    - [1.2 Promise](#12-promise)
    - [1.3 async/await](#13-asyncawait)
  - [2. Tạo \& chuyển đổi Promise](#2-tạo--chuyển-đổi-promise)
  - [3. Kết hợp nhiều Promise](#3-kết-hợp-nhiều-promise)
    - [3.1 `Promise.all`](#31-promiseall)
    - [3.2 `Promise.allSettled`](#32-promiseallsettled)
    - [3.3 `Promise.race`](#33-promiserace)
    - [3.4 `Promise.any`](#34-promiseany)
  - [4. Lỗi \& anti-pattern](#4-lỗi--anti-pattern)
  - [5. `AbortController` / `AbortSignal`](#5-abortcontroller--abortsignal)
  - [6. `util.promisify`](#6-utilpromisify)
  - [7. `node:stream/promises` (tóm tắt)](#7-nodestreampromises-tóm-tắt)
  - [8. Top-level await](#8-top-level-await)
  - [9. Best practices](#9-best-practices)

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

Vấn đề: lồng callback (“callback hell”), khó `try/catch` tuần tự, dễ quên xử lý `err`.

### 1.2 Promise

```ts
import fs from "node:fs/promises";

fs.readFile("a.txt", "utf8")
  .then((data) => console.log(data))
  .catch((err) => console.error(err))
  .finally(() => console.log("done"));
```

Promise trạng thái: **pending** → **fulfilled** | **rejected** (settled một lần).

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

- `async function` luôn trả về **Promise**.
- `await` dừng **hàm async** (không block event loop) đến khi Promise settle.
- Exception trong async function → Promise reject.

---

## 2. Tạo & chuyển đổi Promise

```ts
const p = new Promise<number>((resolve, reject) => {
  setTimeout(() => resolve(42), 100);
});

const done = Promise.resolve(1);
const fail = Promise.reject(new Error("boom")); // luôn gắn .catch nếu không await
```

Wrap API callback:

```ts
function readFileP(path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    import("node:fs").then((fs) => {
      fs.readFile(path, (err, data) => (err ? reject(err) : resolve(data)));
    });
  });
}
```

Thường dùng sẵn `node:fs/promises` hoặc `util.promisify` thay vì tự wrap.

---

## 3. Kết hợp nhiều Promise

### 3.1 `Promise.all`

Song song; **fail-fast** nếu một reject:

```ts
const [a, b] = await Promise.all([
  fetch("https://example.com/a").then((r) => r.text()),
  fetch("https://example.com/b").then((r) => r.text()),
]);
```

Dùng khi mọi nhánh đều cần thành công.

### 3.2 `Promise.allSettled`

Chờ tất cả settle; không throw vì một nhánh fail:

```ts
const results = await Promise.allSettled([p1, p2, p3]);
for (const r of results) {
  if (r.status === "fulfilled") console.log(r.value);
  else console.error(r.reason);
}
```

Phù hợp fan-out báo cáo / cleanup nhiều việc độc lập.

### 3.3 `Promise.race`

Settle theo Promise **nhanh nhất** (fulfill hoặc reject):

```ts
import { setTimeout as sleep } from "node:timers/promises";

const result = await Promise.race([
  doWork(),
  sleep(5_000).then(() => {
    throw new Error("timeout");
  }),
]);
```

Lưu ý: nhánh thua **không** tự hủy — cần `AbortSignal` nếu muốn cancel thật.

### 3.4 `Promise.any`

Fulfill theo Promise **thành công đầu tiên**; chỉ reject khi **tất cả** reject (`AggregateError`):

```ts
const data = await Promise.any([
  mirror1.fetch(),
  mirror2.fetch(),
  mirror3.fetch(),
]);
```

---

## 4. Lỗi & anti-pattern

```ts
// ❌ nuốt lỗi
async function bad() {
  await mightFail(); // thiếu try/catch ở caller → unhandled rejection nếu không await
}

// ❌ quên await
async function oops() {
  mightFail(); // fire-and-forget; lỗi dễ thành unhandled
}

// ❌ Promise constructor anti-pattern
new Promise(async (resolve, reject) => {
  const x = await f(); // lỗi await có thể không vào reject như bạn nghĩ
  resolve(x);
});
```

Unhandled rejection: Node có thể log và (tùy phiên bản/cờ) làm phức tạp shutdown — luôn `await` hoặc `.catch()`.

Song song có kiểm soát:

```ts
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return out;
}
```

---

## 5. `AbortController` / `AbortSignal`

Chuẩn hủy hợp tác (giống hướng `CancellationToken` trong C# về ý tưởng):

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

Truyền xuống API Node hỗ trợ `signal`:

```ts
import fs from "node:fs/promises";

await fs.readFile("big.bin", { signal: ac.signal });
```

Tạo timeout signal nhanh:

```ts
const signal = AbortSignal.timeout(5_000);
await fetch(url, { signal });
```

Gộp nhiều signal (Node / nền tảng mới):

```ts
const signal = AbortSignal.any([userSignal, AbortSignal.timeout(10_000)]);
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

---

## 6. `util.promisify`

Đổi hàm callback kiểu Node `(err, result)` thành Promise:

```ts
import { promisify } from "node:util";
import fs from "node:fs";

const readFile = promisify(fs.readFile);
const buf = await readFile("a.txt");
```

Yêu cầu: callback **error-first**. Một số hàm có overload đặc biệt — kiểm tra docs; ưu tiên sẵn `*/promises` nếu có.

`promisify` + TypeScript: có thể cần overload types; `@types/node` hỗ trợ nhiều trường hợp.

Ngược lại (hiếm): `util.callbackify` cho API đòi callback.

---

## 7. `node:stream/promises` (tóm tắt)

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

- `pipeline` gắn error handling / destroy đúng cách hơn `.pipe()` thủ công.
- `finished(stream)` — Promise khi stream kết thúc.
- Kết hợp AbortSignal khi API cho phép để hủy giữa chừng.

Web Streams / `fetch` body cũng Promise-friendly; xem [nodejs-apis.md](nodejs-apis.md).

---

## 8. Top-level await

Trong **ESM** (`.mjs` hoặc `"type":"module"`):

```ts
// boot.ts
const config = await Bun /* hoặc */ (await import("./load-config.js")).load();
export const app = createApp(config);
```

(Ví dụ thực tế không phụ thuộc Bun:)

```ts
const config = await import("./config.js").then((m) => m.load());
export { config };
```

Hệ quả:

- Module graph chờ TLA → chậm cold start nếu lạm dụng.
- CJS không có TLA; entry CJS phải bọc `async function main()`.

```ts
// entry hợp lệ cả hai thế giới
async function main() {
  await boot();
}
main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

---

## 9. Best practices

- Ưu tiên `async/await` + `try/catch`; dùng `.then` khi chain ngắn hoặc transform thuần.
- Song song: `Promise.all` / pool có giới hạn — tránh storm hàng nghìn request.
- Cancel thật sự → `AbortSignal`, không chỉ `Promise.race` timeout.
- Không block event loop trong `async` function (CPU nặng / `*Sync`).
- Luôn xử lý rejection trên Promise “bỏ rơi”.
- API mới: Promise + `signal`; API cũ: `promisify` hoặc `node:* /promises`.

**Tài liệu liên quan:** [event-loop.md](event-loop.md) · [threading.md](threading.md) · [nodejs-apis.md](nodejs-apis.md)
