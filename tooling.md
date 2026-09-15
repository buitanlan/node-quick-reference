# npm / pnpm / yarn & tooling

Package managers, scripts, lockfiles, semver, ESLint/Prettier, và runners TypeScript trên baseline **Node.js 26** + **TypeScript 7**.

> **Callout:** Chọn **một** package manager cho cả repo và commit **lockfile**. pnpm mặc định **isolated** `node_modules` (không hoist lung tung). Node **24** vẫn Maintenance LTS nếu chưa nâng. Xem [tsconfig.md](tsconfig.md).

---

## Mục lục

1. [`package.json` cốt lõi](#1-packagejson-cốt-lõi)
2. [Scripts & `node --run`](#2-scripts--node---run)
3. [`engines` & phiên bản Node](#3-engines--phiên-bản-node)
4. [Dependencies & semver](#4-dependencies--semver)
5. [Lockfiles & isolated installs](#5-lockfiles--isolated-installs)
6. [`npx` vs `pnpm dlx`](#6-npx-vs-pnpm-dlx)
7. [Workspaces (monorepo)](#7-workspaces-monorepo)
8. [So sánh npm vs pnpm vs yarn](#8-so-sánh-npm-vs-pnpm-vs-yarn)
9. [Corepack](#9-corepack)
10. [TypeScript runners: strip / tsx / ts-node / tsc](#10-typescript-runners-strip--tsx--ts-node--tsc)
11. [Watch: nodemon / `--watch` / tsx](#11-watch-nodemon----watch--tsx)
12. [ESLint flat config & Prettier](#12-eslint-flat-config--prettier)
13. [`npm audit` vs `overrides`](#13-npm-audit-vs-overrides)
14. [CI matrix Node 24/26](#14-ci-matrix-node-2426)
15. [Best practices](#15-best-practices)
16. [Checklist](#16-checklist)
17. [Cheat sheet](#17-cheat-sheet)
18. [Version notes](#18-version-notes)
19. [Tài liệu liên quan](#19-tài-liệu-liên-quan)

---

## 1. `package.json` cốt lõi

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=26"
  },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "node --test",
    "lint": "eslint ."
  },
  "dependencies": {
    "fastify": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^26.0.0",
    "typescript": "^7.0.0",
    "tsx": "^4.0.0",
    "eslint": "^9.0.0"
  }
}
```

Trường quan trọng khác: `exports`, `imports`, `bin`, `files` (publish). Chi tiết module: [modules-packages.md](modules-packages.md).

```bash
corepack enable
```

`private: true` trên app — npm không publish nhầm. Library omit `private` + `files`/`exports` đúng.

---

## 2. Scripts & `node --run`

```bash
npm run build
pnpm build
yarn build
node --run build
```

Lifecycle hooks: `prepublishOnly`, `prepare` (hay `husky`), `preinstall`/`postinstall` (cẩn thận — supply chain).

```bash
npm run test -- --grep "auth"
pnpm test -- --grep auth
```

Biến môi trường cross-platform: `cross-env` hoặc script nhỏ bằng Node. Song song lint+test: `concurrently` / `npm-run-all` hoặc script shell đơn giản.

### 2.1 `node --run`

Node 22+: chạy script `package.json` **không** qua npm:

```bash
node --run test
node --run start -- --port 8080
```

| | `node --run` | `pnpm run` / `npm run` |
|---|---|---|
| `pre`/`post` scripts | **Không** chạy | Có (npm/pnpm) |
| `node_modules/.bin` PATH | Có (docs Node) | Có |
| Shell POSIX phức tạp | Hạn chế trên Windows | pnpm `shellEmulator` / npm sh |
| Tốc độ | Nhanh, ít lớp | Thêm package manager |
| Env | `NODE_RUN_SCRIPT_NAME`, `NODE_RUN_PACKAGE_JSON_PATH` | `npm_lifecycle_event`, … |

> **Callout:** `node --run` **cố ý** không chạy `pretest`/`posttest`. Script phụ thuộc `prebuild` → dùng `pnpm build`, không `--run`. Args sau `--` tới script, **không** phải flag Node (`--watch` sau `--` ≠ `node --watch`).

CI đơn giản (`typecheck`, `test` không hook): `--run` ổn. Monorepo filter: vẫn `pnpm --filter`.

### 2.2 `node --test` (built-in)

```json
{
  "scripts": {
    "test": "node --test",
    "test:watch": "node --test --watch"
  }
}
```

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("sum", () => {
  it("adds", () => {
    assert.equal(1 + 2, 3);
  });
});
```

Đủ cho nhiều service nhỏ; Vitest/Jest khi cần mock ecosystem / browser-like. Coverage: `node --test --experimental-test-coverage` (theo dõi flag ổn định trên minor bạn chạy) hoặc c8/istanbul.

---

## 3. `engines` & phiên bản Node

```json
{
  "engines": {
    "node": ">=26 <27",
    "pnpm": ">=9"
  }
}
```

- Chỉ là **metadata** trừ khi bật `engine-strict` (npm) / setting tương đương (`pnpm` `engineStrict`).
- CI nên dùng đúng major baseline (**26**); job phụ trên **24** Maintenance LTS nếu còn hỗ trợ khách cũ.
- Range `>=24` trên lib: consumer 24+; app nội bộ: ghim `>=26 <27` hoặc `26.x`.
- **Không** thay `os`/`cpu` cho native addon — dùng `optionalDependencies` + fail mềm.

`.nvmrc` / `.node-version`:

```
26
```

Volta / fnm / asdf đọc file này. Docker: `FROM node:26-bookworm` khớp `engines`. Lệch CI 24 vs `engines: >=26` → fail muộn trên máy user.

`engine-strict=true` trong `.npmrc` (dev) bắt install sai version. Prod image đã ghim tag — vẫn giữ `engines` cho `npm` local.

---

## 4. Dependencies & semver

| Range | Ý nghĩa (tóm tắt) |
|---|---|
| `1.2.3` | đúng phiên bản |
| `^1.2.3` | ≥1.2.3 & &lt;2.0.0 |
| `~1.2.3` | ≥1.2.3 & &lt;1.3.0 |
| `>=26` | từ 26 (engines) |
| `workspace:*` | bản workspace (pnpm/yarn) |
| `*` / `latest` | tránh trên lib nghiêm |
| `1.2.x` / `1.2` | patch / minor tùy parser |

- `dependencies`: runtime (có trong image prod).
- `devDependencies`: build/test/lint — `pnpm install --prod` bỏ.
- `peerDependencies`: plugin / extension — consumer cài bản tương thích. pnpm **strict** peer hơn npm (cảnh báo/fail).
- `optionalDependencies`: fail install vẫn tiếp tục (native optional).
- `bundledDependencies`: hiếm — đóng gói kèm publish.

```bash
npm outdated
pnpm outdated
npm update
pnpm up -L
npm audit
pnpm audit
```

### 4.1 Semver thực dụng cho app vs lib

| | App | Library publish |
|---|---|---|
| Lockfile | **Commit** | Commit; consumer dùng range |
| `^` trên deps | OK nếu CI bắt regression | Cẩn thận peer + breaking |
| Exact pin | Security hotfix / reproducible image | Ít dùng trừ binary |

`^0.x` **không** giống `^1.x` (0.y breaking theo semver). Đọc range thật.

### 4.2 Peer, optional, bundled

`peerDependencies` + `peerDependenciesMeta`: `{ "optional": true }` — plugin không bắt buộc. pnpm mặc định **nghiêm** peer: thiếu peer → warning/error (`auto-install-peers` tùy config). npm 7+ tự cài peer — tree khác pnpm. **Đây** là lý do “npm xanh, pnpm đỏ”.

`optionalDependencies`: native (`sharp`, `fsevents`) fail trên OS lạ **không** fail cả install. Code phải `try/catch require`.

`bundledDependencies`: pack kèm tarball — hiếm; tăng size; cẩn thận license.

`overrides` **thắng** range — §13. `pnpm.packageExtensions` thêm peer/dep thiếu cho package lỗi manifest — không đổi version.

### 4.3 Catalog / workspace protocol

pnpm `workspace:` protocol: `"@acme/core": "workspace:^"` — không publish range nhầm `workspace:*` ra npm (pnpm rewrite lúc publish). Yarn tương tự.

pnpm catalog (v9+/v10 tùy bản): ghim version chung workspace — đọc docs bản pnpm **đúng** `packageManager`; đừng copy syntax chưa có.

Lockfile **đóng băng** tree dù `package.json` có `^`. `pnpm update` / `npm update` mới nhích trong range. CI frozen **không** tự nhảy minor.

Audit không thay review; fix có thể phá semver — đọc changelog. `overrides` / `pnpm.overrides` chỉ khi buộc phải vá transitive — §13.

---

## 5. Lockfiles & isolated installs

| Tool | Lockfile | Install CI |
|---|---|---|
| npm | `package-lock.json` | `npm ci` |
| pnpm | `pnpm-lock.yaml` | `pnpm install --frozen-lockfile` |
| yarn | `yarn.lock` | `yarn install --immutable` |

- **Commit** lockfile cho app và hầu hết lib.
- Không trộn hai lockfile trong một package.
- Không commit `node_modules`.

### 5.1 Isolated vs hoisted

**npm** (cổ điển): hoist lên root `node_modules` — package A “lỡ” `require("B")` dù không khai B (phantom dependency). Build **xanh** local, **đỏ** trên pnpm isolated.

**pnpm mặc định (`nodeLinker: isolated`)**: dependency nằm store content-addressable, symlink vào `node_modules/.pnpm`. Package **chỉ** thấy dependency **khai** trong manifest (và peer). Nghiêm hơn, disk nhỏ hơn, determinism tốt.

| Layout | Khi |
|---|---|
| isolated (pnpm default) | **Khuyến nghị** — bắt thiếu declare |
| `shamefully-hoist=true` | Tooling (React Native, một số bundler) cần flat root |
| `nodeLinker: hoisted` | Giống npm; serverless **không** symlink |
| Yarn PnP | Không `node_modules` — toolchain phải hiểu PnP |

`shamefully-hoist` / `public-hoist-pattern` **thủng** isolation — dùng có chủ đích, ghi README.

Serverless (Lambda) đôi khi **không** symlink → bundle hoặc `nodeLinker=hoisted` lúc deploy, không nhất thiết đổi dev.

> **Callout:** Lỗi `Cannot find module` sau chuyển pnpm → thường phantom dep. Thêm vào `dependencies`/`devDependencies`, **đừng** hoist ngay.

Yarn Berry: PnP hoặc `nodeLinker: node-modules`. Chọn một; document.

---

## 6. `npx` vs `pnpm dlx`

Chạy package **không** (hoặc chưa) cài local — codegen, one-shot CLI.

| | `npx pkg` | `pnpm dlx pkg` | `pnpm exec pkg` |
|---|---|---|---|
| Nguồn | npm registry cache `npx` | registry, cache dlx pnpm | **local** `node_modules/.bin` |
| Pin version | `npx pkg@1.2.3` | `pnpm dlx pkg@1.2.3` | version lockfile |
| Isolation | Tạm | Tạm | Project |
| Dùng | Prototype | Cùng, trong repo pnpm | Script hằng ngày |

```bash
npx --yes create-something@latest
pnpm dlx create-something@latest
pnpm exec eslint .
```

> **Callout:** `npx` **không** tôn trọng `packageManager` pnpm. Repo pnpm: `pnpm dlx` / `pnpm exec` để cùng store + không lẫn npm hoist. **Ghim version** (`@1.2.3`) trên CI — `@latest` không tái lập.

`pnpm exec` = binary đã install (devDep). `dlx` = tải nếu thiếu. Script `package.json` nên `eslint` (PATH `.bin`), không `npx eslint` (chậm, version lệch).

Yarn: `yarn dlx` tương tự. Đừng xen `npx` trong script pnpm trừ khi cố ý.

`npx -p typescript tsc` kéo `tsc` **ngoài** lockfile — CI lệch `typescript@^7`. Luôn `pnpm exec tsc` / `node --run typecheck`.

### 6.1 Bảng lệnh thường ngày

| Việc | npm | pnpm | yarn |
|---|---|---|---|
| Cài | `npm ci` / `npm i` | `pnpm i --frozen-lockfile` | `yarn install --immutable` |
| Thêm dep | `npm i pkg` | `pnpm add pkg` | `yarn add pkg` |
| Dev dep | `npm i -D pkg` | `pnpm add -D pkg` | `yarn add -D pkg` |
| Script | `npm run x` | `pnpm x` | `yarn x` |
| Binary local | `npx eslint` (lệch) | `pnpm exec eslint` | `yarn eslint` |
| One-shot | `npx pkg@1` | `pnpm dlx pkg@1` | `yarn dlx pkg@1` |
| Filter | `-w pkg` | `--filter pkg` | `yarn workspace pkg` |
| Why | `npm ls pkg` | `pnpm why pkg` | `yarn why pkg` |

`pnpm why` / `npm ls` khi audit: ai kéo transitive CVE. Override đúng **package** không đoán.

### 6.2 `dlx` cache & bảo mật

`pnpm dlx` cache trong store — stale binary. Ghim `@1.2.3` + checksum lock **không** áp dlx (không lockfile). CI codegen: **devDependency** + `pnpm exec`, không dlx.

`npx --yes` bỏ prompt — nguy hiểm script copy-paste. Review package name typosquat.

### 5.2 `package-lock.json` v2/v3 vs pnpm

Không commit cả `package-lock.json` **và** `pnpm-lock.yaml`. Xóa lock tool không dùng. `package.json` + một lock.

`pnpm import` từ npm lock khi migrate — review tree. `shamefully-hoist` tạm để xanh, rồi khai phantom, rồi tắt hoist.

`public-hoist-pattern[]=*eslint*` — chỉ tool phẳng. Pattern càng rộng càng gần npm.

`neverBuiltDependencies` / `onlyBuiltDependencies` (pnpm): chặn `postinstall` compile native bất ngờ — supply chain. Allowlist `esbuild`, `sharp` khi cần.

`ignoredBuiltDependencies` (tên tùy bản): tương tự. Review `pnpm install` log “Running lifecycle scripts”. `ignore-scripts=true` CI + chạy script cần **tường minh** (esbuild binary).

`pnpm config list` / `npm config list` debug registry. `shamefully-hoist` chỉ khi tool gãy isolated — ghi README ngày gỡ.

`pnpm install --prod` image runtime. `pnpm fetch` + offline CI (store). `shamefully-hoist` + serverless no-symlink: `nodeLinker=hoisted` lúc deploy, không đổi laptop nếu không cần.

---

## 7. Workspaces (monorepo)

```json
{
  "name": "root",
  "private": true,
  "workspaces": ["packages/*", "apps/*"]
}
```

pnpm (`pnpm-workspace.yaml`):

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

```bash
pnpm --filter @acme/api build
npm run build -w packages/api
```

Phụ thuộc nội bộ `workspace:*`; ranh giới package rõ (`exports`) — không import xuyên `src` lung tung. Chi tiết module: [modules-packages.md](modules-packages.md).

Root `private: true`. Package con publish: version + `exports` riêng.

`pnpm -r run test` recursive. `--filter ...` theo tên. CI: build dependency order (`pnpm -r --sort` / turbo / `tsc -b`).

### 7.1 Ranh giới package

- Import `@acme/core` qua `exports`, không `../../packages/core/src`.
- `transpileOnly` xuyên workspace = dual identity (ts vs dist) — hazard giống dual package.
- `pnpm deploy --filter=@acme/api` (pnpm) tạo tree prod **không** symlink cho Docker — đọc docs phiên bản.
- Root không `dependencies` runtime trừ tool dùng mọi package; app khai dep riêng.

`injectWorkspacesPackages` / hoist workspace: cẩn thận phantom. Isolated: mỗi package `node_modules` mỏng.

---

## 8. So sánh npm vs pnpm vs yarn

| | **npm** | **pnpm** | **yarn** |
|---|---|---|---|
| Đi kèm Node | Có | Corepack / cài riêng | Corepack / cài riêng |
| `node_modules` | Hoist cổ điển | Content-addressable + symlinks — **strict** hơn | Berry: PnP hoặc `node_modules` |
| Disk / tốc độ | Ổn | Thường tiết kiệm disk | Nhanh; PnP khác biệt lớn |
| Monorepo | Workspaces | Rất mạnh (`filter`) | Mạnh (Berry) |
| Isolated by default | Không | **Có** | PnP ≈ isolated khác kiểu |
| Khi chọn | Mặc định, đơn giản | Strict + monorepo | Repo đã chuẩn yarn |

Thực tế: **pnpm** phổ biến monorepo; **npm** đủ app đơn; **yarn** fine nếu đã chuẩn hóa. **Không** mix trong một tree.

---

## 9. Corepack

Corepack (đi kèm Node, **experimental** trên nhiều dòng — vẫn dùng rộng) đọc `"packageManager": "pnpm@9.15.0"` và chạy **đúng** bản pnpm/yarn.

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

- Ghim version tool → CI = laptop.
- npm **không** bị Corepack chặn mặc định (shim npm tắt) — vẫn có thể `npm i` nhầm trong repo pnpm. Team: document “chỉ pnpm”; CI chỉ `pnpm`.
- `corepack enable` cần quyền ghi cạnh binary `node` (Windows/Unix). Image CI: `corepack enable` trước install.
- Node 26: theo dõi docs Corepack (policy experimental / enable). Không giả định luôn bật sẵn.

```json
{ "packageManager": "pnpm@9.15.0+sha256-…" }
```

Hash tùy chọn (pin integrity). Đổi version: sửa field + lockfile, PR một lần.

> **Callout:** Corepack **không** thay `engines.node`. Sai Node vẫn chạy sai binary native. Kết hợp `.nvmrc` + `packageManager`.

### 9.1 Corepack trên CI & Windows

```yaml
- run: corepack enable
- run: corepack prepare pnpm@9.15.0 --activate
- run: pnpm --version   # phải khớp packageManager
```

Windows: `corepack enable` cần quyền (Developer Mode / admin) nếu không ghi được shim cạnh `node.exe`. Chocolatey/fnm path khác nhau — CI GitHub `setup-node` + corepack ổn hơn máy lệch PATH.

Tắt: `COREPACK_ENABLE_NETWORK=0` (policy air-gap) — phải `prepare` trước. Signature: theo dõi docs Corepack khi verify bản pnpm.

Không commit `pnpm.exe` vào repo. Không `npm i -g pnpm` **sau** corepack (đè shim).

Nếu Node bản CI **chưa** ship Corepack như kỳ vọng: action `pnpm/action-setup` ghim version — vẫn ghi `packageManager` cho laptop.

### 9.2 `.npmrc` / `pnpm-workspace.yaml`

npm: `.npmrc` `engine-strict=true`, `fund=false`, `audit=false` (CI tự `pnpm audit` có chủ đích). `save-exact=true` nếu app muốn pin.

pnpm 10+: nhiều setting **chuyển** `pnpm-workspace.yaml` (`nodeLinker`, `shamefullyHoist`) — `.npmrc` chỉ còn auth/registry. Đọc docs **đúng major pnpm** trong `packageManager`.

```ini
; .npmrc — registry
@acme:registry=https://npm.example.com
//npm.example.com/:_authToken=${NPM_TOKEN}
```

Không commit token. `NPM_TOKEN` CI. `publishConfig.registry` trên lib.

### 9.3 `pnpm audit` ignore & GHSA

pnpm audit filter theo advisory id (GHSA), không phải mọi CVE string. `auditConfig.ignoreCves` / ignore trong workspace yaml — **ghi lý do hết hạn**. CI fail `audit --audit-level=high` khi policy yêu cầu — vẫn review false positive.

`npm audit --json` cho tool; đừng parse HTML.

`minimumReleaseAge` (pnpm): trì hoãn version mới N phút — giảm malware “latest”. Kết hợp Renovate `stabilityDays`.

### 13.2 `pnpm.overrides` vs npm `overrides` nesting

npm `overrides` hỗ trợ lồng `"foo": { ".": "1.0.0", "bar": "2" }`. pnpm `overrides` string/selector (`foo@1>bar`) — **cú pháp khác**. Copy JSON npm vào `pnpm.overrides` có thể **không** parse. Đọc docs tool đang dùng.

Yarn `resolutions` khác nữa. Một lockfile, một syntax.

### 10.1 `ts-node` ESM checklist (nếu buộc)

`ts-node --esm` / `TS_NODE_TRANSPILE_ONLY=1` — bỏ typecheck (trùng tsx). `module: NodeNext` + `ts-node` `esm: true` trong `"ts-node"` key `tsconfig` — dễ lệch version. **Khuyến nghị:** đừng thêm; migrate tsx/strip.

`swc` compiler ts-node: nhanh, **không** typecheck, decorator SWC ≠ tsc 1-1.

### 11.1 nodemon config

`nodemon.json` `watch`/`ext`/`exec`. Trùng `node --watch` thì bỏ nodemon. `legacyWatch` (polling) trên Docker Desktop volume Windows — CPU. Prefer `tsx watch` trong container nếu polling bắt buộc.

---

## 10. TypeScript runners: strip / tsx / ts-node / tsc

| Cách | Lệnh ý tưởng | Ghi chú |
|---|---|---|
| Node type stripping | `node src/app.ts` | Chỉ **erasable** TS; Node 26 **không** còn `--experimental-transform-types` |
| `tsx` | `tsx src/app.ts` / `tsx watch` | Dev UX; transpile nhanh — cần khi enum/decorators/param props |
| `ts-node` | `ts-node src/app.ts` | Compiler TS/SWC; ESM + `NodeNext` dễ lệch |
| `tsc` emit | `tsc && node dist/app.js` | Production rõ; TS 7 (Go) full build ~8–12× nhanh hơn |

```bash
pnpm exec tsx watch src/index.ts
node --watch src/index.ts   # erasable only
pnpm build && node dist/index.js
```

Khuyến nghị tsconfig strip-oriented: `erasableSyntaxOnly` + `verbatimModuleSyntax` + `module`/`moduleResolution`: **`NodeNext`**. Chi tiết: [tsconfig.md](tsconfig.md). Decorator: [decorators.md](decorators.md) — strip **cấm**.

**TypeScript 7 tooling:**

- CLI: `--checkers`, `--builders`, `--singleThreaded`; `--watch` cải thiện.
- Programmatic API ổn định ~**7.1**; eslint/plugin cần API cũ → bridge **`@typescript/typescript6`**.
- Packages: `typescript@^7`, `@types/node@^26`; có thể `@tsconfig/node26`.

`ts-node` + `"type": "module"`: thường `ts-node --esm` / loader — friction cao. Team mới: **strip hoặc tsx**, không thêm ts-node trừ legacy.

Prod: **`node dist/*.js`**. Đừng `tsx` trên image user.

---

## 11. Watch: nodemon / `--watch` / tsx

```bash
node --watch dist/index.js
tsx watch src/index.ts
```

```json
{
  "scripts": {
    "dev": "nodemon --watch dist dist/index.js"
  }
}
```

Nhiều team thay nodemon bằng **`tsx watch`** hoặc `node --watch`. `nodemon` vẫn hữu ích khi watch nhiều loại file / lệnh phức tạp.

`--watch-path`, `--watch-preserve-output`: [main-function.md](main-function.md) §8. Không dùng watch trên prod.

---

## 12. ESLint flat config & Prettier

**ESLint 9** flat config (bỏ `.eslintrc` JSON cũ):

```js
// eslint.config.js — ESM khi "type": "module"
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { ignores: ["dist/**"] },
);
```

CJS repo: `eslint.config.cjs` / `module.exports`. `ignores` trong flat thay `.eslintignore` (vẫn hỗ trợ file ignore — ưu tiên config).

`typescript-eslint` typed lint (`parserOptions.project`) **đắt** — bật có chủ đích (`projectService` trên bản mới). TS 7 early: plugin chưa ăn API → bridge `@typescript/typescript6`.

**Prettier** — format; **không** lint logic. `eslint-config-prettier` **tắt** rule ESLint đụng format (indent, quotes) — chạy Prettier riêng (script / hook).

```bash
pnpm exec prettier -w .
pnpm exec eslint . --fix
```

```json
{
  "scripts": {
    "lint": "eslint .",
    "format": "prettier -w ."
  }
}
```

Không cần `eslint-plugin-prettier` trừ khi muốn format-as-lint (ồn CI). Hai lệnh tách: format vs lint.

`printWidth` / `singleQuote`: thống nhất repo. Prettier **không** đọc `tsconfig` paths.

### 12.1 `eslint.config.js` sâu hơn

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      eqeqeq: "error",
      "no-console": "off",
    },
  },
  prettier,
);
```

`ignores` **đầu** config — file ignored không parse. `projectService` (typescript-eslint mới) thay `project: true` + `tsconfigRootDir`.

CJS: `eslint.config.cjs` + `require`. `"type":"module"` → `eslint.config.js` ESM.

Rule `import/no-unresolved` phải hiểu `exports` / `#imports` — plugin `eslint-plugin-import` cổ **kém** NodeNext; `typescript-eslint` type-aware bắt specifier tốt hơn nếu `project` bật.

### 12.2 Prettier ignore & conflict

`.prettierignore`: `dist`, `pnpm-lock.yaml`, `coverage`. Format lockfile **không** có ích.

`semi`, `trailingComma`: một lần trong `.prettierrc` / `"prettier"` key `package.json`. Editor + CI `prettier --check .` (không `-w` trên CI trừ bot).

`eslint --fix` + Prettier: thứ tự **Prettier sau** hoặc `eslint-config-prettier` để ESLint không revert format.

### 12.3 `node --run` vs lint script

```json
{
  "scripts": {
    "lint": "eslint .",
    "prelint": "echo never with node --run"
  }
}
```

`node --run lint` **bỏ** `prelint`. Hook format (`prelint: prettier`) → `pnpm lint`. CI: `pnpm lint && pnpm exec prettier --check .` tường minh hai bước — không dựa `pre*`.

> **Callout:** Flat config là **default ESLint 9**. Đừng thêm `.eslintrc` “cho chắc” — hai lớp conflict.

Editor: ESLint extension + Prettier format-on-save. `eslint.useFlatConfig` (nếu IDE hỏi).

---

## 13. `npm audit` vs `overrides`

```bash
npm audit
pnpm audit
npm audit fix          # cẩn thận major
pnpm audit --fix
```

Audit = advisory (GitHub/npm) trên tree **lockfile**. Nhiều warning transitive không có fix semver-safe. **Đừng** auto `audit fix --force` trên app prod không đọc changelog.

### 13.1 `overrides` (npm) / `pnpm.overrides`

Ép **mọi** (hoặc scoped) transitive về một version — vá CVE khi maintainer chưa bump.

```json
{
  "overrides": {
    "foo": "1.2.4",
    "bar": { ".": "2.0.1", "baz": "3.0.0" }
  }
}
```

pnpm:

```json
{
  "pnpm": {
    "overrides": {
      "foo": "1.2.4"
    }
  }
}
```

(Yarn: `resolutions`.)

| | Audit | Override |
|---|---|---|
| Việc | Báo cáo | **Sửa tree** |
| Rủi ro | Nhiễu / false positive | Phá invariant package (peer, API) |
| Khi | Định kỳ CI (report) | CVE + chưa có release cha |

Ghi **lý do** (CVE, issue) trong PR. Gỡ override khi parent bump. Test sau override — semver nằm không nghĩa là API giống nếu ép major.

`pnpm.packageExtensions` vá `peer` thiếu — khác override version.

> **Callout:** Override **không** thay fork/patch lâu dài. `pnpm patch` / `patchedDependencies` khi cần diff; document.

Dependabot/Renovate: lockfile + PR; vẫn review. `minimumReleaseAge` (pnpm) trì hoãn version mới — supply chain.

---

## 14. CI matrix Node 24/26

```yaml
# .github/workflows/ci.yml — skeleton
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node: [26, 24]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: pnpm
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm lint
```

- Job **26** = baseline (Temporal, strip, Undici 8).
- Job **24** chỉ khi `engines` còn hỗ trợ 24 — bắt API không có trên 24 (Temporal default, …).
- `fail-fast: false` — thấy cả hai major.
- Cache pnpm store; `frozen-lockfile` **bắt buộc**.
- Luôn `tsc --noEmit` dù dev dùng tsx/strip.

`setup-node` `cache: pnpm` cần pnpm trên PATH (corepack enable trước **hoặc** action pnpm). Thứ tự: checkout → corepack/pnpm → setup-node cache → install.

Windows/macOS matrix: native addon; JS thuần Ubuntu đủ.

### 14.1 Supply chain tối thiểu

- Prefer `pnpm audit` / `npm audit` có chủ đích; đừng auto-force mọi major.
- Pin Action SHAs nếu policy bảo mật yêu cầu.
- Tránh `postinstall` tải binary tùy ý — review dependency mới.
- `packageManager` field + Corepack giảm “máy dev một kiểu, CI kiểu khác”.

### 14.2 Publish & Docker (tóm tắt)

```json
{
  "name": "@acme/lib",
  "version": "1.2.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "prepublishOnly": "pnpm typecheck && pnpm build"
  }
}
```

- `files` / `.npmignore` — đừng publish `src` trừ khi cố ý.
- `exports` chặt — xem [modules-packages.md](modules-packages.md).
- `npm pack --dry-run` trước khi publish.

```dockerfile
# ý tưởng multi-stage
# FROM node:26-bookworm AS build
#   pnpm install --frozen-lockfile && pnpm build
# FROM node:26-bookworm-slim
#   COPY --from=build /app/dist ./dist
#   COPY --from=build /app/node_modules ./node_modules
#   CMD ["node", "dist/index.js"]
```

Prod: chỉ `dependencies` runtime (hoặc bundle). Ghim `node:26-…`, không `latest`. `NODE_ENV=production` ảnh hưởng một số lib (không thay `engines`). Isolated symlink: copy `node_modules` cần `--filter` deploy / `pnpm deploy` (pnpm) thay `cp -r` mù.

### 14.3 Matrix khi nào **không** cần 24

App nội bộ `engines: >=26 <27` — matrix chỉ `[26]`. Job 24 **đỏ** vì Temporal / API 26 là tín hiệu đúng, không phải “sửa cho 24 chạy”.

Lib `>=24`: test 24 **và** 26. Feature 26-only: runtime check `process.versions` hoặc export điều kiện — document.

`fail-fast: false` + `continue-on-error` khác nhau: `continue-on-error` **xanh** job — đừng dùng để giấu 24 fail nếu còn support.

### 14.4 Cache pnpm store

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node }}
    cache: pnpm
    cache-dependency-path: pnpm-lock.yaml
```

Monorepo lockfile root. `cache: npm` sai nếu pnpm. Restore miss: vẫn `--frozen-lockfile` (không `pnpm i` nhảy lock).

`TURBO_TOKEN` / remote cache: ngoài phạm vi — `tsc -b` incremental file local runner.

### 14.5 `engines` trên CI

```yaml
- run: node -e "const e=require('./package.json').engines.node; if(!e) process.exit(1)"
```

Hoặc `engine-strict` lúc install. Matrix 24 khi `engines` `>=24` — comment trong YAML **tại sao** còn 24 (khách LTS). Gỡ job 24 khi drop support, bump `engines` **cùng PR**.

### 3.1 `engineStrict` pnpm/npm

```ini
engine-strict=true
```

npm `.npmrc`; pnpm `engineStrict: true` trong workspace yaml (v10+) hoặc `.npmrc`. Dev Node 22 trên repo `engines: >=26` → **fail install** — đúng. CI setup-node **trước** install.

`packageManager` field sai version pnpm: Corepack abort. Không `corepack disable` để “cho xong”.

`engines.pnpm` + Corepack: thừa nhưng documentation. `packageManager` là nguồn version tool; `engines.pnpm` bắt `>=` lỏng. Khớp số major.

---

## 15. Best practices

1. Một package manager + lockfile; CI frozen install; isolated pnpm trừ khi tool bắt hoist.
2. Ghim `engines.node` theo major (**26**; ghi rõ nếu còn 24) + matrix CI khớp.
3. Tách `dependencies` / `devDependencies` đúng (Docker prod slim).
4. `prepare`/`postinstall` tối giản — bảo mật & CI.
5. Dev: `node file.ts` (erasable) hoặc `tsx`; prod: `tsc`/bundler — không ts-node trên image.
6. Workspaces: phụ thuộc qua tên package, không relative xuyên repo.
7. `typecheck` script riêng — không bỏ vì “tsx đã chạy”.
8. Corepack `packageManager` đồng bộ pnpm/yarn.
9. `npx`/`dlx` ghim version; script hằng ngày = `exec` local.
10. ESLint 9 flat + Prettier tách; ignore `dist`.
11. Audit report ≠ auto force; override có lý do CVE và test.
12. `node --run` khi không cần pre/post; còn lại pnpm/npm run.

---

## 16. Checklist

```text
□ Một lockfile; CI frozen
□ Isolated install (pnpm) — phantom dep đã khai
□ engines.node khớp baseline / dual-support đã ghi
□ Matrix CI 26 (+ 24 nếu engines cho phép)
□ type: module (nếu ESM) + NodeNext trong tsconfig
□ typescript@^7 + @types/node@^26
□ typecheck trên CI
□ Dev runner khớp erasable vs cần transpile
□ Không commit node_modules
□ packageManager / Corepack
□ npx/dlx không @latest trên CI
□ ESLint flat + Prettier; ignore dist
□ Audit có chủ đích; override có lý do
□ node --run không thay pre/post nếu đang dựa hook
```

---

## 17. Cheat sheet

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build && node dist/index.js
tsx watch src/index.ts
node src/index.ts          # erasable only (Node 26)
node --run test
pnpm dlx some-cli@1.2.3
pnpm exec eslint .
pnpm audit
```

| Việc | Tool |
|---|---|
| Prod emit | `tsc` / bundler |
| Dev TS đầy đủ syntax | `tsx` |
| Dev erasable | `node` / `node --watch` |
| Lint | ESLint 9 flat |
| Format | Prettier |
| Monorepo | pnpm filter / npm workspaces |
| One-shot CLI | `pnpm dlx pkg@version` |
| Script không hook | `node --run name` |

`node --run` không `pre`/`post`. Isolated pnpm bắt phantom dep. Matrix 24/26 khớp `engines`. Audit ≠ override; override có CVE + test.

`npx` vs `pnpm dlx`: ghim version, repo pnpm dùng dlx/exec. ESLint 9 flat + Prettier tách. Corepack `packageManager`. `node --test` đủ service nhỏ.

`.nvmrc` = `26`. Docker `FROM node:26-bookworm`, không `latest`. `packageManager` hash tùy chọn pin integrity.

`pnpm deploy` Docker isolated. `overrides` gỡ khi parent bump. `eslint-config-prettier` cuối config. `tsx` dev, `tsc` prod, strip chỉ erasable.

`corepack enable` trước `pnpm i` trên CI. `npx @latest` cấm CI. `peerDependencies` pnpm nghiêm hơn npm 7 auto-install.

`workspace:` protocol rewrite lúc publish. `optionalDependencies` fail mềm native. `bundledDependencies` hiếm.

`pnpm exec tsc -v` khớp workspace. `prettier --check` CI, `-w` local. `node --run` vs `pnpm run` chọn theo hook.

Husky `prepare` tối giản. `prepublishOnly` typecheck+build. Không `postinstall` tải binary lạ. `npm pack --dry-run` trước publish.

`files` whitelist khớp `bin`/`exports`. `private: true` app.

---

## 18. Version notes

| Nền | Liên quan tooling |
|---|---|
| npm 7+ | workspaces; `overrides` |
| npm 8.3+ | `overrides` ổn định hơn |
| Node 18+ | `node --watch`, `node --test` |
| Node 22+ | `node --run` |
| Node 22–24 | type stripping experimental → ổn định |
| **Node 26** | strip mặc định/ổn định; gỡ transform-types; V8 14.6 |
| **TS 7** | compiler Go; flags `--checkers`/`--builders`; API ~7.1 |
| ESLint 9 | flat config |
| pnpm | isolated default; `dlx`; `overrides` |
| Corepack | `packageManager`; enable tường minh |
| pnpm isolated | default; phantom dep phải khai |
| `node --run` | không pre/post scripts |

`engines` metadata trừ `engine-strict`. Matrix CI 26 (+24 nếu còn contract).

Lockfile commit; `npm ci` / `pnpm install --frozen-lockfile`. `devDependencies` không vào image prod. `pnpm why` trước override.

Baseline: **Node 26** + **TS 7**.

---

## 19. Tài liệu liên quan

- [tsconfig & biên dịch TypeScript](tsconfig.md)
- [Modules & Packages](modules-packages.md)
- [Node.js built-ins](nodejs-apis.md)
- [Decorators & Metadata](decorators.md) — không chạy trên strip
- [Entry point & chạy chương trình](main-function.md)
- [exceptions.md](exceptions.md) — fail process / uncaught trên script CI
