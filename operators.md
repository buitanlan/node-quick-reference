# Toán tử (Operators)

Tham chiếu toán tử theo **ECMAScript hiện đại** (Node **26**) và ghi chú TypeScript **7** khi khác biệt. Ưu tiên thực hành: `===`, `??`, `?.`, spread/rest, gán logic `??=` `&&=` `||=`. Phần assertion/`satisfies`/`keyof` chỉ ở góc toán tử — hệ thống kiểu đầy đủ xem [typesystem.md](typesystem.md).

---

## Mục lục

- [1. Tổng quan & nguyên tắc](#1-tổng-quan--nguyên-tắc)
- [2. Bảng ưu tiên đầy đủ](#2-bảng-ưu-tiên-đầy-đủ)
- [3. Số học & `**` kết hợp phải](#3-số-học---kết-hợp-phải)
- [4. Bảng coercion `==`](#4-bảng-coercion-)
- [5. `===` vs `Object.is`](#5--vs-objectis)
- [6. Logic: `!` `&&` `||`](#6-logic---)
- [7. `??` vs `||`](#7--vs-)
- [8. `?.` short-circuit vs `&&`](#8--short-circuit-vs-)
- [9. Gán & gán hợp](#9-gán--gán-hợp)
- [10. Spread & rest `...`](#10-spread--rest-)
- [11. Bitwise signed 32 & `>>>`](#11-bitwise-signed-32--)
- [12. Comma, `void 0`, `?:`, grouping](#12-comma-void-0--grouping)
  - [`void 0`](#void-0)
- [13. `typeof` — bảng kết quả](#13-typeof--bảng-kết-quả)
- [14. `in` vs `Object.hasOwn`](#14-in-vs-objecthasown)
- [15. `instanceof` + realms](#15-instanceof--realms)
- [16. `delete` configurable](#16-delete-configurable)
- [17. `new`, `new.target`](#17-new-newtarget)
  - [17.1 `yield` / `yield*` (operator, không phải statement thuần)](#171-yield--yield-operator-không-phải-statement-thuần)
  - [17.2 Precedence khác evaluation order](#172-precedence-khác-evaluation-order)
- [18. TypeScript: `as`, `satisfies`, `is`, `!`, `keyof`, `typeof`](#18-typescript-as-satisfies-is--keyof-typeof)
- [19. Bẫy thường gặp](#19-bẫy-thường-gặp)
- [20. Best practices](#20-best-practices)
- [21. Checklist](#21-checklist)
- [22. Cheat sheet](#22-cheat-sheet)
- [23. Version notes](#23-version-notes)
- [24. Tài liệu liên quan](#24-tài-liệu-liên-quan)

---

## 1. Tổng quan & nguyên tắc

- Biểu thức đánh giá theo **precedence** + **associativity**; khi nghi → ngoặc.
- `&&` / `||` / `??` / `?.` có **short-circuit**.
- `==` có coercion — hầu như luôn dùng `===` / `!==`.
- Bitwise trên `number` chuyển về **int32** (và `>>>` liên quan uint32) — bất ngờ với số lớn; cân nhắc BigInt bitwise.
- Một số “toán tử” TS (`as`, `satisfies`, `!`, `keyof`, `typeof` type-query) **erase** hoàn toàn — không có runtime check.

```ts
const port = Number(process.env.PORT) ?? 3000; // sai nếu muốn ?? — Number(undefined) là NaN
const portOk = Number(process.env.PORT || 3000); // vẫn bẫy PORT=""
const portBetter = process.env.PORT != null && process.env.PORT !== ""
  ? Number(process.env.PORT)
  : 3000;
```

| Họ | Vai trò | Ghi chú Node/TS |
|----|---------|-----------------|
| Arithmetic | `+ - * / % ** ++ --` | `+` còn nối chuỗi |
| Comparison | `=== !== == != < > <= >=` | prefer `===` |
| Same-value | `Object.is` | không phải toán tử, nhưng cặp với `===` |
| Logical / nullish | `! && \|\| ?? ?. ` | short-circuit |
| Assignment | `=` `+=` `??=` … | RHS trước, LHS một lần |
| Bitwise | `& \| ^ ~ << >> >>>` | ToInt32 / ToUint32 trên number |
| Meta | `typeof` `in` `instanceof` `delete` `void` `new` | keyword-ops |
| TS-only | `as` `satisfies` `is` `!` `keyof` `typeof` | erase |

---

## 2. Bảng ưu tiên đầy đủ

Từ **cao → thấp**. Nhóm cùng mức: xem cột kết hợp. Đây là bảng thực dụng bám MDN/ECMAScript — ngoặc `()` luôn thắng.

| Mức | Toán tử / dạng | Kết hợp |
|-----|----------------|---------|
| 1 | Grouping `( … )` | — |
| 2 | Member: `.` `?.` `[]` ; gọi `fn()` ; `new F(args)` ; tagged template ; `?.()` `?.[]` | trái |
| 3 | `new F` (không đối số) | phải |
| 4 | Postfix `++` `--` | — |
| 5 | Unary `!` `~` `+` `-` `typeof` `void` `delete` `await` prefix `++` `--` | phải |
| 6 | `**` | **phải → trái** |
| 7 | `*` `/` `%` | trái |
| 8 | `+` `-` | trái |
| 9 | `<<` `>>` `>>>` | trái |
| 10 | `<` `<=` `>` `>=` `in` `instanceof` | trái |
| 11 | `==` `!=` `===` `!==` | trái |
| 12 | `&` | trái |
| 13 | `^` | trái |
| 14 | `\|` | trái |
| 15 | `&&` | trái |
| 16 | `\|\|` **và** `??` (cùng cấp — **không trộn thiếu ngoặc**) | trái |
| 17 | `?:` | phải |
| 18 | `=` `+=` `-=` `*=` `/=` `%=` `**=` `<<=` `>>=` `>>>=` `&=` `^=` `\|=` `&&=` `\|\|=` `??=` ; `yield` `yield*` | phải |
| 19 | Comma `,` | trái |

> `**` không cho unary không ngoặc gây ambigu ở trái: `-2 ** 2` là **SyntaxError**; dùng `(-2) ** 2` hoặc `-(2 ** 2)`.
>
> `??` không trộn với `||` / `&&` thiếu ngoặc → **SyntaxError** (cùng “nullish/or” zone).
>
> Spread/rest `...` không nằm bảng precedence như `+` — là cú pháp primary/call/array/object/param.

```ts
1 + 2 * 3;      // 7
(1 + 2) * 3;    // 9
true || false && false; // true — && cao hơn ||
// true ?? false || false; // SyntaxError — phải ngoặc
(true ?? false) || false;
2 ** 3 ** 2;    // 512 — phải: 2 ** (3 ** 2), không phải 64
```

**Bẫy precedence:**

| Bẫy | Parse thực | Cách đúng |
|-----|------------|-----------|
| `flags & MASK === 0` | `flags & (MASK === 0)` | `(flags & MASK) === 0` |
| `-2 ** 2` | SyntaxError | `(-(2 ** 2))` hoặc `((-2) ** 2)` |
| `a ?? b \|\| c` | SyntaxError | `(a ?? b) \|\| c` |
| `await a + b` | `(await a) + b` | `await (a + b)` nếu muốn |
| `typeof a === "x"` | `(typeof a) === "x"` | OK — typeof cao hơn `===` |
| `!a instanceof T` | `(!a) instanceof T` | `!(a instanceof T)` |

---

## 3. Số học & `**` kết hợp phải

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
- `%` với số âm: dấu theo toán hạng trái (C-family): `-7 % 3 === -1`.
- `**` **associativity phải**: `2 ** 3 ** 2 === 2 ** 9 === 512`.
- Unary `-`/`+`/`~` **không** đứng sát trái `**` thiếu ngoặc.

```ts
let x = 1;
const a = ++x; // 2
const b = x++; // 2, x === 3

10n / 3n; // 3n
// 10n / 3; // TypeError

2 ** 3 ** 2;     // 512
(2 ** 3) ** 2;   // 64
-(2 ** 2);       // -4
(-2) ** 2;       // 4
// -2 ** 2;      // SyntaxError
```

`+` chuỗi thắng số khi ToPrimitive ra string:

```ts
1 + 2 + "3";   // "33"
"1" + 2 + 3;   // "123"
[] + [];       // ""
[] + {};       // "[object Object]"
```

**Bẫy số học:**

| Bẫy | Kết quả | Cách đúng |
|-----|---------|-----------|
| `"1" + 2` | `"12"` | `Number("1") + 2` hoặc `+ "1"` có chủ đích |
| Chia kỳ vọng int | `7/2 === 3.5` | `Math.trunc` / BigInt |
| `++` trong điều kiện | khó đọc / bug | tách statement |
| `NaN` lan | mọi phép với NaN → NaN | `Number.isFinite` sớm |
| `2 ** 3 ** 2` nghĩ 64 | 512 | ngoặc |
| `-2 ** 2` | SyntaxError | ngoặc unary |

---

## 4. Bảng coercion `==`

Abstract Equality (`==`) đối xứng (`a == b` và `b == a`), nhưng coercion dễ trái trực giác. Quy tắc tóm tắt (spec `IsLooselyEqual`):

1. Cùng kiểu → gần như `===` (trừ `NaN`).
2. `null == undefined` → **true** (và ngược lại); không coerce sang số.
3. Number ↔ String → `ToNumber(string)`.
4. Boolean ↔ bất kỳ → `ToNumber(boolean)` rồi `==` lại (`true` → `1`, `false` → `0`).
5. Object ↔ primitive → `ToPrimitive(object)` rồi `==` lại.
6. BigInt ↔ Number: so số học nếu cả hai hữu hạn; `NaN`/`Infinity` → false.
7. Còn lại → false.

| Biểu thức | Kết quả | Vì sao (rút gọn) |
|-----------|---------|------------------|
| `null == undefined` | `true` | quy tắc nullish |
| `null == 0` | `false` | null không ra số |
| `undefined == 0` | `false` | |
| `undefined == false` | `false` | |
| `"" == 0` | `true` | `ToNumber("") === 0` |
| `"0" == 0` | `true` | |
| `"0" == false` | `true` | false → 0, `"0"` → 0 |
| `" \t" == 0` | `true` | whitespace → 0 |
| `false == 0` | `true` | |
| `true == 1` | `true` | |
| `true == 2` | `false` | |
| `NaN == NaN` | `false` | |
| `[] == false` | `true` | `[]` → `""` → `0` |
| `[] == 0` | `true` | |
| `[] == ""` | `true` | ToPrimitive `[]` là `""` |
| `[0] == 0` | `true` | `"0"` → 0 |
| `[1] == 1` | `true` | |
| `[[]] == 0` | `true` | toString lồng → `""` |
| `{} == {}` | `false` | reference |
| `document.all == undefined` | quirk trình duyệt | **không** trên Node |

```ts
0 == false;         // true
0 === false;        // false
null == undefined;  // true
null === undefined; // false
"" == 0;            // true
```

- **Luôn** `===` trừ khi cố ý `x == null` để bắt cả `null` và `undefined` (một số style chấp nhận — tương đương `x === null \|\| x === undefined`).
- TS: so sánh kiểu không chồng nhau có thể báo lỗi tùy flag — vẫn nên `===`.

**Bẫy `==`:**

| Bẫy | Vì sao | Cách đúng |
|-----|--------|-----------|
| `==` với `0`/`""`/`false` | coercion chéo | `===` |
| `if (x == false)` | `0`/`""` lọt | `=== false` hoặc `!x` có chủ đích |
| Array/object vs primitive | ToPrimitive | không `==` |
| `document.all` | không liên quan Node | vẫn tránh `==` |

---

## 5. `===` vs `Object.is`

Strict Equality (`===`) vs `Object.is` (SameValue) — **chỉ khác hai chỗ**:

| Cặp | `===` | `Object.is` |
|-----|-------|-------------|
| `NaN`, `NaN` | `false` | `true` |
| `+0`, `-0` | `true` | `false` |
| Cùng primitive khác NaN/±0 | như nhau | như nhau |
| Hai object | reference | reference |

```ts
NaN === NaN;          // false
Object.is(NaN, NaN);  // true
Number.isNaN(NaN);    // true — prefer cho “có phải NaN?”

+0 === -0;            // true
Object.is(+0, -0);    // false

const a = {};
const b = {};
a === b;              // false
a === a;              // true
```

**SameValueZero** (Map / Set / `Array.includes`): `NaN` trùng `NaN`, **và** `+0` trùng `-0`.

| API | Thuật toán |
|-----|------------|
| `===` | Strict Equality |
| `Object.is` | SameValue |
| `Map`/`Set` key, `includes` | SameValueZero |
| `Object.isFrozen` … | không phải so sánh giá trị |

```ts
[NaN].includes(NaN);     // true
[+0].includes(-0);       // true
new Set([NaN, NaN]).size; // 1
```

- So sánh object: **tham chiếu**, không deep equal — dùng thư viện / so từng field / `Object.is` từng primitive.
- `Number.isNaN` không coerce (`Number.isNaN("foo") === false`); `isNaN("foo")` là `true`.

---

## 6. Logic: `!` `&&` `||`

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
- `!` luôn ra boolean; `!!x` = `Boolean(x)`.

```ts
const port = Number(process.env.PORT) || 3000;
// PORT=0 → 3000 — có thể sai → dùng parse + ?? / kiểm tra tường minh
```

TS: `&&` / `||` narrowing theo control flow; nhớ falsy hợp lệ (`0`, `""`) không bị loại nếu dùng `??`.

**Bẫy logic:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `const n = count \|\| 10` | `0` thành 10 | `??` |
| `a && b && c` gán | kiểu union rộng | `Boolean()` nếu cần bool |
| `!` bitwise nhầm `~` | `~0 === -1` | `!` cho boolean |

---

## 7. `??` vs `||`

**`??` (nullish coalescing):** chỉ thay khi `null` hoặc `undefined`. **Không** coi `0` / `""` / `false` / `NaN` là thiếu.

**`||`:** thay khi **falsy**.

```ts
0 ?? 10;          // 0
0 || 10;          // 10
"" ?? "x";        // ""
"" || "x";        // "x"
false ?? true;    // false
false || true;    // true
NaN ?? 1;         // NaN — không nullish
NaN || 1;         // 1
null ?? "x";      // "x"
undefined ?? "x"; // "x"
```

| Tình huống | Chọn |
|------------|------|
| `0` / `""` / `false` là giá trị hợp lệ | `??` / `??=` |
| Muốn default khi falsy (cố ý) | `\|\|` |
| `NaN` không hợp lệ | `Number.isFinite` — **không** dựa `??` |
| Env `PORT` | parse + kiểm tra `""` — không `Number(x) ??` |

```ts
(null || undefined) ?? "default";
(a && b) ?? c;
// a ?? b || c; // SyntaxError
```

**Bẫy `??`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `\|\|` thay `??` | `0`/`""` bị thay | `??` khi 0 hợp lệ |
| `??` với `NaN` | `NaN` không nullish | `Number.isFinite` |
| `Number(env) ?? 3000` | `Number(undefined)` là `NaN` | parse sau khi biết string |
| Trộn `??` với `&&`/`\|\|` | SyntaxError | ngoặc |

---

## 8. `?.` short-circuit vs `&&`

**`?.`**: nếu receiver **nullish** (`null`/`undefined`) → trả `undefined`, **không** đánh giá phần sau. Receiver **falsy khác** (`0`, `""`, `false`) **vẫn** truy cập.

**`&&`**: dừng khi vế trái **falsy bất kỳ**.

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

```ts
const n = 0;
n && n.toFixed(1); // 0 — short-circuit, không gọi
n?.toFixed(1);     // "0.0" — 0 không nullish

const s = "";
s && s.length;     // ""
s?.length;         // 0

null && null.foo;  // null
null?.foo;         // undefined — không ném

(obj && obj.method)(); // nếu obj nullish → TypeError: không phải hàm
obj?.method();         // undefined, không gọi
```

| | `a && a.b` | `a?.b` |
|--|------------|--------|
| `a` null/undefined | trả `a` (null/undefined) | `undefined` |
| `a` `0`/`""` | trả `a`, **không** đọc `.b` | đọc `.b` (box primitive) |
| Gọi method | `(a && a.m)()` có thể ném | `a?.m()` an toàn khi nullish |
| Ném trong getter | vẫn ném nếu `a` truthy | vẫn ném nếu `a` không nullish |

- `?.` không nuốt mọi lỗi — chỉ short-circuit khi nullish.
- `a?.b.c` — nếu `a` không nullish, `.c` vẫn chạy trên `b` (có thể `undefined.c` ném nếu viết `a?.b.c` khi `b` undefined: **`a?.b.c`** ≡ `(a == null ? undefined : a.b).c` — **`.c` không optional**).

```ts
a?.b.c;   // nếu a.b === undefined → đọc `.c` ném TypeError
a?.b?.c;  // an toàn từng tầng
```

**Bẫy `?.`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Coi `?.` = `&&` | `0` vẫn access | biết nullish ≠ falsy |
| `a?.b.c` | chỉ optional `b` | `?.` từng tầng cần thiết |
| Coi `?.` = try/catch | không bắt throw trong getter | try/catch khi cần |
| Optional chain quá tay | nuốt bug cấu hình bắt buộc | validate biên API |

---

## 9. Gán & gán hợp

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
- Logical assignment **không** gán nếu điều kiện không thỏa — RHS **không** đánh giá (short-circuit).
- LHS của compound được đánh giá **một lần** (quan trọng với getter / `obj[i++]`).
- Không có `?.=` ; optional assign: `if (obj) obj.x ??= 1` hoặc `obj && (obj.x = 1)`.

```ts
obj.items[i++] += 1; // i++ một lần
opts.count ??= compute(); // compute() không chạy nếu count đã có
```

- Destructuring assignment: `({ a, b } = obj)`; `[x, y] = pair`.
- Gán là expression (trả giá trị gán) — tránh xâu `a = b = c` trừ khi cố ý.
- `const` không rebind; gán property object `const` vẫn được.

**Bẫy gán:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `if (x = 1)` | gán trong điều kiện | `===`; lint |
| `\|\|=` nuốt `""` | như `\|\|` | `??=` |
| `a = b = c` khó đọc | side effect | tách |
| Destructure `undefined` | TypeError | default `= {}` / guard |

---

## 10. Spread & rest `...`

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
{ ...null, ...undefined }; // {} — no-op
// [...null]; // TypeError
```

**Bẫy spread:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Deep clone bằng `{...}` | nested cùng reference | `structuredClone` / thư viện |
| `[...obj]` | cần iterable | `Object.entries` |
| Rest không cuối | SyntaxError | rest cuối |

---

## 11. Bitwise signed 32 & `>>>`

Bitwise trên **number** đi qua **ToInt32** (32-bit **có dấu**, two’s complement) trước khi tính; `>>>` dùng **ToUint32** cho toán hạng trái (và kết quả không âm 0…2³²−1).

```ts
5 & 3;    // 1
5 | 3;    // 7
5 ^ 3;    // 6
~0;       // -1 (int32: đảo bit 0 → toàn 1 = -1)
1 << 5;   // 32
32 >> 2;  // 8  — số học (giữ dấu)
-1 >> 1;  // -1 — sign-extend
-1 >>> 1; // 2147483647
-1 >>> 0; // 4294967295 (ToUint32) — idiom “uint32”
```

| Toán tử | Ý | Number |
|---------|---|--------|
| `&` `\|` `^` | and/or/xor | ToInt32 cả hai |
| `~` | not | `~x` ≡ `-x-1` trên int32 |
| `<<` | shift trái | count **mod 32** (mask 5 bit) |
| `>>` | shift phải số học | giữ MSB (dấu) |
| `>>>` | shift phải logic | điền 0; trái như uint32 |

Idiom cắt bit trên number (không dùng cho ID 64-bit):

| Idiom | Nghĩa |
|-------|--------|
| `n \| 0` | ToInt32 |
| `n >>> 0` | ToUint32 |
| `n & 0xff` | byte thấp (sau ToInt32) |
| `n & 31` | mask shift 5 bit (tường minh hơn tin `<<`) |

```ts
1 << 31;     // -2147483648 — bit dấu
1 << 32;     // 1 — shift 0 (32 & 31 === 0)
1 << 40;     // 256 — 40 & 31 === 8, không phải 2^40
~0 >>> 0;    // 4294967295
(n | 0);     // cắt int32 (cả số âm)
```

- BigInt: `1n << 8n` không giới hạn 32-bit theo cùng quy tắc number; **không** có `>>>` trên BigInt; không trộn bit `number` với `bigint`.
- Shift BigInt: count âm → `RangeError`; không mask 5 bit.
- Dùng flag bit trong domain nhỏ OK; tiền tệ / ID 64-bit → BigInt hoặc tránh bit trên number.

```ts
1n << 8n;    // 256n
1n << 40n;   // 2n ** 40n — không wrap 32
// 1n >>> 1n; // SyntaxError — không có unsigned shift
// 1n & 1;    // TypeError
```

```ts
const flags = 0b1010;
const on = (flags & 0b0010) !== 0;

const big = 1n << 40n; // OK với BigInt
// 1 << 40; // mất ý nghĩa 2^40
```

**Bẫy bitwise:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `~` “đảo boolean” | `~0 === -1`, không phải `true` | `!` cho boolean |
| Shift ≥ 32 trên number | count mask 5 bit | BigInt hoặc mask tường minh |
| `&` ưu tiên thấp hơn `==` | `flags & MASK === 0` parse sai | `(flags & MASK) === 0` |
| Bit money / snowflake ID | int32 truncate | BigInt / string |
| `>>>` nghĩ “luôn dương cùng giá trị” | `-1 >>> 0` là 2³²−1 | chỉ khi muốn uint32 |

---

## 12. Comma, `void 0`, `?:`, grouping

```ts
const label = score >= 50 ? "pass" : "fail";

let i = 0;
for (let j = 0, k = 10; j < k; j++, k--) {
  // comma trong for header — phổ biến và OK
}

const v = (doSideEffect(), 42); // trả 42; tránh lạm dụng ngoài for
```

- Ternary lồng nhau khó đọc → `if` / lookup table / map.
- **Comma operator:** đánh giá trái → phải, **trả vế phải**; ưu tiên **thấp nhất**.
- Comma trong khai báo `let a = 1, b = 2` / param / array **không** phải comma operator.
- Grouping `()` đổi thứ tự / bắt buộc với `??` vs `||`.

```ts
const fee = kind === "pro" ? 10 : kind === "team" ? 25 : 0; // khó đọc
const fees = { pro: 10, team: 25 } as const;
const fee2 = fees[kind as keyof typeof fees] ?? 0;
```

### `void 0`

`void expr` đánh giá `expr` rồi trả **`undefined`**. `void 0` là idiom lấy `undefined` không phụ thuộc binding `undefined` bị shadow.

```ts
void 0;              // undefined
void someCall();     // cố ý bỏ return value
const undefined = 1; // đừng bao giờ
void 0;              // vẫn undefined
```

- `void promise` **không** bắt rejection — chỉ im lặng về giá trị; unhandled rejection vẫn xảy ra nếu không `.catch`.
- TS `void` **return type** ≠ toán tử `void` — xem [keywords.md](keywords.md).

**Bẫy comma / void / ternary:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Comma ngoài `for` | side effect ẩn | tách statement |
| `void fetch(...)` | nuốt Promise | `.catch` / await |
| Ternary lồng 3+ | khó review | lookup / `if` |
| `(0, obj.method)()` | mất `this` (cố ý hoặc bug) | biết hệ quả |

`(0, fn)()` / `(0, obj.m)()` gọi **không** gắn `this` receiver — pattern cũ; arrow thì không liên quan.

---

## 13. `typeof` — bảng kết quả

`typeof` luôn trả **string**. Unary, precedence cao.

| Toán hạng | `typeof` |
|-----------|----------|
| `undefined` / biến chưa gán | `"undefined"` |
| Identifier **chưa khai báo** | `"undefined"` — **không** `ReferenceError` |
| `let`/`const`/`class` trong **TDZ** | **`ReferenceError`** |
| `null` | `"object"` ← lịch sử |
| `true` / `false` | `"boolean"` |
| number / `NaN` / `Infinity` | `"number"` |
| `10n` | `"bigint"` |
| string | `"string"` |
| `Symbol()` | `"symbol"` |
| function / class constructor / async / generator | `"function"` |
| object / array / `new Date()` / regex | `"object"` |

```ts
typeof "a";       // "string"
typeof null;      // "object"
typeof [];        // "object"
typeof (() => {}); // "function"
typeof class {};  // "function"
typeof 1n;        // "bigint"
typeof Symbol();  // "symbol"
typeof notDeclared; // "undefined"

{
  // typeof x; // ReferenceError — TDZ
  let x = 1;
}
```

- `typeof` **value** vs `typeof` **type position** (TS) khác ngữ nghĩa — §18 và [typesystem.md](typesystem.md).
- Không đủ để phân array / null / plain object: kết hợp `=== null`, `Array.isArray`, `Object.getPrototypeOf`.
- `typeof fn` là `"function"` cho async, generator, class constructor — **không** phân biệt `async` bằng `typeof`.
- `typeof new Proxy(fn, {})` vẫn `"function"` nếu target callable.

```ts
typeof async function () {}; // "function"
typeof function* () {};      // "function"
Function.prototype.toString.call(async () => {}).startsWith("async"); // có thể dùng, giòn
```

**Bẫy `typeof`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `typeof null` | `"object"` | `=== null` |
| `typeof []` | `"object"` | `Array.isArray` |
| Tin `typeof` undeclared an toàn với `let` | TDZ ném | khai báo trước |
| `typeof` class instance | `"object"` | `instanceof` / brand / `Array.isArray` |
| `typeof async fn` | vẫn `"function"` | convention / `Function.prototype.toString` giòn |
| `typeof Proxy(fn)` | `"function"` nếu callable | không tin Proxy “ẩn” hàm |

---

## 14. `in` vs `Object.hasOwn`

```ts
"x" in { x: 1 };              // true (prototype chain)
"toString" in {};             // true — kế thừa
Object.hasOwn({ x: 1 }, "x"); // own only — ưu tiên nhiều case
Object.hasOwn({}, "toString"); // false
```

| API | Own? | Inherited? | Primitive receiver |
|-----|------|------------|--------------------|
| `key in obj` | có | **có** (enumerable hoặc không, string/symbol key) | RHS phải là object; mọi primitive → TypeError |
| `Object.hasOwn(obj, key)` | **chỉ own** | không | TypeError nếu nullish |
| `Object.prototype.hasOwnProperty.call` | own | không | dễ quên `.call`; key có thể bị shadow `hasOwnProperty` |
| `Object.keys` | own enumerable string | không | |

```ts
const o = Object.create({ inherited: 1 });
o.own = 2;
"inherited" in o;              // true
Object.hasOwn(o, "inherited"); // false
"own" in o;                    // true

"toString" in 1; // true — box Number
// "x" in null;  // TypeError
```

- `in` với symbol key: `sym in obj`.
- Narrowing TS: `"x" in obj` hẹp property — khác `hasOwn` (TS hỗ trợ `Object.hasOwn` narrowing ở bản hiện đại).
- Dictionary: `Object.create(null)` + `hasOwn` / `in` (không inherited `toString`).

**Bẫy `in`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `"toString" in obj` | luôn true trên object thường | `Object.hasOwn` |
| `for...in` | inherited enumerable | [statements.md](statements.md) |
| `in` null | TypeError | guard |

---

## 15. `instanceof` + realms

`obj instanceof Ctor` đi **prototype chain** của `obj` tìm `Ctor.prototype`. Không phải “cùng file class”.

```ts
[] instanceof Array;     // true
[] instanceof Object;    // true
Array.isArray([]);       // true — prefer cho array
```

**Realm** (iframe trình duyệt; trên Node: `node:vm` context, worker khác, duplicate bundle): **khác** `Array` / `Object` constructor.

```ts
import vm from "node:vm";

const ctx = vm.createContext({});
const otherArray = vm.runInContext("[]", ctx);
otherArray instanceof Array; // false — Array của realm khác
Array.isArray(otherArray);   // true — brand nội bộ
```

| Kiểm tra | Cross-realm |
|----------|-------------|
| `instanceof Array` | **fail** |
| `Array.isArray` | **OK** |
| `instanceof Uint8Array` | fail qua realm |
| `typeof` / `ArrayBuffer.isView` | tùy API |
| `error instanceof Error` | fail nếu Error khác realm |

`Symbol.hasInstance` cho phép class tự định nghĩa:

```ts
class Even {
  static [Symbol.hasInstance](x: unknown) {
    return typeof x === "number" && x % 2 === 0;
  }
}
2 instanceof Even; // true
```

- Plain data / DTO qua worker → `Array.isArray`, `typeof`, brand field — không `instanceof` class app.
- TS `instanceof` narrowing theo constructor cùng kiểu — lệch realm thì narrowing **sai** so với runtime.

**Bẫy `instanceof`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| Array từ `vm` / worker | `instanceof Array` false | `Array.isArray` |
| Duplicate `class User` hai bundle | fail | brand / `kind` field |
| `x instanceof Object` với primitive | false | không dùng để loại primitive |
| `null instanceof T` | false, không ném | vẫn `=== null` trước |

---

## 16. `delete` configurable

`delete obj.prop` xóa **own** property nếu `configurable: true`. Trả `true` khi thành công (hoặc property không tồn tại); **strict**: non-configurable → `TypeError`.

```ts
const o: { a?: number } = { a: 1 };
delete o.a; // true; `a` gone

const frozen = Object.freeze({ a: 1 });
// delete frozen.a; // TypeError ESM/strict

const sealed = Object.defineProperty({}, "x", {
  value: 1,
  configurable: false,
  writable: true,
});
// delete sealed.x; // TypeError strict
```

| Mục tiêu | Hành vi |
|----------|---------|
| Own configurable | xóa |
| Own non-configurable | fail (TypeError strict) |
| Inherited only | `delete` không đụng proto; trả true, property vẫn kế thừa |
| `delete arr[i]` | **hole** — `length` không giảm |
| `delete` binding `let`/`const`/`var` | SyntaxError strict / không làm được như kỳ vọng |
| Module namespace export | non-configurable |

```ts
const arr = [1, 2, 3];
delete arr[1];
arr.length;     // 3
arr.map((x) => x); // hole ở index 1
arr.splice(1, 1); // đúng cách bỏ phần tử
```

- Prefer gán `undefined` / omit khi build object / `Map.delete` — `delete` làm shape động, JIT kém hơn, TS optional lệch.
- Không dùng `delete` để “optional field” trên hot path.

**Bẫy `delete`:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `delete arr[i]` | sparse | `splice` / filter |
| `delete` để optional | shape động khó type | omit / `undefined` |
| Tin inherited bị xóa | chỉ own | proto vẫn còn |
| Non-configurable | TypeError | `configurable` lúc define |

---

## 17. `new`, `new.target`

```ts
const d = new Date();

function F() {
  if (new.target === undefined) throw new TypeError("Call with new");
}
```

- `new Ctor(...args)` tạo object, bind `this`, trả `this` trừ khi constructor `return` object — xem [statements.md](statements.md) § return trong constructor.
- `new.target` trong constructor/function: `undefined` nếu gọi không `new`; class constructor gọi thiếu `new` → TypeError sẵn.
- Arrow không có `new.target` / không làm constructor.

### 17.1 `yield` / `yield*` (operator, không phải statement thuần)

Trong generator, `yield expr` là **biểu thức** (trả giá trị `.next(x)` đưa vào). Precedence thấp, gần gán — **luôn ngoặc** khi trộn:

```ts
function* g() {
  const x = (yield 1) as number;
  yield* [2, 3]; // ủy quyền iterable
  return 4;
}
```

- `yield` ngoài `function*` → SyntaxError. `async function*` dùng `yield` (và `await`) — xem [keywords.md](keywords.md).
- Không `yield` xuống dòng nhờ ASI — giống `return` ([statements.md](statements.md)).

---

### 17.2 Precedence khác evaluation order

Precedence/grouping quyết định cây biểu thức; associativity quyết định cách nhóm operator cùng ưu tiên. Chúng không làm các operand function call chạy từ phải sang trái. JS đánh giá operand theo thứ tự trái → phải, trừ nhánh không được chọn của short-circuit/conditional.

```ts
f() + g() * h(); // gọi f, g, h; nhân kết quả g*h trước khi cộng
f() ** g() ** h(); // gọi f, g, h; nhóm f ** (g ** h)
a() && b(); // b không chạy nếu a() falsy
obj?.[c()]; // c không chạy nếu obj nullish
```

Getter, Proxy và coercion có side effect riêng khi bước đọc/chuyển đổi xảy ra. Tránh dùng biểu thức nhiều side effect làm giao thức thứ tự; tách thành statement khi cần kiểm soát. [ECMAScript expressions](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html).

---

## 18. TypeScript: `as`, `satisfies`, `is`, `!`, `keyof`, `typeof`

Các dạng này xuất hiện gần expression nhưng **không** phải toán tử JS runtime (trừ `typeof` **value**). Chi tiết hệ thống kiểu: [typesystem.md](typesystem.md).

```ts
const el = document.getElementById("app") as HTMLDivElement | null;
// assertion — không check runtime

const cfg = { port: 3000 } satisfies { port: number };
// kiểm tra gán được; giữ suy luận field

const s = maybeString!; // non-null assertion — nói với checker

function isStr(x: unknown): x is string {
  return typeof x === "string";
}

type Keys = keyof typeof cfg; // "port"
type Cfg = typeof cfg;        // type-query
```

| Cú pháp | Runtime | Vai trò |
|---------|---------|---------|
| `expr as T` | erase | ép kiểu checker (`as unknown as T` nguy hiểm) |
| `expr satisfies T` | erase | validate shape, giữ literal hẹp |
| `expr!` | erase | khẳng định non-nullish — **khác** `!expr` (logical not) |
| `x is T` | erase (chỉ chữ ký) | type predicate — `return` boolean phải đúng |
| `asserts x is T` | erase | assertion function — phải throw nếu sai |
| `keyof T` | erase | union key (string/number/symbol) |
| `typeof x` (type position) | erase | kiểu của giá trị `x` |
| `typeof x` (value) | **có** | string §13 |

```ts
!maybe;    // boolean — runtime NOT
maybe!;    // cùng giá trị runtime, TS bỏ `| null | undefined`

type User = { id: string; n?: number };
type K = keyof User; // "id" | "n"
```

- Prefer narrowing / guards / `satisfies` hơn `as` / `!` mù.
- `keyof` array → `number \| …`; `keyof` class instance vs constructor khác nhau.
- `typeof` type-query cần giá trị trong scope (`const`/`function`) — không `typeof SomeInterface`.

**Bẫy TS-ops:**

| Bẫy | Chi tiết | Cách đúng |
|-----|----------|-----------|
| `as` / `!` | crash runtime | guard thật |
| Predicate `return true` luôn | TS tin nhầm | implement đúng |
| Nhầm `!x` và `x!` | not vs assert | vị trí postfix |
| `enum` + `keyof` numeric | reverse map | const object — [typesystem.md](typesystem.md) |

---

## 19. Bẫy thường gặp

| Bẫy | Dấu hiệu | Cách đúng |
|-----|----------|-----------|
| `==` coercion | `"" == 0` | `===` |
| `NaN === x` | luôn false | `Number.isNaN` / `Object.is` |
| `\|\|` nuốt `0` | default port sai | `??` / parse tường minh |
| Trộn `??` với `\|\|` | SyntaxError | ngoặc |
| `?.` vs `&&` | `0 && x` khác `0?.x` | nullish ≠ falsy |
| Bit `&` vs `===` | `flags & M === 0` | `(flags & M) === 0` |
| `**` phải | `2 ** 3 ** 2 === 512` | ngoặc |
| `-2 ** 2` | SyntaxError | ngoặc |
| `>>>` / shift 32 | wrap int32 | BigInt / mask |
| `delete` / sparse | length giữ, hole | `splice` |
| `typeof null` | `"object"` | `=== null` |
| `typeof` TDZ | ReferenceError | khai báo trước |
| `in` prototype | `"toString" in obj` | `Object.hasOwn` |
| `instanceof` realm | `vm` array fail | `Array.isArray` |
| `as` / `!` | crash runtime | guard thật |
| Optional chain quá tay | nuốt bug cấu hình | validate biên API |
| Comma ngoài `for` | side effect ẩn | tách statement |
| `void` che Promise | unhandled rejection | `.catch` |

---

## 20. Best practices

1. Mặc định `===` / `!==`; `== null` chỉ khi team chấp nhận bắt cả nullish.
2. Default config: `??=` / `??`; tránh `||` khi `0`/`""`/`false` hợp lệ.
3. Optional chaining cho access sâu có thể thiếu; không thay validation input; đặt `?.` đúng tầng.
4. Ngoặc khi trộn bit, `??`, `**`, hoặc biểu thức dài — đọc trước “thông minh”.
5. Prefer `Object.hasOwn`, `Array.isArray`, `Object.is`, `Number.isNaN` / `Number.isFinite`.
6. Tránh bitwise trên number lớn; flag nhỏ OK; biết `>>> 0` là uint32.
7. TS: `satisfies` + narrowing + `keyof`/`typeof` type-query; hạn chế `as` / `!` — [typesystem.md](typesystem.md).
8. Không dùng comma operator cho “clever” one-liner ngoài header `for`.
9. `void 0` hữu ích khi cần `undefined` thật; `void promise` phải có chiến lược lỗi.
10. Cross-realm (vm/worker): đừng tin `instanceof`.
11. `typeof` không phân `async function`; bitwise number luôn 32-bit — hai sự thật hay quên.
12. `yield` / `yield*` ngoặc khi trộn; không ASI tách dòng.
13. Không có `?.=` — gán optional viết `if` / `??=` trên receiver đã hẹp.

---

## 21. Checklist

```text
□ Không còn == trừ == null có chủ đích?
□ Default dùng ?? / ??= khi 0 hoặc "" hợp lệ?
□ ?. không che lỗi cấu hình bắt buộc; khác && với 0/""?
□ Bitwise có ngoặc với so sánh? Shift 32 đã hiểu?
□ ** associativity / unary đã ngoặc?
□ Không delete tạo sparse array?
□ typeof / instanceof / hasOwn / Array.isArray đúng chỗ?
□ Object.is vs === khi NaN / ±0 quan trọng?
□ as / ! / x is T có justification — hoặc đã thay guard?
□ ?? không trộn || / && thiếu ngoặc?
□ void Promise có .catch / policy?
□ typeof không dùng để nhận async function?
```

---

## 22. Cheat sheet

| Cần | Dùng |
|-----|------|
| So khớp kiểu | `===` |
| Null hoặc undefined | `== null` hoặc `??` / `??=` |
| Falsy default (cố ý) | `\|\|` / `\|\|=` |
| Access sâu nullish | `?.` |
| Own key | `Object.hasOwn` |
| Array (kể cả realm) | `Array.isArray` |
| NaN | `Number.isNaN` / `Object.is` |
| ±0 khác nhau | `Object.is` |
| SameValueZero (Set/Map) | collection — NaN trùng, ±0 trùng |
| Merge nông | `{ ...a, ...b }` |
| uint32 | `n >>> 0` |
| int32 | `n \| 0` |
| Bỏ giá trị | `void expr` (có chủ đích) |
| `undefined` không shadow | `void 0` |
| Check shape, giữ suy luận | `as const satisfies T` |
| Predicate | `x is T` |
| Keys / type-of-value | `keyof T` / `typeof v` (type pos.) |

```ts
opts.timeout ??= 5_000;
const city = user.address?.city ?? "n/a";
if ((flags & READ) !== 0) { /* ... */ }
2 ** (3 ** 2);
Object.hasOwn(obj, "id");
Array.isArray(x);
```

---

## 23. Version notes

| Giai đoạn | Liên quan toán tử |
|-----------|-------------------|
| ES3–5 | `==`/`===`, bitwise, `in`, `instanceof`, `typeof`, `delete`, `void` |
| ES2015 | spread array; `for...of` (statement); nhiều op cũ ổn định |
| ES2016 | `**` |
| ES2019+ | `Object.fromEntries` (không phải op) |
| ES2020 | `??`, `?.`, `bigint` ops |
| ES2021 | `??=` `&&=` `\|\|=`; numeric `_` (literals) |
| ES2022 | `Object.hasOwn` |
| TS 4.9+ | `satisfies` |
| TS / Node 26 | assertion erase + type strip — không invent runtime từ `as` |

Baseline: **Node 26** + **TS 7**.

---

## 24. Tài liệu liên quan

- [literals.md](literals.md) — số, BigInt, template
- [keywords.md](keywords.md) — `typeof`/`instanceof`/`in`/`void`/`delete` như từ khóa
- [statements.md](statements.md) — `for` header, expression statements, comma
- [typesystem.md](typesystem.md) — narrowing, `satisfies`, `keyof`, predicates
- [functions-methods.md](functions-methods.md) — `this` với `(0, obj.m)()`
- [functions-callbacks.md](functions-callbacks.md) — rest params
- [exceptions.md](exceptions.md) — `throw`, `instanceof Error`

- [Object keys & prototype pollution](security.md)
