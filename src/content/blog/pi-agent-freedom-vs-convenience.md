---
title: 'Pi Agent: Freedom vs. Convenience — Understanding the Architecture'
description: 'Part 1 of 2. Pi gives you a small agent core and an extension API. This part covers its design philosophy, the agent loop, tool calling, context management, and what that flexibility costs next to an integrated coding agent.'
pubDate: 2026-10-19T09:00:00+07:00
updatedDate: 2026-10-21T00:00:00+07:00
category: AI Agents
tags: [pi, coding-agents, security, architecture, claude-code]
featured: false
draft: false
---

<div class="callout">

**Part 1 of 2.** This part explains Pi's architecture and what its design makes possible. [Part 2: From Flexibility to Responsibility](/blog/pi-agent-freedom-vs-convenience-part-2/) covers what you have to build and maintain to make that flexibility reliable and secure.

</div>


<div class="callout">

**How to read this article.** Pi changes quickly, so claims carry labels:

- <span class="label documented">Documented</span>: stated in official docs, source code, or the authors' posts, linked next to the claim.
- <span class="label observed">Observed</span>: something I experienced first-hand. Not a controlled test.
- <span class="label opinion">Opinion</span>: my interpretation.
- <span class="label proposal">Proposal</span>: an idea worth evaluating. Not something I've tested or Pi ships.

