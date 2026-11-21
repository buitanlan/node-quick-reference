# Debugging, diagnostics & hiệu năng

*(Observability, Inspector Protocol, `perf_hooks`, CPU/Heap profiling, Memory leaks, Diagnostic Reports, `diagnostics_channel`, OpenTelemetry & TS 7 compiler diagnostics)*

Baseline: **Node.js 26 Active LTS ("Lithium", V8 14.6+, Undici 8+)** và **TypeScript 7.0 (native Go compiler)**. Tài liệu tập trung vào điều tra sự cố production có phương pháp: chọn đúng công cụ theo triệu chứng, phân tách CPU JS / Event Loop / libuv pool / V8 Heap / Native Memory và giữ artifact an toàn dữ liệu. Kiến thức nền về pha vòng lặp xem [event-loop.md](event-loop.md); ngữ cảnh hủy & ALS nền tảng xem [abort-context.md](abort-context.md).

> **Nguyên tắc vàng:** **Đo trước khi đoán.** Một CPU profile ở máy dev hay một con số RSS đứng một mình hiếm khi chứng minh được gốc rễ sự cố production. Luôn ghi lại **Node/TS version, giới hạn cgroup CPU/RAM, workload, p50/p95/p99, error rate và saturation** trước và sau mỗi thay đổi.

---

## Mục lục

