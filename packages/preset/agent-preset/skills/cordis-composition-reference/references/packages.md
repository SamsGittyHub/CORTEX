# Loadable Harness plugin packages

This file is GENERATED from workspace manifests (`scripts/gen-plugin-packages.ts`) and verified fresh by `pnpm run verify-plugin-packages` (part of `doc-sync`); do not edit it by hand.

Every package below exports a Cordis plugin that a bundle patch can name in a Loader row. `Config` marks packages whose row accepts a `config` mapping; query `Config.listConfigs` through `cordis_inspect_query` (filter by `name`, then query the `entry` id) for the mounted schema. Packages under `experimental` are pre-stable.

## acp

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-acp` | yes | Automation-only Agent Client Protocol server for driving CORTEX agents over JSON-RPC stdio |

## api

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-api-account-controller` | no | Expose safe account operations over authenticated Remote |
| `@cortex-ai/cortex-api-gateway` | yes | Typert Remote Host dispatcher and Client API endpoint |
| `@cortex-ai/cortex-api-job-controller` | yes | Job Remote observation stream and the reference-counted client job-output service |
| `@cortex-ai/cortex-api-remotes` | no | Remote BFF assembly for application-selected Host capabilities |
| `@cortex-ai/cortex-api-session-controller` | yes | Session Remote commands, cold reads, and live control transport |
| `@cortex-ai/cortex-api-settings-controller` | yes | Remote owner for the configuration surfaces over the settings-domain seams |
| `@cortex-ai/cortex-api-terminal-controller` | yes | Session-owned interactive terminals with shell discovery, screen recovery and typed Remote control |
| `@cortex-ai/cortex-api-workspace-controller` | yes | Workspace Remote commands and reconnect-safe state transport |
| `@cortex-ai/cortex-api-workspace-files` | yes | Workspace file service and Client resource provider: bounded reads, directory listing, and live metadata over the workspaceFiles Remote namespace |

## attachment

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-attachment-local` | yes | Private content-addressed CORTEX_HOME attachment storage |

## boot

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-config-editor` | no | Persist plugin configuration through profile patches and Loader reconciliation |
| `@cortex-ai/cortex-hmr` | yes | Coordinated module and profile configuration hot reload |
| `@cortex-ai/cortex-plugin-manager` | yes | Current-profile plugin and bundle management shared by cortex CLI, Web and agent tools |

## browser-use

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-browser-use` | no | Exclusive named browser-use provider registration |

## bundle

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-acp-app` | no | The cortex ACP profile bundle: automation-only JSON-RPC stdio and process lifecycle over cortex-base |
| `@cortex-ai/cortex-headless` | yes | The cortex one-shot bundle: a direct core Agent/Session runner over cortex-base with no Host, HTTP, or browser layer |
| `@cortex-ai/cortex-sdk-app` | yes | The cortex SDK profile bundle: stdio JSON-RPC serving and process lifecycle over cortex-base |
| `@cortex-ai/cortex-tui` | yes | The cortex interactive terminal bundle: a chat REPL over cortex-base with slash commands, /plan, and terminal approvals, and no Host, HTTP, or browser layer |
| `@cortex-ai/cortex-web-app` | yes | The cortex browser-surface bundle: the web patch layer over cortex-base plus the runtime glue plugin (frontend dist serving, web-surface prompt, bash runtime variables, URL line) |

