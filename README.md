# Tài liệu tham khảo Node.js & TypeScript

Bộ tài liệu này được thiết kế như một dạng tài liệu tham khảo, giúp các bạn nắm được các khái niệm và thành phần cốt lõi của **Node.js 26** (Current; dự kiến LTS tháng 10/2026) cùng **TypeScript 7** khi viết ứng dụng phía server / tooling. Vì ở dạng tham khảo nên sẽ có một số khó khăn và không phù hợp với người học từ đầu; nếu chưa biết gì về JavaScript/TypeScript, bạn nên tìm một giáo trình đơn giản hơn (xem bên dưới) và dùng tài liệu này để tham khảo kỹ hơn trong quá trình học.

**Baseline:** Node.js **26** + TypeScript **7** (compiler Go). Node **24** vẫn Maintenance LTS trong giai đoạn chuyển — xem [Node 26 & TypeScript 7 highlights](node26-ts7.md).

---

Tham khảo nếu bạn chưa biết về JS/TS/Node: [MDN JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) · [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) · [Node.js Docs](https://nodejs.org/docs/latest/api/)

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
- [Worker Threads & Child Process](threading.md)
- [Node.js built-ins (fs, path, http, …)](nodejs-apis.md)
- [npm / pnpm / yarn & tooling](tooling.md)
- [tsconfig & biên dịch TypeScript](tsconfig.md)
