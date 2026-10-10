// Chasqui MCP server (stdio): the same operations as the CLI, as MCP tools.
// Register it with CHASQUI_HARNESS=claude or CHASQUI_HARNESS=codex.
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const { hub, session } = require("./hq");
const L = require("./lib");

const AS = process.env.CHASQUI_HARNESS;
if (!["claude", "codex"].includes(AS)) { console.error("Set CHASQUI_HARNESS=claude|codex"); process.exit(1); }

const server = new McpServer({ name: "chasqui", version: "0.1.0" });
const ok = (v) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });
const tool = (name, description, shape, fn) =>
  server.tool(name, description, shape, async (args) => {
    try { return ok(await fn(args)); }
    catch (e) { return { isError: true, content: [{ type: "text", text: e.message }] }; }
  });

tool("listen", "Join a Discord thread or channel as this harness and receive wake-ups. Give a topic to open a new thread.",
  { session: z.string().describe("Your own session or thread UUID"), channel: z.string().optional(), topic: z.string().optional(),
    thread: z.string().optional(), mode: z.enum(["conversation", "addressed"]).optional(), name: z.string().optional() },
  (a) => hub("POST", "/listen", { as: AS, ...a }));
tool("post", "Post in a conversation as this agent. Set notify only when done, blocked or needing approval.",
  { thread: z.string(), text: z.string(), notify: z.boolean().optional(), as: z.string().optional().describe("Agent key, if several of this harness listen") },
  (a) => hub("POST", "/post", { ...a, as: a.as || AS }));
tool("pass", "Take your turn without speaking.", { thread: z.string(), as: z.string().optional() },
  (a) => hub("POST", "/pass", { ...a, as: a.as || AS }));
tool("read", "Read recent messages in a conversation.", { thread: z.string(), limit: z.number().optional() },
  async (a) => (await hub("GET", "/read", a)).messages.join("\n"));
tool("presence", "List listeners, past and present.", { thread: z.string().optional() }, (a) => hub("GET", "/presence", a));
tool("share", "Allow (or stop) other agents reading your session's transcript.",
  { session: z.string(), off: z.boolean().optional() }, async (a) => ({ sharing: L.setConsent(a.session, !a.off) }));
tool("read_session", "Read what a sharing session did since you last looked: prompts, replies, tool calls.",
  { id: z.string(), all: z.boolean().optional().describe("Ignore your read position and return the recent tail") },
  async (a) => session(a.id, AS, a.all));
tool("stop", "Stop listening.", { session: z.string(), thread: z.string().optional() }, (a) => hub("POST", "/stop", { as: AS, ...a }));

server.connect(new StdioServerTransport());
