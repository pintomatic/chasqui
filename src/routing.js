// Who a message is addressed to, and the turn queue that wakes agents one at a time.
// Pure logic, no Discord: tested in tests/routing.test.js and tests/turns.test.js.

const EVERYONE = /(?<![\p{L}\p{N}])(everyone|all of you|both of you|you all|y'all)(?![\p{L}\p{N}])/iu;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const word = (w) => `(?<![\\p{L}\\p{N}])${esc(w)}(?![\\p{L}\\p{N}])`;
const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").slice(0, 40);

// Words that address an agent: its full label, the part after "·", that part's
// last word, and its harness name (which addresses every agent of that harness).
function aliases(a) {
  const short = a.name.split("·")[1]?.trim();
  const last = short?.split(/\s+/).pop().replace(/[^\p{L}\p{N}-]/gu, "");
  return [...new Set([a.name, short, last && last.length > 2 ? last : null, a.harness]
    .filter(Boolean).map((s) => s.toLowerCase()))];
}

// Agent keys named in `text`, in order of first mention. With `lineStart`, a name
// counts only at the start of a line followed by "," or ":", or as @name anywhere.
// Agents use lineStart so that mentioning a peer in passing doesn't wake it.
function named(agents, text, lineStart = false) {
  const hits = [];
  for (const a of agents) {
    for (const al of aliases(a)) {
      const re = lineStart
        ? new RegExp(`(^|\\n)\\s*@?${esc(al)}\\s*[,:]|@${esc(al)}(?![\\p{L}\\p{N}])`, "iu")
        : new RegExp(word(al), "iu");
      const i = text.search(re);
      if (i >= 0) { hits.push([a.key, i]); break; }
    }
  }
  return hits.sort((x, y) => x[1] - y[1]).map(([k]) => k);
}

// Wake order for a message from the owner.
//  conversation mode: named agents first, then everyone else (least recent speaker first).
//  addressed mode: only named agents, or everyone on "everyone"; if nobody is named,
//  the lead (first Claude agent, else the last speaker) answers.
function wakeOrder(agents, text, { mode = "conversation", last } = {}) {
  const first = named(agents, text);
  const rest = agents.map((a) => a.key).sort((x, y) => (x === last) - (y === last));
  let order = mode === "addressed" && !EVERYONE.test(text) ? first : [...first, ...rest];
  if (!order.length) {
    const lead = agents.find((a) => a.harness === "claude")?.key || last || agents[0]?.key;
    if (lead) order = [lead];
  }
  return [...new Set(order)];
}

// One turn at a time per conversation. `wake(key)` resolves true if it delivered
// something (the agent now holds the turn) or false if there was nothing new.
// An agent finishes its turn by posting or passing (`finish(key)`), or on timeout.
class TurnQueue {
  constructor(wake, { timeoutMs = 5 * 60_000, onChange = () => {} } = {}) {
    Object.assign(this, { wake, timeoutMs, onChange, queue: [], active: null, busy: false });
  }

  enqueue(keys) {
    // An agent that is mid-turn is queued again so it later sees messages that arrived meanwhile.
    for (const k of keys) if (!this.queue.includes(k)) this.queue.push(k);
    this.onChange(this.queue);
    if (!this.active && !this.busy) return this.advance();
  }

  finish(key) { if (this.active?.key === key) return this.advance(); }

  async advance() {
    if (this.active) clearTimeout(this.active.timer);
    this.active = null;
    // Only one advance runs at a time; overlapping runs used to deliver the same messages twice.
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.queue.length) {
        const key = this.queue.shift();
        this.onChange(this.queue);
        let woke = false;
        try { woke = await this.wake(key); } catch {}
        if (woke) {
          const timer = setTimeout(() => this.finish(key), this.timeoutMs);
          timer.unref?.();
          this.active = { key, timer };
          return;
        }
      }
    } finally { this.busy = false; }
  }
}

module.exports = { EVERYONE, slug, aliases, named, wakeOrder, TurnQueue };
