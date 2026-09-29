/**
 * Terminal answers to the two human-input requests an agent can raise: a tool
 * approval and a structured question. Both read from the same terminal the
 * chat uses and fail closed when input has ended.
 * @module @cortex-ai/cortex-tui/interaction
 */

import type { ApprovalOutcome } from '@cortex-ai/cortex-user-approval/types'
import type { AskUserQuestionAnswer, AskUserQuestionItem } from '@cortex-ai/cortex-user-questions/types'
import { lobeGlyph } from './lobes.ts'
import { renderMarkdown } from './markdown.ts'
import { parseChoice, parseYes } from './render.ts'
import type { Painter } from './render.ts'

/** The terminal operations the answerers need. */
export interface AnswerIo {
  /** Print a prompt and read one line; `undefined` when input has ended. */
  readLine(prompt: string): Promise<string | undefined>
  /** Write text to stdout. */
  out(text: string): void
}

/** What an approval request tells the user. */
export interface ApprovalPrompt {
  readonly toolName: string
  readonly reason?: string | undefined
  readonly signal?: AbortSignal | undefined
}

/**
 * Ask whether one tool operation may run once.
 * @param io - the terminal.
 * @param paint - the color painter.
 * @param request - the tool and the asker's reason.
 * @returns `allowed-once` only for an explicit yes; `cancelled` when the request was withdrawn;
 *   `unavailable` when input ended, so callers fail closed.
 */
export async function askApproval(io: AnswerIo, paint: Painter, request: ApprovalPrompt): Promise<ApprovalOutcome> {
  const withdrawn = (): boolean => request.signal?.aborted === true
  if (withdrawn()) return 'cancelled'
  const rail = paint('motor', '│')
  const reason = request.reason === undefined || request.reason === '' ? '' : `${rail} ${paint('dim', request.reason)}\n`
  io.out(`\n${paint('motor', '╭─')} ${lobeGlyph('motor', paint)} ${paint('yellow', 'approval needed')}\n${rail} ${paint('bold', request.toolName)}\n${reason}`)
  const answer = await io.readLine(`${paint('motor', '╰─')} allow once? [y/N] `)
  if (answer === undefined) return 'unavailable'
  if (withdrawn()) return 'cancelled'
  return parseYes(answer) ? 'allowed-once' : 'rejected'
}

/**
 * Frame a plan for review: a header, the plan rendered as Markdown behind a rail, and a footer.
 * @param plan - the plan Markdown the agent submitted.
 * @param paint - the color painter.
 * @returns the framed text, ending in a newline.
 */
function planCard(plan: string, paint: Painter): string {
  const rail = paint('planning', '│')
  const body = renderMarkdown(plan.trimEnd(), paint).split('\n').map(line => `${rail} ${line}`).join('\n')
  return `${paint('planning', '╭─')} ${lobeGlyph('planning', paint)} ${paint('bold', 'plan for review')}\n${body}\n${paint('planning', '╰─')}\n`
}

/**
 * Ask each question in order.
 * @param io - the terminal.
 * @param paint - the color painter.
 * @param questions - the questions to put to the user.
 * @returns one answer per question; a question left unanswered at end of input has no selection.
 */
export async function askQuestions(
  io: AnswerIo,
  paint: Painter,
  questions: readonly AskUserQuestionItem[],
): Promise<AskUserQuestionAnswer> {
  const answers: AskUserQuestionAnswer['answers'] = []
  for (const item of questions) {
    const options = item.options ?? []
    io.out('\n')
    if (item.intent?.kind === 'plan-review' && item.detail !== undefined && item.detail !== '') {
      io.out(planCard(item.detail, paint))
    } else if (item.detail !== undefined && item.detail !== '') {
      io.out(`${item.detail}\n`)
    }
    io.out(`${item.header === undefined ? '' : `${paint('dim', item.header)}\n`}${paint('bold', item.question)}\n`)
    options.forEach((option, index) => {
      const description = option.description === undefined ? '' : ` ${paint('dim', `— ${option.description}`)}`
      io.out(`  ${paint('cyan', String(index + 1))}. ${option.label}${description}\n`)
    })
    const hint = options.length === 0
      ? 'answer: '
      : item.multiSelect === true ? 'numbers (e.g. 1,3) or your own answer: ' : 'number or your own answer: '
    const reply = await io.readLine(`  ${hint}`)
    if (reply === undefined) {
      answers.push({ id: item.id, selected: [] })
      continue
    }
    const parsed = parseChoice(reply, options, item.multiSelect === true)
    answers.push({ id: item.id, selected: parsed.selected, ...parsed.custom === undefined ? {} : { custom: parsed.custom } })
  }
  return { answers }
}
