const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { sandbox } = require("./helpers");

const SID = "12345678-1234-1234-1234-123456789abc";

test("flags never swallow the message text", () => {
  sandbox();
  const { parse } = require("../src/hq");
  assert.deepEqual(parse(["--as", "claude", "--notify", "all", "done"]), { _: ["all", "done"], as: "claude", notify: true });
  assert.deepEqual(parse(["--session", SID, "--off"]), { _: [], session: SID, off: true });
});

test("wait returns queued messages once, counting bytes not characters", async () => {
  sandbox();
  const L = require("../src/lib");
  const { wait } = require("../src/hq");
  fs.mkdirSync(L.INBOX, { recursive: true });
  const inbox = path.join(L.INBOX, `${SID}.jsonl`);
  // The "·" is two bytes in UTF-8; counting characters here once corrupted the cursor.
  fs.writeFileSync(inbox, JSON.stringify({ text: "Codex · Research: first" }) + "\n" + JSON.stringify({ text: "second" }) + "\n");
  assert.equal(await wait(SID, { pollMs: 5 }), "Codex · Research: first\n\n---\n\nsecond");
  fs.appendFileSync(inbox, JSON.stringify({ text: "ærlig" }) + "\n");
  assert.equal(await wait(SID, { pollMs: 5 }), "ærlig");
});

test("share records and withdraws consent", async () => {
  sandbox();
  const { main } = require("../src/hq");
  assert.deepEqual(await main(["share", "--session", SID]), { sharing: [SID] });
  assert.deepEqual(await main(["share", "--session", SID, "--off"]), { sharing: [] });
});
