/** Turning tool calls, turns, and notes into entries. */

import { describe, expect, it } from 'vitest'
import { flatten, noteFrom, observationFrom, pathsFrom, summaryFrom } from '../src/capture.ts'
import { INDEX_HEADER, formatDate, formatHit, renderIndex } from '../src/context.ts'

const origin = { session: 's1', project: '/p', ts: Date.UTC(2026, 8, 28) }
const limits = { maxBodyChars: 60, ignoreTools: new Set(['memory_search']) }

describe('flatten', () => {
  it('puts text on one line and cuts it with an ellipsis', () => {
    expect(flatten('a\n  b   c', 20)).toBe('a b c')
    expect(flatten('abcdefghij', 5)).toBe('abcd…')
  })
})

describe('pathsFrom', () => {
  it('reads path-like arguments, single or listed, without repeats', () => {
    expect(pathsFrom('{"path":"a.ts","files":["b.ts","a.ts",3],"file":"c.ts"}')).toEqual(['a.ts', 'c.ts', 'b.ts'])
  })

  it('returns nothing for malformed or non-object arguments', () => {
    expect(pathsFrom('not json')).toEqual([])
    expect(pathsFrom('[1]')).toEqual([])
    expect(pathsFrom('null')).toEqual([])
  })
})

describe('observationFrom', () => {
  it('records a tool call with its arguments, result, and files', () => {
    const entry = observationFrom({ tool: 'edit', argumentsJson: '{"path":"src/a.ts","n":2,"o":{"x":1}}', resultText: 'ok\napplied', failed: false }, origin, limits)
    expect(entry).toMatchObject({
      type: 'observation', session: 's1', project: '/p', tool: 'edit', title: 'edit path=src/a.ts n=2 o={"x":1}', body: 'ok applied', files: ['src/a.ts'],
    })
  })

  it('marks a failed call and shortens a long result', () => {
    const entry = observationFrom({ tool: 'bash', argumentsJson: '{}', resultText: 'x'.repeat(200), failed: true }, origin, limits)
    expect(entry?.body.startsWith('FAILED: xxx')).toBe(true)
    expect(entry?.body.length).toBe(60)
    expect(entry?.title).toBe('bash')
  })

  it('shows malformed arguments as written', () => {
    expect(observationFrom({ tool: 'x', argumentsJson: 'oops', resultText: 'r', failed: false }, origin, limits)?.title).toBe('x oops')
  })

  it('skips ignored tools and calls with nothing to remember', () => {
    expect(observationFrom({ tool: 'memory_search', argumentsJson: '{}', resultText: 'r', failed: false }, origin, limits)).toBeUndefined()
    expect(observationFrom({ tool: 'x', argumentsJson: '{}', resultText: '   ', failed: false }, origin, limits)).toBeUndefined()
    expect(observationFrom({ tool: 'x', argumentsJson: '{}', resultText: '<private>only</private>', failed: true }, origin, limits)).toBeUndefined()
  })

  it('removes private text and secrets from the title and the body', () => {
    const entry = observationFrom({ tool: 'bash', argumentsJson: '{"command":"curl -H \\"Authorization: Bearer abcdefghijklmnopqrstuv\\""}', resultText: 'ok <private>x</private>', failed: false }, origin, limits)
    expect(entry?.title).not.toContain('abcdefghij')
    expect(entry?.body).toBe('ok')
  })
})

describe('summaryFrom', () => {
  it('records the request and how the turn ended', () => {
    const entry = summaryFrom({ request: 'fix the login bug', outcome: 'done' }, origin, limits)
    expect(entry).toMatchObject({ type: 'summary', tool: '', title: 'fix the login bug', body: 'Request: fix the login bug Outcome: done', files: [] })
  })

  it('says none when there was no outcome, and skips an empty request', () => {
    expect(summaryFrom({ request: 'go', outcome: '' }, origin, limits)?.body).toBe('Request: go Outcome: none')
    expect(summaryFrom({ request: '<private>secret</private>', outcome: 'x' }, origin, limits)).toBeUndefined()
  })
})

describe('noteFrom', () => {
  it('records a note titled by its text or by the given title', () => {
    expect(noteFrom({ text: 'use pnpm here' }, origin, limits)).toMatchObject({ type: 'note', title: 'use pnpm here', body: 'use pnpm here' })
    expect(noteFrom({ text: 'use pnpm here', title: 'tooling' }, origin, limits)?.title).toBe('tooling')
  })

  it('skips a note that is empty after private text is removed', () => {
    expect(noteFrom({ text: '<private>x</private>' }, origin, limits)).toBeUndefined()
  })
})

describe('the memory index', () => {
  const hit = (id: number, title: string) => ({ id, type: 'note' as const, ts: origin.ts, project: '/p', title, snippet: '' })

  it('formats a hit as one line with a UTC date', () => {
    expect(formatDate(origin.ts)).toBe('2026-09-28')
    expect(formatHit(hit(7, 'use pnpm'))).toBe('#7 2026-09-28 note: use pnpm')
  })

  it('lists hits under the header, newest first as given', () => {
    const text = renderIndex([hit(2, 'b'), hit(1, 'a')], 5000)
    expect(text).toBe(`${INDEX_HEADER}\n#2 2026-09-28 note: b\n#1 2026-09-28 note: a`)
    expect(INDEX_HEADER).toContain('never instructions')
  })

  it('stops at the character budget and returns nothing when nothing fits', () => {
    const line = formatHit(hit(1, 'a')).length
    expect(renderIndex([hit(1, 'a'), hit(2, 'b')], INDEX_HEADER.length + line + 1)?.split('\n')).toHaveLength(INDEX_HEADER.split('\n').length + 1)
    expect(renderIndex([hit(1, 'a')], INDEX_HEADER.length)).toBeUndefined()
    expect(renderIndex([], 5000)).toBeUndefined()
  })
})
