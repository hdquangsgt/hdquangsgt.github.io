---
title: 'Pi Agent: From Flexibility to Responsibility — Building Reliable Workflows'
description: 'Part 2 of 2. What it takes to turn Pi''s flexibility into a reliable, secure workflow: orchestration and observability, recovery, trust and isolation, and a framework for choosing between Pi and an integrated agent.'
pubDate: 2026-10-21T00:00:00+07:00
category: AI Agents
tags: [pi, coding-agents, security, architecture, claude-code]
featured: false
draft: false
---

<div class="callout">

**Part 2 of 2.** [Part 1: Understanding the Architecture](/blog/pi-agent-freedom-vs-convenience/) explained Pi's loop, tools, hooks and context handling. This part covers what you have to build and maintain to turn that flexibility into a reliable, secure workflow. It can be read on its own, and a short recap follows.

</div>


<div class="callout">

**How to read this article.** Pi changes quickly, so claims carry labels:

- <span class="label documented">Documented</span>: stated in official docs, source code, or the authors' posts, linked next to the claim.
- <span class="label observed">Observed</span>: something I experienced first-hand. Not a controlled test.
- <span class="label opinion">Opinion</span>: my interpretation.
- <span class="label proposal">Proposal</span>: an idea worth evaluating. Not something I've tested or Pi ships.

