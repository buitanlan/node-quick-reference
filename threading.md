# Worker Threads & Child Process

*(worker_threads, cluster, child_process — mô hình song song trên Node)*

Baseline: **Node.js 26**. JS trên main thread vẫn **một call stack**; song song thật cho JS CPU-bound dùng **worker_threads** (hoặc process tách). Đây **không** phải mô hình OS thread chia sẻ heap như bạn lập trình `Thread` trong C#.

---

## Mục lục

- [Worker Threads \& Child Process](#worker-threads--child-process)
  - [Mục lục](#mục-lục)
  - [1. Làm rõ mô hình: không phải C# Thread](#1-làm-rõ-mô-hình-không-phải-c-thread)
  - [2. So sánh nhanh: workers vs cluster vs child_process](#2-so-sánh-nhanh-workers-vs-cluster-vs-child_process)
  - [3. `worker_threads`](#3-worker_threads)
    - [3.1 Tạo worker](#31-tạo-worker)
    - [3.2 `postMessage` \& structured clone](#32-postmessage--structured-clone)
    - [3.3 `MessageChannel` / `MessagePort`](#33-messagechannel--messageport)
    - [3.4 `SharedArrayBuffer` — thận trọng](#34-sharedarraybuffer--thận-trọng)
    - [3.5 Pool \& khi nào dùng](#35-pool--khi-nào-dùng)
  - [4. `child_process`](#4-child_process)
    - [4.1 `spawn` / `execFile` / `fork`](#41-spawn--execfile--fork)
    - [4.2 Promise API](#42-promise-api)
  - [5. `cluster`](#5-cluster)
  - [6. Chọn công cụ theo bài toán](#6-chọn-công-cụ-theo-bài-toán)
  - [7. Best practices \& cảnh báo](#7-best-practices--cảnh-báo)

---

## 1. Làm rõ mô hình: không phải C# Thread

| | **C# / .NET** | **Node.js** |
|---|---|---|
| Thread JS/C# mặc định | Nhiều thread có thể chạy managed code (kèm sync) | **Một** main thread chạy JS |
| Chia sẻ memory | Heap chung + `lock` | Worker: **isolate riêng**; mặc định **không** share object JS |
| CPU song song | `Task.Run`, `Thread`, Parallel | `worker_threads` (JS), libuv pool (một số C++/fs/crypto) |
| I/O concurrent | async + threadpool | event loop + async I/O (không cần thread/request) |

Trong worker:

- Mỗi worker có **V8 isolate + event loop riêng**.
- Object JS **không** chia sẻ trực tiếp; giao tiếp bằng message (clone / transfer) hoặc `SharedArrayBuffer` (thấp tầng, nguy hiểm).
- `require`/`import` state **không** dùng chung với parent.

Đừng kỳ vọng `lock` quanh biến global như C# — biến global của parent **invisible** với worker.

---

## 2. So sánh nhanh: workers vs cluster vs child_process

| | **worker_threads** | **cluster** | **child_process** |
|---|---|---|---|
| Đơn vị | Thread trong **cùng process** | Nhiều process Node (thường master + workers) | Process bất kỳ (Node hoặc binary) |
| Share memory | Isolate riêng; SAB tùy chọn | Process tách | Process tách |
| Use-case chính | CPU-bound JS | Scale HTTP trên multi-core | Gọi CLI, sandbox, pipeline OS |
| Startup | Nhẹ hơn process | Nặng hơn worker | Nặng nhất / linh hoạt nhất |
| Crash isolation | Worker crash có thể kéo theo tùy lỗi native | Process khác sống | Tốt |

---

## 3. `worker_threads`

### 3.1 Tạo worker

```ts
// main.ts
import { Worker } from "node:worker_threads";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const worker = new Worker(path.join(__dirname, "heavy-worker.js"), {
  workerData: { n: 40 },
});

worker.on("message", (msg) => console.log("result", msg));
worker.on("error", (err) => console.error(err));
worker.on("exit", (code) => {
  if (code !== 0) console.error("exit", code);
});
```

```ts
// heavy-worker.js (hoặc .ts tùy runner)
import { parentPort, workerData } from "node:worker_threads";

function fib(n: number): number {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

parentPort?.postMessage(fib(workerData.n));
```

Inline eval / `eval: true` và `Worker` từ data URL hữu ích cho tool; production thường file riêng.

Phát hiện ngữ cảnh:

```ts
import { isMainThread } from "node:worker_threads";
if (isMainThread) {
  // parent
} else {
  // worker
}
```

### 3.2 `postMessage` & structured clone

```ts
worker.postMessage({ type: "job", payload: { id: 1 } });
parentPort.postMessage(new Uint8Array([1, 2, 3]));
```

- Dữ liệu được **structured clone** (giống structured clone algorithm).
- Có thể **transfer** ownership: `ArrayBuffer`, `MessagePort`, …

```ts
const buf = new ArrayBuffer(1024);
worker.postMessage({ buf }, [buf]); // buf ở sender trở nên detached
```

Không clone được: function, DOM node (N/A), một số native handle — thiết kế message JSON-like / typed buffer.

### 3.3 `MessageChannel` / `MessagePort`

Tạo kênh độc lập (worker ↔ worker, hoặc tách channel khỏi `parentPort`):

```ts
import { MessageChannel, Worker } from "node:worker_threads";

const { port1, port2 } = new MessageChannel();
const w = new Worker("./w.js");

w.postMessage({ port: port2 }, [port2]);
port1.on("message", (m) => console.log(m));
port1.postMessage("ping");
```

Trong worker nhận port, `port.start()` nếu dùng `on('message')` theo kiểu cũ; với `port.on('message')` Node thường auto-start.

### 3.4 `SharedArrayBuffer` — thận trọng

```ts
const sab = new SharedArrayBuffer(1024);
const view = new Int32Array(sab);
worker.postMessage(sab); // share — không transfer hết nghĩa clone
```

- Cho phép nhiều thread đọc/ghi **cùng bytes**.
- Cần `Atomics` để đồng bộ (`Atomics.wait` / `notify` / `compareExchange`).
- Dễ data race, khó debug; một số môi trường hạn chế SAB vì Spectre.
- Chỉ dùng khi đo được lợi ích (ring buffer, counter chung) và team nắm Atomics.

```ts
Atomics.store(view, 0, 1);
Atomics.notify(view, 0, 1);
```

### 3.5 Pool & khi nào dùng

Dùng workers khi:

- Parse/encode CPU nặng, image, compression JS thuần, crypto JS thuần,
- Tính toán làm **event loop lag** rõ trên main.

Không cần workers khi:

- Chủ yếu chờ DB/HTTP/fs async (event loop đủ),
- Việc đã chạy trên libuv threadpool và không block JS.

Pattern: **pool cố định** (số worker ≈ số core), hàng đợi job, tái sử dụng worker thay vì spawn mỗi request.

```ts
// ý tưởng tối giản
worker.postMessage(job);
// await once('message') tương ứng job id
```

Thư viện: `piscina`, `workerpool` — hữu ích production thay vì tự viết pool.

---

## 4. `child_process`

### 4.1 `spawn` / `execFile` / `fork`

```ts
import { spawn, execFile, fork } from "node:child_process";

// spawn: stream stdout/stderr, không qua shell (an toàn hơn)
const child = spawn("node", ["script.js", "--flag"], {
  stdio: "pipe",
  env: process.env,
});
child.stdout.on("data", (chunk) => process.stdout.write(chunk));
child.on("close", (code) => console.log("code", code));

// execFile: buffer output (cẩn thận maxBuffer)
execFile("node", ["-v"], (err, stdout) => {
  console.log(stdout.trim());
});

// fork: spawn process Node + IPC channel
const forked = fork("./worker-process.js");
forked.send({ type: "start" });
forked.on("message", (msg) => console.log(msg));
```

**Tránh `exec` với string shell** nếu input từ user → command injection. Ưu tiên `spawn`/`execFile` + mảng args.

### 4.2 Promise API

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { stdout } = await execFileAsync("node", ["-v"]);
```

Hoặc:

```ts
import { execFile } from "node:child_process/promises";
const { stdout } = await execFile("node", ["-v"]);
```

---

## 5. `cluster`

Scale server HTTP trên nhiều core bằng **nhiều process** chia sẻ server handle:

```ts
import cluster from "node:cluster";
import http from "node:http";
import os from "node:os";

if (cluster.isPrimary) {
  const n = os.availableParallelism();
  for (let i = 0; i < n; i++) cluster.fork();
  cluster.on("exit", (worker) => {
    console.log("dead", worker.process.pid);
    cluster.fork();
  });
} else {
  http.createServer((_req, res) => {
    res.end(`ok ${process.pid}`);
  }).listen(3000);
}
```

Ghi chú hiện đại:

- Nhiều team dùng **process manager ngoài** (PM2, systemd, Kubernetes replicas) thay `cluster` trong app.
- `cluster` không giải CPU trong **một** request handler — mỗi process vẫn single-threaded JS.
- State in-memory **không** share giữa worker process → sticky session / Redis nếu cần.

---

## 6. Chọn công cụ theo bài toán

| Bài toán | Công cụ |
|---|---|
| HTTP I/O-bound, scale multi-core | nhiều process (`cluster` / K8s / PM2) |
| Một process, CPU JS nặng từng job | `worker_threads` (+ pool) |
| Gọi `ffmpeg`, `git`, CLI | `child_process.spawn` |
| Tách crash / security boundary | `child_process` / container |
| Chỉ fs/crypto native nặng | cân nhắc libuv pool trước; đo event loop |

---

## 7. Best practices & cảnh báo

- Message **có cấu trúc** (`{ id, type, payload }`); timeout & reject job khi worker chết.
- Luôn lắng `error` / `exit`; đừng leak worker không terminate.
- Transfer `ArrayBuffer` lớn thay vì clone khi có thể.
- Tránh SAB trừ khi cần; ưu tiên message bất biến.
- Đừng block trong worker rồi kỳ vọng magic — worker cũng có event loop riêng.
- So với C#: nghĩ **message-passing isolates**, không phải shared-heap threads.
- ESM: đường dẫn worker dùng URL/`import.meta.url` cẩn thận khi bundle.

**Tài liệu liên quan:** [event-loop.md](event-loop.md) · [async.md](async.md) · [nodejs-apis.md](nodejs-apis.md)
