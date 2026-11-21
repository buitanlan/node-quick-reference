# Worker Threads & Child Process

*(worker_threads, cluster, child_process — mô hình song song trên Node)*

Baseline: **Node.js 26** + **TypeScript 7**. JS trên main thread vẫn **một call stack**; song song thật cho JS CPU-bound dùng **`worker_threads`** (hoặc process tách). Đây **không** phải mô hình OS thread chia sẻ heap như `Thread` / `Task.Run` trong C#.

> **Quy tắc chọn nhanh**: I/O (DB/HTTP/fs) → **async trên event loop**. CPU JS làm lag loop → **`worker_threads`**. Scale HTTP multi-core / crash isolation → **nhiều process** (`cluster` / PM2-like / K8s). Gọi CLI / binary → **`child_process`**.

---

## Mục lục

- [1. Khi nào workers / child_process / cluster / chỉ async](#1-khi-nào-workers--child_process--cluster--chỉ-async)
  - [1.1 Khi **không** thread (I/O-bound)](#11-khi-không-thread-io-bound)
  - [1.2 I/O trong worker — khi nào sai](#12-io-trong-worker--khi-nào-sai)
- [2. So sánh nhanh (kể cả PM2-like)](#2-so-sánh-nhanh-kể-cả-pm2-like)
- [3. `worker_threads`](#3-worker_threads)
  - [3.1 Tạo `Worker`](#31-tạo-worker)
  - [3.2 `parentPort`, `workerData`, `isMainThread`](#32-parentport-workerdata-ismainthread)
  - [3.3 `postMessage`, structured clone & transfer list](#33-postmessage-structured-clone--transfer-list)
  - [3.4 `MessageChannel` / `MessagePort`](#34-messagechannel--messageport)
  - [3.5 `receiveMessageOnPort`](#35-receivemessageonport)
  - [3.6 `SharedArrayBuffer` & `Atomics` — data race](#36-sharedarraybuffer--atomics--data-race)
  - [3.7 Worker pool & backpressure](#37-worker-pool--backpressure)
  - [3.8 `resourceLimits`](#38-resourcelimits)
  - [3.9 Uncaught exception trong worker](#39-uncaught-exception-trong-worker)
  - [3.10 `terminate` vs abort](#310-terminate-vs-abort)
  - [3.11 `environmentData` & `SHARE_ENV`](#311-environmentdata--share_env)
  - [3.12 `postMessageToThread`](#312-postmessagetothread)
  - [3.13 `BroadcastChannel` (cùng process)](#313-broadcastchannel-cùng-process)
- [4. `child_process`](#4-child_process)
  - [4.1 `spawn` / `execFile` / `fork` / `exec`](#41-spawn--execfile--fork--exec)
  - [4.2 `execFile` vs `exec` — injection](#42-execfile-vs-exec--injection)
  - [4.3 `fork` IPC vs `spawn` stdio](#43-fork-ipc-vs-spawn-stdio)
  - [4.4 Promise API](#44-promise-api)
  - [4.5 stdio & treo pipe](#45-stdio--treo-pipe)
- [5. `cluster`](#5-cluster)
  - [5.1 `cluster` vs PM2 vs K8s](#51-cluster-vs-pm2-vs-k8s)
  - [5.2 IPC `cluster`](#52-ipc-cluster)
- [6. Resource limits, memory, khi **không** dùng workers](#6-resource-limits-memory-khi-không-dùng-workers)
- [7. Testing notes](#7-testing-notes)
  - [7.1 Inspector & debug](#71-inspector--debug)
  - [7.2 Transfer `FileHandle` & TCP: ownership và version gate](#72-transfer-filehandle--tcp-ownership-và-version-gate)
  - [7.3 Tạo worker thất bại](#73-tạo-worker-thất-bại)
  - [7.4 Capture stdout worker](#74-capture-stdout-worker)
  - [7.5 Sai lầm transfer thường gặp](#75-sai-lầm-transfer-thường-gặp)
  - [7.6 Abort job trong pool (cooperative → terminate)](#76-abort-job-trong-pool-cooperative--terminate)
  - [7.7 `child_process` vs worker — bảng quyết định CPU native](#77-child_process-vs-worker--bảng-quyết-định-cpu-native)
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

> **Không** spawn worker “cho chắc”. Đo event loop delay / ELU trước. Nhiều service chỉ cần async + giới hạn concurrency — [async.md](async.md).

- `await` **không** chạy CPU trên core khác — chỉ nhường loop khi promise settle.
- Worker = **V8 isolate + event loop riêng**; giao tiếp bằng message (clone / transfer / SAB).
- `child_process` nặng hơn (startup, RAM) nhưng isolation tốt hơn.

### 1.1 Khi **không** thread (I/O-bound)

Threading **không** tăng QPS khi bottleneck là chờ mạng/disk:

1. Workload thuần `fetch` / DB / `fs/promises` — event loop đủ; thêm worker chỉ thêm clone + IPC.
2. Việc đã ở libuv pool và **không** block JS (đo ELU thấp, delay thấp, fs vẫn chậm → pool, không worker JS).
3. Job cực ngắn (vài µs) — overhead `postMessage` > lợi ích.
4. Addon native **không** thread-safe — worker vẫn cùng process, crash native hạ cả process.
5. Cần isolation cứng / cgroup memory → **process/container**, không worker.

Triệu chứng “cần thread”: `monitorEventLoopDelay` p99 cao **và** CPU JS (không phải `iowait`). Triệu chứng “đừng thread”: ELU thấp, p99 HTTP = chờ upstream.

### 1.2 I/O trong worker — khi nào sai

Đưa `fetch`/DB vào worker **không** tăng throughput I/O: mỗi worker một event loop, nhưng bạn đã có loop main; thêm RAM isolate + clone. Chỉ đáng nếu:

- CPU **sau** I/O (decode image, parse) phải ở worker — I/O có thể main rồi `postMessage` buffer **transfer**.
- Library đồng bộ-only (một số native) mà bạn không muốn block main — lúc đó worker là “ghetto thread” cho sync API, không phải vì I/O async.

```ts
// ✅ main I/O, worker CPU — tách ArrayBuffer riêng trước khi transfer
const buf = await readFile(path); // Buffer nhỏ có thể dùng chung slab pool 8 KiB!
const owned =
  buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength
    ? buf.buffer
    : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
worker.postMessage({ bytes: new Uint8Array(owned) }, [owned]);

// ❌ BẪY SLAB CORRUPTION: worker.postMessage({ buf }, [buf.buffer])
// Nếu buf nằm trong pool slab 8 KiB chung, detach buf.buffer sẽ làm hỏng các Buffer khác chia sẻ cùng slab!
// ❌ spawn worker chỉ để fs.readFile — overhead
```

Pool Promise trên main cho I/O; pool Worker cho CPU. Hai pool **khác việc**.

---

## 2. So sánh nhanh (kể cả PM2-like)

| | **async (main)** | **worker_threads** | **cluster** | **child_process** | **PM2 / systemd / K8s** |
|---|---|---|---|---|---|
| Đơn vị | 1 event loop | Thread cùng process | Nhiều process Node (in-app) | Process bất kỳ | Nhiều process **ngoài** app |
| Share memory JS | Heap chung | Isolate riêng; SAB tùy chọn | Không | Không | Không |
| Startup | — | Nhẹ hơn process | Nặng hơn worker | Nặng / linh hoạt | Image/process manager |
| Crash isolation | Lỗi JS có thể hạ process | `error`/`exit`; native vẫn rủi ro | Process khác sống | Tốt | Tốt + restart policy |
| Use-case | I/O-bound | CPU-bound JS | Scale HTTP multi-core | CLI, pipeline, sandbox | Production scale / ops |

**PM2-like** (PM2 `cluster`/`fork`, systemd socket activate, Kubernetes replicas, ECS tasks): cùng ý “nhiều process Node”, nhưng **vòng đời, log, rolling restart, health** nằm ngoài code. In-process `cluster` hữu ích khi không có orchestrator (VPS thuần). Có K8s/PM2 rồi: **đừng** lồng `cluster.fork()` thêm trừ khi hiểu double-multiply.

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
// heavy-worker.ts (chạy trực tiếp với Node strip hoặc tsc emit ra heavy-worker.js)
import { parentPort, workerData } from "node:worker_threads";

if (!parentPort) throw new Error("Must run inside a worker thread");

function fib(n: number): number {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

parentPort.postMessage(fib((workerData as { n: number }).n));
```

| Option | Ý nghĩa |
|---|---|
| `workerData` | Clone một lần lúc start |
| `eval: true` | `filename` là source string — prod ưu tiên file |
| `execArgv` | Flag V8/Node cho worker |
| `resourceLimits` | Giới hạn heap / young gen — §3.8 |
| `transferList` | Transferables kèm `workerData` |
| `name` | Tên debug cho Inspector (đọc lại qua property `worker.threadName` / export `threadName`, không dùng làm security id) |
| `stdin` / `stdout` / `stderr` | Pipe stdio worker |

> ESM: `new URL("./w.js", import.meta.url)` ổn định khi CWD đổi / systemd. Prod: file `.js` đã emit.

```ts
async function example() {
  await using worker = new Worker(new URL("./w.js", import.meta.url));
  // Symbol.asyncDispose → terminate() khi rời scope (Node 22.18+ / 24.2+)
}
```

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
- ALS / request context **không** sang worker — gửi `reqId` trong message ([abort-context.md](abort-context.md)).

### 3.3 `postMessage`, structured clone & transfer list

```ts
worker.postMessage({ type: "job", payload: { id: 1 } });

const buf = new ArrayBuffer(1024 * 1024);
worker.postMessage({ buf }, [buf]); // transfer — sender detached (byteLength === 0)
```

- Payload qua **structured clone** (cùng thuật toán `structuredClone`).
- Clone được: plain object, Array, Map/Set, Date, TypedArray, Error (một phần), circular ref, `RegExp`, `BigInt`, `CryptoKey`, `KeyObject`, …
- **Không** clone: function, class instance methods, phần lớn native handle.

```ts
const copy = structuredClone({ a: 1, b: new Map([["k", 2]]) });
const ab = new ArrayBuffer(8);
const moved = structuredClone({ ab }, { transfer: [ab] });
```

**Transfer list** — move, không copy. Sau transfer, phía gửi **không dùng được** object đó.

| Transferable (Node) | Ghi chú |
|---|---|
| `ArrayBuffer` | Sender `byteLength === 0` (detached); **cẩn thận `Buffer` dùng chung 8 KiB slab pool** (§1.2) |
| `MessagePort` | Bắt buộc liệt kê nếu nằm trong `value` — thiếu → `ERR_MISSING_MESSAGE_PORT_IN_TRANSFER_LIST` |
| `ReadableStream` / `WritableStream` / `TransformStream` | WHATWG Web Streams là Transferable chuẩn trên Node 26 (liệt kê trong `transferList`) |
| `FileHandle` | Chuyển fd sang isolate kia |
| `net.Server` / `net.Socket` (TCP) | Có trong docs **26.10.0**; điều kiện ownership và gate ở §7.2, không suy ra mọi 26.x/24 |
| Không: `SharedArrayBuffer` | Share, **không** transfer — không đưa vào list |

Object trong `transferList` nhưng không reachable từ `value` vẫn bị detach. Untransferable trong list → throw (Node 21+). `ArrayBuffer` **không** trong list → **copy**. Dùng **`markAsUntransferable(obj)`** (từ `node:worker_threads`) khi muốn chặn object/buffer cụ thể vô tình bị transfer (ví dụ buffer thuộc slab pool nội bộ).

> Buffer lớn: **transfer** khi sender không còn cần (và đã xác nhận là standalone `ArrayBuffer`, không chung pool slab). Message JSON-like + typed buffer; đừng gửi class có method. WHATWG Web Streams (`ReadableStream`/`WritableStream`/`TransformStream`) transfer được chuẩn trên Node 26 qua `transferList`.

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

Trong worker: nhận `port`, lắng `message`; `.on('message')` thường auto-start (`port.start()` nếu dùng API cũ). Sau transfer, port **chỉ** sống phía nhận. `port.close()` khi xong — cả hai đầu nhận `'close'`.

`messageerror`: deserialize thất bại (hiếm; object Node trong `vm.Context` lệch).

### 3.5 `receiveMessageOnPort`

Nhận **sync** một message khỏi queue — **không** emit `'message'`, không gọi `onmessage`.

```ts
import { MessageChannel, receiveMessageOnPort } from "node:worker_threads";

const { port1, port2 } = new MessageChannel();
port1.postMessage({ hello: "world" });

receiveMessageOnPort(port2); // { message: { hello: 'world' } }
receiveMessageOnPort(port2); // undefined
```

Dùng khi worker **spin** với `Atomics.wait` rồi rút message không vào event loop `'message'` (hot path ring buffer). Mix `receiveMessageOnPort` + `port.on("message")` trên cùng port: message lấy sync **mất** với listener. Chọn một mô hình.

### 3.6 `SharedArrayBuffer` & `Atomics` — data race

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
| Ghi `view[i]=x` không Atomics | Race / tear (đặc biệt value > 1 word) |
| `Atomics.wait` trên **main** | **Block event loop** — chỉ wait trong worker |
| Quên `notify` | Worker treo |
| Giả định object JS trong SAB | Chỉ raw bytes — không có object graph |
| SAB + clone lẫn | SAB share; `ArrayBuffer` clone/transfer — đừng nhầm |

`Atomics.waitAsync` (ES2024 / V8 trên Node 26): wait **không** block thread — trả `{ async: false, value }` hoặc `{ async: true, value: Promise }`. Dùng trên main nếu cần; vẫn ưu tiên message + event loop.

> Mặc định: **message bất biến**. SAB chỉ khi đo được lợi ích (ring buffer, counter) và team nắm memory model. `Atomics.wait` + `receiveMessageOnPort`: pattern producer/consumer thấp tầng — dễ livelock nếu wait sai index.

Ví dụ race (đừng làm):

```ts
// thread A
view[0] = 1;
view[1] = 2; // không atomic với nhau — B có thể thấy 1 rồi 0

// thread B
const x = view[0];
const y = view[1];
```

Đúng: một index “generation” + `Atomics.compareExchange` / `store`+`notify`. Int32/BigInt64 mới là đơn vị Atomics; không `Atomics.store` trên `Float64Array` — pack Int32 hoặc đừng share float rời.

### 3.7 Worker pool & backpressure

Spawn mỗi request = đắt. Pool cố định ≈ `os.availableParallelism()`, queue job, reuse worker.

```ts
import { Worker } from "node:worker_threads";
import os from "node:os";

type Job = { id: number; payload: unknown };
type Result = { id: number; ok: boolean; value?: unknown; error?: string };

type Pending = {
  resolve: (r: Result) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

export class WorkerPool {
  #script: URL;
  #free: Worker[] = [];
  #queue: Job[] = [];
  #pending = new Map<number, Pending>();
  #inFlight = new Map<Worker, number>();
  #workers = new Set<Worker>();
  #respawnTimers = new Set<NodeJS.Timeout>();
  #nextId = 1;
  #maxQueue: number;
  #closed = false;
  #consecutiveBootFailures = 0;
  readonly #maxBootFailures = 5;

  constructor(script: URL, size = os.availableParallelism(), maxQueue = 100) {
    this.#script = script;
    this.#maxQueue = maxQueue;
    for (let i = 0; i < size; i++) this.#spawn();
  }

  #spawn() {
    if (this.#closed) return;
    const w = new Worker(this.#script);
    let handledJob = false;

    w.on("message", (result: Result) => {
      handledJob = true;
      this.#consecutiveBootFailures = 0;
      this.#inFlight.delete(w);
      const p = this.#pending.get(result.id);
      if (p) {
        clearTimeout(p.timer);
        this.#pending.delete(result.id);
        p.resolve(result);
      }
      if (!this.#closed) {
        this.#free.push(w);
        this.#drain();
      }
    });

    w.on("error", (err) => {
      console.error("worker error", err);
    });

    w.on("exit", (code) => {
      this.#workers.delete(w);
      this.#free = this.#free.filter((x) => x !== w);

      // Reject ngay job đang in-flight trên worker bị chết thay vì treo tới timeout
      const activeId = this.#inFlight.get(w);
      if (activeId !== undefined) {
        this.#inFlight.delete(w);
        const p = this.#pending.get(activeId);
        if (p) {
          clearTimeout(p.timer);
          this.#pending.delete(activeId);
          p.reject(new Error(`worker exited (${code}) during job ${activeId}`));
        }
      }

      if (this.#closed || code === 0) return;

      // Giới hạn retry + backoff khi worker crash loop ngay lúc boot
      if (!handledJob) {
        this.#consecutiveBootFailures++;
        if (this.#consecutiveBootFailures > this.#maxBootFailures) {
          console.error("worker boot crash loop; stop respawning");
          return;
        }
      }
      const delayMs = handledJob ? 0 : Math.min(1_000 * 2 ** (this.#consecutiveBootFailures - 1), 10_000);
      const t = setTimeout(() => {
        this.#respawnTimers.delete(t);
        this.#spawn();
      }, delayMs);
      this.#respawnTimers.add(t);
    });

    this.#workers.add(w);
    this.#free.push(w);
    this.#drain();
  }

  run(payload: unknown, timeoutMs = 30_000): Promise<Result> {
    if (this.#closed) {
      return Promise.reject(new Error("worker pool closed"));
    }
    if (this.#queue.length >= this.#maxQueue) {
      return Promise.reject(new Error("worker queue full")); // backpressure
    }
    const id = this.#nextId++;
    const job: Job = { id, payload };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        // Xóa khỏi queue nếu job timeout khi chưa kịp dispatch
        const idx = this.#queue.findIndex((j) => j.id === id);
        if (idx >= 0) this.#queue.splice(idx, 1);
        reject(new Error(`job ${id} timeout`));
      }, timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      this.#queue.push(job);
      this.#drain();
    });
  }

  #drain() {
    if (this.#closed) return;
    while (this.#free.length && this.#queue.length) {
      const w = this.#free.pop()!;
      const job = this.#queue.shift()!;
      this.#inFlight.set(w, job.id);
      w.postMessage(job);
    }
  }

  async close() {
    this.#closed = true;
    for (const t of this.#respawnTimers) clearTimeout(t);
    this.#respawnTimers.clear();
    this.#queue.length = 0;
    const err = new Error("worker pool closed");
    for (const p of this.#pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.#pending.clear();
    this.#inFlight.clear();
    await Promise.all([...this.#workers].map((w) => w.terminate()));
  }
}
```

Worker: nhận `{ id, payload }`, trả `{ id, ok, value|error }`. **Một job in-flight / worker** (skeleton trên): không `postMessage` chồng khi chưa có result.

**Backpressure:**

- Queue **bounded** — đầy thì reject (HTTP 503) hoặc chờ có ceiling; unbounded = OOM dưới burst.
- Timeout job **không** tự dừng CPU worker — cần `terminate` + spawn lại, hoặc cooperative abort (message / SAB flag). Timeout chỉ reject Promise phía parent.
- `worker.postMessage` nhanh hơn worker xử lý → RAM clone. Transfer buffer lớn; đừng chatty IPC từng byte.
- IPC `child.send()` trả `false` khi backlog lớn hoặc channel đóng; giới hạn queue và dùng callback của `send` để điều tiết. IPC không có event `drain`. `net.Socket.write()` / stdio Writable mới dùng `drain`; Worker `postMessage` tự giới hạn in-flight.

> Production: **`piscina`** / **`workerpool`** (queue, stats, recirculate). Skeleton thiếu cancel đầy đủ.

### 3.8 `resourceLimits`

```ts
const w = new Worker(script, {
  resourceLimits: {
    maxOldGenerationSizeMb: 128,
    maxYoungGenerationSizeMb: 32,
    codeRangeSizeMb: 16,
    stackSizeMb: 4,
  },
});
```

- Chỉ ràng **JS heap / code / stack** của isolate — **không** giới hạn `ArrayBuffer` / native / SAB.
- Vượt hạn: Node **cố** terminate worker (`ERR_WORKER_OUT_OF_MEMORY` / `'error'` + `'exit'`) — **best-effort**. OOM toàn process vẫn có thể **abort cả process** (handler không chạy).
- `worker.resourceLimits` / `worker_threads.resourceLimits`: đọc constraint; main thread không set option → object rỗng.
- 8 worker × heap 512MB = OOM máy — tính tổng, không chỉ “một worker nhỏ”.

### 3.9 Uncaught exception trong worker

Throw không bắt trong worker:

1. Worker **terminate**.
2. Parent nhận `'error'` rồi `'exit'` (code ≠ 0; `terminate()` → exit 1).
3. **Không** đi qua `process.on("uncaughtException")` của **main**.
4. Worker là `EventEmitter`: **không** lắng `'error'` trên `Worker` → EventEmitter ném trên **main** → có thể hạ **cả process**. Luôn `worker.on("error", …)` + `"exit"`.

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

`uncaughtException` **trong** worker (nếu đăng ký) không biến worker thành “On Error Resume Next” an toàn — parent vẫn nên coi uncaught là chết worker. `unhandledRejection` trong worker: cùng kỷ luật [exceptions.md](exceptions.md) / [async.md](async.md) — catch cùng turn.

`postMessage(errorObject)`: Error clone **một phần** (`message`, `name`, không đủ stack/custom enumerable tùy bản). Gửi `{ ok: false, error: { message, name, stack } }` tường minh. `DOMException` / `AggregateError` có thể lệch khi clone — test.

`eval: true` + string source: tiện test, **không** prod (cache, sourcemap). Bundler: worker file URL / `new URL` asset.

`worker.ref()` / `unref()`: giống handle event loop — unref pool background khi CLI sắp thoát; server HTTP giữ ref.

### 3.10 `terminate` vs abort

| | Cooperative abort | `worker.terminate()` |
|--|-------------------|----------------------|
| Cách | `postMessage({ type: "abort" })` / SAB flag / AbortSignal **không** tự sang thread | Dừng JS **ngay khi có thể** |
| Cleanup worker | `finally` / `await using` trong worker chạy được nếu cooperative | **Không** chạy JS tiếp — mất lock/fd trong isolate |
| Promise | Job reject `AbortError` | `terminate()` → `Promise<exitCode>` khi `'exit'` |
| Job đang CPU | Cần check flag định kỳ | Cắt ngay |
| Pool | Reuse worker | Mất worker — spawn lại; reject job parent |

AbortSignal chuẩn **không** structured-clone như live signal sang worker (đừng `workerData: { signal }`). `util.transferableAbortController()` có cho phép chuyển `AbortSignal` giữa worker trong cùng process, nhưng giới hạn rõ: vẫn truyền tín hiệu qua event loop nội bộ của worker nên **không** tự ngắt được vòng lặp CPU đồng bộ (và vẫn ở diện hạn chế/experimental). Với tác vụ CPU-bound trong worker, dùng **cờ `SharedArrayBuffer` + `Atomics`** để hủy hợp tác và `terminate()` làm last resort (§7.6).

```ts
worker.on("error", (err) => console.error("worker error", err));
worker.on("messageerror", (err) => console.error("deserialize", err));
worker.on("exit", (code) => { /* ≠0 → thất bại */ });
await worker.terminate();
```

Native crash (addon): có thể hạ **cả process** — isolation thật = `child_process` / container.

### 3.11 `environmentData` & `SHARE_ENV`

```ts
import { Worker, SHARE_ENV } from "node:worker_threads";

process.env.FOO = "1";
new Worker(script, { env: SHARE_ENV }); // worker thấy/ghi env parent (cẩn thận)
new Worker(script, { env: { ...process.env, FOO: "2" } }); // snapshot
```

`worker_threads` còn `getEnvironmentData` / `setEnvironmentData` (key/value clone sang worker lúc tạo custom) — dữ liệu nhỏ, không thay `workerData` cho job payload. Đừng nhét AbortController.

### 3.12 `postMessageToThread`

Stability **1.1** (active development, Node 22.5+ / 20.19+). Gửi theo `threadId` khi **không** phải cặp parent/child trực tiếp (cây worker lồng). Parent↔child: `worker.postMessage` / `parentPort`.

```ts
import { postMessageToThread, threadId, workerData } from "node:worker_threads";
import process from "node:process";

process.on("workerMessage", (value, source) => {
  // nhận từ thread khác
  console.log(value, source);
});

// Truyền targetThreadId qua workerData thay vì hardcode threadId === 0
const targetId = (workerData as { parentThreadId: number }).parentThreadId;
await postMessageToThread(targetId, { from: threadId, ping: true });
```

- Không listener `workerMessage` ở đích → `ERR_WORKER_MESSAGING_FAILED`.
- `threadId` là chính mình → `ERR_WORKER_MESSAGING_SAME_THREAD`.
- `timeout` ms: hết hạn → `ERR_WORKER_MESSAGING_TIMEOUT`.
- `MessagePort` trong payload phải có `transferList`.

Ưu tiên `MessageChannel` tường minh nếu graph cố định. Không dựa API 1.1 cho đường nóng production trừ khi chấp nhận changelog.

### 3.13 `BroadcastChannel` (cùng process)

```ts
import { BroadcastChannel } from "node:worker_threads";

const ch = new BroadcastChannel("jobs");
ch.onmessage = (ev) => console.log(ev.data);
ch.postMessage({ type: "ready" });
ch.close();
```

Mọi listener cùng tên trong process nhận message (clone). Không thay IPC `fork` giữa **process**. `receiveMessageOnPort` cũng nhận `BroadcastChannel` như port (docs Node). Đóng channel khi worker down.

---

## 4. `child_process`

### 4.1 `spawn` / `execFile` / `fork` / `exec`

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
| **`spawn`** | Stream | Không (trừ `shell: true`) | Không | CLI dài, pipe, binary lớn |
| **`execFile`** | Buffer | Không | Không | Output nhỏ, cần chuỗi |
| **`exec`** | Buffer | **Có** | Không | Tránh với input user → injection |
| **`fork`** | Tùy stdio | Không | **Có** | Module Node tách process |

> Ưu tiên `spawn`/`execFile` + **mảng args**. Không `exec` string shell với user input.

### 4.2 `execFile` vs `exec` — injection

```ts
import { exec, execFile } from "node:child_process";

const name = userInput; // "a.txt; rm -rf /"
exec(`ls ${name}`); // ❌ shell metacharacter
execFile("ls", [name]); // ✅ argv, không qua shell
spawn("ls", [name]); // ✅
spawn(`ls ${name}`, { shell: true }); // ❌ giống exec
```

`exec` / `shell: true`: interpolating user string = command injection. `maxBuffer` trên `exec`/`execFile`: output lớn → error; stream bằng `spawn`.

### 4.3 `fork` IPC vs `spawn` stdio

| | `fork` | `spawn` |
|--|--------|---------|
| Kênh | IPC (`send` / `'message'`), serialization nội bộ | stdio pipes (`stdout` chunks) |
| Payload | Object structured-ish (không function) | Bytes / text protocol tự định nghĩa |
| Backpressure | `send()` → boolean; callback báo gửi xong/lỗi, queue bounded | `writable.write` + `drain` |
| Đời | `disconnect()` / `kill()` | `kill(sig)` / close stdin |
| Startup | Node boot + module | Binary bất kỳ |

```ts
const child = fork(new URL("./task.js", import.meta.url));
const ok = child.send({ type: "work", n: 10 }, (error) => {
  if (error) console.error("IPC send failed", error);
  // Cho phép enqueue tiếp theo theo giới hạn queue của ứng dụng.
});
if (!ok) { /* ngừng enqueue thêm; message này không cần gửi lại */ }
child.on("message", (msg) => {
  console.log(msg);
  child.disconnect();
});

// task.js
process.on("message", (msg: { n?: number }) => {
  process.send?.({ result: (msg.n ?? 0) * 2 });
});
```

`fork` = `spawn(process.execPath, [module])` + IPC fd. Crash isolation tốt hơn worker; startup/RAM nặng hơn. `stdio: 'inherit'` với spawn: log vào parent; `'ignore'` nếu không đọc (tránh đầy pipe treo child).

Serialization `fork`: mặc định JSON-ish; `serialization: 'advanced'` (structured clone, giống worker hơn) trên Node hiện đại — đọc docs `fork` options trước khi gửi Map/Date. Vẫn không gửi function / native socket trừ API transfer riêng.

`child.send` backpressure: `false` không có nghĩa message chưa được nhận vào queue, nên không retry cùng message vô điều kiện. Callback chỉ báo gửi xong/lỗi, có thể chạy trước khi child nhận; ACK nghiệp vụ là message riêng. Channel đóng phải reject các job đang chờ. [IPC contract](https://nodejs.org/api/child_process.html#subprocesssendmessage-sendhandle-options-callback).

### 4.4 Promise API

```ts
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
const execFile = promisify(execFileCallback);

const { stdout } = await execFile("node", ["-v"]);
await execFile("node", ["script.js"], { signal: AbortSignal.timeout(5_000) });
```

- `{ signal, killSignal }` hoạt động trực tiếp trên cả **`spawn`**, **`fork`**, lẫn **`execFile`** (mặc định `killSignal: "SIGTERM"`). Khi `signal` abort, Node tự gửi `killSignal` tới child và emit `AbortError` — tránh phải gắn/gỡ `addEventListener("abort")` thủ công.
- `maxBuffer` giới hạn — tăng có chủ đích hoặc dùng `spawn` stream.
- Xử lý `error` (ENOENT khi thiếu binary) và `close`/`exit`.

### 4.5 stdio & treo pipe

```ts
const child = spawn("ffmpeg", ["-i", inPath, outPath], {
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout?.on("data", onChunk);
child.stderr?.on("data", onLog);
```

Không đọc `stdout`/`stderr` khi `pipe` → OS buffer đầy → **child block** (trông như hang). `stdio: "ignore"` nếu không cần output. `inherit` để debug. `detached` + `unref` cho daemon — đừng trên request path.

`kill('SIGTERM')` rồi timeout `SIGKILL`: giống abort vs terminate. `{ signal, killSignal }` trên `spawn`/`fork`/`execFile` gửi hủy tự động; Windows tín hiệu khác Unix — test trên OS deploy.

`execFile` buffer cả stdout: file 100MB → `maxBuffer` error. Video/ffmpeg: **luôn** `spawn` stream.

```ts
import { spawn } from "node:child_process";

function runFfmpeg(args: string[], signal: AbortSignal): Promise<void> {
  // Kiểm tra trước khi spawn để không tạo process thừa khi đã aborted
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise((resolve, reject) => {
    // Dùng "ignore" cho stdout nếu không đọc — để "pipe" mà không drain sẽ deadlock OS pipe buffer!
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
      signal,
      killSignal: "SIGTERM",
    });
    child.stderr?.resume(); // drain stderr để tránh block
    child.once("error", (err) => {
      reject(signal.aborted ? signal.reason : err);
    });
    child.once("close", (code) => {
      if (signal.aborted) reject(signal.reason);
      else if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}`));
    });
  });
}
```

`shell: true` + user args = injection dù `spawn`. Allowlist binary path; args từng phần tử.

Windows: không `SIGKILL` như Unix — `child.kill()` thường terminate process. **CVE-2024-27980** (Node 20.12.2+ / 24 / 26): gọi `spawn` hoặc `execFile` với file `.bat`/`.cmd` trên Windows mà **không** có `{ shell: true }` sẽ **throw `EINVAL`** ngay lập tức để chặn argument injection; ưu tiên binary `.exe` + mảng argv, nếu buộc gọi `.cmd`/`.bat` phải validate/escape nghiêm ngặt trước khi bật `shell: true`. `windowsHide` option của `spawn`: ẩn console window.

`cwd` / `env` snapshot lúc spawn — đổi `process.env` sau không vào child trừ `SHARE_ENV` (worker) hoặc truyền `env` mới.

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

- Nhiều team dùng **PM2 / systemd / K8s replicas** thay `cluster` trong app (§2).
- Không giải CPU trong một handler — mỗi process vẫn single-threaded JS. Handler CPU nặng: worker **trong** process hoặc tách service.
- State in-memory **không** share → Redis / sticky session.
- Dùng `cluster.isPrimary` (không `isMaster`).
- Round-robin listen (Unix) vs shared port: đọc docs OS; Windows khác.

Restart vô hạn khi boot crash = thundering loop — backoff.

### 5.1 `cluster` vs PM2 vs K8s

| | `cluster` trong app | PM2 `cluster` mode | K8s replicas |
|--|---------------------|--------------------|--------------|
| Ai fork | Primary Node của bạn | PM2 | kubelet / ReplicaSet |
| Rolling restart | Tự viết | `pm2 reload` | RollingUpdate |
| Log / metrics | Tự | PM2 + ship | sidecar / stdout |
| Port share | `listen` + kernel | PM2 proxy / listen | Service / LB |
| Double scale | N worker code × M PM2 = quá nhiều | Chọn **một** lớp | 1 process/pod thường đủ |

PM2 `fork` mode = N process độc lập không share port kernel cluster — cần LB. `exec_mode: cluster` ≈ `cluster.fork` do PM2 làm primary.

Sticky session: cluster round-robin phá WebSocket in-memory — Redis adapter hoặc sticky (PM2 `instance_var` / ingress).

Health: K8s liveness ≠ “process sống” nếu loop block — probe HTTP có timeout; kết hợp ELU [event-loop.md](event-loop.md).

### 5.2 IPC `cluster`

`cluster.fork()` tạo process có `process.send` như `fork`. Primary:

```ts
worker.send({ type: "config", value });
worker.on("message", (msg) => {
  /* metric từ worker */
});
```

Worker: `process.on("message", …)`. Không share Map in-memory. Backpressure `send()` boolean như §4.3.

`worker.kill()` / `worker.disconnect()`: drain HTTP rồi disconnect — tự viết graceful; PM2 reload làm hộ.

`cluster.schedulingPolicy`: `SCHED_RR` vs `SCHED_NONE` (OS). Sticky: không dựa RR cho WebSocket.

---

## 6. Resource limits, memory, khi **không** dùng workers

| Chủ đề | Chi tiết |
|---|---|
| Memory | Mỗi worker ≈ heap V8 riêng — 8 worker × heap lớn = OOM |
| `resourceLimits` | Best-effort; ArrayBuffer không nằm trong hạn; OOM global vẫn chết process |
| Startup | Parse/compile module — pool dài hạn, không spawn/request |
| Message cost | Clone lớn đắt; transfer buffer; tránh chatty IPC |
| Oversubscribe | workers ≫ core (CPU-bound) → chậm hơn pool nhỏ |
| Queue | Bounded + 503; không buffer vô hạn |

**Không dùng workers khi:** I/O-bound (§1.1), job quá ngắn, cần isolation OS, addon không thread-safe, chưa đo được CPU JS.

Ma trận isolation:

| Rủi ro | Worker | `fork` / spawn Node | Container |
|--------|--------|---------------------|-----------|
| Throw JS | Worker chết; main sống nếu có `'error'` | Process chết; sibling sống | Pod chết; replica khác |
| Native abort | **Cả process** | Process đó | Container |
| OOM heap JS | `resourceLimits` best-effort | OS OOM killer process | cgroup |
| CPU noisy neighbor | Cùng process, cùng máy | Cùng máy | Limit CPU request/limit |
| Secret leak RAM | Cùng address space (debug) | Tách hơn | Tách + seccomp |

Chọn worker khi tin native/CPU và muốn IPC rẻ. Chọn process khi crash budget “một job = một đời”.

---

## 7. Testing notes

- Tách logic thuần khỏi `parentPort`; worker file = thin wrapper.
- Integration: `Worker` + fixture; `terminate` / `await using` trong `finally`.
- Inject runner (`runInWorker` / `runInProcess`) thay mock toàn cục.
- Test failure: worker `exit` giữa chừng, timeout path, queue full, `'error'` không listener (đừng làm trên process test chung).
- Coverage trên worker thread có thể lệch — integration riêng.
- `receiveMessageOnPort`: assert `undefined` lần hai; không mix listener.

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

### 7.1 Inspector & debug

- Chrome DevTools: `node --inspect` inspect **main**; worker hiện dưới Threads / attach `inspector` trong worker (`inspector.open()`). Lưu ý `execArgv` kế thừa flag parent trừ khi override — `--inspect` trên mọi worker gây xung đột port; đặt `execArgv: []` hoặc `--inspect-port=0` khi debug (prod tắt inspect).
- `--title` / `name` option của `Worker` (`worker.threadName`): nhận diện dump.
- `worker.threadId`: log mọi message `{ tid, jobId }`.
- ELU & Heap: parent có thể đọc trực tiếp **`worker.performance.eventLoopUtilization()`** để theo dõi độ bận của từng worker mà không cần gửi message ngược (trong khi `monitorEventLoopDelay` chạy nội bộ isolate phải gửi metric qua message). Dùng `worker.getHeapSnapshot()` khi nghi leak isolate — file lớn, không gọi theo request.

Protocol job tối thiểu:

```ts
type JobMsg = { id: number; type: "run" | "abort"; payload?: unknown };
type Reply = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: { message: string; stack?: string } };
```

Worker `switch (msg.type)`: `abort` set flag; `run` kiểm tra flag giữa vòng CPU. Parent timeout: gửi `abort`, `setTimeout` → `terminate()` nếu không `exit`.

### 7.2 Transfer `FileHandle` & TCP: ownership và version gate

Worker Threads chuyển được `FileHandle`, `ArrayBuffer`, `MessagePort`. Docs **26.10.0** còn hỗ trợ TCP `net.Server` / `net.Socket` / `net.BoundSocket`; docs 26.0.0 chưa có hợp đồng TCP này. Với package support nhiều minor, ghim và kiểm bản tối thiểu trước khi dùng. Đây là transfer ownership giữa thread, khác `child.send(message, sendHandle)` giữa process. [Worker transfer list](https://nodejs.org/api/worker_threads.html#portpostmessagevalue-transferlist), [TCP conditions](https://nodejs.org/api/net.html#transferring-tcp-handles-to-other-threads).

`net.Server` chuyển listening handle cùng accept queue. `net.Socket` phải là TCP vừa tạo/accept, chưa bắt đầu đọc, không đang connect và không có buffered data; vi phạm → `ERR_WORKER_HANDLE_NOT_TRANSFERABLE`. Phía gửi không dùng handle sau transfer. `net.BoundSocket` được thêm ở 26.4.0; chỉ TCP transferable, không pipe handle.

`FileHandle` transfer: fd đổi chủ isolate — phía gửi không `close` nữa (đã detach). Double-close = lỗi.

### 7.3 Tạo worker thất bại

Sai path / syntax worker: `'error'` + `'exit'`. Module worker `import` thiếu: chết lúc boot worker — pool `#spawn` phải backoff. `execArgv: ['--no-warnings']` không biến lỗi thành im lặng.

Windows vs Unix path `new URL`: luôn `import.meta.url`. CJS `__filename` khác ESM.

### 7.4 Capture stdout worker

```ts
const w = new Worker(script, { stdout: true, stderr: true });
w.stdout.on("data", (c) => logger.child({ tid: w.threadId }).info(c.toString()));
w.stderr.on("data", (c) => logger.warn(c.toString()));
```

Không `stdout: true` thì `console.log` worker trộn stdout parent — khó lọc. Drain stdout như child_process: đầy pipe → worker `console.log` **block** isolate đó.

### 7.5 Sai lầm transfer thường gặp

| Sai | Lỗi / triệu chứng |
|-----|-------------------|
| `postMessage(port)` không list `transferList` | `ERR_MISSING_MESSAGE_PORT_IN_TRANSFER_LIST` |
| Dùng `ArrayBuffer` sau transfer | `byteLength === 0` / throw detached |
| Transfer `SharedArrayBuffer` | Không hợp lệ — share, đừng list |
| Transfer socket đã đọc / có buffer | Không hợp lệ; TCP transfer chỉ khi trạng thái và phiên bản hỗ trợ (§7.2) |
| Gửi class instance có method | Method mất; còn data enumerable |
| Gửi `AbortSignal` live | Không clone như tín hiệu sống — gửi message abort |
| Mix `receiveMessageOnPort` + `on("message")` | Mất event |

`structuredClone` giúp kiểm tra payload dữ liệu: function bị từ chối, circular reference được hỗ trợ. Native transferable riêng của Node phải kiểm tra theo hợp đồng Worker; class instance thường mất prototype/method khi clone.

### 7.6 Abort job trong pool (cooperative → terminate)

**Lưu ý quan trọng:** Một vòng `for` CPU đồng bộ sẽ **chặn event loop của worker**, nên gửi message `"abort"` qua `parentPort.on("message")` sẽ không bao giờ chạy kịp cho tới khi vòng `for` kết thúc! Để hủy hợp tác thật sự giữa vòng lặp CPU, dùng **`SharedArrayBuffer` + `Int32Array` + `Atomics.load()`** (hoặc rút message đồng bộ bằng `receiveMessageOnPort` trên port riêng):

```ts
// parent — cấp SAB flag cho mỗi job (hoặc tái sử dụng và reset trước khi dispatch)
const cancelSab = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
const cancelFlag = new Int32Array(cancelSab);

async function runWithAbort(worker: Worker, id: number, payload: unknown, signal: AbortSignal) {
  Atomics.store(cancelFlag, 0, 0); // reset flag cho job mới
  let killer: NodeJS.Timeout | undefined;
  const onAbort = () => {
    Atomics.store(cancelFlag, 0, 1); // worker thấy ngay qua Atomics.load
    killer = setTimeout(() => void worker.terminate(), 2_000);
  };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    worker.postMessage({ id, payload, cancelSab });
    return await waitReply(worker, id);
  } finally {
    clearTimeout(killer);
    signal.removeEventListener("abort", onAbort);
  }
}

// worker
import { parentPort } from "node:worker_threads";

if (!parentPort) throw new Error("Must run inside a worker thread");
const port = parentPort;

port.on("message", (msg: { id: number; payload: unknown; cancelSab: SharedArrayBuffer }) => {
  const cancelFlag = new Int32Array(msg.cancelSab);
  try {
    const value = crunchJob(msg.payload, cancelFlag);
    port.postMessage({ id: msg.id, ok: true, value });
  } catch (e) {
    port.postMessage({
      id: msg.id,
      ok: false,
      error: { message: e instanceof Error ? e.message : String(e) },
    });
  }
});

function crunchJob(payload: unknown, cancelFlag: Int32Array) {
  for (const chunk of chunks(payload)) {
    if (Atomics.load(cancelFlag, 0) !== 0) {
      throw new DOMException("aborted", "AbortError");
    }
    crunch(chunk); // CPU — check giữa các chunk (~1–5ms/chunk)
  }
  return done();
}
```

`terminate()` giữa `crunch` mất worker — pool spawn lại; job parent reject. **Không** `Atomics.wait` trên main thread. Timeout Promise phía parent **không** dừng CPU — luôn cặp SAB abort flag (hoặc `receiveMessageOnPort`) + `terminate()` budget.

`chunks` CPU: kích thước sao cho mỗi chunk ~1–5ms — đủ nhạy mà không overhead. Benchmark `performance.now()` trong worker.

Pool `close()`: ngừng nhận job, đánh dấu abort in-flight, chờ timeout ngắn, `terminate` phần còn lại, `await Promise.all`. SIGTERM → `close()` — [main-function.md](main-function.md).

`os.availableParallelism()` trong cgroup nhỏ hơn `os.cpus().length` — đặt pool size theo `availableParallelism()`, không theo số core máy host. `UV_THREADPOOL_SIZE` và số worker JS là hai nút độc lập — đừng tăng cả hai mù. `cluster.worker.id` ≠ `worker_threads.threadId` (process vs thread) — log cả `process.pid` và `threadId`.

### 7.7 `child_process` vs worker — bảng quyết định CPU native

| Việc | Worker | spawn |
|------|--------|-------|
| Sharp / image JS+wasm | Worker OK nếu addon thread-safe | Process nếu addon crash |
| ffmpeg / magick CLI | Không | spawn |
| Python one-liner | Không | spawn `python` + argv |
| Parse JSON 50MB | Worker | Thường thừa isolation |
| Sandbox untrusted script | `vm` không đủ; process/container | spawn + rlimit/cgroup |
| Cùng heap debug | Dễ hơn (inspector threads) | pid khác |

Ghi chú vận hành nhanh theo nhóm:

- **Security & Isolation:** `vm.runInContext` chạy trên cùng thread, không cách ly CPU hay bảo mật. Untrusted user code trong worker vẫn đọc được `fs` trừ khi siết bằng **`--permission`** (Permission Model đã ổn định trên Node 24/26) hoặc tách process/container riêng — không coi worker là sandbox.
- **Lifecycle, Port & `ref`/`unref`:** `MessagePort.close()` một đầu sẽ khiến đầu kia nhận `'close'` và throw nếu `postMessage` tiếp; không đóng `parentPort` trên pool recycle. `parentPort.unref()` có thể khiến worker thoát sớm khi hết handle — pool server luôn giữ ref; ngược lại CLI dùng `BroadcastChannel` hoặc `MessageChannel` nên `close()` / `unref()` cả hai đầu để không treo lúc exit. Double `terminate()` là an toàn (no-op nếu đã exit). `Worker` option `trackUnmanagedFds` mặc định `true` giúp đóng fd chưa quản lý khi worker exit.
- **Observability & `threadId`:** Đọc ELU của worker từ parent qua **`worker.performance.eventLoopUtilization()`**. Không hardcode `threadId === 0` trong protocol (đọc `threadId` tại runtime và truyền qua `workerData`). Với `postMessageToThread` (Stability 1.1), listener đích là `process.on("workerMessage")` (khác `'message'` của `fork`).
- **`child_process`, `fork` & `cluster`:** `fork` option `serialization: "advanced"` giữ `Date`/`Map` (mặc định `"json"` chuyển `Date` thành string). `child.pid` là `undefined` trước khi spawn thành công hoặc sau exit — kiểm tra `child.exitCode === null` trước khi `kill`. `stdin: "ipc"` không hợp lệ; IPC là fd thứ 4 (`stdio: ["pipe", "pipe", "pipe", "ipc"]`). `cluster` `worker.process` là `ChildProcess` với `send`/`kill` tương tự `fork`; `process.channel?.unref()` cẩn thận kẻo parent thoát sớm. Dùng `{ signal }` chuẩn hóa thay vì trộn lẫn với option `timeout` rời; `exec`/`execFile` có `encoding: "buffer"` cho binary và `maxBuffer` mặc định ~1 MiB (output lớn dùng `spawn`).
- **SAB, Resizable Buffer & Testing:** `Atomics.notify(view, index, count)` quên gọi sẽ treo waiter; tránh `SharedArrayBuffer.grow()` đồng thời với `Atomics.wait` không có protocol; resizable `ArrayBuffer` (không shared) có thể transfer sau `resize()`. Trong test: tách worker entry khỏi file test (hoặc guard `isMainThread`), dùng `t.after(() => w.terminate())` + `once(w, "exit")` tránh leak handle; fake timers không điều khiển được CPU trong worker. Thư viện `piscina` hỗ trợ `AbortSignal` per-task sẵn nếu không muốn tự duy trì pool.

---

## 8. Best practices

1. Async trước; worker khi đo được lag CPU JS — không thread I/O-bound.
2. Message `{ id, type, payload }` / `{ id, ok, … }` — correlating id bắt buộc.
3. Lắng `error`+`exit`; timeout cooperative rồi `terminate`; `close()` pool khi SIGINT/SIGTERM.
4. Transfer `ArrayBuffer` lớn; `MessagePort` phải có trong transfer list; tránh SAB trừ khi cần; không `Atomics.wait` trên main.
5. Pool size ≈ `availableParallelism()`; queue bounded (backpressure); đừng spawn/request.
6. `spawn`/`execFile` + args array — không `exec` shell với user input.
7. Scale HTTP: process manager / K8s thường hơn tự `cluster`.
8. ESM path: `new URL("./w.js", import.meta.url)`.
9. Nghĩ **message-passing isolates**, không shared-heap threads. `resourceLimits` best-effort.
10. Abort ≠ terminate; ALS không sang worker.

---

## 9. Checklist

```text
□ Bottleneck là CPU JS (không chỉ I/O) trước khi thêm worker
□ Pool cố định + job id + timeout + queue bounded; không leak Worker
□ Lắng error/exit/messageerror — thiếu 'error' có thể crash MAIN
□ Worker entry catch rejection; uncaught = chết worker
□ Buffer lớn: transfer list đúng; MessagePort liệt kê
□ Không Atomics.wait trên main; SAB có lý do đo được
□ receiveMessageOnPort không mix on('message') cùng port
□ terminate last resort; abort cooperative trước
□ resourceLimits: nhớ không cover ArrayBuffer; OOM global
□ child_process: spawn/execFile; không exec shell + user input
□ fork IPC: bounded queue + send callback + ACK; disconnect/kill
□ Ước heap × số worker
□ Test: logic thuần tách parentPort; terminate trong finally
□ Shutdown: đóng pool / kill child trước exit
□ Không cluster lồng PM2/K8s trừ khi cố ý
```

---

## 10. Cheat sheet

| Cần | Dùng |
|---|---|
| I/O concurrent | async trên main — **không** thread |
| CPU JS song song | `Worker` + pool bounded |
| Kênh riêng | `MessageChannel` + transfer port |
| Zero-copy buffer | `postMessage(buf, [buf])` |
| Shared bytes | `SharedArrayBuffer` + `Atomics` (`wait` chỉ worker) |
| Sync rút message | `receiveMessageOnPort` |
| Gọi binary | `spawn` / `execFile` |
| Node con + IPC | `fork` + `send`/`message` |
| Multi-process HTTP | PM2 / K8s; `cluster` nếu không có orchestrator |
| Dừng worker | abort cooperative → `terminate()` |
| Path ESM | `new URL("./w.js", import.meta.url)` |
| Heap cap isolate | `resourceLimits` (best-effort) |

```ts
import { Worker, isMainThread, parentPort } from "node:worker_threads";

if (isMainThread) {
  const w = new Worker(new URL(import.meta.url));
  w.on("error", console.error);
  w.once("message", async (result) => {
    console.log(result);
    await w.terminate();
  });
  w.postMessage({ n: 5 });
} else {
  if (!parentPort) throw new Error("Missing parentPort");
  parentPort.on("message", ({ n }: { n: number }) => parentPort!.postMessage(n * 2));
}
```

---

## 11. Version notes

| Dòng | Ghi chú |
|---|---|
| **Node 26** (baseline) | `worker_threads` / `child_process` / `cluster` ổn định; WHATWG Web Streams transferable chuẩn |
| Node 24 LTS | Cùng mô hình — kiểm changelog nếu dùng API rất mới (như TCP handle transfer 26.10+) |
| `--permission` | Permission Model ổn định trên Node 24/26 (thay `--experimental-permission`) |
| `markAsUntransferable()` | `node:worker_threads` — chặn vô tình transfer object/slab buffer |
| `worker.performance.eventLoopUtilization()` | Parent đọc trực tiếp ELU của worker isolate |
| `os.availableParallelism()` | Ưu tiên hơn `os.cpus().length` (container-aware hơn) |
| `structuredClone` | Global; cùng thuật toán với `postMessage` |
| `resourceLimits` | Best-effort; không cover ArrayBuffer |
| `cluster.isPrimary` | Thay `isMaster` deprecated |
| `spawn` / `fork` / `promisify(execFile)` + `{ signal, killSignal }` | Hủy subprocess bằng `AbortSignal`; không có module `child_process/promises` |
| Windows `.bat`/`.cmd` (CVE-2024-27980) | Từ Node 20.12.2+ / 26, `spawn`/`execFile` không có `{ shell: true }` throw `EINVAL` |
| `receiveMessageOnPort` | Sync; nuốt `'message'` |
| `await using Worker` | `Symbol.asyncDispose` → `terminate` (22.18+ / 24.2+) |
| `Atomics.waitAsync` | Wait không block (ES2024) |
| Transfer list throw untransferable | Node 21+ |

---

## 12. Tài liệu liên quan

- [event-loop.md](event-loop.md) — blocking, libuv pool, khi offload, ELU
- [async.md](async.md) — Promise / AbortSignal / pool Promise trước khi nghĩ thread
- [abort-context.md](abort-context.md) — abort hợp tác; ALS không sang worker
- [main-function.md](main-function.md) — entry, signal shutdown (đóng pool)
- [nodejs-apis.md](nodejs-apis.md) — fs, http, stream
- [exceptions.md](exceptions.md) — unhandledRejection / error EventEmitter

- [Worker/IPC crash và shutdown tests](testing.md)
- [Worker/process isolation](security.md)
- [Heap riêng và RSS chung](diagnostics.md)
