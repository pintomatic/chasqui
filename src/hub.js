// Chasqui hub: one Discord connection, a localhost API, and wake-ups for
// listening Claude Code and Codex sessions.
//
// A conversation space (Discord thread or text channel) holds any number of
// agents: { key, harness, session, name, labels }. `name` is the label the agent
// posts under ("Codex", "Codex · Research"); `labels` keeps earlier names so old
// posts still map to it after a rename.
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { Client, GatewayIntentBits, ChannelType } = require("discord.js");
const L = require("./lib");
const { codexCommand } = require("./config");
const { slug, named, wakeOrder, TurnQueue } = require("./routing");

const C = L.C;
const { token, guildId, ownerId } = C.discord;
for (const [k, v] of [["DISCORD_BOT_TOKEN", token], ["DISCORD_GUILD_ID", guildId], ["DISCORD_OWNER_ID", ownerId]]) {
  if (!v) { console.error(`Missing ${k} in the environment (.env); refusing to start.`); process.exit(1); }
}
const HARNESS = { claude: "Claude", codex: "Codex" };
const OWNER = C.ownerName;
const [CODEX_BIN, CODEX_ARGS] = codexCommand(C.codex.cli);
fs.mkdirSync(L.INBOX, { recursive: true });
const log = (...a) => console.log(new Date().toISOString(), ...a);

const reg = L.loadRegistry();
const save = () => L.saveRegistry(reg);
const agentsOf = (st) => Object.values(st.agents);
for (const st of Object.values(reg.threads)) { st.agents ??= {}; st.cursor ??= {}; }

// Optional display name for a Codex thread, read from the Codex desktop database.
// Off by default (codex.readTitles): it reads an internal, undocumented file.
function codexTitle(session) {
  if (!C.codex.readTitles) return null;
  try {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(path.join(os.homedir(), ".codex", "state_5.sqlite"), { readOnly: true });
    const r = db.prepare("select name, title from threads where id = ?").get(session);
    db.close();
    return (r?.name || r?.title || "").split("\n")[0].replace(/^[A-Z]{2,}\s*[-–:]\s*/, "").trim().slice(0, 40) || null;
  } catch { return null; }
}
const qualified = (harness, session) => `${HARNESS[harness]} · ${(harness === "codex" && codexTitle(session)) || session.slice(0, 4)}`;

// ---------- Discord ----------
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const labelOf = (m) => m.content.match(/^\*\*([^*\n]+):\*\*/)?.[1];
const speaker = (m) => m.author.id === ownerId ? OWNER : m.author.id === client.user.id ? (labelOf(m) || "Relay") : m.author.username;
const bodyOf = (m) => m.content.replace(/^\*\*[^*\n]+:\*\*\s*/, "");

async function send(space, label, text, notify = false) {
  let rest = `**${label}:** ${notify ? `<@${ownerId}> ` : ""}${text}`;
  const opts = { allowedMentions: notify ? { users: [ownerId] } : { parse: [] } };
  let first;
  while (rest.length) {
    let cut = rest.length > 1900 ? rest.lastIndexOf("\n", 1900) : rest.length;
    if (cut < 500) cut = Math.min(1900, rest.length);
    const m = await space.send({ content: rest.slice(0, cut), ...opts });
    first ??= m;
    rest = rest.slice(cut);
  }
  return first;
}

const fetchSpace = async (id) => {
  const t = await client.channels.fetch(id);
  if (!t || t.guildId !== guildId || !(t.isThread() || t.type === ChannelType.GuildText)) throw new Error("not a thread or text channel in the configured server");
  return t;
};
const where = (t) => (t.isThread() ? `#${t.parent?.name} / thread "${t.name}"` : `#${t.name}`);

// Channels that mirror a Codex thread (scripts/sync-channels.js). Their Codex agent is wired automatically.
function mirrorState(id) {
  const map = C.mirrors ? L.readJson(C.mirrors, {}) : {};
  if (!map[id]) return null;
  const session = map[id].codexThread;
  reg.threads[id] = { channel: map[id].channel, mode: "conversation", cursor: {}, mirror: true,
    agents: { codex: { key: "codex", harness: "codex", session, name: "Codex", labels: ["Codex"] } } };
  save();
  return reg.threads[id];
}

