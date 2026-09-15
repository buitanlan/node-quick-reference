# tsconfig & biên dịch TypeScript

`compilerOptions` then chốt cho Node ESM, type stripping, và project references trên **TypeScript 7** + **Node.js 26**.

> **Callout:** Mục tiêu phổ biến: `module` / `moduleResolution`: **`NodeNext`**, `strict: true` (mặc định TS 7), và chọn rõ workflow **strip-types** vs **`tsc` emit** vs **tsx**. `paths` **không** chạy trên Node. Xem [tooling.md](tooling.md).

---

## Mục lục

1. [Vai trò `tsconfig.json`](#1-vai-trò-tsconfigjson)
2. [Skeleton khuyến nghị (Node ESM)](#2-skeleton-khuyến-nghị-node-esm)
3. [TS 7 defaults & breaking](#3-ts-7-defaults--breaking)
4. [`module` / `moduleResolution` / thuật toán NodeNext](#4-module--moduleresolution--thuật-toán-nodenext)
5. [`target`, `lib`, `skipLibCheck`, JSX](#5-target-lib-skiplibcheck-jsx)
6. [`strict` và an toàn kiểu](#6-strict-và-an-toàn-kiểu)
7. [`verbatimModuleSyntax`](#7-verbatimmodulesyntax)
8. [`erasableSyntaxOnly` — danh sách cấm](#8-erasablesyntaxonly--danh-sách-cấm)
9. [`noEmit` / emit / `outDir`](#9-noemit--emit--outdir)
10. [Ba cách chạy TypeScript trên Node](#10-ba-cách-chạy-typescript-trên-node)
11. [`@types/node`](#11-typesnode)
12. [Path aliases vs runtime](#12-path-aliases-vs-runtime)
13. [Project references, `composite`, incremental](#13-project-references-composite-incremental)
14. [`tsconfig.build.json` split](#14-tsconfigbuildjson-split)
15. [Best practices](#15-best-practices)
16. [Checklist](#16-checklist)
17. [Cheat sheet](#17-cheat-sheet)
18. [Version notes](#18-version-notes)
19. [Tài liệu liên quan](#19-tài-liệu-liên-quan)

---

## 1. Vai trò `tsconfig.json`

- Bảo TypeScript **cách kiểm tra kiểu** và (tuỳ chọn) **emit** JS / `.d.ts`.
- Editor đọc `tsconfig` cho IntelliSense.
- Không thay `package.json` `"type"` — module runtime vẫn do Node quyết định.

Nhiều file: `tsconfig.json` (base / editor), `tsconfig.build.json` (emit), `tsconfig.eslint.json` (scope lint). `extends` chuỗi — option con **ghi đè**; `include` **không** inherit như nghĩ — file con phải khai `include` nếu không dùng mặc định.

`tsc -p tsconfig.json` chọn project. Không `-p` → tìm `tsconfig.json` gần CWD.

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

`exclude` **không** thắng `include` nếu file đã nằm trong project references khác — đọc handbook khi monorepo “vẫn typecheck test”.

---

## 3. TS 7 defaults & breaking

TS 7 (và 6.0 language defaults) **cứng** hơn 5.x:

| Option / hành vi | TS 7 |
|---|---|
| `strict` | Mặc định **`true`** |
| `moduleResolution: "node"` / `node10` / `classic` | **Error** (removed) |
| `target: es5` (và vài target cổ) | **Error** |
| `esModuleInterop: false` / `alwaysStrict: false` | **Error** (chỉ còn `true`) |
| `module` `amd` / `umd` / `system` / `none` | Loại khỏi đường Node hiện đại |
| Ngữ nghĩa ngôn ngữ | Gần parity **6.0** |
| Compiler | Go ~8–12× full build; `--checkers` / `--builders` / `--singleThreaded` |
| Programmatic API | Ổn định khoảng **7.1**; tool cũ → `@typescript/typescript6` |

Migrate:

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2024"
  }
}
```

App bundler (Vite): `moduleResolution: "bundler"` + `module: "preserve"` / `esnext` — **không** copy vào package Node thuần (`exports` / đuôi).

Tạm `"strict": false` khi nâng — **issue/TODO**; đừng để mặc định mới “tắt im”.

`baseUrl` thay đổi trên dòng 6/7 (một số combo cấm / `paths` cần `./` prefix) — đọc error TS5108, đừng giữ `baseUrl: "."` mù. Runtime vẫn **không** honor `paths` — §12.

---

## 4. `module` / `moduleResolution` / thuật toán NodeNext

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

`rewriteRelativeImportExtensions`: nguồn `from "./a.ts"` → emit `./a.js`. Strip `node a.ts`: Node không rewrite import `.ts` trong graph trừ khi chạy từng file — **ưu tiên viết `.js` specifier** cho ESM Node.

---

## 5. `target`, `lib`, `skipLibCheck`, JSX

Ba nút **khác nhau**:

| Option | Việc | Không phải |
|---|---|---|
| `target` | JS **emit** (downlevel syntax: optional chaining, …) | Không thêm typings DOM |
| `lib` | **Typings** built-in (`Promise`, `Temporal` nếu có trong lib, `Array`) | Không đổi emit |
| `skipLibCheck` | **Bỏ** typecheck `.d.ts` trong `node_modules` | Không bỏ check **code bạn** |

- Node 26 hiểu ES2024+ khá đầy đủ → `target` **`ES2024`** hoặc **`ESNext`**. TS 7: **`es5` error**.
- `lib` thường **khớp** `target` (`["ES2024"]`). `lib` thấp hơn `target` → thiếu type iterator mới; `lib` có DOM trên server → `document` “tồn tại” giả — **đừng** trừ khi share browser.
- Temporal: theo dõi `lib` / `@types/node` — có thể cần ambient nếu global chưa có trong types. Node 26 runtime có Temporal; types có thể trễ.
- `jsx` chỉ khi React/JSX (`react-jsx`). API Node thuần: không `jsx`.

`skipLibCheck: true` (khuyến nghị app): `.d.ts` dependency xung đột `@types` không chặn bạn. **Không** che lỗi trong `src`. Lib **publish** `.d.ts` của mình vẫn bị check khi `declaration` — đó là code bạn.

`skipDefaultLibCheck` hẹp hơn — ít dùng.

### 5.1 `lib` thực dụng Node 26

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024"]
  }
}
```

Thêm `"DOM"` chỉ khi file chạy browser/edge. `lib: ["ESNext"]` + `target: ES2024` → type API **mới hơn** emit — có thể gọi hàm runtime Node 26 chưa có nếu lib quá đà. Khớp **lib ≤ runtime**.

`@types/node` **bổ sung** `Buffer`, `process`, modules `node:*` — không thay `lib` cho `Promise`/`Array`.

Thiếu `Temporal` trong types: ambient `declare const Temporal: typeof import("temporal-polyfill")` **hoặc** chờ `@types/node` — đừng `any`.

`downlevelIteration` / `importHelpers` (`tslib`): TS 7 + `target` cao **ít** cần. `es5` đã cấm.

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

Khi publish `.d.ts` và muốn emit nhanh/an toàn hơn, theo dõi option kiểu `isolatedDeclarations` (TS 5.5+) — yêu cầu type annotation đủ trên export để generate declarations không cần inference toàn chương trình. Hữu ích monorepo lớn; có thể ồn trên codebase cũ — bật có chủ đích.

Không bắt buộc cho app nội bộ chỉ `noEmit` + strip.

### 6.3 Lỗi TS 7 thường gặp khi nâng

| Thông báo (ý) | Sửa |
|---|---|
| `moduleResolution=node10` removed | `"moduleResolution": "NodeNext"` (Node) hoặc `"bundler"` |
| `target=ES5` removed | `"target": "ES2024"` / `ES2015+` |
| `esModuleInterop=false` removed | Bỏ flag (luôn true) |
| `strict` bật, `null` lan | Sửa code; tạm `strictNullChecks` trong migrate từng package |
| `baseUrl` / `paths` rewrite | `"./src/*"`; runtime vẫn `#imports` |
| Plugin ESLint không nhận TS 7 | `@typescript/typescript6` bridge / chờ plugin |

`npx tsc -v` **phải** trùng `node_modules/typescript`. Editor “Use Workspace Version”. CI `pnpm exec tsc -v`.

### 6.4 `files`, `include`, `exclude`, `extends`

- `include` mặc định `**/*` nếu thiếu — kéo nhầm `scripts/`, `dist/`.
- `exclude` mặc định `node_modules`, `bower_components`, `jspm_packages`, `outDir`. **Không** exclude `dist` nếu `outDir` đã là `dist` (vẫn nên ghi rõ).
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

`noUncheckedSideEffectImports` (dòng mới): `import "./polyfill.js"` phải resolve. Bật khi có.

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
| **Decorators `@dec`** | HOF hoặc tắt flag + tsc/tsx | Runtime — [decorators.md](decorators.md) |

**Được:** `type` / `interface` / `as` / `satisfies` / generics / `import type`.

Mục tiêu: `.ts` chạy được trên Node type stripping mà không cần transpile đầy đủ. Chi tiết decorator: [decorators.md](decorators.md). OOP fields: [oop.md](oop.md).

Node 26 **không** `--experimental-transform-types` — enum **không** “tự thành JS” lúc `node file.ts`.

CI: bật flag trên `tsconfig` mà `dev` dùng strip. Pipeline `tsc` emit **có thể** tắt `erasableSyntaxOnly` nếu cố dùng enum — **đừng** mix: một nhánh strip, một nhánh enum.

> **Callout:** `erasableSyntaxOnly` **FORBIDS decorators**. Không có “decorator type-only”. Chọn HOF hoặc emit.

### 8.1 Ví dụ cấm / được

```ts
// CẤM
enum E { A, B }
namespace N { export const x = 1; }
class P { constructor(public x: number) {} }
import fs = require("node:fs");
export = P;
const n = <number>1;
class C { @logged m() {} }

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

`isolatedModules: true` (transpile từng file — esbuild/tsx): cấm `const enum` re-export type không `type`, v.v. **Khác** `erasableSyntaxOnly` nhưng chồng lên. Strip + tsx: bật cả hai hợp lý.

`preserveValueImports` đã thay bằng `verbatimModuleSyntax` — đừng flag cũ.

### 8.3 Bảng “cấm” in ra compiler

TS error khi `erasableSyntaxOnly`: parameter property highlight trên `public x`. Enum: toàn bộ `enum` block. Decorator: `@` trên class/member. `export =` trên file CJS-style.

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

`types: ["node"]` **không** load `@types/foo` khác tự động — thêm vào mảng hoặc bỏ `types` để load hết `@types/*` (ồn). Test: `"types": ["node"]` + import `node:test`.

`--noEmit` vẫn cần types để check `fetch`, `Buffer`, `Temporal` (nếu có trong bản types).

---

## 12. Path aliases vs runtime

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

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

TS 7: `baseUrl` có thể bị hạn chế; `paths` relative `"./src/*"`. Dù editor OK — **vẫn** không phải runtime Node.

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

`references`: `path` tới folder/`tsconfig`. `prepend` **cũ** (concat emit) — **không** dùng cho Node ESM. Mỗi package `outDir` riêng.

Circular reference → `tsc -b` error. Giống cycle module: tách `types` package.

`disableSourceOfProjectReferenceRedirect`: editor dùng `.d.ts` thay `.ts` nguồn package kia — chậm hơn DX, gần prod. Mặc định TS nhảy source — tiện, có thể “xanh editor, đỏ dist” nếu `exports` lệch.

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
    "sourceMap": true,
    "erasableSyntaxOnly": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

`extends` **không** merge `include` — **khai lại** `include`/`exclude`. `noEmit: false` ghi đè base.

`erasableSyntaxOnly` trên base (strip/dev) có thể **false** trên build nếu emit enum — **tốt hơn** không dùng enum cả hai.

Scripts:

```json
{
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "build": "tsc -p tsconfig.build.json"
  }
}
```

ESLint `parserOptions.project`: trỏ `tsconfig.json` (có test) hoặc `tsconfig.eslint.json` `include` đúng file lint — tránh “file not in project”.

Library: `tsconfig.build.json` + `composite` nếu nằm workspace `references`.

### 14.1 `tsconfig.eslint.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src/**/*.ts", "test/**/*.ts", "eslint.config.js"]
}
```

Typed lint **cần** file nằm trong project. `allowJs` nếu lint `eslint.config.js`. Không trỏ `tsconfig.build.json` (thiếu test) rồi lint test — “file not in project”.

### 14.2 `rootDir` computed vs khai

Nếu không set `rootDir`, TS lấy common root của `include` — thêm `test/foo.ts` đẩy `dist/src/index.js` (thêm tầng `src`). **Luôn** `rootDir` + `include` khớp trên file emit.

`composite` **đòi hỏi** `rootDir` rõ ràng (cùng `declaration`). Sai rootDir → `.d.ts` path lệch `exports`.

### 14.3 `noEmit` trên CLI vs file

`tsc -p tsconfig.build.json --noEmit` **ghi đè** emit — dùng nhầm script “build” thành typecheck. Script tách tên. `tsc -b --pretty false` CI log.

`incremental` + `noEmit`: vẫn ghi `.tsbuildinfo` (typecheck cache) — gitignore.

`explainFiles` debug “vì sao file này vào program”. `traceResolution` (nặng) khi `exports` types sai.

`listEmittedFiles` lúc build — so với `files` npm pack. `pretty: false` CI.

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

**Thiếu** `"types"` → `NodeNext` có thể không tìm `.d.ts` cạnh `main`. Sửa:

```json
{
  "exports": {
    ".": {
      "types": "./esm/index.d.ts",
      "import": "./esm/index.js",
      "require": {
        "types": "./cjs/index.d.cts",
        "default": "./cjs/index.js"
      }
    }
  }
}
```

`customConditions` không thay `"types"` đầu. `traceResolution` log “Matched 'types' condition”.

File `.d.cts` cho CJS types (`export =` **cấm** nếu erasable trên **nguồn**; `.d.cts` emit từ `.cts`). Dual: `index.d.ts` ESM, `index.d.cts` CJS. `typesVersions` **không** cứu khi có `exports`.

`disableSourceOfProjectReferenceRedirect` ảnh hưởng eslint-type-aware monorepo — thống nhất với editor.

`parserOptions.projectService` (typescript-eslint): tự tìm tsconfig — vẫn cần `include` đủ. `EXPERIMENTAL_useProjectService` tên cũ — theo docs plugin **đúng bản**.

> **Callout:** Một `tsconfig` vừa `noEmit` vừa quên `build` `-p` khác → ship nhầm / không có `dist`. Hai file, hai script, CI chạy cả hai.

---

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
12. Tooling API cũ → bridge cho tới ~TS 7.1.
13. Không `moduleResolution` `node10` / `target es5` — TS 7 error.

---

## 16. Checklist

```text
□ "type": "module" (nếu ESM)
□ module / moduleResolution: NodeNext
□ strict (default true) + verbatimModuleSyntax
□ Strip? erasableSyntaxOnly + noEmit + tránh non-erasable (kể cả decorator)
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
| `erasableSyntaxOnly` | Khớp Node strip; cấm enum/decorator/… |
| `verbatimModuleSyntax` | `import type` tường minh |
| `noEmit` | Typecheck-only |
| `composite` | Project references |
| `incremental` | `.tsbuildinfo` |
| `paths` | Chỉ TS — **không** Node |
| `lib` vs `target` | Typings vs emit |

`NodeNext` = thuật toán Node; `paths` không runtime; `erasableSyntaxOnly` cấm enum/decorator/param props/`export =`/`import =`/`<>`. TS 7: `strict` true, `node10`/`es5` error. Tách `tsconfig.build.json`.

`skipLibCheck` không skip `src`. `lib` vs `target` vs runtime. `composite` + `tsc -b` monorepo. `incremental` `.tsbuildinfo` gitignore. `customConditions` cần `--conditions` Node nếu runtime.

---

## 18. Version notes

| Nền | Liên quan |
|---|---|
| TS 5+ | `verbatimModuleSyntax`, Stage 3 decorators |
| TS 5.5+ | `isolatedDeclarations` (theo dõi) |
| TS 5.8+ | `erasableSyntaxOnly` |
| **TS 6–7** | `strict` default; cấm `node10` / `es5`; compiler Go (7) |
| **TS 7** | API ~7.1; `--checkers` / `--builders` |
| Node 22.6+ | type stripping experimental |
| **Node 26** | strip ổn định; không transform-types |
| `@types/node` | major khớp Node |
| `rewriteRelativeImportExtensions` | `.ts` specifier → emit `.js` |
| `customConditions` | khớp `node --conditions` nếu dùng |

`verbatimModuleSyntax` + `erasableSyntaxOnly` = strip. `paths` ≠ runtime.

`include`/`exclude` không inherit như `compilerOptions`. `tsc -b --clean` khi cache bẩn. `@tsconfig/node26` làm base.

`types: ["node"]` hạn chế auto `@types/*`. `declaration` + `files: ["dist"]` khớp path `exports`.

`module` vs `moduleResolution` cặp `NodeNext`. Không `DOM` lib trên server. `skipLibCheck: true` app. `noImplicitOverride` class. `forceConsistentCasingInFileNames`.

Editor “Use Workspace Version” TypeScript 7. `isolatedModules` + strip/tsx. `allowImportingTsExtensions` chỉ noEmit/bundler. `resolvePackageJsonExports` giữ bật.

`emitDeclarationOnly` khi JS do bundler. `sourceMap` prod debug. `tsconfig.eslint.json` include test + config JS.

`rootDir` + `include` khớp để `dist/` không thêm tầng. `composite` bắt `declaration`. `disableSourceOfProjectReferenceRedirect` gần prod types.

`listEmittedFiles` so tarball. `pretty: false` CI. `explainFiles` khi file lạ vào program. `assumeChangesOnlyAffectDirectDependencies` watch cẩn thận.

`jsx` chỉ React. Temporal types theo `@types/node`/lib. `useUnknownInCatchVariables` trong `strict`. `exactOptionalPropertyTypes` tùy chọn.

`noFallthroughCasesInSwitch`. `isolatedDeclarations` lib lớn. `tsBuildInfoFile` đặt `.tsbuildinfo`. `extends` array TS 5+ không concat `include`.

`maxNodeModuleJsDepth` tránh. Dual app: tsconfig server vs DOM tách.

Baseline: **Node 26** + **TS 7**.

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
