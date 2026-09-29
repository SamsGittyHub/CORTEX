/** The interactive loop against a scripted terminal and a recording agent. */

import { describe, expect, it } from 'vitest'
import { createPainter } from '../src/render.ts'
import { completeCommand, formatHelp, runRepl } from '../src/repl.ts'
import type { CommandOutcome, ReplAgent, TerminalIo } from '../src/repl.ts'

const plain = createPainter(false)
const opts = { prompt: () => '> ', local: (name: string, args: string) => `local:${name}:${args}\n` }

interface Bench {
  agent: ReplAgent
  io: TerminalIo
  calls: string[]
  output: string[]
  interrupt(): void
  closed(): boolean
}

function bench(lines: (string | undefined)[], commandResults: Record<string, CommandOutcome> = {}, onRead?: () => void): Bench {
  const calls: string[] = []
  const output: string[] = []
  let handler: (() => void) | undefined
  let closed = false
  const queue = [...lines]
  const io: TerminalIo = {
    async readLine() {
      onRead?.()
      if (closed) return undefined
      return queue.shift()
    },
    out(text) { output.push(text) },
    onInterrupt(next) { handler = next; return () => { handler = undefined } },
    close() { closed = true },
  }
  const agent: ReplAgent = {
    submit(text) { calls.push(`submit:${text}`) },
    async runCommand(line) { calls.push(`command:${line}`); return commandResults[line] },
    commands: () => [{ name: 'plan', description: 'plan first' }],
    idle: async () => { calls.push('idle') },
    cancel() { calls.push('cancel') },
    flush: async () => { calls.push('flush') },
  }
  return { agent, io, calls, output, interrupt: () => handler?.(), closed: () => closed }
}