// `as` may be an agent key or a harness name; a harness name works when it is unambiguous.
function resolve(st, as, session) {
  if (st.agents[as]) return st.agents[as];
  const hits = agentsOf(st).filter((a) => a.harness === as && (!session || a.session === session));
  if (hits.length === 1) return hits[0];
  throw new Error(hits.length ? `several ${as} agents here; use --as one of: ${hits.map((a) => a.key).join(", ")}` : `no ${as} agent listening here`);
}

// ---------- wake ----------
function payload(a, t, msgs, st) {
  const peers = agentsOf(st).filter((p) => p.key !== a.key);
  const cli = `node "${L.CLI}"`;
  return [
    `[chasqui] Discord ${where(t)} (${t.id}), mode: ${st.mode}.`,
    ``,
    `New messages:`,
    ...msgs.map((m) => `${speaker(m)}: ${bodyOf(m)}`),
    ``,
    `You are ${a.name}, in a group conversation with ${OWNER}${peers.length ? `, ${peers.map((p) => p.name).join(", ")}` : ""}. Act like a person in a group chat:`,
    `reply when addressed by name or when you add something useful; otherwise pass. Keep replies short; put long work in files.`,
    st.mode === "addressed" ? `This space is in addressed mode: others wake only when you name them at the start of a line ("${peers[0]?.name || "Codex"}, ...").` : ``,
    ...(C.transcripts.enabled ? peers.map((p) => `${p.name}'s session is ${p.session}. If it has shared its transcript: ${cli} session ${p.session} --as ${a.key}`) : []),
    C.policyLine,
    ``,
    `Reply: ${cli} post --as ${a.key} --thread ${t.id} "your message"   (add --notify only when done, blocked or needing approval)`,
    `Pass:  ${cli} pass --as ${a.key} --thread ${t.id}`,
    a.harness === "claude" ? `Afterwards, restart your listener in the background: ${cli} wait --session ${a.session}` : ``,
  ].filter((l, i, arr) => l !== `` || arr[i - 1] !== ``).join("\n");
}

// Claude Code: append to the session's inbox file; its background `hq wait` exits and re-invokes the session.
// Codex: `codex queue`, which starts a turn in the thread. It only drains for threads the Codex app has loaded.
function deliver(a, text) {
  if (a.harness === "claude") {
    fs.appendFileSync(path.join(L.INBOX, `${a.session}.jsonl`), JSON.stringify({ ts: Date.now(), text }) + "\n");
    return;
  }
  const p = spawn(CODEX_BIN, [...CODEX_ARGS, "queue", "--thread", a.session, "--message", text], { windowsHide: true });
  let err = "";
  p.stderr.on("data", (d) => (err += d));
  p.on("close", (code) => code && log(`codex queue failed (${code}): ${err.slice(-300)}`));
}

const newest = (ids) => ids.reduce((x, y) => (BigInt(y) > BigInt(x) ? y : x));

async function wake(key, spaceId) {
  const st = reg.threads[spaceId];
  const a = st?.agents[key];
  if (!a) return false;
  const t = await fetchSpace(spaceId);
  const after = st.cursor[key];
  const fetched = await t.messages.fetch({ limit: 30, ...(after ? { after } : {}) });
  const msgs = [...fetched.values()].sort((x, y) => x.createdTimestamp - y.createdTimestamp)
    .filter((m) => !(m.author.id === client.user.id && a.labels.includes(labelOf(m))));
  if (fetched.size) st.cursor[key] = newest([...fetched.keys()]);
  save();
  if (!msgs.length) return false;
  log(`wake ${key} ${a.session} in ${spaceId} (${msgs.length} msgs)`);
  deliver(a, payload(a, t, msgs, st));
  return true;
}

const queues = new Map();
function queueOf(spaceId) {
  if (!queues.has(spaceId)) {
    queues.set(spaceId, new TurnQueue((key) => wake(key, spaceId), {
      timeoutMs: C.turnTimeoutMinutes * 60_000,
      onChange: (q) => { if (reg.threads[spaceId]) { reg.threads[spaceId].pending = [...q]; save(); } },
    }));
  }
  return queues.get(spaceId);
}

