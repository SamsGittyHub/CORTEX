/**
 * @cortex-ai/cortex-tui — interactive terminal chat over cortex-base. The
 * bundle patch mounts no Host, HTTP server, or browser plugin. This runner
 * creates one Agent through the core registry (or continues the Session
 * `--resume` names), reads lines from the terminal, sends messages as turns,
 * runs `/commands` through the shared command registry, streams the reply as
 * it is produced, and answers approval and question requests in the terminal.
 *
 * @module @cortex-ai/cortex-tui
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@cortex-ai/cordis'
import z from '@cortex-ai/schemastery'
import { brandString } from '@cortex-ai/cortex-brand'
import { installModelSelection } from '@cortex-ai/cortex-agent'
import type { Agent, ModelSelectionRef } from '@cortex-ai/cortex-agent'
import type {} from '@cortex-ai/cortex-agent-default-model'
import type {} from '@cortex-ai/cortex-fs'
import { createUserMessage } from '@cortex-ai/cortex-llm'
import type { SessionEvent, SessionId } from '@cortex-ai/cortex-session'
import { SessionQueryError } from '@cortex-ai/cortex-session-query'
import { assertNever } from '@cortex-ai/cortex-util-values'
// Empty type imports carry the Context merges for the loader settlement await,
// the appExit host value, Session queries, and the command, approval, and
// question services this runner uses.
import type {} from '@cortex-ai/cordis-plugin-loader'
import type {} from '@cortex-ai/cortex-cmdline'
import type {} from '@cortex-ai/cortex-session-query'
import type {} from '@cortex-ai/cortex-commands'
import type {} from '@cortex-ai/cortex-plan-mode'
import type {} from '@cortex-ai/cortex-user-approval'
import type {} from '@cortex-ai/cortex-user-questions'
import { ActivityView } from './activity.ts'
import { banner, sessionCard, statsCard } from './banner.ts'
import type { SessionFacts } from './banner.ts'
import { spectrum } from './lobes.ts'
import { askApproval, askQuestions } from './interaction.ts'
import { completeCommand, runRepl } from './repl.ts'
import type { CommandOutcome, CommandRow, ReplAgent } from './repl.ts'
import type { LocalCommandName } from './render.ts'
import { internals } from './runner-internals.ts'
import { THEMES, THEME_NAMES, createPainter, detectColorMode, isThemeName } from './theme.ts'
import type { ColorMode, Painter, ThemeName } from './theme.ts'

/** Stable Cordis plugin name. */
export const name = 'tui-runner'

/** Core services required before the first prompt. */
export const inject = ['agentDefaultModel', 'agents', 'sessions']

/** Plugin config: the launch options resolved from this app's injected provider service. */
export interface Config {
  /** A first message to send before the first prompt. */
  message?: string
  /** Exact Session identity to continue; absent for a new conversation. */
  resume?: string
  /** Whether `--no-color` was passed. */
  noColor?: boolean
}

export const Config: z<Config> = z.object({
  message: z.string(),
  resume: z.string(),
  noColor: z.boolean(),
})

/** Join the text blocks of a tool result's content. */
function resultText(content: readonly { type: string; text?: string }[]): string {
  return content.map(block => (block.type === 'text' && block.text !== undefined ? block.text : '')).join('')
}

/**
 * Feed one Agent's live stream and committed Session events to the activity view.
 * @param ctx - plugin context carrying the live event feeds.
 * @param agent - the Agent whose activity is shown.
 * @param view - the terminal view.
 * @returns a disposer that stops the projection.
 */
function streamActivity(ctx: Context, agent: Agent, view: ActivityView): () => void {
  const stopStream = ctx.on('agent/assistant-stream', ({ agent: subject, frame }) => {
    if (subject !== agent || frame.type === 'start') return
    if (frame.type === 'end') {
      if (frame.outcome.kind === 'abandoned') view.attemptAbandoned()
      else view.attemptEnd()
      return
    }
    const chunk = frame.chunk
    switch (chunk.type) {
      case 'text-delta':
        view.textDelta(chunk.text)
        return
      case 'reasoning-delta':
        view.reasoningDelta()
        return
      case 'block-start':
      case 'block-end':
      case 'tool-call-delta':
      case 'usage':
      case 'finish':
        return
      /* v8 ignore next -- closed-union exhaustiveness guard */
      default:
        return assertNever(chunk, 'tui assistant stream')
    }
  })

  const stopSession = ctx.on('session/event', (session: unknown, event: SessionEvent): void => {
    if (session !== agent.session) return
    switch (event.type) {
      case 'turn/start':
        view.turnStart()
        return
      case 'step/start':
        view.step()
        return
      case 'assistant/message':
        if (event.data.usage !== undefined) view.usage(event.data.usage.inputTokens, event.data.usage.outputTokens)
        return
      case 'tool/call':
        view.toolCall(event.data.callId, event.data.name, event.data.arguments)
        return
      case 'tool/result':
        if (event.surfaceOp !== 'append') return
        view.toolResult(event.data.message.toolCallId, resultText(event.data.message.content), event.data.message.isError === true)
        return
      case 'turn/end': {
        const reason = event.data.reason
        if (reason.kind === 'error') view.turnEnd({ kind: 'error', code: reason.error.code, message: reason.error.message })
        else view.turnEnd({ kind: reason.kind === 'aborted' ? 'aborted' : 'completed' })
        return
      }
      case 'plan/mode':
        view.planModeChanged(event.data.active)
        return
      default:
        return
    }
  })
  return () => {
    stopStream()
    stopSession()
  }
}

