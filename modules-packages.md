# Modules & Packages

*(ESM, CommonJS, `package.json` exports/imports, `node:` builtins)*

Baseline: **Node.js 26** (ESM-first), **TypeScript 7**. Node **24** Maintenance LTS cùng hướng ESM; khác biệt chủ yếu API mới (Temporal, `getOrInsert`, …).

---

## Mục lục

- [Modules \& Packages](#modules--packages)
  - [Mục lục](#mục-lục)
  - [1. Hai hệ thống module](#1-hai-hệ-thống-module)
  - [2. ESM — `import` / `export`](#2-esm--import--export)
    - [2.1 Export](#21-export)
    - [2.2 Import](#22-import)
    - [2.3 Dynamic `import()`](#23-dynamic-import)
    - [2.4 Top-level await](#24-top-level-await)
  - [3. CommonJS — `require` / `module.exports`](#3-commonjs--require--moduleexports)
  - [4. Chọn ESM hay CJS: `"type"` và đuôi file](#4-chọn-esm-hay-cjs-type-và-đuôi-file)
  - [5. Interop ESM ↔ CJS](#5-interop-esm--cjs)
    - [5.1 ESM import CJS](#51-esm-import-cjs)
    - [5.2 CJS load ESM — `createRequire` \& dynamic import](#52-cjs-load-esm--createrequire--dynamic-import)
  - [6. `package.json`: `exports`, `imports`, `main`](#6-packagejson-exports-imports-main)
    - [6.1 `exports` map](#61-exports-map)
    - [6.2 Conditional exports](#62-conditional-exports)
    - [6.3 `imports` (subpath aliases nội bộ)](#63-imports-subpath-aliases-nội-bộ)
  - [7. Builtin modules — `node:` protocol](#7-builtin-modules--node-protocol)
  - [8. Path aliases: TypeScript vs runtime](#8-path-aliases-typescript-vs-runtime)
  - [9. Best practices](#9-best-practices)

---

## 1. Hai hệ thống module

| | **ESM** (ECMAScript Modules) | **CommonJS (CJS)** |
|---|---|---|
| Cú pháp | `import` / `export` | `require` / `module.exports` |
| Load | bất đồng bộ, static analysis | đồng bộ |
| `__dirname` / `__filename` | không có sẵn → dùng `import.meta` | có sẵn |
| Top-level await | có | không |
| Khuyến nghị Node 26 | **mặc định cho code mới** | legacy / tương thích |

Một file `.js` là ESM hay CJS phụ thuộc **`"type"` trong `package.json` gần nhất** và/hoặc **đuôi file** (`.mjs` / `.cjs`).

---

## 2. ESM — `import` / `export`

### 2.1 Export

```ts
// named exports
export const VERSION = "1.0.0";
export function add(a: number, b: number) {
  return a + b;
}

// rename khi export
function internalHelper() {}
export { internalHelper as helper };

// default export (một module nên có tối đa một default)
export default class App {
  start() {}
}

// re-export
export { readFile } from "node:fs/promises";
export * from "./utils.js";
```

### 2.2 Import

```ts
import App, { VERSION, add, helper } from "./app.js";
import * as math from "./math.js";
import { readFile as read } from "node:fs/promises";

// side-effect import (chạy module, không lấy binding)
import "./polyfill.js";
```

**Lưu ý Node ESM:**

- Phải kèm **đuôi file** khi import relative (`.js`, `.mjs`, …) trừ khi dùng bundler / loader đặc biệt.
- Với TypeScript emit `nodenext`: viết `from "./app.js"` dù nguồn là `app.ts` (Node resolve theo file đã emit / strip).

### 2.3 Dynamic `import()`

```ts
async function loadPlugin(name: string) {
  const mod = await import(`./plugins/${name}.js`);
  return mod.default;
}
```

- Trả về `Promise`. Dùng khi cần lazy-load, conditional load, hoặc load ESM từ CJS.

### 2.4 Top-level await

```ts
// chỉ hợp lệ trong ESM
const config = await import("./config.js");
const data = await fetch("https://example.com/api").then((r) => r.json());
```

Module chờ TLA xong mới “evaluate xong”; importer sẽ await gián tiếp.

---

## 3. CommonJS — `require` / `module.exports`

```js
// math.cjs
function add(a, b) {
  return a + b;
}
module.exports = { add };
// hoặc: exports.add = add;
```

```js
const { add } = require("./math.cjs");
const path = require("node:path");
const fs = require("fs"); // vẫn chạy; nên dùng node:
```

Đặc điểm:

- `require` **đồng bộ**, cache theo absolute path.
- `module.exports = ...` thay thế toàn bộ export; `exports.foo = ...` gắn property (đừng gán lại `exports = ...`).
- Có `__dirname`, `__filename`, `require.main`, `module.parent` (deprecated một phần).

Tương đương ESM:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

---

## 4. Chọn ESM hay CJS: `"type"` và đuôi file

```json
{
  "name": "my-app",
  "type": "module",
  "main": "./dist/index.js",
  "exports": "./dist/index.js"
}
```

| File | Với `"type":"module"` | Với `"type":"commonjs"` / không khai báo |
|---|---|---|
| `.js` | ESM | CJS |
| `.mjs` | luôn ESM | luôn ESM |
| `.cjs` | luôn CJS | luôn CJS |
| `.ts` (Node strip-types) | theo `"type"` + cấu hình | theo `"type"` |

Khuyến nghị dự án mới:

```json
{ "type": "module" }
```

và dùng `.cjs` chỉ khi bắt buộc (script legacy, config tool cũ).

---

## 5. Interop ESM ↔ CJS

### 5.1 ESM import CJS

```ts
import pkg from "some-cjs-package";
import * as ns from "some-cjs-package";
```

- Default import thường nhận `module.exports`.
- Named import từ CJS **có thể** hoạt động nhờ Node “synthetic named exports”, nhưng không đáng tin 100% với mọi package → ưu tiên default + destructure:

```ts
import cjs from "lodash";
const { debounce } = cjs;
```

### 5.2 CJS load ESM — `createRequire` & dynamic import

CJS **không** `require()` được ESM thuần:

```js
// ❌ require("./esm-only.mjs") → ERR_REQUIRE_ESM (tùy phiên bản/cờ)
```

**Từ ESM tạo `require` (đọc CJS / JSON / builtin):**

```ts
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("./legacy.cjs");
const data = require("./data.json");
```

**Từ CJS load ESM:** dùng dynamic `import()` (async):

```js
// loader.cjs
async function main() {
  const { default: App } = await import("./app.mjs");
  new App().start();
}
main();
```

---

## 6. `package.json`: `exports`, `imports`, `main`

### 6.1 `exports` map

`exports` **che** cấu trúc thư mục: consumer chỉ import được entry được khai báo.

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
// import from "@acme/sdk/dist/index.js" → bị chặn nếu không export
```

`main` vẫn hữu ích cho tool cũ; với Node hiện đại **`exports` thắng**.

### 6.2 Conditional exports

```json
{
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

Điều kiện phổ biến: `import`, `require`, `node`, `default`, `types` (TypeScript / bundler).

Thứ tự điều kiện quan trọng — đặt `types` trước `import`/`require` theo khuyến nghị TS.

### 6.3 `imports` (subpath aliases nội bộ)

Chỉ dùng **trong package**, key bắt đầu `#`:

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

Ưu điểm: alias **có hiệu lực ở runtime Node**, không cần bundler — khác `tsconfig` `paths`.

---

## 7. Builtin modules — `node:` protocol

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";
```

- `node:fs` rõ ràng hơn `fs` (tránh conflict với package npm tên trùng).
- Nên **luôn** dùng prefix `node:` trong code mới.
- Subpath promises: `node:fs/promises`, `node:stream/promises`, `node:timers/promises`, `node:dns/promises`.

Liệt kê:

```bash
node -e "console.log(require('node:module').builtinModules)"
```

---

## 8. Path aliases: TypeScript vs runtime

**TypeScript `paths`** chỉ ảnh hưởng **type-check / editor**, **không** rewrite path khi chạy bằng Node thuần:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

```ts
import { User } from "@/models/user.js"; // TS hiểu; Node runtime có thể FAIL
```

Cách xử lý thực tế:

| Cách | Runtime? | Ghi chú |
|---|---|---|
| `package.json` `#imports` | Có (Node) | Khuyến nghị cho app ESM Node |
| Bundler (esbuild, tsup, webpack) | Có (sau bundle) | Rewrite khi build |
| `tsx` / loader tùy chỉnh | Có (dev) | Tiện local; cẩn thận production |
| Chỉ `tsc` emit | Không tự rewrite `paths` | Dùng relative hoặc `#imports` |

**Quy tắc:** alias muốn chạy trên Node → dùng `#imports` (hoặc bundler), đừng chỉ dựa vào `paths`.

---

## 9. Best practices

- Dự án mới: `"type":"module"`, import `node:*`, đuôi `.js` trong relative import.
- Library publish: khai báo `exports` chặt; cung cấp `types` / dual package nếu cần CJS.
- Tránh mixed ESM/CJS lung tung trong cùng tree — tách `.cjs` rõ ràng khi bắt buộc.
- Dùng `createRequire` khi ESM cần đọc JSON/CJS sync; dùng dynamic `import()` khi CJS cần ESM.
- Alias runtime → `#imports`; alias chỉ-for-TS → ghi chú rõ hoặc tránh.
- Không dựa vào bare specifier resolution kiểu bundler (`import "lodash/get"`) trừ khi package `exports` cho phép.

**Tài liệu liên quan:** [tsconfig & biên dịch](tsconfig.md) · [npm / tooling](tooling.md) · [Node built-ins](nodejs-apis.md)
