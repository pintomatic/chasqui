// Configuration: chasqui.config.json (optional) plus environment variables.
// Secrets come only from the environment (.env); the config file holds no secrets.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
require("dotenv").config({ path: process.env.CHASQUI_ENV || path.join(ROOT, ".env"), quiet: true });

const expand = (p) => (p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p);

const DEFAULTS = {
  port: 7313,
  dataDir: "./data",
  ownerName: "the owner",
  turnTimeoutMinutes: 5,
  // One line every wake-up carries. Prompts are guidance, not enforcement.
  policyLine: "Do not send, post or publish anything outside this Discord server unless the owner approved that exact action in this conversation.",
  mirrors: null,                 // path to a mirrors JSON written by scripts/sync-channels.js
  codex: { cli: null, readTitles: false },  // cli: codex.js or executable, auto-detected when null; readTitles: label Codex agents from the desktop DB
  transcripts: {
    // Reading another session's transcript is off unless enabled AND the session consented.
    enabled: false,
    claudeRoots: ["~/.claude/projects"],
    codexRoot: "~/.codex/sessions",
  },
};

function load(file = process.env.CHASQUI_CONFIG || path.join(ROOT, "chasqui.config.json")) {
  let user = {};
  if (fs.existsSync(file)) user = JSON.parse(fs.readFileSync(file, "utf8"));
  const c = { ...DEFAULTS, ...user,
    codex: { ...DEFAULTS.codex, ...user.codex },
    transcripts: { ...DEFAULTS.transcripts, ...user.transcripts } };
  c.port = Number(process.env.CHASQUI_PORT || c.port);
  c.dataDir = path.resolve(ROOT, expand(process.env.CHASQUI_DATA || c.dataDir));
  c.mirrors = c.mirrors && path.resolve(ROOT, expand(c.mirrors));
  c.transcripts.claudeRoots = c.transcripts.claudeRoots.map(expand);
  c.transcripts.codexRoot = expand(c.transcripts.codexRoot);
  c.discord = {
    token: process.env.DISCORD_BOT_TOKEN,
    guildId: process.env.DISCORD_GUILD_ID,
    ownerId: process.env.DISCORD_OWNER_ID,
  };
  return c;
}

// How to run `codex queue`. Spawned without a shell, so message text is never parsed by one.
function codexCommand(cli) {
  if (cli) return cli.endsWith(".js") ? [process.execPath, [cli]] : [cli, []];
  if (process.env.CODEX_CLI) return codexCommand(process.env.CODEX_CLI);
  if (process.platform !== "win32") return ["codex", []];
  // Windows: `codex` is a .cmd shim, which needs a shell. Use the npm package's JS entry instead.
  try {
    const root = execSync("npm root -g", { encoding: "utf8" }).trim();   // fixed command, no user input
    const js = path.join(root, "@openai", "codex", "bin", "codex.js");
    if (fs.existsSync(js)) return [process.execPath, [js]];
  } catch {}
  throw new Error("codex CLI not found; set codex.cli in chasqui.config.json or CODEX_CLI");
}

module.exports = { ROOT, load, codexCommand, expand };