/** Reject a Session the terminal must not continue. */
function assertResumable(
  header: { cwd?: string | undefined; origin?: 'subagent' | undefined; parentSession?: SessionId | undefined },
  events: Iterable<{ type: string }>,
  sessionId: SessionId,
  cwd: string,
): void {
  for (const event of events) {
    // Owned by cortex-agent-preset-registry, which this bundle does not compose,
    // so continuing here would silently run the session under other prompts and tools.
    if (event.type === 'agent-preset/selected') {
      throw new Error(`session "${sessionId}" runs under an agent preset, which the terminal app does not compose`)
    }
  }
  if (header.origin === 'subagent' || header.parentSession !== undefined) {
    throw new Error(`session "${sessionId}" is a subagent or forked session and cannot be driven directly`)
  }
  if (header.cwd === undefined) throw new Error(`session "${sessionId}" recorded no working directory, so it cannot be continued`)
  if (header.cwd !== cwd) throw new Error(`session "${sessionId}" was recorded in "${header.cwd}", not "${cwd}"`)
}

/**
 * Resolve the Agent for `--resume`: continue a persisted Session that no live
 * Agent in this process owns.
 * @param ctx - plugin context carrying the Session query service.
 * @param sessionId - exact Session identity to continue.
 * @param agentOptions - provider and model for the resumed Agent.
 * @param setup - per-Agent scope setup installing the model selection.
 * @param cwd - working directory resolved in the mounted filesystem.
 * @returns the resumed Agent.
 */
async function resumeAgent(
  ctx: Context,
  sessionId: SessionId,
  agentOptions: { provider: string; model: string },
  setup: (agentCtx: Context) => void,
  cwd: string,
): Promise<Agent> {
  if (ctx.get('sessionPersistence') === undefined) {
    throw new Error('--resume requires the sessionPersistence service; the Session would not survive this process')
  }
  const query = ctx.get('sessionQuery')
  if (query === undefined) throw new Error('--resume requires the sessionQuery service; cortex-base provides it')
  const { agents } = ctx
  if (agents.get(sessionId) !== undefined) throw new Error(`session "${sessionId}" is already live in this process`)
  try {
    using observation = await query.observeSession(sessionId)
    assertResumable(observation.header, observation.events, sessionId, cwd)
    const { agent } = await agents.resume({ resumeSessionId: sessionId, agentOptions, setup })
    return agent
  } catch (error: unknown) {
    if (!(error instanceof SessionQueryError) || error.code !== 'SESSION_QUERY_SESSION_NOT_FOUND') throw error
    throw new Error(`session "${sessionId}" does not exist; omit --resume to start a new Session`)
  }
}

/** Bind the Agent operations the loop drives to the real services. */
function bindAgent(ctx: Context, agent: Agent): ReplAgent {
  let controller = new AbortController()
  return {
    submit(text) {
      agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
    },
    async runCommand(line): Promise<CommandOutcome | undefined> {
      const commands = ctx.get('commands')
      if (commands === undefined) return { kind: 'error', text: 'commands are not available in this composition' }
      controller = new AbortController()
      const execution = await commands.execute(agent, line, [], controller.signal)
      return execution?.result
    },
    commands(): readonly CommandRow[] {
      return ctx.get('commands')?.list(agent).map(({ name: commandName, description }) => ({ name: commandName, description })) ?? []
    },
    idle: () => agent.whenIdle(),
    cancel() {
      controller.abort()
      agent.cancel({ kind: 'user' })
    },
    flush: async () => { await ctx.sessions.flush(agent.session) },
  }
}

/**
 * Run the chat until the user leaves, then request process exit.
 * @param ctx - plugin context carrying core services and the launcher's exit request.
 * @param config - the launch options.
 * @param exit - request process exit with a code after the tree disposes.
 */