- [1. Triage theo triệu chứng & mô hình quan sát (Observability)](#1-triage-theo-triệu-chứng--mô-hình-quan-sát-observability)
  - [1.1 Bảng quyết định: Triệu chứng → Đo trước → Bước 2 → Bẫy hiểu sai](#11-bảng-quyết-định-triệu-chứng--đo-trước--bước-2--bẫy-hiểu-sai)
  - [1.2 Phân tách các trục đo: Latency, Throughput, Saturation, CPU, ELU, Lag, Pool Wait & Native Memory](#12-phân-tách-các-trục-đo-latency-throughput-saturation-cpu-elu-lag-pool-wait--native-memory)
  - [1.3 Quy trình khoanh vùng sự cố 4 bước](#13-quy-trình-khoanh-vùng-sự-cố-4-bước)
- [2. Inspector Protocol, Remote Debugging & Source Maps](#2-inspector-protocol-remote-debugging--source-maps)
  - [2.1 Cờ CLI `--inspect`, `--inspect-brk`, `--inspect-wait` & bảo mật (`--disable-sigusr1`)](#21-cờ-cli---inspect---inspect-brk---inspect-wait--bảo-mật---disable-sigusr1)
  - [2.2 Programmatic Inspector với `node:inspector/promises` (`Session`)](#22-programmatic-inspector-với-nodeinspectorpromises-session)
  - [2.3 Source Maps: `--enable-source-maps`, `process.setSourceMapsEnabled` & rủi ro `sourcesContent`](#23-source-maps---enable-source-maps-processsetsourcemapsenabled--rủi-ro-sourcescontent)
- [3. `node:perf_hooks` & Đo Latency / Event Loop thực chiến](#3-nodeperf_hooks--đo-latency--event-loop-thực-chiến)
  - [3.1 `monitorEventLoopDelay`: đọc đơn vị đúng, ý nghĩa `exceeds` & vòng đời](#31-monitoreventloopdelay-đọc-đơn-vị-đúng-ý-nghĩa-exceeds--vòng-đời)
  - [3.2 `eventLoopUtilization` (ELU) delta & đo `Worker`](#32-eventlooputilization-elu-delta--đo-worker)
  - [3.3 `PerformanceObserver`, `timerify` & `createHistogram`](#33-performanceobserver-timerify--createhistogram)
  - [3.4 Đồng hồ monotonic: `performance.now()` / `process.hrtime.bigint()` vs `Date.now()`](#34-đồng-hồ-monotonic-performancenow--processhrtimebigint-vs-datenow)
- [4. CPU Profiling, Flamegraphs & V8 Hot Paths (Node 26)](#4-cpu-profiling-flamegraphs--v8-hot-paths-node-26)
  - [4.1 CLI profiling: `--cpu-prof`, `--prof` + `--prof-process` & `--trace-sync-io`](#41-cli-profiling---cpu-prof---prof----prof-process----trace-sync-io)
  - [4.2 Programmatic CPU Profiling trên Node 26: `v8.startCpuProfile()` & `worker.startCpuProfile()`](#42-programmatic-cpu-profiling-trên-node-26-v8startcpuprofile--workerstartcpuprofile)
  - [4.3 Đọc Flamegraph & nhận diện V8 Hot Paths](#43-đọc-flamegraph--nhận-diện-v8-hot-paths)
- [5. Memory: V8 Heap Internals, RSS, Native Memory & Memory Leaks](#5-memory-v8-heap-internals-rss-native-memory--memory-leaks)
  - [5.1 Phân tách `process.memoryUsage()`, `v8.getHeapStatistics()`, Heap Spaces & `v8.GCProfiler`](#51-phân-tách-processmemoryusage-v8getheapstatistics-heap-spaces--v8gcprofiler)
  - [5.2 Container, cgroups & `--max-old-space-size`: vì sao bị OOMKilled trước khi GC chạy](#52-container-cgroups----max-old-space-size-vì-sao-bị-oomkilled-trước-khi-gc-chạy)
  - [5.3 Chụp Heap Profile & Heap Snapshot an toàn trên Production](#53-chụp-heap-profile--heap-snapshot-an-toàn-trên-production)
  - [5.4 Kỹ thuật 3-Snapshot (Three-Snapshot Technique)](#54-kỹ-thuật-3-snapshot-three-snapshot-technique)
  - [5.5 6 mẫu Memory Leak kinh điển trong Node.js](#55-6-mẫu-memory-leak-kinh-điển-trong-nodejs)
- [6. Diagnostic Reports, Active Resources & Trace Flags (Node 26)](#6-diagnostic-reports-active-resources--trace-flags-node-26)
  - [6.1 `process.getActiveResourcesInfo()` debug CLI/server treo không thoát](#61-processgetactiveresourcesinfo-debug-cliserver-treo-không-thoát)
  - [6.2 Diagnostic Reports: CLI flags, `process.report.writeReport()` & bảo mật](#62-diagnostic-reports-cli-flags-processreportwritereport--bảo-mật)
  - [6.3 Cách đọc JSON Diagnostic Report khi điều tra sự cố](#63-cách-đọc-json-diagnostic-report-khi-điều-tra-sự-cố)
  - [6.4 Bảng tổng hợp Trace Flags trên Node 26](#64-bảng-tổng-hợp-trace-flags-trên-node-26)
- [7. Structured Logging, `AsyncLocalStorage`, `diagnostics_channel` & OpenTelemetry](#7-structured-logging-asynclocalstorage-diagnostics_channel--opentelemetry)
  - [7.1 Structured Logging chuẩn Production & chống High-Cardinality](#71-structured-logging-chuẩn-production--chống-high-cardinality)
  - [7.2 `AsyncLocalStorage` với V8 `AsyncContextFrame` trên Node 26](#72-asynclocalstorage-với-v8-asynccontextframe-trên-node-26)
  - [7.3 `node:diagnostics_channel`: `channel`, `tracingChannel`, `bindStore` & `boundedChannel` (Node 26.1+)](#73-nodediagnostics_channel-channel-tracingchannel-bindstore--boundedchannel-node-261)
  - [7.4 Tích hợp OpenTelemetry (OTel): `traceparent` & tránh Duplicate Spans](#74-tích-hợp-opentelemetry-otel-traceparent--tránh-duplicate-spans)
- [8. Benchmarking đúng chuẩn & TS 7 Native Compiler Diagnostics](#8-benchmarking-đúng-chuẩn--ts-7-native-compiler-diagnostics)
  - [8.1 Bẫy Microbenchmark trên V8 & quy chuẩn đo đạc](#81-bẫy-microbenchmark-trên-v8--quy-chuẩn-đo-đạc)
  - [8.2 TypeScript 7 (Go Native Compiler) Diagnostics & Tuning](#82-typescript-7-go-native-compiler-diagnostics--tuning)
- [9. Anti-patterns & Runbook chẩn đoán nhanh](#9-anti-patterns--runbook-chẩn-đoán-nhanh)
  - [9.1 Anti-patterns phổ biến khi debug & tối ưu](#91-anti-patterns-phổ-biến-khi-debug--tối-ưu)
  - [9.2 Runbook chẩn đoán nhanh theo tình huống vận hành](#92-runbook-chẩn-đoán-nhanh-theo-tình-huống-vận-hành)
- [10. Checklist & Cheat sheet](#10-checklist--cheat-sheet)
  - [10.1 Checklist điều tra & sẵn sàng Production](#101-checklist-điều-tra--sẵn-sàng-production)
  - [10.2 Cheat sheet lệnh CLI & API Node 26](#102-cheat-sheet-lệnh-cli--api-node-26)
- [11. Tài liệu liên quan](#11-tài-liệu-liên-quan)

---

## 1. Triage theo triệu chứng & mô hình quan sát (Observability)

Khi sự cố xảy ra, chọn sai công cụ không chỉ mất thời gian mà còn có thể **làm sập thêm replica đang khỏe** (ví dụ chụp Heap Snapshot trên container sắp cạn RAM, hay tăng `UV_THREADPOOL_SIZE` khi main thread đang kẹt `JSON.parse`).

### 1.1 Bảng quyết định: Triệu chứng → Đo trước → Bước 2 → Bẫy hiểu sai

| Triệu chứng quan sát | Đo gì trước (tác động thấp) | Công cụ bước 2 (đào sâu) | Bẫy hiểu sai phổ biến |
|---|---|---|---|
| **p99 tăng vọt, CPU main ~100%** | `monitorEventLoopDelay` (p99 ms) + ELU + `gc` observer | `v8.startCpuProfile()` / `--cpu-prof`, `--trace-sync-io`, flamegraph | Tăng `UV_THREADPOOL_SIZE` (không cứu JS trên main thread); tin hàm đầu bảng CPU chắc chắn gây chậm mọi route |
| **p99 tăng, CPU JS & ELU đều thấp** | Upstream spans (DB/HTTP/Redis), connection pool wait, queue depth | Trace phân tán (OTel), `diagnostics_channel` (`undici:*`, `dns.lookup`), kiểm timeout/deadline | Nghĩ Node chậm; tối ưu micro-code JS trong khi 95% thời gian chờ DB pool hoặc `dns.lookup` |
| **fs / `pbkdf2` / `zlib` chậm dù disk & CPU JS rảnh** | Số tác vụ libuv đang chạy song song + latency từng loại | Khoanh vùng `dns.lookup` vs `fs` vs `crypto`; giới hạn concurrency (`mapPool`) rồi mới cân nhắc `UV_THREADPOOL_SIZE` | Tưởng mọi API async không tranh chấp nhau — thực tế `fs` + `crypto` + `zlib` + `dns.lookup` dùng chung 4 thread mặc định |
| **Event loop lag nhọn định kỳ (spike), code JS trông nhẹ** | `PerformanceObserver` (`entryTypes: ["gc"]`), `v8.getHeapSpaceStatistics()` | `v8.GCProfiler`, `--heap-prof` xem tỷ lệ cấp phát ngắn hạn (allocation rate) | Bỏ qua Major GC / Mark-Sweep-Compact pause vì tưởng chỉ sync CPU mới làm tăng event loop delay |
| **RSS tăng đều nhưng `heapUsed` đi ngang** | `memoryUsage()` (`external`, `arrayBuffers`, `rss`), số `Worker` | `--heap-prof`, kiểm Buffer/native addon/stream backpressure, allocator (glibc vs jemalloc) | Kết luận JS memory leak và chụp V8 Heap Snapshot — snapshot **không** cho thấy bộ nhớ C++ không nằm trong V8 heap |
| **RSS và `heapUsed` cùng tăng bậc thang** | Xu hướng `heapUsed` sau nhiều chu kỳ Major GC | `--heap-prof` / `v8.startHeapProfile()`, kỹ thuật **3-Snapshot** | So 1 snapshot duy nhất sau khi mới boot (khi cache hợp lệ chưa đầy) |
| **Container bị Linux OOMKilled (exit 137), không có stack JS** | Cgroup memory limit vs peak `rss` + `heap_size_limit` | `--heapsnapshot-near-heap-limit=3`, hạ `--max-old-space-size`, kiểm Buffer/Worker | Nghĩ `uncaughtException` sẽ bắt được OOM; đặt `--max-old-space-size` sát 100% RAM container |
| **CLI / job / server không tự thoát sau shutdown** | `process.getActiveResourcesInfo()` | Log vòng đời timer/socket/worker; kiểm `ref()`/`unref()`, `server.closeAllConnections()` | Gọi `process.exit(0)` vội làm mất log/flush, hoặc phụ thuộc API nội bộ `_getActiveHandles` |
| **Crash native (SIGSEGV / SIGABRT / fatal V8)** | Exit code, stderr, `--report-on-fatalerror` | Đọc `nativeStack` + `sharedObjects` trong Diagnostic Report; core dump / `gdb` / `lldb` | Mong chờ `try/catch` hay `process.on("uncaughtException")` chạy khi lỗi C++ addon hoặc OOM |
| **`tsc` build / typecheck chậm hoặc ăn RAM lớn** | `tsc --noEmit --extendedDiagnostics` | `tsc --generateTrace`, chỉnh `--checkers` / `--builders` / `--singleThreaded` | Thấy `tsc` TS 7 chạy nhanh nên tưởng ESLint/IDE cũng đã đổi sang native Go compiler |

### 1.2 Phân tách các trục đo: Latency, Throughput, Saturation, CPU, ELU, Lag, Pool Wait & Native Memory

Nhiều sự cố bị chẩn đoán sai vì gom chung mọi thứ vào “CPU cao” hay “server chậm”. Cần tách rõ 8 đại lượng khác nhau:

```
Request vào
   │
   ▼
[OS Kernel / Socket Queue] ──► Network & TCP backlog (Saturation mạng)
   │
   ▼
[Main Thread: V8 + Event Loop]
   ├── JS execution (CPU JS) ──► ELU tăng; nếu 1 tick dài ──► Event Loop Lag tăng
   ├── V8 GC pauses          ──► CPU + Event Loop Lag spike (dù JS logic nhẹ)
   └── Microtask flood       ──► Event Loop Lag tăng (phase libuv bị bỏ đói)
   │
   ├──► [libuv Threadpool (4 threads mặc định)]
   │       └── fs.*, dns.lookup, crypto.pbkdf2/scrypt, zlib ──► Threadpool Wait
   │
   ├──► [Worker Threads]
   │       └── Isolate V8 riêng (heap riêng, ELU riêng, chia sẻ RSS & CPU process)
   │
   └──► [Downstream I/O: DB / Redis / HTTP]
           └── Non-blocking trên main ──► Latency cao nhưng CPU & ELU thấp
```

| Khái niệm | Định nghĩa chính xác | Ngưỡng & cách đọc thực chiến |
|---|---|---|
| **Latency** | Thời gian hoàn tất 1 tác vụ từ đầu đến cuối | Luôn nhìn **phân phối p50 / p95 / p99 / p99.9**; trung bình (`mean`) che giấu đuôi chậm |
| **Throughput** | Số request / job xử lý mỗi giây (RPS / ops/s) | Phải đọc cùng Latency và Error rate; throughput tăng kèm 503 không phải cải thiện |
| **Saturation** | Độ đầy của tài nguyên hữu hạn (CPU quota, DB pool, threadpool, queue, RAM) | Khi saturation > 80–85%, latency thường tăng phi tuyến (đường cong hàng đợi) |
| **CPU JS (User/System CPU)** | Thời gian CPU toàn process tiêu thụ (`process.cpuUsage()` / OS metric) | Gồm main thread + GC background threads + libuv pool + `worker_threads`; >100% trên máy đa nhân là bình thường |
| **ELU (Event Loop Utilization)** | Tỷ lệ `active / (active + idle)` của **một** event loop (`0..1`) | Đo xem main thread bận hay rảnh, **không** phải CPU toàn process; xem ma trận §3.2 |
| **Event Loop Lag (Delay)** | Thời gian thực tế vượt quá chu kỳ hẹn mẫu của event loop (ns → ms) | Phản ánh độ **block liên tục** trong một lượt (sync CPU, `*Sync` I/O, Major GC pause) |
| **libuv Threadpool Wait** | Thời gian tác vụ `fs`/`crypto`/`zlib`/`dns.lookup` nằm xếp hàng chờ 1 trong `UV_THREADPOOL_SIZE` thread | Main thread trông rất nhàn (ELU thấp, Lag thấp), nhưng các call `fs`/`crypto` kéo dài |
| **Native Memory** | Bộ nhớ nằm ngoài V8 JS Heap (`external`, `arrayBuffers`, C++ addons, thư viện hệ thống, fragmentation) | Phản ánh qua khoảng cách `rss - heapTotal`; không nằm trong V8 Heap Snapshot |

### 1.3 Quy trình khoanh vùng sự cố 4 bước

1. **Tái hiện & chốt Baseline:** Ghi rõ `node -v`, `process.versions.v8`, CPU/RAM cgroup limit, RPS, kích thước payload, p50/p95/p99, ELU, `memoryUsage()`.
2. **Định vị tầng tắc nghẽn (Main vs Pool vs Downstream vs Memory):** Dùng bộ đo chi phí thấp (`perf_hooks`, `memoryUsage()`, spans downstream) trước khi bật profiler nặng.
3. **Thu bằng chứng có kiểm soát:** Chạy profiler / snapshot trên **1 replica tách riêng hoặc canary** (hoặc trong khung thời gian ngắn 10–30 giây), bảo vệ artifact khỏi lộ secrets.
4. **Sửa 1 biến số & kiểm chứng lại cùng workload:** Xác nhận p99, error rate, peak RSS và CPU cải thiện thật; tránh “tối ưu mù” nhiều thứ cùng lúc khiến không biết thứ gì có tác dụng.

---

## 2. Inspector Protocol, Remote Debugging & Source Maps

Node.js tích hợp sẵn **V8 Inspector Protocol** (Chrome DevTools Protocol — CDP) cho phép đặt breakpoint, đánh giá biểu thức, thu CPU profile và Heap snapshot từ xa hoặc ngay trong code.

### 2.1 Cờ CLI `--inspect`, `--inspect-brk`, `--inspect-wait` & bảo mật (`--disable-sigusr1`)

| Cờ CLI | Hành vi khi khởi động | Tình huống sử dụng |
|---|---|---|
| `--inspect=127.0.0.1:9229` | Mở WebSocket inspector trên loopback, **chạy app ngay** | Dev thông thường, attach DevTools sau khi app đã boot |
| `--inspect-brk=127.0.0.1:9229` | Mở inspector và **dừng ngay dòng đầu tiên** của user code | Debug lỗi lúc boot, top-level `import`/init, CLI chạy quá nhanh |
| `--inspect-wait=127.0.0.1:9229` | Mở inspector và **chờ debugger kết nối** mới chạy (không tự dừng dòng 1 nếu chưa đặt breakpoint) | Đảm bảo không bỏ lỡ event sớm / profiling từ thời điểm `t=0` mà không cần bấm Resume thủ công |
| `--inspect-port=0` | Chọn cổng trống ngẫu nhiên (kết hợp `SIGUSR1` hoặc đa process) | Tránh xung đột cổng khi chạy nhiều worker/cluster |
| `--disable-sigusr1` | **Vô hiệu hóa** việc tự động bật Inspector khi process nhận tín hiệu `SIGUSR1` | **Bắt buộc cân nhắc trên production** để tránh kẻ có quyền gửi signal cục bộ mở cổng debug ngoài ý muốn |

```sh
# ✅ ĐÚNG: chỉ bind loopback + bật source maps khi debug local
node --inspect=127.0.0.1:9229 --enable-source-maps dist/index.js

# ✅ ĐÚNG: dừng ở dòng đầu để debug quá trình bootstrap
node --inspect-brk=127.0.0.1:9229 --enable-source-maps dist/index.js

# ✅ ĐÚNG: production hardening — chặn kích hoạt inspector qua SIGUSR1
node --disable-sigusr1 --enable-source-maps dist/index.js

# ❌ SAI: mở inspector ra mọi interface — tương đương RCE (Remote Code Execution)
node --inspect=0.0.0.0:9229 dist/index.js
```

> **Cảnh báo bảo mật:** Quyền attach vào Inspector đồng nghĩa **toàn quyền thực thi JavaScript tùy ý** trong process Node (đọc `process.env`, file, memory, network). **Tuyệt đối không** bind `0.0.0.0` hay mở port `9229` qua Load Balancer / Security Group. Khi cần debug từ xa trên môi trường staging/canary, chỉ bind `127.0.0.1` rồi bắc cầu mã hóa:

```sh
# Cách 1: SSH local port forwarding (chỉ máy bạn thấy cổng 9229)
ssh -N -L 127.0.0.1:9229:127.0.0.1:9229 ops@staging-node-01

# Cách 2: Kubernetes port-forward tới đúng 1 pod đã cách ly khỏi traffic chính
kubectl -n prod-canary port-forward pod/api-canary-7f8d9 9229:9229
```

Sau khi mở tunnel, truy cập `chrome://inspect` trên Chrome/Edge hoặc gắn VS Code Debugger (`attach`). Tài liệu chính thức: [Node.js Inspector](https://nodejs.org/api/inspector.html).

### 2.2 Programmatic Inspector với `node:inspector/promises` (`Session`)

Thay vì phải restart process production với `--cpu-prof` hoặc mở cổng TCP `9229`, bạn có thể dùng `node:inspector/promises` tạo một **in-process `Session`** (không mở network port) để bật/tắt `Profiler` hoặc `HeapProfiler` động theo trigger nội bộ (admin endpoint có xác thực mạnh, feature flag, hoặc tín hiệu hệ thống).

```ts
import { Session } from "node:inspector/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

let profilingInFlight = false;

export async function captureDynamicCpuProfile(
  outputDir: string,
  durationMs: number,
  signal?: AbortSignal,
): Promise<string> {
  if (profilingInFlight) {
    throw new Error("A profiling session is already running");
  }
  profilingInFlight = true;

  const session = new Session();
  session.connect(); // Kết nối in-process, KHÔNG mở TCP port

  try {
    await session.post("Profiler.enable");
    await session.post("Profiler.setSamplingInterval", { interval: 1_000 }); // 1000 µs = 1ms
    await session.post("Profiler.start");

    await delay(durationMs, undefined, { signal });

    const { profile } = await session.post("Profiler.stop");
    await mkdir(outputDir, { recursive: true });
    const filePath = join(outputDir, `cpu-${Date.now()}.cpuprofile`);
    await writeFile(filePath, JSON.stringify(profile), { mode: 0o600 });
    return filePath;
  } finally {
    try {
      await session.post("Profiler.disable");
    } catch {
      // Ignore cleanup errors if session already closed
    }
    session.disconnect();
    profilingInFlight = false;
  }
}
```

Tương tự, có thể thu **allocation sampling profile** nhẹ qua `HeapProfiler.startSampling` / `HeapProfiler.stopSampling` (trả về `.heapprofile`), hoặc ghi **Heap Snapshot** dạng stream chunk qua sự kiện `HeapProfiler.addHeapSnapshotChunk` (lưu ý rủi ro stop-the-world & RAM ở §5.3).

> **Lưu ý trên Node 26:** Nếu mục tiêu chỉ là thu `.cpuprofile` hoặc `.heapprofile` trong code, Node 26 đã cung cấp API trực tiếp gọn và ít overhead hơn là `v8.startCpuProfile()` (§4.2) và `v8.startHeapProfile()` (§5.3). `node:inspector/promises` vẫn không thể thay thế khi bạn cần tính năng sâu của CDP như `Debugger.*`, `Runtime.*`, `Network.*` hoặc lọc/stream tùy biến.

### 2.3 Source Maps: `--enable-source-maps`, `process.setSourceMapsEnabled` & rủi ro `sourcesContent`

Khi chạy code TypeScript đã biên dịch (`tsc` / bundler), stack trace mặc định trỏ về dòng/cột của file `.js` trong `dist/`. Node hỗ trợ remap stack trace gốc mà không cần thư viện ngoài:

```sh
# Bật qua CLI (hoặc NODE_OPTIONS=--enable-source-maps)
node --enable-source-maps dist/index.js
```

```ts
import process from "node:process";

// Bật/tắt động theo môi trường (ví dụ chỉ bật khi debug hoặc cho service backend)
process.setSourceMapsEnabled(true);
```

| Tùy chọn `tsconfig.json` | Cách tạo map | Ưu điểm | Nhược điểm & rủi ro |
|---|---|---|---|
| `"sourceMap": true` | Tạo file `.js.map` riêng bên cạnh `.js` | Có thể giữ `.map` riêng cho Sentry/APM, không phình file JS | Phải đảm bảo `.js` và `.js.map` luôn **cùng 1 bản build** |
| `"inlineSourceMap": true` | Nhúng base64 vào cuối file `.js` | Chỉ có 1 file, không lo thất lạc `.map` | Tăng kích thước file, tốn thêm RAM parse lúc khởi động |
| `"inlineSources": false` | Không nhúng mã nguồn gốc vào trường `sourcesContent` | Tránh lộ mã nguồn thương mại nếu `.map` bị rò ra ngoài | DevTools/APM phải lấy source từ repo riêng khi xem snippet |

> **Cần nhớ về Source Maps & Error Context:**
> - `--enable-source-maps` **chỉ remap vị trí dòng/cột** khi đọc stack trace (và chỉ phát sinh chi phí đọc `.map` khi `error.stack` thực sự được truy cập); nó **không** sửa lỗi import path ở runtime và **không** khôi phục file `.ts` không có trong bản build.
> - Nếu chạy TypeScript trực tiếp bằng **Node 26 native type stripping** (`node src/index.ts`), Node giữ nguyên số dòng gốc bằng khoảng trắng nên thường không cần `.map` cho file `.ts` tự viết — xem [tsconfig.md](tsconfig.md#101-node-type-stripping).
> - Khi log lỗi, luôn giữ nguyên **`error.cause`** và **`error.code`**, log một lần ở boundary xử lý thay vì chỉ `console.error(err.message)` — xem [exceptions.md](exceptions.md).

---

## 3. `node:perf_hooks` & Đo Latency / Event Loop thực chiến

Module `node:perf_hooks` là nền tảng đo hiệu năng chi phí thấp nhất để chạy **liên tục trên production** (export ra Prometheus / OpenTelemetry Metrics).

### 3.1 `monitorEventLoopDelay`: đọc đơn vị đúng, ý nghĩa `exceeds` & vòng đời

`monitorEventLoopDelay` sử dụng HDR Histogram đo độ trễ giữa thời điểm event loop *đáng lẽ* quay lại kiểm tra timer và thời điểm *thực tế* quay lại.

```ts
import { monitorEventLoopDelay } from "node:perf_hooks";

const histogram = monitorEventLoopDelay({ resolution: 20 }); // lấy mẫu mỗi 20ms
histogram.enable();

const timer = setInterval(() => {
  const snapshot = {
    minMs: histogram.min / 1e6,
    meanMs: histogram.mean / 1e6,
    p50Ms: histogram.percentile(50) / 1e6,
    p95Ms: histogram.percentile(95) / 1e6,
    p99Ms: histogram.percentile(99) / 1e6,
    maxMs: histogram.max / 1e6,
    // ⚠️ exceeds: số mẫu vượt quá giới hạn `highest` của histogram (mặc định ~1 giờ),
    // KHÔNG PHẢI số lần vượt quá `resolution` (20ms)!
    exceeds: histogram.exceeds,
    count: histogram.count,
  };

  console.log(JSON.stringify({ event: "event_loop_delay", ...snapshot }));

  // Reset sau mỗi cửa sổ scrape để p99 phản ánh chu kỳ gần nhất, không bị tích lũy mãi
  histogram.reset();
}, 10_000);

// Không để timer giám sát giữ process treo lúc graceful shutdown
timer.unref();

export function stopEventLoopMonitor(): void {
  clearInterval(timer);
  histogram.disable(); // Dừng lấy mẫu & giải phóng timer nội bộ
}
```

> **3 bẫy kinh điển với `monitorEventLoopDelay`:**
> 1. **Nhầm đơn vị:** Giá trị trả về là **nanosecond (ns)**, không phải millisecond. Quên chia `1e6` khiến dashboard báo lag “25,000,000 ms”.
> 2. **Hiểu sai `exceeds`:** `histogram.exceeds` đếm số mẫu **vượt ngưỡng `highest` tối đa có thể biểu diễn của histogram** (mặc định lớn hơn ~1 giờ tính bằng ns), **KHÔNG phải** số lần lag vượt `resolution`. Nếu cần đếm số lần lag vượt ngưỡng SLA (vd `> 100ms`), hãy đọc `p99` / `max` mỗi chu kỳ hoặc tự đếm bucket.
> 3. **Quên `reset()` hoặc `disable()`:** Không gọi `reset()` làm `max` và `p99` bị "dính" sự cố cũ hàng giờ trước; quên `disable()` khi tắt worker/test làm rò tài nguyên nội bộ.

### 3.2 `eventLoopUtilization` (ELU) delta & đo `Worker`

`performance.eventLoopUtilization()` trả về `{ idle, active, utilization }` (đơn vị ms, `utilization` trong `[0, 1]`). Gọi không tham số chỉ cho giá trị **tích lũy từ lúc khởi động process** — hầu như vô dụng để phát hiện spike gần đây. Muốn đo theo cửa sổ thời gian (ví dụ mỗi 5–10 giây), **phải tính delta giữa 2 mốc**:

```ts
import { performance, type EventLoopUtilization } from "node:perf_hooks";

let prevElu: EventLoopUtilization = performance.eventLoopUtilization();

const interval = setInterval(() => {
  const currentElu = performance.eventLoopUtilization();
  // Delta trong khoảng [prevElu → currentElu]
  const delta = performance.eventLoopUtilization(currentElu, prevElu);
  prevElu = currentElu;

  console.log(
    JSON.stringify({
      event: "elu_window",
      utilization: Number(delta.utilization.toFixed(4)),
      activeMs: Number(delta.active.toFixed(1)),
      idleMs: Number(delta.idle.toFixed(1)),
    }),
  );
}, 5_000);
interval.unref();
```

> **Lưu ý thứ tự tham số:** `performance.eventLoopUtilization(utilization1, utilization2)` lấy `utilization1 - utilization2` (nếu truyền 1 tham số `eventLoopUtilization(prev)` thì tự lấy mốc hiện tại trừ `prev`). Truyền ngược `eventLoopUtilization(prev, current)` sẽ cho số âm vô nghĩa!

**Ma trận đọc kết hợp ELU × Event Loop Delay:**

| ELU (delta) | Event Loop Delay (p99) | Ý nghĩa thực tế | Hướng xử lý |
|---|---|---|---|
| **Thấp (< 0.4)** | **Thấp (< 20 ms)** | Main thread nhàn, hoạt động khỏe | Nếu request vẫn chậm → kiểm DB, HTTP upstream, libuv pool |
| **Thấp (< 0.4)** | **Cao (> 100 ms)** | Rảnh phần lớn thời gian nhưng thỉnh thoảng bị 1 cục block dài (sync I/O, JSON khổng lồ, Major GC) | Bật `--trace-sync-io`, `gc` observer, tìm request hiếm có payload lớn |
| **Cao (> 0.8)** | **Thấp (< 30 ms)** | Main thread làm việc liên tục nhưng các tick đều ngắn (tốt, gần chạm trần throughput) | Scale ngang (thêm replica / worker), tránh để traffic vượt ngưỡng bão hòa |
| **Cao (> 0.8)** | **Cao (> 100 ms)** | Main thread quá tải + block kéo dài — **nguy hiểm**, health check dễ fail dây chuyền | Chụp CPU profile (`v8.startCpuProfile`), giảm tải / shed load / offload sang `worker_threads` |

**Đo ELU của `Worker` từ main thread:** Mỗi `Worker` có event loop riêng nên `worker.performance.eventLoopUtilization()` cho phép theo dõi độ bão hòa của từng worker mà không cần gửi message IPC:

```ts
import { Worker } from "node:worker_threads";

const worker = new Worker(new URL("./compute-worker.js", import.meta.url));
let prevWorkerElu = worker.performance.eventLoopUtilization();

const timer = setInterval(() => {
  const delta = worker.performance.eventLoopUtilization(prevWorkerElu);
  prevWorkerElu = worker.performance.eventLoopUtilization();
  console.log("worker ELU:", delta.utilization.toFixed(3));
}, 5_000);
timer.unref();
```

### 3.3 `PerformanceObserver`, `timerify` & `createHistogram`

`PerformanceObserver` nhận sự kiện hiệu năng không đồng bộ cho nhiều `entryTypes`: `gc`, `http`, `http2`, `dns`, `net`, `measure`, `function` (qua `timerify`).

```ts
import {
  PerformanceObserver,
  constants,
  createHistogram,
  performance,
} from "node:perf_hooks";

// 1. Theo dõi GC pause (Minor / Major / Incremental)
const gcKindName = new Map<number, string>([
  [constants.NODE_PERFORMANCE_GC_MINOR, "minor_scavenge"],
  [constants.NODE_PERFORMANCE_GC_MAJOR, "major_mark_sweep_compact"],
  [constants.NODE_PERFORMANCE_GC_INCREMENTAL, "incremental"],
  [constants.NODE_PERFORMANCE_GC_WEAKCB, "weak_callbacks"],
]);

const gcHistogram = createHistogram({ lowest: 1, highest: 10_000_000_000, figures: 3 });

const gcObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    const detail = entry.detail as { kind?: number; flags?: number } | undefined;
    const kind = gcKindName.get(detail?.kind ?? -1) ?? "unknown";
    const durationNs = Math.max(1, Math.round(entry.duration * 1e6));
    gcHistogram.record(durationNs);

    if (entry.duration > 50) {
      console.warn(
        JSON.stringify({
          event: "gc_pause_slow",
          kind,
          durationMs: Number(entry.duration.toFixed(2)),
        }),
      );
    }
  }
});
gcObserver.observe({ entryTypes: ["gc"] });

// 2. Đo hàm với timerify + measure + http/dns
const rawParse = (input: string) => JSON.parse(input) as unknown;
const timedParse = performance.timerify(rawParse, { histogram: gcHistogram });

const opObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // entry.entryType có thể là "measure", "http", "dns", "function"
    if (entry.duration > 100) {
      console.log(
        JSON.stringify({
          event: "slow_perf_entry",
          type: entry.entryType,
          name: entry.name,
          durationMs: Number(entry.duration.toFixed(2)),
        }),
      );
    }
  }
});
opObserver.observe({ entryTypes: ["measure", "http", "dns", "function"] });

// Đo một đoạn nghiệp vụ bằng mark/measure (dọn mark để tránh rò bộ nhớ!)
performance.mark("order:start");
timedParse('{"ok":true}');
performance.measure("order:validate", "order:start");
performance.clearMarks("order:start");
performance.clearMeasures("order:validate");
```

> **Lưu ý rò bộ nhớ với `performance.mark()` / `measure()`:** Buffer global của `performance` lưu lại các mark/measure. Nếu gọi `performance.mark()` trên từng request HTTP mà quên `performance.clearMarks()`, RAM sẽ tăng dần! Trên hot path tần suất cao, hãy dùng `performance.now()` + `createHistogram()` (hoặc `diagnostics_channel` ở §7.3).

**Mẫu Rolling / Sliding-Window Histogram trên `createHistogram()`:** Khi cần phân vị p99 trượt theo thời gian (ví dụ cửa sổ 60 giây chia thành 6 bucket 10 giây) thay vì tích lũy toàn đời process, dùng mảng vòng `RecordableHistogram` và gộp bằng `.add()`:

```ts
import { createHistogram, type RecordableHistogram } from "node:perf_hooks";

export class SlidingWindowHistogram {
  readonly #buckets: RecordableHistogram[];
  #index = 0;

  constructor(bucketCount = 6) {
    this.#buckets = Array.from({ length: bucketCount }, () =>
      createHistogram({ lowest: 1, highest: 60_000_000_000, figures: 3 }),
    );
  }

  recordNs(valueNs: number): void {
    this.#buckets[this.#index].record(Math.max(1, Math.trunc(valueNs)));
  }

  rotate(): void {
    this.#index = (this.#index + 1) % this.#buckets.length;
    this.#buckets[this.#index].reset();
  }

  percentileMs(p: number): number {
    const merged = createHistogram({ lowest: 1, highest: 60_000_000_000, figures: 3 });
    for (const bucket of this.#buckets) {
      merged.add(bucket);
    }
    return merged.percentile(p) / 1e6;
  }
}
```

### 3.4 Đồng hồ monotonic: `performance.now()` / `process.hrtime.bigint()` vs `Date.now()`

```ts
import { performance } from "node:perf_hooks";
import process from "node:process";

// ❌ SAI: Date.now() là wall-clock — có thể nhảy lùi/tới khi NTP đồng bộ giờ
const badStart = Date.now();
// ... work ...
const badDurationMs = Date.now() - badStart; // Có thể ra số ÂM hoặc vọt +3000ms giả!

// ✅ ĐÚNG: monotonic clock cho duration (ms độ phân giải sub-millisecond)
const t0 = performance.now();
// ... work ...
const durationMs = performance.now() - t0;

// ✅ ĐÚNG: độ phân giải nanosecond (bigint) cho benchmark/histogram
const ns0 = process.hrtime.bigint();
// ... work ...
const durationNs = process.hrtime.bigint() - ns0;
```

Quy tắc đơn giản: **`Date.now()` / `new Date().toISOString()` chỉ dùng cho timestamp sự kiện (log, DB, header); mọi phép đo khoảng thời gian (`duration`, timeout, SLA) đều dùng `performance.now()` hoặc `process.hrtime.bigint()`.**

---

## 4. CPU Profiling, Flamegraphs & V8 Hot Paths (Node 26)

Khi ELU và Event Loop Delay cao (hoặc CPU pod chạm ngưỡng), bước tiếp theo là thu CPU profile để biết chính xác hàm nào đang đốt CPU.

### 4.1 CLI profiling: `--cpu-prof`, `--prof` + `--prof-process` & `--trace-sync-io`

```sh
# 1. V8 Sampling CPU Profiler — xuất file .cpuprofile (mở bằng Chrome DevTools / Speedscope)
# Node TỰ ĐỘNG tạo đệ quy thư mục cho --cpu-prof-dir (và --heap-prof-dir) nếu chưa tồn tại!
node --cpu-prof --cpu-prof-dir=./profiles --cpu-prof-interval=500 dist/index.js

# 2. V8 Tick Processor — bắt được CẢ khung C++, V8 builtins, libuv và native addons
node --prof dist/index.js
# Sau khi process kết thúc, xử lý file isolate-0x*.log:
node --prof-process isolate-0x*-v8.log > cpu-summary.txt

# 3. Bắt mọi lời gọi *Sync I/O xảy ra sau khi event loop đã chạy
node --trace-sync-io dist/index.js
```

| Công cụ | Cách hoạt động | Thấy được gì | Khi nào chọn |
|---|---|---|---|
| `--cpu-prof` | V8 sampling profiler (mặc định `--cpu-prof-interval=1000` µs) | Call tree JS chi tiết, tương thích Chrome DevTools & Speedscope | Mặc định cho 90% ca điều tra CPU JS, overhead thấp (~1–3%) |
| `--prof` + `--prof-process` | OS/V8 statistical tick log | Phân bổ % giữa **JavaScript, C++, GC, Shared libraries, Stubs** | Khi `--cpu-prof` thấy thời gian nằm ở `(program)` / native addon / zlib / crypto C++ |
| `--trace-sync-io` | In stack trace mỗi khi gọi sync I/O sau bootstrap | Chính xác file/dòng gọi `fs.readFileSync`, `zlib.gzipSync`… | Chạy ở staging / CI / load test để diệt toàn bộ sync I/O trên request path |

> **Lưu ý quan trọng về ghi file `--cpu-prof`:** File `.cpuprofile` chỉ được flush ra đĩa khi process **kết thúc có kiểm soát** (ví dụ `SIGINT` / `SIGTERM` sạch, không phải `SIGKILL`/`kill -9`). Hãy tái hiện workload đủ lâu (tối thiểu 15–30 giây sau warm-up) rồi gửi `SIGTERM` để lấy mẫu thống kê đủ tin cậy.

### 4.2 Programmatic CPU Profiling trên Node 26: `v8.startCpuProfile()` & `worker.startCpuProfile()`

Trên **Node.js 26**, bạn không còn bắt buộc phải khởi động lại process với `--cpu-prof` hay mở `inspector.Session` chỉ để lấy `.cpuprofile`. Module `node:v8` cung cấp `v8.startCpuProfile()` (trả về `SyncCPUProfileHandle` hỗ trợ cả `.stop()` lẫn `Symbol.dispose` cho `using`):

```ts
import v8 from "node:v8";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

export async function sampleMainThreadCpu(
  durationMs: number,
  outFile: string,
): Promise<void> {
  // Hỗ trợ tùy chọn samplingIntervalMicros và maxSamples
  const handle = v8.startCpuProfile({
    samplingIntervalMicros: 1_000,
  });

  try {
    await delay(durationMs);
    const cpuProfileJson = handle.stop(); // Trả về chuỗi JSON định dạng .cpuprofile
    await mkdir("./profiles", { recursive: true });
    await writeFile(outFile, cpuProfileJson, { mode: 0o600 });
  } finally {
    // Nếu throw trước khi stop(), Symbol.dispose đảm bảo dừng profiler an toàn
    handle[Symbol.dispose]();
  }
}
```

Với tác vụ chạy trong `worker_threads`, Node 26 hỗ trợ profile trực tiếp worker từ main thread qua **`worker.startCpuProfile()`** (và `worker.startHeapProfile()` cho heap) mà không cần sửa code bên trong worker:

```ts
import { Worker } from "node:worker_threads";
import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const worker = new Worker(new URL("./heavy-worker.js", import.meta.url));
const handle = await worker.startCpuProfile({ samplingIntervalMicros: 1_000 });
await delay(10_000);
const profileJson = await handle.stop();
await writeFile("./profiles/worker.cpuprofile", profileJson, { mode: 0o600 });
```

### 4.3 Đọc Flamegraph & nhận diện V8 Hot Paths

Mở file `.cpuprofile` trong **Chrome DevTools → Performance** hoặc **Speedscope** (chế độ *Left Heavy* để gom tổng thời gian theo call stack, và *Time Order* để xem phân bố theo thời gian thực).

- **Self Time (Exclusive Time):** Thời gian CPU tiêu tốn **trực tiếp bên trong thân hàm đó**, không tính hàm con nó gọi. Đây là nơi thực sự đốt CPU.
- **Total Time (Inclusive Time):** Thời gian của hàm đó **cộng toàn bộ hàm con** bên dưới. Dùng để lần theo đường gọi nghiệp vụ nào dẫn tới nút cổ chai.
- **Đỉnh phẳng rộng (Wide Plateau):** Thanh ngang rộng ở đỉnh flamegraph không có thanh con phía trên chính là điểm nóng cần tối ưu trước.

**4 mẫu V8 Hot Path thường gặp nhất trên Flamegraph:**

1. **JSON / Regex / Serialization blocking:** Thanh phẳng dài mang tên `JSON.parse`, `JSON.stringify`, `RegExp.exec` hoặc `Buffer.toString("utf8")` chiếm hàng chục ms liên tục trên 1 tick → **Giải pháp:** streaming parser, giới hạn body size, thay regex backtrack (ReDoS) bằng regex tuyến tính hoặc parser đơn giản, offload payload lớn sang `worker_threads`.
2. **GC Thrashing (`(garbage collector)` chiếm > 10–15% total time):** Code tạo quá nhiều object/string/closure ngắn hạn mỗi request làm Scavenge và Mark-Sweep chạy liên tục → **Giải pháp:** giảm clone object thừa, tái sử dụng `Buffer`/encoder, tránh nối chuỗi trong vòng lặp nóng, kiểm allocation profile bằng `--heap-prof`.
3. **Megamorphic Hidden Classes (Shapes) & Inline Caches (ICs):** V8 tối ưu truy cập thuộc tính (`obj.x`) dựa trên hình dạng object (Hidden Class / Map). Nếu một hàm nóng nhận object có thứ tự key khác nhau, thêm/xóa thuộc tính bằng `delete`, hoặc trộn lẫn kiểu dữ liệu ở cùng field, IC chuyển từ *monomorphic* → *polymorphic* → *megamorphic* (chậm đi nhiều lần).
4. **V8 Deoptimization (Deopt loop):** Hàm đã được TurboFan/Maglev tối ưu nhưng gặp kiểu dữ liệu bất ngờ (ví dụ `number` đột nhiên thành `undefined` hoặc `string`, hay đọc phần tử ngoài biên mảng) buộc V8 rơi về bytecode Ignition.

```ts
// ❌ SAI: tạo nhiều Hidden Class khác nhau + dùng `delete` phá shape
function makeRecordBad(id: number, extra?: string) {
  const rec: Record<string, unknown> = {};
  if (extra) rec.extra = extra; // thứ tự thuộc tính thay đổi!
  rec.id = id;
  if (!extra) delete rec.extra; // chuyển sang dictionary mode chậm
  return rec;
}

// ✅ ĐÚNG: luôn khởi tạo cùng tập thuộc tính theo đúng 1 thứ tự (monomorphic shape)
interface RecordShape {
  id: number;
  extra: string | undefined;
}

function makeRecordGood(id: number, extra?: string): RecordShape {
  return { id, extra };
}
```

---

## 5. Memory: V8 Heap Internals, RSS, Native Memory & Memory Leaks

Điều tra bộ nhớ trong Node.js đòi hỏi phân biệt rõ **V8 JS Heap** (do GC quản lý) với **bộ nhớ tiến trình tổng thể (RSS)** do hệ điều hành cấp phát.

### 5.1 Phân tách `process.memoryUsage()`, `v8.getHeapStatistics()`, Heap Spaces & `v8.GCProfiler`

```ts
import process from "node:process";
import v8 from "node:v8";

const mem = process.memoryUsage();
console.log({
  rssMB: (mem.rss / 1048576).toFixed(1),
  heapTotalMB: (mem.heapTotal / 1048576).toFixed(1),
  heapUsedMB: (mem.heapUsed / 1048576).toFixed(1),
  externalMB: (mem.external / 1048576).toFixed(1),
  // ⚠️ arrayBuffers ĐÃ NẰM TRONG external — KHÔNG CỘNG ĐÚP external + arrayBuffers!
  arrayBuffersMB: (mem.arrayBuffers / 1048576).toFixed(1),
});

const heapStats = v8.getHeapStatistics();
console.log({
  heapSizeLimitMB: (heapStats.heap_size_limit / 1048576).toFixed(1),
  totalAvailableMB: (heapStats.total_available_size / 1048576).toFixed(1),
  mallocedMB: (heapStats.malloced_memory / 1048576).toFixed(1),
});

// Xem chi tiết từng vùng Heap V8
for (const space of v8.getHeapSpaceStatistics()) {
  console.log(
    `${space.space_name.padEnd(22)} used=${(space.space_used_size / 1048576).toFixed(1)}MB / size=${(space.space_size / 1048576).toFixed(1)}MB`,
  );
}
```

| Metric / Heap Space | Bản chất | Ý nghĩa khi điều tra |
|---|---|---|
| `rss` (Resident Set Size) | Toàn bộ RAM vật lý process đang giữ trong OS | Gồm V8 heap + `external` + C++ addons + code segment + thread stacks + allocator cache; con số mà Linux OOM Killer nhìn vào |
| `heapTotal` / `heapUsed` | V8 heap đã xin OS / đang chứa object JS | Nếu `heapUsed` tăng không hạ sau Major GC → **JS memory leak** |
| `external` | Bộ nhớ C++ gắn với JS objects (bao gồm cả `arrayBuffers`) | Tăng mạnh khi giữ nhiều `Buffer`, `TypedArray`, addon C++ (Sharp, SQLite, TLS) |
| `arrayBuffers` | Backing stores của `ArrayBuffer`, `SharedArrayBuffer`, `Buffer` | **Là tập con của `external`** — tuyệt đối không cộng đúp vào tổng memory |
| `new_space` | Vùng object trẻ (Young Generation), thu gom bằng **Scavenge** (rất nhanh, vài ms) | Tỷ lệ sống sót cao ở đây sẽ đẩy object sang `old_space` |
| `old_space` | Object sống lâu (Old Generation), thu gom bằng **Mark-Sweep-Compact** (chậm hơn, có thể gây pause) | Leak JS thể hiện rõ nhất bằng `old_space` tăng đơn điệu |
| `large_object_space` | Object vượt ngưỡng kích thước lớn (cấp thẳng, không copy khi Scavenge) | Tăng bất thường khi giữ chuỗi JSON/mảng khổng lồ hoặc Buffer metadata lớn |

**Đo chi tiết từng đợt GC bằng `v8.GCProfiler`:**

```ts
import v8 from "node:v8";
import { setTimeout as delay } from "node:timers/promises";

const gcProfiler = new v8.GCProfiler();
gcProfiler.start();

await delay(30_000);

const result = gcProfiler.stop();
// result.statistics chứa từng đợt GC: gcType, cost (µs), beforeGC/afterGC theo từng heap space
const majorPauses = result.statistics.filter((s) => s.gcType === "Mark-Sweep-Compact");
console.log({
  totalGCs: result.statistics.length,
  majorCount: majorPauses.length,
  maxMajorMs: Math.max(0, ...majorPauses.map((s) => s.cost / 1_000)),
});
```

### 5.2 Container, cgroups & `--max-old-space-size`: vì sao bị OOMKilled trước khi GC chạy

Một sự cố cực kỳ phổ biến trên Kubernetes/Docker: container giới hạn **1 GiB RAM**, `heapUsed` mới khoảng 600 MiB nhưng pod đột ngột chết với **`OOMKilled` (exit code 137)** và không có lỗi `FATAL ERROR: Reached heap limit`.

**3 nguyên nhân gốc rễ:**
1. **V8 heap chỉ là một phần của RSS:** Ngoài V8 Old Space, process còn tiêu thụ RAM cho New Space, Code Space, `external`/`Buffer` (không tính đầy đủ vào ngưỡng `max-old-space-size`), thư viện native (OpenSSL, zlib, `sharp`, driver C++), stack của `UV_THREADPOOL_SIZE` + `worker_threads` (mỗi `Worker` có V8 isolate & heap riêng!) và glibc malloc fragmentation.
2. **GC là cơ chế lười (lazy):** V8 trì hoãn Major GC cho tới khi `heapUsed` tiến gần `heap_size_limit`. Nếu `heap_size_limit` đặt sát giới hạn container (ví dụ 900 MiB trong container 1024 MiB), tổng `V8 heap + Buffers + native + headroom` sẽ vượt 1024 MiB và bị Linux OOM Killer giết **trước khi V8 kịp chạy Mark-Sweep-Compact**.
3. **Headroom cho bản thân quá trình GC & Snapshot:** Khi đánh dấu/compact hoặc serialize response lớn, RAM có thể nhô đỉnh tạm thời thêm 20–30%.

**Công thức thực dụng cho container:**
- Với service JS thuần (ít Buffer lớn, không dùng nhiều `Worker`): đặt `--max-old-space-size` khoảng **65–75%** cgroup memory limit (ví dụ container 1024 MiB → `--max-old-space-size=700`).
- Với service xử lý ảnh/stream/Buffer lớn hoặc nhiều `Worker`: hạ xuống **50–60%** cgroup limit và theo dõi sát `rss` vs `external` + `heapUsed`.
- Kiểm tra nhanh trần heap thực tế mà Node đang nhận trong container:

```sh
node -e 'console.log(Math.round(require("node:v8").getHeapStatistics().heap_size_limit / 1048576), "MB")'
```

### 5.3 Chụp Heap Profile & Heap Snapshot an toàn trên Production

Phân biệt rõ **Heap Profile** (nhẹ, lấy mẫu allocation theo thời gian — an toàn hơn cho production) và **Heap Snapshot** (nặng, chụp toàn bộ đồ thị object đang sống — rủi ro cao):

| Kỹ thuật | Chi phí & rủi ro | Hỗ trợ OS | Khi nào dùng |
|---|---|---|---|
| `--heap-prof` / `v8.startHeapProfile()` | Thấp (sampling), **không stop-the-world kéo dài**, xuất `.heapprofile` | Linux, macOS, Windows | **Bước 1 trên production**: tìm hàm nào đang cấp phát nhiều bộ nhớ nhất không được giải phóng |
| `--heapsnapshot-signal=SIGUSR2` | Cao (stop-the-world + tốn ~2× heap RAM khi chụp) | **Chỉ POSIX** (Linux/macOS) | Chụp thủ công trên pod canary đã rút khỏi load balancer |
| `--heapsnapshot-near-heap-limit=3` / `v8.setHeapSnapshotNearHeapLimit(3)` | Tự chụp ngay trước khi OOM V8 (tối đa N file) | **Cross-platform (kể cả Windows!)** | Bắt hiện trường OOM khó tái hiện ở local; cần ổ đĩa đủ trống & cô lập quyền file |
| `v8.writeHeapSnapshot()` | Stop-the-world + **gấp đôi RAM tạm thời** + chặn toàn bộ request | Cross-platform | Điều tra cục bộ hoặc replica cách ly; tuyệt đối không gọi tự do trên pod đang phục vụ traffic chính |

```sh
# 1. Sampling Heap Profile (Node tự tạo đệ quy thư mục --heap-prof-dir)
node --heap-prof --heap-prof-dir=./profiles dist/index.js

# 2. Tự động chụp tối đa 3 snapshot khi V8 sắp chạm trần heap (hoạt động cả Windows & Linux)
node --max-old-space-size=512 --heapsnapshot-near-heap-limit=3 --diagnostic-dir=./dumps dist/index.js

# 3. Kích hoạt snapshot bằng tín hiệu trên Linux/macOS
node --heapsnapshot-signal=SIGUSR2 dist/index.js
# Ở terminal khác (sau khi đã rút pod khỏi traffic): kill -USR2 <PID>
```

**Programmatic Heap Sampling trên Node 26 (`v8.startHeapProfile()`):**

```ts
import v8 from "node:v8";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

export async function sampleHeapAllocations(
  durationMs: number,
  outFile: string,
): Promise<void> {
  // Lấy mẫu nhẹ, an toàn hơn nhiều so với writeHeapSnapshot()
  const handle = v8.startHeapProfile({
    sampleInterval: 512 * 1024, // trung bình mỗi 512 KiB cấp phát
    stackDepth: 32,
  });

  try {
    await delay(durationMs);
    const heapProfileJson = handle.stop(); // chuỗi JSON định dạng .heapprofile
    await mkdir("./profiles", { recursive: true });
    await writeFile(outFile, heapProfileJson, { mode: 0o600 });
  } finally {
    handle[Symbol.dispose]();
  }
}

// Hoặc cấu hình tự chụp khi gần chạm giới hạn heap (cross-platform)
v8.setHeapSnapshotNearHeapLimit(2);
```

> **Cảnh báo bảo mật & vận hành với Heap Snapshot:**
> - Một file `.heapsnapshot` chứa **toàn bộ chuỗi và object trong RAM**: JWT, API key, cookie, PII khách hàng, mật khẩu trong bộ nhớ. Phải lưu với quyền `0o600`, mã hóa khi tải về và **xóa ngay** sau khi phân tích xong.
> - Chụp snapshot trên pod đang dùng 70% RAM có thể **kích hoạt OOMKill ngay lập tức**. Luôn rút pod khỏi Load Balancer (hoặc dùng pod canary có RAM dư gấp 2.5–3×) trước khi gọi `v8.writeHeapSnapshot()`.

### 5.4 Kỹ thuật 3-Snapshot (Three-Snapshot Technique)

Đọc một Heap Snapshot duy nhất rất dễ nhầm cache hợp lệ hay dữ liệu bootstrap là leak. Hãy dùng **kỹ thuật 3-Snapshot** (được khuyến nghị bởi nhóm V8/DevTools):

```
Khởi động app ──► Warm-up (JIT, cache nền, pools)
                       │
                       ▼
                 [Snapshot 1]  ◄── Mốc nền sạch sau warm-up
                       │
              Chạy workload lặp N lần (vd 500 request nghi vấn)
                       │
                       ▼
                 [Snapshot 2]  ◄── Có cả object leak lẫn rác chưa GC
                       │
              Chạy lại ĐÚNG workload đó thêm N lần
                       │
                       ▼
                 [Snapshot 3]  ◄── Object leak từ bước 1→2 VẪN còn sống ở đây!
```

**Cách phân tích trong Chrome DevTools → Memory:**
1. Tải cả 3 file `.heapsnapshot` vào DevTools.
2. Chọn **Snapshot 3**, đổi chế độ hiển thị từ *Summary* sang **Objects allocated between Snapshot 1 and Snapshot 2**.
3. Bộ lọc này tự động loại bỏ toàn bộ dữ liệu bootstrap (có trước Snapshot 1) và rác tạm của lượt gần nhất (tạo sau Snapshot 2) — phần còn lại chính là các object **được tạo ở lượt 1 nhưng vẫn bị giữ lại sau lượt 2**.
4. Sắp xếp theo **Retained Size** (không chỉ Shallow Size — xem phân biệt bên dưới), bấm vào constructor tăng bất thường rồi đọc panel **Retainers** (Distance nhỏ nhất tới `GC roots`) để tìm đúng biến/closure/Map/listener đang níu giữ object.

- **Shallow Size:** Bộ nhớ trực tiếp của riêng object đó (thường rất nhỏ, vài chục byte).
- **Retained Size:** Tổng bộ nhớ sẽ được giải phóng **nếu object đó bị cắt đứt khỏi GC root** (ví dụ 1 object `Map` có Shallow Size 64 bytes nhưng Retained Size 450 MiB).

### 5.5 6 mẫu Memory Leak kinh điển trong Node.js

**Mẫu 1: Unbounded `Map` / `Set` / Cache thiếu eviction**

```ts
// ❌ SAI: tăng vô hạn theo số userId/token duy nhất → OOM sau vài ngày
const userCache = new Map<string, { profile: unknown; fetchedAt: number }>();
export function cacheUser(id: string, profile: unknown): void {
  userCache.set(id, { profile, fetchedAt: Date.now() });
}

// ✅ ĐÚNG: giới hạn maxSize (LRU đơn giản tận dụng thứ tự chèn của Map) + TTL
export class BoundedCache<K, V> {
  readonly #store = new Map<K, { value: V; expiresAt: number }>();
  readonly #maxSize: number;
  readonly #ttlMs: number;

  constructor(maxSize: number, ttlMs: number) {
    this.#maxSize = maxSize;
    this.#ttlMs = ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.#store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.#store.delete(key);
      return undefined;
    }
    // Refresh thứ tự LRU
    this.#store.delete(key);
    this.#store.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.#store.has(key)) this.#store.delete(key);
    else if (this.#store.size >= this.#maxSize) {
      const oldestKey = this.#store.keys().next().value;
      if (oldestKey !== undefined) this.#store.delete(oldestKey);
    }
    this.#store.set(key, { value, expiresAt: Date.now() + this.#ttlMs });
  }
}
```

**Mẫu 2: Buffer 8 KiB slab retention (`subarray` giữ nguyên slab!)**

Node.js dùng một pool slab kích thước mặc định **`Buffer.poolSize` (8 KiB)** để cấp phát nhanh các `Buffer` nhỏ (<= 4 KiB) qua `Buffer.allocUnsafe` hoặc đọc socket/stream. Khi bạn cắt vài byte bằng `.subarray()` rồi lưu lâu dài (vào cache, index), **cả khối `ArrayBuffer` 8 KiB gốc bị giữ sống** dù bạn chỉ cần 16 byte!

```ts
// ❌ SAI: mỗi slice 16 byte giữ nguyên backing ArrayBuffer 8 KiB (gấp 512 lần kích thước thật!)
const retainedKeys: Buffer[] = [];
export function extractKeyBad(chunk: Buffer): void {
  // chunk.buffer.byteLength thường là 8192 (hoặc lớn hơn nếu là chunk socket 64 KiB!)
  const header = chunk.subarray(0, 16);
  retainedKeys.push(header);
}

// ✅ ĐÚNG: copy sang bộ nhớ riêng kích thước đúng 16 byte trước khi lưu dài hạn
export function extractKeyGood(chunk: Buffer): void {
  // Buffer.from(subarray) hoặc Uint8Array.prototype.slice() cấp phát backing store độc lập
  const headerCopy = Uint8Array.prototype.slice.call(chunk, 0, 16);
  retainedKeys.push(Buffer.from(headerCopy.buffer, headerCopy.byteOffset, headerCopy.byteLength));
}
```

> **Mẹo kiểm nhanh:** Nếu `buf.buffer.byteLength > buf.byteLength * 2` mà bạn định giữ `buf` lâu hơn vòng đời request, hãy copy nó ra backing store độc lập!

**Mẫu 3: Closure giữ nguyên `req` / payload / Buffer lớn**

Trong V8, các closure lồng nhau trong cùng một scope **dùng chung một `Context` object**. Chỉ cần một hàm sống lâu (timer, cache callback, event listener) ở cùng scope với biến `rawBody` 10 MiB, biến đó có thể bị giữ sống dù closure không trực tiếp đọc nó.

```ts
// ❌ SAI: lưu callback nằm trong scope có `hugePayload`
const auditHooks: Array<() => string> = [];
export function registerRequestBad(reqId: string, hugePayload: Buffer): void {
  const byteLen = hugePayload.byteLength;
  // Closure này hoặc closure anh em tham chiếu tới hugePayload giữ sống toàn bộ Buffer
  auditHooks.push(() => `${reqId}:${byteLen}:${hugePayload[0]}`);
}

// ✅ ĐÚNG: trích xuất giá trị nhỏ (primitive/DTO) ở hàm tách biệt, cắt đứt tham chiếu Buffer
function createAuditSummary(reqId: string, byteLen: number, firstByte: number): () => string {
  return () => `${reqId}:${byteLen}:${firstByte}`;
}

export function registerRequestGood(reqId: string, hugePayload: Buffer): void {
  auditHooks.push(createAuditSummary(reqId, hugePayload.byteLength, hugePayload[0] ?? 0));
}
```

**Mẫu 4: `EventEmitter` / `AbortSignal` listener leak**

Gắn listener lên một emitter sống lâu (singleton bus, `process`, shared `AbortSignal`, database pool) mỗi request mà không gỡ bỏ sẽ giữ sống cả listener lẫn closure của từng request.

```ts
import { EventEmitter } from "node:events";

const configBus = new EventEmitter();

// ❌ SAI: mỗi request đăng ký thêm 1 listener vĩnh viễn → MaxListenersExceededWarning + leak
export function handleRequestBad(res: { end(s: string): void }): void {
  configBus.on("reload", () => {
    res.end("reloaded");
  });
}

// ✅ ĐÚNG: dùng `{ signal }` hoặc dọn tường minh trong `finally` / `close`
export function handleRequestGood(
  res: { end(s: string): void },
  requestSignal: AbortSignal,
): void {
  const onReload = () => res.end("reloaded");
  configBus.on("reload", onReload);
  requestSignal.addEventListener("abort", () => configBus.off("reload", onReload), {
    once: true,
  });
}
```

> **Cảnh giác với `MaxListenersExceededWarning`:** Đây là **tín hiệu cảnh báo leak**, không phải giới hạn cứng. **Không** gọi `emitter.setMaxListeners(0)` để bịt miệng warning trước khi kiểm tra chắc chắn vòng đời `off()`/`removeEventListener()`.

**Mẫu 5: Detached timers / `setInterval` chưa dọn**

```ts
// ❌ SAI: tạo setInterval theo mỗi session/client nhưng không clear khi client đóng
export function startHeartbeatBad(client: { ping(): void; largeState: Buffer }): void {
  setInterval(() => client.ping(), 10_000); // Giữ sống `client` + `largeState` mãi mãi!
}

// ✅ ĐÚNG: gắn vòng đời timer vào AbortSignal / close event và unref nếu là background task
export function startHeartbeatGood(
  client: { ping(): void },
  signal: AbortSignal,
): void {
  const timer = setInterval(() => client.ping(), 10_000);
  timer.unref();
  signal.addEventListener("abort", () => clearInterval(timer), { once: true });
}
```

**Mẫu 6: Promise chain đệ quy vô hạn tích tụ**

Một số pattern polling hoặc queue viết bằng đệ quy `return work().then(() => loop())` nếu không cắt chuỗi (hoặc giữ reference tới outer Promise chưa settle) sẽ làm đồ thị Promise trong V8 phình to mãi theo thời gian.

```ts
import { setTimeout as delay } from "node:timers/promises";

// ❌ SAI: chuỗi Promise trả về lồng nhau không bao giờ settle cho tới khi vòng lặp dừng
async function pollBad(signal: AbortSignal, work: () => Promise<void>): Promise<void> {
  if (signal.aborted) return;
  await work();
  await delay(1_000, undefined, { signal });
  return pollBad(signal, work); // Tích tụ chain/async frame nếu chạy nhiều ngày
}

// ✅ ĐÚNG: dùng vòng lặp `while` phẳng — mỗi vòng giải phóng sạch frame cũ
async function pollGood(signal: AbortSignal, work: () => Promise<void>): Promise<void> {
  while (!signal.aborted) {
    await work();
    await delay(1_000, undefined, { signal });
  }
}
```

> **Lưu ý về `WeakRef` & `FinalizationRegistry`:** Chúng **không** thay thế cho eviction policy (LRU/TTL) hay việc đóng tài nguyên tường minh (`close()`/`using`). Thời điểm GC chạy là không tất định.

---

## 6. Diagnostic Reports, Active Resources & Trace Flags (Node 26)

Khi tiến trình treo lúc shutdown, crash bất thường hoặc xuất hiện cảnh báo mơ hồ, Node 26 cung cấp bộ công cụ nội sinh không cần cài thêm package.

### 6.1 `process.getActiveResourcesInfo()` debug CLI/server treo không thoát

Một script CLI hay bài test chạy xong logic nhưng terminal vẫn đứng im không trả prompt — nguyên nhân gần như luôn là **một resource vẫn đang `ref`** giữ event loop sống (timer chưa clear, HTTP keep-alive socket, DB connection pool, `MessagePort`, `Worker`).

```ts
import process from "node:process";

// In danh sách CÁC LOẠI resource đang giữ event loop sống (API ổn định, chính thức)
console.log("Active resources:", process.getActiveResourcesInfo());
// Ví dụ output: [ 'TTYWrap', 'Timeout', 'TCPSocketWrap', 'Worker' ]
```

- **Ưu điểm so với `process._getActiveHandles()`:** `getActiveResourcesInfo()` là API công khai ổn định; `_getActiveHandles()` là API private nội bộ có thể thay đổi bất cứ lúc nào và không nên dùng làm hợp đồng trong code production.
- **Giới hạn cần biết:** `getActiveResourcesInfo()` chỉ trả **mảng tên loại resource** (`"Timeout"`, `"TCPSocketWrap"`, `"FSReqCallback"`…), **không** trả stack trace nơi tạo ra nó.
- **Cách khoanh vùng chủ sở hữu:**
  1. Thấy `"Timeout"` → kiểm tra `setInterval`/`setTimeout` quên `clearInterval` hoặc chưa `.unref()`.
  2. Thấy `"TCPSocketWrap"` / `"TCPServerWrap"` → kiểm tra HTTP server chưa gọi `server.closeAllConnections()`, Undici `Agent`/`Pool` chưa `.close()`, hoặc DB/Redis client chưa `.end()`.
  3. Thấy `"Worker"` / `"MessagePort"` → gọi `await worker.terminate()` hoặc `port.close()` / `.unref()`.
  4. Khi cần biết *chính xác dòng code* mở resource trong môi trường dev/test, dùng `why-is-node-running` hoặc `async_hooks` tạm thời ở local (không bật `async_hooks` trên production).

### 6.2 Diagnostic Reports: CLI flags, `process.report.writeReport()` & bảo mật

Diagnostic Report xuất ra một file JSON tóm tắt toàn diện trạng thái process (JS stack, native C++ stack, V8 heap, libuv handles, OS/CPU/RAM, shared libraries) với kích thước chỉ vài trăm KiB — nhẹ hơn Heap Snapshot hàng nghìn lần.

```sh
# Cấu hình production chuẩn: tự sinh report khi crash/uncaught, LOẠI BỎ env & network bí mật
node \
  --report-on-fatalerror \
  --report-uncaught-exception \
  --report-on-signal \
  --report-signal=SIGUSR2 \
  --report-exclude-env \
  --report-exclude-network \
  --report-compact \
  --diagnostic-dir=./reports \
  dist/index.js
```

| Cờ CLI / Thuộc tính `process.report` | Tác dụng | Lưu ý vận hành |
|---|---|---|
| `--report-on-fatalerror` (`reportOnFatalError`) | Tự ghi report khi V8 gặp lỗi nghiêm trọng (OOM V8, lỗi nội bộ) | Nên bật sẵn trên production |
| `--report-uncaught-exception` (`reportOnUncaughtException`) | Tự ghi report khi có exception không được bắt | Kết hợp crash-and-restart |
| `--report-on-signal` (`reportOnSignal`) + `--report-signal` | Ghi report theo yêu cầu khi nhận signal (POSIX, mặc định `SIGUSR2`) | Chú ý không đụng signal với `--heapsnapshot-signal` |
| `--report-exclude-env` (`excludeEnv`) | **Loại bỏ toàn bộ `process.env`** khỏi JSON report | **Bắt buộc bật** để không rò API key, DB password, tokens |
| `--report-exclude-network` (`excludeNetwork`) | Loại bỏ thông tin network interfaces | Giảm lộ hạ tầng nội bộ khi gửi report ra ngoài |
| `--report-compact` (`compact`) | Xuất JSON 1 dòng gọn | Thuận tiện đưa vào hệ thống log aggregator |
| `--diagnostic-dir` (`directory`) | Thư mục lưu report và các artifact chẩn đoán | Phải tồn tại sẵn khi gọi `writeReport()`! |

> **Khác biệt quan trọng về tạo thư mục (`ENOENT`):**
> - Với **`--cpu-prof-dir`** và **`--heap-prof-dir`**, Node **tự động tạo đệ quy thư mục** nếu chưa tồn tại.
> - Ngược lại, **`process.report.writeReport("./reports/incident.json")`** sẽ **ném lỗi `ENOENT`** nếu thư mục `./reports` chưa được tạo trước! Đồng thời, luôn đặt **`process.report.excludeEnv = true`** (và `excludeNetwork = true` nếu cần) **trước** khi gọi `writeReport()`.

```ts
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import process from "node:process";

export function writeSafeDiagnosticReport(filePath: string): string {
  // 1. Bắt buộc tắt env (và network nếu cần) TRƯỚC khi xuất report để tránh rò secrets
  process.report.excludeEnv = true;
  process.report.excludeNetwork = true;
  process.report.compact = false;

  // 2. Bắt buộc đảm bảo thư mục tồn tại trước — writeReport() ném ENOENT nếu thiếu!
  mkdirSync(dirname(filePath), { recursive: true });

  // 3. Ghi report và trả về đường dẫn file thực tế đã tạo
  return process.report.writeReport(filePath);
}
```

Không bao giờ gọi `writeReport()` trong vòng lặp mỗi request; chỉ gọi khi có sự cố hiếm, circuit-breaker mở hoặc trigger điều tra có rate limit. Tài liệu chính thức: [Diagnostic Report](https://nodejs.org/api/report.html).

### 6.3 Cách đọc JSON Diagnostic Report khi điều tra sự cố

Khi mở file report (`report.*.json`), đi thẳng vào 6 trường giá trị nhất theo thứ tự:

| Mục trong JSON | Chứa thông tin gì | Câu hỏi nó trả lời |
|---|---|---|
| `header` | `event`, `trigger`, `nodejsVersion`, `osName`, `cpus`, `commandLine`, `cwd` | Process chết vì lý do gì (`FatalError`, `JavaScriptError`, `Signal`), chạy cờ CLI nào, mấy core CPU? |
| `javascriptStack` | `message` + mảng `stack` khung JS tại thời điểm chụp | Lỗi JS nào đang thực thi khi chụp hoặc crash? |
| `nativeStack` | Backtrace C++ (V8, libuv, OpenSSL, native addon) | Crash có nằm trong C++ addon (`sharp`, `bcrypt`, `better-sqlite3`…) hay V8 GC không? |
| `javascriptHeap` | `totalMemory`, `usedMemory`, `availableMemory`, `heapSpaces` | Process có đang sát trần heap hoặc kẹt ở `old_space` / `large_object_space`? |
| `libuv` | Danh sách toàn bộ handle đang mở (`tcp`, `timer`, `udp`, `fs_event`, `signal`) kèm `is_active`, `has_ref`, địa chỉ IP:port | Handle nào đang `has_ref: true` làm server treo? Có hàng nghìn TCP socket `ESTABLISHED`/`CLOSE_WAIT` rò rỉ không? |
| `resourceUsage` | `userCpuSeconds`, `kernelCpuSeconds`, `maxRss`, `fsActivity` | Tỷ lệ user vs kernel CPU, đỉnh RSS lịch sử (`maxRss`), áp lực disk I/O? |
| `sharedObjects` | Danh sách `.so` / `.dll` / `.dylib` và `.node` addon đã nạp | Có xung đột phiên bản thư viện native / `glibc` / `musl` không? |

### 6.4 Bảng tổng hợp Trace Flags trên Node 26

| Cờ CLI | Tác dụng | Môi trường khuyên dùng |
|---|---|---|
| `--trace-warnings` | In full stack trace cho mọi `process` warning (kể cả `MaxListenersExceededWarning`, `ExperimentalWarning`) | Dev, CI, Staging |
| `--trace-deprecation` | In stack trace mỗi khi code (hoặc dependency) dùng API deprecated | CI, nâng cấp Node LTS (vd 22/24 → 26) |
| `--throw-deprecation` | Biến cảnh báo deprecation thành exception làm fail ngay | CI nghiêm ngặt khi dọn nợ kỹ thuật |
| `--trace-sync-io` | Cảnh báo + stack trace cho mọi lệnh sync I/O sau khi event loop bắt đầu | Staging, load test, CI server |
| `--trace-uncaught` | In stack trace tại nơi exception được `throw` (đặc biệt hữu ích với async/rethrow khó lần) | Staging, debug lỗi crash khó truy vết |
| `--trace-promises` | Theo dõi vòng đời tạo/reject Promise khi điều tra unhandled rejection phức tạp | Local / Staging (có overhead) |
| `--trace-exit` | In stack trace mỗi khi code gọi `process.exit()` (bắt thủ phạm gọi `process.exit` lén trong thư viện!) | Dev, Staging, điều tra shutdown đột ngột |
| `--trace-env` | Ghi log mỗi khi code đọc biến môi trường từ `process.env` (hỗ trợ kiểm soát phụ thuộc config) | Audit cấu hình / bảo mật |
| `--trace-event-categories` | Bật tracing event mức thấp (`node.async_hooks`, `v8`, `node.fs.sync`, `node.http`, `node.dns.native`…) xuất file Chrome Tracing | Phân tích timeline sâu ở local/canary |

---

## 7. Structured Logging, `AsyncLocalStorage`, `diagnostics_channel` & OpenTelemetry

Observability hiện đại dựa trên 3 trụ cột liên kết bằng **Trace ID / Request ID**: **Logs** (sự kiện rời rạc), **Metrics** (số liệu tổng hợp theo thời gian) và **Traces** (hành trình xuyên dịch vụ).

### 7.1 Structured Logging chuẩn Production & chống High-Cardinality

Log production phải là **JSON một dòng (NDJSON)** ra `stdout`/`stderr` (để container runtime thu thập), dùng logger bất đồng bộ hiệu năng cao (như `pino`) thay vì `console.log` đồng bộ nặng formatting.

```json
{
  "timestamp": "2026-11-21T13:25:10.412Z",
  "level": "error",
  "service": "orders-api",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "requestId": "req_01JDB8X4K2",
  "method": "POST",
  "route": "/orders/:id/cancel",
  "statusCode": 502,
  "durationMs": 312.4,
  "err": {
    "code": "ERR_UPSTREAM_TIMEOUT",
    "message": "Payment gateway timed out",
    "causeCode": "UND_ERR_HEADERS_TIMEOUT"
  }
}
```

**4 kỷ luật bắt buộc cho Logging & Metrics:**
1. **Chống High-Cardinality trên Metrics:** Nhãn (label/attribute) của metric **chỉ được dùng tập giá trị hữu hạn** — dùng route template `/users/:id` thay vì URL đầy đủ `/users/9823412?token=abc`. Tuyệt đối không đặt `userId`, `requestId`, `email`, hay `error.message` tự do làm label Prometheus/OTel Metric (làm nổ RAM hệ thống monitoring).
2. **Redaction bí mật tự động:** Cấu hình danh sách đường dẫn cần che (`authorization`, `cookie`, `*.password`, `*.token`, `*.secret`, `req.headers.x-api-key`) ngay tại tầng logger.
3. **Log một lần ở biên xử lý (boundary):** Không `logger.error(err)` ở mọi hàm trung gian rồi lại `throw err` (gây 5 dòng log trùng cho 1 lỗi). Gắn ngữ cảnh bằng `new Error("...", { cause: err })` và log 1 lần ở middleware/consumer biên.
4. **Không `JSON.stringify` toàn bộ `req`/`res` hay payload MB:** Chỉ trích các trường được duyệt trước (allowlist).

### 7.2 `AsyncLocalStorage` với V8 `AsyncContextFrame` trên Node 26

Từ Node 24 trở đi và mặc định trên **Node 26**, `AsyncLocalStorage` được hậu thuẫn bởi cơ chế **`AsyncContextFrame` trực tiếp trong V8** thay vì `async_hooks` JavaScript cũ — giảm mạnh overhead trên hot path `async`/`await` (chỉ còn dự phòng cờ `--no-async-context-frame` cho trường hợp hiếm gặp thư viện cũ phụ thuộc hành vi nội bộ cũ).

```ts
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  traceId: string;
  route: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

// ✅ ĐÚNG: luôn dùng run() để tạo scope đóng mở rõ ràng
export function withRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContext.run(ctx, fn);
}

// ✅ ĐÚNG: chụp ngữ cảnh hiện tại khi đẩy callback vào queue/pool tùy chỉnh
export function schedulePreservingContext(queue: Array<() => void>, task: () => void): void {
  const runInCapturedContext = AsyncLocalStorage.snapshot();
  queue.push(() => runInCapturedContext(task));
}

// ✅ ĐÚNG: thoát tạm khỏi store khi chạy tác vụ nền không thuộc request hiện tại
export function fireBackgroundMetric(fn: () => void): void {
  requestContext.exit(() => {
    setImmediate(fn);
  });
}
```

> **Những điều `AsyncLocalStorage` KHÔNG làm (và bẫy `enterWith`):**
> - **Tránh `als.enterWith(store)`:** Nó thay đổi store cho toàn bộ phần còn lại của ngữ cảnh thực thi hiện tại mà không tự khôi phục khi thoát hàm — rất dễ làm **rò `requestId` của user A sang request của user B** (nhất là trong middleware hoặc error handler). Luôn dùng `als.run(store, fn)`.
> - **Không vượt ranh giới thread / process / network:** ALS **không** tự truyền sang `worker_threads`, `child_process`, hay qua HTTP/message queue. Phải truyền tường minh qua `workerData`/message hoặc header W3C `traceparent` (xem §7.4 & [abort-context.md](abort-context.md#7-asynclocalstorage)).

### 7.3 `node:diagnostics_channel`: `channel`, `tracingChannel`, `bindStore` & `boundedChannel` (Node 26.1+)

`node:diagnostics_channel` là trục pub/sub chi phí gần bằng 0 (khi không có subscriber) giúp thư viện, framework và Node core phát sự kiện chẩn đoán cho logger, metrics và APM/OpenTelemetry mà không cần monkey-patch hàm runtime.

**1. `channel()` cơ bản + kiểm `hasSubscribers`**

```ts
import dc from "node:diagnostics_channel";

const cacheChannel = dc.channel("app:cache:miss");

export function recordCacheMiss(keyPrefix: string, shard: number): void {
  // ✅ Luôn kiểm tra hasSubscribers trước khi tạo object payload tốn chi phí
  if (cacheChannel.hasSubscribers) {
    cacheChannel.publish({ keyPrefix, shard, at: Date.now() });
  }
}

// Subscriber (chạy ĐỒNG BỘ trong luồng publish — tuyệt đối không làm việc nặng hay throw!)
cacheChannel.subscribe((message) => {
  const { keyPrefix, shard } = message as { keyPrefix: string; shard: number };
  // Cập nhật counter metric nhẹ
  void keyPrefix;
  void shard;
});
```

**2. `tracingChannel()` cho vòng đời Sync / Promise / Callback + `bindStore()`**

`tracingChannel(name)` tạo sẵn 5 kênh con (`start`, `end`, `asyncStart`, `asyncEnd`, `error`) và cung cấp `traceSync`, `tracePromise`, `traceCallback` để đo toàn bộ vòng đời một tác vụ (kể cả khi Promise hoàn tất bất đồng bộ hoặc ném lỗi):

```ts
import dc from "node:diagnostics_channel";
import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";

interface DbTraceContext {
  operation: string;
  table: string;
  startTime?: number;
  result?: unknown;
  error?: unknown;
}

const dbChannel = dc.tracingChannel<object, DbTraceContext>("app:db");
const activeDbOp = new AsyncLocalStorage<string>();

// Tự động gắn AsyncLocalStorage store mỗi khi một tác vụ đi qua dbChannel
dbChannel.start.bindStore(activeDbOp, (ctx) => `${ctx.operation}:${ctx.table}`);

// Đăng ký subscriber ở tầng observability (tách biệt hoàn toàn khỏi code DB)
dbChannel.subscribe({
  start(ctx) {
    ctx.startTime = performance.now();
  },
  asyncEnd(ctx) {
    const durationMs = performance.now() - (ctx.startTime ?? 0);
    if (durationMs > 50) {
      console.warn(
        JSON.stringify({
          event: "slow_db_query",
          op: ctx.operation,
          table: ctx.table,
          durationMs: Number(durationMs.toFixed(2)),
        }),
      );
    }
  },
  error(ctx) {
    console.error(
      JSON.stringify({
        event: "db_query_error",
        op: ctx.operation,
        table: ctx.table,
        error: ctx.error instanceof Error ? ctx.error.message : String(ctx.error),
      }),
    );
  },
});

// Code nghiệp vụ DB chỉ bọc bằng tracePromise — sạch, không phụ thuộc APM cụ thể
export function queryUsers(sql: string, runQuery: (s: string) => Promise<unknown[]>) {
  return dbChannel.tracePromise(
    () => runQuery(sql),
    { operation: "SELECT", table: "users" },
  );
}
```

**3. `boundedChannel()` (Node 26.1+) kết hợp `using`**

Trên **Node 26.1+**, `diagnostics_channel.boundedChannel(name)` cung cấp cặp sự kiện `start` / `end` gọn nhẹ tích hợp trực tiếp với **Explicit Resource Management (`using`)** thông qua `.withScope(context)` hoặc `.run(context, fn)` — đảm bảo sự kiện `end` luôn được phát ngay cả khi khối code ném ngoại lệ hoặc `return` sớm:

```ts
import dc from "node:diagnostics_channel";

interface RenderScope {
  template: string;
}

const renderChannel = dc.boundedChannel("app:render");

renderChannel.subscribe({
  start(ctx) {
    // Khởi tạo span hoặc ghi mốc thời gian bắt đầu
    void (ctx as RenderScope).template;
  },
  end(ctx) {
    // Luôn chạy khi rời scope (kể cả khi throw)
    void (ctx as RenderScope).template;
  },
});

export function renderPage(template: string): string {
  // using tự gọi [Symbol.dispose]() để phát sự kiện `end` khi rời hàm
  using _scope = renderChannel.withScope({ template });
  return `<html>${template}</html>`;
}

// Hoặc dạng callback gọn với .run()
export function renderWidget(template: string): string {
  return renderChannel.run({ template }, () => `<section>${template}</section>`);
}
```

**4. Các Built-in `diagnostics_channel` quan trọng trên Node 26**

| Tên kênh (channel / tracingChannel) | Phạm vi & sự kiện | Ứng dụng thực tế |
|---|---|---|
| `http.server.request.start` / `http.server.response.finish` | Vòng đời HTTP server request/response (`node:http`) | Tự động đo latency HTTP, đếm status code, mở root span |
| `http.client.request.start` / `http.client.response.finish` | Outbound request qua `node:http` / `node:https` | Theo dõi độ trễ upstream legacy client |
| `undici:request:create` / `undici:request:headers` / `undici:request:trailers` / `undici:request:error` | Toàn bộ request `fetch()` và Undici 8 `Dispatcher` / `Pool` | Đo DNS + TLS + TTFB + body time, tiêm header `traceparent`, bắt timeout |
| `undici:client:beforeConnect` / `undici:client:connected` / `undici:client:connectError` | Vòng đời kết nối TCP/TLS của Undici pool | Phát hiện lỗi kết nối lại liên tục, pool exhaustion, TLS handshake chậm |
| `net.client.socket` / `net.server.socket` | Mở socket TCP/IPC client & server | Audit outbound connections, phát hiện socket churn |
| `dns.lookup` | Lời gọi `dns.lookup` đi qua libuv threadpool | Bắt thủ phạm gây nghẽn libuv threadpool từ DNS độ trễ cao |
| `node:permission-model:*` | Kiểm tra / từ chối quyền trong Node Permission Model (`--permission`) | Audit hành vi truy cập FS/worker/child bị chặn trên production |

### 7.4 Tích hợp OpenTelemetry (OTel): `traceparent` & tránh Duplicate Spans

OpenTelemetry là chuẩn mở cho distributed tracing. Trên Node 26, phần lớn auto-instrumentation OTel (`@opentelemetry/instrumentation-http`, `undici`, DB drivers) hoạt động trực tiếp trên `diagnostics_channel` và `AsyncLocalStorage`.

- **Lan truyền ngữ cảnh qua mạng (W3C Trace Context):** Mọi HTTP request ra ngoài phải đính kèm header `traceparent` dạng `00-<32-hex-trace-id>-<16-hex-span-id>-<2-hex-flags>` (và `tracestate` nếu có). Khi nhận request từ bên ngoài biên tin cậy (public internet), **validate hoặc tạo trace mới** (chỉ link `parent` thay vì tin mù quáng `traceId` do client giả mạo để tránh nhiễm độc trace).
- **Tránh Duplicate Spans:** Nếu đã bật auto-instrumentation cho `http` và `undici` (hoặc framework như Fastify/Express OTel plugin), **không** tự tạo thêm manual span bọc trùng chính HTTP/fetch call đó. Chỉ tạo manual span cho **ranh giới nghiệp vụ có ý nghĩa** (ví dụ `checkout.calculateTax`, `worker.renderPdf`, `batch.flushToS3`).
- **Head/Tail Sampling:** Ở lưu lượng cao, không ghi 100% trace cho request `200 OK` nhanh; cấu hình sampling theo tỷ lệ (vd 1–5% cho traffic bình thường) kết hợp giữ lại **100% trace lỗi (`5xx`) và trace chậm (`> SLA`)** ở OTel Collector (tail-based sampling).
- **Khởi tạo SDK sớm nhất có thể:** Nạp file khởi tạo OTel qua `node --import ./dist/telemetry.js dist/index.js` trước khi các module ứng dụng được `import`, đảm bảo mọi subscriber `diagnostics_channel` đăng ký kịp trước request đầu tiên.

---

## 8. Benchmarking đúng chuẩn & TS 7 Native Compiler Diagnostics

Tối ưu không có số liệu benchmark đúng chuẩn rất dễ dẫn đến code phức tạp hơn nhưng **chậm hơn trên production**.

### 8.1 Bẫy Microbenchmark trên V8 & quy chuẩn đo đạc

V8 có nhiều tầng thực thi (**Ignition** bytecode → **Sparkplug** → **Maglev** → **TurboFan** tối ưu hóa). Một vòng lặp đo sơ sài sẽ bị tối ưu hóa đánh lừa hoàn toàn:

```ts
import { performance } from "node:perf_hooks";

// ❌ SAI: 4 lỗi benchmark kinh điển trong 6 dòng
function benchBad() {
  const start = Date.now(); // 1. Dùng Date.now() thay vì monotonic clock
  for (let i = 0; i < 1_000_000; i++) {
    Math.imul(i, 31) + 7; // 2. Dead Code Elimination (DCE): kết quả không được dùng, TurboFan xóa sạch vòng lặp!
  }
  // 3. Không có warm-up, chỉ chạy 1 lần, không tách GC noise, không có phân phối p50/p95/p99
  console.log("ms:", Date.now() - start);
}

// ✅ ĐÚNG: warm-up, chống DCE bằng sink, dữ liệu đa dạng tránh false monomorphism, báo cáo phân vị
let sink = 0;

function runBenchmark(name: string, fn: (input: string) => number, inputs: string[], rounds = 30) {
  // 1. Warm-up để Maglev/TurboFan biên dịch ổn định
  for (let w = 0; w < 5_000; w++) {
    sink ^= fn(inputs[w % inputs.length]);
  }

  // 2. Đo nhiều vòng lặp độc lập để có phân phối
  const samplesMs: number[] = [];
  const iterationsPerRound = 10_000;

  for (let r = 0; r < rounds; r++) {
    const t0 = performance.now();
    let acc = 0;
    for (let i = 0; i < iterationsPerRound; i++) {
      acc += fn(inputs[i % inputs.length]);
    }
    samplesMs.push(performance.now() - t0);
    sink ^= acc; // Ngăn V8 loại bỏ toàn bộ tính toán (DCE)
  }

  samplesMs.sort((a, b) => a - b);
  const at = (p: number) => samplesMs[Math.min(samplesMs.length - 1, Math.floor((p / 100) * samplesMs.length))];
  console.log({
    name,
    p50Ms: Number(at(50).toFixed(3)),
    p95Ms: Number(at(95).toFixed(3)),
    p99Ms: Number(at(99).toFixed(3)),
    rssMB: Number((process.memoryUsage().rss / 1048576).toFixed(1)),
    sinkGuard: sink & 1, // Đảm bảo `sink` thực sự thoát ra ngoài
  });
}
```

**Checklist chống ảo giác Benchmark:**
- **Cố định môi trường:** Cùng bản patch Node/V8, cùng CPU governor / container quota, tắt tiến trình nền nặng, ghim `package-lock.json` / `pnpm-lock.yaml`.
- **Tránh Monomorphic Trap:** Nếu hàm production nhận 3 shape object khác nhau nhưng benchmark chỉ lặp lại 1 object cố định, V8 tối ưu monomorphic cực nhanh cho benchmark nhưng thực tế production lại chạy chậm hơn nhiều.
- **Đo End-to-End trước khi micro-optimize:** Luôn kiểm chứng trên load test có **concurrency, HTTP keep-alive, backpressure và DB thật/mock latency** (ví dụ `autocannon`, `k6`, `oha`) rồi đối chiếu **p50/p95/p99 + error rate + peak RSS**.

### 8.2 TypeScript 7 (Go Native Compiler) Diagnostics & Tuning

**TypeScript 7.0** (biên dịch native bằng Go — `tsgo` / `tsc` 7) cải thiện tốc độ typecheck & build nhiều lần nhờ song song hóa thực sự giữa nhiều goroutine, nhưng cách chẩn đoán và cân chỉnh bộ nhớ khác rõ so với TS 5.x/6.x chạy trên Node.js.

```sh
# 1. Đo thời gian chi tiết theo từng pha (Parse, Bind, Check, Emit) và Peak Memory
tsc --noEmit --extendedDiagnostics

# 2. Xuất trace định dạng Chrome Tracing để tìm file / kiểu generic gây chậm typecheck
tsc --noEmit --generateTrace ./ts-trace
# Mở ./ts-trace/trace.json bằng chrome://tracing hoặc Perfetto UI

# 3. Kiểm soát độ song song trên máy CI / container bị giới hạn RAM
tsc --noEmit --checkers 2
tsc -b --builders 2 --checkers 2

# 4. Ép chạy đơn luồng khi cần tái hiện deterministic hoặc môi trường RAM cực eo hẹp
tsc --noEmit --singleThreaded
```

| Cờ CLI TS 7 | Mặc định / Ý nghĩa | Ảnh hưởng CPU & RAM | Khi nào chỉnh |
|---|---|---|---|
| `--extendedDiagnostics` | In số file, dòng, thời gian Parse/Bind/Check/Emit và bộ nhớ đỉnh | Không ảnh hưởng kết quả emit | Luôn chạy bước 1 khi build/CI chậm |
| `--generateTrace <dir>` | Ghi chi tiết thời gian resolve từng kiểu phức tạp (conditional/mapped types) | Có overhead nhẹ khi ghi trace | Khi pha `Check time` chiếm > 60% tổng thời gian |
| `--checkers <N>` | Số checker chạy song song trong **một** project (mặc định **`4`**) | Tăng tốc Check nhưng tăng RAM tuyến tính theo `N` | Hạ xuống `1` hoặc `2` trên CI runner ít RAM (2–4 GiB) |
| `--builders <N>` | Số project references build song song trong `tsc -b` | Tăng tốc monorepo lớn nhưng nhân RAM với `--checkers` | Giới hạn chặt trong monorepo nhiều package |
| `--singleThreaded` | Tắt song song hóa, chạy tuần tự trên 1 luồng | RAM thấp nhất, CPU 1 nhân | Debug sự cố biên dịch hoặc runner giới hạn 1 vCPU / RAM nhỏ |

> **Cảnh báo nhân chéo RAM (`builders × checkers`):** Trong chế độ `tsc -b` (project references), tổng số checker đồng thời có thể lên tới **`builders × checkers`**. Ví dụ `--builders 4 --checkers 4` tạo tới 16 checker song song — trên container CI 4 GiB RAM rất dễ bị OOMKill! Hãy tính ngân sách RAM thực tế và đo `Peak memory` bằng `--extendedDiagnostics` trước khi nâng số lượng.

**Phân biệt 3 consumer TypeScript khác nhau:**
1. **CLI (`tsc`):** Chạy binary native Go của TS 7 — hưởng lợi trực tiếp từ song song hóa.
2. **Editor / Language Server (VS Code, JetBrains):** Phải kiểm tra đã bật TS 7 native language server chưa, hay vẫn đang chạy phiên bản workspace TS cũ.
3. **ESLint (`typescript-eslint`) & công cụ dùng JS Compiler API:** Nhiều plugin lint kiểu (type-aware rules) vẫn cần cầu nối/JS compiler service — vì vậy **`tsc --noEmit` nhanh gấp 10 lần không có nghĩa `eslint` cũng tự động nhanh tương đương**. Xem chi tiết migration & bridge tại [tsconfig.md](tsconfig.md#32-cli-native-và-tool-cần-compiler-api).

---

## 9. Anti-patterns & Runbook chẩn đoán nhanh

### 9.1 Anti-patterns phổ biến khi debug & tối ưu

| Anti-pattern | Vì sao nguy hiểm | Cách làm đúng |
|---|---|---|
| Mở `--inspect=0.0.0.0:9229` trên server thật | Cho phép thực thi mã từ xa (RCE) nếu lọt mạng | Chỉ bind `127.0.0.1`, dùng SSH tunnel / `kubectl port-forward`, production bật `--disable-sigusr1` |
| Chụp `v8.writeHeapSnapshot()` trực tiếp trên pod đang nhận traffic & sắp đầy RAM | Dừng main thread nhiều giây + nhân đôi RAM → OOMKill ngay lập tức | Dùng `--heap-prof` / `v8.startHeapProfile()` trước; nếu cần snapshot thì rút pod khỏi traffic hoặc dùng replica dư RAM |
| Gửi file `.heapsnapshot` hoặc Diagnostic Report (có `env`) lên ticket công khai | Rò toàn bộ API key, token, mật khẩu, PII khách hàng | Bật `--report-exclude-env` / `process.report.excludeEnv = true`; quản lý artifact như dữ liệu tuyệt mật và xóa ngay sau điều tra |
| Tăng `UV_THREADPOOL_SIZE=128` khi API bị chậm | Không cứu JS CPU trên main thread; tăng context switch & RAM stack | Đo ELU + Event Loop Delay trước; giới hạn concurrency `fs`/`crypto` rồi mới tăng pool có kiểm chứng (thường 8–32) |
| Gọi `emitter.setMaxListeners(0)` ngay khi thấy warning | Che giấu memory leak thực sự cho tới khi server sập OOM | Tìm nơi đăng ký listener mà quên `off()` / `{ signal }` rồi sửa vòng đời |
| Cộng `heapUsed + external + arrayBuffers` để tính tổng bộ nhớ | `arrayBuffers` đã nằm trong `external` → tính đúp sai lệch | Đọc `rss` cho tổng process, phân rã bằng `heapUsed` và `external` (`arrayBuffers` chỉ để xem chi tiết bên trong `external`) |
| Đặt `userId` hoặc URL đầy đủ làm label metric | Bùng nổ cardinality làm treo Prometheus / tốn chi phí APM | Chỉ dùng route template (`/orders/:id`), method, status class (`2xx`/`5xx`) |
| Dùng `AsyncLocalStorage.enterWith()` trong middleware | Làm rò context giữa các request đồng thời | Luôn dùng `als.run(store, next)` |
| Đọc `h.exceeds` của `monitorEventLoopDelay` như “số lần lag > resolution” | `exceeds` là số lần vượt `highest` (~1 giờ), luôn bằng 0 dù server lag 500ms | Đọc `h.percentile(99) / 1e6` và `h.max / 1e6` sau mỗi chu kỳ + `h.reset()` |
| Dùng `Date.now()` đo latency / timeout | Nhảy ngược hoặc vọt đột biến khi NTP điều chỉnh giờ | Dùng `performance.now()` hoặc `process.hrtime.bigint()` |

### 9.2 Runbook chẩn đoán nhanh theo tình huống vận hành

| Tình huống vận hành | Dấu hiệu nhận diện | Nguyên nhân thường gặp | Hành động ngay |
|---|---|---|---|
| **Pod chết lặp lại với `OOMKilled` (exit 137)** | Không có JS stack trong log; biểu đồ RSS đụng trần cgroup | `--max-old-space-size` quá sát limit; Buffer/native leak; nhiều `Worker` nhân heap | 1) Hạ `--max-old-space-size` về 60–70% limit; 2) Log định kỳ `memoryUsage()` (`rss`, `heapUsed`, `external`, `arrayBuffers`); 3) Bật `--heapsnapshot-near-heap-limit=2` trên 1 canary có đĩa trống |
| **p99 nhảy từ 20ms lên 2000ms khi traffic tăng nhẹ** | ELU > 0.85, Event Loop Delay p99 > 200ms | Blocking CPU trên main (`JSON.parse`, regex, nén/hash sync) hoặc Major GC thrashing | 1) Chạy `v8.startCpuProfile()` 15s trên canary; 2) Bật `gc` observer kiểm pause; 3) Chạy `--trace-sync-io` ở staging; 4) Offload CPU nặng sang `worker_threads` |
| **Health check `/healthz` timeout dù CPU pod chỉ 15%** | ELU thấp nhưng Event Loop Delay có đỉnh nhọn, hoặc mọi `fs`/DB call kẹt | Sync I/O rải rác, hoặc libuv threadpool nghẽn vì `dns.lookup`/`pbkdf2`, hoặc DB connection pool cạn | 1) Tách `/healthz` nhẹ (không gọi DB/FS nặng); 2) Kiểm `diagnostics_channel` `dns.lookup` & pool wait time; 3) Giới hạn concurrency `pbkdf2`/`fs` bằng `mapPool` |
| **RSS tăng đều 20 MiB/giờ, `heapUsed` cũng tăng đều** | Biểu đồ răng cưa `heapUsed` có đáy sau mỗi lần GC cao dần | Cache không giới hạn, listener leak, closure giữ `req`, Buffer 8 KiB slab | 1) Chạy `v8.startHeapProfile()` 5–10 phút tìm allocation site nóng; 2) Thực hiện **3-Snapshot** trên canary đọc Retained Size & Retainers |
| **RSS tăng đều nhưng `heapUsed` đi ngang** | `external` hoặc khoảng trống `rss - heapTotal` phình to | `Buffer` slab/stream backpressure chưa xả, C++ addon leak, glibc arena fragmentation | 1) So sánh `external` và `arrayBuffers`; 2) Kiểm stream `pipeline()` backpressure & đóng tài nguyên native; 3) Thử `MALLOC_ARENA_MAX=2` hoặc `jemalloc` có đo đạc |
| **Graceful shutdown luôn bị Kubernetes gửi `SIGKILL` sau 30s** | Process không thoát sau `server.close()` | HTTP keep-alive sockets mở, `setInterval` chưa clear/unref, DB pool/Worker chưa đóng | 1) In `process.getActiveResourcesInfo()` sau 5s shutdown; 2) Gọi `server.closeIdleConnections()` / `closeAllConnections()`; 3) Đóng pool/worker với timeout rõ ràng |
| **CI `tsc -b` bị killed hoặc chạy chậm bất thường** | Exit 137 trong bước typecheck hoặc `Check time` > 60% | `builders × checkers` vượt RAM CI; kiểu generic đệ quy sâu | 1) Chạy `tsc --noEmit --extendedDiagnostics`; 2) Giảm `--builders 2 --checkers 2` hoặc `--singleThreaded`; 3) Soi bottleneck bằng `--generateTrace` |

---

## 10. Checklist & Cheat sheet

### 10.1 Checklist điều tra & sẵn sàng Production

```text
□ Đã ghi lại baseline trước khi sửa: Node/TS patch, cgroup CPU/RAM, workload, p50/p95/p99, peak RSS
□ Có metric liên tục: monitorEventLoopDelay (chia 1e6, reset định kỳ) + ELU delta + memoryUsage()
□ Health check phản ánh được event loop lag, không chỉ kiểm tra "process còn sống"
□ Production bật --disable-sigusr1; tuyệt đối không mở --inspect ra 0.0.0.0
□ Diagnostic Reports luôn đặt --report-exclude-env (và process.report.excludeEnv = true trước writeReport)
□ Đã tạo thư mục trước khi gọi process.report.writeReport() (tránh ENOENT)
□ Đặt --max-old-space-size có headroom hợp lý (60–75% cgroup limit) cho Buffer/native/Worker
□ Có quy trình xử lý bí mật cho Heap Snapshot & Report (quyền 0o600, xóa ngay sau phân tích)
□ Structured JSON logging có traceId/requestId, route template (chống high-cardinality) và redaction
□ AsyncLocalStorage chỉ dùng .run() (tránh .enterWith()), truyền traceparent tường minh qua biên mạng/Worker
□ diagnostics_channel luôn kiểm hasSubscribers trước khi tạo payload; OTel load sớm qua --import
□ CI server kiểm sync I/O (--trace-sync-io) và theo dõi thời gian + Peak RAM của TS 7 (--extendedDiagnostics)
```

### 10.2 Cheat sheet lệnh CLI & API Node 26

```sh
# Debugging & Source Maps
node --inspect=127.0.0.1:9229 --enable-source-maps dist/index.js
node --inspect-brk=127.0.0.1:9229 --enable-source-maps dist/index.js
node --disable-sigusr1 --enable-source-maps dist/index.js

# CPU & Sync I/O Profiling (--cpu-prof-dir tự tạo đệ quy thư mục)
node --cpu-prof --cpu-prof-dir=./profiles --cpu-prof-interval=1000 dist/index.js
node --prof dist/index.js && node --prof-process isolate-0x*-v8.log > cpu.txt
node --trace-sync-io --trace-warnings --trace-deprecation dist/index.js

# Memory Profiling & Snapshots (--heap-prof-dir tự tạo đệ quy thư mục)
node --heap-prof --heap-prof-dir=./profiles dist/index.js
node --max-old-space-size=700 --heapsnapshot-near-heap-limit=3 --diagnostic-dir=./dumps dist/index.js
node --heapsnapshot-signal=SIGUSR2 dist/index.js   # POSIX only

# Diagnostic Reports (an toàn cho production)
node --report-on-fatalerror --report-uncaught-exception --report-exclude-env --report-exclude-network --report-compact --diagnostic-dir=./reports dist/index.js

# TypeScript 7 (native Go compiler) Diagnostics
tsc --noEmit --extendedDiagnostics
tsc --noEmit --generateTrace ./ts-trace
tsc -b --builders 2 --checkers 2
```

```ts
// Perf hooks — Event Loop Delay & ELU delta
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
const p99Ms = h.percentile(99) / 1e6; // ns → ms (reset định kỳ)
const prev = performance.eventLoopUtilization();
const delta = performance.eventLoopUtilization(prev); // delta.utilization ∈ [0, 1]

// Node 26 Programmatic CPU & Heap Profiling (không cần restart process)
import v8 from "node:v8";
const cpu = v8.startCpuProfile({ samplingIntervalMicros: 1_000 });
const cpuJson = cpu.stop();
const heap = v8.startHeapProfile({ sampleInterval: 512 * 1024 });
const heapJson = heap.stop();

// Active resources & Safe Diagnostic Report
import { mkdirSync } from "node:fs";
import process from "node:process";
process.getActiveResourcesInfo();
process.report.excludeEnv = true;
mkdirSync("./reports", { recursive: true });
process.report.writeReport("./reports/incident.json");
```

---

## 11. Tài liệu liên quan

- [Event loop & concurrency model](event-loop.md) — pha libuv, `monitorEventLoopDelay`, ELU, `UV_THREADPOOL_SIZE` và contention recipes
- [AbortSignal & request context](abort-context.md) — `AsyncLocalStorage`, propagation qua HTTP/stream và dọn tài nguyên khi hủy
- [Worker Threads & Child Process](threading.md) — offload CPU nặng, heap riêng của `Worker` và RSS chung của process
- [Exception / Error](exceptions.md) — giữ `Error.cause`, `code`, chiến lược log một lần ở boundary
- [Node.js built-ins](nodejs-apis.md) — `node:perf_hooks`, `node:diagnostics_channel`, `node:v8`, streams & backpressure
- [Bảo mật Node.js](security.md) — bảo vệ secrets, redaction, Permission Model và bề mặt tấn công Inspector
- [tsconfig & biên dịch TypeScript](tsconfig.md) — TypeScript 7 native Go compiler, type stripping và bridge ESLint/IDE
- [Testing với `node:test`](testing.md) — tái hiện lỗi và kiểm thử hồi quy hiệu năng/memory
- [Node.js 26 Inspector API](https://nodejs.org/api/inspector.html) — tài liệu chính thức V8 Inspector Protocol & `node:inspector/promises`
- [Node.js 26 Performance Measurement APIs (`node:perf_hooks`)](https://nodejs.org/api/perf_hooks.html) — histogram, ELU, `PerformanceObserver`
- [Node.js 26 Diagnostics Channel](https://nodejs.org/api/diagnostics_channel.html) — `channel`, `tracingChannel`, `boundedChannel` và danh sách built-in channels
- [Node.js 26 Diagnostic Report](https://nodejs.org/api/report.html) — cờ CLI, schema báo cáo và tùy chọn bảo mật
- [Node.js Memory Diagnostics Guide](https://nodejs.org/en/learn/diagnostics/memory/using-heap-snapshot) — hướng dẫn chụp và phân tích Heap Snapshot
