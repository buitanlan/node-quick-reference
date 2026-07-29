# Event loop & concurrency model

*(Call stack, microtasks, `nextTick`, timers, I/O, `setImmediate`, libuv)*

Baseline: **Node.js 26**. Mô hình cốt lõi ổn định qua các major; hiểu event loop quan trọng hơn thuộc lòng từng phase edge-case.

---

## Mục lục

- [Event loop \& concurrency model](#event-loop--concurrency-model)
  - [Mục lục](#mục-lục)
  - [1. Node “single-threaded” nghĩa là gì?](#1-node-single-threaded-nghĩa-là-gì)
  - [2. Call stack \& task queues](#2-call-stack--task-queues)
  - [3. Microtasks](#3-microtasks)
    - [3.1 Promise / `queueMicrotask`](#31-promise--queuemicrotask)
    - [3.2 `process.nextTick`](#32-processnexttick)
  - [4. Macrotasks / phases của event loop](#4-macrotasks--phases-của-event-loop)
    - [4.1 Tổng quan phases](#41-tổng-quan-phases)
    - [4.2 Timers — `setTimeout` / `setInterval`](#42-timers--settimeout--setinterval)
    - [4.3 Poll (I/O)](#43-poll-io)
    - [4.4 Check — `setImmediate`](#44-check--setimmediate)
    - [4.5 Close callbacks](#45-close-callbacks)
  - [5. Thứ tự thực tế (ví dụ)](#5-thứ-tự-thực-tế-ví-dụ)
  - [6. libuv threadpool](#6-libuv-threadpool)
  - [7. Blocking pitfalls](#7-blocking-pitfalls)
    - [7.1 Sync fs \& CPU nặng](#71-sync-fs--cpu-nặng)
    - [7.2 Microtask starvation](#72-microtask-starvation)
  - [8. So sánh nhanh API lên lịch](#8-so-sánh-nhanh-api-lên-lịch)
  - [9. Best practices](#9-best-practices)

---

## 1. Node “single-threaded” nghĩa là gì?

- **JavaScript của bạn** (callback, Promise then, async function resume) chạy trên **một main thread** — một call stack tại một thời điểm.
- **libuv** + OS xử lý I/O bất đồng bộ; một số thao tác (DNS, fs, crypto, zlib… tùy API) chạy trên **threadpool** rồi đưa callback về event loop.
- **Worker threads** / **child processes** là cách chạy JS song song thật — xem [threading.md](threading.md).

Khác C#: không có “mỗi request một thread” mặc định; concurrency I/O dựa trên **không block** main thread.

```
┌──────────────────────────────┐
│  JS call stack (main thread) │
└──────────────┬───────────────┘
               │
     event loop schedules tasks
               │
┌──────────────▼───────────────┐
│  libuv: I/O, timers, pool    │
└──────────────────────────────┘
```

---

## 2. Call stack & task queues

1. Thực thi synchronous code trên **call stack**.
2. Khi stack trống, runtime hút việc từ hàng đợi:
   - **microtask queue** (ưu tiên cao),
   - rồi **macrotask** theo phase (timers, poll, …).
3. Mỗi callback lại có thể enqueue thêm việc.

Nếu một hàm sync chạy 2 giây → **không** có callback/timer/HTTP handler nào chạy trong khoảng đó.

---

## 3. Microtasks

### 3.1 Promise / `queueMicrotask`

```js
queueMicrotask(() => console.log("microtask"));
Promise.resolve().then(() => console.log("promise then"));
console.log("sync");
// sync → microtask → promise then
```

Sau mỗi “turn” (xong sync hoặc xong một macrotask), engine **xả hết** microtasks trước khi sang macrotask tiếp theo.

### 3.2 `process.nextTick`

```js
process.nextTick(() => console.log("nextTick"));
Promise.resolve().then(() => console.log("promise"));
console.log("sync");
// sync → nextTick → promise
```

- `nextTick` thuộc **nextTick queue** của Node, ưu tiên **trước** Promise microtasks (trong hầu hết trường hợp Node hiện tại).
- Dùng để “chạy sau khi hàm hiện tại return, trước I/O”.
- **Nguy hiểm:** `nextTick` đệ quy có thể **starve** event loop (I/O/timer không kịp chạy).

```js
// ❌ starve
function f() {
  process.nextTick(f);
}
f();
```

Ưu tiên hiện đại: Promise / `queueMicrotask`; `nextTick` chỉ khi cần tương thích / API legacy.

---

## 4. Macrotasks / phases của event loop

### 4.1 Tổng quan phases

Mỗi vòng lặp (đơn giản hóa):

1. **timers** — `setTimeout` / `setInterval` hết hạn  
2. **pending callbacks** — I/O callbacks bị trì hoãn  
3. **idle, prepare** (nội bộ)  
4. **poll** — nhận I/O mới; có thể chờ  
5. **check** — `setImmediate`  
6. **close callbacks** — ví dụ `socket.on('close')`

Giữa / quanh các phase, Node xử lý **nextTick** rồi **microtasks**.

> Đây là mô hình tham khảo; đừng viết code phụ thuộc thứ tự siêu tinh tế giữa `setImmediate` và `setTimeout(0)` trong mọi ngữ cảnh (khác nhau giữa trong/ngoài I/O callback).

### 4.2 Timers — `setTimeout` / `setInterval`

```js
setTimeout(() => console.log("t"), 0);
```

- Delay là **tối thiểu**, không phải chính xác tuyệt đối.
- Không dùng cho nhịp real-time cứng; drift với `setInterval`.

Cùng họ Promise:

```js
import { setTimeout as sleep } from "node:timers/promises";
await sleep(100);
```

### 4.3 Poll (I/O)

Đa số callback mạng / file async được xếp vào đây khi sẵn sàng:

```js
import fs from "node:fs";

fs.readFile("a.txt", () => {
  console.log("I/O done");
});
```

Nếu không còn I/O và timer sắp đến, poll có thể block chờ hoặc chuyển phase.

### 4.4 Check — `setImmediate`

```js
setImmediate(() => console.log("immediate"));
```

Chạy trong phase **check**, sau poll. Trong I/O callback, `setImmediate` thường chạy trước `setTimeout(0)` — nhưng **ngoài** I/O, thứ tự với `setTimeout(0)` không đáng tin để dựa vào.

### 4.5 Close callbacks

```js
socket.on("close", () => {
  // close phase
});
```

---

## 5. Thứ tự thực tế (ví dụ)

```js
console.log("A");

setTimeout(() => console.log("timeout"), 0);
setImmediate(() => console.log("immediate"));

process.nextTick(() => console.log("nextTick"));
Promise.resolve().then(() => console.log("promise"));

console.log("B");
```

Kỳ vọng điển hình:

```
A
B
nextTick
promise
```

rồi `timeout` / `immediate` (thứ tự hai cái này **không** ổn định nếu không nằm trong I/O context).

Trong I/O:

```js
import fs from "node:fs";

fs.readFile(new URL(import.meta.url), () => {
  setTimeout(() => console.log("timeout"), 0);
  setImmediate(() => console.log("immediate"));
});
// thường: immediate → timeout
```

---

## 6. libuv threadpool

Một số API **trông** async với JS nhưng thực thi trên pool (mặc định **4** threads, đổi bằng `UV_THREADPOOL_SIZE`):

- Nhiều thao tác `fs` (không phải tất cả; tùy OS/API),
- `dns.lookup` (khác `dns.resolve*`),
- `crypto.pbkdf2`, `crypto.scrypt`, một số `zlib`, …

```bash
# Windows PowerShell
$env:UV_THREADPOOL_SIZE = "16"
node app.js
```

Hệ quả:

- 100 `pbkdf2` song song vẫn có thể bị **queue** trên 4 worker.
- Pool **dùng chung** — fs nặng + crypto nặng tranh nhau.
- Tăng pool giúp throughput CPU-bound libuv; **không** thay worker_threads cho JS thuần nặng.

I/O mạng (TCP/HTTP) chủ yếu **không** chiếm threadpool theo kiểu đó — non-blocking trên event loop / OS.

---

## 7. Blocking pitfalls

### 7.1 Sync fs & CPU nặng

```js
import fs from "node:fs";

// ❌ chặn toàn bộ server
const data = fs.readFileSync("/huge/file");
JSON.parse(hugeString);
while (Date.now() < end) {} // busy loop
```

Hậu quả: latency tăng đồng loạt, health check fail, timeout cascade.

Thay bằng:

```js
import fs from "node:fs/promises";
const data = await fs.readFile("/huge/file");
```

CPU nặng (hash lớn, image, parse khổng lồ) → **`worker_threads`** hoặc process tách, không chạy trên request path sync.

### 7.2 Microtask starvation

```js
function flood() {
  Promise.resolve().then(flood);
}
flood(); // macrotask / I/O khó xen vào
```

Tương tự `nextTick` đệ quy. Luôn để “lối thoát” ra macrotask (`setImmediate` / `setTimeout`) nếu cần chia nhỏ công việc trên main thread — hoặc chuyển worker.

---

## 8. So sánh nhanh API lên lịch

| API | Khi chạy (ý tưởng) | Ghi chú |
|---|---|---|
| Sync code | ngay | chặn loop |
| `process.nextTick` | trước microtasks | dễ starve |
| `queueMicrotask` / `Promise.then` | microtask | chuẩn JS |
| `setTimeout(fn, 0)` | timers phase | delay tối thiểu |
| `setImmediate` | check phase | hữu ích sau I/O |
| I/O callback | poll (+ pending) | đừng block bên trong |

---

## 9. Best practices

- Giữ main thread **mỏng**: I/O async, CPU offload.
- Tránh `*Sync` trên server path (CLI one-shot có thể chấp nhận được).
- Đừng dựa vào thứ tự `setTimeout(0)` vs `setImmediate` trừ khi trong cùng I/O callback và đã đo.
- Ưu tiên Promise/`async await` hơn callback hell; vẫn hiểu chúng schedule microtask.
- Theo dõi event loop lag (`perf_hooks.monitorEventLoopDelay`, APM) khi production.
- Tăng `UV_THREADPOOL_SIZE` có chủ đích; đo trước/sau.

**Tài liệu liên quan:** [async.md](async.md) · [threading.md](threading.md) · [nodejs-apis.md](nodejs-apis.md)
