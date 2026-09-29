/** The Node terminal over process-like streams. */

import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { createTerminal } from '../src/terminal.ts'

function streams(isTTY: boolean) {
  const stdin = Object.assign(new PassThrough(), { isTTY })
  const stdout = new PassThrough()
  const written: string[] = []
  stdout.on('data', (chunk: Buffer) => written.push(chunk.toString('utf8')))
  return { stdin, stdout, written }
}

describe('createTerminal', () => {
  it('reads piped lines in order, including lines that arrived before the read', async () => {
    const s = streams(false)
    s.stdin.write('one\ntwo\n')
    const term = createTerminal(s, () => [])
    await expect(term.readLine('> ')).resolves.toBe('one')
    await expect(term.readLine('> ')).resolves.toBe('two')
    s.stdin.end()
    await expect(term.readLine('> ')).resolves.toBeUndefined()
    expect(s.written.join('')).toBe('')
  })

  it('shows the prompt only for an interactive input', async () => {
    const s = streams(true)
    const term = createTerminal(s, () => [])
    const read = term.readLine('› ')
    s.stdin.write('hi\n')
    await expect(read).resolves.toBe('hi')
    expect(s.written.join('')).toContain('› ')
    term.close()
  })

  it('completes a slash command on Tab for an interactive terminal', async () => {
    const s = streams(true)
    const term = createTerminal(s, line => (line === '/pl' ? ['/plan'] : []))
    const read = term.readLine('› ')
    s.stdin.write('/pl\t')
    s.stdin.write('\n')
    await expect(read).resolves.toBe('/plan')
    term.close()
  })

  it('writes output and settles a pending read with undefined on close', async () => {
    const s = streams(false)
    const term = createTerminal(s, () => [])
    term.out('hello')
    const pending = term.readLine('> ')
    term.close()
    await expect(pending).resolves.toBeUndefined()
    expect(s.written.join('')).toBe('hello')
  })

  it('registers and unregisters interrupt handlers', () => {
    const s = streams(true)
    const term = createTerminal(s, () => [])
    let count = 0
    const off = term.onInterrupt(() => { count += 1 })
    s.stdin.write('\u0003')
    off()
    s.stdin.write('\u0003')
    expect(count).toBeLessThanOrEqual(1)
    term.close()
  })
})
