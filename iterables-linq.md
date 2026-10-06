# Iterator, Iterable & “LINQ-like” trong JavaScript / TypeScript

JavaScript không có LINQ như C#, nhưng **iterable protocol** + **Array methods** (`map`/`filter`/`reduce`/`flatMap`…) phủ hầu hết nhu cầu truy vấn in-memory. Trên **Node.js 26** (V8 **14.6**), **Iterator helpers** (lazy `map`/`filter`/`take`/…) và **`Iterator.concat()`** đã có sẵn; **`Iterator.from()`** bọc iterable thành iterator mang helpers.

> Baseline: **Node 26** + **TS 7**. Async iteration / stream: [async.md](async.md) · [nodejs-apis.md](nodejs-apis.md). Predicate/callback: [functions-callbacks.md](functions-callbacks.md). Collections: [collections-generics.md](collections-generics.md). Hủy: [abort-context.md](abort-context.md).

Không document `Iterator.zip` / `chunks` / `windows` / async-iterator-helpers như baseline — chúng **không** nằm trong highlight V8 14.6 của Node 26 (`Iterator.concat` + Map upsert). Feature-detect trước khi dùng API mới hơn.

---

## Mục lục

- [1. Iterable & Iterator protocol](#1-iterable--iterator-protocol)
  - [1.1 Iterable](#11-iterable)
  - [1.2 Iterator — `next` / `return` / `throw`](#12-iterator--next--return--throw)
  - [1.3 Typing (TS)](#13-typing-ts)
  - [1.4 `using` đóng iterator](#14-using-đóng-iterator)
- [2. `for...of` & built-in iterables](#2-forof--built-in-iterables)
  - [2.1 `Array.from` vs spread](#21-arrayfrom-vs-spread)
- [3. Generators như producer](#3-generators-như-producer)
  - [3.1 `yield*`](#31-yield)
  - [3.2 Producer nhận giá trị (ít dùng hàng ngày)](#32-producer-nhận-giá-trị-ít-dùng-hàng-ngày)
  - [3.3 Early cleanup](#33-early-cleanup)
  - [3.4 Pull vs “chạy hết lúc tạo”](#34-pull-vs-chạy-hết-lúc-tạo)
  - [3.5 `throw` vào generator đang `yield*`](#35-throw-vào-generator-đang-yield)
- [4. Array helpers — LINQ-like](#4-array-helpers--linq-like)
  - [4.1 Projection / filter / flatten](#41-projection--filter--flatten)
  - [4.2 Aggregate & khi `reduce` **tệ hơn** `for`](#42-aggregate--khi-reduce-tệ-hơn-for)
  - [4.3 Sort / slice (Take/Skip)](#43-sort--slice-takeskip)
  - [4.4 Quantifiers / elements](#44-quantifiers--elements)
  - [4.5 Distinct / group](#45-distinct--group)
  - [4.6 Join — thủ công / đẩy DB](#46-join--thủ-công--đẩy-db)
  - [4.7 Chuỗi thao tác (eager)](#47-chuỗi-thao-tác-eager)
  - [4.8 Lazy vs eager (quyết định)](#48-lazy-vs-eager-quyết-định)
  - [4.9 ThenBy / multi-key sort](#49-thenby--multi-key-sort)
  - [4.10 `flat` / `flatMap` độ sâu](#410-flat--flatmap-độ-sâu)
  - [4.11 Empty / undefined phần tử](#411-empty--undefined-phần-tử)
- [5. Bảng LINQ ↔ JS](#5-bảng-linq--js)
  - [5.1 Ví dụ dịch “query” C# → JS](#51-ví-dụ-dịch-query-c--js)
- [6. Iterator helpers trên Node 26](#6-iterator-helpers-trên-node-26)
  - [6.1 Bảng helper ↔ Array (lazy vs eager)](#61-bảng-helper--array-lazy-vs-eager)
  - [6.2 Từng helper (sync, Node 26)](#62-từng-helper-sync-node-26)
  - [6.3 `Iterator.concat` chi tiết](#63-iteratorconcat-chi-tiết)
- [7. Async iteration: `for await...of`](#7-async-iteration-for-awaitof)
  - [7.1 Protocol](#71-protocol)
  - [7.2 Async generator](#72-async-generator)
  - [7.3 Node streams / readline](#73-node-streams--readline)
  - [7.4 Lỗi, `break` & AbortSignal](#74-lỗi-break--abortsignal)
  - [7.5 `Array.fromAsync`](#75-arrayfromasync)
  - [7.6 Backpressure async iterator](#76-backpressure-async-iterator)
  - [7.7 `fetch` body / Node stream](#77-fetch-body--node-stream)
  - [7.8 Lỗi `next()` reject](#78-lỗi-next-reject)
- [8. Lazy pipelines & custom iterables](#8-lazy-pipelines--custom-iterables)
  - [8.1 Generator pipeline (portable)](#81-generator-pipeline-portable)
  - [8.2 Reusable vs one-shot — pitfalls](#82-reusable-vs-one-shot--pitfalls)
  - [8.3 `yield*` compose](#83-yield-compose)
  - [8.4 Zip / cửa sổ (khi Array không đủ)](#84-zip--cửa-sổ-khi-array-không-đủ)
  - [8.5 Custom iterable — checklist bẫy](#85-custom-iterable--checklist-bẫy)
  - [8.6 String, `arguments`, TypedArray](#86-string-arguments-typedarray)
  - [8.7 Push vs pull (tóm tắt)](#87-push-vs-pull-tóm-tắt)
  - [8.8 `Iterator.from` semantics](#88-iteratorfrom-semantics)
  - [8.9 Materialize checklist](#89-materialize-checklist)
  - [8.10 `reduce` trên iterator vs Array](#810-reduce-trên-iterator-vs-array)
  - [8.11 Infinite + `take` + `forEach`](#811-infinite--take--foreach)
  - [8.12 TypeScript: `Iterable` vs `ArrayLike`](#812-typescript-iterable-vs-arraylike)
  - [8.13 Node `Readable.from(iterable)`](#813-node-readablefromiterable)
  - [8.14 `yield` giá trị lớn](#814-yield-giá-trị-lớn)
  - [8.15 So sánh `forEach` Array vs iterator](#815-so-sánh-foreach-array-vs-iterator)
  - [8.16 `break` không chạy `finally` của **outer** nếu…](#816-break-không-chạy-finally-của-outer-nếu)
  - [8.17 `Map`/`Set` keys iterator + helpers](#817-mapset-keys-iterator--helpers)
  - [8.18 `for await` + `AbortSignal.any`](#818-for-await--abortsignalany)
  - [8.19 Debug lazy pipeline](#819-debug-lazy-pipeline)
  - [8.20 `using` + `for...of`](#820-using--forof)
  - [8.21 Spread vs `concat` vs `Iterator.concat`](#821-spread-vs-concat-vs-iteratorconcat)
  - [8.22 `done` và value completion](#822-done-và-value-completion)
  - [8.23 `Array.from` mapFn và `thisArg`](#823-arrayfrom-mapfn-và-thisarg)
- [9. Khi **không** xây query DSL tùy biến](#9-khi-không-xây-query-dsl-tùy-biến)
  - [9.1 Exception: thư viện parser / compiler](#91-exception-thư-viện-parser--compiler)
  - [9.2 `for await` + JSON lines](#92-for-await--json-lines)
- [10. Best practices](#10-best-practices)
- [11. Checklist](#11-checklist)
- [12. Cheat sheet](#12-cheat-sheet)
- [13. Version notes](#13-version-notes)
- [14. Tài liệu liên quan](#14-tài-liệu-liên-quan)

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

Mỗi lần `for...of` / spread gọi `[Symbol.iterator]()` **mới**. Iterable **reusable** nếu factory trả iterator mới; iterator bản thân thường **one-shot**.

### 1.2 Iterator — `next` / `return` / `throw`

Iterator có method `next()` → `{ value, done }`. `done: true` → hết; `value` khi done thường `undefined` trừ `return` value.

```ts
const it = iterable[Symbol.iterator]();
it.next(); // { value: 1, done: false }
it.next(); // { value: 2, done: false }
it.next(); // { value: 3, done: false }
it.next(); // { value: undefined, done: true }
```

| Method | Bắt buộc? | Vai trò |
|---|---|---|
| `next(value?)` | Có | Kéo phần tử; `value` hữu ích với generator (§3) |
| `return(value?)` | Optional | Đóng sớm — `break` / `throw` ngoài `for-of` / `using` dispose |
| `throw(error?)` | Optional | Ném vào producer (generator) |

```ts
const manual = {
  n: 0,
  next() {
    if (this.n >= 2) return { value: undefined, done: true as const };
    return { value: this.n++, done: false as const };
  },
  return() {
    this.n = 999; // cleanup
    return { value: undefined, done: true as const };
  },
};
```

`for...of` khi `break`/`return`/`throw` gọi `iterator.return?.()`. **Không** implement `return` khi giữ fd/lock → leak. Generator: `finally` chạy nhờ `return()`.

`throw` hiếm ngoài generator. Iterator thường: bỏ qua.

`done: true` lần sau: spec cho phép `next` tiếp tục; built-in thường giữ exhausted. Đừng dựa “reset”.

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

| Type | Ý nghĩa |
|---|---|
| `Iterable<T>` | Có `[Symbol.iterator](): Iterator<T>` |
| `Iterator<T, TReturn, TNext>` | `next(TNext)` → `IteratorResult<T, TReturn>` |
| `IterableIterator<T>` | Vừa iterable vừa iterator (`[Symbol.iterator]()` trả `this`) — generator |
| `AsyncIterable<T>` / `AsyncIterator<T>` | `next()` → `Promise<IteratorResult<T>>` |

`Iterator<T>` **không** gán `Iterable<T>` trừ khi có `[Symbol.iterator]`. Built-in iterators (Array/Map/Set helpers trên Node 26) kế `Iterator.prototype` → iterable. Iterator tự viết tối thiểu chỉ `next` — **không** `for...of` được trừ khi thêm `[Symbol.iterator]() { return this; }` hoặc `Iterator.from`.

### 1.4 `using` đóng iterator

Iterator hiện đại có `[Symbol.dispose]` gọi `return()`. `using it = xs[Symbol.iterator]()` đóng khi hết block — [functions-methods.md](functions-methods.md) §11, [statements.md](statements.md#11-using-vs-tryfinally).

---

## 2. `for...of` & built-in iterables

```ts
for (const ch of "hi") console.log(ch);
for (const n of [10, 20]) console.log(n);
for (const [k, v] of new Map([["a", 1]])) console.log(k, v);
for (const x of new Set([1, 1, 2])) console.log(x); // 1, 2
```

Khác `for...in` (duyệt **keys** enumerable — không dùng cho Array logic nghiệp vụ). `for...in` trên array lấy index string + enumerable prototype — bug cổ điển.

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

### 2.1 `Array.from` vs spread

| | `Array.from(x, mapFn?)` | `[...x]` |
|---|---|---|
| Iterable | Có | Có |
| Array-like `{ length, [0]… }` | **Có** | **Không** (`TypeError`) |
| MapFn | Có (một vòng) | Không — phải `.map` thêm |
| Hole / sparse | Materialize `undefined` | Tùy iterable |
| Async | `Array.fromAsync` | Không |

```ts
Array.from("ab"); // ["a", "b"]
Array.from({ length: 3 }, (_, i) => i); // [0, 1, 2]
// [...{ length: 3 }]; // TypeError: not iterable

Array.from(range(1, 5), (n) => n * n); // map lúc materialize
[...range(1, 5)].map((n) => n * n);    // hai bước: mảng trung gian
```

Spread trên iterator **one-shot** exhaust. `Array.from` cũng exhaust. Reuse → factory iterable (§8.2).

`Array.fromAsync` — §7.5. String iterable: **code point** (UTF-16 surrogate pair đi chung với `for...of`), không phải byte UTF-8.

---

## 3. Generators như producer

Generator = **pull**: không chạy body cho đến `next()`. Khác push (`EventEmitter`, stream `data`). Consumer quyết định tốc độ — nền tảng backpressure CPU.

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

`yield*` ủy quyền `next`/`throw`/`return` cho inner. `return` value của inner thành kết quả biểu thức `yield*` (không yield ra `for-of` trừ khi yield tiếp).

### 3.2 Producer nhận giá trị (ít dùng hàng ngày)

```ts
function* channel() {
  const x: number = yield "ready";
  return x * 2;
}

const g = channel();
g.next(); // { value: "ready", done: false } — arg lần đầu bỏ
g.next(21); // { value: 42, done: true }
```

Coroutine nhẹ. App Node điển hình: chỉ `yield` ra, không `next(in)`. Chi tiết `throw`/`return` → [functions-methods.md](functions-methods.md) §9.

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

Infinite generator + helper `.take(n)` / vòng `break` — **phải** đóng (`return` / hết `for-of`) kẻo `finally` không chạy nếu bỏ iterator sống.

### 3.4 Pull vs “chạy hết lúc tạo”

```ts
function eagerRange(n: number) {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i);
  return out;
}
function* lazyRange(n: number) {
  for (let i = 0; i < n; i++) yield i;
}
```

`eagerRange(1e8)` OOM; `lazyRange(1e8)` + `.take(3)` chỉ 3 vòng. Generator **giữ** stack frame (suspended) — không rẻ bằng vòng tay nếu body nặng + millions yield (overhead resume). N vừa: Array đủ.

`yield` trong vòng I/O sync (`readFileSync`) vẫn **block** event loop — lazy ≠ async. I/O: `async function*`.

### 3.5 `throw` vào generator đang `yield*`

`g.throw(e)` tại `yield*` inner: inner nhận `throw` trước. Không catch → propagate outer. `return()` tương tự đóng inner trước. Test cleanup lồng: `try/finally` cả hai tầng.

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

TS 5.5+ có thể suy ra type predicate cho callback như `x => x !== undefined`, nên `filter` có thể tự hẹp union. Điều kiện truthiness hoặc guard nghiệp vụ phức tạp không luôn suy ra được — xem [functions-callbacks.md](functions-callbacks.md) §5.

### 4.2 Aggregate & khi `reduce` **tệ hơn** `for`

```ts
const totalAge = people.reduce((sum, p) => sum + p.age, 0);

const byCity = people.reduce<Record<string, Person[]>>((acc, p) => {
  (acc[p.city] ??= []).push(p);
  return acc;
}, {});
```

`reduce` hợp: fold số, concat string nhỏ, một scalar. **Tệ** khi:

| Pattern | Vấn đề | Thay |
|---|---|---|
| `reduce` xây `Map`/`object` phức tạp | Khó đọc, generic `acc` đau | `for` + `getOrInsert` |
| Không seed, mảng rỗng | `TypeError` / `undefined` | Seed / early return |
| `reduce` + `await` trong callback | **Không** tuần tự await — callback sync | `for...of` + `await` |
| Nested `reduce` | Mini-golf | Tách hàm / vòng |
| Side-effect trong reducer | Trái fold thuần | `forEach` / `for` |
| Chuỗi `map+filter+reduce` N lớn | Mảng trung gian | một vòng / iterator helpers |

```ts
const byCity2 = new Map<string, Person[]>();
for (const p of people) {
  byCity2.getOrInsert(p.city, []).push(p);
}
```

`Object.groupBy` / `Map.groupBy` còn rõ hơn khi chỉ group.

### 4.3 Sort / slice (Take/Skip)

```ts
const byAge = people.toSorted((a, b) => a.age - b.age); // không mutate
people.slice(0, 2); // Take
people.slice(2); // Skip
```

Prefer `toSorted` / `toReversed` / `toSpliced` khi cần bất biến; `sort` mutate tại chỗ. Comparator: [collections-generics.md](collections-generics.md) §1.3.

### 4.4 Quantifiers / elements

```ts
people.some((p) => p.age < 18);
people.every((p) => p.name.length > 0);
people.find((p) => p.city === "HN");
people.findLast((p) => p.city === "HN");
people.findIndex((p) => p.age === 20);
```

`find` ≈ FirstOrDefault (`undefined`). “First ném nếu thiếu”: kiểm `x === undefined`, vì `0` / `false` / `""` có thể là phần tử hợp lệ. Khi phần tử cũng có thể là `undefined`, dùng index hoặc tagged result để phân biệt thiếu.

### 4.5 Distinct / group

```ts
const distinctCities = [...new Set(people.map((p) => p.city))];

const grouped = Object.groupBy(people, (p) => p.city);
// { HN: [...], HCM: [...] } — có trên Node hiện đại
```

`Map`-based groupBy thủ công khi cần key không phải `PropertyKey` thuần hoặc muốn `Map` iteration order tường minh. `Map.groupBy(items, keyFn)` trả `Map`.

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

### 4.8 Lazy vs eager (quyết định)

| | Eager (Array) | Lazy (iterator / gen) |
|---|---|---|
| Khi chạy | Ngay mỗi method | Khi consume (`toArray`, `for-of`, `reduce`) |
| Mảng trung gian | Có | Không (pipeline) |
| Infinite source | Không (OOM) | `take` / `find` cắt |
| Debug | Dễ log mảng | Khó hơn — materialize khi cần |
| N nhỏ | **Đủ**, rõ | Helpers hơi dài |
| N lớn + early cut | Lãng phí | **Nên** lazy |
| Reuse kết quả | Mảng giữ | Exhaust — materialize nếu cần 2 lần |

### 4.9 ThenBy / multi-key sort

JS không `ThenBy`. Một comparator:

```ts
people.toSorted((a, b) => {
  const c = a.city.localeCompare(b.city);
  return c !== 0 ? c : a.age - b.age;
});
```

Hoặc sort ổn định hai lần **ngược** thứ tự khóa (ThenBy trước, OrderBy sau) — dễ sai; một cmp rõ hơn.

### 4.10 `flat` / `flatMap` độ sâu

`flat()` mặc định 1. `flat(Infinity)` — cẩn cây cyclic (stack). `flatMap` = map + flat 1; callback trả array lồng sâu hơn **không** bung hết.

`map` rồi `flat` hai vòng; `flatMap` một. Generator `yield*` inner iterable = SelectMany lazy.

### 4.11 Empty / undefined phần tử

`filter(Boolean)` xóa falsy (`0`, `""`) — không phải “chỉ nullish”. `filter(isDefined)` cho `null|undefined`. `reduce` không seed + `[]` → `TypeError`. `find` miss → `undefined` (không ném).

---

## 5. Bảng LINQ ↔ JS

| LINQ | JS / TS (Array eager) | Iterator helper (lazy, Node 26) |
|---|---|---|
| `Where` | `filter` | `.filter` |
| `Select` | `map` | `.map` |
| `SelectMany` | `flatMap` | `.flatMap` |
| `OrderBy` / `ThenBy` | `toSorted` (+ compare chuỗi / key rồi key) | materialize rồi sort — helper **không** có OrderBy |
| `Take` / `Skip` | `slice` | `.take` / `.drop` |
| `First` / `FirstOrDefault` | `find` / `[0]` / throw tay | `.find` |
| `Last` | `findLast` / `at(-1)` | exhaust hoặc materialize |
| `Any` / `All` | `some` / `every` | `.some` / `.every` |
| `Count` | `.length` / đếm vòng | đếm `reduce` / vòng — **O(n)** |
| `Distinct` | `Set` | `Set` sau materialize / tự viết |
| `GroupBy` | `Object.groupBy` / `Map.groupBy` | tự viết / materialize |
| `Aggregate` | `reduce` | `.reduce` |
| `Zip` | loop index / tự viết | tự viết generator — **không** giả `Iterator.zip` trên Node 26 |
| `Concat` | `concat` / `[...a, ...b]` | **`Iterator.concat`** |
| `ToList` | `Array.from` / `[...iter]` | `.toArray()` |
| Deferred execution | — | generators / iterator helpers |
| `Contains` | `includes` / `Set.has` | `.find` / `Set` |

LINQ to SQL **không** có analogue — expression tree C# không tồn tại trên JS. ORM/query builder nhận **data** (object options), không phải `IQueryable` method chain dịch SQL.

### 5.1 Ví dụ dịch “query” C# → JS

C# LINQ to Objects:

```csharp
// people.Where(p => p.Age >= 18).Select(p => p.Name).OrderBy(n => n).Take(10)
```

JS eager:

```ts
people
  .filter((p) => p.age >= 18)
  .map((p) => p.name)
  .toSorted((a, b) => a.localeCompare(b))
  .slice(0, 10);
```

JS lazy (Node 26) — **sort vẫn cần materialize** (OrderBy không lazy native):

```ts
const names = people
  .values()
  .filter((p) => p.age >= 18)
  .map((p) => p.name)
  .toArray()
  .toSorted((a, b) => a.localeCompare(b))
  .slice(0, 10);
```

Sort phá lazy: O(n) collect. Early `Take` **trước** sort không tương đương OrderBy+Take (sai tập). Take sau sort = đúng top-10.

`DistinctBy` (LINQ): `Map` theo key:

```ts
function distinctBy<T, K>(xs: Iterable<T>, key: (x: T) => K): T[] {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const x of xs) {
    const k = key(x);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}
```

---

## 6. Iterator helpers trên Node 26

Trên **Node 26 / V8 14.6**, iterator helpers là phần của ngôn ngữ (không cần flag). Node 22+ đã có phần lớn helpers; Node 26 thêm **`Iterator.concat`** (iterator sequencing) cùng upsert Map.

| API | Vai trò | Ghi chú Node 26 |
|---|---|---|
| `Iterator.from(x)` | Bọc iterable / iterator-like → **proper** iterator có helpers | Có |
| `Iterator.concat(...items)` | Nối nhiều **iterable** lazy | Highlight V8 14.6 |
| `.map` / `.filter` / `.flatMap` | projection / where lazy | Có |
| `.take` / `.drop` | Take / Skip lazy | Có |
| `.reduce` / `.forEach` / `.some` / `.every` / `.find` | consume | Có |
| `.toArray()` | materialize | Có |

**Không** đưa vào baseline tài liệu này (trừ khi feature-detect): `Iterator.zip`, `zipKeyed`, `.chunks`, `.windows`, `.includes`, `.join` trên iterator — MDN có thể liệt kê trên engine **mới hơn**; Node 26 release **không** nêu chúng.

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
- Đối số `concat` phải **iterable**. Iterator không iterable: `Iterator.from(it)` trước. Built-in iterators (kế `Iterator`) iterable được.
- Infinite: `concat` sau nguồn vô hạn **không bao giờ** tới. `take` trước. Không `Iterator.concat(...infiniteList)` — spread args không kết thúc.
- Nhiều iterable: `flatMap` trên iterator-of-iterables thay concat cực lớn (giới hạn số arg hàm).
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

Helper object **share** underlying iterator — “copy” `.drop(0)` vẫn một cursor:

```ts
const it = [1, 2, 3].values();
const a = it.drop(0);
it.next(); // 1
a.next();  // 2 — không fork
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

`Iterator.from` trên object chỉ `next` (iterator-like) bọc thành proper iterator — có helpers + `[Symbol.iterator]`.

### 6.2 Từng helper (sync, Node 26)

```ts
const src = [1, 2, 3, 4, 5].values();

src.map((n) => n * 2);           // iterator helper — chưa chạy fn
[...[1, 2, 3].values().filter((n) => n > 1)]; // [2, 3]
[...[1, 2, 3, 4].values().take(2)];           // [1, 2]
[...[1, 2, 3, 4].values().drop(2)];           // [3, 4]
[...[1, 2].values().flatMap((n) => [n, n])];  // [1, 1, 2, 2]

[1, 2, 3].values().reduce((a, b) => a + b, 0); // 6 — consume
[1, 2, 3].values().some((n) => n > 2);         // true — short-circuit, đóng iterator
[1, 2, 3].values().every((n) => n > 0);
[1, 2, 3].values().find((n) => n === 2);
[1, 2, 3].values().forEach((n) => {
  /* side effect — hết nguồn */
});
[1, 2, 3].values().toArray();
```

`.some`/`.find` true sớm: gọi `return()` underlying — `finally` generator chạy. `.forEach` / `.reduce` / `.toArray` kéo đến hết (trừ throw).

`.map` callback **không** nhận index như `Array#map` trên một số phiên bản helper — kiểm tra chữ ký (`(value) =>` vs `(value, index)`). Spec iterator map: chủ yếu `value`. Đừng copy `Array#map` `(v, i, arr)` — **không** có `arr`.

`.flatMap` callback trả iterable/iterator; array OK. Trả scalar không bọc → TypeError (khác `Array#flatMap` một số path). Bọc `[scalar]` nếu cần.

### 6.3 `Iterator.concat` chi tiết

```ts
Iterator.concat(); // iterator rỗng
Iterator.concat([1], [2, 3], new Set([3])); // 1,2,3,3 — không unique
new Map(Iterator.concat(mapA, mapB)); // key trùng: Map ctor lấy **sau**
```

Không iterable: `TypeError`. Iterator thuần (chỉ `next`): `Iterator.from` trước. Đóng sớm: `concat` đóng iterator **hiện tại**; chưa mở iterable sau (không acquire hết lúc tạo).

---

## 7. Async iteration: `for await...of`

### 7.1 Protocol

`[Symbol.asyncIterator]()` → async iterator với `next()` trả `Promise<{value, done}>`. Sync iterable cũng dùng được trong `for await` (engine wrap).

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

`yield*` async ủy quyền. `return()` / `break` **await** cleanup inner. Chi tiết → [functions-methods.md](functions-methods.md) §9.2.

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

Readable (web & Node hiện đại) async-iterable. `pipeline` vẫn cần khi transform nhiều stage + error — [async.md](async.md).

### 7.4 Lỗi, `break` & AbortSignal

```ts
const ac = new AbortController();
try {
  const stream = Readable.toWeb(createReadStream(path, { signal: ac.signal }));
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    if (shouldStop()) {
      ac.abort(); // hủy I/O — không chỉ break
      break;      // gọi return() iterator
    }
  }
} catch (e) {
  if (e instanceof Error && e.name === "AbortError") return;
  throw e;
}
```

| Hành động | Hiệu lực |
|---|---|
| `break` / `return` khỏi `for await` | `iterator.return?.()` — đóng iterator |
| Không `abort` | Producer I/O **có thể vẫn chạy** (đọc file, socket) |
| `AbortSignal` vào API tạo stream | Hủy hợp tác nguồn |
| `throw` trong vòng | `return()` + propagate |

Hủy hợp tác đầy đủ: [abort-context.md](abort-context.md). Đừng chỉ `break` khi HTTP body còn chảy.

`try/finally` trong async gen: `await` cleanup (đóng handle). Dual error → cẩn `SuppressedError` nếu kết hợp `await using`.

### 7.5 `Array.fromAsync`

```ts
const pages = await Array.fromAsync(
  urls.map(async (u) => {
    const res = await fetch(u);
    return res.text();
  }),
);
```

Hữu ích khi có async iterable / iterable of thenables. **Vẫn** kéo theo tốc độ consume tuần tự (không song song N request trừ khi input đã là Promise[] — `fromAsync` trên array of Promise await lần lượt **hoặc** theo implementation; với iterable of thenables nó await từng phần tử). Song song có giới hạn: `Promise.all` + pool — [async.md](async.md) §6.

File lớn: `for await` từng chunk, không `fromAsync` cả stream.

### 7.6 Backpressure async iterator

Pull: consumer `await next()` — producer **không** đẩy thêm cho đến khi consumer sẵn sàng (async gen `yield` chờ). Đó là backpressure **tự nhiên**.

| Anti-pattern | Hệ quả |
|---|---|
| `for await` đẩy hết vào `arr.push` rồi xử lý | Mất lazy; RAM = toàn bộ |
| `void` fire `process(chunk)` không await | Unbounded concurrency; OOM / file descriptor |
| `Readable` chuyển EventEmitter `data` không `pause` | Push không theo pull |
| `Promise.all(chunks.map(heavy))` trên stream vô hạn | Không bao giờ `all` |

Đúng: `for await { await process(chunk); }` (tuần tự) hoặc pool **bounded**. Node `Readable` async-iter **tôn trọng** pause khi consumer chậm. Trộn `on("data")` + `for await` trên cùng stream — đừng.

Web `ReadableStream` + `ReadableStreamDefaultReader.read()` cùng mô hình pull. `tee()` nhân bản — RAM nếu một nhánh chậm.

### 7.7 `fetch` body / Node stream

```ts
const res = await fetch(url, { signal: ac.signal });
if (!res.body) throw new Error("no body");
for await (const chunk of res.body) {
  // Uint8Array chunks — backpressure qua pull
}
```

`res.text()` / `res.arrayBuffer()` buffer **hết** — file lớn dùng iter body. Node `Readable.toWeb` / `Readable.fromWeb` cầu nối. Đừng `for await` rồi `JSON.parse` từng chunk UTF-8 cắt — dùng `readline` hoặc accumulate có ranh giới.

Top-level `for await` trong ESM module: hợp lệ (TLA) — [async.md](async.md). Entry CLI: vẫn `main().catch`.

### 7.8 Lỗi `next()` reject

Async `next()` reject: `for await` propagate lỗi, **không tự gọi `return()` trong nhánh này**. Iterator phải tự dọn tài nguyên khi producer lỗi, hoặc consumer dùng `try/finally` để đóng tường minh. Với sync generator yield Promise bị reject, `for await` cũng có thể bỏ qua `finally` của generator; dùng `for...of` + `await value` trong thân khi cần bảo đảm IteratorClose. Lỗi cleanup của vòng lặp thường theo completion rules, không tự tạo `SuppressedError` như ERM.

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

### 8.2 Reusable vs one-shot — pitfalls

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

| Kiểu | `[Symbol.iterator]()` | Duyệt 2 lần |
|---|---|---|
| Array / Map / Set / string | Iterator **mới** | OK — reusable |
| Generator object | Trả `this` (exhausted) | **Rỗng** lần 2 |
| Object `{ *[Symbol.iterator]() { yield } }` | Gen **mới** mỗi lần | OK |
| Iterator helper chain | Share cursor | **Không** fork (§6) |
| Node `Readable` | Thường one-shot | Không đọc lại file trừ mở lại |

```ts
const reusable = {
  *[Symbol.iterator]() {
    yield* [1, 2, 3];
  },
};
[...reusable];
[...reusable]; // [1,2,3] lại
```

API public: nhận `Iterable<T>` nếu caller có thể duyệt lại; document “one-shot” nếu nhận `Iterator` / generator / stream. `Iterable<T> | (() => Iterable<T>)` khi cần replay.

Bẫy: `function make() { const g = gen(); return { [Symbol.iterator]: () => g }; }` — **giả** reusable, lần 2 rỗng. Mỗi `[Symbol.iterator]` phải tạo iterator mới.

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

Trên Node 26, nhiều thao tác “map rồi take” nên dùng iterator helpers; chỉ tự viết khi helper không phủ (zip, cửa sổ trượt, stateful parse). **Không** gọi `Iterator.zip` như đã có sẵn trên baseline này.

`zip` nên `try/finally` gọi `ia.return?.()` / `ib.return?.()` khi một bên hết sớm — đóng inner generators.

### 8.5 Custom iterable — checklist bẫy

- `next` luôn trả `{ value, done }` — thiếu `done` → vòng vô hạn.
- `done: true` vẫn có `value` (completion) — `for-of` **bỏ** value đó.
- Mutate collection vừa iterate Map/Set: hành vi live — dễ skip/double. Copy hoặc cấm mutate.
- Throw từ `next`: `for-of` không gọi `return` trên một số path? Spec: abrupt completion vẫn cố `return` — implement `return` idempotent.
- Dual protocol: vừa `next` vừa `[Symbol.iterator]` trả iterator **khác** → `for-of` vs `.next()` lệch. Proper: `[Symbol.iterator]() { return this; }` trên iterator.

### 8.6 String, `arguments`, TypedArray

`for (const ch of str)` — code point. Index `str[i]` — UTF-16 code unit (cắt surrogate). `Uint8Array` iterable **byte**. `arguments` iterable (strict vẫn vậy) — prefer rest.

```ts
function f(...args: number[]) {
  for (const x of args) {
    /* … */
  }
}
```

`NodeList` / DOM không thuộc Node server. `Buffer` iterable như `Uint8Array` (byte 0..255).

### 8.7 Push vs pull (tóm tắt)

| Push | Pull |
|---|---|
| `EventEmitter` `data` | `for...of` / `next()` |
| `Readable` `on("data")` | `for await` / `read()` |
| Tốc độ producer | Tốc độ consumer |

Backpressure push: `pause()`/`highWaterMark`. Pull: không gọi `next` / không `await` vòng tiếp. Trộn hai mô hình trên một nguồn → mất pause. Chi tiết stream: [nodejs-apis.md](nodejs-apis.md), [event-loop.md](event-loop.md).

### 8.8 `Iterator.from` semantics

```ts
Iterator.from([1, 2, 3]); // lấy [Symbol.iterator]()
Iterator.from({
  next() {
    return { done: true, value: undefined };
  },
}); // bọc iterator-like → proper Iterator (helpers)
```

Nếu object **vừa** iterable vừa iterator, `from` ưu tiên iterable protocol (`[Symbol.iterator]`) theo spec — tạo iterator **mới**, không reuse `next` sẵn. Đọc MDN khi wrap object lạ.

`from` trên `Iterator` instance có thể trả chính nó (đã proper). Wrap hai lần không đổi hành vi hữu ích.

### 8.9 Materialize checklist

Trước `[...iter]` / `toArray()` hỏi:

1. N có bound không? Infinite → OOM.
2. Cần random access / `length` / sort? Bắt buộc mảng.
3. Duyệt một lần? Giữ lazy.
4. Cần replay? Mảng hoặc factory iterable.
5. I/O? Đừng materialize stream.

### 8.10 `reduce` trên iterator vs Array

Iterator `.reduce` **không** có `initialValue` optional giống Array mọi trường hợp — iterator rỗng + không seed → `TypeError`. Luôn truyền seed khi nguồn có thể rỗng.

Không `index`, không `array` tham số 3. Side-effect reducer: dùng `forEach` / `for...of` rõ ý.

```ts
[].values().reduce((a: number, b) => a + b, 0); // 0
// [].values().reduce((a, b) => a + b); // TypeError
```

### 8.11 Infinite + `take` + `forEach`

```ts
function* naturals() {
  for (let i = 0; ; i++) yield i;
}
naturals().take(5).toArray(); // [0,1,2,3,4]
// naturals().toArray(); // treo / OOM
```

`.drop(1e12)` trên generator rẻ (bỏ 1e12 bước **vẫn O(n)** — không seek). Không drop hàng tỉ trừ khi nguồn random-access (Array `slice`).

### 8.12 TypeScript: `Iterable` vs `ArrayLike`

```ts
function asArr<T>(x: ArrayLike<T> | Iterable<T>): T[] {
  return Array.from(x as Iterable<T> & ArrayLike<T>);
}
```

`ArrayLike` = `{ length: number; [n: number]: T }` — **không** iterable. Union: `Array.from` nhận cả hai overload. Generic khó — overload `from` như lib DOM.

`IterableIterator` gán `Iterable` và `Iterator`. Trả generator từ public API: caller dễ exhaust — document hoặc trả `T[]`.

### 8.13 Node `Readable.from(iterable)`

Đẩy pull iterable vào stream (objectMode nếu không phải byte). Ngược: `Readable` async-iterable. Bridge khi API đòi stream vs `for await`. `highWaterMark` objectMode đếm **object**, không byte.

### 8.14 `yield` giá trị lớn

`yield buf` không copy — consumer giữ reference, producer reuse buffer → data race. Stream pattern: producer không ghi đè chunk đã yield cho đến khi `next` tiếp (hoặc copy). `Buffer.allocUnsafe` pool: **copy** trước khi yield nếu recycle.

### 8.15 So sánh `forEach` Array vs iterator

`Array#forEach` không break (trừ throw). Iterator `.forEach` consume hết. Cần `break` → `for...of` / `.some`. `forEach` + `async` không await — giống Array.

Index: Array `forEach((v, i)`) có `i`; iterator helper **không** đảm bảo index — tự đếm nếu cần.

### 8.16 `break` không chạy `finally` của **outer** nếu…

`finally` generator chạy khi iterator đóng. `for-of` trong `try/finally` **ngoài** generator: `break` chạy `return()` gen **rồi** `finally` vòng ngoài. Hai tầng khác nhau. Thiếu `return` trên iterator tay: `finally` ngoài vẫn chạy, cleanup **trong** producer không.

Test: `break` giữa `yield` có I/O — spy `dispose` / `close`.

### 8.17 `Map`/`Set` keys iterator + helpers

```ts
const m = new Map([
  ["a", 1],
  ["b", 2],
]);
m.values()
  .filter((n) => n > 1)
  .toArray(); // [2]
Iterator.concat(m.keys(), ["c"]).toArray(); // ["a", "b", "c"]
```

`m[Symbol.iterator]()` ≡ `m.entries()`. `Iterator.concat(m, otherMap)` nối entries — hữu ích `new Map(Iterator.concat(a, b))`.

### 8.18 `for await` + `AbortSignal.any`

Nhiều nguồn hủy: `AbortSignal.any([req.signal, timeout])` đưa vào `fetch` / `createReadStream`. Iterator `return()` **và** abort — đủ cặp. `AbortSignal.timeout(ms)` tạo signal một shot — [abort-context.md](abort-context.md).

`for await` trên `Readable` đã destroy: ném / kết thúc tùy state — kiểm `readable.destroyed`.

### 8.19 Debug lazy pipeline

Log giữa chain: `.map((x) => { console.log(x); return x; })` trên iterator helper — vẫn lazy, log lúc consume. Eager Array: log ngay. Breakpoint `next` generator khó hơn `map` array — materialize tạm trong debug.

### 8.20 `using` + `for...of`

```ts
function* files(paths: string[]) {
  for (const p of paths) {
    using f = openDisposable(p);
    yield f;
  } // dispose mỗi iteration — yield xong mới dispose? 
  // CẨN: yield rồi hết block for → dispose TRƯỚC khi consumer dùng
}
```

**Sai** nếu `using` cùng block với `yield` rồi consumer dùng sau resume. Resource phải sống đến `return()` iterator: `using` ở generator **body ngoài vòng yield** hoặc cleanup `finally` khi `return`. Xem [statements.md](statements.md) `using` + vòng.

Đúng: mở trong consumer, hoặc async gen + `await using` theo chunk với lifetime khớp `yield`.

### 8.21 Spread vs `concat` vs `Iterator.concat`

`[...a, ...b]` materialize cả hai + mảng mới. `a.concat(b)` Array-only, eager. `Iterator.concat(a, b)` lazy, mọi iterable. Infinite `a`: concat không tới `b`. Memory: concat iterator thắng khi take sớm.

`String` spread: `..."ab"` → `["a","b"]` code points. `Buffer` spread: numbers 0–255 (không chunk).

### 8.22 `done` và value completion

```ts
function* g() {
  yield 1;
  return 99;
}
const it = g();
it.next(); // { value: 1, done: false }
it.next(); // { value: 99, done: true } — for-of bỏ 99
```

Cần completion value: không dùng `for-of`; gọi `next` tay hoặc `yield*` gán `const x = yield* g()`.

### 8.23 `Array.from` mapFn và `thisArg`

`Array.from(x, mapFn, thisArg)` — `thisArg` bind `this` của `mapFn` (không phải arrow). Iterator helper `.map` **không** có `thisArg` — đóng over / bind trước.

`Array.from({ length: n }, (_, i) => i)` dense 0..n-1 — tránh `new Array(n).map` (holes, map bỏ hole).

Empty iterable: `for...of` không vào body. `Iterator.concat()` rỗng. `[...emptyGen()]` → `[]`. Async: `for await` không vào body; `return()` vẫn có thể gọi khi `break` trước khi `next` — hiếm.

`Iterable<never>` / `[] as const` hữu ích test pipeline rỗng.

`break` labeled: `outer: for (const x of xs) { for (const y of ys) { if (cond) break outer; } }` — `return()` **cả hai** iterator (inner rồi outer) theo spec `for-of` lồng. Cleanup hai tầng.

`continue` `for-of` **không** gọi `return()` — chỉ lần lặp tiếp. `return()` khi thoát vòng (hết / break / throw). `continue` labeled ra vòng ngoài: đóng iterator vòng trong.

`for await` + `continue`: không `return()` async iterator — chỉ `next` tiếp. `break` mới đóng.

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
- Wrapper fluent chỉ để gọi lại Array methods (zero benefit, extra alloc).

### 9.1 Exception: thư viện parser / compiler

Viết SQL dialect / graph query **có** AST sẵn — fluent builder sinh AST (không “giả IQueryable từ `filter` JS”). Đó là compiler, không phải LINQ to Objects. App CRUD: options object `{ where, orderBy, take }`.

### 9.2 `for await` + JSON lines

```ts
async function* jsonLines(rl: AsyncIterable<string>) {
  for await (const line of rl) {
    if (!line.trim()) continue;
    yield JSON.parse(line) as unknown;
  }
}
```

Từng line parse — không `readFile` + `split`. Lỗi JSON: ném; quyết định skip vs abort. AbortSignal trên `createReadStream`.

---

## 10. Best practices

1. In-memory nhỏ/vừa: chuỗi Array — rõ, đủ nhanh.
2. Sequence lớn / lazy / infinite + `take`: iterator helpers (Node 26) hoặc generators.
3. I/O lớn: async generators + `for await`, không `readFile` cả cục rồi `split`. AbortSignal khi `break` chưa đủ.
4. Prefer `toSorted` khi cần bất biến.
5. Input API: nhận `Iterable<T>` khi reusable; document one-shot cho `Iterator` / stream.
6. Feature-detect helpers/`concat` nếu lib hỗ trợ Node cũ. Đừng giả `Iterator.zip` trên Node 26.
7. Đừng xây query DSL giả EF trên Node.
8. Join nặng → database.
9. Iterator one-shot — factory nếu cần duyệt lại. Helper chain không fork.
10. `for...in` không dùng cho array nghiệp vụ. `Array.from` cho array-like; spread cho iterable.
11. `reduce` scalar OK; group/map phức tạp → `for` / `groupBy`.
12. Async: await từng chunk hoặc pool bounded — đừng `Promise.all` vô hạn trên stream.

---

## 11. Checklist

```text
□ for...of / for-await đúng sync vs async iterable
□ next/return/throw: resource có return()/finally
□ Eager Array vs lazy iterator helpers có chủ đích
□ Iterator.from / .values() trước khi gọi helpers
□ Iterator.concat khi nối lazy (Node 26); args iterable
□ break sớm → cleanup return(); I/O → AbortSignal
□ Không enumerate iterator đã exhaust mà quên
□ Reusable iterable vs one-shot generator/stream
□ Array.from (array-like / mapFn) vs spread (iterable)
□ Object.groupBy / Set cho distinct-group đơn giản
□ reduce không thay for khi acc phức tạp / async
□ Stream file: readline / async iter, không load full
□ Backpressure: await process; không fire-and-forget unbounded
□ Không invent IQueryable; không Iterator.zip baseline
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
Array.from(arrayLike, mapFn)
Array.fromAsync(asyncIterable)

// Node 26 iterator helpers:
arr.values().filter(fn).map(fn).take(n).toArray()
Iterator.from(iterable).drop(1).toArray()
Iterator.concat(a, b, c)
```

| Cần | Chọn |
|---|---|
| Query mảng nhỏ | Array methods |
| Lazy CPU sequence | iterator helpers / `function*` |
| I/O stream | `async function*` / `for await` + signal |
| Nối lazy | `Iterator.concat` |
| Array-like → mảng | `Array.from` |
| Group | `Object.groupBy` / `Map.groupBy` |
| Replay | iterable factory, không generator object |

---

## 13. Version notes

| Nền | Liên quan |
|---|---|
| ES2015 | iterators, `for...of`, generators |
| ES2018 | async generators, `for await` |
| ES2023 | `toSorted` / `toReversed` / `findLast`… |
| ES2024 | `Object.groupBy` / `Map.groupBy` (theo engine) |
| Iterator Helpers (TC39) | `.map`/`.filter`/`.take`/… trên iterator; `Iterator.from` |
| **V8 14.6 / Node 26** | `Iterator.concat`; Map upsert (chương collections); helpers ổn định |
| `Array.fromAsync` | Có trên baseline 26; không phải API fan-out |
| **TS 7** | `Iterable`/`Iterator`/`AsyncIterable` trong lib |

Baseline: **Node 26** + **TS 7** — dùng iterator helpers + `Iterator.concat` / `Iterator.from` thoải mái trên baseline này.

Helpers `map`/`filter`/`take`… đã có trên Node 22+ (iterator helpers). `Iterator.concat` là điểm nhấn V8 14.6. `Array.fromAsync` có trên Node hiện đại — không nhầm với `Iterator.from` (sync).

Async iterator helpers (`.map` trên `AsyncIterator.prototype`) — **không** baseline; fallback `async function*`.

---


## 14. Tài liệu liên quan

- [Tập hợp & Generics](collections-generics.md)
- [Hàm & Method](functions-methods.md) — `function*` / `async function*` / `using`
- [Function type, Callback & Lambda](functions-callbacks.md)
- [Lập trình bất đồng bộ](async.md)
- [Node.js built-ins](nodejs-apis.md) — stream, readline
- [AbortSignal & request context](abort-context.md)
- [Event loop & concurrency model](event-loop.md) — pull vs push, không block
- [Phát biểu](statements.md) — `for await`, `using`

- [Stream/iterator cleanup tests](testing.md)