## client

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-client-connection` | yes | Authenticated RPC transport and generation lifecycle |
| `@cortex-ai/cortex-client-file-upload` | no | Agent-scoped browser file upload, streaming intake, and staged receipt service |
| `@cortex-ai/cortex-client-hmr` | yes | Web client graph synchronization and rebuilt-bundle reload transport |
| `@cortex-ai/cortex-client-locale` | no | Locale plugin: Host-backed preference, extensible language catalog, browser fallback, and typed built-in dictionaries |
| `@cortex-ai/cortex-client-modules` | no | Client module system, dual-face: node half composes the __CORTEX_BOOT__ entry graph (incremental cortex.client scan, bundle route, index tap, webPlugins service); browser half is the lazy-CJS module table the vendored cordis Loader consumes as its internal seam |
| `@cortex-ai/cortex-client-product-analytics` | yes | Desktop product event collection and authenticated Host reporting |
| `@cortex-ai/cortex-client-resources` | no | Unified client resource model: protocol-registered providers turn URL addresses into live values, consumed through the useResource global standard hook |
| `@cortex-ai/cortex-client-shortcuts` | yes | Application keyboard command registry and physical-key routing |
| `@cortex-ai/cortex-client-ui-agent-preset` | no | Agent-preset surfaces: the default for later sessions, this session's seat, and the composition editor |
| `@cortex-ai/cortex-client-ui-approval` | no | Approval composer takeover over the scoped Remote Event waterfall |
| `@cortex-ai/cortex-client-ui-attachment` | no | Dynamic attachment presentation plugin for conversation input, message-image, and trajectory image slots |
| `@cortex-ai/cortex-client-ui-brand-official` | no | Official CORTEX brand occupants for the Web client's sidebar slots |
| `@cortex-ai/cortex-client-ui-chat` | no | Chat Conversation target, node definitions, renderers, and details surface |
| `@cortex-ai/cortex-client-ui-commands` | no | Client command surface: global directory cache, '/' source, three command UI kinds, popupSelect registry |
| `@cortex-ai/cortex-client-ui-conversation` | no | Target-neutral Conversation assembly, shell, composer, queue, and view navigation |
| `@cortex-ai/cortex-client-ui-deliverables` | no | Changed-files card with per-file comparison tabs, delivery cards, and clickable final-response file references for Web |
| `@cortex-ai/cortex-client-ui-directory-picker-browse` | no | In-app directory browsing surface: the workspace directory-flow owner rendering the host's listing and creation primitives |
| `@cortex-ai/cortex-client-ui-directory-picker-native` | no | Native directory-picker surface: the renderless workspace directory-flow occupant driving the local Desktop or Host OS chooser |
| `@cortex-ai/cortex-client-ui-goal` | no | Session goal surface: GoalBar docked above the composer, read from the goal session projection |
| `@cortex-ai/cortex-client-ui-input-trigger` | no | Input trigger pipeline: '/' and '@' detection, candidate menu, pick routing to registered sources |
| `@cortex-ai/cortex-client-ui-jobs` | no | Session-header background-job list with on-demand streaming record panels |
| `@cortex-ai/cortex-client-ui-layout` | no | Shell plugin: three-column AppFrame with drag handles, ctx.layout viewing-state service (navigation + panels) |
| `@cortex-ai/cortex-client-ui-message-feedback` | no | The Web feedback surface: per-message Like/Dislike in the assistant-message action strip and the feedback dialog behind both ratings and /feedback, backed by the messageFeedback and sessionFeedback Host Remotes |
| `@cortex-ai/cortex-client-ui-model-selection` | no | Model selection over the shared model catalog, Session projection, and session.selectModel |
| `@cortex-ai/cortex-client-ui-open-in-app` | no | Web "Open In..." controls: the Session-header split button opening the workspace directory in an installed application, and the document preview's default-application controls for one file |
| `@cortex-ai/cortex-client-ui-permission-presets` | no | Permission surfaces: a new-session default in General settings and a current-session /permission popup over the permissions projection |
| `@cortex-ai/cortex-client-ui-plan` | no | Plan mode controls, persistent transcript plan cards, and sidebar Markdown previews |
| `@cortex-ai/cortex-client-ui-plugin-manager` | yes | Plugin management for the cortex web client: the sidebar Plugins panel installs, enables, disables, retries, and composes installed plugin packages |
| `@cortex-ai/cortex-client-ui-reference` | no | Unified Web @file and @session reference source |
| `@cortex-ai/cortex-client-ui-renderer` | no | Browser UI renderer: React slot bindings, ctx.uiRenderer, and the assembled application root |
| `@cortex-ai/cortex-client-ui-schedule` | no | Host task management page and Session reminder catalog |
| `@cortex-ai/cortex-client-ui-session` | no | Session Controller adapter for React and session-scoped slots |
| `@cortex-ai/cortex-client-ui-settings` | no | Settings domain base plugin: shared configuration forms and the canonical settings slot-type contract |
| `@cortex-ai/cortex-client-ui-settings-account` | yes | Manage DeepSeek login and open Platform billing pages |
| `@cortex-ai/cortex-client-ui-settings-agent-loop` | no | Settings page of the agent loop on the cortex web client's Plugins page: the parallel tool-call cap of the agent-loop namespace |
| `@cortex-ai/cortex-client-ui-settings-general` | no | Settings ownerless-copy and product onboarding plugin: the General section, shell trigger/header chrome content, settings dictionaries, and the versioned welcome notice |
| `@cortex-ai/cortex-client-ui-settings-models` | yes | Models settings and shared product-onboarding dialogs over existing settings and credential joins |
| `@cortex-ai/cortex-client-ui-settings-plugin-inventory` | no | Read-only Cordis Loader inventory tab in Web Plugins settings |
| `@cortex-ai/cortex-client-ui-settings-plugins` | no | Built-in plugins settings section for the cortex web client: the Settings navigation entry and the tab chrome feature-owned tabs register into |
| `@cortex-ai/cortex-client-ui-settings-session-log` | no | General settings control for Session-log upload with DeepSeek API requests |
| `@cortex-ai/cortex-client-ui-settings-shell` | no | Settings page of the shell executor on the cortex web client's Plugins page: the command timeout and the per-stream output cap of the shell namespace |
| `@cortex-ai/cortex-client-ui-settings-subagent` | no | Settings page of Subagent delegation on the cortex web client's Plugins page: recursion depth, parallel capacity, and the models agents may choose for subagents |
| `@cortex-ai/cortex-client-ui-settings-web-search` | no | Settings page of the DeepSeek web-search provider on the cortex web client's Plugins page: its API key, endpoint, and per-request search budget |
| `@cortex-ai/cortex-client-ui-shortcuts` | no | Keyboard shortcut reference, recording, and local preference editing |
| `@cortex-ai/cortex-client-ui-sidebar` | no | Sidebar plugin: session multi-level tree, search, grouping, state dots |
| `@cortex-ai/cortex-client-ui-sidebar-browser` | no | Sandboxed Web browser tabs for the right Sidebar |
| `@cortex-ai/cortex-client-ui-sidebar-documentpreview` | yes | Extensible Sidebar previews for Office documents, spreadsheets, Markdown, code, images, PDF, HTML, and plain text |
| `@cortex-ai/cortex-client-ui-sidebar-files` | no | Workspace file tree tab type for the right Sidebar: lazy directory listing over the workspaceFiles Remote namespace, opening files into the Sidebar |
| `@cortex-ai/cortex-client-ui-sidebar-right` | no | Right Sidebar: the docking surface's session-bound state, its panel and header expand control, and the navigation service over it |
| `@cortex-ai/cortex-client-ui-sidebar-terminal` | no | Interactive shell tabs for the right Sidebar |
| `@cortex-ai/cortex-client-ui-skill` | no | Web skill references and the dedicated skill tool row |
| `@cortex-ai/cortex-client-ui-subagent` | no | Subagent conversation catalog, continuation routing UI, and '@' reference source |
| `@cortex-ai/cortex-client-ui-theme` | yes | Theme plugin: Host bootstrap for the pre-plugin palette; DOM-free ThemeRuntime for light/dark/system state; --dsw-* token styles and Appearance settings row |
| `@cortex-ai/cortex-client-ui-tool` | no | Client Tool call-tree renderer and keyed per-tool presentation slot |
| `@cortex-ai/cortex-client-ui-trajectory` | no | Trajectory event ledger with an interactive timing overview: pure-consumer plugin registering into the conversation ViewMap (no service) |
| `@cortex-ai/cortex-client-ui-user-questions` | no | Web ask_user_question composer takeover and plan-review presentation UI |
| `@cortex-ai/cortex-client-ui-workflow-run` | no | Durable workflow-run Conversation Node and nested member disclosure for cortex web |
| `@cortex-ai/cortex-client-ui-workspace` | no | Workspace picker plugin: one WorkspacePicker registered into the sidebar and empty-state workspace slots |

## compaction

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-command-compact` | no | Human-facing slash command for explicit session compaction |
| `@cortex-ai/cortex-compaction-basic` | yes | Token-meter-driven compaction policy and LLM summarization backend for the CORTEX |
| `@cortex-ai/cortex-compaction-image-offload` | no | Durable image offload for image-capable routes: replace over-budget request images with placeholders and retry |
| `@cortex-ai/cortex-compaction-tool-result-pruner` | yes | Replay-safe model-free head/middle/tail pruning for tool-result surface nodes |

