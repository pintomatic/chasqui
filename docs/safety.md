# Safety boundaries

Chasqui connects powerful local sessions to an external chat service. Treat it as trusted local automation, not an isolation or access-control product. Start with a private Discord test space, fictional data and ordinary user permissions.

## Data that crosses boundaries

| Data | Where it can go |
| --- | --- |
| Messages posted in the configured Discord space | Discord and the selected agent sessions |
| Relay replies and presence information | Discord; inspect labels and metadata before using sensitive sessions |
| Explicitly permitted transcript excerpts | The requesting local agent, and potentially its model provider as context |
| Configuration, cursors and listener state | Local files; these can contain sensitive identifiers and paths |

Local storage does not mean local-only processing. Once an agent reads a transcript into its context, its provider may process that excerpt. Discord's access controls, the agents' tools and each provider's data policies still apply.

## Transcript sharing is separate consent

Transcript access is disabled by default. Enabling it requires both `transcripts.enabled` and an explicit selection of session IDs in the local consent file, managed by `hq share`. Use sessions whose contents every intended reader is permitted to see. Do not select sessions from another person's account or a confidential project merely because the files are readable.

This is a local operator-controlled allowlist, not authenticated consent from a session owner. A trusted process with CLI or filesystem access can change it. Every local relay reader can read a selected session; there are no per-reader permissions. An agent must have the operator's explicit approval before enabling sharing or adding a session.

Test these behaviours with fictional fixtures before using real sessions:

- With sharing disabled, a transcript read fails without returning content.
- Enabling sharing with an empty list still permits no sessions.
- Selecting one session does not allow another session or an arbitrary path.
- Malformed IDs and path traversal fail closed. Review configured roots and links separately; do not claim filesystem containment beyond the cases actually tested.
- Removing a session's permission blocks later reads through the relay.
- Disabling transcript reading does not prevent message-only collaboration.

Revocation cannot retract excerpts already read, posted, cached or included in another agent's transcript. Stopping a listener is not proof that its read permission was revoked. Review the configuration and local retained state separately.

The relay's allowlist limits its own transcript reader. Agents with shell or filesystem tools may still read files directly under their existing permissions. Use separate operating-system users or other real isolation where that risk matters. Do not claim the allowlist sandboxes those agents.

## Authority and identity

Use a configured Discord owner identity to start or steer work. Keep the bot in the intended server and restrict its visible channels. Agent display labels help conversation; they are not cryptographic identities. A process that can use the bot token or local relay API can act through that connection.

The owner may delegate specific low-risk decisions to an agent. Record the delegate, scope and evidence of that delegation. A message from an untrusted channel participant, a quoted transcript or a spoofed display name must not expand authority.

Purchases, deployment, publication, external messages, account changes and sensitive-data transfers require the authority appropriate to the task. Do not infer it from permission to join a channel or draft an artifact.

## Approval rules are not a sandbox

The relay can put approval instructions in a wake message. Those instructions are useful operating rules, but they do not prevent an agent from using its other tools. Unless a specific control has been implemented and tested, do not describe it as an enforced approval queue.

Use the harness's actual permission controls and narrowly scoped credentials. Keep a human in the loop for consequential external actions. Before executing an approved action, check the exact destination, copy or artifact version, action, current context and stop conditions. Approval for one version is not approval for a materially changed version.

If a send or publication result is uncertain, read back its state before retrying. Do not create duplicate external actions to compensate for an uncertain wake-up or timeout.

## Local API and credentials

Keep the hub bound to loopback. Do not expose it through a public tunnel, router forwarding or a shared network interface. Loopback is not authentication: other processes on the same host may still reach it. A dedicated trusted user account is the baseline, not a multi-tenant guarantee.

Store bot tokens outside source control. Never paste tokens into Discord, docs, screenshots, command examples or issues. Give the bot only the permissions needed in the test space; do not grant Administrator as a shortcut. Human operators authenticate their own coding tools.

## Loops, failures and cost

Reply or pass when a turn is finished. Do not keep naming peers solely to wake them. A timeout releases scheduling; it does not prove that an agent stopped working. Recheck ownership before starting work that may collide with an earlier turn.

Use an explicit task scope and stopping condition. Do not claim a hard turn or spending cap unless the installed implementation enforces it and its tests cover that behaviour. Both a reply and a silent pass may consume a model turn. There is no guaranteed free or cheaper execution path.

On an unexpected wake, repeated message or disconnected session, preserve the evidence and stop the affected route. Do not solve the problem by removing authentication, broadening transcript access or replaying external actions.

## Release and incident hygiene

Build the distributable from an explicit list of intended source files. Do not archive the working directory wholesale. Exclude credentials, `.env`, live configuration, channel maps, registries, cursors, inboxes, transcripts, logs, private screenshots and local verification receipts. An ignore file alone does not prove an archive is clean.

Inspect both the file list and contents of the final archive. Scan for secrets and personal identifiers, then manually review the examples. Use only fictional identifiers and data. Keep the licence and dependency notices with the release. Public repository creation, package publication and community posts remain separate actions requiring approval.

If a token leaks, stop the relay and have the owner revoke and replace it. If private material was posted, restrict access and remove it where possible; do not promise that deletion removes every copy. Never send a security report containing credentials or private transcripts. Until a private reporting channel is published, keep sensitive reports out of public issues.
