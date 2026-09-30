/** The memory database: storage, full-text search, listing, context, and schema safety. */

import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryStore, ftsExpression } from '../src/store.ts'
import type { NewEntry } from '../src/types.ts'

const stores: MemoryStore[] = []
const dirs: string[] = []

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function open(path = ':memory:'): MemoryStore {
  const store = MemoryStore.open(path)
  stores.push(store)
  return store
}

let clock = 1_000
function entry(over: Partial<NewEntry> = {}): NewEntry {
  return {
    type: 'observation', session: 's1', project: '/p', ts: clock++, tool: 'read', title: 'read a.ts', body: 'plain body', files: [], ...over,
  }
}

describe('ftsExpression', () => {
  it('quotes each word as a prefix term and caps the word count', () => {
    expect(ftsExpression('fix login bug', 'AND')).toBe('"fix"* AND "login"* AND "bug"*')
    expect(ftsExpression('a b', 'OR')).toBe('"a"* OR "b"*')
    expect(ftsExpression(Array.from({ length: 20 }, (_, i) => `w${String(i)}`).join(' '), 'AND')?.split(' AND ')).toHaveLength(12)
  })

  it('defuses FTS syntax and returns nothing for text without words', () => {
    expect(ftsExpression('"quoted" OR NEAR(x)', 'AND')).toBe('"quoted"* AND "OR"* AND "NEAR"* AND "x"*')
    expect(ftsExpression('!!! ???', 'AND')).toBeUndefined()
  })
})

