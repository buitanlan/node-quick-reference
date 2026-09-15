# Node.js built-ins

Tham khảo thực dụng các module lõi — **survey có chiều sâu**, không phải full API dump. Mỗi hotspot đủ để chọn đúng API; chi tiết event loop / abort / async nằm ở chương chuyên biệt.

> **Callout:** Baseline: **Node.js 26** (V8 **14.6**, Undici **8**). Node **24** vẫn Maintenance LTS. Luôn import qua prefix **`node:`**. `http.createServer` vẫn `(req, res)` — **không** có fetch handler ổn định trên `createServer` (xem §5.6).

---

## Mục lục

1. [Quy ước `node:` imports](#1-quy-ước-node-imports)
2. [Quyết định: sync vs promises vs streams](#2-quyết-định-sync-vs-promises-vs-streams)
3. [`fs` / `fs/promises` / `FileHandle` / `using`](#3-fs--fspromises--filehandle--using)
4. [`path` vs `URL` / `fileURLToPath`](#4-path-vs-url--fileurltopath)
5. [`http` / `https` + `fetch` (Undici)](#5-http--https--fetch-undici)
6. [`stream` & backpressure](#6-stream--backpressure)
7. [`buffer` — `alloc` vs `allocUnsafe`](#7-buffer--alloc-vs-allocunsafe)
8. [`crypto` vs Web Crypto](#8-crypto-vs-web-crypto)
9. [`events` — EventEmitter vs EventTarget](#9-events--eventemitter-vs-eventtarget)
10. [`assert`](#10-assert)
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
- `node:assert/strict`, `node:util`, `node:diagnostics_channel`, `node:perf_hooks`, `node:events`.

Bare `'fs'` vẫn resolve core **nhưng** dễ shadow. Style mới: **luôn** `node:`.

---

## 2. Quyết định: sync vs promises vs streams

| Tình huống | Chọn | Tránh |
|---|---|---|
| Đọc config nhỏ lúc boot (CLI) | `fs.readFile` promises hoặc sync **một lần** | Sync trong request handler |
| I/O trong server request | `fs/promises` + `AbortSignal` | `*Sync` trên hot path |
| File / body lớn (MB+) | `createReadStream` / Web Streams / `pipeline` | `readFile` cả cục vào RAM |
| Nhiều file nhỏ song song | `Promise.all` / pool giới hạn | Mở hàng nghìn fd cùng lúc |
| Transform từng chunk | `Transform` + `pipeline` | Buffer toàn bộ rồi xử lý |
| Random access / nhiều lần trên 1 fd | `FileHandle` + `await using` | Mở/đóng mỗi lần không cần thiết |
| Chỉ path string | `path` / `URL` | Tự ghép `+ "/"` |

> Chi tiết hủy: [abort-context.md](abort-context.md). Không block event loop: [event-loop.md](event-loop.md). Pattern async: [async.md](async.md).

`*Sync` **block** thread JS — chấp nhận CLI boot, **cấm** request path. `readFile` promises vẫn đọc **cả file** vào RAM; “async” ≠ “streaming”.

---

## 3. `fs` / `fs/promises` / `FileHandle` / `using`

Ba bề mặt:

| API | Kiểu | Khi dùng |
|---|---|---|
| `node:fs/promises` | Promise, path-oriented | Đọc/ghi file vừa, mkdir, stat, rename |
| `fs.createReadStream` / `createWriteStream` | Node streams | File lớn, `pipeline`, backpressure |
| `fs.promises.open` → `FileHandle` | fd + methods | Seek, nhiều `read`/`write`, lock-ish thao tác |
| `fs` callback | `(err, value)` | Legacy; `promisify` hoặc đổi promises |

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
- `fs.constants` cho flags (`O_RDONLY`, `COPYFILE_EXCL`); `fs.watch` khác nhau theo OS (kqueue/inotify/Windows) — đôi khi double event, không recursive đều — cân nhắc `chokidar` nếu cần nhất quán cross-platform.

`fs.access` không phải “an toàn rồi `open`” (TOCTOU). `open` + bắt `ENOENT` / `EACCES`.

`fs.mkdtemp` / `mkdtemp` prefix trong `os.tmpdir()` — temp file; `rm` trong `finally` / `await using` nếu có disposable helper.

`writeFile` `{ flag: "wx" }` tạo exclusive. `rename` atomic **cùng filesystem** — đừng tin atomic xuyên disk.

`lstat` vs `stat`: symlink. Path traversal: `realpath` sau khi join.
- `open` + `FileHandle` khi cần vị trí / nhiều thao tác trên một fd.
- `copyFile` / `cp` (recursive) — `cp` giống `cp -r`; biết `errorOnExist` / `force`.
- `realpath` trước khi so prefix path (symlink escape).

### 3.1 `FileHandle` — đóng tường minh

```ts
const fh = await fs.open("data.bin", "r");
try {
  const buf = Buffer.alloc(16);
  await fh.read(buf, 0, 16, 0);
} finally {
  await fh.close();
}
```

Docs: nếu **không** `close()`, Node **cố** đóng lúc GC và emit warning — **không tin cậy**. Luôn `close` / `await using`.

`FileHandle` có `readFile` / `writeFile` / `stat` / `truncate` / `sync` / `readableWebStream()` (theo minor — đọc `fs` docs). `fh.fd` là số fd — đừng đóng fd bằng `fs.close` lẫn `fh.close`.

### 3.2 `await using` (Explicit Resource Management)

`FileHandle` implement `Symbol.asyncDispose` → gọi `close()`:

```ts
await using fh = await fs.open("data.bin", "r+");
const buf = Buffer.alloc(16);
await fh.read(buf, 0, 16, 0);
await fh.write(buf, 0, 16, 16);
// close khi rời block — kể cả throw
```

Cần `lib` có `Disposable` / target đủ mới — [statements.md](statements.md) § `using`, [tsconfig.md](tsconfig.md).

`using` sync (`Symbol.dispose`) **không** khớp `asyncDispose` — dùng **`await using`**.

Lồng:

```ts
await using a = await fs.open("a.bin", "r");
await using b = await fs.open("b.bin", "w");
await a.copyFile?.; // không có trên handle theo kiểu đó — dùng fs.copyFile path
```

(`copyFile` là `fs.copyFile(src, dest)` theo path, không phải method bắt buộc trên handle.)

### 3.3 Streams file vs `readFile`

```ts
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";

await pipeline(
  createReadStream("big.bin", { highWaterMark: 64 * 1024 }),
  createWriteStream("copy.bin"),
);
```

`readFile("big.bin")` = RAM = size file. Stream = RAM ≈ `highWaterMark` (+ overhead). Hash file lớn: `pipeline(rs, hash)` — §8.

`createReadStream` emit `'error'` nếu thiếu listener + không `pipeline` → có thể crash. **`pipeline`** bắt + destroy.

### 3.4 `opendir` / `readdir`

`readdir` với `{ withFileTypes: true }` trả `Dirent` — tránh `stat` từng file nếu chỉ cần `isDirectory()`. `opendir` + `for await` thân thiện thư mục rất lớn (không materialize mảng tên).

---

## 4. `path` vs `URL` / `fileURLToPath`

`path` thao tác **string OS**. `URL` / `fileURLToPath` cầu ESM `import.meta.url` và `fetch`. Đừng trộn URL string với `path.join`.

```ts
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Node 20.11+ / 26: import.meta.dirname / import.meta.filename

path.join("a", "b", "..", "c");
path.resolve(".", "src", "index.ts");
path.basename("/tmp/a.txt", ".txt"); // a
path.extname("a.tar.gz"); // .gz  — chỉ suffix cuối
path.parse("/home/u/a.txt");
path.relative("/a/b", "/a/b/c"); // c
```

- `path.posix` / `path.win32` khi chuẩn hóa cross-platform trong logic URL/zip (ZIP luôn `/`).
- User input: chống path traversal — `path.resolve` + kiểm tra prefix nằm trong root cho phép.
- `path.sep` vs `path.posix.sep` — so sánh string Windows dễ sai nếu mix `/` `\`.

```ts
import path from "node:path";

function safeJoin(root: string, userPath: string) {
  const resolved = path.resolve(root, userPath);
  const rootResolved = path.resolve(root);
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new Error("path escapes root");
  }
  return resolved;
}
```

`startsWith` trên Windows **lệch case** — `path.resolve` + so sánh `toLowerCase` khi `os.platform()==="win32"`, hoặc `fs.realpath` rồi so. Symlink: `realpath` **trước** check prefix.

### 4.1 `fileURLToPath` / `pathToFileURL`

```ts
import { pathToFileURL, fileURLToPath } from "node:url";

const fileUrl = pathToFileURL("/tmp/a.txt");
const p = fileURLToPath(fileUrl);

const u = new URL("https://example.com/a?q=1");
u.searchParams.set("q", "2");
console.log(u.toString());
```

| Việc | Đúng | Sai |
|---|---|---|
| Path từ module ESM | `fileURLToPath(import.meta.url)` / `import.meta.filename` | `path.join(import.meta.url, …)` |
| Worker specifier | `new URL("./w.js", import.meta.url)` | `"../w.js"` theo CWD |
| `fetch` file local | `pathToFileURL` rồi `fetch(url)` (hạn chế) | `fetch("/tmp/a")` |
| Ghép URL HTTP | `new URL(path, base)` | `path.join` |

Windows drive `C:\` → `file:///C:/…`. UNC cần `pathToFileURL` — tự ghép `file://` dễ sai.

Trong ESM, `import.meta.url` là file URL của module hiện tại — nền tảng cho `__dirname` tương đương. Chi tiết: [modules-packages.md](modules-packages.md) §12, [main-function.md](main-function.md).

`URL` cũng dùng cho `fetch`, redirect, canonical hóa — prefer `URL` hơn tự parse string.

> **Callout:** `path.extname("a.tar.gz")` là `.gz`. Parse extension kép thì tự xử lý. `path.normalize` **không** chặn `..` escape — vẫn `resolve` + prefix check.

---

## 5. `http` / `https` + `fetch` (Undici)

### 5.1 Server (`node:http`)

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

`req` = `IncomingMessage` (Readable); `res` = `ServerResponse` (Writable). `req.url` là path+query **không** gồm host — `new URL(req.url ?? "/", `http://${req.headers.host}`)`.

Framework (Fastify / Express / Hono) xây trên http — vẫn cần hiểu `req`/`res` / timeout / keep-alive khi debug.

### 5.2 Client: `fetch` (Undici 8 trên Node 26)

```ts
const res = await fetch("https://httpbin.org/json", {
  method: "GET",
  headers: { accept: "application/json" },
  signal: AbortSignal.timeout(5_000),
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = await res.json();
```

`process.versions.undici` — version bundled. Body chỉ đọc **một lần** (`json` / `text` / `arrayBuffer` / `bytes` / `body` stream).

Body Web Streams:

```ts
const res = await fetch(url);
if (!res.body) throw new Error("no body");
const reader = res.body.getReader();
// hoặc: arrayBuffer() / text() / json() / bytes()
```

### 5.3 `Headers`

```ts
const headers = new Headers();
headers.set("accept", "application/json");
headers.append("x-trace", "a");
headers.get("accept"); // case-insensitive
headers.getSetCookie(); // mảng Set-Cookie — Node/Undici
```

| Việc | Ghi chú |
|---|---|
| Object literal `{ "Content-Type": "…" }` | OK cho `fetch` |
| `Headers` | append trùng tên; `getSetCookie` |
| Forbidden browser headers | Node **không** siết như browser — vẫn đừng giả mạo `Host` bừa |
| `set-cookie` | Không `headers.get("set-cookie")` một string — dùng `getSetCookie()` |

Request `headers` trên `IncomingMessage`: `req.headers` (hạ lowercase), `req.headersDistinct` (mảng khi trùng).

### 5.4 `duplex` — stream làm request body

WHATWG Fetch: body là `ReadableStream` thì phải khai **`duplex: "half"`** (half-duplex: không vừa gửi vừa đọc response cùng lúc theo kiểu full):

```ts
import { Readable } from "node:stream";

const nodeIn = createReadStream("upload.bin");
const webIn = Readable.toWeb(nodeIn);

const res = await fetch("https://example.com/upload", {
  method: "POST",
  body: webIn,
  duplex: "half",
  headers: { "content-type": "application/octet-stream" },
  signal: AbortSignal.timeout(60_000),
});
```

Thiếu `duplex` → TypeError trên undici/Node. `"half"` là giá trị hợp lệ hiện tại — **không** bịa `"full"` trừ khi docs minor bạn chạy nói có.

Buffer/`Blob`/`URLSearchParams`/`FormData`/`string` **không** cần `duplex`.

### 5.5 `dispatcher` (Agent / Pool)

`fetch` Node = Undici. Tinh chỉnh pool, proxy, TLS:

```ts
import { Agent, fetch as undiciFetch } from "undici";

const agent = new Agent({
  connections: 16,
  keepAliveTimeout: 30_000,
});

await fetch("https://api.example.com", { dispatcher: agent });
```

Global (ảnh hưởng `fetch` built-in **và** undici):

```ts
import { Agent, setGlobalDispatcher } from "undici";
setGlobalDispatcher(new Agent({ connections: 32 }));
```

Cần dependency `undici` (cùng major với bundled thì tốt) để `setGlobalDispatcher` / class `Agent`. Option `dispatcher` trên `fetch` là **API Node** (docs globals).

| Nhu cầu | Chọn |
|---|---|
| Ít request | `fetch` mặc định |
| Nhiều origin | `Agent` pool |
| Một origin rất nóng | `Pool` (undici) |
| mTLS / custom TLS | `Agent` options / `https` thấp tầng |
| Test in-process | Mock dispatcher **hoặc** inject handler framework — không phải `createServer` fetch native |

### 5.6 `createServer` vs fetch handler — thực tế Node 26

`http.createServer(listener)` listener là `(IncomingMessage, ServerResponse) => void`. **Không** nhận `(Request) => Response`.

Đề xuất `http.serve((req: Request) => Response)` / `NodeRequest` **chưa** phải API ổn định để ghi vào baseline này. Đừng viết `createServer(async (req: Request) => new Response("ok"))` — **sai kiểu**, không chạy.

Muốn fetch-style hôm nay:

- Adapter (`createRequestListener` từ package bên ngoài, Hono/Fastify adapter, …) — **không** core;
- Tự `Request` từ `req` + ghi `Response` ra `res` (nhiều edge: streaming, abort disconnect).

Server production: `createServer` hoặc framework trên http. Client: `fetch`.

### 5.7 Khi nào `https.request` / Agent thấp tầng

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

### 5.8 Client cổ điển `https.get` (khi cần)

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

Prefer `fetch` trừ khi Agent/TLS thấp tầng bắt buộc. Timeout với `https.get` thủ công dễ sai — `AbortSignal` + `fetch` rõ hơn. Nhớ `res.resume()` nếu không đọc body (tránh leak).

### 5.9 Server timeout & keep-alive

```ts
server.requestTimeout = 30_000;
server.headersTimeout = 60_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 100;
```

Framework thường expose tương đương — biết các nút này khi debug connection treo / load balancer idle. `server.close` + [main-function.md](main-function.md) shutdown.

### 5.10 Redirect, method, body một lần

`fetch` follow redirect theo `redirect: "follow"` (mặc định) | `"manual"` | `"error"`. POST + 302: hành vi WHATWG (đôi khi đổi GET) — đừng giả định giữ POST. `credentials` cookie jar **không** như browser đầy đủ — Node không có document cookie store; tự `Cookie` header.

`keepalive` / HTTP/1.1 reuse: dispatcher Agent. `cache` mode trình duyệt **không** đủ trên Node như HTTP cache spec browser.

`Request` / `Response` `clone()` trước khi đọc body hai lần. `res.body.getReader()` rồi `res.json()` → lỗi body used.

Timeout: `AbortSignal.timeout(ms)` **hoặc** `AbortSignal.any([user, timeout])` (Node 20+). `fetch` không có `timeout:` số riêng trên API chuẩn.

```ts
const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ok: true }),
  signal: AbortSignal.timeout(5_000),
});
```

`dispatcher` **không** có trên `Request` constructor mọi nơi — truyền vào `fetch(url, { dispatcher })`. Kiểm types `@types/node` / undici.

---

## 6. `stream` & backpressure

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

### 6.1 Backpressure & `highWaterMark`

- Writable `write()` trả **`false`** → **dừng** đẩy cho tới `'drain'`.
- Readable: `push(chunk)` trả `false` → ngừng đọc nguồn (kernel/file) cho tới consumer kéo.
- `highWaterMark`: ngưỡng byte (binary) hoặc số object (`objectMode`).

| Loại | Default `highWaterMark` (thực dụng) |
|---|---|
| File / TCP binary | **16 KiB** (16384) |
| `objectMode: true` | **16** objects |
| `fs.createReadStream({ highWaterMark })` | Đặt 64KiB–256KiB khi disk tuần tự lớn |

Tăng HWM: ít syscall, **nhiều RAM** / latency burst. Giảm: RAM thấp, nhiều vòng loop. Đo; đừng copy số thần thoại.

```ts
const rs = createReadStream("big.bin", { highWaterMark: 64 * 1024 });
const ws = createWriteStream("out.bin", { highWaterMark: 64 * 1024 });
```

**`pipeline` / `compose`** nối đúng, propagate lỗi, destroy stream — ưu tiên hơn `.pipe()` trần.

```ts
import { pipeline } from "node:stream/promises";

await pipeline(src, transform, dest, { signal: AbortSignal.timeout(30_000) });
```

`.pipe()` không destroy nguồn khi đích lỗi (lịch sử) — leak fd. `pipeline` làm.

Tự `write`:

```ts
function writeWithBackpressure(ws: NodeJS.WritableStream, chunk: Buffer) {
  return new Promise<void>((resolve, reject) => {
    const ok = ws.write(chunk, (err) => (err ? reject(err) : undefined));
    if (ok) resolve();
    else ws.once("drain", () => resolve());
  });
}
```

Thường **không** cần nếu đã `pipeline` / `Readable.from`.

### 6.2 Async iteration

```ts
for await (const chunk of createReadStream("in.txt")) {
  // chunk: Buffer
}
```

Iteration tôn trọng backpressure (không đọc vô hạn vào RAM). `break` / throw nên destroy stream (`pipeline` hoặc `rs.destroy()`).

### 6.3 Web Streams

`ReadableStream` / `WritableStream` / `TransformStream` — `fetch` body, một số API mới. Bridge bằng `Readable.fromWeb` / `toWeb`.

`highWaterMark` Web Streams: `new ReadableStream({ ... }, { highWaterMark })` — **strategy** khác Node (count vs byte). Đừng copy số giữa hai thế giới không đọc spec.

### 6.4 Object mode & encoding

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
- HWM objectMode = **số object**, không phải byte — 16 object JSON lớn vẫn phình RAM.

### 6.5 Lỗi trên stream

```ts
rs.on("error", (err) => {
  console.error("read failed", err);
});
// Prefer pipeline — tự destroy + forward error
```

Listener `error` thiếu trên EventEmitter-like có thể crash process. Luôn dùng `pipeline` hoặc gắn handler có chủ đích.

### 6.6 `compose` & `Duplex`

```ts
import { compose, Transform } from "node:stream";

const t = compose(
  new Transform({
    transform(c, _e, cb) {
      cb(null, c);
    },
  }),
  new Transform({
    transform(c, _e, cb) {
      cb(null, c);
    },
  }),
);
```

`stream.compose` (và `pipeline`) nối web+Node tùy bản — đọc docs. Duplex = vừa đọc vừa ghi (`Socket`, `PassThrough`). `objectMode` hai phía độc lập: `readableObjectMode` / `writableObjectMode`.

`stream.finished(stream, { signal })` Promise khi `end`/`close`/`error` — thay tự lắng nhiều event.

`Readable.from(iterable)` / `Readable.fromWeb`. Generator `async function*` + `from` = backpressure theo iteration.

### 6.8 `pipeline` vs `pipe` vs `consume`

| Cách | Destroy khi lỗi | AbortSignal | Nên |
|---|---|---|---|
| `stream.pipeline` / `pipeline` promises | Có | Có (`{ signal }`) | **Mặc định** |
| `a.pipe(b)` | Lịch sử **không** đủ | Không | Tránh |
| `for await` | Phải `destroy` tay khi break | Tự | OK nếu cẩn thận |
| `finished()` | Chờ kết | Có | Bổ sung, không thay pipeline |

`error` trên EE không listener → throw. `pipeline` gắn handler. `unpipe` giữa chừng dễ leak — hủy = `destroy(err)`.

Web `pipeTo(writable, { signal, preventAbort })` — khác Node `pipe`. Bridge `fromWeb` rồi `pipeline` khi mix.

### 6.7 Default HWM & TCP

Socket `highWaterMark` 16KiB mỗi chiều. Push quá nhanh không đọc `write() === false` → buffer nội bộ phình (memory). Proxy/pipe tay **phải** tôn trọng drain. `pipeline` làm hộ.

`cork()` / `uncork()` gộp write nhỏ (TCP) — tối ưu tinh; đo trước.

`stringDecoder` khi cắt UTF-8 giữa chunk — `setEncoding("utf8")` trên readable xử lý đa số; binary protocol giữ Buffer.

---

## 7. `buffer` — `alloc` vs `allocUnsafe`

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

| API | Zero-fill? | Khi dùng |
|---|---|---|
| `Buffer.alloc(n)` | **Có** | Mọi buffer lộ ra user / giữ secret / chưa ghi hết |
| `Buffer.allocUnsafe(n)` | **Không** | Ghi **ngay** toàn bộ (pool nội bộ) — đừng return cho client trước khi fill |
| `Buffer.allocUnsafeSlow(n)` | Không | Tránh pool; ít dùng |
| `Buffer.from(array)` | Copy | Input đã có |
| `Buffer.from(string, enc)` | Encode | Text |

`allocUnsafe` lấy từ pool Node — **có thể** chứa data request/file cũ. Lỗ bảo mật cổ điển: gửi chunk chưa ghi hết.

```ts
const buf = Buffer.allocUnsafe(1024);
const { bytesRead } = await fh.read(buf, 0, 1024, 0);
socket.write(buf.subarray(0, bytesRead)); // không write cả 1024
```

`Buffer.poolSize` (thường 8KiB) — alloc nhỏ đi pool. Không cần đụng trừ khi profile.

`Buffer.byteLength(str, "utf8")` ≠ `str.length` (UTF-16 JS). Cắt byte UTF-8: đừng `buf.slice` giữa code unit bừa.

> **Callout:** Default `new Buffer(n)` **đã cấm** / removed. Luôn `alloc` / `from`. `slice` trên Buffer là **view** (shared memory) — `subarray` rõ hơn; `copy` khi cần tách.

---

## 8. `crypto` vs Web Crypto

Hai bề mặt: **`node:crypto`** (hash stream sync-ish, `createHmac`, `scrypt`, cert) và **`globalThis.crypto.subtle`** (Web Crypto, luôn async, share browser).

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

- Password: `scrypt` / `pbkdf2` (async) — không tự invent hash nhanh. `scryptSync` block loop — đừng trên request.
- Web Crypto: `globalThis.crypto.subtle` khi share code browser.
- TLS chi tiết: `node:tls` / `https`.
- Node 26 / OpenSSL: theo dõi release notes cho raw-key / thuật toán mới (ví dụ Ed25519 context) — đọc docs đúng minor bạn chạy.
- `randomUUID()` = UUID v4. `crypto.randomBytes` cho token opaque.

Pipeline hash file:

```ts
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

const hash = createHash("sha256");
await pipeline(createReadStream("big.bin"), hash);
const hex = hash.digest("hex");
```

### 8.1 Web Crypto (`subtle`)

```ts
const key = await crypto.subtle.generateKey(
  { name: "AES-GCM", length: 256 },
  true,
  ["encrypt", "decrypt"],
);

const iv = crypto.getRandomValues(new Uint8Array(12));
const cipher = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  key,
  new TextEncoder().encode("hello"),
);
```

| Việc | `node:crypto` | `crypto.subtle` |
|---|---|---|
| SHA-256 stream file | `createHash` + `pipeline` | Phải tự chunk `digest` — kém tiện |
| HMAC request signing Node | `createHmac` | `importKey` + `sign` async |
| AES-GCM share browser | Được (Cipheriv) | **Đúng chuẩn web** |
| Password KDF | `scrypt` / `pbkdf2` | `PBKDF2` subtle; scrypt **không** universal trên subtle |
| Random | `randomBytes` / `randomUUID` | `getRandomValues` / `randomUUID` |

Dùng subtle khi share thuật toán với browser. Node `createHash` / `createHmac` vẫn tiện pipeline stream (`hash.update(chunk)`).

`globalThis.crypto` trên Node = WebCrypto; **không** phải `import crypto from "node:crypto"` (module còn `createHash`, certificates, …).

### 8.3 Key, PEM, `createPrivateKey`

```ts
import { createPrivateKey, sign, generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const sig = sign(null, Buffer.from("msg"), privateKey);
```

PEM/JWK: `createPrivateKey({ key, format: "pem" })`. Web Crypto `importKey` JWK — khác shape. Đừng mix `subtle.sign` key với `createSign("SHA256")` key object không chuyển.

`createCipheriv` / `createDecipheriv` — IV + auth tag (GCM). **Cấm** `createCipher` deprecated.

`hash.update` nhận `Buffer` / string + encoding. UTF-16 string JS ≠ UTF-8 bytes.

### 8.4 `webcrypto` `crypto.getRandomValues`

```ts
const bytes = new Uint8Array(16);
crypto.getRandomValues(bytes);
```

Cùng CSPRNG family với `randomBytes`. Browser-share: `getRandomValues`. Node pipeline: `randomBytes`. `Math.random` **không** cho token.

### 8.5 Hash stream vs `subtle.digest`

`subtle.digest("SHA-256", data)` cần **toàn bộ** `BufferSource` trong RAM. File GB → `createHash` + `pipeline`. Browser-only code path: subtle + chunked `ReadableStream` tự roll — Node không bắt buộc.

`randomInt` (`node:crypto`) tránh modulo bias — token số. `timingSafeEqual` **không** cho string khác length (throw).

`createHmac` key: `Buffer` / string. Key string encoding mặc định utf8 — hex key phải `Buffer.from(hex, "hex")`. Sai encoding → chữ ký lệch im lặng với peer.

`KeyObject` `export({ type: "pkcs8", format: "pem" })` — đừng log. `timingSafeEqual` cho digest cùng length sau hash.

### 8.2 Timing-safe compare

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

`timingSafeEqual` **throw** nếu length khác — check trước.

---

## 9. `events` — EventEmitter vs EventTarget

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

### 9.1 So sánh

| | **EventEmitter** | **EventTarget** |
|---|---|---|
| API | `on` / `once` / `off` / `emit` | `addEventListener` / `dispatchEvent` |
| Origin | Node | Web (`AbortSignal`, DOM) |
| `error` | **Throw** nếu không listener → crash | Không special-case như EE |
| Payload | `emit("e", a, b)` nhiều arg | `CustomEvent.detail` / subclass `Event` |
| Typing TS | `EventEmitter<Events>` (Node types) | Generic yếu hơn tùy lib |
| `once()` helper | `events.once(ee, "e", { signal })` | Cũng dùng được với EventTarget trên Node |

```ts
import { EventEmitter, EventTarget, once } from "node:events";

const et = new EventTarget();
et.addEventListener("ping", (ev) => {
  console.log((ev as CustomEvent).detail);
});
et.dispatchEvent(new CustomEvent("ping", { detail: 1 }));

await once(et, "ping");
```

`AbortSignal` là EventTarget (`addEventListener("abort", …)`), **không** phải EventEmitter. `fetch({ signal })` / `fs` `{ signal }` dùng EventTarget.

### 9.2 `error` trên EventEmitter

```ts
bus.on("error", (err) => {
  console.error(err);
});
bus.emit("error", new Error("x")); // không crash nếu có listener
```

**Không** listener → throw đồng bộ lúc `emit("error")` → dễ `uncaughtException`. Stream `error` cùng luật. EventTarget `dispatchEvent` **không** throw vì thiếu listener.

`captureRejections: true` (constructor option / `EventEmitter.captureRejections`) biến reject trong listener async thành `error` event — theo dõi docs; đừng nuốt.

`prependListener` chạy trước `on`. `rawListeners` debug leak `MaxListenersExceededWarning`. `setMaxListeners(0)` **không** phải fix leak.

Chọn:

- App Node nội bộ, nhiều arg, `error` convention → **EventEmitter**.
- Share browser / AbortSignal / WHATWG → **EventTarget**.
- Đừng wrap mọi EE thành ET “cho web-like” nếu không cần.

`events.on(ee, "data", { signal })` async iter — hủy bằng AbortSignal.

```ts
const ac = new AbortController();
(async () => {
  for await (const [chunk] of on(rs, "data", { signal: ac.signal })) {
    void chunk;
  }
})().catch((err) => {
  if (err.name !== "AbortError") throw err;
});
```

---

## 10. `assert`

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("sum", () => {
  it("adds", () => {
    assert.equal(1 + 2, 3);
    assert.deepEqual({ a: 1 }, { a: 1 });
    assert.match("abc", /b/);
    assert.throws(() => JSON.parse("x"));
  });
});

await assert.rejects(async () => {
  throw new Error("nope");
}, /nope/);
```

| Import | Equality | Dùng |
|---|---|---|
| `node:assert/strict` | `===` / deep strict | **Mặc định code mới** |
| `node:assert` (legacy) | `==` trên `equal` | Tránh |

`assert.ok(value)` fail nếu falsy. `assert.fail(message)`. `assert.never` không có — dùng `satisfies never` TS.

### 10.1 API hay dùng

```ts
import assert from "node:assert/strict";

assert.equal(a, b);
assert.notEqual(a, b);
assert.deepEqual(obj, { a: 1 });
assert.notDeepEqual(obj, {});
assert.match("hello@x.com", /@/);
assert.doesNotMatch("x", /@/);
assert.throws(() => JSON.parse("{"), SyntaxError);
assert.doesNotThrow(() => JSON.parse("{}"));
await assert.rejects(p, /fail/);
await assert.doesNotReject(Promise.resolve(1));
assert.ifError(err); // throw nếu err truthy — style callback
```

`AssertionError` có `actual` / `expected` / `operator`. `node --test` in diff.

`assert.partialDeepStrictEqual` — **chỉ** nếu version bạn chạy có (theo dõi changelog Node 22+/26). Không có trên bản cũ — đừng copy blindly.

Production: `assert` có thể bị bundler drop khi `define process.env`. Invariant bảo mật: `throw`.

`deepEqual` so object; **không** thay snapshot test lớn. `partialDeepStrictEqual` (nếu có trên minor) — đọc docs; đừng bịa.

Test runner: [tooling.md](tooling.md) `node --test`. AssertionError in stack — đủ cho service nhỏ; Vitest khi cần mock ecosystem.

> **Callout:** `assert(expr)` bị strip/define trong một số bundler. Production invariant: `if (!x) throw new Error(...)` rõ ràng hơn `assert` có thể bị drop.

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

`process.argv`, `exitCode` vs `exit`, signals: **một nguồn** ở [main-function.md](main-function.md).

### 11.2 `os`

```ts
import os from "node:os";

os.platform();
os.arch();
os.availableParallelism(); // gợi ý độ song song worker pool
os.homedir();
os.tmpdir();
os.cpus().length; // cũ hơn; prefer availableParallelism
```

`availableParallelism()` tôn trọng cgroup/CPU quota (container) tốt hơn `cpus().length` trên nhiều dòng hiện đại.

### 11.3 `util` — `styleText`, `parseArgs`, promisify

```ts
import util from "node:util";

util.promisify(fn);
util.inspect(obj, { depth: 3, colors: true });
util.types.isNativeError(x);
util.types.isPromise(x);
util.styleText("green", "ok");
util.styleText(["bold", "red"], "fail");
```

`styleText(format, text)` — màu/modifier **khi** TTY hiểu; Node tắt màu nếu không TTY / `NO_COLOR` (theo policy dòng). Đừng tự ghép ANSI nếu có `styleText`.

Format: tên như `"green"`, `"bgRed"`, `"bold"`, `"underline"` — **đúng** list docs `util.styleText`. Mảng = kết hợp.

CLI nhẹ — **pointer đầy đủ** [main-function.md](main-function.md) §3 (`strict`, `tokens`, subcommand):

```ts
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: { type: "string", short: "p" },
    verbose: { type: "boolean", short: "v" },
  },
  allowPositionals: true,
  strict: true,
});
```

`util.parseArgs` **không** nằm riêng module CLI — cùng `node:util`. `util.transferableAbortController` / `promisify.custom` — đọc khi cần, không phải hotspot mặc định.

`util.callbackify` ít dùng (đưa Promise về callback Node) — library CJS cổ.

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

`hasSubscribers` tránh serialize đắt khi không ai nghe. Tên kênh: convention `pkg:component` / `undici:request:create` (core đã publish một số kênh — đọc docs, đừng đoán tên).

`tracingChannel` (cùng module): cặp start/end/async cho span:

```ts
import { tracingChannel } from "node:diagnostics_channel";

const tc = tracingChannel("my-app:handler");

await tc.tracePromise(async () => {
  return await handle();
});
```

OpenTelemetry / APM có thể subscribe cùng kênh. **Không** tự dựng distributed trace chỉ bằng channel.

Subscribe **sớm** (boot) — publish trước subscribe = miss.

### 12.4 `tracingChannel` chi tiết

```ts
import { tracingChannel } from "node:diagnostics_channel";

const tc = tracingChannel("my-app:handler");

tc.subscribe({
  start(msg) {
    void msg;
  },
  end(msg) {
    void msg;
  },
  asyncStart(msg) {
    void msg;
  },
  asyncEnd(msg) {
    void msg;
  },
  error(msg) {
    void msg;
  },
});

tc.traceSync(() => doWork());
await tc.tracePromise(() => doWorkAsync());
```

Tên kênh ổn định để APM subscribe. `traceCallback` cho API `(err, result)`. Không log PII trên channel production.

`perf_hooks` `PerformanceObserver` `entryTypes: ["measure", "gc", "http"]` — `http` entry tùy bật; GC observer **đắt**. `monitorEventLoopDelay` resolution thấp (ms) = ít overhead hơn 1ms.

### 12.2 `perf_hooks`

```ts
import {
  performance,
  PerformanceObserver,
  monitorEventLoopDelay,
} from "node:perf_hooks";

const t0 = performance.now();
// ... work ...
const ms = performance.now() - t0;

performance.mark("A");
performance.mark("B");
performance.measure("AtoB", "A", "B");

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();
// ... sau đó
histogram.disable();
console.log(histogram.mean, histogram.max, histogram.percentile(99));
```

| API | Việc |
|---|---|
| `performance.now()` | Monotonic ms (không wall clock) |
| `mark` / `measure` | Span nhẹ nội process |
| `PerformanceObserver` | Lắng `measure` / `function` / `http` (tùy entryTypes) |
| `monitorEventLoopDelay` | Histogram lag loop — health sâu [event-loop.md](event-loop.md) |
| `performance.eventLoopUtilization()` | ELU — busy vs idle |

Dùng cho benchmark nhẹ / latency span nội bộ. Tracing phân tán đầy đủ → OTel, không tự dựng lại.

`Date.now()` = wall; NTP nhảy. Đo duration: **`performance.now()`**.

### 12.3 Không nằm ở chương này

| Nhu cầu | Chương |
|---|---|
| Worker threads / `child_process` | [threading.md](threading.md) |
| Module resolution / `exports` | [modules-packages.md](modules-packages.md) |
| Hủy request / ALS | [abort-context.md](abort-context.md) |
| Microtask / phases | [event-loop.md](event-loop.md) |
| Entry / signals / parseArgs sâu | [main-function.md](main-function.md) |

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
- Node 24: **không** mặc định giống 26 — dual-support thì polyfill hoặc giữ `Date`.

### 13.1 Temporal vs `Date` — quyết định nhanh

| Nhu cầu | Chọn |
|---|---|
| Instant UTC / monotonic wall gần đúng | `Temporal.Instant` / `Temporal.Now.instant()` |
| Lịch dân sự + timezone | `ZonedDateTime` / `PlainDate` |
| Duration / khoảng | `Temporal.Duration` |
| Interop JSON legacy / lib cũ | `Date` + chuyển đổi tường minh |
| Timestamp epoch ms cho DB cũ | `instant.epochMilliseconds` (theo API Temporal) |
| Đo elapsed | `performance.now()` — **không** Temporal |

```ts
const fromLegacy = Temporal.Instant.fromEpochMilliseconds(Date.now());
const back = new Date(fromLegacy.epochMilliseconds);
```

Đừng mix mutable `Date` setters với Temporal trong cùng domain model — chọn một phía cho nghiệp vụ mới.

`PlainDate.add({ months: 1 })` theo lịch (calendar arithmetic) — khác “+ 30 ngày epoch”. DST: `ZonedDateTime` + IANA name (`Asia/Ho_Chi_Minh`), không offset cố định trừ khi Instant.

> **Callout:** `Temporal.Now.instant()` ≠ `performance.now()`. Instant = wall/UTC; `performance.now()` = monotonic process. SLA/latency → perf_hooks.

### 13.2 Calendar vs Instant — pitfalls

`PlainDate` không có timezone — “ngày 16/9” không phải instant. Lưu DB UTC: `Instant` / epoch ms. Hiển thị user: `ZonedDateTime` + IANA.

`Duration` cân bằng (`hours` vs `days`) — `round` / `total` theo docs; đừng `Number(duration)`. So sánh: `Instant.compare` / `PlainDate.compare`, không `<` trên object.

JSON: `toJSON()` trên Temporal objects — round-trip `from()`. `Date.toISOString()` ≠ `ZonedDateTime.toString()` (offset + calendar). API public: document ISO string flavor.

`Temporal.Now.zonedDateTimeISO` ném nếu IANA không có (data tz trong binary Node). `UTC` luôn có. Offset cố định `+07:00` ≠ `Asia/Ho_Chi_Minh` (luật DST/lịch sử). Việt Nam: dùng IANA name.

`PlainTime` / `PlainYearMonth` cho nghiệp vụ “giờ trong ngày” / “tháng kế toán” không gắn timezone. Mix với `Date.setHours` local machine → bug CI UTC vs laptop.

---

## 14. Best practices

1. Luôn `node:` prefix; ưu tiên `*/promises` và `pipeline`.
2. Client HTTP: `fetch` + `AbortSignal` + `res.ok`; stream body → `duplex: "half"`; pool → `dispatcher`.
3. Server: `http.createServer(req, res)` hoặc framework — **không** giả fetch handler core.
4. File lớn → stream + HWM có chủ đích; config nhỏ → promises; fd lặp → `FileHandle` + `await using`.
5. Không `*Sync` trên request path.
6. Path user input → `resolve`/`realpath` + chặn `..`; ESM path → `fileURLToPath` / `import.meta.dirname`.
7. Secret compare → `timingSafeEqual`; password → scrypt/pbkdf2 async.
8. `Buffer.alloc` mặc định; `allocUnsafe` chỉ khi fill hết trước khi lộ.
9. EE vs EventTarget: Node bus vs AbortSignal/web; luôn listener `error` trên stream.
10. Shutdown: SIGINT/SIGTERM, đóng server, hết in-flight — [main-function.md](main-function.md).
11. Observability: `diagnostics_channel` / `perf_hooks` nhẹ; OTel cho hệ thống.
12. Thời gian nghiệp vụ: Temporal trên Node 26; elapsed → `performance.now()`.
13. Test: `node:assert/strict` + `node:test`.
14. CLI: `util.parseArgs` / `styleText` — chi tiết parse ở chương entry.
15. Đọc docs đúng major (`node --version`, `process.versions.undici`).

---

## 15. Checklist

```text
□ import node:… ; promises subpath khi có
□ Sync chỉ boot/CLI — không hot path
□ File lớn: pipeline / for-await — không readFile full
□ FileHandle luôn close / await using
□ fetch + signal; kiểm tra res.ok; duplex khi stream body
□ dispatcher khi cần pool — không nhầm http.globalAgent
□ createServer vẫn req/res — không bịa fetch listener
□ pipeline thay pipe trần; HWM hiểu byte vs objectMode
□ Buffer.allocUnsafe không lộ dữ liệu nhạy cảm
□ timingSafeEqual cùng length; scrypt async
□ Listener off / signal; listen error trên stream
□ EE vs EventTarget đúng chỗ (AbortSignal = ET)
□ path traversal đã chặn; file URL không path.join
□ assert/strict trong test
□ diagnostics_channel hasSubscribers; perf.now cho duration
□ Temporal cho date logic mới (baseline 26)
□ engines/CI khớp Node 26 (hoặc ghi rõ dual 24)
```

---

## 16. Cheat sheet

```ts
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import assert from "node:assert/strict";

await using fh = await fs.open(p, "r");
await fs.readFile(p, "utf8");
await pipeline(createReadStream(p), dest);
await fetch(url, { signal: AbortSignal.timeout(5_000) });
path.join(root, "a");
createHash("sha256").update(data).digest("hex");
randomUUID();
Temporal.Now.zonedDateTimeISO("UTC");
assert.equal(1 + 1, 2);
```

| Cần | Module |
|---|---|
| File I/O | `fs` / `fs/promises` / `FileHandle` |
| Path | `path` + `url` (`fileURLToPath`) |
| HTTP client | `fetch` + Headers + dispatcher |
| HTTP server | `http.createServer` / framework |
| Transform I/O | `stream` + `pipeline` + HWM |
| Hash / random | `node:crypto` / `crypto.subtle` |
| Bytes | `Buffer.alloc` / `from` |
| Pub/sub in-process | `EventEmitter` / `EventTarget` |
| Test assert | `node:assert/strict` |
| Date/tz nghiêm | `Temporal` |
| Spans nhẹ | `perf_hooks` / `diagnostics_channel` |
| CLI parse / màu | `util.parseArgs` / `styleText` |

`util.styleText` tôn trọng TTY/`NO_COLOR` (policy Node). `parseArgs` đầy đủ: [main-function.md](main-function.md) §3.

`diagnostics_channel.hasSubscribers` trước serialize. `performance.now()` cho duration, Temporal cho lịch.

`Buffer.alloc` mặc định; `allocUnsafe` chỉ fill hết. `createServer(req,res)` không fetch handler core. Duplex `"half"` khi stream body `fetch`.

`FileHandle` luôn `close` / `await using`. HWM 16KiB binary / 16 object.

---

## 17. Version notes

| Nền | Liên quan |
|---|---|
| Node 18+ | `fetch` ổn định dần; Web Streams; `node --watch` |
| Node 20+ | `AbortSignal.any`; `--env-file`; `import.meta.dirname` (20.11) |
| Node 20.6+ / 22+ | `util.parseArgs` ổn định; `styleText` |
| Node 22–24 | type stripping experimental → ổn định dần |
| **Node 26** | V8 **14.6**, Undici **8**, **Temporal** default, `Iterator.concat`, type stripping ổn định, gỡ `--experimental-transform-types` |
| Node 24 | Maintenance LTS song song giai đoạn chuyển; Temporal **không** cùng default |
| `FileHandle` asyncDispose | `await using` trên dòng hiện đại |
| `http.serve` fetch | **Không** baseline — proposal/PR, không dùng như API ổn định |

Baseline tài liệu: **Node 26** + **TS 7** (`@types/node@^26`).

---

## 18. Tài liệu liên quan

- [Lập trình bất đồng bộ](async.md)
- [AbortSignal & request context](abort-context.md)
- [Event loop & concurrency model](event-loop.md)
- [Entry point & chạy chương trình](main-function.md)
- [Worker Threads & Child Process](threading.md)
- [Modules & Packages](modules-packages.md)
- [npm / pnpm / yarn & tooling](tooling.md)
- [Iterator, Iterable & “LINQ-like”](iterables-linq.md)
- [Phát biểu](statements.md) — `using` / `await using`
- [exceptions.md](exceptions.md) — assert vs throw
- [decorators.md](decorators.md) — không nằm built-in runtime
