# Lập trình hướng đối tượng trong TypeScript

TypeScript bổ sung class, access modifier, `abstract`, `implements`… trên JavaScript. Hệ thống kiểu là **structural** (theo hình dạng), không nominal như C#/Java — class và interface thường thay thế lẫn nhau tùy nhu cầu **runtime**.

> Baseline: **Node.js 26** + **TypeScript 7**, ESM. Method / `this` / overload sâu hơn: [functions-methods.md](functions-methods.md). Decorator gắn class: [decorators.md](decorators.md).

---

## Mục lục

1. [Class fields & constructors](#1-class-fields--constructors)
2. [Access modifiers (TS-only erase)](#2-access-modifiers-ts-only-erase)
3. [Native `#private`](#3-native-private)
4. [Static members](#4-static-members)
5. [`extends` & đa hình](#5-extends--đa-hình)
6. [`implements` & interfaces](#6-implements--interfaces)
7. [Abstract classes](#7-abstract-classes)
8. [`instanceof` & cross-realm](#8-instanceof--cross-realm)
9. [`this` trong method vs arrow](#9-this-trong-method-vs-arrow)
10. [Polymorphic `this` types](#10-polymorphic-this-types)
11. [Composition vs inheritance](#11-composition-vs-inheritance)
12. [Mixin patterns (tóm tắt)](#12-mixin-patterns-tóm-tắt)
13. [Structural typing — class vs interface](#13-structural-typing--class-vs-interface)
14. [Best practices](#14-best-practices)
15. [Checklist](#15-checklist)
16. [Cheat sheet](#16-cheat-sheet)
17. [Version notes](#17-version-notes)
18. [Tài liệu liên quan](#18-tài-liệu-liên-quan)

---

## 1. Class fields & constructors

### 1.1 Khai báo cơ bản

```ts
class User {
  id: string;
  name: string;
  createdAt = new Date(); // field initializer

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}

const u = new User("1", "Lan");
```

### 1.2 Parameter properties (TS)

```ts
class User {
  constructor(
    public readonly id: string,
    public name: string,
    private passwordHash: string,
  ) {}
}
```

TS emit gán `this.id = id`… — gọn cho DTO/service nhỏ.

> **Strip-types / `erasableSyntaxOnly`:** parameter properties **không erasable**. Node 26 chỉ strip types — dùng field tường minh nếu chạy `node file.ts`. Xem [tsconfig.md](tsconfig.md).

### 1.3 Definite assignment / `!`

```ts
class Config {
  port!: number; // chắc chắn gán trước khi dùng (ví dụ trong init())

  init(port: number) {
    this.port = port;
  }
}
```

Prefer initializer hoặc gán trong constructor; `!` chỉ khi lifecycle chắc chắn.

### 1.4 Thứ tự khởi tạo

```ts
class A {
  value = this.compute(); // sau super(), trước thân constructor

  constructor() {
    console.log(this.value);
  }

  compute() {
    return 1;
  }
}
```

Thứ tự điển hình khi kế thừa: **base fields → base constructor body → derived fields → derived constructor body** (sau `super()`). Gọi `super()` trước khi dùng `this`.

### 1.5 `readonly`

```ts
class Point {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

const p = new Point(1, 2);
// p.x = 3; // lỗi TS — chỉ compile-time
```

`readonly` là kiểm tra TypeScript; runtime vẫn có thể ghi nếu bỏ qua kiểu.

---

## 2. Access modifiers (TS-only erase)

| Modifier | Trong class | Subclass | Bên ngoài |
|---|---|---|---|
| `public` (mặc định) | ✓ | ✓ | ✓ |
| `protected` | ✓ | ✓ | ✗ |
| `private` | ✓ | ✗ | ✗ |

```ts
class Animal {
  public name: string;
  protected kind: string;
  private dna: string;

  constructor(name: string, kind: string, dna: string) {
    this.name = name;
    this.kind = kind;
    this.dna = dna;
  }

  describe() {
    return `${this.name} (${this.kind})`;
  }
}

class Dog extends Animal {
  bark() {
    return `${this.kind} woof`; // OK — protected
    // this.dna; // lỗi — private
  }
}

const d = new Dog("Mun", "canine", "xyz");
d.name; // OK
// d.kind; // lỗi
```

> **`private` / `protected` của TS bị xóa khi emit JS** — chỉ bảo vệ lúc biên dịch. Không phải bảo mật runtime. Ai chạy JS thuần vẫn đọc/ghi property thường.

---

## 3. Native `#private`

```ts
class Vault {
  #secret: string;
  static #count = 0;

  constructor(secret: string) {
    this.#secret = secret;
    Vault.#count++;
  }

  reveal() {
    return this.#secret;
  }

  static size() {
    return Vault.#count;
  }
}

const v = new Vault("tok");
v.reveal();
// v.#secret; // SyntaxError ngay cả trong JS
```

| | `private` (TS) | `#field` (JS) |
|---|---|---|
| Kiểm tra | Compile-time | Runtime (engine) |
| Emit | Property thường | Thật sự ẩn |
| Truy cập cứng từ ngoài | Có thể (JS) | Không |
| Reflect / spread / JSON | Có thể lộ | Không liệt kê như property thường |
| Subclass cùng tên `#x` | N/A (TS private) | Mỗi class một slot riêng |

Dùng `#private` khi cần **ẩn runtime** (library public, tránh đụng tên). Dùng `private` TS khi chỉ cần encapsulation API typing nội bộ.

---

## 4. Static members

```ts
class Id {
  private static seq = 0;
  readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  static create() {
    return new Id(++Id.seq);
  }

  static from(value: number) {
    return new Id(value);
  }
}

const id = Id.create();
```

- Static gắn với **constructor function**, không instance.
- `static block` (ES2022) cho init phức tạp:

```ts
class Env {
  static readonly isProd: boolean;
  static {
    this.isProd = process.env.NODE_ENV === "production";
  }
}
```

Static cũng có `private` / `#private` / `protected` (protected static dùng từ subclass).

---

## 5. `extends` & đa hình

```ts
class Repository<T> {
  constructor(protected readonly items: T[] = []) {}

  add(item: T) {
    this.items.push(item);
  }

  all(): readonly T[] {
    return this.items;
  }
}

class UserRepository extends Repository<{ id: string; name: string }> {
  findById(id: string) {
    return this.items.find((u) => u.id === id);
  }
}
```

### 5.1 Override method

```ts
class Logger {
  log(msg: string) {
    console.log(msg);
  }
}

class JsonLogger extends Logger {
  override log(msg: string) {
    console.log(JSON.stringify({ msg, at: new Date().toISOString() }));
  }
}
```

Bật `noImplicitOverride` trong `tsconfig` để bắt buộc ghi `override` — tránh rename method cha mà con âm thầm thành method mới.

### 5.2 `super`

```ts
class JsonLogger extends Logger {
  override log(msg: string) {
    super.log(`[json] ${msg}`);
  }
}
```

Constructor con **phải** gọi `super(...)` trước khi dùng `this`.

### 5.3 Method trên prototype

```ts
class Counter {
  count = 0;
  inc() {
    this.count++;
  }
}

const a = new Counter();
const b = new Counter();
a.inc === b.inc; // true — cùng hàm trên prototype
```

---

## 6. `implements` & interfaces

```ts
interface Disposable {
  dispose(): void;
}

interface AsyncInitializable {
  init(): Promise<void>;
}

class Connection implements Disposable, AsyncInitializable {
  async init() {
    /* connect */
  }

  dispose() {
    /* close */
  }
}
```

Interface mô tả constructor (hiếm, advanced):

```ts
interface RepoCtor {
  new (url: string): { ping(): Promise<boolean> };
}
```

### 6.1 Interface vs type alias

```ts
interface Point { x: number; y: number }
type PointT = { x: number; y: number };
```

- `interface` có thể **merge** declaration (augment).
- `type` linh hoạt hơn (union, mapped, conditional).
- Với OOP/`implements`, `interface` thường đọc tự nhiên hơn.

### 6.2 Method optional

```ts
interface Reader {
  read(): string;
  peek?(): string;
}

class FileReader implements Reader {
  read() {
    return "";
  }
  // peek optional — có thể bỏ
}
```

---

## 7. Abstract classes

```ts
abstract class Storage {
  abstract get(key: string): Promise<string | undefined>;
  abstract set(key: string, value: string): Promise<void>;

  async getOrDefault(key: string, fallback: string) {
    return (await this.get(key)) ?? fallback;
  }
}

class MemoryStorage extends Storage {
  #map = new Map<string, string>();

  async get(key: string) {
    return this.#map.get(key);
  }

  async set(key: string, value: string) {
    this.#map.set(key, value);
  }
}

// new Storage(); // lỗi TS
```

- Không thể `new` abstract class.
- Có thể chứa implementation cụ thể + abstract members.
- Khác interface: abstract class giữ **state** và constructor logic.

| Nhu cầu | Chọn |
|---|---|
| Chia sẻ code + state + template method | `abstract class` |
| Chỉ hợp đồng hình dạng / nhiều implement độc lập | `interface` |
| Union / mapped / utility | `type` |

> `abstract` là **TS-only** — emit JS vẫn là class thường (trừ khi bundler/tool khác xử lý). Runtime không chặn `new` nếu ai đó bỏ qua kiểu.

---

## 8. `instanceof` & cross-realm

```ts
class Box {}
const b = new Box();
b instanceof Box; // true
b instanceof Object; // true
```

### 8.1 Khi hữu ích / khi mong manh

| Dùng `instanceof` khi | Tránh khi |
|---|---|
| Cùng realm, cùng constructor identity | DTO / JSON thuần (không prototype) |
| Error hierarchy nội bộ app | Structural typing / duck typing đủ |
| Phân nhánh behavior theo class hierarchy | `instanceof` qua **iframe / worker / vm** khác |

### 8.2 Cross-realm pitfall

Mỗi realm (iframe, `vm` context, một số worker boundary) có **constructor riêng**. `Error` từ realm khác có thể fail `err instanceof Error`.

```ts
function isErrorLike(e: unknown): e is { name: string; message: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as { message?: unknown }).message === "string"
  );
}

// Node: util.types.isNativeError(e) — nhận native Error kể cả cross-realm hơn instanceof
import { types } from "node:util";
types.isNativeError(new Error("x"));
```

Prefer: kiểm tra shape / `err.code` / branded type; `instanceof` chỉ khi chắc cùng module graph + cùng realm.

### 8.3 Class có `private` → gần nominal hơn

```ts
class A {
  private id = 1;
  hello() {}
}

class B {
  private id = 1;
  hello() {}
}

// const a: A = new B(); // lỗi TS — private identity khác
```

Object literal `{ hello() {} }` **không** gán được vào `A` khi có private member.

---

## 9. `this` trong method vs arrow

### 9.1 Prototype method — `this` động

```ts
class Timer {
  ms = 0;
  tick() {
    this.ms++;
  }
}

const t = new Timer();
const detached = t.tick;
// detached(); // runtime: this === undefined (strict) → TypeError
```

Truyền method làm callback → mất receiver trừ khi bind:

```ts
setInterval(() => t.tick(), 1000);
setInterval(t.tick.bind(t), 1000);
```

### 9.2 Arrow field — lexical `this`

```ts
class Timer {
  ms = 0;
  tick = () => {
    this.ms++;
  };
}

const t = new Timer();
setInterval(t.tick, 1000); // OK — this gắn instance
```

Trade-off: mỗi instance một hàm riêng (không share prototype) — tốn hơn một chút bộ nhớ; hữu ích cho listener/React-style handler.

### 9.3 Annotate `this` param (TS)

```ts
function asHandler(this: Timer) {
  this.tick();
}
```

Chi tiết `call`/`apply`/`bind`: [functions-methods.md](functions-methods.md).

> **Quy tắc thực dụng:** method trên prototype mặc định; arrow field chỉ khi callback bắt buộc giữ instance; tránh mix lung tung trong cùng class.

---

## 10. Polymorphic `this` types

```ts
class Builder {
  protected parts: string[] = [];

  add(part: string): this {
    this.parts.push(part);
    return this;
  }

  build() {
    return this.parts.join("");
  }
}

class TaggedBuilder extends Builder {
  tag(t: string): this {
    return this.add(`[${t}]`);
  }
}

const s = new TaggedBuilder().tag("x").add("y").build();
```

`this` như return type → subclass không mất method chaining.

```ts
class Node {
  children: this[] = [];

  add(child: this): this {
    this.children.push(child);
    return this;
  }
}
```

---

## 11. Composition vs inheritance

> **Ý kiến baseline repo:** prefer **composition** (`has-a`) cho hầu hết service Node. Kế thừa chỉ khi có quan hệ **is-a** rõ và hierarchy nông (≤ 2–3 tầng).

### 11.1 Composition

```ts
class Clock {
  now() {
    return Date.now();
  }
}

class OrderService {
  constructor(
    private readonly db: { query: (sql: string) => Promise<unknown> },
    private readonly clock: Clock,
  ) {}

  async place(id: string) {
    const at = this.clock.now();
    await this.db.query(`/* insert ${id} @ ${at} */`);
  }
}
```

Lợi: dễ mock/test, đổi implementation, không kéo theo state ẩn của base class.

### 11.2 Inheritance khi hợp lý

- Template method: abstract base + vài hook override.
- Framework extension point đã thiết kế `extends`.
- Shared invariant thật sự thuộc cùng loại đối tượng.

### 11.3 Anti-pattern

| Tránh | Lý do |
|---|---|
| Cây kế thừa sâu “tiện share code” | Fragile base class; đổi cha phá con |
| God class (HTTP + DB + domain) | Khó test, khó rotate ownership |
| Inherit để “reuse” 1–2 method | Extract function / collaborator |
| `extends EventEmitter` mọi service | Prefer compose `EventEmitter` hoặc trả typed bus |

```ts
// Prefer compose
class JobRunner {
  readonly events = new EventEmitter<{ done: [id: string] }>();
  // ...
}
```

---

## 12. Mixin patterns (tóm tắt)

JS/TS **không** đa kế thừa class. Mixin = hàm nhận base class, trả subclass đã “trộn” hành vi.

```ts
type Constructor<T = object> = new (...args: never[]) => T;

function Timestamped<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    createdAt = new Date();
  };
}

function Activatable<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    isActive = false;
    activate() {
      this.isActive = true;
    }
  };
}

class Entity {
  constructor(public id: string) {}
}

const User = Activatable(Timestamped(Entity));
const u = new User("1");
u.activate();
u.createdAt;
```

Thực dụng:

- Share behavior ngang hàng khi không muốn cây kế thừa sâu.
- Typing mixin phức tạp; nhiều team prefer **composition**.
- Decorators (khi bật) là hướng khác cho cross-cutting — [decorators.md](decorators.md).

---

## 13. Structural typing — class vs interface

### 13.1 Structural, không nominal

```ts
class Person {
  constructor(public name: string) {}
}

class Dog {
  constructor(public name: string) {}
}

const p: Person = new Dog("Mun"); // OK về kiểu — cùng shape
```

Branded / private field khi cần phân biệt tạm thời:

```ts
class UserId {
  private readonly brand = "UserId";
  constructor(public readonly value: string) {}
}
```

### 13.2 Class dùng làm kiểu

```ts
class Service {
  start() {}
}

function run(s: Service) {
  s.start();
}

run({ start() {} }); // OK — structural: đủ method start
```

### 13.3 Khi dùng class vs interface

| Dùng **class** khi | Dùng **interface** / type khi |
|---|---|
| Cần runtime (`instanceof`, prototype) | Chỉ hợp đồng compile-time |
| Có state + behavior đóng gói | DTO / JSON shape |
| Cần `#private`, inheritance | Union / mapped / utility |
| DI token runtime | Thuần mô tả API / port |

Prefer: **interface cho dữ liệu & port**, **class cho adapter/service có lifecycle**.

---

## 14. Best practices

1. Prefer composition hơn cây kế thừa sâu; `extends` khi is-a rõ.
2. Bật `strict` + `noImplicitOverride`.
3. `#private` cho invariant runtime; `private` TS cho encapsulation typing.
4. `readonly` cho dependency trong constructor.
5. Fluent API: trả `this` (polymorphic).
6. Prototype method mặc định; arrow field chỉ khi callback cần lexical `this`.
7. Đừng dựa `instanceof` cross-realm / JSON DTO — shape / `code` / brand.
8. Tránh parameter properties nếu workflow `erasableSyntaxOnly` / `node file.ts`.
9. Interface cho port; class cho implementation có state.
10. Mixin chỉ khi composition + interface chưa đủ — giữ typing đơn giản.

---

## 15. Checklist

```text
□ Field initializer / constructor / definite assignment rõ lifecycle
□ public/protected/private chỉ là TS — #private nếu cần ẩn runtime
□ abstract / implements đúng nhu cầu (code+state vs hợp đồng)
□ override + noImplicitOverride khi kế thừa
□ Callback method: bind / arrow field / wrap — không detach trần
□ instanceof chỉ cùng realm; Error → util.types / shape
□ Hierarchy nông; composition cho service
□ Không god class; DTO ≠ service
□ Strip-types? tránh parameter properties / enum / decorator nếu cần
□ Static factory rõ (create/from) thay magic new lung tung
```

---

## 16. Cheat sheet

```ts
class C {
  public a = 1;
  protected b = 2;
  private c = 3;
  #d = 4;
  static s = 5;
  tick = () => {}; // lexical this
  constructor(public readonly id: string) {}
  method(): this {
    return this;
  }
}

abstract class Base {
  abstract run(): void;
}

class Impl extends Base implements Disposable {
  override run() {}
  dispose() {}
}

obj instanceof Impl;
```

| Cần | Chọn |
|---|---|
| Ẩn runtime | `#field` |
| API typing nội bộ | `private` / `protected` |
| Hợp đồng không state | `interface` |
| Template + state | `abstract class` |
| Reuse ngang | compose / mixin nhẹ |
| Fluent subclass | `return this` |
| Callback giữ instance | arrow field / `bind` |

---

## 17. Version notes

| Nền | Liên quan OOP |
|---|---|
| ES2015 | `class`, `extends`, `super`, `static` |
| ES2022 | public fields, `#private`, `static {}` |
| TS | `public`/`private`/`protected`, `abstract`, `implements`, parameter properties |
| TS 4.3+ | `override` keyword |
| TS 5+/7 | Stage 3 decorators (tách khỏi legacy) — [decorators.md](decorators.md) |
| **Node 26** | full class fields / `#private`; strip-types **không** chạy parameter props |
| **TS 7** | `strict` mặc định; `noImplicitOverride` khuyến nghị |

Baseline: **Node 26** + **TS 7**.

---

## 18. Tài liệu liên quan

- [Hàm & Method](functions-methods.md) — `this`, overload, bind
- [Function type, Callback & Lambda](functions-callbacks.md)
- [Tập hợp & Generics](collections-generics.md)
- [Decorators & Metadata](decorators.md)
- [Exception / Error](exceptions.md)
- [tsconfig & biên dịch](tsconfig.md) — `erasableSyntaxOnly`, `noImplicitOverride`
- [Node 26 & TypeScript 7 highlights](node26-ts7.md)
