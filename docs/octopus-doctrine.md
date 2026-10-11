# The Octopus Doctrine: spending usage on purpose

Running two agents costs more than running one. The Octopus Doctrine is how this setup keeps that cost bounded and spends it where it pays off. It's an operating model, not a feature of the code: Chasqui only makes it easier to follow.

> An octopus doesn't thrash. The head stays still and decides; one arm moves exactly as far as needed.

## The five principles

1. **Head decides, arms read.** One session (the head) plans, decides and synthesises. Other sessions (the arms) do the reading, drafting, reviewing and fixing, then report a short conclusion. The head never pulls large files into its own context when an arm can read them and return the answer. The most expensive context stays small.

2. **Quota is a hard boundary.** Set a budget first, whether that's tokens, a share of a subscription, or a daily cap, and scope the work to fit it. When the budget runs low, ship the most valuable complete piece and stop cleanly. Never leave everything half-finished.

3. **Match rigour to stakes.** A quick question gets one agent and a quick answer. A production change gets a plan, a build pass and an independent review. Running every task through a review loop wastes usage; skipping review on risky work wastes more, in rework.

4. **Fewer moves, same quality.** Batch the work: one plan, one execution pass, one report. No play-by-play updates, no reopening settled decisions, no reviewing the same thing twice.

5. **Structure carries the load, not context.** Put the state of the work in files, such as a scope document, a review note or a test log, not in a long conversation. Any session can pick up from the file without replaying the whole chat. That keeps each session's context short and cheap.

## How Chasqui applies it

| Principle | What Chasqui does |
|---|---|
| Head decides, arms read | Each agent keeps its own session and context. Nothing is re-pasted between tools, so each agent pays only for what it needs. |
| Quota is a boundary | Agents wake only when a message is for them. In addressed mode (the default with three or more agents), nobody responds unless named. |
| Match rigour to stakes | Use a review loop for work that would be expensive to get wrong, and a single agent for everything else. |
| Fewer moves | Agents can **pass** a turn instead of replying, and the conversation rules ask for short replies with the work in files. |
| Structure carries the load | Transcript sharing (opt-in) gives a bounded excerpt of what changed, instead of re-explaining it in chat. |

## Will this use up my plan faster?

Yes, if every agent answers every message. That's why the defaults point the other way. To keep usage low:

- **Use addressed mode** in busy channels, and name the agent you want.
- **Give each agent one job.** A reviewer reviews; it doesn't redo the drafting.
- **Keep messages short, and put the work in files.** Long chat replies are paid for again by every agent that reads them.
- **Cap the rounds.** One draft, one review and one fix is usually enough. Stop when the reviewer finds nothing material.
- **Pause listeners you don't need.** `stop` an agent when its part is done.

What you get for the extra usage is review that happens before mistakes are expensive. In our first sessions, the reviewing agent caught a privacy leak, a misleading demo control and an incorrect claim before any of them shipped. Catching one of those after release would have cost more than the review did.

## How it compares

**Similar to:** the orchestrator–workers pattern, described in Anthropic's [Building effective agents](https://www.anthropic.com/research/building-effective-agents) and used in its [multi-agent research system](https://www.anthropic.com/engineering/built-multi-agent-research-system), and called a "supervisor" in frameworks such as LangGraph. In both, a lead agent plans and synthesises, workers explore in their own context and return compressed results, and effort scales with the difficulty of the task.

**Different in four ways:**

1. **Budget first.** Most frameworks optimise for the best answer and treat cost as a side effect. Here the usage budget is set before the work starts, and the scope shrinks to fit it.
2. **Fixed caps on parallelism.** There's a small, explicit limit on how many agents work at once, and deployments, migrations and other irreversible steps always run one at a time.
3. **Workers are persistent sessions.** The arms are long-lived Claude Code and Codex sessions, each with its own memory, tools and subscription. They aren't short-lived subagents inside one program.
4. **The human holds the irreversible decisions.** Agents can prepare anything, but sending, publishing, deploying and spending need the human's explicit approval.
