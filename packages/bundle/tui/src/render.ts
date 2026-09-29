/**
 * Pure terminal formatting for the interactive runner: ANSI styling that a
 * color switch can turn off, bounded one-line summaries of tool calls and
 * results, and the classification of one typed line.
 * @module @cortex-ai/cortex-tui/render
 */

/** Longest single-line summary printed for a tool call or result. */
export const SUMMARY_MAX_CHARS = 120

export { colorEnabled, createPainter } from './theme.ts'
export type { Painter, Style } from './theme.ts'

/**
 * Collapse text to one line no longer than `max` characters.
 * @param text - text that may span lines.
 * @param max - the character budget including the ellipsis.
 * @returns the first non-empty line, cut with `…` when it or later lines were dropped.
 */
export function oneLine(text: string, max: number = SUMMARY_MAX_CHARS): string {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '')
  const first = lines[0] ?? ''
  if (first.length <= max && lines.length <= 1) return first
  const room = max - 1
  return `${first.length > room ? first.slice(0, room) : first}…`
}

/**
 * Summarize a tool call's JSON arguments as `key=value` pairs.
 * @param argumentsJson - the logged arguments string.
 * @returns a bounded one-line summary; the raw text when it is not a JSON object.
 */
export function summarizeArguments(argumentsJson: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(argumentsJson)
  } catch (error: unknown) {
    // Logged arguments come from the model; malformed JSON is shown verbatim.
    void error
    return oneLine(argumentsJson)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return oneLine(argumentsJson)
  const parts = Object.entries(parsed).map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
  return oneLine(parts.join(' '))
}

/** Terminal-owned commands other than `/help` and `/exit`. */
export const LOCAL_COMMAND_NAMES = ['clear', 'session', 'stats', 'theme'] as const

/** Name of a terminal-owned command. */
export type LocalCommandName = typeof LOCAL_COMMAND_NAMES[number]

/** What one typed line asks the runner to do. */
export type LineAction =
  | { readonly kind: 'empty' }
  | { readonly kind: 'exit' }
  | { readonly kind: 'help' }
  | { readonly kind: 'local'; readonly name: LocalCommandName; readonly args: string }
  | { readonly kind: 'command'; readonly line: string }
  | { readonly kind: 'message'; readonly text: string }

/**
 * Classify one typed line. `/exit`, `/quit`, `/help` and the {@link LOCAL_COMMAND_NAMES}
 * belong to the terminal; every other `/name` is a registered agent command; anything else is a message
 * for the model. A leading `//` sends a literal slash message.
 * @param raw - the line as typed.
 * @returns the action the runner takes.
 */
export function classifyLine(raw: string): LineAction {
  const line = raw.trim()
  if (line === '') return { kind: 'empty' }
  if (line.startsWith('//')) return { kind: 'message', text: line.slice(1) }
  if (!line.startsWith('/')) return { kind: 'message', text: line }
  const name = (line.slice(1).split(/\s/u, 1)[0] as string).toLowerCase()
  if (name === 'exit' || name === 'quit') return { kind: 'exit' }
  if (name === 'help' || name === '?') return { kind: 'help' }
  const local = LOCAL_COMMAND_NAMES.find(candidate => candidate === name)
  if (local !== undefined) return { kind: 'local', name: local, args: line.slice(1 + name.length).trim() }
  return { kind: 'command', line }
}

/**
 * Parse an approval answer.
 * @param answer - the typed reply.
 * @returns `true` for yes, `false` for anything else, so an unclear reply denies.
 */
export function parseYes(answer: string): boolean {
  return /^(y|yes)$/iu.test(answer.trim())
}

/** One numbered choice in a question. */
export interface ChoiceOption {
  readonly label: string
}

/** The parsed reply to a numbered question. */
export interface ChoiceReply {
  readonly selected: string[]
  readonly custom?: string
}

/**
 * Interpret a reply to a numbered question: comma- or space-separated option
 * numbers select labels; any other text is a custom answer.
 * @param answer - the typed reply.
 * @param options - the numbered options, 1-based in display order.
 * @param multiSelect - whether several numbers may be chosen.
 * @returns the selected labels or the custom text.
 */
export function parseChoice(answer: string, options: readonly ChoiceOption[], multiSelect: boolean): ChoiceReply {
  const text = answer.trim()
  const tokens = text.split(/[\s,]+/u).filter(token => token !== '')
  const numbers = tokens.map(token => (/^\d+$/u.test(token) ? Number(token) : Number.NaN))
  const valid = tokens.length > 0 && numbers.every(number => number >= 1 && number <= options.length)
  if (!valid) return { selected: [], ...text === '' ? {} : { custom: text } }
  const labels = numbers.map(number => (options[number - 1] as ChoiceOption).label)
  return { selected: multiSelect ? [...new Set(labels)] : [labels[0] as string] }
}
