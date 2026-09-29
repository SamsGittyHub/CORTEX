/**
 * The five lobes of activity the chat groups tool calls into. Each lobe has a
 * glyph and a palette color, so a glance at the left rail shows whether the
 * agent is gathering information, changing things, using memory, planning, or
 * delegating.
 * @module @cortex-ai/cortex-tui/lobes
 */

import type { Painter, PaletteStyle } from './theme.ts'

/** A group of related tool calls. */
export type Lobe = 'sensory' | 'motor' | 'memory' | 'planning' | 'delegate'

/** The lobes in display order. */
export const LOBES: readonly Lobe[] = ['sensory', 'motor', 'memory', 'planning', 'delegate']

/** What each lobe stands for, shown by `/help`. */
export const LOBE_MEANING: Record<Lobe, string> = {
  sensory: 'reading and searching',
  motor: 'running and changing things',
  memory: 'recalling and saving memory',
  planning: 'plans and todo lists',
  delegate: 'handing work to other agents',
}

const GLYPHS: Record<Lobe, string> = {
  sensory: '◉',
  motor: '▲',
  memory: '◈',
  planning: '▤',
  delegate: '⬡',
}

/** Per-lobe counts. */
export type LobeCounts = Record<Lobe, number>

/** @returns counts with every lobe at zero. */
export function emptyCounts(): LobeCounts {
  return { sensory: 0, motor: 0, memory: 0, planning: 0, delegate: 0 }
}

const MEMORY = /claude[_-]?mem|mem(?:ory|orix)|engram|recall|remember/iu
const PLANNING = /^(?:exit_plan_mode|todo_write|plan)/iu
const DELEGATE = /subagent|team|delegate|spawn|^task$/iu
const MOTOR = /^(?:bash|shell|pwsh|terminal|write|edit|patch|apply|delete|move|rename|run_code|notebook|job|kill|install)|write|edit|exec/iu

/**
 * Group a tool by its name. MCP tools are named `mcp__<server>__<tool>`, so a
 * memory server's tools land in the memory lobe through the server name.
 * @param toolName - the registered tool name.
 * @returns its lobe; tools that read or search, and any tool this cannot place, are sensory.
 */
export function classifyTool(toolName: string): Lobe {
  if (MEMORY.test(toolName)) return 'memory'
  if (PLANNING.test(toolName)) return 'planning'
  if (DELEGATE.test(toolName)) return 'delegate'
  if (MOTOR.test(toolName)) return 'motor'
  return 'sensory'
}

/**
 * The colored glyph of a lobe.
 * @param lobe - the lobe.
 * @param paint - the color painter.
 * @returns the glyph in the lobe's color.
 */
export function lobeGlyph(lobe: Lobe, paint: Painter): string {
  return paint(lobe satisfies PaletteStyle, GLYPHS[lobe])
}

/**
 * The colored left rail of a tool line.
 * @param lobe - the lobe.
 * @param paint - the color painter.
 * @returns a vertical bar in the lobe's color.
 */
export function lobeRail(lobe: Lobe, paint: Painter): string {
  return paint(lobe, '┃')
}

/**
 * Summarize lobe activity as `◉3 ▲2`.
 * @param counts - calls per lobe.
 * @param paint - the color painter.
 * @returns the non-zero lobes in display order, or an empty string when none were used.
 */
export function lobeSummary(counts: LobeCounts, paint: Painter): string {
  return LOBES.filter(lobe => counts[lobe] > 0).map(lobe => `${lobeGlyph(lobe, paint)}${String(counts[lobe])}`).join(' ')
}

/**
 * A spectrum bar of all five lobe colors, used as a divider.
 * @param paint - the color painter.
 * @param width - characters per lobe segment.
 * @returns the colored bar.
 */
export function spectrum(paint: Painter, width = 3): string {
  return LOBES.map(lobe => paint(lobe, '━'.repeat(width))).join('')
}