## computer-use

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-computer-use` | no | Exclusive named computer-use provider registration |

## context

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-agent-instructions` | yes | Workspace context loader for AGENTS.md/CLAUDE.md instruction files |
| `@cortex-ai/cortex-file-reference-local` | yes | Local-filesystem ctx.fileReferences provider with bounded fuzzy indexes |
| `@cortex-ai/cortex-session-reference` | yes | Cross-session snapshot references and durable untrusted model context (ctx.sessionReferenceResolver) |
| `@cortex-ai/cortex-time-context` | yes | Durable per-step context with the current time and elapsed time |
| `@cortex-ai/cortex-tmux-context` | yes | Opt-in durable per-step context with this agent's tmux pane and window location |

## core

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-agent` | no | Agent interface, registry, initiator scope, and event vocabulary for the CORTEX |
| `@cortex-ai/cortex-agent-default-model` | yes | Default model selection shared by Agent entry points |
| `@cortex-ai/cortex-agent-loop` | yes | The concrete agent loop plugin for the CORTEX |
| `@cortex-ai/cortex-agent-tool-presentation` | yes | Agent-plane presentation selector: composes one agent's tools as PTC mode, native, or both |
| `@cortex-ai/cortex-session` | no | Event-sourced session store for the CORTEX |
| `@cortex-ai/cortex-system-prompt` | yes | System prompt assembly registry for the CORTEX |
| `@cortex-ai/cortex-tools` | yes | Tool registry and execution pipeline for the CORTEX |

## credentials

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-authorization` | no | Authorization seam (ctx.authorization): plugin-owned flows that obtain a credential through a conversation with the human |
| `@cortex-ai/cortex-credentials-local` | yes | File-backed credentials provider ($CORTEX_HOME/.env under the live process environment) for the CORTEX |
| `@cortex-ai/cortex-deepseek-account-platform` | yes | Authorize DeepSeek accounts through browser PKCE |

