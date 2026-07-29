# Node.js built-ins

*(Tham khảo thực dụng các module lõi — không phải full API dump)*

Baseline: **Node.js 26** (V8 **14.6**, Undici **8**). Node **24** vẫn Maintenance LTS. Luôn import qua prefix **`node:`**. Highlights: [node26-ts7.md](node26-ts7.md).

---

## Mục lục

- [Node.js built-ins](#nodejs-built-ins)
  - [Mục lục](#mục-lục)
  - [1. Quy ước `node:` imports](#1-quy-ước-node-imports)
  - [2. `fs` / `fs/promises`](#2-fs--fspromises)
  - [3. `path`](#3-path)
  - [4. `url`](#4-url)
  - [5. `http` / `https`](#5-http--https)
  - [6. `fetch` \& Web Streams](#6-fetch--web-streams)
  - [6b. Temporal (global)](#6b-temporal-global)
  - [7. `stream`](#7-stream)
  - [8. `buffer`](#8-buffer)
  - [9. `crypto`](#9-crypto)
  - [10. `events`](#10-events)
  - [11. `process`](#11-process)
  - [12. `os`](#12-os)
  - [13. `util`](#13-util)
  - [14. `diagnostics_channel` (tóm tắt)](#14-diagnostics_channel-tóm-tắt)
  - [15. Best practices](#15-best-practices)

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

## 2. `fs` / `fs/promises`

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

// stream cho file lớn
const rs = createReadStream("big.bin", { highWaterMark: 64 * 1024 });
```

- Ưu tiên **promises** / streams; tránh `readFileSync` trên server path.
- Nhiều API nhận `{ signal: AbortSignal }`.
- `fs.constants` cho flags; `fs.watch` khác nhau theo OS — cân nhắc `chokidar` nếu cần nhất quán.

---

## 3. `path`

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

path.join("a", "b", "..", "c"); // a/c (hoặc a\c trên Windows)
path.resolve(".", "src", "index.ts");
path.basename("/tmp/a.txt", ".txt"); // a
path.extname("a.tar.gz"); // .gz
path.parse("/home/u/a.txt");
```

- Dùng `path.posix` / `path.win32` khi cần chuẩn hóa cross-platform trong logic URL/zip.
- Ghép path user input: cẩn thận path traversal (`..`) — normalize + kiểm tra prefix.

---

## 4. `url`

```ts
import { pathToFileURL, fileURLToPath, URL } from "node:url";

const u = new URL("https://example.com/a?q=1");
u.searchParams.set("q", "2");
console.log(u.toString());

const fileUrl = pathToFileURL("/tmp/a.txt");
const p = fileURLToPath(fileUrl);
```

Trong ESM, `import.meta.url` là file URL của module hiện tại — nền tảng cho `__dirname` tương đương.

---

## 5. `http` / `https`

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

Client cổ điển:

```ts
import https from "node:https";

https.get("https://example.com", (res) => {
  res.on("data", () => {});
  res.on("end", () => {});
});
```

Thực tế mới: dùng **`fetch`** cho client HTTP trừ khi cần agent/TLS tinh chỉnh thấp tầng (`undici` options, custom `Agent`, mTLS phức tạp).

---

## 6. `fetch` & Web Streams

`fetch` là **built-in** (Undici **8** trên Node 26):

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
// hoặc: await res.arrayBuffer() / text() / json()
```

Chuyển Node stream ↔ Web stream:

```ts
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

const res = await fetch(url);
const nodeReadable = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
await pipeline(nodeReadable, createWriteStream("out.bin"));
```

`Readable.toWeb` / `Writable.toWeb` / `Transform.toWeb` tương ứng.

---

## 6b. Temporal (global)

Trên **Node 26**, **Temporal API** được **bật mặc định** (global) — thay `Date` khi cần lịch / timezone / duration nghiêm:

```ts
const instant = Temporal.Now.instant();
const zdt = Temporal.Now.zonedDateTimeISO("Asia/Ho_Chi_Minh");
const plain = Temporal.PlainDate.from("2026-07-29");
const duration = Temporal.Duration.from({ hours: 2, minutes: 30 });

console.log(zdt.toString());
console.log(plain.add({ days: 7 }).toString());
console.log(instant.add(duration).toString());
```

- Không cần flag / import polyfill trên Node 26.  
- `Date` vẫn tồn tại (interop / legacy); code mới ưu tiên Temporal cho nghiệp vụ thời gian.  
- Types: theo dõi `@types/node@^26` / lib DOM-Temporal tùy setup — có thể cần ambient nếu editor chưa nhận global.

---

## 7. `stream`

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

- Ưu tiên `pipeline` / `compose` hơn `.pipe()` trần (xử lý lỗi & destroy).
- Backpressure: đừng `push` vô hạn trong readable tùy chỉnh.
- Async iteration: `for await (const chunk of readable)`.

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
- JSON/HTTP binary: cân nhắc `Uint8Array` thuần khi viết API portable.
- So sánh timing-safe: `crypto.timingSafeEqual`.

---

## 9. `crypto`

```ts
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

createHash("sha256").update("data").digest("hex");
createHmac("sha256", secret).update(body).digest("hex");
randomUUID();
randomBytes(32);

// password hashing: scrypt / pbkdf2 (async)
import { scrypt } from "node:crypto";
import { promisify } from "node:util";
const scryptAsync = promisify(scrypt);
const key = (await scryptAsync("password", salt, 64)) as Buffer;
```

- HTTPS/TLS chi tiết nằm ở `tls` / `https`.
- Web Crypto: `globalThis.crypto.subtle` (async, chuẩn web) — hữu ích khi share code với browser.

---

## 10. `events`

```ts
import { EventEmitter, once } from "node:events";

class Bus extends EventEmitter {}
const bus = new Bus();

bus.on("job", (id: number) => console.log(id));
bus.emit("job", 1);

const [value] = await once(bus, "ready");
```

- Nhớ `off` / `AbortSignal` để tránh leak listener.
- `setMaxListeners` khi cảnh báo hợp lệ.
- `events.on(emitter, 'data')` → async iterator.

Nhiều API Node (stream, process, Worker) là EventEmitter-like.

---

## 11. `process`

```ts
process.env.NODE_ENV;
process.argv; // [node, script, ...args]
process.cwd();
process.exitCode = 1; // ưu tiên hơn exit() đột ngột khi có thể
process.pid;

process.on("uncaughtException", (err) => {
  console.error(err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error(reason);
});

await process.getBuiltinModule; // xem docs phiên bản — introspection builtins
```

Tín hiệu:

```ts
process.on("SIGINT", () => {
  shutdown().finally(() => process.exit(0));
});
```

`process.nextTick` — xem [event-loop.md](event-loop.md).

---

## 12. `os`

```ts
import os from "node:os";

os.platform(); // win32, linux, darwin
os.arch();
os.cpus().length;
os.availableParallelism(); // gợi ý độ song song
os.homedir();
os.tmpdir();
os.hostname();
os.networkInterfaces();
```

Dùng `availableParallelism()` khi sizing worker pool / cluster.

---

## 13. `util`

```ts
import util from "node:util";

util.promisify(fn);
util.inspect(obj, { depth: 3, colors: true });
util.types.isPromise(x);
util.deprecate(() => {}, "dùng API mới")();
util.styleText("green", "ok"); // tô màu terminal (phiên bản gần đây)
```

`util.parseArgs` — CLI nhẹ không cần yargs:

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

## 14. `diagnostics_channel` (tóm tắt)

Kênh quan sát nội bộ / thư viện (APM nhẹ):

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

Dùng khi viết library muốn tracing không phụ thuộc console.log; OpenTelemetry / APM có thể subscribe.

---

## 15. Best practices

- Luôn `node:` prefix; ưu tiên `*/promises` và `pipeline`.
- Client HTTP: `fetch` + `AbortSignal`; server: `node:http` hoặc framework (Fastify/Express/Hono).
- File lớn → stream, không `readFile` cả đống vào RAM.
- Shutdown: lắng SIGINT/SIGTERM, đóng server, hết request in-flight.
- Đọc docs theo đúng major Node bạn chạy (`node --version`). Baseline tài liệu: **26** (V8 14.6 / Undici 8).

**Tài liệu liên quan:** [node26-ts7.md](node26-ts7.md) · [modules-packages.md](modules-packages.md) · [async.md](async.md) · [event-loop.md](event-loop.md) · [tooling.md](tooling.md)
