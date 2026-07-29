# tsconfig & biên dịch TypeScript

*(compilerOptions then chốt cho Node ESM, type stripping, project references)*

Baseline: **TypeScript 7** (compiler Go), chạy trên **Node.js 26** (ESM-first). Mục tiêu phổ biến: `module` / `moduleResolution`: **`NodeNext`**, `strict: true` (mặc định từ TS 7), và chọn rõ workflow **strip-types** vs **`tsc` emit** vs **tsx**. Xem [node26-ts7.md](node26-ts7.md).

---

## Mục lục

- [tsconfig \& biên dịch TypeScript](#tsconfig--biên-dịch-typescript)
  - [Mục lục](#mục-lục)
  - [1. Vai trò `tsconfig.json`](#1-vai-trò-tsconfigjson)
  - [2. Skeleton khuyến nghị (Node ESM)](#2-skeleton-khuyến-nghị-node-esm)
  - [3. `module` \& `moduleResolution`](#3-module--moduleresolution)
  - [4. `target`, `lib`, JSX](#4-target-lib-jsx)
  - [5. `strict` và an toàn kiểu](#5-strict-và-an-toàn-kiểu)
  - [6. `verbatimModuleSyntax`](#6-verbatimmodulesyntax)
  - [7. `erasableSyntaxOnly` \& type stripping](#7-erasablesyntaxonly--type-stripping)
  - [8. `noEmit` / `emitDeclarationOnly` / `outDir`](#8-noemit--emitdeclarationonly--outdir)
  - [9. Ba cách chạy TypeScript trên Node](#9-ba-cách-chạy-typescript-trên-node)
    - [9.1 Node type stripping](#91-node-type-stripping)
    - [9.2 `tsc` emit](#92-tsc-emit)
    - [9.3 `tsx` (dev)](#93-tsx-dev)
  - [10. `@types/node`](#10-typesnode)
  - [11. Path aliases vs runtime](#11-path-aliases-vs-runtime)
  - [12. Project references (tóm tắt)](#12-project-references-tóm-tắt)
  - [13. Checklist nhanh](#13-checklist-nhanh)

---

## 1. Vai trò `tsconfig.json`

- Bảo TypeScript **cách kiểm tra kiểu** và (tuỳ chọn) **emit** JS / `.d.ts`.
- Editor (VS Code / GoLand) đọc `tsconfig` để IntelliSense.
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
    "types": ["node"],
    "rewriteRelativeImportExtensions": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

Điều chỉnh theo workflow:

- **Chỉ typecheck + Node strip / tsx:** thêm `"noEmit": true` (và có thể `erasableSyntaxOnly`).
- **Library publish:** `declaration: true`, `declarationMap`, có thể `composite`.

`rewriteRelativeImportExtensions`: cho phép viết `from "./foo.ts"` và emit thành `.js` — hữu ích một số setup; với Node thuần cổ điển vẫn hay viết `./foo.js` trong nguồn `.ts`.

Có thể kế thừa base: `"extends": "@tsconfig/node26/tsconfig.json"` rồi override theo workflow.

**TypeScript 7 — defaults / lỗi cứng hơn** (từ deprecation TS 6):

- `strict` mặc định **true**.
- `moduleResolution: "node"` / `node10` / `classic` → **error**; dùng `NodeNext` / `nodenext` / `bundler`.
- `target: es5` (và vài target cũ) → **error**; với Node 26 ưu tiên **ES2024** / **ESNext**.
- Ngữ nghĩa ngôn ngữ gần parity **6.0**; headline là tốc độ compiler Go (~8–12× full build, `--checkers` / `--builders` / `--singleThreaded`).
- Programmatic compiler API ổn định khoảng **7.1**; tooling cần API cũ dùng bridge `@typescript/typescript6`.

---

## 3. `module` & `moduleResolution`

| Giá trị | Khi dùng |
|---|---|
| `NodeNext` | **Khuyến nghị** app/lib chạy trên Node hiện đại (theo `package.json` type/exports) |
| `Node16` | Tương tự, neo theo luật Node 16; thường chọn `NodeNext` |
| `ESNext` + bundler | Khi emit cho bundler; kèm `moduleResolution: "bundler"` |
| `CommonJS` | Legacy CJS only |
| `"node"` / `node10` / `classic` | **Lỗi trên TS 7** — đừng dùng |

Với `NodeNext`:

- Relative import cần đuôi phù hợp (thường `.js` trong import path).
- Tôn trọng `package.json` `exports` / `"type"`.
- `require` vs `import` được type-check theo ngữ cảnh file.

```ts
// trong .ts emit ESM
import { readFile } from "node:fs/promises";
import { helper } from "./helper.js"; // trỏ tới helper.ts nguồn
```

---

## 4. `target`, `lib`, JSX

- `target`: phiên bản JS **emit** (hoặc giả định runtime nếu `noEmit`).
- Node 26 hiểu ES2024+ khá đầy đủ → `target`/`lib` **ES2024** hoặc **ESNext** hợp lý.
- Đừng thêm DOM `lib` trừ khi share code browser hoặc dùng API DOM cố ý.
- `jsx` chỉ khi có React/JSX; service API thuần thì bỏ.

---

## 5. `strict` và an toàn kiểu

Trên **TS 7**, `strict` mặc định **true**. `"strict": true` bật nhóm:

- `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`,
- `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis`,
- `alwaysStrict`, `useUnknownInCatchVariables`, …

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

Bật dần trên codebase cũ nếu quá ồn.

---

## 6. `verbatimModuleSyntax`

```json
{ "compilerOptions": { "verbatimModuleSyntax": true } }
```

Ép import/export **giống runtime**:

```ts
// type-only phải ghi rõ
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

Khi bật, TypeScript **cấm** cú pháp không chỉ là type annotation / không xóa sạch được bằng strip, ví dụ điển hình:

- `enum`
- `namespace` / `module` (non-ESM),
- parameter properties trong constructor (`constructor(public x: number)`),
- một số dạng decorators / syntax experimental tùy phiên bản.

Mục tiêu: file `.ts` **chạy được** trên Node type stripping (chỉ bỏ types) mà không cần transpile đầy đủ.

Thay thế thường dùng:

| Tránh (khi erasable) | Dùng thay |
|---|---|
| `enum` | `as const` object + type |
| Parameter props | khai báo field tường minh |
| `namespace` | ES modules |

---

## 8. `noEmit` / `emitDeclarationOnly` / `outDir`

| Option | Ý nghĩa |
|---|---|
| `noEmit: true` | Chỉ typecheck (CI, strip-types, tsx) |
| `emitDeclarationOnly` | Chỉ `.d.ts` (khi JS do bundler tạo) |
| `outDir` / `rootDir` | Cấu trúc emit |
| `sourceMap` | Debug |
| `declaration` | Xuất kiểu cho library |

Script CI phổ biến:

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

Từ Node **22.6** (experimental) → ổn định qua 24 → trên **Node 26** type stripping **ổn định và mặc định** cho `.ts`:

```bash
node src/index.ts
```

Node 26 **đã gỡ** `--experimental-transform-types`. Chỉ cú pháp **erasable** (annotation, `interface`/`type`, generics erasable, `satisfies`…) chạy qua strip. `enum` / `namespace` / decorators / parameter properties → `tsc` / `tsx` / bundler.

Đặc điểm:

- **Không** type-check; **không** transpile syntax “thừa”.
- Nhanh cho dev/simple deploy; vẫn nên `tsc --noEmit` trên CI.
- Khuyến nghị: `erasableSyntaxOnly` + `verbatimModuleSyntax` để fail sớm trong editor.

### 9.2 `tsc` emit

```bash
tsc -p tsconfig.json
node dist/index.js
```

- Kiểm soát tối đa, phù hợp production cổ điển và thư viện.
- Emit tôn trọng `module: NodeNext`.
- Có thể thêm bundler (esbuild/tsup) nếu cần single file / minify.

### 9.3 `tsx` (dev)

```bash
tsx src/index.ts
tsx watch src/index.ts
```

- Transpile nhanh (esbuild), chạy hầu hết cú pháp TS.
- Thuận tiện local; **không** thay typecheck — vẫn chạy `tsc --noEmit`.
- Production: thường emit bằng `tsc`/bundler thay vì dựa tsx.

**Tóm tắt chọn:**

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

- Cung cấp type cho `process`, `Buffer`, `node:fs`, … và globals Node.
- Version **major** `@types/node` nên khớp major Node bạn target (**Node 26** → `@types/node@^26`).
- Không cần `@types/node` nếu chỉ dùng typed package thuần và không đụng builtin — nhưng app Node thực tế **luôn** nên có.

`/// <reference types="node" />` hiếm khi cần nếu `types`/`typeRoots` đã đúng.

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

- dùng `package.json` `#imports`,
- hoặc bundler/loader rewrite,
- hoặc tránh alias, dùng relative / `#lib/...`.

Chi tiết: [modules-packages.md](modules-packages.md).

---

## 12. Project references (tóm tắt)

Chia monorepo thành nhiều project TS build theo thứ tự:

```json
// tsconfig.json (solution)
{
  "files": [],
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/api" }
  ]
}
```

```json
// packages/core/tsconfig.json
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
```

- `composite: true` bắt buộc cho project được reference.
- Tăng tốc incremental build lớn; cần `declaration`.
- Công cụ: `tsc -b --clean`, watch `-b -w`.

Không bắt buộc cho app nhỏ một package.

---

## 13. Checklist nhanh

1. `"type": "module"` trong `package.json` (nếu chọn ESM).  
2. `module` / `moduleResolution`: `NodeNext` (không dùng `node`/`classic`).  
3. `strict` + `verbatimModuleSyntax`.  
4. Workflow strip-types? → `erasableSyntaxOnly` + `noEmit` + tránh `enum`/namespace/decorators/param props.  
5. Workflow emit? → `outDir`, `declaration` nếu publish.  
6. `typescript@^7`, `@types/node@^26`.  
7. CI: `tsc --noEmit` dù dev dùng tsx/strip.  
8. Alias runtime → `#imports`, không chỉ `paths`.  
9. Tooling cần programmatic API cũ → `@typescript/typescript6` cho tới ~TS 7.1.

**Tài liệu liên quan:** [node26-ts7.md](node26-ts7.md) · [modules-packages.md](modules-packages.md) · [tooling.md](tooling.md) · [decorators.md](decorators.md)
