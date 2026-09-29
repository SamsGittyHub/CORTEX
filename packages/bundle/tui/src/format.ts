/**
 * Number and duration formatting for the chat's status lines.
 * @module @cortex-ai/cortex-tui/format
 */

/**
 * Format an elapsed time compactly.
 * @param ms - milliseconds.
 * @returns `240ms`, `3.2s`, or `2m05s`.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${String(Math.max(0, Math.round(ms)))}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const seconds = Math.round(ms / 1000)
  return `${String(Math.floor(seconds / 60))}m${String(seconds % 60).padStart(2, '0')}s`
}

/**
 * Format a token count compactly.
 * @param tokens - a non-negative count.
 * @returns the count, or thousands with one decimal such as `1.2k`.
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens)
  return `${(tokens / 1000).toFixed(1)}k`
}
