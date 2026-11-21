# Tài liệu tham khảo Node.js & TypeScript

Bộ tài liệu tham chiếu **in-depth / advanced** cho **Node.js 26 Active LTS** ("Lithium") cùng **TypeScript 7** (compiler native Go) khi viết ứng dụng phía server / tooling. Các chương giải thích semantics, bảng quyết định, pitfalls, vòng đời tài nguyên và version gates. Đây là tài liệu tra cứu sâu; người mới nên bắt đầu bằng tài liệu chính thức bên dưới.

**Mốc rà soát: 2026-11-21.** Baseline là dòng **Node 26 Active LTS + TS 7.0**; tính năng thêm ở minor mới có gate riêng. V8 **14.6** và Undici **8** là mốc release **26.0.0**, không bảo đảm mọi patch giữ cùng version dependency. Type stripping (`node file.ts`) không typecheck, không đọc `tsconfig` và không transform decorator hay cú pháp non-erasable (Node 26 đã gỡ `--experimental-transform-types`); CI cần `tsc --noEmit` cùng kiểm thử bằng pipeline runtime thật. Xem [tsconfig](tsconfig.md), [decorators](decorators.md) và [built-ins](nodejs-apis.md).

| Dòng Node | Trạng thái tại mốc rà soát | Mốc kế tiếp theo lịch |
|---|---|---|
| 26 (*Lithium*) | **Active LTS** (từ **2026-10-28**, v26.13.0+) | Maintenance LTS **2027-10-20** · EOL **2029-04-30** |
| 24 | Maintenance LTS (từ **2026-10-20**) | End of life **2028-04-30** |
| 22 | Maintenance LTS | End of life **2027-04-30** |

Theo [lịch Node Release](https://github.com/nodejs/Release/blob/main/schedule.json). Lịch có thể thay đổi; package hỗ trợ nhiều dòng phải kiểm `engines`, minor tối thiểu và CI matrix.

---

Tham khảo chính thức: [MDN JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) · [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) · [Node.js Docs](https://nodejs.org/docs/latest/api/) · [Node.js 26 release](https://nodejs.org/en/blog/release/v26.0.0/)

---

## Nội dung

### TypeScript / ngôn ngữ

- [Entry point & chạy chương trình](main-function.md)
- [Hệ thống kiểu dữ liệu](typesystem.md)
- [Literal](literals.md)
- [Toán tử](operators.md)
- [Từ khóa](keywords.md)
- [Phát biểu](statements.md)
- [Hàm & Method](functions-methods.md)
- [Function type, Callback & Lambda](functions-callbacks.md)
- [Exception / Error](exceptions.md)
- [Lập trình hướng đối tượng trong TypeScript](oop.md)
- [Tập hợp & Generics](collections-generics.md)
- [Iterator, Iterable & “LINQ-like”](iterables-linq.md)
- [Modules & Packages](modules-packages.md)
- [Decorators & Metadata](decorators.md)

### Node.js / runtime

- [Event loop & concurrency model](event-loop.md)
- [Lập trình bất đồng bộ](async.md)
- [AbortSignal & request context](abort-context.md)
- [Worker Threads & Child Process](threading.md)
- [Node.js built-ins (fs, path, http, …)](nodejs-apis.md)
- [npm / pnpm / yarn & tooling](tooling.md)
- [tsconfig & biên dịch TypeScript](tsconfig.md)

### Kiểm thử / vận hành / bảo mật

- [Kiểm thử Node.js & TypeScript](testing.md)
- [Debugging, diagnostics & hiệu năng](diagnostics.md)
- [Bảo mật ở biên Node.js](security.md)

## Tra cứu theo công việc

| Khi cần | Các chương phối hợp |
|---|---|
| Thiết kế type/API public | [Types](typesystem.md), [function contracts](functions-callbacks.md), [collections/generics](collections-generics.md), [type tests](testing.md#6-type-tests-và-kiểm-package-đã-build) |
| Chọn strip, emit hoặc runner | [Entry point](main-function.md), [tsconfig](tsconfig.md), [modules](modules-packages.md), [decorators](decorators.md) |
| Xử lý HTTP, cancellation, shutdown | [Built-ins](nodejs-apis.md), [async](async.md), [abort/context](abort-context.md), [errors](exceptions.md) |
| Giới hạn CPU, queue, memory và latency | [Event loop](event-loop.md), [workers](threading.md), [diagnostics](diagnostics.md) |
| Viết test, mocks, snapshots, coverage & CI | [Testing](testing.md), [error tests](exceptions.md#19-testing-errors), [tooling/CI](tooling.md), [abort/context](abort-context.md) |
| Bảo mật API, crypto, SSRF, FS & hardening biên | [Security](security.md), [filesystem guards](security.md#3-filesystem-traversal-symlink-và-toctou), [permission model](security.md#7-permission-model-isolation-và-supply-chain), [built-ins](nodejs-apis.md) |
| Phát hành package hoặc CLI | [Modules/publishing](modules-packages.md), [tooling/CI](tooling.md), [consumer tests](testing.md#6-type-tests-và-kiểm-package-đã-build), [security](security.md) |

Phạm vi là JavaScript/TypeScript và Node core. Framework, ORM, cloud và distributed systems chỉ được nhắc khi cần để hiểu hợp đồng ở biên; hướng dẫn đầy đủ cho từng sản phẩm nên là tài liệu riêng.

## Bảo trì tài liệu

[Báo cáo rà soát](content-audit.md) ghi kết quả theo từng chương, các chỉnh sửa kỹ thuật, mở rộng độ sâu và giới hạn xác minh. Mục lục của tất cả 24 chương bao gồm đầy đủ cả chủ đề con H2–H4.

```sh
node scripts/check-docs.mjs
node --test tests/reference-examples.test.mjs
```

Checker kiểm tất cả Markdown ở root: file/anchor nội bộ, chỉ mục README, mục lục H2–H4, số thứ tự chủ đề và code fence. Test trích code block thật từ tài liệu để kiểm pool async (`async.md`), HTTP cancellation (`abort-context.md`), guards validation/path biên Windows & POSIX (`security.md`), duyệt cây `SuppressedError`/`cause` vòng (`exceptions.md`), `throttle` (`functions-callbacks.md`), duyệt graph có cycle (`functions-methods.md`), diagnostic report an toàn (`diagnostics.md`) và toàn bộ 5 module `node:test` độc lập (`testing.md`); chạy kiểm chứng trên **Node 26** và chỉ strip type, không thay thế `tsc --noEmit`. Khi cập nhật API, ghi minor/stability cần thiết và dẫn nguồn chính thức; tránh suy ra tính năng có ở toàn bộ major từ docs của minor mới nhất.
