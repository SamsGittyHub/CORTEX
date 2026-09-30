/**
 * Slash commands for people: browse, add, and delete memory without a model turn.
 * @module @cortex-ai/cortex-memory/commands
 */

import type { CommandDefinition } from '@cortex-ai/cortex-commands'
import { noteFrom } from './capture.ts'
import type { CaptureLimits } from './capture.ts'
import { formatHit } from './context.ts'
import type { MemoryStore } from './store.ts'
import type { SearchHit } from './types.ts'

/** What the commands need from the plugin. */
export interface CommandOptions {
  readonly store: MemoryStore
  readonly limits: CaptureLimits
  /** Most entries `/memory` lists. */
  readonly listLimit: number
  /** The clock. */
  readonly now: () => number
}

function list(hits: readonly SearchHit[], empty: string): string {
  return hits.length === 0 ? empty : hits.map(formatHit).join('\n')
}

/**
 * Build the three commands.
 * @param options - the store and limits.
 * @returns `/memory [words]`, `/remember <text>`, and `/forget <id>`.
 */
export function memoryCommands(options: CommandOptions): CommandDefinition[] {
  const { store, limits, listLimit, now } = options
  return [
    {
      name: 'memory',
      description: 'list recent memory for this project, or search it',
      input: { hint: 'words to search for (optional)' },
      handler: ({ agent, rawInput }) => {
        const project = agent.session.header.cwd
        const query = rawInput.trim()
        const hits = query === ''
          ? store.recent({ project, types: ['note', 'summary', 'observation'], limit: listLimit })
          : store.search(query, { project, limit: listLimit })
        return { kind: 'success', text: list(hits, query === '' ? 'No memory for this project yet.' : 'No matching memory.') }
      },
    },
    {
      name: 'remember',
      description: 'save a note that future sessions will see',
      input: { hint: 'what to remember' },
      handler: ({ agent, rawInput }) => {
        const origin = { session: agent.session.id, project: agent.session.header.cwd ?? '', ts: now() }
        const entry = noteFrom({ text: rawInput }, origin, limits)
        if (entry === undefined) return { kind: 'error', text: 'usage: /remember <text>' }
        return { kind: 'success', text: `remembered as #${String(store.add(entry))}` }
      },
    },
    {
      name: 'forget',
      description: 'delete one memory entry by its #id',
      input: { hint: 'the entry id' },
      handler: ({ rawInput }) => {
        const id = Number(rawInput.trim().replace(/^#/u, ''))
        if (!Number.isInteger(id) || id < 1) return { kind: 'error', text: 'usage: /forget <id>' }
        return store.delete(id)
          ? { kind: 'success', text: `forgot #${String(id)}` }
          : { kind: 'error', text: `no memory #${String(id)}` }
      },
    },
  ]
}
