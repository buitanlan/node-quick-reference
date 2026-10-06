# Rà soát nội dung theo mục tiêu README

Mốc: **2026-10-06**. Phạm vi: toàn bộ **21 chương ban đầu**, cấu trúc các chủ đề con, mục lục, liên kết và các hợp đồng/version gates quan trọng cho server/tooling. Mục tiêu đối chiếu là tài liệu tham chiếu advanced: semantics, quyết định dùng API, pitfalls, vòng đời tài nguyên và giới hạn phiên bản.

Các chương ngôn ngữ đã phủ rộng. Khoảng trống rõ nhất là kiểm thử, bảo mật ở biên và chẩn đoán vận hành; ba chương này đã được thêm. Các bổ sung trong chương cũ tập trung vào chỗ dễ áp dụng sai, không mở rộng thành hướng dẫn framework/ORM/cloud đầy đủ.

## Kết quả từng chương

| Chương | Kết quả rà soát / cập nhật |
|---|---|
| [Entry point](main-function.md) | Đủ entry/CLI/shutdown; sửa pipeline dùng cùng nguồn cho strip và emit: import `.ts`, rewrite khi build; cập nhật mốc LTS. |
| [Typesystem](typesystem.md) | Đủ hệ kiểu nâng cao; sửa số kết quả `typeof`, contextual typing của `satisfies`, `Omit` trên union; thêm TS 7 template inference theo code point và giới hạn alias của `as const`. |
| [Literals](literals.md) | Đủ literal/Unicode/JSON; làm rõ `undefined` là giá trị, dot Unicode với lone surrogate; thêm `RegExp.escape` cho pattern động. |
| [Operators](operators.md) | Đủ operator/coercion; sửa loose equality đối xứng, `in` không box primitive; phân biệt precedence/associativity và thứ tự đánh giá operand. |
| [Keywords](keywords.md) | Đã phủ từ khóa runtime/TS/contextual phù hợp scope; sửa mục lục modifier và đưa các chủ đề con vào mục lục. |
| [Statements](statements.md) | Đã phủ control flow, ASI, `finally`, ERM; sửa liên kết chương ERM và cách ghi version để không gọi ERM là ES2024. |
| [Functions & methods](functions-methods.md) | Sửa callback `this` của EventEmitter, optional parameter, `toString`, wrapper arity, Proxy/private brand, tagged method và eval scope; đưa ghi chú cuối file về đúng mục. |
| [Callbacks & function types](functions-callbacks.md) | Sửa inferred predicate từ TS 5.5, timing/arity, `callbackify`, return `void` vs `Promise<void>` và capture rejections; đưa các mục con về đúng parent. |
| [Exceptions](exceptions.md) | Đã có phân loại/cause, Promise/EventEmitter/stream/worker, ERM và error tests; sửa liên kết ERM/version, thứ tự các mục con. Liên kết thêm chương kiểm thử. |
| [OOP](oop.md) | Đã phủ class initialization, private/structural typing, variance, inheritance và disposables; chỉnh liên kết ERM/version, thứ tự mục con. |
| [Collections & generics](collections-generics.md) | Sửa readonly/collection assignability, utility types trên union, `satisfies`, Map như set-like và TypedArray sort (`NaN`, signed zero). |
| [Iterables](iterables-linq.md) | Sửa inferred guards, `find` có thể trả giá trị falsy, iterator cleanup khi `next` reject, ranh giới `SuppressedError`; cập nhật gates API mới. |
| [Modules & packages](modules-packages.md) | Sửa syntax detection `.js`, specifier strip/emit, số mục trùng; thêm kiểm identity dual package, sync/async loader hooks và compile cache. |
| [Decorators](decorators.md) | Sửa sai lệch lớn: `erasableSyntaxOnly` **không cấm decorator**, Node strip mới không parse; làm rõ helpers emit, evaluation/application order và `Symbol.metadata`. |
| [Event loop](event-loop.md) | Thêm gate libuv 1.45/Node 20 cho timers sau poll; giữ caveat thứ tự timer/immediate và mốc đo ELU/delay. |
| [Async](async.md) | Bổ sung kiểm giới hạn `mapPool`, ngừng cấp job sau lỗi; thêm retry deadline/idempotency/concurrency budget; sửa cấp heading và gates ERM/Promise API. |
| [Abort & context](abort-context.md) | Sửa lỗi abort mọi `req.close`: kiểm request bị cắt và response chưa finish; tách disconnect/deadline, sửa bảng API có signal; thêm `AsyncResource` cho custom pool. |
| [Threading](threading.md) | Sửa module `child_process/promises` không tồn tại và IPC không có `drain`; làm rõ structured clone; TCP worker transfer theo docs 26.10, không suy ra mọi 26.x/24. |
| [Built-ins](nodejs-apis.md) | Sửa HWM theo OS/subclass và Undici duplex; thêm atomic write/durability, DNS, TCP/TLS framing, zlib/readline budgets, SQLite RC và VM boundary. |
| [Tooling](tooling.md) | Corepack không bundled Node 26; sửa thứ tự pnpm/setup-node cache, action versions được đối chiếu; sửa kế hoạch compiler API thành gate cần xác minh. |
| [TSConfig](tsconfig.md) | Sửa inheritance, extension rewrite, `isolatedModules`, decorator/erasable và `baseUrl`; thêm defaults `types`/`rootDir` và bridge CLI TS 7 với tool cần API TS 6. |

