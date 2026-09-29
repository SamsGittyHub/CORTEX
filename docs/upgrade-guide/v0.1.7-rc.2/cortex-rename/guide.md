---
kind: upgrade-guide
description: "The product is renamed CORTEX: the dsh command, DSH_* variables, ~/.dsh home, @deepseek-ai/dsh-* packages, and the dsh package.json key are replaced."
---

# The product is renamed CORTEX

English | [中文](guide.zh.md)

## Change

DeepSeek Harness is now CORTEX. Every name below changes, and nothing reads the old one:

| Surface | Before | After |
|---|---|---|
| Command | `dsh` | `cortex` |
| Environment variables | `DSH_HOME`, `DSH_*` | `CORTEX_HOME`, `CORTEX_*` |
| Default data home | `~/.dsh` | `~/.cortex` |
| npm packages | `@deepseek-ai/dsh-<name>`, `@deepseek-ai/dsh` | `@cortex-ai/cortex-<name>`, `@cortex-ai/cortex` |
| Vendored and native packages | `@deepseek-ai/cordis`, `@deepseek-ai/node-addon-system` | `@cortex-ai/cordis`, `@cortex-ai/node-addon-system` |
| Profile manifest key | `dsh` in `package.json` | `cortex` |
| Python | `deepseek-harness-sdk`, `deepseek_harness` | `cortex-sdk`, `cortex` |

Model-provider names stay: `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and the `deepseek-*` model ids. The `libreoffice-kit` packages keep the `@deepseek-ai` scope. Session logs are unchanged and keep the recorded `dsh-session-title-llm` source kind, so existing sessions open.

## Migration

1. Move your data: `mv ~/.dsh ~/.cortex`, or set `CORTEX_HOME` to the old directory.
2. Rename every `DSH_*` variable in your shell profile, CI, and service files to `CORTEX_*`.
3. Replace `dsh` with `cortex` in scripts and aliases.
4. In each profile `package.json`, rename the `dsh` key to `cortex`. In `cordis.yml` and patch files, rename plugin names from `@deepseek-ai/dsh-<name>` to `@cortex-ai/cortex-<name>`.
5. Reinstall plugins you added with `cortex plugin`, and update TypeScript imports and Python `import deepseek_harness` to the new names.
6. Confirm with `cortex --version`, then `cortex web`; your earlier sessions should list.
