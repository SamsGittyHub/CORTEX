/**
 * Live view of one Agent's work in the terminal: streamed Markdown replies, an
 * animated status line with elapsed time while the model is working, a colored
 * "synapse trace" of tool calls grouped by lobe, and a footer that sums up each
 * turn. The view holds no Cordis or Session types; the runner feeds it plain
 * values and injects the clock and timers.
 * @module @cortex-ai/cortex-tui/activity
 */

import { formatDuration, formatTokens } from './format.ts'
import { classifyTool, emptyCounts, lobeGlyph, lobeRail, lobeSummary } from './lobes.ts'
import type { Lobe, LobeCounts } from './lobes.ts'
import { MarkdownStream } from './markdown.ts'
import { oneLine, summarizeArguments } from './render.ts'
import type { Painter } from './theme.ts'

/** The clock and timers the view uses; tests substitute them. */
export interface Timers {
  now(): number
  setInterval(callback: () => void, ms: number): unknown
  clearInterval(handle: unknown): void
}

/** Options for {@link ActivityView}. */
export interface ActivityOptions {
  /** Write text to stdout. */
  readonly write: (text: string) => void
  /** The color painter; read on every write so a theme change applies at once. */
  readonly paint: Painter
  /** The clock and timers. */
  readonly timers: Timers
  /** Whether to animate the status line; only for an interactive terminal. */
  readonly animate: boolean
}

/** Totals over every turn this view has seen. */
export interface SessionTotals {
  turns: number
  steps: number
  tools: LobeCounts
  inputTokens: number
  outputTokens: number
  busyMs: number
}

/** How a turn ended. */
export type TurnOutcome =
  | { readonly kind: 'completed' }
  | { readonly kind: 'aborted' }
  | { readonly kind: 'error'; readonly code: string; readonly message: string }

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const VERBS = ['synapsing', 'firing', 'connecting', 'weighing', 'tracing', 'ruminating']
const FRAME_MS = 90
const VERB_MS = 2400
const ERASE_LINE = '\r\u001b[2K'

/** The status line in progress. */
interface Spinner {
  handle: unknown
  startedAt: number
  label: string | undefined
}

/** Presents one Agent's activity. */
export class ActivityView {
  private md: MarkdownStream
  private atLineStart = true
  private spinner: Spinner | undefined
  private reasoningSince: number | undefined
  private turnStartedAt: number | undefined
  private turnSteps = 0
  private turnTools = emptyCounts()
  private turnInput = 0
  private turnOutput = 0
  private readonly calls = new Map<string, { startedAt: number; lobe: Lobe }>()
  private planActive = false
  private readonly sessionTotals: SessionTotals = {
    turns: 0, steps: 0, tools: emptyCounts(), inputTokens: 0, outputTokens: 0, busyMs: 0,
  }

  constructor(private readonly options: ActivityOptions) {
    this.md = new MarkdownStream(options.paint)
  }

  /** @returns whether plan mode is on, as last reported by the Session log. */
  get planMode(): boolean {
    return this.planActive
  }

  /** @returns totals over every turn seen so far. */
  totals(): Readonly<SessionTotals> {
    return this.sessionTotals
  }

  /** A turn began: reset the per-turn counters and show the status line. */
  turnStart(): void {
    this.turnStartedAt = this.options.timers.now()
    this.turnSteps = 0
    this.turnTools = emptyCounts()
    this.turnInput = 0
    this.turnOutput = 0
    this.showSpinner(undefined)
  }

  /** A model step began. */
  step(): void {
    this.turnSteps += 1
  }

  /**
   * A model response reported its token usage.
   * @param input - input tokens billed.
   * @param output - output tokens billed.
   */
  usage(input: number, output: number): void {
    this.turnInput += input
    this.turnOutput += output
  }

  /**
   * Reply text arrived.
   * @param text - the next piece of the reply.
   */
  textDelta(text: string): void {
    if (text === '') return
    this.endReasoning()
    this.emit(this.md.write(text))
  }

  /** Reasoning text arrived; only its duration is shown. */
  reasoningDelta(): void {
    this.reasoningSince ??= this.options.timers.now()
    this.showSpinner('reasoning')
  }

  /** The attempt in progress was discarded and will be retried. */
  attemptAbandoned(): void {
    this.endText()
    this.startLine()
    this.emit(`${this.options.paint('dim', '(retrying)')}\n`)
  }

  /** The attempt finished: emit any text still held for styling. */
  attemptEnd(): void {
    this.endText()
  }

  /**
   * A tool call was logged.
   * @param callId - the call's id, used to pair its result.
   * @param name - the tool name.
   * @param argumentsJson - the logged arguments.
   */
  toolCall(callId: string, name: string, argumentsJson: string): void {
    this.endText()
    this.endReasoning()
    const { paint } = this.options
    const lobe = classifyTool(name)
    this.turnTools[lobe] += 1
    this.sessionTotals.tools[lobe] += 1
    this.calls.set(callId, { startedAt: this.options.timers.now(), lobe })
    this.startLine()
    const summary = summarizeArguments(argumentsJson)
    this.emit(`${lobeRail(lobe, paint)} ${lobeGlyph(lobe, paint)} ${paint('bold', name)}${summary === '' ? '' : ` ${paint('dim', summary)}`}\n`)
    this.showSpinner(name)
  }

