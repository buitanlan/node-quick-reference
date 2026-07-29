# Decorators & Metadata

*(Stage 3 JS decorators, legacy `experimentalDecorators`, TypeScript 7)*

Baseline: **TypeScript 7**. Decorators chuẩn (Stage 3) là hướng mặc định; `experimentalDecorators` chỉ còn cho codebase / framework legacy (NestJS cũ, TypeORM kiểu cũ, v.v.).

---

## Mục lục

- [Decorators \& Metadata](#decorators--metadata)
  - [Mục lục](#mục-lục)
  - [1. Hai “thế giới” decorator](#1-hai-thế-giới-decorator)
  - [2. Bật decorator trong TypeScript](#2-bật-decorator-trong-typescript)
  - [3. Stage 3 — tổng quan](#3-stage-3--tổng-quan)
    - [3.1 Class decorator](#31-class-decorator)
    - [3.2 Method decorator](#32-method-decorator)
    - [3.3 Field decorator](#33-field-decorator)
    - [3.4 Getter / setter / accessor](#34-getter--setter--accessor)
    - [3.5 Auto-accessor (`accessor`)](#35-auto-accessor-accessor)
  - [4. Thứ tự chạy \& composition](#4-thứ-tự-chạy--composition)
  - [5. Legacy `experimentalDecorators`](#5-legacy-experimentaldecorators)
  - [6. `reflect-metadata` \& DI](#6-reflect-metadata--di)
    - [6.1 Khi nào còn dùng](#61-khi-nào-còn-dùng)
    - [6.2 Ví dụ ý tưởng (legacy)](#62-ví-dụ-ý-tưởng-legacy)
  - [7. Metadata chuẩn Stage 3 (tóm tắt)](#7-metadata-chuẩn-stage-3-tóm-tắt)
  - [8. So sánh nhanh \& lựa chọn](#8-so-sánh-nhanh--lựa-chọn)
  - [9. Best practices](#9-best-practices)

---

## 1. Hai “thế giới” decorator

| | **Stage 3 (chuẩn JS / TS 7)** | **Legacy (`experimentalDecorators`)** |
|---|---|---|
| Spec | TC39 Stage 3 | Thiết kế TypeScript cũ (trước chuẩn) |
| Context API | `context` object giàu thông tin | `(target, propertyKey, descriptor)` |
| `emitDecoratorMetadata` | **không** đi kèm như legacy | thường + `reflect-metadata` |
| Tương thích Nest/TypeORM cũ | Thường **không** drop-in | Có |
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

Từ TS 5.0+, decorator chuẩn được hỗ trợ khi **không** bật `experimentalDecorators`. Cần `target` đủ mới (thường ≥ ES2022) hoặc runtime/polyfill phù hợp. TS 7 giữ parity ngữ nghĩa với 6.0 về decorator.

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

**Node type stripping:** decorator **không erasable** — Node 26 chỉ strip types, **không** còn `--experimental-transform-types`. Với `erasableSyntaxOnly` / `node file.ts`, decorator **bị cấm / không chạy**. Production: `tsc` emit hoặc bundler / `tsx`; xem [tsconfig.md](tsconfig.md).

---

## 3. Stage 3 — tổng quan

Decorator là hàm nhận **value** (hoặc `undefined` với field) và **context**, có thể:

- trả về giá trị thay thế (class / method / field init),
- đăng ký side-effect qua `context.addInitializer`,
- đọc `context.name`, `context.static`, `context.private`, `context.kind`, …

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

Factory pattern (decorator có tham số):

```ts
function component(tag: string) {
  return function <C extends Class>(value: C, context: ClassDecoratorContext<C>) {
    context.addInitializer(function (this: C) {
      // gắn metadata tùy ý
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
  value: undefined,
  context: ClassFieldDecoratorContext<unknown, string>,
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

### 3.4 Getter / setter / accessor

```ts
function readonly<This, Return>(
  value: (this: This) => Return,
  context: ClassGetterDecoratorContext<This, Return>,
) {
  // có thể wrap getter
  return value;
}

class Config {
  #token = "secret";

  @readonly
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

`accessor` tạo getter/setter + private backing storage — điểm gắn decorator quan sát state rõ ràng hơn field thuần.

---

## 4. Thứ tự chạy & composition

Với nhiều decorator trên cùng thành viên:

```ts
@a @b
method() {}
```

- **Đánh giá (evaluate)** expression: trái → phải (`a` rồi `b`).
- **Áp dụng (apply)**: gần thành viên trước (thường `b` rồi `a`) — giống “onion” / middleware.

`context.addInitializer` chạy theo quy tắc initializer của class (instance vs static). Tránh side-effect nặng trong decorator evaluate — để logic vào wrapper hoặc initializer.

---

## 5. Legacy `experimentalDecorators`

API quen thuộc (rút gọn):

```ts
function deprecated(
  target: object,
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

Class decorator legacy nhận constructor và có thể replace class; parameter decorator `(target, key, index)` tồn tại ở legacy, **không** có tương đương 1-1 ở Stage 3 hiện tại cho mọi use-case DI parameter.

Framework kiểu NestJS (phiên bản dựa legacy) thường yêu cầu:

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

**Không cần khi:**

- code Stage 3 thuần,
- DI tường minh (factory, tsyringe cấu hình tay, wire thủ công),
- chạy Node strip-types không emit metadata.

Metadata emit **không** phải phần của Stage 3 decorator chuẩn — đừng kỳ vọng `@Injectable()` kiểu Nest chạy trên Stage 3 mà không có hỗ trợ framework.

### 6.2 Ví dụ ý tưởng (legacy)

```ts
import "reflect-metadata";

function Injectable(): ClassDecorator {
  return (target) => {
    // đánh dấu; container đọc Reflect.getMetadata("design:paramtypes", target)
  };
}

@Injectable()
class UserService {
  constructor(private readonly db: Database) {}
}
```

Import `reflect-metadata` **một lần** ở entry (side-effect).

---

## 7. Metadata chuẩn Stage 3 (tóm tắt)

TC39 còn hướng metadata qua `context.metadata` (object dùng chung trên class) thay vì `Reflect.defineMetadata` legacy:

```ts
function meta(key: string, val: unknown) {
  return function (_: unknown, context: DecoratorContext) {
    const m = context.metadata;
    if (m) (m as Record<string, unknown>)[key] = val;
  };
}
```

Hỗ trợ runtime/TS cần kiểm tra phiên bản; nhiều thư viện DI phổ biến **vẫn** trên legacy. Với app mới không phụ thuộc Nest: ưu tiên Stage 3 + metadata tường minh (Map, WeakMap) hơn `reflect-metadata`.

---

## 8. So sánh nhanh & lựa chọn

| Nhu cầu | Chọn |
|---|---|
| App/library TS mới, không Nest legacy | Stage 3 |
| NestJS / TypeORM decorator metadata | Legacy + `reflect-metadata` |
| Chỉ logging/wrap method | Stage 3 method decorator |
| DI theo kiểu | Framework + (thường) legacy; hoặc DI không decorator |
| Node `node file.ts` / `erasableSyntaxOnly` | Tránh decorator — compile bằng `tsc`/`tsx`/bundler |

---

## 9. Best practices

- Một project **một** chế độ decorator; ghi rõ trong README/`tsconfig`.
- Decorator nên **mỏng**: wrap, gắn metadata, không giấu business logic khó test.
- Đặt tên factory rõ (`@retry(3)` chứ không magic global).
- Không phụ thuộc `emitDecoratorMetadata` cho bảo mật / boundary quan trọng — kiểu erase lúc runtime.
- Với Stage 3, khai báo generic `This` / `Args` để giữ type-safe wrappers.
- Trước khi bật decorator trên pipeline strip-types, xác nhận Node/TS có cho phép syntax đó.

**Tài liệu liên quan:** [tsconfig](tsconfig.md) · [OOP TypeScript](oop.md) · [Modules](modules-packages.md)
