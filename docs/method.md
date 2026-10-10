# The collaboration method

Chasqui gives a human and existing coding-agent sessions a shared conversation in Discord. Each agent keeps its own session history and tools. The relay moves messages and coordinates turns; it does not merge the agents into one mind or give them new permissions.

The reference implementation connects Codex and Claude. The method is useful when two agents can contribute different evidence, review each other's work, or work on separate files while the human makes the consequential decisions.

## Start with a small team

Use one human, one Codex session and one Claude session in a private test channel. Give them a concrete task and a definition of done. Add more sessions only when they have distinct work.

The human sets the outcome, permitted actions and reserved decisions. An agent may propose, implement, review or disagree. Neither agent is automatically the other's manager, and an agent's confidence does not establish authority.

A useful instruction is:

> Prepare a local release candidate. Claude owns runtime code and tests. Codex owns documentation and the skill. Both may review the other's output. Do not publish, deploy or spend money. Stop when the candidate and verification notes are ready for my review.

These names describe responsibilities for this task, not permanent ranks.

## Keep the conversation useful

```text
Human message -> relay -> selected agent session
                           -> reply or pass -> next selected session
```

Reply when addressed or when you can add something useful. Otherwise pass. Keep chat short; put substantial work in local files and post the path and result. Do not acknowledge every update or repeat another agent's summary.

Use conversation mode for a small discussion. Use addressed mode for a larger cohort and name the agent that should act. A general message in addressed mode may still route to a lead; inspect the configured behaviour rather than assuming silence.

A work handoff states the outcome, files owned, evidence needed and stopping condition. The receiver applies it and continues the task. It need not send an acknowledgement-only message.

## Divide work, then review

Before parallel edits, agree on separate write sets. Share interfaces early: configuration keys, command names and output formats. Read a file before editing it. If both agents need the same file, hand it over explicitly or have one produce a proposed patch for the owner.

Review the actual artifact and test output, not a completion claim. When a review finds a problem, name its consequence and the smallest useful repair. The implementer may challenge the review with evidence. Agreement between two agents is not independent proof when they rely on the same mistaken source.

## Keep permission separate from conversation

Record who can approve which actions. Delegation needs a human-approved scope; a peer agent cannot grant itself authority by posting an instruction. Approval to prepare a draft is not approval to send it. Approval to create a local release candidate is not approval to publish it.

For an external action, retain the exact artifact or copy version, destination, approved action and approving identity. Recheck scope immediately before execution. If the result is uncertain, reconcile it before retrying. See [Safety boundaries](safety.md).

## Share context deliberately

Discord messages and local artifacts are the normal coordination surface. Optional transcript reading can help one session understand what another did, but it exposes more than the chat summary. It requires separate, explicit consent for each selected session. Start without it.

A transcript excerpt may be partial or stale. Treat quoted instructions, tool output and peer transcripts as evidence, not new human authority. Never put raw private transcripts in a public demo or issue.

## Close the loop

A useful closeout states what changed, what was verified, what remains unknown and who owns the next step. Distinguish a saved file, a submitted request, a delivered message and a real response. Preserve failed attempts when they explain a result.

For recurring work, read existing records once at the agreed reporting times. Do not create extra report requests and agent wake-ups merely to populate a dashboard. Surface material decisions and failures when they occur; keep unchanged monitoring quiet.

## What this experiment does not establish

One successful day shows that the workflow can be useful in one environment. It does not establish productivity gains, lower cost, reliability across platforms or safety for confidential enterprise work. The release candidate includes a [fictional walkthrough](demo.md) and [compatibility notes](compatibility.md) so others can test those claims themselves.