**Versions.** Pi claims refer to `@earendil-works/pi-coding-agent` **1.3.0** (the npm `latest` tag when I checked on October 20, 2026), the Pi docs and repository, and the docs of Claude Code and OpenAI Codex (plus Codex's open-source repository, commit `e18a20d`) on that date. All of these change quickly, so treat version-specific details as a snapshot. I don't benchmark output quality anywhere, and nothing here says which agent writes better code.

</div>

## 1. The cost of freedom

[Part 1](/blog/pi-agent-freedom-vs-convenience/) ended on a claim and a question. The claim: **Pi gives developers more control over their coding-agent environment, and that freedom shifts responsibility for integration, reliability, security and maintenance onto them.** Part 1 showed the documented side of it: a small loop, eight built-in tools, hooks that can inspect or block every tool call, sessions stored as trees, compaction, and several interfaces (terminal, print, JSON, RPC, SDK) for driving the agent from outside. The question: what does it take to turn that into something you would trust?

Extensibility alone doesn't give you reliability, security or maintainability. Those are properties of what you build on top. This part follows the experiments that raised the question, in this order: orchestration and observability, recovery when execution stops, the difference between trust, permissions and isolation, fitting Pi into a project, what I actually established and what I didn't, and finally when the extra work is worth it. Each claim carries the same label as in Part 1: documented, observed, opinion or proposal.

## 2. Orchestration and sub-agents

Orchestration is where the extra work first shows. A single agent loop has one model, one context and one stream of tool calls. Once agents delegate to other agents, you take on task decomposition, a way to pass context and results, failure paths that cross agent boundaries, and a need to see what the children are doing. Nothing in Pi requires this, and not every workflow needs sub-agents. What follows is what I ran into when I tried to build it, and where Pi's documented pieces stop and your own design starts.

### Building an orchestrator

<div class="callout observed">

<span class="label observed">Observed</span> I experimented with extensions to get capabilities I didn't find in the form I wanted:

- an **orchestrator**,
- **sub-agents**, for work with long sessions or a lot of context,
- extensions intended to **restrict permissions**,
- an attempt to run **Pi inside a Docker container** as a sandbox.

These ran into implementation difficulties and errors. Even so, they taught me more about how an agent works internally. The difficulty I can describe most precisely was watching what the sub-agents were doing, which the next subsection takes apart. I don't itemize the individual errors here. I also don't report a configuration or results for the Docker attempt, so nothing in this article treats it as a test of Pi's security.

</div>

The sequence matters more than any one error. The motivation for the sub-agents was long sessions and large contexts. I didn't find what I wanted in the form I wanted, so I tried building it. Beyond the effort, what that left me with were questions about delegation: what an orchestrator is responsible for, where a sub-agent's results and failures go, and who can see them. The rest of this section follows those questions. That is my reading of my own experiment. It's an interpretation of what happened when I built these pieces, not a claim that Pi lacks delegation capabilities in general.

What the documentation sets up is a separate, checkable matter. Pi names "no sub-agents" as a choice. Its extension guide doesn't mention sub-agents either, though it does let an extension run other tools with `ctx.executeTool()`, and those nested calls pass through the same `tool_call` handlers as model-issued ones ([extensions guide](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)). So an orchestrator isn't something you configure. It's something you design.

### When delegation becomes hard to see

<div class="callout observed">

<span class="label observed">Observed</span> While experimenting with sub-agents, I found it hard to watch what they were doing. The main agent could keep reporting that work was in progress, while I had little or no clear view of what a sub-agent was actually doing.

</div>

The observation is about a gap: a general progress signal versus the ability to inspect real execution. It's easy to build the first and skip the second. I'm not claiming my extension had or lacked any particular mechanism. The point below is what a delegating system needs, if you want to trust it.

<div class="callout opinion">

<span class="label opinion">Opinion</span> Launching a sub-agent is only orchestration. Understanding it takes more:

- **Status versus progress.** "Running" says a task exists. It doesn't say whether it's reading files, waiting on a model, or stuck.
- **Execution events.** The tool calls and intermediate results of the child, not only its final answer.
- **Tracing across levels.** A way to connect a child's actions to the parent request that caused them.
- **Failure handling.** Timeouts, stalled tasks, and an error path that reaches the parent as something other than silence.

</div>

Pi's building blocks cover part of this. Sessions are stored as JSONL trees recording messages, tool calls and results, and compactions, and JSON and RPC modes stream agent events ([How Pi works](https://pi.dev/docs/latest/how-pi-works)). The extension API adds finer-grained hooks. Lifecycle events include `agent_start`, `turn_start`, `message_update` and `agent_settled`, and tool execution has `tool_execution_start`, `tool_execution_update` (progress during a call) and `tool_execution_end`. For nested calls made through `ctx.executeTool()`, these events carry a `parentToolCallId` ([extensions guide](https://pi.dev/docs/latest/extensions)). The SDK exposes `session.subscribe()` for events of one in-process session ([SDK](https://pi.dev/docs/latest/sdk)). These are building blocks, and I haven't verified how they behave across separate child Pi processes. The docs I read describe no dashboard, metrics or tracing system beyond them. Whether a child process appears in that record usefully depends on how you launch it. That's a design decision you own.

The hooks themselves are listed in firing order in [Part 1](/blog/pi-agent-freedom-vs-convenience/) (the extension-hooks figure). The point here is what they give an orchestrator.

<div class="callout opinion">

<span class="label opinion">Opinion</span> This is the most concrete support I found for the argument of this section. The seams for watching an agent exist, down to individual tool calls and provider events. What the docs don't describe is a finished view built from them. So the question isn't whether Pi can be observed. It's who builds the view.

</div>

Put together, three properties are separate, and an agent can have the first without the others:

- **Execution:** it can perform actions.
- **Observability:** you can tell what it is doing and where it is.
- **Control:** you can intervene, change approach, or stop it.

Delegation without observability creates a system that can act without being easy to understand. That's a conclusion about the design, not a claim that every multi-agent system works this way.

Control has a documented side too. A person can steer, queue a follow-up or abort ([Part 1](/blog/pi-agent-freedom-vs-convenience/), section 3), and a program can do the same over RPC. Those act on a Pi session. How a parent agent would apply them to a child, when it should, and what the child does with them are decisions I would have to design. I'm not claiming Pi can't do it.

## 3. Recovery and reliability: when execution stops

<div class="callout observed">

<span class="label observed">Observed</span> During normal use I ran into unexpected failures: model response errors, incorrect tool usage, and context window exhaustion. In some cases, execution stopped without automatically recovering in a way that let the task continue. I had to step in, diagnose the problem, adjust the execution state or my approach, and find a way to resume. Some failures I could resolve that way, and the task went on after a minor interruption. Others stopped the task from progressing at all.

</div>

That gives two groups, and the difference between them is the useful part: **interruptions I could recover from** by diagnosing and resuming, and **failures that blocked the task**. I'm not assigning particular failures (a response error, a tool misuse, context exhaustion) to either group, and I'm not saying any of them is unrecoverable in general. Whether a failure resumes depends on the model, the provider, the configuration and any extensions, and my account doesn't map one to the other.

This is a different problem from the one in section 2. Observability asks whether you can see what an agent is doing. Recovery asks what happens when what it's doing breaks. An agent's ability to **execute** a task and its ability to **recover** when execution fails are separate properties. A system can be very good at the first and say little about the second.

I shouldn't overstate what Pi lacks, because it does have recovery behavior, and the docs describe it:

<div class="callout documented">

<span class="label documented">Documented</span> Pi has automatic agent-level retry for "transient failures", enabled by default, with a default of 3 attempts and exponential backoff starting at 2 seconds and capped at 60 seconds ([Settings](https://pi.dev/docs/latest/settings)). It also has automatic compaction, which starts when free context drops below a reserve (16,384 tokens by default). On a provider overflow or length error, Pi runs a recovery compaction and then starts the retry as a fresh run. If that recovery compaction fails or is cancelled, Pi "schedules no internal retry" ([Compaction](https://pi.dev/docs/latest/compaction)). When a tool itself fails, the failure becomes an error result for the model ([extensions guide](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)).

</div>

So the accurate statement isn't that Pi never recovers. Some failures have a built-in path, and some paths are bounded: three retries by default, and a compaction recovery that ends without a retry if compaction itself fails. The docs I read don't list which errors count as transient. They also don't describe built-in handling for a model that keeps using a tool incorrectly, or for a run that ends in a state you want to resume. I don't know whether any of my failures fell inside or outside the built-in paths. I'm not claiming they were gaps in Pi. They may have been cases where the defaults were exhausted or didn't apply.

The figure draws those paths and what happens when each one runs out. Solid boxes are documented behavior. The dashed row marks a gap in what I read, not a claim about Pi.

![Recovery paths in three columns: trigger, built-in response, and what happens when that runs out. A transient provider failure triggers agent-level retry (on by default, 3 attempts, backoff from 2 s capped at 60 s); when attempts are used up the failure is yours to handle. A context overflow or early length stop triggers recovery compaction and one retry as a fresh run; if compaction fails or is cancelled there is no internal retry. Free context below the 16,384-token reserve triggers auto-compaction, and the summary is lossy. A failing tool call returns an error result to the model, and whether it changes approach is up to the model. A dashed last row, repeated tool misuse or a run stuck in a bad state, has nothing described in the docs I read, and ends with you inspecting, adjusting and resuming.](./images/recovery-paths.svg)

<div class="callout opinion">

<span class="label opinion">Opinion</span> Whether a particular failure resumes by itself is less important than who decides what "recovered" means. Reliable recovery tends to need decisions about:

- **Retry strategy.** Which errors to retry, how often, and when to stop retrying and escalate.
- **Error handling.** Whether a bad tool call becomes a message to the model, a stop, or a request for you.
- **Context management.** What gets summarized or dropped when the window fills, and whether the task survives it. Compaction summarizes earlier work, so what the summary keeps shapes what the agent knows afterwards.
- **Explicit recovery workflows.** A defined way to inspect the failed state, adjust it and resume, rather than improvising each time.

</div>

<div class="callout documented">

<span class="label documented">Documented</span> The pieces for building that last row from outside are documented too. Over RPC, a controlling program can switch auto-retry and auto-compaction on or off (`set_auto_retry`, `set_auto_compaction`), abort a retry in progress (`abort_retry`), compact on demand (`compact`), and watch `compaction_start`, `compaction_end` and the `summarization_retry_*` events. Inside the process, `session_before_compact` can replace Pi's summary, and `session_compact_failed` fires when compaction fails or is aborted. ([RPC](https://pi.dev/docs/latest/rpc), [Compaction](https://pi.dev/docs/latest/compaction))

</div>

<div class="callout proposal">

<span class="label proposal">Proposal</span> A small supervisor over RPC: let the built-in retry run, watch the compaction and retry events, and when a run settles in a failed state, apply a policy I wrote, such as compacting with explicit instructions, switching model, or handing the task back to me. I haven't built or tested this.

</div>

Pi gives you parts of this, and its session tree, which keeps the original entries even after compaction, is a useful record to resume from ([How Pi works](https://pi.dev/docs/latest/how-pi-works)). I haven't looked for packages that add retry or safer compaction, so I can't say whether they exist or how well they work. In an integrated product, more of these decisions may already be made for you. With Pi, defaults are a starting point, and the rest is yours to design, test and maintain. That's the same trade-off as before, seen from the failure case: freedom to customize an agent doesn't come with a guarantee that it recovers gracefully.

## 4. Permissions, trust and isolation: the real boundary

The permission-restricting extensions and the Docker attempt from section 2 raised the question of what actually limits an agent. A prompt, a restricted tool and a container are different things, so it helps to separate them.

The loop is conceptual, not a diagram of Pi's internals:

> context → model → tool request → runtime → execution environment → tool result → updated context

Five layers can each be called "permission":

1. **Process permissions.** What the OS user running the agent can do. Anything inside the process is bounded by this.
2. **Application-level checks.** Rules in the agent that inspect a tool call and allow, ask or deny it.
3. **Project-directory boundary.** Whether the working directory is a fence or only a starting point.
4. **Tool capabilities.** A structured `read` can be fenced by path. A shell can run any program, which can open any file.
5. **Isolation.** Containers, VMs and OS sandboxes restrict the process itself, including its children.

<div class="callout documented">

<span class="label documented">Documented</span> Pi's [security page](https://pi.dev/docs/latest/security) says Pi "can read, change, and execute files with the permissions of the account that started it" and "does not ask for approval before every tool call". The working folder controls resource discovery and the default tool location, but it doesn't limit commands from reaching other paths. Watching the transcript, trusting a project and reviewing changes are not security boundaries. The recommended option is running Pi entirely inside a container, VM or sandbox, with narrow, short-lived credentials and restricted network where possible.

</div>

<div class="callout documented">

<span class="label documented">Documented</span> In the source, [`read.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/read.ts) accepts relative or absolute paths and checks only that the file is readable. The path helpers it calls ([`path-utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/path-utils.ts) and [`utils/paths.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/utils/paths.ts)) keep an absolute path as it is and join a relative one to the working directory. Neither compares the result to the working directory. I read this code on the main branch, whose package version is 1.3.0, but I haven't run Pi's tools, and I haven't traced every route a file can be read by. Don't treat it as a tested result.

</div>

That fits the documentation: by default there's no application-level fence. But the absence of a prompt doesn't prove unrestricted access in every setup. An extension can add checks. The `tool_call` event can mutate or block a call, and a handler that throws blocks it fail-closed ([extensions guide](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)). A prompt doesn't prove comprehensive security either. Claude Code's docs say its Read and Edit deny rules apply to its built-in file tools, to file commands it recognizes in Bash such as `cat`, and to redirection targets. They don't apply to a command that reads files without naming them, such as `grep -r pattern .`, or to a script that opens files itself. For OS-level enforcement the docs point to its sandbox, and they say `bypassPermissions` mode should only be used in isolated environments like containers or VMs ([permissions](https://code.claude.com/docs/en/permissions)). So both sets of docs point to isolation for the real boundary. They differ in the default between you and it. In Claude Code's Manual mode (the config value `default`), it asks before most actions that edit files, run shell commands or reach the network ([permission modes](https://code.claude.com/docs/en/permission-modes)). A built-in set of read-only commands such as `cat` and `ls` runs without a prompt, including on paths outside the working directory, unless `permissions.blockReadsOutsideWorkingDirectories` is turned on. The docs also say that from v2.1.283, auto mode is the starting mode for interactive terminal and VS Code sessions, with a classifier reviewing actions instead of you. Pi asks for nothing. I compared documentation, not behavior: I haven't run Claude Code for this article.

![Three setups compared by the path a tool call takes. Pi default: no application check and no OS sandbox, so the call can reach everything the OS user can access. Pi hardened (a proposal): your extension blocks or confirms calls, a container or VM mounts only the project, so the call reaches the mounted project and scoped credentials. Claude Code in Manual mode: permission rules and the mode prompt for edits, shell commands and network access, while read-only commands such as cat run without a prompt. An optional sandbox setting exists, and the call reaches the OS user's access filtered by approvals.](./images/permission-layers.svg)

Two Pi-specific details are easy to miss:

- **Project trust is not a sandbox.** It gates what a folder supplies: project settings and MCP servers, extensions, skills, prompt templates and themes under `.pi`, system-prompt files, and project-configured packages. It "prevents a folder from silently loading executable extensions before you approve it", and the security page says it "does not limit what tool calls can access or affect". Extensions run "inside the Pi process with the same operating-system permissions", so a trusted extension can read prompts, tool calls, files and session history ([extensions guide](https://pi.dev/docs/latest/extensions)). Context files (`AGENTS.md`, `CLAUDE.md`) load without trust ([Configuration](https://pi.dev/docs/latest/configuration)). Instructions in a repository you cloned can reach the model whether or not you trusted it. Whether a given model would act on a hostile instruction is a separate question I haven't tested.

- **Docker is a tool, not a guarantee.** What a container actually isolates depends on what you mount, which credentials you pass in, whether the network is open, and which user it runs as. A container that mounts your home directory and an API key with broad scope has moved the problem, not solved it. This is general container security, not a result from my attempt ([Docker security](https://docs.docker.com/engine/security/)).

In short, three questions get mixed up. **Trust** asks whether a folder's own resources may load. **Permissions** ask what the running process and its tools can technically do. **Isolation** asks what stays out of reach even if an agent or extension misbehaves. Pi's docs provide the first, describe the second, and leave the third to you. I haven't audited Pi's security beyond reading these pages and one tool's source.

### What Pi's containerization guide offers

"Bring the container" would be thin advice on its own, and the docs go further. The [containerization guide](https://pi.dev/docs/latest/containerization) describes four options, and they differ in what the boundary contains:

![Two isolation scopes. Whole-process isolation (Docker, Docker Sandboxes, OpenShell): a container or sandbox boundary encloses the Pi process, including its extensions and extension tools, and the built-in tools and bang commands; the host is reached only through what you mount or pass in. Tool-only isolation (the Gondolin extension): the Pi process and its extensions stay on the host, and only the built-in tools and bang commands run inside a local Linux micro-VM. Both depend on what you mount, which credentials you pass in, and whether the network is open.](./images/isolation-scope.svg)

<div class="callout documented">

<span class="label documented">Documented</span> **Plain Docker** runs the whole Pi process in a container (the guide's Dockerfile is based on `node:24-bookworm-slim`), mounts the working folder at `/workspace`, passes keys with `-e`, and keeps settings and sessions in a named volume. **Docker Sandboxes** runs Pi in a managed sandbox where the real credential stays on the host and a proxy substitutes it for requests to the configured host. **OpenShell** runs Pi in a local or remote sandbox with filesystem, process, network, credential and inference policies. A remote one doesn't bind-mount your folder, so you transfer files explicitly. **Gondolin** is an extension that runs Pi on the host but routes the built-in tools and `!` commands into a local Linux micro-VM. Other extension tools still run on the host unless they delegate. The guide warns against mounting `~/.pi/agent` (credentials, settings, extensions, sessions) unless that access is intended, notes that environment variables passed into a container are visible inside it, and says Gondolin's commands inherit the host environment, so keys set as environment variables may be visible in the VM. It also says to review the Gondolin example before adding tools that could bypass the VM boundary. ([Containerization](https://pi.dev/docs/latest/containerization))

</div>

<div class="callout opinion">

<span class="label opinion">Opinion</span> This makes the permission story concrete, and it sharpens the choice. Whole-process isolation also contains the extensions I load, which matters because my own experiments were extensions. Tool-only isolation fences the built-in tools but leaves my extension's code, and any tool it registers, on the host. Neither is wrong, since they answer different questions. The work is real either way: pick one, mount narrowly, scope credentials, and keep the setup working as Pi and your extensions change. That is why the proposal below leans toward whole-process isolation.

</div>

<div class="callout proposal">

<span class="label proposal">Proposal</span> If I used Pi on real work, I'd start with the container documented as the strongest option, mount only the project, and pass a scoped key. I'd add a `tool_call` extension for visibility and catching mistakes, not as the wall. I haven't tested this setup.

</div>

## 5. Fitting Pi into a project: workflow and embedding

### From agent to workflow

Once I looked at using Pi in projects that already used AI-assisted development, a different problem appeared. Capability isn't workflow. A capable agent doesn't know how a project builds, which conventions it follows, which tests must pass, or when work counts as done.

The rest of this section is analysis of what fitting an agent into a project costs. It is general reasoning, not a report of something that went wrong in a particular project of mine.

<div class="callout opinion">

<span class="label opinion">Opinion</span> **Capabilities say what the agent can do. Workflow says how work proceeds, under which constraints, and how completion is checked.** Fitting an agent into an existing project raises questions like:

- **Context.** Where do project rules live? Pi loads `AGENTS.md` and `CLAUDE.md` as context files, so existing instructions can carry over. Instructions still aren't enforcement.
- **Tools.** Existing scripts work through `bash`. That's cheap, but the model has to learn them from a README or `--help`.
- **Coordination.** If other AI-assisted processes touch the same repository, who decides what runs when?
- **Validation.** Who ensures tests and reviews actually run? Instructions are advisory. An extension or an external harness (RPC, JSON mode, SDK) is where checks can be enforced.
- **Handoff.** How does the agent say it's finished, and how does the next person or process know?

</div>

This is where the earlier sections meet. Observability, recovery and the permission boundary are workflow questions at heart: what does the system do, can anyone see it, and what constrains it. An integrated product has made many of those decisions already. With Pi, you make them.

### No built-in WebUI doesn't mean no integration options

Pi has no integrated web interface, which I felt as a gap. But a missing UI and missing interfaces are different things. [Part 1](/blog/pi-agent-freedom-vs-convenience/) listed the ways to drive the same agent: interactive, print, JSON, RPC and an in-process SDK.

So a web front end isn't blocked. You could build one over RPC or the SDK. What the interfaces don't do is the work around them: rendering the UI, handling streamed output, keeping session state, deciding what happens on errors (section 3), and managing the agent's lifecycle. The SDK page even names a subtlety you'd have to handle: `agent_end` marks the end of one run, while `agent_settled` signals that Pi won't continue automatically. I haven't built such a front end, so this describes the documented surface and not my experience.

The details are where the work hides ([RPC](https://pi.dev/docs/latest/rpc)). The figure shows the shape of one prompt over the RPC interface, and the part a naive client gets wrong.

![RPC prompt lifecycle between a client and pi --mode rpc. The client sends a prompt with an id. Pi replies with a response carrying the same id and success true, which means the prompt was accepted, queued or handled, not finished. Pi then streams message_update events, then agent_end when one run is over, possibly compaction and retry events and another run, and finally agent_settled, which means Pi will not continue on its own.](./images/rpc-lifecycle.svg)

<div class="callout documented">

<span class="label documented">Documented</span> Records are JSON objects terminated by LF, and clients should split only on LF: the docs warn that Node.js `readline` also splits on U+2028 and U+2029, which can appear inside JSON strings. Stdout carries only protocol records, and diagnostics go to stderr. Commands take an optional `id` that the response repeats, and responses can arrive out of order. A successful `prompt` response means the prompt was accepted, queued or handled, not that the work finished. If `data.disposition` is `"handled"`, no run starts and `agent_settled` won't follow. Clients should subscribe before sending the prompt, and closing stdin requests an orderly exit. The command set covers sessions (`fork`, `clone`, `get_tree`, `export_html`), models (`set_model`, `set_thinking_level`) and `compact`, so a front end could offer much of what the TUI does. Extension dialogs and notifications are forwarded over RPC, but custom components aren't. ([RPC](https://pi.dev/docs/latest/rpc), [extensions guide](https://pi.dev/docs/latest/extensions))

</div>

<div class="callout opinion">

<span class="label opinion">Opinion</span> A client that treats the first response as completion, or reads lines with a generic reader, can work in a demo and misbehave later. None of this is hard, but it is the kind of detail a missing WebUI hands to you.

</div>

<div class="callout opinion">

<span class="label opinion">Opinion</span> The missing WebUI is a small version of the whole trade-off. The ready-made experience isn't there, and a custom one is possible, but whoever builds it owns it. I don't claim the omission was a philosophical choice. The docs I read don't say.

</div>

## 6. Practical experiments and lessons learned

The earlier sections mix documented behavior, my interpretation and proposals. This one pulls out what I actually did and saw, and what that can support. My experiments were exploratory, and I didn't record versions, configuration, logs or reproduction steps for them. So these aren't full case studies, and I would rather say so than reconstruct detail I don't have.

### Case 1: watching delegated work

- **Objective.** Handle long sessions and large contexts by delegating to sub-agents, with an orchestrator I built as an extension.
- **Environment.** Extensions I wrote myself. The Pi version, extension code and settings weren't recorded. The 1.3.0 snapshot at the top of this article refers to the documentation I checked on October 20, 2026, not necessarily to the version I ran.
- **Observed.** <span class="label observed">Observed</span> The main agent could keep reporting that work was in progress while I had little or no clear view of what a sub-agent was doing.
- **Interpretation.** A general progress signal isn't the same as being able to inspect execution. A delegating system needs status versus progress, execution events, tracing across levels and failure handling if you want to trust it. Pi documents the seams for this (tool and provider events, `parentToolCallId`, `session.subscribe()`), but the docs I read describe no finished view built from them.
- **Limitations.** One builder, one setup, no controlled comparison. I can't say whether my extension lacked a mechanism that Pi's building blocks would have supplied, and I haven't verified how the events behave across separate child Pi processes. This says nothing about delegation in Pi in general.

### Case 2: execution that stopped

- **Objective.** None. This came up during normal use, not a planned experiment.
- **Environment.** Not recorded.
- **Observed.** <span class="label observed">Observed</span> Model response errors, incorrect tool usage and context window exhaustion. In some cases execution stopped without recovering in a way that let the task continue, and I had to diagnose the problem, adjust the state or my approach, and resume. Some failures resolved after a minor interruption. Others stopped the task from progressing.
- **Interpretation.** Executing a task and recovering from a failure are separate properties. Pi documents bounded automatic retry and recovery compaction, so what I saw is not evidence of a missing feature.
- **Limitations.** I didn't map individual failures to the built-in paths, so I can't say which fell inside or outside them, or whether the defaults were exhausted. There are no logs or reproduction steps.

### What the Docker attempt does not show

I tried running Pi inside a Docker container as a sandbox. I didn't record the configuration or the result, so it is not evidence for or against container isolation. Everything about containers in section 4 comes from Pi's documentation and general container security, not from my attempt.

### What I would take from this

- <span class="label proposal">Proposal</span> Before delegating, decide who owns the view of what the children are doing.
- <span class="label proposal">Proposal</span> Decide what "recovered" means for your workflow before the first failure: retries, how a bad tool call is handled, what survives compaction, and when to stop and hand the task back to a person.
- <span class="label proposal">Proposal</span> Treat the container as the boundary and hooks as guardrails.
- <span class="label proposal">Proposal</span> When you experiment, record the Pi version, the extension code and settings, and the failing request or log, so the result can be reproduced and checked.

None of these recommendations has been tested by me beyond the experiments described above.

## 7. Choosing between Pi and an integrated coding agent

The analysis so far reduces to a few dimensions. The table says where each choice tends to fit. It is not a ranking, and it says nothing about coding quality, which I haven't tested.

| Dimension | Pi tends to fit when… | An integrated agent tends to fit when… |
|---|---|---|
| Need for customization | The shape of the agent environment is itself a requirement: custom tools, hooks, context handling, providers. | The shipped tools, plugins and hooks already cover what you need. |
| Built-in integration | You are willing to assemble planning, delegation and approvals yourself. | You want those decisions made and maintained for you. |
| Control over tools and execution | You want to choose exactly what the model sees (`--tools`, `exposure`) and hook every call. | Permission rules and modes give you enough control. |
| Security and deployment | You will supply the boundary: a container, VM or sandbox with narrow mounts and scoped credentials. Pi documents these options but doesn't enforce them. | You want an approval policy or an OS-level sandbox that ships with the product, as Codex documents. |
| Observability and debugging | You can build the view you need from events and the session tree. | A finished view matters more than the ability to shape it. (I haven't compared the views built into integrated products.) |
| Engineering and maintenance cost | You can own extension code and keep it working as Pi changes. The package rename is one example. | You would rather someone else maintained it. |
| Workflow complexity | Your workflow is specific enough that a ready-made one would be something to work around. | Common workflows (plan, delegate, approve) are enough. |

<div class="callout opinion">

<span class="label opinion">Opinion</span> Two cautions. First, the columns aren't exclusive. Claude Code has hooks, skills, sub-agents, plugins and MCP, and Pi has MCP and a scripting tool, so the products are moving toward each other ([Part 1](/blog/pi-agent-freedom-vs-convenience/) compares what each ships). Second, the right choice depends on your team's requirements and constraints, not on a universal ranking. If you can't name a requirement from the left column, the lower setup and maintenance cost of an integrated agent is probably the better default.

</div>

## 8. Conclusion: when is freedom worth the responsibility?

<div class="callout opinion">

<span class="label opinion">Opinion</span> Use Pi when you want more than an agent that works out of the box. Use it when you want to understand how the agent operates, reshape its workflow, extend its capabilities, and take responsibility for the system you build around it. The sections above are what that responsibility looked like in my experiments: designing delegation, making it observable, deciding what recovery means when a run fails, deciding where the permission boundary sits, and fitting the agent into a project's workflow.

If your priority is getting work done with as little setup and maintenance as possible, a more integrated product may be the better choice. There's nothing inherently wrong with choosing convenience over control, and nothing inherently better about building everything yourself.

</div>

Working with Pi made me more aware of a trade-off that's easy to overlook: **freedom transfers responsibility.** The more control you have over a system, the more decisions you need to make to turn that control into a reliable working experience. Pi's own documentation says as much about permissions: it tells you to bring the container, and documents four ways to do it.

So the question isn't whether Pi is better than other coding agents. I haven't tested that, and this article makes no claim about it. The question is whether the freedom Pi offers is worth the additional work you're willing to take on. Part 1 opened with a powerful model in a thin environment. The thin environment is the offer, and the work of filling it in is the price.

**Freedom gives you the ability to build the system you want. Convenience lets you spend less time building the system in the first place.**

<div class="callout opinion">

<span class="label opinion">Opinion</span> I now evaluate a coding agent by more than the quality of the code it generates. I also look at where its permission boundary sits, how it fails and recovers, whether I can see what it's doing, and what it costs to fit it into a project's workflow. Those are the questions the sections above kept returning to.

</div>

In practice:

- <span class="label proposal">Proposal</span> Start from the requirement. If shaping the agent environment (tools, hooks, context, how it is driven) is itself a requirement, Pi is a candidate. If it isn't, start with an integrated agent.
- <span class="label proposal">Proposal</span> Before you begin, decide who owns observability, recovery and the boundary, and write the answer down. Treat the container, not a hook, as the wall.
- <span class="label proposal">Proposal</span> Trial Pi on one bounded workflow, and record versions and configuration so you can reproduce and evaluate the result.

<div class="callout">

**Part 2 of 2.** ← [Back to Part 1: Freedom vs. Convenience — Understanding the Architecture](/blog/pi-agent-freedom-vs-convenience/)

</div>

## References

**Pi: official docs and source**

- [Extensions](https://pi.dev/docs/latest/extensions), [SDK](https://pi.dev/docs/latest/sdk), [How Pi works](https://pi.dev/docs/latest/how-pi-works), [Security](https://pi.dev/docs/latest/security), [Configuration](https://pi.dev/docs/latest/configuration), [Settings](https://pi.dev/docs/latest/settings), [Compaction](https://pi.dev/docs/latest/compaction), [RPC](https://pi.dev/docs/latest/rpc), [Containerization](https://pi.dev/docs/latest/containerization)
- [earendil-works/pi](https://github.com/earendil-works/pi): [`extensions.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [`read.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/read.ts), [`path-utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/path-utils.ts), [`utils/paths.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/utils/paths.ts)

**Comparison and background**

- Claude Code, [Tools reference](https://code.claude.com/docs/en/tools-reference), [MCP (including tool search)](https://code.claude.com/docs/en/mcp), [Skills](https://code.claude.com/docs/en/skills), [Configure permissions](https://code.claude.com/docs/en/permissions) and [Permission modes](https://code.claude.com/docs/en/permission-modes)
- Docker, [Docker security](https://docs.docker.com/engine/security/)
