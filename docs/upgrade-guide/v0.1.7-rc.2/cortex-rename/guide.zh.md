---
kind: upgrade-guide
description: "产品更名为 CORTEX：dsh 命令、DSH_* 变量、~/.dsh 主目录、@deepseek-ai/dsh-* 包以及 package.json 的 dsh 键都被替换。"
---

# 产品更名为 CORTEX

[English](guide.md) | 中文

## 变更

DeepSeek Harness 现在叫 CORTEX。下表中的名称全部改变，旧名称不再被读取：

| 界面 | 之前 | 之后 |
|---|---|---|
| 命令 | `dsh` | `cortex` |
| 环境变量 | `DSH_HOME`、`DSH_*` | `CORTEX_HOME`、`CORTEX_*` |
| 默认数据主目录 | `~/.dsh` | `~/.cortex` |
| npm 包 | `@deepseek-ai/dsh-<name>`、`@deepseek-ai/dsh` | `@cortex-ai/cortex-<name>`、`@cortex-ai/cortex` |
| vendored 与原生包 | `@deepseek-ai/cordis`、`@deepseek-ai/node-addon-system` | `@cortex-ai/cordis`、`@cortex-ai/node-addon-system` |
| profile 清单键 | `package.json` 中的 `dsh` | `cortex` |
| Python | `deepseek-harness-sdk`、`deepseek_harness` | `cortex-sdk`、`cortex` |

模型提供方的名称保持不变：`DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL` 以及 `deepseek-*` 模型 id。`libreoffice-kit` 包仍使用 `@deepseek-ai` scope。Session 日志不变，并保留已记录的 `dsh-session-title-llm` 来源类型，因此已有会话仍可打开。

## 迁移

1. 迁移数据：执行 `mv ~/.dsh ~/.cortex`，或把 `CORTEX_HOME` 设为旧目录。
2. 把 shell 配置、CI 和服务文件中的每个 `DSH_*` 变量改为 `CORTEX_*`。
3. 在脚本和别名中把 `dsh` 换成 `cortex`。
4. 在每个 profile 的 `package.json` 中，把 `dsh` 键改为 `cortex`。在 `cordis.yml` 和 patch 文件中，把插件名从 `@deepseek-ai/dsh-<name>` 改为 `@cortex-ai/cortex-<name>`。
5. 重新安装你用 `cortex plugin` 添加的插件，并把 TypeScript 导入和 Python 的 `import deepseek_harness` 更新为新名称。
6. 用 `cortex --version` 确认，然后运行 `cortex web`；之前的会话应能列出。
