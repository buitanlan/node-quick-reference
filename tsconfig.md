# tsconfig & biên dịch TypeScript

`compilerOptions` then chốt cho Node ESM, type stripping, và project references trên **TypeScript 7** + **Node.js 26**.

> **Callout:** Mục tiêu phổ biến: `module` / `moduleResolution`: **`NodeNext`**, `strict: true` (mặc định TS 7), và chọn rõ workflow **strip-types** vs **`tsc` emit** vs **tsx**. `paths` **không** chạy trên Node. Xem [tooling.md](tooling.md).

---

## Mục lục

- [1. Vai trò `tsconfig.json`](#1-vai-trò-tsconfigjson)
- [2. Skeleton khuyến nghị (Node ESM)](#2-skeleton-khuyến-nghị-node-esm)
- [3. TS 7 defaults & breaking](#3-ts-7-defaults--breaking)
  - [3.1 Mặc định cần ghim khi migration](#31-mặc-định-cần-ghim-khi-migration)
  - [3.2 CLI native và tool cần compiler API](#32-cli-native-và-tool-cần-compiler-api)
- [4. `module` / `moduleResolution` / thuật toán NodeNext](#4-module--moduleresolution--thuật-toán-nodenext)
  - [4.1 Algorithm (rút gọn — khớp Node)](#41-algorithm-rút-gọn--khớp-node)
  - [4.2 Ví dụ resolve `exports` types](#42-ví-dụ-resolve-exports-types)
- [5. `target`, `lib`, `skipLibCheck`, JSX](#5-target-lib-skiplibcheck-jsx)
  - [5.1 `lib` thực dụng Node 26](#51-lib-thực-dụng-node-26)
  - [5.2 `skipLibCheck` vs `maxNodeModuleJsDepth`](#52-skiplibcheck-vs-maxnodemodulejsdepth)
- [6. `strict` và an toàn kiểu](#6-strict-và-an-toàn-kiểu)
  - [6.1 Tắt từng flag? (không khuyến nghị)](#61-tắt-từng-flag-không-khuyến-nghị)
  - [6.2 IsolatedDeclarations / declaration emit (tóm tắt)](#62-isolateddeclarations--declaration-emit-tóm-tắt)
  - [6.3 Lỗi TS 7 thường gặp khi nâng](#63-lỗi-ts-7-thường-gặp-khi-nâng)
  - [6.4 `files`, `include`, `exclude`, `extends`](#64-files-include-exclude-extends)
  - [6.5 `customConditions` & `resolvePackageJsonExports`](#65-customconditions--resolvepackagejsonexports)
  - [6.6 `allowImportingTsExtensions`](#66-allowimportingtsextensions)
  - [6.7 `moduleDetection` & `forceConsistentCasingInFileNames`](#67-moduledetection--forceconsistentcasinginfilenames)
- [7. `verbatimModuleSyntax`](#7-verbatimmodulesyntax)
- [8. `erasableSyntaxOnly` — danh sách cấm](#8-erasablesyntaxonly--danh-sách-cấm)
  - [8.1 Ví dụ cấm / được](#81-ví-dụ-cấm--được)
  - [8.2 `isolatedModules` (bổ sung)](#82-isolatedmodules-bổ-sung)
  - [8.3 Bảng “cấm” in ra compiler](#83-bảng-cấm-in-ra-compiler)
  - [8.4 Parameter properties — rewrite](#84-parameter-properties--rewrite)
- [9. `noEmit` / emit / `outDir`](#9-noemit--emit--outdir)
- [10. Ba cách chạy TypeScript trên Node](#10-ba-cách-chạy-typescript-trên-node)
  - [10.1 Node type stripping](#101-node-type-stripping)
  - [10.2 `tsc` emit](#102-tsc-emit)
  - [10.3 `tsx` (dev)](#103-tsx-dev)
- [11. `@types/node`](#11-typesnode)
- [12. Path aliases vs runtime](#12-path-aliases-vs-runtime)
  - [12.1 `paths` + `NodeNext` — vì sao vẫn đỏ runtime](#121-paths--nodenext--vì-sao-vẫn-đỏ-runtime)
- [13. Project references, `composite`, incremental](#13-project-references-composite-incremental)
  - [13.1 Incremental](#131-incremental)
  - [13.2 Thứ tự reference & `prepend` (đừng)](#132-thứ-tự-reference--prepend-đừng)
- [14. `tsconfig.build.json` split](#14-tsconfigbuildjson-split)
  - [14.1 `tsconfig.eslint.json`](#141-tsconfigeslintjson)
  - [14.2 `rootDir` mặc định `.` vs khai tường minh](#142-rootdir-mặc-định--vs-khai-tường-minh)
  - [14.3 `noEmit` trên CLI vs file](#143-noemit-trên-cli-vs-file)
- [15. Best practices](#15-best-practices)
- [16. Checklist](#16-checklist)
- [17. Cheat sheet](#17-cheat-sheet)
- [18. Version notes](#18-version-notes)
- [19. Tài liệu liên quan](#19-tài-liệu-liên-quan)

---

## 1. Vai trò `tsconfig.json`

- Bảo TypeScript **cách kiểm tra kiểu** và (tuỳ chọn) **emit** JS / `.d.ts`.
- Editor đọc `tsconfig` cho IntelliSense.
- Không thay `package.json` `"type"` — module runtime vẫn do Node quyết định.

Nhiều file: `tsconfig.json` (base/editor), `tsconfig.build.json` (emit), `tsconfig.eslint.json` (lint). `extends` kế thừa options và `files`/`include`/`exclude` nếu file con không khai lại; khai ở con thay toàn bộ trường tương ứng, không concat. Relative path tính theo file config nơi khai báo; `references` không được kế thừa.

`tsc -p tsconfig.json` chọn project. Không `-p` → tìm `tsconfig.json` gần CWD.

---

## 2. Skeleton khuyến nghị (Node ESM)

```json
{
  "compilerOptions": {
    "target": "ES2025",
    "lib": ["ES2025"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitOverride": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

Điều chỉnh theo workflow:

- **Chỉ typecheck + Node strip / tsx:** `"noEmit": true`, `"erasableSyntaxOnly": true`.
- **Pipeline strip + emit cùng nguồn `.ts`:** thêm `"rewriteRelativeImportExtensions": true` để viết `from "./foo.ts"` chạy trực tiếp trên Node strip và `tsc` tự đổi thành `./foo.js` khi emit (với pipeline `tsc` emit thuần, convention cổ điển là viết `./foo.js` trong nguồn `.ts`).
- **Dùng `Temporal` (global trên Node 26):** đổi `"lib": ["ES2025", "ESNext.Temporal"]` (đã có sẵn trong TS 6/7).
- **Library publish:** `declaration: true`, `declarationMap`, có thể `composite` và `isolatedDeclarations`.
- Trên TS 7, `esModuleInterop` luôn mặc định `true` (không cần khai thêm; đặt `false` là lỗi).

Base cộng đồng: `"extends": "@tsconfig/node26/tsconfig.json"` rồi override.

`exclude` **không** thắng `include` nếu file đã nằm trong project references khác — đọc handbook khi monorepo “vẫn typecheck test”.

---

## 3. TS 7 defaults & breaking

TS 7 (và 6.0 language defaults) **cứng** hơn 5.x:

| Option / hành vi | TS 7 |
|---|---|
| `strict` | Mặc định **`true`** |
| `target` mặc định | **`ES2025`** (khi không khai báo) |
| `moduleResolution: "node"` / `node10` / `classic` | **Error** (removed) |
| `target: es5` (và target cổ) | **Error** (removed) |
| `esModuleInterop: false` / `alwaysStrict: false` | **Error** (chỉ còn `true`) |
| `baseUrl` | **Error** (removed — dùng đường dẫn tương đối trong `paths`) |
| `module` `amd` / `umd` / `system` / `none` | Loại khỏi đường Node hiện đại |
| Các tùy chọn bị **gỡ bỏ hoàn toàn** trong TS 7.0 | `outFile`, `downlevelIteration`, `prepend`, `importsNotUsedAsValues`, `preserveValueImports`, `charset`, `keyofStringsOnly`, `suppressExcessPropertyErrors`, `suppressImplicitAnyIndexErrors`, `noImplicitUseStrict` |
| Ngữ nghĩa ngôn ngữ | Gần parity **6.0** |
| Compiler | Native Go; tốc độ phụ thuộc project/hardware, đo bằng workload thật |
| Programmatic API | **7.0 chưa ship API**; API mới được dự kiến cho 7.1, cần kiểm tool/version thực tế |

Migrate:

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2025",
    "types": ["node"]
  }
}
```

App bundler (Vite): `moduleResolution: "bundler"` + `module: "preserve"` / `esnext` — **không** copy vào package Node thuần (`exports` / đuôi).

Tạm `"strict": false` khi nâng — **issue/TODO**; đừng để mặc định mới “tắt im”.

TS 7 loại `baseUrl`: bỏ option và chuyển giá trị `paths` thành đường tương đối từ tsconfig, ví dụ `"@app/*": ["./src/app/*"]`. `paths` vẫn chỉ giúp checker; Node dùng `#imports` hoặc loader tương thích. Xem [TS 6 migration](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html).

### 3.1 Mặc định cần ghim khi migration

TS 6/7 mặc định `target: "ES2025"`, `module: "esnext"`, `strict: true`, `noUncheckedSideEffectImports: true`, `libReplacement: false`, `rootDir: "."` (thư mục chứa `tsconfig.json`) và `types: []`.

- Khai tường minh `"types": ["node"]` cho Node globals (bỏ `types` sẽ **không** tự load bất kỳ `@types/*` nào); test globals cần liệt kê riêng hoặc import.
- `libReplacement: false` (mặc định TS 6/7) tắt cơ chế tự thay `lib` bằng package `@typescript/lib-*` trong `node_modules` — giúp tăng tốc và giảm bất ngờ khi resolve lib.
- `rootDir` quyết định cấu trúc emit, không giới hạn tập file như `include`.
- Nếu đi qua bước đệm **TS 6.0** trước khi lên TS 7.0, có thể tạm dùng `"ignoreDeprecations": "6.0"` để giảm ồn trong lúc dọn dần các option sắp bị gỡ (lưu ý TS 7.0 chuyển thẳng thành hard error, không còn bỏ qua được).
- Ghim `target`/`lib` theo runtime được support thay vì để nâng compiler âm thầm đổi output. [TS 6 migration](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html), [TS 7 release](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

### 3.2 CLI native và tool cần compiler API

**Cờ song song CLI của TS 7.0 (Go compiler):**

| Cờ CLI | Ý nghĩa |
|---|---|
| `--checkers <n>` | Số type-checker song song mỗi project (mặc định **`4`**) |
| `--builders <n>` | Số project chạy đồng thời trong `tsc -b` |
| `--singleThreaded` | Tắt đa luồng (hữu ích trên container RAM thấp hoặc debug) |

> Lưu ý tiêu thụ bộ nhớ: RAM tăng gần theo **`--builders × --checkers`**; trên CI có memory cap, giới hạn số luồng thay vì tăng đồng thời cả hai.

Tool import `typescript` (linter/codegen/framework compiler) cần API tương thích, không chỉ binary `tsc`. Ví dụ bridge theo hướng dẫn TS 7:

```json
{
  "devDependencies": {
    "@typescript/native": "npm:typescript@^7.0.2",
    "typescript": "npm:@typescript/typescript6@^6.0.2"
  }
}
```

Alias native cung cấp `tsc`, compatibility package cung cấp API TS 6 và `tsc6`. Xác nhận binary bằng `tsc --version`, kiểm peer dependency của tool và cấu hình editor/LSP riêng. Không suy ra tool đã dùng checker 7 từ version CLI. [Side-by-side guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

---

## 4. `module` / `moduleResolution` / thuật toán NodeNext

| Giá trị | Khi dùng |
|---|---|
| `NodeNext` | **Khuyến nghị** app/lib Node hiện đại (theo dõi hành vi Node mới nhất) |
| `Node20` / `Node18` | Neo chính xác luật module của Node 20 (gồm `require(esm)` ở Node 20+) hoặc Node 18 — ổn định hơn `NodeNext` nếu muốn không bị đổi behavior khi nâng TS |
| `Node16` | Neo luật Node 16; ưu tiên `Node20` hoặc `NodeNext` |
| `ESNext` + `bundler` | Emit cho bundler |
| `CommonJS` | Legacy CJS only |
| `"node"` / `node10` / `classic` | **Lỗi trên TS 7** |

Với `NodeNext`:

- Relative import cần đuôi phù hợp (thường `.js` trong import path).
- Tôn trọng `package.json` `exports` / `"type"`.
- Format từng file theo `"type"` + `.mts`/`.cts`.

```ts
import { readFile } from "node:fs/promises";
import { helper } from "./helper.js"; // trỏ helper.ts nguồn
```

### 4.1 Algorithm (rút gọn — khớp Node)

1. **Relative / absolute:** file trên đĩa. ESM (và `NodeNext` khi file là ESM) **bắt buộc đuôi** (`.js`, `.mjs`, `.json`, …). `from "./foo"` → error TS.
2. **`#imports`:** `package.json` `"imports"` của package chứa file — runtime Node **cũng** hiểu.
3. **Bare specifier** (`fastify`, `@acme/sdk`): đi lên `node_modules`, đọc `package.json`.
4. **`exports`:** match subpath + **conditions**. TS luôn xét `"types"` (+ `"types@{selector}"`) và `"default"`; thêm `import`/`require`/`node` tùy `moduleResolution` và format file đang check. `customConditions` để thêm.
5. **Không `exports`:** fallback `main` / `types` / index — **legacy**. `typesVersions` **chỉ** khi **không** đi `exports` (TS **bỏ** `typesVersions` nếu đã đọc `exports`) — [modules-packages.md](modules-packages.md).
6. Self-name (`import "my-pkg"` trong chính pkg) → `exports["."]`.

Conditions order **trong `package.json`** do Node/TS match theo key — `types` **đầu**, `default` **cuối**.

Emit ESM vs CJS: `import` vs `require` condition có thể khác `.d.ts` / `.d.cts`. Sai dual types → consumer `NodeNext` đỏ.

> **Callout:** `NodeNext` = “TypeScript đóng vai Node”. Xanh TS + đỏ `node dist/` thường vì `paths` hoặc thiếu đuôi lúc emit lệch. Bundler resolution **nới** extensionless — đừng dùng cho lib Node publish.

`module` vs `moduleResolution`: `module` = **emit** (CJS `require` vs ESM `import`); `moduleResolution` = **cách tìm file**. `NodeNext` gợi ý cặp khớp; đừng `module: CommonJS` + `moduleResolution: NodeNext` trừ khi hiểu dual.

`rewriteRelativeImportExtensions`: nguồn `from "./a.ts"` → emit `./a.js`. Chạy trực tiếp bằng Node strip phải import file `.ts` đang có trên đĩa; Node không đổi `./a.js` thành `./a.ts`. Quy tắc `.js` trong nguồn chỉ dùng cho pipeline emit hoặc runner có resolution riêng.

### 4.2 Ví dụ resolve `exports` types

Package:

```json
{
  "exports": {
    ".": {
      "import": "./esm/index.js",
      "require": "./cjs/index.js"
    }
  }
}
```

**Thiếu** `"types"` → `NodeNext` có thể không tìm `.d.ts` cạnh `main`. Với dual-package, lồng `"types"` vào bên trong **cả hai** nhánh `"import"` và `"require"` (đừng đặt `"types"` ở top-level trước `"require"`, vì nhánh `"types"` ngoài sẽ khớp trước và khiến `"require.types"` trở thành unreachable!):

```json
{
  "exports": {
    ".": {
      "import": {
        "types": "./esm/index.d.ts",
        "default": "./esm/index.js"
      },
      "require": {
        "types": "./cjs/index.d.cts",
        "default": "./cjs/index.js"
      }
    }
  }
}
```

`customConditions` không thay `"types"` đứng đầu trong mỗi nhánh. `traceResolution` log “Matched 'types' condition”.

File `.d.cts` cho CJS types (`export =` **cấm** nếu erasable trên **nguồn**; `.d.cts` emit từ `.cts`). Dual: `index.d.ts` ESM, `index.d.cts` CJS. `typesVersions` **không** cứu khi có `exports`.

---

## 5. `target`, `lib`, `skipLibCheck`, JSX

Ba nút **khác nhau**:

| Option | Việc | Không phải |
|---|---|---|
| `target` | JS **emit** (downlevel syntax: optional chaining, …) | Không thêm typings DOM |
| `lib` | **Typings** built-in (`Promise`, `Temporal` nếu có trong lib, `Array`) | Không đổi emit |
| `skipLibCheck` | **Bỏ** typecheck `.d.ts` trong `node_modules` | Không bỏ check **code bạn** |

- Node 26 hiểu ES2025+ đầy đủ → `target` **`ES2025`** (mặc định của TS 6/7) hoặc **`ESNext`**. TS 7: **`es5` error**.
- `lib` thường **khớp** `target` (`["ES2025"]`). `lib` thấp hơn `target` → thiếu type iterator/Set methods mới; `lib` có DOM trên server → `document` “tồn tại” giả — **đừng** trừ khi share browser.
- **Temporal:** Types đã có sẵn trong **TS 6/7** qua `"lib": ["ES2025", "ESNext.Temporal"]` — khớp trực tiếp với global `Temporal` mặc định của Node 26.
- `jsx` chỉ khi React/JSX (`react-jsx`). API Node thuần: không `jsx`.

`skipLibCheck: true` (khuyến nghị app): `.d.ts` dependency xung đột `@types` không chặn bạn. **Không** che lỗi trong `src`. Lib **publish** `.d.ts` của mình vẫn bị check khi `declaration` — đó là code bạn.

`skipDefaultLibCheck` hẹp hơn — ít dùng.

### 5.1 `lib` thực dụng Node 26

```json
{
  "compilerOptions": {
    "target": "ES2025",
    "lib": ["ES2025", "ESNext.Temporal"]
  }
}
```

Thêm `"DOM"` chỉ khi file chạy browser/edge. `lib: ["ESNext"]` + `target: ES2025` → type API **mới hơn** emit — có thể gọi hàm runtime Node 26 chưa có nếu lib quá đà. Khớp **lib ≤ runtime**.

`@types/node` **bổ sung** `Buffer`, `process`, modules `node:*` — không thay `lib` cho `Promise`/`Array`/`Temporal`.

`downlevelIteration` đã bị **gỡ bỏ hoàn toàn** trên TS 7.0 (cùng với `target: ES5`). `importHelpers` (`tslib`) cũng hiếm khi cần khi `target` cao (`ES2025`).

### 5.2 `skipLibCheck` vs `maxNodeModuleJsDepth`

`skipLibCheck` bỏ check **`.d.ts`**. File `.js` trong `node_modules` với `checkJs` / `allowJs` **vẫn** có thể vào program nếu `include` quá rộng — đừng `include: ["**/*"]`.

`maxNodeModuleJsDepth` (cũ, `@types` thiếu): hạn chế. Ưu tiên `@types/node` đúng major.

Conflict `@types/react` vs DOM lib — không dính server thuần. Dual app: `tsconfig` **tách** `app` (DOM) / `server` (Node, không DOM).

`useDefineForClassFields` / `target` cao: field class đúng semantics JS — [oop.md](oop.md).

---

## 6. `strict` và an toàn kiểu

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

### 6.1 Tắt từng flag? (không khuyến nghị)

Trên codebase migrate, đôi khi tạm tắt `strictPropertyInitialization` hoặc trì hoãn `noUncheckedIndexedAccess`. **Đừng** tắt cả `strict` trên TS 7 rồi quên bật lại — ghi TODO/issue. Prefer enable dần theo package trong monorepo (`references` + tsconfig riêng) hơn một `strict: false` toàn repo.

`useUnknownInCatchVariables`: `catch (e)` là `unknown` — `instanceof Error`. Khớp [exceptions.md](exceptions.md).

### 6.2 IsolatedDeclarations / declaration emit (tóm tắt)

Khi publish `.d.ts` hoặc chạy monorepo lớn, **`isolatedDeclarations: true`** (TS 5.5+) yêu cầu mọi export có type annotation đủ rõ để sinh `.d.ts` độc lập từng file mà không cần suy diễn kiểu toàn chương trình.

Trên **TS 7 (Go compiler)**, `isolatedDeclarations` mở khóa khả năng **song song hóa emit `.d.ts`** theo từng file và cho phép các project phụ thuộc trong `tsc -b` bắt đầu typecheck sớm hơn mà không phải chờ hoàn tất typecheck của package cha (cũng tương thích tốt với các công cụ emit declaration độc lập như oxc/rolldown). Có thể ồn trên codebase cũ — bật có chủ đích theo từng package.

Không bắt buộc cho app nội bộ chỉ `noEmit` + strip.

### 6.3 Lỗi TS 7 thường gặp khi nâng

| Thông báo (ý) | Sửa |
|---|---|
| `moduleResolution=node10` removed | `"moduleResolution": "NodeNext"` (Node) hoặc `"bundler"` |
| `target=ES5` removed | `"target": "ES2025"` / `ES2015+` |
| `esModuleInterop=false` removed | Bỏ flag (luôn true) |
| `strict` bật, `null` lan | Sửa code; tạm `strictNullChecks` trong migrate từng package |
| `baseUrl` removed | Xóa `baseUrl`; chuyển `paths` sang đường dẫn tương đối `"./src/*"` (runtime vẫn `#imports`) |
| `types: []` mặc định làm thiếu `process`/`Buffer` | Thêm `"types": ["node"]` tường minh |
| Plugin ESLint không nhận TS 7 | `@typescript/typescript6` bridge / chờ plugin |

`npx tsc -v` **phải** trùng `node_modules/typescript`. Editor “Use Workspace Version”. CI `pnpm exec tsc -v`.

### 6.4 `files`, `include`, `exclude`, `extends`

- `include` mặc định `**/*` nếu thiếu — kéo nhầm `scripts/`, `dist/`.
- `exclude` mặc định `node_modules`, `bower_components`, `jspm_packages`, `outDir`. Không cần `exclude` `dist` nếu `outDir` đã là `dist` (vẫn có thể ghi rõ để dễ đọc).
- File **nằm trong** `references` khác không compile hai lần nếu solution `files: []`.
- `extends` array (TS 5+) — merge option; `include` của file **hiện tại** thắng, không concat thần kỳ.
- `compilerOptions.types` trên base + con: con **thay** mảng, không merge.

`tsc --showConfig` in config **đã** resolve — debug `extends` / `@tsconfig/node26`.

### 6.5 `customConditions` & `resolvePackageJsonExports`

`resolvePackageJsonExports` / `resolvePackageJsonImports` (mặc định on với NodeNext): tắt = lệch Node — **đừng** tắt.

```json
{
  "compilerOptions": {
    "customConditions": ["development"]
  }
}
```

TS match thêm condition trong `exports`/`imports`. Dev-only export (`"development": "./src/index.ts"`) — **Node runtime** không set `development` trừ `NODE_OPTIONS=--conditions=development` (Node `--conditions`). Editor xanh + `node dist` đỏ nếu chỉ TS có custom condition.

`--conditions` Node: `node --conditions=development dist/index.js`. Document nếu dùng. Prod **không** `development` condition.

### 6.6 `allowImportingTsExtensions`

Cho `from "./a.ts"` khi `noEmit` / bundler. Node strip **có thể** load `.ts` relative nếu specifier `.ts` — **không** portable với `tsc` emit (trừ `rewriteRelativeImportExtensions`). `NodeNext` + emit: convention `.js`.

`allowArbitraryExtensions` (import `.css` types) — bundler, không Node thuần.

`noUncheckedSideEffectImports`: mặc định **`true`** trên TS 6/7 — mọi `import "./polyfill.js"` phải resolve được file thật (đồng bộ §3.1).

### 6.7 `moduleDetection` & `forceConsistentCasingInFileNames`

`moduleDetection: "force"` coi mọi file là module (có `import`/`export`). Script global + Node ESM: `force` tránh “không phải module”. `auto` đủ nhiều repo.

`forceConsistentCasingInFileNames: true` — bắt buộc trên Windows/macOS (FS case-insensitive). Linux CI đỏ nếu import `./Foo.js` file `foo.js`. Node 26 Linux **phân biệt** hoa thường.

`allowSyntheticDefaultImports` TS 7 kẹt `true` — `import fs from "node:fs"` OK với `@types/node`. Không tắt.

`verbatimModuleSyntax` + default import CJS: `esModuleInterop` (luôn true TS 7) synthetic default. `import * as fs from "node:fs"` rồi `fs.readFile` cũng OK với `@types/node`.

---

## 7. `verbatimModuleSyntax`

```json
{ "compilerOptions": { "verbatimModuleSyntax": true } }
```

```ts
import type { User } from "./types.js";
import { createUser } from "./user.js";

export type { User };
export { createUser };
```

**Cấm** import giá trị rồi elide lúc emit (legacy `importsNotUsedAsValues`). Type-only **phải** `import type` / `export type`. Khớp Node strip: strip **không** elide `import { Foo }` nếu `Foo` chỉ là interface — runtime `Foo` undefined.

Kết hợp tốt với ESM và type stripping. TS 7 / Node 26: **bật**.

`import { type User, createUser } from "./mod.js"` — inline `type` cũng hợp lệ.

CJS `require` emit: `verbatimModuleSyntax` + `NodeNext` trên `.cts` giữ `require` / `import x = require` **cấm** nếu `erasableSyntaxOnly`.

> **Callout:** Thiếu `import type` + strip = runtime `ERR` / `undefined is not a constructor`. CI `erasableSyntaxOnly` + `verbatimModuleSyntax` bắt lúc typecheck.

---

## 8. `erasableSyntaxOnly` — danh sách cấm

```json
{
  "compilerOptions": {
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "noEmit": true
  }
}
```

Khi bật, TypeScript **cấm** cú pháp không xóa sạch bằng strip (handbook):

| Cấm | Thay | Lý do |
|---|---|---|
| `enum` / `const enum` | `as const` object + type | Emit object/IIFE |
| Parameter properties | Field + gán trong ctor | Emit `this.x = x` |
| `namespace` / `module` runtime | ES modules | IIFE / `exports.` |
| `import a = require()` | `import` ESM / `createRequire` | Emit `require` helper |
| `export =` | `export default` / named | CJS export |
| `<Type>expr` assertion | `expr as Type` | JSX / parse; không erasable cùng kiểu `as` |
| Decorators `@dec` | Compiler flag cho phép; **Node strip không parse** | Chạy `tsc` emit / runner tương thích |

**Được:** `type` / `interface` / `as` / `satisfies` / generics / `import type`.

Mục tiêu: `.ts` chạy được trên Node type stripping mà không cần transpile đầy đủ. Chi tiết decorator: [decorators.md](decorators.md). OOP fields: [oop.md](oop.md).

Node 26 **không** `--experimental-transform-types` — enum **không** “tự thành JS” lúc `node file.ts`.

CI: bật flag trên `tsconfig` mà `dev` dùng strip. Pipeline `tsc` emit **có thể** tắt `erasableSyntaxOnly` nếu cố dùng enum — **đừng** mix: một nhánh strip, một nhánh enum.

> **Callout:** `erasableSyntaxOnly` không chặn decorator. CI phải kiểm chương trình bằng runner thực tế; chỉ `tsc --noEmit` không chứng minh Node parse được toàn bộ JS còn lại.

### 8.1 Ví dụ cấm / được

```ts
// CẤM
enum E { A, B }
namespace N { export const x = 1; }
class P { constructor(public x: number) {} }
import fs = require("node:fs");
export = P;
const n = <number>1;
// Decorator: compiler flag cho phép, nhưng Node strip không chạy được
// class C { @logged m() {} }

// ĐƯỢC
const E = { A: "A", B: "B" } as const;
type E = (typeof E)[keyof typeof E];
class P2 { x: number; constructor(x: number) { this.x = x; } }
import fs from "node:fs";
const n2 = 1 as number;
type User = { id: string };
import type { User as U } from "./u.js";
```

`const enum` **cũng** cấm (inlining runtime). `namespace` **chỉ type** (`export type`) có thể ổn — `namespace` có giá trị thì không. Parameter properties = cấm cả `readonly` trong ctor param.

`import type` + `erasableSyntaxOnly` + `verbatimModuleSyntax` = bộ ba strip.

### 8.2 `isolatedModules` (bổ sung)

`isolatedModules: true` kiểm giới hạn của transform từng file, gồm re-export type cần `type` và ambient const enum; không cấm mọi const enum thông thường. Khác `erasableSyntaxOnly`; chọn theo transpiler/strip đang dùng.

`preserveValueImports` đã thay bằng `verbatimModuleSyntax` — đừng flag cũ.

### 8.3 Bảng “cấm” in ra compiler

TS error khi `erasableSyntaxOnly`: parameter property, enum, `export =` và `<T>x`. Decorator không bị flag này chặn; parser Node mới từ chối khi chạy strip.

Sửa **cú pháp**, không “cast cho xong”. `as const` object **không** phải enum runtime (`Object.values` khác).

`namespace Express { interface Request {} }` (augmentation) — type-only merge: thường **được**; namespace có `export const` thì **cấm**. Kiểm `tsc` khi nâng.

### 8.4 Parameter properties — rewrite

```ts
class Bad { constructor(public readonly id: string) {} }

class Good {
  readonly id: string;
  constructor(id: string) {
    this.id = id;
  }
}
```

Nhiều field: codegen nhàm — chấp nhận. `erasableSyntaxOnly` **cấm** cả `constructor(readonly x: string)` không `public` keyword? **Parameter property** = modifier trên ctor param (`public`/`private`/`protected`/`readonly`). `readonly` **một mình** trên param vẫn là param property — cấm. `constructor(id: string) { this.id = id }` với field khai riêng = được.

`enum` rewrite:

```ts
const Direction = { Up: "Up", Down: "Down" } as const;
type Direction = (typeof Direction)[keyof typeof Direction];
```

Không `Direction.Up === 0` (numeric enum). JSON/log dùng string.

`import = require` rewrite: `import { createRequire } from "node:module"` hoặc `import fs from "node:fs"`. `export =` rewrite: `export default` + `export { Foo }` named. Consumer CJS: `require(esm)` `.default`.

`<>` assertion: `value as T`. JSX file `.tsx` dùng `as` — `<Foo />` là component, không assertion.

`isolatedDeclarations` (lib): annotate export. `noUncheckedIndexedAccess` bổ sung `strict`. `tsc --showConfig` debug extends.

---

## 9. `noEmit` / emit / `outDir`

| Option | Ý nghĩa |
|---|---|
| `noEmit: true` | Chỉ typecheck |
| `emitDeclarationOnly` | Chỉ `.d.ts` (JS do bundler) |
| `outDir` / `rootDir` | Cấu trúc emit |
| `sourceMap` | Debug |
| `declaration` | Library types |
| `declarationMap` | Jump-to-source từ `.d.ts` |
| `removeComments` | Tùy |

```json
{
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "build": "tsc -p tsconfig.build.json"
  }
}
```

`--noEmit` trên CLI **ghi đè** `noEmit: false` trong file — `typecheck` script an toàn.

`rootDir: src` + file `src/index.ts` → `dist/index.js`. Lỡ `include` `test/` mà `rootDir` src → error rootDir. Tách `tsconfig.build.json` — §14.

---

## 10. Ba cách chạy TypeScript trên Node

### 10.1 Node type stripping

Trên **Node 26**, type stripping **ổn định** cho `.ts`:

```bash
node src/index.ts
```

- **Không** type-check; **không** transpile syntax “thừa”.
- Đã gỡ `--experimental-transform-types`.
- Vẫn nên `tsc --noEmit` trên CI.
- Khuyến nghị: `erasableSyntaxOnly` + `verbatimModuleSyntax`.

### 10.2 `tsc` emit

```bash
tsc -p tsconfig.json
node dist/index.js
```

Kiểm soát tối đa; phù hợp production và thư viện. Tôn trọng `module: NodeNext`.

### 10.3 `tsx` (dev)

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

Chi tiết runner: [tooling.md](tooling.md), [main-function.md](main-function.md).

---

## 11. `@types/node`

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

Trên **TS 6/7**, `types` mặc định là **`[]`** (khác TS 5.x trước đây): **bỏ `types` sẽ KHÔNG load bất kỳ `@types/*` nào**. Bắt buộc ghi tường minh `"types": ["node"]` (và thêm package khác vào mảng nếu cần globals từ `@types/foo`). Test: `"types": ["node"]` + import `node:test`.

`--noEmit` vẫn cần `"types": ["node"]` cho `fetch`/`Buffer`/`process`, và `"lib": ["ES2025", "ESNext.Temporal"]` cho global `Temporal`.

---

## 12. Path aliases vs runtime

```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

*(Không khai `"baseUrl": "."` — `baseUrl` đã bị gỡ và là hard error trên TS 7.0; dùng đường dẫn tương đối `./src/*` trực tiếp trong `paths`.)*

`paths` **chỉ** typecheck / editor (và bundler nếu cấu hình song song). **Node không đọc `tsconfig`**. `node dist/index.js` với `import "@/foo.js"` → `ERR_MODULE_NOT_FOUND`.

Chạy được khi:

- `package.json` `#imports` (`"#/*": "./dist/*"`) — **runtime Node**,
- bundler/loader rewrite,
- `tsx` (dev, không prod),
- hoặc **không alias** — relative / `#lib/...`.

| Cách | Runtime `node` | Ghi chú |
|---|---|---|
| `#imports` | Có | Khuyến nghị ESM |
| `paths` only | **Không** | TS xanh, Node đỏ |
| `tsx` | Dev | Đừng ship |
| Bundler | Sau bundle | OK frontend/server bundle |

Chi tiết `#imports`: [modules-packages.md](modules-packages.md).

### 12.1 `paths` + `NodeNext` — vì sao vẫn đỏ runtime

TS resolve `@/utils` → `src/utils.ts` lúc check. Emit **giữ** specifier `@/utils` (trừ plugin rewrite). Node ESM loader **không** đọc `paths`. Bundler (esbuild `alias`) rewrite lúc bundle — service `node dist` không bundle thì chết.

Checklist khi muốn alias:

1. Thêm `#utils` vào `"imports"` trỏ `./dist/utils.js` (và dev `./src/utils.ts` **không** tự map trừ rewrite).
2. Hoặc `imports` `"#utils": { "default": "./dist/utils.js" }` sau emit.
3. Dual src/dist: một số team `#utils` → `./src/utils.ts` **chỉ** khi strip; prod `#utils` → `./dist/utils.js` — **hai** `package.json` hoặc conditional `imports` `development` (tool phải set condition). Phức — relative thường rẻ hơn.

Đừng `NODE_PATH`. Đừng `tsconfig-paths/register` trên server prod.

TS 7.0 đã **gỡ bỏ hoàn toàn** `baseUrl` (hard error); `paths` luôn viết tương đối `"./src/*"`. Dù editor và `tsc` OK — `paths` **vẫn** không phải runtime Node.

> **Callout:** Alias `@/` copy từ Vite vào service Node là chân classic. Sửa: `#lib/` hoặc relative. Đừng thêm `tsconfig-paths` register trên prod trừ khi chấp nhận loader.

---

## 13. Project references, `composite`, incremental

```json
{
  "files": [],
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/api" }
  ]
}
```

Solution `tsconfig.json` ở root: `"files": []` + `references` — không compile nhầm mọi file một program.

Package được reference:

```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "incremental": true
  },
  "include": ["src"]
}
```

```bash
tsc -b
tsc -b --clean
tsc -b -w
```

`composite: true` **bắt buộc** cho project được `references`. Kéo theo `declaration` (và thường `declarationMap`). Không bắt buộc cho app nhỏ một package.

`tsc -b` build theo DAG: `core` trước `api`. `--pretty` / `--verbose` khi debug “stale”.

### 13.1 Incremental

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

`composite` **đã** incremental (file `.tsbuildinfo` cạnh out). App một package: `incremental` không `composite` vẫn cache typecheck.

- Gitignore `*.tsbuildinfo` trừ khi CI cache có chủ đích.
- CI cache `.tsbuildinfo` + `src` hash — đừng cache khi `skipLibCheck` đổi lung tung.
- `--incremental false` khi nghi cache bẩn; `tsc -b --clean`.

`assumeChangesOnlyAffectDirectDependencies` (watch) — nhanh hơn, có thể miss; dùng cẩn thận.

### 13.2 Thứ tự reference & `prepend` (đừng)

`references`: `path` tới folder/`tsconfig`. Tùy chọn `prepend` (concat `outFile` cũ) đã bị **gỡ bỏ hoàn toàn trên TS 7.0** — mỗi package phải có `outDir` riêng.

Circular reference → `tsc -b` error. Giống cycle module: tách `types` package.

`disableSourceOfProjectReferenceRedirect`: editor và ESLint type-aware dùng `.d.ts` thay `.ts` nguồn package kia — chậm hơn DX nhưng gần prod hơn (thống nhất giữa editor và ESLint). Mặc định TS nhảy thẳng sang source `.ts` — tiện, nhưng có thể “xanh editor, đỏ dist” nếu `exports` lệch.

`tsc -b --force` bỏ qua incremental khi nghi bẩn. CI sạch: cache restore **đúng** key (`tsconfig` + lockfile + src).

---

## 14. `tsconfig.build.json` split

Editor + test cần `include` rộng; emit **không** gồm spec / script.

```json
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

`tsconfig.build.json`:

```json
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

`extends` **không** merge `include` — **khai lại** `include`/`exclude`. `noEmit: false` ghi đè base. Giữ nguyên `erasableSyntaxOnly` đồng nhất giữa base và build (không tắt riêng ở `tsconfig.build.json`).

> **Callout:** Dùng chung một `tsconfig` có `noEmit: true` rồi quên truyền `-p tsconfig.build.json` lúc build → ship nhầm hoặc thiếu `dist`. Tách hai file, hai script rõ ràng và chạy cả hai trên CI.

Scripts:

```json
{
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "build": "tsc -p tsconfig.build.json"
  }
}
```

ESLint `parserOptions.projectService` (hoặc `project`): trỏ `tsconfig.json` (có test) hoặc `tsconfig.eslint.json` `include` đúng file lint — tránh “file not in project”.

Library: `tsconfig.build.json` + `composite` nếu nằm workspace `references`.

### 14.1 `tsconfig.eslint.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "allowJs": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "eslint.config.js"]
}
```

Typed lint **cần** file nằm trong project và `"allowJs": true` để khớp với `eslint.config.js`. Với `typescript-eslint` mới, `parserOptions.projectService: true` tự tìm `tsconfig` gần nhất nhưng vẫn yêu cầu `include` phủ đủ file (hoặc cấu hình `allowDefaultProject`). Không trỏ `tsconfig.build.json` (thiếu test) rồi lint test — “file not in project”.

### 14.2 `rootDir` mặc định `.` vs khai tường minh

Trên **TS 6/7**, nếu không khai `rootDir`, mặc định là **`"."`** (thư mục chứa `tsconfig.json`), **không còn** tự tính common root của các file trong `include` như TS 5.x. Kết quả: với `src/index.ts`, emit sẽ sinh ra `dist/src/index.js` thay vì `dist/index.js` nếu quên đặt `"rootDir": "src"`. **Luôn** khai `rootDir` khớp với `include` trên file emit.

`composite` **đòi hỏi** `rootDir` rõ ràng (cùng `declaration`). Sai rootDir → `.d.ts` path lệch `exports`.

### 14.3 `noEmit` trên CLI vs file

`tsc -p tsconfig.build.json --noEmit` **ghi đè** emit — dùng nhầm script “build” thành typecheck. Script tách tên. `tsc -b --pretty false` CI log.

`incremental` + `noEmit`: vẫn ghi `.tsbuildinfo` (typecheck cache) — gitignore.

`explainFiles` debug “vì sao file này vào program”. `traceResolution` (nặng) khi `exports` types sai.

`listEmittedFiles` lúc build — so với `files` npm pack. `pretty: false` CI.

## 15. Best practices

1. `NodeNext` + `"type": "module"` khi chọn ESM.
2. Giữ `strict` (default TS 7) + `verbatimModuleSyntax`.
3. Chọn một workflow strip vs emit; đừng nửa nạc.
4. Strip? → `erasableSyntaxOnly`; tránh enum/namespace/decorators/param props/`export =`.
5. CI luôn `tsc --noEmit` (tsconfig editor) **và** build `-p tsconfig.build.json` khi publish.
6. `@types/node@^26` với baseline Node 26; `lib` không DOM trên server.
7. Alias runtime qua `#imports`, không chỉ `paths` — Node **không** honor `paths`.
8. `noImplicitOverride` khi dùng class hierarchy.
9. Tách `tsconfig.build.json`; `composite` + `tsc -b` monorepo.
10. `incremental` + gitignore buildinfo; cache CI có chủ đích.
11. `skipLibCheck` app; đừng tưởng nó skip `src`.
12. Tooling cần API → bridge TS 6, kiểm lại khi tool hỗ trợ API mới thực tế.
13. Không `moduleResolution` `node10` / `target es5` — TS 7 error.

---

## 16. Checklist

```text
□ "type": "module" (nếu ESM)
□ module / moduleResolution: NodeNext
□ strict (default true) + verbatimModuleSyntax
□ Strip? erasableSyntaxOnly + noEmit; kiểm runner thật, đặc biệt decorator không được flag chặn
□ Emit? tsconfig.build.json: outDir + declaration nếu publish
□ typescript@^7, @types/node@^26
□ lib khớp target; không DOM thừa
□ skipLibCheck: hiểu phạm vi
□ CI: tsc --noEmit
□ Alias runtime → #imports — không tin paths
□ noImplicitOverride / noUncheckedIndexedAccess cân nhắc
□ Không moduleResolution node/classic; không target es5
□ composite + references nếu monorepo tsc -b
□ incremental / tsbuildinfo gitignore hoặc cache có chủ đích
```

---

## 17. Cheat sheet

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
tsc -b
node src/index.ts
```

| Option | Việc |
|---|---|
| `NodeNext` | ESM/CJS theo package.json + đuôi |
| `erasableSyntaxOnly` | Chặn enum/param props/…; không chặn decorator hay kiểm runtime syntax |
| `verbatimModuleSyntax` | `import type` tường minh |
| `noEmit` | Typecheck-only |
| `composite` | Project references |
| `incremental` | `.tsbuildinfo` |
| `paths` | Chỉ TS — **không** Node |
| `lib` vs `target` | Typings vs emit |

`NodeNext` = thuật toán Node; `paths` không runtime. `erasableSyntaxOnly` chặn enum/param props/import-export assignment/assertion `<>`; decorator cần kiểm runner riêng. TS 7: khai rõ strict/module/target/types/rootDir; tách `tsconfig.build.json`.

`skipLibCheck` không skip `src`. `lib` vs `target` vs runtime. `composite` + `tsc -b` monorepo. `incremental` `.tsbuildinfo` gitignore. `customConditions` cần `--conditions` Node nếu runtime.

---

## 18. Version notes

| Mốc | Thay đổi đáng chú ý |
|---|---|
| TS 5.0+ | `verbatimModuleSyntax`, Stage 3 decorators, `extends` dạng mảng |
| TS 5.5+ | `isolatedDeclarations`, `noUncheckedSideEffectImports` |
| TS 5.8+ | `erasableSyntaxOnly`, `rewriteRelativeImportExtensions` |
| **TS 6.0** | Mặc định mới: `target: "ES2025"`, `strict: true`, `types: []`, `rootDir: "."`, `noUncheckedSideEffectImports: true`, `libReplacement: false`; có sẵn `ESNext.Temporal` trong `lib`; deprecate `baseUrl`, `node10`, `es5`, `downlevelIteration`, `outFile`, `prepend`, … (bước đệm `"ignoreDeprecations": "6.0"`); `module: "Node20"` / `"Node18"` |
| **TS 7.0** | Native Go compiler + LSP; CLI song song (`--checkers` default 4, `--builders`, `--singleThreaded`); **gỡ bỏ hoàn toàn** `baseUrl`, `outFile`, `downlevelIteration`, `prepend`, `importsNotUsedAsValues`, `preserveValueImports`, `charset`, `keyofStringsOnly`, `suppressExcessPropertyErrors`, `suppressImplicitAnyIndexErrors`, `noImplicitUseStrict`, `target: es5`, `moduleResolution: node/node10/classic`, `esModuleInterop: false`; **chưa ship programmatic API** (tool API dùng bridge `@typescript/typescript6`) |
| Node 22.6+ → 24 | Type stripping từ experimental → ổn định dần |
| **Node 26 Active LTS (2026-10-28)** | Type stripping ổn định mặc định; gỡ `--experimental-transform-types`; global `Temporal` mặc định; khớp `@types/node@^26` |

Baseline: **Node 26 Active LTS** + **TypeScript 7.0**.

---

## 19. Tài liệu liên quan

- [Modules & Packages](modules-packages.md)
- [npm / pnpm / yarn & tooling](tooling.md)
- [Decorators & Metadata](decorators.md)
- [Lập trình hướng đối tượng](oop.md) — parameter properties / override
- [Function type, Callback & Lambda](functions-callbacks.md) — `strictFunctionTypes`
- [Entry point & chạy chương trình](main-function.md)
- [Node.js built-ins](nodejs-apis.md)
- [exceptions.md](exceptions.md) — `useUnknownInCatchVariables`
- [Hàm & Method](functions-methods.md) — `using` / lib Disposable

- [Type tests và output validation](testing.md)
- [Compiler benchmark](diagnostics.md)
