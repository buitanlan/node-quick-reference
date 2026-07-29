# npm / pnpm / yarn & tooling

*(package managers, scripts, lockfiles, semver, ESLint/Prettier, tsx/nodemon)*

Baseline: dự án **Node.js 26** + **TypeScript 7**. Chọn **một** package manager cho cả repo và commit **lockfile**. Node **24** vẫn Maintenance LTS nếu bạn chưa nâng. Xem [node26-ts7.md](node26-ts7.md).

---

## Mục lục

- [npm / pnpm / yarn \& tooling](#npm--pnpm--yarn--tooling)
  - [Mục lục](#mục-lục)
  - [1. `package.json` cốt lõi](#1-packagejson-cốt-lõi)
  - [2. Scripts](#2-scripts)
  - [3. `engines` \& phiên bản Node](#3-engines--phiên-bản-node)
  - [4. Dependencies \& semver](#4-dependencies--semver)
  - [5. Lockfiles](#5-lockfiles)
  - [6. Workspaces (monorepo)](#6-workspaces-monorepo)
  - [7. So sánh npm vs pnpm vs yarn](#7-so-sánh-npm-vs-pnpm-vs-yarn)
  - [8. TypeScript runners: strip-types / tsx / tsc](#8-typescript-runners-strip-types--tsx--tsc)
  - [9. nodemon](#9-nodemon)
  - [10. ESLint \& Prettier (tóm tắt)](#10-eslint--prettier-tóm-tắt)
  - [11. Best practices](#11-best-practices)

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

Corepack (Node kèm sẵn) ghim phiên bản yarn/pnpm:

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
pnpm build          # pnpm cho phép bỏ "run" với script không trùng lệnh builtin
yarn build
```

Lifecycle hooks phổ biến: `prepublishOnly`, `prepare` (hay chạy `husky`), `preinstall`/`postinstall` (cẩn thận — supply chain).

Truyền args:

```bash
npm run test -- --grep "auth"
pnpm test -- --grep auth
```

Dùng `npm-run-all` / `concurrently` khi cần song song lint+test — hoặc script shell đơn giản.

Biến môi trường cross-platform: `cross-env` hoặc script nhỏ bằng Node.

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
- CI nên dùng đúng major baseline (**26**); job phụ trên **24** Maintenance LTS nếu còn hỗ trợ khách hàng cũ.

`.nvmrc` / `.node-version`:

```
26
```

---

## 4. Dependencies & semver

| Range | Ý nghĩa (tóm tắt) |
|---|---|
| `1.2.3` | đúng phiên bản |
| `^1.2.3` | ≥1.2.3 & &lt;2.0.0 (mặc định npm hay ghi) |
| `~1.2.3` | ≥1.2.3 & &lt;1.3.0 |
| `>=26` | từ 26 trở lên (engines) |
| `*` / `latest` | tránh trên lib nghiêm ngặt |

- `dependencies`: cần lúc **runtime**.
- `devDependencies`: build/test/lint.
- `peerDependencies`: plugin / framework extension (consumer cài bản tương thích).
- `optionalDependencies`: fail install vẫn tiếp tục (native optional).

Cập nhật có chủ đích:

```bash
npm outdated
pnpm outdated
npm update
pnpm up -L        # theo policy pnpm
```

Security:

```bash
npm audit
pnpm audit
```

Audit không thay review; fix có thể phá semver — đọc changelog.

---

## 5. Lockfiles

| Tool | Lockfile |
|---|---|
| npm | `package-lock.json` |
| pnpm | `pnpm-lock.yaml` |
| yarn (classic/berry) | `yarn.lock` |

- **Commit** lockfile cho app và hầu hết lib.
- CI: `npm ci` / `pnpm install --frozen-lockfile` / `yarn install --immutable`.
- Không trộn hai lockfile trong một package — chọn một tool.

---

## 6. Workspaces (monorepo)

**npm / yarn / pnpm** đều hỗ trợ workspaces (cú pháp hơi khác).

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

Lợi ích: dependency nội bộ `workspace:*`, một lần install, script filter:

```bash
pnpm --filter @acme/api build
npm run build -w packages/api
```

Vẫn cần ranh giới package rõ (`exports`, không import xuyên `src` lung tung).

---

## 7. So sánh npm vs pnpm vs yarn

| | **npm** | **pnpm** | **yarn** |
|---|---|---|---|
| Đi kèm Node | Có | Corepack / cài riêng | Corepack / cài riêng |
| `node_modules` | Phẳng (hoist) cổ điển | Content-addressable + symlinks — **strict** hơn | Berry: PnP hoặc `node_modules` |
| Disk / tốc độ | Ổn | Thường tiết kiệm disk, nhanh | Nhanh; PnP khác biệt lớn |
| Monorepo | Workspaces tốt hơn trước | Rất mạnh (`filter`) | Mạnh (đặc biệt Berry) |
| Khi chọn | Mặc định, đơn giản | Team thích strict + monorepo | Đã gắn yarn / PnP |

Thực tế 2025–2026: **pnpm** phổ biến cho monorepo; **npm** đủ cho app đơn; **yarn** vẫn fine nếu repo đã chuẩn hóa.

---

## 8. TypeScript runners: strip-types / tsx / tsc

Ba hướng chạy TS:

| Cách | Lệnh ý tưởng | Ghi chú |
|---|---|---|
| Node type stripping | `node src/app.ts` (mặc định trên Node 26) | Chỉ **erasable** TS; **không** còn `--experimental-transform-types`; xem [tsconfig.md](tsconfig.md) |
| `tsx` | `tsx src/app.ts` / `tsx watch` | Dev UX tốt, transpile nhanh (esbuild) — cần khi có enum/decorators/… |
| `tsc` emit | `tsc && node dist/app.js` | Production rõ ràng; TS 7 (Go) full build ~8–12× nhanh hơn |

```bash
# dev
pnpm exec tsx watch src/index.ts
# hoặc strip thuần (erasable only):
node --watch src/index.ts

# prod điển hình
pnpm build && node dist/index.js
```

Node 26: type stripping **ổn định**; kết hợp `erasableSyntaxOnly` + `verbatimModuleSyntax`. `enum` / `namespace` / decorators / parameter properties → `tsc`/`tsx`/bundler.

**TypeScript 7 tooling:**

- CLI mới: `--checkers`, `--builders`, `--singleThreaded`; `--watch` cải thiện.
- Programmatic API ổn định ~**7.1**; trong lúc chờ, eslint/plugin dùng bridge **`@typescript/typescript6`** khi cần API compiler cũ.
- Package: `typescript@^7`, `@types/node@^26`.

---

## 9. nodemon

Restart khi file đổi (JS đã emit hoặc kèm loader):

```json
{
  "scripts": {
    "dev": "nodemon --watch dist dist/index.js"
  }
}
```

Với TypeScript, nhiều team thay bằng **`tsx watch`** hoặc `node --watch` (Node 18+):

```bash
node --watch dist/index.js
tsx watch src/index.ts
```

`nodemon` vẫn hữu ích khi watch nhiều loại file / lệnh tùy biến phức tạp.

---

## 10. ESLint & Prettier (tóm tắt)

**ESLint 9** flat config (`eslint.config.js`):

```js
// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**"],
  },
);
```

**Prettier** — format; tránh xung đột rule formatting với ESLint (`eslint-config-prettier`).

```bash
pnpm exec prettier -w .
pnpm exec eslint . --fix
```

Không bắt buộc cả hai plugin khổng lồ — flat + typescript-eslint đủ cho hầu hết service Node.

---

## 11. Best practices

- Một package manager + lockfile; CI frozen install.
- Ghim `engines.node` theo major bạn hỗ trợ (**26**; ghi rõ nếu còn support 24 Maintenance).
- Tách `dependencies` / `devDependencies` đúng nghĩa (Docker prod slim).
- `prepare`/`postinstall` tối giản — bảo mật & máy CI.
- Dev: `node file.ts` (erasable) hoặc `tsx`; prod: `tsc`/bundler emit có chủ đích.
- Workspaces: phụ thuộc nội bộ qua tên package, không relative xuyên repo lung tung.

**Tài liệu liên quan:** [node26-ts7.md](node26-ts7.md) · [tsconfig.md](tsconfig.md) · [modules-packages.md](modules-packages.md) · [nodejs-apis.md](nodejs-apis.md)
