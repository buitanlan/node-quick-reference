# Tài liệu tham khảo Node.js & TypeScript

Bộ tài liệu tham chiếu **in-depth / advanced** cho **Node.js 26** (Current; dự kiến LTS tháng 10/2026) cùng **TypeScript 7** (compiler Go) khi viết ứng dụng phía server / tooling. Không phải giáo trình nhập môn: các khái niệm được trình bày dạng tham khảo kèm semantics, bảng quyết định, pitfalls và version gates. Nếu chưa biết JavaScript/TypeScript, bắt đầu bằng tài liệu chính thức bên dưới, rồi dùng bộ này khi cần tra cứu sâu hơn.

**Baseline:** Node.js **26** + TypeScript **7**. Node **24** vẫn Maintenance LTS trong giai đoạn chuyển — xem [Node 26 & TypeScript 7 highlights](node26-ts7.md).

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

- [Node 26 & TypeScript 7 highlights](node26-ts7.md)
- [Event loop & concurrency model](event-loop.md)
- [Lập trình bất đồng bộ](async.md)
- [AbortSignal & request context](abort-context.md)
- [Worker Threads & Child Process](threading.md)
- [Node.js built-ins (fs, path, http, …)](nodejs-apis.md)
- [npm / pnpm / yarn & tooling](tooling.md)
- [tsconfig & biên dịch TypeScript](tsconfig.md)
