---
description: "cortex 的交互式终端聊天：在终端里与智能体对话，使用 /plan 等斜杠命令并就地回答审批，适合更习惯命令行而非浏览器的用户。"
kind: "package-bundle"
---

# @cortex-ai/cortex-tui

[English](README.md) | 中文

## 概述

`cortex-tui` 是 cortex 的终端聊天。输入 `cortex --profile tui`，即可在终端里与智能体对话，模型、工具和安全默认值与其他界面相同。回复以 Markdown 样式流式显示，状态行告诉你智能体正在做什么，每次工具调用都落在按五个脑叶分组着色的轨迹上。以 `/` 开头的一行是命令：`/plan <task>` 会让智能体先探索并给出计划，交由你审阅后才动手。它不打开端口，也不打开浏览器，`--resume` 可以继续之前的对话。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

启动聊天，输入一条消息并按回车。输入 `/help` 查看所有命令，输入 `/exit`（或按 Ctrl-D）退出。

### 使用任意 API 密钥

聊天可以配合你手头的任何密钥工作。不带标志时，它会读取你的环境，并使用找到的第一个密钥，顺序为：先 `DEEPSEEK_API_KEY`，然后依次是 Anthropic、OpenAI、Google（`GEMINI_API_KEY` 或 `GOOGLE_API_KEY`）、OpenRouter、xAI、Groq、Mistral、Together、Fireworks，以及 [pi-ai](../../llm/llm-pi-ai/README.zh.md) 附带的其他提供方，每个都通过其常用变量，例如 `ANTHROPIC_API_KEY` 或 `OPENAI_API_KEY`。它会从该提供方的默认模型开始，横幅会显示模型。如果没有找到任何密钥，聊天仍会打开，并打印需要设置的变量名。

```sh
export ANTHROPIC_API_KEY=...            # or OPENAI_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, ...
cortex --profile tui
cortex --profile tui --provider openai --model gpt-5-mini
cortex --profile tui --base-url http://localhost:11434/v1 --model llama3.3
```

设置了多个密钥时用 `--provider`，用 `--model` 选择其他模型。`--api-key-env NAME` 从你指定的变量读取密钥。`--base-url` 指向任何兼容 OpenAI 的服务器，例如 Ollama、LM Studio、vLLM 或网关；它需要 `--model`，并在设置了 `CORTEX_API_KEY` 时从中读取密钥，所以本地服务器无需密钥。`CORTEX_BASE_URL` 和 `CORTEX_MODEL` 是这两个标志的环境变量形式。需要的不只是 API 密钥的提供方，例如 Amazon Bedrock 或 Vertex AI，请通过模型页面或 profile patch 配置。

### 开始对话

```sh
cortex --profile tui
cortex tui "explain this repo"
```

第一行会打印模型和工作目录，随后是会话 id。命令行上给出的消息会在第一次提示前发送。以 `/` 开头的行是命令，其他行都是发给模型的消息。必须以斜杠开头的消息请以 `//` 开头，第一个斜杠会被去掉。

| 选项 | 含义 |
|---|---|
| `[message...]` | 要发送的第一条消息；多个词以空格连接 |
| `--resume <id>` | 继续此 id 对应的已持久化 Session；未知 id 会报错 |
| `--no-color` | 不使用 ANSI 颜色；也遵循 `NO_COLOR`，输出不是终端时从不着色 |
| `--no-memory` | 本次运行既不记录也不回忆记忆 |
| `--provider <name>` | 使用该提供方及其环境中的密钥；设置了 DeepSeek 密钥且没有标志另作指定时，使用 DeepSeek 密钥 |
| `--model <id>` | 使用此模型而不是该提供方的默认模型 |
| `--base-url <url>` | 使用兼容 OpenAI 的端点；需要 `--model` |
| `--api-key-env <name>` | 从此环境变量读取 API 密钥 |
| `-h`、`--help` | 打印命令帮助并退出 |

