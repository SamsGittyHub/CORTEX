/**
 * Text that must never reach the memory database: anything the user wrapped
 * in `<private>` tags, and strings shaped like credentials.
 * @module @cortex-ai/cortex-memory/privacy
 */

const PRIVATE_BLOCK = /<private>[\s\S]*?<\/private>/giu
const PRIVATE_OPEN = /<private>[\s\S]*$/iu

const SECRET_PATTERNS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/gu,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/gu,
  /\bAKIA[0-9A-Z]{16}\b/gu,
  /\bBearer\s+[A-Z0-9._~+/=-]{16,}/giu,
  /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^\s"']{8,}["']?/giu,
]

/** The text that replaces a removed secret. */
export const REDACTED = '[redacted]'

/**
 * Remove private and secret-shaped text.
 * @param text - text bound for the memory database.
 * @returns the text without `<private>…</private>` blocks (an unclosed tag removes the rest),
 *   with each credential-shaped string replaced by {@link REDACTED}.
 */
export function scrub(text: string): string {
  let clean = text.replace(PRIVATE_BLOCK, '').replace(PRIVATE_OPEN, '')
  for (const pattern of SECRET_PATTERNS) clean = clean.replace(pattern, REDACTED)
  return clean
}