  /**
   * A tool result was logged.
   * @param callId - the id of the call it answers.
   * @param text - the result text.
   * @param failed - whether the tool reported an error.
   */
  toolResult(callId: string, text: string, failed: boolean): void {
    const { paint, timers } = this.options
    const call = this.calls.get(callId)
    this.calls.delete(callId)
    const lobe = call?.lobe ?? 'sensory'
    const elapsed = call === undefined ? 0 : timers.now() - call.startedAt
    const took = elapsed >= 100 ? ` · ${formatDuration(elapsed)}` : ''
    this.startLine()
    this.emit(`${lobeRail(lobe, paint)}   ${paint(failed ? 'red' : 'dim', `⎿ ${failed ? 'error: ' : ''}${oneLine(text)}${took}`)}\n`)
    this.showSpinner(undefined)
  }

  /**
   * Plan mode was turned on or off.
   * @param active - the new state.
   */
  planModeChanged(active: boolean): void {
    if (active === this.planActive) return
    this.planActive = active
    this.endText()
    this.startLine()
    this.emit(`${this.options.paint('planning', '▤')} ${this.options.paint('bold', `plan mode ${active ? 'on' : 'off'}`)}\n`)
  }

  /**
   * The turn ended.
   * @param outcome - how it ended.
   */
  turnEnd(outcome: TurnOutcome): void {
    const { paint, timers } = this.options
    this.endText()
    this.endReasoning()
    this.stopSpinner()
    this.startLine()
    if (outcome.kind === 'error') this.emit(`${paint('red', `error: ${outcome.code}: ${outcome.message}`)}\n`)
    if (outcome.kind === 'aborted') this.emit(`${paint('yellow', '(interrupted)')}\n`)
    const elapsed = this.turnStartedAt === undefined ? 0 : timers.now() - this.turnStartedAt
    this.turnStartedAt = undefined
    const totals = this.sessionTotals
    totals.turns += 1
    totals.steps += this.turnSteps
    totals.inputTokens += this.turnInput
    totals.outputTokens += this.turnOutput
    totals.busyMs += elapsed
    if (this.turnSteps === 0) return
    const parts = [
      formatDuration(elapsed),
      `${String(this.turnSteps)} ${this.turnSteps === 1 ? 'step' : 'steps'}`,
      ...this.turnInput + this.turnOutput === 0 ? [] : [`${formatTokens(this.turnInput)} in · ${formatTokens(this.turnOutput)} out`],
    ]
    const lobes = lobeSummary(this.turnTools, paint)
    this.emit(`\n${paint('dim', `└─ ${parts.join(' · ')}`)}${lobes === '' ? '' : `  ${lobes}`}\n`)
  }

  /** Stop the animation and release the timer. */
  dispose(): void {
    this.stopSpinner()
  }

  private emit(text: string): void {
    if (text === '') return
    this.stopSpinner()
    this.options.write(text)
    this.atLineStart = text.endsWith('\n')
  }

  private startLine(): void {
    if (!this.atLineStart) this.emit('\n')
  }

  private endText(): void {
    this.emit(this.md.end())
    this.md = new MarkdownStream(this.options.paint)
  }

  private endReasoning(): void {
    if (this.reasoningSince === undefined) return
    const took = this.options.timers.now() - this.reasoningSince
    this.reasoningSince = undefined
    // A sub-half-second thought is not worth a line.
    if (took < 500) return
    this.startLine()
    this.emit(`${this.options.paint('dim', `✻ thought for ${formatDuration(took)}`)}\n`)
  }

  private showSpinner(label: string | undefined): void {
    if (!this.options.animate) return
    this.startLine()
    const { timers } = this.options
    if (this.spinner === undefined) {
      const spinner: Spinner = { handle: undefined, startedAt: timers.now(), label }
      spinner.handle = timers.setInterval(() => { this.drawSpinner(spinner) }, FRAME_MS)
      this.spinner = spinner
    } else {
      this.spinner.label = label
    }
    this.drawSpinner(this.spinner)
  }

  private drawSpinner(spinner: Spinner): void {
    const { paint, timers } = this.options
    const elapsed = timers.now() - spinner.startedAt
    const frame = FRAMES[Math.floor(elapsed / FRAME_MS) % FRAMES.length] as string
    const label = spinner.label ?? VERBS[Math.floor(elapsed / VERB_MS) % VERBS.length]
    this.options.write(`${ERASE_LINE}${paint('accent', frame)} ${paint('dim', `${label}… ${formatDuration(elapsed)}`)}`)
  }

  private stopSpinner(): void {
    if (this.spinner === undefined) return
    this.options.timers.clearInterval(this.spinner.handle)
    this.spinner = undefined
    this.options.write(ERASE_LINE)
  }
}
