/** Tool grouping and lobe presentation. */

import { describe, expect, it } from 'vitest'
import { classifyTool, emptyCounts, lobeSummary, spectrum } from '../src/lobes.ts'
import type { Painter } from '../src/theme.ts'

const tag: Painter = (style, text) => `<${style}>${text}</${style}>`

describe('classifyTool', () => {
  it.each([
    ['read', 'sensory'], ['grep', 'sensory'], ['glob', 'sensory'], ['web_fetch', 'sensory'], ['unheard_of_tool', 'sensory'],
    ['bash', 'motor'], ['write', 'motor'], ['edit', 'motor'], ['apply_patch', 'motor'], ['run_code', 'motor'],
    ['mcp__claude_mem__search', 'memory'], ['mcp__memorix__store', 'memory'], ['mcp__engram__mem_save', 'memory'],
    ['exit_plan_mode', 'planning'], ['todo_write', 'planning'],
    ['tool_subagent', 'delegate'], ['team_message', 'delegate'], ['task', 'delegate'],
  ] as const)('places %s in the %s lobe', (name, lobe) => {
    expect(classifyTool(name)).toBe(lobe)
  })
})

describe('lobe presentation', () => {
  it('summarizes only the lobes that were used, in display order', () => {
    const counts = emptyCounts()
    counts.motor = 2
    counts.sensory = 3
    expect(lobeSummary(counts, tag)).toBe('<sensory>◉</sensory>3 <motor>▲</motor>2')
    expect(lobeSummary(emptyCounts(), tag)).toBe('')
  })

  it('draws a spectrum of all five lobe colors', () => {
    expect(spectrum(tag, 2)).toBe('<sensory>━━</sensory><motor>━━</motor><memory>━━</memory><planning>━━</planning><delegate>━━</delegate>')
    expect(spectrum(tag)).toContain('━━━')
  })
})
