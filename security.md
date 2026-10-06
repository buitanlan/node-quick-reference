# Bảo mật ở biên Node.js

Baseline **Node 26 + TS 7**. Trọng tâm là input, filesystem, process, network và dependency khi viết server/tooling. Kiểu TypeScript bị xóa ở runtime; `as User` không xác thực dữ liệu.

## Mục lục

- [1. Trust boundary & validation](#1-trust-boundary--validation)
- [2. Injection, object keys và prototype](#2-injection-object-keys-và-prototype)
- [3. Filesystem: traversal, symlink và TOCTOU](#3-filesystem-traversal-symlink-và-toctou)
- [4. Outbound HTTP & SSRF](#4-outbound-http--ssrf)
- [5. Resource budgets & denial of service](#5-resource-budgets--denial-of-service)
- [6. Secrets, tokens và TLS](#6-secrets-tokens-và-tls)
- [7. Permission model, isolation và supply chain](#7-permission-model-isolation-và-supply-chain)
- [8. Checklist & tài liệu liên quan](#8-checklist--tài-liệu-liên-quan)

---

## 1. Trust boundary & validation

| Biên | Kiểm tra runtime |
|---|---|
| HTTP body/query/header | Shape, kích thước, định dạng, range, unknown keys |
| Env/CLI | Parse số/boolean tường minh, config bắt buộc, fail lúc boot |
| Message worker/IPC | Discriminant + payload; không tin annotation của bên gửi |
| DB/cache/upstream | Validate schema/version ở nơi chuyển sang domain model |

Parse JSON tạo giá trị JS; không chứng minh nó là DTO. Nhận `unknown`, kiểm đủ field rồi mới brand/narrow. Authentication xác định người gọi; authorization kiểm quyền trên **tài nguyên cụ thể** mỗi lần truy cập. Validate tốt không thay authorization. [Node security practices](https://nodejs.org/en/learn/getting-started/security-best-practices).

## 2. Injection, object keys và prototype

- SQL dùng bound parameters; tên bảng/cột/sort direction dùng allowlist vì không phải mọi vị trí đều bind được.
- `spawn`/`execFile` với mảng args, `shell: false`; giá trị bắt đầu bằng `-` vẫn có thể là option injection. Kiểm format và dùng `--` khi chương trình đích hỗ trợ.
- Không chạy chuỗi input bằng `eval`/`new Function`; không ghép input thành shell command.
- Regex động cần escape literal nếu input là văn bản; escape không giải quyết ReDoS của pattern do user tự chọn.

```ts
// Chỉ lấy các field đã kiểm, không merge nguyên body vào config nội bộ.
function parsePage(value: unknown): { limit: number } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("expected object");
  }
  if (!Object.hasOwn(value, "limit")) throw new TypeError("limit required");
  const limit = (value as Record<string, unknown>).limit;
  if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError("limit must be 1..100");
  }
  return { limit };
}
```

Dictionary với key bên ngoài: dùng `Map` hoặc object null-prototype. Tránh deep merge tùy ý qua `__proto__`, `constructor`, `prototype`. Object spread tạo own data properties; `Object.assign` có thể gọi setter của target, nên hai cách không tương đương về prototype pollution. Getter/proxy có thể chạy mã khi đọc property; validator JSON không phải sandbox cho object từ plugin không tin cậy.

## 3. Filesystem: traversal, symlink và TOCTOU

```ts
import { resolve, relative, isAbsolute, sep } from "node:path";

// Chặn escape về mặt lexical; KHÔNG giải quyết symlink/race.
function resolveInside(root: string, input: string): string {
  const base = resolve(root);
  const candidate = resolve(base, input);
  const rel = relative(base, candidate);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error("path escapes root");
  }
  return candidate;
}
```

`candidate.startsWith(root)` sai với sibling `uploads-evil`. Windows còn drive/UNC/case; dùng `path` theo OS thực tế. Decode URL theo hợp đồng trước khi kiểm path, tránh mỗi tầng decode thêm một lần.

`realpath` giúp kiểm đường đã resolve symlink **tại thời điểm kiểm**; attacker thay symlink sau đó vẫn tạo TOCTOU. Thư mục cho untrusted user ghi cần OS permissions/isolation, mở file bằng flags phù hợp (`wx`, `O_NOFOLLOW` khi nền hỗ trợ), và thao tác qua handle. `access()`/`stat()` rồi mới `open()` không tạo atomic guarantee. Archive extraction phải kiểm từng entry, link và tổng kích thước. [FS notes](https://nodejs.org/api/fs.html#file-system-flags).

## 4. Outbound HTTP & SSRF

URL parse đúng cú pháp không chứng minh destination an toàn. Với fetch đến URL do người dùng chọn:

1. Allowlist scheme (`https:`) và origin/port theo nhu cầu; từ chối credentials trong URL.
2. Kiểm địa chỉ đích gồm IPv4/IPv6, loopback, private, link-local và metadata endpoints theo hạ tầng.
3. Redirect tạo destination mới: dùng `redirect: "error"` nếu không cần redirect, hoặc xác thực từng hop.
4. Gắn DNS/IP đã xác thực với kết nối thực sự, hoặc chặn egress ở proxy/firewall; lookup một lần rồi fetch lại hostname vẫn có DNS rebinding/TOCTOU.
5. Giới hạn connect/overall timeout, response bytes và số kết nối đồng thời; consume/cancel body.

Node `fetch` không áp browser CORS như ranh giới bảo mật của server. HTTPS/TLS xác thực peer nhưng không ngăn SSRF đến một host được tin cậy trong mạng nội bộ. [Undici fetch behavior](https://github.com/nodejs/undici#cors).

## 5. Resource budgets & denial of service

| Nguồn tiêu hao | Giới hạn hữu ích |
|---|---|
| HTTP ingress | Header/body bytes, request/header timeout, rate và concurrency |
| Outbound/DB | Deadline tổng, pool/queue size, retry budget |
| JSON/regex | Input size, nesting/complexity; worker khi cần CPU isolation |
| Compression | Giới hạn output giải nén, không chỉ compressed bytes |
| Worker/process | Queue cap, deadline, memory/CPU limit ở OS/container |

`Content-Length` là thông tin của peer, không thay bộ đếm bytes thực đọc; chunked body có thể không khai length. Timeout chỉ được callback xử lý khi event loop có cơ hội chạy: `AbortSignal.timeout` không ngắt `JSON.parse`/regex CPU đang block. `highWaterMark` là ngưỡng backpressure, không hard cap RAM. [Event loop](event-loop.md), [Worker](threading.md).

## 6. Secrets, tokens và TLS

Token dùng `randomBytes`/`randomUUID` theo hợp đồng entropy; không `Math.random`. Lưu password bằng password KDF phù hợp (ví dụ `scrypt` với salt riêng và chi phí đã đo), không raw SHA-256. Crypto async vẫn tranh threadpool với fs/DNS: giới hạn concurrency.

`timingSafeEqual` đòi buffer cùng length; mã xung quanh vẫn có thể rò timing. So chữ ký/MAC trên đúng bytes và encoding; xác thực trước khi dùng payload. Không tự thiết kế giao thức crypto.

Redact authorization, cookie, token, query và dữ liệu cá nhân ở log/report/heap snapshot. TLS giữ certificate/hostname verification; không đặt `NODE_TLS_REJECT_UNAUTHORIZED=0` hoặc `rejectUnauthorized: false` để sửa lỗi production. [Crypto](https://nodejs.org/api/crypto.html), [TLS](https://nodejs.org/api/tls.html).

## 7. Permission model, isolation và supply chain

```sh
node --permission --allow-fs-read=./data tool.mjs
```

Permission model giới hạn tài nguyên của code tin cậy; từng resource/flag có gate riêng theo bản Node. Nó **không** có bảo đảm chống mã độc. `node:vm` cũng không phải security boundary. Untrusted plugin/code cần process/container hoặc cơ chế sandbox được thiết kế cho threat model đó; Worker chia sẻ process nên không tạo OS isolation. [Permissions](https://nodejs.org/api/permissions.html), [VM](https://nodejs.org/api/vm.html).

Lockfile ghim dependency graph; không chứng minh package an toàn. Review lifecycle scripts và dependency mới, dùng frozen install; không tự `audit fix --force` trên production. Publish dùng token quyền nhỏ/OIDC trusted publishing khi registry hỗ trợ, kiểm tarball và nguồn build. Xem [tooling.md](tooling.md).

## 8. Checklist & tài liệu liên quan

- Validate ở biên, kiểm authorization trên tài nguyên.
- Bind SQL, args tách riêng; kiểm option injection và dictionary keys.
- Path/DNS validation gắn với tài nguyên thực dùng; giới hạn bytes/CPU/queue.
- Đóng resource khi hủy, redact diagnostics, giữ TLS verification.

[Types & guards](typesystem.md) · [Abort](abort-context.md) · [Built-ins](nodejs-apis.md) · [Diagnostics](diagnostics.md) · [Tooling](tooling.md).
