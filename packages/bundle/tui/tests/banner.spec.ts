/** The banner and the /session, /stats and legend cards. */

import { describe, expect, it } from 'vitest'
import { banner, lobeLegend, sessionCard, shortenHome, statsCard } from '../src/banner.ts'
import { emptyCounts } from '../src/lobes.ts'
import type { Painter } from '../src/theme.ts'

const tag: Painter = (style, text) => `<${style}>${text}</${style}>`
const plain: Painter = (_style, text) => text
const facts = { model: 'test-model', cwd: '/home/ada/project', sessionId: 'session-1', theme: 'cortex', tagline: '', home: '/home/ada' }

describe('shortenHome', () => {
  it('replaces a leading home directory with ~', () => {
    expect(shortenHome('/home/ada/project', '/home/ada')).toBe('~/project')
    expect(shortenHome('/home/ada', '/home/ada')).toBe('~')
  })

  it('leaves other paths, and every path without a home, unchanged', () => {
    expect(shortenHome('/home/adam/project', '/home/ada')).toBe('/home/adam/project')
    expect(shortenHome('/srv/app', '/home/ada')).toBe('/srv/app')
    expect(shortenHome('/srv/app', undefined)).toBe('/srv/app')
    expect(shortenHome('/srv/app', '')).toBe('/srv/app')
  })
})

describe('banner', () => {
  it('shows the wordmark text, the five-lobe spectrum, and the facts', () => {
    const text = banner(facts, plain)
    expect(text).toBe([
      '◈ CORTEX  ━━━━━━━━━━━━━━━',
      '  model test-model  dir ~/project',
      '  session session-1',
      '  /plan <task> plans first · Tab completes · /help lists commands · Ctrl-D exits',
      '',
      '',
    ].join('\n'))
    expect(banner(facts, tag)).toContain('<accent>◈</accent> <bold>CORTEX</bold>')
  })

  it('adds the palette tagline after the spectrum', () => {
    expect(banner({ ...facts, tagline: '// NEURAL LINK ESTABLISHED' }, plain).split('\n')[0]).toBe('◈ CORTEX  ━━━━━━━━━━━━━━━  // NEURAL LINK ESTABLISHED')
  })
})

describe('cards', () => {
  it('shows the session facts and the resume command', () => {
    expect(sessionCard(facts, plain)).toBe([
      '  session  session-1',
      '  model    test-model',
      '  dir      ~/project',
      '  theme    cortex',
      '  resume   cortex --profile tui --resume session-1',
      '',
    ].join('\n'))
  })

  it('sums up the session, with and without tool calls', () => {
    const tools = emptyCounts()
    expect(statsCard({ turns: 0, steps: 0, tools, inputTokens: 0, outputTokens: 0, busyMs: 0 }, plain)).toContain('no tool calls yet')
    tools.sensory = 4
    const text = statsCard({ turns: 2, steps: 5, tools, inputTokens: 1500, outputTokens: 200, busyMs: 4500 }, plain)
    expect(text).toContain('turns   2 · 5 steps · 4.5s working')
    expect(text).toContain('tokens  1.5k in · 200 out')
    expect(text).toContain('lobes   ◉4')
  })

  it('explains every lobe', () => {
    const text = lobeLegend(plain)
    expect(text.split('\n')).toHaveLength(6)
    expect(text).toContain('◉ sensory  reading and searching')
    expect(text).toContain('⬡ delegate handing work to other agents')
  })
})
