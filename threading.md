# Worker Threads & Child Process

*(worker_threads, cluster, child_process — mô hình song song trên Node)*

Baseline: **Node.js 26** + **TypeScript 7**. JS trên main thread vẫn **một call stack**; song song thật cho JS CPU-bound dùng **`worker_threads`** (hoặc process tách). Đây **không** phải mô hình OS thread chia sẻ heap như `Thread` / `Task.Run` trong C#.

> **Quy tắc chọn nhanh**: I/O (DB/HTTP/fs) → **async trên event loop**. CPU JS làm lag loop → **`worker_threads`**. Scale HTTP multi-core / crash isolation → **nhiều process** (`cluster` / PM2 / K8s). Gọi CLI / binary → **`child_process`**.

---

## Mục lục

- [Worker Threads \& Child Process](#worker-threads--child-process)
  - [Mục lục](#mục-lục)
  - [1. Khi nào workers / child\_process / cluster / chỉ async](#1-khi-nào-workers--child_process--cluster--chỉ-async)
  - [2. So sánh nhanh](#2-so-sánh-nhanh)
  - [3. `worker_threads`](#3-worker_threads)
    - [3.1 Tạo `Worker`](#31-tạo-worker)
    - [3.2 `parentPort`, `workerData`, `isMainThread`](#32-parentport-workerdata-ismainthread)
    - [3.3 `postMessage`, structured clone \& transferables](#33-postmessage-structured-clone--transferables)
    - [3.4 `MessageChannel` / `MessagePort`](#34-messagechannel--messageport)
    - [3.5 `SharedArrayBuffer` \& `Atomics` — pitfalls](#35-sharedarraybuffer--atomics--pitfalls)
    - [3.6 Worker pool pattern](#36-worker-pool-pattern)
    - [3.7 Error propagation \& termination](#37-error-propagation--termination)
  - [4. `child_process`](#4-child_process)
    - [4.1 `spawn` / `execFile` / `fork` — khi nào dùng](#41-spawn--execfile--fork--khi-nào-dùng)
    - [4.2 IPC với `fork`](#42-ipc-với-fork)
    - [4.3 Promise API](#43-promise-api)
  - [5. `cluster`](#5-cluster)
  - [6. Resource limits, memory, khi **không** dùng workers](#6-resource-limits-memory-khi-không-dùng-workers)
  - [7. Testing notes](#7-testing-notes)
  - [8. Best practices](#8-best-practices)
  - [9. Checklist](#9-checklist)
  - [10. Cheat sheet](#10-cheat-sheet)
  - [11. Version notes](#11-version-notes)
  - [12. Tài liệu liên quan](#12-tài-liệu-liên-quan)

---

## 1. Khi nào workers / child_process / cluster / chỉ async

| Tình huống | Chọn | Lý do |
|---|---|---|
| HTTP/DB/fs chờ I/O | **async / Promise** | Event loop + libuv đã concurrent I/O |
| JSON/crypto JS/image làm p99 lag | **`worker_threads`** | Offload CPU JS khỏi main loop |
| Scale server N core, request I/O-bound | **`cluster` / PM2 / K8s** | Nhiều process = nhiều event loop |
| Gọi `ffmpeg`, `git`, binary C | **`child_process.spawn`** | Process OS + stdio |
| Sandbox / memory cap theo process | **`child_process` / container** | Worker native crash vẫn rủi ro cả process |
| Chỉ fs/crypto native bão hòa | Đo **libuv pool** trước | `UV_THREADPOOL_SIZE` + giới hạn concurrency — [event-loop.md](event-loop.md) |

> **Không** spawn worker “cho chắc”. Đo event loop delay / ELU trước. Nhiều service chỉ cần async + giới hạn concurrency.

- `await` **không** chạy CPU trên core khác — chỉ nhường loop khi promise settle.
- Worker = **V8 isolate + event loop riêng**; giao tiếp bằng message (clone / transfer / SAB).
- `child_process` nặng hơn (startup, RAM) nhưng isolation tốt hơn.

---

## 2. So sánh nhanh

| | **async (main)** | **worker_threads** | **cluster** | **child_process** |
|---|---|---|---|---|
| Đơn vị | 1 event loop | Thread cùng process | Nhiều process Node | Process bất kỳ |
| Share memory JS | Heap chung | Isolate riêng; SAB tùy chọn | Không | Không |
| Startup | — | Nhẹ hơn process | Nặng hơn worker | Nặng / linh hoạt |
| Crash isolation | Lỗi JS có thể hạ process | `error`/`exit`; native vẫn rủi ro | Process khác sống | Tốt |
| Use-case | I/O-bound | CPU-bound JS | Scale HTTP multi-core | CLI, pipeline, sandbox |

| | **C# / .NET** | **Node.js** |
|---|---|---|
| Thread mặc định | Nhiều thread managed code | **Một** main thread chạy JS |
| Chia sẻ memory | Heap chung + `lock` | Worker **không** share object JS mặc định |
| CPU song song | `Task.Run`, `Parallel` | `worker_threads`; libuv pool (fs/crypto native) |

Biến global parent **invisible** với worker. Mỗi worker `import`/`require` state **riêng** — đừng kỳ vọng `lock` quanh shared heap.

---

## 3. `worker_threads`

### 3.1 Tạo `Worker`

```ts
// main.ts
import { Worker } from "node:worker_threads";

const worker = new Worker(new URL("./heavy-worker.js", import.meta.url), {
  workerData: { n: 40 },
  // resourceLimits: { maxOldGenerationSizeMb: 128 },
});

worker.on("message", (msg) => console.log("result", msg));
worker.on("error", (err) => console.error(err));
worker.on("exit", (code) => {
  if (code !== 0) console.error("exit", code);
});
```

```ts
// heavy-worker.js
import { parentPort, workerData } from "node:worker_threads";

function fib(n: number): number {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

parentPort!.postMessage(fib(workerData.n as number));
```

| Option | Ý nghĩa |
|---|---|
| `workerData` | Clone một lần lúc start |
| `eval: true` | `filename` là source string — prod ưu tiên file |
| `execArgv` | Flag V8/Node cho worker |
| `resourceLimits` | Giới hạn heap / young gen |
| `transferList` | Transferables kèm `workerData` |
| `name` | Tên debug (Inspector) |

> ESM: `new URL("./w.js", import.meta.url)` ổn định khi CWD đổi / systemd. Prod: file `.js` đã emit.

### 3.2 `parentPort`, `workerData`, `isMainThread`

```ts
import { isMainThread, parentPort, workerData, threadId } from "node:worker_threads";

if (isMainThread) {
  // tạo Worker
} else {
  console.log("tid", threadId, workerData);
  parentPort?.postMessage({ ok: true });
}
```

- `parentPort`: `MessagePort` nối parent ↔ worker (`null` nếu không phải worker).
- `workerData`: snapshot đã clone — **không** live-bind object parent.
- Cùng file parent+worker qua `isMainThread` — cẩn thận bundler.

### 3.3 `postMessage`, structured clone & transferables

```ts
worker.postMessage({ type: "job", payload: { id: 1 } });

const buf = new ArrayBuffer(1024 * 1024);
worker.postMessage({ buf }, [buf]); // transfer — sender detached (byteLength === 0)
```

- Payload qua **structured clone** (cùng thuật toán `structuredClone`).
- Clone được: plain object, Array, Map/Set, Date, TypedArray, Error (một phần), …
- **Không** clone: function, phần lớn native handle Node.

```ts
const copy = structuredClone({ a: 1, b: new Map([["k", 2]]) });
const ab = new ArrayBuffer(8);
const moved = structuredClone({ ab }, { transfer: [ab] });
```

> Buffer lớn: **transfer** khi sender không còn cần. Message JSON-like + typed buffer; đừng gửi class có method.

### 3.4 `MessageChannel` / `MessagePort`

Kênh độc lập (worker↔worker, tách khỏi `parentPort`):

```ts
import { MessageChannel, Worker } from "node:worker_threads";

const { port1, port2 } = new MessageChannel();
const w = new Worker(new URL("./w.js", import.meta.url));

w.postMessage({ port: port2 }, [port2]);
port1.on("message", (m) => console.log(m));
port1.postMessage("ping");
```

Trong worker: nhận `port`, lắng `message`; `.on('message')` thường auto-start (`port.start()` nếu dùng API cũ). Sau transfer, port **chỉ** sống phía nhận. `port.close()` khi xong.

### 3.5 `SharedArrayBuffer` & `Atomics` — pitfalls

```ts
const sab = new SharedArrayBuffer(1024);
const view = new Int32Array(sab);
worker.postMessage(sab); // share bytes — không “hết” sau gửi

Atomics.store(view, 0, 1);
Atomics.notify(view, 0, 1);
// phía kia: Atomics.wait(view, 0, 0);
```

| Vấn đề | Hệ quả |
|---|---|
| Ghi `view[i]=x` không Atomics | Race / tear |
| `Atomics.wait` trên **main** | **Block event loop** — chỉ wait trong worker |
| Quên `notify` | Worker treo |
| Giả định object JS trong SAB | Chỉ raw bytes — không có object graph |

> Mặc định: **message bất biến**. SAB chỉ khi đo được lợi ích (ring buffer, counter) và team nắm memory model.

### 3.6 Worker pool pattern

Spawn mỗi request = đắt. Pool cố định ≈ `os.availableParallelism()`, queue job, reuse worker.

```ts
import { Worker } from "node:worker_threads";
import os from "node:os";

type Job = { id: number; payload: unknown };
type Result = { id: number; ok: boolean; value?: unknown; error?: string };

export class WorkerPool {
  #free: Worker[] = [];
  #queue: Job[] = [];
  #pending = new Map<number, { resolve: (r: Result) => void; timer: NodeJS.Timeout }>();
  #nextId = 1;
  #workers: Worker[] = [];

  constructor(script: URL, size = os.availableParallelism()) {
    for (let i = 0; i < size; i++) this.#spawn(script);
  }

  #spawn(script: URL) {
    const w = new Worker(script);
    w.on("message", (result: Result) => {
      const p = this.#pending.get(result.id);
      if (p) {
        clearTimeout(p.timer);
        p.resolve(result);
        this.#pending.delete(result.id);
      }
      this.#free.push(w);
      this.#drain();
    });
    w.on("exit", (code) => {
      this.#workers = this.#workers.filter((x) => x !== w);
      this.#free = this.#free.filter((x) => x !== w);
      if (code !== 0) this.#spawn(script);
    });
    this.#workers.push(w);
    this.#free.push(w);
  }

  run(payload: unknown, timeoutMs = 30_000): Promise<Result> {
    const id = this.#nextId++;
    const job: Job = { id, payload };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`job ${id} timeout`));
      }, timeoutMs);
      this.#pending.set(id, { resolve, timer });
      this.#queue.push(job);
      this.#drain();
    });
  }

  #drain() {
    while (this.#free.length && this.#queue.length) {
      this.#free.pop()!.postMessage(this.#queue.shift()!);
    }
  }

  async close() {
    await Promise.all(this.#workers.map((w) => w.terminate()));
  }
}
```

Worker: nhận `{ id, payload }`, trả `{ id, ok, value|error }`.

> Production: **`piscina`** / **`workerpool`** (queue, stats, recirculate). Skeleton trên thiếu cancel/backpressure đầy đủ.

### 3.7 Error propagation & termination

```ts
worker.on("error", (err) => console.error("worker error", err));
worker.on("messageerror", (err) => console.error("deserialize", err));
worker.on("exit", (code) => { /* ≠0 → thất bại */ });
await worker.terminate(); // ép dừng; job đang chạy mất
```

| Cơ chế | Hành vi |
|---|---|
| `throw` không bắt trong worker | `error` + exit ≠ 0 |
| Lỗi clone message | `messageerror` / exception phía gửi |
| `terminate()` | Dừng ngay — pool phải reject job |
| Native crash (addon) | Có thể hạ **cả process** |

```ts
parentPort!.on("message", (msg) => {
  void handle(msg).catch((err: unknown) => {
    parentPort!.postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  });
});
```

Parent: **timeout + terminate**; luôn gắn `error`/`exit` — không leak handle.

---

## 4. `child_process`

### 4.1 `spawn` / `execFile` / `fork` — khi nào dùng

```ts
import { spawn, execFile, fork } from "node:child_process";

const child = spawn("node", ["script.js", "--flag"], { stdio: "pipe" });
child.stdout?.on("data", (c) => process.stdout.write(c));
child.on("close", (code, signal) => console.log({ code, signal }));

execFile("node", ["-v"], (err, stdout) => console.log(stdout.trim()));

const forked = fork("./worker-process.js");
forked.send({ type: "start" });
forked.on("message", (msg) => console.log(msg));
```

| API | Output | Shell | IPC Node | Khi dùng |
|---|---|---|---|---|
| **`spawn`** | Stream | Không (trừ `shell:true`) | Không | CLI dài, pipe, binary lớn |
| **`execFile`** | Buffer | Không | Không | Output nhỏ, cần chuỗi |
| **`exec`** | Buffer | **Có** | Không | Tránh với input user → injection |
| **`fork`** | Tùy stdio | Không | **Có** | Module Node tách process |

> Ưu tiên `spawn`/`execFile` + mảng args. Không `exec` string shell với user input.

### 4.2 IPC với `fork`

```ts
const child = fork(new URL("./task.js", import.meta.url));
child.send({ type: "work", n: 10 });
child.on("message", (msg) => {
  console.log(msg);
  child.disconnect();
});

// task.js
process.on("message", (msg: { n?: number }) => {
  process.send?.({ result: (msg.n ?? 0) * 2 });
});
```

- Serialization nội bộ — đừng gửi function.
- `send` trả `boolean` (backpressure); nhớ `disconnect`/`kill`.
- Khác worker: **process tách**, startup nặng hơn, crash isolation tốt hơn.

### 4.3 Promise API

```ts
import { execFile } from "node:child_process/promises";

const { stdout } = await execFile("node", ["-v"]);
// AbortSignal trong options để hủy (Node hiện đại)
```

- `maxBuffer` giới hạn — tăng có chủ đích hoặc dùng `spawn` stream.
- Xử lý `error` (ENOENT khi thiếu binary) và `close`/`exit`.

---

## 5. `cluster`

```ts
import cluster from "node:cluster";
import http from "node:http";
import os from "node:os";

if (cluster.isPrimary) {
  for (let i = 0; i < os.availableParallelism(); i++) cluster.fork();
  cluster.on("exit", (worker) => {
    console.log("dead", worker.process.pid);
    cluster.fork();
  });
} else {
  http.createServer((_req, res) => res.end(`ok ${process.pid}`)).listen(3000);
}
```

- Nhiều team dùng **PM2 / systemd / K8s replicas** thay `cluster` trong app.
- Không giải CPU trong một handler — mỗi process vẫn single-threaded JS.
- State in-memory **không** share → Redis / sticky session.
- Dùng `cluster.isPrimary` (không `isMaster`).

---

## 6. Resource limits, memory, khi **không** dùng workers

| Chủ đề | Chi tiết |
|---|---|
| Memory | Mỗi worker ≈ heap V8 riêng — 8 worker × heap lớn = OOM |
| `resourceLimits` | Fail worker khi vượt heap |
| Startup | Parse/compile module — pool dài hạn, không spawn/request |
| Message cost | Clone lớn đắt; transfer buffer; tránh chatty IPC |
| Oversubscribe | workers ≫ core (CPU-bound) → chậm hơn pool nhỏ |

**Không dùng workers khi:**

1. Workload thuần I/O async.
2. Việc đã ở libuv pool và không block JS (đo trước).
3. Job cực ngắn — overhead message > lợi ích.
4. Cần isolation cứng / memory cap OS → **process/container**.
5. Addon native không thread-safe.

---

## 7. Testing notes

- Tách logic thuần khỏi `parentPort`; worker file = thin wrapper.
- Integration: `Worker` + fixture; `terminate` trong `finally`.
- Inject runner (`runInWorker` / `runInProcess`) thay mock toàn cục.
- Test failure: worker `exit` giữa chừng, timeout path.
- Coverage trên worker thread có thể lệch — integration riêng.

```ts
import { once } from "node:events";
import { Worker } from "node:worker_threads";
import { test } from "node:test";
import assert from "node:assert/strict";

test("worker fib", async () => {
  const w = new Worker(new URL("./fixtures/fib-worker.js", import.meta.url), {
    workerData: { n: 10 },
  });
  try {
    const [result] = await once(w, "message");
    assert.equal(result, 55);
  } finally {
    await w.terminate();
  }
});
```

---

## 8. Best practices

1. Async trước; worker khi đo được lag CPU JS.
2. Message `{ id, type, payload }` / `{ id, ok, … }` — correlating id bắt buộc.
3. Lắng `error`+`exit`; timeout → `terminate`; `close()` pool khi SIGINT/SIGTERM.
4. Transfer `ArrayBuffer` lớn; tránh SAB trừ khi cần; không `Atomics.wait` trên main.
5. Pool size ≈ `availableParallelism()`; đừng spawn/request.
6. `spawn`/`execFile` + args array — không `exec` shell với user input.
7. Scale HTTP: process manager / K8s thường hơn tự `cluster`.
8. ESM path: `new URL("./w.js", import.meta.url)`.
9. Nghĩ **message-passing isolates**, không shared-heap threads.

---

## 9. Checklist

```text
□ Bottleneck là CPU JS (không chỉ I/O) trước khi thêm worker
□ Pool cố định + job id + timeout + terminate; không leak Worker
□ Lắng error/exit/messageerror; worker entry catch rejection
□ Buffer lớn: transfer; message JSON-like
□ Không Atomics.wait trên main; SAB có lý do đo được
□ child_process: spawn/execFile; không exec shell + user input
□ fork IPC: disconnect/kill; nhớ isolation vs worker
□ Ước heap × số worker; cân nhắc resourceLimits
□ Test: logic thuần tách parentPort; terminate trong finally
□ Shutdown: đóng pool / kill child trước exit
```

---

## 10. Cheat sheet

| Cần | Dùng |
|---|---|
| I/O concurrent | async trên main |
| CPU JS song song | `Worker` + pool |
| Kênh riêng | `MessageChannel` + transfer port |
| Zero-copy buffer | `postMessage(buf, [buf])` |
| Shared bytes | `SharedArrayBuffer` + `Atomics` |
| Gọi binary | `spawn` / `execFile` |
| Node con + IPC | `fork` + `send`/`message` |
| Multi-process HTTP | `cluster` / PM2 / K8s |
| Dừng worker | `worker.terminate()` |
| Path ESM | `new URL("./w.js", import.meta.url)` |

```ts
import { Worker, isMainThread, parentPort } from "node:worker_threads";

if (isMainThread) {
  const w = new Worker(new URL(import.meta.url));
  w.postMessage({ n: 5 });
  w.on("message", console.log);
} else {
  parentPort!.on("message", ({ n }) => parentPort!.postMessage(n * 2));
}
```

---

## 11. Version notes

| Dòng | Ghi chú |
|---|---|
| **Node 26** (baseline) | `worker_threads` / `child_process` / `cluster` ổn định |
| Node 24 LTS | Cùng mô hình — changelog nếu API rất mới |
| `os.availableParallelism()` | Ưu tiên hơn `os.cpus().length` (container-aware hơn) |
| `structuredClone` | Global; cùng thuật toán với `postMessage` |
| `resourceLimits` | Giới hạn heap worker |
| `cluster.isPrimary` | Thay `isMaster` deprecated |
| `child_process/promises` + `AbortSignal` | Hủy subprocess |

---

## 12. Tài liệu liên quan

- [event-loop.md](event-loop.md) — blocking, libuv pool, khi offload
- [async.md](async.md) — Promise / AbortSignal trước khi nghĩ thread
- [main-function.md](main-function.md) — entry, signal shutdown (đóng pool)
- [nodejs-apis.md](nodejs-apis.md) — fs, http, stream
- [exceptions.md](exceptions.md) — unhandledRejection / error
- [node26-ts7.md](node26-ts7.md) — baseline Node 26 & TS 7