function onOwnerMessage(spaceId, st, text) {
  const q = queueOf(spaceId);
  let order = wakeOrder(agentsOf(st), text, { mode: st.mode, last: st.last });
  // Naming an agent jumps the queue: if someone else holds the turn, wake the named agent now.
  if (q.active) {
    for (const k of named(agentsOf(st), text)) {
      if (k === q.active.key) continue;
      wake(k, spaceId).catch((e) => log("wake error", e.message));
      order = order.filter((x) => x !== k);
    }
  }
  q.enqueue(order);
}

client.on("messageCreate", async (m) => {
  if (m.guildId !== guildId) return;
  const st = reg.threads[m.channel.id] || (m.author.id === ownerId ? mirrorState(m.channel.id) : null);
  if (!st) return;
  if (m.author.id === ownerId) return onOwnerMessage(m.channel.id, st, m.content);
  if (m.author.id !== client.user.id) return;          // other users and bots never wake agents
  const a = agentsOf(st).find((x) => x.labels.includes(labelOf(m)));
  if (!a) return;
  st.last = a.key;
  save();
  queueOf(m.channel.id).finish(a.key);
  // An agent wakes a peer only by naming it at the start of a line or with @name.
  const peers = named(agentsOf(st), bodyOf(m), true).filter((k) => k !== a.key);
  if (peers.length) queueOf(m.channel.id).enqueue(peers);
});

// Turns queued before a restart, and owner messages posted while the hub was down.
async function catchUp() {
  for (const [id, st] of Object.entries(reg.threads)) {
    if (!agentsOf(st).length) continue;
    if (st.pending?.length) queueOf(id).enqueue(st.pending.filter((k) => st.agents[k]));
    try {
      const t = await fetchSpace(id);
      const mine = [...(await t.messages.fetch({ limit: 15 })).values()].filter((m) => m.author.id === ownerId);
      if (!mine.length) continue;
      const last = mine.reduce((x, y) => (BigInt(y.id) > BigInt(x.id) ? y : x));
      const cursors = Object.values(st.cursor).filter(Boolean);
      if (!cursors.length || BigInt(last.id) > BigInt(newest(cursors))) {
        log(`catch-up in ${id}: message posted while the hub was down`);
        onOwnerMessage(id, st, last.content);
      }
    } catch (e) { log("catch-up error", id, e.message); }
  }
}

