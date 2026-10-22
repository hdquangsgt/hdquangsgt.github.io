---
title: 'Understanding Thinking Effort in AI Agents: What Developers Need to Know'
description: 'A slide-based guide to reasoning effort for developers who use LLM APIs and coding agents: what the setting changes, how it differs from the agent loop, when more effort helps, and how to measure it instead of guessing.'
pubDate: 2026-10-22T09:00:00+07:00
category: AI Agents
tags: [thinking-effort, reasoning, ai-agents, evaluation, llm-api]
featured: false
draft: false
slides: true
---

## Understanding Thinking Effort in AI Agents

<p class="slide-kicker">Part I · Challenge common assumptions</p>

**Why asking an AI to think harder does not always produce better results.**

What does a thinking-effort setting actually change, and when should you raise it? This deck follows that question through 18 slides: the concept, the difference between reasoning and agent execution, real engineering scenarios, and a way to decide with evidence instead of intuition.

![An agent at the left sends one task down three lanes. The top lane is a short direct path to a fast answer. The middle lane weighs one alternative and drops it. The bottom lane is a thick path with several branches, two dead ends and a verification step before a verified result.](./images/effort-cover-paths.svg "One task, three levels of reasoning effort. A conceptual illustration, not a measurement.")

<div class="callout article-only">

**How to read this article.** Claims carry labels: <span class="label documented">Documented</span> comes from the official docs linked beside it, <span class="label opinion">Opinion</span> is my interpretation, and <span class="label proposal">Proposal</span> is an architecture I recommend, not something a vendor ships. Diagrams are conceptual unless a caption says otherwise. API facts were checked against the vendors' documentation on October 22, 2026; model names and accepted values change often, so check the linked pages before you copy anything.

</div>

## Same Model. Same Prompt. Different Outcomes?

<p class="slide-kicker">Part I · Challenge common assumptions</p>

You run what looks like the same request twice and get a clean answer once and a confused one the next time. Before blaming a setting, list everything that moved. Some tasks have one obvious path and are solved directly. Others have several plausible paths, and the answer improves when the system deliberates or collects more evidence.

![Left: a straightforward task, renaming a config key, follows one path to a passing build. Right: a complex task, a flaky test, branches into three unverified hypotheses that need evidence before a cause is identified. Below, six chips list factors that change the outcome, with configuration including effort as only one of them.](./images/effort-why-results-vary.svg "A simple task has one path. A complex task has several, and evidence decides between them. Effort is one factor among six.")

- **Task complexity and ambiguity** change how many reasonable answers exist.
- **Available context and tool outputs** decide what the model can actually know.
- **Sampling randomness** means two runs of the same prompt can diverge.
- **Model behavior and configuration** matter, and effort is only part of configuration.

<div class="takeaway">

Do not attribute a bad result to effort until you have ruled out missing context, a weak tool result and plain variance.

</div>

## Higher Thinking Effort Does Not Automatically Mean Better Intelligence

<p class="slide-kicker">Part I · Challenge common assumptions</p>

Three assumptions are common, and each is wrong in a useful way:

1. **"Higher effort always gives a better answer."** It can help on some tasks. It does not guarantee correctness, and on easy tasks it mostly adds cost.
2. **"Longer thinking means deeper, more accurate reasoning."** Length is not quality. A long chain of reasoning can be long and wrong.
3. **"More agent steps make a more capable agent."** More steps can compound errors as easily as they fix them.

![A problem enters a dashed region labeled more reasoning equals wider exploration, containing four hypotheses and a compare-and-prune step. The output is a conclusion that is not guaranteed correct. Three boxes below, evidence available, model capability and task constraints, also feed the conclusion. A note says missing evidence is a wall that more reasoning cannot cross.](./images/effort-reasoning-vs-evidence.svg "Reasoning widens the search. The conclusion still depends on evidence, capability and constraints.")

<div class="callout documented">

<span class="label documented">Documented</span> Anthropic's own guidance for its most capable effort level warns that on some workloads it "adds significant cost for relatively small quality gains" and can lead to overthinking on less demanding tasks ([Anthropic: Effort](https://platform.claude.com/docs/en/build-with-claude/effort)).

</div>

## Thinking Effort Is About Reasoning Resources, Not Just Waiting Longer

<p class="slide-kicker">Part II · Technical fundamentals</p>

Thinking effort is a **model- or platform-specific control, where one exists,** that influences how much effort goes into reasoning about a task. It is a setting on the public API. It is not a window into the model.

