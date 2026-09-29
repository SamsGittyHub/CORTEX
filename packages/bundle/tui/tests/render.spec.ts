/** Terminal formatting, line classification, and reply parsing. */

import { describe, expect, it } from 'vitest'
import {
  classifyLine, colorEnabled, createPainter, oneLine, parseChoice, parseYes, summarizeArguments,
} from '../src/render.ts'

describe('createPainter', () => {
  it('wraps text in ANSI codes when color is on', () => {
    expect(createPainter(true)('red', 'bad')).toBe('\u001b[31mbad\u001b[39m')
    expect(createPainter(true)('bold', 'x')).toBe('\u001b[1mx\u001b[22m')
  })

  it('returns text unchanged when color is off', () => {
    expect(createPainter(false)('red', 'bad')).toBe('bad')
  })
})

describe('colorEnabled', () => {
  const base = { isTty: true, noColorFlag: false, env: {} }

  it('colors an interactive terminal', () => {
    expect(colorEnabled(base)).toBe(true)
  })

  it('stays plain when output is not a terminal', () => {
    expect(colorEnabled({ ...base, isTty: false })).toBe(false)
  })

  it('honors --no-color and a non-empty NO_COLOR, but not an empty one', () => {
    expect(colorEnabled({ ...base, noColorFlag: true })).toBe(false)
    expect(colorEnabled({ ...base, env: { NO_COLOR: '1' } })).toBe(false)
    expect(colorEnabled({ ...base, env: { NO_COLOR: '' } })).toBe(true)
  })
})

describe('oneLine', () => {
  it('returns a short single line unchanged', () => {
    expect(oneLine('hello')).toBe('hello')
  })

  it('keeps the first non-empty line and marks dropped lines', () => {
    expect(oneLine('\n first \nsecond')).toBe('first…')
  })

  it('cuts a long line to the budget', () => {
    const cut = oneLine('x'.repeat(200), 10)
    expect(cut).toBe(`${'x'.repeat(9)}…`)
    expect(cut).toHaveLength(10)
  })

  it('cuts within the budget when lines were also dropped', () => {
    expect(oneLine(`${'y'.repeat(20)}\nmore`, 8)).toHaveLength(8)
  })

  it('returns an empty string for blank text', () => {
    expect(oneLine('  \n ')).toBe('')
  })
})

describe('summarizeArguments', () => {
  it('lists object entries as key=value', () => {
    expect(summarizeArguments('{"path":"a.ts","limit":5}')).toBe('path=a.ts limit=5')
  })

  it('shows nested values as JSON', () => {
    expect(summarizeArguments('{"opts":{"a":1}}')).toBe('opts={"a":1}')
  })

  it('shows malformed or non-object arguments verbatim', () => {
    expect(summarizeArguments('not json')).toBe('not json')
    expect(summarizeArguments('[1,2]')).toBe('[1,2]')
    expect(summarizeArguments('null')).toBe('null')
  })
})

describe('classifyLine', () => {
  it('classifies blank input as empty', () => {
    expect(classifyLine('   ')).toEqual({ kind: 'empty' })
  })

  it('recognizes the terminal-owned commands', () => {
    expect(classifyLine('/exit')).toEqual({ kind: 'exit' })
    expect(classifyLine('/QUIT')).toEqual({ kind: 'exit' })
    expect(classifyLine('/help')).toEqual({ kind: 'help' })
    expect(classifyLine('/?')).toEqual({ kind: 'help' })
  })

  it('routes other slash lines to the agent command registry', () => {
    expect(classifyLine('/plan build a parser')).toEqual({ kind: 'command', line: '/plan build a parser' })
    expect(classifyLine('/plan off')).toEqual({ kind: 'command', line: '/plan off' })
  })

  it('sends plain text as a message', () => {
    expect(classifyLine(' fix the bug ')).toEqual({ kind: 'message', text: 'fix the bug' })
  })

  it('sends a // line as a message beginning with one slash', () => {
    expect(classifyLine('//etc/hosts is odd')).toEqual({ kind: 'message', text: '/etc/hosts is odd' })
  })
})

describe('parseYes', () => {
  it('accepts only an explicit yes', () => {
    expect(parseYes('y')).toBe(true)
    expect(parseYes(' YES ')).toBe(true)
    expect(parseYes('')).toBe(false)
    expect(parseYes('yep')).toBe(false)
    expect(parseYes('n')).toBe(false)
  })
})

describe('parseChoice', () => {
  const options = [{ label: 'Approve' }, { label: 'Keep planning' }, { label: 'Other' }]

  it('selects one label for a number', () => {
    expect(parseChoice('2', options, false)).toEqual({ selected: ['Keep planning'] })
  })

  it('keeps only the first number of a single-select reply', () => {
    expect(parseChoice('1,3', options, false)).toEqual({ selected: ['Approve'] })
  })

  it('selects several distinct labels for a multi-select reply', () => {
    expect(parseChoice('1, 3 3', options, true)).toEqual({ selected: ['Approve', 'Other'] })
  })

  it('treats out-of-range numbers and words as a custom answer', () => {
    expect(parseChoice('9', options, false)).toEqual({ selected: [], custom: '9' })
    expect(parseChoice('add tests first', options, false)).toEqual({ selected: [], custom: 'add tests first' })
  })

  it('returns no selection for an empty reply', () => {
    expect(parseChoice('  ', options, false)).toEqual({ selected: [] })
  })
})