## Ba chương bổ sung

| Chương | Khoảng trống được bổ sung |
|---|---|
| [Testing](testing.md) | Test layers, isolation/concurrency, async cleanup, mocks/clock, HTTP/abort/worker cases, type tests, tarball consumers, coverage/CI. |
| [Security](security.md) | Runtime validation/authorization, injection, prototype pollution, path/symlink/TOCTOU, SSRF/DNS/redirect, resource budgets, secrets/TLS, permissions/isolation/supply chain. |
| [Diagnostics](diagnostics.md) | Công cụ theo triệu chứng, Inspector/source maps, CPU profile, heap/RSS/native memory, reports/handles, context/log/tracing, benchmark và compiler diagnostics. |

## Điều hướng và kiểm tra tự động

Mục lục các chương liệt kê cả chủ đề con; mục con bị đặt nhầm chương hoặc đảo số đã được sửa. README thêm chỉ mục ba chương, bảng tra cứu theo công việc và lịch LTS có ngày cụ thể.

```sh
node scripts/check-docs.mjs
node --test tests/reference-examples.test.mjs
```

Checker kiểm tất cả Markdown ở root: file/anchor nội bộ, chỉ mục README, mục lục H2–H4, code fence, số mục trùng/sai parent/sai thứ tự. Không cần package install. Liên kết nguồn web được đối chiếu ở những phần đã cập nhật; checker chỉ kiểm liên kết nội bộ.

**Kết quả:** kiểm tra cấu trúc qua; **9/9 test runtime qua** trên Node 24.19.0. Test trích code block trong tài liệu: pool giữ thứ tự/giới hạn concurrency, input limit/abort sớm, ngừng cấp job sau lỗi, HTTP request bình thường/disconnect, guards validation/path, và ba ví dụ test độc lập. `stripTypeScriptTypes` phát experimental warning trên runtime này; đây chỉ là parse/strip, không phải kiểm kiểu TS 7.

## Nguồn và giới hạn xác minh

Phiên bản được đối chiếu với [Node 26.0 release](https://nodejs.org/en/blog/release/v26.0.0/), [lịch Node](https://github.com/nodejs/Release/blob/main/schedule.json), [Node API docs](https://nodejs.org/api/) (hiển thị 26.10.0 tại mốc rà soát), [TS 7.0 release](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [TS 6 migration](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html) và [TSConfig erasableSyntaxOnly](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html). Nguồn cho từng hợp đồng đặt cạnh nội dung trong chương.

Rà soát toàn bộ cấu trúc/chủ đề không đồng nghĩa đã thực thi mọi code block có sẵn. Ví dụ tham khảo có thể dùng biến/factory giả định hoặc là đoạn minh họa lỗi có chủ đích. Môi trường kiểm tra cục bộ có **Node 24.19.0**, chưa có compiler TS 7; chỉ các ví dụ runtime được chọn đã chạy trên Node 24, các API riêng của Node 26/TS 7 được đối chiếu tài liệu chính thức. Không tuyên bố toàn bộ ví dụ đã qua Node 26 hoặc `tsc`.

Các hướng mở rộng sau này, khi có nhu cầu cụ thể: framework HTTP/DI, database/ORM và transaction phân tán, triển khai/container/platform, Node-API/native addons. Chúng nên là chương riêng với baseline và hợp đồng support rõ ràng; bộ hiện tại tập trung Node core và ngôn ngữ theo [mục tiêu README](README.md).