生成的[配置目录](../../../docs/config-catalog.zh.md#cortex-aicortex-tui)是所有可接受配置字段及其 JSDoc 的完整来源。

### 用 /plan 先做计划

`/plan <task>` 会开启[计划模式](../../plan/plan-mode/README.zh.md)，并在计划指引下发送你的任务。智能体先探索并起草计划，然后请你审阅：输入 `1` 批准，输入 `2` 继续计划，或用自己的话输入反馈，带着反馈继续计划。单独输入 `/plan` 会为你的下一条消息开启计划模式，`/plan off` 则退出。计划模式不会限制智能体的工具；需要强制限制时，请使用沙箱模式和审批提示。

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

其他命令来自组合进该 profile 的插件，所以 `/help` 列出的正是当前安装提供的命令。

### 智能体工作时你会看到什么

回复文本随模型写作而流式显示，标题、列表、引用、围栏代码、`code` 和 **粗体** 在到达时即被着色。在终端上，状态行会带着轮换的动词和已用时间做动画，并在智能体正在运行工具或处于 `reasoning` 时写出对应名称。推理内容本身不会打印；思考耗时达到半秒或更久时，会跟一行 `✻ thought for 2.3s`。

每次工具调用打印在一条彩色轨道上，结果紧随其下一行；失败时以红色显示，耗时达到 100 毫秒或更久时会附上耗时：

```text
┃ ◉ read path=src/build.ts
┃   ⎿ import { parseArgs } from 'node:util'…
┃ ▲ bash command=pnpm test · 4.2s
┃   ⎿ 41 passed

└─ 9.8s · 3 steps · 5.1k in · 640 out  ◉2 ▲1
```

轨道的颜色和符号表示脑叶，所以扫一眼就能知道正在做哪一类工作：

| 脑叶 | 符号 | 工具 |
|---|---|---|
| sensory | ◉ | 读取与搜索，以及聊天无法归类的任何工具 |
| motor | ▲ | 运行命令和修改文件 |
| memory | ◈ | claude-mem、Memorix、Engram 等记忆服务器的工具 |
| planning | ▤ | 计划和待办列表 |
| delegate | ⬡ | 把工作交给其他智能体 |

回合的收尾行显示耗时、模型步数、提供方报告过的 token 数，以及每个脑叶的调用次数。失败的回合会打印错误码和消息，被你中断的回合会打印 `(interrupted)`。提供方在部分回复后重试时，被丢弃的文本后会跟着 `(retrying)`。处于计划模式时，提示符显示为 `▤ plan ›`，每次切换都会用 `▤ plan mode on` 或 `off` 标出。

### 命令、补全与主题

在 `/` 之后按 Tab，可以从终端自带的命令和该 profile 提供的命令中补全命令名。以下命令由终端自己处理：

| 命令 | 作用 |
|---|---|
| `/help` | 列出所有命令和脑叶图例 |
| `/session` | 显示会话 id、模型、目录、主题和 `--resume` 命令 |
| `/stats` | 显示到目前为止的回合数、步数、工作时间、token 和脑叶活动 |
| `/theme [name]` | 切换配色：`cyberpunk`（默认）、`cortex`、`aurora`、`ember` 或 `mono`；不带名称则循环到下一个 |
| `/clear` | 清屏 |
| `/exit`、`/quit` | 退出 |

默认的 `cyberpunk` 配色是《赛博朋克 2077》风格的霓虹：黄色强调、青色表示读取、亮红色表示动作、紫色表示记忆。它也会改变措辞：横幅会加上 `// NEURAL LINK ESTABLISHED`，状态行会出现 `breaching ICE`、`jacking in` 之类的词。当 `COLORTERM` 为 `truecolor` 或 `24bit` 时使用真彩色，否则使用 16 色 ANSI。状态动画和 `/clear` 只在终端上运行。

### 记忆

终端聊天挂载了 [`cortex-memory`](../../memory/memory/README.zh.md)，因此智能体会记住同一目录下的早期会话。每次完成的工具调用和每个完成的回合都会记录到本地 SQLite 数据库中，新会话开始时会带有近期条目的索引，智能体可以用 `memory_*` 工具搜索和读取。记忆工具会以 ◈ memory 脑叶显示在轨迹中。你也可以运行 `/memory [words]` 列出或搜索条目，用 `/remember <text>` 保存笔记，用 `/forget <id>` 删除条目。用 `--no-memory` 启动时，该次运行既不记录也不回忆。数据库默认位于 `$CORTEX_HOME/memory/memory.db`（`~/.cortex/memory/memory.db`），可用 `CORTEX_MEMORY_DB` 覆盖。`<private>` 标签中的文本和形似凭据的字符串永远不会被存储。

### 审批与提问

工具需要你的审批时，聊天会用一张卡片框出工具名称和原因，并询问 `allow once? [y/N]`。只有 `y` 或 `yes` 才会放行，且仅对这一次调用；其他任何输入都视为拒绝。智能体提问时，选项会带编号：用一个编号回答，多选问题可用多个编号，也可以输入自己的回答。提交审阅的计划会出现在带边框的 `plan for review` 卡片中，其 Markdown 已被渲染。

### 中断与退出

回合运行时按 Ctrl-C 会取消该回合，聊天保持打开。在空提示符处按 Ctrl-C，聊天会请你再按一次，第二次才会退出。Ctrl-D 和 `/exit` 会立即退出。退出时聊天会打印该会话的 `--resume` 命令。输入也可以通过管道提供：`printf '/plan fix the login bug\n' | cortex tui` 会依次运行每一行，并在输入结束时退出。

### 何时使用

需要在不离开 shell 的情况下进行多轮工作、通过 SSH 工作或在终端复用器中工作时，请使用终端聊天。脚本只需要一个答案和退出码时，请使用 [cortex-headless](../headless/README.zh.md)；需要带丰富卡片和附件的浏览器界面时，请使用 [cortex-web-app](../web-app/README.zh.md)。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

运行器与一次性运行器一样，是核心 API 载体之上的直接驱动，但会为多个回合持续存活。它不增加任何能力：命令、审批和提问都通过其他界面使用的同一批服务到达。

### 运行流程

运行器等待完整应用就绪，读取共享的 [`agentDefaultModel`](../../core/agent-default-model/README.zh.md) 选择，并通过核心注册表创建 Agent，或通过 [`sessionQuery`](../../session-query/session-query/README.zh.md) 继续 `--resume` 指定的 Session。它注册一个 `approval/request` 和一个 `user-questions/request` 应答器，二者都从同一个终端读取输入，并把 Agent 的实时助手流以及已提交的 `turn/start`、`step/start`、`assistant/message`、`tool/call`、`tool/result`、`turn/end` 和 `plan/mode` 事件送入同一个活动视图，由它写到 stdout。`src/repl.ts` 中的循环针对两个小接口编写，即终端和它所驱动的 Agent 操作，因此无需 Cordis 树即可运行。

### 命令

`/exit`、`/quit` 和 `/help` 属于终端。其他所有 `/name` 都通过 `execute` 交给 [`commands`](../../interaction/commands/README.zh.md) 注册表，因此该次运行像其他命令一样写入 Session 日志，结果则在模型历史之外打印。`/plan` 是 [plan-mode](../../plan/plan-mode/README.zh.md) 的命令，本组合包不为它注册任何内容。每个命令之后，循环都会等待 Agent 空闲，因为 `/plan <task>` 这类命令会启动一个回合，然后刷新 Session，这样进程被杀时最多丢失正在进行的回合。

### 活动视图

`src/activity.ts` 不含任何 Cordis 或 Session 类型；运行器只向它传递普通值，并注入时钟和定时器。`src/markdown.ts` 根据一行的开头几个字符判断行类型，并在收到结束标记时为行内代码和粗体着色，只保留仍可能构成标记开头的字符，因此无论提供方如何分块，同一文本的样式都相同。`src/lobes.ts` 按名称为工具分组：MCP 工具名为 `mcp__<server>__<tool>`，所以记忆服务器的工具通过服务器名进入 memory 脑叶。`src/theme.ts` 按含义命名每种颜色，并构建真彩色、16 色 ANSI 或无色的着色器；所有使用方都通过同一个包装器着色，因此 `/theme` 会让之后的输出立即换色。

### 输入处理

各行通过同一个 readline 接口的异步迭代器读取，它会缓冲在下一次读取之前到达的输入，因此管道输入不会丢失。只有 stdin 是终端时才显示提示符。审批和提问提示读取同一个迭代器，所以每一行恰好被一个读取者消费。输入结束时，审批以 `unavailable` 结算，调用方将其视为拒绝，提问则以无选择结算。

### 基于 base 的 patch 内容

该 patch 叠加在 `cortex-base` 之上：它设置一个提到终端的编码人设，与其他界面一样保留临时的进程级 PTC 模式开关（`CORTEX_TOOLS_MODE`），禁用共享的 HMR 行，并挂载启动提供方和运行器。`tui-runner` 行 id 被列入可用应用所必需的条目，因此激活失败会终止启动。

### 源码地图

| 文件 | 作用 |
|---|---|
| [`src/index.ts`](src/index.ts) | `tui-runner` 插件：Agent 解析、实时活动投影、服务绑定、退出 |
| [`src/repl.ts`](src/repl.ts) | 读取-执行循环、`/help`、Ctrl-C 处理，以及它所针对的两个接口 |
| [`src/activity.ts`](src/activity.ts) | 实时视图：流式回复、状态动画、工具轨迹、回合收尾行 |
| [`src/markdown.ts`](src/markdown.ts) | 流式 Markdown 到 ANSI 的着色 |
| [`src/lobes.ts`](src/lobes.ts) | 把工具分入脑叶，以及它们的符号和颜色 |
| [`src/theme.ts`](src/theme.ts) | 配色、着色器和颜色检测 |
| [`src/banner.ts`](src/banner.ts) | 开场横幅以及 `/session`、`/stats` 和图例卡片 |
| [`src/format.ts`](src/format.ts) | 时长和 token 数格式化 |
| [`src/render.ts`](src/render.ts) | 单行摘要、行分类和回复解析 |
| [`src/interaction.ts`](src/interaction.ts) | 终端对审批和提问请求的应答 |
| [`src/terminal.ts`](src/terminal.ts) | 基于进程流的 readline 终端 |
| [`src/runner-internals.ts`](src/runner-internals.ts) | 运行器读取的进程事实，测试中会替换 |
| [`src/startup.ts`](src/startup.ts) | `tui-startup` 提供方：消息位置参数、`--resume`、`--no-color`、`--no-memory`、模型标志、`--help` |
| [`src/llm-select.ts`](src/llm-select.ts) | 根据标志和已设置的 API 密钥选择模型路由 |
| [`src/catalog.ts`](src/catalog.ts) | pi-ai 的提供方和模型目录 |
| [`cordis.patch.yml`](cordis.patch.yml) | 基于 `cortex-base` 的交互式 patch |
| — | 未发布运行时 invariant 配套模块；运行器不注册任何内容，树内也没有可审计的可变关系。 |
| [`tests/runner.spec.ts`](tests/runner.spec.ts) | 在真实注册表上测试回合、流式显示、`/plan`、审批、提问、取消和恢复 |
| [`tests/repl.spec.ts`](tests/repl.spec.ts) | 针对脚本化终端和 Agent 的循环 |
| [`tests/render.spec.ts`](tests/render.spec.ts) | 摘要、分类和回复解析 |
| [`tests/activity.spec.ts`](tests/activity.spec.ts) | 流式显示、用假定时器测试动画、轨迹和收尾行 |
| [`tests/markdown.spec.ts`](tests/markdown.spec.ts) | 着色，包括任意分块大小下输出一致 |
| [`tests/lobes.spec.ts`](tests/lobes.spec.ts) | 工具分组和脑叶小结 |
| [`tests/banner.spec.ts`](tests/banner.spec.ts) | 横幅和各卡片 |
| [`tests/theme.spec.ts`](tests/theme.spec.ts) | 配色、着色器模式和颜色检测 |
| [`tests/interaction.spec.ts`](tests/interaction.spec.ts) | 审批和提问的应答 |
| [`tests/terminal.spec.ts`](tests/terminal.spec.ts) | 读取管道输入和交互式输入 |
| [`tests/startup.spec.ts`](tests/startup.spec.ts) | 在真实 Loader 树上解析命令行 |
| [`tests/llm-select.spec.ts`](tests/llm-select.spec.ts) | 根据标志和环境密钥选择路由 |

### 不变式归属

未发布 invariant 配套模块，因为运行器不注册任何内容，树内也没有可审计的可变关系；它可观察的契约是终端记录和退出码，上述测试已覆盖。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

想深入了解共享核心、同级界面或命令行交接时，请阅读这些页面。

- [组合包地图](../README.zh.md) — 构建在同一核心之上的各个界面。
- [cortex-base](../base/README.zh.md) — 终端聊天所运行的共享核心。
- [cortex-plan-mode](../../plan/plan-mode/README.zh.md) — `/plan` 的作用以及评审式退出如何工作。
- [cortex-commands](../../interaction/commands/README.zh.md) — 每个 `/name` 背后的斜杠命令注册表。
- [cortex-headless](../headless/README.zh.md) — 面向脚本的一次性同级界面。
- [cortex-web-app](../web-app/README.zh.md) — 浏览器同级界面。
- [cortex-cmdline](../../boot/cmdline/README.zh.md) — 启动器如何把命令行交给应用。
- [生成的配置目录](../../../docs/config-catalog.zh.md#cortex-aicortex-tui) — 所有可接受的配置字段及其源码声明。

-----

<a id="model-experience"></a>
## 模型体验

无，因为运行器把每一行输入作为普通用户消息提交，提示词和工具由组合后的 base 和 tui 行负责。

#### KV Cache 影响

运行器不向请求前缀添加任何内容；它只是驱动用户消息通过组合后的树。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制说明终端聊天在什么情况下不适用，以及它对 `cortex` 启动器的要求。它们是当前包的约束，不是任务待办清单。

- **通过 `cortex` 启动器运行** — 以其他方式启动该 profile 会在启动时失败，因为只有启动器能请求进程退出。
- **仅支持行输入** — 聊天按整行读取；没有多行编辑器，除终端自带的行编辑外没有历史搜索，也没有图片或文件附件，需要这些请使用浏览器界面。
- **不显示推理内容** — 状态行和 `✻ thought for …` 小结代替推理内容；推理仍记录在 Session 中。
- **已流式输出的文本可能被丢弃** — 文本在到达时就会打印；提供方重试时，之前的部分回复仍留在屏幕上，其后跟着 `(retrying)`。
- **脑叶只是按名称的启发式分组** — 工具按注册名称归类，名称看不出用途的工具会落入 sensory 脑叶，脑叶也不能说明该调用实际做了什么。
- **Markdown 只支持一部分** — 标题、列表、引用、围栏代码、行内代码和粗体会着色；表格、链接、斜体和有序列表按原样打印。
- **被撤回的审批仍要等待一行输入** — 聊天正在等待你的回答时，如果智能体撤回了审批或提问，提示会一直保留到你按回车，且该行不会被当作回答。
- **恢复受 cwd、归属和预设限制** — `--resume` 会拒绝：记录在其他工作目录或没有工作目录的 Session、子智能体或分叉 Session、运行在本 profile 未组合的智能体预设下的 Session，以及进程内已存活的身份；它需要已组合的 Session 查询和持久化服务。
- **需要附件的命令不可用** — 必须带附件的命令无法从终端接收附件，会报告它自己的错误。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>面向维护者的工作背景 — 点击展开</summary>

无。

</details>
