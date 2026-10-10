const test = require("node:test");
const assert = require("node:assert/strict");
const { TurnQueue } = require("../src/routing");

const tick = () => new Promise((r) => setImmediate(r));

test("overlapping enqueues never deliver the same wake twice", async () => {
  const woken = [];
  // A slow wake leaves a window where the queue is idle but busy, the case that double-delivered before.
  const q = new TurnQueue(async (k) => { woken.push(k); await tick(); return true; });
  q.enqueue(["claude"]);
  q.enqueue(["claude"]);
  await tick(); await tick();
  assert.deepEqual(woken, ["claude"]);
  assert.equal(q.active.key, "claude");
});

test("agents take turns: the next wakes only when the active one finishes", async () => {
  const woken = [];
  const q = new TurnQueue(async (k) => { woken.push(k); return true; });
  await q.enqueue(["codex", "claude"]);
  assert.deepEqual(woken, ["codex"]);
  await q.finish("claude");                 // not the active agent: ignored
  assert.deepEqual(woken, ["codex"]);
  await q.finish("codex");
  assert.deepEqual(woken, ["codex", "claude"]);
});

test("an agent addressed mid-turn is queued again", async () => {
  const woken = [];
  const q = new TurnQueue(async (k) => { woken.push(k); return true; });
  await q.enqueue(["codex"]);
  await q.enqueue(["codex"]);              // a new message arrives while codex holds the turn
  await q.finish("codex");
  assert.deepEqual(woken, ["codex", "codex"]);
});

test("agents with nothing new are skipped, and a failing wake does not stall the queue", async () => {
  const woken = [];
  const q = new TurnQueue(async (k) => {
    if (k === "broken") throw new Error("boom");
    woken.push(k);
    return k !== "idle";
  });
  await q.enqueue(["broken", "idle", "claude"]);
  assert.deepEqual(woken, ["idle", "claude"]);
  assert.equal(q.active.key, "claude");
});

test("a turn times out and hands over", async () => {
  const woken = [];
  const q = new TurnQueue(async (k) => { woken.push(k); return true; }, { timeoutMs: 20 });
  await q.enqueue(["codex", "claude"]);
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(woken, ["codex", "claude"]);
  assert.equal(q.active, null);          // claude timed out too, and the queue is empty
});