## deliverables

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-tool-present` | yes | Explicit workspace file delivery declarations for the CORTEX |
| `@cortex-ai/cortex-workspace-changes` | yes | Per-turn workspace file changes recorded from git working-tree snapshots and whole-file captures, with per-file comparisons, for the CORTEX |

## document

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-office-to-pdf` | yes | Shared Office-to-PDF conversion with bounded queues and caching |

## experimental

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-experimental-agent-team` | yes | Implicit-root Agent Teams roster, durable peer mailbox, and shared task DAG |
| `@cortex-ai/cortex-experimental-api-speech-to-text` | yes | Authenticated experimental speech transcription for browser clients |
| `@cortex-ai/cortex-experimental-auto-review` | no | Per-tool LLM authorization review for the CORTEX Auto permission preset |
| `@cortex-ai/cortex-experimental-browser-use-chrome-devtools-mcp` | yes | Experimental per-Session Chromium browser tools through chrome-devtools-mcp |
| `@cortex-ai/cortex-experimental-browser-use-playwright-mcp` | yes | Experimental per-Session Chromium browser tools through @playwright/mcp |
| `@cortex-ai/cortex-experimental-browser-use-stagehand-native` | yes | Experimental Stagehand browser tools with separately configured native models |
| `@cortex-ai/cortex-experimental-client-ui-agent-team` | no | Web Agent Teams roster, task board, and teammate navigation |
| `@cortex-ai/cortex-experimental-client-ui-voice-input` | no | Record speech and insert editable text into the conversation draft |
| `@cortex-ai/cortex-experimental-computer-use-cua-driver-mcp` | yes | Experimental computer use through an installed Cua Driver MCP executable |
| `@cortex-ai/cortex-experimental-computer-use-cua-driver-native` | no | Experimental computer-use provider embedding the Cua Driver native npm SDK |
| `@cortex-ai/cortex-experimental-inspector` | yes | Experimental cross-realm CDP hub for Host debugging and Client Runtime inspection |
| `@cortex-ai/cortex-experimental-ptc-runtime-python` | yes | CPython subprocess implementation of the CORTEX PTC execution seam |
| `@cortex-ai/cortex-experimental-speech-to-text` | yes | Experimental speech recognition with independently selectable providers |
| `@cortex-ai/cortex-experimental-speech-to-text-sensevoice` | yes | Local SenseVoice ONNX transcription with a managed sherpa-onnx process |
| `@cortex-ai/cortex-experimental-tool-agent-team` | yes | Scoped model-facing Agent Teams tools over ctx.agentTeams |

## extensions

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-client-ui-cordis` | no | Cordis dynamic-plugin definition card: the keyed cordis_define tool row with its run/stop switch |
| `@cortex-ai/cortex-cordis-client-runner` | no | Browser half of dynamic dual-half plugin packages: event subscription, closure evaluation, guard facade, and loader entries |
| `@cortex-ai/cortex-cordis-host-runner` | yes | Dynamic package definition registry, host-half sandbox lifecycle, and invoke handler table for model-mounted dual-half packages |
| `@cortex-ai/cortex-tool-cordis` | no | Read-only runtime API inspection for Harness plugin development |

