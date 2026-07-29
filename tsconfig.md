# tsconfig & biên dịch TypeScript

`compilerOptions` then chốt cho Node ESM, type stripping, và project references trên **TypeScript 7** + **Node.js 26**.

> Mục tiêu phổ biến: `module` / `moduleResolution`: **`NodeNext`**, `strict: true` (mặc định TS 7), và chọn rõ workflow **strip-types** vs **`tsc` emit** vs **tsx**. Xem [node26-ts7.md](node26-ts7.md) · [tooling.md](tooling.md).

---

## Mục lục

1. [Vai trò `tsconfig.json`](#1-vai-trò-tsconfigjson)
2. [Skeleton khuyến nghị (Node ESM)](#2-skeleton-khuyến-nghị-node-esm)
3. [`module` & `moduleResolution`](#3-module--moduleresolution)
4. [`target`, `lib`, JSX](#4-target-lib-jsx)
5. [`strict` và an toàn kiểu](#5-strict-và-an-toàn-kiểu)
6. [`verbatimModuleSyntax`](#6-verbatimmodulesyntax)
7. [`erasableSyntaxOnly` & type stripping](#7-erasablesyntaxonly--type-stripping)
8. [`noEmit` / emit / `outDir`](#8-noemit--emit--outdir)
9. [Ba cách chạy TypeScript trên Node](#9-ba-cách-chạy-typescript-trên-node)
10. [`@types/node`](#10-typesnode)
11. [Path aliases vs runtime](#11-path-aliases-vs-runtime)
12. [Project references](#12-project-references)
13. [Best practices](#13-best-practices)
14. [Checklist](#14-checklist)
15. [Cheat sheet](#15-cheat-sheet)
16. [Version notes](#16-version-notes)
17. [Tài liệu liên quan](#17-tài-liệu-liên-quan)

---

## 1. Vai trò `tsconfig.json`

- Bảo TypeScript **cách kiểm tra kiểu** và (tuỳ chọn) **emit** JS / `.d.ts`.
- Editor đọc `tsconfig` cho IntelliSense.
- Không thay `package.json` `"type"` — module runtime vẫn do Node quyết định.

Nhiều file: `tsconfig.json` (base), `tsconfig.build.json` (emit), `tsconfig.eslint.json` (scope lint).

---

## 2. Skeleton khuyến nghị (Node ESM)

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitOverride": true,
    "types": ["node"],
    "rewriteRelativeImportExtensions": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

Điều chỉnh theo workflow:

- **Chỉ typecheck + Node strip / tsx:** `"noEmit": true` (+ có thể `erasableSyntaxOnly`).
- **Library publish:** `declaration: true`, `declarationMap`, có thể `composite`.

`rewriteRelativeImportExtensions`: cho phép viết `from "./foo.ts"` và emit thành `.js` — hữu ích một số setup; với Node thuần cổ điển vẫn hay viết `./foo.js` trong nguồn `.ts`.

Base cộng đồng: `"extends": "@tsconfig/node26/tsconfig.json"` rồi override.

### TypeScript 7 — defaults / lỗi cứng hơn

- `strict` mặc định **true**.
- `moduleResolution: "node"` / `node10` / `classic` → **error**; dùng `NodeNext` / `nodenext` / `bundler`.
- `target: es5` (và vài target cũ) → **error**; với Node 26 ưu tiên **ES2024** / **ESNext**.
- Ngữ nghĩa ngôn ngữ gần parity **6.0**; headline tốc độ compiler Go (~8–12× full build; `--checkers` / `--builders` / `--singleThreaded`).
- Programmatic compiler API ổn định khoảng **7.1**; tooling API cũ → `@typescript/typescript6`.

---

## 3. `module` & `moduleResolution`

| Giá trị | Khi dùng |
|---|---|
| `NodeNext` | **Khuyến nghị** app/lib Node hiện đại |
| `Node16` | Neo luật Node 16; thường chọn `NodeNext` |
| `ESNext` + `bundler` | Emit cho bundler |
| `CommonJS` | Legacy CJS only |
| `"node"` / `node10` / `classic` | **Lỗi trên TS 7** |

Với `NodeNext`:

- Relative import cần đuôi phù hợp (thường `.js` trong import path).
- Tôn trọng `package.json` `exports` / `"type"`.

```ts
import { readFile } from "node:fs/promises";
import { helper } from "./helper.js"; // trỏ helper.ts nguồn
```

---

## 4. `target`, `lib`, JSX

- `target`: phiên bản JS **emit** (hoặc giả định runtime nếu `noEmit`).
- Node 26 hiểu ES2024+ khá đầy đủ → `ES2024` hoặc `ESNext`.
- Đừng thêm DOM `lib` trừ khi share browser hoặc dùng API DOM cố ý.
- Temporal: theo dõi `lib` / `@types/node` — có thể cần ambient nếu global chưa có trong types.
- `jsx` chỉ khi React/JSX.

---

## 5. `strict` và an toàn kiểu

Trên **TS 7**, `strict` mặc định **true** — gồm `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis`, `alwaysStrict`, `useUnknownInCatchVariables`, …

Bổ sung hay dùng:

```json
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

`strictFunctionTypes` ảnh hưởng variance callback — [functions-callbacks.md](functions-callbacks.md).

### 5.1 Tắt từng flag? (không khuyến nghị)

Trên codebase migrate, đôi khi tạm tắt `strictPropertyInitialization` hoặc trì hoãn `noUncheckedIndexedAccess`. **Đừng** tắt cả `strict` trên TS 7 rồi quên bật lại — ghi TODO/issue. Prefer enable dần theo package trong monorepo (`references` + tsconfig riêng) hơn một `strict: false` toàn repo.

### 5.2 IsolatedDeclarations / declaration emit (tóm tắt)

Khi publish `.d.ts` và muốn emit nhanh/an toàn hơn, theo dõi option kiểu `isolatedDeclarations` (TS 5.5+) — yêu cầu type annotation đủ trên export để generate declarations không cần inference toàn chương trình. Hữu ích monorepo lớn; có thể ồn trên codebase cũ — bật có chủ đích.

Không bắt buộc cho app nội bộ chỉ `noEmit` + strip.

---

## 6. `verbatimModuleSyntax`

```json
{ "compilerOptions": { "verbatimModuleSyntax": true } }
```

```ts
import type { User } from "./types.js";
import { createUser } from "./user.js";

export type { User };
export { createUser };
```

Tránh import giá trị bị xóa nhầm lúc emit / strip. Kết hợp tốt với ESM và type stripping.

---

## 7. `erasableSyntaxOnly` & type stripping

```json
{
  "compilerOptions": {
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "noEmit": true
  }
}
```

Khi bật, TypeScript **cấm** cú pháp không xóa sạch bằng strip:

| Tránh (khi erasable) | Dùng thay |
|---|---|
| `enum` | `as const` object + type |
| Parameter properties | field tường minh |
| `namespace` / `module` (non-ESM) | ES modules |
| Decorators | bỏ hoặc chuyển pipeline `tsc`/`tsx` |

Mục tiêu: `.ts` chạy được trên Node type stripping mà không cần transpile đầy đủ. Chi tiết decorator: [decorators.md](decorators.md). OOP fields: [oop.md](oop.md).

---

## 8. `noEmit` / emit / `outDir`

| Option | Ý nghĩa |
|---|---|
| `noEmit: true` | Chỉ typecheck |
| `emitDeclarationOnly` | Chỉ `.d.ts` (JS do bundler) |
| `outDir` / `rootDir` | Cấu trúc emit |
| `sourceMap` | Debug |
| `declaration` | Library types |

```json
{
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "build": "tsc -p tsconfig.build.json"
  }
}
```

---

## 9. Ba cách chạy TypeScript trên Node

### 9.1 Node type stripping

Trên **Node 26**, type stripping **ổn định** cho `.ts`:

```bash
node src/index.ts
```

- **Không** type-check; **không** transpile syntax “thừa”.
- Đã gỡ `--experimental-transform-types`.
- Vẫn nên `tsc --noEmit` trên CI.
- Khuyến nghị: `erasableSyntaxOnly` + `verbatimModuleSyntax`.

### 9.2 `tsc` emit

```bash
tsc -p tsconfig.json
node dist/index.js
```

Kiểm soát tối đa; phù hợp production và thư viện. Tôn trọng `module: NodeNext`.

### 9.3 `tsx` (dev)

```bash
tsx src/index.ts
tsx watch src/index.ts
```

Transpile nhanh (esbuild); **không** thay typecheck.

| Môi trường | Gợi ý |
|---|---|
| Dev UX | `tsx watch` hoặc Node strip + `--watch` |
| CI | `tsc --noEmit` (+ test) |
| Prod | `tsc` hoặc bundler → `node dist/...` |

---

## 10. `@types/node`

```bash
pnpm add -D typescript@^7 @types/node@^26
```

```json
{
  "compilerOptions": {
    "types": ["node"]
  }
}
```

Major `@types/node` khớp major Node (**26** → `@types/node@^26`). App Node thực tế **luôn** nên có.

---

## 11. Path aliases vs runtime

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

`paths` **không** được Node hiểu khi chạy `node dist/...` trừ khi:

- `package.json` `#imports`,
- bundler/loader rewrite,
- hoặc tránh alias — relative / `#lib/...`.

Chi tiết: [modules-packages.md](modules-packages.md).

---

## 12. Project references

```json
{
  "files": [],
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/api" }
  ]
}
```

```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

```bash
tsc -b
tsc -b --clean
tsc -b -w
```

`composite: true` bắt buộc cho project được reference. Không bắt buộc cho app nhỏ một package.

### 12.1 `tsconfig` tách build vs typecheck

```json
// tsconfig.json — editor + CI typecheck
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

```json
// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

### 12.2 Incremental

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

Hữu ích monorepo / CI cache; gitignore file build info nếu không chia sẻ artifact. Kết hợp `tsc -b` khi dùng project references.

---

## 13. Best practices

1. `NodeNext` + `"type": "module"` khi chọn ESM.
2. Giữ `strict` + `verbatimModuleSyntax`.
3. Chọn một workflow strip vs emit; đừng nửa nạc.
4. Strip? → `erasableSyntaxOnly`; tránh enum/namespace/decorators/param props.
5. CI luôn `tsc --noEmit`.
6. `@types/node@^26` với baseline Node 26.
7. Alias runtime qua `#imports`, không chỉ `paths`.
8. `noImplicitOverride` khi dùng class hierarchy.
9. Tách `tsconfig.build.json` nếu dev `noEmit` nhưng prod emit.
10. Tooling API cũ → bridge cho tới ~TS 7.1.

---

## 14. Checklist

```text
□ "type": "module" (nếu ESM)
□ module / moduleResolution: NodeNext
□ strict + verbatimModuleSyntax
□ Strip? erasableSyntaxOnly + noEmit + tránh non-erasable
□ Emit? outDir + declaration nếu publish
□ typescript@^7, @types/node@^26
□ CI: tsc --noEmit
□ Alias runtime → #imports
□ noImplicitOverride / noUncheckedIndexedAccess cân nhắc
□ Không dùng moduleResolution node/classic (TS 7 error)
```

---

## 15. Cheat sheet

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

```bash
tsc --noEmit
tsc -p tsconfig.build.json
node src/index.ts
```

| Option | Việc |
|---|---|
| `NodeNext` | ESM/CJS theo package.json |
| `erasableSyntaxOnly` | Khớp Node strip |
| `verbatimModuleSyntax` | `import type` tường minh |
| `noEmit` | Typecheck-only |
| `composite` | Project references |

---

## 16. Version notes

| Nền | Liên quan |
|---|---|
| TS 5+ | `verbatimModuleSyntax`, Stage 3 decorators |
| TS 5.8+ / gần đây | `erasableSyntaxOnly` (theo dõi đúng minor bạn dùng) |
| **TS 7** | `strict` default; cấm `moduleResolution` cũ; compiler Go; API ~7.1 |
| Node 22.6+ | type stripping experimental |
| **Node 26** | strip ổn định; không transform-types |
| `@types/node` | major khớp Node |

Baseline: **Node 26** + **TS 7**.

---

## 17. Tài liệu liên quan

- [Node 26 & TypeScript 7 highlights](node26-ts7.md)
- [Modules & Packages](modules-packages.md)
- [npm / pnpm / yarn & tooling](tooling.md)
- [Decorators & Metadata](decorators.md)
- [Lập trình hướng đối tượng](oop.md) — parameter properties / override
- [Function type, Callback & Lambda](functions-callbacks.md) — `strictFunctionTypes`
- [Entry point & chạy chương trình](main-function.md)
