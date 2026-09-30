---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-09-29-memory-context-source

[English](2026-09-29-memory-context-source.md) | 中文

## 概述

为会话开始时的记忆索引新增仅用于归属的消息来源类型 memory-context。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-09-29-memory-context-source
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-09-21-user-question-reply"
    after: "4fc3c7bc1d74c9e7cb5bab10435396029cdb8152ce4d3be9d1f15fa44ce5949f"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-09-21-user-question-reply"
    after: "2956204f7b293d41f13c8a74e6ecd21d8349fc53beae2c4e529f6bc1cb810a82"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-09-21-user-question-reply"
    after: "9aec4f5ff937cd789d65747bb82184d7ff8de3b6133293c71fdcd5096403b168"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-09-21-user-question-reply"
    after: "77d32ac622a5d2af345c0e6ebc96d83b1f678a5bb0c6d18b81eea8bda699f901"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

已有记录仍然有效。新类型只出现在可选的 cortex-memory 插件注入的用户消息上，不认识该类型的读取方会像处理其他来源归属一样保留该消息。没有任何已有类型或字段发生变化。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/memory：63 个测试通过，包括注入消息的来源和真实 Loader 启动。

<a id="dev-note"></a>
## 开发备注

无。
