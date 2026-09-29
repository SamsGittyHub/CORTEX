/** Terminal answers to approval and question requests. */

import { describe, expect, it } from 'vitest'
import { askApproval, askQuestions } from '../src/interaction.ts'
import { createPainter } from '../src/render.ts'

const plain = createPainter(false)

function terminal(replies: (string | undefined)[]) {
  const out: string[] = []
  const prompts: string[] = []
  const queue = [...replies]
  return {
    out,
    prompts,
    io: {
      async readLine(prompt: string) { prompts.push(prompt); return queue.shift() },
      out(text: string) { out.push(text) },
    },
  }
}

describe('askApproval', () => {
  it('allows once only for an explicit yes', async () => {
    const t = terminal(['y'])
    await expect(askApproval(t.io, plain, { toolName: 'bash', reason: 'runs rm' })).resolves.toBe('allowed-once')
    expect(t.out.join('')).toContain('approval needed')
    expect(t.out.join('')).toContain('│ bash')
    expect(t.out.join('')).toContain('│ runs rm')
    expect(t.prompts).toEqual(['╰─ allow once? [y/N] '])
  })

  it('rejects any other reply', async () => {
    await expect(askApproval(terminal(['maybe']).io, plain, { toolName: 'bash' })).resolves.toBe('rejected')
    await expect(askApproval(terminal(['']).io, plain, { toolName: 'bash', reason: '' })).resolves.toBe('rejected')
  })

  it('fails closed when input has ended', async () => {
    await expect(askApproval(terminal([undefined]).io, plain, { toolName: 'bash' })).resolves.toBe('unavailable')
  })

  it('reports a request withdrawn before or during the prompt as cancelled', async () => {
    const before = new AbortController()
    before.abort()
    const t = terminal(['y'])
    await expect(askApproval(t.io, plain, { toolName: 'bash', signal: before.signal })).resolves.toBe('cancelled')
    expect(t.prompts).toEqual([])

    const during = new AbortController()
    const io = { out() {}, async readLine() { during.abort(); return 'y' } }
    await expect(askApproval(io, plain, { toolName: 'bash', signal: during.signal })).resolves.toBe('cancelled')
  })
})

describe('askQuestions', () => {
  it('frames a plan submitted for review and renders its Markdown', async () => {
    const t = terminal(['1'])
    await askQuestions(t.io, plain, [{
      id: 'plan-review',
      question: 'Approve this plan?',
      detail: '# Steps\n- add flag\n- run `tests`',
      intent: { kind: 'plan-review', approve: 'Approve' },
      options: [{ label: 'Approve' }, { label: 'Keep planning' }],
    }])
    const text = t.out.join('')
    expect(text).toContain('╭─ ▤ plan for review\n│ Steps\n│ • add flag\n│ • run tests\n╰─\n')
  })

  it('numbers the options and maps a number to its label', async () => {
    const t = terminal(['2'])
    const answer = await askQuestions(t.io, plain, [{
      id: 'plan-review',
      question: 'Approve this plan?',
      header: 'Plan',
      detail: '# Steps',
      options: [{ label: 'Approve' }, { label: 'Keep planning', description: 'send feedback' }],
    }])
    expect(answer).toEqual({ answers: [{ id: 'plan-review', selected: ['Keep planning'] }] })
    const text = t.out.join('')
    expect(text).toContain('Approve this plan?')
    expect(text).toContain('1. Approve')
    expect(text).toContain('2. Keep planning — send feedback')
    expect(text).toContain('# Steps')
    expect(t.prompts).toEqual(['  number or your own answer: '])
  })

  it('accepts custom text and multiple selections', async () => {
    const t = terminal(['tighten scope', '1,2'])
    const answer = await askQuestions(t.io, plain, [
      { id: 'a', question: 'A?', options: [{ label: 'x' }] },
      { id: 'b', question: 'B?', multiSelect: true, options: [{ label: 'p' }, { label: 'q' }] },
    ])
    expect(answer.answers).toEqual([
      { id: 'a', selected: [], custom: 'tighten scope' },
      { id: 'b', selected: ['p', 'q'] },
    ])
    expect(t.prompts[1]).toBe('  numbers (e.g. 1,3) or your own answer: ')
  })

  it('asks an option-less question for free text', async () => {
    const t = terminal(['because'])
    const answer = await askQuestions(t.io, plain, [{ id: 'why', question: 'Why?' }])
    expect(answer.answers).toEqual([{ id: 'why', selected: [], custom: 'because' }])
    expect(t.prompts).toEqual(['  answer: '])
  })

  it('records no selection for a question left unanswered at end of input', async () => {
    const answer = await askQuestions(terminal([undefined]).io, plain, [{ id: 'q', question: 'Q?' }])
    expect(answer.answers).toEqual([{ id: 'q', selected: [] }])
  })
})
