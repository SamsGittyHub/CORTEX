---
description: "Interactive terminal chat for cortex: talk to the agent in your terminal, use slash commands such as /plan, and answer approvals in place, for users who prefer the command line to a browser."
kind: "package-bundle"
---

# @cortex-ai/cortex-tui

English | [中文](README.zh.md)

## Summary

`cortex-tui` is the terminal chat for cortex. Type `cortex --profile tui` and talk to the agent in your terminal, with the same model, tools, and safety defaults as every other surface. Replies stream with Markdown styling, a status line shows what the agent is doing, and every tool call lands on a colored trace grouped into five lobes. Start a line with `/` to run a command: `/plan <task>` has the agent explore and present a plan for your review before it acts. It opens no port and no browser, and `--resume` continues an earlier conversation.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Start the chat, type a message, and press Enter. Type `/help` to see every command and `/exit` (or Ctrl-D) to leave.

### Starting a conversation

```sh
cortex --profile tui
cortex tui "explain this repo"
```

The first line prints the model and working directory, then the session id. A message given on the command line is sent before the first prompt. A line that starts with `/` is a command; any other line is a message to the model. A message that must begin with a slash starts with `//`, and the first slash is dropped.

| Option | Meaning |
|---|---|
| `[message...]` | A first message to send; several words are joined by spaces |
| `--resume <id>` | Continue the persisted Session with this id; an unknown id is an error |
| `--no-color` | Print without ANSI colors; `NO_COLOR` is also honored, and output that is not a terminal is never colored |
| `-h`, `--help` | Print the command's help and exit |

