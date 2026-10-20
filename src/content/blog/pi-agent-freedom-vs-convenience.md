---
title: 'Pi Agent: The Trade-off Between Freedom and Convenience'
description: 'Pi gives you a small agent core and an extension API, and hands you the rest. My experiments with extensions, sub-agents and sandboxing show what that freedom is worth, and the engineering and operating work it hands back to you.'
pubDate: 2026-10-19T09:00:00+07:00
category: AI Agents
tags: [pi, coding-agents, security, architecture, claude-code]
featured: false
draft: true
---

<div class="callout">

**How to read this article.** Pi changes quickly, so claims carry labels:

- <span class="label documented">Documented</span>: stated in official docs, source code, or the authors' posts, linked next to the claim.
- <span class="label observed">Observed</span>: something I experienced first-hand. Not a controlled test.
- <span class="label opinion">Opinion</span>: my interpretation.
- <span class="label proposal">Proposal</span>: an idea worth evaluating. Not something I've tested or Pi ships.

**Versions.** Pi claims refer to `@earendil-works/pi-coding-agent` **1.3.0** (the npm `latest` tag when I checked on October 19, 2026) and the Pi docs on that date. I don't benchmark output quality anywhere, and nothing here says which agent writes better code.

</div>

## 1. The first surprise

<div class="callout observed">

<span class="label observed">Observed</span> Using Pi felt like having access to some of the most powerful technology available, then finding myself rebuilding things that seemed almost primitive by comparison. The model was strong. The environment around it was thin, next to the integrated coding products I'd used before.

</div>

That contrast is a statement about where the work sits, not about quality. In an integrated product, many supporting capabilities already exist when you open it. With Pi, I could change or build those pieces myself, and I started doing that.

<div class="callout author-input">

<span class="label author-input">Author input required</span> Earlier notes say I saw Pi read files outside my project without a permission prompt, unlike another agent. Please confirm the circumstances (which project, which file, which other agent) or tell me to cut it. Until then I treat it only as a question that started an investigation, not as evidence.

</div>

This article follows one argument. **Pi gives developers more freedom to shape the system around a model, and that freedom transfers responsibility to them.** Convenience doesn't disappear. It becomes something you build, integrate, test and maintain. I'll go from the architecture, through my experiments, to what happens when execution fails, the permission boundary, the workflow problem and Code Mode, and end on what I think the trade-off is.

## 2. What Pi is

<div class="callout documented">

