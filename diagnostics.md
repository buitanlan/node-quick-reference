# Debugging, diagnostics & hiệu năng

Tham khảo vận hành và điều tra **Node 26 + TS 7**: chọn công cụ theo triệu chứng, phân biệt CPU/heap/native memory và giữ thông tin lỗi có thể truy vết.

## Mục lục

- [1. Chọn phép đo theo triệu chứng](#1-chọn-phép-đo-theo-triệu-chứng)
- [2. Inspector, source maps và stack](#2-inspector-source-maps-và-stack)
- [3. CPU profile và latency](#3-cpu-profile-và-latency)
- [4. Heap, RSS và memory leak](#4-heap-rss-và-memory-leak)
- [5. Diagnostic report, warning và handles](#5-diagnostic-report-warning-và-handles)
- [6. Context, logs và tracing](#6-context-logs-và-tracing)
- [7. Benchmark & kiểm compiler](#7-benchmark--kiểm-compiler)
- [8. Checklist & tài liệu liên quan](#8-checklist--tài-liệu-liên-quan)

---

## 1. Chọn phép đo theo triệu chứng

| Triệu chứng | Đo trước | Công cụ tiếp theo |
|---|---|---|
| p99 tăng, main CPU cao | Event loop delay + ELU | CPU profile, sync/regex/JSON work |
| Request chậm, main nhàn | Upstream spans, pool wait, queue depth | Network/DB timeout, libuv contention |
| RSS tăng | Heap vs external/ArrayBuffer | Heap profile/snapshot, native allocator |
| CLI không thoát | Resource đang giữ loop | `getActiveResourcesInfo`, timer/socket/worker |
| Crash hoặc lỗi native | Error code, stderr, report | Core dump/native debugger theo môi trường |
| Build chậm | Thời gian compiler, peak memory | `extendedDiagnostics`, workers/builders |

ELU là thời gian loop active/idle, không phải CPU utilization của toàn process. Latency histogram dùng đơn vị đúng: `monitorEventLoopDelay` trả ns; biểu đồ ms phải chia `1e6`. Xem [event-loop.md](event-loop.md#12-đo-lag-delay-histogram-elu---trace-sync-io).

## 2. Inspector, source maps và stack

```sh
node --inspect=127.0.0.1:9229 --enable-source-maps dist/index.js
node --inspect-brk=127.0.0.1:9229 --enable-source-maps dist/index.js
```

`--inspect-brk` dừng trước code entry, hữu ích điều tra boot/module init; `--inspect` chạy tiếp và cho attach sau. Inspector cho phép thực thi mã trong process: bind loopback, truy cập từ xa qua tunnel được kiểm soát. [Debugger](https://nodejs.org/api/debugger.html).

`sourceMap: true`/`inlineSourceMap` thuộc compiler; Node `--enable-source-maps` remap stack khi map có sẵn. Giữ JS/map khớp cùng build; source map không khôi phục file đã không được phát hành và không sửa lỗi path runtime. Nội dung `sourcesContent` có thể chứa code nhạy cảm: chọn cách phân phối theo môi trường.

Lỗi phải giữ `cause` và `code`; log một lần ở biên xử lý. Không chỉ log `error.message` khi cần trace nguyên nhân. Không parse message để phân loại lỗi. Xem [exceptions.md](exceptions.md).

## 3. CPU profile và latency

```sh
node --cpu-prof --cpu-prof-dir=./profiles dist/index.js
node --trace-sync-io dist/index.js
```

Tạo thư mục output trước, tái hiện workload đủ lâu rồi kết thúc process có kiểm soát để profile được ghi. `--cpu-prof` cho sampling profile; xem hot path và thời gian inclusive/exclusive. Một hàm đứng đầu profile có thể là nơi tiêu CPU, nhưng không chứng minh đó là nguyên nhân mọi request chậm. [CLI profiling](https://nodejs.org/api/cli.html#--cpu-prof).

Đo end-to-end p50/p95/p99 cùng throughput, error rate, queue wait và resource saturation. Event loop delay cao + CPU JS cao gợi ý offload/chia batch; CPU thấp nhưng upstream chậm cần deadline/pool tuning. Không tăng `UV_THREADPOOL_SIZE` để chữa CPU JS trên main.

`performance.now()`/`hrtime.bigint()` đo duration monotonic; `Date.now()` dành cho timestamp wall clock. Warm-up, GC và logging có thể làm microbenchmark khác production.

## 4. Heap, RSS và memory leak

```js
import { memoryUsage } from "node:process";
const usage = memoryUsage();
console.log({
  rss: usage.rss,
  heapUsed: usage.heapUsed,
  external: usage.external,
  arrayBuffers: usage.arrayBuffers,
}); // bytes; arrayBuffers là phần được tính trong external
```

| Metric | Ý nghĩa thực dụng |
|---|---|
| `heapUsed` / `heapTotal` | Heap V8 dùng/đã cấp |
| `external` | Bộ nhớ native được gắn với object JS |
| `arrayBuffers` | ArrayBuffer/SAB/Buffer backing stores; không cộng lại với external |
| `rss` | Pages resident của toàn process, gồm heap/native/code/stack |

RSS tăng khi heap ổn định có thể do Buffer/native allocation/fragmentation; không kết luận JS leak chỉ từ RSS. Worker có heap riêng; RSS vẫn là process chung. [Memory metrics](https://nodejs.org/api/process.html#processmemoryusage).

```sh
node --heap-prof --heap-prof-dir=./profiles dist/index.js
node --heapsnapshot-signal=SIGUSR2 dist/index.js
```

Signal snapshot là workflow POSIX; Windows dùng Inspector hoặc `v8.writeHeapSnapshot()` có kiểm soát. Snapshot dừng main thread và có thể cần bộ nhớ lớn, làm process thiếu RAM/crash. Dùng replica/instance phù hợp; snapshot chứa secrets và dữ liệu request. [Heap snapshot considerations](https://nodejs.org/en/learn/diagnostics/memory/using-heap-snapshot).

So snapshot sau warm-up và sau workload lặp tương đương; tìm retained size và retaining path đến cache/listener/closure. `WeakRef`/FinalizationRegistry không thay chính sách eviction hay đóng resource.

## 5. Diagnostic report, warning và handles

```js
import process from "node:process";
console.log(process.getActiveResourcesInfo());
// Khi điều tra: chọn directory/filename trước, hạn chế quyền đọc artifact.
// process.report.writeReport("./reports/incident.json");
```

`getActiveResourcesInfo()` trả **loại** resource đang giữ loop, không trả object/owner/stack. Kết hợp log lúc tạo/đóng resource; tránh API private `_getActiveHandles` như hợp đồng ổn định.

Report chứa stack, heap/native/process/OS context; cấu hình `--report-on-fatalerror`, `--report-uncaught-exception` khi cần artifact crash. Không ghi report mỗi request; cấu hình loại env nhạy cảm theo version hoặc xử lý artifact như dữ liệu bí mật. [Diagnostic report](https://nodejs.org/api/report.html).

`--trace-warnings` và `--trace-deprecation` tìm nơi dùng API cũ. `MaxListenersExceededWarning` là tín hiệu có thể leak, không hard limit; tăng max listeners chỉ sau khi hiểu vòng đời listener. JS fatal handlers không bảo đảm chạy khi OOM/native crash/kill.

## 6. Context, logs và tracing

Structured logs: timestamp, level, request/trace ID, route template, duration và error code. Route `/users/:id` tránh cardinality cao hơn URL đầy đủ; không lấy user ID/URL tùy ý làm label metric.

`AsyncLocalStorage.run()` giữ store qua async chain, không tự truyền sang Worker/child hoặc qua network. Gửi trace/request metadata tường minh qua message/header; validate header ngoài process. ALS không tạo distributed trace và không hủy công việc. [abort-context.md](abort-context.md#7-asynclocalstorage).

`diagnostics_channel` cho thư viện publish sự kiện; subscriber chạy trong luồng publish và có thể tăng chi phí hoặc throw. Kiểm `hasSubscribers` trước khi tạo payload đắt; không publish secrets. OTel/APM phải phối hợp instrumentation để tránh duplicate spans. [Diagnostics Channel](https://nodejs.org/api/diagnostics_channel.html).

## 7. Benchmark & kiểm compiler

Giữ cùng Node/TS patch, hardware/container quota, dataset và dependency lock. Đo nhiều lượt sau warm-up, giữ phân phối và peak memory; không chỉ lấy lượt nhanh nhất. Đo workload thực có concurrent requests và backpressure trước khi kết luận về Map/Array/worker pool.

```sh
tsc --noEmit --extendedDiagnostics
tsc -b --checkers 2 --builders 2
```

Flags parallel của TS 7 có stability riêng; số checkers × builders có thể tăng RAM nhanh. CLI/compiler API/editor là ba consumer khác nhau: CLI nhanh không chứng minh ESLint/editor đã dùng native compiler. Kiểm migration và bridge trong [tsconfig.md](tsconfig.md).

## 8. Checklist & tài liệu liên quan

- Tái hiện triệu chứng và ghi runtime/build/workload trước khi đo.
- Phân biệt latency, CPU, loop lag, pool wait và memory categories.
- Profiling/report có output directory, cleanup và kiểm soát dữ liệu nhạy cảm.
- Sau thay đổi, đo lại cùng workload và kiểm error rate/p99.

[Event loop](event-loop.md) · [Built-ins](nodejs-apis.md) · [Workers](threading.md) · [Errors](exceptions.md) · [Security](security.md).
