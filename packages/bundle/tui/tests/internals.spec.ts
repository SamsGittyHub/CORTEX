/** The default process bindings the runner tests replace. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { internals } from '../src/runner-internals.ts'

afterEach(() => { vi.restoreAllMocks() })

describe('runner internals', () => {
  it('reads the real environment and terminal facts', () => {
    expect(internals.env()).toBe(process.env)
    expect(internals.stdoutIsTty()).toBe(process.stdout.isTTY)
    expect(typeof internals.timers.now()).toBe('number')
  })

  it('writes diagnostics to the process stderr', () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    internals.writeErr('cortex: boom\n')
    expect(write).toHaveBeenCalledWith('cortex: boom\n')
  })

  it('drives real timers', async () => {
    let ticks = 0
    const handle = internals.timers.setInterval(() => { ticks += 1 }, 1)
    await new Promise(resolve => setTimeout(resolve, 20))
    internals.timers.clearInterval(handle)
    expect(ticks).toBeGreaterThan(0)
  })

  it('opens a terminal over the process streams that closes cleanly', () => {
    const term = internals.openTerminal(() => [])
    expect(typeof term.readLine).toBe('function')
    term.close()
  })
})
