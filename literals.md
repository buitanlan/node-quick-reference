# Literal

**Literal** là giá trị viết trực tiếp trong mã nguồn. JavaScript/TypeScript hỗ trợ literal cho số, `bigint`, chuỗi, boolean, `null`, regex, template, cũng như object/array literal. `undefined` là identifier của global binding, không phải literal. TypeScript bổ sung `as const`, literal types, và cầu nối với union hẹp. Baseline: **ES2024+ trên Node 26**, **TypeScript 7**.

> Thời gian: chuỗi ngày (`"2026-07-29"`) nên parse qua **`Temporal.PlainDate.from(...)`** trên Node 26 khi cần lịch/timezone nghiêm — xem [nodejs-apis.md](nodejs-apis.md) §13. Không dùng `new Date(string)` làm nguồn sự thật. Temporal **không** có cú pháp literal riêng trong ngôn ngữ; ISO string + factory là cầu nối literals-adjacent.

---

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. Number literals](#2-number-literals)
- [3. Tiền tố `0o` / `0x` / `0b`](#3-tiền-tố-0o--0x--0b)
- [4. BigInt (`n`) vs Number](#4-bigint-n-vs-number)
- [5. Numeric separators `_`](#5-numeric-separators-_)
- [6. String literals & escape](#6-string-literals--escape)
- [7. Template literals](#7-template-literals)
- [8. Tagged templates: cooked vs raw](#8-tagged-templates-cooked-vs-raw)
  - [8.1 Cooked vs raw](#81-cooked-vs-raw)
- [9. Template injection](#9-template-injection)
- [10. Boolean, `null`, `undefined`](#10-boolean-null-undefined)
- [11. Regular expression literals](#11-regular-expression-literals)
  - [11.1 `lastIndex` + flag `g`](#111-lastindex--flag-g)
  - [11.2 Sticky `y`](#112-sticky-y)
  - [11.3 Unicode `u` vs sets `v`](#113-unicode-u-vs-sets-v)
  - [11.4 Regex động: `RegExp.escape`](#114-regex-động-regexpescape)
- [12. Object literals: shorthand, computed, `__proto__`](#12-object-literals-shorthand-computed-__proto__)
  - [12.1 Shorthand & computed keys](#121-shorthand--computed-keys)
  - [12.2 `__proto__` — ngữ nghĩa đặc biệt](#122-__proto__--ngữ-nghĩa-đặc-biệt)
- [13. Array literals & trailing commas](#13-array-literals--trailing-commas)
- [14. `as const` & bảng widen](#14-as-const--bảng-widen)
  - [14.1 Bảng widen](#141-bảng-widen)
- [15. JSON vs JS literals](#15-json-vs-js-literals)
- [16. Temporal (literals-adjacent)](#16-temporal-literals-adjacent)
- [17. Bẫy thường gặp](#17-bẫy-thường-gặp)
- [18. Best practices](#18-best-practices)
- [19. Checklist](#19-checklist)
- [20. Cheat sheet](#20-cheat-sheet)
- [21. Version notes](#21-version-notes)
- [22. Tài liệu liên quan](#22-tài-liệu-liên-quan)

---

## 1. Tổng quan

```ts
42;
3.14;
0xff;
10n;
"hello";
`hi ${name}`;
true;
null;
undefined;
/ab+c/gi;
{ a: 1 };
[1, 2, 3];
```

- Kiểu TS của literal thường là **literal type** (`42`, `"hello"`) rồi bị **widen** khi gắn vào biến mutable không chú thích hẹp — bảng §14.
- `as const` / `satisfies` giữ literal hẹp — xem §14 và [typesystem.md](typesystem.md).
- Literal là *expression*; object/array literal cũng tạo object mới mỗi lần đánh giá (trừ khi engine tối ưu nội bộ — đừng dựa vào identity).
- JSON **không** phải tập con đầy đủ của JS literal — §15.

| Nhóm | Ví dụ | Runtime |
|------|--------|---------|
| Number | `42`, `0o755`, `1e3` | IEEE-754 float64 |
| BigInt | `10n`, `0xffn` | integer tùy độ dài |
| String | `"a"`, `'a'`, `` `a` `` | UTF-16 |
| Boolean / nullish | `true`, `false`, `null`, `undefined` | primitive |
| RegExp | `/ab+/gi` | object có state |
| Object / array | `{ a }`, `[1, 2]` | object mới mỗi lần |
| Template tagged | `sql\`...\`` | **do tag quyết định** |

```ts
const a = {};
const b = {};
a === b; // false — mỗi literal object là identity riêng
```

---

## 2. Number literals

| Dạng | Ví dụ | Ghi chú |
|------|--------|---------|
| Thập phân | `42`, `3.14`, `.5`, `5.` | IEEE-754 double |
| Khoa học | `1e3`, `1.2e-4`, `1E10` | `e`/`E` đều được |
| Hex | `0xFF`, `0xff` | xem §3 |
| Binary | `0b1010` | xem §3 |
| Octal hiện đại | `0o755` | Prefer; tránh legacy `0755` |
| Signed | `-42`, `+3` | `+`/`-` là unary, không phải phần literal |
| Đặc biệt | `NaN`, `Infinity`, `-Infinity` | **identifier**, không phải literal số |

```ts
const dec = 255;
const hex = 0xff;
const bin = 0b1111_1111;
const oct = 0o377;
const sci = 1.5e2; // 150
```

- Tất cả map sang **number** (64-bit float); runtime **không** có int riêng.
- `NaN`, `Infinity`, `-Infinity` là giá trị number (identifier toàn cục / thuộc `Number`).
- So sánh: `NaN === NaN` → `false`; dùng `Number.isNaN` / `Object.is`.
- Safe integer: `-(2 ** 53) + 1` … `2 ** 53 - 1` (`Number.MIN_SAFE_INTEGER` … `MAX_SAFE_INTEGER`).

```ts
Number.isFinite(1 / 0); // false
Number.isInteger(3.0);  // true
Number.isSafeInteger(2 ** 53); // false
Number.MAX_SAFE_INTEGER; // 9007199254740991
```

**Bẫy số:**

| Bẫy | Kết quả | Cách đúng |
|-----|---------|-----------|
| `0.1 + 0.2 === 0.3` | `false` | cents integer / thư viện decimal |
| `9007199254740993` | mất chính xác | `9007199254740993n` |
| Legacy octal `0755` (sloppy) | dễ nhầm thập phân | luôn `0o755`; ESM = strict |
| `parseInt("08")` | phụ thuộc radix cũ | luôn truyền radix `10` |
| `Number("")` | `0` | parse tường minh + kiểm tra `""` |
| `parseFloat("1.2px")` | `1.2` (cắt đuôi) | `Number` / schema nếu cần fail |

```ts
9007199254740993 === 9007199254740992; // true — hết mantissa
```

---

## 3. Tiền tố `0o` / `0x` / `0b`

Ba tiền tố hiện đại (ES2015+) — **không phân biệt hoa/thường** ở chữ tiền tố:

| Tiền tố | Cơ số | Ví dụ | Giá trị |
|---------|-------|--------|---------|
| `0x` / `0X` | 16 | `0xFF`, `0Xff` | 255 |
| `0b` / `0B` | 2 | `0b1010`, `0B1010` | 10 |
| `0o` / `0O` | 8 | `0o755`, `0O755` | 493 |

```ts
0xFF === 255;
0b1111_1111 === 255;
0o377 === 255;
0xffn === 255n; // BigInt cùng tiền tố + suffix `n`
```

**Literal nguồn vs parse từ string:**

| Đầu vào | `Number(...)` | `parseInt(..., 10)` | `JSON.parse` |
|---------|---------------|---------------------|--------------|
| `"255"` | `255` | `255` | `255` |
| `"0x10"` | `16` | `0` (dừng ở `x` với radix 10) | **ném** |
| `"0b10"` | `2` | `0` | ném |
| `"0o10"` | `8` | `0` | ném |
| `"1_000"` | `NaN` | `1` (dừng ở `_`) | ném |
| `"08"` | `8` | `8` | ném (`08` không phải JSON number) |

- `Number("0x10")` / `Number("0b10")` / `Number("0o10")` **được** — spec cho phép ToNumber trên string có tiền tố.
- Separator `_` **không** đi qua `Number` / `parseInt` / JSON.
- Legacy octal `0755` (không `0o`): **SyntaxError trong ESM/strict**; chỉ còn trong sloppy CJS cũ.

```ts
Number("0x10"); // 16
Number("0b10"); // 2
Number("0o10"); // 8
Number("1_000"); // NaN
// 0755; // SyntaxError trong ESM
```

**Bẫy tiền tố:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `0755` trong CJS sloppy | giá trị octal, đọc như thập phân | `0o755` |
| Copy hex từ CSS/docs thiếu `0x` | `FF` là identifier | luôn `0xFF` |
| `parseInt("0x10", 16)` | `16` — OK; quên radix thì phụ thuộc chuỗi | radix tường minh |
| Bitmask viết thập phân | khó audit | `0b` / `0x` + `_` |

---

## 4. BigInt (`n`) vs Number

```ts
const a = 9007199254740993n; // vượt safe integer của number
const b = BigInt("9007199254740993");
const c = 0x1n;
const d = 0b1010n;
const e = 0o755n;
```

- Suffix **`n`** bắt buộc cho literal; `BigInt(x)` cho chuyển đổi động.
- Không trộn với `number` trong `+ - * / % **` và bitwise: `1n + 1` → `TypeError`.
- So sánh quan hệ (`>`, `<`, `>=`, `<=`) với `number` được phép; `===` vẫn strict theo kiểu.
- Không có literal thập phân BigInt (`1.5n` SyntaxError).
- Chia BigInt cắt về 0: `10n / 3n` → `3n`.
- JSON **không** có BigInt — `JSON.stringify(1n)` ném; serialize thủ công (`toString`, hoặc `JSON.stringify` với `replacer`).

```ts
const sum = 10n + 20n;
const ok = 10n > 5; // true
10n === 10; // false
10n == 10;  // true — coercion; vẫn prefer so sánh cùng kiểu
// 10n + 5; // TypeError
```

| Thao tác | Number | BigInt |
|----------|--------|--------|
| Literal | `42` | `42n` |
| Thập phân | `3.14` | **không** |
| `+` mixed | — | `TypeError` |
| `/` | float | cắt về 0 |
| `>>>` | có (uint32) | **không** có `>>>` trên BigInt |
| `JSON.stringify` | số / `null` cho `NaN` | **ném** |
| `typeof` | `"number"` | `"bigint"` |

```ts
typeof 1n; // "bigint"
BigInt(Number.MAX_SAFE_INTEGER) + 2n; // chính xác
Number(10n); // 10 — mất chính xác nếu vượt safe integer
```

**Bẫy BigInt:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Mix `1n + 1` | `TypeError` | cùng kiểu, hoặc `1n + BigInt(1)` |
| `JSON.stringify({ id: 1n })` | ném | `String` / replacer |
| `Number(hugeId)` rồi so sánh | mất số | giữ `bigint` hoặc string ID |
| `Math.*` với bigint | `TypeError` | toán tử BigInt / tự viết |
| Snowflake Discord / ID 64-bit trong `number` | sai | `bigint` hoặc string |

---

## 5. Numeric separators `_`

```ts
const budget = 1_000_000;
const mask = 0b1111_0000;
const hex = 0xFF_EC_DE_5E;
const big = 1_000_000_000_000n;
const sci = 1_000_000.5_01e-3; // hợp lệ nếu `_` giữa chữ số
```

Quy tắc:

- Chỉ ở **giữa** các chữ số; không đầu/cuối (`_1`, `1_`).
- Không hai `_` liền (`1__0`).
- Không ngay sau tiền tố rồi `_` kiểu `0x_FF` — dùng `0xFF_FF`.
- Không ngay trước/sau `.` hay `e`: `1_.0`, `1._0`, `1e_3` đều SyntaxError.
- Không ảnh hưởng giá trị; chỉ readability.
- Hợp lệ với BigInt: `1_000n`.
- `Number("1_000")` → `NaN` — separator **chỉ** trong source literal, không trong string parse.

```ts
1_000 === 1000;
1_000n === 1000n;
Number("1_000"); // NaN
parseInt("1_000", 10); // 1 — dừng tại `_`
JSON.parse("1000"); // 1000
// JSON.parse("1_000"); // SyntaxError
```

**Bẫy `_`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Copy số từ UI có `_` vào `Number` | `NaN` | `replaceAll("_", "")` rồi parse |
| `0x_FF` | SyntaxError | `0xFF` / `0xFF_FF` |
| Kỳ vọng JSON chấp nhận `_` | ném | số trần hoặc string |

---

## 6. String literals & escape

```ts
const s1 = "double";
const s2 = 'single';
const s3 = "line\nbreak";
const s4 = "col1\tcol2";
const s5 = "say \"hi\"";
const s6 = "path\\to";
const s7 = "\u{1F600}"; // 😀
const s8 = "\u00A9";    // ©
```

| Escape | Nghĩa |
|--------|--------|
| `\n` `\r` `\t` `\v` `\b` `\f` | điều khiển |
| `\\` `\'` `\"` | ký tự đặc biệt |
| `\0` | NUL (không theo sau chữ số octal trong strict) |
| `\xHH` | Latin-1 hex |
| `\uHHHH` | UTF-16 code unit |
| `\u{H...}` | Unicode code point |
| `\` + dòng mới | line continuation — **tránh**; dùng template |

- Không có raw string kiểu C# `@"..."`; dùng `String.raw` tagged template (§8).
- Chuỗi UTF-16; code point > U+FFFF cần surrogate pair — `.length` đếm code unit, không phải grapheme.
- So sánh chuỗi theo code unit order, không collation locale.

```ts
"😀".length;           // 2
[..."😀"].length;      // 1
"😀".codePointAt(0);   // 0x1F600
"café".normalize("NFC") === "café";
```

**Bẫy chuỗi:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `.length` emoji | code unit | `Intl.Segmenter` / `[...str]` cho code point |
| `\8` `\9` | không phải octal hợp lệ | `\u` / ký tự thật |
| Legacy octal `\377` | cấm strict | `\xFF` / `\u00FF` |
| So sánh locale bằng `>` | code unit | `Intl.Collator` |

---

## 7. Template literals

```ts
const name = "Node";
const msg = `Hello, ${name}!`;
const multi = `
  line1
  line2
`;
const nested = `outer ${`inner ${1 + 1}`}`;
```

- Nội suy: `${expression}` — đánh giá thành string (qua `ToString` / template rules).
- Có thể lồng template; luôn tạo `string` trừ khi dùng **tag** (§8).
- Escape trong template: `\``, `\${`, hoặc escape thông thường.
- Indentation của multiline nằm trong chuỗi — trim thủ công hoặc dùng thư viện / tag nếu cần.
- Untagged template **ném SyntaxError** nếu escape Unicode/hex không hợp lệ (`\uGG`).

```ts
const path = `/users/${id}/orders/${orderId}`;
const jsonish = `{"ok":${ok}}`; // vẫn là string — không phải JSON an toàn
```

**Bẫy template (untagged):**

| Bẫy | Vì sao | Cách đúng |
|-----|--------|-----------|
| Nhét HTML/SQL thô từ user | injection — §9 | sanitize / parameterized / tagged safe |
| Dựa vào indent trong source | khoảng trắng thừa | `.trim()` / helper |
| `` `${obj}` `` | thường `"[object Object]"` | serialize tường minh |
| `` `${undefined}` `` | `"undefined"` (chuỗi) | nullish trước khi nội suy |
| Escape `\u` sai trong untagged | SyntaxError | `\u{...}` hợp lệ hoặc `String.raw` |

---

## 8. Tagged templates: cooked vs raw

Tag là hàm được gọi với cấu trúc template, **không** phải gọi thường:

```ts
function highlight(strings: TemplateStringsArray, ...values: unknown[]) {
  return strings.reduce(
    (out, str, i) => out + str + (i < values.length ? `<b>${String(values[i])}</b>` : ""),
    "",
  );
}

const user = "Ada";
highlight`User: ${user}`;
// tương đương ý: highlight(["User: ", ""], user) — nhưng strings là TemplateStringsArray
```

```ts
const path = String.raw`C:\data\file.txt`; // backslash giữ nguyên
```

- Tham số đầu: `TemplateStringsArray` (frozen) — bản **cooked** (escape đã interpret).
- `.raw` (cũng frozen): bản **raw** — giữ `\` như trong nguồn.
- Các tham số sau: giá trị nội suy theo thứ tự, **không** nấu thành string trừ khi tag tự làm.
- Dùng cho DSL, i18n, CSS-in-JS, sanitization — tag quyết định kiểu trả về (không bắt buộc `string`).
- `String.raw` là tag built-in phổ biến nhất.
- `tag`\`a\`` ≠ `tag("a")` ≠ `tag(\`a\`)`.

```ts
function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  // ví dụ minh họa — production dùng driver parameterized
  return { text: strings.join("?"), values };
}

const id = 42;
sql`SELECT * FROM users WHERE id = ${id}`;
```

### 8.1 Cooked vs raw

| | Cooked `strings[i]` | Raw `strings.raw[i]` |
|--|---------------------|----------------------|
| `` `line\nnext` `` | có newline thật | `line\nnext` (hai ký tự `\` và `n`) |
| `` `C:\t` `` | tab | `C:\t` |
| Escape Unicode **hợp lệ** | code point | nguồn `\u{1F600}` |
| Escape Unicode **không hợp lệ** | **`undefined`** (tagged) | nguồn giữ nguyên |
| Untagged + escape sai | **SyntaxError** | — |

```ts
function show(strings: TemplateStringsArray) {
  console.log(strings[0]);     // cooked
  console.log(strings.raw[0]); // raw
}
show`line\nnext`;
// cooked: "line\nnext" (có newline)
// raw:    "line\\nnext" (backslash + n)
```

Tagged template **cho phép** escape không hợp lệ — cooked slot = `undefined`, raw vẫn đọc được. Đây là lý do `String.raw` và DSL path Windows tồn tại:

```ts
function inspect(strings: TemplateStringsArray) {
  return { cooked: strings[0], raw: strings.raw[0] };
}
inspect`\uGGGG`;
// { cooked: undefined, raw: "\\uGGGG" }

// `\uGGGG` không tag → SyntaxError
```

`TemplateStringsArray` là **cùng identity** giữa các lần đánh giá cùng site (engine cache) — đừng mutate; freeze theo spec.

```ts
function identity(strings: TemplateStringsArray) {
  return strings;
}
const a = identity`x`;
const b = identity`x`;
// a === b thường true với cùng call site; khác site → khác array
```

`String.raw` chỉ “raw” **phần literal**; interpolations vẫn `ToString` bình thường — backslash trong *giá trị* không được bảo vệ:

```ts
const folder = "data\\x";
String.raw`C:\app\${folder}\file.txt`;
// "C:\\app\\data\\x\\file.txt" — `\a` trong literal giữ; `folder` đã là string runtime
```

**Bẫy tagged:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `tag("x")` | gọi hàm thường, không phải template | `` tag`x` `` |
| Tin cooked luôn string | invalid escape → `undefined` | kiểm tra / dùng `.raw` |
| Nối interpolations không escape | injection §9 | tag sanitize / bind params |
| Mutate `strings` | frozen → TypeError / immutability | copy nếu cần |

---

## 9. Template injection

Template **không** an toàn theo mặc định. Nội suy chèn `ToString(value)` vào đúng vị trí — nếu value đến từ user, đó là injection surface.

```ts
const user = "<img src=x onerror=alert(1)>";
const html = `<div>${user}</div>`; // XSS nếu gửi ra HTML

const id = "1; DROP TABLE users;--";
const q = `SELECT * FROM t WHERE id = ${id}`; // SQL injection
```

| Ngữ cảnh | Nguy cơ | Cách đúng |
|----------|---------|-----------|
| HTML | XSS | escape (`&lt;`) / DOM API / tagged sanitizer đã audit |
| SQL | injection | parameterized (`$1`, `?`) — **không** nối string |
| Shell | command injection | `spawn` argv array, không `` `rm ${file}` `` |
| CSS / URL | injection / open redirect | allowlist, `URL` parse |
| Log | log forging | structured logger, không raw newline từ user |

Tagged template **có thể** an toàn *nếu* tag không nối thô:

```ts
function html(strings: TemplateStringsArray, ...vals: unknown[]) {
  const esc = (v: unknown) =>
    String(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  return strings.reduce((out, s, i) => out + s + (i < vals.length ? esc(vals[i]) : ""), "");
}

html`<div>${user}</div>`; // interpolations được escape; strings từ nguồn tin cậy
```

- Phần *literal* của template đến từ source code (trusted); phần `${}` là untrusted trừ khi đã validate.
- Tag SQL minh họa `join("?")` vẫn cần driver bind — không tự chạy query.
- `String.raw` **không** sanitize; chỉ giữ backslash.

**Bẫy injection:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `` `<p>${markdown}</p>` `` | markdown vẫn chứa HTML | parser + sanitize |
| Escape một lần rồi nhét JSON trong HTML | context lệch | escape theo **ngữ cảnh** |
| Trust tagged vì “trông như DSL” | tag có thể nối thô | đọc implementation |
| Shell template | `;` `&` \` \` | `child_process` argv |

---

## 10. Boolean, `null`, `undefined`

```ts
const t = true;
const f = false;
const z = null;        // primitive “không có object”
const u = undefined;   // thiếu giá trị / chưa gán
```

- Chỉ `true` / `false` là boolean literal; truthiness của giá trị khác **không** đổi kiểu runtime thành boolean.
- `typeof null === "object"` — lỗi lịch sử ECMAScript; kiểm tra null bằng `=== null`.
- `undefined` là giá trị của biến chưa gán, tham số thiếu, prop thiếu, hàm không `return`.
- TS + `strictNullChecks`: cần `| null` / `| undefined` tường minh.
- `undefined` là binding toàn cục (có thể shadow — đừng); `void 0` luôn ra `undefined` — xem [operators.md](operators.md).

```ts
let x: string | undefined;
x = undefined;

function f(n?: number) {
  // n: number | undefined
}
```

Falsy (nhắc lại cho ngữ cảnh literal): `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`.

JSON: `true`/`false`/`null` hợp lệ; `undefined` **không** phải JSON token — `JSON.stringify({ a: undefined })` **bỏ key**.

---

## 11. Regular expression literals

```ts
const re = /ab+c/gi;
const re2 = new RegExp("ab+c", "gi");
const dyn = new RegExp(RegExp.escape(userInput), "u"); // Node 26; xem §11.4
```

| Khía cạnh | Literal `/.../` | `new RegExp(...)` |
|-----------|-----------------|-------------------|
| Compile | khi parse nguồn | mỗi lần gọi |
| Pattern động | khó | phù hợp |
| `/` trong pattern | escape `\/` | chuỗi bình thường |
| Flags | sau `/` | tham số 2 |
| Invalid escape tagged-like | SyntaxError lúc parse | có thể ném lúc chạy |

Flags: `g` `i` `m` `s` (dotAll) `u`/`v` (Unicode) `y` (sticky) `d` (indices). **`u` và `v` loại trừ lẫn nhau.**

```ts
const emailish = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const lines = /^start.*end$/ms;
```

### 11.1 `lastIndex` + flag `g`

Instance regex **mutable**. Flag `g` (và `y`) dùng `lastIndex` làm con trỏ:

```ts
const r = /a/g;
r.test("a"); // true, lastIndex = 1
r.test("a"); // false — bẫy kinh điển
r.lastIndex = 0;
r.test("a"); // true
```

| Method | Cập nhật `lastIndex` khi có `g`/`y`? |
|--------|--------------------------------------|
| `exec` | có — sau match; 0 khi fail (`g`) |
| `test` | có — **dễ quên** |
| `String.prototype.match` với `g` | reset / không lặp exec tay | 
| `matchAll` / `split` / `replace` | quy tắc riêng; `matchAll` cần `g` |

- **Không** dùng chung một `/g` instance giữa request / thread logic song song.
- Literal trong module scope = **một** object sống suốt process — rất dễ dính `lastIndex`.

### 11.2 Sticky `y`

`y` khớp **chỉ tại** `lastIndex` (không skip về trước như search `g`):

```ts
const tok = /\d+/y;
tok.lastIndex = 0;
tok.exec("12-34"); // ["12"], lastIndex = 2
tok.exec("12-34"); // null — vị trí 2 là `-`, không phải digit
tok.lastIndex = 3;
tok.exec("12-34"); // ["34"]
```

| | `g` | `y` |
|--|-----|-----|
| Tìm từ `lastIndex` | search **tới trước** | chỉ **đúng vị trí** |
| Lexer / parser | kém tự nhiên | đúng mô hình tokenizer |
| `^` | đầu chuỗi (hoặc dòng nếu `m`) | vẫn tôn trọng sticky |

`gy` kết hợp được: sticky + cập nhật `lastIndex` theo match toàn cục.

### 11.3 Unicode `u` vs sets `v`

| Flag | Vai trò |
|------|---------|
| `u` | Unicode code point; `\p{...}`; `.` đọc surrogate pair như một code point, vẫn có thể khớp lone surrogate |
| `v` | Unicode **sets** (ES2024 / V8 hiện đại): lồng class, `&&`, `--`, `\q{...}` |

```ts
const hex = /[\p{ASCII}&&\p{Hex_Digit}]/v;
hex.test("A"); // true
hex.test("é"); // false

const lettersNotAscii = /[\p{Letter}--\p{ASCII}]/v;
lettersNotAscii.test("Đ"); // true
```

- `v` là siêu tập có kỷ luật hơn `u` cho character class; pattern class cũ có thể **SyntaxError** dưới `v` (một số range/`[` lồng).
- Không viết `/.../uv`.
- ReDoS: user input → `new RegExp` vẫn nguy hiểm dù có `u`/`v`.

**Bẫy RegExp:**

| Bẫy | Hậu quả | Cách đúng |
|-----|---------|-----------|
| Tái dùng `/g` cùng instance | `lastIndex` lệch giữa lần `test`/`exec` | reset `lastIndex` hoặc tạo mới |
| Module-level `/g` | state xuyên request | factory / không `g` / `matchAll` |
| Literal trong loop nóng | thường OK (một instance) | đừng `new RegExp` mỗi iteration nếu pattern cố định |
| User input → pattern | ReDoS / syntax error | escape; giới hạn; timeout; `u`/`v` |
| `/a/ === /a/` | `false` (object khác) | so sánh `.source` + `.flags` |
| Sticky quên `lastIndex` | miss token | lexer cập nhật tường minh |
| `/.../u` vs `/.../v` | class syntax khác | chọn một; test pattern |

```ts
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

### 11.4 Regex động: `RegExp.escape`

```js
const input = "a+b (x)";
const exact = new RegExp(`^${RegExp.escape(input)}$`, "u");
console.log(exact.test(input)); // true; input được coi là literal text
```

Node 26 có `RegExp.escape`; với runtime cũ kiểm API hoặc polyfill đúng spec. Nó xử lý cả leading character/punctuator/Unicode context, không chỉ thêm backslash cho vài metacharacter. Escape không giới hạn CPU của pattern tùy ý và không bảo vệ ReDoS nếu vẫn cho user chọn pattern. [API semantics](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/escape), [security](security.md).

---

## 12. Object literals: shorthand, computed, `__proto__`

```ts
const obj = {
  a: 1,
  b: "two",
  ["c" + 3]: true,
  method() {
    return this.a;
  },
  get g() {
    return this.b;
  },
  set g(v: string) {
    this.b = v;
  },
};
```

### 12.1 Shorthand & computed keys

```ts
const name = "server";
const port = 3000;
const key = "host";

const cfg = {
  name,                 // shorthand ≡ name: name
  port,
  [key]: "127.0.0.1",   // computed
  [Symbol.for("id")]: 1,
  ...(process.env.NODE_ENV === "production" ? { tls: true } : {}),
};
```

| Cú pháp | Nghĩa |
|---------|--------|
| `{ name }` | `name: name` — IdentifierReference |
| `{ name: expr }` | data property |
| `{ [expr]: v }` | key = `ToPropertyKey(expr)` (string hoặc symbol) |
| `{ m() {} }` | method (có `this` receiver, có `super` trong class/object method) |
| `{ m: () => {} }` | arrow — **lexical** `this` |
| `{ get x() {} }` / `{ set x(v) {} }` | accessor |
| `{ ...a }` | shallow copy enumerable **own** keys |

- Key số: `{ 1: "a" }` → key `"1"`.
- Duplicate key: key **sau** thắng (kể cả computed ra cùng tên).
- Spread: key sau thắng; không deep clone; symbol enumerable được copy.

### 12.2 `__proto__` — ngữ nghĩa đặc biệt

Trong object literal, `__proto__: protoObj` (identifier hoặc string `"__proto__"` / `'__proto__'`) **gán [[Prototype]]**, không tạo own property tên `__proto__`:

```ts
const proto = { x: 1 };
const a = { __proto__: proto, y: 2 };
Object.getPrototypeOf(a) === proto; // true
a.x; // 1 — kế thừa
a.hasOwnProperty("y"); // true
a.hasOwnProperty("x"); // false
```

**Không** đặc biệt khi:

```ts
const p = { x: 1 };
const b = { ["__proto__"]: p }; // own property string "__proto__"
Object.getPrototypeOf(b) === Object.prototype;

const proto = p;
const c = { proto }; // shorthand tên `proto` — bình thường
```

- Shorthand `{ __proto__ }` **không** đi qua production đặc biệt (MDN/spec: special form chỉ `PropertyName : AssignmentExpression` với tên `__proto__`).
- Hai lần `__proto__:` trong cùng literal → **SyntaxError**.
- `{ __proto__: null }` — object không kế thừa `Object.prototype` (safe map nhẹ); vẫn prefer `Object.create(null)` cho dictionary.
- **Tránh** `__proto__` literal trong code mới: dùng `Object.create(proto)` / `Object.setPrototypeOf` (cái sau chậm / bất ngờ).

**Bẫy object literal:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `__proto__: x` | đổi prototype | `Object.create(x)` |
| `{ ["__proto__"]: x }` nhầm với form đặc biệt | own key | biết sự khác |
| Key số | stringify | thiết kế key string |
| Duplicate key | sau thắng; lint | `no-dupe-keys` |
| Method vs arrow | `this` khác | method shorthand khi cần receiver |
| Identity | `{} !== {}` | đừng deep-equal bằng `===` |
| Spread `null`/`undefined` | no-op trên object | OK; array thì TypeError |

```ts
JSON.stringify({ a: 1, a: 2 }); // {"a":2} — duplicate trong nguồn
```

---

## 13. Array literals & trailing commas

```ts
const arr = [1, 2, 3];
const nested = [{ id: 1 }, { id: 2 }];
const empty: number[] = [];
const holes = [1, , 3]; // sparse — tránh
const spread = [...arr, 4];
```

- Trailing comma được phép và khuyến nghị multiline: `[1, 2, 3,]`, `{ a: 1, }`, `f(a, b,)`.
- JSON **cấm** trailing comma — §15.
- Hole: `map`/`forEach`/`filter` **bỏ** hole; `for...of` **đi qua** `undefined`; `.length` vẫn đếm.

```ts
[1, , 3].map((x) => x); // [1, empty, 3] — hole giữ
[1, , 3].forEach((x) => console.log(x)); // in 1 và 3
[...[1, , 3]]; // [1, undefined, 3]
```

**Bẫy array:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Sparse | hole ≠ `undefined` own | không tạo hole; `Array.from` |
| `[...null]` | TypeError | guard |
| Trailing comma copy sang JSON | `JSON.parse` ném | không trailing trong JSON |
| `Array(3)` vs `[3]` | 3 hole vs một phần tử 3 | `Array.from({ length: 3 })` / `[undefined, ...]` có chủ đích |

---

## 14. `as const` & bảng widen

Widen mặc định:

```ts
const dir = "up";
// const → literal "up"

let w = "up"; // string — widen vì mutable

const nums = [1, 2, 3];
// number[]

const palette = { primary: "#3366ff" };
// { primary: string }
```

Giữ hẹp:

```ts
const dir2 = "up" as const; // "up"
const nums2 = [1, 2, 3] as const; // readonly [1, 2, 3]
const palette2 = {
  primary: "#3366ff",
  danger: "#cc0000",
} as const;
// { readonly primary: "#3366ff"; readonly danger: "#cc0000" }
```

### 14.1 Bảng widen

| Binding / biểu thức | Kiểu suy luận | Ghi chú |
|---------------------|---------------|---------|
| `let n = 1` | `number` | widen |
| `const n = 1` | `1` | literal number |
| `let s = "up"` | `string` | widen |
| `const s = "up"` | `"up"` | literal string |
| `let s = "up" as const` | `"up"` | `as const` thắng widen của `let` |
| `const a = [1, 2]` | `number[]` | **array luôn widen** dù `const` |
| `const a = [1, 2] as const` | `readonly [1, 2]` | tuple literal |
| `const o = { a: 1 }` | `{ a: number }` | property widen |
| `const o = { a: 1 } as const` | `{ readonly a: 1 }` | deep readonly + literal |
| `const o = { a: 1 } satisfies { a: number }` | `{ a: number }` | `satisfies` **không** tự hẹp như `as const` |
| `{ a: 1 } as const satisfies T` | vừa hẹp vừa check `T` | pattern mạnh |
| `` const t = `hi` `` | `"hi"` | template không interpol → string literal |
| `` const t = `hi ${n}` `` | `string` | có interpol → widen |
| `const f = () => "up"` | `() => string` | return widen |
| `const f = () => "up" as const` | `() => "up"` | |

`satisfies` — kiểm tra gán được vào kiểu đích **mà vẫn giữ** suy luận hẹp *nếu* initializer vốn hẹp:

```ts
type Mode = "dev" | "prod";
const mode = "dev" satisfies Mode; // kiểu vẫn "dev"

const routes = {
  home: "/",
  about: "/about",
} as const satisfies Record<string, `/${string}`>;
```

Pattern enum-like erasable (phù hợp Node type strip):

```ts
const Color = {
  Red: "red",
  Blue: "blue",
} as const;

type Color = (typeof Color)[keyof typeof Color]; // "red" | "blue"
```

- `as const` deep-readonly + literal narrowing — nền tảng thay `enum` khi `erasableSyntaxOnly`.
- Annotation tường minh `let x: "up" | "down" = "up"` cũng giữ union.
- Chi tiết assignability / excess property: [typesystem.md](typesystem.md).

```ts
let n: "up" | "down" = "up";
// n = "left"; // error
```

**Bẫy `as const`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `const arr = [1, 2]` nghĩ là tuple | `number[]` | `as const` |
| `satisfies` thay `as const` | property vẫn `string`/`number` | kết hợp `as const satisfies` |
| Mutate object `as const` | TS cấm; runtime vẫn object thường | `Object.freeze` nếu cần runtime |
| `enum` + strip | không erasable | const object § này |

---

## 15. JSON vs JS literals

JSON là **định dạng dữ liệu**, không phải JavaScript. `JSON.parse` / `JSON.stringify` không hiểu hết cú pháp object/array JS.

| Cú pháp | JS literal | JSON |
|---------|------------|------|
| Key không quote `{ a: 1 }` | OK | **cấm** — phải `"a"` |
| Single quote `'hi'` | OK | **cấm** |
| Trailing comma `[1,]` `{ "a": 1, }` | OK | **cấm** |
| Comment `//` `/* */` | OK trong JS | **cấm** |
| `undefined` / `function` / `symbol` | OK | không có token; stringify bỏ / ném |
| `bigint` `10n` | OK | **cấm**; stringify ném |
| Hex/bin/oct `0xFF` | OK | **cấm** |
| Separator `1_000` | OK | **cấm** |
| `NaN` / `Infinity` | giá trị number | stringify → `null`; parse không nhận |
| `__proto__: obj` | prototype đặc biệt | parse ra own key `"__proto__"` (tùy engine/reviver — **không** set [[Prototype]] như JS literal) |
| Template / regex / Date | OK | không có; Date stringify → ISO string |

```ts
JSON.parse('{"a":1}');
JSON.parse('{"a":1,}'); // SyntaxError
JSON.parse("{a:1}");    // SyntaxError
JSON.stringify({ a: undefined, b: 1 }); // {"b":1}
JSON.stringify({ t: Temporal.PlainDate.from("2026-07-29") });
// tùy toJSON — PlainDate có toJSON → chuỗi ISO; không nhét object lạ không tuần tự
```

- `JSON.stringify` gọi `toJSON` nếu có (`Date`, nhiều Temporal).
- Prototype pollution: `JSON.parse('{"__proto__": {"admin": true}}')` — **không** giống `{ __proto__: { admin: true } }` trong JS source; vẫn có thể độc với merge unsafe (`Object.assign` / lodash `merge`). Parse rồi gán key `__proto__` như dữ liệu.
- Reviver/replacer để BigInt, `undefined` có chủ đích:

```ts
JSON.stringify({ id: 1n }, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
JSON.parse('{"id":"1"}', (k, v) => (k === "id" ? BigInt(v as string) : v));
```

**Bẫy JSON:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Copy object JS vào `.json` | trailing comma / unquoted | `JSON.stringify` |
| `undefined` round-trip | mất key | `null` hoặc omit có chủ đích |
| BigInt ID | ném | string decimal |
| Tin `JSON.parse` = `eval` object | khác prototype / `__proto__` | schema validate |

---

## 16. Temporal (literals-adjacent)

Trên **Node 26**, `Temporal` là **global** (không flag, không import). Ngôn ngữ **không** thêm literal `2026-07-29d`; dùng **chuỗi ISO / object property** + factory.

```ts
const plain = Temporal.PlainDate.from("2026-07-29");
const time = Temporal.PlainTime.from("09:30:00");
const dt = Temporal.PlainDateTime.from("2026-07-29T09:30:00");
const ym = Temporal.PlainYearMonth.from("2026-07");
const md = Temporal.PlainMonthDay.from({ month: 7, day: 29 });
const instant = Temporal.Instant.from("2026-07-29T02:30:00Z");
const zdt = Temporal.ZonedDateTime.from("2026-07-29T09:30:00+07:00[Asia/Ho_Chi_Minh]");
const dur = Temporal.Duration.from({ hours: 2, minutes: 30 });
const durIso = Temporal.Duration.from("PT2H30M");

plain.add({ days: 7 }).toString(); // "2026-08-05"
Temporal.Now.plainDateISO("Asia/Ho_Chi_Minh");
Temporal.Now.instant();
Temporal.Now.zonedDateTimeISO("Asia/Ho_Chi_Minh");
```

| Nhu cầu | Factory | “Literal” điển hình |
|---------|---------|---------------------|
| Chỉ ngày lịch | `Temporal.PlainDate.from` | `"2026-07-29"` |
| Chỉ giờ | `Temporal.PlainTime.from` | `"09:30:00"` |
| Ngày+giờ không tz | `Temporal.PlainDateTime.from` | `"2026-07-29T09:30:00"` |
| Instant UTC | `Temporal.Instant.from` | `"2026-07-29T02:30:00Z"` |
| Dân sự + tz | `Temporal.ZonedDateTime.from` | `"...+07:00[Asia/Ho_Chi_Minh]"` |
| Khoảng | `Temporal.Duration.from` | `{ hours: 2 }` hoặc `"PT2H"` |

- `new Date("2026-07-29")` → UTC midnight **hoặc** lệch tz tùy chuỗi — không dùng làm nguồn sự thật.
- JSON: lưu ISO string, parse lại bằng `Temporal.*.from`.
- Types: `@types/node` / lib Temporal; editor có thể cần ambient — xem [nodejs-apis.md](nodejs-apis.md).
- Không invent calendar literal; không `Temporal.parse` nếu API không có — dùng `.from`.

**Bẫy Temporal-as-literal:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Chuỗi `"07/29/2026"` | không ISO | `YYYY-MM-DD` / object fields |
| Mix `Date` setter + Temporal | domain lệch | một phía cho nghiệp vụ mới |
| `PlainDate` nhầm instant | không có tz | `ZonedDateTime` / `Instant` khi cần thời điểm |

---

## 17. Bẫy thường gặp

| Bẫy | Dấu hiệu | Cách đúng |
|-----|----------|-----------|
| Floating money | `0.1 + 0.2` | integer minor units / Decimal |
| Safe integer | ID > `2^53-1` trong `number` | BigInt hoặc string ID |
| Mix BigInt/number | `TypeError` | cùng kiểu |
| Tagged ≠ call | `tag("x")` khác `` tag`x` `` | đúng cú pháp tag |
| Cooked `undefined` | invalid escape trong tag | `.raw` / escape hợp lệ |
| RegExp `g` state | `test` lần 2 sai | reset / instance mới / đừng share |
| Sticky quên index | lexer miss | quản lý `lastIndex` |
| Object key số/symbol | JSON mất symbol; số → string | thiết kế key có chủ đích |
| `__proto__:` literal | prototype bất ngờ | `Object.create` |
| Widen literal | `let x = "a"` thành `string`; array `const` thành `number[]` | `as const` / annotation / `satisfies` |
| `typeof null` | `"object"` | `=== null` |
| Parse separator | `Number("1_000")` → `NaN` | chỉ trong literal nguồn |
| Template injection | HTML/SQL/shell từ user | escape / tagged safe / argv |
| Sparse / hole | `map` bỏ, `for-of` gặp `undefined` | tránh hole |
| JSON copy từ JS | trailing comma, unquoted key | `JSON.stringify` |
| `Date(string)` | tz mơ hồ | Temporal + ISO |

---

## 18. Best practices

1. Prefer `===` với literal; tiền tệ/IDs lớn → integer nhỏ nhất hợp lệ hoặc BigInt/string.
2. Dùng `_` separator cho số lớn; không kỳ vọng parse từ string có `_`.
3. Tiền tố hiện đại `0o`/`0x`/`0b`; không legacy octal; biết `Number("0x…")` ≠ JSON.
4. Template cho nội suy đọc được; tagged cho DSL/raw/sanitize — không nối string ad hoc cho SQL/HTML/shell.
5. Hiểu cooked vs raw trước khi viết tag; invalid escape chỉ an toàn trong tagged.
6. RegExp literal cho pattern cố định; constructor + escape cho input động; không share instance `g`/`y`; cân nhắc `v` cho Unicode sets.
7. Object/array: shorthand + computed + spread; tránh sparse và `__proto__` literal; trailing comma trong JS, không trong JSON.
8. Config / map hằng: `as const` hoặc `as const satisfies …` thay `enum` khi strip.
9. Ngày giờ nghiêm: Temporal global Node 26 + literal chuỗi ISO, không `Date` parse mơ hồ.
10. Biết widen vs literal type trước khi thiết kế union API; array `const` vẫn widen.

---

## 19. Checklist

```text
□ Số ngoài safe integer đã cân nhắc BigInt/string?
□ Tiền tệ không dùng number thô?
□ 0o/0x/0b — không legacy octal; parse string có chủ đích?
□ Template user-facing đã escape / không nhét SQL/HTML/shell?
□ Tag: cooked vs raw đã hiểu; không gọi tag như hàm thường?
□ RegExp có `g`/`y` — lastIndex được hiểu; không share instance?
□ Unicode sets cần `v` (không kèm `u`)?
□ Object literal config dùng as const / satisfies?
□ Không còn sparse array / __proto__ literal?
□ JSON path: không trailing comma; BigInt/Symbol/undefined đã xử lý?
□ TS: literal union / tuple không bị widen ngoài ý muốn?
□ Ngày: ISO + Temporal.PlainDate/Instant — không new Date(string)?
```

---

## 20. Cheat sheet

| Literal | Ví dụ | Ghi chú |
|---------|--------|---------|
| number | `42`, `0xff`, `0b1010`, `0o755`, `1e3` | float64 |
| bigint | `10n`, `0xfn`, `0o755n` | không trộn number trong `+` |
| separator | `1_000_000` | chỉ source |
| string | `"a"`, `'a'` | UTF-16 |
| template | `` `Hi ${x}` `` | → string |
| tagged | `` String.raw`...` `` | cooked + `.raw` |
| boolean | `true` / `false` | |
| nullish | `null`, `undefined` | |
| regexp | `/ab+/gi`, `/\\d+/y`, `/[\\p{L}]/v` | object + state `g`/`y` |
| object | `{ a, [k]: v, ...b }` | shallow; tránh `__proto__:` |
| array | `[1, 2, ...xs]` | tránh hole |
| const assert | `as const` | literal + readonly |
| check shape | `satisfies T` | giữ hẹp nếu vốn hẹp |
| ngày ISO | `Temporal.PlainDate.from("2026-07-29")` | global Node 26 |

```ts
const Status = { Ok: 200, NotFound: 404 } as const;
type StatusCode = (typeof Status)[keyof typeof Status];

function tag(strings: TemplateStringsArray, ...vals: unknown[]) {
  return { cooked: strings[0], raw: strings.raw[0], vals };
}
```

---

## 21. Version notes

| Giai đoạn | Liên quan literal |
|-----------|-------------------|
| ES2015 | template, tagged; binary/octal `0b`/`0o`; method shorthand; computed keys |
| ES2018 | tagged invalid escape → cooked `undefined`; RegExp `/s`, lookbehind |
| ES2020 | BigInt rộng rãi; `matchAll`; `??` (operators) |
| ES2021 | numeric separators `_`; `||=` `&&=` `??=` |
| ES2022+ | RegExp `/d` (indices); class fields (không phải literal thuần) |
| ES2024 / V8 hiện đại | `/v` flag Unicode sets |
| TS 4.9+ | `satisfies` |
| TS 5+ / 7 | `as const` + strip: tránh `enum` runtime; prefer const object |
| Node 26 | **Temporal global**; type strip ổn định — literal JS giữ nguyên khi strip |

Baseline repo: **Node 26** + **TS 7**.

---

## 22. Tài liệu liên quan

- [typesystem.md](typesystem.md) — literal types, widen, excess property, `satisfies`
- [operators.md](operators.md) — so sánh, `??`, bitwise trên number/BigInt
- [keywords.md](keywords.md) — `const`/`let`, `typeof`, `satisfies`
- [statements.md](statements.md) — declaration, destructuring, object literal vs block
- [nodejs-apis.md](nodejs-apis.md) — Temporal, JSON, Buffer
- [exceptions.md](exceptions.md) — ném khi `JSON.parse` / `JSON.stringify` BigInt

- [Regex/input budgets](security.md)
