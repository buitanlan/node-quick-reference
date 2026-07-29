# Decorators & Metadata

Stage 3 JS decorators, legacy `experimentalDecorators`, và ranh giới metadata trên **TypeScript 7**.

> Baseline: **TS 7**. Decorators chuẩn (TC39 Stage 3) là hướng mặc định cho code mới; `experimentalDecorators` chỉ còn cho codebase / framework legacy (NestJS cũ, TypeORM kiểu cũ, …). OOP class: [oop.md](oop.md). Strip-types: [tsconfig.md](tsconfig.md).

---

## Mục lục

1. [Hai “thế giới” decorator](#1-hai-thế-giới-decorator)
2. [Bật decorator trong TypeScript](#2-bật-decorator-trong-typescript)
3. [Stage 3 — semantics](#3-stage-3--semantics)
4. [Thứ tự chạy & composition](#4-thứ-tự-chạy--composition)
5. [Legacy `experimentalDecorators`](#5-legacy-experimentaldecorators)
6. [`reflect-metadata` & DI](#6-reflect-metadata--di)
7. [Metadata Stage 3 & caution với strip](#7-metadata-stage-3--caution-với-strip)
8. [So sánh nhanh & lựa chọn](#8-so-sánh-nhanh--lựa-chọn)
9. [Best practices](#9-best-practices)
10. [Checklist](#10-checklist)
11. [Cheat sheet](#11-cheat-sheet)
12. [Version notes](#12-version-notes)
13. [Tài liệu liên quan](#13-tài-liệu-liên-quan)

---

## 1. Hai “thế giới” decorator

| | **Stage 3 (chuẩn JS / TS 7)** | **Legacy (`experimentalDecorators`)** |
|---|---|---|
| Spec | TC39 Stage 3 | Thiết kế TypeScript cũ (trước chuẩn) |
| Context API | `context` object giàu thông tin | `(target, propertyKey, descriptor)` |
| `emitDecoratorMetadata` | **không** đi kèm như legacy | thường + `reflect-metadata` |
| Nest/TypeORM cũ | Thường **không** drop-in | Có |
| Khuyến nghị code mới | **Có** | Chỉ khi framework yêu cầu |

Chúng **không tương thích API** — không trộn hai chế độ trong cùng mental model.

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

---

## 3. Stage 3 — semantics

Decorator là hàm nhận **value** (hoặc `undefined` với field) và **context**, có thể:

- trả về giá trị thay thế (class / method / field init),
- đăng ký side-effect qua `context.addInitializer`,
- đọc `context.name`, `context.static`, `context.private`, `context.kind`, `context.metadata`, …

### 3.1 Class decorator

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

### 3.2 Method decorator

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

### 3.3 Field decorator

Field decorator chạy quanh **initializer**, không wrap kiểu method descriptor legacy:

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

### 3.4 Getter / setter

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

### 3.5 Auto-accessor (`accessor`)

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
  };
}

class Point {
  @observed
  accessor x = 0;
}
```

`accessor` tạo getter/setter + private backing storage — điểm gắn quan sát state rõ hơn field thuần.

### 3.6 `context.addInitializer`

Dùng để đăng ký logic chạy khi class/instance khởi tạo (logging registry, validate, wire). Tránh side-effect nặng lúc **evaluate** decorator expression — để vào wrapper hoặc initializer.

---

## 4. Thứ tự chạy & composition

```ts
@a @b
method() {}
```

- **Đánh giá (evaluate)** expression: trái → phải (`a` rồi `b`).
- **Áp dụng (apply)**: gần thành viên trước (thường `b` rồi `a`) — onion / middleware.

Nhiều decorator trên class/members khác nhau tuân quy tắc initializer instance vs static — đọc spec/TS handbook khi debug thứ tự tinh vi.

### 4.1 `context.access` (method/field)

Stage 3 cung cấp `context.access` (get/set) trong một số kind để decorator đọc/ghi giá trị mà không hard-code tên private — hữu ích khi wrap field/accessor. Luôn kiểm tra `context.kind` trước khi giả định API.

```ts
function prependBang<This, V extends string>(
  _value: undefined,
  context: ClassFieldDecoratorContext<This, V>,
) {
  return function (this: This, initial: V) {
    return `!${initial}` as V;
  };
}
```

---

## 5. Legacy `experimentalDecorators`

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

---

## 6. `reflect-metadata` & DI

### 6.1 Khi nào còn dùng

`reflect-metadata` là **polyfill** cho đề xuất Reflect Metadata cũ, hay dùng với:

- `emitDecoratorMetadata: true`
- DI container đọc kiểu tham số constructor (`design:paramtypes`, …)

**Dùng khi:** NestJS / TypeORM / Inversify kiểu legacy bắt buộc.

**Không cần khi:** Stage 3 thuần; DI tường minh (factory / wire tay); chạy Node strip-types không emit metadata.

> Metadata emit **không** phải phần của Stage 3 decorator chuẩn — đừng kỳ vọng `@Injectable()` kiểu Nest chạy trên Stage 3 mà không có hỗ trợ framework.

### 6.2 Ví dụ ý tưởng (legacy)

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

Import `reflect-metadata` **một lần** ở entry (side-effect).

---

## 7. Metadata Stage 3 & caution với strip

TC39 hướng metadata qua `context.metadata` (object dùng chung trên class) thay `Reflect.defineMetadata` legacy:

```ts
function meta(key: string, val: unknown) {
  return function (_: unknown, context: DecoratorContext) {
    const m = context.metadata;
    if (m) (m as Record<string, unknown>)[key] = val;
  };
}
```

Hỗ trợ runtime/TS cần kiểm tra phiên bản; nhiều DI phổ biến **vẫn** legacy.

### Strip / erasable — tóm tắt rủi ro

| Workflow | Decorator | `emitDecoratorMetadata` |
|---|---|---|
| `tsc` emit | OK (Stage 3 hoặc legacy) | legacy only |
| `tsx` / bundler | Thường OK (transpile) | tùy tool |
| `node file.ts` strip | **Không** — không transpile decorator | **Không** emit |
| `erasableSyntaxOnly: true` | TS **cấm** syntax không erasable | N/A |

Với app mới không Nest: Stage 3 + metadata tường minh (`WeakMap` / registry) hơn `reflect-metadata`.

### 7.1 Registry tường minh (không Reflect)

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

### 7.2 Decorator vs higher-order function

Khi chỉ cần wrap một hàm (retry, log, timeout), **HOF** thường đơn giản hơn decorator — không đụng class syntax / strip-types:

```ts
const withLog = <A extends unknown[], R>(fn: (...a: A) => R) =>
  (...a: A) => {
    console.log("call", fn.name, a);
    return fn(...a);
  };
```

Xem [functions-callbacks.md](functions-callbacks.md). Decorator phù hợp khi gắn **nhiều thành viên class** / metadata khai báo gần declaration.

---

## 8. So sánh nhanh & lựa chọn

| Nhu cầu | Chọn |
|---|---|
| App/library TS mới, không Nest legacy | Stage 3 |
| NestJS / TypeORM decorator metadata | Legacy + `reflect-metadata` |
| Chỉ logging/wrap method | Stage 3 method decorator |
| DI theo kiểu | Framework + (thường) legacy; hoặc DI không decorator |
| Node strip / `erasableSyntaxOnly` | Tránh decorator — `tsc`/`tsx`/bundler |

---

## 9. Best practices

1. Một project **một** chế độ decorator; ghi rõ README/`tsconfig`.
2. Decorator **mỏng**: wrap, gắn metadata — không giấu business logic khó test.
3. Factory rõ (`@retry(3)`), không magic global.
4. Không phụ thuộc `emitDecoratorMetadata` cho bảo mật / boundary quan trọng — kiểu erase lúc runtime.
5. Stage 3: generic `This` / `Args` để giữ type-safe wrappers.
6. Trước khi dựa strip-types, xác nhận không dùng decorator (hoặc đổi pipeline emit).
7. Prefer composition / HOF khi decorator chỉ để “cho đẹp”.
8. Test behavior của wrapper, không chỉ “có gắn decorator”.

---

## 10. Checklist

```text
□ experimentalDecorators on/off khớp Stage 3 vs legacy
□ Không trộn mental model hai thế giới
□ target ≥ ES2022 (hoặc runtime đủ) cho Stage 3
□ Nest/TypeORM? legacy + reflect-metadata + emitDecoratorMetadata
□ Strip-types / erasableSyntaxOnly? không dùng decorator
□ Prod: tsc hoặc bundler — không kỳ vọng node file.ts chạy decorator
□ Decorator mỏng; logic nghiệp vụ test được
□ context.metadata / WeakMap tường minh thay magic Reflect khi có thể
```

---

## 11. Cheat sheet

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

// tsconfig Stage 3
// { "experimentalDecorators": false, "target": "ES2022" }

// tsconfig legacy Nest-like
// { "experimentalDecorators": true, "emitDecoratorMetadata": true }
```

| Cần | Chọn |
|---|---|
| Code mới | Stage 3 |
| Nest legacy DI | experimental + reflect-metadata |
| Quan sát field | `accessor` + decorator |
| Dev strip-only | **không** decorator |

---

## 12. Version notes

| Nền | Liên quan |
|---|---|
| TS cũ | `experimentalDecorators`, `emitDecoratorMetadata` |
| TS 5.0+ | Stage 3 decorators khi tắt experimental |
| TC39 | Decorators Stage 3; metadata proposal theo dõi riêng |
| **TS 7** | Parity decorator với 5/6; compiler Go nhanh hơn |
| **Node 26** | Strip-types ổn định; **không** transform decorator; gỡ `--experimental-transform-types` |

Baseline: **Node 26** + **TS 7**.

---

## 13. Tài liệu liên quan

- [tsconfig & biên dịch TypeScript](tsconfig.md)
- [Lập trình hướng đối tượng trong TypeScript](oop.md)
- [Modules & Packages](modules-packages.md)
- [npm / pnpm / yarn & tooling](tooling.md)
- [Function type, Callback & Lambda](functions-callbacks.md) — HOF thay decorator
- [Node 26 & TypeScript 7 highlights](node26-ts7.md)
