# Modules & Packages

*(ESM, CommonJS, `package.json` exports/imports, dual package hazard, `node:`, TypeScript `NodeNext`)*

Baseline: **Node.js 26** (ESM-first), **TypeScript 7**. Node **24** LTS cùng hướng ESM. Compiler: [tsconfig.md](tsconfig.md). npm/pnpm: [tooling.md](tooling.md). Entry / `bin`: [main-function.md](main-function.md).

> **Callout:** Node **không** đoán format theo nội dung `import` vs `require` trong `.js`. Sai `"type"` → parse error hoặc semantics lệch. `"exports"` thắng `main`/`module`. Dual CJS+ESM khác file → **dual package hazard**.

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
12. [`import.meta.url` / `dirname` / `filename`](#12-importmetaurl--dirname--filename)
13. [Publishing: `files` + `exports` + `typesVersions`](#13-publishing-files--exports--typesversions)
14. [Best practices](#14-best-practices)
15. [Checklist](#15-checklist)
16. [Cheat sheet](#16-cheat-sheet)
17. [Version notes](#17-version-notes)
18. [Tài liệu liên quan](#18-tài-liệu-liên-quan)

---

## 1. Hai hệ thống module

| | **ESM** | **CommonJS (CJS)** |
|---|---|---|
| Cú pháp | `import` / `export` | `require` / `module.exports` |
| Load | bất đồng bộ, static analysis | đồng bộ |
| `__dirname` / `__filename` | qua `import.meta` | có sẵn |
| Top-level await | có | không |
| Binding | **live** (re-export thấy giá trị mới) | **copy snapshot** lúc `require` (trừ giữ object `exports`) |
| Cache | theo URL/specifier đã resolve | theo absolute path |
| Khuyến nghị Node 26 | **mặc định code mới** | legacy / dual publish |

File `.js` là ESM hay CJS phụ thuộc **`"type"` gần nhất** và/hoặc đuôi (`.mjs` / `.cjs`).

> **Callout:** Một package **một** format public. Dual artifact chỉ khi có facade mỏng và test singleton — xem §6.

Node resolve specifier theo **algorithm** (relative → self-reference tên package → `node_modules` + `exports`). TypeScript `NodeNext` bám cùng luật — chi tiết §9 và [tsconfig.md](tsconfig.md).

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

| Specifier | Ví dụ | Resolve |
|---|---|---|
| Relative | `./app.js`, `../lib/x.js` | File hệ thống; **bắt buộc đuôi** |
| Bare | `fastify`, `@acme/sdk` | `node_modules` + `exports` |
| Subpath | `@acme/sdk/utils` | Chỉ khi `exports` khai `" ./utils"` |
| Self | `"name"` trong chính package | `exports["."]` |
| Builtin | `node:fs/promises` | Core; luôn prefix `node:` |
| `#imports` | `#lib/db.js` | `package.json` `"imports"` |

### 2.2 Default vs named — ESM thuần

```ts
// named — tree-shake / import cụ thể
export function parse() {}
import { parse } from "./parse.js";

// default — một giá trị “chính”
export default class Client {}
import Client from "./client.js";

// namespace — toàn bộ binding (live)
import * as ns from "./parse.js";
ns.parse();
```

- Default **không** tự thành named `default` khi destructure CJS-style: `import { default as Client }` mới tường minh.
- `export default function foo()` tạo **cả** binding `foo` nội bộ lẫn default; importer named `{ foo }` **không** thấy trừ khi `export { foo }`.
- Re-export: `export { parse as default } from "./parse.js"` đổi named → default.

> **Callout:** Library public: ưu tiên **named exports** + optional default mỏng. Default-only làm interop CJS/`require(esm)` dễ lệch (xem §5.3).

### 2.3 Dynamic `import()` & top-level await

```ts
const mod = await import(`./plugins/${name}.js`);

// TLA — chỉ ESM; importer chờ evaluate xong
const config = await import("./config.js");
```

Lazy/conditional load; CJS → ESM. Đừng TLA nặng ở entry library (cold start + khó CJS consumer / `require(esm)`).

`import()` trả **namespace object** (kể cả khi load CJS): default nằm ở `.default`.

```ts
const ns = await import("some-cjs-pkg");
const pkg = ns.default ?? ns;
```

TLA trong module graph: mọi importer ESM **await** evaluation. `require()` module đó trên Node 26 → `ERR_REQUIRE_ASYNC_MODULE` (không phải lúc nào cũng `ERR_REQUIRE_ESM` — §5.3).

---

## 3. CommonJS — `require` / `module.exports`

```js
// math.cjs
module.exports = { add(a, b) { return a + b; } };
// hoặc: exports.add = add; — đừng gán lại exports = {...}

const { add } = require("./math.cjs");
const path = require("node:path");
```

- `require` **đồng bộ**, cache theo absolute path (`require.cache`).
- Có `__dirname`, `__filename`, `require.main`, `require.resolve`.
- `exports.foo = …` gắn property; `exports = { foo }` **không** đổi `module.exports` — consumer nhận `{}` cũ.
- `delete require.cache[id]` để reload — hiếm khi đúng trên server; dual hazard nếu module có singleton.

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

Trên Node 20.11+ / **26**: `import.meta.dirname` và `import.meta.filename` — §12.

`require.main === module` nhận biết “file đang chạy là entry” (CJS). ESM: so `process.argv[1]` với `import.meta.filename` (đã `path.resolve`) — xem [main-function.md](main-function.md).

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
| `.json` | JSON module (cần attribute khi `import`) | `require` JSON sync |
| `.node` | addon (thường `require` / `createRequire`) | addon |
| `.ts` (strip-types) | theo `"type"` + cấu hình | theo `"type"` |
| `.mts` / `.cts` | ESM / CJS (TS) | ESM / CJS |

Dự án mới: `"type": "module"`; `.cjs` chỉ khi tool bắt buộc.

> **Callout:** `"type"` áp dụng **package gần nhất** (directory có `package.json`). Package trong `node_modules` có `"type"` riêng — không thừa kế app.

TS emit `NodeNext`: `.ts` + `"type":"module"` → ESM `.js`; `.cts` → CJS `.cjs`; `.mts` → ESM `.mjs`. Khớp đuôi nguồn với format, đừng mix lung tung trong một folder.

---

## 5. Interop ESM ↔ CJS

Hai thế giới **không** đối xứng. ESM `import` CJS được (sau khi load); CJS `require` ESM **có điều kiện** trên Node 26; JSON/native thường cần `createRequire` từ ESM.

### 5.1 ESM → CJS

```ts
import pkg from "some-cjs-package";
import * as ns from "some-cjs-package";
// Named import dựa synthetic named exports — không 100% với mọi package
import cjs from "lodash";
const { debounce } = cjs; // an toàn hơn khi nghi ngờ
```

Node tạo **synthetic named exports** từ `module.exports` nếu là plain object enumerable. Fail / lệch khi:

- `module.exports = function` / class (named không phải property tĩnh).
- Export qua getter / non-enumerable.
- Dual package: ESM `import` đi nhánh `import`, không phải object CJS bạn nghĩ.
- `__esModule` + `.default` lồng (babel interop) — có thể `pkg.default.default`.

| Cách import CJS | Khi dùng |
|---|---|
| `import pkg from "cjs"` | `module.exports` là hàm/class/object “default” |
| `import * as ns` | cần cả `.default` và named synthetic |
| `const { x } = pkg` sau default | an toàn khi nghi synthetic |
| `createRequire` + `require` | JSON, `.cjs`, addon, sync bắt buộc |

### 5.2 CJS → ESM & `createRequire`

```js
// CJS: ESM có TLA / graph async → dynamic import
async function main() {
  const { default: App } = await import("./app.mjs");
  new App().start();
}
```

`createRequire` tạo hàm `require` **đồng bộ** gắn với URL/path hiện tại — dùng từ ESM khi cần CJS/JSON/addon:

```ts
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pkg = require("./legacy.cjs");
const data = require("./data.json"); // sync từ ESM
const addon = require("./native.node");
```

`filename` của `createRequire` phải là **file URL**, file URL string, hoặc absolute path — không phải directory trần. `import.meta.url` / `import.meta.filename` đều hợp lệ trên Node 26.

```ts
const require = createRequire(import.meta.filename); // Node 20.11+
require.resolve("./legacy.cjs");
```

`createRequire` gắn `module.paths` như file CJS tại vị trí đó — `require("dep")` đi `node_modules` **của package chứa module**, không theo `process.cwd()` (CLI `npx`/global). Custom `require` **không** chạy ESM loader hooks (`module.register`) — docs `node:module`; mock `import` không phủ `createRequire`.

JSON sync:

```ts
const require = createRequire(import.meta.url);
type Cfg = { port: number };
const cfg = require("./config.json") as Cfg; // không frozen như JSON module
```

Addon `.node` và một số bundler output CJS chỉ `require` được — đây là lý do giữ `createRequire` trong app ESM, không phải “cấm ESM”.

| Từ → Sang | Cách | Sync? |
|---|---|---|
| ESM → CJS | `import` default / namespace | sau load |
| CJS → ESM (TLA / an toàn) | `await import()` | **không** |
| CJS → ESM sync (không TLA) | `require()` trên Node 26 — §5.3 | có |
| ESM → sync CJS/JSON | `createRequire` | có |
| CJS → CJS | `require` | có |

> **Callout:** `createRequire` **không** biến ESM thành CJS. Nó chỉ load thứ `require` load được: CJS, JSON, `.node`, và ESM **sync** (cùng luật `require(esm)`).

### 5.3 `require(esm)`, `ERR_REQUIRE_ESM`, `ERR_REQUIRE_ASYNC_MODULE`

Lịch sử: CJS `require("./file.mjs")` ném **`ERR_REQUIRE_ESM`**. Nhiều blog vẫn dạy “không bao giờ require ESM”.

**Node 26** (ổn định từ dòng 20.19 / 22.12): `require()` **được** load ESM nếu:

1. Graph **không** có top-level `await` (kể cả dependency);
2. File nhận diện ESM (`.mjs`, hoặc `.js` + `"type":"module"`, hoặc syntax ESM khi không `"type":"commonjs"`).

Kết quả: **namespace object** — default ở `.default`, giống `await import()` nhưng sync.

```js
// CJS consumer
const ns = require("./dist/index.js"); // ESM sync
const Client = ns.default;
```

Tùy chỉnh giá trị `require()` trả về (giữ API CJS cũ): export tên chuỗi `"module.exports"`:

```ts
export default logger;
export { logger as "module.exports" };
```

CJS `const logger = require("./logger.js")` nhận instance, không phải namespace. Named export có thể **mất** với consumer `require` trừ khi gắn lên object trả về.

| Lỗi | Khi nào | Làm gì |
|---|---|---|
| `ERR_REQUIRE_ESM` | Engine/cấu hình từ chối require ESM (cũ, `--no-require-module`, hoặc file không đủ điều kiện) | `await import()` hoặc ship `.cjs` facade |
| `ERR_REQUIRE_ASYNC_MODULE` | ESM (hoặc graph) có **TLA** | Bỏ TLA khỏi entry sync, hoặc chỉ `import()` |
| `ERR_REQUIRE_CYCLE_MODULE` | Cycle **băng** ranh giới CJS ↔ ESM | Phá cycle; đừng require() lẫn import() chéo |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | Specifier không có trong `exports` | Export subpath hoặc import public API |

`--no-require-module` tắt `require(esm)` (debug / policy) → lại gần hành vi cũ `ERR_REQUIRE_ESM`. `--trace-require-module` lần load. **Không** dựa flag experimental đã gỡ; baseline 26: feature ổn định nhưng **API public** library vẫn nên ESM `import` trước.

Phát hiện hỗ trợ (nếu còn dual-publish cho Node rất cũ — hầu hết đã EOL):

```js
let supported = true;
try {
  require("module").Module._resolveFilename = require("module").Module._resolveFilename;
} catch {
  /* ignore */
}
// Thực dụng hơn: document engines.node >= 20.19 || >= 22.12 || 24/26
```

Đừng sniff private API. `engines` + changelog đủ.

> **Callout:** `require(esm)` **không** phải đường chính cho app mới. App ESM: `import` + `createRequire` khi cần sync CJS. Library: ESM-only hoặc facade CJS mỏng. Đừng TLA trên barrel mà CJS còn `require`.

### 5.4 Default vs named khi băng ranh giới

```ts
// CJS: module.exports = { add, mul };
import cjs from "./math.cjs";
cjs.add(1, 2);

// synthetic named — có thể fail
import { add } from "./math.cjs";

// ESM: export default fn; export { fn as helper };
import fn, { helper } from "./mod.js";
const ns = require("./mod.js"); // ns.default === fn (trừ "module.exports")
```

Quy tắc thực dụng:

1. Từ ESM đọc CJS: **default rồi destructure**.
2. Từ CJS đọc ESM: `.default` hoặc `"module.exports"`.
### 5.5 Lỗi resolve thường gặp

| Code | Ý nghĩa | Sửa |
|---|---|---|
| `ERR_MODULE_NOT_FOUND` | File/specifier không có | Đuôi `.js`, `#imports`, `exports` |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | Subpath không public | Thêm `exports` hoặc import `"."` |
| `ERR_UNSUPPORTED_DIR_IMPORT` | `import "./dir"` (ESM không index heuristic như CJS) | `./dir/index.js` hoặc export package |
| `ERR_REQUIRE_ESM` | `require` bị từ chối ESM | `import()` / `require(esm)` đủ điều kiện |
| `ERR_REQUIRE_ASYNC_MODULE` | TLA trong graph | Bỏ TLA hoặc chỉ `import()` |
| `ERR_INVALID_PACKAGE_CONFIG` | `exports` JSON sai | Validate `package.json` |
| `ERR_NETWORK_IMPORT_DISALLOWED` | HTTP import không bật | Không dùng URL HTTP làm specifier app |

CJS `require("./dir")` tìm `dir.js` / `dir/index.js`. ESM **không** — đây là chân “chạy CJS, chết ESM” khi đổi `"type":"module"`.

---

## 6. Dual package hazard

Publish **cả** ESM và CJS (hai file / hai đường resolve) có thể evaluate **hai lần** cùng logical module → hai singleton:

Triệu chứng: `instanceof` fail, config/`Map` không chia sẻ, `===` giữa “cùng” export = `false`, plugin đăng ký một bản, consumer thấy bản kia rỗng.

### 6.1 Nguyên nhân thường gặp

1. `exports`: `import` → `.js`, `require` → `.cjs` **khác source** (hai bản compile, hai module graph).
2. Bundler lấy `module` / ESM, Node lấy `main` CJS — hoặc ngược.
3. App trộn `require("pkg")` và `import "pkg"` khi hai condition trỏ hai file.
4. Thiếu `exports` → tool lấy `module` (ESM) trong khi Node lấy `main` (CJS).
5. Transitive: A import ESM của `pkg`, B require CJS của `pkg`.
6. Test runner / tsx load `.ts`, prod load `dist/*.js` — hai bản trong cùng process (hiếm hơn, vẫn “hai identity”).

### 6.2 Hazard “đầy đủ” — identity, prototype, cache

```text
process
├── ESM graph: pkg/dist/index.js     → class Foo #1, map singleton #1
└── CJS graph: pkg/dist/index.cjs    → class Foo #2, map singleton #2
```

`value instanceof Foo` fail nếu `Foo` lấy từ graph kia. `Error` subclass, plugin registry, `WeakMap` key theo class đều gãy.

CJS `require.cache` **không** chia slot với ESM module map. `createRequire` load CJS; `import` load ESM — hai cache.

### 6.3 Chiến lược

| Chiến lược | Mô tả |
|---|---|
| **ESM-only** | Chỉ `import` trong `exports`; CJS dùng `import()` hoặc `require(esm)` sync |
| **CJS facade mỏng** | `.cjs` `module.exports = require("./index.js")` (sync ESM) hoặc re-export một state |
| **Một file cho mọi condition** | `import`/`require`/`default` cùng path |
| **`exports` khớp `main`** | Không để `main`/`module` lệch |
| Document | Tránh require+import cùng pkg nếu dual file |

> **Callout:** Node gọi đây **dual package hazard**. Library mới trên Node 26: ưu tiên **ESM-only**. Nếu dual, `.cjs` **không** nhân đôi business logic.

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

`index.cjs` nên facade mỏng — không nhân đôi business + singleton:

```js
// dist/index.cjs — facade: một identity
module.exports = require("./index.js");
```

Chỉ an toàn nếu `index.js` ESM **không TLA**. Có TLA → facade phải `async` hoặc bỏ dual.

### 5.5 Lỗi resolve thường gặp

| Code | Ý nghĩa | Sửa |
|---|---|---|
| `ERR_MODULE_NOT_FOUND` | File/specifier không có | Đuôi `.js`, `#imports`, `exports` |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | Subpath không public | Thêm `exports` hoặc import `"."` |
| `ERR_UNSUPPORTED_DIR_IMPORT` | `import "./dir"` (ESM không index heuristic như CJS) | `./dir/index.js` hoặc export package |
| `ERR_REQUIRE_ESM` | `require` bị từ chối ESM | `import()` / `require(esm)` đủ điều kiện |
| `ERR_REQUIRE_ASYNC_MODULE` | TLA trong graph | Bỏ TLA hoặc chỉ `import()` |
| `ERR_INVALID_PACKAGE_CONFIG` | `exports` JSON sai | Validate `package.json` |

CJS `require("./dir")` tìm `dir.js` / `dir/index.js`. ESM **không** — chân “chạy CJS, chết ESM” khi đổi `"type":"module"`.

Test tối thiểu: trong **một** process, `import pkg` và `createRequire(...)(pkg)` so `pkg.Foo === req.Foo` (hoặc `.default`). Fail → hazard.

```ts
import * as esm from "@acme/sdk";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url)("@acme/sdk");
const cjs = req.default ?? req;
if (esm.Client !== cjs.Client && esm.Client !== cjs) {
  throw new Error("dual package hazard: Client identity split");
}
```

Hazard **không** sửa bằng `instanceof` polyfill. Sửa graph: một file, hoặc facade `module.exports = require(esm)`.

Bundler (esbuild/webpack) “prebundle” CJS trong lúc app ESM import cùng package từ `node_modules` → **ba** identity (bundle copy + ESM + CJS). Externalize `pkg` trong bundle server, hoặc ESM-only.

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
| `types` / conditional `types` | TypeScript | Trong `exports`; **trước** `import`/`require` |
| `typesVersions` | TS cũ, **bỏ qua** khi đọc `exports` | §13 |
| `files` | npm pack whitelist | Kiểm soát tarball |
| `imports` | Alias `#` runtime | Node hiểu |

Self-reference: trong package `@acme/sdk`, `import "@acme/sdk"` resolve qua `exports`, không phải relative bypass. Hữu ích test public API.

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

Điều kiện trong `imports` giống `exports` (`node`, `default`, …) — ví dụ mock test vs prod. Subpath `#` **private**: consumer ngoài package không import `#lib/...` của bạn.

> **Callout:** `#` bắt buộc prefix. `imports` không thay `exports` public. Alias `@/` trong TS **không** chạy trên `node dist/...`.

### 7.3 Wildcard & encapsulation

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./*": "./dist/*.js"
  }
}
```

`"./*": "./dist/*.js"` dễ lộ file nội bộ (`pkg/secret`). Ưu tiên liệt kê subpath public. `null` chặn nhánh:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./internal/*": null
  }
}
```

---

## 8. Conditional exports sâu

Node match **theo thứ tự key** trong object: key **đứng trước** thắng. Quy tắc: **cụ thể → chung**; `"default"` **luôn cuối**.

### 8.1 Condition Node hiểu

Node implement (từ cụ thể → chung khi **khai**):

| Condition | Ai set | Ý nghĩa |
|---|---|---|
| `types` | TypeScript / tooling | `.d.ts` — **luôn đứng đầu** (khuyến nghị TS) |
| `import` | ESM `import` / `import()` | Mutually exclusive với `require` |
| `require` | `require()` / `createRequire` | Mutually exclusive với `import` |
| `module-sync` | `import` **và** `require` | ESM **không TLA**; `require` TLA → `ERR_REQUIRE_ASYNC_MODULE` |
| `node` | Node runtime | Nhánh Node vs browser |
| `default` | Fallback | **Luôn có, luôn cuối** |
| `browser` / `development` / `production` | Tool / env | Tùy ecosystem; `development` ⊥ `production` |

`require()` (khi bật require-module, mặc định Node 26) match conditions khoảng `["node", "require", "module-sync"]`. ESM `import` khoảng `["node", "import"]` (+ `default`). Đừng giả định bundler set `node`.

### 8.2 Thứ tự key — ví dụ đúng / sai

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

Sai thường gặp: `"default"` trước `"import"` → mọi resolver lấy `default`, nhánh `import` **chết**. `"require"` trước `"import"` không “thắng” ESM (condition không match) nhưng làm người đọc hiểu nhầm.

Nested `import`/`require` **mỗi nhánh** nên có `types` riêng nếu `.d.ts` khác (ESM vs CJS):

```json
{
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  }
}
```

TS resolve `types` + `default` trong nhánh đang match. Top-level `"types"` trước `"import"`/`"require"` cũng là pattern TS khuyến nghị.

> **Callout:** Có `exports` thì deep import `pkg/dist/secret.js` bị chặn — tính năng, không bug. Wildcard `"./*"` là lỗ encapsulation.

### 8.3 `module-sync` (Node hiện đại)

Khi một file ESM **không TLA** phục vụ cả `import` và `require(esm)`:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "module-sync": "./dist/index.js",
      "default": "./dist/index.cjs"
    }
  }
}
```

Node mới: `import`/`require` lấy ESM sync. Node cũ không hiểu `module-sync` → `default` CJS. Vẫn có hazard nếu hai file khác identity — test singleton.

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

Chi tiết: [tsconfig.md](tsconfig.md). TS 7: `moduleResolution` `"node"` / `node10` / `classic` → **error**.

| Hành vi `NodeNext` | Hệ quả |
|---|---|
| Bám Node (`exports`, đuôi) | `from "./foo"` thiếu đuôi → lỗi |
| Tôn trọng `"type"` + `.mts`/`.cts` | Khớp ESM/CJS |
| Conditional `types` trong `exports` | Publish đúng `.d.ts` |
| `paths` không rewrite runtime | Dùng `#imports` hoặc relative |
| `typesVersions` **không đọc** nếu có `exports` | Đặt `types` trong `exports` |

### 9.2 Extensionless vs `.js` trong nguồn TS

**Node ESM không resolve extensionless** (`import "./foo"` không tìm `foo.js`). CJS cổ điển có. `NodeNext` = luật Node theo format file.

```ts
// app.ts — đúng NodeNext / Node ESM
import { util } from "./util.js"; // typecheck → util.ts; emit / runtime → util.js
```

| Viết trong `.ts` | `NodeNext` typecheck | `node` ESM / emit |
|---|---|---|
| `from "./util"` | **Lỗi** (thiếu đuôi) | **Lỗi** |
| `from "./util.js"` | OK (map `util.ts`) | OK |
| `from "./util.ts"` | OK nếu `rewriteRelativeImportExtensions` | Strip/runtime: Node **không** load `.ts` import trừ khi chạy strip file đó; emit rewrite → `.js` |
| `from "./util.ts"` không rewrite | Lệch emit/runtime | Tránh |

`rewriteRelativeImportExtensions` cho `from "./util.ts"` rồi emit `.js` — convention phổ biến vẫn viết **`.js` trong nguồn**.

> **Callout:** Đuôi `.js` trong import TS **không** phải nhầm file. Đó là specifier **runtime**. Bundler `bundler` resolution nới lỏng hơn — đừng copy tsconfig Vite vào package Node thuần.

### 9.3 `main` / `module` / `exports` lệch

```json
{
  "main": "./legacy/index.js",
  "module": "./esm/index.js",
  "exports": { ".": "./dist/index.js" }
}
```

Node (có `exports`) → `./dist/index.js`; bundler cũ có thể lấy `module` → **dual hazard / type lệch**. Một truth = `exports`; `main` chỉ mirror.

### 9.4 Alias: TS vs runtime

| Cách | Runtime Node? | Ghi chú |
|---|---|---|
| `#imports` | Có | Khuyến nghị app ESM |
| Bundler rewrite | Sau bundle | OK |
| `tsx` / loader | Dev | Cẩn thận prod |
| Chỉ `tsconfig.paths` | **Không** | TS xanh, Node đỏ |

### 9.3 Algorithm (rút gọn)

1. `node:` builtin → core.
2. `#` → `imports` của package gần nhất.
3. Relative / absolute → file; ESM cần đuôi.
4. Bare: đi lên `node_modules`, đọc `package.json`.
5. Có `exports` → match subpath + conditions; không → `ERR_PACKAGE_PATH_NOT_EXPORTED`.
6. Không `exports` → `main` (CJS-ish) / index heuristic — **đừng** dựa vào cho package mới.

TS `NodeNext` lặp bước này (thêm `types`). Sai `exports` → TS và Node **cùng** đỏ — tốt hơn `paths` giả.

---

## 10. Builtin `node:` & import attributes

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
```

- Tránh conflict npm trùng tên; **luôn** `node:` trong code mới.
- Subpath: `node:fs/promises`, `node:stream/promises`, `node:timers/promises`, `node:dns/promises`.
- `node:test`, `node:assert/strict`, `node:util` — built-in, không cần dependency.

```bash
node -e "console.log(require('node:module').builtinModules)"
```

### 10.1 Import attributes — `with { type: "json" }`

```ts
import data from "./config.json" with { type: "json" };
const mod = await import("./config.json", { with: { type: "json" } });
```

- Dùng **`with`** (không dùng `assert` cũ — đã thay trong spec).
- Attribute bắt buộc với JSON module trên ESM; thiếu → lỗi.
- Default export = giá trị parse; object bị **frozen** (đừng mutate như config writable).
- Thống nhất JSON qua `with` **hoặc** `createRequire` — đừng trộn lung tung trong cùng app (`require` JSON không frozen cùng kiểu).

| JSON | ESM `with` | `createRequire` |
|---|---|---|
| Sync | không (static import evaluate theo graph) | **có** |
| Tree / TLA | static import OK | sync boot |
| Mutability | frozen | object thường |

> **Callout:** Import attributes không phải chỗ gắn MIME tùy ý. Node 26: JSON là use-case chính (`type: "json"`). CSS/other: theo dõi docs đúng minor — đừng bịa attribute.

---

## 11. Circular dependencies

### 11.1 ESM — live bindings + TDZ

ESM cho phép cycle. Export là **live binding**: importer đọc **ô nhớ**, không copy lúc link.

```ts
// a.js
import { b } from "./b.js";
export let a = 1;
export function bump() {
  a = 2;
}

// b.js
import { a } from "./a.js";
export const b = a + 1; // nguy hiểm nếu a chưa init → TDZ / ReferenceError
```

Sau khi cả hai evaluate: `bump()` → importer `{ a }` thấy `2` (live). `export const` / `let` trước khi init vẫn TDZ.

`export function` hoist trong module — cycle hàm↔hàm thường sống sót; cycle **giá trị** top-level thì không.

### 11.2 CJS — object đang xây + copy lúc destructure

```js
// a.cjs
exports.a = 1;
const b = require("./b.cjs");
exports.a = 2;

// b.cjs
const a = require("./a.cjs"); // { a: 1 } đang xây
module.exports = { fromA: a.a };
```

`require` cycle trả `module.exports` **hiện tại** (thiếu property → `undefined` im lặng).

```js
const { foo } = require("./mod.cjs"); // copy giá trị lúc destructure
const mod = require("./mod.cjs");     // giữ object — thấy mutate sau
```

| | ESM | CJS |
|---|---|---|
| Cycle | Link trước, evaluate sau | `exports` nửa mùa |
| Đọc sớm | **TDZ** (ồn) | `undefined` (im lặng) |
| Binding | Live | Snapshot nếu destructure |
| Băng ESM↔CJS | `ERR_REQUIRE_CYCLE_MODULE` có thể | Đừng trộn cycle |

### 11.3 Cách tránh

| Cách tránh | Chi tiết |
|---|---|
| Shared `constants` / `types` | Không import ngược |
| Dependency inversion | Interface + inject |
| Lazy `import()` trong hàm | Tránh top-level cycle |
| Gộp module | Nếu luôn đi cùng |
| Tool | `madge`, `dpdm`, `import/no-cycle` |

> **Callout:** Cycle “chạy được” ≠ thiết kế tốt. Public API nên **zero cycle**. Live binding không cứu TDZ.

---

## 12. `import.meta.url` / `dirname` / `filename`

ESM không có `__dirname` / `__filename` tự động.

```ts
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Node 20.11+ / 26
const dir = import.meta.dirname;
const file = import.meta.filename;
```

| API | Kiểu | Ghi chú |
|---|---|---|
| `import.meta.url` | `file://` URL string | Chuẩn ESM; mọi nơi |
| `fileURLToPath(import.meta.url)` | path OS | Windows drive/UNC đúng |
| `import.meta.filename` | path OS | Tiện; cần Node đủ mới |
| `import.meta.dirname` | path OS | Tiện; tương đương `path.dirname(filename)` |
| `pathToFileURL(absPath)` | `URL` | Đưa path vào `import()` / `new URL` |

`createRequire` gắn `module.paths` / resolve như file đó là CJS tại vị trí tương ứng. `createRequire(import.meta.url)("some-dep")` tìm `node_modules` từ thư mục module — không từ CWD. Hữu ích khi CLI chạy global/`npx` mà CWD là chỗ khác.

`require` từ `createRequire` **không** đi qua ESM loader hooks giống `import()` (hooks đăng ký `module.register` **không** áp lên custom require — docs `node:module`). Đừng giả định mock hook phủ cả hai.

```ts
const cfgUrl = new URL("./config.json", import.meta.url);
const cfgPath = fileURLToPath(cfgUrl);
```

Worker / `child_process`: truyền path tuyệt đối từ `import.meta.filename`, đừng `"../worker.js"` theo CWD.

CJS: `__dirname` đã là path. Đừng `fileURLToPath` lên nó.

> **Callout:** `import.meta.url` là URL, không phải path. Ghép `path.join(import.meta.url, "x")` **sai**. Luôn `fileURLToPath` hoặc `import.meta.dirname`.

Windows: `fileURLToPath` ra `C:\…`; `pathToFileURL` encode space/`#`. UNC `\\server\share` cần `pathToFileURL` — tự ghép `file://` string dễ sai.

`import()` relative string `"../x.js"` resolve theo **module hiện tại** (giống `new URL`). `path.join(__dirname, "x.js")` rồi `pathToFileURL` khi specifier phải là URL tuyệt đối (worker `new URL(..., import.meta.url)` là pattern chuẩn).

---

## 13. Publishing: `files` + `exports` + `typesVersions`

### 13.1 Checklist pack

```text
□ name, version, type đúng
□ exports đủ entry public; types → import → require → default
□ main khớp exports["."]
□ files / .npmignore — không leak test/.env
□ .d.ts đúng; types trong exports (không chỉ typesVersions)
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

`files: ["dist"]` — tarball **không** có `src` trừ khi liệt kê. `exports` trỏ file **không** nằm trong `files` → consumer install xong **vỡ** (path missing). `dry-run` + cài tarball bắt buộc.

### 13.2 `typesVersions` — thận trọng

`typesVersions` remap `.d.ts` theo **phiên bản TypeScript** (và subpath) — hữu ích downlevel cho TS cũ **khi không có `exports`**.

**Khi package có `"exports"`, TypeScript không đọc `typesVersions`.** Resolver đi `exports` + condition `"types"` / `"types@<selector>"` trong `exports`.

Sai:

```json
{
  "exports": { ".": "./dist/index.js" },
  "typesVersions": { "*": { "*": ["dist/*"] } }
}
```

TS `NodeNext` bỏ qua `typesVersions` → không thấy types hoặc resolve sai.

Đúng: `"types"` trong từng export (và optionally `"types@>=5"` trong `exports` theo handbook). Giữ top-level `"types"` chỉ cho tool cổ.

> **Callout:** `types` top-level **không** thay conditional `types` trong `exports`. Dual ESM/CJS cần `.d.ts` vs `.d.cts` khớp format.

### 13.3 `prepublishOnly` & engines

Build trước pack (`prepublishOnly`: typecheck + `tsc`). `engines.node` metadata — bật `engine-strict` / CI mới fail. Document Node 24 vs 26 nếu `require(esm)` / TLA khác nhau.

`package.json` `"types"` top-level + `"exports"` không có `"types"` → TS 4.7+ / `NodeNext` **ưu tiên `exports`**, có thể **không** thấy `.d.ts` nếu condition thiếu. Triệu chứng: consumer `any` hoặc “could not find declaration”. Sửa: thêm `"types"` vào `exports["."]`, không “thêm typesVersions cho chắc”.

`files: ["dist"]` **không** gồm `package.json` (npm luôn gắn manifest). Gồm nhầm `src`, `.env`, `coverage` → leak. `.npmignore` **không** thắng nếu `files` đã whitelist — `files` là cửa chính.

Kiểm tarball:

```bash
npm pack --dry-run
# hoặc: pnpm pack && tar -tf *.tgz
```

Mọi path trong `exports` / `bin` / `main` phải xuất hiện. Thiếu `.d.ts` → TS consumer đỏ; thiếu `.js` → runtime đỏ.

`exports["./package.json"]` cho tool đọc version từ `import.meta.resolve` / `createRequire(...("./package.json"))` khi encapsulation chặn `pkg/package.json`. Không export `package.json` thì deep import đó fail — cố ý hoặc phải mở.

---

## 14. Best practices

1. Mới: `"type":"module"`, `node:*`, đuôi `.js` relative (`NodeNext`).
2. Publish: `exports` chặt + `types` **đầu** + `files` whitelist khớp path.
3. Tránh mixed ESM/CJS — `.cjs` rõ khi bắt buộc; dual = facade mỏng hoặc ESM-only.
4. Hiểu dual hazard trước khi ship `import` + `require` khác file; test `===` constructor.
5. `createRequire` cho sync CJS/JSON/addon; `import()` khi CJS cần ESM có TLA.
6. Đừng coi `require(esm)` là API public ổn mọi Node cũ; TLA → `ERR_REQUIRE_ASYNC_MODULE`.
7. Alias runtime → `#imports`; đừng chỉ `paths`.
8. TS: `module` / `moduleResolution` = **`NodeNext`**. Không `node10`.
9. Tôn trọng `exports` người khác — không deep-import `dist` nội bộ.
10. JSON: một convention (`with { type: "json" }` hoặc `createRequire`).
11. Path file: `import.meta.dirname` / `fileURLToPath(import.meta.url)` — không `cwd`.
12. CI: `npm pack` + install consumer tối thiểu mỗi release; đừng tin `typesVersions` khi đã có `exports`.

---

## 15. Checklist

```text
□ "type" tường minh
□ Relative ESM có đuôi .js (NodeNext)
□ tsconfig NodeNext — không node10
□ Không phụ thuộc field "module" cho Node runtime
□ exports: types trước; default cuối; import/require đúng file
□ Không cycle ở public API; hiểu live vs copy
□ Dual đã test singleton — hoặc ESM-only
□ #imports thay paths nếu cần alias runtime
□ Builtin luôn node:
□ JSON: with type json hoặc createRequire — một lối
□ import.meta.dirname / fileURLToPath cho path
□ Publish: files khớp exports; không dựa typesVersions khi có exports
□ Dry-run pack + thử install ESM (và CJS nếu dual)
```

---

## 16. Cheat sheet

```ts
import fs from "node:fs/promises";
import cfg from "./config.json" with { type: "json" };
import { x } from "#lib/x.js";
const mod = await import("./plugin.js");

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));
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
| App Node mới | ESM + `NodeNext` + đuôi `.js` |
| Legacy CJS | `.cjs` / `"type":"commonjs"` cục bộ |
| Alias runtime | `#imports` |
| Load ESM từ CJS (có TLA) | `await import()` |
| Load ESM từ CJS (không TLA) | `require()` Node 26 / vẫn ưu tiên `import()` |
| Sync JSON từ ESM | `createRequire` hoặc `with { type: "json" }` |
| Tránh dual hazard | ESM-only hoặc facade mỏng cùng identity |
| Types khi publish | `"types"` trong `exports`, không `typesVersions` |

---

## 17. Version notes

| Dòng | Ghi chú |
|---|---|
| **Node 26** + **TS 7** | ESM-first; `NodeNext`; TS 7 từ chối `moduleResolution` cổ |
| Node 24 LTS | Cùng hướng `exports` / ESM; `require(esm)` đã ổn định trên dòng 24 mới |
| `require(esm)` | Sync ESM không TLA; TLA → `ERR_REQUIRE_ASYNC_MODULE`; cũ: `ERR_REQUIRE_ESM` |
| `exports` / `imports` | Ổn định; thứ tự key; `module-sync`; conditional `types` |
| `typesVersions` | **Bỏ qua** khi TS đọc `exports` |
| Import attributes `with` | Thay `assert`; JSON modules frozen |
| `node:` | Khuyến nghị bắt buộc style mới |
| `import.meta.dirname` / `filename` | Node 20.11+; fallback `fileURLToPath` |
| Dual package hazard | Vẫn đúng khi hai artifact — thiết kế có ý thức |

---

## 18. Tài liệu liên quan

- [tsconfig & biên dịch TypeScript](tsconfig.md)
- [npm / pnpm / yarn & tooling](tooling.md)
- [Node.js built-ins](nodejs-apis.md)
- [Entry point & chạy chương trình](main-function.md)
- [Lập trình bất đồng bộ](async.md) — TLA, `import()`