async function run(ctx: Context, config: Config, exit: (code: number) => void): Promise<void> {
  // Loader siblings mount concurrently. Await the complete application before
  // creating an Agent so its scoped tools and adapters are not half-composed.
  await ctx.get('loader')?.await()
  const { agents, agentDefaultModel: defaultModel } = ctx

  if (config.resume !== undefined && config.resume.trim() === '') {
    throw new Error('tui-runner: resume must not be blank')
  }

  const selection = defaultModel.currentSelection()
  const agentOptions = { provider: selection.provider, model: selection.model }
  const setup = (agentCtx: Context): void => {
    const selected: ModelSelectionRef = { current: selection, assembled: undefined }
    installModelSelection(agentCtx, selected)
  }
  const fs = ctx.get('fs')
  const cwd = fs === undefined ? process.cwd() : fs.processPath(await fs.resolve('.'))
  const sessionId = brandString<SessionId>(config.resume ?? `session-${randomUUID()}`)
  const agent = config.resume === undefined
    ? (await agents.create({ sessionId, meta: { cwd }, agentOptions, setup })).agent
    : await resumeAgent(ctx, sessionId, agentOptions, setup, cwd)
  await agent.whenIdle()

  const bound = bindAgent(ctx, agent)
  const term = internals.openTerminal(line => completeCommand(line, bound.commands()))
  const env = internals.env()
  const mode: ColorMode = detectColorMode({ isTty: internals.stdoutIsTty(), noColorFlag: config.noColor === true, env })
  let themeName: ThemeName = 'cortex'
  let painter = createPainter(mode, THEMES[themeName])
  // Every consumer paints through this wrapper, so `/theme` restyles later output at once.
  const paint: Painter = (style, text) => painter(style, text)
  const io = { readLine: (prompt: string) => term.readLine(prompt), out: (text: string) => { term.out(text) } }
  const animate = internals.stdoutIsTty()
  const view = new ActivityView({ write: io.out, paint, timers: internals.timers, animate })
  const facts = (): SessionFacts => ({ model: selection.model, cwd, sessionId, theme: themeName, home: env['HOME'] ?? env['USERPROFILE'] })

  const local = (name: LocalCommandName, args: string): string => {
    switch (name) {
      case 'clear':
        return animate ? '\u001b[2J\u001b[3J\u001b[H' : ''
      case 'session':
        return sessionCard(facts(), paint)
      case 'stats':
        return statsCard(view.totals(), paint)
      case 'theme': {
        if (mode === 'none') return `${paint('dim', 'colors are off: not a color terminal, NO_COLOR is set, or --no-color was passed')}\n`
        const requested = args === '' ? THEME_NAMES[(THEME_NAMES.indexOf(themeName) + 1) % THEME_NAMES.length] as ThemeName : args.toLowerCase()
        if (!isThemeName(requested)) return `${paint('red', `unknown theme "${args}"`)} ${paint('dim', `(${THEME_NAMES.join(', ')})`)}\n`
        themeName = requested
        painter = createPainter(mode, THEMES[themeName])
        return `${paint('accent', '◈')} theme ${paint('bold', themeName)}  ${spectrum(paint)}\n`
      }
      /* v8 ignore next -- closed-union exhaustiveness guard */
      default:
        return assertNever(name, 'tui local command')
    }
  }
  const prompt = (): string => (view.planMode ? `${paint('planning', '▤ plan ›')} ` : `${paint('accent', '›')} `)

  const stopApprovals = ctx.on('approval/request', async request => askApproval(io, paint, request))
  const stopQuestions = ctx.on('user-questions/request', async request => askQuestions(io, paint, request.questions))
  const stopActivity = streamActivity(ctx, agent, view)
  try {
    io.out(banner(facts(), paint))
    await runRepl(bound, term, paint, { prompt, local, initialLine: config.message })
    io.out(`\n${paint('dim', `resume with: cortex --profile tui --resume ${sessionId}`)}\n`)
    exit(0)
  } finally {
    stopApprovals()
    stopQuestions()
    stopActivity()
    view.dispose()
    term.close()
  }
}

/** Report an unexpected runner failure on stderr and request a failing exit. */
function fail(error: unknown, exit: (code: number) => void): void {
  const message = error instanceof Error ? error.message : String(error)
  internals.writeErr(`cortex: ${message}\n`)
  exit(1)
}

/**
 * Mount the interactive terminal driver.
 * @param ctx - plugin context carrying core services and the launcher-provided exit request.
 * @param config - validated launch options.
 */
export function apply(ctx: Context, config: Config): void {
  // Read through the global service store, not the property proxy: appExit is
  // an optional host value, never an injected dependency.
  const exit = ctx.get('appExit')
  if (exit === undefined) {
    throw new Error('tui-runner: the launcher must provide ctx.appExit before the tree mounts')
  }
  void run(ctx, config, exit).catch((error: unknown) => { fail(error, exit) })
}
