# Decorators & Metadata

Stage 3 JS decorators, legacy `experimentalDecorators`, và ranh giới metadata trên **TypeScript 7**.

> **Callout:** Baseline: **TS 7**. Decorators chuẩn (TC39 Stage 3) là hướng mặc định cho code mới; `experimentalDecorators` chỉ còn cho codebase / framework legacy (NestJS cũ, TypeORM kiểu cũ, …). **`erasableSyntaxOnly` cấm decorator** trong workflow strip. OOP class: [oop.md](oop.md). Strip-types: [tsconfig.md](tsconfig.md).

---

## Mục lục

1. [Hai “thế giới” decorator](#1-hai-thế-giới-decorator)
2. [Bật decorator trong TypeScript](#2-bật-decorator-trong-typescript)
3. [Stage 3 — semantics theo kind](#3-stage-3--semantics-theo-kind)
4. [Thứ tự evaluate / apply & initializer](#4-thứ-tự-evaluate--apply--initializer)
5. [`context.addInitializer` & init wrappers](#5-contextaddinitializer--init-wrappers)
6. [Metadata Stage 3 vs `Reflect.metadata`](#6-metadata-stage-3-vs-reflectmetadata)
7. [Legacy `experimentalDecorators`](#7-legacy-experimentaldecorators)
8. [`erasableSyntaxOnly` FORBIDS decorators](#8-erasablesyntaxonly-forbids-decorators)
9. [Khi nào dùng HOF thay decorator](#9-khi-nào-dùng-hof-thay-decorator)
10. [So sánh nhanh & lựa chọn](#10-so-sánh-nhanh--lựa-chọn)
11. [Best practices](#11-best-practices)
12. [Checklist](#12-checklist)
13. [Cheat sheet](#13-cheat-sheet)
14. [Version notes](#14-version-notes)
15. [Tài liệu liên quan](#15-tài-liệu-liên-quan)

---

## 1. Hai “thế giới” decorator

| | **Stage 3 (chuẩn JS / TS 7)** | **Legacy (`experimentalDecorators`)** |
|---|---|---|
| Spec | TC39 Stage 3 | Thiết kế TypeScript cũ (trước chuẩn) |
| Context API | `context` object giàu thông tin | `(target, propertyKey, descriptor)` |
| `emitDecoratorMetadata` | **không** đi kèm như legacy | thường + `reflect-metadata` |
| Parameter decorator | **Không** 1-1 | Có `(target, key, index)` |
| Nest/TypeORM cũ | Thường **không** drop-in | Có |
| `erasableSyntaxOnly` | **Cấm** (runtime syntax) | **Cấm** |
| Khuyến nghị code mới | **Có** (nếu không strip-only) | Chỉ khi framework yêu cầu |

Chúng **không tương thích API** — không trộn hai chế độ trong cùng mental model, cùng file, cùng `tsconfig`.

Stage 3 decorator là **đề xuất JS**: sau emit (target ≥ ES2022, `experimentalDecorators: false`) syntax `@dec` còn trong JS nếu engine hỗ trợ; TypeScript **không** hạ xuống helper kiểu legacy `__decorate`. Legacy **luôn** emit helper / `Reflect`.

> **Callout:** Bật `experimentalDecorators: true` → **tắt** Stage 3 trong compiler. Không “cả hai cùng lúc”.

---

## 2. Bật decorator trong TypeScript

**Stage 3 (khuyến nghị):**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": false
  }
}
```

Từ TS 5.0+, decorator chuẩn được hỗ trợ khi **không** bật `experimentalDecorators`. Cần `target` đủ mới (thường ≥ ES2022) hoặc runtime/polyfill phù hợp. TS 7 giữ parity ngữ nghĩa với 6.x về decorator; headline là tốc độ compiler.

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

> Decorator **không erasable**. Node 26 chỉ strip types; **đã gỡ** `--experimental-transform-types`. Với `erasableSyntaxOnly` / `node file.ts`, decorator **bị cấm / không chạy đúng như transpile**. Production: `tsc` emit hoặc bundler / `tsx`.

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
  Object.seal(value);
  Object.seal(value.prototype);
  return value;
}

@sealed
class User {
  constructor(public name: string) {}
}
```

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

`context.static` / `context.private` phân nhánh. Private method: `name` là `#foo` (string/symbol tùy khai).

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

Init wrapper chạy **khi instance (hoặc static field) khởi tạo**, sau các initializer gắn `addInitializer` theo thứ tự spec — §4–§5.

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

### 3.7 Static vs instance, private

`context.static === true` trên `static m()` / `static field`. Initializer static chạy **một lần** khi class evaluate xong — không mỗi `new`.

Private `#m`: `context.private === true`; `context.access.get(instance)` đọc mà không lộ tên. Decorator **không** biến private thành public API trừ khi gắn registry.

`context.name` với computed `["k"]` là string `"k"`; symbol thì giữ symbol. `String(context.name)` cho log.

Không decorate `constructor` như method — class decorator bao constructor.

### 3.8 Factory vs decorator function

```ts
function retry(n: number) {
  return function (value: Function, _ctx: ClassMethodDecoratorContext) {
    return function (this: object, ...args: unknown[]) {
      void n;
      return value.apply(this, args);
    };
  };
}

class Jobs {
  @retry(3)
  run() {}
}
```

`@retry` không ngoặc → `retry` phải là `(value, context) => …`. Nhầm `@retry` / `@retry()` là chân thường gặp.

`@foo.bar()` nếu `bar` unbound mất `this` — gán `const bar = foo.bar.bind(foo)` hoặc factory độc lập.

### 3.9 Subclass & wrap

Wrapper method trên **base** không tự áp lên method override ở subclass trừ khi subclass cũng `@` hoặc gọi `super`. Class decorator replace constructor: `extends` subclass vẫn `extends` **giá trị sau decorate** nếu `@` trên base trước khi `class Child extends Base` — thứ tự khai báo file quan trọng.

Field init wrapper **không** chạy lại khi gán `this.name = "x"` sau construct — chỉ giá trị khởi tạo. Muốn trap gán → `accessor`.

### 3.6 `context.access`

Stage 3 cung cấp `context.access` (`get` / `set` / `has` tùy kind) để decorator đọc/ghi **không** hard-code tên private — hữu ích wrap field/accessor.

```ts
function bound<This, A extends unknown[], R>(
  value: (this: This, ...a: A) => R,
  context: ClassMethodDecoratorContext<This>,
) {
  const { name, addInitializer } = context;
  addInitializer(function (this: This) {
    const fn = (this as Record<PropertyKey, unknown>)[name as PropertyKey];
    if (typeof fn === "function") {
      (this as Record<PropertyKey, unknown>)[name as PropertyKey] = fn.bind(this);
    }
  });
  return value;
}
```

(Pattern bind-on-construct; cân nhắc arrow field / bind trong ctor — [functions-methods.md](functions-methods.md).)

Luôn kiểm `context.kind` trước khi giả định `access.set` tồn tại.

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
function a(value: Function, _ctx: ClassMethodDecoratorContext) {
  console.log("apply a");
  return value;
}
function b(value: Function, _ctx: ClassMethodDecoratorContext) {
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
  return function (value: Function, _ctx: ClassMethodDecoratorContext) {
    console.log("apply", label);
    return value;
  };
}

class T {
  @log("A") @log("B")
  m() {}
}
// eval A, eval B, apply B, apply A
```

### 4.1 Thứ tự trên class (rút gọn spec)

Khi **đánh giá class**:

1. Evaluate decorator expressions của **từng member** (method/field/getter/setter/accessor — instance rồi static theo nhóm spec; debug tinh vi thì đọc spec, đừng đoán).
2. Apply member decorators (reverse per-stack).
3. Evaluate **class** decorator expressions LTR.
4. Apply class decorators RTL.
5. Chạy **static** initializers + `addInitializer` static.
6. Khi `new`: instance fields + instance `addInitializer`.

“Member rồi class” — class decorator thấy member **đã** wrap.

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
function meta(key: string, val: unknown) {
  return function (_: unknown, context: DecoratorContext) {
    const m = context.metadata;
    if (m) (m as Record<string, unknown>)[key] = val;
  };
}

@meta("role", "admin")
class Admin {}
```

Đọc sau: `Admin[Symbol.metadata]` nếu environment expose — **theo dõi** TS/Node minor (proposal metadata tách decorator). Nhiều runtime/DI **vẫn** chưa dựa vào đây.

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
  constructor(private readonly db: Database) {}
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

## 8. `erasableSyntaxOnly` FORBIDS decorators

`erasableSyntaxOnly` (TS 5.8+, TS 7) **cấm cú pháp TS có runtime emit** — khớp Node type stripping (Amaro): chỉ xóa type, **không** sinh JS mới.

Danh sách cấm chính (handbook `erasableSyntaxOnly`):

| Cấm | Thay |
|---|---|
| `enum` / `const enum` | `as const` object + type |
| `namespace` / `module` runtime | ES modules |
| Parameter properties `constructor(public x)` | Field tường minh |
| `import a = require()` / `export =` | ESM `import`/`export` |
| `<>` type assertion | `as` |
| **Decorators `@dec`** | **HOF** hoặc tắt flag + `tsc`/`tsx` |

Decorator **không** type-only: `@logged` còn lại sau khi xóa `number` — đó là **runtime**. Node 26 **đã gỡ** `--experimental-transform-types` → không transpile decorator lúc `node file.ts`.

TS với `erasableSyntaxOnly: true`: **error** trên decorator (cùng họ non-erasable). Đó là **cố ý** — không phải bug editor.

| Workflow | Decorator | `emitDecoratorMetadata` |
|---|---|---|
| `tsc` emit, **không** erasableSyntaxOnly | OK (Stage 3 hoặc legacy) | legacy only |
| `tsx` / bundler | Thường transpile | tùy tool |
| `node file.ts` strip | **Không** — không transpile | **Không** emit |
| `erasableSyntaxOnly: true` | TS **cấm** | N/A |

Với app mới không Nest: Stage 3 + metadata tường minh (`WeakMap`) **và** pipeline **emit** — hoặc **không decorator** (HOF) để giữ strip.

> **Callout:** Không tắt `erasableSyntaxOnly` “cho xong” rồi quên CI strip. Chọn **một** pipeline: strip-only (cấm decorator) **hoặc** tsc/tsx (decorator OK).

`verbatimModuleSyntax` **không** cấm decorator — chỉ import/export. Hai flag thường bật cùng cho strip; decorator vẫn cấm vì `erasableSyntaxOnly`.

### 8.1 `experimentalDecorators` vs Stage 3 — tsconfig

| Flag | Stage 3 | Legacy |
|---|---|---|
| `experimentalDecorators` | `false` / omit | `true` |
| `emitDecoratorMetadata` | bỏ | `true` + `reflect-metadata` |
| `target` | ≥ ES2022 | theo framework |
| `erasableSyntaxOnly` | **false** (nếu dùng `@`) | **false** |

Không `"experimentalDecorators": false` **và** Nest param decorator — Nest không chạy. README một dòng: “Stage 3” hoặc “legacy Nest”.

`useDefineForClassFields` với legacy decorator field: historically lệch — Nest docs. Stage 3 + target cao: field JS chuẩn.

### 8.2 Strip + decorator — kịch bản

| Dev | CI | Prod | Decorator? |
|---|---|---|---|
| `node --watch src/index.ts` | `tsc --noEmit` + `erasableSyntaxOnly` | `node dist` | **Không** |
| `tsx watch` | `tsc --noEmit` **không** erasable | `tsc` emit | Stage 3 OK |
| Nest `tsx`/`tsc` | `experimentalDecorators` | `tsc` emit | Legacy OK |
| Mix strip local + Nest CI | — | — | **Vỡ** |

Chọn hàng **một** dòng cho repo. Không “strip thứ Hai, Nest thứ Ba”.

### 8.3 `context.metadata` vs `Symbol.metadata`

Khi runtime hỗ trợ, class sau decorator có `Ctor[Symbol.metadata]` (object shared). Polyfill/TS emit tùy `target` — **không** giả định có trên mọi Node 24. Node 26 + types: kiểm tra `Symbol.metadata in Ctor`.

Đọc metadata **sau** class evaluate — không trong factory trước apply.

WeakMap registry **portable** hơn Symbol.metadata khi dual-support 24.

### 8.4 `emitDecoratorMetadata` types không phải validation

`design:paramtypes` = **hàm constructor** còn lại sau emit (`String`, `Object` cho interface). `interface User` → `Object`. Generic → mất. **Không** dùng làm runtime schema. Zod/Valibot cho input. DI token: `InjectionToken` tường minh, không tin `typeof`.

`emitDecoratorMetadata` **không** emit cho Stage 3. Bật cả hai flag + Stage 3 syntax = metadata **trống** kiểu Nest. Legacy class decorator `(target) => {}` mới có `design:*`.

HOF `withInject` **không** đọc paramtypes — truyền dependency lúc gọi `makeUserService({ db })`. Rõ test, strip-friendly.

`experimentalDecorators` + `erasableSyntaxOnly` **cùng true** → decorator error (erasable thắng “cấm”). Nest repo: **tắt** `erasableSyntaxOnly`, **không** `node file.ts` entry.

`tsx` transpile decorator **không** bảo đảm 1-1 `tsc` Stage 3 — library publish: `tsc`. App nội bộ: chấp nhận tsx dev nếu CI `tsc --noEmit` cùng `experimentalDecorators` flag.

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
const withRetry = (n: number) =>
  <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
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

const load = compose(
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
5. `erasableSyntaxOnly` + `@` → error; tắt flag nhưng vẫn `node file.ts` → SyntaxError / không như Nest emit.
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
| Node strip / `erasableSyntaxOnly` | **Cấm decorator** — HOF / tsc |
| Quan sát gán field sau init | `accessor` + Stage 3 |
| Metadata không Reflect | `WeakMap` + `addInitializer` |

---

## 11. Best practices

1. Một project **một** chế độ decorator; ghi rõ README/`tsconfig`.
2. Decorator **mỏng**: wrap, gắn metadata — không giấu business logic khó test.
3. Factory rõ (`@retry(3)`), không magic global lúc evaluate.
4. Không phụ thuộc `emitDecoratorMetadata` cho bảo mật / boundary — kiểu erase lúc runtime.
5. Stage 3: generic `This` / `Args` để giữ type-safe wrappers.
6. `erasableSyntaxOnly` / strip → **không** decorator; HOF hoặc đổi pipeline emit.
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
□ Strip-types / erasableSyntaxOnly? KHÔNG decorator — HOF hoặc tsc
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

// tsconfig Stage 3 (emit)
// { "experimentalDecorators": false, "target": "ES2022" }

// tsconfig legacy Nest-like
// { "experimentalDecorators": true, "emitDecoratorMetadata": true }

// tsconfig strip — cấm decorator
// { "erasableSyntaxOnly": true, "verbatimModuleSyntax": true }
```

| Cần | Chọn |
|---|---|
| Code mới + emit | Stage 3 |
| Nest legacy DI | experimental + reflect-metadata |
| Quan sát field | `accessor` + decorator |
| Dev strip-only | **HOF, không decorator** |
| Registry | `addInitializer` + WeakMap |

Stage 3 + `target` ES2022+; legacy chỉ khi framework bắt. `erasableSyntaxOnly` **FORBIDS** `@`.

HOF khi một hàm; decorator khi nhiều member class + emit pipeline. `addInitializer` sync; evaluate LTR, apply RTL.

`context.kind`: class/method/field/getter/setter/accessor. Field init ≠ gán sau; `accessor` trap set.

Registry `WeakMap` + `addInitializer` thay `Reflect.metadata` khi không Nest.

---

## 14. Version notes

| Nền | Liên quan |
|---|---|
| TS cũ | `experimentalDecorators`, `emitDecoratorMetadata` |
| TS 5.0+ | Stage 3 decorators khi tắt experimental |
| TS 5.8+ | `erasableSyntaxOnly` — **cấm** decorator / enum / param props |
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
