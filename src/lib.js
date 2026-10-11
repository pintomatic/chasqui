// Shared state and transcript reading.
const fs = require("fs");
const path = require("path");
const { ROOT, load } = require("./config");

const C = load();
fs.mkdirSync(C.dataDir, { recursive: true });
const HUB = `http://127.0.0.1:${C.port}`;
const REGISTRY = path.join(C.dataDir, "presence.json");
const INBOX = path.join(C.dataDir, "inbox");
const OFFSETS = path.join(C.dataDir, "offsets.json");
const CONSENT = path.join(C.dataDir, "consent.json");
const CLI = path.join(__dirname, "hq.js").replace(/\\/g, "/");

const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return fallback; } };
function writeJson(f, v) {
  fs.writeFileSync(f + ".tmp", JSON.stringify(v, null, 2));
  fs.renameSync(f + ".tmp", f);
}

// ---------- registry ----------
const loadRegistry = () => readJson(REGISTRY, { listeners: [], threads: {} });
const saveRegistry = (r) => writeJson(REGISTRY, r);

// ---------- consent ----------
// A session's transcript can be read by others only after that session shares it.
const consented = () => new Set(readJson(CONSENT, []));
function setConsent(session, on) {
  const s = consented();
  on ? s.add(session) : s.delete(session);
  writeJson(CONSENT, [...s]);
  return [...s];
}

// ---------- transcripts ----------
function walk(dir, match, depth) {
  if (depth < 0 || !fs.existsSync(dir)) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isFile() && match(e.name)) return p;
    if (e.isDirectory()) { const hit = walk(p, match, depth - 1); if (hit) return hit; }
  }
  return null;
}

function collect(dir, match, depth, out) {
  if (depth < 0 || !fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isFile() && match(e.name)) out.push(p);
    else if (e.isDirectory()) collect(p, match, depth - 1, out);
  }
}

function findTranscript(id, cfg = C.transcripts) {
  if (!/^[0-9a-f-]{8,}$/i.test(id)) throw new Error("session id must be a UUID");
  for (const root of cfg.claudeRoots) {
    const hit = walk(root, (n) => n === `${id}.jsonl`, 1);
    if (hit) return { harness: "claude", file: hit };
  }
  // A Codex thread can continue in a newer rollout file ("rollout-...-<id>_<child>.jsonl"),
  // so take the most recently written file that names the thread.
  const hits = [];
  collect(cfg.codexRoot, (n) => n.startsWith("rollout-") && n.includes(id) && n.endsWith(".jsonl"), 3, hits);
  if (hits.length) return { harness: "codex", file: hits.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] };
  throw new Error(`no transcript found for ${id}`);
}

const textOf = (content) => typeof content === "string" ? content
  : (content || []).map((c) => c.text || (c.type === "tool_use" ? `[tool ${c.name}]` : "")).filter(Boolean).join("\n");

// One transcript line -> { ts, role, text } or null. Claude Code and Codex use different formats.
function parseLine(harness, line) {
  let o; try { o = JSON.parse(line); } catch { return null; }
  if (harness === "claude") {
    if (o.type !== "user" && o.type !== "assistant") return null;
    const m = o.message || {};
    if (Array.isArray(m.content) && m.content.every((c) => c.type === "tool_result")) return null;
    const t = textOf(m.content).trim();
    return t ? { ts: o.timestamp, role: m.role || o.type, text: t } : null;
  }
  const p = o.payload || {};
  if (o.type === "response_item" && p.type === "message" && (p.role === "user" || p.role === "assistant")) {
    const t = textOf(p.content).trim();
    if (!t || /^<(environment_context|recommended_plugins|external_)/.test(t) || t.startsWith("# AGENTS")) return null;
    return { ts: o.timestamp, role: p.role, text: t };
  }
  if (o.type === "response_item" && p.type === "function_call") return { ts: o.timestamp, role: "tool", text: `[tool ${p.name}]` };
  return null;
}

// What a transcript gained since `offset` (bytes). The first read starts near the tail,
// so very large transcripts are never read whole.
function readTranscript(id, offset, { maxChars = 12000, cfg = C.transcripts, consent = consented() } = {}) {
  if (!cfg.enabled) throw new Error("transcript sharing is disabled (transcripts.enabled in chasqui.config.json)");
  if (!consent.has(id)) throw new Error(`session ${id} has not shared its transcript (run: hq share --session ${id})`);
  const { harness, file } = findTranscript(id, cfg);
  const size = fs.statSync(file).size;
  const start = offset != null && offset <= size ? offset : Math.max(0, size - 2_000_000);
  const len = Math.min(size - start, 8_000_000);
  const from = size - len;
  const raw = Buffer.alloc(len);
  const fd = fs.openSync(file, "r");
  fs.readSync(fd, raw, 0, len, from);
  fs.closeSync(fd);
  const end = raw.lastIndexOf(0x0a) + 1;               // stop at the last complete line
  const lines = raw.subarray(0, end).toString("utf8").split("\n");
  if (from > 0 && from !== offset) lines.shift();      // started mid-line
  const items = lines.map((l) => parseLine(harness, l)).filter(Boolean);
  let out = items.map((i) => `[${i.role}] ${i.text.length > 1500 ? i.text.slice(0, 1500) + " …" : i.text}`).join("\n\n");
  if (out.length > maxChars) out = "… (earlier entries trimmed)\n\n" + out.slice(-maxChars);
  return { harness, file, offset: from + end, text: out || "(nothing new)" };
}

module.exports = {
  ROOT, C, HUB, REGISTRY, INBOX, OFFSETS, CLI,
  readJson, writeJson, loadRegistry, saveRegistry,
  consented, setConsent, findTranscript, parseLine, readTranscript,
};
