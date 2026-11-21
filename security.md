# Bảo mật ở biên Node.js

Tài liệu tham chiếu chuyên sâu về bảo mật ứng dụng server và tooling trên **Node.js 26** + **TypeScript 7**: kiểm soát ranh giới tin cậy (trust boundary), chống injection, prototype pollution, lỗ hổng filesystem/symlink, SSRF/DNS rebinding, bảo mật HTTP/Auth, mật mã học, giới hạn tài nguyên (DoS), Permission Model và bảo mật chuỗi cung ứng (supply chain).

> **Callout:** Baseline: **Node.js 26 Active LTS ("Lithium", từ 2026-10-28, V8 14.6+, Undici 8+, OpenSSL 3.5)** và **TypeScript 7.0** (native Go compiler), mốc rà soát **2026-11-21**. Kiểu TypeScript bị xóa hoàn toàn ở runtime (`as User` hay `: Input` **không** xác thực dữ liệu). Bảo mật phía server đòi hỏi **phòng thủ theo chiều sâu (defense in depth)**: validate tại biên, kiểm quyền theo từng tài nguyên, pin địa chỉ mạng/handle thực sự được dùng và đặt hạn mức tài nguyên tường minh.

---

## Mục lục

- [1. Trust boundary, validation & authorization](#1-trust-boundary-validation--authorization)
  - [1.1 Bản đồ biên tin cậy (Trust boundaries)](#11-bản-đồ-biên-tin-cậy-trust-boundaries)
  - [1.2 Runtime validation từ `unknown` & TypeScript type erasure](#12-runtime-validation-từ-unknown--typescript-type-erasure)
  - [1.3 Strict schema, unknown keys & chống Mass Assignment](#13-strict-schema-unknown-keys--chống-mass-assignment)
  - [1.4 Authentication vs Authorization (IDOR / BOLA)](#14-authentication-vs-authorization-idor--bola)
- [2. Injection, object keys và prototype](#2-injection-object-keys-và-prototype)
  - [2.1 SQL Injection & Dynamic Identifiers](#21-sql-injection--dynamic-identifiers)
  - [2.2 Command & Argument Injection (và Windows `.bat`/`.cmd`)](#22-command--argument-injection-và-windows-batcmd)
  - [2.3 Prototype Pollution, Object Keys & Unsafe Deserialization](#23-prototype-pollution-object-keys--unsafe-deserialization)
  - [2.4 ReDoS & Dynamic RegExp](#24-redos--dynamic-regexp)
- [3. Filesystem: traversal, symlink và TOCTOU](#3-filesystem-traversal-symlink-và-toctou)
  - [3.1 Path traversal & bẫy đặc thù Windows / Unicode](#31-path-traversal--bẫy-đặc-thù-windows--unicode)
  - [3.2 Symlink, TOCTOU & bẫy `O_NOFOLLOW` trên Windows](#32-symlink-toctou--bẫy-o_nofollow-trên-windows)
  - [3.3 Archive extraction (Zip Slip / Tar Slip) & tệp tạm](#33-archive-extraction-zip-slip--tar-slip--tệp-tạm)
- [4. Outbound HTTP & SSRF](#4-outbound-http--ssrf)
  - [4.1 URL parsing, Allowlist & Danh sách CIDR nội bộ](#41-url-parsing-allowlist--danh-sách-cidr-nội-bộ)
  - [4.2 Chống DNS Rebinding (TOCTOU) bằng Undici custom lookup](#42-chống-dns-rebinding-toctou-bằng-undici-custom-lookup)
  - [4.3 Khác biệt Node `fetch` vs Browser (CORS, TLS & Egress Proxy)](#43-khác-biệt-node-fetch-vs-browser-cors-tls--egress-proxy)
- [5. Web/API boundary: Auth, JWT, Cookies, CSRF, CORS & Headers](#5-webapi-boundary-auth-jwt-cookies-csrf-cors--headers)
  - [5.1 JWT & Session Tokens](#51-jwt--session-tokens)
  - [5.2 Cookies, Session Fixation, CSRF & CORS](#52-cookies-session-fixation-csrf--cors)
  - [5.3 Security Headers & Error Exposure](#53-security-headers--error-exposure)
- [6. Secrets, Cryptography, TLS & Resource Budgets](#6-secrets-cryptography-tls--resource-budgets)
  - [6.1 Password Hashing (`crypto.argon2` & `crypto.scrypt` trên Node 26)](#61-password-hashing-cryptoargon2--cryptoscrypt-trên-node-26)
  - [6.2 `timingSafeEqual`, HMAC & Authenticated Encryption (AES-256-GCM)](#62-timingsafeequal-hmac--authenticated-encryption-aes-256-gcm)
  - [6.3 TLS, Secrets Redaction & Resource Budgets (DoS)](#63-tls-secrets-redaction--resource-budgets-dos)
- [7. Permission model, isolation và supply chain](#7-permission-model-isolation-và-supply-chain)
  - [7.1 Node 26 Permission Model thực chiến](#71-node-26-permission-model-thực-chiến)
  - [7.2 Isolation Boundary: `node:vm`, Worker vs OS/Container](#72-isolation-boundary-nodevm-worker-vs-oscontainer)
  - [7.3 Supply Chain Security](#73-supply-chain-security)
- [8. Anti-patterns & Checklist bảo mật](#8-anti-patterns--checklist-bảo-mật)
  - [8.1 Bảng Anti-patterns phổ biến](#81-bảng-anti-patterns-phổ-biến)
  - [8.2 Checklist bảo mật trước khi ra production](#82-checklist-bảo-mật-trước-khi-ra-production)
- [9. Tài liệu liên quan](#9-tài-liệu-liên-quan)

---

## 1. Trust boundary, validation & authorization

Mọi dữ liệu đi vào tiến trình từ ngoài vùng kiểm soát trực tiếp của mã nguồn đều là **untrusted input** (`unknown`). Bảo mật hệ thống bắt đầu từ việc xác định rõ các **biên tin cậy (trust boundaries)** và ép mọi dữ liệu qua bước parse/validate thành kiểu miền ứng dụng (domain model) trước khi dùng.

### 1.1 Bản đồ biên tin cậy (Trust boundaries)

| Biên tin cậy | Nguồn dữ liệu | Rủi ro chính | Kiểm tra runtime bắt buộc |
|---|---|---|---|
| **HTTP ingress** | Path params, query string, headers, cookies, body, multipart upload | Injection, type confusion, DoS, smuggling, mass assignment | Giới hạn bytes thực đọc, Content-Type chính xác, schema strict, range, unknown keys policy |
| **Env & CLI args** | `process.env`, `process.argv`, `.env`, config file | Biến thiếu/rỗng thành `undefined`, ép kiểu sai (`"false"` truthy), flag injection | Parse boolean/number tường minh, fail-fast lúc khởi động, không log giá trị secret |
| **Worker / IPC** | `worker_threads` `postMessage`, `child_process` IPC, Unix socket | Payload sai discriminant, bản ghi quá lớn, prototype không mong đợi | Kiểm `kind`/discriminant + payload shape; không tin annotation phía gửi |
| **DB / Cache / Upstream** | Hàng từ SQL/NoSQL, JSON trong Redis, response API đối tác | Schema drift, dữ liệu cũ/bị hỏng, cache poisoning, SSRF qua redirect | Validate version/schema tại adapter trước khi chuyển sang domain object |
| **Webhook / Queue** | Event từ Stripe/GitHub/queue bên ngoài | Giả mạo event, replay attack, out-of-order delivery | Xác thực chữ ký HMAC trên **raw bytes**, kiểm timestamp chống replay, idempotency key, rồi mới parse JSON |

> **Nguyên tắc "Parse, don't just validate":** Sau khi vượt biên, trả về một object mới chỉ gồm các thuộc tính đã được kiểm tra và chuẩn hóa kiểu — **không** giữ nguyên reference tới object gốc từ `JSON.parse` hay `req.body` để truyền sâu xuống tầng nghiệp vụ.

### 1.2 Runtime validation từ `unknown` & TypeScript type erasure

TypeScript 7 biên dịch (hoặc Node 26 strip types) xóa sạch mọi interface, type alias và assertion trước khi V8 thực thi. Một lời gọi `JSON.parse(raw) as CreateUserDto` chỉ tắt cảnh báo của compiler; ở runtime, `raw` vẫn có thể là `null`, mảng, chuỗi, hoặc object chứa field `role: "admin"`.

```ts
// SAI: type assertion không tạo bất kỳ kiểm tra runtime nào.
type CreateOrderInput = { itemId: string; quantity: number };

async function handleBad(rawJson: string) {
  const input = JSON.parse(rawJson) as CreateOrderInput;
  // Nếu client gửi `{"itemId": 123, "quantity": -999}` hoặc `"hello"`, code vẫn chạy tiếp!
  return createOrder(input.itemId, input.quantity);
}

// ĐÚNG: nhận `unknown`, kiểm tra kiểu, định dạng và miền giá trị trước khi narrow.
function parseCreateOrder(value: unknown): CreateOrderInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("expected JSON object");
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError("expected plain object");
  }
  const record = value as Record<string, unknown>;
  const itemId = record.itemId;
  const quantity = record.quantity;

  if (typeof itemId !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(itemId)) {
    throw new RangeError("invalid itemId");
  }
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
    throw new RangeError("quantity must be integer 1..100");
  }
  // Trả về object mới sạch — tách hoàn toàn khỏi payload gốc.
  return { itemId, quantity };
}
```

Với API lớn, ưu tiên schema validator chuẩn (ví dụ Zod, Valibot, TypeBox/AJV ở chế độ strict) ngay tại tầng adapter/controller; dùng validator thủ công như trên khi viết thư viện không phụ thuộc ngoài hoặc đường nóng (hot path). Xem thêm [typesystem.md](typesystem.md) về type guards và branded types.

### 1.3 Strict schema, unknown keys & chống Mass Assignment

**Mass assignment** xảy ra khi ứng dụng gán thẳng toàn bộ payload từ client vào lệnh ghi DB hoặc state nội bộ (ví dụ `await db.users.update(userId, req.body)`). Kẻ tấn công chỉ cần thêm `"role": "admin"`, `"isVerified": true` hoặc `"tenantId": "victim"` vào JSON request.

| Chính sách unknown keys | Hành vi | Khi nên dùng |
|---|---|---|
| **Reject (strict)** | Báo lỗi `400 Bad Request` nếu xuất hiện key ngoài schema | API nội bộ, thao tác nhạy cảm (auth, billing, permission) — phát hiện sớm lỗi client & dò quét |
| **Strip (whitelist pick)** | Chỉ trích xuất tường minh các field cho phép, bỏ qua phần dư | Webhook đối tác (nhà cung cấp thường thêm field mới không báo trước) |
| **Passthrough** | Giữ nguyên toàn bộ key lạ | **Tránh** ở biên ứng dụng; chỉ dùng ở proxy trong suốt không diễn giải dữ liệu |

```ts
// SAI: truyền thẳng payload vào update → lỗ hổng Mass Assignment.
// await userRepo.update(session.userId, body);

// ĐÚNG: chỉ pick đúng tập trường người dùng được phép sửa.
type UpdateProfileDto = { displayName?: string; bio?: string };

const ALLOWED_PROFILE_KEYS = new Set(["displayName", "bio"]);

function parseProfilePatch(raw: unknown): UpdateProfileDto {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new TypeError("expected object");
  }
  const out: UpdateProfileDto = {};
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_PROFILE_KEYS.has(key)) {
      throw new RangeError(`unexpected field: ${key}`);
    }
  }
  const src = raw as Record<string, unknown>;
  if (Object.hasOwn(src, "displayName")) {
    if (typeof src.displayName !== "string" || src.displayName.length > 80) {
      throw new RangeError("invalid displayName");
    }
    out.displayName = src.displayName.trim();
  }
  if (Object.hasOwn(src, "bio")) {
    if (typeof src.bio !== "string" || src.bio.length > 500) {
      throw new RangeError("invalid bio");
    }
    out.bio = src.bio.trim();
  }
  return out;
}
```

### 1.4 Authentication vs Authorization (IDOR / BOLA)

- **Authentication (AuthN):** Xác minh danh tính người gọi (*bạn là ai?* — cookie session, JWT, mTLS, API key).
- **Authorization (AuthZ):** Xác minh quyền thực hiện hành động cụ thể trên **tài nguyên cụ thể** (*bạn có được phép đọc/sửa hóa đơn #42 này không?*).

Lỗi phổ biến nhất trong OWASP API Security Top 10 là **BOLA / IDOR** (Broken Object Level Authorization / Insecure Direct Object Reference): endpoint đã kiểm tra user đăng nhập và validate `invoiceId` là UUID hợp lệ, nhưng quên kiểm tra xem hóa đơn đó có thuộc về `session.tenantId` / `session.userId` hay không.

```ts
// SAI: chỉ kiểm tra đã đăng nhập (AuthN) + UUID hợp lệ, bỏ qua quyền sở hữu (AuthZ).
async function getInvoiceBad(req: { userId: string }, invoiceId: string) {
  return db.query("SELECT * FROM invoices WHERE id = $1", [invoiceId]);
}

// ĐÚNG: ràng buộc điều kiện sở hữu/tenant trực tiếp trong truy vấn (hoặc kiểm policy sau fetch).
// Trả cùng mã 404 cho cả "không tồn tại" lẫn "không có quyền" khi cần chống dò ID (enumeration).
async function getInvoiceSafe(
  actor: { userId: string; tenantId: string; roles: readonly string[] },
  invoiceId: string,
) {
  const isTenantAdmin = actor.roles.includes("billing_admin");
  const sql = isTenantAdmin
    ? "SELECT id, amount, status FROM invoices WHERE id = $1 AND tenant_id = $2"
    : "SELECT id, amount, status FROM invoices WHERE id = $1 AND tenant_id = $2 AND owner_id = $3";
  const params = isTenantAdmin
    ? [invoiceId, actor.tenantId]
    : [invoiceId, actor.tenantId, actor.userId];

  const row = await db.queryOne(sql, params);
  if (!row) {
    throw new NotFoundError("invoice not found");
  }
  return row;
}
```

**Lưu ý thêm về AuthZ:**
- Không bao giờ lấy `userId` hoặc `tenantId` từ request body/query để làm danh tính thực thi; luôn lấy từ ngữ cảnh phiên đã xác thực ở server (`AsyncLocalStorage` / session).
- Kiểm quyền ở **mọi tầng thao tác** (đọc, sửa, xóa, xuất file, gọi batch endpoint) — đừng chỉ ẩn nút trên UI hay kiểm ở endpoint liệt kê.
- Tham khảo [Node.js Security Best Practices](https://nodejs.org/en/learn/getting-started/security-best-practices) và [OWASP API Security Top 10](https://owasp.org/API-Security/).

---

## 2. Injection, object keys và prototype

Injection xảy ra khi dữ liệu từ người dùng bị trộn lẫn vào kênh lệnh (SQL, shell, regex, JS code, cấu trúc prototype) thay vì giữ tách biệt giữa **code/syntax** và **data**. Trước khi dùng bất kỳ object nào đi qua biên tin cậy, phải kiểm tra plain object, own data property (tránh kích hoạt getter) và miền giá trị:

```ts
// Chỉ lấy các field đã kiểm (own data property trên plain object), không merge nguyên body vào config nội bộ.
function parsePage(value: unknown): { limit: number } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("expected object");
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError("expected plain object");
  }
  // Dùng getOwnPropertyDescriptor để tránh kích hoạt own getter có side-effect khi đọc thuộc tính.
  const desc = Object.getOwnPropertyDescriptor(value, "limit");
  if (!desc || !("value" in desc)) {
    throw new TypeError("limit required");
  }
  const limit = desc.value;
  if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError("limit must be 1..100");
  }
  return { limit };
}
```

### 2.1 SQL Injection & Dynamic Identifiers

Luôn dùng **parameterized queries (bound parameters)** cho mọi giá trị dữ liệu. Driver hoặc database engine truyền giá trị qua kênh tham số riêng nên chuỗi `' OR 1=1 --` không bao giờ trở thành cú pháp SQL.

Tuy nhiên, SQL **không cho phép bind** tên bảng, tên cột, hướng sắp xếp (`ASC`/`DESC`) hoặc toán tử. Khi cần sắp xếp/lọc động, **tuyệt đối không** nội suy chuỗi trực tiếp — hãy ánh xạ qua **allowlist tĩnh** (dùng `Map` hoặc `switch` trả về literal cứng):

```ts
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
db.exec("CREATE TABLE orders (id INTEGER PRIMARY KEY, created_at TEXT, total_cents INTEGER, status TEXT)");

// Map literal cứng → an toàn tuyệt đối vì SQL chỉ chứa chuỗi hằng trong source code.
const SORT_COLUMNS = new Map<string, string>([
  ["created", "created_at"],
  ["total", "total_cents"],
]);

const SORT_DIRS = new Map<string, string>([
  ["asc", "ASC"],
  ["desc", "DESC"],
]);

function listOrders(status: string, sortBy: string, dir: string, limit: number) {
  const column = SORT_COLUMNS.get(sortBy);
  const direction = SORT_DIRS.get(dir.toLowerCase());
  if (!column || !direction) {
    throw new RangeError("invalid sort parameters");
  }
  const safeLimit = parsePage({ limit }).limit;

  // Tên cột & hướng lấy từ Map allowlist; giá trị dữ liệu (status, safeLimit) bind qua `?`.
  const stmt = db.prepare(
    `SELECT id, created_at, total_cents FROM orders WHERE status = ? ORDER BY ${column} ${direction} LIMIT ?`,
  );
  return stmt.all(status, safeLimit);
}
```

**Bẫy hay gặp khác với SQL / NoSQL:**
- `LIKE` wildcard: bound parameter ngăn SQLi nhưng không escape ký tự `%` và `_` trong mẫu `LIKE` (có thể gây full-table scan / DoS nếu user gửi `%%%%%%`). Hãy escape `%`, `_`, `\` và khai báo `ESCAPE '\'`.
- NoSQL (MongoDB): nhận object từ JSON body rồi đưa thẳng vào `{ username: body.username }` cho phép tấn công operator injection như `{ "username": { "$ne": null } }`. Runtime validation ép `typeof body.username === "string"` chặn đứng lỗi này.

### 2.2 Command & Argument Injection (và Windows `.bat`/`.cmd`)

Khi buộc phải gọi tiến trình ngoài, luôn ưu tiên `execFile` hoặc `spawn` với **mảng đối số** và `shell: false` (mặc định). Tuy nhiên, `shell: false` **chưa đủ** để an toàn tuyệt đối vì còn hai lỗ hổng nghiêm trọng:

1. **Option / Argument Injection:** Dù không qua shell, nếu đối số bắt đầu bằng `-` (ví dụ tên file `-o` hoặc `--upload-pack=sh -c ...` truyền cho `git`, `tar`, `curl`, `rg`), chương trình đích sẽ hiểu đó là CLI flag chứ không phải tên file/dữ liệu. Luôn:
   - Đặt dấu phân tách kết thúc tùy chọn **`--`** trước các đối số vị trí (positional args) nếu binary hỗ trợ.
   - Validate format chặt (allowlist ký tự, cấm tiền tố `-` nếu không cần).
2. **Bẫy Windows `.bat` / `.cmd` (`CVE-2024-27980`):** Trên Windows, file batch `.bat` và `.cmd` **không thể** chạy trực tiếp qua `CreateProcess` mà không qua `cmd.exe`. Từ bản vá `CVE-2024-27980` (Node 18/20/22+ và Node 26), gọi `spawn`/`execFile` tới `.bat`/`.cmd` với `shell: false` sẽ ném lỗi **`EINVAL`** nhằm chặn kẻ tấn công lén thực thi lệnh shell. **Tuyệt đối không** "sửa lỗi `EINVAL`" bằng cách bật `shell: true` rồi truyền untrusted input vào mảng `args` — vì `cmd.exe` vẫn diễn giải `&`, `|`, `^`, `%VAR%`, `!VAR!`!

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// SAI 1: ghép chuỗi với exec() → shell command injection (`; rm -rf /`).
// SAI 2: execFile("git", ["ls-remote", userUrl]) → argument injection nếu userUrl là "--upload-pack=...".
// SAI 3: spawn("tool.cmd", [userArg], { shell: true }) → cmd.exe injection trên Windows.

// ĐÚNG: binary cố định, mảng args, `shell: false`, `--` chặn option injection, validate input trước.
async function listGitRefs(repoUrl: string, signal?: AbortSignal): Promise<string> {
  const parsed = new URL(repoUrl);
  if (parsed.protocol !== "https:") {
    throw new RangeError("only https git URLs allowed");
  }
  const { stdout } = await execFileAsync(
    "git",
    ["ls-remote", "--heads", "--", parsed.href],
    {
      shell: false,
      timeout: 10_000,
      maxBuffer: 1024 * 1024, // 1 MiB cap tránh OOM
      signal,
      env: { PATH: process.env.PATH ?? "", GIT_TERMINAL_PROMPT: "0" }, // Không rò env secrets của server
    },
  );
  return stdout;
}
```

> **Mẹo phòng thủ env:** Khi spawn tiến trình ngoài, đừng truyền nguyên `process.env` nếu không cần — nó chứa `DATABASE_URL`, `JWT_SECRET`, AWS credentials. Truyền một object `env` tối giản chỉ gồm các biến thực sự cần thiết.

### 2.3 Prototype Pollution, Object Keys & Unsafe Deserialization

**Prototype pollution** xảy ra khi mã ứng dụng ghi đệ quy theo key do người dùng kiểm soát (ví dụ `target[a][b] = val` trong hàm deep merge, dot-path setter hoặc query parser) với key `__proto__`, `constructor` hoặc `prototype`. Khi `Object.prototype.isAdmin = true` bị nhiễm độc, mọi object bình thường trong toàn tiến trình đều kế thừa thuộc tính này.

**Những điểm tinh tế cần nhớ trên Node 26 / V8:**

- **`Map` vs `Object.create(null)` vs `{}`:** Khi cần từ điển (dictionary/cache) với khóa động đến từ bên ngoài, dùng **`Map`** (ưu tiên hàng đầu — không xung đột `toString`, `constructor`, `__proto__` và thao tác xóa nhanh hơn) hoặc `Object.create(null)` nếu phải serialize/interop kiểu object.
- **Object spread `{ ...a }` ≠ `Object.assign(target, a)`:**
  - `{ ...src }` dùng `CreateDataProperty` để tạo own data property (gọi `[[DefineOwnProperty]]`), **không** kích hoạt setter trên `Object.prototype.__proto__` của object kết quả. Tuy nhiên `{ ...src }` vẫn **đọc** (invoke getter) trên `src`!
  - `Object.assign(target, src)` dùng phép gán `target[k] = src[k]` (`[[Set]]`), có thể **gọi setter** trên `target` hoặc prototype của `target`.
- **Getter và `Proxy`:** Nếu object đến từ plugin nội bộ hay thư viện không tin cậy (không phải kết quả trực tiếp của `JSON.parse`), chỉ riêng hành động đọc `obj.limit` đã có thể chạy mã tùy ý qua getter hoặc `Proxy` trap. Dùng `Object.getOwnPropertyDescriptor` như hàm `parsePage` ở đầu mục 2 sẽ kiểm tra được đó là data descriptor hay accessor mà không kích hoạt getter.
- **Flag runtime `--disable-proto=throw` (hoặc `delete`):** Chạy `node --disable-proto=throw server.js` loại bỏ accessor `Object.prototype.__proto__` ở cấp V8. Lưu ý: flag này **không** chặn được nhánh `constructor.prototype` — bạn vẫn phải chặn khóa nguy hiểm ở tầng code!
- **Unsafe Deserialization & Dynamic Code Execution:**
  - Không bao giờ chạy `eval`, `new Function`, `vm.runInNewContext` với dữ liệu đầu vào; cân nhắc bật **`--disallow-code-generation-from-strings`** ở production nếu không có dependency nào cần sinh code động.
  - Không dùng **`v8.deserialize()`** (chứa cấu trúc bộ nhớ nội bộ V8, có thể crash process hoặc khai thác memory corruption), `node-serialize`, hay `yaml.load` (bản không safe) trên dữ liệu không tin cậy. Chỉ dùng `JSON.parse` (hoặc parser có schema safe như `yaml` với schema JSON/CORE) kèm giới hạn kích thước byte và độ sâu lồng nhau.

```ts
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// Deep merge an toàn tối thiểu khi bắt buộc phải merge cấu hình đã kiểm soát
function safeMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 8) throw new RangeError("max nesting depth exceeded");
  for (const key of Object.keys(source)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    const desc = Object.getOwnPropertyDescriptor(source, key);
    if (!desc || !("value" in desc)) continue;
    const nextVal = desc.value;
    const prevDesc = Object.getOwnPropertyDescriptor(target, key);
    const prevVal = prevDesc && "value" in prevDesc ? prevDesc.value : undefined;

    if (isPlainObject(prevVal) && isPlainObject(nextVal)) {
      target[key] = safeMerge({ ...prevVal }, nextVal, depth + 1);
    } else {
      Object.defineProperty(target, key, {
        value: nextVal,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
  }
  return target;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}
```

### 2.4 ReDoS & Dynamic RegExp

Engine RegExp mặc định của V8 là NFA có quay lui (backtracking). Một biểu thức có các quantifier lồng nhau hoặc nhánh trùng lặp như `/^(a+)+$/`, `/^(\w+\s?)+$/` hay `/([a-zA-Z0-9._-]+)+@/` gặp chuỗi không khớp dài 30–50 ký tự sẽ bùng nổ thời gian theo hàm mũ $O(2^n)$ — **treo cứng toàn bộ event loop** (Single-Thread DoS) chỉ với một HTTP request!

```ts
// SAI: vừa dính ReDoS nếu user gửi regex ác ý, vừa sai ngữ nghĩa nếu user nhập "price ($5)"
function searchBad(text: string, userTerm: string): boolean {
  return new RegExp(userTerm, "i").test(text);
}

// ĐÚNG (Node 26 / ES2025): khi cần khớp chuỗi văn bản literal động, dùng RegExp.escape()
// và luôn giới hạn độ dài input trước khi chạy regex.
function searchWordSafe(text: string, userTerm: string): boolean {
  if (userTerm.length === 0 || userTerm.length > 100 || text.length > 100_000) {
    throw new RangeError("search input exceeds budget");
  }
  const escaped = RegExp.escape(userTerm);
  return new RegExp(`\\b${escaped}\\b`, "iu").test(text);
}
```

**Chiến lược phòng chống ReDoS toàn diện:**
1. Nếu chỉ tìm chuỗi con đơn giản, dùng `String.prototype.includes` / `indexOf` — độ phức tạp tuyến tính, không có backtracking.
2. Nếu cần regex với literal động, dùng **`RegExp.escape()`** (có sẵn trên Node 26 / V8 14.6+). Xem thêm chi tiết spec tại [literals.md](literals.md).
3. **Cảnh báo:** `RegExp.escape()` chỉ biến chuỗi thành literal; nó **không** bảo vệ nếu sản phẩm của bạn cho phép user nhập pattern regex tùy ý. Trong trường hợp đó:
   - Dùng engine thời gian tuyến tính không quay lui như **`re2`** (binding Google RE2).
   - Luôn áp giới hạn độ dài chuỗi đầu vào (input cap).
   - Tách chạy trong Worker Thread có watchdog terminate (vì `AbortSignal.timeout` **không thể** ngắt một lệnh `.test()` đồng bộ đang chiếm CPU trên main thread).
   - Chạy linter/static check (`eslint-plugin-redos` hoặc `recheck`) trong CI cho mọi regex tĩnh trong codebase.

---

## 3. Filesystem: traversal, symlink và TOCTOU

Mọi thao tác file lấy tên/đường dẫn từ người dùng đều dễ bị bẻ khỏi thư mục gốc (path traversal), chuyển hướng qua symlink hoặc tấn công điều kiện tranh chấp (TOCTOU). Hàm `resolveInside` dưới đây là lớp chặn **lexical** đã vá các lỗ hổng biên trên cả POSIX lẫn Windows (trỏ trúng thư mục root, null byte, absolute/drive-relative input, Windows ADS `:`, trailing dot/space, tên thiết bị DOS dành riêng):

```ts
import { resolve, relative, isAbsolute, sep } from "node:path";

const RESERVED_WIN_NAMES = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;

// Chặn escape về mặt lexical + các bẫy đường dẫn biên (POSIX & Windows).
// LƯU Ý: KHÔNG giải quyết symlink hoặc race condition (TOCTOU) — xem mục 3.2.
function resolveInside(root: string, input: string): string {
  if (input.length === 0 || input.includes("\0")) {
    throw new Error("invalid path");
  }
  // Chặn tuyệt đối input là đường dẫn tuyệt đối, UNC, drive-relative (C:foo) hoặc Windows ADS (file.txt::$DATA).
  if (isAbsolute(input) || /^[a-zA-Z]:/.test(input) || input.startsWith("\\\\") || input.includes(":")) {
    throw new Error("absolute or ADS path rejected");
  }

  const base = resolve(root);
  const candidate = resolve(base, input);
  const rel = relative(base, candidate);

  // Chặn escape ra ngoài root VÀ chặn rel === "" (trỏ đúng vào chính thư mục root).
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error("path escapes root");
  }

  for (const segment of rel.split(/[/\\]/)) {
    if (segment.length === 0 || /[. ]$/.test(segment) || RESERVED_WIN_NAMES.test(segment)) {
      throw new Error("disallowed path segment");
    }
  }
  return candidate;
}
```

### 3.1 Path traversal & bẫy đặc thù Windows / Unicode

Kiểm tra `candidate.startsWith(base)` là **lỗi kinh điển** vì `/srv/uploads-evil/a.txt` vẫn bắt đầu bằng `/srv/uploads`. Ngay cả khi dùng `path.relative`, vẫn còn hàng loạt bẫy biên mà chỉ nhìn ví dụ POSIX đơn giản sẽ bỏ sót:

| Bẫy đường dẫn | Ví dụ payload | Hậu quả nếu bỏ sót | Cách xử lý |
|---|---|---|---|
| **Sibling prefix** | `../uploads-evil/secret.txt` | Vượt qua `startsWith("/srv/uploads")` | Dùng `path.relative(base, candidate)` + kiểm `..` & `..${sep}` |
| **Trỏ trúng thư mục root** | `.` hoặc `a/..` (`rel === ""`) | `rm(candidate)` xóa luôn thư mục gốc `uploads/` hoặc đọc sai ngữ nghĩa file | Từ chối tường minh `rel === ""` khi kỳ vọng tệp/thư mục con |
| **Double URL decode** | `%252e%252e%252fetc%252fpasswd` | Gateway decode 1 lần thành `%2e%2e%2f`, app decode thêm lần 2 sau bước validate | Decode đúng **1 lần** theo hợp đồng HTTP trước khi validate; cấm chuỗi còn `%` nếu không cần |
| **Null byte** | `avatar.png\0.txt` | Cắt cụt chuỗi ở tầng C/native addon hoặc bypass kiểm đuôi file | Từ chối ngay khi `input.includes("\0")` |
| **Windows Alternate Data Streams (ADS)** | `file.txt::$DATA`, `file.txt:hidden` | Ghi/đọc stream ẩn trên NTFS, vượt qua kiểm tra extension | Cấm ký tự `:` trong đường dẫn tương đối |
| **Trailing dot / space (Windows)** | `script.js.`, `config.json ` | Win32 API âm thầm cắt bỏ dấu `.` và khoảng trắng cuối tên file → bypass extension allowlist | Cấm segment kết thúc bằng `.` hoặc dấu cách |
| **Reserved DOS device names** | `CON`, `NUL`, `PRN`, `AUX`, `COM1`..`COM9`, `LPT1`..`LPT9`, `NUL.txt` | Treo I/O hoặc ghi vào device đặc biệt trên Windows | Chặn bằng regex `RESERVED_WIN_NAMES` không phân biệt hoa/thường |
| **Case sensitivity & Unicode NFC/NFD** | `Admin.txt` vs `admin.txt`; `é` (`U+00E9`) vs `e\u0301` | Hệ thống file macOS (APFS) / Windows (NTFS) không phân biệt hoa thường hoặc chuẩn hóa Unicode khác Linux (ext4) → lệch cache/authZ theo path | Chuẩn hóa Unicode `.normalize("NFC")`; tốt nhất đặt tên file trên đĩa bằng **UUID/hash do server sinh**, chỉ lưu tên gốc làm metadata DB |

> **Thiết kế tốt nhất cho file upload:** Không bao giờ dùng tên file do client gửi để tạo đường dẫn trên ổ đĩa. Sinh tên ngẫu nhiên bằng `crypto.randomUUID()`, lưu ở thư mục không nằm trong webroot và trả về kèm `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`.

### 3.2 Symlink, TOCTOU & bẫy `O_NOFOLLOW` trên Windows

`resolveInside()` chỉ kiểm tra chuỗi đường dẫn (lexical). Nếu kẻ tấn công (hoặc một archive bung nén trước đó) đặt một symlink `uploads/link -> /etc/shadow`, thì về mặt chuỗi `uploads/link` nằm hoàn toàn trong `uploads/`.

Nhiều lập trình viên gọi `await fs.realpath(candidate)` hoặc `await fs.access(candidate)` rồi mới gọi `await fs.open(candidate)`. Đây là lỗ hổng **TOCTOU (Time-Of-Check to Time-Of-Use)**: giữa thời điểm `realpath()` kiểm tra xong và thời điểm `open()` mở file, tiến trình khác có thể tráo `uploads/link` thành symlink trỏ ra ngoài root.

**CẢNH BÁO NGHIÊM TRỌNG VỀ `O_NOFOLLOW` TRÊN WINDOWS:**
Trong JavaScript, toán tử bitwise `|` chuyển `undefined` thành `0`. Trên Windows, **`fs.constants.O_NOFOLLOW` là `undefined`**! Vì vậy đoạn mã tưởng như an toàn sau đây:

```ts
// NGUY HIỂM TRÊN WINDOWS: fs.constants.O_NOFOLLOW === undefined!
// O_RDONLY | undefined  ===  O_RDONLY | 0  ===  O_RDONLY
// → Âm thầm vô hiệu hóa hoàn toàn cờ chống symlink mà KHÔNG báo lỗi!
const fd = await fs.open(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
```

**Cách xử lý chuẩn & portable:**
1. Luôn kiểm tra `fs.constants.O_NOFOLLOW !== undefined` trước khi gộp bitwise; nếu chạy trên Linux/macOS thì truyền `O_NOFOLLOW` vào `fs.open` để kernel từ chối symlink ở tầng syscall (ném `ELOOP`).
2. Luôn mở file lấy **`FileHandle`** (bọc `await using`), thao tác đọc/ghi/stat **qua chính `handle`** (`handle.stat()`, `handle.readFile()`) thay vì gọi lại bằng đường dẫn chuỗi.
3. Khi tạo file mới, dùng cờ **`O_CREAT | O_EXCL`** (tương đương `"wx"`) để bảo đảm atomic — thất bại ngay với `EEXIST` nếu file hoặc symlink đã tồn tại.
4. Trên Windows (nơi không có `O_NOFOLLOW` ở mức POSIX `open`), kết hợp: phân quyền OS/ACL cho thư mục upload để không tiến trình untrusted nào tạo được symlink/junction (`SeCreateSymbolicLinkPrivilege` mặc định bị tắt với non-admin, nhưng **Directory Junction** vẫn tạo được bởi user thường), kiểm tra từng thành phần bằng `lstat` (từ chối `isSymbolicLink()`), và sau khi mở handle kiểm tra `realpath` hoặc tách hẳn vào container Linux / object storage (S3/GCS).

```ts
import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { relative } from "node:path";

async function readRegularFileSafely(root: string, userPath: string, maxBytes: number): Promise<Buffer> {
  const safePath = resolveInside(root, userPath);
  const rootReal = await fs.realpath(root);

  // Trên POSIX: dùng O_NOFOLLOW để kernel chặn symlink ở tầng open() (atomic với leaf).
  // Trên Windows: O_NOFOLLOW là undefined → KHÔNG bao giờ OR mù quáng; kiểm lstat + fail/guard tường minh.
  let flags = fsConstants.O_RDONLY;
  if (typeof fsConstants.O_NOFOLLOW === "number") {
    flags |= fsConstants.O_NOFOLLOW;
  } else {
    const lst = await fs.lstat(safePath);
    if (lst.isSymbolicLink()) {
      throw new Error("symlink rejected");
    }
  }

  // Mở bằng FileHandle và đóng tự động qua `await using` (Node 26).
  await using handle = await fs.open(safePath, flags);
  const st = await handle.stat();
  if (!st.isFile()) {
    throw new Error("not a regular file");
  }
  if (st.size > maxBytes) {
    throw new RangeError("file exceeds size budget");
  }

  // Kiểm lại đường dẫn thực của thư mục cha (chặn symlink ở các thư mục trung gian).
  const actualReal = await fs.realpath(safePath);
  resolveInside(rootReal, relative(rootReal, actualReal));

  // Đọc tối đa maxBytes + 1 qua handle đã mở để không tin mù quáng st.size nếu file đang bị ghi thêm.
  const buf = Buffer.allocUnsafe(maxBytes + 1);
  let offset = 0;
  while (offset <= maxBytes) {
    const { bytesRead } = await handle.read(buf, offset, buf.length - offset, offset);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  if (offset > maxBytes) {
    throw new RangeError("file grew past size budget while reading");
  }
  return buf.subarray(0, offset);
}
```

> **Ghi chú về symlink ở thư mục trung gian (intermediate directories):** `O_NOFOLLOW` chỉ chặn symlink ở **thành phần cuối cùng** (leaf), không chặn nếu thư mục cha `uploads/sub` là symlink. Trong môi trường có yêu cầu cách ly cao trên Linux, cần `openat2` với `RESOLVE_BENEATH` (qua native/OS sandbox) hoặc chỉ cho phép đường dẫn phẳng (flat filename, không chứa `/` hay `\`) trong thư mục thuộc quyền sở hữu riêng của tiến trình. Xem thêm [nodejs-apis.md](nodejs-apis.md#35-atomic-replacement-durability--race).

### 3.3 Archive extraction (Zip Slip / Tar Slip) & tệp tạm

Giải nén tệp `.zip` / `.tar.gz` từ người dùng ẩn chứa cùng lúc 3 nhóm lỗ hổng:
1. **Zip Slip / Tar Slip:** Tên entry chứa `../../.ssh/authorized_keys` hoặc đường dẫn tuyệt đối `/etc/cron.d/pwn`.
2. **Symlink / Hardlink attack trong archive:** Entry 1 tạo symlink `out/a -> /etc`, Entry 2 ghi `out/a/passwd` → ghi đè file hệ thống dù mọi đường dẫn đều trông hợp lệ!
3. **Zip Bomb (decompression bomb):** Tệp 100 KB chứa toàn byte 0 nén lại, giải nén ra hàng chục GB làm cạn đĩa hoặc OOM.

**Quy tắc bắt buộc khi giải nén untrusted archive:**
- Kiểm tra mọi entry qua `resolveInside(extractDir, entry.name)` **trước khi ghi**.
- **Từ chối tuyệt đối** mọi entry loại `SymbolicLink`, `Link` (hardlink), `FIFO`, `BlockDevice`, `CharacterDevice` — chỉ chấp nhận `File` và `Directory`.
- Đặt **3 ngưỡng cứng** tính trên dữ liệu thực tế:
  - `maxEntries` (ví dụ ≤ 1.000 file)
  - `maxEntryBytes` (kích thước tối đa từng file)
  - `maxTotalUncompressedBytes` (tổng byte thực ghi tích lũy, **không** tin trường header kích thước bên trong file zip vì attacker có thể giả mạo) và `maxCompressionRatio` (ví dụ ≤ 100:1).
- Tạo thư mục tạm riêng bằng **`fs.mkdtemp(path.join(os.tmpdir(), "app-extract-"))`** (quyền `0700` trên POSIX) và luôn dọn trong `finally` / `AsyncDisposableStack` — **không** tự tạo tên tệp tạm đoán được trong `/tmp` (tránh symlink pre-creation attack trong thư mục công cộng).

---

## 4. Outbound HTTP & SSRF

**SSRF (Server-Side Request Forgery)** xảy ra khi server thực hiện request mạng (`fetch`, `http.request`, webhook delivery, tải ảnh đại diện, PDF renderer) tới một URL do người dùng kiểm soát. Kẻ tấn công lợi dụng vị trí mạng của server để truy cập:
- Cloud instance metadata (`169.254.169.254` trên AWS/GCP/Azure, `fd00:ec2::254`, `metadata.google.internal`) → đánh cắp IAM role credentials.
- Dịch vụ nội bộ không có xác thực trên loopback (`127.0.0.1:6379` Redis, `localhost:9200` Elasticsearch, admin API nội bộ).
- Mạng private (RFC1918 / Kubernetes ClusterIP / pod network).

### 4.1 URL parsing, Allowlist & Danh sách CIDR nội bộ

Kiểm tra cú pháp `new URL(input)` chỉ chứng minh chuỗi hợp lệ theo WHATWG URL Standard, **không** chứng minh đích đến an toàn. Các bước kiểm tra tầng URL:

1. **Scheme allowlist:** Chỉ cho phép `https:` (hoặc `http:` nếu thực sự cần). Chặn tuyệt đối `file:`, `gopher:`, `ftp:`, `data:`, `javascript:`.
2. **Từ chối credentials trong URL:** Kiểm tra `url.username !== "" || url.password !== ""` (tránh nhầm lẫn parser như `https://allowed.com@127.0.0.1/`).
3. **Port allowlist:** Chỉ cho phép port `443` (hoặc `""` mặc định), tránh bị lợi dụng quét port nội bộ (`:6379`, `:2375`, `:8080`).
4. **Domain allowlist** (khi nghiệp vụ cho phép): Nếu chỉ tích hợp với vài đối tác cố định, khớp chính xác `url.hostname` với danh sách cho phép là phòng thủ mạnh nhất.
5. **Chặn toàn bộ dải IP không công khai (Non-global CIDR):** Nếu bắt buộc gọi tới domain tùy ý (ví dụ webhook khách hàng), phải kiểm tra **mọi IP sau khi phân giải DNS**, bao gồm **IPv4**, **IPv6** và đặc biệt là **IPv4-mapped IPv6** (`::ffff:127.0.0.1`, `::ffff:169.254.169.254`, dạng hex `::ffff:7f00:1`)!

| Dải IP / CIDR | Ý nghĩa | Ghi chú rủi ro SSRF |
|---|---|---|
| `0.0.0.0/8` | "This host on this network" | Trên Linux, `http://0.0.0.0/` kết nối trực tiếp tới `127.0.0.1`! |
| `127.0.0.0/8` | IPv4 Loopback | Dịch vụ nội bộ máy chủ (`127.0.0.1` .. `127.255.255.254`) |
| `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` | Private RFC 1918 | Mạng nội bộ VPC, DB, K8s cluster |
| `169.254.0.0/16` | Link-local / Cloud Metadata | AWS IMDS (`169.254.169.254`), GCP, Azure, DigitalOcean |
| `100.64.0.0/10` | Shared Address Space / CGNAT (RFC 6598) | Tailscale, Alibaba Cloud metadata (`100.100.100.200`), AWS EKS/VPC phụ |
| `192.0.0.0/24`, `192.0.2.0/24`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24` | IETF protocol / Benchmark / TEST-NET | Không phải địa chỉ public thực trên Internet |
| `224.0.0.0/4`, `240.0.0.0/4` | Multicast & Reserved (`255.255.255.255`) | Không hợp lệ cho outbound HTTP |
| `::/128`, `::1/128` | IPv6 Unspecified & Loopback | Tương đương `0.0.0.0` và `127.0.0.1` |
| `fc00::/7` (`fc00::` – `fdff::`) | IPv6 Unique Local (ULA) | Mạng nội bộ IPv6 + AWS IPv6 IMDS (`fd00:ec2::254`) |
| `fe80::/10` | IPv6 Link-local | Giao diện mạng nội bộ cục bộ |
| `ff00::/8` | IPv6 Multicast | Không hợp lệ cho outbound HTTP |
| **`::ffff:0:0/96`** | **IPv4-mapped IPv6** | **Bẫy phổ biến nhất!** Phải giải trích 32-bit IPv4 bên trong rồi áp dụng toàn bộ luật IPv4 ở trên |
| `64:ff9b::/96`, `2002::/16` | NAT64 & 6to4 | Có thể nhúng địa chỉ IPv4 nội bộ vào phần đuôi IPv6 |

### 4.2 Chống DNS Rebinding (TOCTOU) bằng Undici custom lookup

Một sai lầm cực kỳ phổ biến là gọi `dns.lookup(url.hostname)` kiểm tra IP an toàn, rồi sau đó gọi `fetch(url)`. Đây là lỗ hổng **DNS Rebinding (TOCTOU)**:
1. Lần lookup 1 (trong hàm kiểm tra): DNS server của attacker trả về IP public `93.184.216.34` với `TTL = 0` → vượt qua kiểm tra.
2. Lần lookup 2 (bên trong `fetch()`): DNS server của attacker trả về `169.254.169.254` → `fetch()` kết nối thẳng vào metadata server!

**Giải pháp đúng trên Node 26 (Undici 8):** Chặn ở tầng **kết nối thực sự** bằng cách truyền custom `connect.lookup` vào `undici.Agent` (dùng làm `dispatcher` của `fetch`). Khi socket mở kết nối TCP, chính hàm `lookup` này vừa phân giải, vừa lọc toàn bộ bản ghi IP qua `isBlockedIp()`, và trả trực tiếp địa chỉ IP đã xác thực cho socket kết nối — loại bỏ hoàn toàn bước lookup thứ hai. Đồng thời, dùng **`redirect: "error"`** (hoặc tự theo dõi redirect từng hop có giới hạn tối đa) và đếm **response bytes thực đọc**:

```ts
import dns from "node:dns";
import net from "node:net";
import { Agent } from "undici"; // Node 26 dùng Undici 8 làm nền cho global fetch

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // 0/8, 10/8, 127/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 169 && b === 254) return true;           // 169.254.0.0/16 (Link-local / IMDS)
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
  if (a === 192 && b === 168) return true;           // 192.168.0.0/16
  if (a === 192 && b === 0) return true;             // 192.0.0.0/24, 192.0.2.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a >= 224) return true;                         // Multicast & Reserved
  return false;
}

function extractMappedIpv4(ipv6: string): string | null {
  const lower = ipv6.toLowerCase();
  const dotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return dotted[1];
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  return null;
}

function isBlockedIp(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version !== 6) return true;

  const lower = address.toLowerCase().split("%")[0]; // Bỏ zone index nếu có
  const mappedV4 = extractMappedIpv4(lower);
  if (mappedV4) return isBlockedIpv4(mappedV4);

  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 (ULA + AWS IPv6 IMDS)
  if (/^fe[89ab]/.test(lower)) return true;                          // fe80::/10 (Link-local)
  if (lower.startsWith("ff")) return true;                           // ff00::/8 (Multicast)
  if (lower.startsWith("64:ff9b:") || lower.startsWith("2002:")) return true; // NAT64 / 6to4
  return false;
}

// Pin IP đã xác thực ngay trong pha kết nối của Undici Agent (chống DNS Rebinding).
const ssrfSafeAgent = new Agent({
  connections: 32,
  connectTimeout: 5_000,
  headersTimeout: 10_000,
  bodyTimeout: 15_000,
  connect: {
    lookup(hostname, options, callback) {
      // Đọc toàn bộ bản ghi DNS, kiểm tra từng IP và chỉ trả về IP hợp lệ cho socket thực.
      dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, "");
        if (!Array.isArray(addresses) || addresses.length === 0) {
          return callback(new Error("DNS returned no addresses"), "");
        }
        for (const entry of addresses) {
          if (isBlockedIp(entry.address)) {
            return callback(new Error(`SSRF blocked target IP: ${entry.address}`), "");
          }
        }
        if (options.all) {
          return callback(null, addresses);
        }
        return callback(null, addresses[0].address, addresses[0].family);
      });
    },
  },
});

async function safeFetchBytes(rawUrl: string, maxBytes = 1024 * 1024): Promise<Uint8Array> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new RangeError("only https allowed");
  if (url.username || url.password) throw new RangeError("credentials in URL disallowed");
  if (url.port && url.port !== "443") throw new RangeError("non-443 port disallowed");

  const res = await fetch(url, {
    dispatcher: ssrfSafeAgent,
    redirect: "error", // Nếu cần hỗ trợ redirect, chuyển sang "manual" và lặp kiểm tra tối đa 3 hop
    signal: AbortSignal.timeout(15_000),
  } as RequestInit);

  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`upstream status ${res.status}`);
  }
  if (!res.body) return new Uint8Array();

  // Không tin header Content-Length — luôn đếm bytes thực đọc từ stream.
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of res.body) {
    total += chunk.byteLength;
    if (total > maxBytes) {
      await res.body.cancel();
      throw new RangeError("response body exceeds budget");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}
```

> **Lưu ý về redirect:** Nếu đặt `redirect: "follow"` mặc định, kẻ tấn công chỉ cần trỏ tới server public `https://evil.com/r` trả về `302 Location: http://169.254.169.254/latest/meta-data/`. Khi dùng `ssrfSafeAgent` ở trên, IP nội bộ vẫn bị chặn ở tầng lookup, **nhưng** vẫn phải dùng `redirect: "error"` (hoặc `"manual"` + kiểm tra lại protocol/port/strip header `Authorization`/`Cookie` trên mỗi hop) để tránh downgrade từ `https:` sang `http:` hay rò header nhạy cảm sang origin khác.

### 4.3 Khác biệt Node `fetch` vs Browser (CORS, TLS & Egress Proxy)

- **Node `fetch` không áp dụng CORS như ranh giới bảo mật:** Trên trình duyệt, CORS ngăn trang web độc hại đọc response cross-origin kèm cookie của người dùng. Trên Node.js, tiến trình server **là** người khởi tạo request; tùy chọn `mode: "cors"` không ngăn server đọc response từ mạng nội bộ. Tham khảo [Undici fetch notes](https://github.com/nodejs/undici#cors).
- **HTTPS/TLS không chống được SSRF:** Một dịch vụ nội bộ hoàn toàn có thể có chứng chỉ TLS hợp lệ (Let's Encrypt hoặc internal CA). TLS chỉ xác thực *tôi đang nói chuyện đúng với host X*, không trả lời *host X có được phép cho user gọi hay không*.
- **Phòng thủ nhiều lớp bằng Egress Proxy / Network Policy:** Trong môi trường production nghiêm ngặt (webhook platform, crawler, AI tool runner), đừng chỉ dựa vào filter trong code Node.js. Hãy đưa toàn bộ outbound untrusted traffic đi qua một **egress proxy chuyên dụng** (hoặc Kubernetes `NetworkPolicy` / VPC firewall) chặn mọi gói tin tới RFC1918, loopback và metadata endpoint ở tầng mạng, đồng thời bật **AWS IMDSv2** (yêu cầu `PUT` token + hop limit = 1).

---

## 5. Web/API boundary: Auth, JWT, Cookies, CSRF, CORS & Headers

Mọi ứng dụng web/API trên Node.js đều phơi bày bề mặt tấn công HTTP. Phần lớn sự cố chiếm tài khoản (account takeover) bắt nguồn từ cấu hình sai JWT, cookie, CORS hoặc quên bảo vệ chống CSRF.

### 5.1 JWT & Session Tokens

JWT (JSON Web Token) là cấu trúc tự chứa có chữ ký — **không** mã hóa bí mật (payload chỉ là Base64URL, ai cũng đọc được trừ khi dùng JWE). Những lỗ hổng nghiêm trọng nhất với JWT:

| Lỗ hổng JWT | Cơ chế khai thác | Cách phòng thủ bắt buộc |
|---|---|---|
| **`alg: "none"`** | Attacker sửa header thành `{"alg":"none"}` và bỏ chữ ký | Luôn truyền danh sách **`algorithms`** cố định từ phía server (ví dụ `["EdDSA"]` hoặc `["ES256"]`); không bao giờ lấy `alg` từ header token |
| **Algorithm Confusion (RS256 → HS256)** | Server dùng public key RSA để verify, nhưng thư viện chấp nhận `HS256` → attacker ký HMAC bằng chính **public key** công khai của server! | Pin cứng thuật toán bất đối xứng (`algorithms: ["RS256"]` hoặc `["EdDSA"]`) và dùng đúng đối tượng `KeyObject` tương ứng |
| **Thiếu kiểm `iss` / `aud` / `exp` / `nbf`** | Dùng token của dịch vụ A (hoặc token đã hết hạn) để gọi dịch vụ B | Bắt buộc kiểm `issuer`, `audience`, `exp`, `nbf` với clock tolerance nhỏ (ví dụ ≤ 5–30 giây) |
| **Header injection (`jku`, `x5u`, `kid`)** | `kid: "../../dev/null"` khiến server đọc file rỗng làm khóa; `jku` trỏ sang JWKS server của attacker (SSRF!) | Chỉ đọc JWKS từ URL allowlist cứng phía server; `kid` chỉ dùng để tra `Map` trong bộ key đã tải |
| **Không thể thu hồi (Revocation)** | JWT còn hạn vẫn hợp lệ sau khi user logout, đổi mật khẩu hoặc bị khóa tài khoản | Giữ **access token rất ngắn hạn** (5–15 phút) + refresh token rotation lưu ở server, hoặc dùng **opaque session token** |

**JWT vs Opaque Session Token — chọn gì?**
- **Opaque Session Token** (chuỗi 32 byte ngẫu nhiên từ `crypto.randomBytes(32).toString("base64url")`, lưu hash SHA-256 của token trong Redis/DB): Mặc định **nên chọn** cho web app truyền thống hoặc BFF. Thu hồi tức thì (logout, khóa user, đổi mật khẩu), không phình kích thước cookie, không lộ thông tin user trong token.
- **Stateless JWT** (ưu tiên `EdDSA` hoặc `ES256` qua thư viện chuẩn như `jose`): Phù hợp cho service-to-service (OAuth2/OIDC, federated identity) hoặc access token cực ngắn hạn khi cần xác thực tại edge mà không chạm DB trung tâm.

### 5.2 Cookies, Session Fixation, CSRF & CORS

**Cấu hình Cookie phiên an toàn**
Mỗi cookie phiên (session cookie) trên production phải đặt đầy đủ thuộc tính sau:

```ts
// Cookie phiên chuẩn: tiền tố __Host- buộc trình duyệt chỉ chấp nhận nếu có Secure, Path=/, và KHÔNG có Domain.
const cookieHeader = [
  `__Host-sid=${sessionToken}`,
  "Path=/",
  "HttpOnly",       // Chặn document.cookie (giảm tác hại XSS)
  "Secure",         // Chỉ gửi qua HTTPS
  "SameSite=Lax",   // Chặn phần lớn CSRF cross-site mà không làm gãy link điều hướng GET
  "Max-Age=28800",  // Hạn mức tuyệt đối (8 giờ)
].join("; ");
```

- **Session Fixation:** Sau mọi sự kiện thay đổi mức đặc quyền (đăng nhập, bật 2FA, nâng quyền admin), **bắt buộc hủy session ID cũ và cấp session ID mới** (regenerate/rotate) để tránh kẻ tấn công gài sẵn ID phiên trước khi nạn nhân đăng nhập.
- **SameSite=Strict vs Lax:** Dùng `SameSite=Strict` cho portal quản trị nội bộ/ngân hàng; `SameSite=Lax` cho ứng dụng web công cộng cần mở link từ email/OAuth callback.

**Phòng chống CSRF (Cross-Site Request Forgery)**
CSRF chỉ xảy ra khi trình duyệt **tự động đính kèm** chứng thực (cookie, HTTP Basic Auth, client cert). API chỉ nhận `Authorization: Bearer <token>` từ header JS (không lưu ở cookie) miễn nhiễm với CSRF truyền thống (nhưng lại nhạy cảm hơn với XSS nếu lưu token ở `localStorage`).

Với ứng dụng dùng cookie phiên, kết hợp nhiều lớp:
1. **Không bao giờ** thay đổi trạng thái (state mutation) trong method `GET` / `HEAD` / `OPTIONS`.
2. Đặt `SameSite=Lax` (hoặc `Strict`).
3. **Kiểm tra Fetch Metadata & Origin (`Sec-Fetch-Site` / `Origin`)** ngay tại middleware cho mọi request thay đổi trạng thái (`POST`, `PUT`, `PATCH`, `DELETE`):

```ts
import type { IncomingMessage } from "node:http";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function assertSameOriginCsrf(req: IncomingMessage, allowedOrigin: string): void {
  if (SAFE_METHODS.has(req.method ?? "GET")) return;

  // Lớp 1: Fetch Metadata (mọi trình duyệt hiện đại đều gửi và JS không thể giả mạo)
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite === "cross-site") {
    throw new Error("CSRF blocked: cross-site request");
  }

  // Lớp 2: Kiểm tra Origin (fallback khi thiếu Sec-Fetch-Site hoặc môi trường đặc thù)
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== allowedOrigin) {
    throw new Error("CSRF blocked: origin mismatch");
  }

  // Lớp 3 (khuyến nghị bổ sung cho form HTML truyền thống):
  // Kiểm tra CSRF token chống giả mạo gắn với session (synchronizer token) bằng timingSafeEqual.
}
```

**Cấu hình CORS an toàn**
CORS là cơ chế **nới lỏng** Same-Origin Policy của trình duyệt — cấu hình sai sẽ biến ứng dụng thành mở cửa cho mọi trang web độc hại đọc dữ liệu nhạy cảm kèm cookie của nạn nhân!

```ts
// CỰC KỲ NGUY HIỂM (SAI): phản chiếu mù quáng Origin kèm Credentials=true!
// Mọi website (https://evil.example) đều gọi fetch() có cookie và ĐỌC ĐƯỢC dữ liệu cá nhân của nạn nhân.
// res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
// res.setHeader("Access-Control-Allow-Credentials", "true");

// ĐÚNG: chỉ khớp chính xác Origin trong Set allowlist tĩnh và luôn thêm Vary: Origin.
const ALLOWED_ORIGINS = new Set([
  "https://app.example.com",
  "https://admin.example.com",
]);

function applyCors(req: IncomingMessage, res: { setHeader(k: string, v: string): void }): void {
  const origin = req.headers.origin;
  res.setHeader("Vary", "Origin");
  if (typeof origin === "string" && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token");
  }
}
```

- **Bẫy substring/regex trên `Origin`:** `origin.endsWith("example.com")` bị qua mặt bởi `https://evil-example.com`; `origin.startsWith("https://example.com")` bị qua mặt bởi `https://example.com.evil.net`. **Chỉ dùng khớp chính xác** (exact string match trong `Set`).
- **Bẫy `Origin: null`:** Không bao giờ đưa `"null"` vào `ALLOWED_ORIGINS` (iframe sandboxed gửi `Origin: null`).

### 5.3 Security Headers & Error Exposure

| Header HTTP | Giá trị khuyến nghị | Tác dụng bảo mật |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Bắt buộc trình duyệt chỉ kết nối HTTPS (chống downgrade/SSL stripping) |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` (cho API JSON) hoặc chính sách nonce-based nghiêm ngặt (cho HTML) | Giảm thiểu XSS, chặn nhúng iframe clickjacking |
| `X-Content-Type-Options` | `nosniff` | Ngăn trình duyệt đoán MIME type (chặn chạy file ảnh/text upload như JS/HTML) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` hoặc `no-referrer` | Tránh rò token/ID trong đường dẫn URL qua header `Referer` sang bên thứ ba |
| `Cross-Origin-Opener-Policy` | `same-origin` | Cách ly browsing context chống tấn công cross-origin window/Spectre |
| `Cache-Control` (dữ liệu riêng tư) | `no-store` | Ngăn proxy/trình duyệt lưu cache thông tin nhạy cảm (`/me`, billing, token) |

**Ẩn thông tin nội bộ & Error Exposure:**
- Tắt `X-Powered-By` (Express bật mặc định) và không trả về phiên bản Node/DB trong header.
- Không bao giờ trả `err.stack`, câu lệnh SQL, đường dẫn file server (`C:\...` hoặc `/var/app/...`) hay lỗi raw từ driver về client. Log chi tiết đầy đủ vào structured logger phía server kèm `requestId`, còn client chỉ nhận thông điệp tổng quát + `requestId` để đối chiếu. Xem thêm mẫu ánh xạ lỗi ra HTTP tại [exceptions.md](exceptions.md#14-map-lỗi--http-status).

---

## 6. Secrets, Cryptography, TLS & Resource Budgets

Nguyên tắc vàng mật mã học: **không bao giờ tự thiết kế thuật toán hoặc giao thức crypto**. Luôn dùng primitive chuẩn sẵn có trong `node:crypto` (OpenSSL 3.5 trên Node 26) với tham số được cộng đồng mật mã khuyến nghị.

### 6.1 Password Hashing (`crypto.argon2` & `crypto.scrypt` trên Node 26)

Tuyệt đối **không** dùng `SHA-256`, `SHA-512`, `MD5` hay HMAC để lưu mật khẩu — chúng được thiết kế để chạy cực nhanh (hàng tỷ phép băm/giây trên GPU). Phải dùng **Memory-Hard Password KDF**:

- **Ưu tiên 1 trên Node 26: `crypto.argon2` (`argon2id`)** — tích hợp sẵn trong `node:crypto` (nhờ OpenSSL 3.2+/3.5, không còn cần native addon ngoài như `argon2` C++!). Theo khuyến nghị OWASP Password Storage Cheat Sheet: `argon2id`, bộ nhớ tối thiểu 19 MiB–64 MiB (`memory` tính theo KiB), `passes` (iterations) ≥ 2–3, `parallelism: 1`, `nonce` (salt) ngẫu nhiên ≥ 16 bytes.
- **Phương án 2 (tương thích Node 18/20/22/24): `crypto.scrypt`** — luôn truyền `salt` ngẫu nhiên ≥ 16 bytes, `N >= 16384` (khuyến nghị `N = 32768` hoặc `131072` tùy tải), `r = 8`, `p = 1`, và đặt `maxmem` đủ lớn (`> 128 * N * r`).

```ts
import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const argon2Async = promisify(argon2);

// Cấu hình mặc định an toàn cho server Node 26 (OpenSSL 3.5): Argon2id, 64 MiB RAM, 3 lượt.
const ARGON2_PARAMS = {
  memory: 65_536, // KiB = 64 MiB
  passes: 3,
  parallelism: 1,
  tagLength: 32,
} as const;

// Giới hạn độ dài password hợp lý (chống DoS CPU/RAM khi attacker gửi password 10 MB).
const MAX_PASSWORD_BYTES = 1024;

export async function hashPassword(password: string): Promise<string> {
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw new RangeError("password too long");
  }
  const nonce = randomBytes(16);
  const derived = await argon2Async("argon2id", {
    message: password,
    nonce,
    ...ARGON2_PARAMS,
  });
  // Lưu kèm đầy đủ tham số để sau này có thể tăng độ khó & rehash dần khi user đăng nhập.
  return `$argon2id$m=${ARGON2_PARAMS.memory},t=${ARGON2_PARAMS.passes},p=${ARGON2_PARAMS.parallelism}$${nonce.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) return false;
  const parts = encoded.split("$");
  // Format: ["", "argon2id", "m=...,t=...,p=...", "<salt>", "<hash>"]
  if (parts.length !== 5 || parts[1] !== "argon2id") return false;

  const match = /^m=(\d+),t=(\d+),p=(\d+)$/.exec(parts[2]);
  if (!match) return false;
  const memory = Number(match[1]);
  const passes = Number(match[2]);
  const parallelism = Number(match[3]);
  const nonce = Buffer.from(parts[3], "base64url");
  const expected = Buffer.from(parts[4], "base64url");

  const actual = await argon2Async("argon2id", {
    message: password,
    nonce,
    memory,
    passes,
    parallelism,
    tagLength: expected.length,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

**Lưu ý vận hành cực quan trọng cho `argon2` / `scrypt`:**
- Cả hai hàm async đều chạy trên **libuv threadpool** (mặc định chỉ có 4 luồng, `UV_THREADPOOL_SIZE`), tranh chấp trực tiếp với `fs` và `dns.lookup`! Nếu kẻ tấn công gửi 100 request `/login` đồng thời, toàn bộ file I/O và DNS của server có thể bị nghẽn và RAM tăng vọt (`100 × 64 MiB ≈ 6.4 GiB` → OOM!).
- **Bắt buộc:** áp dụng rate limiting theo IP/account **và** giới hạn concurrency (ví dụ semaphore tối đa 2–4 phép hash chạy song song trên mỗi tiến trình). Xem thêm [event-loop.md](event-loop.md) và [async.md](async.md).

### 6.2 `timingSafeEqual`, HMAC & Authenticated Encryption (AES-256-GCM)

**So sánh hằng thời gian (`timingSafeEqual`) khi khác độ dài**
`crypto.timingSafeEqual(a, b)` ném `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` nếu hai buffer khác độ dài. Nếu bạn viết `if (a.length !== b.length) return false; return timingSafeEqual(a, b);` cho một secret tĩnh (API key, webhook token), kẻ tấn công có thể đo thời gian trả về sớm để suy ra **độ dài bí mật**. Để loại bỏ cả rò rỉ độ dài, hãy băm chuẩn hóa cả hai đầu vào bằng HMAC với một khóa ngẫu nhiên sinh một lần cho mỗi phép so sánh:

```ts
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function safeEqualStrings(a: string, b: string): boolean {
  const ephemeralKey = randomBytes(32);
  const macA = createHmac("sha256", ephemeralKey).update(a, "utf8").digest();
  const macB = createHmac("sha256", ephemeralKey).update(b, "utf8").digest();
  // macA và macB luôn đúng 32 bytes → không bao giờ ném lỗi length và không rò độ dài chuỗi.
  return timingSafeEqual(macA, macB);
}
```

**Xác thực Webhook Signature + chống Replay**
Luôn tính HMAC trên **raw body bytes** (chưa qua `JSON.parse` + `JSON.stringify`, vì thay đổi khoảng trắng hay thứ tự key sẽ làm hỏng chữ ký) và kiểm tra timestamp trong cửa sổ dung sai (ví dụ ±5 phút):

```ts
export function verifyWebhookSignature(
  rawBody: Buffer,
  timestampHeader: string,
  signatureHex: string,
  secret: string,
  maxSkewSec = 300,
): boolean {
  const ts = Number(timestampHeader);
  if (!Number.isSafeInteger(ts)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > maxSkewSec) return false; // Chống replay attack

  const expected = createHmac("sha256", secret)
    .update(`${ts}.`)
    .update(rawBody)
    .digest();

  const received = Buffer.from(signatureHex, "hex");
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}
```

**Mã hóa có xác thực (AEAD — `aes-256-gcm`)**
Khi cần mã hóa dữ liệu bí mật (ví dụ OAuth token lưu trong DB), **không** dùng AES-ECB (lộ mẫu dữ liệu) hoặc AES-CBC không có MAC (dễ bị padding oracle / sửa đổi ciphertext). Luôn dùng **AEAD** như **`aes-256-gcm`** với:
- Khóa 32 bytes (`256-bit`) sinh từ nguồn CSPRNG (`randomBytes(32)`) hoặc KMS.
- **IV (nonce) 12 bytes (96-bit) duy nhất cho mỗi lần mã hóa với cùng một khóa** — tái sử dụng cùng `(key, iv)` trên AES-GCM làm sụp đổ hoàn toàn tính bí mật lẫn tính toàn vẹn!
- **AAD (Additional Authenticated Data)** để ràng buộc ngữ cảnh (ví dụ `tenantId:recordId`) chống tráo ciphertext giữa hai bản ghi DB.
- **Luôn gọi `decipher.final()` (xác thực `authTag`) trước khi sử dụng bất kỳ byte plaintext nào.**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function encryptAesGcm(plaintext: Buffer, key32: Buffer, aad: string): Buffer {
  if (key32.length !== 32) throw new RangeError("AES-256 key must be 32 bytes");
  const iv = randomBytes(12); // Bắt buộc 96-bit duy nhất cho mỗi bản mã
  const cipher = createCipheriv("aes-256-gcm", key32, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes
  // Đóng gói: [12B IV][16B AuthTag][Ciphertext...]
  return Buffer.concat([iv, tag, encrypted]);
}

export function decryptAesGcm(payload: Buffer, key32: Buffer, aad: string): Buffer {
  if (key32.length !== 32) throw new RangeError("AES-256 key must be 32 bytes");
  if (payload.length < 28) throw new RangeError("ciphertext too short");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", key32, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  // final() ném lỗi nếu ciphertext, IV, tag hoặc AAD bị sửa dù chỉ 1 bit.
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
```

- **Token ngẫu nhiên:** Luôn dùng `crypto.randomBytes()` hoặc `crypto.randomUUID()`; tuyệt đối không dùng `Math.random()` cho session ID, reset token, CSRF token hay API key (PRNG xorshift128+ của V8 có thể đoán ngược trạng thái chỉ từ vài mẫu đầu ra).

### 6.3 TLS, Secrets Redaction & Resource Budgets (DoS)

**TLS & Certificate Store trên Node 26**
- **Tuyệt đối không** đặt `NODE_TLS_REJECT_UNAUTHORIZED=0` hoặc `rejectUnauthorized: false` để "chữa cháy" lỗi chứng chỉ ở staging/production — nó biến HTTPS thành kết nối dễ bị nghe lén/giả mạo (MITM).
- Khi doanh nghiệp dùng CA nội bộ (corporate proxy / private PKI), hãy truyền `NODE_EXTRA_CA_CERTS=/path/to/corp-ca.pem` hoặc dùng cờ **`--use-system-ca`** (có sẵn trên Node 26) để Node tin cậy kho CA chuẩn của hệ điều hành (Windows Certificate Store, macOS Keychain, Linux system store).
- Kiểm tra `minVersion: "TLSv1.2"` (hoặc `"TLSv1.3"` nếu client cho phép) khi tự tạo TLS server. Xem [Node.js TLS docs](https://nodejs.org/api/tls.html).

**Secrets Redaction & Diagnostics Hygiene**
Bí mật rất dễ rò rỉ gián tiếp qua công cụ quan sát (observability):
- **Structured logs:** Redact tập trung ở serializer của logger (ví dụ Pino `redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.token", "*.apiKey"]`). Không bao giờ truyền secret/token qua query string URL (`?api_key=...`) vì nó lọt vào access log của reverse proxy, CDN và browser history.
- **Diagnostic reports & heap snapshots:** `process.report.writeReport()` chứa toàn bộ `process.env`; heap snapshot chứa plaintext mật khẩu, private key, session token đang nằm trong bộ nhớ. Phân quyền lưu trữ ngang tầm secrets và tẩy xóa trước khi chia sẻ ra ngoài. Xem [diagnostics.md](diagnostics.md).

**Resource Budgets (Chống Denial of Service)**
Mọi tài nguyên không có trần (unbounded) đều là vector DoS. Bảng ngân sách tối thiểu cho một dịch vụ Node.js:

| Nguồn tiêu hao | Tham số / Kỹ thuật kiểm soát | Bẫy thường gặp |
|---|---|---|
| **HTTP ingress** | `server.headersTimeout`, `server.requestTimeout`, `server.keepAliveTimeout`, `maxHeaderSize`, giới hạn body bytes thực đọc, rate limit & concurrency cap | `Content-Length` do client tự khai — có thể nói dối hoặc dùng `Transfer-Encoding: chunked` không gửi header này |
| **JSON & Parser** | Chặn byte body trước khi gọi `JSON.parse`, giới hạn độ sâu lồng nhau (nesting depth) và số lượng phần tử mảng | `JSON.parse` chạy đồng bộ trên main thread; payload 20 MB lồng sâu có thể khóa event loop hàng trăm ms |
| **Regex / CPU sync** | Cap độ dài chuỗi input, tránh backtracking, dùng RE2 hoặc Worker có watchdog | **`AbortSignal.timeout` KHÔNG thể ngắt** lệnh đồng bộ đang chiếm CPU (`JSON.parse`, vòng lặp, regex) — callback timeout chỉ chạy khi event loop rảnh! |
| **Compression (gzip/br/zstd)** | Dùng `zlib` stream với `maxOutputLength` và bộ đếm bytes thực giải nén | Một gói gzip vài KB có thể bung thành hàng GB (zip bomb) nếu chỉ giới hạn compressed bytes |
| **Outbound HTTP & DB** | `connectTimeout`, `headersTimeout`, `bodyTimeout`, tổng deadline (`AbortSignal.timeout`), giới hạn `connections` pool và retry budget | Quên consume hoặc `res.body.cancel()` làm rò socket trong Undici pool |
| **Streams & Queues** | Backpressure chuẩn qua `stream/promises` `pipeline()`, đặt cap cho in-memory queue (`maxQueueSize`) | `highWaterMark` chỉ là ngưỡng gợi ý backpressure, **không phải** hard cap RAM |
| **Workers / Child process** | Cap số worker/tiến trình đồng thời, `maxBuffer`, giới hạn memory/CPU ở OS/container (cgroups) | Spawn 1 child process/worker cho mỗi HTTP request dễ dẫn đến cạn PID/RAM |

```ts
import http from "node:http";

// Đọc body an toàn: không tin Content-Length, luôn đếm bytes thực nhận & hủy sớm.
async function readBoundedBody(req: http.IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let received = 0;

  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer);
    received += buf.byteLength;
    if (received > maxBytes) {
      req.destroy();
      throw new RangeError("payload too large");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks, received);
}

// Cấu hình HTTP server cứng chống Slowloris & kết nối treo:
const server = http.createServer({ maxHeaderSize: 16_384 }, async (req, res) => {
  try {
    const body = await readBoundedBody(req, 64 * 1024); // 64 KiB
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ bytes: body.byteLength }));
  } catch (err) {
    const status = err instanceof RangeError ? 413 : 400;
    if (!res.headersSent) res.writeHead(status);
    res.end();
  }
});
server.headersTimeout = 10_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;
```

---

## 7. Permission model, isolation và supply chain

Bảo mật không dừng lại ở code nghiệp vụ: bản thân tiến trình Node.js và hàng trăm package bên thứ ba trong `node_modules` cũng là bề mặt tấn công lớn.

### 7.1 Node 26 Permission Model thực chiến

Permission Model (ổn định từ Node 22.13+/24 và mở rộng đầy đủ trên Node 26) cho phép áp dụng nguyên tắc **đặc quyền tối thiểu (least privilege)** ở cấp tiến trình: mọi tài nguyên không được cấp quyền rõ ràng sẽ bị chặn với `ERR_ACCESS_DENIED`.

| Cờ CLI (Node 26) | Quyền được kiểm soát | Ghi chú sử dụng |
|---|---|---|
| `--permission` | Kích hoạt chế độ cưỡng chế (enforce) Permission Model | Khi bật mà không kèm `--allow-*`, tiến trình bị khóa toàn bộ FS/Child/Worker/Addon/Net/FFI/WASI/Inspector |
| `--permission-audit` | Chế độ **kiểm toán (audit-only)** — ghi log truy cập trái phép thay vì chặn | Dùng ở pha 1 (staging/canary) để khám phá danh sách quyền thật trước khi siết chặt |
| `--allow-fs-read=<paths>` | Cho phép đọc các đường dẫn/thư mục phân tách bằng dấu phẩy (`*` là toàn bộ) | Đường dẫn tương đối được resolve theo CWD tại thời điểm khởi chạy; bao gồm cả nơi chứa code/node_modules cần load |
| `--allow-fs-write=<paths>` | Cho phép ghi các đường dẫn/thư mục chỉ định | Nên khoanh hẹp tối đa (ví dụ chỉ `./tmp`, `./uploads`) |
| `--allow-net` | Cho phép mở kết nối mạng (TCP/UDP/HTTP/fetch) | Rất hữu ích để chạy CLI/build script hoàn toàn offline (cấm exfiltration) |
| `--allow-child-process` | Cho phép gọi `node:child_process` (`spawn`, `execFile`, `fork`) | Tắt mặc định giúp triệt tiêu hậu quả nếu dính command injection |
| `--allow-worker` | Cho phép tạo `node:worker_threads` | Chỉ bật khi ứng dụng thực sự dùng worker |
| `--allow-addons` | Cho phép nạp native C++ addons (`.node`) | Native addon chạy ngoài V8 nên có thể vượt mọi kiểm soát của JS |
| `--allow-wasi` | Cho phép khởi chạy WASI (`node:wasi`) | Tắt mặc định nếu không chạy WASI |
| `--allow-ffi` | Cho phép gọi Foreign Function Interface (`node:ffi`) | Cực kỳ nhạy cảm tương đương native addon — tuyệt đối không bật nếu không dùng |
| `--allow-inspector` | Cho phép bật V8 Inspector / debugger | Chặn mở cổng debug trái phép trong môi trường nhạy cảm |

**Quy trình triển khai 2 pha: Audit → Enforce + Hạ quyền động (`process.permission.drop()`)**

1. **Pha 1 — Audit:** Chạy test tích hợp hoặc canary với `--permission-audit` để thu thập chính xác những tài nguyên tiến trình cần.
2. **Pha 2 — Enforce:** Chuyển sang `--permission` kèm tập `--allow-*` tối thiểu.
3. **Hạ quyền sau khi khởi động (`process.permission.drop()`):** Một ứng dụng thường chỉ cần đọc file chứng chỉ/config lúc khởi động (boot), sau đó không bao giờ cần đọc lại thư mục `/etc/app-secrets` hay tạo worker mới nữa. Trên Node 26, sau khi tải xong cấu hình, bạn có thể **tự thu hồi quyền vĩnh viễn** ngay trong runtime:

```sh
# Pha 1 (Audit): kiểm tra các truy cập cần thiết mà chưa ngắt dịch vụ
node --permission-audit --allow-fs-read=./dist,./config --allow-net dist/server.js

# Pha 2 (Enforce): khóa chặt — cấm ghi đĩa, cấm spawn child_process, cấm native addons
node --permission \
  --allow-fs-read=./dist,./config \
  --allow-fs-write=./tmp \
  --allow-net \
  dist/server.js
```

```ts
import fs from "node:fs/promises";

// Đọc bí mật/config lúc khởi động, sau đó lập tức hạ quyền đọc thư mục config.
async function bootstrap() {
  if (!process.permission?.has("fs.read", "./config")) {
    throw new Error("missing boot read permission for ./config");
  }
  const tlsKey = await fs.readFile("./config/tls.key", "utf8");

  // Thu hồi vĩnh viễn quyền đọc ./config — kể cả về sau có lỗi path traversal cũng không đọc lại được!
  process.permission.drop("fs.read", "./config");

  // Kiểm chứng quyền đã bị gỡ
  if (process.permission.has("fs.read", "./config")) {
    throw new Error("failed to drop config read permission");
  }
  return { tlsKey };
}
```

> **Giới hạn quan trọng của Permission Model:** Theo tài liệu chính thức [Node.js Permissions](https://nodejs.org/api/permissions.html), Permission Model là cơ chế **"seat belt" (dây an toàn)** để giới hạn bán kính sát thương của **code tin cậy** khi gặp lỗi cấu hình hoặc bug — nó **KHÔNG phải sandbox chống mã độc (untrusted/malicious code)**! Đặc biệt, một tiến trình có `--allow-addons` hay `--allow-child-process` đều có thể đi vòng qua toàn bộ rào chắn này.

### 7.2 Isolation Boundary: `node:vm`, Worker vs OS/Container

Khi sản phẩm cần thực thi mã do người dùng hoặc bên thứ ba cung cấp (plugin, công thức tính toán, AI-generated code, user script), phải phân biệt rõ cơ chế nào thực sự là **security boundary**:

| Cơ chế | Tách bộ nhớ / V8 Isolate? | Tách OS / Syscall? | Là security boundary cho untrusted code? | Khi nào nên dùng |
|---|---|---|---|---|
| **`node:vm`** | **Không** (cùng isolate, chia sẻ heap & prototype host dễ bị escape) | **Không** | **KHÔNG** (tài liệu Node cảnh báo rõ ràng) | Chỉ dùng cho test runner/templating với **code hoàn toàn tin cậy** |
| **`worker_threads`** | Có (tách V8 isolate) | **Không** (cùng OS process, cùng UID/FD/env/socket/memory space) | **KHÔNG** (chỉ tách CPU/crash, không chống khai thác V8 hoặc rò bộ nhớ chung) | Tách tác vụ CPU nặng (crypto, nén, parse lớn) của code tin cậy |
| **OS Process (khác UID) + seccomp/AppArmor** | Có | Có (mức tiến trình) | Mức cơ bản (vẫn chia sẻ kernel) | Tác vụ bán tin cậy cần giới hạn rlimit/cgroups |
| **Container rootless + `cap-drop=ALL` + read-only FS** | Có | Có (namespaces + cgroups + seccomp) | Mức trung bình–cao cho workload đa tenant | Chạy build job, CLI bên thứ ba, service cô lập |
| **MicroVM (Firecracker / gVisor / Kata) hoặc Wasm Sandbox (Wasmtime / Extism)** | Có | Có (tách kernel hoặc biên dịch capability-based Wasm) | **CÓ (khuyến nghị chuẩn)** | Thực thi mã hoàn toàn không tin cậy (user plugin, serverless FaaS, code execution sandbox) |

Xem thêm phân tích về `node:vm` tại [nodejs-apis.md](nodejs-apis.md#145-nodevm-không-là-security-boundary) và Worker Threads tại [threading.md](threading.md).

### 7.3 Supply Chain Security

Tấn công chuỗi cung ứng npm (typosquatting, chiếm tài khoản maintainer, mã độc trong `postinstall`, dependency confusion) là một trong những rủi ro lớn nhất của hệ sinh thái Node.js.

**1. Cài đặt tái lập & chặn mã chạy tự động (Lifecycle Scripts)**
- **Frozen lockfile trong CI:** Luôn dùng `npm ci`, `pnpm install --frozen-lockfile` hoặc `yarn install --immutable`. Lockfile khóa trọn đồ thị phiên bản và hash toàn vẹn (`integrity: sha512-...`), nhưng nhớ rằng lockfile **không chứng minh** bản thân package đó sạch — hãy review diff của lockfile trên mọi PR.
- **Chặn lifecycle scripts (`preinstall`/`install`/`postinstall`):**
  - Với npm: dùng `npm ci --ignore-scripts` (hoặc đặt `ignore-scripts=true` trong `.npmrc`), chỉ chạy build script cho đúng native addon đã phê duyệt.
  - Với **pnpm 10+**: mặc định chặn toàn bộ build script của dependency và yêu cầu khai báo tường minh danh sách cho phép trong **`onlyBuiltDependencies`** ở `package.json` — cực kỳ hiệu quả để chặn mã độc cài lén qua `postinstall`.

**2. Chống Dependency Confusion (Scoped Registry Pinning)**
Nếu doanh nghiệp có package nội bộ `@myorg/auth`, kẻ tấn công có thể đăng một package cùng tên với phiên bản cao hơn (`99.0.0`) lên public npm registry.
- Luôn dùng **scoped packages** (`@myorg/...`) và đăng ký sở hữu org đó trên npmjs.com (hoặc cấu hình registry nội bộ không fallback lên public cho scope nội bộ).
- Ghim scope rõ ràng trong `.npmrc`:

```ini
@myorg:registry=https://npm.internal.example.com/
ignore-scripts=true
audit-level=high
```

**3. Provenance, OIDC Trusted Publishing & SBOM**
- **npm Provenance (Sigstore attestation):** Khi phát hành package public từ GitHub Actions / GitLab CI, bật `--provenance` (hoặc cấu hình `publishConfig.provenance = true`). Registry gắn chứng thực mật mã (Sigstore) chứng minh tarball được build trực tiếp từ commit/workflow công khai đó — ngăn chặn việc bị chèn mã độc trên máy dev rồi publish thủ công.
- **OIDC Trusted Publishing:** Thay thế hoàn toàn long-lived `NPM_TOKEN` lưu trong CI secrets bằng xác thực OIDC ngắn hạn trực tiếp giữa nhà cung cấp CI và npm registry (không còn token tĩnh để lộ/đánh cắp).
- **SBOM (Software Bill of Materials):** Tự động xuất SBOM định dạng **CycloneDX** hoặc **SPDX** trong pipeline release (`npm sbom --sbom-format=cyclonedx` có sẵn trong npm CLI) để theo dõi nhanh khi có CVE mới (như sự cố Log4j/XZ).
- **Audit thông minh:** Chạy `npm audit` / `pnpm audit` trong CI và dùng công cụ theo dõi hành vi bất thường (Socket, Snyk, Dependabot/Renovate với cooldown delay vài ngày cho bản phát hành mới). **Tuyệt đối không** chạy `npm audit fix --force` tự động trên nhánh chính (có thể nâng breaking major hoặc kéo phiên bản chưa kiểm thử).
- **`--frozen-intrinsics` (thử nghiệm):** Node có cờ `--frozen-intrinsics` đóng băng các built-in prototype (`Object.prototype`, `Array.prototype`...) giúp hạn chế sửa đổi global intrinsics bởi dependency độc hại, nhưng nhiều thư viện phổ biến (polyfill, APM agent, một số framework) có thể bị vỡ — chỉ bật khi đã test kỹ toàn bộ dependency tree. Xem thêm quy trình đóng gói & CI tại [tooling.md](tooling.md) và [modules-packages.md](modules-packages.md).

---

## 8. Anti-patterns & Checklist bảo mật

### 8.1 Bảng Anti-patterns phổ biến

| Anti-pattern | Lỗ hổng gây ra | Cách phòng thủ chuẩn |
|---|---|---|
| `JSON.parse(body) as UserDto` | Type confusion, bypass business logic | Parse từ `unknown` qua strict schema / validator runtime |
| `db.users.update(id, req.body)` | Mass Assignment (leo thang quyền `role: "admin"`) | Allowlist pick tường minh hoặc reject unknown keys |
| Kiểm AuthN nhưng quên kiểm quyền sở hữu `invoiceId` | IDOR / BOLA (đọc/xóa dữ liệu người khác) | Ràng buộc `tenant_id` / `owner_id` theo actor trên mọi query |
| `SELECT ... ORDER BY ${req.query.sort}` | SQL Injection ở vị trí không bind được | Ánh xạ tên bảng/cột/direction qua `Map` allowlist hằng |
| `execFile("git", ["clone", userUrl])` không có `--` | Argument / Option Injection (`--upload-pack=...`) | Đặt `--` trước positional args + validate format chặt |
| Bật `shell: true` để né `EINVAL` khi gọi `.bat`/`.cmd` | Command Injection qua `cmd.exe` (`CVE-2024-27980`) | Tránh gọi `.bat`/`.cmd` với input người dùng; gọi trực tiếp binary hoặc xử lý trong Node |
| `Object.assign(cfg, userJson)` / deep merge không lọc key | Prototype Pollution (`__proto__`, `constructor`) | Dùng `Map` / `Object.create(null)`, chặn forbidden keys, dùng `--disable-proto=throw` |
| `new RegExp(userInput)` | ReDoS treo cứng event loop + sai ngữ nghĩa | Dùng `includes` hoặc `RegExp.escape()` (Node 26) + giới hạn độ dài input; RE2 cho pattern động |
| `candidate.startsWith(root)` | Path Traversal sang thư mục anh em (`uploads-evil`) | Dùng `resolveInside()` với `path.relative` + chặn `rel === ""`, `\0`, `:`, DOS names |
| `fs.constants.O_RDONLY \| fs.constants.O_NOFOLLOW` không kiểm tra | Trên Windows thành `O_RDONLY \| 0`, mất chống symlink âm thầm | Kiểm `typeof fs.constants.O_NOFOLLOW === "number"`, thao tác qua `FileHandle` + `lstat`/ACL |
| `dns.lookup(host)` rồi gọi `fetch(url)` | SSRF qua DNS Rebinding (TOCTOU) | Pin IP đã xác thực trong `undici.Agent` `connect.lookup` + `redirect: "error"` + egress firewall |
| Phản chiếu `req.headers.origin` + `Allow-Credentials: true` | Lộ toàn bộ dữ liệu phiên ra mọi website độc hại | Chỉ đối khớp chính xác (exact match) trong `Set` allowlist + `Vary: Origin` |
| Verify JWT mà không pin `algorithms` | `alg: "none"` hoặc RS256→HS256 confusion | Pin cứng `algorithms: ["EdDSA"]` / `["ES256"]`, kiểm `iss`/`aud`/`exp`/`nbf` |
| Lưu mật khẩu bằng `SHA-256(salt + pwd)` | Dò ngược mật khẩu cực nhanh trên GPU | Dùng `crypto.argon2` (`argon2id`, Node 26) hoặc `crypto.scrypt` kèm concurrency cap |
| `NODE_TLS_REJECT_UNAUTHORIZED=0` | Tắt xác thực TLS toàn tiến trình (MITM) | Dùng `NODE_EXTRA_CA_CERTS` hoặc `--use-system-ca` |
| Tin header `Content-Length` để chặn body lớn | DoS OOM qua chunked transfer hoặc header giả | Đếm bytes thực đọc trong stream loop và gọi `destroy()` / `cancel()` ngay khi vượt trần |
| Chạy code user trong `node:vm` hoặc `worker_threads` | Escape sandbox, chiếm quyền toàn tiến trình server | Dùng MicroVM (Firecracker/gVisor), container rootless tách biệt hoặc Wasm sandbox |

### 8.2 Checklist bảo mật trước khi ra production

**1. Biên nhập liệu & Phân quyền**
- [ ] Mọi HTTP body, query, params, header, webhook, env và IPC message đều qua runtime validation từ `unknown` với chính sách unknown keys rõ ràng.
- [ ] Mọi endpoint truy cập/chỉnh sửa tài nguyên đều kiểm tra **Authorization (IDOR/BOLA)** theo `actor.userId` / `actor.tenantId` lấy từ session phía server.
- [ ] Mọi truy vấn SQL dùng bound parameters; identifier động đi qua allowlist hằng.

**2. Filesystem, Process & Network**
- [ ] File upload lưu bằng tên ngẫu nhiên sinh bởi server (UUID), không dùng tên gốc làm đường dẫn đĩa; thao tác đường dẫn người dùng qua `resolveInside()` + `FileHandle` + kiểm tra nền tảng cho `O_NOFOLLOW`.
- [ ] Không dùng `shell: true` với dữ liệu ngoài; dùng `--` cho `execFile`/`spawn`, truyền `env` tối giản.
- [ ] Mọi outbound HTTP đến URL động đều qua allowlist scheme/port, lọc đủ CIDR nội bộ (gồm cả `::ffff:0:0/96`), pin IP bằng Undici custom `lookup`, chặn/kiểm redirect và có egress firewall bảo vệ tầng mạng.

**3. Web/Auth & Mật mã**
- [ ] Cookie phiên có `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax|Strict`; rotate session ID sau đăng nhập; bật chống CSRF (`Sec-Fetch-Site`/`Origin` + token).
- [ ] CORS chỉ chấp nhận exact origin trong allowlist; security headers (`HSTS`, `CSP`, `X-Content-Type-Options`, `Referrer-Policy`, `COOP`) được bật; `X-Powered-By` và stack trace bị ẩn khỏi response.
- [ ] Mật khẩu băm bằng `crypto.argon2` (`argon2id`) hoặc `crypto.scrypt` có giới hạn concurrency; mã hóa dùng `aes-256-gcm` với IV 96-bit duy nhất + AAD; so sánh bí mật bằng `timingSafeEqual` chuẩn hóa độ dài.
- [ ] Giữ nguyên xác thực TLS (không `rejectUnauthorized: false`); secrets bị redact khỏi log, diagnostic report và heap snapshot.

**4. DoS, Runtime Hardening & Supply Chain**
- [ ] Đặt đầy đủ timeout HTTP server (`headersTimeout`, `requestTimeout`, `keepAliveTimeout`), giới hạn bytes thực đọc (ingress + egress + decompression), rate limit và giới hạn độ dài input cho regex.
- [ ] Chạy production với non-root user, read-only rootfs (nếu container), cân nhắc `--disable-proto=throw` và **Node 26 Permission Model** (`--permission-audit` → `--permission` + `process.permission.drop()`).
- [ ] CI cài dependency bằng frozen lockfile + chặn lifecycle scripts ngoài allowlist (`--ignore-scripts` / pnpm `onlyBuiltDependencies`), phát hành qua OIDC Trusted Publishing + provenance và tạo SBOM.

---

## 9. Tài liệu liên quan

- [Hệ thống kiểu dữ liệu](typesystem.md) — type guards, `unknown` và branded types tại biên runtime
- [Exception / Error](exceptions.md) — ánh xạ lỗi sang HTTP status và không rò stack trace
- [AbortSignal & request context](abort-context.md) — hủy I/O, deadline và truyền ngữ cảnh an toàn
- [Node.js built-ins](nodejs-apis.md) — `FileHandle`, `await using`, `crypto`, `fetch`/Undici và `node:vm`
- [Event loop & concurrency model](event-loop.md) — libuv threadpool contention và chặn CPU sync
- [Worker Threads & Child Process](threading.md) — tách CPU và giới hạn isolation của Worker
- [Debugging, diagnostics & hiệu năng](diagnostics.md) — redact dữ liệu nhạy cảm trong log/report/heap snapshot
- [npm / pnpm / yarn & tooling](tooling.md) — lockfile, audit, CI và bảo mật dependency
- [Modules & Packages](modules-packages.md) — đóng gói, export boundaries và phát hành package
- [Literal](literals.md) — `RegExp.escape` và ngữ nghĩa biểu thức chính quy trên Node 26