// ---------- localhost API ----------
const routes = {
  async "POST /listen"({ as, session, channel, thread: tid, topic, mode, name }) {
    if (!HARNESS[as] || !session) throw new Error("need --as claude|codex and --session");
    if (!/^[0-9a-f-]{8,}$/i.test(session)) throw new Error("session id must be a UUID");
    let t;
    if (tid) { t = await fetchSpace(tid); if (t.isThread()) await t.join().catch(() => {}); }
    else {
      const guild = await client.guilds.fetch(guildId);
      const parent = (await guild.channels.fetch()).find((c) => c?.name === (channel || "general").replace(/^#/, "") && c.type === ChannelType.GuildText);
      if (!parent) throw new Error(`no channel #${channel}`);
      // With a topic, open a new thread; otherwise talk in the channel itself.
      t = topic ? await parent.threads.create({ name: topic.slice(0, 90), autoArchiveDuration: 1440 }) : parent;
    }
    const st = reg.threads[t.id] || mirrorState(t.id) ||
      (reg.threads[t.id] = { channel: t.isThread() ? t.parent?.name : t.name, mode: "conversation", cursor: {}, agents: {} });
    const notes = [];
    let a = agentsOf(st).find((x) => x.session === session);
    const same = agentsOf(st).filter((x) => x.harness === as && x.session !== session);
    if (!a && same.length && as === "claude" && !name) {
      // A new Claude session in a space that already has one is a handoff: it takes over.
      a = same[0];
      notes.push(`${a.name} handed over from session \`${a.session}\`.`);
      for (const l of reg.listeners) if (l.session === a.session && l.thread === t.id && !l.stopped) l.stopped = new Date().toISOString();
      a.session = session;
    }
    if (!a) {
      for (const x of same) if (x.name === HARNESS[as]) {
        x.name = qualified(as, x.session); x.labels.push(x.name);
        notes.push(`${HARNESS[as]} is now **${x.name}**.`);
      }
      const label = name || (same.length ? qualified(as, session) : HARNESS[as]);
      let key = st.agents[as] ? slug(label) : as;
      while (st.agents[key]) key += "-2";
      a = st.agents[key] = { key, harness: as, session, name: label, labels: [label] };
    }
    if (mode) st.mode = mode;
    else if (agentsOf(st).length > 2 && st.mode === "conversation") {
      st.mode = "addressed";
      notes.push(`More than two agents here, so this space is now in addressed mode: name who should answer or say "everyone".`);
    }
    reg.listeners.push({ harness: as, key: a.key, session, channel: st.channel, thread: t.id, since: new Date().toISOString() });
    const card = await send(t, "Relay", [`**${a.name}** is listening. Session \`${session}\` · mode ${st.mode}`, ...notes].join("\n"));
    st.cursor[a.key] = card.id;
    save();
    return { thread: t.id, name: t.name, channel: st.channel, mode: st.mode, as: a.key, label: a.name };
  },
  async "POST /stop"({ as, session, thread: tid }) {
    for (const [id, st] of Object.entries(reg.threads)) {
      if (tid && id !== tid) continue;
      for (const a of agentsOf(st)) {
        if (a.session !== session || (as && a.key !== as && a.harness !== as)) continue;
        delete st.agents[a.key];
        await send(await fetchSpace(id), "Relay", `${a.name} stopped listening.`).catch(() => {});
      }
    }
    for (const l of reg.listeners) if (l.session === session && !l.stopped) l.stopped = new Date().toISOString();
    save();
    return { ok: true };
  },
  async "POST /post"({ as, session, thread: tid, text, notify }) {
    if (!as || !text) throw new Error("need --as and text");
    const st = reg.threads[tid];
    let label = HARNESS[as];
    if (st && (st.agents[as] || agentsOf(st).some((a) => a.harness === as))) label = resolve(st, as, session).name;
    if (!label) throw new Error(`unknown agent ${as}`);
    const m = await send(await fetchSpace(tid), label, text, !!notify);
    return { id: m.id, as: label };
  },
  async "POST /pass"({ as, session, thread: tid }) {
    const st = reg.threads[tid];
    if (st) queueOf(tid).finish(resolve(st, as, session).key);
    return { ok: true };
  },
  async "POST /mode"({ thread: tid, mode }) {
    if (!["conversation", "addressed"].includes(mode)) throw new Error("mode: conversation | addressed");
    if (!reg.threads[tid]) throw new Error("no listeners in that space");
    reg.threads[tid].mode = mode; save(); return { mode };
  },
  async "GET /read"({ thread: tid, limit }) {
    const ms = await (await fetchSpace(tid)).messages.fetch({ limit: Math.min(Number(limit) || 20, 100) });
    return { messages: [...ms.values()].reverse().map((m) => `${speaker(m)}: ${bodyOf(m)}`) };
  },
  async "GET /presence"({ thread: tid }) {
    return { listeners: reg.listeners.filter((l) => !tid || l.thread === tid).slice(-20), threads: tid ? { [tid]: reg.threads[tid] } : reg.threads };
  },
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, L.HUB);
  const route = routes[`${req.method} ${url.pathname}`];
  let body = "";
  for await (const c of req) body += c;
  try {
    const args = { ...Object.fromEntries(url.searchParams), ...(body ? JSON.parse(body) : {}) };
    if (!route) throw new Error("unknown route");
    if (!client.isReady()) throw new Error("hub not connected to Discord yet");
    res.end(JSON.stringify(await route(args)));
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(C.port, "127.0.0.1", () => log(`API on ${L.HUB}`));   // localhost only

client.once("clientReady", () => { log(`Discord connected as ${client.user.tag}`); catchUp(); });
client.login(token);