![On the left, the public API inputs: the task and context, and an effort setting such as low to high. In the middle, a dashed region labeled model inference, internals vary and are not exposed, with three question-marked boxes: reasoning behavior, computation spent, other inference choices. On the right, the public outputs: the answer, an opt-in reasoning summary that is not a raw trace, and a usage report with reasoning tokens billed.](./images/effort-what-is-it.svg "What you can set and observe is the API surface. What happens inside depends on the model and is not specified by the setting.")

<div class="callout documented">

<span class="label documented">Documented</span> What the vendors say, in their own words:

- OpenAI: reasoning tokens are billed as output tokens, count toward `max_output_tokens`, and appear in `usage.output_tokens_details.reasoning_tokens`. The raw reasoning is not returned; a summary is opt-in ([OpenAI: Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)).
- Anthropic: effort is "a behavioral signal, not a strict token budget", and it affects all output tokens, including text and tool calls, not only thinking ([Anthropic: Effort](https://platform.claude.com/docs/en/build-with-claude/effort)).
- Google: `thinking_level` accepts different levels per model, and thought summaries are opt-in ([Gemini: Thinking](https://ai.google.dev/gemini-api/docs/thinking)).

</div>

So the same word means different things on different APIs. Do not assume a fixed number of tokens, steps or compute per level.

## Task Complexity Should Influence Reasoning Effort

<p class="slide-kicker">Part II · Technical fundamentals</p>

![Side by side. Task A, converting a JSON object to a TypeScript interface, is three boxes in a straight line ending in an interface declaration. Task B, an intermittent race condition, starts at a symptom, branches into lock ordering, stale cache and duplicate retry hypotheses, merges at cross-component evidence from traces, logs, timing and a repro, and ends at a narrowed cause. A note below says complexity is not the only axis: a simple task with severe consequences can still deserve careful reasoning.](./images/effort-task-a-vs-b.svg "Task A has one checkable path. Task B has several hypotheses that need cross-component evidence.")

**Task A** converts a JSON object into a TypeScript interface. The output is checkable at a glance. Extra deliberation rarely changes it.

**Task B** is an intermittent race condition in a distributed system. Here deliberate reasoning can pay off: comparing hypotheses, considering edge cases, and connecting behavior across components.

But complexity is not the only axis. A short task with severe consequences, such as a production data migration, can justify careful reasoning, extra checks, or human review even though it is simple to state.

## Model Reasoning and Agent Execution Are Different Things

<p class="slide-kicker">Part II · Technical fundamentals</p>

![Two panels. A: one model invocation with an input, an internal reasoning stage where the effort setting applies, and an output, with no tools involved. B: an agent loop outside the model with model call 1, a tool call that runs the tests, an observation of two failing tests, model call 2, and a stop condition, with a dashed arrow repeating the loop until stop.](./images/effort-vs-agent-loop.svg "Left, reasoning inside one model call. Right, an external loop of model calls, tool calls and observations. The dashed arrow animates when motion is allowed.")

**Thinking effort** is the reasoning applied during *one* model invocation, when the model and API support such a control.

**The agent loop** is the external cycle: the model receives context, produces a response or a tool call, receives the tool result, and continues until a stopping condition is met ([ReAct](https://arxiv.org/abs/2210.03629) is the classic description of interleaving reasoning with actions).

They vary independently. One invocation can involve a lot of reasoning and no tools. An agent can make dozens of tool calls while each individual step is simple.

## An AI Agent Is More Than a Model

<p class="slide-kicker">Part II · Technical fundamentals</p>

The conceptual flow: user task and context → model reasoning → decision to answer or call a tool → tool execution → updated context → next decision. It repeats until the task is done or a stopping condition fires.

![The agent loop in three tinted layers. Orchestration layer: 1, task and context; stop rules; 5, updated context. Model layer: 2, reasoning, highlighted as the only place reasoning effort acts, and 3, a decision between answering and calling a tool. Execution layer: 4, tool execution. An answer passes a dashed verification checkpoint that straddles the layers, then the stop rules, then returns the final answer. A tool call goes to tool execution, whose result becomes updated context, which feeds 6, the next decision, back into reasoning.](./images/effort-agent-flow.svg "Six steps in three layers. Only step 2 is affected by reasoning effort. The dashed, animated arrows are the loop; verification is a checkpoint, not a layer.")

Effort acts on one step of this loop, the reasoning inside the model call. Overall performance also depends on context quality, which tools exist, how the harness orchestrates retries and stopping, and whether anything verifies the result.

<div class="callout documented">

<span class="label documented">Documented</span> Anthropic's [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) makes the related point that agentic systems trade latency and cost for task performance, so the added complexity should be justified.

</div>

## Different Effort Levels Represent Different Trade-Offs

<p class="slide-kicker">Part II · Technical fundamentals</p>

![Four qualitative tracks, each from lower to higher, with a ring marking lower effort and a square marking higher effort. On a hard task, the higher setting sits further toward better quality. On a simple task, the two markers are close together. For latency and for cost, the higher setting sits further toward higher.](./images/effort-low-vs-high.svg "A qualitative chart. Marker positions show tendencies only; they are not benchmark results.")

| | Lower effort | Higher effort |
| --- | --- | --- |
| Latency | tends to be lower | tends to be higher |
| Cost | tends to be lower | tends to be higher |
| Hard, multi-step tasks | may be less thorough | may be more thorough |
| Simple tasks | usually fine | little gain, still costs more |

**These are tendencies, not guarantees.** How large each gap is depends on the model, the task and the metric. This article gives no numeric improvements because none would generalize; slide 15 shows how to produce your own.

## When Is Higher Thinking Effort Worth It?

<p class="slide-kicker">Part III · Real engineering scenarios</p>

An API intermittently returns HTTP 500. A model with more reasoning effort may be better at holding several hypotheses at once, checking dependencies and considering edge cases. It still cannot read logs nobody collected.

![Left: a symptom, intermittent HTTP 500. Middle: four dashed hypothesis boxes, database pool exhausted, upstream timeouts, cache stampede, and one instance on an old build. Right: solid evidence boxes. Database wait times are normal, which refutes the first. Upstream traces succeed, which refutes the second. No cache miss spike refutes the third. Logs show 500s only on instance 3, which supports the fourth. That leads to a verified fix, rolling back instance 3. A separate warning box says reasoning cannot replace evidence nobody collected, such as missing logs from instance 5.](./images/effort-incident-evidence.svg "Dashed boxes are hypotheses. Solid boxes are observed evidence. Only the fix that was verified counts as resolved.")

A good workflow alternates reasoning with observation:

1. Generate hypotheses, and say which evidence would confirm or refute each.
2. Collect that evidence (logs, metrics, traces).
3. Update the hypotheses. Drop what the evidence refutes.
4. Apply a fix, then verify the symptom is gone.

<div class="takeaway">

More reasoning helps you *use* evidence. It cannot create evidence that was never collected.

</div>

## A One-Line Change and a System-Wide Refactor Do Not Need the Same Strategy

<p class="slide-kicker">Part III · Real engineering scenarios</p>

![A spectrum from narrow and local to broad and uncertain with three task cards. 1: rename a local variable, needing a scope-aware rename and unchanged tests. 2: refactor authentication middleware, with caller dependencies, security implications, backward compatibility and test coverage. 3: investigate a post-deploy regression, with code diffs, logs and errors, test results and recent changes. A note says no effort level is universally right for a category.](./images/effort-coding-task-spectrum.svg "Three coding-agent tasks along an illustrative spectrum of coupling, uncertainty and consequence.")

- **Rename a local variable.** Mostly mechanical. A compiler or the test suite settles it.
- **Refactor authentication middleware.** Reasoning has to cover callers, security implications, backward compatibility and the tests that prove behavior is preserved.
- **Investigate a regression after deployment.** Reasoning is only as good as what it can read: the diff, the logs, the test results and the recent change history.

<div class="callout opinion">

<span class="label opinion">Opinion</span> Treat the ordering as a starting hypothesis, not a rule. A rename can be risky in a dynamic language, and a hard regression can end up needing evidence more than deliberation.

</div>

## Choose the Right Mechanism for the Problem

<p class="slide-kicker">Part III · Real engineering scenarios</p>

When an agent gets something wrong, "think harder" is one of several levers, and not always the right one.

![A decision tree. The root asks what actually failed. Four branches: shallow analysis despite having the facts leads to raising reasoning effort. Missing facts not in context leads to adding a tool or retrieval. A plan contradicted by a test or log leads to running another iteration with the new evidence. A task that is too broad leads to decomposing it with better orchestration. A bottom box says these interventions complement each other, and a note says to read the trace and add a verification step if unsure what failed.](./images/effort-decision-tree.svg "Map the failure mode to the intervention. The interventions combine; they do not compete.")

- If the model has not weighed the available hypotheses, **more reasoning effort** may help.
- If it lacks repository information, **a search tool** will help more than more thinking.
- If a test result contradicts the initial hypothesis, **another agent iteration** with that result is the right move.
- If the task is too broad, **decomposition** helps more than any single setting.

## A Convincing Explanation Is Not Proof of Correctness

<p class="slide-kicker">Part III · Real engineering scenarios</p>

Models can produce plausible but wrong conclusions because of incomplete information, faulty assumptions or other limits. The fluency of an explanation says little about whether it is true.

<div class="callout documented">

<span class="label documented">Documented</span> Research on reasoning models found that their stated reasoning often omits factors that actually influenced the answer, so reading the explanation is not a reliable audit ([Chen et al., 2025](https://arxiv.org/abs/2505.05410)).

</div>

![Top lane: a fluent model proposal reads well but no check ran, so it is accepted on trust with unknown status. Bottom lane: the model proposal passes through six checks, automated tests, type check and lint, diff review, logs and run output, acceptance criteria and security checks. A pass records evidence. A fail sends feedback back to the model through a dashed revise-and-re-check arrow.](./images/effort-verification-flow.svg "Top: plausible but unverified. Bottom: the same proposal checked by executable evidence, with failures fed back.")

For coding agents, verification means concrete mechanisms: automated tests, type checking and linting, reading the generated diff, inspecting logs and execution results, checking acceptance criteria, and running security checks where appropriate. Evaluate the quality of those checks independently of how deep the reasoning looked.

## Quality, Latency, and Cost

<p class="slide-kicker">Part IV · Production systems</p>

![A triangle with quality at the top, latency at the bottom left and cost at the bottom right. Three illustrative workloads are placed inside: interactive autocomplete leaning toward latency, an overnight migration agent leaning toward quality, and high-volume classification leaning toward cost. A note says positions are conceptual and there is no single universal metric.](./images/effort-tradeoff-triangle.svg "Three dimensions pull against each other. Where a workload sits is a product decision. Positions here are conceptual.")

- **Quality:** correctness, task completion, robustness and edge-case handling.
- **Latency:** response time, and the total time to complete a task.
- **Cost:** model usage, reasoning-related inference cost where it applies, tool calls, and above all the *total cost per successful task*.

The goal is not maximum quality at any price, or minimum latency at any cost. It is an acceptable trade-off for the workload and its business requirements. The three do not reduce to one universal score.

## Do Not Default to Maximum Effort for Every Request

<p class="slide-kicker">Part IV · Production systems</p>

An adaptive strategy treats effort as a per-task decision: receive the task, assess complexity, uncertainty and risk, select a supported setting, execute, verify, and escalate, retry or gather evidence if verification fails.

![A flowchart. Receive task, then assess complexity, uncertainty and risk using rules, a classifier or a model router, with a side note that the router can err and should be measured. Then select a supported setting, branching into lower effort for routine low-risk work, medium effort for typical work, and higher effort for hard or high-risk work. All branches execute the task, then verify the result. A pass reaches done. A failure goes to escalate, retry, raise effort or gather evidence, and loops back to execute.](./images/effort-adaptive-routing.svg "Route by task, verify the result, and escalate on failure. The dashed arrow shows the escalation loop.")

Routing can use rules, a classifier, a model-based router, or a feedback-driven policy.

<div class="callout documented">

<span class="label documented">Documented</span> Research on test-time compute found that allocating inference effort adaptively per prompt can outperform spending it uniformly ([Snell et al., 2024](https://arxiv.org/abs/2408.03314)). That is an argument for adaptive allocation in general, not a promise for your workload.

</div>

Two cautions. Task classification can itself be wrong, so evaluate the router like any other component. And use only effort levels the chosen model or API supports.

## Measure Whether Higher Effort Actually Helps

<p class="slide-kicker">Part IV · Production systems</p>

Build an evaluation set that represents your real workload, then compare the settings your model supports on equivalent tasks under comparable conditions.

![A dashboard template with a banner reading template, no measured data. Nine empty tiles with dashes: task success rate, verified acceptance rate, test pass rate, latency P50, latency P95, cost per successful task, retries per task, tool calls per task and agent wall-clock time. Below, an empty success-versus-cost chart with placeholder markers labeled as not data, and a protocol checklist.](./images/effort-eval-dashboard.svg "A template, not results. Every value is a dash because no experiment is being reported here.")

| Measure | Why |
| --- | --- |
| Task success and verified acceptance rate | The thing you actually want |
| Test pass rate | An objective check where tests exist |
| Latency P50 and P95 | The typical and the worst realistic experience |
| Cost per *successful* task | Cheap failures are not cheap |
| Retry frequency, tool-call count, wall-clock time | What the agent loop costs you |

Models and agents are nondeterministic, so run repeated trials and report spread, not a single run. Do not judge success by answer length or reasoning-token count: both measure effort spent, not quality delivered. Any number you publish should come from a documented experiment; the dashboard above is deliberately empty.

## Make Reasoning Effort an Explicit Engineering Decision

<p class="slide-kicker">Part IV · Production systems</p>

Where a provider supports it, effort is a request parameter. Here is an OpenAI Responses API request in the documented shape:

```javascript
const response = await client.responses.create({
  model: "gpt-6-astra",
  reasoning: {
    effort: "high", // the setting this slide is about
  },
  input: "Analyze this production bug...",
});

console.log(response.output_text);
```

<div class="callout documented">

<span class="label documented">Documented</span> The docs checked on October 22, 2026 show `reasoning: { effort: ... }` on `responses.create`, list the values `none`, `minimal`, `low`, `medium`, `high`, `xhigh` and `max`, and state that supported values depend on the model: for example, GPT-6 Astra rejects `none` with HTTP 400 ([OpenAI: Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)). The model name here is the one the docs use; I did not execute this request, so confirm the model and values on its model page before relying on it.

</div>

The setting expresses how much reasoning to apply. It does not return the model's private reasoning; for that, only a summary is available, opt-in.

**Other providers spell it differently.** There is no shared format:

| Provider | Parameter | Source |
| --- | --- | --- |
| OpenAI (Responses API) | `reasoning: { effort }` | [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning) |
| Anthropic (Messages API) | `output_config: { effort }` | [Effort](https://platform.claude.com/docs/en/build-with-claude/effort) |
| Google (Gemini API) | `thinking_level` | [Thinking](https://ai.google.dev/gemini-api/docs/thinking) |

## Before Increasing Thinking Effort, Ask These Five Questions

<p class="slide-kicker">Part V · Practical takeaways</p>

<div class="checklist">

1. <strong>Is the task genuinely complex or uncertain?</strong><span>If it is routine and checkable, extra reasoning mostly adds cost.</span>
2. <strong>Is the model struggling to reason, or does it lack critical information?</strong><span>Missing facts need retrieval or a tool, not more thought.</span>
3. <strong>Would another tool or a verification step help more?</strong><span>A test run often beats another paragraph of deliberation.</span>
4. <strong>Is the expected quality gain worth the extra latency and cost?</strong><span>Compare cost per successful task, not cost per request.</span>
5. <strong>Have I measured the difference on representative real tasks?</strong><span>If not, treat the answer to the other four as a guess.</span>

</div>

Keep this as a reusable decision card: if you cannot answer yes to question 1 and question 5, you probably should not raise the setting yet.

## The Best Agent Is Not the One That Thinks the Most. It Is the One That Allocates Effort Where It Matters.

<p class="slide-kicker">Part V · Practical takeaways</p>

![An agent chooses among three paths: a quick path enough for easy tasks, a highlighted deliberate path applying reasoning where it matters, and an evidence path that searches, reads and runs. The selected path passes through a verify gate to a result.](./images/effort-closing-path.svg "Choose the path the task needs, then check the result before accepting it.")

1. Thinking effort can influence how a model processes a task. It does not guarantee correctness.
2. Reasoning, tool use, context retrieval and verification solve *different* problems.
3. The right configuration comes from evaluating your own workload.

<p class="pull-question">Instead of asking “How can I make the AI think more?”, ask “How much reasoning does this task need to be completed reliably?”</p>

### References and further reading

- OpenAI, [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning): `reasoning.effort`, reasoning tokens and summaries.
- Anthropic, [Effort](https://platform.claude.com/docs/en/build-with-claude/effort) and [Steering thinking](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost): effort levels, adaptive thinking, thinking tokens and cost.
- Google, [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking): `thinking_level` and thought summaries.
- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (December 2024): workflows, agents and when to add complexity.
- Yao et al., [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) (2022).
- Snell et al., [Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters](https://arxiv.org/abs/2408.03314) (2024).
- Chen et al., [Reasoning Models Don't Always Say What They Think](https://arxiv.org/abs/2505.05410) (2025).
