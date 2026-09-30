---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-09-29-memory-context-source

English | [中文](2026-09-29-memory-context-source.zh.md)

## Summary

Adds the attribution-only message source kind memory-context for the session-start memory index.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

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
## Compatibility

Existing records remain valid. The new kind appears only on a user message injected by the optional cortex-memory plugin, and readers that do not know the kind preserve the message like any other source attribution. No existing kind or field changes.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/memory: 63 tests passed, including the injected message source and a real Loader boot.

<a id="dev-note"></a>
## Dev Note

None.
