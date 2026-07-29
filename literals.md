# Literal

**Literal** là giá trị viết trực tiếp trong mã nguồn. JavaScript/TypeScript hỗ trợ literal cho số, `bigint`, chuỗi, boolean, `null`/`undefined`, regex, template, cũng như object/array literal. Phần TypeScript: `as const`, literal types suy ra từ literal. Baseline: **ES2024+ trên Node 26**, **TypeScript 7**.

> Thời gian: literal chuỗi ngày (`"2026-07-29"`) thường parse qua **`Temporal.PlainDate.from(...)`** trên Node 26 thay vì `new Date(...)` khi cần timezone/lịch nghiêm — xem [nodejs-apis.md](nodejs-apis.md#6b-temporal-global).

---

## Mục lục

- [Literal](#literal)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan](#1-tổng-quan)
  - [2. Number literals](#2-number-literals)
  - [3. BigInt (`n`)](#3-bigint-n)
  - [4. Numeric separators `_`](#4-numeric-separators-)
  - [5. String literals \& escape](#5-string-literals--escape)
  - [6. Template literals \& tagged templates](#6-template-literals--tagged-templates)
  - [7. Boolean, `null`, `undefined`](#7-boolean-null-undefined)
  - [8. Regular expression literals](#8-regular-expression-literals)
  - [9. Object \& array literals](#9-object--array-literals)
  - [10. `as const` \& literal types](#10-as-const--literal-types)
  - [11. Pitfalls thường gặp](#11-pitfalls-thường-gặp)

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
- `as const` / `satisfies` giữ literal hẹp (xem [typesystem](typesystem.md)).

---

## 2. Number literals

- Thập phân: `42`, `3.14`, `.5`, `1e3`, `1.2e-4`.  
- Hex: `0xFF`, `0xff`.  
- Binary: `0b1010`.  
- Octal hiện đại: `0o755` (tránh octal legacy `0755` ở sloppy mode).  
- Tất cả map sang IEEE-754 **number** (64-bit float); không có int runtime.

```ts
const dec = 255;
const hex = 0xff;
const bin = 0b1111_1111;
const oct = 0o377;
const sci = 1.5e2; // 150
```

- `NaN`, `Infinity`, `-Infinity` là giá trị number (không phải keyword literal riêng, trừ khi dùng identifier toàn cục).  
- So sánh: `NaN === NaN` → `false`; dùng `Number.isNaN`.

```ts
Number.isFinite(1 / 0); // false
Number.isInteger(3.0);  // true
```

---

## 3. BigInt (`n`)

```ts
const a = 9007199254740993n; // vượt safe integer của number
const b = BigInt("9007199254740993");
const c = 0x1n;
```

- Suffix **`n`** bắt buộc cho literal.  
- Không trộn với `number` trong phép toán: `1n + 1` → `TypeError`.  
- Không có literal thập phân BigInt (`1.5n` không hợp lệ).  
- JSON **không** có BigInt — phải serialize thủ công.

```ts
const sum = 10n + 20n;
const ok = 10n > 5; // so sánh với number được, nhưng + không được
```

---

## 4. Numeric separators `_`

```ts
const budget = 1_000_000;
const mask = 0b1111_0000;
const hex = 0xFF_EC_DE_5E;
const big = 1_000_000_000_000n;
```

- Chỉ ở **giữa** các chữ số; không đầu/cuối, không cạnh nhau `1__0`, không ngay sau `0x`/`0b`/`0o` rồi `_` tùy parser — dùng dạng `0xFF_FF`.  
- Không ảnh hưởng giá trị; chỉ readability.  
- Hợp lệ với BigInt: `1_000n`.

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
| `\0` | NUL |
| `\xHH` | Latin-1 hex |
| `\uHHHH` | UTF-16 code unit |
| `\u{H...}` | Unicode code point |

- Không có raw string kiểu C# `@"..."`; dùng String.raw tagged template.  
- Chuỗi UTF-16; surrogate pairs cho code point > U+FFFF.

---

## 6. Template literals & tagged templates

**Template**:

```ts
const name = "Node";
const msg = `Hello, ${name}!`;
const multi = `
  line1
  line2
`;
```

- Nội suy: `${expression}`; có thể lồng template.  
- Luôn tạo `string` (trừ tagged trả kiểu khác).

**Tagged templates** (ngắn):

```ts
function highlight(strings: TemplateStringsArray, ...values: unknown[]) {
  return strings.reduce(
    (out, str, i) => out + str + (i < values.length ? `<b>${values[i]}</b>` : ""),
    "",
  );
}

const user = "Ada";
highlight`User: ${user}`;
```

```ts
const path = String.raw`C:\data\file.txt`; // backslash giữ nguyên
```

- Tag nhận `TemplateStringsArray` + values; dùng cho DSL, i18n, CSS-in-JS, sanitization.  
- `String.raw` là tag built-in phổ biến nhất.

---

## 7. Boolean, `null`, `undefined`

```ts
const t = true;
const f = false;
const z = null;        // primitive “null”
const u = undefined;   // thiếu giá trị / chưa gán
```

- Chỉ `true` / `false` là boolean literal; truthiness của giá trị khác không đổi kiểu thành boolean.  
- `null` typeof → `"object"` (lỗi lịch sử ECMAScript).  
- `undefined` là giá trị của biến chưa gán / tham số thiếu / prop thiếu.  
- TS: với `strictNullChecks`, cần `| null` / `| undefined` tường minh.

```ts
let x: string | undefined;
x = undefined;
```

---

## 8. Regular expression literals

```ts
const re = /ab+c/gi;
const re2 = new RegExp("ab+c", "gi");
```

- Literal được compile khi parse; `RegExp` constructor khi cần pattern động.  
- Flags thường dùng: `g` `i` `m` `s` `u` `y` `d` (indices).  
- Literal có `/` trong pattern → escape `\/` hoặc dùng constructor.  
- Cẩn thận `g` + `lastIndex` khi tái sử dụng cùng instance.

```ts
const emailish = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
```

---

## 9. Object & array literals

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
};

const arr = [1, 2, 3];
const nested = [{ id: 1 }, { id: 2 }];
const empty = [];
const holes = [1, , 3]; // sparse — tránh
```

- Shorthand: `{ name, age }` khi biến cùng tên.  
- Spread trong literal: `{ ...a, ...b }`, `[...xs, ...ys]`.  
- Trailing comma được phép và khuyến nghị trong multiline.  
- `__proto__` trong object literal có ngữ nghĩa đặc biệt — tránh set thủ công; dùng `Object.create`.

```ts
const name = "server";
const port = 3000;
const cfg = { name, port, ...(process.env.NODE_ENV === "prod" ? { tls: true } : {}) };
```

---

## 10. `as const` & literal types

```ts
const dir = "up";
// kiểu: string (widen) nếu không có chú thích hẹp

const dir2 = "up" as const;
// kiểu: "up"

const nums = [1, 2, 3] as const;
// readonly [1, 2, 3]

const palette = {
  primary: "#3366ff",
  danger: "#cc0000",
} as const;
```

```ts
type Mode = "dev" | "prod";
const mode = "dev" satisfies Mode; // kiểm tra thuộc Mode, giữ "dev"
```

- `as const` deep-readonly + literal narrowing — nền tảng cho enum-like object.  
- Mutable annotation `let x: "up" | "down" = "up"` cũng giữ union, khác với suy luận widen của `let x = "up"`.

```ts
let w = "up";           // string
let n: "up" | "down" = "up";
```

---

## 11. Pitfalls thường gặp

- **Floating point**: `0.1 + 0.2 !== 0.3` — dùng integer cents / `Decimal` lib khi tiền tệ.  
- **Safe integer**: `Number.MAX_SAFE_INTEGER` (`2^53 - 1`); ngoài khoảng → BigInt.  
- **Octal legacy** trong non-strict có thể gây confuse — luôn `"use strict"` / ESM modules (strict mặc định).  
- **Tagged template** ≠ gọi hàm thường: `tag\`a\`` khác `tag("a")`.  
- **Object key**: số trong literal key bị stringify (`{ 1: "a" }` → key `"1"`).  
- **Symbol key**: không hiện trong JSON / một số enumeration.  
- Type strip / emit: literal giữ nguyên; chỉ annotation biến mất.
