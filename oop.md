# Lập trình hướng đối tượng trong TypeScript

TypeScript bổ sung class, access modifier, `abstract`, `implements`… trên JavaScript. Hệ thống kiểu là **structural** (theo hình dạng), không nominal như C#/Java — class và interface thường thay thế lẫn nhau tùy nhu cầu **runtime**.

> Baseline: **Node.js 26** + **TypeScript 7**, ESM. Method / `this` / overload sâu hơn: [functions-methods.md](functions-methods.md). Decorator gắn class: [decorators.md](decorators.md). Strip / `erasableSyntaxOnly`: [tsconfig.md](tsconfig.md).

---

## Mục lục

1. [Class fields & constructors](#1-class-fields--constructors)
2. [Access modifiers (TS-only erase)](#2-access-modifiers-ts-only-erase)
3. [Native `#private` & brand check](#3-native-private--brand-check)
4. [Static members & static initialization blocks](#4-static-members--static-initialization-blocks)
5. [Prototype chain, `[[HomeObject]]`, `super`, `override`](#5-prototype-chain-homeobject-super-override)
6. [`implements`, instance type vs constructor type](#6-implements-instance-type-vs-constructor-type)
7. [Abstract classes & abstract construct signatures](#7-abstract-classes--abstract-construct-signatures)
8. [`instanceof` & `Symbol.hasInstance`](#8-instanceof--symbolhasinstance)
9. [Accessors vs methods](#9-accessors-vs-methods)
10. [`this` trong method vs arrow](#10-this-trong-method-vs-arrow)
11. [Polymorphic `this` types](#11-polymorphic-this-types)
12. [Composition vs inheritance (Go embedding)](#12-composition-vs-inheritance-go-embedding)
13. [Mixin: intersection + constraint](#13-mixin-intersection--constraint)
14. [Structural typing, declaration merging](#14-structural-typing-declaration-merging)
15. [Decorators (cross-link)](#15-decorators-cross-link)
16. [Khi nào KHÔNG dùng class / `extends`](#16-khi-nào-không-dùng-class--extends)
17. [Best practices](#17-best-practices)
18. [Checklist](#18-checklist)
19. [Cheat sheet](#19-cheat-sheet)
20. [Version matrix](#20-version-matrix)
21. [Tài liệu liên quan](#21-tài-liệu-liên-quan)

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

Class declaration tạo **hai** thứ trong TS:

| Binding | Ý nghĩa |
|---------|---------|
| Giá trị `User` | constructor function (runtime) |
| Kiểu `User` | **instance** type |
| `typeof User` | kiểu constructor (static + `new`) |

Xem §6.2.

### 1.2 Parameter properties vs field tường minh (erasable)

```ts
class User {
  constructor(
    public readonly id: string,
    public name: string,
    private passwordHash: string,
  ) {}
}
```

TS emit `this.id = id`… — gọn cho DTO/service nhỏ. **Không** phải cú pháp JS.

```ts
class User {
  readonly id: string;
  name: string;
  #passwordHash: string;

  constructor(id: string, name: string, passwordHash: string) {
    this.id = id;
    this.name = name;
    this.#passwordHash = passwordHash;
  }
}
```

| Cú pháp | `erasableSyntaxOnly` | `node file.ts` (Node 26) |
|---------|----------------------|--------------------------|
| Field tường minh + gán constructor | ✓ | OK |
| `constructor(private x: T)` | **✗** | còn `private` → SyntaxError JS |
| `public x = 1` trên class body | ✓ (modifier xóa) | field còn |
| `abstract` / `implements` / `override` | ✓ (xóa) | class thường |
| `#private` | ✓ (là JS) | OK |
| `enum` trong class file | ✗ | không transform |

> **Strip-types / `erasableSyntaxOnly`:** parameter properties **không erasable**. Node 26 chỉ strip types — dùng field tường minh nếu chạy `node file.ts`. Xem [tsconfig.md](tsconfig.md), [typesystem.md](typesystem.md) §16.

**Khi nào KHÔNG dùng parameter properties:** mọi workflow `node *.ts` / CI `erasableSyntaxOnly`; lib publish nguồn TS chạy trực tiếp.

### 1.3 Definite assignment / `!`

```ts
class Config {
  port!: number; // chắc chắn gán trước khi dùng (ví dụ trong init())

  init(port: number) {
    this.port = port;
  }
}
```

Prefer initializer hoặc gán trong constructor; `!` chỉ khi lifecycle chắc chắn. `strictPropertyInitialization` (trong `strict`) bắt field không `!` phải được gán.

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

Thứ tự điển hình khi kế thừa:

1. Vào `new Derived` → `Derived` constructor  
2. `super(...)` → base fields (instance) chạy → thân `Base` constructor  
3. Derived fields chạy  
4. Thân `Derived` constructor  

Gọi `super()` trước khi dùng `this`. Field initializer derived **không** thấy giá trị gán trong thân constructor derived (chưa chạy). Override `compute()` từ derived: initializer **base** gọi `this.compute()` → đã là method derived (có thể đọc field derived **chưa** init → `undefined`).

```ts
class Base {
  n = this.hook();
  hook() {
    return 1;
  }
}
class Child extends Base {
  extra = 2;
  override hook() {
    return this.extra; // undefined khi Base field init — bẫy
  }
}
```

> **Pitfall:** không gọi method override từ field initializer / constructor base nếu method đọc state derived.

### 1.5 `readonly`

```ts
class Point {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {
    this.x = x;
    this.y = y;
  }
}

const p = new Point(1, 2);
// p.x = 3; // lỗi TS — chỉ compile-time
```

`readonly` là kiểm tra TypeScript; runtime vẫn có thể ghi nếu bỏ qua kiểu. `#field` không writable từ ngoài dù không `readonly`.

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

> **`private` / `protected` của TS bị xóa khi emit JS** — chỉ bảo vệ lúc biên dịch. Không phải bảo mật runtime. Ai chạy JS thuần vẫn đọc/ghi property thường (`d.dna` sau emit).

`private` TS vẫn tạo **nominal-ish** ở hệ thống kiểu (hai class cùng shape + `private` khác identity không gán lẫn — §14). `#private` mới ẩn runtime.

---

## 3. Native `#private` & brand check

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
| Sai receiver | im lặng / `undefined` | **TypeError** brand check |

Dùng `#private` khi cần **ẩn runtime** (library public, tránh đụng tên). Dùng `private` TS khi chỉ cần encapsulation API typing nội bộ.

### 3.1 Brand check vs WeakMap cũ

Mọi `#field` gắn **brand** của class. Đọc/ghi `#x` trên object không được `new` từ class đó → `TypeError`.

```ts
class A {
  #x = 1;
  static getX(o: object) {
    return (o as A).#x;
  }
}
A.getX(new A()); // 1
// A.getX({}); // TypeError: Cannot read private member #x from an object whose class did not declare it
```

Pattern cũ (ES5 / Babel):

```ts
const secrets = new WeakMap<object, string>();

class VaultOld {
  constructor(secret: string) {
    secrets.set(this, secret);
  }
  reveal() {
    return secrets.get(this);
  }
}
```

| | `#field` | `WeakMap` đóng |
|---|---|---|
| Ẩn khỏi `Object.keys` / JSON | ✓ | ✓ |
| Brand check cứng | ✓ (engine) | chỉ nếu **mọi** access đi qua map |
| Ai giữ `WeakMap` | không có handle | module scope — leak nếu export map |
| Subclass | slot riêng theo class | cùng map nếu không tách |
| Memory | engine | entry WeakMap theo instance |
| `in` / `Object.hasOwn` | `#x in obj` (syntax private) | `secrets.has(obj)` |

```ts
class A {
  #x = 0;
  hasX(o: object) {
    return #x in o; // private-in — brand test, không throw
  }
}
new A().hasX(new A()); // true
new A().hasX({}); // false
```

`#x in o` là **private brand check** không throw — hữu ích type guard runtime.

**Khi nào KHÔNG dùng WeakMap cho private:** class mới trên Node 26 — `#field` đủ, rõ hơn, không giữ map. WeakMap còn hợp khi ẩn data trên object **không phải instance** (decorate DOM node — không có trên Node thuần).

### 3.3 `new.target`

```ts
class Base {
  constructor() {
    if (new.target === Base) {
      throw new Error("use subclass");
    }
  }
}
```

`new.target` là constructor được `new` thật (derived khi `new Derived`). Abstract TS không chặn runtime — `new.target` có thể giả lập. Erasable (là JS).

---

### 3.2 `#private` method / getter

```ts
class C {
  #hidden() {
    return 1;
  }
  get #n() {
    return 2;
  }
  call() {
    return this.#hidden() + this.#n;
  }
}
```

Không `super.#hidden()` từ subclass — private **không kế thừa** như `protected`. Subclass khai `#hidden` riêng, không override.

---

## 4. Static members & static initialization blocks

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
- `private constructor` + factory: kiểm soát `new` ở kiểu (vẫn `new Id` được nếu bỏ qua TS).

### 4.1 `static {}` (ES2022)

```ts
class Env {
  static readonly isProd: boolean;
  static #secrets: Map<string, string>;
  static {
    this.isProd = process.env.NODE_ENV === "production";
    this.#secrets = new Map();
    try {
      this.#secrets.set("boot", "ok");
    } catch (e) {
      throw new Error("Env static init", { cause: e });
    }
  }
  static {
    // block thứ hai chạy sau block/field đứng trước — thứ tự nguồn
  }
}
```

| Quy tắc | Chi tiết |
|---------|----------|
| Thời điểm | Khi **đánh giá** class (load module), không phải `new` |
| `this` | constructor / class |
| Truy cập `#private` static | được |
| `await` | **không** — sync; async IIFE cấm trong static block thuần |
| Nhiều block | xen kẽ field static theo thứ tự nguồn |
| Exception | module fail load — không “lazy” |

```ts
class T {
  static a = 1;
  static {
    this.b = this.a + 1;
  }
  static b: number;
}
```

Static cũng có `private` / `#private` / `protected` (protected static dùng từ subclass).

**Khi nào KHÔNG dùng `static {}`:** I/O mạng lúc import (side effect module — [modules-packages.md](modules-packages.md)); prefer function `loadConfig()` gọi từ [main-function.md](main-function.md). Dùng block cho bảng lookup, brand, đăng ký `#private` static.

### 4.2 Static vs instance diagram

```
typeof Id  (constructor)
  .create() .from() .seq
        │
        │ new
        ▼
Id instance { value }
  [[Prototype]] → Id.prototype { constructor }
```

---

## 5. Prototype chain, `[[HomeObject]]`, `super`, `override`

### 5.1 Prototype chain

```
obj (instance)
  [[Prototype]] → Derived.prototype   { derived methods, constructor }
                    [[Prototype]] → Base.prototype { base methods }
                                      [[Prototype]] → Object.prototype
                                                        [[Prototype]] → null
```

```ts
class Base {
  base() {
    return "b";
  }
}
class Derived extends Base {
  derived() {
    return "d";
  }
}
const x = new Derived();
Object.getPrototypeOf(x) === Derived.prototype;
Object.getPrototypeOf(Derived.prototype) === Base.prototype;
x instanceof Derived;
x instanceof Base;
x instanceof Object;
```

Field instance (public fields ES2022) nằm **trên object**, không trên prototype. Method prototype **share** giữa instance.

```ts
class Counter {
  count = 0; // own property mỗi instance
  inc() {
    this.count++;
  } // trên Counter.prototype
}
const a = new Counter();
const b = new Counter();
a.inc === b.inc; // true
a.count === b.count; // value bằng, key riêng
```

`extends` constructor: `Derived.[[Prototype]]` → `Base` (static kế thừa). `Derived.create` tìm lên `Base.create` nếu không khai.

### 5.2 `[[HomeObject]]` và `super`

Method định nghĩa bằng **method syntax** (trong class / object literal) có internal slot `[[HomeObject]]` = object chứa method (`Derived.prototype`). `super.foo` lookup: `[[HomeObject]].[[Prototype]]` rồi gọi với `this` hiện tại.

```ts
class Logger {
  log(msg: string) {
    console.log(msg);
  }
}
class JsonLogger extends Logger {
  override log(msg: string) {
    super.log(`[json] ${msg}`); // [[HomeObject]] = JsonLogger.prototype
  }
}
```

| Bẫy | Hành vi |
|-----|---------|
| Gán `const f = obj.method` rồi `f()` | `this` mất; `super` **vẫn** theo HomeObject gốc |
| `Object.assign(dest, src.prototype)` copy method có `super` | `super` **không** đổi sang dest — vẫn HomeObject cũ |
| Arrow `f = () => super.x` | **SyntaxError** — arrow không có `[[HomeObject]]` |
| `function` thường trong constructor | không `super` |

```ts
class A {
  hello() {
    return "A";
  }
}
class B extends A {
  hello() {
    return super.hello() + "B";
  }
}
const stolen = B.prototype.hello;
stolen.call({ /* this */ }); // super vẫn A.prototype.hello — "AB"
```

Constructor con **phải** gọi `super(...)` trước `this`. `super()` trong constructor khác `super.method` (gọi constructor cha vs method).

```ts
class JsonLogger extends Logger {
  constructor(readonly prefix: string) {
    super();
  }
  override log(msg: string) {
    super.log(`${this.prefix} ${msg}`);
  }
}
```

### 5.3 `override` & `noImplicitOverride`

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

```json
{
  "compilerOptions": {
    "noImplicitOverride": true
  }
}
```

| Tình huống | Không `override` + flag | Có `override` |
|------------|-------------------------|---------------|
| Đúng tên method cha | **lỗi** (flag) | OK |
| Rename cha, con quên | method mới âm thầm | `override` → **lỗi** thiếu base |
| Typo `lgog` | method mới | `override lgog` → lỗi |

`override` trên field / accessor / method. Không có runtime. Erasable.

```ts
class Child extends Logger {
  override log(msg: string) {}
  // override missing() {} // lỗi — Logger không có missing
}
```

Bật `noImplicitOverride` trên TS 7 khuyến nghị (không nằm trong `strict`). Xem [tsconfig.md](tsconfig.md).

### 5.4 Override vs overload

Con override phải **gán được** vào signature cha (param bivariant method — [typesystem.md](typesystem.md) §13). Thắt param / nới return theo subtype. Overload list trên class: [functions-methods.md](functions-methods.md).

---

## 6. `implements`, instance type vs constructor type

```ts
interface Disposable {
  [Symbol.dispose](): void;
}

interface AsyncInitializable {
  init(): Promise<void>;
}

class Connection implements Disposable, AsyncInitializable {
  async init() {
    /* connect */
  }

  [Symbol.dispose]() {
    /* close */
  }
}
```

`implements` **chỉ kiểm tra instance type** — không emit, không runtime. Thiếu member → lỗi TS. `implements` nhiều interface = intersection.

### 6.1 Interface constructor (construct signature)

```ts
interface RepoCtor {
  new (url: string): { ping(): Promise<boolean> };
}

function open(C: RepoCtor, url: string) {
  return new C(url);
}
```

Abstract: §7.2 `abstract new`.

### 6.2 Class như interface — `typeof Class` vs `InstanceType`

```ts
class Service {
  static version = 1;
  start() {}
}

function run(s: Service) {
  s.start();
}

run({ start() {} }); // OK structural — đủ method start (không private)

type Inst = Service; // { start(): void }
type Ctor = typeof Service; // { new (): Service; version: number }
type Inst2 = InstanceType<typeof Service>; // Service
type Params = ConstructorParameters<typeof Service>; // []
```

| Viết | Nghĩa |
|------|--------|
| `x: User` | instance |
| `x: typeof User` | constructor (có static) |
| `x: InstanceType<typeof User>` | instance (khi `User` là type param giá trị) |
| `x: InstanceType<T>` với `T extends new (...args: never[]) => unknown` | instance từ ctor generic |

```ts
function factory<T extends new (...args: never[]) => unknown>(
  C: T,
  ...args: ConstructorParameters<T>
): InstanceType<T> {
  return new C(...args) as InstanceType<T>;
}
```

`new (...args: never[]) => T` cấm extra args không an toàn; thực dụng hay `any[]` / `unknown[]` — cân bằng.

### 6.3 Interface vs type alias

```ts
interface Point { x: number; y: number }
type PointT = { x: number; y: number };
```

- `interface` có thể **merge** declaration (augment).
- `type` linh hoạt hơn (union, mapped, conditional).
- Với OOP/`implements`, `interface` thường đọc tự nhiên hơn.

### 6.4 Method optional

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

## 7. Abstract classes & abstract construct signatures

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

- Không thể `new` abstract class **ở checker**.
- Có thể chứa implementation cụ thể + abstract members.
- Khác interface: abstract class giữ **state** và constructor logic.

| Nhu cầu | Chọn |
|---|---|
| Chia sẻ code + state + template method | `abstract class` |
| Chỉ hợp đồng hình dạng / nhiều implement độc lập | `interface` |
| Union / mapped / utility | `type` |

> `abstract` là **TS-only** — emit JS vẫn là class thường. Runtime không chặn `new` nếu ai đó bỏ qua kiểu.

### 7.1 Abstract construct signatures

```ts
type AbstractConstructor<T = object> = abstract new (...args: never[]) => T;
type ConcreteConstructor<T = object> = new (...args: never[]) => T;

function register(C: AbstractConstructor<Storage>) {
  // new C(); // lỗi — abstract
  return C;
}

function make<T extends Storage>(C: new () => T): T {
  return new C();
}

make(MemoryStorage);
// make(Storage); // lỗi
register(Storage); // OK — nhận abstract ctor
register(MemoryStorage); // concrete gán được vào abstract ctor type (thường)
```

| Kiểu | `new` được? | Nhận abstract class? |
|------|-------------|----------------------|
| `new () => T` | ✓ | ✗ |
| `abstract new () => T` | ✗ trên giá trị typed vậy | ✓ |
| `typeof Storage` (abstract class) | ✗ | — |

```ts
interface Plugin {
  start(): void;
}
interface PluginCtor {
  readonly key: string;
  new (): Plugin;
}

class LoggerPlugin implements Plugin {
  static readonly key = "logger";
  start() {}
}

const registry: PluginCtor[] = [LoggerPlugin];
```

Static trên construct signature: khai trên interface ctor (`key`), không trên instance.

**Khi nào KHÔNG dùng abstract class:** không có code/state chia sẻ — `interface` + factory. Hierarchy sâu abstract = fragile base.

---

## 8. `instanceof` & `Symbol.hasInstance`

```ts
class Box {}
const b = new Box();
b instanceof Box; // true
b instanceof Object; // true
```

`instanceof` đi theo prototype chain: `Box.prototype` có trong chain của `b`.

### 8.1 `Symbol.hasInstance`

Class/function có thể tùy biến `instanceof`:

```ts
class Even {
  static [Symbol.hasInstance](value: unknown): boolean {
    return typeof value === "number" && value % 2 === 0;
  }
}

2 instanceof Even; // true
3 instanceof Even; // false
({} instanceof Even); // false
```

```ts
class MaybeBox {
  static [Symbol.hasInstance](value: unknown): boolean {
    return (
      typeof value === "object" &&
      value !== null &&
      "value" in value
    );
  }
}
```

- Gọi `Type[Symbol.hasInstance](obj)` khi có; mặc định `OrdinaryHasInstance`.
- Dễ **phá trực giác** (`2 instanceof Even`) — document rõ; đừng dùng cho API rộng.
- Cross-realm: custom `hasInstance` trên class realm A không áp object realm B trừ khi bạn chủ đích.

**Khi nào KHÔNG dùng `Symbol.hasInstance`:** hierarchy Error/domain; duck typing đủ bằng `'code' in e`. Dùng cho branded numeric / protocol hiếm.

### 8.2 Khi hữu ích / khi mong manh

| Dùng `instanceof` khi | Tránh khi |
|---|---|
| Cùng realm, cùng constructor identity | DTO / JSON thuần (không prototype) |
| Error hierarchy nội bộ app | Structural typing / duck typing đủ |
| Phân nhánh behavior theo class hierarchy | `instanceof` qua **iframe / worker / vm** khác |

### 8.3 Cross-realm pitfall

Mỗi realm (iframe, `vm` context, một số worker boundary) có **constructor riêng**. `Error` từ realm khác có thể fail `err instanceof Error`.

```ts
function isErrorLike(e: unknown): e is { name: string; message: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as { message?: unknown }).message === "string"
  );
}

import { types } from "node:util";
types.isNativeError(new Error("x"));
```

Prefer: kiểm tra shape / `err.code` / branded type; `instanceof` chỉ khi chắc cùng module graph + cùng realm. [exceptions.md](exceptions.md).

### 8.4 Class có `private` → gần nominal hơn

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

Object literal `{ hello() {} }` **không** gán được vào `A` khi có private member. `#field` còn chặn structural hoàn toàn ở kiểu (private names).

---

## 9. Accessors vs methods

```ts
class Temp {
  #c = 0;
  get celsius() {
    return this.#c;
  }
  set celsius(v: number) {
    this.#c = v;
  }
  toF() {
    return this.#c * 1.8 + 32;
  }
}
```

| | Getter/setter | Method |
|--|---------------|--------|
| Gọi | `t.celsius` / `t.celsius =` | `t.toF()` |
| Trên prototype | accessor descriptor | function descriptor |
| `JSON.stringify` | **không** (prototype, enumerable false) | không |
| Pass callback | không — mất get | `t.toF` mất `this` giống method |
| Side effect | dễ giấu (đọc property) | tường minh |
| Override | `override get x()` | `override x()` |

```ts
class Base {
  get label() {
    return "b";
  }
}
class Child extends Base {
  override get label() {
    return super.label + "+";
  }
}
```

- Getter chạy mỗi lần đọc — đừng I/O trong getter.
- `readonly` TS ≠ getter không setter; `readonly` field vẫn own data property.
- Class field `x = 1` enumerable own; accessor prototype không enumerable — `for...in` / `keys` khác nhau.

```ts
class Mix {
  own = 1;
  get computed() {
    return 2;
  }
}
JSON.stringify(new Mix()); // '{"own":1}' — không có computed
```

**Khi nào KHÔNG dùng getter:** async, I/O, throw thường xuyên, chi phí nặng. Method `getX()` rõ ràng. Chi tiết getter `this`: [functions-methods.md](functions-methods.md).

---

## 10. `this` trong method vs arrow

### 10.1 Prototype method — `this` động

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

### 10.2 Arrow field — lexical `this`

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

Trade-off: mỗi instance một hàm riêng (không share prototype) — tốn hơn một chút bộ nhớ; hữu ích cho listener. **Không** `override` dễ dàng như prototype method; không `super.tick()` trên arrow field.

### 10.3 Annotate `this` param (TS)

```ts
function asHandler(this: Timer) {
  this.tick();
}
```

Chi tiết `call`/`apply`/`bind`: [functions-methods.md](functions-methods.md). Variance callback: [functions-callbacks.md](functions-callbacks.md), [typesystem.md](typesystem.md) §13.

> **Quy tắc thực dụng:** method trên prototype mặc định; arrow field chỉ khi callback bắt buộc giữ instance; tránh mix lung tung trong cùng class.

---

## 11. Polymorphic `this` types

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

`this` parameter `this: this` trên method fluent — [typesystem.md](typesystem.md) §17.3.

**Khi nào KHÔNG trả `this`:** factory static trả instance mới (`clone()`) — trả `this` sẽ nói dối (cùng reference). Trả `InstanceType` / class cụ thể.

---

## 12. Composition vs inheritance (Go embedding)

> **Ý kiến baseline repo:** prefer **composition** (`has-a`) cho hầu hết service Node. Kế thừa chỉ khi có quan hệ **is-a** rõ và hierarchy nông (≤ 2–3 tầng).

### 12.1 Composition

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

### 12.2 Go embedding analogue

Go **embed** struct → method được **promote** tự động:

```go
type Logger struct{}
func (Logger) Log(msg string) {}

type Service struct {
    Logger // embedding
}
// Service{}.Log("x") — promoted
```

JavaScript/TS **không** có embedding. Composition phải **ủy quyền tường minh** (hoặc mixin §13):

```ts
class Logger {
  log(msg: string) {
    console.log(msg);
  }
}

class Service {
  readonly logger = new Logger();
  log(msg: string) {
    return this.logger.log(msg); // forward tay
  }
}
```

| | Go embed | TS compose | TS `extends` | Mixin |
|--|----------|------------|--------------|-------|
| Promote method | tự động | forward tay | proto chain | generate subclass |
| Nhiều “embed” | nhiều field | nhiều collaborator | **một** `extends` | chồng HOC class |
| Overlay tên | selector rõ | bạn chọn | override | thứ tự mixin |
| `instanceof` | khác | không “is Logger” | `instanceof Base` | `instanceof` class cuối |

Bảng quyết định:

| Nhu cầu | Chọn |
|---------|------|
| Reuse 1–2 method / logger / clock | compose + forward (hoặc helper function) |
| is-a + template method | `extends` nông |
| Ngang hàng Timestamped + Activatable | mixin hoặc compose hai object |
| Port / DTO | `interface` — không class |

### 12.3 Inheritance khi hợp lý

- Template method: abstract base + vài hook override.
- Framework extension point đã thiết kế `extends`.
- Shared invariant thật sự thuộc cùng loại đối tượng.

### 12.4 Anti-pattern

| Tránh | Lý do |
|---|---|
| Cây kế thừa sâu “tiện share code” | Fragile base class; đổi cha phá con |
| God class (HTTP + DB + domain) | Khó test, khó rotate ownership |
| Inherit để “reuse” 1–2 method | Extract function / collaborator |
| `extends EventEmitter` mọi service | Prefer compose `EventEmitter` hoặc trả typed bus |

```ts
class JobRunner {
  readonly events = new EventEmitter<{ done: [id: string] }>();
}
```

---

## 13. Mixin: intersection + constraint

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

Constraint `TBase extends Constructor` (hoặc `Constructor<{ id: string }>`) buộc base `new` được và có shape tối thiểu:

```ts
function WithId<TBase extends Constructor<{ id: string }>>(Base: TBase) {
  return class extends Base {
    equals(other: { id: string }) {
      return this.id === other.id;
    }
  };
}
```

Instance type mixin ≈ intersection:

```ts
type TimestampedInstance = { createdAt: Date };
type ActivatableInstance = { isActive: boolean; activate(): void };

type UserLike = Entity & TimestampedInstance & ActivatableInstance;
```

`typeof User` sau mixin là constructor ẩn danh — đặt tên:

```ts
class User extends Activatable(Timestamped(Entity)) {}
type UserCtor = typeof User;
type UserInst = InstanceType<typeof User>;
```

Thực dụng:

- Share behavior ngang hàng khi không muốn cây kế thừa sâu.
- Typing mixin phức tạp (construct params `never[]` vs rest thật); nhiều team prefer **composition**.
- Mixin class ẩn danh khó `instanceof` ổn định trừ khi `class User extends Mixin(Base) {}`.
- Decorators (khi bật) là hướng khác cho cross-cutting — [decorators.md](decorators.md).

**Khi nào KHÔNG mixin:** hai collaborator độc lập (logger + db) — compose. Mixin khi thật sự cần `this` chung / field trên cùng instance / `instanceof` một class.

### 13.1 Constructor args xuyên mixin

```ts
type Ctor<T = object, A extends unknown[] = never[]> = new (...args: A) => T;

function Tagged<TBase extends Ctor>(Base: TBase) {
  return class extends Base {
    tag = "x";
    constructor(...args: any[]) {
      super(...args);
    }
  };
}
```

`...args: any[]` là điểm yếu typing mixin — TS khó suy args qua class ẩn danh. Prefer `class User extends Mixin(Entity) { constructor(id: string) { super(id); } }` để giữ signature.

Không `super()` thiếu args của base. Field mixin init **sau** `super` — cùng bẫy §1.4.

---

---

## 14. Structural typing, declaration merging

### 14.1 Structural, không nominal

```ts
class Person {
  constructor(public name: string) {}
}

class Dog {
  constructor(public name: string) {}
}

const p: Person = new Dog("Mun"); // OK về kiểu — cùng shape
```

Branded / private field khi cần phân biệt:

```ts
class UserId {
  private readonly brand = "UserId";
  constructor(public readonly value: string) {}
}
```

### 14.2 Class dùng làm kiểu

```ts
class Service {
  start() {}
}

function run(s: Service) {
  s.start();
}

run({ start() {} }); // OK — structural: đủ method start
```

### 14.3 Khi dùng class vs interface

| Dùng **class** khi | Dùng **interface** / type khi |
|---|---|
| Cần runtime (`instanceof`, prototype) | Chỉ hợp đồng compile-time |
| Có state + behavior đóng gói | DTO / JSON shape |
| Cần `#private`, inheritance | Union / mapped / utility |
| DI token runtime | Thuần mô tả API / port |

Prefer: **interface cho dữ liệu & port**, **class cho adapter/service có lifecycle**.

### 14.5 Class expression & `typeof`

```ts
const make = <T extends string>(name: T) =>
  class {
    readonly kind = name;
  };

const Cat = make("cat");
type Cat = InstanceType<typeof Cat>;
new Cat().kind; // "cat"
```

Class expression ẩn danh: stack/`name` nghèo — đặt `class Cat extends …` khi public.

`Foo.name` runtime là chuỗi tên hàm constructor (minify đổi). Đừng dùng `name` làm discriminant ổn định — dùng `code` / literal field.

> Class expression trả từ factory generic: mỗi lần gọi một constructor **khác** (`instanceof` không chia sẻ giữa lần gọi).

---

### 14.4 Declaration merging của class

TS cho merge **class + interface** cùng tên (instance side) và **class + namespace** (static side). **Không** merge hai `class`.

```ts
class Foo {
  x = 1;
}
interface Foo {
  y: string; // chỉ kiểu — runtime không có y trừ khi gán
}
const f = new Foo();
f.x;
f.y; // typed; runtime undefined nếu chưa gán
```

```ts
class Bar {
  static base = 1;
}
namespace Bar {
  export function helper() {
    return Bar.base;
  }
}
Bar.helper();
```

| Merge | Erasable? | Dùng |
|-------|-----------|------|
| `class` + `interface` | interface xóa | augment instance type (lib `.d.ts`) |
| `class` + `namespace` runtime | **không** (`erasableSyntaxOnly`) | legacy static; tránh `node file.ts` |
| Hai `class` cùng tên | lỗi duplicate | — |
| `interface` + `interface` | ✓ | [typesystem.md](typesystem.md) §8 / §17 |

Module augmentation **không** thêm method runtime vào class lib — chỉ kiểu. Implement thật phải prototype patch (đừng, trừ polyfill).

> Collision: interface merge `y: string` trong khi class có `y: number` → lỗi. Augment class built-in (`interface Error`) — [exceptions.md](exceptions.md), [typesystem.md](typesystem.md).

---

## 15. Decorators (cross-link)

Stage 3 decorator gắn class/method/field/accessor — **không** thay `extends`. Chi tiết: [decorators.md](decorators.md).

```ts
function sealed(value: unknown, context: ClassDecoratorContext) {
  if (context.kind !== "class") return;
}

@sealed
class Account {}
```

| | Decorator | `extends` / mixin |
|--|-----------|-------------------|
| Cross-cutting (log, bind) | hợp | nặng |
| Thêm field/state lớn | mixin/compose | decorator field có thể |
| Strip Node 26 | thường cần emit `tsc` | class thuần erasable |
| `legacy experimentalDecorators` | Nest/TypeORM cũ | không trộn mental model |

**Khi nào KHÔNG decorator:** chỉ để “trông enterprise”; compose function đủ. Metadata `emitDecoratorMetadata` không đi với Stage 3 như legacy — xem [decorators.md](decorators.md). `erasableSyntaxOnly` + decorator transform: cần toolchain.

---

## 16. Khi nào KHÔNG dùng class / `extends`

| Tránh | Lý do | Dùng thay |
|-------|-------|-----------|
| Class cho DTO JSON | không prototype sau parse | `interface` / `type` + parse |
| `extends` để share 1 helper | fragile | function / compose |
| Parameter properties + `node .ts` | không erasable | field tường minh |
| `private` TS như bảo mật | erase | `#field` |
| `instanceof` DTO / cross-realm | fail | `code` / shape |
| Abstract 5 tầng | đắt đổi | interface + strategy |
| Mixin 4 lớp ẩn danh | typing/`instanceof` khổ | class đặt tên hoặc compose |
| Arrow mọi method | tốn RAM, khó `super` | prototype + bind chỗ callback |
| Getter I/O | giấu latency | method async |
| `Symbol.hasInstance` chơi chữ | bất ngờ | protocol rõ |
| Namespace merge class | không erasable | static method / module ES |
| God class EventEmitter | test khó | compose bus |

---

## 17. Best practices

1. Prefer composition hơn cây kế thừa sâu; `extends` khi is-a rõ. Không có Go embed — forward tường minh.
2. Bật `strict` + `noImplicitOverride`.
3. `#private` cho invariant runtime; `private` TS cho encapsulation typing.
4. `readonly` cho dependency trong constructor.
5. Fluent API: trả `this` (polymorphic).
6. Prototype method mặc định; arrow field chỉ khi callback cần lexical `this`.
7. Đừng dựa `instanceof` cross-realm / JSON DTO — shape / `code` / brand. `Symbol.hasInstance` hiếm.
8. Tránh parameter properties nếu workflow `erasableSyntaxOnly` / `node file.ts`.
9. Interface cho port; class cho implementation có state. `typeof Class` vs instance đừng nhầm.
10. Mixin chỉ khi composition + interface chưa đủ — constraint `Constructor<T>`, đặt tên class cuối.
11. Không gọi override từ field initializer base.
12. Decorator: xem [decorators.md](decorators.md); đừng trộn legacy.

---

## 18. Checklist

```text
□ Field initializer / constructor / definite assignment rõ lifecycle
□ public/protected/private chỉ là TS — #private nếu cần ẩn runtime
□ abstract / implements đúng nhu cầu (code+state vs hợp đồng)
□ override + noImplicitOverride khi kế thừa
□ super() trước this; hiểu [[HomeObject]] khi copy method
□ Callback method: bind / arrow field / wrap — không detach trần
□ instanceof chỉ cùng realm; Error → util.types / shape
□ Hierarchy nông; composition cho service (forward, không embed ma thuật)
□ Không god class; DTO ≠ service
□ Strip-types? tránh parameter properties / enum / namespace merge
□ typeof Class vs InstanceType đúng chỗ factory
□ Accessor không I/O; JSON không có getter prototype
□ Mixin: class có tên; constraint Constructor
□ Static I/O không nhét static {} lúc import
□ new.target / abstract: đừng tin runtime chặn new
□ Class expression public: có tên (stack / instanceof đọc được)
```

---

## 19. Cheat sheet

```ts
class C {
  public a = 1;
  protected b = 2;
  private c = 3;
  #d = 4;
  static s = 5;
  static {
    this.s = 5;
  }
  tick = () => {}; // lexical this
  constructor(id: string) {
    this.id = id;
  }
  readonly id: string;
  get label() {
    return this.id;
  }
  method(): this {
    return this;
  }
}

abstract class Base {
  abstract run(): void;
}

class Impl extends Base implements Disposable {
  override run() {}
  [Symbol.dispose]() {}
}

obj instanceof Impl;
Even[Symbol.hasInstance];

type Inst = Impl;
type Ctor = typeof Impl;
type I2 = InstanceType<typeof Impl>;
```

| Cần | Chọn |
|---|---|
| Ẩn runtime | `#field` |
| Brand check không throw | `#x in obj` |
| API typing nội bộ | `private` / `protected` |
| Hợp đồng không state | `interface` |
| Template + state | `abstract class` |
| Ctor abstract | `abstract new () => T` |
| Reuse ngang | compose / mixin nhẹ |
| Fluent subclass | `return this` |
| Callback giữ instance | arrow field / `bind` |
| Erasable constructor | field tường minh, không param props |
| Factory generic | `InstanceType<T>` + `typeof Class` |
| `instanceof` tùy biến | `Symbol.hasInstance` (hiếm) |

---

## 20. Version matrix

| Nền | Liên quan OOP |
|---|---|
| ES2015 | `class`, `extends`, `super`, `static`, `[[HomeObject]]` |
| ES2022 | public fields, `#private`, `static {}`, brand check, `#x in` |
| TS | `public`/`private`/`protected`, `abstract`, `implements`, parameter properties |
| TS 4.3+ | `override` keyword |
| TS 4.2+ | `abstract` construct signatures (`abstract new`) |
| TS 5+/7 | Stage 3 decorators (tách khỏi legacy) — [decorators.md](decorators.md) |
| **Node 26** | full class fields / `#private`; strip-types **không** chạy parameter props |
| **TS 7** | `strict` mặc định; `noImplicitOverride` khuyến nghị; `node10` resolution error |

Baseline: **Node 26** + **TS 7**.

---

## 21. Tài liệu liên quan

- [Hàm & Method](functions-methods.md) — `this`, overload, bind, accessor
- [Function type, Callback & Lambda](functions-callbacks.md)
- [Hệ thống kiểu](typesystem.md) — structural, variance method vs function, merging
- [Tập hợp & Generics](collections-generics.md)
- [Decorators & Metadata](decorators.md)
- [Exception / Error](exceptions.md) — custom class, `instanceof`
- [tsconfig & biên dịch](tsconfig.md) — `erasableSyntaxOnly`, `noImplicitOverride`
- [Statements](statements.md) — `using`, class `Disposable`
- [Modules & Packages](modules-packages.md)
- [Keywords](keywords.md) — `class` / `extends` / `super`
- [Main / entry](main-function.md) — không I/O trong `static {}` lúc import

---