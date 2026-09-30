# Memory

English | [中文](memory.zh.md)

## Summary

Memory lets agents recall earlier work. The `cortex-memory` plugin records finished tool calls and completed-turn summaries from the Session log into one local SQLite database with a full-text index. When a session starts, it shows the model a one-line-per-entry index of that working directory's recent memory, and the model reads more through search, timeline, and get tools. People manage entries with `/memory`, `/remember`, and `/forget`. Private and credential-shaped text is removed before storage.

## Table of Contents

- [Data model](#data-model)
- [Capture](#capture)
- [Recall](#recall)
- [Privacy](#privacy)
- [Limits](#limits)
- [Further reading](#further-reading)

-----

<a id="data-model"></a>
## Data model

One entry has a numeric id, a type, the Session and working directory that produced it, a timestamp, an optional tool name, a title, a body, and the workspace paths it touched. The types are `observation` (one tool call), `summary` (one completed turn), and `note` (text saved on request). Titles and bodies are indexed for full-text search with word-prefix matching and stemming; a title match ranks above a body match. The database file is created owner-only, carries schema version 1, and is refused rather than migrated when another version is found.

-----

<a id="capture"></a>
## Capture

The plugin reads `session/event` and needs no cooperation from tools. An appended `tool/result` becomes an observation, and a completed `turn/end` becomes a summary of the first user-typed message and the last assistant text. Replacement events published by compaction, interrupted turns, ignored tools, and the memory tools themselves record nothing. Configuration decides whether capture runs at all and how long a stored body may be.

-----

<a id="recall"></a>
## Recall

Recall has two paths, both keyed to the Session's working directory.

| Path | Mechanism |
|---|---|
| Automatic | On `agent/created` (not on resume, and not for subagents) the plugin injects the newest entries as a logged user message of source kind `memory-context`, so the index is reconstructable from the Session log |
| On demand | `memory_search` lists matches, `memory_timeline` shows what surrounded one, and `memory_get` returns full bodies; each returns one line per entry until details are asked for |

The index and every tool result are framed as notes that may be stale and are never instructions.

-----

<a id="privacy"></a>
## Privacy

Text inside `<private>` tags, and everything after an unclosed opening tag, is removed. Strings shaped like API keys, access tokens, bearer credentials, and `password=` assignments become `[redacted]`. Both apply to titles and bodies before anything is written.

-----

<a id="limits"></a>
## Limits

Recording stores a one-line excerpt, not an AI-written summary. Search is lexical, not semantic. Entries do not expire. The scrubber cannot recognize every secret. Profiles other than the terminal chat need a patch row to mount the plugin.

-----

<a id="further-reading"></a>
## Further reading

- [`cortex-memory` package](../../packages/memory/memory/README.md) — configuration, tools, commands, and the model-visible text.
- [Terminal chat](../../packages/bundle/tui/README.md) — the profile that ships memory on.
- [Commands](commands.md) — the registry behind `/memory`.
- [Connect a third-party memory MCP server](../user/guide/mcp-memory.md) — using an external memory system instead.
