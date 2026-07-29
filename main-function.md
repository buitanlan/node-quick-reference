# Entry point & chạy chương trình

Trong Node.js **không có** hàm `Main` bắt buộc như C# / `func main` như Go. Điểm vào do cách **gọi runtime**, trường `package.json` (`main` / `exports` / `bin`), hoặc shebang CLI quyết định.

Baseline: **Node.js 26** (Current; LTS dự kiến Oct 2026) + **TypeScript 7**. Node **24** vẫn Maintenance LTS. Ưu tiên **ESM + TypeScript**; CJS ghi rõ khi cần.

> Node 26: **type stripping ổn định, mặc định** cho `.ts` — `node file.ts` (không type-check). Chỉ cú pháp **erasable**; `--experimental-transform-types` **đã gỡ**. Prod thường `tsc`/bundler emit JS; CI luôn `tsc --noEmit`.

---

## Mục lục

- [Entry point \& chạy chương trình](#entry-point--chạy-chương-trình)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan entry point](#1-tổng-quan-entry-point)
  - [2. Các chế độ entry: strip / tsc / ESM / CJS / bin](#2-các-chế-độ-entry-strip--tsc--esm--cjs--bin)
    - [2.1 `node file.ts` (type stripping)](#21-node-filets-type-stripping)
    - [2.2 `tsc` emit rồi `node dist/…`](#22-tsc-emit-rồi-node-dist)
    - [2.3 ESM vs CJS](#23-esm-vs-cjs)
    - [2.4 `package.json` `exports` / `bin`](#24-packagejson-exports--bin)
    - [2.5 Shebang \& CLI](#25-shebang--cli)
  - [3. `process.argv` \& `util.parseArgs`](#3-processargv--utilparseargs)
  - [4. Exit codes: `process.exit` vs `exitCode`](#4-exit-codes-processexit-vs-exitcode)
  - [5. Signal \& graceful shutdown](#5-signal--graceful-shutdown)
  - [6. Top-level await vs `async main().catch`](#6-top-level-await-vs-async-maincatch)
  - [7. Environment \& dotenv — thận trọng](#7-environment--dotenv--thận-trọng)
  - [8. Readiness / health (tóm tắt)](#8-readiness--health-tóm-tắt)
  - [9. Pitfalls](#9-pitfalls)
  - [10. Best practices](#10-best-practices)
  - [11. Checklist](#11-checklist)
  - [12. Cheat sheet](#12-cheat-sheet)
  - [13. Version notes](#13-version-notes)
  - [14. Tài liệu liên quan](#14-tài-liệu-liên-quan)

---

## 1. Tổng quan entry point

| Cách vào | Ví dụ | Ghi chú |
|---|---|---|
| CLI trực tiếp | `node dist/index.js` / `node src/index.ts` | Top-level chạy khi module evaluate |
| Package entry | `import 'pkg'` / `require('pkg')` | Resolve `exports` rồi `main` |
| Binary | `npx my-cli` / global `bin` | Shim npm + shebang |

- **Không** có một hàm Main duy nhất — mọi top-level code trong module được load sẽ chạy.
- Giữ entry **mỏng**: parse args → config → `await main()` / `run(signal)` → map exit code.
- So Go: không `init()` bắt buộc; hạn chế side-effect import ở thư viện.

```ts
// src/index.ts
import { parseArgs } from "node:util";
import { main } from "./app.js";

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

---

## 2. Các chế độ entry: strip / tsc / ESM / CJS / bin

### 2.1 `node file.ts` (type stripping)

```bash
node src/index.ts
node --watch src/index.ts
```

| Được (erasable) | Không (cần tsc/tsx/bundler) |
|---|---|
| `type` / `interface` / `as` / `satisfies` | `enum`, `namespace` |
| Generics erasable; type-only import/export | Parameter properties, decorators emit, `const enum` |

- Runtime **xóa annotation**, **không** type-check.
- tsconfig: `erasableSyntaxOnly` + `verbatimModuleSyntax`.
- Dev nhanh OK; **CI `tsc --noEmit`**; prod nhiều team emit JS.

### 2.2 `tsc` emit rồi `node dist/…`

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "dev": "node --watch src/index.ts"
  }
}
```

| Tool | Vai trò |
|---|---|
| **node (strip)** | Không dependency; không type-check |
| **tsx** | Dev nhanh (esbuild), ESM tốt |
| **ts-node** | Compiler TS/SWC; ESM cấu hình phức tạp hơn |
| **tsc emit** | Prod/CI rõ; gần runtime nhất |

- `module` / `moduleResolution`: **NodeNext** khớp `"type": "module"`.
- Import ESM: đuôi `.js` theo convention emit Node.

### 2.3 ESM vs CJS

```json
{ "type": "module" }
```

| | **ESM** | **CJS** |
|---|---|---|
| Kích hoạt | `"type":"module"` / `.mjs` | mặc định / `.cjs` |
| Top-level `await` | Có | Không (async IIFE) |
| `__dirname` | Từ `import.meta.url` | Có sẵn |

```ts
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = join(__dirname, "config.json");
```

> Field **`module`** trong `package.json` là convention bundler — **Node không dùng** để resolve. Dựa vào **`exports`**.

### 2.4 `package.json` `exports` / `bin`

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

### 2.5 Shebang & CLI

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

- Dòng đầu phải shebang, không BOM; `env node` linh hoạt hơn hardcode path.
- Windows: npm tạo `.cmd` wrapper.

---

## 3. `process.argv` & `util.parseArgs`

```text
node app.js --port 3000 input.txt
argv[0]=node  argv[1]=script  argv.slice(2)=args người dùng
```

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

| Option | Ý nghĩa |
|---|---|
| `type: "string" \| "boolean"` | Kiểu flag |
| `short` / `multiple` / `default` | Alias, lặp → mảng, mặc định |
| `allowPositionals` | Arg không phải flag |
| `strict` | Từ chối flag lạ |

- Subcommand phức tạp: parse hai pha hoặc lib (`commander`, `cac`).
- Usage / lỗi → **stderr**; data CLI → **stdout**.

```ts
if (positionals.length < 1) {
  console.error("usage: tool <file>");
  process.exitCode = 2;
}
```

---

## 4. Exit codes: `process.exit` vs `exitCode`

| Code | Convention |
|---|---|
| `0` | Thành công |
| `1` | Lỗi chung |
| `2` | Sai cách dùng / argument |

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
| Khi dùng | Fatal không cứu được | **Mặc định khuyến nghị** |

```ts
process.on("uncaughtException", (err) => {
  console.error("fatal", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandled", reason);
  process.exitCode = 1;
});
```

> Unhandled rejection trên Node hiện đại thường **fail** process. Đừng nuốt rejection ở entry.

---

## 5. Signal & graceful shutdown

Tinh thần tương đương `signal.NotifyContext` (Go):

```ts
import http from "node:http";

const server = http.createServer((_req, res) => res.end("ok"));
await new Promise<void>((r) => server.listen(3000, r));

let ready = true;
const ac = new AbortController();

async function shutdown(signal: string) {
  console.error("shutdown", signal);
  ready = false; // readiness fail trước
  ac.abort(new Error(signal));
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  // đóng DB / worker pool…
  process.exitCode = 0;
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

// truyền ac.signal xuống fetch / queue / run()
```

| Tín hiệu | Ai gửi | Việc làm |
|---|---|---|
| **SIGINT** | Ctrl+C | Graceful stop |
| **SIGTERM** | K8s / systemd / Docker | Graceful (rồi SIGKILL) |
| **SIGKILL** | OS | Không bắt được |
| Windows | Chủ yếu Ctrl+C | `SIGTERM` hạn chế hơn Unix |

> K8s `terminationGracePeriodSeconds`: `close` + drain trước kill. Dùng `once` + guard để tránh shutdown hai lần.

```ts
const FORCE_MS = 10_000;
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
  setTimeout(() => process.exit(1), FORCE_MS).unref();
});
```

---

## 6. Top-level await vs `async main().catch`

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
| Top-level `await` | Ít boilerplate ESM | Export module trì hoãn; TLA lan lib → chậm |
| `main().catch` | Testable; map exit rõ | Thêm vài dòng |

> Giữ TLA **ở entry/boot**. Library: export sync + nhận config từ entry.

---

## 7. Environment & dotenv — thận trọng

```bash
node --env-file=.env dist/index.js   # Node 20.6+; ổn định trên 26
```

```ts
const port = Number(process.env.PORT ?? "3000");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
```

| Cách | Khi dùng |
|---|---|
| `--env-file` | Dev/prod; **không** cần package `dotenv` |
| `dotenv` package | Legacy — cẩn thận load order |
| Secret manager / K8s Secret | Prod — không commit secret |
| Hardcode fallback | Chỉ default an toàn (port), không API key |

- Đừng `dotenv.config()` **sau** khi module khác đã đọc `process.env` lúc import.
- `.env.example` không secret; validate env lúc boot → fail fast.
- `NODE_OPTIONS` ảnh hưởng mọi entry — document trong README.

---

## 8. Readiness / health (tóm tắt)

| Probe | Ý nghĩa | Entry / shutdown |
|---|---|---|
| **Liveness** | Process còn sống? | `/healthz` → 200 nếu loop còn |
| **Readiness** | Nhận traffic? | `ready=false` ngay khi bắt đầu shutdown; fail nếu DB chưa sẵn |
| **Startup** | Boot xong? | K8s startupProbe lúc migrate/warm |

```ts
let ready = false;

async function boot() {
  await connectDb();
  ready = true;
  await listen();
}

// GET /ready → ready ? 200 : 503
```

Chi tiết loop lag: [event-loop.md](event-loop.md). Entry **set `ready`**; signal **clear `ready`** trước `server.close`.

---

## 9. Pitfalls

1. Tin `node file.ts` = đã type-check → thiếu CI `tsc --noEmit`.
2. Rely field `module` trong `package.json` cho Node resolve.
3. `process.exit(0)` giữa chừng → mất log / cắt `close` server.
4. TLA trong thư viện sâu → import chậm; dual package hazard khi publish CJS+ESM.
5. Không bắt SIGTERM trên container → SIGKILL giữa request.
6. `dotenv` sau side-effect import; quên `exitCode` sau catch → exit 0 giả.
7. Worker/child path relative CWD sai dưới systemd — dùng `import.meta.url`.
8. Nhiều handler SIGTERM không guard → `close` hai lần.

---

## 10. Best practices

1. Entry mỏng: `parseArgs` → validate env → `run(signal)` → `exitCode`; `exports`/`bin` trỏ đúng.
2. Ưu tiên `process.exitCode`; `process.exit` chỉ fatal.
3. SIGINT/SIGTERM: readiness=false → `server.close` → AbortSignal → force timeout.
4. TLA chỉ boot; logic trong `main`/`run` export được để test.
5. `--env-file` / secret store; không commit secret; validate boot.
6. Stderr = log/lỗi; stdout = dữ liệu CLI; document exit codes 0/1/2.
7. Strip cho dev; emit + `tsc --noEmit` cho CI/prod; baseline Node 26.

---

## 11. Checklist

```text
□ Entry mỏng; logic trong main/run có thể test
□ ESM/CJS/`type`/`exports`/`bin` khớp cách chạy thật
□ parseArgs — usage → stderr, exit 2 khi misuse
□ Lỗi: exitCode = 1; tránh process.exit trừ fatal
□ SIGINT + SIGTERM graceful; force timeout; ready=false sớm
□ TLA chỉ entry hoặc main().catch (CJS)
□ Env: --env-file / secrets; validate bắt buộc lúc boot
□ CI: tsc --noEmit; prod không chỉ dựa strip
□ HTTP: phân biệt /ready vs /healthz
□ Worker/child: path import.meta.url; đóng lúc shutdown
```

---

## 12. Cheat sheet

| Việc | API / pattern |
|---|---|
| Chạy JS / TS strip | `node dist/index.js` / `node src/index.ts` |
| Env file | `node --env-file=.env …` |
| Args / flags | `argv.slice(2)` / `parseArgs` |
| Exit an toàn / ngay | `exitCode = n` / `process.exit(n)` |
| Shutdown | `SIGINT`/`SIGTERM` → close + AbortSignal |
| TLA | chỉ ESM entry |
| `__dirname` ESM | `fileURLToPath(import.meta.url)` |
| CLI publish | `bin` + shebang + JS emit |

```ts
#!/usr/bin/env node
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  options: { help: { type: "boolean", short: "h" } },
  allowPositionals: true,
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

## 13. Version notes

| Dòng / feature | Ghi chú |
|---|---|
| **Node 26** (baseline) | Type stripping mặc định; transform-types đã gỡ |
| Node 24 LTS | Strip ổn định — [node26-ts7.md](node26-ts7.md) |
| Node 20.6+ | `--env-file` |
| `util.parseArgs` | Ổn định cho CLI đơn giản |
| Top-level await | ESM only |
| Unhandled rejection | Fail process (policy hiện đại) |
| **TypeScript 7** | `erasableSyntaxOnly` / `verbatimModuleSyntax` khớp strip |

---

## 14. Tài liệu liên quan

- [node26-ts7.md](node26-ts7.md) — baseline Node 26 & TS 7
- [modules-packages.md](modules-packages.md) — ESM/CJS, `exports`
- [tsconfig.md](tsconfig.md) — emit, NodeNext, erasable
- [async.md](async.md) — TLA, Promise, AbortSignal
- [event-loop.md](event-loop.md) — shutdown vs loop; health/lag
- [threading.md](threading.md) — đóng worker pool khi signal
- [exceptions.md](exceptions.md) — uncaught / unhandledRejection
- [tooling.md](tooling.md) — npm scripts, runners
