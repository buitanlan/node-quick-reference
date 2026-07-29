# Entry point & chạy chương trình

Trong Node.js **không có** hàm `Main` bắt buộc như C#. Điểm vào (entry point) được xác định bởi cách bạn **gọi runtime**, bởi trường trong `package.json` (`main` / `module` / `exports` / `bin`), hoặc bởi shebang khi chạy script CLI. Baseline tài liệu: **Node.js 26** (Current; LTS dự kiến Oct 2026), **TypeScript 7**. Node **24** vẫn Maintenance LTS. Ưu tiên **ESM + TypeScript**; CJS vẫn phổ biến và được ghi rõ khi cần.

Node 26: **type stripping ổn định, mặc định** cho `.ts` — `node file.ts` (không type-check). Chỉ cú pháp **erasable**; `--experimental-transform-types` **đã gỡ**. Dùng `tsc` / `tsx` / bundler khi cần kiểm tra kiểu đầy đủ hoặc syntax không erasable.

---

## Mục lục

- [Entry point & chạy chương trình](#entry-point--chạy-chương-trình)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan entry point](#1-tổng-quan-entry-point)
  - [2. `package.json`: `main` / `module` / `exports` / `type`](#2-packagejson-main--module--exports--type)
    - [2.1 `type`](#21-type)
    - [2.2 `main` và `module`](#22-main-và-module)
    - [2.3 `exports` (khuyến nghị hiện đại)](#23-exports-khuyến-nghị-hiện-đại)
    - [2.4 `bin`](#24-bin)
  - [3. Chạy chương trình](#3-chạy-chương-trình)
    - [3.1 `node file.js`](#31-node-filejs)
    - [3.2 `node file.ts` (type stripping)](#32-node-filets-type-stripping)
    - [3.3 `tsx` / `ts-node` (overview)](#33-tsx--ts-node-overview)
    - [3.4 Script npm](#34-script-npm)
  - [4. ESM vs CJS entry](#4-esm-vs-cjs-entry)
  - [5. Shebang & CLI scripts](#5-shebang--cli-scripts)
  - [6. `process.argv`, exit codes, `process.exit`](#6-processargv-exit-codes-processexit)
  - [7. Top-level `await` trong ESM](#7-top-level-await-trong-esm)
  - [8. Mẹo thực tế & pitfalls](#8-mẹo-thực-tế--pitfalls)

---

## 1. Tổng quan entry point

- **CLI trực tiếp**: `node path/to/entry.js` (hoặc `.mjs` / `.cjs` / `.ts` khi type stripping).  
- **Package entry**: khi `require('pkg')` / `import 'pkg'` → Node resolve theo `exports` (ưu tiên) rồi `main`.  
- **CLI binary**: `npx my-cli` / global install → resolve qua `bin`.  
- **Không có** “một hàm Main duy nhất”; mọi top-level code trong module được load sẽ chạy ngay khi module được đánh giá.

```ts
// src/index.ts — toàn bộ top-level là “entry logic”
console.log("boot");
await bootstrap(); // chỉ hợp lệ trong ESM (xem mục 7)
```

---

## 2. `package.json`: `main` / `module` / `exports` / `type`

### 2.1 `type`

```json
{
  "type": "module"
}
```

- `"type": "module"` → `.js` được coi là **ESM**.  
- `"type": "commonjs"` (mặc định nếu thiếu) → `.js` là **CJS**.  
- Luôn có thể override bằng đuôi: `.mjs` = ESM, `.cjs` = CJS bất kể `type`.  
- Với TypeScript: `module` trong `tsconfig` phải khớp chiến lược emit/runtime (NodeNext / Node16 / ESNext + `"type": "module"`).

### 2.2 `main` và `module`

```json
{
  "main": "./dist/index.cjs",
  "module": "./dist/index.js"
}
```

- **`main`**: entry truyền thống cho CJS (`require`). Node vẫn đọc khi không có `exports`.  
- **`module`**: convention của bundler (Webpack/Rollup) — **Node không dùng** field này để resolve.  
- Package hiện đại nên dựa vào **`exports`**, giữ `main` chỉ để tương thích tooling cũ.

### 2.3 `exports` (khuyến nghị hiện đại)

```json
{
  "name": "my-lib",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json"
  }
}
```

- Chỉ các đường dẫn liệt kê trong `exports` mới **public**; import deep path không khai báo sẽ fail.  
- Conditional exports: `import`, `require`, `node`, `default`, `types`, …  
- Subpath: `"./utils": "./dist/utils.js"`.  
- Node 26: resolve theo spec `exports` nghiêm; tránh dựa vào “folder index” nếu chưa export rõ.

### 2.4 `bin`

```json
{
  "bin": {
    "my-tool": "./bin/cli.js"
  }
}
```

- Sau `npm link` / install, tạo shim gọi file này.  
- File bin nên có **shebang** và executable bit (Unix). Trên Windows, npm tạo `.cmd` wrapper.

---

## 3. Chạy chương trình

### 3.1 `node file.js`

```bash
node dist/index.js
node --env-file=.env dist/index.js   # Node 20.6+; ổn định trên 26
```

- Đường dẫn tương đối theo CWD.  
- Có thể truyền flag: `--watch`, `--inspect`, `--experimental-*` (ít cần hơn trên 26).

### 3.2 `node file.ts` (type stripping)

Từ Node **22.6+** (experimental) → ổn định qua 24 → trên **Node 26** mặc định cho `.ts`:

```bash
node src/index.ts
```

- Runtime **xóa annotation kiểu**, không type-check.  
- **Chỉ erasable TS**: interfaces, type aliases, `as`/`satisfies`, generics erasable.  
- **Không** chạy qua strip: `enum`, `namespace`, decorators, parameter properties → cần `tsc` / `tsx` / bundler.  
- Node 26 **đã gỡ** `--experimental-transform-types` (không còn transform non-erasable trên runtime).  
- Khuyến nghị: `erasableSyntaxOnly` + `verbatimModuleSyntax`; prod thường emit JS bằng `tsc`/bundler; CI luôn `tsc --noEmit`.

```ts
// OK với type stripping (erasable)
type User = { id: string };
const u = { id: "1" } satisfies User;
console.log(u.id);
```

### 3.3 `tsx` / `ts-node` (overview)

| Tool | Vai trò | Ghi chú |
|------|---------|---------|
| **tsx** | Chạy TS nhanh (esbuild), hỗ trợ ESM tốt | Phổ biến cho monorepo/dev |
| **ts-node** | Chạy qua compiler TS / SWC | Cấu hình ESM phức tạp hơn; vẫn gặp nhiều |
| **node (strip)** | Không cần dependency | Không type-check; hạn chế cú pháp |

```bash
npx tsx src/index.ts
npx ts-node --esm src/index.ts
```

### 3.4 Script npm

```json
{
  "scripts": {
    "start": "node dist/index.js",
    "dev": "node --watch src/index.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

- Tách **chạy** và **type-check**: `node` strip ≠ kiểm tra kiểu.

---

## 4. ESM vs CJS entry

**ESM** (`"type": "module"` hoặc `.mjs`):

```ts
// index.ts
import { readFile } from "node:fs/promises";

const text = await readFile("./data.txt", "utf8"); // top-level await
console.log(text.length);
```

**CJS** (mặc định / `.cjs`):

```js
// index.cjs
const { readFileSync } = require("node:fs");
console.log(readFileSync("./data.txt", "utf8").length);
// Không có top-level await trong CJS thuần
```

- Trong ESM: `__dirname` / `__filename` **không có sẵn** → dùng `import.meta.url` + `fileURLToPath`.  
- `require` trong ESM: Node hỗ trợ `createRequire` hoặc (tùy phiên bản) `import module from 'node:module'`.  
- Interop: CJS `module.exports` khi import ESM thường nằm ở `.default` tùy emit — kiểm tra bằng thử nghiệm, không đoán.

```ts
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cfg = join(__dirname, "config.json");
```

---

## 5. Shebang & CLI scripts

```ts
#!/usr/bin/env node
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { help: { type: "boolean", short: "h" } },
});
if (values.help) {
  console.log("Usage: my-tool [options]");
  process.exit(0);
}
```

- Dòng đầu **phải** là shebang, không có BOM.  
- `env node` linh hoạt hơn hardcode `/usr/bin/node`.  
- Với TS: publish file `.js` đã emit vào `bin`, hoặc dùng runner (`tsx`) trong dev only — CLI publish nên là JS.

---

## 6. `process.argv`, exit codes, `process.exit`

```ts
// node app.js --port 3000 input.txt
// process.argv[0] = đường dẫn node
// process.argv[1] = đường dẫn script
// process.argv.slice(2) = args người dùng
const args = process.argv.slice(2);
```

- Dùng `node:util` `parseArgs` (ổn định) thay parser tự viết cho CLI đơn giản.  
- **Exit code**: `0` = thành công; khác 0 = lỗi (convention: `1` generic, `2` misuse — không chuẩn cứng như sysexits mọi nơi).

```ts
async function main(): Promise<number> {
  try {
    await run();
    return 0;
  } catch (err) {
    console.error(err);
    return 1;
  }
}

const code = await main();
process.exitCode = code; // ưu tiên hơn process.exit() đột ngột
// hoặc: process.exit(code);
```

- **`process.exit(code)`**: thoát ngay, có thể cắt dở I/O / `beforeExit` / log chưa flush.  
- **`process.exitCode = n`**: đặt mã, để event loop kết thúc tự nhiên — thường an toàn hơn.  
- Unhandled rejection / uncaughtException: Node 26 (và từ các bản trước đã siết) mặc định thoát với code ≠ 0 cho unhandled rejection.

```ts
process.on("uncaughtException", (err) => {
  console.error("fatal", err);
  process.exit(1);
});
```

---

## 7. Top-level `await` trong ESM

- Chỉ trong **ESM** (và các ngữ cảnh tương đương: modules được load như ESM).  
- Module chứa TLA sẽ **đợi** promise resolve trước khi consumer nhận exports.  
- Chuỗi dependency có TLA làm chậm startup — giữ TLA ở entry, không rải khắp lib.

```ts
// ESM entry
const config = await import("./config.js").then((m) => m.load());
export const app = createApp(config);
```

- CJS: bọc trong async IIFE:

```js
(async () => {
  const config = await loadConfig();
  start(config);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

## 8. Mẹo thực tế & pitfalls

- **Một entry rõ ràng**: `src/index.ts` → emit `dist/index.js`; `package.json` `exports`/`bin` trỏ đúng file.  
- **Đừng** dựa vào `module` field của package.json cho Node resolve.  
- Type stripping ≠ thay thế CI `tsc --noEmit`.  
- Phân biệt dual package hazard (CJS+ESM cùng graph) — đọc Node docs “Dual CommonJS/ES module packages”.  
- Worker / child process: entry là file riêng; truyền path tuyệt đối ổn định hơn relative theo CWD.  
- Baseline tài liệu là **Node 26**; nếu còn deploy trên **24** Maintenance LTS, kiểm tra changelog khi dùng API mới (Temporal, `getOrInsert`, …). Xem [node26-ts7.md](node26-ts7.md).

```ts
// Mẫu entry production gọn
import { main } from "./app.js";

try {
  await main(process.argv.slice(2));
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
```
