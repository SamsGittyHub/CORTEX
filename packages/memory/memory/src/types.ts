/**
 * Memory record vocabulary shared by the store, capture, and tools. Types only.
 * @module @cortex-ai/cortex-memory/types
 */

/** What a memory entry records. */
export type EntryType = 'observation' | 'summary' | 'note'

/** The entry types, in the order the tools accept them. */
export const ENTRY_TYPES: readonly EntryType[] = ['observation', 'summary', 'note']

/** An entry to store. */
export interface NewEntry {
  /** What the entry records. */
  readonly type: EntryType
  /** The Session that produced it. */
  readonly session: string
  /** The working directory the Session ran in; empty when unknown. */
  readonly project: string
  /** Creation time in epoch milliseconds. */
  readonly ts: number
  /** The tool behind an observation; empty for other types. */
  readonly tool: string
  /** One line naming the entry. */
  readonly title: string
  /** The searchable text. */
  readonly body: string
  /** Workspace paths the entry touched. */
  readonly files: readonly string[]
}

/** A stored entry. */
export interface MemoryEntry extends NewEntry {
  /** Stable id, unique per database. */
  readonly id: number
}

/** One search result: enough to choose what to fetch in full. */
export interface SearchHit {
  readonly id: number
  readonly type: EntryType
  readonly ts: number
  readonly project: string
  readonly title: string
  /** A short excerpt around the match, or the start of the body for a listing. */
  readonly snippet: string
}
