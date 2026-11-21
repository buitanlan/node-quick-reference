# Entry point & chạy chương trình

Trong Node.js **không có** hàm `Main` bắt buộc như C# / `func main` như Go. Điểm vào do cách **gọi runtime**, trường `package.json` (`main` / `exports` / `bin`), hoặc shebang CLI quyết định.

Baseline: **Node.js 26 Active LTS** ("Lithium", từ 2026-10-28, v26.13.0+, V8 14.6+, Undici 8+) + **TypeScript 7.0** (native Go compiler). Node **24** đã sang Maintenance LTS (2026-10-20); xem [README](README.md). Ưu tiên **ESM + TypeScript**; CJS ghi rõ khi cần.

> **Callout:** Node 26: **type stripping ổn định, mặc định** cho `.ts` — `node file.ts` (không type-check). Chỉ cú pháp **erasable**; `--experimental-transform-types` **đã gỡ**. Prod thường `tsc`/bundler emit JS; CI luôn `tsc --noEmit`.

---

## Mục lục

- [1. Tổng quan entry point](#1-tổng-quan-entry-point)
- [2. Các chế độ entry: strip / tsc / tsx / ESM / CJS / bin](#2-các-chế-độ-entry-strip--tsc--tsx--esm--cjs--bin)
  - [2.1 `node file.ts` (type stripping)](#21-node-filets-type-stripping)
  - [2.2 `tsc` emit rồi `node dist/…`](#22-tsc-emit-rồi-node-dist)
  - [2.3 `tsx` vs `ts-node` vs strip](#23-tsx-vs-ts-node-vs-strip)
  - [2.4 ESM vs CJS](#24-esm-vs-cjs)
  - [2.5 `package.json` `exports` / `bin`](#25-packagejson-exports--bin)
  - [2.6 Shebang & CLI](#26-shebang--cli)
  - [2.7 So sánh ba pipeline (quyết định)](#27-so-sánh-ba-pipeline-quyết-định)
  - [2.8 `node --run`, SEA (`--build-sea`) & `node.config.json`](#28-node---run-sea---build-sea--nodeconfigjson)
- [3. `process.argv` & `util.parseArgs`](#3-processargv--utilparseargs)
  - [3.1 `strict`](#31-strict)
  - [3.2 `tokens: true`](#32-tokens-true)
- [4. Exit codes: `process.exit` vs `exitCode`](#4-exit-codes-processexit-vs-exitcode)
- [5. `beforeExit`, `exit`, uncaught vs shutdown](#5-beforeexit-exit-uncaught-vs-shutdown)
  - [5.1 `beforeExit`](#51-beforeexit)
  - [5.2 `exit`](#52-exit)
  - [5.3 Uncaught vs graceful shutdown](#53-uncaught-vs-graceful-shutdown)
- [6. Signal: SIGINT / SIGTERM / SIGHUP — Windows vs POSIX](#6-signal-sigint--sigterm--sighup--windows-vs-posix)
  - [6.1 Bảng tín hiệu mở rộng](#61-bảng-tín-hiệu-mở-rộng)
  - [6.2 `cluster` worker và signal](#62-cluster-worker-và-signal)
- [7. Top-level await vs `async main()`](#7-top-level-await-vs-async-main)
- [8. `--watch` & reload](#8---watch--reload)
- [9. Environment: `--env-file` vs dotenv](#9-environment---env-file-vs-dotenv)
  - [9.1 `NODE_OPTIONS` & debug](#91-node_options--debug)
  - [9.2 `--env-file` vs Docker Compose `env_file`](#92---env-file-vs-docker-compose-env_file)
- [10. Readiness vs liveness](#10-readiness-vs-liveness)
- [11. `cluster` vs single process](#11-cluster-vs-single-process)
- [12. Pitfalls](#12-pitfalls)
- [13. Best practices](#13-best-practices)
- [14. Checklist](#14-checklist)
- [15. Cheat sheet](#15-cheat-sheet)
- [16. Version notes](#16-version-notes)
- [17. Tài liệu liên quan](#17-tài-liệu-liên-quan)

---

## 1. Tổng quan entry point

| Cách vào | Ví dụ | Ghi chú |
|---|---|---|
| CLI trực tiếp | `node dist/index.js` / `node src/index.ts` | Top-level chạy khi module evaluate |
| Package entry | `import 'pkg'` / `require('pkg')` | Resolve `exports` rồi `main` |
| Binary | `npx my-cli` / global `bin` | Shim npm + shebang |
| Worker / child | `new Worker(new URL(...))` | Path theo `import.meta`, không CWD |
| `cluster.fork` | Primary spawn worker | Mỗi worker **evaluate lại** entry |

- **Không** có một hàm Main duy nhất — mọi top-level code trong module được load sẽ chạy.
- Giữ entry **mỏng**: parse args → config → `await main()` / `run(signal)` → map exit code.
- So Go: không `init()` bắt buộc; hạn chế side-effect import ở thư viện.

```ts
// src/index.ts (chạy trực tiếp bằng `node src/index.ts`; bật `rewriteRelativeImportExtensions: true` khi emit `dist/`)
import { parseArgs } from "node:util";
import { main } from "./app.ts";

const { values, positionals } = parseArgs({
  options: { port: { type: "string", default: "3000" } },
  allowPositionals: true,
});

try {
  await main({ port: Number(values.port), files: positionals });
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
```

Nhận biết “đây là entry” (để file vừa lib vừa CLI):

```ts
// Node 26+: chuẩn, gọn, xử lý đúng cả symlink
if (import.meta.main) {
  await runCli();
}
```

Fallback khi cần hỗ trợ phiên bản Node cũ hơn chưa có `import.meta.main` — **bắt buộc dùng `fs.realpathSync`** để không sai lệch khi chạy qua symlink (như shim trong `node_modules/.bin`):

```ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fs.realpathSync(
  import.meta.filename ?? fileURLToPath(import.meta.url),
);
const invoked = process.argv[1]
  ? fs.realpathSync(path.resolve(process.argv[1]))
  : "";
const isEntry = invoked !== "" && thisFile === invoked;

if (isEntry) {
  await runCli();
}
```

CJS: `require.main === module`. ESM trên Node 26: dùng **`import.meta.main`** (fallback `fs.realpathSync` với `process.argv[1]` cho Node cũ). Worker thread: `isMainThread` từ `node:worker_threads` — khác khái niệm “CLI entry”.

> **Callout:** Library import entry có TLA / `listen()` → side-effect khi test. Tách `app.ts` (export `run`) khỏi `index.ts` (parse + gọi).

---

## 2. Các chế độ entry: strip / tsc / tsx / ESM / CJS / bin

Ba runner TS thường gặp: **strip** (`node file.ts`), **`tsc` emit**, **`tsx`**. Chúng **không** thay thế nhau trên CI.

### 2.1 `node file.ts` (type stripping)

```bash
node src/index.ts
node --watch src/index.ts
```

| Được (erasable) | Không (cần tsc/tsx/bundler) |
|---|---|
| `type` / `interface` / `as` / `satisfies` | `enum`, `namespace` runtime |
| Generics erasable; type-only import/export | Parameter properties, `const enum` |
| | Decorators (runtime) — [decorators.md](decorators.md) |
| | `import =` / `export =` / `<>` assertion |

- Runtime **xóa annotation**, **không** type-check.
- tsconfig: `erasableSyntaxOnly` + `verbatimModuleSyntax`.
- Dev nhanh OK; **CI `tsc --noEmit`**; prod nhiều team emit JS.
- `--experimental-transform-types` **đã gỡ** trên Node 26 — enum/param props **không** được “biến thành JS” lúc `node file.ts`.

Source map: strip giữ số dòng gần đúng (whitespace). Stack trace trỏ `.ts` — tiện dev; prod emit + `sourceMap` kiểm soát hơn.

### 2.2 `tsc` emit rồi `node dist/…`

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "dev": "node --watch src/index.ts"
  }
}
```

| Tool | Vai trò |
|---|---|
| **node (strip)** | Không dependency; không type-check; chỉ erasable |
| **tsx** | Dev nhanh (esbuild); ESM tốt; transpile enum/decorator |
| **ts-node** | Compiler TS/SWC; ESM (`"type":"module"`) cấu hình phức tạp hơn |
| **tsc emit** | Prod/CI rõ; gần runtime Node nhất (JS thuần) |

- `module` / `moduleResolution`: **`NodeNext`** khớp `"type": "module"`.
- **Đồng nhất đuôi import giữa `dev` và `build`:** Node strip **không** remap `.js` sang `.ts`. Nếu dùng `"dev": "node --watch src/index.ts"` cùng `"build": "tsc"`, nguồn phải import đuôi **`.ts`** và bật `"rewriteRelativeImportExtensions": true` để `tsc` đổi sang `.js` khi emit vào `dist/`. Ngược lại, nếu giữ convention import `.js` trong `src/`, tách hẳn dev sang `tsx watch src/index.ts` hoặc biên dịch `tsc -w` rồi chạy `dist/index.js`.
- Với **TypeScript 7.0 (native Go compiler)**, tốc độ `tsc` tăng mạnh (~10× so với `tsc` JS cũ) — pipeline build trước hoặc `tsc -w` + chạy `dist/` đủ nhanh cho nhiều repo cần type-check liên tục hoặc dùng cú pháp non-erasable.

Prod: chạy **`dist/*.js`**, không `tsx` trên máy user / image. Image Docker `CMD ["node", "dist/index.js"]`.

### 2.3 `tsx` vs `ts-node` vs strip

| | Strip `node` | `tsx` | `ts-node` |
|---|---|---|---|
| Typecheck | Không | Không | Có nếu kéo compiler (chậm) |
| Enum / decorator | **Không** | Transpile | Transpile |
| ESM | Theo `"type"` | Tốt | `ts-node/esm` / loader — dễ lệch |
| Prod | Chỉ khi erasable + chấp nhận | Thường **không** | Thường **không** |
| Watch | `node --watch` | `tsx watch` | `ts-node-dev` / tự `--watch` |

`tsx` (esbuild) **không** thay `tsc --noEmit`. `ts-node` trên ESM + `NodeNext` hay vướng `module` mismatch — team mới: strip **hoặc** tsx + CI tsc.

> **Callout:** Một repo một **dev runner**. Đừng `tsx` local, strip trên CI, `ts-node` trên Docker.

### 2.4 ESM vs CJS

```json
{ "type": "module" }
```

| | **ESM** | **CJS** |
|---|---|---|
| Kích hoạt | `"type":"module"` / `.mjs` | mặc định / `.cjs` |
| Top-level `await` | Có | Không (async IIFE) |
| `__dirname` | `import.meta.dirname` / `fileURLToPath` | Có sẵn |
| Entry detect | `import.meta.main` (fallback `realpathSync(argv[1])`) | `require.main === module` |

```ts
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = join(__dirname, "config.json");
```

> Field **`module`** trong `package.json` là convention bundler — **Node không dùng** để resolve. Dựa vào **`exports`**. Chi tiết: [modules-packages.md](modules-packages.md).

### 2.5 `package.json` `exports` / `bin`

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
  },
  "bin": { "my-tool": "./bin/cli.js" },
  "main": "./dist/index.cjs"
}
```

- Chỉ path trong `exports` mới public.
- `bin`: shebang + **JS đã emit** — không phụ thuộc `tsx` trên máy user.
- Giữ `main` để tương thích tooling cũ; resolve hiện đại = `exports`.
- `bin` có thể là string (`"bin": "./bin/cli.js"`) hoặc map nhiều lệnh.

npm/pnpm khi install: tạo shim trong `node_modules/.bin`. Yarn/pnpm tương tự. Package `files` **phải** gồm file `bin` trỏ tới.

### 2.6 Shebang & CLI

```ts
#!/usr/bin/env node
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { help: { type: "boolean", short: "h" } },
});
if (values.help) {
  console.log("Usage: my-tool [options]");
  process.exitCode = 0;
} else {
  await run();
}
```

- Dòng **đầu tiên** phải shebang, không BOM, không comment trước.
- `#!/usr/bin/env node` linh hoạt hơn `#!/usr/bin/node` (nvm/fnm/volta).
- Unix: `chmod +x bin/cli.js` trong repo; pack npm giữ mode nếu git `100755`.
- **Windows:** Windows OS (cmd/PowerShell) bỏ qua shebang lúc thực thi, nhưng **npm/pnpm đọc `#!/usr/bin/env node` lúc install** để sinh wrapper `my-tool.cmd` / `.ps1` gọi `node bin/cli.js` (thiếu shebang → shim có thể chạy thẳng file thay vì qua `node`). Chạy `node bin/cli.js` trực tiếp vẫn hoạt động; Git Bash đọc trực tiếp shebang.
- Đừng shebang `tsx` / `ts-node` trên binary publish.
- `env node` lấy `node` trên `PATH` của user — document `engines.node`.

### 2.7 So sánh ba pipeline (quyết định)

| Tiêu chí | Strip `node file.ts` | `tsx` | `tsc` → `node dist` |
|---|---|---|---|
| Typecheck | Không | Không | Có lúc emit; CI vẫn `--noEmit` |
| Enum / decorator / param props | **Cấm** | Transpile | Emit JS |
| Phụ thuộc | Chỉ Node | `tsx` (esbuild) | `typescript` |
| Source map | Gần 1:1 dòng | Tốt | `sourceMap: true` |
| Image prod | Chỉ nếu erasable + chấp nhận | Không khuyến nghị | **Mặc định** |
| Cold start | Nhanh | Nhanh | Nhanh (đã emit) |

Chọn:

1. Service erasable, team kỷ luật CI → strip dev + `tsc --noEmit` + **vẫn** emit prod (nhiều team) **hoặc** strip prod nếu image Node 26 và syntax sạch.
2. Còn decorator/enum → `tsx` dev, `tsc` prod — **không** strip.
3. Library publish → luôn `tsc` + `.d.ts`; consumer không chạy `tsx` của bạn.

`--watch` + strip: restart process, không HMR. `tsx watch` tương tự về process, khác transpile.

Dual: `dev` strip, `start` dist — nguồn import **`.ts`** và bật `rewriteRelativeImportExtensions` để emit thành `.js`. Node strip không remap `.js` sang `.ts`; convention `.js` trong nguồn dành cho pipeline emit hoặc runner có remap. Với tốc độ của **TS 7 Go compiler**, biên dịch `tsc` sang `dist/` trên CI và thậm chí trong dev watch ít tốn chờ đợi hơn trước rõ rệt.

### 2.8 `node --run`, SEA (`--build-sea`) & `node.config.json`

- **`node --run <script>`:** chạy trực tiếp script trong `package.json` bằng chính binary Node (bỏ qua overhead khởi động `npm`/`pnpm`, tự thêm `node_modules/.bin` vào `PATH`, truyền args sau `--`):

```bash
node --run typecheck
node --run dev -- --port 8080
```

- **Single Executable Applications (`node --build-sea`):** đóng gói ứng dụng Node thành một binary độc lập bằng file cấu hình JSON (`sea-config.json`). Trên Node 26, `node --build-sea sea-config.json` gom sẵn bước tạo blob + nhúng vào bản sao binary Node mà không cần công cụ `postject` thủ công cho luồng tiêu chuẩn (lưu ý: native addon `.node` và `require` động vẫn cần cấu hình asset/cẩn trọng khi đóng gói).
- **`--experimental-config-file` (`node.config.json`):** gom các CLI flag (`nodeOptions`, permission model, v.v.) vào file JSON để kiểm soát tập trung thay vì chuỗi `NODE_OPTIONS` dài khó audit (tính năng còn experimental — kiểm tra ổn định trước khi dùng rộng ở prod).

---

## 3. `process.argv` & `util.parseArgs`

```text
node app.js --port 3000 input.txt
argv[0]=node  argv[1]=script  argv.slice(2)=args người dùng
```

`argv[1]` có thể là path tương đối hoặc symlink; trên Node 26 ưu tiên `import.meta.main`, còn khi fallback so path thì dùng `fs.realpathSync(path.resolve(process.argv[1]))`.

```ts
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: { type: "string", short: "p", default: "3000" },
    verbose: { type: "boolean", short: "v", default: false },
    tag: { type: "string", multiple: true },
  },
  allowPositionals: true,
  strict: true, // unknown flag → throw
});
```

| Option | Ý nghĩa | Default |
|---|---|---|
| `type: "string" \| "boolean"` | Kiểu flag | bắt buộc trong `options` |
| `short` / `multiple` / `default` | Alias, lặp → mảng, mặc định | |
| `allowPositionals` | Arg không phải flag | `false` nếu `strict` |
| `strict` | Từ chối flag lạ / type sai | **`true`** |
| `tokens` | Trả token thô theo thứ tự | `false` |
| `allowNegative` | Cho phép `--no-<flag>` cho boolean (`--no-color`) | `false` |
| `args` | Override `argv` (test) | `argv` bỏ exec+script |

- Subcommand phức tạp: parse hai pha hoặc lib (`commander`, `cac`).
- Usage / lỗi → **stderr**; data CLI → **stdout**.

```ts
if (positionals.length < 1) {
  console.error("usage: tool <file>");
  process.exitCode = 2;
}
```

### 3.1 `strict`

`strict: true` (mặc định): unknown `--flag` hoặc value sai type → **throw** (`ERR_PARSE_ARGS_*`). Bọc `try/catch` ở entry → usage stderr + `exitCode = 2` (misuse, không phải 1 “crash”).

`strict: false`: flag lạ vào kết quả (cần tự xử lý) — dễ nuốt typo. CLI public: **giữ strict**.

`--` (option-terminator): sau `--`, token là positional kể cả `-looks-like-flag`.

### 3.2 `tokens: true`

```ts
const { values, positionals, tokens } = parseArgs({
  options: {
    color: { type: "boolean", default: true },
    port: { type: "string", short: "p" },
  },
  allowPositionals: true,
  tokens: true,
});

for (const t of tokens ?? []) {
  if (t.kind === "option") {
    // t.name, t.rawName ("-p" | "--port"), t.value, t.inlineValue, t.index
  } else if (t.kind === "positional") {
    // t.value, t.index
  } else if (t.kind === "option-terminator") {
    // "--"
  }
}
```

Token **theo thứ tự gặp**. `-xy` tách thành hai option token. `--port=3000` → `inlineValue: true`. Dùng tokens để:

- Subcommand: positional đầu là lệnh, parse lại `args.slice(token.index + 1)`.
- Negate / thứ tự ưu tiên (`--color` rồi `--no-color`).
- Forward unknown (khi `strict: false`) sang tool con.

> **Callout:** `parseArgs` **không** sinh help text. Tự `console.error` usage. Pointer API đầy đủ: [nodejs-apis.md](nodejs-apis.md) § `util`.

Hai pha subcommand:

```ts
const rawArgs = process.argv.slice(2);
const first = parseArgs({
  args: rawArgs,
  options: {
    // Phải khai báo các global flag nhận giá trị (như -c/--config) ở pha 1,
    // nếu không `--config app.json serve` sẽ bị nhầm "app.json" là subcommand.
    config: { type: "string", short: "c" },
  },
  allowPositionals: true,
  strict: false,
  tokens: true,
});

const cmdToken = first.tokens.find((t) => t.kind === "positional");
if (!cmdToken) {
  console.error("usage: my-tool [-c <file>] <serve|migrate> [options]");
  process.exitCode = 2;
} else {
  const cmd = cmdToken.value;
  const rest = rawArgs.slice(cmdToken.index + 1);

  if (cmd === "serve") {
    const { values } = parseArgs({
      args: rest,
      options: { port: { type: "string", short: "p" } },
      strict: true,
    });
    void values;
  }
}
```

`strict: false` pha 1 tránh ném khi flag thuộc subcommand (nhưng phải khai báo global flag có giá trị trước subcommand để parser không lấy nhầm value làm `cmd`). Kiểm tra `if (!cmdToken)` trước khi `slice` để không cắt sai khi thiếu subcommand. Pha 2 `strict: true` cho lệnh đó.

`args` mặc định đã **bỏ** `argv[0]`/`[1]`. Truyền `args: process.argv.slice(2)` tường minh khi test.

---

## 4. Exit codes: `process.exit` vs `exitCode`

| Code | Convention |
|---|---|
| `0` | Thành công |
| `1` | Lỗi chung |
| `2` | Sai cách dùng / argument |
| `128 + n` | POSIX default khi signal `n` (SIGINT=130) — Node default handler |

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

process.exitCode = await main();
```

| | **`process.exit(code)`** | **`process.exitCode = n`** |
|---|---|---|
| Hành vi | Thoát **ngay** | Đặt mã; thoát khi loop idle |
| I/O / log | Có thể cắt dở flush | An toàn hơn |
| `'beforeExit'` | **Không** chạy | Có thể chạy nếu loop trống |
| `'exit'` | Có (sync only) | Có |
| Khi dùng | Fatal không cứu được | **Mặc định khuyến nghị** |

`process.exit(0)` giữa `stdout.write` lớn → user mất output. Stdout pipe (`| jq`) buffer — `exit()` cắt. `exitCode` + để loop drain.

```ts
// Khuyến nghị: quan sát mà KHÔNG chặn hành vi crash mặc định của Node
process.on("uncaughtExceptionMonitor", (err, origin) => {
  console.error("fatal", origin, err); // sync log / telemetry
});

// Nếu tự bắt trực tiếp: gắn listener sẽ TẮT crash mặc định.
// Phải gọi process.exit(1) — chỉ set process.exitCode = 1 sẽ giữ HTTP server sống trong trạng thái hỏng!
process.on("uncaughtException", (err) => {
  console.error("fatal", err);
  process.exit(1); // process không tin cậy — thoát ngay
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection", reason);
  process.exit(1); // KHÔNG chỉ gán exitCode = 1 rồi để server chạy tiếp
});
```

> **Callout:** Node 26 mặc định **crash** process khi có unhandled rejection (`--unhandled-rejections=throw`). Gắn `process.on("unhandledRejection", ...)` mà chỉ đặt `process.exitCode = 1` sẽ **tắt cơ chế crash mặc định** và để HTTP server tiếp tục phục vụ trên state hỏng. Dùng `uncaughtExceptionMonitor` để ghi nhận trước khi crash, hoặc gọi `process.exit(1)` ngay sau khi log/flush sync.

`process.exitCode` có thể gán nhiều lần; giá trị **cuối** trước khi thoát thắng. Signal default POSIX: 128+signal — handler tự gán `exitCode` nếu muốn 0 sau graceful.

---

## 5. `beforeExit`, `exit`, uncaught vs shutdown

Ba lớp **không** thay thế nhau:

| Sự kiện | Khi nào | Async? | Dùng để |
|---|---|---|---|
| `'beforeExit'` | Loop **trống**, sắp thoát tự nhiên | Có thể schedule thêm work | Flush nhẹ; **không** thay SIGTERM |
| `'exit'` | Thực sự thoát (`exit()`, idle, fatal) | **Chỉ sync** | Sync log, không `await` |
| Signal (`SIGINT`…) | OS / terminal / orchestrator | Handler async OK | Graceful: close server, abort |
| `uncaughtException` | Throw không bắt | Process **hỏng** | Log + `process.exit(1)` |
| `unhandledRejection` | Promise reject không `catch` | Policy fail process | Log; đừng “tiếp tục phục vụ” |

### 5.1 `beforeExit`

```ts
process.on("beforeExit", (code) => {
  // loop trống — có thể queue async → trì hoãn thoát
  console.error("beforeExit", code);
});
```

**Không** chạy nếu: `process.exit()`, uncaught (tùy đường), hoặc process bị **signal kill** mà không drain loop. Shutdown SIGTERM gọi `process.exit()` trong handler → **bỏ** `beforeExit`. Cleanup async đặt **trong** `shutdown()`, không dựa `beforeExit`.

Listener `beforeExit` schedule `setTimeout` / I/O → process **sống tiếp** — dễ loop vô hạn nếu luôn còn timer. Dùng `unref()` hoặc chỉ sync.

### 5.2 `exit`

```ts
process.on("exit", (code) => {
  // sync only — không await fetch, không setTimeout
  console.error("exit", code);
});
```

### 5.3 Uncaught vs graceful shutdown

| Tình huống | Hành vi đúng |
|---|---|
| SIGTERM / SIGINT / (Unix) SIGHUP có chủ đích | Graceful: `ready=false` → `server.close` → abort in-flight → `exitCode` |
| `uncaughtException` | State **không xác định**. Log (sync/stderr) + **`process.exit(1)`**. Không cố drain request “cho đẹp” |
| `unhandledRejection` | Coi như bug. Mặc định Node 26 crash; dùng `uncaughtExceptionMonitor` để quan sát hoặc tự log + `process.exit(1)` — **không** chỉ set `exitCode = 1` trên server |
| Lỗi trong `shutdown()` | Force timeout rồi `process.exit(1)` — đừng treo |

```ts
process.on("uncaughtException", (err, origin) => {
  console.error("uncaughtException", origin, err);
  process.exit(1);
});
```

`origin`: `'uncaughtException'` | `'unhandledRejection'` (khi dùng chung handler hiện đại — kiểm docs `process` minor).

> **Callout:** Graceful **chỉ** cho tín hiệu/orchestrator. Uncaught = **crash**. Trộn hai lối → server “sống” với heap hỏng.

`uncaughtExceptionMonitor` (ổn định trên Node 26): quan sát **trước** khi crash mà **không** chặn hành vi thoát mặc định — vẫn không biến uncaught thành graceful.

---

## 6. Signal: SIGINT / SIGTERM / SIGHUP — Windows vs POSIX

Tinh thần tương đương `signal.NotifyContext` (Go):

```ts
import http from "node:http";

let ready = false;
const server = http.createServer((req, res) => {
  if (req.url === "/ready") {
    res.statusCode = ready ? 200 : 503;
    res.end(ready ? "ready" : "draining");
    return;
  }
  if (!ready) {
    res.statusCode = 503;
    res.setHeader("Connection", "close");
    res.end("shutting down");
    return;
  }
  res.end("ok");
});
await new Promise<void>((r) => server.listen(3000, r));
ready = true;

const ac = new AbortController();
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error("shutdown", signal);
  ready = false; // readiness fail trước
  ac.abort(new Error(signal));
  server.closeIdleConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  // đóng DB / worker pool…
  process.exitCode = 0;
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.once(sig, () => {
    shutdown(sig).catch((err) => {
      console.error("shutdown failed", err);
      process.exit(1);
    });
  });
}

// truyền ac.signal xuống fetch / queue / run()
```

| Tín hiệu | POSIX | Windows (emulation Node) |
|---|---|---|
| **SIGINT** | Ctrl+C; default exit `130` | Ctrl+C — **dùng được** |
| **SIGTERM** | K8s / systemd / Docker stop | **Không** phải tín hiệu OS; `process.on("SIGTERM")` nghe được nhưng nhiều tool **không gửi** |
| **SIGHUP** | Terminal đóng / daemon reload (convention) | Console **đóng** → SIGHUP; ~10s sau Windows **kill** không điều kiện |
| **SIGBREAK** | N/A / listen-only | Ctrl+Break |
| **SIGKILL** | Không bắt được | Task Manager / `taskkill /F` |

POSIX: listener `SIGINT`/`SIGTERM` **gỡ default** (Node không tự exit 128+n). **Phải** tự thoát sau drain — quên `close` → process zombie.

Windows service / Docker Desktop: thường nhận **SIGINT** hoặc kill cứng; **đừng** chỉ bắt `SIGTERM`. Bắt cả `SIGINT` + `SIGTERM`; cân nhắc `SIGBREAK`. `SIGHUP` trên Windows **không** đủ cho graceful dài — chỉ flush sync.

```ts
const FORCE_MS = 10_000;
let forceScheduled = false;

function onSignal(signal: string) {
  if (forceScheduled) return;
  forceScheduled = true;
  shutdown(signal).catch((err) => {
    console.error("shutdown failed", err);
    process.exit(1);
  });
  setTimeout(() => process.exit(1), FORCE_MS).unref();
}

for (const s of ["SIGINT", "SIGTERM"] as const) {
  process.once(s, () => onSignal(s));
}
```

`server.close` **không** destroy connection keep-alive đang treo. Kết hợp:

```ts
server.closeIdleConnections(); // ổn định từ Node 18.2+
// hoặc theo dõi req/res: res.on("finish"), timeout destroy
```

`http.Server` có sẵn `closeAllConnections()` / `closeIdleConnections()` (ổn định từ Node 18.2+ trên Node 26) — drain: đóng idle trước, đợi in-flight hoàn tất, quá hạn mới `closeAllConnections()` + `process.exit(1)`.

`AbortSignal` xuống `fetch` / queue: request mới reject; in-flight tự quyết (abort vs hoàn tất). Readiness fail **trước** để LB ngừng gửi.

Timeout force: `unref()` để timer không giữ process nếu drain xong sớm — nhưng force vẫn `process.exit(1)` nếu treo `close` (connection không kết).

PID 1 trong Docker: Node nhận SIGTERM nếu `CMD ["node", ...]` (JSON form). `CMD node dist` qua shell có thể **không** forward signal — dùng form exec.

### 6.1 Bảng tín hiệu mở rộng

| Sự kiện | Bắt được? | Async cleanup? |
|---|---|---|
| SIGINT | Có (TTY) | Có — nhớ tự exit |
| SIGTERM | POSIX có; Windows emulation | Có |
| SIGHUP | POSIX có; Windows console close + kill ~10s | POSIX có; Windows **không** tin |
| SIGBREAK | Windows Ctrl+Break | Có trên Win |
| SIGKILL | **Không** | — |
| `message` IPC | Cluster/worker | — |
| `disconnect` | Cluster | Đóng server |

`process.on("SIGTERM", handler)` **không** `once` nếu bạn muốn log lần 2 (force). Pattern: `once` lần 1 graceful; lần 2 `exit(1)` ngay.

`readline`/`stdin` raw: Ctrl+C có thể không SIGINT — CLI TTY tự `process.exit`.

### 6.2 `cluster` worker và signal

Primary nhận SIGTERM: **không** giả định worker tự nhận cùng lúc mọi OS. `worker.disconnect()` + timeout `kill`. Worker listen `disconnect` → `server.close`.

Windows cluster: round-robin **khác** Unix (docs `cluster`). Test load trên OS prod. Sticky session: `cluster` không sticky HTTP/1 keep-alive luôn như mong đợi — LB ngoài hoặc Redis session.

Primary log `worker.id` khi debug request — header `X-Worker` chỉ nên bật ở dev.

`process.exitCode` trên worker **không** tự thành exit code primary. Primary lắng `exit` + `worker.process.exitCode`. Orchestrator: replica > cluster trong một pod.

Health probe **một** process listen: cluster phải probe primary **hoặc** worker port share. Sai: `/ready` trên primary không `listen` HTTP. Pattern: mọi worker serve `/ready`; LB hit port share.

`process.kill(pid, "SIGTERM")` trên Windows là emulation — không tương đương Unix. Orchestrator Linux gửi SIGTERM thật.

Ctrl+C trong raw mode (REPL, game CLI) **không** luôn SIGINT — đọc `readline` / TTY docs nếu CLI bắt phím.

---

## 7. Top-level await vs `async main()`

**ESM + TLA:**

```ts
const config = await loadConfig();
await start(config);
```

**`main().catch` (rõ exit, dễ test):**

```ts
async function main(argv: string[]): Promise<void> {
  await start(await loadConfig(), argv);
}

main(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

**CJS** — không TLA:

```js
(async () => { await main(); })().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

| Cách | Ưu | Nhược |
|---|---|---|
| Top-level `await` | Ít boilerplate ESM | Export module trì hoãn; TLA lan lib → chậm; `require(esm)` → `ERR_REQUIRE_ASYNC_MODULE` |
| `main().catch` | Testable; map exit rõ; import lib không chờ boot | Thêm vài dòng; nhớ gán `exitCode` |

TLA **block cả graph**: `import "./entry.js"` từ test / tool chờ `listen()` xong. `async main` export `run` sync-callable.

```ts
export async function run(signal: AbortSignal): Promise<void> { /* ... */ }

if (import.meta.main) { // fallback realpathSync(argv[1]) cho Node cũ — xem §1
  const ac = new AbortController();
  process.once("SIGINT", () => ac.abort());
  try {
    await run(ac.signal);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
}
```

> **Callout:** Giữ TLA **ở entry/boot**. Library: export sync + nhận config từ entry. Test gọi `run()` không load HTTP listen.

Promise `main()` không `await` / không `.catch` → unhandled rejection. TLA reject → process fail (ESM evaluation).

---

## 8. `--watch` & reload

```bash
node --watch src/index.ts
node --watch dist/index.js
node --watch-path=./src --watch-path=./config dist/index.js
```

| Flag | Việc |
|---|---|
| `--watch` | Restart khi file import / entry đổi |
| `--watch-path=` | Thêm thư mục/file (config JSON không import) |
| `--watch-preserve-output` | Không xóa console mỗi restart |
| `--watch-kill-signal=` | Tín hiệu gửi process con khi reload (mặc định `SIGTERM`; vd `SIGINT`/`SIGKILL`) |

`--watch` **không** type-check. Kết hợp strip hoặc JS emit. `tsx watch` transpile + reload.

Hạn chế:

- Restart = **process mới** — mất in-memory state, connection. Dev OK; prod **không** dùng `--watch`.
- File ngoài graph (chỉ đọc `fs.readFile`) không trigger trừ `--watch-path`.
- Cluster / worker: watch primary dễ spawn trùng — watch **một** process.
- Windows file events khác Unix (đôi khi double-fire) — restart hai lần: chấp nhận hoặc debounce tool.
- `--watch` restart **cả** process: connection HTTP drop; dev client phải retry. Không phải HMR.

Kết hợp emit (cross-platform — **không** dùng `&` của POSIX shell trong `package.json`, vì lỗi trên Windows cmd/PowerShell và để lại process mồ côi khi Ctrl+C):

```json
{
  "scripts": {
    "dev": "node --watch src/index.ts",
    "build:watch": "tsc -b -w",
    "dev:dist": "concurrently \"node --run build:watch\" \"node --watch dist/index.js\""
  }
}
```

Hoặc chạy `build:watch` và `node --watch dist/index.js` ở hai terminal riêng (dùng `concurrently` / `npm-run-all2` nếu cần một lệnh). Hai process vẫn có thể race ngắn khi emit chưa xong; `tsx watch` một process gọn hơn nếu dự án còn cú pháp không erasable. Với **TS 7 Go compiler**, pha `tsc -b -w` cực nhanh nên vòng lặp `build:watch` + `--watch` rất mượt.

`node --watch` **bỏ qua** `node_modules` theo mặc định (tránh restart khi install). Config ngoài repo: `--watch-path`.

`nodemon` vẫn hữu ích khi chạy lệnh phức tạp (`docker compose`, nhiều glob). Nhiều team: `tsx watch` hoặc `node --watch`.

> **Callout:** `--watch` không thay test watch (`node --test --watch`) và không thay `tsc -w`. Tách script `dev` / `typecheck:watch`.

---

## 9. Environment: `--env-file` vs dotenv

```bash
node --env-file=.env dist/index.js   # Node 20.6+; ổn định trên 26
node --env-file=.env --env-file=.env.local dist/index.js
```

Nhiều `--env-file`: file **sau** ghi đè key của file **trước**, nhưng **không** ghi đè biến đã có sẵn trong environment của process. `--env-file-if-exists` (ổn định trên Node 26) hoạt động tương tự nhưng không báo lỗi khi thiếu file.

```ts
function parsePort(raw = "3000"): number {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("PORT cannot be empty");
  const port = Number(trimmed);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${raw}`);
  }
  return port;
}

const port = parsePort(process.env.PORT);

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
```

**Nạp & parse `.env` programmatic (built-in Node 26):** thay vì cài `dotenv`, có thể dùng `process.loadEnvFile()` (nạp vào `process.env`, không ghi đè key đã tồn tại) và `util.parseEnv()` (parse thuần sang object, không đụng `process.env` — rất tiện cho test/tooling):

```ts
import { parseEnv } from "node:util";

process.loadEnvFile(".env"); // ném lỗi nếu file không tồn tại; gọi sớm trước khi đọc config

const parsed = parseEnv("PORT=3000\nDEBUG=true\n");
// { PORT: "3000", DEBUG: "true" }
```

| Cách | Khi dùng |
|---|---|
| `--env-file` / `--env-file-if-exists` | Dev/prod đơn giản; load **trước** user code, không cần `dotenv` |
| `process.loadEnvFile()` / `util.parseEnv()` | Cần nạp có điều kiện trong code boot hoặc parse chuỗi `.env` thuần (test) |
| `dotenv` package | Legacy — cẩn thận load order; không gắn CLI Node |
| Secret manager / K8s Secret | Prod — không commit secret |
| Hardcode fallback | Chỉ default an toàn (port), không API key |

- Đừng `dotenv.config()` **sau** khi module khác đã đọc `process.env` lúc import.
- `.env.example` không secret; validate env lúc boot → fail fast.
- `NODE_OPTIONS` ảnh hưởng mọi entry — document trong README.
- `--env-file` load **trước** user code; TLA/`import` đã thấy biến. `dotenv` trong `index.ts` **sau** import `./config.ts` thì muộn.

```ts
// config.ts — đọc & validate env lúc evaluate (tránh "" → 0 hoặc "abc" → NaN)
export const port = parsePort(process.env.PORT);
```

```bash
# đúng: file env trước runtime
node --env-file=.env dist/index.js
```

`dotenv` + `--env-file` **trùng** → khó đoán ai thắng. Chọn **một**.

Định dạng `--env-file` (Node): `KEY=VALUE`, comment `#`, không cần `export`. Quote tùy parser Node (đơn giản hơn bash). Không chạy command substitution. Multiline: theo docs minor — đừng giả định bash.

`--env-file` **không** override biến **đã** có trong environment (thường) — K8s inject thắng file. `dotenv` mặc định khác (không override trừ `override: true`). Đọc đúng tool.

`NODE_ENV=production` không load `.env` thần kỳ — bạn phải truyền `--env-file` hoặc inject. Framework (Next, v.v.) có convention riêng — service Node thuần: tường minh.

### 9.1 `NODE_OPTIONS` & debug

```bash
NODE_OPTIONS="--max-old-space-size=4096 --trace-uncaught"
node dist/index.js
```

`NODE_OPTIONS` áp **mọi** Node con (test, husky) — document. Cấm nhét secret vào `NODE_OPTIONS` (log CI). `--inspect` trên prod: bind cẩn thận.

`node --print "process.execArgv"` debug flag thực. Lưu ý: Node **cấm** `--env-file` và `--env-file-if-exists` trong `NODE_OPTIONS` (`node: --env-file= is not allowed in NODE_OPTIONS`) — phải truyền trực tiếp qua CLI argv, `node.config.json`, hoặc gọi `process.loadEnvFile()`.

`DEBUG=*` convention không phải core Node — `util.debuglog` / `NODE_DEBUG=fs,net` (core). `NODE_DEBUG` ồn; đừng bật mặc định prod.

### 9.2 `--env-file` vs Docker Compose `env_file`

Compose `env_file:` inject vào **container env** trước process — khác `node --env-file` (Node parse file). Trùng key: env container thường thắng `--env-file` (file không override). Chọn một kênh: Compose **hoặc** Node flag.

Kubernetes `envFrom` ConfigMap: không commit secret; `Secret` volume. `--env-file` trong image là anti-pattern nếu file chứa secret.

Prod K8s: inject env; không copy `.env` vào image. `--env-file` cho compose/dev.

> **Callout:** `--env-file` không thay `engines` / secrets. Không commit `.env`. Parse số/URL tường minh — `process.env` luôn `string | undefined`.

**Không** cố đặt `NODE_OPTIONS=--env-file=.env` — Node từ chối ngay lúc khởi động (`--env-file= is not allowed in NODE_OPTIONS`). Truyền `--env-file` tường minh trong script `start`/`dev`, dùng `node.config.json`, hoặc gọi `process.loadEnvFile()` lúc boot.

`process.env` mutable. Gán `process.env.FOO = "1"` **sau** khi module khác đã capture `const foo = process.env.FOO` lúc import thì **không** cập nhật. Validate + freeze-by-convention (object `config` const) lúc boot.

Boolean env: `"0"` / `"false"` là string truthy nếu `if (process.env.DEBUG)`. Parse tường minh:

```ts
function envFlag(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v === undefined) return defaultValue;
  return v === "1" || v === "true";
}
```

---

## 10. Readiness vs liveness

| Probe | Ý nghĩa | Entry / shutdown |
|---|---|---|
| **Liveness** | Process còn sống? | `/healthz` → 200 nếu loop còn; fail → K8s **restart** |
| **Readiness** | Nhận traffic? | `ready=false` ngay khi bắt đầu shutdown; fail nếu DB chưa sẵn → **bỏ** khỏi Service |
| **Startup** | Boot xong? | K8s startupProbe lúc migrate/warm; tránh liveness giết pod chậm |

```ts
let ready = false;

async function boot() {
  await connectDb();
  ready = true;
  await listen();
}

// GET /ready → ready ? 200 : 503
// GET /healthz → 200 nếu process lên (không phụ thuộc DB trừ khi bạn cố ý)
```

Sai: liveness = ping DB. DB chậm → restart cascade. Liveness nhẹ (event loop còn); readiness = dependency.

Shutdown: **clear `ready` trước** `server.close` để kube ngừng gửi request, rồi drain.

Chi tiết loop lag: [event-loop.md](event-loop.md). Entry **set `ready`**; signal **clear `ready`** trước `server.close`.

CLI không HTTP: không bịa `/healthz`. Batch job: exit code + logs.

> **Callout:** Readiness fail **không** kill process. Liveness fail thì có. Đừng gộp một URL trừ khi hiểu hệ quả.

---

## 11. `cluster` vs single process

```ts
import cluster from "node:cluster";
import os from "node:os";
import http from "node:http";

if (cluster.isPrimary) {
  let shuttingDown = false;
  const n = os.availableParallelism();
  for (let i = 0; i < n; i++) cluster.fork();

  cluster.on("exit", (worker) => {
    console.error("worker down", worker.process.pid);
    // Chặn respawn vô hạn khi đang shutdown có chủ đích
    if (!shuttingDown && !worker.exitedAfterDisconnect) {
      cluster.fork();
    }
  });

  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      for (const w of Object.values(cluster.workers ?? {})) {
        w?.disconnect();
      }
      setTimeout(() => {
        for (const w of Object.values(cluster.workers ?? {})) {
          w?.process.kill();
        }
        process.exit(1);
      }, 10_000).unref();
    });
  }
} else {
  const server = http.createServer((_req, res) => res.end("ok")).listen(3000);
  process.once("disconnect", () => {
    server.closeIdleConnections();
    server.close(() => process.exit(0));
  });
}
```

| | **Single process** | **`cluster` (fork)** |
|---|---|---|
| RAM | Một heap | N × heap + primary |
| CPU JS | 1 thread (I/O overlap) | N isolate — CPU-bound scale |
| State | In-memory OK | **Không** share (session → Redis) |
| Debug | Đơn giản | Nhiều PID; log dính |
| Port | `listen` bình thường | Primary share socket (Unix round-robin) |
| Windows | — | Cluster **khác** Unix (policy listen) |

Node 26 I/O: **một** process thường đủ (async). `cluster` khi:

- CPU JS (crypto nặng, JSON khổng lồ) và chưa tách `worker_threads`;
- Cần isolate crash (worker chết, primary fork lại);
- Không có orchestrator (K8s replica).

K8s/N replicas **thường tốt hơn** `cluster` trong một pod (một process/pod, scale HPA). `cluster` trong pod vừa nhân RAM vừa khó probe (sẵn sàng khi **mọi** worker listen).

Primary phải đặt cờ `shuttingDown` + kiểm tra `!worker.exitedAfterDisconnect` trong listener `"exit"` trước khi `cluster.fork()` (xem ví dụ trên), nếu không mỗi `worker.disconnect()` lúc SIGTERM sẽ kích hoạt respawn vô hạn.

`cluster.isPrimary` (tên mới) thay `isMaster` deprecated. Worker: `cluster.isWorker`. IPC `process.send` / `worker.on("message")` — JSON-like, không share memory (khác `worker_threads`).

`worker_threads`: CPU **cùng** process, share `ArrayBuffer` — không nhân listen HTTP. Xem [threading.md](threading.md).

> **Callout:** `cluster` **không** phải cụm mạng. Primary + worker cùng máy. Shutdown: primary gửi tín hiệu worker, đợi `exit`, rồi tự thoát — đừng chỉ bắt SIGTERM trên worker.

Single process + `AbortSignal` + readiness: mặc định khuyến nghị. `cluster` khi đo được bottleneck CPU và không đi replica.

---

## 12. Pitfalls

1. Tin `node file.ts` = đã type-check → thiếu CI `tsc --noEmit`.
2. Rely field `module` trong `package.json` cho Node resolve.
3. `process.exit(0)` giữa chừng → mất log / cắt `close` server / bỏ `beforeExit`.
4. TLA trong thư viện sâu → import chậm; dual package hazard khi publish CJS+ESM.
5. Không bắt SIGTERM **và** SIGINT trên container/Windows → SIGKILL giữa request.
6. `dotenv` sau side-effect import; quên `exitCode` sau catch → exit 0 giả.
7. Worker/child path relative CWD sai dưới systemd — dùng `import.meta.url`.
8. Nhiều handler SIGTERM không guard → `close` hai lần.
9. Dựa `beforeExit` cho graceful — không chạy sau `process.exit` / kill.
10. Uncaught rồi vẫn `listen` — heap hỏng.
11. `--watch` trên prod; `tsx` làm `bin` publish.
12. Liveness = DB ping → restart cascade.
13. `parseArgs` `strict` throw không bắt → stack thay usage.
14. `cluster` + in-memory session / singleton DB pool nhân N.

---

## 13. Best practices

1. Entry mỏng: `parseArgs` → validate env → `run(signal)` → `exitCode`; `exports`/`bin` trỏ JS emit.
2. Ưu tiên `process.exitCode`; `process.exit` chỉ fatal / force timeout.
3. SIGINT + SIGTERM: readiness=false → `server.close` → AbortSignal → force timeout. Windows: đừng chỉ SIGTERM.
4. TLA chỉ boot; logic trong `main`/`run` export được để test. Library không TLA.
5. `--env-file` **hoặc** secret store — không trộn `dotenv` muộn; validate boot.
6. Stderr = log/lỗi; stdout = dữ liệu CLI; document exit codes 0/1/2.
7. Strip cho dev; emit + `tsc --noEmit` cho CI/prod; một runner (`tsx` **hoặc** strip).
8. `parseArgs({ strict: true })`; misuse → stderr + code 2; `tokens` khi subcommand.
9. Phân biệt `/ready` vs `/healthz`; clear ready **trước** close.
10. Mặc định một process; `cluster` khi đo CPU và không có replica.

---

## 14. Checklist

```text
□ Entry mỏng; logic trong main/run có thể test
□ ESM/CJS/`type`/`exports`/`bin` khớp cách chạy thật
□ bin: shebang + JS emit; không tsx trên user machine
□ parseArgs — strict; usage → stderr; exit 2 khi misuse
□ tokens nếu subcommand / thứ tự flag
□ Lỗi: exitCode = 1; tránh process.exit trừ fatal / force
□ SIGINT + SIGTERM graceful; force timeout; ready=false sớm
□ Không dựa beforeExit cho shutdown; uncaught → exit(1)
□ TLA chỉ entry hoặc main().catch (CJS)
□ Env: --env-file / secrets; validate bắt buộc lúc boot
□ CI: tsc --noEmit; prod không chỉ dựa strip
□ HTTP: phân biệt /ready vs /healthz
□ Worker/child: path import.meta.url; đóng lúc shutdown
□ --watch chỉ dev
□ cluster: hiểu Windows vs POSIX và state không share
```

---

## 15. Cheat sheet

| Việc | API / pattern |
|---|---|
| Chạy JS / TS strip | `node dist/index.js` / `node src/index.ts` |
| Dev transpile | `tsx watch src/index.ts` |
| Env file | `node --env-file=.env …` |
| Watch | `node --watch` / `--watch-path=` |
| Args / flags | `argv.slice(2)` / `parseArgs({ strict, tokens })` |
| Exit an toàn / ngay | `exitCode = n` / `process.exit(n)` |
| Shutdown | `SIGINT`/`SIGTERM` → close + AbortSignal |
| TLA | chỉ ESM entry |
| `__dirname` ESM | `import.meta.dirname` / `fileURLToPath(import.meta.url)` |
| CLI publish | `bin` + shebang + JS emit |
| Health | `/healthz` live · `/ready` ready flag |

```ts
#!/usr/bin/env node
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  options: { help: { type: "boolean", short: "h" } },
  allowPositionals: true,
  strict: true,
});

async function main() {
  if (values.help) {
    console.log("usage: tool <file>");
    return;
  }
  void positionals;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

---

## 16. Version notes

| Dòng / feature | Ghi chú |
|---|---|
| **Node 26 Active LTS** ("Lithium", từ 2026-10-28, v26.13.0+) | Baseline; V8 14.6+, Undici 8+; type stripping mặc định; `--experimental-transform-types` đã gỡ; `import.meta.main`, `node --build-sea`, `--watch-kill-signal` |
| Node 24 Maintenance LTS (từ 2026-10-20) | Type stripping ổn định từ 24.12.0 (lịch LTS ở README) |
| Node 20.6+ / 22+ | `--env-file`, `--env-file-if-exists`, `process.loadEnvFile()`, `util.parseEnv()`, `node --run` (đều ổn định trên 26) |
| Node 18+ | `node --watch`, `node --test`, `closeIdleConnections` (18.2+) |
| `util.parseArgs` | Ổn định; `tokens` / `strict` / `allowNegative` |
| Top-level await | ESM only; chặn `require(esm)` nếu TLA |
| Unhandled rejection | Fail process (policy hiện đại); `uncaughtExceptionMonitor` quan sát không chặn crash |
| Signals | POSIX thật; Windows emulation — SIGTERM hạn chế |
| `cluster` | Vẫn core; replica K8s thường thay |
| **TypeScript 7.0** (Go compiler) | `erasableSyntaxOnly` / `verbatimModuleSyntax` khớp strip; biên dịch cực nhanh (~10×) |
| `import.meta.dirname` / `.main` | `.dirname` từ Node 20.11+; `.main` chuẩn trên Node 26 (fallback `fs.realpathSync`) |
| `--experimental-config-file` | `node.config.json` gom CLI flags (còn experimental) |

`node --watch` không typecheck; `--env-file` không override env đã set (thường). Windows: bắt **SIGINT** cùng SIGTERM.

`parseArgs` `strict` mặc định `true`; `tokens` cho subcommand. `beforeExit` không chạy sau `process.exit`. TLA chỉ entry.

Exit 0/1/2; stdout data, stderr usage. `bin` shebang + JS emit. `--watch` chỉ dev.

---

## 17. Tài liệu liên quan

- [modules-packages.md](modules-packages.md) — ESM/CJS, `exports`, `import.meta`
- [tsconfig.md](tsconfig.md) — emit, NodeNext, erasable
- [async.md](async.md) — TLA, Promise, AbortSignal
- [event-loop.md](event-loop.md) — shutdown vs loop; health/lag
- [threading.md](threading.md) — đóng worker pool khi signal
- [exceptions.md](exceptions.md) — uncaught / unhandledRejection
- [tooling.md](tooling.md) — npm scripts, runners, `node --run`
- [nodejs-apis.md](nodejs-apis.md) — `http`, `util.parseArgs`, `process`

- [Kiểm thử pipeline/CLI](testing.md)
- [Bảo mật input CLI/env](security.md)