<span class="label documented">Documented</span> Pi was introduced by Mario Zechner in [*What I learned building an opinionated and minimal coding agent*](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) (November 2025). The code now lives at [earendil-works/pi](https://github.com/earendil-works/pi). The agent loop adds your message to the active branch, streams the model's response, executes tool calls, records results, and starts another turn if needed. Five interfaces share the same agent and session mechanisms: interactive terminal, print, JSON (JSONL events), RPC (JSONL on stdin/stdout), and an in-process TypeScript SDK. ([How Pi works](https://pi.dev/docs/latest/how-pi-works))

</div>

![Layered architecture of Pi. Four ways to drive it (interactive TUI, print/JSON, RPC, TypeScript SDK) sit on top of pi-coding-agent (sessions, context files, compaction, trust, settings), which sits on pi-agent-core (the agent loop) and pi-ai (a unified LLM API). Extensions hook into the coding agent from the side and can register tools and commands or block tool calls. At the bottom, the built-in tools run as the OS user that started Pi, with no path fence or approval prompt by default.](./images/pi-architecture.svg)

Four built-in tools are on by default: `read`, `bash`, `edit` and `write`. `grep`, `find` and `ls` are opt-in ([CLI reference](https://pi.dev/docs/latest/cli)). The homepage lists what Pi deliberately leaves out: "No sub-agents", "No plan mode", "No permission popups". For each it points to extensions, packages, or other tools instead ([pi.dev](https://pi.dev)).

The docs separate the customization mechanisms, and the difference matters for everything below ([How Pi works](https://pi.dev/docs/latest/how-pi-works)):

| Mechanism | What it is | Enforcement |
|---|---|---|
| Skills and context files | Instructions the model reads, loaded on demand or at start | None. The model may ignore them. |
| Prompt templates | Reusable message text expanded from your input | None. |
| Extensions | TypeScript modules loaded into the Pi process. They register tools, commands, providers, event handlers and UI. | Code. They can block tool calls, and run with the process's OS permissions. |
| Packages | A way to distribute extensions, skills, templates and themes through npm or git | Same as their contents. |

The homepage says MCP is now built in, together with Codemode (section 9).

These layers answer different questions, and picking the wrong one is the easy mistake. Before writing code, ask what the requirement actually is:

- **Instructions or reusable knowledge** (how this repo builds, which conventions apply): a context file, a skill, or a prompt template. A skill fits when a workflow "needs more context than a prompt template but does not need a new executable integration point" ([Skills](https://pi.dev/docs/latest/skills)).
- **Runtime behavior or tool execution** (block a call, add a tool, change what the model sees): an extension.
- **Integration with other systems:** an extension, MCP, or driving Pi from outside through RPC or the SDK (section 8).
- **Distribution and upkeep of a set of these:** a package. Packages are only a delivery mechanism, and they "can execute extension code and can include skills that instruct the model to run programs", so reviewing their source is on you ([Packages](https://pi.dev/docs/latest/packages)).

<div class="callout opinion">

<span class="label opinion">Opinion</span> Reaching for an extension when a skill would do means owning TypeScript that has to track Pi's API. Reaching for a skill when you need enforcement means relying on a model that may ignore it. I haven't described a case where I chose wrongly, and I won't invent one. The point is that the extension API is powerful enough that the choice is easy to skip.

</div>

<div class="callout opinion">

<span class="label opinion">Opinion</span> The question that follows is whether Pi is a complete coding application or an agent foundation you build on. I read it as the second. My experiments are what pushed me there.

</div>

## 3. Building the missing pieces

<div class="callout observed">

<span class="label observed">Observed</span> I experimented with extensions to get capabilities I didn't find in the form I wanted:

- an **orchestrator**,
- **sub-agents** to handle work with long sessions or a lot of context,
- extensions intended to **restrict permissions**,
- an attempt to run **Pi inside a Docker container** as a sandbox, to investigate execution permissions.

These ran into implementation difficulties and errors. Even so, they taught me more about how an agent works internally.

</div>

<div class="callout author-input">

<span class="label author-input">Author input required</span> This is the personal centre of the article, and I have no further details. If you want it to read as a story (motivation, experiment, difficulty, question, insight), please give me one concrete example. For instance: what the orchestrator was supposed to do, one error you hit, or one thing you only understood after building it. I won't invent any of it.

</div>

What I can say without inventing anything is what the documentation sets up. Pi names "no sub-agents" as a choice. Its extension guide doesn't mention sub-agents either, though it does let an extension run other tools with `ctx.executeTool()`, and those nested calls pass through the same `tool_call` handlers as model-issued ones ([extensions guide](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)). So an orchestrator isn't something you configure. It's something you design.

### Context is more than a window

Long contexts were the reason I wanted sub-agents, so it's worth being exact about what Pi's own mechanisms do. Three things are easy to blur together:

<div class="callout documented">

<span class="label documented">Documented</span> Sessions are saved automatically (unless `--no-session`) under `~/.pi/agent/sessions/`, grouped by working directory. "Pi stores entries as a tree, so returning to an earlier point does not erase the branch you leave." `/tree` moves within the current session file, `/fork` creates a new session from an earlier user message, and `/clone` copies the active branch into a new one. The model receives only the active branch, not every branch in the file ([Sessions](https://pi.dev/docs/latest/sessions)). Compaction "does not delete the original session entries": a summary entry stands in for older messages in later requests, and the originals stay in the tree ([How Pi works](https://pi.dev/docs/latest/how-pi-works)).

</div>

- **Compaction** manages what the model sees *now*. It replaces older messages with a summary, so what the summary keeps decides what the agent knows afterwards.
- **Persistence** keeps the full record on disk, including what compaction hid from the model.
- **Branching** controls *direction*: you can go back to an earlier point and try another approach without losing the one you left.

<div class="callout opinion">

<span class="label opinion">Opinion</span> So context management isn't only about fitting more into a window. It's also about choosing which history the agent carries forward and which path it takes next. But none of this is shown to solve exhaustion by itself. Compaction can fail (the docs say you retry with `/compact`), a summary is lossy by nature, and the on-disk record doesn't re-enter the model's context on its own. Branching helps a person steer; it doesn't make a long task continue by itself. I haven't tested how these features behave under my orchestrator experiments, so I can't say whether they'd have removed the need for sub-agents.

</div>

## 4. When delegation becomes hard to see

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

Put together, three properties are separate, and an agent can have the first without the others:

- **Execution:** it can perform actions.
- **Observability:** you can tell what it is doing and where it is.
- **Control:** you can intervene, change approach, or stop it.

Delegation without observability creates a system that can act without being easy to understand. That's a conclusion about the design, not a claim that every multi-agent system works this way.

## 5. When execution stops

<div class="callout observed">

<span class="label observed">Observed</span> During normal use I ran into unexpected failures: model response errors, incorrect tool usage, and context window exhaustion. When they happened, execution could stop without automatically recovering and continuing the task. I had to step in, diagnose the problem, adjust the execution state or my approach, and find a way to resume. Depending on the failure, that was a minor interruption or a blocker that stopped the task from progressing at all.

</div>

<div class="callout author-input">

<span class="label author-input">Author input required</span> I've kept this to what you described. If you can name one failure that was a minor interruption and one that was a blocker, I can make the contrast concrete. I haven't guessed at which failure ended up in which category.

</div>

This is a different problem from the one in section 4. Observability asks whether you can see what an agent is doing. Recovery asks what happens when what it's doing breaks. An agent's ability to **execute** a task and its ability to **recover** when execution fails are separate properties. A system can be very good at the first and say little about the second.

I shouldn't overstate what Pi lacks, because it does have recovery behavior, and the docs describe it:

<div class="callout documented">

<span class="label documented">Documented</span> Pi has automatic agent-level retry for "transient failures", enabled by default, with a default of 3 attempts and exponential backoff starting at 2 seconds and capped at 60 seconds ([Settings](https://pi.dev/docs/latest/settings)). It also has automatic compaction, which starts when free context drops below a reserve (16,384 tokens by default). On a provider overflow error, Pi can attempt one compact-and-retry recovery. If that recovery fails or is cancelled, it "does not schedule an internal retry" ([Compaction](https://pi.dev/docs/latest/compaction)). When a tool itself fails, the failure becomes an error result for the model ([extensions guide](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)).

</div>

So the accurate statement isn't that Pi never recovers. Some failures have a built-in path, and some paths are bounded: three retries, one compaction attempt. The docs I read don't list which errors count as transient. They also don't describe built-in handling for a model that keeps using a tool incorrectly, or for a run that ends in a state you want to resume. I don't know whether any of my failures fell inside or outside the built-in paths. I'm not claiming they were gaps in Pi. They may have been cases where the defaults were exhausted or didn't apply.

<div class="callout opinion">

<span class="label opinion">Opinion</span> Whether a particular failure resumes by itself is less important than who decides what "recovered" means. Reliable recovery tends to need decisions about:

- **Retry strategy.** Which errors to retry, how often, and when to stop retrying and escalate.
- **Error handling.** Whether a bad tool call becomes a message to the model, a stop, or a request for you.
- **Context management.** What gets summarized or dropped when the window fills, and whether the task survives it. Compaction summarizes earlier work, so what the summary keeps shapes what the agent knows afterwards.
- **Explicit recovery workflows.** A defined way to inspect the failed state, adjust it and resume, rather than improvising each time.

</div>

Pi gives you parts of this, and its session tree, which keeps the original entries even after compaction, is a useful record to resume from ([How Pi works](https://pi.dev/docs/latest/how-pi-works)). Community packages for retry and safer compaction are listed on [pi.dev/packages](https://pi.dev/packages). I haven't evaluated them, so I can't say how well they work. In an integrated product, more of these decisions may already be made for you. With Pi, defaults are a starting point, and the rest is yours to design, test and maintain. That's the same trade-off as before, seen from the failure case: freedom to customize an agent doesn't come with a guarantee that it recovers gracefully.

## 6. The real permission boundary

My permission and Docker experiments raised the question of what actually limits an agent. A prompt, a restricted tool and a container are different things, so it helps to separate them. The loop is conceptual, not a diagram of Pi's internals:

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

<span class="label documented">Documented</span> In the source, [`read.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/read.ts) accepts relative or absolute paths, resolves them against the working directory, and checks only that the file is readable. It never compares the result to the working directory. I read this file but haven't read the path-resolution helper it calls, and I haven't run Pi's tools. Don't treat it as a tested result.

</div>

That fits the documentation: by default there's no application-level fence. But the absence of a prompt doesn't prove unrestricted access in every setup. An extension can add checks. The `tool_call` event can mutate or block a call, and a handler that throws blocks it fail-closed ([extensions guide](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)). A prompt doesn't prove comprehensive security either. Claude Code's own docs note that Read and Edit deny rules don't cover a command that reads files without naming them, and say `bypassPermissions` should be used only in isolated environments like containers or VMs ([permissions](https://code.claude.com/docs/en/permissions)). So the two agents agree about where the real boundary is. They differ in the default between you and it: Claude Code asks for shell commands, edits and web fetches, and reads outside the working directory need approval unless you configure otherwise. Pi asks for nothing.

![Three setups compared by the path a tool call takes. Pi default: no application check and no OS sandbox, so the call can reach everything the OS user can access. Pi hardened (a proposal): your extension blocks or confirms calls, a container or VM mounts only the project, so the call reaches the mounted project and scoped credentials. Claude Code in default mode: permission rules and mode prompt for reads outside the working directory, an optional sandbox setting exists, and the call reaches the OS user's access filtered by approvals.](./images/permission-layers.svg)

Two Pi-specific details are easy to miss:

- **Project trust is not a sandbox.** It gates what a folder supplies: project settings and MCP servers, extensions, skills, prompt templates and themes under `.pi`, system-prompt files, and project-configured packages. It "prevents a folder from silently loading executable extensions before you approve it", and the security page says it "does not limit what tool calls can access or affect". Extensions run "inside the Pi process with the same operating-system permissions", so a trusted extension can read prompts, tool calls, files and session history ([extensions guide](https://pi.dev/docs/latest/extensions)). Context files (`AGENTS.md`, `CLAUDE.md`) load without trust ([Configuration](https://pi.dev/docs/latest/configuration)). Instructions in a repository you cloned can reach the model whether or not you trusted it. Whether a given model would act on a hostile instruction is a separate question I haven't tested.

In short, three questions get mixed up. **Trust** asks whether a folder's own resources may load. **Permissions** ask what the running process and its tools can technically do. **Isolation** asks what stays out of reach even if an agent or extension misbehaves. Pi's docs provide the first, describe the second, and leave the third to you. I haven't audited Pi's security beyond reading these pages and one tool's source.
- **Docker is a tool, not a guarantee.** What a container actually isolates depends on what you mount, which credentials you pass in, whether the network is open, and which user it runs as. A container that mounts your home directory and an API key with broad scope has moved the problem, not solved it.

<div class="callout author-input">

<span class="label author-input">Author input required</span> What did your Docker attempt actually run, and what happened (which mounts, which errors, what you concluded)? I'd like to state only what you tested, so I've said nothing about its results.

</div>

<div class="callout proposal">

<span class="label proposal">Proposal</span> If I used Pi on real work, I'd start with the container documented as the strongest option, mount only the project, and pass a scoped key. I'd add a `tool_call` extension for visibility and catching mistakes, not as the wall. I haven't tested this setup.

</div>

## 7. From agent to workflow

Once I looked at using Pi in projects that already used AI-assisted development, a different problem appeared. Capability isn't workflow. A capable agent doesn't know how a project builds, which conventions it follows, which tests must pass, or when work counts as done.

<div class="callout author-input">

<span class="label author-input">Author input required</span> My notes say I explored using Pi in an existing AI-assisted project, but give no incident. I've kept this section to design considerations. If something specific went wrong or right, tell me and I'll add it as a first-hand observation.

</div>

<div class="callout opinion">

<span class="label opinion">Opinion</span> **Capabilities say what the agent can do. Workflow says how work proceeds, under which constraints, and how completion is checked.** Fitting an agent into an existing project raises questions like:

- **Context.** Where do project rules live? Pi loads `AGENTS.md` and `CLAUDE.md` as context files, so existing instructions can carry over. Instructions still aren't enforcement.
- **Tools.** Existing scripts work through `bash`. That's cheap, but the model has to learn them from a README or `--help`.
- **Coordination.** If other AI-assisted processes touch the same repository, who decides what runs when?
- **Validation.** Who ensures tests and reviews actually run? Instructions are advisory. An extension or an external harness (RPC, JSON mode, SDK) is where checks can be enforced.
- **Handoff.** How does the agent say it's finished, and how does the next person or process know?

</div>

This is where the earlier sections meet. The sub-agent visibility gap and the permission boundary are both workflow questions: what does the system do, and can anyone see or constrain it. An integrated product has made many of those decisions already. With Pi, you make them.

## 8. No built-in WebUI doesn't mean no integration options

Pi has no integrated web interface, which I felt as a gap. But a missing UI and missing interfaces are different things. The docs list several ways to drive the same agent ([CLI](https://pi.dev/docs/latest/cli), [How Pi works](https://pi.dev/docs/latest/how-pi-works)):

| Interface | Intended use |
|---|---|
| Interactive (default) | Terminal UI for a person. |
| Print (`-p`) | One prompt, final text to stdout, then exit. |
| JSON (`--mode json`) | One-shot run that writes agent events as JSONL. |
| RPC (`--mode rpc`) | Long-running process driven by JSONL commands on stdin, events on stdout. |
| SDK | TypeScript library creating and controlling sessions in-process. |

So a web front end isn't blocked. You could build one over RPC or the SDK. What the interfaces don't do is the work around them: rendering the UI, handling streamed output, keeping session state, deciding what happens on errors (section 5), and managing the agent's lifecycle. The SDK page even names a subtlety you'd have to handle: `agent_end` marks the end of one run, while `agent_settled` signals that Pi won't continue automatically. I haven't built such a front end, so this describes the documented surface and not my experience.

<div class="callout opinion">

<span class="label opinion">Opinion</span> The missing WebUI is a small version of the whole trade-off. The ready-made experience isn't there, and a custom one is possible, but whoever builds it owns it. I don't claim the omission was a philosophical choice. The docs I read don't say.

</div>

## 9. Code Mode: a design direction I haven't tried

I found Pi's Code Mode in the docs. I **haven't used it on a real task**, so this section describes the documented design and nothing about results.

<div class="callout documented">

<span class="label documented">Documented</span> Code Mode lets the model write a JavaScript script that calls Pi's other tools. The script runs in a QuickJS sandbox, and "only the script's output reaches the model", so a script can batch calls and filter large results before anything enters the context. Each tool is a method on `tools`, MCP tools are callable the same way, and failed calls reject so `Promise.allSettled()` can keep partial results. The sandbox has no Node APIs, file system, network or timers: "scripts reach the outside world only through tools and `models`". Documented limits include a default output cap of 10,000 tokens, a 256 MB memory limit, no nested codemode scripts, and at most two codemode workers alive in one Pi process. A failed script keeps its partial output, and tool calls made before the failure aren't undone. ([Code Mode docs](https://pi.dev/docs/latest/codemode))

</div>

<div class="callout documented">

<span class="label documented">Documented</span> Earendil's post [*You Said No MCP!*](https://earendil.com/posts/you-said-no-mcp/) (September 29, 2026) says MCP is now in Pi's core, that Codemode runs on the harness side, and that it loads automatically when MCP is configured. It reverses the launch post's statement that Pi "does not and will not support MCP". The same post admits they "did not yet upgrade our tool loadout to better scale to these new capabilities".

</div>

<div class="callout opinion">

<span class="label opinion">Opinion</span> Code Mode and multi-agent orchestration solve different problems. Code Mode composes **tool calls** inside one agent turn, so intermediate results don't cost context or round trips. Orchestration splits **work** across agents, each with its own model interaction. Code Mode doesn't replace the orchestrator I tried to build, and I can't say it would have helped. What I find interesting is that the sandbox is explicit: the script's reach is exactly the tools it's given. The trade-off from section 4 still applies. A script that batches many calls into one output is efficient, and also a place where intermediate activity is hidden from the model.

</div>

I'd like to try it on a real task before judging it. Until then it stays a hypothesis.

## 10. Freedom, convenience, and who owns the system

What do these experiments add up to? Extensibility is the point of Pi: programmable behavior, a single hook where every tool call can be inspected or refused, event streams you can build on, and a core small enough to understand. Each of those has a matching cost, and the cost is the same each time. The decision moved to me.

| What Pi gives you | What it asks of you |
|---|---|
| Shape more of the system | Decide what's in it, and maintain it |
| Custom behavior fitted to your needs | Test it, and keep it working as Pi changes. Packages moved npm scopes once: `@mariozechner/pi-coding-agent` dates from November 2025, `@earendil-works/pi-coding-agent` from May 2026, per the npm registry. |
| See and change architectural decisions | Make them well: permissions, isolation, observability, recovery from failure |
| No bundled policy to fight | Supply your own, or work without one |

Integrated products aren't the opposite of extensible. Claude Code, for example, has hooks, skills, sub-agents, plugins and MCP, and Pi isn't without conveniences. The difference is **how much is decided for you by default, and who maintains it**.

## 11. When should you use Pi?

<div class="callout opinion">

<span class="label opinion">Opinion</span> Use Pi when you want more than an agent that works out of the box. Use it when you want to understand how the agent operates, reshape its workflow, extend its capabilities, and take responsibility for the system you build around it. The sections above are what that responsibility looked like in my experiments: designing delegation, making it observable, deciding what recovery means when a run fails, deciding where the permission boundary sits, and fitting the agent into a project's workflow.

If your priority is getting work done with as little setup and maintenance as possible, a more integrated product may be the better choice. There's nothing inherently wrong with choosing convenience over control, and nothing inherently better about building everything yourself.

</div>

Working with Pi made me more aware of a trade-off that's easy to overlook: **freedom transfers responsibility.** The more control you have over a system, the more decisions you need to make to turn that control into a reliable working experience. Pi's own documentation says as much about permissions: it tells you to bring the container.

So the question isn't whether Pi is better than other coding agents. I haven't tested that, and this article makes no claim about it. The question is whether the freedom Pi offers is worth the additional work you're willing to take on. I opened with a powerful model in a thin environment. The thin environment is the offer, and the work of filling it in is the price.

**Freedom gives you the ability to build the system you want. Convenience lets you spend less time building the system in the first place.**

<div class="callout author-input">

<span class="label author-input">Author input required</span> Please confirm this conclusion matches your view, and add one or two sentences on how the experiments changed what you look for in a coding agent.

</div>

## References

**Pi: official docs and source**

- [pi.dev](https://pi.dev), [Sessions](https://pi.dev/docs/latest/sessions), [Skills](https://pi.dev/docs/latest/skills), [Packages](https://pi.dev/docs/latest/packages), [Extensions](https://pi.dev/docs/latest/extensions), [SDK](https://pi.dev/docs/latest/sdk), [How Pi works](https://pi.dev/docs/latest/how-pi-works), [Security](https://pi.dev/docs/latest/security), [Configuration](https://pi.dev/docs/latest/configuration), [Settings](https://pi.dev/docs/latest/settings), [Compaction](https://pi.dev/docs/latest/compaction), [CLI](https://pi.dev/docs/latest/cli), [Code Mode](https://pi.dev/docs/latest/codemode)
- [earendil-works/pi](https://github.com/earendil-works/pi): [`extensions.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [`read.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/read.ts)

**Pi: authors' posts**

- Mario Zechner, [*What I learned building an opinionated and minimal coding agent*](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/), November 2025
- Earendil, [*You Said No MCP!*](https://earendil.com/posts/you-said-no-mcp/), September 29, 2026

**Comparison**

- Claude Code, [Configure permissions](https://code.claude.com/docs/en/permissions)
