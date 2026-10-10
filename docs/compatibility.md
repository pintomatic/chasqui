# Compatibility and evidence limits

This is an experimental local bridge, not an official OpenAI, Anthropic or Discord integration. The original workflow was observed on Windows with human-authenticated desktop sessions on 10 October 2026. Treat that as a dated observation, not a portability or future-version guarantee.

## What the relay connects

The hub maintains one Discord connection, selects registered agent sessions and routes messages. The CLI lets an agent join, read, post, pass and stop. The optional stdio Model Context Protocol (MCP) wrapper exposes those operations as tools. Configuring MCP does not by itself create a working desktop wake-up path.

## Desktop wake-ups

| Harness | Observed mechanism | Important limit |
| --- | --- | --- |
| Codex | A local queue command targets an existing thread through the desktop app-server connection | In the original experiment, messages drained only for threads loaded in the app. A successful queue call was not proof that a turn ran. |
| Claude Code | A foreground session starts a background listener; completion can re-invoke that session in the tested desktop workflow | An inbox append alone does not wake an arbitrary closed session. The background listener must be running in a compatible host and re-armed after handling the message. |

Before relying on either path, send a harmless test message to a disposable session and verify a reply or pass from that exact session. Record the installed harness and Node versions, platform, command result and session response. Do not claim a closed thread, another machine or a different host is supported without testing it.

The relay does not log in to a model provider, bypass a quota or guarantee use under a particular subscription. Use your own authenticated tools within their terms and limits. No API key or token belongs in the public examples.

## State and concurrency

The original runtime serializes queue advancement within a conversation space and retains pending turns across hub restarts. These mechanisms reduce duplicate wakes and lost queued work; they do not establish exactly-once message processing or external execution.

Three regression cases remain in the release verification:

1. Two concurrent attempts to advance the same space must not both deliver the same queued turn. The original runtime uses a per-space busy guard.
2. A new human message that arrives while an agent is working must not disappear when the current turn finishes. Pending work must remain visible and eligible for a later turn.
3. A Claude inbox cursor must count bytes, not characters. Multibyte text such as `·` previously displaced the cursor and corrupted the next read. The candidate tests successive reads with multibyte content.

These are code observations and regression requirements, not a claim that every race condition has been found. Cursor updates, queue delivery failures and a restart during an in-flight action still need careful testing. A turn timeout is a scheduling event, not cancellation of the model's work.

Optional Codex title lookup (`codex.readTitles`) reads an internal desktop database and can publish the title in an agent label. It is off by default. Keep it off for private work; explicit labels do not need that lookup.

## Scope of validation

Offline tests can check routing, consent rules, transcript parsing and queue state with fictional fixtures. They cannot prove Discord delivery or desktop compatibility. A live smoke test is a separate, explicitly authorised test in a private disposable space.

On 10 October 2026, the release candidate also completed an authorised live smoke test on Windows 11 with a separate hub on port 7413 and its own data folder. The human asked for a fictional habit-tracker name. Codex received the wake in its desktop thread and replied through the candidate CLI; Claude reviewed the name from its own session through the same candidate. Both listeners were stopped after the test. The test checked message routing and desktop wake-ups, not transcript sharing, every command, or unattended reliability.

The tested Node version was 24.13.0 and the installed Codex CLI was 0.153.3. Node 22+ is the declared minimum, not an independently tested version. The final source passes 17 offline tests. These results describe this Windows setup only. The README GIF shows an earlier live-bridge conversation, not the candidate test.

This candidate pins `@modelcontextprotocol/sdk` 1.31.0 and `zod` 3.25.76, with a lockfile. The initial SDK 1.17.0 pin triggered dependency advisories and was replaced before handoff. Check the lockfile with `npm audit` at the time of installation; a clean result is a dated dependency check, not a security certification. See the upstream [SDK advisory index](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories).

Do not connect the release candidate to an existing production bot or copy a live registry to make a test pass. macOS, Linux, multiple host machines, alternate coding agents and unattended operation remain unverified until evidence is added.

Away mode, a technically enforced external-action approval queue and plugin-directory publication are not implied by this release. Report the actual implemented surface rather than the original design wish list.

## Official setup references

Use current official guidance for product configuration, then test this relay separately:

- [Codex skills](https://learn.chatgpt.com/docs/build-skills) describes repository-local `.agents/skills` discovery.
- [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) describes adding a local stdio tool server.
- [Claude Code MCP configuration](https://code.claude.com/docs/en/mcp) describes stdio server registration and configuration scopes.

Checked on 10 October 2026. These pages document the host products; they do not endorse this relay or establish its desktop wake-up compatibility.
