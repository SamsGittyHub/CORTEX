/**
 * @cortex-ai/cortex-memory — durable, searchable memory across sessions.
 *
 * The plugin records what agents do (each finished tool call and a summary of
 * each completed turn) in one SQLite database with a full-text index, shows
 * the model a one-line-per-entry index of the project's recent memory when a
 * session starts, and registers four tools (search, timeline, get, save) and
 * three commands (`/memory`, `/remember`, `/forget`). Text in `<private>` tags
 * and credential-shaped strings are removed before anything is stored.
 *
 * The session-start index is injected as a logged user message, so it is
 * reconstructable from the session log like every other model-visible input.
 *
 * @module @cortex-ai/cortex-memory
 */

import type { Context } from '@cortex-ai/cordis'
import z from '@cortex-ai/schemastery'
import type { Agent } from '@cortex-ai/cortex-agent'
import { createUserMessage } from '@cortex-ai/cortex-llm'
import type { ContextFormed } from '@cortex-ai/cortex-llm'
import type { Session, SessionEvent } from '@cortex-ai/cortex-session'
import type {} from '@cortex-ai/cortex-commands'
import { observationFrom, summaryFrom } from './capture.ts'
import type { CaptureLimits, EntryOrigin } from './capture.ts'
import { memoryCommands } from './commands.ts'
import { renderIndex } from './context.ts'
import { MemoryStore } from './store.ts'
import { registerTools } from './tools.ts'
export type * from './types.ts'

declare module '@cortex-ai/cortex-llm' {
  interface MessageSourceMap {
    /**
     * The memory index a session starts with.
     * @persistenceAttribution
     */
    'memory-context': { kind: 'memory-context' } & ContextFormed
  }
}

/** Stable Cordis plugin name. */
export const name = 'memory'

/** Services required before memory can register its tools. */
export const inject = ['tools']

/** The model-facing tool names. */
export const TOOL_NAMES = ['memory_search', 'memory_timeline', 'memory_get', 'memory_save'] as const

/** Memory settings. */
export interface Config {
  /** Whether memory is on; when false the plugin registers nothing and opens no database. */
  enabled: boolean
  /** The SQLite database file, or `:memory:` for one that lasts only this process. */
  path: string
  /** Whether to record tool calls and turn summaries automatically. */
  capture: boolean
  /** Whether to show the model the project's memory index when a session starts. */
  injectContext: boolean
  /** Most entries in the session-start index. */
  contextMaxEntries: number
  /** Most characters in the session-start index, header included. */
  contextMaxChars: number
  /** Longest stored entry body, in characters. */
  maxBodyChars: number
  /** Most results a search, timeline, or `/memory` listing returns. */
  searchLimit: number
  /** Tools whose calls are never recorded; the memory tools themselves are always ignored. */
  ignoreTools: string[]
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().required(),
  path: z.string().required(),
  capture: z.boolean().required(),
  injectContext: z.boolean().required(),
  contextMaxEntries: z.number().step(1).min(1).required(),
  contextMaxChars: z.number().step(1).min(200).required(),
  maxBodyChars: z.number().step(1).min(80).required(),
  searchLimit: z.number().step(1).min(1).max(50).required(),
  ignoreTools: z.array(z.string()).required(),
})

/** Per-Session facts gathered between `turn/start` and `turn/end`. */
interface TurnState {
  request: string | undefined
  outcome: string
  calls: Map<string, { tool: string; argumentsJson: string }>
}

function textOf(content: readonly { type: string; text?: string }[]): string {
  return content.map(block => (block.type === 'text' && block.text !== undefined ? block.text : '')).join('')
}

/**
 * Mount memory.
 * @param ctx - plugin context carrying the tool registry.
 * @param config - validated memory settings.
 */
export function apply(ctx: Context, config: Config): void {
  if (!config.enabled) return
  const store = MemoryStore.open(config.path)
  ctx.effect(() => () => { store.close() }, 'memory: close database')
  const now = (): number => Date.now()
  const limits: CaptureLimits = {
    maxBodyChars: config.maxBodyChars,
    ignoreTools: new Set([...config.ignoreTools, ...TOOL_NAMES]),
  }
  const projectOf = (agent: Agent | undefined): string | undefined => agent?.session.header.cwd

  registerTools(ctx, { store, limits, searchLimit: config.searchLimit, names: TOOL_NAMES, projectOf, now })
  ctx.inject(['commands'], (child) => {
    for (const definition of memoryCommands({ store, limits, listLimit: config.searchLimit, now })) {
      child.effect(() => child.commands.register(definition), `memory: /${definition.name} command`)
    }
  })

  const turns = new WeakMap<Session, TurnState>()
  const stateOf = (session: Session): TurnState => {
    let state = turns.get(session)
    if (state === undefined) {
      state = { request: undefined, outcome: '', calls: new Map() }
      turns.set(session, state)
    }
    return state
  }
  const originOf = (session: Session): EntryOrigin => ({ session: session.id, project: session.header.cwd ?? '', ts: now() })

  if (config.capture) {
    ctx.on('session/event', (session: unknown, event: SessionEvent): void => {
      const live = session as Session
      const state = stateOf(live)
      switch (event.type) {
        case 'turn/start':
          state.request = undefined
          state.outcome = ''
          state.calls.clear()
          return
        case 'user/message':
          if (state.request === undefined && event.data.source.kind === 'user') state.request = textOf(event.data.content)
          return
        case 'assistant/message': {
          const text = textOf(event.data.message.content)
          if (text !== '') state.outcome = text
          return
        }
        case 'tool/call':
          state.calls.set(event.data.callId, { tool: event.data.name, argumentsJson: event.data.arguments })
          return
        case 'tool/result': {
          if (event.surfaceOp !== 'append') return
          const call = state.calls.get(event.data.message.toolCallId)
          if (call === undefined) return
          const entry = observationFrom(
            { ...call, resultText: textOf(event.data.message.content), failed: event.data.message.isError === true },
            originOf(live),
            limits,
          )
          if (entry !== undefined) store.add(entry)
          return
        }
        case 'turn/end': {
          if (event.data.reason.kind !== 'completed' || state.request === undefined) return
          const entry = summaryFrom({ request: state.request, outcome: state.outcome }, originOf(live), limits)
          if (entry !== undefined) store.add(entry)
          return
        }
        default:
          return
      }
    })
  }

  if (config.injectContext) {
    ctx.on('agent/created', ({ agent, source }) => {
      // A resumed session's log already holds the index it started with, and a subagent works from its parent's brief.
      if (source === 'resume' || agent.session.header.origin === 'subagent') return undefined
      const hits = store.recent({
        project: agent.session.header.cwd,
        types: ['note', 'summary', 'observation'],
        limit: config.contextMaxEntries,
      })
      const index = renderIndex(hits, config.contextMaxChars)
      if (index !== undefined) {
        agent.inject(createUserMessage({ content: [{ type: 'text', text: index }], source: { kind: 'memory-context' } }))
      }
      return undefined
    })
  }
}
