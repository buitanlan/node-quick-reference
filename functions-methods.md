# Hàm & Method trong JavaScript / TypeScript

Trong JS/TS, **hàm (function)** là giá trị first-class; **method** là hàm gắn với object/class. Baseline: **ESM**, **Node.js 26**, **TypeScript 7**.

---

## Mục lục

1. [Function declaration & expression](#1-function-declaration--expression)
2. [Arrow function](#2-arrow-function)
3. [`this` binding — sự khác biệt quan trọng](#3-this-binding--sự-khác-biệt-quan-trọng)
4. [Tham số: default, rest, destructuring](#4-tham-số-default-rest-destructuring)
5. [Overload trong TypeScript](#5-overload-trong-typescript)
6. [Method trên object & class](#6-method-trên-object--class)
7. [Getter / Setter](#7-getter--setter)
8. [`call` / `apply` / `bind`](#8-call--apply--bind)
9. [Generator function (tóm tắt)](#9-generator-function-tóm-tắt)
10. [Best practices & cheat sheet](#10-best-practices--cheat-sheet)

---

## 1. Function declaration & expression

### 1.1 Function declaration (hoisted)

```ts
function add(a: number, b: number): number {
  return a + b;
}

console.log(add(2, 3)); // 5 — gọi được trước dòng khai báo nhờ hoisting
```

- Tên hàm được **hoist** toàn bộ (cả thân) trong scope.
- Có `prototype` riêng → có thể dùng với `new` (hiếm khi cần trong code hiện đại).

### 1.2 Function expression

```ts
const multiply = function (a: number, b: number): number {
  return a * b;
};

// Named function expression — hữu ích khi debug / đệ quy
const factorial = function fact(n: number): number {
  return n <= 1 ? 1 : n * fact(n - 1);
};
```

- Biến `const`/`let` **không** hoist giá trị → không gọi trước khi khởi tạo (`TDZ`).
- Named FE: tên nội bộ (`fact`) chỉ thấy trong thân hàm.

### 1.3 So sánh nhanh

| | Declaration | Expression | Arrow |
|---|---|---|---|
| Hoist | Có | Không (TDZ) | Không |
| `this` riêng | Dynamic | Dynamic | Lexical |
| `arguments` | Có | Có | Không |
| `new` | Được | Được | Không |
| `prototype` | Có | Có | Không |

---

## 2. Arrow function

```ts
const square = (x: number) => x * x;
const log = (msg: string) => {
  console.log(msg);
};

// Một tham số: có thể bỏ ngoặc (vẫn nên giữ khi typed rõ)
const double = (n: number) => n * 2;

// Trả object literal → bọc `(...)`
const toPoint = (x: number, y: number) => ({ x, y });
```

Đặc điểm:

- **`this` lexical** — kế thừa `this` của scope bao ngoài.
- Không có `arguments`, `super`, `new.target` riêng.
- Không dùng làm constructor (`new square(2)` → TypeError).
- Phù hợp callback, method ngắn khi **không** cần `this` dynamic.

```ts
class Counter {
  count = 0;

  // Arrow field: `this` luôn là instance (ổn với callback)
  inc = () => {
    this.count++;
  };

  // Method thường: cần bind nếu truyền đi như callback
  dec() {
    this.count--;
  }
}

const c = new Counter();
setTimeout(c.inc, 0); // OK
setTimeout(c.dec, 0); // `this` sai trừ khi bind
```

> Trade-off: arrow field nằm trên **mỗi instance** (không share trên prototype) → tốn bộ nhớ hơn nếu tạo rất nhiều object.

---

## 3. `this` binding — sự khác biệt quan trọng

### 3.1 Quy tắc xác định `this` (non-arrow)

1. Gọi qua object: `obj.method()` → `this === obj`.
2. Gọi độc lập: `fn()` (strict / ESM) → `this === undefined`.
3. `call`/`apply`/`bind` → `this` do bạn chỉ định.
4. `new Fn()` → `this` là object mới.
5. Arrow → **bỏ qua** 1–4, dùng `this` lexical.

```ts
const obj = {
  name: "node",
  greet() {
    return `hi ${this.name}`;
  },
};

const greet = obj.greet;
console.log(obj.greet()); // "hi node"
console.log(greet());     // TypeError hoặc undefined.name (strict)
```

### 3.2 Class method vs arrow field

```ts
class Service {
  id = "svc";

  // share trên prototype
  handle() {
    return this.id;
  }

  // mỗi instance một hàm
  handleBound = () => this.id;
}
```

Trong React/event emitter/callback Node, chọn:

- **bind trong constructor** hoặc arrow field nếu cần truyền method đi;
- hoặc gọi dạng `() => svc.handle()` tại call-site.

---

## 4. Tham số: default, rest, destructuring

### 4.1 Default parameters

```ts
function connect(host = "127.0.0.1", port = 5432) {
  return `${host}:${port}`;
}

connect();               // "127.0.0.1:5432"
connect("db.local");     // "db.local:5432"
connect(undefined, 3306); // default host, port 3306
connect(null as any, 1);  // host = null (null ≠ undefined!)
```

- Default chỉ kích hoạt khi đối số là **`undefined`** (thiếu hoặc truyền `undefined`).
- Default có thể dùng biểu thức / gọi hàm (đánh giá **lúc gọi**, lazy).

```ts
function createId(factory = () => crypto.randomUUID()) {
  return factory();
}
```

### 4.2 Rest parameters

```ts
function sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

sum(1, 2, 3); // 6

// Rest phải ở cuối
function tag(prefix: string, ...parts: string[]) {
  return `${prefix}:${parts.join(",")}`;
}
```

Khác `arguments`:

- Rest là **mảng thật** (`Array`).
- Typed rõ trong TS (`...nums: number[]`).
- Arrow **không** có `arguments` → dùng rest.

### 4.3 Destructuring parameters

```ts
type User = { id: string; name: string; role?: string };

function printUser({ id, name, role = "user" }: User) {
  console.log(id, name, role);
}

function move([x, y]: [number, number], dx = 0, dy = 0) {
  return [x + dx, y + dy] as const;
}

// Options object — pattern phổ biến Node/TS
type FetchOpts = {
  method?: "GET" | "POST";
  timeoutMs?: number;
  headers?: Record<string, string>;
};

function fetchJson(url: string, { method = "GET", timeoutMs = 5_000, headers = {} }: FetchOpts = {}) {
  return { url, method, timeoutMs, headers };
}
```

Mẹo: prefer **options object** khi ≥ 3 tham số tùy chọn — tránh nhầm thứ tự.

### 4.4 Optional & required trong TS

```ts
function f(a: number, b?: number, c = 1) {}
// b?: number  ≡ b: number | undefined (gần tương đương ở call-site)
```

---

## 5. Overload trong TypeScript

JS runtime **không** có overload thật; TS cho phép **nhiều chữ ký** + **một implementation**.

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

const a = parse('{"x":1}');          // object
const b = parse(Buffer.from("{}"));  // object
```

Quy tắc:

1. Liệt kê overload signatures (public API).
2. Implementation signature phải **rộng hơn / bao** các overload (thường không export cho caller).
3. Caller chỉ thấy overload, không thấy implementation signature.

Overload với method:

```ts
class Encoder {
  encode(value: string): Uint8Array;
  encode(value: number): Uint8Array;
  encode(value: string | number): Uint8Array {
    const s = String(value);
    return new TextEncoder().encode(s);
  }
}
```

Alternative hiện đại: **union / conditional / generic** thay overload khi đủ rõ:

```ts
function identity<T>(x: T): T {
  return x;
}
```

---

## 6. Method trên object & class

### 6.1 Object literal method

```ts
const calculator = {
  base: 10,
  add(x: number) {
    return this.base + x;
  },
  // shorthand
  sub(x: number) {
    return this.base - x;
  },
};
```

### 6.2 Class methods

```ts
class UserRepo {
  constructor(private readonly db: { query: (sql: string) => Promise<unknown> }) {}

  async findById(id: string) {
    return this.db.query(`select * from users where id = '${id}'`); // minh họa — dùng param!
  }

  static empty() {
    return new UserRepo({ query: async () => null });
  }
}
```

- Instance method: trên `prototype` (share giữa instances).
- `static`: gọi qua `UserRepo.empty()`, không qua instance.
- Parameter property (`private readonly db`) — cú pháp TS tiện cho DI đơn giản.

### 6.3 Private method

```ts
class Hasher {
  hash(input: string) {
    return this.#digest(input);
  }

  #digest(input: string) {
    // native private — ẩn thật ở runtime
    return input;
  }

  private legacy(input: string) {
    // TS-only private — bị xóa ở emit, vẫn gọi được từ JS nếu biết tên
    return input;
  }
}
```

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
    return this.#celsius * 9 / 5 + 32;
  }

  set fahrenheit(f: number) {
    this.celsius = (f - 32) * 5 / 9;
  }
}

const t = new Temperature();
t.fahrenheit = 212;
console.log(t.celsius); // 100
```

Object literal:

```ts
const config = {
  _port: 3000,
  get port() {
    return this._port;
  },
  set port(v: number) {
    if (v < 1 || v > 65535) throw new RangeError("port");
    this._port = v;
  },
};
```

Ghi chú:

- Getter/setter trông như property → **không** gọi `t.celsius()`.
- Tránh side-effect nặng trong getter (khó đoán khi debug).
- `Object.defineProperty` / `Object.defineProperties` cho control chi tiết (`enumerable`, `configurable`).

---

## 8. `call` / `apply` / `bind`

### 8.1 `call` & `apply`

```ts
function intro(this: { name: string }, greeting: string, punct: string) {
  return `${greeting}, ${this.name}${punct}`;
}

const person = { name: "Lan" };

intro.call(person, "Xin chào", "!");           // args rời
intro.apply(person, ["Xin chào", "!"]);        // args mảng

// Dùng call để “mượn” method
const nums = [1, 5, 3];
Math.max.call(null, ...nums);
Math.max.apply(null, nums);
```

Trong TS, annotate `this` parameter (không phải đối số thật):

```ts
function label(this: HTMLElement) {
  return this.tagName;
}
```

### 8.2 `bind`

```ts
const bound = intro.bind(person, "Hello");
bound("."); // "Hello, Lan."

class Button {
  constructor(private label: string) {}
  click() {
    console.log(this.label);
  }
}

const btn = new Button("Save");
const handler = btn.click.bind(btn);
handler(); // "Save"
```

- `bind` trả hàm **mới**, `this` (và optionally args) cố định.
- `bind` nhiều lần: `this` của lần bind **đầu** thắng (thường).

### 8.3 Khi nào dùng gì?

| API | Dùng khi |
|---|---|
| `call` | Gọi ngay, args rời |
| `apply` | Gọi ngay, args dạng mảng (legacy; hiện nay thường `fn(...arr)`) |
| `bind` | Tạo callback giữ `this` / partial apply |

Modern thay thế partial: arrow hoặc wrapper `() => fn(a, b)`.

---

## 9. Generator function (tóm tắt)

```ts
function* range(from: number, to: number) {
  for (let i = from; i <= to; i++) {
    yield i;
  }
}

for (const n of range(1, 3)) {
  console.log(n); // 1, 2, 3
}

const it = range(10, 12);
console.log(it.next()); // { value: 10, done: false }
```

- `function*` / `*method()` trả `Generator` (vừa iterable vừa iterator).
- `yield` tạm dừng; `yield*` ủy quyền iterable khác.
- Async generator: `async function*` + `for await...of` (xem `iterables-linq.md`).

```ts
const obj = {
  *entries() {
    yield ["a", 1] as const;
    yield ["b", 2] as const;
  },
};
```

---

## 10. Best practices & cheat sheet

**Nên**

- Prefer `const fn = (...) => ...` hoặc `function` có tên rõ cho public API.
- Dùng **options object** cho API nhiều tham số tùy chọn.
- Annotate `this` trong TS khi hàm phụ thuộc `this`.
- Class method trên prototype; arrow field chỉ khi cần bind ổn định.
- Overload TS khi union chưa đủ diễn đạt API; giữ implementation signature rộng.

**Tránh**

- Phụ thuộc `arguments` (dùng rest).
- Dùng arrow làm constructor / method cần dynamic `this` + prototype.
- Swallow lỗi trong setter; validate rồi `throw`.
- `apply` với mảng cực lớn (giới hạn stack) — dùng vòng lặp / `Math.max(...chunk)`.

**Cheat sheet**

```ts
function decl(a: number, b = 1, ...rest: number[]) {}
const expr = function (x: number) { return x; };
const arrow = (x: number) => x * 2;

fn.call(thisArg, a, b);
fn.apply(thisArg, [a, b]);
const bound = fn.bind(thisArg, a);

function* gen() { yield 1; }
```

---

## Tài liệu liên quan

- [Function type, Callback & Lambda](functions-callbacks.md)
- [Iterator, Iterable & “LINQ-like”](iterables-linq.md)
- [Lập trình hướng đối tượng trong TypeScript](oop.md)
- [Exception / Error](exceptions.md)
