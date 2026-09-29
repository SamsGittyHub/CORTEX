/** The live activity view: streaming, status animation, tool trace, and turn footer. */

import { describe, expect, it } from 'vitest'
import { ActivityView } from '../src/activity.ts'
import type { Timers } from '../src/activity.ts'
import { formatDuration, formatTokens } from '../src/format.ts'
import type { Painter } from '../src/theme.ts'

const tag: Painter = (style, text) => `<${style}>${text}</${style}>`

function bench(animate = false) {
  let clock = 1000
  const callbacks = new Map<number, () => void>()
  let nextHandle = 1
  const out: string[] = []
  const timers: Timers = {
    now: () => clock,
    setInterval(callback) { const handle = nextHandle++; callbacks.set(handle, callback); return handle },
    clearInterval(handle) { callbacks.delete(handle as number) },
  }
  const view = new ActivityView({ write: text => out.push(text), paint: tag, timers, animate })
  return {
    view,
    out,
    text: () => out.join(''),
    advance(ms: number) { clock += ms },
    tick(ms: number) { clock += ms; for (const callback of callbacks.values()) callback() },
    running: () => callbacks.size,
  }
}

describe('formatting', () => {
  it('formats durations and token counts compactly', () => {
    expect(formatDuration(-5)).toBe('0ms')
    expect(formatDuration(240)).toBe('240ms')
    expect(formatDuration(3200)).toBe('3.2s')
    expect(formatDuration(125_000)).toBe('2m05s')
    expect(formatTokens(999)).toBe('999')
    expect(formatTokens(1234)).toBe('1.2k')
  })
})

describe('ActivityView reply streaming', () => {
  it('renders Markdown as it streams and closes held text at the end of the attempt', () => {
    const b = bench()
    b.view.textDelta('')
    b.view.textDelta('Use `npm test`')
    b.view.textDelta(' now')
    b.view.attemptEnd()
    expect(b.text()).toBe('Use <accent>npm test</accent> now')
  })

  it('starts a tool line on a new line after streamed text', () => {
    const b = bench()
    b.view.textDelta('Looking.')
    b.view.toolCall('c1', 'read', '{"path":"a.ts"}')
    expect(b.text()).toBe('Looking.\n<sensory>┃</sensory> <sensory>◉</sensory> <bold>read</bold> <dim>path=a.ts</dim>\n')
  })

  it('marks a discarded attempt as retried', () => {
    const b = bench()
    b.view.textDelta('partial')
    b.view.attemptAbandoned()
    expect(b.text()).toBe('partial\n<dim>(retrying)</dim>\n')
  })

  it('shows how long the model reasoned, once, when text or a tool follows', () => {
    const b = bench()
    b.view.reasoningDelta()
    b.advance(2300)
    b.view.reasoningDelta()
    b.view.textDelta('Answer')
    expect(b.text()).toBe('<dim>✻ thought for 2.3s</dim>\nAnswer')

    const c = bench()
    c.view.reasoningDelta()
    c.advance(600)
    c.view.toolCall('c1', 'read', '{}')
    expect(c.text()).toContain('<dim>✻ thought for 600ms</dim>\n')

    const quick = bench()
    quick.view.reasoningDelta()
    quick.advance(400)
    quick.view.textDelta('Answer')
    expect(quick.text()).toBe('Answer')
  })
})

describe('ActivityView tool trace', () => {
  it('colors each call and result by lobe and shows how long the tool took', () => {
    const b = bench()
    b.view.toolCall('c1', 'bash', '{"command":"ls"}')
    b.advance(1500)
    b.view.toolResult('c1', 'a\nb', false)
    expect(b.text()).toBe(
      '<motor>┃</motor> <motor>▲</motor> <bold>bash</bold> <dim>command=ls</dim>\n'
      + '<motor>┃</motor>   <dim>⎿ a… · 1.5s</dim>\n',
    )
  })

  it('omits the duration of a quick tool and marks a failure', () => {
    const b = bench()
    b.view.toolCall('c1', 'mcp__claude_mem__search', '{"query":"login"}')
    b.advance(20)
    b.view.toolResult('c1', 'no index', true)
    expect(b.text()).toContain('<memory>┃</memory>   <red>⎿ error: no index</red>\n')
  })

  it('places a result whose call was not seen in the sensory lobe', () => {
    const b = bench()
    b.view.toolResult('unknown', 'late', false)
    expect(b.text()).toBe('<sensory>┃</sensory>   <dim>⎿ late</dim>\n')
  })
})

