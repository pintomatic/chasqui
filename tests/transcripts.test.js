const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { sandbox } = require("./helpers");

const CLAUDE_ID = "11111111-2222-3333-4444-555555555555";
const CODEX_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const claudeLine = (role, content) => JSON.stringify({ type: role, timestamp: "t", message: { role, content } }) + "\n";
const codexLine = (role, text) => JSON.stringify({ type: "response_item", timestamp: "t",
  payload: { type: "message", role, content: [{ type: role === "user" ? "input_text" : "output_text", text }] } }) + "\n";

function setup(opts) {
  const s = sandbox(opts);
  s.claudeFile = path.join(s.claudeRoot, "proj", `${CLAUDE_ID}.jsonl`);
  s.codexFile = path.join(s.codexRoot, "2026", "10", "10", `rollout-2026-10-10T10-00-00-${CODEX_ID}.jsonl`);
  fs.writeFileSync(s.claudeFile, claudeLine("user", "hello") + claudeLine("assistant", [{ type: "text", text: "hi · there" }, { type: "tool_use", name: "Bash" }]));
  fs.writeFileSync(s.codexFile, codexLine("user", "<environment_context>noise</environment_context>") + codexLine("assistant", "done"));
  s.L = require("../src/lib");
  return s;
}

test("parses both harness formats and drops harness noise", () => {
  const { L } = setup();
  assert.deepEqual(L.parseLine("claude", claudeLine("assistant", [{ type: "tool_result" }])), null);
  assert.equal(L.parseLine("codex", codexLine("user", "<environment_context>x")), null);
  assert.equal(L.parseLine("codex", codexLine("assistant", "ok")).text, "ok");
});

test("reading needs both the config switch and the session's own consent", () => {
  const off = setup({ transcripts: { enabled: false } });
  off.L.setConsent(CLAUDE_ID, true);
  assert.throws(() => off.L.readTranscript(CLAUDE_ID), /disabled/);

  const { L } = setup();
  assert.throws(() => L.readTranscript(CLAUDE_ID), /has not shared/);
  L.setConsent(CLAUDE_ID, true);
  const r = L.readTranscript(CLAUDE_ID);
  assert.equal(r.harness, "claude");
  assert.match(r.text, /\[user\] hello/);
  assert.match(r.text, /hi · there\n\[tool Bash\]/);
  L.setConsent(CLAUDE_ID, false);
  assert.throws(() => L.readTranscript(CLAUDE_ID), /has not shared/);
});

test("a read position returns only what was added, including multibyte text", () => {
  const { L, codexFile } = setup();
  L.setConsent(CODEX_ID, true);
  const first = L.readTranscript(CODEX_ID);
  assert.match(first.text, /\[assistant\] done/);
  assert.doesNotMatch(first.text, /environment_context/);
  assert.equal(L.readTranscript(CODEX_ID, first.offset).text, "(nothing new)");
  fs.appendFileSync(codexFile, codexLine("assistant", "ærlig · svar") + '{"partial":');
  const next = L.readTranscript(CODEX_ID, first.offset);
  assert.equal(next.text, "[assistant] ærlig · svar");
  assert.equal(next.offset, fs.statSync(codexFile).size - '{"partial":'.length);  // the partial line waits for its newline
});

test("a Codex thread that continued in a newer rollout file resolves to that file", () => {
  const { L, codexRoot, codexFile } = setup();
  const child = path.join(codexRoot, "2026", "10", "11", `rollout-2026-10-11T09-00-00-${CODEX_ID}_01.jsonl`);
  fs.mkdirSync(path.dirname(child), { recursive: true });
  fs.writeFileSync(child, codexLine("assistant", "continued"));
  const later = new Date(fs.statSync(codexFile).mtimeMs + 60_000);
  fs.utimesSync(child, later, later);
  assert.equal(L.findTranscript(CODEX_ID).file, child);
});

test("rejects ids that are not UUID-shaped, so a path can't be smuggled in", () => {
  const { L } = setup();
  assert.throws(() => L.findTranscript("../../etc/passwd"), /UUID/);
  assert.throws(() => L.findTranscript("99999999-0000-0000-0000-000000000000"), /no transcript/);
});