describe('MemoryStore', () => {
  it('stores entries and returns them in full, in the order asked, skipping unknown ids', () => {
    const store = open()
    const a = store.add(entry({ title: 'first', files: ['src/a.ts'] }))
    const b = store.add(entry({ title: 'second' }))
    const got = store.get([b, 999, a])
    expect(got.map(item => item.title)).toEqual(['second', 'first'])
    expect(got[1]?.files).toEqual(['src/a.ts'])
    expect(got[0]?.id).toBe(b)
  })

  it('searches titles and bodies best match first, by prefix and with stemming', () => {
    const store = open()
    store.add(entry({ title: 'edit auth', body: 'rewrote the login handler to refresh tokens' }))
    store.add(entry({ title: 'read docs', body: 'nothing relevant here' }))
    const hits = store.search('logins refresh', { limit: 5 })
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ title: 'edit auth', type: 'observation', project: '/p' })
    expect(hits[0]?.snippet).toContain('login handler')
    expect(store.search('handl', { limit: 5 })).toHaveLength(1)
  })

  it('weighs a title match above a body match', () => {
    const store = open()
    store.add(entry({ title: 'unrelated', body: 'parser parser parser' }))
    const titled = store.add(entry({ title: 'parser', body: 'x' }))
    expect(store.search('parser', { limit: 5 })[0]?.id).toBe(titled)
  })

  it('falls back to matching any word when no entry has all of them', () => {
    const store = open()
    store.add(entry({ body: 'alpha only' }))
    store.add(entry({ body: 'beta only' }))
    expect(store.search('alpha beta', { limit: 5 })).toHaveLength(2)
    expect(store.search('alpha zzzz', { limit: 5 })).toHaveLength(1)
    expect(store.search('zzzz qqqq', { limit: 5 })).toEqual([])
  })

  it('returns nothing for a query without words and honors the result cap', () => {
    const store = open()
    for (let index = 0; index < 4; index++) store.add(entry({ body: 'shared word' }))
    expect(store.search('???', { limit: 5 })).toEqual([])
    expect(store.search('shared', { limit: 2 })).toHaveLength(2)
  })

  it('scopes a search to one project when asked', () => {
    const store = open()
    store.add(entry({ project: '/a', body: 'needle' }))
    store.add(entry({ project: '/b', body: 'needle' }))
    expect(store.search('needle', { limit: 5 })).toHaveLength(2)
    expect(store.search('needle', { project: '/b', limit: 5 }).map(hit => hit.project)).toEqual(['/b'])
  })

  it('shortens long bodies to a snippet', () => {
    const store = open()
    store.add(entry({ body: `${'word '.repeat(100)}end` }))
    const hit = store.recent({ types: ['observation'], limit: 1 })[0]
    expect(hit?.snippet.length).toBeLessThanOrEqual(200)
    expect(hit?.snippet.endsWith('…')).toBe(true)
  })

  it('lists the newest entries of the chosen types and project', () => {
    const store = open()
    store.add(entry({ project: '/a', title: 'old' }))
    store.add(entry({ project: '/a', type: 'note', title: 'note' }))
    store.add(entry({ project: '/b', title: 'other' }))
    const newest = store.add(entry({ project: '/a', type: 'summary', title: 'new' }))
    expect(store.recent({ project: '/a', types: ['note', 'summary', 'observation'], limit: 10 }).map(hit => hit.title)).toEqual(['new', 'note', 'old'])
    expect(store.recent({ project: '/a', types: ['summary'], limit: 10 })[0]?.id).toBe(newest)
    expect(store.recent({ types: ['observation'], limit: 10 }).map(hit => hit.title)).toEqual(['other', 'old'])
  })

  it('shows the entries around one entry within its session, in time order', () => {
    const store = open()
    const ids = [1, 2, 3, 4, 5].map(number => store.add(entry({ title: `e${String(number)}` })))
    store.add(entry({ session: 'other', title: 'elsewhere' }))
    expect(store.around(ids[2] as number, 1, 1).map(hit => hit.title)).toEqual(['e2', 'e3', 'e4'])
    expect(store.around(ids[0] as number, 2, 2).map(hit => hit.title)).toEqual(['e1', 'e2', 'e3'])
    expect(store.around(9999, 1, 1)).toEqual([])
  })

  it('orders entries created in the same millisecond by id', () => {
    const store = open()
    const first = store.add(entry({ ts: 5, title: 'a' }))
    store.add(entry({ ts: 5, title: 'b' }))
    expect(store.around(first, 0, 1).map(hit => hit.title)).toEqual(['a', 'b'])
  })

  it('deletes an entry from the table and the search index', () => {
    const store = open()
    const id = store.add(entry({ body: 'ephemeral' }))
    expect(store.delete(id)).toBe(true)
    expect(store.delete(id)).toBe(false)
    expect(store.search('ephemeral', { limit: 5 })).toEqual([])
    expect(store.get([id])).toEqual([])
  })

  it('counts entries overall and per project', () => {
    const store = open()
    store.add(entry({ project: '/a' }))
    store.add(entry({ project: '/b' }))
    store.add(entry({ project: '/b' }))
    expect(store.count()).toBe(3)
    expect(store.count('/b')).toBe(2)
  })
})

describe('MemoryStore persistence', () => {
  function tempFile(): string {
    const dir = mkdtempSync(join(tmpdir(), 'cortex-memory-'))
    dirs.push(dir)
    return join(dir, 'nested', 'memory.db')
  }

  it('creates the directory and an owner-only file, and keeps entries across opens', () => {
    const path = tempFile()
    const first = MemoryStore.open(path)
    first.add(entry({ body: 'durable' }))
    first.close()
    expect(statSync(path).mode & 0o777).toBe(0o600)
    const second = open(path)
    expect(second.search('durable', { limit: 5 })).toHaveLength(1)
  })

  it('refuses a database with another schema version and a file that is not a database', () => {
    const path = tempFile()
    MemoryStore.open(path).close()
    const raw = new DatabaseSync(path)
    raw.exec('PRAGMA user_version = 99')
    raw.close()
    expect(() => MemoryStore.open(path)).toThrow('schema version 99')

    const junk = tempFile()
    MemoryStore.open(junk).close()
    writeFileSync(junk, 'not a database at all, just text that is long enough to be read as a header')
    expect(() => MemoryStore.open(junk)).toThrow()
  })
})
