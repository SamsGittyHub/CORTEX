/**
 * The memory database: one SQLite file holding entries and a full-text index
 * over their titles and bodies. The schema is stamped with `user_version`;
 * a database with any other non-zero version is refused rather than migrated.
 * @module @cortex-ai/cortex-memory/store
 */

import { chmodSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { EntryType, MemoryEntry, NewEntry, SearchHit } from './types.ts'

/** The schema version this build writes and reads. */
export const MEMORY_SCHEMA_VERSION = 1

/** Longest snippet returned with a hit, in characters. */
const SNIPPET_CHARS = 200

interface Row {
  id: number
  type: EntryType
  session: string
  project: string
  ts: number
  tool: string
  title: string
  body: string
  files: string
}

function toEntry(row: Row): MemoryEntry {
  return { ...row, files: JSON.parse(row.files) as string[] }
}

type HitRow = Pick<Row, 'id' | 'type' | 'ts' | 'project' | 'title' | 'body'>

function excerpt(text: string): string {
  const flat = text.replace(/\s+/gu, ' ').trim()
  return flat.length <= SNIPPET_CHARS ? flat : `${flat.slice(0, SNIPPET_CHARS - 1)}…`
}

function toHit(row: HitRow): SearchHit {
  return { id: row.id, type: row.type, ts: row.ts, project: row.project, title: row.title, snippet: excerpt(row.body) }
}

/**
 * Turn free text into a safe FTS5 expression.
 * @param text - what the user or model typed.
 * @param joiner - `AND` for a precise match, `OR` for a broad one.
 * @returns quoted prefix terms joined by `joiner`, or `undefined` when the text has no words.
 */
export function ftsExpression(text: string, joiner: 'AND' | 'OR'): string | undefined {
  const words = text.match(/[\p{L}\p{N}_]+/gu)
  if (words === null) return undefined
  return words.slice(0, 12).map(word => `"${word}"*`).join(` ${joiner} `)
}

/** The memory database. */
export class MemoryStore {
  private constructor(private readonly db: DatabaseSync) {}

  /**
   * Open or create the database.
   * @param path - the database file, or `:memory:`; missing directories are created owner-only.
   * @returns the open store.
   * @throws when the file holds another schema version.
   */
  static open(path: string): MemoryStore {
    const actual = path === ':memory:' ? path : resolve(path)
    if (actual !== ':memory:') {
      mkdirSync(dirname(actual), { recursive: true, mode: 0o700 })
    }
    const db = new DatabaseSync(actual)
    try {
      const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number }
      if (version !== 0 && version !== MEMORY_SCHEMA_VERSION) {
        throw new Error(`memory database at "${actual}" has schema version ${String(version)}, incompatible with this build (${String(MEMORY_SCHEMA_VERSION)})`)
      }
      db.exec('PRAGMA journal_mode = WAL')
      db.exec(`
        CREATE TABLE IF NOT EXISTS entries (
          id      INTEGER PRIMARY KEY,
          type    TEXT NOT NULL,
          session TEXT NOT NULL,
          project TEXT NOT NULL,
          ts      INTEGER NOT NULL,
          tool    TEXT NOT NULL,
          title   TEXT NOT NULL,
          body    TEXT NOT NULL,
          files   TEXT NOT NULL
        ) STRICT;
        CREATE INDEX IF NOT EXISTS entries_project_ts ON entries (project, ts);
        CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
          title, body, content='entries', content_rowid='id', tokenize='porter unicode61'
        );
        CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
          INSERT INTO entries_fts (rowid, title, body) VALUES (new.id, new.title, new.body);
        END;
        CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
          INSERT INTO entries_fts (entries_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
        END;
      `)
      if (version === 0) db.exec(`PRAGMA user_version = ${String(MEMORY_SCHEMA_VERSION)}`)
      if (actual !== ':memory:') chmodSync(actual, 0o600)
    } catch (error: unknown) {
      db.close()
      throw error
    }
    return new MemoryStore(db)
  }

  /**
   * Store one entry.
   * @param entry - the entry to store.
   * @returns its new id.
   */
  add(entry: NewEntry): number {
    const result = this.db.prepare(
      'INSERT INTO entries (type, session, project, ts, tool, title, body, files) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(entry.type, entry.session, entry.project, entry.ts, entry.tool, entry.title, entry.body, JSON.stringify(entry.files))
    return Number(result.lastInsertRowid)
  }

  /**
   * Fetch entries in full.
   * @param ids - entry ids.
   * @returns the entries that exist, in the order asked.
   */
  get(ids: readonly number[]): MemoryEntry[] {
    const statement = this.db.prepare('SELECT * FROM entries WHERE id = ?')
    return ids.flatMap((id) => {
      const row = statement.get(id) as Row | undefined
      return row === undefined ? [] : [toEntry(row)]
    })
  }

  /**
   * Search titles and bodies, best match first. Every word must match, by prefix; when nothing does, any word may.
   * @param query - words to look for.
   * @param options - the project to search (all projects when absent) and the result cap.
   * @returns matching entries as hits.
   */
  search(query: string, options: { project?: string | undefined; limit: number }): SearchHit[] {
    for (const joiner of ['AND', 'OR'] as const) {
      const expression = ftsExpression(query, joiner)
      if (expression === undefined) return []
      const scope = options.project === undefined ? '' : 'AND e.project = ?'
      const rows = this.db.prepare(`
        SELECT e.id, e.type, e.ts, e.project, e.title, e.body
        FROM entries_fts f JOIN entries e ON e.id = f.rowid
        WHERE entries_fts MATCH ? ${scope}
        ORDER BY bm25(entries_fts, 4.0, 1.0)
        LIMIT ?
      `).all(...options.project === undefined ? [expression, options.limit] : [expression, options.project, options.limit]) as
        HitRow[]
      if (rows.length > 0) return rows.map(toHit)
    }
    return []
  }

  /**
   * List the newest entries.
   * @param options - the project (all when absent), the entry types to include, and the cap.
   * @returns hits, newest first.
   */
  recent(options: { project?: string | undefined; types: readonly EntryType[]; limit: number }): SearchHit[] {
    const marks = options.types.map(() => '?').join(', ')
    const scope = options.project === undefined ? '' : 'AND project = ?'
    const rows = this.db.prepare(
      `SELECT id, type, ts, project, title, body FROM entries WHERE type IN (${marks}) ${scope} ORDER BY ts DESC, id DESC LIMIT ?`,
    ).all(...options.project === undefined ? [...options.types, options.limit] : [...options.types, options.project, options.limit]) as
      HitRow[]
    return rows.map(toHit)
  }

  /**
   * List the entries that surround one entry in its Session.
   * @param id - the anchor entry.
   * @param before - entries to include before it.
   * @param after - entries to include after it.
   * @returns hits in time order including the anchor, or an empty list when the anchor does not exist.
   */
  around(id: number, before: number, after: number): SearchHit[] {
    const anchor = this.db.prepare('SELECT session, ts, id FROM entries WHERE id = ?').get(id) as { session: string; ts: number; id: number } | undefined
    if (anchor === undefined) return []
    const columns = 'id, type, ts, project, title, body'
    const earlier = this.db.prepare(
      `SELECT ${columns} FROM entries WHERE session = ? AND (ts < ? OR (ts = ? AND id < ?)) ORDER BY ts DESC, id DESC LIMIT ?`,
    ).all(anchor.session, anchor.ts, anchor.ts, anchor.id, before) as HitRow[]
    const same = this.db.prepare(`SELECT ${columns} FROM entries WHERE id = ?`).all(id) as HitRow[]
    const later = this.db.prepare(
      `SELECT ${columns} FROM entries WHERE session = ? AND (ts > ? OR (ts = ? AND id > ?)) ORDER BY ts ASC, id ASC LIMIT ?`,
    ).all(anchor.session, anchor.ts, anchor.ts, anchor.id, after) as HitRow[]
    return [...earlier.reverse(), ...same, ...later].map(toHit)
  }

  /**
   * Delete one entry.
   * @param id - the entry id.
   * @returns whether an entry was deleted.
   */
  delete(id: number): boolean {
    return Number(this.db.prepare('DELETE FROM entries WHERE id = ?').run(id).changes) > 0
  }

  /**
   * Count entries.
   * @param project - the project to count; all projects when absent.
   * @returns the number of entries.
   */
  count(project?: string): number {
    const row = (project === undefined
      ? this.db.prepare('SELECT COUNT(*) AS n FROM entries').get()
      : this.db.prepare('SELECT COUNT(*) AS n FROM entries WHERE project = ?').get(project)) as { n: number }
    return row.n
  }

  /** Close the database. */
  close(): void {
    this.db.close()
  }
}
