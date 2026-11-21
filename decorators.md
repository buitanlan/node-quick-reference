# Decorators & Metadata

Stage 3 JS decorators, legacy `experimentalDecorators`, và ranh giới metadata trên **TypeScript 7**.

> **Callout:** Baseline: **TS 7**. Chọn decorator Stage 3 hoặc legacy `experimentalDecorators` theo hợp đồng framework. Node 26 type stripping không parse decorator; `erasableSyntaxOnly` không phát hiện giới hạn này. Dùng pipeline emit và kiểm tra JS thực tế. Xem [oop.md](oop.md) và [tsconfig.md](tsconfig.md).

---

## Mục lục

- [1. Hai “thế giới” decorator](#1-hai-thế-giới-decorator)
- [2. Bật decorator trong TypeScript](#2-bật-decorator-trong-typescript)
  - [Node type stripping — caution](#node-type-stripping--caution)
- [3. Stage 3 — semantics theo kind](#3-stage-3--semantics-theo-kind)
  - [3.1 Class decorator](#31-class-decorator)
  - [3.2 Method decorator](#32-method-decorator)
  - [3.3 Field decorator](#33-field-decorator)
  - [3.4 Getter / setter](#34-getter--setter)
  - [3.5 Auto-accessor (`accessor`)](#35-auto-accessor-accessor)
  - [3.6 `context.access`](#36-contextaccess)
  - [3.7 Static vs instance, private](#37-static-vs-instance-private)
  - [3.8 Factory vs decorator function](#38-factory-vs-decorator-function)
  - [3.9 Subclass & wrap](#39-subclass--wrap)
- [4. Thứ tự evaluate / apply & initializer](#4-thứ-tự-evaluate--apply--initializer)
  - [4.1 Thứ tự trên class](#41-thứ-tự-trên-class)
  - [4.2 Initializer vs wrapper](#42-initializer-vs-wrapper)
- [5. `context.addInitializer` & init wrappers](#5-contextaddinitializer--init-wrappers)
- [6. Metadata Stage 3 vs `Reflect.metadata`](#6-metadata-stage-3-vs-reflectmetadata)
  - [6.1 Stage 3 `context.metadata`](#61-stage-3-contextmetadata)
  - [6.2 `reflect-metadata` (legacy)](#62-reflect-metadata-legacy)
  - [6.3 Ví dụ ý tưởng (legacy)](#63-ví-dụ-ý-tưởng-legacy)
  - [6.4 Registry tường minh (không Reflect)](#64-registry-tường-minh-không-reflect)
- [7. Legacy `experimentalDecorators`](#7-legacy-experimentaldecorators)
- [8. Decorator, type stripping và compiler flags](#8-decorator-type-stripping-và-compiler-flags)
  - [8.1 Chọn cấu hình theo framework](#81-chọn-cấu-hình-theo-framework)
  - [8.2 Kiểm tra workflow thực tế](#82-kiểm-tra-workflow-thực-tế)
  - [8.3 `context.metadata` vs `Symbol.metadata`](#83-contextmetadata-vs-symbolmetadata)
  - [8.4 Metadata không phải runtime validation](#84-metadata-không-phải-runtime-validation)
- [9. Khi nào dùng HOF thay decorator](#9-khi-nào-dùng-hof-thay-decorator)
  - [9.1 Composition HOF](#91-composition-hof)
  - [9.2 Pitfalls decorator (tóm tắt)](#92-pitfalls-decorator-tóm-tắt)
- [10. So sánh nhanh & lựa chọn](#10-so-sánh-nhanh--lựa-chọn)
- [11. Best practices](#11-best-practices)
- [12. Checklist](#12-checklist)
- [13. Cheat sheet](#13-cheat-sheet)
- [14. Version notes](#14-version-notes)
- [15. Tài liệu liên quan](#15-tài-liệu-liên-quan)

---

## 1. Hai “thế giới” decorator

| | **Stage 3 (chuẩn JS / TS 7)** | **Legacy (`experimentalDecorators`)** |
|---|---|---|
| Spec | TC39 Stage 3 | Thiết kế TypeScript cũ (trước chuẩn) |
| Context API | `context` object giàu thông tin | `(target, propertyKey, descriptor)` |
| `emitDecoratorMetadata` | **không** đi kèm như legacy | thường + `reflect-metadata` |
| Parameter decorator | **Không** 1-1 | Có `(target, key, index)` |
| Nest/TypeORM cũ | Thường **không** drop-in | Có |
| `erasableSyntaxOnly` | Compiler cho phép decorator; Node strip không parse `@` | Tương tự, cần pipeline emit |
| Khuyến nghị code mới | **Có** (nếu không strip-only) | Chỉ khi framework yêu cầu |

Chúng **không tương thích API** — không trộn hai chế độ trong cùng mental model, cùng file, cùng `tsconfig`.

TypeScript emit decorator Stage 3 bằng helpers như `__esDecorate` / `__runInitializers`; legacy dùng `__decorate` và có thể `__metadata`. `target: ES2022` không giữ nguyên `@dec` trong JS đầu ra. [TypeScript 5.0](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#decorators).

> **Callout:** Bật `experimentalDecorators: true` → **tắt** Stage 3 trong compiler. Không “cả hai cùng lúc”.

---

## 2. Bật decorator trong TypeScript

**Stage 3 (khuyến nghị):**

```json
{
  "compilerOptions": {
    "target": "ES2025",
    "experimentalDecorators": false
  }
}
```

Từ TS 5.0+, decorator chuẩn được hỗ trợ khi **không** bật `experimentalDecorators`. `"target": "ES2022"` là **mức tối thiểu** để emit Stage 3 decorator sạch (class fields/static blocks chuẩn); trên Node 26 nên dùng `"ES2025"` hoặc `"ESNext"`. TS 7 giữ parity ngữ nghĩa với 6.x về decorator; headline là tốc độ compiler.

**Không** cần `emitDecoratorMetadata` cho Stage 3. Flag đó chỉ nuôi `design:type` / `design:paramtypes` **legacy**.

**Legacy:**

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

`emitDecoratorMetadata` chỉ có ý nghĩa với legacy + `reflect-metadata`.

### Node type stripping — caution

> Node 26 không hỗ trợ cú pháp decorator trong `node file.ts`: parser error. `erasableSyntaxOnly` chỉ chặn một nhóm cú pháp TypeScript cần emit riêng; flag này cho phép decorator và không bảo đảm chương trình chạy được bằng strip. Production: `tsc` emit hoặc transpiler đã kiểm tra tương thích.

Kể cả V8 parse được Stage 3 native: đó là **JS engine**, không phải “strip biến decorator thành JS”. Workflow strip **không** phải chỗ gắn Nest/DI. Xem §8.

`tsx` / esbuild transpile decorator (cách riêng) — **không** bảo đảm 1-1 spec Stage 3. Prod thư viện: `tsc` emit.

---

## 3. Stage 3 — semantics theo kind

Decorator là hàm nhận **value** (hoặc `undefined` với field) và **context**, có thể:

- trả về giá trị thay thế (class / method / field init),
- đăng ký side-effect qua `context.addInitializer`,
- đọc `context.name`, `context.static`, `context.private`, `context.kind`, `context.metadata`, `context.access`, …

`context.kind`: `"class"` | `"method"` | `"getter"` | `"setter"` | `"field"` | `"accessor"`.

### 3.1 Class decorator

Nhận constructor, có thể **thay class** (trả subclass / proxy). `undefined` = giữ nguyên.

```ts
type Class = abstract new (...args: any[]) => any;

function sealed<C extends Class>(
  value: C,
  context: ClassDecoratorContext<C>,
) {
  context.addInitializer(function (this: C) {
    Object.seal(this);
    Object.seal(this.prototype);
  });
  return value;
}

@sealed
class User {
  static role = "member";
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}
```

> **Pitfall:** Không gọi `Object.seal(value)` trực tiếp trong thân class decorator! Lúc class decorator đang apply, `static` fields vẫn **chưa** được định nghĩa — gọi `Object.seal(value)` sớm sẽ ném `TypeError: Cannot define property ..., object is not extensible` trên mọi class có `static` field. Đưa vào `context.addInitializer` đảm bảo seal chạy **sau** khi static fields khởi tạo xong.

Thay thế class bằng subclass (`return class extends value`):

```ts
function withTimestamp<C extends new (...args: any[]) => object>(
  value: C,
  _context: ClassDecoratorContext<C>,
) {
  return class extends value {
    createdAt = Date.now();
  };
}

@withTimestamp
class Order {
  id: string;
  constructor(id: string) {
    this.id = id;
  }
}
```

**Vị trí decorator với `export`:** đặt trước **hoặc** sau `export` / `export default` đều hợp lệ (`@sealed export class A {}` hoặc `export @sealed class A {}`, tương tự `@sealed export default class {}` hoặc `export default @sealed class {}`), nhưng **không** đặt ở cả hai bên cùng lúc (`SyntaxError`).

Factory (decorator có tham số):

```ts
function component(tag: string) {
  return function <C extends Class>(value: C, context: ClassDecoratorContext<C>) {
    context.addInitializer(function (this: C) {
      (this as any).tag = tag;
    });
    return value;
  };
}

@component("user-card")
class UserCard {}
```

Class decorator **không** nhận instance — `this` trong `addInitializer` của class kind là **constructor** (static init), không phải instance. Gắn instance → decorator **field/method** hoặc `addInitializer` trên member instance.

### 3.2 Method decorator

Value = hàm gốc. Return wrapper **cùng signature** (hoặc `undefined` = không wrap).

```ts
function logged<This, Args extends unknown[], Return>(
  value: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) {
  const name = String(context.name);
  return function (this: This, ...args: Args): Return {
    console.log(`call ${name}`, args);
    return value.apply(this, args);
  };
}

class Cart {
  @logged
  add(item: string) {
    return item;
  }
}
```

`context.static` / `context.private` phân nhánh. Private member (`#foo`): `context.name` **luôn là `string`** (ví dụ `"#foo"`), không bao giờ là `symbol`; chỉ public computed property mới có thể là `symbol`.

**Không** mutate `value` in-place rồi return khác — return wrapper mới. Giữ `this` bằng `apply`/`call`.

Async:

```ts
function timed<This, A extends unknown[], R>(
  value: (this: This, ...a: A) => Promise<R>,
  context: ClassMethodDecoratorContext,
) {
  const name = String(context.name);
  return async function (this: This, ...a: A): Promise<R> {
    const t0 = performance.now();
    try {
      return await value.apply(this, a);
    } finally {
      console.log(name, performance.now() - t0);
    }
  };
}
```

Wrap async lên method sync → đổi semantics (luôn trả Promise) — **đừng** trừ khi API đã `async`.

### 3.3 Field decorator

Field decorator chạy quanh **initializer**, không wrap kiểu method descriptor legacy. Value lúc decorate = `undefined`. Return **init wrapper**: `(initial) => storedValue`.

```ts
function uppercase(
  _value: undefined,
  _context: ClassFieldDecoratorContext<unknown, string>,
) {
  return function (this: unknown, initial: string) {
    return initial.toUpperCase();
  };
}

class Product {
  @uppercase
  name = "widget";
}
// name === "WIDGET"
```

Khi khởi tạo instance (hoặc static field): `addInitializer` của method/getter/setter chạy *trước* instance fields, còn `addInitializer` của chính **field / accessor** lại chạy **SAU** khi init wrapper của field đó đã gán giá trị xong (xem bảng lifecycle §4.1).

Nhiều field decorator: evaluate LTR, apply RTL (onion) lên chuỗi init.

Không có descriptor để `writable: false` như legacy — dùng getter decorator / `accessor` nếu cần chặn gán.

### 3.4 Getter / setter

Kind tách: `ClassGetterDecoratorContext` / `ClassSetterDecoratorContext`. Wrap `get` hoặc `set` độc lập. `@dec get x` **không** tự decorate setter.

```ts
function readonlyGet<This, Return>(
  value: (this: This) => Return,
  _context: ClassGetterDecoratorContext<This, Return>,
) {
  return value;
}

class Config {
  #token = "secret";

  @readonlyGet
  get token() {
    return this.#token;
  }
}
```

Log setter:

```ts
function loggedSet<This, V>(
  value: (this: This, v: V) => void,
  context: ClassSetterDecoratorContext<This, V>,
) {
  const name = String(context.name);
  return function (this: This, v: V) {
    console.log("set", name, v);
    value.call(this, v);
  };
}
```

### 3.5 Auto-accessor (`accessor`)

`accessor x = 0` tạo getter/setter + private backing storage — điểm gắn quan sát state rõ hơn field thuần (field không có trap lúc gán sau init).

```ts
function observed<This, V>(
  value: ClassAccessorDecoratorTarget<This, V>,
  context: ClassAccessorDecoratorContext<This, V>,
): ClassAccessorDecoratorResult<This, V> {
  return {
    get(this: This) {
      return value.get.call(this);
    },
    set(this: This, next: V) {
      console.log(`set ${String(context.name)}`, next);
      value.set.call(this, next);
    },
    init(this: This, initial: V) {
      return initial;
    },
  };
}

class Point {
  @observed
  accessor x = 0;
}
```

Return object có thể gồm `get`, `set`, `init` — thiếu key = giữ mặc định. `value.get` / `value.set` là target gốc (backing).

`accessor` **không** phải Stage 3 “bắt buộc” cho mọi field — syntax riêng; decorator `kind: "accessor"`.

### 3.6 `context.access`

Stage 3 cung cấp `context.access` (`has` / `get` / `set` tùy kind) để decorator hoặc registry bên ngoài đọc/ghi cả **`#private` field** hoặc `accessor` mà không phá đóng gói:

```ts
type StringFieldAccess<T> = {
  has(obj: T): boolean;
  get(obj: T): string;
  set(obj: T, value: string): void;
};

const trimmed = new WeakMap<object, Map<string | symbol, StringFieldAccess<any>>>();

function trimField<This extends object>(
  _value: undefined,
  context: ClassFieldDecoratorContext<This, string>,
) {
  context.addInitializer(function (this: This) {
    let map = trimmed.get(this);
    if (!map) {
      map = new Map();
      trimmed.set(this, map);
    }
    map.set(context.name, context.access);
    if (context.access.has(this)) {
      context.access.set(this, context.access.get(this).trim());
    }
  });
}

class Profile {
  @trimField
  #handle = "  alice  ";

  get handle() {
    return this.#handle;
  }
}
// new Profile().handle === "alice" — kể cả đọc/ghi từ bên ngoài qua map.get("#handle")
```

Với method decorator bind `this` lên instance, nhớ chặn `context.private` vì không thể gán đè private method trên `this[name]`:

```ts
function bound<This, A extends unknown[], R>(
  value: (this: This, ...a: A) => R,
  context: ClassMethodDecoratorContext<This, (this: This, ...a: A) => R>,
) {
  if (context.private) {
    throw new TypeError("@bound cannot decorate private methods");
  }
  const { name, addInitializer } = context;
  addInitializer(function (this: This) {
    (this as Record<PropertyKey, unknown>)[name] = value.bind(this);
  });
}
```

(Pattern bind-on-construct; cân nhắc arrow field / bind trong ctor — [functions-methods.md](functions-methods.md).)

Luôn kiểm `context.kind` trước khi giả định `access.set` tồn tại (`method` và `getter` chỉ có `has`/`get`; `setter` chỉ có `has`/`set`; `field` và `accessor` có đủ `has`/`get`/`set`).

### 3.7 Static vs instance, private

`context.static === true` trên `static m()` / `static field`. Initializer static chạy **một lần** khi class evaluate xong — không mỗi `new`.

Private `#m`: `context.private === true`; `context.access.get(instance)` đọc mà không lộ tên. Decorator **không** biến private thành public API trừ khi gắn registry.

`context.name` với computed `["k"]` là string `"k"`; symbol thì giữ symbol. `String(context.name)` cho log.

Không decorate `constructor` như method — class decorator bao constructor.

### 3.8 Factory vs decorator function

```ts
function retry(n: number) {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError("retry count must be an integer >= 1");
  }
  return function <This, A extends unknown[], R>(
    value: (this: This, ...args: A) => Promise<R>,
    _ctx: ClassMethodDecoratorContext<This, (this: This, ...args: A) => Promise<R>>,
  ) {
    return async function (this: This, ...args: A): Promise<R> {
      let last: unknown;
      for (let i = 0; i < n; i++) {
        try {
          return await value.apply(this, args);
        } catch (err) {
          last = err;
        }
      }
      throw last;
    };
  };
}

class Jobs {
  @retry(3)
  async run() {
    return "ok";
  }
}
```

`@retry` không ngoặc → `retry` phải là `(value, context) => …`. Nhầm `@retry` / `@retry()` là chân thường gặp.

`@foo.bar()` nếu `bar` unbound mất `this` — gán `const bar = foo.bar.bind(foo)` hoặc factory độc lập.

### 3.9 Subclass & wrap

Wrapper method trên **base** không tự áp lên method override ở subclass trừ khi subclass cũng `@` hoặc gọi `super`. Class decorator replace constructor: `extends` subclass vẫn `extends` **giá trị sau decorate** nếu `@` trên base trước khi `class Child extends Base` — thứ tự khai báo file quan trọng.

Field init wrapper **không** chạy lại khi gán `this.name = "x"` sau construct — chỉ giá trị khởi tạo. Muốn trap gán → `accessor`.

---

## 4. Thứ tự evaluate / apply & initializer

```ts
@a @b
method() {}
```

Hai pha **khác nhau**:

1. **Evaluate** decorator **expression** (gọi factory `@retry(3)` → chạy `retry(3)`): **trái → phải**, trên → dưới theo source (a rồi b).
2. **Apply** hàm decorator (nhận value+context, trả wrapper): **phải → trái** (gần thành viên trước — b rồi a) — onion / middleware.

```ts
function a<This, Args extends unknown[], Ret>(
  value: (this: This, ...args: Args) => Ret,
  _ctx: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Ret>,
) {
  console.log("apply a");
  return value;
}
function b<This, Args extends unknown[], Ret>(
  value: (this: This, ...args: Args) => Ret,
  _ctx: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Ret>,
) {
  console.log("apply b");
  return value;
}

class S {
  @a @b
  m() {}
}
// evaluate: a (identity), b (identity) — factories nếu có chạy LTR
// apply: b rồi a
```

Factory:

```ts
function log(label: string) {
  console.log("eval", label);
  return function <This, Args extends unknown[], Ret>(
    _value: (this: This, ...args: Args) => Ret,
    _ctx: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Ret>,
  ) {
    console.log("apply", label);
    // trả void (không return Function thô để tránh lỗi TS1270)
  };
}

class T {
  @log("A") @log("B")
  m() {}
}
// eval A, eval B, apply B, apply A
```

### 4.1 Thứ tự trên class

Bảng lifecycle Stage 3 đầy đủ (tách pha **định nghĩa class** và pha **khởi tạo `new`**):

| Pha | Bước | Điều gì chạy |
|-----|------|--------------|
| **Định nghĩa class** | 1 | Evaluate decorator expressions (class decorators trước, rồi member decorators xen kẽ computed property names theo thứ tự source) |
| | 2 | Apply member decorators (mỗi stack từ dưới lên / phải → trái) |
| | 3 | Apply class decorators (từ dưới lên; có thể trả subclass thay thế) |
| | 4 | Chạy `addInitializer` của **static method / getter / setter** (`this` = constructor) |
| | 5 | Khởi tạo từng **static field / accessor** theo thứ tự khai báo: init wrapper → gán giá trị → chạy `addInitializer` của chính field / accessor đó |
| | 6 | Chạy `addInitializer` của **class decorator** (`this` = constructor cuối cùng) |
| **Khởi tạo `new`** | 7 | (Nếu `extends`) chạy `super()` |
| | 8 | Chạy `addInitializer` của **instance method / getter / setter** (`this` = instance) |
| | 9 | Khởi tạo từng **instance field / accessor** theo thứ tự khai báo: init wrapper → gán giá trị → chạy `addInitializer` của chính field / accessor đó |
| | 10 | Chạy thân `constructor` |

Lưu ý bước 8 vs 9: `addInitializer` của method/getter/setter chạy **trước** instance fields, còn `addInitializer` của **field/accessor** chạy **sau** khi init wrapper của chính field đó đã gán xong. Không gộp thành quy tắc “instance trước static” cho mọi bước.

---

### 4.2 Initializer vs wrapper

| Cơ chế | Khi chạy | Dùng |
|---|---|---|
| Method wrapper (return từ decorator) | Mỗi **lần gọi** method | log, retry, timing |
| Field init wrapper (return từ field dec) | **Một lần** lúc gán ban đầu | normalize default |
| `accessor` `init` | Lúc init backing | giống field init |
| `context.addInitializer` | Lúc class finish (static) hoặc instance construct | registry, `bind`, validate một lần |

> **Callout:** Side-effect nặng (I/O, đăng ký global) **không** đặt lúc evaluate expression (`@foo(fs.readFileSync(...))` chạy khi **load class**). Factory chỉ nhận config thuần; I/O → initializer hoặc first-call.

Nhiều decorator trên class/members khác nhau tuân quy tắc initializer instance vs static — đọc spec/TS handbook khi debug thứ tự tinh vi.

---

## 5. `context.addInitializer` & init wrappers

`addInitializer(cb)` đăng ký callback:

- Member **instance**: `cb` gọi với `this` = instance, lúc construct (sau super, quanh field init — thứ tự relative với field wrappers: spec định; test nếu phụ thuộc chặt).
- Member **static** / class decorator: lúc class definition hoàn tất; `this` = constructor.

```ts
const liveInstances = new WeakSet<object>();

function trackInstance<This extends object, A extends unknown[], R>(
  _value: (this: This, ...args: A) => R,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: A) => R>,
) {
  context.addInitializer(function (this: This) {
    liveInstances.add(this); // chạy mỗi lần `new` với `this` = instance
  });
}

class WorkerClient {
  @trackInstance
  ping() {
    return "pong";
  }
}
```

(Ví dụ static registry bằng class decorator + `WeakMap`: xem §6.4.)

Init wrapper field (return function) **khác** `addInitializer`: wrapper **biến đổi giá trị lưu**; initializer **side-effect** không nhất thiết đổi value.

```ts
function clamp(min: number, max: number) {
  return function (
    _value: undefined,
    _ctx: ClassFieldDecoratorContext<unknown, number>,
  ) {
    return function (this: unknown, initial: number) {
      return Math.min(max, Math.max(min, initial));
    };
  };
}

class Gauge {
  @clamp(0, 100)
  value = 150;
}
// value === 100
```

Kết hợp: field wrapper chuẩn hóa; `addInitializer` đăng ký vào container.

`addInitializer` **không** async. Không `await` I/O trong initializer — class evaluate / `new` phải sync. I/O → method `init()` tường minh.

Gọi `addInitializer` **ngoài** decorator apply (sau khi class đã xong) → quá muộn / throw. Chỉ trong thân decorator khi đang apply.

---

## 6. Metadata Stage 3 vs `Reflect.metadata`

### 6.1 Stage 3 `context.metadata`

TC39: object metadata **dùng chung trên class**, gắn `context.metadata` (và `Symbol.metadata` trên constructor khi runtime hỗ trợ).

```ts
function addRole(role: string) {
  return function (_: unknown, context: DecoratorContext) {
    // Type trap: TS gõ context.metadata là non-nullable DecoratorMetadataObject,
    // nhưng runtime không có Symbol.metadata (chưa polyfill) sẽ là undefined!
    const meta = context.metadata as Record<string, unknown> | undefined;
    if (!meta) return;

    // Copy-on-write: subclass kế thừa Object.create(Base[Symbol.metadata]).
    // Mutate mảng kế thừa trực tiếp sẽ làm bẩn metadata của Base!
    const own = Object.hasOwn(meta, "roles")
      ? (meta.roles as string[])
      : [...((meta.roles as string[] | undefined) ?? [])];
    own.push(role);
    meta.roles = own;
  };
}

@addRole("user")
class BaseAccount {}

@addRole("admin")
class AdminAccount extends BaseAccount {}
```

Đọc sau: `AdminAccount[Symbol.metadata]` nếu environment expose — **theo dõi** TS/Node minor (proposal metadata tách decorator). Nhiều runtime/DI **vẫn** chưa dựa vào đây.

> **Type trap & kế thừa prototype:** TypeScript khai báo `context.metadata` là non-nullable (`DecoratorMetadataObject`), nhưng ở runtime khi chưa có `Symbol.metadata` (chưa polyfill) helper `__esDecorate` sẽ truyền `undefined`. Ngoài ra, metadata của subclass được tạo qua `Object.create(Base[Symbol.metadata])` — luôn kiểm `Object.hasOwn` và copy-on-write trước khi ghi mảng/object lồng để không làm bẩn base class.

Hỗ trợ runtime/TS cần kiểm tra phiên bản; nhiều DI phổ biến **vẫn** legacy.

### 6.2 `reflect-metadata` (legacy)

`reflect-metadata` là **polyfill** cho đề xuất Reflect Metadata cũ, hay dùng với:

- `emitDecoratorMetadata: true`
- DI container đọc kiểu tham số constructor (`design:paramtypes`, `design:type`, `design:returntype`)

**Dùng khi:** NestJS / TypeORM / Inversify kiểu legacy bắt buộc.

**Không cần khi:** Stage 3 thuần; DI tường minh (factory / wire tay); chạy Node strip-types không emit metadata.

> **Callout:** Metadata emit **không** phải phần của Stage 3 decorator chuẩn — đừng kỳ vọng `@Injectable()` kiểu Nest chạy trên Stage 3 mà không có hỗ trợ framework. `design:paramtypes` **erase** runtime thật — chỉ còn nếu compiler **emit** (legacy). Không phải bảo mật / validation đáng tin.

### 6.3 Ví dụ ý tưởng (legacy)

```ts
import "reflect-metadata";

function Injectable(): ClassDecorator {
  return (_target) => {
    // container đọc Reflect.getMetadata("design:paramtypes", target)
  };
}

@Injectable()
class UserService {
  private readonly db: Database;
  constructor(db: Database) {
    this.db = db;
  }
}
```

Import `reflect-metadata` **một lần** ở entry (side-effect). Thiếu import → `getMetadata` luôn `undefined`.

Thứ tự entry:

```ts
import "reflect-metadata";
import { AppModule } from "./app.js";
```

Import class `@Injectable` **trước** polyfill → metadata mất. Bundler tree-shake side-effect: `package.json` `sideEffects` / import tường minh.

### 6.4 Registry tường minh (không Reflect)

```ts
const routes = new WeakMap<object, string>();

function route(path: string) {
  return function <C extends abstract new (...args: any[]) => any>(
    value: C,
    context: ClassDecoratorContext<C>,
  ) {
    context.addInitializer(function (this: C) {
      routes.set(this, path);
    });
    return value;
  };
}

@route("/users")
class UsersController {}
```

Ưu điểm: không phụ thuộc `emitDecoratorMetadata`; test được; chạy trên Stage 3. Nhược: phải tự quản lý registry — chấp nhận được cho hầu hết app.

`WeakMap` key = class/instance — GC được. `Map` string global dễ leak test.

Đừng trộn `Reflect.defineMetadata` với `context.metadata` trên cùng class.

---

## 7. Legacy `experimentalDecorators`

```ts
function deprecated(
  _target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
) {
  const original = descriptor.value as (...args: unknown[]) => unknown;
  descriptor.value = function (this: unknown, ...args: unknown[]) {
    console.warn(`${String(propertyKey)} is deprecated`);
    return original.apply(this, args);
  };
}

class Api {
  @deprecated
  oldMethod() {}
}
```

Class decorator legacy nhận constructor và có thể replace class; **parameter decorator** `(target, key, index)` tồn tại ở legacy — Stage 3 **không** có tương đương 1-1 cho mọi use-case DI parameter.

Framework kiểu NestJS (bản dựa legacy) thường yêu cầu:

```json
{
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true
}
```

| Legacy | Stage 3 |
|---|---|
| Mutate `descriptor` | Return wrapper |
| `target.prototype` | `context` + value |
| `@Inject()` parameter | Constructor DI tường minh / framework |
| `emitDecoratorMetadata` | `context.metadata` / WeakMap |

Migrate: **không** đổi flag rồi chờ compile. Nest mới có thể có đường Stage 3 — đọc **đúng major framework**, không đoán.

Prototype mutate legacy dễ đụng subclass. Stage 3 wrap per-function rõ hơn.

---

## 8. Decorator, type stripping và compiler flags

`erasableSyntaxOnly` chặn enum, namespace có runtime code, parameter properties, import/export assignment và assertion dạng `<T>x`. **Decorators không nằm trong danh sách đó**: cả Stage 3 và legacy có thể được typecheck khi bật flag. Điều này không thay đổi khả năng parse của Node. [TSConfig](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html), [Node TypeScript](https://nodejs.org/api/typescript.html#typescript-features).

| Workflow | Decorator | Metadata |
|---|---|---|
| `node file.ts` | Parser error trên Node 26 | Không emit |
| `tsc --noEmit` + `erasableSyntaxOnly` | Có thể xanh | Không tạo JS |
| `tsc` emit, Stage 3 | Helpers Stage 3 | `context.metadata` cần `Symbol.metadata` runtime |
| `tsc` emit, legacy | `experimentalDecorators: true` | `emitDecoratorMetadata` + `reflect-metadata` nếu cần |
| `tsx` / bundler | Theo transpiler và cấu hình | Kiểm tra riêng; không suy từ typecheck |

### 8.1 Chọn cấu hình theo framework

Stage 3: omit hoặc `experimentalDecorators: false`, không bật `emitDecoratorMetadata`. Legacy: `experimentalDecorators: true`; bật metadata chỉ khi framework cần. `erasableSyntaxOnly` có thể giữ bật ở cả hai, nhưng không dùng như lệnh cấm decorator.

### 8.2 Kiểm tra workflow thực tế

Repo chạy strip cần lint/kiểm tra cú pháp riêng để loại decorator, rồi chạy entry và test bằng chính `node`. Repo có decorator cần emit và test JS đã build. Khi chọn `tsx` dev, thử decorator/DI/metadata bằng runner đó; typecheck xanh không chứng minh metadata được emit.

### 8.3 `context.metadata` vs `Symbol.metadata`

TypeScript gõ `context.metadata` là non-nullable (`DecoratorMetadataObject`), nhưng helper chỉ tạo object metadata khi runtime đã có `Symbol.metadata` — nếu chưa polyfill (và polyfill phải load *trước* khi class evaluate), giá trị thực tế là `undefined`. Metadata của subclass kế thừa từ base qua prototype (`Object.create(Base[Symbol.metadata])`): luôn phân biệt own/inherited bằng `Object.hasOwn` và copy-on-write khi cập nhật mảng/object để không làm bẩn base class. Registry `WeakMap` với token tường minh giúp tránh phụ thuộc proposal metadata.

### 8.4 Metadata không phải runtime validation

Legacy `design:paramtypes` chỉ chứa constructor còn lại sau emit; interface/generic mất thông tin. Stage 3 không emit các key `design:*`. Validate input bằng schema hoặc guard đầy đủ; truyền DI token tường minh khi không có constructor đại diện.

---

## 9. Khi nào dùng HOF thay decorator

Khi chỉ cần wrap **một hàm** (retry, log, timeout, memo), **HOF** đơn giản hơn — không đụng class syntax / strip-types / thứ tự evaluate:

```ts
const withLog = <A extends unknown[], R>(fn: (...a: A) => R) =>
  (...a: A) => {
    console.log("call", fn.name, a);
    return fn(...a);
  };

export const add = withLog((a: number, b: number) => a + b);
```

| Chọn decorator | Chọn HOF |
|---|---|
| Nhiều member class, metadata khai báo gần declaration | Hàm rời / module export |
| Framework bắt `@Injectable` | App mới, strip-only |
| `accessor` / field init | Wrap một `async function` |
| Registry theo class | Pipeline `f = compose(a, b)(f)` |

Decorator **không** “mạnh hơn” HOF — chúng là HOF + thời điểm apply (class def). Nếu không có class, decorator là gánh.

```ts
const withRetry = (n: number) => {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError("retry count must be an integer >= 1");
  }
  return <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
    async (...a: A): Promise<R> => {
      let last: unknown;
      for (let i = 0; i < n; i++) {
        try {
          return await fn(...a);
        } catch (e) {
          last = e;
        }
      }
      throw last;
    };
};

export const load = withRetry(3)(async (id: string) => fetch(id));
```

Xem [functions-callbacks.md](functions-callbacks.md). Test HOF: gọi hàm bọc, không cần `new Class`.

Nest-style parameter inject **không** thay bằng HOF một dòng — đó là DI container. App không Nest: constructor injection tay / factory.

### 9.1 Composition HOF

```ts
const compose =
  <T>(...fns: Array<(x: T) => T>) =>
  (x: T) =>
    fns.reduceRight((v, f) => f(v), x);

const baseLoad = async (id: string) => fetch(id);

// Truyền <typeof baseLoad> để TS 7 strict không suy luận T thành unknown khi gặp generic HOF
const loadWithLog = compose<typeof baseLoad>(
  withLog,
  withRetry(3),
)(baseLoad);
```

Thứ tự `compose` (phải → trái apply) **cùng tinh thần** apply decorator RTL. Đội strip-only nên chuẩn hóa `compose` thay vì class `@`.

### 9.2 Pitfalls decorator (tóm tắt)

1. I/O trong factory evaluate — chạy lúc import, khó test, chậm TLA graph.
2. Wrap `async` lên method sync — caller không `await` → unhandled rejection.
3. `addInitializer` async — **không** được; class/`new` sync.
4. Legacy + Stage 3 cùng `tsconfig` — compiler một chế độ.
5. Chỉ typecheck xanh với `erasableSyntaxOnly` rồi chạy `node file.ts` có decorator → SyntaxError; cần emit và chạy output thật.
6. Metadata `design:paramtypes` tin như runtime type — **erase**.
7. Decorator trên `accessor` vs `field` — kind khác, API khác.
8. Test “có metadata” không test behavior.

---

## 10. So sánh nhanh & lựa chọn

| Nhu cầu | Chọn |
|---|---|
| App/library TS mới, không Nest legacy, **có emit** | Stage 3 |
| NestJS / TypeORM decorator metadata | Legacy + `reflect-metadata` |
| Chỉ logging/wrap method trên class | Stage 3 method **hoặc** HOF |
| Wrap hàm module | **HOF** |
| DI theo kiểu emit | Framework + (thường) legacy; hoặc DI không decorator |
| Node strip | Parser chưa hỗ trợ decorator; dùng HOF hoặc emit |
| Quan sát gán field sau init | `accessor` + Stage 3 |
| Metadata không Reflect | `WeakMap` + `addInitializer` |

---

## 11. Best practices

1. Một project **một** chế độ decorator; ghi rõ README/`tsconfig`.
2. Decorator **mỏng**: wrap, gắn metadata — không giấu business logic khó test.
3. Factory rõ (`@retry(3)`), không magic global lúc evaluate.
4. Không phụ thuộc `emitDecoratorMetadata` cho bảo mật / boundary — kiểu erase lúc runtime.
5. Stage 3: generic `This` / `Args` để giữ type-safe wrappers.
6. Node strip → tránh `@`; `erasableSyntaxOnly` không bắt lỗi này. Chọn HOF hoặc pipeline emit.
7. Prefer HOF khi decorator chỉ để “cho đẹp” trên một hàm.
8. Test behavior của wrapper, không chỉ “có gắn decorator”.
9. `addInitializer` sync, nhẹ; I/O ở method.
10. Không trộn `Reflect.metadata` với `context.metadata`.
11. `accessor` khi cần trap set; field decorator chỉ đổi **init**.
12. Prod: `tsc` hoặc bundler đã hiểu Stage 3 — đừng `node file.ts` cho class `@`.

---

## 12. Checklist

```text
□ experimentalDecorators on/off khớp Stage 3 vs legacy
□ Không trộn mental model hai thế giới
□ target ≥ ES2022 (hoặc runtime đủ) cho Stage 3
□ Nest/TypeORM? legacy + reflect-metadata + emitDecoratorMetadata
□ Chạy strip? Loại decorator bằng policy/lint và kiểm runtime; flag erasable không đủ
□ Prod: tsc hoặc bundler — không kỳ vọng node file.ts chạy decorator
□ Hiểu evaluate LTR / apply RTL / initializer vs wrapper
□ addInitializer chỉ side-effect sync
□ Decorator mỏng; logic nghiệp vụ test được
□ context.metadata / WeakMap tường minh thay magic Reflect khi có thể
□ Wrap hàm rời → HOF, không ép class
```

---

## 13. Cheat sheet

```ts
// Stage 3 method
function logged<This, A extends unknown[], R>(
  value: (this: This, ...args: A) => R,
  ctx: ClassMethodDecoratorContext,
) {
  const name = String(ctx.name);
  return function (this: This, ...args: A): R {
    console.log(name, args);
    return value.apply(this, args);
  };
}

class Svc {
  @logged
  run() {}
}

// field init wrapper
function uppercase(_v: undefined, _c: ClassFieldDecoratorContext) {
  return (initial: string) => initial.toUpperCase();
}

// HOF — strip-friendly
const withLog = <A extends unknown[], R>(fn: (...a: A) => R) =>
  (...a: A) => (console.log(fn.name, a), fn(...a));

// tsconfig Stage 3 (emit): ES2022 là mức tối thiểu; Node 26 dùng ES2025 / ESNext
// { "experimentalDecorators": false, "target": "ES2025" }

// tsconfig legacy Nest-like
// { "experimentalDecorators": true, "emitDecoratorMetadata": true }

// Node strip không parse decorator; flag dưới đây không tự cấm @
// { "erasableSyntaxOnly": true, "verbatimModuleSyntax": true }
```

| Cần | Chọn |
|---|---|
| Code mới + emit | Stage 3 |
| Nest legacy DI | experimental + reflect-metadata |
| Quan sát field | `accessor` + decorator |
| Dev strip-only | **HOF, không decorator** |
| Registry | `addInitializer` + WeakMap |

Stage 3 và legacy đều cần transform trên Node 26; `erasableSyntaxOnly` cho phép `@`, parser Node strip thì không.

HOF khi một hàm; decorator khi nhiều member class + emit pipeline. `addInitializer` sync; evaluate LTR, apply RTL.

`context.kind`: class/method/field/getter/setter/accessor. Field init ≠ gán sau; `accessor` trap set.

Registry `WeakMap` + `addInitializer` thay `Reflect.metadata` khi không Nest.

---

## 14. Version notes

| Nền | Liên quan |
|---|---|
| TS cũ | `experimentalDecorators`, `emitDecoratorMetadata` |
| TS 5.0+ | Stage 3 decorators khi tắt experimental |
| TS 5.8+ | `erasableSyntaxOnly` chặn enum/param props; **không chặn decorator** |
| TC39 | Decorators Stage 3; metadata proposal theo dõi riêng (`Symbol.metadata`) |
| **TS 7** | Parity decorator với 5/6; compiler Go nhanh hơn; `erasableSyntaxOnly` giữ |
| **Node 26** | Strip-types ổn định; **không** transform decorator; gỡ `--experimental-transform-types` |

Baseline: **Node 26** + **TS 7**.

---

## 15. Tài liệu liên quan

- [tsconfig & biên dịch TypeScript](tsconfig.md)
- [Lập trình hướng đối tượng trong TypeScript](oop.md)
- [Modules & Packages](modules-packages.md)
- [npm / pnpm / yarn & tooling](tooling.md)
- [Function type, Callback & Lambda](functions-callbacks.md) — HOF thay decorator
- [Hàm & Method](functions-methods.md) — `this`, bind
- [Entry point & chạy chương trình](main-function.md) — strip vs tsc
- [exceptions.md](exceptions.md) — đừng tin metadata như runtime type

- [Test output/pipeline thực tế](testing.md)
