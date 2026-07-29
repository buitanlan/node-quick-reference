# Node.js 26 & TypeScript 7 — highlights

Baseline bộ tài liệu: **Node.js 26** (Current; dự kiến vào LTS **tháng 10/2026**) + **TypeScript 7** (GA **tháng 7/2026**, compiler native **Go**). Node **24** vẫn là Maintenance LTS trong giai đoạn chuyển.

Chi tiết sâu: [nodejs-apis.md](nodejs-apis.md) · [tsconfig.md](tsconfig.md) · [tooling.md](tooling.md) · [main-function.md](main-function.md).

---

## Node.js 26

| Chủ đề | Ghi chú ngắn |
|---|---|
| **V8 / Undici** | V8 **14.6**, Undici **8** (nền `fetch` built-in) |
| **Temporal** | API **Temporal** bật mặc định (global) — thay `Date` cho lịch/timezone nghiêm |
| **Map / WeakMap** | `getOrInsert` / `getOrInsertComputed` |
| **Iterator** | `Iterator.concat(...)` (+ iterator helpers đã có từ các bản trước) |
| **Type stripping** | **Ổn định**, mặc định cho `.ts`: `node file.ts`. **Đã gỡ** `--experimental-transform-types` — chỉ cú pháp **erasable** chạy qua strip |

Type stripping **không** type-check và **không** transpile `enum` / `namespace` / decorators / parameter properties → cần `tsc` / `tsx` / bundler. Khuyến nghị tsconfig: `erasableSyntaxOnly` + `verbatimModuleSyntax`.

---

## TypeScript 7

| Chủ đề | Ghi chú ngắn |
|---|---|
| **Compiler** | Viết lại bằng **Go** — full build thường ~**8–12×** nhanh hơn; đa luồng shared-memory |
| **Flags mới** | `--checkers`, `--builders`, `--singleThreaded`; `--watch` cải thiện |
| **Defaults chặt hơn** | Từ deprecation TS 6: `strict` mặc định **true**; `moduleResolution: "node"` / `node10` / `classic` **error**; `target: es5` (và vài target cũ) **error** → ưu tiên `NodeNext` / `nodenext` / `bundler` |
| **Ngữ nghĩa** | Gần parity với **6.0**; headline là **tốc độ** |
| **Programmatic API** | Chưa ổn định đến ~**7.1**; tooling cần API cũ dùng bridge `@typescript/typescript6` (ví dụ typescript-eslint trong giai đoạn chuyển) |

Packages gợi ý: `typescript@^7`, `@types/node@^26`. Có thể dùng `@tsconfig/node26` làm base.

---

## Workflow gợi ý

```bash
# Dev / script erasable
node src/index.ts

# Typecheck CI (luôn)
tsc -p tsconfig.json --noEmit

# Prod emit
tsc -p tsconfig.build.json && node dist/index.js
```

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "noEmit": true,
    "types": ["node"]
  }
}
```
