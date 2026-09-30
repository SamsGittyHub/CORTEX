/**
 * The model-facing memory tools. They follow progressive disclosure: search
 * and timeline return one line per entry, and only memory_get returns full
 * bodies, so the model pays for detail only where it asks for it.
 * @module @cortex-ai/cortex-memory/tools
 */

import type { Context } from '@cortex-ai/cordis'
import type { Agent } from '@cortex-ai/cortex-agent'
import { defineTool } from '@cortex-ai/cortex-tools'
import { noteFrom } from './capture.ts'
import type { CaptureLimits } from './capture.ts'
import { formatDate } from './context.ts'
import type { MemoryStore } from './store.ts'
import type { SearchHit } from './types.ts'

/** What the tools need from the plugin. */
export interface ToolOptions {
  readonly store: MemoryStore
  readonly limits: CaptureLimits
  /** Most results a search or timeline returns. */
  readonly searchLimit: number
  /** Names of the four tools, in the order search, timeline, get, save. */
  readonly names: readonly [string, string, string, string]
  /** The project a call belongs to. */
  readonly projectOf: (agent: Agent | undefined) => string | undefined
  /** The clock. */
  readonly now: () => number
}

/** Most entries memory_get returns in one call. */
const MAX_GET = 10

/** Most entries memory_timeline shows on either side of the anchor. */
const MAX_AROUND = 10

const ENTRY_FIELDS = {
  id: { type: 'integer', required: true },
  type: { type: 'string', required: true },
  date: { type: 'string', required: true },
  title: { type: 'string', required: true },
} as const

const HIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { ...ENTRY_FIELDS, snippet: { type: 'string', required: true } },
} as const

const FULL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ...ENTRY_FIELDS,
    body: { type: 'string', required: true },
    files: { type: 'array', required: true, items: { type: 'string' } },
  },
} as const

function toValue(hit: SearchHit): { id: number; type: string; date: string; title: string; snippet: string } {
  return { id: hit.id, type: hit.type, date: formatDate(hit.ts), title: hit.title, snippet: hit.snippet }
}

/** One `#id date type: title` line plus an indented snippet per hit, or `empty` when there are none. */
function hitLines(hits: readonly { id: number; type: string; date: string; title: string; snippet: string }[], empty: string): string {
  return hits.length === 0
    ? empty
    : hits.map(hit => `#${String(hit.id)} ${hit.date} ${hit.type}: ${hit.title}\n    ${hit.snippet}`).join('\n')
}

function clamp(value: number | undefined, fallback: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value ?? fallback), 1), max)
}

/**
 * Register the four memory tools.
 * @param ctx - context carrying the tool registry.
 * @param options - the store, limits, and tool names.
 */
export function registerTools(ctx: Context, options: ToolOptions): void {
  const { store, limits, searchLimit, names, projectOf, now } = options
  const [searchName, timelineName, getName, saveName] = names

  ctx.tools.register(defineTool({
    name: searchName,
    description: 'Search notes from earlier work: what was done, decided, and learned in past sessions. '
      + 'Returns one line per entry with its #id; fetch details with memory_get.',
    parameters: {
      query: { type: 'string', required: true, description: 'Words to look for.' },
      scope: { type: 'string', enum: ['project', 'all'], description: 'project (this working directory, default) or all projects.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { hits: { type: 'array', required: true, items: HIT_SCHEMA } },
      },
      render: (_args, value) => [{ type: 'text', text: hitLines(value.hits, 'No matching memory.') }],
    },
    execute(args, exec) {
      const project = args.scope === 'all' ? undefined : projectOf(exec.agent)
      return Promise.resolve({ hits: store.search(args.query, { project, limit: searchLimit }).map(toValue) })
    },
  }))

  ctx.tools.register(defineTool({
    name: timelineName,
    description: 'Show what happened just before and after one memory entry in its session, to see its context.',
    parameters: {
      id: { type: 'integer', required: true, description: 'The entry #id.' },
      before: { type: 'integer', description: 'Entries to show before it (default 3, at most 10).' },
      after: { type: 'integer', description: 'Entries to show after it (default 3, at most 10).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { entries: { type: 'array', required: true, items: HIT_SCHEMA } },
      },
      render: (_args, value) => [{ type: 'text', text: hitLines(value.entries, 'No such memory entry.') }],
    },
    execute(args) {
      const entries = store.around(args.id, clamp(args.before, 3, MAX_AROUND), clamp(args.after, 3, MAX_AROUND))
      return Promise.resolve({ entries: entries.map(toValue) })
    },
  }))

  ctx.tools.register(defineTool({
    name: getName,
    description: 'Fetch memory entries in full by #id (at most 10 at a time).',
    parameters: {
      ids: { type: 'array', required: true, items: { type: 'integer' }, description: 'Entry ids from memory_search or the memory index.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          entries: {
            type: 'array',
            required: true,
            items: FULL_SCHEMA,
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.entries.length === 0
          ? 'No such memory entries.'
          : value.entries.map(entry => `#${String(entry.id)} ${entry.date} ${entry.type}: ${entry.title}\n${entry.body}${entry.files.length === 0 ? '' : `\nfiles: ${entry.files.join(', ')}`}`).join('\n\n'),
      }],
    },
    execute(args) {
      const entries = store.get(args.ids.slice(0, MAX_GET))
      return Promise.resolve({
        entries: entries.map(entry => ({
          id: entry.id, type: entry.type, date: formatDate(entry.ts), title: entry.title, body: entry.body, files: [...entry.files],
        })),
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: saveName,
    description: 'Save a note that should be remembered in future sessions, when the user asks you to remember something or you learn a durable fact about the project.',
    parameters: {
      text: { type: 'string', required: true, description: 'What to remember, in one or two sentences.' },
      title: { type: 'string', description: 'A short title; defaults to the start of the text.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { id: { type: 'integer' }, saved: { type: 'boolean', required: true } },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.saved ? `Saved as memory #${String(value.id)}.` : 'Nothing was saved: the text was empty after private content was removed.',
      }],
    },
    execute(args, exec) {
      const origin = { session: exec.agent?.session.id ?? '', project: projectOf(exec.agent) ?? '', ts: now() }
      const entry = noteFrom({ text: args.text, title: args.title }, origin, limits)
      return Promise.resolve(entry === undefined ? { saved: false } : { saved: true, id: store.add(entry) })
    },
  }))
}
