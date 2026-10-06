# Kiểm thử Node.js & TypeScript

Tham khảo kiểm thử trên **Node 26 + TS 7**: hợp đồng runtime, async cleanup, isolation, mocks và package consumers. Typecheck và test runtime kiểm tra hai lớp khác nhau; strip/tsx không thay `tsc --noEmit`.

## Mục lục

- [1. Chọn lớp kiểm thử](#1-chọn-lớp-kiểm-thử)
- [2. `node:test`, discovery và isolation](#2-nodetest-discovery-và-isolation)
- [3. Async, subtest và cleanup](#3-async-subtest-và-cleanup)
- [4. Mocks, fake timers và dependency injection](#4-mocks-fake-timers-và-dependency-injection)
- [5. HTTP, abort, streams và worker](#5-http-abort-streams-và-worker)
- [6. Type tests và kiểm package đã build](#6-type-tests-và-kiểm-package-đã-build)
- [7. Coverage, CI và pitfalls](#7-coverage-ci-và-pitfalls)
- [8. Checklist & tài liệu liên quan](#8-checklist--tài-liệu-liên-quan)

---

## 1. Chọn lớp kiểm thử

| Rủi ro | Test phù hợp | Assertion chính |
|---|---|---|
| Tính toán/validation | Unit, table-driven | Kết quả và biên đầu vào |
| Adapter fs/HTTP/DB | Integration với tài nguyên thật nhỏ | Protocol, lỗi và cleanup |
| Service nhiều dependency | Contract/component test | Request/response, side effect |
| Package public | Consumer fixture từ tarball | Resolution, ESM/CJS, `.d.ts` |
| Generic/overload public | Type tests | Kiểu return, lời gọi bị từ chối |
| Retry/cancellation | Điều khiển clock + fake adapter | Số attempt, budget, không còn việc chạy |

Chọn test từ lỗi có thể xảy ra. Tránh test chỉ lặp lại implementation hoặc snapshot object lớn chứa timestamp/stack không ổn định.

## 2. `node:test`, discovery và isolation

```js
// test/normalize.test.mjs — chạy độc lập
import test from "node:test";
import assert from "node:assert/strict";

test("normalize preserves zero", () => {
  const normalize = (value) => value ?? 10;
  assert.equal(normalize(0), 0);
  assert.equal(normalize(undefined), 10);
});
```

```sh
node --test test/normalize.test.mjs
node --test --test-name-pattern="normalize" test/normalize.test.mjs
node --test --test-concurrency=2 test/a.test.mjs test/b.test.mjs
```

Mặc định các **file** được chạy trong child process riêng; test trong một file có concurrency riêng. `{ concurrency: true }` trên suite không thay giới hạn số process. Env, module singleton và mock không chia sẻ giữa các process; file/database/port ngoài process vẫn có thể tranh chấp. Dùng thư mục tạm riêng và port `0`.

Node 26 chạy `.ts` erasable, nhưng dùng path test tường minh khi cần kiểm soát discovery; decorators/JSX phải qua emit/runner tương thích. Test cùng pipeline production ít nhất một job. [`node:test`](https://nodejs.org/api/test.html#test-runner-execution-model).

## 3. Async, subtest và cleanup

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("file round trip", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "node-ref-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "value.txt");
  await writeFile(file, "ok");
  assert.equal(await readFile(file, "utf8"), "ok");
});
```

Return/await mọi Promise là một phần của test, kể cả `t.test(...)`. Parent kết thúc khi subtest chưa xong có thể làm subtest bị cancel. `t.after` đăng ký cleanup sớm, kể cả assertion sau đó fail. Timeout của runner không tự hủy HTTP/DB/worker đang chạy: truyền `t.signal` cho API hỗ trợ, hoặc tạo controller riêng và đóng tài nguyên.

Lỗi sync: `assert.throws(() => operation())`. Rejection: **await** `assert.rejects(operation(), { code: "..." })`. Đừng dùng `assert.throws(async () => ...)`. Mẫu lỗi sâu ở [exceptions.md](exceptions.md#19-testing-errors).

## 4. Mocks, fake timers và dependency injection

```js
import test from "node:test";
import assert from "node:assert/strict";

test("timer changes state only at deadline", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  let fired = false;
  setTimeout(() => { fired = true; }, 100);
  t.mock.timers.tick(99);
  assert.equal(fired, false);
  t.mock.timers.tick(1);
  assert.equal(fired, true);
  assert.equal(Date.now(), 100);
});
```

`t.mock` phục hồi theo vòng đời test. Fake timers không làm network/syscall hoàn tất và không tự flush mọi Promise continuation. Sau `tick`, await kết quả thực sự mà test đang quan sát. Tránh destructure/capture timer function trước khi mock.

Inject `clock`, `fetch`, `sleep`, storage adapter vào logic nghiệp vụ để test hợp đồng; giữ một integration test dùng adapter thật. ESM bindings không thể tùy tiện gán lại. Module mocking có stability/flag riêng theo bản Node: dùng dependency injection khi không cần kiểm loader. [Mock timers](https://nodejs.org/api/test.html#class-mocktimers).

## 5. HTTP, abort, streams và worker

| Đối tượng | Case cần kiểm |
|---|---|
| HTTP server | Request hoàn tất bình thường không kích abort; response client ngắt mới hủy work |
| HTTP client | 4xx/5xx, body một lần, timeout, redirect, consume/cancel body |
| Abort | Already-aborted, abort giữa I/O, reason tùy biến, cleanup listener |
| Stream | Backpressure, lỗi producer/consumer, đóng sớm, không còn descriptor |
| Worker pool | Worker boot fail/crash, queue đầy, abort job, shutdown |

Dùng server `listen(0, "127.0.0.1")`, lấy port từ `server.address()`, đăng ký `server.close` trong cleanup. Đọc hết body hoặc cancel trước khi đóng. Test timeout nên kiểm việc nền đã được hủy/đóng, không chỉ kiểm Promise ngoài reject. Worker/child phải được terminate/đợi exit; `unref()` không chứng minh cleanup.

## 6. Type tests và kiểm package đã build

```ts
// test/public-types.ts — đưa vào tsconfig typecheck
type UserId = string & { readonly __brand: "UserId" };
declare function loadUser(id: UserId): Promise<{ id: UserId }>;

// @ts-expect-error: raw string không phải UserId
loadUser("unvalidated");
type Returned = Awaited<ReturnType<typeof loadUser>>;
const acceptsId = (value: Returned): UserId => value.id;
```

`@ts-expect-error` báo lỗi khi dòng sau không còn error; `@ts-ignore` không kiểm được điều đó. File type-only này dành cho compiler, không chạy runtime (`declare` không tạo hàm thật).

Library: build → `npm pack --dry-run` → tạo tarball → install tarball vào consumer fixture riêng → typecheck và chạy bằng Node. Consumer chỉ thấy các file được publish; kiểm đúng `exports`, `.d.mts`/`.d.cts` khi dual, và identity singleton trong cùng process. Typecheck source trong monorepo không phát hiện mọi lỗi tarball.

## 7. Coverage, CI và pitfalls

```sh
node --test --experimental-test-coverage test/normalize.test.mjs
```

Coverage built-in vẫn có gate riêng; phần trăm cao không chứng minh race/cancellation đúng. Module compile cache có thể làm coverage V8 kém chính xác: tắt bằng `NODE_DISABLE_COMPILE_CACHE=1` trong job đo coverage. [Compile cache limitations](https://nodejs.org/api/module.html#limitations-of-the-compile-cache).

CI tối thiểu: install frozen lockfile → typecheck → build khi có emit → test → lint. Chỉ thêm Node 24 vào matrix nếu hợp đồng support còn 24; API 26-only cần fallback hoặc gate thực tế. Retry test fail không thay việc sửa fixture dùng chung, clock thật hoặc Promise bị bỏ rơi.

## 8. Checklist & tài liệu liên quan

- Test cả success, lỗi và cancellation ở biên có side effect.
- Mọi Promise được await; fixture, listener, server và worker được đóng.
- File type tests vào `tsconfig`; package test bằng output/tarball thật.
- Pin runtime/toolchain; phân biệt test concurrency và file concurrency.

[Async](async.md) · [Abort & context](abort-context.md) · [Tooling/CI](tooling.md) · [Modules & publishing](modules-packages.md) · [Node test docs](https://nodejs.org/api/test.html).
