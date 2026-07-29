# npm / pnpm / yarn & tooling

Package managers, scripts, lockfiles, semver, ESLint/Prettier, và runners TypeScript trên baseline **Node.js 26** + **TypeScript 7**.

> Chọn **một** package manager cho cả repo và commit **lockfile**. Node **24** vẫn Maintenance LTS nếu chưa nâng. Xem [node26-ts7.md](node26-ts7.md) · [tsconfig.md](tsconfig.md).

---

## Mục lục

1. [`package.json` cốt lõi](#1-packagejson-cốt-lõi)
2. [Scripts](#2-scripts)
3. [`engines` & phiên bản Node](#3-engines--phiên-bản-node)
4. [Dependencies & semver](#4-dependencies--semver)
5. [Lockfiles](#5-lockfiles)
6. [Workspaces (monorepo)](#6-workspaces-monorepo)
7. [So sánh npm vs pnpm vs yarn](#7-so-sánh-npm-vs-pnpm-vs-yarn)
8. [TypeScript runners: strip / tsx / tsc](#8-typescript-runners-strip--tsx--tsc)
9. [Watch: nodemon / `--watch` / tsx](#9-watch-nodemon----watch--tsx)
10. [ESLint & Prettier](#10-eslint--prettier)
11. [CI skeleton](#11-ci-skeleton)
12. [Best practices](#12-best-practices)
13. [Checklist](#13-checklist)
14. [Cheat sheet](#14-cheat-sheet)
15. [Version notes](#15-version-notes)
16. [Tài liệu liên quan](#16-tài-liệu-liên-quan)

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

Trường quan trọng khác: `exports`, `imports`, `bin`, `files` (publish), `packageManager` (Corepack).

```json
{
  "packageManager": "pnpm@9.15.0"
}
```

```bash
corepack enable
```

---

## 2. Scripts

```bash
npm run build
pnpm build
yarn build
```

Lifecycle hooks: `prepublishOnly`, `prepare` (hay `husky`), `preinstall`/`postinstall` (cẩn thận — supply chain).

```bash
npm run test -- --grep "auth"
pnpm test -- --grep auth
```

Biến môi trường cross-platform: `cross-env` hoặc script nhỏ bằng Node. Song song lint+test: `concurrently` / `npm-run-all` hoặc script shell đơn giản.

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

- Chỉ là **metadata** trừ khi bật `engine-strict` (npm) / setting tương đương.
- CI nên dùng đúng major baseline (**26**); job phụ trên **24** Maintenance LTS nếu còn hỗ trợ khách cũ.

`.nvmrc` / `.node-version`:

```
26
```

---

## 4. Dependencies & semver

| Range | Ý nghĩa (tóm tắt) |
|---|---|
| `1.2.3` | đúng phiên bản |
| `^1.2.3` | ≥1.2.3 & &lt;2.0.0 |
| `~1.2.3` | ≥1.2.3 & &lt;1.3.0 |
| `>=26` | từ 26 (engines) |
| `*` / `latest` | tránh trên lib nghiêm |
| `workspace:*` | bản workspace (pnpm/yarn) |

- `dependencies`: runtime.
- `devDependencies`: build/test/lint.
- `peerDependencies`: plugin / extension — consumer cài bản tương thích.
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

Audit không thay review; fix có thể phá semver — đọc changelog. `overrides` / `pnpm.overrides` chỉ khi buộc phải vá transitive — ghi lý do trong PR.

---

## 5. Lockfiles

| Tool | Lockfile |
|---|---|
| npm | `package-lock.json` |
| pnpm | `pnpm-lock.yaml` |
| yarn | `yarn.lock` |

- **Commit** lockfile cho app và hầu hết lib.
- CI: `npm ci` / `pnpm install --frozen-lockfile` / `yarn install --immutable`.
- Không trộn hai lockfile trong một package.

---

## 6. Workspaces (monorepo)

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

---

## 7. So sánh npm vs pnpm vs yarn

| | **npm** | **pnpm** | **yarn** |
|---|---|---|---|
| Đi kèm Node | Có | Corepack / cài riêng | Corepack / cài riêng |
| `node_modules` | Hoist cổ điển | Content-addressable + symlinks — **strict** hơn | Berry: PnP hoặc `node_modules` |
| Disk / tốc độ | Ổn | Thường tiết kiệm disk | Nhanh; PnP khác biệt lớn |
| Monorepo | Workspaces | Rất mạnh (`filter`) | Mạnh (Berry) |
| Khi chọn | Mặc định, đơn giản | Strict + monorepo | Repo đã chuẩn yarn |

Thực tế: **pnpm** phổ biến monorepo; **npm** đủ app đơn; **yarn** fine nếu đã chuẩn hóa.

---

## 8. TypeScript runners: strip / tsx / tsc

| Cách | Lệnh ý tưởng | Ghi chú |
|---|---|---|
| Node type stripping | `node src/app.ts` | Chỉ **erasable** TS; Node 26 **không** còn `--experimental-transform-types` |
| `tsx` | `tsx src/app.ts` / `tsx watch` | Dev UX; transpile nhanh — cần khi enum/decorators/param props |
| `tsc` emit | `tsc && node dist/app.js` | Production rõ; TS 7 (Go) full build ~8–12× nhanh hơn |

```bash
pnpm exec tsx watch src/index.ts
node --watch src/index.ts   # erasable only
pnpm build && node dist/index.js
```

Khuyến nghị tsconfig strip-oriented: `erasableSyntaxOnly` + `verbatimModuleSyntax` + `module`/`moduleResolution`: **`NodeNext`**. Chi tiết: [tsconfig.md](tsconfig.md).

**TypeScript 7 tooling:**

- CLI: `--checkers`, `--builders`, `--singleThreaded`; `--watch` cải thiện.
- Programmatic API ổn định ~**7.1**; eslint/plugin cần API cũ → bridge **`@typescript/typescript6`**.
- Packages: `typescript@^7`, `@types/node@^26`; có thể `@tsconfig/node26`.

---

## 9. Watch: nodemon / `--watch` / tsx

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

---

## 10. ESLint & Prettier

**ESLint 9** flat config:

```js
// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { ignores: ["dist/**"] },
);
```

**Prettier** — format; `eslint-config-prettier` tránh xung đột formatting.

```bash
pnpm exec prettier -w .
pnpm exec eslint . --fix
```

Trong giai đoạn TS 7 early: nếu typescript-eslint chưa ăn API mới, dùng bridge `@typescript/typescript6` theo hướng dẫn toolchain.

### 10.1 `node --test` (built-in)

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

### 10.2 Docker / prod image (tóm tắt)

```dockerfile
# ý tưởng multi-stage
# FROM node:26-bookworm AS build
#   pnpm install --frozen-lockfile && pnpm build
# FROM node:26-bookworm-slim
#   COPY --from=build /app/dist ./dist
#   COPY --from=build /app/node_modules ./node_modules
#   CMD ["node", "dist/index.js"]
```

- Prod image: chỉ `dependencies` runtime (hoặc bundle single file).
- Ghim tag Node major (`node:26-…`), không `latest`.
- `NODE_ENV=production` ảnh hưởng một số lib (không thay `engines`).

---

## 11. CI skeleton

```yaml
# .github/workflows/ci.yml — skeleton
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [26]
        # optional: include 24 nếu còn dual-support
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

Luôn `tsc --noEmit` dù dev dùng tsx/strip. Job phụ Node 24 chỉ khi còn contract hỗ trợ.

### 11.1 Supply chain tối thiểu

- Prefer `pnpm audit` / `npm audit` có chủ đích; đừng auto-force mọi major.
- Pin Action SHAs nếu policy bảo mật yêu cầu.
- Tránh `postinstall` tải binary tùy ý — review dependency mới.
- `packageManager` field + Corepack giảm “máy dev một kiểu, CI kiểu khác”.

### 11.2 Publish package (tóm tắt)

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
- `npm pack --dry-run` trước khi publish để xem tarball.

---

## 12. Best practices

1. Một package manager + lockfile; CI frozen install.
2. Ghim `engines.node` theo major (**26**; ghi rõ nếu còn 24).
3. Tách `dependencies` / `devDependencies` đúng (Docker prod slim).
4. `prepare`/`postinstall` tối giản — bảo mật & CI.
5. Dev: `node file.ts` (erasable) hoặc `tsx`; prod: `tsc`/bundler.
6. Workspaces: phụ thuộc qua tên package, không relative xuyên repo.
7. `typecheck` script riêng — không bỏ vì “tsx đã chạy”.
8. Corepack `packageManager` để đồng bộ phiên bản tool.

---

## 13. Checklist

```text
□ Một lockfile; CI frozen
□ engines.node khớp baseline / dual-support đã ghi
□ type: module (nếu ESM) + NodeNext trong tsconfig
□ typescript@^7 + @types/node@^26
□ typecheck trên CI
□ Dev runner khớp erasable vs cần transpile
□ Không commit node_modules
□ Audit có chủ đích; đọc breaking changelog
□ packageManager / Corepack nếu monorepo team lớn
□ ESLint flat + ignore dist
```

---

## 14. Cheat sheet

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build && node dist/index.js
tsx watch src/index.ts
node src/index.ts          # erasable only (Node 26)
corepack enable
```

| Việc | Tool |
|---|---|
| Prod emit | `tsc` / bundler |
| Dev TS đầy đủ syntax | `tsx` |
| Dev erasable | `node` / `node --watch` |
| Lint | ESLint 9 flat |
| Format | Prettier |
| Monorepo | pnpm filter / npm workspaces |

---

## 15. Version notes

| Nền | Liên quan tooling |
|---|---|
| npm 7+ | workspaces |
| Node 18+ | `node --watch`, `node --test` |
| Node 22–24 | type stripping experimental → ổn định |
| **Node 26** | strip mặc định/ổn định; gỡ transform-types; V8 14.6 |
| **TS 7** | compiler Go; flags `--checkers`/`--builders`; API ~7.1 |
| ESLint 9 | flat config |

Baseline: **Node 26** + **TS 7**.

---

## 16. Tài liệu liên quan

- [Node 26 & TypeScript 7 highlights](node26-ts7.md)
- [tsconfig & biên dịch TypeScript](tsconfig.md)
- [Modules & Packages](modules-packages.md)
- [Node.js built-ins](nodejs-apis.md)
- [Decorators & Metadata](decorators.md) — không chạy trên strip
- [Entry point & chạy chương trình](main-function.md)