## feedback

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-command-feedback` | no | Log-only session feedback: the record event, the sessionFeedback Host Remote, and the human-facing slash command |
| `@cortex-ai/cortex-message-feedback` | yes | Canonical Session-log ratings and notes for finalized assistant messages |

## fs

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-fs-local` | yes | Local-filesystem implementation of the CORTEX filesystem seam (ctx.fs) |
| `@cortex-ai/cortex-fs-observation-policy` | no | File-context policy plugin for the CORTEX — observed-state, read-before-edit, and version-guarded write/edit added over the ctx.fs provider seam through the fs/* event gate (no service API) |
| `@cortex-ai/cortex-fs-sandbox` | yes | Sandbox-enforcing implementation of the CORTEX filesystem seam: fences write/edit by the per-call sandbox mode (read-only denies mutation, workspace-write contains it to the workspace + temp roots) while reads pass through |
| `@cortex-ai/cortex-tool-fs` | yes | Model-facing filesystem tools (read, write, edit) over the CORTEX filesystem seam (ctx.fs) |
| `@cortex-ai/cortex-tool-fs-search` | yes | Model-facing filesystem discovery tools (glob, grep) backed by the packaged ripgrep binary (@vscode/ripgrep) |
| `@cortex-ai/cortex-tool-str-replace-editor` | yes | Model-facing view, create, literal replace, and line insert tool over the Harness filesystem service |

## goal

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-command-goal` | no | Human-facing slash command for persisted same-session goals |
| `@cortex-ai/cortex-goal` | yes | Event-sourced same-session goal state and lifecycle service for the CORTEX |
| `@cortex-ai/cortex-goal-round-driver` | no | Race-fenced same-session goal-round driver |
| `@cortex-ai/cortex-tool-goal` | yes | Model-facing same-session goal tools with execution-time authority checks |

## guard

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-repeat-tool-reminder` | yes | Repeat-tool-call guard plugin: advisory reminders when an agent loops on identical tool calls |
| `@cortex-ai/cortex-tool-call-timeout-policy` | no | Tool-call timeout policy: a tools/execute wrapper that arms a per-tool deadline on exec.signal and returns TOOL_TIMEOUT when it wins |

## hooks

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-hooks-claude-code` | yes | Bridge plugin: run a Claude Code hooks.json / settings hook config on the CORTEX interception seams |
| `@cortex-ai/cortex-hooks-codex` | yes | Bridge plugin: run a Codex hooks.json hook config on the CORTEX interception seams |

## host

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-host-directory-picker-auto` | no | Adaptive chooser of the directory-picker seam: resolves the host situation at boot and mounts the native or browse backend for the CORTEX web GUI host |
| `@cortex-ai/cortex-host-directory-picker-browse` | yes | In-app browsing backend of the directory-picker seam (listing/creation primitives over the host filesystem) |
| `@cortex-ai/cortex-host-directory-picker-native` | no | Native-OS-chooser backend of the directory-picker seam for the CORTEX web GUI host |
| `@cortex-ai/cortex-host-frontend-static` | yes | SPA dist server for the Web shell: owns the webserver fallback seat, serving explicit index entries and static assets with traversal rejection and 404 misses |
| `@cortex-ai/cortex-host-open-in-app` | yes | Host half of open-in-app: resolved application catalog, icons, and the launch endpoint as three webServer routes |
| `@cortex-ai/cortex-host-plugin-inventory` | no | Read-only Remote projection of current Cordis Loader plugin state |
| `@cortex-ai/cortex-host-product-telemetry-otel` | yes | Explicit product usage events exported through OpenTelemetry HTTP logs |
| `@cortex-ai/cortex-host-webserver` | yes | Web route-registration plugin: HTTP and upgrade routes, index transform taps, and static dist fallback; knows no harness concepts |

## interaction

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-commands` | no | Plugin-owned human command registry for CORTEX UIs |
| `@cortex-ai/cortex-permission-presets` | yes | User-facing permission presets (ctx.permissionPresets) for the CORTEX: one product-level Permissions select bundling the sandbox-mode and approval-policy knobs, written through to their own session events |
| `@cortex-ai/cortex-tool-ask-user` | yes | Model-facing ask_user_question tool over the ctx.userQuestions seam |
| `@cortex-ai/cortex-user-approval` | yes | User-approval seam (ctx.approval) for the CORTEX: one-shot permission decisions dispatched to composed answerers over the approval/request waterfall, fail-closed by default |
| `@cortex-ai/cortex-user-questions` | no | Abstract user-questions seam (ctx.userQuestions) for asking the human during agent runs |

## jobs

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-jobs-local` | yes | Process-local implementation of the CORTEX background job registry seam |
| `@cortex-ai/cortex-tool-jobs` | yes | Model-facing background job control tools (job_output, job_list, job_kill) over the ctx.jobs registry |

## llm

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-deepseek-llm-api-extensions` | no | Additive request-field registry for the official DeepSeek LLM API adapter |
| `@cortex-ai/cortex-llm` | no | Provider-neutral LLM service interface for the CORTEX |
| `@cortex-ai/cortex-llm-deepseek-account` | yes | DeepSeek account provider authentication and discovery |
| `@cortex-ai/cortex-llm-deepseek-api-key` | yes | DeepSeek api-key provider authentication and discovery |
| `@cortex-ai/cortex-llm-pi-ai` | yes | pi-ai-backed DeepSeek adapter for the CORTEX LLM seam (design-verification twin of cortex-llm-deepseek) |
| `@cortex-ai/cortex-llm-retry` | yes | Provider-routed LLM request retry policy for the CORTEX |
| `@cortex-ai/cortex-plugin-package-inventory-deepseek` | yes | Active Loader-backed plugin package inventory for official DeepSeek LLM API requests |
| `@cortex-ai/cortex-token-meter` | yes | Replay-aware token measurement service (ctx.tokenMeter) for the CORTEX |

## lsp

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-lsp` | no | Abstract LSP capability seam (ctx.lsp) for the CORTEX — language-server provider registry keyed by branded id and extension mapping, order-independent per-query selection, normalized definition/references/implementation/hover requests and results, and the LspError taxonomy |
| `@cortex-ai/cortex-lsp-stdio` | yes | Generic stdio language-server provider for the CORTEX LSP capability seam (ctx.lsp) — spawns configured servers, translates JSON-RPC, and serves transient-open goToDefinition/findReferences/goToImplementation/hover queries in the host filesystem namespace |
| `@cortex-ai/cortex-tool-lsp` | yes | Model-facing lsp tool over the CORTEX LSP capability seam (ctx.lsp) — one read-only tool with goToDefinition/findReferences/goToImplementation/hover operations, one-based UTF-16 cursor coordinates, bounded location rendering, and hover normalization |

## mcp

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-mcp-client` | yes | MCP client bridge: connects to MCP servers and registers their tools on ctx.tools |
| `@cortex-ai/cortex-mcp-resources` | no | Scoped MCP resource discovery and reading through shared model tools |

## memory

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-memory` | yes | Durable searchable memory across sessions: captured tool activity and turn summaries in SQLite full-text search, a session-start index, memory tools, and /memory commands |

## plan

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-plan-mode` | yes | Logged per-agent plan mode with deployment guidance, a direct slash command, and a user-reviewed exit |

## preset

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-agent-preset` | yes | Declare an Agent capability composition in Cordis YAML |
| `@cortex-ai/cortex-agent-preset-registry` | yes | Declarative Agent preset registry and profile-backed editing |
| `@cortex-ai/cortex-persona` | yes | Composition-authored deployment persona section for the CORTEX |

## ptc-runtime

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-ptc-runtime-node` | yes | Sandboxed Node process implementation of the CORTEX PTC execution capability |

## runtime-diagnostics

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-invariants` | yes | Registry service for package-owned CORTEX runtime invariants |

## sandbox

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-sandbox-local` | yes | Local process-sandbox backends for the CORTEX sandbox seam: bwrap, the npm-distributed landlock-run launcher, macOS Seatbelt, or the Windows ACL restricted-token runner — functionally probed, fail-closed |
| `@cortex-ai/cortex-sandbox-policy` | yes | Per-call sandbox policy resolver and current model context: deployment fallbacks plus each session's mode and workspace root, shared by every enforcing capability family |

## schedule

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-schedule` | yes | Host-wide durable reminders with shared management and original-Session delivery |

## sdk

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-sdk-jsonrpc-server` | yes | Stdio JSON-RPC server plugin for out-of-process CORTEX SDK clients |

## session

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-session-checkpoint-policy` | no | Semantic session durability checkpoints before model requests and tool side effects |
| `@cortex-ai/cortex-session-log-deepseek` | yes | Incremental lossless session-log request extension for the official DeepSeek LLM API |
| `@cortex-ai/cortex-session-persistence-jsonl` | yes | JSONL durable session persistence backend for the CORTEX |
| `@cortex-ai/cortex-session-projection` | no | Session-projection seam: the merge-extensible projection type table, the provider contract, and the ctx.sessionProjections registry serving whole current values of log-derived per-session state |
| `@cortex-ai/cortex-session-projection-cache` | yes | Persisted projection cache (ctx.sessionProjectionCache): durable per-session checkpoint records on the session_projcache storage domain (per-record layout), throttled write-behind, and the cached listing read |
| `@cortex-ai/cortex-session-stats` | no | Whole-log conversation counts and wall times projection (sessionStats) for the CORTEX |
| `@cortex-ai/cortex-session-telemetry-otel` | yes | Feedback-authorized Session logs over byte-bounded OpenTelemetry HTTP requests |
| `@cortex-ai/cortex-session-title` | yes | Log-backed session title service and provider registry for the CORTEX |
| `@cortex-ai/cortex-session-title-all-prompts-llm` | yes | All-user-messages LLM provider plugin for CORTEX session titles |
| `@cortex-ai/cortex-session-title-first-prompt-llm` | yes | First-message LLM provider plugin for CORTEX session titles |
| `@cortex-ai/cortex-session-turn-outline` | no | Whole-log turn outline projection (turnOutline) for the CORTEX |

## session-query

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-session-log-export` | yes | Web Session-log export command and shared download dialog |
| `@cortex-ai/cortex-session-query-sqlite` | yes | Concrete ctx.sessionQuery backend with SQLite FTS5 search |
| `@cortex-ai/cortex-tool-session-query` | yes | Workspace-authorized model-facing session history search, trace, and event read tools |

## settings

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-settings` | no | Abstract user-settings seam (ctx.settings) for the CORTEX |

## shell

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-bash-local` | yes | Local-subprocess implementation of the CORTEX bash executor seam |
| `@cortex-ai/cortex-bash-sandbox` | yes | Sandbox-consuming implementation of the CORTEX bash executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts) |
| `@cortex-ai/cortex-pwsh-local` | yes | Local PowerShell implementation of the CORTEX bash executor seam |
| `@cortex-ai/cortex-pwsh-sandbox` | yes | Sandbox-consuming implementation of the CORTEX PowerShell executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts) |
| `@cortex-ai/cortex-shell-env` | yes | Tool-independent managed CORTEX_* shell environment registry |
| `@cortex-ai/cortex-tool-bash` | yes | Model-facing bash tool with optional generic background-job and sandbox-escalation support |
| `@cortex-ai/cortex-tool-bash-persistent` | yes | Model-facing owner-scoped persistent Bash tool backed by the Harness PTY service |
| `@cortex-ai/cortex-tool-pwsh` | yes | Model-facing pwsh tool over the bash executor seam |
| `@cortex-ai/cortex-tool-pwsh-persistent` | yes | Model-facing owner-scoped persistent PowerShell tool backed by the Harness PTY service |

## skill

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-skill` | yes | Agent skill provider registry for the CORTEX |
| `@cortex-ai/cortex-skill-badge` | no | Bundled cortex badge skill provider for CORTEX |
| `@cortex-ai/cortex-skill-filesystem` | yes | Local filesystem skill provider for the CORTEX |
| `@cortex-ai/cortex-skill-office` | yes | Bundled Word, PowerPoint, and Excel workflows and structural checks |
| `@cortex-ai/cortex-tool-skill` | yes | Model-facing skill loading tool for the CORTEX |
| `@cortex-ai/cortex-tool-workspace-dependencies` | yes | The load_workspace_dependencies tool: absolute paths into a bundled Python, Node.js, and pnpm payload |

## spill

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-spill-local` | yes | Local-filesystem implementation of the CORTEX spill storage seam (private session-scoped files) |
| `@cortex-ai/cortex-spill-policy` | yes | Token-budgeted tool-result retention with recoverable text and image paths |

## ssh

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-fs-ssh` | no | Filesystem provider over the shared POSIX SSH helper |
| `@cortex-ai/cortex-sandbox-ssh` | no | Remote POSIX sandbox argv provider over the shared SSH helper |
| `@cortex-ai/cortex-ssh` | yes | Shared OpenSSH connection and versioned POSIX remote helper |
| `@cortex-ai/cortex-subprocess-ssh` | no | Subprocess and terminal provider over the shared POSIX SSH helper |

## storage

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-storage` | no | Storage hub (ctx.storage): named backend registry plus mounted data-form facilities for the CORTEX |
| `@cortex-ai/cortex-storage-domain` | yes | Domain data form (ctx.storage.domain): schema-validated, event-emitting KV domains over storage backends for the CORTEX |
| `@cortex-ai/cortex-storage-json` | yes | JSON file KV storage backend for the CORTEX storage hub |
| `@cortex-ai/cortex-storage-sqlite` | yes | SQLite storage backend (kv facet) for the CORTEX storage hub |

## subagent

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-subagent` | yes | Abstract subagent seam (ctx.subagents): named-provider registry for delegating to child agents |
| `@cortex-ai/cortex-subagent-acp` | yes | Out-of-process ACP subagent backend: drives a child agent in a spawned subprocess over the Agent Client Protocol |
| `@cortex-ai/cortex-subagent-claude-code` | yes | One-shot Claude Code subagent provider over the official Agent SDK |
| `@cortex-ai/cortex-subagent-codex` | yes | One-shot Codex subagent provider over the official app-server protocol |
| `@cortex-ai/cortex-subagent-cortex-sdk` | yes | Out-of-process SDK subagent backend: drives a child CORTEX runtime subprocess over stdio JSON-RPC through the TypeScript SDK client |
| `@cortex-ai/cortex-subagent-fork-in-process` | yes | In-process fork subagent backend: runs a child agent seeded with a prefix of the parent's log |
| `@cortex-ai/cortex-subagent-spawn-in-process` | yes | In-process spawn subagent backend: runs a fresh child agent on ctx.agents |
| `@cortex-ai/cortex-tool-subagent` | yes | Model-facing subagent delegation tool over the ctx.subagents seam |
| `@cortex-ai/cortex-tool-subagent-control` | no | Globally named send_message, interrupt_agent, and list_agents tools over ctx.subagents continuations |

## subprocess

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-subprocess-local` | no | Local-subprocess implementation of the CORTEX subprocess seam |

## telemetry

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-otel` | no | Cordis service for independent ordinary-event and byte-bounded Session-log OTLP channels |

## terminal

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-terminal` | no | Persistent PTY session seam for the CORTEX — owner-scoped ids, backend registry, interactive sends, reads, signals, and awaited cleanup |
| `@cortex-ai/cortex-terminal-bash` | yes | Persistent shell PTY backend over the CORTEX subprocess terminal primitive |
| `@cortex-ai/cortex-tool-terminal` | yes | Six model-facing persistent PTY tools with owner isolation and generic background-job integration |

## test-support

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-llm-replay` | yes | Replay LLM plugin: short-circuits llm/stream with model chunks reconstructed from a recorded session JSONL (keyless snapshot tests) |

## todo

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-tool-todo` | yes | Model-facing todo_write tool over the CORTEX event-sourced session log |

## typert

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-typert-loader` | yes | Loader integration for generated Typert package contributions |

## web

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-tool-web` | yes | Model-facing web tools (web_search, web_fetch) over the CORTEX web capability seam (ctx.web) |
| `@cortex-ai/cortex-web` | yes | Abstract web access capability seam (ctx.web) for the CORTEX — search/fetch provider registry, registration-order-independent selection, request/result vocabulary, and the WebError taxonomy |
| `@cortex-ai/cortex-web-fetch-http` | yes | Anonymous public HTTP(S) fetch provider for the CORTEX web capability seam (ctx.web) |
| `@cortex-ai/cortex-web-search-deepseek` | yes | DeepSeek-backed search provider (native web_search via the Anthropic-compatible API) for the CORTEX web capability seam (ctx.web) |
| `@cortex-ai/cortex-web-search-exa` | yes | Exa-backed search provider for the CORTEX web capability seam (ctx.web) |
| `@cortex-ai/cortex-web-search-perplexity` | yes | Perplexity-backed search provider for the CORTEX web capability seam (ctx.web) |

## webhook

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-webhook` | no | Fire-and-forget webhook rule runtime that creates Workspace-backed CORTEX Sessions |
| `@cortex-ai/cortex-webhook-github` | yes | Signed GitHub HTTP webhook adapter for the CORTEX webhook runtime |

## workflow

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-tool-ralph` | yes | Model-facing fresh-agent Ralph loop over the workflow and subagent seams |
| `@cortex-ai/cortex-tool-workflow` | yes | Model-facing workflow tool: run a JavaScript orchestration script over ctx.workflowEngine |
| `@cortex-ai/cortex-workflow-ptc` | yes | Workflow orchestration in the shared sandboxed Node PTC runtime |

## workspace

| Package | Config | Description |
|---|---|---|
| `@cortex-ai/cortex-workspace` | no | Workspace entity registry (ctx.workspaceRegistry): durable workspace records with validated session attachment over the domain data form for the CORTEX |
