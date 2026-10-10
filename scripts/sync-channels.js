// Mirror Codex threads into Discord: one category per group, one channel per thread.
// Reads a layout file (see examples/layout.example.json) and writes the mirrors file
// the hub uses to wire each channel to its Codex thread. Idempotent.
//   node scripts/sync-channels.js <layout.json> [--dry-run]
// The bot needs the Manage Channels permission.
const fs = require("fs");
const { Client, GatewayIntentBits, ChannelType } = require("discord.js");
const L = require("../src/lib");

const [layoutFile] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = process.argv.includes("--dry-run");
if (!layoutFile) { console.error("usage: node scripts/sync-channels.js <layout.json> [--dry-run]"); process.exit(1); }
if (!L.C.mirrors) { console.error('Set "mirrors" in chasqui.config.json to the file the hub should read.'); process.exit(1); }
const LAYOUT = JSON.parse(fs.readFileSync(layoutFile, "utf8"));

const slug = (s) => s.toLowerCase().replace(/[()&.]/g, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(L.C.discord.guildId);
    const all = await guild.channels.fetch();
    const map = {};
    for (const [group, threads] of Object.entries(LAYOUT)) {
      let cat = all.find((c) => c?.type === ChannelType.GuildCategory && c.name === group);
      if (!cat) { console.log(`+ category ${group}`); if (!dry) cat = await guild.channels.create({ name: group, type: ChannelType.GuildCategory }); }
      for (const [i, { name, codexThread }] of threads.entries()) {
        if (!/^[0-9a-f-]{8,}$/i.test(codexThread)) throw new Error(`bad codexThread for "${name}"`);
        const chName = slug(name);
        const topic = `Mirrors Codex thread "${name}" (${codexThread}).`;
        let ch = all.find((c) => c?.type === ChannelType.GuildText && c.topic?.includes(codexThread));
        if (!ch) {
          console.log(`+ #${chName} in ${group}`);
          if (!dry) ch = await guild.channels.create({ name: chName, type: ChannelType.GuildText, parent: cat.id, topic, position: i });
        } else if (!dry && (ch.parentId !== cat.id || ch.name !== chName)) {
          console.log(`~ #${ch.name} -> ${group}/#${chName}`);
          await ch.edit({ name: chName, parent: cat.id, position: i });
        }
        if (ch) map[ch.id] = { name, codexThread, group, channel: chName };
      }
    }
    if (!dry) L.writeJson(L.C.mirrors, map);
    console.log(`${Object.keys(map).length} mirrored channels${dry ? " (dry run)" : `, written to ${L.C.mirrors}`}`);
  } catch (e) { console.error("error:", e.message); process.exitCode = 1; }
  client.destroy();
});
client.login(L.C.discord.token);
