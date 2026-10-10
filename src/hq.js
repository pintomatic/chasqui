#!/usr/bin/env node
// Chasqui CLI. Talks to the local hub; `session`, `share` and `wait` work without it.
//   hq listen   --as claude|codex --session <id> [--channel general] [--topic "..."] [--thread <id>] [--mode conversation|addressed] [--name "Codex · Research"]
//   hq post     --as <agent> --thread <id> [--notify] "text"
//   hq pass     --as <agent> --thread <id>
//   hq read     --thread <id> [--limit 20]
//   hq mode     --thread <id> conversation|addressed
//   hq stop     --as <agent> --session <id> [--thread <id>]
//   hq presence [--thread <id>]
//   hq share    --session <id> [--off]         allow (or stop) other agents reading this session's transcript
//   hq session  <id> [--as <reader>] [--all]   what a sharing session did since you last looked
//   hq wait     --session <id>                 block until the hub queues a message for this Claude session
// --as on post/pass takes an agent key (e.g. codex-research), or a harness name when only one of it listens.
const fs = require("fs");
const path = require("path");
const L = require("./lib");

const FLAGS = new Set(["notify", "all", "off"]);
function parse(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      a[k] = !FLAGS.has(k) && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    } else a._.push(argv[i]);
  }
  return a;
}

async function hub(method, route, body) {
  const url = new URL(route, L.HUB);
  if (method === "GET") for (const [k, v] of Object.entries(body || {})) if (v != null) url.searchParams.set(k, v);
  let res;
  try {
    res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: method === "POST" ? JSON.stringify(body) : undefined });
  } catch { throw new Error(`hub not reachable at ${L.HUB}; is it running?`); }
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

function session(id, reader, all) {
  const offs = L.readJson(L.OFFSETS, {});
  const key = `${reader || "anon"}:${id}`;
  const r = L.readTranscript(id, all ? undefined : offs[key]);
  offs[key] = r.offset;
  L.writeJson(L.OFFSETS, offs);
  return `${r.harness} session ${id}\n${r.file}\n\n${r.text}`;
}

// Blocks until the inbox file grows, then prints the new entries and exits.
// Run in the background: its exit is what wakes the Claude Code session.
async function wait(sid, { pollMs = 2000 } = {}) {
  if (!sid || !/^[0-9a-f-]{8,}$/i.test(sid)) throw new Error("need --session <uuid>");
  const inbox = path.join(L.INBOX, `${sid}.jsonl`);
  const cursorFile = path.join(L.INBOX, `${sid}.cursor`);
  fs.mkdirSync(L.INBOX, { recursive: true });
  let cursor = Number(L.readJson(cursorFile, 0)) || 0;
  for (;;) {
    const size = fs.existsSync(inbox) ? fs.statSync(inbox).size : 0;
    if (size < cursor) cursor = 0;                             // inbox was truncated
    if (size > cursor) {
      const buf = fs.readFileSync(inbox).subarray(cursor);     // byte offsets, not characters
      const end = buf.lastIndexOf(0x0a) + 1;
      if (end > 0) {
        fs.writeFileSync(cursorFile, String(cursor + end));
        return buf.subarray(0, end).toString("utf8").trim().split("\n").map((l) => JSON.parse(l).text).join("\n\n---\n\n");
      }
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv;
  const a = parse(rest);
  const text = a._.join(" ");
  switch (cmd) {
    case "listen": return hub("POST", "/listen", { as: a.as, session: a.session, channel: a.channel, topic: a.topic, thread: a.thread, mode: a.mode, name: a.name });
    case "post": return hub("POST", "/post", { as: a.as, session: a.session, thread: a.thread, text, notify: !!a.notify });
    case "pass": return hub("POST", "/pass", { as: a.as, session: a.session, thread: a.thread });
    case "read": return (await hub("GET", "/read", { thread: a.thread, limit: a.limit })).messages.join("\n");
    case "mode": return hub("POST", "/mode", { thread: a.thread, mode: a._[0] });
    case "stop": return hub("POST", "/stop", { as: a.as, session: a.session, thread: a.thread });
    case "presence": return hub("GET", "/presence", { thread: a.thread });
    case "share":
      if (!a.session) throw new Error("need --session");
      return { sharing: L.setConsent(a.session, !a.off) };
    case "session": return session(a._[0], a.as, a.all);
    case "wait": return wait(a.session);
    default: return fs.readFileSync(__filename, "utf8").split("\n").slice(1, 14).join("\n");
  }
}

if (require.main === module) {
  main().then((out) => console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2)))
    .catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
}
module.exports = { parse, hub, session, wait, main };
