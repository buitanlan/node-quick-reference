# Lập trình hướng đối tượng trong TypeScript

TypeScript bổ sung class, access modifier, `abstract`, interface… trên JavaScript. Quan trọng: hệ thống kiểu là **structural** (theo hình dạng), không phải nominal như C#/Java — class và interface thường thay thế lẫn nhau tùy nhu cầu runtime.

Baseline: **TS 7**, **ESM**, **Node.js 26**.

---

## Mục lục

1. [Class fields & constructors](#1-class-fields--constructors)
2. [Access modifiers: `public` / `private` / `protected`](#2-access-modifiers-public--private--protected)
3. [Native `#private`](#3-native-private)
4. [Kế thừa & đa hình](#4-kế-thừa--đa-hình)
5. [Abstract classes](#5-abstract-classes)
6. [`implements` & interfaces](#6-implements--interfaces)
7. [Static members](#7-static-members)
8. [Polymorphic `this` types](#8-polymorphic-this-types)
9. [Mixin pattern (tóm tắt)](#9-mixin-pattern-tóm-tắt)
10. [Structural typing — class vs interface](#10-structural-typing--class-vs-interface)
11. [Best practices](#11-best-practices)

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

### 1.4 Class field vs constructor gán

```ts
class A {
  value = this.compute(); // chạy trước thân constructor (thứ tự: super → fields → constructor body)

  constructor() {
    console.log(this.value);
  }

  compute() {
    return 1;
  }
}
```

Thứ tự khởi tạo quan trọng khi kết hợp kế thừa — gọi `super()` trước khi dùng `this`.

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

`readonly` là kiểm tra TypeScript; runtime vẫn có thể ghi nếu ai đó bỏ qua kiểu.

---

## 2. Access modifiers: `public` / `private` / `protected`

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

**Lưu ý:** `private`/`protected` của TS bị **xóa khi emit** JS — chỉ bảo vệ lúc biên dịch. Không phải bảo mật runtime.

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

So sánh:

| | `private` (TS) | `#field` (JS) |
|---|---|---|
| Kiểm tra | Compile-time | Runtime (engine) |
| Emit | Vẫn là property thường | Thật sự ẩn |
| Truy cập cứng từ ngoài | Có thể (JS) | Không |
| Reflect / spread | Có thể lộ | Không liệt kê như property thường |

Dùng `#private` khi cần **ẩn runtime** (library public, tránh đụng tên). Dùng `private` TS khi chỉ cần API typing nội bộ.

---

## 4. Kế thừa & đa hình

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

### 4.1 Override method

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

### 4.2 `super`

```ts
class JsonLogger extends Logger {
  override log(msg: string) {
    super.log(`[json] ${msg}`);
  }
}
```

Constructor con **phải** gọi `super(...)` trước khi dùng `this` (trừ class không kế thừa / edge hiếm).

### 4.3 Method trên prototype

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

## 5. Abstract classes

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
- Khác interface: abstract class có thể giữ **state** và constructor logic.

Khi nào abstract vs interface: cần chia sẻ code + state → abstract; chỉ cần hợp đồng hình dạng → interface.

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

Interface có thể mô tả class constructor (hiếm, advanced):

```ts
interface RepoCtor {
  new (url: string): { ping(): Promise<boolean> };
}
```

### 6.1 Interface vs type alias cho object shape

```ts
interface Point { x: number; y: number }
type PointT = { x: number; y: number };
```

- `interface` có thể **merge** declaration (augment).
- `type` linh hoạt hơn (union, mapped, conditional).
- Với OOP/`implements`, `interface` thường đọc tự nhiên hơn.

### 6.2 Class implements type có method optional

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

## 7. Static members

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

## 8. Polymorphic `this` types

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

const s = new TaggedBuilder().tag("x").add("y").build(); // fluent giữ đúng subclass
```

`this` như return type → subclass không mất method chaining type.

F-bounded / annotate tham số:

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

## 9. Mixin pattern (tóm tắt)

JS/TS **không** đa kế thừa class. Mixin = hàm nhận base class, trả subclass đã “trộn” hành vi.

```ts
type Constructor<T = {}> = new (...args: any[]) => T;

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

- Hữu ích khi share behavior ngang hàng không tạo cây kế thừa sâu.
- Typing mixin phức tạp (cần helper `Constructor`); nhiều team prefer **composition** (`has a` service) hơn mixin.
- Decorators (khi bật) là hướng khác để gắn cross-cutting — xem `decorators.md`.

---

## 10. Structural typing — class vs interface

### 10.1 Structural, không nominal

```ts
class Person {
  constructor(public name: string) {}
}

class Dog {
  constructor(public name: string) {}
}

const p: Person = new Dog("Mun"); // OK về mặt kiểu — cùng shape!
```

Muốn phân biệt nominal tạm thời:

```ts
class UserId {
  private readonly brand = "UserId";
  constructor(public readonly value: string) {}
}
```

hoặc branded type với `unique symbol`.

### 10.2 Class dùng làm kiểu

```ts
class Service {
  start() {}
}

function run(s: Service) {
  s.start();
}

run({ start() {} }); // OK — structural: đủ method start
```

Nếu class có `private`/`protected` field, kiểu trở nên **gần nominal hơn**: chỉ instance cùng class (hoặc subclass) tương thích.

```ts
class A {
  private id = 1;
  hello() {}
}

class B {
  private id = 1;
  hello() {}
}

// const a: A = new B(); // lỗi — private identity khác nhau
```

### 10.3 Khi dùng class vs interface

| Dùng **class** khi | Dùng **interface** / type khi |
|---|---|
| Cần runtime (`instanceof`, prototype) | Chỉ cần hợp đồng compile-time |
| Có state + behavior đóng gói | DTO / JSON shape |
| Cần `#private`, inheritance hierarchy | Union / mapped / utility types |
| DI token runtime | Thuần mô tả API |

```ts
interface UserDTO {
  id: string;
  name: string;
}

class UserService {
  constructor(private readonly db: { query: Function }) {}
  async get(id: string): Promise<UserDTO | undefined> {
    /* ... */
    return undefined;
  }
}
```

Prefer: **interface cho dữ liệu & port**, **class cho adapter/service có lifecycle**.

---

## 11. Best practices

**Nên**

- Prefer composition hơn cây kế thừa sâu.
- Bật `strict` + `noImplicitOverride`.
- Dùng `#private` cho invariant runtime quan trọng; `private` TS cho encapsulation API.
- `readonly` cho dependency trong constructor.
- Fluent API: trả `this`.

**Tránh**

- God class; trộn DTO + persistence + HTTP trong một class.
- Dựa vào `instanceof` quá nhiều khi structural typing / interface đủ.
- Public field mutable không kiểm soát — đóng qua method hoặc `readonly`.
- Mixin phức tạp khi một object collaborator rõ ràng hơn.

**Cheat sheet**

```ts
class C {
  public a = 1;
  protected b = 2;
  private c = 3;
  #d = 4;
  static s = 5;
  constructor(public readonly id: string) {}
  method(): this { return this; }
}

abstract class Base {
  abstract run(): void;
}

class Impl extends Base implements Disposable {
  override run() {}
  dispose() {}
}
```

---

## Tài liệu liên quan

- [Hàm & Method](functions-methods.md)
- [Tập hợp & Generics](collections-generics.md)
- [Function type, Callback & Lambda](functions-callbacks.md)
- [Exception / Error](exceptions.md)
