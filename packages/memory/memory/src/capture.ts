/**
 * Turning session activity into memory entries. These functions are pure: the
 * plugin passes plain values from the Session log and stores what comes back.
 * @module @cortex-ai/cortex-memory/capture
 */

import { scrub } from './privacy.ts'
import type { NewEntry } from './types.ts'

/** Argument names whose values are workspace paths. */
const PATH_KEYS = ['path', 'file_path', 'filePath', 'file', 'filename', 'paths', 'files'] as const

/** Longest title, in characters. */
const TITLE_CHARS = 120

/** Where an entry came from. */
export interface EntryOrigin {
  readonly session: string
  readonly project: string
  readonly ts: number
}

/** Limits that keep the database small. */
export interface CaptureLimits {
  /** Longest stored body, in characters. */
  readonly maxBodyChars: number
  /** Tools whose calls are never recorded. */
  readonly ignoreTools: ReadonlySet<string>
}

/**
 * Collapse text to one bounded line.
 * @param text - text that may span lines.
 * @param max - the character budget including the ellipsis.
 * @returns the text on one line, cut with `…` when longer than `max`.
 */
export function flatten(text: string, max: number): string {
  const flat = text.replace(/\s+/gu, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

function parseObject(json: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(json)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
  } catch (error: unknown) {
    // Logged arguments come from the model; malformed JSON simply has no fields to read.
    void error
    return undefined
  }
}

/**
 * Read the workspace paths named by a tool call's arguments.
 * @param argumentsJson - the logged arguments.
 * @returns the distinct path strings, in argument order.
 */
export function pathsFrom(argumentsJson: string): string[] {
  const args = parseObject(argumentsJson)
  if (args === undefined) return []
  const found: string[] = []
  for (const key of PATH_KEYS) {
    const value = args[key]
    if (typeof value === 'string') found.push(value)
    else if (Array.isArray(value)) found.push(...value.filter((item): item is string => typeof item === 'string'))
  }
  return [...new Set(found)]
}

/**
 * Summarize a tool call's arguments as `key=value` pairs.
 * @param argumentsJson - the logged arguments.
 * @returns a one-line summary, or an empty string for no arguments.
 */
function describeArguments(argumentsJson: string): string {
  const args = parseObject(argumentsJson)
  if (args === undefined) return flatten(argumentsJson, TITLE_CHARS)
  return Object.entries(args).map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`).join(' ')
}

/**
 * Record one finished tool call.
 * @param call - the tool, its logged arguments, and its result text.
 * @param origin - where the call happened.
 * @param limits - what to skip and how much to keep.
 * @returns the entry, or `undefined` for an ignored tool or a call with nothing left after scrubbing private text.
 */
export function observationFrom(
  call: { tool: string; argumentsJson: string; resultText: string; failed: boolean },
  origin: EntryOrigin,
  limits: CaptureLimits,
): NewEntry | undefined {
  if (limits.ignoreTools.has(call.tool)) return undefined
  const args = scrub(describeArguments(call.argumentsJson))
  const result = scrub(call.resultText)
  const title = flatten(`${call.tool} ${args}`, TITLE_CHARS)
  const body = flatten(`${call.failed ? 'FAILED: ' : ''}${result}`, limits.maxBodyChars)
  if (body === '' || body === 'FAILED:') return undefined
  return { type: 'observation', ...origin, tool: call.tool, title, body, files: pathsFrom(call.argumentsJson) }
}

/**
 * Record how one turn went.
 * @param turn - the user's request and the agent's final answer.
 * @param origin - where the turn happened.
 * @param limits - how much to keep.
 * @returns the entry, or `undefined` when the request is empty after scrubbing private text.
 */
export function summaryFrom(turn: { request: string; outcome: string }, origin: EntryOrigin, limits: CaptureLimits): NewEntry | undefined {
  const request = scrub(turn.request)
  const title = flatten(request, TITLE_CHARS)
  if (title === '') return undefined
  const outcome = scrub(turn.outcome)
  const body = flatten(`Request: ${request} Outcome: ${outcome === '' ? 'none' : outcome}`, limits.maxBodyChars)
  return { type: 'summary', ...origin, tool: '', title, body, files: [] }
}

/**
 * Record something the user or the model asked to be remembered.
 * @param note - the text and an optional title.
 * @param origin - where it was said.
 * @param limits - how much to keep.
 * @returns the entry, or `undefined` when nothing is left after scrubbing private text.
 */
export function noteFrom(
  note: { text: string; title?: string | undefined },
  origin: EntryOrigin,
  limits: CaptureLimits,
): NewEntry | undefined {
  const text = scrub(note.text)
  const body = flatten(text, limits.maxBodyChars)
  if (body === '') return undefined
  const title = flatten(note.title === undefined ? body : scrub(note.title), TITLE_CHARS)
  return { type: 'note', ...origin, tool: '', title, body, files: [] }
}
