import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import http from "node:http";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { resolve, relative, isAbsolute, sep, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const markdown = (file) => readFileSync(resolve(root, file), "utf8").replace(/\r\n/g, "\n");

function codeUnder(file, heading, blockIndex = 0) {
  const text = markdown(file);
  const start = text.indexOf(heading + "\n");
  assert.ok(start >= 0, `missing ${heading} in ${file}`);
  const section = text.slice(start).split(/\n#{2,3} /)[0];
  const blocks = [...section.matchAll(/^```(?:ts|js)\n([\s\S]*?)^```/gm)];
  assert.ok(blocks[blockIndex], `missing code block #${blockIndex} under ${heading}`);
  return stripTypeScriptTypes(blocks[blockIndex][1]); // Syntax stripping only, not typechecking.
}

const poolCode = codeUnder("async.md", "### 9.2 `mapPool`");
const mapPool = new Function(poolCode + "\nreturn mapPool;")();

test("documented pool preserves order and enforces concurrency", async () => {
  let active = 0;
  let peak = 0;
  const output = await mapPool([4, 3, 2, 1], 2, async (value) => {
    peak = Math.max(peak, ++active);
    await delay(value);
    active--;
    return value * 10;
  });
  assert.deepEqual(output, [40, 30, 20, 10]);
  assert.equal(peak, 2);
  assert.equal(active, 0);
});

test("documented pool rejects invalid limits and already-aborted signals", async () => {
  for (const limit of [0, -1, 1.5, Infinity, NaN]) {
    await assert.rejects(mapPool([], limit, async () => 1), RangeError);
  }
  assert.deepEqual(await mapPool([], 1, async () => 1), []);
  const reason = new Error("cancelled before start");
  let called = false;
  await assert.rejects(mapPool([1], 1, async () => { called = true; }, AbortSignal.abort(reason)), (error) => error === reason);
  assert.equal(called, false);
});

test("documented pool stops assigning jobs after failure", async () => {
  const started = [];
  const gate = Promise.withResolvers();
  const failure = new Error("job failed");
  const result = mapPool([0, 1, 2, 3], 2, async (value) => {
    started.push(value);
    if (value === 0) throw failure;
    await gate.promise;
    return value;
  });
  await assert.rejects(result, (error) => error === failure);
  gate.resolve();
  await delay(0); // Let the already-running worker finish.
  assert.deepEqual(started, [0, 1]);
});

const httpCode = codeUnder("abort-context.md", "### 5.5 HTTP server — client ngắt")
  .replace(/^import http from "node:http";\s*/m, "")
  .replace("http.createServer(", "return http.createServer(");
const createDocumentedServer = new Function("http", "handle", httpCode);

async function listen(t, handle) {
  const server = createDocumentedServer(http, handle);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test("documented HTTP bridge permits a normal completed request", { timeout: 5_000 }, async (t) => {
  let signal;
  const url = await listen(t, async (req, res, requestSignal) => {
    signal = requestSignal;
    req.resume();
    await once(req, "end");
    await delay(10); // req.close can occur while response is still pending.
    requestSignal.throwIfAborted();
    res.end("ok");
  });
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "ok");
  assert.equal(signal.aborted, false);
});

test("documented HTTP bridge cancels work when response client disconnects", { timeout: 5_000 }, async (t) => {
  const entered = Promise.withResolvers();
  const cancelled = Promise.withResolvers();
  const url = await listen(t, async (req, res, signal) => {
    req.resume();
    const aborted = once(signal, "abort");
    entered.resolve(signal);
    await aborted;
    cancelled.resolve(signal.reason);
    signal.throwIfAborted();
  });
  const request = http.get(url);
  request.on("error", () => {}); // Expected local destruction.
  t.after(() => request.destroy());
  const signal = await entered.promise;
  request.destroy();
  const reason = await cancelled.promise;
  assert.equal(signal.aborted, true);
  assert.match(reason.message, /interrupted/);
});

const parsePage = new Function(codeUnder("security.md", "## 2. Injection, object keys và prototype") + "\nreturn parsePage;")();
const pathCode = codeUnder("security.md", "## 3. Filesystem: traversal, symlink và TOCTOU").replace(/^import .*?;\s*/m, "");
const resolveInside = new Function("resolve", "relative", "isAbsolute", "sep", pathCode + "\nreturn resolveInside;")(resolve, relative, isAbsolute, sep);

test("documented boundary guards preserve valid values and reject malformed inputs", () => {
  assert.deepEqual(parsePage({ limit: 1 }), { limit: 1 });
  assert.deepEqual(parsePage({ limit: 100 }), { limit: 100 });
  const nullProto = Object.assign(Object.create(null), { limit: 25 });
  assert.deepEqual(parsePage(nullProto), { limit: 25 });

  let getterCalled = false;
  const withGetter = Object.defineProperty({}, "limit", {
    enumerable: true,
    get() {
      getterCalled = true;
      return 10;
    },
  });
  assert.throws(() => parsePage(withGetter));
  assert.equal(getterCalled, false, "parsePage must not invoke own getters");

  for (const value of [
    null,
    [],
    {},
    new Date(),
    Object.assign(new Date(), { limit: 10 }),
    { limit: "10" },
    { limit: 0 },
    { limit: 101 },
    { limit: NaN },
    Object.create({ limit: 5 }),
  ]) {
    assert.throws(() => parsePage(value));
  }

  const base = resolve(root, "uploads");
  assert.equal(resolveInside(base, "file.txt"), resolve(base, "file.txt"));
  assert.equal(resolveInside(base, "nested/report.pdf"), resolve(base, "nested/report.pdf"));
  for (const badPath of [
    "",
    ".",
    "a/..",
    "../uploads-evil/file.txt",
    resolve(root, "outside.txt"),
    resolve(base, "file.txt"),
    "file.txt\0.jpg",
    "file.txt::$DATA",
    "file.txt:stream",
    "secret.txt.",
    "secret.txt ",
    "CON",
    "nul.txt",
    "sub/COM1.log",
  ]) {
    assert.throws(() => resolveInside(base, badPath), `expected rejection for ${JSON.stringify(badPath)}`);
  }
});

const walkErrorsCode = codeUnder("exceptions.md", "### 5.3 Duyệt đệ quy — `errors` rồi `cause`");
const { walkErrors, findCode, flattenMessages } = new Function(
  walkErrorsCode + "\nreturn { walkErrors, findCode, flattenMessages };",
)();

test("documented walkErrors traverses SuppressedError, AggregateError and circular causes", () => {
  const rootCause = Object.assign(new Error("db down"), { code: "ECONNREFUSED" });
  const workErr = new Error("work failed", { cause: rootCause });
  const disposeErr = Object.assign(new Error("dispose failed"), { code: "EDISPOSE" });
  const suppressed = new SuppressedError(disposeErr, workErr, "suppressed");
  const agg = new AggregateError([suppressed], "batch failed");
  rootCause.cause = agg; // Circular reference must terminate.

  assert.equal(findCode(agg, "EDISPOSE"), true);
  assert.equal(findCode(agg, "ECONNREFUSED"), true);
  assert.equal(findCode(agg, "ENOENT"), false);

  const messages = flattenMessages(suppressed);
  assert.ok(messages.some((m) => m.includes("dispose failed")));
  assert.ok(messages.some((m) => m.includes("work failed")));
  assert.ok(messages.some((m) => m.includes("db down")));
  assert.ok([...walkErrors(agg)].length >= 4);
});

const throttleCode = codeUnder("functions-callbacks.md", "### 7.4 Debounce / throttle (sketch)");
const throttle = new Function(throttleCode + "\nreturn throttle;")();

test("documented throttle enforces cooldown after trailing call and respects AbortSignal", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const ac = new AbortController();
  const seen = [];
  const fn = throttle((v) => seen.push(v), 100, ac.signal);

  fn("a"); // Leading executes immediately
  fn("b"); // Queued
  fn("c"); // Replaces trailing
  assert.deepEqual(seen, ["a"]);

  t.mock.timers.tick(100); // Trailing "c" fires AND starts new 100ms cooldown
  assert.deepEqual(seen, ["a", "c"]);

  fn("d"); // Must wait for cooldown from "c", NOT fire immediately
  assert.deepEqual(seen, ["a", "c"]);

  t.mock.timers.tick(50);
  assert.deepEqual(seen, ["a", "c"]);

  t.mock.timers.tick(50);
  assert.deepEqual(seen, ["a", "c", "d"]);

  fn("e"); // Queued during cooldown from "d"
  ac.abort();
  t.mock.timers.tick(200);
  assert.deepEqual(seen, ["a", "c", "d"]);
});

const walkCode = codeUnder("functions-methods.md", "### 12.2 Recursive stack");
const walk = new Function(walkCode + "\nreturn walk;")();

test("documented iterative walk terminates on cyclic graphs", () => {
  const a = { children: [] };
  const b = { children: [a] };
  a.children.push(b);
  assert.doesNotThrow(() => walk(a));
});

const reportCode = codeUnder("diagnostics.md", "### 6.2 Diagnostic Reports: CLI flags, `process.report.writeReport()` & bảo mật")
  .replace(/^import .*?;\s*/gm, "")
  .replace(/^export function /m, "function ");
const writeSafeDiagnosticReport = new Function("mkdirSync", "dirname", "process", reportCode + "\nreturn writeSafeDiagnosticReport;")(
  mkdirSync,
  dirname,
  process,
);

test("documented writeSafeDiagnosticReport creates nested directory and strips env", (t) => {
  const dir = join(tmpdir(), `node-ref-report-${process.pid}-${Date.now()}`);
  const target = join(dir, "nested", "incident.json");
  t.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  const written = writeSafeDiagnosticReport(target);
  assert.ok(existsSync(written));
  const payload = JSON.parse(readFileSync(written, "utf8"));
  assert.equal(payload.environmentVariables, undefined);
});

// Execute all standalone JS test examples from testing.md as separate modules.
let example = 0;
for (const block of markdown("testing.md").matchAll(/^```js\n([\s\S]*?)^```/gm)) {
  await import(`data:text/javascript,${encodeURIComponent(block[1])}#example-${++example}`);
}
assert.equal(example, 5);
