# Literal

**Literal** là giá trị viết trực tiếp trong mã nguồn. JavaScript/TypeScript hỗ trợ literal cho số, `bigint`, chuỗi, boolean, `null`/`undefined`, regex, template, cũng như object/array literal. TypeScript bổ sung `as const`, literal types, và cầu nối với union hẹp. Baseline: **ES2024+ trên Node 26**, **TypeScript 7**.

> Thời gian: chuỗi ngày (`"2026-07-29"`) nên parse qua **`Temporal.PlainDate.from(...)`** trên Node 26 khi cần lịch/timezone nghiêm — xem [nodejs-apis.md](nodejs-apis.md). Không dùng `new Date(string)` làm nguồn sự thật.

---

## Mục lục

- [Literal](#literal)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan](#1-tổng-quan)
  - [2. Number literals](#2-number-literals)
  - [3. BigInt (`n`)](#3-bigint-n)
  - [4. Numeric separators `_`](#4-numeric-separators-)
  - [5. String literals \& escape](#5-string-literals--escape)
  - [6. Template literals](#6-template-literals)
  - [7. Tagged templates](#7-tagged-templates)
  - [8. Boolean, `null`, `undefined`](#8-boolean-null-undefined)
  - [9. Regular expression literals](#9-regular-expression-literals)
  - [10. Object \& array literals](#10-object--array-literals)
  - [11. `as const` \& literal types](#11-as-const--literal-types)
  - [12. Bẫy thường gặp](#12-bẫy-thường-gặp)
  - [13. Best practices](#13-best-practices)
  - [14. Checklist](#14-checklist)
  - [15. Cheat sheet](#15-cheat-sheet)
  - [16. Version notes](#16-version-notes)
  - [17. Tài liệu liên quan](#17-tài-liệu-liên-quan)

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

- Kiểu TS của literal thường là **literal type** (`42`, `"hello"`) rồi bị **widen** khi gắn vào biến mutable không chú thích hẹp.
- `as const` / `satisfies` giữ literal hẹp — xem §11 và [typesystem.md](typesystem.md).
- Literal là *expression*; object/array literal cũng tạo object mới mỗi lần đánh giá (trừ khi engine tối ưu nội bộ — đừng dựa vào identity).

---

## 2. Number literals

| Dạng | Ví dụ | Ghi chú |
|------|--------|---------|
| Thập phân | `42`, `3.14`, `.5`, `5.` | IEEE-754 double |
| Khoa học | `1e3`, `1.2e-4` | |
| Hex | `0xFF`, `0xff` | |
| Binary | `0b1010` | |
| Octal hiện đại | `0o755` | Prefer; tránh legacy `0755` |

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

```ts
Number.isFinite(1 / 0); // false
Number.isInteger(3.0);  // true
Number.isSafeInteger(2 ** 53); // false
```

**Bẫy số:**

| Bẫy | Kết quả | Cách đúng |
|-----|---------|-----------|
| `0.1 + 0.2 === 0.3` | `false` | cents integer / thư viện decimal |
| `9007199254740993` | mất chính xác | `9007199254740993n` |
| Legacy octal `0755` (sloppy) | dễ nhầm thập phân | luôn `0o755`; ESM = strict |
| `parseInt("08")` | phụ thuộc radix | luôn truyền radix `10` |

---

## 3. BigInt (`n`)

```ts
const a = 9007199254740993n; // vượt safe integer của number
const b = BigInt("9007199254740993");
const c = 0x1n;
const d = 0b1010n;
```

- Suffix **`n`** bắt buộc cho literal; `BigInt(x)` cho chuyển đổi động.
- Không trộn với `number` trong `+ - * / % **`: `1n + 1` → `TypeError`.
- So sánh quan hệ (`>`, `<`, `>=`, `<=`) với `number` được phép; `===` vẫn strict theo kiểu.
- Không có literal thập phân BigInt (`1.5n` SyntaxError).
- Chia BigInt cắt về 0: `10n / 3n` → `3n`.
- JSON **không** có BigInt — `JSON.stringify(1n)` ném; serialize thủ công (`toString`, hoặc thư viện).

```ts
const sum = 10n + 20n;
const ok = 10n > 5; // true
// 10n + 5; // TypeError
```

---

## 4. Numeric separators `_`

```ts
const budget = 1_000_000;
const mask = 0b1111_0000;
const hex = 0xFF_EC_DE_5E;
const big = 1_000_000_000_000n;
```

Quy tắc:

- Chỉ ở **giữa** các chữ số; không đầu/cuối (`_1`, `1_`).
- Không hai `_` liền (`1__0`).
- Không ngay sau tiền tố rồi `_` kiểu `0x_FF` — dùng `0xFF_FF`.
- Không ảnh hưởng giá trị; chỉ readability.
- Hợp lệ với BigInt: `1_000n`.
- `Number("1_000")` → `NaN` — separator **chỉ** trong source literal, không trong string parse.

---

## 5. String literals & escape

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

- Không có raw string kiểu C# `@"..."`; dùng `String.raw` tagged template (§7).
- Chuỗi UTF-16; code point > U+FFFF cần surrogate pair — `.length` đếm code unit, không phải grapheme.
- So sánh chuỗi theo code unit order, không collation locale.

```ts
"😀".length;           // 2
[..."😀"].length;      // 1
"😀".codePointAt(0);   // 0x1F600
```

---

## 6. Template literals

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
- Có thể lồng template; luôn tạo `string` trừ khi dùng **tag** (§7).
- Escape trong template: `\``, `\${`, hoặc escape thông thường.
- Indentation của multiline nằm trong chuỗi — trim thủ công hoặc dùng thư viện / tag nếu cần.

```ts
const path = `/users/${id}/orders/${orderId}`;
```

**Bẫy template:**

| Bẫy | Vì sao | Cách đúng |
|-----|--------|-----------|
| Nhét HTML/SQL thô từ user | injection | sanitize / parameterized / tagged safe |
| Dựa vào indent trong source | khoảng trắng thừa | `.trim()` / helper |
| `` `${obj}` `` | thường `"[object Object]"` | serialize tường minh |

---

## 7. Tagged templates

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

- Tham số đầu: `TemplateStringsArray` (có `.raw` cho bản chưa interpret escape).
- Các tham số sau: giá trị nội suy theo thứ tự.
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

Cooked vs raw:

```ts
function show(strings: TemplateStringsArray) {
  console.log(strings[0]);     // cooked: có thể đã xử lý escape
  console.log(strings.raw[0]); // raw: giữ `\` như source
}
show`line\nnext`;
```

---

## 8. Boolean, `null`, `undefined`

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

```ts
let x: string | undefined;
x = undefined;

function f(n?: number) {
  // n: number | undefined
}
```

Falsy (nhắc lại cho ngữ cảnh literal): `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`.

---

## 9. Regular expression literals

```ts
const re = /ab+c/gi;
const re2 = new RegExp("ab+c", "gi");
const dyn = new RegExp(escapeRegExp(userInput), "u");
```

| Khía cạnh | Literal `/.../` | `new RegExp(...)` |
|-----------|-----------------|-------------------|
| Compile | khi parse nguồn | mỗi lần gọi |
| Pattern động | khó | phù hợp |
| `/` trong pattern | escape `\/` | chuỗi bình thường |
| Flags | sau `/` | tham số 2 |

Flags thường dùng: `g` `i` `m` `s` (dotAll) `u`/`v` (Unicode) `y` (sticky) `d` (indices).

```ts
const emailish = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const lines = /^start.*end$/ms;
```

**Bẫy RegExp:**

| Bẫy | Hậu quả | Cách đúng |
|-----|---------|-----------|
| Tái dùng `/g` cùng instance | `lastIndex` lệch giữa lần `test`/`exec` | reset `lastIndex` hoặc tạo mới |
| Literal trong loop nóng | thường OK (một instance) | đừng tạo `new RegExp` mỗi iteration nếu pattern cố định |
| User input → pattern | ReDoS / syntax error | escape; giới hạn; `u` flag |
| `/a/ === /a/` | `false` (object khác) | so sánh `.source` + `.flags` |

```ts
const r = /a/g;
r.test("a"); // true, lastIndex = 1
r.test("a"); // false — bẫy kinh điển
r.lastIndex = 0;
```

---

## 10. Object & array literals

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

const arr = [1, 2, 3];
const nested = [{ id: 1 }, { id: 2 }];
const empty: number[] = [];
const holes = [1, , 3]; // sparse — tránh
```

- Shorthand: `{ name, age }` khi biến cùng tên.
- Spread: `{ ...a, ...b }`, `[...xs, ...ys]` — shallow; key sau thắng.
- Trailing comma được phép và khuyến nghị multiline.
- Method shorthand ≠ arrow: `method()` nhận `this` từ receiver; `method: () => {}` lexically bind.
- `__proto__` trong object literal có ngữ nghĩa đặc biệt (set prototype) — tránh; dùng `Object.create`.

```ts
const name = "server";
const port = 3000;
const cfg = {
  name,
  port,
  ...(process.env.NODE_ENV === "production" ? { tls: true } : {}),
};
```

**Bẫy object/array literal:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Key số | `{ 1: "a" }` → key `"1"` | biết stringify |
| Sparse array | `map` bỏ hole; `forEach` bỏ hole | không tạo hole; `Array.from` |
| Spread nullish | `{ ...null }` OK (no-op ES); array `[...null]` TypeError | guard trước spread array |
| Duplicate key | key sau thắng | lint `no-dupe-keys` |
| `__proto__: x` | đổi prototype | `Object.create(x)` |
| Identity | `{} !== {}` | đừng so sánh deep bằng `===` |

```ts
JSON.stringify({ a: 1, a: 2 }); // {"a":2} — duplicate trong nguồn
[...[], ...[1]]; // [1]
// [...null as any]; // TypeError nếu runtime null
```

---

## 11. `as const` & literal types

Widen mặc định:

```ts
const dir = "up";
// kiểu: "up" với const… nhưng let thì widen:
let w = "up"; // string

const nums = [1, 2, 3];
// number[]
```

Giữ hẹp:

```ts
const dir2 = "up" as const;
// "up"

const nums2 = [1, 2, 3] as const;
// readonly [1, 2, 3]

const palette = {
  primary: "#3366ff",
  danger: "#cc0000",
} as const;
// { readonly primary: "#3366ff"; readonly danger: "#cc0000" }
```

`satisfies` — kiểm tra gán được vào kiểu đích **mà vẫn giữ** suy luận hẹp:

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

---

## 12. Bẫy thường gặp

| Bẫy | Dấu hiệu | Cách đúng |
|-----|----------|-----------|
| Floating money | `0.1 + 0.2` | integer minor units / Decimal |
| Safe integer | ID > `2^53-1` trong `number` | BigInt hoặc string ID |
| Tagged ≠ call | `tag("x")` khác `tag\`x\`` | đúng cú pháp tag |
| RegExp `g` state | `test` lần 2 sai | reset / instance mới |
| Object key số/symbol | JSON mất symbol; số → string | thiết kế key có chủ đích |
| Widen literal | `let x = "a"` thành `string` | `as const` / annotation / `satisfies` |
| `typeof null` | `"object"` | `=== null` |
| Parse separator | `Number("1_000")` → `NaN` | chỉ trong literal nguồn |
| Template injection | HTML từ user | escape / tagged safe |
| Sparse / `__proto__` | behavior lạ | tránh |

---

## 13. Best practices

1. Prefer `===` với literal; tiền tệ/IDs lớn → integer nhỏ nhất hợp lệ hoặc BigInt/string.
2. Dùng `_` separator cho số lớn; không kỳ vọng parse từ string có `_`.
3. Template cho nội suy đọc được; tagged cho DSL/raw/sanitize — không nối string ad hoc cho SQL/HTML.
4. RegExp literal cho pattern cố định; constructor + escape cho input động; cẩn thận flag `g`.
5. Object/array: shorthand + spread; tránh sparse và `__proto__` literal.
6. Config / map hằng: `as const` hoặc `as const satisfies …` thay `enum` khi strip.
7. Ngày giờ nghiêm: Temporal + literal chuỗi ISO, không `Date` parse mơ hồ.
8. Biết widen vs literal type trước khi thiết kế union API.

---

## 14. Checklist

```text
□ Số ngoài safe integer đã cân nhắc BigInt/string?
□ Tiền tệ không dùng number thô?
□ Template user-facing đã escape / không nhét SQL?
□ RegExp có `g` — lastIndex được hiểu?
□ Object literal config dùng as const / satisfies?
□ Không còn legacy octal / sparse array / __proto__ literal?
□ JSON path có BigInt / Symbol / undefined — đã xử lý serialize?
□ TS: literal union không bị widen ngoài ý muốn?
```

---

## 15. Cheat sheet

| Literal | Ví dụ | Ghi chú |
|---------|--------|---------|
| number | `42`, `0xff`, `0b1010`, `0o755`, `1e3` | float64 |
| bigint | `10n`, `0xfn` | không trộn number trong `+` |
| separator | `1_000_000` | chỉ source |
| string | `"a"`, `'a'` | UTF-16 |
| template | `` `Hi ${x}` `` | → string |
| tagged | `String.raw\`...\`` | API tùy tag |
| boolean | `true` / `false` | |
| nullish | `null`, `undefined` | |
| regexp | `/ab+/gi` | object + state với `g` |
| object | `{ a, ...b }` | shallow merge |
| array | `[1, 2, ...xs]` | tránh hole |
| const assert | `as const` | literal + readonly |
| check shape | `satisfies T` | giữ hẹp |

```ts
const Status = { Ok: 200, NotFound: 404 } as const;
type StatusCode = (typeof Status)[keyof typeof Status];
```

---

## 16. Version notes

| Giai đoạn | Liên quan literal |
|-----------|-------------------|
| ES2015 | template, tagged; binary/octal `0b`/`0o`; `===` đã có từ trước |
| ES2018+ | RegExp `/s`, lookbehind dần ổn định theo engine |
| ES2020 | BigInt rộng rãi; `matchAll`; `??` (operators) |
| ES2021 | numeric separators `_`; `||=` `&&=` `??=` |
| ES2022+ | RegExp `/d` (indices); class fields (không phải literal thuần) |
| ES2024 / hiện đại | `/v` flag Unicode sets (V8 hiện đại); Temporal trên Node 26 |
| TS 4.9+ | `satisfies` |
| TS 5+ / 7 | `as const` + strip: tránh `enum` runtime; prefer const object |
| Node 26 | Temporal global; type strip ổn định — literal giữ nguyên khi strip |

Baseline repo: **Node 26** + **TS 7**.

---

## 17. Tài liệu liên quan

- [typesystem.md](typesystem.md) — literal types, widen, excess property
- [operators.md](operators.md) — so sánh, `??`, bitwise trên number/BigInt
- [keywords.md](keywords.md) — `const`/`let`, `typeof`, `satisfies`
- [statements.md](statements.md) — declaration, destructuring
- [nodejs-apis.md](nodejs-apis.md) — Temporal, JSON, Buffer
- [node26-ts7.md](node26-ts7.md) — baseline runtime / compiler
