---
title: 'Understanding Thinking Effort in AI Agents: What Developers Need to Know'
description: 'A slide-based guide to reasoning effort for developers who use LLM APIs and coding agents: what the setting changes, how it differs from the agent loop, when more effort helps, and how to measure it instead of guessing.'
pubDate: 2026-10-22T09:00:00+07:00
updatedDate: 2026-10-22T22:00:00+07:00
category: AI Agents
tags: [thinking-effort, reasoning, ai-agents, evaluation, llm-api]
featured: false
draft: false
slides: true
---

## Understanding Thinking Effort in AI Agents

<p class="slide-kicker">Part I · Challenge common assumptions</p>

**Why asking an AI to think harder does not always produce better results.**

What does a thinking-effort setting actually change, and when should you raise it? This deck follows that question through 21 slides: the concept, the difference between reasoning and agent execution, real engineering scenarios, a production architecture, and a way to decide with evidence instead of intuition.

![An agent at the left sends one task down three lanes. The top lane is a short direct path to a fast answer. The middle lane weighs one alternative and drops it. The bottom lane is a thick path with several branches, two dead ends and a verification step before a verified result.](./images/effort-cover-paths.svg "One task, three levels of reasoning effort. A conceptual illustration, not a measurement.")

<div class="callout article-only">

**How to read this article.** Claims carry labels. <span class="label documented">Documented</span> means stated in the official documentation or paper linked beside it. <span class="label verified">Verified</span> means I ran it myself, and the callout says what was run and what that run cannot show. <span class="label opinion">Opinion</span> is my interpretation or engineering judgment. <span class="label proposal">Proposal</span> is a design I recommend, not something a vendor ships. <span class="label illustrative">Illustrative</span> marks invented numbers and scenarios used to explain an idea. No claim here is an experiment: I ran no benchmark, so every number on these slides either comes from vendor documentation or is marked illustrative. Diagrams are conceptual unless a caption says otherwise.

**Last verified: October 22, 2026.** Provider facts were checked that day against the linked OpenAI, Anthropic and Google pages. The code on slides 15 and 18 was type-checked against `openai` 7.42.0, `@anthropic-ai/sdk` 1.1.0 and `@google/genai` 2.30.0 with TypeScript 5.9.3. None of it was sent to a live API. Model names and accepted values change often, so check the linked pages before you copy anything.

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

