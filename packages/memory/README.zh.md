---
description: "记忆包组的地图：跨会话的持久化可搜索记忆，面向浏览该组的用户和维护者。"
kind: "package-group"
---

# memory/ — 持久化记忆

[English](README.md) | 中文

## 概述

memory 组包含让智能体记住之前工作的插件。它把已完成的工具调用和已完成回合的摘要记录到带全文搜索的本地 SQLite 数据库中，在会话开始时向模型展示该项目近期记忆的索引，并提供搜索工具和斜杠命令。希望智能体回想过去会话中的决策和发现时选择它；如果你已经在用外部记忆服务器，则通过 MCP 连接它。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

-----

<a id="packages"></a>
## 包

| 包 | 作用 | ctx 键 |
|---|---|---|
| [`memory/`](memory/README.zh.md) | 记录工具活动和回合摘要，注入会话开始时的索引，并提供记忆工具和命令 | — |

-----

<a id="related-documentation"></a>
## 相关文档

- [记忆子系统](../../docs/subsystems/memory.zh.md) — 数据模型、记录、回忆、隐私和限制。
- [连接第三方记忆 MCP 服务](../../docs/user/guide/mcp-memory.zh.md) — 外部替代方案。

-----

<a id="dev-note"></a>
## 开发备注

<details>
<summary>面向维护者的工作背景 — 点击展开</summary>

无。

</details>
