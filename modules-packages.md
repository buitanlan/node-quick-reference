# Modules & Packages

*(ESM, CommonJS, `package.json` exports/imports, dual package hazard, `node:`, TypeScript `NodeNext`)*

Baseline: **Node.js 26** (ESM-first), **TypeScript 7**. Node **24** LTS cùng hướng ESM — [node26-ts7.md](node26-ts7.md). Compiler: [tsconfig.md](tsconfig.md). npm/pnpm: [tooling.md](tooling.md).

---

## Mục lục

1. [Hai hệ thống module](#1-hai-hệ-thống-module)
2. [ESM — `import` / `export`](#2-esm--import--export)
3. [CommonJS — `require` / `module.exports`](#3-commonjs--require--moduleexports)
4. [`"type"` và đuôi file](#4-type-và-đuôi-file)
5. [Interop ESM ↔ CJS](#5-interop-esm--cjs)
6. [Dual package hazard](#6-dual-package-hazard)
7. [`package.json`: `exports`, `imports`, `main`, `module`](#7-packagejson-exports-imports-main-module)
8. [Conditional exports sâu](#8-conditional-exports-sâu)
9. [Resolution edge cases & TypeScript `NodeNext`](#9-resolution-edge-cases--typescript-nodenext)
10. [Builtin `node:` & import attributes](#10-builtin-node--import-attributes)
11. [Circular dependencies](#11-circular-dependencies)
12. [Publishing checklist](#12-publishing-checklist)
13. [Best practices](#13-best-practices)
14. [Checklist](#14-checklist)
15. [Cheat sheet](#15-cheat-sheet)
16. [Version notes](#16-version-notes)
17. [Tài liệu liên quan](#17-tài-liệu-liên-quan)

---

## 1. Hai hệ thống module

| | **ESM** | **CommonJS (CJS)** |
|---|---|---|
| Cú pháp | `import` / `export` | `require` / `module.exports` |
| Load | bất đồng bộ, static analysis | đồng bộ |
| `__dirname` / `__filename` | qua `import.meta` | có sẵn |
| Top-level await | có | không |
| Khuyến nghị Node 26 | **mặc định code mới** | legacy / dual publish |

File `.js` là ESM hay CJS phụ thuộc **`"type"` gần nhất** và/hoặc đuôi (`.mjs` / `.cjs`).

> Node không đoán theo nội dung `import` vs `require` trong `.js` — sai `"type"` → parse error hoặc semantics lệch.

---

## 2. ESM — `import` / `export`

### 2.1 Export / import

```ts
export const VERSION = "1.0.0";
export function add(a: number, b: number) {
  return a + b;
}
export { internalHelper as helper };
export default class App {
  start() {}
}
export { readFile } from "node:fs/promises";
export * from "./utils.js";

import App, { VERSION, add, helper } from "./app.js";
import * as math from "./math.js";
import "./polyfill.js"; // side-effect
```

**Node ESM:** relative import **cần đuôi** (`.js`, …). Với TS `NodeNext`: viết `from "./app.js"` dù nguồn là `app.ts`. Bare specifier đi qua `node_modules` + `exports`.

### 2.2 Dynamic `import()` & top-level await

```ts
const mod = await import(`./plugins/${name}.js`);

// TLA — chỉ ESM; importer chờ evaluate xong
const config = await import("./config.js");
```

Lazy/conditional load; CJS → ESM. Đừng TLA nặng ở entry library (cold start + khó CJS consumer).

---

## 3. CommonJS — `require` / `module.exports`

```js
// math.cjs
module.exports = { add(a, b) { return a + b; } };
// hoặc: exports.add = add; — đừng gán lại exports = {...}

const { add } = require("./math.cjs");
const path = require("node:path");
```

- `require` **đồng bộ**, cache theo absolute path.
- Có `__dirname`, `__filename`, `require.main`.

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

---

## 4. `"type"` và đuôi file

```json
{
  "name": "my-app",
  "type": "module",
  "exports": "./dist/index.js"
}
```

| File | `"type":"module"` | `"type":"commonjs"` / không khai báo |
|---|---|---|
| `.js` | ESM | CJS |
| `.mjs` | luôn ESM | luôn ESM |
| `.cjs` | luôn CJS | luôn CJS |
| `.ts` (strip-types) | theo `"type"` + cấu hình | theo `"type"` |

Dự án mới: `"type": "module"`; `.cjs` chỉ khi tool bắt buộc.

---

## 5. Interop ESM ↔ CJS

### 5.1 ESM → CJS

```ts
import pkg from "some-cjs-package";
import * as ns from "some-cjs-package";
// Named import dựa synthetic named exports — không 100% với mọi package
import cjs from "lodash";
const { debounce } = cjs; // an toàn hơn khi nghi ngờ
```

### 5.2 CJS → ESM & `createRequire`

```js
// CJS không require() ESM thuần ổn định → dynamic import
async function main() {
  const { default: App } = await import("./app.mjs");
  new App().start();
}
```

```ts
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pkg = require("./legacy.cjs");
const data = require("./data.json"); // sync từ ESM
```

| Từ → Sang | Cách | Sync? |
|---|---|---|
| ESM → CJS | `import` default / namespace | sau load |
| CJS → ESM | `await import()` | **không** |
| ESM → sync CJS/JSON | `createRequire` | có |
| CJS → CJS | `require` | có |

---

## 6. Dual package hazard

Publish **cả** ESM và CJS (hai file / hai đường resolve) có thể evaluate **hai lần** cùng logical module → hai singleton:

Triệu chứng: `instanceof` fail, config/`Map` không chia sẻ, `===` giữa “cùng” export = `false`.

**Nguyên nhân thường gặp:**

1. `exports`: `import` → `.js`, `require` → `.cjs` khác nhau.
2. Bundler lấy một bản, Node lấy bản kia.
3. App trộn `require("pkg")` và `import "pkg"`.
4. Thiếu `exports` → tool lấy `module` (ESM) trong khi Node lấy `main` (CJS).

| Chiến lược | Mô tả |
|---|---|
| **ESM-only** | Chỉ `import` trong `exports`; CJS dùng `import()` |
| **CJS facade mỏng** | `.cjs` bridge; state một nơi |
| **`exports` khớp `main`** | Không để `main`/`module` lệch |
| Document | Tránh require+import cùng pkg nếu dual |

> Node gọi đây **dual package hazard**. Library mới trên Node 26: ưu tiên **ESM-only**.

```json
{
  "name": "@acme/sdk",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "default": "./dist/index.js"
    }
  }
}
```

`index.cjs` nên facade mỏng — không nhân đôi business + singleton.

---

## 7. `package.json`: `exports`, `imports`, `main`, `module`

### 7.1 `exports` thắng

```json
{
  "name": "@acme/sdk",
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./utils": "./dist/utils.js",
    "./package.json": "./package.json"
  }
}
```

```ts
import { Client } from "@acme/sdk";
import { trim } from "@acme/sdk/utils";
// "@acme/sdk/dist/index.js" → ERR_PACKAGE_PATH_NOT_EXPORTED nếu không export
```

| Field | Vai trò Node hiện đại | Ghi chú |
|---|---|---|
| `exports` | **Nguồn sự thật** | Ưu tiên khi có |
| `main` | Fallback tool cũ | Giữ khớp `exports["."]` |
| `module` | **Không** field Node chính thức | Bundler lịch sử |
| `types` / conditional `types` | TypeScript | Trong `exports` |
| `files` | npm pack whitelist | Kiểm soát tarball |

### 7.2 `imports` — alias `#`

```json
{
  "imports": {
    "#lib/*": "./src/lib/*.js",
    "#config": "./src/config.js"
  }
}
```

```ts
import { db } from "#lib/db.js";
import config from "#config";
```

**Runtime Node hiểu `#imports`** — khác `tsconfig.paths` (chỉ typecheck trừ bundler/loader).

---

## 8. Conditional exports sâu

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": {
        "node": "./dist/index.node.js",
        "default": "./dist/index.js"
      },
      "require": "./dist/index.cjs",
      "default": "./dist/index.js"
    }
  }
}
```

| Condition | Ai set | Ý nghĩa |
|---|---|---|
| `types` | TypeScript / tooling | `.d.ts` |
| `import` | ESM `import` / `import()` | |
| `require` | `require()` | |
| `node` | Node runtime | Nhánh Node |
| `default` | Fallback | Nên luôn có |
| `browser` / … | Môi trường tương ứng | Tùy ecosystem |

- **Thứ tự key có ý nghĩa** — đặt `types` **trước** `import`/`require` (khuyến nghị TS).
- Wildcard `"./*": "./dist/*.js"` dễ lộ nội bộ — ưu tiên liệt kê subpath public.

> Có `exports` thì deep import `pkg/dist/secret.js` bị chặn — tính năng, không bug.

---

## 9. Resolution edge cases & TypeScript `NodeNext`

### 9.1 Skeleton & hành vi

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "verbatimModuleSyntax": true,
    "strict": true,
    "types": ["node"]
  }
}
```

Chi tiết: [tsconfig.md](tsconfig.md).

| Hành vi `NodeNext` | Hệ quả |
|---|---|
| Bám Node (`exports`, đuôi) | `from "./foo"` thiếu đuôi → lỗi |
| Tôn trọng `"type"` + `.mts`/`.cts` | Khớp ESM/CJS |
| Conditional `types` trong `exports` | Publish đúng `.d.ts` |
| `paths` không rewrite runtime | Dùng `#imports` hoặc relative |

```ts
// app.ts — đúng NodeNext / Node ESM
import { util } from "./util.js"; // → util.ts nguồn / util.js emit
```

`rewriteRelativeImportExtensions` có thể cho `from "./util.ts"` rồi emit `.js` — convention phổ biến vẫn viết `.js` trong nguồn.

### 9.2 `main` / `module` / `exports` lệch

```json
{
  "main": "./legacy/index.js",
  "module": "./esm/index.js",
  "exports": { ".": "./dist/index.js" }
}
```

Node (có `exports`) → `./dist/index.js`; bundler cũ có thể lấy `module` → **dual hazard / type lệch**. Một truth = `exports`; `main` chỉ mirror.

### 9.3 Alias: TS vs runtime

| Cách | Runtime Node? | Ghi chú |
|---|---|---|
| `#imports` | Có | Khuyến nghị app ESM |
| Bundler rewrite | Sau bundle | OK |
| `tsx` / loader | Dev | Cẩn thận prod |
| Chỉ `tsconfig.paths` | **Không** | TS xanh, Node đỏ |

---

## 10. Builtin `node:` & import attributes

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
```

- Tránh conflict npm trùng tên; **luôn** `node:` trong code mới.
- Subpath: `node:fs/promises`, `node:stream/promises`, `node:timers/promises`, `node:dns/promises`.

```ts
import data from "./config.json" with { type: "json" };
const mod = await import("./config.json", { with: { type: "json" } });
```

- Dùng `with` (không dùng `assert` cũ).
- Thống nhất JSON qua `with` **hoặc** `createRequire` — đừng trộn lung tung trong cùng app.

```bash
node -e "console.log(require('node:module').builtinModules)"
```

---

## 11. Circular dependencies

**ESM:** cycle được với live bindings, nhưng đọc quá sớm → TDZ / `ReferenceError`:

```ts
// b.js
import { a } from "./a.js";
export const b = a + 1; // nguy hiểm nếu a chưa init
```

**CJS:** `require` cycle trả `module.exports` đang xây → property `undefined` im lặng.

| Cách tránh | Chi tiết |
|---|---|
| Shared `constants` / `types` | Không import ngược |
| Dependency inversion | Interface + inject |
| Lazy `import()` trong hàm | Tránh top-level cycle |
| Gộp module | Nếu luôn đi cùng |
| Tool | `madge`, `dpdm`, `import/no-cycle` |

> Cycle “chạy được” ≠ thiết kế tốt. Public API nên **zero cycle**.

---

## 12. Publishing checklist

```text
□ name, version, type đúng
□ exports đủ entry public; conditional types → import → require → default
□ main khớp exports["."]
□ files / .npmignore — không leak test/.env
□ .d.ts đúng; types trong exports
□ npm pack --dry-run / pnpm pack
□ Cài tarball vào fixture ESM (+ CJS nếu dual)
□ Dual: test singleton/instanceof — hoặc ESM-only
□ LICENSE, README, repository; engines.node nếu cần
```

```json
{
  "name": "@acme/sdk",
  "version": "1.0.0",
  "type": "module",
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "engines": { "node": ">=24" }
}
```

---

## 13. Best practices

1. Mới: `"type":"module"`, `node:*`, đuôi `.js` relative.
2. Publish: `exports` chặt + `types` conditional + `files` whitelist.
3. Tránh mixed ESM/CJS — `.cjs` rõ khi bắt buộc.
4. Hiểu dual hazard trước khi ship `import` + `require` khác file.
5. `createRequire` cho sync CJS/JSON; `import()` khi CJS cần ESM.
6. Alias runtime → `#imports`; đừng chỉ `paths`.
7. TS: `module` / `moduleResolution` = **`NodeNext`**.
8. Tôn trọng `exports` người khác — không deep-import `dist` nội bộ.
9. JSON: một convention (`with` hoặc `createRequire`).
10. CI: `npm pack` + install consumer tối thiểu mỗi release.

---

## 14. Checklist

```text
□ "type" tường minh
□ Relative ESM có đuôi
□ tsconfig NodeNext
□ Không phụ thuộc field "module" cho Node runtime
□ exports có default; types trước import/require
□ Không cycle ở public API
□ Dual đã test singleton — hoặc ESM-only
□ #imports thay paths nếu cần alias runtime
□ Builtin luôn node:
□ Publish: files + dry-run pack + thử install
```

---

## 15. Cheat sheet

```ts
import fs from "node:fs/promises";
import cfg from "./config.json" with { type: "json" };
import { x } from "#lib/x.js";
const mod = await import("./plugin.js");

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
```

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "default": "./dist/index.js"
    }
  },
  "imports": { "#lib/*": "./dist/lib/*.js" }
}
```

| Nhu cầu | Chọn |
|---|---|
| App Node mới | ESM + `NodeNext` |
| Legacy CJS | `.cjs` / `"type":"commonjs"` cục bộ |
| Alias runtime | `#imports` |
| Load ESM từ CJS | `await import()` |
| Tránh dual hazard | ESM-only hoặc facade mỏng |

---

## 16. Version notes

| Dòng | Ghi chú |
|---|---|
| **Node 26** + **TS 7** | ESM-first; `NodeNext`; TS 7 từ chối `moduleResolution` cổ |
| Node 24 LTS | Cùng hướng `exports` / ESM |
| `exports` / `imports` | Ổn định; conditional `types` quan trọng với TS |
| Import attributes `with` | Thay `assert`; JSON modules |
| `node:` | Khuyến nghị bắt buộc style mới |
| `require(ESM)` | Không phải đường chính — ưu tiên `import()` |
| Dual package hazard | Vẫn đúng khi hai artifact — thiết kế có ý thức |

---

## 17. Tài liệu liên quan

- [tsconfig & biên dịch TypeScript](tsconfig.md)
- [npm / pnpm / yarn & tooling](tooling.md)
- [Node.js built-ins](nodejs-apis.md)
- [Entry point & chạy chương trình](main-function.md)
- [Node 26 & TypeScript 7 highlights](node26-ts7.md)