describe('ActivityView plan mode', () => {
  it('reports each change once and exposes the mode', () => {
    const b = bench()
    expect(b.view.planMode).toBe(false)
    b.view.textDelta('x')
    b.view.planModeChanged(true)
    b.view.planModeChanged(true)
    expect(b.view.planMode).toBe(true)
    expect(b.text()).toBe('x\n<planning>▤</planning> <bold>plan mode on</bold>\n')
    b.view.planModeChanged(false)
    expect(b.view.planMode).toBe(false)
    expect(b.text()).toContain('plan mode off')
  })
})

describe('ActivityView turn footer', () => {
  it('sums up steps, tools, tokens and time, and keeps session totals', () => {
    const b = bench()
    b.view.turnStart()
    b.view.step()
    b.view.usage(1200, 300)
    b.view.toolCall('c1', 'read', '{}')
    b.view.toolCall('c2', 'edit', '{}')
    b.view.step()
    b.view.usage(100, 40)
    b.advance(3200)
    b.view.turnEnd({ kind: 'completed' })
    expect(b.text().split('\n').at(-2)).toBe('<dim>└─ 3.2s · 2 steps · 1.3k in · 340 out</dim>  <sensory>◉</sensory>1 <motor>▲</motor>1')
    const totals = b.view.totals()
    expect(totals).toMatchObject({ turns: 1, steps: 2, inputTokens: 1300, outputTokens: 340, busyMs: 3200 })
    expect(totals.tools).toMatchObject({ sensory: 1, motor: 1 })
  })

  it('uses the singular for one step and omits tokens and lobes that are absent', () => {
    const b = bench()
    b.view.turnStart()
    b.view.step()
    b.view.turnEnd({ kind: 'completed' })
    expect(b.text()).toBe('\n<dim>└─ 0ms · 1 step</dim>\n')
  })

  it('prints nothing for a turn that ran no step', () => {
    const b = bench()
    b.view.turnStart()
    b.view.turnEnd({ kind: 'completed' })
    expect(b.text()).toBe('')
  })

  it('prints a failure or an interruption ahead of the footer', () => {
    const failed = bench()
    failed.view.turnStart()
    failed.view.step()
    failed.view.turnEnd({ kind: 'error', code: 'E_TEST', message: 'model failed' })
    expect(failed.text()).toContain('<red>error: E_TEST: model failed</red>\n\n<dim>└─')
    const stopped = bench()
    stopped.view.turnEnd({ kind: 'aborted' })
    expect(stopped.text()).toBe('<yellow>(interrupted)</yellow>\n')
  })
})

describe('ActivityView status animation', () => {
  it('stays silent when animation is off', () => {
    const b = bench(false)
    b.view.turnStart()
    expect(b.out).toEqual([])
    expect(b.running()).toBe(0)
  })

  it('draws a spinner with a rotating verb and elapsed time, and erases it before output', () => {
    const b = bench(true)
    b.view.turnStart()
    expect(b.running()).toBe(1)
    expect(b.out.at(-1)).toBe('\r\u001b[2K<accent>⠋</accent> <dim>synapsing… 0ms</dim>')
    b.tick(90)
    expect(b.out.at(-1)).toBe('\r\u001b[2K<accent>⠙</accent> <dim>synapsing… 90ms</dim>')
    b.tick(2400)
    expect(b.out.at(-1)).toContain('firing… 2.5s')
    b.view.textDelta('hi')
    expect(b.out.slice(-2)).toEqual(['\r\u001b[2K', 'hi'])
    expect(b.running()).toBe(0)
  })

  it('labels the spinner with the running tool and the reasoning phase, reusing one timer', () => {
    const b = bench(true)
    b.view.turnStart()
    b.view.reasoningDelta()
    expect(b.out.at(-1)).toContain('reasoning…')
    expect(b.running()).toBe(1)
    b.view.toolCall('c1', 'grep', '{}')
    expect(b.out.at(-1)).toContain('grep…')
    b.view.toolResult('c1', 'ok', false)
    expect(b.out.at(-1)).toContain('synapsing…')
    b.view.turnEnd({ kind: 'completed' })
    expect(b.running()).toBe(0)
  })

  it('moves to a new line before drawing over unfinished text and stops cleanly twice', () => {
    const b = bench(true)
    b.view.textDelta('unfinished')
    b.view.turnStart()
    expect(b.out).toContain('\n')
    b.view.dispose()
    b.view.dispose()
    expect(b.running()).toBe(0)
  })

  it('relabels a running spinner instead of starting a second one', () => {
    const b = bench(true)
    b.view.reasoningDelta()
    b.view.reasoningDelta()
    expect(b.running()).toBe(1)
  })
})
