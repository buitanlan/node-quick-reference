# Iterator, Iterable & “LINQ-like” trong JavaScript / TypeScript

JavaScript không có LINQ như C#, nhưng **iterable protocol** + **Array methods** (`map`/`filter`/`reduce`/`flatMap`…) phủ hầu hết nhu cầu truy vấn in-memory. Node 26 / JS hiện đại còn có **Iterator helpers** (TC39) trên iterator prototype, gồm **`Iterator.concat()`**.

---

## Mục lục

1. [Iterable & Iterator protocol](#1-iterable--iterator-protocol)
2. [`for...of` & built-in iterables](#2-forof--built-in-iterables)
3. [Generators](#3-generators)
4. [Array methods — tương tự LINQ](#4-array-methods--tương-tự-linq)
5. [Bảng LINQ ↔ JS](#5-bảng-linq--js)
6. [Iterator helpers (modern JS / TC39)](#6-iterator-helpers-modern-js--tc39)
7. [Async iteration: `for await...of`](#7-async-iteration-for-awaitof)
8. [Lazy pipelines & custom iterables](#8-lazy-pipelines--custom-iterables)
9. [Best practices](#9-best-practices)

---

## 1. Iterable & Iterator protocol

### 1.1 Iterable

Object là **iterable** nếu có method `[Symbol.iterator]()` trả về iterator.

```ts
const iterable = {
  *[Symbol.iterator]() {
    yield 1;
    yield 2;
    yield 3;
  },
};

for (const n of iterable) console.log(n);
```

### 1.2 Iterator

Iterator có method `next()` → `{ value, done }`.

```ts
const it = iterable[Symbol.iterator]();
it.next(); // { value: 1, done: false }
it.next(); // { value: 2, done: false }
it.next(); // { value: 3, done: false }
it.next(); // { value: undefined, done: true }
```

Optional: `return()` / `throw()` để dọn tài nguyên khi vòng lặp break sớm (generators hỗ trợ tốt).

### 1.3 Typing (TS)

```ts
function consume<T>(xs: Iterable<T>) {
  for (const x of xs) {
    console.log(x);
  }
}

function once<T>(it: Iterator<T>) {
  return it.next();
}
```

`IterableIterator<T>`: vừa iterable vừa iterator (generators thường vậy).

---

## 2. `for...of` & built-in iterables

```ts
for (const ch of "hi") {
  console.log(ch); // "h", "i"
}

for (const n of [10, 20]) {
  console.log(n);
}

for (const [k, v] of new Map([["a", 1]])) {
  console.log(k, v);
}

for (const x of new Set([1, 1, 2])) {
  console.log(x); // 1, 2
}
```

Khác `for...in` (duyệt **keys** enumerable — không dùng cho Array logic nghiệp vụ).

```ts
const arr = ["a", "b"];
for (const i in arr) console.log(i);     // "0", "1" (string keys)
for (const v of arr) console.log(v);     // "a", "b"
```

Destructuring / spread dựa trên iterable:

```ts
const [first, ...rest] = new Set([1, 2, 3]);
const copy = [...arr];
```

`Array.from(iterable, mapFn?)` materialize:

```ts
Array.from("ab"); // ["a", "b"]
Array.from({ length: 3 }, (_, i) => i); // [0,1,2]
```

---

## 3. Generators

```ts
function* range(from: number, to: number, step = 1) {
  for (let i = from; i <= to; i += step) {
    yield i;
  }
}

[...range(1, 5)]; // [1,2,3,4,5]
```

### 3.1 `yield*`

```ts
function* concat<T>(a: Iterable<T>, b: Iterable<T>) {
  yield* a;
  yield* b;
}
```

### 3.2 Generator vừa sản xuất vừa nhận giá trị

```ts
function* channel() {
  const x: number = yield "ready"; // next(value) gửi vào yield
  return x * 2;
}

const g = channel();
g.next();      // { value: "ready", done: false }
g.next(21);    // { value: 42, done: true }
```

Ít dùng hàng ngày; hữu ích cho state machine / saga-style.

### 3.3 Early cleanup

```ts
function* lines(text: string) {
  try {
    for (const line of text.split("\n")) yield line;
  } finally {
    // chạy khi for-of break / return()
  }
}
```

---

## 4. Array methods — tương tự LINQ

Giả sử:

```ts
type Person = { name: string; age: number; city: string };
const people: Person[] = [
  { name: "An", age: 20, city: "HN" },
  { name: "Bình", age: 17, city: "HCM" },
  { name: "Chi", age: 20, city: "HN" },
];
```

### 4.1 `map` — Select

```ts
const names = people.map((p) => p.name);
```

### 4.2 `filter` — Where

```ts
const adults = people.filter((p) => p.age >= 18);
```

### 4.3 `flatMap` — SelectMany

```ts
const cities = people.flatMap((p) => [p.city, p.city.toLowerCase()]);
// [[...]] flatten 1 mức

const nested = [[1, 2], [3]];
nested.flatMap((xs) => xs); // [1,2,3]
```

### 4.4 `reduce` — Aggregate

```ts
const totalAge = people.reduce((sum, p) => sum + p.age, 0);

const byCity = people.reduce<Record<string, Person[]>>((acc, p) => {
  (acc[p.city] ??= []).push(p);
  return acc;
}, {});
```

### 4.5 Sorting / partitioning

```ts
const byName = [...people].sort((a, b) => a.name.localeCompare(b.name));
const byAge = people.toSorted((a, b) => a.age - b.age);

people.slice(0, 2);          // Take
people.slice(2);             // Skip
people.slice(1, 3);
```

### 4.6 Quantifiers / elements

```ts
people.some((p) => p.age < 18);
people.every((p) => p.name.length > 0);
people.find((p) => p.city === "HN");
people.findLast?.((p) => p.city === "HN");
people.findIndex((p) => p.age === 20);
people.includes; // cho primitive equality trên mảng giá trị
```

### 4.7 Distinct / set-like

```ts
const distinctCities = [...new Set(people.map((p) => p.city))];
```

### 4.8 GroupBy (tự viết hoặc Object.groupBy)

```ts
const grouped = Object.groupBy(people, (p) => p.city);
// { HN: [...], HCM: [...] } — available trên Node hiện đại

// Tương đương thủ công:
function groupBy<T, K extends PropertyKey>(items: Iterable<T>, key: (item: T) => K) {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}
```

### 4.9 Join (LINQ Join) — thủ công

```ts
type Order = { userId: string; total: number };
type User = { id: string; name: string };

function innerJoin<L, R, K, O>(
  left: L[],
  right: R[],
  leftKey: (l: L) => K,
  rightKey: (r: R) => K,
  select: (l: L, r: R) => O,
): O[] {
  const index = new Map<K, R[]>();
  for (const r of right) {
    const k = rightKey(r);
    (index.get(k) ?? (index.set(k, []), index.get(k)!)).push(r);
  }
  const out: O[] = [];
  for (const l of left) {
    for (const r of index.get(leftKey(l)) ?? []) {
      out.push(select(l, r));
    }
  }
  return out;
}
```

Với dữ liệu lớn / SQL — đẩy join xuống database, không giả LINQ in-memory.

### 4.10 Chuỗi thao tác (method syntax “LINQ-like”)

```ts
const result = people
  .filter((p) => p.age >= 18)
  .map((p) => ({ name: p.name, city: p.city }))
  .toSorted((a, b) => a.name.localeCompare(b.name));
```

**Khác LINQ to Objects:** hầu hết Array methods là **eager** (chạy ngay, tạo mảng trung gian). Generator / iterator helpers cho **lazy**.

---

## 5. Bảng LINQ ↔ JS

| LINQ | JS / TS |
|---|---|
| `Where` | `filter` |
| `Select` | `map` |
| `SelectMany` | `flatMap` |
| `OrderBy` / `ThenBy` | `toSorted` / `sort` (+ compare chuỗi) |
| `Take` / `Skip` | `slice(0,n)` / `slice(n)` |
| `First` / `FirstOrDefault` | `find` / `[0]` |
| `Any` / `All` | `some` / `every` |
| `Count` | `.length` / đếm vòng lặp |
| `Distinct` | `Set` |
| `GroupBy` | `Object.groupBy` / `Map` |
| `Aggregate` | `reduce` |
| `Zip` | tự viết / thư viện; hoặc loop index |
| `Concat` | `Iterator.concat` / `concat` / `[...a, ...b]` |
| `ToList` | `Array.from` / `[...iter]` |
| Deferred execution | generators / iterator helpers |

---

## 6. Iterator helpers (modern JS / TC39)

**Iterator Helpers** (TC39; có trên Node 26 / V8 hiện đại) thêm method kiểu LINQ **lazy** trên iterator: `map`, `filter`, `take`, `drop`, `flatMap`, `reduce`, `toArray`, `forEach`, `some`, `every`, `find`, … và **`Iterator.concat()`**.

```ts
// Node 26: iterator helpers + Iterator.concat ổn định trên engine hiện đại

const it = [1, 2, 3, 4, 5].values(); // ArrayIterator

const result = it
  .filter((n) => n % 2 === 1)
  .map((n) => n * 10)
  .take(2)
  .toArray();
// kỳ vọng: [10, 30]

// Iterator.concat — nối nhiều iterable/iterator thành một iterator lazy
const merged = Iterator.concat([1, 2], [3, 4].values(), [5]);
console.log([...merged]); // [1, 2, 3, 4, 5]
```

Feature detect:

```ts
function hasIteratorHelpers() {
  const proto = Object.getPrototypeOf([].values());
  return typeof proto.map === "function" && typeof proto.filter === "function";
}

function hasIteratorConcat() {
  return typeof (Iterator as unknown as { concat?: unknown }).concat === "function";
}
```

Ghi chú:

- Helpers hoạt động trên **iterator**, không phải mọi iterable trực tiếp — lấy iterator bằng `.values()` / `[Symbol.iterator]()`.
- Lazy: chưa `toArray` / `reduce` / `forEach` thì chưa kéo phần tử.
- `Iterator.concat(...items)` nhận iterable/iterator; hữu ích hơn `[...a, ...b]` khi muốn **lazy** / streaming.
- Nếu runtime thiếu (Node cũ): polyfill hoặc dùng generator pipeline thủ công (mục 8).
- `Iterator.from(iterable)` (khi có) bọc iterable thành iterator có helpers.

Song song còn hướng **Array.fromAsync**, async iterator helpers — theo dõi MDN / Node release notes.

---

## 7. Async iteration: `for await...of`

### 7.1 Async iterable protocol

`[Symbol.asyncIterator]()` → async iterator với `next()` trả `Promise<{value, done}>`.

```ts
const asyncLite = {
  async *[Symbol.asyncIterator]() {
    yield 1;
    yield 2;
  },
};

for await (const n of asyncLite) {
  console.log(n);
}
```

### 7.2 Async generator

```ts
async function* readChunks(stream: AsyncIterable<Uint8Array>) {
  for await (const chunk of stream) {
    yield chunk.byteLength;
  }
}
```

### 7.3 Node streams

Readable stream (Web / Node) là async iterable:

```ts
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const rl = createInterface({
  input: createReadStream("app.log", "utf8"),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  if (line.includes("ERROR")) console.log(line);
}
```

### 7.4 Chuyển Promise[] → async iterate tuần tự

```ts
async function* sequentially<T>(factories: Array<() => Promise<T>>) {
  for (const f of factories) {
    yield await f();
  }
}
```

`for await` cũng hoạt động trên sync iterable (await từng value nếu là thenable — thường dùng cho async iterable đúng nghĩa).

### 7.5 Lỗi & break

```ts
try {
  for await (const item of source) {
    if (shouldStop(item)) break; // gọi return() trên async iterator nếu có
  }
} catch (e) {
  console.error("stream failed", e);
}
```

---

## 8. Lazy pipelines & custom iterables

### 8.1 Generator pipeline

```ts
function* filter<T>(xs: Iterable<T>, pred: (x: T) => boolean) {
  for (const x of xs) if (pred(x)) yield x;
}

function* map<T, U>(xs: Iterable<T>, fn: (x: T) => U) {
  for (const x of xs) yield fn(x);
}

function* take<T>(xs: Iterable<T>, n: number) {
  let i = 0;
  for (const x of xs) {
    if (i++ >= n) return;
    yield x;
  }
}

const lazy = take(
  map(
    filter(range(1, 1_000_000), (n) => n % 2 === 0),
    (n) => n * n,
  ),
  5,
);

console.log([...lazy]); // chỉ tính đủ 5 phần tử thỏa điều kiện
```

### 8.2 Tránh multiple enumeration

```ts
function* source() {
  console.log("pull");
  yield 1;
  yield 2;
}

const g = source();
[...g]; // pull
[...g]; // rỗng — iterator đã exhaust

// Cần duyệt lại → tạo iterable factory:
const factory = () => source();
[...factory()];
[...factory()];
```

Array methods tạo collection mới → duyệt lại an toàn nhưng tốn bộ nhớ.

### 8.3 `yield*` compose

```ts
function* pipeline() {
  yield* take(map(range(1, 10), (x) => x * 2), 3);
}
```

---

## 9. Best practices

**Nên**

- In-memory nhỏ/vừa: chuỗi `filter/map/reduce` trên Array — rõ ràng, đủ nhanh.
- Stream lớn / file / network: **async generators** + `for await...of`, không `readFile` cả cục rồi `split`.
- Prefer `toSorted` / `toReversed` khi cần bất biến.
- Input API: nhận `Iterable<T>` thay vì bắt buộc `T[]` khi chỉ cần duyệt.
- Feature-detect iterator helpers trước khi dùng trong thư viện public.

**Tránh**

- `for...in` trên array.
- `map(async ...)` mà quên `Promise.all` khi cần đợi.
- `reduce` siêu phức tạp — tách hàm / vòng `for` dễ đọc hơn.
- Giả lập EF-style IQueryable trên Node — không có expression tree dịch SQL; dùng query builder/ORM.

**Cheat sheet**

```ts
for (const x of iterable) {}
for await (const x of asyncIterable) {}

function* gen() { yield 1; }
async function* agen() { yield 1; }

arr.map/filter/flatMap/reduce/slice/toSorted
[...new Set(arr)]
Object.groupBy(arr, keyFn)

// Iterator helpers (khi có):
arr.values().filter(fn).map(fn).take(n).toArray()
```

---

## Tài liệu liên quan

- [Tập hợp & Generics](collections-generics.md)
- [Hàm & Method](functions-methods.md)
- [Function type, Callback & Lambda](functions-callbacks.md)
- [Lập trình bất đồng bộ](async.md)
