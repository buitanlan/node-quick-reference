# Kiểm thử Node.js & TypeScript

*(Chiến lược test, `node:test`, `node:assert/strict`, mocks/fake timers/snapshots, HTTP/Undici/streams/worker, type tests, tarball consumer, coverage & CI)*

Baseline: **Node.js 26 Active LTS** ("Lithium", từ 2026-10-28, V8 14.6+, Undici 8+) và **TypeScript 7.0** (compiler native Go), ESM. Tài liệu tập trung vào kiểm thử hợp đồng runtime, vòng đời async/cleanup, cách ly tiến trình, kiểm kiểu public và xác minh package đã đóng gói cho ứng dụng server và thư viện/CLI.

> **Nguyên tắc lõi:** Typecheck (`tsc --noEmit`) và runtime tests kiểm tra **hai lớp độc lập**. Node 26 chạy thẳng `.ts` erasable bằng type stripping không kiểm kiểu, không đọc `tsconfig.json` và không biến đổi decorator/JSX; ngược lại `tsc` không kiểm được dữ liệu từ mạng/disk, race condition hay packaging `exports`. Luôn chạy cả hai trên CI.

---

## Mục lục

- [1. Chọn lớp kiểm thử và chiến lược test](#1-chọn-lớp-kiểm-thử-và-chiến-lược-test)
  - [1.1 Ma trận rủi ro sang lớp kiểm thử](#11-ma-trận-rủi-ro-sang-lớp-kiểm-thử)
  - [1.2 Test Pyramid vs Testing Trophy cho backend và tooling](#12-test-pyramid-vs-testing-trophy-cho-backend-và-tooling)
  - [1.3 Tránh test lặp implementation và kiểm thử ở biên hợp đồng](#13-tránh-test-lặp-implementation-và-kiểm-thử-ở-biên-hợp-đồng)
- [2. `node:test`: kiến trúc, discovery, isolation và CLI (Node 26)](#2-nodetest-kiến-trúc-discovery-isolation-và-cli-node-26)
  - [2.1 Discovery globs mặc định và TypeScript erasable trên Node 26](#21-discovery-globs-mặc-định-và-typescript-erasable-trên-node-26)
  - [2.2 Execution model: process isolation vs `none`, file vs in-file concurrency](#22-execution-model-process-isolation-vs-none-file-vs-in-file-concurrency)
  - [2.3 Tổ chức suite, lifecycle hooks và context (`getTestContext`, `expectFailure`, `t.plan`)](#23-tổ-chức-suite-lifecycle-hooks-và-context-gettestcontext-expectfailure-tplan)
  - [2.4 Reporters, sharding, rerun failures và CI flags trên Node 26](#24-reporters-sharding-rerun-failures-và-ci-flags-trên-node-26)
- [3. Async, subtests, cleanup và `node:assert/strict` chuyên sâu](#3-async-subtests-cleanup-và-nodeassertstrict-chuyên-sâu)
  - [3.1 Await subtests, Promise và quản lý `t.signal` khi timeout](#31-await-subtests-promise-và-quản-lý-tsignal-khi-timeout)
  - [3.2 Cleanup chắc chắn với `t.after` và dọn thư mục tạm trên Windows](#32-cleanup-chắc-chắn-với-tafter-và-dọn-thư-mục-tạm-trên-windows)
  - [3.3 `node:assert/strict` vs `t.assert`: `Object.is`, `deepEqual`, `partialDeepStrictEqual` và custom assertions](#33-nodeassertstrict-vs-tassert-objectis-deepequal-partialdeepstrictequal-và-custom-assertions)
  - [3.4 Bẫy `assert.rejects(() => op())` vs `assert.rejects(op())` và kiểm lỗi sync/async](#34-bẫy-assertrejects--op-vs-assertrejectsop-và-kiểm-lỗi-syncasync)
- [4. Mocks, Fake Timers, Snapshot Testing và Dependency Injection](#4-mocks-fake-timers-snapshot-testing-và-dependency-injection)
  - [4.1 `t.mock`: `fn`, `method`, `getter`, `setter`, `property` và tự động restore](#41-tmock-fn-method-getter-setter-property-và-tự-động-restore)
  - [4.2 Fake timers (`t.mock.timers`), microtasks và bẫy destructure](#42-fake-timers-tmocktimers-microtasks-và-bẫy-destructure)
  - [4.3 Module mocking (`mock.module`) và giới hạn ESM/CJS cache](#43-module-mocking-mockmodule-và-giới-hạn-esmcjs-cache)
  - [4.4 Snapshot testing ổn định trên Node 26 (`t.assert.snapshot`, `fileSnapshot`)](#44-snapshot-testing-ổn-định-trên-node-26-tassertsnapshot-filesnapshot)
  - [4.5 Dependency injection vs mocking](#45-dependency-injection-vs-mocking)
- [5. Kiểm thử HTTP, Undici `MockAgent`, Abort, Streams, Worker và CLI](#5-kiểm-thử-http-undici-mockagent-abort-streams-worker-và-cli)
  - [5.1 Ma trận kịch bản kiểm thử ở biên I/O](#51-ma-trận-kịch-bản-kiểm-thử-ở-biên-io)
  - [5.2 HTTP server cục bộ (`listen(0)`), `closeAllConnections` và client disconnect](#52-http-server-cục-bộ-listen0-closeallconnections-và-client-disconnect)
  - [5.3 Mock HTTP client với Undici `MockAgent` không monkey-patch global](#53-mock-http-client-với-undici-mockagent-không-monkey-patch-global)
  - [5.4 Kiểm thử `AbortSignal` (already-aborted, mid-flight, listener cleanup, custom reason)](#54-kiểm-thử-abortsignal-already-aborted-mid-flight-listener-cleanup-custom-reason)
  - [5.5 Kiểm thử Streams (`pipeline`, backpressure, lỗi producer/consumer, đóng sớm)](#55-kiểm-thử-streams-pipeline-backpressure-lỗi-producerconsumer-đóng-sớm)
  - [5.6 Kiểm thử `Worker` threads và CLI (`execFile`, env, exit code)](#56-kiểm-thử-worker-threads-và-cli-execfile-env-exit-code)
- [6. Type tests và kiểm package đã build](#6-type-tests-và-kiểm-package-đã-build)
  - [6.1 Bidirectional type assertions (`Equal<A, B>`, `Expect<T>`) và bẫy `any`/`never`](#61-bidirectional-type-assertions-equal-expect-và-bẫy-anynever)
  - [6.2 `@ts-expect-error` vs `@ts-ignore`, distributive unions và overloads](#62-ts-expect-error-vs-ts-ignore-distributive-unions-và-overloads)
  - [6.3 Kiểm package consumer thật từ tarball (`npm pack`, ESM/CJS, `attw`, `publint`)](#63-kiểm-package-consumer-thật-từ-tarball-npm-pack-esmcjs-attw-publint)
- [7. Property-based testing, Contract testing và chọn công cụ (`node:test` vs Vitest)](#7-property-based-testing-contract-testing-và-chọn-công-cụ-nodetest-vs-vitest)
  - [7.1 Property-based testing cho invariants và parser biên](#71-property-based-testing-cho-invariants-và-parser-biên)
  - [7.2 Contract testing giữa service và adapter ngoài](#72-contract-testing-giữa-service-và-adapter-ngoài)
  - [7.3 Bảng quyết định: `node:test` vs Vitest trên Node 26 + TS 7](#73-bảng-quyết-định-nodetest-vs-vitest-trên-node-26--ts-7)
- [8. Coverage (V8 native vs `c8`), CI và chống Flaky Tests](#8-coverage-v8-native-vs-c8-ci-và-chống-flaky-tests)
  - [8.1 Built-in coverage trên Node 26: flags lọc, ngưỡng và `NODE_DISABLE_COMPILE_CACHE=1`](#81-built-in-coverage-trên-node-26-flags-lọc-ngưỡng-và-node_disable_compile_cache1)
  - [8.2 `NODE_V8_COVERAGE` kết hợp `c8` và bẫy branch coverage (`??`, `?.`, default params)](#82-node_v8_coverage-kết-hợp-c8-và-bẫy-branch-coverage---default-params)
  - [8.3 Pipeline CI chuẩn cho Node 26 Active LTS và cách diệt flaky tests](#83-pipeline-ci-chuẩn-cho-node-26-active-lts-và-cách-diệt-flaky-tests)
- [9. Anti-patterns và Pitfalls tổng hợp](#9-anti-patterns-và-pitfalls-tổng-hợp)
  - [9.1 Bảng chẩn đoán nhanh lỗi kiểm thử thường gặp](#91-bảng-chẩn-đoán-nhanh-lỗi-kiểm-thử-thường-gặp)
  - [9.2 Đúng vs Sai trong các mẫu kiểm thử dễ trượt](#92-đúng-vs-sai-trong-các-mẫu-kiểm-thử-dễ-trượt)
- [10. Checklist và tài liệu liên quan](#10-checklist-và-tài-liệu-liên-quan)
  - [10.1 Checklist trước khi merge PR hoặc release package](#101-checklist-trước-khi-merge-pr-hoặc-release-package)
  - [10.2 Tài liệu liên quan](#102-tài-liệu-liên-quan)

---

## 1. Chọn lớp kiểm thử và chiến lược test

Mục tiêu của bộ test không phải đạt 100% số dòng được chạm qua, mà là **chặn đúng nhóm lỗi đắt giá nhất** với thời gian phản hồi nhanh nhất và chi phí bảo trì thấp nhất.

### 1.1 Ma trận rủi ro sang lớp kiểm thử

| Rủi ro / Lớp lỗi | Lớp test phù hợp | Công cụ / kỹ thuật chính | Assertion cốt lõi |
|---|---|---|---|
| Logic tính toán, parser, validation, state machine | Unit, table-driven | `node:test`, `node:assert/strict` | Giá trị trả về, biên đầu vào (`0`, `""`, `NaN`, `null`, prototype), lỗi hợp đồng |
| Bất biến thuật toán (round-trip, idempotency, sắp xếp) | Property-based | `fast-check` + `node:test` | Bất biến đúng trên hàng trăm đầu vào sinh ngẫu nhiên và tự shrink |
| Adapter `fs`, HTTP, SQL, Redis, queue, stream | Integration với tài nguyên thật nhỏ | Ephemeral port `0`, `mkdtemp`, container/SQLite in-memory | Wire protocol, mã lỗi thật, backpressure, cleanup không leak handle |
| Service điều phối nhiều dependency | Component / contract test | Dependency injection hoặc Undici `MockAgent` | Payload ra/vào, mapping lỗi, idempotency key, thứ tự side effect |
| Retry, backoff, timeout, cancellation | Controlled-clock + real abort test | `t.mock.timers` cho lịch hẹn; `AbortController` thật cho I/O | Số attempt, deadline/budget, tác vụ nền thật sự dừng |
| Public library / CLI package | Consumer fixture từ tarball | `npm pack` + install vào thư mục ngoài + `attw` / `publint` | Resolution ESM/CJS, `exports`, `.d.ts`/`.d.cts`, bin exit code |
| Generics, overloads, branded types public | Type tests | `tsc --noEmit` + `Equal<A, B>` + `@ts-expect-error` | Kiểu suy luận chính xác hai chiều, lời gọi sai bị compiler từ chối |
| Luồng nghiệp vụ xuyên dịch vụ (checkout, auth) | E2E mỏng (ít nhưng thật) | HTTP client thật trên staging/ephemeral stack | Hành vi quan sát được ở biên ngoài, không kiểm chi tiết nội bộ |

### 1.2 Test Pyramid vs Testing Trophy cho backend và tooling

Hai mô hình phổ biến khác nhau ở nơi đặt trọng tâm:

| Tiêu chí | Test Pyramid (truyền thống) | Testing Trophy (tối ưu cho Node backend / TypeScript) |
|---|---|---|
| Nền móng | Unit test chiếm đa số tuyệt đối | Static analysis (`tsc --noEmit` strict, linter) làm nền chặn lỗi cú pháp/kiểu miễn phí |
| Trọng tâm lớn nhất | Unit cô lập từng hàm/class (dễ kéo theo quá nhiều mock) | **Integration / Component test** qua ranh giới thật (HTTP route, DB query, CLI) kết hợp Unit cho logic thuần |
| Phù hợp nhất với | Thư viện thuật toán, parser, compiler, SDK thuần | HTTP API, microservice I/O-heavy, worker pipeline, CLI kết hợp `fs`/process |
| Rủi ro nếu lạm dụng | Mock quá đà → test xanh nhưng production vỡ ở serialization/SQL/HTTP | Chậm hoặc flaky nếu mọi test đều bật stack nặng thay vì tách logic thuần ra unit |

**Chiến lược thực dụng cho Node 26 + TS 7:**

1. Đẩy mọi luật nghiệp vụ, parsing, tính toán và quyết định retry ra **hàm thuần** → phủ dày bằng unit / table-driven / property tests (chạy vài mili-giây).
2. Ở tầng adapter (`http`, `fs`, DB, stream, worker), viết **integration test hẹp trên tài nguyên thật cục bộ** thay vì mock từng phương thức socket hay driver.
3. Với library/CLI, luôn thêm **type tests** và **tarball consumer test** — hai lớp mà unit test nội bộ không bao giờ thay thế được.

### 1.3 Tránh test lặp implementation và kiểm thử ở biên hợp đồng

Test giòn (brittle test) xảy ra khi assertion khóa chặt chi tiết cài đặt (tên helper nội bộ, số lần gọi private method, cấu trúc cache bên trong) thay vì **hợp đồng quan sát được** (input → output, trạng thái lưu trữ, HTTP status/body, lỗi được ném).

- **Tránh:** khẳng định `repo.findById` phải được gọi đúng 1 lần với chính xác object option nội bộ khi hợp đồng chỉ yêu cầu "trả về 404 nếu user không tồn tại". Nếu refactor từ `findById` sang `findMany` hoặc thêm cache, test gãy dù hành vi vẫn đúng.
- **Tránh:** chụp snapshot toàn bộ response lớn chứa `createdAt`, `requestId`, stack trace hay đường dẫn tuyệt đối theo OS.
- **Nên:** kiểm tra **đầu ra hợp đồng** (status code, schema/field quan trọng bằng `partialDeepStrictEqual`, side effect bền vững, cancellation dừng đúng lúc).

---

## 2. `node:test`: kiến trúc, discovery, isolation và CLI (Node 26)

Từ Node 20 trở đi và trưởng thành đầy đủ trên **Node 26 Active LTS**, `node:test` là test runner chuẩn không cần cài dependency ngoài, tích hợp trực tiếp V8 coverage, timers/function mocking, snapshot testing, reporters và chạy thẳng TypeScript erasable.

### 2.1 Discovery globs mặc định và TypeScript erasable trên Node 26

Khi chạy `node --test` không truyền tham số đường dẫn, Node tự quét đệ quy thư mục hiện tại (bỏ qua `node_modules`) theo mẫu tên chuẩn:

- Mọi file dưới thư mục `test/` hoặc `tests/` khớp đuôi hỗ trợ.
- Mọi file có dạng `test-*.*`, `*.test.*`, `*-test.*`, `*_test.*`, hoặc `test.*`.
- **Đuôi file trên Node 26:** `.js`, `.cjs`, `.mjs`, và khi **không** bật `--no-strip-types` thì bao gồm mặc định cả **`.ts`, `.cts`, `.mts`** (cùng các mẫu tương ứng cho TypeScript erasable).

```js
// test/normalize.test.mjs — chạy độc lập bằng `node --test`
import test from "node:test";
import assert from "node:assert/strict";

test("normalize preserves falsy numbers and replaces nullish values", () => {
  const normalize = (value, fallback = 10) => value ?? fallback;
  const cases = [
    [0, 0],
    [-0, -0],
    [NaN, NaN],
    [undefined, 10],
    [null, 10],
    [42, 42],
  ];

  for (const [input, expected] of cases) {
    assert.equal(normalize(input), expected);
  }
});
```

```sh
# Chạy discovery mặc định (gồm cả *.test.ts erasable trên Node 26)
node --test

# Chỉ định tường minh path/glob để kiểm soát discovery ổn định trên CI
node --test "test/**/*.test.ts"
node --test --test-name-pattern="normalize" test/normalize.test.mjs
node --test --test-skip-pattern="slow|external" "test/**/*.test.ts"
```

**Lưu ý TypeScript trên Node 26:**

- Type stripping mặc định chỉ xử lý cú pháp **erasable** (`type`, `interface`, type annotations, `as`, `satisfies`, `import type`). Nếu test hoặc code được import dùng `enum`, `namespace` có runtime, parameter properties (`constructor(private x: number)`), legacy/Stage-3 decorators hoặc JSX → `node --test` trực tiếp sẽ báo lỗi cú pháp; phải build trước (`tsc` / bundler) hoặc dùng runner có transform (`Vitest` / loader).
- Khi dự án build ra `dist/` cho production, nên có ít nhất một job CI chạy test chống lại **output đã build**, không chỉ chạy trên source `.ts`. Xem thêm [tsconfig.md](tsconfig.md) và [decorators.md](decorators.md).

### 2.2 Execution model: process isolation vs `none`, file vs in-file concurrency

Đây là điểm dễ hiểu nhầm nhất trong `node:test`: có **hai tầng đồng thời hoàn toàn độc lập**.

| Chiều điều khiển | Mặc định trên Node 26 | Flag / Option | Phạm vi ảnh hưởng |
|---|---|---|---|
| **Isolation giữa các file** | `process` (mỗi file test là 1 child process riêng) | `--test-isolation=process` hoặc `--test-isolation=none` | `process`: cô lập module cache, `process.env`, global state, crash không giết file khác. `none`: tất cả file chạy chung 1 process (nhanh boot hơn, nhưng mọi singleton/env/`mock.module` dùng chung!) |
| **File concurrency** | Số CPU khả dụng (`os.availableParallelism() - 1`, tối thiểu 1) | `--test-concurrency=N` | Giới hạn số **file test** (process) chạy đồng thời |
| **In-file test concurrency** | `1` (**tuần tự**!) | `test("...", { concurrency: true \| N }, fn)` hoặc `describe("...", { concurrency: 4 }, fn)` | Số subtest/test chạy song song **bên trong cùng 1 suite/file**; `true` dùng `availableParallelism() - 1` |

> **Cảnh báo:** Đặt `{ concurrency: true }` trên `describe` **không** tăng hay ghi đè `--test-concurrency` của tầng file, và ngược lại `--test-concurrency=4` **không** làm các `test()` trong cùng 1 file chạy song song — chúng vẫn chạy tuần tự trừ khi bạn bật `concurrency` trên suite cha.

- Dù `--test-isolation=process` cô lập bộ nhớ, module cache và `process.env`, các **tài nguyên ngoài process** (thư mục cố định trên disk, port TCP cố định, database/schema dùng chung) vẫn tranh chấp nhau giữa các file chạy song song. Luôn dùng `mkdtemp`, port `0`, hoặc schema/DB riêng cho mỗi test/worker.
- Chỉ dùng `--test-isolation=none` khi bạn chủ động kiểm soát tuyệt đối global state (hoặc test nhẹ cần tốc độ khởi động tối đa) và biết chắc không có file nào mutate `process.env` / global dispatcher / prototype mà không restore.

### 2.3 Tổ chức suite, lifecycle hooks và context (`getTestContext`, `expectFailure`, `t.plan`)

`node:test` hỗ trợ cả phong cách **flat (`test` + subtest `t.test`)** lẫn **BDD (`describe`/`it` hoặc `suite`/`test`)**:

| API | Vai trò & hành vi trên Node 26 |
|---|---|
| `test(name, [opts], fn)` / `suite` / `describe` / `it` | Khai báo test hoặc nhóm suite; `suite`/`describe` nhóm các `it`/`test` bên trong và quản lý scope hook riêng |
| `before`, `after`, `beforeEach`, `afterEach` | Lifecycle hooks ở mức file/suite. Luôn **return/await** Promise nếu hook là async. `after`/`afterEach` vẫn chạy ngay cả khi test fail |
| `t.before`, `t.after`, `t.beforeEach`, `t.afterEach` | Hooks gắn trực tiếp lên `TestContext` của một test/subtest; `t.after` chạy theo thứ tự đăng ký sau khi test (và mọi subtest) kết thúc — lý tưởng cho cleanup từng tài nguyên |
| `skip`, `todo`, `only` | Bỏ qua, đánh dấu việc cần làm, hoặc chỉ chạy test được đánh dấu (`only` **chỉ có hiệu lực** khi chạy kèm `--test-only`, tránh quên để `.only` lọt vào CI mà chạy thiếu test!) |
| `expectFailure` | Có sẵn trong `node:test` trên Node 26: đánh dấu test **được kỳ vọng là đang fail** (ví dụ bug đã tái hiện nhưng chưa sửa). Test sẽ **PASS** (ghi `# EXPECTED FAILURE`) nếu nó ném lỗi/fail, và sẽ **FAIL** nếu bỗng nhiên pass (nhắc gỡ `expectFailure` khi bug đã được vá) |
| `getTestContext()` | Trả về `TestContext` hiện hành (dựa trên `AsyncLocalStorage`) từ bên trong helper mà **không cần truyền `t` qua nhiều tầng tham số** |
| `t.plan(count, { wait })` | Khẳng định chính xác số lượng assertion (qua `t.assert.*`) hoặc subtest phải thực thi trước khi test kết thúc; `wait: true \| ms` chờ đủ `count` trước khi kết thúc (tránh callback/event bị bỏ sót âm thầm) |
| `t.waitFor(predicate, opts)` | Chờ điều kiện async bất đồng bộ trở thành truthy/không ném lỗi với polling interval & timeout kiểm soát |
| `t.diagnostic(msg)` | Ghi chú chẩn đoán có cấu trúc vào output của reporter thay vì làm nhiễu stdout bằng `console.log` |

```ts
// test/lifecycle-context.test.ts — minh họa hooks, getTestContext, t.plan và expectFailure
import {
  describe,
  it,
  before,
  after,
  expectFailure,
  getTestContext,
} from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

function assertWithinCurrentTest(value: number): void {
  const t = getTestContext();
  assert.ok(t, "Phải được gọi bên trong một node:test");
  t.diagnostic(`Kiểm tra giá trị=${value} trong ${t.fullName}`);
  t.assert.strictEqual(value > 0, true);
}

describe("order pipeline", () => {
  let sharedResource: { closed: boolean };

  before(() => {
    sharedResource = { closed: false };
  });

  after(() => {
    sharedResource.closed = true;
  });

  it("nhận đủ hai sự kiện qua t.plan", (t) => {
    t.plan(2);
    const bus = new EventEmitter();
    bus.on("step", (name: string) => {
      t.assert.ok(name.length > 0);
    });
    bus.emit("step", "validate");
    bus.emit("step", "persist");
  });

  it("dùng getTestContext trong helper không cần truyền t", () => {
    assert.equal(sharedResource.closed, false);
    assertWithinCurrentTest(42);
  });

  expectFailure("bug #418: làm tròn thuế với đồng JPY chưa sửa", () => {
    assert.equal(Math.round(10.5), 10);
  });
});
```

> **Lưu ý về `t.plan(n)`:** `t.plan(n)` chỉ đếm các assertion gọi qua **`t.assert.*`** và các **subtest** (`t.test`), **không** đếm lệnh gọi từ module `node:assert/strict` độc lập!

### 2.4 Reporters, sharding, rerun failures và CI flags trên Node 26

Node 26 cung cấp đầy đủ cờ vận hành cho pipeline CI lớn mà không cần plugin ngoài:

| Nhóm | Flag CLI trên Node 26 | Công dụng thực tế |
|---|---|---|
| **Reporters** | `--test-reporter=spec\|tap\|dot\|junit\|lcov` + `--test-reporter-destination=stdout\|path` | Xuất nhiều định dạng cùng lúc: ví dụ in `spec` ra terminal và xuất `junit` / `lcov` ra file cho CI dashboard |
| **Sharding** | `--test-shard=1/4` | Chia danh sách file test thành 4 phần độc lập để chạy song song trên 4 CI runner |
| **Rerun failures** | `--test-rerun-failures=.test-state.json` | Ghi lại các test fail vào file trạng thái; lần chạy tiếp theo chỉ chạy lại các test fail cho đến khi xanh (hữu ích khi debug cục bộ; **không** dùng thay cho việc sửa flaky test trên CI) |
| **Global setup** | `--test-global-setup=./test/global-setup.ts` | Chạy `globalSetup()` một lần duy nhất trước toàn bộ suite và `globalTeardown()` sau khi tất cả file kết thúc (ví dụ khởi động DB container hoặc migrate schema test) |
| **Randomize** | `--test-randomize` + `--test-random-seed=12345` | Xáo trộn thứ tự chạy file/test để phát hiện ẩn ý phụ thuộc thứ tự; cố định `--test-random-seed` để tái hiện chính xác lần fail |
| **Tag filter** | `--experimental-test-tag-filter="integration && !slow"` | Lọc test theo `tags: ["integration"]` khai báo trong test options (vẫn mang prefix `--experimental-` trên Node 26) |
| **Timeout & Force exit** | `--test-timeout=30000`, `--test-force-exit` | Đặt timeout toàn cục (ms). Chỉ dùng `--test-force-exit` làm lưới an toàn khẩn cấp khi debug; nếu cần flag này để test thoát được thì chính hệ thống đang **leak handle** (socket/timer/worker) |

```sh
# Chạy nhiều reporter cùng lúc: spec ra stdout + junit ra file CI
node --test \
  --test-reporter=spec --test-reporter-destination=stdout \
  --test-reporter=junit --test-reporter-destination=reports/junit.xml \
  --test-shard=1/4 \
  --test-randomize \
  --test-global-setup=./test/global-setup.mjs \
  "test/**/*.test.ts"
```

```ts
// test/global-setup.mjs — chạy 1 lần cho toàn bộ phiên `node --test`
export async function globalSetup() {
  // Khởi tạo tài nguyên dùng chung (ví dụ chạy migration DB test)
}

export async function globalTeardown() {
  // Thu dọn tài nguyên toàn cục sau khi mọi file test hoàn tất
}
```

---

## 3. Async, subtests, cleanup và `node:assert/strict` chuyên sâu

Phần lớn lỗi flaky và treo CI trong test Node.js đến từ ba nguyên nhân: bỏ rơi Promise/subtest, quên hủy tài nguyên khi timeout, và nhầm ngữ nghĩa giữa các hàm assert.

### 3.1 Await subtests, Promise và quản lý `t.signal` khi timeout

1. **Luôn `await` hoặc `return` mọi Promise là một phần của test, bao gồm `await t.test(...)`:**
   Nếu test cha return trước khi subtest chạy xong, runner sẽ đánh dấu parent hoàn tất sớm và **cancel** các subtest chưa xong, đồng thời có thể đánh fail cả suite với lỗi *parent test finished before subtest*.
2. **Timeout của runner KHÔNG tự đóng socket, timer hay worker:**
   Khi khai báo `test("slow I/O", { timeout: 2_000 }, async (t) => ...)`, hết 2 giây `node:test` sẽ abort **`t.signal`** và đánh fail test. Nếu hàm bên trong không lắng nghe `t.signal` (ví dụ `fetch(url, { signal: t.signal })`, `setTimeout(ms, null, { signal: t.signal })`, `pipeline(..., { signal: t.signal })`), tác vụ nền vẫn sống và có thể làm treo tiến trình test cho tới khi bị kill.

```ts
// Đúng: truyền t.signal xuống I/O để timeout hủy công việc nền thật sự
import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

test("t.signal hủy delay và I/O khi test timeout", { timeout: 2_000 }, async (t) => {
  // Ghép t.signal với timeout cục bộ của thao tác
  const opSignal = AbortSignal.any([t.signal, AbortSignal.timeout(500)]);
  await delay(10, undefined, { signal: opSignal });
  assert.equal(opSignal.aborted, false);
});
```

### 3.2 Cleanup chắc chắn với `t.after` và dọn thư mục tạm trên Windows

Đăng ký `t.after(...)` **ngay sau khi tạo tài nguyên**, trước khi chạy bất kỳ assertion hay I/O nào có thể ném lỗi. `t.after` luôn chạy kể cả khi test throw hoặc bị timeout.

**Bẫy đặc thù trên Windows (`EBUSY` / `EPERM`):** Ngay sau khi đóng file/socket hoặc tiến trình con trên Windows, antivirus hoặc filesystem filter driver có thể giữ khóa handle thêm vài chục mili-giây khiến `rm(dir, { recursive: true, force: true })` ném `EBUSY`. Luôn thêm **`maxRetries: 3, retryDelay: 50`** vào `rm` trong cleanup.

```js
// test/file-round-trip.test.mjs — chạy độc lập, dọn dẹp an toàn trên cả Windows & POSIX
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("file round trip with subtests and Windows-safe cleanup", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "node-ref-"));
  t.after(() =>
    rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }),
  );

  await t.test("writes and reads UTF-8 content", async () => {
    const file = join(dir, "value.txt");
    await writeFile(file, "ok-utf8-✓", "utf8");
    assert.equal(await readFile(file, "utf8"), "ok-utf8-✓");
  });

  await t.test("rejects with ENOENT for missing file", async () => {
    const missing = join(dir, "does-not-exist.txt");
    await assert.rejects(() => readFile(missing, "utf8"), { code: "ENOENT" });
  });
});
```

### 3.3 `node:assert/strict` vs `t.assert`: `Object.is`, `deepEqual`, `partialDeepStrictEqual` và custom assertions

> **Cảnh báo quan trọng trên Node 26:** `t.assert.equal` kế thừa API **non-strict** của `node:assert` (`t.assert.equal(1, "1")` **KHÔNG** báo lỗi!). Khi dùng `t.assert`, hãy dùng **`t.assert.strictEqual`** và **`t.assert.deepStrictEqual`**; hoặc import `assert from "node:assert/strict"` nơi `assert.equal` đã tự là strict (`strictEqual`).

| Assertion (`node:assert/strict`) | Ngữ nghĩa so sánh chính xác | Trường hợp dễ bất ngờ |
|---|---|---|
| `assert.equal(a, b)` (`strictEqual`) | Dùng **`Object.is(a, b)`** | `NaN` bằng `NaN` (PASS); `+0` **khác** `-0` (FAIL) |
| `assert.deepEqual(a, b)` (`deepStrictEqual`) | Đệ quy kiểm giá trị + `Object.getPrototypeOf`, enumerable own **Symbol** keys, `Map`/`Set` entries, `Date` timestamp, `RegExp` source/flags, `Error` name/message/cause, typed arrays, **sparse arrays** | `Object.create(null)` khác `{}`; `[ , 1 ]` khác `[undefined, 1]`; `new URL(...)` so theo object nội bộ |
| `assert.partialDeepStrictEqual(actual, expected)` | **Ổn định trên Node 26:** kiểm tra `actual` chứa đầy đủ cấu trúc con khớp nghiêm ngặt với `expected` (bỏ qua các key thừa như `id`, `createdAt`, `traceId`) | Cực hữu ích cho HTTP response/log object; lưu ý mảng trong `expected` kiểm theo subset phần tử tương ứng |
| `assert.match(str, re)` / `doesNotMatch` | Kiểm tra chuỗi khớp/không khớp biểu thức chính quy | Tự kiểm `typeof str === "string"` trước khi khớp |
| `assert.ifError(val)` | Ném lỗi nếu `val !== undefined && val !== null` | Dùng cho callback kiểu Node cũ `(err, res)` |
| `assert.register(name, fn)` (từ `node:test`) | Đăng ký custom assertion xuất hiện trên `t.assert[name]` và được tính vào `t.plan(n)` | Không làm ô nhiễm global `node:assert` |

```ts
// Custom assertion trên Node 26 + partialDeepStrictEqual
import test, { assert as testAssert } from "node:test";
import assert from "node:assert/strict";

testAssert.register("isPositiveInt", (value: unknown): void => {
  assert.equal(typeof value, "number");
  assert.equal(Number.isInteger(value) && (value as number) > 0, true);
});

test("partialDeepStrictEqual bỏ qua trường động như timestamp", () => {
  const response = {
    id: "ord_01JXYZ",
    status: "paid",
    totals: { currency: "VND", amount: 150_000, tax: 15_000 },
    createdAt: new Date().toISOString(),
  };

  assert.partialDeepStrictEqual(response, {
    status: "paid",
    totals: { currency: "VND", amount: 150_000 },
  });
});
```

### 3.4 Bẫy `assert.rejects(() => op())` vs `assert.rejects(op())` và kiểm lỗi sync/async

Đây là một trong những lỗi tinh vi nhất khi kiểm tra hàm bất đồng bộ:

- Nếu `op()` là hàm thường trả về Promise (không có từ khóa `async`) mà **ném lỗi đồng bộ (`throw`) ngay dòng đầu** (ví dụ validate tham số trước khi gọi I/O):
  - `await assert.rejects(op(badInput), RangeError)` sẽ **NÉM LỖI RA NGOÀI TRƯỚC KHI `assert.rejects` ĐƯỢC GỌI** → test crash ở dòng gọi thay vì đi qua bộ matcher của `assert.rejects`!
  - `await assert.rejects(() => op(badInput), RangeError)` truyền **hàm bọc** (async/sync thunk) nên `assert.rejects` tự gọi bên trong khối bắt lỗi an toàn: cả sync throw lẫn rejected Promise đều được bắt và kiểm theo matcher.

| Tình huống | Sai | Đúng |
|---|---|---|
| Kiểm hàm sync ném lỗi | `assert.throws(parse(bad))` | `assert.throws(() => parse(bad), { name: "RangeError" })` |
| Kiểm hàm async reject | `assert.throws(async () => op())` *(luôn fail vì hàm async trả Promise, không throw sync)* | `await assert.rejects(() => op(), { code: "ECONNREFUSED" })` |
| Quên `await` trước `assert.rejects` | `assert.rejects(() => op(), Error)` *(test kết thúc trước khi Promise settle → false green!)* | `await assert.rejects(() => op(), Error)` |
| Kiểm nguyên nhân (`cause`) và thuộc tính tùy biến | Chỉ kiểm `Error` chung chung | Dùng predicate `(err: unknown) => err instanceof AppError && err.code === "RATE_LIMITED" && err.cause instanceof Error` |

Xem thêm các mẫu kiểm lỗi chi tiết tại [exceptions.md](exceptions.md#19-testing-errors).

---

## 4. Mocks, Fake Timers, Snapshot Testing và Dependency Injection

`node:test` tích hợp `MockTracker` ngay trên `t.mock` (cũng có `mock` ở mức module, nhưng ưu tiên **`t.mock`** vì nó tự khôi phục đúng phạm vi từng test).

### 4.1 `t.mock`: `fn`, `method`, `getter`, `setter`, `property` và tự động restore

| API trên `t.mock` | Chức năng |
|---|---|
| `t.mock.fn([original], [impl], [opts])` | Tạo spy/stub function; đọc `fn.mock.calls`, `fn.mock.callCount()`, đổi hành vi 1 lần bằng `fn.mock.mockImplementationOnce(...)` |
| `t.mock.method(obj, name, [impl], [opts])` | Spy hoặc thay thế tạm method trên object/prototype; tự trả về descriptor gốc khi test kết thúc |
| `t.mock.getter(obj, name, [impl])` | Spy/stub getter property |
| `t.mock.setter(obj, name, [impl])` | Spy/stub setter property |
| `t.mock.property(obj, name, value)` | Gán tạm giá trị dữ liệu cho property (hữu ích với config object hoặc `process.env` không dùng được nếu cần descriptor sạch) |
| `t.mock.reset()` / `t.mock.restoreAll()` | Khôi phục thủ công ngay giữa test nếu cần (bình thường `t.mock` tự gọi khi test kết thúc) |

### 4.2 Fake timers (`t.mock.timers`), microtasks và bẫy destructure

`t.mock.timers` kiểm soát `setTimeout`, `setInterval`, `setImmediate` và `Date` một cách tất định mà không phải ngủ thật (`sleep`) gây chậm và flaky CI.

**Ba quy tắc sống còn với fake timers:**

1. **Không destructure/capture timer trước khi `enable()`:** Nếu module production viết `const { setTimeout } = globalThis;` ở top-level trước khi test chạy `t.mock.timers.enable()`, module đó vẫn giữ tham chiếu timer thật và bỏ qua đồng hồ giả. Hãy dùng `globalThis.setTimeout` lúc gọi hoặc inject hàm `clock`/`sleep`.
2. **`tick(ms)` chạy callback timer đồng bộ nhưng KHÔNG tự flush mọi microtask chain sau đó:** Nếu callback của timer resolve một Promise kéo theo chuỗi `await`, hãy `await Promise.resolve()` hoặc `await` chính Promise kết quả mà test đang quan sát.
3. **Fake timers không làm syscall/network/stream hoàn tất:** Chỉ dùng cho logic thời gian (retry delay, debounce, cache TTL, token expiry). Với HTTP timeout thật, xem mục 5.

```js
// test/timers-and-mocks.test.mjs — chạy độc lập bằng `node --test`
import test from "node:test";
import assert from "node:assert/strict";

test("fake timers, t.mock.method and partialDeepStrictEqual work together", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_700_000_000_000 });

  const audit = {
    entries: [],
    record(event) {
      this.entries.push({ ...event, at: Date.now() });
    },
  };
  const recordSpy = t.mock.method(audit, "record");

  let fired = false;
  setTimeout(() => {
    fired = true;
    audit.record({ type: "deadline", ok: true, extra: "ignored-in-partial" });
  }, 100);

  t.mock.timers.tick(99);
  assert.equal(fired, false);
  assert.equal(recordSpy.mock.callCount(), 0);

  t.mock.timers.tick(1);
  assert.equal(fired, true);
  assert.equal(recordSpy.mock.callCount(), 1);
  assert.partialDeepStrictEqual(audit.entries[0], {
    type: "deadline",
    ok: true,
    at: 1_700_000_000_100,
  });
});
```

Các phương thức khác của `t.mock.timers`:
- `setTime(epochMs)`: nhảy đồng hồ `Date.now()` mà **không** kích hoạt timer đang chờ.
- `runAll()`: xả toàn bộ timer đã xếp lịch (cẩn thận vòng lặp vô hạn với `setInterval` không tự `clearInterval`).
- `reset()`: trả lại đồng hồ thật (tự động gọi khi test kết thúc nếu dùng `t.mock.timers`).

### 4.3 Module mocking (`mock.module`) và giới hạn ESM/CJS cache

Trong ESM chuẩn, named exports là **live read-only bindings** nên không thể gán đè `fs.readFile = stub` như cách từng làm với CommonJS `require`. Node 26 hỗ trợ `mock.module()` sau cờ **`--experimental-test-module-mocks`**:

```sh
node --test --experimental-test-module-mocks test/service.test.ts
```

```ts
// test/service.test.ts — cần cờ --experimental-test-module-mocks
import test from "node:test";
import assert from "node:assert/strict";

test("mock ESM module trước khi dynamic import SUT", async (t) => {
  const mocked = t.mock.module("../src/mailer.ts", {
    namedExports: {
      sendEmail: t.mock.fn(async () => ({ messageId: "msg-1" })),
    },
  });
  t.after(() => mocked.restore());

  // PHẢI dynamic import sau khi gọi mock.module, KHÔNG static import ở đầu file!
  const { registerUser } = await import("../src/register.ts");
  const res = await registerUser("ada@example.com");
  assert.equal(res.notified, true);
});
```

**Giới hạn quan trọng của `mock.module()`:**

- **Vẫn mang cờ `--experimental-test-module-mocks`** trên Node 26 (có cảnh báo experimental); không nên phụ thuộc tràn lan trong mọi unit test.
- Nếu module đích đã được static `import` trước khi gọi `mock.module()`, ESM module graph đã liên kết bản thật trong cache → mock không có tác dụng trừ khi dùng `cache: false` hoặc tách sang dynamic `import()` sau khi mock.
- Với CJS module, `defaultExport` ánh xạ tới `module.exports`, còn `namedExports` chỉ hỗ trợ khi consumer truy cập tên export tương ứng.
- Nếu bạn chạy nhiều file với `--test-isolation=none`, quên `restore()` hoặc cache giữ lại bản mock có thể rò sang file test khác.

### 4.4 Snapshot testing ổn định trên Node 26 (`t.assert.snapshot`, `fileSnapshot`)

Trên **Node 26**, snapshot testing của `node:test` đã **ổn định** (không còn cần cờ `--experimental-test-snapshots`):

- `t.assert.snapshot(value, [options])`: lưu snapshot vào file `<testfile>.snapshot` cạnh file test.
- `t.assert.fileSnapshot(value, path, [options])`: so khớp với một file fixture cụ thể (ví dụ output SQL, HTML, CLI help text) — dễ review diff hơn nhiều so với file `.snapshot` tổng hợp.
- Chạy **`node --test --test-update-snapshots`** để tạo mới hoặc cập nhật snapshot khi thay đổi chủ đích.
- Dùng **`snapshot.setDefaultSnapshotSerializers([...])`** (từ `node:test`) để chuẩn hóa giá trị không ổn định (UUID, ISO timestamp, đường dẫn Windows `\` vs POSIX `/`).

```ts
// test/cli-output.test.ts — chuẩn hóa dữ liệu động trước khi snapshot
import test, { snapshot } from "node:test";

snapshot.setDefaultSnapshotSerializers([
  (value: unknown) =>
    JSON.stringify(
      value,
      (_key, v) => {
        if (typeof v === "string") {
          return v
            .replaceAll("\\", "/")
            .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "<ISO_DATE>")
            .replace(
              /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
              "<UUID>",
            );
        }
        return v;
      },
      2,
    ),
]);

test("format report snapshot ổn định xuyên OS", (t) => {
  const report = {
    id: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    outputPath: "dist\\index.js",
    warnings: 0,
  };
  t.assert.snapshot(report);
});
```

**Kỷ luật snapshot:** Chỉ snapshot output ngắn, có tính đọc được (AST nhỏ, lỗi CLI, HTML/SQL đã chuẩn hóa). Đừng bao giờ bấm `--test-update-snapshots` mù quáng mà không review `git diff` từng dòng snapshot thay đổi.

### 4.5 Dependency injection vs mocking

| Tình huống | Nên chọn | Lý do |
|---|---|---|
| Logic nghiệp vụ cần `clock`, `fetch`, `logger`, `storage`, `random` | **Dependency injection** (tham số `deps` có default là bản thật) | Không phụ thuộc cờ experimental, typecheck 100% qua TS 7, chạy nhanh và không đụng ESM cache |
| Kiểm tra tương tác ở tầng HTTP của code gọi `fetch` trực tiếp | **Undici `MockAgent`** (xem §5.3) | Giữ nguyên serialization, headers, status, redirect, body stream của Undici thật |
| Spy nhanh trên object cục bộ hoặc đồng hồ `setTimeout` | **`t.mock.method` / `t.mock.timers`** | Tự restore theo vòng đời `t`, không cần thay chữ ký hàm |
| Code kế thừa gắn cứng `import` side-effect không thể truyền deps | **`mock.module()`** (tạm thời) | Giải pháp cứu cánh; nên kèm kế hoạch refactor sang DI ở biên |

```ts
// Mẫu DI gọn: production dùng default thật, test truyền bản giả có kiểu chặt
export interface TokenDeps {
  now?: () => number;
  fetchFn?: typeof fetch;
}

export async function verifySession(
  token: string,
  deps: TokenDeps = {},
): Promise<{ valid: boolean; checkedAt: number }> {
  const now = deps.now ?? Date.now;
  const fetchFn = deps.fetchFn ?? fetch;
  const res = await fetchFn("https://auth.internal/verify", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  await res.body?.cancel();
  return { valid: res.ok, checkedAt: now() };
}
```

---

## 5. Kiểm thử HTTP, Undici `MockAgent`, Abort, Streams, Worker và CLI

Đừng dừng ở unit test cho biên I/O: lỗi tốn kém nhất trên production Node.js thường là **socket leak**, **body không được consume**, **client ngắt kết nối nhưng server vẫn chạy DB query**, **backpressure vỡ bộ nhớ**, hoặc **worker crash treo queue**.

### 5.1 Ma trận kịch bản kiểm thử ở biên I/O

| Đối tượng | Các case bắt buộc phải có test | Dấu hiệu cleanup đạt chuẩn |
|---|---|---|
| **HTTP server** | Request bình thường hoàn tất không kích abort nhầm; client ngắt giữa chừng kích hủy work; body quá kích thước; header/content-type sai | `server.closeAllConnections()` + đợi `server.close` xong; không còn keep-alive socket mở |
| **HTTP client (`fetch` / Undici)** | `4xx`/`5xx`, JSON hỏng, redirect, timeout, retry chỉ trên lỗi tạm thời, hủy request giữa chừng | Body luôn được đọc hết hoặc `res.body?.cancel()`; `MockAgent` kiểm `assertNoPendingInterceptors()` |
| **`AbortSignal`** | Already-aborted trước khi chạy; abort giữa I/O; custom `reason` (không chỉ `AbortError`); dọn listener không rò rỉ | Không còn listener treo trên signal cha dài hạn; tác vụ nền dừng thật sự |
| **Streams** | Backpressure (consumer chậm hơn producer), lỗi từ producer, lỗi từ consumer, đóng sớm (`destroy`) | Dùng `pipeline`; không còn file descriptor hay chunk tồn đọng |
| **`Worker` / CLI** | Worker boot fail/crash giữa job; queue đầy; abort job đang chờ; CLI exit code non-zero, stderr, env isolation | Đợi `worker.terminate()` / sự kiện `exit`; **không** dùng `unref()` để giấu tiến trình còn sống |

### 5.2 HTTP server cục bộ (`listen(0)`), `closeAllConnections` và client disconnect

Luôn bind vào `127.0.0.1` với port **`0`** để hệ điều hành cấp ephemeral port rảnh (an toàn khi nhiều file test chạy song song), lấy port qua `server.address()`, và trong `t.after` gọi **`server.closeAllConnections()`** trước khi `server.close()` (vì `fetch` mặc định giữ HTTP keep-alive connection khiến `server.close()` chờ rất lâu mới xong!).

```js
// test/http-abort.test.mjs — chạy độc lập: HTTP server port 0 + kiểm hủy khi client ngắt
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";

async function startServer(t, handler) {
  const server = http.createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  const addr = server.address();
  return `http://127.0.0.1:${addr.port}`;
}

test("HTTP server handles normal request and cancels work on client disconnect", { timeout: 5_000 }, async (t) => {
  const entered = Promise.withResolvers();
  const cancelled = Promise.withResolvers();

  const baseUrl = await startServer(t, async (req, res) => {
    const ac = new AbortController();
    // Chỉ coi là hủy khi response chưa ghi xong mà socket đã đóng
    res.on("close", () => {
      if (!res.writableEnded) ac.abort(new Error("client disconnected"));
    });

    if (req.url === "/ok") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("pong");
      return;
    }

    entered.resolve();
    try {
      await once(ac.signal, "abort");
      cancelled.resolve(ac.signal.reason);
    } catch {
      cancelled.resolve(ac.signal.reason);
    }
  });

  await t.test("normal request completes with 200", async () => {
    const res = await fetch(`${baseUrl}/ok`, { signal: t.signal });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "pong");
  });

  await t.test("client destroy triggers server-side abort", async () => {
    const req = http.get(`${baseUrl}/hang`);
    req.on("error", () => {}); // Kỳ vọng ECONNRESET cục bộ khi destroy
    t.after(() => req.destroy());

    await entered.promise;
    req.destroy();

    const reason = await cancelled.promise;
    assert.match(reason.message, /client disconnected/);
  });
});
```

Chi tiết phân biệt `req.on("close")` vs `res.on("close")` và cầu nối `AbortSignal` chuẩn cho HTTP server xem ở [abort-context.md](abort-context.md#55-http-server--client-ngắt).

### 5.3 Mock HTTP client với Undici `MockAgent` không monkey-patch global

Global `fetch` trong Node 26 được vận hành bởi **Undici 8+**. Thay vì gán đè `globalThis.fetch = ...` (bỏ qua toàn bộ kiểm tra URL, header, body stream và redirect của tầng HTTP), hãy cài package `undici` làm devDependency và dùng **`MockAgent`**:

- **Cách sạch nhất:** truyền `dispatcher` vào `fetch(url, { dispatcher: mockAgent })` (Node-specific Undici option) hoặc inject `dispatcher` vào HTTP client — cô lập hoàn toàn từng test mà không đụng global.
- **Khi code gọi thẳng global `fetch`:** dùng `setGlobalDispatcher(mockAgent)` và **khôi phục dispatcher gốc** (`getGlobalDispatcher()`) trong `t.after(...)` (chỉ an toàn khi các test trong file chạy tuần tự — mặc định của `node:test`).

```ts
// test/undici-mock-agent.test.ts — cần `undici` trong devDependencies
import test from "node:test";
import assert from "node:assert/strict";
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";

test("client retries 503 once and parses JSON payload", async (t) => {
  const prevDispatcher = getGlobalDispatcher();
  const mockAgent = new MockAgent();
  mockAgent.disableNetConnect(); // Chặn mọi kết nối mạng thật lọt ra ngoài!
  setGlobalDispatcher(mockAgent);

  t.after(async () => {
    setGlobalDispatcher(prevDispatcher);
    await mockAgent.close();
  });

  const pool = mockAgent.get("https://api.example.test");
  pool
    .intercept({ path: "/v1/orders/42", method: "GET" })
    .reply(503, { error: "temporarily_unavailable" });
  pool
    .intercept({ path: "/v1/orders/42", method: "GET" })
    .reply(200, { id: 42, status: "confirmed" }, {
      headers: { "content-type": "application/json" },
    });

  // Giả định fetchOrderWithRetry gọi global fetch và retry khi 503
  const first = await fetch("https://api.example.test/v1/orders/42");
  assert.equal(first.status, 503);
  await first.body?.cancel();

  const second = await fetch("https://api.example.test/v1/orders/42");
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), { id: 42, status: "confirmed" });

  // Đảm bảo mọi interceptor dự kiến đều đã được gọi hết
  mockAgent.assertNoPendingInterceptors();
});
```

> **Điểm mạnh của `disableNetConnect()`:** Mọi lời gọi vô tình chạm mạng thật đều fail tức thì thay vì chạy chậm và phụ thuộc Internet. Nếu test vừa dùng `MockAgent` vừa gọi HTTP server cục bộ `127.0.0.1`, bật ngoại lệ bằng `mockAgent.enableNetConnect("127.0.0.1")`.

### 5.4 Kiểm thử `AbortSignal` (already-aborted, mid-flight, listener cleanup, custom reason)

Mọi hàm public nhận `signal?: AbortSignal` nên có ít nhất 4 test case sau:

1. **Already-aborted (`AbortSignal.abort(customReason)`):** Từ chối ngay với đúng `customReason` (so bằng `===`, không bọc thành `Error` mới nếu hợp đồng giữ nguyên `reason`), và **không thực thi side effect** nào (không mở file, không gửi request).
2. **Mid-flight abort:** Dùng `Promise.withResolvers()` để đồng bộ hóa chính xác thời điểm tác vụ đã bước vào trạng thái chờ (không dựa `setTimeout(10)` đoán mò), sau đó gọi `ac.abort(reason)` và xác nhận cả Promise ngoài reject **lẫn** tác vụ nền thực sự dừng.
3. **Listener cleanup trên signal dài hạn:** Truyền cùng một `AbortController` sống lâu qua nhiều lần gọi thành công, kiểm tra listener đã được gỡ (không tăng tuyến tính gây memory leak / cảnh báo `MaxListenersExceededWarning`).
4. **Custom reason không phải `Error`:** Vì `ac.abort("USER_CANCELLED")` hợp lệ theo chuẩn Web IDL (`reason: any`), kiểm tra code xử lý hủy không giả định mù quáng `reason.message` luôn tồn tại.

```ts
// test/abort-contract.test.ts — mẫu kiểm 3 hợp đồng cốt lõi của AbortSignal
import test from "node:test";
import assert from "node:assert/strict";
import { getEventListeners } from "node:events";

async function runWork(
  step: () => Promise<string>,
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted();
  const abortGate = Promise.withResolvers<never>();
  const onAbort = () => abortGate.reject(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await Promise.race([step(), abortGate.promise]);
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

test("runWork enforces already-aborted, mid-flight abort and listener cleanup", async (t) => {
  await t.test("already-aborted skips work and preserves exact reason", async () => {
    const reason = new Error("pre-cancelled");
    let called = false;
    await assert.rejects(
      () =>
        runWork(async () => {
          called = true;
          return "done";
        }, AbortSignal.abort(reason)),
      (err) => err === reason,
    );
    assert.equal(called, false);
  });

  await t.test("removes abort listener after normal completion", async () => {
    const ac = new AbortController();
    assert.equal(await runWork(async () => "ok", ac.signal), "ok");
    assert.equal(getEventListeners(ac.signal, "abort").length, 0);
  });
});
```

### 5.5 Kiểm thử Streams (`pipeline`, backpressure, lỗi producer/consumer, đóng sớm)

Kiểm thử stream chỉ bằng dữ liệu 10 byte dễ bỏ lọt bug backpressure và bug không `destroy` stream khi một mắt xích lỗi. Luôn test:
- **Backpressure:** dùng `highWaterMark` nhỏ (ví dụ `16` bytes hoặc `objectMode` với `highWaterMark: 2`) và consumer chậm để kiểm tra producer không đẩy tràn bộ đệm.
- **Lỗi ở Transform / Writable:** xác nhận `pipeline` truyền lỗi ra ngoài và gọi `_destroy` ở các stream còn lại.
- **Early abort:** truyền `{ signal }` vào `pipeline`, kiểm tra stream dừng sớm và không xử lý phần tử dư thừa.

```js
// test/stream-pipeline.test.mjs — chạy độc lập: Transform + pipeline + error & early abort
import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

function createUpperLineTransform() {
  return new Transform({
    objectMode: true,
    highWaterMark: 2,
    transform(chunk, _enc, cb) {
      if (typeof chunk !== "string") {
        cb(new TypeError("Expected string chunk"));
        return;
      }
      cb(null, chunk.trim().toUpperCase());
    },
  });
}

test("stream pipeline handles normal flow, transform error and early abort", async (t) => {
  await t.test("transforms chunks with bounded objectMode buffer", async () => {
    const out = [];
    await pipeline(
      Readable.from([" alpha ", "beta\n", "gamma"]),
      createUpperLineTransform(),
      new Writable({
        objectMode: true,
        highWaterMark: 1,
        write(chunk, _enc, cb) {
          out.push(chunk);
          cb();
        },
      }),
    );
    assert.deepEqual(out, ["ALPHA", "BETA", "GAMMA"]);
  });

  await t.test("propagates transform error and destroys source", async () => {
    let sourceDestroyed = false;
    const source = Readable.from(["ok", 123, "never-reached"]);
    source.on("close", () => {
      sourceDestroyed = true;
    });

    await assert.rejects(
      () =>
        pipeline(
          source,
          createUpperLineTransform(),
          new Writable({ objectMode: true, write(_c, _e, cb) { cb(); } }),
        ),
      { name: "TypeError", message: /Expected string chunk/ },
    );
    assert.equal(sourceDestroyed, true);
  });

  await t.test("stops early when AbortSignal aborts", async () => {
    const ac = new AbortController();
    const seen = [];
    async function* infiniteSource() {
      for (let i = 0; i < 1_000; i++) yield `item-${i}`;
    }

    await assert.rejects(
      () =>
        pipeline(
          Readable.from(infiniteSource()),
          createUpperLineTransform(),
          new Writable({
            objectMode: true,
            write(chunk, _enc, cb) {
              seen.push(chunk);
              if (seen.length === 2) ac.abort(new Error("stop-after-two"));
              cb();
            },
          }),
          { signal: ac.signal },
        ),
      (err) => err?.name === "AbortError" || err?.message === "stop-after-two",
    );
    assert.deepEqual(seen, ["ITEM-0", "ITEM-1"]);
  });
});
```

### 5.6 Kiểm thử `Worker` threads và CLI (`execFile`, env, exit code)

**Worker threads:**
- Luôn truyền `t.after(() => worker.terminate())` (hoặc đợi `once(worker, "exit")`) ngay sau khi `new Worker(...)`.
- Đừng gọi `worker.unref()` để làm test thoát sớm — `unref()` chỉ che giấu worker bị kẹt, khiến lỗi thật nổ ở process cleanup hoặc làm sai kết quả coverage.
- Kiểm tra ít nhất 2 nhánh lỗi: worker ném unhandled error (bắt sự kiện `"error"` + `"exit"` với mã khác 0) và terminate khi job vượt timeout.

**CLI binaries (`child_process.execFile`):**
- Dùng **`execFile(process.execPath, [binPath, ...args], { env, signal: t.signal, timeout: 5_000 })`** thay vì `exec` (tránh shell injection và khác biệt `cmd.exe` vs `sh` giữa Windows và Linux!).
- Kiểm tra rõ: `exitCode` (0 cho thành công, non-zero chuẩn cho sai tham số/lỗi runtime), `stdout` sạch dữ liệu máy đọc (JSON), thông báo lỗi/log đi đúng ra `stderr`, và hành vi với biến môi trường cô lập (không phụ thuộc biến env máy dev).

```ts
// test/cli-and-worker.test.ts — kiểm CLI bằng execFile và Worker bằng terminate
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Worker } from "node:worker_threads";
import { once } from "node:events";

const execFileAsync = promisify(execFile);

test("CLI trả exit code 2 và ghi lỗi ra stderr khi thiếu cờ bắt buộc", async (t) => {
  await assert.rejects(
    () =>
      execFileAsync(process.execPath, ["./dist/cli.js", "--invalid-flag"], {
        env: { PATH: process.env.PATH ?? "", NO_COLOR: "1" },
        signal: t.signal,
        timeout: 5_000,
      }),
    (err: NodeJS.ErrnoException & { code?: number; stderr?: string }) =>
      err.code === 2 && /unknown option/i.test(err.stderr ?? ""),
  );
});

test("Worker crash phát sự kiện error và exit với mã khác 0", async (t) => {
  const worker = new Worker(
    `throw new Error("worker-boom");`,
    { eval: true },
  );
  t.after(async () => {
    await worker.terminate();
  });

  const [err] = await once(worker, "error");
  const [code] = await once(worker, "exit");
  assert.match((err as Error).message, /worker-boom/);
  assert.notEqual(code, 0);
});
```

Xem thêm chi tiết vòng đời Worker và Child Process ở [threading.md](threading.md).

---

## 6. Type tests và kiểm package đã build

Với thư viện hoặc module chia sẻ nội bộ viết bằng TypeScript 7, regression nguy hiểm nhất thường là **kiểu suy luận âm thầm suy biến thành `any` / `unknown`**, hoặc **package chạy tốt trên source nhưng hỏng khi người dùng `import` từ tarball đã publish**.

### 6.1 Bidirectional type assertions (`Equal<A, B>`, `Expect<T>`) và bẫy `any`/`never`

Một sai lầm phổ biến trong type test viết tay là chỉ kiểm tra **assignability một chiều**:

```ts
// SAI: kiểm 1 chiều — vượt qua nhầm khi Returned suy biến thành `any` hoặc `never`!
type UserId = string & { readonly __brand: "UserId" };
declare function loadUser(id: UserId): Promise<{ id: UserId }>;

// Nếu loadUser bị sửa nhầm thành trả `Promise<any>`, hàm dưới VẪN biên dịch xanh!
const badCheck = (value: Awaited<ReturnType<typeof loadUser>>): UserId => value.id;
```

Hơn nữa, biến `badCheck` không được dùng sẽ kích hoạt lỗi `TS6133` (`noUnusedLocals`), và gọi hàm trả Promise mà không xử lý dễ vướng rule lint `no-floating-promises`.

**Giải pháp chuẩn:** Dùng helper **`Equal<A, B>`** (so sánh cấu trúc kiểu **hai chiều** dựa trên conditional type phân biệt được cả `any`, `never`, `readonly` và optional properties) kết hợp **`Expect<T extends true>`**:

```ts
// test-types/public-types.ts — đưa vào tsconfig typecheck, KHÔNG chạy runtime
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;
type Expect<T extends true> = T;

type UserId = string & { readonly __brand: "UserId" };
declare function loadUser(id: UserId): Promise<{ readonly id: UserId; name: string }>;

// Kiểm chính xác hai chiều: nếu trả `any`, `never`, hoặc thiếu `readonly` → lỗi biên dịch ngay!
type Returned = Awaited<ReturnType<typeof loadUser>>;
type _AssertReturned = Expect<Equal<Returned, { readonly id: UserId; name: string }>>;
type _AssertNotAny = Expect<Equal<Equal<Returned, any>, false>>;

// Kiểm âm tính: raw string phải bị từ chối ở vị trí UserId
declare const rawId: string;
// @ts-expect-error: raw string không thể gán cho branded UserId
void loadUser(rawId);

// Dùng export rỗng để file là module cô lập và không vướng unused local với exported type checks
export type { _AssertReturned, _AssertNotAny };
```

> **Lưu ý về `tsconfig`:** File type test (`test-types/*.ts`) chứa `declare` không có hiện thực runtime nên **chỉ đưa vào `tsconfig.typecheck.json`** (`tsc --noEmit`), **loại khỏi** glob của `node --test` và `tsconfig.build.json` (`exclude`). Nếu dự án đã dùng Vitest, có thể tận dụng `expectTypeOf` (`vitest typecheck`) theo cùng nguyên lý kiểm hai chiều này.

### 6.2 `@ts-expect-error` vs `@ts-ignore`, distributive unions và overloads

| Kỹ thuật | Hành vi | Khi nào dùng |
|---|---|---|
| `// @ts-expect-error: lý do` | **Bắt buộc** dòng kế tiếp phải có lỗi TS; nếu dòng sau bất ngờ biên dịch thành công, chính `@ts-expect-error` sẽ báo lỗi `TS2578` | Luôn dùng trong type tests cho negative cases |
| `// @ts-ignore` | Im lặng bỏ qua lỗi nếu có, và **cũng im lặng** nếu không còn lỗi | **Cấm** dùng trong type tests (tạo test chết không bao giờ báo regression) |

Hai tình huống cần đặc biệt viết type test khi thiết kế generic/API public:

1. **Distributive conditional types:** Kiểm tra với union (`string | number`), `never` (conditional `T extends ...` trên `never` phân phối thành `never` trừ khi bọc tuple `[T] extends [...]`) và `unknown`.
2. **Function overloads:** Kiểm tra từng nhánh overload riêng biệt, thứ tự overload (nhánh hẹp trước nhánh rộng), và đảm bảo kiểu đầu vào union không bất ngờ rơi vào overload sai.

```ts
// test-types/overloads-and-unions.ts
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;
type Expect<T extends true> = T;

type DistributiveBox<T> = T extends unknown ? { value: T } : never;
type NonDistributiveBox<T> = [T] extends [never] ? { empty: true } : { value: T };

declare function parseInput(raw: string, mode: "json"): unknown;
declare function parseInput(raw: string, mode: "text"): string;

type _DistUnion = Expect<
  Equal<DistributiveBox<string | number>, { value: string } | { value: number }>
>;
type _DistNever = Expect<Equal<DistributiveBox<never>, never>>;
type _NonDistNever = Expect<Equal<NonDistributiveBox<never>, { empty: true }>>;

// Lưu ý: ReturnType<typeof parseInput> trong TS chỉ lấy nhánh overload CUỐI (`string`).
// Vì vậy với hàm có overload, luôn gọi trực tiếp từng nhánh để kiểm kiểu trả về!
const textVal = parseInput("hi", "text");
const jsonVal = parseInput("{}", "json");

type _CheckText = Expect<Equal<typeof textVal, string>>;
type _CheckJson = Expect<Equal<typeof jsonVal, unknown>>;

// @ts-expect-error: mode không hợp lệ phải bị từ chối
void parseInput("hi", "xml");

export type { _DistUnion, _DistNever, _NonDistNever, _CheckText, _CheckJson };
```

### 6.3 Kiểm package consumer thật từ tarball (`npm pack`, ESM/CJS, `attw`, `publint`)

Typecheck và chạy test ngay trong source repo **không bao giờ phát hiện đủ** lỗi phát hành package: thiếu file trong `"files"`, sai đường dẫn `"exports"`, quên đuôi `.js` trong import nội bộ, xuất `.d.ts` chung cho cả ESM/CJS gây lỗi *"Masquerading as CJS"*, hoặc dual-package hazard tạo ra hai bản singleton khác nhau trong cùng một process.

**Quy trình kiểm consumer chuẩn trước khi publish:**

```sh
# 1. Build sản phẩm thật
npm run build

# 2. Soát nhanh cấu trúc package & types bằng publint và attw (@arethetypeswrong/cli)
npx publint
npx --package @arethetypeswrong/cli attw --pack

# 3. Đóng gói tarball thật giống hệt file đẩy lên registry
npm pack --pack-destination ./tmp-pack
```

Sau đó cài tarball vào một thư mục fixture **nằm ngoài cây `node_modules` của repo** (hoặc trong `tmpdir`) để kiểm tra 4 điều như một người dùng thật:

1. **ESM runtime (`import`):** `node --input-type=module -e 'import { api } from "my-pkg"; ...'`
2. **CJS runtime (`require`):** `node -e 'const { api } = require("my-pkg"); ...'` (nếu có hỗ trợ CJS hoặc `require(esm)` trên Node 26)
3. **Consumer typecheck với `moduleResolution: "NodeNext"` và `"Bundler"`:** chạy `tsc --noEmit` ở phía consumer để xác minh `.d.ts` / `.d.cts` / `"types"` conditions resolve đúng ở cả hai chế độ.
4. **Dual-package singleton identity** (nếu publish dual ESM+CJS có state/Error class): kiểm tra `err instanceof MyError` hoặc cùng một registry instance khi cả `import` và `require` cùng xuất hiện trong một process (xem [modules-packages.md](modules-packages.md)).

| Công cụ kiểm package | Bắt lỗi gì tốt nhất |
|---|---|
| **`publint`** | Sai `"exports"` / `"main"` / `"types"`, trỏ tới file không tồn tại trong tarball, field cũ xung đột |
| **`attw` (`@arethetypeswrong/cli`)** | Lỗi phân giải type qua mọi chế độ TS (`node10`, `node16`/`nodenext` CJS & ESM, `bundler`), phát hiện "False CJS" / "False ESM" / "Masquerading" |
| **Tarball consumer test** | Lỗi runtime thật trên Node 26: thiếu `dependencies` (nhầm sang `devDependencies`), thiếu `#!/usr/bin/env node` cho `bin`, lỗi relative import nội bộ |

---

## 7. Property-based testing, Contract testing và chọn công cụ (`node:test` vs Vitest)

### 7.1 Property-based testing cho invariants và parser biên

Unit test theo ví dụ (example-based) chỉ kiểm các biên mà lập trình viên nghĩ tới. **Property-based testing** (như thư viện `fast-check`, chạy trực tiếp bên trong `node:test`) tự sinh hàng trăm đầu vào biên (chuỗi rỗng, surrogate pairs Unicode, số âm, `-0`, `MAX_SAFE_INTEGER`, ký tự điều khiển) và **shrink** về ví dụ nhỏ nhất làm gãy bất biến.

Bốn nhóm bất biến đem lại giá trị cao nhất cho backend/tooling:
- **Round-trip:** `decode(encode(x))` bằng `x` (serializer, query string, base64url, config parser).
- **Idempotency:** `normalize(normalize(x))` bằng `normalize(x)` (path canonicalizer, retry key, formatter).
- **Monotonicity / Bounds:** kết quả phân trang hoặc clamp luôn nằm trong `[min, max]`, độ dài output không vượt trần.
- **No-crash fuzzing:** parser đầu vào không tin cậy **chỉ được** trả về giá trị hợp lệ hoặc ném lỗi domain có kiểm soát — không bao giờ ném `TypeError` nội bộ hay rơi vào ReDoS.

```ts
// test/codec-property.test.ts — kết hợp node:test và fast-check
import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

function encodeTag(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function decodeTag(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf8");
}

test("encodeTag/decodeTag giữ nguyên mọi chuỗi UTF-8 hợp lệ", () => {
  fc.assert(
    fc.property(fc.string(), (text) => {
      assert.equal(decodeTag(encodeTag(text)), text);
    }),
    { numRuns: 200 },
  );
});
```

### 7.2 Contract testing giữa service và adapter ngoài

Khi có nhiều implementation cho cùng một interface (ví dụ `InMemoryStore` cho unit test và `PostgresStore` / `SqliteStore` cho production), rủi ro lớn nhất là **bản giả bị lệch hành vi so với bản thật** (drift): bản giả trả `undefined` còn bản thật ném lỗi; bản giả so sánh phân biệt chữ hoa/thường còn DB không phân biệt.

**Mẫu giải quyết — Shared Contract Test Suite:** Viết một hàm `runStoreContract(createStore)` chạy bộ test hành vi chung cho **cả hai** implementation:

```ts
// test/store-contract.ts — 1 bộ hợp đồng chạy cho cả InMemory và Adapter thật
import test from "node:test";
import assert from "node:assert/strict";

export interface KvStore {
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | undefined>;
  delete(key: string): Promise<boolean>;
}

export function runKvStoreContract(
  name: string,
  createStore: () => Promise<{ store: KvStore; close: () => Promise<void> }>,
): void {
  test(`${name} satisfies KvStore contract`, async (t) => {
    const { store, close } = await createStore();
    t.after(close);

    await t.test("returns undefined for missing key", async () => {
      assert.equal(await store.get("missing"), undefined);
    });

    await t.test("overwrites existing value and reports delete status accurately", async () => {
      await store.set("k1", "v1");
      await store.set("k1", "v2");
      assert.equal(await store.get("k1"), "v2");
      assert.equal(await store.delete("k1"), true);
      assert.equal(await store.delete("k1"), false);
    });
  });
}
```

### 7.3 Bảng quyết định: `node:test` vs Vitest trên Node 26 + TS 7

| Tiêu chí | `node:test` (Built-in Node 26) | Vitest |
|---|---|---|
| **Số dependency cài thêm** | **0** (có sẵn trong runtime Node 26) | Cần hệ sinh thái Vitest + Vite transform pipeline |
| **TypeScript 7 erasable** | Chạy thẳng native bằng type stripping của Node 26, khởi động rất nhanh | Hỗ trợ đầy đủ cả erasable lẫn non-erasable |
| **Decorators / JSX / Path aliases (`tsconfig paths`)** | Không tự transform (cần build trước hoặc loader) | Hỗ trợ sẵn out-of-the-box qua Vite/Rollup/Rolldown |
| **Module mocking** | `mock.module()` đang sau cờ `--experimental-test-module-mocks` | `vi.mock()` / `vi.hoisted()` trưởng thành, ổn định |
| **Watch mode & HMR thông minh** | `--watch` cơ bản theo graph module | Watch mode rất nhanh, chỉ chạy lại test bị ảnh hưởng + UI trực quan |
| **Type tests tích hợp** | Dùng `tsc --noEmit` + `Equal<A, B>` riêng | Có sẵn `expectTypeOf` / `vitest typecheck` |
| **Browser / DOM component testing** | Không (thuần Node.js) | Có `jsdom`, `happy-dom` và Browser Mode thật |
| **Phù hợp nhất cho** | Backend Node 26 thuần, thư viện/SDK zero-deps, CLI, repo ưu tiên bám sát runtime production | Monorepo full-stack, dự án dùng decorators/JSX/path aliases, team cần DX watch UI & `vi.mock` mạnh |

> **Lời khuyên chọn nhanh:** Nếu dự án là **Node backend / CLI / library viết erasable TypeScript** và tuân thủ DI thay vì lạm dụng module mocking, bắt đầu với **`node:test`** — ít lớp trung gian, hành vi giống production 100% và hầu như không có chi phí nâng cấp. Chuyển sang **Vitest** khi bạn thật sự cần transform (JSX/decorators/aliases), browser/DOM testing hoặc hệ sinh thái watch/UI/typecheck tích hợp.

---

## 8. Coverage (V8 native vs `c8`), CI và chống Flaky Tests

### 8.1 Built-in coverage trên Node 26: flags lọc, ngưỡng và `NODE_DISABLE_COMPILE_CACHE=1`

`node:test` tích hợp sẵn V8 coverage (vẫn kích hoạt qua cờ `--experimental-test-coverage` trên Node 26) kèm đầy đủ cờ lọc file và chặn ngưỡng CI:

```sh
# Tắt compile cache để V8 coverage ghi chính xác số liệu dòng/nhánh!
NODE_DISABLE_COMPILE_CACHE=1 node --test \
  --experimental-test-coverage \
  --test-coverage-include="src/**/*.ts" \
  --test-coverage-exclude="src/**/*.d.ts" \
  --test-coverage-exclude="src/**/index.ts" \
  --test-coverage-lines=80 \
  --test-coverage-branches=75 \
  --test-coverage-functions=80 \
  --test-reporter=spec --test-reporter-destination=stdout \
  --test-reporter=lcov --test-reporter-destination=coverage/lcov.info \
  "test/**/*.test.ts"
```

| Flag / Biến môi trường | Tác dụng & lưu ý trên Node 26 |
|---|---|
| `--experimental-test-coverage` | Bật thu thập V8 coverage tích hợp trong `node:test` |
| `--test-coverage-include=<glob>` | Chỉ tính coverage cho các file khớp mẫu (truyền nhiều lần được) |
| `--test-coverage-exclude=<glob>` | Loại file test, fixture, generated code khỏi báo cáo |
| `--test-coverage-lines=<N>` / `-branches=<N>` / `-functions=<N>` | Fail exit code nếu coverage tụt dưới ngưỡng `%` quy định |
| **`NODE_DISABLE_COMPILE_CACHE=1`** | **Rất quan trọng:** Node 26 hỗ trợ module compile cache (`NODE_COMPILE_CACHE`), nhưng compile cache có thể khiến V8 bỏ sót thông tin coverage của các hàm đã cache. Luôn đặt `NODE_DISABLE_COMPILE_CACHE=1` trong job đo coverage! ([Compile cache limitations](https://nodejs.org/api/module.html#limitations-of-the-compile-cache)) |

### 8.2 `NODE_V8_COVERAGE` kết hợp `c8` và bẫy branch coverage (`??`, `?.`, default params)

Khi dự án **biên dịch TypeScript ra `dist/` kèm source maps** hoặc chạy nhiều quy trình con (`execFile` CLI, worker, nhiều lệnh test gộp lại), dùng biến môi trường chuẩn **`NODE_V8_COVERAGE`** kết hợp **`c8`** để gom toàn bộ JSON coverage từ mọi child process và remap ngược về file `.ts` gốc qua source map:

```sh
NODE_DISABLE_COMPILE_CACHE=1 npx c8 \
  --reporter=text --reporter=lcov \
  --include="dist/**" \
  --lines 80 --branches 75 \
  node --test "dist-test/**/*.test.js"
```

**Bẫy branch coverage trên V8:**
- Các toán tử ngắn mạch **`a ?? b`**, **`a?.b`**, **`a && b`**, **`a || b`** và **tham số mặc định** (`fn(x = 10)`) đều tạo ra **2 nhánh V8 ẩn** (nhánh có giá trị và nhánh fallback). Nếu không test cả hai phía, branch coverage sẽ tụt dù mọi dòng đều hiển thị đã chạy.
- **Đừng ép ngưỡng 100% mù quáng:** 100% coverage chỉ chứng minh dòng code đã chạy qua, **không** chứng minh assertion đúng, **không** chứng minh race condition/cancellation an toàn, và thường đẩy lập trình viên viết test vô nghĩa cho defensive unreachable code. Ngưỡng 75–85% trên logic lõi kết hợp review test cho nhánh lỗi/hủy hiệu quả hơn nhiều.

### 8.3 Pipeline CI chuẩn cho Node 26 Active LTS và cách diệt flaky tests

Thứ tự job tối ưu cho tốc độ fail-fast và độ tin cậy trên CI:

1. **Pin toolchain & cài đặt tái lập:** Pin Node `26.x` (Active LTS "Lithium"), cài bằng frozen lockfile (`npm ci` / `pnpm install --frozen-lockfile`).
2. **Static checks nhanh:** `tsc --noEmit` (gồm cả `test-types/`), linter, formatter check.
3. **Build (nếu có emit/bundle):** `npm run build` — xác minh sản phẩm xuất bản biên dịch sạch.
4. **Unit + Integration tests:** Chạy `node --test` (có thể bật `--test-randomize` trên nightly/PR để lộ ẩn ý phụ thuộc thứ tự); đo coverage ở job riêng với `NODE_DISABLE_COMPILE_CACHE=1`.
5. **Tarball consumer + `publint` + `attw`** (với library/CLI): Xác minh sản phẩm đóng gói hoạt động đúng ở môi trường consumer độc lập.
6. **Matrix phiên bản Node:** Chỉ thêm Node 24 (Maintenance LTS) vào matrix nếu `"engines"` của package vẫn cam kết hỗ trợ Node 24 — và khi đó phải tránh dùng API chỉ có từ Node 26 mà không có guard/fallback.

**Nguyên tắc diệt flaky tests (đừng dùng retry để giấu lỗi):**

| Nguyên nhân gây flaky | Triệu chứng kinh điển | Cách sửa triệt để |
|---|---|---|
| **Wall-clock / `setTimeout(50)` chờ sự kiện** | Pass máy dev nhanh, fail ngẫu nhiên trên CI tải cao | Đồng bộ bằng `Promise.withResolvers()`, `once(emitter, event)`, `t.waitFor()`, hoặc `t.mock.timers` |
| **Port / file / DB dùng chung** | Fail ngẫu nhiên khi chạy song song nhiều file | Dùng `listen(0, "127.0.0.1")`, `mkdtemp`, DB/schema riêng per test |
| **Quên `await` Promise / subtest** | Test xanh giả hoặc báo lỗi ở test kế tiếp | Luôn `await` mọi `t.test()`, `assert.rejects()`, và `t.after()` async |
| **Leaked handles (keep-alive, timer, worker)** | Suite chạy hết nhưng tiến trình treo tới khi CI timeout | `server.closeAllConnections()`, `res.body?.cancel()`, `worker.terminate()`, truyền `t.signal` |
| **Phụ thuộc múi giờ / locale / path separator OS** | Pass trên Linux UTC, fail trên Windows hoặc máy local `+07` | Đặt `TZ=UTC` khi cần test format ngày; dùng `path.join`, chuẩn hóa `/` trong snapshot |

---

## 9. Anti-patterns và Pitfalls tổng hợp

### 9.1 Bảng chẩn đoán nhanh lỗi kiểm thử thường gặp

| Anti-pattern | Triệu chứng / Hậu quả | Cách sửa chuẩn |
|---|---|---|
| Dùng `t.assert.equal(a, b)` mà tưởng là strict | `t.assert.equal(1, "1")` **PASS** âm thầm | Dùng `t.assert.strictEqual` / `t.assert.deepStrictEqual`, hoặc `import assert from "node:assert/strict"` |
| Gọi `await assert.rejects(fn(bad), Err)` không bọc arrow | Khi `fn` throw sync trước khi trả Promise, lỗi văng khỏi test thay vì khớp matcher | Luôn bọc thunk: `await assert.rejects(() => fn(bad), Err)` |
| Quên `await` trước `assert.rejects(...)` hoặc `t.test(...)` | False green hoặc lỗi *subtest cancelled because parent finished* | Luôn `await` hoặc `return` mọi Promise trong test |
| Gọi `assert.throws(async () => ...)` | Luôn fail vì hàm `async` trả về Promise bị reject chứ không throw sync | Đổi sang `await assert.rejects(async () => ...)` |
| Chạy `node --test file.ts` rồi bỏ qua `tsc --noEmit` | Lỗi kiểu nghiêm trọng lọt lên production vì type stripping không typecheck | Luôn chạy `tsc --noEmit` song song trên CI |
| Destructure `const { setTimeout } = globalThis` ở top-level | `t.mock.timers` không chặn được timer của module đó | Gọi qua `globalThis.setTimeout` hoặc inject `clock`/`sleep` |
| Chỉ kiểm `server.close()` không gọi `closeAllConnections()` | Test HTTP với `fetch` treo 5 giây (keep-alive timeout) mới thoát | Gọi `server.closeAllConnections()` trước `server.close()` trong `t.after` |
| Dọn `tmpdir` bằng `rm(dir, { recursive: true, force: true })` không retry | Thỉnh thoảng fail `EBUSY`/`EPERM` trên Windows | Thêm `maxRetries: 3, retryDelay: 50` |
| Bỏ qua `res.body` của `fetch` trong test | Rò rỉ socket Undici, cảnh báo hoặc treo pool khi đóng | Luôn đọc (`res.text()`/`res.json()`) hoặc `await res.body?.cancel()` |
| Dùng `worker.unref()` thay cho `worker.terminate()` | Worker tiếp tục chạy nền làm nhiễu tài nguyên và sai lệch coverage | Đợi job xong hoặc gọi `await worker.terminate()` trong `t.after` |
| Đo V8 coverage khi `NODE_COMPILE_CACHE` đang bật | Số liệu dòng/nhánh bị thiếu ngẫu nhiên giữa các lần chạy | Đặt `NODE_DISABLE_COMPILE_CACHE=1` trong job coverage |
| Type test chỉ kiểm 1 chiều hoặc dùng `@ts-ignore` | Regression sang `any`/`never` không bị phát hiện | Dùng `Expect<Equal<A, B>>` hai chiều và `@ts-expect-error` |

### 9.2 Đúng vs Sai trong các mẫu kiểm thử dễ trượt

```ts
// SAI: quên await assert.rejects + dùng assert.equal lỏng từ t.assert + bỏ quên body fetch
test("bad test", async (t) => {
  assert.rejects(loadConfig("missing"), { code: "ENOENT" }); // Thiếu await & thiếu () =>
  const res = await fetch(url);
  t.assert.equal(res.status, "200"); // Pass sai vì t.assert.equal ép kiểu!
  // Không đọc hay cancel res.body → leak keep-alive socket
});

// ĐÚNG: await + bọc thunk + strict assertion + đóng/cancel body + truyền t.signal
test("good test", { timeout: 5_000 }, async (t) => {
  await assert.rejects(() => loadConfig("missing"), { code: "ENOENT" });
  const res = await fetch(url, { signal: t.signal });
  t.assert.strictEqual(res.status, 200);
  await res.body?.cancel();
});
```

---

## 10. Checklist và tài liệu liên quan

### 10.1 Checklist trước khi merge PR hoặc release package

```text
□ Đã chạy cả typecheck (`tsc --noEmit` gồm type tests) lẫn runtime tests
□ Mọi test kiểm cả nhánh thành công, nhánh lỗi và nhánh cancellation ở biên I/O
□ Mọi Promise, `t.test(...)` và `assert.rejects(() => ...)` đều được `await`
□ Dùng `node:assert/strict` hoặc `t.assert.strictEqual` / `deepStrictEqual` / `partialDeepStrictEqual`
□ Đăng ký `t.after` ngay khi tạo fixture/server/worker; `rm` có `maxRetries: 3, retryDelay: 50`
□ HTTP test dùng port `0` (`127.0.0.1`), `closeAllConnections()`, và consume/cancel mọi `fetch` body
□ Không dùng `setTimeout` đoán mò để đồng bộ async; fake timers không bị phá bởi top-level destructure
□ Coverage chạy với `NODE_DISABLE_COMPILE_CACHE=1`; không dùng `--test-force-exit` che handle leak
□ Library/CLI: đã chạy `npm pack`, `publint`, `attw`, và consumer test từ tarball thật
□ CI pin Node 26 Active LTS, frozen lockfile, phân biệt rõ file concurrency vs in-file concurrency
```

### 10.2 Tài liệu liên quan

- [exceptions.md](exceptions.md#19-testing-errors) — kiểm lỗi sync/async, `cause`, custom error và assertion patterns
- [abort-context.md](abort-context.md) — `AbortController`, `AbortSignal`, cầu nối HTTP client disconnect và cancellation tests
- [async.md](async.md) — Promise lifecycle, `Promise.withResolvers`, combinators và tránh bỏ rơi Promise
- [nodejs-apis.md](nodejs-apis.md) — `fs/promises`, `http`, streams `pipeline`, Undici và built-ins trên Node 26
- [threading.md](threading.md) — `Worker` threads, `child_process`, shutdown và `terminate`
- [modules-packages.md](modules-packages.md) — ESM/CJS, `"exports"`, dual-package hazard và quy trình publish package
- [tsconfig.md](tsconfig.md) — cấu hình `tsc --noEmit`, type stripping erasable và tách tsconfig build/typecheck
- [tooling.md](tooling.md) — npm/pnpm/yarn, lockfile, CI pipeline và quản lý toolchain
- [Node.js `node:test` documentation](https://nodejs.org/api/test.html) — tài liệu chính thức về execution model, mocks, timers và snapshots
- [Node.js `node:assert` documentation](https://nodejs.org/api/assert.html) — tài liệu chính thức về `assert/strict` và `partialDeepStrictEqual`