**Versions.** Pi claims refer to `@earendil-works/pi-coding-agent` **1.3.0** (the npm `latest` tag when I checked on October 20, 2026), the Pi docs and repository, and the docs of Claude Code and OpenAI Codex (plus Codex's open-source repository, commit `e18a20d`) on that date. All of these change quickly, so treat version-specific details as a snapshot. I don't benchmark output quality anywhere, and nothing here says which agent writes better code.

</div>

## 1. The first surprise

<div class="callout observed">

<span class="label observed">Observed</span> Using Pi felt like having access to some of the most powerful technology available, then finding myself rebuilding things that seemed almost primitive by comparison. The model was strong. The environment around it was thin, next to the integrated coding products I'd used before.

</div>

That contrast is a statement about where the work sits, not about quality. In an integrated product, many supporting capabilities already exist when you open it. With Pi, I could change or build those pieces myself, and I started doing that.

This article follows one argument. **Pi gives developers more freedom to shape the system around a model, and that freedom transfers responsibility to them.** Convenience doesn't disappear. It becomes something you build, integrate, test and maintain. This is Part 1 of two. It covers the architecture that makes that freedom possible: Pi's design philosophy, the agent loop, tool calling and extension points, context management, Code Mode, and how all of it compares with integrated coding agents. [Part 2](/blog/pi-agent-freedom-vs-convenience-part-2/) covers what the freedom costs in practice: orchestration, recovery, trust and isolation, and when the trade-off is worth it.

I'm writing for developers who care about how coding agents work inside, how far they can be customized, and what customization asks of them. This is an architecture and trade-off analysis. It is not a benchmark, an installation guide or a feature tour.

## 2. Design philosophy: primitives, not a ready-made workflow

<div class="callout documented">

<span class="label documented">Documented</span> Pi was introduced by Mario Zechner in [*What I learned building an opinionated and minimal coding agent*](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) (November 2025). The code now lives at [earendil-works/pi](https://github.com/earendil-works/pi). The agent loop adds your message to the active branch, streams the model's response, executes tool calls, records results, and starts another turn if needed. Five interfaces share the same agent and session mechanisms: interactive terminal, print, JSON (JSONL events), RPC (JSONL on stdin/stdout), and an in-process TypeScript SDK. ([How Pi works](https://pi.dev/docs/latest/how-pi-works))

</div>

![Layered architecture of Pi. Four ways to drive it (interactive TUI, print/JSON, RPC, TypeScript SDK) sit on top of pi-coding-agent (sessions, context files, compaction, trust, settings), which sits on pi-agent-core (the agent loop) and pi-ai (a unified LLM API). Extensions hook into the coding agent from the side and can register tools and commands or block tool calls. At the bottom, the built-in tools run as the OS user that started Pi, with no path fence or approval prompt by default.](./images/pi-architecture.svg)

Four built-in tools are on by default: `read`, `bash`, `edit` and `write`. Four more built-ins (`grep`, `find`, `ls` and the Windows-only `powershell`) are opt-in ([CLI reference](https://pi.dev/docs/latest/cli)). Section 4 covers the whole tool system. The homepage lists what Pi deliberately leaves out: "No sub-agents", "No plan mode", "No permission popups". For each it points to extensions, packages, or other tools instead ([pi.dev](https://pi.dev)).

<div class="callout opinion">

<span class="label opinion">Opinion</span> The omissions describe a design stance. An integrated coding agent ships a workflow: planning, delegation and approvals are already wired together. Pi ships primitives (a loop, a few tools, hooks, a session store) and expects you to assemble the workflow you want. Neither stance is better in general. A ready-made workflow saves work, and primitives give you control over how the work is done.

</div>

<div class="callout opinion">

<span class="label opinion">Opinion</span> The question that follows is whether Pi is a complete coding application or an agent foundation you build on. I read it as the second. My experiments, described in [Part 2](/blog/pi-agent-freedom-vs-convenience-part-2/), are what pushed me there.

</div>

## 3. The agent loop

The loop itself is small. Pi appends your message to the active branch, builds a request from the system prompt, the branch, the tool definitions and the model settings, streams the reply, runs every tool call in it, and records the results. If those results or queued messages need another request, a new turn starts. Otherwise the run ends ([How Pi works](https://pi.dev/docs/latest/how-pi-works)).

![The agent loop. A message is added to the active branch, a request is built from the system prompt, branch and tools, the model streams a reply with text and tool calls, and the tool calls run with results recorded. If another request is needed the loop starts a new turn; if not, agent_end marks one run finished and agent_settled signals that Pi will not continue automatically. Below, three ways to reach into a running agent: steering with Enter lands after the current turn, a follow-up with Alt+Enter lands once pending work is done, and abort with Escape stops the run and returns queued messages to the editor.](./images/agent-loop.svg)

<div class="callout documented">

<span class="label documented">Documented</span> You can reach into a run while it is going. Enter sends a message that guides the next response and waits until the current response and its tool calls finish. Alt+Enter queues a follow-up that runs after the current task. Escape stops the task and returns queued messages to the editor ([Usage](https://pi.dev/docs/latest/usage)). Over RPC the same ideas are the `steer`, `follow_up` and `abort` commands. The RPC page also separates two signals: `agent_end` ends one low-level run, while `agent_settled` says Pi won't continue automatically ([RPC](https://pi.dev/docs/latest/rpc)).

</div>

<div class="callout opinion">

<span class="label opinion">Opinion</span> Steering is the first piece of "control" that [Part 2](/blog/pi-agent-freedom-vs-convenience-part-2/) returns to, and it is control for a person at the keyboard. It says nothing about how a parent agent would steer a sub-agent. The `agent_end` / `agent_settled` split matters for the same reason recovery does in Part 2: "the run ended" and "nothing more will happen" are different statements.

</div>

### Five ways to drive the same loop

The loop doesn't depend on the terminal. The docs list several ways to drive the same agent ([CLI](https://pi.dev/docs/latest/cli), [How Pi works](https://pi.dev/docs/latest/how-pi-works)):

| Interface | Intended use |
|---|---|
| Interactive (default) | Terminal UI for a person. |
| Print (`-p`) | One prompt, final text to stdout, then exit. |
| JSON (`--mode json`) | One-shot run that writes agent events as JSONL. |
| RPC (`--mode rpc`) | Long-running process driven by JSONL commands on stdin, events on stdout. |
| SDK | TypeScript library creating and controlling sessions in-process. |

[Part 2](/blog/pi-agent-freedom-vs-convenience-part-2/) looks at what building on RPC or the SDK asks of you.

## 4. Tool calling and extension points

I've used the word "tool" throughout, and the rest of the article leans on it. Permissions, observability, sub-agents and recovery are all, underneath, questions about tool calls. So it's worth being exact about what a tool is in Pi before going further.

<div class="callout documented">

<span class="label documented">Documented</span> In Pi's extension guide, a tool "defines a name, model-facing description, TypeBox parameter schema, and `execute()` function" ([extensions guide](https://pi.dev/docs/latest/extensions)). Pi's built-in tools have the same shape: each file under [`src/core/tools`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/src/core/tools) defines a description, a TypeBox schema and an implementation. The model never touches your file system. It emits a structured request, and Pi's code does the work.

</div>

### Four layers of customization

The docs separate the customization mechanisms, and the difference matters for everything below ([How Pi works](https://pi.dev/docs/latest/how-pi-works)):

| Mechanism | What it is | Enforcement |
|---|---|---|
| Skills and context files | Instructions the model reads, loaded on demand or at start | None. The model may ignore them. |
| Prompt templates | Reusable message text expanded from your input | None. |
| Extensions | TypeScript modules loaded into the Pi process. They register tools, commands, providers, event handlers and UI. | Code. They can block tool calls, and run with the process's OS permissions. |
| Packages | A way to distribute extensions, skills, templates and themes through npm or git | Same as their contents. |

The homepage says MCP is now built in, together with Codemode (section 6).

These layers answer different questions, and picking the wrong one is the easy mistake. Before writing code, ask what the requirement actually is:

- **Instructions or reusable knowledge** (how this repo builds, which conventions apply): a context file, a skill, or a prompt template. A skill fits when a workflow "needs more context than a prompt template but does not need a new executable integration point" ([Skills](https://pi.dev/docs/latest/skills)).
- **Runtime behavior or tool execution** (block a call, add a tool, change what the model sees): an extension.
- **Integration with other systems:** an extension, MCP, or driving Pi from outside through RPC or the SDK (see the interface table in section 3).
- **Distribution and upkeep of a set of these:** a package. Packages are only a delivery mechanism, and they "can execute extension code and can include skills that instruct the model to run programs", so reviewing their source is on you ([Packages](https://pi.dev/docs/latest/packages)).

<div class="callout opinion">

<span class="label opinion">Opinion</span> Reaching for an extension when a skill would do means owning TypeScript that has to track Pi's API. Reaching for a skill when you need enforcement means relying on a model that may ignore it. I haven't described a case where I chose wrongly, and I won't invent one. The point is that the extension API is powerful enough that the choice is easy to skip.

</div>

### One tool call, step by step

![Sequence diagram of one tool call. Four lanes: the model, the agent loop, extensions, and the tool. Step 1, the loop sends a request with the system prompt, the branch and the tool definitions. Step 2, the model replies with text and a tool call carrying a name and arguments. Step 3, the loop finds the tool and validates the arguments against its schema. Step 4, the loop runs tool_call handlers, which may mutate the input or block. Step 5, the handlers allow the call or block it with a reason that becomes an error result. Step 6, the loop calls execute on the tool. Step 7, the tool returns content and details, and throwing produces an error result. Step 8, tool_result handlers may redact, annotate or replace the result. Step 9, the next request carries the tool-result message. A note says several calls in one reply run concurrently by default, with results recorded in the order the model asked, and that a sequential tool forces the whole batch to run one at a time.](./images/tool-call-lifecycle.svg)

The five parts of the picture have different jobs:

- **The model** proposes. It sees tool definitions and decides whether to call one. It cannot run anything.
- **The agent loop** owns execution. It looks the tool up, validates the arguments, runs the hooks, calls `execute()` and turns the outcome into a message.
- **The tool definition** is the contract the model reads: name, description and parameter schema.
- **The tool's `execute()`** is ordinary code running in the Pi process, with that process's OS permissions.
- **The tool result** goes back into the active branch as a tool-result message, so the next request contains it. That is also the reason big outputs matter: whatever the result holds becomes context.

<div class="callout documented">

<span class="label documented">Documented</span> Pi's docs say each request is built from the system prompt, the active branch, "available tools" and model settings, and that Pi executes each tool call in a provider response and records the results ([How Pi works](https://pi.dev/docs/latest/how-pi-works)). The loop code adds the details in the figure: an unknown tool name returns an error result, a blocked call returns an error result carrying the handler's reason, and calls in one reply run concurrently by default unless `toolExecution` or a tool's `executionMode` says `sequential` ([agent-loop.ts](https://github.com/earendil-works/pi/blob/main/packages/agent/src/agent-loop.ts), [agent README](https://github.com/earendil-works/pi/blob/main/packages/agent/README.md)). From the extensions guide: `tool_call` handlers "can mutate input or block execution", and `tool_result` handlers can redact, annotate or replace results.

</div>

### What ships with Pi

<div class="callout documented">

<span class="label documented">Documented</span> The [CLI reference](https://pi.dev/docs/latest/cli) lists eight built-in tools, and the source's `allToolNames` set has the same eight. The docs never state a total, so "eight" is my count of that table. Four are enabled by default (`read`, `bash`, `edit`, `write`), controlled by the `defaultTools` setting ([Settings](https://pi.dev/docs/latest/settings)). The output limits in the last column come from the tool source at the repository's main branch (commit `a731ba8`, package version 1.3.0), not from the prose docs.

</div>

| Tool | Responsibility | Default | Output limit (from source) |
|---|---|---|---|
| `read` | Read text files and supported images | on | 2,000 lines or 50 KB, with `offset` / `limit` to continue |
| `bash` | Run a shell command in the working directory | on | Last 2,000 lines or 50 KB; full output saved to a temp file |
| `edit` | Apply exact text replacements to an existing file | on | n/a |
| `write` | Create or overwrite a file | on | n/a |
| `grep` | Search file contents; respects `.gitignore` | opt-in | 100 matches or 50 KB |
| `find` | Find paths by glob pattern; respects `.gitignore` | opt-in | 1,000 results or 50 KB |
| `ls` | List a directory, dotfiles included | opt-in | 500 entries or 50 KB |
| `powershell` | Run PowerShell commands, Windows only | opt-in | like `bash` |

Two more tools come from Pi's built-in *extensions*, not from the core tool set. Both are off by default ([CLI reference](https://pi.dev/docs/latest/cli)):

| Tool | Responsibility |
|---|---|
| `codemode` | The model writes JavaScript that calls other tools; only the script's output comes back (section 6) |
| `tool_search` | Finds tools that aren't declared to the model and declares the matches for the next call |

<div class="callout documented">

<span class="label documented">Documented</span> The docs say the MCP extension turns these two on "when an MCP server needs them", and that you can name them in `--tools` or `defaultTools` yourself. `--tools` replaces the whole selection, while `+name` / `-name` entries adjust the default one: `pi --tools +codemode,-write` ([CLI reference](https://pi.dev/docs/latest/cli)).

</div>

A correction to my own earlier shorthand: section 2 says four tools are on by default and `grep`, `find` and `ls` are opt-in. That's true but incomplete. There are eight built-in names including a Windows-only shell, and two more tools sit behind extensions.

### Core tools, extension tools, and your own

The question "how many tools does Pi have?" has no single answer, because tools reach the model in different ways:

| Kind | Defined by | How it reaches the model |
|---|---|---|
| Built-in tools | Pi's core (`read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`, `powershell`) | Declared when active; the first four are active by default |
| Built-in extension tools | Pi's bundled extensions (`codemode`, `tool_search`) | Registered inactive; activated by name or by the MCP extension |
| MCP tools | An MCP server you configure; named `mcp__<server>__<tool>` | Per-server `exposure`: `codemode` (default, not declared to the model), `deferred`, `direct` or `hidden` ([MCP](https://pi.dev/docs/latest/mcp)) |
| Custom extension tools | Your TypeScript extension, through `pi.registerTool()` | `direct` by default, activated on registration; other exposures are available |
| SDK tools | The host application embedding Pi, through the `customTools` option | Part of the active tool set that `tools`, `noTools` and `excludeTools` control ([SDK](https://pi.dev/docs/latest/sdk)) |

A custom tool is a small piece of code. This is Pi's own `hello.ts` example, abridged ([source](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts)):

```typescript
const helloTool = defineTool({
  name: "hello",
  label: "Hello",
  description: "A simple greeting tool",
  parameters: Type.Object({ name: Type.String({ description: "Name to greet" }) }),
  async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
    return {
      content: [{ type: "text", text: `Hello, ${params.name}!` }],
      details: { greeted: params.name },
    };
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(helloTool);
}
```

<div class="callout documented">

<span class="label documented">Documented</span> What the docs and source say about writing tools: throw from `execute()` to report a failure, because returning an error-shaped object doesn't mark the result as an error. Truncate large results and tell the model where the full output is. File-mutating tools should wrap their read-modify-write in `withFileMutationQueue()`, and tools that share mutable state should run sequentially. A tool can declare an `outputSchema` so codemode scripts get structured data while the model still gets text. A tool without a `promptSnippet` is omitted from the "Available tools" list in the default system prompt, according to the type definition's comments. An extension can also register a tool with a built-in's name to replace it. The repo's [`tool-override.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tool-override.ts) example does that to `read`, to log file access and block sensitive paths. I haven't run it. ([extensions guide](https://pi.dev/docs/latest/extensions), [`types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts))

</div>

### Tool, extension, skill, MCP server, package

The table in "Four layers of customization" above separated the customization mechanisms by what they enforce. Here is the same split by what each one does to the model's tool surface:

| Mechanism | Adds a model-callable operation? | Runs code in the Pi process? |
|---|---|---|
| Tool | Yes, it is the operation | Yes, its `execute()` |
| Extension | Yes, if it calls `registerTool()`. It can also add commands, hooks, providers and UI | Yes |
| Skill | No. The model follows its instructions with tools it already has | No |
| Prompt template | No. It expands into message text | No |
| MCP server | Yes, its tools show up as `mcp__<server>__<tool>` | The server is a separate process or remote service. Pi's MCP extension is the client |
| Package | It carries any of the above | Whatever it contains |

<div class="callout documented">

<span class="label documented">Documented</span> Pi's quickstart gives the rule of thumb: "Start with the least powerful mechanism that meets your need". Its table maps persistent folder instructions to `AGENTS.md`, task-specific instructions to a skill, and "executable tools, commands, or event handlers" to an extension ([Quickstart](https://pi.dev/docs/latest/quickstart)).

</div>

<div class="callout documented">

<span class="label documented">Documented</span> Constraints that matter for custom tools. Extensions "run inside the Pi process with the same operating-system permissions" and can read prompts, tool calls, files, credentials and session history, so the guide says to load them only from trusted sources ([extensions guide](https://pi.dev/docs/latest/extensions)). Enabled tools use the OS permissions of the Pi process, and Pi "does not ask for approval before every tool call" ([Security](https://pi.dev/docs/latest/security)). Project-local extensions and `.pi/mcp.json` load only after project trust is granted, but trust "does not limit what tool calls can access or affect".

</div>

<div class="callout opinion">

<span class="label opinion">Opinion</span> Two consequences follow. First, a custom tool is a new capability that has to be designed: a good description and schema, bounded output, honest errors and a decision about what it may touch. Nothing in Pi does that review for you. Second, a `tool_call` hook can refuse calls, but Pi's own security page puts the real boundary at the operating system, not at the hook. Read in this light, my experiments (described in [Part 2](/blog/pi-agent-freedom-vs-convenience-part-2/)) were attempts to build behavior at this layer. That's an interpretation. I'm not reporting which hooks or tools each experiment used.

</div>

### Extension hooks: where behavior can be changed

The extension API lets you change behavior at specific points in a run. The figure lists the hooks in the order they fire and what each can do: some only observe, some transform what passes through, and a few can block.

![The order of extension hooks. A run starts with input (can consume or transform), before_agent_start (changes prompt sections and tools) and agent_start. Each turn runs turn_start, context (transforms messages), before_provider_request (changes the payload), after_provider_response and the message events. Each tool call inside a turn runs tool_execution_start, tool_call (can authorize or block), tool_execution_update, tool_result (can redact or replace) and tool_execution_end, then the turn ends with turn_end. After the turns come agent_end, agent_before_settle (can request one more run) and agent_settled. A legend marks which hooks can block, which can transform, and which only observe.](./images/extension-lifecycle.svg)

<div class="callout documented">

<span class="label documented">Documented</span> `tool_call` can authorize, change or block a call, and a handler that throws blocks it. `tool_result` can redact, annotate or replace the result. `turn_end` and `agent_before_settle` can append entries and ask for a continuation, and the docs say to guard against loops. `provider_stream_event` is notification-only and awaited in stream order, so a slow handler delays the stream. `pi.events` lets extensions message each other, and `pi.appendEntry()` stores data in the session without sending it to the model. The examples directory includes `debug-provider.ts`, an opt-in viewer for raw provider stream events. ([extensions guide](https://pi.dev/docs/latest/extensions))

</div>

These hooks come back in [Part 2](/blog/pi-agent-freedom-vs-convenience-part-2/), where the question is who builds the view of what an agent is doing, and what happens when it fails.

## 5. Context management: more than a window

Start with what fills the window at all. The system prompt is Pi's base instructions plus the context files it finds. Tool definitions go out with every request, and the active branch is converted into user, assistant and tool-result messages. Skills load progressively: only each skill's name, description and path go into the system prompt, and the full `SKILL.md` is read when the model decides a task matches the description. A skill with `disable-model-invocation: true` is available only through its explicit `/skill:name` command. Your own message can carry `@` file references, pasted images and `!command` output (`!!command` runs a command without sending the output to the model), and extensions can add instructions or transform the context before the request leaves ([How Pi works](https://pi.dev/docs/latest/how-pi-works), [Skills](https://pi.dev/docs/latest/skills), [Usage](https://pi.dev/docs/latest/usage), [extensions guide](https://pi.dev/docs/latest/extensions)).

![What goes into one model request. Five sources feed it: the system prompt (Pi base instructions plus context files), tool definitions sent with every request, the skill list (name, description and path, with the full body loaded on demand), the history (the active branch, where a summary replaces old turns), and the current message (files, images, command output, expanded templates). Extensions can transform the request through hooks such as before_agent_start, context and before_provider_request, and the result goes to the provider.](./images/request-assembly.svg)

<div class="callout opinion">

<span class="label opinion">Opinion</span> Two consequences. A skill's description is its routing signal, so a vague one routes badly, which the Skills page says too. And because descriptions are always in the prompt, a large skill collection has a standing cost on every request. I haven't measured that cost, so I treat it as a design consideration and not a number.

</div>
Long contexts were the reason I wanted sub-agents (the story is in [Part 2](/blog/pi-agent-freedom-vs-convenience-part-2/)), so it's worth being exact about what Pi's own mechanisms do. Three things are easy to blur together:

<div class="callout documented">

<span class="label documented">Documented</span> Sessions are saved automatically (unless `--no-session`) under `~/.pi/agent/sessions/`, grouped by working directory. "Pi stores entries as a tree, so returning to an earlier point does not erase the branch you leave." `/tree` moves within the current session file, `/fork` creates a new session from an earlier user message, and `/clone` copies the active branch into a new one. The model receives only the active branch, not every branch in the file ([Sessions](https://pi.dev/docs/latest/sessions)). Compaction "does not delete the original session entries" ([Sessions](https://pi.dev/docs/latest/sessions)). A summary entry stands in for older messages in later requests, and the originals stay in the tree ([How Pi works](https://pi.dev/docs/latest/how-pi-works)).

</div>

- **Compaction** manages what the model sees *now*. It replaces older messages with a summary, so what the summary keeps decides what the agent knows afterwards.
- **Persistence** keeps the full record on disk, including what compaction hid from the model.
- **Branching** controls *direction*: you can go back to an earlier point and try another approach without losing the one you left.

<div class="callout documented">

<span class="label documented">Documented</span> Auto-compaction starts when the context token count exceeds the window minus `reserveTokens` (default 16,384). Pi walks backward until it has about `keepRecentTokens` (default 20,000) of recent messages, keeps those verbatim, and sends everything older to the model for a summary, passing in the previous summary if there is one. The result is stored as a compaction entry with a `firstKeptEntryId`. A cut never lands on a tool result, which must stay paired with its call, and if one user turn is too large Pi cuts inside it and merges two summaries. Summaries follow a fixed outline (Goal, Constraints & Preferences, Progress, Key Decisions, Next Steps, Critical Context) plus lists of files read and modified. `/compact [instructions]` steers what a manual summary emphasizes, `compaction.modelOverrides` sets values per model, and the `session_before_compact` extension event can cancel compaction or supply your own summary. When `/tree` moves you to another branch, Pi can also summarize the branch you left. ([Compaction](https://pi.dev/docs/latest/compaction))

</div>

![A session as a tree. Entries e1 to e8 form the active branch, and a compaction entry follows e8. A side branch b4, b5 grows from e3 and stays on disk but is not sent to the model. Entries e1 to e4 are the older span that gets summarized while their raw entries stay in the tree. Entries e5 to e8 are the recent span kept verbatim, sized by keepRecentTokens (default 20,000). The next request is the summary plus e5 to e8 plus new messages. The compaction entry stores the summary and firstKeptEntryId.](./images/session-compaction.svg)

<div class="callout opinion">

<span class="label opinion">Opinion</span> So context management isn't only about fitting more into a window. It's also about choosing which history the agent carries forward and which path it takes next. But none of this is shown to solve exhaustion by itself. Compaction can fail (the docs say to fix the provider problem and run `/compact` again), a summary is lossy by nature, and the on-disk record doesn't re-enter the model's context on its own. Branching helps a person steer; it doesn't make a long task continue by itself. I haven't tested how these features behave under my orchestrator experiments (see [Part 2](/blog/pi-agent-freedom-vs-convenience-part-2/)), so I can't say whether they'd have removed the need for sub-agents.

</div>

<div class="callout opinion">

<span class="label opinion">Opinion</span> The documented numbers show where detail can disappear. Before summarizing, Pi serializes messages as labeled text, drops thinking blocks, and cuts each tool result to 2,000 characters ([Compaction](https://pi.dev/docs/latest/compaction)). A long test log or file listing reaches the summarizer truncated. That is my inference from the documented limits. I haven't compared a real summary with its source.

</div>

## 6. Code Mode: a design direction I haven't tried

I found Pi's Code Mode in the docs. I **haven't used it on a real task**, so this section describes the documented design and nothing about results.

<div class="callout documented">

<span class="label documented">Documented</span> Code Mode lets the model write a JavaScript script that calls Pi's other tools. The script runs in a QuickJS sandbox, and "only the script's output reaches the model", so a script can batch calls and filter large results before anything enters the context. Each tool is a method on `tools`, MCP tools are callable the same way, and failed calls reject so `Promise.allSettled()` can keep partial results. The sandbox has no Node APIs, file system, network or timers: "scripts reach the outside world only through tools and `models`". Documented limits include a default output cap of 10,000 tokens, a 256 MB memory limit, no nested codemode scripts, and at most two codemode workers alive in one Pi process. A failed script keeps its partial output, and tool calls made before the failure aren't undone. ([Code Mode docs](https://pi.dev/docs/latest/codemode))

</div>

![Ordinary tool calling versus Code Mode. With ordinary tool calling, three calls and three full results all enter the context, each step a further model request. With Code Mode, the model writes one JavaScript script that runs in a QuickJS sandbox, calls tools, filters and batches, and only the script's output (default cap 10,000 tokens, partial output kept on failure) reaches the model. The sandbox has no Node APIs, file system, network or timers, a 256 MB memory limit, no nested codemode scripts and two workers per Pi process, and tool calls made before a failure are not undone.](./images/codemode-flow.svg)

<div class="callout documented">

<span class="label documented">Documented</span> Extensions decide what Code Mode can see. A tool's exposure can be `direct` (the default), `model-only`, `codemode`, `deferred` or `hidden`, and tools can declare a namespace and MCP-style annotations. Extensions can also register MCP servers with `pi.registerMcpServer()`. ([extensions guide](https://pi.dev/docs/latest/extensions)) I haven't traced exactly what each exposure value does, so I list them as the documented knobs and nothing more.

</div>

<div class="callout documented">

<span class="label documented">Documented</span> Earendil's post [*You Said No MCP!*](https://earendil.com/posts/you-said-no-mcp/) (September 29, 2026) says MCP is now part of Pi's core, that Codemode runs on the harness side, and that it is loaded automatically when MCP is configured. The post acknowledges that pi.dev and earlier posts had declared Pi did not support MCP. [Mario Zechner's November 2025 post](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) said Pi "does not and will not support MCP". On why tools needed new metadata for Codemode, the post says they "did not yet upgrade our tool loadout to better scale to these new capabilities" (it names deferred tool loading and similar model features).

</div>

<div class="callout opinion">

<span class="label opinion">Opinion</span> Code Mode and multi-agent orchestration solve different problems. Code Mode composes **tool calls** inside one agent turn, so intermediate results don't cost context or round trips. Orchestration splits **work** across agents, each with its own model interaction. Code Mode doesn't replace the orchestrator I tried to build, and I can't say it would have helped. What I find interesting is that the sandbox is explicit: the script's reach is exactly the tools it's given. The observability trade-off from [Part 2](/blog/pi-agent-freedom-vs-convenience-part-2/) still applies. A script that batches many calls into one output is efficient, and also a place where intermediate activity is hidden from the model.

</div>

I'd like to try it on a real task before judging it. Until then it stays a hypothesis.


## 7. Flexibility versus integration: more tools, a better agent?

My first reaction to Pi's thin environment (section 1) was to count what was missing. The tool system makes that reaction worth examining, because it's tempting to turn "fewer built-in tools" into "less capable". I don't think tool count settles anything, and the comparison below is meant to show why.

### What the three harnesses ship

<div class="callout documented">

<span class="label documented">Documented</span> Everything in the table comes from official docs or the projects' open-source trees, checked on October 20, 2026. Claude Code's table is from its [tools reference](https://code.claude.com/docs/en/tools-reference). Codex's cells combine its [customization](https://learn.chatgpt.com/docs/customization/overview), [MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) and [approvals](https://learn.chatgpt.com/docs/agent-approvals-security) docs with the tool handlers in the [openai/codex](https://github.com/openai/codex/tree/main/codex-rs/core/src/tools) source (commit `e18a20d`). I found no official Codex page that lists its tools or gives a count, so I don't give one.

</div>

| | Pi | Claude Code | Codex |
|---|---|---|---|
| **Built-in tool surface** | 8 core tools (4 on by default), plus 2 off-by-default extension tools | The tools reference lists 46 entries. Several are conditional: task tools depend on the model, `Grep` and `Glob` are left out by default on macOS, Linux and WSL, and one entry is marked removed | No documented list or count. The source has handlers for shell execution (`exec_command`, `write_stdin`), `apply_patch`, `update_plan`, `view_image`, `request_user_input`, `request_permissions`, MCP resource tools, `tool_search`, multi-agent tools and hosted web search. I didn't verify which are on for a given model or config |
| **File editing** | `edit` (exact replacement), `write` | `Edit`, `Write`, `NotebookEdit` | `apply_patch` |
| **Search** | `bash`, or opt-in `grep` / `find` / `ls` | `Grep` / `Glob` on Windows. Elsewhere, Claude searches with `find` and `grep` through `Bash` by default | Through the shell tool. I found no dedicated search handler |
| **Planning, sub-agents** | Not built in; the homepage says "No sub-agents", "No plan mode" | `Agent`, `EnterPlanMode`, `AskUserQuestion`, task tools, worktree tools and more | `update_plan`, `request_user_input`, multi-agent tools. Docs describe subagents as a customization layer |
| **Adding tools** | `registerTool()` in an extension, SDK `customTools`, MCP | MCP ("To add custom tools, connect an MCP server"). A skill "runs through the existing `Skill` tool rather than adding a new tool entry". Hooks and permission rules constrain tools | MCP, with `enabled_tools` / `disabled_tools` for MCP servers. Skills are instructions; plugins package and distribute them |
| **Permissions and sandbox** | No approval prompts and no sandbox by default; the docs tell you to bring a container | Allow and deny rules per tool name, permission modes, and a per-tool flag for whether a prompt is required | An OS-enforced sandbox (Seatbelt, bwrap plus seccomp) plus approval policies. In version-controlled folders the default is `workspace-write` with `on-request` approval |
| **Controls on context cost** | `--tools` allowlists, `exposure`, `tool_search`, `codemode` | `ToolSearch` defers MCP tool definitions by default; `alwaysLoad` opts a server out | `enabled_tools` / `disabled_tools`; a `tool_search` tool exists in the source |

<div class="callout opinion">

<span class="label opinion">Opinion</span> Reading the table, I see three different bets, not one big and one small. Pi bets on a few general primitives plus hooks you program yourself. Claude Code bets on a broad, integrated surface with a policy layer (permissions, hooks, plugins) around it. Codex, going by its docs and source, bets on a few strong primitives (shell and patch) inside an OS-level sandbox with approval policies. The vendors don't state these as design philosophies, so this is my reading of what they ship.

</div>

<div class="callout documented">

<span class="label documented">Documented</span> Pi's author has stated a rationale for the small set: in November 2025 Mario Zechner wrote that "these four tools are all you need for an effective coding agent", that Pi's system prompt and tool definitions "come in below 1000 tokens", and that popular MCP servers "dump their entire tool descriptions into your context on every session". He described Codex's tool definitions as "similarly minimal to pi's" and Claude Code as "a spaceship with 80% of functionality I have no use for" ([post](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)). Those are the author's opinions, from a post that also said Pi would not support MCP. Pi has since changed course on MCP (section 6), and I haven't verified the 1,000-token figure against the current version.

</div>

### The argument: a bigger toolset isn't automatically a better agent

My claim is narrower than "fewer is better". **A larger toolset does not by itself make an agent more capable, reliable or useful, and a smaller one doesn't by itself make it safer or simpler to live with.** Six angles follow, each marked for what kind of claim it is.

![Three ways a tool can reach the model. Declared upfront: the definition is in every request; in Pi this is exposure direct and the built-ins, in Claude Code the built-in tools and MCP tools with alwaysLoad; cost is context on every turn whether or not the tool is used. Found on demand: only names are upfront and a search step loads definitions; in Pi exposure deferred with the tool_search tool, in Claude Code ToolSearch for MCP tools; cost is an extra step and the model must search. Reached through a script: the model writes code that calls tools and only the output returns; in Pi the codemode tool, and MCP tools default to this exposure; cost is that intermediate calls are hidden. A note says the same tool can sit in different columns depending on configuration, so how many tools exist and how many the model sees each turn are different questions.](./images/tool-reach.svg)

**1. Simplicity versus capability.** <span class="label opinion">Opinion</span> A few general tools can cover the fundamental operations: read, write, edit and run a command. `bash` alone can already do what `grep`, `find` and `ls` do, which is why those three are opt-in in Pi, and Claude Code's docs say that on macOS, Linux and WSL it too leaves `Grep` and `Glob` out by default and searches through `Bash`. Overlap is where a bigger set starts to cost: two tools that do nearly the same thing give the model a choice to make and give you two behaviors to understand. But a small set has overlap too (`edit` and `write` both change files, and `bash` can do either), so small is not the same as non-overlapping.

**2. Tool selection and reasoning.** <span class="label opinion">Opinion</span> The intuition is that every extra tool is another option the model must weigh, which could make selection less predictable. I haven't measured that, and neither the Pi nor the Claude Code docs I read make a claim about selection accuracy, so I treat it as a hypothesis. What the docs do show is that both products built mechanisms to avoid declaring everything upfront (the figure), which suggests their authors take the cost of a large declared set seriously. That's an inference about intent, not a stated reason.

**3. Extensibility versus built-in completeness.** <span class="label opinion">Opinion</span> A minimal core makes fewer assumptions and is easier to read end to end. The matching cost is the one this whole article is about: whatever the core leaves out, someone must build, test and maintain. Pi's extension API is generous, but a custom tool is code you own, written against an API that has changed (the package rename below is one example). An integrated harness has done that work once, for everyone.

**4. Control versus convenience.** <span class="label opinion">Opinion</span> A small default set is a clear base to customize: you can read what the model is offered, change it, and hook every call. A polished harness gives you something working on the first day. Both are real goods. Which one wins depends on whether you'll ever use the control, and I'd be dishonest to claim I always did.

**5. Context and implementation cost.** <span class="label documented">Documented</span> Tool definitions, schemas and instructions are context. Claude Code's docs say "each upfront tool consumes context that would otherwise be available for your conversation", that every skill in the listing "adds to your context on every turn", and that tool search keeps MCP context low "by deferring tool definitions until Claude needs them". Pi caps the tool declarations in `codemode`'s description at 3,000 estimated tokens by default. Outputs matter too: Pi's built-ins truncate at 2,000 lines or 50 KB, and Claude Code persists oversized MCP results to disk past 50,000 characters. <span class="label opinion">Opinion</span> So the cost is real, but it depends on what is declared. Ten small tools may cost less than one with a huge schema, and a deferred tool costs close to nothing until it's needed. The claim "every extra tool hurts" doesn't follow.

**6. Reliability and responsibility.** <span class="label opinion">Opinion</span> A smaller toolset doesn't make an agent safe or reliable. Pi's four default tools include `bash`, which can do almost anything the user can, and its security docs say plainly that it doesn't ask before each call. Codex ships a sandbox and approval policies, and Claude Code ships per-tool permission rules, and neither depends on how many tools exist. What decides reliability is the quality of each tool's implementation, validation, error reporting, and the boundary around execution. A tool with a vague description or silent failures hurts more than a missing tool.

### Where Pi's minimalism helps, and where it costs

| Where it helps | Where it costs |
|---|---|
| A short, readable surface: eight names, four by default | Anything beyond file work and `bash` is yours to build or install |
| You choose what the model sees (`--tools`, `exposure`) | You must know that choice exists, and make it |
| One hook point sees every call, nested ones included | The hook is a policy surface, not a sandbox; the boundary is yours to build (see [Part 2](/blog/pi-agent-freedom-vs-convenience-part-2/)) |
| Few assumptions baked in, so fewer surprises from the harness | Common workflows (plans, sub-agents, approvals) start as a blank page |
| Easy to embed through RPC or the SDK | Embedding makes you the owner of the glue (see [Part 2](/blog/pi-agent-freedom-vs-convenience-part-2/)) |

<div class="callout opinion">

<span class="label opinion">Opinion</span> The counterargument deserves its full weight. A rich built-in set saves setup, avoids ten people writing the same sub-agent tool badly, and makes common workflows reachable on day one. For many teams that is exactly the right trade. Pi's minimalism pays off most when you want to understand and shape the system, and costs most when you just want a working agent this afternoon. This also isn't a clean split: Claude Code defers MCP tools behind search by default, and Pi has grown MCP and a scripting tool, so the two products are moving toward each other.

</div>

<div class="callout opinion">

<span class="label opinion">Opinion</span> **My conclusion: the question isn't how many tools an agent has. It's whether they form a coherent system.** That means the right capabilities, at the right level of abstraction (a general `bash` or a narrow, well-described tool), with a sensible way to keep them out of the model's context until needed, and a boundary around what they can do. Pi hands you the parts and the decisions. Claude Code and Codex make more of those decisions for you. I haven't tested which produces better results on real work, and tool count alone can't tell you.

</div>

### Freedom, convenience, and who owns the system

What does this comparison add up to? Extensibility is the point of Pi: programmable behavior, a single hook where every tool call can be inspected or refused, event streams you can build on, and a core small enough to understand. Each of those has a matching cost, and the cost is the same each time. The decision moved to me.

| What Pi gives you | What it asks of you |
|---|---|
| Shape more of the system | Decide what's in it, and maintain it |
| Custom behavior fitted to your needs | Test it, and keep it working as Pi changes. Packages moved npm scopes once: `@mariozechner/pi-coding-agent` dates from November 2025, `@earendil-works/pi-coding-agent` from May 2026, per the npm registry, which now marks the old name as deprecated in favour of the new one. |
| See and change architectural decisions | Make them well: permissions, isolation, observability, recovery from failure |
| No bundled policy to fight | Supply your own, or work without one |

The tool system is the clearest example. Pi gives you a small set of primitives and a place to add your own, and the comparison above argues that this is a bet and not a deficit. Integrated products aren't the opposite of extensible. Claude Code, for example, has hooks, skills, sub-agents, plugins and MCP, and Pi isn't without conveniences. The difference is **how much is decided for you by default, and who maintains it**.

## 8. Conclusion: freedom is a design choice

Pi's flexibility is a design choice, and it is valuable when you want control over the agent environment: which tools the model sees, what happens around every call, how a session is stored and compacted, how the agent is driven from outside. The architecture in this part shows that the control is real and documented, down to individual hooks and events. It also shows that none of it comes with a policy chosen for you. The loop doesn't decide what recovery means, the hooks don't decide what is allowed, and the tool set doesn't decide how work is delegated.

That leaves a question the architecture alone can't answer: **what additional engineering work turns that flexibility into a system that is reliable, secure and maintainable?** [Part 2: From Flexibility to Responsibility — Building Reliable Workflows](/blog/pi-agent-freedom-vs-convenience-part-2/) takes it up through orchestration and observability, recovery when execution stops, the difference between trust, permissions and isolation, and a decision framework for choosing between Pi and an integrated coding agent.

<div class="callout">

**Next: Part 2 of 2.** [Pi Agent: From Flexibility to Responsibility — Building Reliable Workflows](/blog/pi-agent-freedom-vs-convenience-part-2/)

</div>

## References

**Pi: official docs and source**

- [pi.dev](https://pi.dev), [Sessions](https://pi.dev/docs/latest/sessions), [Skills](https://pi.dev/docs/latest/skills), [Packages](https://pi.dev/docs/latest/packages), [Extensions](https://pi.dev/docs/latest/extensions), [SDK](https://pi.dev/docs/latest/sdk), [How Pi works](https://pi.dev/docs/latest/how-pi-works), [Security](https://pi.dev/docs/latest/security), [Settings](https://pi.dev/docs/latest/settings), [Compaction](https://pi.dev/docs/latest/compaction), [CLI](https://pi.dev/docs/latest/cli), [Code Mode](https://pi.dev/docs/latest/codemode), [Usage](https://pi.dev/docs/latest/usage), [RPC](https://pi.dev/docs/latest/rpc), [MCP](https://pi.dev/docs/latest/mcp), [Quickstart](https://pi.dev/docs/latest/quickstart)
- [earendil-works/pi](https://github.com/earendil-works/pi): [`src/core/tools`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/src/core/tools), [`agent-loop.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/agent-loop.ts), [`types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts), [`hello.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts), [`tool-override.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tool-override.ts)
- npm registry metadata (`npm view`) for `@earendil-works/pi-coding-agent` and the deprecated `@mariozechner/pi-coding-agent`, checked October 20, 2026

**Pi: authors' posts**

- Mario Zechner, [*What I learned building an opinionated and minimal coding agent*](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/), November 2025
- Earendil, [*You Said No MCP!*](https://earendil.com/posts/you-said-no-mcp/), September 29, 2026

**Comparison and background**

- Claude Code, [Tools reference](https://code.claude.com/docs/en/tools-reference), [MCP (including tool search)](https://code.claude.com/docs/en/mcp), [Skills](https://code.claude.com/docs/en/skills), [Configure permissions](https://code.claude.com/docs/en/permissions) and [Permission modes](https://code.claude.com/docs/en/permission-modes)
- OpenAI Codex, [Customization](https://learn.chatgpt.com/docs/customization/overview), [MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [Agent approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security), and the open-source tool handlers in [openai/codex](https://github.com/openai/codex/tree/main/codex-rs/core/src/tools) (commit `e18a20d`)
