---
description: "The memory group map: durable searchable memory across sessions, for users and maintainers navigating the group."
kind: "package-group"
---

# memory/ — Durable memory

English | [中文](README.zh.md)

## Summary

The memory group holds the plugin that lets agents remember earlier work. It records finished tool calls and completed-turn summaries into a local SQLite database with full-text search, shows the model an index of the project's recent memory when a session starts, and offers search tools and slash commands. Choose it when agents should recall decisions and discoveries from past sessions; connect an external memory server through MCP when you already use one.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

| Package | Role | ctx key |
|---|---|---|
| [`memory/`](memory/README.md) | Records tool activity and turn summaries, injects a session-start index, and provides memory tools and commands | — |

-----

<a id="related-documentation"></a>
## Related documentation

- [Memory subsystem](../../docs/subsystems/memory.md) — data model, capture, recall, privacy, and limits.
- [Connect a third-party memory MCP server](../../docs/user/guide/mcp-memory.md) — the external alternative.

-----

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
