/**
 * The chat's static screens: the opening banner and the `/session`, `/stats`
 * and `/help` cards. Each is a pure function from facts to text.
 * @module @cortex-ai/cortex-tui/banner
 */

import type { SessionTotals } from './activity.ts'
import { formatDuration, formatTokens } from './format.ts'
import { LOBES, LOBE_MEANING, lobeGlyph, lobeSummary, spectrum } from './lobes.ts'
import type { Painter } from './theme.ts'

/** Facts shown by the banner and `/session`. */
export interface SessionFacts {
  readonly model: string
  readonly cwd: string
  readonly sessionId: string
  readonly theme: string
  /** The palette's tagline shown after the wordmark; empty for none. */
  readonly tagline: string
  /** The user's home directory, shown as `~` in paths. */
  readonly home: string | undefined
}

/**
 * Show a path relative to the home directory.
 * @param path - an absolute path.
 * @param home - the home directory, when known.
 * @returns the path with a leading home directory replaced by `~`.
 */
export function shortenHome(path: string, home: string | undefined): string {
  if (home === undefined || home === '') return path
  if (path === home) return '~'
  return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
}

/**
 * The opening banner: a spectrum divider in the five lobe colors, then the model,
 * directory, session, and the few keys worth knowing.
 * @param facts - what to show.
 * @param paint - the color painter.
 * @returns the banner text, ending in a blank line.
 */
export function banner(facts: SessionFacts, paint: Painter): string {
  const label = (text: string): string => paint('dim', text)
  return [
    `${paint('accent', '◈')} ${paint('bold', 'CORTEX')}  ${spectrum(paint)}${facts.tagline === '' ? '' : `  ${paint('accent', facts.tagline)}`}`,
    `  ${label('model')} ${facts.model}  ${label('dir')} ${shortenHome(facts.cwd, facts.home)}`,
    `  ${label('session')} ${facts.sessionId}`,
    `  ${paint('dim', '/plan <task> plans first · Tab completes · /help lists commands · Ctrl-D exits')}`,
    '',
    '',
  ].join('\n')
}

/**
 * The `/session` card.
 * @param facts - what to show.
 * @param paint - the color painter.
 * @returns lines with the session id, model, directory, theme, and the resume command.
 */
export function sessionCard(facts: SessionFacts, paint: Painter): string {
  const row = (name: string, value: string): string => `  ${paint('dim', name.padEnd(8))} ${value}`
  return `${[
    row('session', facts.sessionId),
    row('model', facts.model),
    row('dir', shortenHome(facts.cwd, facts.home)),
    row('theme', facts.theme),
    row('resume', `cortex --profile tui --resume ${facts.sessionId}`),
  ].join('\n')}\n`
}

/**
 * The `/stats` card.
 * @param totals - totals over the session's turns.
 * @param paint - the color painter.
 * @returns lines with turns, steps, time, tokens and lobe activity.
 */
export function statsCard(totals: Readonly<SessionTotals>, paint: Painter): string {
  const row = (name: string, value: string): string => `  ${paint('dim', name.padEnd(7))} ${value}`
  const lobes = lobeSummary(totals.tools, paint)
  return `${[
    row('turns', `${String(totals.turns)} · ${String(totals.steps)} steps · ${formatDuration(totals.busyMs)} working`),
    row('tokens', `${formatTokens(totals.inputTokens)} in · ${formatTokens(totals.outputTokens)} out`),
    row('lobes', lobes === '' ? paint('dim', 'no tool calls yet') : lobes),
  ].join('\n')}\n`
}

/**
 * The lobe legend shown by `/help`.
 * @param paint - the color painter.
 * @returns one line per lobe with its glyph and meaning.
 */
export function lobeLegend(paint: Painter): string {
  return `${LOBES.map(lobe => `  ${lobeGlyph(lobe, paint)} ${lobe.padEnd(8)} ${paint('dim', LOBE_MEANING[lobe])}`).join('\n')}\n`
}
