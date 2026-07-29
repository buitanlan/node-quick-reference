# Event loop & concurrency model

*(Call stack, microtasks, `nextTick`, timers, I/O, `setImmediate`, libuv threadpool)*

Baseline: **Node.js 26**. Mô hình cốt lõi ổn định qua các major; hiểu **call stack + queues + phases** quan trọng hơn thuộc lòng từng edge-case. Promise/`async`: [async.md](async.md). Song song JS: [threading.md](threading.md).

---

## Mục lục

1. [Node “single-threaded” nghĩa là gì?](#1-node-single-threaded-nghĩa-là-gì)
2. [Call stack & task queues](#2-call-stack--task-queues)
3. [Microtasks](#3-microtasks)
4. [`process.nextTick` vs Promise microtasks](#4-processnexttick-vs-promise-microtasks)
5. [Phases của event loop](#5-phases-của-event-loop)
6. [`setTimeout(0)` vs `setImmediate`](#6-settimeout0-vs-setimmediate)
7. [Thứ tự thực tế (ví dụ)](#7-thứ-tự-thực-tế-ví-dụ)
8. [libuv threadpool](#8-libuv-threadpool)
9. [Blocking pitfalls & đo lag](#9-blocking-pitfalls--đo-lag)
10. [CPU offload: sync vs async I/O vs worker](#10-cpu-offload-sync-vs-async-io-vs-worker)
11. [So sánh nhanh API lên lịch](#11-so-sánh-nhanh-api-lên-lịch)
12. [Best practices](#12-best-practices)
13. [Checklist](#13-checklist)
14. [Cheat sheet](#14-cheat-sheet)
15. [Version notes](#15-version-notes)
16. [Tài liệu liên quan](#16-tài-liệu-liên-quan)

---

## 1. Node “single-threaded” nghĩa là gì?

“Single-threaded” chỉ **JavaScript của bạn** trên **một main thread** — một call stack tại một thời điểm. Nó **không** nghĩa toàn process chỉ có một thread.

| Thành phần | Thread / cơ chế | Việc làm |
|---|---|---|
| JS call stack | Main thread | Callback, `then`, resume `async`, sync code |
| Event loop | Main thread (libuv) | Chọn phase, schedule macrotask |
| Network I/O (TCP/HTTP…) | Non-blocking OS | Không chiếm threadpool kiểu fs/crypto |
| Một số fs / DNS / crypto / zlib | **libuv threadpool** | Worker C++ rồi trả callback về loop |
| `worker_threads` | Thread + isolate V8 | JS song song thật |
| `child_process` / cluster | Process riêng | Cô lập / scale đa nhân |

Khác mô hình “mỗi request một thread”: concurrency I/O dựa trên **không block main thread**.

```
┌─────────────────────────────────────┐
│  JS call stack (main thread)        │
└──────────────────┬──────────────────┘
                   │ event loop
┌──────────────────▼──────────────────┐
│  nextTick → microtask → phases      │
│  (timers / pending / poll / check / │
│   close)                            │
└──────────────────┬──────────────────┘
┌──────────────────▼──────────────────┐
│  libuv: I/O, timers, threadpool     │
└─────────────────────────────────────┘
```

> **Myth:** “Node chậm vì single-thread.” Thực tế: I/O-bound scale tốt nếu không block; **CPU-bound sync** trên main thread mới giết latency.

---

## 2. Call stack & task queues

1. Chạy **sync** trên call stack đến khi trống.
2. Xả **`process.nextTick`** đến khi trống.
3. Xả **microtask** (`Promise.then`, `queueMicrotask`, …) đến khi trống.
4. Chạy macrotask thuộc **phase** hiện tại.
5. Lặp từ bước 2 sau mỗi macrotask / giữa phases.

Nếu một hàm sync chạy 2 giây → **không** timer / I/O / HTTP handler nào chạy trong khoảng đó. Loop bị **block**, không phải “chậm một chút”.

Mỗi callback có thể enqueue thêm nextTick / microtask / timer / I/O — đó là concurrency “đan xen” trên một thread.

---

## 3. Microtasks

```js
queueMicrotask(() => console.log("microtask"));
Promise.resolve().then(() => console.log("promise then"));
console.log("sync");
// sync → microtask → promise then
```

Sau mỗi turn (xong sync hoặc xong một macrotask), engine **xả hết** microtasks trước macrotask / phase tiếp theo.

`async/await`: đoạn sau `await` = continuation Promise → **microtask**:

```js
async function f() {
  console.log("1");
  await 0;
  console.log("3");
}
f();
console.log("2");
// 1 → 2 → 3
```

Dùng microtask để chuỗi hóa ngay sau stack hiện tại. **Không** dùng để thay busy-loop chia CPU — dễ starve (mục 4).

---

## 4. `process.nextTick` vs Promise microtasks

### 4.1 Thứ tự ưu tiên (Node)

```js
process.nextTick(() => console.log("nextTick"));
Promise.resolve().then(() => console.log("promise"));
queueMicrotask(() => console.log("queueMicrotask"));
console.log("sync");
// sync → nextTick → promise / queueMicrotask (theo thứ tự enqueue trong microtask queue)
```

- `nextTick` = queue **Node riêng**, trước Promise microtasks.
- API hiện đại: `queueMicrotask` / Promise; `nextTick` khi cần semantics legacy.

### 4.2 Starvation — worked examples

**`nextTick` đệ quy** — I/O/timer không chạy:

```js
import fs from "node:fs";

fs.readFile(new URL(import.meta.url), () => console.log("I/O"));

function flood() {
  process.nextTick(flood);
}
flood(); // I/O không bao giờ in
```

**Promise đệ quy** — tương tự starve macrotask:

```js
function flood() {
  Promise.resolve().then(flood);
}
flood();
setTimeout(() => console.log("timeout"), 0); // khó / không chạy
```

**Lối thoát** — nhường macrotask:

```js
async function processChunked(items) {
  for (let i = 0; i < items.length; i++) {
    work(items[i]);
    if (i % 1000 === 0) {
      await new Promise((r) => setImmediate(r));
    }
  }
}
```

> Vòng chỉ enqueue `nextTick` / `then` = busy-loop tinh vi. Yield bằng `setImmediate` hoặc offload worker.

### 4.3 Khi `nextTick` còn hợp lý

```js
import { EventEmitter } from "node:events";

class S extends EventEmitter {
  start() {
    process.nextTick(() => this.emit("ready")); // sau constructor/return, trước I/O
  }
}
```

Không dùng `nextTick` làm “delay thông thường” → `setImmediate` / `setTimeout`.

---

## 5. Phases của event loop

| # | Phase | Callback điển hình | Ghi chú |
|---|---|---|---|
| 1 | **timers** | `setTimeout` / `setInterval` hết hạn | Delay = tối thiểu |
| 2 | **pending callbacks** | Một số I/O deferred | Ít đụng trực tiếp |
| 3 | **idle, prepare** | Nội bộ | Không dùng từ JS |
| 4 | **poll** | Hầu hết I/O; có thể **chờ** | Nhận sự kiện |
| 5 | **check** | `setImmediate` | Sau poll |
| 6 | **close callbacks** | `socket.on('close')` | Cleanup |

Giữa / quanh phases: **nextTick** rồi **microtasks**.

> Mô hình **tham khảo**. Đừng phụ thuộc thứ tự siêu tinh tế trừ khi đã đo đúng ngữ cảnh (trong/ngoài I/O).

### 5.1 Timers

```js
setTimeout(() => console.log("t"), 0);
```

- Delay tối thiểu; trễ thêm nếu loop bận.
- `setInterval` drift — không nhịp realtime cứng.

```js
import { setTimeout as sleep } from "node:timers/promises";
await sleep(100);
await sleep(100, undefined, { signal: AbortSignal.timeout(50) });
```

### 5.2 Poll / check / close

```js
import fs from "node:fs";
fs.readFile("a.txt", () => console.log("I/O")); // poll khi sẵn sàng

setImmediate(() => console.log("immediate")); // check — sau poll

socket.on("close", () => {}); // close phase
```

Poll trống + không timer gần → có thể **block chờ** I/O. **Đừng** CPU nặng / `*Sync` trong I/O callback.

---

## 6. `setTimeout(0)` vs `setImmediate`

### 6.1 Ngoài I/O — không đáng tin

```js
setTimeout(() => console.log("timeout"), 0);
setImmediate(() => console.log("immediate"));
// thứ tự: phụ thuộc load / khi vào poll — đừng branch logic
```

### 6.2 Trong I/O callback — immediate thường trước

```js
import fs from "node:fs";

fs.readFile(new URL(import.meta.url), () => {
  setTimeout(() => console.log("timeout"), 0);
  setImmediate(() => console.log("immediate"));
});
// thường: immediate → timeout (đang poll → check trước timers vòng sau)
```

| Ngữ cảnh | Dựa vào thứ tự? | Gợi ý |
|---|---|---|
| Top-level / ngoài I/O | **Không** | Tránh race |
| Trong I/O callback | Tương đối ổn (immediate trước) | Vẫn đo nếu critical |
| “Sau I/O hiện tại” | `setImmediate` | Rõ intent |
| Delay ms thật | `setTimeout` / `timers/promises` | |
| Yield chia CPU | `setImmediate` giữa batch | Tránh nextTick flood |

> Chọn API đúng mục đích; **không** dựa race `timeout(0)` vs `immediate` ở top-level.

---

## 7. Thứ tự thực tế (ví dụ)

```js
console.log("A");
setTimeout(() => console.log("timeout"), 0);
setImmediate(() => console.log("immediate"));
process.nextTick(() => console.log("nextTick"));
Promise.resolve().then(() => console.log("promise"));
console.log("B");
```

```
A
B
nextTick
promise
```

rồi `timeout` / `immediate` (**không** ổn định ngoài I/O).

```js
console.log("sync");
setTimeout(() => console.log("macrotask"), 0);
Promise.resolve().then(() => console.log("micro"));
process.nextTick(() => {
  console.log("tick");
  Promise.resolve().then(() => console.log("micro-after-tick"));
});
// sync → tick → micro → micro-after-tick → (timeout|immediate)
```

---

## 8. libuv threadpool

Một số API **trông** async nhưng chạy trên pool (mặc định **4** threads):

| API / nhóm | Threadpool? | Ghi chú |
|---|---|---|
| Nhiều `fs.*` async | Thường **có** | Tùy OS/API |
| `dns.lookup` | **Có** (getaddrinfo) | Khác `dns.resolve*` |
| `crypto.pbkdf2` / `scrypt`, một số zlib | **Có** | CPU trên pool |
| TCP / HTTP / `fetch` | **Không** (kiểu pool này) | Non-blocking OS |
| JS thuần (`JSON.parse` lớn) | **Không** | **Main thread** |

```bash
# Windows PowerShell
$env:UV_THREADPOOL_SIZE = "16"
node app.js

# Unix
UV_THREADPOOL_SIZE=16 node app.js
```

**Contention:** 100 `pbkdf2` song song vẫn queue trên 4 worker; fs + crypto + zlib **dùng chung** pool. Tăng size giúp throughput pool — **không** thay `worker_threads` cho JS CPU. Set env **trước** khi start process.

```js
import dns from "node:dns/promises";
await dns.lookup("example.com");   // pool + OS hosts
await dns.resolve4("example.com"); // DNS protocol — khác đường
```

Nhiều `lookup` đồng thời có thể làm đầy pool → triệu chứng “fs chậm bí ẩn”.

---

## 9. Blocking pitfalls & đo lag

### 9.1 Sync & CPU nặng

```js
import fs from "node:fs";
const data = fs.readFileSync("/huge/file"); // ❌
JSON.parse(hugeString);
crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512");
```

Hậu quả: p99 tăng đồng loạt, health fail, timeout cascade.

```js
import fs from "node:fs/promises";
import { pbkdf2 } from "node:crypto";
import { promisify } from "node:util";

const data = await fs.readFile("/huge/file");
const hash = await promisify(pbkdf2)(password, salt, 100000, 64, "sha512");
```

### 9.2 Đo bằng `perf_hooks`

```js
import { monitorEventLoopDelay, performance } from "node:perf_hooks";

const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
setInterval(() => {
  console.log({ meanMs: h.mean / 1e6, p99Ms: h.percentile(99) / 1e6 });
  h.reset();
}, 5000);

const start = performance.eventLoopUtilization();
// ... sau một khoảng ...
const end = performance.eventLoopUtilization(start);
console.log(end.utilization); // 0..1 — gần 1 = loop rất bận
```

| Metric | Ý nghĩa | Khi xấu |
|---|---|---|
| Delay histogram p99 cao | Main bị block / quá tải callback | Tìm sync CPU, giảm work/request |
| ELU cao kéo dài | Loop ít idle | Scale / offload / cắt fan-out |
| Pool gián tiếp (fs/crypto chậm, CPU JS thấp) | Hàng đợi threadpool | Giới hạn concurrency ± tăng pool **có đo** |

---

## 10. CPU offload: sync vs async I/O vs worker

| Tình huống | Chọn | Lý do |
|---|---|---|
| File / HTTP / DB network | **Async I/O** | Callback ngắn trên main |
| Hash/compress vừa | Async libuv + giới hạn concurrency | Pool; đo `UV_THREADPOOL_SIZE` |
| Parse/transform CPU lớn | **`worker_threads`** | JS song song thật |
| Cô lập crash / dual runtime | `child_process` | Nặng hơn; mạnh isolation |
| CLI one-shot | `*Sync` đôi khi OK | Không server concurrent |
| Yield giữa batch nhỏ | `setImmediate` | Không thay worker nếu CPU nặng thật |

```js
import { Worker } from "node:worker_threads";

function runInWorker(data) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./cpu-job.js", import.meta.url), {
      workerData: data,
    });
    w.on("message", resolve);
    w.on("error", reject);
  });
}
```

Chi tiết: [threading.md](threading.md).

---

## 11. So sánh nhanh API lên lịch

| API | Khi chạy | Starve risk | Ghi chú |
|---|---|---|---|
| Sync | ngay | block loop | giữ ngắn |
| `process.nextTick` | trước microtasks | **cao** nếu đệ quy | emit-after-construct |
| `queueMicrotask` / `then` | microtask | **cao** nếu đệ quy | chuẩn JS |
| `setTimeout(fn, 0)` | timers | thấp | delay tối thiểu |
| `setImmediate` | check | thấp | sau poll; yield tốt |
| I/O callback | poll | — | đừng block bên trong |
| `worker_threads` | thread khác | — | CPU song song |

---

## 12. Best practices

1. Main thread **mỏng**: I/O async, CPU offload, callback ngắn.
2. Tránh `*Sync` trên server path (CLI one-shot có thể OK).
3. Đừng dựa `setTimeout(0)` vs `setImmediate` ngoài I/O đã hiểu và đo.
4. Ưu tiên Promise/`async await`; nhớ continuation = microtask.
5. Cấm `nextTick`/`then` đệ quy không bound; chia batch bằng `setImmediate`.
6. Theo dõi `monitorEventLoopDelay` + ELU (hoặc APM) ở production.
7. Tăng `UV_THREADPOOL_SIZE` có chủ đích; đo trước/sau; nhớ pool dùng chung.
8. Phân biệt `dns.lookup` (pool) vs `resolve*` khi debug latency DNS.
9. Health check fail khi loop lag vượt ngưỡng — không chỉ “process alive”.
10. Document quyết định offload (bảng mục 10) nếu service latency-critical.

---

## 13. Checklist

```text
□ Không *Sync / busy-loop trên request path
□ Không nextTick/Promise đệ quy không lối thoát macrotask
□ Không phụ thuộc race timeout(0) vs immediate ở top-level
□ CPU nặng: worker hoặc giới hạn concurrency + đo pool
□ UV_THREADPOOL_SIZE chỉ đổi sau benchmark
□ Có metric event loop delay và/hoặc ELU
□ I/O callback không JSON.parse/hash khổng lồ sync
□ Yield (setImmediate) nếu xử lý mảng lớn trên main
□ Load test quan sát p99 khi fan-out fs/crypto
```

---

## 14. Cheat sheet

```js
// sync → nextTick → microtasks → phase macrotask
process.nextTick(fn);
queueMicrotask(fn);
setTimeout(fn, 0);
setImmediate(fn); // yield / sau I/O

import { monitorEventLoopDelay, performance } from "node:perf_hooks";
monitorEventLoopDelay({ resolution: 20 }).enable();
performance.eventLoopUtilization();
```

| Cần | Dùng |
|---|---|
| Sau construct, trước I/O | `nextTick` (cẩn thận) |
| Chuỗi micro | `queueMicrotask` / `then` |
| Yield loop | `setImmediate` |
| Delay ms | `setTimeout` / `timers/promises` |
| CPU JS lớn | `worker_threads` |
| fs/crypto bão hòa | Giới hạn concurrency ± `UV_THREADPOOL_SIZE` |

---

## 15. Version notes

| Dòng | Ghi chú |
|---|---|
| **Node 26** (baseline) | Phases / nextTick / microtask ổn định; đo bằng `perf_hooks` |
| Node 24 LTS | Cùng mô hình cốt lõi — [node26-ts7.md](node26-ts7.md) |
| `monitorEventLoopDelay` | Histogram delay (ns) |
| `eventLoopUtilization` | ELU 0..1 |
| `timers/promises` + `AbortSignal` | Sleep/timer hủy được |
| Pool mặc định **4** | `UV_THREADPOOL_SIZE` lúc start |

Semantics phases ít breaking giữa major; chỗ hay sai là giả định timer/immediate và quên đo lag.

---

## 16. Tài liệu liên quan

- [Lập trình bất đồng bộ](async.md)
- [Worker Threads & Child Process](threading.md)
- [Node.js built-ins](nodejs-apis.md)
- [Exception / Error](exceptions.md)
- [Node 26 & TypeScript 7 highlights](node26-ts7.md)
