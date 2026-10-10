// Point config and data at a throwaway directory before any src module loads.
const fs = require("fs");
const os = require("os");
const path = require("path");

function sandbox({ transcripts = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chasqui-test-"));
  const claudeRoot = path.join(dir, "claude", "projects");
  const codexRoot = path.join(dir, "codex", "sessions");
  fs.mkdirSync(path.join(claudeRoot, "proj"), { recursive: true });
  fs.mkdirSync(path.join(codexRoot, "2026", "10", "10"), { recursive: true });
  const config = path.join(dir, "config.json");
  fs.writeFileSync(config, JSON.stringify({
    dataDir: path.join(dir, "data"),
    transcripts: { enabled: true, claudeRoots: [claudeRoot], codexRoot, ...transcripts },
  }));
  process.env.CHASQUI_CONFIG = config;
  process.env.CHASQUI_ENV = path.join(dir, "none.env");
  delete process.env.CHASQUI_DATA;
  for (const k of Object.keys(require.cache)) if (k.includes(`${path.sep}src${path.sep}`)) delete require.cache[k];
  return { dir, claudeRoot, codexRoot };
}

module.exports = { sandbox };
