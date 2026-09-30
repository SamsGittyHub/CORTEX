# 记忆

[English](memory.md) | 中文

## 概述

记忆让智能体能回想起之前的工作。`cortex-memory` 插件把 Session 日志中已完成的工具调用和已完成回合的摘要记录到一个带全文索引的本地 SQLite 数据库中。会话开始时，它向模型展示该工作目录近期记忆的索引，每个条目一行；模型再通过搜索、时间线和获取工具读取更多内容。人们用 `/memory`、`/remember` 和 `/forget` 管理条目。私有文本和形似凭据的文本在存储前就被移除。

## 目录

- [数据模型](#data-model)
- [记录](#capture)
- [回忆](#recall)
- [隐私](#privacy)
- [限制](#limits)
- [延伸阅读](#further-reading)

-----

<a id="data-model"></a>
## 数据模型

一个条目有数字 id、类型、产生它的 Session 和工作目录、时间戳、可选的工具名、标题、正文以及涉及的工作区路径。类型有 `observation`（一次工具调用）、`summary`（一个完成的回合）和 `note`（按请求保存的文本）。标题和正文被建立全文索引，支持按词前缀匹配和词干提取；标题命中排在正文命中之前。数据库文件以仅所有者可访问的权限创建，schema 版本为 1，遇到其他版本时会被拒绝而不是迁移。

-----

<a id="capture"></a>
## 记录

插件读取 `session/event`，不需要工具配合。追加的 `tool/result` 会成为一条观察记录，完成的 `turn/end` 会成为对第一条用户输入消息和最后一条助手文本的摘要。压缩发布的替换事件、被中断的回合、被忽略的工具以及记忆工具本身都不会被记录。配置决定记录是否运行，以及保存的正文可以多长。

-----

<a id="recall"></a>
## 回忆

回忆有两条路径，都以 Session 的工作目录为键。

| 路径 | 机制 |
|---|---|
| 自动 | 在 `agent/created` 时（恢复会话时不做，子智能体也不做），插件把最新的条目作为来源类型为 `memory-context` 的、会被记录的用户消息注入，因此索引可以从 Session 日志重建 |
| 按需 | `memory_search` 列出匹配项，`memory_timeline` 显示某条目前后的内容，`memory_get` 返回完整正文；在被要求提供细节之前，每个都是每条目一行 |

索引和每个工具结果都被表述为可能过时、且绝不是指令的笔记。

-----

<a id="privacy"></a>
## 隐私

`<private>` 标签内的文本，以及未闭合的开始标签之后的所有内容，都会被移除。形似 API 密钥、访问令牌、bearer 凭据和 `password=` 赋值的字符串会变为 `[redacted]`。两者都在写入任何内容之前应用于标题和正文。

-----

<a id="limits"></a>
## 限制

记录保存的是一行摘录，而不是 AI 撰写的摘要。搜索是词汇式的，不是语义式的。条目不会过期。清洗无法识别所有机密。终端聊天以外的 profile 需要添加 patch 行才能挂载该插件。

-----

<a id="further-reading"></a>
## 延伸阅读

- [`cortex-memory` 包](../../packages/memory/memory/README.zh.md) — 配置、工具、命令以及对模型可见的文本。
- [终端聊天](../../packages/bundle/tui/README.zh.md) — 默认开启记忆的 profile。
- [命令](commands.zh.md) — `/memory` 背后的注册表。
- [连接第三方记忆 MCP 服务](../user/guide/mcp-memory.zh.md) — 改用外部记忆系统。
