# Node.js built-ins

Tham khảo thực dụng các module lõi — **survey có chiều sâu**, không phải full API dump. Mỗi hotspot đủ để chọn đúng API; chi tiết event loop / abort / async nằm ở chương chuyên biệt.

> Baseline: **Node.js 26** (V8 **14.6**, Undici **8**). Node **24** vẫn Maintenance LTS. Luôn import qua prefix **`node:`**. Highlights: [node26-ts7.md](node26-ts7.md).

---

## Mục lục

1. [Quy ước `node:` imports](#1-quy-ước-node-imports)
2. [Quyết định: sync vs promises vs streams](#2-quyết-định-sync-vs-promises-vs-streams)
3. [`fs` / `fs/promises`](#3-fs--fspromises)
4. [`path`](#4-path)
5. [`url` / `URL`](#5-url--url)
6. [`http` / `https` + `fetch`](#6-http--https--fetch)
7. [`stream` & backpressure](#7-stream--backpressure)
8. [`buffer`](#8-buffer)
9. [`crypto`](#9-crypto)
10. [`events`](#10-events)
11. [`process` / `os` / `util`](#11-process--os--util)
12. [`diagnostics_channel` & `perf_hooks`](#12-diagnostics_channel--perf_hooks)
13. [Temporal (global)](#13-temporal-global)
14. [Best practices](#14-best-practices)
15. [Checklist](#15-checklist)
16. [Cheat sheet](#16-cheat-sheet)
17. [Version notes](#17-version-notes)
18. [Tài liệu liên quan](#18-tài-liệu-liên-quan)

---

## 1. Quy ước `node:` imports

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
```

- Tránh trùng tên package npm (`fs`, `path` giả mạo).
- Subpath promises: `node:fs/promises`, `node:stream/promises`, `node:timers/promises`, `node:dns/promises`, `node:readline/promises`.

---

## 2. Quyết định: sync vs promises vs streams

| Tình huống | Chọn | Tránh |
|---|---|---|
| Đọc config nhỏ lúc boot (CLI) | `fs.readFile` promises hoặc sync **một lần** | Sync trong request handler |
| I/O trong server request | `fs/promises` + `AbortSignal` | `*Sync` trên hot path |
| File / body lớn (MB+) | `createReadStream` / Web Streams / `pipeline` | `readFile` cả cục vào RAM |
| Nhiều file nhỏ song song | `Promise.all` / pool giới hạn | Mở hàng nghìn fd cùng lúc |
| Transform từng chunk | `Transform` + `pipeline` | Buffer toàn bộ rồi xử lý |
| Chỉ path string | `path` / `URL` | Tự ghép `+ "/"` |

> Chi tiết hủy: [abort-context.md](abort-context.md). Không block event loop: [event-loop.md](event-loop.md). Pattern async: [async.md](async.md).

---

## 3. `fs` / `fs/promises`

```ts
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";

const text = await fs.readFile("notes.txt", "utf8");
await fs.writeFile("out.txt", text, "utf8");
await fs.mkdir("data", { recursive: true });
await fs.rm("tmp", { recursive: true, force: true });

const stat = await fs.stat("notes.txt");
console.log(stat.size, stat.isFile());

for await (const ent of await fs.opendir(".")) {
  console.log(ent.name);
}

const rs = createReadStream("big.bin", { highWaterMark: 64 * 1024 });
```

Hotspot:

- Ưu tiên **promises** / streams; tránh `readFileSync` trên server path.
- Nhiều API nhận `{ signal: AbortSignal }`.
- `fs.constants` cho flags; `fs.watch` khác nhau theo OS — cân nhắc `chokidar` nếu cần nhất quán cross-platform.
- `open` + `FileHandle` khi cần vị trí / nhiều thao tác trên một fd.

```ts
const fh = await fs.open("data.bin", "r");
try {
  const buf = Buffer.alloc(16);
  await fh.read(buf, 0, 16, 0);
} finally {
  await fh.close();
}
```

---

## 4. `path`

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

path.join("a", "b", "..", "c");
path.resolve(".", "src", "index.ts");
path.basename("/tmp/a.txt", ".txt"); // a
path.extname("a.tar.gz"); // .gz
path.parse("/home/u/a.txt");
```

- `path.posix` / `path.win32` khi chuẩn hóa cross-platform trong logic URL/zip.
- User input: chống path traversal — `path.resolve` + kiểm tra prefix nằm trong root cho phép.

```ts
import path from "node:path";

function safeJoin(root: string, userPath: string) {
  const resolved = path.resolve(root, userPath);
  if (!resolved.startsWith(path.resolve(root) + path.sep) && resolved !== path.resolve(root)) {
    throw new Error("path escapes root");
  }
  return resolved;
}
```

---

## 5. `url` / `URL`

```ts
import { pathToFileURL, fileURLToPath } from "node:url";

const u = new URL("https://example.com/a?q=1");
u.searchParams.set("q", "2");
console.log(u.toString());

const fileUrl = pathToFileURL("/tmp/a.txt");
const p = fileURLToPath(fileUrl);
```

Trong ESM, `import.meta.url` là file URL của module hiện tại — nền tảng cho `__dirname` tương đương.

`URL` cũng dùng cho `fetch`, redirect, canonical hóa — prefer `URL` hơn tự parse string.

---

## 6. `http` / `https` + `fetch`

### 6.1 Server (`node:http`)

```ts
import http from "node:http";

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(3000, () => {
  console.log("listening", server.address());
});
```

Framework (Fastify / Express / Hono) xây trên http — vẫn cần hiểu `req`/`res` / timeout / keep-alive khi debug.

### 6.2 Client: `fetch` (Undici 8 trên Node 26)

```ts
const res = await fetch("https://httpbin.org/json", {
  method: "GET",
  headers: { accept: "application/json" },
  signal: AbortSignal.timeout(5_000),
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = await res.json();
```

Body Web Streams:

```ts
const res = await fetch(url);
if (!res.body) throw new Error("no body");
const reader = res.body.getReader();
// hoặc: arrayBuffer() / text() / json() / bytes()
```

### 6.3 Khi nào `https.request` / Agent thấp tầng

| Nhu cầu | Chọn |
|---|---|
| Client HTTP thông thường | `fetch` |
| Timeout / cancel | `AbortSignal` (+ `fetch`) |
| mTLS / custom Agent / socket tinh chỉnh | `https` / Undici `Agent` / dispatcher |
| Server | `http.createServer` hoặc framework |

Chuyển Node ↔ Web stream:

```ts
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

const res = await fetch(url);
const nodeReadable = Readable.fromWeb(
  res.body as import("node:stream/web").ReadableStream,
);
await pipeline(nodeReadable, createWriteStream("out.bin"));
```

`Readable.toWeb` / `Writable.toWeb` / `Transform.toWeb` tương ứng.

### 6.4 Client cổ điển `https.get` (khi cần)

```ts
import https from "node:https";

await new Promise<void>((resolve, reject) => {
  https
    .get("https://example.com", (res) => {
      res.resume();
      res.on("end", () => resolve());
    })
    .on("error", reject);
});
```

Prefer `fetch` trừ khi Agent/TLS thấp tầng bắt buộc. Timeout với `https.get` thủ công dễ sai — `AbortSignal` + `fetch` rõ hơn.

### 6.5 Server timeout & keep-alive (tóm tắt)

```ts
server.requestTimeout = 30_000;
server.headersTimeout = 60_000;
server.keepAliveTimeout = 5_000;
```

Framework thường expose tương đương — biết các nút này khi debug connection treo / load balancer idle.

---

## 7. `stream` & backpressure

Ba kiểu chính: **Readable**, **Writable**, **Transform** (+ Duplex).

```ts
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";

const upper = new Transform({
  transform(chunk, _enc, cb) {
    cb(null, chunk.toString().toUpperCase());
  },
});

await pipeline(
  createReadStream("in.txt"),
  upper,
  createWriteStream("out.txt"),
);
```

### 7.1 Backpressure (ý tưởng)

- Writable trả `false` từ `write()` → dừng đẩy thêm cho tới `'drain'`.
- Readable tôn trọng `push` trả `false` / highWaterMark.
- **`pipeline` / `compose`** nối đúng, propagate lỗi, destroy stream — ưu tiên hơn `.pipe()` trần.

```ts
import { pipeline } from "node:stream/promises";

await pipeline(src, transform, dest, { signal: AbortSignal.timeout(30_000) });
```

### 7.2 Async iteration

```ts
for await (const chunk of createReadStream("in.txt")) {
  // chunk: Buffer
}
```

### 7.3 Web Streams

`ReadableStream` / `WritableStream` / `TransformStream` — `fetch` body, một số API mới. Bridge bằng `Readable.fromWeb` / `toWeb`.

### 7.4 Object mode & encoding

```ts
import { Transform } from "node:stream";

const parseLines = new Transform({
  readableObjectMode: true,
  transform(chunk, _enc, cb) {
    for (const line of chunk.toString().split("\n")) {
      if (line) this.push({ line });
    }
    cb();
  },
});
```

- `objectMode: true` — chunk là object tùy ý (không chỉ Buffer/string).
- Đặt `encoding: "utf8"` trên readable text khi phù hợp; binary giữ Buffer/`Uint8Array`.

### 7.5 Lỗi trên stream

```ts
rs.on("error", (err) => {
  console.error("read failed", err);
});
// Prefer pipeline — tự destroy + forward error
```

Listener `error` thiếu trên EventEmitter-like có thể crash process. Luôn dùng `pipeline` hoặc gắn handler có chủ đích.

Chi tiết không block loop: [event-loop.md](event-loop.md). Hủy giữa chừng: [abort-context.md](abort-context.md).

---

## 8. `buffer`

```ts
const b = Buffer.from("xin chào", "utf8");
b.toString("hex");
Buffer.concat([b, Buffer.from("!")]);
Buffer.alloc(16); // zero-fill
Buffer.allocUnsafe(16); // nhanh hơn, có thể chứa cũ — cẩn thận bảo mật
```

- `Buffer` là `Uint8Array` subclass.
- API portable / share browser: cân nhắc `Uint8Array` thuần.
- So sánh secret: `crypto.timingSafeEqual` (cùng length).

---

## 9. `crypto`

```ts
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  scrypt,
} from "node:crypto";
import { promisify } from "node:util";

createHash("sha256").update("data").digest("hex");
createHmac("sha256", secret).update(body).digest("hex");
randomUUID();
randomBytes(32);

const scryptAsync = promisify(scrypt);
const key = (await scryptAsync("password", salt, 64)) as Buffer;
```

- Password: `scrypt` / `pbkdf2` (async) — không tự invent hash nhanh.
- Web Crypto: `globalThis.crypto.subtle` (async, chuẩn web) khi share code browser.
- TLS chi tiết: `node:tls` / `https`.
- Node 26 / OpenSSL: theo dõi release notes cho raw-key / thuật toán mới (ví dụ Ed25519 context) — đọc docs đúng minor bạn chạy.

### 9.1 Web Crypto (subtle)

```ts
const key = await crypto.subtle.generateKey(
  { name: "AES-GCM", length: 256 },
  true,
  ["encrypt", "decrypt"],
);
```

Dùng khi share thuật toán với browser / chuẩn Web Crypto. Node `createHash` / `createHmac` vẫn tiện cho hash/HMAC đồng bộ kiểu pipeline stream (`hash.update(chunk)`).

### 9.2 Timing-safe compare

```ts
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
```

Độ dài khác nhau vẫn leak qua early return — cân nhắc hash rồi so sánh digest cùng length khi threat model nghiêm.

---

## 10. `events`

```ts
import { EventEmitter, once, on } from "node:events";

type BusEvents = {
  job: [id: number];
  ready: [];
};

class Bus extends EventEmitter<BusEvents> {}
const bus = new Bus();

bus.on("job", (id) => console.log(id));
bus.emit("job", 1);

const [/* ready */] = await once(bus, "ready");

for await (const [id] of on(bus, "job")) {
  console.log("job", id);
  break;
}
```

- `off` / `AbortSignal` tránh leak listener.
- `setMaxListeners` khi cảnh báo hợp lệ (không nuốt leak thật).
- Stream / `process` / Worker là EventEmitter-like — luôn có kế hoạch `error`.

---

## 11. `process` / `os` / `util`

### 11.1 `process`

```ts
process.env.NODE_ENV;
process.argv;
process.cwd();
process.exitCode = 1; // ưu tiên hơn exit() đột ngột khi có thể
process.pid;

process.on("unhandledRejection", (reason) => {
  console.error(reason);
});

process.on("SIGINT", () => {
  shutdown().finally(() => process.exit(0));
});
```

`process.nextTick` — [event-loop.md](event-loop.md). Entry / shutdown: [main-function.md](main-function.md).

### 11.2 `os`

```ts
import os from "node:os";

os.platform();
os.arch();
os.availableParallelism(); // gợi ý độ song song worker pool
os.homedir();
os.tmpdir();
```

### 11.3 `util`

```ts
import util from "node:util";

util.promisify(fn);
util.inspect(obj, { depth: 3, colors: true });
util.types.isNativeError(x);
util.types.isPromise(x);
util.styleText("green", "ok");
```

CLI nhẹ:

```ts
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: { type: "string", short: "p" },
    verbose: { type: "boolean", short: "v" },
  },
  allowPositionals: true,
});
```

---

## 12. `diagnostics_channel` & `perf_hooks`

### 12.1 `diagnostics_channel`

Kênh quan sát nội bộ / thư viện (APM nhẹ) — không phụ thuộc `console.log`:

```ts
import diagnostics_channel from "node:diagnostics_channel";

const ch = diagnostics_channel.channel("my-app:request");

if (ch.hasSubscribers) {
  ch.publish({ url: "/a", ms: 12 });
}

diagnostics_channel.subscribe("my-app:request", (message) => {
  console.log(message);
});
```

OpenTelemetry / APM có thể subscribe cùng kênh.

### 12.2 `perf_hooks` (tóm tắt)

```ts
import { performance, PerformanceObserver } from "node:perf_hooks";

const t0 = performance.now();
// ... work ...
const ms = performance.now() - t0;

performance.mark("A");
performance.mark("B");
performance.measure("AtoB", "A", "B");
```

Dùng cho benchmark nhẹ / latency span nội bộ. Tracing phân tán đầy đủ → OTel, không tự dựng lại.

### 12.3 Không nằm ở chương này

| Nhu cầu | Chương |
|---|---|
| Worker threads / `child_process` | [threading.md](threading.md) |
| Module resolution / `exports` | [modules-packages.md](modules-packages.md) |
| Hủy request / ALS | [abort-context.md](abort-context.md) |
| Microtask / phases | [event-loop.md](event-loop.md) |

---

## 13. Temporal (global)

Trên **Node 26**, **Temporal API** bật **mặc định** (global) — thay `Date` khi cần lịch / timezone / duration nghiêm:

```ts
const instant = Temporal.Now.instant();
const zdt = Temporal.Now.zonedDateTimeISO("Asia/Ho_Chi_Minh");
const plain = Temporal.PlainDate.from("2026-07-29");
const duration = Temporal.Duration.from({ hours: 2, minutes: 30 });

console.log(zdt.toString());
console.log(plain.add({ days: 7 }).toString());
console.log(instant.add(duration).toString());
```

- Không cần flag / polyfill trên Node 26.
- `Date` vẫn tồn tại (interop / legacy); code mới ưu tiên Temporal cho nghiệp vụ thời gian.
- Types: theo dõi `@types/node@^26` / lib Temporal — có thể cần ambient nếu editor chưa nhận global.

### 13.1 Temporal vs `Date` — quyết định nhanh

| Nhu cầu | Chọn |
|---|---|
| Instant UTC / monotonic wall gần đúng | `Temporal.Instant` / `Temporal.Now.instant()` |
| Lịch dân sự + timezone | `ZonedDateTime` / `PlainDate` |
| Duration / khoảng | `Temporal.Duration` |
| Interop JSON legacy / lib cũ | `Date` + chuyển đổi tường minh |
| Timestamp epoch ms cho DB cũ | `instant.epochMilliseconds` (theo API Temporal) |

```ts
const fromLegacy = Temporal.Instant.fromEpochMilliseconds(Date.now());
const back = new Date(fromLegacy.epochMilliseconds);
```

Đừng mix mutable `Date` setters với Temporal trong cùng domain model — chọn một phía cho nghiệp vụ mới.

---

## 14. Best practices

1. Luôn `node:` prefix; ưu tiên `*/promises` và `pipeline`.
2. Client HTTP: `fetch` + `AbortSignal`; server: `http` hoặc framework.
3. File lớn → stream; config nhỏ → promises.
4. Không `*Sync` trên request path.
5. Path user input → normalize + chặn `..`.
6. Secret compare → `timingSafeEqual`; password → scrypt/pbkdf2.
7. Shutdown: SIGINT/SIGTERM, đóng server, hết in-flight.
8. Observability: `diagnostics_channel` / `perf_hooks` nhẹ; OTel cho hệ thống.
9. Thời gian nghiệp vụ: Temporal trên Node 26.
10. Đọc docs đúng major (`node --version`).

---

## 15. Checklist

```text
□ import node:… ; promises subpath khi có
□ Sync chỉ boot/CLI — không hot path
□ File lớn: pipeline / for-await — không readFile full
□ fetch + signal; kiểm tra res.ok
□ pipeline thay pipe trần; có AbortSignal khi cần
□ Buffer.allocUnsafe không lộ dữ liệu nhạy cảm
□ Listener off / signal; listen error trên stream
□ path traversal đã chặn
□ engines/CI khớp Node 26 (hoặc ghi rõ dual 24)
□ Temporal cho date logic mới (baseline 26)
```

---

## 16. Cheat sheet

```ts
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createHash, randomUUID } from "node:crypto";

await fs.readFile(p, "utf8");
await pipeline(createReadStream(p), dest);
await fetch(url, { signal: AbortSignal.timeout(5_000) });
path.join(root, "a");
createHash("sha256").update(data).digest("hex");
randomUUID();
Temporal.Now.zonedDateTimeISO("UTC");
```

| Cần | Module |
|---|---|
| File I/O | `fs` / `fs/promises` |
| Path | `path` + `url` |
| HTTP client | `fetch` |
| HTTP server | `http` / framework |
| Transform I/O | `stream` + `pipeline` |
| Hash / random | `crypto` |
| Pub/sub in-process | `events` |
| Date/tz nghiêm | `Temporal` |
| Spans nhẹ | `perf_hooks` / `diagnostics_channel` |

---

## 17. Version notes

| Nền | Liên quan |
|---|---|
| Node 18+ | `fetch` ổn định dần; Web Streams |
| Node 20+ | `AbortSignal.any` rộng rãi |
| Node 22–24 | type stripping experimental → ổn định dần |
| **Node 26** | V8 **14.6**, Undici **8**, **Temporal** default, `Iterator.concat`, type stripping ổn định, gỡ `--experimental-transform-types` |
| Node 24 | Maintenance LTS song song giai đoạn chuyển |

Baseline tài liệu: **Node 26** + **TS 7** (`@types/node@^26`).

---

## 18. Tài liệu liên quan

- [Node 26 & TypeScript 7 highlights](node26-ts7.md)
- [Lập trình bất đồng bộ](async.md)
- [AbortSignal & request context](abort-context.md)
- [Event loop & concurrency model](event-loop.md)
- [Entry point & chạy chương trình](main-function.md)
- [Worker Threads & Child Process](threading.md)
- [Modules & Packages](modules-packages.md)
- [npm / pnpm / yarn & tooling](tooling.md)
- [Iterator, Iterable & “LINQ-like”](iterables-linq.md)
