/**
 * Process facts the runner reads, kept out of the package entry so substituting
 * them in tests adds no public package API.
 * @module @cortex-ai/cortex-tui/runner-internals
 */

import type { Timers } from './activity.ts'
import { createTerminal } from './terminal.ts'
import type { TerminalIo } from './repl.ts'

/** The process facts the runner reads; tests substitute them. */
export const internals: {
  openTerminal: (complete: (line: string) => readonly string[]) => TerminalIo
  timers: Timers
  writeErr: (text: string) => unknown
  stdoutIsTty: () => boolean
  env: () => Readonly<Record<string, string | undefined>>
} = {
  openTerminal: complete => createTerminal({ stdin: process.stdin, stdout: process.stdout }, complete),
  timers: {
    now: () => Date.now(),
    setInterval: (callback, ms) => setInterval(callback, ms),
    clearInterval: (handle) => { clearInterval(handle as NodeJS.Timeout) },
  },
  writeErr: text => process.stderr.write(text),
  stdoutIsTty: () => process.stdout.isTTY,
  env: () => process.env,
}
