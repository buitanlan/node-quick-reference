# Event loop & concurrency model

*(Call stack, microtasks, `nextTick`, timers, I/O, `setImmediate`, libuv threadpool)*

Baseline: **Node.js 26**. Mô hình cốt lõi ổn định qua các major; hiểu **call stack + queues + phases** quan trọng hơn thuộc lòng từng edge-case. Promise/`async`: [async.md](async.md). Song song JS: [threading.md](threading.md).

---

## Mục lục

1. [Node “single-threaded” nghĩa là gì?](#1-node-single-threaded-nghĩa-là-gì)
2. [Call stack & task queues](#2-call-stack--task-queues)
3. [Microtasks](#3-microtasks)
4. [`process.nextTick` vs Promise job queue](#4-processnexttick-vs-promise-job-queue)
5. [Phases libuv (ASCII)](#5-phases-libuv-ascii)
6. [Pending vs poll vs close](#6-pending-vs-poll-vs-close)
7. [`setTimeout(0)` không phải next tick](#7-settimeout0-không-phải-next-tick)
8. [`setImmediate` trong vs ngoài I/O](#8-setimmediate-trong-vs-ngoài-io)
9. [Timer coalescing & delay tối thiểu](#9-timer-coalescing--delay-tối-thiểu)
10. [Thứ tự thực tế (ví dụ)](#10-thứ-tự-thực-tế-ví-dụ)
11. [libuv threadpool & `UV_THREADPOOL_SIZE`](#11-libuv-threadpool--uv_threadpool_size)
12. [Đo lag: delay histogram, ELU, `--trace-sync-io`](#12-đo-lag-delay-histogram-elu---trace-sync-io)
13. [CPU offload: sync vs async I/O vs worker](#13-cpu-offload-sync-vs-async-io-vs-worker)
14. [Node vs browser event loop](#14-node-vs-browser-event-loop)
15. [So sánh nhanh API lên lịch](#15-so-sánh-nhanh-api-lên-lịch)
16. [Best practices](#16-best-practices)
17. [Checklist](#17-checklist)
18. [Cheat sheet](#18-cheat-sheet)
19. [Version notes](#19-version-notes)
20. [Tài liệu liên quan](#20-tài-liệu-liên-quan)

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

> **Myth:** “Node chậm vì single-thread.” Thực tế: I/O-bound scale tốt nếu không block; **CPU-bound sync** trên main thread mới giết latency. AbortSignal **không** ngắt vòng `for` đang chạy — [abort-context.md](abort-context.md).

---

## 2. Call stack & task queues

1. Chạy **sync** trên call stack đến khi trống.
2. Xả **`process.nextTick`** đến khi trống (đệ quy `nextTick` trong bước này **không** thoát — §4).
3. Xả **microtask** (`Promise.then`, `queueMicrotask`, resume `await`) đến khi trống.
4. Nếu microtask enqueue `nextTick`, quay lại xả tick rồi microtask — đến khi cả hai rỗng.
5. Chạy macrotask thuộc **phase** hiện tại.
6. Lặp từ bước 2 sau mỗi callback / giữa phases.

Nếu một hàm sync chạy 2 giây → **không** timer / I/O / HTTP handler nào chạy trong khoảng đó. Loop bị **block**, không phải “chậm một chút”.

Mỗi callback có thể enqueue thêm nextTick / microtask / timer / I/O — đó là concurrency “đan xen” trên một thread.

---

## 3. Microtasks

```js
queueMicrotask(() => console.log("microtask"));
Promise.resolve().then(() => console.log("promise then"));
console.log("sync");
// sync → microtask → promise then  (FIFO enqueue)
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

Dùng microtask để chuỗi hóa ngay sau stack hiện tại. **Không** dùng để thay busy-loop chia CPU — dễ starve (§4). Khác biệt `queueMicrotask` vs `Promise.resolve().then` khi throw → [async.md](async.md) §7.

---

## 4. `process.nextTick` vs Promise job queue

Hai hàng đợi **khác nhau**:

| | `process.nextTick` | Promise jobs / `queueMicrotask` |
|--|-------------------|----------------------------------|
| Nguồn | Node (trước I/O) | V8 / JS spec |
| Ưu tiên | **Trước** microtask | Sau khi nextTick queue rỗng |
| Starve I/O | Rất dễ nếu đệ quy | Dễ nếu đệ quy `then` |
| Portable | Không (browser không có) | Có (`queueMicrotask`) |

```js
process.nextTick(() => console.log("nextTick"));
Promise.resolve().then(() => console.log("promise"));
queueMicrotask(() => console.log("queueMicrotask"));
console.log("sync");
// sync → nextTick → promise / queueMicrotask (FIFO trong microtask queue)
```

API hiện đại: `queueMicrotask` / Promise; `nextTick` khi cần semantics legacy (emit sau constructor, trước I/O).

### 4.1 Drain đệ quy — I/O không chạy

**`nextTick` đệ quy** — queue không bao giờ trống, **không** sang phase poll/timers:

```js
import fs from "node:fs";

fs.readFile(new URL(import.meta.url), () => console.log("I/O"));

function flood() {
  process.nextTick(flood);
}
flood(); // I/O không bao giờ in
```

Không có `maxTickDepth` kiểu cũ để cứu bạn — loop **livelock** trên tick queue. Cắt bằng điều kiện, hoặc nhường `setImmediate`.

**Promise đệ quy** — starve macrotask (timer/I/O):

```js
function flood() {
  Promise.resolve().then(flood);
}
flood();
setTimeout(() => console.log("timeout"), 0); // khó / không chạy
```

Interleave: `then` enqueue `nextTick`, `nextTick` enqueue `then` — Node xả **cả hai** trước khi vào poll → vẫn starve I/O.

**Lối thoát** — nhường **macrotask** (`check` / timers):

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

### 4.2 Khi `nextTick` còn hợp lý

```js
import { EventEmitter } from "node:events";

class S extends EventEmitter {
  start() {
    process.nextTick(() => this.emit("ready")); // sau constructor/return, trước I/O
  }
}
```

Không dùng `nextTick` làm “delay thông thường” → `setImmediate` / `setTimeout`.

### 4.3 Mix tick + Promise (drain)

```js
process.nextTick(() => {
  Promise.resolve().then(() => {
    process.nextTick(() => console.log("tick2"));
  });
});
Promise.resolve().then(() => console.log("p1"));
```

Node xả nextTick queue, rồi microtask; microtask enqueue nextTick → xả tick lại, rồi microtask còn lại — **trước** poll. Vòng tick↔micro vô hạn = starve như flood. Một lần xen kẽ thì ổn (emit + then).

`process.nextTick(fn, arg1)` truyền args — tránh closure. Vẫn không portable.

---

## 5. Phases libuv (ASCII)

Mô hình tham khảo Node (libuv). Giữa / quanh mỗi phase: **nextTick rồi microtasks**.

```
   ┌───────────────────────────┐
┌─▶│          timers           │  setTimeout / setInterval hết hạn
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │     pending callbacks     │  I/O deferred (ví dụ TCP error một số OS)
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │       idle, prepare       │  nội bộ — không dùng từ JS
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐      ┌──────────────┐
│  │           poll            │◀────▶│  chờ I/O OS  │  hầu hết callback fs/net
│  └─────────────┬─────────────┘      └──────────────┘
│  ┌─────────────▼─────────────┐
│  │           check           │  setImmediate
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │      close callbacks      │  socket.on('close'), handle close
│  └─────────────┬─────────────┘
└────────────────┘  (lặp)
```

| # | Phase | Callback điển hình | Ghi chú |
|---|---|---|---|
| 1 | **timers** | `setTimeout` / `setInterval` hết hạn | Delay = **tối thiểu**; coalescing §9 |
| 2 | **pending callbacks** | I/O deferred từ vòng trước | Ít đụng trực tiếp từ JS |
| 3 | **idle, prepare** | Nội bộ | Không schedule từ user code |
| 4 | **poll** | Hầu hết I/O mới; có thể **block chờ** | Nhận sự kiện; timeout theo timer gần nhất |
| 5 | **check** | `setImmediate` | **Sau** poll cùng vòng |
| 6 | **close callbacks** | `socket.on('close')`, `server.close` | Cleanup handle |

> Đừng phụ thuộc thứ tự siêu tinh tế trừ khi đã đo đúng ngữ cảnh (trong/ngoài I/O). Spec HTML/browser **không** có các phase này — §14.

---

## 6. Pending vs poll vs close

### 6.1 Poll

- Lấy I/O mới (epoll/kqueue/IOCP), chạy callback liên quan.
- Nếu queue poll trống: **block** đến khi có I/O **hoặc** timer sắp đến hạn (timeout tính từ heap timer).
- CPU nặng / `*Sync` **trong** I/O callback = block vòng sau (không nhận connection).

```js
import fs from "node:fs";
fs.readFile("a.txt", () => console.log("I/O")); // thường chạy ở poll khi sẵn sàng
```

### 6.2 Pending callbacks

Một số lỗi I/O (ví dụ `ECONNREFUSED` TCP trên một số Unix) **không** chạy ngay trong poll — libuv **hoãn** sang phase **pending callbacks** vòng sau. User code hiếm khi phân biệt; triệu chứng: error TCP “lệch” một tick so với intuition. **Không** nhầm pending với Promise pending.

TCP `connect` fail: đừng assert thứ tự vs `setImmediate` cùng lúc connect — flaky theo OS. `once(socket, "error")` vẫn đúng. Windows IOCP: completion về poll; JS API giống, phase pending ít gặp hơn.

### 6.3 Close callbacks

Khi handle đóng (`socket.destroy()`, `server.close()`, `fd` close): callback `'close'` chạy phase **close**, sau check. Cleanup cuối — đừng start I/O nặng ở đây; đừng giả định `'close'` trước `'end'`.

```js
socket.on("close", () => {
  // phase close — connection đã chết
});
```

`'end'` (HTTP body xong) ≠ `'close'` (handle đóng). Abort client: thường `close` mà không `end` sạch — [abort-context.md](abort-context.md) §6.

### 6.4 `'end'` / `'finish'` / `'close'` / `'error'`

| Event | Stream / HTTP | Phase / khi |
|-------|----------------|-------------|
| `'data'` / readable | dữ liệu | poll (thường) |
| `'end'` | readable hết data | trước close |
| `'finish'` | writable đã flush | sau `end()` thành công |
| `'error'` | lỗi — **phải** listen hoặc `pipeline` | không phải close |
| `'close'` | handle đóng | **close** phase |

`finished()` đợi end/finish/error — [async.md](async.md). Thiếu `'error'` listener trên stream trần → process throw. `destroy()` dẫn tới `'close'`; có thể emit `'error'` nếu truyền err.

---

## 7. `setTimeout(0)` không phải next tick

```js
console.log("A");
process.nextTick(() => console.log("tick"));
Promise.resolve().then(() => console.log("micro"));
setTimeout(() => console.log("timeout0"), 0);
console.log("B");
// A B tick micro … rồi timeout0 ở phase timers
```

| | `nextTick` / microtask | `setTimeout(fn, 0)` |
|--|------------------------|---------------------|
| Khi | Trước I/O, cùng “turn” JS | Phase **timers** (macrotask) |
| Delay | Không | Tối thiểu; + lag loop + coalescing |
| Starve | Có nếu đệ quy | Thấp — vẫn vào loop |
| Ý “ngay” | Sau stack hiện tại | “Sớm, nhưng sau I/O/timer rules” |

**Không** dùng `setTimeout(0)` để:

- Giả `nextTick` (emit-after-construct) — quá muộn, có I/O chen.
- Giả `setImmediate` — thứ tự vs immediate **không** ổn định ngoài I/O (§8).
- Chia CPU trong tight loop — vẫn có delay tối thiểu + phase cost; `setImmediate` rõ hơn.

`setTimeout(0)` **có** hữu ích: đẩy việc sang **macrotask** để không starve? Thực ra 0-delay vẫn phải chờ hết nextTick+microtask **và** có thể chờ poll. Muốn yield sau I/O hiện tại: `setImmediate`.

> Browser: `setTimeout(0)` còn kẹp ~4ms khi lồng (HTML). Node **không** áp dụng clamp 4ms đó. Vẫn không biến 0 thành nextTick.

---

## 8. `setImmediate` trong vs ngoài I/O

### 8.1 Ngoài I/O — không đáng tin

```js
setTimeout(() => console.log("timeout"), 0);
setImmediate(() => console.log("immediate"));
// thứ tự: phụ thuộc load / khi vào poll — đừng branch logic
```

Vào loop lần đầu: có thể timers phase trước (timeout) hoặc poll→check (immediate) tùy thời điểm hết hạn và event loop start.

### 8.2 Trong I/O callback — immediate thường trước

```js
import fs from "node:fs";

fs.readFile(new URL(import.meta.url), () => {
  setTimeout(() => console.log("timeout"), 0);
  setImmediate(() => console.log("immediate"));
});
// thường: immediate → timeout
// đang ở poll → hết poll → check (immediate) → vòng sau mới timers
```

| Ngữ cảnh | Dựa vào thứ tự? | Gợi ý |
|---|---|---|
| Top-level / ngoài I/O | **Không** | Tránh race |
| Trong I/O callback | Tương đối ổn (immediate trước) | Vẫn đo nếu critical |
| “Sau I/O hiện tại” | `setImmediate` | Rõ intent |
| Delay ms thật | `setTimeout` / `timers/promises` | |
| Yield chia CPU | `setImmediate` giữa batch | Tránh nextTick flood |

> Chọn API đúng mục đích; **không** dựa race `timeout(0)` vs `immediate` ở top-level.

`setImmediate` lồng trong `setImmediate`: chạy check **vòng sau** (không đệ quy vô hạn trong cùng check — queue check hiện tại vs lần sau). Vẫn yield loop, không starve như `nextTick`.

```js
setImmediate(() => {
  console.log("i1");
  setImmediate(() => console.log("i2")); // vòng check sau
});
```

`setImmediate` trong `setImmediate` 10_000 lần: 10_000 vòng loop — I/O vẫn chen được giữa các check. `nextTick` 10_000 lần đệ quy: I/O **không** chen.

`Immediate` vs `Timeout(0)` trong `setImmediate` callback: timeout đợi timers vòng sau; immediate lồng = check sau. Vẫn đừng viết logic phụ thuộc.

---

## 9. Timer coalescing & delay tối thiểu

```js
setTimeout(() => console.log("t"), 0);
```

- Delay là **tối thiểu**, không phải “chính xác ms”.
- Loop bận → trễ thêm (đúng thứ `monitorEventLoopDelay` đo).
- `setInterval` **drift**: mỗi lần schedule từ lúc callback chạy, không phải lưới tường realtime.
- libuv giữ heap timer; nhiều timer **cùng hạn** fire cùng phase timers (coalescing) — thứ tự giữa chúng **không** phải spec để dựa logic.
- Độ phân giải: phụ thuộc OS / `uv_hrtime`; đừng dùng timer 0–1ms làm clock nguồn.

```js
import { setTimeout as sleep } from "node:timers/promises";
await sleep(100);
await sleep(100, undefined, { signal: AbortSignal.timeout(50) });
```

`unref()` trên `Timeout`: process có thể thoát dù timer chưa fire — hữu ích CLI; nguy hiểm nếu unref nhầm trên server job.

### 9.1 Drift `setInterval`

```js
let n = 0;
const t0 = Date.now();
const iv = setInterval(() => {
  n++;
  const expected = t0 + n * 100;
  const slip = Date.now() - expected; // tăng nếu callback chậm / loop bận
  if (n === 50) clearInterval(iv);
}, 100);
```

Không phải metronome. Nhịp tường: `setTimeout` lặp với `delay = Math.max(0, target - Date.now())` hoặc lịch tuyệt đối — vẫn lệch nếu callback > period. Realtime cứng: không dùng event loop JS.

> **Pitfall:** `await sleep(0)` vẫn macrotask (timers), không phải `await Promise.resolve()`. Test giả timer (`fake-timers`) hook `setTimeout` JS — **không** luôn hook mọi timer C++ (`AbortSignal.timeout`).

---

## 10. Thứ tự thực tế (ví dụ)

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

### 10.1 `nextTick` bên trong I/O (poll)

```js
import fs from "node:fs";

fs.readFile(new URL(import.meta.url), () => {
  console.log("poll");
  process.nextTick(() => console.log("tick-after-poll"));
  queueMicrotask(() => console.log("micro-after-poll"));
  setImmediate(() => console.log("check"));
});
// poll → tick-after-poll → micro-after-poll → check
```

Trong callback poll: nextTick/microtask **của callback đó** xả trước khi rời sang check. `setImmediate` vẫn đợi phase check. Đây là lý do immediate-trong-I/O “thắng” `setTimeout(0)` (timers vòng **sau**).

### 10.2 Poll timeout (chờ I/O)

Poll **block** nếu: không còn callback poll sẵn, và không cần “nhảy” ngay sang check. Có `setImmediate` pending → poll không ngủ lâu (timeout 0) để tới check. CPU loop trên main = poll không chạy = timer “0ms” trễ đúng bằng thời gian block.

Nếu **chỉ** có `setTimeout` 100ms, không I/O, không immediate: poll ngủ tới ~hạn timer rồi sang timers (hoặc OS đánh thức sớm). Đây là idle tốt — ELU thấp.

`server.listen` giữ loop sống (handle ref). Promise **không** ref loop — floating promise không giữ process; timer/socket mới giữ. Pitfall CLI: hết handle ref → `exit` trước log async.

GC major pause = spike `monitorEventLoopDelay` giống sync CPU — profile heap nếu delay cao mà code JS “trông nhẹ”.

`process.exit()` không “xả hết” close callbacks / `finally` async — shutdown hợp tác: abort root + `server.close` — [main-function.md](main-function.md).

---

## 11. libuv threadpool & `UV_THREADPOOL_SIZE`

Một số API **trông** async nhưng chạy trên pool (mặc định **4** threads):

| API / nhóm | Threadpool? | Ghi chú |
|---|---|---|
| Nhiều `fs.*` async | Thường **có** | Tùy OS/API (một số dùng I/O OS không pool) |
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

Set env **trước** khi start process — đổi lúc runtime **không** resize pool đã tạo.

### 11.1 Contention recipes (fs + crypto)

100 `pbkdf2` song song vẫn xếp hàng trên 4 worker; **fs + crypto + zlib + `dns.lookup` dùng chung pool**.

| Triệu chứng | Gợi ý |
|-------------|--------|
| `readFile` chậm dù disk rảnh, CPU JS thấp | Pool đầy — `lookup`/hash/zlib | Giới hạn concurrency fs **và** crypto; tách `dns.resolve4` nếu không cần hosts file |
| Login `pbkdf2` làm API file upload đơ | Cùng 4 thread | `UV_THREADPOOL_SIZE` tăng **có đo**; hoặc hash trên `worker_threads` / process riêng |
| `JSON.parse` + fs chậm | Parse là main thread | Offload parse; pool không cứu JS |
| Tăng pool lên 128 | Context switch, RAM | Benchmark p99; thường 8–32 đủ |

```js
import dns from "node:dns/promises";
await dns.lookup("example.com");   // pool + OS hosts
await dns.resolve4("example.com"); // DNS protocol — khác đường
```

Nhiều `lookup` đồng thời → “fs chậm bí ẩn”. Tăng size giúp throughput **pool** — **không** thay `worker_threads` cho JS CPU.

### 11.2 Công thức thực dụng

1. Đo: p99 HTTP, ELU, event loop delay, CPU `user` vs disk.
2. Nếu delay thấp + fs/crypto chậm: giới hạn `mapPool` bằng **4** (hoặc pool size), **rồi** mới tăng `UV_THREADPOOL_SIZE`.
3. Tách `dns.lookup` (hosts, libc) khỏi hot path — cache / `resolve4` khi đúng nghĩa DNS.
4. `pbkdf2` login: concurrency 1–2 hoặc worker/process riêng; đừng `Promise.all` 200 hash.
5. zlib nén response lớn: giới hạn song song; cân nhắc offload.
6. Windows/Unix cùng env var; container: pool 4 trên 1 CPU cgroup vẫn 4 thread — oversubscribe có chủ đích.

`crypto.randomFill` / một số primitive dùng pool; `crypto.randomUUID()` thường không (không nhầm mọi `crypto.*` là pool). Đọc docs từng hàm khi tối ưu.

Promise fan-out không giới hạn trên `fs/promises` = queue libuv ẩn — [async.md](async.md) `mapPool`.

---

## 12. Đo lag: delay histogram, ELU, `--trace-sync-io`

### 12.1 Sync & CPU nặng

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

### 12.2 `monitorEventLoopDelay` — đọc số đúng

```js
import { monitorEventLoopDelay } from "node:perf_hooks";

const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
setInterval(() => {
  console.log({
    meanMs: h.mean / 1e6,
    p99Ms: h.percentile(99) / 1e6,
    maxMs: h.max / 1e6,
    exceeds: h.exceeds,
  });
  h.reset();
}, 5000);
```

- Histogram đơn vị **nanosecond** → chia `1e6` ra ms.
- `resolution`: chu kỳ sample (ms). Thô quá → bỏ sót spike ngắn; mịn quá → overhead.
- `exceeds`: số lần delay **vượt** resolution.
- **p99 delay ≠ p99 latency HTTP** — chỉ “main thread bị giữ bao lâu giữa các tick”.
- Idle vẫn có noise ~ resolution; đừng alert mean 0.5ms. Nhìn **p99/max cửa sổ 5–15s**.
- `reset()` giữa các cửa sổ để không trộn warmup.

| Đọc | Ý nghĩa |
|-----|---------|
| p99 ~ 1–5ms dưới load vừa | Bình thường |
| p99 50–200ms | Callback dài / GC / sync I/O / JSON lớn |
| max giây | Loop gần như chết — `*Sync` hoặc CPU loop |

### 12.3 `eventLoopUtilization`

```js
import { performance } from "node:perf_hooks";

const start = performance.eventLoopUtilization();
// ... sau một khoảng ...
const end = performance.eventLoopUtilization(start);
console.log(end.idle, end.active, end.utilization); // utilization 0..1
```

`utilization ≈ active / (active + idle)`. Có thể truyền hai sample.

| ELU | Delay p99 | Đọc |
|-----|-----------|-----|
| Cao, delay thấp | Bận **có ích** (nhiều callback ngắn) — scale/fan-out | |
| Cao, delay cao | Quá tải hoặc **block** | Tìm sync CPU |
| Thấp, delay cao | Ít callback nhưng kẹt lâu (GC pause, sync hiếm) | Profile |
| Thấp, delay thấp | Nhàn | |

ELU không nói “threadpool đầy”. Kết hợp: ELU thấp + fs chậm → nghi pool (§11).

### 12.4 Đọc số production (ví dụ)

Cửa sổ 15s, `resolution: 20`:

| p99 delay | ELU | CPU user | Hành động |
|-----------|-----|----------|-----------|
| 2ms | 0.4 | 20% | Ổn |
| 3ms | 0.85 | 70% | Bận ích — scale ngang process hoặc cắt fan-out JS |
| 80ms | 0.9 | 95% | Block/CPU JS — profile / worker |
| 80ms | 0.2 | 10% | GC pause hoặc spike hiếm — heap snapshot |
| 2ms | 0.2 | 40% sys | fs/crypto pool hoặc disk — không phải “thêm worker JS” |

Alert: p99 delay > 50ms trong 3 cửa sổ liên tiếp, **không** alert ELU đơn độc.

`performance.eventLoopUtilization(util1, util2)`: delta giữa hai sample tường minh — hữu ích middleware đo **một** request (sample trước/sau handler). Request I/O-wait: ELU delta thấp dù wall-clock cao — đúng.

### 12.5 `--trace-sync-io`

```bash
node --trace-sync-io app.js
```

Cảnh báo khi **sync I/O** chạy **sau khi** event loop đã start (stack in stderr). Phù hợp CI server: bắt `readFileSync` lọt request path.

**Không** bắt: `JSON.parse`, regex nặng, loop CPU, crypto JS thuần. Bổ sung delay histogram + CPU profile.

CI gợi ý: job test server `node --trace-sync-io ./dist/server.js` + smoke request; fail nếu stderr chứa `WARNING: Detected use of sync IO`. Một số boot `readFileSync` config **trước** listen có thể vẫn cảnh báo nếu loop đã start — load config sync **trước** `createServer().listen` hoặc chuyển `fs/promises`.

`--trace-sync-io` không thay APM: không đo p99. Dùng để **cấm** `*Sync` lọt.

---

## 13. CPU offload: sync vs async I/O vs worker

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

Chi tiết: [threading.md](threading.md). I/O-bound: **đừng** thread — xem threading “when NOT”.

### 13.1 Walkthrough một request HTTP

```
1. OS: packet tới socket (không chiếm JS)
2. poll: callback parser HTTP trên main — phải ngắn
3. nextTick/microtask: tiếp parser / Promise handler
4. User `async` handler: await fetch/db — nhường loop (poll nhận request khác)
5. Nếu handler JSON.parse 20MB sync → delay histogram spike; request khác đợi
6. res.end → I/O kernel; 'finish'/'close' sau (close phase khi handle đóng)
7. setImmediate sau I/O: flush log không chặn poll hiện tại
```

Giữ bước 2 và 5 mỏng. Fan-out 100 `readFile` trong bước 4: Promise concurrent nhưng **4** threadpool — không phải 100 disk song song ma thuật.

### 13.2 `ref` / `unref` (timer, immediate, socket, worker)

Handle “ref’d” giữ process sống. `timeout.unref()`: timer không chặn thoát. Server socket listen thường ref. Worker mặc định ref — `worker.unref()` nếu background thuần và bạn chấp nhận process thoát khi hết handle khác.

CLI: `unref` timer heartbeat. Server: ít khi `unref` request timer — request dở chết silent.

---

## 14. Node vs browser event loop

| | **Node (libuv)** | **Browser** |
|--|------------------|------------|
| Phases | timers / pending / poll / check / close | Task queue + rendering; không poll/check |
| `process.nextTick` | Có, trước microtask | Không |
| `setImmediate` | Phase check | Không (trừ API cũ IE) |
| `setTimeout(0)` | Timers phase; không clamp 4ms HTML | Có thể clamp ~4ms khi lồng |
| Microtask | Có (`then`, `queueMicrotask`) | Có — sau mỗi task, trước render |
| `requestAnimationFrame` | Không | Có — trước paint |
| Threadpool fs/crypto | libuv pool | Không (I/O khác) |
| UI / layout | Không | Style/layout/paint xen task |
| `queueMicrotask` | Có | Có — portable “sau stack” |

Cùng: **một** JS thread (trừ Worker); `await` không block OS thread; throw trong `queueMicrotask` vs `then` khác nhau ([async.md](async.md)).

### 14.1 Microtask checkpoint

Cả hai môi trường: sau mỗi **task** (macrotask), xả hết microtask trước task kế / trước paint (browser). Node chèn **nextTick** trước microtask — đây là khác biệt lớn nhất khi port code.

Browser `queueMicrotask` + DOM: mutation observer / promises xen render. Node không có paint — “frame” = một vòng libuv.

Worker browser (`new Worker`) ≈ isolate + message; **không** có `parentPort` Node, không `fork`, không libuv pool giống main Node. `worker_threads` Node giàu `FileHandle` transfer hơn browser.

> Code isomorphic: đừng `nextTick` / `setImmediate` trên đường shared. `queueMicrotask` + `setTimeout` portable hơn.

---

## 15. So sánh nhanh API lên lịch

| API | Khi chạy | Starve risk | Ghi chú |
|---|---|---|---|
| Sync | ngay | block loop | giữ ngắn |
| `process.nextTick` | trước microtasks | **cao** nếu đệ quy | emit-after-construct |
| `queueMicrotask` / `then` | microtask | **cao** nếu đệ quy | chuẩn JS |
| `setTimeout(fn, 0)` | timers | thấp | **không** phải next tick |
| `setImmediate` | check | thấp | sau poll; yield tốt |
| I/O callback | poll | — | đừng block bên trong |
| `'close'` | close phase | — | cleanup |
| `worker_threads` | thread khác | — | CPU song song |

### 15.1 Myths

| Myth | Thực tế |
|------|---------|
| `setTimeout(0)` = next tick | Timers phase; sau nextTick **và** microtask |
| `await` nhường CPU core khác | Chỉ continuation microtask trên **cùng** thread |
| `fs.promises` không bao giờ block main | Callback ngắn trên main; work có thể **threadpool** |
| Tăng `UV_THREADPOOL_SIZE` chữa JSON.parse | Parse là JS main |
| `setImmediate` luôn trước `setTimeout(0)` | Chỉ đáng tin **trong** I/O callback |
| Delay histogram = latency API | Chỉ loop lag |
| ELU cao = luôn xấu | Bận ích nếu delay thấp |
| `--trace-sync-io` bắt mọi block | Chỉ sync I/O, không CPU JS |
| Recursive `then` “không sao” vì async | Starve macrotask như `nextTick` flood |
| AbortSignal ngắt `for` sync | Không — phải `throwIfAborted` giữa chừng |

### 15.2 Recipe yield / block

```js
// Block — đừng
while (Date.now() < t) {}

// Yield mỗi N item
for (let i = 0; i < n; i++) {
  work(i);
  if (i % 500 === 0) await new Promise((r) => setImmediate(r));
}

// Sai yield
for (const x of xs) {
  await Promise.resolve(); // microtask — vẫn starve I/O nếu work() nặng
  work(x);
}
```

`work()` 2ms × 10_000 = 20s block dù có `await Promise.resolve()` xen — microtask không mở poll. **Phải** `setImmediate` / worker.

Đo trước khi “optimize” pool: một `readFileSync` trong middleware tàn hơn 3 worker.

### 15.3 Addon C++ & threadpool

Native addon gọi `uv_queue_work` → **cùng** pool 4 với fs/crypto. Addon “async” vẫn tranh chấp. `NAN`/`N-API` async worker: đo như `pbkdf2`. Addon block trên main (sync C++) = delay histogram — `--trace-sync-io` **không** bắt CPU C++.

V8 JIT: warmup không liên quan phases. Deopt trong hot handler = spike CPU JS.

`process.hrtime.bigint()` đo wall trong callback — không phải “thời gian rảnh loop”. Dùng ELU/histogram cho loop, hrtime cho đoạn code.

### 15.4 Cây quyết định lên lịch

```
Cần chạy sau stack hiện tại, trước I/O?
  có → nextTick (hiếm) hoặc queueMicrotask (portable)
Cần nhường I/O/timer khác?
  có → setImmediate (yield) hoặc setTimeout(ms)
Cần đúng-ish ms?
  có → setTimeout / timers/promises + chấp nhận delay min + lag
Cần song song CPU JS?
  có → worker_threads, không phải setImmediate
Cần I/O concurrent?
  → async/Promise, không worker
```

`setInterval` vs lặp `setTimeout`: interval drift khi callback lâu; lặp timeout tính `remaining` sát deadline hơn một chút — vẫn không realtime.

Debug thứ tự: log timestamp `performance.now()` trong từng callback, **đừng** tin cảm giác. `--trace-event-categories node.perf` / Chrome tracing khi cần sâu (ops), không phải ngày thường.

`node --inspect` + Performance tab: nhìn idle vs script. Không thay histogram ns.

`setTimeout(fn, 1)` vs `0`: trên Node hiện đại gần nhau; **cả hai** vẫn phase timers, không nextTick. Đừng viết `delay || 0` nghĩ đã microtask.

Port code browser→Node: xóa giả định rAF và 4ms clamp; thêm `nextTick` chỉ khi thật sự emit-after-construct.

`queueMicrotask` trong I/O callback: chạy trước check (cùng nhóm micro sau callback), giống `then`. `setImmediate` sau I/O vẫn check. Ba tầng: tick → micro → check.

`process.nextTick` từ C++ (một số API Node nội bộ) xen cùng tick queue — user `nextTick` không “ưu tiên hơn” nextTick của core. Đừng giả định thứ tự hai `nextTick` từ hai nguồn trừ FIFO enqueue.

`import()` dynamic: Promise microtask khi module evaluate xong — có thể sau I/O load file. TLA block importer — [async.md](async.md) §15.

### 15.5 `close` vs `finish` vs unref — CLI vs server

```js
import { createWriteStream } from "node:fs";

const ws = createWriteStream("out.bin");
ws.write("x");
ws.end();
ws.on("finish", () => console.log("flushed"));
ws.on("close", () => console.log("fd closed"));
// process có thể thoát trước close nếu không await finished() — CLI hay dính
```

Server: listen handle ref. CLI file write: `await finished(ws)` hoặc `ws.ref()` mặc định thường đủ nếu stream còn; `unref` nhầm = mất dữ liệu.

`process.exit(0)` bỏ qua close callbacks đang chờ — flush sync hoặc `exitCode` + để loop drain. Graceful: [main-function.md](main-function.md).

`setImmediate` + `unref`: immediate không giữ process — CLI script + unref immediate = không chạy. Server đừng unref immediate request-scoped.

`fs.watch` / `net.Socket` timeout: macrotask từ I/O, không phải timer JS `setTimeout` (một số API dùng libuv timer nội bộ). `AbortSignal.timeout` là timer JS/web — khác `socket.setTimeout`.

`process.nextTick` trong `'uncaughtException'` — nguy hiểm; shutdown sync. Xem [exceptions.md](exceptions.md).

`performance.nodeTiming` / `mark` / `measure`: đo đoạn user, không thay ELU. `monitorEventLoopDelay` `disable()` khi test xong — tránh leak histogram trong unit test song song.

`setTimeout(fn, ms, arg)` truyền arg — tránh closure; vẫn timers phase.

`clearTimeout` / `clearImmediate` trước abort cleanup — đôi khi abort và timer fire cùng turn; idempotent callback.

`util.promisify(setTimeout)` legacy khác `timers/promises.setTimeout` (thứ tự arg). Baseline: `node:timers/promises`.

`setImmediate` trong `close` callback: check **vòng sau** close phase. Cleanup nặng: đừng nhét CPU vào `'close'`.

`poll` chờ khi threadpool busy: poll vẫn chạy (network); chỉ fs/crypto chậm — “HTTP OK, disk đơ”.

`dns.setDefaultResultOrder("ipv4first")` đổi thứ tự lookup, không đổi việc lookup dùng pool.

`setInterval` + `unref` + server: interval không giữ process nếu mọi thứ khác unref — health ping biến mất. Server: interval ref mặc định OK.

`loop delay` cao lúc GC: `max` spike đơn lẻ vs p99 bền. Alert p99 cửa sổ, không max một sample.

`--max-old-space-size` ảnh hưởng GC pause (delay) — không phải `UV_THREADPOOL_SIZE`.

`--trace-sync-io` in stderr: parse CI fail-on-warn. Kết hợp `--trace-uncaught` khi debug rejection — [exceptions.md](exceptions.md), [async.md](async.md).

`idle, prepare` phase: không có API user; đừng log “vào idle”.

`UV_RUN_DEFAULT` vs `UV_RUN_ONCE` (C++): JS không gọi trực tiếp; `process.exit` / hết handle = loop stop. Test: `setImmediate` giữ loop nếu còn ref.

`async_hooks` `executionAsyncId` debug ALS — đắt, đừng bật full hooks production. ALS đã tối ưu hơn raw hooks.

`queueMicrotask` vs `setImmediate` cho “chia batch”: micro starve I/O; immediate không. Mặc định yield = `setImmediate`. Xem §15.4.

`timers/promises.setImmediate(value)` fulfill `value` — khác `setImmediate(fn)`. Đừng nhầm callback vs promise API.

`setTimeout` 32-bit delay: delay cực lớn bị clamp (spec/web-ish) — đừng `timeout(2**40)`. Deadline dài: timer 24h max rồi re-arm, hoặc scheduler ngoài.

`Date.now()` vs `hrtime`: timer libuv dùng monotonic clock nội bộ — nhảy NTP không “bỏ” timer như tường.

---

## 16. Best practices

1. Main thread **mỏng**: I/O async, CPU offload, callback ngắn.
2. Tránh `*Sync` trên server path (CLI one-shot có thể OK). `--trace-sync-io` trên CI.
3. Đừng dựa `setTimeout(0)` vs `setImmediate` ngoài I/O đã hiểu và đo. `setTimeout(0)` ≠ nextTick.
4. Ưu tiên Promise/`async await`; nhớ continuation = microtask — [async.md](async.md).
5. Cấm `nextTick`/`then` đệ quy không bound; chia batch bằng `setImmediate`.
6. Theo dõi `monitorEventLoopDelay` (p99 ns→ms) + ELU: cao+delay cao = block; cao+delay thấp = bận ích.
7. Tăng `UV_THREADPOOL_SIZE` có chủ đích; đo trước/sau; nhớ pool fs+crypto+lookup dùng chung.
8. Phân biệt `dns.lookup` (pool) vs `resolve*` khi debug latency DNS.
9. Health check fail khi loop lag vượt ngưỡng — không chỉ “process alive”.
10. Document quyết định offload (bảng §13) nếu service latency-critical.

---

## 17. Checklist

```text
□ Không *Sync / busy-loop trên request path
□ Không nextTick/Promise đệ quy không lối thoát macrotask
□ Không phụ thuộc race timeout(0) vs immediate ở top-level
□ Không dùng setTimeout(0) như nextTick
□ CPU nặng: worker hoặc giới hạn concurrency + đo pool
□ UV_THREADPOOL_SIZE chỉ đổi sau benchmark; fs+crypto chung pool
□ Có metric event loop delay (p99) và/hoặc ELU — hiểu ý nghĩa
□ I/O callback không JSON.parse/hash khổng lồ sync
□ Yield (setImmediate) nếu xử lý mảng lớn trên main
□ Load test quan sát p99 khi fan-out fs/crypto
□ CI: --trace-sync-io (server)
```

---

## 18. Cheat sheet

```js
// sync → nextTick → microtasks → phase macrotask
process.nextTick(fn);
queueMicrotask(fn);
setTimeout(fn, 0);   // timers — KHÔNG phải next tick
setImmediate(fn);    // check / yield / sau I/O

import { monitorEventLoopDelay, performance } from "node:perf_hooks";
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
h.percentile(99) / 1e6; // ms
performance.eventLoopUtilization();
```

```bash
node --trace-sync-io app.js
# UV_THREADPOOL_SIZE=16 node app.js
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

## 19. Version notes

| Dòng | Ghi chú |
|---|---|
| **Node 26** (baseline) | Phases / nextTick / microtask ổn định; đo bằng `perf_hooks` |
| Node 24 LTS | Cùng mô hình cốt lõi (Maintenance LTS) |
| `monitorEventLoopDelay` | Histogram delay (**ns**) |
| `eventLoopUtilization` | ELU 0..1 — idle/active |
| `--trace-sync-io` | Sync I/O sau khi loop start |
| `timers/promises` + `AbortSignal` | Sleep/timer hủy được |
| Pool mặc định **4** | `UV_THREADPOOL_SIZE` lúc start |

Semantics phases ít breaking giữa major; chỗ hay sai là giả định timer/immediate và quên đo lag.

---

## 20. Tài liệu liên quan

- [Lập trình bất đồng bộ](async.md) — Promise jobs, `await`, combinators
- [AbortSignal & request context](abort-context.md) — hủy không ngắt CPU sync
- [Worker Threads & Child Process](threading.md)
- [Node.js built-ins](nodejs-apis.md)
- [Exception / Error](exceptions.md)
