# Hàm & Method trong JavaScript / TypeScript

Trong JS/TS, **hàm** là giá trị first-class; **method** là hàm gắn object/class. Baseline: **ESM**, **Node.js 26**, **TypeScript 7**.

Kiểu hàm / callback / HOF → [functions-callbacks.md](functions-callbacks.md). `async` → [async.md](async.md). `using` đầy đủ → [statements.md](statements.md#11-using-vs-tryfinally). Iterator / `function*` sâu → [iterables-linq.md](iterables-linq.md).

---

## Mục lục

- [1. Declaration vs expression vs arrow](#1-declaration-vs-expression-vs-arrow)
  - [1.1 Declaration (hoisted)](#11-declaration-hoisted)
  - [1.2 Expression](#12-expression)
  - [1.3 Arrow](#13-arrow)
  - [1.4 So sánh](#14-so-sánh)
  - [1.5 `length`, default params, rest](#15-length-default-params-rest)
- [2. `this` binding](#2-this-binding)
  - [2.1 Bảng exhaustive (non-arrow)](#21-bảng-exhaustive-non-arrow)
  - [2.2 `new.target`](#22-newtarget)
  - [2.3 Class method vs arrow field](#23-class-method-vs-arrow-field)
  - [2.4 Annotate `this` (TS)](#24-annotate-this-ts)
  - [2.5 Proxy, `this` & method extract](#25-proxy-this--method-extract)
  - [2.6 `this` trong callback Node](#26-this-trong-callback-node)
- [3. Tham số: default, rest, spread, optional](#3-tham-số-default-rest-spread-optional)
  - [3.1 Default — chỉ `undefined`, lazy, TDZ](#31-default--chỉ-undefined-lazy-tdz)
  - [3.2 Rest & `arguments`](#32-rest--arguments)
  - [3.3 Destructuring & options object](#33-destructuring--options-object)
  - [3.4 Optional (TS)](#34-optional-ts)
- [4. Overload trong TypeScript](#4-overload-trong-typescript)
  - [4.1 Implementation vs declaration](#41-implementation-vs-declaration)
  - [4.2 Class / interface](#42-class--interface)
  - [4.3 Overload + generic / type predicate](#43-overload--generic--type-predicate)
  - [4.4 Merge chữ ký (declaration merging)](#44-merge-chữ-ký-declaration-merging)
- [5. Closure, TDZ & loop capture](#5-closure-tdz--loop-capture)
  - [5.1 Closure](#51-closure)
  - [5.2 TDZ](#52-tdz)
  - [5.3 Loop capture](#53-loop-capture)
- [6. Method trên object & class](#6-method-trên-object--class)
  - [6.1 Method vs function property](#61-method-vs-function-property)
  - [6.2 Tách method & wrapper](#62-tách-method--wrapper)
- [7. Getter / Setter](#7-getter--setter)
  - [7.1 Side effects — getter bị gọi “vô hình”](#71-side-effects--getter-bị-gọi-vô-hình)
  - [7.2 Setter chỉ `undefined` vs omit](#72-setter-chỉ-undefined-vs-omit)
- [8. `call` / `apply` / `bind`](#8-call--apply--bind)
  - [8.1 `bind` — `name` / `length` / `new`](#81-bind--name--length--new)
  - [8.2 `Function.prototype.toString`](#82-functionprototypetostring)
  - [8.3 `length` của wrapper Node](#83-length-của-wrapper-node)
- [9. Generator functions](#9-generator-functions)
  - [9.1 `next` / `throw` / `return`](#91-next--throw--return)
  - [9.2 Async generator](#92-async-generator)
- [10. `async function` (tóm tắt)](#10-async-function-tóm-tắt)
  - [10.1 `async` method vs `async` arrow field](#101-async-method-vs-async-arrow-field)
- [11. `using` & Explicit Resource Management](#11-using--explicit-resource-management)
  - [11.1 Function / block scope](#111-function--block-scope)
- [12. Chi phí & pitfalls](#12-chi-phí--pitfalls)
  - [12.1 Tail-call **không** được đảm bảo](#121-tail-call-không-được-đảm-bảo)
  - [12.2 Recursive stack](#122-recursive-stack)
- [13. Best practices](#13-best-practices)
- [14. Checklist](#14-checklist)
- [15. Cheat sheet](#15-cheat-sheet)
- [16. Version matrix](#16-version-matrix)
- [17. Tài liệu liên quan](#17-tài-liệu-liên-quan)

---

## 1. Declaration vs expression vs arrow

### 1.1 Declaration (hoisted)

```ts
function add(a: number, b: number): number {
  return a + b;
}
add(2, 3); // gọi được trước khai báo — hoist cả thân
```

Có `prototype` → `new` được (hiếm trong code hiện đại). `add.name === "add"`. `add.length === 2` (đếm param trước rest / trước default đầu tiên — xem §8.3).

Declaration trong block (ESM/strict) **không** hoist ra ngoài block — khác `var function` sloppy cũ:

```ts
{
  function inner() {
    return 1;
  }
}
// inner(); // ReferenceError ở ESM
```

### 1.2 Expression

```ts
const multiply = function (a: number, b: number): number {
  return a * b;
};

const factorial = function fact(n: number): number {
  return n <= 1 ? 1 : n * fact(n - 1); // tên nội bộ chỉ trong thân
};
```

`const`/`let` → **TDZ**; không gọi trước khởi tạo. Named function expression: tên (`fact`) **không** leak ra ngoài — hữu ích đệ quy / stack trace mà không pollute scope.

Anonymous expression: `multiply.name` vẫn là `"multiply"` nhờ inference từ binding (ES2015+). Gán gián tiếp có thể mất tên:

```ts
const ops = { mul: function (a: number, b: number) { return a * b; } };
ops.mul.name; // "mul" (method inference)
const detached = function (x: number) { return x; };
detached.name; // "" — stack khó đọc hơn
```

### 1.3 Arrow

```ts
const square = (x: number) => x * x;
const toPoint = (x: number, y: number) => ({ x, y }); // object → bọc `(...)`
```

- **`this` lexical**; không `arguments` / `super` / `new.target` riêng; không làm constructor.
- Phù hợp callback khi không cần `this` dynamic.
- Không có `prototype`. `new square()` → `TypeError`.
- Nested arrow **không** tạo `arguments` — nhìn ra hàm non-arrow bao quanh (nếu có).

Arrow IIFE: `(() => { … })()` không tạo `this` mới. Dùng khi cần block expression (module init). `void fn()` khi cố ý bỏ Promise — không liên quan `length`.

---

### 1.4 So sánh

| | Declaration | Expression | Arrow |
|---|---|---|---|
| Hoist | Có (cả thân) | Không (TDZ) | Không |
| `this` | Dynamic | Dynamic | **Lexical** |
| `arguments` | Có | Có | Không → rest |
| `new` / `prototype` | Có | Có | **Không** |
| `super` / `new.target` | Có (nếu hợp lệ) | Có | Lexical từ enclosing |
| `name` | Tên khai báo | Inference / tên nội bộ | Inference từ binding |

> **Callout:** Public API có tên → declaration; callback ngắn → arrow; gán có điều kiện / named FE đệ quy → expression. Đừng dùng arrow làm constructor hay method cần `super`.

### 1.5 `length`, default params, rest

`fn.length` **không** đếm rest; dừng trước default **đầu tiên**:

```ts
function a(x: number, y: number) {}
a.length; // 2
function b(x: number, y = 1, z?: number) {}
b.length; // 1 — `y` có default
function c(x: number, ...rest: number[]) {}
c.length; // 1
function d(...rest: number[]) {}
d.length; // 0
```

TS optional `b?` **không** đổi `length` runtime trừ khi emit default. Đừng dùng `length` làm “số arg bắt buộc” của public API — document options object.

IIFE:

```ts
const config = (() => {
  const port = Number(process.env.PORT ?? 3000);
  return { port };
})();
```

Named IIFE đệ quy: `(function walk(n: Node): void { … walk(child); })(root)`.

`fn.length` với param destructure: `function f({ a }: Opts)` → `length === 1` (một binding), không phải số field. Options object không tăng `length`.

---

## 2. `this` binding

`this` **không** bind lúc khai báo (trừ arrow). Engine quyết định lúc **gọi**. ESM / class / `"use strict"` → bare call cho `this === undefined` (không phải `globalThis`).

### 2.1 Bảng exhaustive (non-arrow)

| Cách gọi | `this` (strict / ESM) | `new.target` | Ghi chú |
|---|---|---|---|
| `obj.fn()` | `obj` | `undefined` | Member call |
| `obj["fn"]()` | `obj` | `undefined` | Giống `.` |
| `obj?.fn()` | `obj` nếu gọi | `undefined` | Optional **vẫn** là method call |
| `const { fn } = obj; fn()` | `undefined` | `undefined` | Mất receiver |
| `(0, obj.fn)()` / `const f = obj.fn; f()` | `undefined` | `undefined` | Indirect / detached |
| `fn()` | `undefined` | `undefined` | Bare call |
| `fn.call(x, …)` | `x`; `null`/`undefined` → `undefined` | `undefined` | |
| `fn.apply(x, args)` | như `call` | `undefined` | |
| `fn.bind(x)()` | `x` (cố định) | `undefined` | `call` sau bind **không** đổi `this` |
| `new fn()` | instance mới | `fn` | `this` instance; `prototype` chain |
| `new (fn.bind(x))()` | instance mới | `fn` (target) | bind **bỏ** `this` khi `new`; args bound vẫn prepend |
| `Reflect.apply(fn, t, args)` | `t` | `undefined` | Tường minh |
| `Reflect.construct(fn, args, newT)` | instance `newT.prototype` | `newT` | |
| `super.fn()` | `this` hiện tại | `undefined` | Home object / `[[HomeObject]]` |
| `setTimeout(obj.fn, 0)` | `undefined` | `undefined` | Pass method = detach |
| `emitter.on("x", obj.fn)` | `undefined` (trừ API tự bind) | `undefined` | Node `EventEmitter` **không** bind |
| Tagged template | Bare `tag`: `undefined`; `obj.tag`: `obj` | Theo call site | Method tag vẫn giữ receiver |
| `arr.forEach(obj.fn)` | `undefined` (trừ `thisArg` đối số 2) | `undefined` | `forEach`/`map` nhận `thisArg` |
| Class static `C.m()` | `C` (constructor) | `undefined` | Detach `const { m } = C` mất `this` |
| Class field initializer | instance đang construct | — | Chạy như thể trong ctor |
| Arrow (mọi cách gọi) | lexical enclosing | lexical enclosing | Bỏ qua bảng trên |

```ts
const obj = {
  name: "node",
  greet() {
    return `hi ${this.name}`;
  },
};
const greet = obj.greet;
obj.greet(); // "hi node"
greet();     // TypeError / undefined (strict)
```

### 2.2 `new.target`

`new.target` là meta-property: constructor **được gọi trực tiếp** bằng `new` (hoặc `Reflect.construct` `newTarget`). Không phải `this.constructor` — subclass có thể khác.

```ts
function C() {
  if (new.target === undefined) {
    throw new TypeError("Call with new");
  }
}

class Base {
  constructor() {
    // new Derived() → new.target === Derived
  }
}
class Derived extends Base {}
```

- Arrow **không** có `new.target` riêng — dùng enclosing function/class.
- Factory giả constructor: kiểm `new.target` hoặc luôn `return Object.create(…)`.
- `new.target.prototype` hữu ích khi subclassing builtin (`Error`) — xem [exceptions.md](exceptions.md).

### 2.3 Class method vs arrow field

```ts
class Counter {
  count = 0;
  inc = () => {
    this.count++;
  }; // mỗi instance một hàm — callback OK
  dec() {
    this.count--;
  } // prototype — cần bind nếu tách
}

const c = new Counter();
setTimeout(c.inc, 0); // OK
setTimeout(c.dec, 0); // this sai
```

| Cách | Callback giữ `this`? | Bộ nhớ | `super` |
|---|---|---|---|
| Prototype method | Không (trừ bind) | Share | Có |
| Arrow field / `bind` ctor | Có | Mỗi instance | **Không** (`super` trong arrow field không hợp lệ như method) |
| Wrap `() => svc.handle()` | Có | Closure mỗi lần gán | n/a |

> Arrow field / bind trên hàng loạt instance tốn bộ nhớ hơn. Hot path → prototype + bind khi cần, hoặc wrap call-site.

### 2.4 Annotate `this` (TS)

```ts
function label(this: { name: string }, punct: string) {
  return `${this.name}${punct}`;
}
label.call({ name: "Lan" }, "!");
```

`this` parameter không phải đối số runtime — chỉ kiểm tra kiểu. Đặt **đầu tiên**. Arrow không khai `this` param (lexical).

`ThisParameterType<F>` / `OmitThisParameter<F>` lấy / bỏ `this` trên function type — hữu ích khi `bind`.

### 2.5 Proxy, `this` & method extract

```ts
const target = {
  n: 1,
  inc() {
    this.n++;
  },
};
const proxy = new Proxy(target, {});
proxy.inc(); // this === proxy (không phải target) — field trên target có thể lệch
```

`get` trap trả method raw: `this` phụ thuộc cách gọi. Với private fields/native internal slots, proxy không mang brand của target; bind vào `receiver` vẫn có thể lỗi. Có thể bind vào **target** nếu hợp đồng cần brand, nhưng cache wrapper để giữ identity và đánh giá việc bypass trap. Proxy trong ví dụ không có trap vẫn forward ghi `n` xuống target.

`with` (cấm ESM) và sloppy `this === globalThis` — không thuộc baseline Node ESM.

### 2.6 `this` trong callback Node

`fs.readFile(path, cb)` không cung cấp receiver nghiệp vụ cho callback. `EventEmitter.emit` gọi listener **thường** với `this === emitter`; arrow giữ `this` lexical, hàm đã `bind` giữ receiver đã bind. Khi cần instance của service, dùng arrow hoặc bind. [Hợp đồng EventEmitter](https://nodejs.org/api/events.html#passing-arguments-and-this-to-listeners).

---

## 3. Tham số: default, rest, spread, optional

### 3.1 Default — chỉ `undefined`, lazy, TDZ

```ts
function connect(host = "127.0.0.1", port = 5432) {
  return `${host}:${port}`;
}
connect();
connect(undefined, 3306); // default host
connect(null as any, 1);  // host = null — null ≠ undefined!
```

Default chỉ khi **`undefined`**. Biểu thức đánh giá lúc gọi (lazy):

```ts
function createId(factory = () => crypto.randomUUID()) {
  return factory();
}
```

**TDZ của default params** — mỗi param có binding riêng; default **không** thấy body, và chưa init thì không đọc được:

```ts
function bad(a = b, b = 1) {
  return [a, b];
}
// bad(); // ReferenceError — `b` còn TDZ khi đánh `a`

function ok(a = 1, b = a) {
  return [a, b]; // [1, 1]
}

const x = 10;
function shadow(x = x) {
  return x;
}
// shadow(); // ReferenceError — `x` param TDZ, không phải outer `x`
```

Default **không** nhìn function/var trong body (scope params ≠ body):

```ts
function f(a = inner()) {
  function inner() {
    return 1;
  }
  return a;
}
// f(); // ReferenceError: inner is not defined
```

> **Callout:** Default tạo temporal dead zone **giữa các param**. Thứ tự trái → phải. Outer binding bị param cùng tên che **kể cả trong default**.

### 3.2 Rest & `arguments`

```ts
function sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
sum(1, 2, 3);
sum(...([1, 2, 3] as const));
```

| | Rest `...args` | `arguments` |
|---|---|---|
| Kiểu runtime | `Array` thật (`Array.isArray`) | Array-like (`length`, index) |
| Arrow | OK | **Không có** (nhìn enclosing) |
| TS | Typed `T[]` / tuple rest | Gần như `any` / legacy |
| Vị trí | Phải **cuối** | Luôn toàn bộ args |
| Strict / ESM | Không mapped | **Không mapped** với named params |
| `callee` | — | Cấm trong strict |
| Iterator | Có | Có (`arguments` iterable) |

ESM = strict: gán `arguments[0] = …` **không** đổi param đã đặt tên (khác sloppy mapped arguments). Đừng dựa hành vi sloppy.

Arrow lồng trong non-arrow **có thể** đọc `arguments` của hàm ngoài — dễ bug. Prefer rest tường minh:

```ts
function outer() {
  const inner = () => arguments[0]; // arguments của outer — dễ nhầm
  return inner();
}
```

Rest phải ở cuối. Không kết hợp “rest giữa chừng”.

`arguments` vẫn chứa **mọi** đối số kể cả khi có rest (`function f(...r) { arguments.length }`). Vừa rest vừa `arguments` = hai hình dạng cùng input — chọn một. Convert array-like: `Array.from(arguments)` hoặc `[...arguments]` (iterable).

Param + default + `arguments` (strict): `arguments` phản ánh **giá trị truyền vào**, không phải giá trị sau default:

```ts
function f(a = 1) {
  return [a, arguments[0], arguments.length];
}
f();        // [1, undefined, 0]
f(undefined); // [1, undefined, 1]
f(2);       // [2, 2, 1]
```

### 3.3 Destructuring & options object

```ts
type FetchOpts = {
  method?: "GET" | "POST";
  timeoutMs?: number;
  headers?: Record<string, string>;
};

function fetchJson(
  url: string,
  { method = "GET", timeoutMs = 5_000, headers = {} }: FetchOpts = {},
) {
  return { url, method, timeoutMs, headers };
}
```

Default `= {}` cho cả object: gọi `fetchJson(url)` được. Thiếu `= {}` thì `fetchJson(url)` lỗi destructure `undefined`.

> Prefer **options object** khi ≥ 3 tham số tùy chọn.

### 3.4 Optional (TS)

```ts
function f(a: number, b?: number, c = 1) {}
// b?: ≈ number | undefined ở call-site; required không đứng sau optional (trừ default/rest)
```

Tham số `b?: number` chấp nhận cả bỏ đối số **và** truyền `undefined`; `b: number | undefined` yêu cầu vị trí đối số vẫn được truyền. `exactOptionalPropertyTypes` chỉ siết **property** như `{ b?: number }`, không thay quy tắc tham số hàm.

---

## 4. Overload trong TypeScript

Runtime không có overload thật — TS: nhiều chữ ký + **một** implementation. Caller **chỉ** thấy overload declarations; implementation signature là nội bộ.

```ts
function parse(input: string): object;
function parse(input: string, reviver: (k: string, v: unknown) => unknown): object;
function parse(input: Buffer): object;
function parse(
  input: string | Buffer,
  reviver?: (k: string, v: unknown) => unknown,
): object {
  const text = typeof input === "string" ? input : input.toString("utf8");
  return reviver ? JSON.parse(text, reviver) : JSON.parse(text);
}
```

1. Overload signatures = public API.
2. Implementation bao các overload (caller không thấy).
3. Cụ thể trước, rộng sau — TS match **đầu tiên** phù hợp.

### 4.1 Implementation vs declaration

| | Overload declaration | Implementation |
|---|---|---|
| Caller thấy? | Có | **Không** |
| Độ rộng | Từng case hẹp | Union **bao hết** |
| Return | Từng case | Union / rộng hơn |
| Dùng generic riêng | Được từng chữ ký | Phải tương thích tất cả |

Implementation **không** được hẹp hơn overload (ví dụ overload nhận `string` nhưng impl chỉ `Buffer`). Ngược lại impl thường rộng (`string | Buffer`) — caller không gọi được impl signature trực tiếp.

Sai phổ biến: viết logic theo impl union rồi quên overload không match thứ tự:

```ts
function take(x: string): string;
function take(x: string[]): string[];
function take(x: string | string[]): string | string[] {
  return x;
}
take(["a"]); // string[] — OK vì overload 2
// Nếu đảo overload string[] trước string: string cũng gán được cho string[]? không —
// nhưng `any` / widening dễ match nhầm overload đầu.
```

### 4.2 Class / interface

```ts
class Encoder {
  encode(value: string): Uint8Array;
  encode(value: number): Uint8Array;
  encode(value: string | number): Uint8Array {
    return new TextEncoder().encode(String(value));
  }
}
```

Interface có thể **chỉ** overload (không impl). Class phải có impl tương thích.

Khi union/generic đủ rõ → khỏi overload (`identity<T>(x: T): T`). Discriminated union thường rõ hơn chuỗi overload dài — [functions-callbacks.md](functions-callbacks.md) §9.

### 4.3 Overload + generic / type predicate

```ts
function pick(obj: object, key: string): unknown;
function pick<T, K extends keyof T>(obj: T, key: K): T[K];
function pick(obj: object, key: PropertyKey): unknown {
  return (obj as Record<PropertyKey, unknown>)[key];
}
```

Overload generic phải **tương thích** impl. Predicate overload:

```ts
function is(x: unknown, k: "str"): x is string;
function is(x: unknown, k: "num"): x is number;
function is(x: unknown, k: "str" | "num"): x is string | number {
  return k === "str" ? typeof x === "string" : typeof x === "number";
}
```

Sau `if (is(x, "str"))` TS thu hẹp theo overload đã match — impl union không làm được điều đó nếu chỉ một chữ ký `x is string | number`.

### 4.4 Merge chữ ký (declaration merging)

Interface callable overload merge được; `function` implementation trong `.ts` **một** impl. Ambient `.d.ts` có thể chỉ liệt overload. Đừng copy overload Node (`fs.readFile`) vào app — import `@types/node`.

---

## 5. Closure, TDZ & loop capture

### 5.1 Closure

```ts
function makeCounter(start = 0) {
  let n = start;
  return () => ++n;
}
const c = makeCounter();
c(); // 1
```

Giữ reference lexical — object lớn captured trì hoãn GC. HOF/callback → [functions-callbacks.md](functions-callbacks.md).

### 5.2 TDZ

```ts
// console.log(x); // ReferenceError
const x = 1;
const fn = () => y;
const y = 2;
fn(); // 2 — gọi trước init y → ReferenceError
```

Closure **đóng over binding**, không snapshot giá trị lúc tạo hàm. Gọi sau khi init thì đọc được; gọi trong TDZ thì `ReferenceError`.

### 5.3 Loop capture

```ts
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0); // 3,3,3 — một binding
}
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log(j), 0); // 0,1,2 — mỗi iter một binding
}
```

> Prefer `let`/`const` trong vòng. `var` legacy: IIFE hoặc bind đối số. Async trong vòng ≠ “closure sai” — xem [async.md](async.md).

---

## 6. Method trên object & class

```ts
const calculator = {
  base: 10,
  add(x: number) {
    return this.base + x;
  },
};

class UserRepo {
  constructor(private readonly db: { query: (sql: string) => Promise<unknown> }) {}
  async findById(id: string) {
    return this.db.query("select * from users where id = $1");
  }
  static empty() {
    return new UserRepo({ query: async () => null });
  }
}
```

- Instance method trên `prototype` (share); `static` qua class.
- Parameter property TS tiện DI đơn giản — **không erasable** với `node file.ts` / `erasableSyntaxOnly` → [tsconfig.md](tsconfig.md), [oop.md](oop.md).

```ts
class Hasher {
  hash(input: string) {
    return this.#digest(input);
  }
  #digest(input: string) {
    return input;
  } // native private
  private legacy(input: string) {
    return input;
  } // TS-only — erase lúc emit
}
```

Prefer `#` khi cần ẩn runtime.

### 6.1 Method vs function property

Ba cách gắn hàm lên object **không** tương đương:

```ts
const proto = {
  kind: "obj",
  method() {
    return this.kind;
  }, // method shorthand — có [[HomeObject]] (cho `super` nếu object có __proto__ meaningful)
  prop: function () {
    return this.kind;
  }, // function property — `this` dynamic, không `super`
  arrow: () => this, // lexical — thường globalThis/undefined, hiếm khi đúng
};

class Service {
  method() {}
  prop = function (this: Service) {};
  arrow = () => {};
}
```

| | Method shorthand / class method | Function property | Arrow field |
|---|---|---|---|
| Nằm đâu | prototype (class) / own enumerable (object literal method) | own | own mỗi instance |
| `this` | dynamic | dynamic | lexical |
| `super` | Có (class / object có proto) | Không | Không |
| Enumerable (class) | `false` trên prototype | field → `true` | `true` |
| TS variance callback | Method **bivariant** lịch sử | Function prop **contravariant** (`strictFunctionTypes`) | như function |

Object literal `method()` enumerable `true`; class method enumerable `false`. `JSON.stringify` / `Object.assign` copy **không** lấy class method trên prototype.

> **Callout:** API callback typed: prefer **function property** `handle: (x: T) => void` thay `handle(x: T): void` để `strictFunctionTypes` bắt param không an toàn. Chi tiết variance → [functions-callbacks.md](functions-callbacks.md) §8.

`Function.prototype.toString` trên method class thường gồm `method()` không có `function` keyword — đừng parse source thủ công.

Tagged template nhận array template có `.raw` và values. Bare `tag` dùng bare-call `this`; `obj.tag` làm tag vẫn có `this === obj`. Template object được tái sử dụng tại cùng call site, không phải object mới mỗi lần.

---

### 6.2 Tách method & wrapper

```ts
class Svc {
  handle(id: string) {
    return this.lookup(id);
  }
  lookup(id: string) {
    return id;
  }
}

const s = new Svc();
const lost = s.handle;           // this mất khi gọi lost("x")
const ok = s.handle.bind(s);
const wrap = (id: string) => s.handle(id); // dễ đọc; alloc 1 closure
```

`util.promisify(s.method)` cũng detach `this` — bind trước hoặc `.call(s)` lúc gọi. Xem [functions-callbacks.md](functions-callbacks.md) §2.

Decorator / Proxy wrap method: giữ `name`/`length` bằng `Object.defineProperty` hoặc trả `function` declaration nội bộ có tên — stack trace ops sẽ đọc `name`.

---

## 7. Getter / Setter

```ts
class Temperature {
  #celsius = 0;
  get celsius() {
    return this.#celsius;
  }
  set celsius(value: number) {
    if (!Number.isFinite(value)) throw new TypeError("invalid temperature");
    this.#celsius = value;
  }
  get fahrenheit() {
    return (this.#celsius * 9) / 5 + 32;
  }
  set fahrenheit(f: number) {
    this.celsius = ((f - 32) * 5) / 9;
  }
}
const t = new Temperature();
t.fahrenheit = 212;
t.celsius; // 100
```

- Không gọi `t.celsius()` — trông như property.
- Setter: validate rồi `throw`; `Object.defineProperty` khi cần `enumerable`/`configurable`.

### 7.1 Side effects — getter bị gọi “vô hình”

Getter chạy mỗi lần **đọc** property. Nhiều API đọc hàng loạt:

| Tác nhân | Hành vi |
|---|---|
| `obj.x` / destructure `{ x } = obj` | Gọi getter `x` |
| `Object.assign({}, obj)` / `{ ...obj }` | Gọi enumerable own getters, copy **giá trị** (không copy accessor) |
| `JSON.stringify(obj)` | Gọi enumerable getters |
| `console.log` / util inspect | Có thể đọc nhiều lần |
| `for...in` + truy cập `obj[k]` | Gọi nếu enumerate rồi đọc |
| Proxy `get` trap | Xen vào mọi đọc |

```ts
const sneaky = {
  get n() {
    console.log("get n");
    return 1;
  },
};
JSON.stringify(sneaky); // đã log
const copy = { ...sneaky }; // log lần nữa; copy.n là data property = 1
```

Hệ quả:

- I/O / `Date.now()` / random trong getter → không idempotent, khó test, dễ double-fetch.
- Getter throw → `JSON.stringify` / spread fail bất ngờ.
- Logging trong getter + inspect → recursion / spam.
- TS type không diễn tả “đọc có phí”.

> **Callout:** Getter chỉ cho derived **thuần** (rẻ, đồng bộ, không I/O). Cần I/O / lazy async → method `getX()` / `loadX()`.

`Object.defineProperty` / accessor trên prototype: nhớ `enumerable: false` mặc định với class getter.

### 7.2 Setter chỉ `undefined` vs omit

Gán `obj.p = undefined` **vẫn gọi setter** (khác default param). `delete obj.p` không gọi setter — xóa property. Spread `{ ...obj, p: undefined }` gọi getter `p` trên source rồi gán data property trên bản sao.

TS `set p(v: number)` thường không nhận `undefined` trừ optional. Validate setter: reject `NaN` / `Infinity` tường minh — JSON số không hợp lệ dễ lọt.

---

## 8. `call` / `apply` / `bind`

```ts
function intro(this: { name: string }, greeting: string, punct: string) {
  return `${greeting}, ${this.name}${punct}`;
}
const person = { name: "Lan" };

intro.call(person, "Xin chào", "!");
intro.apply(person, ["Xin chào", "!"]);
const bound = intro.bind(person, "Hello");
bound("."); // "Hello, Lan."
```

| API | Khi nào |
|---|---|
| `call` | Gọi ngay, args rời |
| `apply` | Args mảng (legacy; thường `fn(...arr)`) |
| `bind` | Callback giữ `this` / partial |

`bind` nhiều lần: `this` lần **đầu** thắng. Modern partial: `() => fn(a, b)`.

> **`apply` + mảng cực lớn** có thể vượt arg/stack limit — chunk hoặc vòng.

### 8.1 `bind` — `name` / `length` / `new`

```ts
function f(a: number, b: number, c: number) {}
f.name;   // "f"
f.length; // 3

const b1 = f.bind(null, 1);
b1.name;   // "bound f"
b1.length; // 2  — max(0, orig.length - boundArgs)

const b2 = f.bind(null, 1, 2, 3, 4);
b2.length; // 0
```

- Bound exotic function: `call`/`apply` **không** đổi `this` đã bind.
- `new bound()`: `this` là instance mới; bound `thisArg` bị bỏ; bound args vẫn prepend.
- Bound function **không** có `prototype` riêng; `new` dùng `prototype` của target.
- `Function.prototype.bind.length === 1` (spec: chỉ tính `thisArg` trên chính `bind`).

### 8.2 `Function.prototype.toString`

```ts
function demo(a: number) {
  return a;
}
demo.toString(); // source JS mà runtime nhận; type annotations đã bị xóa

Math.max.toString(); // "function max() { [native code] }"
```

| Trường hợp | Kết quả điển hình |
|---|---|
| JS source còn trên hàm | Giữ source text, gồm whitespace và comment (ES2018+) |
| Builtin / host | `{ [native code] }` |
| Bound | `"function bound …"` / native-style tùy engine |
| Callable Proxy | Native-style string; receiver không callable mới TypeError |

Đừng dùng `toString()` làm bảo mật, fingerprint license, hay “parse AST”. Bundler/strip/emit đổi source trước khi runtime nhận nó. Tái tạo từ chuỗi không giữ môi trường closure gốc. Test hành vi thay vì so source.

Dynamic `new Function("a", "return a + 1")` tạo hàm trong **non-module** scope (không closure, không `import`) — CSP / tooling thường cấm. Khác `eval` một mức, vẫn không phải API app điển hình.

Direct `eval(...)` có thể đọc lexical scope của nơi gọi (ESM strict); indirect eval (`(0, eval)(...)`) và `new Function(...)` dùng global scope. Không dùng chuỗi mã từ input làm logic ứng dụng; xem [security.md](security.md).

---

### 8.3 `length` của wrapper Node

`promisify(fs.readFile).length` **không** phải hợp đồng ổn định (overload, default, rest). `bind` giảm `length` (§8.1). Decorator wrap: gán lại `name` nếu log production dựa vào đó.

Wrapper mặc định của `util.promisify` sao chép descriptor `name` / `length` của hàm gốc; `callbackify` thêm suffix tên và tăng `length` một để tính callback. `promisify.custom` có thể trả hàm khác. Arity thực tế vẫn phải theo hợp đồng API, không suy từ `fn.length`.

---

## 9. Generator functions

```ts
function* range(from: number, to: number) {
  for (let i = from; i <= to; i++) yield i;
}
for (const n of range(1, 3)) console.log(n);

function* outer() {
  yield 1;
  yield* [2, 3];
  yield* range(4, 5);
  return "done"; // for...of bỏ qua return value
}
[...outer()]; // [1,2,3,4,5]
```

- `function*` / `*method()` → `Generator` (iterable + iterator).
- Instance **one-shot** — exhaust rồi rỗng; cần lại → gọi factory.
- `yield*` ủy quyền; `return` của iterator lồng thành giá trị của `yield*`.

```ts
class Page {
  constructor(private items: string[]) {}
  *chunks(size: number) {
    for (let i = 0; i < this.items.length; i += size) {
      yield this.items.slice(i, i + size);
    }
  }
}
```

### 9.1 `next` / `throw` / `return`

Generator là **pull**: consumer gọi `next` để kéo. Giá trị truyền vào `next(x)` trở thành kết quả của `yield` đang treo — **`next` đầu tiên bỏ qua argument**.

```ts
function* channel() {
  const x: number = yield "ready";
  try {
    yield x * 2;
  } catch (e) {
    yield "caught";
  } finally {
    // luôn chạy khi đóng
  }
}

const g = channel();
g.next();      // { value: "ready", done: false } — arg bị bỏ
g.next(21);    // { value: 42, done: false } — yield nhận 21
g.throw(new Error("x")); // ném vào điểm yield — có thể bị catch trong gen
g.return("end");         // ép `return`, chạy `finally`, đóng iterator
```

| Method | Ý nghĩa |
|---|---|
| `next(v)` | Resume; `v` = kết quả `yield` (trừ lần đầu) |
| `throw(e)` | Ném `e` tại `yield` đang treo |
| `return(v)` | `return v` tại điểm treo; đóng iterator |

`for...of` / `break` / `throw` ngoài vòng gọi `return()` nếu có — nhờ đó `finally` trong generator chạy (đóng fd, unlock). Tự viết iterator: implement `return()` nếu giữ resource. Protocol đầy đủ → [iterables-linq.md](iterables-linq.md).

### 9.2 Async generator

```ts
async function* lines(iter: AsyncIterable<string>) {
  for await (const line of iter) {
    yield line.trim();
  }
}

for await (const line of lines(source)) {
  if (line === "stop") break; // gọi `return()` async — await cleanup
}
```

- `async function*` / `async *method()` → `AsyncGenerator`.
- `next`/`throw`/`return` trả **Promise** của `{ value, done }`.
- `yield promise` không tự unwrap theo kiểu `await` mọi thenable ở mọi engine path — thường `yield await x` tường minh.
- `for await...of` trên Node stream / readline: [async.md](async.md), [nodejs-apis.md](nodejs-apis.md).
- Hủy: truyền `AbortSignal` vào producer; `break` chỉ đóng iterator, **không** abort I/O trừ khi producer lắng signal — [abort-context.md](abort-context.md).

`yield*` trong async gen ủy quyền async iterable: `yield* otherAsyncGen()`. Lỗi từ inner reject `next()` của outer. `return()` outer propagate đóng inner (await `inner.return()`).

Producer CPU-bound trong async gen vẫn **block event loop** — `yield` không nhả thread; cần `await` (hoặc `setImmediate` có chủ đích) giữa các chunk nặng. See [event-loop.md](event-loop.md).

Generator method `*g()` trên class: `this` dynamic như method. `yield` không giữ `this` đặc biệt — cùng binding. Async gen method tương tự.

---

## 10. `async function` (tóm tắt)

```ts
async function load(id: string): Promise<User> {
  const res = await fetch(`/api/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<User>;
}
```

| | Hành vi |
|---|---|
| Return | Luôn `Promise` |
| `throw` | Rejection |
| Arrow / method | `async () => …` / `async find() { … }` |
| `this` | Như hàm thường (method vs arrow) |

Đừng `new Promise(async …)`. Combinators / AbortSignal → **[async.md](async.md)**.

`async` **không** biến đệ quy thành không tốn stack giữa các `await` — đoạn sync trước `await` vẫn chồng frame; sau `await` stack “reset” microtask. Đệ quy sâu **không** `await` → vẫn `RangeError`.

### 10.1 `async` method vs `async` arrow field

Giống §2.3: `async find()` trên prototype share; `find = async () => …` mỗi instance. `this` rules không đổi vì `async`. Return luôn Promise — kể cả `return;` → `Promise<void>`.

`async` generator method: `async *pages() { yield await this.next(); }` — `this` dynamic như method thường.

Không trộn `arguments` (async function **có** `arguments`) với arrow nested đọc nhầm outer.

---

## 11. `using` & Explicit Resource Management

Node 26 + TS hỗ trợ `using` / `await using`. Chi tiết → [statements.md](statements.md#11-using-vs-tryfinally).

```ts
class FileTracker implements Disposable {
  constructor(readonly path: string) {}
  [Symbol.dispose]() {
    console.log("dispose", this.path);
  }
}

function process() {
  using f = new FileTracker("./x.txt");
} // dispose luôn — kể cả throw

class Conn implements AsyncDisposable {
  async [Symbol.asyncDispose]() {
    await this.close();
  }
  async close() {}
}

async function query() {
  await using c = new Conn();
}
```

| | |
|---|---|
| `using x = …` | sync `Disposable` |
| `await using x = …` | `AsyncDisposable` |
| Nhiều resource | Dispose **LIFO** |

### 11.1 Function / block scope

`using` gắn với **block lexical** (thân hàm, `if`, `for`, `{ }` tường minh) — không phải “hết process”:

```ts
function run(flag: boolean) {
  using a = acquireA();
  if (flag) {
    using b = acquireB();
    return b.use(); // dispose b, rồi a, rồi return
  }
  return a.use(); // chỉ dispose a
}

function* gen() {
  using r = acquire();
  yield 1; // r sống đến khi generator đóng / return — cẩn thận lifetime
}

for (using item of getResources()) {
  // dispose từng item cuối mỗi iteration (+ break)
}
```

- `return` / `throw` / `break` khỏi block vẫn dispose (như `finally`).
- Nhiều `using` trong cùng block: **LIFO** (gần `defer` đảo ngược thứ tự khai).
- `await using` chỉ trong async function / async gen / module TLA.
- Không hoist: `using` + TDZ giống `const`.
- Dual error (body throw + dispose throw) → `SuppressedError`.

> Nhiều API Node chưa `Disposable` — wrapper gọi `.close()` trong dispose. Factory nên trả `Disposable` khi cleanup deterministic quan trọng.

Iterator hiện đại có `[Symbol.dispose]` gọi `return()` — `using it = stream[Symbol.iterator]()` đóng sớm. Xem [iterables-linq.md](iterables-linq.md).

---

## 12. Chi phí & pitfalls

| Pattern | Vấn đề | Xử lý |
|---|---|---|
| Arrow/bind trong hot loop | Alloc + GC | Tái sử dụng handler; bind một lần |
| Arrow field hàng loạt instance | Mỗi object một fn | Prototype nếu không cần bound |
| `apply` mảng khổng lồ | Stack/arg limit | Chunk / vòng |
| Closure giữ object lớn | Trì hoãn GC | Thu hẹp capture |
| Getter side-effect | Khó debug | Method `getX()` |
| `arguments` | Arrow không có; legacy | Rest |
| `var` + loop closure | Capture sai | `let`/`const` |
| Đệ quy đuôi | **TCO không có trên V8/Node** | Vòng / explicit stack |
| `fn.toString()` | Không ổn định / native | Đừng parse source |

```ts
// Tránh trên hot path
for (const item of items) {
  el.on("click", () => this.handle(item));
}
```

### 12.1 Tail-call **không** được đảm bảo

ES2015 mô tả Proper Tail Calls trong strict — **V8 (Node 26) không triển khai**. Safari từng có TCO; đừng viết API phụ thuộc PTC.

```ts
function fact(n: number, acc = 1): number {
  if (n <= 1) return acc;
  return fact(n - 1, n * acc); // trông giống tail call — vẫn chồng stack trên Node
}
```

Rewrite:

```ts
function factIter(n: number): number {
  let acc = 1;
  for (let i = 2; i <= n; i++) acc *= i;
  return acc;
}
```

### 12.2 Recursive stack

| Tình huống | Stack |
|---|---|
| Sync `f(){ f(); }` | Tăng mỗi lần — `RangeError` |
| Tail `return f()` | **Vẫn tăng** trên V8 |
| `async f(){ await f(); }` | Frame sync trước await; sau await microtask mới |
| `queueMicrotask(() => f())` | Không chồng call stack JS; có thể starve I/O |
| Generator `function* g(){ yield* g(); }` | `yield*` đệ quy vẫn tốn stack lúc resume sâu |

- Sync recursion sâu → `RangeError: Maximum call stack size exceeded` (cỡ hàng nghìn–hàng chục nghìn frame, **không** phải API ổn định).
- Mutual recursion cùng giới hạn.
- Cây / graph: dùng stack mảng hoặc queue; DFS đệ quy chỉ khi depth bounded.
- `async` recursion: mỗi `await` nhả stack — depth logic có thể lớn hơn, nhưng **không** biến CPU recursion thành “miễn phí”; vẫn có thể OOM vì Promise chain / closure.

Cây không cân: depth O(n) với list-as-tree. Graph có cycle: đệ quy không marked set → stack overflow **hoặc** vòng vô hạn (nếu không thêm frame vô hạn thì infinite loop). DFS: `Set` đã thăm + stack tường minh.

```ts
function walk(root: Node) {
  const stack = [root];
  const seen = new Set<Node>();
  while (stack.length) {
    const n = stack.pop()!;
    if (!seen.add(n)) continue;
    // …
    for (const c of n.children) stack.push(c);
  }
}
```

Micro-optimize sau khi đo; ưu tiên đúng `this` và không leak closure.

---

## 13. Best practices

1. Public API: `function` có tên hoặc `const` typed — tránh anonymous khó stack.
2. Options object khi ≥ 3 optional.
3. Annotate `this` khi phụ thuộc; prefer truyền deps nếu được.
4. Prototype method mặc định; arrow field/bind chỉ khi callback bắt buộc. Method shorthand object literal ≠ function property (enumerable, `super`, TS bivariance).
5. Overload khi union chưa đủ; cụ thể trước; implementation rộng — caller không thấy impl. Generic + predicate overload khi cần thu hẹp theo arg.
6. Closure: hiểu lifetime; `let` trong vòng. Default param TDZ độc lập body.
7. Generator lazy; async generator cho stream; implement `return()` nếu giữ resource. `next` đầu bỏ arg.
8. `async` + `try/catch`; không Promise constructor bọc async. Sync recursion trước `await` vẫn tốn stack.
9. Resource: `using` / `await using` khi cleanup deterministic — nhớ LIFO + function/block scope. `using` trong generator sống đến khi iterator đóng.
10. Tránh tạo hàm mới trong hot loop khi binding/`this` quan trọng. `bind` một lần; giữ `name` khi wrap.
11. **Không** dựa tail-call; đệ quy unbounded → vòng / stack mảng.
12. Getter thuần; I/O là method. Đừng parse `Function.prototype.toString`. `fn.length` không phải hợp đồng public.

---

## 14. Checklist

```text
□ Declaration / expression / arrow đúng (this, hoist, new, arguments)
□ Callback method đã bind / wrap / arrow field có chủ đích
□ Detach (destructure, setTimeout, EventEmitter) đã xử lý this
□ new.target đúng nếu giả constructor / subclass builtin
□ Default chỉ dựa undefined — không nhầm null; default không TDZ chéo param
□ Rest thay arguments; options object khi nhiều optional
□ Overload: cụ thể trước; implementation bao hết; caller không dùng impl sig
□ Loop + closure dùng let/const
□ Method vs function property vs arrow: super / enumerable / TS variance
□ Getter không I/O nặng; spread/JSON không kích side-effect bất ngờ
□ bind: hiểu name/length; apply không truyền mảng cực lớn một phát
□ Generator: one-shot; next/throw/return; for-of break → finally
□ async: không new Promise(async …); recursion sync vẫn tốn stack
□ Resource: using / finally / Symbol.dispose — LIFO, scope block
□ Không dựa TCO; hot path không alloc hàm thừa mỗi iteration
□ Không dùng fn.toString() cho logic
```

---

## 15. Cheat sheet

```ts
function decl(a: number, b = 1, ...rest: number[]) {}
const arrow = (x: number) => x * 2;
fn.call(thisArg, a, b);
fn.apply(thisArg, [a, b]);
const bound = fn.bind(thisArg, a);
bound.name;   // "bound …"
bound.length; // orig.length - boundArgs
function* gen() {
  const x = yield 1;
  yield* other();
}
async function* agen() {
  yield await fetch("/");
}
{
  using r = acquire();
  await using c = await connect();
}
if (new.target === undefined) throw new TypeError("use new");
```

| Cần | Chọn |
|---|---|
| Hoist + tên rõ | `function` |
| Lexical `this` | arrow |
| Share prototype | class method |
| Callback giữ instance | bind / arrow field / wrap |
| Lazy sequence | `function*` |
| I/O async | `async function` → [async.md](async.md) |
| Cleanup deterministic | `using` / `await using` |
| Đệ quy sâu | vòng / stack tường minh — **không** TCO |

---

## 16. Version matrix

| Nền | Liên quan |
|---|---|
| ES2015 | arrow, default/rest, class, generators, `name` inference, spec TCO (**V8 không làm**) |
| ES2017 | async/await |
| ES2018+ | async generators |
| TS | overload, `this` param, parameter properties |
| TS 5+/7 | `const` type params |
| ERM | `using` / `await using`, `Disposable`, `SuppressedError` |
| **Node 26** | ESM; `using` với lib/types phù hợp; V8 **14.6** — vẫn **không** PTC |

Baseline: **Node 26** + **TS 7**. Bật `lib` có `Disposable`/ESNext khi dùng `using`.

`Function.prototype.toString` giữ source text nếu source có sẵn; kết quả phản ánh mã sau build/strip, không khôi phục TypeScript ban đầu. Feature-detect API (`typeof Iterator.concat === "function"`) thay vì parse source hàm.

---

## 17. Tài liệu liên quan

- [Function type, Callback & Lambda](functions-callbacks.md)
- [Iterator, Iterable & “LINQ-like”](iterables-linq.md)
- [Lập trình bất đồng bộ](async.md)
- [Phát biểu](statements.md) — `using` chi tiết
- [Lập trình hướng đối tượng trong TypeScript](oop.md)
- [Exception / Error](exceptions.md)
- [Tập hợp & Generics](collections-generics.md)
- [tsconfig & biên dịch TypeScript](tsconfig.md) — parameter properties / strip-types
- [Event loop & concurrency model](event-loop.md) — recursion vs queue, async gen CPU
- [AbortSignal & request context](abort-context.md) — đóng async generator + signal

- [Eval và code không tin cậy](security.md)