<span class="label documented">Documented</span> In its per-model guidance for Claude Opus 4.7, Anthropic says that on most workloads the highest level, `max`, "adds significant cost for relatively small quality gains", and that on some structured-output or less intelligence-sensitive tasks it can lead to overthinking ([Anthropic: Effort](https://platform.claude.com/docs/en/build-with-claude/effort)). The guidance is written for that model; other models' guidance differs.

</div>

## Thinking Effort Is About Reasoning Resources, Not Just Waiting Longer

<p class="slide-kicker">Part II · Technical fundamentals</p>

Thinking effort is a **model- or platform-specific control, where one exists,** that influences how much effort goes into reasoning about a task. It is a setting on the public API. It is not a window into the model.

![On the left, the public API inputs: the task and context, and an effort setting such as low to high. In the middle, a dashed region labeled model inference, internals vary and are not exposed, with three question-marked boxes: reasoning behavior, computation spent, other inference choices. On the right, the public outputs: the answer, an opt-in reasoning summary that is not a raw trace, and a usage report with reasoning tokens billed.](./images/effort-what-is-it.svg "What you can set and observe is the API surface. What happens inside depends on the model and is not specified by the setting.")

<div class="callout documented">

<span class="label documented">Documented</span> What the vendors say, in their own words:

- OpenAI: reasoning tokens are billed as output tokens, count toward `max_output_tokens` and the context window, and appear in `usage.output_tokens_details.reasoning_tokens`. The raw reasoning is not returned; a summary is opt-in through `reasoning.summary` ([OpenAI: Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)).
- Anthropic: effort is "a behavioral signal, not a strict token budget", and it affects all output tokens, including text and tool calls, not only thinking ([Anthropic: Effort](https://platform.claude.com/docs/en/build-with-claude/effort)). You are billed for the full thinking even when only a summary, or nothing, is displayed; `usage.output_tokens_details.thinking_tokens` reports it ([Anthropic: Steering thinking](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost)).
- Google: `thinking_level` accepts a different set of levels per model, response pricing is "the sum of output tokens and thinking tokens", and thought summaries are opt-in ([Gemini: Thinking](https://ai.google.dev/gemini-api/docs/thinking)).
- Defaults differ. Anthropic documents `high` as the default on most models and `medium` on Claude Opus 5.5 and Claude Haiku 5.5; OpenAI documents `medium` as the default for several models; Gemini's default depends on the model. Omitting the setting does not mean the same thing everywhere.

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

Effort acts on one step of this loop, the reasoning inside the model call. Overall performance also depends on context quality, which tools exist, how the harness orchestrates retries and stopping, and whether anything verifies the result. Slide 15 turns this loop into a production reference architecture.

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

**These are tendencies, not guarantees.** How large each gap is depends on the model, the task and the metric. This article gives no numeric improvements because none would generalize; slides 16 and 17 show how to produce your own.

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

**Cost has three layers**, and each answers a different question:

| Layer | What it counts | Where the number comes from |
| --- | --- | --- |
| Model call | Input, cached input, output and reasoning tokens, times the provider's per-token prices | The `usage` object of each response, and the provider's pricing page |
| Agent run | Every model call in the run, plus tool execution, retries, sandbox or CI time, and human review | Your traces and infrastructure bills |
| Task outcome | Total spend and time, divided by the tasks that passed verification | Your evaluation results |

Effort acts on the first layer, but the decision belongs to the third. A setting that makes each call cheaper can make the task more expensive if runs fail more often and need retries, or a person, to finish.

<div class="callout illustrative">

<span class="label illustrative">Illustrative</span> Invented numbers, to show the arithmetic only. Setting A costs $0.40 per run and passes verification on 50 of 100 runs: $40 spent, $0.80 per successful task. Setting B costs $0.60 per run and passes on 80 of 100: $60 spent, $0.75 per successful task. B is 50% more expensive per run and cheaper per success, and the gap widens once you count the person who finishes each failed task. With different numbers A wins, which is why you measure.

</div>

## Do Not Default to Maximum Effort for Every Request

<p class="slide-kicker">Part IV · Production systems</p>

An adaptive strategy treats effort as a per-task decision: receive the task, assess complexity, uncertainty and risk, select a supported setting, execute, verify, and escalate, retry or gather evidence if verification fails.

![A flowchart. Receive task, then assess complexity, uncertainty and risk using rules, a classifier or a model router, with a side note that the router can err and should be measured. Then select a supported setting, branching into lower effort for routine low-risk work, medium effort for typical work, and higher effort for hard or high-risk work. All branches execute the task, then verify the result. A pass reaches done. A failure goes to escalate, retry, raise effort or gather evidence, and loops back to execute.](./images/effort-adaptive-routing.svg "Route by task, verify the result, and escalate on failure. The dashed arrow shows the escalation loop.")

Routing can use rules, a classifier, a model-based router, or a feedback-driven policy.

<div class="callout documented">

<span class="label documented">Documented</span> Research on test-time compute found that allocating inference effort adaptively per prompt can outperform spending it uniformly ([Snell et al., 2024](https://arxiv.org/abs/2408.03314)). That is an argument for adaptive allocation in general, not a promise for your workload.

</div>

Two cautions. Task classification can itself be wrong, so evaluate the router like any other component. And use only effort levels the chosen model or API supports.

## A Reference Architecture for the Agent Loop

<p class="slide-kicker">Part IV · Production systems</p>

![A dashed region labeled loop controller, your harness, not the model, checked before every model call: step, token and time budgets, a repeated-action detector and stop rules. Inside, five boxes in a row: context, model call where effort acts, decision between answer and tool call, tool policy with allow, ask and deny, and a tool runner with timeout and retry. A dashed arrow returns each tool result with its status, ok, error or timeout, to context. An answer goes down to a verifier with tests, types and the spec. A pass leads to done, verified and traced. A fail returns the failing checks to context as feedback. The tool policy sends actions that need approval to an escalate-to-a-human box, which also covers budget hits and stuck loops. Below the region, a band says to trace every step with one span each, and four boxes classify failed runs: reasoning, tool execution, orchestration and verification.](./images/effort-agent-architecture.svg "A proposed harness, not provider behavior. Effort acts inside one box; everything else is your code.")

<div class="callout proposal">

<span class="label proposal">Proposal</span> The loop on this slide is my recommendation for a production harness. No provider ships it as is.

</div>

| Concern | Proposed control |
| --- | --- |
| Runaway loops | Step, token and wall-clock budgets, checked before every model call |
| Unproductive loops | Stop when the same tool call with the same arguments repeats, or the same check keeps failing |
| Tool failures and timeouts | A timeout per tool. Retry only idempotent tools. Return errors and timeouts to the model as results; do not hide them |
| Consequential actions | A policy per tool: allow read-only tools, ask a person before writes, deploys, deletes or payments, deny the rest. Run code in a sandbox |
| Context | Append each tool result with its status; truncate large outputs and keep a pointer to the full artifact |
| Observability | One trace span per model call, tool call and check, recording the effort setting and token usage |
| Final result | Accept only what passes the verifier |

```typescript
const LIMITS = { maxSteps: 30, maxOutputTokens: 400_000, maxWallClockMs: 15 * 60_000, maxRepeats: 3 };

async function runTask(task: Task): Promise<RunResult> {
  const ctx = newContext(task);
  const startedAt = Date.now();
  let outputTokens = 0;

  for (let step = 1; step <= LIMITS.maxSteps; step++) {
    if (outputTokens > LIMITS.maxOutputTokens || Date.now() - startedAt > LIMITS.maxWallClockMs) {
      return { outcome: "stopped", reason: "budget_exhausted", suspected: "orchestration" };
    }

    // The only place the effort setting acts.
    const turn = await trace("model_call", () => callModel(ctx, { effort: chooseEffort(task) }));
    outputTokens += turn.usage.outputTokens;

    if (turn.kind === "answer") {
      const check = await trace("verify", () => verify(task, turn.answer));
      if (check.passed) return { outcome: "verified", answer: turn.answer, check };
      ctx.append({ type: "verification_failed", findings: check.findings });
      continue;
    }

    const call = turn.toolCall;
    if (repeatCount(ctx, call) >= LIMITS.maxRepeats) {
      return { outcome: "stopped", reason: "no_progress", suspected: "reasoning" };
    }

    const policy = toolPolicy(call); // "allow" | "ask" | "deny"
    if (policy === "deny" || (policy === "ask" && !(await askHuman(call)))) {
      ctx.append({ type: "tool_denied", call });
      continue;
    }

    // Retry only idempotent tools; errors and timeouts go back to the model as results.
    const result = await trace("tool_call", () =>
      runTool(call, { timeoutMs: 60_000, retries: call.idempotent ? 2 : 0 }),
    );
    ctx.append({ type: "tool_result", call, result });
  }

  return { outcome: "stopped", reason: "step_limit", suspected: "orchestration" };
}
```

<div class="callout verified">

<span class="label verified">Verified</span> This loop passes `tsc --strict` (TypeScript 5.9.3) with stub declarations for the helpers it calls (`callModel`, `verify`, `runTool` and the rest). I also ran it on Node.js 26.9.0 against a scripted fake model and fake tools, and 8 of 8 control-flow tests passed: verified answer, verification feedback, repeated-call stop, step limit, token budget, denied and unapproved tools, no retries for non-idempotent tools, and tool timeouts returned to the model. The wall-clock budget was not tested. No real model was called, so this shows the control flow works, not how any model behaves inside it. The limits are placeholders to tune.

</div>

<div class="callout documented">

<span class="label documented">Documented</span> Anthropic recommends the core of this design: agents should get "ground truth" from the environment at each step, and should include stopping conditions "such as a maximum number of iterations" ([Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)).

</div>

**Label every failed run** with the class that broke first, by reading its trace. *Reasoning*: the facts were in context and the plan was still wrong. *Tool execution*: an error, a timeout, or bad output. *Orchestration*: lost context, a loop, or an exhausted budget. *Verification*: a check was missing, flaky or wrong. The `suspected` field in the code is only a first guess; the trace decides.

<div class="callout opinion">

<span class="label opinion">Opinion</span> Only the first class is a reason to try more effort. The other three are fixed in the harness.

</div>

## Measure Whether Higher Effort Actually Helps

<p class="slide-kicker">Part IV · Production systems</p>

Build an evaluation set that represents your real workload: real tasks, each with a verifier written before you look at any results. Then compare the settings your model supports under conditions that differ only in effort.

![A dashboard template with a banner reading template, no measured data. Nine empty tiles with dashes: verified task success, first-attempt success, test pass rate, latency P50, latency P95, cost per successful task, average retries per task, tool calls per task and agent wall-clock time. Below, an empty success-versus-cost chart with placeholder markers labeled as not data, and a protocol checklist.](./images/effort-eval-dashboard.svg "A template, not results. Every value is a dash because no experiment is being reported here.")

**Hold everything else constant.** Pin and record:

- the model snapshot ID and the SDK version;
- the system prompt, tool definitions and harness version;
- the context each task starts from: repository commit, fixtures, retrieved documents;
- the output cap (`max_output_tokens` or `max_tokens`) and the loop budgets from slide 15;
- the verifier and its pass criteria.

Change only the effort value, use only values the model documents, and interleave the settings in time so that a provider-side change or a slow hour does not land on one setting.

**Run each task several times per setting.** Two runs of the same prompt can differ, so one run per task measures luck as much as the setting. Fix the number of runs before you start, compare settings task by task on the same tasks, and report an interval, not only an average. For success rates, a binomial interval such as Wilson's works; for latency and cost, bootstrap over tasks.

<div class="callout opinion">

<span class="label opinion">Opinion</span> Five runs per task per setting, over 30 to 50 tasks, is a reasonable first pass. If the intervals of two settings overlap heavily, you have not shown a difference yet; add tasks or runs before you conclude anything.

</div>

Do not judge success by answer length or reasoning-token count: both measure effort spent, not quality delivered.

## A Benchmark Template You Can Fill In

<p class="slide-kicker">Part IV · Production systems</p>

Define every metric before the first run, so the numbers cannot be chosen after you see them:

| Metric | Definition | Watch for |
| --- | --- | --- |
| Verified task success rate | Runs whose final result passed the verifier, divided by all runs | The headline number |
| First-attempt success rate | Runs that passed on the first answer, with no verification feedback and no retries, divided by all runs | How much of the success comes from the loop's recovery |
| Test pass rate | Passing tests divided by tests run, at the end of each run | Partial credit; never a substitute for verified success |
| Latency, median and P95 | Wall-clock time from task start to final result, per run | P95 needs many runs before it means anything |
| Cost per successful task | Total spend over all runs, failed ones included, divided by verified successes | Add tool and infrastructure cost where you can |
| Average retry count | Model calls made after a failed check or a tool error, per run | Kept separate from total model calls |

<div class="callout illustrative">

<span class="label illustrative">Illustrative</span> A template, not results. Every cell is a dash because no experiment is reported in this article.

| Setting | Runs | Verified success (95% CI) | First-attempt success | Test pass rate | Latency P50 / P95 | Cost per success | Avg retries |
| --- | --- | --- | --- | --- | --- | --- | --- |
| low | — | — | — | — | — / — | — | — |
| medium | — | — | — | — | — / — | — | — |
| high | — | — | — | — | — / — | — | — |

Publish it with the run date, model snapshot, SDK versions, task-set version, verifier version and runs per task.

</div>

Why measure instead of assuming? Higher effort can help on tasks that need more deliberation, and it also tends to add latency and output tokens. Which effect wins depends on the model, the task mix and the strength of your verifier, and it can change when the model does.

<div class="callout documented">

<span class="label documented">Documented</span> Anthropic's effort guide says "the impact of effort levels varies by task type" and advises you to "evaluate performance on your specific use cases before deploying" ([Anthropic: Effort](https://platform.claude.com/docs/en/build-with-claude/effort)). OpenAI says supported values depend on the model ([OpenAI: Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)).

</div>

## Make Reasoning Effort an Explicit Engineering Decision

<p class="slide-kicker">Part IV · Production systems</p>

Where a provider supports it, effort is a request parameter. Here is an OpenAI Responses API request in the documented shape, with the reasoning-token count read back from the response:

```typescript
import OpenAI from "openai";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-6-astra",
  reasoning: { effort: "high" }, // the setting this slide is about
  input: "Analyze this production bug...",
});

console.log(response.output_text);
console.log(response.usage?.output_tokens_details.reasoning_tokens);
```

<div class="callout documented">

<span class="label documented">Documented</span> The OpenAI guide shows `reasoning: { effort }` on `responses.create`, lists `none`, `minimal`, `low`, `medium`, `high`, `xhigh` and `max`, and says supported values depend on the model. GPT-6 Astra, the model the guide's own example uses, rejects `none` with HTTP 400 ([OpenAI: Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)); its model page lists `low` through `max` ([GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra)).

</div>

The setting expresses how much reasoning to apply. It does not return the model's private reasoning; for that, only a summary is available, opt-in.

The same request on Anthropic's Messages API and on the Gemini Interactions API:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const message = await anthropic.messages.create({
  model: "claude-opus-5-5",
  max_tokens: 16000, // thinking counts toward this cap
  output_config: { effort: "high" },
  messages: [{ role: "user", content: "Analyze this production bug..." }],
});

console.log(message.usage.output_tokens_details?.thinking_tokens);
```

```typescript
import { GoogleGenAI } from "@google/genai";

const gemini = new GoogleGenAI({});

const interaction = await gemini.interactions.create({
  model: "gemini-3.8-flash",
  input: "Analyze this production bug...",
  generation_config: { thinking_level: "high" },
});

console.log(interaction.output_text);
console.log(interaction.usage?.total_thought_tokens);
```

<div class="callout verified">

<span class="label verified">Verified</span> All three snippets pass `tsc --strict` (TypeScript 5.9.3) against `openai` 7.42.0, `@anthropic-ai/sdk` 1.1.0 and `@google/genai` 2.30.0. As a negative control, an unknown effort value, `effort` placed at the top level of an Anthropic request, `adaptive` passed as an effort value, and camelCase `thinkingLevel` on the Interactions API each failed the same check. A type check cannot tell whether a model name exists or which values a model accepts, and none of these requests was sent.

</div>

**Similar names, different contracts.** There is no shared format:

| Provider and API | Request field | Values in the docs | Reasoning usage field | Source |
| --- | --- | --- | --- | --- |
| OpenAI, Responses | `reasoning: { effort }` | `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max` | `usage.output_tokens_details.reasoning_tokens` | [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning) |
| Anthropic, Messages | `output_config: { effort }` | `low`, `medium`, `high`, `xhigh`, `max` | `usage.output_tokens_details.thinking_tokens` | [Effort](https://platform.claude.com/docs/en/build-with-claude/effort), [Steering thinking](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost) |
| Google, Interactions | `generation_config: { thinking_level }` | `minimal`, `low`, `medium`, `high` | `usage.total_thought_tokens` | [Thinking](https://ai.google.dev/gemini-api/docs/thinking) |
| Google, generateContent | `config.thinkingConfig.thinkingLevel` in the JavaScript SDK | the same four levels | `usageMetadata.thoughtsTokenCount` | [API reference](https://ai.google.dev/api/generate-content); field placement checked in the SDK types |

Each list is the union across models; a given model accepts only part of it. And equal names do not mean equal behavior. `high` on one model is not calibrated against `high` on another, even from the same vendor.

<div class="callout documented">

<span class="label documented">Documented</span> Anthropic says Claude Sonnet 5.5's effort levels are recalibrated, so a level "doesn't produce the same amount of thinking as the same level on Claude Sonnet 5", and recommends a fresh effort sweep ([Anthropic: Effort](https://platform.claude.com/docs/en/build-with-claude/effort)).

</div>

## A Starting Heuristic for Choosing Effort

<p class="slide-kicker">Part V · Practical takeaways</p>

<div class="callout opinion">

<span class="label opinion">Opinion</span> This matrix is my engineering heuristic for a first configuration, not a rule and not vendor guidance. Validate whatever it suggests against your own workload.

</div>

| Factor | Points to lower effort | Points to higher effort | Often the better lever |
| --- | --- | --- | --- |
| Task complexity | One clear path, a local change | Many interacting parts, several plausible paths | Decompose a task that is broad rather than deep |
| Uncertainty and ambiguity | A precise spec | Competing hypotheses to weigh | Ask a clarifying question when the spec, not the reasoning, is ambiguous |
| Context | Everything needed is in the prompt | Complete but intricate context | Retrieve files, logs or docs when facts are missing |
| Need for outside information | None | Not a reason on its own | Call a tool; effort cannot produce facts |
| Cost of a wrong result | Cheap to undo | Expensive or irreversible | Human approval and stronger checks, alongside effort |
| Automated verification | Strong, fast tests, so iterating is cheap | Weak or no checks, so the first answer matters more | Write the missing test before raising effort |
| Latency and cost budget | Interactive, high volume, tight budget | Offline or batch work with high value per task | Route per task (slide 14) instead of one global setting |

How to use it: start each route at the level the provider's guidance recommends for that kind of workload, or at the documented default. Raise effort only on routes where traced failures are mostly reasoning failures (slide 15) and the verifier is strong enough to show a difference. Lower it where verified success holds at the lower level. Then run the benchmark from slides 16 and 17, and let the numbers overrule the table.

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

All provider pages were last checked on October 22, 2026.

- OpenAI, [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning): `reasoning.effort`, reasoning tokens and summaries. [GPT-6 Astra model page](https://developers.openai.com/api/docs/models/gpt-6-astra): supported effort values.
- Anthropic, [Effort](https://platform.claude.com/docs/en/build-with-claude/effort) and [Steering thinking](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost): effort levels and defaults per model, adaptive thinking, thinking tokens and cost.
- Google, [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking): `thinking_level` on the Interactions API, levels per model, thought summaries and thinking-token usage. [generateContent reference](https://ai.google.dev/api/generate-content): `usageMetadata.thoughtsTokenCount`.
- SDKs used for the type checks: [`openai`](https://www.npmjs.com/package/openai) 7.42.0, [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk) 1.1.0, [`@google/genai`](https://www.npmjs.com/package/@google/genai) 2.30.0.
- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (December 2024): workflows, agents and when to add complexity.
- Yao et al., [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) (2022).
- Snell et al., [Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters](https://arxiv.org/abs/2408.03314) (2024).
- Chen et al., [Reasoning Models Don't Always Say What They Think](https://arxiv.org/abs/2505.05410) (2025).
