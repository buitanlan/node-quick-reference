# Toán tử (Operators) trong JavaScript / TypeScript

Tham chiếu toán tử theo **ECMAScript hiện đại** (Node **26**) và ghi chú kiểu TypeScript khi khác biệt. Ưu tiên thực hành: `===`, `??`, `?.`, spread/rest, gán logic `??=` `&&=` `||=`.

---

## Mục lục

- [Toán tử (Operators) trong JavaScript / TypeScript](#toán-tử-operators-trong-javascript--typescript)
  - [Mục lục](#mục-lục)
  - [1. Tổng quan \& nguyên tắc](#1-tổng-quan--nguyên-tắc)
  - [2. Ưu tiên (precedence) \& kết hợp](#2-ưu-tiên-precedence--kết-hợp)
  - [3. Số học](#3-số-học)
  - [4. So sánh: `==` vs `===`](#4-so-sánh--vs-)
  - [5. Logic: `!` `&&` `||`](#5-logic------)
  - [6. Nullish `??` \& optional chaining `?.`](#6-nullish--optional-chaining-)
  - [7. Gán \& gán hợp; `??=` `&&=` `||=`](#7-gán--gán-hợp----)
  - [8. Spread \& rest `...`](#8-spread--rest-)
  - [9. Bitwise \& dịch bit](#9-bitwise--dịch-bit)
  - [10. `in`, `instanceof`, `typeof`, `delete`, `void`, `new`](#10-in-instanceof-typeof-delete-void-new)
  - [11. Điều kiện `?:`, comma `,`, grouping `()`](#11-điều-kiện--comma--grouping-)
  - [12. TypeScript: assertion, `satisfies`, non-null `!`](#12-typescript-assertion-satisfies-non-null-)
  - [13. Best practices](#13-best-practices)

---

## 1. Tổng quan & nguyên tắc

- Biểu thức đánh giá theo **precedence** + **associativity**; khi nghi → ngoặc.  
- `&&` / `||` / `??` / `?.` có **short-circuit**.  
- `==` có coercion — hầu như luôn dùng `===` / `!==`.  
- Bitwise trên `number` chuyển về **int32** (trừ `>>>` liên quan uint32) — bất ngờ với số lớn; cân nhắc BigInt bitwise.

---

## 2. Ưu tiên (precedence) & kết hợp

Từ cao → thấp (tóm tắt):

1. Grouping: `( ... )`
2. Member / call / `new`: `.` `?.` `[]` `()` `new`
3. Postfix: `++` `--` (hiếm khi khuyến khích phức tạp)
4. Unary: `!` `~` `+` `-` `typeof` `void` `delete` `await` `++` `--`
5. Exponent: `**` (phải → trái)
6. `*` `/` `%`
7. `+` `-`
8. `<<` `>>` `>>>`
9. `<` `<=` `>` `>=` `in` `instanceof`
10. `==` `!=` `===` `!==`
11. `&` → `^` → `|`
12. `&&`
13. `||` / `??` (cùng cấp — **không trộn không ngoặc**)
14. `?:`
15. Assignment: `=` `+=` … `??=` `&&=` `||=` (phải → trái)
16. Comma `,`

> `**` không thể có unary không ngoặc ở trái theo cách gây ambigu (`-2 ** 2` là SyntaxError; dùng `(-2) ** 2`).

---

## 3. Số học

```ts
1 + 2;    // 3
"1" + 2;  // "12" — cộng chuỗi nếu một bên string
7 - 3;
7 * 3;
7 / 2;    // 3.5 (không chia nguyên)
7 % 2;    // 1
2 ** 10;  // 1024
+true;    // 1
-"5";     // -5
```

- `++` / `--`: prefix trả sau đổi; postfix trả trước đổi — tránh trong biểu thức phức tạp.  
- BigInt: `10n / 3n` → `3n` (cắt về 0); không trộn `number`.

```ts
let x = 1;
const a = ++x; // 2
const b = x++; // 2, x === 3
```

---

## 4. So sánh: `==` vs `===`

```ts
0 == false;    // true  (coercion)
0 === false;   // false
null == undefined;  // true
null === undefined; // false
"" == 0;       // true
NaN === NaN;   // false
Object.is(NaN, NaN); // true
```

| Toán tử | Hành vi |
|---------|---------|
| `===` `!==` | Strict: không coerce kiểu |
| `==` `!=` | Abstract equality — bảng coercion phức tạp |
| `<` `>` `<=` `>=` | ToPrimitive / số / chuỗi theo quy tắc |

- **Luôn** `===` trừ khi cố ý `null == x` để bắt cả `null` và `undefined` (một số style guide chấp nhận).  
- So sánh object: tham chiếu, không deep equal.

```ts
const a = {};
const b = {};
a === b; // false
a === a; // true
```

---

## 5. Logic: `!` `&&` `||`

```ts
!true;           // false
0 && "x";        // 0  (trả về toán hạng, không buộc boolean)
1 && "x";        // "x"
"" || "default"; // "default"
"hi" || "x";     // "hi"
```

- Falsy: `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`.  
- `&&` / `||` short-circuit; dùng trong điều kiện hoặc chọn giá trị — cẩn thận falsy hợp lệ (`0`, `""`).

```ts
const port = Number(process.env.PORT) || 3000;
// nếu PORT=0 → thành 3000 — có thể không mong muốn → dùng ??
```

---

## 6. Nullish `??` & optional chaining `?.`

**`??`**: chỉ thay khi `null` hoặc `undefined` (không coi `0`/`""` là thiếu).

```ts
0 ?? 10;          // 0
"" ?? "x";        // ""
null ?? "x";      // "x"
undefined ?? "x"; // "x"
```

**`?.`**: dừng và trả `undefined` nếu receiver nullish.

```ts
type User = { address?: { city?: string } };
const u: User = {};
u.address?.city;     // undefined
u.address?.city?.toUpperCase();

const fn: (() => number) | undefined = undefined;
fn?.();              // undefined — không gọi

const arr: number[] | null = null;
arr?.[0];
```

- Không trộn `??` với `&&`/`||` **không ngoặc** → SyntaxError.  
- `?.` không “nuốt” mọi lỗi — chỉ short-circuit nullish.

```ts
(null || undefined) ?? "default";
(a && b) ?? c;
```

---

## 7. Gán & gán hợp; `??=` `&&=` `||=`

```ts
let x = 1;
x += 2;  // 3
x *= 2;
x ||= 10;   // nếu x falsy → gán 10
x &&= 5;    // nếu x truthy → gán 5
x ??= 7;    // nếu null/undefined → gán 7
```

| Toán tử | Tương đương ý tưởng |
|---------|---------------------|
| `a ??= b` | `a ?? (a = b)` (chỉ gán khi nullish) |
| `a \|\|= b` | gán khi falsy |
| `a &&= b` | gán khi truthy |

```ts
const opts: { timeout?: number } = {};
opts.timeout ??= 5000;

let cache: string | undefined;
cache ||= expensive(); // cũng chạy khi cache === "" — thường muốn ??=
```

- Compound: `+=` `-=` `*=` `/=` `%=` `**=` `<<=` `>>=` `>>>=` `&=` `^=` `|=`.  
- Destructuring assignment: `({ a, b } = obj)`.

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

- Spread iterable / object enumerable own properties.  
- Rest trong param phải cuối; trong destructure gom phần còn lại.  
- Spread object: later key thắng (shallow merge).

---

## 9. Bitwise & dịch bit

```ts
5 & 3;   // 1
5 | 3;   // 7
5 ^ 3;   // 6
~0;      // -1 (int32)
1 << 5;  // 32
32 >> 2; // 8
-1 >>> 0; // 4294967295 (sang uint32)
```

- Toán tử bitwise `number` → ToInt32 trước khi tính (trừ `>>>`).  
- BigInt: `1n << 8n` không giới hạn 32-bit theo cùng quy tắc number.

```ts
const flags = 0b1010;
const on = (flags & 0b0010) !== 0;
```

---

## 10. `in`, `instanceof`, `typeof`, `delete`, `void`, `new`

```ts
"x" in { x: 1 };           // true (kể cả prototype chain)
Object.hasOwn({ x: 1 }, "x"); // own only — ưu tiên hơn in nhiều case

[] instanceof Array;       // true
[] instanceof Object;      // true

typeof "a";    // "string"
typeof null;   // "object"  ← đặc biệt
typeof [];     // "object"
typeof (() => {}); // "function"
typeof 1n;     // "bigint"
typeof Symbol(); // "symbol"

const o: { a?: number } = { a: 1 };
delete o.a;    // true; strict mode lỗi nếu xóa non-configurable

void 0;        // undefined — idiom cũ
void someCall(); // bỏ giá trị trả về

const d = new Date();
```

- `typeof` trả union string cố định — hữu ích narrowing TS.  
- `instanceof` theo prototype chain; có thể lệch qua realm/iframe — với plain data ưu tiên brand/`Array.isArray`.  
- `delete` trên biến (không phải property) → SyntaxError trong strict.  
- `new.target` trong constructor/function để biết có gọi bằng `new`.

---

## 11. Điều kiện `?:`, comma `,`, grouping `()`

```ts
const label = score >= 50 ? "pass" : "fail";

let i = 0;
for (let j = 0, k = 10; j < k; j++, k--) {
  // comma trong for
}

const v = (doSideEffect(), 42); // trả 42; tránh lạm dụng
```

- Ternary lồng nhau khó đọc → `if` / lookup table.  
- Comma: đánh giá trái → phải, trả vế phải; ưu tiên thấp nhất.

---

## 12. TypeScript: assertion, `satisfies`, non-null `!`

```ts
const el = document.getElementById("app") as HTMLDivElement | null;
const name = (user as { name: string }).name; // assertion — không runtime check

const cfg = { port: 3000 } satisfies { port: number };

const s = maybeString!; // non-null assertion: nói với checker là không nullish
```

- `as` / `!` **không** phát sinh mã kiểm tra — chỉ tắt/chỉnh checker.  
- Prefer narrowing / guards / `satisfies` hơn assertion mù.

---

## 13. Best practices

- Dùng `===`, `??`, `?.`, `Object.hasOwn`, `Array.isArray`, `Object.is` khi cần.  
- Prefer `??=` cho default config; tránh `\|\|` khi `0`/`""` hợp lệ.  
- Không trộn `??` với `||`/`&&` thiếu ngoặc.  
- Tránh bitwise trên number lớn / tiền tệ.  
- Optional chaining không thay validation đầy đủ tại biên API.
