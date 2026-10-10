const test = require("node:test");
const assert = require("node:assert/strict");
const { aliases, named, wakeOrder } = require("../src/routing");

const claude = { key: "claude", harness: "claude", name: "Claude" };
const codex = { key: "codex", harness: "codex", name: "Codex" };
const research = { key: "codex-research", harness: "codex", name: "Codex · Market Research" };

test("aliases include the label, the short name, its last word and the harness", () => {
  assert.deepEqual(aliases(research), ["codex · market research", "market research", "research", "codex"]);
  assert.deepEqual(aliases(claude), ["claude"]);
});

test("named finds agents in order of first mention, as whole words only", () => {
  assert.deepEqual(named([claude, codex], "Codex, check this. Claude, review it."), ["codex", "claude"]);
  assert.deepEqual(named([claude, codex], "the codexes are fine"), []);
});

test("lineStart only counts a name that opens a line or is @-mentioned", () => {
  assert.deepEqual(named([claude, codex], "I think Codex is right", true), []);
  assert.deepEqual(named([claude, codex], "Done.\nCodex: over to you", true), ["codex"]);
  assert.deepEqual(named([claude, codex], "ping @claude when ready", true), ["claude"]);
});

test("conversation mode wakes everyone, named agents first, last speaker last", () => {
  assert.deepEqual(wakeOrder([claude, codex], "Codex, have a look"), ["codex", "claude"]);
  assert.deepEqual(wakeOrder([claude, codex], "thoughts?", { last: "claude" }), ["codex", "claude"]);
});

test("addressed mode wakes only named agents, everyone on 'everyone', else the Claude lead", () => {
  const agents = [codex, research, claude];
  assert.deepEqual(wakeOrder(agents, "Research, dig in", { mode: "addressed" }), ["codex-research"]);
  assert.equal(wakeOrder(agents, "everyone, status please", { mode: "addressed" }).length, 3);
  assert.deepEqual(wakeOrder(agents, "anything new?", { mode: "addressed" }), ["claude"]);
});
