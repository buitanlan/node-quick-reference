# Node.js 26 & TypeScript 7 — highlights

Index ngắn các điểm baseline. Chi tiết nằm ở các chương đã đào sâu — **không** lặp lại handbook đầy đủ ở đây (~80–120 dòng cố ý mỏng).

**Baseline:** Node.js **26** (Current; dự kiến LTS **tháng 10/2026**) + TypeScript **7** (compiler native **Go**, GA ~tháng 7/2026). Node **24** vẫn Maintenance LTS trong giai đoạn chuyển.

---

## Mục lục nhanh theo chương

| Chủ đề | Chương |
|---|---|
| Built-ins, fetch, stream, Temporal | [nodejs-apis.md](nodejs-apis.md) |
| `tsconfig`, NodeNext, erasableSyntaxOnly | [tsconfig.md](tsconfig.md) |
| npm/pnpm, runners, CI | [tooling.md](tooling.md) |
| Entry / TLA / shutdown | [main-function.md](main-function.md) |
| Event loop | [event-loop.md](event-loop.md) |
| async / Promise / pipeline | [async.md](async.md) |
| AbortSignal / ALS | [abort-context.md](abort-context.md) |
| Iterator helpers / `Iterator.concat` | [iterables-linq.md](iterables-linq.md) |
| OOP / `#private` / composition | [oop.md](oop.md) |
| Function types / callbacks | [functions-callbacks.md](functions-callbacks.md) |
| Decorators vs strip | [decorators.md](decorators.md) |
| Modules / `node:` / exports | [modules-packages.md](modules-packages.md) |
| Workers / child_process | [threading.md](threading.md) |

---

## Node.js 26 — điểm nổi bật

| Chủ đề | Ghi chú ngắn |
|---|---|
| **V8 / Undici** | V8 **14.6**, Undici **8** (nền `fetch` built-in) |
| **Temporal** | **Temporal** bật mặc định (global) → [nodejs-apis.md](nodejs-apis.md) |
| **Map / WeakMap** | `getOrInsert` / `getOrInsertComputed` → [collections-generics.md](collections-generics.md) |
| **Iterator** | Helpers + `Iterator.from` + **`Iterator.concat`** → [iterables-linq.md](iterables-linq.md) |
| **Type stripping** | Ổn định: `node file.ts`. **Gỡ** `--experimental-transform-types` — chỉ **erasable** |
| **Cleanup** | Legacy stream internals / API đã deprecate lâu bị gỡ — đọc release notes khi nâng từ 24 |

Type stripping **không** type-check và **không** transpile `enum` / `namespace` / decorators / parameter properties → `tsc` / `tsx` / bundler. Khuyến nghị: `erasableSyntaxOnly` + `verbatimModuleSyntax` + **`NodeNext`**.

---

## TypeScript 7 — điểm nổi bật

| Chủ đề | Ghi chú ngắn |
|---|---|
| **Compiler** | Viết lại **Go** — full build thường ~**8–12×** nhanh hơn |
| **Flags mới** | `--checkers`, `--builders`, `--singleThreaded`; `--watch` cải thiện |
| **Defaults chặt** | `strict` mặc định **true**; `moduleResolution` kiểu `node`/`node10`/`classic` **error**; `target: es5` (và vài target cũ) **error** |
| **Module** | Ưu tiên `NodeNext` / `nodenext` / `bundler` |
| **Ngữ nghĩa** | Gần parity **6.0**; headline là **tốc độ** |
| **Programmatic API** | Ổn định ~**7.1**; bridge `@typescript/typescript6` cho tooling cũ |

Packages: `typescript@^7`, `@types/node@^26`. Base: `@tsconfig/node26` (nếu dùng).

---

## Workflow gợi ý

```bash
node src/index.ts                          # erasable
tsc -p tsconfig.json --noEmit              # CI luôn
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

---

## Related

- [nodejs-apis.md](nodejs-apis.md) · [tsconfig.md](tsconfig.md) · [tooling.md](tooling.md)
- [async.md](async.md) · [abort-context.md](abort-context.md) · [event-loop.md](event-loop.md)
- [README.md](README.md) — mục lục toàn bộ
