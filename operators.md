# Toán tử (Operators)

Tham chiếu toán tử theo **ECMAScript hiện đại** (Node **26**) và ghi chú TypeScript **7** khi khác biệt. Ưu tiên thực hành: `===`, `??`, `?.`, spread/rest, gán logic `??=` `&&=` `||=`. Phần assertion/`satisfies` chỉ ở góc toán tử — hệ thống kiểu đầy đủ xem [typesystem.md](typesystem.md).

---

## Mục lục

- [Toán tử (Operators)](#toán-tử-operators)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan \& nguyên tắc](#1-tổng-quan--nguyên-tắc)
  - [2. Bảng ưu tiên (precedence)](#2-bảng-ưu-tiên-precedence)
  - [3. Số học](#3-số-học)
  - [4. So sánh: `==` vs `===`](#4-so-sánh--vs-)
  - [5. Logic: `!` `&&` `||`](#5-logic------)
  - [6. Nullish `??` \& optional chaining `?.`](#6-nullish--optional-chaining-)
  - [7. Gán \& gán hợp; `??=` `&&=` `||=`](#7-gán--gán-hợp----)
  - [8. Spread \& rest `...`](#8-spread--rest-)
  - [9. Bitwise \& dịch bit](#9-bitwise--dịch-bit)
  - [10. `in`, `instanceof`, `typeof`, `delete`, `void`, `new`](#10-in-instanceof-typeof-delete-void-new)
  - [11. Điều kiện `?:`, comma `,`, grouping `()`](#11-điều-kiện--comma--grouping-)
  - [12. TypeScript: `as`, `satisfies`, `is`, non-null `!`](#12-typescript-as-satisfies-is-non-null-)
  - [13. Bẫy thường gặp](#13-bẫy-thường-gặp)
  - [14. Best practices](#14-best-practices)
  - [15. Checklist](#15-checklist)
  - [16. Cheat sheet](#16-cheat-sheet)
  - [17. Version notes](#17-version-notes)
  - [18. Tài liệu liên quan](#18-tài-liệu-liên-quan)

---

## 1. Tổng quan & nguyên tắc

- Biểu thức đánh giá theo **precedence** + **associativity**; khi nghi → ngoặc.
- `&&` / `||` / `??` / `?.` có **short-circuit**.
- `==` có coercion — hầu như luôn dùng `===` / `!==`.
- Bitwise trên `number` chuyển về **int32** (và `>>>` liên quan uint32) — bất ngờ với số lớn; cân nhắc BigInt bitwise.
- Một số “toán tử” TS (`as`, `satisfies`, `!`) **erase** hoàn toàn — không có runtime check.

```ts
const port = Number(process.env.PORT) ?? 3000; // sai nếu muốn ?? — Number(undefined) là NaN
const portOk = Number(process.env.PORT || 3000); // vẫn bẫy PORT=""
const portBetter = process.env.PORT != null && process.env.PORT !== ""
  ? Number(process.env.PORT)
  : 3000;
```

---

## 2. Bảng ưu tiên (precedence)

Từ **cao → thấp** (tóm tắt thực dụng; không thay spec đầy đủ):

| Mức | Toán tử | Kết hợp |
|-----|---------|---------|
| — | Grouping `( ... )` | — |
| Postfix | `.` `?.` `[]` `()` `new` (một số dạng) `` | trái |
| Postfix | `++` `--` | — |
| Unary | `!` `~` `+` `-` `typeof` `void` `delete` `await` `++` `--` | phải |
| Exponent | `**` | **phải → trái** |
| Mul | `*` `/` `%` | trái |
| Add | `+` `-` | trái |
| Shift | `<<` `>>` `>>>` | trái |
| Relational | `<` `<=` `>` `>=` `in` `instanceof` | trái |
| Equality | `==` `!=` `===` `!==` | trái |
| Bit AND | `&` | trái |
| Bit XOR | `^` | trái |
| Bit OR | `\|` | trái |
| Logic AND | `&&` | trái |
| Logic OR / nullish | `\|\|` `??` | trái — **cùng cấp, không trộn thiếu ngoặc** |
| Cond | `?:` | phải |
| Assign | `=` `+=` … `??=` `&&=` `\|\|=` | phải |
| Comma | `,` | trái |

> `**` không cho unary không ngoặc gây ambigu ở trái: `-2 ** 2` là **SyntaxError**; dùng `(-2) ** 2` hoặc `-(2 ** 2)`.

```ts
1 + 2 * 3;      // 7
(1 + 2) * 3;    // 9
true || false && false; // true — && cao hơn ||
// true ?? false || false; // SyntaxError — phải ngoặc
(true ?? false) || false;
```

---

## 3. Số học

```ts
1 + 2;    // 3
"1" + 2;  // "12" — nếu một bên string sau ToPrimitive → nối chuỗi
7 - 3;
7 * 3;
7 / 2;    // 3.5 (không chia nguyên)
7 % 2;    // 1
2 ** 10;  // 1024
+true;    // 1
-"5";     // -5
```

- `++` / `--`: prefix trả sau đổi; postfix trả trước đổi — tránh trong biểu thức phức tạp.
- BigInt: `10n / 3n` → `3n` (cắt về 0); không trộn `number` trong phép toán số học.
- `%` với số âm: dấu theo toán hạng trái (giống nhiều ngôn ngữ C-family): `-7 % 3 === -1`.

```ts
let x = 1;
const a = ++x; // 2
const b = x++; // 2, x === 3

10n / 3n; // 3n
// 10n / 3; // TypeError
```

**Bẫy số học:**

| Bẫy | Kết quả | Cách đúng |
|-----|---------|-----------|
| `"1" + 2` | `"12"` | `Number("1") + 2` hoặc `+ "1"` có chủ đích |
| Chia kỳ vọng int | `7/2 === 3.5` | `Math.trunc` / BigInt |
| `++` trong điều kiện | khó đọc / bug | tách statement |
| `NaN` lan | mọi phép với NaN → NaN | `Number.isFinite` sớm |

---

## 4. So sánh: `==` vs `===`

```ts
0 == false;         // true  (coercion)
0 === false;        // false
null == undefined;  // true
null === undefined; // false
"" == 0;            // true
"0" == 0;           // true
NaN === NaN;        // false
Object.is(NaN, NaN); // true
Object.is(+0, -0);   // false — khác ===
```

| Toán tử | Hành vi |
|---------|---------|
| `===` `!==` | Strict: khác kiểu → khác; không coerce |
| `==` `!=` | Abstract equality — bảng coercion phức tạp |
| `<` `>` `<=` `>=` | ToPrimitive; số/chuỗi theo quy tắc |
| `Object.is` | SameValue: phân biệt `+0`/`-0`, `NaN` bằng `NaN` |

- **Luôn** `===` trừ khi cố ý `x == null` để bắt cả `null` và `undefined` (một số style chấp nhận).
- So sánh object: **tham chiếu**, không deep equal — dùng thư viện / `Object.is` từng field.
- TS: so sánh kiểu không chồng nhau có thể báo lỗi tùy flag — vẫn nên `===`.

```ts
const a = {};
const b = {};
a === b; // false
a === a; // true
```

**Bẫy so sánh:**

| Bẫy | Vì sao | Cách đúng |
|-----|--------|-----------|
| `==` với `0`/`""`/`false` | coercion chéo | `===` |
| `NaN === x` | luôn false | `Number.isNaN` / `Object.is` |
| Deep equal bằng `===` | chỉ reference | so từng phần / util |
| `document.all == undefined` | quirk trình duyệt | không liên quan Node — vẫn tránh `==` |

---

## 5. Logic: `!` `&&` `||`

```ts
!true;           // false
0 && "x";        // 0  (trả toán hạng, không buộc boolean)
1 && "x";        // "x"
"" || "default"; // "default"
"hi" || "x";     // "hi"
```

Falsy: `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`.

- `&&` / `||` short-circuit; trả **giá trị toán hạng**, không nhất thiết `boolean`.
- Trong `if (x && y)` vẫn OK nhờ truthiness; khi gán default → thường muốn `??`.

```ts
const port = Number(process.env.PORT) || 3000;
// PORT=0 → 3000 — có thể sai → dùng parse + ?? / kiểm tra tường minh
```

TS: `&&` / `||` narrowing theo control flow; nhớ falsy hợp lệ (`0`, `""`) không bị loại nếu dùng `??`.

---

## 6. Nullish `??` & optional chaining `?.`

**`??`**: chỉ thay khi `null` hoặc `undefined` (không coi `0`/`""`/`false` là thiếu).

```ts
0 ?? 10;          // 0
"" ?? "x";        // ""
false ?? true;    // false
null ?? "x";      // "x"
undefined ?? "x"; // "x"
```

**`?.`**: nếu receiver nullish → trả `undefined`, **không** đánh giá phần sau.

```ts
type User = { address?: { city?: string }; save?: () => void };
const u: User = {};
u.address?.city;              // undefined
u.address?.city?.toUpperCase();
u.save?.();                   // không gọi nếu thiếu
const arr: number[] | null = null;
arr?.[0];
```

Dạng: `obj?.prop`, `obj?.[expr]`, `fn?.(args)`, `obj?.prop?.(args)`.

- Không trộn `??` với `&&`/`||` **không ngoặc** → **SyntaxError**.
- `?.` không nuốt mọi lỗi — chỉ short-circuit khi nullish; property access sau vẫn ném nếu không nullish mà invalid.

```ts
(null || undefined) ?? "default";
(a && b) ?? c;
// a ?? b || c; // SyntaxError
```

**Bẫy `??` / `?.`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `\|\|` thay `??` | `0`/`""` bị thay | `??` khi 0 hợp lệ |
| `??` với `NaN` | `NaN` không nullish | `Number.isFinite` |
| `a?.b.c` | chỉ optional `b`; `.c` vẫn chạy nếu `b` truthy object thiếu `c` → `undefined`, nhưng `a.b.c` nếu `b` null đã short-circuit | biết chỗ đặt `?.` |
| Coi `?.` = try/catch | không bắt throw trong getter | try/catch khi cần |

---

## 7. Gán & gán hợp; `??=` `&&=` `||=`

```ts
let x = 1;
x += 2;   // 3
x *= 2;
x ||= 10; // nếu x falsy → gán 10
x &&= 5;  // nếu x truthy → gán 5
x ??= 7;  // nếu null/undefined → gán 7
```

| Toán tử | Ý tưởng (short-circuit gán) |
|---------|------------------------------|
| `a ??= b` | gán `b` chỉ khi `a` nullish |
| `a \|\|= b` | gán khi `a` falsy |
| `a &&= b` | gán khi `a` truthy |

```ts
const opts: { timeout?: number; label?: string } = {};
opts.timeout ??= 5000;

let cache: string | undefined;
cache ||= expensive(); // cũng chạy khi cache === "" — thường muốn ??=
cache ??= expensive();
```

- Compound: `+=` `-=` `*=` `/=` `%=` `**=` `<<=` `>>=` `>>>=` `&=` `^=` `|=`.
- Destructuring assignment: `({ a, b } = obj)`; `[x, y] = pair`.
- Gán là expression (trả giá trị gán) — tránh xâu chuỗi khó đọc `a = b = c` trừ khi cố ý.

---

## 8. Spread & rest `...`

```ts
const a = [1, 2];
const b = [...a, 3];
const o = { x: 1, y: 2 };
const p = { ...o, y: 9 };

function sum(...nums: number[]) {
  return nums.reduce((s, n) => s + n, 0);
}
const [head, ...tail] = b;
const { x, ...rest } = p;
```

- Spread iterable → array elements; spread object → enumerable **own** properties.
- Rest trong param phải cuối; trong destructure gom phần còn lại.
- Object spread: key sau thắng (shallow merge); không deep clone.
- `...` không phải toán tử ưu tiên độc lập kiểu `+` — là cú pháp primary/call/array/object.

```ts
const merged = { ...defaults, ...overrides };
```

---

## 9. Bitwise & dịch bit

```ts
5 & 3;    // 1
5 | 3;    // 7
5 ^ 3;    // 6
~0;       // -1 (int32)
1 << 5;   // 32
32 >> 2;  // 8
-1 >>> 0; // 4294967295 (ToUint32)
```

- Toán tử bitwise trên `number` → **ToInt32** trước (trừ ngữ cảnh `>>>` / kết quả liên quan uint32).
- BigInt: `1n << 8n` không giới hạn 32-bit theo cùng quy tắc number; không trộn bit `number` với `bigint`.
- Dùng flag bit trong domain nhỏ OK; tiền tệ / ID 64-bit → BigInt hoặc tránh bit trên number.

```ts
const flags = 0b1010;
const on = (flags & 0b0010) !== 0;

const big = 1n << 40n; // OK với BigInt
// 1 << 40; // mất chính xác ý nghĩa 32-bit wrap
```

**Bẫy bitwise:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `~` “đảo boolean” | `~0 === -1`, không phải `true` | `!` cho boolean |
| Shift ≥ 32 trên number | count mask 5 bit | BigInt hoặc mask tường minh |
| `&` ưu tiên thấp hơn `==` | `flags & MASK === 0` parse sai | `(flags & MASK) === 0` |
| Bit money / snowflake ID | int32 truncate | BigInt / string |

---

## 10. `in`, `instanceof`, `typeof`, `delete`, `void`, `new`

```ts
"x" in { x: 1 };              // true (prototype chain)
"toString" in {};             // true — kế thừa
Object.hasOwn({ x: 1 }, "x"); // own only — ưu tiên nhiều case

[] instanceof Array;          // true
[] instanceof Object;         // true
Array.isArray([]);            // true — prefer cho array

typeof "a";     // "string"
typeof null;    // "object"  ← đặc biệt
typeof [];      // "object"
typeof (() => {}); // "function"
typeof 1n;      // "bigint"
typeof Symbol(); // "symbol"
typeof undeclaredVar; // "undefined" — không TDZ với typeof identifier chưa khai báo… cẩn thận với let TDZ

const o: { a?: number } = { a: 1 };
delete o.a;

void 0;           // undefined
void someCall();  // cố ý bỏ return value

const d = new Date();
```

| API | Dùng khi |
|-----|----------|
| `typeof` | narrowing primitive / function |
| `instanceof` | prototype chain cùng realm |
| `Array.isArray` | nhận diện array |
| `Object.hasOwn` | own key |
| `in` | key kể cả inherited (ít khi cần) |
| `delete` | xóa property configurable |
| `void` | biểu thức → `undefined`; fire-and-forget có chủ đích |
| `new` | gọi constructor |

- `typeof` value vs `typeof` **type position** (TS) khác ngữ nghĩa — xem [keywords.md](keywords.md).
- `instanceof` lệch qua realm (vm/`vm` module, worker khác) — plain data ưu tiên brand / `Array.isArray`.
- `delete` biến (binding) → SyntaxError trong strict; trên `const` prop non-configurable → `false` hoặc TypeError (strict).
- `delete` array element → sparse hole — thường `splice` rõ hơn.
- `new.target` trong constructor/function: biết có gọi bằng `new`.

```ts
function F() {
  if (new.target === undefined) throw new TypeError("Call with new");
}
```

**Bẫy `delete` / `void`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `delete arr[i]` | tạo hole | `splice` / filter |
| `delete` để “optional” | shape động khó type | `undefined` gán / omit khi build object |
| `void` che Promise | `void promise` không bắt rejection | `.catch` / void + eslint có chủ đích |
| Tin `typeof` đủ cho object | arrays, null, class instances | kết hợp guard |

---

## 11. Điều kiện `?:`, comma `,`, grouping `()`

```ts
const label = score >= 50 ? "pass" : "fail";

let i = 0;
for (let j = 0, k = 10; j < k; j++, k--) {
  // comma trong for header — phổ biến và OK
}

const v = (doSideEffect(), 42); // trả 42; tránh lạm dụng ngoài for
```

- Ternary lồng nhau khó đọc → `if` / lookup table / map.
- Comma operator: đánh giá trái → phải, **trả vế phải**; ưu tiên thấp nhất.
- Grouping `()` chỉ đổi thứ tự / bắt buộc với `??` vs `||`.

```ts
const fee = kind === "pro" ? 10 : kind === "team" ? 25 : 0; // khó đọc
const fees = { pro: 10, team: 25 } as const;
const fee2 = fees[kind as keyof typeof fees] ?? 0;
```

---

## 12. TypeScript: `as`, `satisfies`, `is`, non-null `!`

Các dạng này xuất hiện trong expression position nhưng **không** phải toán tử JS runtime:

```ts
const el = document.getElementById("app") as HTMLDivElement | null;
// assertion — không check runtime

const cfg = { port: 3000 } satisfies { port: number };
// kiểm tra gán được; giữ suy luận field

const s = maybeString!; // non-null assertion — nói với checker

function isStr(x: unknown): x is string {
  return typeof x === "string";
}
```

| Cú pháp | Runtime | Vai trò |
|---------|---------|---------|
| `expr as T` | erase | ép kiểu checker (double assert `as unknown as T` nguy hiểm) |
| `expr satisfies T` | erase | validate shape, giữ literal hẹp |
| `expr!` | erase | khẳng định non-nullish |
| `x is T` | erase (chỉ chữ ký) | type predicate — cần `return` boolean đúng |
| `asserts x is T` | erase | assertion function — phải throw nếu sai |

- Prefer narrowing / guards / `satisfies` hơn `as` / `!` mù.
- Chi tiết: [typesystem.md](typesystem.md); keyword: [keywords.md](keywords.md).

---

## 13. Bẫy thường gặp

| Bẫy | Dấu hiệu | Cách đúng |
|-----|----------|-----------|
| `==` coercion | `"" == 0` | `===` |
| `\|\|` nuốt `0` | default port sai | `??` / parse tường minh |
| Trộn `??` với `\|\|` | SyntaxError | ngoặc |
| Bit `&` vs `===` | `flags & M === 0` | `(flags & M) === 0` |
| `delete` / sparse | length giữ, hole | `splice` |
| `typeof null` | `"object"` | `=== null` |
| `in` prototype | `"toString" in obj` | `Object.hasOwn` |
| `as` / `!` | crash runtime | guard thật |
| Optional chain quá tay | nuốt bug cấu hình | validate biên API |
| Comma ngoài `for` | side effect ẩn | tách statement |

---

## 14. Best practices

1. Mặc định `===` / `!==`; `== null` chỉ khi team chấp nhận bắt cả nullish.
2. Default config: `??=` / `??`; tránh `||` khi `0`/`""`/`false` hợp lệ.
3. Optional chaining cho access sâu có thể thiếu; không thay validation input.
4. Ngoặc khi trộn bit, `??`, hoặc biểu thức dài — đọc trước “thông minh”.
5. Prefer `Object.hasOwn`, `Array.isArray`, `Object.is`, `Number.isNaN` / `Number.isFinite`.
6. Tránh bitwise trên number lớn; flag nhỏ OK.
7. TS: `satisfies` + narrowing; hạn chế `as` / `!`.
8. Không dùng comma operator cho “clever” one-liner ngoài header `for`.

---

## 15. Checklist

```text
□ Không còn == trừ == null có chủ đích?
□ Default dùng ?? / ??= khi 0 hoặc "" hợp lệ?
□ ?. không che lỗi cấu hình bắt buộc?
□ Bitwise có ngoặc với so sánh?
□ Không delete tạo sparse array?
□ typeof / instanceof / hasOwn đúng chỗ?
□ as / ! có justification — hoặc đã thay guard?
□ ?? không trộn || / && thiếu ngoặc?
```

---

## 16. Cheat sheet

| Cần | Dùng |
|-----|------|
| So khớp kiểu | `===` |
| Null hoặc undefined | `== null` hoặc `??` / `??=` |
| Falsy default (cố ý) | `\|\|` / `\|\|=` |
| Access sâu | `?.` |
| Own key | `Object.hasOwn` |
| Array | `Array.isArray` |
| NaN | `Number.isNaN` / `Object.is` |
| SameValueZero (Set/Map key) | theo spec collection — không phải `===` thuần với NaN |
| Merge nông | `{ ...a, ...b }` |
| Bỏ giá trị | `void expr` (có chủ đích) |
| Giữ literal + check | `satisfies` |
| Predicate | `x is T` |

```ts
opts.timeout ??= 5_000;
const city = user.address?.city ?? "n/a";
if ((flags & READ) !== 0) { /* ... */ }
```

---

## 17. Version notes

| Giai đoạn | Liên quan toán tử |
|-----------|-------------------|
| ES3–5 | `==`/`===`, bitwise, `in`, `instanceof`, `typeof`, `delete`, `void` |
| ES2015 | `**` chưa có; spread array; nhiều op cũ ổn định |
| ES2016 | `**` |
| ES2019+ | cải thiện nhỏ; `Object.fromEntries` (không phải op) |
| ES2020 | `??`, `?.`, `bigint` ops |
| ES2021 | `??=` `&&=` `\|\|=`; numeric `_` (literals) |
| ES2022+ | `at`, top-level await (keywords/statements) |
| TS 4.9+ | `satisfies` |
| TS / Node 26 | assertion erase + type strip — không invent runtime từ `as` |

Baseline: **Node 26** + **TS 7**.

---

## 18. Tài liệu liên quan

- [literals.md](literals.md) — số, BigInt, template
- [keywords.md](keywords.md) — `typeof`/`instanceof`/`in`/`void`/`delete` như từ khóa
- [statements.md](statements.md) — `for` header, expression statements
- [typesystem.md](typesystem.md) — narrowing, `satisfies`, predicates
- [functions-callbacks.md](functions-callbacks.md) — rest params
- [node26-ts7.md](node26-ts7.md) — baseline