describe('runRepl', () => {
  it('submits each message as a turn and makes the log durable after it', async () => {
    const b = bench(['hello', 'world', undefined])
    await runRepl(b.agent, b.io, plain, opts)
    expect(b.calls).toEqual(['submit:hello', 'idle', 'flush', 'submit:world', 'idle', 'flush'])
  })

  it('skips blank lines and stops at /exit without reading further', async () => {
    const b = bench(['', '  ', '/exit', 'never'])
    await runRepl(b.agent, b.io, plain, opts)
    expect(b.calls).toEqual([])
  })

  it('sends an initial line before the first read', async () => {
    const b = bench([undefined])
    await runRepl(b.agent, b.io, plain, { ...opts, initialLine: 'first task' })
    expect(b.calls).toEqual(['submit:first task', 'idle', 'flush'])
  })

  it('runs an initial slash line as a command', async () => {
    const b = bench([undefined], { '/plan add tests': { kind: 'success', text: 'plan mode on' } })
    await runRepl(b.agent, b.io, plain, { ...opts, initialLine: '/plan add tests' })
    expect(b.calls).toEqual(['command:/plan add tests', 'idle', 'flush'])
    expect(b.output.join('')).toContain('plan mode on')
  })

  it('leaves without reading when the initial line is /exit', async () => {
    const b = bench(['never'])
    await runRepl(b.agent, b.io, plain, { ...opts, initialLine: '/exit' })
    expect(b.calls).toEqual([])
  })

  it('ignores a blank initial line', async () => {
    const b = bench([undefined])
    await runRepl(b.agent, b.io, plain, { ...opts, initialLine: '   ' })
    expect(b.calls).toEqual([])
  })

  it('runs a registered command, prints its text, and waits for work it started', async () => {
    const b = bench(['/plan off', undefined], { '/plan off': { kind: 'success', text: 'plan mode off' } })
    await runRepl(b.agent, b.io, plain, opts)
    expect(b.calls).toEqual(['command:/plan off', 'idle', 'flush'])
    expect(b.output.join('')).toBe('plan mode off\n')
  })

  it('prints nothing for a successful command without text', async () => {
    const b = bench(['/plan', undefined], { '/plan': { kind: 'success' } })
    await runRepl(b.agent, b.io, plain, opts)
    expect(b.output).toEqual([])
  })

  it('prints a failed command in the error style', async () => {
    const b = bench(['/plan x', undefined], { '/plan x': { kind: 'error', text: 'no attachments' } })
    await runRepl(b.agent, b.io, createPainter(true), opts)
    expect(b.output.join('')).toBe('\u001b[31mno attachments\u001b[39m\n')
  })

  it('reports an unknown command without submitting a message', async () => {
    const b = bench(['/nope arg', undefined])
    await runRepl(b.agent, b.io, plain, opts)
    expect(b.calls).toEqual(['command:/nope arg', 'idle', 'flush'])
    expect(b.output.join('')).toBe('unknown command: /nope (try /help)\n')
  })

  it('lists local and agent commands for /help without touching the agent', async () => {
    const b = bench(['/help', undefined])
    await runRepl(b.agent, b.io, plain, opts)
    expect(b.calls).toEqual([])
    const text = b.output.join('')
    expect(text).toContain('/help')
    expect(text).toContain('/exit')
    expect(text).toContain('/stats')
    expect(text).toContain('/theme')
    expect(text).toContain('/plan')
    expect(text).toContain('plan first')
    expect(text).toContain('Lobes')
    expect(text).toContain('◉ sensory')
  })

  it('runs terminal-owned commands without touching the agent', async () => {
    const b = bench(['/stats', '/theme ember', '/clear', undefined])
    await runRepl(b.agent, b.io, plain, opts)
    expect(b.calls).toEqual([])
    expect(b.output.join('')).toBe('local:stats:\nlocal:theme:ember\nlocal:clear:\n')
  })

  it('reads the prompt anew for each line', async () => {
    let count = 0
    const b = bench(['a', undefined])
    const prompts: string[] = []
    const io = { ...b.io, readLine: async (prompt: string) => { prompts.push(prompt); return b.io.readLine(prompt) } }
    await runRepl(b.agent, io, plain, { ...opts, prompt: () => `p${String(count++)}> ` })
    expect(prompts).toEqual(['p0> ', 'p1> '])
  })

  it('cancels the active turn on Ctrl-C and keeps running', async () => {
    const b = bench(['work', undefined])
    const agent = { ...b.agent, idle: async () => { b.calls.push('idle'); b.interrupt() } }
    await runRepl(agent, b.io, plain, opts)
    expect(b.calls).toEqual(['submit:work', 'idle', 'cancel', 'flush'])
    expect(b.closed()).toBe(false)
  })

  it('asks for a second Ctrl-C at an idle prompt, then closes input', async () => {
    const b = bench([], {}, () => {
      b.interrupt()
      b.interrupt()
    })
    await runRepl(b.agent, b.io, plain, opts)
    expect(b.output.join('')).toContain('press Ctrl-C again')
    expect(b.closed()).toBe(true)
  })

  it('disarms the exit hint after the next line', async () => {
    let reads = 0
    const b = bench(['', ''], {}, () => {
      reads += 1
      if (reads === 1 || reads === 3) b.interrupt()
    })
    await runRepl(b.agent, b.io, plain, opts)
    expect(b.closed()).toBe(false)
    expect(b.output.filter(text => text.includes('press Ctrl-C again'))).toHaveLength(2)
  })

  it('unregisters the interrupt handler when the loop ends', async () => {
    const b = bench([undefined])
    await runRepl(b.agent, b.io, plain, opts)
    b.interrupt()
    expect(b.output).toEqual([])
  })
})

describe('formatHelp', () => {
  it('aligns names and mentions the literal-slash escape', () => {
    const text = formatHelp([{ name: 'plan', description: 'plan first' }], plain)
    expect(text).toContain('/help     show this list')
    expect(text).toContain('/plan     plan first')
    expect(text).toContain('//')
  })
})

describe('completeCommand', () => {
  const rows = [{ name: 'plan', description: 'plan first' }, { name: 'stats', description: 'agent stats' }]

  it('completes slash commands from terminal-owned and agent commands', () => {
    expect(completeCommand('/pl', rows)).toEqual(['/plan'])
    expect(completeCommand('/s', rows)).toEqual(['/session', '/stats'])
    expect(completeCommand('/', rows)).toContain('/exit')
    expect(completeCommand('/PL', rows)).toEqual(['/plan'])
  })

  it('offers nothing for a message, or once the command has arguments', () => {
    expect(completeCommand('hello', rows)).toEqual([])
    expect(completeCommand('/plan add', rows)).toEqual([])
    expect(completeCommand('/nope', rows)).toEqual([])
  })
})