The generated [configuration catalog](../../../docs/config-catalog.md#cortex-aicortex-tui) is the exhaustive source for every accepted config field and its JSDoc.

### Planning first with /plan

`/plan <task>` turns on [plan mode](../../plan/plan-mode/README.md) and sends your task under planning guidance. The agent explores and drafts a plan, then asks you to review it: type `1` to approve, `2` to keep planning, or type feedback in your own words to keep planning with it. `/plan` alone turns plan mode on for your next message, and `/plan off` leaves it. Plan mode does not restrict the agent's tools; use sandbox mode and approval prompts for enforced limits.

```text
› /plan add a --verbose flag to the build script
▤ plan mode on
┃ ◉ read path=scripts/build.ts
┃   ⎿ import { parseArgs } from 'node:util'…
╭─ ▤ plan for review
│ Steps
│ • add the flag to parseArgs
│ • print each step when it is set
╰─
Approve this plan?
  1. Approve
  2. Keep planning
  number or your own answer: 1
```

Other commands come from the plugins composed into the profile, so `/help` lists exactly what this installation offers.

### What you see while the agent works

Reply text streams as the model writes it, with headings, bullets, quotes, fenced code, `code`, and **bold** styled as they arrive. On a terminal, a status line animates with a rotating verb and the elapsed time, and it names the running tool or `reasoning` when that is what the agent is doing. Reasoning itself is not printed; a `✻ thought for 2.3s` line follows a thought that took half a second or more.

Each tool call prints on a colored rail, then its result on the line below, in red when it failed, with the time it took when that was 100 ms or more:

```text
┃ ◉ read path=src/build.ts
┃   ⎿ import { parseArgs } from 'node:util'…
┃ ▲ bash command=pnpm test · 4.2s
┃   ⎿ 41 passed

└─ 9.8s · 3 steps · 5.1k in · 640 out  ◉2 ▲1
```

The rail color and glyph show the lobe, so a glance tells you what kind of work is happening:

| Lobe | Glyph | Tools |
|---|---|---|
| sensory | ◉ | reading and searching, and any tool the chat cannot place |
| motor | ▲ | running commands and changing files |
| memory | ◈ | tools of memory servers such as claude-mem, Memorix, or Engram |
| planning | ▤ | plans and todo lists |
| delegate | ⬡ | handing work to other agents |

The closing line of a turn shows its duration, model steps, token counts when the provider reported them, and how many calls each lobe made. A turn that fails prints its error code and message, and a turn you interrupted prints `(interrupted)`. When the provider retries after a partial reply, `(retrying)` follows the discarded text. In plan mode the prompt reads `▤ plan ›`, and `▤ plan mode on` or `off` marks each change.

### Commands, completion, and themes

Press Tab after `/` to complete a command name from the terminal's own commands and the ones the profile provides. The terminal handles these itself:

| Command | Action |
|---|---|
| `/help` | List every command and the lobe legend |
| `/session` | Show the session id, model, directory, theme, and the `--resume` command |
| `/stats` | Show turns, steps, working time, tokens, and lobe activity so far |
| `/theme [name]` | Switch palette: `cortex`, `aurora`, `ember`, or `mono`; without a name, cycle to the next |
| `/clear` | Clear the screen |
| `/exit`, `/quit` | Leave |

Colors use truecolor when `COLORTERM` says `truecolor` or `24bit` and 16-color ANSI otherwise. The status animation and `/clear` run only on a terminal.

### Approvals and questions

When a tool needs your approval, the chat frames the tool name and the reason in a card and asks `allow once? [y/N]`. Only `y` or `yes` allows the operation, for that one call; anything else denies it. When the agent asks a question, its options are numbered: answer with a number, several numbers for a multi-select question, or type your own answer. A plan submitted for review appears in a framed `plan for review` card with its Markdown rendered.

### Interrupting and leaving

Press Ctrl-C while a turn runs to cancel that turn; the chat stays open. Press it at an empty prompt and the chat asks you to press it again, and the second press leaves. Ctrl-D and `/exit` leave at once. On exit the chat prints the `--resume` command for the session. Input can also be piped: `printf '/plan fix the login bug\n' | cortex tui` runs each line in turn and exits at the end of input.

### When to use it

Use the terminal chat for multi-turn work without leaving your shell, over SSH, or in a terminal multiplexer. Use [cortex-headless](../headless/README.md) when a script needs one answer and an exit code, and [cortex-web-app](../web-app/README.md) when you want a browser interface with rich cards and attachments.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The runner is a direct driver over the core API carrier, like the one-shot runner, but it stays alive for many turns. It adds no capability: commands, approvals, and questions arrive through the same services every other surface uses.

### Run flow

The runner awaits the complete application, reads the shared [`agentDefaultModel`](../../core/agent-default-model/README.md) selection, and creates an Agent through the core registry, or continues the Session `--resume` names through [`sessionQuery`](../../session-query/session-query/README.md). It registers an `approval/request` and a `user-questions/request` answerer that read from the same terminal, and it feeds the Agent's live assistant stream and committed `turn/start`, `step/start`, `assistant/message`, `tool/call`, `tool/result`, `turn/end`, and `plan/mode` events to one activity view, which writes to stdout. The loop in `src/repl.ts` is written against two small interfaces, the terminal and the Agent operations it drives, so it runs without a Cordis tree.

### Commands

`/exit`, `/quit`, and `/help` belong to the terminal. Every other `/name` goes to the [`commands`](../../interaction/commands/README.md) registry through `execute`, so the run is written to the Session log like any other command run and its result is printed outside the model history. `/plan` is the [plan-mode](../../plan/plan-mode/README.md) command; this bundle registers nothing for it. After every command the loop waits for the Agent to become idle, because a command such as `/plan <task>` starts a turn, and then flushes the Session so a killed process loses at most the turn in progress.

### Activity view

`src/activity.ts` holds no Cordis or Session types; the runner passes it plain values and injects the clock and timers. `src/markdown.ts` decides a line's kind from its first characters and styles inline code and bold when the closing marker arrives, holding back only the characters that could still begin a marker, so a text styles the same however the provider chunks it. `src/lobes.ts` groups a tool by its name: an MCP tool is named `mcp__<server>__<tool>`, so a memory server's tools reach the memory lobe through the server name. `src/theme.ts` names each color by meaning and builds a painter for truecolor, 16-color ANSI, or none; every consumer paints through one wrapper, so `/theme` restyles later output at once.

### Input handling

Lines are read through the async iterator of one readline interface, which buffers input that arrives before the next read, so piped input is not lost. The prompt is shown only when stdin is a terminal. Approval and question prompts read from that same iterator, so one line is consumed by exactly one reader. When input ends, an approval settles as `unavailable`, which callers treat as a denial, and a question settles with no selection.

### Patch surface over base

The patch rides over `cortex-base`: it sets a coding persona that mentions the terminal, keeps the same temporary process-wide PTC mode opt-in (`CORTEX_TOOLS_MODE`) as the other surfaces, disables the shared HMR row, and mounts the startup provider and the runner. The `tui-runner` row id is listed among the entries a usable application requires, so a failed activation ends startup.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | The `tui-runner` plugin: Agent resolution, live activity projection, service binding, exit |
| [`src/repl.ts`](src/repl.ts) | The read-eval loop, `/help`, Ctrl-C handling, and the two interfaces it is written against |
| [`src/activity.ts`](src/activity.ts) | The live view: streamed replies, status animation, tool trace, turn footer |
| [`src/markdown.ts`](src/markdown.ts) | Streaming Markdown-to-ANSI styling |
| [`src/lobes.ts`](src/lobes.ts) | Tool grouping into lobes, and their glyphs and colors |
| [`src/theme.ts`](src/theme.ts) | Palettes, the painter, and color detection |
| [`src/banner.ts`](src/banner.ts) | The opening banner and the `/session`, `/stats`, and legend cards |
| [`src/format.ts`](src/format.ts) | Duration and token formatting |
| [`src/render.ts`](src/render.ts) | One-line summaries, line classification, and reply parsing |
| [`src/interaction.ts`](src/interaction.ts) | Terminal answers to approval and question requests |
| [`src/terminal.ts`](src/terminal.ts) | The readline terminal over process streams |
| [`src/runner-internals.ts`](src/runner-internals.ts) | Process facts the runner reads, replaced in tests |
| [`src/startup.ts`](src/startup.ts) | The `tui-startup` provider: message positional, `--resume`, `--no-color`, `--help` |
| [`cordis.patch.yml`](cordis.patch.yml) | The interactive patch over `cortex-base` |
| — | No runtime invariant companion is published; the runner registers nothing and holds no mutable relation to audit inside the tree. |
| [`tests/runner.spec.ts`](tests/runner.spec.ts) | Turns, streaming, `/plan`, approvals, questions, cancellation, and resume over the real registries |
| [`tests/repl.spec.ts`](tests/repl.spec.ts) | The loop against a scripted terminal and Agent |
| [`tests/render.spec.ts`](tests/render.spec.ts) | Summaries, classification, and reply parsing |
| [`tests/activity.spec.ts`](tests/activity.spec.ts) | Streaming, animation with fake timers, trace, and footer |
| [`tests/markdown.spec.ts`](tests/markdown.spec.ts) | Styling, including identical output at every chunk size |
| [`tests/lobes.spec.ts`](tests/lobes.spec.ts) | Tool grouping and lobe summaries |
| [`tests/banner.spec.ts`](tests/banner.spec.ts) | The banner and the cards |
| [`tests/theme.spec.ts`](tests/theme.spec.ts) | Palettes, painter modes, and color detection |
| [`tests/interaction.spec.ts`](tests/interaction.spec.ts) | Approval and question answers |
| [`tests/terminal.spec.ts`](tests/terminal.spec.ts) | Reading piped and interactive input |
| [`tests/startup.spec.ts`](tests/startup.spec.ts) | Command-line parsing over a real Loader tree |

### Invariant ownership

No invariant companion is published because the runner registers nothing and holds no mutable relation to audit inside the tree; its observable contract is the terminal transcript and the exit code, which the tests above cover.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when you want to go deeper into the shared core, the sibling surfaces, or the command-line handoff.

- [Bundle package map](../README.md) — the surfaces built on the same core.
- [cortex-base](../base/README.md) — the shared core the terminal chat runs on.
- [cortex-plan-mode](../../plan/plan-mode/README.md) — what `/plan` does and how the reviewed exit works.
- [cortex-commands](../../interaction/commands/README.md) — the slash-command registry behind every `/name`.
- [cortex-headless](../headless/README.md) — the one-shot sibling for scripts.
- [cortex-web-app](../web-app/README.md) — the browser sibling.
- [cortex-cmdline](../../boot/cmdline/README.md) — how the launcher hands the command line to the app.
- [Generated configuration catalog](../../../docs/config-catalog.md#cortex-aicortex-tui) — every accepted config field and its source declaration.

-----

<a id="model-experience"></a>
## Model Experience

None, as the runner submits each typed line as an ordinary user message and the composed base and tui rows own the prompts and tools.

#### KV Cache effect

The runner adds nothing to the request prefix; it only drives user messages through the composed tree.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits tell you when the terminal chat does not fit and what it needs from the `cortex` launcher. They are current package constraints, not a task backlog.

- **Runs through the `cortex` launcher** — starting the profile another way fails at startup, because only the launcher can request the process exit.
- **Line input only** — the chat reads whole lines; there is no multi-line editor, no history search beyond the terminal's own line editing, and no image or file attachments, so use the browser surface for those.
- **Reasoning is not shown** — a status line and a `✻ thought for …` summary stand in for it; the reasoning is still recorded in the Session.
- **Streamed text can be discarded** — text is printed as it arrives; when the provider retries, the earlier partial reply stays on screen and `(retrying)` follows it.
- **Lobes are a name heuristic** — a tool is placed by its registered name, so a tool whose name does not suggest its work lands in the sensory lobe, and the lobe says nothing about what the call did.
- **Markdown is partial** — headings, bullets, quotes, fenced code, inline code, and bold are styled; tables, links, italics, and numbered lists print as written.
- **A withdrawn approval waits for a line** — when an agent withdraws an approval or question while the chat is waiting for your answer, the prompt stays until you press Enter, and that line is not used as an answer.
- **Resume is cwd-, ownership-, and preset-scoped** — `--resume` refuses a Session recorded in another working directory or without one, a subagent or forked Session, one that runs under an agent preset this profile does not compose, and an identity already live in the process; it needs the composed Session query and persistence services.
- **Commands with attachments are unavailable** — a command that requires attachments cannot receive them from the terminal and reports its own error.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
