# Iterator, Iterable & “LINQ-like” trong JavaScript / TypeScript

JavaScript không có LINQ như C#, nhưng **iterable protocol** + **Array methods** (`map`/`filter`/`reduce`/`flatMap`…) phủ hầu hết nhu cầu truy vấn in-memory. Trên **Node.js 26** (V8 **14.6**), **Iterator helpers** (lazy `map`/`filter`/`take`/…) và **`Iterator.concat()`** đã có sẵn; **`Iterator.from()`** bọc iterable thành iterator mang helpers.

> Baseline: **Node 26** + **TS 7**. Async iteration / stream: [async.md](async.md) · [nodejs-apis.md](nodejs-apis.md). Predicate/callback: [functions-callbacks.md](functions-callbacks.md).

---

## Mục lục

1. [Iterable & Iterator protocol](#1-iterable--iterator-protocol)
2. [`for...of` & built-in iterables](#2-forof--built-in-iterables)
3. [Generators như producer](#3-generators-như-producer)
4. [Array helpers — LINQ-like](#4-array-helpers--linq-like)
5. [Bảng LINQ ↔ JS](#5-bảng-linq--js)
6. [Iterator helpers trên Node 26](#6-iterator-helpers-trên-node-26)
7. [Async iteration: `for await...of`](#7-async-iteration-for-awaitof)
8. [Lazy pipelines & custom iterables](#8-lazy-pipelines--custom-iterables)
9. [Khi **không** xây query DSL tùy biến](#9-khi-không-xây-query-dsl-tùy-biến)
10. [Best practices](#10-best-practices)
11. [Checklist](#11-checklist)
12. [Cheat sheet](#12-cheat-sheet)
13. [Version notes](#13-version-notes)
14. [Tài liệu liên quan](#14-tài-liệu-liên-quan)

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

Optional: `return()` / `throw()` để dọn tài nguyên khi vòng lặp `break` sớm (generators hỗ trợ tốt).

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
for (const ch of "hi") console.log(ch);
for (const n of [10, 20]) console.log(n);
for (const [k, v] of new Map([["a", 1]])) console.log(k, v);
for (const x of new Set([1, 1, 2])) console.log(x); // 1, 2
```

Khác `for...in` (duyệt **keys** enumerable — không dùng cho Array logic nghiệp vụ).

```ts
const arr = ["a", "b"];
for (const i in arr) console.log(i); // "0", "1"
for (const v of arr) console.log(v); // "a", "b"
```

Destructuring / spread dựa trên iterable:

```ts
const [first, ...rest] = new Set([1, 2, 3]);
const copy = [...arr];
```

`Array.from(iterable, mapFn?)` materialize:

```ts
Array.from("ab"); // ["a", "b"]
Array.from({ length: 3 }, (_, i) => i); // [0, 1, 2]
```

---

## 3. Generators như producer

```ts
function* range(from: number, to: number, step = 1) {
  for (let i = from; i <= to; i += step) {
    yield i;
  }
}

[...range(1, 5)]; // [1, 2, 3, 4, 5]
```

### 3.1 `yield*`

```ts
function* concatGen<T>(a: Iterable<T>, b: Iterable<T>) {
  yield* a;
  yield* b;
}
```

### 3.2 Producer nhận giá trị (ít dùng hàng ngày)

```ts
function* channel() {
  const x: number = yield "ready";
  return x * 2;
}

const g = channel();
g.next(); // { value: "ready", done: false }
g.next(21); // { value: 42, done: true }
```

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

> Generators = **pull-based producer** lazy. Phù hợp sequence tính toán / parse; I/O bất đồng bộ → **async generator** (§7).

---

## 4. Array helpers — LINQ-like

```ts
type Person = { name: string; age: number; city: string };
const people: Person[] = [
  { name: "An", age: 20, city: "HN" },
  { name: "Bình", age: 17, city: "HCM" },
  { name: "Chi", age: 20, city: "HN" },
];
```

### 4.1 Projection / filter / flatten

| JS | Việc |
|---|---|
| `map` | Select |
| `filter` | Where |
| `flatMap` | SelectMany (+ flatten 1 mức) |
| `flat` | flatten độ sâu |

```ts
const names = people.map((p) => p.name);
const adults = people.filter((p) => p.age >= 18);
const cities = people.flatMap((p) => [p.city, p.city.toLowerCase()]);
```

### 4.2 Aggregate

```ts
const totalAge = people.reduce((sum, p) => sum + p.age, 0);

const byCity = people.reduce<Record<string, Person[]>>((acc, p) => {
  (acc[p.city] ??= []).push(p);
  return acc;
}, {});
```

### 4.3 Sort / slice (Take/Skip)

```ts
const byAge = people.toSorted((a, b) => a.age - b.age); // không mutate
people.slice(0, 2); // Take
people.slice(2); // Skip
```

Prefer `toSorted` / `toReversed` / `toSpliced` khi cần bất biến; `sort` mutate tại chỗ.

### 4.4 Quantifiers / elements

```ts
people.some((p) => p.age < 18);
people.every((p) => p.name.length > 0);
people.find((p) => p.city === "HN");
people.findLast((p) => p.city === "HN");
people.findIndex((p) => p.age === 20);
```

### 4.5 Distinct / group

```ts
const distinctCities = [...new Set(people.map((p) => p.city))];

const grouped = Object.groupBy(people, (p) => p.city);
// { HN: [...], HCM: [...] } — có trên Node hiện đại
```

`Map`-based groupBy thủ công khi cần key không phải `PropertyKey` thuần hoặc muốn `Map` iteration order tường minh.

### 4.6 Join — thủ công / đẩy DB

```ts
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
    const bucket = index.get(k);
    if (bucket) bucket.push(r);
    else index.set(k, [r]);
  }
  const out: O[] = [];
  for (const l of left) {
    for (const r of index.get(leftKey(l)) ?? []) out.push(select(l, r));
  }
  return out;
}
```

Dữ liệu lớn / quan hệ — **đẩy join xuống database**, không giả LINQ in-memory.

### 4.7 Chuỗi thao tác (eager)

```ts
const result = people
  .filter((p) => p.age >= 18)
  .map((p) => ({ name: p.name, city: p.city }))
  .toSorted((a, b) => a.name.localeCompare(b.name));
```

**Khác LINQ to Objects:** hầu hết Array methods là **eager** (tạo mảng trung gian). Iterator helpers / generators cho **lazy**.

---

## 5. Bảng LINQ ↔ JS

| LINQ | JS / TS |
|---|---|
| `Where` | `filter` / iterator `.filter` |
| `Select` | `map` / iterator `.map` |
| `SelectMany` | `flatMap` |
| `OrderBy` / `ThenBy` | `toSorted` (+ compare chuỗi) |
| `Take` / `Skip` | `slice` / iterator `.take` / `.drop` |
| `First` / `FirstOrDefault` | `find` / `[0]` |
| `Any` / `All` | `some` / `every` |
| `Count` | `.length` / đếm vòng |
| `Distinct` | `Set` |
| `GroupBy` | `Object.groupBy` / `Map` |
| `Aggregate` | `reduce` |
| `Zip` | tự viết / loop index |
| `Concat` | `Iterator.concat` / `concat` / `[...a, ...b]` |
| `ToList` | `Array.from` / `[...iter]` / `.toArray()` |
| Deferred execution | generators / iterator helpers |

---

## 6. Iterator helpers trên Node 26

Trên **Node 26 / V8 14.6**, iterator helpers là phần của ngôn ngữ (không cần flag):

| API | Vai trò |
|---|---|
| `Iterator.from(x)` | Bọc iterable / iterator-like → iterator có helpers |
| `Iterator.concat(...items)` | Nối nhiều iterable/iterator **lazy** (V8 14.6 / Node 26 highlight) |
| `.map` / `.filter` / `.flatMap` | projection / where lazy |
| `.take` / `.drop` | Take / Skip lazy |
| `.reduce` / `.forEach` / `.some` / `.every` / `.find` | consume |
| `.toArray()` | materialize |

```ts
const result = [1, 2, 3, 4, 5]
  .values()
  .filter((n) => n % 2 === 1)
  .map((n) => n * 10)
  .take(2)
  .toArray();
// [10, 30]

const merged = Iterator.concat([1, 2], [3, 4].values(), [5]);
console.log([...merged]); // [1, 2, 3, 4, 5]

const fromSet = Iterator.from(new Set(["a", "b"]))
  .map((s) => s.toUpperCase())
  .toArray();
```

Ghi chú chính xác:

- Helpers gắn trên **iterator** (prototype), không phải mọi iterable gọi trực tiếp `.map` — lấy iterator bằng `.values()` / `[Symbol.iterator]()` / `Iterator.from`.
- Lazy: chưa `toArray` / `reduce` / `forEach` / spread thì chưa kéo phần tử.
- `Iterator.concat` hữu ích hơn `[...a, ...b]` khi muốn **lazy** / streaming.
- App chỉ chạy **Node 26+**: dùng trực tiếp. Thư viện hỗ trợ Node cũ: feature-detect hoặc polyfill / generator fallback.

```ts
function hasIteratorHelpers(): boolean {
  const proto = Object.getPrototypeOf([][Symbol.iterator]());
  return typeof (proto as { map?: unknown }).map === "function";
}

function hasIteratorConcat(): boolean {
  return typeof Iterator.concat === "function";
}
```

Song song hữu ích (không phải iterator sync helpers): `Array.fromAsync`, async iteration trên stream — xem §7. **Async iterator helpers** (map/filter trên async iterator prototype) **chưa** giả định đã ship đầy đủ như sync helpers trên mọi target — kiểm tra MDN/`node --version` trước khi dựa vào trong thư viện public; fallback async generator luôn an toàn.

### 6.1 Bảng helper ↔ Array (lazy vs eager)

| Array (eager) | Iterator helper (lazy) |
|---|---|
| `.map` | `.map` rồi `.toArray()` |
| `.filter` | `.filter` |
| `.slice(0,n)` | `.take(n)` |
| `.slice(n)` | `.drop(n)` |
| `.flatMap` | `.flatMap` |
| `.reduce` | `.reduce` |
| `.some` / `.every` / `.find` | cùng tên |
| `[...iter]` | `.toArray()` |

Khi chuỗi dài trên mảng lớn, iterator helpers tránh mảng trung gian — đo trước khi micro-optimize; với N nhỏ Array methods thường đủ và dễ đọc hơn.

---

## 7. Async iteration: `for await...of`

### 7.1 Protocol

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

### 7.3 Node streams / readline

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

### 7.4 Lỗi & break

```ts
try {
  for await (const item of source) {
    if (shouldStop(item)) break; // gọi return() nếu có
  }
} catch (e) {
  console.error("stream failed", e);
}
```

Hủy hợp tác: truyền `AbortSignal` vào API tạo stream — [abort-context.md](abort-context.md).

---

## 8. Lazy pipelines & custom iterables

### 8.1 Generator pipeline (portable)

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
```

Trên Node 26, ưu tiên iterator helpers native thay pipeline tự viết — trừ khi cần logic đặc thù / polyfill.

### 8.2 Tránh multiple enumeration

```ts
function* source() {
  console.log("pull");
  yield 1;
}

const g = source();
[...g]; // pull
[...g]; // rỗng — đã exhaust

const factory = () => source();
[...factory()];
[...factory()];
```

### 8.3 `yield*` compose

```ts
function* pipeline() {
  yield* take(map(range(1, 10), (x) => x * 2), 3);
}
```

### 8.4 Zip / cửa sổ (khi Array không đủ)

```ts
function* zip<A, B>(a: Iterable<A>, b: Iterable<B>): Generator<[A, B]> {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  while (true) {
    const xa = ia.next();
    const xb = ib.next();
    if (xa.done || xb.done) return;
    yield [xa.value, xb.value];
  }
}

function* chunk<T>(xs: Iterable<T>, size: number) {
  let buf: T[] = [];
  for (const x of xs) {
    buf.push(x);
    if (buf.length === size) {
      yield buf;
      buf = [];
    }
  }
  if (buf.length) yield buf;
}
```

Trên Node 26, nhiều thao tác “map rồi take” nên dùng iterator helpers; chỉ tự viết khi helper không phủ (zip, cửa sổ trượt, stateful parse).

### 8.5 `Array.fromAsync`

```ts
const pages = await Array.fromAsync(
  urls.map(async (u) => {
    const res = await fetch(u);
    return res.text();
  }),
);
```

Hữu ích khi có async iterable / iterable of thenables; vẫn tôn trọng backpressure kém hơn stream pipeline có chủ đích — file lớn ưu tiên `for await` + xử lý từng chunk.

---

## 9. Khi **không** xây query DSL tùy biến

> **Ý kiến:** đừng dựng “mini LINQ / IQueryable” trong app Node trừ khi bạn thật sự viết database provider.

| Nhu cầu | Làm gì |
|---|---|
| Lọc mảng nhỏ/vừa in-memory | `filter`/`map`/`reduce` hoặc iterator helpers |
| File / HTTP lớn | stream + `for await` / pipeline |
| SQL / document DB | query builder / ORM / SQL thuần — **expression tree không dịch được** như EF |
| API public “fluent query” | thường over-engineering; nhận `Predicate`/`options` đơn giản |

Tránh:

- Tự invent `Where`/`Select` class hierarchy bắt chước C# trên mọi repo.
- Giả deferred SQL từ chuỗi method JS — không có expression tree chuẩn để dịch.
- `reduce` siêu phức tạp thay vì vòng `for` rõ ràng.

---

## 10. Best practices

1. In-memory nhỏ/vừa: chuỗi Array — rõ, đủ nhanh.
2. Sequence lớn / lazy: iterator helpers (Node 26) hoặc generators.
3. I/O lớn: async generators + `for await`, không `readFile` cả cục rồi `split`.
4. Prefer `toSorted` khi cần bất biến.
5. Input API: nhận `Iterable<T>` khi chỉ cần duyệt.
6. Feature-detect helpers nếu lib hỗ trợ Node cũ.
7. Đừng xây query DSL giả EF trên Node.
8. Join nặng → database.
9. Iterator one-shot — factory nếu cần duyệt lại.
10. `for...in` không dùng cho array nghiệp vụ.

---

## 11. Checklist

```text
□ for...of / for-await đúng sync vs async iterable
□ Eager Array vs lazy iterator helpers có chủ đích
□ Iterator.from / .values() trước khi gọi helpers
□ Iterator.concat khi nối lazy (Node 26)
□ break sớm → cleanup return()/finally trên generator
□ Không enumerate iterator đã exhaust mà quên
□ Object.groupBy / Set cho distinct-group đơn giản
□ Stream file: readline / async iter, không load full
□ Không invent IQueryable
□ map(async) → Promise.all / pool
```

---

## 12. Cheat sheet

```ts
for (const x of iterable) {}
for await (const x of asyncIterable) {}

function* gen() {
  yield 1;
}
async function* agen() {
  yield 1;
}

arr.map/filter/flatMap/reduce/slice/toSorted
[...new Set(arr)]
Object.groupBy(arr, keyFn)

// Node 26 iterator helpers:
arr.values().filter(fn).map(fn).take(n).toArray()
Iterator.from(iterable).drop(1).toArray()
Iterator.concat(a, b, c)
```

| Cần | Chọn |
|---|---|
| Query mảng nhỏ | Array methods |
| Lazy CPU sequence | iterator helpers / `function*` |
| I/O stream | `async function*` / `for await` |
| Nối lazy | `Iterator.concat` |
| Group | `Object.groupBy` / `Map` |

---

## 13. Version notes

| Nền | Liên quan |
|---|---|
| ES2015 | iterators, `for...of`, generators |
| ES2018 | async generators, `for await` |
| ES2023 | `toSorted` / `toReversed` / `findLast`… |
| ES2024 | `Object.groupBy` / `Map.groupBy` (theo engine) |
| Iterator Helpers (TC39) | `.map`/`.filter`/`.take`/… trên iterator; `Iterator.from` |
| **V8 14.6 / Node 26** | `Iterator.concat`; Temporal (không thuộc chương này); helpers dùng ổn định |
| **TS 7** | `Iterable`/`Iterator`/`AsyncIterable` trong lib |

Baseline: **Node 26** + **TS 7** — dùng iterator helpers + `Iterator.concat` / `Iterator.from` thoải mái trên baseline này.

---

## 14. Tài liệu liên quan

- [Tập hợp & Generics](collections-generics.md)
- [Hàm & Method](functions-methods.md)
- [Function type, Callback & Lambda](functions-callbacks.md)
- [Lập trình bất đồng bộ](async.md)
- [Node.js built-ins](nodejs-apis.md) — stream, readline
- [AbortSignal & request context](abort-context.md)
- [Node 26 & TypeScript 7 highlights](node26-ts7.md)
